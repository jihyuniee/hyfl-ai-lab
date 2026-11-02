# GitHub 코드 수정 안내 확인 기록

- 확인일: 2026-11-03 (한국 시간)
- 기준: main `1a599ea5e852507999ead9e2c79e5c14e4dd041a`
- 대상: `src/content/docs/data/github-ai.mdx`
- PR #14 이후 main에서 제거된 미검증 안내를 확인하고, 현재 공식 문서가 뒷받침하는 절차와 파일 직접 반영 경로를 보완했다.
- 이 파일은 교사용 검증 기록이며 웹교과서의 학생용 페이지로 생성되지 않는다.

## 근거와 확인 범위

| 환경 | 공식 문서에서 확인한 내용 | 이번 세션의 실제 확인 범위 |
| --- | --- | --- |
| ChatGPT Work + GitHub | Plugins에서 연결 도구 사용, 사용 가능한 권한에 따라 작업 | 연결된 GitHub 도구로 현재 교과서와 PR #14를 읽었다. 새 연결 설치·권한 승인 화면은 실행하지 않았다. 변경안의 원격 저장 결과는 아래 실제 작업 기록으로 구분한다. |
| 웹 Codex Cloud | 환경 생성, 저장소 선택, Get started, Publish, Start a new task | 공식 문서만 대조. 새 환경 생성·Publish·작업 실행 UI는 재검증하지 않았다. |
| Google AI Studio Build | + → Import from GitHub, 채팅으로 수정, Code 탭, Settings → GitHub에서 기존 저장소 연결 및 push/pull, ZIP 내보내기 | 실제 사이트에 접근했으나 최초 이용 동의 화면에서 중단. GitHub 가져오기·수정·저장은 실행하지 않았다. |
| 일반 Gemini 웹 채팅 | 가져온 코드에 대한 질문·수정 제안. GitHub 쓰기와 이후 저장소 변경 동기화는 지원하지 않음 | 공식 문서만 대조. |
| Claude Code 웹 | GitHub 연결, Default 환경, 저장소·브랜치 선택, Accept edits, Enter, Changes 검토, Create PR | 실제 `/code` 접근 후 로그인 화면으로 이동. 인증 이후 GitHub 연결·수정·브랜치 저장·PR은 실행하지 않았다. |
| 일반 Claude 채팅 | + → Add from GitHub로 파일·폴더를 참고 자료로 추가 | 공식 문서만 대조. 참고 자료 연결만으로 GitHub 저장이 가능하다고 안내하지 않았다. |
| GitHub 파일 직접 반영 | Download raw file, 파일 편집 또는 Add file → Upload files, 커밋/새 브랜치 제안 | 공식 문서만 대조. GitHub 웹 UI로 다운로드·재업로드하는 전체 왕복 실습은 실행하지 않았다. |

AI Studio의 push/pull은 공식 문서에 설명된 작업이다. 이번 브라우저에서는 해당 버튼의 정확한 문구·위치를 관찰하지 못했으므로 학생용 본문에서 미관찰 버튼명을 만들어 쓰지 않았다. 기존 저장소 연결·변경 보내기 기능이 보이지 않거나 새 저장소 만들기만 보이면 파일 직접 반영으로 이어지도록 안내했다. AI Studio에서 어떤 브랜치 선택 UI가 제공되는지도 단정하지 않고 GitHub의 실제 커밋과 브랜치를 확인하게 했다.

계정 연결이 차단된 부분은 성공으로 기록하지 않았다. 로그인이나 최초 이용 동의를 대신 진행하지 않았으며, 학생용 본문에 연령·요금제 설명을 추가하지 않았다.

## 공식 출처

- [ChatGPT Work 시작하기](https://learn.chatgpt.com/docs/get-started-with-work)
- [Plugins](https://learn.chatgpt.com/docs/plugins)
- [Codex Cloud environments](https://learn.chatgpt.com/docs/environments/cloud-environments), Create and publish an environment
- [AI Studio Build](https://aistudio.google.com/docs/aistudio-build-mode), Continue building / How can I use GitHub with my apps?
- [Gemini 웹 앱의 GitHub 가져오기](https://support.google.com/gemini/answer/16176929?hl=ko), Gemini가 GitHub 앱으로 할 수 없는 작업
- [Claude Code 웹 시작하기](https://code.claude.com/docs/en/web-quickstart), Connect GitHub / Start a task / Review and iterate
- [Claude GitHub integration](https://support.claude.com/en/articles/10167454-use-the-github-integration)
- [GitHub 파일 내려받기](https://docs.github.com/en/repositories/working-with-files/using-files/viewing-and-understanding-files)
- [GitHub 파일 올리기](https://docs.github.com/en/repositories/working-with-files/managing-files/adding-a-file-to-a-repository)
- [GitHub 파일 편집](https://docs.github.com/en/repositories/working-with-files/managing-files/editing-files)

## 변경 범위와 검사

- ChatGPT Work(A)·Codex Cloud(B)의 기존 안내를 그대로 보존했다.
- 기존 공통 프롬프트, 지도·데이터·AI 실습 파일과 배포 설정을 변경하지 않았다.
- Gemini Build와 Claude Code의 수정 후 저장 경로, 일반 채팅의 파일 직접 반영 경로를 보완했다.
- `npm run build`: 성공, 정적 페이지 25개 생성.
- `node scripts/verify-copy-prompt.mjs`: 4개 통과.
- `npm run test:maps`: 4개 통과. 가짜 SDK·타이머 검사이며 실제 지도 서비스 인증·타일 표시는 검증하지 않는다.
- `npm run test:chatbot`: 15개 통과. 모의 API 검사이며 실제 AI 제공자 계정 호출은 검증하지 않는다.
- `git diff --check`: 통과.

## 실제 GitHub 작업 기록

변경 브랜치 저장·PR 생성 결과는 이 변경안의 PR에 기록한다. 이는 현재 연결된 ChatGPT Work의 GitHub 도구를 통한 작업이며, AI Studio·Claude Code의 연결 성공 증거로 사용하지 않는다.
