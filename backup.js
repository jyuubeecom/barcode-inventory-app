
"use strict";

document.addEventListener("DOMContentLoaded", initializeBackupFunction);

function initializeBackupFunction() {
  createBackupButton();
  createBackupStyle();
}

function createBackupButton() {
  if (document.querySelector("#export-full-backup-button")) return;
  const homeScreen = document.querySelector("#home");
  if (!homeScreen) return;
  const button = document.createElement("button");
  button.id = "export-full-backup-button";
  button.type = "button";
  button.textContent = "全データをバックアップする";
  button.addEventListener("click", exportFullBackup);
  homeScreen.appendChild(button);
}

function createBackupStyle() {
  const style = document.createElement("style");
  style.id = "backup-style";
  style.textContent = `
    #export-full-backup-button { background-color: #5d4037; }
    #export-full-backup-button:disabled { background-color: #b0bec5; }
  `;
  document.head.appendChild(style);
}

async function exportFullBackup() {
  const button = document.querySelector("#export-full-backup-button");
  const confirmed = window.confirm(
    "商品・在庫・入出庫履歴・棚卸履歴・集約データ・販売予定・販売実績・船便スケジュール・商品振分け・倉庫別振分け・船便入荷反映履歴・商品移動リスト・旧船積希望データ（互換用）を保存します。\n\n" +
    "バックアップには会社の在庫情報が含まれます。\n" +
    "第三者が見られる場所には保存しないでください。\n\n" +
    "バックアップを作成しますか？"
  );
  if (!confirmed) return;

  button.disabled = true;
  button.textContent = "バックアップを作成しています...";

  try {
    const [productsData, movements, stocktakings, submissions, reflections, salesPlans, salesActuals, salesImportBatches, shippingWishes, shippingSchedules, shippingAllocations, shippingWarehouseAllocations, shippingArrivalReceipts, transferLists, restoreLogs] =
      await Promise.all([
        getAllProducts(),
        getAllStockMovements(),
        getAllRecordsFromStore(STOCKTAKING_STORE_NAME),
        getAllStocktakingSubmissions(),
        getAllStocktakingAggregationReflections(),
        getAllSalesPlans(),
        getAllSalesActuals(),
        getAllSalesImportBatches(),
        getAllShippingWishes(),
        getAllShippingSchedules(),
        getAllShippingAllocations(),
        getAllShippingWarehouseAllocations(),
        getAllShippingArrivalReceipts(),
        getAllTransferLists(),
        getAllRestoreLogs()
      ]);

    const exportedAt = new Date();
    const appSettings = collectAppSettingsForBackup();
    const backupData = {
      backupType: "barcode-inventory-app",
      backupVersion: 9,
      appVersion: "v54",
      appName: "バーコード在庫・棚卸管理",
      exportedAt: exportedAt.toISOString(),
      counts: {
        products: productsData.length,
        stockMovements: movements.length,
        stocktakings: stocktakings.length,
        stocktakingSubmissions: submissions.length,
        aggregationReflections: reflections.length,
        salesPlans: salesPlans.length,
        salesActuals: salesActuals.length,
        salesImportBatches: salesImportBatches.length,
        shippingWishes: shippingWishes.length,
        shippingSchedules: shippingSchedules.length,
        shippingAllocations: shippingAllocations.length,
        shippingWarehouseAllocations: shippingWarehouseAllocations.length,
        shippingArrivalReceipts: shippingArrivalReceipts.length,
        transferLists: transferLists.length,
        restoreLogs: restoreLogs.length
      },
      data: {
        products: productsData,
        stockMovements: movements,
        stocktakings: stocktakings,
        stocktakingSubmissions: submissions,
        aggregationReflections: reflections,
        salesPlans: salesPlans,
        salesActuals: salesActuals,
        salesImportBatches: salesImportBatches,
        shippingWishes: shippingWishes,
        shippingSchedules: shippingSchedules,
        shippingAllocations: shippingAllocations,
        shippingWarehouseAllocations: shippingWarehouseAllocations,
        shippingArrivalReceipts: shippingArrivalReceipts,
        transferLists: transferLists,
        appSettings: appSettings,
        restoreLogs: restoreLogs
      }
    };

    const jsonText = JSON.stringify(backupData, null, 2);
    const fileName = createBackupFileName(exportedAt);
    downloadBackupFile(jsonText, fileName);
    alert(
      "バックアップを保存しました。\n\n" +
      `商品：${productsData.length}件\n` +
      `入出庫履歴：${movements.length}件\n` +
      `棚卸履歴：${stocktakings.length}件\n` +
      `集約提出データ：${submissions.length}件\n` +
      `集約反映履歴：${reflections.length}件\n` +
      `販売予定：${salesPlans.length}件\n` +
      `販売実績：${salesActuals.length}件\n` +
      `販売実績CSV取込履歴：${salesImportBatches.length}件\n` +
      `旧船積希望データ（互換用）：${shippingWishes.length}件\n` +
      `船便スケジュール：${shippingSchedules.length}件\n` +
      `船便商品振分け：${shippingAllocations.length}件\n` +
      `倉庫別振分け：${shippingWarehouseAllocations.length}件\n` +
      `船便入荷反映履歴：${shippingArrivalReceipts.length}件\n` +
      `商品移動リスト：${transferLists.length}件\n\n` +
      `ファイル名：${fileName}`
    );
  } catch (error) {
    console.error("バックアップ作成エラー", error);
    alert("バックアップを作成できませんでした。");
  } finally {
    button.disabled = false;
    button.textContent = "全データをバックアップする";
  }
}

function collectAppSettingsForBackup() {
  const result = {};
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (!key) continue;
    if (/barcode|inventory|stocktaking|pwa/i.test(key)) {
      result[key] = localStorage.getItem(key);
    }
  }
  return result;
}

function createBackupFileName(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `在庫管理アプリ_全データバックアップ_${y}-${m}-${d}.json`;
}

function downloadBackupFile(text, fileName) {
  const blob = new Blob([text], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
