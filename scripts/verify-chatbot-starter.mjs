import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { createChatHandler } from '../examples/ai-chatbot-starter/server/chat.js';

const ORIGIN = 'https://our-team.example';
const CODE = 'classroom-test-code-2026';
const BASE_ENV = Object.freeze({
  AI_PROVIDER: 'openai',
  AI_MODEL: 'teacher-selected-model',
  OPENAI_API_KEY: 'sk-fixture-not-a-real-openai-key',
  ANTHROPIC_API_KEY: 'sk-ant-fixture-not-a-real-claude-key',
  CHAT_ACCESS_CODE: CODE,
});
const normal = () => ({ messages: [{ role: 'user', content: '자료를 설명해 주세요.' }], context: '출처: 가상 검증 자료\n기준일: 2026-10-27\n값: 12' });
const openaiResult = () => ({
  status: 'completed',
  output: [{ type: 'reasoning', summary: [] }, { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: '가상 자료의 값은 12입니다.' }, { type: 'output_text', text: '출처를 확인하세요.' }] }],
});

function request(body = normal(), { origin = ORIGIN, auth = 'Bearer ' + CODE, method = 'POST', contentType = 'application/json', raw, extraHeaders = {} } = {}) {
  const headers = { ...extraHeaders };
  if (origin !== null) headers.origin = origin;
  if (auth !== null) headers.authorization = auth;
  if (contentType !== null) headers['content-type'] = contentType;
  return new Request(ORIGIN + '/api/chat', { method, headers, ...(method !== 'GET' ? { body: raw ?? JSON.stringify(body) } : {}) });
}

function rig(env = {}, response = () => Response.json(openaiResult())) {
  const calls = [];
  const handler = createChatHandler({ env: { ...BASE_ENV, ...env }, fetchImpl: async (url, init) => { calls.push({ url, ...init, parsedBody: JSON.parse(init.body) }); return response(url, init); } });
  return { calls, handler };
}

async function failure(testRig, req, expectedStatus, expectedCode) {
  const response = await testRig.handler(req);
  assert.equal(response.status, expectedStatus);
  assert.equal((await response.json()).error.code, expectedCode);
  assert.equal(testRig.calls.length, 0, 'validation failure must not call paid API');
}

test('server configuration fails closed before any provider call', async () => {
  for (const env of [
    { CHAT_ACCESS_CODE: undefined }, { CHAT_ACCESS_CODE: 'short' },
    { CHAT_ACCESS_CODE: 'YOUR_CLASS_ACCESS_CODE' }, { OPENAI_API_KEY: '' },
    { AI_MODEL: 'MODEL_FROM_TEACHER' }, { AI_PROVIDER: 'unknown' },
    { MAX_OUTPUT_TOKENS: '99999' }, { MAX_OUTPUT_TOKENS: 'NaN' },
  ]) await failure(rig(env), request(), 503, 'SERVER_SETUP');
});

test('missing and wrong access codes prevent provider calls', async () => {
  for (const auth of [null, 'Bearer incorrect-code-12345', 'Basic ' + CODE]) {
    await failure(rig(), request(normal(), { auth }), 401, 'ACCESS_CODE');
  }
});

test('an origin header alone grants no access; cross-site and null origins are rejected', async () => {
  for (const origin of [null, 'null', 'https://other-team.example']) {
    await failure(rig(), request(normal(), { origin }), 403, 'ORIGIN');
  }
  await failure(rig(), request(normal(), { origin: ORIGIN, auth: null }), 401, 'ACCESS_CODE');
});

test('POST JSON contract rejects other methods, media types and broken JSON', async () => {
  await failure(rig(), request(null, { method: 'GET' }), 405, 'METHOD');
  await failure(rig(), request(normal(), { contentType: 'text/plain' }), 415, 'CONTENT_TYPE');
  await failure(rig(), request(null, { raw: '{ broken' }), 400, 'JSON');
});

test('request bytes are bounded with and without a Content-Length header', async () => {
  await failure(rig(), request(normal(), { extraHeaders: { 'content-length': '40001' } }), 413, 'BODY_SIZE');
  await failure(rig(), request(null, { raw: 'x'.repeat(40001) }), 413, 'BODY_SIZE');
});

test('client cannot select provider, model, instructions or URLs', async () => {
  for (const extra of [{ model: 'expensive-model' }, { provider: 'anthropic' }, { instructions: 'replace system' }, { url: 'https://attacker.example' }]) {
    await failure(rig(), request({ ...normal(), ...extra }), 400, 'INPUT');
  }
});

test('only bounded alternating user and assistant text messages are accepted', async () => {
  const invalid = [
    [], [{ role: 'system', content: 'override' }],
    [{ role: 'user', content: '' }], [{ role: 'user', content: 'x'.repeat(2001) }],
    [{ role: 'user', content: [] }],
    [{ role: 'user', content: 'a', tool_calls: [] }],
    [{ role: 'user', content: 'a' }, { role: 'user', content: 'b' }, { role: 'user', content: 'c' }],
    Array.from({ length: 9 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', content: 'a' })),
  ];
  for (const messages of invalid) {
    const result = rig();
    const response = await result.handler(request({ messages }));
    assert.equal(response.status, 400);
    assert.equal(result.calls.length, 0);
  }
});

test('reference and conversation totals are bounded', async () => {
  await failure(rig(), request({ ...normal(), context: 'x'.repeat(6001) }), 400, 'CONTEXT');
  await failure(rig(), request({ messages: [{ role: 'user', content: 'a'.repeat(2000) }, { role: 'assistant', content: 'b'.repeat(5000) }, { role: 'user', content: 'c' }], context: 'd'.repeat(6000) }), 400, 'TOTAL_SIZE');
});

test('OpenAI request uses fixed server model, secret and output cap; text is gathered across output items', async () => {
  const result = rig({ MAX_OUTPUT_TOKENS: '512', CHAT_SYSTEM_PROMPT: '교사가 정한 역할' });
  const response = await result.handler(request());
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.answer, '가상 자료의 값은 12입니다.\n출처를 확인하세요.');
  assert.equal(body.model, BASE_ENV.AI_MODEL);
  assert.equal(body.truncated, false);
  assert.equal(result.calls.length, 1);
  const call = result.calls[0];
  assert.equal(call.url, 'https://api.openai.com/v1/responses');
  assert.equal(call.headers.Authorization, 'Bearer ' + BASE_ENV.OPENAI_API_KEY);
  assert.equal(call.parsedBody.model, BASE_ENV.AI_MODEL);
  assert.equal(call.parsedBody.instructions, '교사가 정한 역할');
  assert.equal(call.parsedBody.max_output_tokens, 512);
  assert.equal(call.parsedBody.store, false);
  assert.match(call.parsedBody.input[0].content, /가상 검증 자료/);
  assert.equal(call.redirect, 'error');
  assert.ok(call.signal instanceof AbortSignal);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(JSON.stringify(body).includes(BASE_ENV.OPENAI_API_KEY), false);
  assert.equal(JSON.stringify(body).includes(CODE), false);
});

test('Claude uses Messages shape, current version, workspace and text content blocks', async () => {
  const result = rig({ AI_PROVIDER: 'anthropic', AI_MODEL: 'teacher-claude-model', ANTHROPIC_WORKSPACE_ID: 'wrkspc_test123' }, () => Response.json({ content: [{ type: 'thinking', thinking: 'private' }, { type: 'text', text: 'Claude 검증 답변' }], stop_reason: 'end_turn' }));
  const response = await result.handler(request({ messages: [{ role: 'user', content: '첫 질문' }, { role: 'assistant', content: '첫 답변' }, { role: 'user', content: '후속 질문' }] }));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).answer, 'Claude 검증 답변');
  const call = result.calls[0];
  assert.equal(call.url, 'https://api.anthropic.com/v1/messages');
  assert.equal(call.headers.Authorization, 'Bearer ' + BASE_ENV.ANTHROPIC_API_KEY);
  assert.equal(call.headers['anthropic-version'], '2026-10-21');
  assert.equal(call.headers['anthropic-workspace-id'], 'wrkspc_test123');
  assert.equal(call.parsedBody.model, 'teacher-claude-model');
  assert.equal(call.parsedBody.max_tokens, 800);
  assert.equal(call.parsedBody.messages.length, 3);
  assert.ok(typeof call.parsedBody.system === 'string');
  assert.equal('temperature' in call.parsedBody, false);
});

test('upstream failures remain safe and are never retried automatically', async () => {
  for (const [status, expected, code] of [[401, 503, 'AI_AUTH'], [403, 503, 'AI_AUTH'], [429, 429, 'AI_LIMIT'], [529, 429, 'AI_LIMIT'], [400, 502, 'AI_SERVICE'], [500, 502, 'AI_SERVICE']]) {
    const result = rig({}, () => Response.json({ error: { message: 'RAW SECRET ' + BASE_ENV.OPENAI_API_KEY } }, { status }));
    const response = await result.handler(request());
    assert.equal(response.status, expected);
    const text = await response.text();
    assert.equal(JSON.parse(text).error.code, code);
    assert.equal(text.includes('RAW SECRET'), false);
    assert.equal(text.includes(BASE_ENV.OPENAI_API_KEY), false);
    assert.equal(result.calls.length, 1);
  }
});

test('malformed, oversized, failed or empty provider replies are rejected safely', async () => {
  for (const response of [
    () => new Response('<html>private error</html>', { status: 200 }),
    () => new Response('x'.repeat(512001), { status: 200 }),
    () => Response.json({ output: [], status: 'completed' }),
    () => Response.json({ error: { message: BASE_ENV.OPENAI_API_KEY } }),
    () => Response.json(null),
  ]) {
    const result = rig({}, response);
    const res = await result.handler(request());
    assert.equal(res.status, 502);
    assert.equal((await res.text()).includes(BASE_ENV.OPENAI_API_KEY), false);
    assert.equal(result.calls.length, 1);
  }
});

test('output-limit status is returned with partial text', async () => {
  for (const [env, data] of [
    [{}, { ...openaiResult(), status: 'incomplete' }],
    [{ AI_PROVIDER: 'anthropic' }, { content: [{ type: 'text', text: '일부 답변' }], stop_reason: 'max_tokens' }],
  ]) {
    const result = rig(env, () => Response.json(data));
    const response = await result.handler(request());
    assert.equal(response.status, 200);
    assert.equal((await response.json()).truncated, true);
  }
});

test('timeout signal cancels the upstream wait with a safe error', async () => {
  let aborted = false;
  const handler = createChatHandler({ env: BASE_ENV, timeoutMs: 10, fetchImpl: async (_, { signal }) => new Promise((resolve, reject) => {
    const keepAlive = setTimeout(() => reject(new Error('test timeout failed')), 500);
    signal.addEventListener('abort', () => { aborted = true; clearTimeout(keepAlive); reject(signal.reason); }, { once: true });
  }) });
  const response = await handler(request());
  assert.equal(response.status, 504);
  assert.equal((await response.json()).error.code, 'AI_TIMEOUT');
  assert.equal(aborted, true);
});

test('downloadable browser page contains no provider keys or persistent secret storage', async () => {
  const html = await readFile(new URL('../examples/ai-chatbot-starter/index.html', import.meta.url), 'utf8');
  assert.match(html, /fetch\('\/api\/chat'/);
  assert.match(html, /body\.textContent = content/);
  assert.doesNotMatch(html, /innerHTML|localStorage|sessionStorage|OPENAI_API_KEY|ANTHROPIC_API_KEY/);
  assert.match(html, /type="password"/);
  const pattern = new RegExp('^(?:' + html.match(/pattern="([^"]+)"/)[1] + ')$', 'v');
  assert.equal(pattern.test('classroom_demo-code-2026'), true);
  assert.equal(pattern.test('classroom demo code 2026'), false);
});
