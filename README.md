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

<!-- deploy-trigger: 2026-08-27T02:35+09:00 -->
