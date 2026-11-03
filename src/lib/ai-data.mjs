export const fields = {
  team: ['팀명', 40], title: ['웹앱 이름', 60], url: ['실행 주소', 300],
  problem: ['해결하려는 문제', 300], decisions: ['우리 팀이 결정한 것', 400],
  implementation: ['실제 구현한 기능', 400], verification: ['직접 확인한 방법과 결과 · 아직 확인하지 못했다면 그대로 작성', 400],
};
const suspicious = /(?:sk-[a-z0-9_-]{12,}|AIza[a-z0-9_-]{20,}|(?:api[_ -]?key|servicekey|access[_ -]?token|인증키)\s*[:=]|[\w.+-]+@[\w.-]+\.[a-z]{2,}|01[016789][- ]?\d{3,4}[- ]?\d{4}|\b\d{5,}\b|\d{6}[- ]?[1-4]\d{6})/i;
export function validateSubmission(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw Error('제출 파일 형식이 아닙니다.');
  const allowed = ['classroom', 'teamNumber', ...Object.keys(fields)];
  if (Object.keys(input).some(k => !allowed.includes(k))) throw Error('허용하지 않은 항목이 있습니다. 전시관 제출 화면에서 다시 만들어 주세요.');
  const result = {};
  for (const k of ['classroom','teamNumber']) {
    const n = Number(input[k]);
    if (!Number.isInteger(n) || n < 1 || n > (k === 'classroom' ? 10 : 30)) throw Error('반 또는 팀 번호를 확인하세요.');
    result[k] = n;
  }
  for (const [k, [label, max]] of Object.entries(fields)) {
    const value = input[k];
    if (typeof value !== 'string' || !value.trim() || value.trim().length > max) throw Error(`${label}: 1~${max}자로 작성하세요.`);
    if (suspicious.test(value)) throw Error(`${label}: 개인정보·학번·인증키로 보이는 내용이 있습니다. 지운 뒤 다시 확인하세요.`);
    result[k] = value.trim();
  }
  let url;
  try { url = new URL(result.url); } catch { throw Error('실행 주소를 확인하세요.'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || !url.hostname.includes('.') || /^(localhost|127\.|0\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(url.hostname)) throw Error('공개 HTTPS 실행 주소를 입력하세요. 키가 포함될 수 있는 ?조건값과 #는 빼 주세요.');
  return result;
}
export function approvedProject(input) {
  if (input?.reviewed !== true) throw Error('교사 검수 승인이 필요합니다.');
  const s = validateSubmission(input.submission);
  return { id: `class-${s.classroom}-team-${s.teamNumber}`, ...s };
}
