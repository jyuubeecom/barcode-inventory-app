"use strict";

let stocktakingStartButton = null;

let stocktakingSetupScreen = null;
let stocktakingActiveScreen = null;
let stocktakingCompleteScreen = null;
let lastCompletedStocktaking = null;

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
let stocktakingSummaryBulkZero = null;

let stocktakingProductSearchInput = null;
let stocktakingDisplayFilter = null;
let stocktakingSearchMessage = null;
let stocktakingCameraScanButton = null;
let stocktakingItemsBody = null;
let stocktakingSaveMessage = null;

let saveStocktakingItemsButton = null;
let confirmStocktakingButton = null;
let cancelStocktakingSetupButton = null;
let backHomeFromStocktakingButton = null;
let deleteStocktakingButton = null;
let applyBulkZeroButton = null;
let undoBulkZeroButton = null;
let bulkZeroLocationSelect = null;

let currentStocktaking = null;
let stocktakingHasUnsavedChanges = false;

const STOCKTAKING_LOCATION_OPTIONS =
  Object.freeze([
    "本社1階 A区",
    "本社1階 B区",
    "本社1階 C区",
    "本社1階 D区",
    "本社1階 E区",
    "本社1階 F区",
    "本社2階 A区",
    "本社2階 B区",
    "本社2階 C区",
    "本社2階 D区",
    "本社2階 E区",
    "本社2階 F区",
    "酒本倉庫1階",
    "酒本倉庫2階"
  ]);

const STOCKTAKING_BULK_ZERO_UNCONFIRMED_LOCATION =
  "未確認";

const STOCKTAKING_BULK_ZERO_REGISTERED_LOCATION =
  "__registered_location__";

function createStocktakingLocationOptionsHtml(
  includeAllLocations,
  includeBulkZeroUnconfirmed
) {
  const optionTexts = [];

  if (includeAllLocations) {
    optionTexts.push(
      '<option value="すべての保管場所">すべての保管場所</option>'
    );
  } else {
    optionTexts.push(
      '<option value="">保管場所を選択</option>'
    );
  }

  STOCKTAKING_LOCATION_OPTIONS.forEach(
    function (location) {
      optionTexts.push(
        `<option value="${location}">${location}</option>`
      );
    }
  );

  if (includeBulkZeroUnconfirmed) {
    optionTexts.push(
      '<option value="未確認">未確認（現物の場所は未確認）</option>'
    );
  }

  return optionTexts.join("");
}

function createBulkZeroLocationOptionsHtml() {
  const optionTexts = [
    '<option value="未確認">未確認（現物の場所は未確認）</option>',
    '<option value="__registered_location__">商品ごとの登録保管場所を使う</option>'
  ];

  STOCKTAKING_LOCATION_OPTIONS.forEach(
    function (location) {
      optionTexts.push(
        `<option value="${location}">${location}</option>`
      );
    }
  );

  return optionTexts.join("");
}

function isBulkZeroUnconfirmedLocation(
  location
) {
  return (
    String(location || "").trim() ===
    STOCKTAKING_BULK_ZERO_UNCONFIRMED_LOCATION
  );
}

function isAllowedStocktakingItemLocation(
  item,
  location
) {
  if (
    isStocktakingLocationOption(
      location
    )
  ) {
    return true;
  }

  return (
    item &&
    item.bulkZeroApplied === true &&
    isBulkZeroUnconfirmedLocation(
      location
    )
  );
}

function isStocktakingLocationOption(
  location
) {
  const normalizedLocation =
    normalizeStocktakingText(
      location
    );

  return STOCKTAKING_LOCATION_OPTIONS.some(
    function (option) {
      return (
        normalizeStocktakingText(
          option
        ) === normalizedLocation
      );
    }
  );
}

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
  createStocktakingMobileFocusStyle();

  window.addEventListener(
    "inventory-display-mode-change",
    function () {
      updateStocktakingMobileFocusMode();
      filterStocktakingItems();
    }
  );
}

function createStocktakingStartButton() {
  const existingButton =
    document.querySelector(
      "#show-stocktaking-button"
    );

  if (existingButton) {
    stocktakingStartButton =
      existingButton;

    stocktakingStartButton.removeEventListener(
      "click",
      openStocktakingStart
    );

    stocktakingStartButton.addEventListener(
      "click",
      openStocktakingStart
    );

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

  const existingCompleteScreen =
    document.querySelector(
      "#stocktaking-complete"
    );

  if (existingSetupScreen) {
    existingSetupScreen.remove();
  }

  if (existingActiveScreen) {
    existingActiveScreen.remove();
  }

  if (existingCompleteScreen) {
    existingCompleteScreen.remove();
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
      棚卸日と担当者を入力し、保管場所をリストから選んでください。
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
          placeholder="例：担当者"
          required
        >
      </div>

      <div>
        <label for="stocktaking-location">
          棚卸対象の保管場所
        </label>

        <select id="stocktaking-location">
          ${createStocktakingLocationOptionsHtml(true)}
        </select>

        <small>
          全商品を対象にする場合は「すべての保管場所」を選びます。
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

      <p class="stocktaking-summary-bulk-zero">
        一括0入力：
        <strong id="stocktaking-summary-bulk-zero">0</strong>件
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

      <label for="stocktaking-display-filter">
        表示を絞り込む
      </label>

      <select id="stocktaking-display-filter">
        <option value="all">すべての商品</option>
        <option value="unchecked">未確認の商品だけ</option>
        <option value="bulk-zero">一括0入力の商品だけ</option>
      </select>

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

    <div class="stocktaking-bulk-zero-area">
      <h3>登録在庫0の商品をまとめて入力</h3>

      <p>
        登録在庫が0個で、まだ未確認の商品だけを実在庫0個にします。
        手入力済みの商品は変更しません。
      </p>

      <label for="stocktaking-bulk-zero-location">
        一括0入力時の保管場所
      </label>

      <select id="stocktaking-bulk-zero-location">
        ${createBulkZeroLocationOptionsHtml()}
      </select>

      <small>
        「未確認」は、一括0入力した商品の現物保管場所をまだ確認していないことを表します。
      </small>

      <div class="stocktaking-bulk-zero-buttons">
        <button
          id="apply-stocktaking-bulk-zero-button"
          type="button"
        >
          登録在庫0・未確認の商品を一括で0入力
        </button>

        <button
          id="undo-stocktaking-bulk-zero-button"
          type="button"
        >
          一括0入力を取り消す
        </button>
      </div>
    </div>

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

  stocktakingCompleteScreen =
    document.createElement("section");

  stocktakingCompleteScreen.id =
    "stocktaking-complete";

  stocktakingCompleteScreen.hidden =
    true;

  stocktakingCompleteScreen.innerHTML = `
    <h2>棚卸完了</h2>

    <div class="stocktaking-complete-success">
      <strong>棚卸を確定しました</strong>
      <p>
        棚卸結果をCSVで送信または保存できます。
      </p>
    </div>

    <div class="stocktaking-complete-summary">
      <div>
        <span>棚卸日</span>
        <strong id="stocktaking-complete-date">-</strong>
      </div>

      <div>
        <span>担当者</span>
        <strong id="stocktaking-complete-person">-</strong>
      </div>

      <div>
        <span>棚卸場所</span>
        <strong id="stocktaking-complete-location">-</strong>
      </div>

      <div>
        <span>対象商品</span>
        <strong id="stocktaking-complete-target">0件</strong>
      </div>

      <div>
        <span>差異なし</span>
        <strong id="stocktaking-complete-match">0件</strong>
      </div>

      <div>
        <span>在庫不足</span>
        <strong id="stocktaking-complete-shortage">0件</strong>
      </div>

      <div>
        <span>在庫過剰</span>
        <strong id="stocktaking-complete-surplus">0件</strong>
      </div>
    </div>

    <div class="stocktaking-send-area">
      <h3>棚卸結果を管理者へ送る</h3>

      <p>
        iPhone・Androidともに、管理者への送信方法をメールに統一します。
      </p>

      <label
        for="stocktaking-manager-email"
        class="stocktaking-manager-email-label"
      >
        管理者メールアドレス
      </label>

      <input
        id="stocktaking-manager-email"
        type="email"
        inputmode="email"
        autocomplete="email"
        placeholder="例：zaiko@example.co.jp"
      >

      <p class="stocktaking-manager-email-help">
        一度入力したメールアドレスは、この端末に保存します。
      </p>

      <button
        id="stocktaking-email-result-button"
        type="button"
      >
        管理者へメールで送る
      </button>

      <button
        id="stocktaking-download-result-button"
        type="button"
      >
        棚卸結果CSVを保存する
      </button>

      <p
        id="stocktaking-share-message"
        class="stocktaking-share-message"
      ></p>
    </div>

    <button
      id="stocktaking-complete-home-button"
      type="button"
      class="stocktaking-complete-home-button"
    >
      ホームへ戻る
    </button>
  `;

  mainElement.appendChild(
    stocktakingCompleteScreen
  );

  getStocktakingElements();
  addStocktakingEventListeners();

  document
    .querySelector(
      "#stocktaking-email-result-button"
    )
    ?.addEventListener(
      "click",
      handleEmailCompletedStocktaking
    );

  document
    .querySelector(
      "#stocktaking-manager-email"
    )
    ?.addEventListener(
      "change",
      function (event) {
        saveStocktakingManagerEmail(
          event.target.value
        );
      }
    );

  document
    .querySelector(
      "#stocktaking-download-result-button"
    )
    ?.addEventListener(
      "click",
      function () {
        if (
          !lastCompletedStocktaking
        ) {
          return;
        }

        downloadCompletedStocktakingCsv(
          lastCompletedStocktaking
        );
      }
    );

  document
    .querySelector(
      "#stocktaking-complete-home-button"
    )
    ?.addEventListener(
      "click",
      function () {
        window.location.reload();
      }
    );
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

  stocktakingSummaryBulkZero =
    document.querySelector(
      "#stocktaking-summary-bulk-zero"
    );

  stocktakingProductSearchInput =
    document.querySelector(
      "#stocktaking-product-search"
    );

  stocktakingDisplayFilter =
    document.querySelector(
      "#stocktaking-display-filter"
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

  applyBulkZeroButton =
    document.querySelector(
      "#apply-stocktaking-bulk-zero-button"
    );

  undoBulkZeroButton =
    document.querySelector(
      "#undo-stocktaking-bulk-zero-button"
    );

  bulkZeroLocationSelect =
    document.querySelector(
      "#stocktaking-bulk-zero-location"
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

  stocktakingDisplayFilter.addEventListener(
    "change",
    filterStocktakingItems
  );

  applyBulkZeroButton.addEventListener(
    "click",
    handleApplyBulkZero
  );

  undoBulkZeroButton.addEventListener(
    "click",
    handleUndoBulkZero
  );

  stocktakingCameraScanButton.addEventListener(
    "click",
    openStocktakingCameraScanner
  );
}


function showStocktakingInventoryChangedWarning(
  changedItems,
  locationStockAware
) {
  const existingModal =
    document.querySelector(
      "#stocktaking-inventory-changed-modal"
    );

  if (existingModal) {
    existingModal.remove();
  }

  const overlay =
    document.createElement("div");

  overlay.id =
    "stocktaking-inventory-changed-modal";
  overlay.className =
    "stocktaking-warning-overlay";
  overlay.setAttribute(
    "role",
    "alertdialog"
  );
  overlay.setAttribute(
    "aria-modal",
    "true"
  );
  overlay.setAttribute(
    "aria-labelledby",
    "stocktaking-warning-title"
  );

  const modal =
    document.createElement("div");
  modal.className =
    "stocktaking-warning-modal";

  const header =
    document.createElement("div");
  header.className =
    "stocktaking-warning-header";

  const icon =
    document.createElement("div");
  icon.className =
    "stocktaking-warning-icon";
  icon.textContent = "⚠️";
  icon.setAttribute(
    "aria-hidden",
    "true"
  );

  const title =
    document.createElement("h2");
  title.id =
    "stocktaking-warning-title";
  title.textContent =
    "棚卸開始後に在庫が変更されています";

  header.appendChild(icon);
  header.appendChild(title);

  const summary =
    document.createElement("p");
  summary.className =
    "stocktaking-warning-summary";
  summary.textContent =
    "棚卸開始後に入庫・出庫・商品移動などで在庫が変わったため、この棚卸は確定できません。";

  const itemList =
    document.createElement("div");
  itemList.className =
    "stocktaking-warning-items";

  changedItems
    .slice(0, 5)
    .forEach(
      function (item) {
        const itemCard =
          document.createElement("div");
        itemCard.className =
          "stocktaking-warning-item";

        const productName =
          document.createElement("div");
        productName.className =
          "stocktaking-warning-product";
        productName.textContent =
          item.productName ||
          "商品名未登録";

        const registered =
          document.createElement("div");
        registered.className =
          "stocktaking-warning-stock-line";

        const registeredLabel =
          document.createElement("strong");
        registeredLabel.textContent =
          "棚卸開始時：";

        const registeredValue =
          document.createElement("span");
        registeredValue.textContent =
          locationStockAware
            ? item.registeredText
            : `${item.registeredStock}個`;

        registered.appendChild(
          registeredLabel
        );
        registered.appendChild(
          registeredValue
        );

        const current =
          document.createElement("div");
        current.className =
          "stocktaking-warning-stock-line stocktaking-warning-current";

        const currentLabel =
          document.createElement("strong");
        currentLabel.textContent =
          "現在：";

        const currentValue =
          document.createElement("span");
        currentValue.textContent =
          locationStockAware
            ? item.currentText
            : `${item.currentStock}個`;

        current.appendChild(
          currentLabel
        );
        current.appendChild(
          currentValue
        );

        itemCard.appendChild(
          productName
        );
        itemCard.appendChild(
          registered
        );
        itemCard.appendChild(
          current
        );
        itemList.appendChild(
          itemCard
        );
      }
    );

  if (changedItems.length > 5) {
    const moreText =
      document.createElement("p");
    moreText.className =
      "stocktaking-warning-more";
    moreText.textContent =
      `ほか ${changedItems.length - 5} 商品でも在庫が変更されています。`;
    itemList.appendChild(moreText);
  }

  const instruction =
    document.createElement("div");
  instruction.className =
    "stocktaking-warning-instruction";
  instruction.textContent =
    "入庫・出庫・商品移動の内容を確認して、棚卸をやり直してください。";

  const closeButton =
    document.createElement("button");
  closeButton.type = "button";
  closeButton.className =
    "stocktaking-warning-close";
  closeButton.textContent =
    "確認して閉じる";

  function closeWarning() {
    overlay.remove();
    document.body.classList.remove(
      "stocktaking-warning-open"
    );
  }

  closeButton.addEventListener(
    "click",
    closeWarning
  );

  overlay.addEventListener(
    "keydown",
    function (event) {
      if (event.key === "Escape") {
        closeWarning();
      }
    }
  );

  modal.appendChild(header);
  modal.appendChild(summary);
  modal.appendChild(itemList);
  modal.appendChild(instruction);
  modal.appendChild(closeButton);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  document.body.classList.add(
    "stocktaking-warning-open"
  );

  window.setTimeout(
    function () {
      closeButton.focus();
    },
    0
  );
}


let stocktakingDialogQueue = Promise.resolve();

function getStocktakingDialogPreset(message) {
  const text = String(message || "");

  if (/開始しました|保存しました|完了しました|取り消しました|更新しました/.test(text)) {
    return {
      type: "success",
      title: "完了しました",
      icon: "✅"
    };
  }

  if (/できません|失敗|エラー|削除された|変更された|不足/.test(text)) {
    return {
      type: "danger",
      title: "確認が必要です",
      icon: "⚠️"
    };
  }

  if (/ありません|未確認|確認してください|選択してください/.test(text)) {
    return {
      type: "warning",
      title: "確認してください",
      icon: "⚠️"
    };
  }

  return {
    type: "info",
    title: "お知らせ",
    icon: "ℹ️"
  };
}

function enqueueStocktakingDialog(options) {
  const dialogOptions = options || {};
  const nextDialog = stocktakingDialogQueue.then(
    function () {
      return new Promise(
        function (resolve) {
          const existing = document.querySelector(
            "#stocktaking-common-dialog"
          );

          if (existing) {
            existing.remove();
          }

          const preset = getStocktakingDialogPreset(
            dialogOptions.message
          );
          const type = dialogOptions.type || preset.type;
          const title = dialogOptions.title || preset.title;
          const iconText = dialogOptions.icon || preset.icon;
          const isConfirm = dialogOptions.isConfirm === true;

          const overlay = document.createElement("div");
          overlay.id = "stocktaking-common-dialog";
          overlay.className = "stocktaking-warning-overlay";
          overlay.setAttribute(
            "role",
            isConfirm ? "dialog" : "alertdialog"
          );
          overlay.setAttribute("aria-modal", "true");

          const modal = document.createElement("div");
          modal.className =
            "stocktaking-common-modal stocktaking-common-" + type;

          const header = document.createElement("div");
          header.className = "stocktaking-common-header";

          const icon = document.createElement("div");
          icon.className = "stocktaking-common-icon";
          icon.textContent = iconText;
          icon.setAttribute("aria-hidden", "true");

          const heading = document.createElement("h2");
          heading.className = "stocktaking-common-title";
          heading.textContent = title;

          header.appendChild(icon);
          header.appendChild(heading);

          const message = document.createElement("div");
          message.className = "stocktaking-common-message";
          message.textContent = String(
            dialogOptions.message || ""
          );

          const buttonArea = document.createElement("div");
          buttonArea.className = "stocktaking-common-actions";

          const confirmButton = document.createElement("button");
          confirmButton.type = "button";
          confirmButton.className =
            "stocktaking-common-button stocktaking-common-confirm";
          confirmButton.textContent =
            dialogOptions.confirmText ||
            (isConfirm ? "確認する" : "閉じる");

          let cancelButton = null;

          if (isConfirm) {
            cancelButton = document.createElement("button");
            cancelButton.type = "button";
            cancelButton.className =
              "stocktaking-common-button stocktaking-common-cancel";
            cancelButton.textContent =
              dialogOptions.cancelText || "キャンセル";
            buttonArea.appendChild(cancelButton);
          }

          buttonArea.appendChild(confirmButton);
          modal.appendChild(header);
          modal.appendChild(message);
          modal.appendChild(buttonArea);
          overlay.appendChild(modal);
          document.body.appendChild(overlay);
          document.body.classList.add("stocktaking-warning-open");

          let finished = false;

          function finish(result) {
            if (finished) {
              return;
            }

            finished = true;
            overlay.remove();
            document.body.classList.remove(
              "stocktaking-warning-open"
            );
            resolve(result);
          }

          confirmButton.addEventListener(
            "click",
            function () {
              finish(true);
            }
          );

          if (cancelButton) {
            cancelButton.addEventListener(
              "click",
              function () {
                finish(false);
              }
            );
          }

          overlay.addEventListener(
            "keydown",
            function (event) {
              if (event.key === "Escape") {
                finish(isConfirm ? false : true);
              }
            }
          );

          window.setTimeout(
            function () {
              confirmButton.focus();
            },
            0
          );
        }
      );
    }
  );

  stocktakingDialogQueue = nextDialog.catch(
    function () {
      return false;
    }
  );

  return nextDialog;
}

function showStocktakingNotice(message, options) {
  return enqueueStocktakingDialog(
    Object.assign(
      {
        message: message,
        isConfirm: false
      },
      options || {}
    )
  );
}

function showStocktakingConfirm(message, options) {
  return enqueueStocktakingDialog(
    Object.assign(
      {
        message: message,
        isConfirm: true
      },
      options || {}
    )
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

    .stocktaking-bulk-zero-area {
      margin: 18px 0;
      padding: 16px;
      border: 2px solid #ef6c00;
      border-radius: 12px;
      background-color: #fff8e1;
    }

    .stocktaking-bulk-zero-area h3 {
      margin: 0 0 8px;
      color: #e65100;
      font-size: 20px;
    }

    .stocktaking-bulk-zero-area p {
      margin: 0 0 12px;
      line-height: 1.6;
    }

    .stocktaking-bulk-zero-area label {
      display: block;
      margin: 12px 0 6px;
      font-weight: bold;
    }

    #stocktaking-bulk-zero-location {
      width: 100%;
      max-width: 520px;
      min-height: 48px;
      margin: 0 0 6px;
      padding: 8px;
      font-size: 17px;
    }

    .stocktaking-bulk-zero-area small {
      display: block;
      margin-bottom: 12px;
      color: #6d4c41;
      line-height: 1.5;
    }

    .stocktaking-bulk-zero-buttons {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
    }

    #apply-stocktaking-bulk-zero-button {
      margin: 0;
      background-color: #ef6c00;
    }

    #undo-stocktaking-bulk-zero-button {
      margin: 0;
      background-color: #546e7a;
    }

    .stocktaking-summary-bulk-zero {
      background-color: #fff3e0 !important;
      color: #e65100;
    }

    #stocktaking-display-filter {
      width: 100%;
      max-width: 440px;
      min-height: 48px;
      margin: 8px 0 4px;
      padding: 8px;
      font-size: 17px;
    }

    .stocktaking-row-bulk-zero {
      outline: 3px solid #7e57c2;
      outline-offset: -3px;
    }

    .stocktaking-badge-bulk-zero {
      background-color: #d1c4e9;
      color: #4527a0;
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

    .stocktaking-items-table input[type="text"],
    .stocktaking-items-table select {
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

    .stocktaking-location-entry input,
    .stocktaking-location-entry select {
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


    body.stocktaking-warning-open {
      overflow: hidden;
    }

    .stocktaking-warning-overlay {
      position: fixed;
      inset: 0;
      z-index: 2147483647;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      box-sizing: border-box;
      background-color: rgba(0, 0, 0, 0.76);
    }

    .stocktaking-warning-modal {
      width: min(760px, 100%);
      max-height: calc(100vh - 48px);
      overflow-y: auto;
      padding: 0 24px 24px;
      box-sizing: border-box;
      border: 5px solid #c62828;
      border-radius: 18px;
      background-color: #ffffff;
      box-shadow: 0 18px 60px rgba(0, 0, 0, 0.45);
    }

    .stocktaking-warning-header {
      display: flex;
      align-items: center;
      gap: 14px;
      margin: 0 -24px 20px;
      padding: 20px 24px;
      border-radius: 12px 12px 0 0;
      background-color: #ffebee;
      color: #b71c1c;
    }

    .stocktaking-warning-icon {
      flex: 0 0 auto;
      font-size: 46px;
      line-height: 1;
    }

    .stocktaking-warning-header h2 {
      margin: 0;
      color: #b71c1c;
      font-size: 28px;
      line-height: 1.35;
    }

    .stocktaking-warning-summary {
      margin: 0 0 18px;
      color: #263238;
      font-size: 19px;
      font-weight: bold;
      line-height: 1.7;
    }

    .stocktaking-warning-items {
      display: grid;
      gap: 12px;
      margin-bottom: 18px;
    }

    .stocktaking-warning-item {
      padding: 16px;
      border: 2px solid #ef9a9a;
      border-radius: 12px;
      background-color: #fff8f8;
    }

    .stocktaking-warning-product {
      margin-bottom: 10px;
      color: #212121;
      font-size: 21px;
      font-weight: bold;
      line-height: 1.45;
    }

    .stocktaking-warning-stock-line {
      margin-top: 6px;
      font-size: 18px;
      line-height: 1.55;
    }

    .stocktaking-warning-current {
      color: #c62828;
      font-size: 20px;
    }

    .stocktaking-warning-more {
      margin: 0;
      padding: 12px;
      border-radius: 10px;
      background-color: #f5f5f5;
      font-size: 17px;
      font-weight: bold;
    }

    .stocktaking-warning-instruction {
      margin: 18px 0;
      padding: 16px 18px;
      border-left: 7px solid #ef6c00;
      border-radius: 10px;
      background-color: #fff3e0;
      color: #bf360c;
      font-size: 19px;
      font-weight: bold;
      line-height: 1.65;
    }

    .stocktaking-warning-close {
      width: 100%;
      min-height: 64px;
      margin: 0;
      border: 0;
      border-radius: 12px;
      background-color: #c62828;
      color: #ffffff;
      font-size: 21px;
      font-weight: bold;
      cursor: pointer;
    }

    .stocktaking-warning-close:hover,
    .stocktaking-warning-close:focus-visible {
      background-color: #b71c1c;
      outline: 4px solid #ffcc80;
      outline-offset: 2px;
    }

    .stocktaking-common-modal {
      width: min(760px, 100%);
      max-height: calc(100vh - 48px);
      overflow-y: auto;
      box-sizing: border-box;
      border: 5px solid #1565c0;
      border-radius: 18px;
      background-color: #ffffff;
      box-shadow: 0 18px 60px rgba(0, 0, 0, 0.45);
    }

    .stocktaking-common-header {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 20px 24px;
      background-color: #e3f2fd;
      color: #0d47a1;
    }

    .stocktaking-common-icon {
      flex: 0 0 auto;
      font-size: 44px;
      line-height: 1;
    }

    .stocktaking-common-title {
      margin: 0;
      color: inherit;
      font-size: 28px;
      line-height: 1.35;
    }

    .stocktaking-common-message {
      padding: 24px;
      color: #263238;
      font-size: 19px;
      font-weight: 600;
      line-height: 1.75;
      white-space: pre-line;
      overflow-wrap: anywhere;
    }

    .stocktaking-common-actions {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
      padding: 0 24px 24px;
    }

    .stocktaking-common-actions .stocktaking-common-button:only-child {
      grid-column: 1 / -1;
    }

    .stocktaking-common-button {
      min-height: 62px;
      margin: 0;
      border: 0;
      border-radius: 12px;
      font-size: 20px;
      font-weight: bold;
      cursor: pointer;
    }

    .stocktaking-common-confirm {
      background-color: #1565c0;
      color: #ffffff;
    }

    .stocktaking-common-cancel {
      background-color: #546e7a;
      color: #ffffff;
    }

    .stocktaking-common-button:hover,
    .stocktaking-common-button:focus-visible {
      outline: 4px solid #ffcc80;
      outline-offset: 2px;
      filter: brightness(0.94);
    }

    .stocktaking-common-warning {
      border-color: #ef6c00;
    }

    .stocktaking-common-warning .stocktaking-common-header {
      background-color: #fff3e0;
      color: #bf360c;
    }

    .stocktaking-common-warning .stocktaking-common-confirm {
      background-color: #ef6c00;
    }

    .stocktaking-common-danger {
      border-color: #c62828;
    }

    .stocktaking-common-danger .stocktaking-common-header {
      background-color: #ffebee;
      color: #b71c1c;
    }

    .stocktaking-common-danger .stocktaking-common-confirm {
      background-color: #c62828;
    }

    .stocktaking-common-success {
      border-color: #2e7d32;
    }

    .stocktaking-common-success .stocktaking-common-header {
      background-color: #e8f5e9;
      color: #1b5e20;
    }

    .stocktaking-common-success .stocktaking-common-confirm {
      background-color: #2e7d32;
    }

    @media (max-width: 700px) {
      .stocktaking-warning-overlay {
        align-items: center;
        padding: 12px;
      }

      .stocktaking-warning-modal {
        max-height: calc(100vh - 24px);
        padding: 0 16px 16px;
        border-width: 4px;
        border-radius: 14px;
      }

      .stocktaking-warning-header {
        gap: 10px;
        margin: 0 -16px 16px;
        padding: 16px;
      }

      .stocktaking-warning-icon {
        font-size: 38px;
      }

      .stocktaking-warning-header h2 {
        font-size: 23px;
      }

      .stocktaking-warning-summary,
      .stocktaking-warning-instruction {
        font-size: 17px;
      }

      .stocktaking-warning-product {
        font-size: 19px;
      }

      .stocktaking-warning-stock-line {
        font-size: 17px;
      }

      .stocktaking-warning-current {
        font-size: 19px;
      }

      .stocktaking-warning-close {
        min-height: 60px;
        font-size: 20px;
      }

      .stocktaking-common-modal {
        max-height: calc(100vh - 24px);
        border-width: 4px;
        border-radius: 14px;
      }

      .stocktaking-common-header {
        gap: 10px;
        padding: 16px;
      }

      .stocktaking-common-icon {
        font-size: 36px;
      }

      .stocktaking-common-title {
        font-size: 23px;
      }

      .stocktaking-common-message {
        padding: 18px 16px;
        font-size: 17px;
      }

      .stocktaking-common-actions {
        grid-template-columns: 1fr;
        padding: 0 16px 16px;
      }

      .stocktaking-common-button {
        min-height: 58px;
        font-size: 19px;
      }

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
      #stocktaking-active > .stocktaking-bulk-zero-area,
      #stocktaking-active > fieldset,
      #stocktaking-active > button {
        margin-left: 12px;
        margin-right: 12px;
        width: calc(100% - 24px);
        box-sizing: border-box;
      }

      .stocktaking-bulk-zero-buttons {
        grid-template-columns: 1fr;
      }

      .stocktaking-bulk-zero-buttons button {
        width: 100%;
        min-height: 52px;
        margin: 0;
        font-size: 16px;
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

      .stocktaking-product-card-row[hidden] {
        display: none !important;
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
      .stocktaking-items-table input[type="number"],
      .stocktaking-items-table select {
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
        await showStocktakingConfirm(
          "棚卸日：" + latestStocktaking.stocktakingDate + "\n" +
          "担当者：" + latestStocktaking.person + "\n" +
          "保管場所：" + latestStocktaking.location + "\n\n" +
          "この棚卸を開きますか？",
          {
            title: "進行中の棚卸があります",
            type: "warning",
            icon: "📋",
            confirmText: "この棚卸を開く",
            cancelText: "新しく開始する"
          }
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

    showStocktakingNotice(
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

  scrollStocktakingScreenIntoView(
    stocktakingSetupScreen,
    stocktakingPersonInput
  );
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
    showStocktakingNotice(
      "棚卸日を入力してください。"
    );

    stocktakingDateInput.focus();
    return;
  }

  if (person === "") {
    showStocktakingNotice(
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

    showStocktakingNotice(
      "棚卸対象の商品を読み込めませんでした。"
    );

    return;
  }

  if (targetProducts.length === 0) {
    showStocktakingNotice(
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
    await showStocktakingConfirm(
      confirmationMessage,
      {
        title: "棚卸を開始しますか？",
        type: "info",
        icon: "📋",
        confirmText: "棚卸を開始する",
        cancelText: "戻る"
      }
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
    locationStockVersion: 1,
    items:
      createStocktakingItems(
        targetProducts,
        location
      )
  };

  try {
    await saveStocktakingSession(
      stocktaking
    );

    await showActiveStocktaking(
      stocktaking
    );

    showStocktakingNotice(
      "棚卸を開始しました。"
    );
  } catch (error) {
    console.error(error);

    showStocktakingNotice(
      "棚卸開始情報を保存できませんでした。"
    );
  }
}

function isDiscontinuedStocktakingProduct(
  product
) {
  const savedStatus =
    String(
      product &&
      product.productStatus
        ? product.productStatus
        : ""
    )
      .normalize("NFKC")
      .trim()
      .toLowerCase();

  return (
    savedStatus === "廃盤" ||
    savedStatus ===
      "discontinued" ||
    savedStatus === "inactive" ||
    (
      product &&
      product.discontinued === true
    )
  );
}

function getStocktakingProductLocationStocks(
  product
) {
  let entries = [];

  if (
    typeof getProductLocationStocks ===
    "function"
  ) {
    entries =
      getProductLocationStocks(
        product
      );
  } else {
    const fallbackLocation =
      String(
        product && product.location
          ? product.location
          : ""
      ).trim();

    entries = [
      {
        location:
          fallbackLocation,
        stock:
          getValidStocktakingNumber(
            product && product.stock
          )
      }
    ];
  }

  const normalizedEntries =
    entries
      .map(
        function (entry) {
          const location =
            typeof normalizeLocationStockName ===
            "function"
              ? normalizeLocationStockName(
                  entry && entry.location
                )
              : String(
                  entry && entry.location
                    ? entry.location
                    : ""
                ).trim();

          return {
            location: location,
            stock:
              getValidStocktakingNumber(
                entry && entry.stock
              )
          };
        }
      )
      .filter(
        function (entry) {
          return entry.location !== "";
        }
      );

  const locationOrder =
    new Map();

  STOCKTAKING_LOCATION_OPTIONS.forEach(
    function (location, index) {
      locationOrder.set(
        normalizeStocktakingText(
          location
        ),
        index
      );
    }
  );

  locationOrder.set(
    normalizeStocktakingText(
      STOCKTAKING_BULK_ZERO_UNCONFIRMED_LOCATION
    ),
    STOCKTAKING_LOCATION_OPTIONS.length
  );

  normalizedEntries.sort(
    function (left, right) {
      const leftKey =
        normalizeStocktakingText(
          left.location
        );

      const rightKey =
        normalizeStocktakingText(
          right.location
        );

      const leftIndex =
        locationOrder.has(leftKey)
          ? locationOrder.get(leftKey)
          : 999;

      const rightIndex =
        locationOrder.has(rightKey)
          ? locationOrder.get(rightKey)
          : 999;

      if (leftIndex !== rightIndex) {
        return leftIndex - rightIndex;
      }

      return left.location.localeCompare(
        right.location,
        "ja"
      );
    }
  );

  return normalizedEntries;
}

function getStocktakingRegisteredLocationBreakdown(
  product,
  stocktakingLocation
) {
  const locationStocks =
    getStocktakingProductLocationStocks(
      product
    );

  if (
    stocktakingLocation ===
    "すべての保管場所"
  ) {
    return locationStocks.map(
      function (entry) {
        return {
          location: entry.location,
          stock: entry.stock
        };
      }
    );
  }

  const normalizedTargetLocation =
    typeof normalizeLocationStockName ===
    "function"
      ? normalizeLocationStockName(
          stocktakingLocation
        )
      : String(
          stocktakingLocation || ""
        ).trim();

  const targetEntry =
    locationStocks.find(
      function (entry) {
        return (
          normalizeStocktakingText(
            entry.location
          ) ===
          normalizeStocktakingText(
            normalizedTargetLocation
          )
        );
      }
    );

  if (targetEntry) {
    return [
      {
        location:
          targetEntry.location,
        stock:
          targetEntry.stock
      }
    ];
  }

  const primaryLocation =
    typeof normalizeLocationStockName ===
    "function"
      ? normalizeLocationStockName(
          product && product.location
        )
      : String(
          product && product.location
            ? product.location
            : ""
        ).trim();

  if (
    normalizeStocktakingText(
      primaryLocation
    ) ===
    normalizeStocktakingText(
      normalizedTargetLocation
    )
  ) {
    return [
      {
        location:
          normalizedTargetLocation,
        stock: 0
      }
    ];
  }

  return [];
}

function getRegisteredStockTotal(
  registeredLocationBreakdown
) {
  return (
    Array.isArray(
      registeredLocationBreakdown
    )
      ? registeredLocationBreakdown
      : []
  ).reduce(
    function (sum, entry) {
      return (
        sum +
        getValidStocktakingNumber(
          entry && entry.stock
        )
      );
    },
    0
  );
}

function createInitialStocktakingLocationBreakdown(
  registeredLocationBreakdown,
  fallbackLocation
) {
  const sourceEntries =
    Array.isArray(
      registeredLocationBreakdown
    )
      ? registeredLocationBreakdown
      : [];

  if (sourceEntries.length > 0) {
    return sourceEntries.map(
      function (entry) {
        return {
          id:
            createStocktakingLocationEntryId(),
          location:
            entry.location || "",
          quantity: ""
        };
      }
    );
  }

  return [
    {
      id:
        createStocktakingLocationEntryId(),
      location:
        fallbackLocation || "",
      quantity: ""
    }
  ];
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
          isDiscontinuedStocktakingProduct(
            product
          )
        ) {
          return false;
        }

        if (
          location ===
          "すべての保管場所"
        ) {
          return true;
        }

        const registeredBreakdown =
          getStocktakingRegisteredLocationBreakdown(
            product,
            location
          );

        if (
          registeredBreakdown.length > 0
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
  targetProducts,
  stocktakingLocation
) {
  return targetProducts.map(
    function (product) {
      const registeredLocationBreakdown =
        getStocktakingRegisteredLocationBreakdown(
          product,
          stocktakingLocation
        );

      const registeredStock =
        getRegisteredStockTotal(
          registeredLocationBreakdown
        );

      const fallbackLocation =
        stocktakingLocation ===
        "すべての保管場所"
          ? (
              product.location || ""
            )
          : stocktakingLocation;

      const displayLocation =
        stocktakingLocation ===
        "すべての保管場所"
          ? (
              registeredLocationBreakdown.length > 0
                ? registeredLocationBreakdown
                    .map(
                      function (entry) {
                        return entry.location;
                      }
                    )
                    .join(" / ")
                : (
                    product.location ||
                    "未登録"
                  )
            )
          : stocktakingLocation;

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
          displayLocation ||
          "未登録",
        registeredStock:
          registeredStock,
        registeredLocationBreakdown:
          registeredLocationBreakdown,
        locationBreakdown:
          createInitialStocktakingLocationBreakdown(
            registeredLocationBreakdown,
            fallbackLocation
          ),
        actualStock: "",
        difference: null,
        result: "未確認",
        memo: "",
        checkedAt: "",
        bulkZeroApplied: false,
        bulkZeroAppliedAt: ""
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
          targetProducts,
          currentStocktaking.location
        );

      currentStocktaking.updatedAt =
        new Date().toISOString();

      await updateStocktakingSession(
        currentStocktaking
      );
    } catch (error) {
      console.error(error);

      showStocktakingNotice(
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

  const stocktakingNotice =
    stocktakingActiveScreen.querySelector(
      ".stocktaking-notice"
    );

  if (
    stocktakingNotice &&
    currentStocktaking.locationStockVersion ===
      1
  ) {
    if (
      currentStocktaking.location ===
      "すべての保管場所"
    ) {
      stocktakingNotice.textContent =
        "場所別在庫を基準に棚卸します。登録されている各保管場所の実在庫を入力してください。別の場所で見つかった場合は「保管場所を追加」で入力できます。";
    } else {
      stocktakingNotice.textContent =
        `「${currentStocktaking.location}」の場所別在庫を棚卸します。この棚卸を確定した場合、この保管場所の在庫だけを実在庫へ置き換え、ほかの保管場所の在庫は変更しません。`;
    }
  }

  stocktakingProductSearchInput.value =
    "";

  stocktakingDisplayFilter.value =
    "all";

  if (bulkZeroLocationSelect) {
    if (
      currentStocktaking.locationStockVersion ===
        1 &&
      currentStocktaking.location !==
      "すべての保管場所"
    ) {
      const fixedLocation =
        typeof normalizeLocationStockName ===
        "function"
          ? normalizeLocationStockName(
              currentStocktaking.location
            )
          : currentStocktaking.location;

      bulkZeroLocationSelect.value =
        fixedLocation;
      bulkZeroLocationSelect.disabled =
        true;
    } else {
      bulkZeroLocationSelect.value =
        STOCKTAKING_BULK_ZERO_UNCONFIRMED_LOCATION;
      bulkZeroLocationSelect.disabled =
        false;
    }
  }

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

  updateStocktakingMobileFocusMode();
  filterStocktakingItems();

  scrollStocktakingScreenIntoView(
    stocktakingActiveScreen
  );
}

function normalizeRegisteredStocktakingLocationBreakdown(
  item
) {
  const sourceEntries =
    Array.isArray(
      item &&
      item.registeredLocationBreakdown
    )
      ? item.registeredLocationBreakdown
      : [];

  if (sourceEntries.length > 0) {
    return sourceEntries
      .map(
        function (entry) {
          const location =
            typeof normalizeLocationStockName ===
            "function"
              ? normalizeLocationStockName(
                  entry && entry.location
                )
              : String(
                  entry && entry.location
                    ? entry.location
                    : ""
                ).trim();

          return {
            location: location,
            stock:
              getValidStocktakingNumber(
                entry && entry.stock
              )
          };
        }
      )
      .filter(
        function (entry) {
          return entry.location !== "";
        }
      );
  }

  const fallbackLocation =
    String(
      item && item.location &&
      item.location !== "未登録"
        ? item.location
        : ""
    ).trim();

  if (fallbackLocation === "") {
    return [];
  }

  return [
    {
      location:
        typeof normalizeLocationStockName ===
        "function"
          ? normalizeLocationStockName(
              fallbackLocation
            )
          : fallbackLocation,
      stock:
        getValidStocktakingNumber(
          item && item.registeredStock
        )
    }
  ];
}

function formatRegisteredStocktakingLocations(
  item
) {
  const entries =
    normalizeRegisteredStocktakingLocationBreakdown(
      item
    );

  if (entries.length === 0) {
    return item.location || "未登録";
  }

  return entries
    .map(
      function (entry) {
        return entry.location;
      }
    )
    .join(" / ");
}

function normalizeStocktakingItem(item) {
  const registeredLocationBreakdown =
    normalizeRegisteredStocktakingLocationBreakdown(
      item
    );

  const registeredStock =
    registeredLocationBreakdown.length > 0
      ? getRegisteredStockTotal(
          registeredLocationBreakdown
        )
      : getValidStocktakingNumber(
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
    registeredLocationBreakdown:
      registeredLocationBreakdown,
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
          ),
    bulkZeroApplied:
      actualStock !== "" &&
      item.bulkZeroApplied === true,
    bulkZeroAppliedAt:
      actualStock !== "" &&
      item.bulkZeroApplied === true
        ? (item.bulkZeroAppliedAt || "")
        : ""
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

function isSingleLocationStocktakingMode() {
  return (
    currentStocktaking &&
    currentStocktaking.locationStockVersion ===
      1 &&
    currentStocktaking.location !==
      "すべての保管場所"
  );
}

function isMobileStocktakingFocusMode() {
  const resolvedMode =
    document.body.dataset
      .resolvedDisplayMode;

  if (resolvedMode === "mobile") {
    return true;
  }

  if (resolvedMode === "pc") {
    return false;
  }

  return window.matchMedia(
    "(max-width: 900px)"
  ).matches;
}

function updateStocktakingMobileFocusMode() {
  if (!stocktakingActiveScreen) {
    return;
  }

  const mobileMode =
    isMobileStocktakingFocusMode();

  const fixedLocationMode =
    Boolean(
      mobileMode &&
      currentStocktaking &&
      isSingleLocationStocktakingMode()
    );

  stocktakingActiveScreen.classList.toggle(
    "stocktaking-mobile-focus-mode",
    mobileMode
  );

  stocktakingActiveScreen.classList.toggle(
    "stocktaking-fixed-location-mode",
    fixedLocationMode
  );

  updateStocktakingMobileContext(
    mobileMode,
    fixedLocationMode
  );

  if (
    stocktakingInfoDetails &&
    mobileMode
  ) {
    stocktakingInfoDetails.open = true;
  }

  if (
    stocktakingItemsDetails &&
    mobileMode
  ) {
    stocktakingItemsDetails.open = true;
  }

  if (stocktakingActionsDetails) {
    const summary =
      stocktakingActionsDetails.querySelector(
        ":scope > summary"
      );

    if (mobileMode) {
      stocktakingActionsDetails.open =
        false;

      if (summary) {
        summary.textContent =
          "棚卸を終了・確定";
      }
    } else if (summary) {
      summary.textContent =
        "3. 保存・確定";
    }
  }

  if (stocktakingProductSearchInput) {
    if (mobileMode) {
      stocktakingProductSearchInput.placeholder =
        "商品名・コード・JANを入力";
    } else {
      stocktakingProductSearchInput.placeholder =
        "商品名・社内コード・商品コード・JANコード";
    }
  }
}

function updateStocktakingMobileContext(
  mobileMode,
  fixedLocationMode
) {
  if (!stocktakingActiveScreen) {
    return;
  }

  let context =
    stocktakingActiveScreen.querySelector(
      ".stocktaking-mobile-context"
    );

  if (!mobileMode) {
    if (context) {
      context.hidden = true;
    }

    return;
  }

  if (!context) {
    context =
      document.createElement("div");

    context.className =
      "stocktaking-mobile-context";
  }

  const title =
    stocktakingActiveScreen.querySelector(
      "h2"
    );

  if (title) {
    title.insertAdjacentElement(
      "afterend",
      context
    );
  } else {
    stocktakingActiveScreen.prepend(
      context
    );
  }

  context.hidden = false;

  const locationText =
    currentStocktaking
      ? (
          currentStocktaking.location ||
          "すべての保管場所"
        )
      : "未設定";

  const personText =
    currentStocktaking
      ? (
          currentStocktaking.person ||
          "未入力"
        )
      : "未入力";

  const dateText =
    currentStocktaking
      ? (
          currentStocktaking.stocktakingDate ||
          ""
        )
      : "";

  context.innerHTML = `
    <strong>
      ${
        fixedLocationMode
          ? "棚卸場所は確定済み"
          : "棚卸中"
      }
    </strong>

    <span>
      場所：
      <b>${escapeStocktakingMobileText(
        locationText
      )}</b>
    </span>

    <span>
      担当：
      <b>${escapeStocktakingMobileText(
        personText
      )}</b>
    </span>

    ${
      dateText
        ? `<span>日付：<b>${escapeStocktakingMobileText(
            dateText
          )}</b></span>`
        : ""
    }
  `;
}

function escapeStocktakingMobileText(
  value
) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function createStocktakingMobileFocusStyle() {
  if (
    document.querySelector(
      "#stocktaking-mobile-focus-style"
    )
  ) {
    return;
  }

  const style =
    document.createElement("style");

  style.id =
    "stocktaking-mobile-focus-style";

  style.textContent = `
    #stocktaking-complete {
      max-width: 980px;
      margin: 0 auto 28px;
      padding: 22px;
      border-radius: 16px;
      background: #ffffff;
      box-shadow:
        0 5px 18px
        rgba(38, 50, 56, 0.10);
    }

    #stocktaking-complete[hidden] {
      display: none !important;
    }

    #stocktaking-complete > h2 {
      margin: 0 0 14px;
      color: #1565c0;
    }

    #stocktaking-complete
      .stocktaking-complete-success {
      margin-bottom: 14px;
      padding: 16px;
      border: 2px solid #81c784;
      border-radius: 12px;
      background: #f1f8e9;
    }

    #stocktaking-complete
      .stocktaking-complete-success
      strong {
      display: block;
      margin-bottom: 5px;
      color: #1b5e20;
      font-size: 20px;
    }

    #stocktaking-complete
      .stocktaking-complete-success
      p {
      margin: 0;
      line-height: 1.6;
    }

    #stocktaking-complete
      .stocktaking-complete-summary {
      display: grid;
      grid-template-columns:
        repeat(4, minmax(0, 1fr));
      gap: 10px;
      margin-bottom: 16px;
    }

    #stocktaking-complete
      .stocktaking-complete-summary
      > div {
      padding: 12px;
      border: 1px solid #d7e0e8;
      border-radius: 10px;
      background: #f7f9fb;
    }

    #stocktaking-complete
      .stocktaking-complete-summary
      span {
      display: block;
      margin-bottom: 4px;
      color: #607d8b;
      font-size: 12px;
      font-weight: 700;
    }

    #stocktaking-complete
      .stocktaking-complete-summary
      strong {
      display: block;
      color: #263238;
      font-size: 16px;
      overflow-wrap: anywhere;
    }

    #stocktaking-complete
      .stocktaking-send-area {
      margin-bottom: 14px;
      padding: 16px;
      border: 2px solid #90caf9;
      border-radius: 12px;
      background: #f4f9ff;
    }

    #stocktaking-complete
      .stocktaking-send-area
      h3 {
      margin: 0 0 7px;
      color: #0d47a1;
    }

    #stocktaking-complete
      .stocktaking-send-area
      p {
      line-height: 1.6;
    }

    #stocktaking-complete
      #stocktaking-email-result-button,
    #stocktaking-complete
      #stocktaking-download-result-button,
    #stocktaking-complete
      .stocktaking-complete-home-button {
      width: 100%;
      min-height: 54px;
      margin: 8px 0 0;
      border-radius: 12px;
      font-size: 17px;
      font-weight: 800;
    }

    #stocktaking-complete
      #stocktaking-email-result-button {
      background: #2e7d32;
    }

    #stocktaking-complete
      .stocktaking-manager-email-label {
      display: block;
      margin: 12px 0 6px;
      color: #0d47a1;
      font-weight: 800;
    }

    #stocktaking-complete
      #stocktaking-manager-email {
      width: 100%;
      min-height: 52px;
      box-sizing: border-box;
      margin: 0;
      padding: 10px 12px;
      border: 1px solid #90a4ae;
      border-radius: 10px;
      background: #ffffff;
      font-size: 17px;
    }

    #stocktaking-complete
      .stocktaking-manager-email-help {
      margin: 6px 0 10px;
      color: #607d8b;
      font-size: 13px;
    }

    #stocktaking-complete
      #stocktaking-download-result-button {
      background: #1565c0;
    }

    #stocktaking-complete
      .stocktaking-complete-home-button {
      background: #546e7a;
    }

    #stocktaking-complete
      .stocktaking-share-message {
      min-height: 22px;
      margin: 9px 0 0;
      color: #2e7d32;
      font-weight: 700;
    }

    #stocktaking-active .stocktaking-mobile-context {
      display: none;
    }

    @media (max-width: 900px) {
      #stocktaking-complete {
        margin: 12px;
        padding: 16px;
      }

      #stocktaking-complete
        .stocktaking-complete-summary {
        grid-template-columns:
          repeat(2, minmax(0, 1fr));
        gap: 8px;
      }

      #stocktaking-complete
        .stocktaking-complete-success
        strong {
        font-size: 19px;
      }

      #stocktaking-complete
        #stocktaking-email-result-button,
      #stocktaking-complete
        #stocktaking-download-result-button,
      #stocktaking-complete
        .stocktaking-complete-home-button {
        min-height: 62px;
        font-size: 18px;
      }

      #stocktaking-active.stocktaking-mobile-focus-mode {
        padding-left: 0;
        padding-right: 0;
      }

      #stocktaking-active.stocktaking-mobile-focus-mode
        > h2 {
        margin: 10px 12px 6px;
        font-size: 24px;
      }

      #stocktaking-active.stocktaking-mobile-focus-mode
        .stocktaking-mobile-context {
        display: flex;
        flex-wrap: wrap;
        gap: 6px 12px;
        margin: 0 12px 8px;
        padding: 9px 12px;
        border: 2px solid #b39ddb;
        border-radius: 12px;
        background: #faf5fc;
        color: #37474f;
        font-size: 13px;
        line-height: 1.45;
      }

      #stocktaking-active.stocktaking-mobile-focus-mode
        .stocktaking-mobile-context
        > strong {
        width: 100%;
        color: #6a1b9a;
        font-size: 15px;
      }

      #stocktaking-active.stocktaking-mobile-focus-mode
        #stocktaking-sticky-navigation {
        display: none !important;
      }

      #stocktaking-active.stocktaking-mobile-focus-mode
        #stocktaking-info-details {
        margin: 8px 12px 10px;
        width: calc(100% - 24px);
        border: 0;
        background: transparent;
        overflow: visible;
      }

      #stocktaking-active.stocktaking-mobile-focus-mode
        #stocktaking-info-details
        > summary {
        display: none;
      }

      #stocktaking-active.stocktaking-mobile-focus-mode
        #stocktaking-info-details
        > .stocktaking-notice,
      #stocktaking-active.stocktaking-mobile-focus-mode
        #stocktaking-info-details
        > .stocktaking-info-table,
      #stocktaking-active.stocktaking-mobile-focus-mode
        #stocktaking-info-details
        > .stocktaking-summary,
      #stocktaking-active.stocktaking-mobile-focus-mode
        #stocktaking-info-details
        > .stocktaking-bulk-zero-area,
      #stocktaking-active.stocktaking-mobile-focus-mode
        #stocktaking-info-details
        > .stocktaking-page-size-area {
        display: none !important;
      }

      #stocktaking-active.stocktaking-mobile-focus-mode
        .stocktaking-search-area {
        margin: 0 0 8px !important;
        padding: 10px;
        border: 2px solid #90caf9;
        border-radius: 12px;
        background: #f4f9ff;
      }

      #stocktaking-active.stocktaking-mobile-focus-mode
        .stocktaking-search-area
        label[for="stocktaking-product-search"] {
        display: block;
        margin-bottom: 7px;
        color: #0d47a1;
        font-size: 16px;
        font-weight: 800;
      }

      #stocktaking-active.stocktaking-mobile-focus-mode
        #stocktaking-product-search {
        min-height: 54px;
        margin: 0;
        padding: 10px 12px;
        font-size: 18px;
      }

      #stocktaking-active.stocktaking-mobile-focus-mode
        .stocktaking-search-area
        label[for="stocktaking-display-filter"],
      #stocktaking-active.stocktaking-mobile-focus-mode
        #stocktaking-display-filter,
      #stocktaking-active.stocktaking-mobile-focus-mode
        .stocktaking-search-area
        .stocktaking-page-size-area,
      #stocktaking-active.stocktaking-mobile-focus-mode
        #stocktaking-page-size {
        display: none !important;
      }

      #stocktaking-active.stocktaking-mobile-focus-mode
        #stocktaking-search-message {
        margin: 8px 0 0;
        padding: 9px 10px;
        font-size: 13px;
      }

      #stocktaking-active.stocktaking-mobile-focus-mode
        #stocktaking-camera-scan-button {
        width: 100% !important;
        min-height: 58px;
        margin: 0 !important;
        border-radius: 12px;
        background: #1565c0;
        font-size: 17px;
        font-weight: 800;
      }

      #stocktaking-active.stocktaking-mobile-focus-mode
        #stocktaking-items-details {
        margin: 8px 0 12px;
        width: 100%;
        border: 0;
        background: transparent;
        overflow: visible;
      }

      #stocktaking-active.stocktaking-mobile-focus-mode
        #stocktaking-items-details
        > summary,
      #stocktaking-active.stocktaking-mobile-focus-mode
        #stocktaking-items-details
        > .stocktaking-list-pager {
        display: none !important;
      }

      #stocktaking-active.stocktaking-mobile-focus-mode
        #stocktaking-items-details
        .stocktaking-table-area {
        padding: 0 12px;
      }

      #stocktaking-active.stocktaking-mobile-focus-mode
        .stocktaking-product-card-row {
        padding: 12px;
        border-radius: 14px;
        box-shadow:
          0 3px 10px
          rgba(38, 50, 56, 0.10);
      }

      #stocktaking-active.stocktaking-mobile-focus-mode
        .stocktaking-cell-product-name {
        padding-top: 2px !important;
        padding-bottom: 8px !important;
        font-size: 21px;
      }

      #stocktaking-active.stocktaking-mobile-focus-mode
        .stocktaking-cell-internal-code,
      #stocktaking-active.stocktaking-mobile-focus-mode
        .stocktaking-cell-product-code,
      #stocktaking-active.stocktaking-mobile-focus-mode
        .stocktaking-cell-registered-location {
        grid-template-columns:
          92px minmax(0, 1fr);
        padding: 4px 0 !important;
        font-size: 14px;
      }

      #stocktaking-active.stocktaking-mobile-focus-mode
        .stocktaking-cell-registered-stock,
      #stocktaking-active.stocktaking-mobile-focus-mode
        .stocktaking-cell-difference {
        margin-top: 8px;
        padding: 9px 6px !important;
        font-size: 22px;
      }

      #stocktaking-active.stocktaking-mobile-focus-mode
        .stocktaking-cell-actual-stock {
        margin-top: 8px;
        padding: 10px !important;
      }

      #stocktaking-active.stocktaking-mobile-focus-mode
        .stocktaking-cell-memo {
        padding-top: 8px !important;
      }

      #stocktaking-active.stocktaking-mobile-focus-mode
        .stocktaking-cell-mobile-actions {
        gap: 7px;
        padding-top: 8px !important;
      }

      #stocktaking-active.stocktaking-mobile-focus-mode
        .stocktaking-cell-mobile-actions
        button {
        min-height: 52px;
        padding: 10px 8px;
        font-size: 15px;
      }

      #stocktaking-active.stocktaking-mobile-focus-mode
        #stocktaking-sticky-action-bar {
        display: none !important;
      }

      #stocktaking-active.stocktaking-mobile-focus-mode
        #stocktaking-actions-details {
        margin: 12px;
        width: calc(100% - 24px);
      }

      #stocktaking-active.stocktaking-mobile-focus-mode
        #stocktaking-actions-details
        > summary {
        padding: 12px 14px;
        font-size: 16px;
      }

      #stocktaking-active.stocktaking-mobile-focus-mode
        .stocktaking-items-table
        tbody
        > tr:not([data-internal-code])
        td {
        padding: 14px 12px;
        font-size: 14px;
      }

      #stocktaking-active.stocktaking-mobile-focus-mode
        .stocktaking-location-entry
        input[type="number"] {
        min-height: 58px;
        font-size: 22px;
        font-weight: 800;
        text-align: center;
      }

      #stocktaking-active.stocktaking-mobile-focus-mode.stocktaking-fixed-location-mode
        .stocktaking-cell-registered-location,
      #stocktaking-active.stocktaking-mobile-focus-mode.stocktaking-fixed-location-mode
        .stocktaking-mobile-location-heading,
      #stocktaking-active.stocktaking-mobile-focus-mode.stocktaking-fixed-location-mode
        .stocktaking-location-name-input,
      #stocktaking-active.stocktaking-mobile-focus-mode.stocktaking-fixed-location-mode
        .stocktaking-remove-location-button,
      #stocktaking-active.stocktaking-mobile-focus-mode.stocktaking-fixed-location-mode
        .stocktaking-add-location-button {
        display: none !important;
      }

      #stocktaking-active.stocktaking-mobile-focus-mode.stocktaking-fixed-location-mode
        .stocktaking-location-entry {
        grid-template-columns: 1fr;
        gap: 0;
      }

      #stocktaking-active.stocktaking-mobile-focus-mode.stocktaking-fixed-location-mode
        .stocktaking-location-entry
        input[type="number"] {
        min-height: 78px;
        padding: 10px;
        border: 3px solid #7e57c2;
        border-radius: 12px;
        font-size: 32px;
        font-weight: 900;
      }

      #stocktaking-active.stocktaking-mobile-focus-mode.stocktaking-fixed-location-mode
        .stocktaking-location-total {
        margin-top: 8px;
        padding: 9px 10px;
        font-size: 17px;
      }
    }
  `;

  document.head.appendChild(
    style
  );
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
        item.location,
        item.bulkZeroApplied
          ? "一括0入力"
          : ""
      ].join(" ")
    );

  row.dataset.bulkZero =
    item.bulkZeroApplied
      ? "true"
      : "false";

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
    formatRegisteredStocktakingLocations(
      item
    ),
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

  if (
    isSingleLocationStocktakingMode()
  ) {
    addLocationButton.hidden = true;
  }

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
      clearStocktakingBulkZeroFlag(
        item
      );

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
        document.createElement("select");

      const lockedLocation =
        isSingleLocationStocktakingMode()
          ? (
              typeof normalizeLocationStockName ===
              "function"
                ? normalizeLocationStockName(
                    currentStocktaking.location
                  )
                : String(
                    currentStocktaking.location || ""
                  ).trim()
            )
          : "";

      if (lockedLocation !== "") {
        entry.location = lockedLocation;
      }

      const savedLocation =
        typeof normalizeLocationStockName ===
        "function"
          ? normalizeLocationStockName(
              entry.location || ""
            )
          : String(
              entry.location || ""
            ).trim();

      entry.location = savedLocation;

      locationInput.innerHTML =
        createStocktakingLocationOptionsHtml(
          false,
          item.bulkZeroApplied === true ||
          isBulkZeroUnconfirmedLocation(
            savedLocation
          )
        );

      if (
        savedLocation !== "" &&
        !isAllowedStocktakingItemLocation(
          item,
          savedLocation
        )
      ) {
        const oldLocationOption =
          document.createElement(
            "option"
          );

        oldLocationOption.value =
          savedLocation;

        oldLocationOption.textContent =
          `${savedLocation}（一覧外・選び直してください）`;

        oldLocationOption.disabled =
          true;

        oldLocationOption.selected =
          true;

        locationInput.appendChild(
          oldLocationOption
        );
      } else {
        locationInput.value =
          savedLocation;
      }

      locationInput.classList.add(
        "stocktaking-location-name-input"
      );

      locationInput.dataset.entryId =
        entry.id;

      locationInput.setAttribute(
        "aria-label",
        `${item.productName}の保管場所`
      );

      if (lockedLocation !== "") {
        locationInput.disabled = true;
      }

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
        item.locationBreakdown.length === 1 ||
        lockedLocation !== "";

      if (lockedLocation !== "") {
        removeButton.hidden = true;
      }

      locationInput.addEventListener(
        "change",
        function () {
          clearStocktakingBulkZeroFlag(
            item
          );

          entry.location =
            String(
              locationInput.value || ""
            ).trim();

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
          clearStocktakingBulkZeroFlag(
            item
          );

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
          clearStocktakingBulkZeroFlag(
            item
          );

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
        showStocktakingNotice(
          `「${item.productName}」の保管場所をリストから選択してください。`
        );

        focusStocktakingLocationEntry(
          entry.id,
          "location"
        );

        return false;
      }

      if (
        !isAllowedStocktakingItemLocation(
          item,
          location
        )
      ) {
        showStocktakingNotice(
          `「${item.productName}」の保管場所を、指定されたリストから選び直してください。`
        );

        focusStocktakingLocationEntry(
          entry.id,
          "location"
        );

        return false;
      }

      if (quantityText === "") {
        showStocktakingNotice(
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
        showStocktakingNotice(
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
        showStocktakingNotice(
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

      if (
        typeof input.select ===
        "function"
      ) {
        input.select();
      }

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

function createStocktakingMovementLocationChanges(
  beforeEntries,
  afterEntries
) {
  const beforeMap = new Map();
  const afterMap = new Map();

  (Array.isArray(beforeEntries)
    ? beforeEntries
    : []
  ).forEach(function (entry) {
    const location =
      String(entry.location || "").trim();

    if (location === "") {
      return;
    }

    beforeMap.set(
      location,
      Number(entry.stock || 0)
    );
  });

  (Array.isArray(afterEntries)
    ? afterEntries
    : []
  ).forEach(function (entry) {
    const location =
      String(entry.location || "").trim();

    if (location === "") {
      return;
    }

    afterMap.set(
      location,
      Number(entry.stock || 0)
    );
  });

  const locations =
    new Set([
      ...beforeMap.keys(),
      ...afterMap.keys()
    ]);

  return Array.from(locations)
    .map(function (location) {
      const beforeStock =
        Number(
          beforeMap.get(location) || 0
        );
      const afterStock =
        Number(
          afterMap.get(location) || 0
        );

      return {
        location: location,
        beforeStock: beforeStock,
        afterStock: afterStock,
        change:
          afterStock - beforeStock
      };
    })
    .filter(function (change) {
      return change.change !== 0;
    });
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
    "stocktaking-row-surplus",
    "stocktaking-row-bulk-zero"
  );

  resultBadge.classList.remove(
    "stocktaking-badge-unchecked",
    "stocktaking-badge-match",
    "stocktaking-badge-shortage",
    "stocktaking-badge-surplus",
    "stocktaking-badge-bulk-zero"
  );

  differenceCell.textContent =
    formatStocktakingDifference(
      item.difference
    );

  if (item.result === "差異なし") {
    row.classList.add(
      "stocktaking-row-match"
    );
  } else if (
    item.result === "在庫不足"
  ) {
    row.classList.add(
      "stocktaking-row-shortage"
    );
  } else if (
    item.result === "在庫過剰"
  ) {
    row.classList.add(
      "stocktaking-row-surplus"
    );
  } else {
    row.classList.add(
      "stocktaking-row-unchecked"
    );
  }

  if (item.bulkZeroApplied) {
    row.classList.add(
      "stocktaking-row-bulk-zero"
    );

    row.dataset.bulkZero =
      "true";

    resultBadge.textContent =
      "一括0入力";

    resultBadge.classList.add(
      "stocktaking-badge-bulk-zero"
    );

    return;
  }

  row.dataset.bulkZero =
    "false";

  resultBadge.textContent =
    item.result;

  if (item.result === "差異なし") {
    resultBadge.classList.add(
      "stocktaking-badge-match"
    );

    return;
  }

  if (item.result === "在庫不足") {
    resultBadge.classList.add(
      "stocktaking-badge-shortage"
    );

    return;
  }

  if (item.result === "在庫過剰") {
    resultBadge.classList.add(
      "stocktaking-badge-surplus"
    );

    return;
  }

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
      ).length,
    bulkZero:
      checkedItems.filter(
        function (item) {
          return (
            item.bulkZeroApplied ===
            true
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

  stocktakingSummaryBulkZero.textContent =
    counts.bulkZero;
}

function filterStocktakingItems() {
  const keyword =
    normalizeStocktakingText(
      stocktakingProductSearchInput.value
    );

  const filterType =
    stocktakingDisplayFilter
      ? stocktakingDisplayFilter.value
      : "all";

  const rows =
    stocktakingItemsBody.querySelectorAll(
      "tr[data-internal-code]"
    );

  let displayedCount = 0;

  rows.forEach(
    function (row) {
      const keywordMatches =
        keyword === "" ||
        row.dataset.searchText.includes(
          keyword
        );

      const item =
        currentStocktaking.items.find(
          function (currentItem) {
            return (
              currentItem.internalCode ===
              row.dataset.internalCode
            );
          }
        );

      let filterMatches = true;

      if (filterType === "unchecked") {
        filterMatches =
          Boolean(item) &&
          item.actualStock === "";
      } else if (
        filterType === "bulk-zero"
      ) {
        filterMatches =
          Boolean(item) &&
          item.bulkZeroApplied === true;
      }

      const matches =
        keywordMatches &&
        filterMatches;

      row.hidden = !matches;

      if (matches) {
        row.style.removeProperty(
          "display"
        );

        displayedCount += 1;
      } else {
        row.style.display = "none";
      }
    }
  );

  let filterLabel =
    "すべての商品";

  if (filterType === "unchecked") {
    filterLabel =
      "未確認の商品";
  } else if (
    filterType === "bulk-zero"
  ) {
    filterLabel =
      "一括0入力の商品";
  }

  if (keyword === "") {
    stocktakingSearchMessage.textContent =
      `${filterLabel}を表示しています。${displayedCount}件`;

    return;
  }

  stocktakingSearchMessage.textContent =
    `「${stocktakingProductSearchInput.value.trim()}」の検索結果：${displayedCount}件（${filterLabel}）`;
}

function clearStocktakingBulkZeroFlag(
  item
) {
  if (!item) {
    return;
  }

  item.bulkZeroApplied = false;
  item.bulkZeroAppliedAt = "";
}

function getBulkZeroRegisteredLocation(
  item
) {
  const itemLocation =
    String(
      item && item.location
        ? item.location
        : ""
    ).trim();

  if (
    isStocktakingLocationOption(
      itemLocation
    )
  ) {
    return itemLocation;
  }

  const sessionLocation =
    String(
      currentStocktaking &&
      currentStocktaking.location
        ? currentStocktaking.location
        : ""
    ).trim();

  if (
    isStocktakingLocationOption(
      sessionLocation
    )
  ) {
    return sessionLocation;
  }

  const existingEntry =
    Array.isArray(
      item.locationBreakdown
    )
      ? item.locationBreakdown.find(
          function (entry) {
            return isStocktakingLocationOption(
              entry.location
            );
          }
        )
      : null;

  return existingEntry
    ? String(
        existingEntry.location || ""
      ).trim()
    : "";
}

function getSelectedBulkZeroLocation() {
  if (!bulkZeroLocationSelect) {
    return (
      STOCKTAKING_BULK_ZERO_UNCONFIRMED_LOCATION
    );
  }

  const selectedLocation =
    String(
      bulkZeroLocationSelect.value || ""
    ).trim();

  if (
    selectedLocation ===
    STOCKTAKING_BULK_ZERO_REGISTERED_LOCATION
  ) {
    return selectedLocation;
  }

  if (
    isStocktakingLocationOption(
      selectedLocation
    ) ||
    isBulkZeroUnconfirmedLocation(
      selectedLocation
    )
  ) {
    return selectedLocation;
  }

  return (
    STOCKTAKING_BULK_ZERO_UNCONFIRMED_LOCATION
  );
}

function getBulkZeroLocationForItem(
  item,
  selectedLocation
) {
  if (
    selectedLocation ===
    STOCKTAKING_BULK_ZERO_REGISTERED_LOCATION
  ) {
    return (
      getBulkZeroRegisteredLocation(
        item
      ) ||
      STOCKTAKING_BULK_ZERO_UNCONFIRMED_LOCATION
    );
  }

  if (
    isStocktakingLocationOption(
      selectedLocation
    ) ||
    isBulkZeroUnconfirmedLocation(
      selectedLocation
    )
  ) {
    return selectedLocation;
  }

  return (
    STOCKTAKING_BULK_ZERO_UNCONFIRMED_LOCATION
  );
}

function getBulkZeroEligibleItems() {
  if (
    !currentStocktaking ||
    !Array.isArray(
      currentStocktaking.items
    )
  ) {
    return [];
  }

  return currentStocktaking.items.filter(
    function (item) {
      return (
        getValidStocktakingNumber(
          item.registeredStock
        ) === 0 &&
        item.actualStock === ""
      );
    }
  );
}

function applyBulkZeroToStocktakingItem(
  item,
  appliedAt,
  selectedLocation
) {
  const bulkZeroLocation =
    getBulkZeroLocationForItem(
      item,
      selectedLocation
    );

  item.locationBreakdown = [
    {
      id:
        createStocktakingLocationEntryId(),
      location:
        bulkZeroLocation,
      quantity: 0
    }
  ];

  refreshStocktakingItemFromLocations(
    item
  );

  item.bulkZeroApplied = true;
  item.bulkZeroAppliedAt = appliedAt;

  return true;
}

async function handleApplyBulkZero() {
  const eligibleItems =
    getBulkZeroEligibleItems();

  if (eligibleItems.length === 0) {
    showStocktakingNotice(
      "登録在庫が0個で、まだ未確認の商品はありません。"
    );

    return;
  }

  const selectedLocation =
    getSelectedBulkZeroLocation();

  const locationText =
    selectedLocation ===
    STOCKTAKING_BULK_ZERO_REGISTERED_LOCATION
      ? "商品ごとの登録保管場所（登録場所がない商品は『未確認』）"
      : selectedLocation;

  const isConfirmed =
    await showStocktakingConfirm(
      "対象商品：" + eligibleItems.length + "件\n" +
      "保管場所：" + locationText + "\n\n" +
      "この商品を実在庫0個として一括入力します。\n" +
      "『未確認』は、現物の保管場所をまだ確認していない記録です。",
      {
        title: "一括0入力を実行しますか？",
        type: "warning",
        icon: "⚠️",
        confirmText: "一括0入力する",
        cancelText: "キャンセル"
      }
    );

  if (!isConfirmed) {
    return;
  }

  const appliedAt =
    new Date().toISOString();

  eligibleItems.forEach(
    function (item) {
      applyBulkZeroToStocktakingItem(
        item,
        appliedAt,
        selectedLocation
      );
    }
  );

  stocktakingProductSearchInput.value =
    "";

  stocktakingDisplayFilter.value =
    "bulk-zero";

  renderStocktakingItems();
  markStocktakingAsUnsaved();

  stocktakingSaveMessage.textContent =
    eligibleItems.length +
    "件を一括で0入力しました。保管場所もまとめて設定しています。内容を確認して保存してください。";
}

async function handleUndoBulkZero() {
  if (
    !currentStocktaking ||
    !Array.isArray(
      currentStocktaking.items
    )
  ) {
    return;
  }

  const bulkZeroItems =
    currentStocktaking.items.filter(
      function (item) {
        return (
          item.bulkZeroApplied === true
        );
      }
    );

  if (bulkZeroItems.length === 0) {
    showStocktakingNotice(
      "取り消せる一括0入力はありません。"
    );

    return;
  }

  const isConfirmed =
    await showStocktakingConfirm(
      "一括0入力した" +
      bulkZeroItems.length +
      "件を未確認へ戻します。\n\n" +
      "手入力へ変更した商品は対象になりません。",
      {
        title: "一括0入力を取り消しますか？",
        type: "warning",
        icon: "↩️",
        confirmText: "未確認へ戻す",
        cancelText: "キャンセル"
      }
    );

  if (!isConfirmed) {
    return;
  }

  bulkZeroItems.forEach(
    function (item) {
      const restoredLocation =
        getBulkZeroRegisteredLocation(
          item
        );

      item.locationBreakdown = [
        {
          id:
            createStocktakingLocationEntryId(),
          location:
            restoredLocation,
          quantity: ""
        }
      ];

      clearStocktakingBulkZeroFlag(
        item
      );

      refreshStocktakingItemFromLocations(
        item
      );
    }
  );

  stocktakingProductSearchInput.value =
    "";

  stocktakingDisplayFilter.value =
    "all";

  renderStocktakingItems();
  markStocktakingAsUnsaved();

  stocktakingSaveMessage.textContent =
    bulkZeroItems.length +
    "件の一括0入力を取り消しました。内容を確認して保存してください。";
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
    showStocktakingNotice(
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
    showStocktakingNotice(
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
      showStocktakingNotice(
        "棚卸の入力内容を保存しました。"
      );
    }

    return true;
  } catch (error) {
    console.error(error);

    showStocktakingNotice(
      "棚卸の入力内容を保存できませんでした。"
    );

    return false;
  }
}

function normalizeStocktakingStockSnapshot(
  entries,
  valueKey
) {
  const snapshot =
    new Map();

  (
    Array.isArray(entries)
      ? entries
      : []
  ).forEach(
    function (entry) {
      const location =
        typeof normalizeLocationStockName ===
        "function"
          ? normalizeLocationStockName(
              entry && entry.location
            )
          : String(
              entry && entry.location
                ? entry.location
                : ""
            ).trim();

      if (location === "") {
        return;
      }

      const quantity =
        getValidStocktakingNumber(
          entry && entry[valueKey]
        );

      snapshot.set(
        location,
        (snapshot.get(location) || 0) +
          quantity
      );
    }
  );

  return snapshot;
}

function areStocktakingStockSnapshotsEqual(
  leftEntries,
  rightEntries
) {
  const leftSnapshot =
    normalizeStocktakingStockSnapshot(
      leftEntries,
      "stock"
    );

  const rightSnapshot =
    normalizeStocktakingStockSnapshot(
      rightEntries,
      "stock"
    );

  const allLocations =
    new Set([
      ...leftSnapshot.keys(),
      ...rightSnapshot.keys()
    ]);

  for (const location of allLocations) {
    if (
      (leftSnapshot.get(location) || 0) !==
      (rightSnapshot.get(location) || 0)
    ) {
      return false;
    }
  }

  return true;
}

function formatStocktakingRegisteredBreakdown(
  entries
) {
  if (
    !Array.isArray(entries) ||
    entries.length === 0
  ) {
    return "なし";
  }

  return entries
    .map(
      function (entry) {
        return (
          `${entry.location}：` +
          `${getValidStocktakingNumber(entry.stock)}個`
        );
      }
    )
    .join(" / ");
}

function getActualLocationStocksFromStocktakingItem(
  item
) {
  const merged =
    new Map();

  (
    Array.isArray(
      item && item.locationBreakdown
    )
      ? item.locationBreakdown
      : []
  ).forEach(
    function (entry) {
      const quantityText =
        String(
          entry &&
          entry.quantity !== undefined &&
          entry.quantity !== null
            ? entry.quantity
            : ""
        ).trim();

      if (quantityText === "") {
        return;
      }

      const quantity =
        Number(quantityText);

      if (
        !Number.isInteger(quantity) ||
        quantity < 0
      ) {
        return;
      }

      const location =
        typeof normalizeLocationStockName ===
        "function"
          ? normalizeLocationStockName(
              entry && entry.location
            )
          : String(
              entry && entry.location
                ? entry.location
                : ""
            ).trim();

      if (location === "") {
        return;
      }

      merged.set(
        location,
        (merged.get(location) || 0) +
          quantity
      );
    }
  );

  const entries =
    Array.from(
      merged,
      function ([location, stock]) {
        return {
          location: location,
          stock: stock
        };
      }
    );

  if (
    typeof sortLocationStocksByDisplayOrder ===
    "function"
  ) {
    return sortLocationStocksByDisplayOrder(
      entries
    );
  }

  return entries;
}

function chooseStocktakingPrimaryLocation(
  product,
  locationStocks,
  fallbackLocation
) {
  const normalizedEntries =
    typeof sortLocationStocksByDisplayOrder ===
    "function"
      ? sortLocationStocksByDisplayOrder(
          locationStocks
        )
      : locationStocks.slice();

  const currentPrimary =
    typeof normalizeLocationStockName ===
    "function"
      ? normalizeLocationStockName(
          product && product.location
        )
      : String(
          product && product.location
            ? product.location
            : ""
        ).trim();

  if (
    currentPrimary !== "" &&
    normalizedEntries.some(
      function (entry) {
        return (
          entry.location ===
            currentPrimary &&
          entry.stock > 0
        );
      }
    )
  ) {
    return currentPrimary;
  }

  const firstPositive =
    normalizedEntries.find(
      function (entry) {
        return entry.stock > 0;
      }
    );

  if (firstPositive) {
    return firstPositive.location;
  }

  const normalizedFallback =
    typeof normalizeLocationStockName ===
    "function"
      ? normalizeLocationStockName(
          fallbackLocation
        )
      : String(
          fallbackLocation || ""
        ).trim();

  return (
    normalizedFallback ||
    currentPrimary ||
    STOCKTAKING_BULK_ZERO_UNCONFIRMED_LOCATION
  );
}

function createLocationAwareStocktakingProductUpdate(
  product,
  item,
  stocktakingLocation,
  confirmedAt
) {
  const normalizedProduct =
    typeof normalizeProductLocationStocks ===
    "function"
      ? normalizeProductLocationStocks(
          product
        )
      : product;

  const beforeStock =
    getValidStocktakingNumber(
      normalizedProduct.stock
    );

  const beforeLocationStocks =
    getStocktakingProductLocationStocks(
      normalizedProduct
    );

  let nextLocationStocks = [];

  if (
    stocktakingLocation ===
    "すべての保管場所"
  ) {
    nextLocationStocks =
      getActualLocationStocksFromStocktakingItem(
        item
      );
  } else {
    const targetLocation =
      typeof normalizeLocationStockName ===
      "function"
        ? normalizeLocationStockName(
            stocktakingLocation
          )
        : String(
            stocktakingLocation || ""
          ).trim();

    nextLocationStocks =
      beforeLocationStocks.map(
        function (entry) {
          return {
            location: entry.location,
            stock: entry.stock
          };
        }
      );

    let targetEntry =
      nextLocationStocks.find(
        function (entry) {
          return (
            normalizeStocktakingText(
              entry.location
            ) ===
            normalizeStocktakingText(
              targetLocation
            )
          );
        }
      );

    if (!targetEntry) {
      targetEntry = {
        location: targetLocation,
        stock: 0
      };

      nextLocationStocks.push(
        targetEntry
      );
    }

    targetEntry.stock =
      getValidStocktakingNumber(
        item.actualStock
      );
  }

  if (
    typeof sortLocationStocksByDisplayOrder ===
    "function"
  ) {
    nextLocationStocks =
      sortLocationStocksByDisplayOrder(
        nextLocationStocks
      );
  }

  const afterStock =
    nextLocationStocks.reduce(
      function (sum, entry) {
        return (
          sum +
          getValidStocktakingNumber(
            entry.stock
          )
        );
      },
      0
    );

  const primaryLocation =
    chooseStocktakingPrimaryLocation(
      normalizedProduct,
      nextLocationStocks,
      stocktakingLocation ===
        "すべての保管場所"
        ? item.location
        : stocktakingLocation
    );

  const cleanedLocationStocks =
    nextLocationStocks.filter(
      function (entry) {
        return (
          entry.stock > 0 ||
          entry.location ===
            primaryLocation
        );
      }
    );

  const updatedProductSource = {
    ...normalizedProduct,
    stock: afterStock,
    location:
      primaryLocation,
    locationStocks:
      cleanedLocationStocks,
    updatedAt:
      confirmedAt
  };

  const updatedProduct =
    typeof normalizeProductLocationStocks ===
    "function"
      ? normalizeProductLocationStocks(
          updatedProductSource
        )
      : updatedProductSource;

  const afterLocationStocks =
    getStocktakingProductLocationStocks(
      updatedProduct
    );

  return {
    product: updatedProduct,
    beforeStock: beforeStock,
    afterStock:
      getValidStocktakingNumber(
        updatedProduct.stock
      ),
    beforeLocationStocks:
      beforeLocationStocks,
    afterLocationStocks:
      afterLocationStocks,
    locationChanged:
      !areStocktakingStockSnapshotsEqual(
        beforeLocationStocks,
        afterLocationStocks
      )
  };
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
    showStocktakingNotice(
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
    `在庫過剰：${counts.surplus}件\n` +
    `一括0入力：${counts.bulkZero}件\n\n` +
    `在庫処理：${reflectText}\n\n` +
    "確定後は、この棚卸を編集できません。";

  const isConfirmed =
    await showStocktakingConfirm(
      confirmationMessage,
      {
        title: "棚卸を確定しますか？",
        type: "warning",
        icon: "✅",
        confirmText: "棚卸を確定する",
        cancelText: "戻る"
      }
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
      const locationStockAware =
        currentStocktaking.locationStockVersion ===
        1;

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

          if (locationStockAware) {
            const registeredSnapshot =
              normalizeRegisteredStocktakingLocationBreakdown(
                item
              );

            const currentSnapshot =
              getStocktakingRegisteredLocationBreakdown(
                product,
                currentStocktaking.location
              );

            if (
              !areStocktakingStockSnapshotsEqual(
                registeredSnapshot,
                currentSnapshot
              )
            ) {
              changedItems.push({
                productName:
                  item.productName,
                registeredText:
                  formatStocktakingRegisteredBreakdown(
                    registeredSnapshot
                  ),
                currentText:
                  formatStocktakingRegisteredBreakdown(
                    currentSnapshot
                  )
              });
            }
          } else {
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
        }
      );

      if (missingItems.length > 0) {
        showStocktakingNotice(
          "棚卸開始後に削除された商品があります。\n\n" +
          missingItems.join("\n") +
          "\n\n棚卸を確定できません。"
        );

        return;
      }

      if (changedItems.length > 0) {
        showStocktakingInventoryChangedWarning(
          changedItems,
          locationStockAware
        );

        return;
      }

      currentStocktaking.items.forEach(
        function (item, index) {
          const product =
            productMap.get(
              item.internalCode
            );

          if (locationStockAware) {
            const updateResult =
              createLocationAwareStocktakingProductUpdate(
                product,
                item,
                currentStocktaking.location,
                confirmedAt
              );

            if (
              updateResult.beforeStock ===
                updateResult.afterStock &&
              !updateResult.locationChanged
            ) {
              return;
            }

            updatedProducts.push(
              updateResult.product
            );

            const actualLocationBreakdownText =
              formatStocktakingLocationBreakdown(
                item
              );

            const beforeLocationText =
              formatStocktakingRegisteredBreakdown(
                updateResult.beforeLocationStocks
              );

            const afterLocationText =
              formatStocktakingRegisteredBreakdown(
                updateResult.afterLocationStocks
              );

            const memoParts = [
              `棚卸日：${currentStocktaking.stocktakingDate}`,
              `棚卸対象：${currentStocktaking.location}`,
              `開始時場所別：${beforeLocationText}`,
              `反映後場所別：${afterLocationText}`
            ];

            if (
              actualLocationBreakdownText !== ""
            ) {
              memoParts.push(
                `実在庫入力：${actualLocationBreakdownText}`
              );
            }

            if (item.bulkZeroApplied) {
              memoParts.push(
                "入力方法：一括0入力"
              );
            }

            if (item.memo !== "") {
              memoParts.push(
                item.memo
              );
            }

            movements.push({
              id:
                createStocktakingMovementId(
                  index
                ),
              dateTime: confirmedAt,
              internalCode:
                updateResult.product.internalCode,
              productCode:
                updateResult.product.productCode || "",
              productName:
                updateResult.product.productName || "",
              type: "棚卸調整",
              quantity:
                updateResult.afterStock -
                updateResult.beforeStock,
              beforeStock:
                updateResult.beforeStock,
              afterStock:
                updateResult.afterStock,
              person:
                currentStocktaking.person,
              reason: "棚卸調整",
              memo:
                memoParts.join(" / "),
              stocktakingLocation:
                currentStocktaking.location,
              locationChanges:
                createStocktakingMovementLocationChanges(
                  updateResult.beforeLocationStocks,
                  updateResult.afterLocationStocks
                )
            });

            return;
          }

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

          if (item.bulkZeroApplied) {
            memoParts.push(
              "入力方法：一括0入力"
            );
          }

          if (item.memo !== "") {
            memoParts.push(
              item.memo
            );
          }

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
            memo:
              memoParts.join(" / "),
            stocktakingLocation:
              currentStocktaking.location
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

    currentStocktaking =
      completedStocktaking;

    stocktakingHasUnsavedChanges =
      false;

    showCompletedStocktakingScreen(
      completedStocktaking,
      reflectToInventory
    );
  } catch (error) {
    console.error(error);

    showStocktakingNotice(
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
    showStocktakingNotice(
      "取り消す棚卸が見つかりません。"
    );

    return;
  }

  const isConfirmed =
    await showStocktakingConfirm(
      "入力した実在庫も削除されます。\n" +
      "この操作は元に戻せません。",
      {
        title: "この棚卸を取り消しますか？",
        type: "danger",
        icon: "🗑️",
        confirmText: "棚卸を取り消す",
        cancelText: "キャンセル"
      }
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

    showStocktakingNotice(
      "棚卸を取り消しました。"
    );

    returnHomeFromStocktakingActive();
  } catch (error) {
    console.error(error);

    showStocktakingNotice(
      "棚卸を取り消せませんでした。"
    );
  }
}

function getCompletedStocktakingCounts(
  stocktaking
) {
  const items =
    stocktaking &&
    Array.isArray(stocktaking.items)
      ? stocktaking.items
      : [];

  return items.reduce(
    function (counts, item) {
      counts.target += 1;

      if (item.result === "差異なし") {
        counts.match += 1;
      } else if (
        item.result === "在庫不足"
      ) {
        counts.shortage += 1;
      } else if (
        item.result === "在庫過剰"
      ) {
        counts.surplus += 1;
      }

      return counts;
    },
    {
      target: 0,
      match: 0,
      shortage: 0,
      surplus: 0
    }
  );
}

function showCompletedStocktakingScreen(
  completedStocktaking,
  reflectedToInventory
) {
  lastCompletedStocktaking =
    completedStocktaking;

  const counts =
    getCompletedStocktakingCounts(
      completedStocktaking
    );

  const setText =
    function (selector, text) {
      const element =
        document.querySelector(
          selector
        );

      if (element) {
        element.textContent =
          text;
      }
    };

  setText(
    "#stocktaking-complete-date",
    completedStocktaking
      .stocktakingDate || "-"
  );

  setText(
    "#stocktaking-complete-person",
    completedStocktaking
      .person || "-"
  );

  setText(
    "#stocktaking-complete-location",
    completedStocktaking
      .location || "-"
  );

  setText(
    "#stocktaking-complete-target",
    `${counts.target}件`
  );

  setText(
    "#stocktaking-complete-match",
    `${counts.match}件`
  );

  setText(
    "#stocktaking-complete-shortage",
    `${counts.shortage}件`
  );

  setText(
    "#stocktaking-complete-surplus",
    `${counts.surplus}件`
  );

  const successBox =
    stocktakingCompleteScreen
      ?.querySelector(
        ".stocktaking-complete-success p"
      );

  if (successBox) {
    successBox.textContent =
      reflectedToInventory
        ? "棚卸を確定し、実在庫を現在庫へ反映しました。棚卸結果をCSVで送信または保存できます。"
        : "棚卸を確定しました。現在庫は変更していません。棚卸結果をCSVで送信または保存できます。";
  }

  const shareMessage =
    document.querySelector(
      "#stocktaking-share-message"
    );

  if (shareMessage) {
    shareMessage.textContent =
      "";
  }

  const managerEmailInput =
    document.querySelector(
      "#stocktaking-manager-email"
    );

  if (managerEmailInput) {
    managerEmailInput.value =
      getStocktakingManagerEmail();
  }

  hideAllMainScreensForStocktaking();

  stocktakingCompleteScreen.hidden =
    false;

  stocktakingCompleteScreen.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

function buildCompletedStocktakingCsvRows(
  stocktaking
) {
  const rows = [
    [
      "棚卸日",
      "社内コード",
      "JANコード",
      "商品コード",
      "商品名",
      "登録在庫",
      "実在庫",
      "差異",
      "保管場所",
      "担当者",
      "結果",
      "メモ"
    ]
  ];

  const items =
    stocktaking &&
    Array.isArray(stocktaking.items)
      ? stocktaking.items
      : [];

  items.forEach(
    function (item) {
      const actualStock =
        item.actualStock === ""
          ? ""
          : getValidStocktakingNumber(
              item.actualStock
            );

      const difference =
        item.difference === null ||
        item.difference === undefined
          ? ""
          : Number(item.difference);

      const locationBreakdown =
        formatStocktakingLocationBreakdown(
          item
        );

      rows.push([
        stocktaking.stocktakingDate || "",
        item.internalCode || "",
        item.janCode || "",
        item.productCode || "",
        item.productName || "",
        getValidStocktakingNumber(
          item.registeredStock
        ),
        actualStock,
        difference,
        locationBreakdown ||
          item.location ||
          stocktaking.location ||
          "",
        stocktaking.person || "",
        item.result ||
          getStocktakingResult(
            difference === ""
              ? null
              : difference
          ),
        item.memo || ""
      ]);
    }
  );

  return rows;
}

function escapeCompletedStocktakingCsvValue(
  value
) {
  const text =
    String(value ?? "");

  if (
    /[",\r\n]/.test(text)
  ) {
    return (
      '"' +
      text.replaceAll(
        '"',
        '""'
      ) +
      '"'
    );
  }

  return text;
}

function buildCompletedStocktakingCsvText(
  stocktaking
) {
  return (
    "\uFEFF" +
    buildCompletedStocktakingCsvRows(
      stocktaking
    )
      .map(
        function (row) {
          return row
            .map(
              escapeCompletedStocktakingCsvValue
            )
            .join(",");
        }
      )
      .join("\r\n")
  );
}

function sanitizeCompletedStocktakingFilePart(
  value
) {
  return String(value || "")
    .normalize("NFKC")
    .trim()
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/\s+/g, "")
    .slice(0, 30);
}

function getCompletedStocktakingCsvFileName(
  stocktaking
) {
  const date =
    sanitizeCompletedStocktakingFilePart(
      stocktaking.stocktakingDate ||
      new Date()
        .toISOString()
        .slice(0, 10)
    );

  const location =
    sanitizeCompletedStocktakingFilePart(
      stocktaking.location ||
      "全保管場所"
    );

  return (
    `棚卸結果_${date}_${location}.csv`
  );
}

function createCompletedStocktakingCsvFile(
  stocktaking,
  shareMode
) {
  return new File(
    [
      buildCompletedStocktakingCsvText(
        stocktaking
      )
    ],
    getCompletedStocktakingCsvFileName(
      stocktaking
    ),
    {
      type:
        shareMode
          ? "text/plain"
          : "text/csv"
    }
  );
}

function downloadCompletedStocktakingCsv(
  stocktaking
) {
  const csvText =
    buildCompletedStocktakingCsvText(
      stocktaking
    );

  const blob =
    new Blob(
      [csvText],
      {
        type:
          "text/csv"
      }
    );

  const url =
    URL.createObjectURL(blob);

  const link =
    document.createElement("a");

  link.href = url;
  link.download =
    getCompletedStocktakingCsvFileName(
      stocktaking
    );

  document.body.appendChild(
    link
  );

  link.click();
  link.remove();

  URL.revokeObjectURL(url);

  const message =
    document.querySelector(
      "#stocktaking-share-message"
    );

  if (message) {
    message.textContent =
      "棚卸結果CSVを保存しました。";
  }
}

const STOCKTAKING_MANAGER_EMAIL_KEY =
  "stocktakingManagerEmail";

function getStocktakingManagerEmail() {
  try {
    return (
      localStorage.getItem(
        STOCKTAKING_MANAGER_EMAIL_KEY
      ) || ""
    );
  } catch (error) {
    console.warn(
      "管理者メールアドレスを読み込めませんでした。",
      error
    );

    return "";
  }
}

function saveStocktakingManagerEmail(
  value
) {
  const email =
    String(value || "")
      .trim();

  try {
    if (email) {
      localStorage.setItem(
        STOCKTAKING_MANAGER_EMAIL_KEY,
        email
      );
    } else {
      localStorage.removeItem(
        STOCKTAKING_MANAGER_EMAIL_KEY
      );
    }
  } catch (error) {
    console.warn(
      "管理者メールアドレスを保存できませんでした。",
      error
    );
  }
}

function isValidStocktakingEmail(
  value
) {
  const email =
    String(value || "")
      .trim();

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    email
  );
}

function buildCompletedStocktakingMailSubject(
  stocktaking
) {
  return (
    `棚卸結果 ` +
    `${stocktaking.stocktakingDate || ""} ` +
    `${stocktaking.location || ""}`
  ).trim();
}

function buildCompletedStocktakingMailBody(
  stocktaking
) {
  const counts =
    getCompletedStocktakingCounts(
      stocktaking
    );

  const lines = [
    "棚卸結果を送付します。",
    "",
    `棚卸日：${stocktaking.stocktakingDate || ""}`,
    `担当者：${stocktaking.person || ""}`,
    `棚卸場所：${stocktaking.location || ""}`,
    `対象商品：${counts.target}件`,
    `差異なし：${counts.match}件`,
    `在庫不足：${counts.shortage}件`,
    `在庫過剰：${counts.surplus}件`,
    "",
    "棚卸結果CSVを添付して送信してください。",
    `ファイル名：${getCompletedStocktakingCsvFileName(stocktaking)}`
  ];

  return lines.join("\\n");
}

async function handleEmailCompletedStocktaking() {
  if (!lastCompletedStocktaking) {
    return;
  }

  const emailInput =
    document.querySelector(
      "#stocktaking-manager-email"
    );

  const managerEmail =
    emailInput
      ? emailInput.value.trim()
      : "";

  const message =
    document.querySelector(
      "#stocktaking-share-message"
    );

  if (!managerEmail) {
    await showStocktakingNotice(
      "管理者メールアドレスを入力してください。",
      {
        title:
          "メールアドレスが未入力です",
        type: "warning",
        icon: "✉️",
        confirmText: "閉じる"
      }
    );

    emailInput?.focus();
    return;
  }

  if (
    !isValidStocktakingEmail(
      managerEmail
    )
  ) {
    await showStocktakingNotice(
      "管理者メールアドレスの形式を確認してください。",
      {
        title:
          "メールアドレスを確認してください",
        type: "warning",
        icon: "✉️",
        confirmText: "閉じる"
      }
    );

    emailInput?.focus();
    return;
  }

  saveStocktakingManagerEmail(
    managerEmail
  );

  // mailto ではCSVを自動添付できないため、
  // 先にCSVを端末へ保存してからメール作成画面を開く。
  downloadCompletedStocktakingCsv(
    lastCompletedStocktaking
  );

  const subject =
    buildCompletedStocktakingMailSubject(
      lastCompletedStocktaking
    );

  const body =
    buildCompletedStocktakingMailBody(
      lastCompletedStocktaking
    );

  const mailto =
    `mailto:${encodeURIComponent(
      managerEmail
    )}` +
    `?subject=${encodeURIComponent(
      subject
    )}` +
    `&body=${encodeURIComponent(
      body
    )}`;

  if (message) {
    message.textContent =
      "棚卸結果CSVを保存しました。メール作成画面でCSVを添付して送信してください。";
  }

  window.location.href =
    mailto;
}

async function handleShareCompletedStocktaking() {
  if (!lastCompletedStocktaking) {
    return;
  }

  const message =
    document.querySelector(
      "#stocktaking-share-message"
    );

  if (message) {
    message.textContent =
      "";
  }

  const file =
    createCompletedStocktakingCsvFile(
      lastCompletedStocktaking,
      true
    );

  const shareData = {
    files: [file]
  };

  const fileShareSupported =
    typeof navigator.share ===
      "function" &&
    (
      typeof navigator.canShare !==
        "function" ||
      navigator.canShare(
        shareData
      )
    );

  if (!fileShareSupported) {
    downloadCompletedStocktakingCsv(
      lastCompletedStocktaking
    );

    await showStocktakingNotice(
      "この端末ではCSVファイルを直接共有できないため、棚卸結果CSVを保存しました。\n\nメールなどを開き、保存したCSVを添付して送信してください。",
      {
        title:
          "CSVを保存しました",
        type: "info",
        icon: "📤",
        confirmText: "閉じる"
      }
    );

    return;
  }

  try {
    await navigator.share(
      shareData
    );

    if (message) {
      message.textContent =
        "棚卸結果の共有画面を開きました。送信先を選んでください。";
    }
  } catch (error) {
    if (
      error &&
      error.name === "AbortError"
    ) {
      if (message) {
        message.textContent =
          "送信をキャンセルしました。棚卸結果は端末内に残っています。";
      }

      return;
    }

    console.error(
      "棚卸結果共有エラー",
      error
    );

    downloadCompletedStocktakingCsv(
      lastCompletedStocktaking
    );

    await showStocktakingNotice(
      "共有画面を開けなかったため、棚卸結果CSVを保存しました。\n\nメールなどを開き、保存したCSVを添付して送信してください。",
      {
        title:
          "送信できませんでした",
        type: "warning",
        icon: "📤",
        confirmText: "閉じる"
      }
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

function scrollStocktakingScreenIntoView(
  screen,
  focusElement
) {
  if (!screen || screen.hidden) {
    return;
  }

  window.requestAnimationFrame(
    function () {
      window.requestAnimationFrame(
        function () {
          if (!screen || screen.hidden) {
            return;
          }

          const header =
            document.querySelector(
              "header"
            );

          const headerOffset =
            header
              ? header.getBoundingClientRect()
                  .height + 8
              : 8;

          const targetTop = Math.max(
            0,
            window.scrollY +
              screen.getBoundingClientRect()
                .top -
              headerOffset
          );

          window.scrollTo({
            top: targetTop,
            behavior: "smooth"
          });

          if (
            focusElement &&
            typeof focusElement.focus ===
              "function"
          ) {
            window.setTimeout(
              function () {
                try {
                  focusElement.focus({
                    preventScroll: true
                  });
                } catch (error) {
                  focusElement.focus();
                }
              },
              350
            );
          }
        }
      );
    }
  );
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
    showStocktakingNotice(
      "進行中の棚卸が見つかりません。"
    );

    return;
  }

  if (
    !window.barcodeScanner ||
    typeof window.barcodeScanner.openForStocktaking !==
      "function"
  ) {
    showStocktakingNotice(
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
      reason: "invalid",
      message:
        "バーコード番号を確認できませんでした。",
      manualMessage:
        "バーコード番号を読み取れなかったため、手入力検索へ切り替えました。商品名・社内コード・商品コード・JANコードで検索してください。"
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
      reason: "not-found",
      message:
        "このバーコードの商品は、今回の棚卸対象にありません。\n\n" +
        "JANコード・社内コード・保管場所を確認してください。",
      manualMessage:
        "棚卸対象の商品を自動で特定できなかったため、手入力検索へ切り替えました。商品名・社内コード・商品コード・JANコードで検索してください。"
    };
  }

  if (matchingItems.length > 1) {
    const duplicateManualMessage =
      matchedCodeType === "JANコード"
        ? "同じJANコードが複数の商品に登録されています。商品名・社内コード・商品コードを手入力して商品を選んでください。"
        : `同じ${matchedCodeType}の商品が複数あります。商品名・商品コードなどを手入力して商品を選んでください。`;

    return {
      success: false,
      reason: "duplicate",
      message:
        `同じ${matchedCodeType}の商品が棚卸対象に複数あります。\n\n` +
        "自動で1商品に決められないため、手入力で商品を選んでください。",
      manualMessage:
        duplicateManualMessage
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
  focusSearch,
  manualMessage
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
      manualMessage ||
      "JANコード・商品名・社内コード・商品コードを入力してください。";

    window.setTimeout(
      function () {
        stocktakingProductSearchInput.focus();
      },
      100
    );
  }

  scrollStocktakingScreenIntoView(
    stocktakingActiveScreen,
    focusSearch
      ? stocktakingProductSearchInput
      : null
  );
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

/* =========================================================
   v23 棚卸中：折りたたみ・ページ切替・固定移動メニュー
   ========================================================= */
let stocktakingListCurrentPage = 1;
let stocktakingListPageSize = 20;
let stocktakingListLastFilterSignature = "";
let stocktakingListLastFilteredCount = 0;
let stocktakingInfoDetails = null;
let stocktakingItemsDetails = null;
let stocktakingActionsDetails = null;
let stocktakingPageSizeSelect = null;
let stocktakingPagerStatusElements = [];
let stocktakingPreviousButtons = [];
let stocktakingNextButtons = [];
let stocktakingFirstButtons = [];
let stocktakingLastButtons = [];

window.addEventListener(
  "DOMContentLoaded",
  function () {
    window.setTimeout(
      createStocktakingUsabilityControls,
      0
    );
  }
);

function createStocktakingUsabilityControls() {
  if (
    !stocktakingActiveScreen ||
    document.querySelector(
      "#stocktaking-sticky-navigation"
    )
  ) {
    return;
  }

  const title =
    stocktakingActiveScreen.querySelector(
      "h2"
    );

  const navigation =
    createStocktakingStickyNavigation();

  title.insertAdjacentElement(
    "afterend",
    navigation
  );

  stocktakingInfoDetails =
    createStocktakingDetailsSection(
      "stocktaking-info-details",
      "1. 棚卸情報・検索"
    );

  navigation.insertAdjacentElement(
    "afterend",
    stocktakingInfoDetails
  );

  [
    stocktakingActiveScreen.querySelector(
      ".stocktaking-notice"
    ),
    stocktakingActiveScreen.querySelector(
      ".stocktaking-info-table"
    ),
    stocktakingActiveScreen.querySelector(
      ".stocktaking-summary"
    ),
    stocktakingActiveScreen.querySelector(
      ".stocktaking-search-area"
    ),
    stocktakingCameraScanButton,
    stocktakingActiveScreen.querySelector(
      ".stocktaking-bulk-zero-area"
    )
  ].forEach(function (element) {
    if (element) {
      stocktakingInfoDetails.appendChild(
        element
      );
    }
  });

  addStocktakingPageSizeControl();

  stocktakingItemsDetails =
    createStocktakingDetailsSection(
      "stocktaking-items-details",
      "2. 棚卸商品一覧"
    );

  stocktakingInfoDetails.insertAdjacentElement(
    "afterend",
    stocktakingItemsDetails
  );

  const tableArea =
    stocktakingActiveScreen.querySelector(
      ".stocktaking-table-area"
    );

  stocktakingItemsDetails.appendChild(
    createStocktakingPager("top")
  );

  stocktakingItemsDetails.appendChild(
    tableArea
  );

  stocktakingItemsDetails.appendChild(
    createStocktakingPager("bottom")
  );

  stocktakingActionsDetails =
    createStocktakingDetailsSection(
      "stocktaking-actions-details",
      "3. 保存・確定"
    );

  stocktakingItemsDetails.insertAdjacentElement(
    "afterend",
    stocktakingActionsDetails
  );

  [
    stocktakingSaveMessage,
    stocktakingActiveScreen.querySelector(
      ".stocktaking-reflect-area"
    ),
    saveStocktakingItemsButton,
    confirmStocktakingButton,
    backHomeFromStocktakingButton,
    deleteStocktakingButton
  ].forEach(function (element) {
    if (element) {
      stocktakingActionsDetails.appendChild(
        element
      );
    }
  });

  stocktakingActiveScreen.appendChild(
    createStocktakingStickyActionBar()
  );

  createStocktakingUsabilityStyle();
  updateStocktakingMobileFocusMode();
  filterStocktakingItems();
}

function createStocktakingDetailsSection(
  id,
  title
) {
  const details =
    document.createElement("details");

  details.id = id;
  details.open = true;

  const summary =
    document.createElement("summary");

  summary.textContent = title;

  details.appendChild(summary);

  return details;
}

function createStocktakingStickyNavigation() {
  const navigation =
    document.createElement("nav");

  navigation.id =
    "stocktaking-sticky-navigation";

  navigation.setAttribute(
    "aria-label",
    "棚卸中の画面移動"
  );

  const buttonDataList = [
    {
      text: "情報・検索",
      action: function () {
        openAndScrollStocktakingDetails(
          stocktakingInfoDetails
        );
      }
    },
    {
      text: "商品一覧",
      action: function () {
        openAndScrollStocktakingDetails(
          stocktakingItemsDetails
        );
      }
    },
    {
      text: "保存・確定",
      action: function () {
        openAndScrollStocktakingDetails(
          stocktakingActionsDetails
        );
      }
    },
    {
      text: "前へ",
      pageAction: "previous"
    },
    {
      text: "次へ",
      pageAction: "next"
    },
    {
      text: "一番上へ",
      action: function () {
        window.scrollTo({
          top: 0,
          behavior: "smooth"
        });
      }
    }
  ];

  buttonDataList.forEach(
    function (buttonData) {
      const button =
        document.createElement("button");

      button.type = "button";
      button.textContent =
        buttonData.text;

      if (buttonData.pageAction) {
        addStocktakingPageButton(
          button,
          buttonData.pageAction
        );
      } else {
        button.addEventListener(
          "click",
          buttonData.action
        );
      }

      navigation.appendChild(button);
    }
  );

  return navigation;
}

function addStocktakingPageSizeControl() {
  const searchArea =
    stocktakingActiveScreen.querySelector(
      ".stocktaking-search-area"
    );

  if (!searchArea) {
    return;
  }

  const area =
    document.createElement("div");

  area.classList.add(
    "stocktaking-page-size-area"
  );

  const label =
    document.createElement("label");

  label.htmlFor =
    "stocktaking-page-size";

  label.textContent =
    "1ページの表示件数";

  stocktakingPageSizeSelect =
    document.createElement("select");

  stocktakingPageSizeSelect.id =
    "stocktaking-page-size";

  stocktakingPageSizeSelect.innerHTML = `
    <option value="20">20件</option>
    <option value="50">50件</option>
    <option value="100">100件</option>
  `;

  area.appendChild(label);
  area.appendChild(
    stocktakingPageSizeSelect
  );

  const message =
    stocktakingSearchMessage;

  searchArea.insertBefore(
    area,
    message
  );

  stocktakingPageSizeSelect.addEventListener(
    "change",
    function () {
      stocktakingListPageSize =
        Number(
          stocktakingPageSizeSelect.value
        ) || 20;

      stocktakingListCurrentPage = 1;
      filterStocktakingItems();
    }
  );
}

function createStocktakingPager(position) {
  const pager =
    document.createElement("div");

  pager.classList.add(
    "stocktaking-list-pager",
    `stocktaking-list-pager-${position}`
  );

  const firstButton =
    createStocktakingPageButton(
      "最初",
      "first"
    );

  const previousButton =
    createStocktakingPageButton(
      "前へ",
      "previous"
    );

  const status =
    document.createElement("strong");

  status.classList.add(
    "stocktaking-list-page-status"
  );

  stocktakingPagerStatusElements.push(
    status
  );

  const nextButton =
    createStocktakingPageButton(
      "次へ",
      "next"
    );

  const lastButton =
    createStocktakingPageButton(
      "最後",
      "last"
    );

  pager.appendChild(firstButton);
  pager.appendChild(previousButton);
  pager.appendChild(status);
  pager.appendChild(nextButton);
  pager.appendChild(lastButton);

  return pager;
}

function createStocktakingPageButton(
  text,
  action
) {
  const button =
    document.createElement("button");

  button.type = "button";
  button.textContent = text;

  addStocktakingPageButton(
    button,
    action
  );

  return button;
}

function addStocktakingPageButton(
  button,
  action
) {
  button.dataset.pageAction = action;

  if (action === "first") {
    stocktakingFirstButtons.push(button);
  } else if (action === "previous") {
    stocktakingPreviousButtons.push(button);
  } else if (action === "next") {
    stocktakingNextButtons.push(button);
  } else if (action === "last") {
    stocktakingLastButtons.push(button);
  }

  button.addEventListener(
    "click",
    function () {
      const totalPages = Math.max(
        1,
        Math.ceil(
          stocktakingListLastFilteredCount /
          stocktakingListPageSize
        )
      );

      if (action === "first") {
        stocktakingListCurrentPage = 1;
      } else if (action === "previous") {
        stocktakingListCurrentPage =
          Math.max(
            1,
            stocktakingListCurrentPage - 1
          );
      } else if (action === "next") {
        stocktakingListCurrentPage =
          Math.min(
            totalPages,
            stocktakingListCurrentPage + 1
          );
      } else if (action === "last") {
        stocktakingListCurrentPage =
          totalPages;
      }

      filterStocktakingItems();
      openAndScrollStocktakingDetails(
        stocktakingItemsDetails
      );
    }
  );
}

function openAndScrollStocktakingDetails(
  detailsElement
) {
  if (!detailsElement) {
    return;
  }

  detailsElement.open = true;

  window.setTimeout(
    function () {
      detailsElement.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    },
    30
  );
}

function createStocktakingStickyActionBar() {
  const bar =
    document.createElement("div");

  bar.id =
    "stocktaking-sticky-action-bar";

  const saveProxy =
    document.createElement("button");

  saveProxy.type = "button";
  saveProxy.textContent =
    "入力内容を保存";

  saveProxy.addEventListener(
    "click",
    function () {
      saveStocktakingItemsButton.click();
    }
  );

  const confirmProxy =
    document.createElement("button");

  confirmProxy.type = "button";
  confirmProxy.textContent =
    "棚卸を確認・確定";

  confirmProxy.addEventListener(
    "click",
    function () {
      confirmStocktakingButton.click();
    }
  );

  bar.appendChild(saveProxy);
  bar.appendChild(confirmProxy);

  return bar;
}

function filterStocktakingItems() {
  if (
    !stocktakingItemsBody ||
    !currentStocktaking
  ) {
    return;
  }

  const keyword =
    normalizeStocktakingText(
      stocktakingProductSearchInput.value
    );

  const filterType =
    stocktakingDisplayFilter
      ? stocktakingDisplayFilter.value
      : "all";

  const signature = [
    keyword,
    filterType,
    stocktakingListPageSize
  ].join("|");

  if (
    stocktakingListLastFilterSignature !== "" &&
    signature !==
      stocktakingListLastFilterSignature
  ) {
    stocktakingListCurrentPage = 1;
  }

  stocktakingListLastFilterSignature =
    signature;

  const rows = Array.from(
    stocktakingItemsBody.querySelectorAll(
      "tr[data-internal-code]"
    )
  );

  const mobileFocusMode =
    isMobileStocktakingFocusMode();

  const waitForProduct =
    mobileFocusMode &&
    keyword === "";

  const matchedRows =
    waitForProduct
      ? []
      : rows.filter(
          function (row) {
            const keywordMatches =
              keyword === "" ||
              row.dataset.searchText.includes(
                keyword
              );

            const item =
              currentStocktaking.items.find(
                function (currentItem) {
                  return (
                    currentItem.internalCode ===
                    row.dataset.internalCode
                  );
                }
              );

            let filterMatches = true;

            if (filterType === "unchecked") {
              filterMatches =
                Boolean(item) &&
                item.actualStock === "";
            } else if (
              filterType === "bulk-zero"
            ) {
              filterMatches =
                Boolean(item) &&
                item.bulkZeroApplied === true;
            }

            return (
              keywordMatches &&
              filterMatches
            );
          }
        );

  stocktakingListLastFilteredCount =
    matchedRows.length;

  const totalPages = Math.max(
    1,
    Math.ceil(
      matchedRows.length /
      stocktakingListPageSize
    )
  );

  stocktakingListCurrentPage = Math.min(
    Math.max(
      1,
      stocktakingListCurrentPage
    ),
    totalPages
  );

  const startIndex =
    (stocktakingListCurrentPage - 1) *
    stocktakingListPageSize;

  const pageRows = new Set(
    matchedRows.slice(
      startIndex,
      startIndex + stocktakingListPageSize
    )
  );

  rows.forEach(function (row) {
    const visible = pageRows.has(row);

    row.hidden = !visible;

    if (visible) {
      row.style.removeProperty("display");
    } else {
      row.style.display = "none";
    }
  });

  let filterLabel =
    "すべての商品";

  if (filterType === "unchecked") {
    filterLabel =
      "未確認の商品";
  } else if (
    filterType === "bulk-zero"
  ) {
    filterLabel =
      "一括0入力の商品";
  }

  const pageCount = pageRows.size;

  const rangeText =
    matchedRows.length === 0
      ? "0件"
      : `${startIndex + 1}～${startIndex + pageCount}件を表示`;

  if (waitForProduct) {
    stocktakingSearchMessage.textContent =
      "バーコードを読み取るか、商品名・社内コード・商品コード・JANコードを入力してください。";
  } else if (keyword === "") {
    stocktakingSearchMessage.textContent =
      `${filterLabel}：${matchedRows.length}件（${rangeText}）`;
  } else {
    stocktakingSearchMessage.textContent =
      `「${stocktakingProductSearchInput.value.trim()}」の検索結果：${matchedRows.length}件（${filterLabel}・${rangeText}）`;
  }

  updateStocktakingListPager(
    matchedRows.length,
    totalPages,
    startIndex,
    pageCount
  );
}

function updateStocktakingListPager(
  totalCount,
  totalPages,
  startIndex,
  pageCount
) {
  const rangeText =
    totalCount === 0
      ? "0件"
      : `${startIndex + 1}～${startIndex + pageCount}件 / ${totalCount}件`;

  const statusText =
    `${rangeText}　${stocktakingListCurrentPage} / ${totalPages}ページ`;

  stocktakingPagerStatusElements.forEach(
    function (element) {
      element.textContent = statusText;
    }
  );

  const isFirstPage =
    stocktakingListCurrentPage <= 1;

  const isLastPage =
    stocktakingListCurrentPage >=
    totalPages;

  stocktakingFirstButtons.forEach(
    function (button) {
      button.disabled = isFirstPage;
    }
  );

  stocktakingPreviousButtons.forEach(
    function (button) {
      button.disabled = isFirstPage;
    }
  );

  stocktakingNextButtons.forEach(
    function (button) {
      button.disabled = isLastPage;
    }
  );

  stocktakingLastButtons.forEach(
    function (button) {
      button.disabled = isLastPage;
    }
  );
}

function focusFirstUncheckedItem() {
  const uncheckedItem =
    currentStocktaking.items.find(
      function (item) {
        return item.actualStock === "";
      }
    );

  if (!uncheckedItem) {
    return;
  }

  stocktakingProductSearchInput.value =
    uncheckedItem.internalCode;

  stocktakingDisplayFilter.value =
    "unchecked";

  stocktakingListCurrentPage = 1;
  filterStocktakingItems();

  openAndScrollStocktakingDetails(
    stocktakingItemsDetails
  );

  window.setTimeout(
    function () {
      focusStocktakingActualInput(
        uncheckedItem.internalCode
      );
    },
    120
  );
}

function createStocktakingUsabilityStyle() {
  if (
    document.querySelector(
      "#stocktaking-usability-style"
    )
  ) {
    return;
  }

  const styleElement =
    document.createElement("style");

  styleElement.id =
    "stocktaking-usability-style";

  styleElement.textContent = `
    #stocktaking-sticky-navigation {
      position: sticky;
      top: 0;
      z-index: 45;
      display: flex;
      gap: 8px;
      width: 100%;
      margin: 12px 0;
      padding: 9px;
      overflow-x: auto;
      border: 1px solid #b39ddb;
      border-radius: 12px;
      background-color: rgba(255, 255, 255, 0.97);
      box-shadow: 0 3px 12px rgba(38, 50, 56, 0.16);
      box-sizing: border-box;
    }

    #stocktaking-sticky-navigation button {
      flex: 0 0 auto;
      margin: 0;
      padding: 10px 13px;
      font-size: 15px;
    }

    #stocktaking-info-details,
    #stocktaking-items-details,
    #stocktaking-actions-details {
      margin: 16px 0;
      border: 2px solid #b39ddb;
      border-radius: 12px;
      background-color: #ffffff;
      overflow: clip;
      scroll-margin-top: 82px;
    }

    #stocktaking-info-details > summary,
    #stocktaking-items-details > summary,
    #stocktaking-actions-details > summary {
      padding: 14px 16px;
      background-color: #ede7f6;
      color: #4a148c;
      font-size: 19px;
      font-weight: 800;
      cursor: pointer;
    }

    #stocktaking-info-details > :not(summary),
    #stocktaking-actions-details > :not(summary) {
      margin-left: 14px;
      margin-right: 14px;
      width: calc(100% - 28px);
      box-sizing: border-box;
    }

    #stocktaking-items-details .stocktaking-table-area {
      padding-left: 12px;
      padding-right: 12px;
      box-sizing: border-box;
    }

    .stocktaking-page-size-area {
      margin: 14px 0;
      padding: 12px;
      border: 1px solid #b39ddb;
      border-radius: 9px;
      background-color: #faf5fc;
    }

    .stocktaking-page-size-area label {
      display: block;
      margin-bottom: 7px;
      font-weight: 700;
    }

    #stocktaking-page-size {
      width: 100%;
      max-width: 280px;
      min-height: 46px;
      margin: 0;
      font-size: 16px;
    }

    .stocktaking-list-pager {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 12px;
      background-color: #faf5fc;
    }

    .stocktaking-list-pager button {
      margin: 0;
      padding: 9px 13px;
      font-size: 15px;
    }

    .stocktaking-list-page-status {
      min-width: 230px;
      text-align: center;
    }

    #stocktaking-actions-details > button {
      margin-top: 6px;
      margin-bottom: 6px;
    }

    #stocktaking-actions-details > button:last-child {
      margin-bottom: 14px;
    }

    #stocktaking-sticky-action-bar {
      position: sticky;
      bottom: 0;
      z-index: 44;
      display: grid;
      grid-template-columns:
        repeat(2, minmax(0, 1fr));
      gap: 8px;
      width: 100%;
      margin-top: 14px;
      padding: 9px;
      border: 1px solid #b39ddb;
      border-radius: 12px 12px 0 0;
      background-color: rgba(255, 255, 255, 0.97);
      box-shadow: 0 -3px 12px rgba(38, 50, 56, 0.14);
      box-sizing: border-box;
    }

    #stocktaking-sticky-action-bar button {
      width: 100%;
      margin: 0;
      padding: 12px 8px;
      font-size: 16px;
    }

    #stocktaking-sticky-action-bar button:first-child {
      background-color: #2e7d32;
    }

    #stocktaking-sticky-action-bar button:last-child {
      background-color: #1565c0;
    }

    @media (max-width: 700px) {
      #stocktaking-sticky-navigation,
      #stocktaking-info-details,
      #stocktaking-items-details,
      #stocktaking-actions-details,
      #stocktaking-sticky-action-bar {
        margin-left: 12px;
        margin-right: 12px;
        width: calc(100% - 24px);
      }

      #stocktaking-info-details > :not(summary),
      #stocktaking-actions-details > :not(summary) {
        margin-left: 10px;
        margin-right: 10px;
        width: calc(100% - 20px);
      }

      .stocktaking-list-pager {
        display: grid;
        grid-template-columns:
          repeat(4, minmax(0, 1fr));
      }

      .stocktaking-list-page-status {
        grid-column: 1 / -1;
        grid-row: 1;
        min-width: 0;
      }

      .stocktaking-list-pager button {
        width: 100%;
        padding: 10px 4px;
        font-size: 14px;
      }

      #stocktaking-actions-details > button {
        width: calc(100% - 20px);
      }

      #stocktaking-sticky-action-bar button {
        font-size: 14px;
      }
    }
  `;

  document.head.appendChild(
    styleElement
  );
}
