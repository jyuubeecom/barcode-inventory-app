
"use strict";

document.addEventListener("DOMContentLoaded", initializeRestoreFunction);

function initializeRestoreFunction() {
  createRestoreControls();
  createRestoreStyle();
}

function createRestoreControls() {
  if (document.querySelector("#restore-full-backup-button")) return;
  const homeScreen = document.querySelector("#home");
  if (!homeScreen) return;

  const button = document.createElement("button");
  button.id = "restore-full-backup-button";
  button.type = "button";
  button.textContent = "バックアップから復元する";

  const input = document.createElement("input");
  input.id = "restore-backup-file";
  input.type = "file";
  input.accept = ".json,application/json";
  input.hidden = true;

  button.addEventListener("click", function () {
    input.value = "";
    input.click();
  });
  input.addEventListener("change", handleRestoreFileSelection);
  homeScreen.appendChild(button);
  homeScreen.appendChild(input);
}

function createRestoreStyle() {
  const style = document.createElement("style");
  style.id = "restore-style";
  style.textContent = `
    #restore-full-backup-button { background-color: #ef6c00; }
    #restore-full-backup-button:disabled { background-color: #b0bec5; }
  `;
  document.head.appendChild(style);
}

async function handleRestoreFileSelection(event) {
  const file = event.target.files[0];
  if (!file) return;
  const button = document.querySelector("#restore-full-backup-button");

  if (file.size > 50 * 1024 * 1024) {
    await showRestoreDialog({
      type: "warning",
      icon: "⚠️",
      title: "バックアップファイルが大きすぎます",
      message: "50MB以下のバックアップファイルを選んでください。",
      confirmText: "確認して閉じる"
    });
    event.target.value = "";
    return;
  }

  button.disabled = true;
  button.textContent = "バックアップを確認しています...";

  try {
    const text = await file.text();
    const raw = JSON.parse(text);
    const backup = normalizeAndValidateBackup(raw);
    const c = backup.counts;

    const first = await showRestoreDialog({
      type: "warning",
      icon: "💾",
      title: "バックアップから復元しますか？",
      message: "復元するバックアップの内容を確認してください。",
      details: [
        { label: "ファイル名", value: file.name },
        { label: "作成日時", value: formatBackupDate(backup.exportedAt) },
        { label: "商品", value: `${c.products}件` },
        { label: "入出庫履歴", value: `${c.stockMovements}件` },
        { label: "棚卸履歴", value: `${c.stocktakings}件` },
        { label: "販売予定", value: `${c.salesPlans}件` },
        { label: "販売実績", value: `${c.salesActuals}件` },
        { label: "販売実績CSV取込履歴", value: `${c.salesImportBatches}件` },
        { label: "船便スケジュール", value: `${c.shippingSchedules}件` },
        { label: "商品移動リスト", value: `${c.transferLists}件` },
        { label: "発注残変更履歴", value: `${c.orderRemainingHistories}件` },
        { label: "発注残変更履歴", value: `${c.orderRemainingHistories}件` }
      ],
      notice: "現在のデータはバックアップの内容へ置き換えられます。現在のデータを残したい場合は、先に『全データをバックアップする』を実行してください。",
      isConfirm: true,
      cancelText: "戻る",
      confirmText: "復元内容を確認する"
    });
    if (!first) return;

    const final = await showRestoreDialog({
      type: "danger",
      icon: "⚠️",
      title: "最終確認：本当に復元しますか？",
      message: "現在のデータを消して、選択したバックアップの内容へ置き換えます。",
      details: [
        { label: "復元するファイル", value: file.name },
        { label: "商品", value: `${c.products}件` },
        { label: "入出庫履歴", value: `${c.stockMovements}件` },
        { label: "棚卸履歴", value: `${c.stocktakings}件` }
      ],
      notice: "この操作は元に戻せません。必要なデータをバックアップ済みか、もう一度確認してください。",
      isConfirm: true,
      cancelText: "戻る",
      confirmText: "バックアップから復元する"
    });
    if (!final) return;

    button.textContent = "データを復元しています...";
    await replaceAllDataFromBackupV31(backup, file.name);
    restoreAppSettings(backup.data.appSettings);
    await showRestoreDialog({
      type: "success",
      icon: "✅",
      title: "バックアップから復元しました",
      message: "復元が完了しました。画面を更新して新しいデータを表示します。",
      details: [
        { label: "商品", value: `${c.products}件` },
        { label: "入出庫履歴", value: `${c.stockMovements}件` },
        { label: "棚卸履歴", value: `${c.stocktakings}件` },
        { label: "販売予定", value: `${c.salesPlans}件` },
        { label: "販売実績", value: `${c.salesActuals}件` },
        { label: "商品移動リスト", value: `${c.transferLists}件` }
      ],
      confirmText: "画面を更新する"
    });
    location.reload();
  } catch (error) {
    console.error("バックアップ復元エラー", error);
    const detail = error instanceof SyntaxError
      ? "JSONファイルの内容が壊れています。"
      : (error.message || "原因を確認できませんでした。");
    await showRestoreDialog({
      type: "danger",
      icon: "❌",
      title: "バックアップを復元できませんでした",
      message: detail,
      notice: "現在のデータは変更されていません。別のバックアップファイルを確認してください。",
      confirmText: "確認して閉じる"
    });
  } finally {
    event.target.value = "";
    button.disabled = false;
    button.textContent = "バックアップから復元する";
  }
}

function showRestoreDialog(options) {
  if (typeof showAppDialog === "function") {
    return showAppDialog(options);
  }

  const dialogOptions = options || {};
  const detailsText = Array.isArray(dialogOptions.details)
    ? dialogOptions.details
        .map(function (detail) {
          return `${detail.label}：${detail.value}`;
        })
        .join("\n")
    : "";
  const text = [
    dialogOptions.title || "お知らせ",
    dialogOptions.message || "",
    detailsText,
    dialogOptions.notice || ""
  ].filter(Boolean).join("\n\n");

  if (dialogOptions.isConfirm) {
    return Promise.resolve(window.confirm(text));
  }

  window.alert(text);
  return Promise.resolve(true);
}

function normalizeAndValidateBackup(raw) {
  if (!raw || raw.backupType !== "barcode-inventory-app") {
    throw new Error("このアプリで作成したバックアップではありません。");
  }
  if (![1, 2, 3, 4, 5, 6, 7, 8, 9, 10].includes(raw.backupVersion)) {
    throw new Error("対応していないバックアップ形式です。");
  }
  const data = raw.data || {};
  const normalized = {
    ...raw,
    data: {
      products: Array.isArray(data.products) ? data.products : null,
      stockMovements: Array.isArray(data.stockMovements) ? data.stockMovements : null,
      stocktakings: Array.isArray(data.stocktakings) ? data.stocktakings : null,
      stocktakingSubmissions: Array.isArray(data.stocktakingSubmissions) ? data.stocktakingSubmissions : [],
      aggregationReflections: Array.isArray(data.aggregationReflections) ? data.aggregationReflections : [],
      salesPlans: Array.isArray(data.salesPlans) ? data.salesPlans : [],
      salesActuals: Array.isArray(data.salesActuals) ? data.salesActuals : [],
      salesImportBatches: Array.isArray(data.salesImportBatches) ? data.salesImportBatches : [],
      shippingWishes: Array.isArray(data.shippingWishes) ? data.shippingWishes : [],
      shippingSchedules: Array.isArray(data.shippingSchedules) ? data.shippingSchedules : [],
      shippingAllocations: Array.isArray(data.shippingAllocations) ? data.shippingAllocations : [],
      shippingWarehouseAllocations: Array.isArray(data.shippingWarehouseAllocations) ? data.shippingWarehouseAllocations : [],
      shippingArrivalReceipts: Array.isArray(data.shippingArrivalReceipts) ? data.shippingArrivalReceipts : [],
      transferLists: Array.isArray(data.transferLists) ? data.transferLists : [],
      orderRemainingHistories: Array.isArray(data.orderRemainingHistories) ? data.orderRemainingHistories : [],
      appSettings: data.appSettings && typeof data.appSettings === "object" ? data.appSettings : {},
      restoreLogs: Array.isArray(data.restoreLogs) ? data.restoreLogs : []
    }
  };

  if (!normalized.data.products || !normalized.data.stockMovements || !normalized.data.stocktakings) {
    throw new Error("バックアップの基本データが不足しています。");
  }
  validateProductRecordsV31(normalized.data.products);
  validateUniqueKeyRecords(normalized.data.stockMovements, "id", "入出庫履歴");
  validateUniqueKeyRecords(normalized.data.stocktakings, "id", "棚卸履歴");
  validateUniqueKeyRecords(normalized.data.stocktakingSubmissions, "submissionId", "集約提出データ");
  validateUniqueKeyRecords(normalized.data.aggregationReflections, "reflectionId", "集約反映履歴");
  validateUniqueKeyRecords(normalized.data.salesPlans, "id", "販売予定");
  validateUniqueKeyRecords(normalized.data.salesActuals, "id", "販売実績");
  validateUniqueKeyRecords(normalized.data.salesImportBatches, "batchId", "販売実績CSV取込履歴");
  validateUniqueKeyRecords(normalized.data.shippingWishes, "id", "船積希望");
  validateUniqueKeyRecords(normalized.data.shippingSchedules, "id", "船便スケジュール");
  validateUniqueKeyRecords(normalized.data.shippingAllocations, "id", "船便商品振分け");
  validateUniqueKeyRecords(normalized.data.shippingWarehouseAllocations, "id", "倉庫別振分け");
  validateUniqueKeyRecords(normalized.data.shippingArrivalReceipts, "id", "船便入荷反映履歴");
  validateUniqueKeyRecords(normalized.data.transferLists, "id", "商品移動リスト");
  validateUniqueKeyRecords(normalized.data.orderRemainingHistories, "id", "発注残変更履歴");
  normalized.counts = {
    products: normalized.data.products.length,
    stockMovements: normalized.data.stockMovements.length,
    stocktakings: normalized.data.stocktakings.length,
    stocktakingSubmissions: normalized.data.stocktakingSubmissions.length,
    aggregationReflections: normalized.data.aggregationReflections.length,
    salesPlans: normalized.data.salesPlans.length,
    salesActuals: normalized.data.salesActuals.length,
    salesImportBatches: normalized.data.salesImportBatches.length,
    shippingWishes: normalized.data.shippingWishes.length,
    shippingSchedules: normalized.data.shippingSchedules.length,
    shippingAllocations: normalized.data.shippingAllocations.length,
    shippingWarehouseAllocations: normalized.data.shippingWarehouseAllocations.length,
    shippingArrivalReceipts: normalized.data.shippingArrivalReceipts.length,
    transferLists: normalized.data.transferLists.length,
    orderRemainingHistories:
      normalized.data.orderRemainingHistories.length,
    restoreLogs: normalized.data.restoreLogs.length
  };
  return normalized;
}

function validateProductRecordsV31(records) {
  const keys = new Set();
  records.forEach(function (record, index) {
    if (!record || typeof record !== "object") throw new Error(`商品${index + 1}件目が正しくありません。`);
    const key = String(record.internalCode || "").trim();
    if (!key) throw new Error(`商品${index + 1}件目に社内コードがありません。`);
    if (keys.has(key)) throw new Error(`社内コード「${key}」が重複しています。`);
    keys.add(key);
  });
}

function validateUniqueKeyRecords(records, keyName, label) {
  const keys = new Set();
  records.forEach(function (record, index) {
    if (!record || typeof record !== "object") throw new Error(`${label}${index + 1}件目が正しくありません。`);
    const key = record[keyName];
    if (key === undefined || key === null || key === "") throw new Error(`${label}${index + 1}件目に識別番号がありません。`);
    const text = String(key);
    if (keys.has(text)) throw new Error(`${label}内で識別番号「${text}」が重複しています。`);
    keys.add(text);
  });
}

async function replaceAllDataFromBackupV31(backup, fileName) {
  const db = await openDatabase();
  const d = backup.data;
  const storeNames = [
    PRODUCT_STORE_NAME,
    MOVEMENT_STORE_NAME,
    STOCKTAKING_STORE_NAME,
    STOCKTAKING_SUBMISSION_STORE_NAME,
    STOCKTAKING_AGGREGATION_REFLECTION_STORE_NAME,
    SALES_PLAN_STORE_NAME,
    SALES_ACTUAL_STORE_NAME,
    SALES_IMPORT_BATCH_STORE_NAME,
    SHIPPING_WISH_STORE_NAME,
    SHIPPING_SCHEDULE_STORE_NAME,
    SHIPPING_ALLOCATION_STORE_NAME,
    SHIPPING_WAREHOUSE_ALLOCATION_STORE_NAME,
    SHIPPING_ARRIVAL_RECEIPT_STORE_NAME,
    TRANSFER_LIST_STORE_NAME,
    ORDER_REMAINING_HISTORY_STORE_NAME,
    RESTORE_LOG_STORE_NAME
  ];

  return new Promise(function (resolve, reject) {
    let tx;
    try {
      tx = db.transaction(storeNames, "readwrite");
      storeNames.forEach(function (name) { tx.objectStore(name).clear(); });
      d.products.forEach(function (r) { tx.objectStore(PRODUCT_STORE_NAME).put(r); });
      d.stockMovements.forEach(function (r) { tx.objectStore(MOVEMENT_STORE_NAME).put(r); });
      d.stocktakings.forEach(function (r) { tx.objectStore(STOCKTAKING_STORE_NAME).put(r); });
      d.stocktakingSubmissions.forEach(function (r) { tx.objectStore(STOCKTAKING_SUBMISSION_STORE_NAME).put(r); });
      d.aggregationReflections.forEach(function (r) { tx.objectStore(STOCKTAKING_AGGREGATION_REFLECTION_STORE_NAME).put(r); });
      d.salesPlans.forEach(function (r) { tx.objectStore(SALES_PLAN_STORE_NAME).put(r); });
      d.salesActuals.forEach(function (r) { tx.objectStore(SALES_ACTUAL_STORE_NAME).put(r); });
      d.salesImportBatches.forEach(function (r) { tx.objectStore(SALES_IMPORT_BATCH_STORE_NAME).put(r); });
      d.shippingWishes.forEach(function (r) { tx.objectStore(SHIPPING_WISH_STORE_NAME).put(r); });
      d.shippingSchedules.forEach(function (r) { tx.objectStore(SHIPPING_SCHEDULE_STORE_NAME).put(r); });
      d.shippingAllocations.forEach(function (r) { tx.objectStore(SHIPPING_ALLOCATION_STORE_NAME).put(r); });
      d.shippingWarehouseAllocations.forEach(function (r) { tx.objectStore(SHIPPING_WAREHOUSE_ALLOCATION_STORE_NAME).put(r); });
      d.shippingArrivalReceipts.forEach(function (r) { tx.objectStore(SHIPPING_ARRIVAL_RECEIPT_STORE_NAME).put(r); });
      d.transferLists.forEach(function (r) { tx.objectStore(TRANSFER_LIST_STORE_NAME).put(r); });
      d.orderRemainingHistories.forEach(function (r) { tx.objectStore(ORDER_REMAINING_HISTORY_STORE_NAME).put(r); });
      d.restoreLogs.forEach(function (r) { tx.objectStore(RESTORE_LOG_STORE_NAME).put(r); });
      tx.objectStore(RESTORE_LOG_STORE_NAME).put({
        id: `restore-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        restoredAt: new Date().toISOString(),
        sourceFileName: fileName,
        sourceExportedAt: backup.exportedAt || "",
        sourceBackupVersion: backup.backupVersion,
        counts: backup.counts
      });
    } catch (error) {
      db.close();
      reject(error);
      return;
    }
    tx.oncomplete = function () { db.close(); resolve(); };
    tx.onerror = function () { const error = tx.error; db.close(); reject(error); };
    tx.onabort = tx.onerror;
  });
}

function restoreAppSettings(settings) {
  if (!settings || typeof settings !== "object") return;
  Object.entries(settings).forEach(function (entry) {
    localStorage.setItem(entry[0], entry[1]);
  });
}

function formatBackupDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? (value || "記録なし") : date.toLocaleString("ja-JP");
}
