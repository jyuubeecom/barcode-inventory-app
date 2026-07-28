"use strict";

let exportProductsCsvButton = null;
let exportMovementsCsvButton = null;

document.addEventListener(
  "DOMContentLoaded",
  initializeCsvFunctions
);

function initializeCsvFunctions() {
  createProductsCsvButton();
  createMovementsCsvButton();
  createCsvButtonStyle();
}

function createProductsCsvButton() {
  const existingButton =
    document.querySelector(
      "#export-products-csv-button"
    );

  if (existingButton) {
    exportProductsCsvButton =
      existingButton;

    exportProductsCsvButton.addEventListener(
      "click",
      exportProductsCsv
    );

    return;
  }

  const referenceButton =
    document.querySelector(
      "#show-stocktaking-history-button"
    ) ||
    document.querySelector(
      "#show-stocktaking-button"
    ) ||
    document.querySelector(
      "#show-history-button"
    );

  if (!referenceButton) {
    console.error(
      "商品一覧CSVボタンを追加する場所が見つかりません。"
    );

    return;
  }

  exportProductsCsvButton =
    document.createElement("button");

  exportProductsCsvButton.id =
    "export-products-csv-button";

  exportProductsCsvButton.type =
    "button";

  exportProductsCsvButton.textContent =
    "商品一覧CSVを出力する";

  exportProductsCsvButton.addEventListener(
    "click",
    exportProductsCsv
  );

  referenceButton.parentElement.appendChild(
    exportProductsCsvButton
  );
}

function createMovementsCsvButton() {
  const existingButton =
    document.querySelector(
      "#export-movements-csv-button"
    );

  if (existingButton) {
    exportMovementsCsvButton =
      existingButton;

    exportMovementsCsvButton.addEventListener(
      "click",
      exportMovementsCsv
    );

    return;
  }

  const referenceButton =
    exportProductsCsvButton ||
    document.querySelector(
      "#show-history-button"
    );

  if (!referenceButton) {
    console.error(
      "入出庫履歴CSVボタンを追加する場所が見つかりません。"
    );

    return;
  }

  exportMovementsCsvButton =
    document.createElement("button");

  exportMovementsCsvButton.id =
    "export-movements-csv-button";

  exportMovementsCsvButton.type =
    "button";

  exportMovementsCsvButton.textContent =
    "入出庫履歴CSVを出力する";

  exportMovementsCsvButton.addEventListener(
    "click",
    exportMovementsCsv
  );

  referenceButton.parentElement.appendChild(
    exportMovementsCsvButton
  );
}

function createCsvButtonStyle() {
  const existingStyle =
    document.querySelector(
      "#csv-function-style"
    );

  if (existingStyle) {
    existingStyle.remove();
  }

  const styleElement =
    document.createElement("style");

  styleElement.id =
    "csv-function-style";

  styleElement.textContent = `
    #export-products-csv-button {
      background-color: #00796b;
    }

    #export-movements-csv-button {
      background-color: #5d4037;
    }

    #export-products-csv-button:disabled,
    #export-movements-csv-button:disabled {
      background-color: #90a4ae;
      cursor: not-allowed;
    }
  `;

  document.head.appendChild(
    styleElement
  );
}

async function exportProductsCsv() {
  if (!exportProductsCsvButton) {
    return;
  }

  exportProductsCsvButton.disabled =
    true;

  exportProductsCsvButton.textContent =
    "CSVを作成しています";

  try {
    const products =
      await getAllProducts();

    if (
      !Array.isArray(products) ||
      products.length === 0
    ) {
      alert(
        "CSVへ出力する商品がありません。\n\n" +
        "商品を1件以上登録してください。"
      );

      return;
    }

    const sortedProducts =
      [...products].sort(
        function (
          productA,
          productB
        ) {
          return String(
            productA.internalCode || ""
          ).localeCompare(
            String(
              productB.internalCode || ""
            ),
            "ja"
          );
        }
      );

    const csvRows = [
      [
        "社内コード",
        "商品コード",
        "商品名",
        "JANコード",
        "カテゴリー",
        "現在庫数",
        "最低在庫数",
        "在庫状態",
        "保管場所",
        "仕入先",
        "登録日",
        "更新日"
      ]
    ];

    sortedProducts.forEach(
      function (product) {
        csvRows.push([
          formatCodeForExcel(
            product.internalCode
          ),

          formatCodeForExcel(
            product.productCode
          ),

          getCsvText(
            product.productName
          ),

          formatCodeForExcel(
            product.janCode
          ),

          getCsvText(
            product.category
          ),

          getCsvStockNumber(
            product.stock
          ),

          getCsvStockNumber(
            product.minStock
          ),

          getCsvStockStatus(
            product
          ),

          getCsvText(
            product.location
          ),

          getCsvText(
            product.supplier
          ),

          formatCsvDateTime(
            product.createdAt ||
            product.registeredAt
          ),

          formatCsvDateTime(
            product.updatedAt
          )
        ]);
      }
    );

    const csvText =
      createCsvText(
        csvRows
      );

    const fileName =
      `商品一覧_${getCsvDateText()}.csv`;

    downloadCsvFile(
      csvText,
      fileName
    );

    alert(
      `${sortedProducts.length}件の商品をCSVへ出力しました。\n\n` +
      `ファイル名：${fileName}`
    );
  } catch (error) {
    console.error(error);

    alert(
      "商品一覧CSVを作成できませんでした。\n\n" +
      "商品データとブラウザーの設定を確認してください。"
    );
  } finally {
    exportProductsCsvButton.disabled =
      false;

    exportProductsCsvButton.textContent =
      "商品一覧CSVを出力する";
  }
}

async function exportMovementsCsv() {
  if (!exportMovementsCsvButton) {
    return;
  }

  exportMovementsCsvButton.disabled =
    true;

  exportMovementsCsvButton.textContent =
    "CSVを作成しています";

  try {
    const [
      movements,
      products
    ] = await Promise.all([
      getAllStockMovements(),
      getAllProducts()
    ]);

    if (
      !Array.isArray(movements) ||
      movements.length === 0
    ) {
      alert(
        "CSVへ出力する入出庫履歴がありません。\n\n" +
        "商品登録、入庫、出庫などを行ってください。"
      );

      return;
    }

    const productMap =
      createProductMap(
        products
      );

    const sortedMovements =
      [...movements].sort(
        function (
          movementA,
          movementB
        ) {
          return (
            getCsvDateTimeNumber(
              movementB.dateTime
            ) -
            getCsvDateTimeNumber(
              movementA.dateTime
            )
          );
        }
      );

    const csvRows = [
      [
        "日時",
        "JANコード",
        "社内コード",
        "商品コード",
        "商品名",
        "区分",
        "数量",
        "変更前在庫",
        "変更後在庫",
        "担当者",
        "理由",
        "メモ"
      ]
    ];

    sortedMovements.forEach(
      function (movement) {
        const product =
          productMap.get(
            movement.internalCode
          );

        const janCode =
          movement.janCode ||
          product?.janCode ||
          "";

        csvRows.push([
          formatCsvDateTime(
            movement.dateTime
          ),

          formatCodeForExcel(
            janCode
          ),

          formatCodeForExcel(
            movement.internalCode
          ),

          formatCodeForExcel(
            movement.productCode
          ),

          getCsvText(
            movement.productName
          ),

          getCsvText(
            movement.type
          ),

          getCsvInteger(
            movement.quantity
          ),

          getCsvStockNumber(
            movement.beforeStock
          ),

          getCsvStockNumber(
            movement.afterStock
          ),

          getCsvText(
            movement.person
          ),

          getCsvText(
            movement.reason
          ),

          getCsvText(
            movement.memo
          )
        ]);
      }
    );

    const csvText =
      createCsvText(
        csvRows
      );

    const fileName =
      `入出庫履歴_${getCsvDateText()}.csv`;

    downloadCsvFile(
      csvText,
      fileName
    );

    alert(
      `${sortedMovements.length}件の入出庫履歴をCSVへ出力しました。\n\n` +
      `ファイル名：${fileName}`
    );
  } catch (error) {
    console.error(error);

    alert(
      "入出庫履歴CSVを作成できませんでした。\n\n" +
      "入出庫履歴とブラウザーの設定を確認してください。"
    );
  } finally {
    exportMovementsCsvButton.disabled =
      false;

    exportMovementsCsvButton.textContent =
      "入出庫履歴CSVを出力する";
  }
}

function createProductMap(products) {
  const productMap =
    new Map();

  if (!Array.isArray(products)) {
    return productMap;
  }

  products.forEach(
    function (product) {
      productMap.set(
        product.internalCode,
        product
      );
    }
  );

  return productMap;
}

function createCsvText(rows) {
  return rows
    .map(
      function (row) {
        return row
          .map(
            escapeCsvValue
          )
          .join(",");
      }
    )
    .join("\r\n");
}

function escapeCsvValue(value) {
  const text =
    value === null ||
    value === undefined
      ? ""
      : String(value);

  const escapedText =
    text.replace(
      /"/g,
      '""'
    );

  return `"${escapedText}"`;
}

function formatCodeForExcel(value) {
  const text =
    getCsvText(value);

  if (text === "") {
    return "";
  }

  const escapedCode =
    text.replace(
      /"/g,
      '""'
    );

  return `="${escapedCode}"`;
}

function getCsvText(value) {
  if (
    value === null ||
    value === undefined
  ) {
    return "";
  }

  return String(value).trim();
}

function getCsvInteger(value) {
  const number =
    Number(value);

  if (
    !Number.isFinite(number)
  ) {
    return 0;
  }

  return Math.trunc(number);
}

function getCsvStockNumber(value) {
  const number =
    Number(value);

  if (
    !Number.isFinite(number) ||
    number < 0
  ) {
    return 0;
  }

  return Math.floor(number);
}

function getCsvMinimumStock(product) {
  return getCsvStockNumber(
    product.minStock
  );
}

function getCsvStockStatus(product) {
  const currentStock =
    getCsvStockNumber(
      product.stock
    );

  const minimumStock =
    getCsvMinimumStock(
      product
    );

  if (currentStock === 0) {
    return "在庫切れ";
  }

  if (
    minimumStock > 0 &&
    currentStock <= minimumStock
  ) {
    return "要補充";
  }

  return "正常";
}

function formatCsvDateTime(value) {
  if (!value) {
    return "";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return String(value);
  }

  const year =
    date.getFullYear();

  const month =
    String(
      date.getMonth() + 1
    ).padStart(2, "0");

  const day =
    String(
      date.getDate()
    ).padStart(2, "0");

  const hours =
    String(
      date.getHours()
    ).padStart(2, "0");

  const minutes =
    String(
      date.getMinutes()
    ).padStart(2, "0");

  const seconds =
    String(
      date.getSeconds()
    ).padStart(2, "0");

  return (
    `${year}-${month}-${day} ` +
    `${hours}:${minutes}:${seconds}`
  );
}

function getCsvDateTimeNumber(value) {
  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return 0;
  }

  return date.getTime();
}

function getCsvDateText() {
  const today =
    new Date();

  const year =
    today.getFullYear();

  const month =
    String(
      today.getMonth() + 1
    ).padStart(2, "0");

  const day =
    String(
      today.getDate()
    ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function downloadCsvFile(
  csvText,
  fileName
) {
  const utf8Bom =
    "\uFEFF";

  const blob =
    new Blob(
      [
        utf8Bom,
        csvText
      ],
      {
        type:
          "text/csv;charset=utf-8"
      }
    );

  const downloadUrl =
    URL.createObjectURL(
      blob
    );

  const downloadLink =
    document.createElement("a");

  downloadLink.href =
    downloadUrl;

  downloadLink.download =
    fileName;

  downloadLink.style.display =
    "none";

  document.body.appendChild(
    downloadLink
  );

  downloadLink.click();

  downloadLink.remove();

  window.setTimeout(
    function () {
      URL.revokeObjectURL(
        downloadUrl
      );
    },
    1000
  );
}