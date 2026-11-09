'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');const vm=require('node:vm');const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../shared-stocktaking.js'),'utf8');
const id='12345678-1234-4234-8234-123456789012';
const user={token:'FAKE',user:{username:'fake-worker',role:'worker'}};
function fixture(fetchImpl){
 let current=user,calls=[];
 const c={AbortController,setTimeout,clearTimeout,crypto:{randomUUID:()=>id},inventoryServerSearch:{getSession:()=>current},fetch:async(url,options)=>{calls.push({url,options});return fetchImpl(url,options);}};
 vm.runInNewContext(source,c);return {api:c.inventorySharedStocktaking,calls,setSession:s=>{current=s;}};
}
const fields={action:'save',stocktaking_id:id,internal_code:'FAKE-01',expected_version:0,counted_stock:'0',memo:''};
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
