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
  const source = fs.readFileSync(path.join(root, 'server-migration-preview.js'), 'utf8');
  // Test-only access to lexical helpers; production code exposes no test API.
  for(const name of ['migration/backup-audit.js','migration/prepare-products.js']) vm.runInContext(fs.readFileSync(path.join(root,name),'utf8'),context);
  vm.runInContext(source.replace(/\}\)\(\);\s*$/, 'globalThis.testApi = {initialize, read, compare, apply}; })();'), context);
  const api = context.testApi; api.initialize();
  const get = id => ids.get(id);
  async function compare(raw=backup()) {
    get('migration-preview-screen').hidden=false;
    get('migration-file').files=[{size:500,text:async()=>JSON.stringify(raw)}];await api.read();
    get('migration-authorized').checked=true;await api.compare();
  }
  return {api, get, calls, compare, main, home, window, receipts, setSession(v) {session = v;} };
}
function response(data,status=200){return {status,ok:status===200,json:async()=>data};}
function previewResult(){return {success:true,preview_only:true,migrated:false,message:'照合のみ完了',comparison_sha256:'a'.repeat(64),summary:{new:1,same:0,different:0,code_conflict:0,fixed_status_conflict:0,server_only:1},rows:[{internal_code:'FAKE-001',result:'new',source_stock:3,server_stock:null,differences:[],fixed_status_conflict:false,source_status:'専用商品',source_stocks:[{location_name:'本社',quantity:3}]}]};}
const audit=require('../migration/backup-audit.js');const {prepareProducts}=require('../migration/prepare-products.js');
function backup(){const data=Object.fromEntries(Object.keys(audit.stores).map(k=>[k,[]]));data.products=[{internalCode:'FAKE-001',productName:'架空品',stock:3,productStatus:'専用商品',locationStocks:[{location:'本社',stock:3}],memo:'架空メモ'}];data.salesActuals=[{id:'old-fake-sale',internalCode:'FAKE-001',customerName:'SECRET-CUSTOMER'}];return {backupType:'barcode-inventory-app',backupVersion:12,exportedAt:'2026-10-30T00:00:00Z',data};}
test('preparation preserves fixed states and source while excluding historical records',()=>{const raw=backup();const before=JSON.stringify(raw);const p=prepareProducts(raw);assert.equal(p.payload.products[0].product_status,'専用商品');assert.equal(p.audit.counts.salesActuals,1);assert.equal(p.payload.action,'preview');assert.ok(!JSON.stringify(p.payload).includes('SECRET-CUSTOMER'));assert.equal(JSON.stringify(raw),before);raw.data.products[0].productStatus='廃盤予定';assert.equal(prepareProducts(raw).payload.products[0].product_status,'廃盤予定');});
test('invalid stock/status/minimum stop preparation instead of silently correcting',()=>{for(const changes of [{stock:4},{minStock:-1},{minStock:true},{productStatus:'OTHER'},{memo:12}]){const b=backup();Object.assign(b.data.products[0],changes);assert.throws(()=>prepareProducts(b));}});
test('legacy normal status is explicitly mapped and zero-stock missing locations stay empty',()=>{const b=backup();Object.assign(b.data.products[0],{stock:0,locationStocks:[],productStatus:'通常'});const p=prepareProducts(b);assert.equal(p.payload.products[0].product_status,'通常商品');assert.deepEqual(p.payload.products[0].stocks,[]);assert.equal(b.data.products[0].productStatus,'通常');});
test('file reading stays local until the user authorizes the destination and compares',async()=>{const h=harness();h.get('migration-file').files=[{size:500,text:async()=>JSON.stringify(backup())}];await h.api.read();assert.equal(h.calls.length,0);await h.api.compare();assert.equal(h.calls.length,0);assert.match(h.get('migration-message').textContent,/許可/);h.get('migration-authorized').checked=true;await h.api.compare();assert.equal(h.calls.length,1);const sent=JSON.parse(h.calls[0][1].body);assert.equal(sent.action,'preview');assert.equal(sent.products.length,1);assert.ok(!h.calls[0][1].body.includes('SECRET-CUSTOMER'));assert.equal(h.calls[0][1].headers.Authorization,'Bearer FAKE_TEST_TOKEN');});
test('successful summary hides codes and quantities while detailed output uses text',async()=>{const h=harness();await h.compare();const summary=JSON.parse(h.get('migration-summary').value);assert.equal(summary.serverCompared,true);assert.equal(summary.migrated,false);assert.equal(summary.source_counts.salesActuals,1);assert.ok(!h.get('migration-summary').value.includes('FAKE-001'));assert.ok(!h.get('migration-summary').value.includes('source_stock'));});
test('worker and absent sessions cannot send a backup comparison',async()=>{for(const s of [null,{token:'fake',user:{id:2,role:'worker'}}]){const h=harness();h.setSession(s);await h.compare();assert.equal(h.calls.length,0);}});
test('changed file and logout clear previous results and pending source',async()=>{const h=harness();await h.compare();h.window.inventoryServerSearch.expireSession();assert.equal(h.get('migration-summary').value,'');assert.equal(h.get('migration-file').value,'');await h.api.compare();assert.equal(h.calls.length,1);});
test('late comparison is discarded after logout or a different file selection',async()=>{let finish;const h=harness(()=>new Promise(r=>{finish=r;}));const run=h.compare();while(!finish)await new Promise(r=>setImmediate(r));h.window.inventoryServerSearch.expireSession();finish(response(previewResult()));await run;assert.equal(h.get('migration-summary').value,'');});
test('a failed re-comparison removes the previous summary without writing a receipt',async()=>{let n=0;const h=harness(()=>++n===1?response(previewResult()):response({success:false,message:'failed'},500));await h.compare();assert.ok(h.get('migration-summary').value);await h.api.compare();assert.equal(h.get('migration-summary').value,'');assert.equal(h.receipts.size,0);});
test('oversized file and malformed backup do not send any request',async()=>{const h=harness();h.get('migration-file').files=[{size:100*1024*1024+1}];await h.api.read();await h.api.compare();assert.equal(h.calls.length,0);h.get('migration-file').files=[{size:50,text:async()=>'{broken'}];await h.api.read();await h.api.compare();assert.equal(h.calls.length,0);});

function applyResult(sent){return {success:true,migrated:true,request_id:sent.request_id,added:1,unchanged:0,history_replayed:false,message:'保存完了'};}
test('details show fixed source status and location stock without putting them in the share summary',async()=>{const h=harness();await h.compare();const text=JSON.stringify(h.get('migration-result').children);assert.match(text,/専用商品/);assert.match(text,/本社/);assert.ok(!h.get('migration-summary').value.includes('専用商品'));});
test('apply sends only after explicit confirmation and retains one request id across uncertain failures',async()=>{let sent;let n=0;const h=harness((url,options)=>{if(url.includes('preview-'))return response(previewResult());sent=JSON.parse(options.body);if(++n===1)throw new Error('lost response');return response(applyResult(sent));});await h.compare();await h.api.apply();const id=sent.request_id;assert.equal(h.receipts.size,1);assert.equal(h.get('migration-compare').disabled,true);assert.ok(![...h.receipts.values()][0].includes('FAKE_TEST_TOKEN'));await h.api.apply();assert.equal(sent.request_id,id);assert.equal(h.receipts.size,0);assert.equal(JSON.parse(h.get('migration-summary').value).migrated,true);assert.ok(!JSON.stringify(sent).includes('SECRET-CUSTOMER'));});
test('cancel and blocked receipt storage send no mutation',async()=>{for(const mode of ['cancel','storage']){const h=harness();await h.compare();if(mode==='cancel')h.window.confirm=()=>false;else h.window.sessionStorage.setItem=()=>{throw new Error('blocked');};await h.api.apply();assert.equal(h.calls.length,1);}});
test('definite conflict requires a fresh comparison, whereas malformed success retains retry',async()=>{for(const status of [409,200]){const h=harness((url,options)=>url.includes('preview-')?response(previewResult()):response(status===409?{success:false,message:'recompare'}:{...applyResult(JSON.parse(options.body)),request_id:'wrong'},status));await h.compare();await h.api.apply();assert.equal(h.receipts.size,status===409?0:1);assert.equal(h.get('migration-apply').hidden,status===409);}});
test('saved request recovers after page reload for the same admin only',async()=>{const a=harness(url=>url.includes('preview-')?response(previewResult()):Promise.reject(Error('offline')));await a.compare();await a.api.apply();const original=[...a.receipts.values()][0];const b=harness((url,o)=>response(applyResult(JSON.parse(o.body))),a.receipts);await b.api.apply();assert.equal(b.calls.length,1);assert.equal(JSON.parse(b.calls[0][1].body).request_id,JSON.parse(original).payload.request_id);const c=harness(null,new Map([['inventory-migration-pending-v1',original]]));c.setSession({token:'other',user:{id:2,role:'admin'}});await c.api.apply();assert.equal(c.calls.length,0);});
test('late successful mutation after logout does not display data and retains replay information',async()=>{let finish;const h=harness((url,options)=>url.includes('preview-')?response(previewResult()):new Promise(r=>finish=()=>r(response(applyResult(JSON.parse(options.body))))));await h.compare();const run=h.api.apply();while(!finish)await new Promise(r=>setImmediate(r));h.window.inventoryServerSearch.expireSession();finish();await run;assert.equal(h.get('migration-summary').value,'');assert.equal(h.receipts.size,1);});
