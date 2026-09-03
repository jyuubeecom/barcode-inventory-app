"use strict";

/* =========================================================
   v193 自然文検索（月平均短縮コード検索修正）
   ・端末内の商品データだけを使用
   ・社内コード / 商品コード / JAN / 商品名に対応
   ・JANなどが重複した場合は候補を一覧表示
   ========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  initializeNaturalStockSearch
);

function initializeNaturalStockSearch() {
  createNaturalStockSearchStyle();
  createNaturalRelationSearchStyle();
  createNaturalMonthlyAverageStyle();

  const homeRoot =
    document.querySelector(
      "#home-natural-stock-search"
    );

  const homeForm =
    document.querySelector(
      "#home-natural-stock-search-form"
    );

  const homeInput =
    document.querySelector(
      "#home-natural-stock-search-input"
    );

  if (
    homeRoot &&
    homeForm &&
    homeInput
  ) {
    homeForm.addEventListener(
      "submit",
      function (event) {
        event.preventDefault();

        void searchStockByNaturalText(
          homeInput.value,
          homeRoot
        );
      }
    );
  }

  // v132の専用画面も残しておき、将来再利用できるようにします。
  const showButton =
    document.querySelector(
      "#show-natural-stock-search-button"
    );

  const screen =
    document.querySelector(
      "#natural-stock-search-screen"
    );

  const form =
    document.querySelector(
      "#natural-stock-search-form"
    );

  const input =
    document.querySelector(
      "#natural-stock-search-input"
    );

  const backButton =
    document.querySelector(
      "#natural-stock-search-back-button"
    );

  if (
    showButton &&
    screen &&
    form &&
    input &&
    backButton
  ) {
    showButton.addEventListener(
      "click",
      function () {
        openNaturalStockSearchScreen(
          screen,
          input
        );
      }
    );

    backButton.addEventListener(
      "click",
      function () {
        closeNaturalStockSearchScreen(
          screen
        );
      }
    );

    form.addEventListener(
      "submit",
      function (event) {
        event.preventDefault();

        void searchStockByNaturalText(
          input.value,
          screen
        );
      }
    );
  }
}

function openNaturalStockSearchScreen(
  screen,
  input
) {
  if (
    window.inventoryApp &&
    typeof window.inventoryApp
      .showScreen === "function"
  ) {
    window.inventoryApp.showScreen(
      "home"
    );
  }

  const home =
    document.querySelector("#home");

  if (home) {
    home.hidden = true;
  }

  screen.hidden = false;

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });

  window.setTimeout(
    function () {
      input.focus();
    },
    100
  );
}

function closeNaturalStockSearchScreen(
  screen
) {
  screen.hidden = true;

  if (
    window.inventoryApp &&
    typeof window.inventoryApp
      .showScreen === "function"
  ) {
    window.inventoryApp.showScreen(
      "home"
    );
  } else {
    const home =
      document.querySelector("#home");

    if (home) {
      home.hidden = false;
    }
  }

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

async function searchStockByNaturalText(
  rawQuery,
  screen
) {
  const status =
    screen.querySelector(
      "#natural-stock-search-status, #home-natural-stock-search-status"
    );

  const result =
    screen.querySelector(
      "#natural-stock-search-result, #home-natural-stock-search-result"
    );

  if (!status || !result) {
    return;
  }

  status.hidden = false;

  const query =
    String(rawQuery || "").trim();

  result.innerHTML = "";

  if (query === "") {
    status.textContent =
      "質問を入力してください。";
    status.className =
      "natural-stock-search-status natural-stock-search-warning";
    return;
  }

  if (
    isNaturalMonthlyAverageQuery(
      query
    )
  ) {
    await searchNaturalMonthlyAverage(
      query,
      status,
      result
    );
    return;
  }

  if (
    isNaturalSummaryQuery(
      query
    )
  ) {
    await searchNaturalProductSummary(
      query,
      status,
      result
    );
    return;
  }

  if (
    isNaturalShippingQuery(
      query
    )
  ) {
    await searchShippingByNaturalText(
      query,
      status,
      result
    );
    return;
  }

  if (
    isNaturalSalesPlanQuery(
      query
    )
  ) {
    await searchSalesPlanByNaturalText(
      query,
      status,
      result
    );
    return;
  }

  if (
    typeof getAllProducts !==
    "function"
  ) {
    status.textContent =
      "商品データを読み込む準備ができていません。画面を更新して、もう一度お試しください。";
    status.className =
      "natural-stock-search-status natural-stock-search-error";
    return;
  }

  status.textContent =
    "商品を検索しています…";
  status.className =
    "natural-stock-search-status";

  try {
    const products =
      await getAllProducts();

    const productQuery =
      extractNaturalMonthlyAverageProductQuery(
        query
      );

    const matches =
      findNaturalStockMatches(
        products,
        productQuery || query
      );

    if (matches.length === 0) {
      status.textContent =
        "該当する商品が見つかりませんでした。";
      status.className =
        "natural-stock-search-status natural-stock-search-warning";

      renderNaturalStockNoMatch(
        result,
        query
      );
      return;
    }

    if (matches.length === 1) {
      status.textContent =
        "1商品見つかりました。";
      status.className =
        "natural-stock-search-status natural-stock-search-success";

      renderNaturalStockAnswer(
        result,
        matches[0]
      );
      return;
    }

    status.textContent =
      `${matches.length}商品が候補に見つかりました。商品を選んでください。`;
    status.className =
      "natural-stock-search-status natural-stock-search-warning";

    renderNaturalStockCandidates(
      result,
      matches,
      status
    );
  } catch (error) {
    console.error(error);

    status.textContent =
      "商品データを読み込めませんでした。画面を更新して、もう一度お試しください。";
    status.className =
      "natural-stock-search-status natural-stock-search-error";
  }
}

function isNaturalMonthlyAverageQuery(
  rawQuery
) {
  const query =
    normalizeNaturalStockText(
      rawQuery
    );

  return /月平均|月間平均|平均販売数|月平均販売数/.test(
    query
  );
}

function extractNaturalMonthlyAverageProductQuery(
  rawQuery
) {
  return String(rawQuery || "")
    .normalize("NFKC")
    .replace(
      /(月平均販売数|平均販売数|月間平均|月平均)/gi,
      " "
    )
    .replace(
      /(を教えてください|教えてください|を教えて|教えて|を知りたい|知りたい|を確認したい|確認したい|検索して|検索)/gi,
      " "
    )
    .replace(
      /[はがをのにでと？?！!。、「」『』]/g,
      " "
    )
    .replace(
      /[\s\u3000]+/g,
      " "
    )
    .trim();
}

async function searchNaturalMonthlyAverage(
  query,
  status,
  result
) {
  if (
    typeof getAllProducts !==
      "function" ||
    typeof getAllSalesActuals !==
      "function" ||
    typeof getAllSalesPlans !==
      "function"
  ) {
    status.textContent =
      "月平均を計算する準備ができていません。画面を更新して、もう一度お試しください。";
    status.className =
      "natural-stock-search-status natural-stock-search-error";
    return;
  }

  status.textContent =
    "直近6か月の販売実績から月平均を計算しています…";
  status.className =
    "natural-stock-search-status";

  try {
    const data =
      await Promise.all([
        getAllProducts(),
        getAllSalesActuals(),
        getAllSalesPlans()
      ]);

    const products = data[0];
    const actuals = data[1];
    const plans = data[2];

    // 「251BK 月平均」のような入力では、
    // 「月平均」などの質問語を除いた商品検索語だけで商品を探します。
    const productQuery =
      extractNaturalMonthlyAverageProductQuery(
        query
      );

    const matches =
      findNaturalStockMatches(
        products,
        productQuery || query
      );

    if (matches.length === 0) {
      status.textContent =
        "月平均を確認する商品が見つかりませんでした。";
      status.className =
        "natural-stock-search-status natural-stock-search-warning";
      renderNaturalMonthlyAverageNoProduct(
        result,
        query
      );
      return;
    }

    if (matches.length > 1) {
      status.textContent =
        `${matches.length}商品が候補に見つかりました。商品を選んでください。`;
      status.className =
        "natural-stock-search-status natural-stock-search-warning";
      renderNaturalMonthlyAverageCandidates(
        result,
        matches,
        actuals,
        plans,
        status
      );
      return;
    }

    renderNaturalMonthlyAverageAnswer(
      result,
      matches[0],
      actuals,
      plans
    );
    status.textContent =
      "月平均を計算しました。";
    status.className =
      "natural-stock-search-status natural-stock-search-success";
  } catch (error) {
    console.error(
      "月平均検索エラー",
      error
    );
    status.textContent =
      "月平均を計算できませんでした。販売実績CSVの取込状況を確認して、もう一度お試しください。";
    status.className =
      "natural-stock-search-status natural-stock-search-error";
  }
}

function buildNaturalMonthlyPeriodContext(
  today,
  monthCount
) {
  const base =
    today instanceof Date &&
    !Number.isNaN(today.getTime())
      ? today
      : new Date();

  const count =
    Math.max(
      1,
      Math.floor(
        Number(monthCount) || 1
      )
    );

  const monthKeys = [];

  for (
    let offset = count;
    offset >= 1;
    offset -= 1
  ) {
    const date =
      new Date(
        base.getFullYear(),
        base.getMonth() - offset,
        1
      );

    monthKeys.push(
      `${date.getFullYear()}-${String(
        date.getMonth() + 1
      ).padStart(2, "0")}`
    );
  }

  return {
    monthKeys: monthKeys,
    startMonth: monthKeys[0] || "",
    endMonth:
      monthKeys[
        monthKeys.length - 1
      ] || ""
  };
}

function buildNaturalMonthlyAverageContext(
  today
) {
  return buildNaturalMonthlyPeriodContext(
    today,
    6
  );
}

function buildNaturalMonthlySalesDisplayContext(
  today
) {
  return buildNaturalMonthlyPeriodContext(
    today,
    12
  );
}

function calculateNaturalMonthlyAverage(
  product,
  actuals,
  plans,
  today
) {
  const averageContext =
    buildNaturalMonthlyAverageContext(
      today
    );

  const displayContext =
    buildNaturalMonthlySalesDisplayContext(
      today
    );

  const internalCode =
    String(
      product &&
        product.internalCode ||
        ""
    ).trim();

  const displayGrossTotals = new Map(
    displayContext.monthKeys.map(function (key) {
      return [key, 0];
    })
  );
  const displayTargetTotals = new Map(
    displayContext.monthKeys.map(function (key) {
      return [key, 0];
    })
  );
  const displayExcludedTotals = new Map(
    displayContext.monthKeys.map(function (key) {
      return [key, 0];
    })
  );

  (Array.isArray(actuals) ? actuals : []).forEach(function (record) {
    if (String(record && record.internalCode || "").trim() !== internalCode) return;

    const saleDate = String(record && record.saleDate || "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(saleDate)) return;

    const monthKey = saleDate.slice(0, 7);
    if (!displayGrossTotals.has(monthKey)) return;

    const quantity = Number(record && record.quantity || 0);
    if (!Number.isFinite(quantity)) return;

    displayGrossTotals.set(monthKey, (displayGrossTotals.get(monthKey) || 0) + quantity);

    if (isNaturalMonthlyAverageExcludedCustomer(record && record.customerName)) {
      displayExcludedTotals.set(monthKey, (displayExcludedTotals.get(monthKey) || 0) + quantity);
    } else {
      displayTargetTotals.set(monthKey, (displayTargetTotals.get(monthKey) || 0) + quantity);
    }
  });

  const monthlyRows = displayContext.monthKeys.map(function (monthKey) {
    return {
      monthKey: monthKey,
      quantity: displayGrossTotals.get(monthKey) || 0,
      totalShipment: displayGrossTotals.get(monthKey) || 0,
      averageTargetShipment: displayTargetTotals.get(monthKey) || 0,
      excludedCustomerShipment: displayExcludedTotals.get(monthKey) || 0,
      plannedShipment: 0
    };
  });

  const averageMonthKeySet = new Set(averageContext.monthKeys);
  const averageRows = monthlyRows.filter(function (row) {
    return averageMonthKeySet.has(row.monthKey);
  });

  const grossSixMonthTotal = averageRows.reduce(function (sum, row) {
    return sum + Number(row.totalShipment || 0);
  }, 0);

  const excludedQuantity = averageRows.reduce(function (sum, row) {
    return sum + Number(row.excludedCustomerShipment || 0);
  }, 0);

  const sixMonthTotal = averageRows.reduce(function (sum, row) {
    return sum + Number(row.averageTargetShipment || 0);
  }, 0);

  return {
    startMonth: averageContext.startMonth,
    endMonth: averageContext.endMonth,
    displayStartMonth: displayContext.startMonth,
    displayEndMonth: displayContext.endMonth,
    monthlyRows: monthlyRows,
    sixMonthTotal: Math.max(0, sixMonthTotal),
    grossSixMonthTotal: grossSixMonthTotal,
    monthlyAverage: Math.max(0, Math.ceil(Math.max(0, sixMonthTotal) / 6)),
    excludedCount: excludedQuantity !== 0 ? 2 : 0,
    excludedQuantity: excludedQuantity
  };
}

function getNaturalMonthlyLastDate(
  monthKey
) {
  const match =
    /^(\d{4})-(\d{2})$/.exec(
      String(monthKey || "")
    );

  if (!match) {
    return "";
  }

  const lastDay =
    new Date(
      Number(match[1]),
      Number(match[2]),
      0
    ).getDate();

  return `${match[1]}-${match[2]}-${String(lastDay).padStart(2, "0")}`;
}

function normalizeNaturalMonthlyAverageCustomer(
  value
) {
  return String(value || "")
    .normalize("NFKC")
    .replace(
      /[\s\u3000]+/g,
      ""
    )
    .trim();
}

function isNaturalMonthlyAverageExcludedCustomer(
  value
) {
  const normalized =
    normalizeNaturalMonthlyAverageCustomer(
      value
    );

  return (
    normalized ===
      "株式会社後藤" ||
    normalized ===
      "清水産業株式会社"
  );
}

function formatNaturalMonthlyAverageMonth(
  monthKey
) {
  const match =
    /^(\d{4})-(\d{2})$/.exec(
      String(monthKey || "")
    );

  if (!match) {
    return String(
      monthKey || ""
    );
  }

  return `${Number(match[1])}年${Number(match[2])}月`;
}

function renderNaturalMonthlyAverageAnswer(
  container,
  product,
  actuals,
  plans
) {
  container.innerHTML = "";

  const calculation =
    calculateNaturalMonthlyAverage(
      product,
      actuals,
      plans,
      new Date()
    );

  const unit =
    getNaturalStockUnit(
      product
    );

  const card =
    document.createElement(
      "article"
    );

  card.className =
    "natural-monthly-average-card";

  const heading =
    document.createElement("h3");

  heading.textContent =
    product.productName ||
    "商品名未登録";

  const answer =
    document.createElement("p");

  answer.className =
    "natural-monthly-average-answer";

  const displayCode =
    product.productCode ||
    product.internalCode ||
    "この商品";

  answer.textContent =
    `${displayCode}の月平均は${calculation.monthlyAverage.toLocaleString("ja-JP")}${unit}／月です。`;

  const summary =
    document.createElement("div");

  summary.className =
    "natural-monthly-average-summary";

  [
    [
      "社内コード",
      product.internalCode ||
        "未登録"
    ],
    [
      "商品コード",
      product.productCode ||
        "未登録"
    ],
    [
      "月平均",
      `${calculation.monthlyAverage.toLocaleString("ja-JP")}${unit}／月`
    ],
    [
      "6か月計算対象",
      `${calculation.sixMonthTotal.toLocaleString("ja-JP")}${unit}`
    ],
    [
      "6か月総出荷",
      `${Number(calculation.grossSixMonthTotal || 0).toLocaleString("ja-JP")}${unit}`
    ],
    [
      "後藤・清水産業を除外",
      `${Number(calculation.excludedQuantity || 0).toLocaleString("ja-JP")}${unit}`
    ]
  ].forEach(
    function (entry) {
      const box =
        document.createElement("div");
      const label =
        document.createElement("span");
      const value =
        document.createElement("strong");

      label.textContent =
        entry[0];
      value.textContent =
        entry[1];

      box.appendChild(label);
      box.appendChild(value);
      summary.appendChild(box);
    }
  );

  const period =
    document.createElement("p");

  period.className =
    "natural-monthly-average-period";

  period.textContent =
    `対象期間：${formatNaturalMonthlyAverageMonth(calculation.startMonth)} ～ ${formatNaturalMonthlyAverageMonth(calculation.endMonth)}（前月までの直近6か月）`;

  const breakdown =
    document.createElement("div");

  breakdown.className =
    "natural-monthly-average-breakdown";

  const breakdownTitle =
    document.createElement("h4");

  breakdownTitle.textContent =
    "月別販売数（前月までの直近1年）";

  breakdown.appendChild(
    breakdownTitle
  );

  const breakdownPeriod =
    document.createElement("p");

  breakdownPeriod.className =
    "natural-monthly-average-breakdown-period";

  breakdownPeriod.textContent =
    `${formatNaturalMonthlyAverageMonth(calculation.displayStartMonth)} ～ ${formatNaturalMonthlyAverageMonth(calculation.displayEndMonth)}`;

  breakdown.appendChild(
    breakdownPeriod
  );

  calculation.monthlyRows.forEach(
    function (row) {
      const item =
        document.createElement("div");
      const month =
        document.createElement("span");
      const quantity =
        document.createElement("strong");

      month.textContent =
        formatNaturalMonthlyAverageMonth(
          row.monthKey
        );
      quantity.textContent =
        `${row.quantity.toLocaleString("ja-JP")}${unit}`;

      item.appendChild(month);
      item.appendChild(quantity);
      breakdown.appendChild(item);
    }
  );

  const note =
    document.createElement("p");

  note.className =
    "natural-monthly-average-note";

  note.textContent =
    "計算方法：前月までの直近6か月の販売実績から「株式会社 後藤」「清水産業 株式会社」の実績を除外し、残った数量 ÷ 6（端数切り上げ）です。返品は販売実績のマイナス数量として差し引きます。";

  if (
    calculation.excludedCount > 0
  ) {
    const excluded =
      document.createElement("p");

    excluded.className =
      "natural-monthly-average-excluded";

    excluded.textContent =
      `今回の対象期間では、「株式会社 後藤」「清水産業 株式会社」の販売実績 ${calculation.excludedQuantity.toLocaleString("ja-JP")}${unit} を月平均の計算から除外しました。`;

    card.appendChild(heading);
    card.appendChild(answer);
    card.appendChild(summary);
    card.appendChild(period);
    card.appendChild(breakdown);
    card.appendChild(note);
    card.appendChild(excluded);
  } else {
    card.appendChild(heading);
    card.appendChild(answer);
    card.appendChild(summary);
    card.appendChild(period);
    card.appendChild(breakdown);
    card.appendChild(note);
  }

  card.appendChild(
    createNaturalStockDetailButton(
      product
    )
  );

  container.appendChild(card);
}

function renderNaturalMonthlyAverageCandidates(
  container,
  products,
  actuals,
  plans,
  statusElement
) {
  container.innerHTML = "";

  const intro =
    document.createElement("div");

  intro.className =
    "natural-stock-candidate-intro";
  intro.textContent =
    "複数の商品が該当しました。月平均を確認する商品を選んでください。";

  container.appendChild(intro);

  products
    .slice(0, 30)
    .forEach(
      function (product) {
        const card =
          document.createElement(
            "article"
          );

        card.className =
          "natural-stock-candidate-card";

        const info =
          document.createElement("div");
        const title =
          document.createElement("strong");
        const meta =
          document.createElement("span");
        const button =
          document.createElement("button");

        title.textContent =
          product.productName ||
          "商品名未登録";
        meta.textContent =
          `社内コード：${product.internalCode || "未登録"} / 商品コード：${product.productCode || "未登録"}`;

        button.type = "button";
        button.textContent =
          "この商品の月平均を見る";

        button.addEventListener(
          "click",
          function () {
            renderNaturalMonthlyAverageAnswer(
              container,
              product,
              actuals,
              plans
            );

            if (statusElement) {
              statusElement.textContent =
                "月平均を計算しました。";
              statusElement.className =
                "natural-stock-search-status natural-stock-search-success";
            }
          }
        );

        info.appendChild(title);
        info.appendChild(meta);
        card.appendChild(info);
        card.appendChild(button);
        container.appendChild(card);
      }
    );
}

function renderNaturalMonthlyAverageNoProduct(
  container,
  query
) {
  const box =
    document.createElement("div");
  const title =
    document.createElement("strong");
  const text =
    document.createElement("p");

  box.className =
    "natural-stock-no-match";
  title.textContent =
    "月平均を検索するには";
  text.textContent =
    `「${query}」では商品を特定できませんでした。社内コード・商品コード・JANコード・商品名を入れてください。商品コードは「251BK 月平均」のように一部だけでも検索できます。`;

  box.appendChild(title);
  box.appendChild(text);
  container.appendChild(box);
}

function findNaturalStockMatches(
  products,
  rawQuery
) {
  const list =
    Array.isArray(products)
      ? products
      : [];

  const query =
    normalizeNaturalStockText(
      rawQuery
    );

  const compactQuery =
    compactNaturalStockText(
      rawQuery
    );

  if (!compactQuery) {
    return [];
  }

  const exactInternal =
    list.filter(
      function (product) {
        return fieldAppearsInQuery(
          compactQuery,
          product &&
            product.internalCode
        );
      }
    );

  if (exactInternal.length > 0) {
    return sortNaturalStockProducts(
      exactInternal
    );
  }

  const exactProductCode =
    list.filter(
      function (product) {
        const productCode =
          product &&
          product.productCode;

        if (
          !isMeaningfulNaturalStockField(
            productCode
          )
        ) {
          return false;
        }

        return fieldAppearsInQuery(
          compactQuery,
          productCode
        );
      }
    );

  if (exactProductCode.length > 0) {
    return sortNaturalStockProducts(
      exactProductCode
    );
  }

  const exactJan =
    list.filter(
      function (product) {
        const jan =
          product &&
          (
            product.jan ||
            product.janCode ||
            product.barcode
          );

        if (
          !isMeaningfulNaturalStockField(
            jan
          )
        ) {
          return false;
        }

        return fieldAppearsInQuery(
          compactQuery,
          jan
        );
      }
    );

  if (exactJan.length > 0) {
    return sortNaturalStockProducts(
      exactJan
    );
  }

  const fullNameMatches =
    list.filter(
      function (product) {
        const name =
          compactNaturalStockText(
            product &&
              product.productName
          );

        return (
          name.length >= 2 &&
          compactQuery.includes(name)
        );
      }
    );

  if (fullNameMatches.length > 0) {
    return sortNaturalStockProducts(
      fullNameMatches
    );
  }

  const keyword =
    extractNaturalStockKeyword(
      query
    );

  const compactKeyword =
    compactNaturalStockText(
      keyword
    );

  if (compactKeyword.length < 2) {
    return [];
  }

  const partialMatches =
    list.filter(
      function (product) {
        const fields = [
          product &&
            product.productName,
          product &&
            product.internalCode,
          product &&
            product.productCode,
          product &&
            (
              product.jan ||
              product.janCode ||
              product.barcode
            )
        ];

        return fields.some(
          function (field) {
            if (
              !isMeaningfulNaturalStockField(
                field
              )
            ) {
              return false;
            }

            const normalizedField =
              compactNaturalStockText(
                field
              );

            return (
              normalizedField.includes(
                compactKeyword
              ) ||
              compactKeyword.includes(
                normalizedField
              )
            );
          }
        );
      }
    );

  return sortNaturalStockProducts(
    partialMatches
  );
}

function fieldAppearsInQuery(
  compactQuery,
  field
) {
  if (
    !isMeaningfulNaturalStockField(
      field
    )
  ) {
    return false;
  }

  const normalizedField =
    compactNaturalStockText(
      field
    );

  return (
    normalizedField.length >= 2 &&
    compactQuery.includes(
      normalizedField
    )
  );
}

function isMeaningfulNaturalStockField(
  value
) {
  const text =
    String(value || "").trim();

  return (
    text !== "" &&
    text !== "-" &&
    text !== "―" &&
    text !== "ー"
  );
}

function normalizeNaturalStockText(
  value
) {
  return String(value || "")
    .normalize("NFKC")
    .replace(
      /[\u200B-\u200D\uFEFF]/g,
      ""
    )
    .replace(
      /[\s\u3000]+/g,
      " "
    )
    .trim()
    .toUpperCase();
}

function compactNaturalStockText(
  value
) {
  return normalizeNaturalStockText(
    value
  ).replace(
    /[\s\u3000"'“”‘’「」『』（）()\[\]［］{}｛｝<>＜＞、。,.!?！？:：;；・/\\|_=+~〜～]/g,
    ""
  );
}

function extractNaturalStockKeyword(
  normalizedQuery
) {
  return String(
    normalizedQuery || ""
  )
    .replace(
      /(情報をまとめて|まとめて教えて|まとめて|まとめ|全部教えて|全部|情報|状況|について|次の船便|次便|船便|船積み数量|船積数量|船積み|船積|積載数量|積載|振り分け数量|振分数量|振り分け|振分|載っている|載ってる|載る|積んでいる|積んでる|積む|販売予定|出荷予定|出荷時期|出荷日|出荷|販売|予定|現在庫数|現在庫|合計在庫数|合計在庫|在庫数|場所別在庫|在庫|保管場所|どこに|どこ|いつ|何個|何本|何箱|何枚|何台|何袋|何セット|いくつ|ありますか|あるの|ある|教えてください|教えて|知りたい|確認したい|検索して|検索|商品コード|社内コード|JANコード|JAN)/gi,
      " "
    )
    .replace(
      /[はがをのにでと？?！!。、「」『』]/g,
      " "
    )
    .replace(
      /[\s\u3000]+/g,
      " "
    )
    .trim();
}

function sortNaturalStockProducts(
  products
) {
  return products
    .slice()
    .sort(
      function (left, right) {
        return String(
          left &&
            left.productName ||
            ""
        ).localeCompare(
          String(
            right &&
              right.productName ||
              ""
          ),
          "ja"
        );
      }
    );
}




function isNaturalSummaryQuery(
  query
) {
  const normalized =
    normalizeNaturalStockText(
      query
    );

  return (
    normalized.includes(
      "まとめて"
    ) ||
    normalized.includes(
      "まとめ"
    ) ||
    normalized.includes(
      "全部教えて"
    ) ||
    (
      normalized.includes(
        "情報"
      ) &&
      (
        normalized.includes(
          "教えて"
        ) ||
        normalized.includes(
          "知りたい"
        ) ||
        normalized.endsWith(
          "情報は?"
        ) ||
        normalized.endsWith(
          "情報は？"
        )
      )
    ) ||
    normalized.includes(
      "について教えて"
    )
  );
}

async function searchNaturalProductSummary(
  query,
  status,
  result
) {
  if (
    typeof getAllProducts !==
    "function"
  ) {
    status.textContent =
      "商品データを読み込む準備ができていません。画面を更新して、もう一度お試しください。";
    status.className =
      "natural-stock-search-status natural-stock-search-error";
    return;
  }

  status.textContent =
    "在庫・販売予定・船便情報をまとめて確認しています…";
  status.className =
    "natural-stock-search-status";

  try {
    const products =
      await getAllProducts();

    const matches =
      findNaturalStockMatches(
        products,
        query
      );

    if (
      matches.length === 0
    ) {
      status.textContent =
        "まとめて表示する商品を特定できませんでした。";
      status.className =
        "natural-stock-search-status natural-stock-search-warning";

      renderNaturalSummaryNoProduct(
        result,
        query
      );
      return;
    }

    if (
      matches.length > 1
    ) {
      status.textContent =
        `${matches.length}商品が候補に見つかりました。商品を選んでください。`;
      status.className =
        "natural-stock-search-status natural-stock-search-warning";

      renderNaturalSummaryCandidates(
        result,
        matches,
        status
      );
      return;
    }

    await renderNaturalProductSummary(
      result,
      matches[0],
      status
    );
  } catch (error) {
    console.error(
      "自然文まとめ検索エラー",
      error
    );

    status.textContent =
      "商品情報をまとめて読み込めませんでした。画面を更新して、もう一度お試しください。";
    status.className =
      "natural-stock-search-status natural-stock-search-error";
  }
}

async function renderNaturalProductSummary(
  container,
  product,
  status
) {
  container.innerHTML =
    "";

  const titleCard =
    createNaturalSummaryTitleCard(
      product
    );

  container.appendChild(
    titleCard
  );

  // 1. 在庫
  const stockSection =
    document.createElement(
      "section"
    );

  stockSection.className =
    "natural-summary-section natural-summary-stock-section";

  const stockTitle =
    document.createElement(
      "h4"
    );

  stockTitle.textContent =
    "在庫";

  stockSection.appendChild(
    stockTitle
  );

  const stockBody =
    document.createElement(
      "div"
    );

  renderNaturalStockAnswer(
    stockBody,
    product
  );

  stockSection.appendChild(
    stockBody
  );

  container.appendChild(
    stockSection
  );

  // 2. 販売予定
  const salesSection =
    document.createElement(
      "section"
    );

  salesSection.className =
    "natural-summary-section natural-summary-sales-section";

  const salesTitle =
    document.createElement(
      "h4"
    );

  salesTitle.textContent =
    "販売予定";

  salesSection.appendChild(
    salesTitle
  );

  const salesBody =
    document.createElement(
      "div"
    );

  salesSection.appendChild(
    salesBody
  );

  container.appendChild(
    salesSection
  );

  let salesAvailable =
    false;

  let upcomingPlans =
    [];

  let allMatchingPlans =
    [];

  if (
    typeof getAllSalesPlans ===
    "function"
  ) {
    try {
      const plans =
        await getAllSalesPlans();

      const internalCode =
        String(
          product.internalCode ||
          ""
        ).trim();

      allMatchingPlans =
        (
          Array.isArray(plans)
            ? plans
            : []
        ).filter(
          function (plan) {
            return (
              String(
                plan &&
                  plan.internalCode ||
                  ""
              ).trim() ===
              internalCode
            );
          }
        );

      const today =
        getNaturalTodayIso();

      upcomingPlans =
        allMatchingPlans
          .filter(
            function (plan) {
              return isNaturalSalesPlanUpcoming(
                plan,
                today
              );
            }
          )
          .sort(
            compareNaturalSalesPlans
          );

      salesAvailable =
        true;
    } catch (error) {
      console.error(
        "まとめ表示 販売予定読込エラー",
        error
      );
    }
  }

  if (
    salesAvailable &&
    upcomingPlans.length > 0
  ) {
    renderNaturalSalesPlanAnswer(
      salesBody,
      [product],
      upcomingPlans
    );
  } else if (
    salesAvailable
  ) {
    renderNaturalSalesPlanEmpty(
      salesBody,
      [product],
      allMatchingPlans.length
    );
  } else {
    renderNaturalSummaryUnavailableBlock(
      salesBody,
      "販売予定データを読み込めませんでした。"
    );
  }

  // 3. 船便
  const shippingSection =
    document.createElement(
      "section"
    );

  shippingSection.className =
    "natural-summary-section natural-summary-shipping-section";

  const shippingTitle =
    document.createElement(
      "h4"
    );

  shippingTitle.textContent =
    "船便・船積数量";

  shippingSection.appendChild(
    shippingTitle
  );

  const shippingBody =
    document.createElement(
      "div"
    );

  shippingSection.appendChild(
    shippingBody
  );

  container.appendChild(
    shippingSection
  );

  let shippingAvailable =
    false;

  let shippingRows =
    [];

  try {
    const shippingResult =
      await collectNaturalShippingAllocations(
        [product]
      );

    shippingAvailable =
      shippingResult.available;

    shippingRows =
      shippingResult.allocations
        .filter(
          function (item) {
            return (
              Number(
                item.quantity
              ) > 0
            );
          }
        )
        .sort(
          compareNaturalShippingRows
        );
  } catch (error) {
    console.error(
      "まとめ表示 船便読込エラー",
      error
    );
  }

  if (
    shippingAvailable &&
    shippingRows.length > 0
  ) {
    renderNaturalShippingAnswer(
      shippingBody,
      [product],
      shippingRows
    );
  } else if (
    shippingAvailable
  ) {
    renderNaturalShippingEmpty(
      shippingBody,
      [product]
    );
  } else {
    renderNaturalSummaryUnavailableBlock(
      shippingBody,
      "船便情報を読み込めませんでした。"
    );
  }

  status.textContent =
    "在庫・販売予定・船便情報をまとめて表示しました。";
  status.className =
    "natural-stock-search-status natural-stock-search-success";

  const summary =
    buildNaturalOverviewSentence(
      product,
      upcomingPlans,
      shippingRows,
      salesAvailable,
      shippingAvailable
    );

  const sentence =
    titleCard.querySelector(
      ".natural-summary-title-text"
    );

  if (sentence) {
    sentence.textContent =
      summary;
  }
}

function createNaturalSummaryTitleCard(
  product
) {
  const article =
    document.createElement(
      "article"
    );

  article.className =
    "natural-summary-title-card";

  const kicker =
    document.createElement(
      "span"
    );

  kicker.className =
    "natural-summary-kicker";

  kicker.textContent =
    "まとめ表示";

  const heading =
    document.createElement(
      "h3"
    );

  heading.textContent =
    product.productName ||
    "商品情報";

  const meta =
    document.createElement(
      "p"
    );

  meta.className =
    "natural-summary-meta";

  meta.textContent =
    `社内コード：${product.internalCode || "未登録"} / 商品コード：${product.productCode || "未登録"}`;

  const text =
    document.createElement(
      "p"
    );

  text.className =
    "natural-summary-title-text";

  text.textContent =
    "商品情報を確認しています…";

  article.appendChild(
    kicker
  );

  article.appendChild(
    heading
  );

  article.appendChild(
    meta
  );

  article.appendChild(
    text
  );

  return article;
}

function buildNaturalOverviewSentence(
  product,
  upcomingPlans,
  shippingRows,
  salesAvailable,
  shippingAvailable
) {
  const unit =
    getNaturalStockUnit(
      product
    );

  const stock =
    formatNaturalStockNumber(
      product.stock
    );

  let salesText =
    "販売予定は確認できませんでした";

  if (salesAvailable) {
    if (
      upcomingPlans.length > 0
    ) {
      const quantity =
        upcomingPlans.reduce(
          function (sum, plan) {
            const value =
              Number(
                plan &&
                  plan.quantity ||
                  0
              );

            return (
              sum +
              (
                Number.isFinite(
                  value
                )
                  ? value
                  : 0
              )
            );
          },
          0
        );

      salesText =
        `今後の販売予定は${upcomingPlans.length}件、合計${Number(quantity).toLocaleString("ja-JP")}個です`;
    } else {
      salesText =
        "今後の販売予定はありません";
    }
  }

  let shippingText =
    "船便情報は確認できませんでした";

  if (shippingAvailable) {
    if (
      shippingRows.length > 0
    ) {
      const quantity =
        shippingRows.reduce(
          function (sum, row) {
            return (
              sum +
              Number(
                row.quantity || 0
              )
            );
          },
          0
        );

      shippingText =
        `船便は${shippingRows.length}件、船積数量は合計${Number(quantity).toLocaleString("ja-JP")}個です`;
    } else {
      shippingText =
        "保存済みの船積数量はありません";
    }
  }

  return (
    `合計在庫は${stock}${unit}です。` +
    `${salesText}。` +
    `${shippingText}。`
  );
}

function renderNaturalSummaryCandidates(
  container,
  products,
  status
) {
  container.innerHTML =
    "";

  const intro =
    document.createElement(
      "div"
    );

  intro.className =
    "natural-stock-candidate-intro";

  intro.textContent =
    "複数の商品が該当しました。まとめて確認したい商品を選んでください。";

  container.appendChild(
    intro
  );

  products
    .slice(0, 30)
    .forEach(
      function (product) {
        const card =
          document.createElement(
            "article"
          );

        card.className =
          "natural-stock-candidate-card";

        const info =
          document.createElement(
            "div"
          );

        const title =
          document.createElement(
            "strong"
          );

        title.textContent =
          product.productName ||
          "商品名未登録";

        const meta =
          document.createElement(
            "span"
          );

        meta.textContent =
          `社内コード：${product.internalCode || "未登録"} / 商品コード：${product.productCode || "未登録"}`;

        info.appendChild(
          title
        );

        info.appendChild(
          meta
        );

        const button =
          document.createElement(
            "button"
          );

        button.type =
          "button";

        button.textContent =
          "この商品をまとめて見る";

        button.addEventListener(
          "click",
          function () {
            status.textContent =
              "商品情報をまとめて確認しています…";
            status.className =
              "natural-stock-search-status";

            void renderNaturalProductSummary(
              container,
              product,
              status
            );
          }
        );

        card.appendChild(
          info
        );

        card.appendChild(
          button
        );

        container.appendChild(
          card
        );
      }
    );
}

function renderNaturalSummaryUnavailableBlock(
  container,
  message
) {
  const box =
    document.createElement(
      "div"
    );

  box.className =
    "natural-summary-unavailable";

  box.textContent =
    message;

  container.appendChild(
    box
  );
}

function renderNaturalSummaryNoProduct(
  container,
  query
) {
  const box =
    document.createElement(
      "div"
    );

  box.className =
    "natural-stock-no-match";

  const title =
    document.createElement(
      "strong"
    );

  title.textContent =
    "商品を特定できませんでした";

  const text =
    document.createElement(
      "p"
    );

  text.textContent =
    `「${query}」では商品を特定できませんでした。商品コード・社内コード・JANコード・商品名のどれかを文章に入れてください。`;

  box.appendChild(
    title
  );

  box.appendChild(
    text
  );

  container.appendChild(
    box
  );
}

function isNaturalShippingQuery(
  query
) {
  const normalized =
    normalizeNaturalStockText(
      query
    );

  return (
    normalized.includes(
      "船便"
    ) ||
    normalized.includes(
      "船積"
    ) ||
    normalized.includes(
      "積載"
    ) ||
    normalized.includes(
      "振り分け"
    ) ||
    normalized.includes(
      "振分"
    ) ||
    normalized.includes(
      "載って"
    ) ||
    normalized.includes(
      "積んで"
    )
  );
}

async function searchShippingByNaturalText(
  query,
  status,
  result
) {
  if (
    typeof getAllProducts !==
    "function"
  ) {
    status.textContent =
      "商品データを読み込む準備ができていません。画面を更新して、もう一度お試しください。";
    status.className =
      "natural-stock-search-status natural-stock-search-error";
    return;
  }

  status.textContent =
    "船便情報を検索しています…";
  status.className =
    "natural-stock-search-status";

  try {
    const products =
      await getAllProducts();

    const matches =
      findNaturalStockMatches(
        products,
        query
      );

    if (matches.length === 0) {
      const scheduleHandled =
        await searchNaturalShippingScheduleRelation(
          query,
          status,
          result,
          products
        );

      if (scheduleHandled) {
        return;
      }

      status.textContent =
        "船便情報を調べる商品・船便を特定できませんでした。";
      status.className =
        "natural-stock-search-status natural-stock-search-warning";

      renderNaturalShippingNoProduct(
        result,
        query
      );
      return;
    }

    const shippingResult =
      await collectNaturalShippingAllocations(
        matches
      );

    if (
      !shippingResult.available
    ) {
      status.textContent =
        "船便情報を読み取れませんでした。";
      status.className =
        "natural-stock-search-status natural-stock-search-warning";

      renderNaturalShippingUnavailable(
        result
      );
      return;
    }

    const positive =
      shippingResult.allocations
        .filter(
          function (item) {
            return (
              Number(
                item.quantity
              ) > 0
            );
          }
        )
        .sort(
          compareNaturalShippingRows
        );

    if (positive.length === 0) {
      status.textContent =
        "保存済みの船積数量はありません。";
      status.className =
        "natural-stock-search-status natural-stock-search-success";

      renderNaturalShippingEmpty(
        result,
        matches
      );
      return;
    }

    status.textContent =
      `${positive.length}件の船便情報が見つかりました。`;
    status.className =
      "natural-stock-search-status natural-stock-search-success";

    renderNaturalShippingAnswer(
      result,
      matches,
      positive
    );
  } catch (error) {
    console.error(
      "自然文船便検索エラー",
      error
    );

    status.textContent =
      "船便情報を検索できませんでした。画面を更新して、もう一度お試しください。";
    status.className =
      "natural-stock-search-status natural-stock-search-error";
  }
}

async function searchNaturalShippingScheduleRelation(
  query,
  status,
  result,
  products
) {
  let relationData = null;

  try {
    if (
      window.shippingScheduleApp &&
      typeof window.shippingScheduleApp
        .getSearchRelationData ===
        "function"
    ) {
      relationData =
        await window
          .shippingScheduleApp
          .getSearchRelationData();
    } else if (
      typeof getAllShippingSchedules ===
        "function" &&
      typeof getAllShippingAllocations ===
        "function" &&
      typeof getAllSalesPlans ===
        "function"
    ) {
      const values =
        await Promise.all([
          getAllShippingSchedules(),
          getAllShippingAllocations(),
          getAllSalesPlans()
        ]);

      relationData = {
        schedules:
          values[0] || [],
        allocations:
          values[1] || [],
        products:
          products || [],
        salesPlans:
          values[2] || []
      };
    }
  } catch (error) {
    console.error(
      "船便関連情報の読込エラー",
      error
    );

    return false;
  }

  if (
    !relationData ||
    !Array.isArray(
      relationData.schedules
    )
  ) {
    return false;
  }

  const schedules =
    relationData.schedules
      .slice()
      .sort(
        compareNaturalRelationSchedules
      );

  if (
    schedules.length === 0
  ) {
    return false;
  }

  const matches =
    findNaturalShippingScheduleMatches(
      schedules,
      query
    );

  if (
    matches.length === 0
  ) {
    return false;
  }

  if (
    matches.length > 1
  ) {
    status.textContent =
      `${matches.length}件の船便が候補に見つかりました。確認したい船便を選んでください。`;

    status.className =
      "natural-stock-search-status natural-stock-search-warning";

    renderNaturalShippingScheduleCandidates(
      result,
      matches,
      relationData,
      status
    );

    return true;
  }

  status.textContent =
    "船便と関連情報が見つかりました。";

  status.className =
    "natural-stock-search-status natural-stock-search-success";

  renderNaturalShippingScheduleRelation(
    result,
    matches[0],
    relationData
  );

  return true;
}

function findNaturalShippingScheduleMatches(
  schedules,
  rawQuery
) {
  const list =
    Array.isArray(schedules)
      ? schedules
      : [];

  const normalizedQuery =
    normalizeNaturalStockText(
      rawQuery
    );

  const compactQuery =
    compactNaturalStockText(
      rawQuery
    );

  if (
    !normalizedQuery ||
    list.length === 0
  ) {
    return [];
  }

  const nextShipOnly =
    (
      normalizedQuery.includes(
        "次の船便"
      ) ||
      normalizedQuery.includes(
        "次便"
      )
    ) &&
    !/[A-Z]{1,6}[- ]?[A-Z0-9()]{1,}/i.test(
      normalizedQuery
    ) &&
    !/\d{4,}/.test(
      normalizedQuery.replace(
        /[\/年月日.-]/g,
        ""
      )
    );

  if (nextShipOnly) {
    const next =
      getNaturalNextShippingSchedule(
        list
      );

    return next
      ? [next]
      : [];
  }

  const keyword =
    extractNaturalShippingScheduleKeyword(
      rawQuery
    );

  const compactKeyword =
    compactNaturalStockText(
      keyword
    );

  const scored =
    list.map(
      function (schedule) {
        let score = 0;

        const name =
          String(
            schedule &&
              schedule.name ||
              ""
          ).trim();

        const compactName =
          compactNaturalStockText(
            name
          );

        if (
          compactName.length >= 2 &&
          compactQuery.includes(
            compactName
          )
        ) {
          score += 120;
        }

        if (
          compactKeyword.length >= 2 &&
          compactName.length >= 2 &&
          (
            compactName.includes(
              compactKeyword
            ) ||
            compactKeyword.includes(
              compactName
            )
          )
        ) {
          score += 80;
        }

        const dateFields = [
          {
            value:
              schedule.departureDate,
            score:
              100
          },
          {
            value:
              schedule.warehouseArrivalDate,
            score:
              85
          },
          {
            value:
              schedule.arrivalDate,
            score:
              70
          }
        ];

        dateFields.forEach(
          function (entry) {
            if (
              naturalShippingQueryContainsDate(
                normalizedQuery,
                entry.value
              )
            ) {
              score +=
                entry.score;
            }
          }
        );

        return {
          schedule:
            schedule,
          score:
            score
        };
      }
    )
    .filter(
      function (entry) {
        return (
          entry.score > 0
        );
      }
    )
    .sort(
      function (left, right) {
        if (
          right.score !==
          left.score
        ) {
          return (
            right.score -
            left.score
          );
        }

        return compareNaturalRelationSchedules(
          left.schedule,
          right.schedule
        );
      }
    );

  if (
    scored.length === 0
  ) {
    return [];
  }

  const topScore =
    scored[0].score;

  return scored
    .filter(
      function (entry) {
        return (
          entry.score ===
          topScore
        );
      }
    )
    .map(
      function (entry) {
        return (
          entry.schedule
        );
      }
    );
}

function extractNaturalShippingScheduleKeyword(
  rawQuery
) {
  return normalizeNaturalStockText(
    rawQuery
  )
    .replace(
      /(船便|船積み|船積|積載|振り分け|振分|について|の情報|情報|詳細|教えてください|教えて|確認したい|確認|見たい|検索して|検索|どんな|どの|いつ|次の|次便)/gi,
      " "
    )
    .replace(
      /[はがをのにでと？?！!。、「」『』]/g,
      " "
    )
    .replace(
      /\s+/g,
      " "
    )
    .trim();
}

function naturalShippingQueryContainsDate(
  normalizedQuery,
  isoDate
) {
  if (
    !isNaturalIsoDate(
      isoDate
    )
  ) {
    return false;
  }

  const match =
    /^(\d{4})-(\d{2})-(\d{2})$/.exec(
      String(
        isoDate
      )
    );

  if (!match) {
    return false;
  }

  const year =
    Number(
      match[1]
    );

  const month =
    Number(
      match[2]
    );

  const day =
    Number(
      match[3]
    );

  const aliases = [
    `${match[1]}-${match[2]}-${match[3]}`,
    `${match[1]}/${match[2]}/${match[3]}`,
    `${year}/${month}/${day}`,
    `${year}年${month}月${day}日`,
    `${match[2]}/${match[3]}`,
    `${month}/${day}`,
    `${month}月${day}日`
  ];

  return aliases.some(
    function (alias) {
      return normalizeNaturalStockText(
        normalizedQuery
      ).includes(
        normalizeNaturalStockText(
          alias
        )
      );
    }
  );
}

function getNaturalNextShippingSchedule(
  schedules
) {
  const today =
    getNaturalTodayIso();

  return schedules
    .filter(
      function (schedule) {
        const warehouse =
          String(
            schedule &&
              schedule
                .warehouseArrivalDate ||
              ""
          );

        const departure =
          String(
            schedule &&
              schedule.departureDate ||
              ""
          );

        return (
          (
            isNaturalIsoDate(
              warehouse
            ) &&
            warehouse >= today
          ) ||
          (
            isNaturalIsoDate(
              departure
            ) &&
            departure >= today
          )
        );
      }
    )
    .sort(
      compareNaturalRelationSchedules
    )[0] ||
    null;
}

function compareNaturalRelationSchedules(
  left,
  right
) {
  const leftDate =
    String(
      left &&
        (
          left.departureDate ||
          left.warehouseArrivalDate ||
          ""
        )
    );

  const rightDate =
    String(
      right &&
        (
          right.departureDate ||
          right.warehouseArrivalDate ||
          ""
        )
    );

  const compared =
    leftDate.localeCompare(
      rightDate
    );

  if (
    compared !== 0
  ) {
    return compared;
  }

  return String(
    left &&
      left.name ||
      ""
  ).localeCompare(
    String(
      right &&
        right.name ||
        ""
    ),
    "ja",
    {
      numeric: true
    }
  );
}

function renderNaturalShippingScheduleCandidates(
  container,
  schedules,
  relationData,
  status
) {
  container.innerHTML =
    "";

  const box =
    document.createElement(
      "section"
    );

  box.className =
    "natural-relation-candidates";

  const title =
    document.createElement(
      "h3"
    );

  title.textContent =
    "船便の候補";

  box.appendChild(
    title
  );

  schedules.forEach(
    function (schedule) {
      const card =
        document.createElement(
          "article"
        );

      card.className =
        "natural-relation-candidate-card";

      const info =
        document.createElement(
          "div"
        );

      const heading =
        document.createElement(
          "strong"
        );

      heading.textContent =
        schedule.name ||
        "船便名未設定";

      const dates =
        document.createElement(
          "span"
        );

      dates.textContent =
        `出港 ${formatNaturalRelationDate(schedule.departureDate)} / ` +
        `倉庫到着 ${formatNaturalRelationDate(schedule.warehouseArrivalDate)}`;

      info.appendChild(
        heading
      );

      info.appendChild(
        dates
      );

      const button =
        document.createElement(
          "button"
        );

      button.type =
        "button";

      button.textContent =
        "関連情報を見る";

      button.addEventListener(
        "click",
        function () {
          status.textContent =
            "船便と関連情報が見つかりました。";

          status.className =
            "natural-stock-search-status natural-stock-search-success";

          renderNaturalShippingScheduleRelation(
            container,
            schedule,
            relationData
          );
        }
      );

      card.appendChild(
        info
      );

      card.appendChild(
        button
      );

      box.appendChild(
        card
      );
    }
  );

  container.appendChild(
    box
  );
}

function renderNaturalShippingScheduleRelation(
  container,
  schedule,
  relationData
) {
  container.innerHTML =
    "";

  const relation =
    buildNaturalShippingScheduleRelation(
      schedule,
      relationData
    );

  const article =
    document.createElement(
      "article"
    );

  article.className =
    "natural-shipping-relation-card";

  const headingArea =
    document.createElement(
      "div"
    );

  headingArea.className =
    "natural-relation-heading";

  const heading =
    document.createElement(
      "h3"
    );

  heading.textContent =
    schedule.name ||
    "船便情報";

  const description =
    document.createElement(
      "p"
    );

  description.textContent =
    relation.products.length > 0
      ? `この船便には${relation.products.length.toLocaleString("ja-JP")}商品、合計${relation.totalQuantity.toLocaleString("ja-JP")}個が登録されています。`
      : "この船便には、まだ船積み商品が登録されていません。";

  headingArea.appendChild(
    heading
  );

  headingArea.appendChild(
    description
  );

  article.appendChild(
    headingArea
  );

  const summary =
    document.createElement(
      "div"
    );

  summary.className =
    "natural-relation-summary-grid";

  [
    [
      "出港日",
      formatNaturalRelationDate(
        schedule.departureDate
      )
    ],
    [
      "入港日",
      formatNaturalRelationDate(
        schedule.arrivalDate
      )
    ],
    [
      "倉庫到着日",
      formatNaturalRelationDate(
        schedule.warehouseArrivalDate
      )
    ],
    [
      "船積数量",
      `${relation.totalQuantity.toLocaleString("ja-JP")}個`
    ]
  ].forEach(
    function (entry) {
      const box =
        document.createElement(
          "div"
        );

      const label =
        document.createElement(
          "span"
        );

      label.textContent =
        entry[0];

      const value =
        document.createElement(
          "strong"
        );

      value.textContent =
        entry[1];

      box.appendChild(
        label
      );

      box.appendChild(
        value
      );

      summary.appendChild(
        box
      );
    }
  );

  article.appendChild(
    summary
  );

  const periodBox =
    document.createElement(
      "div"
    );

  periodBox.className =
    "natural-relation-period";

  if (
    relation.targetPeriod.valid
  ) {
    periodBox.textContent =
      `この船便の販売確認期間：${formatNaturalRelationDate(relation.targetPeriod.startDate)} ～ ${formatNaturalRelationDate(relation.targetPeriod.endDate)} / ` +
      `期間内の販売予定 ${relation.salesPlans.length.toLocaleString("ja-JP")}件・合計${relation.salesPlanQuantity.toLocaleString("ja-JP")}個`;
  } else {
    periodBox.textContent =
      "次の船便が未登録のため、この船便に対応する販売確認期間はまだ確定していません。";
  }

  article.appendChild(
    periodBox
  );

  const actions =
    document.createElement(
      "div"
    );

  actions.className =
    "natural-relation-main-actions";

  const scheduleButton =
    document.createElement(
      "button"
    );

  scheduleButton.type =
    "button";

  scheduleButton.className =
    "natural-relation-primary-button";

  scheduleButton.textContent =
    "この船便の詳細を見る";

  scheduleButton.addEventListener(
    "click",
    function () {
      if (
        window.shippingScheduleApp &&
        typeof window.shippingScheduleApp
          .openScheduleDetails ===
          "function"
      ) {
        void window
          .shippingScheduleApp
          .openScheduleDetails(
            schedule.id
          );
      }
    }
  );

  actions.appendChild(
    scheduleButton
  );

  article.appendChild(
    actions
  );

  const productsSection =
    document.createElement(
      "section"
    );

  productsSection.className =
    "natural-relation-products";

  const productsTitle =
    document.createElement(
      "h4"
    );

  productsTitle.textContent =
    "この船便に紐づく商品";

  productsSection.appendChild(
    productsTitle
  );

  if (
    relation.products.length ===
    0
  ) {
    const empty =
      document.createElement(
        "p"
      );

    empty.className =
      "natural-relation-empty";

    empty.textContent =
      "船積み商品はまだ登録されていません。";

    productsSection.appendChild(
      empty
    );
  } else {
    const maxDisplay = 12;

    relation.products
      .slice(
        0,
        maxDisplay
      )
      .forEach(
        function (item) {
          productsSection.appendChild(
            createNaturalRelationProductCard(
              item
            )
          );
        }
      );

    if (
      relation.products.length >
      maxDisplay
    ) {
      const rest =
        document.createElement(
          "p"
        );

      rest.className =
        "natural-relation-more";

      rest.textContent =
        `ほか${(relation.products.length - maxDisplay).toLocaleString("ja-JP")}商品あります。「この船便の詳細を見る」で全商品を確認できます。`;

      productsSection.appendChild(
        rest
      );
    }
  }

  article.appendChild(
    productsSection
  );

  container.appendChild(
    article
  );
}

function buildNaturalShippingScheduleRelation(
  schedule,
  relationData
) {
  const allocations =
    Array.isArray(
      relationData.allocations
    )
      ? relationData.allocations
      : [];

  const products =
    Array.isArray(
      relationData.products
    )
      ? relationData.products
      : [];

  const salesPlans =
    Array.isArray(
      relationData.salesPlans
    )
      ? relationData.salesPlans
      : [];

  const schedules =
    Array.isArray(
      relationData.schedules
    )
      ? relationData.schedules
      : [];

  const productMap =
    new Map();

  products.forEach(
    function (product) {
      const code =
        String(
          product &&
            product.internalCode ||
            ""
        ).trim();

      if (code) {
        productMap.set(
          code,
          product
        );
      }
    }
  );

  const allocationMap =
    new Map();

  allocations
    .filter(
      function (record) {
        return (
          String(
            record &&
              record.scheduleId ||
              ""
          ) ===
          String(
            schedule.id ||
            ""
          ) &&
          Number(
            record &&
              record.quantity ||
              0
          ) > 0
        );
      }
    )
    .forEach(
      function (record) {
        const internalCode =
          String(
            record &&
              record.internalCode ||
              ""
          ).trim();

        if (!internalCode) {
          return;
        }

        const current =
          allocationMap.get(
            internalCode
          ) || {
            internalCode:
              internalCode,
            productCode:
              record.productCode || "",
            productName:
              record.productName || "",
            quantity:
              0
          };

        current.quantity +=
          Math.max(
            0,
            Number(
              record.quantity || 0
            )
          );

        allocationMap.set(
          internalCode,
          current
        );
      }
    );

  const targetPeriod =
    getNaturalShippingRelationTargetPeriod(
      schedule,
      schedules
    );

  const relatedPlans =
    targetPeriod.valid
      ? salesPlans.filter(
          function (plan) {
            const internalCode =
              String(
                plan &&
                  plan.internalCode ||
                  ""
              ).trim();

            return (
              allocationMap.has(
                internalCode
              ) &&
              naturalSalesPlanOverlapsPeriod(
                plan,
                targetPeriod.startDate,
                targetPeriod.endDate
              )
            );
          }
        )
        .sort(
          compareNaturalSalesPlans
        )
      : [];

  const plansByCode =
    new Map();

  relatedPlans.forEach(
    function (plan) {
      const code =
        String(
          plan &&
            plan.internalCode ||
            ""
        ).trim();

      if (
        !plansByCode.has(
          code
        )
      ) {
        plansByCode.set(
          code,
          []
        );
      }

      plansByCode.get(
        code
      ).push(
        plan
      );
    }
  );

  const productRows =
    Array.from(
      allocationMap.values()
    )
      .map(
        function (allocation) {
          const product =
            productMap.get(
              allocation.internalCode
            ) || {};

          const plans =
            plansByCode.get(
              allocation.internalCode
            ) || [];

          const plannedQuantity =
            plans.reduce(
              function (sum, plan) {
                return (
                  sum +
                  Math.max(
                    0,
                    Number(
                      plan.quantity || 0
                    )
                  )
                );
              },
              0
            );

          return {
            internalCode:
              allocation.internalCode,
            productCode:
              allocation.productCode ||
              product.productCode ||
              "",
            productName:
              allocation.productName ||
              product.productName ||
              "",
            quantity:
              Math.max(
                0,
                Number(
                  allocation.quantity ||
                  0
                )
              ),
            product:
              product,
            salesPlans:
              plans,
            plannedQuantity:
              plannedQuantity
          };
        }
      )
      .sort(
        function (left, right) {
          if (
            right.quantity !==
            left.quantity
          ) {
            return (
              right.quantity -
              left.quantity
            );
          }

          return String(
            left.internalCode ||
            ""
          ).localeCompare(
            String(
              right.internalCode ||
              ""
            ),
            "ja",
            {
              numeric: true
            }
          );
        }
      );

  const totalQuantity =
    productRows.reduce(
      function (sum, item) {
        return (
          sum +
          Number(
            item.quantity || 0
          )
        );
      },
      0
    );

  const salesPlanQuantity =
    relatedPlans.reduce(
      function (sum, plan) {
        return (
          sum +
          Math.max(
            0,
            Number(
              plan.quantity || 0
            )
          )
        );
      },
      0
    );

  return {
    products:
      productRows,
    totalQuantity:
      totalQuantity,
    targetPeriod:
      targetPeriod,
    salesPlans:
      relatedPlans,
    salesPlanQuantity:
      salesPlanQuantity
  };
}

function getNaturalShippingRelationTargetPeriod(
  schedule,
  schedules
) {
  const startDate =
    String(
      schedule &&
        schedule
          .warehouseArrivalDate ||
        ""
    );

  if (
    !isNaturalIsoDate(
      startDate
    )
  ) {
    return {
      valid:
        false,
      startDate:
        "",
      endDate:
        ""
    };
  }

  const sorted =
    schedules
      .filter(
        function (item) {
          return (
            item &&
            item.id !==
              schedule.id &&
            isNaturalIsoDate(
              item
                .warehouseArrivalDate
            ) &&
            item
              .warehouseArrivalDate >
              startDate
          );
        }
      )
      .sort(
        function (left, right) {
          return String(
            left
              .warehouseArrivalDate
          ).localeCompare(
            String(
              right
                .warehouseArrivalDate
            )
          );
        }
      );

  const next =
    sorted[0];

  if (!next) {
    return {
      valid:
        false,
      startDate:
        startDate,
      endDate:
        ""
    };
  }

  const endDate =
    shiftNaturalIsoDate(
      next.warehouseArrivalDate,
      -1
    );

  return {
    valid:
      Boolean(
        endDate
      ),
    startDate:
      startDate,
    endDate:
      endDate,
    nextScheduleId:
      next.id || "",
    nextScheduleName:
      next.name || ""
  };
}

function shiftNaturalIsoDate(
  isoDate,
  days
) {
  if (
    !isNaturalIsoDate(
      isoDate
    )
  ) {
    return "";
  }

  const values =
    String(
      isoDate
    )
      .split("-")
      .map(Number);

  const date =
    new Date(
      values[0],
      values[1] - 1,
      values[2]
    );

  date.setDate(
    date.getDate() +
    Number(
      days || 0
    )
  );

  const year =
    date.getFullYear();

  const month =
    String(
      date.getMonth() + 1
    ).padStart(
      2,
      "0"
    );

  const day =
    String(
      date.getDate()
    ).padStart(
      2,
      "0"
    );

  return (
    `${year}-${month}-${day}`
  );
}

function naturalSalesPlanOverlapsPeriod(
  plan,
  periodStart,
  periodEnd
) {
  const period =
    getNaturalSalesPlanDateRange(
      plan
    );

  if (
    !period.valid
  ) {
    return false;
  }

  return (
    period.endDate >=
      periodStart &&
    period.startDate <=
      periodEnd
  );
}

function getNaturalSalesPlanDateRange(
  plan
) {
  const type =
    getNaturalSalesPlanType(
      plan
    );

  if (
    type === "date"
  ) {
    const date =
      String(
        plan.shippingDate || ""
      );

    return {
      valid:
        Boolean(date),
      startDate:
        date,
      endDate:
        date
    };
  }

  if (
    type === "period"
  ) {
    return {
      valid:
        true,
      startDate:
        String(
          plan
            .shippingStartDate ||
            ""
        ),
      endDate:
        String(
          plan
            .shippingEndDate ||
            ""
        )
    };
  }

  if (
    type === "month"
  ) {
    const month =
      String(
        plan.shippingMonth || ""
      );

    return {
      valid:
        /^\d{4}-\d{2}$/.test(
          month
        ),
      startDate:
        `${month}-01`,
      endDate:
        getNaturalMonthEnd(
          month
        )
    };
  }

  return {
    valid:
      false,
    startDate:
      "",
    endDate:
      ""
  };
}

function createNaturalRelationProductCard(
  item
) {
  const card =
    document.createElement(
      "article"
    );

  card.className =
    "natural-relation-product-card";

  const head =
    document.createElement(
      "div"
    );

  head.className =
    "natural-relation-product-head";

  const info =
    document.createElement(
      "div"
    );

  const name =
    document.createElement(
      "strong"
    );

  name.textContent =
    item.productName ||
    "商品名未登録";

  const codes =
    document.createElement(
      "span"
    );

  codes.textContent =
    `社内コード：${item.internalCode || "未登録"} / 商品コード：${item.productCode || "未登録"}`;

  info.appendChild(
    name
  );

  info.appendChild(
    codes
  );

  const quantity =
    document.createElement(
      "strong"
    );

  quantity.className =
    "natural-relation-ship-quantity";

  quantity.textContent =
    `船積 ${Number(item.quantity || 0).toLocaleString("ja-JP")}個`;

  head.appendChild(
    info
  );

  head.appendChild(
    quantity
  );

  card.appendChild(
    head
  );

  const planSummary =
    document.createElement(
      "div"
    );

  planSummary.className =
    "natural-relation-plan-summary";

  planSummary.textContent =
    item.salesPlans.length > 0
      ? `期間内の販売予定：${item.salesPlans.length}件 / 合計${item.plannedQuantity.toLocaleString("ja-JP")}個`
      : "期間内の販売予定：なし";

  card.appendChild(
    planSummary
  );

  if (
    item.salesPlans.length >
    0
  ) {
    const planList =
      document.createElement(
        "div"
      );

    planList.className =
      "natural-relation-plan-list";

    item.salesPlans
      .slice(
        0,
        3
      )
      .forEach(
        function (plan) {
          const row =
            document.createElement(
              "div"
            );

          const customer =
            [
              plan.customerName ||
                "取引先未登録",
              plan.subtitle || ""
            ]
              .filter(Boolean)
              .join(
                " / "
              );

          row.textContent =
            `${formatNaturalSalesPlanShipping(plan)}｜${customer}｜${Math.max(0, Number(plan.quantity || 0)).toLocaleString("ja-JP")}個`;

          planList.appendChild(
            row
          );
        }
      );

    if (
      item.salesPlans.length > 3
    ) {
      const more =
        document.createElement(
          "small"
        );

      more.textContent =
        `ほか${item.salesPlans.length - 3}件`;

      planList.appendChild(
        more
      );
    }

    card.appendChild(
      planList
    );
  }

  if (
    item.product &&
    item.product.internalCode
  ) {
    const button =
      createNaturalStockDetailButton(
        item.product
      );

    button.classList.add(
      "natural-relation-product-detail-button"
    );

    card.appendChild(
      button
    );
  }

  return card;
}

function formatNaturalRelationDate(
  value
) {
  const match =
    /^(\d{4})-(\d{2})-(\d{2})$/.exec(
      String(value || "")
    );

  if (!match) {
    return (
      String(
        value || "未設定"
      )
    );
  }

  return (
    `${Number(match[1])}/${Number(match[2])}/${Number(match[3])}`
  );
}

async function collectNaturalShippingAllocations(
  products
) {
  const scheduleSelect =
    document.querySelector(
      "#shipping-allocation-schedule"
    );

  const searchInput =
    document.querySelector(
      "#shipping-allocation-search"
    );

  const cardList =
    document.querySelector(
      "#shipping-allocation-card-list"
    );

  const openButton =
    document.querySelector(
      "#show-shipping-allocation-button"
    );

  if (
    !scheduleSelect ||
    !searchInput ||
    !cardList
  ) {
    return {
      available: false,
      allocations: []
    };
  }

  const screenStates =
    rememberNaturalMainScreenStates();

  const scrollX =
    window.scrollX;

  const scrollY =
    window.scrollY;

  const originalSchedule =
    scheduleSelect.value;

  const originalSearch =
    searchInput.value;

  let openedForSearch =
    false;

  try {
    if (
      scheduleSelect.options.length <= 1 &&
      openButton
    ) {
      openButton.click();
      openedForSearch = true;

      await waitNaturalShippingRender(
        160
      );
    }

    const options =
      Array.from(
        scheduleSelect.options
      ).filter(
        function (option) {
          return String(
            option.value || ""
          ).trim() !== "";
        }
      );

    if (options.length === 0) {
      return {
        available: true,
        allocations: []
      };
    }

    const productMap =
      new Map();

    products.forEach(
      function (product) {
        const code =
          String(
            product &&
              product.internalCode ||
              ""
          ).trim();

        if (code) {
          productMap.set(
            code,
            product
          );
        }
      }
    );

    const allocations = [];

    for (
      const option of options
    ) {
      scheduleSelect.value =
        option.value;

      scheduleSelect.dispatchEvent(
        new Event(
          "change",
          {
            bubbles: true
          }
        )
      );

      await waitNaturalShippingRender(
        120
      );

      for (
        const product of products
      ) {
        const internalCode =
          String(
            product &&
              product.internalCode ||
              ""
          ).trim();

        if (!internalCode) {
          continue;
        }

        searchInput.value =
          internalCode;

        searchInput.dispatchEvent(
          new Event(
            "input",
            {
              bubbles: true
            }
          )
        );

        await waitNaturalShippingRender(
          80
        );

        const cards =
          Array.from(
            cardList.children
          ).filter(
            function (card) {
              if (!card) {
                return false;
              }

              if (
                card.hidden ||
                card.getAttribute(
                  "aria-hidden"
                ) === "true"
              ) {
                return false;
              }

              const text =
                normalizeNaturalStockText(
                  card.textContent || ""
                );

              return text.includes(
                normalizeNaturalStockText(
                  internalCode
                )
              );
            }
          );

        cards.forEach(
          function (card) {
            const quantity =
              getNaturalShippingCardQuantity(
                card
              );

            allocations.push({
              scheduleId:
                String(
                  option.value || ""
                ),
              scheduleLabel:
                String(
                  option.textContent || ""
                ).trim(),
              scheduleOrder:
                option.index,
              internalCode:
                internalCode,
              product:
                productMap.get(
                  internalCode
                ) || product,
              quantity:
                quantity
            });
          }
        );
      }
    }

    return {
      available: true,
      allocations:
        deduplicateNaturalShippingAllocations(
          allocations
        )
    };
  } finally {
    scheduleSelect.value =
      originalSchedule;

    scheduleSelect.dispatchEvent(
      new Event(
        "change",
        {
          bubbles: true
        }
      )
    );

    await waitNaturalShippingRender(
      80
    );

    searchInput.value =
      originalSearch;

    searchInput.dispatchEvent(
      new Event(
        "input",
        {
          bubbles: true
        }
      )
    );

    if (openedForSearch) {
      restoreNaturalMainScreenStates(
        screenStates
      );
    }

    window.scrollTo(
      scrollX,
      scrollY
    );
  }
}

function getNaturalShippingCardQuantity(
  card
) {
  const dataCandidates = [
    card.dataset
      ? card.dataset.savedQuantity
      : "",
    card.dataset
      ? card.dataset.shippingQuantity
      : "",
    card.dataset
      ? card.dataset.allocationQuantity
      : "",
    card.dataset
      ? card.dataset.quantity
      : ""
  ];

  for (
    const value of dataCandidates
  ) {
    const number =
      Number(value);

    if (
      Number.isFinite(number) &&
      number >= 0
    ) {
      return Math.trunc(number);
    }
  }

  const inputs =
    Array.from(
      card.querySelectorAll(
        'input[type="number"]'
      )
    ).filter(
      function (input) {
        return !input.disabled;
      }
    );

  if (inputs.length > 0) {
    const preferred =
      inputs.find(
        function (input) {
          const parentText =
            normalizeNaturalStockText(
              (
                input.parentElement &&
                input.parentElement
                  .textContent
              ) || ""
            );

          const key =
            (
              String(
                input.id || ""
              ) +
              " " +
              String(
                input.name || ""
              ) +
              " " +
              String(
                input.className || ""
              )
            ).toLowerCase();

          return (
            parentText.includes(
              "今回の船便"
            ) ||
            key.includes(
              "allocation"
            ) ||
            key.includes(
              "shipping"
            ) ||
            key.includes(
              "quantity"
            ) ||
            key.includes(
              "qty"
            )
          );
        }
      ) ||
      inputs[0];

    const value =
      Number(
        String(
          preferred.value || "0"
        ).replace(
          /,/g,
          ""
        )
      );

    if (
      Number.isFinite(value) &&
      value >= 0
    ) {
      return Math.trunc(value);
    }
  }

  const text =
    String(
      card.textContent || ""
    );

  const savedMatch =
    text.match(
      /(?:今回の船便|保存済み数量|振分数量|振り分け数量|船積数量)\s*[:：]?\s*([0-9,]+)\s*個?/
    );

  if (savedMatch) {
    return Number(
      savedMatch[1].replace(
        /,/g,
        ""
      )
    ) || 0;
  }

  return 0;
}

function deduplicateNaturalShippingAllocations(
  allocations
) {
  const map =
    new Map();

  allocations.forEach(
    function (item) {
      const key =
        `${item.scheduleId}::${item.internalCode}`;

      map.set(
        key,
        item
      );
    }
  );

  return Array.from(
    map.values()
  );
}

function rememberNaturalMainScreenStates() {
  return Array.from(
    document.querySelectorAll(
      "main > section"
    )
  ).map(
    function (section) {
      return {
        section: section,
        hidden: section.hidden
      };
    }
  );
}

function restoreNaturalMainScreenStates(
  states
) {
  states.forEach(
    function (state) {
      if (
        state &&
        state.section
      ) {
        state.section.hidden =
          state.hidden;
      }
    }
  );
}

function waitNaturalShippingRender(
  milliseconds
) {
  return new Promise(
    function (resolve) {
      window.setTimeout(
        resolve,
        milliseconds
      );
    }
  );
}

function compareNaturalShippingRows(
  left,
  right
) {
  const leftDate =
    extractNaturalShippingDate(
      left.scheduleLabel
    );

  const rightDate =
    extractNaturalShippingDate(
      right.scheduleLabel
    );

  if (
    leftDate &&
    rightDate &&
    leftDate !== rightDate
  ) {
    return leftDate.localeCompare(
      rightDate
    );
  }

  return (
    Number(
      left.scheduleOrder || 0
    ) -
    Number(
      right.scheduleOrder || 0
    )
  );
}

function extractNaturalShippingDate(
  label
) {
  const text =
    String(label || "");

  const match =
    text.match(
      /(\d{4})[\/\-年](\d{1,2})[\/\-月](\d{1,2})/
    );

  if (!match) {
    return "";
  }

  return (
    `${match[1]}-` +
    String(
      match[2]
    ).padStart(
      2,
      "0"
    ) +
    "-" +
    String(
      match[3]
    ).padStart(
      2,
      "0"
    )
  );
}

function renderNaturalShippingAnswer(
  container,
  products,
  allocations
) {
  const total =
    allocations.reduce(
      function (sum, item) {
        return (
          sum +
          Number(
            item.quantity || 0
          )
        );
      },
      0
    );

  const first =
    allocations[0];

  const mainProduct =
    first.product ||
    products[0] ||
    {};

  const article =
    document.createElement(
      "article"
    );

  article.className =
    "natural-shipping-answer-card";

  const heading =
    document.createElement(
      "h3"
    );

  heading.textContent =
    mainProduct.productName ||
    "船便情報";

  const answer =
    document.createElement(
      "p"
    );

  answer.className =
    "natural-shipping-answer-text";

  answer.textContent =
    `${mainProduct.productName || mainProduct.productCode || "この商品"}は、` +
    `${allocations.length}件の船便に合計${Number(total).toLocaleString("ja-JP")}個振り分けられています。` +
    `次の船便は「${first.scheduleLabel || "船便名未設定"}」で${Number(first.quantity).toLocaleString("ja-JP")}個です。`;

  const summary =
    document.createElement(
      "div"
    );

  summary.className =
    "natural-shipping-summary-grid";

  [
    [
      "船便数",
      `${allocations.length}件`
    ],
    [
      "船積数量合計",
      `${Number(total).toLocaleString("ja-JP")}個`
    ],
    [
      "次の船便",
      first.scheduleLabel ||
      "未設定"
    ]
  ].forEach(
    function (entry) {
      const box =
        document.createElement(
          "div"
        );

      const label =
        document.createElement(
          "span"
        );

      label.textContent =
        entry[0];

      const value =
        document.createElement(
          "strong"
        );

      value.textContent =
        entry[1];

      box.appendChild(
        label
      );

      box.appendChild(
        value
      );

      summary.appendChild(
        box
      );
    }
  );

  const list =
    document.createElement(
      "div"
    );

  list.className =
    "natural-shipping-list";

  allocations.forEach(
    function (item) {
      const row =
        document.createElement(
          "div"
        );

      row.className =
        "natural-shipping-row";

      const schedule =
        document.createElement(
          "strong"
        );

      schedule.textContent =
        item.scheduleLabel ||
        "船便名未設定";

      const quantity =
        document.createElement(
          "b"
        );

      quantity.textContent =
        `${Number(item.quantity || 0).toLocaleString("ja-JP")}個`;

      row.appendChild(
        schedule
      );

      row.appendChild(
        quantity
      );

      list.appendChild(
        row
      );
    }
  );

  article.appendChild(
    heading
  );

  article.appendChild(
    answer
  );

  article.appendChild(
    summary
  );

  article.appendChild(
    list
  );

  const actionArea =
    document.createElement(
      "div"
    );

  actionArea.className =
    "natural-relation-main-actions";

  if (
    first &&
    first.scheduleId &&
    window.shippingScheduleApp &&
    typeof window.shippingScheduleApp
      .openScheduleDetails ===
      "function"
  ) {
    const scheduleButton =
      document.createElement(
        "button"
      );

    scheduleButton.type =
      "button";

    scheduleButton.className =
      "natural-relation-primary-button";

    scheduleButton.textContent =
      "次の船便の詳細を見る";

    scheduleButton.addEventListener(
      "click",
      function () {
        void window
          .shippingScheduleApp
          .openScheduleDetails(
            first.scheduleId
          );
      }
    );

    actionArea.appendChild(
      scheduleButton
    );
  }

  if (
    mainProduct &&
    mainProduct.internalCode
  ) {
    actionArea.appendChild(
      createNaturalStockDetailButton(
        mainProduct
      )
    );
  }

  if (
    actionArea.children.length >
    0
  ) {
    article.appendChild(
      actionArea
    );
  }

  container.appendChild(
    article
  );
}

function renderNaturalShippingEmpty(
  container,
  products
) {
  const product =
    products[0] || {};

  const article =
    document.createElement(
      "article"
    );

  article.className =
    "natural-shipping-answer-card";

  const heading =
    document.createElement(
      "h3"
    );

  heading.textContent =
    product.productName ||
    "船便情報";

  const text =
    document.createElement(
      "p"
    );

  text.className =
    "natural-shipping-answer-text";

  text.textContent =
    `${product.productName || product.productCode || "この商品"}は、現在の船便に保存済みの船積数量がありません。`;

  article.appendChild(
    heading
  );

  article.appendChild(
    text
  );

  container.appendChild(
    article
  );
}

function renderNaturalShippingUnavailable(
  container
) {
  const box =
    document.createElement(
      "div"
    );

  box.className =
    "natural-stock-no-match";

  const title =
    document.createElement(
      "strong"
    );

  title.textContent =
    "船便情報を確認できませんでした";

  const text =
    document.createElement(
      "p"
    );

  text.textContent =
    "船便振り分け画面の読み込み状態を確認できませんでした。画面を更新して、もう一度検索してください。";

  box.appendChild(
    title
  );

  box.appendChild(
    text
  );

  container.appendChild(
    box
  );
}

function renderNaturalShippingNoProduct(
  container,
  query
) {
  const box =
    document.createElement(
      "div"
    );

  box.className =
    "natural-stock-no-match";

  const title =
    document.createElement(
      "strong"
    );

  title.textContent =
    "船便を検索するには";

  const text =
    document.createElement(
      "p"
    );

  text.textContent =
    `「${query}」では商品を特定できませんでした。商品コード・社内コード・JANコード・商品名のどれかを文章に入れてください。`;

  box.appendChild(
    title
  );

  box.appendChild(
    text
  );

  container.appendChild(
    box
  );
}

function isNaturalSalesPlanQuery(
  query
) {
  const normalized =
    normalizeNaturalStockText(
      query
    );

  return (
    normalized.includes(
      "販売予定"
    ) ||
    normalized.includes(
      "出荷予定"
    ) ||
    normalized.includes(
      "出荷日"
    ) ||
    normalized.includes(
      "出荷時期"
    ) ||
    normalized.includes(
      "出荷"
    )
  );
}

async function searchSalesPlanByNaturalText(
  query,
  status,
  result
) {
  if (
    typeof getAllProducts !==
      "function" ||
    typeof getAllSalesPlans !==
      "function"
  ) {
    status.textContent =
      "販売予定データを読み込む準備ができていません。画面を更新して、もう一度お試しください。";
    status.className =
      "natural-stock-search-status natural-stock-search-error";
    return;
  }

  status.textContent =
    "販売予定を検索しています…";
  status.className =
    "natural-stock-search-status";

  try {
    const data =
      await Promise.all([
        getAllProducts(),
        getAllSalesPlans()
      ]);

    const products =
      Array.isArray(data[0])
        ? data[0]
        : [];

    const plans =
      Array.isArray(data[1])
        ? data[1]
        : [];

    const productMatches =
      findNaturalStockMatches(
        products,
        query
      );

    if (
      productMatches.length === 0
    ) {
      status.textContent =
        "販売予定を調べる商品を特定できませんでした。";
      status.className =
        "natural-stock-search-status natural-stock-search-warning";

      renderNaturalSalesPlanNoProduct(
        result,
        query
      );
      return;
    }

    const internalCodes =
      new Set(
        productMatches
          .map(
            function (product) {
              return String(
                product &&
                  product.internalCode ||
                  ""
              ).trim();
            }
          )
          .filter(Boolean)
      );

    const matchingPlans =
      plans.filter(
        function (plan) {
          return internalCodes.has(
            String(
              plan &&
                plan.internalCode ||
                ""
            ).trim()
          );
        }
      );

    const today =
      getNaturalTodayIso();

    const upcomingPlans =
      matchingPlans
        .filter(
          function (plan) {
            return isNaturalSalesPlanUpcoming(
              plan,
              today
            );
          }
        )
        .sort(
          compareNaturalSalesPlans
        );

    if (
      upcomingPlans.length === 0
    ) {
      status.textContent =
        "今後の販売予定はありません。";
      status.className =
        "natural-stock-search-status natural-stock-search-success";

      renderNaturalSalesPlanEmpty(
        result,
        productMatches,
        matchingPlans.length
      );
      return;
    }

    status.textContent =
      `${upcomingPlans.length}件の販売予定が見つかりました。`;
    status.className =
      "natural-stock-search-status natural-stock-search-success";

    renderNaturalSalesPlanAnswer(
      result,
      productMatches,
      upcomingPlans
    );
  } catch (error) {
    console.error(
      "自然文販売予定検索エラー",
      error
    );

    status.textContent =
      "販売予定データを読み込めませんでした。画面を更新して、もう一度お試しください。";
    status.className =
      "natural-stock-search-status natural-stock-search-error";
  }
}

function getNaturalTodayIso() {
  const now =
    new Date();

  const year =
    now.getFullYear();

  const month =
    String(
      now.getMonth() + 1
    ).padStart(2, "0");

  const day =
    String(
      now.getDate()
    ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function isNaturalSalesPlanUpcoming(
  plan,
  today
) {
  const type =
    getNaturalSalesPlanType(
      plan
    );

  if (type === "date") {
    return (
      String(
        plan.shippingDate || ""
      ) >= today
    );
  }

  if (type === "period") {
    return (
      String(
        plan.shippingEndDate ||
        plan.shippingStartDate ||
        ""
      ) >= today
    );
  }

  if (type === "month") {
    const end =
      getNaturalMonthEnd(
        plan.shippingMonth
      );

    return end >= today;
  }

  return true;
}

function getNaturalSalesPlanType(
  plan
) {
  if (
    plan &&
    plan.shippingType ===
      "date" &&
    isNaturalIsoDate(
      plan.shippingDate
    )
  ) {
    return "date";
  }

  if (
    plan &&
    plan.shippingType ===
      "period" &&
    isNaturalIsoDate(
      plan.shippingStartDate
    ) &&
    isNaturalIsoDate(
      plan.shippingEndDate
    )
  ) {
    return "period";
  }

  if (
    plan &&
    isNaturalIsoDate(
      plan.shippingDate
    )
  ) {
    return "date";
  }

  if (
    plan &&
    isNaturalIsoDate(
      plan.shippingStartDate
    ) &&
    isNaturalIsoDate(
      plan.shippingEndDate
    )
  ) {
    return "period";
  }

  if (
    plan &&
    /^\d{4}-\d{2}$/.test(
      String(
        plan.shippingMonth || ""
      )
    )
  ) {
    return "month";
  }

  return "unknown";
}

function isNaturalIsoDate(
  value
) {
  return /^\d{4}-\d{2}-\d{2}$/.test(
    String(value || "")
  );
}

function getNaturalMonthEnd(
  month
) {
  const match =
    /^(\d{4})-(\d{2})$/.exec(
      String(month || "")
    );

  if (!match) {
    return "";
  }

  const year =
    Number(match[1]);

  const monthNumber =
    Number(match[2]);

  const lastDay =
    new Date(
      year,
      monthNumber,
      0
    ).getDate();

  return (
    `${match[1]}-${match[2]}-` +
    String(lastDay).padStart(
      2,
      "0"
    )
  );
}

function getNaturalSalesPlanSortDate(
  plan
) {
  const type =
    getNaturalSalesPlanType(
      plan
    );

  if (type === "date") {
    return String(
      plan.shippingDate || ""
    );
  }

  if (type === "period") {
    return String(
      plan.shippingStartDate || ""
    );
  }

  if (type === "month") {
    return (
      String(
        plan.shippingMonth || ""
      ) + "-01"
    );
  }

  return "9999-12-31";
}

function compareNaturalSalesPlans(
  left,
  right
) {
  const dateCompare =
    getNaturalSalesPlanSortDate(
      left
    ).localeCompare(
      getNaturalSalesPlanSortDate(
        right
      )
    );

  if (dateCompare !== 0) {
    return dateCompare;
  }

  return String(
    left &&
      left.customerName ||
      ""
  ).localeCompare(
    String(
      right &&
        right.customerName ||
        ""
    ),
    "ja"
  );
}

function formatNaturalSalesPlanDate(
  value
) {
  const match =
    /^(\d{4})-(\d{2})-(\d{2})$/.exec(
      String(value || "")
    );

  if (!match) {
    return String(value || "未設定");
  }

  return (
    `${Number(match[1])}年` +
    `${Number(match[2])}月` +
    `${Number(match[3])}日`
  );
}

function formatNaturalSalesPlanShipping(
  plan
) {
  const type =
    getNaturalSalesPlanType(
      plan
    );

  if (type === "date") {
    return formatNaturalSalesPlanDate(
      plan.shippingDate
    );
  }

  if (type === "period") {
    return (
      formatNaturalSalesPlanDate(
        plan.shippingStartDate
      ) +
      " ～ " +
      formatNaturalSalesPlanDate(
        plan.shippingEndDate
      )
    );
  }

  if (type === "month") {
    const match =
      /^(\d{4})-(\d{2})$/.exec(
        String(
          plan.shippingMonth || ""
        )
      );

    if (match) {
      return (
        `${Number(match[1])}年` +
        `${Number(match[2])}月`
      );
    }
  }

  return "日程未設定";
}

function renderNaturalSalesPlanAnswer(
  container,
  products,
  plans
) {
  const productMap =
    new Map();

  products.forEach(
    function (product) {
      const code =
        String(
          product &&
            product.internalCode ||
            ""
        ).trim();

      if (code) {
        productMap.set(
          code,
          product
        );
      }
    }
  );

  const totalQuantity =
    plans.reduce(
      function (sum, plan) {
        const quantity =
          Number(
            plan &&
              plan.quantity ||
              0
          );

        return (
          sum +
          (
            Number.isFinite(
              quantity
            )
              ? quantity
              : 0
          )
        );
      },
      0
    );

  const firstPlan =
    plans[0];

  const firstProduct =
    productMap.get(
      String(
        firstPlan.internalCode ||
        ""
      ).trim()
    ) ||
    products[0] ||
    {};

  const article =
    document.createElement(
      "article"
    );

  article.className =
    "natural-sales-plan-answer-card";

  const heading =
    document.createElement(
      "h3"
    );

  heading.textContent =
    products.length === 1
      ? (
          firstProduct.productName ||
          firstPlan.productName ||
          "販売予定"
        )
      : "販売予定";

  const answer =
    document.createElement(
      "p"
    );

  answer.className =
    "natural-sales-plan-answer-text";

  const productLabel =
    products.length === 1
      ? (
          firstProduct.productName ||
          firstPlan.productName ||
          firstPlan.internalCode ||
          "この商品"
        )
      : `${products.length}商品`;

  const nearest =
    plans[0];

  answer.textContent =
    `${productLabel}の今後の販売予定は${plans.length}件、合計${Number(totalQuantity).toLocaleString("ja-JP")}個です。` +
    `最も近い予定は${formatNaturalSalesPlanShipping(nearest)}、` +
    `${nearest.customerName || "取引先未登録"}へ${Number(nearest.quantity || 0).toLocaleString("ja-JP")}個です。`;

  const summary =
    document.createElement(
      "div"
    );

  summary.className =
    "natural-sales-plan-summary-grid";

  [
    [
      "販売予定",
      `${plans.length}件`
    ],
    [
      "予定数量合計",
      `${Number(totalQuantity).toLocaleString("ja-JP")}個`
    ],
    [
      "一番近い日程",
      formatNaturalSalesPlanShipping(
        nearest
      )
    ]
  ].forEach(
    function (entry) {
      const box =
        document.createElement(
          "div"
        );

      const label =
        document.createElement(
          "span"
        );

      label.textContent =
        entry[0];

      const value =
        document.createElement(
          "strong"
        );

      value.textContent =
        entry[1];

      box.appendChild(
        label
      );

      box.appendChild(
        value
      );

      summary.appendChild(
        box
      );
    }
  );

  const list =
    document.createElement(
      "div"
    );

  list.className =
    "natural-sales-plan-list";

  plans.forEach(
    function (plan) {
      const product =
        productMap.get(
          String(
            plan.internalCode ||
            ""
          ).trim()
        ) || {};

      const row =
        document.createElement(
          "div"
        );

      row.className =
        "natural-sales-plan-row";

      const top =
        document.createElement(
          "div"
        );

      top.className =
        "natural-sales-plan-row-top";

      const date =
        document.createElement(
          "strong"
        );

      date.textContent =
        formatNaturalSalesPlanShipping(
          plan
        );

      const quantity =
        document.createElement(
          "b"
        );

      quantity.textContent =
        `${Number(plan.quantity || 0).toLocaleString("ja-JP")}個`;

      top.appendChild(
        date
      );

      top.appendChild(
        quantity
      );

      const customer =
        document.createElement(
          "p"
        );

      customer.textContent =
        `取引先：${plan.customerName || "未登録"}`;

      const productLine =
        document.createElement(
          "p"
        );

      productLine.textContent =
        `商品：${product.productName || plan.productName || "未登録"}（${plan.productCode || plan.internalCode || "コード未登録"}）`;

      row.appendChild(
        top
      );

      row.appendChild(
        customer
      );

      row.appendChild(
        productLine
      );

      list.appendChild(
        row
      );
    }
  );

  article.appendChild(
    heading
  );

  article.appendChild(
    answer
  );

  article.appendChild(
    summary
  );

  article.appendChild(
    list
  );

  container.appendChild(
    article
  );
}

function renderNaturalSalesPlanEmpty(
  container,
  products,
  pastCount
) {
  const box =
    document.createElement(
      "article"
    );

  box.className =
    "natural-sales-plan-answer-card";

  const title =
    document.createElement(
      "h3"
    );

  title.textContent =
    products.length === 1
      ? (
          products[0].productName ||
          "販売予定"
        )
      : "販売予定";

  const text =
    document.createElement(
      "p"
    );

  text.className =
    "natural-sales-plan-answer-text";

  text.textContent =
    "本日以降の販売予定は登録されていません。";

  box.appendChild(
    title
  );

  box.appendChild(
    text
  );

  if (pastCount > 0) {
    const note =
      document.createElement(
        "p"
      );

    note.className =
      "natural-sales-plan-past-note";

    note.textContent =
      `過去の日程を含む販売予定データは${pastCount}件あります。`;

    box.appendChild(
      note
    );
  }

  container.appendChild(
    box
  );
}

function renderNaturalSalesPlanNoProduct(
  container,
  query
) {
  const box =
    document.createElement(
      "div"
    );

  box.className =
    "natural-stock-no-match";

  const title =
    document.createElement(
      "strong"
    );

  title.textContent =
    "販売予定を検索するには";

  const text =
    document.createElement(
      "p"
    );

  text.textContent =
    `「${query}」では商品を特定できませんでした。商品コード・社内コード・JANコード・商品名のどれかを文章に入れてください。`;

  box.appendChild(
    title
  );

  box.appendChild(
    text
  );

  container.appendChild(
    box
  );
}

function renderNaturalStockAnswer(
  container,
  product
) {
  const unit =
    getNaturalStockUnit(
      product
    );

  const total =
    getNaturalStockNumber(
      product &&
        product.stock
    );

  const locations =
    getNaturalStockLocations(
      product
    );

  const answerCard =
    document.createElement(
      "article"
    );

  answerCard.className =
    "natural-stock-answer-card";

  const heading =
    document.createElement("h3");

  heading.textContent =
    product.productName ||
    "商品名未登録";

  const answer =
    document.createElement("p");

  answer.className =
    "natural-stock-answer-text";

  answer.textContent =
    buildNaturalStockAnswerText(
      product,
      total,
      unit,
      locations
    );

  answerCard.appendChild(
    heading
  );

  answerCard.appendChild(
    answer
  );

  answerCard.appendChild(
    createNaturalStockSummary(
      product,
      total,
      unit
    )
  );

  answerCard.appendChild(
    createNaturalStockLocationList(
      locations,
      unit
    )
  );

  answerCard.appendChild(
    createNaturalStockDetailButton(
      product
    )
  );

  container.appendChild(
    answerCard
  );
}

function buildNaturalStockAnswerText(
  product,
  total,
  unit,
  locations
) {
  const name =
    product.productName ||
    "この商品";

  const code =
    product.productCode ||
    product.internalCode ||
    "";

  const codeText =
    code
      ? `（${code}）`
      : "";

  if (total <= 0) {
    const primary =
      locations.find(
        function (entry) {
          return entry.location;
        }
      );

    if (primary) {
      return (
        `${name}${codeText}の合計在庫は0${unit}です。` +
        `現在は在庫切れです。保管場所は${primary.location}です。`
      );
    }

    return (
      `${name}${codeText}の合計在庫は0${unit}です。` +
      "現在は在庫切れです。"
    );
  }

  const positiveLocations =
    locations.filter(
      function (entry) {
        return entry.stock > 0;
      }
    );

  if (
    positiveLocations.length === 0
  ) {
    return (
      `${name}${codeText}の合計在庫は` +
      `${formatNaturalStockNumber(total)}${unit}です。`
    );
  }

  const locationText =
    positiveLocations
      .map(
        function (entry) {
          return (
            `${entry.location}に` +
            `${formatNaturalStockNumber(entry.stock)}${unit}`
          );
        }
      )
      .join("、");

  return (
    `${name}${codeText}の合計在庫は` +
    `${formatNaturalStockNumber(total)}${unit}です。` +
    `${locationText}あります。`
  );
}

function createNaturalStockSummary(
  product,
  total,
  unit
) {
  const wrapper =
    document.createElement("div");

  wrapper.className =
    "natural-stock-summary-grid";

  const values = [
    [
      "社内コード",
      product.internalCode ||
        "未登録"
    ],
    [
      "商品コード",
      product.productCode ||
        "未登録"
    ],
    [
      "合計在庫",
      `${formatNaturalStockNumber(
        total
      )}${unit}`
    ]
  ];

  values.forEach(
    function (entry) {
      const box =
        document.createElement(
          "div"
        );

      const label =
        document.createElement(
          "span"
        );

      label.textContent =
        entry[0];

      const value =
        document.createElement(
          "strong"
        );

      value.textContent =
        entry[1];

      box.appendChild(label);
      box.appendChild(value);
      wrapper.appendChild(box);
    }
  );

  return wrapper;
}

function createNaturalStockLocationList(
  locations,
  unit
) {
  const wrapper =
    document.createElement("div");

  wrapper.className =
    "natural-stock-location-area";

  const title =
    document.createElement("h4");

  title.textContent =
    "場所別在庫";

  wrapper.appendChild(title);

  if (locations.length === 0) {
    const empty =
      document.createElement("p");

    empty.textContent =
      "場所別在庫は登録されていません。";

    wrapper.appendChild(empty);
    return wrapper;
  }

  const list =
    document.createElement("div");

  list.className =
    "natural-stock-location-list";

  locations.forEach(
    function (entry) {
      const row =
        document.createElement(
          "div"
        );

      const location =
        document.createElement(
          "span"
        );

      location.textContent =
        entry.location ||
        "未確認";

      const quantity =
        document.createElement(
          "strong"
        );

      quantity.textContent =
        `${formatNaturalStockNumber(
          entry.stock
        )}${unit}`;

      row.appendChild(location);
      row.appendChild(quantity);
      list.appendChild(row);
    }
  );

  wrapper.appendChild(list);
  return wrapper;
}

function getNaturalStockLocations(
  product
) {
  const saved =
    product &&
    Array.isArray(
      product.locationStocks
    )
      ? product.locationStocks
      : [];

  if (saved.length > 0) {
    return saved.map(
      function (entry) {
        return {
          location:
            String(
              entry &&
                entry.location ||
                ""
            ).trim() ||
            "未確認",
          stock:
            getNaturalStockNumber(
              entry &&
                entry.stock
            )
        };
      }
    );
  }

  const location =
    String(
      product &&
        product.location ||
        ""
    ).trim();

  if (
    location ||
    getNaturalStockNumber(
      product &&
        product.stock
    ) > 0
  ) {
    return [
      {
        location:
          location ||
          "未確認",
        stock:
          getNaturalStockNumber(
            product &&
              product.stock
          )
      }
    ];
  }

  return [];
}

function getNaturalStockUnit(
  product
) {
  const unit =
    String(
      product &&
        product.unit ||
        ""
    ).trim();

  if (
    !unit ||
    unit === "その他"
  ) {
    return "個";
  }

  return unit;
}

function getNaturalStockNumber(
  value
) {
  const number =
    Number(value);

  if (!Number.isFinite(number)) {
    return 0;
  }

  return Math.max(
    0,
    Math.trunc(number)
  );
}

function formatNaturalStockNumber(
  value
) {
  return getNaturalStockNumber(
    value
  ).toLocaleString(
    "ja-JP"
  );
}

function createNaturalStockDetailButton(
  product
) {
  const button =
    document.createElement("button");

  button.type = "button";
  button.className =
    "natural-stock-detail-button";
  button.textContent =
    "商品詳細を見る";

  button.addEventListener(
    "click",
    function () {
      const screen =
        document.querySelector(
          "#natural-stock-search-screen"
        );

      if (screen) {
        screen.hidden = true;
      }

      if (
        window.inventoryApp &&
        typeof window.inventoryApp
          .openDetailScreen ===
          "function"
      ) {
        window.inventoryApp
          .openDetailScreen(
            product.internalCode
          );
      }
    }
  );

  return button;
}

function renderNaturalStockCandidates(
  container,
  products,
  statusElement
) {
  const intro =
    document.createElement("div");

  intro.className =
    "natural-stock-candidate-intro";
  intro.textContent =
    "同じコード・JAN・商品名などに複数の商品が該当しました。確認したい商品を選んでください。";

  container.appendChild(
    intro
  );

  products
    .slice(0, 30)
    .forEach(
      function (product) {
        const unit =
          getNaturalStockUnit(
            product
          );

        const card =
          document.createElement(
            "article"
          );

        card.className =
          "natural-stock-candidate-card";

        const info =
          document.createElement(
            "div"
          );

        const title =
          document.createElement(
            "strong"
          );

        title.textContent =
          product.productName ||
          "商品名未登録";

        const meta =
          document.createElement(
            "span"
          );

        meta.textContent =
          `社内コード：${
            product.internalCode ||
            "未登録"
          } / 商品コード：${
            product.productCode ||
            "未登録"
          }`;

        const stock =
          document.createElement(
            "b"
          );

        stock.textContent =
          `合計在庫：${formatNaturalStockNumber(
            product.stock
          )}${unit}`;

        info.appendChild(title);
        info.appendChild(meta);
        info.appendChild(stock);

        const button =
          document.createElement(
            "button"
          );

        button.type = "button";
        button.textContent =
          "この商品の在庫を見る";

        button.addEventListener(
          "click",
          function () {
            container.innerHTML =
              "";

            renderNaturalStockAnswer(
              container,
              product
            );

            if (statusElement) {
              statusElement.hidden =
                false;
              statusElement.textContent =
                "商品を選択しました。";
              statusElement.className =
                "natural-stock-search-status natural-stock-search-success";
            }

            window.scrollTo({
              top:
                container
                  .getBoundingClientRect()
                  .top +
                window.scrollY -
                20,
              behavior:
                "smooth"
            });
          }
        );

        card.appendChild(info);
        card.appendChild(button);
        container.appendChild(card);
      }
    );
}

function renderNaturalStockNoMatch(
  container,
  query
) {
  const box =
    document.createElement("div");

  box.className =
    "natural-stock-no-match";

  const title =
    document.createElement(
      "strong"
    );

  title.textContent =
    "検索のヒント";

  const text =
    document.createElement("p");

  text.textContent =
    `「${query}」では商品を特定できませんでした。社内コード・商品コード・JANコードを文章に入れると、より確実に検索できます。`;

  box.appendChild(title);
  box.appendChild(text);
  container.appendChild(box);
}

function createNaturalRelationSearchStyle() {
  if (
    document.querySelector(
      "#natural-relation-search-style"
    )
  ) {
    return;
  }

  const style =
    document.createElement(
      "style"
    );

  style.id =
    "natural-relation-search-style";

  style.textContent = `
    .natural-shipping-relation-card,
    .natural-relation-candidates {
      margin-top: 14px;
      padding: 18px;
      border: 2px solid #90caf9;
      border-radius: 14px;
      background: #ffffff;
    }

    .natural-relation-heading {
      display: grid;
      gap: 6px;
      margin-bottom: 14px;
    }

    .natural-relation-heading h3,
    .natural-relation-candidates h3 {
      margin: 0;
      color: #0d47a1;
      font-size: 22px;
    }

    .natural-relation-heading p {
      margin: 0;
      font-size: 16px;
      line-height: 1.6;
    }

    .natural-relation-summary-grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 10px;
      margin: 14px 0;
    }

    .natural-relation-summary-grid > div {
      display: grid;
      gap: 5px;
      padding: 12px;
      border: 1px solid #bbdefb;
      border-radius: 10px;
      background: #f4faff;
    }

    .natural-relation-summary-grid span {
      color: #546e7a;
      font-size: 13px;
    }

    .natural-relation-summary-grid strong {
      color: #0d47a1;
      font-size: 17px;
    }

    .natural-relation-period {
      margin: 12px 0 16px;
      padding: 12px 14px;
      border-radius: 10px;
      background: #fff8e1;
      color: #5d4037;
      font-weight: 700;
      line-height: 1.6;
    }

    .natural-relation-main-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin: 12px 0 16px;
    }

    .natural-relation-main-actions button {
      min-height: 46px;
      margin: 0;
      padding: 10px 16px;
      font-weight: 800;
    }

    .natural-relation-primary-button {
      background: #1565c0 !important;
    }

    .natural-relation-products {
      display: grid;
      gap: 10px;
    }

    .natural-relation-products h4 {
      margin: 6px 0 2px;
      font-size: 18px;
      color: #263238;
    }

    .natural-relation-product-card {
      display: grid;
      gap: 10px;
      padding: 14px;
      border: 1px solid #cfd8dc;
      border-radius: 11px;
      background: #fafcfd;
    }

    .natural-relation-product-head {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 12px;
      align-items: start;
    }

    .natural-relation-product-head > div {
      display: grid;
      gap: 4px;
      min-width: 0;
    }

    .natural-relation-product-head strong {
      font-size: 16px;
    }

    .natural-relation-product-head span {
      color: #607d8b;
      font-size: 13px;
      line-height: 1.5;
    }

    .natural-relation-ship-quantity {
      color: #6a1b9a;
      white-space: nowrap;
      font-size: 17px !important;
    }

    .natural-relation-plan-summary {
      padding: 8px 10px;
      border-radius: 8px;
      background: #e8f5e9;
      color: #1b5e20;
      font-weight: 700;
    }

    .natural-relation-plan-list {
      display: grid;
      gap: 5px;
      padding: 8px 10px;
      border-left: 4px solid #81c784;
      background: #ffffff;
      line-height: 1.5;
    }

    .natural-relation-product-detail-button {
      justify-self: start;
      min-height: 42px !important;
      margin: 0 !important;
    }

    .natural-relation-empty,
    .natural-relation-more {
      margin: 0;
      padding: 12px;
      border-radius: 9px;
      background: #f5f5f5;
      line-height: 1.6;
    }

    .natural-relation-candidates {
      display: grid;
      gap: 10px;
    }

    .natural-relation-candidate-card {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 12px;
      align-items: center;
      padding: 13px;
      border: 1px solid #bbdefb;
      border-radius: 10px;
      background: #f8fcff;
    }

    .natural-relation-candidate-card > div {
      display: grid;
      gap: 5px;
    }

    .natural-relation-candidate-card span {
      color: #607d8b;
      line-height: 1.5;
    }

    .natural-relation-candidate-card button {
      margin: 0;
      min-height: 42px;
      background: #1976d2;
    }

    @media (max-width: 760px) {
      .natural-relation-summary-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .natural-relation-product-head,
      .natural-relation-candidate-card {
        grid-template-columns: 1fr;
      }

      .natural-relation-ship-quantity {
        white-space: normal;
      }

      .natural-relation-candidate-card button,
      .natural-relation-product-detail-button,
      .natural-relation-main-actions button {
        width: 100%;
      }
    }
  `;

  document.head.appendChild(
    style
  );
}

function createNaturalMonthlyAverageStyle() {
  if (
    document.querySelector(
      "#natural-monthly-average-style"
    )
  ) {
    return;
  }

  const style =
    document.createElement("style");

  style.id =
    "natural-monthly-average-style";

  style.textContent = `
    .natural-monthly-average-card {
      padding: 20px;
      border: 2px solid #26a69a;
      border-radius: 16px;
      background: #ffffff;
    }

    .natural-monthly-average-card h3 {
      margin: 0 0 12px;
      color: #00695c;
      font-size: 24px;
    }

    .natural-monthly-average-answer {
      margin: 0 0 16px;
      padding: 16px;
      border-left: 5px solid #00897b;
      border-radius: 8px;
      background: #e0f2f1;
      color: #004d40;
      font-size: 21px;
      font-weight: 800;
      line-height: 1.7;
    }

    .natural-monthly-average-summary {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 10px;
      margin-bottom: 12px;
    }

    .natural-monthly-average-summary > div {
      padding: 12px;
      border: 1px solid #b2dfdb;
      border-radius: 10px;
      background: #f6fffd;
    }

    .natural-monthly-average-summary span,
    .natural-monthly-average-summary strong {
      display: block;
    }

    .natural-monthly-average-summary span {
      margin-bottom: 5px;
      color: #607d8b;
      font-size: 13px;
    }

    .natural-monthly-average-summary strong {
      color: #00695c;
      font-size: 17px;
      overflow-wrap: anywhere;
    }

    .natural-monthly-average-period,
    .natural-monthly-average-note,
    .natural-monthly-average-excluded {
      margin: 12px 0;
      padding: 11px 13px;
      border-radius: 9px;
      line-height: 1.65;
    }

    .natural-monthly-average-period {
      background: #e8f5e9;
      color: #1b5e20;
      font-weight: 800;
    }

    .natural-monthly-average-note {
      background: #fff8e1;
      color: #5d4037;
      font-weight: 700;
    }

    .natural-monthly-average-excluded {
      background: #f3e5f5;
      color: #6a1b9a;
      font-weight: 700;
    }

    .natural-monthly-average-breakdown {
      display: grid;
      gap: 6px;
      margin: 14px 0;
    }

    .natural-monthly-average-breakdown h4 {
      margin: 0 0 4px;
      color: #00695c;
      font-size: 18px;
    }

    .natural-monthly-average-breakdown > div {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 9px 12px;
      border-bottom: 1px solid #e0e0e0;
      background: #fafafa;
    }

    .natural-monthly-average-breakdown strong {
      color: #00695c;
      font-size: 17px;
    }

    @media (max-width: 760px) {
      .natural-monthly-average-summary {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }
  `;

  document.head.appendChild(style);
}

function createNaturalStockSearchStyle() {
  if (
    document.querySelector(
      "#natural-stock-search-style"
    )
  ) {
    return;
  }

  const style =
    document.createElement("style");

  style.id =
    "natural-stock-search-style";

  style.textContent = `
    .home-natural-stock-search {
      margin: 16px 0 18px;
      padding: 16px 18px;
      border: 2px solid #64b5f6;
      border-radius: 14px;
      background: #f7fbff;
      box-shadow: 0 5px 16px rgba(25, 118, 210, 0.08);
    }

    .home-natural-stock-search-heading {
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      gap: 18px;
      margin-bottom: 12px;
    }

    .home-natural-stock-search-heading h3 {
      margin: 2px 0 0;
      color: #0d47a1;
      font-size: 20px;
    }

    .home-natural-stock-search-heading p {
      margin: 0;
      color: #607d8b;
      text-align: right;
    }

    .home-natural-stock-search-kicker {
      display: block;
      color: #1976d2;
      font-size: 12px;
      font-weight: 800;
    }

    .home-natural-stock-search-input-row {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 150px;
      gap: 10px;
    }

    #home-natural-stock-search-input {
      width: 100%;
      min-height: 54px;
      box-sizing: border-box;
      margin: 0;
      padding: 10px 14px;
      border: 2px solid #90a4ae;
      border-radius: 10px;
      background: #ffffff;
      font-size: 18px;
    }

    #home-natural-stock-search-input:focus {
      border-color: #1976d2;
      outline: 3px solid rgba(25, 118, 210, 0.14);
    }

    #home-natural-stock-search-submit {
      min-height: 54px;
      margin: 0;
      padding: 10px 16px;
      border: 0;
      border-radius: 10px;
      background: #1976d2;
      color: #ffffff;
      font-size: 17px;
      font-weight: 800;
      cursor: pointer;
    }

    .home-natural-stock-search-status {
      margin-top: 12px;
      margin-bottom: 10px;
    }

    .home-natural-stock-search-result:empty {
      display: none;
    }

    #natural-stock-search-screen {
      max-width: 980px;
      margin: 22px auto;
      padding: 26px;
      background: #ffffff;
      border: 1px solid #d5e2ec;
      border-radius: 16px;
      box-shadow: 0 8px 24px rgba(32, 62, 84, 0.08);
    }

    #natural-stock-search-screen[hidden] {
      display: none !important;
    }

    .natural-stock-search-heading {
      margin-bottom: 20px;
      padding-bottom: 15px;
      border-bottom: 3px solid #90caf9;
    }

    .natural-stock-search-kicker {
      display: inline-block;
      margin-bottom: 6px;
      color: #607d8b;
      font-weight: 700;
    }

    .natural-stock-search-heading h2 {
      margin: 0 0 8px;
      color: #0d47a1;
    }

    .natural-stock-search-heading p {
      margin: 0;
      color: #546e7a;
    }

    #natural-stock-search-form {
      padding: 18px;
      border: 2px solid #90caf9;
      border-radius: 14px;
      background: #f7fbff;
    }

    #natural-stock-search-form label {
      display: block;
      margin-bottom: 8px;
      color: #0d47a1;
      font-size: 18px;
      font-weight: 800;
    }

    .natural-stock-search-input-row {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 10px;
    }

    #natural-stock-search-input {
      width: 100%;
      min-height: 54px;
      box-sizing: border-box;
      margin: 0;
      padding: 10px 14px;
      border: 2px solid #b0bec5;
      border-radius: 10px;
      background: #ffffff;
      font-size: 18px;
    }

    #natural-stock-search-input:focus {
      border-color: #1976d2;
      outline: 3px solid rgba(25, 118, 210, 0.15);
    }

    #natural-stock-search-submit {
      min-width: 130px;
      margin: 0;
      padding: 10px 18px;
      border: 0;
      border-radius: 10px;
      background: #1976d2;
      color: #ffffff;
      font-size: 17px;
      font-weight: 800;
    }

    .natural-stock-search-help {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin: 12px 0;
      padding: 12px 14px;
      border-radius: 10px;
      background: #eef7fd;
      color: #455a64;
    }

    .natural-stock-search-help strong {
      color: #0d47a1;
    }

    .natural-stock-search-help span:not(:last-child)::after {
      content: " /";
      color: #90a4ae;
    }

    .natural-stock-search-status {
      margin: 14px 0;
      padding: 12px 14px;
      border-radius: 10px;
      background: #eceff1;
      color: #37474f;
      font-weight: 700;
    }

    .natural-stock-search-success {
      background: #e8f5e9;
      color: #1b5e20;
    }

    .natural-stock-search-warning {
      background: #fff8e1;
      color: #e65100;
    }

    .natural-stock-search-error {
      background: #ffebee;
      color: #b71c1c;
    }

    .natural-summary-title-card {
      margin-bottom: 14px;
      padding: 18px 20px;
      border: 2px solid #1976d2;
      border-radius: 16px;
      background: #f7fbff;
    }

    .natural-summary-kicker {
      display: inline-block;
      margin-bottom: 5px;
      color: #1976d2;
      font-size: 13px;
      font-weight: 800;
    }

    .natural-summary-title-card h3 {
      margin: 0 0 7px;
      color: #0d47a1;
      font-size: 25px;
    }

    .natural-summary-meta {
      margin: 0 0 10px;
      color: #607d8b;
      font-size: 14px;
    }

    .natural-summary-title-text {
      margin: 0;
      padding: 12px 14px;
      border-radius: 10px;
      background: #e3f2fd;
      color: #0d47a1;
      font-size: 17px;
      font-weight: 800;
      line-height: 1.7;
    }

    .natural-summary-section {
      margin-top: 14px;
      padding: 14px;
      border: 1px solid #cfd8dc;
      border-radius: 14px;
      background: #ffffff;
    }

    .natural-summary-section > h4 {
      margin: 0 0 10px;
      font-size: 20px;
    }

    .natural-summary-stock-section > h4 {
      color: #2e7d32;
    }

    .natural-summary-sales-section > h4 {
      color: #ef6c00;
    }

    .natural-summary-shipping-section > h4 {
      color: #6a1b9a;
    }

    .natural-summary-section .natural-stock-answer-card,
    .natural-summary-section .natural-sales-plan-answer-card,
    .natural-summary-section .natural-shipping-answer-card {
      border-width: 1px;
      box-shadow: none;
    }

    .natural-summary-unavailable {
      padding: 14px;
      border-radius: 10px;
      background: #eceff1;
      color: #546e7a;
      font-weight: 700;
    }

    .natural-shipping-answer-card {
      padding: 20px;
      border: 2px solid #7e57c2;
      border-radius: 16px;
      background: #ffffff;
    }

    .natural-shipping-answer-card h3 {
      margin: 0 0 12px;
      color: #4527a0;
      font-size: 24px;
    }

    .natural-shipping-answer-text {
      margin: 0 0 16px;
      padding: 16px;
      border-left: 5px solid #6a1b9a;
      border-radius: 8px;
      background: #f3e5f5;
      color: #4a148c;
      font-size: 19px;
      font-weight: 800;
      line-height: 1.7;
    }

    .natural-shipping-summary-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 10px;
      margin-bottom: 16px;
    }

    .natural-shipping-summary-grid > div {
      padding: 12px;
      border: 1px solid #d1c4e9;
      border-radius: 10px;
      background: #faf7ff;
    }

    .natural-shipping-summary-grid span,
    .natural-shipping-summary-grid strong {
      display: block;
    }

    .natural-shipping-summary-grid span {
      margin-bottom: 5px;
      color: #7e57c2;
      font-size: 13px;
    }

    .natural-shipping-summary-grid strong {
      color: #4527a0;
      font-size: 17px;
      overflow-wrap: anywhere;
    }

    .natural-shipping-list {
      display: grid;
      gap: 10px;
    }

    .natural-shipping-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 14px;
      padding: 13px 14px;
      border: 1px solid #d1c4e9;
      border-radius: 10px;
      background: #fcfaff;
    }

    .natural-shipping-row strong {
      color: #4527a0;
      overflow-wrap: anywhere;
    }

    .natural-shipping-row b {
      flex: 0 0 auto;
      color: #6a1b9a;
      font-size: 19px;
    }

    .natural-sales-plan-answer-card {
      padding: 20px;
      border: 2px solid #ffb74d;
      border-radius: 16px;
      background: #ffffff;
    }

    .natural-sales-plan-answer-card h3 {
      margin: 0 0 12px;
      color: #6d4c41;
      font-size: 24px;
    }

    .natural-sales-plan-answer-text {
      margin: 0 0 16px;
      padding: 16px;
      border-left: 5px solid #ef6c00;
      border-radius: 8px;
      background: #fff8e1;
      color: #e65100;
      font-size: 19px;
      font-weight: 800;
      line-height: 1.7;
    }

    .natural-sales-plan-summary-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 10px;
      margin-bottom: 16px;
    }

    .natural-sales-plan-summary-grid > div {
      padding: 12px;
      border: 1px solid #ffe0b2;
      border-radius: 10px;
      background: #fffaf3;
    }

    .natural-sales-plan-summary-grid span,
    .natural-sales-plan-summary-grid strong {
      display: block;
    }

    .natural-sales-plan-summary-grid span {
      margin-bottom: 5px;
      color: #8d6e63;
      font-size: 13px;
    }

    .natural-sales-plan-summary-grid strong {
      color: #6d4c41;
      font-size: 17px;
      overflow-wrap: anywhere;
    }

    .natural-sales-plan-list {
      display: grid;
      gap: 10px;
    }

    .natural-sales-plan-row {
      padding: 14px;
      border: 1px solid #ffcc80;
      border-radius: 10px;
      background: #fffdf9;
    }

    .natural-sales-plan-row-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 8px;
    }

    .natural-sales-plan-row-top strong {
      color: #6d4c41;
      font-size: 17px;
    }

    .natural-sales-plan-row-top b {
      color: #e65100;
      font-size: 19px;
    }

    .natural-sales-plan-row p {
      margin: 4px 0 0;
      color: #455a64;
    }

    .natural-sales-plan-past-note {
      margin: 12px 0 0;
      color: #607d8b;
      font-weight: 700;
    }

    .natural-stock-answer-card {
      padding: 20px;
      border: 2px solid #64b5f6;
      border-radius: 16px;
      background: #ffffff;
    }

    .natural-stock-answer-card h3 {
      margin: 0 0 12px;
      color: #102a43;
      font-size: 24px;
    }

    .natural-stock-answer-text {
      margin: 0 0 16px;
      padding: 16px;
      border-left: 5px solid #2e7d32;
      border-radius: 8px;
      background: #f1f8e9;
      color: #1b5e20;
      font-size: 20px;
      font-weight: 800;
      line-height: 1.7;
    }

    .natural-stock-summary-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 10px;
      margin-bottom: 16px;
    }

    .natural-stock-summary-grid > div {
      padding: 12px;
      border: 1px solid #cfd8dc;
      border-radius: 10px;
      background: #f8fafb;
    }

    .natural-stock-summary-grid span,
    .natural-stock-summary-grid strong {
      display: block;
    }

    .natural-stock-summary-grid span {
      margin-bottom: 5px;
      color: #607d8b;
      font-size: 13px;
    }

    .natural-stock-summary-grid strong {
      color: #102a43;
      font-size: 18px;
      overflow-wrap: anywhere;
    }

    .natural-stock-location-area {
      margin: 12px 0 18px;
      padding: 14px;
      border: 1px solid #cfd8dc;
      border-radius: 12px;
      background: #fbfdfe;
    }

    .natural-stock-location-area h4 {
      margin: 0 0 10px;
      color: #455a64;
    }

    .natural-stock-location-list {
      display: grid;
      gap: 8px;
    }

    .natural-stock-location-list > div {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 10px 12px;
      border-radius: 8px;
      background: #eef5fa;
    }

    .natural-stock-location-list strong {
      color: #0d47a1;
      font-size: 18px;
    }

    .natural-stock-detail-button,
    .natural-stock-search-back-button,
    .natural-stock-candidate-card button {
      min-height: 48px;
      border: 0;
      border-radius: 10px;
      color: #ffffff;
      font-size: 16px;
      font-weight: 800;
      cursor: pointer;
    }

    .natural-stock-detail-button {
      width: 100%;
      background: #1976d2;
    }

    .natural-stock-search-back-button {
      width: 100%;
      margin-top: 18px;
      background: #546e7a;
    }

    .natural-stock-candidate-intro,
    .natural-stock-no-match {
      margin-bottom: 12px;
      padding: 14px;
      border: 1px solid #ffcc80;
      border-radius: 10px;
      background: #fff8e1;
      color: #6d4c41;
    }

    .natural-stock-candidate-card {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 14px;
      align-items: center;
      margin-bottom: 10px;
      padding: 14px;
      border: 1px solid #cfd8dc;
      border-left: 5px solid #1976d2;
      border-radius: 10px;
      background: #ffffff;
    }

    .natural-stock-candidate-card > div {
      min-width: 0;
    }

    .natural-stock-candidate-card strong,
    .natural-stock-candidate-card span,
    .natural-stock-candidate-card b {
      display: block;
    }

    .natural-stock-candidate-card strong {
      margin-bottom: 5px;
      color: #102a43;
      font-size: 18px;
    }

    .natural-stock-candidate-card span {
      margin-bottom: 5px;
      color: #607d8b;
      overflow-wrap: anywhere;
    }

    .natural-stock-candidate-card b {
      color: #0d47a1;
    }

    .natural-stock-candidate-card button {
      margin: 0;
      padding: 10px 14px;
      background: #1976d2;
    }

    @media (max-width: 700px) {
      .home-natural-stock-search {
        margin: 14px 0 16px;
        padding: 15px;
      }

      .home-natural-stock-search-heading {
        display: block;
      }

      .home-natural-stock-search-heading h3 {
        font-size: 22px;
      }

      .home-natural-stock-search-heading p {
        margin-top: 7px;
        text-align: left;
        font-size: 14px;
      }

      .home-natural-stock-search-input-row {
        grid-template-columns: 1fr;
      }

      #home-natural-stock-search-input {
        min-height: 60px;
        font-size: 19px;
      }

      #home-natural-stock-search-submit {
        width: 100%;
        min-height: 58px;
        font-size: 19px;
      }

      #natural-stock-search-screen {
        margin: 12px;
        padding: 16px;
      }

      .natural-stock-search-input-row {
        grid-template-columns: 1fr;
      }

      #natural-stock-search-input {
        min-height: 58px;
        font-size: 19px;
      }

      #natural-stock-search-submit {
        width: 100%;
        min-height: 54px;
      }

      .natural-stock-search-help {
        display: grid;
      }

      .natural-stock-search-help span:not(:last-child)::after {
        content: "";
      }

      .natural-summary-title-card {
        padding: 16px;
      }

      .natural-summary-title-card h3 {
        font-size: 22px;
      }

      .natural-summary-title-text {
        font-size: 16px;
      }

      .natural-summary-section {
        padding: 10px;
      }

      .natural-shipping-answer-card h3 {
        font-size: 22px;
      }

      .natural-shipping-answer-text {
        font-size: 18px;
      }

      .natural-shipping-summary-grid {
        grid-template-columns: 1fr;
      }

      .natural-shipping-row {
        align-items: flex-start;
      }

      .natural-sales-plan-answer-card h3 {
        font-size: 22px;
      }

      .natural-sales-plan-answer-text {
        font-size: 18px;
      }

      .natural-sales-plan-summary-grid {
        grid-template-columns: 1fr;
      }

      .natural-sales-plan-row-top {
        align-items: flex-start;
      }

      .natural-stock-answer-card h3 {
        font-size: 22px;
      }

      .natural-stock-answer-text {
        font-size: 18px;
      }

      .natural-stock-summary-grid {
        grid-template-columns: 1fr;
      }

      .natural-stock-candidate-card {
        grid-template-columns: 1fr;
      }

      .natural-stock-candidate-card button {
        width: 100%;
      }
    }
  `;

  document.head.appendChild(
    style
  );
}


/* v192 月別販売数（直近1年）表示 */
(function addNaturalMonthlyAverageV192Style() {
  if (document.getElementById("natural-monthly-average-v192-style")) {
    return;
  }

  const style = document.createElement("style");
  style.id = "natural-monthly-average-v192-style";
  style.textContent = `
    .natural-monthly-average-breakdown-period {
      margin: -4px 0 10px;
      color: #5c6b73;
      font-size: 0.92rem;
      font-weight: 700;
    }
  `;
  document.head.appendChild(style);
})();
