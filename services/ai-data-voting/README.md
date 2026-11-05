# 학교 계정 공감상 투표 서버

기존 GitHub Pages 전시관은 그대로 유지한다. 이 서버만 별도의 Vercel 프로젝트로 배포한다. 브라우저 저장소로 투표 수를 계산하지 않는다. 투표 저장소는 Upstash Redis의 전용 데이터베이스를 사용한다. 연결 전에는 기존 전시관에 ‘투표 준비 중’이 표시되며 가짜 투표는 저장하지 않는다.

## 먼저 확인할 값

1. 학교 Google Workspace 도메인: 학생 계정의 `@` 뒤 주소. 유사한 도메인을 추정해서 허용하지 않는다.
2. 학교 Google Cloud 프로젝트에서 만든 **웹 애플리케이션 OAuth 클라이언트 ID**. 승인된 JavaScript 원본은 `https://jihyuniee.github.io`(경로 제외). 학교 내부 사용자용으로 동의 화면을 구성하고, 학교 관리자의 앱 접근 제한도 확인한다. 클라이언트 ID는 공개 설정값이며 비밀번호가 아니다. 이 ID 토큰 방식에는 클라이언트 비밀키가 필요하지 않다.
3. 전용 Upstash Redis REST URL·쓰기 토큰. 토큰은 Vercel 환경변수로만 등록한다. 기존 서비스 저장소를 변경하거나 재사용하지 않는다.
4. 모든 팀의 전시가 완료된 뒤 정할 투표 시작·마감 시각. 시간대 포함 ISO 문자열을 사용한다(예: 형식 `YYYY-MM-DDTHH:mm:ss+09:00`).

## 배포

저장소 루트에서 별도의 Vercel 프로젝트를 연결한다. 기존 hyfl-class 프로젝트는 건드리지 않는다. Vercel CLI를 쓰는 경우 저장소 루트에서 `vercel --local-config vercel.voting.json`으로 미리 배포하고, 검증 후 동일 구성으로 `vercel --prod --local-config vercel.voting.json`을 실행한다. Vercel 프로젝트의 Node.js 버전은 22 이상으로 설정한다. 루트 `api/ai-data/`가 서버리스 엔드포인트이며, 서버 라이브러리와 데이터 JSON을 함께 번들한다. GitHub Pages 빌드에는 영향을 주지 않는다.

서버의 환경변수:

| 이름 | 값 |
| --- | --- |
| `GOOGLE_CLIENT_ID` | 위 웹 클라이언트 ID |
| `SCHOOL_DOMAINS` | 확인된 학교 Workspace 도메인. 여러 개인 경우 쉼표 구분 |
| `ALLOWED_ORIGINS` | `https://jihyuniee.github.io`. 개발 원본 추가는 별도로 명시 |
| `VOTER_HASH_SECRET` | 무작위 32자 이상 비밀값. 투표 기간 중 변경하지 않음 |
| `UPSTASH_REDIS_REST_URL` | 전용 Redis REST HTTPS URL |
| `UPSTASH_REDIS_REST_TOKEN` | 전용 Redis 쓰기 토큰 |
| `VOTING_START` | 확정된 시작 시각(시간대 포함) |
| `VOTING_END` | 확정된 마감 시각(시간대 포함) |
| `VOTING_ENABLED` | 검증 중 `false`, 개시 준비 완료 시 `true` |
| `PUBLISH_RESULTS` | 처음 `false`, 결과 공개 시 `true`. 마감 전에는 true여도 공개되지 않음 |

`public/exhibition-voting.json`의 `apiBaseUrl`에 배포된 서버 원본 URL, `googleClientId`에 클라이언트 ID를 기록하고 GitHub Pages를 다시 빌드한다. 서버 URL은 공개값이며 인증 토큰을 포함하지 않는다. 서버를 API 전용으로 공개해 전시관에서 호출할 수 있어야 한다. 외부 배포 보호 페이지로 리다이렉트되는 상태에서는 사용할 수 없다.

## 확인 후 개시

- `npm test --prefix services/ai-data-voting` 및 루트 `npm run build` 실행.
- 로컬 단위 테스트는 인증 결과·저장소를 주입해 수행하며 실제 Google 로그인과 Redis 통신을 대신하지 않는다.
- 별도 시험용 서버·Redis·일정으로 학교 계정 로그인 → 한 팀 투표 → 새로고침·재로그인 후 복원 → 다른 팀으로 변경 → 취소를 실제 확인한다.
- 개인 Gmail·타 학교 계정·위조/만료 토큰 거부, 두 기기에서 동일 학교 계정으로 동시 요청해도 최종 한 표만 존재함을 확인한다.
- 투표 전·중에는 집계가 API 응답과 화면에 나타나지 않는지 확인한다. 마감 후 변경·취소 거부 및 집계 공개를 확인한다. 득표수는 서버 원본에서만 계산한다.
- API 연결이 끊겼을 때 성공 메시지를 보여주지 않는지 확인한다. 모바일에서 로그인·닫기·변경이 가능한지 확인한다.
- 프로젝트 ID는 `src/data/ai-data-projects.json`에서 가져온다. 팀을 추가할 때 전시관과 투표 서버를 모두 재배포해 목록을 맞춘다.
- 시험 데이터를 운영 저장소에 남기지 않는다. 모든 팀의 등록과 검증이 끝난 뒤 운영 일정·환경변수를 설정하고 개시한다.

## 데이터와 선정

서명·발급대상·만료는 Google 공식 라이브러리가 검증하며 Workspace `hd` 및 이메일 확인 상태는 서버가 검사한다. 단순 이메일 끝자리나 브라우저의 주장을 신뢰하지 않는다. 인증 토큰은 브라우저 메모리에만 유지한다.

Redis 해시 한 필드가 한 계정의 선택을 나타낸다. Lua 스크립트가 변경·취소를 원자적으로 처리하며 Redis 시각으로 기간을 재확인한다. 학교 계정이 여러 개인 사람을 동일인으로 합치는 기능은 없다. 집계에는 계정 식별값을 반환하지 않는다. 투표 기록은 마감 30일 후 삭제되므로 집계 공개 기간도 그 안으로 잡는다. 장기 보존이 필요하면 개인별 기록 없이 최종 팀별 합계만 별도로 남긴다.

투표는 공감상에만 사용한다. 동점은 공동 공감상, 유효 투표가 없으면 선정하지 않는다. 대상은 `internal/teacher/ai-data-evaluation.md`의 별도 근거 평가를 적용한다.

참고: https://developers.google.com/identity/gsi/web/guides/verify-google-id-token · https://upstash.com/docs/redis/features/restapi
