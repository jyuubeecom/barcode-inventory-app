"use strict";
(function (root) {
  // Per app path; never store a bearer token or mutate the terminal inventory DB.
  const key = 'inventory-shared-operation-v1:' + (root.location?.pathname || '/');
  let busy = false;
  function pending() {
    const raw = root.localStorage.getItem(key);
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (!p || typeof p.owner !== 'string' || !p.request || typeof p.request.request_id !== 'string') throw new Error('未確認の入出庫情報を読み取れません。新しい入出庫を止めて確認してください。');
    return p;
  }
  function snapshot(stocks) {
    if (!Array.isArray(stocks)) throw new Error('場所別在庫を再取得してください。');
    const seen = new Set();
    return stocks.map(s => {
      const q = typeof s.quantity === 'number' ? s.quantity : /^\d+$/.test(s.quantity) ? Number(s.quantity) : NaN;
      if (!s.location_name || seen.has(s.location_name) || !Number.isSafeInteger(q) || q < 0 || q > 1000000000) throw new Error('場所別在庫を確認できません。');
      seen.add(s.location_name);
      return {location_name:s.location_name, quantity:q};
    });
  }
  function prepare(session, fields, stocks) {
    if (pending()) throw new Error('未確認の入出庫があります。先に「前回の入出庫を再確認」を押してください。');
    if (!session?.user?.id || !['admin','worker'].includes(session.user.role)) throw new Error('サーバーにログインしてください。');
    const quantity = Number(fields.quantity);
    if (String(fields.quantity).trim() === '' || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 1000000) throw new Error('数量は1～1000000の整数で入力してください。');
    if (!['in','out'].includes(fields.action)) throw new Error('入出庫の種類を確認してください。');
    const request = {...fields, quantity, expected_stocks:snapshot(stocks), request_id:root.crypto.randomUUID()};
    const p = {owner:String(session.user.id),request};
    root.localStorage.setItem(key,JSON.stringify(p)); // Must persist before sending.
    return p;
  }
  async function send(session) {
    if (busy) throw new Error('入出庫の結果を確認中です。');
    const p = pending();
    if (!p) throw new Error('未確認の入出庫はありません。');
    if (!session?.token || String(session.user?.id) !== p.owner || !['admin','worker'].includes(session.user?.role)) throw new Error('前回と同じ担当者でサーバーにログインしてください。');
    busy = true;
    try {
      const response = await root.fetch('https://jyuubee.sakura.ne.jp/inventory/shared-stock-operation-auth.php', {
        method:'POST',mode:'cors',cache:'no-store',headers:{'Content-Type':'application/json',Accept:'application/json',Authorization:'Bearer '+session.token},body:JSON.stringify(p.request)
      });
      const result = await response.json();
      if (!response.ok || result.success !== true) {
        // Only this endpoint's explicit validation/conflict rejection is definitive.
        if ([400,409].includes(response.status) && result.success === false) root.localStorage.removeItem(key);
        throw new Error(result.message || '結果が未確認です。同じ操作番号で再確認してください。');
      }
      if (result.request_id !== p.request.request_id || !Number.isSafeInteger(result.transaction_id) || result.transaction_id < 1) throw new Error('応答を確認できません。同じ操作番号で再確認してください。');
      root.localStorage.removeItem(key);
      return result;
    } finally {busy = false; refresh();}
  }
  function refresh() {
    if (!root.document) return;
    let panel = root.document.getElementById('shared-operation-pending');
    if (!panel) return;
    try {
      const p = pending();panel.hidden = !p;
      panel.querySelector('span').textContent = p ? `未確認の入出庫：${p.request.internal_code} ／ ${p.request.location_name} ／ ${p.request.action==='in'?'入庫':'出庫'} ${p.request.quantity}個。再確認は同じ操作番号を使い、二重反映を防ぎます。` : '';
    } catch (e) {panel.hidden=false;panel.querySelector('span').textContent=e.message;}
    panel.querySelector('button').disabled=busy;
  }
  root.inventorySharedStockOperation = {prepare,send,pending,refresh,snapshot};
  if (!root.document) return;
  root.document.addEventListener('DOMContentLoaded', () => {
    const home = root.document.getElementById('home');
    if (!home) return;
    const panel=root.document.createElement('div');panel.id='shared-operation-pending';panel.setAttribute('role','status');
    panel.style.cssText='padding:16px;border:2px solid #e90;background:#fff7df;border-radius:10px';
    const text=root.document.createElement('span'), button=root.document.createElement('button');
    button.type='button';button.textContent='前回の入出庫を再確認';panel.append(text,button);home.prepend(panel);
    button.addEventListener('click',async()=>{
      button.disabled=true;
      try {
        const result=await send(root.inventoryServerSearch?.getSession());
        root.alert(`入出庫を確認しました。${result.location_name}：${result.location_stock_before}個 → ${result.location_stock_after}個。共有在庫を再読み込みしてください。`);
      } catch(e) {root.alert(e.message);} finally {refresh();}
    });
    refresh();
  });
  root.addEventListener?.('storage',refresh);
  root.addEventListener?.('inventory-server-auth-changed',refresh);
})(typeof window === 'undefined' ? globalThis : window);
