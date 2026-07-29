"use strict";

let csvUpdateButton = null;
let csvUpdateBusy = false;
let csvUpdateObserver = null;

const CSV_UPDATE_FIELDS = [
  {
    property: "productCode",
    label: "商品コード",
    normalize: normalizeCsvUpdateCode
  },
  {
    property: "productName",
    label: "商品名",
    normalize: normalizeCsvUpdateText
  },
  {
    property: "janCode",
    label: "JANコード",
    normalize: normalizeCsvUpdateCode
  },
  {
    property: "category",
    label: "カテゴリー",
    normalize: normalizeCsvUpdateText
  },
  {
    property: "supplier",
    label: "仕入れ先名",
    normalize: normalizeCsvUpdateText
  }
];

document.addEventListener(
  "DOMContentLoaded",
  initializeCsvUpdate
);

function initializeCsvUpdate() {
  createCsvUpdateButton();
  createCsvUpdateStyle();
  observeCsvImportPreview();
}

function createCsvUpdateButton() {
  if (
    document.querySelector(
      "#update-existing-csv-products-button"
    )
  ) {
    csvUpdateButton =
      document.querySelector(
        "#update-existing-csv-products-button"
      );

    return;
  }

  const registerButton =
    document.querySelector(
      "#register-new-csv-products-button"
    );

  if (!registerButton) {
    console.error(
      "既存商品更新ボタンを追加する場所が見つかりません。"
    );

    return;
  }

  csvUpdateButton =
    document.createElement("button");

  csvUpdateButton.id =
    "update-existing-csv-products-button";

  csvUpdateButton.type =
    "button";

  csvUpdateButton.disabled =
    true;

  csvUpdateButton.textContent =
    "更新が必要な既存商品はありません";

  csvUpdateButton.addEventListener(
    "click",
    updateExistingCsvProductsFromCsv
  );

  registerButton.insertAdjacentElement(
    "afterend",
    csvUpdateButton
  );
}

function createCsvUpdateStyle() {
  const oldStyle =
    document.querySelector(
      "#csv-update-style"
    );

  if (oldStyle) {
    oldStyle.remove();
  }

  const style =
    document.createElement("style");

  style.id =
    "csv-update-style";

  style.textContent = `
    #update-existing-csv-products-button {
      background-color: #1565c0;
    }

    #update-existing-csv-products-button:disabled {
      background-color: #b0bec5;
      color: #eceff1;
      cursor: not-allowed;
    }
  `;

  document.head.appendChild(
    style
  );
}

function observeCsvImportPreview() {
  const message =
    document.querySelector(
      "#csv-import-message"
    );

  if (!message) {
    console.error(
      "CSV読込結果の表示欄が見つかりません。"
    );

    return;
  }

  if (csvUpdateObserver) {
    csvUpdateObserver.disconnect();
  }

  csvUpdateObserver =
    new MutationObserver(
      function () {
        refreshCsvUpdateButton();
      }
    );

  csvUpdateObserver.observe(
    message,
    {
      childList: true,
      characterData: true,
      subtree: true
    }
  );

  const fileInput =
    document.querySelector(
      "#csv-import-file"
    );

  const clearButton =
    document.querySelector(
      "#clear-csv-import-button"
    );

  if (fileInput) {
    fileInput.addEventListener(
      "change",
      function () {
        csvUpdateButton.disabled =
          true;

        csvUpdateButton.textContent =
          "CSVを確認しています...";
      }
    );
  }

  if (clearButton) {
    clearButton.addEventListener(
      "click",
      resetCsvUpdateButton
    );
  }
}

function resetCsvUpdateButton() {
  if (
    !csvUpdateButton ||
    csvUpdateBusy
  ) {
    return;
  }

  csvUpdateButton.disabled =
    true;

  csvUpdateButton.textContent =
    "更新が必要な既存商品はありません";
}

async function refreshCsvUpdateButton() {
  if (
    !csvUpdateButton ||
    csvUpdateBusy
  ) {
    return;
  }

  if (
    typeof currentCsvImportRows ===
      "undefined" ||
    !Array.isArray(
      currentCsvImportRows
    )
  ) {
    resetCsvUpdateButton();
    return;
  }

  const existingRows =
    currentCsvImportRows.filter(
      function (item) {
        return (
          item.status ===
          "既存"
        );
      }
    );

  if (
    existingRows.length === 0
  ) {
    resetCsvUpdateButton();
    return;
  }

  csvUpdateButton.disabled =
    true;

  csvUpdateButton.textContent =
    "更新内容を確認しています...";

  try {
    const products =
      await getAllProducts();

    const productMap =
      createCsvUpdateProductMap(
        products
      );

    const changedCount =
      existingRows.filter(
        function (item) {
          const product =
            productMap.get(
              normalizeCsvUpdateCompare(
                item.internalCode
              )
            );

          return (
            product &&
            getCsvUpdateChangeNames(
              product,
              item
            ).length > 0
          );
        }
      ).length;

    csvUpdateButton.disabled =
      changedCount === 0;

    csvUpdateButton.textContent =
      changedCount > 0
        ? `変更がある既存商品${changedCount}件を更新する`
        : "更新が必要な既存商品はありません";
  } catch (error) {
    console.error(error);

    csvUpdateButton.disabled =
      true;

    csvUpdateButton.textContent =
      "更新対象を確認できませんでした";
  }
}

async function updateExistingCsvProductsFromCsv() {
  if (csvUpdateBusy) {
    return;
  }

  const existingRows =
    Array.isArray(
      currentCsvImportRows
    )
      ? currentCsvImportRows.filter(
          function (item) {
            return (
              item.status ===
              "既存"
            );
          }
        )
      : [];

  if (
    existingRows.length === 0
  ) {
    alert(
      "更新できる既存商品がありません。"
    );

    return;
  }

  let products;

  try {
    products =
      await getAllProducts();
  } catch (error) {
    console.error(error);

    alert(
      "登録済みの商品を確認できませんでした。"
    );

    return;
  }

  const productMap =
    createCsvUpdateProductMap(
      products
    );

  const updateTargets =
    existingRows
      .map(
        function (item) {
          const product =
            productMap.get(
              normalizeCsvUpdateCompare(
                item.internalCode
              )
            );

          if (!product) {
            return null;
          }

          const changeNames =
            getCsvUpdateChangeNames(
              product,
              item
            );

          if (
            changeNames.length === 0
          ) {
            return null;
          }

          return {
            item:
              item,

            product:
              product,

            changeNames:
              changeNames
          };
        }
      )
      .filter(
        function (target) {
          return Boolean(target);
        }
      );

  if (
    updateTargets.length === 0
  ) {
    alert(
      "CSVと登録済み商品の内容が同じため、更新はありません。"
    );

    refreshCsvUpdateButton();
    return;
  }

  const confirmed =
    window.confirm(
      `変更がある既存商品${updateTargets.length}件を更新します。\n\n` +
      "更新する項目：\n" +
      "・商品コード\n" +
      "・商品名\n" +
      "・JANコード\n" +
      "・カテゴリー\n" +
      "・仕入れ先名\n\n" +
      "現在庫数・最低在庫数・保管場所は変更しません。\n\n" +
      "更新してよろしいですか？"
    );

  if (!confirmed) {
    return;
  }

  setCsvUpdateBusyState(
    true
  );

  let updatedCount =
    0;

  const failedMessages =
    [];

  for (
    const target of updateTargets
  ) {
    const dateTime =
      new Date().toISOString();

    const updatedProduct =
      createCsvUpdatedProduct(
        target.product,
        target.item,
        dateTime
      );

    const movement =
      createCsvUpdateMovement(
        target.product,
        updatedProduct,
        target.changeNames,
        dateTime
      );

    try {
      await recordStockMovement(
        updatedProduct,
        movement
      );

      updatedCount +=
        1;
    } catch (error) {
      console.error(
        "CSV商品更新エラー",
        target.item.internalCode,
        error
      );

      failedMessages.push(
        `${target.item.lineNumber}行目「${target.item.productName}」を更新できませんでした。`
      );
    }
  }

  setCsvUpdateBusyState(
    false
  );

  if (
    updatedCount > 0
  ) {
    let message =
      `${updatedCount}件の商品情報を更新しました。`;

    if (
      failedMessages.length > 0
    ) {
      message +=
        `\n更新できなかった商品：${failedMessages.length}件`;
    }

    message +=
      "\n\n商品一覧を更新します。";

    alert(message);

    window.location.reload();
    return;
  }

  if (
    failedMessages.length > 0
  ) {
    alert(
      "商品情報を更新できませんでした。\n\n" +
      failedMessages
        .slice(0, 5)
        .join("\n")
    );
  }

  refreshCsvUpdateButton();
}

function setCsvUpdateBusyState(
  isBusy
) {
  csvUpdateBusy =
    isBusy;

  if (csvUpdateButton) {
    csvUpdateButton.disabled =
      true;

    csvUpdateButton.textContent =
      isBusy
        ? "既存商品を更新しています..."
        : "更新内容を確認しています...";
  }

  const fileInput =
    document.querySelector(
      "#csv-import-file"
    );

  const registerButton =
    document.querySelector(
      "#register-new-csv-products-button"
    );

  const clearButton =
    document.querySelector(
      "#clear-csv-import-button"
    );

  const homeButton =
    document.querySelector(
      "#back-home-from-csv-import"
    );

  if (fileInput) {
    fileInput.disabled =
      isBusy;
  }

  if (registerButton) {
    if (isBusy) {
      registerButton.disabled =
        true;
    } else {
      const newCount =
        Array.isArray(
          currentCsvImportRows
        )
          ? currentCsvImportRows.filter(
              function (item) {
                return (
                  item.status ===
                  "新規"
                );
              }
            ).length
          : 0;

      registerButton.disabled =
        newCount === 0;
    }
  }

  if (clearButton) {
    clearButton.disabled =
      isBusy;
  }

  if (homeButton) {
    homeButton.disabled =
      isBusy;
  }

  if (!isBusy) {
    refreshCsvUpdateButton();
  }
}

function createCsvUpdateProductMap(
  products
) {
  const map =
    new Map();

  products.forEach(
    function (product) {
      const key =
        normalizeCsvUpdateCompare(
          product.internalCode
        );

      if (key !== "") {
        map.set(
          key,
          product
        );
      }
    }
  );

  return map;
}

function getCsvUpdateChangeNames(
  product,
  item
) {
  const changes =
    [];

  CSV_UPDATE_FIELDS.forEach(
    function (field) {
      const oldValue =
        field.normalize(
          product[
            field.property
          ]
        );

      const newValue =
        field.normalize(
          item[
            field.property
          ]
        );

      if (
        oldValue !==
        newValue
      ) {
        changes.push(
          field.label
        );
      }
    }
  );

  return changes;
}

function createCsvUpdatedProduct(
  product,
  item,
  dateTime
) {
  return {
    ...product,

    internalCode:
      product.internalCode,

    productCode:
      normalizeCsvUpdateCode(
        item.productCode
      ),

    productName:
      normalizeCsvUpdateText(
        item.productName
      ),

    janCode:
      normalizeCsvUpdateCode(
        item.janCode
      ),

    category:
      normalizeCsvUpdateText(
        item.category
      ),

    supplier:
      normalizeCsvUpdateText(
        item.supplier
      ),

    stock:
      getCsvUpdateStockNumber(
        product.stock
      ),

    minStock:
      getCsvUpdateStockNumber(
        product.minStock
      ),

    location:
      normalizeCsvUpdateText(
        product.location
      ),

    createdAt:
      product.createdAt ||
      dateTime,

    updatedAt:
      dateTime
  };
}

function createCsvUpdateMovement(
  oldProduct,
  updatedProduct,
  changeNames,
  dateTime
) {
  const stock =
    getCsvUpdateStockNumber(
      oldProduct.stock
    );

  return {
    id:
      createCsvUpdateId(
        "movement"
      ),

    dateTime:
      dateTime,

    internalCode:
      oldProduct.internalCode,

    productCode:
      updatedProduct.productCode,

    janCode:
      updatedProduct.janCode,

    productName:
      updatedProduct.productName,

    type:
      "データ修正",

    quantity: 0,

    beforeStock:
      stock,

    afterStock:
      stock,

    person:
      "CSV読込",

    staff:
      "CSV読込",

    reason:
      "社内商品マスタCSV更新",

    memo:
      `更新項目：${changeNames.join("、")}`
  };
}

function normalizeCsvUpdateText(
  value
) {
  return String(
    value === undefined ||
    value === null
      ? ""
      : value
  )
    .normalize("NFKC")
    .trim();
}

function normalizeCsvUpdateCode(
  value
) {
  let text =
    normalizeCsvUpdateText(
      value
    );

  const excelFormula =
    text.match(
      /^="([\s\S]*)"$/
    );

  if (excelFormula) {
    text =
      excelFormula[1]
        .replace(
          /""/g,
          '"'
        );
  }

  if (
    text.startsWith("'")
  ) {
    text =
      text.slice(1);
  }

  return text.trim();
}

function normalizeCsvUpdateCompare(
  value
) {
  return normalizeCsvUpdateText(
    value
  ).toLowerCase();
}

function getCsvUpdateStockNumber(
  value
) {
  const number =
    Number(value);

  if (
    !Number.isFinite(number) ||
    number < 0
  ) {
    return 0;
  }

  return Math.trunc(
    number
  );
}

function createCsvUpdateId(
  prefix
) {
  if (
    window.crypto &&
    typeof window.crypto.randomUUID ===
      "function"
  ) {
    return (
      `${prefix}-${window.crypto.randomUUID()}`
    );
  }

  return (
    `${prefix}-${Date.now()}-` +
    `${Math.random().toString(36).slice(2)}`
  );
}