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

### 번외 · 카카오맵 띄우기

교과서 홈, 사이드바의 ‘번외 · 선택 실습’, 8단원 구현 안내에서 `/data/map-lab/`로 이동합니다. 필수 과제가 아닌 선택 실습입니다. 첫 목표는 공개 실습창 `/labs/kakao-map/`에서 학생이 자기 JavaScript 키를 입력해 지도와 가상 지점 3개를 확인하는 것입니다. 카카오맵 사용 설정 ON, JavaScript SDK 도메인, 실제 도로·지명·마커·출처 확인을 안내합니다.

첫 실습의 등록 도메인은 `https://jihyuniee.github.io`이며, 자기 팀 웹앱으로 옮길 때 그 호스트를 추가 등록합니다. 실습창은 `public/labs/kakao-map/`의 정적 파일로 제공하고 ChatGPT 로그인이나 교사의 키가 필요하지 않습니다. 키는 실행 중 브라우저에서 Kakao에 전달하며 저장소·서버·localStorage에 저장하지 않습니다. 실패 시 Kakao 응답을 새 탭에서 열어 확인하고, 붙여 넣은 오류에서 키를 가린 복사 내용을 만듭니다.

자기 팀 웹앱용 단일 HTML은 `public/templates/maps/kakao-map-practice.html`, 본문은 `src/content/docs/data/map-lab.mdx`에 있습니다. 좌표 연습, 실제 CSV 연결 프롬프트, 원자료 3행 검증은 선택 확장입니다. 기존 활동지에 구현·검증·AI 활용 기록을 이어 씁니다. 지도 제공자의 로고·출처를 유지하고 이용 조건은 본문의 공식 문서에서 확인합니다.

`npm run test:maps`는 내려받을 HTML의 초기화·마커 클릭·실패 처리를 SDK 어댑터로 검사합니다. 공개 실습창은 같은 SDK와 키 입력·새 실행 문맥·오류 가림 구조를 사용합니다. 실제 지도 인증과 외부 타일 응답은 등록된 실행 주소에서 별도로 확인합니다.

<!-- deploy-trigger: 2026-08-27T02:35+09:00 -->
