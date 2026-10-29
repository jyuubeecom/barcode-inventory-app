'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.join(__dirname, '..');

// Small DOM double for this screen's event flow. No network or persistent storage.
function harness(fetchImpl) {
  const ids = new Map();
  const observers = [];
  class Element {
    constructor(tag = 'div') { this.tagName = tag; this.children = []; this.listeners = {}; this._hidden = false; this.disabled = false; this.value = ''; }
    set id(v) { this._id = v; ids.set(v, this); }
    get id() { return this._id; }
    set hidden(v) { this._hidden = v; for (const o of observers) if (o.target === this) queueMicrotask(() => o.fn([{attributeName: 'hidden'}])); }
    get hidden() { return this._hidden; }
    set innerHTML(html) { for (const match of html.matchAll(/<([\w-]+)\b([^>]*\bid="([^"]+)"[^>]*)>/g)) { const e = new Element(match[1]); e.id = match[3]; e._hidden = /\bhidden\b/.test(match[2]); e.disabled = /\bdisabled\b/.test(match[2]); this.children.push(e); } }
    append(...children) { this.children.push(...children); }
    appendChild(child) { this.append(child); return child; }
    replaceChildren(...children) { this.children = children; }
    setAttribute(k, v) { this[k] = v; }
    addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); }
    async fire(type) { for (const fn of this.listeners[type] || []) await fn({target: this}); }
    scrollIntoView() {}
  }
  const main = new Element('main');
  const home = new Element('section'); home.id = 'home'; main.append(home);
  const buttons = new Element(); buttons.id = 'home-data-buttons';
  const document = { head: new Element('head'), createElement: tag => new Element(tag), getElementById: id => ids.get(id) || null,
    querySelector: s => s === 'main' ? main : null, querySelectorAll: () => main.children,
    addEventListener() {} };
  const events = {};
  const calls = [];
  let session = { token: 'FAKE_TEST_TOKEN', user: {role: 'admin'} };
  const window = { scrollTo() {}, alert() {}, addEventListener(type, fn) { (events[type] ||= []).push(fn); },
    inventoryServerSearch: { getSession: () => session, expireSession() { session = null; for (const fn of events['inventory-server-auth-changed'] || []) fn(); } },
    inventoryApp: {showScreen() { home.hidden = false; }} };
  class MutationObserver { constructor(fn) { this.fn = fn; } observe(target) { observers.push({target, fn: this.fn}); } }
  const context = vm.createContext({document, window, MutationObserver, AbortController, setTimeout, clearTimeout,
    fetch: async (...args) => { calls.push(args); return fetchImpl ? fetchImpl(...args) : response([{location_name: '本社1階 A区', quantity: '5'}]); } });
  const source = fs.readFileSync(path.join(root, 'server-stock-csv-preview.js'), 'utf8');
  // Test-only access to lexical helpers; production code exposes no test API.
  vm.runInContext(source.replace(/\}\)\(\);\s*$/, 'globalThis.testApi = {parseCsv, validateRows, initialize, openScreen, checkStockCsv, showSelectedPlan}; })();'), context);
  const api = context.testApi; api.initialize();
  const get = id => ids.get(id);
  async function compare(csv = '社内コード,保管場所,在庫数\nFAKE-001,本社1階 A区,8') {
    await api.openScreen(); get('v2932-stock-file').files = [{size: Buffer.byteLength(csv), text: async () => csv}]; await api.checkStockCsv();
  }
  return {api, get, calls, compare, main, home, window, setSession(v) {session = v;} };
}
function response(stocks, status = 200) { return {status, ok: status === 200, json: async () => ({success: true, stocks})}; }
function status(h) { return h.get('v2932-stock-rows').children.map(tr => tr.children.at(-1).textContent); }
const csv = (quantity = '8', location = '本社1階 A区', code = 'FAKE-001') => `社内コード,保管場所,在庫数\n${code},${location},${quantity}`;

test('BOM, CRLF, quoted fields and leading-zero internal codes', () => {
  const {api} = harness(); const rows = api.validateRows(api.parseCsv('\uFEFF社内コード,保管場所,在庫数\r\n"=""00001""",本社1階 A区,0\r\n'));
  assert.equal(rows[0].code, '00001'); assert.equal(rows[0].quantity, 0); assert.equal(rows[0].errors.length, 0);
});
test('reject malformed CSV quotes, including text after a closing quote', () => {
  const {api} = harness(); for (const text of ['"unclosed', 'ab"cd', '"FAKE"tail,本社1階 A区,8']) assert.throws(() => api.parseCsv(text));
});
test('invalid quantities, unknown locations and duplicate pairs are rejected', () => {
  const {api} = harness(); for (const n of ['', '-1', '1.2', '1e2', '1000001', 'NaN']) assert.ok(api.validateRows(api.parseCsv(csv(n)))[0].errors.length);
  assert.ok(api.validateRows(api.parseCsv(csv('8', '架空棚')))[0].errors.length);
  const rows = api.validateRows(api.parseCsv(csv() + '\nFAKE-001,本社1階 A区,9'));
  assert.ok(rows.every(r => r.errors.some(e => e.includes('重複'))));
});
test('row and product limits reject excess input', () => {
  const {api} = harness(); const rows = Array.from({length: 301}, (_, i) => `FAKE-${i},本社1階 A区,1`);
  assert.throws(() => api.validateRows(api.parseCsv('社内コード,保管場所,在庫数\n' + rows.join('\n'))), /300/);
  assert.throws(() => api.validateRows(api.parseCsv('社内コード,保管場所,在庫数\n' + rows.slice(0,101).join('\n'))), /100/);
});
test('difference selection and preview use only GET; changing selection clears preview', async () => {
  const h = harness(); await h.compare(); assert.deepEqual(status(h), ['差異あり']);
  const input = h.get('v2933-stock-options').children[0].children[0]; input.checked = true; await input.fire('change');
  h.api.showSelectedPlan(); assert.equal(h.get('v2933-stock-confirm').hidden, false);
  assert.match(h.get('v2933-stock-confirm-rows').children[0].textContent, /現在 5個 → CSV 8個/);
  input.checked = false; await input.fire('change'); assert.equal(h.get('v2933-stock-confirm').hidden, true);
  assert.equal(h.calls.length, 1); assert.equal(h.calls[0][1].method, 'GET'); assert.equal(h.calls[0][1].body, undefined);
});
test('same product at multiple locations is fetched once; matching and missing locations are not selectable', async () => {
  const h = harness(); await h.compare(csv('5') + '\nFAKE-001,本社2階 A区,2');
  assert.deepEqual(status(h), ['一致', '保管場所未登録']); assert.equal(h.calls.length, 1); assert.equal(h.get('v2933-stock-show-plan').disabled, true);
});
for (const value of [null, '', ' ', true, [], '1e2', '0x10', -1, 1.2, '9007199254740992']) {
  test(`invalid server quantity ${JSON.stringify(value)} is never treated as stock`, async () => {
    const h = harness(() => response([{location_name: '本社1階 A区', quantity: value}])); await h.compare(); assert.match(status(h)[0], /取得失敗/); assert.equal(h.get('v2933-stock-show-plan').disabled, true);
  });
}
test('ambiguous duplicate server locations are not selectable', async () => {
  const h = harness(() => response([{location_name:'本社1階 A区', quantity:2}, {location_name:'本社1階 A区', quantity:3}])); await h.compare(); assert.match(status(h)[0], /取得失敗/);
});
test('aggregate 本社 is shown but not selectable', async () => {
  const h = harness(() => response([{location_name:'本社', quantity:5}])); await h.compare(csv('8', '本社')); assert.equal(h.get('v2933-stock-options').children[0].children[0].disabled, true);
});
test('input errors and non-admin sessions never fetch', async () => {
  const h = harness(); await h.compare(csv('-1')); assert.equal(h.calls.length, 0);
  h.setSession({token:'FAKE_WORKER', user:{role:'worker'}}); await h.compare(); assert.equal(h.calls.length, 0);
});
test('file change and logout discard candidates', async () => {
  const h = harness(); await h.compare(); await h.get('v2932-stock-file').fire('change'); assert.equal(h.get('v2933-stock-plan').hidden, true);
  await h.compare(); h.window.inventoryServerSearch.expireSession(); assert.equal(h.get('v2933-stock-plan').hidden, true);
});
test('leaving the screen discards candidates', async () => {
  const h = harness(); await h.compare(); h.get('server-stock-csv-preview-screen').hidden = true; await Promise.resolve(); assert.equal(h.get('v2933-stock-plan').hidden, true);
});
test('return home works while a request is pending and late responses stay discarded', async () => {
  let resolve; const h = harness(() => new Promise(r => {resolve = r;}));
  const pending = h.compare(); await new Promise(setImmediate); await h.get('v2932-stock-back').fire('click');
  assert.equal(h.get('server-stock-csv-preview-screen').hidden, true);
  resolve(response([{location_name:'本社1階 A区', quantity:5}])); await pending;
  assert.equal(h.get('v2933-stock-plan').hidden, true); assert.equal(h.get('v2932-stock-check').disabled, false);
});
test('an expired session clears a previously visible preview on confirmation', async () => {
  const h = harness(); await h.compare(); const input = h.get('v2933-stock-options').children[0].children[0]; input.checked = true; await input.fire('change'); h.api.showSelectedPlan();
  h.setSession(null); h.api.showSelectedPlan(); assert.equal(h.get('v2933-stock-confirm').hidden, true); assert.equal(h.get('v2933-stock-show-plan').disabled, true);
});
test('HTTP 401 clears session and HTTP 404 never becomes a candidate', async () => {
  const expired = harness(() => response([], 401)); await expired.compare(); assert.equal(expired.get('v2933-stock-plan').hidden, true);
  assert.match(expired.get('v2932-stock-login-state').textContent, /ログインしてください/);
  const missing = harness(() => response([], 404)); await missing.compare(); assert.deepEqual(status(missing), ['商品未登録']);
});
test('one failed product does not prevent other products from being compared', async () => {
  const h = harness(url => url.includes('FAKE-001') ? Promise.reject(new Error('FAKE_NETWORK_ERROR')) : response([{location_name:'本社1階 A区',quantity:5}]));
  await h.compare(csv() + '\nFAKE-002,本社1階 A区,8'); assert.match(status(h)[0], /取得失敗/); assert.equal(status(h)[1], '差異あり');
});
test('invalid server location rows cannot crash the entire comparison', async () => {
  const h = harness(() => response([null])); await h.compare(); assert.match(status(h)[0], /取得失敗/);
});
test('empty and oversized files never fetch', async () => {
  const h = harness(); await h.api.openScreen();
  for (const size of [0, 512 * 1024 + 1]) { h.get('v2932-stock-file').files = [{size, text: async () => csv()}]; await h.api.checkStockCsv(); }
  assert.equal(h.calls.length, 0);
});
test('an older completion cannot unlock or populate a new pending comparison', async () => {
  const resolvers = []; const signals = [];
  const h = harness((url, options) => {signals.push(options.signal); return new Promise(resolve => resolvers.push(resolve));});
  const first = h.compare(); await new Promise(setImmediate);
  await h.get('v2932-stock-file').fire('change'); assert.equal(signals[0].aborted, true);
  const second = h.api.checkStockCsv(); await new Promise(setImmediate);
  resolvers[0](response([{location_name:'本社1階 A区', quantity:1}])); await first;
  assert.equal(h.get('v2932-stock-check').disabled, true); assert.equal(h.get('v2933-stock-plan').hidden, true);
  resolvers[1](response([{location_name:'本社1階 A区', quantity:5}])); await second;
  assert.equal(h.get('v2932-stock-check').disabled, false); assert.deepEqual(status(h), ['差異あり']);
});
test('late file reads are ignored after file selection changes', async () => {
  const h = harness(); await h.api.openScreen(); let release;
  h.get('v2932-stock-file').files = [{size:100, text: () => new Promise(resolve => {release = resolve;})}];
  const pending = h.api.checkStockCsv(); await h.get('v2932-stock-file').fire('change'); release(csv()); await pending;
  assert.equal(h.calls.length, 0); assert.equal(h.get('v2933-stock-plan').hidden, true);
});
test('zero server quantity is valid and CSV markup is rendered as text', async () => {
  const h = harness(() => response([{location_name:'本社1階 A区', quantity:'0'}])); await h.compare(csv('8','本社1階 A区','<b>FAKE-001</b>'));
  assert.deepEqual(status(h), ['差異あり']); assert.equal(h.get('v2932-stock-rows').children[0].children[1].textContent, '<b>FAKE-001</b>');
  assert.equal(h.get('v2932-stock-rows').children[0].children[1].children.length, 0);
});
