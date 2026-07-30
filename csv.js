"use strict";

let exportProductsCsvButton = null;
let exportMovementsCsvButton = null;
let exportStocktakingCsvButton = null;

document.addEventListener(
  "DOMContentLoaded",
  initializeCsvFunctions
);

function initializeCsvFunctions() {
  createProductsCsvButton();
  createMovementsCsvButton();
  createStocktakingCsvButton();
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

function createStocktakingCsvButton() {
  const existingButton =
    document.querySelector(
      "#export-stocktaking-csv-button"
    );

  if (existingButton) {
    exportStocktakingCsvButton =
      existingButton;

    exportStocktakingCsvButton.addEventListener(
      "click",
      exportStocktakingCsv
    );

    return;
  }

  const referenceButton =
    exportMovementsCsvButton ||
    exportProductsCsvButton ||
    document.querySelector(
      "#show-stocktaking-history-button"
    );

  if (!referenceButton) {
    console.error(
      "棚卸結果CSVボタンを追加する場所が見つかりません。"
    );

    return;
  }

  exportStocktakingCsvButton =
    document.createElement("button");

  exportStocktakingCsvButton.id =
    "export-stocktaking-csv-button";

  exportStocktakingCsvButton.type =
    "button";

  exportStocktakingCsvButton.textContent =
    "棚卸結果CSVを出力する";

  exportStocktakingCsvButton.addEventListener(
    "click",
    exportStocktakingCsv
  );

  referenceButton.parentElement.appendChild(
    exportStocktakingCsvButton
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

    #export-stocktaking-csv-button {
      background-color: #6a1b9a;
    }

    #export-products-csv-button:disabled,
    #export-movements-csv-button:disabled,
    #export-stocktaking-csv-button:disabled {
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

async function exportStocktakingCsv() {
  if (!exportStocktakingCsvButton) {
    return;
  }

  exportStocktakingCsvButton.disabled =
    true;

  exportStocktakingCsvButton.textContent =
    "CSVを作成しています";

  try {
    const [
      stocktakingSessions,
      products
    ] = await Promise.all([
      loadAllStocktakingSessionsForCsv(),
      getAllProducts()
    ]);

    const completedSessions =
      stocktakingSessions.filter(
        function (session) {
          return (
            session.status ===
            "確定済み"
          );
        }
      );

    if (
      completedSessions.length === 0
    ) {
      alert(
        "CSVへ出力できる確定済みの棚卸がありません。\n\n" +
        "棚卸を開始し、すべての実在庫を入力して確定してください。"
      );

      return;
    }

    completedSessions.sort(
      function (
        sessionA,
        sessionB
      ) {
        return (
          getCsvDateTimeNumber(
            sessionB.confirmedAt ||
            sessionB.updatedAt
          ) -
          getCsvDateTimeNumber(
            sessionA.confirmedAt ||
            sessionA.updatedAt
          )
        );
      }
    );

    const latestStocktaking =
      completedSessions[0];

    const stocktakingItems =
      Array.isArray(
        latestStocktaking.items
      )
        ? [...latestStocktaking.items]
        : [];

    if (
      stocktakingItems.length === 0
    ) {
      alert(
        "最新の確定済み棚卸に商品データがありません。"
      );

      return;
    }

    stocktakingItems.sort(
      function (
        itemA,
        itemB
      ) {
        return String(
          itemA.internalCode || ""
        ).localeCompare(
          String(
            itemB.internalCode || ""
          ),
          "ja"
        );
      }
    );

    const productMap =
      createProductMap(
        products
      );

    const reflectedText =
      latestStocktaking
        .reflectedToInventory
        ? "反映済み"
        : "未反映";

    const csvRows = [
      [
        "棚卸日",
        "JANコード",
        "社内コード",
        "商品コード",
        "商品名",
        "登録在庫",
        "実在庫合計",
        "差異",
        "登録保管場所",
        "場所別実在庫",
        "担当者",
        "結果",
        "在庫反映",
        "メモ"
      ]
    ];

    stocktakingItems.forEach(
      function (item) {
        const currentProduct =
          productMap.get(
            item.internalCode
          );

        const janCode =
          item.janCode ||
          currentProduct?.janCode ||
          "";

        const registeredStock =
          getCsvStockNumber(
            item.registeredStock
          );

        const actualStock =
          getCsvStocktakingActualStock(
            item.actualStock
          );

        const difference =
          getCsvStocktakingDifference(
            registeredStock,
            actualStock
          );

        const result =
          getCsvStocktakingResult(
            difference,
            actualStock
          );

        csvRows.push([
          getCsvText(
            latestStocktaking.stocktakingDate
          ),

          formatCodeForExcel(
            janCode
          ),

          formatCodeForExcel(
            item.internalCode
          ),

          formatCodeForExcel(
            item.productCode
          ),

          getCsvText(
            item.productName
          ),

          registeredStock,

          actualStock === ""
            ? ""
            : actualStock,

          difference === null
            ? ""
            : difference,

          getCsvText(
            item.location
          ),

          getCsvText(
            formatCsvLocationBreakdown(
              item
            )
          ),

          getCsvText(
            latestStocktaking.person
          ),

          result,

          reflectedText,

          getCsvText(
            item.memo
          )
        ]);
      }
    );

    const csvText =
      createCsvText(
        csvRows
      );

    const fileName =
      `棚卸結果_${getCsvDateText()}.csv`;

    downloadCsvFile(
      csvText,
      fileName
    );

    alert(
      `${stocktakingItems.length}件の棚卸結果をCSVへ出力しました。\n\n` +
      `棚卸日：${latestStocktaking.stocktakingDate}\n` +
      `担当者：${latestStocktaking.person}\n` +
      `ファイル名：${fileName}`
    );
  } catch (error) {
    console.error(error);

    alert(
      "棚卸結果CSVを作成できませんでした。\n\n" +
      "棚卸履歴とブラウザーの設定を確認してください。"
    );
  } finally {
    exportStocktakingCsvButton.disabled =
      false;

    exportStocktakingCsvButton.textContent =
      "棚卸結果CSVを出力する";
  }
}

async function loadAllStocktakingSessionsForCsv() {
  const database =
    await openDatabase();

  return new Promise(
    function (
      resolve,
      reject
    ) {
      const transaction =
        database.transaction(
          "stocktakings",
          "readonly"
        );

      const stocktakingStore =
        transaction.objectStore(
          "stocktakings"
        );

      const request =
        stocktakingStore.getAll();

      let stocktakingSessions = [];

      request.onsuccess =
        function () {
          stocktakingSessions =
            request.result || [];
        };

      transaction.oncomplete =
        function () {
          database.close();

          resolve(
            stocktakingSessions
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
    }
  );
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

function formatCsvLocationBreakdown(
  item
) {
  const entries =
    Array.isArray(
      item.locationBreakdown
    )
      ? item.locationBreakdown
      : [];

  const breakdownText =
    entries
      .filter(
        function (entry) {
          const location =
            String(
              entry.location || ""
            ).trim();

          const quantity =
            Number(
              entry.quantity
            );

          return (
            location !== "" &&
            Number.isInteger(
              quantity
            ) &&
            quantity >= 0
          );
        }
      )
      .map(
        function (entry) {
          return (
            `${String(entry.location).trim()}：` +
            `${Number(entry.quantity)}個`
          );
        }
      )
      .join(" / ");

  if (breakdownText !== "") {
    return breakdownText;
  }

  const actualStock =
    getCsvStocktakingActualStock(
      item.actualStock
    );

  if (actualStock === "") {
    return "";
  }

  return (
    `${getCsvText(item.location) || "場所未登録"}：` +
    `${actualStock}個`
  );
}

function getCsvStocktakingActualStock(
  value
) {
  if (
    value === "" ||
    value === null ||
    value === undefined
  ) {
    return "";
  }

  const number =
    Number(value);

  if (
    !Number.isInteger(number) ||
    number < 0
  ) {
    return "";
  }

  return number;
}

function getCsvStocktakingDifference(
  registeredStock,
  actualStock
) {
  if (actualStock === "") {
    return null;
  }

  return (
    actualStock -
    registeredStock
  );
}

function getCsvStocktakingResult(
  difference,
  actualStock
) {
  if (
    actualStock === "" ||
    difference === null
  ) {
    return "未確認";
  }

  if (difference === 0) {
    return "差異なし";
  }

  if (difference < 0) {
    return "在庫不足";
  }

  return "在庫過剰";
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