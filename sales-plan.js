"use strict";

const SALES_PLAN_PAGE_SIZE = 20;
let salesPlanRecords = [];
let salesPlanProducts = [];
let salesPlanEditingId = "";
let salesPlanCurrentPage = 1;

window.addEventListener("DOMContentLoaded", initializeSalesPlanFeature);

async function initializeSalesPlanFeature() {
  const showButton = document.querySelector("#show-sales-plan-button");
  const backButton = document.querySelector("#back-home-from-sales-plan");
  const form = document.querySelector("#sales-plan-form");
  const lookupButton = document.querySelector("#sales-plan-product-lookup-button");
  const cancelEditButton = document.querySelector("#cancel-sales-plan-edit-button");
  const searchInput = document.querySelector("#sales-plan-search");
  const monthFilter = document.querySelector("#sales-plan-month-filter");
  const prevButton = document.querySelector("#sales-plan-prev-page");
  const nextButton = document.querySelector("#sales-plan-next-page");

  if (!showButton || !form) return;

  createSalesPlanStyle();
  showButton.addEventListener("click", openSalesPlanScreen);
  backButton.addEventListener("click", closeSalesPlanScreen);
  lookupButton.addEventListener("click", loadSalesPlanProduct);
  form.addEventListener("submit", saveSalesPlanFromForm);
  cancelEditButton.addEventListener("click", resetSalesPlanForm);
  searchInput.addEventListener("input", function () {
    salesPlanCurrentPage = 1;
    renderSalesPlanTable();
  });
  monthFilter.addEventListener("change", function () {
    salesPlanCurrentPage = 1;
    renderSalesPlanTable();
  });
  prevButton.addEventListener("click", function () {
    if (salesPlanCurrentPage > 1) {
      salesPlanCurrentPage -= 1;
      renderSalesPlanTable();
      scrollSalesPlanTableIntoView();
    }
  });
  nextButton.addEventListener("click", function () {
    const totalPages = getSalesPlanTotalPages();
    if (salesPlanCurrentPage < totalPages) {
      salesPlanCurrentPage += 1;
      renderSalesPlanTable();
      scrollSalesPlanTableIntoView();
    }
  });
}

async function openSalesPlanScreen() {
  document.querySelectorAll("main > section").forEach(function (section) {
    section.hidden = true;
  });
  const screen = document.querySelector("#sales-plan");
  screen.hidden = false;
  screen.scrollIntoView({ behavior: "smooth", block: "start" });

  try {
    await refreshSalesPlanData();
  } catch (error) {
    console.error("販売予定表読込エラー", error);
    alert("販売予定表を読み込めませんでした。");
  }
}

function closeSalesPlanScreen() {
  const screen = document.querySelector("#sales-plan");
  screen.hidden = true;
  if (window.inventoryApp && typeof window.inventoryApp.showScreen === "function") {
    window.inventoryApp.showScreen("home");
  } else {
    const home = document.querySelector("#home");
    if (home) home.hidden = false;
  }
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function refreshSalesPlanData() {
  const [plans, products] = await Promise.all([
    getAllSalesPlans(),
    getAllProducts()
  ]);

  salesPlanRecords = plans.slice().sort(compareSalesPlans);
  salesPlanProducts = products.slice();
  populateSalesPlanInternalCodeList();
  renderSalesPlanTable();
}

function populateSalesPlanInternalCodeList() {
  const datalist = document.querySelector("#sales-plan-product-list");
  datalist.innerHTML = "";

  salesPlanProducts
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

function loadSalesPlanProduct() {
  const internalCodeInput = document.querySelector("#sales-plan-internal-code");
  const internalCode = internalCodeInput.value.trim();
  const product = findSalesPlanProduct(internalCode);

  if (!product) {
    clearSalesPlanProductFields();
    alert("入力した社内コードの商品が見つかりません。");
    internalCodeInput.focus();
    return;
  }

  document.querySelector("#sales-plan-product-code").value = product.productCode || "";
  document.querySelector("#sales-plan-product-name").value = product.productName || "";
}

function findSalesPlanProduct(internalCode) {
  const target = String(internalCode || "").trim();
  if (!target) return null;
  return salesPlanProducts.find(function (product) {
    return String(product.internalCode || "").trim() === target;
  }) || null;
}

async function saveSalesPlanFromForm(event) {
  event.preventDefault();

  const customerName = document.querySelector("#sales-plan-customer").value.trim();
  const shippingMonth = document.querySelector("#sales-plan-shipping-month").value;
  const internalCode = document.querySelector("#sales-plan-internal-code").value.trim();
  const quantity = Number(document.querySelector("#sales-plan-quantity").value);
  const product = findSalesPlanProduct(internalCode);

  if (!customerName) {
    alert("取引先名を入力してください。");
    document.querySelector("#sales-plan-customer").focus();
    return;
  }
  if (!/^\d{4}-\d{2}$/.test(shippingMonth)) {
    alert("出荷時期を選択してください。");
    document.querySelector("#sales-plan-shipping-month").focus();
    return;
  }
  if (!product) {
    alert("登録済みの商品を社内コードから選んでください。");
    document.querySelector("#sales-plan-internal-code").focus();
    return;
  }
  if (!Number.isInteger(quantity) || quantity <= 0) {
    alert("数量は1以上の整数で入力してください。");
    document.querySelector("#sales-plan-quantity").focus();
    return;
  }

  const now = new Date().toISOString();
  const existing = salesPlanEditingId
    ? salesPlanRecords.find(function (record) { return record.id === salesPlanEditingId; })
    : null;

  const record = {
    id: salesPlanEditingId || createSalesPlanId(),
    customerName: customerName,
    shippingMonth: shippingMonth,
    internalCode: product.internalCode,
    productCode: product.productCode || "",
    productName: product.productName || "",
    quantity: quantity,
    createdAt: existing && existing.createdAt ? existing.createdAt : now,
    updatedAt: now
  };

  try {
    if (salesPlanEditingId) {
      await updateSalesPlan(record);
    } else {
      await saveSalesPlan(record);
    }

    const message = salesPlanEditingId
      ? "販売予定を変更しました。"
      : "販売予定を登録しました。";
    resetSalesPlanForm();
    await refreshSalesPlanData();
    alert(message);
  } catch (error) {
    console.error("販売予定保存エラー", error);
    alert("販売予定を保存できませんでした。");
  }
}

function editSalesPlan(id) {
  const record = salesPlanRecords.find(function (item) { return item.id === id; });
  if (!record) return;

  salesPlanEditingId = id;
  document.querySelector("#sales-plan-customer").value = record.customerName || "";
  document.querySelector("#sales-plan-shipping-month").value = record.shippingMonth || "";
  document.querySelector("#sales-plan-internal-code").value = record.internalCode || "";
  document.querySelector("#sales-plan-product-code").value = record.productCode || "";
  document.querySelector("#sales-plan-product-name").value = record.productName || "";
  document.querySelector("#sales-plan-quantity").value = record.quantity || 1;
  document.querySelector("#save-sales-plan-button").textContent = "変更を保存する";
  document.querySelector("#cancel-sales-plan-edit-button").hidden = false;
  document.querySelector("#sales-plan-form-area").scrollIntoView({ behavior: "smooth", block: "start" });
}

async function removeSalesPlan(id) {
  const record = salesPlanRecords.find(function (item) { return item.id === id; });
  if (!record) return;

  const confirmed = window.confirm(
    `${record.productName}\n${formatSalesPlanMonth(record.shippingMonth)} / ${record.quantity}個\n\nこの販売予定を削除しますか？`
  );
  if (!confirmed) return;

  try {
    await deleteSalesPlan(id);
    if (salesPlanEditingId === id) resetSalesPlanForm();
    await refreshSalesPlanData();
  } catch (error) {
    console.error("販売予定削除エラー", error);
    alert("販売予定を削除できませんでした。");
  }
}

function resetSalesPlanForm() {
  salesPlanEditingId = "";
  const form = document.querySelector("#sales-plan-form");
  form.reset();
  clearSalesPlanProductFields();
  document.querySelector("#save-sales-plan-button").textContent = "販売予定を登録する";
  document.querySelector("#cancel-sales-plan-edit-button").hidden = true;
}

function clearSalesPlanProductFields() {
  document.querySelector("#sales-plan-product-code").value = "";
  document.querySelector("#sales-plan-product-name").value = "";
}

function getFilteredSalesPlans() {
  const keyword = document.querySelector("#sales-plan-search").value.trim().toLowerCase();
  const month = document.querySelector("#sales-plan-month-filter").value;

  return salesPlanRecords.filter(function (record) {
    const matchesMonth = !month || record.shippingMonth === month;
    if (!matchesMonth) return false;
    if (!keyword) return true;

    return [
      record.customerName,
      record.internalCode,
      record.productCode,
      record.productName
    ].some(function (value) {
      return String(value || "").toLowerCase().includes(keyword);
    });
  });
}

function renderSalesPlanTable() {
  const tbody = document.querySelector("#sales-plan-table-body");
  if (!tbody) return;

  const filtered = getFilteredSalesPlans();
  const totalPages = Math.max(1, Math.ceil(filtered.length / SALES_PLAN_PAGE_SIZE));
  if (salesPlanCurrentPage > totalPages) salesPlanCurrentPage = totalPages;

  const start = (salesPlanCurrentPage - 1) * SALES_PLAN_PAGE_SIZE;
  const pageItems = filtered.slice(start, start + SALES_PLAN_PAGE_SIZE);
  tbody.innerHTML = "";

  pageItems.forEach(function (record) {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${escapeSalesPlanHtml(formatSalesPlanMonth(record.shippingMonth))}</td>
      <td>${escapeSalesPlanHtml(record.customerName)}</td>
      <td>${escapeSalesPlanHtml(record.internalCode)}</td>
      <td>${escapeSalesPlanHtml(record.productCode || "未登録")}</td>
      <td>${escapeSalesPlanHtml(record.productName)}</td>
      <td class="sales-plan-number">${Number(record.quantity).toLocaleString("ja-JP")}</td>
      <td class="sales-plan-actions"></td>
    `;

    const actionCell = row.querySelector(".sales-plan-actions");
    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.textContent = "編集";
    editButton.addEventListener("click", function () { editSalesPlan(record.id); });
    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.textContent = "削除";
    deleteButton.className = "sales-plan-delete-button";
    deleteButton.addEventListener("click", function () { removeSalesPlan(record.id); });
    actionCell.append(editButton, deleteButton);
    tbody.appendChild(row);
  });

  if (pageItems.length === 0) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 7;
    cell.textContent = "条件に一致する販売予定はありません。";
    row.appendChild(cell);
    tbody.appendChild(row);
  }

  const totalQuantity = filtered.reduce(function (sum, record) {
    return sum + Number(record.quantity || 0);
  }, 0);
  document.querySelector("#sales-plan-summary").textContent =
    `登録：${filtered.length}件 / 予定数量合計：${totalQuantity.toLocaleString("ja-JP")}個`;
  document.querySelector("#sales-plan-page-status").textContent =
    `${salesPlanCurrentPage} / ${totalPages}ページ`;
  document.querySelector("#sales-plan-prev-page").disabled = salesPlanCurrentPage <= 1;
  document.querySelector("#sales-plan-next-page").disabled = salesPlanCurrentPage >= totalPages;
}

function getSalesPlanTotalPages() {
  return Math.max(1, Math.ceil(getFilteredSalesPlans().length / SALES_PLAN_PAGE_SIZE));
}

function compareSalesPlans(a, b) {
  const monthCompare = String(a.shippingMonth || "").localeCompare(String(b.shippingMonth || ""));
  if (monthCompare !== 0) return monthCompare;
  const customerCompare = String(a.customerName || "").localeCompare(String(b.customerName || ""), "ja");
  if (customerCompare !== 0) return customerCompare;
  return String(a.internalCode || "").localeCompare(String(b.internalCode || ""), "ja", { numeric: true });
}

function formatSalesPlanMonth(value) {
  const match = /^(\d{4})-(\d{2})$/.exec(String(value || ""));
  if (!match) return value || "未設定";
  return `${match[1]}年${Number(match[2])}月`;
}

function createSalesPlanId() {
  return `sales-plan-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function escapeSalesPlanHtml(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function scrollSalesPlanTableIntoView() {
  document.querySelector("#sales-plan-list-area").scrollIntoView({ behavior: "smooth", block: "start" });
}

function createSalesPlanStyle() {
  if (document.querySelector("#sales-plan-style")) return;
  const style = document.createElement("style");
  style.id = "sales-plan-style";
  style.textContent = `
    #sales-plan { max-width: 1280px; margin: 0 auto; }
    .sales-plan-card { background: #fff; border: 1px solid #d6e2ec; border-radius: 14px; padding: 22px; margin-bottom: 18px; box-shadow: 0 4px 14px rgba(15, 45, 70, .06); }
    .sales-plan-form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
    .sales-plan-form-grid .sales-plan-full { grid-column: 1 / -1; }
    .sales-plan-product-row { display: grid; grid-template-columns: 1fr auto; gap: 10px; align-items: end; }
    .sales-plan-readonly { background: #eef3f6; }
    .sales-plan-form-actions, .sales-plan-filter-row, .sales-plan-pager { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
    .sales-plan-filter-row > * { flex: 1 1 230px; }
    .sales-plan-table-wrap { overflow-x: auto; margin-top: 12px; }
    #sales-plan table { min-width: 900px; width: 100%; border-collapse: collapse; }
    #sales-plan th, #sales-plan td { border: 1px solid #c8d7e1; padding: 10px; vertical-align: middle; }
    #sales-plan th { background: #00695c; color: white; white-space: nowrap; }
    .sales-plan-number { text-align: right; }
    .sales-plan-actions { white-space: nowrap; }
    .sales-plan-actions button { margin-right: 6px; }
    .sales-plan-delete-button { background: #c62828 !important; }
    .sales-plan-summary-box { background: #e8f5e9; border-radius: 10px; padding: 12px 14px; font-weight: 700; margin-top: 12px; }
    .sales-plan-pager { justify-content: center; margin-top: 14px; }
    #show-sales-plan-button { background: #00897b; }
    @media (max-width: 720px) {
      .sales-plan-form-grid { grid-template-columns: 1fr; }
      .sales-plan-form-grid .sales-plan-full { grid-column: auto; }
      .sales-plan-product-row { grid-template-columns: 1fr; }
      .sales-plan-card { padding: 16px; }
    }
  `;
  document.head.appendChild(style);
}

window.salesPlanFeature = {
  getAllSalesPlans: function () { return salesPlanRecords.slice(); },
  refresh: refreshSalesPlanData
};
