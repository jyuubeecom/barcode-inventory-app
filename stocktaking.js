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
let stocktakingItemsBody = null;
let stocktakingSaveMessage = null;

let saveStocktakingItemsButton = null;
let cancelStocktakingSetupButton = null;
let backHomeFromStocktakingButton = null;
let deleteStocktakingButton = null;

let currentStocktaking = null;
let stocktakingHasUnsavedChanges = false;

document.addEventListener(
  "DOMContentLoaded",
  initializeStocktaking
);

function initializeStocktaking() {
  createStocktakingStartButton();
  createStocktakingScreens();
  createStocktakingStyle();
}

function createStocktakingStartButton() {
  if (
    document.querySelector(
      "#show-stocktaking-button"
    )
  ) {
    stocktakingStartButton =
      document.querySelector(
        "#show-stocktaking-button"
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

  if (
    existingSetupScreen ||
    existingActiveScreen
  ) {
    existingSetupScreen?.remove();
    existingActiveScreen?.remove();
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
      商品を確認し、実際に数えた数量を入力してください。
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
          <th>保管場所</th>
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
            <th>実在庫</th>
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
      実在庫を入力したら「入力内容を保存する」を押してください。
    </p>

    <button
      id="save-stocktaking-items-button"
      type="button"
    >
      入力内容を保存する
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

    .stocktaking-items-table
    input[type="number"] {
      min-width: 100px;
    }

    .stocktaking-items-table
    input[type="text"] {
      min-width: 180px;
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

    #save-stocktaking-items-button {
      background-color: #2e7d32;
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

      .stocktaking-info-table th {
        width: 115px;
      }

      .stocktaking-summary {
        grid-template-columns:
          repeat(2, minmax(0, 1fr));
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
      "保管場所の入力内容を確認してください。"
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
          product.location || "未登録",
        registeredStock:
          getValidStocktakingNumber(
            product.stock
          ),
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
    "実在庫を入力したら「入力内容を保存する」を押してください。";

  stocktakingSaveMessage.classList.remove(
    "saved"
  );

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

  const actualStock =
    normalizeActualStockValue(
      item.actualStock
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
      item.checkedAt || ""
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
    item.internalCode
  );

  appendStocktakingTextCell(
    row,
    item.productCode || "未登録"
  );

  appendStocktakingTextCell(
    row,
    item.productName
  );

  appendStocktakingTextCell(
    row,
    item.location
  );

  appendStocktakingTextCell(
    row,
    item.registeredStock
  );

  const actualStockCell =
    document.createElement("td");

  const actualStockInput =
    document.createElement("input");

  actualStockInput.type =
    "number";

  actualStockInput.min = "0";
  actualStockInput.step = "1";

  actualStockInput.placeholder =
    "実在庫";

  actualStockInput.value =
    item.actualStock === ""
      ? ""
      : item.actualStock;

  actualStockInput.classList.add(
    "stocktaking-actual-input"
  );

  actualStockInput.dataset.internalCode =
    item.internalCode;

  actualStockCell.appendChild(
    actualStockInput
  );

  row.appendChild(
    actualStockCell
  );

  const differenceCell =
    document.createElement("td");

  differenceCell.classList.add(
    "stocktaking-difference"
  );

  row.appendChild(
    differenceCell
  );

  const memoCell =
    document.createElement("td");

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
    memoInput
  );

  row.appendChild(
    memoCell
  );

  actualStockInput.addEventListener(
    "input",
    function () {
      handleStocktakingActualInput(
        item,
        row,
        actualStockInput,
        differenceCell,
        resultBadge
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
  value
) {
  const cell =
    document.createElement("td");

  cell.textContent =
    value;

  row.appendChild(cell);
}

function handleStocktakingActualInput(
  item,
  row,
  actualStockInput,
  differenceCell,
  resultBadge
) {
  const enteredValue =
    actualStockInput.value.trim();

  if (enteredValue === "") {
    item.actualStock = "";
    item.difference = null;
    item.result = "未確認";
    item.checkedAt = "";
  } else {
    const actualStock =
      Number(enteredValue);

    if (
      Number.isInteger(
        actualStock
      ) &&
      actualStock >= 0
    ) {
      item.actualStock =
        actualStock;

      item.difference =
        actualStock -
        item.registeredStock;

      item.result =
        getStocktakingResult(
          item.difference
        );

      item.checkedAt =
        new Date().toISOString();
    } else {
      item.actualStock = "";
      item.difference = null;
      item.result = "未確認";
      item.checkedAt = "";
    }
  }

  updateStocktakingRowAppearance(
    item,
    row,
    differenceCell,
    resultBadge
  );

  updateStocktakingSummary();
  markStocktakingAsUnsaved();
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

function updateStocktakingSummary() {
  const items =
    currentStocktaking?.items || [];

  const targetCount =
    items.length;

  const checkedItems =
    items.filter(
      function (item) {
        return (
          item.actualStock !== ""
        );
      }
    );

  const checkedCount =
    checkedItems.length;

  const uncheckedCount =
    targetCount -
    checkedCount;

  const matchCount =
    checkedItems.filter(
      function (item) {
        return (
          item.result ===
          "差異なし"
        );
      }
    ).length;

  const shortageCount =
    checkedItems.filter(
      function (item) {
        return (
          item.result ===
          "在庫不足"
        );
      }
    ).length;

  const surplusCount =
    checkedItems.filter(
      function (item) {
        return (
          item.result ===
          "在庫過剰"
        );
      }
    ).length;

  stocktakingSummaryTarget.textContent =
    targetCount;

  stocktakingSummaryChecked.textContent =
    checkedCount;

  stocktakingSummaryUnchecked.textContent =
    uncheckedCount;

  stocktakingSummaryMatch.textContent =
    matchCount;

  stocktakingSummaryShortage.textContent =
    shortageCount;

  stocktakingSummarySurplus.textContent =
    surplusCount;
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

  const actualInputs =
    stocktakingItemsBody.querySelectorAll(
      ".stocktaking-actual-input"
    );

  for (
    const input of actualInputs
  ) {
    const enteredValue =
      input.value.trim();

    if (enteredValue === "") {
      continue;
    }

    const numberValue =
      Number(enteredValue);

    if (
      !Number.isInteger(
        numberValue
      ) ||
      numberValue < 0
    ) {
      alert(
        "実在庫は0以上の整数で入力してください。"
      );

      input.focus();
      return false;
    }
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