type Profile = { name: string; picture: string };
type Viewer = Profile & { isAdmin: boolean };
type Summary = { projectId: string; likes: number; comments: number; liked: boolean; people: Profile[] };
type Comment = { id: string; text: string; createdAt: string; own: boolean; profile: Profile | null; hidden?: boolean; authorEmail?: string | null; parentId?: string | null; replyCount?: number; deleted?: boolean };
type CommentPage = { comments: Comment[]; total: number; nextCursor: string | null };
type PeoplePage = { people: Profile[]; total: number; anonymous: number; nextCursor: string | null };
type Session = { auth: { ready: boolean; clientId: string; schoolDomains: string[]; loginMode?: string }; viewer: Viewer | null; features?: { replies: boolean } };
type GoogleIdentity = { initialize(options: { client_id: string; callback: (response: { credential: string }) => void; auto_select: boolean; hd?: string }): void; renderButton(element: HTMLElement, options: { theme: string; size: string; text: string }): void; disableAutoSelect(): void };
const googleIdentity = () => (window as Window & { google?: { accounts: { id: GoogleIdentity } } }).google?.accounts.id;
const messageOf = (error: unknown) => error instanceof Error && !/fetch|timeout|aborted/i.test(error.message) ? error.message : '반응을 연결하지 못했습니다. 네트워크 연결을 확인하고 다시 시도해 주세요.';

function avatar(profile: Profile | null) {
  const span = document.createElement('span'); span.className = 'community-avatar'; span.setAttribute('aria-hidden', 'true');
  span.textContent = profile?.name.slice(0, 1) || '○';
  if (profile?.picture) {
    // Server only accepts Google-hosted HTTPS images. Do not send this page's URL as a referrer.
    const image = document.createElement('img'); image.src = profile.picture; image.alt = ''; image.referrerPolicy = 'no-referrer'; image.loading = 'lazy';
    image.addEventListener('error', () => image.remove(), { once: true }); span.append(image);
  }
  return span;
}

export function initCommunity() {
  const sessionRoot = document.querySelector<HTMLElement>('[data-community-session]');
  if (!sessionRoot || sessionRoot.dataset.initialized) return;
  sessionRoot.dataset.initialized = 'true';
  const roots = [...document.querySelectorAll<HTMLElement>('[data-community-project]')];
  const loginDialog = document.querySelector<HTMLDialogElement>('[data-community-login-dialog]')!;
  const consentBox = loginDialog.querySelector<HTMLInputElement>('[data-community-consent]')!;
  const googleSlot = loginDialog.querySelector<HTMLElement>('[data-community-google]')!;
  const loginMessage = loginDialog.querySelector<HTMLElement>('[data-community-login-message]')!;
  const sessionNote = sessionRoot.querySelector<HTMLElement>('[data-community-session-note]')!;
  let endpoint = '', token = '', legacy = '', consent = false, connected = false;
  let session: Session = { auth: { ready: false, clientId: '', schoolDomains: [] }, viewer: null };
  let sdk: Promise<void> | null = null, loginTrigger: HTMLElement | null = null;
  const refreshPanels: Array<() => void> = [];
  try { legacy = localStorage.getItem('hyfl-community-visitor-v1') || ''; } catch { /* Browsing and school login do not require localStorage. */ }

  function renderSession() {
    const viewer = session.viewer;
    const account = sessionRoot!.querySelector<HTMLElement>('[data-community-account]')!;
    account.replaceChildren(); account.hidden = !viewer;
    if (viewer) { account.append(avatar(viewer), document.createTextNode(viewer.name)); }
    sessionRoot!.querySelector<HTMLElement>('[data-community-login]')!.hidden = Boolean(viewer);
    sessionRoot!.querySelector<HTMLElement>('[data-community-logout]')!.hidden = !viewer;
    for (const root of roots) {
      root.querySelector<HTMLElement>('[data-community-signin]')!.hidden = Boolean(viewer);
      root.querySelector<HTMLElement>('[data-community-editor]')!.hidden = !viewer;
      root.querySelector<HTMLTextAreaElement>('textarea')!.disabled = !viewer;
      root.querySelector<HTMLButtonElement>('[type=submit]')!.disabled = !viewer || !connected;
      root.querySelector<HTMLButtonElement>('[data-community-like]')!.disabled = !connected;
      root.querySelector<HTMLElement>('[data-community-manage-label]')!.hidden = !viewer?.isAdmin;
      if (!viewer?.isAdmin) root.querySelector<HTMLInputElement>('[data-community-manage]')!.checked = false;
      root.querySelector<HTMLElement>('[data-community-author-note]')!.textContent = `${viewer?.name || ''} · 이름·프로필 공개 · 최대 300자`;
    }
  }
  async function request<T>(method = 'GET', body?: unknown, params?: Record<string, string>): Promise<T> {
    if (!endpoint) throw new Error('좋아요와 댓글을 준비하고 있습니다.');
    const response = await fetch(endpoint + (params ? '?' + new URLSearchParams(params) : ''), {
      method, cache: 'no-store', headers: { ...(token ? { Authorization: 'Bearer ' + token } : {}), ...(legacy ? { 'X-Community-Visitor': legacy } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(20000)
    });
    const result = await response.json();
    if (!response.ok) {
      if (response.status === 401 && token) { token = ''; session.viewer = null; consent = false; consentBox.checked = false; renderSession(); }
      throw new Error(result.error || '반응을 불러오지 못했습니다.');
    }
    return result;
  }
  function update(summary: Summary) {
    for (const root of roots.filter(item => item.dataset.communityProject === summary.projectId)) {
      root.querySelector('[data-community-likes]')!.textContent = String(summary.likes);
      root.querySelector('[data-community-count]')!.textContent = String(summary.comments);
      root.querySelector('[data-community-like]')!.setAttribute('aria-pressed', String(summary.liked));
      const stack = root.querySelector('[data-community-avatars]')!; stack.replaceChildren(...summary.people.slice(0, 4).map(avatar));
      root.querySelector('[data-community-people-label]')!.textContent = summary.likes ? (summary.likes > 4 ? `+${summary.likes - Math.min(4, summary.people.length)} 더 보기` : '좋아요한 사람') : '함께 응원해요';
    }
  }
  async function refreshAll() {
    const requestedToken = token;
    const result = await request<Session & { projects: Summary[] }>();
    if (token !== requestedToken) return;
    session = { auth: result.auth || { ready: false, clientId: '', schoolDomains: [] }, viewer: result.viewer || null, features: result.features };
    result.projects.forEach(update); connected = true; renderSession();
  }
  const ready = (async () => {
    try {
      const base = import.meta.env.BASE_URL.replace(/\/$/, '');
      const config = await fetch(`${base}/exhibition-community.json`, { cache: 'no-store' }).then(response => { if (!response.ok) throw new Error(); return response.json(); });
      const url = new URL(config.apiBaseUrl);
      if (url.protocol !== 'https:' || url.origin !== config.apiBaseUrl) throw new Error();
      endpoint = url.origin + '/api/ai-data/community'; await refreshAll();
    } catch {
      connected = false; renderSession(); sessionNote.textContent = '반응을 연결하지 못했습니다. 새로고침 후 다시 시도해 주세요.';
      roots.forEach(root => { root.querySelector('[data-community-likes]')!.textContent = '—'; root.querySelector('[data-community-count]')!.textContent = '—'; });
    }
  })();
  async function loadGoogle() {
    if (googleIdentity()) return;
    if (!sdk) sdk = new Promise<void>((resolve, reject) => {
      const script = document.createElement('script'); script.src = 'https://accounts.google.com/gsi/client'; script.async = true;
      const timer = setTimeout(() => { script.remove(); sdk = null; reject(new Error('로그인 창을 불러오지 못했습니다. 다시 시도해 주세요.')); }, 12000);
      script.onload = () => { clearTimeout(timer); resolve(); };
      script.onerror = () => { clearTimeout(timer); script.remove(); sdk = null; reject(new Error('구글 로그인에 연결할 수 없습니다.')); };
      document.head.append(script);
    });
    await sdk;
  }
  async function showGoogle() {
    googleSlot.hidden = !consentBox.checked; googleSlot.replaceChildren();
    if (!consentBox.checked) return;
    try {
      await ready;
      if (!session.auth.ready) { googleSlot.hidden = true; loginMessage.textContent = 'Google 로그인 연결을 준비하고 있습니다. 연결 후 참여할 수 있습니다.'; return; }
      loginMessage.textContent = '학교 계정이나 개인 Google 계정을 선택해 주세요.';
      await loadGoogle();
      if (!consentBox.checked || !loginDialog.open) return;
      const identity = googleIdentity()!;
      identity.initialize({ client_id: session.auth.clientId, auto_select: false,
        ...(session.auth.loginMode === 'school' && session.auth.schoolDomains.length === 1 ? { hd: session.auth.schoolDomains[0] } : {}),
        callback: async response => {
          token = response.credential;
          try {
            // The server verifies signature, audience, expiry and verified email (hd in school-only mode).
            const verified = await request<Session>('GET', undefined, { session: 'true' });
            if (!verified.viewer) throw new Error('Google 계정을 확인하지 못했습니다.');
            session = verified; consent = consentBox.checked;
            if (!consent) { token = ''; session.viewer = null; return; }
            await refreshAll(); loginDialog.close(); refreshPanels.forEach(refresh => refresh());
            sessionNote.textContent = '로그인했습니다. 좋아요와 댓글로 작품에 참여해 주세요.';
          } catch (error) { token = ''; session.viewer = null; renderSession(); loginMessage.textContent = messageOf(error); }
        }
      });
      identity.renderButton(googleSlot, { theme: 'outline', size: 'large', text: 'signin_with' });
    } catch (error) { loginMessage.textContent = messageOf(error); }
  }
  function openLogin(trigger?: HTMLElement) {
    loginTrigger = trigger || null; loginMessage.textContent = ''; googleSlot.hidden = true;
    if (!loginDialog.open) loginDialog.showModal();
    if (consentBox.checked) void showGoogle();
  }
  document.querySelectorAll<HTMLElement>('[data-community-login]').forEach(button => button.addEventListener('click', () => openLogin(button)));
  consentBox.addEventListener('change', () => void showGoogle());
  loginDialog.querySelector('[data-community-login-close]')!.addEventListener('click', () => loginDialog.close());
  loginDialog.addEventListener('close', () => loginTrigger?.focus());
  sessionRoot.querySelector('[data-community-logout]')!.addEventListener('click', () => {
    token = ''; session.viewer = null; consent = false; consentBox.checked = false; googleIdentity()?.disableAutoSelect();
    roots.forEach(root => { root.querySelector<HTMLTextAreaElement>('textarea')!.value = ''; });
    renderSession(); refreshPanels.forEach(refresh => refresh());
    sessionNote.textContent = '로그아웃했습니다. 남긴 좋아요와 댓글은 유지됩니다.';
    void refreshAll().catch(() => {});
  });
  for (const root of roots) {
    const projectId = root.dataset.communityProject!;
    const dialog = root.querySelector<HTMLDialogElement>('dialog')!;
    const list = root.querySelector<HTMLElement>('[data-community-comments]')!;
    const form = root.querySelector<HTMLFormElement>('form')!;
    const textarea = root.querySelector<HTMLTextAreaElement>('textarea')!;
    const submit = form.querySelector<HTMLButtonElement>('[type=submit]')!;
    const message = root.querySelector<HTMLElement>('[data-community-form-status]')!;
    const status = root.querySelector<HTMLElement>('[data-community-status]')!;
    const more = root.querySelector<HTMLButtonElement>('[data-community-more]')!;
    const manage = root.querySelector<HTMLInputElement>('[data-community-manage]')!;
    const like = root.querySelector<HTMLButtonElement>('[data-community-like]')!;
    const composeLabel = form.querySelector<HTMLElement>('[data-community-compose-label]')!;
    const cancelReply = form.querySelector<HTMLButtonElement>('[data-community-reply-cancel]')!;
    let replyTarget: { id: string; name: string } | null = null, submitting = false;
    const expanded = new Set<string>();
    const threads = new Map<string, (page?: CommentPage) => Promise<void>>();
    function targetReply(comment: Comment | null) {
      replyTarget = comment ? { id: comment.id, name: comment.profile?.name || '관람객' } : null;
      composeLabel.textContent = replyTarget ? `${replyTarget.name}님에게 답글 남기기` : '댓글 남기기';
      submit.textContent = replyTarget ? '답글 남기기' : '댓글 남기기';
      cancelReply.hidden = !replyTarget;
      textarea.placeholder = replyTarget ? '댓글에 대한 답변이나 이야기를 남겨 주세요.' : '직접 써 보니 이 기능이 좋았어요. 이런 점을 더해 보면 어떨까요?';
    }
    cancelReply.addEventListener('click', () => { targetReply(null); textarea.focus(); });
    let view = 'comments', cursor: string | null = null, loading = false, sequence = 0;
    let trigger: HTMLElement = root.querySelector('[data-community-open]')!;
    function commentItem(comment: Comment) {
        const item = document.createElement('article'); item.className = 'feedback-comment'; item.dataset.hidden = String(Boolean(comment.hidden));
        const content = document.createElement('div'); content.className = 'feedback-comment-content';
        const meta = document.createElement('div'); meta.className = 'feedback-comment-meta';
        const name = document.createElement('strong'); name.textContent = comment.deleted ? '삭제된 댓글' : (comment.profile?.name || '관람객 · 기존 익명 댓글') + (comment.own ? ' · 나' : '');
        const time = document.createElement('time'); time.dateTime = comment.createdAt;
        time.textContent = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(comment.createdAt));
        meta.append(name, time);
        if (manage.checked && session.viewer?.isAdmin) {
          if (!comment.deleted) { const email = document.createElement('span'); email.className = 'feedback-admin-email'; email.textContent = comment.authorEmail || '기존 익명 · 작성자 정보 없음'; meta.append(email); }
          const button = document.createElement('button'); button.type = 'button'; button.textContent = comment.hidden ? '복원' : '숨김';
          button.addEventListener('click', async () => {
            button.disabled = true;
            try { await request('POST', { action: 'moderate', projectId, commentId: comment.id, hidden: !comment.hidden }); await load(false); await refreshAll(); }
            catch (error) { message.textContent = messageOf(error); button.disabled = false; }
          }); meta.append(button);
        } else if (comment.own) {
          const button = document.createElement('button'); button.type = 'button'; button.textContent = '삭제'; button.setAttribute('aria-label', comment.parentId ? '내 답글 삭제' : '내 댓글 삭제');
          button.addEventListener('click', async () => {
            button.disabled = true;
            try { await request('DELETE', { projectId, commentId: comment.id }); await load(false); await refreshAll(); }
            catch (error) { message.textContent = messageOf(error); button.disabled = false; }
          }); meta.append(button);
        }
        const text = document.createElement('p'); text.textContent = comment.text; if (comment.deleted) text.className = 'feedback-deleted';
        content.append(meta, text); item.append(avatar(comment.profile), content); return { item, content };
    }
    function addComments(page: CommentPage) {
      if (!list.childNodes.length && !page.comments.length) { const empty = document.createElement('p'); empty.className = 'feedback-empty'; empty.textContent = '첫 감상을 남겨 주세요.'; list.append(empty); }
      for (const comment of page.comments) {
        const thread = document.createElement('div'); thread.className = 'feedback-thread';
        const { item, content } = commentItem(comment); thread.append(item); list.append(thread);
        if (!session.features?.replies) continue;
        const actions = document.createElement('div'); actions.className = 'feedback-comment-actions'; content.append(actions);
        const replies = document.createElement('div'); replies.className = 'feedback-replies'; replies.hidden = true;
        const entries = document.createElement('div');
        const replyStatus = document.createElement('p'); replyStatus.className = 'feedback-reply-status'; replyStatus.setAttribute('role', 'status');
        const next = document.createElement('button'); next.type = 'button'; next.className = 'feedback-replies-more'; next.textContent = '이전 답글 더 보기'; next.hidden = true;
        replies.append(entries, replyStatus, next); thread.append(replies);
        let replyCursor: string | null = null, replyLoading = false, count = comment.replyCount || 0;
        const toggle = document.createElement('button'); toggle.type = 'button';
        toggle.setAttribute('aria-label', `${comment.profile?.name || '관람객'}님 댓글의 답글 보기`);
        function updateToggle() { toggle.hidden = !count; toggle.textContent = replies.hidden ? `답글 ${count}개 보기` : '답글 접기'; toggle.setAttribute('aria-expanded', String(!replies.hidden)); }
        function renderReplies(page: CommentPage, append = false) {
          if (!append) entries.replaceChildren();
          for (const reply of page.comments) entries.append(commentItem(reply).item);
          replyCursor = page.nextCursor; next.hidden = !replyCursor; count = page.total; updateToggle();
          replyStatus.textContent = count ? '' : '첫 답글을 남겨 주세요.';
        }
        async function loadReplies(append = false, page?: CommentPage) {
          if (replyLoading) return;
          replyLoading = true; next.disabled = true; replyStatus.textContent = '답글을 불러오고 있어요.';
          try {
            const result = page || await request<CommentPage>('GET', undefined, { project: projectId, parent: comment.id,
              ...(append && replyCursor ? { cursor: replyCursor } : {}), ...(manage.checked && session.viewer?.isAdmin ? { manage: 'true' } : {}) });
            if (thread.isConnected) renderReplies(result, append);
          } catch (error) { if (thread.isConnected) replyStatus.textContent = messageOf(error); }
          finally { replyLoading = false; next.disabled = false; }
        }
        threads.set(comment.id, async page => { expanded.add(comment.id); replies.hidden = false; updateToggle();
          if (page) renderReplies(page); else await loadReplies();
        });
        toggle.addEventListener('click', () => {
          replies.hidden = !replies.hidden; updateToggle();
          if (replies.hidden) expanded.delete(comment.id); else { expanded.add(comment.id); void loadReplies(); }
        });
        actions.append(toggle); updateToggle();
        if (!comment.deleted && !comment.hidden) {
          const reply = document.createElement('button'); reply.type = 'button'; reply.textContent = '답글 달기'; reply.setAttribute('aria-label', `${comment.profile?.name || '관람객'}님 댓글에 답글 달기`);
          reply.addEventListener('click', () => { if (submitting) return; targetReply(comment); message.textContent = '';
            if (!session.viewer || !consent) openLogin(reply); else textarea.focus();
          }); actions.prepend(reply);
        }
        next.addEventListener('click', () => { if (replyCursor) void loadReplies(true); });
        if (expanded.has(comment.id)) { replies.hidden = false; updateToggle(); void loadReplies(); }
      }
    }
    function addPeople(page: PeoplePage) {
      if (!list.childNodes.length && !page.total) { const empty = document.createElement('p'); empty.className = 'feedback-empty'; empty.textContent = '이 작품에 첫 좋아요를 남겨 보세요.'; list.append(empty); }
      for (const person of page.people) { const row = document.createElement('div'); row.className = 'feedback-person'; row.append(avatar(person), document.createTextNode(person.name)); list.append(row); }
      if (page.anonymous) { const note = document.createElement('p'); note.className = 'feedback-anonymous'; note.textContent = `이전 익명 좋아요 ${page.anonymous}개는 작성자 정보가 없습니다.`; list.append(note); }
    }
    async function load(append = false) {
      const current = ++sequence; const selectedView = view; loading = true; more.disabled = true;
      if (!append) { cursor = null; list.textContent = '반응을 불러오고 있어요.'; more.hidden = true; }
      try {
        await ready;
        const params: Record<string, string> = { project: projectId, ...(append && cursor ? { cursor } : {}) };
        if (selectedView === 'likes') params.view = 'likes'; else if (manage.checked && session.viewer?.isAdmin) params.manage = 'true';
        const page = await request<CommentPage | PeoplePage>('GET', undefined, params);
        if (current !== sequence) return;
        if (!append) { list.replaceChildren(); threads.clear(); }
        if ('comments' in page) addComments(page); else addPeople(page);
        cursor = page.nextCursor; more.hidden = !cursor; more.textContent = selectedView === 'likes' ? '더 보기' : '이전 댓글 더 보기';
      } catch (error) { if (current === sequence) { if (!append) list.textContent = messageOf(error); else message.textContent = messageOf(error); } }
      finally { if (current === sequence) { loading = false; more.disabled = false; } }
    }
    function setView(next: string) {
      view = next; form.hidden = next !== 'comments';
      root.querySelector('[data-community-prompt]')!.textContent = next === 'likes' ? '이 작품에 좋아요를 남긴 관람객입니다.' : '직접 써 본 소감이나 팀에게 전하고 싶은 제안을 남겨 주세요.';
      root.querySelectorAll<HTMLElement>('[data-community-tab]').forEach(tab => { const selected = tab.dataset.communityTab === next; tab.setAttribute('aria-selected', String(selected)); tab.tabIndex = selected ? 0 : -1; });
      root.querySelector<HTMLElement>('[data-community-manage-label]')!.hidden = next !== 'comments' || !session.viewer?.isAdmin;
      void load(false);
    }
    root.querySelectorAll<HTMLElement>('[data-community-tab]').forEach(tab => {
      tab.addEventListener('click', () => setView(tab.dataset.communityTab!));
      tab.addEventListener('keydown', event => { if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); const next = view === 'comments' ? 'likes' : 'comments'; setView(next); root.querySelector<HTMLElement>(`[data-community-tab=${next}]`)!.focus(); } });
    });
    for (const [selector, next] of [['[data-community-open]', 'comments'], ['[data-community-people]', 'likes']]) root.querySelector<HTMLElement>(selector)!.addEventListener('click', event => {
      trigger = event.currentTarget as HTMLElement; message.textContent = ''; dialog.showModal(); setView(next);
    });
    root.querySelector('[data-community-close]')!.addEventListener('click', () => dialog.close());
    dialog.addEventListener('close', () => { ++sequence; loading = false; if (!textarea.value.trim()) targetReply(null); trigger.focus(); });
    dialog.addEventListener('click', event => { if (event.target !== dialog) return; const rect = dialog.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close(); });
    more.addEventListener('click', () => { if (!loading && cursor) void load(true); });
    manage.addEventListener('change', () => void load(false));
    refreshPanels.push(() => { if (dialog.open) setView(view); });
    like.addEventListener('click', async () => {
      if (!session.viewer || !consent) { openLogin(like); return; }
      like.disabled = true; status.textContent = '';
      try { update(await request<Summary>('POST', { action: 'like', projectId, liked: like.getAttribute('aria-pressed') !== 'true', profileConsent: consent })); if (dialog.open && view === 'likes') await load(false); }
      catch (error) { status.textContent = messageOf(error); }
      finally { like.disabled = !connected; }
    });
    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (submitting) return;
      if (!session.viewer || !consent) { openLogin(submit); return; }
      if (!textarea.value.trim()) { message.textContent = '댓글을 입력해 주세요.'; return; }
      const target = replyTarget;
      submitting = true; submit.disabled = true; cancelReply.disabled = true; textarea.readOnly = true; message.textContent = target ? '답글을 저장하고 있어요.' : '댓글을 저장하고 있어요.';
      try {
        const page = await request<CommentPage>('POST', { action: 'comment', projectId, text: textarea.value, profileConsent: consent, ...(target ? { parentId: target.id } : {}) });
        textarea.value = ''; targetReply(null);
        if (target && threads.has(target.id)) await threads.get(target.id)!(page); else await load(false);
        await refreshAll(); message.textContent = target ? '답글을 남겼습니다.' : '댓글을 남겼습니다.';
      }
      catch (error) { message.textContent = messageOf(error); }
      finally { submitting = false; submit.disabled = !session.viewer || !connected; cancelReply.disabled = false; textarea.readOnly = false; }
    });
  }
}
