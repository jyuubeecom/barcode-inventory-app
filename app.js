"use strict";

const homeScreen =
  document.querySelector("#home");

const registerScreen =
  document.querySelector("#product-register");

const listScreen =
  document.querySelector("#product-list");

const historyScreen =
  document.querySelector(
    "#stock-movement-history"
  );

const productStockHistoryScreen =
  document.querySelector(
    "#product-stock-history"
  );

const detailScreen =
  document.querySelector("#product-detail");

const stockInScreen =
  document.querySelector("#stock-in");

const stockOutScreen =
  document.querySelector("#stock-out");

const stockAdjustScreen =
  document.querySelector("#stock-adjust");

const editScreen =
  document.querySelector("#product-edit");

const unassignedLocationScreen =
  document.querySelector(
    "#unassigned-location-products"
  );

const showRegisterButton =
  document.querySelector(
    "#show-register-button"
  );

const showListButton =
  document.querySelector(
    "#show-list-button"
  );

const showHistoryButton =
  document.querySelector(
    "#show-history-button"
  );

const backHomeFromRegisterButton =
  document.querySelector(
    "#back-home-from-register"
  );

const backHomeFromListButton =
  document.querySelector(
    "#back-home-from-list"
  );

const backHomeFromHistoryButton =
  document.querySelector(
    "#back-home-from-history"
  );

const backListFromDetailButton =
  document.querySelector(
    "#back-list-from-detail"
  );

const editFromDetailButton =
  document.querySelector(
    "#edit-from-detail-button"
  );

const deleteFromDetailButton =
  document.querySelector(
    "#delete-from-detail-button"
  );

const cancelEditButton =
  document.querySelector(
    "#cancel-edit-button"
  );

const productForm =
  document.querySelector("#product-form");

const editProductForm =
  document.querySelector(
    "#edit-product-form"
  );

const productTableBody =
  document.querySelector(
    "#product-table-body"
  );

const movementHistoryBody =
  document.querySelector(
    "#movement-history-body"
  );

const movementHistoryCount =
  document.querySelector(
    "#movement-history-count"
  );

const productCountElement =
  document.querySelector("#product-count");

const totalStockElement =
  document.querySelector("#total-stock");

const outOfStockCountElement =
  document.querySelector(
    "#out-of-stock-count"
  );

const lowStockCountElement =
  document.querySelector(
    "#low-stock-count"
  );

const productSearchInput =
  document.querySelector("#product-search");

const clearSearchButton =
  document.querySelector(
    "#clear-search-button"
  );

const searchResultMessage =
  document.querySelector(
    "#search-result-message"
  );

let productSortSelect = null;

const internalCodeInput =
  document.querySelector("#internal-code");

const productCodeInput =
  document.querySelector("#product-code");

const productNameInput =
  document.querySelector("#product-name");

const janCodeInput =
  document.querySelector("#jan-code");

const stockInput =
  document.querySelector("#stock");

const minStockInput =
  document.querySelector("#min-stock");

const categoryInput =
  document.querySelector("#category");

const locationInput =
  document.querySelector("#location");

const supplierInput =
  document.querySelector("#supplier");

const orderRemainingInput =
  document.querySelector(
    "#order-remaining"
  );

const productStatusInput =
  document.querySelector(
    "#product-status"
  );

const backorderStatusInput =
  document.querySelector(
    "#backorder-status"
  );

const editInternalCodeInput =
  document.querySelector(
    "#edit-internal-code"
  );

const editProductCodeInput =
  document.querySelector(
    "#edit-product-code"
  );

const editProductNameInput =
  document.querySelector(
    "#edit-product-name"
  );

const editJanCodeInput =
  document.querySelector(
    "#edit-jan-code"
  );

const editStockInput =
  document.querySelector("#edit-stock");

const editMinStockInput =
  document.querySelector(
    "#edit-min-stock"
  );

const editCategoryInput =
  document.querySelector(
    "#edit-category"
  );

const editLocationInput =
  document.querySelector(
    "#edit-location"
  );

const editSupplierInput =
  document.querySelector(
    "#edit-supplier"
  );

const editOrderRemainingInput =
  document.querySelector(
    "#edit-order-remaining"
  );

const editProductStatusInput =
  document.querySelector(
    "#edit-product-status"
  );

const editBackorderStatusInput =
  document.querySelector(
    "#edit-backorder-status"
  );

const detailInternalCode =
  document.querySelector(
    "#detail-internal-code"
  );

const detailProductCode =
  document.querySelector(
    "#detail-product-code"
  );

const detailProductName =
  document.querySelector(
    "#detail-product-name"
  );

const detailJanCode =
  document.querySelector(
    "#detail-jan-code"
  );

const detailStock =
  document.querySelector("#detail-stock");

const detailMinStock =
  document.querySelector(
    "#detail-min-stock"
  );

const detailStockStatus =
  document.querySelector(
    "#detail-stock-status"
  );

const detailCategory =
  document.querySelector(
    "#detail-category"
  );

const detailLocation =
  document.querySelector(
    "#detail-location"
  );

const detailLocationStocks =
  document.querySelector(
    "#detail-location-stocks"
  );

const detailSupplier =
  document.querySelector(
    "#detail-supplier"
  );

const detailOrderRemaining =
  document.querySelector(
    "#detail-order-remaining"
  );

const detailProductStatus =
  document.querySelector(
    "#detail-product-status"
  );

const detailUpdatedAt =
  document.querySelector(
    "#detail-updated-at"
  );

let products = [];
let editingInternalCode = "";
let detailInternalCodeValue = "";

document.addEventListener(
  "DOMContentLoaded",
  initializeApp
);


function isWorkerPermissionMode() {
  return Boolean(
    window.inventoryPermissions &&
    typeof window.inventoryPermissions.isWorker === "function" &&
    window.inventoryPermissions.isWorker()
  );
}

async function requireAdminPermission(
  actionName
) {
  if (
    window.inventoryPermissions &&
    typeof window.inventoryPermissions.requireAdmin === "function"
  ) {
    return window.inventoryPermissions.requireAdmin(
      actionName
    );
  }

  return true;
}

async function initializeApp() {
  showRegisterButton.addEventListener(
    "click",
    async function () {
      if (
        !(await requireAdminPermission(
          "商品の新規登録"
        ))
      ) {
        return;
      }

      showScreen("register");
      internalCodeInput.focus();
    }
  );

  showListButton.addEventListener(
    "click",
    function () {
      showScreen("list");
      productSearchInput.focus();
    }
  );

  showHistoryButton.addEventListener(
    "click",
    openMovementHistoryScreen
  );

  backHomeFromRegisterButton.addEventListener(
    "click",
    function () {
      showScreen("home");
    }
  );

  backHomeFromListButton.addEventListener(
    "click",
    function () {
      showScreen("home");
    }
  );

  backHomeFromHistoryButton.addEventListener(
    "click",
    function () {
      showScreen("home");
    }
  );

  backListFromDetailButton.addEventListener(
    "click",
    function () {
      showScreen("list");
    }
  );

  editFromDetailButton.addEventListener(
    "click",
    async function () {
      if (
        !(await requireAdminPermission(
          "商品情報の編集"
        ))
      ) {
        return;
      }

      if (detailInternalCodeValue === "") {
        void showAppDialog({
          type: "warning",
          icon: "⚠️",
          title: "編集する商品が選択されていません",
          message:
            "商品一覧から編集する商品を選択して、もう一度お試しください。",
          confirmText: "閉じる"
        });

        return;
      }

      openEditScreen(detailInternalCodeValue);
    }
  );

  deleteFromDetailButton.addEventListener(
    "click",
    async function () {
      if (
        !(await requireAdminPermission(
          "商品の削除"
        ))
      ) {
        return;
      }

      if (detailInternalCodeValue === "") {
        await showAppDialog({
          type: "danger",
          icon: "⚠️",
          title: "削除する商品が選択されていません",
          message:
            "商品一覧から削除する商品を選択して、もう一度お試しください。",
          confirmText: "閉じる"
        });

        return;
      }

      const deleted = await handleDeleteProduct(
        detailInternalCodeValue
      );

      if (deleted) {
        detailInternalCodeValue = "";
        showScreen("list");
      }
    }
  );

  cancelEditButton.addEventListener(
    "click",
    function () {
      editingInternalCode = "";
      showScreen("list");
    }
  );

  productForm.addEventListener(
    "submit",
    handleProductSubmit
  );

  editProductForm.addEventListener(
    "submit",
    handleEditProductSubmit
  );

  productSearchInput.addEventListener(
    "input",
    displayCurrentProducts
  );

  clearSearchButton.addEventListener(
    "click",
    clearSearch
  );

  createProductSortControls();
  createProductLifecycleStyle();
  createProductListResponsiveStyle();

  showScreen("home");

  try {
    await migrateProductLocationStocks();

    const savedProducts =
      await getAllProducts();

    products = savedProducts.map(
      normalizeProductData
    );

    sortProducts();
    displayCurrentProducts();
    updateSummary();
  } catch (error) {
    console.error(error);

    await showAppDialog({
      type: "danger",
      icon: "⚠️",
      title: "商品データを読み込めませんでした",
      message:
        "保存されている商品データを読み込めませんでした。画面を更新して、もう一度お試しください。",
      confirmText: "閉じる"
    });
  }
}

function showScreen(screenName) {
  const protectedScreens =
    new Set([
      "register",
      "edit",
      "stockAdjust",
      "unassignedLocation"
    ]);

  if (
    protectedScreens.has(screenName) &&
    isWorkerPermissionMode()
  ) {
    void requireAdminPermission(
      screenName === "register"
        ? "商品の新規登録"
        : screenName === "edit"
          ? "商品情報の編集"
          : screenName === "stockAdjust"
            ? "数量調整"
            : "保管場所の一括変更"
    );
    return;
  }

  homeScreen.hidden = true;
  registerScreen.hidden = true;
  listScreen.hidden = true;
  historyScreen.hidden = true;

  if (productStockHistoryScreen) {
    productStockHistoryScreen.hidden = true;
  }

  detailScreen.hidden = true;
  stockInScreen.hidden = true;
  stockOutScreen.hidden = true;
  stockAdjustScreen.hidden = true;
  editScreen.hidden = true;

  if (unassignedLocationScreen) {
    unassignedLocationScreen.hidden = true;
  }

  if (screenName === "register") {
    registerScreen.hidden = false;
    return;
  }

  if (screenName === "list") {
    listScreen.hidden = false;
    return;
  }

  if (screenName === "history") {
    historyScreen.hidden = false;
    return;
  }

  if (screenName === "productHistory") {
    if (productStockHistoryScreen) {
      productStockHistoryScreen.hidden = false;
    }
    return;
  }

  if (screenName === "detail") {
    detailScreen.hidden = false;
    return;
  }

  if (screenName === "stockIn") {
    stockInScreen.hidden = false;
    return;
  }

  if (screenName === "stockOut") {
    stockOutScreen.hidden = false;
    return;
  }

  if (screenName === "stockAdjust") {
    stockAdjustScreen.hidden = false;
    return;
  }

  if (screenName === "edit") {
    editScreen.hidden = false;
    return;
  }

  if (screenName === "unassignedLocation") {
    if (unassignedLocationScreen) {
      unassignedLocationScreen.hidden = false;
    }
    return;
  }

  homeScreen.hidden = false;
}

async function handleProductSubmit(event) {
  event.preventDefault();

  if (
    !(await requireAdminPermission(
      "商品の新規登録"
    ))
  ) {
    return;
  }

  const internalCode =
    internalCodeInput.value.trim();

  const productCode =
    productCodeInput.value.trim();

  const productName =
    productNameInput.value.trim();

  const janCode =
    janCodeInput.value.trim();

  const stock = Number(stockInput.value);

  const minStock =
    Number(minStockInput.value);

  const category =
    categoryInput.value.trim();

  const location =
    locationInput.value.trim();

  const supplier =
    supplierInput.value.trim();

  const orderRemaining =
    getValidStockNumber(
      orderRemainingInput
        ? orderRemainingInput.value
        : 0
    );

  const productStatus =
    getProductLifecycleStatus({
      productStatus:
        productStatusInput.value
    });

  const backorderStatus =
    getProductBackorderStatus({
      backorderStatus:
        backorderStatusInput
          ? backorderStatusInput.value
          : ""
    });

  if (!internalCode) {
    await showAppDialog({
      type: "warning",
      icon: "✏️",
      title: "社内コードを入力してください",
      message:
        "商品を登録するには、社内コードの入力が必要です。",
      confirmText: "入力に戻る"
    });

    internalCodeInput.focus();
    return;
  }

  if (!productName) {
    await showAppDialog({
      type: "warning",
      icon: "✏️",
      title: "商品名を入力してください",
      message:
        "商品を登録するには、商品名の入力が必要です。",
      confirmText: "入力に戻る"
    });

    productNameInput.focus();
    return;
  }

  if (stockInput.value.trim() === "") {
    await showAppDialog({
      type: "warning",
      icon: "🔢",
      title: "初期在庫数を入力してください",
      message:
        "初期在庫数は0以上の整数で入力してください。",
      details: [
        { label: "入力できる値", value: "0以上の整数" },
        { label: "入力例", value: "0、1、10" }
      ],
      confirmText: "入力に戻る"
    });

    stockInput.focus();
    return;
  }

  if (!location) {
    await showAppDialog({
      type: "warning",
      icon: "📍",
      title: "保管場所を選択してください",
      message:
        "商品を登録する保管場所を選択してください。",
      confirmText: "入力に戻る"
    });

    locationInput.focus();
    return;
  }

  if (!supplier) {
    await showAppDialog({
      type: "warning",
      icon: "🏢",
      title: "仕入先を入力してください",
      message:
        "商品を登録するには、仕入先の入力が必要です。",
      confirmText: "入力に戻る"
    });

    supplierInput.focus();
    return;
  }

  if (!Number.isInteger(stock) || stock < 0) {
    await showAppDialog({
      type: "warning",
      icon: "🔢",
      title: "初期在庫数を確認してください",
      message:
        "初期在庫数は0以上の整数で入力してください。",
      details: [
        {
          label: "入力値",
          value: stockInput.value || "未入力"
        },
        { label: "入力できる値", value: "0以上の整数" },
        { label: "入力例", value: "0、1、10" }
      ],
      confirmText: "入力に戻る"
    });

    stockInput.focus();
    return;
  }

  if (
    !Number.isInteger(minStock) ||
    minStock < 0
  ) {
    await showAppDialog({
      type: "warning",
      icon: "🔢",
      title: "最低在庫数を確認してください",
      message:
        "最低在庫数は0以上の整数で入力してください。",
      details: [
        {
          label: "入力値",
          value: minStockInput.value || "未入力"
        },
        { label: "入力できる値", value: "0以上の整数" },
        { label: "入力例", value: "0、5、20" }
      ],
      confirmText: "入力に戻る"
    });

    minStockInput.focus();
    return;
  }

  if (
    orderRemainingInput &&
    (
      orderRemainingInput.value.trim() === "" ||
      !Number.isInteger(Number(orderRemainingInput.value)) ||
      Number(orderRemainingInput.value) < 0
    )
  ) {
    await showAppDialog({
      type: "warning",
      icon: "📦",
      title: "発注残数を確認してください",
      message:
        "発注残数は0以上の整数で入力してください。",
      details: [
        {
          label: "入力値",
          value:
            orderRemainingInput.value ||
            "未入力"
        },
        {
          label: "入力例",
          value: "0、120、300"
        }
      ],
      confirmText: "入力に戻る"
    });

    orderRemainingInput.focus();
    return;
  }

  const duplicateInternalCode = products.find(
    function (product) {
      return (
        product.internalCode === internalCode
      );
    }
  );

  if (duplicateInternalCode) {
    await showAppDialog({
      type: "danger",
      icon: "🔎",
      title: "同じ社内コードが登録されています",
      message:
        "社内コードは商品の識別に使うため、同じ番号を重複して登録できません。",
      details: [
        {
          label: "社内コード",
          value: internalCode
        },
        {
          label: "登録済み商品",
          value:
            duplicateInternalCode.productName ||
            "商品名未登録"
        }
      ],
      confirmText: "入力に戻る"
    });

    internalCodeInput.focus();
    return;
  }


  const currentDateTime =
    new Date().toISOString();

  const newProduct = {
    internalCode: internalCode,
    productCode: productCode,
    productName: productName,
    janCode: janCode,
    stock: stock,
    minStock: minStock,
    category: category,
    location: location,
    locationStocks: getProductLocationStocks({
      stock: stock,
      location: location
    }),
    supplier: supplier,
    orderRemaining: orderRemaining,
    backorderStatus: backorderStatus,
    productStatus: productStatus,
    createdAt: currentDateTime,
    updatedAt: currentDateTime
  };

  const initialMovement = {
    id: createInitialMovementId(),
    dateTime: currentDateTime,
    internalCode: internalCode,
    productCode: productCode,
    productName: productName,
    janCode: janCode,
    type: "初期登録",
    quantity: stock,
    beforeStock: 0,
    afterStock: stock,
    person: "商品登録時",
    reason: "初期登録",
    memo: "",
    location: location,
    beforeLocationStock: 0,
    afterLocationStock: stock
  };

  try {
    await saveProductAndMovement(
      newProduct,
      initialMovement
    );

    products.push(
      normalizeProductData(newProduct)
    );

    sortProducts();
    updateSummary();

    productForm.reset();
    stockInput.value = 0;
    minStockInput.value = 0;

    if (orderRemainingInput) {
      orderRemainingInput.value = 0;
    }

    productStatusInput.value =
      "通常商品";

    if (backorderStatusInput) {
      backorderStatusInput.value = "";
    }

    productSearchInput.value = "";

    displayCurrentProducts();

    await showAppDialog({
      type: "success",
      icon: "✅",
      title: "商品を登録しました",
      message:
        "商品マスタへの登録が完了しました。",
      details: [
        {
          label: "商品名",
          value: productName
        },
        {
          label: "社内コード",
          value: internalCode
        },
        {
          label: "初期在庫",
          value: `${stock}個`
        },
        {
          label: "保管場所",
          value: location || "未設定"
        }
      ],
      confirmText: "閉じる"
    });

    showScreen("list");
  } catch (error) {
    console.error(error);

    if (
      error &&
      error.name === "ConstraintError"
    ) {
      await showAppDialog({
        type: "danger",
        icon: "🔎",
        title: "同じ社内コードが登録されています",
        message:
          "保存時に社内コードの重複が確認されました。社内コードを変更して、もう一度登録してください。",
        details: [
          {
            label: "社内コード",
            value: internalCode
          }
        ],
        confirmText: "入力に戻る"
      });

      return;
    }

    await showAppDialog({
      type: "danger",
      icon: "⚠️",
      title: "商品を保存できませんでした",
      message:
        "商品登録の保存処理でエラーが発生しました。入力内容を確認して、もう一度お試しください。",
      confirmText: "閉じる"
    });
  }
}

async function openMovementHistoryScreen() {
  showScreen("history");
  moveToMovementHistoryScreen();

  movementHistoryCount.textContent =
    "履歴を読み込んでいます。";

  movementHistoryBody.innerHTML = `
    <tr>
      <td colspan="11">
        履歴を読み込んでいます。
      </td>
    </tr>
  `;

  try {
    const movements =
      await getAllStockMovements();

    movements.sort(
      function (movementA, movementB) {
        const dateA = new Date(
          movementA.dateTime
        ).getTime();

        const dateB = new Date(
          movementB.dateTime
        ).getTime();

        return dateB - dateA;
      }
    );

    displayStockMovements(movements);
  } catch (error) {
    console.error(error);

    movementHistoryCount.textContent =
      "履歴を読み込めませんでした。";

    movementHistoryBody.innerHTML = `
      <tr>
        <td colspan="11">
          入出庫履歴を読み込めませんでした。
        </td>
      </tr>
    `;

    await showAppDialog({
      type: "danger",
      icon: "⚠️",
      title: "入出庫履歴を読み込めませんでした",
      message:
        "保存されている入出庫履歴を読み込めませんでした。画面を更新して、もう一度お試しください。",
      confirmText: "閉じる"
    });
  }
}


function moveToMovementHistoryScreen() {
  window.requestAnimationFrame(
    function () {
      if (!historyScreen) {
        return;
      }

      historyScreen.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    }
  );
}

function displayStockMovements(movements) {
  movementHistoryBody.innerHTML = "";

  movementHistoryCount.textContent =
    `履歴件数：${movements.length}件`;

  if (movements.length === 0) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");

    cell.colSpan = 11;

    cell.textContent =
      "入出庫履歴はまだありません。";

    row.appendChild(cell);
    movementHistoryBody.appendChild(row);

    return;
  }

  movements.forEach(function (movement) {
    const row = document.createElement("tr");

    if (movement.type === "入庫") {
      row.classList.add("movement-in");
    } else if (movement.type === "出庫") {
      row.classList.add("movement-out");
    } else {
      row.classList.add("movement-other");
    }

    appendTableCell(
      row,
      formatDateTime(movement.dateTime)
    );

    appendTableCell(
      row,
      movement.internalCode || "未登録"
    );

    appendTableCell(
      row,
      movement.productCode || "未登録"
    );

    appendTableCell(
      row,
      movement.productName || "未登録"
    );

    appendTableCell(
      row,
      movement.type || "未登録"
    );

    appendTableCell(
      row,
      formatMovementQuantity(movement)
    );

    appendTableCell(
      row,
      movement.beforeStock ?? 0
    );

    appendTableCell(
      row,
      movement.afterStock ?? 0
    );

    appendTableCell(
      row,
      movement.person || "未入力"
    );

    appendTableCell(
      row,
      movement.reason || "未入力"
    );

    appendTableCell(
      row,
      movement.memo || ""
    );

    movementHistoryBody.appendChild(row);
  });
}

function formatMovementQuantity(movement) {
  const quantity = Number(
    movement.quantity || 0
  );

  if (movement.type === "入庫") {
    return `＋${quantity}`;
  }

  if (movement.type === "出庫") {
    return `－${Math.abs(quantity)}`;
  }

  if (movement.type === "数量調整") {
    if (quantity > 0) {
      return `＋${quantity}`;
    }

    return String(quantity);
  }

  return String(quantity);
}

function openDetailScreen(internalCode) {
  const selectedProduct =
    getProductByInternalCode(internalCode);

  if (!selectedProduct) {
    void showAppDialog({
      type: "danger",
      icon: "🔎",
      title: "商品情報が見つかりません",
      message:
        "指定した商品を確認できませんでした。商品一覧を更新して、もう一度お試しください。",
      details: [
        {
          label: "社内コード",
          value: internalCode || "未指定"
        }
      ],
      confirmText: "閉じる"
    });

    return;
  }

  detailInternalCodeValue =
    selectedProduct.internalCode;

  detailInternalCode.textContent =
    selectedProduct.internalCode;

  detailProductCode.textContent =
    selectedProduct.productCode;

  detailProductName.textContent =
    selectedProduct.productName;

  detailJanCode.textContent =
    selectedProduct.janCode || "未登録";

  detailStock.textContent =
    `${selectedProduct.stock}個`;

  detailMinStock.textContent =
    `${getMinimumStock(selectedProduct)}個`;

  detailStockStatus.textContent =
    getStockStatus(selectedProduct);

  detailStockStatus.className = "";

  if (getStockStatus(selectedProduct) === "廃盤") {
    detailStockStatus.classList.add(
      "detail-status-discontinued"
    );
  } else if (
    getStockStatus(selectedProduct) === "注残"
  ) {
    detailStockStatus.classList.add(
      "detail-status-backorder"
    );
  } else if (
    getStockStatus(selectedProduct) === "在庫切れ"
  ) {
    detailStockStatus.classList.add(
      "detail-status-out"
    );
  } else if (
    getStockStatus(selectedProduct) === "要補充"
  ) {
    detailStockStatus.classList.add(
      "detail-status-low"
    );
  } else {
    detailStockStatus.classList.add(
      "detail-status-normal"
    );
  }

  detailCategory.textContent =
    selectedProduct.category || "未登録";

  detailLocation.textContent =
    selectedProduct.location || "未登録";

  renderDetailLocationStocks(
    selectedProduct
  );

  detailSupplier.textContent =
    selectedProduct.supplier;

  if (detailOrderRemaining) {
    detailOrderRemaining.textContent =
      `${getOrderRemaining(
        selectedProduct
      ).toLocaleString("ja-JP")}個`;
  }

  const productLifecycleStatus =
    getProductLifecycleStatus(
      selectedProduct
    );

  detailProductStatus.textContent =
    productLifecycleStatus;

  detailProductStatus.className =
    productLifecycleStatus === "廃盤"
      ? "detail-product-discontinued"
      : productLifecycleStatus === "廃盤予定"
        ? "detail-product-planned"
        : productLifecycleStatus === "専用商品"
          ? "detail-product-dedicated"
          : "detail-product-active";

  detailUpdatedAt.textContent =
    formatDateTime(selectedProduct.updatedAt);

  showScreen("detail");
}

function openEditScreen(internalCode) {
  const selectedProduct =
    getProductByInternalCode(internalCode);

  if (!selectedProduct) {
    void showAppDialog({
      type: "danger",
      icon: "🔎",
      title: "編集する商品が見つかりません",
      message:
        "編集対象の商品を確認できませんでした。商品一覧を更新して、もう一度お試しください。",
      details: [
        {
          label: "社内コード",
          value: internalCode || "未指定"
        }
      ],
      confirmText: "閉じる"
    });

    return;
  }

  editingInternalCode =
    selectedProduct.internalCode;

  editInternalCodeInput.value =
    selectedProduct.internalCode;

  editProductCodeInput.value =
    selectedProduct.productCode;

  editProductNameInput.value =
    selectedProduct.productName;

  editJanCodeInput.value =
    selectedProduct.janCode || "";

  editStockInput.value =
    selectedProduct.stock;

  editMinStockInput.value =
    getMinimumStock(selectedProduct);

  editCategoryInput.value =
    selectedProduct.category || "";

  editLocationInput.value =
    isValidProductLocation(
      selectedProduct.location
    )
      ? selectedProduct.location
      : "";

  editSupplierInput.value =
    selectedProduct.supplier;

  if (editOrderRemainingInput) {
    editOrderRemainingInput.value =
      getOrderRemaining(
        selectedProduct
      );
  }

  editProductStatusInput.value =
    getProductLifecycleStatus(
      selectedProduct
    );

  if (editBackorderStatusInput) {
    editBackorderStatusInput.value =
      getProductBackorderStatus(
        selectedProduct
      );
  }

  showScreen("edit");
  editProductCodeInput.focus();
}

async function handleEditProductSubmit(event) {
  event.preventDefault();

  if (
    !(await requireAdminPermission(
      "商品情報の編集"
    ))
  ) {
    return;
  }

  if (editingInternalCode === "") {
    await showAppDialog({
      type: "warning",
      icon: "⚠️",
      title: "編集する商品が選択されていません",
      message:
        "商品一覧から編集する商品を選択して、もう一度お試しください。",
      confirmText: "商品一覧へ戻る"
    });

    showScreen("list");
    return;
  }

  const currentProduct =
    getProductByInternalCode(
      editingInternalCode
    );

  if (!currentProduct) {
    await showAppDialog({
      type: "danger",
      icon: "🔎",
      title: "編集する商品が見つかりません",
      message:
        "編集中の商品を確認できませんでした。商品一覧からもう一度選び直してください。",
      details: [
        {
          label: "社内コード",
          value: editingInternalCode
        }
      ],
      confirmText: "商品一覧へ戻る"
    });

    showScreen("list");
    return;
  }

  const productCode =
    editProductCodeInput.value.trim();

  const productName =
    editProductNameInput.value.trim();

  const janCode =
    editJanCodeInput.value.trim();

  const minStock =
    Number(editMinStockInput.value);

  const category =
    editCategoryInput.value.trim();

  const location =
    editLocationInput.value.trim();

  const supplier =
    editSupplierInput.value.trim();

  const orderRemaining =
    getValidStockNumber(
      editOrderRemainingInput
        ? editOrderRemainingInput.value
        : getOrderRemaining(
            currentProduct
          )
    );

  const productStatus =
    getProductLifecycleStatus({
      productStatus:
        editProductStatusInput.value
    });

  const backorderStatus =
    getProductBackorderStatus({
      backorderStatus:
        editBackorderStatusInput
          ? editBackorderStatusInput.value
          : ""
    });

  if (!productName) {
    await showAppDialog({
      type: "warning",
      icon: "✏️",
      title: "商品名を入力してください",
      message:
        "商品情報を保存するには、商品名の入力が必要です。",
      confirmText: "入力に戻る"
    });

    editProductNameInput.focus();
    return;
  }

  if (!location) {
    await showAppDialog({
      type: "warning",
      icon: "📍",
      title: "保管場所を選択してください",
      message:
        "商品情報を保存するには、保管場所の選択が必要です。",
      confirmText: "入力に戻る"
    });

    editLocationInput.focus();
    return;
  }

  if (!supplier) {
    await showAppDialog({
      type: "warning",
      icon: "🏢",
      title: "仕入先を入力してください",
      message:
        "商品情報を保存するには、仕入先の入力が必要です。",
      confirmText: "入力に戻る"
    });

    editSupplierInput.focus();
    return;
  }

  if (
    !Number.isInteger(minStock) ||
    minStock < 0
  ) {
    await showAppDialog({
      type: "warning",
      icon: "🔢",
      title: "最低在庫数を確認してください",
      message:
        "最低在庫数は0以上の整数で入力してください。",
      details: [
        {
          label: "入力値",
          value: editMinStockInput.value || "未入力"
        },
        { label: "入力できる値", value: "0以上の整数" },
        { label: "入力例", value: "0、5、20" }
      ],
      confirmText: "入力に戻る"
    });

    editMinStockInput.focus();
    return;
  }

  if (
    editOrderRemainingInput &&
    (
      editOrderRemainingInput.value.trim() === "" ||
      !Number.isInteger(Number(editOrderRemainingInput.value)) ||
      Number(editOrderRemainingInput.value) < 0
    )
  ) {
    await showAppDialog({
      type: "warning",
      icon: "📦",
      title: "発注残数を確認してください",
      message:
        "発注残数は0以上の整数で入力してください。",
      details: [
        {
          label: "入力値",
          value:
            editOrderRemainingInput.value ||
            "未入力"
        },
        {
          label: "入力例",
          value: "0、120、300"
        }
      ],
      confirmText: "入力に戻る"
    });

    editOrderRemainingInput.focus();
    return;
  }


  const updatedProduct = {
    internalCode: editingInternalCode,
    productCode: productCode,
    productName: productName,
    janCode: janCode,
    stock: Number(currentProduct.stock),
    minStock: minStock,
    category: category,
    location: location,
    locationStocks:
      getLocationStocksAfterPrimaryLocationChange(
        currentProduct,
        location
      ),
    supplier: supplier,
    orderRemaining: orderRemaining,
    backorderStatus: backorderStatus,
    productStatus: productStatus,
    createdAt:
      currentProduct.createdAt ||
      new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  try {
    await updateProduct(updatedProduct);

    applyUpdatedProduct(updatedProduct);

    editingInternalCode = "";

    productSearchInput.value = "";

    await showAppDialog({
      type: "success",
      icon: "✅",
      title: "商品情報を変更しました",
      message:
        "商品マスタの基本情報を更新しました。",
      details: [
        {
          label: "商品名",
          value: updatedProduct.productName
        },
        {
          label: "社内コード",
          value: updatedProduct.internalCode
        },
        {
          label: "主な保管場所",
          value: updatedProduct.location || "未設定"
        }
      ],
      confirmText: "閉じる"
    });

    openDetailScreen(
      updatedProduct.internalCode
    );
  } catch (error) {
    console.error(error);

    await showAppDialog({
      type: "danger",
      icon: "⚠️",
      title: "商品情報を保存できませんでした",
      message:
        "商品情報の更新処理でエラーが発生しました。入力内容を確認して、もう一度お試しください。",
      confirmText: "閉じる"
    });
  }
}

function showAppDialog(options) {
  const dialogOptions = options || {};

  return new Promise(
    function (resolve) {
      const existingDialog =
        document.querySelector("#app-common-dialog");

      if (existingDialog) {
        existingDialog.remove();
      }

      const overlay =
        document.createElement("div");
      overlay.id = "app-common-dialog";
      overlay.className = "app-dialog-overlay";
      overlay.setAttribute(
        "role",
        dialogOptions.isConfirm
          ? "dialog"
          : "alertdialog"
      );
      overlay.setAttribute(
        "aria-modal",
        "true"
      );

      const modal =
        document.createElement("div");
      const type =
        dialogOptions.type || "info";
      modal.className =
        `app-dialog-modal app-dialog-${type}`;

      const header =
        document.createElement("div");
      header.className = "app-dialog-header";

      const icon =
        document.createElement("div");
      icon.className = "app-dialog-icon";
      icon.textContent =
        dialogOptions.icon || "ℹ️";
      icon.setAttribute(
        "aria-hidden",
        "true"
      );

      const title =
        document.createElement("h2");
      title.className = "app-dialog-title";
      title.textContent =
        dialogOptions.title || "お知らせ";

      header.appendChild(icon);
      header.appendChild(title);

      const content =
        document.createElement("div");
      content.className = "app-dialog-content";

      if (dialogOptions.message) {
        const message =
          document.createElement("p");
        message.className = "app-dialog-message";
        message.textContent =
          String(dialogOptions.message);
        content.appendChild(message);
      }

      if (
        Array.isArray(dialogOptions.details) &&
        dialogOptions.details.length > 0
      ) {
        const details =
          document.createElement("div");
        details.className = "app-dialog-details";

        dialogOptions.details.forEach(
          function (detail) {
            const row =
              document.createElement("div");
            row.className = "app-dialog-detail-row";

            const label =
              document.createElement("strong");
            label.textContent =
              String(detail.label || "");

            const value =
              document.createElement("span");
            value.textContent =
              String(detail.value ?? "");

            row.appendChild(label);
            row.appendChild(value);
            details.appendChild(row);
          }
        );

        content.appendChild(details);
      }

      if (dialogOptions.notice) {
        const notice =
          document.createElement("div");
        notice.className = "app-dialog-notice";
        notice.textContent =
          String(dialogOptions.notice);
        content.appendChild(notice);
      }

      const actions =
        document.createElement("div");
      actions.className = "app-dialog-actions";

      let cancelButton = null;

      if (dialogOptions.isConfirm) {
        cancelButton =
          document.createElement("button");
        cancelButton.type = "button";
        cancelButton.className =
          "app-dialog-button app-dialog-cancel";
        cancelButton.textContent =
          dialogOptions.cancelText || "戻る";
        actions.appendChild(cancelButton);
      }

      const confirmButton =
        document.createElement("button");
      confirmButton.type = "button";
      confirmButton.className =
        "app-dialog-button app-dialog-confirm";
      confirmButton.textContent =
        dialogOptions.confirmText ||
        (dialogOptions.isConfirm
          ? "確認する"
          : "閉じる");
      actions.appendChild(confirmButton);

      modal.appendChild(header);
      modal.appendChild(content);
      modal.appendChild(actions);
      overlay.appendChild(modal);
      document.body.appendChild(overlay);
      document.body.classList.add(
        "app-dialog-open"
      );

      let finished = false;

      function finish(result) {
        if (finished) {
          return;
        }

        finished = true;
        overlay.remove();
        document.body.classList.remove(
          "app-dialog-open"
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
            finish(false);
          }
        }
      );

      window.setTimeout(
        function () {
          if (cancelButton) {
            cancelButton.focus();
          } else {
            confirmButton.focus();
          }
        },
        0
      );
    }
  );
}

async function handleDeleteProduct(internalCode) {
  if (
    !(await requireAdminPermission(
      "商品の削除"
    ))
  ) {
    return false;
  }

  const selectedProduct =
    getProductByInternalCode(internalCode);

  if (!selectedProduct) {
    await showAppDialog({
      type: "danger",
      icon: "⚠️",
      title: "商品を確認できません",
      message:
        "削除する商品が見つかりませんでした。画面を更新して、もう一度確認してください。",
      confirmText: "閉じる"
    });

    return false;
  }

  const isConfirmed =
    await showAppDialog({
      type: "danger",
      icon: "🗑️",
      title: "商品を削除しますか？",
      message:
        "次の商品を削除しようとしています。内容を確認してください。",
      details: [
        {
          label: "商品名",
          value:
            selectedProduct.productName ||
            "商品名未登録"
        },
        {
          label: "社内コード",
          value:
            selectedProduct.internalCode || "-"
        },
        {
          label: "商品コード",
          value:
            selectedProduct.productCode || "未登録"
        },
        {
          label: "現在庫数",
          value:
            `${Number(selectedProduct.stock) || 0}個`
        }
      ],
      notice:
        "この操作は元に戻せません。過去の入出庫履歴は削除されません。",
      isConfirm: true,
      cancelText: "戻る",
      confirmText: "商品を削除する"
    });

  if (!isConfirmed) {
    return false;
  }

  try {
    await deleteProduct(internalCode);

    products = products.filter(
      function (product) {
        return (
          product.internalCode !== internalCode
        );
      }
    );

    updateSummary();
    displayCurrentProducts();

    await showAppDialog({
      type: "success",
      icon: "✅",
      title: "商品を削除しました",
      message:
        "商品マスタから削除しました。過去の入出庫履歴はそのまま残っています。",
      confirmText: "閉じる"
    });

    return true;
  } catch (error) {
    console.error(error);

    await showAppDialog({
      type: "danger",
      icon: "⚠️",
      title: "商品を削除できませんでした",
      message:
        "削除処理でエラーが発生しました。画面を更新して、もう一度お試しください。",
      confirmText: "閉じる"
    });

    return false;
  }
}

function getProductByInternalCode(
  internalCode
) {
  return products.find(
    function (product) {
      return (
        product.internalCode === internalCode
      );
    }
  );
}

const PRODUCT_LOCATION_OPTIONS = Object.freeze([
  "酒本倉庫1階",
  "酒本倉庫2階",
  "本社1階　A区",
  "本社1階　B区",
  "本社1階　C区",
  "本社1階　D区",
  "本社1階　E区",
  "本社1階　F区",
  "本社2階　A区",
  "本社2階　B区",
  "本社2階　C区",
  "本社2階　D区",
  "本社2階　E区",
  "本社2階　F区"
]);

function isValidProductLocation(value) {
  return PRODUCT_LOCATION_OPTIONS.includes(
    String(value || "").trim()
  );
}

function applyUpdatedProduct(updatedProduct) {
  const normalizedProduct =
    normalizeProductData(updatedProduct);

  const productIndex = products.findIndex(
    function (product) {
      return (
        product.internalCode ===
        normalizedProduct.internalCode
      );
    }
  );

  if (productIndex === -1) {
    products.push(normalizedProduct);
  } else {
    products[productIndex] =
      normalizedProduct;
  }

  sortProducts();
  updateSummary();
  displayCurrentProducts();
}

function normalizeProductData(product) {
  const normalizedLocationProduct =
    normalizeProductLocationStocks(
      product
    );

  return {
    ...normalizedLocationProduct,
    stock: getValidStockNumber(
      normalizedLocationProduct.stock
    ),
    minStock: getValidStockNumber(
      normalizedLocationProduct.minStock
    ),
    orderRemaining:
      getOrderRemaining(
        normalizedLocationProduct
      ),
    productStatus:
      getProductLifecycleStatus(
        normalizedLocationProduct
      ),
    backorderStatus:
      getProductBackorderStatus(
        normalizedLocationProduct
      )
  };
}

function renderDetailLocationStocks(product) {
  if (!detailLocationStocks) {
    return;
  }

  const locationStocks =
    getProductLocationStocks(product);

  detailLocationStocks.innerHTML = "";

  if (locationStocks.length === 0) {
    detailLocationStocks.textContent =
      "場所別在庫はありません。";
    return;
  }

  locationStocks.forEach(function (entry) {
    const line = document.createElement("div");
    line.textContent =
      `${entry.location}：` +
      `${Number(entry.stock || 0).toLocaleString("ja-JP")}個`;
    detailLocationStocks.appendChild(line);
  });
}

function getProductLifecycleStatus(
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

  if (
    savedStatus === "専用商品" ||
    savedStatus === "専用" ||
    savedStatus === "dedicated" ||
    savedStatus === "exclusive"
  ) {
    return "専用商品";
  }

  if (
    savedStatus === "廃盤予定" ||
    savedStatus === "discontinued planned" ||
    savedStatus === "planned discontinued" ||
    savedStatus === "planned-discontinued"
  ) {
    return "廃盤予定";
  }

  if (
    savedStatus === "廃盤" ||
    savedStatus ===
      "discontinued" ||
    savedStatus === "inactive" ||
    (
      product &&
      product.discontinued === true
    )
  ) {
    return "廃盤";
  }

  return "通常商品";
}

function getProductBackorderStatus(product) {
  const savedStatus =
    String(
      product &&
      (
        product.backorderStatus ||
        product.inventoryStatus ||
        ""
      )
    )
      .normalize("NFKC")
      .trim()
      .toLowerCase();

  if (
    savedStatus === "注残" ||
    savedStatus === "backorder" ||
    savedStatus === "backordered" ||
    (
      product &&
      product.backorder === true
    )
  ) {
    return "注残";
  }

  return "";
}

function isProductBackorder(product) {
  return (
    getProductBackorderStatus(product) ===
    "注残"
  );
}

function getValidStockNumber(value) {
  const numberValue = Number(value);

  if (
    !Number.isInteger(numberValue) ||
    numberValue < 0
  ) {
    return 0;
  }

  return numberValue;
}

function getOrderRemaining(product) {
  return getValidStockNumber(
    product &&
      product.orderRemaining
  );
}

function getMinimumStock(product) {
  return getValidStockNumber(
    product.minStock
  );
}

function getBaseStockStatus(product) {
  if (
    getProductLifecycleStatus(product) ===
    "廃盤"
  ) {
    return "廃盤";
  }

  const currentStock =
    getValidStockNumber(product.stock);

  const minimumStock =
    getMinimumStock(product);

  if (currentStock === 0) {
    return "在庫切れ";
  }

  if (
    minimumStock > 0 &&
    currentStock <= minimumStock
  ) {
    return "要補充";
  }

  return "正常";
}

function getStockStatus(product) {
  const baseStatus =
    getBaseStockStatus(product);

  if (baseStatus === "廃盤") {
    return "廃盤";
  }

  if (isProductBackorder(product)) {
    return "注残";
  }

  return baseStatus;
}

function createProductSortControls() {
  if (
    document.querySelector(
      "#product-sort-select"
    )
  ) {
    productSortSelect =
      document.querySelector(
        "#product-sort-select"
      );

    return;
  }

  const searchArea =
    productSearchInput.parentElement;

  const sortArea =
    document.createElement("div");

  sortArea.classList.add(
    "product-sort-area"
  );

  const sortLabel =
    document.createElement("label");

  sortLabel.htmlFor =
    "product-sort-select";

  sortLabel.textContent =
    "商品を並べ替える";

  productSortSelect =
    document.createElement("select");

  productSortSelect.id =
    "product-sort-select";

  const sortOptions = [
    {
      value: "internal-code",
      label: "社内コード順"
    },
    {
      value: "product-name",
      label: "商品名順"
    },
    {
      value: "stock-asc",
      label: "在庫数の少ない順"
    },
    {
      value: "stock-desc",
      label: "在庫数の多い順"
    },
    {
      value: "updated-desc",
      label: "更新日の新しい順"
    },
    {
      value: "location",
      label: "保管場所順"
    }
  ];

  sortOptions.forEach(
    function (optionData) {
      const option =
        document.createElement("option");

      option.value =
        optionData.value;

      option.textContent =
        optionData.label;

      productSortSelect.appendChild(
        option
      );
    }
  );

  productSortSelect.addEventListener(
    "change",
    displayCurrentProducts
  );

  sortArea.appendChild(
    sortLabel
  );

  sortArea.appendChild(
    productSortSelect
  );

  searchArea.insertBefore(
    sortArea,
    clearSearchButton
  );

  createProductSortStyle();
}

function createProductSortStyle() {
  if (
    document.querySelector(
      "#product-sort-style"
    )
  ) {
    return;
  }

  const styleElement =
    document.createElement("style");

  styleElement.id =
    "product-sort-style";

  styleElement.textContent = `
    .product-sort-area {
      margin: 16px 0;
      padding: 14px;
      border: 2px solid #90caf9;
      border-radius: 10px;
      background-color: #f7fbff;
    }

    .product-sort-area label {
      display: block;
      margin-bottom: 8px;
      font-weight: bold;
    }

    #product-sort-select {
      width: 100%;
      max-width: 440px;
      min-height: 48px;
      padding: 8px;
      font-size: 18px;
    }
  `;

  document.head.appendChild(
    styleElement
  );
}

function createProductListResponsiveStyle() {
  if (
    document.querySelector(
      "#product-list-responsive-style"
    )
  ) {
    return;
  }

  const styleElement =
    document.createElement("style");

  styleElement.id =
    "product-list-responsive-style";

  styleElement.textContent = `
    #product-list .product-list-table-area {
      width: 100%;
      margin: 16px 0 22px;
      overflow-x: auto;
      border: 1px solid #cfd8dc;
      border-radius: 12px;
      background-color: #ffffff;
      box-sizing: border-box;
    }

    #product-list .product-list-table {
      width: 100%;
      min-width: 1450px;
      margin: 0;
      border-collapse: separate;
      border-spacing: 0;
    }

    #product-list .product-list-table th,
    #product-list .product-list-table td {
      white-space: nowrap;
    }

    #product-list .product-list-table thead
    .product-list-operation-cell {
      position: sticky;
      left: 0;
      z-index: 5;
      min-width: 170px;
      background-color: #1565c0;
      color: #ffffff;
      box-shadow: 5px 0 9px rgba(38, 50, 56, 0.18);
    }

    #product-list .product-list-card-row
    .product-list-operation-cell {
      position: sticky;
      left: 0;
      z-index: 3;
      min-width: 170px;
      background-color: #ffffff;
      box-shadow: 5px 0 9px rgba(38, 50, 56, 0.13);
    }

    #product-list .stock-out-row
    .product-list-operation-cell {
      background-color: #ffebee;
    }

    #product-list .stock-low-row
    .product-list-operation-cell {
      background-color: #fff8e1;
    }

    #product-list .product-discontinued-row
    .product-list-operation-cell {
      background-color: #f2f4f5;
    }

    .product-list-operation-buttons {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      min-width: 150px;
    }

    .product-list-operation-buttons button {
      width: auto;
      min-width: 46px;
      margin: 0;
      padding: 8px 10px;
      border-radius: 7px;
      font-size: 14px;
      line-height: 1.2;
    }

    .product-list-detail-button {
      background-color: #1565c0;
    }

    .product-list-edit-button {
      background-color: #0277bd;
    }

    .product-list-delete-button {
      background-color: #c62828;
    }

    .product-list-name-button {
      width: auto;
      max-width: 360px;
      margin: 0;
      padding: 3px 0;
      border: 0;
      border-radius: 0;
      background: transparent;
      color: #0d47a1;
      font: inherit;
      font-weight: 700;
      text-align: left;
      text-decoration: underline;
      text-underline-offset: 3px;
      white-space: normal;
      overflow-wrap: anywhere;
      cursor: pointer;
    }

    .product-list-name-button:hover,
    .product-list-name-button:focus-visible {
      background: transparent;
      color: #1565c0;
      outline: 3px solid #90caf9;
      outline-offset: 3px;
    }

    @media (max-width: 700px) {
      #product-list .product-list-table-area {
        overflow-x: visible;
        border: 0;
        border-radius: 0;
        background-color: transparent;
      }

      #product-list .product-list-table,
      #product-list .product-list-table tbody {
        display: block;
        width: 100%;
        min-width: 0;
      }

      #product-list .product-list-table thead {
        display: none;
      }

      #product-list #product-table-body {
        display: grid;
        gap: 16px;
      }

      #product-list #product-table-body > tr:not(.product-list-card-row) {
        display: block;
        width: 100%;
      }

      #product-list #product-table-body > tr:not(.product-list-card-row) td {
        display: block;
        width: 100%;
        padding: 18px;
        border: 1px solid #cfd8dc;
        border-radius: 12px;
        text-align: center;
        box-sizing: border-box;
      }

      #product-list .product-list-card-row {
        display: grid;
        grid-template-columns:
          minmax(0, 1fr)
          minmax(0, 1fr);
        grid-template-areas:
          "name name"
          "lifecycle stockstatus"
          "internal internal"
          "product product"
          "jan jan"
          "stock minstock"
          "category category"
          "location location"
          "supplier supplier"
          "operation operation";
        gap: 0 10px;
        width: 100%;
        padding: 16px;
        border: 2px solid #d7dee5;
        border-radius: 16px;
        background-color: #ffffff;
        box-shadow: 0 4px 14px rgba(38, 50, 56, 0.12);
        box-sizing: border-box;
      }

      #product-list .product-list-card-row.stock-out-row {
        border-color: #ef9a9a;
      }

      #product-list .product-list-card-row.stock-low-row {
        border-color: #ffcc80;
      }

      #product-list .product-list-card-row.product-discontinued-row {
        border-color: #b0bec5;
        background-color: #f7f8f9 !important;
      }

      #product-list .product-list-card-row > td {
        display: block;
        width: auto;
        min-width: 0;
        padding: 8px 0;
        border: 0;
        background: transparent;
        white-space: normal;
        overflow-wrap: anywhere;
        box-sizing: border-box;
      }

      #product-list .product-list-cell-product-name {
        grid-area: name;
        padding: 3px 0 13px;
        border-bottom: 1px solid #e0e6ea;
      }

      #product-list .product-list-name-button {
        width: 100%;
        max-width: none;
        padding: 0;
        color: #17202a;
        font-size: 23px;
        font-weight: 800;
        line-height: 1.35;
        text-decoration-color: #90caf9;
      }

      #product-list .product-list-cell-internal-code {
        grid-area: internal;
      }

      #product-list .product-list-cell-product-code {
        grid-area: product;
      }

      #product-list .product-list-cell-jan-code {
        grid-area: jan;
      }

      #product-list .product-list-cell-category {
        grid-area: category;
      }

      #product-list .product-list-cell-location {
        grid-area: location;
      }

      #product-list .product-list-cell-supplier {
        grid-area: supplier;
      }

      #product-list .product-list-cell-internal-code,
      #product-list .product-list-cell-product-code,
      #product-list .product-list-cell-jan-code,
      #product-list .product-list-cell-category,
      #product-list .product-list-cell-location,
      #product-list .product-list-cell-supplier {
        display: grid;
        grid-template-columns: 112px minmax(0, 1fr);
        gap: 8px;
        align-items: start;
        color: #263238;
        font-size: 16px;
      }

      #product-list .product-list-cell-internal-code::before,
      #product-list .product-list-cell-product-code::before,
      #product-list .product-list-cell-jan-code::before,
      #product-list .product-list-cell-category::before,
      #product-list .product-list-cell-location::before,
      #product-list .product-list-cell-supplier::before {
        content: attr(data-label);
        color: #546e7a;
        font-weight: 700;
      }

      #product-list .product-list-cell-stock,
      #product-list .product-list-cell-min-stock {
        margin-top: 10px;
        padding: 12px 8px;
        border-radius: 10px;
        background-color: #e8f1fd;
        color: #1565c0;
        text-align: center;
        font-size: 24px;
        font-weight: 800;
      }

      #product-list .product-list-cell-stock {
        grid-area: stock;
      }

      #product-list .product-list-cell-min-stock {
        grid-area: minstock;
        background-color: #f3e5f5;
        color: #6a1b9a;
      }

      #product-list .product-list-cell-stock::before,
      #product-list .product-list-cell-min-stock::before {
        content: attr(data-label);
        display: block;
        margin-bottom: 5px;
        color: #455a64;
        font-size: 14px;
        font-weight: 700;
      }

      #product-list .product-list-cell-stock-status {
        grid-area: stockstatus;
        text-align: right;
      }

      #product-list .product-list-cell-product-status {
        grid-area: lifecycle;
      }

      #product-list .product-list-cell-stock-status::before,
      #product-list .product-list-cell-product-status::before {
        content: attr(data-label);
        display: block;
        margin-bottom: 5px;
        color: #546e7a;
        font-size: 13px;
        font-weight: 700;
      }

      #product-list .product-list-operation-cell {
        grid-area: operation;
        position: static;
        min-width: 0;
        padding-top: 14px;
        border-top: 1px solid #e0e6ea;
        box-shadow: none;
        background: transparent !important;
      }

      #product-list .product-list-operation-buttons {
        display: grid;
        grid-template-columns:
          minmax(0, 1fr)
          minmax(0, 1fr);
        gap: 9px;
        min-width: 0;
      }

      #product-list .product-list-operation-buttons button {
        width: 100%;
        min-width: 0;
        margin: 0;
        padding: 13px 8px;
        font-size: 16px;
        font-weight: 700;
      }

      #product-list .product-list-detail-button {
        grid-column: 1 / -1;
      }
    }

    @media (max-width: 390px) {
      #product-list .product-list-card-row {
        padding: 13px;
      }

      #product-list .product-list-name-button {
        font-size: 20px;
      }

      #product-list .product-list-cell-internal-code,
      #product-list .product-list-cell-product-code,
      #product-list .product-list-cell-jan-code,
      #product-list .product-list-cell-category,
      #product-list .product-list-cell-location,
      #product-list .product-list-cell-supplier {
        grid-template-columns: 100px minmax(0, 1fr);
        font-size: 15px;
      }
    }
  `;

  document.head.appendChild(
    styleElement
  );
}

function sortDisplayedProducts(
  targetProducts
) {
  const sortedProducts = [
    ...targetProducts
  ];

  const sortType =
    productSortSelect
      ? productSortSelect.value
      : "internal-code";

  sortedProducts.sort(
    function (
      productA,
      productB
    ) {
      if (
        sortType ===
        "product-name"
      ) {
        return compareProductText(
          productA.productName,
          productB.productName
        );
      }

      if (
        sortType ===
        "stock-asc"
      ) {
        const stockDifference =
          getValidStockNumber(
            productA.stock
          ) -
          getValidStockNumber(
            productB.stock
          );

        if (stockDifference !== 0) {
          return stockDifference;
        }

        return compareProductText(
          productA.productName,
          productB.productName
        );
      }

      if (
        sortType ===
        "stock-desc"
      ) {
        const stockDifference =
          getValidStockNumber(
            productB.stock
          ) -
          getValidStockNumber(
            productA.stock
          );

        if (stockDifference !== 0) {
          return stockDifference;
        }

        return compareProductText(
          productA.productName,
          productB.productName
        );
      }

      if (
        sortType ===
        "updated-desc"
      ) {
        const dateDifference =
          getProductUpdatedTime(
            productB
          ) -
          getProductUpdatedTime(
            productA
          );

        if (dateDifference !== 0) {
          return dateDifference;
        }

        return compareProductText(
          productA.productName,
          productB.productName
        );
      }

      if (
        sortType ===
        "location"
      ) {
        const locationDifference =
          compareProductText(
            productA.location ||
              "未登録",
            productB.location ||
              "未登録"
          );

        if (
          locationDifference !== 0
        ) {
          return locationDifference;
        }

        return compareProductText(
          productA.productName,
          productB.productName
        );
      }

      return compareProductText(
        productA.internalCode,
        productB.internalCode
      );
    }
  );

  return sortedProducts;
}

function compareProductText(
  valueA,
  valueB
) {
  return String(
    valueA || ""
  ).localeCompare(
    String(
      valueB || ""
    ),
    "ja",
    {
      numeric: true,
      sensitivity: "base"
    }
  );
}

function getProductUpdatedTime(
  product
) {
  const date =
    new Date(
      product.updatedAt || ""
    );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return 0;
  }

  return date.getTime();
}

function clearSearch() {
  productSearchInput.value = "";

  displayCurrentProducts();

  productSearchInput.focus();
}

function getFilteredProducts() {
  const keyword = normalizeText(
    productSearchInput.value
  );

  if (keyword === "") {
    return products;
  }

  return products.filter(
    function (product) {
      const searchableValues = [
        product.internalCode,
        product.productCode,
        product.productName,
        product.janCode,
        product.category,
        product.location,
        product.supplier,
        getStockStatus(product),
        getProductLifecycleStatus(
          product
        )
      ];

      return searchableValues.some(
        function (value) {
          return normalizeText(value).includes(
            keyword
          );
        }
      );
    }
  );
}

function displayCurrentProducts() {
  const filteredProducts =
    getFilteredProducts();

  const displayedProducts =
    sortDisplayedProducts(
      filteredProducts
    );

  displayProducts(displayedProducts);

  updateSearchResultMessage(
    displayedProducts.length,
    productSearchInput.value.trim()
  );
}

function normalizeText(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLowerCase()
    .trim();
}

function sortProducts() {
  products.sort(function (
    productA,
    productB
  ) {
    return productA.internalCode.localeCompare(
      productB.internalCode,
      "ja"
    );
  });
}

function displayProducts(displayedProducts) {
  productTableBody.innerHTML = "";

  if (displayedProducts.length === 0) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");

    cell.colSpan = 12;

    if (products.length === 0) {
      cell.textContent =
        "登録されている商品はありません。";
    } else {
      cell.textContent =
        "検索条件に一致する商品はありません。";
    }

    row.appendChild(cell);
    productTableBody.appendChild(row);

    return;
  }

  displayedProducts.forEach(function (product) {
    const row = document.createElement("tr");

    row.classList.add(
      "product-list-card-row"
    );

    row.dataset.internalCode =
      product.internalCode;

    const stockStatus =
      getStockStatus(product);

    const lifecycleStatus =
      getProductLifecycleStatus(
        product
      );

    if (stockStatus === "注残") {
      row.classList.add("stock-backorder-row");
    } else if (stockStatus === "在庫切れ") {
      row.classList.add("stock-out-row");
    } else if (stockStatus === "要補充") {
      row.classList.add("stock-low-row");
    }

    if (lifecycleStatus === "廃盤") {
      row.classList.add(
        "product-discontinued-row"
      );
    } else if (lifecycleStatus === "廃盤予定") {
      row.classList.add(
        "product-planned-row"
      );
    } else if (lifecycleStatus === "専用商品") {
      row.classList.add(
        "product-dedicated-row"
      );
    }

    row.appendChild(
      createProductOperationCell(
        product
      )
    );

    row.appendChild(
      createProductListTextCell(
        product.internalCode,
        "社内コード",
        "product-list-cell-internal-code"
      )
    );

    row.appendChild(
      createProductListTextCell(
        product.productCode,
        "商品コード",
        "product-list-cell-product-code"
      )
    );

    row.appendChild(
      createProductNameCell(
        product
      )
    );

    row.appendChild(
      createProductListTextCell(
        product.janCode || "未登録",
        "JANコード",
        "product-list-cell-jan-code"
      )
    );

    row.appendChild(
      createProductListTextCell(
        product.stock,
        "在庫数",
        "product-list-cell-stock"
      )
    );

    row.appendChild(
      createProductListTextCell(
        getMinimumStock(product),
        "最低在庫数",
        "product-list-cell-min-stock"
      )
    );

    row.appendChild(
      createProductListStockStatusCell(
        stockStatus
      )
    );

    row.appendChild(
      createProductListTextCell(
        product.category || "未登録",
        "カテゴリー",
        "product-list-cell-category"
      )
    );

    row.appendChild(
      createProductListTextCell(
        product.location || "未登録",
        "保管場所",
        "product-list-cell-location"
      )
    );

    row.appendChild(
      createProductListTextCell(
        product.supplier,
        "仕入先",
        "product-list-cell-supplier"
      )
    );

    row.appendChild(
      createProductListLifecycleCell(
        lifecycleStatus
      )
    );

    productTableBody.appendChild(row);
  });
}

function createProductOperationCell(
  product
) {
  const operationCell =
    document.createElement("td");

  operationCell.classList.add(
    "product-list-operation-cell"
  );

  operationCell.dataset.label =
    "操作";

  const buttonArea =
    document.createElement("div");

  buttonArea.classList.add(
    "product-list-operation-buttons"
  );

  const detailButton =
    document.createElement("button");

  detailButton.type = "button";
  detailButton.textContent =
    "詳細を見る";

  detailButton.classList.add(
    "product-list-detail-button"
  );

  detailButton.addEventListener(
    "click",
    function () {
      openDetailScreen(
        product.internalCode
      );
    }
  );

  const editButton =
    document.createElement("button");

  editButton.type = "button";
  editButton.textContent = "編集";

  editButton.classList.add(
    "product-list-edit-button"
  );

  editButton.addEventListener(
    "click",
    function () {
      openEditScreen(
        product.internalCode
      );
    }
  );

  const deleteButton =
    document.createElement("button");

  deleteButton.type = "button";
  deleteButton.textContent = "削除";

  deleteButton.classList.add(
    "product-list-delete-button"
  );

  deleteButton.addEventListener(
    "click",
    function () {
      handleDeleteProduct(
        product.internalCode
      );
    }
  );

  buttonArea.appendChild(
    detailButton
  );

  buttonArea.appendChild(
    editButton
  );

  buttonArea.appendChild(
    deleteButton
  );

  operationCell.appendChild(
    buttonArea
  );

  return operationCell;
}

function createProductNameCell(
  product
) {
  const cell =
    document.createElement("td");

  cell.classList.add(
    "product-list-cell-product-name"
  );

  cell.dataset.label =
    "商品名";

  const nameButton =
    document.createElement("button");

  nameButton.type = "button";

  nameButton.textContent =
    product.productName;

  nameButton.classList.add(
    "product-list-name-button"
  );

  nameButton.title =
    "商品詳細を開く";

  nameButton.addEventListener(
    "click",
    function () {
      openDetailScreen(
        product.internalCode
      );
    }
  );

  cell.appendChild(
    nameButton
  );

  return cell;
}

function createProductListTextCell(
  value,
  label,
  className
) {
  const cell =
    document.createElement("td");

  if (className) {
    cell.classList.add(
      className
    );
  }

  cell.dataset.label =
    label || "";

  cell.textContent =
    value;

  return cell;
}

function createProductListStockStatusCell(
  stockStatus
) {
  const cell =
    document.createElement("td");

  cell.classList.add(
    "product-list-cell-stock-status"
  );

  cell.dataset.label =
    "在庫状態";

  const badge =
    document.createElement("span");

  badge.textContent = stockStatus;
  badge.classList.add("status-badge");

  if (stockStatus === "廃盤") {
    badge.classList.add(
      "status-discontinued"
    );
  } else if (stockStatus === "注残") {
    badge.classList.add("status-backorder");
  } else if (stockStatus === "在庫切れ") {
    badge.classList.add("status-out");
  } else if (stockStatus === "要補充") {
    badge.classList.add("status-low");
  } else {
    badge.classList.add("status-normal");
  }

  cell.appendChild(badge);

  return cell;
}

function createProductListLifecycleCell(
  productStatus
) {
  const cell =
    document.createElement("td");

  cell.classList.add(
    "product-list-cell-product-status"
  );

  cell.dataset.label =
    "商品状態";

  const badge =
    document.createElement("span");

  badge.textContent =
    productStatus;

  badge.classList.add(
    "product-lifecycle-badge"
  );

  badge.classList.add(
    productStatus === "廃盤"
      ? "product-lifecycle-discontinued"
      : productStatus === "廃盤予定"
        ? "product-lifecycle-planned"
        : productStatus === "専用商品"
          ? "product-lifecycle-dedicated"
          : "product-lifecycle-active"
  );

  cell.appendChild(badge);

  return cell;
}

function appendTableCell(row, value) {
  const cell = document.createElement("td");

  cell.textContent = value;
  row.appendChild(cell);
}

function appendStockStatusCell(
  row,
  stockStatus
) {
  const cell = document.createElement("td");
  const badge = document.createElement("span");

  badge.textContent = stockStatus;
  badge.classList.add("status-badge");

  if (stockStatus === "廃盤") {
    badge.classList.add(
      "status-discontinued"
    );
  } else if (stockStatus === "注残") {
    badge.classList.add("status-backorder");
  } else if (stockStatus === "在庫切れ") {
    badge.classList.add("status-out");
  } else if (stockStatus === "要補充") {
    badge.classList.add("status-low");
  } else {
    badge.classList.add("status-normal");
  }

  cell.appendChild(badge);
  row.appendChild(cell);
}

function appendProductLifecycleStatusCell(
  row,
  productStatus
) {
  const cell =
    document.createElement("td");

  const badge =
    document.createElement("span");

  badge.textContent =
    productStatus;

  badge.classList.add(
    "product-lifecycle-badge"
  );

  badge.classList.add(
    productStatus === "廃盤"
      ? "product-lifecycle-discontinued"
      : productStatus === "廃盤予定"
        ? "product-lifecycle-planned"
        : productStatus === "専用商品"
          ? "product-lifecycle-dedicated"
          : "product-lifecycle-active"
  );

  cell.appendChild(badge);
  row.appendChild(cell);
}

function createProductLifecycleStyle() {
  if (
    document.querySelector(
      "#product-lifecycle-style"
    )
  ) {
    return;
  }

  const styleElement =
    document.createElement("style");

  styleElement.id =
    "product-lifecycle-style";

  styleElement.textContent = `
    .product-lifecycle-badge {
      display: inline-block;
      min-width: 74px;
      padding: 6px 10px;
      border-radius: 20px;
      text-align: center;
      font-weight: bold;
      white-space: nowrap;
    }

    .product-lifecycle-active {
      background-color: #e8f5e9;
      color: #1b5e20;
    }

    .product-lifecycle-dedicated {
      background-color: #f3e5f5;
      color: #6a1b9a;
      border: 1px solid #ba68c8;
    }

    .product-lifecycle-planned {
      background-color: #fff3e0;
      color: #e65100;
      border: 1px solid #ffb74d;
    }

    .product-lifecycle-discontinued,
    .status-discontinued,
    .detail-status-discontinued {
      background-color: #eceff1;
      color: #455a64;
      border: 1px solid #90a4ae;
    }

    .status-discontinued {
      display: inline-block;
      min-width: 74px;
      padding: 6px 10px;
      border-radius: 20px;
      text-align: center;
      font-weight: bold;
      white-space: nowrap;
    }

    .detail-status-discontinued {
      display: inline-block;
      min-width: 80px;
      padding: 6px 12px;
      border-radius: 20px;
      text-align: center;
      font-weight: bold;
    }

    .product-discontinued-row {
      background-color: #f2f4f5 !important;
      color: #546e7a;
    }

    .product-planned-row {
      background-color: #fffaf2 !important;
    }

    .product-dedicated-row {
      background-color: #fcf7ff !important;
    }

    .stock-backorder-row {
      background-color: #fff8d6 !important;
    }

    .status-backorder,
    .detail-status-backorder {
      background-color: #fff3b0;
      color: #7a4b00;
      border: 1px solid #f0b429;
      font-weight: bold;
    }

    .status-backorder {
      display: inline-block;
      min-width: 74px;
      padding: 6px 10px;
      border-radius: 20px;
      text-align: center;
      white-space: nowrap;
    }

    .detail-status-backorder {
      display: inline-block;
      min-width: 80px;
      padding: 6px 12px;
      border-radius: 20px;
      text-align: center;
    }

    .detail-product-active,
    .detail-product-planned,
    .detail-product-dedicated,
    .detail-product-discontinued {
      display: inline-block;
      min-width: 80px;
      padding: 6px 12px;
      border-radius: 20px;
      text-align: center;
      font-weight: bold;
    }

    .detail-product-active {
      background-color: #e8f5e9;
      color: #1b5e20;
    }

    .detail-product-dedicated {
      background-color: #f3e5f5;
      color: #6a1b9a;
      border: 1px solid #ba68c8;
    }

    .detail-product-planned {
      background-color: #fff3e0;
      color: #e65100;
      border: 1px solid #ffb74d;
    }

    .detail-product-discontinued {
      background-color: #eceff1;
      color: #455a64;
      border: 1px solid #90a4ae;
    }
  `;

  document.head.appendChild(
    styleElement
  );
}

function updateSummary() {
  productCountElement.textContent =
    products.length;

  const totalStock = products.reduce(
    function (total, product) {
      return (
        total +
        getValidStockNumber(product.stock)
      );
    },
    0
  );

  const outOfStockCount =
    products.filter(
      function (product) {
        return (
          getBaseStockStatus(product) ===
          "在庫切れ"
        );
      }
    ).length;

  const lowStockCount =
    products.filter(
      function (product) {
        return (
          getBaseStockStatus(product) ===
          "要補充"
        );
      }
    ).length;

  totalStockElement.textContent =
    totalStock;

  outOfStockCountElement.textContent =
    outOfStockCount;

  lowStockCountElement.textContent =
    lowStockCount;
}

function updateSearchResultMessage(
  resultCount,
  keyword
) {
  if (keyword === "") {
    searchResultMessage.textContent =
      `登録商品をすべて表示しています。${resultCount}件`;

    return;
  }

  searchResultMessage.textContent =
    `「${keyword}」の検索結果：${resultCount}件`;
}

function formatDateTime(dateTimeText) {
  if (!dateTimeText) {
    return "記録なし";
  }

  const date = new Date(dateTimeText);

  if (Number.isNaN(date.getTime())) {
    return "記録なし";
  }

  return date.toLocaleString("ja-JP");
}

function createInitialMovementId() {
  const randomText = Math.random()
    .toString(36)
    .slice(2, 10);

  return (
    `initial-${Date.now()}-${randomText}`
  );
}

function getSelectedDetailInternalCode() {
  return detailInternalCodeValue;
}

window.inventoryApp = {
  showScreen: showScreen,
  openDetailScreen: openDetailScreen,
  getProductByInternalCode:
    getProductByInternalCode,
  applyUpdatedProduct:
    applyUpdatedProduct,
  getSelectedDetailInternalCode:
    getSelectedDetailInternalCode,
  showAppDialog:
    showAppDialog,
  productLocationOptions:
    PRODUCT_LOCATION_OPTIONS,
  isValidProductLocation:
    isValidProductLocation
};

/* =========================================================
   v23 商品一覧：折りたたみ・ページ切替・固定移動メニュー
   ========================================================= */
let productListCurrentPage = 1;
let productListPageSize = 20;
let productListLastFilterSignature = "";
let productListLastFilteredCount = 0;
let productLifecycleFilterSelect = null;
let productStockFilterSelect = null;
let productPageSizeSelect = null;
let productListFilterDetails = null;
let productListResultsDetails = null;
let productListPagerStatusElements = [];
let productListPreviousButtons = [];
let productListNextButtons = [];
let productListFirstButtons = [];
let productListLastButtons = [];

window.addEventListener(
  "DOMContentLoaded",
  function () {
    window.setTimeout(
      createProductListUsabilityControls,
      0
    );
  }
);

function createProductListUsabilityControls() {
  if (
    !listScreen ||
    document.querySelector(
      "#product-list-sticky-navigation"
    )
  ) {
    return;
  }

  const searchArea =
    productSearchInput.parentElement;

  searchArea.id =
    "product-list-search-area";

  productListFilterDetails =
    document.createElement("details");

  productListFilterDetails.id =
    "product-list-filter-details";

  productListFilterDetails.open = true;

  const filterSummary =
    document.createElement("summary");

  filterSummary.textContent =
    "1. 検索・絞り込み";

  productListFilterDetails.appendChild(
    filterSummary
  );

  listScreen.insertBefore(
    productListFilterDetails,
    searchArea
  );

  productListFilterDetails.appendChild(
    searchArea
  );

  createProductListFilterControls(
    searchArea
  );

  const tableArea =
    listScreen.querySelector(
      ".product-list-table-area"
    );

  productListResultsDetails =
    document.createElement("details");

  productListResultsDetails.id =
    "product-list-results-details";

  productListResultsDetails.open = true;

  const resultsSummary =
    document.createElement("summary");

  resultsSummary.textContent =
    "2. 商品一覧";

  productListResultsDetails.appendChild(
    resultsSummary
  );

  listScreen.insertBefore(
    productListResultsDetails,
    tableArea
  );

  productListResultsDetails.appendChild(
    createProductListPager("top")
  );

  productListResultsDetails.appendChild(
    tableArea
  );

  productListResultsDetails.appendChild(
    createProductListPager("bottom")
  );

  const navigation =
    createProductListStickyNavigation();

  listScreen.insertBefore(
    navigation,
    productListFilterDetails
  );

  createProductListUsabilityStyle();
  displayCurrentProducts();
}

function createProductListFilterControls(
  searchArea
) {
  const filterGrid =
    document.createElement("div");

  filterGrid.classList.add(
    "product-list-filter-grid"
  );

  const lifecycleArea =
    document.createElement("div");

  const lifecycleLabel =
    document.createElement("label");

  lifecycleLabel.htmlFor =
    "product-lifecycle-filter";

  lifecycleLabel.textContent =
    "商品状態";

  productLifecycleFilterSelect =
    document.createElement("select");

  productLifecycleFilterSelect.id =
    "product-lifecycle-filter";

  productLifecycleFilterSelect.innerHTML = `
    <option value="all">すべて</option>
    <option value="active">通常商品のみ</option>
    <option value="planned">廃盤予定のみ</option>
    <option value="discontinued">廃盤のみ</option>
  `;

  lifecycleArea.appendChild(
    lifecycleLabel
  );

  lifecycleArea.appendChild(
    productLifecycleFilterSelect
  );

  const stockArea =
    document.createElement("div");

  const stockLabel =
    document.createElement("label");

  stockLabel.htmlFor =
    "product-stock-filter";

  stockLabel.textContent =
    "在庫状態";

  productStockFilterSelect =
    document.createElement("select");

  productStockFilterSelect.id =
    "product-stock-filter";

  productStockFilterSelect.innerHTML = `
    <option value="all">すべて</option>
    <option value="normal">正常</option>
    <option value="backorder">注残</option>
    <option value="low">要補充</option>
    <option value="out">在庫切れ</option>
    <option value="discontinued">廃盤</option>
  `;

  stockArea.appendChild(stockLabel);
  stockArea.appendChild(
    productStockFilterSelect
  );

  const pageSizeArea =
    document.createElement("div");

  const pageSizeLabel =
    document.createElement("label");

  pageSizeLabel.htmlFor =
    "product-page-size";

  pageSizeLabel.textContent =
    "1ページの表示件数";

  productPageSizeSelect =
    document.createElement("select");

  productPageSizeSelect.id =
    "product-page-size";

  productPageSizeSelect.innerHTML = `
    <option value="20">20件</option>
    <option value="50">50件</option>
    <option value="100">100件</option>
  `;

  pageSizeArea.appendChild(
    pageSizeLabel
  );

  pageSizeArea.appendChild(
    productPageSizeSelect
  );

  filterGrid.appendChild(
    lifecycleArea
  );

  filterGrid.appendChild(stockArea);
  filterGrid.appendChild(pageSizeArea);

  searchArea.insertBefore(
    filterGrid,
    clearSearchButton
  );

  productLifecycleFilterSelect.addEventListener(
    "change",
    displayCurrentProducts
  );

  productStockFilterSelect.addEventListener(
    "change",
    displayCurrentProducts
  );

  productPageSizeSelect.addEventListener(
    "change",
    function () {
      productListPageSize =
        Number(productPageSizeSelect.value) ||
        20;

      productListCurrentPage = 1;
      displayCurrentProducts();
    }
  );
}

function createProductListStickyNavigation() {
  const navigation =
    document.createElement("nav");

  navigation.id =
    "product-list-sticky-navigation";

  navigation.setAttribute(
    "aria-label",
    "商品一覧の画面移動"
  );

  const buttons = [
    {
      text: "検索・絞り込み",
      action: function () {
        openAndScrollProductListDetails(
          productListFilterDetails
        );
      }
    },
    {
      text: "商品一覧",
      action: function () {
        openAndScrollProductListDetails(
          productListResultsDetails
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

  buttons.forEach(function (buttonData) {
    const button =
      document.createElement("button");

    button.type = "button";
    button.textContent = buttonData.text;

    if (buttonData.pageAction) {
      addProductListPageButton(
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
  });

  return navigation;
}

function createProductListPager(position) {
  const pager =
    document.createElement("div");

  pager.classList.add(
    "product-list-pager",
    `product-list-pager-${position}`
  );

  const firstButton =
    createProductListPageButton(
      "最初",
      "first"
    );

  const previousButton =
    createProductListPageButton(
      "前へ",
      "previous"
    );

  const status =
    document.createElement("strong");

  status.classList.add(
    "product-list-page-status"
  );

  productListPagerStatusElements.push(
    status
  );

  const nextButton =
    createProductListPageButton(
      "次へ",
      "next"
    );

  const lastButton =
    createProductListPageButton(
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

function createProductListPageButton(
  textOrButton,
  action
) {
  const button =
    typeof textOrButton === "string"
      ? document.createElement("button")
      : textOrButton;

  button.type = "button";

  if (typeof textOrButton === "string") {
    button.textContent = textOrButton;
  }

  addProductListPageButton(
    button,
    action
  );

  return button;
}

function addProductListPageButton(
  button,
  action
) {
  button.dataset.pageAction = action;

  if (action === "first") {
    productListFirstButtons.push(button);
  } else if (action === "previous") {
    productListPreviousButtons.push(button);
  } else if (action === "next") {
    productListNextButtons.push(button);
  } else if (action === "last") {
    productListLastButtons.push(button);
  }

  button.addEventListener(
    "click",
    function () {
      const totalPages = Math.max(
        1,
        Math.ceil(
          productListLastFilteredCount /
          productListPageSize
        )
      );

      if (action === "first") {
        productListCurrentPage = 1;
      } else if (action === "previous") {
        productListCurrentPage = Math.max(
          1,
          productListCurrentPage - 1
        );
      } else if (action === "next") {
        productListCurrentPage = Math.min(
          totalPages,
          productListCurrentPage + 1
        );
      } else if (action === "last") {
        productListCurrentPage = totalPages;
      }

      displayCurrentProducts();
      openAndScrollProductListDetails(
        productListResultsDetails
      );
    }
  );
}

function openAndScrollProductListDetails(
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

function getFilteredProducts() {
  const keyword = normalizeText(
    productSearchInput.value
  );

  const lifecycleFilter =
    productLifecycleFilterSelect
      ? productLifecycleFilterSelect.value
      : "all";

  const stockFilter =
    productStockFilterSelect
      ? productStockFilterSelect.value
      : "all";

  return products.filter(
    function (product) {
      const lifecycleStatus =
        getProductLifecycleStatus(product);

      const stockStatus =
        getStockStatus(product);

      if (
        lifecycleFilter === "active" &&
        lifecycleStatus !== "通常商品"
      ) {
        return false;
      }

      if (
        lifecycleFilter === "planned" &&
        lifecycleStatus !== "廃盤予定"
      ) {
        return false;
      }

      if (
        lifecycleFilter ===
          "discontinued" &&
        lifecycleStatus !== "廃盤"
      ) {
        return false;
      }

      const stockFilterMap = {
        normal: "正常",
        backorder: "注残",
        low: "要補充",
        out: "在庫切れ",
        discontinued: "廃盤"
      };

      if (
        stockFilter !== "all" &&
        stockStatus !==
          stockFilterMap[stockFilter]
      ) {
        return false;
      }

      if (keyword === "") {
        return true;
      }

      const searchableValues = [
        product.internalCode,
        product.productCode,
        product.productName,
        product.janCode,
        product.category,
        product.location,
        product.supplier,
        stockStatus,
        lifecycleStatus,
        getProductBackorderStatus(product)
      ];

      return searchableValues.some(
        function (value) {
          return normalizeText(value).includes(
            keyword
          );
        }
      );
    }
  );
}

function displayCurrentProducts() {
  const keyword =
    productSearchInput.value.trim();

  const lifecycleFilter =
    productLifecycleFilterSelect
      ? productLifecycleFilterSelect.value
      : "all";

  const stockFilter =
    productStockFilterSelect
      ? productStockFilterSelect.value
      : "all";

  const sortType =
    productSortSelect
      ? productSortSelect.value
      : "internal-code";

  const signature = [
    normalizeText(keyword),
    lifecycleFilter,
    stockFilter,
    sortType,
    productListPageSize
  ].join("|");

  if (
    productListLastFilterSignature !== "" &&
    signature !==
      productListLastFilterSignature
  ) {
    productListCurrentPage = 1;
  }

  productListLastFilterSignature =
    signature;

  const filteredProducts =
    getFilteredProducts();

  const sortedProducts =
    sortDisplayedProducts(
      filteredProducts
    );

  productListLastFilteredCount =
    sortedProducts.length;

  const totalPages = Math.max(
    1,
    Math.ceil(
      sortedProducts.length /
      productListPageSize
    )
  );

  productListCurrentPage = Math.min(
    Math.max(1, productListCurrentPage),
    totalPages
  );

  const startIndex =
    (productListCurrentPage - 1) *
    productListPageSize;

  const pageProducts =
    sortedProducts.slice(
      startIndex,
      startIndex + productListPageSize
    );

  displayProducts(pageProducts);

  updateProductListSearchMessage(
    sortedProducts.length,
    keyword,
    startIndex,
    pageProducts.length
  );

  updateProductListPager(
    sortedProducts.length,
    totalPages,
    startIndex,
    pageProducts.length
  );
}

function updateProductListSearchMessage(
  totalCount,
  keyword,
  startIndex,
  pageCount
) {
  const rangeText =
    totalCount === 0
      ? "0件"
      : `${startIndex + 1}～${startIndex + pageCount}件を表示`;

  if (keyword === "") {
    searchResultMessage.textContent =
      `条件に一致する商品：${totalCount}件（${rangeText}）`;
    return;
  }

  searchResultMessage.textContent =
    `「${keyword}」の検索結果：${totalCount}件（${rangeText}）`;
}

function updateProductListPager(
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
    `${rangeText}　${productListCurrentPage} / ${totalPages}ページ`;

  productListPagerStatusElements.forEach(
    function (element) {
      element.textContent = statusText;
    }
  );

  const isFirstPage =
    productListCurrentPage <= 1;

  const isLastPage =
    productListCurrentPage >=
    totalPages;

  productListFirstButtons.forEach(
    function (button) {
      button.disabled = isFirstPage;
    }
  );

  productListPreviousButtons.forEach(
    function (button) {
      button.disabled = isFirstPage;
    }
  );

  productListNextButtons.forEach(
    function (button) {
      button.disabled = isLastPage;
    }
  );

  productListLastButtons.forEach(
    function (button) {
      button.disabled = isLastPage;
    }
  );
}

function createProductListUsabilityStyle() {
  if (
    document.querySelector(
      "#product-list-usability-style"
    )
  ) {
    return;
  }

  const styleElement =
    document.createElement("style");

  styleElement.id =
    "product-list-usability-style";

  styleElement.textContent = `
    #product-list-sticky-navigation {
      position: sticky;
      top: 0;
      z-index: 35;
      display: flex;
      gap: 8px;
      width: 100%;
      margin: 12px 0;
      padding: 9px;
      overflow-x: auto;
      border: 1px solid #90caf9;
      border-radius: 12px;
      background-color: rgba(255, 255, 255, 0.97);
      box-shadow: 0 3px 12px rgba(38, 50, 56, 0.14);
      box-sizing: border-box;
    }

    #product-list-sticky-navigation button {
      flex: 0 0 auto;
      margin: 0;
      padding: 10px 14px;
      font-size: 15px;
    }

    #product-list-filter-details,
    #product-list-results-details {
      margin: 16px 0;
      border: 2px solid #90caf9;
      border-radius: 12px;
      background-color: #ffffff;
      overflow: clip;
      scroll-margin-top: 82px;
    }

    #product-list-filter-details > summary,
    #product-list-results-details > summary {
      padding: 14px 16px;
      background-color: #e3f2fd;
      color: #0d47a1;
      font-size: 19px;
      font-weight: 800;
      cursor: pointer;
    }

    #product-list-search-area {
      padding: 14px;
    }

    .product-list-filter-grid {
      display: grid;
      grid-template-columns:
        repeat(auto-fit, minmax(180px, 1fr));
      gap: 12px;
      margin: 14px 0;
    }

    .product-list-filter-grid label {
      display: block;
      margin-bottom: 6px;
      font-weight: 700;
    }

    .product-list-filter-grid select {
      width: 100%;
      min-height: 46px;
      margin: 0;
      font-size: 16px;
    }

    .product-list-pager {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 12px;
      background-color: #f7fbff;
    }

    .product-list-pager button {
      margin: 0;
      padding: 9px 13px;
      font-size: 15px;
    }

    .product-list-page-status {
      min-width: 220px;
      text-align: center;
    }

    @media (max-width: 700px) {
      #product-list-sticky-navigation {
        margin-left: 0;
        margin-right: 0;
      }

      #product-list-filter-details,
      #product-list-results-details {
        margin-left: 0;
        margin-right: 0;
      }

      .product-list-pager {
        display: grid;
        grid-template-columns:
          repeat(4, minmax(0, 1fr));
      }

      .product-list-page-status {
        grid-column: 1 / -1;
        grid-row: 1;
        min-width: 0;
      }

      .product-list-pager button {
        width: 100%;
        padding: 10px 4px;
        font-size: 14px;
      }
    }
  `;

  document.head.appendChild(
    styleElement
  );
}
