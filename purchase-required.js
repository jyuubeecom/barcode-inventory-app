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
  const statusFilter = document.querySelector("#purchase-required-status-filter");
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
  if (statusFilter) {
    statusFilter.addEventListener("change", function () {
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
      : aggregatePurchaseActuals(actuals, context.actualMonthKeys);
    const planByProduct = aggregatePurchasePlans(plans, context.forecastStartDate, context.forecastEndDate);
    const coverage = calculatePurchaseActualCoverage(batches, context.actualStartDate, context.actualEndDate);

    purchaseRequiredRows = products
      .filter(function (product) { return !isPurchaseDiscontinuedProduct(product); })
      .map(function (product) {
        const internalCode = String(product.internalCode || "").trim();
        const normalSummary = normalCalculation
          ? window.normalShipmentCalculator.getProductSummary(normalCalculation, internalCode)
          : null;
        const grossSixMonthSales = normalSummary
          ? Number(normalSummary.totalShipment || 0)
          : Number(actualByProduct.get(internalCode) || 0);
        const excludedCustomerSales = normalSummary
          ? Number(normalSummary.excludedCustomerShipment || 0)
          : 0;
        const sixMonthSales = normalSummary
          ? Math.max(0, Number(normalSummary.averageTargetShipment || 0))
          : Math.max(0, grossSixMonthSales);
        const monthlyAverage = Math.max(0, Math.ceil(sixMonthSales / 6));
        const threeMonthBase = monthlyAverage * 3;
        const plannedQuantity = planByProduct.get(internalCode) || 0;
        const requiredStockRaw = threeMonthBase + plannedQuantity;
        const requiredStock = Math.ceil(requiredStockRaw);
        const currentStock = getPurchaseStockNumber(product.stock);
        const orderRemaining = getPurchaseOrderRemaining(product);
        const currentShortage = Math.max(0, requiredStock - currentStock);
        const shortage = Math.max(
          0,
          requiredStock -
            currentStock -
            orderRemaining
        );
        const judgment =
          shortage > 0
            ? "required"
            : "ordered";

        return {
          internalCode: internalCode,
          productCode: product.productCode || "",
          productName: product.productName || "",
          currentStock: currentStock,
          orderRemaining: orderRemaining,
          stockWithOrderRemaining:
            currentStock +
            orderRemaining,
          currentShortage: currentShortage,
          grossSixMonthSales: grossSixMonthSales,
          excludedCustomerSales: excludedCustomerSales,
          sixMonthSales: sixMonthSales,
          monthlyAverage: monthlyAverage,
          threeMonthBase: threeMonthBase,
          plannedQuantity: plannedQuantity,
          requiredStock: requiredStock,
          shortage: shortage,
          judgment: judgment,
          location: product.location || "",
          isBackorder: isPurchaseBackorderProduct(product)
        };
      })
      .filter(function (row) {
        return row.currentShortage > 0;
      })
      .sort(function (a, b) {
        if (a.judgment !== b.judgment) {
          return a.judgment === "required"
            ? -1
            : 1;
        }
        if (a.isBackorder !== b.isBackorder) return a.isBackorder ? -1 : 1;
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
    if (
      window.normalShipmentCalculator &&
      typeof window.normalShipmentCalculator.isAverageExcludedCustomer === "function" &&
      window.normalShipmentCalculator.isAverageExcludedCustomer(record.customerName)
    ) return;
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

function isPurchaseBackorderProduct(product) {
  const savedStatus = String(
    product && (
      product.backorderStatus ||
      product.inventoryStatus ||
      ""
    )
  ).normalize("NFKC").trim().toLowerCase();

  return (
    savedStatus === "注残" ||
    savedStatus === "backorder" ||
    savedStatus === "backordered" ||
    Boolean(product && product.backorder === true)
  );
}

function isPurchaseDiscontinuedProduct(product) {
  const status = String(
    product &&
      (
        product.productStatus ||
        product.status ||
        ""
      ) ||
      ""
  )
    .normalize("NFKC")
    .trim()
    .toLowerCase();

  return (
    status === "廃盤予定" ||
    status === "廃盤" ||
    status === "専用商品" ||
    status === "専用" ||
    status === "discontinued" ||
    status === "inactive" ||
    status === "dedicated" ||
    status === "exclusive" ||
    Boolean(
      product &&
        (
          product.discontinued === true ||
          product.dedicated === true
        )
    )
  );
}

function getPurchaseStockNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function getPurchaseOrderRemaining(product) {
  const number = Number(
    product &&
      product.orderRemaining
  );

  if (
    !Number.isInteger(number) ||
    number < 0
  ) {
    return 0;
  }

  return number;
}

function renderPurchaseRequiredSummary() {
  const summary = document.querySelector("#purchase-required-summary");
  if (!summary || !purchaseRequiredContext) return;
  const requiredRows =
    purchaseRequiredRows.filter(
      function (row) {
        return row.judgment === "required";
      }
    );

  const orderedRows =
    purchaseRequiredRows.filter(
      function (row) {
        return row.judgment === "ordered";
      }
    );

  const totalShortage =
    requiredRows.reduce(
      function (sum, row) {
        return sum + row.shortage;
      },
      0
    );

  const totalOrderRemaining =
    purchaseRequiredRows.reduce(
      function (sum, row) {
        return sum + row.orderRemaining;
      },
      0
    );

  const backorderCount = purchaseRequiredRows.filter(function (row) { return row.isBackorder; }).length;
  summary.innerHTML = `
    <strong>判定日：</strong>${escapePurchaseHtml(formatPurchaseDisplayDate(purchaseRequiredContext.evaluationDate))}<br>
    <strong>月平均販売数：</strong>${escapePurchaseHtml(formatPurchaseDisplayDate(purchaseRequiredContext.actualStartDate))} ～ ${escapePurchaseHtml(formatPurchaseDisplayDate(purchaseRequiredContext.actualEndDate))} の販売実績から「株式会社 後藤」「清水産業 株式会社」を除外して6か月平均<br>
    <strong>販売予定：</strong>${escapePurchaseHtml(formatPurchaseDisplayDate(purchaseRequiredContext.forecastStartDate))} ～ ${escapePurchaseHtml(formatPurchaseDisplayDate(purchaseRequiredContext.forecastEndDate))}<br>
    <strong>発注必要：</strong>${requiredRows.length.toLocaleString("ja-JP")}商品 /
    <strong>発注済み：</strong>${orderedRows.length.toLocaleString("ja-JP")}商品 /
    <strong>追加発注必要数合計：</strong>${totalShortage.toLocaleString("ja-JP")}個<br>
    <strong>表示商品の発注残数合計：</strong>${totalOrderRemaining.toLocaleString("ja-JP")}個 /
    <strong>注残：</strong>${backorderCount.toLocaleString("ja-JP")}商品
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
  const statusFilter =
    document.querySelector(
      "#purchase-required-status-filter"
    );

  const term =
    String(
      input
        ? input.value
        : ""
    )
      .normalize("NFKC")
      .trim()
      .toLowerCase();

  const judgment =
    String(
      statusFilter
        ? statusFilter.value
        : "all"
    );

  return purchaseRequiredRows.filter(
    function (row) {
      if (
        judgment !== "all" &&
        row.judgment !== judgment
      ) {
        return false;
      }

      if (!term) {
        return true;
      }

      return [
        row.internalCode,
        row.productCode,
        row.productName,
        row.location
      ].some(function (value) {
        return String(value || "")
          .normalize("NFKC")
          .toLowerCase()
          .includes(term);
      });
    }
  );
}

function renderPurchaseRequiredTable() {
  const list = document.querySelector(
    "#purchase-required-card-list"
  );
  const status = document.querySelector(
    "#purchase-required-page-status"
  );
  const prev = document.querySelector(
    "#purchase-required-prev-page"
  );
  const next = document.querySelector(
    "#purchase-required-next-page"
  );
  const count = document.querySelector(
    "#purchase-required-filter-count"
  );

  if (!list) return;

  const filtered =
    getFilteredPurchaseRequiredRows();

  const pages = Math.max(
    1,
    Math.ceil(
      filtered.length /
        PURCHASE_REQUIRED_PAGE_SIZE
    )
  );

  if (
    purchaseRequiredCurrentPage >
    pages
  ) {
    purchaseRequiredCurrentPage =
      pages;
  }

  const start =
    (
      purchaseRequiredCurrentPage -
      1
    ) *
    PURCHASE_REQUIRED_PAGE_SIZE;

  const rows = filtered.slice(
    start,
    start +
      PURCHASE_REQUIRED_PAGE_SIZE
  );

  list.innerHTML = "";

  if (rows.length === 0) {
    const empty =
      document.createElement("div");

    empty.className =
      "purchase-required-empty";

    empty.textContent =
      "条件に該当する商品はありません。";

    list.appendChild(empty);
  } else {
    rows.forEach(function (item) {
      const card =
        document.createElement("article");

      card.className =
        "purchase-required-item-card";

      if (
        item.judgment === "ordered"
      ) {
        card.classList.add(
          "purchase-required-item-ordered"
        );
      } else {
        card.classList.add(
          "purchase-required-item-required"
        );
      }

      if (item.isBackorder) {
        card.classList.add(
          "purchase-required-item-backorder"
        );
      }

      const judgmentBadge =
        item.judgment === "ordered"
          ? '<span class="purchase-required-badge purchase-required-badge-ordered">発注済み</span>'
          : '<span class="purchase-required-badge">発注必要</span>';

      const backorderBadge =
        item.isBackorder
          ? '<span class="purchase-required-backorder-badge">注残</span>'
          : "";

      const shortageClass =
        item.shortage > 0
          ? "purchase-required-number-danger"
          : "purchase-required-number-ok";

      card.innerHTML = `
        <div class="purchase-required-item-head">
          <div class="purchase-required-item-title-area">
            <div class="purchase-required-item-badges">
              ${judgmentBadge}
              ${backorderBadge}
            </div>

            <strong class="purchase-required-item-name">
              ${escapePurchaseHtml(item.productName)}
            </strong>

            <div class="purchase-required-item-codes">
              <span>
                社内コード：
                <strong>${escapePurchaseHtml(item.internalCode)}</strong>
              </span>

              <span>
                商品コード：
                <strong>${escapePurchaseHtml(item.productCode || "未登録")}</strong>
              </span>
            </div>
          </div>
        </div>

        <div class="purchase-required-metrics">
          <div class="purchase-required-metric purchase-required-metric-important">
            <span>発注必要数</span>
            <strong class="${shortageClass}">
              ${item.shortage.toLocaleString("ja-JP")}個
            </strong>
          </div>

          <div class="purchase-required-metric">
            <span>現在庫</span>
            <strong>
              ${item.currentStock.toLocaleString("ja-JP")}個
            </strong>
          </div>

          <div class="purchase-required-metric">
            <span>発注残数</span>
            <strong>
              ${item.orderRemaining.toLocaleString("ja-JP")}個
            </strong>
          </div>

          <div class="purchase-required-metric">
            <span>現在庫＋発注残</span>
            <strong>
              ${item.stockWithOrderRemaining.toLocaleString("ja-JP")}個
            </strong>
          </div>

          <div class="purchase-required-metric">
            <span>月平均販売数</span>
            <strong>
              ${formatPurchaseWholeNumber(item.monthlyAverage)}個
            </strong>
          </div>

          <div class="purchase-required-metric">
            <span>月平均×3</span>
            <strong>
              ${formatPurchaseWholeNumber(item.threeMonthBase)}個
            </strong>
          </div>

          <div class="purchase-required-metric">
            <span>今後3か月販売予定</span>
            <strong>
              ${formatPurchaseQuantity(item.plannedQuantity)}個
            </strong>
          </div>

          <div class="purchase-required-metric">
            <span>必要在庫数</span>
            <strong>
              ${item.requiredStock.toLocaleString("ja-JP")}個
            </strong>
          </div>
        </div>

        <div class="purchase-required-item-sub">
          <span>
            6か月計算対象：
            <strong>${formatPurchaseQuantity(item.sixMonthSales)}個</strong>
          </span>

          <span>
            総出荷：
            <strong>${formatPurchaseQuantity(item.grossSixMonthSales)}個</strong>
            / 後藤・清水産業除外：
            <strong>${formatPurchaseQuantity(item.excludedCustomerSales)}個</strong>
          </span>

          <span>
            保管場所：
            <strong>${escapePurchaseHtml(item.location || "未設定")}</strong>
          </span>
        </div>
      `;

      list.appendChild(card);
    });
  }

  if (status) {
    status.textContent =
      `${purchaseRequiredCurrentPage} / ${pages}ページ`;
  }

  if (prev) {
    prev.disabled =
      purchaseRequiredCurrentPage <= 1;
  }

  if (next) {
    next.disabled =
      purchaseRequiredCurrentPage >= pages;
  }

  if (count) {
    count.textContent =
      `表示：${filtered.length.toLocaleString("ja-JP")}商品`;
  }
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

function formatPurchaseWholeNumber(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "0";
  return Math.ceil(number).toLocaleString("ja-JP");
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
    #purchase-required .purchase-required-card-list { display: grid; grid-template-columns: 1fr; gap: 12px; }
    #purchase-required .purchase-required-empty { padding: 22px 14px; border: 1px dashed #b0bec5; border-radius: 12px; background: #fafafa; color: #546e7a; font-weight: 700; text-align: center; }
    #purchase-required .purchase-required-item-card { border: 2px solid #d7e0e8; border-radius: 14px; background: #fff; padding: 14px; box-shadow: 0 2px 7px rgba(0, 0, 0, 0.05); }
    #purchase-required .purchase-required-item-required { border-left: 6px solid #c62828; }
    #purchase-required .purchase-required-item-ordered { border-left: 6px solid #2e7d32; background: #f5fbf5; }
    #purchase-required .purchase-required-item-backorder { box-shadow: inset 0 0 0 2px #f6c343; }
    #purchase-required .purchase-required-item-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
    #purchase-required .purchase-required-item-title-area { min-width: 0; width: 100%; }
    #purchase-required .purchase-required-item-badges { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 7px; }
    #purchase-required .purchase-required-item-name { display: block; font-size: 18px; line-height: 1.45; color: #263238; margin-bottom: 7px; }
    #purchase-required .purchase-required-item-codes { display: flex; gap: 16px; flex-wrap: wrap; color: #546e7a; font-size: 14px; }
    #purchase-required .purchase-required-metrics { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
    #purchase-required .purchase-required-metric { min-width: 0; padding: 10px 11px; border-radius: 10px; background: #f4f7f9; border: 1px solid #dfe6eb; }
    #purchase-required .purchase-required-metric-important { background: #fff5f5; border-color: #ef9a9a; }
    #purchase-required .purchase-required-item-ordered .purchase-required-metric-important { background: #edf7ee; border-color: #a5d6a7; }
    #purchase-required .purchase-required-metric span { display: block; color: #607d8b; font-size: 12px; font-weight: 700; margin-bottom: 4px; }
    #purchase-required .purchase-required-metric strong { display: block; color: #263238; font-size: 17px; line-height: 1.2; overflow-wrap: anywhere; }
    #purchase-required .purchase-required-number-danger { color: #c62828 !important; font-size: 21px !important; }
    #purchase-required .purchase-required-number-ok { color: #2e7d32 !important; font-size: 21px !important; }
    #purchase-required .purchase-required-item-sub { display: flex; gap: 18px; flex-wrap: wrap; margin-top: 10px; padding-top: 9px; border-top: 1px solid #e0e6ea; color: #607d8b; font-size: 13px; }
    #purchase-required .purchase-required-badge { display: inline-block; background: #c62828; color: #fff; padding: 4px 10px; border-radius: 999px; font-weight: 800; white-space: nowrap; }
    #purchase-required .purchase-required-badge-ordered { background: #2e7d32; }
    #purchase-required .purchase-required-backorder-badge { display: inline-block; background: #f6c343; color: #5c3a00; padding: 4px 9px; border-radius: 999px; font-weight: 800; white-space: nowrap; border: 1px solid #d89b00; }
    #purchase-required .purchase-required-pager { display: flex; align-items: center; justify-content: center; gap: 12px; margin-top: 14px; }
    #purchase-required button:disabled { background-color: #b0bec5 !important; cursor: not-allowed; }
    @media (max-width: 900px) {
      #purchase-required .purchase-required-metrics { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }

    @media (max-width: 700px) {
      #purchase-required .purchase-required-card { padding: 13px; }
      #purchase-required .purchase-required-filter { display: grid; grid-template-columns: 1fr; }
      #purchase-required .purchase-required-item-card { padding: 12px; }
      #purchase-required .purchase-required-item-name { font-size: 17px; }
      #purchase-required .purchase-required-item-codes { display: grid; gap: 4px; }
      #purchase-required .purchase-required-metric { padding: 9px; }
      #purchase-required .purchase-required-metric strong { font-size: 16px; }
      #purchase-required .purchase-required-number-danger,
      #purchase-required .purchase-required-number-ok { font-size: 19px !important; }
    }
  `;
  document.head.appendChild(style);
}

/* =========================================================
   v140 ホーム警告パネル用
   発注必要商品の読み取り専用API
   ========================================================= */
window.purchaseRequiredApp =
  window.purchaseRequiredApp || {};

window.purchaseRequiredApp.getHomeAlertData =
  async function () {
    await refreshPurchaseRequiredData();

    const requiredRows =
      purchaseRequiredRows
        .filter(
          function (row) {
            return (
              row &&
              row.judgment ===
                "required" &&
              Number(
                row.shortage || 0
              ) > 0
            );
          }
        )
        .map(
          function (row) {
            return {
              internalCode:
                row.internalCode || "",
              productCode:
                row.productCode || "",
              productName:
                row.productName || "",
              shortage:
                Number(
                  row.shortage || 0
                ),
              currentStock:
                Number(
                  row.currentStock || 0
                ),
              orderRemaining:
                Number(
                  row.orderRemaining || 0
                ),
              requiredStock:
                Number(
                  row.requiredStock || 0
                )
            };
          }
        );

    const totalShortage =
      requiredRows.reduce(
        function (sum, row) {
          return (
            sum +
            Number(
              row.shortage || 0
            )
          );
        },
        0
      );

    return {
      count:
        requiredRows.length,
      totalShortage:
        totalShortage,
      rows:
        requiredRows
    };
  };

window.purchaseRequiredApp.open =
  function () {
    const button =
      document.querySelector(
        "#show-purchase-required-button"
      );

    if (button) {
      button.click();
    }
  };

