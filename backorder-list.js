"use strict";

(function () {
  let importedRows = [];
  let masterProducts = [];
  let currentProducts = [];

  document.addEventListener("DOMContentLoaded", initializeBackorderListFeature);

  function initializeBackorderListFeature() {
    const showButton = document.querySelector("#show-backorder-list-button");
    const backButton = document.querySelector("#back-home-from-backorder-list");
    const fileInput = document.querySelector("#backorder-csv-file");
    const clearButton = document.querySelector("#clear-backorder-csv-preview");
    const applyButton = document.querySelector("#apply-backorder-csv");
    const selectAllButton = document.querySelector("#select-all-backorder-csv");
    const clearSelectionButton = document.querySelector("#clear-backorder-csv-selection");
    const previewSearch = document.querySelector("#backorder-preview-search");
    const currentSearch = document.querySelector("#backorder-current-search");
    const refreshButton = document.querySelector("#refresh-backorder-current-list");

    if (!showButton || !document.querySelector("#backorder-list-screen")) return;

    createBackorderListStyle();

    showButton.addEventListener("click", openBackorderListScreen);
    if (backButton) backButton.addEventListener("click", closeBackorderListScreen);
    if (fileInput) fileInput.addEventListener("change", handleBackorderCsvFile);
    if (clearButton) clearButton.addEventListener("click", clearBackorderCsvPreview);
    if (applyButton) applyButton.addEventListener("click", applySelectedBackorders);

    if (selectAllButton) {
      selectAllButton.addEventListener("click", function () {
        importedRows.forEach(function (row) {
          if (row.canApply) row.selected = true;
        });
        renderBackorderPreview();
      });
    }

    if (clearSelectionButton) {
      clearSelectionButton.addEventListener("click", function () {
        importedRows.forEach(function (row) {
          row.selected = false;
        });
        renderBackorderPreview();
      });
    }

    if (previewSearch) previewSearch.addEventListener("input", renderBackorderPreview);
    if (currentSearch) currentSearch.addEventListener("input", renderCurrentBackorderList);
    if (refreshButton) refreshButton.addEventListener("click", loadCurrentBackorderList);
  }

  async function openBackorderListScreen() {
    if (!(await requireBackorderAdminPermission("注残CSVの読み込み"))) return;

    document.querySelectorAll("main > section").forEach(function (section) {
      section.hidden = true;
    });

    const screen = document.querySelector("#backorder-list-screen");
    if (!screen) return;

    screen.hidden = false;
    await loadCurrentBackorderList();
    renderBackorderPreview();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function closeBackorderListScreen() {
    const screen = document.querySelector("#backorder-list-screen");
    if (screen) screen.hidden = true;

    if (window.inventoryApp && typeof window.inventoryApp.showScreen === "function") {
      window.inventoryApp.showScreen("home");
    } else {
      const home = document.querySelector("#home");
      if (home) home.hidden = false;
    }

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function requireBackorderAdminPermission(actionName) {
    if (
      window.inventoryPermissions &&
      typeof window.inventoryPermissions.requireAdmin === "function"
    ) {
      return window.inventoryPermissions.requireAdmin(actionName);
    }

    return true;
  }

  async function handleBackorderCsvFile(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    setBackorderMessage("CSVを読み込んでいます…", "info");

    try {
      const text = await file.text();
      const csvRows = parseCsvText(text);
      const products = await getAllProducts();
      masterProducts = Array.isArray(products) ? products.slice() : [];
      importedRows = buildBackorderImportRows(csvRows, masterProducts);

      if (importedRows.length === 0) {
        setBackorderMessage(
          "読み込める商品がありませんでした。B列の社内コードとI列の数量を確認してください。",
          "warning"
        );
      } else {
        const matched = importedRows.filter(function (row) { return row.canApply; }).length;
        const unmatched = importedRows.length - matched;
        setBackorderMessage(
          `CSVから${importedRows.length.toLocaleString("ja-JP")}商品を読み込みました。一致：${matched.toLocaleString("ja-JP")}商品 / 要確認：${unmatched.toLocaleString("ja-JP")}商品`,
          unmatched > 0 ? "warning" : "success"
        );
      }

      renderBackorderPreview();
    } catch (error) {
      console.error("注残CSV読込エラー", error);
      importedRows = [];
      renderBackorderPreview();
      setBackorderMessage("CSVを読み込めませんでした。ファイル形式を確認してください。", "error");
    }
  }

  function isBackorderDedicatedProtected(product) {
    if (!product) return false;

    if (product.dedicatedStatusLocked === true) {
      return true;
    }

    const status = String(
      product.productStatus || ""
    )
      .normalize("NFKC")
      .trim()
      .toLowerCase();

    return (
      status === "専用商品" ||
      status === "専用" ||
      status === "dedicated" ||
      status === "exclusive"
    );
  }

  function buildBackorderImportRows(csvRows, products) {
    const merged = new Map();

    (Array.isArray(csvRows) ? csvRows : []).forEach(function (row) {
      const internalCode = normalizeBackorderCode(row[1]);
      const productCode = normalizeBackorderText(row[2]);
      const productName = normalizeBackorderText(row[3]);
      const color = normalizeBackorderText(row[4]);
      const quantity = parseBackorderQuantity(row[8]);

      if (!isBackorderDataInternalCode(internalCode)) return;
      if (!Number.isFinite(quantity) || quantity <= 0) return;

      const key = internalCode || `product:${normalizeBackorderKey(productCode)}`;
      if (!key) return;

      const existing = merged.get(key);
      if (existing) {
        existing.quantity += quantity;
        if (!existing.productCode && productCode) existing.productCode = productCode;
        if (!existing.productName && productName) existing.productName = productName;
        if (!existing.color && color) existing.color = color;
        return;
      }

      merged.set(key, {
        internalCode: internalCode,
        productCode: productCode,
        productName: productName,
        color: color,
        quantity: quantity
      });
    });

    return Array.from(merged.values()).map(function (row) {
      const internalMatch = products.find(function (product) {
        return normalizeBackorderCode(product && product.internalCode) === row.internalCode;
      });

      let product = internalMatch || null;
      let matchType = internalMatch ? "社内コード一致" : "";

      if (!product && row.productCode) {
        const matches = products.filter(function (candidate) {
          return normalizeBackorderKey(candidate && candidate.productCode) === normalizeBackorderKey(row.productCode);
        });

        if (matches.length === 1) {
          product = matches[0];
          matchType = "商品コード一致";
        }
      }

      let issue = "";
      let canApply = Boolean(product);

      if (!product) {
        issue = "商品マスタに未登録";
        canApply = false;
      } else if (
        row.productCode &&
        product.productCode &&
        normalizeBackorderKey(row.productCode) !== normalizeBackorderKey(product.productCode)
      ) {
        issue = "社内コードは一致していますが商品コードが異なります";
        canApply = false;
      } else if (
        isBackorderDedicatedProtected(
          product
        )
      ) {
        issue =
          "専用商品（固定のため注残へ変更しません）";
        canApply = false;
      }

      return {
        ...row,
        product: product,
        matchType: matchType,
        issue: issue,
        canApply: canApply,
        selected: canApply,
        currentBackorderStatus: product ? getBackorderStatus(product) : "",
        masterProductName: product ? String(product.productName || "") : "",
        masterColor: product ? String(product.productColor || "") : ""
      };
    }).sort(function (a, b) {
      if (a.canApply !== b.canApply) return a.canApply ? -1 : 1;
      return String(a.internalCode || "").localeCompare(String(b.internalCode || ""), "ja", { numeric: true });
    });
  }

  async function applySelectedBackorders() {
    const selectedRows = importedRows.filter(function (row) {
      return row.canApply && row.selected && row.product;
    });

    if (selectedRows.length === 0) {
      await showBackorderDialog({
        type: "warning",
        icon: "⚠️",
        title: "反映する商品を選んでください",
        message: "CSV読込結果から、注残に変更する商品を1件以上選択してください。",
        confirmText: "確認"
      });
      return;
    }

    if (!(await requireBackorderAdminPermission("注残状態の一括反映"))) return;

    const totalQuantity = selectedRows.reduce(function (sum, row) {
      return sum + Number(row.quantity || 0);
    }, 0);

    const confirmed = await showBackorderConfirmDialog(
      selectedRows.length,
      totalQuantity
    );

    if (!confirmed) return;

    const now = new Date().toISOString();
    const updatedProducts = selectedRows.map(function (row) {
      return {
        ...row.product,
        backorderStatus: "注残",
        backorderQuantity: Math.max(0, Math.trunc(Number(row.quantity || 0))),
        backorderSource: "注残CSV",
        backorderUpdatedAt: now,
        updatedAt: now
      };
    });

    try {
      await updateProductsInBatch(updatedProducts);

      updatedProducts.forEach(function (product) {
        if (
          window.inventoryApp &&
          typeof window.inventoryApp.applyUpdatedProduct === "function"
        ) {
          window.inventoryApp.applyUpdatedProduct(product);
        }
      });

      selectedRows.forEach(function (row) {
        row.product = updatedProducts.find(function (product) {
          return normalizeBackorderCode(product.internalCode) === normalizeBackorderCode(row.product.internalCode);
        }) || row.product;
        row.currentBackorderStatus = "注残";
      });

      setBackorderMessage(
        `${selectedRows.length.toLocaleString("ja-JP")}商品を「注残」に反映しました。ホームの「船積が必要」では注残商品を優先して表示します。`,
        "success"
      );

      await loadCurrentBackorderList();
      renderBackorderPreview();

      await showBackorderDialog({
        type: "success",
        icon: "✅",
        title: "注残を反映しました",
        message: "選択した商品の在庫状態を「注残」に変更しました。",
        details: [
          { label: "反映商品数", value: `${selectedRows.length.toLocaleString("ja-JP")}商品` },
          { label: "注残数量合計", value: `${totalQuantity.toLocaleString("ja-JP")}個` }
        ],
        confirmText: "閉じる"
      });
    } catch (error) {
      console.error("注残一括反映エラー", error);
      setBackorderMessage("注残を反映できませんでした。もう一度お試しください。", "error");
    }
  }

  async function loadCurrentBackorderList() {
    const body = document.querySelector("#backorder-current-table-body");
    if (body) {
      body.innerHTML = '<tr><td colspan="7">読み込んでいます…</td></tr>';
    }

    try {
      const products = await getAllProducts();
      currentProducts = (Array.isArray(products) ? products : []).filter(function (product) {
        return getBackorderStatus(product) === "注残";
      }).sort(function (a, b) {
        const aQuantity = Number(a.backorderQuantity || 0);
        const bQuantity = Number(b.backorderQuantity || 0);
        if (bQuantity !== aQuantity) return bQuantity - aQuantity;
        return String(a.internalCode || "").localeCompare(String(b.internalCode || ""), "ja", { numeric: true });
      });

      renderCurrentBackorderList();
    } catch (error) {
      console.error("注残リスト読込エラー", error);
      if (body) body.innerHTML = '<tr><td colspan="7">注残リストを読み込めませんでした。</td></tr>';
    }
  }

  function renderBackorderPreview() {
    const area = document.querySelector("#backorder-csv-preview");
    const body = document.querySelector("#backorder-preview-table-body");
    const summary = document.querySelector("#backorder-preview-summary");
    const applyButton = document.querySelector("#apply-backorder-csv");

    if (!area || !body || !summary || !applyButton) return;

    area.hidden = importedRows.length === 0;

    if (importedRows.length === 0) {
      body.innerHTML = "";
      summary.textContent = "CSVを読み込むと、ここに照合結果が表示されます。";
      applyButton.disabled = true;
      return;
    }

    const search = normalizeBackorderKey(document.querySelector("#backorder-preview-search")?.value || "");
    const filtered = importedRows.filter(function (row) {
      if (!search) return true;
      return [
        row.internalCode,
        row.productCode,
        row.productName,
        row.masterProductName,
        row.color,
        row.issue,
        row.matchType,
        row.currentBackorderStatus
      ].some(function (value) {
        return normalizeBackorderKey(value).includes(search);
      });
    });

    const matched = importedRows.filter(function (row) { return row.canApply; }).length;
    const selected = importedRows.filter(function (row) { return row.canApply && row.selected; }).length;
    const totalQuantity = importedRows.reduce(function (sum, row) { return sum + Number(row.quantity || 0); }, 0);

    summary.innerHTML = `
      <div><span>CSV商品数</span><strong>${importedRows.length.toLocaleString("ja-JP")}商品</strong></div>
      <div><span>商品マスタ一致</span><strong>${matched.toLocaleString("ja-JP")}商品</strong></div>
      <div><span>反映選択</span><strong>${selected.toLocaleString("ja-JP")}商品</strong></div>
      <div><span>注残数量合計</span><strong>${totalQuantity.toLocaleString("ja-JP")}個</strong></div>
    `;

    body.innerHTML = filtered.map(function (row, visibleIndex) {
      const actualIndex = importedRows.indexOf(row);
      const productName = row.masterProductName || row.productName || "-";
      const color = row.masterColor || row.color || "-";
      const stateText =
        row.product &&
        isBackorderDedicatedProtected(
          row.product
        )
          ? "専用商品"
          : row.currentBackorderStatus ===
              "注残"
            ? "注残"
            : "通常";
      const statusClass = row.canApply ? "backorder-match-ok" : "backorder-match-warning";
      const statusText = row.canApply ? row.matchType : row.issue;

      return `
        <tr class="${row.currentBackorderStatus === "注残" ? "backorder-row-active" : ""}">
          <td class="backorder-check-cell">
            <input
              type="checkbox"
              data-backorder-select="${actualIndex}"
              ${row.selected ? "checked" : ""}
              ${row.canApply ? "" : "disabled"}
              aria-label="${escapeBackorderHtml(productName)}を注残に反映"
            >
          </td>
          <td><span class="backorder-match ${statusClass}">${escapeBackorderHtml(statusText || "確認")}</span></td>
          <td>${escapeBackorderHtml(row.internalCode || "-")}</td>
          <td>${escapeBackorderHtml((row.product && row.product.productCode) || row.productCode || "-")}</td>
          <td>${escapeBackorderHtml(productName)}</td>
          <td>${escapeBackorderHtml(color)}</td>
          <td class="number">${Number(row.quantity || 0).toLocaleString("ja-JP")}個</td>
          <td><span class="backorder-state ${stateText === "注残" ? "is-backorder" : ""}">${stateText}</span></td>
        </tr>
      `;
    }).join("") || '<tr><td colspan="8">検索条件に一致する商品はありません。</td></tr>';

    body.querySelectorAll("[data-backorder-select]").forEach(function (checkbox) {
      checkbox.addEventListener("change", function () {
        const index = Number(checkbox.dataset.backorderSelect);
        if (!Number.isInteger(index) || !importedRows[index]) return;
        importedRows[index].selected = checkbox.checked;
        renderBackorderPreview();
      });
    });

    applyButton.disabled = selected === 0;
  }

  function renderCurrentBackorderList() {
    const body = document.querySelector("#backorder-current-table-body");
    const count = document.querySelector("#backorder-current-count");
    if (!body || !count) return;

    const search = normalizeBackorderKey(document.querySelector("#backorder-current-search")?.value || "");
    const filtered = currentProducts.filter(function (product) {
      if (!search) return true;
      return [
        product.internalCode,
        product.productCode,
        product.productName,
        product.productColor,
        product.supplier,
        product.location
      ].some(function (value) {
        return normalizeBackorderKey(value).includes(search);
      });
    });

    count.textContent = `表示：${filtered.length.toLocaleString("ja-JP")}商品`;

    body.innerHTML = filtered.map(function (product) {
      const quantity = Number(product.backorderQuantity || 0);
      const updatedAt = product.backorderUpdatedAt || product.updatedAt || "";
      return `
        <tr class="backorder-row-active">
          <td>${escapeBackorderHtml(product.internalCode || "-")}</td>
          <td>${escapeBackorderHtml(product.productCode || "-")}</td>
          <td>${escapeBackorderHtml(product.productName || "-")}</td>
          <td>${escapeBackorderHtml(product.productColor || "-")}</td>
          <td class="number">${quantity > 0 ? `${quantity.toLocaleString("ja-JP")}個` : "-"}</td>
          <td><span class="backorder-state is-backorder">注残</span></td>
          <td>${escapeBackorderHtml(formatBackorderDateTime(updatedAt))}</td>
        </tr>
      `;
    }).join("") || '<tr><td colspan="7">現在「注残」の商品はありません。</td></tr>';
  }

  function clearBackorderCsvPreview() {
    importedRows = [];
    const fileInput = document.querySelector("#backorder-csv-file");
    const searchInput = document.querySelector("#backorder-preview-search");
    if (fileInput) fileInput.value = "";
    if (searchInput) searchInput.value = "";
    setBackorderMessage("CSVを選ぶと照合結果を表示します。", "info");
    renderBackorderPreview();
  }

  function parseCsvText(text) {
    const source = String(text || "").replace(/^\uFEFF/, "");
    const rows = [];
    let row = [];
    let cell = "";
    let quoted = false;

    for (let index = 0; index < source.length; index += 1) {
      const char = source[index];

      if (quoted) {
        if (char === '"') {
          if (source[index + 1] === '"') {
            cell += '"';
            index += 1;
          } else {
            quoted = false;
          }
        } else {
          cell += char;
        }
        continue;
      }

      if (char === '"') {
        quoted = true;
      } else if (char === ",") {
        row.push(cell);
        cell = "";
      } else if (char === "\n") {
        row.push(cell.replace(/\r$/, ""));
        rows.push(row);
        row = [];
        cell = "";
      } else {
        cell += char;
      }
    }

    if (cell !== "" || row.length > 0) {
      row.push(cell.replace(/\r$/, ""));
      rows.push(row);
    }

    return rows;
  }

  function parseBackorderQuantity(value) {
    const normalized = String(value == null ? "" : value)
      .normalize("NFKC")
      .replace(/[,，\s　]/g, "")
      .trim();

    if (!normalized) return NaN;
    const number = Number(normalized);
    if (!Number.isFinite(number)) return NaN;
    return Math.max(0, Math.trunc(number));
  }

  function normalizeBackorderCode(value) {
    let text = normalizeBackorderText(value);
    if (/^\d+\.0+$/.test(text)) text = text.replace(/\.0+$/, "");
    return text;
  }

  function normalizeBackorderText(value) {
    return String(value == null ? "" : value)
      .normalize("NFKC")
      .trim();
  }

  function normalizeBackorderKey(value) {
    return normalizeBackorderText(value).toLowerCase().replace(/[\s　]+/g, "");
  }

  function isBackorderDataInternalCode(value) {
    const text = normalizeBackorderCode(value);
    if (!text) return false;
    if (["社内コード", "(空白)", "空白", "総計", "合計"].includes(text)) return false;
    return /^[0-9A-Za-z_-]+$/.test(text);
  }

  function getBackorderStatus(product) {
    const value = String(
      product && (product.backorderStatus || product.inventoryStatus || "") || ""
    ).normalize("NFKC").trim().toLowerCase();

    return (
      value === "注残" ||
      value === "backorder" ||
      value === "backordered" ||
      Boolean(product && product.backorder === true)
    ) ? "注残" : "";
  }

  function setBackorderMessage(message, type) {
    const element = document.querySelector("#backorder-csv-message");
    if (!element) return;
    element.textContent = message || "";
    element.className = `backorder-csv-message ${type ? `backorder-message-${type}` : ""}`;
  }

  async function showBackorderConfirmDialog(productCount, totalQuantity) {
    if (window.inventoryApp && typeof window.inventoryApp.showAppDialog === "function") {
      return window.inventoryApp.showAppDialog({
        type: "warning",
        icon: "📋",
        title: "選択した商品を注残にしますか？",
        message: "選択した商品の在庫状態を「注残」に変更します。現在庫や発注残数は変更しません。",
        details: [
          { label: "対象商品", value: `${productCount.toLocaleString("ja-JP")}商品` },
          { label: "CSV注残数量合計", value: `${totalQuantity.toLocaleString("ja-JP")}個` }
        ],
        confirmText: "注残として反映",
        cancelText: "キャンセル",
        isConfirm: true
      });
    }

    return window.confirm(`${productCount}商品を注残に反映しますか？`);
  }

  async function showBackorderDialog(options) {
    if (window.inventoryApp && typeof window.inventoryApp.showAppDialog === "function") {
      return window.inventoryApp.showAppDialog(options);
    }

    window.alert(options && options.message ? options.message : "完了しました。");
    return true;
  }

  function formatBackorderDateTime(value) {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleString("ja-JP", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  function escapeBackorderHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function createBackorderListStyle() {
    if (document.querySelector("#backorder-list-feature-style")) return;

    const style = document.createElement("style");
    style.id = "backorder-list-feature-style";
    style.textContent = `
      #show-backorder-list-button {
        background: #f9a825 !important;
        color: #17202a !important;
      }

      #backorder-list-screen[hidden] { display: none !important; }

      #backorder-list-screen {
        max-width: 1120px;
        margin: 0 auto 32px;
      }

      #backorder-list-screen h2 { color: #9a6700; }

      .backorder-card {
        margin: 16px 0;
        padding: 18px;
        border: 1px solid #d7e1ea;
        border-radius: 12px;
        background: #ffffff;
      }

      .backorder-import-card {
        border: 2px solid #f6c344;
        background: #fffdf5;
      }

      .backorder-column-note {
        margin: 12px 0;
        padding: 12px 14px;
        border-radius: 9px;
        background: #fff3cd;
        color: #5d4500;
        line-height: 1.7;
      }

      .backorder-import-row,
      .backorder-list-toolbar,
      .backorder-preview-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        align-items: center;
      }

      #backorder-csv-file {
        flex: 1 1 360px;
        min-height: 46px;
        padding: 9px;
        border: 1px solid #b0bec5;
        border-radius: 8px;
        background: #ffffff;
      }

      .backorder-csv-message {
        margin: 12px 0 0;
        padding: 11px 13px;
        border-radius: 8px;
        background: #eef3f6;
        color: #37474f;
        font-weight: 700;
      }

      .backorder-message-success { background: #e8f5e9; color: #1b5e20; }
      .backorder-message-warning { background: #fff3e0; color: #b45309; }
      .backorder-message-error { background: #ffebee; color: #b71c1c; }

      .backorder-preview-summary {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 10px;
        margin: 14px 0;
      }

      .backorder-preview-summary > div {
        padding: 12px;
        border-radius: 9px;
        background: #f5f8fb;
        border: 1px solid #dbe5ec;
      }

      .backorder-preview-summary span,
      .backorder-preview-summary strong {
        display: block;
      }

      .backorder-preview-summary span { color: #607d8b; font-size: 13px; }
      .backorder-preview-summary strong { margin-top: 4px; color: #263238; font-size: 18px; }

      .backorder-search-input {
        flex: 1 1 300px;
        min-height: 44px;
      }

      .backorder-table-wrap {
        margin-top: 12px;
        overflow-x: auto;
        border: 1px solid #d7e1ea;
        border-radius: 10px;
      }

      .backorder-table-wrap table {
        width: 100%;
        border-collapse: collapse;
        background: #ffffff;
      }

      .backorder-table-wrap th,
      .backorder-table-wrap td {
        padding: 10px 9px;
        border-bottom: 1px solid #e3e9ed;
        text-align: left;
        vertical-align: middle;
        white-space: nowrap;
      }

      .backorder-table-wrap th {
        background: #f3f7fa;
        color: #29434e;
      }

      .backorder-table-wrap td.number { text-align: right; font-weight: 700; }
      .backorder-check-cell { text-align: center !important; }
      .backorder-check-cell input { width: 22px; height: 22px; }

      .backorder-row-active td { background: #fff9db; }

      .backorder-match,
      .backorder-state {
        display: inline-block;
        padding: 4px 8px;
        border-radius: 999px;
        font-size: 12px;
        font-weight: 800;
      }

      .backorder-match-ok { background: #e8f5e9; color: #1b5e20; }
      .backorder-match-warning { background: #ffebee; color: #b71c1c; }
      .backorder-state { background: #eceff1; color: #546e7a; }
      .backorder-state.is-backorder { background: #fff176; color: #5d4a00; border: 1px solid #f9a825; }

      #apply-backorder-csv { background: #f9a825; color: #1f2933; }
      #clear-backorder-csv-preview,
      #clear-backorder-csv-selection { background: #607d8b; }

      .backorder-important-note {
        margin-top: 12px;
        padding: 12px 14px;
        border-left: 5px solid #f9a825;
        border-radius: 8px;
        background: #fff8e1;
        color: #5d4500;
        line-height: 1.7;
      }

      @media (max-width: 700px) {
        .backorder-preview-summary { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .backorder-import-row,
        .backorder-list-toolbar,
        .backorder-preview-actions { align-items: stretch; }
        .backorder-import-row > *,
        .backorder-list-toolbar > *,
        .backorder-preview-actions > * { width: 100%; }
      }
    `;

    document.head.appendChild(style);
  }
})();
