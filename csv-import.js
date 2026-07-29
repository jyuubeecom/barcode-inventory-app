"use strict";

let csvImportScreen = null;
let csvImportFileInput = null;
let csvImportMessage = null;
let csvImportErrors = null;
let csvImportPreviewBody = null;

const REQUIRED_CSV_HEADERS = [
  "社内コード",
  "商品コード",
  "商品名",
  "現在庫数",
  "仕入先"
];

document.addEventListener(
  "DOMContentLoaded",
  initializeCsvImport
);

function initializeCsvImport() {
  createCsvImportButton();
  createCsvImportScreen();
  createCsvImportStyle();
}

function createCsvImportButton() {
  if (
    document.querySelector(
      "#show-csv-import-button"
    )
  ) {
    return;
  }

  const referenceButton =
    document.querySelector(
      "#export-stocktaking-csv-button"
    ) ||
    document.querySelector(
      "#export-movements-csv-button"
    ) ||
    document.querySelector(
      "#export-products-csv-button"
    ) ||
    document.querySelector(
      "#show-history-button"
    );

  if (!referenceButton) {
    console.error(
      "CSV読込ボタンを追加する場所が見つかりません。"
    );

    return;
  }

  const button =
    document.createElement("button");

  button.id =
    "show-csv-import-button";

  button.type =
    "button";

  button.textContent =
    "商品一覧CSVを読み込む";

  button.addEventListener(
    "click",
    openCsvImportScreen
  );

  referenceButton.parentElement.appendChild(
    button
  );
}

function createCsvImportScreen() {
  const oldScreen =
    document.querySelector(
      "#csv-import-screen"
    );

  if (oldScreen) {
    oldScreen.remove();
  }

  csvImportScreen =
    document.createElement("section");

  csvImportScreen.id =
    "csv-import-screen";

  csvImportScreen.hidden =
    true;

  csvImportScreen.innerHTML = `
    <h2>商品一覧CSV読込</h2>

    <p class="csv-import-notice">
      今回は、CSVの内容をプレビューしてエラーを確認します。
      この画面では、まだ商品は登録されません。
    </p>

    <div class="csv-import-file-area">
      <label for="csv-import-file">
        商品一覧CSVを選択
      </label>

      <input
        id="csv-import-file"
        type="file"
        accept=".csv,text/csv"
      >
    </div>

    <p
      id="csv-import-message"
      class="csv-import-message"
    >
      CSVファイルを選択してください。
    </p>

    <div
      id="csv-import-errors"
      class="csv-import-errors"
      hidden
    ></div>

    <div class="csv-import-table-area">
      <table class="csv-import-table">
        <thead>
          <tr>
            <th>行</th>
            <th>判定</th>
            <th>社内コード</th>
            <th>商品コード</th>
            <th>商品名</th>
            <th>JANコード</th>
            <th>現在庫数</th>
            <th>最低在庫数</th>
            <th>カテゴリー</th>
            <th>保管場所</th>
            <th>仕入先</th>
            <th>確認内容</th>
          </tr>
        </thead>

        <tbody id="csv-import-preview-body">
          <tr>
            <td colspan="12">
              CSVを選択すると、ここに内容が表示されます。
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <button
      id="clear-csv-import-button"
      type="button"
    >
      選択をやり直す
    </button>

    <button
      id="back-home-from-csv-import"
      type="button"
    >
      ホームへ戻る
    </button>
  `;

  document
    .querySelector("main")
    .appendChild(
      csvImportScreen
    );

  csvImportFileInput =
    document.querySelector(
      "#csv-import-file"
    );

  csvImportMessage =
    document.querySelector(
      "#csv-import-message"
    );

  csvImportErrors =
    document.querySelector(
      "#csv-import-errors"
    );

  csvImportPreviewBody =
    document.querySelector(
      "#csv-import-preview-body"
    );

  csvImportFileInput.addEventListener(
    "change",
    handleCsvFileSelection
  );

  document
    .querySelector(
      "#clear-csv-import-button"
    )
    .addEventListener(
      "click",
      resetCsvImportScreen
    );

  document
    .querySelector(
      "#back-home-from-csv-import"
    )
    .addEventListener(
      "click",
      returnHomeFromCsvImport
    );
}

function createCsvImportStyle() {
  const oldStyle =
    document.querySelector(
      "#csv-import-style"
    );

  if (oldStyle) {
    oldStyle.remove();
  }

  const style =
    document.createElement("style");

  style.id =
    "csv-import-style";

  style.textContent = `
    #show-csv-import-button {
      background-color: #0277bd;
    }

    .csv-import-notice,
    .csv-import-message {
      padding: 12px;
      border-radius: 8px;
      background-color: #e3f2fd;
      font-weight: bold;
    }

    .csv-import-file-area {
      margin: 18px 0;
      padding: 16px;
      border: 2px solid #90caf9;
      border-radius: 10px;
      background-color: #f7fbff;
    }

    .csv-import-errors {
      margin: 15px 0;
      padding: 14px;
      border: 2px solid #c62828;
      border-radius: 8px;
      background-color: #ffebee;
      color: #b71c1c;
    }

    .csv-import-errors ul {
      margin-bottom: 0;
    }

    .csv-import-table-area {
      width: 100%;
      overflow-x: auto;
      margin: 18px 0;
    }

    .csv-import-table {
      width: 100%;
      min-width: 1500px;
      border-collapse: collapse;
    }

    .csv-import-table th,
    .csv-import-table td {
      padding: 9px;
      border: 1px solid #cfd8dc;
      text-align: left;
      vertical-align: middle;
    }

    .csv-import-table th {
      background-color: #0277bd;
      color: #ffffff;
      white-space: nowrap;
    }

    .csv-import-row-new {
      background-color: #e8f5e9;
    }

    .csv-import-row-existing {
      background-color: #fff8e1;
    }

    .csv-import-row-error {
      background-color: #ffebee;
    }

    .csv-import-badge {
      display: inline-block;
      min-width: 70px;
      padding: 5px 9px;
      border-radius: 20px;
      text-align: center;
      font-weight: bold;
      white-space: nowrap;
    }

    .csv-import-badge-new {
      background-color: #c8e6c9;
      color: #1b5e20;
    }

    .csv-import-badge-existing {
      background-color: #ffe0b2;
      color: #e65100;
    }

    .csv-import-badge-error {
      background-color: #ffcdd2;
      color: #b71c1c;
    }

    #clear-csv-import-button {
      background-color: #ef6c00;
    }

    #back-home-from-csv-import {
      background-color: #546e7a;
    }

    @media (max-width: 700px) {
      #csv-import-screen > button {
        width: 100%;
        margin: 6px 0;
      }
    }
  `;

  document.head.appendChild(
    style
  );
}

function openCsvImportScreen() {
  hideAllScreensForCsvImport();

  csvImportScreen.hidden =
    false;

  resetCsvImportScreen();

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

function resetCsvImportScreen() {
  csvImportFileInput.value =
    "";

  csvImportMessage.textContent =
    "CSVファイルを選択してください。";

  csvImportErrors.hidden =
    true;

  csvImportErrors.innerHTML =
    "";

  csvImportPreviewBody.innerHTML = `
    <tr>
      <td colspan="12">
        CSVを選択すると、ここに内容が表示されます。
      </td>
    </tr>
  `;
}

async function handleCsvFileSelection() {
  const file =
    csvImportFileInput.files[0];

  if (!file) {
    resetCsvImportScreen();
    return;
  }

  if (
    !file.name
      .toLowerCase()
      .endsWith(".csv")
  ) {
    alert(
      "CSVファイルを選択してください。"
    );

    resetCsvImportScreen();
    return;
  }

  csvImportMessage.textContent =
    `「${file.name}」を確認しています。`;

  csvImportErrors.hidden =
    true;

  csvImportErrors.innerHTML =
    "";

  try {
    const csvText =
      await readCsvFile(file);

    const parsedRows =
      parseCsvText(csvText);

    const previewResult =
      await createCsvPreviewResult(
        parsedRows
      );

    displayCsvPreview(
      previewResult
    );
  } catch (error) {
    console.error(error);

    csvImportMessage.textContent =
      "CSVファイルを読み込めませんでした。";

    showCsvImportErrors([
      "CSVの形式が正しいか確認してください。",
      "ダブルクォーテーションが途中で切れていないか確認してください。"
    ]);

    csvImportPreviewBody.innerHTML = `
      <tr>
        <td colspan="12">
          CSVファイルを読み込めませんでした。
        </td>
      </tr>
    `;
  }
}

function readCsvFile(file) {
  return new Promise(function (
    resolve,
    reject
  ) {
    const reader =
      new FileReader();

    reader.onload = function () {
      resolve(
        String(
          reader.result || ""
        )
      );
    };

    reader.onerror = function () {
      reject(
        reader.error
      );
    };

    reader.readAsText(
      file,
      "UTF-8"
    );
  });
}

function parseCsvText(csvText) {
  const text =
    String(csvText || "")
      .replace(
        /^\uFEFF/,
        ""
      );

  const rows = [];

  let row = [];
  let value = "";
  let insideQuotes = false;

  for (
    let index = 0;
    index < text.length;
    index += 1
  ) {
    const character =
      text[index];

    const nextCharacter =
      text[index + 1];

    if (character === '"') {
      if (
        insideQuotes &&
        nextCharacter === '"'
      ) {
        value += '"';
        index += 1;
      } else {
        insideQuotes =
          !insideQuotes;
      }

      continue;
    }

    if (
      character === "," &&
      !insideQuotes
    ) {
      row.push(value);
      value = "";
      continue;
    }

    if (
      (
        character === "\n" ||
        character === "\r"
      ) &&
      !insideQuotes
    ) {
      if (
        character === "\r" &&
        nextCharacter === "\n"
      ) {
        index += 1;
      }

      row.push(value);

      if (
        row.some(
          function (cell) {
            return (
              String(cell).trim() !== ""
            );
          }
        )
      ) {
        rows.push(row);
      }

      row = [];
      value = "";
      continue;
    }

    value += character;
  }

  if (insideQuotes) {
    throw new Error(
      "CSV_QUOTES_NOT_CLOSED"
    );
  }

  row.push(value);

  if (
    row.some(
      function (cell) {
        return (
          String(cell).trim() !== ""
        );
      }
    )
  ) {
    rows.push(row);
  }

  return rows;
}

async function createCsvPreviewResult(
  parsedRows
) {
  const result = {
    rows: [],
    errors: []
  };

  if (
    !Array.isArray(parsedRows) ||
    parsedRows.length < 2
  ) {
    result.errors.push(
      "CSVに商品データがありません。"
    );

    return result;
  }

  const headerMap =
    createHeaderMap(
      parsedRows[0]
    );

  REQUIRED_CSV_HEADERS.forEach(
    function (header) {
      if (!headerMap.has(header)) {
        result.errors.push(
          `項目名「${header}」がありません。`
        );
      }
    }
  );

  if (
    result.errors.length > 0
  ) {
    return result;
  }

  const existingProducts =
    await getAllProducts();

  const existingInternalCodes =
    new Set();

  const existingProductCodes =
    new Set();

  const existingJanCodes =
    new Set();

  existingProducts.forEach(
    function (product) {
      existingInternalCodes.add(
        normalizeCompareText(
          product.internalCode
        )
      );

      existingProductCodes.add(
        normalizeCompareText(
          product.productCode
        )
      );

      const janCode =
        normalizeCompareText(
          product.janCode
        );

      if (janCode !== "") {
        existingJanCodes.add(
          janCode
        );
      }
    }
  );

  const convertedRows =
    parsedRows
      .slice(1)
      .map(
        function (row, index) {
          return createPreviewItem(
            row,
            headerMap,
            index + 2
          );
        }
      );

  const internalCodeCounts =
    countPreviewValues(
      convertedRows,
      "internalCode"
    );

  const productCodeCounts =
    countPreviewValues(
      convertedRows,
      "productCode"
    );

  const janCodeCounts =
    countPreviewValues(
      convertedRows,
      "janCode",
      true
    );

  convertedRows.forEach(
    function (item) {
      validatePreviewItem(
        item,
        internalCodeCounts,
        productCodeCounts,
        janCodeCounts,
        existingInternalCodes,
        existingProductCodes,
        existingJanCodes
      );
    }
  );

  result.rows =
    convertedRows;

  return result;
}

function createHeaderMap(
  headerRow
) {
  const headerMap =
    new Map();

  headerRow.forEach(
    function (header, index) {
      const normalizedHeader =
        String(header || "")
          .replace(
            /^\uFEFF/,
            ""
          )
          .normalize("NFKC")
          .trim();

      if (
        normalizedHeader !== ""
      ) {
        headerMap.set(
          normalizedHeader,
          index
        );
      }
    }
  );

  if (
    headerMap.has(
      "初期在庫数"
    ) &&
    !headerMap.has(
      "現在庫数"
    )
  ) {
    headerMap.set(
      "現在庫数",
      headerMap.get(
        "初期在庫数"
      )
    );
  }

  return headerMap;
}

function createPreviewItem(
  row,
  headerMap,
  lineNumber
) {
  return {
    lineNumber:
      lineNumber,

    internalCode:
      getImportCode(
        getCell(
          row,
          headerMap,
          "社内コード"
        )
      ),

    productCode:
      getImportCode(
        getCell(
          row,
          headerMap,
          "商品コード"
        )
      ),

    productName:
      getImportText(
        getCell(
          row,
          headerMap,
          "商品名"
        )
      ),

    janCode:
      getImportCode(
        getCell(
          row,
          headerMap,
          "JANコード"
        )
      ),

    stock:
      getImportText(
        getCell(
          row,
          headerMap,
          "現在庫数"
        )
      ),

    minStock:
      getImportText(
        getCell(
          row,
          headerMap,
          "最低在庫数"
        )
      ),

    category:
      getImportText(
        getCell(
          row,
          headerMap,
          "カテゴリー"
        )
      ),

    location:
      getImportText(
        getCell(
          row,
          headerMap,
          "保管場所"
        )
      ),

    supplier:
      getImportText(
        getCell(
          row,
          headerMap,
          "仕入先"
        )
      ),

    status:
      "新規",

    messages: []
  };
}

function getCell(
  row,
  headerMap,
  headerName
) {
  if (
    !headerMap.has(
      headerName
    )
  ) {
    return "";
  }

  return (
    row[
      headerMap.get(
        headerName
      )
    ] || ""
  );
}

function getImportText(value) {
  return String(value || "")
    .normalize("NFKC")
    .trim();
}

function getImportCode(value) {
  let text =
    getImportText(value);

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

function validatePreviewItem(
  item,
  internalCodeCounts,
  productCodeCounts,
  janCodeCounts,
  existingInternalCodes,
  existingProductCodes,
  existingJanCodes
) {
  const requiredValues = [
    [
      "社内コード",
      item.internalCode
    ],
    [
      "商品コード",
      item.productCode
    ],
    [
      "商品名",
      item.productName
    ],
    [
      "現在庫数",
      item.stock
    ],
    [
      "仕入先",
      item.supplier
    ]
  ];

  requiredValues.forEach(
    function (
      [label, value]
    ) {
      if (value === "") {
        item.messages.push(
          `${label}が空欄です。`
        );
      }
    }
  );

  if (
    item.stock !== "" &&
    parseNonNegativeInteger(
      item.stock
    ) === null
  ) {
    item.messages.push(
      "現在庫数は0以上の整数で入力してください。"
    );
  }

  if (
    item.minStock !== "" &&
    parseNonNegativeInteger(
      item.minStock
    ) === null
  ) {
    item.messages.push(
      "最低在庫数は0以上の整数で入力してください。"
    );
  }

  const internalKey =
    normalizeCompareText(
      item.internalCode
    );

  const productKey =
    normalizeCompareText(
      item.productCode
    );

  const janKey =
    normalizeCompareText(
      item.janCode
    );

  if (
    internalKey !== "" &&
    internalCodeCounts.get(
      internalKey
    ) > 1
  ) {
    item.messages.push(
      "CSV内で社内コードが重複しています。"
    );
  }

  if (
    productKey !== "" &&
    productCodeCounts.get(
      productKey
    ) > 1
  ) {
    item.messages.push(
      "CSV内で商品コードが重複しています。"
    );
  }

  if (
    janKey !== "" &&
    janCodeCounts.get(
      janKey
    ) > 1
  ) {
    item.messages.push(
      "CSV内でJANコードが重複しています。"
    );
  }

  if (
    item.messages.length > 0
  ) {
    item.status =
      "エラー";

    return;
  }

  const existingMessages =
    [];

  if (
    existingInternalCodes.has(
      internalKey
    )
  ) {
    existingMessages.push(
      "社内コードが登録済みです。"
    );
  }

  if (
    existingProductCodes.has(
      productKey
    )
  ) {
    existingMessages.push(
      "商品コードが登録済みです。"
    );
  }

  if (
    janKey !== "" &&
    existingJanCodes.has(
      janKey
    )
  ) {
    existingMessages.push(
      "JANコードが登録済みです。"
    );
  }

  if (
    existingMessages.length > 0
  ) {
    item.status =
      "既存";

    item.messages =
      existingMessages;

    return;
  }

  item.status =
    "新規";

  item.messages = [
    "新しい商品として読込できます。"
  ];
}

function parseNonNegativeInteger(
  value
) {
  const text =
    String(value || "")
      .normalize("NFKC")
      .replace(
        /,/g,
        ""
      )
      .trim();

  if (
    !/^\d+$/.test(text)
  ) {
    return null;
  }

  const number =
    Number(text);

  if (
    !Number.isSafeInteger(
      number
    ) ||
    number < 0
  ) {
    return null;
  }

  return number;
}

function countPreviewValues(
  rows,
  propertyName,
  ignoreBlank = false
) {
  const counts =
    new Map();

  rows.forEach(
    function (item) {
      const key =
        normalizeCompareText(
          item[propertyName]
        );

      if (
        ignoreBlank &&
        key === ""
      ) {
        return;
      }

      counts.set(
        key,
        (
          counts.get(key) || 0
        ) + 1
      );
    }
  );

  return counts;
}

function normalizeCompareText(
  value
) {
  return String(value || "")
    .normalize("NFKC")
    .toLowerCase()
    .trim();
}

function displayCsvPreview(
  result
) {
  csvImportPreviewBody.innerHTML =
    "";

  if (
    result.errors.length > 0
  ) {
    csvImportMessage.textContent =
      "CSVの項目名にエラーがあります。";

    showCsvImportErrors(
      result.errors
    );

    csvImportPreviewBody.innerHTML = `
      <tr>
        <td colspan="12">
          エラーを修正したCSVを選び直してください。
        </td>
      </tr>
    `;

    return;
  }

  if (
    result.rows.length === 0
  ) {
    csvImportMessage.textContent =
      "CSVに商品データがありません。";

    return;
  }

  result.rows.forEach(
    function (item) {
      csvImportPreviewBody.appendChild(
        createPreviewRow(
          item
        )
      );
    }
  );

  const newCount =
    result.rows.filter(
      function (item) {
        return (
          item.status ===
          "新規"
        );
      }
    ).length;

  const existingCount =
    result.rows.filter(
      function (item) {
        return (
          item.status ===
          "既存"
        );
      }
    ).length;

  const errorRows =
    result.rows.filter(
      function (item) {
        return (
          item.status ===
          "エラー"
        );
      }
    );

  csvImportMessage.textContent =
    `全${result.rows.length}件 / ` +
    `新規${newCount}件 / ` +
    `既存${existingCount}件 / ` +
    `エラー${errorRows.length}件`;

  if (
    errorRows.length > 0
  ) {
    const errorMessages =
      errorRows.map(
        function (item) {
          return (
            `${item.lineNumber}行目：` +
            item.messages.join(
              " / "
            )
          );
        }
      );

    showCsvImportErrors(
      errorMessages
    );
  } else {
    csvImportErrors.hidden =
      true;

    csvImportErrors.innerHTML =
      "";
  }
}

function createPreviewRow(
  item
) {
  const row =
    document.createElement(
      "tr"
    );

  row.classList.add(
    getPreviewRowClass(
      item.status
    )
  );

  appendPreviewCell(
    row,
    item.lineNumber
  );

  appendStatusCell(
    row,
    item.status
  );

  appendPreviewCell(
    row,
    item.internalCode
  );

  appendPreviewCell(
    row,
    item.productCode
  );

  appendPreviewCell(
    row,
    item.productName
  );

  appendPreviewCell(
    row,
    item.janCode
  );

  appendPreviewCell(
    row,
    item.stock
  );

  appendPreviewCell(
    row,
    item.minStock === ""
      ? "0"
      : item.minStock
  );

  appendPreviewCell(
    row,
    item.category
  );

  appendPreviewCell(
    row,
    item.location
  );

  appendPreviewCell(
    row,
    item.supplier
  );

  appendPreviewCell(
    row,
    item.messages.join(
      " / "
    )
  );

  return row;
}

function appendPreviewCell(
  row,
  value
) {
  const cell =
    document.createElement(
      "td"
    );

  cell.textContent =
    value === ""
      ? "未入力"
      : value;

  row.appendChild(
    cell
  );
}

function appendStatusCell(
  row,
  status
) {
  const cell =
    document.createElement(
      "td"
    );

  const badge =
    document.createElement(
      "span"
    );

  badge.classList.add(
    "csv-import-badge"
  );

  badge.classList.add(
    getPreviewBadgeClass(
      status
    )
  );

  badge.textContent =
    status;

  cell.appendChild(
    badge
  );

  row.appendChild(
    cell
  );
}

function getPreviewRowClass(
  status
) {
  if (status === "新規") {
    return (
      "csv-import-row-new"
    );
  }

  if (status === "既存") {
    return (
      "csv-import-row-existing"
    );
  }

  return (
    "csv-import-row-error"
  );
}

function getPreviewBadgeClass(
  status
) {
  if (status === "新規") {
    return (
      "csv-import-badge-new"
    );
  }

  if (status === "既存") {
    return (
      "csv-import-badge-existing"
    );
  }

  return (
    "csv-import-badge-error"
  );
}

function showCsvImportErrors(
  messages
) {
  const listItems =
    messages
      .slice(0, 20)
      .map(
        function (message) {
          return (
            `<li>${escapeHtml(message)}</li>`
          );
        }
      )
      .join("");

  const remainingCount =
    messages.length -
    Math.min(
      messages.length,
      20
    );

  const remainingText =
    remainingCount > 0
      ? `<p>ほかに${remainingCount}件のエラーがあります。</p>`
      : "";

  csvImportErrors.innerHTML = `
    <strong>確認が必要な内容</strong>
    <ul>${listItems}</ul>
    ${remainingText}
  `;

  csvImportErrors.hidden =
    false;
}

function escapeHtml(value) {
  return String(value || "")
    .replace(
      /&/g,
      "&amp;"
    )
    .replace(
      /</g,
      "&lt;"
    )
    .replace(
      />/g,
      "&gt;"
    )
    .replace(
      /"/g,
      "&quot;"
    )
    .replace(
      /'/g,
      "&#039;"
    );
}

function returnHomeFromCsvImport() {
  csvImportScreen.hidden =
    true;

  resetCsvImportScreen();

  window.inventoryApp.showScreen(
    "home"
  );
}

function hideAllScreensForCsvImport() {
  document
    .querySelectorAll(
      "main > section"
    )
    .forEach(
      function (screen) {
        screen.hidden =
          true;
      }
    );
}