# 학교 계정 공감상 투표 서버

기존 GitHub Pages 전시관은 그대로 유지한다. 이 서버만 별도의 Vercel 프로젝트로 배포한다. 브라우저 저장소로 투표 수를 계산하지 않는다. 투표 저장소는 Upstash Redis의 전용 데이터베이스를 사용한다. 연결 전에는 기존 전시관에 ‘투표 준비 중’이 표시되며 가짜 투표는 저장하지 않는다.

## 먼저 확인할 값

1. 학교 Google Workspace 도메인: 학생 계정의 `@` 뒤 주소. 유사한 도메인을 추정해서 허용하지 않는다.
2. 학교 Google Cloud 프로젝트에서 만든 **웹 애플리케이션 OAuth 클라이언트 ID**. 승인된 JavaScript 원본은 `https://jihyuniee.github.io`(경로 제외). 학교 내부 사용자용으로 동의 화면을 구성하고, 학교 관리자의 앱 접근 제한도 확인한다. 클라이언트 ID는 공개 설정값이며 비밀번호가 아니다. 이 ID 토큰 방식에는 클라이언트 비밀키가 필요하지 않다.
3. 전용 Upstash Redis REST URL·쓰기 토큰. 토큰은 Vercel 환경변수로만 등록한다. 기존 서비스 저장소를 변경하거나 재사용하지 않는다.
4. 모든 팀의 전시가 완료된 뒤 정할 투표 시작·마감 시각. 시간대 포함 ISO 문자열을 사용한다(예: 형식 `YYYY-MM-DDTHH:mm:ss+09:00`).

## 배포

학생 이름·학번·활동지 내용은 투표 서버에 필요하지 않다. 저장소 루트에서 `node scripts/package-voting-server.mjs`를 실행하면 `voting-server-package/`에 서버 코드와 프로젝트 ID만 준비된다. `title`도 ID로 대체하며 화면의 팀 이름은 기존 전시관에서 표시한다. 해당 폴더에서 별도 Vercel 프로젝트 `hyfl-ai-data-voting`에 연결하고 `vercel`로 시험 배포한다. 검증된 구성을 `vercel --prod`로 배포한다. 저장소 루트 전체나 기존 hyfl-class 프로젝트에 배포하지 않는다. Node.js는 22로 설정한다. 팀을 추가하면 패키지를 다시 생성해 재배포한다. 배포 패키지에는 비밀값을 넣지 않는다.

2026-11-05 별도 서버: https://hyfl-ai-data-voting.vercel.app (Vercel READY). `VOTING_ENABLED=false`, `PUBLISH_RESULTS=false`, 허용 원본과 운영용 해시 비밀값을 설정했다. OAuth·학교 도메인·Redis·기간은 미설정이며 전시관 공개 설정 두 값은 비워 둔다. 실제 HTTP 확인: 학교 원본 status 200/preparing(일정 null·집계 없음), POST vote 503(저장 차단), 다른 원본/원본 없음 403, 사전 요청 OPTIONS 204, 응답 no-store. 단위 테스트 16개와 사이트 빌드 통과는 실제 Google·Redis 검증과 구분한다. 실제 로그인·저장·동시 중복·변경·취소는 아직 미검증이다.

### 설정값 발급과 입력 위치

- Google Cloud Console → 학교 조직의 프로젝트 → Google Auth Platform → Branding/Audience에서 학교 내부 사용자용 구성 → Clients → Create client → Web application. Authorized JavaScript origins에는 `https://jihyuniee.github.io`만 입력한다(경로 없음). ID 토큰 콜백 방식이므로 리디렉션 URI와 클라이언트 비밀키는 필요하지 않다. 클라이언트 ID는 Vercel의 `GOOGLE_CLIENT_ID`와 나중에 전시관 `googleClientId`에 동일하게 넣는다. 학교 계정 도메인은 실제 학생 이메일의 @ 뒤 값을 확인해 `SCHOOL_DOMAINS`에 넣는다.
- Upstash Console → Redis → Create Database에서 투표 전용 DB 생성 → Connect → REST에서 REST URL과 쓰기 토큰 복사. 각각 아래 두 환경변수에 입력한다. 읽기 전용 토큰은 투표를 저장할 수 없다. 운영용과 별도로 시험 DB를 만든다.
- Vercel → hyfl-ai-data-voting → Settings → Environment Variables에서 Production 대상으로 입력한다. Redis 토큰은 Secret/Sensitive로 저장한다. 비밀값을 활동지·GitHub·공개 JSON·채팅에 붙여 넣지 않는다. 변경 후 새로 배포해야 반영된다.
- 모든 팀 등록 후 `VOTING_START`/`VOTING_END`를 `YYYY-MM-DDTHH:mm:ss+09:00`으로 입력한다. 검증 전까지 `VOTING_ENABLED=false`를 유지한다. 별도 시험 프로젝트와 Redis에서 기간을 짧게 설정해 아래 검증을 끝낸 뒤 운영 설정으로 옮긴다. 결과 공개는 운영 마감 후 `PUBLISH_RESULTS=true`로 변경하고 재배포한다.

공식 안내: https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid · https://upstash.com/docs/redis/features/restapi

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

## 전시관 좋아요·댓글 (2026-11-10)

`/api/ai-data/community`는 공감상 투표와 독립된 관람객 반응이다. 학교 로그인이나 투표 설정을 요구하지 않으며, 여러 작품에 좋아요를 누르고 취소할 수 있다. 공감상은 기존 학교 계정 투표 규칙을 그대로 사용하고 현재 비활성 상태다.

- 공유 저장소: 이 프로젝트에 연결된 전용 **private Vercel Blob** `hyfl-ai-data-community` (`BLOB_READ_WRITE_TOKEN`은 서버 환경변수). 공용 브라우저 저장소에는 임의의 방문자 UUID만 보관한다. 숫자·댓글은 서버에서 불러온다.
- UUID를 `VOTER_HASH_SECRET`과 별도 `community-v1` 문맥으로 HMAC 처리한다. 원래 UUID·이름·이메일은 저장하지 않는다. 댓글 응답에는 본문·시각·댓글 ID·본인 여부만 반환한다. 이름은 모두 ‘관람객’이다.
- 좋아요는 브라우저당 작품별 한 번이다. 저장소 초기화·다른 브라우저·기기를 동일인으로 합치지 않으므로 시상·순위 판정에 사용하지 않는다. 공개 익명 참여이며 학교 구성원 인증이나 완전한 중복·스팸 방지는 제공하지 않는다.
- 댓글은 최대 300자, 같은 브라우저에서 작품당 분당 한 번. 최신 50개를 보여주고 전체 개수는 별도로 표시한다. 본문은 `textContent`로 렌더링한다. 작성 브라우저만 자기 댓글을 삭제할 수 있고, 다른 방문자의 삭제 요청은 서버에서 거절한다.
- 각 좋아요·댓글을 독립된 객체로 저장하여 다른 방문자의 동시 쓰기가 서로 덮어쓰지 않는다. 저장 실패 시 성공이나 임의의 숫자를 표시하지 않는다. 허용 Origin은 기존 `ALLOWED_ORIGINS`를 적용한다.
- 운영자가 댓글을 삭제해야 하면 Vercel Storage에서 `community/comments/<작품 ID>/`의 해당 객체를 확인해 삭제한다. 새 댓글은 검수 없이 공개된다.
- 공개 설정은 `public/exhibition-community.json`의 API 원본 주소 하나다. 비밀 토큰이나 방문자 식별값을 넣지 않는다.

배포 패키지는 `node scripts/package-exhibition-api.mjs /저장소밖/새폴더`로 만든다. 서버 파일과 ID-only 작품 목록만 포함하며 이름·활동지·교과서는 배포하지 않는다. 패키지 폴더를 기존 `hyfl-ai-data-voting` 프로젝트에 배포한다. 이 저장소 전체를 Vercel 프로젝트에 연결하지 않는다. 작품 추가 시 API도 다시 배포한다.

검증: `npm test --prefix services/ai-data-voting`과 `npm run build`. 실제 연결에서는 좋아요 두 번이 한 번으로 유지되는지, 취소·다시 읽기·댓글 작성/삭제, 다른 방문자 삭제 거부, 허용되지 않은 Origin 차단, 기존 투표 상태가 `preparing`인지 확인한다. 시험용 반응은 검증 후 모두 제거한다.
