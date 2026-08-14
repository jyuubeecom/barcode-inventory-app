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

const stockAdjustLocationSelect =
  document.querySelector(
    "#stock-adjust-location"
  );

const stockAdjustLocationStockInput =
  document.querySelector(
    "#stock-adjust-location-stock"
  );

const stockAdjustNewStockInput =
  document.querySelector(
    "#stock-adjust-new-stock"
  );

const stockAdjustDifferenceInput =
  document.querySelector(
    "#stock-adjust-difference"
  );

const stockAdjustAfterTotalStockInput =
  document.querySelector(
    "#stock-adjust-after-total-stock"
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

  stockAdjustLocationSelect.addEventListener(
    "change",
    updateStockAdjustLocationDisplay
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

async function openStockInScreen() {
  const internalCode =
    window.inventoryApp
      .getSelectedDetailInternalCode();

  const selectedProduct =
    window.inventoryApp
      .getProductByInternalCode(
        internalCode
      );

  if (!selectedProduct) {
    await showInventoryDialog({
      type: "danger",
      icon: "⚠️",
      title: "入庫する商品を確認できません",
      message:
        "商品が見つかりませんでした。画面を更新して、もう一度お試しください。",
      confirmText: "閉じる"
    });

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
    await showInventoryDialog({
      type: "danger",
      icon: "⚠️",
      title: "入庫する商品を確認できません",
      message:
        "商品が見つかりませんでした。画面を更新して、もう一度お試しください。",
      confirmText: "閉じる"
    });

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
    await showInventoryDialog({
      type: "warning",
      icon: "📍",
      title: "入庫先の保管場所を選択してください",
      message:
        "商品を入庫する保管場所を選んでください。",
      confirmText: "入力に戻る"
    });
    stockInLocationSelect.focus();
    return;
  }

  if (
    !Number.isInteger(quantity) ||
    quantity < 1
  ) {
    await showInventoryDialog({
      type: "warning",
      icon: "🔢",
      title: "入庫数量を確認してください",
      message:
        "入庫数量は1以上の整数で入力してください。",
      confirmText: "入力に戻る"
    });

    stockInQuantityInput.focus();
    return;
  }

  if (person === "") {
    await showInventoryDialog({
      type: "warning",
      icon: "👤",
      title: "担当者を入力してください",
      message:
        "入庫を記録する担当者名を入力してください。",
      confirmText: "入力に戻る"
    });

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

  const afterLocationStock =
    beforeLocationStock + quantity;

  const isConfirmed =
    await showInventoryDialog({
      type: "success",
      icon: "📥",
      title: "入庫を確定しますか？",
      message:
        "場所別在庫と総在庫が増えます。内容を確認してください。",
      details: [
        {
          label: "商品名",
          value:
            selectedProduct.productName ||
            "商品名未登録"
        },
        {
          label: "入庫先",
          value: location
        },
        {
          label: "入庫数量",
          value: `${quantity}個`
        },
        {
          label: "場所別在庫",
          value:
            `${beforeLocationStock}個 → ${afterLocationStock}個`
        },
        {
          label: "総在庫",
          value:
            `${beforeStock}個 → ${afterStock}個`
        },
        {
          label: "担当者",
          value: person
        },
        {
          label: "理由",
          value: reason
        }
      ],
      notice:
        "確定すると、選択した保管場所と総在庫へ反映し、入出庫履歴に「入庫」として記録します。",
      isConfirm: true,
      cancelText: "戻る",
      confirmText: "入庫を確定する"
    });

  if (!isConfirmed) {
    return;
  }

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
    afterLocationStock: afterLocationStock
  };

  try {
    await recordStockMovement(
      updatedProduct,
      movement
    );

    window.inventoryApp.applyUpdatedProduct(
      updatedProduct
    );

    await showInventoryDialog({
      type: "success",
      icon: "✅",
      title: "入庫を記録しました",
      message:
        "場所別在庫と総在庫を更新しました。",
      details: [
        {
          label: "保管場所",
          value: location
        },
        {
          label: "入庫数量",
          value: `${quantity}個`
        },
        {
          label: "場所別在庫",
          value:
            `${beforeLocationStock}個 → ${afterLocationStock}個`
        },
        {
          label: "総在庫",
          value:
            `${beforeStock}個 → ${afterStock}個`
        }
      ],
      confirmText: "閉じる"
    });

    stockInForm.reset();
    selectedStockInInternalCode = "";

    window.inventoryApp.openDetailScreen(
      updatedProduct.internalCode
    );
  } catch (error) {
    console.error(error);

    await showInventoryDialog({
      type: "danger",
      icon: "⚠️",
      title: "入庫情報を保存できませんでした",
      message:
        "保存処理でエラーが発生しました。画面を更新して、もう一度お試しください。",
      confirmText: "閉じる"
    });
  }
}

async function cancelStockIn() {
  const internalCode =
    selectedStockInInternalCode;

  const selectedProduct =
    window.inventoryApp
      .getProductByInternalCode(
        internalCode
      );

  if (selectedProduct) {
    const defaultLocation =
      normalizeLocationStockName(
        selectedProduct.location
      );
    const currentLocation =
      normalizeLocationStockName(
        stockInLocationSelect.value
      );
    const hasInput =
      Number(stockInQuantityInput.value) !== 1 ||
      stockInPersonInput.value.trim() !== "" ||
      stockInReasonInput.value !== "仕入れ" ||
      stockInMemoInput.value.trim() !== "" ||
      currentLocation !== defaultLocation;

    if (hasInput) {
      const isConfirmed =
        await showInventoryDialog({
          type: "warning",
          icon: "↩️",
          title: "入庫をやめますか？",
          message:
            "入力した内容は保存されません。商品詳細画面へ戻りますか？",
          isConfirm: true,
          cancelText: "入力を続ける",
          confirmText: "入庫をやめる"
        });

      if (!isConfirmed) {
        return;
      }
    }
  }

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

async function openStockOutScreen() {
  const internalCode =
    window.inventoryApp
      .getSelectedDetailInternalCode();

  const selectedProduct =
    window.inventoryApp
      .getProductByInternalCode(
        internalCode
      );

  if (!selectedProduct) {
    await showInventoryDialog({
      type: "danger",
      icon: "⚠️",
      title: "出庫する商品を確認できません",
      message:
        "商品が見つかりませんでした。画面を更新して、もう一度お試しください。",
      confirmText: "閉じる"
    });

    return;
  }

  if (Number(selectedProduct.stock) <= 0) {
    await showInventoryDialog({
      type: "danger",
      icon: "📦",
      title: "出庫できる在庫がありません",
      message:
        "現在庫数が0個のため、この商品は出庫できません。",
      details: [
        {
          label: "商品名",
          value:
            selectedProduct.productName ||
            "商品名未登録"
        },
        {
          label: "現在庫数",
          value: "0個"
        }
      ],
      confirmText: "閉じる"
    });

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
    stockOutQuantityInput.removeAttribute("max");
    return;
  }

  const locationStock =
    getInventoryLocationStock(
      selectedProduct,
      stockOutLocationSelect.value
    );

  stockOutLocationStockInput.value = locationStock;
  stockOutQuantityInput.removeAttribute("max");
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
    await showInventoryDialog({
      type: "danger",
      icon: "⚠️",
      title: "出庫する商品を確認できません",
      message:
        "商品が見つかりませんでした。画面を更新して、もう一度お試しください。",
      confirmText: "閉じる"
    });

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
    await showInventoryDialog({
      type: "warning",
      icon: "📍",
      title: "出庫元の保管場所を選択してください",
      message:
        "商品を出庫する保管場所を選んでください。",
      confirmText: "入力に戻る"
    });
    stockOutLocationSelect.focus();
    return;
  }

  if (
    !Number.isInteger(quantity) ||
    quantity < 1
  ) {
    await showInventoryDialog({
      type: "warning",
      icon: "🔢",
      title: "出庫数量を確認してください",
      message:
        "出庫数量は1以上の整数で入力してください。",
      confirmText: "入力に戻る"
    });

    stockOutQuantityInput.focus();
    return;
  }

  if (quantity > beforeLocationStock) {
    await showInventoryDialog({
      type: "danger",
      icon: "⚠️",
      title: "出庫数量が場所別在庫を超えています",
      message:
        "選択した保管場所の在庫数より多い数量は出庫できません。",
      details: [
        {
          label: "商品名",
          value:
            selectedProduct.productName ||
            "商品名未登録"
        },
        {
          label: "保管場所",
          value: location
        },
        {
          label: "場所別在庫",
          value: `${beforeLocationStock}個`
        },
        {
          label: "入力した出庫数量",
          value: `${quantity}個`
        },
        {
          label: "不足数",
          value: `${quantity - beforeLocationStock}個`
        }
      ],
      notice:
        "出庫数量を場所別在庫以下に変更してください。",
      confirmText: "入力に戻る"
    });

    stockOutQuantityInput.focus();
    return;
  }

  if (person === "") {
    await showInventoryDialog({
      type: "warning",
      icon: "👤",
      title: "担当者を入力してください",
      message:
        "出庫を記録する担当者名を入力してください。",
      confirmText: "入力に戻る"
    });

    stockOutPersonInput.focus();
    return;
  }

  const afterStock =
    beforeStock - quantity;

  const afterLocationStock =
    beforeLocationStock - quantity;

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
    await showInventoryDialog({
      type: "danger",
      icon: "⚠️",
      title: "選択した保管場所の在庫が不足しています",
      message:
        "最新の場所別在庫を確認してから、もう一度出庫してください。",
      details: [
        {
          label: "保管場所",
          value: location
        },
        {
          label: "現在の場所別在庫",
          value: `${beforeLocationStock}個`
        },
        {
          label: "出庫数量",
          value: `${quantity}個`
        }
      ],
      confirmText: "入力に戻る"
    });
    return;
  }

  const isConfirmed =
    await showInventoryDialog({
      type: "danger",
      icon: "📤",
      title: "出庫を確定しますか？",
      message:
        "場所別在庫と総在庫が減ります。内容を確認してください。",
      details: [
        {
          label: "商品名",
          value:
            selectedProduct.productName ||
            "商品名未登録"
        },
        {
          label: "出庫元",
          value: location
        },
        {
          label: "出庫数量",
          value: `${quantity}個`
        },
        {
          label: "場所別在庫",
          value:
            `${beforeLocationStock}個 → ${afterLocationStock}個`
        },
        {
          label: "総在庫",
          value:
            `${beforeStock}個 → ${afterStock}個`
        },
        {
          label: "担当者",
          value: person
        },
        {
          label: "理由",
          value: reason
        }
      ],
      notice:
        "確定すると、選択した保管場所と総在庫へ反映し、入出庫履歴に「出庫」として記録します。",
      isConfirm: true,
      cancelText: "戻る",
      confirmText: "出庫を確定する"
    });

  if (!isConfirmed) {
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
    afterLocationStock: afterLocationStock
  };

  try {
    await recordStockMovement(
      updatedProduct,
      movement
    );

    window.inventoryApp.applyUpdatedProduct(
      updatedProduct
    );

    await showInventoryDialog({
      type: "success",
      icon: "✅",
      title: "出庫を記録しました",
      message:
        "場所別在庫と総在庫を更新しました。",
      details: [
        {
          label: "保管場所",
          value: location
        },
        {
          label: "出庫数量",
          value: `${quantity}個`
        },
        {
          label: "場所別在庫",
          value:
            `${beforeLocationStock}個 → ${afterLocationStock}個`
        },
        {
          label: "総在庫",
          value:
            `${beforeStock}個 → ${afterStock}個`
        }
      ],
      confirmText: "閉じる"
    });

    stockOutForm.reset();
    selectedStockOutInternalCode = "";

    window.inventoryApp.openDetailScreen(
      updatedProduct.internalCode
    );
  } catch (error) {
    console.error(error);

    await showInventoryDialog({
      type: "danger",
      icon: "⚠️",
      title: "出庫情報を保存できませんでした",
      message:
        "保存処理でエラーが発生しました。画面を更新して、もう一度お試しください。",
      confirmText: "閉じる"
    });
  }
}

async function cancelStockOut() {
  const internalCode =
    selectedStockOutInternalCode;

  const selectedProduct =
    window.inventoryApp
      .getProductByInternalCode(
        internalCode
      );

  if (selectedProduct) {
    const locationStocks =
      sortInventoryLocationStocks(
        cloneInventoryLocationStocks(
          selectedProduct
        )
      );
    const defaultLocationEntry =
      locationStocks.find(
        function (entry) {
          return entry.stock > 0;
        }
      );
    const defaultLocation =
      normalizeLocationStockName(
        defaultLocationEntry
          ? defaultLocationEntry.location
          : selectedProduct.location
      );
    const currentLocation =
      normalizeLocationStockName(
        stockOutLocationSelect.value
      );
    const hasInput =
      Number(stockOutQuantityInput.value) !== 1 ||
      stockOutPersonInput.value.trim() !== "" ||
      stockOutReasonInput.value !== "出荷" ||
      stockOutMemoInput.value.trim() !== "" ||
      currentLocation !== defaultLocation;

    if (hasInput) {
      const isConfirmed =
        await showInventoryDialog({
          type: "warning",
          icon: "↩️",
          title: "出庫をやめますか？",
          message:
            "入力した内容は保存されません。商品詳細画面へ戻りますか？",
          isConfirm: true,
          cancelText: "入力を続ける",
          confirmText: "出庫をやめる"
        });

      if (!isConfirmed) {
        return;
      }
    }
  }

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

async function showInventoryDialog(options) {
  if (
    window.inventoryApp &&
    typeof window.inventoryApp.showAppDialog === "function"
  ) {
    return window.inventoryApp.showAppDialog(options);
  }

  const dialogOptions = options || {};
  const detailText = Array.isArray(dialogOptions.details)
    ? dialogOptions.details
        .map(function (detail) {
          return `${detail.label}：${detail.value}`;
        })
        .join("\n")
    : "";
  const message = [
    dialogOptions.title || "確認",
    dialogOptions.message || "",
    detailText,
    dialogOptions.notice || ""
  ]
    .filter(Boolean)
    .join("\n\n");

  if (dialogOptions.isConfirm) {
    return window.confirm(message);
  }

  window.alert(message);
  return true;
}

function getStockAdjustSelectedProduct() {
  return window.inventoryApp.getProductByInternalCode(
    selectedStockAdjustInternalCode
  );
}

async function openStockAdjustScreen() {
  const internalCode =
    window.inventoryApp
      .getSelectedDetailInternalCode();

  const selectedProduct =
    window.inventoryApp
      .getProductByInternalCode(
        internalCode
      );

  if (!selectedProduct) {
    await showInventoryDialog({
      type: "danger",
      icon: "⚠️",
      title: "数量調整する商品を確認できません",
      message:
        "商品が見つかりませんでした。画面を更新して、もう一度お試しください。",
      confirmText: "閉じる"
    });

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

  const locationStocks = sortInventoryLocationStocks(
    cloneInventoryLocationStocks(
      selectedProduct
    )
  );

  const defaultLocationEntry = locationStocks.find(
    function (entry) {
      return (
        entry.location ===
          normalizeLocationStockName(
            selectedProduct.location
          ) &&
        entry.stock >= 0
      );
    }
  ) || locationStocks.find(
    function (entry) {
      return entry.stock > 0;
    }
  );

  populateInventoryLocationSelect(
    stockAdjustLocationSelect,
    defaultLocationEntry
      ? defaultLocationEntry.location
      : selectedProduct.location
  );

  stockAdjustPersonInput.value = "";
  stockAdjustReasonInput.value =
    "棚卸調整";
  stockAdjustMemoInput.value = "";

  updateStockAdjustLocationDisplay();

  window.inventoryApp.showScreen(
    "stockAdjust"
  );

  stockAdjustNewStockInput.focus();
  stockAdjustNewStockInput.select();
}

function updateStockAdjustLocationDisplay() {
  const selectedProduct =
    getStockAdjustSelectedProduct();

  if (!selectedProduct) {
    stockAdjustLocationStockInput.value = 0;
    stockAdjustNewStockInput.value = 0;
    stockAdjustAfterTotalStockInput.value = 0;
    stockAdjustDifferenceInput.value = "0個";
    return;
  }

  const locationStock =
    getInventoryLocationStock(
      selectedProduct,
      stockAdjustLocationSelect.value
    );

  stockAdjustLocationStockInput.value =
    locationStock;
  stockAdjustNewStockInput.value =
    locationStock;

  updateStockAdjustDifference();
}

function updateStockAdjustDifference() {
  const currentTotalStock = Number(
    stockAdjustCurrentStockInput.value
  );

  const currentLocationStock = Number(
    stockAdjustLocationStockInput.value
  );

  const newLocationStock = Number(
    stockAdjustNewStockInput.value
  );

  if (
    !Number.isInteger(newLocationStock) ||
    newLocationStock < 0
  ) {
    stockAdjustDifferenceInput.value =
      "正しい在庫数を入力してください";
    stockAdjustAfterTotalStockInput.value =
      currentTotalStock;
    return;
  }

  const difference =
    newLocationStock - currentLocationStock;

  if (difference > 0) {
    stockAdjustDifferenceInput.value =
      `＋${difference}個`;
  } else {
    stockAdjustDifferenceInput.value =
      `${difference}個`;
  }

  stockAdjustAfterTotalStockInput.value =
    currentTotalStock + difference;
}

async function handleStockAdjustSubmit(event) {
  event.preventDefault();

  const selectedProduct =
    getStockAdjustSelectedProduct();

  if (!selectedProduct) {
    await showInventoryDialog({
      type: "danger",
      icon: "⚠️",
      title: "数量調整する商品を確認できません",
      message:
        "商品が見つかりませんでした。画面を更新して、もう一度お試しください。",
      confirmText: "閉じる"
    });

    return;
  }

  const location = normalizeLocationStockName(
    stockAdjustLocationSelect.value
  );

  const newLocationStock = Number(
    stockAdjustNewStockInput.value
  );

  const person =
    stockAdjustPersonInput.value.trim();

  const reason =
    stockAdjustReasonInput.value;

  const memo =
    stockAdjustMemoInput.value.trim();

  if (!INVENTORY_LOCATION_OPTIONS.includes(location)) {
    await showInventoryDialog({
      type: "warning",
      icon: "⚠️",
      title: "保管場所を選択してください",
      message:
        "数量を調整する保管場所を選んでください。",
      confirmText: "確認する"
    });
    stockAdjustLocationSelect.focus();
    return;
  }

  if (
    !Number.isInteger(newLocationStock) ||
    newLocationStock < 0
  ) {
    await showInventoryDialog({
      type: "warning",
      icon: "⚠️",
      title: "調整後の在庫数を確認してください",
      message:
        "調整後の場所別在庫数は、0以上の整数で入力してください。",
      confirmText: "入力に戻る"
    });

    stockAdjustNewStockInput.focus();
    return;
  }

  if (person === "") {
    await showInventoryDialog({
      type: "warning",
      icon: "👤",
      title: "担当者を入力してください",
      message:
        "数量調整を記録する担当者名を入力してください。",
      confirmText: "入力に戻る"
    });

    stockAdjustPersonInput.focus();
    return;
  }

  const beforeStock =
    Number(selectedProduct.stock);

  const beforeLocationStock =
    getInventoryLocationStock(
      selectedProduct,
      location
    );

  const difference =
    newLocationStock - beforeLocationStock;

  if (difference === 0) {
    await showInventoryDialog({
      type: "warning",
      icon: "ℹ️",
      title: "在庫数が変更されていません",
      message:
        "選択した保管場所の現在庫数と、調整後の在庫数が同じです。数量を変更してから確定してください。",
      details: [
        {
          label: "保管場所",
          value: location
        },
        {
          label: "現在庫数",
          value: `${beforeLocationStock}個`
        }
      ],
      confirmText: "入力に戻る"
    });

    stockAdjustNewStockInput.focus();
    return;
  }

  const afterStock =
    beforeStock + difference;

  if (afterStock < 0) {
    await showInventoryDialog({
      type: "danger",
      icon: "⚠️",
      title: "総在庫数を確認してください",
      message:
        "調整後の総在庫数が0個未満になるため、数量調整できません。",
      confirmText: "入力に戻る"
    });
    return;
  }

  const differenceText =
    difference > 0
      ? `＋${difference}個`
      : `${difference}個`;

  const isConfirmed =
    await showInventoryDialog({
      type: "warning",
      icon: "📦",
      title: "数量調整を確定しますか？",
      message:
        "場所別在庫と総在庫が変更されます。内容を確認してください。",
      details: [
        {
          label: "商品名",
          value:
            selectedProduct.productName ||
            "商品名未登録"
        },
        {
          label: "保管場所",
          value: location
        },
        {
          label: "場所別在庫",
          value:
            `${beforeLocationStock}個 → ${newLocationStock}個`
        },
        {
          label: "差異",
          value: differenceText
        },
        {
          label: "総在庫",
          value:
            `${beforeStock}個 → ${afterStock}個`
        },
        {
          label: "担当者",
          value: person
        },
        {
          label: "理由",
          value: reason
        }
      ],
      notice:
        "確定すると、選択した保管場所の在庫と総在庫を変更し、入出庫履歴へ「数量調整」として記録します。",
      isConfirm: true,
      cancelText: "戻る",
      confirmText: "数量調整を確定する"
    });

  if (!isConfirmed) {
    return;
  }

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

  targetEntry.stock = newLocationStock;

  let cleanedLocationStocks =
    locationStocks.filter(
      function (entry) {
        return entry.stock > 0;
      }
    );

  if (afterStock === 0) {
    cleanedLocationStocks = [
      {
        location: location,
        stock: 0
      }
    ];
  }

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
    type: "数量調整",
    quantity: difference,
    beforeStock: beforeStock,
    afterStock: afterStock,
    person: person,
    reason: reason,
    memo: memo,
    location: location,
    beforeLocationStock: beforeLocationStock,
    afterLocationStock: newLocationStock
  };

  try {
    await recordStockMovement(
      updatedProduct,
      movement
    );

    window.inventoryApp.applyUpdatedProduct(
      updatedProduct
    );

    await showInventoryDialog({
      type: "success",
      icon: "✅",
      title: "数量調整を記録しました",
      message:
        "場所別在庫と総在庫を更新しました。",
      details: [
        {
          label: "保管場所",
          value: location
        },
        {
          label: "場所別在庫",
          value:
            `${beforeLocationStock}個 → ${newLocationStock}個`
        },
        {
          label: "差異",
          value: differenceText
        },
        {
          label: "総在庫",
          value:
            `${beforeStock}個 → ${afterStock}個`
        }
      ],
      confirmText: "閉じる"
    });

    stockAdjustForm.reset();
    selectedStockAdjustInternalCode = "";

    window.inventoryApp.openDetailScreen(
      updatedProduct.internalCode
    );
  } catch (error) {
    console.error(error);

    await showInventoryDialog({
      type: "danger",
      icon: "⚠️",
      title: "数量調整を保存できませんでした",
      message:
        "保存処理でエラーが発生しました。画面を更新して、もう一度お試しください。",
      confirmText: "閉じる"
    });
  }
}

async function cancelStockAdjust() {
  const internalCode =
    selectedStockAdjustInternalCode;

  const selectedProduct =
    getStockAdjustSelectedProduct();

  if (selectedProduct) {
    const location = normalizeLocationStockName(
      stockAdjustLocationSelect.value
    );
    const beforeLocationStock =
      getInventoryLocationStock(
        selectedProduct,
        location
      );
    const enteredStock = Number(
      stockAdjustNewStockInput.value
    );
    const hasInput =
      enteredStock !== beforeLocationStock ||
      stockAdjustPersonInput.value.trim() !== "" ||
      stockAdjustMemoInput.value.trim() !== "";

    if (hasInput) {
      const isConfirmed =
        await showInventoryDialog({
          type: "warning",
          icon: "↩️",
          title: "数量調整をやめますか？",
          message:
            "入力した内容は保存されません。商品詳細画面へ戻りますか？",
          isConfirm: true,
          cancelText: "入力を続ける",
          confirmText: "数量調整をやめる"
        });

      if (!isConfirmed) {
        return;
      }
    }
  }

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