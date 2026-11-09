import test from 'node:test';
import assert from 'node:assert/strict';
import handler, { prepareCommunity } from '../../../api/ai-data/community.mjs';
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
