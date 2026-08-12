
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
    alert("50MB以下のバックアップファイルを選んでください。");
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

    const first = window.confirm(
      "次のバックアップを復元します。\n\n" +
      `作成日時：${formatBackupDate(backup.exportedAt)}\n` +
      `商品：${c.products}件\n` +
      `入出庫履歴：${c.stockMovements}件\n` +
      `棚卸履歴：${c.stocktakings}件\n` +
      `集約提出データ：${c.stocktakingSubmissions}件\n` +
      `集約反映履歴：${c.aggregationReflections}件\n` +
      `販売予定：${c.salesPlans}件\n\n` +
      "現在のデータはすべて置き換えられます。\n" +
      "現在のデータを残す場合は、先にバックアップしてください。\n\n" +
      "復元を続けますか？"
    );
    if (!first) return;

    const final = window.confirm(
      "最終確認です。\n\n" +
      "現在のデータを消してバックアップへ置き換えます。\n" +
      "この操作は元に戻せません。\n\n本当に復元しますか？"
    );
    if (!final) return;

    button.textContent = "データを復元しています...";
    await replaceAllDataFromBackupV31(backup, file.name);
    restoreAppSettings(backup.data.appSettings);
    alert(
      "バックアップから復元しました。\n\n" +
      `商品：${c.products}件\n` +
      `入出庫履歴：${c.stockMovements}件\n` +
      `棚卸履歴：${c.stocktakings}件\n` +
      `集約提出データ：${c.stocktakingSubmissions}件\n` +
      `集約反映履歴：${c.aggregationReflections}件\n` +
      `販売予定：${c.salesPlans}件\n\n` +
      "画面を更新します。"
    );
    location.reload();
  } catch (error) {
    console.error("バックアップ復元エラー", error);
    const detail = error instanceof SyntaxError
      ? "JSONファイルの内容が壊れています。"
      : (error.message || "原因を確認できませんでした。");
    alert("バックアップを復元できませんでした。\n\n" + detail + "\n\n現在のデータは変更されていません。");
  } finally {
    event.target.value = "";
    button.disabled = false;
    button.textContent = "バックアップから復元する";
  }
}

function normalizeAndValidateBackup(raw) {
  if (!raw || raw.backupType !== "barcode-inventory-app") {
    throw new Error("このアプリで作成したバックアップではありません。");
  }
  if (![1, 2, 3].includes(raw.backupVersion)) {
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
  normalized.counts = {
    products: normalized.data.products.length,
    stockMovements: normalized.data.stockMovements.length,
    stocktakings: normalized.data.stocktakings.length,
    stocktakingSubmissions: normalized.data.stocktakingSubmissions.length,
    aggregationReflections: normalized.data.aggregationReflections.length,
    salesPlans: normalized.data.salesPlans.length,
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
