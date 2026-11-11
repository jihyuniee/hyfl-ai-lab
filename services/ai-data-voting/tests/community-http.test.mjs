import test from 'node:test';
import assert from 'node:assert/strict';
import handler, { prepareCommunity, communityForEnvironment, createHandler } from '../../../api/ai-data/community.mjs';
import { BlobStoreSuspendedError } from '../lib/blob.mjs';
function response() { return { headers: {}, statusCode: null, body: null, setHeader(key, value) { this.headers[key] = value; }, status(value) { this.statusCode = value; return this; }, json(value) { this.body = value; }, end() {} }; }
test('community rejects other origins and exposes exact approved CORS methods', () => {
  process.env.ALLOWED_ORIGINS = 'https://jihyuniee.github.io';
  for (const origin of [undefined, 'https://other.example']) { const res = response(); assert.equal(prepareCommunity({ headers: { origin }, method: 'GET' }, res), false); assert.equal(res.statusCode, 403); }
  const res = response(); prepareCommunity({ headers: { origin: 'https://jihyuniee.github.io' }, method: 'OPTIONS' }, res);
  assert.equal(res.statusCode, 204); assert.equal(res.headers['Cache-Control'], 'no-store'); assert.match(res.headers['Access-Control-Allow-Methods'], /DELETE/);
});
test('missing storage never pretends to save a reaction', async () => {
  const token = process.env.BLOB_READ_WRITE_TOKEN; const id = process.env.BLOB_STORE_ID;
  delete process.env.BLOB_READ_WRITE_TOKEN; delete process.env.BLOB_STORE_ID;
  const res = response(); await handler({ headers: { origin: 'https://jihyuniee.github.io' }, method: 'POST', url: '/api/ai-data/community', body: { action: 'like' } }, res);
  assert.equal(res.statusCode, 503); assert.equal('likes' in res.body, false);
  if (token) process.env.BLOB_READ_WRITE_TOKEN = token; if (id) process.env.BLOB_STORE_ID = id;
});

test('anonymous writes and legacy client UUID writes cannot bypass school login', async () => {
  const { createHandler } = await import('../../../api/ai-data/community.mjs');
  const { createCommunity } = await import('../lib/community.mjs');
  let writes = 0;
  const env = { BLOB_STORE_ID: 'test-only', VOTER_HASH_SECRET: 'test-secret-'.repeat(4) };
  const community = createCommunity({ projects: [{ id: 'sample' }], secret: env.VOTER_HASH_SECRET, storage: { create: async () => { writes++; }, list: async () => [], read: async () => null } });
  const run = createHandler({ env, community });
  for (const authorization of [undefined, 'Bearer a0000000-0000-4000-8000-000000000001']) {
    const res = response();
    await run({ headers: { origin: 'https://jihyuniee.github.io', authorization, 'content-type': 'application/json' }, method: 'POST', url: '/api/ai-data/community', body: { action: 'like', projectId: 'sample', liked: true, profileConsent: true, actor: { authenticated: true, isAdmin: true } } }, res);
    assert.equal(res.statusCode, 401);
  }
  assert.equal(writes, 0);
});
test('unconfigured session is readable, reports not ready and exposes no private env', async () => {
  const { createHandler } = await import('../../../api/ai-data/community.mjs');
  const res = response();
  await createHandler({ env: { VOTER_HASH_SECRET: 'never-public', COMMUNITY_ADMIN_EMAILS: 'private@school.example' } })({ headers: { origin: 'https://jihyuniee.github.io' }, method: 'GET', url: '/api/ai-data/community?session=true' }, res);
  assert.equal(res.statusCode, 200); assert.equal(res.body.auth.ready, false); assert.equal(res.body.viewer, null);
  assert.equal(JSON.stringify(res.body).includes('never-public'), false); assert.equal(JSON.stringify(res.body).includes('private@'), false);
});
test('an authenticated write reports suspended storage without exposing credentials or comment data', async () => {
  const { createHandler } = await import('../../../api/ai-data/community.mjs');
  const failures = [];
  const res = response();
  await createHandler({
    env: { BLOB_STORE_ID: 'test-only' },
    auth: async () => ({ authenticated: true, id: 'a'.repeat(64), email: 'private@school.example' }),
    community: { async comment() { throw new BlobStoreSuspendedError(); } },
    reportFailure: (...args) => failures.push(args)
  })({ headers: { origin: 'https://jihyuniee.github.io', authorization: 'Bearer test-only-credential', 'content-type': 'application/json' },
    method: 'POST', url: '/api/ai-data/community', body: { action: 'comment', projectId: 'sample', text: 'private test text', profileConsent: true } }, res);
  assert.equal(res.statusCode, 503);
  assert.equal(res.body.code, 'COMMUNITY_STORAGE_SUSPENDED');
  assert.match(res.body.error, /입력한 내용은 유지/);
  assert.deepEqual(failures, [['COMMUNITY_STORAGE_SUSPENDED', 'POST']]);
  for (const privateValue of ['test-only-credential', 'private@school.example', 'private test text']) {
    assert.equal(JSON.stringify({ body: res.body, failures }).includes(privateValue), false);
  }
});
test('DATABASE_URL selects Postgres and session responses never expose the connection string', async () => {
  const url = 'postgresql://private-user:private-password@private.example/database';
  const env = { DATABASE_URL: url, BLOB_STORE_ID: 'old-blob' };
  let queries = 0;
  const community = communityForEnvironment(env, value => { assert.equal(value, url); return async () => { queries++; return []; }; });
  const res = response();
  await createHandler({ env, community })({ headers: { origin: 'https://jihyuniee.github.io' }, method: 'GET', url: '/api/ai-data/community?session=true' }, res);
  assert.equal(res.statusCode, 200); assert.equal(res.body.storage, 'postgres'); assert.equal(queries, 0);
  assert.equal(JSON.stringify(res.body).includes('private-password'), false);
  await community.all(); assert.equal(queries, 1);
});
test('a database failure does not silently switch a write to Blob', async () => {
  const env = { DATABASE_URL: 'postgresql://private@db.example/database', BLOB_STORE_ID: 'old-blob' };
  const failures = [];
  const community = communityForEnvironment(env, () => async () => { const error = new Error('private database detail'); error.code = 'DB_FAILURE'; throw error; });
  const res = response();
  await createHandler({ env, community, auth: async () => ({ authenticated: true, id: 'a'.repeat(64), profile: { name: '관람객', picture: '' } }),
    reportFailure: (...args) => failures.push(args) })({ headers: { origin: 'https://jihyuniee.github.io', authorization: 'Bearer test-only', 'content-type': 'application/json' }, method: 'POST', url: '/api/ai-data/community', body: { action: 'like', projectId: 'data-queen', liked: true, profileConsent: true } }, res);
  assert.equal(res.statusCode, 503); assert.equal('likes' in res.body, false);
  assert.equal(JSON.stringify(res.body).includes('private database detail'), false);
  assert.deepEqual(failures, [['COMMUNITY_UNEXPECTED_FAILURE', 'POST']]);
});

test('the old Blob backend rejects reply requests instead of flattening them into ordinary comments', async () => {
  const { createCommunity } = await import('../lib/community.mjs'); let writes = 0;
  const community = createCommunity({ projects: [{id:'sample'}], secret:'test-secret-'.repeat(4), storage:{create:async()=>{writes++;},list:async()=>[],read:async()=>null} });
  const actor={authenticated:true,id:'a'.repeat(64),profile:{name:'시험',picture:''}};
  const parent='99970000000-'+'d'.repeat(64);
  await assert.rejects(community.comment('sample',actor,'답글',true,parent),{status:503});
  await assert.rejects(community.comments('sample',actor,{parentId:parent}),{status:503});
  assert.equal(writes,0);
});
