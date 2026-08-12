const LS_RIGHT_TOC = 'ef-toc-right-collapsed';
const LS_LEFT_SIDEBAR = 'ef-sidebar-left-collapsed';
const LS_SIDEBAR_GROUP = 'ef-sidebar-group:';

// ── 오른쪽 TOC 전체 접기 ───────────────────────────────────
function applyRightTocState() {
  const collapsed = localStorage.getItem(LS_RIGHT_TOC) === "1";
  document.documentElement.dataset.efTocCollapsed = collapsed ? "true" : "false";
  document.querySelectorAll(".ef-toc-hamburger").forEach((btn) => {
    btn.setAttribute("aria-expanded", collapsed ? "false" : "true");
    btn.setAttribute("title", collapsed ? "목차 펼치기" : "목차 접기");
    btn.setAttribute("aria-label", collapsed ? "목차 펼치기" : "목차 접기");
  });
}

function toggleRightToc() {
  const cur = localStorage.getItem(LS_RIGHT_TOC) === "1";
  localStorage.setItem(LS_RIGHT_TOC, cur ? "0" : "1");
  applyRightTocState();
}

// ── 왼쪽 사이드바 전체 접기 ────────────────────────────────
function applyLeftSidebarState() {
  const collapsed = localStorage.getItem(LS_LEFT_SIDEBAR) === "1";
  document.documentElement.dataset.efSidebarCollapsed = collapsed ? "true" : "false";
  document.querySelectorAll(".ef-sidebar-hamburger").forEach((btn) => {
    btn.setAttribute("aria-expanded", collapsed ? "false" : "true");
    btn.setAttribute("title", collapsed ? "사이드바 펼치기" : "사이드바 접기");
    btn.setAttribute("aria-label", collapsed ? "사이드바 펼치기" : "사이드바 접기");
  });
}

function toggleLeftSidebar() {
  const cur = localStorage.getItem(LS_LEFT_SIDEBAR) === "1";
  localStorage.setItem(LS_LEFT_SIDEBAR, cur ? "0" : "1");
  applyLeftSidebarState();
}

function injectHamburgerButton() {
  // 오른쪽 TOC 햄버거
  if (!document.querySelector(".ef-toc-hamburger")) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "ef-toc-hamburger";
    btn.setAttribute("aria-controls", "starlight__on-this-page-nav");
    btn.textContent = "\u2630";
    btn.addEventListener("click", (e) => { e.preventDefault(); toggleRightToc(); });
    document.body.appendChild(btn);
  }
  // 왼쪽 사이드바 햄버거
  if (!document.querySelector(".ef-sidebar-hamburger")) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "ef-sidebar-hamburger";
    btn.textContent = "\u2630";
    btn.addEventListener("click", (e) => { e.preventDefault(); toggleLeftSidebar(); });
    document.body.appendChild(btn);
  }
}

// ── 왼쪽 사이드바 그룹 접힘 상태 유지 ───────────────────────
function groupKeyFor(details) {
  // summary 텍스트를 키로 (같은 그룹 라벨이면 모든 페이지에서 동일)
  const summary = details.querySelector("summary");
  const label = (summary?.textContent || "").trim().replace(/\s+/g, " ");
  return LS_SIDEBAR_GROUP + label;
}

function applySidebarState() {
  document.querySelectorAll(".sidebar details, nav.sidebar details").forEach((d) => {
    const key = groupKeyFor(d);
    if (!key) return;
    const saved = localStorage.getItem(key);
    if (saved === "open") d.open = true;
    else if (saved === "closed") d.open = false;
  });
}

function bindSidebarListeners() {
  document.querySelectorAll(".sidebar details, nav.sidebar details").forEach((d) => {
    if (d.dataset.efBound === "1") return;
    d.dataset.efBound = "1";
    d.addEventListener("toggle", () => {
      const key = groupKeyFor(d);
      if (!key) return;
      localStorage.setItem(key, d.open ? "open" : "closed");
    });
  });
}

// ── 초기화 + View Transitions(SPA) 대응 ────────────────────
function init() {
  injectHamburgerButton();
  applyRightTocState();
  applyLeftSidebarState();
  applySidebarState();
  bindSidebarListeners();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Astro View Transitions 사용 시 페이지 전환 후에도 재실행
document.addEventListener('astro:page-load', init);