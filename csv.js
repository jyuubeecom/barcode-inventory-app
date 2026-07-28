"use strict";

let exportProductsCsvButton = null;

document.addEventListener(
  "DOMContentLoaded",
  initializeCsvFunctions
);

function initializeCsvFunctions() {
  createProductsCsvButton();
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
      "CSVボタンを追加する場所が見つかりません。"
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

    #export-products-csv-button:disabled {
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

          getCsvNumber(
            product.stock
          ),

          getCsvNumber(
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

function getCsvNumber(value) {
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
  return getCsvNumber(
    product.minStock
  );
}

function getCsvStockStatus(product) {
  const currentStock =
    getCsvNumber(
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