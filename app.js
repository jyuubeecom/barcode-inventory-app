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

  if (getStockStatus(selectedProduct) === "在庫切れ") {
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
    )
  };
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
        getStockStatus(product)
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
  const displayedProducts =
    getFilteredProducts();

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

    cell.colSpan = 11;

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

    const stockStatus =
      getStockStatus(product);

    if (stockStatus === "在庫切れ") {
      row.classList.add("stock-out-row");
    } else if (stockStatus === "要補充") {
      row.classList.add("stock-low-row");
    }

    appendTableCell(
      row,
      product.internalCode
    );

    appendTableCell(
      row,
      product.productCode
    );

    appendTableCell(
      row,
      product.productName
    );

    appendTableCell(
      row,
      product.janCode || "未登録"
    );

    appendTableCell(
      row,
      product.stock
    );

    appendTableCell(
      row,
      getMinimumStock(product)
    );

    appendStockStatusCell(
      row,
      stockStatus
    );

    appendTableCell(
      row,
      product.category || "未登録"
    );

    appendTableCell(
      row,
      product.location || "未登録"
    );

    appendTableCell(
      row,
      product.supplier
    );

    const operationCell =
      document.createElement("td");

    const detailButton =
      document.createElement("button");

    detailButton.type = "button";
    detailButton.textContent = "詳細";

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

    deleteButton.addEventListener(
      "click",
      function () {
        handleDeleteProduct(
          product.internalCode
        );
      }
    );

    operationCell.appendChild(detailButton);
    operationCell.appendChild(editButton);
    operationCell.appendChild(deleteButton);

    row.appendChild(operationCell);
    productTableBody.appendChild(row);
  });
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

  if (stockStatus === "在庫切れ") {
    badge.classList.add("status-out");
  } else if (stockStatus === "要補充") {
    badge.classList.add("status-low");
  } else {
    badge.classList.add("status-normal");
  }

  cell.appendChild(badge);
  row.appendChild(cell);
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