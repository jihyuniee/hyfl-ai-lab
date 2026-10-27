import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

// Run with: node scripts/verify-map-starters.mjs
// Execute the actual downloadable HTML with delayed SDK callbacks and fake timers.
// No provider request is sent. Real keys, authentication, tiles and layout are not verified.

function runStarter({ javascriptKey, protocol = 'https:', replaceAllKeys = false } = {}) {
  let html = readFileSync(new URL('../public/templates/maps/kakao-map-practice.html', import.meta.url), 'utf8');
  if (replaceAllKeys && javascriptKey !== undefined) html = html.replaceAll('YOUR_JAVASCRIPT_KEY', javascriptKey);
  let scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)]
    .filter(([, attributes, code]) => !/\bsrc\s*=/i.test(attributes) && code.trim())
    .map(([, , code]) => code);
  assert.equal(scripts.length, 1);
  if (!replaceAllKeys && javascriptKey !== undefined) {
    scripts = scripts.map(code => code.replace(/const javascriptKey\s*=\s*'YOUR_JAVASCRIPT_KEY'/, `const javascriptKey = ${JSON.stringify(javascriptKey)}`));
  }

  const nodes = new Map();
  const element = tagName => ({
    tagName, children: [], textContent: '',
    append(...children) { this.children.push(...children); },
    set innerHTML(value) { throw new Error('Example data must be inserted as text, not HTML'); },
  });
  const document = {
    head: element('head'),
    createElement: element,
    getElementById(id) {
      assert(['status', 'map', 'point-list'].includes(id), `Unexpected element ${id}`);
      if (!nodes.has(id)) nodes.set(id, element('div'));
      return nodes.get(id);
    },
  };
  const timers = new Map();
  let nextTimer = 0;
  const context = vm.createContext({
    document, location: { protocol }, encodeURIComponent,
    setTimeout(callback, delay) { const id = ++nextTimer; timers.set(id, { callback, delay }); return id; },
    clearTimeout(id) { timers.delete(id); },
  });
  context.window = context;
  const mapInstances = [], markers = [], popups = [], readyCallbacks = [];
  const runtime = {
    LatLng: class { constructor(lat, lng) { this.lat = lat; this.lng = lng; } },
    Map: class { constructor(container, options) { this.container = container; this.options = options; mapInstances.push(this); } },
    Marker: class { constructor(options) { this.options = options; this.events = {}; markers.push(this); } },
    InfoWindow: class {
      constructor(options) { this.content = options.content; this.removable = options.removable; popups.push(this); }
      open(map, marker) { this.map = map; this.marker = marker; this.opened = true; }
    },
    event: { addListener(target, event, handler) { target.events[event] = handler; } },
  };
  for (const code of scripts) new vm.Script(code).runInContext(context, { timeout: 1000 });

  const requestedScripts = () => document.head.children.filter(node => node.tagName === 'script');
  return {
    context, document, nodes, timers, mapInstances, markers, popups, readyCallbacks,
    scripts: requestedScripts,
    status: () => nodes.get('status').textContent,
    points: () => nodes.get('point-list').children.map(node => node.textContent),
    loadScript({ missingLoader = false } = {}) {
      // Only the loader exists after sdk.js; map classes appear when maps.load finishes.
      context.kakao = { maps: missingLoader ? {} : { load(callback) { readyCallbacks.push(callback); } } };
      requestedScripts()[0].onload();
    },
    finishLibrary({ missingMap = false } = {}) {
      Object.assign(context.kakao.maps, runtime);
      if (missingMap) delete context.kakao.maps.Map;
      readyCallbacks.forEach(callback => callback());
    },
    fireTimeouts() {
      for (const [id, { callback }] of [...timers]) { timers.delete(id); callback(); }
    },
  };
}

test('Kakao waits for maps.load, initializes once, and each fictional marker opens its own text info window', () => {
  const app = runStarter({ javascriptKey: 'synthetic-browser-key', replaceAllKeys: true });
  assert.equal(app.scripts().length, 1);
  const request = new URL(app.scripts()[0].src);
  assert.equal(request.origin, 'https://dapi.kakao.com');
  assert.equal(request.pathname, '/v2/maps/sdk.js');
  assert.equal(request.searchParams.get('appkey'), 'synthetic-browser-key');
  assert.equal(request.searchParams.get('autoload'), 'false');
  assert.equal(request.searchParams.get('libraries'), null);
  assert.equal(app.mapInstances.length, 0);
  app.loadScript();
  assert.equal(app.readyCallbacks.length, 1);
  assert.equal(app.mapInstances.length, 0, 'SDK script load is not library readiness');
  app.scripts()[0].onload();
  assert.equal(app.readyCallbacks.length, 1, 'Duplicate onload must not queue another initialization');
  app.finishLibrary();
  assert.equal(app.mapInstances.length, 1);
  assert.deepEqual(app.markers.map(marker => [marker.options.position.lat, marker.options.position.lng]), [
    [37.5651, 126.9821], [37.5670, 126.9850], [37.5629, 126.9843],
  ]);
  assert.equal(app.points().length, 3);
  assert(app.points().every(text => /가상.*실제 CCTV 아님/.test(text)));
  assert.equal(app.popups.length, 3);
  for (let index = 0; index < 3; index++) {
    const marker = app.markers[index], popup = app.popups[index];
    assert.match(marker.options.title, /가상.*실제 CCTV 아님/);
    assert.match(popup.content.textContent, /가상.*실제 CCTV 아님/);
    assert.equal(popup.content.tagName, 'div');
    assert.equal(popup.opened, undefined);
    marker.events.click();
    assert.equal(popup.opened, true);
    assert.equal(popup.marker, marker);
    assert.equal(popup.map, app.mapInstances[0]);
  }
  assert.match(app.status(), /직접 확인/);
  assert.match(app.status(), /SDK 준비만으로.*확인한 것은 아닙니다/);
  assert.equal(app.timers.size, 0);
  app.finishLibrary();
  app.fireTimeouts();
  assert.equal(app.mapInstances.length, 1);
  assert.equal(app.markers.length, 3);
});

test('missing or placeholder keys and file protocol retain the text list without requesting the SDK', () => {
  for (const javascriptKey of [undefined, '', '   ', 'YOUR_JAVASCRIPT_KEY', 'your_example_key']) {
    const app = runStarter({ javascriptKey });
    assert.equal(app.scripts().length, 0);
    assert.equal(app.mapInstances.length, 0);
    assert.equal(app.timers.size, 0);
    assert.equal(app.points().length, 3);
    assert.match(app.status(), /JavaScript 키.*넣지 않았/);
  }
  for (const protocol of ['file:', 'data:']) {
    const app = runStarter({ javascriptKey: 'synthetic-browser-key', protocol });
    assert.equal(app.document.head.children.length, 0);
    assert.equal(app.timers.size, 0);
    assert.equal(app.points().length, 3);
    assert.match(app.status(), /시작 예제.*웹 서버/);
    assert.match(app.status(), /localhost.*HTTPS/);
  }
  assert.equal(runStarter({ javascriptKey: 'synthetic-browser-key', protocol: 'http:' }).scripts().length, 1);
});

test('SDK request errors and missing loader or map classes produce honest failures', () => {
  const failedRequest = runStarter({ javascriptKey: 'synthetic-browser-key' });
  failedRequest.scripts()[0].onerror();
  assert.match(failedRequest.status(), /SDK를 불러오지 못/);
  assert.equal(failedRequest.timers.size, 0);
  const failure = failedRequest.status();
  failedRequest.loadScript();
  failedRequest.finishLibrary();
  assert.equal(failedRequest.mapInstances.length, 0);
  assert.equal(failedRequest.status(), failure);

  const missingLoader = runStarter({ javascriptKey: 'synthetic-browser-key' });
  missingLoader.loadScript({ missingLoader: true });
  assert.match(missingLoader.status(), /라이브러리를 준비하지 못/);
  assert.equal(missingLoader.timers.size, 0);
  assert.equal(missingLoader.mapInstances.length, 0);

  const missingMap = runStarter({ javascriptKey: 'synthetic-browser-key' });
  missingMap.loadScript();
  missingMap.finishLibrary({ missingMap: true });
  assert.match(missingMap.status(), /초기화에 실패/);
  assert.equal(missingMap.markers.length, 0);
  assert.equal(missingMap.timers.size, 0);
});

test('timeouts cover both SDK script and asynchronous library load, and late callbacks cannot report success', () => {
  for (const phase of ['script', 'library']) {
    const app = runStarter({ javascriptKey: 'synthetic-browser-key' });
    if (phase === 'library') app.loadScript();
    assert.equal(app.timers.size, 1);
    assert.equal([...app.timers.values()][0].delay, 15000);
    app.fireTimeouts();
    assert.match(app.status(), /15초 안에.*준비를 확인하지 못/);
    assert.match(app.status(), phase === 'script' ? /SDK 스크립트/ : /지도 라이브러리/);
    const failure = app.status();
    if (phase === 'script') app.loadScript();
    app.finishLibrary();
    assert.equal(app.status(), failure);
    assert.equal(app.mapInstances.length, 0);
    assert.equal(app.markers.length, 0);
    assert.equal(app.timers.size, 0);
  }
});
