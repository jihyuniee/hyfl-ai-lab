import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { approvedProject } from '../src/lib/ai-data.mjs';
export function mergeProject(projects, envelope, replace = false) {
  const project = approvedProject(envelope);
  if (projects.some(p=>p.id === project.id || (p.classroom===project.classroom && p.teamNumber===project.teamNumber))) {
    // Existing editorial DATA QUEEN record must be updated deliberately, never overwritten by this importer.
    if (!replace || projects.some(p=>p.id !== project.id && p.classroom===project.classroom && p.teamNumber===project.teamNumber)) throw Error('이미 등록된 반·팀입니다. 기존 기록을 확인하세요. 일반 제출의 수정은 --replace로 명시하세요.');
    return projects.map(p=>p.id === project.id ? project : p);
  }
  return [...projects, project];
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const args=process.argv.slice(2);
    if (!args[0] || args.some((a,i)=>i>0 && a !== '--replace')) throw Error('사용법: npm run exhibition:publish -- /저장소밖/검수파일.json [--replace]');
    const file = new URL('../src/data/ai-data-projects.json', import.meta.url);
    const raw = await readFile(args[0],'utf8');
    if (Buffer.byteLength(raw)>16000) throw Error('파일 크기를 확인하세요.');
    const merged = mergeProject(JSON.parse(await readFile(file,'utf8')), JSON.parse(raw), args.includes('--replace'));
    await writeFile(file,JSON.stringify(merged,null,2)+'\n');
    console.log('공개 데이터에 반영했습니다. git diff로 공개 내용을 확인한 뒤 PR을 만드세요. 아직 배포되지 않았습니다.');
  } catch(e) { console.error(e.message); process.exitCode=1; }
}
