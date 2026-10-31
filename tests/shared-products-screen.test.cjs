'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
function setup(fetch) {
  let token='FAKE-A';
  const content={innerHTML:'',querySelector(){return null;},querySelectorAll(){return [];}};
  const window={setTimeout,clearTimeout,addEventListener(){},dispatchEvent(){},inventoryServerSearch:{hasSession:()=>!!token}};
  const c=vm.createContext({window,document:{addEventListener(){},body:{contains:()=>true}},sessionStorage:{getItem:()=>token,removeItem(){token='';}},AbortController,fetch,console,CustomEvent:function(){}});
  let src=fs.readFileSync(path.join(__dirname,'../server-product-list.js'),'utf8');
  src=src.replace('  function createStyles() {',`  window.testHooks={load:loadServerProducts, auth:handleServerAuthChanged,
    local(){invalidateRequest();currentSource='local';}, filter:applyLocalFiltersAndSort,
    keyword(value){lastKeyword=value;}, location(value){lastLocationFilter=value;},
    init(value){content=value;currentSource='server';listScreen={hidden:false};}};
  function createStyles() {`);
  vm.runInContext(src,c);window.testHooks.init(content);
  return {h:window.testHooks,content,setToken(v){token=v;}};
}
function item(n,extra={}){return {internal_code:'FAKE-'+n,product_name:'架空'+n,product_code:'P-'+n,jan_code:'',total_stock:n,min_stock:0,product_status:'専用商品',stocks:[{location_name:'本社 / 特別区画',quantity:n}],...extra};}
function response(items){return {ok:true,status:200,json:async()=>({success:true,format:'inventory-shared-products-v1',complete:true,count:items.length,items})};}
test('all 597 shared products are searchable beyond the previous 200 limit; location names containing slashes remain intact',async()=>{
  const s=setup(async()=>response(Array.from({length:597},(_,i)=>item(i))));
  await s.h.load('');assert.match(s.content.innerHTML,/全 597件/);assert.match(s.content.innerHTML,/FAKE-596/);
  s.h.keyword('Ｐ－５９６');const matches=s.h.filter(Array.from({length:597},(_,i)=>item(i)));
  assert.equal(matches.length,1);assert.equal(matches[0].internal_code,'FAKE-596');
  s.h.location('本社 / 特別区画');assert.equal(s.h.filter([item(596)]).length,1);
});
test('logout suppresses an old successful response and clears previously displayed products',async()=>{
  let resolve;const s=setup(()=>new Promise(r=>resolve=r));const pending=s.h.load('');
  s.setToken('');s.h.auth({detail:{loggedIn:false}});resolve(response([item(1)]));await pending;
  assert.doesNotMatch(s.content.innerHTML,/FAKE-1/);assert.match(s.content.innerHTML,/ログイン/);
});
test('late 401 from an old session cannot clear a new session or replace its results',async()=>{
  let resolve;let calls=0;const s=setup(()=>++calls===1?new Promise(r=>resolve=r):Promise.resolve(response([item(2)])));
  const old=s.h.load('');s.setToken('FAKE-B');s.h.auth({detail:{loggedIn:true}});
  await new Promise(r=>setImmediate(r));resolve({status:401,ok:false,json:async()=>({success:false})});await old;
  assert.match(s.content.innerHTML,/FAKE-2/);assert.doesNotMatch(s.content.innerHTML,/ログインが必要/);
});
test('switching to local data ignores pending shared requests',async()=>{
  let resolve;const s=setup(()=>new Promise(r=>resolve=r));const old=s.h.load('');s.h.local();
  s.content.innerHTML='LOCAL';resolve(response([item(1)]));await old;assert.equal(s.content.innerHTML,'LOCAL');
});
test('incomplete or old endpoint responses are rejected instead of presented as all products',async()=>{
  const s=setup(async()=>({ok:true,status:200,json:async()=>({success:true,count:597,items:[item(1)]})}));
  await s.h.load('');assert.match(s.content.innerHTML,/全件の取得を確認できません/);assert.doesNotMatch(s.content.innerHTML,/商品一覧を更新しました/);
});
test('names and locations are escaped when rendering shared products',async()=>{
  const s=setup(async()=>response([item(1,{product_name:'<img src=x onerror=alert(1)>',stocks:[{location_name:'<script>',quantity:1}]})]));
  await s.h.load('');assert.doesNotMatch(s.content.innerHTML,/<img|<script>/);assert.match(s.content.innerHTML,/&lt;img/);
});
