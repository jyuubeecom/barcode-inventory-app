"use strict";

const SALES_ACTUAL_PREVIEW_LIMIT = 20;
const SALES_ACTUAL_INVENTORY_LOCATION_PRIORITY = Object.freeze([
  "本社",
  "酒本倉庫1階",
  "酒本倉庫2階"
]);
let salesActualSelectedPreview = null;
let salesActualImportHistory = [];
let salesActualProducts = [];

window.addEventListener("DOMContentLoaded", initializeSalesActualFeature);

function initializeSalesActualFeature() {
  const showButton = document.querySelector("#show-sales-actual-import-button");
  const backButton = document.querySelector("#back-home-from-sales-actual");
  const fileInput = document.querySelector("#sales-actual-file");
  const importButton = document.querySelector("#import-sales-actual-button");
  const printErrorsButton = document.querySelector("#print-sales-actual-errors-button");
  const clearButton = document.querySelector("#clear-sales-actual-preview-button");
  const historySortKey = document.querySelector("#sales-actual-history-sort-key");
  const historySortDirection = document.querySelector("#sales-actual-history-sort-direction");

  if (!showButton || !fileInput || !importButton) return;

  createSalesActualStyle();
  showButton.addEventListener("click", openSalesActualScreen);
  if (backButton) backButton.addEventListener("click", closeSalesActualScreen);
  fileInput.addEventListener("change", handleSalesActualFileSelection);
  importButton.addEventListener("click", importSelectedSalesActualFile);
  if (printErrorsButton) {
    printErrorsButton.addEventListener(
      "click",
      printSalesActualErrorList
    );
  }
  if (clearButton) clearButton.addEventListener("click", clearSalesActualPreview);

  if (historySortKey) {
    historySortKey.addEventListener("change", renderSalesActualImportHistory);
  }

  if (historySortDirection) {
    historySortDirection.addEventListener("change", renderSalesActualImportHistory);
  }
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
    setSalesActualImportButtonEnabled(
      preview.importRecords.length > 0 &&
      preview.inventoryErrorRecords.length === 0
    );
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
  const inputErrorRecords = [];
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
      const errorProduct =
        productMap.get(
          internalCode
        );

      const inputError = {
        rowNumber:
          parsed.headerIndex +
          index +
          2,
        internalCode:
          internalCode,
        productCode:
          errorProduct
            ? (
                errorProduct.productCode ||
                ""
              )
            : "",
        productName:
          errorProduct
            ? (
                errorProduct.productName ||
                ""
              )
            : `${normalizeSalesActualText(row[1])} ${normalizeSalesActualText(row[2])}`.trim(),
        customerName:
          normalizeSalesActualText(
            row[4]
          ),
        saleDate:
          saleDate ||
          normalizeSalesActualText(
            row[5]
          ),
        quantity:
          quantity === null
            ? normalizeSalesActualText(
                row[6]
              )
            : quantity,
        detailType:
          detailType,
        errorType:
          "入力エラー",
        reason:
          errors.join(
            " / "
          )
      };

      errorRecords.push(inputError);
      inputErrorRecords.push(inputError);

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
        productCode:
          matchedProduct.productCode ||
          "",
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
        errorType:
          "廃盤商品エラー",
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

  const inventoryErrorRecords = buildSalesActualInventoryErrorRecords(
    importRecords,
    productMap
  );

  inventoryErrorRecords.forEach(function (record) {
    errorRecords.push(record);
  });

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
    inputErrorRecords: inputErrorRecords,
    discontinuedErrorRecords: discontinuedErrorRecords,
    inventoryErrorRecords: inventoryErrorRecords,
    unregisteredCodes: Array.from(unregisteredCodes).sort(function (a, b) {
      return a.localeCompare(b, "ja", { numeric: true });
    })
  };
}

function buildSalesActualInventoryErrorRecords(importRecords, productMap) {
  const salesSummaryByCode = new Map();

  importRecords.forEach(function (record) {
    const internalCode = normalizeSalesActualText(record && record.internalCode);
    const quantity = Number(record && record.quantity);
    if (!internalCode || !Number.isFinite(quantity)) return;

    if (!salesSummaryByCode.has(internalCode)) {
      salesSummaryByCode.set(internalCode, {
        quantity: 0,
        customerNames: new Set()
      });
    }

    const summary = salesSummaryByCode.get(internalCode);
    summary.quantity += quantity;

    const customerName = normalizeSalesActualText(record && record.customerName);
    if (customerName) {
      summary.customerNames.add(customerName);
    }
  });

  const errorRecords = [];

  salesSummaryByCode.forEach(function (summary, internalCode) {
    const netSalesQuantity = summary.quantity;
    if (netSalesQuantity <= 0) return;

    const customerNames = Array.from(summary.customerNames);
    const customerName = customerNames.length > 0
      ? customerNames.join(" / ")
      : "未入力";

    const product = productMap.get(internalCode);
    if (!product) return;

    const currentStock = normalizeSalesActualInventoryQuantity(product.stock);
    const eligibleStock = calculateSalesActualEligibleOutboundStock(product, currentStock);

    if (currentStock < netSalesQuantity) {
      const shortageQuantity = netSalesQuantity - currentStock;
      errorRecords.push({
        rowNumber: "集計",
        internalCode: internalCode,
        productCode: product.productCode || "",
        productName: product.productName || "",
        customerName: customerName,
        customerNames: customerNames,
        saleDate: "",
        quantity: netSalesQuantity,
        detailType: "売上集計",
        errorType: "在庫不足エラー",
        reason:
          `現在庫 ${formatSalesActualNumber(currentStock)}個に対して、` +
          `CSV出庫 ${formatSalesActualNumber(netSalesQuantity)}個のため、` +
          `${formatSalesActualNumber(shortageQuantity)}個不足しています。`,
        currentStock: currentStock,
        eligibleStock: eligibleStock,
        csvOutboundQuantity: netSalesQuantity,
        shortageQuantity: shortageQuantity
      });
      return;
    }

    if (eligibleStock < netSalesQuantity) {
      const shortageQuantity = netSalesQuantity - eligibleStock;
      errorRecords.push({
        rowNumber: "集計",
        internalCode: internalCode,
        productCode: product.productCode || "",
        productName: product.productName || "",
        customerName: customerName,
        customerNames: customerNames,
        saleDate: "",
        quantity: netSalesQuantity,
        detailType: "売上集計",
        errorType: "在庫不足エラー",
        reason:
          `現在庫は ${formatSalesActualNumber(currentStock)}個ありますが、` +
          `自動出庫対象（本社・酒本倉庫1階・酒本倉庫2階）は ${formatSalesActualNumber(eligibleStock)}個のため、` +
          `${formatSalesActualNumber(shortageQuantity)}個不足しています。`,
        currentStock: currentStock,
        eligibleStock: eligibleStock,
        csvOutboundQuantity: netSalesQuantity,
        shortageQuantity: shortageQuantity
      });
    }
  });

  return errorRecords.sort(function (left, right) {
    return String(left.internalCode || "").localeCompare(
      String(right.internalCode || ""),
      "ja",
      { numeric: true }
    );
  });
}

function normalizeSalesActualInventoryQuantity(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.trunc(number));
}

function calculateSalesActualEligibleOutboundStock(product, currentStock) {
  const locationStocks = Array.isArray(product && product.locationStocks)
    ? product.locationStocks
    : [];

  let total = 0;
  let hasUsableLocationStock = false;

  locationStocks.forEach(function (entry) {
    const location = normalizeSalesActualText(entry && entry.location);
    if (!SALES_ACTUAL_INVENTORY_LOCATION_PRIORITY.includes(location)) return;
    hasUsableLocationStock = true;
    total += normalizeSalesActualInventoryQuantity(entry && entry.stock);
  });

  if (hasUsableLocationStock) return total;

  const primaryLocation = normalizeSalesActualText(product && product.location);
  if (SALES_ACTUAL_INVENTORY_LOCATION_PRIORITY.includes(primaryLocation)) {
    return currentStock;
  }

  return 0;
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
  setSalesActualErrorPrintButtonEnabled(false);
}

function renderSalesActualPreview(preview) {
  const summary = document.querySelector("#sales-actual-preview-summary");
  const tableBody = document.querySelector("#sales-actual-preview-body");
  const warnings = document.querySelector("#sales-actual-preview-warnings");

  setSalesActualErrorPrintButtonEnabled(
    preview.errorRecords.length >
    0
  );

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
    `<strong>在庫不足エラー：</strong>${preview.inventoryErrorRecords.length}件`,
    `<strong>入力エラー：</strong>${preview.inputErrorRecords.length}件`,
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
      <td>${escapeSalesActualHtml(
        product
          ? (product.productCode || "未登録")
          : "商品マスタ未登録"
      )}</td>
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
          <td>${escapeSalesActualHtml(record.productCode || "未登録")}</td>
          <td>${escapeSalesActualHtml(record.customerName || "")}</td>
          <td>${formatSalesActualNumber(record.quantity)}</td>
          <td><span class="sales-actual-error">廃盤商品エラー</span></td>
        `;

        tableBody.appendChild(
          row
        );
      }
    );

  preview.inventoryErrorRecords
    .slice(0, SALES_ACTUAL_PREVIEW_LIMIT)
    .forEach(function (record) {
      const row = document.createElement("tr");
      row.classList.add("sales-actual-inventory-error-row");
      row.innerHTML = `
        <td>CSV集計</td>
        <td>${escapeSalesActualHtml(record.internalCode)}</td>
        <td>${escapeSalesActualHtml(record.productCode || "未登録")}</td>
        <td>${escapeSalesActualHtml(record.customerName || "未入力")}</td>
        <td>${formatSalesActualNumber(record.csvOutboundQuantity)}個</td>
        <td><span class="sales-actual-error">在庫不足 ${formatSalesActualNumber(record.shortageQuantity)}個</span></td>
      `;
      tableBody.appendChild(row);
    });

  preview.inputErrorRecords
    .slice(0, SALES_ACTUAL_PREVIEW_LIMIT)
    .forEach(function (record) {
      const row = document.createElement("tr");
      row.classList.add("sales-actual-input-error-row");
      row.innerHTML = `
        <td>${escapeSalesActualHtml(formatSalesActualDate(record.saleDate))}</td>
        <td>${escapeSalesActualHtml(record.internalCode || "未入力")}</td>
        <td>${escapeSalesActualHtml(record.productCode || "未登録")}</td>
        <td>${escapeSalesActualHtml(record.customerName || "")}</td>
        <td>${escapeSalesActualHtml(formatSalesActualPrintQuantity(record.quantity))}</td>
        <td><span class="sales-actual-error">入力エラー</span></td>
      `;
      tableBody.appendChild(row);
    });

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

  if (preview.inventoryErrorRecords.length > 0) {
    messages.push(
      `⚠ 在庫不足の商品が${preview.inventoryErrorRecords.length}商品あります。CSV全体を確認した結果をまとめて表示しています。`
    );
    messages.push(
      "在庫不足が1件でもある間は、このCSVの取込ボタンを無効にしています。エラー一覧を印刷して在庫を修正後、同じCSVをもう一度選択してください。"
    );
  }

  if (preview.errorRecords.length > 0) {
    messages.push(
      `エラーが合計${preview.errorRecords.length}件あります。「エラー一覧を印刷する」で廃盤・在庫不足・入力エラーをまとめて確認できます。`
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
    "自動出庫順：本社 → 酒本倉庫1階 → 酒本倉庫2階。返品（マイナス数量）は本社へ戻します。"
  );
  messages.push(
    "v63より前に取り込んだ販売実績CSVは、更新時にさかのぼって在庫へ反映しません。"
  );
  warnings.textContent = messages.join("\n");
}

async function importSelectedSalesActualFile() {
  const preview = salesActualSelectedPreview;

  if (
    preview &&
    Array.isArray(preview.inventoryErrorRecords) &&
    preview.inventoryErrorRecords.length > 0
  ) {
    await showAppDialog({
      type: "danger",
      icon: "📦",
      title: "在庫不足エラーを先に修正してください",
      message: `在庫不足の商品が${preview.inventoryErrorRecords.length}商品あります。CSVはまだ取り込みません。`,
      notice: "「エラー一覧を印刷する」で廃盤商品などと一緒にまとめて確認できます。在庫を修正後、同じCSVをもう一度選択してください。",
      confirmText: "確認して閉じる"
    });
    return;
  }

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
      { label: "在庫不足エラー", value: `${preview.inventoryErrorRecords.length}件` },
      { label: "入力エラー", value: `${preview.inputErrorRecords.length}件` },
      { label: "商品未登録コード", value: `${preview.unregisteredCodes.length}件` }
    ],
    notice:
      "廃盤商品エラーの行は取り込みません。正常な行だけを取り込みます。" +
      " 登録済み商品の販売数量は場所別在庫から自動出庫します。" +
      " 出庫順は、本社 → 酒本倉庫1階 → 酒本倉庫2階です。" +
      " 返品は本社へ戻します。",
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
    setSalesActualImportButtonEnabled(Boolean(
      salesActualSelectedPreview &&
      salesActualSelectedPreview.importRecords.length > 0 &&
      salesActualSelectedPreview.inventoryErrorRecords.length === 0
    ));
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
  setSalesActualErrorPrintButtonEnabled(false);
}

function setSalesActualPreviewMessage(message, isError) {
  const summary = document.querySelector("#sales-actual-preview-summary");
  const body = document.querySelector("#sales-actual-preview-body");
  const warnings = document.querySelector("#sales-actual-preview-warnings");
  if (summary) summary.textContent = message;
  if (body) body.innerHTML = "";
  if (warnings) warnings.textContent = isError ? "ファイルを確認して、もう一度選択してください。" : "";
  setSalesActualErrorPrintButtonEnabled(false);
}

function setSalesActualImportButtonEnabled(enabled) {
  const button = document.querySelector("#import-sales-actual-button");
  if (button) button.disabled = !enabled;
}


function setSalesActualErrorPrintButtonEnabled(
  enabled
) {
  const button =
    document.querySelector(
      "#print-sales-actual-errors-button"
    );

  if (!button) {
    return;
  }

  button.disabled =
    !enabled;

  button.textContent =
    enabled &&
    salesActualSelectedPreview &&
    Array.isArray(
      salesActualSelectedPreview
        .errorRecords
    )
      ? `エラー一覧を印刷する（${salesActualSelectedPreview.errorRecords.length}件）`
      : "エラー一覧を印刷する";
}

function printSalesActualErrorList() {
  const preview =
    salesActualSelectedPreview;

  if (
    !preview ||
    !Array.isArray(
      preview.errorRecords
    ) ||
    preview.errorRecords.length ===
    0
  ) {
    void showAppDialog({
      type: "warning",
      icon: "🖨️",
      title: "印刷するエラーがありません",
      message:
        "エラーがある販売実績CSVを選択してから印刷してください。",
      confirmText: "確認して閉じる"
    });

    return;
  }

  const printWindow =
    window.open(
      "",
      "_blank"
    );

  if (!printWindow) {
    void showAppDialog({
      type: "warning",
      icon: "🖨️",
      title: "印刷画面を開けませんでした",
      message:
        "ブラウザでポップアップが禁止されている可能性があります。",
      notice:
        "このページのポップアップを許可して、もう一度「エラー一覧を印刷する」を押してください。",
      confirmText: "確認して閉じる"
    });

    return;
  }

  const rangeText =
    preview.reportStartDate &&
    preview.reportEndDate
      ? `${formatSalesActualDate(preview.reportStartDate)} ～ ${formatSalesActualDate(preview.reportEndDate)}`
      : "CSV内の日付から判定";

  const printedAt =
    new Date().toLocaleString(
      "ja-JP"
    );

  const rowsHtml =
    preview.errorRecords
      .map(
        function (
          record,
          index
        ) {
          const saleDate =
            formatSalesActualPrintDate(
              record.saleDate
            );

          const quantity =
            formatSalesActualPrintQuantity(
              record.quantity
            );

          const customerName =
            record.customerName ||
            (record.errorType === "在庫不足エラー" ? "CSV全体集計" : "未入力");

          const saleDateForPrint =
            record.errorType === "在庫不足エラー"
              ? "CSV集計"
              : saleDate;

          const errorType =
            record.errorType ||
            (
              record.reason &&
              String(
                record.reason
              ).includes(
                "廃盤"
              )
                ? "廃盤商品エラー"
                : "入力エラー"
            );

          return `
            <tr>
              <td class="center">${index + 1}</td>
              <td class="center">${escapeSalesActualHtml(record.rowNumber || "")}</td>
              <td>${escapeSalesActualHtml(saleDateForPrint)}</td>
              <td>${escapeSalesActualHtml(record.internalCode || "未入力")}</td>
              <td>${escapeSalesActualHtml(record.productCode || "未登録")}</td>
              <td>${escapeSalesActualHtml(customerName)}</td>
              <td class="number">${escapeSalesActualHtml(quantity)}</td>
              <td>${escapeSalesActualHtml(errorType)}</td>
              <td>${escapeSalesActualHtml(record.reason || "内容を確認してください")}</td>
              <td class="check">□</td>
            </tr>
          `;
        }
      )
      .join(
        ""
      );

  const html = `
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <title>販売実績CSV エラー修正一覧</title>
  <style>
    @page {
      size: A4 landscape;
      margin: 9mm;
    }

    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      color: #111;
      font-family:
        "Yu Gothic",
        "Meiryo",
        sans-serif;
      font-size: 10pt;
    }

    h1 {
      margin: 0 0 8px;
      font-size: 20pt;
      text-align: center;
    }

    .subtitle {
      margin: 0 0 12px;
      text-align: center;
      font-size: 11pt;
      font-weight: 700;
    }

    .summary {
      display: grid;
      grid-template-columns:
        1.5fr 1fr 0.8fr 0.8fr 0.8fr;
      gap: 8px;
      margin-bottom: 10px;
    }

    .summary > div {
      padding: 7px 9px;
      border: 1px solid #777;
      border-radius: 4px;
    }

    .notice {
      margin-bottom: 10px;
      padding: 8px 10px;
      border: 2px solid #c62828;
      background: #fff4f4;
      font-weight: 700;
      line-height: 1.5;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
    }

    th,
    td {
      border: 1px solid #555;
      padding: 5px 4px;
      vertical-align: middle;
      overflow-wrap: anywhere;
      word-break: break-word;
    }

    th {
      background: #e8eef5;
      text-align: center;
      font-weight: 800;
    }

    th:nth-child(1) { width: 4%; }
    th:nth-child(2) { width: 5%; }
    th:nth-child(3) { width: 9%; }
    th:nth-child(4) { width: 9%; }
    th:nth-child(5) { width: 11%; }
    th:nth-child(6) { width: 14%; }
    th:nth-child(7) { width: 6%; }
    th:nth-child(8) { width: 12%; }
    th:nth-child(9) { width: 16%; }
    th:nth-child(10) { width: 4%; }

    .center,
    .check {
      text-align: center;
    }

    .number {
      text-align: right;
    }

    .check {
      font-size: 15pt;
      font-weight: 700;
    }

    tbody tr:nth-child(even) {
      background: #fafafa;
    }

    .footer {
      display: flex;
      justify-content: space-between;
      gap: 14px;
      margin-top: 12px;
      font-size: 9pt;
    }

    .sign {
      min-width: 200px;
      border-bottom: 1px solid #555;
      padding-bottom: 3px;
    }
  </style>
</head>
<body>
  <h1>販売実績CSV エラー修正一覧</h1>
  <p class="subtitle">事務修正用</p>

  <div class="summary">
    <div><strong>ファイル：</strong>${escapeSalesActualHtml(preview.fileName || "販売実績CSV")}</div>
    <div><strong>帳票期間：</strong>${escapeSalesActualHtml(rangeText)}</div>
    <div><strong>全エラー：</strong>${preview.errorRecords.length}件</div>
    <div><strong>廃盤：</strong>${preview.discontinuedErrorRecords.length}件</div>
    <div><strong>在庫不足：</strong>${preview.inventoryErrorRecords.length}件</div>
  </div>

  <div class="notice">
    CSV全体を事前確認し、廃盤商品・在庫不足・入力エラーをまとめて表示しています。
    元データまたは在庫数を確認・修正し、同じCSVを再度選択してください。
    修正した項目は右端の「修正確認」にチェックしてください。
  </div>

  <table>
    <thead>
      <tr>
        <th>No.</th>
        <th>CSV行</th>
        <th>出荷日</th>
        <th>社内コード</th>
        <th>商品コード</th>
        <th>取引先名</th>
        <th>数量</th>
        <th>エラー区分</th>
        <th>エラー内容</th>
        <th>修正確認</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml}
    </tbody>
  </table>

  <div class="footer">
    <div>印刷日時：${escapeSalesActualHtml(printedAt)}</div>
    <div class="sign">修正担当：</div>
    <div class="sign">確認者：</div>
  </div>
</body>
</html>
  `;

  printWindow.document.open();
  printWindow.document.write(
    html
  );
  printWindow.document.close();

  printWindow.focus();

  window.setTimeout(
    function () {
      printWindow.print();
    },
    250
  );
}

function formatSalesActualPrintDate(
  value
) {
  if (!value) {
    return "未入力";
  }

  const text =
    String(
      value
    ).trim();

  if (
    /^\d{4}-\d{2}-\d{2}$/.test(
      text
    )
  ) {
    return formatSalesActualDate(
      text
    );
  }

  return text;
}

function formatSalesActualPrintQuantity(
  value
) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "未入力";
  }

  const number =
    Number(
      value
    );

  if (
    Number.isFinite(
      number
    )
  ) {
    return number.toLocaleString(
      "ja-JP"
    );
  }

  return String(
    value
  );
}


function getSortedSalesActualImportHistory() {
  const keySelect = document.querySelector("#sales-actual-history-sort-key");
  const directionSelect = document.querySelector("#sales-actual-history-sort-direction");
  const sortKey = keySelect ? keySelect.value : "importedAt";
  const direction = directionSelect && directionSelect.value === "asc" ? 1 : -1;

  return salesActualImportHistory.slice().sort(function (a, b) {
    if (sortKey === "reportPeriod") {
      const aStart = String(a.reportStartDate || "");
      const bStart = String(b.reportStartDate || "");
      const aEnd = String(a.reportEndDate || "");
      const bEnd = String(b.reportEndDate || "");

      const aMissing = !aStart && !aEnd;
      const bMissing = !bStart && !bEnd;

      if (aMissing !== bMissing) {
        return aMissing ? 1 : -1;
      }

      const startCompare = aStart.localeCompare(bStart);
      if (startCompare !== 0) {
        return startCompare * direction;
      }

      const endCompare = aEnd.localeCompare(bEnd);
      if (endCompare !== 0) {
        return endCompare * direction;
      }

      return String(b.importedAt || "").localeCompare(String(a.importedAt || ""));
    }

    const aImported = String(a.importedAt || "");
    const bImported = String(b.importedAt || "");
    const aMissing = !aImported;
    const bMissing = !bImported;

    if (aMissing !== bMissing) {
      return aMissing ? 1 : -1;
    }

    return aImported.localeCompare(bImported) * direction;
  });
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

  const sortedHistory = getSortedSalesActualImportHistory();

  sortedHistory.forEach(function (batch) {
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
    #sales-actual-import .sales-actual-history-sort {
      display: flex;
      flex-wrap: wrap;
      align-items: end;
      gap: 12px;
      margin: 14px 0 6px;
      padding: 14px;
      background: #f3f8fd;
      border: 1px solid #c9ddf2;
      border-radius: 10px;
    }
    #sales-actual-import .sales-actual-history-sort label {
      display: grid;
      gap: 6px;
      min-width: 210px;
      font-weight: 800;
    }
    #sales-actual-import .sales-actual-history-sort select {
      min-height: 48px;
      padding: 8px 12px;
      border: 1px solid #90a4ae;
      border-radius: 8px;
      background: #ffffff;
      font-size: 1rem;
    }
    #sales-actual-import table { min-width: 760px; }
    #sales-actual-import .sales-actual-actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 12px; }
    #sales-actual-import .sales-actual-ok { color: #2e7d32; font-weight: 700; }
    #sales-actual-import .sales-actual-warning { color: #ef6c00; font-weight: 700; }
    #sales-actual-import .sales-actual-error { color: #c62828; font-weight: 800; }
    #sales-actual-import .sales-actual-discontinued-row { background: #ffebee; }
    #sales-actual-import .sales-actual-discontinued-row td { border-color: #ef9a9a; }
    #sales-actual-import .sales-actual-inventory-error-row { background: #fff3e0; }
    #sales-actual-import .sales-actual-inventory-error-row td { border-color: #ffb74d; }
    #sales-actual-import .sales-actual-input-error-row { background: #fff8e1; }
    #sales-actual-import .sales-actual-input-error-row td { border-color: #ffd54f; }

    #sales-actual-import .sales-actual-summary {
      font-size: 1.08rem;
      line-height: 1.75;
      padding: 18px 20px;
      border-radius: 12px;
    }

    #sales-actual-import .sales-actual-message {
      font-size: 1.05rem;
      line-height: 1.7;
      font-weight: 700;
    }

    #sales-actual-import .sales-actual-preview-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 1rem;
      table-layout: fixed;
    }

    #sales-actual-import .sales-actual-preview-table th,
    #sales-actual-import .sales-actual-preview-table td {
      padding: 12px 10px;
      vertical-align: middle;
      white-space: normal;
      overflow-wrap: anywhere;
    }

    #sales-actual-import .sales-actual-preview-table th {
      font-size: 1rem;
      text-align: center;
    }

    #sales-actual-import .sales-actual-preview-table td:nth-child(1) { width: 14%; }
    #sales-actual-import .sales-actual-preview-table td:nth-child(2) { width: 13%; }
    #sales-actual-import .sales-actual-preview-table td:nth-child(3) { width: 26%; }
    #sales-actual-import .sales-actual-preview-table td:nth-child(4) { width: 20%; }
    #sales-actual-import .sales-actual-preview-table td:nth-child(5) { width: 10%; text-align: right; }
    #sales-actual-import .sales-actual-preview-table td:nth-child(6) { width: 17%; text-align: center; }

    #sales-actual-import .sales-actual-error {
      font-size: 1.02rem;
      font-weight: 800;
    }

    #sales-actual-import .button-row button {
      min-height: 50px;
      padding: 12px 22px;
      font-size: 1rem;
      font-weight: 700;
    }
    /* v149 販売実績CSV確認画面を大きく表示 */
    #sales-actual-import .sales-actual-preview-summary {
      font-size: 18px;
      line-height: 1.85;
      padding: 20px 22px;
      border-radius: 12px;
    }

    #sales-actual-import .sales-actual-warnings {
      font-size: 17px;
      line-height: 1.75;
      padding: 14px 16px;
      margin-top: 14px;
      background: #fff8f0;
      border-left: 6px solid #e65100;
      border-radius: 8px;
    }

    #sales-actual-import .sales-actual-table-wrap {
      overflow-x: visible;
      margin-top: 16px;
    }

    #sales-actual-import .sales-actual-preview-table {
      width: 100%;
      min-width: 0;
      table-layout: fixed;
      border-collapse: collapse;
      font-size: 17px;
    }

    #sales-actual-import .sales-actual-preview-table th,
    #sales-actual-import .sales-actual-preview-table td {
      padding: 13px 12px;
      line-height: 1.45;
      vertical-align: middle;
      white-space: normal;
      overflow-wrap: anywhere;
      word-break: break-word;
    }

    #sales-actual-import .sales-actual-preview-table th {
      font-size: 17px;
      font-weight: 800;
      text-align: center;
    }

    #sales-actual-import .sales-actual-preview-table th:nth-child(1),
    #sales-actual-import .sales-actual-preview-table td:nth-child(1) {
      width: 14%;
    }

    #sales-actual-import .sales-actual-preview-table th:nth-child(2),
    #sales-actual-import .sales-actual-preview-table td:nth-child(2) {
      width: 13%;
    }

    #sales-actual-import .sales-actual-preview-table th:nth-child(3),
    #sales-actual-import .sales-actual-preview-table td:nth-child(3) {
      width: 25%;
    }

    #sales-actual-import .sales-actual-preview-table th:nth-child(4),
    #sales-actual-import .sales-actual-preview-table td:nth-child(4) {
      width: 20%;
    }

    #sales-actual-import .sales-actual-preview-table th:nth-child(5),
    #sales-actual-import .sales-actual-preview-table td:nth-child(5) {
      width: 9%;
      text-align: center;
    }

    #sales-actual-import .sales-actual-preview-table th:nth-child(6),
    #sales-actual-import .sales-actual-preview-table td:nth-child(6) {
      width: 19%;
      text-align: center;
    }

    #sales-actual-import .sales-actual-preview-table .sales-actual-error {
      font-size: 17px;
      font-weight: 900;
    }

    #sales-actual-import .sales-actual-actions {
      gap: 14px;
      margin-top: 16px;
    }

    #sales-actual-import .sales-actual-actions button {
      min-height: 58px;
      padding: 14px 26px;
      font-size: 18px;
      font-weight: 800;
      border-radius: 9px;
    }

    #sales-actual-import .sales-actual-print-errors {
      background: #c62828;
      color: #ffffff;
    }

    #sales-actual-import .sales-actual-print-errors:disabled {
      background: #b0bec5;
      color: #ffffff;
      cursor: not-allowed;
    }

    #sales-actual-import .sales-actual-delete-batch { background-color: #c62828; }
    #sales-actual-import button:disabled { background-color: #b0bec5 !important; cursor: not-allowed; }
    @media (max-width: 700px) {
      #sales-actual-import .sales-actual-card { padding: 13px; }
      #sales-actual-import .sales-actual-actions { display: grid; grid-template-columns: 1fr; }
      #sales-actual-import .sales-actual-history-sort { display: grid; grid-template-columns: 1fr; }
      #sales-actual-import .sales-actual-history-sort label { min-width: 0; }
    }
  `;
  document.head.appendChild(style);
}
