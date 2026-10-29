import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {specToUrlPrompt,diagnoseApiPrompt,responseToAppPrompt} from '../src/content/prompts/public-api-practice.mjs';
const html=readFileSync(new URL('../public/templates/weather-response-viewer.html',import.meta.url),'utf8');
const sandbox={}; vm.createContext(sandbox);vm.runInContext(html.split('// parser-start')[1].split('// parser-end')[0],sandbox);
const parse=sandbox.readTemperature;
const payload=items=>({response:{header:{resultCode:'00',resultMsg:'NORMAL_SERVICE'},body:{items:{item:items}}}});
const row={category:'T1H',obsrValue:'18.2',baseDate:'20990101',baseTime:'0900',nx:60,ny:127};
test('selects T1H rather than first item; preserves units metadata',()=>{
 const result=parse(payload([{category:'REH',obsrValue:'60'},row]));assert.equal(result.temperature,'18.2');assert.equal(result.baseTime,'0900');assert.equal(result.nx,'60');assert.match(html,/temperature} ℃/);
});
test('empty and missing temperature do not become zero',()=>{
 assert.equal(parse(payload([])).kind,'empty');assert.equal(parse(payload([{category:'REH',obsrValue:'60'}])).kind,'missing-temperature');assert.throws(()=>parse(payload([{...row,obsrValue:''}])));
});
test('provider no-data vs auth errors are distinguished',()=>{
 assert.equal(parse({response:{header:{resultCode:'03',resultMsg:'NODATA_ERROR'}}}).kind,'empty');assert.throws(()=>parse({response:{header:{resultCode:'30',resultMsg:'SERVICE_KEY_IS_NOT_REGISTERED_ERROR'}}}),/30/);assert.throws(()=>parse({}),/response.header/);
});
test('sentinel missing temperature never renders as observed degrees',()=>{
 for(const n of ['-999','-900','900','999'])assert.equal(parse(payload([{...row,obsrValue:n}])).kind,'missing-value');assert.equal(parse(payload([{...row,obsrValue:'0'}])).temperature,'0');
});
test('three prompts carry documentation/context and key placeholder',()=>{
 for(const s of [diagnoseApiPrompt,responseToAppPrompt])for(const token of ['공식 활용 명세서','상세기능','원하는 데이터','조회 조건','개발 환경','YOUR_API_KEY'])assert.ok(s.includes(token));
 for(const token of ['요청 주소(URL)', '요청 인자(파라미터)', '가져오고 싶은 데이터', 'YOUR_API_KEY', '필수 정보가 부족하면'])assert.ok(specToUrlPrompt.includes(token));
 assert.match(responseToAppPrompt,/존재하지 않는 서버/);assert.match(diagnoseApiPrompt,/no-cors/);
});
test('guide keeps portal auth distinct and example is explicitly synthetic',()=>{
 const page=readFileSync(new URL('../src/content/docs/data/api-practice.mdx',import.meta.url),'utf8');
 for(const token of ['getUltraSrtNcst','serviceKey','authKey','관측된 실황','실제 인증키를 사용한 호출 결과는 아닙니다'])assert.ok(page.includes(token));
 assert.doesNotMatch(html,/fetch\(|XMLHttpRequest/);
});
