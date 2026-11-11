import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';

const source = new URL('../../../src/scripts/data-community.ts', import.meta.url);
const bundled = await build({ entryPoints: [fileURLToPath(source)], bundle: true, write: false, format: 'iife', globalName: 'Community',
  define: { 'import.meta.env.BASE_URL': '"/hyfl-ai-lab/"' } });
const reaction = (await readFile(new URL('../../../src/components/DataProjectReactions.astro', import.meta.url), 'utf8'))
  .replace(/^---[\s\S]*?---\s*/, '').split('<style')[0]
  .replace(/\{`([^`]+)`\}/g, (_, value) => JSON.stringify(value.replaceAll('${projectId}', 'sample').replaceAll('${title}', '시험 작품')))
  .replaceAll('={projectId}', '="sample"').replaceAll('={title}', '="시험 작품"').replaceAll('{title}', '시험 작품');
const account = (await readFile(new URL('../../../src/components/DataCommunitySession.astro', import.meta.url), 'utf8')).split('<script>')[0];
const id = value => '99970000000-' + value.repeat(64);
const root = { id: id('a'), text: '원댓글', createdAt: '2026-11-11T06:00:00Z', profile: { name: '원댓글 작성자', picture: '' }, own: false, parentId: null, replyCount: 1, replyVersion: 'version-1' };
const oldReply = { ...root, id: id('b'), text: '기존 답글', parentId: root.id, replyCount: 0 };
const newReply = { ...oldReply, id: id('c'), text: '새 답글', own: true };
const flush = async () => { for (let i = 0; i < 12; i++) await new Promise(resolve => setImmediate(resolve)); };
const response = (body, status = 200) => ({ ok: status < 400, status, json: async () => structuredClone(body) });

async function fixture(t, { failConfig = false } = {}) {
  const dom = new JSDOM('<!doctype html><html><body>' + account + reaction + '</body></html>', {
    url: 'https://school.example/hyfl-ai-lab/exhibition/ai-data/sample/', runScripts: 'outside-only', pretendToBeVisual: true
  });
  t.after(() => dom.window.close());
  const w = dom.window, d = w.document, timers = new Map(); let timerId = 0;
  w.setTimeout = (fn, ms) => { timers.set(++timerId, { fn, ms }); return timerId; };
  w.clearTimeout = id => timers.delete(id); w.AbortSignal = AbortSignal;
  w.HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  w.HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); this.dispatchEvent(new w.Event('close')); };
  const state = { page: { comments: [structuredClone(root)], total: 2, nextCursor: null }, replies: { comments: [oldReply], total: 1, nextCursor: null },
    likes: 2, replyWriting: true, apiCalls: 0, writes: [], replyHandler: null, summaryHandler: null, summaryStatus: 200, isAdmin: false, fail: false, failConfig };
  w.fetch = async (input, options = {}) => {
    const url = new URL(input, w.location.href);
    if (url.pathname.endsWith('exhibition-community.json')) {
      if (state.failConfig) throw new Error('configuration offline');
      return response({ apiBaseUrl: 'https://api.school.example' });
    }
    state.apiCalls++;
    if (state.fail) throw new Error('network unavailable');
    if (options.method === 'POST') { state.writes.push(JSON.parse(options.body)); return response(state.replies); }
    if (url.searchParams.has('parent')) return state.replyHandler ? state.replyHandler() : response(state.replies);
    if (url.searchParams.has('project')) {
      const page = structuredClone(state.page);
      if (url.searchParams.get('manage') !== 'true') page.comments.forEach(comment => delete comment.authorEmail);
      return response(page);
    }
    const body = { auth: { ready: true, clientId: 'synthetic-client', schoolDomains: [] },
      features: { replies: true, replyWriting: state.replyWriting },
      viewer: options.headers?.Authorization ? { name: '시험 계정', picture: '', isAdmin: state.isAdmin } : null,
      projects: [{ projectId: 'sample', likes: state.likes, comments: state.page.total, liked: false, people: [] }] };
    if (state.summaryHandler) return state.summaryHandler(body);
    const status = state.summaryStatus; state.summaryStatus = 200;
    return response(status === 401 ? { error: '로그인이 만료되었습니다.' } : body, status);
  };
  w.google = { accounts: { id: { initialize(options) { w.loginCallback = options.callback; }, renderButton() {}, disableAutoSelect() {} } } };
  w.eval(bundled.outputFiles[0].text + '\nwindow.CommunityController = Community;'); w.CommunityController.initCommunity(); await flush();
  const click = selector => d.querySelector(selector).click();
  async function login() {
    click('[data-community-session] [data-community-login]');
    const consent = d.querySelector('[data-community-consent]'); consent.checked = true; consent.dispatchEvent(new w.Event('change')); await flush();
    await w.loginCallback({ credential: 'synthetic-token' }); await flush();
  }
  async function open() { click('[data-community-open]'); await flush(); }
  async function tick() {
    const first = [...timers].sort((a, b) => a[1].ms - b[1].ms)[0];
    assert.ok(first, 'one live-update timer should be scheduled'); timers.delete(first[0]); first[1].fn(); await flush();
  }
  return { w, d, state, timers, click, login, open, tick };
}

test('live reactions update the actual controller without clearing a draft or reply target', async t => {
  const f = await fixture(t); await f.login(); await f.open();
  f.click('.feedback-comment-actions button:not([aria-expanded])');
  f.d.querySelector('textarea').value = '발표 중 작성하던 답글';
  f.state.likes = 7; f.state.page.comments[0].replyCount = 2; f.state.page.comments[0].replyVersion = 'version-2'; f.state.page.total = 3;
  await f.tick();
  assert.equal(f.d.querySelector('[data-community-likes]').textContent, '7');
  assert.equal(f.d.querySelector('[data-community-count]').textContent, '3');
  assert.equal(f.d.querySelector('textarea').value, '발표 중 작성하던 답글');
  assert.match(f.d.querySelector('[data-community-compose-label]').textContent, /원댓글 작성자님에게/);
  assert.match(f.d.querySelector('[aria-expanded]').textContent, /2개/);
});

test('a delayed reply read cannot overwrite a successful reply write', async t => {
  const f = await fixture(t); await f.login(); await f.open();
  let release; f.state.replyHandler = () => new Promise(resolve => { release = () => resolve(response({ comments: [oldReply], total: 1, nextCursor: null })); });
  f.click('[aria-expanded]'); await flush(); assert.ok(release);
  f.click('.feedback-comment-actions button:not([aria-expanded])');
  f.state.replies = { comments: [newReply, oldReply], total: 2, nextCursor: null };
  f.d.querySelector('textarea').value = '새 답글'; f.d.querySelector('form').dispatchEvent(new f.w.Event('submit', { cancelable: true })); await flush();
  assert.match(f.d.querySelector('.feedback-replies').textContent, /새 답글/);
  release(); await flush();
  assert.match(f.d.querySelector('.feedback-replies').textContent, /새 답글/);
  assert.equal(f.state.writes[0].parentId, root.id);
});

test('live updates retain expanded replies and refresh same-count replacements', async t => {
  const f = await fixture(t); await f.open(); f.click('[aria-expanded]'); await flush();
  f.state.replies = { comments: [newReply], total: 1, nextCursor: null };
  f.state.page.comments[0].replyVersion = 'different-reply-with-same-count';
  await f.tick();
  assert.equal(f.d.querySelector('.feedback-replies').hidden, false);
  assert.match(f.d.querySelector('.feedback-replies').textContent, /새 답글/);
  assert.doesNotMatch(f.d.querySelector('.feedback-replies').textContent, /기존 답글/);
});

test('reading older comments defers replacement until the new-reactions button is selected', async t => {
  const f = await fixture(t); await f.open();
  f.d.querySelector('.feedback-body').scrollTop = 150;
  f.state.page.comments.unshift({ ...root, id: id('d'), text: '새 원댓글' }); f.state.page.total++;
  await f.tick();
  assert.doesNotMatch(f.d.querySelector('[data-community-comments]').textContent, /새 원댓글/);
  assert.equal(f.d.querySelector('[data-community-live-refresh]').hidden, false);
  f.click('[data-community-live-refresh]'); await flush();
  assert.match(f.d.querySelector('[data-community-comments]').textContent, /새 원댓글/);
  assert.equal(f.d.querySelector('.feedback-body').scrollTop, 0);
});

test('hidden and offline pages stop polling, resume once, and retry failures with backoff', async t => {
  const f = await fixture(t); await f.open();
  Object.defineProperty(f.d, 'hidden', { configurable: true, value: true }); f.d.dispatchEvent(new f.w.Event('visibilitychange'));
  assert.equal(f.timers.size, 0);
  Object.defineProperty(f.d, 'hidden', { configurable: true, value: false }); f.d.dispatchEvent(new f.w.Event('visibilitychange'));
  await f.tick(); assert.equal(f.timers.size, 1);
  Object.defineProperty(f.w.navigator, 'onLine', { configurable: true, value: false }); f.w.dispatchEvent(new f.w.Event('offline'));
  assert.equal(f.timers.size, 0);
  Object.defineProperty(f.w.navigator, 'onLine', { configurable: true, value: true }); f.w.dispatchEvent(new f.w.Event('online'));
  f.state.fail = true; await f.tick();
  assert.equal(f.timers.size, 1); assert.ok([...f.timers.values()][0].ms >= 10000);
  f.state.fail = false; await f.tick(); assert.ok([...f.timers.values()][0].ms < 6001);
});

test('disabling new replies preserves the draft, visible replies and ordinary comment editor', async t => {
  const f = await fixture(t); await f.login(); await f.open();
  f.click('.feedback-comment-actions button:not([aria-expanded])'); f.d.querySelector('textarea').value = '보존할 입력';
  f.state.replyWriting = false; await f.tick();
  assert.equal(f.d.querySelector('button[type=submit]').disabled, true);
  assert.equal(f.d.querySelector('textarea').value, '보존할 입력');
  assert.ok(f.d.querySelector('[aria-expanded]'));
  assert.equal(f.d.querySelector('.feedback-comment-actions button:not([aria-expanded])'), null);
  f.click('[data-community-reply-cancel]');
  assert.equal(f.d.querySelector('button[type=submit]').disabled, false);
});

test('an initial configuration failure recovers automatically when the connection returns', async t => {
  const f = await fixture(t, { failConfig: true });
  assert.equal(f.d.querySelector('[data-community-like]').disabled, true);
  f.state.failConfig = false; f.w.dispatchEvent(new f.w.Event('online')); await f.tick();
  assert.equal(f.d.querySelector('[data-community-like]').disabled, false);
  assert.equal(f.d.querySelector('[data-community-likes]').textContent, '2');
});

test('session expiry clears teacher-only details while preserving a reply draft through reauthentication', async t => {
  const f = await fixture(t); f.state.isAdmin = true; f.state.page.comments[0].authorEmail = 'private@school.example';
  await f.login(); await f.open();
  const manage = f.d.querySelector('[data-community-manage]'); manage.checked = true; manage.dispatchEvent(new f.w.Event('change')); await flush();
  assert.match(f.d.querySelector('[data-community-comments]').textContent, /private@school.example/);
  f.click('.feedback-comment-actions button:not([aria-expanded])'); f.d.querySelector('textarea').value = '재로그인 후 보낼 답글';
  f.state.summaryStatus = 401; await f.tick();
  assert.doesNotMatch(f.d.querySelector('[data-community-comments]').textContent, /private@school.example/);
  assert.equal(f.d.querySelector('textarea').value, '재로그인 후 보낼 답글');
  assert.match(f.d.querySelector('[data-community-compose-label]').textContent, /원댓글 작성자님에게/);
  await f.login();
  assert.match(f.d.querySelector('[data-community-compose-label]').textContent, /원댓글 작성자님에게/);
});

test('a second wake event cannot overlap an in-flight poll or create duplicate timers', async t => {
  const f = await fixture(t); await f.open();
  let release;
  f.state.summaryHandler = body => new Promise(resolve => { release = () => resolve(response(body)); });
  await f.tick(); const calls = f.state.apiCalls; assert.ok(release);
  f.w.dispatchEvent(new f.w.Event('online')); await f.tick();
  assert.equal(f.state.apiCalls, calls);
  f.state.summaryHandler = null; release(); await flush();
  assert.equal(f.timers.size, 1);
});
