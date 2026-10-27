'use strict';
(() => {
  const $ = (id) => document.getElementById(id);
  const keyInput = $('key');
  const domainInput = $('domain');
  const form = $('connect-form');
  const connectButton = $('connect-button');
  const mapHost = $('map-host');
  const placeholder = $('map-placeholder');
  const pointButtons = Array.from(document.querySelectorAll('[data-point]'));
  const supported = location.protocol === 'https:' || location.protocol === 'http:';
  const origin = supported ? location.origin : '';
  const diagnostics = window.MapLabDiagnostics;
  let activeFrame = null;
  let activeAttempt = 0;
  let activeKey = '';
  let frameBooted = false;
  let stage = 'frame-boot';
  let failureCode = '';
  let timeout = null;
  let phase = 'idle';

  domainInput.value = origin || '이 실습 페이지는 웹 주소에서 열어 주세요';
  $('copy-domain').disabled = !supported;

  function feedback(text) {
    $('form-feedback').textContent = text;
    $('form-feedback').hidden = !text;
  }

  function setState(state, message) {
    phase = state;
    $('map-stage').dataset.state = state;
    $('map-status').dataset.state = state;
    $('status-text').textContent = message;
    connectButton.disabled = state === 'loading';
    $('connect-label').textContent = state === 'loading' ? '지도 연결 중…' : state === 'ready' ? '다시 연결하기' : '지도 띄우기';
    $('fit-map').disabled = state !== 'ready';
    pointButtons.forEach((button) => { button.disabled = state !== 'ready'; });
    $('loading-spinner').hidden = state !== 'loading';
    $('placeholder-art').hidden = state === 'loading' || state === 'error';
    $('placeholder-badge').hidden = state === 'loading' || state === 'error';
    placeholder.dataset.state = state;
    placeholder.hidden = state === 'ready';
  }

  function fail(message, code = stage) {
    if (phase !== 'loading') return;
    clearTimeout(timeout);
    failureCode = code;
    setState('error', '연결이 멈춘 단계를 확인해 주세요');
    $('placeholder-kicker').textContent = 'LET’S CHECK THE SETTINGS';
    $('placeholder-title').textContent = '지도 연결을 완료하지 못했어요';
    $('placeholder-text').textContent = diagnostics.redact(message, activeKey);
    $('map-caption').textContent = '오류 내용을 확인한 뒤 다시 연결해 주세요. 연결되면 세 지점을 눌러 볼 수 있어요.';
    const stageNames = { 'frame-boot': '실습 화면 준비', 'sdk-request': '카카오 지도 파일 요청', 'sdk-library': '지도 라이브러리 준비', 'map-init': '지도 초기화' };
    $('diagnostic-stage').textContent = stageNames[stage] || '지도 연결';
    const canOpenResponse = code === 'sdk-request';
    const responseLink = $('open-kakao-error');
    responseLink.hidden = !canOpenResponse;
    if (canOpenResponse) {
      responseLink.href = 'https://dapi.kakao.com/v2/maps/sdk.js?appkey=' + encodeURIComponent(activeKey) + '&autoload=false';
      $('diagnostic-description').textContent = '아래 버튼을 누르면 카카오의 응답이 새 탭에 열립니다. 그곳의 message 문구를 복사해 아래에 붙여 넣어 주세요.';
    } else {
      responseLink.removeAttribute('href');
      $('diagnostic-description').textContent = stage === 'frame-boot' ? '실습 화면의 프로그램이 준비되지 않았습니다. 이 단계는 카카오 키 확인 전입니다. 아래에서 키 없이 오류를 복사해 보내 주세요.' : '실패한 단계가 아래 복사 내용에 포함됩니다. 브라우저에 별도의 오류 문구가 보인다면 함께 붙여 넣어 주세요.';
    }
    $('response-privacy').hidden = !canOpenResponse;
    $('diagnostic-panel').hidden = false;
    feedback('지도 아래의 ‘오류 확인’ 영역에서 자세한 응답을 확인할 수 있어요.');
    $('troubleshooting').open = true;
  }

  $('kakao-response').addEventListener('input', () => {
    const input = $('kakao-response');
    const safe = diagnostics.redact(input.value, activeKey);
    if (input.value !== safe) input.value = safe;
    const result = diagnostics.classify(safe, activeKey);
    $('diagnosis-result').hidden = !result;
    $('diagnostic-copy-fallback').hidden = true;
    $('diagnostic-feedback').textContent = '';
    if (result) {
      $('diagnosis-title').textContent = result.title;
      $('diagnosis-action').textContent = result.action;
    }
  });

  $('copy-diagnostic').addEventListener('click', async () => {
    const text = diagnostics.report({ origin, stage, code: failureCode, response: $('kakao-response').value, key: activeKey });
    try {
      if (!navigator.clipboard?.writeText) throw new Error('clipboard unavailable');
      await navigator.clipboard.writeText(text);
      $('diagnostic-feedback').textContent = '키 값을 가린 오류 내용을 복사했어요. 이 내용을 대화에 붙여 넣어 주세요.';
    } catch {
      const fallback = $('diagnostic-copy-fallback');
      fallback.value = text;
      fallback.hidden = false;
      fallback.focus();
      fallback.select();
      $('diagnostic-feedback').textContent = '키 값을 가린 내용을 선택했어요. 직접 복사해 주세요.';
    }
  });

  $('copy-domain').addEventListener('click', async () => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('clipboard unavailable');
      await navigator.clipboard.writeText(origin);
      $('domain-feedback').textContent = '복사했어요. JavaScript SDK 도메인에 붙여 넣으세요.';
    } catch {
      domainInput.focus();
      domainInput.select();
      $('domain-feedback').textContent = '주소를 선택했어요. 직접 복사해 주세요.';
    }
  });

  $('toggle-key').addEventListener('click', () => {
    const show = keyInput.type === 'password';
    keyInput.type = show ? 'text' : 'password';
    $('toggle-key').textContent = show ? '숨김' : '보기';
    $('toggle-key').setAttribute('aria-pressed', String(show));
    $('toggle-key').setAttribute('aria-label', show ? '키 숨기기' : '키 표시');
  });
  keyInput.addEventListener('input', () => {
    keyInput.removeAttribute('aria-invalid');
    feedback('');
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (phase === 'loading') return;
    const key = keyInput.value.trim();
    if (!key || /\s/.test(key) || /^YOUR_/i.test(key)) {
      keyInput.setAttribute('aria-invalid', 'true');
      feedback(!key ? 'JavaScript 키를 먼저 입력해 주세요.' : '키 전체를 공백 없이 붙여 넣어 주세요.');
      keyInput.focus();
      return;
    }
    if (!supported) {
      feedback('이 실습 페이지는 http 또는 https 웹 주소에서 실행하도록 만들었습니다. 배포된 페이지를 열어 주세요.');
      return;
    }
    feedback('');
    activeKey = key;
    frameBooted = false;
    stage = 'frame-boot';
    failureCode = '';
    $('diagnostic-panel').hidden = true;
    $('kakao-response').value = '';
    $('diagnosis-result').hidden = true;
    $('diagnostic-feedback').textContent = '';
    $('diagnostic-copy-fallback').hidden = true;
    $('open-kakao-error').removeAttribute('href');
    keyInput.removeAttribute('aria-invalid');
    keyInput.type = 'password';
    $('toggle-key').textContent = '보기';
    $('toggle-key').setAttribute('aria-pressed', 'false');
    $('toggle-key').setAttribute('aria-label', '키 표시');
    pointButtons.forEach((button) => button.setAttribute('aria-pressed', 'false'));
    $('map-caption').textContent = '카카오맵을 불러오는 중입니다. 잠시 기다려 주세요.';
    $('placeholder-kicker').textContent = 'CONNECTING YOUR MAP';
    $('placeholder-title').textContent = '우리 동네 지도로 가는 중…';
    $('placeholder-text').textContent = '입력한 키로 카카오맵에 연결하고 있어요.';
    setState('loading', '실습 화면을 준비하고 있어요');
    clearTimeout(timeout);
    const attempt = ++activeAttempt;
    const frame = document.createElement('iframe');
    frame.title = '카카오맵 · 가상 연습 지점 3곳';
    frame.referrerPolicy = 'strict-origin-when-cross-origin';
    // A fresh same-origin document gives each key a fresh Kakao SDK context.
    // The key never appears in this frame URL, our server request, or storage.
    frame.src = new URL('./map.html?rev=2', location.href).href;
    frame.addEventListener('load', () => {
      if (attempt !== activeAttempt || phase !== 'loading') return;
      // Confirm that our runtime has booted; a login/error page can also fire load.
      if (!frameBooted) frame.contentWindow.postMessage({ type: 'map-lab:ping' }, origin);
    }, { once: true });
    frame.addEventListener('error', () => {
      if (attempt === activeAttempt) fail('실습 화면을 불러오지 못했습니다. 페이지를 새로고침한 뒤 다시 시도해 주세요.', 'frame-boot');
    }, { once: true });
    activeFrame = frame;
    mapHost.replaceChildren(frame);
    timeout = setTimeout(() => {
      if (attempt === activeAttempt) fail(frameBooted ? '카카오 지도 연결 대기 시간이 지났습니다. 아래에서 실패한 단계와 오류 내용을 확인해 주세요.' : '실습 화면의 프로그램이 준비되지 않았습니다. 페이지를 새로고침한 뒤 다시 시도해 주세요.', stage);
    }, 20000);
  });

  window.addEventListener('message', (event) => {
    if (!activeFrame || event.source !== activeFrame.contentWindow || event.origin !== origin) return;
    const data = event.data;
    if (!data || typeof data !== 'object') return;
    if (data.type === 'map-lab:booted' && phase === 'loading' && !frameBooted) {
      frameBooted = true;
      stage = 'sdk-request';
      $('status-text').textContent = '카카오 지도 파일을 요청하고 있어요';
      activeFrame.contentWindow.postMessage({ type: 'map-lab:init', key: activeKey }, origin);
    } else if (data.type === 'map-lab:progress' && phase === 'loading' && frameBooted) {
      const labels = { 'sdk-request': '카카오 지도 파일을 요청하고 있어요', 'sdk-library': '지도 라이브러리를 준비하고 있어요', 'map-init': '지도와 연습 지점을 만들고 있어요' };
      if (Object.hasOwn(labels, data.stage)) {
        stage = data.stage;
        $('status-text').textContent = labels[data.stage];
      }
    } else if (data.type === 'map-lab:ready' && phase === 'loading' && frameBooted) {
      clearTimeout(timeout);
      setState('ready', '지도 초기화 완료 · 배경을 확인해 주세요');
      $('map-caption').textContent = '연습 지점 3개를 배치했어요. 도로와 지명이 보이는지 확인한 뒤 지점을 눌러 보세요.';
    } else if (data.type === 'map-lab:error' && phase === 'loading') {
      fail(typeof data.message === 'string' ? data.message : '지도 연결을 완료하지 못했습니다. 오류 내용을 확인해 주세요.', typeof data.code === 'string' ? data.code : stage);
    } else if (data.type === 'map-lab:selected' && phase === 'ready' && Number.isInteger(data.index)) {
      pointButtons.forEach((button) => button.setAttribute('aria-pressed', String(Number(button.dataset.point) === data.index)));
    }
  });

  $('fit-map').addEventListener('click', () => {
    if (phase !== 'ready' || !activeFrame) return;
    activeFrame.contentWindow.postMessage({ type: 'map-lab:fit' }, origin);
    pointButtons.forEach((button) => button.setAttribute('aria-pressed', 'false'));
  });
  pointButtons.forEach((button) => button.addEventListener('click', () => {
    if (phase !== 'ready' || !activeFrame) return;
    activeFrame.contentWindow.postMessage({ type: 'map-lab:select', index: Number(button.dataset.point) }, origin);
  }));
})();
