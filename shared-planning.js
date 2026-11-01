"use strict";
(function(root){
 const endpoint='https://jyuubee.sakura.ne.jp/inventory/shared-planning-auth.php';
 const kinds=['salesPlans','shippingSchedules','shippingAllocations','shippingWarehouseAllocations','shippingArrivalReceipts','purchaseMetadata'];
 const labels=['販売予定','船便','船積振分け','倉庫振分け','入荷反映済みの記録','発注残の商品'];
 const key='inventory-planning-initialize-v1:'+root.location.pathname;
 let preview=null,busy=false,generation=0,readController=null;
 const session=()=>root.inventoryServerSearch?.getSession();
 const owner=s=>s?.token&&s.user?.username&&s.user.role==='admin'?s.user.username:null;
 function project(backup){
  const source=backup?.data;
  if(!source||!Array.isArray(source.products)||!source.products.length)throw Error('商品を含む全データバックアップを選んでください。');
  const result={};
  for(const kind of kinds.slice(0,-1)){
   if(!Array.isArray(source[kind]))throw Error('予定・船便を含む最新の全データバックアップが必要です。');
   result[kind]=source[kind];
  }
  result.purchaseMetadata=source.products.map(p=>{
   if(typeof p.internalCode!=='string'||!p.internalCode)throw Error('社内コードを確認してください。');
   const q=p.orderRemaining;
   return {internalCode:p.internalCode,orderRemaining:Number.isSafeInteger(q)&&q>=0?q:null};
  });
  if(new TextEncoder().encode(JSON.stringify(result)).length>4000000)throw Error('予定データが大きすぎます。');
  return result;
 }
 function pending(){const raw=root.localStorage.getItem(key);return raw?JSON.parse(raw):null;}
 async function request(method,body){
  const s=session();if(!s?.token)throw Error('ログインしてください。');
  const controller=new AbortController();const timer=root.setTimeout(()=>controller.abort(),30000);
  try{
   const r=await root.fetch(endpoint,{method,mode:'cors',cache:'no-store',signal:controller.signal,headers:{Accept:'application/json',...(body?{'Content-Type':'application/json'}:{}),Authorization:'Bearer '+s.token},...(body?{body:JSON.stringify(body)}:{})});
   const data=await r.json();
   if(session()?.token!==s.token)throw Error('ログイン状態が変わりました。結果を再確認してください。');
   if(!r.ok||data.success!==true){const e=Error(data.message||'共有予定を確認できません。');e.definitive=[400,409].includes(r.status)&&data.success===false;throw e;}
   return data;
  }finally{root.clearTimeout(timer);}
 }
 async function compare(data){
  if(pending())throw Error('前回の初回共有を先に再確認してください。');
  const s=session(),account=owner(s);if(!account)throw Error('管理者ログインが必要です。');
  preview=null;
  const result=await request('POST',{action:'preview',data});
  if(result.format!=='inventory-planning-preview-v1'||typeof result.hash!=='string'||!Number.isSafeInteger(result.revision)||!Array.isArray(result.counts))throw Error('確認結果の形式を確認できません。');
  if(result.can_initialize)preview={data,hash:result.hash,revision:result.revision,owner:account};
  return result;
 }
 async function initialize(){
  if(busy)throw Error('結果を確認中です。');
  const account=owner(session());if(!account)throw Error('管理者ログインが必要です。');
  let p=pending();
  if(!p){
   if(!preview||preview.owner!==account)throw Error('先に件数を確認してください。');
   p={owner:account,body:{action:'initialize',data:preview.data,hash:preview.hash,revision:preview.revision,request_id:root.crypto.randomUUID()}};
   root.localStorage.setItem(key,JSON.stringify(p));
  }
  if(p.owner!==account)throw Error('前回と同じ管理者でログインしてください。');
  busy=true;
  try{
   const result=await request('POST',p.body);
   if(result.format!=='inventory-planning-initialize-v1'||result.request_id!==p.body.request_id||result.inventory_records_changed!==false)throw Error('保存結果が未確認です。同じ操作番号で再確認してください。');
   root.localStorage.removeItem(key);preview=null;return result;
  }catch(e){if(e.definitive){root.localStorage.removeItem(key);preview=null;}throw e;}finally{busy=false;}
 }
 root.inventorySharedPlanning={project,compare,initialize,pending};
 if(!root.document)return;
 const text=(node,message)=>{if(node)node.textContent=message;};
 function counts(data){return kinds.map((k,i)=>labels[i]+'：'+(data.find(x=>x.kind===k)?.count??'未確認')+'件').join(' ／ ');}
 async function refresh(){
  const own=++generation;readController?.abort();
  const output=root.document.getElementById('shared-planning-read-status');if(!output)return;
  const token=session()?.token;
  if(!token){text(output,'ログインすると共有準備の状況を確認できます。');return;}
  text(output,'予定データの共有状況を確認しています。');
  // Read-only GET; never imports data or replays an arrival.
  const controller=new AbortController();readController=controller;const timer=root.setTimeout(()=>controller.abort(),30000);
  try{
   const r=await root.fetch(endpoint,{method:'GET',mode:'cors',cache:'no-store',signal:controller.signal,headers:{Accept:'application/json',Authorization:'Bearer '+token}});
   const d=await r.json();if(own!==generation||token!==session()?.token)return;
   if(!r.ok||d.success!==true||d.format!=='inventory-shared-planning-v1'||typeof d.initialized!=='boolean')throw Error('共有予定の準備が必要です。管理者に確認してください。');
   if(!d.initialized)text(output,'販売予定・船便・発注残はまだ共有されていません。発注・船積みの判定は準備中です。');
   else if(!Array.isArray(d.counts))throw Error('共有予定の応答を確認できません。');
   else text(output,'共有済み（初回共有の内容）：'+counts(d.counts)+'。共有日時：'+d.updated_at+'。発注・船積みの判定は、販売実績の共有と判定処理の接続後に表示します。');
  }catch(e){if(own===generation)text(output,e.name==='AbortError'?'通信が時間切れになりました。再確認してください。':e.message);}finally{root.clearTimeout(timer);}
 }
 root.document.addEventListener('DOMContentLoaded',()=>{
  const style=root.document.createElement('style');style.textContent='body[data-workspace="legacy"] #shared-planning-home{display:none!important} #shared-planning-home,#shared-planning-settings{margin:16px 0;padding:16px;border:1px solid #b6d5f0;border-radius:10px} #shared-planning-settings p,#shared-planning-home p{line-height:1.7} #shared-planning-settings input{width:100%} #shared-planning-settings button{margin:8px 8px 0 0}';root.document.head.appendChild(style);
  const home=root.document.getElementById('common-workspace-home');
  if(home){const box=root.document.createElement('section');box.id='shared-planning-home';box.innerHTML='<strong>発注・船積みの共有準備</strong><p id="shared-planning-read-status" role="status"></p><button type="button">共有状況を再確認</button>';home.insertAdjacentElement('afterend',box);box.querySelector('button').addEventListener('click',refresh);}
  const screen=root.document.getElementById('app-settings-screen');
  if(screen){
   const box=root.document.createElement('section');box.id='shared-planning-settings';
   box.innerHTML='<h3>販売予定・船便・発注残の初回共有（管理者用）</h3><p>最新の全データバックアップから予定情報だけを送ります。商品の在庫数・売上履歴は送信せず、在庫は変更しません。過去の入荷も再反映しません。登録済みの共有予定は上書きしません。</p><input type="file" accept=".json,application/json" aria-label="全データバックアップ"><button type="button" data-preview>件数を確認する</button><button type="button" data-apply disabled>確認した予定データを初回共有する</button><button type="button" data-retry>前回の初回共有を再確認</button><p data-status role="status"></p>';
   screen.appendChild(box);const output=box.querySelector('[data-status]'),apply=box.querySelector('[data-apply]');
   let working=false;
   function sync(){box.hidden=root.document.body.dataset.roleMode==='worker';box.querySelector('[data-retry]').hidden=!pending();}
   box.querySelector('[data-preview]').addEventListener('click',async()=>{
    if(working)return;working=true;apply.disabled=true;preview=null;
    try{const file=box.querySelector('input').files[0];if(!file)throw Error('全データバックアップJSONを選んでください。');if(file.size>100000000)throw Error('100MB以下の全データバックアップJSONを選んでください。');
     text(output,'バックアップを読み込んでいます。予定情報だけを確認します。');
     const d=project(JSON.parse(await file.text()));const r=await compare(d);text(output,counts(r.counts)+(r.can_initialize?'。まだ保存されていません。':'。共有予定は登録済みです。上書きしません。'));apply.disabled=!r.can_initialize;
    }catch(e){text(output,e.message);}finally{working=false;sync();}
   });
   async function save(retry){
    if(working)return;if(!retry&&!root.confirm('確認した販売予定・船便・発注残を共有します。在庫数は変更しません。続けますか？'))return;
    working=true;apply.disabled=true;
    try{await initialize();text(output,'予定データの初回共有を確認しました。在庫数は変更していません。');await refresh();}catch(e){text(output,e.message);}finally{working=false;sync();}
   }
   apply.addEventListener('click',()=>save(false));box.querySelector('[data-retry]').addEventListener('click',()=>save(true));
   box.querySelector('input').addEventListener('change',()=>{preview=null;apply.disabled=true;});
   root.addEventListener('inventory-role-mode-change',sync);sync();
  }
  root.addEventListener('inventory-server-auth-changed',()=>{preview=null;root.document.querySelector('#shared-planning-settings [data-apply]')?.setAttribute('disabled','');void refresh();});
  void refresh();
 });
})(typeof window==='undefined'?globalThis:window);
