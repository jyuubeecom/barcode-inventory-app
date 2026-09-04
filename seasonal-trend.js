"use strict";

const SEASONAL_TREND_PAGE_SIZE = 20;
const SEASONAL_TREND_INCREASE_RATIO = 1.5;
const SEASONAL_TREND_DECREASE_RATIO = 0.7;
const SEASONAL_TREND_SEASONS = Object.freeze([
  { key: "spring", label: "春", icon: "🌸", months: [3, 4, 5] },
  { key: "summer", label: "夏", icon: "☀️", months: [6, 7, 8] },
  { key: "autumn", label: "秋", icon: "🍁", months: [9, 10, 11] },
  { key: "winter", label: "冬", icon: "❄️", months: [12, 1, 2] }
]);

let seasonalTrendRows = [];
let seasonalTrendCurrentPage = 1;
let seasonalTrendContext = null;

// 季節変動の計算ルールを、船積みなど他機能からも同じ条件で利用できるように公開する。
window.seasonalTrendCalculator = Object.freeze({
  analyze: function (products, actuals, anchorDate, monthCount) {
    const count = Math.max(12, Math.floor(Number(monthCount) || 24));
    const context = buildSeasonalTrendDateContext(anchorDate, count);
    const analysis = buildSeasonalTrendRows(products, actuals, context);
    return {
      ...analysis,
      context: context
    };
  },
  getSeasonForMonth: function (monthNumber) {
    const month = Number(monthNumber);
    return SEASONAL_TREND_SEASONS.find(function (season) {
      return season.months.includes(month);
    }) || null;
  },
  increaseRatio: SEASONAL_TREND_INCREASE_RATIO,
  decreaseRatio: SEASONAL_TREND_DECREASE_RATIO
});

window.addEventListener("DOMContentLoaded", initializeSeasonalTrendFeature);

function initializeSeasonalTrendFeature() {
  const showButton = document.querySelector("#show-seasonal-trend-button");
  const backButton = document.querySelector("#back-home-from-seasonal-trend");
  const refreshButton = document.querySelector("#refresh-seasonal-trend-button");
  const searchInput = document.querySelector("#seasonal-trend-search");
  const trendFilter = document.querySelector("#seasonal-trend-type-filter");
  const seasonFilter = document.querySelector("#seasonal-trend-season-filter");
  const periodSelect = document.querySelector("#seasonal-trend-period");
  const minAverageInput = document.querySelector("#seasonal-trend-min-average");
  const sortKeySelect = document.querySelector("#seasonal-trend-sort-key");
  const sortOrderSelect = document.querySelector("#seasonal-trend-sort-order");
  const printButton = document.querySelector("#print-seasonal-trend-button");
  const prevButton = document.querySelector("#seasonal-trend-prev-page");
  const nextButton = document.querySelector("#seasonal-trend-next-page");

  if (!showButton) return;

  createSeasonalTrendStyle();
  showButton.addEventListener("click", openSeasonalTrendScreen);
  if (backButton) backButton.addEventListener("click", closeSeasonalTrendScreen);
  if (refreshButton) refreshButton.addEventListener("click", refreshSeasonalTrendData);

  if (searchInput) {
    searchInput.addEventListener("input", function () {
      seasonalTrendCurrentPage = 1;
      renderSeasonalTrendTable();
    });
  }

  [trendFilter, seasonFilter, minAverageInput].forEach(function (element) {
    if (!element) return;
    element.addEventListener(element.tagName === "INPUT" ? "input" : "change", function () {
      seasonalTrendCurrentPage = 1;
      renderSeasonalTrendTable();
    });
  });

  if (sortKeySelect) {
    sortKeySelect.addEventListener("change", function () {
      const key = String(sortKeySelect.value || "strength");
      if (sortOrderSelect) {
        sortOrderSelect.value = ["internalCode", "productCode", "productName", "season"].includes(key)
          ? "asc"
          : "desc";
      }
      seasonalTrendCurrentPage = 1;
      renderSeasonalTrendTable();
    });
  }

  if (sortOrderSelect) {
    sortOrderSelect.addEventListener("change", function () {
      seasonalTrendCurrentPage = 1;
      renderSeasonalTrendTable();
    });
  }

  if (printButton) {
    printButton.addEventListener("click", printSeasonalTrendList);
  }

  if (periodSelect) {
    periodSelect.addEventListener("change", function () {
      seasonalTrendCurrentPage = 1;
      refreshSeasonalTrendData();
    });
  }

  if (prevButton) {
    prevButton.addEventListener("click", function () {
      if (seasonalTrendCurrentPage <= 1) return;
      seasonalTrendCurrentPage -= 1;
      renderSeasonalTrendTable();
      scrollSeasonalTrendTableIntoView();
    });
  }

  if (nextButton) {
    nextButton.addEventListener("click", function () {
      const pages = getSeasonalTrendTotalPages();
      if (seasonalTrendCurrentPage >= pages) return;
      seasonalTrendCurrentPage += 1;
      renderSeasonalTrendTable();
      scrollSeasonalTrendTableIntoView();
    });
  }
}

async function openSeasonalTrendScreen() {
  document.querySelectorAll("main > section").forEach(function (section) {
    section.hidden = true;
  });

  const screen = document.querySelector("#seasonal-trend");
  if (!screen) return;
  screen.hidden = false;
  seasonalTrendCurrentPage = 1;
  await refreshSeasonalTrendData();
  screen.scrollIntoView({ behavior: "smooth", block: "start" });
}

function closeSeasonalTrendScreen() {
  const screen = document.querySelector("#seasonal-trend");
  if (screen) screen.hidden = true;

  if (window.inventoryApp && typeof window.inventoryApp.showScreen === "function") {
    window.inventoryApp.showScreen("home");
  } else {
    const home = document.querySelector("#home");
    if (home) home.hidden = false;
  }

  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function refreshSeasonalTrendData() {
  const summary = document.querySelector("#seasonal-trend-summary");
  if (summary) summary.textContent = "季節変動を分析しています...";

  try {
    const periodSelect = document.querySelector("#seasonal-trend-period");
    const monthCount = Math.max(12, Math.floor(Number(periodSelect && periodSelect.value) || 24));
    const result = await Promise.all([
      getAllProducts(),
      getAllSalesActuals()
    ]);

    const products = Array.isArray(result[0]) ? result[0] : [];
    const actuals = Array.isArray(result[1]) ? result[1] : [];
    const context = buildSeasonalTrendDateContext(new Date(), monthCount);
    const analysis = buildSeasonalTrendRows(products, actuals, context);

    seasonalTrendRows = analysis.rows;
    seasonalTrendContext = {
      ...context,
      availableMonthKeys: analysis.availableMonthKeys,
      includedActualCount: analysis.includedActualCount,
      excludedActualCount: analysis.excludedActualCount
    };
    seasonalTrendCurrentPage = 1;
    renderSeasonalTrendSummary();
    renderSeasonalTrendTable();
  } catch (error) {
    console.error("季節変動分析エラー", error);
    seasonalTrendRows = [];
    seasonalTrendContext = null;
    if (summary) summary.textContent = "季節変動を分析できませんでした。";

    if (typeof showAppDialog === "function") {
      await showAppDialog({
        type: "danger",
        icon: "⚠️",
        title: "季節変動を分析できませんでした",
        message: "販売実績データを読み込めませんでした。画面を更新して、もう一度お試しください。",
        confirmText: "確認して閉じる"
      });
    }
  }
}

function buildSeasonalTrendDateContext(today, monthCount) {
  const base = today instanceof Date && !Number.isNaN(today.getTime()) ? today : new Date();
  const count = Math.max(1, Math.floor(Number(monthCount) || 24));
  const endDate = new Date(base.getFullYear(), base.getMonth(), 0);
  const startDate = new Date(endDate.getFullYear(), endDate.getMonth() - count + 1, 1);

  return {
    monthCount: count,
    startDate: formatSeasonalTrendIsoDate(startDate),
    endDate: formatSeasonalTrendIsoDate(endDate)
  };
}

function buildSeasonalTrendRows(products, actuals, context) {
  const start = String(context && context.startDate || "");
  const end = String(context && context.endDate || "");
  const productMap = new Map();
  const monthlyByProduct = new Map();
  const availableMonths = new Set();
  let includedActualCount = 0;
  let excludedActualCount = 0;

  (Array.isArray(products) ? products : []).forEach(function (product) {
    const internalCode = String(product && product.internalCode || "").trim();
    if (internalCode) productMap.set(internalCode, product);
  });

  (Array.isArray(actuals) ? actuals : []).forEach(function (record) {
    const internalCode = String(record && record.internalCode || "").trim();
    const saleDate = String(record && record.saleDate || "");
    const quantity = Number(record && record.quantity || 0);

    if (!internalCode || !isSeasonalTrendIsoDate(saleDate) || !Number.isFinite(quantity)) return;
    if (start && saleDate < start) return;
    if (end && saleDate > end) return;

    const monthKey = saleDate.slice(0, 7);
    availableMonths.add(monthKey);

    if (isSeasonalTrendExcludedCustomer(record && record.customerName)) {
      excludedActualCount += 1;
      return;
    }

    includedActualCount += 1;
    if (!monthlyByProduct.has(internalCode)) {
      monthlyByProduct.set(internalCode, new Map());
    }
    const monthMap = monthlyByProduct.get(internalCode);
    monthMap.set(monthKey, (monthMap.get(monthKey) || 0) + quantity);
  });

  const monthKeys = Array.from(availableMonths).sort();
  const rows = [];

  productMap.forEach(function (product, internalCode) {
    if (isSeasonalTrendExcludedProduct(product)) return;
    if (monthKeys.length < 4) return;

    const source = monthlyByProduct.get(internalCode) || new Map();
    const monthlyValues = new Map();
    monthKeys.forEach(function (monthKey) {
      const netQuantity = Number(source.get(monthKey) || 0);
      monthlyValues.set(monthKey, Math.max(0, netQuantity));
    });

    const totalQuantity = monthKeys.reduce(function (sum, monthKey) {
      return sum + Number(monthlyValues.get(monthKey) || 0);
    }, 0);
    if (totalQuantity <= 0) return;

    const candidates = SEASONAL_TREND_SEASONS.map(function (season) {
      return calculateSeasonalTrendCandidate(season, monthKeys, monthlyValues);
    }).filter(Boolean);

    const increases = candidates.filter(function (candidate) {
      return candidate.ratio >= SEASONAL_TREND_INCREASE_RATIO;
    });
    const decreases = candidates.filter(function (candidate) {
      return candidate.normalAverage > 0 && candidate.ratio <= SEASONAL_TREND_DECREASE_RATIO;
    });

    let strongestIncrease = null;
    let strongestDecrease = null;

    if (increases.length > 0) {
      increases.sort(function (a, b) {
        const left = Number.isFinite(a.ratio) ? a.ratio : Number.MAX_SAFE_INTEGER;
        const right = Number.isFinite(b.ratio) ? b.ratio : Number.MAX_SAFE_INTEGER;
        return right - left;
      });
      strongestIncrease = increases[0];
    }

    if (decreases.length > 0) {
      decreases.sort(function (a, b) { return a.ratio - b.ratio; });
      strongestDecrease = decreases[0];
    }

    if (strongestIncrease || strongestDecrease) {
      const increaseStrength = strongestIncrease
        ? (Number.isFinite(strongestIncrease.ratio) ? strongestIncrease.ratio - 1 : 999)
        : -1;
      const decreaseStrength = strongestDecrease
        ? 1 - strongestDecrease.ratio
        : -1;

      if (increaseStrength >= decreaseStrength) {
        rows.push(createSeasonalTrendRow(product, strongestIncrease, "increase"));
      } else {
        rows.push(createSeasonalTrendRow(product, strongestDecrease, "decrease"));
      }
    }
  });

  rows.sort(function (a, b) {
    const leftStrength = getSeasonalTrendStrength(a);
    const rightStrength = getSeasonalTrendStrength(b);
    if (rightStrength !== leftStrength) return rightStrength - leftStrength;
    return String(a.productCode || a.internalCode).localeCompare(
      String(b.productCode || b.internalCode),
      "ja",
      { numeric: true }
    );
  });

  return {
    rows: rows,
    availableMonthKeys: monthKeys,
    includedActualCount: includedActualCount,
    excludedActualCount: excludedActualCount
  };
}

function calculateSeasonalTrendCandidate(season, monthKeys, monthlyValues) {
  const seasonKeys = monthKeys.filter(function (monthKey) {
    return season.months.includes(Number(monthKey.slice(5, 7)));
  });
  const comparisonKeys = monthKeys.filter(function (monthKey) {
    return !season.months.includes(Number(monthKey.slice(5, 7)));
  });

  if (seasonKeys.length < 2 || comparisonKeys.length < 2) return null;

  const seasonTotal = seasonKeys.reduce(function (sum, monthKey) {
    return sum + Number(monthlyValues.get(monthKey) || 0);
  }, 0);
  const comparisonTotal = comparisonKeys.reduce(function (sum, monthKey) {
    return sum + Number(monthlyValues.get(monthKey) || 0);
  }, 0);
  const seasonAverage = seasonTotal / seasonKeys.length;
  const normalAverage = comparisonTotal / comparisonKeys.length;
  let ratio = 1;

  if (normalAverage <= 0) {
    ratio = seasonAverage > 0 ? Number.POSITIVE_INFINITY : 1;
  } else {
    ratio = seasonAverage / normalAverage;
  }

  return {
    seasonKey: season.key,
    seasonLabel: season.label,
    seasonIcon: season.icon,
    seasonAverage: seasonAverage,
    normalAverage: normalAverage,
    ratio: ratio,
    seasonMonthCount: seasonKeys.length,
    comparisonMonthCount: comparisonKeys.length,
    seasonMonthKeys: seasonKeys
  };
}

function createSeasonalTrendRow(product, candidate, trendType) {
  return {
    internalCode: String(product && product.internalCode || ""),
    productCode: String(product && product.productCode || ""),
    productName: String(product && product.productName || ""),
    location: String(product && product.location || ""),
    lifecycleStatus: getSeasonalTrendLifecycleStatus(product),
    trendType: trendType,
    seasonKey: candidate.seasonKey,
    seasonLabel: candidate.seasonLabel,
    seasonIcon: candidate.seasonIcon,
    seasonAverage: candidate.seasonAverage,
    normalAverage: candidate.normalAverage,
    ratio: candidate.ratio,
    seasonMonthCount: candidate.seasonMonthCount,
    comparisonMonthCount: candidate.comparisonMonthCount,
    seasonMonthKeys: candidate.seasonMonthKeys
  };
}

function getSeasonalTrendStrength(row) {
  if (!row) return 0;
  if (row.trendType === "increase") {
    return Number.isFinite(row.ratio) ? Math.max(0, row.ratio - 1) : 999;
  }
  return Math.max(0, 1 - Number(row.ratio || 0));
}

function getFilteredSeasonalTrendRows() {
  const search = normalizeSeasonalTrendText(
    document.querySelector("#seasonal-trend-search")?.value
  );
  const trendType = String(document.querySelector("#seasonal-trend-type-filter")?.value || "all");
  const season = String(document.querySelector("#seasonal-trend-season-filter")?.value || "all");
  const minAverage = Math.max(0, Number(document.querySelector("#seasonal-trend-min-average")?.value || 0));

  const filtered = seasonalTrendRows.filter(function (row) {
    if (trendType !== "all" && row.trendType !== trendType) return false;
    if (season !== "all" && row.seasonKey !== season) return false;
    if (Math.max(row.seasonAverage, row.normalAverage) < minAverage) return false;

    if (!search) return true;
    const haystack = normalizeSeasonalTrendText([
      row.internalCode,
      row.productCode,
      row.productName,
      row.location,
      row.lifecycleStatus,
      row.seasonLabel,
      row.trendType === "increase" ? "増加 増える" : "減少 減る 少なく"
    ].join(" "));
    return haystack.includes(search);
  });

  return sortSeasonalTrendRows(filtered);
}

function sortSeasonalTrendRows(rows) {
  const list = Array.isArray(rows) ? rows.slice() : [];
  const key = String(document.querySelector("#seasonal-trend-sort-key")?.value || "strength");
  const order = String(document.querySelector("#seasonal-trend-sort-order")?.value || "desc");
  const direction = order === "asc" ? 1 : -1;
  const seasonOrder = { spring: 1, summer: 2, autumn: 3, winter: 4 };

  list.sort(function (a, b) {
    let result = 0;

    if (key === "internalCode") {
      result = compareSeasonalTrendText(a.internalCode, b.internalCode);
    } else if (key === "productCode") {
      result = compareSeasonalTrendText(a.productCode, b.productCode);
    } else if (key === "productName") {
      result = compareSeasonalTrendText(a.productName, b.productName);
    } else if (key === "season") {
      result = Number(seasonOrder[a.seasonKey] || 99) - Number(seasonOrder[b.seasonKey] || 99);
    } else if (key === "normalAverage") {
      result = Number(a.normalAverage || 0) - Number(b.normalAverage || 0);
    } else if (key === "seasonAverage") {
      result = Number(a.seasonAverage || 0) - Number(b.seasonAverage || 0);
    } else if (key === "changeRate") {
      result = getSeasonalTrendSignedChange(a) - getSeasonalTrendSignedChange(b);
    } else {
      result = getSeasonalTrendStrength(a) - getSeasonalTrendStrength(b);
    }

    if (result === 0) {
      result = compareSeasonalTrendText(a.productCode || a.internalCode, b.productCode || b.internalCode);
    }
    return result * direction;
  });

  return list;
}

function compareSeasonalTrendText(left, right) {
  return String(left || "").localeCompare(String(right || ""), "ja", {
    numeric: true,
    sensitivity: "base"
  });
}

function getSeasonalTrendSignedChange(row) {
  const ratio = Number(row && row.ratio);
  if (!Number.isFinite(ratio)) return Number.MAX_SAFE_INTEGER;
  return (ratio - 1) * 100;
}

function renderSeasonalTrendSummary() {
  const summary = document.querySelector("#seasonal-trend-summary");
  const coverage = document.querySelector("#seasonal-trend-coverage");
  if (!summary) return;

  const increases = seasonalTrendRows.filter(function (row) { return row.trendType === "increase"; }).length;
  const decreases = seasonalTrendRows.filter(function (row) { return row.trendType === "decrease"; }).length;
  const months = seasonalTrendContext && Array.isArray(seasonalTrendContext.availableMonthKeys)
    ? seasonalTrendContext.availableMonthKeys
    : [];

  summary.innerHTML = `
    <strong>季節変動候補：${seasonalTrendRows.length.toLocaleString("ja-JP")}件</strong>
    <span>増える傾向 ${increases.toLocaleString("ja-JP")}件</span>
    <span>減る傾向 ${decreases.toLocaleString("ja-JP")}件</span>
  `;

  if (!coverage) return;
  if (months.length === 0) {
    coverage.className = "seasonal-trend-coverage seasonal-trend-coverage-warning";
    coverage.textContent = "分析できる販売実績がありません。販売実績CSVを取り込んでから再計算してください。";
    return;
  }

  const first = formatSeasonalTrendMonth(months[0]);
  const last = formatSeasonalTrendMonth(months[months.length - 1]);
  coverage.className = months.length >= 9
    ? "seasonal-trend-coverage seasonal-trend-coverage-ok"
    : "seasonal-trend-coverage seasonal-trend-coverage-warning";
  coverage.innerHTML = `
    分析対象：<strong>${escapeSeasonalTrendHtml(first)} ～ ${escapeSeasonalTrendHtml(last)}</strong> のうち販売実績がある ${months.length}か月。<br>
    「株式会社 後藤」「清水産業 株式会社」は除外し、返品は同月の販売数量から差し引きます。<br>
    廃盤商品・専用商品は一覧から除外し、<strong>廃盤予定の商品は「廃盤予定」バッジを付けて分析対象に含めます。</strong>
    ${months.length < 9 ? " データ月数が少ないため、現在の判定は参考値として確認してください。" : ""}
  `;
}

function renderSeasonalTrendTable() {
  const body = document.querySelector("#seasonal-trend-table-body");
  const count = document.querySelector("#seasonal-trend-filter-count");
  const status = document.querySelector("#seasonal-trend-page-status");
  const prev = document.querySelector("#seasonal-trend-prev-page");
  const next = document.querySelector("#seasonal-trend-next-page");
  if (!body) return;

  const filtered = getFilteredSeasonalTrendRows();
  const pages = Math.max(1, Math.ceil(filtered.length / SEASONAL_TREND_PAGE_SIZE));
  if (seasonalTrendCurrentPage > pages) seasonalTrendCurrentPage = pages;
  if (seasonalTrendCurrentPage < 1) seasonalTrendCurrentPage = 1;

  const start = (seasonalTrendCurrentPage - 1) * SEASONAL_TREND_PAGE_SIZE;
  const pageRows = filtered.slice(start, start + SEASONAL_TREND_PAGE_SIZE);
  body.innerHTML = "";

  if (pageRows.length === 0) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td colspan="9" class="seasonal-trend-empty">
        条件に該当する季節変動商品はありません。<br>
        <small>季節側2か月以上・比較側2か月以上のデータがある商品を判定します。</small>
      </td>
    `;
    body.appendChild(tr);
  } else {
    pageRows.forEach(function (row) {
      const tr = document.createElement("tr");
      tr.className = row.trendType === "increase"
        ? "seasonal-trend-row-increase"
        : "seasonal-trend-row-decrease";
      tr.innerHTML = `
        <td><span class="seasonal-trend-badge ${row.trendType}">${row.trendType === "increase" ? "増加" : "減少"}</span></td>
        <td>${escapeSeasonalTrendHtml(row.internalCode)}</td>
        <td>${escapeSeasonalTrendHtml(row.productCode || "-")}</td>
        <td class="seasonal-trend-product-name">
          <div>${escapeSeasonalTrendHtml(row.productName || "-")}</div>
          ${row.lifecycleStatus === "廃盤予定" ? '<span class="seasonal-trend-lifecycle-badge planned">廃盤予定</span>' : ''}
        </td>
        <td><strong>${escapeSeasonalTrendHtml(`${row.seasonIcon} ${row.seasonLabel}`)}</strong></td>
        <td class="number">${formatSeasonalTrendAverage(row.normalAverage)}個/月</td>
        <td class="number"><strong>${formatSeasonalTrendAverage(row.seasonAverage)}個/月</strong></td>
        <td class="number">${formatSeasonalTrendChange(row)}</td>
        <td>${row.seasonMonthCount}か月 / 比較${row.comparisonMonthCount}か月</td>
      `;
      body.appendChild(tr);
    });
  }

  if (count) count.textContent = `表示：${filtered.length.toLocaleString("ja-JP")}件`;
  if (status) status.textContent = `${seasonalTrendCurrentPage} / ${pages}ページ`;
  if (prev) prev.disabled = seasonalTrendCurrentPage <= 1;
  if (next) next.disabled = seasonalTrendCurrentPage >= pages;
}

async function printSeasonalTrendList() {
  const rows = getFilteredSeasonalTrendRows();
  if (rows.length === 0) {
    if (typeof showAppDialog === "function") {
      await showAppDialog({
        type: "warning",
        icon: "🖨️",
        title: "印刷する商品がありません",
        message: "現在の検索・絞り込み条件に該当する季節変動商品がありません。",
        confirmText: "確認して閉じる"
      });
    } else {
      alert("現在の条件では印刷する商品がありません。");
    }
    return;
  }

  const printWindow = window.open("", "_blank", "width=1300,height=900");
  if (!printWindow) {
    if (typeof showAppDialog === "function") {
      await showAppDialog({
        type: "warning",
        icon: "⚠️",
        title: "印刷画面を開けませんでした",
        message: "ブラウザのポップアップがブロックされている可能性があります。ポップアップを許可して、もう一度お試しください。",
        confirmText: "確認して閉じる"
      });
    }
    return;
  }

  const months = seasonalTrendContext && Array.isArray(seasonalTrendContext.availableMonthKeys)
    ? seasonalTrendContext.availableMonthKeys
    : [];
  const rangeText = months.length > 0
    ? `${formatSeasonalTrendMonth(months[0])} ～ ${formatSeasonalTrendMonth(months[months.length - 1])}`
    : "販売実績なし";
  const trendText = getSeasonalTrendSelectedText("#seasonal-trend-type-filter", "すべて");
  const seasonText = getSeasonalTrendSelectedText("#seasonal-trend-season-filter", "すべて");
  const periodText = getSeasonalTrendSelectedText("#seasonal-trend-period", "-");
  const sortText = getSeasonalTrendSelectedText("#seasonal-trend-sort-key", "変動の大きさ");
  const orderText = getSeasonalTrendSelectedText("#seasonal-trend-sort-order", "-");
  const searchText = String(document.querySelector("#seasonal-trend-search")?.value || "").trim();
  const minAverage = Math.max(0, Number(document.querySelector("#seasonal-trend-min-average")?.value || 0));
  const printedAt = new Date().toLocaleString("ja-JP");

  const rowHtml = rows.map(function (row, index) {
    return `
      <tr class="${row.trendType === "increase" ? "increase" : "decrease"}">
        <td class="center">${index + 1}</td>
        <td class="center"><strong>${row.trendType === "increase" ? "増加" : "減少"}</strong></td>
        <td>${escapeSeasonalTrendHtml(row.internalCode)}</td>
        <td>${escapeSeasonalTrendHtml(row.productCode || "-")}</td>
        <td class="product-name">
          <strong>${escapeSeasonalTrendHtml(row.productName || "-")}</strong>
          ${row.lifecycleStatus === "廃盤予定" ? '<span class="planned">廃盤予定</span>' : ''}
        </td>
        <td class="center">${escapeSeasonalTrendHtml(`${row.seasonIcon} ${row.seasonLabel}`)}</td>
        <td class="number">${formatSeasonalTrendAverage(row.normalAverage)}個/月</td>
        <td class="number"><strong>${formatSeasonalTrendAverage(row.seasonAverage)}個/月</strong></td>
        <td class="number">${escapeSeasonalTrendHtml(getSeasonalTrendChangeText(row))}</td>
        <td class="center">${row.seasonMonthCount}か月 / 比較${row.comparisonMonthCount}か月</td>
      </tr>
    `;
  }).join("");

  printWindow.document.open();
  printWindow.document.write(`<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<title>季節変動商品一覧</title>
<style>
  @page { size: A4 landscape; margin: 8mm; }
  * { box-sizing: border-box; }
  body { font-family: "Yu Gothic", "Meiryo", sans-serif; margin: 0; color: #111; font-size: 10px; }
  h1 { text-align: center; font-size: 20px; margin: 0 0 8px; }
  .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 5px; margin-bottom: 6px; }
  .summary div { border: 1px solid #777; padding: 5px 7px; min-height: 30px; }
  .note { border: 1px solid #777; padding: 5px 7px; margin-bottom: 7px; line-height: 1.45; }
  table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  thead { display: table-header-group; }
  tr { break-inside: avoid; page-break-inside: avoid; }
  th, td { border: 1px solid #666; padding: 4px 4px; vertical-align: middle; overflow-wrap: anywhere; }
  th { background: #e7eef5; font-weight: 700; }
  th:nth-child(1) { width: 4%; }
  th:nth-child(2) { width: 6%; }
  th:nth-child(3) { width: 8%; }
  th:nth-child(4) { width: 10%; }
  th:nth-child(5) { width: 23%; }
  th:nth-child(6) { width: 8%; }
  th:nth-child(7), th:nth-child(8) { width: 10%; }
  th:nth-child(9) { width: 9%; }
  th:nth-child(10) { width: 12%; }
  .center { text-align: center; }
  .number { text-align: right; white-space: nowrap; }
  .product-name { font-size: 10px; }
  .planned { display: inline-block; margin-left: 5px; border: 1px solid #b7791f; border-radius: 10px; padding: 1px 5px; font-size: 8px; }
  .increase td:nth-child(2), .increase td:nth-child(9) { font-weight: 700; }
  .decrease td:nth-child(2), .decrease td:nth-child(9) { font-weight: 700; }
  .footer { text-align: right; margin-top: 4px; font-size: 8px; }
</style>
</head>
<body>
  <h1>季節変動商品一覧</h1>
  <div class="summary">
    <div><strong>印刷件数：</strong>${rows.length.toLocaleString("ja-JP")}商品</div>
    <div><strong>分析対象：</strong>${escapeSeasonalTrendHtml(rangeText)}</div>
    <div><strong>分析期間：</strong>${escapeSeasonalTrendHtml(periodText)}</div>
    <div><strong>印刷日時：</strong>${escapeSeasonalTrendHtml(printedAt)}</div>
  </div>
  <div class="note">
    <strong>現在の条件：</strong>
    検索「${escapeSeasonalTrendHtml(searchText || "指定なし") }」 / 増減「${escapeSeasonalTrendHtml(trendText)}」 / 季節「${escapeSeasonalTrendHtml(seasonText)}」 /
    最低月平均 ${minAverage.toLocaleString("ja-JP")}個 / 並べ替え「${escapeSeasonalTrendHtml(sortText)}・${escapeSeasonalTrendHtml(orderText)}」<br>
    後藤・清水産業の実績は除外。廃盤商品・専用商品は対象外。廃盤予定は分析対象に含めます。
  </div>
  <table>
    <thead>
      <tr>
        <th>No.</th><th>判定</th><th>社内コード</th><th>商品コード</th><th>商品名</th>
        <th>変動時期</th><th>通常月平均</th><th>季節平均</th><th>増減率</th><th>データ月数</th>
      </tr>
    </thead>
    <tbody>${rowHtml}</tbody>
  </table>
  <div class="footer">季節変動商品一覧</div>
  <script>setTimeout(function(){ window.print(); }, 250);<\/script>
</body>
</html>`);
  printWindow.document.close();
}

function getSeasonalTrendSelectedText(selector, fallback) {
  const select = document.querySelector(selector);
  if (!select) return fallback;
  const option = select.options && select.options[select.selectedIndex];
  return String(option && option.textContent || fallback || "").trim();
}

function getSeasonalTrendChangeText(row) {
  if (row && row.trendType === "increase" && !Number.isFinite(row.ratio)) {
    return "通常0 → 増加";
  }
  const rate = (Number(row && row.ratio || 0) - 1) * 100;
  const rounded = Math.round(Math.abs(rate));
  return row && row.trendType === "increase"
    ? `+${rounded.toLocaleString("ja-JP")}%`
    : `-${rounded.toLocaleString("ja-JP")}%`;
}

function getSeasonalTrendTotalPages() {
  return Math.max(1, Math.ceil(getFilteredSeasonalTrendRows().length / SEASONAL_TREND_PAGE_SIZE));
}

function scrollSeasonalTrendTableIntoView() {
  const area = document.querySelector("#seasonal-trend-list-area");
  if (area) area.scrollIntoView({ behavior: "smooth", block: "start" });
}

function isSeasonalTrendExcludedCustomer(value) {
  if (
    window.normalShipmentCalculator &&
    typeof window.normalShipmentCalculator.isAverageExcludedCustomer === "function"
  ) {
    return window.normalShipmentCalculator.isAverageExcludedCustomer(value);
  }

  const normalized = String(value || "")
    .normalize("NFKC")
    .replace(/株式会社|有限会社|合同会社|合資会社|合名会社|㈱|㈲/g, "")
    .replace(/[\s\u3000・･.,，。()（）\[\]［］【】「」『』'"’`]/g, "")
    .trim()
    .toLowerCase();
  return normalized === "後藤" || normalized === "清水産業";
}

function getSeasonalTrendLifecycleStatus(product) {
  if (typeof getProductLifecycleStatus === "function") {
    const status = String(getProductLifecycleStatus(product) || "").normalize("NFKC").trim();
    if (status) return status;
  }

  const status = String(product && product.productStatus || "").normalize("NFKC").trim();
  if (status) return status;
  return Boolean(product && product.discontinued === true) ? "廃盤" : "通常商品";
}

function isSeasonalTrendExcludedProduct(product) {
  const status = getSeasonalTrendLifecycleStatus(product);
  return status === "廃盤" || status === "専用商品";
}

function formatSeasonalTrendChange(row) {
  if (row.trendType === "increase" && !Number.isFinite(row.ratio)) {
    return '<strong class="seasonal-trend-increase-text">通常0 → 増加</strong>';
  }
  const rate = (Number(row.ratio || 0) - 1) * 100;
  const rounded = Math.round(Math.abs(rate));
  if (row.trendType === "increase") {
    return `<strong class="seasonal-trend-increase-text">+${rounded.toLocaleString("ja-JP")}%</strong>`;
  }
  return `<strong class="seasonal-trend-decrease-text">-${rounded.toLocaleString("ja-JP")}%</strong>`;
}

function formatSeasonalTrendAverage(value) {
  const number = Number(value || 0);
  if (!Number.isFinite(number)) return "0";
  return Math.round(number).toLocaleString("ja-JP");
}

function formatSeasonalTrendMonth(monthKey) {
  const match = /^(\d{4})-(\d{2})$/.exec(String(monthKey || ""));
  if (!match) return String(monthKey || "");
  return `${Number(match[1])}年${Number(match[2])}月`;
}

function formatSeasonalTrendIsoDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function isSeasonalTrendIsoDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));
}

function normalizeSeasonalTrendText(value) {
  return String(value === undefined || value === null ? "" : value)
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s\u3000]+/g, "")
    .trim();
}

function escapeSeasonalTrendHtml(value) {
  return String(value === undefined || value === null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function createSeasonalTrendStyle() {
  if (document.querySelector("#seasonal-trend-style")) return;

  const style = document.createElement("style");
  style.id = "seasonal-trend-style";
  style.textContent = `
    #seasonal-trend .seasonal-trend-card {
      background: #fff;
      border: 1px solid #cbd9e5;
      border-radius: 12px;
      padding: 16px;
      margin: 14px 0;
    }
    #seasonal-trend .seasonal-trend-summary {
      display: flex;
      flex-wrap: wrap;
      gap: 10px 24px;
      align-items: center;
      background: #eef7ff;
      border-left: 5px solid #1976d2;
      border-radius: 8px;
      padding: 13px 15px;
      line-height: 1.7;
    }
    #seasonal-trend .seasonal-trend-coverage {
      border-radius: 8px;
      padding: 12px 14px;
      margin-top: 10px;
      line-height: 1.7;
      font-weight: 650;
    }
    #seasonal-trend .seasonal-trend-coverage-ok {
      background: #e8f5e9;
      color: #1b5e20;
    }
    #seasonal-trend .seasonal-trend-coverage-warning {
      background: #fff3e0;
      color: #9a4d00;
    }
    #seasonal-trend .seasonal-trend-rule {
      background: #fff8e1;
      border-left: 5px solid #f9a825;
      border-radius: 8px;
      padding: 12px 14px;
      line-height: 1.8;
      margin-top: 12px;
    }
    #seasonal-trend .seasonal-trend-filter-grid {
      display: grid;
      grid-template-columns: minmax(240px, 1.5fr) minmax(140px, .7fr) minmax(140px, .7fr) minmax(150px, .8fr) minmax(150px, .8fr) auto;
      gap: 10px;
      align-items: end;
    }
    #seasonal-trend .seasonal-trend-filter-grid label {
      display: block;
      font-weight: 700;
      margin-bottom: 6px;
    }
    #seasonal-trend .seasonal-trend-filter-grid input,
    #seasonal-trend .seasonal-trend-filter-grid select {
      width: 100%;
    }
    #seasonal-trend .seasonal-trend-table-wrap {
      overflow-x: auto;
    }
    #seasonal-trend table {
      width: 100%;
      min-width: 980px;
      border-collapse: collapse;
    }
    #seasonal-trend th,
    #seasonal-trend td {
      padding: 10px 9px;
      vertical-align: middle;
      border: 1px solid #cbd9e5;
    }
    #seasonal-trend th {
      background: #0b7285;
      color: #fff;
      white-space: nowrap;
    }
    #seasonal-trend td.number {
      text-align: right;
      white-space: nowrap;
    }
    #seasonal-trend .seasonal-trend-product-name {
      min-width: 190px;
      font-weight: 700;
    }
    #seasonal-trend .seasonal-trend-lifecycle-badge {
      display: inline-block;
      margin-top: 6px;
      border-radius: 999px;
      padding: 3px 8px;
      font-size: 12px;
      font-weight: 800;
      white-space: nowrap;
    }
    #seasonal-trend .seasonal-trend-lifecycle-badge.planned {
      background: #fff3cd;
      border: 1px solid #f0ad4e;
      color: #8a4b00;
    }
    #seasonal-trend .seasonal-trend-row-increase {
      background: #fff8ee;
    }
    #seasonal-trend .seasonal-trend-row-decrease {
      background: #eef7ff;
    }
    #seasonal-trend .seasonal-trend-badge {
      display: inline-block;
      border-radius: 999px;
      padding: 5px 10px;
      font-weight: 800;
      white-space: nowrap;
    }
    #seasonal-trend .seasonal-trend-badge.increase {
      background: #ffe0b2;
      color: #b45309;
    }
    #seasonal-trend .seasonal-trend-badge.decrease {
      background: #dbeafe;
      color: #1d4ed8;
    }
    #seasonal-trend .seasonal-trend-increase-text {
      color: #c2410c;
    }
    #seasonal-trend .seasonal-trend-decrease-text {
      color: #1d4ed8;
    }
    #seasonal-trend .seasonal-trend-empty {
      text-align: center;
      padding: 28px 12px;
      color: #546e7a;
    }
    #seasonal-trend .seasonal-trend-pager {
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 14px;
      margin-top: 14px;
    }
    #seasonal-trend .seasonal-trend-sort-print-row {
      display: grid;
      grid-template-columns: minmax(180px, .8fr) minmax(160px, .7fr) minmax(320px, 1.7fr);
      gap: 10px;
      align-items: end;
      margin: 14px 0 8px;
      padding: 12px;
      background: #f3f8fc;
      border: 1px solid #cbd9e5;
      border-radius: 10px;
    }
    #seasonal-trend .seasonal-trend-sort-print-row label {
      display: block;
      font-weight: 700;
      margin-bottom: 6px;
    }
    #seasonal-trend .seasonal-trend-sort-print-row select {
      width: 100%;
    }
    #seasonal-trend .seasonal-trend-print-box {
      display: flex;
      align-items: end;
      justify-content: flex-end;
      gap: 10px;
    }
    #seasonal-trend .seasonal-trend-print-note {
      flex: 1;
      color: #455a64;
      font-size: 13px;
      line-height: 1.5;
    }
    #seasonal-trend #print-seasonal-trend-button {
      min-width: 180px;
      white-space: nowrap;
      background: #455a64;
    }
    @media (max-width: 900px) {
      #seasonal-trend .seasonal-trend-filter-grid {
        grid-template-columns: 1fr 1fr;
      }
      #seasonal-trend .seasonal-trend-filter-grid > div:first-child {
        grid-column: 1 / -1;
      }
      #seasonal-trend .seasonal-trend-sort-print-row {
        grid-template-columns: 1fr 1fr;
      }
      #seasonal-trend .seasonal-trend-print-box {
        grid-column: 1 / -1;
      }
      #seasonal-trend .seasonal-trend-filter-grid button,
      #seasonal-trend .seasonal-trend-filter-grid strong {
        width: 100%;
      }
    }
    @media (max-width: 600px) {
      #seasonal-trend .seasonal-trend-filter-grid {
        grid-template-columns: 1fr;
      }
      #seasonal-trend .seasonal-trend-filter-grid > div:first-child {
        grid-column: auto;
      }
      #seasonal-trend .seasonal-trend-sort-print-row {
        grid-template-columns: 1fr;
      }
      #seasonal-trend .seasonal-trend-print-box {
        grid-column: auto;
        flex-direction: column;
        align-items: stretch;
      }
      #seasonal-trend #print-seasonal-trend-button {
        width: 100%;
      }
    }
  `;
  document.head.appendChild(style);
}
