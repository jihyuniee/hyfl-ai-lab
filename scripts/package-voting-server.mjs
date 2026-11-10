import { mkdir, readFile, writeFile, cp } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = path.join(root, 'voting-server-package');
for (const relative of ['api/ai-data', 'services/ai-data-voting/lib']) {
  await mkdir(path.dirname(path.join(output, relative)), { recursive: true });
  await cp(path.join(root, relative), path.join(output, relative), { recursive: true });
}
for (const relative of ['services/ai-data-voting/package.json', 'services/ai-data-voting/package-lock.json']) {
  await cp(path.join(root, relative), path.join(output, relative));
}
const projects = JSON.parse(await readFile(path.join(root, 'src/data/ai-data-projects.json'), 'utf8'));
await mkdir(path.join(output, 'src/data'), { recursive: true });
await writeFile(path.join(output, 'src/data/ai-data-projects.json'), JSON.stringify(projects.map(({ id }) => ({ id, title: id })), null, 2));
await cp(path.join(root, 'vercel.voting.json'), path.join(output, 'vercel.json'));
console.log('Prepared voting-server-package with project IDs only. Deploy this directory, not the repository root.');
