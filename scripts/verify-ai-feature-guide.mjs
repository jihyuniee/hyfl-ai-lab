import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { addChatbotPrompt, chatbotDebugPrompt } from '../src/content/prompts/ai-chatbot.mjs';
const read = path => readFile(new URL('../' + path, import.meta.url), 'utf8');
const guide = await read('src/content/docs/data/ai-chatbot.mdx');
const project = await read('src/content/docs/data-project.mdx');
const home = await read('src/content/docs/index.mdx');
const config = await read('astro.config.mjs');
const teacher = await read('internal/teacher/project-guidance.md');
test('student guide is optional and names actual current scope', () => {
 for (const text of ['필요한 팀만', '공용 연결 서버는 준비 전', '예시 답변 · 실제 AI 연결 전', '기존 활동지 STEP 3']) assert.ok(guide.includes(text));
});
test('competency mapping is teacher reference, not student reporting rubric', () => {
 for (const text of ['드러낼 네 가지 역량', '드러나는 역량', '탐구 과정에서 보여 줄 것']) assert.ok(!(guide+project+home).includes(text));
 for (const text of ['문제해결력','AI 리터러시','데이터 리터러시','공동체 역량']) assert.ok(teacher.includes(text));
});
test('student safety remains simple while operations stay teacher-side', () => {
 for (const text of ['개인정보','비밀 API 키','반복 전송을 멈추고']) assert.ok(guide.includes(text));
 assert.ok(!guide.includes('CORS')); assert.ok(teacher.includes('CORS'));
});
test('practical starter and all existing worksheet steps remain available', () => {
 assert.ok(guide.includes('/templates/ai-chatbot-starter.zip'));
 assert.ok(guide.includes('현재 앱 파일과 압축을 푼 시작 파일을 함께'));
 for (let n=0;n<=5;n++) assert.ok(project.includes('## STEP '+n+'.'));
 for (const text of ['content={developmentPrompt}', '현재 앱 파일을 첨부했습니다.', 'content={analysisPrompt}']) assert.ok(project.includes(text));
});
test('prompts support work students can do without inventing infrastructure', () => {
 for (const name of ['addChatbotPrompt','chatbotDebugPrompt']) assert.ok(guide.includes(`content={${name}}`));
 assert.ok(addChatbotPrompt.includes('유료 API를 호출하지 말고'));
 assert.ok(addChatbotPrompt.includes('추측하지 마'));
 assert.ok(chatbotDebugPrompt.includes('미검증'));
});
test('short help links remain directly inside chapter eight', () => {
 const start=config.indexOf("label: '8. DATA TO WEB APP'");
 const end=config.indexOf("label: 'Ⅲ단원.",start);
 const section=config.slice(start,end);
 for (const path of ['/data-project/','/data/map-lab/','/data/ai-chatbot/','/data/github-ai/']) assert.ok(section.includes(path));
 assert.ok(!section.includes("label: '프로젝트 도움말"));
 assert.ok(section.includes("label: 'AI 기능(선택)'"));
});
