"use strict";
(function(root){
 root.document.addEventListener('DOMContentLoaded',()=>{
  const screen=root.document.getElementById('app-settings-screen');if(!screen)return;
  const api=root.inventorySharedSalesSummary,box=root.document.createElement('section');box.id='shared-summary-settings';
  box.innerHTML='<h3>販売実績の月別集計を初回共有（管理者用）</h3><p>最新の全データバックアップから商品別・月別の実績を集計します。清水産業・後藤は月平均から除外します。在庫数・取引先名・売上明細は送信しません。過去の出庫を再実行しません。共有済みの実績集計は上書きしません。</p><input type="file" accept=".json,application/json" aria-label="実績を含む全データバックアップ"><button type="button" data-preview>件数を確認する</button><button type="button" data-apply disabled>確認した月別実績を初回共有する</button><button type="button" data-retry>前回の実績共有を再確認</button><p data-status role="status"></p>';
  screen.appendChild(box);const input=box.querySelector('input'),output=box.querySelector('[data-status]'),apply=box.querySelector('[data-apply]'),retry=box.querySelector('[data-retry]');let working=false,generation=0;
  function sync(){box.hidden=root.document.body.dataset.roleMode==='worker';retry.hidden=!api.pending();}
  function invalidate(){generation++;api.invalidate();apply.disabled=true;}
  input.addEventListener('change',invalidate);root.addEventListener('inventory-server-auth-changed',()=>{invalidate();output.textContent='';sync();});root.addEventListener('inventory-role-mode-change',()=>{invalidate();sync();});
  box.querySelector('[data-preview]').addEventListener('click',async()=>{
   if(working)return;invalidate();const own=generation;working=true;
   try{const f=input.files[0];if(!f||f.size>100000000)throw Error('100MB以下の全データバックアップJSONを選んでください。');output.textContent='バックアップから月別実績を集計しています。';const d=api.project(JSON.parse(await f.text()));if(own!==generation)return;const r=await api.compare(d);if(own!==generation){api.invalidate();return;}const c=r.counts;output.textContent='元の販売実績 '+c.sourceCount+'件 → 商品別月別 '+c.monthRows+'行 ／ '+c.startMonth+' ～ '+c.endMonth+' ／ 対象期間の記録 '+c.rangeCount+'件。'+(r.can_initialize?'まだ保存していません。':'共有済みのため上書きしません。');apply.disabled=!r.can_initialize;}
   catch(e){if(own===generation)output.textContent=e.message;}finally{working=false;sync();}
  });
  async function save(isRetry){if(working)return;if(!isRetry&&!root.confirm('確認した月別実績を共有します。過去の出庫は再実行せず、在庫数は変更しません。続けますか？'))return;working=true;apply.disabled=true;const own=generation;
   try{await api.initialize();if(own===generation)output.textContent='月別実績の初回共有を確認しました。在庫数は変更していません。ホームの「共有データで再計算」で参考判定を確認してください。';}
   catch(e){if(own===generation)output.textContent=e.message;}finally{working=false;sync();}
  }
  apply.addEventListener('click',()=>save(false));retry.addEventListener('click',()=>save(true));sync();
 });
})(window);
