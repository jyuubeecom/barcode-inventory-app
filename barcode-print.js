"use strict";

const BARCODE_PRINT_PAGE_SIZE = 20;
let barcodePrintProducts = [];
let barcodePrintFilteredProducts = [];
let barcodePrintCurrentPage = 1;
const barcodePrintSelected = new Set();
const barcodePrintCopies = new Map();


async function showBarcodePrintDialog(options) {
  const dialogOptions = options || {};

  if (
    window.inventoryApp &&
    typeof window.inventoryApp.showAppDialog === "function"
  ) {
    return window.inventoryApp.showAppDialog(dialogOptions);
  }

  const details = Array.isArray(dialogOptions.details)
    ? dialogOptions.details
        .map(function (item) {
          return `${item.label || ""}：${item.value ?? ""}`;
        })
        .join("\n")
    : "";

  const message = [
    dialogOptions.title || "お知らせ",
    dialogOptions.message || "",
    details,
    dialogOptions.notice || ""
  ]
    .filter(Boolean)
    .join("\n\n");

  if (dialogOptions.isConfirm) {
    return window.confirm(message);
  }

  window.alert(message);
  return true;
}

window.addEventListener("DOMContentLoaded", initializeBarcodePrintFeature);

function initializeBarcodePrintFeature() {
  const showButton = document.querySelector("#show-barcode-print-button");
  if (!showButton) return;

  createBarcodePrintStyle();

  showButton.addEventListener("click", openBarcodePrintScreen);
  document.querySelector("#back-home-from-barcode-print")?.addEventListener("click", closeBarcodePrintScreen);
  document.querySelector("#barcode-print-search")?.addEventListener("input", function () {
    barcodePrintCurrentPage = 1;
    applyBarcodePrintFilter();
  });
  document.querySelector("#barcode-print-select-visible")?.addEventListener("click", selectVisibleBarcodeProducts);
  document.querySelector("#barcode-print-clear-selection")?.addEventListener("click", clearBarcodePrintSelection);
  document.querySelector("#barcode-print-prev-page")?.addEventListener("click", function () {
    if (barcodePrintCurrentPage > 1) {
      barcodePrintCurrentPage -= 1;
      renderBarcodePrintTable();
      scrollBarcodePrintTableIntoView();
    }
  });
  document.querySelector("#barcode-print-next-page")?.addEventListener("click", function () {
    const pages = getBarcodePrintTotalPages();
    if (barcodePrintCurrentPage < pages) {
      barcodePrintCurrentPage += 1;
      renderBarcodePrintTable();
      scrollBarcodePrintTableIntoView();
    }
  });
  document.querySelector("#print-selected-barcodes")?.addEventListener("click", printSelectedBarcodeLabels);
}

async function openBarcodePrintScreen() {
  document.querySelectorAll("main > section").forEach(function (section) {
    section.hidden = true;
  });

  const screen = document.querySelector("#barcode-print");
  if (!screen) return;
  screen.hidden = false;
  barcodePrintCurrentPage = 1;

  // 印刷画面を開くたびに前回の選択をリセットします。
  // 同じ画面内で検索を切り替える場合は、選択内容を維持します。
  barcodePrintSelected.clear();
  barcodePrintCopies.clear();

  try {
    barcodePrintProducts = (await getAllProducts()).slice().sort(function (a, b) {
      return String(a.internalCode || "").localeCompare(String(b.internalCode || ""), "ja", { numeric: true });
    });
    applyBarcodePrintFilter();
  } catch (error) {
    console.error("バーコード印刷 商品読込エラー", error);
    await showBarcodePrintDialog({
      type: "danger",
      icon: "⚠️",
      title: "商品データを読み込めませんでした",
      message: "バーコード印刷に使用する商品一覧を読み込めませんでした。",
      notice: "画面を開き直しても改善しない場合は、アプリを再読み込みしてもう一度お試しください。",
      confirmText: "閉じる"
    });
  }

  screen.scrollIntoView({ behavior: "smooth", block: "start" });
}

function closeBarcodePrintScreen() {
  document.querySelector("#barcode-print")?.setAttribute("hidden", "");
  if (window.inventoryApp && typeof window.inventoryApp.showScreen === "function") {
    window.inventoryApp.showScreen("home");
  } else {
    const home = document.querySelector("#home");
    if (home) home.hidden = false;
  }
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function applyBarcodePrintFilter() {
  const keyword = String(document.querySelector("#barcode-print-search")?.value || "").trim().toLowerCase();
  barcodePrintFilteredProducts = barcodePrintProducts.filter(function (product) {
    if (!keyword) return true;
    return [
      product.internalCode,
      product.productCode,
      product.productName,
      product.janCode,
      product.location
    ].some(function (value) {
      return String(value || "").toLowerCase().includes(keyword);
    });
  });

  const pages = getBarcodePrintTotalPages();
  if (barcodePrintCurrentPage > pages) barcodePrintCurrentPage = pages;
  renderBarcodePrintTable();
}

function getBarcodePrintTotalPages() {
  return Math.max(1, Math.ceil(barcodePrintFilteredProducts.length / BARCODE_PRINT_PAGE_SIZE));
}

function renderBarcodePrintTable() {
  const body = document.querySelector("#barcode-print-table-body");
  const summary = document.querySelector("#barcode-print-summary");
  const pageStatus = document.querySelector("#barcode-print-page-status");
  const prev = document.querySelector("#barcode-print-prev-page");
  const next = document.querySelector("#barcode-print-next-page");
  if (!body) return;

  body.innerHTML = "";
  const start = (barcodePrintCurrentPage - 1) * BARCODE_PRINT_PAGE_SIZE;
  const visible = barcodePrintFilteredProducts.slice(start, start + BARCODE_PRINT_PAGE_SIZE);

  visible.forEach(function (product) {
    const internalCode = String(product.internalCode || "").trim();
    const row = document.createElement("tr");

    const selectCell = document.createElement("td");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = barcodePrintSelected.has(internalCode);
    checkbox.setAttribute("aria-label", `${product.productName || internalCode} を選択`);
    checkbox.addEventListener("change", function () {
      if (checkbox.checked) {
        barcodePrintSelected.add(internalCode);
        if (!barcodePrintCopies.has(internalCode)) barcodePrintCopies.set(internalCode, 1);
      } else {
        barcodePrintSelected.delete(internalCode);
        barcodePrintCopies.delete(internalCode);
      }
      renderBarcodePrintSummary();
    });
    selectCell.appendChild(checkbox);
    row.appendChild(selectCell);

    appendBarcodePrintCell(row, internalCode || "-");
    appendBarcodePrintCell(row, product.productCode || "-");
    appendBarcodePrintCell(row, product.productName || "-");

    const jan = String(product.janCode || "").trim();
    const janCell = document.createElement("td");
    janCell.textContent = jan || "未登録";
    if (jan && !isValidJanCode(jan)) {
      const warning = document.createElement("small");
      warning.className = "barcode-print-jan-warning";
      warning.textContent = "JAN形式を確認";
      janCell.appendChild(document.createElement("br"));
      janCell.appendChild(warning);
    }
    row.appendChild(janCell);

    appendBarcodePrintCell(row, product.location || "-");

    const copiesCell = document.createElement("td");
    const copies = document.createElement("input");
    copies.type = "number";
    copies.min = "1";
    copies.max = "99";
    copies.step = "1";
    copies.value = String(barcodePrintCopies.get(internalCode) || 1);
    copies.className = "barcode-print-copies";
    copies.addEventListener("change", function () {
      const value = Math.max(1, Math.min(99, Math.floor(Number(copies.value) || 1)));
      copies.value = String(value);
      barcodePrintCopies.set(internalCode, value);
      if (barcodePrintSelected.has(internalCode)) renderBarcodePrintSummary();
    });
    copiesCell.appendChild(copies);
    row.appendChild(copiesCell);

    body.appendChild(row);
  });

  if (visible.length === 0) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 7;
    cell.textContent = "条件に一致する商品がありません。";
    cell.className = "barcode-print-empty";
    row.appendChild(cell);
    body.appendChild(row);
  }

  const pages = getBarcodePrintTotalPages();
  if (pageStatus) pageStatus.textContent = `${barcodePrintCurrentPage} / ${pages}ページ`;
  if (prev) prev.disabled = barcodePrintCurrentPage <= 1;
  if (next) next.disabled = barcodePrintCurrentPage >= pages;
  renderBarcodePrintSummary();
}

function appendBarcodePrintCell(row, value) {
  const cell = document.createElement("td");
  cell.textContent = value;
  row.appendChild(cell);
}

function renderBarcodePrintSummary() {
  const summary = document.querySelector("#barcode-print-summary");
  const printButton = document.querySelector("#print-selected-barcodes");
  if (!summary) return;

  let labelCount = 0;
  barcodePrintSelected.forEach(function (code) {
    labelCount += barcodePrintCopies.get(code) || 1;
  });

  const filteredCodes = new Set(barcodePrintFilteredProducts.map(function (product) {
    return String(product.internalCode || "").trim();
  }));
  let hiddenSelectedCount = 0;
  barcodePrintSelected.forEach(function (code) {
    if (!filteredCodes.has(code)) hiddenSelectedCount += 1;
  });

  summary.innerHTML = `
    <div><strong>現在の検索結果：</strong>${barcodePrintFilteredProducts.length.toLocaleString("ja-JP")}商品</div>
    <div><strong>印刷対象：</strong>${barcodePrintSelected.size.toLocaleString("ja-JP")}商品 / <strong>合計ラベル：</strong>${labelCount.toLocaleString("ja-JP")}枚</div>
    ${hiddenSelectedCount > 0 ? `<div class="barcode-print-hidden-selection">※ 現在の検索結果には表示されていない選択商品が ${hiddenSelectedCount.toLocaleString("ja-JP")}件あります。下の「印刷対象」にすべて表示しています。</div>` : ""}
  `;

  if (printButton) {
    printButton.textContent = labelCount > 0
      ? `選択したバーコードを印刷する（合計${labelCount.toLocaleString("ja-JP")}枚）`
      : "選択したバーコードを印刷する";
  }

  renderBarcodePrintSelectionPanel();
}

function renderBarcodePrintSelectionPanel() {
  const panel = document.querySelector("#barcode-print-selection-panel");
  const list = document.querySelector("#barcode-print-selection-list");
  if (!panel || !list) return;

  if (barcodePrintSelected.size === 0) {
    panel.hidden = true;
    list.innerHTML = "";
    return;
  }

  panel.hidden = false;
  list.innerHTML = "";

  const selectedProducts = barcodePrintProducts.filter(function (product) {
    return barcodePrintSelected.has(String(product.internalCode || "").trim());
  });

  selectedProducts.forEach(function (product) {
    const code = String(product.internalCode || "").trim();
    const row = document.createElement("div");
    row.className = "barcode-print-selected-row";

    const info = document.createElement("div");
    info.className = "barcode-print-selected-info";
    info.innerHTML = `<strong>${escapeBarcodePrintHtml(code || "-")}</strong><span>${escapeBarcodePrintHtml(product.productName || "商品名未登録")}</span>`;

    const copiesWrap = document.createElement("label");
    copiesWrap.className = "barcode-print-selected-copies-wrap";
    copiesWrap.textContent = "枚数";
    const copies = document.createElement("input");
    copies.type = "number";
    copies.min = "1";
    copies.max = "99";
    copies.step = "1";
    copies.value = String(barcodePrintCopies.get(code) || 1);
    copies.className = "barcode-print-selected-copies";
    copies.addEventListener("change", function () {
      const value = Math.max(1, Math.min(99, Math.floor(Number(copies.value) || 1)));
      barcodePrintCopies.set(code, value);
      renderBarcodePrintTable();
    });
    copiesWrap.appendChild(copies);

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "barcode-print-selected-remove";
    remove.textContent = "選択解除";
    remove.addEventListener("click", function () {
      barcodePrintSelected.delete(code);
      barcodePrintCopies.delete(code);
      renderBarcodePrintTable();
    });

    row.appendChild(info);
    row.appendChild(copiesWrap);
    row.appendChild(remove);
    list.appendChild(row);
  });
}

function selectVisibleBarcodeProducts() {
  const start = (barcodePrintCurrentPage - 1) * BARCODE_PRINT_PAGE_SIZE;
  const visible = barcodePrintFilteredProducts.slice(start, start + BARCODE_PRINT_PAGE_SIZE);
  visible.forEach(function (product) {
    const code = String(product.internalCode || "").trim();
    if (!code) return;
    barcodePrintSelected.add(code);
    if (!barcodePrintCopies.has(code)) barcodePrintCopies.set(code, 1);
  });
  renderBarcodePrintTable();
}

function clearBarcodePrintSelection() {
  barcodePrintSelected.clear();
  barcodePrintCopies.clear();
  renderBarcodePrintTable();
}

function scrollBarcodePrintTableIntoView() {
  document.querySelector("#barcode-print-table-area")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function printSelectedBarcodeLabels() {
  if (barcodePrintSelected.size === 0) {
    await showBarcodePrintDialog({
      type: "warning",
      icon: "🖨️",
      title: "印刷する商品を選択してください",
      message: "商品一覧から、バーコードを印刷する商品にチェックを入れてください。",
      confirmText: "商品を選ぶ"
    });
    return;
  }

  const layout = String(document.querySelector("#barcode-print-layout")?.value || "4");
  const barcodeMode = String(document.querySelector("#barcode-print-mode")?.value || "both");
  const selectedProducts = barcodePrintProducts.filter(function (product) {
    return barcodePrintSelected.has(String(product.internalCode || "").trim());
  });

  const labels = [];
  const skippedJanOnly = [];

  selectedProducts.forEach(function (product) {
    const code = String(product.internalCode || "").trim();
    const jan = String(product.janCode || "").trim();
    const copies = barcodePrintCopies.get(code) || 1;

    if (barcodeMode === "jan" && !isValidJanCode(jan)) {
      skippedJanOnly.push(product.productName || code);
      return;
    }

    for (let i = 0; i < copies; i += 1) {
      labels.push(buildBarcodePrintLabel(product, barcodeMode));
    }
  });

  if (labels.length === 0) {
    await showBarcodePrintDialog({
      type: "danger",
      icon: "⚠️",
      title: "印刷できるラベルがありません",
      message: "選択した条件では、印刷できるバーコードラベルを作成できませんでした。",
      notice: "「JANコードのみ」を選んでいる場合は、商品のJANコードが登録されていて、JAN形式が正しいか確認してください。",
      confirmText: "選択内容を確認する"
    });
    return;
  }

  if (skippedJanOnly.length > 0) {
    const skippedPreview = skippedJanOnly.slice(0, 5);
    const proceed = await showBarcodePrintDialog({
      type: "warning",
      icon: "⚠️",
      title: "JANコードを印刷できない商品があります",
      message: "JANコードが未登録または形式不正の商品を印刷対象から外します。",
      details: [
        {
          label: "対象外の商品数",
          value: `${skippedJanOnly.length}商品`
        },
        {
          label: "対象外の商品",
          value:
            skippedPreview.join("、") +
            (skippedJanOnly.length > 5
              ? ` ほか${skippedJanOnly.length - 5}商品`
              : "")
        }
      ],
      notice: "そのほかの商品のJANコードラベルは印刷できます。",
      isConfirm: true,
      cancelText: "戻る",
      confirmText: "印刷を続ける"
    });

    if (!proceed) return;
  }

  const printableSelectedProducts = selectedProducts.filter(function (product) {
    if (barcodeMode !== "jan") return true;
    return isValidJanCode(String(product.janCode || "").trim());
  });

  const selectedLines = printableSelectedProducts.slice(0, 10).map(function (product) {
    const code = String(product.internalCode || "").trim();
    return `・${code || "-"} ${product.productName || "商品名未登録"}：${barcodePrintCopies.get(code) || 1}枚`;
  });
  if (printableSelectedProducts.length > 10) {
    selectedLines.push(`・ほか ${printableSelectedProducts.length - 10}商品`);
  }

  const modeLabel =
    barcodeMode === "internal"
      ? "社内コード"
      : barcodeMode === "jan"
        ? "JANコード"
        : "社内コード＋JANコード";

  const layoutLabel =
    layout === "8"
      ? "A4 8分割"
      : "A4 4分割";

  const printConfirmed = await showBarcodePrintDialog({
    type: "info",
    icon: "🖨️",
    title: "この内容でバーコードを印刷しますか？",
    message: "印刷する商品数・ラベル枚数・印刷形式を確認してください。",
    details: [
      {
        label: "印刷対象",
        value: `${printableSelectedProducts.length}商品`
      },
      {
        label: "合計ラベル",
        value: `${labels.length}枚`
      },
      {
        label: "レイアウト",
        value: layoutLabel
      },
      {
        label: "バーコード",
        value: modeLabel
      },
      {
        label: "対象商品",
        value:
          selectedLines.join(" / ") || "選択商品"
      }
    ],
    notice: "続けるとブラウザーの印刷画面を開きます。",
    isConfirm: true,
    cancelText: "戻る",
    confirmText: "印刷画面を開く"
  });

  if (!printConfirmed) return;

  const perPage = Number(layout) || 4;
  const pages = [];
  for (let index = 0; index < labels.length; index += perPage) {
    pages.push(labels.slice(index, index + perPage));
  }

  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    await showBarcodePrintDialog({
      type: "danger",
      icon: "🚫",
      title: "印刷画面を開けませんでした",
      message: "ブラウザーが印刷用の新しい画面をブロックした可能性があります。",
      details: [
        {
          label: "印刷対象",
          value: `${printableSelectedProducts.length}商品`
        },
        {
          label: "合計ラベル",
          value: `${labels.length}枚`
        }
      ],
      notice: "このサイトのポップアップを許可してから、もう一度「印刷」をお試しください。",
      confirmText: "閉じる"
    });
    return;
  }

  const html = buildBarcodePrintDocument(pages, layout, barcodeMode);
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(function () {
    printWindow.print();
  }, 300);
}

function buildBarcodePrintLabel(product, barcodeMode) {
  const internalCode = String(product.internalCode || "").trim();
  const jan = String(product.janCode || "").trim();
  const internalSvg = internalCode ? createCode128Svg(internalCode) : "";
  const janSvg = isValidJanCode(jan) ? createJanSvg(jan) : "";

  const internalBlock = barcodeMode === "jan" ? "" : `
    <div class="barcode-block internal-block">
      <div class="barcode-label-title">社内コード</div>
      ${internalSvg}
      <div class="barcode-number">${escapeBarcodePrintHtml(internalCode)}</div>
    </div>`;

  let janBlock = "";
  if (barcodeMode !== "internal") {
    janBlock = janSvg
      ? `<div class="barcode-block jan-block">
          <div class="barcode-label-title">JANコード</div>
          ${janSvg}
          <div class="barcode-number">${escapeBarcodePrintHtml(jan)}</div>
        </div>`
      : `<div class="barcode-block jan-block barcode-missing">
          <div class="barcode-label-title">JANコード</div>
          <div class="barcode-missing-text">未登録 / JAN形式を確認</div>
        </div>`;
  }

  return `
    <article class="barcode-label-card">
      <div class="product-name">${escapeBarcodePrintHtml(product.productName || "商品名未登録")}</div>
      <div class="product-sub">商品コード：${escapeBarcodePrintHtml(product.productCode || "-")}　保管場所：${escapeBarcodePrintHtml(product.location || "-")}</div>
      <div class="barcode-blocks">${internalBlock}${janBlock}</div>
    </article>`;
}

function buildBarcodePrintDocument(pages, layout, barcodeMode) {
  const columns = layout === "12" ? 3 : 2;
  const rows = layout === "4" ? 2 : 4;
  const compactClass = layout === "4" ? "layout-4" : (layout === "8" ? "layout-8" : "layout-12");
  const modeClass = barcodeMode === "both" ? "mode-both" : "mode-single";

  const pageHtml = pages.map(function (labels, pageIndex) {
    return `<section class="print-page ${compactClass} ${modeClass}" style="--cols:${columns};--rows:${rows}">
      ${labels.join("\n")}
    </section>`;
  }).join("\n");

  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<title>バーコードラベル印刷</title>
<style>
  @page { size: A4 landscape; margin: 8mm; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; font-family: "Yu Gothic", "Meiryo", sans-serif; color: #111; }
  .print-page {
    width: 100%;
    min-height: 194mm;
    display: grid;
    grid-template-columns: repeat(var(--cols), minmax(0, 1fr));
    grid-template-rows: repeat(var(--rows), minmax(0, 1fr));
    gap: 3mm;
    break-after: page;
    page-break-after: always;
  }
  .print-page:last-child { break-after: auto; page-break-after: auto; }
  .barcode-label-card {
    border: 0.35mm solid #222;
    border-radius: 2mm;
    padding: 4mm;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    min-width: 0;
  }
  .product-name {
    font-size: 16pt;
    font-weight: 700;
    text-align: center;
    line-height: 1.2;
    margin-bottom: 1.5mm;
  }
  .product-sub { font-size: 8pt; text-align: center; margin-bottom: 1.5mm; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .barcode-blocks { display: flex; flex-direction: column; gap: 1.2mm; min-height: 0; flex: 1; }
  .barcode-block { text-align: center; min-height: 0; }
  .barcode-label-title { font-size: 8pt; font-weight: 700; margin-bottom: 0.5mm; }
  .barcode-svg { width: 100%; height: 18mm; display: block; }
  .barcode-number { font-family: Consolas, monospace; font-size: 12pt; font-weight: 700; letter-spacing: 0.8mm; line-height: 1; }
  .barcode-missing { border: 0.25mm dashed #888; padding: 2mm; }
  .barcode-missing-text { font-size: 9pt; }
  .layout-4 .product-name { font-size: 18pt; }
  .layout-4 .barcode-svg { height: 21mm; }
  .layout-4.mode-single .barcode-svg { height: 32mm; }
  .layout-4.mode-single .barcode-number { font-size: 15pt; }
  .layout-8 .barcode-label-card { padding: 2.2mm; }
  .layout-8 .product-name { font-size: 12pt; }
  .layout-8 .product-sub { font-size: 7pt; }
  .layout-8 .barcode-svg { height: 11mm; }
  .layout-8 .barcode-number { font-size: 9pt; }
  .layout-8.mode-single .barcode-svg { height: 20mm; }
  .layout-12 .barcode-label-card { padding: 1.8mm; }
  .layout-12 .product-name { font-size: 10pt; }
  .layout-12 .product-sub { font-size: 6.5pt; }
  .layout-12 .barcode-label-title { font-size: 6.5pt; }
  .layout-12 .barcode-svg { height: 9mm; }
  .layout-12 .barcode-number { font-size: 8pt; letter-spacing: 0.3mm; }
  .layout-12.mode-single .barcode-svg { height: 17mm; }
  @media screen {
    body { background: #ddd; padding: 8mm; }
    .print-page { background: #fff; padding: 0; margin: 0 auto 8mm; max-width: 281mm; }
  }
</style>
</head>
<body>${pageHtml}</body>
</html>`;
}

function createCode128Svg(text) {
  const patterns = [
    "212222","222122","222221","121223","121322","131222","122213","122312","132212","221213","221312","231212",
    "112232","122132","122231","113222","123122","123221","223211","221132","221231","213212","223112","312131",
    "311222","321122","321221","312212","322112","322211","212123","212321","232121","111323","131123","131321",
    "112313","132113","132311","211313","231113","231311","112133","112331","132131","113123","113321","133121",
    "313121","211331","231131","213113","213311","213131","311123","311321","331121","312113","312311","332111",
    "314111","221411","431111","111224","111422","121124","121421","141122","141221","112214","112412","122114",
    "122411","142112","142211","241211","221114","413111","241112","134111","111242","121142","121241","114212",
    "124112","124211","411212","421112","421211","212141","214121","412121","111143","111341","131141","114113",
    "114311","411113","411311","113141","114131","311141","411131","211412","211214","211232","2331112"
  ];

  const normalized = String(text || "");
  if (!normalized || Array.from(normalized).some(function (char) {
    const code = char.charCodeAt(0);
    return code < 32 || code > 126;
  })) {
    return `<div class="barcode-missing-text">CODE128に変換できない文字があります</div>`;
  }

  const codes = [104];
  let checksum = 104;
  Array.from(normalized).forEach(function (char, index) {
    const value = char.charCodeAt(0) - 32;
    codes.push(value);
    checksum += value * (index + 1);
  });
  codes.push(checksum % 103);
  codes.push(106);

  const quiet = 10;
  let x = quiet;
  const rects = [];
  codes.forEach(function (code) {
    const pattern = patterns[code];
    let isBar = true;
    for (let i = 0; i < pattern.length; i += 1) {
      const width = Number(pattern[i]);
      if (isBar) rects.push(`<rect x="${x}" y="0" width="${width}" height="50"/>`);
      x += width;
      isBar = !isBar;
    }
  });
  const totalWidth = x + quiet;
  return `<svg class="barcode-svg" viewBox="0 0 ${totalWidth} 50" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg" aria-label="社内コード ${escapeBarcodePrintHtml(normalized)}"><g fill="#000">${rects.join("")}</g></svg>`;
}

function createJanSvg(jan) {
  const digits = String(jan || "");
  if (!isValidJanCode(digits)) return "";

  const L = ["0001101","0011001","0010011","0111101","0100011","0110001","0101111","0111011","0110111","0001011"];
  const G = ["0100111","0110011","0011011","0100001","0011101","0111001","0000101","0010001","0001001","0010111"];
  const R = ["1110010","1100110","1101100","1000010","1011100","1001110","1010000","1000100","1001000","1110100"];
  let bits = "";

  if (digits.length === 13) {
    const parity = ["LLLLLL","LLGLGG","LLGGLG","LLGGGL","LGLLGG","LGGLLG","LGGGLL","LGLGLG","LGLGGL","LGGLGL"];
    bits = "101";
    const leading = Number(digits[0]);
    const pattern = parity[leading];
    for (let i = 1; i <= 6; i += 1) {
      const digit = Number(digits[i]);
      bits += pattern[i - 1] === "L" ? L[digit] : G[digit];
    }
    bits += "01010";
    for (let i = 7; i <= 12; i += 1) bits += R[Number(digits[i])];
    bits += "101";
  } else {
    bits = "101";
    for (let i = 0; i < 4; i += 1) bits += L[Number(digits[i])];
    bits += "01010";
    for (let i = 4; i < 8; i += 1) bits += R[Number(digits[i])];
    bits += "101";
  }

  const quiet = 10;
  const rects = [];
  for (let i = 0; i < bits.length; i += 1) {
    if (bits[i] === "1") rects.push(`<rect x="${quiet + i}" y="0" width="1" height="50"/>`);
  }
  const totalWidth = quiet + bits.length + quiet;
  return `<svg class="barcode-svg" viewBox="0 0 ${totalWidth} 50" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg" aria-label="JANコード ${digits}"><g fill="#000">${rects.join("")}</g></svg>`;
}

function isValidJanCode(value) {
  const digits = String(value || "").replace(/\s+/g, "");
  if (!/^\d{8}$/.test(digits) && !/^\d{13}$/.test(digits)) return false;
  const body = digits.slice(0, -1);
  return calculateEanCheckDigit(body) === Number(digits.slice(-1));
}

function calculateEanCheckDigit(body) {
  let sum = 0;
  let weight = 3;
  for (let index = body.length - 1; index >= 0; index -= 1) {
    sum += Number(body[index]) * weight;
    weight = weight === 3 ? 1 : 3;
  }
  return (10 - (sum % 10)) % 10;
}

function escapeBarcodePrintHtml(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function createBarcodePrintStyle() {
  if (document.querySelector("#barcode-print-style")) return;
  const style = document.createElement("style");
  style.id = "barcode-print-style";
  style.textContent = `
    #barcode-print .barcode-print-controls {
      display: grid;
      grid-template-columns: minmax(240px, 1fr) minmax(170px, 220px) minmax(180px, 240px);
      gap: 12px;
      align-items: end;
      margin-bottom: 14px;
    }
    #barcode-print .barcode-print-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin: 12px 0;
    }
    #barcode-print .barcode-print-summary {
      background: #e8f6f6;
      border-radius: 10px;
      padding: 12px;
      margin: 12px 0;
      font-weight: 700;
      line-height: 1.7;
    }
    #barcode-print .barcode-print-hidden-selection {
      color: #b45309;
      margin-top: 4px;
      font-size: 0.95rem;
    }
    #barcode-print .barcode-print-selection-panel {
      border: 2px solid #1f6fc4;
      border-radius: 12px;
      padding: 14px;
      margin: 14px 0;
      background: #f7fbff;
    }
    #barcode-print .barcode-print-selection-panel h3 {
      margin: 0 0 6px;
      font-size: 1.05rem;
    }
    #barcode-print .barcode-print-selection-help {
      margin: 0 0 10px;
      color: #445;
    }
    #barcode-print .barcode-print-selection-list {
      display: grid;
      gap: 8px;
    }
    #barcode-print .barcode-print-selected-row {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto auto;
      gap: 10px;
      align-items: center;
      padding: 10px;
      background: #fff;
      border: 1px solid #d6e2ee;
      border-radius: 9px;
    }
    #barcode-print .barcode-print-selected-info {
      display: flex;
      flex-wrap: wrap;
      gap: 8px 14px;
      min-width: 0;
    }
    #barcode-print .barcode-print-selected-info span {
      overflow-wrap: anywhere;
    }
    #barcode-print .barcode-print-selected-copies-wrap {
      display: flex;
      align-items: center;
      gap: 6px;
      margin: 0;
      white-space: nowrap;
    }
    #barcode-print .barcode-print-selected-copies {
      width: 78px;
    }
    #barcode-print .barcode-print-selected-remove {
      background: #d32f2f;
    }
    #barcode-print .barcode-print-table-wrap { overflow-x: auto; }
    #barcode-print table { min-width: 900px; }
    #barcode-print .barcode-print-copies { width: 80px; min-width: 70px; }
    #barcode-print .barcode-print-jan-warning { color: #c62828; font-weight: 700; }
    #barcode-print .barcode-print-empty { text-align: center; padding: 24px; }
    #barcode-print .barcode-print-pager { display: flex; gap: 12px; align-items: center; justify-content: center; margin: 14px 0; }
    #barcode-print .barcode-print-note {
      background: #fff2d8;
      border-radius: 10px;
      padding: 12px;
      margin: 12px 0;
      line-height: 1.65;
    }
    @media (max-width: 760px) {
      #barcode-print .barcode-print-controls { grid-template-columns: 1fr; }
      #barcode-print .barcode-print-actions button { width: 100%; }
      #barcode-print .barcode-print-selected-row { grid-template-columns: 1fr; }
      #barcode-print .barcode-print-selected-copies-wrap { justify-content: flex-start; }
      #barcode-print .barcode-print-selected-remove { width: 100%; }
    }
  `;
  document.head.appendChild(style);
}
