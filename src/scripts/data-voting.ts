declare global {
  interface Window { google?: { accounts: { id: {
    initialize(options: { client_id: string; callback: (response: { credential: string }) => void; auto_select: boolean }): void;
    renderButton(element: HTMLElement, options: { theme: string; size: string; text: string }): void;
    disableAutoSelect(): void;
  } } } }
}

type Phase = 'preparing' | 'upcoming' | 'open' | 'closed';
interface Status { phase: Phase; startsAt: string | null; endsAt: string | null; resultsExpired?: boolean; results?: { projectId: string; title: string; votes: number }[] }

export async function initVoting() {
  const root = document.querySelector<HTMLElement>('[data-voting-root]');
  if (!root) return;
  const dialog = document.querySelector<HTMLDialogElement>('#data-vote-dialog')!;
  const statusText = root.querySelector<HTMLElement>('[data-vote-status]')!;
  const errorText = dialog.querySelector<HTMLElement>('[data-vote-error]')!;
  const message = dialog.querySelector<HTMLElement>('[data-vote-dialog-message]')!;
  const confirmButton = dialog.querySelector<HTMLButtonElement>('[data-vote-confirm]')!;
  const googleSlot = dialog.querySelector<HTMLElement>('[data-vote-google]')!;
  const logout = root.querySelector<HTMLButtonElement>('[data-vote-logout]')!;
  const buttons = [...document.querySelectorAll<HTMLButtonElement>('[data-vote-project]')];
  let apiBase = '', clientId = '', token = '', choice: string | null = null;
  let pending: HTMLButtonElement | null = null, state: Phase = 'preparing', busy = false;
  let googleReady: Promise<void> | null = null;

  function renderButtons() {
    for (const b of buttons) {
      const selected = b.dataset.voteProject === choice;
      b.disabled = state !== 'open' || busy;
      b.setAttribute('aria-pressed', String(selected));
      b.querySelector('[data-vote-heart]')!.textContent = selected ? '♥' : '♡';
      b.querySelector('[data-vote-label]')!.textContent = state === 'closed' ? '투표 마감' :
        state !== 'open' ? '투표 준비 중' : selected ? '투표 완료' : '이 팀에 투표';
    }
  }
  async function request(path: string, method = 'GET', projectId?: string | null) {
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = 'Bearer ' + token;
    if (method === 'POST') headers['Content-Type'] = 'application/json';
    const response = await fetch(apiBase + path, { method, headers, cache: 'no-store',
      body: method === 'POST' ? JSON.stringify({ projectId }) : undefined, signal: AbortSignal.timeout(12000) });
    const data = await response.json();
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) { token = ''; logout.hidden = true; }
      throw new Error(data.error || '요청을 처리하지 못했습니다.');
    }
    return data;
  }
  async function refreshStatus() {
    const data: Status = await request('/api/ai-data/status');
    state = data.phase;
    const end = data.endsAt ? new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(data.endsAt)) : '';
    statusText.textContent = state === 'open' ? `공감상 투표 진행 중 · ${end} 마감 · 득표수는 마감 후 공개합니다.` :
      state === 'closed' ? '공감상 투표가 마감되었습니다.' : '공감상 투표는 모든 팀의 전시가 준비된 뒤 시작합니다.';
    if (data.resultsExpired) statusText.textContent = '공감상 투표와 결과 공개 기간이 종료되었습니다.';
    if (data.results) {
      const result = root!.querySelector<HTMLElement>('[data-vote-results]')!;
      result.replaceChildren();
      for (const item of [...data.results].sort((a, b) => b.votes - a.votes)) {
        const p = document.createElement('p'); p.textContent = `${item.title} · ${item.votes}표`; result.append(p);
      }
      result.hidden = false;
    }
    renderButtons();
  }
  function confirmChoice() {
    if (!pending) return;
    const cancel = pending.dataset.voteProject === choice;
    message.textContent = cancel ? `${pending.dataset.voteTitle}에 한 투표를 취소할까요?` :
      choice ? `${pending.dataset.voteTitle}로 투표를 변경할까요? 기존 팀의 한 표는 취소됩니다.` : `${pending.dataset.voteTitle}에 투표할까요?`;
    confirmButton.textContent = cancel ? '투표 취소하기' : choice ? '이 팀으로 변경하기' : '이 팀에 투표하기';
    confirmButton.hidden = false; googleSlot.hidden = true;
  }
  function loadGoogle() {
    if (window.google) return Promise.resolve();
    if (!googleReady) googleReady = new Promise<void>((resolve, reject) => {
      const script = document.createElement('script'); script.src = 'https://accounts.google.com/gsi/client'; script.async = true;
      const timer = setTimeout(() => { googleReady = null; reject(new Error('로그인 창을 불러오지 못했습니다. 다시 시도해 주세요.')); }, 12000);
      script.onload = () => { clearTimeout(timer); resolve(); };
      script.onerror = () => { clearTimeout(timer); googleReady = null; reject(new Error('구글 로그인에 연결할 수 없습니다.')); };
      document.head.append(script);
    });
    return googleReady;
  }
  for (const b of buttons) b.addEventListener('click', async () => {
    pending = b; errorText.textContent = ''; confirmButton.hidden = true;
    message.textContent = '학교 구글 계정으로 로그인해 주세요.';
    googleSlot.hidden = Boolean(token); dialog.showModal();
    if (token) { confirmChoice(); return; }
    try {
      await loadGoogle();
      window.google!.accounts.id.initialize({ client_id: clientId, auto_select: false, callback: async response => {
        token = response.credential;
        try {
          const data = await request('/api/ai-data/vote'); choice = data.projectId; state = data.phase;
          logout.hidden = false; renderButtons(); confirmChoice();
        } catch (error) { token = ''; errorText.textContent = (error as Error).message; }
      } });
      googleSlot.replaceChildren();
      window.google!.accounts.id.renderButton(googleSlot, { theme: 'outline', size: 'large', text: 'signin_with' });
    } catch (error) { errorText.textContent = (error as Error).message; }
  });
  confirmButton.addEventListener('click', async () => {
    if (!pending || busy || !token) return;
    busy = true; confirmButton.disabled = true; errorText.textContent = ''; renderButtons();
    try {
      const data = await request('/api/ai-data/vote', 'POST', pending.dataset.voteProject === choice ? null : pending.dataset.voteProject);
      choice = data.projectId; dialog.close();
      statusText.textContent = choice ? '투표가 저장되었습니다. 마감 전까지 다른 팀으로 변경할 수 있습니다.' : '투표를 취소했습니다.';
    } catch (error) { errorText.textContent = (error as Error).message; await refreshStatus().catch(() => {}); }
    finally { busy = false; confirmButton.disabled = false; renderButtons(); }
  });
  dialog.querySelector('[data-vote-close]')!.addEventListener('click', () => dialog.close());
  logout.addEventListener('click', () => {
    token = ''; choice = null; logout.hidden = true; window.google?.accounts.id.disableAutoSelect();
    statusText.textContent = '로그아웃했습니다. 저장된 투표는 유지됩니다.'; renderButtons();
  });
  try {
    const config = await fetch(root.dataset.base + '/exhibition-voting.json', { cache: 'no-store' }).then(r => { if (!r.ok) throw new Error(); return r.json(); });
    if (!config.apiBaseUrl || !config.googleClientId) return;
    const url = new URL(config.apiBaseUrl);
    if (url.protocol !== 'https:') throw new Error();
    apiBase = url.href.replace(/\/$/, ''); clientId = config.googleClientId;
    await refreshStatus();
    window.addEventListener('focus', () => refreshStatus().catch(() => {}));
  } catch { state = 'preparing'; statusText.textContent = '현재 투표에 연결할 수 없습니다. 잠시 후 다시 확인해 주세요.'; renderButtons(); }
}
