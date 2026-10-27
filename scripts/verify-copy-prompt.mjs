import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
const source = await readFile(new URL('../src/components/CopyPrompt.astro', import.meta.url), 'utf8');
const script = source.match(/<script>([\s\S]*?)<\/script>/)[1];
function setup(writeText) {
  class Element { constructor() { this.handlers = {}; this.attrs = {}; this.hidden = false; this.disabled = false; this.textContent = ''; } addEventListener(n, f) { this.handlers[n] = f; } setAttribute(n, v) { this.attrs[n] = v; } removeAttribute(n) { delete this.attrs[n]; } focus() { this.focused = true; } }
  class Button extends Element {}
  const button = new Button(), select = new Button(), status = new Element(), pre = new Element(), box = new Element();
  box.dataset = { copyValue: '검증용 원문\n{{우리 팀}}' };
  box.querySelector = s => ({ '[data-copy-button]': button, '[data-select-button]': select, '[data-copy-status]': status, pre })[s];
  let selected = null;
  vm.runInNewContext(script, { HTMLElement: Element, HTMLButtonElement: Button, navigator: { clipboard: { writeText } }, document: { querySelectorAll: () => [box], createRange: () => ({ selectNodeContents: n => { selected = n; } }) }, window: { getSelection: () => ({ removeAllRanges() {}, addRange() {} }) } });
  return { button, select, status, pre, selected: () => selected };
}
test('copy success sends original text and persistent status', async () => {
  let copied; const x = setup(async text => { copied = text; });
  await x.button.handlers.click();
  assert.equal(copied, '검증용 원문\n{{우리 팀}}');
  assert.match(x.status.textContent, /복사했습니다/);
  assert.equal(x.select.hidden, true); assert.equal(x.button.disabled, false);
});
test('clipboard denial offers manual selection without claiming copy success', async () => {
  const x = setup(async () => { throw Error('NotAllowed'); });
  await x.button.handlers.click();
  assert.match(x.status.textContent, /자동 복사가 제한/); assert.equal(x.select.hidden, false);
  x.select.handlers.click(); assert.equal(x.selected(), x.pre); assert.equal(x.pre.focused, true);
  assert.match(x.status.textContent, /선택했습니다/);
});
test('repeated click while pending does not duplicate request', async () => {
  let finish; let calls = 0; const x = setup(() => { calls++; return new Promise(resolve => { finish = resolve; }); });
  const first = x.button.handlers.click(); await x.button.handlers.click();
  assert.equal(calls, 1); assert.equal(x.button.disabled, true);
  finish(); await first; assert.equal(x.button.disabled, false);
});
test('keyboard scroll, live feedback and touch target are retained', () => {
  assert.match(source, /<pre tabindex="0"/); assert.match(source, /aria-live="polite"/);
  assert.match(source, /min-height: 44px/); assert.match(source, /aria-label=\{`\$\{title\}/);
});
