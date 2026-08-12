"use strict";

const PURCHASE_REQUIRED_PAGE_SIZE = 20;
let purchaseRequiredRows = [];
let purchaseRequiredCurrentPage = 1;
let purchaseRequiredContext = null;

window.addEventListener("DOMContentLoaded", initializePurchaseRequiredFeature);

function initializePurchaseRequiredFeature() {
  const showButton = document.querySelector("#show-purchase-required-button");
  const backButton = document.querySelector("#back-home-from-purchase-required");
  const searchInput = document.querySelector("#purchase-required-search");
  const prevButton = document.querySelector("#purchase-required-prev-page");
  const nextButton = document.querySelector("#purchase-required-next-page");
  const refreshButton = document.querySelector("#refresh-purchase-required-button");

  if (!showButton) return;
  createPurchaseRequiredStyle();
  showButton.addEventListener("click", openPurchaseRequiredScreen);
  if (backButton) backButton.addEventListener("click", closePurchaseRequiredScreen);
  if (searchInput) {
    searchInput.addEventListener("input", function () {
      purchaseRequiredCurrentPage = 1;
      renderPurchaseRequiredTable();
    });
  }
  if (prevButton) {
    prevButton.addEventListener("click", function () {
      if (purchaseRequiredCurrentPage > 1) {
        purchaseRequiredCurrentPage -= 1;
        renderPurchaseRequiredTable();
        scrollPurchaseRequiredTableIntoView();
      }
    });
  }
  if (nextButton) {
    nextButton.addEventListener("click", function () {
      const pages = getPurchaseRequiredTotalPages();
      if (purchaseRequiredCurrentPage < pages) {
        purchaseRequiredCurrentPage += 1;
        renderPurchaseRequiredTable();
        scrollPurchaseRequiredTableIntoView();
      }
    });
  }
  if (refreshButton) refreshButton.addEventListener("click", refreshPurchaseRequiredData);
}

async function openPurchaseRequiredScreen() {
  document.querySelectorAll("main > section").forEach(function (section) {
    section.hidden = true;
  });
  const screen = document.querySelector("#purchase-required");
  screen.hidden = false;
  purchaseRequiredCurrentPage = 1;
  await refreshPurchaseRequiredData();
  screen.scrollIntoView({ behavior: "smooth", block: "start" });
}

function closePurchaseRequiredScreen() {
  const screen = document.querySelector("#purchase-required");
  if (screen) screen.hidden = true;
  if (window.inventoryApp && typeof window.inventoryApp.showScreen === "function") {
    window.inventoryApp.showScreen("home");
  } else {
    const home = document.querySelector("#home");
    if (home) home.hidden = false;
  }
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function refreshPurchaseRequiredData() {
  const summary = document.querySelector("#purchase-required-summary");
  if (summary) summary.textContent = "発注判定を計算しています...";

  try {
    const result = await Promise.all([
      getAllProducts(),
      getAllSalesActuals(),
      getAllSalesPlans(),
      getAllSalesImportBatches()
    ]);
    const products = result[0];
    const actuals = result[1];
    const plans = result[2];
    const batches = result[3];

    const context = buildPurchaseRequiredDateContext(new Date());
    const actualByProduct = aggregatePurchaseActuals(actuals, context.actualMonthKeys);
    const planByProduct = aggregatePurchasePlans(plans, context.forecastStartDate, context.forecastEndDate);
    const coverage = calculatePurchaseActualCoverage(batches, context.actualStartDate, context.actualEndDate);

    purchaseRequiredRows = products
      .filter(function (product) { return !isPurchaseDiscontinuedProduct(product); })
      .map(function (product) {
        const internalCode = String(product.internalCode || "").trim();
        const sixMonthSales = actualByProduct.get(internalCode) || 0;
        const monthlyAverage = sixMonthSales / 6;
        const threeMonthBase = monthlyAverage * 3;
        const plannedQuantity = planByProduct.get(internalCode) || 0;
        const requiredStockRaw = threeMonthBase + plannedQuantity;
        const requiredStock = Math.ceil(requiredStockRaw);
        const currentStock = getPurchaseStockNumber(product.stock);
        const shortage = Math.max(0, requiredStock - currentStock);
        return {
          internalCode: internalCode,
          productCode: product.productCode || "",
          productName: product.productName || "",
          currentStock: currentStock,
          sixMonthSales: sixMonthSales,
          monthlyAverage: monthlyAverage,
          threeMonthBase: threeMonthBase,
          plannedQuantity: plannedQuantity,
          requiredStock: requiredStock,
          shortage: shortage,
          location: product.location || ""
        };
      })
      .filter(function (row) { return row.shortage > 0; })
      .sort(function (a, b) {
        if (b.shortage !== a.shortage) return b.shortage - a.shortage;
        return a.internalCode.localeCompare(b.internalCode, "ja", { numeric: true });
      });

    purchaseRequiredContext = { ...context, coverage: coverage, totalProducts: products.length };
    purchaseRequiredCurrentPage = 1;
    renderPurchaseRequiredSummary();
    renderPurchaseRequiredCoverageWarning();
    renderPurchaseRequiredTable();
  } catch (error) {
    console.error("発注必要一覧計算エラー", error);
    if (summary) summary.textContent = "発注判定を計算できませんでした。";
    alert("発注が必要な商品一覧を計算できませんでした。");
  }
}

function buildPurchaseRequiredDateContext(today) {
  const localToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const currentMonthStart = new Date(localToday.getFullYear(), localToday.getMonth(), 1);
  const actualStart = new Date(localToday.getFullYear(), localToday.getMonth() - 6, 1);
  const actualEnd = new Date(currentMonthStart.getFullYear(), currentMonthStart.getMonth(), 0);
  const forecastStart = localToday;
  const forecastEndExclusive = addPurchaseMonths(localToday, 3);
  const forecastEnd = new Date(forecastEndExclusive.getFullYear(), forecastEndExclusive.getMonth(), forecastEndExclusive.getDate() - 1);
  const actualMonthKeys = [];
  for (let offset = 6; offset >= 1; offset -= 1) {
    const date = new Date(localToday.getFullYear(), localToday.getMonth() - offset, 1);
    actualMonthKeys.push(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`);
  }
  return {
    evaluationDate: formatPurchaseIso(localToday),
    actualStartDate: formatPurchaseIso(actualStart),
    actualEndDate: formatPurchaseIso(actualEnd),
    actualMonthKeys: actualMonthKeys,
    forecastStartDate: formatPurchaseIso(forecastStart),
    forecastEndDate: formatPurchaseIso(forecastEnd)
  };
}

function addPurchaseMonths(date, months) {
  const sourceDay = date.getDate();
  const first = new Date(date.getFullYear(), date.getMonth() + months, 1);
  const lastDay = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  return new Date(first.getFullYear(), first.getMonth(), Math.min(sourceDay, lastDay));
}

function formatPurchaseIso(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function aggregatePurchaseActuals(actuals, monthKeys) {
  const monthSet = new Set(monthKeys);
  const result = new Map();
  actuals.forEach(function (record) {
    const saleDate = String(record.saleDate || "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(saleDate)) return;
    if (!monthSet.has(saleDate.slice(0, 7))) return;
    const code = String(record.internalCode || "").trim();
    if (!code) return;
    const quantity = Number(record.quantity || 0);
    if (!Number.isFinite(quantity)) return;
    result.set(code, (result.get(code) || 0) + quantity);
  });
  return result;
}

function aggregatePurchasePlans(plans, startDate, endDate) {
  const result = new Map();
  plans.forEach(function (plan) {
    if (!purchasePlanOverlapsRange(plan, startDate, endDate)) return;
    const code = String(plan.internalCode || "").trim();
    if (!code) return;
    const quantity = Number(plan.quantity || 0);
    if (!Number.isFinite(quantity)) return;
    result.set(code, (result.get(code) || 0) + quantity);
  });
  return result;
}

function purchasePlanOverlapsRange(plan, startDate, endDate) {
  const type = getPurchasePlanType(plan);
  if (type === "date") return plan.shippingDate >= startDate && plan.shippingDate <= endDate;
  if (type === "period") return plan.shippingStartDate <= endDate && plan.shippingEndDate >= startDate;
  if (type === "month") {
    const monthStart = `${plan.shippingMonth}-01`;
    const monthEnd = getPurchaseLastDateOfMonth(plan.shippingMonth);
    return monthStart <= endDate && monthEnd >= startDate;
  }
  return false;
}

function getPurchasePlanType(plan) {
  if (plan && plan.shippingType === "date" && isPurchaseIsoDate(plan.shippingDate)) return "date";
  if (plan && plan.shippingType === "period" && isPurchaseIsoDate(plan.shippingStartDate) && isPurchaseIsoDate(plan.shippingEndDate)) return "period";
  if (plan && isPurchaseIsoDate(plan.shippingDate)) return "date";
  if (plan && isPurchaseIsoDate(plan.shippingStartDate) && isPurchaseIsoDate(plan.shippingEndDate)) return "period";
  if (plan && /^\d{4}-\d{2}$/.test(String(plan.shippingMonth || ""))) return "month";
  return "unknown";
}

function isPurchaseIsoDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));
}

function getPurchaseLastDateOfMonth(month) {
  const match = /^(\d{4})-(\d{2})$/.exec(String(month || ""));
  if (!match) return "";
  const lastDay = new Date(Number(match[1]), Number(match[2]), 0).getDate();
  return `${match[1]}-${match[2]}-${String(lastDay).padStart(2, "0")}`;
}

function calculatePurchaseActualCoverage(batches, startDate, endDate) {
  const start = parsePurchaseLocalDate(startDate);
  const end = parsePurchaseLocalDate(endDate);
  if (!start || !end) return { coveredDays: 0, totalDays: 0, complete: false };
  const covered = new Set();
  const ranges = batches
    .map(function (batch) {
      return {
        start: parsePurchaseLocalDate(batch.reportStartDate),
        end: parsePurchaseLocalDate(batch.reportEndDate)
      };
    })
    .filter(function (range) { return range.start && range.end && range.end >= range.start; });

  let totalDays = 0;
  for (let cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
    totalDays += 1;
    const key = formatPurchaseIso(cursor);
    const isCovered = ranges.some(function (range) {
      return cursor >= range.start && cursor <= range.end;
    });
    if (isCovered) covered.add(key);
  }
  return {
    coveredDays: covered.size,
    totalDays: totalDays,
    complete: totalDays > 0 && covered.size === totalDays
  };
}

function parsePurchaseLocalDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ""));
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
}

function isPurchaseDiscontinuedProduct(product) {
  const status = String(product && (product.productStatus || product.status || "") || "").trim().toLowerCase();
  return status === "廃盤" || status === "discontinued" || Boolean(product && product.discontinued === true);
}

function getPurchaseStockNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function renderPurchaseRequiredSummary() {
  const summary = document.querySelector("#purchase-required-summary");
  if (!summary || !purchaseRequiredContext) return;
  const totalShortage = purchaseRequiredRows.reduce(function (sum, row) { return sum + row.shortage; }, 0);
  summary.innerHTML = `
    <strong>判定日：</strong>${escapePurchaseHtml(formatPurchaseDisplayDate(purchaseRequiredContext.evaluationDate))}<br>
    <strong>平均販売数：</strong>${escapePurchaseHtml(formatPurchaseDisplayDate(purchaseRequiredContext.actualStartDate))} ～ ${escapePurchaseHtml(formatPurchaseDisplayDate(purchaseRequiredContext.actualEndDate))} の6か月平均<br>
    <strong>販売予定：</strong>${escapePurchaseHtml(formatPurchaseDisplayDate(purchaseRequiredContext.forecastStartDate))} ～ ${escapePurchaseHtml(formatPurchaseDisplayDate(purchaseRequiredContext.forecastEndDate))}<br>
    <strong>発注が必要：</strong>${purchaseRequiredRows.length.toLocaleString("ja-JP")}商品 / <strong>不足数量合計：</strong>${totalShortage.toLocaleString("ja-JP")}個
  `;
}

function renderPurchaseRequiredCoverageWarning() {
  const box = document.querySelector("#purchase-required-coverage");
  if (!box || !purchaseRequiredContext) return;
  const coverage = purchaseRequiredContext.coverage;
  if (coverage.complete) {
    box.className = "purchase-required-coverage purchase-required-coverage-ok";
    box.textContent = `販売実績CSV：対象6か月の${coverage.totalDays}日分を取込済みです。`;
  } else {
    box.className = "purchase-required-coverage purchase-required-coverage-warning";
    box.textContent = `注意：販売実績CSVは対象6か月のうち ${coverage.coveredDays} / ${coverage.totalDays}日分を確認できています。未取込の日がある場合、月平均販売数と発注必要数が少なく計算されます。`;
  }
}

function getFilteredPurchaseRequiredRows() {
  const input = document.querySelector("#purchase-required-search");
  const term = String(input ? input.value : "").trim().toLowerCase();
  if (!term) return purchaseRequiredRows.slice();
  return purchaseRequiredRows.filter(function (row) {
    return [row.internalCode, row.productCode, row.productName, row.location]
      .some(function (value) { return String(value || "").toLowerCase().includes(term); });
  });
}

function renderPurchaseRequiredTable() {
  const body = document.querySelector("#purchase-required-table-body");
  const status = document.querySelector("#purchase-required-page-status");
  const prev = document.querySelector("#purchase-required-prev-page");
  const next = document.querySelector("#purchase-required-next-page");
  const count = document.querySelector("#purchase-required-filter-count");
  if (!body) return;

  const filtered = getFilteredPurchaseRequiredRows();
  const pages = Math.max(1, Math.ceil(filtered.length / PURCHASE_REQUIRED_PAGE_SIZE));
  if (purchaseRequiredCurrentPage > pages) purchaseRequiredCurrentPage = pages;
  const start = (purchaseRequiredCurrentPage - 1) * PURCHASE_REQUIRED_PAGE_SIZE;
  const rows = filtered.slice(start, start + PURCHASE_REQUIRED_PAGE_SIZE);
  body.innerHTML = "";

  if (rows.length === 0) {
    const row = document.createElement("tr");
    row.innerHTML = '<td colspan="12">条件に該当する商品はありません。</td>';
    body.appendChild(row);
  } else {
    rows.forEach(function (item) {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td><strong class="purchase-required-shortage">${item.shortage.toLocaleString("ja-JP")}</strong></td>
        <td>${escapePurchaseHtml(item.internalCode)}</td>
        <td>${escapePurchaseHtml(item.productCode)}</td>
        <td>${escapePurchaseHtml(item.productName)}</td>
        <td>${item.currentStock.toLocaleString("ja-JP")}</td>
        <td>${formatPurchaseQuantity(item.sixMonthSales)}</td>
        <td>${formatPurchaseDecimal(item.monthlyAverage)}</td>
        <td>${formatPurchaseDecimal(item.threeMonthBase)}</td>
        <td>${formatPurchaseQuantity(item.plannedQuantity)}</td>
        <td><strong>${item.requiredStock.toLocaleString("ja-JP")}</strong></td>
        <td>${escapePurchaseHtml(item.location)}</td>
        <td><span class="purchase-required-badge">発注必要</span></td>
      `;
      body.appendChild(row);
    });
  }

  if (status) status.textContent = `${purchaseRequiredCurrentPage} / ${pages}ページ`;
  if (prev) prev.disabled = purchaseRequiredCurrentPage <= 1;
  if (next) next.disabled = purchaseRequiredCurrentPage >= pages;
  if (count) count.textContent = `表示：${filtered.length.toLocaleString("ja-JP")}商品`;
}

function getPurchaseRequiredTotalPages() {
  return Math.max(1, Math.ceil(getFilteredPurchaseRequiredRows().length / PURCHASE_REQUIRED_PAGE_SIZE));
}

function scrollPurchaseRequiredTableIntoView() {
  const table = document.querySelector("#purchase-required-list-area");
  if (table) table.scrollIntoView({ behavior: "smooth", block: "start" });
}

function formatPurchaseDisplayDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ""));
  if (!match) return value || "";
  return `${match[1]}/${match[2]}/${match[3]}`;
}

function formatPurchaseDecimal(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "0";
  return number.toLocaleString("ja-JP", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

function formatPurchaseQuantity(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "0";
  return number.toLocaleString("ja-JP", { maximumFractionDigits: 2 });
}

function escapePurchaseHtml(value) {
  return String(value === undefined || value === null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function createPurchaseRequiredStyle() {
  if (document.querySelector("#purchase-required-style")) return;
  const style = document.createElement("style");
  style.id = "purchase-required-style";
  style.textContent = `
    #purchase-required { scroll-margin-top: 86px; }
    #purchase-required .purchase-required-card { background: #fff; border: 1px solid #d9e1e8; border-radius: 14px; padding: 18px; margin: 16px 0; }
    #purchase-required .purchase-required-summary { background: #fff3e0; border-left: 5px solid #ef6c00; border-radius: 10px; padding: 14px; line-height: 1.8; }
    #purchase-required .purchase-required-coverage { border-radius: 10px; padding: 13px; margin-top: 12px; font-weight: 700; line-height: 1.6; }
    #purchase-required .purchase-required-coverage-ok { background: #e8f5e9; color: #1b5e20; }
    #purchase-required .purchase-required-coverage-warning { background: #fff3e0; color: #bf360c; }
    #purchase-required .purchase-required-filter { display: flex; gap: 10px; align-items: end; flex-wrap: wrap; margin-bottom: 12px; }
    #purchase-required .purchase-required-filter > div { flex: 1 1 300px; }
    #purchase-required .purchase-required-table-wrap { overflow-x: auto; }
    #purchase-required table { min-width: 1280px; }
    #purchase-required .purchase-required-shortage { color: #c62828; font-size: 18px; }
    #purchase-required .purchase-required-badge { display: inline-block; background: #c62828; color: #fff; padding: 4px 9px; border-radius: 999px; font-weight: 700; white-space: nowrap; }
    #purchase-required .purchase-required-pager { display: flex; align-items: center; justify-content: center; gap: 12px; margin-top: 14px; }
    #purchase-required button:disabled { background-color: #b0bec5 !important; cursor: not-allowed; }
    @media (max-width: 700px) {
      #purchase-required .purchase-required-card { padding: 13px; }
      #purchase-required .purchase-required-filter { display: grid; grid-template-columns: 1fr; }
    }
  `;
  document.head.appendChild(style);
}
