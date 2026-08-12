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
  const shippingType = document.querySelector("#sales-plan-shipping-type");
  const prevButton = document.querySelector("#sales-plan-prev-page");
  const nextButton = document.querySelector("#sales-plan-next-page");

  if (!showButton || !form) return;

  createSalesPlanStyle();
  showButton.addEventListener("click", openSalesPlanScreen);
  backButton.addEventListener("click", closeSalesPlanScreen);
  lookupButton.addEventListener("click", loadSalesPlanProduct);
  form.addEventListener("submit", saveSalesPlanFromForm);
  cancelEditButton.addEventListener("click", resetSalesPlanForm);
  shippingType.addEventListener("change", updateSalesPlanShippingFields);
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

  updateSalesPlanShippingFields();
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

function updateSalesPlanShippingFields() {
  const typeSelect = document.querySelector("#sales-plan-shipping-type");
  const dateArea = document.querySelector("#sales-plan-shipping-date-area");
  const startArea = document.querySelector("#sales-plan-shipping-period-start-area");
  const endArea = document.querySelector("#sales-plan-shipping-period-end-area");
  const dateInput = document.querySelector("#sales-plan-shipping-date");
  const startInput = document.querySelector("#sales-plan-shipping-start-date");
  const endInput = document.querySelector("#sales-plan-shipping-end-date");
  const note = document.querySelector("#sales-plan-shipping-note");

  if (
    !typeSelect || !dateArea || !startArea || !endArea ||
    !dateInput || !startInput || !endInput
  ) return;

  const isPeriod = typeSelect.value === "period";

  // style.css の「form div { display: grid; }」より確実に優先して、
  // 選択していない入力欄を完全に非表示にします。
  dateArea.hidden = isPeriod;
  startArea.hidden = !isPeriod;
  endArea.hidden = !isPeriod;
  dateArea.style.display = isPeriod ? "none" : "";
  startArea.style.display = isPeriod ? "" : "none";
  endArea.style.display = isPeriod ? "" : "none";

  // 非表示側は required を外し、disabled にしてブラウザの必須判定対象からも外します。
  dateInput.required = !isPeriod;
  dateInput.disabled = isPeriod;
  startInput.required = isPeriod;
  startInput.disabled = !isPeriod;
  endInput.required = isPeriod;
  endInput.disabled = !isPeriod;

  if (note) {
    note.textContent = isPeriod
      ? "出荷期間の開始日と終了日を入力してください。"
      : "出荷する日を1日選んでください。";
  }
}

function readSalesPlanShippingFromForm() {
  const shippingType = document.querySelector("#sales-plan-shipping-type").value;
  const shippingDate = document.querySelector("#sales-plan-shipping-date").value;
  const shippingStartDate = document.querySelector("#sales-plan-shipping-start-date").value;
  const shippingEndDate = document.querySelector("#sales-plan-shipping-end-date").value;

  if (shippingType === "date") {
    if (!isIsoDate(shippingDate)) {
      alert("出荷日を選択してください。");
      document.querySelector("#sales-plan-shipping-date").focus();
      return null;
    }
    return {
      shippingType: "date",
      shippingDate: shippingDate,
      shippingStartDate: "",
      shippingEndDate: "",
      shippingMonth: shippingDate.slice(0, 7)
    };
  }

  if (shippingType === "period") {
    if (!isIsoDate(shippingStartDate)) {
      alert("出荷期間の開始日を選択してください。");
      document.querySelector("#sales-plan-shipping-start-date").focus();
      return null;
    }
    if (!isIsoDate(shippingEndDate)) {
      alert("出荷期間の終了日を選択してください。");
      document.querySelector("#sales-plan-shipping-end-date").focus();
      return null;
    }
    if (shippingEndDate < shippingStartDate) {
      alert("出荷期間の終了日は、開始日以降の日付を選択してください。");
      document.querySelector("#sales-plan-shipping-end-date").focus();
      return null;
    }
    return {
      shippingType: "period",
      shippingDate: "",
      shippingStartDate: shippingStartDate,
      shippingEndDate: shippingEndDate,
      shippingMonth: shippingStartDate.slice(0, 7)
    };
  }

  alert("出荷日の指定方法を選択してください。");
  document.querySelector("#sales-plan-shipping-type").focus();
  return null;
}

async function saveSalesPlanFromForm(event) {
  event.preventDefault();

  const customerName = document.querySelector("#sales-plan-customer").value.trim();
  const internalCode = document.querySelector("#sales-plan-internal-code").value.trim();
  const quantity = Number(document.querySelector("#sales-plan-quantity").value);
  const product = findSalesPlanProduct(internalCode);

  if (!customerName) {
    alert("取引先名を入力してください。");
    document.querySelector("#sales-plan-customer").focus();
    return;
  }

  const shipping = readSalesPlanShippingFromForm();
  if (!shipping) return;

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
    shippingType: shipping.shippingType,
    shippingDate: shipping.shippingDate,
    shippingStartDate: shipping.shippingStartDate,
    shippingEndDate: shipping.shippingEndDate,
    shippingMonth: shipping.shippingMonth,
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
  document.querySelector("#sales-plan-internal-code").value = record.internalCode || "";
  document.querySelector("#sales-plan-product-code").value = record.productCode || "";
  document.querySelector("#sales-plan-product-name").value = record.productName || "";
  document.querySelector("#sales-plan-quantity").value = record.quantity || 1;

  const type = getSalesPlanShippingType(record);
  const typeSelect = document.querySelector("#sales-plan-shipping-type");
  const dateInput = document.querySelector("#sales-plan-shipping-date");
  const startInput = document.querySelector("#sales-plan-shipping-start-date");
  const endInput = document.querySelector("#sales-plan-shipping-end-date");
  dateInput.value = "";
  startInput.value = "";
  endInput.value = "";

  if (type === "period") {
    typeSelect.value = "period";
    startInput.value = record.shippingStartDate || "";
    endInput.value = record.shippingEndDate || "";
  } else if (type === "date") {
    typeSelect.value = "date";
    dateInput.value = record.shippingDate || "";
  } else {
    typeSelect.value = "date";
    alert(
      "この予定はv34で登録した『月指定』のデータです。\n" +
      `${formatSalesPlanMonth(record.shippingMonth)} の正しい出荷日、または出荷期間を選び直して保存してください。`
    );
  }

  updateSalesPlanShippingFields();
  document.querySelector("#save-sales-plan-button").textContent = "変更を保存する";
  document.querySelector("#cancel-sales-plan-edit-button").hidden = false;
  document.querySelector("#sales-plan-form-area").scrollIntoView({ behavior: "smooth", block: "start" });
}

async function removeSalesPlan(id) {
  const record = salesPlanRecords.find(function (item) { return item.id === id; });
  if (!record) return;

  const confirmed = window.confirm(
    `${record.productName}\n${formatSalesPlanShipping(record)} / ${record.quantity}個\n\nこの販売予定を削除しますか？`
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
  document.querySelector("#sales-plan-shipping-type").value = "date";
  updateSalesPlanShippingFields();
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
    const matchesMonth = !month || salesPlanMatchesMonth(record, month);
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
      <td>${escapeSalesPlanHtml(formatSalesPlanShipping(record))}</td>
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
  const dateCompare = getSalesPlanSortDate(a).localeCompare(getSalesPlanSortDate(b));
  if (dateCompare !== 0) return dateCompare;
  const customerCompare = String(a.customerName || "").localeCompare(String(b.customerName || ""), "ja");
  if (customerCompare !== 0) return customerCompare;
  return String(a.internalCode || "").localeCompare(String(b.internalCode || ""), "ja", { numeric: true });
}

function getSalesPlanShippingType(record) {
  if (record && record.shippingType === "date" && isIsoDate(record.shippingDate)) return "date";
  if (
    record &&
    record.shippingType === "period" &&
    isIsoDate(record.shippingStartDate) &&
    isIsoDate(record.shippingEndDate)
  ) return "period";
  if (record && isIsoDate(record.shippingDate)) return "date";
  if (record && isIsoDate(record.shippingStartDate) && isIsoDate(record.shippingEndDate)) return "period";
  if (record && /^\d{4}-\d{2}$/.test(String(record.shippingMonth || ""))) return "month";
  return "unknown";
}

function getSalesPlanSortDate(record) {
  const type = getSalesPlanShippingType(record);
  if (type === "date") return record.shippingDate;
  if (type === "period") return record.shippingStartDate;
  if (type === "month") return `${record.shippingMonth}-01`;
  return "9999-12-31";
}

function formatSalesPlanShipping(record) {
  const type = getSalesPlanShippingType(record);
  if (type === "date") return formatSalesPlanDate(record.shippingDate);
  if (type === "period") {
    return `${formatSalesPlanDate(record.shippingStartDate)} ～ ${formatSalesPlanDate(record.shippingEndDate)}`;
  }
  if (type === "month") return `${formatSalesPlanMonth(record.shippingMonth)}（旧形式）`;
  return "未設定";
}

function formatSalesPlanDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ""));
  if (!match) return value || "未設定";
  return `${match[1]}/${match[2]}/${match[3]}`;
}

function formatSalesPlanMonth(value) {
  const match = /^(\d{4})-(\d{2})$/.exec(String(value || ""));
  if (!match) return value || "未設定";
  return `${match[1]}年${Number(match[2])}月`;
}

function salesPlanMatchesMonth(record, month) {
  if (!/^\d{4}-\d{2}$/.test(String(month || ""))) return true;
  const type = getSalesPlanShippingType(record);
  if (type === "date") return record.shippingDate.slice(0, 7) === month;
  if (type === "month") return record.shippingMonth === month;
  if (type === "period") {
    const monthStart = `${month}-01`;
    const monthEnd = getLastDateOfMonth(month);
    return record.shippingStartDate <= monthEnd && record.shippingEndDate >= monthStart;
  }
  return false;
}

function getLastDateOfMonth(month) {
  const match = /^(\d{4})-(\d{2})$/.exec(String(month || ""));
  if (!match) return "";
  const year = Number(match[1]);
  const monthNumber = Number(match[2]);
  const lastDay = new Date(year, monthNumber, 0).getDate();
  return `${match[1]}-${match[2]}-${String(lastDay).padStart(2, "0")}`;
}

function salesPlanOverlapsDateRange(record, startDate, endDate) {
  if (!isIsoDate(startDate) || !isIsoDate(endDate) || endDate < startDate) return false;
  const type = getSalesPlanShippingType(record);
  if (type === "date") return record.shippingDate >= startDate && record.shippingDate <= endDate;
  if (type === "period") {
    return record.shippingStartDate <= endDate && record.shippingEndDate >= startDate;
  }
  if (type === "month") {
    const monthStart = `${record.shippingMonth}-01`;
    const monthEnd = getLastDateOfMonth(record.shippingMonth);
    return monthStart <= endDate && monthEnd >= startDate;
  }
  return false;
}

function getSalesPlansInDateRange(startDate, endDate) {
  return salesPlanRecords.filter(function (record) {
    return salesPlanOverlapsDateRange(record, startDate, endDate);
  });
}

function getUpcomingSalesPlanQuantityByInternalCode(internalCode, startDate, endDate) {
  const target = String(internalCode || "").trim();
  return getSalesPlansInDateRange(startDate, endDate)
    .filter(function (record) { return String(record.internalCode || "").trim() === target; })
    .reduce(function (sum, record) { return sum + Number(record.quantity || 0); }, 0);
}

function isIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) return false;
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return false;
  const [year, month, day] = value.split("-").map(Number);
  return date.getFullYear() === year && date.getMonth() + 1 === month && date.getDate() === day;
}

function createSalesPlanId() {
  return `sales-plan-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function escapeSalesPlanHtml(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
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
    .sales-plan-shipping-note { margin: -4px 0 0; padding: 10px 12px; border-radius: 8px; background: #e3f2fd; color: #164e63; }
    #sales-plan-shipping-date-area[hidden],
    #sales-plan-shipping-period-start-area[hidden],
    #sales-plan-shipping-period-end-area[hidden] { display: none !important; }
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
  getPlansInDateRange: getSalesPlansInDateRange,
  getUpcomingQuantityByInternalCode: getUpcomingSalesPlanQuantityByInternalCode,
  refresh: refreshSalesPlanData
};
