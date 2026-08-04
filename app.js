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

const productStatusInput =
  document.querySelector(
    "#product-status"
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

const editProductStatusInput =
  document.querySelector(
    "#edit-product-status"
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

const detailSupplier =
  document.querySelector(
    "#detail-supplier"
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

async function initializeApp() {
  showRegisterButton.addEventListener(
    "click",
    function () {
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
    function () {
      if (detailInternalCodeValue === "") {
        alert(
          "編集する商品が選択されていません。"
        );

        return;
      }

      openEditScreen(detailInternalCodeValue);
    }
  );

  deleteFromDetailButton.addEventListener(
    "click",
    async function () {
      if (detailInternalCodeValue === "") {
        alert(
          "削除する商品が選択されていません。"
        );

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

    alert(
      "保存されている商品データを読み込めませんでした。"
    );
  }
}

function showScreen(screenName) {
  homeScreen.hidden = true;
  registerScreen.hidden = true;
  listScreen.hidden = true;
  historyScreen.hidden = true;
  detailScreen.hidden = true;
  stockInScreen.hidden = true;
  stockOutScreen.hidden = true;
  stockAdjustScreen.hidden = true;
  editScreen.hidden = true;

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

  homeScreen.hidden = false;
}

async function handleProductSubmit(event) {
  event.preventDefault();

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

  const productStatus =
    getProductLifecycleStatus({
      productStatus:
        productStatusInput.value
    });

  if (!Number.isInteger(stock) || stock < 0) {
    alert(
      "初期在庫数は0以上の整数で入力してください。"
    );

    stockInput.focus();
    return;
  }

  if (
    !Number.isInteger(minStock) ||
    minStock < 0
  ) {
    alert(
      "最低在庫数は0以上の整数で入力してください。"
    );

    minStockInput.focus();
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
    alert(
      "同じ社内コードの商品がすでに登録されています。"
    );

    internalCodeInput.focus();
    return;
  }

  const duplicateProductCode = products.find(
    function (product) {
      return (
        product.productCode === productCode
      );
    }
  );

  if (duplicateProductCode) {
    alert(
      "同じ商品コードの商品がすでに登録されています。"
    );

    productCodeInput.focus();
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
    supplier: supplier,
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
    memo: ""
  };

  try {
    await saveProductAndMovement(
      newProduct,
      initialMovement
    );

    products.push(newProduct);

    sortProducts();
    updateSummary();

    productForm.reset();
    stockInput.value = 0;
    minStockInput.value = 0;
    productStatusInput.value =
      "通常商品";

    productSearchInput.value = "";

    displayCurrentProducts();

    alert("商品を登録しました。");

    showScreen("list");
  } catch (error) {
    console.error(error);

    if (
      error &&
      error.name === "ConstraintError"
    ) {
      alert(
        "同じ社内コードまたは商品コードが登録されています。"
      );

      return;
    }

    alert(
      "商品を保存できませんでした。"
    );
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

    alert(
      "入出庫履歴を読み込めませんでした。"
    );
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
    alert(
      "商品情報が見つかりませんでした。"
    );

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

  detailSupplier.textContent =
    selectedProduct.supplier;

  const productLifecycleStatus =
    getProductLifecycleStatus(
      selectedProduct
    );

  detailProductStatus.textContent =
    productLifecycleStatus;

  detailProductStatus.className =
    productLifecycleStatus === "廃盤"
      ? "detail-product-discontinued"
      : "detail-product-active";

  detailUpdatedAt.textContent =
    formatDateTime(selectedProduct.updatedAt);

  showScreen("detail");
}

function openEditScreen(internalCode) {
  const selectedProduct =
    getProductByInternalCode(internalCode);

  if (!selectedProduct) {
    alert(
      "編集する商品が見つかりませんでした。"
    );

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
    selectedProduct.location || "";

  editSupplierInput.value =
    selectedProduct.supplier;

  editProductStatusInput.value =
    getProductLifecycleStatus(
      selectedProduct
    );

  showScreen("edit");
  editProductCodeInput.focus();
}

async function handleEditProductSubmit(event) {
  event.preventDefault();

  if (editingInternalCode === "") {
    alert(
      "編集する商品が選択されていません。"
    );

    showScreen("list");
    return;
  }

  const currentProduct =
    getProductByInternalCode(
      editingInternalCode
    );

  if (!currentProduct) {
    alert(
      "編集する商品が見つかりませんでした。"
    );

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

  const productStatus =
    getProductLifecycleStatus({
      productStatus:
        editProductStatusInput.value
    });

  if (
    !Number.isInteger(minStock) ||
    minStock < 0
  ) {
    alert(
      "最低在庫数は0以上の整数で入力してください。"
    );

    editMinStockInput.focus();
    return;
  }

  const duplicateProductCode = products.find(
    function (product) {
      return (
        product.productCode === productCode &&
        product.internalCode !==
          editingInternalCode
      );
    }
  );

  if (duplicateProductCode) {
    alert(
      "同じ商品コードの商品がすでに登録されています。"
    );

    editProductCodeInput.focus();
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
    supplier: supplier,
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

    alert("商品情報を変更しました。");

    openDetailScreen(
      updatedProduct.internalCode
    );
  } catch (error) {
    console.error(error);

    alert(
      "商品情報を保存できませんでした。"
    );
  }
}

async function handleDeleteProduct(internalCode) {
  const selectedProduct =
    getProductByInternalCode(internalCode);

  if (!selectedProduct) {
    alert(
      "削除する商品が見つかりませんでした。"
    );

    return false;
  }

  const confirmationMessage =
    `「${selectedProduct.productName}」を削除しますか？\n\n` +
    `社内コード：${selectedProduct.internalCode}\n` +
    `商品コード：${selectedProduct.productCode}\n\n` +
    "この操作は元に戻せません。\n" +
    "過去の入出庫履歴は削除されません。";

  const isConfirmed =
    window.confirm(confirmationMessage);

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

    alert("商品を削除しました。");

    return true;
  } catch (error) {
    console.error(error);

    alert(
      "商品を削除できませんでした。"
    );

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
  return {
    ...product,
    stock: getValidStockNumber(
      product.stock
    ),
    minStock: getValidStockNumber(
      product.minStock
    ),
    productStatus:
      getProductLifecycleStatus(
        product
      )
  };
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

function getMinimumStock(product) {
  return getValidStockNumber(
    product.minStock
  );
}

function getStockStatus(product) {
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

    if (stockStatus === "在庫切れ") {
      row.classList.add("stock-out-row");
    } else if (stockStatus === "要補充") {
      row.classList.add("stock-low-row");
    }

    if (lifecycleStatus === "廃盤") {
      row.classList.add(
        "product-discontinued-row"
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

    .detail-product-active,
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
          getStockStatus(product) ===
          "在庫切れ"
        );
      }
    ).length;

  const lowStockCount =
    products.filter(
      function (product) {
        return (
          getStockStatus(product) ===
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
    getSelectedDetailInternalCode
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
        lifecycleFilter ===
          "discontinued" &&
        lifecycleStatus !== "廃盤"
      ) {
        return false;
      }

      const stockFilterMap = {
        normal: "正常",
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
        lifecycleStatus
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
