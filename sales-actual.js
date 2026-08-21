"use strict";

const SALES_ACTUAL_PREVIEW_LIMIT = 20;
let salesActualSelectedPreview = null;
let salesActualImportHistory = [];
let salesActualProducts = [];

window.addEventListener("DOMContentLoaded", initializeSalesActualFeature);

function initializeSalesActualFeature() {
  const showButton = document.querySelector("#show-sales-actual-import-button");
  const backButton = document.querySelector("#back-home-from-sales-actual");
  const fileInput = document.querySelector("#sales-actual-file");
  const importButton = document.querySelector("#import-sales-actual-button");
  const clearButton = document.querySelector("#clear-sales-actual-preview-button");

  if (!showButton || !fileInput || !importButton) return;

  createSalesActualStyle();
  showButton.addEventListener("click", openSalesActualScreen);
  if (backButton) backButton.addEventListener("click", closeSalesActualScreen);
  fileInput.addEventListener("change", handleSalesActualFileSelection);
  importButton.addEventListener("click", importSelectedSalesActualFile);
  if (clearButton) clearButton.addEventListener("click", clearSalesActualPreview);
}

async function openSalesActualScreen() {
  document.querySelectorAll("main > section").forEach(function (section) {
    section.hidden = true;
  });

  const screen = document.querySelector("#sales-actual-import");
  screen.hidden = false;

  try {
    const result = await Promise.all([
      getAllSalesImportBatches(),
      getAllProducts()
    ]);
    salesActualImportHistory = result[0].slice().sort(function (a, b) {
      return String(b.importedAt || "").localeCompare(String(a.importedAt || ""));
    });
    salesActualProducts = result[1].slice();
    renderSalesActualImportHistory();
  } catch (error) {
    console.error("販売実績読込履歴エラー", error);
    await showAppDialog({
      type: "danger",
      icon: "⚠️",
      title: "販売実績の読込履歴を表示できません",
      message: "読込履歴を取得できませんでした。画面を開き直して、もう一度お試しください。",
      confirmText: "確認して閉じる"
    });
  }

  const heading = document.querySelector("#sales-actual-import");
  if (heading) heading.scrollIntoView({ behavior: "smooth", block: "start" });
}

function closeSalesActualScreen() {
  const screen = document.querySelector("#sales-actual-import");
  if (screen) screen.hidden = true;
  if (window.inventoryApp && typeof window.inventoryApp.showScreen === "function") {
    window.inventoryApp.showScreen("home");
  } else {
    const home = document.querySelector("#home");
    if (home) home.hidden = false;
  }
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function handleSalesActualFileSelection(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) {
    clearSalesActualPreview();
    return;
  }

  if (file.size > 30 * 1024 * 1024) {
    await showAppDialog({
      type: "warning",
      icon: "📄",
      title: "CSVファイルのサイズを確認してください",
      message: "販売実績CSVは30MB以下のファイルを選んでください。",
      details: [
        { label: "選択したファイル", value: file.name || "CSVファイル" },
        { label: "ファイルサイズ", value: `${(file.size / 1024 / 1024).toFixed(1)}MB` }
      ],
      confirmText: "確認して閉じる"
    });
    event.target.value = "";
    clearSalesActualPreview();
    return;
  }

  setSalesActualPreviewMessage("CSVを確認しています...");
  setSalesActualImportButtonEnabled(false);

  try {
    const text = await readSalesActualCsvText(file);
    const fingerprint = await createSalesActualHash(text);
    const existingBatch = salesActualImportHistory.find(function (batch) {
      return batch.fileFingerprint === fingerprint;
    });

    if (existingBatch) {
      salesActualSelectedPreview = null;
      renderSalesActualDuplicateFileMessage(file, existingBatch);
      return;
    }

    const parsed = parseSalesActualCsv(text);
    const preview = await buildSalesActualImportPreview(file, fingerprint, parsed);
    salesActualSelectedPreview = preview;
    renderSalesActualPreview(preview);
    setSalesActualImportButtonEnabled(preview.importRecords.length > 0);
  } catch (error) {
    console.error("販売実績CSV確認エラー", error);
    salesActualSelectedPreview = null;
    setSalesActualPreviewMessage(
      "CSVを確認できませんでした。\n" + (error.message || "ファイルの内容を確認してください。"),
      true
    );
  }
}

async function readSalesActualCsvText(file) {
  const buffer = await file.arrayBuffer();
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer).replace(/^\uFEFF/, "");
  } catch (error) {
    try {
      return new TextDecoder("shift_jis").decode(buffer).replace(/^\uFEFF/, "");
    } catch (shiftJisError) {
      throw new Error("文字コードを読み取れませんでした。UTF-8またはShift_JISのCSVを使用してください。");
    }
  }
}

function parseSalesActualCsv(text) {
  const rows = parseSalesActualCsvRows(text);
  const headerIndex = rows.findIndex(function (row) {
    const normalized = row.map(normalizeSalesActualHeader);
    return normalized[0] === "商品コード" &&
      normalized[5] === "日付" &&
      normalized[6] === "数量" &&
      normalized[11] === "明細区分";
  });

  if (headerIndex < 0) {
    throw new Error("見出し行を確認できません。A列「商品コード」、F列「日付」、G列「数量」、L列「明細区分」が必要です。");
  }

  const reportRange = detectSalesActualReportRange(rows.slice(0, headerIndex));
  const dataRows = rows.slice(headerIndex + 1).filter(function (row) {
    return row.some(function (cell) { return normalizeSalesActualText(cell) !== ""; });
  });

  return {
    rows: dataRows,
    headerIndex: headerIndex,
    reportStartDate: reportRange.startDate,
    reportEndDate: reportRange.endDate
  };
}

function parseSalesActualCsvRows(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        field += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(field);
      field = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      continue;
    }

    field += char;
  }

  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

function normalizeSalesActualHeader(value) {
  return normalizeSalesActualText(value).replace(/[\s\u3000]/g, "");
}

function normalizeSalesActualText(value) {
  return String(value === undefined || value === null ? "" : value)
    .replace(/\u3000/g, " ")
    .trim();
}

function detectSalesActualReportRange(rows) {
  for (let index = 0; index < rows.length; index += 1) {
    const line = rows[index].join(" ").replace(/\u3000/g, " ");
    const match = line.match(/日付\s*[：:]\s*(\d{4})\/(\d{1,2})\/(\d{1,2})\s*[～~〜-]+\s*(\d{4})\/(\d{1,2})\/(\d{1,2})/);
    if (match) {
      return {
        startDate: toSalesActualIsoDate(match[1], match[2], match[3]),
        endDate: toSalesActualIsoDate(match[4], match[5], match[6])
      };
    }
  }
  return { startDate: "", endDate: "" };
}

function toSalesActualIsoDate(year, month, day) {
  const y = String(year).padStart(4, "0");
  const m = String(month).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  const iso = `${y}-${m}-${d}`;
  return isValidSalesActualIsoDate(iso) ? iso : "";
}

function parseSalesActualDate(value) {
  const text = normalizeSalesActualText(value);
  const match = text.match(/^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})$/);
  if (!match) return "";
  return toSalesActualIsoDate(match[1], match[2], match[3]);
}

function isValidSalesActualIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parts = value.split("-").map(Number);
  const date = new Date(parts[0], parts[1] - 1, parts[2]);
  return date.getFullYear() === parts[0] &&
    date.getMonth() === parts[1] - 1 &&
    date.getDate() === parts[2];
}

function parseSalesActualNumber(value) {
  let text = normalizeSalesActualText(value).replace(/,/g, "");
  if (!text) return null;
  let negative = false;
  if (/^\(.+\)$/.test(text)) {
    negative = true;
    text = text.slice(1, -1);
  }
  const number = Number(text);
  if (!Number.isFinite(number)) return null;
  return negative ? -number : number;
}

async function buildSalesActualImportPreview(file, fingerprint, parsed) {
  const existingActuals = await getAllSalesActuals();
  const existingIds = new Set(existingActuals.map(function (record) { return record.id; }));
  const productMap = new Map();

  salesActualProducts.forEach(function (product) {
    const internalCode =
      normalizeSalesActualText(
        product.internalCode
      );

    if (internalCode !== "") {
      productMap.set(
        internalCode,
        product
      );
    }
  });

  const signatureCounts = new Map();
  const importRecords = [];
  const duplicateRecords = [];
  const ignoredRecords = [];
  const errorRecords = [];
  const discontinuedErrorRecords = [];
  const unregisteredCodes = new Set();
  let saleRows = 0;
  let returnRows = 0;

  for (let index = 0; index < parsed.rows.length; index += 1) {
    const row = parsed.rows[index];
    while (row.length < 12) row.push("");

    const detailType = normalizeSalesActualText(row[11]);
    if (detailType !== "売上" && detailType !== "返品") {
      ignoredRecords.push({ rowNumber: parsed.headerIndex + index + 2, reason: `明細区分「${detailType || "空欄"}」` });
      continue;
    }
    if (detailType === "売上") saleRows += 1;
    if (detailType === "返品") returnRows += 1;

    const internalCode = normalizeSalesActualText(row[0]);
    const saleDate = parseSalesActualDate(row[5]);
    const quantity = parseSalesActualNumber(row[6]);

    const errors = [];
    if (!internalCode || internalCode === "0") errors.push("社内コードがありません");
    if (!saleDate) errors.push("出荷日を確認できません");
    if (quantity === null) errors.push("出荷数量が数字ではありません");

    if (errors.length > 0) {
      errorRecords.push({
        rowNumber: parsed.headerIndex + index + 2,
        internalCode: internalCode,
        reason: errors.join(" / ")
      });
      continue;
    }

    const matchedProduct =
      productMap.get(
        internalCode
      );

    if (
      matchedProduct &&
      isSalesActualDiscontinuedProduct(
        matchedProduct
      )
    ) {
      const discontinuedError = {
        rowNumber:
          parsed.headerIndex +
          index +
          2,
        internalCode:
          internalCode,
        productName:
          matchedProduct.productName ||
          `${normalizeSalesActualText(row[1])} ${normalizeSalesActualText(row[2])}`.trim(),
        customerName:
          normalizeSalesActualText(
            row[4]
          ),
        saleDate:
          saleDate,
        quantity:
          quantity,
        detailType:
          detailType,
        reason:
          "商品状態が「廃盤」のため取り込めません"
      };

      errorRecords.push(
        discontinuedError
      );

      discontinuedErrorRecords.push(
        discontinuedError
      );

      continue;
    }

    const normalizedRow = [
      internalCode,
      normalizeSalesActualText(row[1]),
      normalizeSalesActualText(row[2]),
      normalizeSalesActualText(row[3]),
      normalizeSalesActualText(row[4]),
      saleDate,
      String(quantity),
      normalizeSalesActualText(row[7]),
      normalizeSalesActualText(row[8]),
      normalizeSalesActualText(row[9]),
      normalizeSalesActualText(row[10]),
      detailType
    ];
    const signature = normalizedRow.join("\u001f");
    const occurrence = (signatureCounts.get(signature) || 0) + 1;
    signatureCounts.set(signature, occurrence);
    const rowHash = await createSalesActualHash(signature);
    const id = `sale-${rowHash}-${occurrence}`;

    const record = {
      id: id,
      batchId: "",
      internalCode: internalCode,
      sourceProductName1: normalizedRow[1],
      sourceProductName2: normalizedRow[2],
      customerCode: normalizedRow[3],
      customerName: normalizedRow[4],
      saleDate: saleDate,
      quantity: quantity,
      unitPrice: normalizedRow[7],
      salesAmount: normalizedRow[8],
      grossProfit: normalizedRow[9],
      voucherNumber: normalizedRow[10],
      detailType: detailType,
      importedAt: ""
    };

    if (!productMap.has(internalCode)) {
      unregisteredCodes.add(internalCode);
    }

    if (existingIds.has(id)) {
      duplicateRecords.push(record);
    } else {
      importRecords.push(record);
    }
  }

  let reportStartDate = parsed.reportStartDate;
  let reportEndDate = parsed.reportEndDate;
  const validDates = importRecords.concat(duplicateRecords).map(function (record) { return record.saleDate; }).filter(Boolean).sort();
  if (!reportStartDate && validDates.length > 0) reportStartDate = validDates[0];
  if (!reportEndDate && validDates.length > 0) reportEndDate = validDates[validDates.length - 1];

  return {
    file: file,
    fileName: file.name,
    fileFingerprint: fingerprint,
    reportStartDate: reportStartDate,
    reportEndDate: reportEndDate,
    totalRows: parsed.rows.length,
    saleRows: saleRows,
    returnRows: returnRows,
    targetRows: saleRows + returnRows,
    importRecords: importRecords,
    duplicateRecords: duplicateRecords,
    ignoredRecords: ignoredRecords,
    errorRecords: errorRecords,
    discontinuedErrorRecords: discontinuedErrorRecords,
    unregisteredCodes: Array.from(unregisteredCodes).sort(function (a, b) {
      return a.localeCompare(b, "ja", { numeric: true });
    })
  };
}

function isSalesActualDiscontinuedProduct(
  product
) {
  if (!product) {
    return false;
  }

  const status =
    normalizeSalesActualText(
      product.productStatus
    )
      .normalize("NFKC")
      .toLowerCase();

  return (
    status === "廃盤" ||
    status === "discontinued" ||
    status === "inactive" ||
    product.discontinued === true ||
    normalizeSalesActualText(
      product.discontinuedFlag
    ) === "9"
  );
}

async function createSalesActualHash(text) {
  if (window.crypto && window.crypto.subtle && typeof TextEncoder !== "undefined") {
    const buffer = await window.crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buffer)).map(function (value) {
      return value.toString(16).padStart(2, "0");
    }).join("");
  }

  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function renderSalesActualDuplicateFileMessage(file, batch) {
  const summary = document.querySelector("#sales-actual-preview-summary");
  const tableBody = document.querySelector("#sales-actual-preview-body");
  const warnings = document.querySelector("#sales-actual-preview-warnings");
  if (summary) {
    summary.innerHTML = `<strong>このCSVは取り込み済みです。</strong><br>${escapeSalesActualHtml(file.name)}<br>取込日時：${escapeSalesActualHtml(formatSalesActualDateTime(batch.importedAt))}`;
  }
  if (tableBody) tableBody.innerHTML = "";
  if (warnings) warnings.textContent = "同じCSVを二重に取り込まないよう停止しました。";
  setSalesActualImportButtonEnabled(false);
}

function renderSalesActualPreview(preview) {
  const summary = document.querySelector("#sales-actual-preview-summary");
  const tableBody = document.querySelector("#sales-actual-preview-body");
  const warnings = document.querySelector("#sales-actual-preview-warnings");

  const rangeText = preview.reportStartDate && preview.reportEndDate
    ? `${formatSalesActualDate(preview.reportStartDate)} ～ ${formatSalesActualDate(preview.reportEndDate)}`
    : "CSV内の日付から判定";

  summary.innerHTML = [
    `<strong>ファイル：</strong>${escapeSalesActualHtml(preview.fileName)}`,
    `<strong>帳票期間：</strong>${escapeSalesActualHtml(rangeText)}`,
    `<strong>データ行：</strong>${preview.totalRows}件`,
    `<strong>売上行：</strong>${preview.saleRows}件`,
    `<strong>返品行：</strong>${preview.returnRows}件`,
    `<strong>取込対象（売上＋返品）：</strong>${preview.targetRows}件`,
    `<strong>新規取込：</strong>${preview.importRecords.length}件`,
    `<strong>重複スキップ：</strong>${preview.duplicateRecords.length}件`,
    `<strong>対象外（値引など）：</strong>${preview.ignoredRecords.length}件`,
    `<strong>廃盤商品エラー：</strong>${preview.discontinuedErrorRecords.length}件`,
    `<strong>エラー合計：</strong>${preview.errorRecords.length}件`
  ].join("<br>");

  tableBody.innerHTML = "";
  preview.importRecords.slice(0, SALES_ACTUAL_PREVIEW_LIMIT).forEach(function (record) {
    const product = salesActualProducts.find(function (item) {
      return normalizeSalesActualText(item.internalCode) === record.internalCode;
    });
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${escapeSalesActualHtml(formatSalesActualDate(record.saleDate))}</td>
      <td>${escapeSalesActualHtml(record.internalCode)}</td>
      <td>${escapeSalesActualHtml(product ? (product.productName || "") : `${record.sourceProductName1} ${record.sourceProductName2}`.trim())}</td>
      <td>${escapeSalesActualHtml(record.customerName)}</td>
      <td>${formatSalesActualNumber(record.quantity)}</td>
      <td>${product ? '<span class="sales-actual-ok">登録済み</span>' : '<span class="sales-actual-warning">商品未登録</span>'}</td>
    `;
    tableBody.appendChild(row);
  });

  const messages = [];
  preview.discontinuedErrorRecords
    .slice(
      0,
      SALES_ACTUAL_PREVIEW_LIMIT
    )
    .forEach(
      function (record) {
        const row =
          document.createElement("tr");

        row.classList.add(
          "sales-actual-discontinued-row"
        );

        row.innerHTML = `
          <td>${escapeSalesActualHtml(formatSalesActualDate(record.saleDate))}</td>
          <td>${escapeSalesActualHtml(record.internalCode)}</td>
          <td>${escapeSalesActualHtml(record.productName || "")}</td>
          <td>${escapeSalesActualHtml(record.customerName || "")}</td>
          <td>${formatSalesActualNumber(record.quantity)}</td>
          <td><span class="sales-actual-error">廃盤商品エラー</span></td>
        `;

        tableBody.appendChild(
          row
        );
      }
    );

  if (preview.importRecords.length > SALES_ACTUAL_PREVIEW_LIMIT) {
    messages.push(`プレビューは先頭${SALES_ACTUAL_PREVIEW_LIMIT}件を表示しています。`);
  }
  if (preview.unregisteredCodes.length > 0) {
    messages.push(`商品マスタ未登録の社内コード：${preview.unregisteredCodes.slice(0, 20).join("、")}${preview.unregisteredCodes.length > 20 ? " ほか" : ""}`);
    messages.push("未登録商品の販売実績も保存しますが、商品が登録されるまで発注判定には使用しません。");
  }
  if (
    preview.discontinuedErrorRecords.length >
    0
  ) {
    const codes =
      Array.from(
        new Set(
          preview.discontinuedErrorRecords.map(
            function (record) {
              return (
                record.internalCode
              );
            }
          )
        )
      );

    messages.push(
      `⚠ 廃盤商品が販売実績に${preview.discontinuedErrorRecords.length}件含まれています。エラーとして取り込みません。`
    );

    messages.push(
      `廃盤商品コード：${codes.slice(0, 20).join("、")}${codes.length > 20 ? " ほか" : ""}`
    );

    messages.push(
      "売上入力の誤りがないか、元の販売実績を確認してください。"
    );
  }

  if (preview.errorRecords.length > 0) {
    messages.push(
      `取込不可の行が合計${preview.errorRecords.length}件あります。エラー行は保存せず、正常な行だけを取り込みます。`
    );
  }
  if (preview.returnRows > 0) {
    messages.push("返品はCSVのマイナス数量をそのまま保存し、月平均販売数から差し引きます。");
  }
  if (preview.duplicateRecords.length > 0) {
    messages.push(`すでに取り込まれている明細${preview.duplicateRecords.length}件は二重登録しません。`);
  }
  messages.push(
    "このCSVを取り込むと、登録済み商品の販売数量を場所別在庫から自動出庫します。"
  );
  messages.push(
    "自動出庫順：本社1階 A～F区 → 本社2階 A～F区 → 酒本倉庫1階 → 酒本倉庫2階。返品（マイナス数量）は本社1階 A区へ戻します。"
  );
  messages.push(
    "v63より前に取り込んだ販売実績CSVは、更新時にさかのぼって在庫へ反映しません。"
  );
  warnings.textContent = messages.join("\n");
}

async function importSelectedSalesActualFile() {
  const preview = salesActualSelectedPreview;
  if (!preview || preview.importRecords.length === 0) {
    await showAppDialog({
      type: "warning",
      icon: "📊",
      title: "取り込める販売実績がありません",
      message: "CSVの内容を確認して、取り込める販売実績があるファイルを選択してください。",
      confirmText: "確認して閉じる"
    });
    return;
  }

  const confirmed = await showAppDialog({
    type: "warning",
    icon: "📊",
    title: "販売実績CSVを取り込みますか？",
    message: "取り込み件数と在庫への影響を確認してください。",
    details: [
      { label: "ファイル名", value: preview.fileName || "販売実績CSV" },
      { label: "新規販売実績", value: `${preview.importRecords.length}件` },
      { label: "重複スキップ", value: `${preview.duplicateRecords.length}件` },
      { label: "廃盤商品エラー", value: `${preview.discontinuedErrorRecords.length}件` },
      { label: "商品未登録コード", value: `${preview.unregisteredCodes.length}件` }
    ],
    notice:
      "廃盤商品エラーの行は取り込みません。正常な行だけを取り込みます。" +
      " 登録済み商品の販売数量は場所別在庫から自動出庫します。" +
      " 出庫順は、本社1階 A～F区 → 本社2階 A～F区 → 酒本倉庫1階 → 酒本倉庫2階です。" +
      " 返品は本社1階 A区へ戻します。",
    isConfirm: true,
    cancelText: "戻る",
    confirmText: "このCSVを取り込む"
  });
  if (!confirmed) return;

  const button = document.querySelector("#import-sales-actual-button");
  button.disabled = true;
  button.textContent = "取り込んでいます...";

  try {
    const importedAt = new Date().toISOString();
    const batchId = `sales-batch-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const records = preview.importRecords.map(function (record) {
      return { ...record, batchId: batchId, importedAt: importedAt };
    });
    const batch = {
      batchId: batchId,
      fileName: preview.fileName,
      fileFingerprint: preview.fileFingerprint,
      importedAt: importedAt,
      reportStartDate: preview.reportStartDate,
      reportEndDate: preview.reportEndDate,
      sourceRowCount: preview.totalRows,
      saleRowCount: preview.saleRows,
      returnRowCount: preview.returnRows,
      targetRowCount: preview.targetRows,
      importedCount: records.length,
      duplicateCount: preview.duplicateRecords.length,
      ignoredCount: preview.ignoredRecords.length,
      errorCount: preview.errorRecords.length,
      discontinuedErrorCount:
        preview.discontinuedErrorRecords.length,
      unregisteredCodes: preview.unregisteredCodes
    };

    const saveResult = await saveSalesActualImportBatch(batch, records);
    const savedBatch = saveResult && saveResult.batch
      ? saveResult.batch
      : batch;
    const updatedProducts = saveResult && Array.isArray(saveResult.products)
      ? saveResult.products
      : [];

    applySalesActualUpdatedProducts(updatedProducts);
    salesActualImportHistory.unshift(savedBatch);

    const appliedCount = Number(savedBatch.inventoryAdjustmentCount || 0);
    const skippedCount = Array.isArray(savedBatch.inventorySkippedCodes)
      ? savedBatch.inventorySkippedCodes.length
      : 0;

    await showAppDialog({
      type: "success",
      icon: "✅",
      title: "販売実績CSVを取り込みました",
      message: "販売実績の保存と、登録済み商品の在庫反映が完了しました。",
      details: [
        { label: "取込件数", value: `${records.length}件` },
        { label: "在庫へ反映", value: `${appliedCount}商品` },
        { label: "商品未登録で未反映", value: `${skippedCount}商品` }
      ],
      confirmText: "確認して閉じる"
    });
    clearSalesActualPreview();
    document.querySelector("#sales-actual-file").value = "";
    renderSalesActualImportHistory();
  } catch (error) {
    console.error("販売実績取込エラー", error);
    if (error && error.name === "ConstraintError") {
      await showAppDialog({
        type: "warning",
        icon: "⚠️",
        title: "同じ販売実績がすでに取り込まれています",
        message: "二重登録を防ぐため、今回のCSVは取り込みませんでした。",
        confirmText: "確認して閉じる"
      });
    } else {
      await showAppDialog({
        type: "danger",
        icon: "❌",
        title: "販売実績CSVを取り込めませんでした",
        message: error.message || "原因を確認できませんでした。CSVの内容を確認してください。",
        confirmText: "確認して閉じる"
      });
    }
  } finally {
    button.textContent = "このCSVを取り込む";
    setSalesActualImportButtonEnabled(Boolean(salesActualSelectedPreview && salesActualSelectedPreview.importRecords.length > 0));
  }
}

function clearSalesActualPreview() {
  salesActualSelectedPreview = null;
  const summary = document.querySelector("#sales-actual-preview-summary");
  const body = document.querySelector("#sales-actual-preview-body");
  const warnings = document.querySelector("#sales-actual-preview-warnings");
  if (summary) summary.textContent = "CSVを選ぶと、取り込み前に内容を確認できます。";
  if (body) body.innerHTML = "";
  if (warnings) warnings.textContent = "";
  setSalesActualImportButtonEnabled(false);
}

function setSalesActualPreviewMessage(message, isError) {
  const summary = document.querySelector("#sales-actual-preview-summary");
  const body = document.querySelector("#sales-actual-preview-body");
  const warnings = document.querySelector("#sales-actual-preview-warnings");
  if (summary) summary.textContent = message;
  if (body) body.innerHTML = "";
  if (warnings) warnings.textContent = isError ? "ファイルを確認して、もう一度選択してください。" : "";
}

function setSalesActualImportButtonEnabled(enabled) {
  const button = document.querySelector("#import-sales-actual-button");
  if (button) button.disabled = !enabled;
}

function renderSalesActualImportHistory() {
  const body = document.querySelector("#sales-actual-import-history-body");
  const empty = document.querySelector("#sales-actual-history-empty");
  if (!body) return;
  body.innerHTML = "";

  if (salesActualImportHistory.length === 0) {
    if (empty) empty.hidden = false;
    return;
  }
  if (empty) empty.hidden = true;

  salesActualImportHistory.forEach(function (batch) {
    const row = document.createElement("tr");
    const range = batch.reportStartDate && batch.reportEndDate
      ? `${formatSalesActualDate(batch.reportStartDate)} ～ ${formatSalesActualDate(batch.reportEndDate)}`
      : "不明";
    row.innerHTML = `
      <td>${escapeSalesActualHtml(formatSalesActualDateTime(batch.importedAt))}</td>
      <td>${escapeSalesActualHtml(batch.fileName || "")}</td>
      <td>${escapeSalesActualHtml(range)}</td>
      <td>${Number(batch.importedCount || 0)}件</td>
      <td>${Array.isArray(batch.unregisteredCodes) ? batch.unregisteredCodes.length : 0}件</td>
      <td><button type="button" class="sales-actual-delete-batch" data-batch-id="${escapeSalesActualHtml(batch.batchId)}">取込を取り消す</button></td>
    `;
    body.appendChild(row);
  });

  body.querySelectorAll(".sales-actual-delete-batch").forEach(function (button) {
    button.addEventListener("click", async function () {
      const batchId = button.dataset.batchId;
      const batch = salesActualImportHistory.find(function (item) { return item.batchId === batchId; });
      if (!batch) return;
      const inventoryWasApplied = Array.isArray(batch.inventoryAdjustments) &&
        batch.inventoryAdjustments.length > 0;
      const inventoryMessage = inventoryWasApplied
        ? "このCSVで反映した在庫も、取込前の状態へ戻します。\n"
        : "このCSVでは在庫を変更していないため、在庫数は変わりません。\n";

      const confirmed = await showAppDialog({
        type: "danger",
        icon: "🗑️",
        title: "販売実績CSVの取込を取り消しますか？",
        message: "取り消すCSVと在庫への影響を確認してください。",
        details: [
          { label: "ファイル名", value: batch.fileName || "販売実績CSV" },
          {
            label: "帳票期間",
            value:
              batch.reportStartDate && batch.reportEndDate
                ? `${formatSalesActualDate(batch.reportStartDate)} ～ ${formatSalesActualDate(batch.reportEndDate)}`
                : "不明"
          },
          { label: "取込件数", value: `${Number(batch.importedCount || 0)}件` },
          {
            label: "在庫への影響",
            value: inventoryWasApplied
              ? "このCSVで反映した在庫を取込前の状態へ戻します"
              : "このCSVでは在庫を変更していません"
          }
        ],
        notice:
          "この操作は元に戻せません。商品マスタ・販売予定は削除されません。" +
          " 修正版CSVへ差し替える場合などに使用してください。",
        isConfirm: true,
        cancelText: "戻る",
        confirmText: "取込を取り消す"
      });
      if (!confirmed) return;
      button.disabled = true;
      try {
        const deleteResult = await deleteSalesActualImportBatch(batchId);
        const restoredProducts = deleteResult && Array.isArray(deleteResult.products)
          ? deleteResult.products
          : [];
        applySalesActualUpdatedProducts(restoredProducts);
        salesActualImportHistory = salesActualImportHistory.filter(function (item) { return item.batchId !== batchId; });
        renderSalesActualImportHistory();
        await showAppDialog({
          type: "success",
          icon: "✅",
          title: "販売実績CSVの取込を取り消しました",
          message: inventoryWasApplied
            ? "取込データを削除し、このCSVで反映した在庫も取込前の状態へ戻しました。"
            : "取込データを削除しました。このCSVでは在庫を変更していないため、在庫数は変わりません。",
          confirmText: "確認して閉じる"
        });
      } catch (error) {
        console.error("販売実績取込取消エラー", error);
        await showAppDialog({
          type: "danger",
          icon: "❌",
          title: "取込を取り消せませんでした",
          message: "販売実績CSVの取込データを削除できませんでした。もう一度お試しください。",
          confirmText: "確認して閉じる"
        });
        button.disabled = false;
      }
    });
  });
}

function applySalesActualUpdatedProducts(updatedProducts) {
  if (!Array.isArray(updatedProducts) || updatedProducts.length === 0) {
    return;
  }

  updatedProducts.forEach(function (updatedProduct) {
    if (
      window.inventoryApp &&
      typeof window.inventoryApp.applyUpdatedProduct === "function"
    ) {
      window.inventoryApp.applyUpdatedProduct(updatedProduct);
    }

    const index = salesActualProducts.findIndex(function (product) {
      return product.internalCode === updatedProduct.internalCode;
    });

    if (index >= 0) {
      salesActualProducts[index] = updatedProduct;
    } else {
      salesActualProducts.push(updatedProduct);
    }
  });
}

function formatSalesActualDate(value) {
  if (!value) return "";
  const parts = String(value).split("-");
  if (parts.length !== 3) return value;
  return `${Number(parts[0])}/${Number(parts[1])}/${Number(parts[2])}`;
}

function formatSalesActualDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString("ja-JP");
}

function formatSalesActualNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toLocaleString("ja-JP") : "0";
}

function escapeSalesActualHtml(value) {
  return String(value === undefined || value === null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function createSalesActualStyle() {
  if (document.querySelector("#sales-actual-style")) return;
  const style = document.createElement("style");
  style.id = "sales-actual-style";
  style.textContent = `
    #sales-actual-import { scroll-margin-top: 86px; }
    #sales-actual-import .sales-actual-card { background: #fff; border: 1px solid #d9e1e8; border-radius: 14px; padding: 18px; margin: 16px 0; }
    #sales-actual-import .sales-actual-map { background: #f3f7fa; border-left: 5px solid #1565c0; padding: 12px 14px; border-radius: 8px; line-height: 1.7; }
    #sales-actual-import .sales-actual-preview-summary { background: #eef6ff; border-radius: 10px; padding: 13px; line-height: 1.7; }
    #sales-actual-import .sales-actual-warnings { white-space: pre-line; color: #bf360c; font-weight: 700; margin-top: 10px; }
    #sales-actual-import .sales-actual-table-wrap { overflow-x: auto; margin-top: 12px; }
    #sales-actual-import table { min-width: 760px; }
    #sales-actual-import .sales-actual-actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 12px; }
    #sales-actual-import .sales-actual-ok { color: #2e7d32; font-weight: 700; }
    #sales-actual-import .sales-actual-warning { color: #ef6c00; font-weight: 700; }
    #sales-actual-import .sales-actual-error { color: #c62828; font-weight: 800; }
    #sales-actual-import .sales-actual-discontinued-row { background: #ffebee; }
    #sales-actual-import .sales-actual-discontinued-row td { border-color: #ef9a9a; }
    #sales-actual-import .sales-actual-delete-batch { background-color: #c62828; }
    #sales-actual-import button:disabled { background-color: #b0bec5 !important; cursor: not-allowed; }
    @media (max-width: 700px) {
      #sales-actual-import .sales-actual-card { padding: 13px; }
      #sales-actual-import .sales-actual-actions { display: grid; grid-template-columns: 1fr; }
    }
  `;
  document.head.appendChild(style);
}
