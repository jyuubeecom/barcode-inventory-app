"use strict";

const STOCKTAKING_SUBMISSION_FORMAT =
  "barcode-inventory-stocktaking-submission";

const STOCKTAKING_SUBMISSION_FORMAT_VERSION =
  1;

const STOCKTAKING_TRANSFER_APP_VERSION =
  "v22";

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

let stocktakingReflectionPersonInput = null;
let previewStocktakingReflectionButton = null;
let applyStocktakingReflectionButton = null;
let exportStocktakingReflectionCsvButton = null;
let stocktakingReflectionMessage = null;
let stocktakingReflectionBody = null;

let stocktakingSubmissionPreviewPagination = null;
let stocktakingImportedSubmissionPagination = null;
let stocktakingAggregationPagination = null;
let stocktakingReflectionPagination = null;

const STOCKTAKING_TRANSFER_PAGE_SIZE = 20;

let stocktakingSubmissionPreviewPage = 1;
let stocktakingImportedSubmissionPage = 1;
let stocktakingAggregationPage = 1;
let stocktakingReflectionPage = 1;

let selectedStocktakingSubmissionFiles = [];
let importedStocktakingSubmissions = [];
let currentStocktakingAggregationRows = [];
let currentStocktakingReflectionPreview = null;
let latestStocktakingReflection = null;

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
      現在庫は自動では変更されません。反映内容を確認し、「現在庫へ反映する」を押した場合だけ変更されます。
    </p>

    <nav
      id="stocktaking-aggregation-jump-nav"
      class="stocktaking-aggregation-jump-nav"
      aria-label="集約画面の移動"
    >
      <button
        type="button"
        data-stocktaking-panel-target="stocktaking-panel-files"
      >
        ファイル取込
      </button>

      <button
        type="button"
        data-stocktaking-panel-target="stocktaking-panel-imported"
      >
        取込済み
      </button>

      <button
        type="button"
        data-stocktaking-panel-target="stocktaking-panel-results"
      >
        集約結果
      </button>

      <button
        type="button"
        data-stocktaking-panel-target="stocktaking-panel-reflection"
      >
        反映確認
      </button>

      <button
        id="stocktaking-aggregation-top-button"
        type="button"
      >
        一番上へ
      </button>
    </nav>

    <details
      id="stocktaking-panel-files"
      class="stocktaking-aggregation-panel"
      open
    >
      <summary>
        <span>1. 提出ファイルを選ぶ</span>
        <small>JSONの選択・確認・取込</small>
      </summary>

      <div class="stocktaking-aggregation-panel-content">
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

        <div
          id="stocktaking-submission-preview-pagination"
          class="stocktaking-pagination"
        ></div>

        <button
          id="import-stocktaking-submissions-button"
          type="button"
          disabled
        >
          選択した提出ファイルを取り込む
        </button>
      </div>
    </details>

    <details
      id="stocktaking-panel-imported"
      class="stocktaking-aggregation-panel"
    >
      <summary>
        <span>2. 取り込み済みの提出</span>
        <small>提出ファイルの確認・削除</small>
      </summary>

      <div class="stocktaking-aggregation-panel-content">
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

        <div
          id="stocktaking-imported-submission-pagination"
          class="stocktaking-pagination"
        ></div>
      </div>
    </details>

    <details
      id="stocktaking-panel-results"
      class="stocktaking-aggregation-panel"
    >
      <summary>
        <span>3. 集約結果を確認する</span>
        <small>20件ずつ表示</small>
      </summary>

      <div class="stocktaking-aggregation-panel-content">
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
                <th>結果</th>
                <th>社内コード</th>
                <th>商品コード</th>
                <th>商品名</th>
                <th>登録在庫</th>
                <th>集約実在庫</th>
                <th>差異</th>
              </tr>
            </thead>

            <tbody id="stocktaking-aggregation-body">
              <tr>
                <td colspan="7">
                  提出ファイルを取り込むと集約結果が表示されます。
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div
          id="stocktaking-aggregation-pagination"
          class="stocktaking-pagination"
        ></div>

        <button
          id="export-stocktaking-aggregation-csv-button"
          type="button"
          disabled
        >
          集約結果をCSV出力する
        </button>
      </div>
    </details>

    <details
      id="stocktaking-panel-reflection"
      class="stocktaking-aggregation-panel stocktaking-reflection-panel"
    >
      <summary>
        <span>4. 集約結果を現在庫へ反映する</span>
        <small>確認表も20件ずつ表示</small>
      </summary>

      <div class="stocktaking-aggregation-panel-content">
        <p class="stocktaking-aggregation-safety">
          棚卸日を1日選び、反映内容を確認してから現在庫へ反映します。要確認・未確認・保管場所「未確認」が1件でもある場合は反映できません。
        </p>

        <label for="stocktaking-reflection-person">
          集約担当者（必須）
        </label>

        <input
          id="stocktaking-reflection-person"
          type="text"
          placeholder="例：担当者"
          autocomplete="name"
        >

        <p
          id="stocktaking-reflection-message"
          class="stocktaking-aggregation-message"
        >
          棚卸日を選び、「反映内容を確認する」を押してください。
        </p>

        <div class="stocktaking-aggregation-table-area">
          <table class="stocktaking-reflection-preview-table">
            <thead>
              <tr>
                <th>判定</th>
                <th>社内コード</th>
                <th>商品コード</th>
                <th>商品名</th>
                <th>現在庫</th>
                <th>集約実在庫</th>
                <th>変更数量</th>
                <th>保管場所別内訳</th>
                <th>確認内容</th>
              </tr>
            </thead>

            <tbody id="stocktaking-reflection-body">
              <tr>
                <td colspan="9">
                  反映内容はまだ確認されていません。
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div
          id="stocktaking-reflection-pagination"
          class="stocktaking-pagination"
        ></div>
      </div>
    </details>

    <div
      class="stocktaking-sticky-action-bar"
      aria-label="現在庫への反映操作"
    >
      <button
        id="preview-stocktaking-reflection-button"
        type="button"
      >
        反映内容を確認する
      </button>

      <button
        id="apply-stocktaking-reflection-button"
        type="button"
        disabled
      >
        現在庫へ反映する
      </button>

      <button
        id="export-stocktaking-reflection-csv-button"
        type="button"
        disabled
      >
        反映結果をCSV出力する
      </button>
    </div>

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

  stocktakingReflectionPersonInput =
    document.querySelector(
      "#stocktaking-reflection-person"
    );

  previewStocktakingReflectionButton =
    document.querySelector(
      "#preview-stocktaking-reflection-button"
    );

  applyStocktakingReflectionButton =
    document.querySelector(
      "#apply-stocktaking-reflection-button"
    );

  exportStocktakingReflectionCsvButton =
    document.querySelector(
      "#export-stocktaking-reflection-csv-button"
    );

  stocktakingReflectionMessage =
    document.querySelector(
      "#stocktaking-reflection-message"
    );

  stocktakingReflectionBody =
    document.querySelector(
      "#stocktaking-reflection-body"
    );

  stocktakingSubmissionPreviewPagination =
    document.querySelector(
      "#stocktaking-submission-preview-pagination"
    );

  stocktakingImportedSubmissionPagination =
    document.querySelector(
      "#stocktaking-imported-submission-pagination"
    );

  stocktakingAggregationPagination =
    document.querySelector(
      "#stocktaking-aggregation-pagination"
    );

  stocktakingReflectionPagination =
    document.querySelector(
      "#stocktaking-reflection-pagination"
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
    function () {
      stocktakingAggregationPage = 1;
      stocktakingReflectionPage = 1;
      updateStocktakingAggregationResults();
    }
  );

  exportStocktakingAggregationCsvButton.addEventListener(
    "click",
    exportStocktakingAggregationCsv
  );

  previewStocktakingReflectionButton.addEventListener(
    "click",
    previewStocktakingReflection
  );

  applyStocktakingReflectionButton.addEventListener(
    "click",
    applyStocktakingReflection
  );

  exportStocktakingReflectionCsvButton.addEventListener(
    "click",
    exportStocktakingReflectionCsv
  );

  stocktakingReflectionPersonInput.addEventListener(
    "input",
    function () {
      if (currentStocktakingReflectionPreview) {
        currentStocktakingReflectionPreview = null;
        applyStocktakingReflectionButton.disabled = true;
        stocktakingReflectionMessage.textContent =
          "担当者を変更しました。もう一度、反映内容を確認してください。";
      }
    }
  );

  stocktakingAggregationScreen
    .querySelectorAll(
      "[data-stocktaking-panel-target]"
    )
    .forEach(function (button) {
      button.addEventListener(
        "click",
        function () {
          openStocktakingAggregationPanel(
            button.dataset.stocktakingPanelTarget
          );
        }
      );
    });

  document.querySelector(
    "#stocktaking-aggregation-top-button"
  ).addEventListener(
    "click",
    scrollToStocktakingAggregationTop
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

    #stocktaking-aggregation {
      padding-bottom: 112px;
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

    .stocktaking-aggregation-jump-nav {
      position: sticky;
      top: 0;
      z-index: 40;
      display: grid;
      grid-template-columns:
        repeat(5, minmax(0, 1fr));
      gap: 7px;
      margin: 14px 0 18px;
      padding: 9px;
      border: 1px solid #80cbc4;
      border-radius: 12px;
      background-color: rgba(255, 255, 255, 0.97);
      box-shadow: 0 4px 14px rgba(38, 50, 56, 0.14);
      backdrop-filter: blur(7px);
    }

    .stocktaking-aggregation-jump-nav button {
      min-height: 43px;
      margin: 0;
      padding: 8px 6px;
      background-color: #00695c;
      font-size: 14px;
      line-height: 1.25;
    }

    #stocktaking-aggregation-top-button {
      background-color: #546e7a;
    }

    details.stocktaking-aggregation-panel {
      margin: 16px 0;
      padding: 0;
      border: 2px solid #80cbc4;
      border-radius: 12px;
      background-color: #fbffff;
      scroll-margin-top: 76px;
      overflow: clip;
    }

    details.stocktaking-aggregation-panel > summary {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      min-height: 56px;
      padding: 13px 16px;
      background-color: #e0f2f1;
      color: #00695c;
      cursor: pointer;
      font-size: 19px;
      font-weight: 800;
      list-style: none;
      user-select: none;
    }

    details.stocktaking-aggregation-panel > summary::-webkit-details-marker {
      display: none;
    }

    details.stocktaking-aggregation-panel > summary::after {
      content: "＋";
      flex: 0 0 auto;
      color: #00695c;
      font-size: 24px;
      font-weight: 900;
    }

    details.stocktaking-aggregation-panel[open] > summary::after {
      content: "－";
    }

    details.stocktaking-aggregation-panel > summary small {
      margin-left: auto;
      color: #455a64;
      font-size: 13px;
      font-weight: 600;
    }

    .stocktaking-aggregation-panel-content {
      padding: 18px;
    }

    #stocktaking-submission-file-input,
    #stocktaking-aggregation-date-filter,
    #stocktaking-reflection-person {
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
      overflow-x: visible;
      margin: 14px 0;
      border-radius: 8px;
    }

    .stocktaking-submission-preview-table,
    .stocktaking-imported-submission-table,
    .stocktaking-aggregation-result-table {
      width: 100%;
      min-width: 1050px;
      border-collapse: collapse;
    }

    .stocktaking-aggregation-result-table {
      width: 100%;
      min-width: 0;
      table-layout: fixed;
    }

    .stocktaking-aggregation-result-table th:nth-child(1),
    .stocktaking-aggregation-result-table td:nth-child(1) {
      width: 10%;
    }

    .stocktaking-aggregation-result-table th:nth-child(2),
    .stocktaking-aggregation-result-table td:nth-child(2) {
      width: 12%;
    }

    .stocktaking-aggregation-result-table th:nth-child(3),
    .stocktaking-aggregation-result-table td:nth-child(3) {
      width: 13%;
    }

    .stocktaking-aggregation-result-table th:nth-child(4),
    .stocktaking-aggregation-result-table td:nth-child(4) {
      width: 29%;
    }

    .stocktaking-aggregation-result-table th:nth-child(5),
    .stocktaking-aggregation-result-table td:nth-child(5),
    .stocktaking-aggregation-result-table th:nth-child(6),
    .stocktaking-aggregation-result-table td:nth-child(6),
    .stocktaking-aggregation-result-table th:nth-child(7),
    .stocktaking-aggregation-result-table td:nth-child(7) {
      width: 12%;
      text-align: right;
    }

    .stocktaking-aggregation-result-table td {
      overflow-wrap: anywhere;
      word-break: break-word;
    }

    .stocktaking-aggregation-detail-row td {
      padding: 8px 10px 12px;
      border-top: 0;
      font-size: 14px;
      line-height: 1.55;
    }

    .stocktaking-aggregation-detail {
      display: grid;
      gap: 5px;
    }

    .stocktaking-aggregation-detail strong {
      color: #37474f;
    }

    .stocktaking-aggregation-location-breakdown {
      padding: 7px 9px;
      border-radius: 7px;
      background-color: rgba(255, 255, 255, 0.72);
      overflow-wrap: anywhere;
    }

    .stocktaking-reflection-preview-table {
      width: 100%;
      min-width: 1350px;
      border-collapse: collapse;
    }

    .stocktaking-reflection-preview-table th,
    .stocktaking-reflection-preview-table td {
      padding: 10px;
      border: 1px solid #cfd8dc;
      text-align: left;
      vertical-align: top;
    }

    .stocktaking-reflection-preview-table th {
      background-color: #37474f;
      color: #ffffff;
      white-space: nowrap;
    }

    .stocktaking-sticky-action-bar {
      position: fixed;
      left: 50%;
      bottom: 10px;
      z-index: 60;
      display: grid;
      grid-template-columns:
        repeat(3, minmax(0, 1fr));
      gap: 8px;
      width: min(1000px, calc(100% - 24px));
      padding: 9px;
      border: 2px solid #b0bec5;
      border-radius: 13px;
      background-color: rgba(255, 255, 255, 0.97);
      box-shadow: 0 7px 22px rgba(38, 50, 56, 0.25);
      transform: translateX(-50%);
      backdrop-filter: blur(8px);
      box-sizing: border-box;
    }

    .stocktaking-sticky-action-bar button {
      width: 100%;
      min-height: 48px;
      margin: 0;
      padding: 8px;
      font-size: 15px;
      line-height: 1.25;
    }

    #preview-stocktaking-reflection-button {
      background-color: #455a64;
    }

    #apply-stocktaking-reflection-button {
      background-color: #c62828;
    }

    #export-stocktaking-reflection-csv-button {
      background-color: #2e7d32;
    }

    .stocktaking-pagination {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: center;
      gap: 7px;
      min-height: 46px;
      margin: 10px 0 16px;
      padding: 8px;
      border-radius: 9px;
      background-color: #f1f8f7;
    }

    .stocktaking-pagination:empty {
      display: none;
    }

    .stocktaking-pagination button {
      width: auto;
      min-width: 44px;
      min-height: 38px;
      margin: 0;
      padding: 7px 10px;
      background-color: #00796b;
      font-size: 14px;
    }

    .stocktaking-pagination button:disabled {
      background-color: #b0bec5;
      cursor: not-allowed;
    }

    .stocktaking-pagination select {
      min-height: 38px;
      margin: 0;
      padding: 5px 8px;
      font-size: 15px;
    }

    .stocktaking-pagination-info {
      min-width: 150px;
      text-align: center;
      font-weight: 700;
    }

    .stocktaking-reflection-ok {
      background-color: #e8f5e9;
    }

    .stocktaking-reflection-no-change {
      background-color: #e3f2fd;
    }

    .stocktaking-reflection-blocked {
      background-color: #ffebee;
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
        padding-bottom: 118px;
      }

      .stocktaking-aggregation-jump-nav {
        grid-template-columns:
          repeat(3, minmax(0, 1fr));
        top: 0;
      }

      .stocktaking-aggregation-jump-nav button {
        font-size: 13px;
      }

      details.stocktaking-aggregation-panel > summary {
        align-items: flex-start;
        flex-direction: column;
        gap: 4px;
        padding: 12px 13px;
        font-size: 17px;
      }

      details.stocktaking-aggregation-panel > summary::after {
        position: absolute;
        right: 16px;
      }

      details.stocktaking-aggregation-panel > summary small {
        margin-left: 0;
        padding-right: 30px;
      }

      .stocktaking-aggregation-panel-content {
        padding: 13px;
      }

      .stocktaking-sticky-action-bar {
        bottom: 6px;
        gap: 5px;
        width: calc(100% - 12px);
        padding: 6px;
      }

      .stocktaking-sticky-action-bar button {
        min-height: 54px;
        padding: 6px 4px;
        font-size: 12px;
      }

      .stocktaking-pagination {
        justify-content: stretch;
      }

      .stocktaking-pagination button {
        flex: 1 1 64px;
      }

      .stocktaking-pagination-info {
        flex: 1 0 100%;
        order: -1;
      }

      #stocktaking-aggregation > button {
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
    registeredTotalStock:
      normalizeTransferNonNegativeInteger(
        item.registeredTotalStock !== undefined
          ? item.registeredTotalStock
          : item.registeredStock,
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

function openStocktakingAggregationPanel(
  panelId,
  shouldScroll = true
) {
  const panel =
    document.getElementById(panelId);

  if (!panel) {
    return;
  }

  panel.open = true;

  if (!shouldScroll) {
    return;
  }

  window.setTimeout(
    function () {
      panel.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    },
    30
  );
}

function scrollToStocktakingAggregationTop() {
  if (!stocktakingAggregationScreen) {
    return;
  }

  stocktakingAggregationScreen.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

function resetStocktakingAggregationPanels() {
  const panelIds = [
    "stocktaking-panel-files",
    "stocktaking-panel-imported",
    "stocktaking-panel-results",
    "stocktaking-panel-reflection"
  ];

  panelIds.forEach(function (panelId, index) {
    const panel =
      document.getElementById(panelId);

    if (panel) {
      panel.open = index === 0;
    }
  });
}

function getStocktakingPaginationData(
  items,
  requestedPage
) {
  const totalItems = items.length;
  const totalPages = Math.max(
    1,
    Math.ceil(
      totalItems /
      STOCKTAKING_TRANSFER_PAGE_SIZE
    )
  );

  const page = Math.min(
    Math.max(1, Number(requestedPage) || 1),
    totalPages
  );

  const startIndex =
    (page - 1) *
    STOCKTAKING_TRANSFER_PAGE_SIZE;

  const endIndex = Math.min(
    startIndex +
      STOCKTAKING_TRANSFER_PAGE_SIZE,
    totalItems
  );

  return {
    page: page,
    totalPages: totalPages,
    totalItems: totalItems,
    startIndex: startIndex,
    endIndex: endIndex,
    items: items.slice(
      startIndex,
      endIndex
    )
  };
}

function renderStocktakingPagination(
  container,
  pageData,
  onPageChange
) {
  if (!container) {
    return;
  }

  container.innerHTML = "";

  if (pageData.totalItems === 0) {
    return;
  }

  const info =
    document.createElement("span");

  info.classList.add(
    "stocktaking-pagination-info"
  );

  info.textContent =
    `${pageData.startIndex + 1}〜${pageData.endIndex}件 / ` +
    `${pageData.totalItems}件`;

  container.appendChild(info);

  const firstButton =
    createStocktakingPaginationButton(
      "最初",
      pageData.page === 1,
      function () {
        onPageChange(1);
      }
    );

  const previousButton =
    createStocktakingPaginationButton(
      "前へ",
      pageData.page === 1,
      function () {
        onPageChange(
          pageData.page - 1
        );
      }
    );

  const pageSelect =
    document.createElement("select");

  pageSelect.setAttribute(
    "aria-label",
    "表示ページ"
  );

  for (
    let pageNumber = 1;
    pageNumber <= pageData.totalPages;
    pageNumber += 1
  ) {
    const option =
      document.createElement("option");

    option.value = String(pageNumber);
    option.textContent =
      `${pageNumber} / ${pageData.totalPages}ページ`;

    pageSelect.appendChild(option);
  }

  pageSelect.value =
    String(pageData.page);

  pageSelect.addEventListener(
    "change",
    function () {
      onPageChange(
        Number(pageSelect.value)
      );
    }
  );

  const nextButton =
    createStocktakingPaginationButton(
      "次へ",
      pageData.page ===
        pageData.totalPages,
      function () {
        onPageChange(
          pageData.page + 1
        );
      }
    );

  const lastButton =
    createStocktakingPaginationButton(
      "最後",
      pageData.page ===
        pageData.totalPages,
      function () {
        onPageChange(
          pageData.totalPages
        );
      }
    );

  container.appendChild(firstButton);
  container.appendChild(previousButton);
  container.appendChild(pageSelect);
  container.appendChild(nextButton);
  container.appendChild(lastButton);
}

function createStocktakingPaginationButton(
  label,
  disabled,
  clickHandler
) {
  const button =
    document.createElement("button");

  button.type = "button";
  button.textContent = label;
  button.disabled = disabled;

  button.addEventListener(
    "click",
    clickHandler
  );

  return button;
}

async function openStocktakingAggregationScreen() {
  hideAllScreensForStocktakingAggregation();

  stocktakingAggregationScreen.hidden =
    false;

  stocktakingSubmissionPreviewPage = 1;
  stocktakingImportedSubmissionPage = 1;
  stocktakingAggregationPage = 1;
  stocktakingReflectionPage = 1;

  resetStocktakingAggregationPanels();

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
  stocktakingSubmissionPreviewPage = 1;

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

    if (stocktakingSubmissionPreviewPagination) {
      stocktakingSubmissionPreviewPagination.innerHTML = "";
    }

    return;
  }

  const importableCount =
    selectedStocktakingSubmissionFiles.filter(
      function (preview) {
        return preview.valid;
      }
    ).length;

  const pageData =
    getStocktakingPaginationData(
      selectedStocktakingSubmissionFiles,
      stocktakingSubmissionPreviewPage
    );

  stocktakingSubmissionPreviewPage =
    pageData.page;

  pageData.items.forEach(
    function (preview) {
      const row =
        document.createElement("tr");

      if (preview.valid) {
        row.classList.add(
          "stocktaking-transfer-valid"
        );
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

  renderStocktakingPagination(
    stocktakingSubmissionPreviewPagination,
    pageData,
    function (pageNumber) {
      stocktakingSubmissionPreviewPage =
        pageNumber;
      renderStocktakingSubmissionPreview();
      openStocktakingAggregationPanel(
        "stocktaking-panel-files"
      );
    }
  );
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

  openStocktakingAggregationPanel(
    "stocktaking-panel-results"
  );
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

    if (stocktakingImportedSubmissionPagination) {
      stocktakingImportedSubmissionPagination.innerHTML = "";
    }

    return;
  }

  const pageData =
    getStocktakingPaginationData(
      importedStocktakingSubmissions,
      stocktakingImportedSubmissionPage
    );

  stocktakingImportedSubmissionPage =
    pageData.page;

  pageData.items.forEach(
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

  renderStocktakingPagination(
    stocktakingImportedSubmissionPagination,
    pageData,
    function (pageNumber) {
      stocktakingImportedSubmissionPage =
        pageNumber;
      renderImportedStocktakingSubmissions();
      openStocktakingAggregationPanel(
        "stocktaking-panel-imported"
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
  stocktakingAggregationPage = 1;

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

  invalidateStocktakingReflectionPreview();
  loadExistingStocktakingReflectionForCurrentSelection();
}

function normalizeStocktakingAggregationLocationName(
  location
) {
  const text = String(location || "")
    .normalize("NFKC")
    .trim()
    .replace(/[\s\u3000]+/g, " ");

  if (/^本社2階\s*[A-Fa-f]区$/.test(text)) {
    return "本社2階";
  }

  return text;
}

function isLegacySecondFloorStocktakingZone(
  location
) {
  return /^本社2階\s*[A-Fa-f]区$/.test(
    String(location || "")
      .normalize("NFKC")
      .trim()
      .replace(/[\s\u3000]+/g, " ")
  );
}

function getResolvedStocktakingObservationQuantity(
  observations
) {
  const quantities =
    Array.from(
      new Set(
        (Array.isArray(observations) ? observations : [])
          .map(function (observation) {
            return observation.quantity;
          })
      )
    );

  if (quantities.length !== 1) {
    return {
      ok: false,
      quantity: null,
      quantities: quantities
    };
  }

  return {
    ok: true,
    quantity: quantities[0],
    quantities: quantities
  };
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
                registeredTotalStocks:
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

          group.registeredTotalStocks.add(
            normalizeTransferNonNegativeInteger(
              item.registeredTotalStock !== undefined
                ? item.registeredTotalStock
                : item.registeredStock,
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
              const sourceEntryLocation =
                String(entry.location || "").trim();

              const aggregationLocation =
                normalizeStocktakingAggregationLocationName(
                  sourceEntryLocation
                );

              const locationKey =
                normalizeTransferText(
                  aggregationLocation
                );

              if (!group.locations.has(locationKey)) {
                group.locations.set(
                  locationKey,
                  {
                    location:
                      aggregationLocation,
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
                  sourceEntryLocation:
                    sourceEntryLocation,
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
          group.registeredTotalStocks.size > 0
            ? group.registeredTotalStocks
            : group.registeredStocks
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
      let hasUnconfirmedLocation = false;
      let actualStockTotal = 0;
      let hasActualStock = false;
      const locationBreakdownTexts = [];
      const locationBreakdownEntries = [];

      group.locations.forEach(
        function (locationGroup) {
          if (
            normalizeTransferText(
              locationGroup.location
            ) === "未確認"
          ) {
            hasUnconfirmedLocation = true;
            warnings.push(
              "保管場所が「未確認」の商品です。"
            );
          }

          if (
            normalizeTransferText(
              locationGroup.location
            ) === "本社2階"
          ) {
            const directObservations =
              locationGroup.observations.filter(
                function (observation) {
                  return (
                    normalizeTransferText(
                      observation.sourceEntryLocation
                    ) === "本社2階"
                  );
                }
              );

            const legacyObservations =
              locationGroup.observations.filter(
                function (observation) {
                  return isLegacySecondFloorStocktakingZone(
                    observation.sourceEntryLocation
                  );
                }
              );

            if (
              directObservations.length > 0 &&
              legacyObservations.length > 0
            ) {
              hasLocationConflict = true;
              locationBreakdownTexts.push(
                "本社2階：新旧の棚卸区分が混在（要確認）"
              );
              warnings.push(
                "本社2階の提出に「本社2階」と旧区分（本社2階A～F区）が混在しています。重複集計を防ぐため確認してください。"
              );
              return;
            }

            if (directObservations.length > 0) {
              const resolved =
                getResolvedStocktakingObservationQuantity(
                  directObservations
                );

              if (!resolved.ok) {
                hasLocationConflict = true;
                locationBreakdownTexts.push(
                  `本社2階：${resolved.quantities
                    .map(function (quantity) {
                      return `${quantity}個`;
                    })
                    .join(" / ")}（要確認）`
                );
                warnings.push(
                  "保管場所「本社2階」の数量が一致しません。"
                );
                return;
              }

              actualStockTotal += resolved.quantity;
              hasActualStock = true;

              locationBreakdownTexts.push(
                `本社2階：${resolved.quantity}個`
              );

              locationBreakdownEntries.push({
                location: "本社2階",
                quantity: resolved.quantity,
                sourceLocations: ["本社2階"]
              });

              if (directObservations.length > 1) {
                warnings.push(
                  `保管場所「本社2階」が複数の提出に含まれています。同数のため1件分だけ集計しました。`
                );
              }

              return;
            }

            const legacyZoneGroups = new Map();

            legacyObservations.forEach(
              function (observation) {
                const zone =
                  String(
                    observation.sourceEntryLocation || ""
                  )
                    .normalize("NFKC")
                    .trim()
                    .replace(/[\s\u3000]+/g, " ");

                if (!legacyZoneGroups.has(zone)) {
                  legacyZoneGroups.set(zone, []);
                }

                legacyZoneGroups.get(zone).push(observation);
              }
            );

            let secondFloorTotal = 0;
            let secondFloorConflict = false;
            const sourceLocations = [];

            legacyZoneGroups.forEach(
              function (observations, zone) {
                const resolved =
                  getResolvedStocktakingObservationQuantity(
                    observations
                  );

                sourceLocations.push(zone);

                if (!resolved.ok) {
                  secondFloorConflict = true;
                  warnings.push(
                    `旧保管場所「${zone}」の数量が一致しません。`
                  );
                  return;
                }

                secondFloorTotal += resolved.quantity;

                if (observations.length > 1) {
                  warnings.push(
                    `旧保管場所「${zone}」が複数の提出に含まれています。同数のため1件分だけ集計しました。`
                  );
                }
              }
            );

            if (secondFloorConflict) {
              hasLocationConflict = true;
              locationBreakdownTexts.push(
                "本社2階：旧区分の数量に不一致あり（要確認）"
              );
              return;
            }

            actualStockTotal += secondFloorTotal;
            hasActualStock = true;

            locationBreakdownTexts.push(
              `本社2階：${secondFloorTotal}個`
            );

            locationBreakdownEntries.push({
              location: "本社2階",
              quantity: secondFloorTotal,
              sourceLocations: sourceLocations.sort()
            });

            return;
          }

          const resolved =
            getResolvedStocktakingObservationQuantity(
              locationGroup.observations
            );

          if (resolved.ok) {
            const quantity = resolved.quantity;

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

            locationBreakdownEntries.push({
              location: locationGroup.location,
              quantity: quantity,
              sourceLocations: [locationGroup.location]
            });

            return;
          }

          hasLocationConflict = true;

          const quantityText =
            resolved.quantities
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
        locationBreakdownEntries:
          locationBreakdownEntries,
        people:
          Array.from(group.people).join(
            " / "
          ),
        submissionCount:
          group.submissionIds.size,
        bulkZeroCount:
          group.bulkZeroSubmissionIds.size,
        sourceSubmissionIds:
          Array.from(
            group.submissionIds
          ).sort(),
        hasUnconfirmedLocation:
          hasUnconfirmedLocation,
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
        <td colspan="7">
          集約できる提出データがありません。
        </td>
      </tr>
    `;

    if (stocktakingAggregationPagination) {
      stocktakingAggregationPagination.innerHTML = "";
    }

    return;
  }

  const pageData =
    getStocktakingPaginationData(
      rows,
      stocktakingAggregationPage
    );

  stocktakingAggregationPage =
    pageData.page;

  pageData.items.forEach(
    function (resultRow) {
      const row =
        document.createElement("tr");

      let resultClass =
        "stocktaking-transfer-valid";

      if (
        resultRow.result === "要確認" ||
        resultRow.result === "未確認"
      ) {
        resultClass =
          "stocktaking-transfer-warning";
      } else if (
        resultRow.result === "在庫不足"
      ) {
        resultClass =
          "stocktaking-transfer-error";
      }

      row.classList.add(resultClass);

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

      stocktakingAggregationBody.appendChild(
        row
      );

      const detailRow =
        document.createElement("tr");

      detailRow.classList.add(
        resultClass,
        "stocktaking-aggregation-detail-row"
      );

      const detailCell =
        document.createElement("td");

      detailCell.colSpan = 7;

      const locationText =
        resultRow.locationBreakdown ||
        "未確認";

      detailCell.innerHTML = `
        <div class="stocktaking-aggregation-detail">
          <div>
            <strong>棚卸日：</strong>
            ${escapeTransferHtml(resultRow.stocktakingDate || "未登録")}
            &nbsp;&nbsp;
            <strong>担当者：</strong>
            ${escapeTransferHtml(resultRow.people || "未登録")}
            &nbsp;&nbsp;
            <strong>提出：</strong>
            ${escapeTransferHtml(`${resultRow.submissionCount}件`)}
          </div>
          <div class="stocktaking-aggregation-location-breakdown">
            <strong>区画別内訳：</strong>
            ${escapeTransferHtml(locationText)}
          </div>
          ${
            resultRow.warnings
              ? `<div><strong>警告：</strong>${escapeTransferHtml(resultRow.warnings)}</div>`
              : ""
          }
        </div>
      `;

      detailRow.appendChild(detailCell);
      stocktakingAggregationBody.appendChild(
        detailRow
      );
    }
  );

  renderStocktakingPagination(
    stocktakingAggregationPagination,
    pageData,
    function (pageNumber) {
      stocktakingAggregationPage =
        pageNumber;
      renderStocktakingAggregationRows(
        rows
      );
      openStocktakingAggregationPanel(
        "stocktaking-panel-results"
      );
    }
  );
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


function invalidateStocktakingReflectionPreview() {
  currentStocktakingReflectionPreview = null;
  stocktakingReflectionPage = 1;

  if (applyStocktakingReflectionButton) {
    applyStocktakingReflectionButton.disabled = true;
  }

  if (stocktakingReflectionBody) {
    stocktakingReflectionBody.innerHTML = `
      <tr>
        <td colspan="9">
          反映内容はまだ確認されていません。
        </td>
      </tr>
    `;
  }

  if (stocktakingReflectionMessage) {
    stocktakingReflectionMessage.textContent =
      "棚卸日を選び、「反映内容を確認する」を押してください。";
  }

  if (stocktakingReflectionPagination) {
    stocktakingReflectionPagination.innerHTML = "";
  }
}

function getSelectedStocktakingAggregationSubmissions() {
  const selectedDate =
    stocktakingAggregationDateFilter
      ? stocktakingAggregationDateFilter.value
      : "";

  if (selectedDate === "") {
    return [];
  }

  return importedStocktakingSubmissions.filter(
    function (submission) {
      return (
        submission.stocktaking.stocktakingDate ===
        selectedDate
      );
    }
  );
}

function createStocktakingAggregationSourceKey(
  stocktakingDate,
  submissions
) {
  const ids = submissions
    .map(function (submission) {
      return submission.submissionId;
    })
    .sort();

  return (
    `${stocktakingDate}::${ids.join("|")}`
  );
}

async function loadExistingStocktakingReflectionForCurrentSelection() {
  latestStocktakingReflection = null;

  if (!exportStocktakingReflectionCsvButton) {
    return;
  }

  exportStocktakingReflectionCsvButton.disabled = true;

  const selectedDate =
    stocktakingAggregationDateFilter
      ? stocktakingAggregationDateFilter.value
      : "";

  const submissions =
    getSelectedStocktakingAggregationSubmissions();

  if (
    selectedDate === "" ||
    submissions.length === 0
  ) {
    return;
  }

  const sourceKey =
    createStocktakingAggregationSourceKey(
      selectedDate,
      submissions
    );

  try {
    const reflection =
      await getStocktakingAggregationReflectionBySourceKey(
        sourceKey
      );

    if (!reflection) {
      return;
    }

    latestStocktakingReflection = reflection;
    exportStocktakingReflectionCsvButton.disabled = false;

    stocktakingReflectionMessage.textContent =
      `この提出組み合わせは、${formatTransferDateTime(reflection.reflectedAt)}に現在庫へ反映済みです。`;
  } catch (error) {
    console.error(error);
  }
}

async function previewStocktakingReflection() {
  openStocktakingAggregationPanel(
    "stocktaking-panel-reflection",
    false
  );

  stocktakingReflectionPage = 1;

  const selectedDate =
    stocktakingAggregationDateFilter.value;

  const person =
    stocktakingReflectionPersonInput.value.trim();

  if (selectedDate === "") {
    alert(
      "反映する棚卸日を1日選択してください。\n\n「すべての棚卸日」のままでは反映できません。"
    );

    stocktakingAggregationDateFilter.focus();
    return;
  }

  if (person === "") {
    alert(
      "集約担当者を入力してください。"
    );

    stocktakingReflectionPersonInput.focus();
    return;
  }

  const submissions =
    getSelectedStocktakingAggregationSubmissions();

  if (submissions.length === 0) {
    alert(
      "選択した棚卸日の提出データがありません。"
    );
    return;
  }

  const rows =
    buildStocktakingAggregationRows(
      submissions
    );

  if (rows.length === 0) {
    alert(
      "反映内容を作成できる集約結果がありません。"
    );
    return;
  }

  previewStocktakingReflectionButton.disabled = true;
  applyStocktakingReflectionButton.disabled = true;
  stocktakingReflectionMessage.textContent =
    "商品データと集約結果を照合しています。";

  try {
    const products =
      await getAllProducts();

    const productMap = new Map();

    products.forEach(function (product) {
      productMap.set(
        String(product.internalCode || ""),
        product
      );
    });

    const sourceKey =
      createStocktakingAggregationSourceKey(
        selectedDate,
        submissions
      );

    const existingReflection =
      await getStocktakingAggregationReflectionBySourceKey(
        sourceKey
      );

    const previewRows = rows.map(
      function (row) {
        return createStocktakingReflectionPreviewRow(
          row,
          productMap.get(row.internalCode) || null
        );
      }
    );

    const blockedCount =
      previewRows.filter(function (row) {
        return row.blockers.length > 0;
      }).length;

    const changedCount =
      previewRows.filter(function (row) {
        return (
          row.blockers.length === 0 &&
          (row.changeQuantity !== 0 || row.locationChanged)
        );
      }).length;

    const noChangeCount =
      previewRows.filter(function (row) {
        return (
          row.blockers.length === 0 &&
          row.changeQuantity === 0 &&
          !row.locationChanged
        );
      }).length;

    const globalBlockers = [];

    if (existingReflection) {
      globalBlockers.push(
        "同じ提出データの組み合わせは、すでに現在庫へ反映済みです。"
      );
    }

    currentStocktakingReflectionPreview = {
      stocktakingDate: selectedDate,
      person: person,
      sourceKey: sourceKey,
      submissionIds:
        submissions
          .map(function (submission) {
            return submission.submissionId;
          })
          .sort(),
      createdAt: new Date().toISOString(),
      rows: previewRows,
      blockedCount: blockedCount,
      changedCount: changedCount,
      noChangeCount: noChangeCount,
      globalBlockers: globalBlockers,
      canApply:
        blockedCount === 0 &&
        globalBlockers.length === 0
    };

    renderStocktakingReflectionPreview(
      currentStocktakingReflectionPreview
    );

    applyStocktakingReflectionButton.disabled =
      !currentStocktakingReflectionPreview.canApply;
  } catch (error) {
    console.error(error);

    currentStocktakingReflectionPreview = null;

    stocktakingReflectionMessage.textContent =
      "反映内容を確認できませんでした。";

    alert(
      "商品データと集約結果を照合できませんでした。"
    );
  } finally {
    previewStocktakingReflectionButton.disabled = false;
  }
}

const STOCKTAKING_REFLECTION_HEADQUARTERS_ZONES = [
  "本社1階 A区",
  "本社1階 B区",
  "本社1階 C区",
  "本社1階 D区",
  "本社1階 E区",
  "本社1階 F区",
  "本社2階"
];

const STOCKTAKING_REFLECTION_LEGACY_SECOND_FLOOR_ZONES = [
  "本社2階 A区",
  "本社2階 B区",
  "本社2階 C区",
  "本社2階 D区",
  "本社2階 E区",
  "本社2階 F区"
];

function getMissingHeadquartersStocktakingZones(entries) {
  const normalizedEntries =
    normalizeStocktakingReflectionLocationEntries(entries)
      .map(function (entry) {
        return {
          location:
            String(entry.location || "")
              .normalize("NFKC")
              .trim()
              .replace(/[\s\u3000]+/g, " "),
          sourceLocations:
            Array.isArray(entry.sourceLocations)
              ? entry.sourceLocations.map(function (location) {
                  return String(location || "")
                    .normalize("NFKC")
                    .trim()
                    .replace(/[\s\u3000]+/g, " ");
                })
              : []
        };
      });

  const normalized = new Set(
    normalizedEntries.map(function (entry) {
      return entry.location;
    })
  );

  const hasAnyHeadquartersZone =
    normalizedEntries.some(function (entry) {
      return (
        /^本社1階\s*[A-Fa-f]区$/.test(entry.location) ||
        entry.location === "本社2階" ||
        /^本社2階\s*[A-Fa-f]区$/.test(entry.location)
      );
    });

  if (!hasAnyHeadquartersZone) {
    return [];
  }

  const missing =
    STOCKTAKING_REFLECTION_HEADQUARTERS_ZONES
      .slice(0, 6)
      .filter(function (zone) {
        return !normalized.has(zone);
      });

  const secondFloorEntry =
    normalizedEntries.find(function (entry) {
      return entry.location === "本社2階";
    });

  let hasSecondFloor = false;

  if (secondFloorEntry) {
    if (
      secondFloorEntry.sourceLocations.length === 0 ||
      secondFloorEntry.sourceLocations.includes("本社2階")
    ) {
      hasSecondFloor = true;
    } else {
      hasSecondFloor =
        STOCKTAKING_REFLECTION_LEGACY_SECOND_FLOOR_ZONES
          .every(function (zone) {
            return secondFloorEntry.sourceLocations.includes(zone);
          });
    }
  } else {
    const legacyPresent =
      STOCKTAKING_REFLECTION_LEGACY_SECOND_FLOOR_ZONES
        .every(function (zone) {
          return normalized.has(zone);
        });

    hasSecondFloor = legacyPresent;
  }

  if (!hasSecondFloor) {
    missing.push("本社2階");
  }

  return missing;
}

function getStocktakingReflectionBaseLocation(location) {
  const text = String(location || "")
    .normalize("NFKC")
    .trim()
    .replace(/[\s\u3000]+/g, " ");

  if (
    /^本社1階\s*[A-Fa-f]区$/.test(text) ||
    text === "本社2階" ||
    /^本社2階\s*[A-Fa-f]区$/.test(text)
  ) {
    return "本社";
  }

  if (text === "本社") {
    return "本社";
  }

  if (text === "酒本倉庫1階") {
    return "酒本倉庫1階";
  }

  if (text === "酒本倉庫2階") {
    return "酒本倉庫2階";
  }

  return text;
}

function normalizeStocktakingReflectionLocationEntries(entries) {
  return (Array.isArray(entries) ? entries : [])
    .map(function (entry) {
      const location = String(entry && entry.location || "").trim();
      const quantity = normalizeTransferNonNegativeInteger(
        entry && entry.quantity,
        0
      );

      if (!location) {
        return null;
      }

      return {
        location: location,
        quantity: quantity,
        sourceLocations:
          Array.isArray(entry && entry.sourceLocations)
            ? entry.sourceLocations.slice()
            : []
      };
    })
    .filter(Boolean);
}

function buildStocktakingReflectionLocationStocks(
  product,
  locationEntries
) {
  const currentEntries =
    typeof getProductLocationStocks === "function"
      ? getProductLocationStocks(product)
      : [];

  const groupedCurrent = new Map();

  currentEntries.forEach(function (entry) {
    const base = getStocktakingReflectionBaseLocation(
      entry.location
    );
    if (!base) return;
    groupedCurrent.set(
      base,
      (groupedCurrent.get(base) || 0) +
        normalizeTransferNonNegativeInteger(entry.stock, 0)
    );
  });

  const replacementGroups = new Map();

  normalizeStocktakingReflectionLocationEntries(
    locationEntries
  ).forEach(function (entry) {
    const base = getStocktakingReflectionBaseLocation(
      entry.location
    );
    if (!base || base === "未確認") return;
    replacementGroups.set(
      base,
      (replacementGroups.get(base) || 0) + entry.quantity
    );
  });

  replacementGroups.forEach(function (quantity, base) {
    groupedCurrent.set(base, quantity);
  });

  const order = ["本社", "酒本倉庫1階", "酒本倉庫2階"];
  const orderMap = new Map(order.map(function (name, index) {
    return [name, index];
  }));

  return Array.from(groupedCurrent, function ([location, stock]) {
    return {
      location: location,
      stock: normalizeTransferNonNegativeInteger(stock, 0)
    };
  })
    .filter(function (entry) {
      return entry.stock > 0;
    })
    .sort(function (left, right) {
      const li = orderMap.has(left.location) ? orderMap.get(left.location) : 999;
      const ri = orderMap.has(right.location) ? orderMap.get(right.location) : 999;
      if (li !== ri) return li - ri;
      return left.location.localeCompare(right.location, "ja");
    });
}

function areStocktakingReflectionLocationStocksEqual(leftEntries, rightEntries) {
  const normalize = function (entries) {
    return (Array.isArray(entries) ? entries : [])
      .map(function (entry) {
        return {
          location: getStocktakingReflectionBaseLocation(entry.location),
          stock: normalizeTransferNonNegativeInteger(entry.stock, 0)
        };
      })
      .filter(function (entry) {
        return entry.location && entry.stock > 0;
      })
      .sort(function (a, b) {
        return a.location.localeCompare(b.location, "ja");
      });
  };

  return JSON.stringify(normalize(leftEntries)) ===
    JSON.stringify(normalize(rightEntries));
}

function createStocktakingReflectionPreviewRow(
  aggregationRow,
  product
) {
  const blockers = [];
  const warnings = [];

  if (!product) {
    blockers.push(
      "集約用パソコンの商品一覧に社内コードが登録されていません。"
    );
  }

  if (
    aggregationRow.result === "要確認" ||
    aggregationRow.result === "未確認" ||
    aggregationRow.actualStock === null ||
    aggregationRow.registeredStock === null
  ) {
    blockers.push(
      "集約結果が要確認または未確認です。"
    );
  }

  if (aggregationRow.hasUnconfirmedLocation) {
    blockers.push(
      "保管場所が「未確認」のため反映できません。"
    );
  }

  const missingHeadquartersZones =
    getMissingHeadquartersStocktakingZones(
      aggregationRow.locationBreakdownEntries
    );

  if (missingHeadquartersZones.length > 0) {
    blockers.push(
      "本社の棚卸を反映するには、本社1階A～F区と本社2階の7区分すべての提出が必要です。未取込：" +
      missingHeadquartersZones.join(" / ")
    );
  }

  let currentStock = null;
  let productStatus = "";
  let currentLocationStocks = [];
  let afterLocationStocks = [];
  let afterStock = aggregationRow.actualStock;
  let locationChanged = false;

  if (product) {
    currentStock =
      normalizeTransferNonNegativeInteger(
        product.stock,
        0
      );

    productStatus =
      String(
        product.productStatus ||
        "通常商品"
      ).trim();

    if (productStatus === "廃盤") {
      blockers.push(
        "集約用パソコンの商品が廃盤に設定されています。"
      );
    }

    if (
      aggregationRow.registeredStock !== null &&
      currentStock !== aggregationRow.registeredStock
    ) {
      blockers.push(
        `棚卸開始時の登録在庫${aggregationRow.registeredStock}個と、現在庫${currentStock}個が一致しません。棚卸後に入出庫または修正された可能性があります。`
      );
    }

    if (
      normalizeTransferText(product.productCode) !==
      normalizeTransferText(aggregationRow.productCode)
    ) {
      warnings.push(
        "商品コードが提出データと現在の商品情報で異なります。"
      );
    }

    if (
      normalizeTransferText(product.productName) !==
      normalizeTransferText(aggregationRow.productName)
    ) {
      warnings.push(
        "商品名が提出データと現在の商品情報で異なります。"
      );
    }

    currentLocationStocks =
      typeof getProductLocationStocks === "function"
        ? getProductLocationStocks(product)
        : [];

    afterLocationStocks =
      buildStocktakingReflectionLocationStocks(
        product,
        aggregationRow.locationBreakdownEntries
      );

    afterStock = afterLocationStocks.reduce(
      function (sum, entry) {
        return sum + normalizeTransferNonNegativeInteger(entry.stock, 0);
      },
      0
    );

    locationChanged =
      !areStocktakingReflectionLocationStocksEqual(
        currentLocationStocks,
        afterLocationStocks
      );
  }

  if (aggregationRow.warnings) {
    warnings.push(
      aggregationRow.warnings
    );
  }

  const changeQuantity =
    currentStock === null ||
    afterStock === null
      ? null
      : afterStock - currentStock;

  let judgment = "反映不可";

  if (blockers.length === 0) {
    judgment =
      changeQuantity === 0 && !locationChanged
        ? "変更なし"
        : "反映可能";
  }

  return {
    judgment: judgment,
    stocktakingDate:
      aggregationRow.stocktakingDate,
    internalCode:
      aggregationRow.internalCode,
    productCode:
      product
        ? String(product.productCode || "")
        : aggregationRow.productCode,
    productName:
      product
        ? String(product.productName || "")
        : aggregationRow.productName,
    beforeStock: currentStock,
    afterStock: afterStock,
    changeQuantity: changeQuantity,
    locationChanged: locationChanged,
    currentLocationStocks: currentLocationStocks,
    afterLocationStocks: afterLocationStocks,
    locationBreakdown:
      aggregationRow.locationBreakdown,
    locationBreakdownEntries:
      aggregationRow.locationBreakdownEntries,
    people:
      aggregationRow.people,
    submissionCount:
      aggregationRow.submissionCount,
    bulkZeroCount:
      aggregationRow.bulkZeroCount,
    warnings:
      Array.from(new Set(warnings)).filter(Boolean),
    blockers:
      Array.from(new Set(blockers)).filter(Boolean),
    product: product
  };
}

function renderStocktakingReflectionPreview(
  preview
) {
  stocktakingReflectionBody.innerHTML = "";

  const pageData =
    getStocktakingPaginationData(
      preview.rows,
      stocktakingReflectionPage
    );

  stocktakingReflectionPage =
    pageData.page;

  pageData.items.forEach(
    function (previewRow) {
      const row =
        document.createElement("tr");

      if (previewRow.blockers.length > 0) {
        row.classList.add(
          "stocktaking-reflection-blocked"
        );
      } else if (
        previewRow.changeQuantity === 0 &&
        !previewRow.locationChanged
      ) {
        row.classList.add(
          "stocktaking-reflection-no-change"
        );
      } else {
        row.classList.add(
          "stocktaking-reflection-ok"
        );
      }

      appendTransferCell(
        row,
        previewRow.judgment
      );

      appendTransferCell(
        row,
        previewRow.internalCode
      );

      appendTransferCell(
        row,
        previewRow.productCode || "未登録"
      );

      appendTransferCell(
        row,
        previewRow.productName || "未登録"
      );

      appendTransferCell(
        row,
        previewRow.beforeStock === null
          ? "確認不可"
          : previewRow.beforeStock
      );

      appendTransferCell(
        row,
        previewRow.afterStock === null
          ? "確認不可"
          : previewRow.afterStock
      );

      appendTransferCell(
        row,
        previewRow.changeQuantity === null
          ? "確認不可"
          : formatTransferSignedNumber(
              previewRow.changeQuantity
            )
      );

      appendTransferCell(
        row,
        previewRow.locationBreakdown ||
        "未確認"
      );

      const checkTexts = [];

      previewRow.blockers.forEach(
        function (message) {
          checkTexts.push(
            `反映不可：${message}`
          );
        }
      );

      previewRow.warnings.forEach(
        function (message) {
          checkTexts.push(
            `注意：${message}`
          );
        }
      );

      if (checkTexts.length === 0) {
        checkTexts.push("問題なし");
      }

      appendTransferCell(
        row,
        checkTexts.join(" / ")
      );

      stocktakingReflectionBody.appendChild(
        row
      );
    }
  );

  renderStocktakingPagination(
    stocktakingReflectionPagination,
    pageData,
    function (pageNumber) {
      stocktakingReflectionPage =
        pageNumber;
      renderStocktakingReflectionPreview(
        preview
      );
      openStocktakingAggregationPanel(
        "stocktaking-panel-reflection"
      );
    }
  );

  const messageParts = [
    `棚卸日：${preview.stocktakingDate}`,
    `対象商品：${preview.rows.length}件`,
    `在庫変更：${preview.changedCount}件`,
    `変更なし：${preview.noChangeCount}件`,
    `反映不可：${preview.blockedCount}件`
  ];

  if (preview.globalBlockers.length > 0) {
    messageParts.push(
      preview.globalBlockers.join(" / ")
    );
  } else if (preview.canApply) {
    messageParts.push(
      "すべての確認が完了しました。「現在庫へ反映する」を押せます。"
    );
  } else {
    messageParts.push(
      "反映不可の商品を修正してから、提出ファイルを取り込み直してください。"
    );
  }

  stocktakingReflectionMessage.textContent =
    messageParts.join(" / ");

  openStocktakingAggregationPanel(
    "stocktaking-panel-reflection",
    false
  );
}

async function applyStocktakingReflection() {
  const preview =
    currentStocktakingReflectionPreview;

  if (!preview || !preview.canApply) {
    alert(
      "先に「反映内容を確認する」を押し、反映可能な状態にしてください。"
    );
    return;
  }

  const currentPerson =
    stocktakingReflectionPersonInput.value.trim();

  if (
    currentPerson === "" ||
    currentPerson !== preview.person
  ) {
    alert(
      "集約担当者が変更されています。もう一度、反映内容を確認してください。"
    );
    applyStocktakingReflectionButton.disabled = true;
    return;
  }

  const freshProducts =
    await getAllProducts();

  const freshProductMap = new Map();

  freshProducts.forEach(function (product) {
    freshProductMap.set(
      String(product.internalCode || ""),
      product
    );
  });

  const freshRows =
    currentStocktakingAggregationRows.map(
      function (row) {
        return createStocktakingReflectionPreviewRow(
          row,
          freshProductMap.get(row.internalCode) || null
        );
      }
    );

  const freshBlocked =
    freshRows.some(function (row) {
      return row.blockers.length > 0;
    });

  if (freshBlocked) {
    alert(
      "確認後に商品データまたは在庫が変更されました。もう一度、反映内容を確認してください。"
    );
    invalidateStocktakingReflectionPreview();
    return;
  }

  const changedRows =
    freshRows.filter(function (row) {
      return (
        row.changeQuantity !== 0 ||
        row.locationChanged
      );
    });

  const confirmed = window.confirm(
    "集約結果を現在庫へ反映しますか？\n\n" +
    `棚卸日：${preview.stocktakingDate}\n` +
    `集約担当者：${preview.person}\n` +
    `対象商品：${freshRows.length}件\n` +
    `在庫を変更する商品：${changedRows.length}件\n` +
    `変更なし：${freshRows.length - changedRows.length}件\n\n` +
    "反映すると商品一覧の現在庫が更新され、入出庫履歴に「棚卸集約調整」として記録されます。"
  );

  if (!confirmed) {
    return;
  }

  applyStocktakingReflectionButton.disabled = true;
  previewStocktakingReflectionButton.disabled = true;

  try {
    const reflectedAt =
      new Date().toISOString();

    const reflectionId =
      createStocktakingReflectionId();

    const updatedProducts = [];
    const movements = [];

    freshRows.forEach(function (row, index) {
      if (
        (row.changeQuantity === 0 && !row.locationChanged) ||
        !row.product
      ) {
        return;
      }

      const nextLocationStocks =
        Array.isArray(row.afterLocationStocks)
          ? row.afterLocationStocks
          : [];

      const nextPrimaryLocation =
        nextLocationStocks.length > 0
          ? nextLocationStocks[0].location
          : (row.product.location || "本社");

      const updatedProduct =
        typeof normalizeProductLocationStocks === "function"
          ? normalizeProductLocationStocks({
              ...row.product,
              stock: row.afterStock,
              location: nextPrimaryLocation,
              locationStocks: nextLocationStocks,
              updatedAt: reflectedAt
            })
          : {
              ...row.product,
              stock: row.afterStock,
              location: nextPrimaryLocation,
              locationStocks: nextLocationStocks,
              updatedAt: reflectedAt
            };

      updatedProducts.push(updatedProduct);

      const memoParts = [
        `集約棚卸日：${preview.stocktakingDate}`,
        `場所別：${row.locationBreakdown || "未確認"}`,
        `提出数：${row.submissionCount}件`,
        `集約担当者：${preview.person}`,
        `反映番号：${reflectionId}`
      ];

      if (row.bulkZeroCount > 0) {
        memoParts.push(
          `一括0入力提出：${row.bulkZeroCount}件`
        );
      }

      movements.push({
        id:
          createStocktakingReflectionMovementId(
            reflectionId,
            index
          ),
        dateTime: reflectedAt,
        internalCode:
          row.internalCode,
        productCode:
          row.productCode,
        productName:
          row.productName,
        type: "棚卸集約調整",
        quantity:
          row.changeQuantity,
        beforeStock:
          row.beforeStock,
        afterStock:
          row.afterStock,
        person:
          preview.person,
        reason:
          "複数端末の棚卸結果を反映",
        memo:
          memoParts.join(" / ")
      });
    });

    const reflection = {
      reflectionId: reflectionId,
      sourceKey: preview.sourceKey,
      stocktakingDate:
        preview.stocktakingDate,
      reflectedAt: reflectedAt,
      person: preview.person,
      submissionIds:
        preview.submissionIds,
      itemCount:
        freshRows.length,
      changedCount:
        changedRows.length,
      rows:
        freshRows.map(function (row) {
          return {
            judgment:
              row.changeQuantity === 0 && !row.locationChanged
                ? "変更なし"
                : "反映済み",
            internalCode:
              row.internalCode,
            productCode:
              row.productCode,
            productName:
              row.productName,
            beforeStock:
              row.beforeStock,
            afterStock:
              row.afterStock,
            changeQuantity:
              row.changeQuantity,
            locationBreakdown:
              row.locationBreakdown,
            locationBreakdownEntries:
              row.locationBreakdownEntries,
            people:
              row.people,
            submissionCount:
              row.submissionCount,
            bulkZeroCount:
              row.bulkZeroCount,
            warnings:
              row.warnings.join(" / ")
          };
        })
    };

    await completeStocktakingAggregationReflection(
      reflection,
      updatedProducts,
      movements
    );

    if (
      window.inventoryApp &&
      typeof window.inventoryApp.applyUpdatedProduct ===
        "function"
    ) {
      updatedProducts.forEach(function (product) {
        window.inventoryApp.applyUpdatedProduct(
          product
        );
      });
    }

    latestStocktakingReflection = reflection;
    currentStocktakingReflectionPreview = null;

    exportStocktakingReflectionCsvButton.disabled = false;
    applyStocktakingReflectionButton.disabled = true;

    stocktakingReflectionMessage.textContent =
      `現在庫へ反映しました。反映日時：${formatTransferDateTime(reflectedAt)} / 在庫変更：${changedRows.length}件 / 変更なし：${freshRows.length - changedRows.length}件`;

    alert(
      "集約結果を現在庫へ反映しました。\n\n" +
      `在庫変更：${changedRows.length}件\n` +
      `変更なし：${freshRows.length - changedRows.length}件\n\n` +
      "入出庫履歴には「棚卸集約調整」として記録されています。"
    );
  } catch (error) {
    console.error(error);

    if (
      error &&
      error.name === "ConstraintError"
    ) {
      alert(
        "同じ提出データの組み合わせは、すでに現在庫へ反映されています。"
      );
    } else {
      alert(
        "現在庫へ反映できませんでした。商品データは途中まで変更されないよう、一括処理を取り消しています。"
      );
    }
  } finally {
    previewStocktakingReflectionButton.disabled = false;
  }
}

function exportStocktakingReflectionCsv() {
  const reflection =
    latestStocktakingReflection;

  if (
    !reflection ||
    !Array.isArray(reflection.rows)
  ) {
    alert(
      "CSV出力する反映結果がありません。"
    );
    return;
  }

  const headers = [
    "反映日時",
    "棚卸日",
    "集約担当者",
    "反映結果",
    "社内コード",
    "商品コード",
    "商品名",
    "反映前在庫",
    "反映後在庫",
    "変更数量",
    "保管場所別内訳",
    "棚卸担当者",
    "提出数",
    "一括0入力提出数",
    "注意"
  ];

  const csvRows = [headers];

  reflection.rows.forEach(function (row) {
    csvRows.push([
      formatTransferDateTime(
        reflection.reflectedAt
      ),
      reflection.stocktakingDate,
      reflection.person,
      row.judgment,
      row.internalCode,
      row.productCode,
      row.productName,
      row.beforeStock,
      row.afterStock,
      row.changeQuantity,
      row.locationBreakdown,
      row.people,
      row.submissionCount,
      row.bulkZeroCount,
      row.warnings || ""
    ]);
  });

  const csvText =
    "\uFEFF" +
    csvRows
      .map(function (row) {
        return row
          .map(escapeTransferCsvValue)
          .join(",");
      })
      .join("\r\n");

  downloadTransferTextFile(
    csvText,
    `棚卸反映結果_${sanitizeTransferFileNamePart(reflection.stocktakingDate)}_${sanitizeTransferFileNamePart(reflection.person)}.csv`,
    "text/csv;charset=utf-8"
  );
}

function formatTransferSignedNumber(value) {
  const numberValue = Number(value);

  if (!Number.isFinite(numberValue)) {
    return "確認不可";
  }

  if (numberValue > 0) {
    return `＋${numberValue}`;
  }

  return String(numberValue);
}

function createStocktakingReflectionId() {
  const randomText = Math.random()
    .toString(36)
    .slice(2, 10);

  return (
    `aggregation-reflection-${Date.now()}-${randomText}`
  );
}

function createStocktakingReflectionMovementId(
  reflectionId,
  index
) {
  const randomText = Math.random()
    .toString(36)
    .slice(2, 8);

  return (
    `${reflectionId}-movement-${index}-${randomText}`
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
      registeredTotalStock:
        normalizeTransferNonNegativeInteger(
          item.registeredTotalStock !== undefined
            ? item.registeredTotalStock
            : item.registeredStock,
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

function escapeTransferHtml(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
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
