'use strict';
(() => {
  const points = Object.freeze([
    { name: '연습 지점 A', lat: 37.5651, lng: 126.9821 },
    { name: '연습 지점 B', lat: 37.5670, lng: 126.9850 },
    { name: '연습 지점 C', lat: 37.5629, lng: 126.9843 },
  ]);
  const origin = location.origin;
  const message = document.getElementById('message');
  let phase = 'idle';
  let timer;
  let map;
  let bounds;
  let openInfo;
  const markers = [];
  const popups = [];

  function notify(data) {
    if (window.parent !== window) window.parent.postMessage(data, origin);
  }
  function fail(text, code = phase) {
    if (phase === 'failed' || phase === 'ready') return;
    phase = 'failed';
    clearTimeout(timer);
    message.textContent = text;
    message.hidden = false;
    notify({ type: 'map-lab:error', message: text, code });
  }
  function selectPoint(index) {
    if (phase !== 'ready' || !Number.isInteger(index) || index < 0 || index >= points.length) return;
    if (openInfo) openInfo.close();
    map.panTo(markers[index].getPosition());
    popups[index].open(map, markers[index]);
    openInfo = popups[index];
    notify({ type: 'map-lab:selected', index });
  }
  function initialize() {
    if (phase !== 'loading-map') return;
    phase = 'initializing';
    notify({ type: 'map-lab:progress', stage: 'map-init' });
    try {
      const maps = window.kakao?.maps;
      if (!maps || typeof maps.Map !== 'function' || typeof maps.LatLng !== 'function') {
        throw new Error('SDK not ready');
      }
      map = new maps.Map(document.getElementById('map'), {
        center: new maps.LatLng(points[0].lat, points[0].lng), level: 4,
      });
      bounds = new maps.LatLngBounds();
      points.forEach((point, index) => {
        const position = new maps.LatLng(point.lat, point.lng);
        bounds.extend(position);
        const marker = new maps.Marker({ map, position, title: point.name + ' · 가상 위치, 실제 CCTV 아님' });
        const content = document.createElement('div');
        content.className = 'point-info';
        const title = document.createElement('strong');
        title.textContent = point.name;
        const description = document.createElement('span');
        description.textContent = '가상 연습 위치 · 실제 CCTV 아님';
        const coordinates = document.createElement('small');
        coordinates.textContent = '위도 ' + point.lat.toFixed(4) + ' / 경도 ' + point.lng.toFixed(4);
        content.append(title, description, coordinates);
        const popup = new maps.InfoWindow({ content, removable: true });
        markers.push(marker);
        popups.push(popup);
        maps.event.addListener(marker, 'click', () => selectPoint(index));
      });
      map.setBounds(bounds);
      map.addControl(new maps.ZoomControl(), maps.ControlPosition.RIGHT);
      maps.event.addListener(map, 'click', () => { if (openInfo) openInfo.close(); });
      const resize = () => { if (phase === 'ready') map.relayout(); };
      if (typeof ResizeObserver === 'function') {
        new ResizeObserver(resize).observe(document.getElementById('map'));
      } else {
        window.addEventListener('resize', resize);
      }
      clearTimeout(timer);
      phase = 'ready';
      message.hidden = true;
      // SDK initialization does not prove every background tile was loaded.
      notify({ type: 'map-lab:ready', count: markers.length });
    } catch {
      fail('카카오 라이브러리는 준비되었지만 지도를 초기화하지 못했습니다. 실패 단계와 오류 내용을 확인해 주세요.', 'map-init');
    }
  }

  window.addEventListener('message', (event) => {
    if (window.parent === window || event.source !== window.parent || event.origin !== origin) return;
    const data = event.data;
    if (!data || typeof data !== 'object') return;
    if (data.type === 'map-lab:ping') { notify({ type: 'map-lab:booted' }); return; }
    if (data.type === 'map-lab:select') { selectPoint(data.index); return; }
    if (data.type === 'map-lab:fit' && phase === 'ready') {
      if (openInfo) openInfo.close();
      map.setBounds(bounds);
      return;
    }
    if (data.type !== 'map-lab:init' || phase !== 'idle') return;
    const key = typeof data.key === 'string' ? data.key.trim() : '';
    if (!key || /\s/.test(key) || /^YOUR_/i.test(key)) {
      fail('JavaScript 키가 입력되지 않았습니다. 지도 실험실에서 다시 입력해 주세요.', 'key-input');
      return;
    }
    phase = 'loading-script';
    notify({ type: 'map-lab:progress', stage: 'sdk-request' });
    message.textContent = '카카오맵을 연결하고 있어요…';
    timer = setTimeout(() => fail('지도 연결 대기 시간이 지났습니다. 아래에서 실패 단계와 오류 내용을 확인해 주세요.', phase === 'loading-script' ? 'sdk-request' : 'sdk-library'), 18000);
    const sdk = document.createElement('script');
    sdk.async = true;
    sdk.referrerPolicy = 'strict-origin-when-cross-origin';
    sdk.src = 'https://dapi.kakao.com/v2/maps/sdk.js?appkey=' + encodeURIComponent(key) + '&autoload=false';
    sdk.onerror = () => fail('카카오 지도 파일을 받지 못했습니다. 아래의 ‘카카오 오류 내용 열기’를 눌러 자세한 응답을 확인해 주세요.', 'sdk-request');
    sdk.onload = () => {
      if (phase !== 'loading-script') return;
      if (typeof window.kakao?.maps?.load !== 'function') {
        fail('지도 파일의 응답은 받았지만 라이브러리가 준비되지 않았습니다. 아래에서 실패 단계와 오류 내용을 확인해 주세요.', 'sdk-library');
        return;
      }
      phase = 'loading-map';
      notify({ type: 'map-lab:progress', stage: 'sdk-library' });
      try { window.kakao.maps.load(initialize); }
      catch { fail('지도 라이브러리를 시작하지 못했습니다. 실패 단계와 오류 내용을 확인해 주세요.', 'sdk-library'); }
    };
    document.head.appendChild(sdk);
  });
  notify({ type: 'map-lab:booted' });
})();
