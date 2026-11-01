'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const os = require('node:os');
const {execFileSync} = require('node:child_process');
const root = path.join(__dirname, '..');
function worker(scope = 'https://example.invalid/inventory-test-v29311/', fetchImpl) {
  const events = {}, removed = [], matches = [], network = [], stored = [];
  const context = vm.createContext({URL, Promise,
    self:{registration:{scope}, addEventListener(type,fn){events[type]=fn;}, clients:{claim(){}}, skipWaiting(){}},
    caches:{keys:async()=>context.names, delete:async n=>removed.push(n), match:async(request,options)=>{matches.push({request,options}); return 'FAKE_CACHED_RESPONSE';}, open:async name=>({put:async(request,response)=>stored.push({name,request,response})})},
    fetch:async(...args)=>{network.push(args); if(fetchImpl) return fetchImpl(...args); throw new Error('FAKE_OFFLINE');}
  });
  vm.runInContext(fs.readFileSync(path.join(root,'service-worker.js'),'utf8') + '\nglobalThis.name = CACHE_NAME; globalThis.prefix = CACHE_PREFIX;',context);
  function request(url, mode='cors', method='GET', headers) {let pending; events.fetch({request:{url,mode,method,headers},respondWith(p){pending=p;}}); return pending;}
  return {context, events, removed, matches, network, stored, request};
}
test('activation removes only obsolete caches owned by the same app path', async()=>{
  const w = worker();
  w.context.names = [w.context.name,w.context.prefix+'old','ouka-cache','barcode-inventory-app-v29311-stock-plan-preview','barcode-inventory-app:'+encodeURIComponent('https://example.invalid/inventory/')+':old'];
  let done; w.events.activate({waitUntil(p){done=p;}}); await done;
  assert.deepEqual(w.removed,[w.context.prefix+'old']);
});
test('production and test paths receive different cache names',()=>{
  assert.notEqual(worker().context.name,worker('https://example.invalid/inventory/').context.name);
});
test('server APIs, other apps, external requests and writes are not intercepted',()=>{
  const w = worker();
  for(const url of ['https://example.invalid/inventory/get-product-auth.php?code=FAKE-001','https://example.invalid/ouka/index.html','https://other.invalid/icon.png','https://example.invalid/inventory-test-v29311-other/index.html']) assert.equal(w.request(url),undefined);
  assert.equal(w.request('https://example.invalid/inventory-test-v29311/index.html','cors','POST'),undefined);
  assert.equal(w.request('https://example.invalid/inventory-test-v29311/get-product-auth.php?code=FAKE-001'),undefined);
  assert.equal(w.request('https://example.invalid/inventory-test-v29311/private.json','cors','GET',{has:name=>name==='Authorization'}),undefined);
  assert.equal(w.matches.length,0);
});
test('offline navigation and scripts match only this app cache',async()=>{
  const w=worker();
  assert.equal(await w.request('https://example.invalid/inventory-test-v29311/index.html','navigate'),'FAKE_CACHED_RESPONSE');
  assert.equal(await w.request('https://example.invalid/inventory-test-v29311/server-stock-csv-preview.js?v=293111'),'FAKE_CACHED_RESPONSE');
  assert.equal(w.matches.length,2);
  assert.ok(w.matches.every(m=>m.options.cacheName===w.context.name));
});
test('offline static assets also match only this app cache',async()=>{
  const w=worker();
  assert.equal(await w.request('https://example.invalid/inventory-test-v29311/icons/icon-192.png'),'FAKE_CACHED_RESPONSE');
  assert.equal(w.matches[0].options.cacheName,w.context.name);
});
test('online manifest refreshes app identity instead of returning the old cached manifest',async()=>{
  const fresh={status:200,clone(){return this;}};
  const w=worker(undefined,async()=>fresh);
  assert.equal(await w.request('https://example.invalid/inventory-test-v29311/manifest.json'),fresh);
  assert.equal(w.matches.length,0);
  assert.equal(w.network[0][1].cache,'no-store');
  assert.equal(w.stored[0].name,w.context.name);
});
test('offline manifest falls back only to the same app cache',async()=>{
  const w=worker();
  assert.equal(await w.request('https://example.invalid/inventory-test-v29311/manifest.json'),'FAKE_CACHED_RESPONSE');
  assert.equal(w.network.length,1);
  assert.equal(w.matches[0].options.cacheName,w.context.name);
});
test('test ZIP isolates the inventory database, identifies the app and contains all cached files',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'inventory-test-package-'));
  try {
    const output=path.join(dir,'test.zip');
    execFileSync('python3',[path.join(root,'scripts/build-test-package.py'),output]);
    execFileSync('python3',['-c',`
import sys,zipfile,re,json
with zipfile.ZipFile(sys.argv[1]) as z:
    assert z.testzip() is None
    names=set(z.namelist())
    assert 'index.html' in names and 'icons/icon-192.png' in names
    assert not any(n.startswith(('.git/', '.github/', 'tests/', 'scripts/')) or n.endswith(('.php','.csv')) for n in names)
    storage=z.read('storage.js').decode()
    assert '"barcodeInventoryDatabase-test-v29311"' in storage
    assert '"barcodeInventoryDatabase"' not in storage
    assert '検証専用・画面版 v293.13' in z.read('index.html').decode()
    manifest=json.loads(z.read('manifest.json'))
    assert manifest['short_name']=='在庫テスト29311'
    assert manifest['id']=='./?app=barcode-inventory-test-v29311'
    from urllib.parse import urljoin
    production=json.load(open(sys.argv[2],encoding='utf-8'))
    origin='https://example.invalid/'
    test_base=origin+'inventory-test-v29311/manifest.json'
    production_base=origin+'inventory/manifest.json'
    assert urljoin(test_base,manifest['id']) != urljoin(production_base,production['id'])
    assert urljoin(test_base,manifest['id']) != urljoin(test_base,production['id'])
    assert urljoin(test_base,manifest['scope'])==origin+'inventory-test-v29311/'
    assert urljoin(test_base,manifest['start_url'])==origin+'inventory-test-v29311/index.html'
    assert production['id']=='./' and production['scope']=='./'
    for entry in re.findall(r'"(\\./[^"\\n]*)"',z.read('service-worker.js').decode()):
        target=entry[2:].split('?')[0]
        assert not target or target in names, entry
`,output,path.join(root,'manifest.json')]);
    assert.match(fs.readFileSync(path.join(root,'storage.js'),'utf8'),/"barcodeInventoryDatabase"/);
  } finally {fs.rmSync(dir,{recursive:true,force:true});}
});
