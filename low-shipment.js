"use strict";

const LOW_SHIPMENT_PAGE_SIZE = 20;
const LOW_SHIPMENT_THRESHOLD_MONTHS = 24;
let lowShipmentRows = [];
let lowShipmentCurrentPage = 1;
let lowShipmentContext = null;

window.addEventListener("DOMContentLoaded", initializeLowShipmentFeature);

function initializeLowShipmentFeature() {
  const showButton = document.querySelector("#show-low-shipment-button");
  const backButton = document.querySelector("#back-home-from-low-shipment");
  const searchInput = document.querySelector("#low-shipment-search");
  const filterSelect = document.querySelector("#low-shipment-filter");
  const prevButton = document.querySelector("#low-shipment-prev-page");
  const nextButton = document.querySelector("#low-shipment-next-page");
  const refreshButton = document.querySelector("#refresh-low-shipment-button");

  if (!showButton) return;
  createLowShipmentStyle();

  showButton.addEventListener("click", openLowShipmentScreen);
  if (backButton) backButton.addEventListener("click", closeLowShipmentScreen);
  if (searchInput) {
    searchInput.addEventListener("input", function () {
      lowShipmentCurrentPage = 1;
      renderLowShipmentTable();
    });
  }
  if (filterSelect) {
    filterSelect.addEventListener("change", function () {
      lowShipmentCurrentPage = 1;
      renderLowShipmentTable();
    });
  }
  if (prevButton) {
    prevButton.addEventListener("click", function () {
      if (lowShipmentCurrentPage > 1) {
        lowShipmentCurrentPage -= 1;
        renderLowShipmentTable();
        scrollLowShipmentTableIntoView();
      }
    });
  }
  if (nextButton) {
    nextButton.addEventListener("click", function () {
      const pages = getLowShipmentTotalPages();
      if (lowShipmentCurrentPage < pages) {
        lowShipmentCurrentPage += 1;
        renderLowShipmentTable();
        scrollLowShipmentTableIntoView();
      }
    });
  }
  if (refreshButton) refreshButton.addEventListener("click", refreshLowShipmentData);
}

async function openLowShipmentScreen() {
  document.querySelectorAll("main > section").forEach(function (section) {
    section.hidden = true;
  });
  const screen = document.querySelector("#low-shipment");
  if (!screen) return;
  screen.hidden = false;
  lowShipmentCurrentPage = 1;
  await refreshLowShipmentData();
  screen.scrollIntoView({ behavior: "smooth", block: "start" });
}

function closeLowShipmentScreen() {
  const screen = document.querySelector("#low-shipment");
  if (screen) screen.hidden = true;
  if (window.inventoryApp && typeof window.inventoryApp.showScreen === "function") {
    window.inventoryApp.showScreen("home");
  } else {
    const home = document.querySelector("#home");
    if (home) home.hidden = false;
  }
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function refreshLowShipmentData() {
  const summary = document.querySelector("#low-shipment-summary");
  if (summary) summary.textContent = "出荷低迷商品を計算しています...";

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

    const context = buildLowShipmentDateContext(new Date());
    const normalCalculation =
      window.normalShipmentCalculator &&
      typeof window.normalShipmentCalculator.calculateRange === "function"
        ? window.normalShipmentCalculator.calculateRange(
            actuals,
            plans,
            context.actualStartDate,
            context.actualEndDate
          )
        : null;
    const actualByProduct = normalCalculation
      ? null
      : aggregateLowShipmentActuals(actuals, context.actualMonthKeys);
    const coverage = calculateLowShipmentActualCoverage(batches, context.actualStartDate, context.actualEndDate);

    const activeProducts = products.filter(function (product) {
      return !isLowShipmentDiscontinuedProduct(product);
    });

    lowShipmentRows = activeProducts
      .map(function (product) {
        const internalCode = String(product.internalCode || "").trim();
        const normalSummary = normalCalculation
          ? window.normalShipmentCalculator.getProductSummary(normalCalculation, internalCode)
          : null;
        const grossSixMonthSales = normalSummary
          ? Number(normalSummary.totalShipment || 0)
          : Number(actualByProduct.get(internalCode) || 0);
        const plannedShipmentExcluded = normalSummary
          ? Number(normalSummary.plannedShipment || 0)
          : 0;
        const sixMonthSales = normalSummary
          ? Math.max(0, Number(normalSummary.normalShipment || 0))
          : Math.max(0, grossSixMonthSales);
        const monthlyAverage = Math.max(0, Math.ceil(sixMonthSales / 6));
        const currentStock = getLowShipmentStockNumber(product.stock);
        const noSales = monthlyAverage <= 0;
        const stockMonths = noSales ? null : currentStock / monthlyAverage;
        const isTarget = currentStock > 0 && (noSales || stockMonths >= LOW_SHIPMENT_THRESHOLD_MONTHS);
        if (!isTarget) return null;

        return {
          internalCode: internalCode,
          productCode: product.productCode || "",
          productName: product.productName || "",
          currentStock: currentStock,
          grossSixMonthSales: grossSixMonthSales,
          plannedShipmentExcluded: plannedShipmentExcluded,
          sixMonthSales: sixMonthSales,
          monthlyAverage: monthlyAverage,
          stockMonths: stockMonths,
          noSales: noSales,
          location: product.location || "",
          judgement: noSales ? "販売実績なし" : "2年以上分"
        };
      })
      .filter(Boolean)
      .sort(function (a, b) {
        if (a.noSales !== b.noSales) return a.noSales ? -1 : 1;
        if (!a.noSales && !b.noSales && b.stockMonths !== a.stockMonths) {
          return b.stockMonths - a.stockMonths;
        }
        if (b.currentStock !== a.currentStock) return b.currentStock - a.currentStock;
        return a.internalCode.localeCompare(b.internalCode, "ja", { numeric: true });
      });

    lowShipmentContext = {
      ...context,
      coverage: coverage,
      activeProductCount: activeProducts.length,
      noSalesCount: lowShipmentRows.filter(function (row) { return row.noSales; }).length,
      overTwoYearsCount: lowShipmentRows.filter(function (row) { return !row.noSales; }).length
    };

    lowShipmentCurrentPage = 1;
    renderLowShipmentSummary();
    renderLowShipmentCoverageWarning();
    renderLowShipmentTable();
  } catch (error) {
    console.error("出荷低迷商品計算エラー", error);
    if (summary) summary.textContent = "出荷低迷商品を計算できませんでした。";
    alert("出荷低迷商品の一覧を計算できませんでした。");
  }
}

function buildLowShipmentDateContext(today) {
  const localToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const currentMonthStart = new Date(localToday.getFullYear(), localToday.getMonth(), 1);
  const actualStart = new Date(localToday.getFullYear(), localToday.getMonth() - 6, 1);
  const actualEnd = new Date(currentMonthStart.getFullYear(), currentMonthStart.getMonth(), 0);
  const actualMonthKeys = [];

  for (let offset = 6; offset >= 1; offset -= 1) {
    const date = new Date(localToday.getFullYear(), localToday.getMonth() - offset, 1);
    actualMonthKeys.push(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`);
  }

  return {
    evaluationDate: formatLowShipmentIso(localToday),
    actualStartDate: formatLowShipmentIso(actualStart),
    actualEndDate: formatLowShipmentIso(actualEnd),
    actualMonthKeys: actualMonthKeys
  };
}

function aggregateLowShipmentActuals(actuals, monthKeys) {
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

function calculateLowShipmentActualCoverage(batches, startDate, endDate) {
  const start = parseLowShipmentLocalDate(startDate);
  const end = parseLowShipmentLocalDate(endDate);
  if (!start || !end) return { coveredDays: 0, totalDays: 0, complete: false };

  const ranges = batches
    .map(function (batch) {
      return {
        start: parseLowShipmentLocalDate(batch.reportStartDate),
        end: parseLowShipmentLocalDate(batch.reportEndDate)
      };
    })
    .filter(function (range) {
      return range.start && range.end && range.end >= range.start;
    });

  let totalDays = 0;
  let coveredDays = 0;

  for (let cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
    totalDays += 1;
    const isCovered = ranges.some(function (range) {
      return cursor >= range.start && cursor <= range.end;
    });
    if (isCovered) coveredDays += 1;
  }

  return {
    coveredDays: coveredDays,
    totalDays: totalDays,
    complete: totalDays > 0 && coveredDays === totalDays
  };
}

function isLowShipmentDiscontinuedProduct(product) {
  const status = String(product && (product.productStatus || product.status || "") || "").trim().toLowerCase();
  return status === "廃盤" || status === "discontinued" || Boolean(product && product.discontinued === true);
}

function getLowShipmentStockNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function renderLowShipmentSummary() {
  const summary = document.querySelector("#low-shipment-summary");
  if (!summary || !lowShipmentContext) return;

  summary.innerHTML = `
    <strong>判定日：</strong>${escapeLowShipmentHtml(formatLowShipmentDisplayDate(lowShipmentContext.evaluationDate))}<br>
    <strong>平均通常出荷数：</strong>${escapeLowShipmentHtml(formatLowShipmentDisplayDate(lowShipmentContext.actualStartDate))} ～ ${escapeLowShipmentHtml(formatLowShipmentDisplayDate(lowShipmentContext.actualEndDate))} の6か月平均（販売予定分を除外・小数切り上げ）<br>
    <strong>判定基準：</strong>現在庫が月平均販売数の24か月分以上<br>
    <strong>出荷低迷：</strong>${lowShipmentRows.length.toLocaleString("ja-JP")}商品
    （2年以上分 ${lowShipmentContext.overTwoYearsCount.toLocaleString("ja-JP")}商品 / 販売実績なし ${lowShipmentContext.noSalesCount.toLocaleString("ja-JP")}商品）
  `;
}

function renderLowShipmentCoverageWarning() {
  const box = document.querySelector("#low-shipment-coverage");
  if (!box || !lowShipmentContext) return;

  const coverage = lowShipmentContext.coverage;
  if (coverage.complete) {
    box.className = "low-shipment-coverage low-shipment-coverage-ok";
    box.textContent = `販売実績CSV：対象6か月の${coverage.totalDays}日分を取込済みです。`;
  } else {
    box.className = "low-shipment-coverage low-shipment-coverage-warning";
    box.textContent = `注意：販売実績CSVは対象6か月のうち ${coverage.coveredDays} / ${coverage.totalDays}日分を確認できています。未取込の日があると、在庫月数が実際より長く表示される場合があります。`;
  }
}

function getFilteredLowShipmentRows() {
  const searchInput = document.querySelector("#low-shipment-search");
  const filterSelect = document.querySelector("#low-shipment-filter");
  const term = String(searchInput ? searchInput.value : "").trim().toLowerCase();
  const filter = String(filterSelect ? filterSelect.value : "all");

  return lowShipmentRows.filter(function (row) {
    if (filter === "no-sales" && !row.noSales) return false;
    if (filter === "over-24" && row.noSales) return false;

    if (!term) return true;
    return [row.internalCode, row.productCode, row.productName, row.location, row.judgement]
      .some(function (value) {
        return String(value || "").toLowerCase().includes(term);
      });
  });
}

function renderLowShipmentTable() {
  const body = document.querySelector("#low-shipment-table-body");
  const status = document.querySelector("#low-shipment-page-status");
  const prev = document.querySelector("#low-shipment-prev-page");
  const next = document.querySelector("#low-shipment-next-page");
  const count = document.querySelector("#low-shipment-filter-count");
  if (!body) return;

  const filtered = getFilteredLowShipmentRows();
  const pages = Math.max(1, Math.ceil(filtered.length / LOW_SHIPMENT_PAGE_SIZE));
  if (lowShipmentCurrentPage > pages) lowShipmentCurrentPage = pages;

  const start = (lowShipmentCurrentPage - 1) * LOW_SHIPMENT_PAGE_SIZE;
  const rows = filtered.slice(start, start + LOW_SHIPMENT_PAGE_SIZE);
  body.innerHTML = "";

  if (rows.length === 0) {
    const row = document.createElement("tr");
    row.innerHTML = '<td colspan="9">条件に該当する商品はありません。</td>';
    body.appendChild(row);
  } else {
    rows.forEach(function (item) {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${escapeLowShipmentHtml(item.internalCode)}</td>
        <td>${escapeLowShipmentHtml(item.productCode)}</td>
        <td>${escapeLowShipmentHtml(item.productName)}</td>
        <td>${formatLowShipmentQuantity(item.currentStock)}</td>
        <td>${formatLowShipmentQuantity(item.sixMonthSales)}</td>
        <td>${formatLowShipmentQuantity(item.monthlyAverage)}</td>
        <td><strong class="${item.noSales ? "low-shipment-no-sales" : "low-shipment-months"}">${formatLowShipmentStockMonths(item)}</strong></td>
        <td>${escapeLowShipmentHtml(item.location)}</td>
        <td><span class="${item.noSales ? "low-shipment-badge low-shipment-badge-no-sales" : "low-shipment-badge"}">${escapeLowShipmentHtml(item.judgement)}</span></td>
      `;
      body.appendChild(row);
    });
  }

  if (status) status.textContent = `${lowShipmentCurrentPage} / ${pages}ページ`;
  if (prev) prev.disabled = lowShipmentCurrentPage <= 1;
  if (next) next.disabled = lowShipmentCurrentPage >= pages;
  if (count) count.textContent = `表示：${filtered.length.toLocaleString("ja-JP")}商品`;
}

function getLowShipmentTotalPages() {
  return Math.max(1, Math.ceil(getFilteredLowShipmentRows().length / LOW_SHIPMENT_PAGE_SIZE));
}

function scrollLowShipmentTableIntoView() {
  const table = document.querySelector("#low-shipment-list-area");
  if (table) table.scrollIntoView({ behavior: "smooth", block: "start" });
}

function formatLowShipmentStockMonths(item) {
  if (item.noSales) return "販売実績なし";
  if (!Number.isFinite(item.stockMonths)) return "-";
  return `${item.stockMonths.toLocaleString("ja-JP", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}か月`;
}

function formatLowShipmentQuantity(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "0";
  return number.toLocaleString("ja-JP", { maximumFractionDigits: 2 });
}

function formatLowShipmentIso(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function parseLowShipmentLocalDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ""));
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatLowShipmentDisplayDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ""));
  if (!match) return value || "";
  return `${match[1]}/${match[2]}/${match[3]}`;
}

function escapeLowShipmentHtml(value) {
  return String(value === undefined || value === null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function createLowShipmentStyle() {
  if (document.querySelector("#low-shipment-style")) return;
  const style = document.createElement("style");
  style.id = "low-shipment-style";
  style.textContent = `
    #low-shipment { scroll-margin-top: 86px; }
    #low-shipment .low-shipment-card { background: #fff; border: 1px solid #d9e1e8; border-radius: 14px; padding: 18px; margin: 16px 0; }
    #low-shipment .low-shipment-summary { background: #fff8e1; border-left: 5px solid #f9a825; border-radius: 10px; padding: 14px; line-height: 1.8; }
    #low-shipment .low-shipment-coverage { border-radius: 10px; padding: 13px; margin-top: 12px; font-weight: 700; line-height: 1.6; }
    #low-shipment .low-shipment-coverage-ok { background: #e8f5e9; color: #1b5e20; }
    #low-shipment .low-shipment-coverage-warning { background: #fff3e0; color: #bf360c; }
    #low-shipment .low-shipment-filter-row { display: flex; gap: 12px; align-items: end; flex-wrap: wrap; margin-bottom: 12px; }
    #low-shipment .low-shipment-filter-row > div { flex: 1 1 260px; }
    #low-shipment .low-shipment-table-wrap { overflow-x: auto; }
    #low-shipment table { min-width: 1050px; }
    #low-shipment .low-shipment-months { color: #ef6c00; font-size: 17px; white-space: nowrap; }
    #low-shipment .low-shipment-no-sales { color: #c62828; white-space: nowrap; }
    #low-shipment .low-shipment-badge { display: inline-block; background: #ef6c00; color: #fff; padding: 4px 9px; border-radius: 999px; font-weight: 700; white-space: nowrap; }
    #low-shipment .low-shipment-badge-no-sales { background: #c62828; }
    #low-shipment .low-shipment-pager { display: flex; align-items: center; justify-content: center; gap: 12px; margin-top: 14px; }
    #low-shipment button:disabled { background-color: #b0bec5 !important; cursor: not-allowed; }
    @media (max-width: 700px) {
      #low-shipment .low-shipment-card { padding: 13px; }
      #low-shipment .low-shipment-filter-row { display: grid; grid-template-columns: 1fr; }
    }
  `;
  document.head.appendChild(style);
}
