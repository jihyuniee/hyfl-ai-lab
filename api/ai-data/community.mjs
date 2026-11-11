import { put, list, get, del } from '../../services/ai-data-voting/lib/blob.mjs';
import projects from '../../src/data/ai-data-projects.json' with { type: 'json' };
import { createCommunity, CommunityError, isLegacyVisitor } from '../../services/ai-data-voting/lib/community.mjs';
import { authenticate, authConfiguration } from '../../services/ai-data-voting/lib/community-auth.mjs';

const storage = {
  async list(prefix) {
    const result = [];
    let cursor;
    do {
      const page = await list({ prefix, cursor, limit: 1000 });
      result.push(...page.blobs);
      cursor = page.hasMore ? page.cursor : undefined;
      if (result.length > 10000) throw new CommunityError(503, '반응을 불러오는 중입니다. 잠시 후 다시 열어 주세요.');
    } while (cursor);
    return result;
  },
  async read(path) {
    const result = await get(path, { access: 'private', useCache: false });
    return result?.statusCode === 200 ? JSON.parse(await new Response(result.stream).text()) : null;
  },
  async create(path, value, idempotent = false) {
    try {
      await put(path, JSON.stringify(value), { access: 'private', addRandomSuffix: false,
        allowOverwrite: false, contentType: 'application/json', cacheControlMaxAge: 60 });
      return true;
    } catch (error) {
      if (await storage.read(path)) return idempotent;
      throw error;
    }
  },
  async remove(path) { await del(path); }
};
const service = createCommunity({ storage, projects, secret: process.env.VOTER_HASH_SECRET });
export function prepareCommunity(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Vary', 'Origin');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  const origin = req.headers.origin;
  const allowed = (process.env.ALLOWED_ORIGINS || '').split(',').map(value => value.trim()).filter(Boolean);
  if (!origin || !allowed.includes(origin)) { res.status(403).json({ error: '허용되지 않은 접속입니다.' }); return false; }
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-Community-Visitor');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') { res.status(204).end(); return false; }
  if (!['GET', 'POST', 'DELETE'].includes(req.method)) { res.setHeader('Allow', 'GET, POST, DELETE, OPTIONS'); res.status(405).end(); return false; }
  return true;
}
export function createHandler({ community = service, env = process.env, auth = authenticate } = {}) {
return async function handler(req, res) {
  if (!prepareCommunity(req, res)) return;
  try {
    const token = req.headers.authorization?.match(/^Bearer (\S+)$/)?.[1];
    const legacyToken = req.headers['x-community-visitor'] || (isLegacyVisitor(token) ? token : undefined);
    const actor = token && !isLegacyVisitor(token) ? await auth(token, env) : null;
    const params = new URL(req.url, 'https://community.invalid').searchParams;
    const projectId = params.get('project');
    let result;
    if (req.method === 'GET') {
      const session = { auth: authConfiguration(env), viewer: actor ? { ...actor.profile, isAdmin: actor.isAdmin } : null };
      if (params.has('session')) { res.status(200).json(session); return; }
      if (!env.BLOB_READ_WRITE_TOKEN && !env.BLOB_STORE_ID) throw new CommunityError(503, '좋아요와 댓글을 준비하고 있습니다.');
      result = !projectId ? { ...session, projects: await community.all(actor) } : params.get('view') === 'likes' ?
        await community.likers(projectId, params.get('cursor') || '') : await community.comments(projectId, actor, { legacyToken, cursor: params.get('cursor') || '', manage: params.get('manage') === 'true' });
    } else {
      if (!env.BLOB_READ_WRITE_TOKEN && !env.BLOB_STORE_ID) throw new CommunityError(503, '좋아요와 댓글을 준비하고 있습니다.');
      if (!req.headers['content-type']?.startsWith('application/json')) throw new CommunityError(415, 'JSON 요청이 필요합니다.');
      if (Number(req.headers['content-length'] || 0) > 4096) throw new CommunityError(413, '입력한 내용이 너무 깁니다.');
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      if (JSON.stringify(body || {}).length > 4096) throw new CommunityError(413, '입력한 내용이 너무 깁니다.');
      if (!body || typeof body !== 'object') throw new CommunityError(400, '입력한 내용을 확인해 주세요.');
      if (req.method === 'DELETE') result = await community.removeComment(body.projectId, actor, body.commentId, legacyToken);
      else if (body.action === 'like') result = await community.like(body.projectId, actor, body.liked, body.profileConsent);
      else if (body.action === 'comment') result = await community.comment(body.projectId, actor, body.text, body.profileConsent);
      else if (body.action === 'moderate') result = await community.moderate(body.projectId, actor, body.commentId, body.hidden);
      else throw new CommunityError(400, '요청을 확인해 주세요.');
    }
    res.status(200).json(result);
  } catch (error) {
    const status = error instanceof CommunityError ? error.status : error instanceof SyntaxError ? 400 : 503;
    res.status(status).json({ error: error instanceof CommunityError ? error.message : status === 400 ? '입력한 내용을 확인해 주세요.' : '반응을 저장하거나 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.' });
  }
};
}
export default createHandler();
