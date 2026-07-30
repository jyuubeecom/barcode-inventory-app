"use strict";

document.addEventListener(
  "DOMContentLoaded",
  initializeBackupFunction
);

function initializeBackupFunction() {
  createBackupButton();
  createBackupStyle();
}

function createBackupButton() {
  if (
    document.querySelector(
      "#export-full-backup-button"
    )
  ) {
    return;
  }

  const homeScreen =
    document.querySelector(
      "#home"
    );

  if (!homeScreen) {
    console.error(
      "ホーム画面が見つからないため、バックアップボタンを追加できません。"
    );

    return;
  }

  const button =
    document.createElement("button");

  button.id =
    "export-full-backup-button";

  button.type =
    "button";

  button.textContent =
    "全データをバックアップする";

  button.addEventListener(
    "click",
    exportFullBackup
  );

  homeScreen.appendChild(
    button
  );
}

function createBackupStyle() {
  if (
    document.querySelector(
      "#backup-style"
    )
  ) {
    return;
  }

  const style =
    document.createElement("style");

  style.id =
    "backup-style";

  style.textContent = `
    #export-full-backup-button {
      background-color: #5d4037;
    }

    #export-full-backup-button:disabled {
      background-color: #b0bec5;
      color: #eceff1;
      cursor: not-allowed;
    }
  `;

  document.head.appendChild(
    style
  );
}

async function exportFullBackup() {
  const button =
    document.querySelector(
      "#export-full-backup-button"
    );

  const confirmed =
    window.confirm(
      "商品・在庫・入出庫履歴・棚卸履歴を、バックアップファイルとして保存します。\n\n" +
      "バックアップには在庫情報が含まれます。\n" +
      "GitHubや第三者が見られる場所には保存しないでください。\n\n" +
      "バックアップを作成してよろしいですか？"
    );

  if (!confirmed) {
    return;
  }

  if (button) {
    button.disabled =
      true;

    button.textContent =
      "バックアップを作成しています...";
  }

  try {
    const [
      products,
      stockMovements,
      stocktakings
    ] =
      await Promise.all([
        getAllProducts(),
        getAllStockMovements(),
        getAllStocktakingsForBackup()
      ]);

    const exportedAt =
      new Date();

    const backupData = {
      backupType:
        "barcode-inventory-app",

      backupVersion:
        1,

      appName:
        "バーコード在庫・棚卸管理",

      exportedAt:
        exportedAt.toISOString(),

      counts: {
        products:
          products.length,

        stockMovements:
          stockMovements.length,

        stocktakings:
          stocktakings.length
      },

      data: {
        products:
          products,

        stockMovements:
          stockMovements,

        stocktakings:
          stocktakings
      }
    };

    const jsonText =
      JSON.stringify(
        backupData,
        null,
        2
      );

    const fileName =
      createBackupFileName(
        exportedAt
      );

    downloadBackupFile(
      jsonText,
      fileName
    );

    alert(
      "バックアップを保存しました。\n\n" +
      `商品：${products.length}件\n` +
      `入出庫履歴：${stockMovements.length}件\n` +
      `棚卸履歴：${stocktakings.length}件\n\n` +
      `ファイル名：${fileName}`
    );
  } catch (error) {
    console.error(
      "バックアップ作成エラー",
      error
    );

    alert(
      "バックアップを作成できませんでした。\n\n" +
      "ブラウザーを更新して、もう一度お試しください。"
    );
  } finally {
    if (button) {
      button.disabled =
        false;

      button.textContent =
        "全データをバックアップする";
    }
  }
}

async function getAllStocktakingsForBackup() {
  const database =
    await openDatabase();

  return new Promise(function (
    resolve,
    reject
  ) {
    const transaction =
      database.transaction(
        "stocktakings",
        "readonly"
      );

    const store =
      transaction.objectStore(
        "stocktakings"
      );

    const request =
      store.getAll();

    let stocktakings = [];

    request.onsuccess =
      function () {
        stocktakings =
          request.result || [];
      };

    transaction.oncomplete =
      function () {
        database.close();

        resolve(
          stocktakings
        );
      };

    transaction.onerror =
      function () {
        const error =
          transaction.error;

        database.close();

        reject(
          error
        );
      };

    transaction.onabort =
      function () {
        const error =
          transaction.error;

        database.close();

        reject(
          error
        );
      };
  });
}

function createBackupFileName(
  date
) {
  const year =
    date.getFullYear();

  const month =
    String(
      date.getMonth() + 1
    ).padStart(
      2,
      "0"
    );

  const day =
    String(
      date.getDate()
    ).padStart(
      2,
      "0"
    );

  const hour =
    String(
      date.getHours()
    ).padStart(
      2,
      "0"
    );

  const minute =
    String(
      date.getMinutes()
    ).padStart(
      2,
      "0"
    );

  const second =
    String(
      date.getSeconds()
    ).padStart(
      2,
      "0"
    );

  return (
    `在庫管理バックアップ_${year}-${month}-${day}_${hour}-${minute}-${second}.json`
  );
}

function downloadBackupFile(
  jsonText,
  fileName
) {
  const blob =
    new Blob(
      [jsonText],
      {
        type:
          "application/json;charset=utf-8"
      }
    );

  const url =
    URL.createObjectURL(
      blob
    );

  const link =
    document.createElement("a");

  link.href =
    url;

  link.download =
    fileName;

  document.body.appendChild(
    link
  );

  link.click();

  link.remove();

  window.setTimeout(
    function () {
      URL.revokeObjectURL(
        url
      );
    },
    1000
  );
}