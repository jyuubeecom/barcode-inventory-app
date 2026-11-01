"use strict";
(function(root){
 const endpoint='https://jyuubee.sakura.ne.jp/inventory/shared-sales-summary-auth.php';
 const key='inventory-sales-summary-initialize-v1:'+root.location.pathname;
 const rule='monthly-customer-exclusion-v1';
 let preview=null,busy=false;
 const session=()=>root.inventoryServerSearch?.getSession();
 const owner=s=>s?.token&&s.user?.username&&s.user.role==='admin'?s.user.username:null;
 function date(v){if(typeof v!=='string'||!/^(19|20)\d{2}-\d{2}-\d{2}$/.test(v))return false;const d=new Date(v+'T12:00:00Z');return !Number.isNaN(d.getTime())&&d.toISOString().slice(0,10)===v;}
 function project(backup){
  const d=backup?.data,actuals=d?.salesActuals,batches=d?.salesImportBatches;
  if(!Array.isArray(actuals)||!actuals.length||actuals.length>1000000||!Array.isArray(batches))throw Error('販売実績と取込期間を含む全データバックアップが必要です。');
  const excluded=root.normalShipmentCalculator?.isAverageExcludedCustomer;if(typeof excluded!=='function')throw Error('取引先の除外判定を読み込めませんでした。');
  const groups=new Map();
  actuals.forEach((r,i)=>{
   const code=String(r?.internalCode??'').trim(),q=Number(r?.quantity);
   if(!code||new TextEncoder().encode(code).length>200||!date(r?.saleDate)||r.quantity===null||r.quantity===''||!Number.isSafeInteger(q))throw Error('販売実績の'+(i+1)+'行目の商品・日付・数量を確認してください。');
   const month=r.saleDate.slice(0,7),key=JSON.stringify([code,month]);
   if(!groups.has(key))groups.set(key,{internalCode:code,month,ordinary:0,excluded:0});
   const item=groups.get(key),field=excluded(r.customerName)?'excluded':'ordinary';item[field]+=q;
   if(!Number.isSafeInteger(item[field])||Math.abs(item[field])>1000000000)throw Error('月別実績の数量が大きすぎます。');
  });
  const ranges=[];const seen=new Set();
  for(const b of batches){
   // Old imports without a recorded period are unknown coverage, never zero sales.
   if(!b?.reportStartDate&&!b?.reportEndDate)continue;
   if(!date(b?.reportStartDate)||!date(b?.reportEndDate)||b.reportStartDate>b.reportEndDate)throw Error('実績CSVの取込対象期間を確認してください。');
   const k=b.reportStartDate+':'+b.reportEndDate;if(!seen.has(k)){ranges.push({startDate:b.reportStartDate,endDate:b.reportEndDate});seen.add(k);}
  }
  const result={rule,sourceCount:actuals.length,months:[...groups.values()].sort((a,b)=>a.internalCode.localeCompare(b.internalCode)||a.month.localeCompare(b.month)),ranges:ranges.sort((a,b)=>a.startDate.localeCompare(b.startDate)||a.endDate.localeCompare(b.endDate))};
  if(result.months.length>30000||ranges.length>10000||new TextEncoder().encode(JSON.stringify(result)).length>4000000)throw Error('月別実績が大きすぎます。共有方法の拡張が必要です。');
  return result;
 }
 function expand(data){
  if(data?.rule!==rule||!Array.isArray(data.months)||!Array.isArray(data.ranges))throw Error('共有実績の形式を確認できません。');
  return data.months.flatMap(r=>[{internalCode:r.internalCode,saleDate:r.month+'-01',quantity:r.ordinary,customerName:'共有通常取引'},{internalCode:r.internalCode,saleDate:r.month+'-01',quantity:r.excluded,customerName:'清水産業'}]);
 }
 function pending(){const raw=root.localStorage.getItem(key);return raw?JSON.parse(raw):null;}
 async function request(method,body){
  const s=session();if(!s?.token)throw Error('ログインしてください。');
  const ctrl=new AbortController(),timer=root.setTimeout(()=>ctrl.abort(),30000);
  try{
   const r=await root.fetch(endpoint,{method,mode:'cors',cache:'no-store',signal:ctrl.signal,headers:{Accept:'application/json',Authorization:'Bearer '+s.token,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});const d=await r.json();
   if(session()?.token!==s.token)throw Error('ログイン状態が変わりました。再確認してください。');
   if(!r.ok||d.success!==true){if(r.status===401)root.inventoryServerSearch?.expireSession();const e=Error(d.message||'共有判定を取得できません。');e.definitive=[400,409].includes(r.status)&&d.success===false;throw e;}return d;
  }finally{root.clearTimeout(timer);}
 }
 async function read(){const d=await request('GET');if(d.format!=='inventory-shared-decisions-v1'||d.complete!==true||d.inventory_records_changed!==false||!Array.isArray(d.products)||!d.planning||!d.sales)throw Error('共有判定の応答を確認できません。');return d;}
 async function compare(data){
  preview=null;if(pending())throw Error('前回の実績共有を先に再確認してください。');
  const account=owner(session());if(!account)throw Error('管理者ログインが必要です。');
  const d=await request('POST',{action:'preview',data});
  if(d.format!=='inventory-summary-preview-v1'||!Number.isSafeInteger(d.revision)||typeof d.hash!=='string'||!d.counts||typeof d.can_initialize!=='boolean')throw Error('件数確認の応答を確認できません。');
  if(d.can_initialize)preview={data,hash:d.hash,revision:d.revision,owner:account};return d;
 }
 async function initialize(){
  if(busy)throw Error('実績共有の結果を確認中です。');const account=owner(session());if(!account)throw Error('管理者ログインが必要です。');
  let p=pending();if(!p){if(!preview||preview.owner!==account)throw Error('先に件数を確認してください。');p={owner:account,body:{action:'initialize',data:preview.data,hash:preview.hash,revision:preview.revision,request_id:root.crypto.randomUUID()}};root.localStorage.setItem(key,JSON.stringify(p));}
  if(p.owner!==account)throw Error('前回と同じ管理者でログインしてください。');busy=true;
  try{const d=await request('POST',p.body);if(d.format!=='inventory-summary-initialize-v1'||d.request_id!==p.body.request_id||d.inventory_records_changed!==false)throw Error('保存結果が未確認です。同じ操作番号で再確認してください。');root.localStorage.removeItem(key);preview=null;return d;}
  catch(e){if(e.definitive){root.localStorage.removeItem(key);preview=null;}throw e;}finally{busy=false;}
 }
 root.inventorySharedSalesSummary={project,expand,date,read,compare,initialize,pending,invalidate(){preview=null;}};
})(typeof window==='undefined'?globalThis:window);
