'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');const vm=require('node:vm');const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../shared-stocktaking.js'),'utf8');
const id='12345678-1234-4234-8234-123456789012';
const user={token:'FAKE',user:{username:'fake-worker',role:'worker'}};
function fixture(fetchImpl,storage){
 let current=user,calls=[];
 const c={sessionStorage:storage,AbortController,setTimeout,clearTimeout,crypto:{randomUUID:()=>id},inventoryServerSearch:{getSession:()=>current},fetch:async(url,options)=>{calls.push({url,options});return fetchImpl(url,options);}};
 vm.runInNewContext(source,c);return {api:c.inventorySharedStocktaking,calls,setSession:s=>{current=s;}};
}
const fields={action:'save',stocktaking_id:id,internal_code:'FAKE-01',expected_version:0,counted_stock:'0',memo:''};
test('saved result summary distinguishes unchecked, confirmed zero, match, shortage and surplus without changing input',()=>{
 const f=fixture();
 const items=[
  {internal_code:'FAKE-A',registered_stock:0,counted_stock:null},
  {internal_code:'FAKE-B',registered_stock:0,counted_stock:0},
  {internal_code:'FAKE-C',registered_stock:10,counted_stock:0},
  {internal_code:'FAKE-D',registered_stock:3,counted_stock:5},
  {internal_code:'FAKE-E',registered_stock:2,counted_stock:2}
 ];
 const before=JSON.stringify(items),summary=f.api.summarize(items);
 assert.deepEqual(JSON.parse(JSON.stringify(summary)),{target:5,checked:4,unchecked:1,match:2,shortage:1,surplus:1});
 assert.equal(JSON.stringify(items),before);assert.equal(f.calls.length,0);
});
test('incomplete or invalid saved result is rejected instead of reporting zero differences',()=>{
 const f=fixture(),valid={internal_code:'FAKE-A',registered_stock:1,counted_stock:null};
 for(const items of [null,[],[valid,valid],[{...valid,counted_stock:undefined}],[{...valid,counted_stock:'0'}],[{...valid,counted_stock:-1}],[{...valid,registered_stock:null}],[{...valid,counted_stock:1.5}]])assert.throws(()=>f.api.summarize(items));
});
function result(options){const r=JSON.parse(options.body);return {ok:true,json:async()=>({...r,success:true,version:1})};}
test('zero is confirmed while blank, negative, fractional and excessive counts are rejected',()=>{
 const f=fixture();assert.equal(f.api.quantity('0'),0);
 for(const value of ['',null,undefined,' ','-1','1.5','1e3',1000000001])assert.throws(()=>f.api.quantity(value));
 f.api.prepare(fields);assert.equal(f.api.pending().request.counted_stock,0);
});
test('lost response retry keeps same operation and content; different account cannot retry',async()=>{
 let fail=true;const f=fixture(async(url,opts)=>{if(fail)throw Error('FAKE_LOST');return result(opts);});
 f.api.prepare(fields);await assert.rejects(f.api.send());assert.throws(()=>f.api.prepare({...fields,counted_stock:9}));
 f.setSession({...user,user:{username:'other',role:'worker'}});await assert.rejects(f.api.send());assert.equal(f.calls.length,1);
 f.setSession(user);fail=false;await f.api.send();assert.equal(f.api.pending(),null);
 assert.equal(f.calls[0].options.body,f.calls[1].options.body);
 assert.equal(f.calls[0].options.cache,'no-store');assert.match(f.calls[0].options.headers.Authorization,/Bearer FAKE/);
});
test('explicit version conflict permits reload; server failure preserves retry',async()=>{
 for(const status of [400,409,401,500]){
  const f=fixture(async()=>({ok:false,status,json:async()=>({success:false,message:'FAKE'})}));
  f.api.prepare(fields);await assert.rejects(f.api.send());assert.equal(!!f.api.pending(),![400,409].includes(status));
 }
});
test('wrong saved count or version is not accepted as success',async()=>{
 for(const patch of [{version:2},{counted_stock:5},{internal_code:'OTHER'},{memo:'changed'},{request_id:'other'}]){
  const f=fixture(async(url,opts)=>{const r=result(opts);return {...r,json:async()=>({...await r.json(),...patch})};});
  f.api.prepare(fields);await assert.rejects(f.api.send());assert.ok(f.api.pending());
 }
});
test('logout while saving retains receipt and suppresses stale result',async()=>{
 let resolve;const f=fixture((url,opts)=>new Promise(r=>{resolve=()=>r(result(opts));}));
 f.api.prepare(fields);const p=f.api.send();f.setSession(null);resolve();await assert.rejects(p);assert.ok(f.api.pending());
});
test('simultaneous sends do not create duplicate POSTs',async()=>{
 let resolve;const f=fixture((url,opts)=>new Promise(r=>{resolve=()=>r(result(opts));}));
 f.api.prepare(fields);const p=f.api.send();await assert.rejects(f.api.send());assert.equal(f.calls.length,1);resolve();await p;
});
test('start receipt and read sessions never carry local products into server',async()=>{
 const f=fixture(async(url,opts)=>({ok:true,json:async()=>opts.body?{success:true,request_id:id,stocktaking_id:id}:{success:true}}));
 f.api.prepare({action:'start',stocktaking_date:'2026-11-09',location_name:'架空倉庫'});await f.api.send();
 await f.api.overview();await f.api.read(id);assert.match(f.calls[2].url,/\?id=/);assert.equal(f.calls[1].options.method,'GET');
 assert.equal(f.calls[1].options.body,undefined);assert.ok(!source.includes('getAllProducts('));
});
const finalFields={action:'finalize',stocktaking_id:id,preview_token:'a'.repeat(64)};
const admin={token:'FAKE-ADMIN',user:{username:'fake-admin',role:'admin'}};
function memoryStorage(){const m=new Map();return {getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)};}
function finalResult(opts,patch={}){return {ok:true,json:async()=>({...JSON.parse(opts.body),success:true,status:'finalized',changed_count:1,...patch})};}
test('finalization is admin-only and fails before POST when durable receipt storage is unavailable',()=>{
 const f=fixture();assert.throws(()=>f.api.prepare(finalFields),/管理者/);
 f.setSession(admin);assert.throws(()=>f.api.prepare(finalFields),/保存できません/);assert.equal(f.api.pending(),null);assert.equal(f.calls.length,0);
});
test('finalize lost response survives reload and replays exact request only with same owner',async()=>{
 const storage=memoryStorage();const a=fixture(async()=>{throw Error('FAKE_LOST');},storage);a.setSession(admin);
 a.api.prepare(finalFields);await assert.rejects(a.api.send());
 const b=fixture(async(url,opts)=>finalResult(opts),storage);assert.ok(b.api.pending());assert.throws(()=>b.api.prepare(fields));
 await assert.rejects(b.api.send(),/同じ担当者/);assert.equal(b.calls.length,0);
 b.setSession(admin);await b.api.send();assert.equal(b.calls[0].options.body,a.calls[0].options.body);assert.equal(b.api.pending(),null);assert.equal(storage.getItem('inventorySharedStocktakingFinalizePendingV1'),null);
});
test('bad finalize receipts retain durable pending operation; explicit stale conflict clears it',async()=>{
 for(const patch of [{status:'draft'},{preview_token:'b'.repeat(64)},{stocktaking_id:'wrong'},{changed_count:-1},{action:'save'}]){
  const storage=memoryStorage(),f=fixture(async(url,opts)=>finalResult(opts,patch),storage);f.setSession(admin);f.api.prepare(finalFields);await assert.rejects(f.api.send());assert.ok(storage.getItem('inventorySharedStocktakingFinalizePendingV1'));
 }
 const storage=memoryStorage(),f=fixture(async()=>({ok:false,status:409,json:async()=>({success:false,message:'FAKE_STALE'})}),storage);f.setSession(admin);f.api.prepare(finalFields);await assert.rejects(f.api.send());assert.equal(f.api.pending(),null);assert.equal(storage.getItem('inventorySharedStocktakingFinalizePendingV1'),null);
});
test('corrupt durable receipt fails closed and finalize preview is GET only',async()=>{
 const storage=memoryStorage();storage.setItem('inventorySharedStocktakingFinalizePendingV1','broken');const f=fixture(async()=>({ok:true,json:async()=>({success:true})}),storage);f.setSession(admin);assert.throws(()=>f.api.prepare(finalFields),/読み出せません/);
 await f.api.previewFinalize(id);assert.equal(f.calls[0].options.method,'GET');assert.match(f.calls[0].url,/preview=finalize/);assert.equal(f.calls[0].options.body,undefined);
});
