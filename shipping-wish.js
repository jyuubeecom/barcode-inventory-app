"use strict";

const SHIPPING_WISH_PAGE_SIZE = 20;
let shippingWishRecords = [];
let shippingWishProducts = [];
let shippingWishEditingId = "";
let shippingWishCurrentPage = 1;

document.addEventListener("DOMContentLoaded", initializeShippingWishFeature);

async function initializeShippingWishFeature() {
  const showButton = document.querySelector("#show-shipping-wish-button");
  const showListButton = document.querySelector("#show-shipping-wish-list-button");
  const jumpFormButton = document.querySelector("#jump-shipping-wish-form-button");
  const jumpListButton = document.querySelector("#jump-shipping-wish-list-button");
  const backButton = document.querySelector("#back-home-from-shipping-wish");
  const form = document.querySelector("#shipping-wish-form");
  const lookupButton = document.querySelector("#shipping-wish-product-lookup-button");
  const cancelEditButton = document.querySelector("#cancel-shipping-wish-edit-button");
  const searchInput = document.querySelector("#shipping-wish-search");
  const monthFilter = document.querySelector("#shipping-wish-month-filter");
  const prevButton = document.querySelector("#shipping-wish-prev-page");
  const nextButton = document.querySelector("#shipping-wish-next-page");

  if (!showButton || !form) return;

  createShippingWishStyle();

  showButton.addEventListener("click", openShippingWishScreen);
  if (showListButton) showListButton.addEventListener("click", openShippingWishListScreen);
  if (jumpFormButton) jumpFormButton.addEventListener("click", scrollShippingWishFormIntoView);
  if (jumpListButton) jumpListButton.addEventListener("click", scrollShippingWishListIntoView);
  if (backButton) backButton.addEventListener("click", closeShippingWishScreen);
  if (lookupButton) lookupButton.addEventListener("click", loadShippingWishProduct);
  form.addEventListener("submit", saveShippingWishFromForm);
  if (cancelEditButton) cancelEditButton.addEventListener("click", resetShippingWishForm);

  if (searchInput) {
    searchInput.addEventListener("input", function () {
      shippingWishCurrentPage = 1;
      renderShippingWishTable();
    });
  }

  if (monthFilter) {
    monthFilter.addEventListener("change", function () {
      shippingWishCurrentPage = 1;
      renderShippingWishTable();
    });
  }

  if (prevButton) {
    prevButton.addEventListener("click", function () {
      if (shippingWishCurrentPage > 1) {
        shippingWishCurrentPage -= 1;
        renderShippingWishTable();
        scrollShippingWishListIntoView();
      }
    });
  }

  if (nextButton) {
    nextButton.addEventListener("click", function () {
      const totalPages = getShippingWishTotalPages();
      if (shippingWishCurrentPage < totalPages) {
        shippingWishCurrentPage += 1;
        renderShippingWishTable();
        scrollShippingWishListIntoView();
      }
    });
  }
}

async function openShippingWishScreen() {
  await showShippingWishScreen();
  scrollShippingWishFormIntoView();
}

async function openShippingWishListScreen() {
  await showShippingWishScreen();
  scrollShippingWishListIntoView();
}

async function showShippingWishScreen() {
  document.querySelectorAll("main > section").forEach(function (section) {
    section.hidden = true;
  });

  const screen = document.querySelector("#shipping-wish");
  if (!screen) return;
  screen.hidden = false;

  try {
    await refreshShippingWishData();
  } catch (error) {
    console.error("船積希望読込エラー", error);
    alert("船積希望一覧を読み込めませんでした。");
  }
}

function closeShippingWishScreen() {
  const screen = document.querySelector("#shipping-wish");
  if (screen) screen.hidden = true;

  if (window.inventoryApp && typeof window.inventoryApp.showScreen === "function") {
    window.inventoryApp.showScreen("home");
  } else {
    const home = document.querySelector("#home");
    if (home) home.hidden = false;
  }

  window.scrollTo({ top: 0, behavior: "smooth" });
}

function scrollShippingWishFormIntoView() {
  const target = document.querySelector("#shipping-wish-form-area");
  if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
}

function scrollShippingWishListIntoView() {
  const target = document.querySelector("#shipping-wish-list-area");
  if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function refreshShippingWishData() {
  const [records, products] = await Promise.all([
    getAllShippingWishes(),
    getAllProducts()
  ]);

  shippingWishRecords = records.slice().sort(compareShippingWishes);
  shippingWishProducts = products.slice();
  populateShippingWishProductList();
  renderShippingWishTable();
}

function populateShippingWishProductList() {
  const datalist = document.querySelector("#shipping-wish-product-list");
  if (!datalist) return;
  datalist.innerHTML = "";

  shippingWishProducts
    .slice()
    .sort(function (a, b) {
      return String(a.internalCode || "").localeCompare(
        String(b.internalCode || ""),
        "ja",
        { numeric: true }
      );
    })
    .forEach(function (product) {
      const option = document.createElement("option");
      option.value = String(product.internalCode || "");
      option.label = `${product.productName || ""} ${product.productCode || ""}`.trim();
      datalist.appendChild(option);
    });
}

function findShippingWishProduct(internalCode) {
  const target = String(internalCode || "").trim();
  if (!target) return null;

  return shippingWishProducts.find(function (product) {
    return String(product.internalCode || "").trim() === target;
  }) || null;
}

function loadShippingWishProduct() {
  const internalCodeInput = document.querySelector("#shipping-wish-internal-code");
  if (!internalCodeInput) return;

  const product = findShippingWishProduct(internalCodeInput.value);
  if (!product) {
    clearShippingWishProductFields();
    alert("入力した社内コードの商品が見つかりません。");
    internalCodeInput.focus();
    return;
  }

  document.querySelector("#shipping-wish-product-code").value = product.productCode || "";
  document.querySelector("#shipping-wish-product-name").value = product.productName || "";
}

function clearShippingWishProductFields() {
  const code = document.querySelector("#shipping-wish-product-code");
  const name = document.querySelector("#shipping-wish-product-name");
  if (code) code.value = "";
  if (name) name.value = "";
}

async function saveShippingWishFromForm(event) {
  event.preventDefault();

  const internalCodeInput = document.querySelector("#shipping-wish-internal-code");
  const quantityInput = document.querySelector("#shipping-wish-quantity");
  const monthInput = document.querySelector("#shipping-wish-desired-month");
  const noteInput = document.querySelector("#shipping-wish-note");

  const internalCode = internalCodeInput.value.trim();
  const product = findShippingWishProduct(internalCode);
  const quantity = Number(quantityInput.value);
  const desiredMonth = monthInput.value || "";
  const note = noteInput.value.trim();

  if (!product) {
    alert("登録済みの商品を社内コードから選んでください。");
    internalCodeInput.focus();
    return;
  }

  if (!Number.isInteger(quantity) || quantity <= 0) {
    alert("希望数量は1以上の整数で入力してください。");
    quantityInput.focus();
    return;
  }

  if (desiredMonth && !/^\d{4}-\d{2}$/.test(desiredMonth)) {
    alert("希望船積月を正しく選択してください。");
    monthInput.focus();
    return;
  }

  const now = new Date().toISOString();
  const existing = shippingWishEditingId
    ? shippingWishRecords.find(function (record) { return record.id === shippingWishEditingId; })
    : null;

  const record = {
    id: shippingWishEditingId || createShippingWishId(),
    internalCode: String(product.internalCode || "").trim(),
    productCode: product.productCode || "",
    productName: product.productName || "",
    quantity: quantity,
    desiredMonth: desiredMonth,
    note: note,
    status: existing && existing.status ? existing.status : "requested",
    createdAt: existing && existing.createdAt ? existing.createdAt : now,
    updatedAt: now
  };

  try {
    if (shippingWishEditingId) {
      await updateShippingWish(record);
    } else {
      await saveShippingWish(record);
    }

    const message = shippingWishEditingId
      ? "船積希望を変更しました。"
      : "船積希望を登録しました。";

    resetShippingWishForm();
    await refreshShippingWishData();
    alert(message);
    scrollShippingWishListIntoView();
  } catch (error) {
    console.error("船積希望保存エラー", error);
    alert("船積希望を保存できませんでした。");
  }
}

function editShippingWish(id) {
  const record = shippingWishRecords.find(function (item) {
    return item.id === id;
  });
  if (!record) return;

  shippingWishEditingId = id;
  document.querySelector("#shipping-wish-internal-code").value = record.internalCode || "";
  document.querySelector("#shipping-wish-product-code").value = record.productCode || "";
  document.querySelector("#shipping-wish-product-name").value = record.productName || "";
  document.querySelector("#shipping-wish-quantity").value = record.quantity || 1;
  document.querySelector("#shipping-wish-desired-month").value = record.desiredMonth || "";
  document.querySelector("#shipping-wish-note").value = record.note || "";

  const saveButton = document.querySelector("#save-shipping-wish-button");
  const cancelButton = document.querySelector("#cancel-shipping-wish-edit-button");
  if (saveButton) saveButton.textContent = "変更内容を保存する";
  if (cancelButton) cancelButton.hidden = false;

  scrollShippingWishFormIntoView();
  document.querySelector("#shipping-wish-internal-code").focus();
}

async function removeShippingWish(id) {
  const record = shippingWishRecords.find(function (item) {
    return item.id === id;
  });
  if (!record) return;

  const confirmed = window.confirm(
    "次の船積希望を削除しますか？\n\n" +
    `社内コード：${record.internalCode || ""}\n` +
    `商品名：${record.productName || ""}\n` +
    `希望数量：${record.quantity || 0}個\n\n` +
    "この操作は元に戻せません。"
  );
  if (!confirmed) return;

  try {
    await deleteShippingWish(id);
    if (shippingWishEditingId === id) resetShippingWishForm();
    await refreshShippingWishData();
  } catch (error) {
    console.error("船積希望削除エラー", error);
    alert("船積希望を削除できませんでした。");
  }
}

function resetShippingWishForm() {
  shippingWishEditingId = "";
  const form = document.querySelector("#shipping-wish-form");
  if (form) form.reset();

  const quantity = document.querySelector("#shipping-wish-quantity");
  if (quantity) quantity.value = "1";

  clearShippingWishProductFields();

  const saveButton = document.querySelector("#save-shipping-wish-button");
  const cancelButton = document.querySelector("#cancel-shipping-wish-edit-button");
  if (saveButton) saveButton.textContent = "船積希望を登録する";
  if (cancelButton) cancelButton.hidden = true;
}

function getFilteredShippingWishes() {
  const searchInput = document.querySelector("#shipping-wish-search");
  const monthFilter = document.querySelector("#shipping-wish-month-filter");
  const searchText = String(searchInput ? searchInput.value : "").trim().toLowerCase();
  const month = monthFilter ? monthFilter.value : "";

  return shippingWishRecords.filter(function (record) {
    if (month && record.desiredMonth !== month) return false;

    if (!searchText) return true;

    const haystack = [
      record.internalCode,
      record.productCode,
      record.productName,
      record.note
    ].map(function (value) {
      return String(value || "").toLowerCase();
    }).join(" ");

    return haystack.includes(searchText);
  });
}

function renderShippingWishTable() {
  const body = document.querySelector("#shipping-wish-table-body");
  const summary = document.querySelector("#shipping-wish-summary");
  const pageStatus = document.querySelector("#shipping-wish-page-status");
  const prevButton = document.querySelector("#shipping-wish-prev-page");
  const nextButton = document.querySelector("#shipping-wish-next-page");

  if (!body || !summary || !pageStatus) return;

  const filtered = getFilteredShippingWishes();
  const totalPages = Math.max(1, Math.ceil(filtered.length / SHIPPING_WISH_PAGE_SIZE));
  if (shippingWishCurrentPage > totalPages) shippingWishCurrentPage = totalPages;

  const start = (shippingWishCurrentPage - 1) * SHIPPING_WISH_PAGE_SIZE;
  const visible = filtered.slice(start, start + SHIPPING_WISH_PAGE_SIZE);
  const totalQuantity = filtered.reduce(function (sum, record) {
    return sum + (Number(record.quantity) || 0);
  }, 0);

  summary.textContent = `登録：${filtered.length}件 / 希望数量合計：${totalQuantity.toLocaleString("ja-JP")}個`;
  body.innerHTML = "";

  if (visible.length === 0) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 8;
    cell.textContent = "条件に一致する船積希望はありません。";
    row.appendChild(cell);
    body.appendChild(row);
  } else {
    visible.forEach(function (record) {
      const row = document.createElement("tr");
      appendShippingWishCell(row, formatShippingWishDate(record.createdAt));
      appendShippingWishCell(row, formatShippingWishMonth(record.desiredMonth));
      appendShippingWishCell(row, record.internalCode || "");
      appendShippingWishCell(row, record.productCode || "未登録");
      appendShippingWishCell(row, record.productName || "");
      appendShippingWishCell(row, `${Number(record.quantity || 0).toLocaleString("ja-JP")}個`);
      appendShippingWishCell(row, record.note || "");

      const actionCell = document.createElement("td");
      actionCell.className = "shipping-wish-actions-cell";

      const editButton = document.createElement("button");
      editButton.type = "button";
      editButton.textContent = "編集";
      editButton.addEventListener("click", function () {
        editShippingWish(record.id);
      });

      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.textContent = "削除";
      deleteButton.className = "shipping-wish-delete-button";
      deleteButton.addEventListener("click", function () {
        removeShippingWish(record.id);
      });

      actionCell.appendChild(editButton);
      actionCell.appendChild(deleteButton);
      row.appendChild(actionCell);
      body.appendChild(row);
    });
  }

  pageStatus.textContent = `${shippingWishCurrentPage} / ${totalPages}ページ`;
  if (prevButton) prevButton.disabled = shippingWishCurrentPage <= 1;
  if (nextButton) nextButton.disabled = shippingWishCurrentPage >= totalPages;
}

function appendShippingWishCell(row, value) {
  const cell = document.createElement("td");
  cell.textContent = value;
  row.appendChild(cell);
}

function getShippingWishTotalPages() {
  return Math.max(1, Math.ceil(getFilteredShippingWishes().length / SHIPPING_WISH_PAGE_SIZE));
}

function compareShippingWishes(a, b) {
  const aMonth = a.desiredMonth || "9999-99";
  const bMonth = b.desiredMonth || "9999-99";
  if (aMonth !== bMonth) return aMonth.localeCompare(bMonth);

  const aCreated = a.createdAt || "";
  const bCreated = b.createdAt || "";
  return aCreated.localeCompare(bCreated);
}

function createShippingWishId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return `shipping-wish-${window.crypto.randomUUID()}`;
  }
  return `shipping-wish-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function formatShippingWishDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("ja-JP");
}

function formatShippingWishMonth(value) {
  if (!/^\d{4}-\d{2}$/.test(String(value || ""))) return "未指定";
  const parts = value.split("-");
  return `${Number(parts[0])}年${Number(parts[1])}月`;
}

function createShippingWishStyle() {
  if (document.querySelector("#shipping-wish-style")) return;

  const style = document.createElement("style");
  style.id = "shipping-wish-style";
  style.textContent = `
    #shipping-wish .shipping-wish-card {
      margin: 18px 0;
      padding: 18px;
      border: 1px solid #b0bec5;
      border-radius: 14px;
      background: #fff;
    }

    #shipping-wish .shipping-wish-shortcuts,
    #shipping-wish .shipping-wish-form-actions,
    #shipping-wish .shipping-wish-pager {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      align-items: center;
      margin: 12px 0;
    }

    #shipping-wish .shipping-wish-form-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 14px;
    }

    #shipping-wish .shipping-wish-full {
      grid-column: 1 / -1;
    }

    #shipping-wish .shipping-wish-product-row {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 10px;
    }

    #shipping-wish .shipping-wish-readonly {
      background: #eceff1;
    }

    #shipping-wish .shipping-wish-filter-row {
      display: grid;
      grid-template-columns: minmax(0, 2fr) minmax(220px, 1fr);
      gap: 14px;
      margin-bottom: 14px;
    }

    #shipping-wish .shipping-wish-summary-box {
      padding: 12px 14px;
      margin-bottom: 14px;
      border-radius: 10px;
      background: #e0f2f1;
      font-weight: 700;
    }

    #shipping-wish .shipping-wish-table-wrap {
      overflow-x: auto;
      border: 1px solid #cfd8dc;
      border-radius: 10px;
    }

    #shipping-wish .shipping-wish-table-wrap table {
      min-width: 980px;
      margin: 0;
    }

    #shipping-wish .shipping-wish-actions-cell {
      white-space: nowrap;
    }

    #shipping-wish .shipping-wish-actions-cell button {
      margin: 2px 5px 2px 0;
    }

    #shipping-wish .shipping-wish-delete-button {
      background-color: #d32f2f;
    }

    #shipping-wish textarea {
      width: 100%;
      box-sizing: border-box;
    }

    @media (max-width: 700px) {
      #shipping-wish .shipping-wish-form-grid,
      #shipping-wish .shipping-wish-filter-row,
      #shipping-wish .shipping-wish-product-row {
        grid-template-columns: 1fr;
      }

      #shipping-wish .shipping-wish-shortcuts button,
      #shipping-wish .shipping-wish-form-actions button {
        width: 100%;
      }
    }
  `;
  document.head.appendChild(style);
}
