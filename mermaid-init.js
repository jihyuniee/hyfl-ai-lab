import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs';

function transformMermaidBlocks() {
  // 우선순위: 1) Markdown 단계에서 치환된 pre.mermaid (줄바꿈 보존됨)
  //          2) Shiki가 처리한 pre[data-language="mermaid"] (fallback)
  const primaryBlocks = document.querySelectorAll("pre.mermaid");
  const shikiBlocks = document.querySelectorAll('pre[data-language="mermaid"], pre > code.language-mermaid');
  const blocks = new Set([...primaryBlocks, ...shikiBlocks]);
  let index = 0;
  for (const el of blocks) {
    const pre = el.tagName === "PRE" ? el : (el.closest("pre") || el);
    // 원본 텍스트 추출 — pre.mermaid는 textContent에 줄바꿈 보존
    const src = pre.textContent || "";
    if (!src.trim()) continue;
    const div = document.createElement("div");
    div.className = "mermaid ef-mermaid";
    div.id = `mermaid-${index++}`;
    div.textContent = src;
    pre.replaceWith(div);
  }
}

function isDark() {
  return document.documentElement.dataset.theme === 'dark';
}

function initMermaid() {
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: "loose",
    theme: isDark() ? "dark" : "default",
    themeVariables: {
      fontFamily: "Pretendard Variable, Pretendard, system-ui, sans-serif",
      fontSize: "14px",
    },
    flowchart: { htmlLabels: true, curve: "basis" },
  });
}

async function renderAll() {
  transformMermaidBlocks();
  initMermaid();
  try {
    await mermaid.run({ querySelector: ".ef-mermaid" });
  } catch (err) {
    console.error("[mermaid] render failed:", err);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', renderAll);
} else {
  renderAll();
}

// 다크모드 토글 감지 — 전체 다시 렌더링
new MutationObserver(() => {
  const existing = document.querySelectorAll(".ef-mermaid");
  if (existing.length === 0) return;
  // 이미 렌더된 SVG를 다시 코드로 복원하는 건 복잡 → 페이지 새로고침 권장
}).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });