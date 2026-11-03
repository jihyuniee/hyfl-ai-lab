import test from 'node:test';
import assert from 'node:assert/strict';
import { approvedWork, httpsUrl } from './exhibition-data.mjs';

const fields = {
  '전시 부문': 'AI × DATA', '작품명': '<script>alert(1)</script>', '팀명': '테스트 팀',
  '반': '2학년 10반', '제작 연도': '2026', '웹앱 주소': 'https://example.org/app',
  '주제': '안전', '우리가 시작한 질문': '어떻게 안전하게 돌아갈까?',
  '이렇게 사용해 보세요': '위치를 입력합니다.', '데이터 또는 모델 이야기': '공공데이터 출처',
  '만들며 알게 된 점': '시험 결과와 한계', '대표 화면': '![화면](https://github.com/user-attachments/assets/example)',
  '공개 전 확인': '- [X] 공개 확인',
};
const body = (values = fields) => Object.entries(values).map(([k, v]) => `### ${k}\n\n${v}\n`).join('\n');
const issue = { number: 123, title: '[작품전] 시험', body: body(), state: 'closed', state_reason: 'completed', closed_by: { login: 'jihyuniee' } };
test('교사 확인된 신청은 텍스트를 보존하고 실제 실행 링크를 추출한다', () => {
  const result = approvedWork(issue, 'jihyuniee');
  assert.equal(result.title, '<script>alert(1)</script>'); // Astro escapes it at render time.
  assert.equal(result.url, fields['웹앱 주소']);
  assert.equal(result.id, 123);
});
test('학생이 닫은 신청, 열린 신청, 미선정 신청, PR은 전시하지 않는다', () => {
  for (const change of [{ closed_by: { login: 'student' } }, { state: 'open' }, { state_reason: 'not_planned' }, { pull_request: {} }]) {
    assert.equal(approvedWork({ ...issue, ...change }, 'jihyuniee'), null);
  }
});
test('부문·필수 소개·공개 확인이 없거나 URL이 위험하면 전시하지 않는다', () => {
  for (const change of [{ '전시 부문': '다른 부문' }, { '우리가 시작한 질문': '' }, { '공개 전 확인': '- [ ] 확인' }, { '웹앱 주소': 'javascript:alert(1)' }, { '제작 연도': '올해' }]) {
    assert.equal(approvedWork({ ...issue, body: body({ ...fields, ...change }) }, 'jihyuniee'), null);
  }
});
test('Teachable Machine도 같은 제출 흐름을 사용한다', () => {
  assert.equal(approvedWork({ ...issue, body: body({ ...fields, '전시 부문': 'Teachable Machine' }) }, 'jihyuniee').category, 'Teachable Machine');
});
test('임의 이미지 호스트는 로드하지 않고 소문자 체크박스는 허용한다', () => {
  const result = approvedWork({ ...issue, body: body({ ...fields, '대표 화면': '![화면](https://untrusted.example/photo.png)', '공개 전 확인': '- [x] 확인' }) }, 'jihyuniee');
  assert.equal(result.image, '');
});
test('비밀정보가 포함된 URL과 스크립트 주소를 거부한다', () => {
  for (const url of ['https://user:secret@example.org', 'http://example.org', 'data:text/html,test', 'javascript:alert(1)']) assert.equal(httpsUrl(url), '');
});
