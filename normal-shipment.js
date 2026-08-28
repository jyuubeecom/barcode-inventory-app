"use strict";

const NORMAL_SHIPMENT_PAGE_SIZE = 20;
let normalShipmentRows = [];
let normalShipmentCurrentPage = 1;
let normalShipmentContext = null;

window.normalShipmentCalculator = {
  calculateRange: calculateNormalShipmentRange,
  buildPreviousMonthsContext: buildNormalShipmentPreviousMonthsContext,
  getProductSummary: getNormalShipmentProductSummary,
  getProductMonthSummary: getNormalShipmentProductMonthSummary,
  normalizeCustomer: normalizeNormalShipmentCustomer
};

window.addEventListener("DOMContentLoaded", initializeNormalShipmentFeature);

function initializeNormalShipmentFeature() {
  const showButton = document.querySelector("#show-normal-shipment-button");
  const backButton = document.querySelector("#back-home-from-normal-shipment");
  const searchInput = document.querySelector("#normal-shipment-search");
  const filterSelect = document.querySelector("#normal-shipment-filter");
  const refreshButton = document.querySelector("#refresh-normal-shipment-button");
  const prevButton = document.querySelector("#normal-shipment-prev-page");
  const nextButton = document.querySelector("#normal-shipment-next-page");

  if (!showButton) return;

  createNormalShipmentStyle();
  showButton.addEventListener("click", openNormalShipmentScreen);
  if (backButton) backButton.addEventListener("click", closeNormalShipmentScreen);
  if (refreshButton) refreshButton.addEventListener("click", refreshNormalShipmentData);

  if (searchInput) {
    searchInput.addEventListener("input", function () {
      normalShipmentCurrentPage = 1;
      renderNormalShipmentTable();
    });
  }

  if (filterSelect) {
    filterSelect.addEventListener("change", function () {
      normalShipmentCurrentPage = 1;
      renderNormalShipmentTable();
    });
  }

  if (prevButton) {
    prevButton.addEventListener("click", function () {
      if (normalShipmentCurrentPage > 1) {
        normalShipmentCurrentPage -= 1;
        renderNormalShipmentTable();
        scrollNormalShipmentListIntoView();
      }
    });
  }

  if (nextButton) {
    nextButton.addEventListener("click", function () {
      const pages = getNormalShipmentTotalPages();
      if (normalShipmentCurrentPage < pages) {
        normalShipmentCurrentPage += 1;
        renderNormalShipmentTable();
        scrollNormalShipmentListIntoView();
      }
    });
  }
}

async function openNormalShipmentScreen() {
  document.querySelectorAll("main > section").forEach(function (section) {
    section.hidden = true;
  });

  const screen = document.querySelector("#normal-shipment");
  if (!screen) return;
  screen.hidden = false;
  normalShipmentCurrentPage = 1;
  await refreshNormalShipmentData();
  screen.scrollIntoView({ behavior: "smooth", block: "start" });
}

function closeNormalShipmentScreen() {
  const screen = document.querySelector("#normal-shipment");
  if (screen) screen.hidden = true;

  if (window.inventoryApp && typeof window.inventoryApp.showScreen === "function") {
    window.inventoryApp.showScreen("home");
  } else {
    const home = document.querySelector("#home");
    if (home) home.hidden = false;
  }

  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function refreshNormalShipmentData() {
  const summary = document.querySelector("#normal-shipment-summary");
  if (summary) summary.textContent = "通常出荷数量を計算しています...";

  try {
    const result = await Promise.all([
      getAllProducts(),
      getAllSalesActuals(),
      getAllSalesPlans()
    ]);

    const products = Array.isArray(result[0]) ? result[0] : [];
    const actuals = Array.isArray(result[1]) ? result[1] : [];
    const plans = Array.isArray(result[2]) ? result[2] : [];
    const context = buildNormalShipmentPreviousMonthsContext(new Date(), 6);
    const calculation = calculateNormalShipmentRange(
      actuals,
      plans,
      context.startDate,
      context.endDate
    );

    normalShipmentRows = products
      .map(function (product) {
        const internalCode = String(product.internalCode || "").trim();
        const item = getNormalShipmentProductSummary(calculation, internalCode);
        const normalQuantity = Math.max(0, Number(item.normalShipment || 0));
        const monthlyAverage = Math.max(0, Math.ceil(normalQuantity / 6));

        return {
          internalCode: internalCode,
          productCode: product.productCode || "",
          productName: product.productName || "",
          totalShipment: Number(item.totalShipment || 0),
          plannedShipment: Number(item.plannedShipment || 0),
          normalShipment: normalQuantity,
          monthlyAverage: monthlyAverage,
          location: product.location || ""
        };
      })
      .sort(function (a, b) {
        if (b.normalShipment !== a.normalShipment) return b.normalShipment - a.normalShipment;
        return a.internalCode.localeCompare(b.internalCode, "ja", { numeric: true });
      });

    normalShipmentContext = {
      ...context,
      calculation: calculation
    };

    normalShipmentCurrentPage = 1;
    renderNormalShipmentSummary();
    renderNormalShipmentTable();
  } catch (error) {
    console.error("通常出荷数量計算エラー", error);
    if (summary) summary.textContent = "通常出荷数量を計算できませんでした。";

    if (typeof showAppDialog === "function") {
      await showAppDialog({
        type: "danger",
        icon: "⚠️",
        title: "通常出荷数量を計算できませんでした",
        message: "販売実績または販売予定のデータを読み込めませんでした。画面を更新して、もう一度お試しください。",
        confirmText: "確認して閉じる"
      });
    }
  }
}

function buildNormalShipmentPreviousMonthsContext(today, monthCount) {
  const base = today instanceof Date && !Number.isNaN(today.getTime()) ? today : new Date();
  const count = Math.max(1, Math.floor(Number(monthCount) || 1));
  const start = new Date(base.getFullYear(), base.getMonth() - count, 1);
  const end = new Date(base.getFullYear(), base.getMonth(), 0);

  return {
    startDate: formatNormalShipmentIso(start),
    endDate: formatNormalShipmentIso(end),
    monthCount: count
  };
}

function calculateNormalShipmentRange(actuals, plans, startDate, endDate) {
  const start = String(startDate || "");
  const end = String(endDate || "");
  const actualRows = [];
  const actualByProduct = new Map();

  (Array.isArray(actuals) ? actuals : []).forEach(function (record, index) {
    const internalCode = String(record && record.internalCode || "").trim();
    const saleDate = String(record && record.saleDate || "");
    const quantity = Number(record && record.quantity || 0);

    if (!internalCode || !isNormalShipmentIsoDate(saleDate)) return;
    if (start && saleDate < start) return;
    if (end && saleDate > end) return;
    if (!Number.isFinite(quantity)) return;

    const row = {
      index: index,
      internalCode: internalCode,
      saleDate: saleDate,
      customerName: String(record && record.customerName || ""),
      customerKey: normalizeNormalShipmentCustomer(record && record.customerName),
      quantity: quantity,
      availableForPlan: Math.max(0, quantity),
      plannedShipment: 0
    };

    actualRows.push(row);

    if (!actualByProduct.has(internalCode)) {
      actualByProduct.set(internalCode, []);
    }
    actualByProduct.get(internalCode).push(row);
  });

  actualByProduct.forEach(function (rows) {
    rows.sort(function (a, b) {
      const dateCompare = a.saleDate.localeCompare(b.saleDate);
      return dateCompare !== 0 ? dateCompare : a.index - b.index;
    });
  });

  const candidatePlans = (Array.isArray(plans) ? plans : [])
    .map(function (plan, index) {
      const range = getNormalShipmentPlanRange(plan);
      const quantity = Number(plan && plan.quantity || 0);
      const internalCode = String(plan && plan.internalCode || "").trim();
      if (!range || !internalCode || !Number.isFinite(quantity) || quantity <= 0) return null;
      if (start && range.endDate < start) return null;
      if (end && range.startDate > end) return null;

      return {
        index: index,
        internalCode: internalCode,
        customerKey: normalizeNormalShipmentCustomer(plan && plan.customerName),
        startDate: start && range.startDate < start ? start : range.startDate,
        endDate: end && range.endDate > end ? end : range.endDate,
        quantity: quantity
      };
    })
    .filter(Boolean)
    .sort(function (a, b) {
      const dateCompare = a.startDate.localeCompare(b.startDate);
      return dateCompare !== 0 ? dateCompare : a.index - b.index;
    });

  candidatePlans.forEach(function (plan) {
    const rows = actualByProduct.get(plan.internalCode) || [];
    let remaining = plan.quantity;

    for (let index = 0; index < rows.length && remaining > 0; index += 1) {
      const row = rows[index];
      if (row.saleDate < plan.startDate || row.saleDate > plan.endDate) continue;
      if (row.availableForPlan <= 0) continue;
      if (!normalShipmentCustomersMatch(plan.customerKey, row.customerKey)) continue;

      const allocated = Math.min(remaining, row.availableForPlan);
      row.availableForPlan -= allocated;
      row.plannedShipment += allocated;
      remaining -= allocated;
    }
  });

  const byProduct = new Map();
  const byProductMonth = new Map();

  actualRows.forEach(function (row) {
    const productSummary = getOrCreateNormalShipmentSummary(byProduct, row.internalCode);
    productSummary.totalShipment += row.quantity;
    productSummary.plannedShipment += row.plannedShipment;

    const monthKey = row.saleDate.slice(0, 7);
    const monthMapKey = makeNormalShipmentMonthMapKey(row.internalCode, monthKey);
    const monthSummary = getOrCreateNormalShipmentSummary(byProductMonth, monthMapKey);
    monthSummary.totalShipment += row.quantity;
    monthSummary.plannedShipment += row.plannedShipment;
  });

  byProduct.forEach(finalizeNormalShipmentSummary);
  byProductMonth.forEach(finalizeNormalShipmentSummary);

  return {
    startDate: start,
    endDate: end,
    byProduct: byProduct,
    byProductMonth: byProductMonth,
    matchedPlanQuantity: Array.from(byProduct.values()).reduce(function (sum, item) {
      return sum + Number(item.plannedShipment || 0);
    }, 0)
  };
}

function getNormalShipmentProductSummary(calculation, internalCode) {
  const code = String(internalCode || "").trim();
  if (!calculation || !(calculation.byProduct instanceof Map) || !code) {
    return createEmptyNormalShipmentSummary();
  }
  return calculation.byProduct.get(code) || createEmptyNormalShipmentSummary();
}

function getNormalShipmentProductMonthSummary(calculation, internalCode, monthKey) {
  const code = String(internalCode || "").trim();
  const month = String(monthKey || "").trim();
  if (!calculation || !(calculation.byProductMonth instanceof Map) || !code || !month) {
    return createEmptyNormalShipmentSummary();
  }
  return calculation.byProductMonth.get(makeNormalShipmentMonthMapKey(code, month)) || createEmptyNormalShipmentSummary();
}

function createEmptyNormalShipmentSummary() {
  return {
    totalShipment: 0,
    plannedShipment: 0,
    normalShipment: 0
  };
}

function getOrCreateNormalShipmentSummary(map, key) {
  if (!map.has(key)) map.set(key, createEmptyNormalShipmentSummary());
  return map.get(key);
}

function finalizeNormalShipmentSummary(item) {
  item.totalShipment = Number(item.totalShipment || 0);
  item.plannedShipment = Math.max(0, Number(item.plannedShipment || 0));
  item.normalShipment = Math.max(0, item.totalShipment - item.plannedShipment);
}

function makeNormalShipmentMonthMapKey(internalCode, monthKey) {
  return `${internalCode}\u001f${monthKey}`;
}

function getNormalShipmentPlanRange(plan) {
  if (!plan) return null;

  if (plan.shippingType === "date" && isNormalShipmentIsoDate(plan.shippingDate)) {
    return { startDate: plan.shippingDate, endDate: plan.shippingDate };
  }

  if (
    plan.shippingType === "period" &&
    isNormalShipmentIsoDate(plan.shippingStartDate) &&
    isNormalShipmentIsoDate(plan.shippingEndDate)
  ) {
    return {
      startDate: plan.shippingStartDate,
      endDate: plan.shippingEndDate
    };
  }

  if (isNormalShipmentIsoDate(plan.shippingDate)) {
    return { startDate: plan.shippingDate, endDate: plan.shippingDate };
  }

  if (isNormalShipmentIsoDate(plan.shippingStartDate) && isNormalShipmentIsoDate(plan.shippingEndDate)) {
    return {
      startDate: plan.shippingStartDate,
      endDate: plan.shippingEndDate
    };
  }

  const month = String(plan.shippingMonth || "");
  if (/^\d{4}-\d{2}$/.test(month)) {
    return {
      startDate: `${month}-01`,
      endDate: getNormalShipmentLastDateOfMonth(month)
    };
  }

  return null;
}

function normalizeNormalShipmentCustomer(value) {
  return String(value || "")
    .normalize("NFKC")
    .replace(/株式会社|有限会社|合同会社|合資会社|合名会社|㈱|㈲/g, "")
    .replace(/[\s\u3000・･.,，。()（）\[\]［］【】「」『』'"’`]/g, "")
    .trim()
    .toLowerCase();
}

function normalShipmentCustomersMatch(planCustomerKey, actualCustomerKey) {
  if (!planCustomerKey) return true;
  if (!actualCustomerKey) return false;
  return planCustomerKey === actualCustomerKey;
}

function isNormalShipmentIsoDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));
}

function getNormalShipmentLastDateOfMonth(month) {
  const match = /^(\d{4})-(\d{2})$/.exec(String(month || ""));
  if (!match) return "";
  const lastDay = new Date(Number(match[1]), Number(match[2]), 0).getDate();
  return `${match[1]}-${match[2]}-${String(lastDay).padStart(2, "0")}`;
}

function formatNormalShipmentIso(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatNormalShipmentDisplayDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ""));
  if (!match) return String(value || "");
  return `${Number(match[1])}/${Number(match[2])}/${Number(match[3])}`;
}

function renderNormalShipmentSummary() {
  const summary = document.querySelector("#normal-shipment-summary");
  if (!summary || !normalShipmentContext) return;

  const totals = normalShipmentRows.reduce(function (result, row) {
    result.total += row.totalShipment;
    result.planned += row.plannedShipment;
    result.normal += row.normalShipment;
    return result;
  }, { total: 0, planned: 0, normal: 0 });

  summary.innerHTML = `
    <strong>対象期間：</strong>${escapeNormalShipmentHtml(formatNormalShipmentDisplayDate(normalShipmentContext.startDate))} ～ ${escapeNormalShipmentHtml(formatNormalShipmentDisplayDate(normalShipmentContext.endDate))}<br>
    <strong>総出荷数量：</strong>${formatNormalShipmentQuantity(totals.total)}個 /
    <strong>販売予定分：</strong>${formatNormalShipmentQuantity(totals.planned)}個 /
    <strong>通常出荷数量：</strong>${formatNormalShipmentQuantity(totals.normal)}個
  `;
}

function getFilteredNormalShipmentRows() {
  const input = document.querySelector("#normal-shipment-search");
  const filter = document.querySelector("#normal-shipment-filter");
  const term = String(input ? input.value : "")
    .normalize("NFKC")
    .trim()
    .toLowerCase();
  const filterValue = String(filter ? filter.value : "all");

  return normalShipmentRows.filter(function (row) {
    if (filterValue === "normal" && row.normalShipment <= 0) return false;
    if (filterValue === "planned" && row.plannedShipment <= 0) return false;
    if (filterValue === "actual" && row.totalShipment === 0) return false;

    if (!term) return true;

    return [row.internalCode, row.productCode, row.productName, row.location]
      .some(function (value) {
        return String(value || "").normalize("NFKC").toLowerCase().includes(term);
      });
  });
}

function renderNormalShipmentTable() {
  const body = document.querySelector("#normal-shipment-table-body");
  const count = document.querySelector("#normal-shipment-filter-count");
  const status = document.querySelector("#normal-shipment-page-status");
  const prev = document.querySelector("#normal-shipment-prev-page");
  const next = document.querySelector("#normal-shipment-next-page");
  if (!body) return;

  const filtered = getFilteredNormalShipmentRows();
  const pages = Math.max(1, Math.ceil(filtered.length / NORMAL_SHIPMENT_PAGE_SIZE));
  if (normalShipmentCurrentPage > pages) normalShipmentCurrentPage = pages;

  const start = (normalShipmentCurrentPage - 1) * NORMAL_SHIPMENT_PAGE_SIZE;
  const rows = filtered.slice(start, start + NORMAL_SHIPMENT_PAGE_SIZE);
  body.innerHTML = "";

  if (rows.length === 0) {
    const tr = document.createElement("tr");
    tr.innerHTML = '<td colspan="7" class="normal-shipment-empty">条件に該当する商品はありません。</td>';
    body.appendChild(tr);
  } else {
    rows.forEach(function (row) {
      const tr = document.createElement("tr");
      if (row.plannedShipment > 0) tr.classList.add("normal-shipment-has-plan");
      tr.innerHTML = `
        <td>${escapeNormalShipmentHtml(row.internalCode || "未登録")}</td>
        <td>${escapeNormalShipmentHtml(row.productCode || "未登録")}</td>
        <td>${escapeNormalShipmentHtml(row.productName || "未登録")}</td>
        <td class="number">${formatNormalShipmentQuantity(row.totalShipment)}個</td>
        <td class="number normal-shipment-planned">${formatNormalShipmentQuantity(row.plannedShipment)}個</td>
        <td class="number normal-shipment-normal"><strong>${formatNormalShipmentQuantity(row.normalShipment)}個</strong></td>
        <td class="number"><strong>${formatNormalShipmentQuantity(row.monthlyAverage)}個/月</strong></td>
      `;
      body.appendChild(tr);
    });
  }

  if (count) count.textContent = `表示：${filtered.length.toLocaleString("ja-JP")}商品`;
  if (status) status.textContent = `${normalShipmentCurrentPage} / ${pages}ページ`;
  if (prev) prev.disabled = normalShipmentCurrentPage <= 1;
  if (next) next.disabled = normalShipmentCurrentPage >= pages;
}

function getNormalShipmentTotalPages() {
  return Math.max(1, Math.ceil(getFilteredNormalShipmentRows().length / NORMAL_SHIPMENT_PAGE_SIZE));
}

function scrollNormalShipmentListIntoView() {
  const area = document.querySelector("#normal-shipment-list-area");
  if (area) area.scrollIntoView({ behavior: "smooth", block: "start" });
}

function formatNormalShipmentQuantity(value) {
  const number = Number(value || 0);
  if (!Number.isFinite(number)) return "0";
  return Math.round(number).toLocaleString("ja-JP");
}

function escapeNormalShipmentHtml(value) {
  return String(value === undefined || value === null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function createNormalShipmentStyle() {
  if (document.querySelector("#normal-shipment-style")) return;

  const style = document.createElement("style");
  style.id = "normal-shipment-style";
  style.textContent = `
    #normal-shipment .normal-shipment-card {
      background: #fff;
      border: 1px solid #cbd9e5;
      border-radius: 12px;
      padding: 16px;
      margin: 14px 0;
    }
    #normal-shipment .normal-shipment-summary {
      background: #eef7ff;
      border-left: 5px solid #1976d2;
      border-radius: 8px;
      padding: 12px 14px;
      line-height: 1.9;
    }
    #normal-shipment .normal-shipment-note {
      margin-top: 12px;
      padding: 12px 14px;
      border-radius: 8px;
      background: #fff8e1;
      border-left: 5px solid #f9a825;
      line-height: 1.75;
    }
    #normal-shipment .normal-shipment-filter-row {
      display: grid;
      grid-template-columns: minmax(280px, 1fr) minmax(190px, 260px) auto;
      gap: 12px;
      align-items: end;
      margin-bottom: 14px;
    }
    #normal-shipment .normal-shipment-filter-row label {
      display: block;
      font-weight: 700;
      margin-bottom: 6px;
    }
    #normal-shipment .normal-shipment-filter-row input,
    #normal-shipment .normal-shipment-filter-row select {
      width: 100%;
      min-height: 44px;
    }
    #normal-shipment .normal-shipment-table-wrap {
      overflow-x: auto;
    }
    #normal-shipment table {
      width: 100%;
      border-collapse: collapse;
    }
    #normal-shipment th,
    #normal-shipment td {
      border: 1px solid #d4dde5;
      padding: 10px 9px;
      vertical-align: middle;
    }
    #normal-shipment th {
      background: #eaf3fb;
      white-space: nowrap;
    }
    #normal-shipment td.number {
      text-align: right;
      white-space: nowrap;
    }
    #normal-shipment tr.normal-shipment-has-plan {
      background: #fffde7;
    }
    #normal-shipment .normal-shipment-planned {
      color: #b26a00;
    }
    #normal-shipment .normal-shipment-normal {
      color: #0b6b2b;
    }
    #normal-shipment .normal-shipment-pager {
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 14px;
      margin-top: 14px;
    }
    #normal-shipment .normal-shipment-empty {
      text-align: center;
      padding: 24px;
      color: #607d8b;
    }
    @media (max-width: 760px) {
      #normal-shipment .normal-shipment-filter-row {
        grid-template-columns: 1fr;
      }
    }
  `;

  document.head.appendChild(style);
}
