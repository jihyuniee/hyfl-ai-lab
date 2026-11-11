import { createHmac } from 'node:crypto';
import { OAuth2Client } from 'google-auth-library';
import { CommunityError } from './community.mjs';

const google = new OAuth2Client();
const values = value => (value || '').split(',').map(x => x.trim().toLowerCase()).filter(Boolean);
export function authConfiguration(env) {
  const domains = values(env.SCHOOL_DOMAINS);
  const ready = Boolean(env.GOOGLE_CLIENT_ID && domains.length && env.VOTER_HASH_SECRET?.length >= 32);
  return { ready, clientId: ready ? env.GOOGLE_CLIENT_ID : '', schoolDomains: domains };
}
export function publicProfile(payload) {
  const name = typeof payload.name === 'string' ? payload.name.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 60) : '';
  let picture = '';
  try {
    const url = new URL(payload.picture);
    if (url.protocol === 'https:' && (url.hostname === 'googleusercontent.com' || url.hostname.endsWith('.googleusercontent.com')) && !url.username && !url.password) picture = url.href;
  } catch { /* Use the initial avatar when there is no trusted profile image. */ }
  return { name: name && !name.includes('@') ? name : '학교 관람객', picture };
}
export async function authenticate(token, env, verify = async (idToken, audience) => (await google.verifyIdToken({ idToken, audience })).getPayload()) {
  const config = authConfiguration(env);
  if (!config.ready) throw new CommunityError(503, '학교 로그인을 준비하고 있습니다.');
  if (typeof token !== 'string' || !token || token.length > 8192) throw new CommunityError(401, '학교 구글 계정으로 로그인해 주세요.');
  let payload;
  try { payload = await verify(token, config.clientId); }
  catch { throw new CommunityError(401, '로그인이 만료되었거나 유효하지 않습니다. 다시 로그인해 주세요.'); }
  if (!payload?.sub || payload.email_verified !== true || typeof payload.hd !== 'string' || !config.schoolDomains.includes(payload.hd.toLowerCase())) throw new CommunityError(403, '학교 구글 계정으로 로그인해 주세요.');
  const email = typeof payload.email === 'string' ? payload.email.toLowerCase() : '';
  return { id: createHmac('sha256', env.VOTER_HASH_SECRET).update('community-google-v1:' + payload.sub).digest('hex'),
    school: true, profile: publicProfile(payload), email, isAdmin: Boolean(email && values(env.COMMUNITY_ADMIN_EMAILS).includes(email)) };
}
