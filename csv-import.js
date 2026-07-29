"use strict";

let csvImportScreen = null;
let csvImportFileInput = null;
let csvImportMessage = null;
let csvImportErrors = null;
let csvImportPreviewBody = null;

let currentCsvImportRows = [];

const COMPANY_MASTER_COLUMNS = {
  internalCode: 0,
  productCode: 1,
  productName: 2,
  janCode: 5,
  category: 8,
  supplier: 42
};

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
  const existingButton =
    document.querySelector(
      "#show-csv-import-button"
    );

  if (existingButton) {
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
    <h2>社内商品マスタCSV読込</h2>

    <p class="csv-import-notice">
      社内の商品マスタから、次の列を読み取ります。
      <br>
      A列：社内コード
      <br>
      B列：商品コード
      <br>
      C列：商品名
      <br>
      F列：JANコード
      <br>
      I列：カテゴリー
      <br>
      AQ列：仕入れ先名
    </p>

    <p class="csv-import-duplicate-notice">
      商品コードは空欄でも読み込めます。
      <br>
      商品コードとJANコードは、
      同じ番号が複数あっても読み込めます。
      <br>
      重複できないのは社内コードだけです。
    </p>

    <p class="csv-import-default-notice">
      現在庫数は0個、最低在庫数は0個、
      保管場所は未設定として読み込みます。
    </p>

    <div class="csv-import-file-area">
      <label for="csv-import-file">
        社内商品マスタCSVを選択
      </label>

      <input
        id="csv-import-file"
        type="file"
        accept=".csv,text/csv"
      >

      <small>
        Excelでは「CSV UTF-8（コンマ区切り）」として保存してください。
      </small>
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
            <th>CSV行</th>
            <th>判定</th>
            <th>社内コード</th>
            <th>商品コード</th>
            <th>商品名</th>
            <th>JANコード</th>
            <th>カテゴリー</th>
            <th>仕入れ先名</th>
            <th>現在庫数</th>
            <th>最低在庫数</th>
            <th>保管場所</th>
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
    .csv-import-duplicate-notice,
    .csv-import-default-notice,
    .csv-import-message {
      padding: 12px;
      border-radius: 8px;
      font-weight: bold;
    }

    .csv-import-notice {
      background-color: #e3f2fd;
      color: #0d47a1;
      line-height: 1.8;
    }

    .csv-import-duplicate-notice {
      background-color: #e8f5e9;
      color: #1b5e20;
      line-height: 1.7;
    }

    .csv-import-default-notice {
      background-color: #fff8e1;
      color: #795548;
    }

    .csv-import-message {
      background-color: #e8f5e9;
      color: #1b5e20;
    }

    .csv-import-file-area {
      margin: 18px 0;
      padding: 16px;
      border: 2px solid #90caf9;
      border-radius: 10px;
      background-color: #f7fbff;
    }

    .csv-import-file-area small {
      display: block;
      margin-top: 10px;
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
      min-width: 1550px;
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
  currentCsvImportRows = [];

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
      await createCompanyMasterPreview(
        parsedRows
      );

    displayCsvPreview(
      previewResult
    );
  } catch (error) {
    console.error(error);

    currentCsvImportRows = [];

    csvImportMessage.textContent =
      "CSVファイルを読み込めませんでした。";

    showCsvImportErrors([
      "Excelで「CSV UTF-8（コンマ区切り）」として保存したか確認してください。",
      "CSVのダブルクォーテーションが途中で切れていないか確認してください。"
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

      if (hasCsvRowData(row)) {
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

  if (hasCsvRowData(row)) {
    rows.push(row);
  }

  return rows;
}

function hasCsvRowData(row) {
  return row.some(
    function (cell) {
      return (
        String(
          cell || ""
        ).trim() !== ""
      );
    }
  );
}

async function createCompanyMasterPreview(
  parsedRows
) {
  const result = {
    rows: [],
    errors: [],
    warnings: []
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

  const headerErrors =
    validateCompanyMasterHeaders(
      parsedRows[0]
    );

  if (
    headerErrors.length > 0
  ) {
    result.errors.push(
      ...headerErrors
    );

    return result;
  }

  const existingProducts =
    await getAllProducts();

  const existingInternalCodes =
    new Set();

  existingProducts.forEach(
    function (product) {
      const internalCode =
        normalizeCompareText(
          product.internalCode
        );

      if (internalCode !== "") {
        existingInternalCodes.add(
          internalCode
        );
      }
    }
  );

  const previewRows =
    parsedRows
      .slice(1)
      .map(
        function (row, index) {
          return createCompanyMasterItem(
            row,
            index + 2
          );
        }
      )
      .filter(
        function (item) {
          return !isEmptyMasterItem(
            item
          );
        }
      );

  if (
    previewRows.length === 0
  ) {
    result.errors.push(
      "2行目以降に商品データがありません。"
    );

    return result;
  }

  const internalCodeCounts =
    countInternalCodeValues(
      previewRows
    );

  previewRows.forEach(
    function (item) {
      validateCompanyMasterItem(
        item,
        internalCodeCounts,
        existingInternalCodes
      );
    }
  );

  result.rows =
    previewRows;

  result.warnings.push(
    "商品コードは空欄でも読み込めます。"
  );

  result.warnings.push(
    "商品コードは重複していても読み込めます。"
  );

  result.warnings.push(
    "JANコードは重複していても読み込めます。"
  );

  result.warnings.push(
    "現在庫数は0個として読み込みます。"
  );

  result.warnings.push(
    "最低在庫数は0個として読み込みます。"
  );

  result.warnings.push(
    "保管場所は未設定として読み込みます。"
  );

  return result;
}

function validateCompanyMasterHeaders(
  headerRow
) {
  const errors = [];

  const checks = [
    {
      columnName: "A列",
      index:
        COMPANY_MASTER_COLUMNS.internalCode,
      acceptedNames: [
        "社内コード"
      ],
      expectedName:
        "社内コード"
    },
    {
      columnName: "B列",
      index:
        COMPANY_MASTER_COLUMNS.productCode,
      acceptedNames: [
        "商品コード"
      ],
      expectedName:
        "商品コード"
    },
    {
      columnName: "C列",
      index:
        COMPANY_MASTER_COLUMNS.productName,
      acceptedNames: [
        "商品名",
        "品名"
      ],
      expectedName:
        "商品名"
    },
    {
      columnName: "F列",
      index:
        COMPANY_MASTER_COLUMNS.janCode,
      acceptedNames: [
        "JANコード",
        "JAN",
        "JAN CD",
        "JANCD"
      ],
      expectedName:
        "JANコード"
    },
    {
      columnName: "I列",
      index:
        COMPANY_MASTER_COLUMNS.category,
      acceptedNames: [
        "カテゴリー",
        "カテゴリ"
      ],
      expectedName:
        "カテゴリー"
    },
    {
      columnName: "AQ列",
      index:
        COMPANY_MASTER_COLUMNS.supplier,
      acceptedNames: [
        "仕入れ先名"
      ],
      expectedName:
        "仕入れ先名"
    }
  ];

  checks.forEach(
    function (check) {
      const actualHeader =
        getImportText(
          headerRow[
            check.index
          ]
        );

      const normalizedActual =
        normalizeHeaderText(
          actualHeader
        );

      const isAccepted =
        check.acceptedNames.some(
          function (acceptedName) {
            return (
              normalizedActual ===
              normalizeHeaderText(
                acceptedName
              )
            );
          }
        );

      if (!isAccepted) {
        errors.push(
          `${check.columnName}の項目名を「${check.expectedName}」にしてください。現在の項目名：${actualHeader || "空欄"}`
        );
      }
    }
  );

  return errors;
}

function createCompanyMasterItem(
  row,
  lineNumber
) {
  return {
    lineNumber:
      lineNumber,

    internalCode:
      getImportCode(
        row[
          COMPANY_MASTER_COLUMNS.internalCode
        ]
      ),

    productCode:
      getImportCode(
        row[
          COMPANY_MASTER_COLUMNS.productCode
        ]
      ),

    productName:
      getImportText(
        row[
          COMPANY_MASTER_COLUMNS.productName
        ]
      ),

    janCode:
      getImportCode(
        row[
          COMPANY_MASTER_COLUMNS.janCode
        ]
      ),

    category:
      getImportText(
        row[
          COMPANY_MASTER_COLUMNS.category
        ]
      ),

    supplier:
      getImportText(
        row[
          COMPANY_MASTER_COLUMNS.supplier
        ]
      ),

    stock: 0,
    minStock: 0,
    location: "",

    status: "新規",
    messages: []
  };
}

function isEmptyMasterItem(item) {
  return (
    item.internalCode === "" &&
    item.productCode === "" &&
    item.productName === "" &&
    item.janCode === "" &&
    item.category === "" &&
    item.supplier === ""
  );
}

function validateCompanyMasterItem(
  item,
  internalCodeCounts,
  existingInternalCodes
) {
  if (
    item.internalCode === ""
  ) {
    item.messages.push(
      "A列の社内コードが空欄です。"
    );
  }

  if (
    item.productName === ""
  ) {
    item.messages.push(
      "C列の商品名が空欄です。"
    );
  }

  if (
    item.supplier === ""
  ) {
    item.messages.push(
      "AQ列の仕入れ先名が空欄です。"
    );
  }

  const internalKey =
    normalizeCompareText(
      item.internalCode
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
    item.messages.length > 0
  ) {
    item.status =
      "エラー";

    return;
  }

  if (
    existingInternalCodes.has(
      internalKey
    )
  ) {
    item.status =
      "既存";

    item.messages = [
      "社内コードが登録済みです。"
    ];

    return;
  }

  item.status =
    "新規";

  if (
    item.productCode === ""
  ) {
    item.messages = [
      "新しい商品として読み込めます。商品コードは空欄です。"
    ];

    return;
  }

  item.messages = [
    "新しい商品として読み込めます。商品コードとJANコードの重複は許可されています。"
  ];
}

function countInternalCodeValues(
  rows
) {
  const counts =
    new Map();

  rows.forEach(
    function (item) {
      const key =
        normalizeCompareText(
          item.internalCode
        );

      if (key === "") {
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

function getImportText(value) {
  return String(
    value === undefined ||
    value === null
      ? ""
      : value
  )
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

function normalizeCompareText(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLowerCase()
    .trim();
}

function normalizeHeaderText(value) {
  return String(value || "")
    .normalize("NFKC")
    .replace(
      /\s/g,
      ""
    )
    .toLowerCase()
    .trim();
}

function displayCsvPreview(result) {
  currentCsvImportRows =
    result.rows;

  csvImportPreviewBody.innerHTML =
    "";

  if (
    result.errors.length > 0
  ) {
    currentCsvImportRows = [];

    csvImportMessage.textContent =
      "社内商品マスタの形式にエラーがあります。";

    showCsvImportErrors(
      result.errors
    );

    csvImportPreviewBody.innerHTML = `
      <tr>
        <td colspan="12">
          項目名またはCSVの内容を確認してください。
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

  const messages = [];

  result.warnings.forEach(
    function (warning) {
      messages.push(
        warning
      );
    }
  );

  errorRows.forEach(
    function (item) {
      messages.push(
        `${item.lineNumber}行目：` +
        item.messages.join(
          " / "
        )
      );
    }
  );

  if (
    messages.length > 0
  ) {
    showCsvImportErrors(
      messages,
      errorRows.length === 0
    );
  } else {
    csvImportErrors.hidden =
      true;

    csvImportErrors.innerHTML =
      "";
  }
}

function createPreviewRow(item) {
  const row =
    document.createElement("tr");

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
    item.category
  );

  appendPreviewCell(
    row,
    item.supplier
  );

  appendPreviewCell(
    row,
    item.stock
  );

  appendPreviewCell(
    row,
    item.minStock
  );

  appendPreviewCell(
    row,
    item.location === ""
      ? "未設定"
      : item.location
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
    document.createElement("td");

  cell.textContent =
    value === "" ||
    value === null ||
    value === undefined
      ? "未入力"
      : String(value);

  row.appendChild(
    cell
  );
}

function appendStatusCell(
  row,
  status
) {
  const cell =
    document.createElement("td");

  const badge =
    document.createElement("span");

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

function getPreviewRowClass(status) {
  if (
    status === "新規"
  ) {
    return (
      "csv-import-row-new"
    );
  }

  if (
    status === "既存"
  ) {
    return (
      "csv-import-row-existing"
    );
  }

  return (
    "csv-import-row-error"
  );
}

function getPreviewBadgeClass(status) {
  if (
    status === "新規"
  ) {
    return (
      "csv-import-badge-new"
    );
  }

  if (
    status === "既存"
  ) {
    return (
      "csv-import-badge-existing"
    );
  }

  return (
    "csv-import-badge-error"
  );
}

function showCsvImportErrors(
  messages,
  warningsOnly = false
) {
  const listItems =
    messages
      .slice(0, 30)
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
      30
    );

  const remainingText =
    remainingCount > 0
      ? `<p>ほかに${remainingCount}件あります。</p>`
      : "";

  csvImportErrors.innerHTML = `
    <strong>
      ${
        warningsOnly
          ? "読込時の設定"
          : "確認が必要な内容"
      }
    </strong>

    <ul>${listItems}</ul>

    ${remainingText}
  `;

  csvImportErrors.style.borderColor =
    warningsOnly
      ? "#ef6c00"
      : "#c62828";

  csvImportErrors.style.backgroundColor =
    warningsOnly
      ? "#fff8e1"
      : "#ffebee";

  csvImportErrors.style.color =
    warningsOnly
      ? "#795548"
      : "#b71c1c";

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