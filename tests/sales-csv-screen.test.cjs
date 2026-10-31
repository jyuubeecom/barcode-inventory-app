'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.join(__dirname, '..');

// Small DOM double for this screen's event flow. No network or persistent storage.
function harness(fetchImpl, savedReceipts = new Map()) {
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
  let session = { token: 'FAKE_TEST_TOKEN', user: {id:1,role: 'admin'} };
  const receipts = savedReceipts;
  const window = { sessionStorage: {getItem:k=>receipts.get(k), setItem:(k,v)=>receipts.set(k,v), removeItem:k=>receipts.delete(k)}, crypto: {getRandomValues: bytes => { bytes.fill(7); return bytes; }}, confirm: () => true, scrollTo() {}, alert() {}, addEventListener(type, fn) { (events[type] ||= []).push(fn); },
    inventoryServerSearch: { getSession: () => session, expireSession() { session = null; for (const fn of events['inventory-server-auth-changed'] || []) fn(); } },
    inventoryApp: {showScreen() { home.hidden = false; }} };
  class MutationObserver { constructor(fn) { this.fn = fn; } observe(target) { observers.push({target, fn: this.fn}); } }
  const context = vm.createContext({document, window, MutationObserver, AbortController, setTimeout, clearTimeout, TextDecoder, TextEncoder,
    fetch: async (...args) => { calls.push(args); return fetchImpl ? fetchImpl(...args) : response(previewResult()); } });
  const source = fs.readFileSync(path.join(root, 'server-sales-csv.js'), 'utf8');
  // Test-only access to lexical helpers; production code exposes no test API.
  vm.runInContext(fs.readFileSync(path.join(root, 'sales-actual.js'), 'utf8'), context);
  vm.runInContext(source.replace(/\}\)\(\);\s*$/, 'globalThis.testApi = {normalizeRows, initialize, open, preview, apply, submit, history}; })();'), context);
  const api = context.testApi; api.initialize();
  const get = id => ids.get(id);
  async function compare(csv = csvText()) {
    await api.open(); get('shared-sales-file').files = [{name:'fake.csv', size:Buffer.byteLength(csv), arrayBuffer:async()=>new TextEncoder().encode(csv).buffer}]; await api.preview();
  }
  return {api, get, calls, compare, main, home, window, receipts, setSession(v) {session = v;} };
}
function response(data, status=200) { return {status,ok:status===200,json:async()=>data}; }
function previewResult() { return {success:true,preview_hash:'a'.repeat(64),imported_count:1,duplicate_count:0,changes:[{internal_code:'FAKE-001',product_name:'架空品',quantity:2,before:5,after:3,locations:[{location_name:'本社',before:5,after:3}]}]}; }
function csvText(quantity='2', detail='売上') { return '商品コード,品名,品名2,得意先コード,得意先,日付,数量,単価,金額,粗利,伝票番号,明細区分\nFAKE-001,架空商品,,C1,架空企業,2026/10/01,'+quantity+',100,200,,FAKE-INV-1,'+detail; }
const key='inventory-sales-csv-pending-v1';
test('shared preview preserves source columns and never applies inventory',async()=>{
  const h=harness();await h.compare();assert.equal(h.calls.length,1);
  const sent=JSON.parse(h.calls[0][1].body);assert.equal(sent.action,'preview');assert.equal(sent.rows[0][5],'2026-10-01');assert.equal(sent.rows[0][10],'FAKE-INV-1');
  assert.equal(h.get('shared-sales-apply').disabled,false);assert.equal(h.receipts.size,0);
  assert.match(h.get('shared-sales-result').children[1].textContent,/5 → 3/);
});
test('returns, invalid rows and input limits are handled before network',async()=>{
  const h=harness();await h.compare(csvText('3','返品'));assert.equal(JSON.parse(h.calls[0][1].body).rows[0][6],'-3');
  for(const qty of ['0','1.5','-2','1000001','']) { const x=harness();await x.compare(csvText(qty));assert.equal(x.calls.length,0); }
  const x=harness();await x.api.open();x.get('shared-sales-file').files=[{size:512*1024+1}];await x.api.preview();assert.equal(x.calls.length,0);
});
test('file change and logout invalidate preview, all-duplicate input cannot apply',async()=>{
  const h=harness();await h.compare();await h.get('shared-sales-file').fire('change');await h.api.apply();assert.equal(h.calls.length,1);
  const d=harness(()=>response({...previewResult(),imported_count:0,duplicate_count:1,changes:[]}));await d.compare();assert.equal(d.get('shared-sales-apply').disabled,true);
  const l=harness();await l.compare();l.window.inventoryServerSearch.expireSession();await l.api.apply();assert.equal(l.calls.length,1);assert.equal(l.get('shared-sales-apply').disabled,true);
});
test('apply persists exact operation before send and retries uncertainty with same body',async()=>{
  let posts=0;const h=harness(async(url,opts)=>{if(JSON.parse(opts.body).action==='preview') return response(previewResult());posts++;assert.ok(h.receipts.has(key));if(posts===1)throw new Error('network');return response({...previewResult(),request_id:JSON.parse(opts.body).request_id,message:'保存済み',replayed:true});});
  await h.compare();await h.api.apply();assert.equal(posts,1);assert.equal(h.get('shared-sales-retry').hidden,false);const saved=h.receipts.get(key);assert.ok(saved);assert.ok(!saved.includes('FAKE_TEST_TOKEN'));
  await h.api.preview();assert.equal(h.calls.length,2);await h.api.submit();assert.equal(posts,2);assert.equal(h.calls[1][1].body,h.calls[2][1].body);assert.equal(h.receipts.has(key),false);assert.match(h.get('shared-sales-message').textContent,/保存済み/);
});
test('reload restores pending operation without automatically sending',async()=>{
  const h=harness(async(url,opts)=>{if(JSON.parse(opts.body).action==='preview')return response(previewResult());throw new Error('lost');});await h.compare();await h.api.apply();
  const original=JSON.parse(h.receipts.get(key)).payload;
  const restored=harness((url,opts)=>response({...previewResult(),request_id:JSON.parse(opts.body).request_id,message:'保存済み'}),h.receipts);
  await restored.api.open();assert.equal(restored.calls.length,0);assert.equal(restored.get('shared-sales-retry').hidden,false);
  await restored.api.submit();assert.deepEqual(JSON.parse(restored.calls[0][1].body),original);assert.equal(restored.receipts.has(key),false);
});
test('different user cannot retry another user operation',async()=>{
  const receipts=new Map([[key,JSON.stringify({owner:'2',payload:{request_id:'FAKE',rows:[]}})]]);const h=harness(undefined,receipts);await h.api.submit();assert.equal(h.calls.length,0);assert.ok(receipts.has(key));
});
test('storage failure prevents POST and explicit rejection clears pending state',async()=>{
  const h=harness();await h.compare();h.window.sessionStorage.setItem=()=>{throw new Error('blocked');};await h.api.apply();assert.equal(h.calls.length,1);
  const r=harness((url,opts)=>JSON.parse(opts.body).action==='preview'?response(previewResult()):response({success:false,message:'再照合'},409));await r.compare();await r.api.apply();assert.equal(r.receipts.has(key),false);assert.equal(r.get('shared-sales-apply').disabled,true);
});
test('malformed and unauthorized replies keep unresolved request for safe retry',async()=>{
  for(const status of [401,500]) { const h=harness((url,opts)=>JSON.parse(opts.body).action==='preview'?response(previewResult()):response({success:false,message:'failed'},status));await h.compare();await h.api.apply();assert.ok(h.receipts.has(key)); }
});
test('shared history uses authenticated read action, renders text and home navigation works',async()=>{
  const h=harness(()=>response({success:true,batches:[{created_at:'2026-10-01',file_name:'<fake>.csv',imported_count:1,request_id:'FAKE-ID'}]}));await h.api.open();await h.api.history();assert.equal(JSON.parse(h.calls[0][1].body).action,'history');assert.equal(h.calls[0][1].headers.Authorization,'Bearer FAKE_TEST_TOKEN');assert.match(h.get('shared-sales-history').children[0].textContent,/<fake>/);await h.get('shared-sales-back').fire('click');assert.equal(h.home.hidden,false);
});

test('malformed CSV and unexpected apply success never produce an untracked write',async()=>{
  for(const text of [csvText()+'"',csvText().replace('架空商品','"abc"tail')]) { const h=harness();await h.compare(text);assert.equal(h.calls.length,0); }
  const h=harness((url,opts)=>response(JSON.parse(opts.body).action==='preview'?previewResult():{success:true}));await h.compare();await h.api.apply();assert.ok(h.receipts.has(key));assert.equal(h.get('shared-sales-retry').hidden,false);
});
