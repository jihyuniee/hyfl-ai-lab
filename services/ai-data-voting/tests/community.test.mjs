import test from 'node:test';
import assert from 'node:assert/strict';
import { createCommunity } from '../lib/community.mjs';
const first = 'a0000000-0000-4000-8000-000000000001';
const second = 'a0000000-0000-4000-8000-000000000002';
function fixture() {
  const files = new Map();
  const service = createCommunity({ projects: [{ id: 'sample' }], secret: 'test-secret-'.repeat(4), now: () => 1794240000000,
    storage: {
      async list(prefix) { return [...files.keys()].filter(path => path.startsWith(prefix)).map(pathname => ({ pathname })); },
      async read(path) { return files.get(path) ?? null; },
      async create(path, value, idempotent = false) { if (files.has(path)) return idempotent; files.set(path, value); return true; },
      async remove(path) { files.delete(path); }
    } });
  return { files, service };
}
test('likes are shared, idempotent, independent and removable', async () => {
  const { service } = fixture();
  await Promise.all([service.like('sample', first, true), service.like('sample', second, true)]);
  await service.like('sample', first, true);
  assert.deepEqual(await service.summary('sample', first), { projectId: 'sample', likes: 2, comments: 0, liked: true });
  await service.like('sample', first, false);
  assert.equal((await service.summary('sample', second)).likes, 1);
  assert.equal((await service.summary('sample', first)).liked, false);
});
test('only the author can remove a comment and public results hide identities', async () => {
  const { service } = fixture();
  const result = await service.comment('sample', first, '  지도가 보기 좋아요.  ');
  assert.equal(result.comments[0].text, '지도가 보기 좋아요.');
  assert.equal(result.comments[0].own, true);
  assert.equal('author' in result.comments[0], false);
  const other = await service.comments('sample', second);
  assert.equal(other.comments[0].own, false);
  await assert.rejects(service.removeComment('sample', second, result.comments[0].id), { status: 403 });
  await service.removeComment('sample', first, result.comments[0].id);
  assert.equal((await service.comments('sample', first)).total, 0);
});
test('empty, oversize, duplicate, invalid project and invalid visitor requests are rejected', async () => {
  const { service } = fixture();
  await assert.rejects(service.like('unknown', first, true), { status: 400 });
  await assert.rejects(service.like('sample', 'not-an-id', true), { status: 401 });
  await assert.rejects(service.like('sample', first, 'true'), { status: 400 });
  await assert.rejects(service.comment('sample', first, '  '), { status: 400 });
  await assert.rejects(service.comment('sample', first, 'a'.repeat(301)), { status: 400 });
  await service.comment('sample', first, '첫 감상');
  await assert.rejects(service.comment('sample', first, '중복 감상'), { status: 429 });
});
