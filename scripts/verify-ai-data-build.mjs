// Run serially: temporarily adds synthetic approved records, restores source even on failure.
import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { mergeProject } from './publish-ai-data.mjs';
const file = new URL('../src/data/ai-data-projects.json', import.meta.url);
const original = await readFile(file,'utf8');
const source=JSON.parse(original);
const sample={classroom:8,teamNumber:1,team:'검사용 팀',title:'검사용 앱',url:'https://example.com/',problem:'<script>alert("xss")</script>',decisions:'우리 팀이 직접 결정한 내용',implementation:'구현한 기능만 기록',verification:'확인하지 못했습니다.'};
try {
 let projects=mergeProject(source,{reviewed:true,submission:sample});
 projects=mergeProject(projects,{reviewed:true,submission:{...sample,classroom:10,teamNumber:3}});
 // Ensure the editorial route never depends on the first position.
 projects.reverse();
 await writeFile(file,JSON.stringify(projects));
 execFileSync('npm',['run','build'],{stdio:'pipe'});
 const html=await readFile(new URL('../dist/exhibition/ai-data/index.html',import.meta.url),'utf8');
 for(const c of [8,9,10]) assert.ok(html.includes(`id="class-${c}"`));
 for(const id of ['class-8-team-1','class-10-team-3','data-queen']) assert.ok(html.includes(`/hyfl-ai-lab/exhibition/ai-data/${id}/`));
 const detail=await readFile(new URL('../dist/exhibition/ai-data/class-8-team-1/index.html',import.meta.url),'utf8');
 assert.ok(detail.includes('우리 팀이 직접 결정한 내용'));
 assert.ok(detail.includes('&lt;script&gt;'));
 assert.ok(!detail.includes('<script>alert("xss")</script>'));
 assert.ok(detail.includes('확인하지 못했습니다.'));
 const legacy=await readFile(new URL('../dist/exhibition/ai-data/data-queen/index.html',import.meta.url),'utf8');
 assert.ok(legacy.includes('https://dataqueen.vercel.app/'));
 for(const page of ['submit','review']) {
   const pageHTML=await readFile(new URL(`../dist/exhibition/ai-data/${page}/index.html`,import.meta.url),'utf8');
   assert.ok(pageHTML.includes('data-submission-form'));
   assert.ok(pageHTML.includes('우리 팀이 결정한 것'));
 }
 const school=JSON.parse(await readFile(new URL('../src/data/school-image-lab.json',import.meta.url),'utf8'));
 console.log('Multi-class/detail routes, exact text, HTML escaping, reordered DATA QUEEN and submission/review pages passed.');
 console.log('School Image Lab data structure retained:', Array.isArray(school) ? school.length : Object.keys(school));
} finally { await writeFile(file,original); }
