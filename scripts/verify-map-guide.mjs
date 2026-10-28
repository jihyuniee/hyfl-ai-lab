import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {chooseMapServicePrompt, publicDataMapPrompt} from '../src/content/prompts/map-lab.mjs';
const page=readFileSync(new URL('../src/content/docs/data/map-lab.mdx',import.meta.url),'utf8');
test('map selection is optional and provider-specific tutorial preserved',()=>{
 assert.match(page,/내 프로젝트에 지도 넣기\(선택\)/);
 assert.match(page,/카카오 지도를 선택한 팀 · 기존 시작 파일과 설정 예시/);
 assert.match(page,/<MapStarter/);
 assert.match(page,/OpenStreetMap은 지도 데이터/);
});
test('comparison waits for student choice before implementation',()=>{
 assert.match(chooseMapServicePrompt,/후보 두 가지/);
 assert.match(chooseMapServicePrompt,/선택할 때까지 코드 작성·설정 작업·기존 지도 교체를 멈춰/);
 for(const term of ['대상 사용자','모바일','로딩','출처','위치','공식']) assert.ok(chooseMapServicePrompt.includes(term),term);
});
test('common data prompt preserves selected provider instead of switching to Kakao',()=>{
 assert.match(publicDataMapPrompt,/선택한 지도 서비스/);
 assert.doesNotMatch(publicDataMapPrompt,/new kakao|dapi.kakao/);
 assert.match(publicDataMapPrompt,/서버용 비밀키는 공개 코드에 넣지 마/);
});
test('five reflection questions and provider-neutral assessment remain',()=>{
 for(const term of ['선택한 이유는 무엇','정확한 위치에 표시','필요한 기능이 실제로 작동','휴대전화에서도 이용하기','추가 설정이 필요한 부분','특정 지도 서비스를 사용했는지보다']) assert.ok(page.includes(term),term);
});
