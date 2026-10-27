# 우리 팀 AI 챗봇 시작 예제

자기 웹앱의 질문을 서버에서 OpenAI 또는 Claude API로 보내고, 답변을 화면에 표시합니다. `index.html`과 서버 함수를 같은 Vercel 프로젝트에 배포합니다.

## 1. 선생님과 확인하기

팀명, 앱의 목적, AI가 맡을 기능, 사용할 자료, 배포 주소, 사용 기간과 예상 사용자를 정리해 API 사용을 요청합니다. 선생님과 서비스·모델·사용 한도를 확인합니다.

선생님은 팀별 OpenAI 프로젝트 또는 Claude 워크스페이스의 사용 권한과 지출 한도를 설정하고, 해당 팀의 서버 환경변수에 API 키를 등록합니다. Claude는 해당 팀 워크스페이스에 범위를 지정한 서비스 계정 키를 사용합니다. 여러 워크스페이스에 접근하는 키를 사용할 때는 `ANTHROPIC_WORKSPACE_ID`도 설정합니다.

## 2. 파일 준비하기

압축을 푼 폴더에는 다음 파일이 있습니다. 새 프로젝트의 시작점으로 사용합니다. 기존 앱에 적용할 때는 현재 화면·기능을 보존하고 질문창, 호출 코드, 서버 함수를 필요한 위치에 추가합니다.

| 파일 | 역할 |
| --- | --- |
| `index.html` | 앱 이용 코드, 참고 자료, 질문·답변 화면 |
| `api/chat.js` | Vercel의 `/api/chat` 함수 진입점 |
| `server/chat.js` | 이용 코드 확인, 입력 제한, AI 호출, 오류 처리 |
| `package.json` | JavaScript 모듈과 Node.js 24 설정 |
| `vercel.json` | 배포, 함수 실행 시간, 공개 파일 경로 설정 |
| `.gitignore` | 로컬 환경변수·도구 설정을 Git에서 제외 |

파일을 GitHub 저장소의 맨 위에 같은 폴더 구조로 올립니다. `api`와 `server` 폴더도 함께 올립니다. 프로젝트의 `index.html`에 자신의 앱 이름과 안내 문장을 작성합니다.

## 3. Vercel에 연결하기

1. Vercel의 **Add New → Project**에서 해당 GitHub 저장소를 가져옵니다.
2. **Root Directory**에 이 예제의 `package.json`과 `index.html`이 있는 폴더를 선택합니다. 저장소 맨 위에 올렸으면 기본값을 사용합니다.
3. Framework Preset은 **Other**입니다. 제공된 설정은 Build Command와 Install Command가 빈 값이며 Output Directory는 `.`입니다.
4. **Environment Variables**에서 아래 값을 등록합니다. API 키는 선생님과 함께 서버 설정에 입력합니다. 서비스는 한 가지를 선택합니다.
5. 배포 후 제공되는 **HTTPS 앱 주소**를 엽니다. 환경변수를 수정한 경우 **Redeploy**하여 새 배포에 적용합니다.

GitHub Pages는 정적 파일을 제공합니다. 이 예제의 AI 요청은 `/api/chat` 서버 함수가 실행되는 Vercel 배포 주소에서 처리됩니다. 기존 지도 기능이 있으면 새 배포 주소를 지도 서비스의 도메인 설정에도 반영합니다.

## 4. 환경변수 등록하기

| 이름 | 입력할 값 |
| --- | --- |
| `AI_PROVIDER` | GPT를 사용하면 `openai`, Claude를 사용하면 `anthropic` |
| `AI_MODEL` | 선생님이 지정한 API 모델 ID |
| `OPENAI_API_KEY` | `openai`를 선택했을 때 사용할 팀 프로젝트의 API 키 |
| `ANTHROPIC_API_KEY` | `anthropic`을 선택했을 때 사용할 팀 워크스페이스의 API 키 |
| `CHAT_ACCESS_CODE` | 선생님과 정한 앱 이용 코드. 무작위 영문·숫자·`_`·`-` 16~128자 |

`CHAT_ACCESS_CODE`는 이 앱의 이용자를 확인하는 코드입니다. 앱 사용자에게 이 이용 코드를 안내하고, API 비밀키는 서버 환경변수에서 관리합니다. 이용 코드는 HTML·공개 저장소·활동지에 기록하지 않습니다. 앱은 코드를 메모리에서만 사용하고, 서버는 요청마다 코드를 확인합니다.

선택 환경변수:

| 이름 | 기본값과 용도 |
| --- | --- |
| `CHAT_SYSTEM_PROMPT` | 생략하면 자료의 근거를 확인하는 도우미 지시를 사용합니다. 팀 앱의 역할을 정할 수 있습니다. 최대 4,000자 |
| `MAX_OUTPUT_TOKENS` | 기본 `800`. 허용 범위 `128`~`1600`. 모델이 생성할 출력 토큰의 최대값 |
| `ANTHROPIC_WORKSPACE_ID` | Claude의 범위 없는 키를 사용할 때 요청이 실행될 워크스페이스 ID |

예제에는 `YOUR_`·`REPLACE_`·`MODEL_FROM_`로 시작하는 자리표시자 설정을 감지하는 확인 과정이 있습니다. 실제 설정이 완료되면 AI 요청을 처리합니다.

## 5. 실행하고 확인하기

1. 배포된 앱에 이용 코드를 입력합니다.
2. 필요한 경우 자료명·출처·기준일·질문에 관련된 내용을 **함께 참고할 자료**에 입력합니다.
3. 질문을 보내고 답변의 수치·이름·날짜를 원자료와 대조합니다.
4. 후속 질문을 보내 앞선 대화를 참고하는지 확인합니다. 새 대화를 누르면 이전 대화가 정리됩니다.
5. 잘못된 이용 코드, 빈 질문, 긴 질문, 제공사 사용 한도에 대한 안내를 확인합니다.
6. 선생님은 제공사 대시보드에서 실제 사용량과 비용을 확인합니다.

질문·선택 자료·최근 대화는 설정한 AI 제공사에 전달됩니다. 공개 가능한 자료를 사용합니다. 앱에는 대화 저장 기능이 없으며 브라우저 메모리에서만 유지합니다. 제공사의 데이터 처리 조건은 각 서비스의 안내를 확인합니다.

## 예제에 적용된 제한

- 질문 한 건 최대 2,000자, 참고 자료 최대 6,000자
- 최근 대화 최대 3회와 새 질문. 자료와 대화를 합쳐 최대 12,000자
- 한 요청 본문 최대 40,000바이트
- 서버에서 고정한 서비스·모델과 출력 토큰 한도
- AI 요청 대기 최대 25초. 오류 후 자동 재시도는 실행하지 않음
- 코드 확인, 같은 사이트 요청 확인, AI 오류 안내, 중복 전송 방지

대화·키·이용 코드를 로그에 기록하는 코드는 포함되어 있지 않습니다. 답변은 글자로 표시하며 HTML로 실행하지 않습니다.

**예산과 전체 요청량은 제공사에서 관리합니다.** 이 시작 예제는 데이터베이스를 사용하지 않으며, 여러 서버 인스턴스에 걸친 요청 횟수·월간 비용을 집계하지 않습니다. 선생님은 공개 체험 전에 팀별 프로젝트·워크스페이스의 지출 한도와 사용 기간을 설정합니다. OpenAI의 강제 지출 한도에는 반영 지연으로 소폭 초과가 발생할 수 있습니다. 체험 종료 시 선생님이 제공사에서 팀의 API 키를 비활성화·회수합니다. 이용 코드를 변경하면 새 배포에 적용합니다.

## 오류 확인

| 앱 안내 | 확인할 설정 |
| --- | --- |
| 이용 코드를 확인해 주세요 | 서버의 `CHAT_ACCESS_CODE`와 입력 코드 |
| 서버의 AI 연결 설정 확인 | 필수 환경변수·모델 ID·이용 코드 형식·출력 토큰 범위·새 배포 적용 여부 |
| AI 서비스의 연결 권한 확인 | 선택한 제공사의 키, 해당 프로젝트·워크스페이스의 권한 |
| AI 서비스의 이용 한도 또는 처리량 확인 | 제공사 대시보드의 비용·요청량 제한과 사용 상태 |
| AI 요청을 완료하지 못함 | 모델 ID·모델 사용 권한·사용 한도와 제공사 상태 |
| 서버 응답 확인 | `api/chat.js`와 `server/chat.js`가 함께 배포되었는지, 실제 Vercel 앱 주소인지 |

## 공식 자료

- [교과서의 챗봇 안내](https://jihyuniee.github.io/hyfl-ai-lab/data/ai-chatbot/)
- [OpenAI 텍스트 생성](https://developers.openai.com/api/docs/guides/text)
- [OpenAI 키와 서버 인증](https://developers.openai.com/api/reference/overview)
- [OpenAI 지출 한도](https://developers.openai.com/api/docs/guides/spend-limits)
- [Claude API 개요](https://platform.claude.com/docs/en/api/overview)
- [Claude 워크스페이스와 사용 한도](https://platform.claude.com/docs/en/manage-claude/workspaces)
- [Vercel Node.js 함수](https://vercel.com/docs/functions/runtimes/node-js)
- [Vercel 빌드 설정](https://vercel.com/docs/builds/configure-a-build)
- [Vercel 환경변수](https://vercel.com/docs/environment-variables)

공식 문서 확인: 2026년 10월 27일. 실제 API 키·모델은 선생님이 확인한 값으로 설정합니다.
