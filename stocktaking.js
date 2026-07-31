"use strict";

let stocktakingStartButton = null;

let stocktakingSetupScreen = null;
let stocktakingActiveScreen = null;

let stocktakingSetupForm = null;
let stocktakingDateInput = null;
let stocktakingPersonInput = null;
let stocktakingLocationInput = null;

let activeStocktakingDate = null;
let activeStocktakingPerson = null;
let activeStocktakingLocation = null;
let activeStocktakingStatus = null;
let activeStocktakingStartedAt = null;

let stocktakingSummaryTarget = null;
let stocktakingSummaryChecked = null;
let stocktakingSummaryUnchecked = null;
let stocktakingSummaryMatch = null;
let stocktakingSummaryShortage = null;
let stocktakingSummarySurplus = null;

let stocktakingProductSearchInput = null;
let stocktakingSearchMessage = null;
let stocktakingCameraScanButton = null;
let stocktakingItemsBody = null;
let stocktakingSaveMessage = null;

let saveStocktakingItemsButton = null;
let confirmStocktakingButton = null;
let cancelStocktakingSetupButton = null;
let backHomeFromStocktakingButton = null;
let deleteStocktakingButton = null;

let currentStocktaking = null;
let stocktakingHasUnsavedChanges = false;

document.addEventListener(
  "DOMContentLoaded",
  initializeStocktaking
);

window.stocktakingApp = {
  handleBarcode:
    handleStocktakingScannedBarcode,
  returnFromScanner:
    returnFromStocktakingScanner
};

function initializeStocktaking() {
  createStocktakingStartButton();
  createStocktakingScreens();
  createStocktakingStyle();
}

function createStocktakingStartButton() {
  const existingButton =
    document.querySelector(
      "#show-stocktaking-button"
    );

  if (existingButton) {
    stocktakingStartButton =
      existingButton;

    return;
  }

  const historyButton =
    document.querySelector(
      "#show-history-button"
    );

  stocktakingStartButton =
    document.createElement("button");

  stocktakingStartButton.id =
    "show-stocktaking-button";

  stocktakingStartButton.type =
    "button";

  stocktakingStartButton.textContent =
    "棚卸を開始する";

  stocktakingStartButton.addEventListener(
    "click",
    openStocktakingStart
  );

  historyButton.parentElement.appendChild(
    stocktakingStartButton
  );
}

function createStocktakingScreens() {
  const existingSetupScreen =
    document.querySelector(
      "#stocktaking-setup"
    );

  const existingActiveScreen =
    document.querySelector(
      "#stocktaking-active"
    );

  if (existingSetupScreen) {
    existingSetupScreen.remove();
  }

  if (existingActiveScreen) {
    existingActiveScreen.remove();
  }

  const mainElement =
    document.querySelector("main");

  stocktakingSetupScreen =
    document.createElement("section");

  stocktakingSetupScreen.id =
    "stocktaking-setup";

  stocktakingSetupScreen.hidden = true;

  stocktakingSetupScreen.innerHTML = `
    <h2>棚卸開始画面</h2>

    <p>
      棚卸日、担当者、保管場所を入力してください。
    </p>

    <form id="stocktaking-setup-form">
      <div>
        <label for="stocktaking-date">
          棚卸日（必須）
        </label>

        <input
          id="stocktaking-date"
          type="date"
          required
        >
      </div>

      <div>
        <label for="stocktaking-person">
          担当者（必須）
        </label>

        <input
          id="stocktaking-person"
          type="text"
          placeholder="例：テスト担当者"
          required
        >
      </div>

      <div>
        <label for="stocktaking-location">
          保管場所
        </label>

        <input
          id="stocktaking-location"
          type="text"
          placeholder="例：架空倉庫A"
        >

        <small>
          空欄の場合は、すべての保管場所を対象にします。
        </small>
      </div>

      <button type="submit">
        この内容で棚卸を開始する
      </button>

      <button
        id="cancel-stocktaking-setup-button"
        type="button"
      >
        キャンセル
      </button>
    </form>
  `;

  stocktakingActiveScreen =
    document.createElement("section");

  stocktakingActiveScreen.id =
    "stocktaking-active";

  stocktakingActiveScreen.hidden = true;

  stocktakingActiveScreen.innerHTML = `
    <h2>棚卸中</h2>

    <p class="stocktaking-notice">
      商品を確認し、保管場所ごとの数量を入力してください。複数の場所にある場合は「保管場所を追加」を押します。
    </p>

    <table class="stocktaking-info-table">
      <tbody>
        <tr>
          <th>棚卸日</th>
          <td id="active-stocktaking-date"></td>
        </tr>

        <tr>
          <th>担当者</th>
          <td id="active-stocktaking-person"></td>
        </tr>

        <tr>
          <th>登録保管場所</th>
          <td id="active-stocktaking-location"></td>
        </tr>

        <tr>
          <th>状態</th>
          <td id="active-stocktaking-status"></td>
        </tr>

        <tr>
          <th>開始日時</th>
          <td id="active-stocktaking-started-at"></td>
        </tr>
      </tbody>
    </table>

    <div class="stocktaking-summary">
      <p>
        対象商品：
        <strong id="stocktaking-summary-target">0</strong>件
      </p>

      <p>
        確認済み：
        <strong id="stocktaking-summary-checked">0</strong>件
      </p>

      <p>
        未確認：
        <strong id="stocktaking-summary-unchecked">0</strong>件
      </p>

      <p>
        差異なし：
        <strong id="stocktaking-summary-match">0</strong>件
      </p>

      <p>
        在庫不足：
        <strong id="stocktaking-summary-shortage">0</strong>件
      </p>

      <p>
        在庫過剰：
        <strong id="stocktaking-summary-surplus">0</strong>件
      </p>
    </div>

    <div class="stocktaking-search-area">
      <label for="stocktaking-product-search">
        棚卸商品を検索
      </label>

      <input
        id="stocktaking-product-search"
        type="search"
        placeholder="商品名・社内コード・商品コード・JANコード"
      >

      <p id="stocktaking-search-message">
        棚卸対象の商品をすべて表示しています。
      </p>
    </div>

    <button
      id="stocktaking-camera-scan-button"
      type="button"
    >
      JAN・社内コードのバーコードを読み取る
    </button>

    <div class="stocktaking-table-area">
      <table class="stocktaking-items-table">
        <thead>
          <tr>
            <th>結果</th>
            <th>社内コード</th>
            <th>商品コード</th>
            <th>商品名</th>
            <th>保管場所</th>
            <th>登録在庫</th>
            <th>場所別実在庫・合計</th>
            <th>差異</th>
            <th>メモ</th>
          </tr>
        </thead>

        <tbody id="stocktaking-items-body">
          <tr>
            <td colspan="9">
              商品を読み込んでいます。
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <p
      id="stocktaking-save-message"
      class="stocktaking-save-message"
    >
      数量を入力したら、商品カード下部のボタンから保存して次の操作へ進めます。
    </p>

    <fieldset class="stocktaking-reflect-area">
      <legend>
        棚卸確定時の在庫処理
      </legend>

      <label>
        <input
          type="radio"
          name="stocktaking-reflect"
          value="yes"
          checked
        >
        実在庫を現在庫へ反映する
      </label>

      <label>
        <input
          type="radio"
          name="stocktaking-reflect"
          value="no"
        >
        棚卸結果だけを保存し、現在庫は変更しない
      </label>
    </fieldset>

    <button
      id="save-stocktaking-items-button"
      type="button"
    >
      入力内容を保存する
    </button>

    <button
      id="confirm-stocktaking-button"
      type="button"
    >
      棚卸を確認・確定する
    </button>

    <button
      id="back-home-from-stocktaking-button"
      type="button"
    >
      保存してホームへ戻る
    </button>

    <button
      id="delete-stocktaking-button"
      type="button"
    >
      この棚卸を取り消す
    </button>
  `;

  mainElement.appendChild(
    stocktakingSetupScreen
  );

  mainElement.appendChild(
    stocktakingActiveScreen
  );

  getStocktakingElements();
  addStocktakingEventListeners();
}

function getStocktakingElements() {
  stocktakingSetupForm =
    document.querySelector(
      "#stocktaking-setup-form"
    );

  stocktakingDateInput =
    document.querySelector(
      "#stocktaking-date"
    );

  stocktakingPersonInput =
    document.querySelector(
      "#stocktaking-person"
    );

  stocktakingLocationInput =
    document.querySelector(
      "#stocktaking-location"
    );

  cancelStocktakingSetupButton =
    document.querySelector(
      "#cancel-stocktaking-setup-button"
    );

  activeStocktakingDate =
    document.querySelector(
      "#active-stocktaking-date"
    );

  activeStocktakingPerson =
    document.querySelector(
      "#active-stocktaking-person"
    );

  activeStocktakingLocation =
    document.querySelector(
      "#active-stocktaking-location"
    );

  activeStocktakingStatus =
    document.querySelector(
      "#active-stocktaking-status"
    );

  activeStocktakingStartedAt =
    document.querySelector(
      "#active-stocktaking-started-at"
    );

  stocktakingSummaryTarget =
    document.querySelector(
      "#stocktaking-summary-target"
    );

  stocktakingSummaryChecked =
    document.querySelector(
      "#stocktaking-summary-checked"
    );

  stocktakingSummaryUnchecked =
    document.querySelector(
      "#stocktaking-summary-unchecked"
    );

  stocktakingSummaryMatch =
    document.querySelector(
      "#stocktaking-summary-match"
    );

  stocktakingSummaryShortage =
    document.querySelector(
      "#stocktaking-summary-shortage"
    );

  stocktakingSummarySurplus =
    document.querySelector(
      "#stocktaking-summary-surplus"
    );

  stocktakingProductSearchInput =
    document.querySelector(
      "#stocktaking-product-search"
    );

  stocktakingSearchMessage =
    document.querySelector(
      "#stocktaking-search-message"
    );

  stocktakingCameraScanButton =
    document.querySelector(
      "#stocktaking-camera-scan-button"
    );

  stocktakingItemsBody =
    document.querySelector(
      "#stocktaking-items-body"
    );

  stocktakingSaveMessage =
    document.querySelector(
      "#stocktaking-save-message"
    );

  saveStocktakingItemsButton =
    document.querySelector(
      "#save-stocktaking-items-button"
    );

  confirmStocktakingButton =
    document.querySelector(
      "#confirm-stocktaking-button"
    );

  backHomeFromStocktakingButton =
    document.querySelector(
      "#back-home-from-stocktaking-button"
    );

  deleteStocktakingButton =
    document.querySelector(
      "#delete-stocktaking-button"
    );
}

function addStocktakingEventListeners() {
  stocktakingSetupForm.addEventListener(
    "submit",
    handleStocktakingStart
  );

  cancelStocktakingSetupButton.addEventListener(
    "click",
    returnHomeFromStocktakingSetup
  );

  saveStocktakingItemsButton.addEventListener(
    "click",
    handleSaveStocktakingItems
  );

  confirmStocktakingButton.addEventListener(
    "click",
    handleConfirmStocktaking
  );

  backHomeFromStocktakingButton.addEventListener(
    "click",
    handleSaveAndReturnHome
  );

  deleteStocktakingButton.addEventListener(
    "click",
    handleDeleteStocktaking
  );

  stocktakingProductSearchInput.addEventListener(
    "input",
    filterStocktakingItems
  );

  stocktakingCameraScanButton.addEventListener(
    "click",
    openStocktakingCameraScanner
  );
}

function createStocktakingStyle() {
  const existingStyle =
    document.querySelector(
      "#stocktaking-style"
    );

  if (existingStyle) {
    existingStyle.remove();
  }

  const styleElement =
    document.createElement("style");

  styleElement.id =
    "stocktaking-style";

  styleElement.textContent = `
    #show-stocktaking-button {
      background-color: #6a1b9a;
    }

    .stocktaking-notice {
      padding: 14px;
      border-radius: 8px;
      background-color: #ede7f6;
      color: #4a148c;
      font-size: 18px;
      font-weight: bold;
    }

    .stocktaking-info-table {
      width: 100%;
      margin-bottom: 20px;
      border-collapse: collapse;
    }

    .stocktaking-info-table th,
    .stocktaking-info-table td {
      padding: 12px;
      border: 1px solid #cfd8dc;
      text-align: left;
    }

    .stocktaking-info-table th {
      width: 180px;
      background-color: #6a1b9a;
      color: #ffffff;
    }

    .stocktaking-summary {
      display: grid;
      grid-template-columns:
        repeat(auto-fit, minmax(150px, 1fr));
      gap: 10px;
      margin: 20px 0;
    }

    .stocktaking-summary p {
      margin: 0;
      padding: 12px;
      border-radius: 8px;
      background-color: #f3e5f5;
      text-align: center;
      font-weight: bold;
    }

    .stocktaking-search-area {
      margin: 20px 0;
    }

    #stocktaking-search-message {
      padding: 10px 12px;
      border-radius: 8px;
      background-color: #e3f2fd;
      font-weight: bold;
    }

    .stocktaking-table-area {
      width: 100%;
      overflow-x: auto;
    }

    .stocktaking-items-table {
      width: 100%;
      min-width: 1250px;
      border-collapse: collapse;
    }

    .stocktaking-items-table th,
    .stocktaking-items-table td {
      padding: 10px;
      border: 1px solid #cfd8dc;
      text-align: left;
      vertical-align: middle;
    }

    .stocktaking-items-table th {
      background-color: #6a1b9a;
      color: #ffffff;
      white-space: nowrap;
    }

    .stocktaking-items-table input[type="number"] {
      min-width: 100px;
    }

    .stocktaking-items-table input[type="text"] {
      min-width: 180px;
    }

    .stocktaking-location-count-cell {
      min-width: 420px;
    }

    .stocktaking-mobile-location-heading,
    .stocktaking-mobile-memo-label,
    .stocktaking-cell-mobile-actions {
      display: none;
    }

    .stocktaking-location-entries {
      display: grid;
      gap: 8px;
    }

    .stocktaking-location-entry {
      display: grid;
      grid-template-columns:
        minmax(150px, 1fr)
        100px
        auto;
      gap: 8px;
      align-items: center;
      padding: 8px;
      border: 1px solid #d1c4e9;
      border-radius: 8px;
      background-color: #ffffff;
    }

    .stocktaking-location-entry input {
      width: 100%;
      min-width: 0;
      margin: 0;
    }

    .stocktaking-remove-location-button,
    .stocktaking-add-location-button {
      margin: 0;
      padding: 9px 12px;
      font-size: 15px;
    }

    .stocktaking-remove-location-button {
      background-color: #c62828;
    }

    .stocktaking-remove-location-button:disabled {
      background-color: #b0bec5;
      cursor: not-allowed;
    }

    .stocktaking-add-location-button {
      margin-top: 8px;
      background-color: #0277bd;
    }

    .stocktaking-location-total {
      margin: 8px 0 0;
      padding: 8px;
      border-radius: 8px;
      background-color: #ede7f6;
      color: #4a148c;
      font-weight: bold;
    }

    .stocktaking-row-unchecked {
      background-color: #eceff1;
    }

    .stocktaking-row-match {
      background-color: #e8f5e9;
    }

    .stocktaking-row-shortage {
      background-color: #ffebee;
    }

    .stocktaking-row-surplus {
      background-color: #fff3e0;
    }

    .stocktaking-result-badge {
      display: inline-block;
      min-width: 88px;
      padding: 5px 9px;
      border-radius: 20px;
      text-align: center;
      font-weight: bold;
      white-space: nowrap;
    }

    .stocktaking-badge-unchecked {
      background-color: #cfd8dc;
      color: #455a64;
    }

    .stocktaking-badge-match {
      background-color: #c8e6c9;
      color: #1b5e20;
    }

    .stocktaking-badge-shortage {
      background-color: #ffcdd2;
      color: #b71c1c;
    }

    .stocktaking-badge-surplus {
      background-color: #ffe0b2;
      color: #e65100;
    }

    .stocktaking-difference {
      font-weight: bold;
      white-space: nowrap;
    }

    .stocktaking-save-message {
      padding: 12px;
      border-radius: 8px;
      background-color: #fff8e1;
      color: #795548;
      font-weight: bold;
    }

    .stocktaking-save-message.saved {
      background-color: #e8f5e9;
      color: #1b5e20;
    }

    .stocktaking-reflect-area {
      display: grid;
      gap: 12px;
      margin: 20px 0;
      padding: 16px;
      border: 2px solid #6a1b9a;
      border-radius: 10px;
      background-color: #faf5fc;
    }

    .stocktaking-reflect-area legend {
      padding: 0 8px;
      color: #4a148c;
      font-size: 18px;
      font-weight: bold;
    }

    .stocktaking-reflect-area label {
      display: flex;
      align-items: center;
      gap: 10px;
      margin: 0;
      padding: 10px;
      border-radius: 8px;
      background-color: #ffffff;
    }

    .stocktaking-reflect-area input {
      width: 24px;
      height: 24px;
      margin: 0;
    }

    #stocktaking-camera-scan-button {
      width: 100%;
      margin: 0 0 18px;
      background-color: #0277bd;
      font-size: 18px;
    }

    #save-stocktaking-items-button {
      background-color: #2e7d32;
    }

    #confirm-stocktaking-button {
      background-color: #1565c0;
    }

    #delete-stocktaking-button {
      background-color: #c62828;
    }

    @media (max-width: 700px) {
      #stocktaking-setup button,
      #stocktaking-active > button {
        width: 100%;
        margin: 6px 0;
      }

      #stocktaking-active {
        padding-left: 0;
        padding-right: 0;
      }

      #stocktaking-active > h2,
      #stocktaking-active > p,
      #stocktaking-active > table,
      #stocktaking-active > .stocktaking-summary,
      #stocktaking-active > .stocktaking-search-area,
      #stocktaking-active > fieldset,
      #stocktaking-active > button {
        margin-left: 12px;
        margin-right: 12px;
        width: calc(100% - 24px);
        box-sizing: border-box;
      }

      .stocktaking-info-table th {
        width: 112px;
        padding: 9px;
        font-size: 14px;
      }

      .stocktaking-info-table td {
        padding: 9px;
        font-size: 14px;
      }

      .stocktaking-summary {
        grid-template-columns:
          repeat(2, minmax(0, 1fr));
        gap: 8px;
      }

      .stocktaking-summary p {
        padding: 10px 6px;
        font-size: 14px;
      }

      .stocktaking-table-area {
        overflow-x: visible;
        padding: 0 12px;
        box-sizing: border-box;
      }

      .stocktaking-items-table {
        display: block;
        width: 100%;
        min-width: 0;
        border: 0;
      }

      .stocktaking-items-table thead {
        display: none;
      }

      .stocktaking-items-table tbody {
        display: grid;
        gap: 16px;
        width: 100%;
      }

      .stocktaking-items-table tbody > tr:not([data-internal-code]) {
        display: block;
        width: 100%;
      }

      .stocktaking-items-table tbody > tr:not([data-internal-code]) td {
        display: block;
        width: 100%;
        padding: 18px;
        border: 1px solid #cfd8dc;
        border-radius: 12px;
        text-align: center;
        box-sizing: border-box;
      }

      .stocktaking-product-card-row {
        display: grid;
        grid-template-columns:
          minmax(0, 1fr)
          minmax(0, 1fr);
        grid-template-areas:
          "result result"
          "name name"
          "internal internal"
          "product product"
          "location location"
          "registered difference"
          "actual actual"
          "memo memo"
          "actions actions";
        gap: 0 10px;
        width: 100%;
        padding: 16px;
        border: 2px solid #d7dee5;
        border-radius: 16px;
        background-color: #ffffff;
        box-shadow: 0 4px 14px rgba(38, 50, 56, 0.12);
        box-sizing: border-box;
      }

      .stocktaking-product-card-row.stocktaking-row-match {
        border-color: #81c784;
      }

      .stocktaking-product-card-row.stocktaking-row-shortage {
        border-color: #ef9a9a;
      }

      .stocktaking-product-card-row.stocktaking-row-surplus {
        border-color: #ffb74d;
      }

      .stocktaking-product-card-row.stocktaking-row-unchecked {
        border-color: #b0bec5;
      }

      .stocktaking-items-table .stocktaking-product-card-row > td {
        display: block;
        width: auto;
        min-width: 0;
        padding: 8px 0;
        border: 0;
        background: transparent;
        box-sizing: border-box;
      }

      .stocktaking-cell-result {
        grid-area: result;
        justify-self: end;
        padding-top: 0 !important;
        padding-bottom: 4px !important;
      }

      .stocktaking-result-badge {
        min-width: 0;
        padding: 7px 12px;
        border-radius: 9px;
        font-size: 15px;
      }

      .stocktaking-cell-product-name {
        grid-area: name;
        padding: 6px 0 12px !important;
        border-bottom: 1px solid #e0e6ea !important;
        color: #17202a;
        font-size: 24px;
        font-weight: 800;
        line-height: 1.35;
        overflow-wrap: anywhere;
      }

      .stocktaking-cell-internal-code {
        grid-area: internal;
      }

      .stocktaking-cell-product-code {
        grid-area: product;
      }

      .stocktaking-cell-registered-location {
        grid-area: location;
        padding-bottom: 12px !important;
        border-bottom: 1px solid #e0e6ea !important;
      }

      .stocktaking-cell-internal-code,
      .stocktaking-cell-product-code,
      .stocktaking-cell-registered-location {
        display: grid !important;
        grid-template-columns: 118px minmax(0, 1fr);
        gap: 8px;
        align-items: start;
        color: #263238;
        font-size: 16px;
        overflow-wrap: anywhere;
      }

      .stocktaking-cell-internal-code::before,
      .stocktaking-cell-product-code::before,
      .stocktaking-cell-registered-location::before {
        content: attr(data-label);
        color: #546e7a;
        font-weight: 700;
      }

      .stocktaking-cell-registered-stock,
      .stocktaking-cell-difference {
        margin-top: 12px;
        padding: 12px 8px !important;
        border-radius: 10px !important;
        text-align: center !important;
        font-size: 25px;
        font-weight: 800;
      }

      .stocktaking-cell-registered-stock {
        grid-area: registered;
        background-color: #e8f1fd !important;
        color: #1565c0;
      }

      .stocktaking-cell-difference {
        grid-area: difference;
      }

      .stocktaking-cell-registered-stock::before,
      .stocktaking-cell-difference::before {
        content: attr(data-label);
        display: block;
        margin-bottom: 5px;
        color: #455a64;
        font-size: 14px;
        font-weight: 700;
      }

      .stocktaking-row-match .stocktaking-cell-difference {
        background-color: #e8f5e9 !important;
        color: #1b5e20;
      }

      .stocktaking-row-shortage .stocktaking-cell-difference {
        background-color: #ffebee !important;
        color: #b71c1c;
      }

      .stocktaking-row-surplus .stocktaking-cell-difference {
        background-color: #fff3e0 !important;
        color: #e65100;
      }

      .stocktaking-row-unchecked .stocktaking-cell-difference {
        background-color: #eceff1 !important;
        color: #455a64;
      }

      .stocktaking-cell-actual-stock {
        grid-area: actual;
        margin-top: 14px;
        padding: 14px !important;
        border: 1px solid #d7dee5 !important;
        border-radius: 12px;
        background-color: #f8fafc !important;
      }

      .stocktaking-mobile-location-heading {
        display: grid;
        grid-template-columns:
          minmax(0, 1fr)
          76px
          46px;
        gap: 7px;
        margin-bottom: 7px;
        color: #455a64;
        font-size: 14px;
        font-weight: 700;
      }

      .stocktaking-mobile-location-heading span:nth-child(2),
      .stocktaking-mobile-location-heading span:nth-child(3) {
        text-align: center;
      }

      .stocktaking-location-count-cell {
        min-width: 0;
      }

      .stocktaking-location-entries {
        gap: 7px;
      }

      .stocktaking-location-entry {
        grid-template-columns:
          minmax(0, 1fr)
          76px
          46px;
        gap: 7px;
        padding: 0;
        border: 0;
        background-color: transparent;
      }

      .stocktaking-items-table input[type="text"],
      .stocktaking-items-table input[type="number"] {
        min-width: 0;
        width: 100%;
        margin: 0;
        padding: 11px 8px;
        border: 1px solid #b9c5ce;
        border-radius: 8px;
        background-color: #ffffff;
        font-size: 16px;
        box-sizing: border-box;
      }

      .stocktaking-location-entry input[type="number"] {
        text-align: center;
      }

      .stocktaking-remove-location-button {
        width: 46px;
        min-width: 46px;
        height: 44px;
        padding: 0;
        border-radius: 8px;
        font-size: 12px;
      }

      .stocktaking-add-location-button {
        width: 100%;
        margin-top: 10px;
        padding: 12px;
        border: 2px solid #1565c0;
        background-color: #ffffff;
        color: #1565c0;
        font-size: 16px;
        font-weight: 700;
      }

      .stocktaking-location-total {
        margin-top: 12px;
        padding: 13px;
        border-radius: 10px;
        background-color: #e8f5e9;
        color: #1b5e20;
        text-align: right;
        font-size: 20px;
        font-weight: 800;
      }

      .stocktaking-cell-memo {
        grid-area: memo;
        padding-top: 14px !important;
      }

      .stocktaking-mobile-memo-label {
        display: block;
        margin-bottom: 7px;
        color: #263238;
        font-size: 17px;
        font-weight: 700;
      }

      .stocktaking-cell-memo .stocktaking-memo-input {
        width: 100%;
        min-height: 46px;
      }

      .stocktaking-cell-mobile-actions {
        grid-area: actions;
        display: grid !important;
        gap: 9px;
        padding-top: 14px !important;
      }

      .stocktaking-cell-mobile-actions button {
        width: 100%;
        margin: 0;
        padding: 14px 10px;
        border-radius: 10px;
        font-size: 17px;
        font-weight: 700;
        line-height: 1.35;
      }

      .stocktaking-save-and-scan-button {
        background-color: #0277bd;
      }

      .stocktaking-save-and-top-button {
        background-color: #546e7a;
      }

      .stocktaking-cell-mobile-actions button:disabled {
        background-color: #90a4ae;
        cursor: wait;
      }

      #save-stocktaking-items-button {
        padding-top: 15px;
        padding-bottom: 15px;
        font-size: 19px;
      }
    }

    @media (max-width: 390px) {
      .stocktaking-product-card-row {
        padding: 13px;
      }

      .stocktaking-cell-product-name {
        font-size: 21px;
      }

      .stocktaking-cell-internal-code,
      .stocktaking-cell-product-code,
      .stocktaking-cell-registered-location {
        grid-template-columns: 105px minmax(0, 1fr);
        font-size: 15px;
      }

      .stocktaking-mobile-location-heading,
      .stocktaking-location-entry {
        grid-template-columns:
          minmax(0, 1fr)
          68px
          42px;
        gap: 5px;
      }

      .stocktaking-remove-location-button {
        width: 42px;
        min-width: 42px;
      }
    }
  `;

  document.head.appendChild(
    styleElement
  );
}

async function openStocktakingStart() {
  try {
    const openStocktakings =
      await getOpenStocktakingSessions();

    openStocktakings.sort(
      function (
        stocktakingA,
        stocktakingB
      ) {
        return (
          new Date(
            stocktakingB.startedAt
          ).getTime() -
          new Date(
            stocktakingA.startedAt
          ).getTime()
        );
      }
    );

    if (openStocktakings.length > 0) {
      const latestStocktaking =
        openStocktakings[0];

      const resumeConfirmed =
        window.confirm(
          "進行中の棚卸があります。\n\n" +
          `棚卸日：${latestStocktaking.stocktakingDate}\n` +
          `担当者：${latestStocktaking.person}\n` +
          `保管場所：${latestStocktaking.location}\n\n` +
          "この棚卸を開きますか？"
        );

      if (resumeConfirmed) {
        await showActiveStocktaking(
          latestStocktaking
        );

        return;
      }
    }
  } catch (error) {
    console.error(error);

    alert(
      "進行中の棚卸を確認できませんでした。"
    );
  }

  showStocktakingSetupScreen();
}

function showStocktakingSetupScreen() {
  hideAllMainScreensForStocktaking();

  stocktakingSetupScreen.hidden = false;

  stocktakingSetupForm.reset();

  stocktakingDateInput.value =
    getTodayDateText();

  stocktakingPersonInput.focus();

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

async function handleStocktakingStart(
  event
) {
  event.preventDefault();

  const stocktakingDate =
    stocktakingDateInput.value;

  const person =
    stocktakingPersonInput.value.trim();

  const enteredLocation =
    stocktakingLocationInput.value.trim();

  const location =
    enteredLocation === ""
      ? "すべての保管場所"
      : enteredLocation;

  if (stocktakingDate === "") {
    alert(
      "棚卸日を入力してください。"
    );

    stocktakingDateInput.focus();
    return;
  }

  if (person === "") {
    alert(
      "担当者を入力してください。"
    );

    stocktakingPersonInput.focus();
    return;
  }

  let targetProducts = [];

  try {
    const allProducts =
      await getAllProducts();

    targetProducts =
      getStocktakingTargetProducts(
        allProducts,
        location
      );
  } catch (error) {
    console.error(error);

    alert(
      "棚卸対象の商品を読み込めませんでした。"
    );

    return;
  }

  if (targetProducts.length === 0) {
    alert(
      "棚卸対象の商品がありません。\n\n" +
      "登録商品数と保管場所を確認してください。"
    );

    stocktakingLocationInput.focus();
    return;
  }

  const confirmationMessage =
    "この内容で棚卸を開始しますか？\n\n" +
    `棚卸日：${stocktakingDate}\n` +
    `担当者：${person}\n` +
    `保管場所：${location}\n` +
    `対象商品：${targetProducts.length}件`;

  const isConfirmed =
    window.confirm(
      confirmationMessage
    );

  if (!isConfirmed) {
    return;
  }

  const startedAt =
    new Date().toISOString();

  const stocktaking = {
    id: createStocktakingId(),
    stocktakingDate:
      stocktakingDate,
    person: person,
    location: location,
    status: "進行中",
    startedAt: startedAt,
    updatedAt: startedAt,
    confirmedAt: "",
    reflectedToInventory: false,
    items:
      createStocktakingItems(
        targetProducts
      )
  };

  try {
    await saveStocktakingSession(
      stocktaking
    );

    await showActiveStocktaking(
      stocktaking
    );

    alert(
      "棚卸を開始しました。"
    );
  } catch (error) {
    console.error(error);

    alert(
      "棚卸開始情報を保存できませんでした。"
    );
  }
}

function getStocktakingTargetProducts(
  allProducts,
  location
) {
  const normalizedLocation =
    normalizeStocktakingText(
      location
    );

  const targetProducts =
    allProducts.filter(
      function (product) {
        if (
          location ===
          "すべての保管場所"
        ) {
          return true;
        }

        return (
          normalizeStocktakingText(
            product.location
          ) === normalizedLocation
        );
      }
    );

  targetProducts.sort(
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

  return targetProducts;
}

function createStocktakingItems(
  targetProducts
) {
  return targetProducts.map(
    function (product) {
      const defaultLocation =
        product.location || "";

      return {
        internalCode:
          product.internalCode || "",
        productCode:
          product.productCode || "",
        productName:
          product.productName || "",
        janCode:
          product.janCode || "",
        location:
          defaultLocation ||
          "未登録",
        registeredStock:
          getValidStocktakingNumber(
            product.stock
          ),
        locationBreakdown: [
          {
            id:
              createStocktakingLocationEntryId(),
            location:
              defaultLocation,
            quantity: ""
          }
        ],
        actualStock: "",
        difference: null,
        result: "未確認",
        memo: "",
        checkedAt: ""
      };
    }
  );
}

async function showActiveStocktaking(
  stocktaking
) {
  currentStocktaking = {
    ...stocktaking,
    items: Array.isArray(
      stocktaking.items
    )
      ? stocktaking.items
      : []
  };

  if (
    currentStocktaking.items.length === 0
  ) {
    try {
      const allProducts =
        await getAllProducts();

      const targetProducts =
        getStocktakingTargetProducts(
          allProducts,
          currentStocktaking.location
        );

      currentStocktaking.items =
        createStocktakingItems(
          targetProducts
        );

      currentStocktaking.updatedAt =
        new Date().toISOString();

      await updateStocktakingSession(
        currentStocktaking
      );
    } catch (error) {
      console.error(error);

      alert(
        "棚卸対象の商品を読み込めませんでした。"
      );

      return;
    }
  }

  currentStocktaking.items =
    currentStocktaking.items.map(
      normalizeStocktakingItem
    );

  activeStocktakingDate.textContent =
    currentStocktaking.stocktakingDate;

  activeStocktakingPerson.textContent =
    currentStocktaking.person;

  activeStocktakingLocation.textContent =
    currentStocktaking.location;

  activeStocktakingStatus.textContent =
    currentStocktaking.status;

  activeStocktakingStartedAt.textContent =
    formatStocktakingDateTime(
      currentStocktaking.startedAt
    );

  stocktakingProductSearchInput.value =
    "";

  stocktakingSaveMessage.textContent =
    "数量を入力したら、商品カード下部のボタンから保存して次の操作へ進めます。";

  stocktakingSaveMessage.classList.remove(
    "saved"
  );

  const reflectYesInput =
    document.querySelector(
      'input[name="stocktaking-reflect"][value="yes"]'
    );

  reflectYesInput.checked = true;

  stocktakingHasUnsavedChanges =
    false;

  renderStocktakingItems();

  hideAllMainScreensForStocktaking();

  stocktakingActiveScreen.hidden = false;

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

function normalizeStocktakingItem(item) {
  const registeredStock =
    getValidStocktakingNumber(
      item.registeredStock
    );

  const locationBreakdown =
    normalizeStocktakingLocationBreakdown(
      item
    );

  const actualStock =
    calculateStocktakingLocationTotal(
      locationBreakdown
    );

  const difference =
    actualStock === ""
      ? null
      : actualStock -
        registeredStock;

  return {
    internalCode:
      item.internalCode || "",
    productCode:
      item.productCode || "",
    productName:
      item.productName || "",
    janCode:
      item.janCode || "",
    location:
      item.location || "未登録",
    registeredStock:
      registeredStock,
    locationBreakdown:
      locationBreakdown,
    actualStock:
      actualStock,
    difference:
      difference,
    result:
      getStocktakingResult(
        difference
      ),
    memo:
      item.memo || "",
    checkedAt:
      actualStock === ""
        ? ""
        : (
            item.checkedAt ||
            new Date().toISOString()
          )
  };
}

function renderStocktakingItems() {
  stocktakingItemsBody.innerHTML = "";

  if (
    !currentStocktaking ||
    currentStocktaking.items.length === 0
  ) {
    const row =
      document.createElement("tr");

    const cell =
      document.createElement("td");

    cell.colSpan = 9;

    cell.textContent =
      "棚卸対象の商品がありません。";

    row.appendChild(cell);

    stocktakingItemsBody.appendChild(
      row
    );

    updateStocktakingSummary();
    return;
  }

  currentStocktaking.items.forEach(
    function (item) {
      const row =
        createStocktakingItemRow(
          item
        );

      stocktakingItemsBody.appendChild(
        row
      );
    }
  );

  filterStocktakingItems();
  updateStocktakingSummary();
}

function createStocktakingItemRow(
  item
) {
  const row =
    document.createElement("tr");

  row.dataset.internalCode =
    item.internalCode;

  row.classList.add(
    "stocktaking-product-card-row"
  );

  row.dataset.searchText =
    normalizeStocktakingText(
      [
        item.internalCode,
        item.productCode,
        item.productName,
        item.janCode,
        item.location
      ].join(" ")
    );

  const resultCell =
    document.createElement("td");

  resultCell.classList.add(
    "stocktaking-cell-result"
  );

  const resultBadge =
    document.createElement("span");

  resultBadge.classList.add(
    "stocktaking-result-badge"
  );

  resultCell.appendChild(
    resultBadge
  );

  row.appendChild(
    resultCell
  );

  appendStocktakingTextCell(
    row,
    item.internalCode,
    "stocktaking-cell-internal-code",
    "社内コード"
  );

  appendStocktakingTextCell(
    row,
    item.productCode || "未登録",
    "stocktaking-cell-product-code",
    "商品コード"
  );

  appendStocktakingTextCell(
    row,
    item.productName,
    "stocktaking-cell-product-name",
    "商品名"
  );

  appendStocktakingTextCell(
    row,
    item.location,
    "stocktaking-cell-registered-location",
    "登録保管場所"
  );

  appendStocktakingTextCell(
    row,
    item.registeredStock,
    "stocktaking-cell-registered-stock",
    "登録在庫"
  );

  const actualStockCell =
    document.createElement("td");

  actualStockCell.classList.add(
    "stocktaking-location-count-cell",
    "stocktaking-cell-actual-stock"
  );

  const locationHeading =
    document.createElement("div");

  locationHeading.classList.add(
    "stocktaking-mobile-location-heading"
  );

  const locationHeadingText =
    document.createElement("span");

  locationHeadingText.textContent =
    "保管場所";

  const quantityHeadingText =
    document.createElement("span");

  quantityHeadingText.textContent =
    "数量";

  const actionHeadingText =
    document.createElement("span");

  actionHeadingText.textContent =
    "操作";

  locationHeading.appendChild(
    locationHeadingText
  );

  locationHeading.appendChild(
    quantityHeadingText
  );

  locationHeading.appendChild(
    actionHeadingText
  );

  const locationEntries =
    document.createElement("div");

  locationEntries.classList.add(
    "stocktaking-location-entries"
  );

  locationEntries.dataset.internalCode =
    item.internalCode;

  const addLocationButton =
    document.createElement("button");

  addLocationButton.type =
    "button";

  addLocationButton.textContent =
    "保管場所を追加";

  addLocationButton.classList.add(
    "stocktaking-add-location-button"
  );

  const totalDisplay =
    document.createElement("p");

  totalDisplay.classList.add(
    "stocktaking-location-total"
  );

  actualStockCell.appendChild(
    locationHeading
  );

  actualStockCell.appendChild(
    locationEntries
  );

  actualStockCell.appendChild(
    addLocationButton
  );

  actualStockCell.appendChild(
    totalDisplay
  );

  row.appendChild(
    actualStockCell
  );

  const differenceCell =
    document.createElement("td");

  differenceCell.classList.add(
    "stocktaking-difference",
    "stocktaking-cell-difference"
  );

  differenceCell.dataset.label =
    "差異";

  row.appendChild(
    differenceCell
  );

  const memoCell =
    document.createElement("td");

  memoCell.classList.add(
    "stocktaking-cell-memo"
  );

  const memoLabel =
    document.createElement("label");

  memoLabel.classList.add(
    "stocktaking-mobile-memo-label"
  );

  memoLabel.textContent =
    "メモ";

  const memoInput =
    document.createElement("input");

  memoInput.type = "text";

  memoInput.placeholder =
    "必要な場合に入力";

  memoInput.value =
    item.memo || "";

  memoInput.classList.add(
    "stocktaking-memo-input"
  );

  memoInput.dataset.internalCode =
    item.internalCode;

  memoCell.appendChild(
    memoLabel
  );

  memoCell.appendChild(
    memoInput
  );

  row.appendChild(
    memoCell
  );

  const mobileActionsCell =
    document.createElement("td");

  mobileActionsCell.classList.add(
    "stocktaking-cell-mobile-actions"
  );

  const saveAndScanButton =
    document.createElement("button");

  saveAndScanButton.type =
    "button";

  saveAndScanButton.textContent =
    "保存して次の商品を読み取る";

  saveAndScanButton.classList.add(
    "stocktaking-save-and-scan-button"
  );

  const saveAndTopButton =
    document.createElement("button");

  saveAndTopButton.type =
    "button";

  saveAndTopButton.textContent =
    "保存して棚卸画面の上へ戻る";

  saveAndTopButton.classList.add(
    "stocktaking-save-and-top-button"
  );

  mobileActionsCell.appendChild(
    saveAndScanButton
  );

  mobileActionsCell.appendChild(
    saveAndTopButton
  );

  row.appendChild(
    mobileActionsCell
  );

  saveAndScanButton.addEventListener(
    "click",
    function () {
      handleStocktakingCardSaveAction(
        item,
        "scan",
        saveAndScanButton,
        saveAndTopButton
      );
    }
  );

  saveAndTopButton.addEventListener(
    "click",
    function () {
      handleStocktakingCardSaveAction(
        item,
        "top",
        saveAndScanButton,
        saveAndTopButton
      );
    }
  );

  addLocationButton.addEventListener(
    "click",
    function () {
      item.locationBreakdown.push({
        id:
          createStocktakingLocationEntryId(),
        location: "",
        quantity: ""
      });

      renderStocktakingLocationEntries(
        item,
        row,
        locationEntries,
        totalDisplay,
        differenceCell,
        resultBadge
      );

      markStocktakingAsUnsaved();

      window.setTimeout(
        function () {
          const locationInputs =
            locationEntries.querySelectorAll(
              ".stocktaking-location-name-input"
            );

          const lastInput =
            locationInputs[
              locationInputs.length - 1
            ];

          if (lastInput) {
            lastInput.focus();
          }
        },
        50
      );
    }
  );

  memoInput.addEventListener(
    "input",
    function () {
      item.memo =
        memoInput.value.trim();

      markStocktakingAsUnsaved();
    }
  );

  renderStocktakingLocationEntries(
    item,
    row,
    locationEntries,
    totalDisplay,
    differenceCell,
    resultBadge
  );

  updateStocktakingRowAppearance(
    item,
    row,
    differenceCell,
    resultBadge
  );

  return row;
}

function appendStocktakingTextCell(
  row,
  value,
  className,
  label
) {
  const cell =
    document.createElement("td");

  if (className) {
    cell.classList.add(
      className
    );
  }

  if (label) {
    cell.dataset.label =
      label;
  }

  cell.textContent =
    value;

  row.appendChild(cell);
}

function renderStocktakingLocationEntries(
  item,
  row,
  locationEntries,
  totalDisplay,
  differenceCell,
  resultBadge
) {
  if (
    !Array.isArray(
      item.locationBreakdown
    ) ||
    item.locationBreakdown.length === 0
  ) {
    item.locationBreakdown = [
      {
        id:
          createStocktakingLocationEntryId(),
        location:
          item.location === "未登録"
            ? ""
            : item.location,
        quantity: ""
      }
    ];
  }

  locationEntries.innerHTML = "";

  item.locationBreakdown.forEach(
    function (
      entry,
      index
    ) {
      const entryRow =
        document.createElement("div");

      entryRow.classList.add(
        "stocktaking-location-entry"
      );

      entryRow.dataset.entryId =
        entry.id;

      const locationInput =
        document.createElement("input");

      locationInput.type =
        "text";

      locationInput.placeholder =
        "保管場所";

      locationInput.value =
        entry.location || "";

      locationInput.classList.add(
        "stocktaking-location-name-input"
      );

      locationInput.dataset.entryId =
        entry.id;

      locationInput.setAttribute(
        "aria-label",
        `${item.productName}の保管場所`
      );

      const quantityInput =
        document.createElement("input");

      quantityInput.type =
        "number";

      quantityInput.min = "0";
      quantityInput.step = "1";

      quantityInput.placeholder =
        "数量";

      quantityInput.value =
        entry.quantity === ""
          ? ""
          : entry.quantity;

      quantityInput.classList.add(
        "stocktaking-actual-input"
      );

      quantityInput.dataset.internalCode =
        item.internalCode;

      quantityInput.dataset.entryId =
        entry.id;

      quantityInput.setAttribute(
        "aria-label",
        `${item.productName}の${index + 1}か所目の数量`
      );

      const removeButton =
        document.createElement("button");

      removeButton.type =
        "button";

      removeButton.textContent =
        "削除";

      removeButton.classList.add(
        "stocktaking-remove-location-button"
      );

      removeButton.disabled =
        item.locationBreakdown.length === 1;

      locationInput.addEventListener(
        "input",
        function () {
          entry.location =
            locationInput.value.trim();

          refreshStocktakingItemFromLocations(
            item
          );

          updateStocktakingLocationDisplay(
            item,
            row,
            totalDisplay,
            differenceCell,
            resultBadge
          );

          markStocktakingAsUnsaved();
        }
      );

      quantityInput.addEventListener(
        "input",
        function () {
          entry.quantity =
            quantityInput.value.trim();

          refreshStocktakingItemFromLocations(
            item
          );

          updateStocktakingLocationDisplay(
            item,
            row,
            totalDisplay,
            differenceCell,
            resultBadge
          );

          markStocktakingAsUnsaved();
        }
      );

      removeButton.addEventListener(
        "click",
        function () {
          if (
            item.locationBreakdown.length <= 1
          ) {
            return;
          }

          item.locationBreakdown =
            item.locationBreakdown.filter(
              function (
                currentEntry
              ) {
                return (
                  currentEntry.id !==
                  entry.id
                );
              }
            );

          refreshStocktakingItemFromLocations(
            item
          );

          renderStocktakingLocationEntries(
            item,
            row,
            locationEntries,
            totalDisplay,
            differenceCell,
            resultBadge
          );

          updateStocktakingSummary();
          markStocktakingAsUnsaved();
        }
      );

      entryRow.appendChild(
        locationInput
      );

      entryRow.appendChild(
        quantityInput
      );

      entryRow.appendChild(
        removeButton
      );

      locationEntries.appendChild(
        entryRow
      );
    }
  );

  updateStocktakingLocationDisplay(
    item,
    row,
    totalDisplay,
    differenceCell,
    resultBadge
  );
}

function updateStocktakingLocationDisplay(
  item,
  row,
  totalDisplay,
  differenceCell,
  resultBadge
) {
  totalDisplay.textContent =
    item.actualStock === ""
      ? "実在庫合計：未確認"
      : `実在庫合計：${item.actualStock}個`;

  updateStocktakingRowAppearance(
    item,
    row,
    differenceCell,
    resultBadge
  );

  updateStocktakingSummary();
}

function refreshStocktakingItemFromLocations(
  item
) {
  const actualStock =
    calculateStocktakingLocationTotal(
      item.locationBreakdown
    );

  item.actualStock =
    actualStock;

  item.difference =
    actualStock === ""
      ? null
      : actualStock -
        item.registeredStock;

  item.result =
    getStocktakingResult(
      item.difference
    );

  item.checkedAt =
    actualStock === ""
      ? ""
      : new Date().toISOString();
}

function calculateStocktakingLocationTotal(
  locationBreakdown
) {
  if (
    !Array.isArray(
      locationBreakdown
    )
  ) {
    return "";
  }

  let hasEnteredQuantity =
    false;

  let total = 0;

  locationBreakdown.forEach(
    function (entry) {
      const quantityText =
        String(
          entry.quantity ===
            undefined ||
          entry.quantity ===
            null
            ? ""
            : entry.quantity
        ).trim();

      if (quantityText === "") {
        return;
      }

      const quantity =
        Number(quantityText);

      if (
        Number.isInteger(
          quantity
        ) &&
        quantity >= 0
      ) {
        hasEnteredQuantity =
          true;

        total += quantity;
      }
    }
  );

  return hasEnteredQuantity
    ? total
    : "";
}

function normalizeStocktakingLocationBreakdown(
  item
) {
  let sourceEntries =
    Array.isArray(
      item.locationBreakdown
    )
      ? item.locationBreakdown
      : [];

  if (sourceEntries.length === 0) {
    const oldActualStock =
      normalizeActualStockValue(
        item.actualStock
      );

    sourceEntries = [
      {
        id:
          createStocktakingLocationEntryId(),
        location:
          item.location === "未登録"
            ? ""
            : (
                item.location || ""
              ),
        quantity:
          oldActualStock
      }
    ];
  }

  const normalizedEntries =
    sourceEntries.map(
      function (entry) {
        const quantityText =
          String(
            entry.quantity ===
              undefined ||
            entry.quantity ===
              null
              ? ""
              : entry.quantity
          ).trim();

        const quantity =
          quantityText === ""
            ? ""
            : Number(quantityText);

        return {
          id:
            entry.id ||
            createStocktakingLocationEntryId(),
          location:
            String(
              entry.location || ""
            ).trim(),
          quantity:
            Number.isInteger(
              quantity
            ) &&
            quantity >= 0
              ? quantity
              : ""
        };
      }
    );

  return normalizedEntries.length > 0
    ? normalizedEntries
    : [
        {
          id:
            createStocktakingLocationEntryId(),
          location: "",
          quantity: ""
        }
      ];
}

function validateStocktakingLocationEntries() {
  if (
    !currentStocktaking ||
    !Array.isArray(
      currentStocktaking.items
    )
  ) {
    return false;
  }

  for (
    const item of
    currentStocktaking.items
  ) {
    const entries =
      Array.isArray(
        item.locationBreakdown
      )
        ? item.locationBreakdown
        : [];

    const hasAnyQuantity =
      entries.some(
        function (entry) {
          return (
            String(
              entry.quantity ===
                undefined ||
              entry.quantity ===
                null
                ? ""
                : entry.quantity
            ).trim() !== ""
          );
        }
      );

    if (!hasAnyQuantity) {
      continue;
    }

    const usedLocations =
      new Set();

    for (const entry of entries) {
      const location =
        String(
          entry.location || ""
        ).trim();

      const quantityText =
        String(
          entry.quantity ===
            undefined ||
          entry.quantity ===
            null
            ? ""
            : entry.quantity
        ).trim();

      const entryHasData =
        location !== "" ||
        quantityText !== "";

      if (!entryHasData) {
        continue;
      }

      if (location === "") {
        alert(
          `「${item.productName}」の保管場所を入力してください。`
        );

        focusStocktakingLocationEntry(
          entry.id,
          "location"
        );

        return false;
      }

      if (quantityText === "") {
        alert(
          `「${item.productName}」の「${location}」の数量を入力してください。\n\n` +
          "その場所に在庫がない場合は0を入力してください。"
        );

        focusStocktakingLocationEntry(
          entry.id,
          "quantity"
        );

        return false;
      }

      const quantity =
        Number(quantityText);

      if (
        !Number.isInteger(
          quantity
        ) ||
        quantity < 0
      ) {
        alert(
          `「${item.productName}」の場所別数量は、0以上の整数で入力してください。`
        );

        focusStocktakingLocationEntry(
          entry.id,
          "quantity"
        );

        return false;
      }

      const locationKey =
        normalizeStocktakingText(
          location
        );

      if (
        usedLocations.has(
          locationKey
        )
      ) {
        alert(
          `「${item.productName}」で同じ保管場所が重複しています。\n\n` +
          `重複している保管場所：${location}`
        );

        focusStocktakingLocationEntry(
          entry.id,
          "location"
        );

        return false;
      }

      usedLocations.add(
        locationKey
      );
    }

    refreshStocktakingItemFromLocations(
      item
    );
  }

  return true;
}

function focusStocktakingLocationEntry(
  entryId,
  fieldName
) {
  const selector =
    fieldName === "location"
      ? ".stocktaking-location-name-input"
      : ".stocktaking-actual-input";

  const inputs =
    stocktakingItemsBody.querySelectorAll(
      selector
    );

  for (const input of inputs) {
    if (
      input.dataset.entryId ===
      entryId
    ) {
      input.scrollIntoView({
        behavior: "smooth",
        block: "center"
      });

      input.focus();
      input.select();

      break;
    }
  }
}

function formatStocktakingLocationBreakdown(
  item
) {
  const entries =
    Array.isArray(
      item.locationBreakdown
    )
      ? item.locationBreakdown
      : [];

  return entries
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
}

function createStocktakingLocationEntryId() {
  const randomText =
    Math.random()
      .toString(36)
      .slice(2, 10);

  return (
    `location-${Date.now()}-${randomText}`
  );
}

function updateStocktakingRowAppearance(
  item,
  row,
  differenceCell,
  resultBadge
) {
  row.classList.remove(
    "stocktaking-row-unchecked",
    "stocktaking-row-match",
    "stocktaking-row-shortage",
    "stocktaking-row-surplus"
  );

  resultBadge.classList.remove(
    "stocktaking-badge-unchecked",
    "stocktaking-badge-match",
    "stocktaking-badge-shortage",
    "stocktaking-badge-surplus"
  );

  resultBadge.textContent =
    item.result;

  differenceCell.textContent =
    formatStocktakingDifference(
      item.difference
    );

  if (
    item.result === "差異なし"
  ) {
    row.classList.add(
      "stocktaking-row-match"
    );

    resultBadge.classList.add(
      "stocktaking-badge-match"
    );

    return;
  }

  if (
    item.result === "在庫不足"
  ) {
    row.classList.add(
      "stocktaking-row-shortage"
    );

    resultBadge.classList.add(
      "stocktaking-badge-shortage"
    );

    return;
  }

  if (
    item.result === "在庫過剰"
  ) {
    row.classList.add(
      "stocktaking-row-surplus"
    );

    resultBadge.classList.add(
      "stocktaking-badge-surplus"
    );

    return;
  }

  row.classList.add(
    "stocktaking-row-unchecked"
  );

  resultBadge.classList.add(
    "stocktaking-badge-unchecked"
  );
}

function getStocktakingCounts() {
  const items =
    currentStocktaking
      ? currentStocktaking.items
      : [];

  const checkedItems =
    items.filter(
      function (item) {
        return (
          item.actualStock !== ""
        );
      }
    );

  return {
    target: items.length,
    checked: checkedItems.length,
    unchecked:
      items.length -
      checkedItems.length,
    match:
      checkedItems.filter(
        function (item) {
          return (
            item.result ===
            "差異なし"
          );
        }
      ).length,
    shortage:
      checkedItems.filter(
        function (item) {
          return (
            item.result ===
            "在庫不足"
          );
        }
      ).length,
    surplus:
      checkedItems.filter(
        function (item) {
          return (
            item.result ===
            "在庫過剰"
          );
        }
      ).length
  };
}

function updateStocktakingSummary() {
  const counts =
    getStocktakingCounts();

  stocktakingSummaryTarget.textContent =
    counts.target;

  stocktakingSummaryChecked.textContent =
    counts.checked;

  stocktakingSummaryUnchecked.textContent =
    counts.unchecked;

  stocktakingSummaryMatch.textContent =
    counts.match;

  stocktakingSummaryShortage.textContent =
    counts.shortage;

  stocktakingSummarySurplus.textContent =
    counts.surplus;
}

function filterStocktakingItems() {
  const keyword =
    normalizeStocktakingText(
      stocktakingProductSearchInput.value
    );

  const rows =
    stocktakingItemsBody.querySelectorAll(
      "tr[data-internal-code]"
    );

  let displayedCount = 0;

  rows.forEach(
    function (row) {
      const matches =
        keyword === "" ||
        row.dataset.searchText.includes(
          keyword
        );

      row.hidden = !matches;

      if (matches) {
        displayedCount += 1;
      }
    }
  );

  if (keyword === "") {
    stocktakingSearchMessage.textContent =
      `棚卸対象の商品をすべて表示しています。${displayedCount}件`;

    return;
  }

  stocktakingSearchMessage.textContent =
    `「${stocktakingProductSearchInput.value.trim()}」の検索結果：${displayedCount}件`;
}

function markStocktakingAsUnsaved() {
  stocktakingHasUnsavedChanges =
    true;

  stocktakingSaveMessage.textContent =
    "入力内容が変更されています。保存してください。";

  stocktakingSaveMessage.classList.remove(
    "saved"
  );
}

async function handleStocktakingCardSaveAction(
  item,
  action,
  saveAndScanButton,
  saveAndTopButton
) {
  if (
    !item ||
    item.actualStock === ""
  ) {
    alert(
      "この商品の数量を入力してください。\n\n" +
      "在庫がない場合は0を入力します。"
    );

    if (item) {
      focusStocktakingActualInput(
        item.internalCode
      );
    }

    return;
  }

  saveAndScanButton.disabled =
    true;

  saveAndTopButton.disabled =
    true;

  try {
    const saved =
      await saveCurrentStocktaking(
        false
      );

    if (!saved) {
      return;
    }

    closeStocktakingInputKeyboard();

    if (action === "scan") {
      stocktakingSaveMessage.textContent =
        "保存しました。次の商品を読み取ります。";

      stocktakingSaveMessage.classList.add(
        "saved"
      );

      openStocktakingCameraScanner();
      return;
    }

    stocktakingSaveMessage.textContent =
      "保存しました。棚卸画面の上へ戻りました。";

    stocktakingSaveMessage.classList.add(
      "saved"
    );

    scrollToStocktakingScreenTop();
  } finally {
    saveAndScanButton.disabled =
      false;

    saveAndTopButton.disabled =
      false;
  }
}

function closeStocktakingInputKeyboard() {
  const activeElement =
    document.activeElement;

  if (
    activeElement &&
    typeof activeElement.blur ===
      "function"
  ) {
    activeElement.blur();
  }
}

function scrollToStocktakingScreenTop() {
  if (!stocktakingActiveScreen) {
    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });

    return;
  }

  const screenTop =
    stocktakingActiveScreen
      .getBoundingClientRect()
      .top +
    window.scrollY -
    8;

  window.setTimeout(
    function () {
      window.scrollTo({
        top: Math.max(
          0,
          screenTop
        ),
        behavior: "smooth"
      });
    },
    50
  );
}

async function handleSaveStocktakingItems() {
  await saveCurrentStocktaking(
    true
  );
}

async function saveCurrentStocktaking(
  showCompletionAlert
) {
  if (!currentStocktaking) {
    alert(
      "保存する棚卸が見つかりません。"
    );

    return false;
  }

  const locationEntriesAreValid =
    validateStocktakingLocationEntries();

  if (!locationEntriesAreValid) {
    return false;
  }

  currentStocktaking.updatedAt =
    new Date().toISOString();

  try {
    await updateStocktakingSession(
      currentStocktaking
    );

    stocktakingHasUnsavedChanges =
      false;

    stocktakingSaveMessage.textContent =
      `保存しました：${new Date().toLocaleString("ja-JP")}`;

    stocktakingSaveMessage.classList.add(
      "saved"
    );

    if (showCompletionAlert) {
      alert(
        "棚卸の入力内容を保存しました。"
      );
    }

    return true;
  } catch (error) {
    console.error(error);

    alert(
      "棚卸の入力内容を保存できませんでした。"
    );

    return false;
  }
}

async function handleConfirmStocktaking() {
  const saved =
    await saveCurrentStocktaking(
      false
    );

  if (!saved) {
    return;
  }

  const counts =
    getStocktakingCounts();

  if (counts.unchecked > 0) {
    alert(
      "未確認の商品が残っているため、棚卸を確定できません。\n\n" +
      `未確認商品：${counts.unchecked}件\n\n` +
      "すべての商品に実在庫を入力してください。"
    );

    focusFirstUncheckedItem();
    return;
  }

  const selectedReflectInput =
    document.querySelector(
      'input[name="stocktaking-reflect"]:checked'
    );

  const reflectToInventory =
    selectedReflectInput.value ===
    "yes";

  const reflectText =
    reflectToInventory
      ? "実在庫を現在庫へ反映する"
      : "現在庫は変更しない";

  const confirmationMessage =
    "次の内容で棚卸を確定しますか？\n\n" +
    `対象商品：${counts.target}件\n` +
    `確認済み：${counts.checked}件\n` +
    `差異なし：${counts.match}件\n` +
    `在庫不足：${counts.shortage}件\n` +
    `在庫過剰：${counts.surplus}件\n\n` +
    `在庫処理：${reflectText}\n\n` +
    "確定後は、この棚卸を編集できません。";

  const isConfirmed =
    window.confirm(
      confirmationMessage
    );

  if (!isConfirmed) {
    return;
  }

  confirmStocktakingButton.disabled =
    true;

  try {
    const confirmedAt =
      new Date().toISOString();

    const updatedProducts = [];
    const movements = [];

    if (reflectToInventory) {
      const allProducts =
        await getAllProducts();

      const productMap =
        new Map();

      allProducts.forEach(
        function (product) {
          productMap.set(
            product.internalCode,
            product
          );
        }
      );

      const missingItems = [];
      const changedItems = [];

      currentStocktaking.items.forEach(
        function (item) {
          const product =
            productMap.get(
              item.internalCode
            );

          if (!product) {
            missingItems.push(
              item.productName
            );

            return;
          }

          const currentStock =
            getValidStocktakingNumber(
              product.stock
            );

          if (
            currentStock !==
            item.registeredStock
          ) {
            changedItems.push({
              productName:
                item.productName,
              registeredStock:
                item.registeredStock,
              currentStock:
                currentStock
            });
          }
        }
      );

      if (missingItems.length > 0) {
        alert(
          "棚卸開始後に削除された商品があります。\n\n" +
          missingItems.join("\n") +
          "\n\n棚卸を確定できません。"
        );

        return;
      }

      if (changedItems.length > 0) {
        const changedText =
          changedItems
            .slice(0, 5)
            .map(
              function (item) {
                return (
                  `${item.productName}\n` +
                  `棚卸開始時：${item.registeredStock}個\n` +
                  `現在：${item.currentStock}個`
                );
              }
            )
            .join("\n\n");

        alert(
          "棚卸開始後に在庫数が変更された商品があります。\n\n" +
          changedText +
          "\n\n入庫・出庫の内容を確認し、棚卸をやり直してください。"
        );

        return;
      }

      currentStocktaking.items.forEach(
        function (item, index) {
          const product =
            productMap.get(
              item.internalCode
            );

          const beforeStock =
            getValidStocktakingNumber(
              product.stock
            );

          const afterStock =
            getValidStocktakingNumber(
              item.actualStock
            );

          if (
            beforeStock ===
            afterStock
          ) {
            return;
          }

          const updatedProduct = {
            ...product,
            stock: afterStock,
            updatedAt: confirmedAt
          };

          updatedProducts.push(
            updatedProduct
          );

          const locationBreakdownText =
            formatStocktakingLocationBreakdown(
              item
            );

          const memoParts = [
            `棚卸日：${currentStocktaking.stocktakingDate}`
          ];

          if (
            locationBreakdownText !== ""
          ) {
            memoParts.push(
              `場所別：${locationBreakdownText}`
            );
          }

          if (item.memo !== "") {
            memoParts.push(
              item.memo
            );
          }

          const memoText =
            memoParts.join(" / ");

          movements.push({
            id:
              createStocktakingMovementId(
                index
              ),
            dateTime: confirmedAt,
            internalCode:
              product.internalCode,
            productCode:
              product.productCode,
            productName:
              product.productName,
            type: "棚卸調整",
            quantity:
              afterStock -
              beforeStock,
            beforeStock:
              beforeStock,
            afterStock:
              afterStock,
            person:
              currentStocktaking.person,
            reason: "棚卸調整",
            memo: memoText
          });
        }
      );
    }

    const completedStocktaking = {
      ...currentStocktaking,
      status: "確定済み",
      confirmedAt: confirmedAt,
      updatedAt: confirmedAt,
      reflectedToInventory:
        reflectToInventory
    };

    await completeStocktakingSession(
      completedStocktaking,
      updatedProducts,
      movements
    );

    const completionMessage =
      reflectToInventory
        ? "棚卸を確定しました。\n\n実在庫を現在庫へ反映しました。"
        : "棚卸を確定しました。\n\n現在庫は変更していません。";

    alert(completionMessage);

    window.location.reload();
  } catch (error) {
    console.error(error);

    alert(
      "棚卸を確定できませんでした。\n\n" +
      "入力内容と商品データを確認してください。"
    );
  } finally {
    confirmStocktakingButton.disabled =
      false;
  }
}

function focusFirstUncheckedItem() {
  const uncheckedItem =
    currentStocktaking.items.find(
      function (item) {
        return (
          item.actualStock === ""
        );
      }
    );

  if (!uncheckedItem) {
    return;
  }

  stocktakingProductSearchInput.value =
    "";

  filterStocktakingItems();

  const inputs =
    stocktakingItemsBody.querySelectorAll(
      ".stocktaking-actual-input"
    );

  for (const input of inputs) {
    if (
      input.dataset.internalCode ===
      uncheckedItem.internalCode
    ) {
      input.scrollIntoView({
        behavior: "smooth",
        block: "center"
      });

      input.focus();
      break;
    }
  }
}

async function handleSaveAndReturnHome() {
  const saved =
    await saveCurrentStocktaking(
      false
    );

  if (!saved) {
    return;
  }

  returnHomeFromStocktakingActive();
}

function returnHomeFromStocktakingSetup() {
  stocktakingSetupScreen.hidden =
    true;

  stocktakingActiveScreen.hidden =
    true;

  window.inventoryApp.showScreen(
    "home"
  );
}

function returnHomeFromStocktakingActive() {
  stocktakingSetupScreen.hidden =
    true;

  stocktakingActiveScreen.hidden =
    true;

  currentStocktaking = null;

  window.inventoryApp.showScreen(
    "home"
  );
}

async function handleDeleteStocktaking() {
  if (
    !currentStocktaking ||
    !currentStocktaking.id
  ) {
    alert(
      "取り消す棚卸が見つかりません。"
    );

    return;
  }

  const isConfirmed =
    window.confirm(
      "この棚卸を取り消しますか？\n\n" +
      "入力した実在庫も削除されます。\n" +
      "この操作は元に戻せません。"
    );

  if (!isConfirmed) {
    return;
  }

  try {
    await deleteStocktakingSession(
      currentStocktaking.id
    );

    currentStocktaking = null;
    stocktakingHasUnsavedChanges =
      false;

    alert(
      "棚卸を取り消しました。"
    );

    returnHomeFromStocktakingActive();
  } catch (error) {
    console.error(error);

    alert(
      "棚卸を取り消せませんでした。"
    );
  }
}

function getStocktakingResult(
  difference
) {
  if (difference === null) {
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

function formatStocktakingDifference(
  difference
) {
  if (difference === null) {
    return "未確認";
  }

  if (difference > 0) {
    return `＋${difference}`;
  }

  return String(difference);
}

function normalizeActualStockValue(
  value
) {
  if (
    value === "" ||
    value === null ||
    value === undefined
  ) {
    return "";
  }

  const numberValue =
    Number(value);

  if (
    !Number.isInteger(
      numberValue
    ) ||
    numberValue < 0
  ) {
    return "";
  }

  return numberValue;
}

function getValidStocktakingNumber(
  value
) {
  const numberValue =
    Number(value);

  if (
    !Number.isInteger(
      numberValue
    ) ||
    numberValue < 0
  ) {
    return 0;
  }

  return numberValue;
}

function hideAllMainScreensForStocktaking() {
  const allScreens =
    document.querySelectorAll(
      "main > section"
    );

  allScreens.forEach(
    function (screen) {
      screen.hidden = true;
    }
  );
}

function openStocktakingCameraScanner() {
  if (!currentStocktaking) {
    alert(
      "進行中の棚卸が見つかりません。"
    );

    return;
  }

  if (
    !window.barcodeScanner ||
    typeof window.barcodeScanner.openForStocktaking !==
      "function"
  ) {
    alert(
      "バーコード読取機能を開けませんでした。\n\n" +
      "画面を更新して、もう一度棚卸を開いてください。"
    );

    return;
  }

  window.barcodeScanner.openForStocktaking();
}

function handleStocktakingScannedBarcode(
  barcodeValue
) {
  if (
    !currentStocktaking ||
    !Array.isArray(
      currentStocktaking.items
    )
  ) {
    return {
      success: false,
      message:
        "進行中の棚卸が見つかりません。"
    };
  }

  const normalizedBarcode =
    normalizeStocktakingBarcode(
      barcodeValue
    );

  if (normalizedBarcode === "") {
    return {
      success: false,
      message:
        "バーコード番号を確認できませんでした。"
    };
  }

  const internalCodeMatches =
    currentStocktaking.items.filter(
      function (item) {
        return (
          normalizeStocktakingBarcode(
            item.internalCode
          ) === normalizedBarcode
        );
      }
    );

  let matchingItems = [];
  let matchedCodeType = "";

  if (internalCodeMatches.length > 0) {
    matchingItems =
      internalCodeMatches;

    matchedCodeType =
      "社内コード";
  } else {
    matchingItems =
      currentStocktaking.items.filter(
        function (item) {
          const normalizedJanCode =
            normalizeStocktakingBarcode(
              item.janCode
            );

          return (
            normalizedJanCode !== "" &&
            normalizedJanCode ===
              normalizedBarcode
          );
        }
      );

    matchedCodeType =
      "JANコード";
  }

  if (matchingItems.length === 0) {
    return {
      success: false,
      message:
        "このバーコードの商品は、今回の棚卸対象にありません。\n\n" +
        "JANコード・社内コード・保管場所を確認してください。"
    };
  }

  if (matchingItems.length > 1) {
    return {
      success: false,
      message:
        `同じ${matchedCodeType}の商品が棚卸対象に複数あります。\n\n` +
        "商品名または社内コードで検索してください。"
    };
  }

  const selectedItem =
    matchingItems[0];

  returnFromStocktakingScanner(
    false
  );

  stocktakingProductSearchInput.value =
    selectedItem.internalCode;

  filterStocktakingItems();

  stocktakingSearchMessage.textContent =
    `読み取り成功：${selectedItem.productName}（${matchedCodeType}：${normalizedBarcode}）`;

  stocktakingSaveMessage.textContent =
    "読み取った商品の保管場所と数量を入力してください。";

  stocktakingSaveMessage.classList.remove(
    "saved"
  );

  window.setTimeout(
    function () {
      focusStocktakingActualInput(
        selectedItem.internalCode
      );
    },
    100
  );

  return {
    success: true,
    item: selectedItem,
    matchedCodeType:
      matchedCodeType
  };
}

function returnFromStocktakingScanner(
  focusSearch
) {
  if (!currentStocktaking) {
    window.inventoryApp.showScreen(
      "home"
    );

    return;
  }

  hideAllMainScreensForStocktaking();

  stocktakingActiveScreen.hidden = false;

  if (focusSearch) {
    stocktakingProductSearchInput.value =
      "";

    filterStocktakingItems();

    stocktakingSearchMessage.textContent =
      "JANコード・商品名・社内コード・商品コードを入力してください。";

    window.setTimeout(
      function () {
        stocktakingProductSearchInput.focus();
      },
      100
    );
  }

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

function focusStocktakingActualInput(
  internalCode
) {
  const inputs =
    stocktakingItemsBody.querySelectorAll(
      ".stocktaking-actual-input"
    );

  for (const input of inputs) {
    if (
      input.dataset.internalCode ===
      internalCode
    ) {
      input.scrollIntoView({
        behavior: "smooth",
        block: "center"
      });

      input.focus();
      input.select();

      break;
    }
  }
}

function normalizeStocktakingBarcode(
  value
) {
  return String(value || "")
    .normalize("NFKC")
    .replace(/\s+/g, "")
    .trim();
}

function normalizeStocktakingText(
  value
) {
  return String(value || "")
    .normalize("NFKC")
    .toLowerCase()
    .trim();
}

function getTodayDateText() {
  const today = new Date();

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

function formatStocktakingDateTime(
  dateTimeText
) {
  const date =
    new Date(dateTimeText);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "記録なし";
  }

  return date.toLocaleString(
    "ja-JP"
  );
}

function createStocktakingId() {
  const randomText =
    Math.random()
      .toString(36)
      .slice(2, 10);

  return (
    `stocktaking-${Date.now()}-${randomText}`
  );
}

function createStocktakingMovementId(
  index
) {
  const randomText =
    Math.random()
      .toString(36)
      .slice(2, 10);

  return (
    `stocktaking-movement-${Date.now()}-${index}-${randomText}`
  );
}