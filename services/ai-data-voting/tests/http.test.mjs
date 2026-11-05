import test from 'node:test';
import assert from 'node:assert/strict';
process.env.ALLOWED_ORIGINS = 'https://jihyuniee.github.io';
const { prepare, publicStatus, failure } = await import('../lib/http.mjs');
function response() {
  return { headers: {}, code: null, value: null, setHeader(k, v) { this.headers[k] = v; },
    status(n) { this.code = n; return this; }, json(v) { this.value = v; return this; }, end() { return this; } };
}
test('CORS rejects absent and unapproved origins', () => {
  for (const origin of [undefined, 'https://evil.example']) {
    const res = response(); assert.equal(prepare({ headers: { origin }, method: 'POST' }, res, ['POST']), false);
    assert.equal(res.code, 403); assert.equal(res.headers['Access-Control-Allow-Origin'], undefined);
  }
});
test('approved preflight has precise origin and no caching', () => {
  const res = response(); assert.equal(prepare({ headers: { origin: 'https://jihyuniee.github.io' }, method: 'OPTIONS' }, res, ['POST']), false);
  assert.equal(res.code, 204); assert.equal(res.headers['Access-Control-Allow-Origin'], 'https://jihyuniee.github.io');
  assert.equal(res.headers['Cache-Control'], 'no-store');
});
test('unconfigured server exposes no totals or secrets', async () => {
  const status = await publicStatus(); assert.equal(status.phase, 'preparing');
  assert.equal(status.results, undefined); assert.equal(status.startsAt, null);
});
test('infrastructure failure never returns internal details', () => {
  const res = response(); failure(res, new Error('internal token or URL'));
  assert.equal(res.code, 503); assert.equal(JSON.stringify(res.value).includes('internal'), false);
});
