"use strict";
(function (root) {
  const endpoint = 'https://jyuubee.sakura.ne.jp/inventory/shared-stocktaking-auth.php';
  let pending = null, busy = false;
  const session = () => root.inventoryServerSearch?.getSession();
  function owner(s) {
    if (!s?.token || !['admin','worker'].includes(s.user?.role)) return null;
    return s.user.username || (s.user.id ? String(s.user.id) : null);
  }
  function quantity(value) {
    if (!/^\d+$/.test(String(value))) throw Error('実在庫は0以上の整数で入力してください。空欄は未確認です。');
    const n = Number(value);
    if (!Number.isSafeInteger(n) || n > 1000000000) throw Error('実在庫の上限は1000000000です。');
    return n;
  }
  function summarize(items) {
    if (!Array.isArray(items) || !items.length || items.length > 5000) throw Error('棚卸結果を確認できません。再読み込みしてください。');
    const counts = {target:items.length, checked:0, unchecked:0, match:0, shortage:0, surplus:0};
    const seen = new Set();
    for (const item of items) {
      if (!item || typeof item.internal_code !== 'string' || !item.internal_code || seen.has(item.internal_code) ||
          !Number.isSafeInteger(item.registered_stock) || item.registered_stock < 0 || item.registered_stock > 1000000000) throw Error('棚卸結果の形式を確認できません。');
      seen.add(item.internal_code);
      if (item.counted_stock === null) { counts.unchecked++; continue; }
      if (!Number.isSafeInteger(item.counted_stock) || item.counted_stock < 0 || item.counted_stock > 1000000000) throw Error('棚卸結果の数量を確認できません。');
      counts.checked++;
      const diff = item.counted_stock - item.registered_stock;
      counts[diff === 0 ? 'match' : diff < 0 ? 'shortage' : 'surplus']++;
    }
    return counts;
  }
  async function request(method, body, id) {
    const s = session();
    if (!owner(s)) throw Error('商品一覧からサーバーにログインしてください。');
    const controller = new AbortController();
    const timer = root.setTimeout(() => controller.abort(), 30000);
    try {
      const response = await root.fetch(endpoint + (id ? '?id=' + encodeURIComponent(id) : ''), {
        method, mode:'cors', cache:'no-store', signal:controller.signal,
        headers:{Accept:'application/json', Authorization:'Bearer ' + s.token, ...(body ? {'Content-Type':'application/json'} : {})},
        ...(body ? {body:JSON.stringify(body)} : {})
      });
      const data = await response.json();
      if (session()?.token !== s.token) throw Error('ログイン状態が変わりました。保存結果を再確認してください。');
      if (!response.ok || data.success !== true) {
        const e = Error(data.message || '共有棚卸を確認できません。');
        e.definitive = [400,409].includes(response.status) && data.success === false;
        throw e;
      }
      return data;
    } finally { root.clearTimeout(timer); }
  }
  function prepare(fields) {
    if (pending || busy) throw Error('前回の保存結果を先に再確認してください。');
    const account = owner(session());
    if (!account) throw Error('商品一覧からサーバーにログインしてください。');
    if (!['start','save'].includes(fields.action)) throw Error('棚卸の操作を確認してください。');
    const request = {...fields, request_id:root.crypto.randomUUID()};
    if (request.action === 'save') request.counted_stock = quantity(request.counted_stock);
    pending = {owner:account, request};
  }
  async function send() {
    if (busy) throw Error('保存結果を確認中です。');
    const p = pending;
    if (!p) throw Error('未確認の保存はありません。');
    if (p.owner !== owner(session())) throw Error('前回と同じ担当者でログインしてください。');
    busy = true;
    try {
      const data = await request('POST', p.request);
      if (data.request_id !== p.request.request_id || typeof data.stocktaking_id !== 'string' ||
          (p.request.action === 'start' && data.stocktaking_id !== p.request.request_id) ||
          (p.request.action === 'save' && (data.stocktaking_id !== p.request.stocktaking_id || data.internal_code !== p.request.internal_code || data.counted_stock !== p.request.counted_stock || data.version !== p.request.expected_version + 1 || data.memo !== p.request.memo))) {
        throw Error('保存結果を確認できません。「前回の保存を再確認」を押してください。');
      }
      pending = null;
      return data;
    } catch (e) { if (e.definitive) pending = null; throw e; }
    finally { busy = false; }
  }
  root.inventorySharedStocktaking = {quantity, summarize, prepare, send, pending:() => pending,
    overview:() => request('GET'), read:id => request('GET', null, id)};
  if (!root.document) return;

  root.document.addEventListener('DOMContentLoaded', () => {
    const home = root.document.getElementById('home');
    const actions = root.document.getElementById('home-quick-action-buttons');
    if (!home || !actions) return;
    const api = root.inventorySharedStocktaking;
    let current = null, loading = false, epoch = 0, offset = 0;
    const drafts = new Map();
    const button = root.document.createElement('button');
    button.id = 'show-shared-stocktaking-button'; button.type = 'button'; button.textContent = '棚卸を開始・再開';
    actions.appendChild(button);
    const panel = root.document.createElement('section'); panel.id = 'shared-stocktaking-panel'; panel.hidden = true;
    panel.innerHTML = `<h2 tabindex="-1">共有棚卸</h2>
      <p>数えた数量をスマホ・PCで共有します。この段階では現在庫を変更しません。棚卸確定・在庫への反映は準備中です。</p>
      <p role="status" data-message></p>
      <button type="button" data-retry hidden>前回の保存を再確認</button>
      <div data-overview>
        <h3>新しく棚卸を開始する</h3>
        <form data-start><label>棚卸日<input type="date" data-date required></label>
          <label>保管場所<select data-location required><option value="">読み込み後に選択してください</option></select></label>
          <p>選んだ保管場所に在庫登録のある商品（0個を含む）が対象です。登録在庫は開始時点の数量を保存します。</p>
          <button type="submit">棚卸を開始する</button></form>
        <h3>保存済みの棚卸を再開する（新しい順・最新100件）</h3><div data-sessions></div>
      </div>
      <div data-active hidden><h3 data-title></h3><p data-summary></p>
        <button type="button" data-review>保存済みの結果を確認</button>
        <section data-review-result hidden aria-labelledby="shared-stocktaking-review-title">
          <h3 id="shared-stocktaking-review-title" tabindex="-1">保存済みの棚卸結果</h3>
          <p data-review-info></p><dl data-review-counts></dl>
          <p data-review-note></p>
          <p>登録在庫は棚卸開始時点の数量です。未確認の商品は差異なし・不足・過剰に含めません。棚卸確定・現在庫への反映は準備中です。</p>
          <button type="button" data-review-close>結果を閉じる</button>
        </section>
        <label>商品名・商品コード・JAN・社内コードで検索<input type="search" data-search></label>
        <label>表示対象<select data-filter><option value="all">すべて</option><option value="unchecked">未確認</option><option value="checked">確認済み</option></select></label>
        <p data-page></p><div data-items></div>
        <button type="button" data-prev>前へ</button><button type="button" data-next>次へ</button>
      </div>
      <button type="button" data-reload>再読み込み</button>
      <button type="button" data-list>棚卸一覧へ戻る</button>
      <button type="button" data-close>閉じる</button>`;
    home.querySelector('#common-workspace-home')?.insertAdjacentElement('afterend', panel);
    const style = root.document.createElement('style');
    style.textContent = `body[data-workspace="legacy"] #show-shared-stocktaking-button,body[data-workspace="legacy"] #shared-stocktaking-panel{display:none!important}
      #shared-stocktaking-panel{padding:20px;background:white;border:2px solid #9160b5;border-radius:12px;margin:20px 0}
      #shared-stocktaking-panel label{display:block;margin:12px 0;font-weight:bold}
      #shared-stocktaking-panel input,#shared-stocktaking-panel select,#shared-stocktaking-panel textarea{display:block;width:100%;box-sizing:border-box;margin-top:6px;font-size:18px;padding:12px}
      #shared-stocktaking-panel button{margin:6px 6px 6px 0;padding:14px;min-height:48px}
      #shared-stocktaking-panel article{padding:16px;margin:14px 0;border:1px solid #bbcbd6;border-radius:10px}
      #shared-stocktaking-panel [data-message]{white-space:pre-wrap;font-weight:bold}
      #shared-stocktaking-panel [data-review-result]{padding:16px;border:2px solid #86b5d5;border-radius:10px;margin:12px 0;background:#f6fbff}
      #shared-stocktaking-panel [data-review-counts]{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px}
      #shared-stocktaking-panel [data-review-counts]>div{padding:12px;background:white;border:1px solid #bdcbd5;border-radius:8px}
      #shared-stocktaking-panel [data-review-counts] dt{font-weight:bold}#shared-stocktaking-panel [data-review-counts] dd{margin:8px 0 0;font-size:24px;font-weight:bold}
      #shared-stocktaking-panel .count-match{color:#246b35}#shared-stocktaking-panel .count-short{color:#ad2929}#shared-stocktaking-panel .count-over{color:#a45c00}`;
    root.document.head.appendChild(style);
    const el = selector => panel.querySelector(selector);
    function message(text) { el('[data-message]').textContent = text; }
    function clearReview() { el('[data-review-result]').hidden=true;el('[data-review-counts]').replaceChildren();el('[data-review-info]').textContent='';el('[data-review-note]').textContent=''; }
    function updateReviewNote() {
      el('[data-review-note]').textContent=drafts.size?`未保存の入力 ${drafts.size}件は、この結果に含めていません。入力内容はそのまま残しています。`:'画面の検索・絞り込みに関係なく、この棚卸の全対象を集計しています。';
    }
    function sync() {
      const blocked = loading || !!api.pending();
      for (const b of panel.querySelectorAll('button')) b.disabled = blocked;
      for (const input of panel.querySelectorAll('input,select,textarea')) input.disabled = blocked;
      el('[data-retry]').hidden = !api.pending(); el('[data-retry]').disabled = loading;
    }
    function discard() {
      return !drafts.size || root.confirm('まだ保存していない入力があります。入力を破棄して続けますか？');
    }
    function validate(data) {
      if (data.format !== 'inventory-shared-stocktaking-v1') throw Error('共有棚卸の応答形式を確認してください。');
      return data;
    }
    async function run(work) {
      if (loading) return;
      loading = true; sync(); const generation = epoch;
      try { await work(generation); }
      catch (e) { if (generation === epoch) message(e.message + (api.pending() ? '\n保存結果は未確認です。前回と同じ担当者で「前回の保存を再確認」を押してください。' : '')); }
      finally { loading = false; sync(); }
    }
    function today() {
      const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
    }
    async function overview(generation) {
      clearReview();
      const data = validate(await api.overview()); if (generation !== epoch) return;
      current = null; drafts.clear();
      el('[data-active]').hidden = true; el('[data-overview]').hidden = false;
      el('[data-date]').value = today();
      el('[data-location]').replaceChildren(new Option('選択してください',''));
      for (const name of data.locations) el('[data-location]').appendChild(new Option(name, name));
      el('[data-sessions]').replaceChildren();
      if (!data.sessions.length) el('[data-sessions]').textContent = '保存済みの棚卸はありません。';
      for (const s of data.sessions) {
        const b = root.document.createElement('button'); b.type = 'button';
        b.textContent = `${s.stocktaking_date} ／ ${s.location_name} ／ ${s.checked_count}/${s.item_count}件確認済み ／ 開始：${s.operator_name} ／ 番号末尾 ${s.id.slice(-8)}`;
        b.addEventListener('click', () => { void run(g => load(s.id,g)); });
        el('[data-sessions]').appendChild(b);
      }
      message('共有棚卸を読み込みました。');
    }
    async function load(id, generation) {
      clearReview();
      const data = validate(await api.read(id)); if (generation !== epoch) return;
      current = data; drafts.clear(); offset = 0;
      el('[data-overview]').hidden = true; el('[data-active]').hidden = false;
      el('[data-title]').textContent = `${data.session.stocktaking_date} ／ ${data.session.location_name} ／ 棚卸中`;
      el('[data-search]').value = ''; el('[data-filter]').value = 'all'; render();
      message('保存済みの数量を読み込みました。登録在庫は棚卸開始時点の数量です。');
    }
    function render() {
      if (!current) return;
      const checked = current.items.filter(i => i.counted_stock !== null).length;
      el('[data-summary]').textContent = `対象 ${current.items.length}件 ／ 確認済み ${checked}件 ／ 未確認 ${current.items.length-checked}件 ／ 未保存の入力 ${drafts.size}件`;
      const search = el('[data-search]').value.trim().toLowerCase(), filter = el('[data-filter]').value;
      const items = current.items.filter(i => [i.product_name,i.product_code,i.jan_code,i.internal_code].some(v => String(v || '').toLowerCase().includes(search)) && (filter === 'all' || (filter === 'checked') === (i.counted_stock !== null)));
      if (offset >= items.length) offset = Math.max(0,Math.floor((items.length-1)/50)*50);
      el('[data-items]').replaceChildren();
      el('[data-page]').textContent = `${items.length}件中 ${items.length ? offset+1 : 0}～${Math.min(offset+50,items.length)}件を表示`;
      for (const item of items.slice(offset,offset+50)) {
        const card = root.document.createElement('article');
        const heading = root.document.createElement('h4'); heading.textContent = `${item.product_code || '商品コード未登録'} ／ ${item.product_name}`;
        const info = root.document.createElement('p'); info.textContent = `社内コード：${item.internal_code} ／ JAN：${item.jan_code || '未登録'} ／ 登録在庫：${item.registered_stock}個`;
        const status = root.document.createElement('p');
        if (item.counted_stock === null) status.textContent = '未確認';
        else {
          const diff = item.counted_stock-item.registered_stock;
          status.textContent = `保存済み実在庫：${item.counted_stock}個 ／ 差異：${diff>0?'+':''}${diff}個 ／ 担当者：${item.counted_by}`;
          status.className = diff === 0 ? 'count-match' : diff < 0 ? 'count-short' : 'count-over';
        }
        const draft = drafts.get(item.internal_code);
        const countLabel = root.document.createElement('label'); countLabel.textContent = '実在庫（数えた数量）';
        const input = root.document.createElement('input'); input.type='number'; input.min='0'; input.max='1000000000'; input.step='1'; input.inputMode='numeric';
        input.value = draft ? draft.quantity : (item.counted_stock ?? ''); countLabel.appendChild(input);
        const memoLabel=root.document.createElement('label'); memoLabel.textContent='メモ（任意）';
        const memo=root.document.createElement('textarea'); memo.maxLength=1000; memo.value=draft?draft.memo:item.memo; memoLabel.appendChild(memo);
        const save=root.document.createElement('button'); save.type='button'; save.textContent='この商品の数量を保存';
        const track=()=>{
          if (input.value === String(item.counted_stock ?? '') && memo.value === item.memo) drafts.delete(item.internal_code);
          else drafts.set(item.internal_code,{quantity:input.value,memo:memo.value});
          if(!el('[data-review-result]').hidden)updateReviewNote();
          el('[data-summary]').textContent = `対象 ${current.items.length}件 ／ 確認済み ${checked}件 ／ 未確認 ${current.items.length-checked}件 ／ 未保存の入力 ${drafts.size}件`;
        };
        input.addEventListener('input',track); memo.addEventListener('input',track);
        save.addEventListener('click',()=>{ void run(async generation=>{
          if (root.inventoryCommonWorkspace?.mode() !== 'shared') throw Error('共通データに切り替えてください。');
          api.prepare({action:'save',stocktaking_id:current.session.id,internal_code:item.internal_code,expected_version:item.version,counted_stock:input.value,memo:memo.value});
          const result=await api.send(); if (generation!==epoch) return;
          applySaved(result); message('数量を共有サーバーに保存しました。現在庫は変更していません。');
        }); });
        card.append(heading,info,status,countLabel,memoLabel,save); el('[data-items]').appendChild(card);
      }
      sync();
    }
    function applySaved(result) {
      clearReview();
      if (!current || current.session.id!==result.stocktaking_id) return;
      const item=current.items.find(i=>i.internal_code===result.internal_code);
      if (item) { Object.assign(item,{counted_stock:result.counted_stock,memo:result.memo,counted_by:result.counted_by,version:result.version});drafts.delete(item.internal_code);render(); }
    }
    button.addEventListener('click',()=>{
      panel.hidden=false; el('h2').focus();
      if (!current && !api.pending()) void run(overview);
    });
    el('[data-start]').addEventListener('submit',event=>{
      event.preventDefault(); void run(async generation=>{
        const date=el('[data-date]').value, location=el('[data-location]').value;
        if (!date || !location) throw Error('棚卸日と保管場所を選択してください。');
        if (!root.confirm(`${date} ／ ${location} の棚卸を開始します。現在庫は変更しません。よろしいですか？`)) return;
        api.prepare({action:'start',stocktaking_date:date,location_name:location});
        const data=await api.send(); if (generation===epoch) await load(data.stocktaking_id,generation);
      });
    });
    el('[data-retry]').addEventListener('click',()=>{ void run(async generation=>{
      const kind=api.pending()?.request.action;const data=await api.send(); if(generation!==epoch)return;
      if(kind==='start')await load(data.stocktaking_id,generation);else applySaved(data);
      message('前回の保存を確認しました。別の端末では再読み込みしてください。');
    }); });
    el('[data-reload]').addEventListener('click',()=>{ if(discard())void run(g=>current?load(current.session.id,g):overview(g)); });
    el('[data-review]').addEventListener('click',()=>{ void run(async generation=>{
      clearReview();
      if (!current) throw Error('棚卸を開き直してください。');
      const id=current.session.id;
      const data=validate(await api.read(id));
      if(generation!==epoch)return;
      if(data.session?.id!==id)throw Error('棚卸番号が一致しません。再読み込みしてください。');
      const counts=api.summarize(data.items);
      el('[data-review-info]').textContent=`${data.session.stocktaking_date} ／ ${data.session.location_name} ／ 取得時点の保存済み結果（全対象）`;
      const labels={target:'対象商品',checked:'確認済み',unchecked:'未確認',match:'差異なし',shortage:'在庫不足',surplus:'在庫過剰'};
      for(const [key,label] of Object.entries(labels)){
        const box=root.document.createElement('div'),term=root.document.createElement('dt'),value=root.document.createElement('dd');
        term.textContent=label;value.textContent=counts[key]+'件';
        if(['match','shortage','surplus'].includes(key))box.className=key==='match'?'count-match':key==='shortage'?'count-short':'count-over';
        box.append(term,value);el('[data-review-counts]').appendChild(box);
      }
      updateReviewNote();
      el('[data-review-result]').hidden=false;el('#shared-stocktaking-review-title').focus();
      message('保存済みの棚卸結果を確認しました。現在庫は変更していません。別の端末で保存した後は、もう一度「保存済みの結果を確認」を押してください。');
    }); });
    el('[data-review-close]').addEventListener('click',clearReview);
    el('[data-list]').addEventListener('click',()=>{ if(discard())void run(overview); });
    el('[data-close]').addEventListener('click',()=>{ panel.hidden=true; });
    for(const name of ['search','filter'])el(`[data-${name}]`).addEventListener(name==='search'?'input':'change',()=>{offset=0;render();});
    el('[data-prev]').addEventListener('click',()=>{offset=Math.max(0,offset-50);render();});
    el('[data-next]').addEventListener('click',()=>{offset+=50;render();});
    root.addEventListener('beforeunload',event=>{if(drafts.size||api.pending()){event.preventDefault();event.returnValue='';}});
    root.addEventListener('inventory-server-auth-changed',()=>{
      clearReview();
      epoch++;current=null;drafts.clear();el('[data-items]').replaceChildren();el('[data-sessions]').replaceChildren();el('[data-summary]').textContent='';el('[data-title]').textContent='';
      el('[data-overview]').hidden=true;el('[data-active]').hidden=true;message('ログイン状態が変わりました。「再読み込み」で共有棚卸を確認してください。');sync();
    });
    sync();
  });
})(typeof window === 'undefined' ? globalThis : window);
