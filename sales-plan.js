"use strict";

const SALES_PLAN_PAGE_SIZE = 20;
let salesPlanRecords = [];
let salesPlanProducts = [];
let salesPlanEditingId = "";
let salesPlanCurrentPage = 1;

window.addEventListener("DOMContentLoaded", initializeSalesPlanFeature);

async function showSalesPlanDialog(options) {
  const dialogOptions = options || {};

  if (
    window.inventoryApp &&
    typeof window.inventoryApp.showAppDialog === "function"
  ) {
    return window.inventoryApp.showAppDialog(dialogOptions);
  }

  const details = Array.isArray(dialogOptions.details)
    ? dialogOptions.details
        .map(function (item) {
          return `${item.label || ""}：${item.value ?? ""}`;
        })
        .join("\n")
    : "";

  const text = [
    dialogOptions.title || "お知らせ",
    dialogOptions.message || "",
    details,
    dialogOptions.notice || ""
  ]
    .filter(Boolean)
    .join("\n\n");

  if (dialogOptions.isConfirm) {
    return window.confirm(text);
  }

  window.alert(text);
  return true;
}

async function initializeSalesPlanFeature() {
  const showButton = document.querySelector("#show-sales-plan-button");
  const showListButton = document.querySelector("#show-sales-plan-list-button");
  const jumpFormButton = document.querySelector("#jump-sales-plan-form-button");
  const jumpListButton = document.querySelector("#jump-sales-plan-list-button");
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
  if (showListButton) showListButton.addEventListener("click", openSalesPlanListScreen);
  if (jumpFormButton) jumpFormButton.addEventListener("click", scrollSalesPlanFormIntoView);
  if (jumpListButton) jumpListButton.addEventListener("click", scrollSalesPlanTableIntoView);
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
  await showSalesPlanScreen();
  scrollSalesPlanFormIntoView();
}

async function openSalesPlanListScreen() {
  await showSalesPlanScreen();
  scrollSalesPlanTableIntoView();
}

async function showSalesPlanScreen() {
  document.querySelectorAll("main > section").forEach(function (section) {
    section.hidden = true;
  });

  const screen = document.querySelector("#sales-plan");
  screen.hidden = false;

  try {
    await refreshSalesPlanData();
  } catch (error) {
    console.error("販売予定表読込エラー", error);
    await showSalesPlanDialog({
      type: "danger",
      icon: "⚠️",
      title: "販売予定表を読み込めませんでした",
      message: "保存されている販売予定データを読み込めませんでした。",
      notice: "画面を更新して、もう一度お試しください。",
      confirmText: "閉じる"
    });
  }
}

function scrollSalesPlanFormIntoView() {
  const formArea = document.querySelector("#sales-plan-form-area");
  if (formArea) {
    formArea.scrollIntoView({ behavior: "smooth", block: "start" });
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

async function loadSalesPlanProduct() {
  const internalCodeInput = document.querySelector("#sales-plan-internal-code");
  const internalCode = internalCodeInput.value.trim();
  const product = findSalesPlanProduct(internalCode);

  if (!product) {
    clearSalesPlanProductFields();
    await showSalesPlanDialog({
      type: "danger",
      icon: "🔎",
      title: "商品が見つかりません",
      message: "入力した社内コードの商品は登録されていません。",
      details: [
        { label: "社内コード", value: internalCode || "未入力" }
      ],
      notice: "社内コードを確認するか、商品一覧で登録状況を確認してください。",
      confirmText: "入力に戻る"
    });
    internalCodeInput.focus();
    internalCodeInput.select();
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

async function readSalesPlanShippingFromForm() {
  const shippingType = document.querySelector("#sales-plan-shipping-type").value;
  const shippingDate = document.querySelector("#sales-plan-shipping-date").value;
  const shippingStartDate = document.querySelector("#sales-plan-shipping-start-date").value;
  const shippingEndDate = document.querySelector("#sales-plan-shipping-end-date").value;

  if (shippingType === "date") {
    if (!isIsoDate(shippingDate)) {
      await showSalesPlanDialog({
        type: "warning",
        icon: "📅",
        title: "出荷日を選択してください",
        message: "出荷日を1日選んでから保存してください。",
        confirmText: "入力に戻る"
      });
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
      await showSalesPlanDialog({
        type: "warning",
        icon: "📅",
        title: "出荷期間の開始日を選択してください",
        message: "出荷期間の開始日を入力してください。",
        confirmText: "入力に戻る"
      });
      document.querySelector("#sales-plan-shipping-start-date").focus();
      return null;
    }
    if (!isIsoDate(shippingEndDate)) {
      await showSalesPlanDialog({
        type: "warning",
        icon: "📅",
        title: "出荷期間の終了日を選択してください",
        message: "出荷期間の終了日を入力してください。",
        confirmText: "入力に戻る"
      });
      document.querySelector("#sales-plan-shipping-end-date").focus();
      return null;
    }
    if (shippingEndDate < shippingStartDate) {
      await showSalesPlanDialog({
        type: "danger",
        icon: "📅",
        title: "出荷期間の日付を確認してください",
        message: "終了日は開始日以降の日付を選択してください。",
        details: [
          { label: "開始日", value: shippingStartDate || "未入力" },
          { label: "終了日", value: shippingEndDate || "未入力" }
        ],
        confirmText: "入力に戻る"
      });
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

  await showSalesPlanDialog({
    type: "warning",
    icon: "📅",
    title: "出荷日の指定方法を選択してください",
    message: "「出荷日」または「出荷期間」のどちらかを選択してください。",
    confirmText: "入力に戻る"
  });
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
    await showSalesPlanDialog({
      type: "warning",
      icon: "🏢",
      title: "取引先名を入力してください",
      message: "販売予定を登録するには、取引先名の入力が必要です。",
      confirmText: "入力に戻る"
    });
    document.querySelector("#sales-plan-customer").focus();
    return;
  }

  const shipping = await readSalesPlanShippingFromForm();
  if (!shipping) return;

  if (!product) {
    await showSalesPlanDialog({
      type: "danger",
      icon: "🔎",
      title: "登録済みの商品を選択してください",
      message: "入力した社内コードの商品が見つかりません。",
      details: [
        { label: "社内コード", value: internalCode || "未入力" }
      ],
      notice: "商品を検索して、登録済みの商品を選んでください。",
      confirmText: "入力に戻る"
    });
    document.querySelector("#sales-plan-internal-code").focus();
    return;
  }
  if (!Number.isInteger(quantity) || quantity <= 0) {
    await showSalesPlanDialog({
      type: "warning",
      icon: "🔢",
      title: "数量を確認してください",
      message: "数量は1以上の整数で入力してください。",
      details: [
        { label: "入力値", value: document.querySelector("#sales-plan-quantity").value || "未入力" },
        { label: "入力できる値", value: "1以上の整数" }
      ],
      confirmText: "入力に戻る"
    });
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
    await showSalesPlanDialog({
      type: "success",
      icon: "✅",
      title: message,
      details: [
        { label: "取引先", value: customerName },
        { label: "商品", value: product.productName || product.internalCode },
        { label: "出荷時期", value: formatSalesPlanShipping(record) },
        { label: "数量", value: `${quantity}個` }
      ],
      confirmText: "閉じる"
    });
  } catch (error) {
    console.error("販売予定保存エラー", error);
    await showSalesPlanDialog({
      type: "danger",
      icon: "⚠️",
      title: "販売予定を保存できませんでした",
      message: "販売予定の保存中にエラーが発生しました。",
      notice: "入力内容を確認し、画面を開き直してもう一度お試しください。",
      confirmText: "閉じる"
    });
  }
}

async function editSalesPlan(id) {
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
    await showSalesPlanDialog({
      type: "warning",
      icon: "📅",
      title: "出荷時期を選び直してください",
      message: "この予定は旧バージョンで『月指定』として登録されたデータです。",
      details: [
        { label: "登録済みの月", value: formatSalesPlanMonth(record.shippingMonth) }
      ],
      notice: "正しい出荷日、または出荷期間を選び直して保存してください。",
      confirmText: "入力に戻る"
    });
  }

  updateSalesPlanShippingFields();
  document.querySelector("#save-sales-plan-button").textContent = "変更を保存する";
  document.querySelector("#cancel-sales-plan-edit-button").hidden = false;
  document.querySelector("#sales-plan-form-area").scrollIntoView({ behavior: "smooth", block: "start" });
}

async function removeSalesPlan(id) {
  const record = salesPlanRecords.find(function (item) { return item.id === id; });
  if (!record) return;

  const confirmed = await showSalesPlanDialog({
    type: "danger",
    icon: "🗑️",
    title: "販売予定を削除しますか？",
    message: "次の販売予定を削除しようとしています。内容を確認してください。",
    details: [
      { label: "取引先", value: record.customerName || "未登録" },
      { label: "商品", value: record.productName || record.internalCode },
      { label: "社内コード", value: record.internalCode || "未登録" },
      { label: "出荷時期", value: formatSalesPlanShipping(record) },
      { label: "数量", value: `${record.quantity || 0}個` }
    ],
    notice: "削除した販売予定は、発注必要数などの計算対象から外れます。",
    isConfirm: true,
    cancelText: "戻る",
    confirmText: "販売予定を削除する"
  });
  if (!confirmed) return;

  try {
    await deleteSalesPlan(id);
    if (salesPlanEditingId === id) resetSalesPlanForm();
    await refreshSalesPlanData();
    await showSalesPlanDialog({
      type: "success",
      icon: "✅",
      title: "販売予定を削除しました",
      details: [
        { label: "商品", value: record.productName || record.internalCode },
        { label: "出荷時期", value: formatSalesPlanShipping(record) },
        { label: "数量", value: `${record.quantity || 0}個` }
      ],
      confirmText: "閉じる"
    });
  } catch (error) {
    console.error("販売予定削除エラー", error);
    await showSalesPlanDialog({
      type: "danger",
      icon: "⚠️",
      title: "販売予定を削除できませんでした",
      message: "削除処理中にエラーが発生しました。",
      notice: "画面を更新して、もう一度お試しください。",
      confirmText: "閉じる"
    });
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
  const listArea = document.querySelector("#sales-plan-list-area");
  if (listArea) {
    listArea.scrollIntoView({ behavior: "smooth", block: "start" });
  }
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
    .sales-plan-screen-shortcuts { display: flex; flex-wrap: wrap; gap: 10px; margin: 0 0 16px; }
    .sales-plan-screen-shortcuts button { flex: 1 1 220px; margin: 0; }
    #jump-sales-plan-list-button { background: #00695c; }
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
    #show-sales-plan-list-button { background: #00695c; }
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
