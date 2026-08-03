"use strict";

const STOCKTAKING_SUBMISSION_FORMAT =
  "barcode-inventory-stocktaking-submission";

const STOCKTAKING_SUBMISSION_FORMAT_VERSION =
  1;

const STOCKTAKING_TRANSFER_APP_VERSION =
  "v20";

let stocktakingAggregationScreen = null;
let stocktakingSubmissionFileInput = null;
let stocktakingSubmissionPreviewBody = null;
let stocktakingSubmissionPreviewMessage = null;
let importStocktakingSubmissionsButton = null;
let stocktakingImportedSubmissionBody = null;
let stocktakingImportedSubmissionMessage = null;
let stocktakingAggregationDateFilter = null;
let stocktakingAggregationSummary = null;
let stocktakingAggregationBody = null;
let exportStocktakingAggregationCsvButton = null;

let selectedStocktakingSubmissionFiles = [];
let importedStocktakingSubmissions = [];
let currentStocktakingAggregationRows = [];

window.stocktakingTransferApp = {
  exportSession: exportStocktakingSubmission
};

document.addEventListener(
  "DOMContentLoaded",
  initializeStocktakingTransfer
);

function initializeStocktakingTransfer() {
  createStocktakingAggregationButton();
  createStocktakingAggregationScreen();
  createStocktakingAggregationStyle();
}

function createStocktakingAggregationButton() {
  if (
    document.querySelector(
      "#show-stocktaking-aggregation-button"
    )
  ) {
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
    return;
  }

  const button =
    document.createElement("button");

  button.id =
    "show-stocktaking-aggregation-button";

  button.type = "button";

  button.textContent =
    "棚卸提出データを集約する";

  button.addEventListener(
    "click",
    openStocktakingAggregationScreen
  );

  referenceButton.parentElement.appendChild(
    button
  );
}

function createStocktakingAggregationScreen() {
  const existingScreen =
    document.querySelector(
      "#stocktaking-aggregation"
    );

  if (existingScreen) {
    existingScreen.remove();
  }

  stocktakingAggregationScreen =
    document.createElement("section");

  stocktakingAggregationScreen.id =
    "stocktaking-aggregation";

  stocktakingAggregationScreen.hidden =
    true;

  stocktakingAggregationScreen.innerHTML = `
    <h2>棚卸提出データの集約</h2>

    <p class="stocktaking-aggregation-notice">
      各スマホ・パソコンで出力した棚卸提出ファイルを、このパソコンへまとめて取り込みます。
    </p>

    <p class="stocktaking-aggregation-safety">
      試験版では集約結果を現在庫へ自動反映しません。画面とCSVで内容を確認してください。
    </p>

    <section class="stocktaking-aggregation-panel">
      <h3>1. 提出ファイルを選ぶ</h3>

      <label for="stocktaking-submission-file-input">
        棚卸提出ファイル（複数選択できます）
      </label>

      <input
        id="stocktaking-submission-file-input"
        type="file"
        accept=".json,application/json"
        multiple
      >

      <p
        id="stocktaking-submission-preview-message"
        class="stocktaking-aggregation-message"
      >
        まだファイルを選択していません。
      </p>

      <div class="stocktaking-aggregation-table-area">
        <table class="stocktaking-submission-preview-table">
          <thead>
            <tr>
              <th>ファイル名</th>
              <th>棚卸日</th>
              <th>担当者</th>
              <th>保管場所</th>
              <th>商品数</th>
              <th>確認結果</th>
            </tr>
          </thead>

          <tbody id="stocktaking-submission-preview-body">
            <tr>
              <td colspan="6">
                ファイルを選択すると確認結果が表示されます。
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <button
        id="import-stocktaking-submissions-button"
        type="button"
        disabled
      >
        選択した提出ファイルを取り込む
      </button>
    </section>

    <section class="stocktaking-aggregation-panel">
      <h3>2. 取り込み済みの提出</h3>

      <p
        id="stocktaking-imported-submission-message"
        class="stocktaking-aggregation-message"
      >
        取り込み済みの提出を読み込んでいます。
      </p>

      <div class="stocktaking-aggregation-table-area">
        <table class="stocktaking-imported-submission-table">
          <thead>
            <tr>
              <th>棚卸日</th>
              <th>担当者</th>
              <th>保管場所</th>
              <th>状態</th>
              <th>商品数</th>
              <th>取込日時</th>
              <th>操作</th>
            </tr>
          </thead>

          <tbody id="stocktaking-imported-submission-body">
            <tr>
              <td colspan="7">
                取り込み済みの提出はありません。
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section class="stocktaking-aggregation-panel">
      <h3>3. 集約結果を確認する</h3>

      <label for="stocktaking-aggregation-date-filter">
        棚卸日で絞り込む
      </label>

      <select id="stocktaking-aggregation-date-filter">
        <option value="">すべての棚卸日</option>
      </select>

      <div
        id="stocktaking-aggregation-summary"
        class="stocktaking-aggregation-summary"
      ></div>

      <div class="stocktaking-aggregation-table-area">
        <table class="stocktaking-aggregation-result-table">
          <thead>
            <tr>
              <th>棚卸日</th>
              <th>結果</th>
              <th>社内コード</th>
              <th>商品コード</th>
              <th>商品名</th>
              <th>登録在庫</th>
              <th>集約実在庫</th>
              <th>差異</th>
              <th>保管場所別内訳</th>
              <th>担当者</th>
              <th>提出数</th>
              <th>警告</th>
            </tr>
          </thead>

          <tbody id="stocktaking-aggregation-body">
            <tr>
              <td colspan="12">
                提出ファイルを取り込むと集約結果が表示されます。
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <button
        id="export-stocktaking-aggregation-csv-button"
        type="button"
        disabled
      >
        集約結果をCSV出力する
      </button>
    </section>

    <button
      id="back-home-from-stocktaking-aggregation"
      type="button"
    >
      ホームへ戻る
    </button>
  `;

  document.querySelector("main").appendChild(
    stocktakingAggregationScreen
  );

  stocktakingSubmissionFileInput =
    document.querySelector(
      "#stocktaking-submission-file-input"
    );

  stocktakingSubmissionPreviewBody =
    document.querySelector(
      "#stocktaking-submission-preview-body"
    );

  stocktakingSubmissionPreviewMessage =
    document.querySelector(
      "#stocktaking-submission-preview-message"
    );

  importStocktakingSubmissionsButton =
    document.querySelector(
      "#import-stocktaking-submissions-button"
    );

  stocktakingImportedSubmissionBody =
    document.querySelector(
      "#stocktaking-imported-submission-body"
    );

  stocktakingImportedSubmissionMessage =
    document.querySelector(
      "#stocktaking-imported-submission-message"
    );

  stocktakingAggregationDateFilter =
    document.querySelector(
      "#stocktaking-aggregation-date-filter"
    );

  stocktakingAggregationSummary =
    document.querySelector(
      "#stocktaking-aggregation-summary"
    );

  stocktakingAggregationBody =
    document.querySelector(
      "#stocktaking-aggregation-body"
    );

  exportStocktakingAggregationCsvButton =
    document.querySelector(
      "#export-stocktaking-aggregation-csv-button"
    );

  stocktakingSubmissionFileInput.addEventListener(
    "change",
    previewSelectedStocktakingSubmissionFiles
  );

  importStocktakingSubmissionsButton.addEventListener(
    "click",
    importSelectedStocktakingSubmissions
  );

  stocktakingAggregationDateFilter.addEventListener(
    "change",
    updateStocktakingAggregationResults
  );

  exportStocktakingAggregationCsvButton.addEventListener(
    "click",
    exportStocktakingAggregationCsv
  );

  document.querySelector(
    "#back-home-from-stocktaking-aggregation"
  ).addEventListener(
    "click",
    returnHomeFromStocktakingAggregation
  );
}

function createStocktakingAggregationStyle() {
  const existingStyle =
    document.querySelector(
      "#stocktaking-aggregation-style"
    );

  if (existingStyle) {
    existingStyle.remove();
  }

  const style =
    document.createElement("style");

  style.id =
    "stocktaking-aggregation-style";

  style.textContent = `
    #show-stocktaking-aggregation-button {
      background-color: #00695c;
    }

    .stocktaking-aggregation-notice,
    .stocktaking-aggregation-safety,
    .stocktaking-aggregation-message {
      padding: 12px;
      border-radius: 9px;
      font-weight: bold;
    }

    .stocktaking-aggregation-notice {
      background-color: #e0f2f1;
      color: #004d40;
    }

    .stocktaking-aggregation-safety {
      background-color: #fff3e0;
      color: #e65100;
    }

    .stocktaking-aggregation-message {
      background-color: #e3f2fd;
      color: #0d47a1;
    }

    .stocktaking-aggregation-panel {
      margin: 22px 0;
      padding: 18px;
      border: 2px solid #80cbc4;
      border-radius: 12px;
      background-color: #fbffff;
    }

    .stocktaking-aggregation-panel h3 {
      margin-top: 0;
      color: #00695c;
    }

    #stocktaking-submission-file-input,
    #stocktaking-aggregation-date-filter {
      width: 100%;
      max-width: 620px;
      min-height: 48px;
      margin: 8px 0 14px;
      padding: 9px;
      font-size: 17px;
      box-sizing: border-box;
    }

    .stocktaking-aggregation-table-area {
      width: 100%;
      overflow-x: auto;
      margin: 14px 0;
    }

    .stocktaking-submission-preview-table,
    .stocktaking-imported-submission-table,
    .stocktaking-aggregation-result-table {
      width: 100%;
      min-width: 1050px;
      border-collapse: collapse;
    }

    .stocktaking-aggregation-result-table {
      min-width: 1550px;
    }

    .stocktaking-submission-preview-table th,
    .stocktaking-submission-preview-table td,
    .stocktaking-imported-submission-table th,
    .stocktaking-imported-submission-table td,
    .stocktaking-aggregation-result-table th,
    .stocktaking-aggregation-result-table td {
      padding: 10px;
      border: 1px solid #cfd8dc;
      text-align: left;
      vertical-align: top;
    }

    .stocktaking-submission-preview-table th,
    .stocktaking-imported-submission-table th,
    .stocktaking-aggregation-result-table th {
      background-color: #00695c;
      color: #ffffff;
      white-space: nowrap;
    }

    .stocktaking-transfer-valid {
      background-color: #e8f5e9;
    }

    .stocktaking-transfer-warning {
      background-color: #fff8e1;
    }

    .stocktaking-transfer-error {
      background-color: #ffebee;
    }

    .stocktaking-transfer-result-badge {
      display: inline-block;
      padding: 5px 9px;
      border-radius: 18px;
      font-weight: bold;
      white-space: nowrap;
    }

    .stocktaking-transfer-result-ok {
      background-color: #c8e6c9;
      color: #1b5e20;
    }

    .stocktaking-transfer-result-shortage {
      background-color: #ffcdd2;
      color: #b71c1c;
    }

    .stocktaking-transfer-result-surplus {
      background-color: #ffe0b2;
      color: #e65100;
    }

    .stocktaking-transfer-result-check {
      background-color: #fff59d;
      color: #795548;
    }

    .stocktaking-transfer-result-unchecked {
      background-color: #cfd8dc;
      color: #455a64;
    }

    .stocktaking-aggregation-summary {
      display: grid;
      grid-template-columns:
        repeat(auto-fit, minmax(150px, 1fr));
      gap: 10px;
      margin: 16px 0;
    }

    .stocktaking-aggregation-summary p {
      margin: 0;
      padding: 12px;
      border-radius: 9px;
      background-color: #e0f2f1;
      text-align: center;
      font-weight: bold;
    }

    .stocktaking-delete-submission-button {
      margin: 0;
      padding: 8px 10px;
      background-color: #c62828;
      font-size: 14px;
      white-space: nowrap;
    }

    #import-stocktaking-submissions-button,
    #export-stocktaking-aggregation-csv-button {
      background-color: #00796b;
    }

    #import-stocktaking-submissions-button:disabled,
    #export-stocktaking-aggregation-csv-button:disabled {
      background-color: #90a4ae;
      cursor: not-allowed;
    }

    @media (max-width: 700px) {
      #stocktaking-aggregation {
        padding-left: 12px;
        padding-right: 12px;
      }

      .stocktaking-aggregation-panel {
        padding: 13px;
      }

      #stocktaking-aggregation button {
        width: 100%;
        margin: 6px 0;
      }
    }
  `;

  document.head.appendChild(style);
}

async function exportStocktakingSubmission(
  session
) {
  if (!session || !session.id) {
    alert(
      "提出ファイルを作成する棚卸が見つかりません。"
    );

    return;
  }

  const items =
    Array.isArray(session.items)
      ? session.items
      : [];

  const uncheckedCount =
    items.filter(function (item) {
      return !isTransferItemChecked(item);
    }).length;

  if (uncheckedCount > 0) {
    const continueExport =
      window.confirm(
        "未確認の商品が残っています。\n\n" +
        `未確認：${uncheckedCount}件\n\n` +
        "このまま提出ファイルを出力しますか？"
      );

    if (!continueExport) {
      return;
    }
  }

  const exportedAt =
    new Date().toISOString();

  const submission = {
    format:
      STOCKTAKING_SUBMISSION_FORMAT,
    formatVersion:
      STOCKTAKING_SUBMISSION_FORMAT_VERSION,
    appVersion:
      STOCKTAKING_TRANSFER_APP_VERSION,
    submissionId:
      `stocktaking-submission-${session.id}`,
    exportedAt: exportedAt,
    stocktaking: {
      sourceSessionId:
        session.id,
      stocktakingDate:
        session.stocktakingDate || "",
      person:
        session.person || "",
      location:
        session.location || "",
      status:
        session.status || "",
      startedAt:
        session.startedAt || "",
      updatedAt:
        session.updatedAt || "",
      confirmedAt:
        session.confirmedAt || "",
      reflectedToInventory:
        session.reflectedToInventory ===
        true,
      items:
        items.map(
          createTransferSubmissionItem
        )
    }
  };

  const jsonText =
    JSON.stringify(
      submission,
      null,
      2
    );

  const fileName =
    createStocktakingSubmissionFileName(
      submission
    );

  downloadTransferTextFile(
    jsonText,
    fileName,
    "application/json;charset=utf-8"
  );
}

function createTransferSubmissionItem(item) {
  return {
    internalCode:
      String(item.internalCode || ""),
    productCode:
      String(item.productCode || ""),
    productName:
      String(item.productName || ""),
    janCode:
      String(item.janCode || ""),
    registeredLocation:
      String(item.location || ""),
    registeredStock:
      normalizeTransferNonNegativeInteger(
        item.registeredStock,
        0
      ),
    locationBreakdown:
      normalizeTransferLocationBreakdown(
        item.locationBreakdown
      ),
    actualStock:
      isTransferItemChecked(item)
        ? normalizeTransferNonNegativeInteger(
            item.actualStock,
            0
          )
        : "",
    difference:
      Number.isInteger(
        Number(item.difference)
      )
        ? Number(item.difference)
        : null,
    result:
      String(item.result || "未確認"),
    bulkZeroApplied:
      item.bulkZeroApplied === true,
    bulkZeroAppliedAt:
      String(
        item.bulkZeroAppliedAt || ""
      ),
    memo:
      String(item.memo || ""),
    checkedAt:
      String(item.checkedAt || "")
  };
}

function createStocktakingSubmissionFileName(
  submission
) {
  const stocktaking =
    submission.stocktaking;

  const dateText =
    sanitizeTransferFileNamePart(
      stocktaking.stocktakingDate ||
      "日付未登録"
    );

  const locationText =
    sanitizeTransferFileNamePart(
      stocktaking.location ||
      "場所未登録"
    );

  const personText =
    sanitizeTransferFileNamePart(
      stocktaking.person ||
      "担当者未登録"
    );

  return (
    `棚卸提出_${dateText}_${locationText}_${personText}.json`
  );
}

async function openStocktakingAggregationScreen() {
  hideAllScreensForStocktakingAggregation();

  stocktakingAggregationScreen.hidden =
    false;

  selectedStocktakingSubmissionFiles = [];

  stocktakingSubmissionFileInput.value =
    "";

  renderStocktakingSubmissionPreview();

  await reloadImportedStocktakingSubmissions();

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

async function previewSelectedStocktakingSubmissionFiles() {
  const files =
    Array.from(
      stocktakingSubmissionFileInput.files || []
    );

  if (files.length === 0) {
    selectedStocktakingSubmissionFiles = [];
    renderStocktakingSubmissionPreview();
    return;
  }

  stocktakingSubmissionPreviewMessage.textContent =
    "ファイルを確認しています。";

  const existingSubmissions =
    await getAllStocktakingSubmissions();

  const existingIds =
    new Set(
      existingSubmissions.map(
        function (submission) {
          return submission.submissionId;
        }
      )
    );

  const selectedIds = new Set();
  const previews = [];

  for (const file of files) {
    try {
      const text =
        await file.text();

      const rawData =
        JSON.parse(text);

      const validated =
        validateAndNormalizeStocktakingSubmission(
          rawData
        );

      if (!validated.valid) {
        previews.push({
          fileName: file.name,
          valid: false,
          duplicate: false,
          message: validated.message,
          submission: null
        });

        continue;
      }

      const submission =
        validated.submission;

      const isExistingDuplicate =
        existingIds.has(
          submission.submissionId
        );

      const isSelectedDuplicate =
        selectedIds.has(
          submission.submissionId
        );

      selectedIds.add(
        submission.submissionId
      );

      previews.push({
        fileName: file.name,
        valid:
          !isExistingDuplicate &&
          !isSelectedDuplicate,
        duplicate:
          isExistingDuplicate ||
          isSelectedDuplicate,
        message:
          isExistingDuplicate
            ? "すでに取り込み済みです。"
            : (
                isSelectedDuplicate
                  ? "同じ提出ファイルが重複して選択されています。"
                  : validated.message
              ),
        submission: submission
      });
    } catch (error) {
      console.error(error);

      previews.push({
        fileName: file.name,
        valid: false,
        duplicate: false,
        message:
          "JSON形式を読み込めませんでした。",
        submission: null
      });
    }
  }

  selectedStocktakingSubmissionFiles =
    previews;

  renderStocktakingSubmissionPreview();
}

function renderStocktakingSubmissionPreview() {
  stocktakingSubmissionPreviewBody.innerHTML =
    "";

  if (
    selectedStocktakingSubmissionFiles.length ===
    0
  ) {
    stocktakingSubmissionPreviewBody.innerHTML = `
      <tr>
        <td colspan="6">
          ファイルを選択すると確認結果が表示されます。
        </td>
      </tr>
    `;

    stocktakingSubmissionPreviewMessage.textContent =
      "まだファイルを選択していません。";

    importStocktakingSubmissionsButton.disabled =
      true;

    return;
  }

  let importableCount = 0;

  selectedStocktakingSubmissionFiles.forEach(
    function (preview) {
      const row =
        document.createElement("tr");

      if (preview.valid) {
        row.classList.add(
          "stocktaking-transfer-valid"
        );

        importableCount += 1;
      } else if (preview.duplicate) {
        row.classList.add(
          "stocktaking-transfer-warning"
        );
      } else {
        row.classList.add(
          "stocktaking-transfer-error"
        );
      }

      appendTransferCell(
        row,
        preview.fileName
      );

      const stocktaking =
        preview.submission
          ? preview.submission.stocktaking
          : null;

      appendTransferCell(
        row,
        stocktaking
          ? stocktaking.stocktakingDate
          : "確認不可"
      );

      appendTransferCell(
        row,
        stocktaking
          ? stocktaking.person
          : "確認不可"
      );

      appendTransferCell(
        row,
        stocktaking
          ? stocktaking.location
          : "確認不可"
      );

      appendTransferCell(
        row,
        stocktaking
          ? `${stocktaking.items.length}件`
          : "確認不可"
      );

      appendTransferCell(
        row,
        preview.valid
          ? `取込可能：${preview.message}`
          : preview.message
      );

      stocktakingSubmissionPreviewBody.appendChild(
        row
      );
    }
  );

  stocktakingSubmissionPreviewMessage.textContent =
    `選択：${selectedStocktakingSubmissionFiles.length}件 / ` +
    `取込可能：${importableCount}件`;

  importStocktakingSubmissionsButton.disabled =
    importableCount === 0;
}

async function importSelectedStocktakingSubmissions() {
  const importablePreviews =
    selectedStocktakingSubmissionFiles.filter(
      function (preview) {
        return (
          preview.valid &&
          preview.submission
        );
      }
    );

  if (importablePreviews.length === 0) {
    alert(
      "取り込める提出ファイルがありません。"
    );

    return;
  }

  const confirmed =
    window.confirm(
      `${importablePreviews.length}件の提出ファイルを取り込みますか？\n\n` +
      "取り込み後、商品・保管場所の重複や数量の食い違いを集約結果で確認してください。"
    );

  if (!confirmed) {
    return;
  }

  importStocktakingSubmissionsButton.disabled =
    true;

  let importedCount = 0;
  let failedCount = 0;

  for (const preview of importablePreviews) {
    const submission = {
      ...preview.submission,
      importedAt:
        new Date().toISOString(),
      sourceFileName:
        preview.fileName
    };

    try {
      await saveStocktakingSubmission(
        submission
      );

      importedCount += 1;
    } catch (error) {
      console.error(error);
      failedCount += 1;
    }
  }

  alert(
    `取り込み完了：${importedCount}件\n` +
    `取り込み失敗：${failedCount}件`
  );

  selectedStocktakingSubmissionFiles = [];
  stocktakingSubmissionFileInput.value =
    "";

  renderStocktakingSubmissionPreview();
  await reloadImportedStocktakingSubmissions();
}

async function reloadImportedStocktakingSubmissions() {
  try {
    importedStocktakingSubmissions =
      await getAllStocktakingSubmissions();

    importedStocktakingSubmissions.sort(
      function (submissionA, submissionB) {
        return (
          new Date(
            submissionB.importedAt || ""
          ).getTime() -
          new Date(
            submissionA.importedAt || ""
          ).getTime()
        );
      }
    );

    renderImportedStocktakingSubmissions();
    rebuildStocktakingAggregationDateFilter();
    updateStocktakingAggregationResults();
  } catch (error) {
    console.error(error);

    stocktakingImportedSubmissionMessage.textContent =
      "取り込み済みの提出を読み込めませんでした。";

    alert(
      "取り込み済みの棚卸提出データを読み込めませんでした。"
    );
  }
}

function renderImportedStocktakingSubmissions() {
  stocktakingImportedSubmissionBody.innerHTML =
    "";

  stocktakingImportedSubmissionMessage.textContent =
    `取り込み済み：${importedStocktakingSubmissions.length}件`;

  if (
    importedStocktakingSubmissions.length ===
    0
  ) {
    stocktakingImportedSubmissionBody.innerHTML = `
      <tr>
        <td colspan="7">
          取り込み済みの提出はありません。
        </td>
      </tr>
    `;

    return;
  }

  importedStocktakingSubmissions.forEach(
    function (submission) {
      const stocktaking =
        submission.stocktaking;

      const row =
        document.createElement("tr");

      appendTransferCell(
        row,
        stocktaking.stocktakingDate ||
        "日付未登録"
      );

      appendTransferCell(
        row,
        stocktaking.person ||
        "担当者未登録"
      );

      appendTransferCell(
        row,
        stocktaking.location ||
        "場所未登録"
      );

      appendTransferCell(
        row,
        stocktaking.status ||
        "状態不明"
      );

      appendTransferCell(
        row,
        `${stocktaking.items.length}件`
      );

      appendTransferCell(
        row,
        formatTransferDateTime(
          submission.importedAt
        )
      );

      const actionCell =
        document.createElement("td");

      const deleteButton =
        document.createElement("button");

      deleteButton.type = "button";
      deleteButton.textContent =
        "取り込みを削除";

      deleteButton.classList.add(
        "stocktaking-delete-submission-button"
      );

      deleteButton.addEventListener(
        "click",
        function () {
          removeImportedStocktakingSubmission(
            submission
          );
        }
      );

      actionCell.appendChild(
        deleteButton
      );

      row.appendChild(actionCell);

      stocktakingImportedSubmissionBody.appendChild(
        row
      );
    }
  );
}

async function removeImportedStocktakingSubmission(
  submission
) {
  const stocktaking =
    submission.stocktaking;

  const confirmed =
    window.confirm(
      "この取り込みデータを削除しますか？\n\n" +
      `棚卸日：${stocktaking.stocktakingDate}\n` +
      `担当者：${stocktaking.person}\n` +
      `保管場所：${stocktaking.location}\n\n` +
      "元の提出ファイルは削除されません。"
    );

  if (!confirmed) {
    return;
  }

  try {
    await deleteStocktakingSubmission(
      submission.submissionId
    );

    await reloadImportedStocktakingSubmissions();
  } catch (error) {
    console.error(error);

    alert(
      "取り込みデータを削除できませんでした。"
    );
  }
}

function rebuildStocktakingAggregationDateFilter() {
  const previousValue =
    stocktakingAggregationDateFilter.value;

  const dates =
    Array.from(
      new Set(
        importedStocktakingSubmissions.map(
          function (submission) {
            return (
              submission.stocktaking.stocktakingDate ||
              "日付未登録"
            );
          }
        )
      )
    ).sort();

  stocktakingAggregationDateFilter.innerHTML =
    '<option value="">すべての棚卸日</option>';

  dates.forEach(function (dateText) {
    const option =
      document.createElement("option");

    option.value = dateText;
    option.textContent = dateText;

    stocktakingAggregationDateFilter.appendChild(
      option
    );
  });

  if (dates.includes(previousValue)) {
    stocktakingAggregationDateFilter.value =
      previousValue;
  }
}

function updateStocktakingAggregationResults() {
  const selectedDate =
    stocktakingAggregationDateFilter
      ? stocktakingAggregationDateFilter.value
      : "";

  const targetSubmissions =
    importedStocktakingSubmissions.filter(
      function (submission) {
        if (selectedDate === "") {
          return true;
        }

        return (
          submission.stocktaking.stocktakingDate ===
          selectedDate
        );
      }
    );

  currentStocktakingAggregationRows =
    buildStocktakingAggregationRows(
      targetSubmissions
    );

  renderStocktakingAggregationSummary(
    targetSubmissions,
    currentStocktakingAggregationRows
  );

  renderStocktakingAggregationRows(
    currentStocktakingAggregationRows
  );

  exportStocktakingAggregationCsvButton.disabled =
    currentStocktakingAggregationRows.length ===
    0;
}

function buildStocktakingAggregationRows(
  submissions
) {
  const productGroups = new Map();

  submissions.forEach(
    function (submission) {
      const stocktaking =
        submission.stocktaking;

      stocktaking.items.forEach(
        function (item) {
          const dateText =
            stocktaking.stocktakingDate ||
            "日付未登録";

          const internalCode =
            String(
              item.internalCode || ""
            ).trim();

          const productKey =
            `${dateText}::${internalCode}`;

          if (!productGroups.has(productKey)) {
            productGroups.set(
              productKey,
              {
                stocktakingDate:
                  dateText,
                internalCode:
                  internalCode,
                productCode:
                  item.productCode || "",
                productName:
                  item.productName || "",
                productCodes:
                  new Set(),
                productNames:
                  new Set(),
                registeredStocks:
                  new Set(),
                people:
                  new Set(),
                submissionIds:
                  new Set(),
                bulkZeroSubmissionIds:
                  new Set(),
                locations:
                  new Map(),
                warnings: []
              }
            );
          }

          const group =
            productGroups.get(
              productKey
            );

          group.people.add(
            stocktaking.person ||
            "担当者未登録"
          );

          group.productCodes.add(
            String(item.productCode || "")
          );

          group.productNames.add(
            String(item.productName || "")
          );

          if (
            stocktaking.status !==
            "確定済み"
          ) {
            group.warnings.push(
              `${stocktaking.person || "担当者未登録"}の提出は未確定です。`
            );
          }

          group.submissionIds.add(
            submission.submissionId
          );

          group.registeredStocks.add(
            normalizeTransferNonNegativeInteger(
              item.registeredStock,
              0
            )
          );

          if (item.bulkZeroApplied === true) {
            group.bulkZeroSubmissionIds.add(
              submission.submissionId
            );
          }

          if (!isTransferItemChecked(item)) {
            group.warnings.push(
              `${stocktaking.person || "担当者未登録"}の提出に未確認の商品があります。`
            );

            return;
          }

          const locationEntries =
            getTransferAggregationLocationEntries(
              item,
              stocktaking
            );

          if (locationEntries.length === 0) {
            group.warnings.push(
              "実在庫の保管場所を確認できません。"
            );

            return;
          }

          locationEntries.forEach(
            function (entry) {
              const locationKey =
                normalizeTransferText(
                  entry.location
                );

              if (!group.locations.has(locationKey)) {
                group.locations.set(
                  locationKey,
                  {
                    location:
                      entry.location,
                    observations: []
                  }
                );
              }

              group.locations
                .get(locationKey)
                .observations.push({
                  quantity:
                    entry.quantity,
                  submissionId:
                    submission.submissionId,
                  person:
                    stocktaking.person ||
                    "担当者未登録",
                  sourceLocation:
                    stocktaking.location ||
                    "場所未登録",
                  bulkZeroApplied:
                    item.bulkZeroApplied ===
                    true
                });
            }
          );
        }
      );
    }
  );

  const rows = [];

  productGroups.forEach(
    function (group) {
      const warnings =
        Array.from(
          new Set(group.warnings)
        );

      const productCodeValues =
        Array.from(group.productCodes).filter(
          function (value) {
            return value !== "";
          }
        );

      const productNameValues =
        Array.from(group.productNames).filter(
          function (value) {
            return value !== "";
          }
        );

      if (productCodeValues.length > 1) {
        warnings.push(
          "提出ファイル間で商品コードが一致しません。"
        );
      }

      if (productNameValues.length > 1) {
        warnings.push(
          "提出ファイル間で商品名が一致しません。"
        );
      }

      const registeredStockValues =
        Array.from(
          group.registeredStocks
        );

      let registeredStock = null;

      if (registeredStockValues.length === 1) {
        registeredStock =
          registeredStockValues[0];
      } else if (
        registeredStockValues.length > 1
      ) {
        warnings.push(
          "提出ファイル間で登録在庫が一致しません。"
        );
      }

      let hasLocationConflict = false;
      let actualStockTotal = 0;
      let hasActualStock = false;
      const locationBreakdownTexts = [];

      group.locations.forEach(
        function (locationGroup) {
          const quantities =
            Array.from(
              new Set(
                locationGroup.observations.map(
                  function (observation) {
                    return observation.quantity;
                  }
                )
              )
            );

          if (quantities.length === 1) {
            const quantity = quantities[0];

            actualStockTotal += quantity;
            hasActualStock = true;

            let locationText =
              `${locationGroup.location}：${quantity}個`;

            if (
              locationGroup.observations.length > 1
            ) {
              locationText +=
                `（同じ場所の提出${locationGroup.observations.length}件）`;

              warnings.push(
                `保管場所「${locationGroup.location}」が複数の提出に含まれています。同数のため1件分だけ集計しました。`
              );
            }

            locationBreakdownTexts.push(
              locationText
            );

            return;
          }

          hasLocationConflict = true;

          const quantityText =
            quantities
              .map(function (quantity) {
                return `${quantity}個`;
              })
              .join(" / ");

          locationBreakdownTexts.push(
            `${locationGroup.location}：${quantityText}（要確認）`
          );

          warnings.push(
            `保管場所「${locationGroup.location}」の数量が一致しません。`
          );
        }
      );

      let result = "未確認";
      let difference = null;
      let finalActualStock = null;

      if (
        hasLocationConflict ||
        registeredStock === null
      ) {
        result = "要確認";
      } else if (hasActualStock) {
        finalActualStock =
          actualStockTotal;

        difference =
          finalActualStock -
          registeredStock;

        if (difference === 0) {
          result = "差異なし";
        } else if (difference < 0) {
          result = "在庫不足";
        } else {
          result = "在庫過剰";
        }
      }

      rows.push({
        stocktakingDate:
          group.stocktakingDate,
        result: result,
        internalCode:
          group.internalCode,
        productCode:
          group.productCode,
        productName:
          group.productName,
        registeredStock:
          registeredStock,
        actualStock:
          finalActualStock,
        difference:
          difference,
        locationBreakdown:
          locationBreakdownTexts.join(
            " / "
          ),
        people:
          Array.from(group.people).join(
            " / "
          ),
        submissionCount:
          group.submissionIds.size,
        bulkZeroCount:
          group.bulkZeroSubmissionIds.size,
        warnings:
          Array.from(
            new Set(warnings)
          ).join(" / ")
      });
    }
  );

  rows.sort(
    function (rowA, rowB) {
      const dateDifference =
        String(rowA.stocktakingDate).localeCompare(
          String(rowB.stocktakingDate),
          "ja"
        );

      if (dateDifference !== 0) {
        return dateDifference;
      }

      return String(
        rowA.internalCode
      ).localeCompare(
        String(rowB.internalCode),
        "ja",
        {
          numeric: true
        }
      );
    }
  );

  return rows;
}

function getTransferAggregationLocationEntries(
  item,
  stocktaking
) {
  const entries =
    normalizeTransferLocationBreakdown(
      item.locationBreakdown
    );

  if (entries.length > 0) {
    return entries;
  }

  if (!isTransferItemChecked(item)) {
    return [];
  }

  let fallbackLocation =
    String(
      item.registeredLocation ||
      ""
    ).trim();

  if (
    fallbackLocation === "" ||
    fallbackLocation === "未登録"
  ) {
    const sessionLocation =
      String(
        stocktaking.location || ""
      ).trim();

    fallbackLocation =
      sessionLocation ===
      "すべての保管場所"
        ? "未確認"
        : (
            sessionLocation ||
            "未確認"
          );
  }

  return [
    {
      location:
        fallbackLocation,
      quantity:
        normalizeTransferNonNegativeInteger(
          item.actualStock,
          0
        )
    }
  ];
}

function renderStocktakingAggregationSummary(
  submissions,
  rows
) {
  const checkCount =
    rows.filter(function (row) {
      return (
        row.result === "要確認" ||
        row.result === "未確認"
      );
    }).length;

  const differenceCount =
    rows.filter(function (row) {
      return (
        row.result === "在庫不足" ||
        row.result === "在庫過剰"
      );
    }).length;

  stocktakingAggregationSummary.innerHTML = `
    <p>
      対象提出：
      <strong>${submissions.length}</strong>件
    </p>

    <p>
      集約商品：
      <strong>${rows.length}</strong>件
    </p>

    <p>
      差異あり：
      <strong>${differenceCount}</strong>件
    </p>

    <p>
      要確認・未確認：
      <strong>${checkCount}</strong>件
    </p>
  `;
}

function renderStocktakingAggregationRows(
  rows
) {
  stocktakingAggregationBody.innerHTML =
    "";

  if (rows.length === 0) {
    stocktakingAggregationBody.innerHTML = `
      <tr>
        <td colspan="12">
          集約できる提出データがありません。
        </td>
      </tr>
    `;

    return;
  }

  rows.forEach(function (resultRow) {
    const row =
      document.createElement("tr");

    if (
      resultRow.result === "要確認" ||
      resultRow.result === "未確認"
    ) {
      row.classList.add(
        "stocktaking-transfer-warning"
      );
    } else if (
      resultRow.result === "在庫不足"
    ) {
      row.classList.add(
        "stocktaking-transfer-error"
      );
    } else {
      row.classList.add(
        "stocktaking-transfer-valid"
      );
    }

    appendTransferCell(
      row,
      resultRow.stocktakingDate
    );

    appendTransferResultCell(
      row,
      resultRow.result
    );

    appendTransferCell(
      row,
      resultRow.internalCode ||
      "未登録"
    );

    appendTransferCell(
      row,
      resultRow.productCode ||
      "未登録"
    );

    appendTransferCell(
      row,
      resultRow.productName ||
      "未登録"
    );

    appendTransferCell(
      row,
      resultRow.registeredStock ===
        null
        ? "要確認"
        : resultRow.registeredStock
    );

    appendTransferCell(
      row,
      resultRow.actualStock === null
        ? "要確認"
        : resultRow.actualStock
    );

    appendTransferCell(
      row,
      formatTransferDifference(
        resultRow.difference
      )
    );

    appendTransferCell(
      row,
      resultRow.locationBreakdown ||
      "未確認"
    );

    appendTransferCell(
      row,
      resultRow.people
    );

    appendTransferCell(
      row,
      `${resultRow.submissionCount}件`
    );

    appendTransferCell(
      row,
      resultRow.warnings ||
      "なし"
    );

    stocktakingAggregationBody.appendChild(
      row
    );
  });
}

function exportStocktakingAggregationCsv() {
  if (
    currentStocktakingAggregationRows.length ===
    0
  ) {
    alert(
      "CSV出力する集約結果がありません。"
    );

    return;
  }

  const headers = [
    "棚卸日",
    "結果",
    "社内コード",
    "商品コード",
    "商品名",
    "登録在庫",
    "集約実在庫",
    "差異",
    "保管場所別内訳",
    "担当者",
    "提出数",
    "一括0入力提出数",
    "警告"
  ];

  const csvRows = [headers];

  currentStocktakingAggregationRows.forEach(
    function (row) {
      csvRows.push([
        row.stocktakingDate,
        row.result,
        row.internalCode,
        row.productCode,
        row.productName,
        row.registeredStock === null
          ? "要確認"
          : row.registeredStock,
        row.actualStock === null
          ? "要確認"
          : row.actualStock,
        row.difference === null
          ? "要確認"
          : row.difference,
        row.locationBreakdown,
        row.people,
        row.submissionCount,
        row.bulkZeroCount,
        row.warnings
      ]);
    }
  );

  const csvText =
    "\uFEFF" +
    csvRows
      .map(function (row) {
        return row
          .map(escapeTransferCsvValue)
          .join(",");
      })
      .join("\r\n");

  const selectedDate =
    stocktakingAggregationDateFilter.value;

  const datePart =
    selectedDate ||
    getTransferTodayText();

  downloadTransferTextFile(
    csvText,
    `棚卸集約結果_${sanitizeTransferFileNamePart(datePart)}.csv`,
    "text/csv;charset=utf-8"
  );
}

function validateAndNormalizeStocktakingSubmission(
  rawData
) {
  if (
    !rawData ||
    rawData.format !==
      STOCKTAKING_SUBMISSION_FORMAT
  ) {
    return {
      valid: false,
      message:
        "このアプリの棚卸提出ファイルではありません。"
    };
  }

  if (
    Number(rawData.formatVersion) !==
      STOCKTAKING_SUBMISSION_FORMAT_VERSION
  ) {
    return {
      valid: false,
      message:
        "提出ファイルの形式バージョンに対応していません。"
    };
  }

  if (
    typeof rawData.submissionId !==
      "string" ||
    rawData.submissionId.trim() === ""
  ) {
    return {
      valid: false,
      message:
        "提出ファイルの識別番号がありません。"
    };
  }

  const stocktaking =
    rawData.stocktaking;

  if (
    !stocktaking ||
    !Array.isArray(stocktaking.items)
  ) {
    return {
      valid: false,
      message:
        "棚卸商品データを確認できません。"
    };
  }

  const normalizedItems = [];
  let uncheckedCount = 0;

  for (const item of stocktaking.items) {
    const internalCode =
      String(item.internalCode || "").trim();

    if (internalCode === "") {
      return {
        valid: false,
        message:
          "社内コードが空欄の商品があります。"
      };
    }

    const checked =
      isTransferItemChecked(item);

    if (!checked) {
      uncheckedCount += 1;
    }

    normalizedItems.push({
      internalCode:
        internalCode,
      productCode:
        String(item.productCode || ""),
      productName:
        String(item.productName || ""),
      janCode:
        String(item.janCode || ""),
      registeredLocation:
        String(
          item.registeredLocation ||
          item.location ||
          ""
        ),
      registeredStock:
        normalizeTransferNonNegativeInteger(
          item.registeredStock,
          0
        ),
      locationBreakdown:
        normalizeTransferLocationBreakdown(
          item.locationBreakdown
        ),
      actualStock:
        checked
          ? normalizeTransferNonNegativeInteger(
              item.actualStock,
              0
            )
          : "",
      difference:
        item.difference === null ||
        item.difference === undefined
          ? null
          : Number(item.difference),
      result:
        String(item.result || "未確認"),
      bulkZeroApplied:
        item.bulkZeroApplied === true,
      bulkZeroAppliedAt:
        String(
          item.bulkZeroAppliedAt || ""
        ),
      memo:
        String(item.memo || ""),
      checkedAt:
        String(item.checkedAt || "")
    });
  }

  const normalizedSubmission = {
    format:
      STOCKTAKING_SUBMISSION_FORMAT,
    formatVersion:
      STOCKTAKING_SUBMISSION_FORMAT_VERSION,
    appVersion:
      String(rawData.appVersion || ""),
    submissionId:
      rawData.submissionId.trim(),
    exportedAt:
      String(rawData.exportedAt || ""),
    sourceSessionId:
      String(
        stocktaking.sourceSessionId || ""
      ),
    stocktakingDate:
      String(
        stocktaking.stocktakingDate || ""
      ),
    stocktaking: {
      sourceSessionId:
        String(
          stocktaking.sourceSessionId || ""
        ),
      stocktakingDate:
        String(
          stocktaking.stocktakingDate || ""
        ),
      person:
        String(stocktaking.person || ""),
      location:
        String(stocktaking.location || ""),
      status:
        String(stocktaking.status || ""),
      startedAt:
        String(stocktaking.startedAt || ""),
      updatedAt:
        String(stocktaking.updatedAt || ""),
      confirmedAt:
        String(stocktaking.confirmedAt || ""),
      reflectedToInventory:
        stocktaking.reflectedToInventory ===
        true,
      items:
        normalizedItems
    }
  };

  normalizedSubmission.person =
    normalizedSubmission.stocktaking.person;

  normalizedSubmission.location =
    normalizedSubmission.stocktaking.location;

  const messageParts = [];

  if (
    normalizedSubmission.stocktaking.status !==
    "確定済み"
  ) {
    messageParts.push(
      "棚卸が未確定です。"
    );
  }

  if (uncheckedCount > 0) {
    messageParts.push(
      `未確認商品が${uncheckedCount}件あります。`
    );
  }

  if (messageParts.length === 0) {
    messageParts.push(
      "形式に問題はありません。"
    );
  }

  const message =
    messageParts.join(" ");

  return {
    valid: true,
    message: message,
    submission:
      normalizedSubmission
  };
}

function normalizeTransferLocationBreakdown(
  locationBreakdown
) {
  if (!Array.isArray(locationBreakdown)) {
    return [];
  }

  return locationBreakdown
    .map(function (entry) {
      const location =
        String(entry.location || "").trim();

      const quantityText =
        String(
          entry.quantity === undefined ||
          entry.quantity === null
            ? ""
            : entry.quantity
        ).trim();

      const quantity =
        Number(quantityText);

      if (
        location === "" ||
        quantityText === "" ||
        !Number.isInteger(quantity) ||
        quantity < 0
      ) {
        return null;
      }

      return {
        location: location,
        quantity: quantity
      };
    })
    .filter(function (entry) {
      return entry !== null;
    });
}

function isTransferItemChecked(item) {
  if (!item) {
    return false;
  }

  if (
    item.actualStock === "" ||
    item.actualStock === null ||
    item.actualStock === undefined
  ) {
    return false;
  }

  const actualStock =
    Number(item.actualStock);

  return (
    Number.isInteger(actualStock) &&
    actualStock >= 0
  );
}

function normalizeTransferNonNegativeInteger(
  value,
  fallback
) {
  const numberValue =
    Number(value);

  if (
    !Number.isInteger(numberValue) ||
    numberValue < 0
  ) {
    return fallback;
  }

  return numberValue;
}

function appendTransferCell(row, value) {
  const cell =
    document.createElement("td");

  cell.textContent =
    String(
      value === undefined ||
      value === null
        ? ""
        : value
    );

  row.appendChild(cell);
}

function appendTransferResultCell(
  row,
  result
) {
  const cell =
    document.createElement("td");

  const badge =
    document.createElement("span");

  badge.classList.add(
    "stocktaking-transfer-result-badge"
  );

  if (result === "差異なし") {
    badge.classList.add(
      "stocktaking-transfer-result-ok"
    );
  } else if (result === "在庫不足") {
    badge.classList.add(
      "stocktaking-transfer-result-shortage"
    );
  } else if (result === "在庫過剰") {
    badge.classList.add(
      "stocktaking-transfer-result-surplus"
    );
  } else if (result === "要確認") {
    badge.classList.add(
      "stocktaking-transfer-result-check"
    );
  } else {
    badge.classList.add(
      "stocktaking-transfer-result-unchecked"
    );
  }

  badge.textContent = result;
  cell.appendChild(badge);
  row.appendChild(cell);
}

function formatTransferDifference(
  difference
) {
  if (difference === null) {
    return "要確認";
  }

  if (difference > 0) {
    return `＋${difference}`;
  }

  return String(difference);
}

function escapeTransferCsvValue(value) {
  const text =
    String(
      value === undefined ||
      value === null
        ? ""
        : value
    );

  return (
    '"' +
    text.replace(/"/g, '""') +
    '"'
  );
}

function sanitizeTransferFileNamePart(value) {
  const text =
    String(value || "")
      .normalize("NFKC")
      .trim()
      .replace(/[\\/:*?"<>|]/g, "_")
      .replace(/\s+/g, "_");

  return text || "未登録";
}

function normalizeTransferText(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLowerCase()
    .trim();
}

function formatTransferDateTime(dateTimeText) {
  const date =
    new Date(dateTimeText || "");

  if (Number.isNaN(date.getTime())) {
    return "記録なし";
  }

  return date.toLocaleString("ja-JP");
}

function getTransferTodayText() {
  const today = new Date();

  const year =
    today.getFullYear();

  const month =
    String(today.getMonth() + 1).padStart(
      2,
      "0"
    );

  const day =
    String(today.getDate()).padStart(
      2,
      "0"
    );

  return `${year}-${month}-${day}`;
}

function downloadTransferTextFile(
  text,
  fileName,
  mimeType
) {
  const blob =
    new Blob(
      [text],
      {
        type: mimeType
      }
    );

  const url =
    URL.createObjectURL(blob);

  const link =
    document.createElement("a");

  link.href = url;
  link.download = fileName;

  document.body.appendChild(link);
  link.click();
  link.remove();

  window.setTimeout(
    function () {
      URL.revokeObjectURL(url);
    },
    1000
  );
}

function returnHomeFromStocktakingAggregation() {
  stocktakingAggregationScreen.hidden =
    true;

  window.inventoryApp.showScreen(
    "home"
  );
}

function hideAllScreensForStocktakingAggregation() {
  const screens =
    document.querySelectorAll(
      "main > section"
    );

  screens.forEach(function (screen) {
    screen.hidden = true;
  });
}
