"use strict";

(function (root) {
  const fields = [
    { key: "stock", label: "在庫合計" },
    { key: "order", label: "発注残" }
  ];

  function candidate(row, key) {
    const before = row.shared?.[key];
    const after = row.local?.[key];
    if (!Number.isSafeInteger(before) || !Number.isSafeInteger(after) ||
        before < 0 || after < 0 || before === after) return null;
    return { before, after };
  }

  function quantity(value) {
    if (typeof value === "string" && /^-?\d+$/.test(value.trim())) {
      value = Number(value);
    }
    return Number.isSafeInteger(value) ? value : null;
  }

  function compare(backup, shared) {
    if (backup?.backupType !== "barcode-inventory-app" ||
        !Array.isArray(backup.data?.products) || !backup.data.products.length ||
        !Number.isFinite(Date.parse(backup.exportedAt))) {
      throw new Error("普段使っているアプリの全データバックアップを選んでください。");
    }

    const rows = new Map();
    function addProducts(products, side, codeField, productField, nameField, stockField) {
      for (const product of products) {
        const code = String(product?.[codeField] ?? "").trim();
        if (!code || rows.get(code)?.[side]) {
          throw new Error("社内コードに空欄または重複があり、商品を照合できません。");
        }
        const row = rows.get(code) ?? { code };
        row[side] = {
          productCode: String(product[productField] ?? ""),
          name: String(product[nameField] ?? ""),
          stock: quantity(product[stockField]),
          order: quantity(product.orderRemaining)
        };
        rows.set(code, row);
      }
    }

    addProducts(backup.data.products, "local", "internalCode", "productCode", "productName", "stock");
    addProducts(shared.products, "shared", "internal_code", "product_code", "product_name", "total_stock");
    const orders = new Map((shared.planning.data?.purchaseMetadata ?? [])
      .map(row => [row.internalCode, row.orderRemaining]));

    const counts = { stock: 0, order: 0, unknown: 0 };
    for (const row of rows.values()) {
      if (row.shared) row.shared.order = quantity(orders.get(row.code));
      const { local, shared: server } = row;
      const stockUnknown = local?.stock == null || server?.stock == null;
      const orderUnknown = local?.order == null || server?.order == null;
      const stockDiff = !stockUnknown && local.stock !== server.stock;
      const orderDiff = !orderUnknown && local.order !== server.order;
      row.different = stockDiff || orderDiff || stockUnknown || orderUnknown;
      counts.stock += Number(stockDiff);
      counts.order += Number(orderDiff);
      counts.unknown += Number(stockUnknown || orderUnknown);
    }
    return { rows: [...rows.values()], counts };
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = compare;
    module.exports.candidate = candidate;
  }
  if (!root.document) return;

  root.document.addEventListener("DOMContentLoaded", () => {
    const screen = root.document.getElementById("app-settings-screen");
    if (!screen) return;

    const box = root.document.createElement("details");
    box.id = "shared-stock-compare";
    box.innerHTML = `
      <summary><strong>共有在庫・発注残を照合（管理者用）</strong></summary>
      <p>普段使っているアプリの全データバックアップと、共有サーバーの在庫・発注残を社内コードで照合します。バックアップはこのPCで読み取り、照合結果を画面に表示します。</p>
      <label>全データバックアップ <input type="file" accept=".json,application/json"></label>
      <button type="button" data-run>差を確認する</button>
      <p data-status role="status"></p>
      <div data-results hidden>
        <label>商品を検索 <input type="search" placeholder="社内コード・商品コード・商品名"></label>
        <p>差がある項目を選んで、反映候補を確認できます。選んだ内容はこの画面で確認するためのものです。</p>
        <button type="button" data-review disabled>選んだ反映候補を確認する</button>
        <p data-selection-count role="status"></p>
        <section data-preview hidden aria-label="選んだ反映候補">
          <h3 tabindex="-1">選んだ反映候補（プレビュー）</h3>
          <p>在庫は合計の比較です。反映前には保管場所ごとの確認が必要です。</p>
          <div data-preview-list></div>
        </section>
        <p data-count role="status"></p>
        <div data-list></div>
      </div>`;
    screen.appendChild(box);

    const fileInput = box.querySelector('input[type="file"]');
    const search = box.querySelector('input[type="search"]');
    const run = box.querySelector("[data-run]");
    const status = box.querySelector("[data-status]");
    const results = box.querySelector("[data-results]");
    const count = box.querySelector("[data-count]");
    const list = box.querySelector("[data-list]");
    const review = box.querySelector("[data-review]");
    const selectionCount = box.querySelector("[data-selection-count]");
    const preview = box.querySelector("[data-preview]");
    const previewList = box.querySelector("[data-preview-list]");
    const admin = () => root.document.body.dataset.roleMode !== "worker" &&
      root.inventoryServerSearch?.getSession()?.user?.role === "admin";
    const date = value => {
      const timestamp = Date.parse(value);
      return Number.isFinite(timestamp)
        ? new Date(timestamp).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })
        : "日時不明";
    };
    const units = value => value == null ? "未確認" : value.toLocaleString("ja-JP") + "個";
    const side = item => item ? "在庫 " + units(item.stock) + " ／ 発注残 " + units(item.order) : "商品なし";
    const titleFor = row => [row.code, row.local?.productCode || row.shared?.productCode,
      row.local?.name || row.shared?.name].filter(Boolean).join(" ／ ");
    let generation = 0;
    let rows = [];
    const selected = new Map();

    function refreshSelection() {
      review.disabled = selected.size === 0;
      selectionCount.textContent = "選択中 " + selected.size + "項目";
      preview.hidden = true;
      previewList.replaceChildren();
    }

    function clear() {
      generation++;
      rows = [];
      status.textContent = "";
      list.replaceChildren();
      results.hidden = true;
      search.value = "";
      run.disabled = false;
      selected.clear();
      refreshSelection();
    }

    function render() {
      const query = search.value.trim().toLowerCase();
      const visible = rows.filter(row => query
        ? [row.code, row.local?.productCode, row.shared?.productCode, row.local?.name, row.shared?.name]
            .some(value => value?.toLowerCase().includes(query))
        : row.different);
      count.textContent = visible.length === 0
        ? (query ? "条件に合う商品がありません。" : "在庫と発注残がすべて一致しました。")
        : "該当 " + visible.length + "件" + (query ? "" : "（差または未確認あり）") +
          (visible.length > 100 ? "。先頭100件を表示しています。商品を検索して絞り込めます。" : "");
      list.replaceChildren();
      for (const row of visible.slice(0, 100)) {
        const article = root.document.createElement("article");
        const title = root.document.createElement("strong");
        const local = root.document.createElement("div");
        const server = root.document.createElement("div");
        title.textContent = titleFor(row);
        local.textContent = "バックアップ　" + side(row.local);
        server.textContent = "共有サーバー　" + side(row.shared);
        article.append(title, local, server);
        for (const { key, label } of fields) {
          const change = candidate(row, key);
          if (!change) continue;
          const selectionKey = JSON.stringify([row.code, key]);
          const option = root.document.createElement("label");
          option.className = "shared-compare-option";
          const checkbox = root.document.createElement("input");
          checkbox.type = "checkbox";
          checkbox.checked = selected.has(selectionKey);
          checkbox.addEventListener("change", () => {
            if (checkbox.checked) selected.set(selectionKey, { row, label, ...change });
            else selected.delete(selectionKey);
            refreshSelection();
          });
          option.append(checkbox, label + "を反映候補に選ぶ");
          article.appendChild(option);
        }
        list.appendChild(article);
      }
    }

    fileInput.addEventListener("change", clear);
    search.addEventListener("input", render);
    review.addEventListener("click", () => {
      previewList.replaceChildren();
      for (const { row, label, before, after } of selected.values()) {
        const article = root.document.createElement("article");
        const title = root.document.createElement("strong");
        const change = root.document.createElement("div");
        title.textContent = titleFor(row) + " ／ " + label;
        change.textContent = "共有側 " + units(before) + " → 反映候補 " + units(after);
        article.append(title, change);
        previewList.appendChild(article);
      }
      preview.hidden = false;
      preview.querySelector("h3").focus();
    });
    function resetAccess() {
      clear();
      fileInput.value = "";
      box.hidden = root.document.body.dataset.roleMode === "worker";
    }
    root.addEventListener("inventory-server-auth-changed", resetAccess);
    root.addEventListener("inventory-role-mode-change", resetAccess);
    resetAccess();

    run.addEventListener("click", async () => {
      clear();
      const request = generation;
      run.disabled = true;
      try {
        if (!admin()) throw new Error("共有サーバーの管理者でログインしてください。");
        const file = fileInput.files[0];
        if (!file || file.size > 100000000) {
          throw new Error("100MB以下の全データバックアップJSONを選んでください。");
        }
        status.textContent = "バックアップと共有データを照合しています。";
        let backup;
        try {
          backup = JSON.parse(await file.text());
        } catch {
          throw new Error("バックアップのJSONを読み取れませんでした。");
        }
        if (request !== generation) return;
        const shared = await root.inventorySharedSalesSummary.read();
        if (request !== generation || !admin()) return;
        const result = compare(backup, shared);
        rows = result.rows;
        status.textContent =
          "バックアップ作成 " + date(backup.exportedAt) + " ／ 共有在庫取得 " + date(shared.fetched_at) +
          " ／ 発注残の共有日時 " + (shared.planning.updated_at || "未共有") +
          "。在庫差 " + result.counts.stock + "件 ／ 発注残差 " + result.counts.order +
          "件 ／ 未確認 " + result.counts.unknown + "件（重複あり）。";
        render();
        results.hidden = false;
      } catch (error) {
        if (request === generation) status.textContent = error.message;
      } finally {
        if (request === generation) run.disabled = false;
      }
    });
  });
})(typeof window === "undefined" ? globalThis : window);
