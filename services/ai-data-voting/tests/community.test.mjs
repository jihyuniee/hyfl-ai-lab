import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { createCommunity } from '../lib/community.mjs';
const secret = 'test-secret-'.repeat(4);
const first = { id: 'a'.repeat(64), authenticated: true, profile: { name: '첫 관람객', picture: '' }, email: 'first@school.example', isAdmin: false };
const second = { ...first, id: 'b'.repeat(64), profile: { name: '두 번째 관람객', picture: '' }, email: 'second@school.example' };
const admin = { ...first, id: 'c'.repeat(64), isAdmin: true };
function fixture() {
  const files = new Map(); let time = 1794240000000;
  const service = createCommunity({ projects: [{ id: 'sample' }], secret, now: () => time,
    storage: {
      async list(prefix) { return [...files.keys()].filter(path => path.startsWith(prefix)).map(pathname => ({ pathname })); },
      async read(path) { return files.get(path) ?? null; },
      async create(path, value, idempotent = false) { if (files.has(path)) return idempotent; files.set(path, value); return true; },
      async remove(path) { files.delete(path); }
    } });
  return { files, service, advance: () => time += 60000 };
}
test('school likes deduplicate across devices, show public profiles and remain removable', async () => {
  const { service } = fixture();
  await Promise.all([service.like('sample', first, true, true), service.like('sample', second, true, true)]);
  await service.like('sample', { ...first }, true, true);
  const result = await service.summary('sample', first);
  assert.equal(result.likes, 2); assert.equal(result.liked, true); assert.equal(result.people.length, 2);
  const people = await service.likers('sample'); assert.equal(people.people[0].name, first.profile.name);
  assert.equal(JSON.stringify(people).includes(first.email), false); assert.equal(JSON.stringify(people).includes(first.id), false);
  await service.like('sample', { ...first }, false);
  assert.equal((await service.summary('sample', first)).liked, false); assert.equal((await service.summary('sample')).likes, 1);
});
test('anonymous and legacy UUIDs cannot create reactions; profile disclosure is required', async () => {
  const { service, files } = fixture();
  for (const actor of [null, 'a0000000-0000-4000-8000-000000000001', { id: first.id }]) {
    await assert.rejects(service.like('sample', actor, true, true), { status: 401 });
    await assert.rejects(service.comment('sample', actor, '익명 작성', true), { status: 401 });
  }
  await assert.rejects(service.like('sample', first, true, false), { status: 400 });
  await assert.rejects(service.comment('sample', first, '감상', false), { status: 400 });
  assert.equal(files.size, 0);
});
test('comments expose verified profile but never email/author IDs, and only owners delete', async () => {
  const { service } = fixture();
  const result = await service.comment('sample', first, '  지도가 보기 좋아요.  ', true);
  const comment = result.comments[0]; assert.equal(comment.text, '지도가 보기 좋아요.'); assert.equal(comment.own, true);
  assert.deepEqual(comment.profile, first.profile); assert.equal('author' in comment, false); assert.equal('authorEmail' in comment, false);
  assert.equal(JSON.stringify(await service.comments('sample', second)).includes(first.email), false);
  await assert.rejects(service.removeComment('sample', second, comment.id), { status: 403 });
  await service.removeComment('sample', { ...first }, comment.id);
  assert.equal((await service.comments('sample')).total, 0);
});
test('invalid projects, content and per-minute duplicates are rejected', async () => {
  const { service, advance } = fixture();
  await assert.rejects(service.like('unknown', first, true, true), { status: 400 });
  await assert.rejects(service.like('sample', first, 'true', true), { status: 400 });
  for (const text of ['  ', 'a'.repeat(301), null]) await assert.rejects(service.comment('sample', first, text, true), { status: 400 });
  await service.comment('sample', first, '첫 감상', true);
  await assert.rejects(service.comment('sample', first, '중복 감상', true), { status: 429 });
  advance(); await service.comment('sample', first, '다음 감상', true);
  assert.equal((await service.comments('sample')).total, 2);
});
test('legacy records are preserved, never assigned to school identities, and old owners can delete', async () => {
  const { service, files } = fixture();
  const visitor = 'a0000000-0000-4000-8000-000000000001';
  const author = createHmac('sha256', secret).update('community-v1:' + visitor).digest('hex');
  const id = '99970000000-' + 'd'.repeat(64);
  files.set(`community/comments/sample/${id}.json`, { text: '이전 댓글', author, createdAt: '2026-11-10T00:00:00Z' });
  files.set(`community/likes/sample/${author}.json`, { createdAt: '2026-11-10T00:00:00Z' });
  const page = await service.comments('sample', first); assert.equal(page.comments[0].own, false); assert.equal(page.comments[0].profile, null);
  assert.equal((await service.likers('sample')).anonymous, 1);
  assert.equal((await service.summary('sample', first)).likes, 1);
  assert.equal((await service.comments('sample', null, { legacyToken: visitor })).comments[0].own, true);
  await service.removeComment('sample', null, id, visitor);
  assert.equal(files.size, 1); assert.equal((await service.summary('sample')).likes, 1);
});
test('only configured teachers can inspect private identity, hide and restore without deleting the original', async () => {
  const { service, files } = fixture();
  const id = (await service.comment('sample', first, '관리 대상 댓글', true)).comments[0].id;
  await assert.rejects(service.moderate('sample', second, id, true), { status: 403 });
  await assert.rejects(service.comments('sample', second, { manage: true }), { status: 403 });
  const hidden = await service.moderate('sample', admin, id, true);
  assert.equal(hidden.comments[0].authorEmail, first.email); assert.equal(hidden.comments[0].hidden, true);
  assert.equal((await service.comments('sample')).total, 0); assert.equal((await service.summary('sample')).comments, 0);
  assert.equal(files.has(`community/comments/sample/${id}.json`), true);
  await service.moderate('sample', admin, id, false); assert.equal((await service.comments('sample')).total, 1);
});
test('older comments and large liker lists paginate without duplicate or lost records', async () => {
  const { service, advance } = fixture();
  for (let i = 0; i < 55; i++) {
    await service.comment('sample', first, `감상 ${i}`, true); advance();
    await service.like('sample', { ...first, id: i.toString(16).padStart(64, '0') }, true, true);
  }
  let cursor = '', ids = [];
  do { const page = await service.comments('sample', null, { cursor }); ids.push(...page.comments.map(x => x.id)); cursor = page.nextCursor; } while (cursor);
  assert.equal(ids.length, 55); assert.equal(new Set(ids).size, 55);
  const people = await service.likers('sample'); assert.equal(people.people.length, 50); assert.ok(people.nextCursor);
  assert.equal((await service.likers('sample', people.nextCursor)).people.length, 5);
  await assert.rejects(service.comments('sample', null, { cursor: '../other' }), { status: 400 });
});
