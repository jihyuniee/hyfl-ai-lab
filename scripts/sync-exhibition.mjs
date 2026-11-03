import { readFile, writeFile } from 'node:fs/promises';
import { approvedWork } from './exhibition-data.mjs';

const repository = process.env.GITHUB_REPOSITORY || 'jihyuniee/hyfl-ai-lab';
const owner = repository.split('/')[0];
const headers = { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
// An edited approved submission must be reviewed again before publication.
if (process.env.GITHUB_EVENT_NAME === 'issues' && process.env.GITHUB_EVENT_PATH) {
  const event = JSON.parse(await readFile(process.env.GITHUB_EVENT_PATH, 'utf8'));
  if (event.action === 'edited' && event.changes?.body && event.issue?.state === 'closed'
      && event.issue.title?.startsWith('[작품전]')) {
    const reopened = await fetch(`https://api.github.com/repos/${repository}/issues/${event.issue.number}`, {
      method: 'PATCH', headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ state: 'open' }),
    });
    if (!reopened.ok) throw new Error(`수정 작품 재검토 전환 실패: HTTP ${reopened.status}`);
  }
}
const works = [];
for (let page = 1; ; page++) {
  const response = await fetch(`https://api.github.com/repos/${repository}/issues?state=closed&per_page=100&page=${page}`, { headers });
  if (!response.ok) throw new Error(`작품 신청 읽기 실패: HTTP ${response.status}`);
  const issues = await response.json();
  for (const issue of issues) {
    if (issue.pull_request || !issue.title?.startsWith('[작품전]')) continue;
    const detail = await fetch(`https://api.github.com/repos/${repository}/issues/${issue.number}`, { headers });
    if (!detail.ok) throw new Error(`작품 확인 실패: HTTP ${detail.status}`);
    const work = approvedWork(await detail.json(), owner);
    if (work) works.push(work);
  }
  if (issues.length < 100) break;
}
works.sort((a, b) => Number(b.year) - Number(a.year) || a.id - b.id);
await writeFile(new URL('../src/data/exhibition.json', import.meta.url), JSON.stringify(works, null, 2) + '\n');
console.log(`확인된 전시 작품 ${works.length}개 반영`);
