
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

  button.disabled = true;
  button.textContent = "バックアップ内容を確認しています...";

  try {
    const [productsData, movements, stocktakings, submissions, reflections, salesPlans, salesActuals, salesImportBatches, shippingWishes, shippingSchedules, shippingAllocations, shippingWarehouseAllocations, shippingArrivalReceipts, transferLists, orderRemainingHistories, restoreLogs] =
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
        getAllOrderRemainingHistories(),
        getAllRestoreLogs()
      ]);

    const confirmed =
      typeof showAppDialog === "function"
        ? await showAppDialog({
            type: "warning",
            icon: "💾",
            title: "全データをバックアップしますか？",
            message: "バックアップに含まれるデータ件数を確認してください。",
            details: [
              { label: "商品", value: `${productsData.length}件` },
              { label: "入出庫履歴", value: `${movements.length}件` },
              { label: "棚卸履歴", value: `${stocktakings.length}件` },
              { label: "販売予定", value: `${salesPlans.length}件` },
              { label: "販売実績", value: `${salesActuals.length}件` },
              { label: "販売実績CSV取込履歴", value: `${salesImportBatches.length}件` },
              { label: "船便スケジュール", value: `${shippingSchedules.length}件` },
              { label: "商品移動リスト", value: `${transferLists.length}件` },
              { label: "発注残変更履歴", value: `${orderRemainingHistories.length}件` }
            ],
            notice: "このバックアップには会社の在庫情報が含まれます。第三者が見られる場所や公開された場所には保存しないでください。",
            isConfirm: true,
            cancelText: "戻る",
            confirmText: "バックアップを作成する"
          })
        : window.confirm(
            "会社の在庫情報を含む全データのバックアップを作成します。\n\nバックアップを作成しますか？"
          );

    if (!confirmed) {
      return;
    }

    button.textContent = "バックアップを作成しています...";

    const exportedAt = new Date();
    const appSettings = collectAppSettingsForBackup();
    const backupData = {
      backupType: "barcode-inventory-app",
      backupVersion: 10,
      appVersion: "v118",
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
        orderRemainingHistories:
          orderRemainingHistories.length,
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
        orderRemainingHistories:
          orderRemainingHistories,
        appSettings: appSettings,
        restoreLogs: restoreLogs
      }
    };

    const jsonText = JSON.stringify(backupData, null, 2);
    const fileName = createBackupFileName(exportedAt);
    downloadBackupFile(jsonText, fileName);

    if (typeof showAppDialog === "function") {
      await showAppDialog({
        type: "success",
        icon: "✅",
        title: "バックアップを保存しました",
        message: "バックアップファイルを大切に保管してください。",
        details: [
          { label: "ファイル名", value: fileName },
          { label: "商品", value: `${productsData.length}件` },
          { label: "入出庫履歴", value: `${movements.length}件` },
          { label: "棚卸履歴", value: `${stocktakings.length}件` },
          { label: "販売実績", value: `${salesActuals.length}件` },
          { label: "商品移動リスト", value: `${transferLists.length}件` },
          { label: "発注残変更履歴", value: `${orderRemainingHistories.length}件` }
        ],
        notice: "会社の在庫情報を含むため、安全な場所に保存してください。",
        confirmText: "確認して閉じる"
      });
    } else {
      alert(`バックアップを保存しました。\n\nファイル名：${fileName}`);
    }
  } catch (error) {
    console.error("バックアップ作成エラー", error);

    if (typeof showAppDialog === "function") {
      await showAppDialog({
        type: "danger",
        icon: "⚠️",
        title: "バックアップを作成できませんでした",
        message: "データの読み込みまたはファイル作成中にエラーが発生しました。",
        notice: "ブラウザを更新してもう一度試してください。改善しない場合は、画面の内容を確認してください。",
        confirmText: "確認して閉じる"
      });
    } else {
      alert("バックアップを作成できませんでした。");
    }
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
