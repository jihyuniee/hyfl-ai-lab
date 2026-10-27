# HYFL AI Lab

한영외국어고등학교 2학년 「인공지능 원리탐구」 학생용 웹 교재입니다. 설명식 교과서가 아니라, "개념을 이해한다 → 바로 해본다 → 실패한다 → 왜 그런지 생각한다 → 필요한 이론을 다시 배운다 → 개선한다"는 흐름으로 설계된 **AI Lab Book**입니다.

🔗 배포된 사이트: https://jihyuniee.github.io/hyfl-ai-lab/

## 개발

```bash
npm install
npm run dev       # 로컬 개발 서버
npm run build     # 정적 사이트 빌드 (dist/)
npm run preview   # 빌드 결과 미리보기
```

## 구조

```
src/
  content/docs/    # 모든 페이지 콘텐츠 (Markdown/MDX)
    part1/ part2/ part3/ part6/ part7/   # 이론 챕터
    project1.mdx project2.mdx project3.mdx  # 3개 Project Lab
    teacher/         # 교사용 페이지
  components/        # Hero, Callout, Steps, FlowDiagram, ProjectCard 등 공통 컴포넌트
  styles/custom.css  # 디자인 시스템 (색상 토큰, 다크/라이트 모드, 반응형, 프린트)
astro.config.mjs     # Starlight 사이드바 및 사이트 설정
.github/workflows/deploy.yml  # main 브랜치 push 시 자동 빌드 후 gh-pages 배포
```

## 배포 방식

`main` 브랜치에 푸시되면 GitHub Actions가 자동으로 빌드하고 `dist/` 결과물을 `gh-pages` 브랜치로 배포합니다. `gh-pages` 브랜치를 직접 수정하지 않습니다. Base path는 `/hyfl-ai-lab/`으로 고정되어 있습니다 (`astro.config.mjs`의 `base` 값을 바꾸지 마세요 — 공개 URL이 깨집니다).

## 콘텐츠 구조

7개 Part + 3개 Project Lab으로 구성됩니다. 자세한 커리큘럼 설계와 차시 운영안은 사이트 내 [교사용 · 수업 운영 가이드](https://jihyuniee.github.io/hyfl-ai-lab/teacher/guide/)를 참고하세요.

### 번외 · 내 프로젝트에 카카오맵 넣기

교과서 홈, 사이드바의 ‘번외 · 선택 실습’, 8단원 구현 안내에서 `/data/map-lab/`로 이동합니다. 지도 기능이 필요한 팀을 위한 선택 실습이며, 결과물은 학생이 만든 `index.html` 또는 기존 프로젝트 안에서 작동하는 지도입니다. 처음 만드는 팀은 시작 HTML을 내려받고, 기존 프로젝트가 있는 팀은 현재 기능과 파일 구조를 유지하며 지도 코드를 추가하는 프롬프트를 사용합니다.

파일 준비 → 키 자리표시자로 자기 웹앱 주소 확보 → 같은 카카오 앱의 지도 사용 설정 ON·JavaScript 키 SDK 도메인 등록 → 코드의 키 한 줄 교체 → 같은 주소에 재배포 → 지도·마커·기존 기능 검증 순서입니다. 등록할 도메인은 학생 본인의 실제 배포 호스트입니다. 교과서 호스트를 공통 등록값으로 안내하지 않습니다. 예전 `/labs/kakao-map/` 주소는 새 교과서 안내로 이동합니다.

자기 팀 웹앱용 단일 HTML은 `public/templates/maps/kakao-map-practice.html`, 본문은 `src/content/docs/data/map-lab.mdx`, 신규·기존 프로젝트와 오류 수정·공공데이터 연결 프롬프트는 `src/content/prompts/map-lab.mjs`에 있습니다. 가상 지점은 지도 연결 점검용이며, 이후 각 팀이 선택한 공공데이터를 기존 CSV·JSON·데이터 배열·API 등의 방식으로 연결합니다. 자료의 주제와 표시 항목을 특정하지 않고 실제 필드·좌표계·기록 단위·출처를 확인하게 합니다. 원자료 3건과 결과를 대조하고 기존 활동지에 구현·검증·AI 활용 기록을 이어 씁니다. 지도 제공자의 로고·출처를 유지하고 이용 조건은 본문의 공식 문서에서 확인합니다.

`npm run test:maps`는 내려받을 HTML의 초기화·마커 클릭·실패 처리를 SDK 어댑터로 검사합니다. 실제 지도 인증과 외부 타일 응답은 학생이 등록한 자기 웹앱 주소에서 별도로 확인합니다. 안내와 예제에는 실제 키를 포함하지 않습니다.

### 참고 · GitHub의 내 코드를 GPT와 수정하기

`/data/github-ai/`는 연결 기능을 사용할 수 있는 팀을 위한 선택 참고 자료입니다. 처음 프로젝트를 올린 뒤 권한을 허용한 AI 환경에서 같은 저장소의 최신 파일을 읽고 수정하며, 변경 내역·커밋 또는 PR을 확인하고 배포 브랜치에 반영한 뒤 같은 웹앱 주소에서 검증하는 흐름을 안내합니다. 기존 프로젝트의 구조·기능과 팀이 선택한 자료를 유지합니다.

본문은 `src/content/docs/data/github-ai.mdx`, 요청문은 `src/content/prompts/github-ai.mjs`에 있습니다. 교과서 홈과 사이드바, DATA TO WEB APP 구현 안내, 지도 실습, School Image Lab의 배포 안내에서 연결합니다. 원고는 준비물, 연결 절차, 수정·저장·배포, 검증 기준과 공식 근거로 구성합니다. 계정별 기능과 이용 조건은 연결 화면과 공식 문서에서 확인합니다.

<!-- deploy-trigger: 2026-08-27T02:35+09:00 -->
