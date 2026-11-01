"use strict";
(function(root){
 function today(){return new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}
 function calculate(snapshot,day=today()){
  if(!root.inventorySharedSalesSummary.date(day))throw Error('判定日を確認してください。');
  const plans=snapshot.planning?.data,sales=snapshot.sales?.data;
  if(!plans)throw Error('販売予定・船便・発注残の初回共有が必要です。');
  if(!sales)throw Error('販売実績の月別集計がまだ共有されていません。');
  for(const k of ['salesPlans','shippingSchedules','shippingAllocations','shippingWarehouseAllocations','shippingArrivalReceipts','purchaseMetadata'])if(!Array.isArray(plans[k]))throw Error('共有予定の形式を確認してください。');
  const actuals=root.inventorySharedSalesSummary.expand(sales),anchor=new Date(day+'T12:00:00');
  for(const p of plans.salesPlans){const range=root.getNormalShipmentPlanRange(p);if(!range||!root.inventorySharedSalesSummary.date(range.startDate)||!root.inventorySharedSalesSummary.date(range.endDate)||range.startDate>range.endDate)throw Error('共有した販売予定の対象期間を確認してください。');}
  const balances=new Map(plans.purchaseMetadata.map(p=>[p.internalCode,p.orderRemaining])),unknown=[];
  const products=snapshot.products.map(p=>{
   if(!p.internal_code||!Number.isSafeInteger(p.total_stock)||p.total_stock<0)throw Error('共有在庫の数量を確認できません。');
   const q=balances.get(p.internal_code),product={internalCode:p.internal_code,productCode:p.product_code,productName:p.product_name,supplier:p.supplier_name,productStatus:p.product_status,backorderStatus:p.product_status,stock:p.total_stock,orderRemaining:Number.isSafeInteger(q)&&q>=0?q:null};
   if(product.orderRemaining===null&&!root.isPurchaseDiscontinuedProduct(product))unknown.push(product);return product;
  });
  // Unknown balances are excluded from numeric purchase judgments, not coerced to 0.
  const purchase=root.purchaseRequiredApp.calculateShared(products.filter(p=>p.orderRemaining!==null),actuals,plans.salesPlans,sales.ranges.map(r=>({reportStartDate:r.startDate,reportEndDate:r.endDate})),anchor);
  const shipping=root.shippingScheduleApp.calculateShared({schedules:plans.shippingSchedules,allocations:plans.shippingAllocations,products,actuals,plans:plans.salesPlans,warehouseAllocations:plans.shippingWarehouseAllocations,arrivalReceipts:plans.shippingArrivalReceipts},day);
  let shipCoverage=null;
  if(shipping.hasSchedule&&shipping.targetPeriod){const ctx=root.buildShippingAverageContext(shipping.schedule.warehouseArrivalDate.slice(0,7));shipCoverage=root.calculatePurchaseActualCoverage(sales.ranges.map(r=>({reportStartDate:r.startDate,reportEndDate:r.endDate})),ctx.startMonth+'-01',root.getPurchaseLastDateOfMonth(ctx.endMonth));}
  return {day,purchase,shipping,unknown,shipCoverage,salesDate:snapshot.sales.updated_at,planningDate:snapshot.planning.updated_at,fetchedAt:snapshot.fetched_at};
 }
 root.inventorySharedDecisions={calculate};
 if(!root.document)return;
 let generation=0,box,status,output;
 const element=(tag,text)=>{const n=root.document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
 function isShared(){return root.inventoryCommonWorkspace?.mode()!=='legacy';}
 function reset(message){if(output)output.replaceChildren();if(status)status.textContent=message;}
 function list(title,rows,describe){const details=element('details'),heading=element('summary',title);details.appendChild(heading);const search=element('input');search.type='search';search.placeholder='商品コード・商品名で絞り込み';search.setAttribute('aria-label',title+'を検索');details.appendChild(search);const items=element('div');details.appendChild(items);
  function render(){items.replaceChildren();const q=search.value.trim().toLowerCase(),filtered=rows.filter(r=>[r.internalCode,r.productCode,r.productName].some(v=>String(v||'').toLowerCase().includes(q)));if(!filtered.length)items.appendChild(element('p','該当する商品はありません。'));for(const r of filtered){const card=element('article');card.appendChild(element('strong',[r.internalCode,r.productCode,r.productName].filter(Boolean).join(' ／ ')));card.appendChild(element('p',describe(r)));items.appendChild(card);}}search.addEventListener('input',render);render();return details;
 }
 async function refresh(){
  const own=++generation;box.hidden=!isShared();reset('共有データを読み込んでいます。');
  const token=root.inventoryServerSearch?.getSession()?.token;if(!isShared()||!token){reset('ログインすると共有データの参考判定を確認できます。');return;}
  try{const snapshot=await root.inventorySharedSalesSummary.read();if(own!==generation||!isShared()||token!==root.inventoryServerSearch?.getSession()?.token)return;const d=calculate(snapshot);reset('判定日：'+d.day+' ／ 実績共有日時：'+d.salesDate+' ／ 予定共有日時：'+d.planningDate+' ／ 在庫取得：'+d.fetchedAt+'。共有した実績・予定の時点による参考判定です。その後の実績・予定の変更は自動同期されません。');
   if(!d.purchase.context.coverage.complete)output.appendChild(element('p','⚠ 発注の直近6か月の実績期間に未確認部分があります。数量は参考値です。'));
   const required=d.purchase.rows.filter(r=>r.judgment==='required');
   output.appendChild(list('発注が必要（参考）：'+required.length+'商品',required,r=>'不足 '+r.shortage+'個 ／ 現在庫 '+r.currentStock+'個 ／ 発注残 '+r.orderRemaining+'個 ／ 月平均 '+r.monthlyAverage+'個 ／ 販売予定 '+r.plannedQuantity+'個'+(r.seasonalApplied?' ／ 季節補正あり':'')));
   const ordered=d.purchase.rows.filter(r=>r.judgment==='ordered');output.appendChild(list('発注残で補える商品：'+ordered.length+'商品',ordered,r=>'現在庫 '+r.currentStock+'個 ／ 発注残 '+r.orderRemaining+'個 ／ 必要数 '+r.requiredStock+'個'));
   if(d.unknown.length)output.appendChild(list('発注残が未確認のため未判定：'+d.unknown.length+'商品',d.unknown,()=> '発注残が未確認です。0個として計算していません。'));
   if(!d.shipping.hasSchedule)output.appendChild(element('p','船積み：対象の未確定船便がありません。'));
   else if(!d.shipping.targetPeriod)output.appendChild(element('p','船積み：'+d.shipping.schedule.name+' の次便が未登録のため、対象期間を判定できません。'));
   else{if(!d.shipCoverage?.complete)output.appendChild(element('p','⚠ 船積みの月平均に使う実績期間に未確認部分があります。数量は参考値です。'));output.appendChild(element('p','対象船便：'+d.shipping.schedule.name+' ／ 対象期間：'+d.shipping.targetPeriod.startDate+' ～ '+d.shipping.targetPeriod.endDate));output.appendChild(list('船積みが必要（参考）：'+d.shipping.count+'商品',d.shipping.rows,r=>'未振分 '+r.remainingQuantity+'個 ／ 推奨 '+r.recommendedQuantity+'個 ／ 振分済 '+r.currentAllocation+'個 ／ 月平均 '+r.monthlyAverage+'個 ／ 販売予定 '+r.plannedQuantity+'個'+(r.priorYearAdjustmentStatus==='applied'?' ／ 前年実績補正あり':'')));}
  }catch(e){if(own===generation)reset(e.message);}
 }
 root.document.addEventListener('DOMContentLoaded',()=>{
  const home=root.document.getElementById('common-workspace-home');if(!home)return;
  box=element('section');box.id='shared-decisions-home';box.appendChild(element('h3','発注・船積み'));status=element('p');status.setAttribute('role','status');box.appendChild(status);const button=element('button','共有データで再計算');button.type='button';button.addEventListener('click',refresh);box.appendChild(button);output=element('div');box.appendChild(output);home.insertAdjacentElement('afterend',box);
  const style=element('style');style.textContent='#shared-decisions-home,#shared-summary-settings{margin:20px 0;padding:18px;border:1px solid #b6d5f0;border-radius:12px;background:white} #shared-decisions-home details{margin:12px 0;padding:12px;border:1px solid #cfe0ef;border-radius:8px} #shared-decisions-home summary{font-weight:bold;cursor:pointer} #shared-decisions-home article{margin:10px 0;padding:10px;background:#f2f7fb;border-radius:6px} #shared-decisions-home input,#shared-summary-settings input{width:100%;margin:10px 0} #shared-summary-settings button{margin:6px} #shared-decisions-home p{line-height:1.7}';root.document.head.appendChild(style);
  root.addEventListener('inventory-server-auth-changed',refresh);root.addEventListener('inventory-workspace-changed',refresh);void refresh();
 });
})(typeof window==='undefined'?globalThis:window);
