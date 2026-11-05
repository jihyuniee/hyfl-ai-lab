import { OAuth2Client } from 'google-auth-library';
import projects from '../../../src/data/ai-data-projects.json' with { type: 'json' };
import { VoteError, configuration, phase, createService, tally } from './voting.mjs';
const google = new OAuth2Client();

export async function redis(command) {
  const response = await fetch(process.env.UPSTASH_REDIS_REST_URL, {
    method: 'POST', headers: { Authorization: 'Bearer ' + process.env.UPSTASH_REDIS_REST_TOKEN,
      'Content-Type': 'application/json' }, body: JSON.stringify(command), signal: AbortSignal.timeout(8000)
  });
  if (!response.ok) throw new VoteError(503, '투표 저장소에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.');
  const data = await response.json();
  if (data.error) throw new VoteError(503, '투표를 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.');
  return data.result;
}

export function prepare(req, res, methods) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Vary', 'Origin');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  const origin = req.headers.origin;
  const allowed = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  if (!origin || !allowed.includes(origin)) { res.status(403).json({ error: '허용되지 않은 접속입니다.' }); return false; }
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.setHeader('Access-Control-Allow-Methods', methods.join(', ') + ', OPTIONS');
  if (req.method === 'OPTIONS') { res.status(204).end(); return false; }
  if (!methods.includes(req.method)) { res.setHeader('Allow', methods.join(', ')); res.status(405).end(); return false; }
  return true;
}

export function failure(res, error) {
  // Do not include identity tokens, request bodies, or infrastructure errors in responses/logs.
  return res.status(error instanceof VoteError ? error.status : 503).json({
    error: error instanceof VoteError ? error.message : '일시적으로 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.'
  });
}

export const service = createService({ env: process.env, projects, redis,
  verify: async (token, audience) => (await google.verifyIdToken({ idToken: token, audience })).getPayload()
});

export async function publicStatus() {
  const config = configuration(process.env);
  const state = phase(config);
  const response = { phase: state, startsAt: config.ready ? new Date(config.start).toISOString() : null,
    endsAt: config.ready ? new Date(config.end).toISOString() : null };
  if (state === 'closed' && Date.now() >= config.end + 30 * 86400000) {
    response.resultsExpired = true;
  } else if (state === 'closed' && config.publish) {
    response.results = tally(await redis(['HVALS', 'hyfl:' + config.election + ':votes']) || [], projects);
  }
  return response;
}
