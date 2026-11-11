import test from 'node:test';
import assert from 'node:assert/strict';
import { authenticate, authConfiguration, publicProfile } from '../lib/community-auth.mjs';
const env = { GOOGLE_CLIENT_ID: 'fixture.apps.googleusercontent.com', SCHOOL_DOMAINS: 'school.example', VOTER_HASH_SECRET: 'test-secret-'.repeat(4), COMMUNITY_ADMIN_EMAILS: 'teacher@school.example' };
const payload = { sub: 'google-stable-subject', name: '학교 관람객', email: 'member@school.example', email_verified: true, hd: 'school.example', picture: 'https://lh3.googleusercontent.com/profile' };
test('unconfigured login fails closed and public config contains no secrets', async () => {
  assert.equal(authConfiguration({}).ready, false);
  await assert.rejects(authenticate('token', {}), { status: 503 });
  assert.equal(JSON.stringify(authConfiguration(env)).includes(env.VOTER_HASH_SECRET), false);
});
test('server uses Google verifier with exact client audience; account identity is stable and private', async () => {
  const actor = await authenticate('signed-token', env, async (token, audience) => { assert.equal(token, 'signed-token'); assert.equal(audience, env.GOOGLE_CLIENT_ID); return payload; });
  assert.equal(actor.school, true); assert.equal(actor.isAdmin, false); assert.equal(actor.profile.name, payload.name);
  assert.match(actor.id, /^[0-9a-f]{64}$/); assert.equal(actor.id.includes(payload.sub), false);
  const repeated = await authenticate('another-token', env, async () => payload); assert.equal(repeated.id, actor.id);
  const teacher = await authenticate('token', env, async () => ({ ...payload, email: 'teacher@school.example' })); assert.equal(teacher.isAdmin, true);
});
test('forged/expired tokens, personal accounts, other schools and missing verified hd are rejected', async () => {
  await assert.rejects(authenticate('forged-token', env, async () => { throw new Error('invalid signature or expiry'); }), { status: 401 });
  for (const change of [{ hd: undefined }, { hd: 'other.example' }, { email_verified: false }, { sub: undefined }]) {
    await assert.rejects(authenticate('token', env, async () => ({ ...payload, ...change })), { status: 403 });
  }
});
test('public profile accepts Google images only and never uses email as a display name', () => {
  for (const picture of ['javascript:alert(1)', 'https://evil.example/image', 'https://googleusercontent.com.evil.example/a', 'http://lh3.googleusercontent.com/a']) assert.equal(publicProfile({ ...payload, picture }).picture, '');
  assert.equal(publicProfile({ ...payload, name: payload.email }).name, '학교 관람객');
});
