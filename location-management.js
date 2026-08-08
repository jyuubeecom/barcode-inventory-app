
"use strict";

let selectedUnassignedInternalCodes = new Set();

window.addEventListener("DOMContentLoaded", function () {
  const showButton = document.querySelector(
    "#show-unassigned-location-button"
  );
  const backButton = document.querySelector(
    "#back-home-from-unassigned-location"
  );
  const searchInput = document.querySelector(
    "#unassigned-location-search"
  );
  const selectVisibleButton = document.querySelector(
    "#select-visible-unassigned-products"
  );
  const clearButton = document.querySelector(
    "#clear-unassigned-product-selection"
  );
  const applyButton = document.querySelector(
    "#apply-bulk-location-button"
  );

  if (!showButton) return;

  createLocationManagementStyle();

  showButton.addEventListener("click", function () {
    window.inventoryApp.showScreen("unassignedLocation");
    renderUnassignedLocationProducts();
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  backButton.addEventListener("click", function () {
    window.inventoryApp.showScreen("home");
  });

  searchInput.addEventListener(
    "input",
    renderUnassignedLocationProducts
  );

  selectVisibleButton.addEventListener("click", function () {
    getFilteredUnassignedProducts().forEach(function (product) {
      selectedUnassignedInternalCodes.add(product.internalCode);
    });
    renderUnassignedLocationProducts();
  });

  clearButton.addEventListener("click", function () {
    selectedUnassignedInternalCodes.clear();
    renderUnassignedLocationProducts();
  });

  applyButton.addEventListener("click", applyBulkLocation);
});

function getUnassignedLocationProducts() {
  return products.filter(function (product) {
    return !window.inventoryApp.isValidProductLocation(
      product.location
    );
  });
}

function getFilteredUnassignedProducts() {
  const input = document.querySelector(
    "#unassigned-location-search"
  );
  const keyword = String(input.value || "")
    .normalize("NFKC")
    .toLowerCase()
    .trim();

  return getUnassignedLocationProducts().filter(function (product) {
    if (!keyword) return true;
    return [
      product.internalCode,
      product.productCode,
      product.productName,
      product.location
    ].some(function (value) {
      return String(value || "")
        .normalize("NFKC")
        .toLowerCase()
        .includes(keyword);
    });
  });
}

function renderUnassignedLocationProducts() {
  const body = document.querySelector(
    "#unassigned-location-table-body"
  );
  const summary = document.querySelector(
    "#unassigned-location-summary"
  );
  if (!body || !summary) return;

  const all = getUnassignedLocationProducts();
  const filtered = getFilteredUnassignedProducts();
  body.innerHTML = "";

  summary.textContent =
    `区画未設定：${all.length}件 / 表示中：${filtered.length}件 / ` +
    `選択中：${selectedUnassignedInternalCodes.size}件`;

  if (filtered.length === 0) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 6;
    cell.textContent = all.length === 0
      ? "区画未設定の商品はありません。"
      : "検索条件に一致する商品はありません。";
    row.appendChild(cell);
    body.appendChild(row);
    return;
  }

  filtered.forEach(function (product) {
    const row = document.createElement("tr");
    const checkCell = document.createElement("td");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = selectedUnassignedInternalCodes.has(
      product.internalCode
    );
    checkbox.setAttribute(
      "aria-label",
      `${product.productName}を選択`
    );
    checkbox.addEventListener("change", function () {
      if (checkbox.checked) {
        selectedUnassignedInternalCodes.add(product.internalCode);
      } else {
        selectedUnassignedInternalCodes.delete(product.internalCode);
      }
      renderUnassignedLocationProducts();
    });
    checkCell.appendChild(checkbox);
    row.appendChild(checkCell);

    [
      product.internalCode,
      product.productCode || "未登録",
      product.productName,
      product.location || "未設定",
      getProductLifecycleStatus(product)
    ].forEach(function (value) {
      const cell = document.createElement("td");
      cell.textContent = value;
      row.appendChild(cell);
    });
    body.appendChild(row);
  });
}

async function applyBulkLocation() {
  const destination = document.querySelector(
    "#bulk-location-destination"
  ).value;

  if (!window.inventoryApp.isValidProductLocation(destination)) {
    alert("変更先の保管場所を選択してください。");
    return;
  }

  const targets = products.filter(function (product) {
    return selectedUnassignedInternalCodes.has(product.internalCode);
  });

  if (targets.length === 0) {
    alert("変更する商品を選択してください。");
    return;
  }

  const confirmed = window.confirm(
    `${targets.length}件の商品を「${destination}」へ変更します。\n\n` +
    "よろしいですか？"
  );
  if (!confirmed) return;

  const now = new Date().toISOString();
  const updatedProducts = targets.map(function (product) {
    return {
      ...product,
      location: destination,
      updatedAt: now
    };
  });

  try {
    await updateProductsInBatch(updatedProducts);
    updatedProducts.forEach(function (product) {
      window.inventoryApp.applyUpdatedProduct(product);
    });
    selectedUnassignedInternalCodes.clear();
    renderUnassignedLocationProducts();
    alert(`${updatedProducts.length}件の保管場所を変更しました。`);
  } catch (error) {
    console.error(error);
    alert("保管場所を変更できませんでした。");
  }
}

function createLocationManagementStyle() {
  const style = document.createElement("style");
  style.id = "location-management-style";
  style.textContent = `
    #show-unassigned-location-button { background-color: #6a1b9a; }
    .unassigned-location-controls {
      display: grid; gap: 10px; margin-bottom: 16px;
    }
    .unassigned-location-actions {
      display: flex; flex-wrap: wrap; gap: 8px;
    }
    .unassigned-location-actions button { width: auto; margin: 0; }
    #apply-bulk-location-button { background-color: #2e7d32; }
    .unassigned-location-table-area {
      width: 100%; overflow: auto; max-height: 62vh; margin-bottom: 16px;
      border: 1px solid #cfd8dc;
    }
    .unassigned-location-table-area table { min-width: 900px; margin: 0; }
    .unassigned-location-table-area thead th {
      position: sticky; top: 0; z-index: 1;
    }
    @media (max-width: 700px) {
      .unassigned-location-actions button { width: 100%; }
    }
  `;
  document.head.appendChild(style);
}
