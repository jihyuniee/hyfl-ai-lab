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

## Google 계정 좋아요·댓글 (2026-11-11)

`/api/ai-data/community`는 공감상 투표와 독립된 작품 감상 기능이다. 조회는 로그인 없이 가능하고, 새 좋아요와 댓글은 Google 계정 인증 후에만 저장된다. 학교 Workspace 계정과 개인 Google 계정 모두 허용한다.

### 로그인 연결

서버에 아래 값을 등록한 뒤 API를 다시 배포한다. 클라이언트 ID를 프런트엔드에 별도로 복사할 필요는 없다. 공개 세션 API가 준비 상태와 공개 클라이언트 ID만 내려준다.

| 환경변수 | 값 |
| --- | --- |
| `GOOGLE_CLIENT_ID` | 학교 Google Cloud 프로젝트의 웹 애플리케이션 OAuth 클라이언트 ID |
| `COMMUNITY_LOGIN_MODE` | 기본 `google`: 학교·일반 Google 허용. 학교만 허용하려면 `school` |
| `SCHOOL_DOMAINS` | 학교 전용 모드와 공감상 투표에서만 필요한 Workspace 도메인 |
| `COMMUNITY_ADMIN_EMAILS` | 댓글 관리 권한을 줄 교사의 정확한 학교 계정 이메일, 쉼표로 구분 |
| `VOTER_HASH_SECRET` | 기존 값을 유지. 변경하면 기존 반응의 본인 확인이 달라짐 |
| `ALLOWED_ORIGINS` | 기존 `https://jihyuniee.github.io` 유지 |
| `BLOB_READ_WRITE_TOKEN` 또는 `BLOB_STORE_ID` | 기존 전용 private Blob 유지 |

Google Cloud OAuth 웹 클라이언트의 승인된 JavaScript 원본에 `https://jihyuniee.github.io`를 등록한다. 경로 `/hyfl-ai-lab`은 넣지 않는다. 일반 Google 계정도 참여할 수 있도록 외부 사용자용으로 구성하고 테스트 사용자·게시 상태를 확인한다. 학교 관리자의 앱 접근 제한도 확인한다. 이 방식에는 클라이언트 비밀키가 필요하지 않다.

`GET /api/ai-data/community?session=true`에서 `auth.ready`를 확인한다. 설정이 없으면 참여 UI에 준비 안내가 표시되고 익명 쓰기를 허용하지 않는다. `ready=true`는 설정 유무만 나타내며, 실제 학교 로그인 성공을 뜻하지 않는다. 실제 학교 계정과 개인 Google 계정으로 Google 서명·발급대상·만료·이메일 확인을 검증해야 한다. `school` 모드에서만 Workspace `hd`를 제한한다.

### 표시와 저장

- 로그인 전 이름·프로필 공개 안내를 확인한다. 좋아요와 댓글의 작성자 이름·프로필 이미지는 공개되고, 이메일은 일반 응답에 포함하지 않는다.
- Google 공식 라이브러리로 검증한 토큰의 `sub`를 `community-google-v1` 문맥으로 HMAC 처리해 Google 계정당 작품별 좋아요 한 번을 저장한다. 다른 기기에서도 같은 계정의 좋아요와 본인 댓글을 확인할 수 있다. 토큰은 브라우저 메모리에만 유지하고 저장소·로그에 기록하지 않는다.
- 이름과 Google 프로필 이미지 주소만 공개 프로필로 저장한다. 이미지 주소는 HTTPS Google 이미지 도메인만 허용한다. 새 댓글에는 교사용 작성자 확인을 위해 이메일을 private Blob에 함께 저장하되, 지정 교사의 관리 요청에만 반환한다.
- 기존 `community/likes/`·`community/comments/` 객체는 재작성·삭제·신원 연결하지 않는다. 기존 익명 좋아요는 총수에 포함하고 작성자 목록에는 익명임을 안내한다. 기존 익명 댓글은 관람객으로 표시하고, 작성 브라우저의 기존 UUID로 자기 댓글을 삭제할 수 있다. UUID로 새 좋아요·댓글을 저장하는 요청은 거절한다.
- 댓글은 300자, 계정별 작품당 분당 한 번이다. 최근 20개부터 이전 댓글을 이어서 불러오며, 좋아요한 사람은 50명씩 이어서 조회한다. 본문과 이름은 `textContent`로 렌더링한다.
- 선생님은 로그인 후 댓글 창의 ‘댓글 관리’에서 작성자를 확인하고 숨김·복원할 수 있다. 숨김은 별도 `community/moderation/` 객체로 기록하며 원본을 보존한다. 일반 조회와 댓글 수에서는 숨긴 댓글을 제외한다. 관리자 목록은 브라우저가 아닌 서버 환경변수로 결정한다.
- 좋아요는 여러 작품에 남길 수 있으며 공감상 투표·시상 집계와 분리한다. 기존 투표 설정과 기록은 변경하지 않는다.

### 배포와 확인

`node scripts/package-exhibition-api.mjs /저장소밖/새폴더`로 API 전용 패키지를 만든 뒤 기존 `hyfl-ai-data-voting` 프로젝트에 배포한다. 서버 코드와 ID-only 작품 목록만 포함하며 학생 소개·교과서는 배포하지 않는다. 작품 추가 시 API도 다시 배포한다.

`npm test --prefix services/ai-data-voting`과 `npm run build`를 실행한다. 단위 테스트는 검증 결과와 저장소를 주입하므로 실제 Google 계정 인증이나 운영 Blob 쓰기 검증을 대신하지 않는다. 운영 연결 후 학교 계정 로그인 → 공개 안내 확인 → 좋아요·취소 → 다른 브라우저에서 동일 계정 복원 → 댓글 작성·본인 삭제 → 교사 숨김·복원을 확인한다. 개인 Gmail·학교 계정 허용, 만료/위조 토큰·익명 UUID 쓰기 거절, `school` 모드에서 다른 학교 계정 거절과 일반 응답의 이메일 비공개도 확인한다.
