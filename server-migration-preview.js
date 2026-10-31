"use strict";
(function(){
  const ENDPOINT='https://jyuubee.sakura.ne.jp/inventory/preview-migration-auth.php';
  let screen,busy=false,prepared=null,generation=0,comparison=null,pending=null;
  const PENDING_KEY='inventory-migration-pending-v1';
  function restorePending(){try{const value=JSON.parse(window.sessionStorage.getItem(PENDING_KEY)||'null');if(value?.owner && value?.payload?.action==='apply_new' && typeof value.payload.request_id==='string')pending=value;}catch{say('移行の再確認情報を読めません。移行操作は行わず確認してください。');}updateApply();}
  function updateApply(){if(!el('migration-apply'))return;const own=pending&&String(auth()?.user?.id)===pending.owner;el('migration-apply').hidden=!(own||comparison);el('migration-apply').disabled=busy||(!own&&!comparison);el('migration-apply').textContent=own?'前回の操作番号で移行結果を再確認する':'未登録の商品・在庫を追加する';el('migration-compare').disabled=busy||!prepared||!!pending;}
  function discardPending(){window.sessionStorage.removeItem(PENDING_KEY);pending=null;}
  function uuid(){const b=new Uint8Array(16);window.crypto.getRandomValues(b);b[6]=(b[6]&15)|64;b[8]=(b[8]&63)|128;const h=Array.from(b,x=>x.toString(16).padStart(2,'0')).join('');return h.slice(0,8)+'-'+h.slice(8,12)+'-'+h.slice(12,16)+'-'+h.slice(16,20)+'-'+h.slice(20);}
  const el=id=>document.getElementById(id);
  const auth=()=>window.inventoryServerSearch?.getSession?.();
  const say=text=>{el('migration-message').textContent=text;};
  const put=(parent,tag,value)=>{const node=document.createElement(tag);node.textContent=value;parent.appendChild(node);return node;};
  function reset(clearFile=false){generation++;prepared=null;comparison=null;updateApply();if(clearFile)el('migration-file').value='';el('migration-result').replaceChildren();el('migration-summary').value='';el('migration-compare').disabled=true;}
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
    if(busy||!prepared||pending)return;const session=auth();
    if(!session?.token||session.user?.role!=='admin'){say('共有サーバーに管理者でログインしてください。');return;}
    if(!el('migration-authorized').checked){say('会社から許可された保存先であることを確認してください。');return;}
    const payload=JSON.stringify(prepared.payload);
    if(new TextEncoder().encode(payload).length>4*1024*1024){say('照合データが4MBを超えています。分割方法を確認してください。');return;}
    comparison=null;updateApply();const mine=generation;busy=true;el('migration-compare').disabled=true;
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
      for(const row of result.rows){put(details,'p',`${row.internal_code}：${labels[row.result]||row.result} / バックアップ在庫 ${row.source_stock} / サーバー在庫 ${row.server_stock ?? '未登録'} / 差異 ${row.differences.join(', ')||'なし'}${row.fixed_status_conflict?' / 固定状態を要確認':''}`);put(details,'p',`状態：${row.source_status ?? '不明'} / サーバー：${row.server_status ?? '未登録'}`);for(const stock of row.source_stocks||[])put(details,'p',`場所別在庫：${stock.location_name} ${stock.quantity}個`);}
      const summary={format:'inventory-migration-server-preview-v1',counts:result.summary,source_counts:prepared.audit.counts,source_warnings:prepared.audit.categories,serverCompared:true,migrated:false};
      el('migration-summary').value=JSON.stringify(summary,null,2);say(result.message);
      if(/^[0-9a-f]{64}$/.test(result.comparison_sha256||'')&&result.summary.new>0&&result.summary.different===0&&result.summary.code_conflict===0)comparison={hash:result.comparison_sha256,added:result.summary.new,unchanged:result.summary.same};
    }catch(error){if(mine===generation)say(error.name==='AbortError'?'照合が時間切れになりました。在庫は変更していません。':error.message||'通信できませんでした。');}
    finally{clearTimeout(timer);busy=false;updateApply();}
  }
  async function apply(){
    if(busy)return;const session=auth();
    if(!session?.token||session.user?.role!=='admin'){say('管理者でログインしてください。');return;}
    if(pending&&pending.owner!==String(session.user.id)){say('前回と同じ管理者でログインしてください。');return;}
    if(!pending){
      if(!comparison||!prepared||!el('migration-authorized').checked)return;
      if(!window.confirm(`未登録の商品 ${comparison.added}件と場所別在庫を追加します。既存商品は上書きせず、過去の売上も出庫しません。実行しますか？`))return;
      const value={owner:String(session.user.id),added:comparison.added,unchanged:comparison.unchanged,payload:{action:'apply_new',request_id:uuid(),comparison_sha256:comparison.hash,products:prepared.payload.products}};
      try{window.sessionStorage.setItem(PENDING_KEY,JSON.stringify(value));pending=value;}catch{say('再実行情報を保存できないため移行を開始しません。');return;}
    }
    const request=pending,mine=generation;busy=true;updateApply();say('移行結果を確認しています。画面を閉じずにお待ちください。');
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),45000);
    try{
      const response=await fetch(ENDPOINT.replace('preview-migration-auth.php','apply-migration-auth.php'),{method:'POST',mode:'cors',cache:'no-store',signal:controller.signal,headers:{'Content-Type':'application/json',Accept:'application/json',Authorization:'Bearer '+session.token},body:JSON.stringify(request.payload)});
      const result=await response.json();
      if(response.status===401)window.inventoryServerSearch?.expireSession?.();
      if(mine!==generation||auth()?.token!==session.token)return;
      if(!response.ok||result.success!==true){
        if([400,403,409,413].includes(response.status)){discardPending();comparison=null;}
        throw new Error(result.message||'移行結果を確認できませんでした。');
      }
      if(result.migrated!==true||result.request_id!==request.payload.request_id||result.added!==request.added||result.unchanged!==request.unchanged||result.history_replayed!==false)throw new Error('結果の形式を確認できません。同じ操作番号で再確認してください。');
      discardPending();comparison=null;el('migration-result').replaceChildren();
      say(result.message+` 追加 ${result.added}件。操作番号：${result.request_id}`);
      el('migration-summary').value=JSON.stringify({format:'inventory-migration-apply-v1',added:result.added,unchanged:result.unchanged,serverCompared:true,migrated:true,historyReplayed:false},null,2);
    }catch(error){if(mine===generation)say((error.name==='AbortError'?'通信が時間切れになりました。':error.message||'通信できませんでした。')+(pending?' 完了している可能性があります。「前回の操作番号」で再確認してください。':''));}
    finally{clearTimeout(timer);busy=false;updateApply();}
  }
  function initialize(){
    const buttons=el('home-data-buttons'),main=document.querySelector('main');if(!buttons||!main)return;
    const button=document.createElement('button');button.type='button';button.className='home-dashboard-action home-action-settings';button.textContent='バックアップと共有サーバーを移行前に照合';buttons.appendChild(button);
    screen=document.createElement('section');screen.hidden=true;screen.id='migration-preview-screen';
    screen.innerHTML=`<div class="v2932-stock-panel"><h2>既存データ・移行前の照合</h2><p>バックアップの商品・在庫と、共有サーバーの現在の内容を比べます。照合後、未登録の商品・在庫だけ追加できます。差異がある既存商品は上書きしません。</p><p>専用商品・廃盤予定は元の状態を照合します。過去の売上は出庫として送りません。商品に対応しない履歴もバックアップに保持します。</p><button type="button" id="migration-login">共有サーバーの管理者ログイン</button><p><label for="migration-file">会社用アプリの全データバックアップ（JSON）</label></p><input id="migration-file" type="file" accept=".json,application/json"><p><label><input id="migration-authorized" type="checkbox">選択したのは架空テストデータ、または会社からこの共有サーバーへの送信許可を得た商品・在庫情報です</label></p><button id="migration-compare" type="button" disabled>商品・在庫を共有サーバーへ送って照合する</button><p id="migration-message" role="status" aria-live="polite">バックアップを選択してください。ファイル選択時はパソコン内だけで確認します。</p><div id="migration-result"></div><button id="migration-apply" type="button" hidden disabled>未登録の商品・在庫を追加する</button><h3>相談用の照合結果</h3><p>件数と確認項目だけです。商品名・コード・数量・取引先名は含みません。</p><textarea id="migration-summary" readonly style="width:100%;height:220px" aria-label="相談用の照合結果"></textarea><p>新規候補は登録済みではありません。差異がある商品やサーバーにだけある商品も変更・削除しません。照合後に別の端末が更新した場合は再照合が必要です。</p><button type="button" id="migration-back">ホームに戻る</button></div>`;
    main.appendChild(screen);
    button.addEventListener('click',async()=>{if(window.inventoryPermissions?.requireAdmin&&!(await window.inventoryPermissions.requireAdmin('移行前照合')))return;document.querySelectorAll('main > section').forEach(s=>s.hidden=true);screen.hidden=false;window.scrollTo(0,0);});
    el('migration-login').addEventListener('click',()=>window.inventoryServerSearch?.openLogin?.(''));
    el('migration-apply').addEventListener('click',apply);el('migration-authorized').addEventListener('change',()=>{comparison=null;updateApply();});el('migration-file').addEventListener('change',read);el('migration-compare').addEventListener('click',compare);
    el('migration-back').addEventListener('click',()=>{screen.hidden=true;el('home').hidden=false;reset(true);});
    new MutationObserver(()=>{if(screen.hidden)reset(true);}).observe(screen,{attributes:true,attributeFilter:['hidden']});
    restorePending();
    window.addEventListener('inventory-server-auth-changed',()=>{reset(true);el('migration-authorized').checked=false;say('ログイン状態が変わりました。未確認の移行があれば同じ管理者で結果を再確認してください。それ以外はバックアップを選び直してください。');});
  }
  document.addEventListener('DOMContentLoaded',initialize);
})();
