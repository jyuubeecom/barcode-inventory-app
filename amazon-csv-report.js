"use strict";
/* CSV and stock snapshots stay on this device. No inventory or sales-plan writes. */
(function () {
  const core = window.inventoryAmazonCsv;
  const escape = v => String(v == null ? "" : v).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const number = n => Number(n).toLocaleString("ja-JP");
  const state = {rows: null, result: null, name: "", loaded: "", sample: false, view: "product", destination: null};
  let generation = 0;
  const $ = id => document.getElementById("amazon-" + id);
  const style = `
    #amazon-csv-report .amazon-controls{display:flex;gap:12px;flex-wrap:wrap;align-items:end;margin:18px 0}
    #amazon-csv-report label{display:block;font-weight:bold}#amazon-csv-report input,#amazon-csv-report select{max-width:100%}
    #amazon-csv-report .amazon-note{background:#edf5ff;padding:14px;border-radius:8px;line-height:1.8}
    .amazon-table-wrap{overflow:auto;margin:16px 0}.amazon-table{width:100%;border-collapse:collapse;font-size:14px}
    .amazon-table th,.amazon-table td{border:1px solid #bdcbd8;padding:10px;text-align:left;vertical-align:top}
    .amazon-table th{background:#e9f2fc}.amazon-table .qty{text-align:right;white-space:nowrap}
    .amazon-planned{background:#fff1b5}.amazon-short{color:#bb1717;font-weight:bold}
    .amazon-warning{background:#fff3e7;padding:12px;border:1px solid #d98d37;border-radius:8px}
    .amazon-summary{font-weight:bold;font-size:17px;margin:16px 0}.amazon-total{font-weight:bold;background:#f0f4f8}
    #amazon-csv-report button[aria-pressed=true]{outline:3px solid #123e69;outline-offset:2px}
    @media print{@page{size:A4 landscape;margin:12mm}body{font-family:sans-serif;font-size:10pt;color:#111}button{display:none}.amazon-table{font-size:9pt}.amazon-table th,.amazon-table td{padding:5px}thead{display:table-header-group}tr{break-inside:avoid}.amazon-planned{background:#fff1b5!important;print-color-adjust:exact;-webkit-print-color-adjust:exact}.amazon-short{color:#bb1717!important}h1{font-size:18pt}h2{font-size:13pt}p{line-height:1.5}}
  `;
  document.addEventListener("DOMContentLoaded", init);
  function init() {
    const button = document.createElement("button");
    button.id = "show-amazon-csv-report-button"; button.type = "button"; button.textContent = "Amazon CSVを集計する";
    document.getElementById("home-sales-buttons").appendChild(button);
    const section = document.createElement("section"); section.id = "amazon-csv-report"; section.hidden = true;
    section.innerHTML = `<h2>Amazon CSVの集計</h2>
      <p class="amazon-note">C列：配送先 ／ E列：JANコード ／ N列：数量<br>この端末の在庫・販売予定と照合します。CSVはサーバーへ送りません。在庫数・販売予定は変更しません。</p>
      <div class="amazon-controls"><label>Amazon CSV<input id="amazon-file" type="file" accept=".csv,text/csv"></label>
      <label>文字コード<select id="amazon-encoding"><option value="auto">自動（UTF-8 / Shift_JIS）</option><option value="utf-8">UTF-8</option><option value="shift_jis">Shift_JIS</option></select></label>
      <button id="amazon-sample" type="button">架空データで試す</button><button id="amazon-refresh" type="button" disabled>現在庫・販売予定を再取得</button></div>
      <p id="amazon-status" role="status" aria-live="polite">CSVを選んでください。架空データでも動作を確認できます。</p>
      <div class="amazon-controls"><button id="amazon-product" type="button" aria-pressed="true">商品別</button><button id="amazon-site" type="button" aria-pressed="false">配送先別</button><button id="amazon-print" type="button" disabled>表示中の集計を印刷する</button><button id="amazon-home" type="button">ホームへ戻る</button></div>
      <label id="amazon-destination-controls" hidden>表示・印刷する配送先<select id="amazon-destination" disabled><option value="">すべての配送先</option></select></label>
      <div id="amazon-output"></div>`;
    document.querySelector("main").appendChild(section);
    const css = document.createElement("style"); css.textContent = style; document.head.appendChild(css);
    button.addEventListener("click", () => { document.querySelectorAll("main > section").forEach(s => s.hidden = true); section.hidden = false; $("refresh").disabled = !state.rows; window.scrollTo(0, 0); });
    $("home").addEventListener("click", () => { generation++; section.hidden = true; document.getElementById("home").hidden = false; });
    $("file").addEventListener("change", loadFile);
    $("encoding").addEventListener("change", () => { if ($("file").files.length) loadFile(); });
    $("refresh").addEventListener("click", refresh);
    $("sample").addEventListener("click", sample);
    for (const view of ["product", "site"]) $(view).addEventListener("click", () => { state.view = view; render(); });
    $("destination").addEventListener("change", () => {
      const value = $("destination").value;
      const group = state.result && /^\d+$/.test(value) ? state.result.sites[Number(value)] : null;
      state.destination = group ? group.site : null; render();
    });
    $("print").addEventListener("click", print);
  }
  function clear() { state.result = null; $("output").innerHTML = ""; $("print").disabled = true; $("refresh").disabled = true; $("destination").disabled = true; }
  async function loadFile() {
    const request = ++generation; clear(); state.rows = null; state.sample = false; state.destination = null;
    const file = $("file").files[0]; if (!file) return;
    $("status").textContent = "CSVを読み込んでいます…";
    try {
      if (file.size > 10 * 1024 * 1024) throw new Error("CSVは10MB以内にしてください。");
      const bytes = await file.arrayBuffer(); if (request !== generation) return;
      let text; const encoding = $("encoding").value;
      if (encoding === "auto") {
        try { text = new TextDecoder("utf-8", {fatal:true}).decode(bytes); }
        catch (_) { text = new TextDecoder("shift_jis", {fatal:true}).decode(bytes); }
      } else text = new TextDecoder(encoding, {fatal:true}).decode(bytes);
      state.rows = core.read(text); state.name = file.name;
      await refresh();
    } catch (error) { if (request === generation) { clear(); state.rows = null; $("status").textContent = "読み込めませんでした：" + error.message; } }
  }
  async function refresh() {
    if (!state.rows) return;
    const request = ++generation; clear(); $("status").textContent = "この端末の現在庫・販売予定を確認しています…";
    try {
      const [products, plans] = state.sample ? sampleInventory() : await Promise.all([getAllProducts(), getAllSalesPlans()]);
      if (request !== generation) return;
      state.result = core.aggregate(state.rows, products, plans); state.loaded = new Date().toLocaleString("ja-JP");
      $("status").textContent = `${state.sample ? "【架空データ】" : ""}${state.name} ／ 在庫・販売予定の取得日時：${state.loaded}`;
      $("refresh").disabled = false; render();
    } catch (error) { if (request === generation) { clear(); $("refresh").disabled = false; $("status").textContent = "照合できませんでした：" + error.message; } }
  }
  function row(item, site) {
    const stock = item.stock === null ? (item.matched ? "在庫数不明" : "未登録") : `${number(item.stock)}個`;
    const status = [item.planned ? "販売予定あり" : "", item.shortage ? `在庫不足（${number(item.qty - item.stock)}個）` : "", item.duplicates > 1 ? `同JAN ${item.duplicates}件：${item.stock === null ? "在庫数要確認" : "最大在庫を採用"}` : ""].filter(Boolean).join(" ／ ") || "—";
    return `<tr class="${item.planned ? "amazon-planned" : ""}"><td>${escape(item.jan)}</td><td>${escape(item.name)}<br><small>${escape(item.internalCode)}</small></td><td class="qty">${number(site ? item.siteQty : item.qty)}</td>${site ? `<td class="qty">${number(item.qty)}</td>` : ""}<td class="qty ${item.shortage ? "amazon-short" : ""}">${stock}</td><td>${escape(status)}</td></tr>`;
  }
  function table(items, site) {
    return `<div class="amazon-table-wrap"><table class="amazon-table"><thead><tr><th>JAN</th><th>商品名 ／ 社内コード</th><th>${site ? "この配送先の数量" : "Amazon必要数"}</th>${site ? "<th>全配送先必要数</th>" : ""}<th>現在庫（この端末）</th><th>確認事項</th></tr></thead><tbody>${items.map(i => row(i, site)).join("")}</tbody></table></div>`;
  }
  function report() {
    const r = state.result; if (!r) return "";
    const filtered = state.view === "site" && state.destination !== null;
    const groups = filtered ? r.sites.filter(g => g.site === state.destination) : r.sites;
    const displayedIssues = filtered ? r.issues.filter(i => (i.site || "（配送先未指定）") === state.destination) : r.issues;
    const excluded = groups.reduce((n, g) => n + g.excluded, 0);
    const unknown = groups.reduce((n, g) => n + g.unknown, 0);
    const total = groups.reduce((n, g) => n + g.qty, 0);
    const warning = displayedIssues.length ? `<p class="amazon-warning">要確認：${number(displayedIssues.length)}行。数量が確認できた${number(excluded)}個は、配送先合計に含めますが商品別集計・在庫照合には含めません。${unknown ? `数量不明${number(unknown)}行は合計に含まれず、表示対象の総数量は確定していません。` : ""}</p>` : "";
    let body;
    if (state.view === "product") body = r.items.length ? table(r.items, false) : "<p>JANの確認が済んだ商品はありません。配送先別で数量を確認できます。</p>";
    else body = `<div class="amazon-table-wrap"><table class="amazon-table"><thead><tr><th>配送先</th><th>数量（確認済み分）</th><th>うち商品照合対象外</th><th>数量不明の行</th></tr></thead><tbody>${groups.map(g => `<tr><td>${escape(g.site)}</td><td class="qty">${number(g.qty)}</td><td class="qty">${number(g.excluded)}</td><td class="qty">${number(g.unknown)}</td></tr>`).join("")}<tr class="amazon-total"><td>${filtered ? "選択配送先の合計" : "全配送先合計"}</td><td class="qty">${number(total)}</td><td class="qty">${number(excluded)}</td><td class="qty">${number(unknown)}</td></tr></tbody></table></div>` + groups.map(g => `<h3>${escape(g.site)} ／ ${number(g.qty)}個${g.unknown ? "（数量不明あり）" : ""}</h3>${g.items.length ? table(g.items, true) : "<p>商品別の内訳はJAN等の確認後に表示します。</p>"}`).join("");
    const issues = displayedIssues.length ? `<h3>確認が必要な明細（別商品と混ぜず、元の行ごとに表示）</h3><div class="amazon-table-wrap"><table class="amazon-table"><thead><tr><th>CSV行</th><th>配送先</th><th>JAN（元の表記）</th><th>商品名</th><th>数量</th><th>確認事項</th></tr></thead><tbody>${displayedIssues.map(i => `<tr><td>${i.line}</td><td>${escape(i.site)}</td><td>${escape(i.jan)}</td><td>${escape(i.name)}</td><td class="qty">${i.qty === null ? "不明" : number(i.qty)}</td><td>${escape(i.issues.join(" ／ "))}</td></tr>`).join("")}</tbody></table></div>` : "";
    return `<h2>${state.sample ? "【架空データ】" : ""}Amazon CSV ${state.view === "product" ? "商品別集計" : "配送先別集計"}</h2><p>${escape(state.name)} ／ 取得日時：${escape(state.loaded)}</p>
      <p class="amazon-summary">CSV全体：${number(state.rows.length)}行 ／ 配送先 ${number(r.sites.length)}件 ／ 数量の確認済み合計 ${number(r.total)}個 ／ 商品照合対象 ${number(r.items.length)}商品・${number(r.eligible)}個</p>
      ${state.view === "site" ? `<p class="amazon-summary">表示・印刷対象：${filtered ? escape(state.destination) : "すべての配送先"} ／ 数量の確認済み合計 ${number(total)}個${unknown ? "（数量不明あり）" : ""}</p>` : ""}
      ${warning}<p>黄色＝販売予定あり（この端末に登録済みの全予定。過去分も含む）。赤字＝全配送先のAmazon必要数が現在庫を超過。販売予定の数量は差し引きません。<br>同JANの在庫は数量が最大の商品を採用し、合算しません。配送先別の現在庫は全体在庫の参考表示です。配送先への割当ではありません。</p>${body}${issues}`;
  }
  function render() {
    const groups = state.result ? state.result.sites : [];
    if (state.destination !== null && !groups.some(g => g.site === state.destination)) state.destination = null;
    $("destination-controls").hidden = state.view !== "site";
    $("destination").innerHTML = '<option value="">すべての配送先</option>' + groups.map((g, i) => `<option value="${i}">${escape(g.site)}</option>`).join("");
    const selected = groups.findIndex(g => g.site === state.destination);
    $("destination").value = selected < 0 ? "" : String(selected);
    $("destination").disabled = !state.result;
    $("product").setAttribute("aria-pressed", String(state.view === "product")); $("site").setAttribute("aria-pressed", String(state.view === "site"));
    $("output").innerHTML = report(); $("print").disabled = !state.result;
  }
  function print() {
    if (!state.result) return;
    const popup = window.open("", "_blank");
    if (!popup) { window.alert("印刷画面を開くには、ポップアップを許可してください。"); return; }
    popup.document.open(); popup.document.write(`<!doctype html><html lang="ja"><head><meta charset="utf-8"><title>Amazon CSV集計</title><style>${style}</style></head><body><button id="print-again">印刷する</button>${report()}</body></html>`); popup.document.close();
    popup.document.getElementById("print-again").addEventListener("click", () => popup.print()); popup.focus(); popup.print();
  }
  function sampleInventory() {
    return [[{janCode:"4901234567894",internalCode:"DEMO-A1",productName:"架空商品A",stock:2}, {janCode:"4901234567894",internalCode:"DEMO-A2",productName:"架空商品A（重複）",stock:8}, {janCode:"4901234567900",internalCode:"DEMO-B",productName:"架空商品B",stock:20}], [{internalCode:"DEMO-A1",quantity:3}]];
  }
  function sample() {
    generation++; clear(); state.destination = null; $("file").value = ""; state.sample = true; state.name = "架空CSV（保存・在庫変更なし）";
    state.rows = [{line:2,site:"架空配送先・東",jan:"4901234567894",qty:6,name:"架空商品A",issues:[]},{line:3,site:"架空配送先・西",jan:"4901234567894",qty:4,name:"架空商品A",issues:[]},{line:4,site:"架空配送先・東",jan:"4901234567900",qty:5,name:"架空商品B",issues:[]}];
    refresh();
  }
})();
