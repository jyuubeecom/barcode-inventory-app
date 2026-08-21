"use strict";

/* =========================================================
   v136 自然文検索（在庫・販売予定）
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

    const matches =
      findNaturalStockMatches(
        products,
        query
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
      /(販売予定|出荷予定|出荷時期|出荷日|出荷|販売|予定|現在庫数|現在庫|合計在庫数|合計在庫|在庫数|場所別在庫|在庫|保管場所|どこに|どこ|いつ|何個|何本|何箱|何枚|何台|何袋|何セット|いくつ|ありますか|あるの|ある|教えてください|教えて|知りたい|確認したい|検索して|検索|商品コード|社内コード|JANコード|JAN)/gi,
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
