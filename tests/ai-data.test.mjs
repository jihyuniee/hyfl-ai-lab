import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateSubmission, approvedProject } from '../src/lib/ai-data.mjs';
import { mergeProject } from '../scripts/publish-ai-data.mjs';
const submission={classroom:8,teamNumber:1,team:'테스트 팀',title:'테스트 웹앱',url:'https://example.com/',problem:'주변 문제',decisions:'우리 팀은 지도 기능을 선택했습니다.',implementation:'지도에 위치를 표시했습니다.',verification:'아직 원자료와 비교하지 못했습니다.'};
const envelope={reviewed:true,submission};
test('submission → review → publication preserves exact student text',()=>{
 const draft=validateSubmission(submission);
 assert.throws(()=>approvedProject(draft));
 assert.throws(()=>approvedProject({reviewed:false,submission}));
 const result=mergeProject([],envelope);
 assert.equal(result[0].verification,submission.verification);
 assert.equal(result[0].id,'class-8-team-1');
 assert.equal(result[0].members,undefined);
});
test('reject unapproved fields, empty or oversized descriptions and sensitive strings',()=>{
 for(const patch of [{members:['이름']},{studentId:'20801'},{worksheet:'원문'},{problem:''},{decisions:'가'.repeat(401)},{problem:'20801'},{problem:'010-1234-5678'},{problem:'name@example.com'},{problem:'sk-abcdefghijklmnop'},{problem:'serviceKey=secret'}]) assert.throws(()=>validateSubmission({...submission,...patch}));
});
test('reject unsafe URLs, credentials and query secrets',()=>{
 for(const url of ['javascript:alert(1)','http://example.com','https://me:secret@example.com','https://example.com/?key=secret','https://example.com/#secret','https://127.0.0.1/','https://192.168.1.2/']) assert.throws(()=>validateSubmission({...submission,url}));
});
test('multiple classrooms, duplicate protection and deliberate update',()=>{
 let list=mergeProject([],envelope);
 list=mergeProject(list,{reviewed:true,submission:{...submission,classroom:10}});
 assert.equal(list.length,2);
 assert.throws(()=>mergeProject(list,envelope));
 const updated=mergeProject(list,{reviewed:true,submission:{...submission,title:'수정'}},true);
 assert.equal(updated.length,2);assert.equal(updated[0].title,'수정');
});
test('DATA QUEEN remains byte-equivalent as a record and cannot be overwritten by importer',async()=>{
 const original=JSON.parse(await readFile(new URL('../src/data/ai-data-projects.json',import.meta.url),'utf8'));
 const next=mergeProject(original,envelope);
 assert.deepEqual(next.find(p=>p.id==='data-queen'),original.find(p=>p.id==='data-queen'));
 assert.throws(()=>mergeProject(original,{reviewed:true,submission:{...submission,classroom:9,teamNumber:2}},true));
});
