"use strict";
(function(){
  const ENDPOINT='https://jyuubee.sakura.ne.jp/inventory/preview-migration-auth.php';
  let screen,busy=false,prepared=null,generation=0;
  const el=id=>document.getElementById(id);
  const auth=()=>window.inventoryServerSearch?.getSession?.();
  const say=text=>{el('migration-message').textContent=text;};
  const put=(parent,tag,value)=>{const node=document.createElement(tag);node.textContent=value;parent.appendChild(node);return node;};
  function reset(clearFile=false){generation++;prepared=null;if(clearFile)el('migration-file').value='';el('migration-result').replaceChildren();el('migration-summary').value='';el('migration-compare').disabled=true;}
  async function read(){
    reset();const mine=generation,file=el('migration-file').files?.[0];if(!file)return;
    if(file.size===0||file.size>100*1024*1024){say('100MBまでの全データJSONバックアップを選択してください。');return;}
    say('パソコン内で商品・在庫と引継ぎ件数を確認しています。');
    try{
      const raw=JSON.parse((await file.text()).replace(/^\uFEFF/,''));if(mine!==generation)return;
      prepared=InventoryMigrationProducts.prepareProducts(raw);
      put(el('migration-result'),'p',`商品 ${prepared.audit.counts.products}件 / 元の販売実績 ${prepared.audit.counts.salesActuals ?? 0}件 / 警告 ${prepared.audit.warningCount}件`);
      put(el('migration-result'),'p','履歴・販売予定・船便等はバックアップ内に残します。今回の送信には含めません。');
      say('商品・在庫の照合準備ができました。まだサーバーへ送信していません。');el('migration-compare').disabled=false;
    }catch(error){if(mine===generation)say(error.message || 'バックアップを確認できませんでした。');}
  }
  async function compare(){
    if(busy||!prepared)return;const session=auth();
    if(!session?.token||session.user?.role!=='admin'){say('共有サーバーに管理者でログインしてください。');return;}
    if(!el('migration-authorized').checked){say('会社から許可された保存先であることを確認してください。');return;}
    const payload=JSON.stringify(prepared.payload);
    if(new TextEncoder().encode(payload).length>4*1024*1024){say('照合データが4MBを超えています。分割方法を確認してください。');return;}
    const mine=generation;busy=true;el('migration-compare').disabled=true;
    el('migration-result').replaceChildren();el('migration-summary').value='';
    say('商品・在庫を共有サーバーと照合しています。');
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),45000);
    try{
      const response=await fetch(ENDPOINT,{method:'POST',mode:'cors',cache:'no-store',signal:controller.signal,headers:{'Content-Type':'application/json',Accept:'application/json',Authorization:'Bearer '+session.token},body:payload});
      const result=await response.json();
      if(response.status===401)window.inventoryServerSearch?.expireSession?.();
      if(mine!==generation||auth()?.token!==session.token)return;
      if(!response.ok||result?.success!==true||result.preview_only!==true||result.migrated!==false||!Array.isArray(result.rows)||!result.summary)throw new Error(result?.message||'照合結果を確認できませんでした。');
      const target=el('migration-result');target.replaceChildren();const labels={new:'新規登録候補',same:'一致',different:'差異あり',code_conflict:'社内コードの表記相違',fixed_status_conflict:'固定状態の相違',server_only:'サーバーにだけある商品'};
      for(const [key,label] of Object.entries(labels))put(target,'p',`${label}：${result.summary[key]}件`);
      const details=document.createElement('details');put(details,'summary','商品ごとの照合内容を表示する');target.appendChild(details);
      for(const row of result.rows)put(details,'p',`${row.internal_code}：${labels[row.result]||row.result} / バックアップ在庫 ${row.source_stock} / サーバー在庫 ${row.server_stock ?? '未登録'} / 差異 ${row.differences.join(', ')||'なし'}${row.fixed_status_conflict?' / 固定状態を要確認':''}`);
      const summary={format:'inventory-migration-server-preview-v1',counts:result.summary,source_counts:prepared.audit.counts,source_warnings:prepared.audit.categories,serverCompared:true,migrated:false};
      el('migration-summary').value=JSON.stringify(summary,null,2);say(result.message);
    }catch(error){if(mine===generation)say(error.name==='AbortError'?'照合が時間切れになりました。在庫は変更していません。':error.message||'通信できませんでした。');}
    finally{clearTimeout(timer);busy=false;el('migration-compare').disabled=!prepared;}
  }
  function initialize(){
    const buttons=el('home-data-buttons'),main=document.querySelector('main');if(!buttons||!main)return;
    const button=document.createElement('button');button.type='button';button.className='home-dashboard-action home-action-settings';button.textContent='バックアップと共有サーバーを移行前に照合';buttons.appendChild(button);
    screen=document.createElement('section');screen.hidden=true;screen.id='migration-preview-screen';
    screen.innerHTML=`<div class="v2932-stock-panel"><h2>既存データ・移行前の照合</h2><p>バックアップの商品・在庫と、共有サーバーの現在の内容を比べます。商品・在庫・履歴は保存・更新しません。</p><p>専用商品・廃盤予定は元の状態を照合します。過去の売上は出庫として送りません。商品に対応しない履歴もバックアップに保持します。</p><button type="button" id="migration-login">共有サーバーの管理者ログイン</button><p><label for="migration-file">会社用アプリの全データバックアップ（JSON）</label></p><input id="migration-file" type="file" accept=".json,application/json"><p><label><input id="migration-authorized" type="checkbox">会社から、この共有サーバーへ商品・在庫情報を送る許可を得ています</label></p><button id="migration-compare" type="button" disabled>商品・在庫を共有サーバーへ送って照合する</button><p id="migration-message" role="status" aria-live="polite">バックアップを選択してください。ファイル選択時はパソコン内だけで確認します。</p><div id="migration-result"></div><h3>相談用の照合結果</h3><p>件数と確認項目だけです。商品名・コード・数量・取引先名は含みません。</p><textarea id="migration-summary" readonly style="width:100%;height:220px" aria-label="相談用の照合結果"></textarea><p>新規候補は登録済みではありません。差異がある商品やサーバーにだけある商品も変更・削除しません。照合後に別の端末が更新した場合は再照合が必要です。</p><button type="button" id="migration-back">ホームに戻る</button></div>`;
    main.appendChild(screen);
    button.addEventListener('click',async()=>{if(window.inventoryPermissions?.requireAdmin&&!(await window.inventoryPermissions.requireAdmin('移行前照合')))return;document.querySelectorAll('main > section').forEach(s=>s.hidden=true);screen.hidden=false;window.scrollTo(0,0);});
    el('migration-login').addEventListener('click',()=>window.inventoryServerSearch?.openLogin?.(''));
    el('migration-file').addEventListener('change',read);el('migration-compare').addEventListener('click',compare);
    el('migration-back').addEventListener('click',()=>{screen.hidden=true;el('home').hidden=false;reset(true);});
    new MutationObserver(()=>{if(screen.hidden)reset(true);}).observe(screen,{attributes:true,attributeFilter:['hidden']});
    window.addEventListener('inventory-server-auth-changed',()=>{reset(true);el('migration-authorized').checked=false;say('ログイン状態が変わりました。バックアップを選び直してください。');});
  }
  document.addEventListener('DOMContentLoaded',initialize);
})();
