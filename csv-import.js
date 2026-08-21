"use strict";

let csvImportScreen = null;
let csvImportFileInput = null;
let csvImportMessage = null;
let csvImportErrors = null;
let csvImportPreviewBody = null;
let csvImportRegisterButton = null;
let csvImportBusy = false;
let currentCsvImportRows = [];

const COMPANY_MASTER_COLUMNS = {
  internalCode: 0,
  productCode: 1,
  productName: 2,
  productColor: 4,
  janCode: 5,
  category: 8,
  discontinuedFlag: 36,
  supplier: 42
};

document.addEventListener("DOMContentLoaded", initializeCsvImport);

function initializeCsvImport() {
  createCsvImportButton();
  createCsvImportScreen();
  createCsvImportStyle();
}

function createCsvImportButton() {
  if (document.querySelector("#show-csv-import-button")) {
    return;
  }

  const referenceButton =
    document.querySelector("#export-stocktaking-csv-button") ||
    document.querySelector("#export-movements-csv-button") ||
    document.querySelector("#export-products-csv-button") ||
    document.querySelector("#show-history-button");

  if (!referenceButton) {
    console.error("CSV読込ボタンを追加する場所が見つかりません。");
    return;
  }

  const button = document.createElement("button");
  button.id = "show-csv-import-button";
  button.type = "button";
  button.textContent = "商品一覧CSVを読み込む";
  button.addEventListener("click", openCsvImportScreen);
  referenceButton.parentElement.appendChild(button);
}

function createCsvImportScreen() {
  const oldScreen = document.querySelector("#csv-import-screen");

  if (oldScreen) {
    oldScreen.remove();
  }

  csvImportScreen = document.createElement("section");
  csvImportScreen.id = "csv-import-screen";
  csvImportScreen.hidden = true;

  csvImportScreen.innerHTML = `
    <h2>社内商品マスタCSV読込</h2>

    <p class="csv-import-notice">
      社内の商品マスタから、次の列を読み取ります。<br>
      A列：社内コード<br>
      B列：商品コード<br>
      C列：商品名<br>
      E列：商品の色<br>
      F列：JANコード<br>
      I列：カテゴリー<br>
      AK列：廃番区分／廃盤区分（9＝廃盤 / 9以外＝通常商品）<br>
      AQ列：仕入れ先名
    </p>

    <p class="csv-import-duplicate-notice">
      商品コードは空欄でも読み込めます。<br>
      商品コードとJANコードは、同じ番号が複数あっても読み込めます。<br>
      重複できないのは社内コードだけです。
    </p>

    <p class="csv-import-default-notice">
      現在庫数は0個、最低在庫数は0個、保管場所は未設定として登録します。
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
            <th>商品の色</th>
            <th>JANコード</th>
            <th>カテゴリー</th>
            <th>仕入れ先名</th>
            <th>商品状態</th>
            <th>現在庫数</th>
            <th>最低在庫数</th>
            <th>保管場所</th>
            <th>確認内容</th>
          </tr>
        </thead>

        <tbody id="csv-import-preview-body">
          <tr>
            <td colspan="14">
              CSVを選択すると、ここに内容が表示されます。
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <button
      id="register-new-csv-products-button"
      type="button"
      disabled
    >
      新規商品を登録する
    </button>

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

  document.querySelector("main").appendChild(csvImportScreen);

  csvImportFileInput =
    document.querySelector("#csv-import-file");

  csvImportMessage =
    document.querySelector("#csv-import-message");

  csvImportErrors =
    document.querySelector("#csv-import-errors");

  csvImportPreviewBody =
    document.querySelector("#csv-import-preview-body");

  csvImportRegisterButton =
    document.querySelector("#register-new-csv-products-button");

  csvImportFileInput.addEventListener(
    "change",
    handleCsvFileSelection
  );

  csvImportRegisterButton.addEventListener(
    "click",
    registerNewCsvProducts
  );

  document
    .querySelector("#clear-csv-import-button")
    .addEventListener(
      "click",
      resetCsvImportScreen
    );

  document
    .querySelector("#back-home-from-csv-import")
    .addEventListener(
      "click",
      returnHomeFromCsvImport
    );
}

function createCsvImportStyle() {
  const oldStyle =
    document.querySelector("#csv-import-style");

  if (oldStyle) {
    oldStyle.remove();
  }

  const style = document.createElement("style");
  style.id = "csv-import-style";

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
      min-width: 1780px;
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

    #register-new-csv-products-button {
      background-color: #2e7d32;
    }

    #register-new-csv-products-button:disabled {
      background-color: #b0bec5;
      color: #eceff1;
      cursor: not-allowed;
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

  document.head.appendChild(style);
}

function openCsvImportScreen() {
  hideAllScreensForCsvImport();
  csvImportScreen.hidden = false;
  resetCsvImportScreen();

  requestAnimationFrame(function () {
    csvImportScreen.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  });
}

function resetCsvImportScreen() {
  if (csvImportBusy) {
    return;
  }

  currentCsvImportRows = [];
  csvImportFileInput.value = "";
  csvImportMessage.textContent =
    "CSVファイルを選択してください。";

  csvImportErrors.hidden = true;
  csvImportErrors.innerHTML = "";

  csvImportRegisterButton.disabled = true;
  csvImportRegisterButton.textContent =
    "新規商品を登録する";

  csvImportPreviewBody.innerHTML = `
    <tr>
      <td colspan="14">
        CSVを選択すると、ここに内容が表示されます。
      </td>
    </tr>
  `;
}

async function handleCsvFileSelection() {
  if (csvImportBusy) {
    return;
  }

  const file =
    csvImportFileInput.files[0];

  if (!file) {
    resetCsvImportScreen();
    return;
  }

  if (!file.name.toLowerCase().endsWith(".csv")) {
    await showAppDialog({
      type: "warning",
      icon: "📄",
      title: "CSVファイルを選択してください",
      message:
        "選択したファイルはCSV形式ではありません。ExcelからCSV UTF-8（コンマ区切り）で保存したファイルを選択してください。",
      confirmText: "確認して閉じる"
    });

    resetCsvImportScreen();
    return;
  }

  csvImportRegisterButton.disabled = true;

  csvImportMessage.textContent =
    `「${file.name}」を確認しています。`;

  csvImportErrors.hidden = true;
  csvImportErrors.innerHTML = "";

  try {
    const csvText =
      await readCsvFile(file);

    const parsedRows =
      parseCsvText(csvText);

    const previewResult =
      await createCompanyMasterPreview(parsedRows);

    displayCsvPreview(previewResult);
  } catch (error) {
    console.error(error);

    currentCsvImportRows = [];
    csvImportRegisterButton.disabled = true;

    csvImportMessage.textContent =
      "CSVファイルを読み込めませんでした。";

    showCsvImportErrors([
      "Excelで「CSV UTF-8（コンマ区切り）」として保存したか確認してください。",
      "CSVのダブルクォーテーションが途中で切れていないか確認してください。"
    ]);

    csvImportPreviewBody.innerHTML = `
      <tr>
        <td colspan="14">
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
    const reader = new FileReader();

    reader.onload = function () {
      resolve(
        String(reader.result || "")
      );
    };

    reader.onerror = function () {
      reject(reader.error);
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
      .replace(/^\uFEFF/, "");

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
  return row.some(function (cell) {
    return (
      String(cell || "").trim() !== ""
    );
  });
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

  if (headerErrors.length > 0) {
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

  if (previewRows.length === 0) {
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
    "既存商品とエラー行は登録されません。"
  );

  result.warnings.push(
    "商品コードは空欄でも登録できます。"
  );

  result.warnings.push(
    "商品コードとJANコードは重複していても登録できます。"
  );

  result.warnings.push(
    "現在庫数は0個として登録します。"
  );

  result.warnings.push(
    "最低在庫数は0個として登録します。"
  );

  result.warnings.push(
    "保管場所は未設定として登録します。"
  );

  result.warnings.push(
    "E列「商品の色」を商品情報へ登録します。"
  );

  result.warnings.push(
    "AK列「廃盤区分」が9なら廃盤、9以外は通常商品として登録します。"
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
      columnName: "E列",
      index:
        COMPANY_MASTER_COLUMNS.productColor,
      acceptedNames: [
        "商品の色",
        "商品色",
        "色"
      ],
      expectedName:
        "商品の色"
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
      columnName: "AK列",
      index:
        COMPANY_MASTER_COLUMNS.discontinuedFlag,
      acceptedNames: [
        "廃盤区分",
        "廃番区分"
      ],
      expectedName:
        "廃盤区分 または 廃番区分"
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
          `${check.columnName}の項目名を「${check.expectedName}」にしてください。` +
          `現在の項目名：${actualHeader || "空欄"}`
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

    productColor:
      getImportText(
        row[
          COMPANY_MASTER_COLUMNS.productColor
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

    discontinuedFlag:
      getImportCode(
        row[
          COMPANY_MASTER_COLUMNS.discontinuedFlag
        ]
      ),

    productStatus:
      getImportCode(
        row[
          COMPANY_MASTER_COLUMNS.discontinuedFlag
        ]
      ) === "9"
        ? "廃盤"
        : "通常商品",

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
  if (item.internalCode === "") {
    item.messages.push(
      "A列の社内コードが空欄です。"
    );
  }

  if (item.productName === "") {
    item.messages.push(
      "C列の商品名が空欄です。"
    );
  }

  if (item.supplier === "") {
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

  if (item.messages.length > 0) {
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

  if (item.productCode === "") {
    item.messages = [
      "新しい商品として登録できます。商品コードは空欄です。"
    ];
  } else {
    item.messages = [
      "新しい商品として登録できます。"
    ];
  }
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

  if (text.startsWith("'")) {
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
    .replace(/\s/g, "")
    .toLowerCase()
    .trim();
}

function displayCsvPreview(result) {
  currentCsvImportRows =
    result.rows;

  csvImportPreviewBody.innerHTML =
    "";

  if (result.errors.length > 0) {
    currentCsvImportRows = [];

    csvImportRegisterButton.disabled =
      true;

    csvImportRegisterButton.textContent =
      "新規商品を登録する";

    csvImportMessage.textContent =
      "社内商品マスタの形式にエラーがあります。";

    showCsvImportErrors(
      result.errors
    );

    csvImportPreviewBody.innerHTML = `
      <tr>
        <td colspan="14">
          項目名またはCSVの内容を確認してください。
        </td>
      </tr>
    `;

    return;
  }

  if (result.rows.length === 0) {
    csvImportRegisterButton.disabled =
      true;

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

  csvImportRegisterButton.disabled =
    newCount === 0;

  if (newCount > 0) {
    csvImportRegisterButton.textContent =
      `新規商品${newCount}件を登録する`;
  } else {
    csvImportRegisterButton.textContent =
      "登録できる新規商品はありません";
  }

  const messages = [
    ...result.warnings
  ];

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

  if (messages.length > 0) {
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

  appendCsvImportStatusCell(
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
    item.productColor || "未登録"
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
    item.productStatus
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

  row.appendChild(cell);
}

function appendCsvImportStatusCell(
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

  cell.appendChild(badge);
  row.appendChild(cell);
}

function getPreviewRowClass(status) {
  if (status === "新規") {
    return "csv-import-row-new";
  }

  if (status === "既存") {
    return "csv-import-row-existing";
  }

  return "csv-import-row-error";
}

function getPreviewBadgeClass(status) {
  if (status === "新規") {
    return "csv-import-badge-new";
  }

  if (status === "既存") {
    return "csv-import-badge-existing";
  }

  return "csv-import-badge-error";
}

async function registerNewCsvProducts() {
  if (csvImportBusy) {
    return;
  }

  const newRows =
    currentCsvImportRows.filter(
      function (item) {
        return (
          item.status ===
          "新規"
        );
      }
    );

  if (newRows.length === 0) {
    await showAppDialog({
      type: "warning",
      icon: "📦",
      title: "登録できる新規商品がありません",
      message:
        "CSV内に新しく登録できる商品がありません。既存商品またはエラー行のみです。",
      confirmText: "確認して閉じる"
    });

    return;
  }

  const confirmed =
    await showAppDialog({
      type: "warning",
      icon: "📥",
      title: "新規商品を登録しますか？",
      message:
        "CSVから新規商品を一括登録します。登録件数と在庫の扱いを確認してください。",
      details: [
        {
          label: "新規登録",
          value: `${newRows.length}件`
        },
        {
          label: "初期在庫",
          value: "すべて0個"
        },
        {
          label: "既存商品",
          value: "登録しません"
        },
        {
          label: "エラー行",
          value: "登録しません"
        }
      ],
      notice:
        "商品マスタへ一括登録します。登録後は商品一覧で内容を確認してください。",
      isConfirm: true,
      cancelText: "戻る",
      confirmText: "新規商品を登録する"
    });

  if (!confirmed) {
    return;
  }

  csvImportBusy = true;

  csvImportRegisterButton.disabled =
    true;

  csvImportFileInput.disabled =
    true;

  csvImportRegisterButton.textContent =
    "登録しています...";

  csvImportMessage.textContent =
    `新規商品${newRows.length}件を登録しています。`;

  let successCount = 0;
  let skippedCount = 0;

  const failedMessages = [];

  try {
    const latestProducts =
      await getAllProducts();

    const latestInternalCodes =
      new Set(
        latestProducts.map(
          function (product) {
            return normalizeCompareText(
              product.internalCode
            );
          }
        )
      );

    for (const item of newRows) {
      const internalKey =
        normalizeCompareText(
          item.internalCode
        );

      if (
        latestInternalCodes.has(
          internalKey
        )
      ) {
        skippedCount += 1;
        continue;
      }

      const dateTime =
        new Date().toISOString();

      const product =
        createProductFromCsvItem(
          item,
          dateTime
        );

      const movement =
        createInitialMovementFromCsvItem(
          item,
          dateTime
        );

      try {
        await saveProductAndMovement(
          product,
          movement
        );

        latestInternalCodes.add(
          internalKey
        );

        successCount += 1;
      } catch (error) {
        console.error(
          "CSV商品登録エラー",
          item.internalCode,
          error
        );

        failedMessages.push(
          `${item.lineNumber}行目「${item.productName}」を登録できませんでした。`
        );
      }
    }
  } catch (error) {
    console.error(error);

    failedMessages.push(
      "商品データベースを確認できませんでした。"
    );
  }

  csvImportBusy = false;
  csvImportFileInput.disabled = false;

  if (successCount > 0) {
    let resultMessage =
      `${successCount}件の商品を登録しました。`;

    if (skippedCount > 0) {
      resultMessage +=
        `\n登録直前に既存と確認された${skippedCount}件は登録していません。`;
    }

    if (failedMessages.length > 0) {
      resultMessage +=
        `\n登録できなかった商品：${failedMessages.length}件`;
    }

    resultMessage +=
      "\n\n商品一覧を更新します。";

    await showAppDialog({
      type: "success",
      icon: "✅",
      title: "新規商品の登録が完了しました",
      message: resultMessage,
      confirmText: "商品一覧を更新する"
    });

    window.location.reload();
    return;
  }

  csvImportRegisterButton.disabled =
    false;

  csvImportRegisterButton.textContent =
    `新規商品${newRows.length}件を登録する`;

  if (failedMessages.length > 0) {
    showCsvImportErrors(
      failedMessages
    );

    csvImportMessage.textContent =
      "商品を登録できませんでした。";

    return;
  }

  await showAppDialog({
    type: "warning",
    icon: "ℹ️",
    title: "新しく登録された商品はありません",
    message:
      "登録対象の商品は、すでに商品マスタへ登録されています。",
    confirmText: "確認して閉じる"
  });

  csvImportMessage.textContent =
    "新しく登録された商品はありません。";
}

function createProductFromCsvItem(
  item,
  dateTime
) {
  return {
    internalCode:
      item.internalCode,

    productCode:
      item.productCode,

    productName:
      item.productName,

    productColor:
      item.productColor,

    janCode:
      item.janCode,

    category:
      item.category,

    stock: 0,
    minStock: 0,
    location: "",

    supplier:
      item.supplier,

    productStatus:
      item.productStatus,

    discontinuedFlag:
      item.discontinuedFlag,

    memo:
      "社内商品マスタCSVから登録",

    createdAt:
      dateTime,

    updatedAt:
      dateTime
  };
}

function createInitialMovementFromCsvItem(
  item,
  dateTime
) {
  return {
    id:
      createCsvImportId(
        "movement"
      ),

    dateTime:
      dateTime,

    internalCode:
      item.internalCode,

    productCode:
      item.productCode,

    janCode:
      item.janCode,

    productName:
      item.productName,

    type:
      "初期登録",

    quantity: 0,
    beforeStock: 0,
    afterStock: 0,

    person:
      "CSV読込",

    staff:
      "CSV読込",

    reason:
      "社内商品マスタCSV読込",

    memo:
      "初期在庫0個で登録"
  };
}

function createCsvImportId(prefix) {
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
          ? "登録時の設定"
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
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function returnHomeFromCsvImport() {
  if (csvImportBusy) {
    return;
  }

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