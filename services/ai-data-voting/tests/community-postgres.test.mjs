import test, { before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHmac } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { createPostgresCommunity } from '../lib/community-postgres.mjs';
import { prepareCommunityDatabase } from '../scripts/prepare-community-db.mjs';
import { importBlobCommunity } from '../lib/community-import.mjs';
import { createHandler } from '../../../api/ai-data/community.mjs';

const db = new PGlite();
const schema = await readFile(new URL('../sql/community.sql', import.meta.url), 'utf8');
const secret = 'database-test-secret-'.repeat(3);
const first = { authenticated: true, id: 'a'.repeat(64), profile: { name: "O'Reilly 관람객", picture: '' }, email: 'private@school.example', isAdmin: false };
const second = { ...first, id: 'b'.repeat(64), profile: { name: '다른 관람객', picture: '' } };
const teacher = { ...second, id: 'c'.repeat(64), isAdmin: true };
const query = async (text, params = []) => (await db.query(text, params)).rows;
before(async () => { await db.exec(schema); });
beforeEach(async () => { await db.exec('TRUNCATE hyfl_community.moderation, hyfl_community.comments, hyfl_community.likes, hyfl_community.migrations'); });
after(async () => { await db.close(); });
function fixture(projects = [{ id: 'sample' }]) {
  let time = 1794240000000, count = 0;
  return { service: createPostgresCommunity({ query: async (...args) => { count++; return query(...args); }, projects, secret, now: () => time }),
    advance: () => time += 60000, queries: () => count };
}
test('Postgres enforces one like per account under concurrency and supports cancellation', async () => {
  const { service } = fixture();
  await Promise.all([service.like('sample', first, true, true), service.like('sample', { ...first }, true, true)]);
  await service.like('sample', second, true, true);
  assert.equal((await service.summary('sample', first)).likes, 2);
  assert.equal((await service.likers('sample')).people[0].name, first.profile.name);
  const cancelled = await service.like('sample', { ...first }, false);
  assert.equal(cancelled.likes, 1); assert.equal(cancelled.liked, false);
});
test('Postgres binds comment text, protects identity and checks owners before deletion', async () => {
  const { service } = fixture();
  const text = "좋아요'); DROP TABLE hyfl_community.comments; --";
  const page = await service.comment('sample', first, text, true);
  assert.equal(page.comments[0].text, text);
  assert.equal(page.comments[0].own, true);
  const publicPage = await service.comments('sample', second);
  assert.equal(publicPage.comments[0].own, false);
  for (const privateValue of [first.id, first.email, 'authorEmail', 'author_id']) assert.equal(JSON.stringify(publicPage).includes(privateValue), false);
  await assert.rejects(service.removeComment('sample', second, page.comments[0].id), { status: 403 });
  await service.removeComment('sample', { ...first }, page.comments[0].id);
  assert.equal((await service.comments('sample')).total, 0);
});
test('Postgres concurrent comments retain the per-minute limit and fail closed without consent/login', async () => {
  const { service, advance } = fixture();
  const attempts = await Promise.allSettled([service.comment('sample', first, '감상', true), service.comment('sample', { ...first }, '중복', true)]);
  assert.equal(attempts.filter(x => x.status === 'fulfilled').length, 1);
  assert.equal(attempts.find(x => x.status === 'rejected').reason.status, 429);
  advance(); await service.comment('sample', first, '다음 감상', true);
  for (const actor of [null, 'a0000000-0000-4000-8000-000000000001', { id: first.id }]) await assert.rejects(service.comment('sample', actor, '익명', true), { status: 401 });
  await assert.rejects(service.comment('sample', first, '비공개', false), { status: 400 });
  await assert.rejects(service.like('sample', first, true, false), { status: 400 });
  await assert.rejects(service.comment('sample', first, 'x'.repeat(301), true), { status: 400 });
  await assert.rejects(service.like('unregistered', first, true, true), { status: 400 });
  assert.equal((await service.comments('sample')).total, 2);
});
test('Postgres teacher moderation preserves the original text and hides private email from public reads', async () => {
  const { service } = fixture();
  const id = (await service.comment('sample', first, '보존할 감상', true)).comments[0].id;
  await assert.rejects(service.comments('sample', second, { manage: true }), { status: 403 });
  await assert.rejects(service.moderate('sample', second, id, true), { status: 403 });
  const managed = await service.moderate('sample', teacher, id, true);
  assert.equal(managed.comments[0].authorEmail, first.email);
  assert.equal(managed.comments[0].hidden, true);
  assert.equal((await service.comments('sample')).total, 0);
  assert.equal((await service.summary('sample')).comments, 0);
  assert.equal((await query('SELECT text FROM hyfl_community.comments'))[0].text, '보존할 감상');
  await service.moderate('sample', teacher, id, false);
  assert.equal((await service.comments('sample')).total, 1);
  await service.moderate('sample', teacher, id, true);
  await service.removeComment('sample', first, id);
  assert.equal((await query('SELECT * FROM hyfl_community.moderation')).length, 0);
});
test('Postgres aggregates 18 project summaries in one query and paginates without losing records', async () => {
  const projects = Array.from({ length: 18 }, (_, i) => ({ id: `work-${i}` }));
  const { service, advance, queries } = fixture(projects);
  for (let i = 0; i < 55; i++) {
    await service.like('work-0', { ...first, id: i.toString(16).padStart(64, '0') }, true, true);
    await service.comment('work-0', first, `감상 ${i}`, true); advance();
  }
  const before = queries(); const summaries = await service.all(first);
  assert.equal(queries() - before, 1);
  assert.equal(summaries.length, 18); assert.equal(summaries[0].likes, 55); assert.equal(summaries[0].comments, 55);
  assert.equal(summaries.slice(1).every(x => x.likes === 0 && x.comments === 0), true);
  const people = await service.likers('work-0'); assert.equal(people.people.length, 50);
  assert.equal((await service.likers('work-0', people.nextCursor)).people.length, 5);
  let cursor = '', ids = [];
  do { const page = await service.comments('work-0', first, { cursor }); ids.push(...page.comments.map(x => x.id)); cursor = page.nextCursor; } while (cursor);
  assert.equal(ids.length, 55); assert.equal(new Set(ids).size, 55);
  await assert.rejects(service.comments('work-0', first, { cursor: '../other' }), { status: 400 });
});
test('Postgres can retain imported anonymous identities and legacy browser ownership', async () => {
  const { service } = fixture();
  const visitor = 'a0000000-0000-4000-8000-000000000001';
  const author = createHmac('sha256', secret).update('community-v1:' + visitor).digest('hex');
  const id = '99970000000-' + 'd'.repeat(64);
  await query('INSERT INTO hyfl_community.likes VALUES ($1, $2, NULL, $3)', ['sample', author, '2026-11-10T00:00:00Z']);
  await query('INSERT INTO hyfl_community.comments VALUES ($1, $2, $3, $4, NULL, $5, $6)', ['sample', id, author, '이전 익명 댓글', '', '2026-11-10T00:00:00Z']);
  assert.equal((await service.likers('sample')).anonymous, 1);
  assert.equal((await service.comments('sample', first)).comments[0].own, false);
  assert.equal((await service.comments('sample', null, { legacyToken: visitor })).comments[0].own, true);
  await service.removeComment('sample', null, id, visitor);
  assert.equal((await service.comments('sample')).total, 0);
});
test('deployment database preparation is repeatable and removes only its private test rows', async () => {
  const { service } = fixture();
  await service.like('sample', first, true, true);
  await service.comment('sample', first, '기존 감상 보존', true);
  for (let i = 0; i < 2; i++) assert.deepEqual(await prepareCommunityDatabase(query, schema), { schemaReady: true, privateStorageTest: true, diagnosticRowsRemoved: true });
  assert.equal((await service.summary('sample')).likes, 1);
  assert.equal((await service.comments('sample')).comments[0].text, '기존 감상 보존');
  assert.equal((await query("SELECT count(*)::int AS count FROM hyfl_community.comments WHERE project_id LIKE 'diagnostic-%'"))[0].count, 0);
});
test('Blob import preserves original IDs, private author details and hidden comments without modifying the source', async () => {
  const id = '99970000000-' + 'd'.repeat(64);
  const records = new Map([
    [`community/likes/sample/${first.id}.json`, { profile: { ...first.profile, privateExtra: first.email }, createdAt: '2026-11-10T00:00:00Z' }],
    [`community/comments/sample/${id}.json`, { text: '원본 감상', author: first.id, profile: first.profile, authorEmail: first.email, createdAt: '2026-11-10T00:00:00Z' }],
    [`community/moderation/sample/${id}.json`, { hiddenAt: '2026-11-10T00:00:00Z', moderator: teacher.id }]
  ]);
  const original = JSON.stringify([...records]); let listings = 0;
  const source = { async list() { listings++; return [...records.keys()].reverse().map(pathname => ({ pathname })); }, async read(path) { return records.get(path); } };
  assert.deepEqual(await importBlobCommunity(query, source), { likes: 1, comments: 1, moderation: 1, orphanModeration: 0 });
  const { service } = fixture();
  assert.equal((await service.summary('sample', first)).likes, 1);
  assert.equal((await service.comments('sample')).total, 0);
  const managed = await service.comments('sample', teacher, { manage: true });
  assert.equal(managed.comments[0].id, id); assert.equal(managed.comments[0].authorEmail, first.email);
  assert.equal(managed.comments[0].text, '원본 감상'); assert.equal(managed.comments[0].hidden, true);
  assert.equal(JSON.stringify(await service.all(first)).includes(first.email), false);
  await service.moderate('sample', teacher, id, false);
  assert.deepEqual(await importBlobCommunity(query, source), { alreadyImported: true });
  assert.equal((await service.comments('sample')).total, 1);
  assert.equal(listings, 1); assert.equal(JSON.stringify([...records]), original);
});
test('unreadable legacy records stop the migration before the completion marker is written', async () => {
  const source = { async list() { return [{ pathname: `community/likes/sample/${first.id}.json` }]; }, async read() { return null; } };
  await assert.rejects(importBlobCommunity(query, source), { code: 'LEGACY_RECORD_UNREADABLE' });
  assert.equal((await query('SELECT * FROM hyfl_community.migrations')).length, 0);
});
test('the HTTP comment flow persists to Postgres, returns the public contract and enforces deletion ownership', async () => {
  process.env.ALLOWED_ORIGINS = 'https://jihyuniee.github.io';
  const { service } = fixture();
  const run = createHandler({ env: { DATABASE_URL: 'test-only' }, community: service, auth: async token => token === 'first' ? first : second });
  async function request(method, token, body, suffix = '') {
    const res = { statusCode: null, body: null, setHeader() {}, status(value) { this.statusCode = value; return this; }, json(value) { this.body = value; }, end() {} };
    await run({ method, url: '/api/ai-data/community' + suffix, body, headers: { origin: 'https://jihyuniee.github.io',
      ...(token ? { authorization: 'Bearer ' + token } : {}), ...(body ? { 'content-type': 'application/json' } : {}) } }, res);
    return res;
  }
  const posted = await request('POST', 'first', { action: 'comment', projectId: 'sample', text: '웹에서 남긴 감상', profileConsent: true });
  assert.equal(posted.statusCode, 200); assert.equal(posted.body.comments[0].own, true);
  const id = posted.body.comments[0].id;
  const visible = await request('GET', null, undefined, '?project=sample');
  assert.equal(visible.statusCode, 200); assert.equal(visible.body.comments[0].text, '웹에서 남긴 감상');
  assert.equal(visible.body.comments[0].own, false); assert.equal(JSON.stringify(visible.body).includes(first.email), false);
  assert.equal((await request('DELETE', 'second', { projectId: 'sample', commentId: id })).statusCode, 403);
  const removed = await request('DELETE', 'first', { projectId: 'sample', commentId: id });
  assert.equal(removed.statusCode, 200); assert.equal(removed.body.total, 0);
});
