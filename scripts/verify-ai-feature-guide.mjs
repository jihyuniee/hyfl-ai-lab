import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { requestApiPrompt, addChatbotPrompt, chatbotDebugPrompt } from '../src/content/prompts/ai-chatbot.mjs';
const guide = await readFile(new URL('../src/content/docs/data/ai-chatbot.mdx', import.meta.url), 'utf8');
const config = await readFile(new URL('../astro.config.mjs', import.meta.url), 'utf8');
test('guide keeps optional scope and distinguishes infrastructure readiness', () => {
  for (const text of ['선택 확장', '공용 서버의 연결 주소', '가상 응답', '화면만 검증, AI 응답 미검증']) assert.ok(guide.includes(text));
});
test('guide connects existing worksheet and all four competencies', () => {
  for (const text of ['STEP 1', 'STEP 2', 'STEP 3', 'STEP 4', 'STEP 5', '문제해결력', 'AI 리터러시', '데이터 리터러시', '공동체 역량']) assert.ok(guide.includes(text));
});
test('safety separates server quotas, auth, public inputs and browser limitations', () => {
  for (const text of ['개인정보', '서버에서 실제 제한', 'CORS', '누적 사용량 제한', '원자료']) assert.ok(guide.includes(text));
  assert.ok(!guide.includes('600')); assert.ok(!guide.includes('4월'));
});
test('all prompts are displayed and ask for evidence without secret values', () => {
  for (const name of ['requestApiPrompt', 'addChatbotPrompt', 'chatbotDebugPrompt']) assert.ok(guide.includes(`content={${name}}`));
  assert.ok(requestApiPrompt.includes('사용 한도'));
  assert.ok(addChatbotPrompt.includes('추측하지 마'));
  assert.ok(chatbotDebugPrompt.includes('미검증'));
});
test('guide remains below chapter eight project help in navigation', () => {
  assert.ok(config.indexOf("label: '8. DATA TO WEB APP'") < config.indexOf("link: '/data/ai-chatbot/'"));
  assert.ok(config.indexOf("label: '프로젝트 도움말") < config.indexOf("link: '/data/ai-chatbot/'"));
});
