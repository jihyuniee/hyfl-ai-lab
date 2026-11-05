import { createHmac } from 'node:crypto';

export class VoteError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

export function configuration(env) {
  const domains = (env.SCHOOL_DOMAINS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  const start = Date.parse(env.VOTING_START || '');
  const end = Date.parse(env.VOTING_END || '');
  const ready = Boolean(env.GOOGLE_CLIENT_ID && domains.length && env.VOTER_HASH_SECRET?.length >= 32 &&
    env.UPSTASH_REDIS_REST_URL?.startsWith('https://') && env.UPSTASH_REDIS_REST_TOKEN &&
    Number.isFinite(start) && Number.isFinite(end) && start < end);
  return { ready, enabled: env.VOTING_ENABLED === 'true', domains, start, end,
    election: 'ai-data-2026', clientId: env.GOOGLE_CLIENT_ID,
    secret: env.VOTER_HASH_SECRET, publish: env.PUBLISH_RESULTS === 'true' };
}

export function phase(config, now = Date.now()) {
  if (!config.ready || !config.enabled) return 'preparing';
  if (now < config.start) return 'upcoming';
  return now < config.end ? 'open' : 'closed';
}

export function schoolVoter(payload, config) {
  if (!payload || !payload.sub || payload.email_verified !== true ||
      typeof payload.hd !== 'string' || !config.domains.includes(payload.hd.toLowerCase())) {
    throw new VoteError(403, '학교 구글 계정으로 로그인해 주세요.');
  }
  // Store no names, emails, or raw Google subject identifiers.
  return createHmac('sha256', config.secret).update(config.election + ':' + payload.sub).digest('hex');
}

export function validProject(projectId, projects) {
  if (projectId !== null && (typeof projectId !== 'string' || !projects.some(p => p.id === projectId))) {
    throw new VoteError(400, '등록된 프로젝트를 선택해 주세요.');
  }
  return projectId;
}

// A single field per voter replaces their old choice atomically, including concurrent requests.
// Redis server time enforces the deadline even if a request arrives near closing.
export const CAST_VOTE = `
local now = tonumber(redis.call('TIME')[1])
if now < tonumber(ARGV[3]) or now >= tonumber(ARGV[4]) then return {0, ''} end
if ARGV[2] == '' then
  redis.call('HDEL', KEYS[1], ARGV[1])
else
  redis.call('HSET', KEYS[1], ARGV[1], ARGV[2])
  redis.call('EXPIREAT', KEYS[1], tonumber(ARGV[4]) + 2592000)
end
return {1, ARGV[2]}
`;

export const RATE_LIMIT = `
local n = redis.call('INCR', KEYS[1])
if n == 1 then redis.call('EXPIRE', KEYS[1], 60) end
return n
`;

export function tally(values, projects) {
  const counts = new Map(projects.map(p => [p.id, 0]));
  for (const id of values) if (counts.has(id)) counts.set(id, counts.get(id) + 1);
  return projects.map(p => ({ projectId: p.id, title: p.title, votes: counts.get(p.id) }));
}

export function createService({ env, projects, verify, redis, now = Date.now }) {
  const config = configuration(env);
  const key = 'hyfl:' + config.election + ':votes';
  return async function service({ method, token, body }) {
    if (!config.ready) throw new VoteError(503, '투표를 준비하고 있습니다.');
    if (!['GET', 'POST'].includes(method)) throw new VoteError(405, '지원하지 않는 요청입니다.');
    const state = phase(config, now());
    if (method === 'POST' && state !== 'open') throw new VoteError(409, '현재는 투표 기간이 아닙니다.');
    if (!token || token.length > 8192) throw new VoteError(401, '학교 구글 계정으로 로그인해 주세요.');
    let payload;
    try { payload = await verify(token, config.clientId); }
    catch { throw new VoteError(401, '로그인이 만료되었습니다. 다시 로그인해 주세요.'); }
    const voter = schoolVoter(payload, config);
    const attempts = await redis(['EVAL', RATE_LIMIT, 1, `${key}:rate:${voter}`]);
    if (attempts > 30) throw new VoteError(429, '잠시 후 다시 시도해 주세요.');
    if (method === 'GET') return { projectId: await redis(['HGET', key, voter]) || null, phase: state };
    const projectId = validProject(body?.projectId, projects);
    const result = await redis(['EVAL', CAST_VOTE, 1, key, voter, projectId || '',
      Math.floor(config.start / 1000), Math.floor(config.end / 1000)]);
    if (Number(result[0]) !== 1) throw new VoteError(409, '투표가 마감되었거나 아직 시작되지 않았습니다.');
    return { projectId: result[1] || null, phase: 'open' };
  };
}
