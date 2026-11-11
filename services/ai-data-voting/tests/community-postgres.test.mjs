import test, { before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHmac } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { createPostgresCommunity } from '../lib/community-postgres.mjs';
import { prepareCommunityDatabase, deploymentConnections, ensureReplyReference } from '../scripts/prepare-community-db.mjs';
import { importBlobCommunity } from '../lib/community-import.mjs';
import { createHandler } from '../../../api/ai-data/community.mjs';

const db = new PGlite();
const schema = await readFile(new URL('../sql/community.sql', import.meta.url), 'utf8');
const secret = 'database-test-secret-'.repeat(3);
const first = { authenticated: true, id: 'a'.repeat(64), profile: { name: "O'Reilly 관람객", picture: '' }, email: 'private@school.example', isAdmin: false };
const second = { ...first, id: 'b'.repeat(64), profile: { name: '다른 관람객', picture: '' } };
const teacher = { ...second, id: 'c'.repeat(64), isAdmin: true };
const query = async (text, params = []) => (await db.query(text, params)).rows;
before(async () => { await db.exec(schema); await ensureReplyReference(query); });
beforeEach(async () => { await db.exec('TRUNCATE hyfl_community.moderation, hyfl_community.comments, hyfl_community.likes, hyfl_community.migrations'); });
after(async () => { await db.close(); });
function fixture(projects = [{ id: 'sample' }]) {
  let time = 1794240000000, count = 0;
  return { service: createPostgresCommunity({ query: async (...args) => { count++; return query(...args); }, projects, secret, now: () => time }),
    advance: () => time += 60000, queries: () => count };
}
test('deployment uses a direct migration URL and retains pooling for application queries', () => {
  const application = 'postgresql://test-only@ep-test-pooler.example/neondb';
  const migration = 'postgresql://test-only@ep-test.example/neondb';
  assert.deepEqual(deploymentConnections({ DATABASE_URL: application, DATABASE_URL_UNPOOLED: migration }), { migration, application });
  assert.throws(() => deploymentConnections({ DATABASE_URL: application }), { code: 'DATABASE_DIRECT_URL_REQUIRED' });
  assert.throws(() => deploymentConnections({ DATABASE_URL: application, DATABASE_URL_UNPOOLED: application }), { code: 'DATABASE_DIRECT_URL_INVALID' });
});
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
  // Keep the hidden flag even after deletion so attached replies cannot be republished.
  assert.equal((await query('SELECT * FROM hyfl_community.moderation')).length, 1);
  assert.equal((await service.comments('sample')).total, 0);
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
  for (let i = 0; i < 2; i++) assert.deepEqual(await prepareCommunityDatabase(query, schema), { schemaReady: true, privateStorageTest: true, replyStorageTest: true, diagnosticRowsRemoved: true });
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

test('replies belong to their root, retain public profiles and count alongside root comments', async () => {
  const { service } = fixture();
  const root = (await service.comment('sample', first, '원댓글', true)).comments[0];
  const page = await service.comment('sample', second, '팀의 답변', true, root.id);
  assert.equal(page.comments[0].parentId, root.id);
  assert.equal(page.comments[0].profile.name, second.profile.name);
  const list = await service.comments('sample', first);
  assert.equal(list.comments.length, 1); assert.equal(list.comments[0].replyCount, 1); assert.equal(list.total, 2);
  assert.equal((await service.summary('sample')).comments, 2);
  const replies = await service.comments('sample', first, { parentId: root.id });
  assert.equal(replies.comments[0].own, false);
  assert.equal(JSON.stringify(replies).includes(second.email), false);
  assert.equal(JSON.stringify(replies).includes(second.id), false);
});
test('reply targets reject another project, nested replies, missing parents, deletion and hiding', async () => {
  const { service, advance } = fixture([{ id: 'sample' }, { id: 'other' }]);
  const root = (await service.comment('sample', first, '원댓글', true)).comments[0];
  for (const target of ['', {}, "'; DROP TABLE comments; --"]) await assert.rejects(service.comment('sample', second, '답글', true, target), { status: 400 });
  await assert.rejects(service.comment('other', second, '다른 작품', true, root.id), { status: 404 });
  await assert.rejects(service.comment('sample', second, '없는 댓글', true, '99970000000-' + 'f'.repeat(64)), { status: 404 });
  const reply = (await service.comment('sample', second, '답글', true, root.id)).comments[0]; advance();
  await assert.rejects(service.comment('sample', second, '답글의 답글', true, reply.id), { status: 404 });
  await service.moderate('sample', teacher, root.id, true);
  await assert.rejects(service.comment('sample', second, '숨겨진 원댓글', true, root.id), { status: 404 });
  await assert.rejects(service.comments('sample', null, { parentId: root.id }), { status: 404 });
  await service.moderate('sample', teacher, root.id, false); await service.removeComment('sample', first, root.id);
  await assert.rejects(service.comment('sample', second, '삭제된 원댓글', true, root.id), { status: 404 });
});
test('a root deletion redacts private content while preserving other people’s replies', async () => {
  const { service } = fixture();
  const root = (await service.comment('sample', first, '원문은 삭제되어야 함', true)).comments[0];
  const reply = (await service.comment('sample', second, '남겨 둘 답글', true, root.id)).comments[0];
  await assert.rejects(service.removeComment('sample', first, reply.id), { status: 403 });
  await service.removeComment('sample', first, root.id);
  const page = await service.comments('sample', first);
  assert.equal(page.comments[0].deleted, true); assert.equal(page.comments[0].own, false); assert.equal(page.comments[0].profile, null);
  assert.equal(page.comments[0].text, '삭제된 댓글입니다.'); assert.equal(page.total, 1);
  const [stored] = await query('SELECT text, profile, author_email FROM hyfl_community.comments WHERE comment_id = $1', [root.id]);
  assert.deepEqual(stored, { text: '삭제된 댓글입니다.', profile: null, author_email: '' });
  assert.equal((await service.comments('sample', null, { parentId: root.id })).comments[0].text, '남겨 둘 답글');
  await service.removeComment('sample', second, reply.id);
  assert.equal((await service.comments('sample')).comments.length, 0);
  assert.equal((await service.summary('sample')).comments, 0);
});
test('root moderation hides the whole thread and cannot be bypassed by deleting the root', async () => {
  const { service } = fixture();
  const root = (await service.comment('sample', first, '원댓글', true)).comments[0];
  const reply = (await service.comment('sample', second, '답글', true, root.id)).comments[0];
  await service.moderate('sample', teacher, reply.id, true);
  assert.equal((await service.summary('sample')).comments, 1);
  assert.equal((await service.comments('sample')).comments[0].replyCount, 0);
  await service.moderate('sample', teacher, reply.id, false);
  await service.moderate('sample', teacher, root.id, true); await service.removeComment('sample', first, root.id);
  assert.equal((await service.comments('sample')).total, 0); assert.equal((await service.summary('sample')).comments, 0);
  await assert.rejects(service.comments('sample', null, { parentId: root.id }), { status: 404 });
  const managed = await service.comments('sample', teacher, { parentId: root.id, manage: true });
  assert.equal(managed.comments[0].text, '답글');
  await service.moderate('sample', teacher, root.id, false);
  assert.equal((await service.comments('sample')).total, 1);
});
test('reply pagination has no duplicates and the per-minute limit is shared with root comments', async () => {
  const { service, advance } = fixture();
  const root = (await service.comment('sample', first, '원댓글', true)).comments[0];
  await assert.rejects(service.comment('sample', first, '같은 분 답글', true, root.id), { status: 429 });
  advance();
  for (let i = 0; i < 45; i++) { await service.comment('sample', second, `답글 ${i}`, true, root.id); advance(); }
  let cursor = '', ids = [];
  do { const page = await service.comments('sample', null, { parentId: root.id, cursor }); ids.push(...page.comments.map(item => item.id)); cursor = page.nextCursor; } while (cursor);
  assert.equal(ids.length, 45); assert.equal(new Set(ids).size, 45);
  assert.equal((await service.comments('sample')).comments.length, 1);
  assert.equal((await service.comments('sample')).total, 46);
  await service.comment('sample', second, '일반 댓글', true);
  await assert.rejects(service.comment('sample', second, '제한 우회 답글', true, root.id), { status: 429 });
});
test('the HTTP reply flow binds parentId, preserves ownership and redacts a deleted root', async () => {
  process.env.ALLOWED_ORIGINS = 'https://jihyuniee.github.io';
  const { service } = fixture();
  const run = createHandler({ env: { DATABASE_URL: 'test-only' }, community: service, auth: async token => token === 'first' ? first : second });
  async function request(method, actor, body, suffix = '') {
    const res = { statusCode: null, body: null, setHeader() {}, status(value) { this.statusCode = value; return this; }, json(value) { this.body = value; }, end() {} };
    await run({ method, url: '/api/ai-data/community' + suffix, body, headers: { origin: 'https://jihyuniee.github.io', ...(actor ? { authorization: 'Bearer ' + actor } : {}), 'content-type': 'application/json' } }, res);
    return res;
  }
  const parent = (await request('POST', 'first', { action: 'comment', projectId: 'sample', text: '원댓글', profileConsent: true })).body.comments[0].id;
  const body = { action: 'comment', projectId: 'sample', text: 'HTTP 답글', profileConsent: true, parentId: parent };
  assert.equal((await request('POST', null, body)).statusCode, 401);
  assert.equal((await request('POST', 'second', { ...body, profileConsent: false })).statusCode, 400);
  const saved = await request('POST', 'second', body); assert.equal(saved.statusCode, 200); assert.equal(saved.body.comments[0].parentId, parent);
  const read = await request('GET', null, null, '?project=sample&parent=' + parent);
  assert.equal(read.body.comments[0].text, 'HTTP 답글'); assert.equal(read.body.comments[0].own, false);
  await request('DELETE', 'first', { projectId: 'sample', commentId: parent });
  assert.equal((await request('GET', null, null, '?project=sample')).body.comments[0].deleted, true);
  assert.equal((await request('GET', null, null, '?session=true')).body.features.replies, true);
});

test('adding reply columns twice preserves an existing comment from the previous schema', async () => {
  const previous = new PGlite();
  try {
    await previous.exec(schema.split('ALTER TABLE hyfl_community.comments')[0]);
    const id = '99970000000-' + 'd'.repeat(64);
    await previous.query('INSERT INTO hyfl_community.comments (project_id, comment_id, author_id, text, profile, author_email, created_at) VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7)', ['sample', id, first.id, '기존 댓글 보존', JSON.stringify(first.profile), first.email, '2026-11-11T06:00:00Z']);
    await previous.exec(schema); await previous.exec(schema);
    const {rows} = await previous.query('SELECT comment_id, text, profile, author_email, parent_id, deleted_at FROM hyfl_community.comments');
    assert.equal(rows.length, 1); assert.equal(rows[0].comment_id, id); assert.equal(rows[0].text, '기존 댓글 보존');
    assert.equal(rows[0].profile.name, first.profile.name); assert.equal(rows[0].author_email, first.email);
    assert.equal(rows[0].parent_id, null); assert.equal(rows[0].deleted_at, null);
  } finally { await previous.close(); }
});
test('a concurrent root deletion and reply cannot leave a reply without its root', async () => {
  const { service } = fixture();
  const parent = (await service.comment('sample', first, '원댓글', true)).comments[0].id;
  const result = await Promise.allSettled([service.comment('sample', second, '동시 답글', true, parent), service.removeComment('sample', first, parent)]);
  assert.equal(result[1].status, 'fulfilled');
  if (result[0].status === 'rejected') assert.equal(result[0].reason.status, 404);
  const [row] = await query('SELECT count(*)::int AS orphaned FROM hyfl_community.comments r LEFT JOIN hyfl_community.comments p ON p.project_id=r.project_id AND p.comment_id=r.parent_id WHERE r.parent_id IS NOT NULL AND p.comment_id IS NULL');
  assert.equal(row.orphaned, 0);
});

test('the reply foreign key rejects missing/cross-project parents and blocks physical deletion without changing rows', async () => {
  const { service } = fixture();
  const parent = (await service.comment('sample', first, '보존할 원댓글', true)).comments[0].id;
  await service.comment('sample', second, '보존할 답글', true, parent);
  await ensureReplyReference(query); await ensureReplyReference(query);
  await assert.rejects(query('DELETE FROM hyfl_community.comments WHERE project_id=$1 AND comment_id=$2', ['sample', parent]), { code: '23503' });
  for (const projectId of ['other-project', 'sample']) {
    await assert.rejects(query(`INSERT INTO hyfl_community.comments
      (project_id,comment_id,author_id,text,created_at,parent_id) VALUES ($1,$2,$3,$4,$5,$6)`,
    [projectId, '99970000000-' + 'e'.repeat(64), first.id, '잘못된 연결', new Date().toISOString(), projectId === 'sample' ? '99970000000-' + 'f'.repeat(64) : parent]), { code: '23503' });
  }
  assert.equal((await service.summary('sample')).comments, 2);
  assert.equal((await service.comments('sample')).comments[0].text, '보존할 원댓글');
});

test('the reply write switch keeps existing replies readable and retains root comments, likes, deletion and teacher hiding', async () => {
  process.env.ALLOWED_ORIGINS = 'https://jihyuniee.github.io';
  const { service } = fixture();
  const parent = (await service.comment('sample', first, '기존 원댓글', true)).comments[0].id;
  const reply = (await service.comment('sample', second, '기존 답글', true, parent)).comments[0].id;
  const run = createHandler({ env: { DATABASE_URL: 'test-only', COMMUNITY_REPLIES_ENABLED: 'false' }, community: service, auth: async token => token === 'second' ? second : teacher });
  async function request(method, body, suffix = '', token = 'teacher') {
    const res = { statusCode: null, body: null, setHeader() {}, status(value) { this.statusCode = value; return this; }, json(value) { this.body = value; }, end() {} };
    await run({ method, url: '/api/ai-data/community' + suffix, body, headers: { origin: 'https://jihyuniee.github.io', authorization: 'Bearer ' + token, 'content-type': 'application/json' } }, res);
    return res;
  }
  const session = await request('GET', null, '?session=true');
  assert.equal(session.body.features.replies, true); assert.equal(session.body.features.replyWriting, false);
  assert.equal((await request('GET', null, '?project=sample&parent=' + parent)).body.comments[0].text, '기존 답글');
  assert.equal((await request('POST', { action: 'comment', projectId: 'sample', parentId: parent, text: '중지할 새 답글', profileConsent: true })).statusCode, 503);
  assert.equal((await service.summary('sample')).comments, 2);
  assert.equal((await request('POST', { action: 'comment', projectId: 'sample', text: '허용할 원댓글', profileConsent: true })).statusCode, 200);
  assert.equal((await request('POST', { action: 'like', projectId: 'sample', liked: true, profileConsent: true })).body.likes, 1);
  assert.equal((await request('POST', { action: 'moderate', projectId: 'sample', commentId: parent, hidden: true })).statusCode, 200);
  assert.equal((await request('GET', null, '?project=sample&parent=' + parent)).statusCode, 404);
  assert.equal((await request('DELETE', { projectId: 'sample', commentId: reply }, '', 'second')).statusCode, 200);
});

test('thirty synthetic student accounts retain simultaneous likes, comments and replies without duplicates', async () => {
  const { service, advance } = fixture();
  const parent = (await service.comment('sample', first, '발표 원댓글', true)).comments[0].id;
  const students = Array.from({ length: 30 }, (_, i) => ({ ...second, id: (i + 1000).toString(16).padStart(64, '0'), profile: { name: `합성 학생 ${i}`, picture: '' } }));
  await Promise.all(students.map(async student => { await service.like('sample', student, true, true); await service.comment('sample', student, '발표 감상', true); }));
  advance(); await Promise.all(students.map(student => service.comment('sample', student, '발표 답글', true, parent)));
  const summary = await service.summary('sample');
  assert.equal(summary.likes, 30); assert.equal(summary.comments, 61);
  const replies = await service.comments('sample', null, { parentId: parent });
  const next = await service.comments('sample', null, { parentId: parent, cursor: replies.nextCursor });
  assert.equal(replies.total, 30); assert.equal(new Set([...replies.comments, ...next.comments].map(row => row.id)).size, 30);
  assert.equal(JSON.stringify(replies).includes(second.email), false);
});
