// GitHub issue forms are the shared submission store. Only the repository owner's
// completed closures publish entries. Rendering never treats issue text as HTML.
export function field(body, heading) {
  const marker = `### ${heading}\n`;
  const start = body.indexOf(marker);
  if (start < 0) return '';
  const rest = body.slice(start + marker.length);
  const end = rest.search(/\n### /);
  const value = (end < 0 ? rest : rest.slice(0, end)).trim();
  return value === '_No response_' ? '' : value;
}

export function httpsUrl(value) {
  try {
    const url = new URL(value.trim());
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : '';
  } catch { return ''; }
}

export function approvedWork(issue, owner) {
  if (issue.pull_request || issue.state !== 'closed' || issue.state_reason !== 'completed'
      || issue.closed_by?.login !== owner || !issue.title?.startsWith('[작품전]')) return null;
  const body = issue.body || '';
  const get = (name) => field(body, name);
  const category = get('전시 부문');
  if (!['AI × DATA', 'Teachable Machine'].includes(category)) return null;
  const work = {
    id: issue.number, category, title: get('작품명'), team: get('팀명'),
    classroom: get('반'), year: get('제작 연도'), topic: get('주제'),
    url: httpsUrl(get('웹앱 주소')), question: get('우리가 시작한 질문'),
    experience: get('이렇게 사용해 보세요'), data: get('데이터 또는 모델 이야기'),
    learning: get('만들며 알게 된 점'),
    issueUrl: `https://github.com/${owner}/hyfl-ai-lab/issues/${issue.number}`,
    image: '',
  };
  if (!work.title || !work.team || !work.classroom || !/^20\d{2}$/.test(work.year)
      || !work.url || !work.topic || !work.question || !work.experience || !work.data || !work.learning
      || !/-\s*\[[xX]\]/.test(get('공개 전 확인'))) return null;
  const imageField = get('대표 화면');
  const candidate = imageField.match(/!\[[^\]]*\]\((https:\/\/[^\s)]+)\)/)?.[1]
    || imageField.match(/<img\b[^>]*\bsrc="(https:\/\/[^"\s]+)"/i)?.[1];
  const image = httpsUrl(candidate || '');
  // Only GitHub-hosted attachments. Other arbitrary URLs are not loaded as images.
  if (image && ['github.com', 'user-images.githubusercontent.com', 'private-user-images.githubusercontent.com']
      .includes(new URL(image).hostname)) work.image = image;
  return work;
}
