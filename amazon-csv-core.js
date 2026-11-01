"use strict";
/* Pure, read-only Amazon order aggregation. JANs never pass through Number. */
(function (root) {
  const clean = value => String(value == null ? "" : value).trim();
  const MAX_ROWS = 20000;
  function add(a, b) {
    const n = a + b;
    if (!Number.isSafeInteger(n)) throw new Error("数量の合計が大きすぎます。");
    return n;
  }
  function parseCsv(text) {
    if (text.length > 10 * 1024 * 1024) throw new Error("CSVは10MB以内にしてください。");
    text = text.replace(/^\uFEFF/, "");
    const rows = []; let row = [], field = "", quoted = false, closed = false;
    function cell() { row.push(field); field = ""; closed = false; }
    function line() { cell(); if (row.some(x => clean(x))) rows.push(row); row = []; if (rows.length > MAX_ROWS + 1) throw new Error("CSVは20,000行以内にしてください。"); }
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (quoted) {
        if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else { quoted = false; closed = true; } }
        else field += c;
      } else if (c === ",") cell();
      else if (c === "\r" || c === "\n") { if (c === "\r" && text[i + 1] === "\n") i++; line(); }
      else if (c === '"' && field === "" && !closed) quoted = true;
      else { if (closed || c === '"') throw new Error("CSVの引用符が正しくありません。"); field += c; }
    }
    if (quoted) throw new Error("CSVの引用符が閉じていません。");
    if (field || row.length || closed) line();
    return rows;
  }
  function janIssue(value) {
    const jan = clean(value);
    if (/[eE][+-]?\d/.test(jan)) return "JANが指数表記です（元の桁を確認してください）";
    if (!/^(\d{8}|\d{13})$/.test(jan)) return "JANは8桁または13桁の数字が必要です";
    if (/0{6}$/.test(jan)) return "JAN末尾に0が続いています（丸められていないか確認してください）";
    let sum = 0;
    for (let i = jan.length - 2, weight = 3; i >= 0; i--, weight = 4 - weight) sum += Number(jan[i]) * weight;
    if ((10 - sum % 10) % 10 !== Number(jan.at(-1))) return "JANのチェック桁が一致しません";
    return "";
  }
  function quantity(value) {
    const s = clean(value);
    if (!/^(\d+|\d{1,3}(,\d{3})+)$/.test(s)) return null;
    const n = Number(s.replace(/,/g, ""));
    return Number.isSafeInteger(n) && n >= 0 ? n : null;
  }
  function read(text) {
    const csv = parseCsv(text);
    if (csv.length < 2) throw new Error("見出しと明細が必要です。");
    const h = csv.shift().map(clean);
    if (!/^(配送センター|配送先拠点|配送先拠点名)$/.test(h[2] || "") || !/^(製品コード|JAN|JANコード)$/i.test(h[4] || "") || !/^(依頼数量|数量)$/.test(h[13] || "")) throw new Error("列を確認してください。C列：配送先拠点、E列：JANコード、N列：数量（見出し行が必要です）。");
    const rows = csv.map((cells, i) => {
      if (cells.length < 14) throw new Error(`明細${i + 1}行目の列が不足しています。`);
      const jan = clean(cells[4]), site = clean(cells[2]), qty = quantity(cells[13]);
      const issues = [];
      if (qty === null) issues.push("数量が0以上の整数ではありません");
      if (!site) issues.push("配送先拠点がありません");
      const problem = janIssue(jan); if (problem) issues.push(problem);
      return {line: i + 2, jan, site, qty, name: clean(cells[7]), model: clean(cells[6]), issues};
    });
    return rows;
  }
  function aggregate(rows, products, plans) {
    const byJan = new Map(), sites = new Map(), issues = [];
    let total = 0, eligible = 0, invalidQuantityRows = 0;
    for (const row of rows) {
      if (row.qty !== null) total = add(total, row.qty); else invalidQuantityRows++;
      const site = row.site || "（拠点未指定）";
      if (!sites.has(site)) sites.set(site, {site, qty: 0, unknown: 0, excluded: 0, items: new Map()});
      const group = sites.get(site);
      if (row.qty !== null) group.qty = add(group.qty, row.qty); else group.unknown++;
      if (row.issues.length) { issues.push(row); if (row.qty !== null) group.excluded = add(group.excluded, row.qty); continue; }
      eligible = add(eligible, row.qty);
      if (!byJan.has(row.jan)) byJan.set(row.jan, {jan: row.jan, name: row.name, qty: 0, sites: new Set()});
      const item = byJan.get(row.jan); item.qty = add(item.qty, row.qty); item.sites.add(site);
      group.items.set(row.jan, add(group.items.get(row.jan) || 0, row.qty));
    }
    const inventory = new Map();
    for (const p of products) {
      const jan = clean(p.janCode);
      if (janIssue(jan)) continue;
      if (!inventory.has(jan)) inventory.set(jan, []);
      inventory.get(jan).push(p);
    }
    const plannedCodes = new Set(plans.map(p => clean(p.internalCode)).filter(Boolean));
    const items = [...byJan.values()].map(item => {
      const matches = inventory.get(item.jan) || [];
      // Unknown/negative/fractional inventory must not become a fabricated zero.
      const valid = matches.filter(p => quantity(p.stock) !== null);
      valid.sort((a, b) => quantity(b.stock) - quantity(a.stock) || clean(a.internalCode).localeCompare(clean(b.internalCode), "ja"));
      const best = valid[0] || matches[0];
      // If even one duplicate has unknown stock, its maximum cannot be known.
      const stock = best && valid.length === matches.length ? quantity(best.stock) : null;
      return {...item, sites: [...item.sites], name: best ? clean(best.productName) || item.name : item.name,
        internalCode: best ? clean(best.internalCode) : "", stock, duplicates: matches.length,
        planned: matches.some(p => plannedCodes.has(clean(p.internalCode))),
        shortage: stock !== null && stock < item.qty, matched: matches.length > 0};
    }).sort((a, b) => a.jan.localeCompare(b.jan));
    const itemMap = new Map(items.map(item => [item.jan, item]));
    return {total, eligible, excluded: total - eligible, invalidQuantityRows, issues, items,
      sites: [...sites.values()].sort((a, b) => a.site.localeCompare(b.site, "ja")).map(g => ({...g, items: [...g.items].map(([jan, qty]) => ({...itemMap.get(jan), siteQty: qty}))}))};
  }
  root.inventoryAmazonCsv = Object.freeze({parseCsv, janIssue, quantity, read, aggregate});
})(typeof window === "undefined" ? globalThis : window);
