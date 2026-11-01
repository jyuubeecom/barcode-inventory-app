'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
function setup(fetchImpl,localProducts=[]) {
  let token='FAKE-A',localReads=0,normalizations=0,printed='';const elements=new Map();
  function element(selector){if(!elements.has(selector))elements.set(selector,{value:selector.endsWith('-location')?'__all__':'',hidden:false,disabled:false,textContent:'',innerHTML:'',addEventListener(){},click(){},get options(){return Array.from(this.innerHTML.matchAll(/value="([^"]*)"/g),m=>({value:m[1]}));}});return elements.get(selector);}
  const doc={addEventListener(){},querySelector(selector){return selector.includes('print-dialog')?null:element(selector);}};
  const window={setTimeout,clearTimeout,alert(){},addEventListener(){},dispatchEvent(){window.h.auth();},inventoryServerSearch:{hasSession:()=>!!token},open(){return {document:{open(){},write(html){printed=html;},close(){}}};}};
  const c=vm.createContext({window,document:doc,AbortController,fetch:fetchImpl,console,sessionStorage:{getItem:()=>token,removeItem(){token='';}},CustomEvent:function(){},getAllProducts:async()=>{localReads++;return localProducts;},getProductLocationStocks:product=>{normalizations++;return product.locationStocks || [];}});
  let src=fs.readFileSync(path.join(__dirname,'../location-stock-report.js'),'utf8');
  src=src.replace('  function formatNumber(value) {',`  window.h={state,rows:buildSharedRows,reload:reloadReport,visible:getVisibleRows,auth:handleReportAuthChanged,
    scroll:moveReportHorizontally,scrollControls:updateScrollControls,
    print:openPrintWindow,invalidate:invalidateReportRequest,source(value){state.source=value;},
    localRows:buildAllLocationRows};
  function formatNumber(value) {`);
  vm.runInContext(src,c);
  return {h:window.h,element,token(v){token=v;},reads:()=>localReads,normalizations:()=>normalizations,printed:()=>printed};
}
const product={internal_code:'FAKE-MIGRATION-ADD-001',product_code:'P-001',product_name:'架空商品',color:'青',product_status:'専用商品',total_stock:3,stocks:[{location_name:'本社',quantity:2},{location_name:'酒本倉庫1階',quantity:1},{location_name:'ゼロ / 区画',quantity:0}]};
function data(items=[product]){return {success:true,format:'inventory-shared-products-v1',complete:true,count:items.length,fetched_at:'2026-10-31T11:00:00Z',items};}
const response=d=>({ok:true,status:200,json:async()=>d});
const plain=v=>JSON.parse(JSON.stringify(v));
test('shared report uses exact location quantities and fixed status without local normalization or merging',async()=>{
 const s=setup(async()=>response(data()));s.h.source('server');await s.h.reload();
 assert.equal(s.reads(),0);assert.equal(s.normalizations(),0);assert.equal(s.h.state.ready,true);assert.equal(s.h.state.rows.length,2);
 assert.equal(s.h.state.rows.reduce((n,r)=>n+r.stock,0),3);assert.ok(s.h.state.rows.every(r=>r.status==='専用商品'));
 s.element('#location-stock-report-location').value='酒本倉庫1階';assert.equal(s.h.visible()[0].stock,1);
 s.element('#location-stock-report-search').value='ＦＡＫＥ－ＭＩＧＲＡＴＩＯＮ';assert.equal(s.h.visible().length,1);
 assert.match(s.element('#location-stock-report-status').textContent,/共有サーバー.*取得日時/);
});
test('exact shared place names, unknown place and zero/absent places follow report policy',()=>{
 const s=setup();const items=[{...product,total_stock:4,stocks:[{location_name:'未確認',quantity:1},{location_name:'本社 / Ａ ',quantity:3},{location_name:'ゼロ',quantity:0}]},{...product,internal_code:'EMPTY',total_stock:0,stocks:[]}];
 const rows=s.h.rows(data(items));assert.deepEqual(plain(rows.map(r=>r.location).sort()),['本社 / Ａ ','未確認'].sort());assert.equal(rows.length,2);
});
test('incomplete, duplicate and inconsistent shared snapshots cannot be displayed',()=>{
 const s=setup();for(const d of [data([product,product]),{...data(),complete:false},{...data(),count:200},data([{...product,total_stock:4}]),data([{...product,stocks:[{location_name:'本社',quantity:-1}]}]),data([{...product,total_stock:4,stocks:[{location_name:'本社',quantity:2},{location_name:'本社',quantity:2}]}])])assert.throws(()=>s.h.rows(d));
});
test('switching to local source discards an in-flight shared response and does not write local data',async()=>{
 let resolve;const s=setup(()=>new Promise(r=>resolve=r),[]);s.h.source('server');const pending=s.h.reload();
 s.h.source('local');await s.h.reload();resolve(response(data()));await pending;
 assert.equal(s.reads(),1);assert.equal(s.h.state.source,'local');assert.equal(s.h.state.rows.length,0);assert.match(s.element('#location-stock-report-status').textContent,/この端末の在庫/);
});
test('logout removes displayed data and pending responses cannot restore it',async()=>{
 let resolve;let calls=0;const s=setup(()=>++calls===1?Promise.resolve(response(data())):new Promise(r=>resolve=r));
 s.h.source('server');await s.h.reload();const pending=s.h.reload();s.token('');s.h.auth();
 resolve(response(data()));await pending;
 assert.equal(s.h.state.ready,false);assert.equal(s.h.state.rows.length,0);assert.equal(s.element('#location-stock-report-print-button').disabled,true);
 assert.match(s.element('#location-stock-report-status').textContent,/ログインが必要/);
});
test('late unauthorized response cannot invalidate a newer session',async()=>{
 let resolve;let calls=0;const s=setup(()=>++calls===1?new Promise(r=>resolve=r):Promise.resolve(response(data())));
 s.h.source('server');const pending=s.h.reload();s.token('FAKE-B');s.h.auth();await new Promise(r=>setImmediate(r));
 resolve({status:401,ok:false});await pending;assert.equal(s.h.state.ready,true);assert.equal(s.h.state.rows.length,2);
});
test('failed refresh clears old quantities and disables printing rather than showing stale data as fresh',async()=>{
 let calls=0;const s=setup(async()=>{if(++calls===1)return response(data());throw new Error('FAKE_OFFLINE');});s.h.source('server');await s.h.reload();await s.h.reload();
 assert.equal(s.h.state.ready,false);assert.equal(s.h.state.rows.length,0);assert.match(s.element('#location-stock-report-status').textContent,/FAKE_OFFLINE/);
 assert.equal(s.h.print('test',[{stock:9}],''),false);assert.equal(s.printed(),'');
});
test('printed report labels its source and snapshot time, escapes metadata and prints selected location only',async()=>{
 const s=setup(async()=>response(data([{...product,product_name:'<script>alert(1)</script>'}])));s.h.source('server');await s.h.reload();s.element('#location-stock-report-location').value='酒本倉庫1階';
 assert.equal(s.h.print('現在庫表',s.h.visible(),'酒本倉庫1階'),true);
 const html=s.printed();assert.match(html,/データ元：共有サーバーの在庫.*取得日時/);assert.match(html,/在庫合計 1個/);assert.match(html,/&lt;script&gt;alert/);assert.doesNotMatch(html,/<script>alert\(1\)/);
});

test('default local report preserves the existing positive-stock policy and never fetches shared data',async()=>{
 let requests=0;const products=[{internalCode:'LOCAL',productName:'端末の商品',productStatus:'廃盤予定',locationStocks:[{location:'本社',stock:8},{location:'酒本倉庫1階',stock:2},{location:'未確認',stock:1},{location:'ゼロ',stock:0}]}];
 const original=JSON.stringify(products);const s=setup(async()=>{requests++;throw new Error('unexpected');},products);
 await s.h.reload();assert.equal(s.h.state.source,'local');assert.equal(s.reads(),1);assert.equal(requests,0);
 assert.equal(s.h.state.rows.length,2);assert.equal(s.h.state.rows.reduce((n,r)=>n+r.stock,0),10);assert.ok(s.h.state.rows.every(r=>r.status==='廃盤予定'));
 assert.equal(JSON.stringify(products),original);
});


test('horizontal controls reflect both edges and hidden or fully fitting tables',()=>{
 const s=setup(async()=>{throw new Error('unexpected request');});
 const wrap=s.element('#location-stock-report-table-scroll');
 Object.assign(wrap,{clientWidth:500,scrollWidth:1200,scrollLeft:0,hidden:false,style:{setProperty(){}}});
 s.h.scrollControls();
 for(const position of ['top','bottom']){
  assert.equal(s.element(`#location-stock-report-scroll-controls-${position}`).hidden,false);
  assert.equal(s.element(`#location-stock-report-scroll-left-${position}`).disabled,true);
  assert.equal(s.element(`#location-stock-report-scroll-right-${position}`).disabled,false);
 }
 wrap.scrollLeft=700;s.h.scrollControls();
 assert.equal(s.element('#location-stock-report-scroll-right-top').disabled,true);
 assert.equal(s.element('#location-stock-report-scroll-left-bottom').disabled,false);
 wrap.scrollWidth=500;s.h.scrollControls();assert.equal(s.element('#location-stock-report-scroll-controls-top').hidden,true);
 wrap.scrollWidth=1200;wrap.hidden=true;s.h.scrollControls();assert.equal(s.element('#location-stock-report-scroll-controls-bottom').hidden,true);
});

test('horizontal buttons move only the table and align frozen identity columns to measured widths',()=>{
 const s=setup(async()=>{throw new Error('unexpected request');});let move,offset;
 const wrap=s.element('#location-stock-report-table-scroll');Object.assign(wrap,{clientWidth:500,scrollWidth:1200,hidden:false,scrollLeft:100,scrollBy(options){move=options;},style:{setProperty(k,v){offset=[k,v];}}});
 s.element('#location-stock-report-head .report-pin-code').getBoundingClientRect=()=>({width:142});
 s.h.scrollControls();assert.deepEqual(offset,['--report-pinned-code-offset','142px']);
 s.h.scroll(1);assert.equal(move.left,300);s.h.scroll(-1);assert.equal(move.left,-300);
 assert.equal(s.reads(),0);assert.equal(s.normalizations(),0);
});
