"use strict";
// Shared imports are separate from the existing per-device sales/analysis stores.
(function () {
  const ENDPOINT = "https://jyuubee.sakura.ne.jp/inventory/sales-csv-auth.php";
  const KEY = "inventory-sales-csv-pending-v1";
  let screen, plan = null, pending = null, busy = false, generation = 0, storageBroken = false;
  const el = id => document.getElementById(id);
  const session = () => {
    const auth = window.inventoryServerSearch?.getSession?.();
    return auth?.token && auth.user?.role === "admin" ? auth : null;
  };
  function message(text) { el("shared-sales-message").textContent = text; }
  function invalidate() { generation++; plan = null; if (screen) { el("shared-sales-apply").disabled = true; el("shared-sales-result").textContent = ""; } }
  function parseSharedCsv(text) {
    const rows = [];
    let row = [];
    let field = "";
    let quoted = false;
    let quoteClosed = false;
    let fieldStarted = false;
    const input = String(text || "").replace(/^\uFEFF/, "");
    for (let i = 0; i < input.length; i += 1) {
      const ch = input[i];
      if (quoted) {
        if (ch === '"' && input[i + 1] === '"') {
          field += '"'; i += 1;
        } else if (ch === '"') {
          quoted = false;
          quoteClosed = true;
        } else {
          field += ch;
        }
      } else if (quoteClosed && ch !== "," && ch !== "\r" && ch !== "\n") {
        throw new Error("CSVの閉じ引用符の後に余分な文字があります。");
      } else if (ch === '"' && !fieldStarted) {
        quoted = true;
        fieldStarted = true;
      } else if (ch === '"') {
        throw new Error("CSVの引用符の形式が正しくありません。");
      } else if (ch === ",") {
        row.push(field); field = ""; fieldStarted = false; quoteClosed = false;
      } else if (ch === "\r" || ch === "\n") {
        if (ch === "\r" && input[i + 1] === "\n") i += 1;
        row.push(field); rows.push(row);
        row = []; field = ""; fieldStarted = false; quoteClosed = false;
      } else {
        field += ch;
        fieldStarted = true;
      }
    }
    if (quoted) throw new Error("CSVのダブルクォーテーションが閉じていません。");
    if (field !== "" || row.length > 0 || fieldStarted) {
      row.push(field); rows.push(row);
    }
    return rows;
  }

  function normalizeRows(parsed) {
    const rows = []; let ignored = 0;
    for (const [index, raw] of parsed.rows.entries()) {
      const row = Array.from({length:12}, (_, i) => normalizeSalesActualText(raw[i]));
      if (!["売上", "返品"].includes(row[11])) { ignored++; continue; }
      if (raw.length !== 12) throw new Error(`CSV ${parsed.headerIndex + index + 2}行目の列数を確認してください（12列必要です）。`);
      const date = parseSalesActualDate(row[5]);
      const quantity = parseSalesActualNumber(row[6]);
      if (!row[0] || row[0] === "0" || !date || !Number.isSafeInteger(quantity) || quantity === 0 || Math.abs(quantity) > 1000000 || (row[11] === "売上" && quantity < 0)) {
        throw new Error(`CSV ${parsed.headerIndex + index + 2}行目の社内コード・日付・数量を確認してください。今回は全件を取り込みません。`);
      }
      row[5] = date; row[6] = String(row[11] === "返品" ? -Math.abs(quantity) : quantity); rows.push(row);
    }
    if (!rows.length || rows.length > 300 || new Set(rows.map(r => r[0])).size > 100) throw new Error("売上・返品は1～300行、100商品までです。");
    return {rows, ignored};
  }
  async function request(payload, auth) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000);
    try {
      const response = await fetch(ENDPOINT, {method:"POST", mode:"cors", cache:"no-store", signal:controller.signal,
        headers:{"Content-Type":"application/json", Accept:"application/json", Authorization:"Bearer " + auth.token}, body:JSON.stringify(payload)});
      let data; try { data = await response.json(); } catch (_) { throw new Error("サーバーの応答を確認できませんでした。"); }
      if (response.status === 401) window.inventoryServerSearch?.expireSession?.();
      if (!response.ok || data?.success !== true) {
        const error = new Error(data?.message || "サーバー処理を確認できませんでした。");
        // Only an explicit application rejection guarantees this request rolled back.
        error.definite = data?.success === false && [400,403,409,413].includes(response.status);
        throw error;
      }
      return data;
    } finally { clearTimeout(timer); }
  }
  function validPlan(data) {
    return Number.isSafeInteger(data?.imported_count) && data.imported_count >= 0 &&
      Number.isSafeInteger(data.duplicate_count) && data.duplicate_count >= 0 && Array.isArray(data.changes) &&
      data.changes.every(item => typeof item.internal_code === "string" && typeof item.product_name === "string" &&
        [item.quantity,item.before,item.after].every(Number.isSafeInteger) && Array.isArray(item.locations) &&
        item.locations.every(l => typeof l.location_name === "string" && [l.before,l.after].every(Number.isSafeInteger)));
  }
  function renderPlan(data, ignored) {
    const target = el("shared-sales-result"); target.textContent = "";
    const summary = document.createElement("p");
    summary.textContent = `新規 ${data.imported_count}行 / 取込済み ${data.duplicate_count}行 / 売上・返品以外 ${ignored}行`;
    target.appendChild(summary);
    for (const item of data.changes) {
      const line = document.createElement("p");
      line.textContent = `${item.internal_code} ${item.product_name}：${item.before} → ${item.after}個（差引出庫 ${item.quantity}個）\n` +
        item.locations.map(l => `${l.location_name}：${l.before} → ${l.after}`).join(" / ");
      target.appendChild(line);
    }
  }
  async function preview() {
    if (busy || pending || storageBroken) return;
    invalidate(); const current = generation; const auth = session();
    if (!auth) { message("共有サーバーに管理者でログインしてください。"); return; }
    const file = el("shared-sales-file").files?.[0];
    if (!file || file.size === 0 || file.size > 512 * 1024) { message("512KBまでの売上CSVを選択してください。"); return; }
    busy = true; message("共有サーバーの在庫と取込済み行を確認しています。");
    try {
      const text = await readSalesActualCsvText(file);
      parseSharedCsv(text); // Reject malformed quotes before using the legacy header/date helpers.
      const parsed = parseSalesActualCsv(text);
      const normalized = normalizeRows(parsed);
      const data = await request({action:"preview", rows:normalized.rows}, auth);
      if (current !== generation || session()?.token !== auth.token) return;
      if (!validPlan(data) || !/^[0-9a-f]{64}$/.test(data.preview_hash) || data.imported_count + data.duplicate_count !== normalized.rows.length) throw new Error("照合結果を確認できませんでした。再照合してください。");
      plan = {rows:normalized.rows, preview_hash:data.preview_hash, file_name:file.name, owner:String(auth.user.id), token:auth.token};
      renderPlan(data, normalized.ignored);
      el("shared-sales-apply").disabled = data.imported_count === 0;
      message(data.imported_count ? "確認だけでは保存されません。数量を確認して取り込んでください。" : "全件が取込済みです。在庫は変更しません。");
    } catch (error) { if (current === generation) message(error.message); }
    finally { busy = false; }
  }
  async function apply() {
    if (busy || pending || !plan || storageBroken) return;
    const auth = session();
    if (!auth || auth.token !== plan.token || String(auth.user.id) !== plan.owner) { invalidate(); message("ログイン状態が変わりました。再照合してください。"); return; }
    if (!window.confirm("表示した売上・返品を共有サーバーに保存し、在庫を更新します。実行しますか？")) return;
    if (!window.crypto?.getRandomValues) { message("操作番号を発行できません。Chromeで開き直してください。"); return; }
    const bytes = new Uint8Array(16); window.crypto.getRandomValues(bytes); bytes[6] = (bytes[6] & 15) | 64; bytes[8] = (bytes[8] & 63) | 128;
    const hex = Array.from(bytes, b => b.toString(16).padStart(2,"0")).join("");
    const id = [hex.slice(0,8),hex.slice(8,12),hex.slice(12,16),hex.slice(16,20),hex.slice(20)].join("-");
    const saved = {owner:plan.owner, payload:{action:"apply", request_id:id, rows:plan.rows, preview_hash:plan.preview_hash, file_name:plan.file_name}};
    try { window.sessionStorage.setItem(KEY, JSON.stringify(saved)); }
    catch (_) { message("再試行用の保存ができないため取り込みません。ブラウザーの保存設定を確認してください。"); return; }
    pending = saved; invalidate(); await submit();
  }
  async function submit() {
    if (busy || !pending) return;
    const auth = session();
    if (!auth || String(auth.user.id) !== pending.owner) { message("前回と同じ管理者でログインして結果を確認してください。"); return; }
    busy = true; el("shared-sales-retry").hidden = false;
    message("処理結果を確認中です。操作番号：" + pending.payload.request_id);
    try {
      const result = await request(pending.payload, auth);
      const id = pending.payload.request_id;
      if (result.request_id !== id || !validPlan(result)) throw new Error("保存応答を確認できません。");
      clearPending();
      if (session()?.token !== auth.token) return;
      renderPlan(result, 0); message(result.message + " 操作番号：" + id + (result.replayed ? "（保存済みの結果）" : ""));
    } catch (error) {
      if (error.definite) { clearPending(); message(error.message + " 再照合してください。"); }
      else message("結果が未確認です。「同じ操作番号で確認・再試行」を押してください。通信が切れても新しい取り込みを始めないでください。");
    } finally { busy = false; }
  }
  function clearPending() {
    // If removal fails, leave the original key available for safe receipt replay after a reload.
    try { window.sessionStorage.removeItem(KEY); } catch (_) {}
    pending = null; el("shared-sales-retry").hidden = true;
  }
  async function history() {
    if (busy) return; const auth = session();
    if (!auth) { message("管理者ログインが必要です。"); return; }
    const current = generation; busy = true;
    try {
      const data = await request({action:"history"}, auth);
      if (current !== generation || session()?.token !== auth.token) return;
      const target = el("shared-sales-history"); target.textContent = "";
      for (const item of data.batches) { const line = document.createElement("p"); line.textContent = `${item.created_at} ${item.file_name}：${item.imported_count}行 / ${item.request_id}`; target.appendChild(line); }
      if (!data.batches.length) target.textContent = "共有売上CSVの取込履歴はありません。";
    } catch (error) { if (current === generation) message(error.message); }
    finally { busy = false; }
  }
  async function open() {
    if (window.inventoryPermissions?.requireAdmin && !(await window.inventoryPermissions.requireAdmin("共有売上CSV取込"))) return;
    document.querySelectorAll("main > section").forEach(section => { section.hidden = true; });
    screen.hidden = false; invalidate(); window.scrollTo(0,0);
    message(storageBroken ? "再試行情報を読み出せないため取り込みを停止しています。ブラウザーの保存設定を確認してください。" : pending ? "前回の結果が未確認です。同じ操作番号で確認してください。" : "売上CSVを選択し、共有サーバーの在庫を確認してください。");
    el("shared-sales-retry").hidden = !pending;
  }
  function initialize() {
    const buttons = el("home-data-buttons"), main = document.querySelector("main"); if (!buttons || !main) return;
    const button = document.createElement("button"); button.type = "button"; button.className = "home-dashboard-action home-action-settings"; button.textContent = "売上CSVを共有サーバーに取り込む"; buttons.appendChild(button); button.addEventListener("click", open);
    screen = document.createElement("section"); screen.hidden = true; screen.id = "shared-sales-screen";
    screen.innerHTML = `<div class="v2932-stock-panel"><h2>共有サーバー・売上CSV取込</h2>
      <p>売上・返品と在庫の更新をサーバーにまとめて保存します。保存後、他の端末の共有商品検索で最新の在庫を読み直せます。</p>
      <p><strong>この画面は共有在庫用です。</strong>従来の端末内の売上取込・月平均には連動しません。同じ業務で両方の在庫を更新しないよう、使用する在庫を確認してください。</p>
      <p>既存の売上CSV（A列：商品コード＝社内コード、F列：日付、G列：数量、L列：明細区分）。UTF-8／Shift_JIS、512KB・300明細・100商品まで。明細区分が売上・返品の行が対象です。</p>
      <p>出庫順：本社 → 本社1階 A～F区 → 本社2階 A～F区 → 酒本倉庫1階 → 酒本倉庫2階。返品は本社へ戻します。同一商品の売上と返品は差引数量で反映します。</p>
      <p>未登録・廃盤・在庫不足・入力エラーがある場合は全件を中止します。取込済み行はスキップします。訂正したCSVで上書きはできません。</p>
      <button type="button" id="shared-sales-login">共有サーバーの管理者ログイン</button>
      <input type="file" id="shared-sales-file" accept=".csv,text/csv" aria-label="共有サーバー用売上CSV">
      <button type="button" id="shared-sales-preview">取込前に共有在庫・重複を確認する</button>
      <p id="shared-sales-message" role="status" aria-live="polite"></p><div id="shared-sales-result" style="white-space:pre-wrap"></div>
      <button type="button" id="shared-sales-apply" disabled>確認した内容を共有サーバーに取り込む</button>
      <button type="button" id="shared-sales-retry" hidden>同じ操作番号で確認・再試行</button>
      <button type="button" id="shared-sales-history-button">共有取込履歴を読み直す（最新50件）</button><div id="shared-sales-history"></div>
      <button type="button" id="shared-sales-back">ホームに戻る</button></div>`;
    main.appendChild(screen);
    try { const saved = JSON.parse(window.sessionStorage.getItem(KEY) || "null");
      if (saved) { if (typeof saved.owner !== "string" || !saved.payload?.request_id || !Array.isArray(saved.payload.rows)) throw new Error("Invalid pending import"); pending = saved; }
    } catch (_) { storageBroken = true; }
    el("shared-sales-login").addEventListener("click", () => window.inventoryServerSearch?.openLogin?.(""));
    el("shared-sales-file").addEventListener("change", invalidate);
    el("shared-sales-preview").addEventListener("click", preview);
    el("shared-sales-apply").addEventListener("click", apply);
    el("shared-sales-retry").addEventListener("click", submit);
    el("shared-sales-history-button").addEventListener("click", history);
    el("shared-sales-back").addEventListener("click", () => { screen.hidden = true; el("home").hidden = false; invalidate(); });
    new MutationObserver(() => { if (screen.hidden) invalidate(); }).observe(screen, {attributes:true, attributeFilter:["hidden"]});
    window.addEventListener("inventory-server-auth-changed", () => { invalidate(); el("shared-sales-history").textContent = ""; });
    window.addEventListener("beforeunload", event => { if (pending) { event.preventDefault(); event.returnValue = ""; } });
  }
  document.addEventListener("DOMContentLoaded", initialize);
})();
