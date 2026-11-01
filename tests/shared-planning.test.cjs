'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const kinds=['salesPlans','shippingSchedules','shippingAllocations','shippingWarehouseAllocations','shippingArrivalReceipts'];
function backup(){return {data:{products:[{internalCode:'FAKE-001',stock:99,orderRemaining:8}],...Object.fromEntries(kinds.map(k=>[k,[]])),salesActuals:[{private:'FAKE-DO-NOT-SEND'}],stockMovements:[{quantity:99}]}};}
function setup(fetchImpl,storage=new Map()){
 let session={token:'FAKE-SESSION',user:{username:'fake-admin',role:'admin'}},calls=[];
 const c={location:{pathname:'/test/'},crypto:{randomUUID:()=> '12345678-1234-4234-8234-123456789012'},TextEncoder,AbortController,setTimeout,clearTimeout,localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},inventoryServerSearch:{getSession:()=>session},fetch:async(u,o)=>{calls.push(o);return fetchImpl(u,o);}};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../shared-planning.js'),'utf8'),c);
 return {api:c.inventorySharedPlanning,c,storage,calls,session(v){session=v;}};
}
const ok=d=>({ok:true,status:200,json:async()=>({success:true,...d})});
const preview={format:'inventory-planning-preview-v1',hash:'FAKE-HASH',revision:0,can_initialize:true,counts:[]};
test('only planning data and explicit order metadata are projected; stock and sales history are absent',()=>{
 const s=setup();const b=backup(),d=s.api.project(b);assert.equal(d.purchaseMetadata[0].orderRemaining,8);assert.ok(!JSON.stringify(d).includes('FAKE-DO-NOT-SEND'));assert.ok(!('products' in d));assert.ok(!('stock' in d.purchaseMetadata[0]));assert.equal(b.data.products[0].stock,99);
});
test('missing backup collections fail and unknown order balance remains unknown',()=>{
 const s=setup(),b=backup();delete b.data.shippingSchedules;assert.throws(()=>s.api.project(b));
 const b2=backup();delete b2.data.products[0].orderRemaining;assert.equal(s.api.project(b2).purchaseMetadata[0].orderRemaining,null);
});
test('preview sends planning only and cannot save until explicitly initialized',async()=>{
 const s=setup(async()=>ok(preview));await assert.rejects(s.api.initialize());assert.equal(s.calls.length,0);
 await s.api.compare(s.api.project(backup()));assert.equal(s.calls.length,1);assert.equal(JSON.parse(s.calls[0].body).action,'preview');assert.equal(s.storage.size,0);
});
test('lost save response survives reload; same request and renewed token verify receipt without new operation',async()=>{
 const storage=new Map();let first=true;const s=setup(async()=>{if(first){first=false;return ok(preview);}throw Error('FAKE_LOST');},storage);
 await s.api.compare(s.api.project(backup()));await assert.rejects(s.api.initialize());const original=JSON.parse(s.calls[1].body);assert.ok(s.api.pending());
 const t=setup(async(u,o)=>ok({format:'inventory-planning-initialize-v1',request_id:JSON.parse(o.body).request_id,inventory_records_changed:false}),storage);
 t.session({token:'FAKE-RENEWED',user:{username:'fake-admin',role:'admin'}});await t.api.initialize();assert.equal(t.api.pending(),null);assert.deepEqual(JSON.parse(t.calls[0].body),original);assert.ok(!JSON.stringify([...storage.values()]).includes('FAKE-SESSION'));
});
test('pending result prevents comparing new contents and another administrator cannot retry',async()=>{
 let n=0;const s=setup(async()=>{if(!n++)return ok(preview);throw Error('FAKE_LOST');});await s.api.compare(s.api.project(backup()));await assert.rejects(s.api.initialize());await assert.rejects(s.api.compare(s.api.project(backup())));
 s.session({token:'FAKE-OTHER',user:{username:'other',role:'admin'}});await assert.rejects(s.api.initialize());assert.equal(s.calls.length,2);
});
test('storage failure prevents initialization request and worker cannot preview',async()=>{
 const s=setup(async()=>ok(preview));await s.api.compare(s.api.project(backup()));s.c.localStorage.setItem=()=>{throw Error('FAKE_FULL');};await assert.rejects(s.api.initialize());assert.equal(s.calls.length,1);
 s.session({token:'FAKE-WORKER',user:{username:'fake',role:'worker'}});await assert.rejects(s.api.compare(s.api.project(backup())));assert.equal(s.calls.length,1);
});
test('logout during preview discards its result',async()=>{
 let resolve;const s=setup(()=>new Promise(r=>resolve=r));const p=s.api.compare(s.api.project(backup()));s.session(null);resolve(ok(preview));await assert.rejects(p);await assert.rejects(s.api.initialize());assert.equal(s.storage.size,0);
});
test('wrong receipt retains pending operation and repeated click sends once',async()=>{
 let n=0,resolve;const s=setup(async()=>!n++?ok(preview):new Promise(r=>resolve=r));await s.api.compare(s.api.project(backup()));const send=s.api.initialize();await assert.rejects(s.api.initialize());assert.equal(s.calls.length,2);resolve(ok({format:'inventory-planning-initialize-v1',request_id:'WRONG',inventory_records_changed:false}));await assert.rejects(send);assert.ok(s.api.pending());
});
