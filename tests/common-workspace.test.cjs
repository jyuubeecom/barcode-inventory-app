'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
function setup(saved={},role='admin') {
 const values=new Map(Object.entries(saved)),listeners={},events=[],screens=[];
 const context={localStorage:{getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value)},
  document:{body:{dataset:{roleMode:role}},addEventListener(){},getElementById(){return null;}},
  dispatchEvent:event=>events.push(event),inventoryApp:{showScreen:name=>screens.push(name)}};
 context.window=context;context.CustomEvent=function(type,options){this.type=type;this.detail=options.detail;};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../common-workspace.js'),'utf8'),context);
 return {api:context.inventoryCommonWorkspace,values,context,events,screens};
}
test('fresh workspace uses common data without altering any inventory or stored credentials',()=>{
 const s=setup({inventory:'FAKE-INVENTORY',barcodeInventoryServerAccessToken:'FAKE-TOKEN'});
 assert.equal(s.api.mode(),'shared');assert.equal(s.api.source(),'server');assert.equal(s.values.size,2);
 assert.equal(s.values.get('inventory'),'FAKE-INVENTORY');
});
test('legacy mode is an explicit administrator choice; changing mode returns home and notifies screens',()=>{
 const s=setup();s.api.setMode('legacy');assert.equal(s.api.source(),'local');
 assert.equal(s.context.document.body.dataset.workspace,'legacy');assert.deepEqual(s.screens,['home']);
 assert.equal(s.events[0].detail.source,'local');s.api.setMode('shared');assert.equal(s.api.source(),'server');
});
test('worker ignores an administrator legacy choice and cannot enable local workflows',()=>{
 const s=setup({barcodeInventoryWorkspace:'legacy'},'worker');
 assert.equal(s.api.source(),'server');assert.throws(()=>s.api.setMode('legacy'),/管理者/);
 assert.equal(s.screens.length,0);assert.equal(s.events.length,0);
});
test('blocked storage defaults to common data and a failed setting write does not navigate',()=>{
 const s=setup();s.context.localStorage.getItem=()=>{throw Error('FAKE_BLOCKED');};
 s.context.localStorage.setItem=()=>{throw Error('FAKE_FULL');};
 assert.equal(s.api.source(),'server');assert.throws(()=>s.api.setMode('legacy'));assert.equal(s.screens.length,0);
});
test('invalid mode cannot change persisted choice',()=>{
 const s=setup();assert.throws(()=>s.api.setMode('other'));assert.equal(s.values.size,0);
});
