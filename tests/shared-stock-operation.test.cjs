'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');
function client(fetchImpl,storage=new Map()) {
 let calls=[];const c={location:{pathname:'/fake/'},crypto:{randomUUID:()=> '12345678-1234-4234-8234-123456789012'},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},fetch:async(...args)=>{calls.push(args);return fetchImpl(...args);}};
 vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname,'../shared-stock-operation.js'),'utf8'),c);return {api:c.inventorySharedStockOperation,calls,storage,c};
}
const session={token:'FAKE-NOT-A-TOKEN',user:{id:1,role:'worker'}};
const fields={action:'in',internal_code:'FAKE-001',location_name:'本社',quantity:'2',reason:'仕入れ',memo:''};const stocks=[{location_name:'本社',quantity:5}];
const ok=(id)=>({ok:true,status:200,json:async()=>({success:true,request_id:id,transaction_id:1})});
test('lost response retains same receipt across reload; retry does not generate another operation',async()=>{
 const storage=new Map();const a=client(async()=>{throw new Error('FAKE_NETWORK');},storage);const prepared=a.api.prepare(session,fields,stocks);
 await assert.rejects(a.api.send(session));assert.equal(a.api.pending().request.request_id,prepared.request.request_id);
 const b=client(async(url,opts)=>ok(JSON.parse(opts.body).request_id),storage);await b.api.send(session);
 assert.equal(b.api.pending(),null);assert.equal(JSON.parse(a.calls[0][1].body).request_id,JSON.parse(b.calls[0][1].body).request_id);
 assert.ok(![...storage.values()].some(s=>s.includes(session.token)));
});
test('pending write blocks changed contents and another account before network',async()=>{
 const a=client(async()=>ok('unused'));a.api.prepare(session,fields,stocks);
 assert.throws(()=>a.api.prepare(session,{...fields,quantity:3},stocks));
 await assert.rejects(a.api.send({...session,user:{id:2,role:'admin'}}));assert.equal(a.calls.length,0);
});
test('invalid quantities and malformed stock do not persist or send',()=>{
 for(const quantity of ['',0,-1,1.5,1000001,'not a number']) {const a=client();assert.throws(()=>a.api.prepare(session,{...fields,quantity},stocks));assert.equal(a.storage.size,0);}
 const a=client();assert.throws(()=>a.api.prepare(session,fields,[{location_name:'本社',quantity:null}]));assert.equal(a.storage.size,0);
});
test('definitive server conflict clears pending; 401/500 or wrong receipt retains it',async()=>{
 for(const status of [409,400,401,500]) {const a=client(async()=>({ok:false,status,json:async()=>({success:false,message:'FAKE_REJECTION'})}));a.api.prepare(session,fields,stocks);await assert.rejects(a.api.send(session));assert.equal(!!a.api.pending(),![400,409].includes(status));}
 const a=client(async()=>ok('WRONG'));a.api.prepare(session,fields,stocks);await assert.rejects(a.api.send(session));assert.ok(a.api.pending());
});
test('simultaneous submit uses one request; storage failure prevents writes',async()=>{
 let resolve;const a=client(()=>new Promise(r=>resolve=r));a.api.prepare(session,fields,stocks);const p=a.api.send(session);
 await assert.rejects(a.api.send(session));assert.equal(a.calls.length,1);resolve(ok(a.api.pending().request.request_id));await p;
 a.c.localStorage.setItem=()=>{throw new Error('FAKE_STORAGE_FULL');};assert.throws(()=>a.api.prepare(session,fields,stocks));assert.equal(a.calls.length,1);
});
function uiFixture({quantity='2',readFails=false}={}) {
 const source=fs.readFileSync(require('node:path').join(__dirname,'../server-test.js'),'utf8');
 const start=source.indexOf('  let sharedOperationSubmitting = false;'),end=source.indexOf('  function showServerStockOutStatus(',start);
 const elements={submit:{dataset:{},disabled:false},location:{value:'本社'},quantity:{value:quantity},reason:{value:'仕入れ'},memo:{value:''}};
 let sends=0,prepared=0;const notices=[];
 const context={window:{inventorySharedStockOperation:{pending:()=>null,snapshot:x=>x,prepare(){prepared++;},refresh(){},async send(){sends++;return {location_name:'本社',location_stock_before:5,location_stock_after:7,stock_after:9};}},confirm:()=>true},
 lastServerProductData:{product:{internal_code:'FAKE-001'},stocks:[{location_name:'本社',quantity:5}]},lastServerStockInMessage:'',lastServerStockOutMessage:'',getStoredSession:()=>session,
 showServerStockInStatus:(...x)=>notices.push(x),showServerStockOutStatus:(...x)=>notices.push(x),getErrorMessage:e=>e.message,
 searchServerProductForApp:async()=>{if(readFails)throw new Error('FAKE_READ_FAILURE');return {};},openServerProductDetail(){}};
 vm.createContext(context);vm.runInContext(source.slice(start,end),context);
 return {run:()=>context.submitSharedStockOperation('in',{section:{querySelector:s=>elements[s.split('-').at(-1)]},internalCode:'FAKE-001',productName:'架空商品'}),elements,notices,count:()=>({sends,prepared})};
}
test('saved write followed by failed display read cannot become another submit',async()=>{
 const f=uiFixture({readFails:true});await f.run();assert.equal(f.count().sends,1);assert.equal(f.elements.submit.disabled,true);
 assert.match(f.notices.at(-1)[1],/保存しました/);await f.run();assert.equal(f.count().sends,1);
});
test('shared form rejects fractional quantities before confirmation and persistence',async()=>{
 const f=uiFixture({quantity:'1.5'});await f.run();assert.equal(f.count().prepared,0);assert.match(f.notices.at(-1)[1],/整数/);
});
