import { mkdir, readFile, writeFile, copyFile } from 'node:fs/promises';
import { resolve, relative, dirname } from 'node:path';
const root = resolve(import.meta.dirname, '..');
const output = process.argv[2] && resolve(process.argv[2]);
if (!output || !relative(root, output).startsWith('..')) throw new Error('저장소 밖의 새 출력 폴더를 지정하세요.');
const allowlist = [
  'api/ai-data/community.mjs', 'api/ai-data/status.mjs', 'api/ai-data/vote.mjs',
  'services/ai-data-voting/lib/community.mjs', 'services/ai-data-voting/lib/blob.mjs',
  'services/ai-data-voting/lib/http.mjs', 'services/ai-data-voting/lib/voting.mjs',
  'services/ai-data-voting/package.json', 'services/ai-data-voting/package-lock.json'
];
await mkdir(output, { recursive: false });
for (const path of allowlist) { await mkdir(dirname(resolve(output, path)), { recursive: true }); await copyFile(resolve(root, path), resolve(output, path)); }
const projects = JSON.parse(await readFile(resolve(root, 'src/data/ai-data-projects.json'), 'utf8'));
await mkdir(resolve(output, 'src/data'), { recursive: true });
await writeFile(resolve(output, 'src/data/ai-data-projects.json'), JSON.stringify(projects.map(({ id }) => ({ id }))));
await writeFile(resolve(output, 'package.json'), JSON.stringify({ name: 'hyfl-ai-data-api', type: 'module', private: true, engines: { node: '>=22' } }));
await writeFile(resolve(output, 'vercel.json'), JSON.stringify({ framework: null, installCommand: 'npm ci --prefix services/ai-data-voting --no-audit --no-fund', buildCommand: 'mkdir -p voting-public', outputDirectory: 'voting-public', functions: { 'api/ai-data/*.mjs': { includeFiles: 'src/data/ai-data-projects.json' } } }));
await mkdir(resolve(output, 'voting-public'));
await writeFile(resolve(output, 'voting-public/index.html'), '<!doctype html><html lang="ko"><meta charset="utf-8"><title>AI × DATA 전시관 API</title><p>AI × DATA 전시관의 관람객 반응 및 투표 API입니다.</p></html>');
console.log(`Packaged exhibition API: ${output}`);
