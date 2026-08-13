"use strict";

/* 入庫画面 */

const stockInFromDetailButton =
  document.querySelector(
    "#stock-in-from-detail-button"
  );

const stockInForm =
  document.querySelector("#stock-in-form");

const stockInInternalCodeInput =
  document.querySelector(
    "#stock-in-internal-code"
  );

const stockInProductNameInput =
  document.querySelector(
    "#stock-in-product-name"
  );

const stockInCurrentStockInput =
  document.querySelector(
    "#stock-in-current-stock"
  );

const stockInLocationSelect =
  document.querySelector(
    "#stock-in-location"
  );

const stockInLocationStockInput =
  document.querySelector(
    "#stock-in-location-stock"
  );

const stockInQuantityInput =
  document.querySelector(
    "#stock-in-quantity"
  );

const stockInAfterStockInput =
  document.querySelector(
    "#stock-in-after-stock"
  );

const stockInPersonInput =
  document.querySelector(
    "#stock-in-person"
  );

const stockInReasonInput =
  document.querySelector(
    "#stock-in-reason"
  );

const stockInMemoInput =
  document.querySelector(
    "#stock-in-memo"
  );

const cancelStockInButton =
  document.querySelector(
    "#cancel-stock-in-button"
  );

/* 出庫画面 */

const stockOutFromDetailButton =
  document.querySelector(
    "#stock-out-from-detail-button"
  );

const stockOutForm =
  document.querySelector("#stock-out-form");

const stockOutInternalCodeInput =
  document.querySelector(
    "#stock-out-internal-code"
  );

const stockOutProductNameInput =
  document.querySelector(
    "#stock-out-product-name"
  );

const stockOutCurrentStockInput =
  document.querySelector(
    "#stock-out-current-stock"
  );

const stockOutLocationSelect =
  document.querySelector(
    "#stock-out-location"
  );

const stockOutLocationStockInput =
  document.querySelector(
    "#stock-out-location-stock"
  );

const stockOutQuantityInput =
  document.querySelector(
    "#stock-out-quantity"
  );

const stockOutAfterStockInput =
  document.querySelector(
    "#stock-out-after-stock"
  );

const stockOutPersonInput =
  document.querySelector(
    "#stock-out-person"
  );

const stockOutReasonInput =
  document.querySelector(
    "#stock-out-reason"
  );

const stockOutMemoInput =
  document.querySelector(
    "#stock-out-memo"
  );

const cancelStockOutButton =
  document.querySelector(
    "#cancel-stock-out-button"
  );

/* 数量調整画面 */

const stockAdjustFromDetailButton =
  document.querySelector(
    "#stock-adjust-from-detail-button"
  );

const stockAdjustForm =
  document.querySelector(
    "#stock-adjust-form"
  );

const stockAdjustInternalCodeInput =
  document.querySelector(
    "#stock-adjust-internal-code"
  );

const stockAdjustProductNameInput =
  document.querySelector(
    "#stock-adjust-product-name"
  );

const stockAdjustCurrentStockInput =
  document.querySelector(
    "#stock-adjust-current-stock"
  );

const stockAdjustNewStockInput =
  document.querySelector(
    "#stock-adjust-new-stock"
  );

const stockAdjustDifferenceInput =
  document.querySelector(
    "#stock-adjust-difference"
  );

const stockAdjustPersonInput =
  document.querySelector(
    "#stock-adjust-person"
  );

const stockAdjustReasonInput =
  document.querySelector(
    "#stock-adjust-reason"
  );

const stockAdjustMemoInput =
  document.querySelector(
    "#stock-adjust-memo"
  );

const cancelStockAdjustButton =
  document.querySelector(
    "#cancel-stock-adjust-button"
  );

const INVENTORY_LOCATION_OPTIONS = Object.freeze([
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

let selectedStockInInternalCode = "";
let selectedStockOutInternalCode = "";
let selectedStockAdjustInternalCode = "";

function populateInventoryLocationSelect(selectElement, selectedLocation) {
  if (!selectElement) {
    return;
  }

  const normalizedSelected = normalizeLocationStockName(selectedLocation);
  selectElement.innerHTML = "";

  INVENTORY_LOCATION_OPTIONS.forEach(function (location) {
    const option = document.createElement("option");
    option.value = location;
    option.textContent = location;
    option.selected = location === normalizedSelected;
    selectElement.appendChild(option);
  });

  if (!selectElement.value && INVENTORY_LOCATION_OPTIONS.length > 0) {
    selectElement.value = INVENTORY_LOCATION_OPTIONS[0];
  }
}

function getInventoryLocationStock(product, location) {
  const normalizedLocation = normalizeLocationStockName(location);
  const entry = getProductLocationStocks(product).find(function (item) {
    return normalizeLocationStockName(item.location) === normalizedLocation;
  });

  return entry ? normalizeLocationStockQuantity(entry.stock) : 0;
}

function cloneInventoryLocationStocks(product) {
  return getProductLocationStocks(product).map(function (entry) {
    return {
      location: normalizeLocationStockName(entry.location),
      stock: normalizeLocationStockQuantity(entry.stock)
    };
  });
}

function sortInventoryLocationStocks(entries) {
  const order = new Map(
    INVENTORY_LOCATION_OPTIONS.map(function (location, index) {
      return [location, index];
    })
  );

  return entries.slice().sort(function (left, right) {
    const leftIndex = order.has(left.location) ? order.get(left.location) : 999;
    const rightIndex = order.has(right.location) ? order.get(right.location) : 999;
    return leftIndex - rightIndex;
  });
}

function chooseInventoryPrimaryLocation(product, entries, fallbackLocation) {
  const currentPrimary = normalizeLocationStockName(product && product.location);
  const currentEntry = entries.find(function (entry) {
    return entry.location === currentPrimary && entry.stock > 0;
  });

  if (currentEntry) {
    return currentEntry.location;
  }

  const nextEntry = sortInventoryLocationStocks(entries).find(function (entry) {
    return entry.stock > 0;
  });

  if (nextEntry) {
    return nextEntry.location;
  }

  return normalizeLocationStockName(fallbackLocation) || currentPrimary || "未確認";
}

document.addEventListener(
  "DOMContentLoaded",
  initializeInventory
);

function initializeInventory() {
  stockInFromDetailButton.addEventListener(
    "click",
    openStockInScreen
  );

  stockInQuantityInput.addEventListener(
    "input",
    updateStockInAfterStock
  );

  stockInLocationSelect.addEventListener(
    "change",
    updateStockInLocationDisplay
  );

  stockInForm.addEventListener(
    "submit",
    handleStockInSubmit
  );

  cancelStockInButton.addEventListener(
    "click",
    cancelStockIn
  );

  stockOutFromDetailButton.addEventListener(
    "click",
    openStockOutScreen
  );

  stockOutQuantityInput.addEventListener(
    "input",
    updateStockOutAfterStock
  );

  stockOutLocationSelect.addEventListener(
    "change",
    updateStockOutLocationDisplay
  );

  stockOutForm.addEventListener(
    "submit",
    handleStockOutSubmit
  );

  cancelStockOutButton.addEventListener(
    "click",
    cancelStockOut
  );

  stockAdjustFromDetailButton.addEventListener(
    "click",
    openStockAdjustScreen
  );

  stockAdjustNewStockInput.addEventListener(
    "input",
    updateStockAdjustDifference
  );

  stockAdjustForm.addEventListener(
    "submit",
    handleStockAdjustSubmit
  );

  cancelStockAdjustButton.addEventListener(
    "click",
    cancelStockAdjust
  );
}

/* 入庫処理 */

function openStockInScreen() {
  const internalCode =
    window.inventoryApp
      .getSelectedDetailInternalCode();

  const selectedProduct =
    window.inventoryApp
      .getProductByInternalCode(
        internalCode
      );

  if (!selectedProduct) {
    alert(
      "入庫する商品が見つかりませんでした。"
    );

    return;
  }

  selectedStockInInternalCode =
    selectedProduct.internalCode;

  stockInInternalCodeInput.value =
    selectedProduct.internalCode;

  stockInProductNameInput.value =
    selectedProduct.productName;

  stockInCurrentStockInput.value =
    selectedProduct.stock;

  populateInventoryLocationSelect(
    stockInLocationSelect,
    selectedProduct.location
  );

  stockInQuantityInput.value = 1;
  stockInPersonInput.value = "";
  stockInReasonInput.value = "仕入れ";
  stockInMemoInput.value = "";

  updateStockInLocationDisplay();
  updateStockInAfterStock();

  window.inventoryApp.showScreen("stockIn");

  stockInQuantityInput.focus();
}

function updateStockInLocationDisplay() {
  const selectedProduct =
    window.inventoryApp
      .getProductByInternalCode(
        selectedStockInInternalCode
      );

  if (!selectedProduct) {
    stockInLocationStockInput.value = 0;
    return;
  }

  stockInLocationStockInput.value =
    getInventoryLocationStock(
      selectedProduct,
      stockInLocationSelect.value
    );
}

function updateStockInAfterStock() {
  const currentStock = Number(
    stockInCurrentStockInput.value
  );

  const quantity = Number(
    stockInQuantityInput.value
  );

  if (
    !Number.isInteger(quantity) ||
    quantity < 1
  ) {
    stockInAfterStockInput.value =
      currentStock;

    return;
  }

  stockInAfterStockInput.value =
    currentStock + quantity;
}

async function handleStockInSubmit(event) {
  event.preventDefault();

  const selectedProduct =
    window.inventoryApp
      .getProductByInternalCode(
        selectedStockInInternalCode
      );

  if (!selectedProduct) {
    alert(
      "入庫する商品が見つかりませんでした。"
    );

    return;
  }

  const quantity = Number(
    stockInQuantityInput.value
  );

  const location = normalizeLocationStockName(
    stockInLocationSelect.value
  );

  const person =
    stockInPersonInput.value.trim();

  const reason =
    stockInReasonInput.value;

  const memo =
    stockInMemoInput.value.trim();

  if (!INVENTORY_LOCATION_OPTIONS.includes(location)) {
    alert("入庫先の保管場所を選択してください。");
    stockInLocationSelect.focus();
    return;
  }

  if (
    !Number.isInteger(quantity) ||
    quantity < 1
  ) {
    alert(
      "入庫数量は1以上の整数で入力してください。"
    );

    stockInQuantityInput.focus();
    return;
  }

  if (person === "") {
    alert(
      "担当者を入力してください。"
    );

    stockInPersonInput.focus();
    return;
  }

  const beforeStock =
    Number(selectedProduct.stock);

  const beforeLocationStock =
    getInventoryLocationStock(
      selectedProduct,
      location
    );

  const afterStock =
    beforeStock + quantity;

  const locationStocks =
    cloneInventoryLocationStocks(
      selectedProduct
    );

  let targetEntry = locationStocks.find(
    function (entry) {
      return entry.location === location;
    }
  );

  if (!targetEntry) {
    targetEntry = {
      location: location,
      stock: 0
    };
    locationStocks.push(targetEntry);
  }

  targetEntry.stock += quantity;

  const currentDateTime =
    new Date().toISOString();

  const updatedProduct = {
    ...selectedProduct,
    stock: afterStock,
    location: chooseInventoryPrimaryLocation(
      selectedProduct,
      locationStocks,
      location
    ),
    locationStocks: sortInventoryLocationStocks(
      locationStocks
    ),
    updatedAt: currentDateTime
  };

  const movement = {
    id: createMovementId(),
    dateTime: currentDateTime,
    internalCode:
      selectedProduct.internalCode,
    productCode:
      selectedProduct.productCode,
    productName:
      selectedProduct.productName,
    janCode:
      selectedProduct.janCode || "",
    type: "入庫",
    quantity: quantity,
    beforeStock: beforeStock,
    afterStock: afterStock,
    person: person,
    reason: reason,
    memo: memo,
    location: location,
    beforeLocationStock: beforeLocationStock,
    afterLocationStock: beforeLocationStock + quantity
  };

  try {
    await recordStockMovement(
      updatedProduct,
      movement
    );

    window.inventoryApp.applyUpdatedProduct(
      updatedProduct
    );

    alert(
      `入庫を記録しました。

` +
      `保管場所：${location}
` +
      `入庫数量：${quantity}個
` +
      `場所別在庫：${beforeLocationStock}個 → ${beforeLocationStock + quantity}個
` +
      `総在庫：${beforeStock}個 → ${afterStock}個`
    );

    stockInForm.reset();
    selectedStockInInternalCode = "";

    window.inventoryApp.openDetailScreen(
      updatedProduct.internalCode
    );
  } catch (error) {
    console.error(error);

    alert(
      "入庫情報を保存できませんでした。"
    );
  }
}

function cancelStockIn() {
  const internalCode =
    selectedStockInInternalCode;

  stockInForm.reset();
  selectedStockInInternalCode = "";

  if (internalCode === "") {
    window.inventoryApp.showScreen("list");
    return;
  }

  window.inventoryApp.openDetailScreen(
    internalCode
  );
}

/* 出庫処理 */

function openStockOutScreen() {
  const internalCode =
    window.inventoryApp
      .getSelectedDetailInternalCode();

  const selectedProduct =
    window.inventoryApp
      .getProductByInternalCode(
        internalCode
      );

  if (!selectedProduct) {
    alert(
      "出庫する商品が見つかりませんでした。"
    );

    return;
  }

  if (Number(selectedProduct.stock) <= 0) {
    alert(
      "現在庫数が0個のため、出庫できません。"
    );

    return;
  }

  selectedStockOutInternalCode =
    selectedProduct.internalCode;

  stockOutInternalCodeInput.value =
    selectedProduct.internalCode;

  stockOutProductNameInput.value =
    selectedProduct.productName;

  stockOutCurrentStockInput.value =
    selectedProduct.stock;

  const locationStocks = sortInventoryLocationStocks(
    cloneInventoryLocationStocks(
      selectedProduct
    )
  );
  const defaultLocationEntry = locationStocks.find(
    function (entry) {
      return entry.stock > 0;
    }
  );

  populateInventoryLocationSelect(
    stockOutLocationSelect,
    defaultLocationEntry
      ? defaultLocationEntry.location
      : selectedProduct.location
  );

  stockOutQuantityInput.value = 1;
  stockOutPersonInput.value = "";
  stockOutReasonInput.value = "出荷";
  stockOutMemoInput.value = "";

  updateStockOutLocationDisplay();
  updateStockOutAfterStock();

  window.inventoryApp.showScreen("stockOut");

  stockOutQuantityInput.focus();
}

function updateStockOutLocationDisplay() {
  const selectedProduct =
    window.inventoryApp
      .getProductByInternalCode(
        selectedStockOutInternalCode
      );

  if (!selectedProduct) {
    stockOutLocationStockInput.value = 0;
    stockOutQuantityInput.max = 0;
    return;
  }

  const locationStock =
    getInventoryLocationStock(
      selectedProduct,
      stockOutLocationSelect.value
    );

  stockOutLocationStockInput.value = locationStock;
  stockOutQuantityInput.max = locationStock;
  updateStockOutAfterStock();
}

function updateStockOutAfterStock() {
  const currentStock = Number(
    stockOutCurrentStockInput.value
  );

  const quantity = Number(
    stockOutQuantityInput.value
  );

  if (
    !Number.isInteger(quantity) ||
    quantity < 1
  ) {
    stockOutAfterStockInput.value =
      currentStock;

    return;
  }

  stockOutAfterStockInput.value =
    currentStock - quantity;
}

async function handleStockOutSubmit(event) {
  event.preventDefault();

  const selectedProduct =
    window.inventoryApp
      .getProductByInternalCode(
        selectedStockOutInternalCode
      );

  if (!selectedProduct) {
    alert(
      "出庫する商品が見つかりませんでした。"
    );

    return;
  }

  const quantity = Number(
    stockOutQuantityInput.value
  );

  const location = normalizeLocationStockName(
    stockOutLocationSelect.value
  );

  const person =
    stockOutPersonInput.value.trim();

  const reason =
    stockOutReasonInput.value;

  const memo =
    stockOutMemoInput.value.trim();

  const beforeStock =
    Number(selectedProduct.stock);

  const beforeLocationStock =
    getInventoryLocationStock(
      selectedProduct,
      location
    );

  if (!INVENTORY_LOCATION_OPTIONS.includes(location)) {
    alert("出庫元の保管場所を選択してください。");
    stockOutLocationSelect.focus();
    return;
  }

  if (
    !Number.isInteger(quantity) ||
    quantity < 1
  ) {
    alert(
      "出庫数量は1以上の整数で入力してください。"
    );

    stockOutQuantityInput.focus();
    return;
  }

  if (quantity > beforeLocationStock) {
    alert(
      `選択した保管場所の在庫数より多い数量は出庫できません。

` +
      `保管場所：${location}
` +
      `場所別在庫：${beforeLocationStock}個
` +
      `入力された出庫数量：${quantity}個`
    );

    stockOutQuantityInput.focus();
    return;
  }

  if (person === "") {
    alert(
      "担当者を入力してください。"
    );

    stockOutPersonInput.focus();
    return;
  }

  const afterStock =
    beforeStock - quantity;

  const locationStocks =
    cloneInventoryLocationStocks(
      selectedProduct
    );

  const sourceEntry = locationStocks.find(
    function (entry) {
      return entry.location === location;
    }
  );

  if (!sourceEntry || sourceEntry.stock < quantity) {
    alert("選択した保管場所の在庫が不足しています。");
    return;
  }

  sourceEntry.stock -= quantity;

  const cleanedLocationStocks = locationStocks.filter(
    function (entry) {
      return entry.stock > 0;
    }
  );

  const currentDateTime =
    new Date().toISOString();

  const updatedProduct = {
    ...selectedProduct,
    stock: afterStock,
    location: chooseInventoryPrimaryLocation(
      selectedProduct,
      cleanedLocationStocks,
      location
    ),
    locationStocks: sortInventoryLocationStocks(
      cleanedLocationStocks
    ),
    updatedAt: currentDateTime
  };

  const movement = {
    id: createMovementId(),
    dateTime: currentDateTime,
    internalCode:
      selectedProduct.internalCode,
    productCode:
      selectedProduct.productCode,
    productName:
      selectedProduct.productName,
    janCode:
      selectedProduct.janCode || "",
    type: "出庫",
    quantity: quantity,
    beforeStock: beforeStock,
    afterStock: afterStock,
    person: person,
    reason: reason,
    memo: memo,
    location: location,
    beforeLocationStock: beforeLocationStock,
    afterLocationStock: beforeLocationStock - quantity
  };

  try {
    await recordStockMovement(
      updatedProduct,
      movement
    );

    window.inventoryApp.applyUpdatedProduct(
      updatedProduct
    );

    alert(
      `出庫を記録しました。

` +
      `保管場所：${location}
` +
      `出庫数量：${quantity}個
` +
      `場所別在庫：${beforeLocationStock}個 → ${beforeLocationStock - quantity}個
` +
      `総在庫：${beforeStock}個 → ${afterStock}個`
    );

    stockOutForm.reset();
    selectedStockOutInternalCode = "";

    window.inventoryApp.openDetailScreen(
      updatedProduct.internalCode
    );
  } catch (error) {
    console.error(error);

    alert(
      "出庫情報を保存できませんでした。"
    );
  }
}

function cancelStockOut() {
  const internalCode =
    selectedStockOutInternalCode;

  stockOutForm.reset();
  selectedStockOutInternalCode = "";

  if (internalCode === "") {
    window.inventoryApp.showScreen("list");
    return;
  }

  window.inventoryApp.openDetailScreen(
    internalCode
  );
}

/* 数量調整処理 */

function openStockAdjustScreen() {
  const internalCode =
    window.inventoryApp
      .getSelectedDetailInternalCode();

  const selectedProduct =
    window.inventoryApp
      .getProductByInternalCode(
        internalCode
      );

  if (!selectedProduct) {
    alert(
      "数量調整する商品が見つかりませんでした。"
    );

    return;
  }

  selectedStockAdjustInternalCode =
    selectedProduct.internalCode;

  stockAdjustInternalCodeInput.value =
    selectedProduct.internalCode;

  stockAdjustProductNameInput.value =
    selectedProduct.productName;

  stockAdjustCurrentStockInput.value =
    selectedProduct.stock;

  stockAdjustNewStockInput.value =
    selectedProduct.stock;

  stockAdjustPersonInput.value = "";
  stockAdjustReasonInput.value =
    "棚卸調整";

  stockAdjustMemoInput.value = "";

  updateStockAdjustDifference();

  window.inventoryApp.showScreen(
    "stockAdjust"
  );

  stockAdjustNewStockInput.focus();
  stockAdjustNewStockInput.select();
}

function updateStockAdjustDifference() {
  const currentStock = Number(
    stockAdjustCurrentStockInput.value
  );

  const newStock = Number(
    stockAdjustNewStockInput.value
  );

  if (
    !Number.isInteger(newStock) ||
    newStock < 0
  ) {
    stockAdjustDifferenceInput.value =
      "正しい在庫数を入力してください";

    return;
  }

  const difference =
    newStock - currentStock;

  if (difference > 0) {
    stockAdjustDifferenceInput.value =
      `＋${difference}個`;
  } else {
    stockAdjustDifferenceInput.value =
      `${difference}個`;
  }
}

async function handleStockAdjustSubmit(event) {
  event.preventDefault();

  const selectedProduct =
    window.inventoryApp
      .getProductByInternalCode(
        selectedStockAdjustInternalCode
      );

  if (!selectedProduct) {
    alert(
      "数量調整する商品が見つかりませんでした。"
    );

    return;
  }

  const newStock = Number(
    stockAdjustNewStockInput.value
  );

  const person =
    stockAdjustPersonInput.value.trim();

  const reason =
    stockAdjustReasonInput.value;

  const memo =
    stockAdjustMemoInput.value.trim();

  if (
    !Number.isInteger(newStock) ||
    newStock < 0
  ) {
    alert(
      "調整後の在庫数は0以上の整数で入力してください。"
    );

    stockAdjustNewStockInput.focus();
    return;
  }

  if (person === "") {
    alert(
      "担当者を入力してください。"
    );

    stockAdjustPersonInput.focus();
    return;
  }

  const beforeStock =
    Number(selectedProduct.stock);

  const difference =
    newStock - beforeStock;

  if (difference === 0) {
    alert(
      "現在庫数と調整後の在庫数が同じです。\n" +
      "数量を変更してから確定してください。"
    );

    stockAdjustNewStockInput.focus();
    return;
  }

  const differenceText =
    difference > 0
      ? `＋${difference}個`
      : `${difference}個`;

  const confirmationMessage =
    `数量調整を確定しますか？\n\n` +
    `商品名：${selectedProduct.productName}\n` +
    `調整前：${beforeStock}個\n` +
    `調整後：${newStock}個\n` +
    `差異：${differenceText}`;

  const isConfirmed =
    window.confirm(confirmationMessage);

  if (!isConfirmed) {
    return;
  }

  const currentDateTime =
    new Date().toISOString();

  const updatedProduct = {
    ...selectedProduct,
    stock: newStock,
    updatedAt: currentDateTime
  };

  const movement = {
    id: createMovementId(),
    dateTime: currentDateTime,
    internalCode:
      selectedProduct.internalCode,
    productCode:
      selectedProduct.productCode,
    productName:
      selectedProduct.productName,
    janCode:
      selectedProduct.janCode || "",
    type: "数量調整",
    quantity: difference,
    beforeStock: beforeStock,
    afterStock: newStock,
    person: person,
    reason: reason,
    memo: memo
  };

  try {
    await recordStockMovement(
      updatedProduct,
      movement
    );

    window.inventoryApp.applyUpdatedProduct(
      updatedProduct
    );

    alert(
      `数量調整を記録しました。\n\n` +
      `調整前：${beforeStock}個\n` +
      `調整後：${newStock}個\n` +
      `差異：${differenceText}`
    );

    stockAdjustForm.reset();
    selectedStockAdjustInternalCode = "";

    window.inventoryApp.openDetailScreen(
      updatedProduct.internalCode
    );
  } catch (error) {
    console.error(error);

    alert(
      "数量調整を保存できませんでした。"
    );
  }
}

function cancelStockAdjust() {
  const internalCode =
    selectedStockAdjustInternalCode;

  stockAdjustForm.reset();
  selectedStockAdjustInternalCode = "";

  if (internalCode === "") {
    window.inventoryApp.showScreen("list");
    return;
  }

  window.inventoryApp.openDetailScreen(
    internalCode
  );
}

/* 共通処理 */

function createMovementId() {
  const randomText = Math.random()
    .toString(36)
    .slice(2, 10);

  return `${Date.now()}-${randomText}`;
}