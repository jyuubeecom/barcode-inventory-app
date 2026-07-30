"use strict";

document.addEventListener(
  "DOMContentLoaded",
  initializeRestoreFunction
);

function initializeRestoreFunction() {
  createRestoreControls();
  createRestoreStyle();
}

function createRestoreControls() {
  if (
    document.querySelector(
      "#restore-full-backup-button"
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
      "ホーム画面が見つからないため、復元ボタンを追加できません。"
    );

    return;
  }

  const button =
    document.createElement("button");

  button.id =
    "restore-full-backup-button";

  button.type =
    "button";

  button.textContent =
    "バックアップから復元する";

  const fileInput =
    document.createElement("input");

  fileInput.id =
    "restore-backup-file";

  fileInput.type =
    "file";

  fileInput.accept =
    ".json,application/json";

  fileInput.hidden =
    true;

  button.addEventListener(
    "click",
    function () {
      fileInput.value =
        "";

      fileInput.click();
    }
  );

  fileInput.addEventListener(
    "change",
    handleRestoreFileSelection
  );

  homeScreen.appendChild(
    button
  );

  homeScreen.appendChild(
    fileInput
  );
}

function createRestoreStyle() {
  if (
    document.querySelector(
      "#restore-style"
    )
  ) {
    return;
  }

  const style =
    document.createElement("style");

  style.id =
    "restore-style";

  style.textContent = `
    #restore-full-backup-button {
      background-color: #ef6c00;
    }

    #restore-full-backup-button:disabled {
      background-color: #b0bec5;
      color: #eceff1;
      cursor: not-allowed;
    }
  `;

  document.head.appendChild(
    style
  );
}

async function handleRestoreFileSelection(
  event
) {
  const file =
    event.target.files[0];

  if (!file) {
    return;
  }

  const button =
    document.querySelector(
      "#restore-full-backup-button"
    );

  if (
    file.size >
    50 * 1024 * 1024
  ) {
    alert(
      "選択したファイルが大きすぎます。\n\n" +
      "50MB以下のバックアップファイルを選んでください。"
    );

    event.target.value =
      "";

    return;
  }

  if (button) {
    button.disabled =
      true;

    button.textContent =
      "バックアップを確認しています...";
  }

  try {
    const fileText =
      await readTextFile(
        file
      );

    const backupData =
      JSON.parse(
        fileText
      );

    validateBackupData(
      backupData
    );

    const products =
      backupData.data.products;

    const stockMovements =
      backupData.data.stockMovements;

    const stocktakings =
      backupData.data.stocktakings;

    const backupDateText =
      formatBackupDate(
        backupData.exportedAt
      );

    const firstConfirmed =
      window.confirm(
        "次のバックアップを読み込みます。\n\n" +
        `作成日時：${backupDateText}\n` +
        `商品：${products.length}件\n` +
        `入出庫履歴：${stockMovements.length}件\n` +
        `棚卸履歴：${stocktakings.length}件\n\n` +
        "現在この端末に保存されているデータは、すべて置き換えられます。\n\n" +
        "復元を続けますか？"
      );

    if (!firstConfirmed) {
      return;
    }

    const finalConfirmed =
      window.confirm(
        "最終確認です。\n\n" +
        "現在のデータを消して、選択したバックアップの内容へ置き換えます。\n\n" +
        "この操作を開始した後は元に戻せません。\n" +
        "現在のデータを残したい場合は、先にバックアップしてください。\n\n" +
        "本当に復元しますか？"
      );

    if (!finalConfirmed) {
      return;
    }

    if (button) {
      button.textContent =
        "データを復元しています...";
    }

    await replaceAllDataFromBackup(
      products,
      stockMovements,
      stocktakings
    );

    alert(
      "バックアップから復元しました。\n\n" +
      `商品：${products.length}件\n` +
      `入出庫履歴：${stockMovements.length}件\n` +
      `棚卸履歴：${stocktakings.length}件\n\n` +
      "画面を更新します。"
    );

    window.location.reload();
  } catch (error) {
    console.error(
      "バックアップ復元エラー",
      error
    );

    const message =
      createRestoreErrorMessage(
        error
      );

    alert(
      message
    );
  } finally {
    event.target.value =
      "";

    if (button) {
      button.disabled =
        false;

      button.textContent =
        "バックアップから復元する";
    }
  }
}

function readTextFile(
  file
) {
  return new Promise(function (
    resolve,
    reject
  ) {
    const reader =
      new FileReader();

    reader.onload =
      function () {
        resolve(
          String(
            reader.result || ""
          )
        );
      };

    reader.onerror =
      function () {
        reject(
          new Error(
            "ファイルを読み込めませんでした。"
          )
        );
      };

    reader.readAsText(
      file,
      "UTF-8"
    );
  });
}

function validateBackupData(
  backupData
) {
  if (
    !backupData ||
    typeof backupData !==
      "object"
  ) {
    throw new Error(
      "バックアップの内容が正しくありません。"
    );
  }

  if (
    backupData.backupType !==
      "barcode-inventory-app"
  ) {
    throw new Error(
      "このアプリで作成したバックアップではありません。"
    );
  }

  if (
    backupData.backupVersion !==
      1
  ) {
    throw new Error(
      "対応していないバックアップ形式です。"
    );
  }

  if (
    !backupData.data ||
    typeof backupData.data !==
      "object"
  ) {
    throw new Error(
      "バックアップ内にデータがありません。"
    );
  }

  const products =
    backupData.data.products;

  const stockMovements =
    backupData.data.stockMovements;

  const stocktakings =
    backupData.data.stocktakings;

  if (
    !Array.isArray(
      products
    ) ||
    !Array.isArray(
      stockMovements
    ) ||
    !Array.isArray(
      stocktakings
    )
  ) {
    throw new Error(
      "バックアップのデータ形式が正しくありません。"
    );
  }

  validateProductRecords(
    products
  );

  validateIdRecords(
    stockMovements,
    "入出庫履歴"
  );

  validateIdRecords(
    stocktakings,
    "棚卸履歴"
  );
}

function validateProductRecords(
  products
) {
  const internalCodes =
    new Set();

  products.forEach(
    function (
      product,
      index
    ) {
      if (
        !product ||
        typeof product !==
          "object"
      ) {
        throw new Error(
          `商品${index + 1}件目の内容が正しくありません。`
        );
      }

      const internalCode =
        String(
          product.internalCode || ""
        ).trim();

      if (!internalCode) {
        throw new Error(
          `商品${index + 1}件目に社内コードがありません。`
        );
      }

      if (
        internalCodes.has(
          internalCode
        )
      ) {
        throw new Error(
          `商品データ内で社内コード「${internalCode}」が重複しています。`
        );
      }

      internalCodes.add(
        internalCode
      );
    }
  );
}

function validateIdRecords(
  records,
  recordName
) {
  const ids =
    new Set();

  records.forEach(
    function (
      record,
      index
    ) {
      if (
        !record ||
        typeof record !==
          "object"
      ) {
        throw new Error(
          `${recordName}${index + 1}件目の内容が正しくありません。`
        );
      }

      if (
        record.id ===
          undefined ||
        record.id ===
          null ||
        record.id ===
          ""
      ) {
        throw new Error(
          `${recordName}${index + 1}件目にIDがありません。`
        );
      }

      const idKey =
        String(
          record.id
        );

      if (
        ids.has(
          idKey
        )
      ) {
        throw new Error(
          `${recordName}内でID「${idKey}」が重複しています。`
        );
      }

      ids.add(
        idKey
      );
    }
  );
}

async function replaceAllDataFromBackup(
  products,
  stockMovements,
  stocktakings
) {
  const database =
    await openDatabase();

  return new Promise(function (
    resolve,
    reject
  ) {
    let transaction;

    try {
      transaction =
        database.transaction(
          [
            PRODUCT_STORE_NAME,
            MOVEMENT_STORE_NAME,
            STOCKTAKING_STORE_NAME
          ],
          "readwrite"
        );

      const productStore =
        transaction.objectStore(
          PRODUCT_STORE_NAME
        );

      const movementStore =
        transaction.objectStore(
          MOVEMENT_STORE_NAME
        );

      const stocktakingStore =
        transaction.objectStore(
          STOCKTAKING_STORE_NAME
        );

      productStore.clear();
      movementStore.clear();
      stocktakingStore.clear();

      products.forEach(
        function (product) {
          productStore.put(
            product
          );
        }
      );

      stockMovements.forEach(
        function (movement) {
          movementStore.put(
            movement
          );
        }
      );

      stocktakings.forEach(
        function (stocktaking) {
          stocktakingStore.put(
            stocktaking
          );
        }
      );
    } catch (error) {
      database.close();
      reject(error);
      return;
    }

    transaction.oncomplete =
      function () {
        database.close();
        resolve();
      };

    transaction.onerror =
      function () {
        const error =
          transaction.error ||
          new Error(
            "データの復元中にエラーが発生しました。"
          );

        database.close();
        reject(error);
      };

    transaction.onabort =
      function () {
        const error =
          transaction.error ||
          new Error(
            "データの復元が中断されました。"
          );

        database.close();
        reject(error);
      };
  });
}

function formatBackupDate(
  exportedAt
) {
  if (!exportedAt) {
    return "記録なし";
  }

  const date =
    new Date(
      exportedAt
    );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return String(
      exportedAt
    );
  }

  return date.toLocaleString(
    "ja-JP"
  );
}

function createRestoreErrorMessage(
  error
) {
  if (
    error instanceof
      SyntaxError
  ) {
    return (
      "バックアップファイルを読み込めませんでした。\n\n" +
      "JSONファイルの内容が壊れている可能性があります。\n" +
      "このアプリで保存したバックアップファイルを選んでください。"
    );
  }

  const detail =
    error &&
    error.message
      ? error.message
      : "原因を確認できませんでした。";

  return (
    "バックアップを復元できませんでした。\n\n" +
    detail +
    "\n\n現在のデータは変更されていません。"
  );
}
