"use strict";

const SALES_PLAN_PAGE_SIZE = 20;
let salesPlanRecords = [];
let salesPlanProducts = [];
let salesPlanEditingId = "";
let salesPlanCurrentPage = 1;
let salesPlanPendingItems = [];

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
  const addItemButton = document.querySelector("#add-sales-plan-item-button");
  const productSearchInput = document.querySelector("#sales-plan-internal-code");
  const cancelEditButton = document.querySelector("#cancel-sales-plan-edit-button");
  const searchInput = document.querySelector("#sales-plan-search");
  const monthFilter = document.querySelector("#sales-plan-month-filter");
  const printMonthInput = document.querySelector("#sales-plan-print-month");
  const printCalendarButton = document.querySelector("#print-sales-plan-calendar-button");
  const printCalendarA4Button = document.querySelector("#print-sales-plan-calendar-a4-button");
  const printListButton = document.querySelector("#print-sales-plan-list-button");
  const printListA4Button = document.querySelector("#print-sales-plan-list-a4-button");
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
  if (addItemButton) {
    addItemButton.addEventListener(
      "click",
      addSalesPlanPendingItem
    );
  }
  productSearchInput.addEventListener("input", function () {
    clearSalesPlanProductFields();
    renderSalesPlanProductSuggestions(productSearchInput.value);
  });
  productSearchInput.addEventListener("focus", function () {
    renderSalesPlanProductSuggestions(productSearchInput.value);
  });
  productSearchInput.addEventListener("keydown", function (event) {
    if (event.key === "Escape") {
      closeSalesPlanProductSuggestions();
    }
  });
  document.addEventListener("click", function (event) {
    const wrap = event.target.closest(".sales-plan-product-search-wrap");
    if (!wrap) {
      closeSalesPlanProductSuggestions();
    }
  });
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

    if (
      printMonthInput &&
      monthFilter.value
    ) {
      printMonthInput.value =
        monthFilter.value;
    }
  });

  if (printCalendarButton) {
    printCalendarButton.addEventListener(
      "click",
      function () {
        printSalesPlanCalendar("A3");
      }
    );
  }

  if (printCalendarA4Button) {
    printCalendarA4Button.addEventListener(
      "click",
      function () {
        printSalesPlanCalendar("A4");
      }
    );
  }

  if (printListButton) {
    printListButton.addEventListener(
      "click",
      function () {
        printSalesPlanList("A3");
      }
    );
  }

  if (printListA4Button) {
    printListA4Button.addEventListener(
      "click",
      function () {
        printSalesPlanList("A4");
      }
    );
  }

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

  if (
    printMonthInput &&
    !printMonthInput.value
  ) {
    printMonthInput.value =
      getSalesPlanCurrentMonth();
  }

  updateSalesPlanShippingFields();
  renderSalesPlanPendingItems();
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
  closeSalesPlanProductSuggestions();
  renderSalesPlanTable();
}


function normalizeSalesPlanSearchText(value) {
  return String(value || "")
    .normalize("NFKC")
    .trim()
    .toLowerCase();
}

function renderSalesPlanProductSuggestions(keyword) {
  const suggestionBox = document.querySelector("#sales-plan-product-suggestions");
  const input = document.querySelector("#sales-plan-internal-code");
  if (!suggestionBox || !input) return;

  const target = normalizeSalesPlanSearchText(keyword);
  suggestionBox.innerHTML = "";

  if (!target) {
    closeSalesPlanProductSuggestions();
    return;
  }

  const exactInternalMatches = salesPlanProducts.filter(function (product) {
    return normalizeSalesPlanSearchText(product.internalCode) === target;
  });

  const exactProductCodeMatches = salesPlanProducts.filter(function (product) {
    return normalizeSalesPlanSearchText(product.productCode) === target;
  });

  const exactJanCodeMatches = salesPlanProducts.filter(function (product) {
    return normalizeSalesPlanSearchText(product.janCode) === target;
  });

  let matches;

  if (exactInternalMatches.length > 0) {
    // 社内コードは一意なので、完全一致した商品だけを表示します。
    matches = exactInternalMatches;
  } else if (exactProductCodeMatches.length > 0) {
    // 商品コードは重複可なので、完全一致した商品が複数ある場合はすべて候補に表示します。
    matches = exactProductCodeMatches
      .slice()
      .sort(function (a, b) {
        return String(a.internalCode || "").localeCompare(
          String(b.internalCode || ""),
          "ja",
          { numeric: true }
        );
      });
  } else if (exactJanCodeMatches.length > 0) {
    // JANコードも重複登録を許可しているため、完全一致した商品をすべて候補に表示します。
    matches = exactJanCodeMatches
      .slice()
      .sort(function (a, b) {
        return String(a.internalCode || "").localeCompare(
          String(b.internalCode || ""),
          "ja",
          { numeric: true }
        );
      });
  } else {
    // 完全一致がないときだけ、社内コード・商品コード・JANコード・商品名の部分一致候補を表示します。
    matches = salesPlanProducts
      .filter(function (product) {
        const internalCode = normalizeSalesPlanSearchText(product.internalCode);
        const productCode = normalizeSalesPlanSearchText(product.productCode);
        const janCode = normalizeSalesPlanSearchText(product.janCode);
        const productName = normalizeSalesPlanSearchText(product.productName);

        return (
          internalCode.includes(target) ||
          productCode.includes(target) ||
          janCode.includes(target) ||
          productName.includes(target)
        );
      })
      .sort(function (a, b) {
        const aInternal = normalizeSalesPlanSearchText(a.internalCode);
        const bInternal = normalizeSalesPlanSearchText(b.internalCode);
        const aProduct = normalizeSalesPlanSearchText(a.productCode);
        const bProduct = normalizeSalesPlanSearchText(b.productCode);
        const aJan = normalizeSalesPlanSearchText(a.janCode);
        const bJan = normalizeSalesPlanSearchText(b.janCode);

        const getRank = function (internalCode, productCode, janCode) {
          if (internalCode.startsWith(target)) return 0;
          if (productCode.startsWith(target)) return 1;
          if (janCode.startsWith(target)) return 2;
          return 3;
        };

        const rankDiff =
          getRank(aInternal, aProduct, aJan) -
          getRank(bInternal, bProduct, bJan);

        if (rankDiff !== 0) return rankDiff;

        return String(a.internalCode || "").localeCompare(
          String(b.internalCode || ""),
          "ja",
          { numeric: true }
        );
      })
      .slice(0, 20);
  }

  if (matches.length === 0) {
    closeSalesPlanProductSuggestions();
    return;
  }

  matches.forEach(function (product) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "sales-plan-product-suggestion";
    button.setAttribute("role", "option");

    const name = document.createElement("strong");
    name.textContent = product.productName || "商品名未登録";

    const codes = document.createElement("span");
    codes.textContent = `社内コード：${product.internalCode || "未登録"}　商品コード：${product.productCode || "未登録"}　JAN：${product.janCode || "未登録"}`;

    button.appendChild(name);
    button.appendChild(codes);
    button.addEventListener("click", function () {
      applySalesPlanProductToForm(product);
      closeSalesPlanProductSuggestions();
    });

    suggestionBox.appendChild(button);
  });

  suggestionBox.hidden = false;
  input.setAttribute("aria-expanded", "true");
}

function closeSalesPlanProductSuggestions() {
  const suggestionBox = document.querySelector("#sales-plan-product-suggestions");
  const input = document.querySelector("#sales-plan-internal-code");
  if (suggestionBox) {
    suggestionBox.hidden = true;
    suggestionBox.innerHTML = "";
  }
  if (input) {
    input.setAttribute("aria-expanded", "false");
  }
}

async function loadSalesPlanProduct() {
  const codeInput = document.querySelector("#sales-plan-internal-code");
  const enteredCode = codeInput.value.trim();
  const product = await resolveSalesPlanProduct(enteredCode);

  if (!product) {
    clearSalesPlanProductFields();

    if (!enteredCode) {
      await showSalesPlanDialog({
        type: "warning",
        icon: "✏️",
        title: "社内コード・商品コード・JANコードを入力してください",
        message: "販売予定の商品を検索するコードを入力してください。",
        notice: "社内コード・商品コード・JANコードのどれでも検索できます。",
        confirmText: "入力に戻る"
      });
    } else if (!findSalesPlanProductMatches(enteredCode).length) {
      await showSalesPlanDialog({
        type: "danger",
        icon: "🔎",
        title: "商品が見つかりません",
        message: "入力した社内コード・商品コード・JANコードに一致する商品は登録されていません。",
        details: [
          { label: "入力したコード", value: enteredCode }
        ],
        notice: "コードを確認するか、商品一覧で登録状況を確認してください。",
        confirmText: "入力に戻る"
      });
    }

    codeInput.focus();
    codeInput.select();
    return;
  }

  applySalesPlanProductToForm(product);
}

function findSalesPlanProductMatches(code) {
  const target = normalizeSalesPlanSearchText(code);
  if (!target) return [];

  const internalMatch = salesPlanProducts.find(function (product) {
    return normalizeSalesPlanSearchText(product.internalCode) === target;
  });

  // 社内コードは商品を一意に識別するため、完全一致した場合は最優先します。
  if (internalMatch) {
    return [internalMatch];
  }

  const productCodeMatches = salesPlanProducts.filter(function (product) {
    return normalizeSalesPlanSearchText(product.productCode) === target;
  });

  if (productCodeMatches.length > 0) {
    return productCodeMatches;
  }

  return salesPlanProducts.filter(function (product) {
    return normalizeSalesPlanSearchText(product.janCode) === target;
  });
}

function findSalesPlanProduct(code) {
  const matches = findSalesPlanProductMatches(code);
  return matches.length === 1 ? matches[0] : null;
}

async function resolveSalesPlanProduct(code) {
  const matches = findSalesPlanProductMatches(code);

  if (matches.length === 0) {
    return null;
  }

  if (matches.length === 1) {
    return matches[0];
  }

  return showSalesPlanProductChoiceDialog(code, matches);
}

function applySalesPlanProductToForm(product) {
  const codeInput = document.querySelector("#sales-plan-internal-code");
  codeInput.value = product.internalCode || "";
  document.querySelector("#sales-plan-product-code").value = product.productCode || "";
  document.querySelector("#sales-plan-product-name").value = product.productName || "";
  closeSalesPlanProductSuggestions();
}

function showSalesPlanProductChoiceDialog(enteredCode, products) {
  return new Promise(function (resolve) {
    const existingDialog = document.querySelector("#sales-plan-product-choice-dialog");
    if (existingDialog) existingDialog.remove();

    const overlay = document.createElement("div");
    overlay.id = "sales-plan-product-choice-dialog";
    overlay.className = "app-dialog-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");

    const modal = document.createElement("div");
    modal.className = "app-dialog-modal app-dialog-info sales-plan-product-choice-modal";

    const header = document.createElement("div");
    header.className = "app-dialog-header";

    const icon = document.createElement("div");
    icon.className = "app-dialog-icon";
    icon.textContent = "🔎";
    icon.setAttribute("aria-hidden", "true");

    const title = document.createElement("h2");
    title.className = "app-dialog-title";
    title.textContent = "同じコードの商品が複数あります";

    header.appendChild(icon);
    header.appendChild(title);

    const content = document.createElement("div");
    content.className = "app-dialog-content";

    const message = document.createElement("p");
    message.className = "app-dialog-message";
    message.textContent = "登録する商品を選んでください。商品コードやJANコードは重複する場合があるため、社内コードと商品名を確認してください。";
    content.appendChild(message);

    const details = document.createElement("div");
    details.className = "app-dialog-details";
    const row = document.createElement("div");
    row.className = "app-dialog-detail-row";
    const label = document.createElement("strong");
    label.textContent = "入力したコード";
    const value = document.createElement("span");
    value.textContent = enteredCode;
    row.appendChild(label);
    row.appendChild(value);
    details.appendChild(row);
    content.appendChild(details);

    const list = document.createElement("div");
    list.className = "sales-plan-product-choice-list";

    products
      .slice()
      .sort(function (a, b) {
        return String(a.internalCode || "").localeCompare(
          String(b.internalCode || ""),
          "ja",
          { numeric: true }
        );
      })
      .forEach(function (product) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "sales-plan-product-choice-button";

        const name = document.createElement("strong");
        name.textContent = product.productName || "商品名未登録";

        const codes = document.createElement("span");
        codes.textContent = `社内コード：${product.internalCode || "未登録"}　商品コード：${product.productCode || "未登録"}　JAN：${product.janCode || "未登録"}`;

        button.appendChild(name);
        button.appendChild(codes);
        button.addEventListener("click", function () {
          finish(product);
        });
        list.appendChild(button);
      });

    content.appendChild(list);

    const notice = document.createElement("div");
    notice.className = "app-dialog-notice";
    notice.textContent = "商品コードやJANコードが同じでも、社内コードが違えば別の商品として管理されています。";
    content.appendChild(notice);

    const actions = document.createElement("div");
    actions.className = "app-dialog-actions";
    actions.style.gridTemplateColumns = "1fr";

    const cancelButton = document.createElement("button");
    cancelButton.type = "button";
    cancelButton.className = "app-dialog-button app-dialog-cancel";
    cancelButton.textContent = "入力に戻る";
    cancelButton.addEventListener("click", function () {
      finish(null);
    });

    actions.appendChild(cancelButton);
    modal.appendChild(header);
    modal.appendChild(content);
    modal.appendChild(actions);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    document.body.classList.add("app-dialog-open");

    let finished = false;

    function finish(product) {
      if (finished) return;
      finished = true;
      overlay.remove();
      document.body.classList.remove("app-dialog-open");
      resolve(product);
    }

    overlay.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        finish(null);
      }
    });

    const firstChoice = list.querySelector("button");
    if (firstChoice) {
      window.setTimeout(function () {
        firstChoice.focus();
      }, 0);
    }
  });
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

async function addSalesPlanPendingItem() {
  if (salesPlanEditingId) {
    return;
  }

  const codeInput =
    document.querySelector(
      "#sales-plan-internal-code"
    );

  const enteredCode =
    codeInput.value.trim();

  const quantityInput =
    document.querySelector(
      "#sales-plan-quantity"
    );

  const quantity =
    Number(quantityInput.value);

  const product =
    await resolveSalesPlanProduct(
      enteredCode
    );

  if (!product) {
    if (!enteredCode) {
      await showSalesPlanDialog({
        type: "warning",
        icon: "✏️",
        title: "商品を選択してください",
        message:
          "まとめて登録する商品を検索して選択してください。",
        notice:
          "社内コード・商品コード・JANコード・商品名から検索できます。",
        confirmText: "入力に戻る"
      });
    } else if (
      !findSalesPlanProductMatches(
        enteredCode
      ).length
    ) {
      await showSalesPlanDialog({
        type: "danger",
        icon: "🔎",
        title: "商品が見つかりません",
        message:
          "入力したコードの商品が見つかりません。",
        details: [
          {
            label: "入力したコード",
            value: enteredCode
          }
        ],
        confirmText: "入力に戻る"
      });
    }

    codeInput.focus();
    codeInput.select();
    return;
  }

  applySalesPlanProductToForm(
    product
  );

  if (
    !Number.isInteger(quantity) ||
    quantity <= 0
  ) {
    await showSalesPlanDialog({
      type: "warning",
      icon: "🔢",
      title: "数量を確認してください",
      message:
        "数量は1以上の整数で入力してください。",
      details: [
        {
          label: "入力値",
          value:
            quantityInput.value ||
            "未入力"
        }
      ],
      confirmText: "入力に戻る"
    });

    quantityInput.focus();
    return;
  }

  const internalCode =
    String(
      product.internalCode || ""
    ).trim();

  const existing =
    salesPlanPendingItems.find(
      function (item) {
        return (
          String(
            item.internalCode || ""
          ).trim() ===
          internalCode
        );
      }
    );

  if (existing) {
    existing.quantity +=
      quantity;
  } else {
    salesPlanPendingItems.push({
      internalCode:
        product.internalCode || "",
      productCode:
        product.productCode || "",
      productName:
        product.productName || "",
      quantity:
        quantity
    });
  }

  renderSalesPlanPendingItems();
  clearSalesPlanProductEntry();

  const pendingNote =
    document.querySelector(
      "#sales-plan-pending-summary"
    );

  if (pendingNote) {
    pendingNote.scrollIntoView({
      behavior: "smooth",
      block: "nearest"
    });
  }

  codeInput.focus();
}

function removeSalesPlanPendingItem(
  internalCode
) {
  salesPlanPendingItems =
    salesPlanPendingItems.filter(
      function (item) {
        return (
          String(
            item.internalCode || ""
          ) !==
          String(
            internalCode || ""
          )
        );
      }
    );

  renderSalesPlanPendingItems();
}

function renderSalesPlanPendingItems() {
  const area =
    document.querySelector(
      "#sales-plan-pending-area"
    );

  const list =
    document.querySelector(
      "#sales-plan-pending-list"
    );

  const summary =
    document.querySelector(
      "#sales-plan-pending-summary"
    );

  const saveButton =
    document.querySelector(
      "#save-sales-plan-button"
    );

  const addButton =
    document.querySelector(
      "#add-sales-plan-item-button"
    );

  if (
    !area ||
    !list ||
    !summary ||
    !saveButton
  ) {
    return;
  }

  const isEditing =
    Boolean(
      salesPlanEditingId
    );

  area.hidden =
    isEditing;

  if (addButton) {
    addButton.hidden =
      isEditing;
  }

  if (isEditing) {
    saveButton.disabled =
      false;

    saveButton.textContent =
      "変更を保存する";

    return;
  }

  const totalQuantity =
    salesPlanPendingItems.reduce(
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

  summary.textContent =
    `${salesPlanPendingItems.length}商品 / ` +
    `合計${totalQuantity.toLocaleString("ja-JP")}個`;

  saveButton.disabled =
    salesPlanPendingItems.length ===
    0;

  saveButton.textContent =
    salesPlanPendingItems.length >
    0
      ? `追加した${salesPlanPendingItems.length}商品をまとめて登録する`
      : "追加した商品をまとめて登録する";

  list.innerHTML = "";

  if (
    salesPlanPendingItems.length ===
    0
  ) {
    const empty =
      document.createElement("p");

    empty.className =
      "sales-plan-pending-empty";

    empty.textContent =
      "まだ商品が追加されていません。";

    list.appendChild(
      empty
    );

    return;
  }

  salesPlanPendingItems.forEach(
    function (item) {
      const card =
        document.createElement("div");

      card.className =
        "sales-plan-pending-item";

      const info =
        document.createElement("div");

      info.className =
        "sales-plan-pending-item-info";

      const name =
        document.createElement("strong");

      name.textContent =
        item.productName ||
        "商品名未登録";

      const codes =
        document.createElement("span");

      codes.textContent =
        `社内コード：${item.internalCode || "未登録"} / ` +
        `商品コード：${item.productCode || "未登録"}`;

      info.append(
        name,
        codes
      );

      const quantity =
        document.createElement("strong");

      quantity.className =
        "sales-plan-pending-quantity";

      quantity.textContent =
        `${Number(item.quantity || 0).toLocaleString("ja-JP")}個`;

      const removeButton =
        document.createElement("button");

      removeButton.type =
        "button";

      removeButton.className =
        "sales-plan-pending-remove";

      removeButton.textContent =
        "削除";

      removeButton.addEventListener(
        "click",
        function () {
          removeSalesPlanPendingItem(
            item.internalCode
          );
        }
      );

      card.append(
        info,
        quantity,
        removeButton
      );

      list.appendChild(
        card
      );
    }
  );
}

function clearSalesPlanProductEntry() {
  const internalCode =
    document.querySelector(
      "#sales-plan-internal-code"
    );

  const quantity =
    document.querySelector(
      "#sales-plan-quantity"
    );

  if (internalCode) {
    internalCode.value =
      "";
  }

  if (quantity) {
    quantity.value =
      "1";
  }

  clearSalesPlanProductFields();
  closeSalesPlanProductSuggestions();
}

async function saveSalesPlanFromForm(event) {
  event.preventDefault();

  const customerName =
    document.querySelector(
      "#sales-plan-customer"
    ).value.trim();

  const subtitle =
    document.querySelector(
      "#sales-plan-subtitle"
    ).value.trim();

  const remarks =
    document.querySelector(
      "#sales-plan-remarks"
    ).value.trim();

  if (!customerName) {
    await showSalesPlanDialog({
      type: "warning",
      icon: "🏢",
      title: "取引先名を入力してください",
      message:
        "販売予定を登録するには、取引先名の入力が必要です。",
      confirmText: "入力に戻る"
    });

    document.querySelector(
      "#sales-plan-customer"
    ).focus();

    return;
  }

  const shipping =
    await readSalesPlanShippingFromForm();

  if (!shipping) {
    return;
  }

  if (salesPlanEditingId) {
    const codeInput =
      document.querySelector(
        "#sales-plan-internal-code"
      );

    const enteredCode =
      codeInput.value.trim();

    const quantity =
      Number(
        document.querySelector(
          "#sales-plan-quantity"
        ).value
      );

    const product =
      await resolveSalesPlanProduct(
        enteredCode
      );

    if (!product) {
      await showSalesPlanDialog({
        type: "warning",
        icon: "🔎",
        title: "商品を確認してください",
        message:
          "変更する商品を選択してください。",
        confirmText: "入力に戻る"
      });

      codeInput.focus();
      return;
    }

    applySalesPlanProductToForm(
      product
    );

    if (
      !Number.isInteger(quantity) ||
      quantity <= 0
    ) {
      await showSalesPlanDialog({
        type: "warning",
        icon: "🔢",
        title: "数量を確認してください",
        message:
          "数量は1以上の整数で入力してください。",
        confirmText: "入力に戻る"
      });

      document.querySelector(
        "#sales-plan-quantity"
      ).focus();

      return;
    }

    const now =
      new Date().toISOString();

    const existing =
      salesPlanRecords.find(
        function (record) {
          return (
            record.id ===
            salesPlanEditingId
          );
        }
      );

    const record = {
      id:
        salesPlanEditingId,
      customerName:
        customerName,
      subtitle:
        subtitle,
      remarks:
        remarks,
      shippingType:
        shipping.shippingType,
      shippingDate:
        shipping.shippingDate,
      shippingStartDate:
        shipping.shippingStartDate,
      shippingEndDate:
        shipping.shippingEndDate,
      shippingMonth:
        shipping.shippingMonth,
      internalCode:
        product.internalCode,
      productCode:
        product.productCode || "",
      productName:
        product.productName || "",
      quantity:
        quantity,
      createdAt:
        existing &&
        existing.createdAt
          ? existing.createdAt
          : now,
      updatedAt:
        now
    };

    try {
      await updateSalesPlan(
        record
      );

      resetSalesPlanForm();
      await refreshSalesPlanData();

      await showSalesPlanDialog({
        type: "success",
        icon: "✅",
        title: "販売予定を変更しました",
        details: [
          {
            label: "取引先",
            value: customerName
          },
          ...(subtitle
            ? [
                {
                  label: "副題",
                  value: subtitle
                }
              ]
            : []),
          ...(remarks
            ? [
                {
                  label: "備考",
                  value: remarks
                }
              ]
            : []),
          {
            label: "商品",
            value:
              product.productName ||
              product.internalCode
          },
          {
            label: "出荷時期",
            value:
              formatSalesPlanShipping(
                record
              )
          },
          {
            label: "数量",
            value:
              `${quantity.toLocaleString("ja-JP")}個`
          }
        ],
        confirmText: "閉じる"
      });
    } catch (error) {
      console.error(
        "販売予定更新エラー",
        error
      );

      await showSalesPlanDialog({
        type: "danger",
        icon: "⚠️",
        title: "販売予定を変更できませんでした",
        message:
          "販売予定の変更中にエラーが発生しました。",
        confirmText: "閉じる"
      });
    }

    return;
  }

  if (
    salesPlanPendingItems.length ===
    0
  ) {
    await showSalesPlanDialog({
      type: "warning",
      icon: "📦",
      title: "商品を追加してください",
      message:
        "登録する商品がまだ追加されていません。",
      notice:
        "商品を検索して数量を入力し、「この商品を追加する」を押してください。",
      confirmText: "入力に戻る"
    });

    document.querySelector(
      "#sales-plan-internal-code"
    ).focus();

    return;
  }

  const totalQuantity =
    salesPlanPendingItems.reduce(
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

  const shippingPreview = {
    shippingType:
      shipping.shippingType,
    shippingDate:
      shipping.shippingDate,
    shippingStartDate:
      shipping.shippingStartDate,
    shippingEndDate:
      shipping.shippingEndDate,
    shippingMonth:
      shipping.shippingMonth
  };

  const confirmed =
    await showSalesPlanDialog({
      type: "warning",
      icon: "📦",
      title: "販売予定をまとめて登録しますか？",
      message:
        "同じ取引先・同じ出荷時期で、追加した商品をまとめて登録します。",
      details: [
        {
          label: "取引先",
          value: customerName
        },
        ...(subtitle
          ? [
              {
                label: "副題",
                value: subtitle
              }
            ]
          : []),
        ...(remarks
          ? [
              {
                label: "備考",
                value: remarks
              }
            ]
          : []),
        {
          label: "出荷時期",
          value:
            formatSalesPlanShipping(
              shippingPreview
            )
        },
        {
          label: "商品数",
          value:
            `${salesPlanPendingItems.length}商品`
        },
        {
          label: "数量合計",
          value:
            `${totalQuantity.toLocaleString("ja-JP")}個`
        }
      ],
      notice:
        "商品ごとに1件ずつ販売予定として保存します。取引先名・副題・出荷時期・備考はすべて同じ内容になります。",
      isConfirm: true,
      cancelText: "戻る",
      confirmText: "まとめて登録する"
    });

  if (!confirmed) {
    return;
  }

  const now =
    new Date().toISOString();

  const succeeded = [];
  const failed = [];

  for (
    const item of
    salesPlanPendingItems
  ) {
    const record = {
      id:
        createSalesPlanId(),
      customerName:
        customerName,
      subtitle:
        subtitle,
      remarks:
        remarks,
      shippingType:
        shipping.shippingType,
      shippingDate:
        shipping.shippingDate,
      shippingStartDate:
        shipping.shippingStartDate,
      shippingEndDate:
        shipping.shippingEndDate,
      shippingMonth:
        shipping.shippingMonth,
      internalCode:
        item.internalCode,
      productCode:
        item.productCode || "",
      productName:
        item.productName || "",
      quantity:
        Number(
          item.quantity || 0
        ),
      createdAt:
        now,
      updatedAt:
        now
    };

    try {
      await saveSalesPlan(
        record
      );

      succeeded.push(
        item
      );
    } catch (error) {
      console.error(
        "販売予定まとめ登録エラー",
        item.internalCode,
        error
      );

      failed.push(
        item
      );
    }
  }

  salesPlanPendingItems =
    failed.slice();

  renderSalesPlanPendingItems();

  if (
    succeeded.length > 0
  ) {
    await refreshSalesPlanData();
  }

  if (
    failed.length === 0
  ) {
    const registeredCount =
      succeeded.length;

    const registeredQuantity =
      succeeded.reduce(
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

    resetSalesPlanForm();

    await showSalesPlanDialog({
      type: "success",
      icon: "✅",
      title: "販売予定をまとめて登録しました",
      details: [
        {
          label: "取引先",
          value: customerName
        },
        ...(subtitle
          ? [
              {
                label: "副題",
                value: subtitle
              }
            ]
          : []),
        {
          label: "登録商品数",
          value:
            `${registeredCount}商品`
        },
        {
          label: "数量合計",
          value:
            `${registeredQuantity.toLocaleString("ja-JP")}個`
        },
        {
          label: "出荷時期",
          value:
            formatSalesPlanShipping(
              shippingPreview
            )
        }
      ],
      confirmText: "閉じる"
    });

    return;
  }

  await showSalesPlanDialog({
    type: "danger",
    icon: "⚠️",
    title: "一部の商品を登録できませんでした",
    message:
      `${succeeded.length}商品は登録できました。${failed.length}商品は登録できなかったため、入力欄に残しています。`,
    notice:
      "残っている商品を確認して、もう一度まとめて登録してください。",
    confirmText: "確認して閉じる"
  });
}

async function editSalesPlan(id) {
  const record = salesPlanRecords.find(function (item) { return item.id === id; });
  if (!record) return;

  salesPlanEditingId = id;
  document.querySelector("#sales-plan-customer").value = record.customerName || "";
  document.querySelector("#sales-plan-subtitle").value = record.subtitle || "";
  document.querySelector("#sales-plan-remarks").value = record.remarks || "";
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
  document.querySelector("#save-sales-plan-button").disabled = false;
  document.querySelector("#cancel-sales-plan-edit-button").hidden = false;
  renderSalesPlanPendingItems();
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
      ...(record.subtitle
        ? [{ label: "副題", value: record.subtitle }]
        : []),
      ...(record.remarks
        ? [{ label: "備考", value: record.remarks }]
        : []),
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
  clearSalesPlanProductEntry();
  document.querySelector("#cancel-sales-plan-edit-button").hidden = true;
  renderSalesPlanPendingItems();
}

function clearSalesPlanProductFields() {
  document.querySelector("#sales-plan-product-code").value = "";
  document.querySelector("#sales-plan-product-name").value = "";
}

function normalizeSalesPlanPrintPaperSize(paperSize) {
  return String(paperSize || "").toUpperCase() === "A4"
    ? "A4"
    : "A3";
}

function getSalesPlanPrintFilterState() {
  const searchInput = document.querySelector("#sales-plan-search");
  const monthFilter = document.querySelector("#sales-plan-month-filter");

  const keyword = searchInput
    ? searchInput.value.trim()
    : "";

  const filterMonth = monthFilter
    ? monthFilter.value
    : "";

  return {
    keyword: keyword,
    month: filterMonth,
    active: Boolean(keyword || filterMonth)
  };
}

function getSalesPlanCurrentFilteredPrintPlans() {
  return getFilteredSalesPlans()
    .slice()
    .sort(compareSalesPlans);
}

function buildSalesPlanPrintFilterDescription(filterState) {
  if (!filterState || !filterState.active) {
    return "";
  }

  const parts = [];

  if (filterState.keyword) {
    parts.push(`検索「${filterState.keyword}」`);
  }

  if (filterState.month) {
    parts.push(`出荷月 ${formatSalesPlanPrintMonth(filterState.month)}`);
  }

  return parts.join(" / ");
}

function printSalesPlanList(paperSize) {
  const printPaperSize =
    normalizeSalesPlanPrintPaperSize(
      paperSize
    );

  const isA4 =
    printPaperSize === "A4";

  const monthInput =
    document.querySelector(
      "#sales-plan-print-month"
    );

  const month =
    monthInput
      ? monthInput.value
      : "";

  if (
    !/^\d{4}-\d{2}$/.test(
      month
    )
  ) {
    void showSalesPlanDialog({
      type: "warning",
      icon: "📋",
      title: "印刷する月を選んでください",
      message:
        "リスト形式で印刷する月を選択してください。",
      confirmText: "入力に戻る"
    });

    if (monthInput) {
      monthInput.focus();
    }

    return;
  }

  const printFilterState =
    getSalesPlanPrintFilterState();

  const plans =
    (
      printFilterState.active
        ? getSalesPlanCurrentFilteredPrintPlans()
        : salesPlanRecords
            .filter(
              function (record) {
                return salesPlanMatchesMonth(
                  record,
                  month
                );
              }
            )
            .slice()
            .sort(compareSalesPlans)
    );

  if (
    plans.length === 0
  ) {
    void showSalesPlanDialog({
      type: "warning",
      icon: "📋",
      title: "販売予定がありません",
      message:
        printFilterState.active
          ? "現在の検索・絞り込み条件に該当する販売予定はありません。"
          : `${formatSalesPlanPrintMonth(month)}に該当する販売予定はありません。`,
      confirmText: "確認して閉じる"
    });

    return;
  }

  const printWindow =
    window.open(
      "",
      "_blank"
    );

  if (!printWindow) {
    void showSalesPlanDialog({
      type: "warning",
      icon: "🖨️",
      title: "印刷画面を開けませんでした",
      message:
        "ブラウザでポップアップが禁止されている可能性があります。",
      notice:
        "このページのポップアップを許可して、もう一度お試しください。",
      confirmText: "確認して閉じる"
    });

    return;
  }

  const totalQuantity =
    plans.reduce(
      function (sum, record) {
        return (
          sum +
          Number(
            record.quantity || 0
          )
        );
      },
      0
    );

  const monthLabel =
    formatSalesPlanPrintMonth(
      month
    );

  const printFilterDescription =
    buildSalesPlanPrintFilterDescription(
      printFilterState
    );

  const listHeading =
    printFilterState.active
      ? (
          printFilterState.month
            ? `${formatSalesPlanPrintMonth(printFilterState.month)} 販売予定一覧（絞り込み結果）`
            : "販売予定一覧（検索結果）"
        )
      : `${monthLabel} 販売予定一覧`;

  const listTargetNotice =
    printFilterState.active
      ? `印刷対象：現在の検索・絞り込み結果（${escapeSalesPlanHtml(printFilterDescription || "絞り込み中")}）`
      : `印刷対象：${escapeSalesPlanHtml(monthLabel)}の全販売予定`;

  const printedAt =
    new Date().toLocaleString(
      "ja-JP"
    );

  const listPageMarginMm =
    isA4 ? 5 : 8;

  const listBodyFontPt =
    isA4 ? 8.8 : 10.8;

  const listTitleFontPt =
    isA4 ? 17 : 22;

  const listSummaryFontPt =
    isA4 ? 8.8 : 11.2;

  const listSummaryPadding =
    isA4 ? "3px 5px" : "5px 8px";

  const listNoticeFontPt =
    isA4 ? 8 : 10;

  const listCellPadding =
    isA4 ? "4px 4px" : "5px 6px";

  const listLineHeight =
    isA4 ? 1.25 : 1.3;

  const listHeaderFontPt =
    isA4 ? 8.6 : 10.8;

  const listNumberFontPt =
    isA4 ? 9 : 11.2;

  const listRemarksMinHeightMm =
    isA4 ? 7 : 10;

  const listFooterFontPt =
    isA4 ? 6.5 : 7.5;

  const listRowHeightMm =
    isA4 ? 6.2 : 0;

  const rowsHtml =
    plans
      .map(
        function (record, index) {
          return `
            <tr>
              <td class="center">${index + 1}</td>
              <td>${escapeSalesPlanHtml(formatSalesPlanShipping(record))}</td>
              <td>${escapeSalesPlanHtml(record.customerName || "未登録")}</td>
              <td>${escapeSalesPlanHtml(record.subtitle || "－")}</td>
              <td>${escapeSalesPlanHtml(record.internalCode || "未登録")}</td>
              <td>${escapeSalesPlanHtml(record.productCode || "未登録")}</td>
              <td class="number">${Number(record.quantity || 0).toLocaleString("ja-JP")}個</td>
              <td class="remarks">${escapeSalesPlanHtml(record.remarks || "") || "&nbsp;"}</td>
            </tr>
          `;
        }
      )
      .join("");

  const html = `
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <title>${escapeSalesPlanHtml(printFilterState.active ? "販売予定一覧_検索結果" : `販売予定一覧_${month}`)}_${printPaperSize}</title>

  <style>
    @page {
      size: ${printPaperSize} landscape;
      margin: ${listPageMarginMm}mm;
    }

    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    body {
      margin: 0;
      color: #111;
      font-family:
        "Yu Gothic",
        "Meiryo",
        sans-serif;
      font-size: ${listBodyFontPt}pt;
      font-weight: 700;
    }

    h1 {
      margin: 0 0 4px;
      text-align: center;
      font-size: ${listTitleFontPt}pt;
      font-weight: 900;
    }

    .summary {
      display: grid;
      grid-template-columns:
        1fr 1fr 1fr;
      gap: 5px;
      margin-bottom: 5px;
    }

    .summary > div {
      padding: ${listSummaryPadding};
      border: 1.2px solid #444;
      font-size: ${listSummaryFontPt}pt;
      font-weight: 900;
    }

    .notice {
      margin-bottom: 5px;
      padding: 5px 8px;
      border-left: 5px solid #1976d2;
      background: #f5f9ff;
      font-size: ${listNoticeFontPt}pt;
      font-weight: 800;
      line-height: 1.5;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
    }

    thead {
      display: table-header-group;
    }

    tr {
      break-inside: avoid;
      page-break-inside: avoid;
    }

    th,
    td {
      border: 1.2px solid #444;
      padding: ${listCellPadding};
      vertical-align: middle;
      overflow-wrap: anywhere;
      word-break: break-word;
      line-height: ${listLineHeight};
      font-weight: 800;
    }

    th {
      background: #e8eef5;
      text-align: center;
      font-weight: 900;
      font-size: ${listHeaderFontPt}pt;
    }

    tbody tr:nth-child(even) {
      background: #fafafa;
    }

    ${isA4 ? `tbody td { height: ${listRowHeightMm}mm; }` : ""}

    .center {
      text-align: center;
    }

    .number {
      text-align: right;
      white-space: nowrap;
      font-weight: 900;
      font-size: ${listNumberFontPt}pt;
    }

    .remarks {
      min-height: ${listRemarksMinHeightMm}mm;
      white-space: pre-wrap;
    }

    th:nth-child(1) { width: 4%; }
    th:nth-child(2) { width: 17%; }
    th:nth-child(3) { width: 13%; }
    th:nth-child(4) { width: 14%; }
    th:nth-child(5) { width: 9%; }
    th:nth-child(6) { width: 13%; }
    th:nth-child(7) { width: 8%; }
    th:nth-child(8) { width: 22%; }

    .footer {
      margin-top: 5px;
      text-align: right;
      font-size: ${listFooterFontPt}pt;
      color: #444;
    }
  </style>
</head>

<body>
  <h1>${escapeSalesPlanHtml(listHeading)}</h1>

  <div class="summary">
    <div>販売予定：${plans.length.toLocaleString("ja-JP")}件</div>
    <div>予定数量合計：${totalQuantity.toLocaleString("ja-JP")}個</div>
    <div>印刷日時：${escapeSalesPlanHtml(printedAt)}</div>
  </div>

  <div class="notice">
    <div>${listTargetNotice}</div>
    <div>※ 期間指定の販売予定は対象条件と期間が重なる予定も一覧に含みます。登録した備考は備考欄へ印刷します。空欄は印刷後の手書きメモにも使用できます。</div>
  </div>

  <table>
    <thead>
      <tr>
        <th>No.</th>
        <th>出荷時期</th>
        <th>取引先名</th>
        <th>副題</th>
        <th>社内コード</th>
        <th>商品コード</th>
        <th>数量</th>
        <th>備考</th>
      </tr>
    </thead>

    <tbody>
      ${rowsHtml}
    </tbody>
  </table>

  <div class="footer">
    販売予定一覧
  </div>
</body>
</html>
  `;

  printWindow.document.open();
  printWindow.document.write(
    html
  );
  printWindow.document.close();

  printWindow.focus();

  window.setTimeout(
    function () {
      try {
        printWindow.print();
      } catch (error) {
        console.error(
          "販売予定リスト印刷エラー",
          error
        );
      }
    },
    500
  );
}

function getSalesPlanCurrentMonth() {
  const now =
    new Date();

  const year =
    now.getFullYear();

  const month =
    String(
      now.getMonth() + 1
    ).padStart(
      2,
      "0"
    );

  return `${year}-${month}`;
}

function printSalesPlanCalendar(paperSize) {
  const printPaperSize =
    normalizeSalesPlanPrintPaperSize(
      paperSize
    );

  const isA4 =
    printPaperSize === "A4";

  const monthInput =
    document.querySelector(
      "#sales-plan-print-month"
    );

  const month =
    monthInput
      ? monthInput.value
      : "";

  if (
    !/^\d{4}-\d{2}$/.test(
      month
    )
  ) {
    void showSalesPlanDialog({
      type: "warning",
      icon: "📅",
      title: "印刷する月を選んでください",
      message:
        "カレンダー形式で印刷する月を選択してください。",
      confirmText: "入力に戻る"
    });

    if (monthInput) {
      monthInput.focus();
    }

    return;
  }

  const printFilterState =
    getSalesPlanPrintFilterState();

  const calendarSourcePlans =
    printFilterState.active
      ? getSalesPlanCurrentFilteredPrintPlans()
      : salesPlanRecords;

  const plans =
    calendarSourcePlans.filter(
      function (record) {
        return salesPlanMatchesMonth(
          record,
          month
        );
      }
    );

  if (plans.length === 0) {
    void showSalesPlanDialog({
      type: "warning",
      icon: "📅",
      title: "販売予定がありません",
      message:
        printFilterState.active
          ? `現在の検索・絞り込み結果の中に、${formatSalesPlanPrintMonth(month)}へ印刷できる販売予定がありません。`
          : `${formatSalesPlanPrintMonth(month)}に該当する販売予定はありません。`,
      notice:
        printFilterState.active
          ? "検索結果の商品をカレンダー印刷する場合は、その商品の出荷月に「印刷する月」を合わせてください。"
          : "",
      confirmText: "確認して閉じる"
    });

    return;
  }

  const printWindow =
    window.open(
      "",
      "_blank"
    );

  if (!printWindow) {
    void showSalesPlanDialog({
      type: "warning",
      icon: "🖨️",
      title: "印刷画面を開けませんでした",
      message:
        "ブラウザでポップアップが禁止されている可能性があります。",
      notice:
        "このページのポップアップを許可して、もう一度お試しください。",
      confirmText: "確認して閉じる"
    });

    return;
  }

  const calendar =
    buildSalesPlanCalendarPrintData(
      plans,
      month,
      printPaperSize
    );

  const monthLabel =
    formatSalesPlanPrintMonth(
      month
    );

  const printFilterDescription =
    buildSalesPlanPrintFilterDescription(
      printFilterState
    );

  const calendarHeading =
    printFilterState.active
      ? `${monthLabel} 販売予定カレンダー（絞り込み結果）`
      : `${monthLabel} 販売予定カレンダー`;

  const calendarTargetLabel =
    printFilterState.active
      ? `対象：${printFilterDescription || "現在の絞り込み結果"}`
      : `対象：${monthLabel}の全販売予定`;

  const totalQuantity =
    plans.reduce(
      function (sum, record) {
        return (
          sum +
          Number(
            record.quantity || 0
          )
        );
      },
      0
    );

  const printedAt =
    new Date().toLocaleString(
      "ja-JP"
    );

  const weekdayHeaders =
    [
      "日",
      "月",
      "火",
      "水",
      "木",
      "金",
      "土"
    ]
      .map(
        function (label, index) {
          const className =
            index === 0
              ? "sun"
              : (
                  index === 6
                    ? "sat"
                    : ""
                );

          return (
            `<th class="${className}">${label}</th>`
          );
        }
      )
      .join("");

  const cellsHtml =
    calendar.cells
      .map(
        function (cell) {
          if (!cell.inMonth) {
            return (
              '<td class="outside"></td>'
            );
          }

          const holiday =
            getSalesPlanJapaneseHoliday(
              cell.date
            );

          const dayClass =
            holiday
              ? "holiday"
              : (
                  cell.weekday === 0
                    ? "sun"
                    : (
                        cell.weekday === 6
                          ? "sat"
                          : ""
                      )
                );

          const holidayHtml =
            holiday
              ? `<div class="holiday-name">${escapeSalesPlanHtml(holiday)}</div>`
              : "";

          const bandsHtml =
            (cell.bands || [])
              .map(
                function (band) {
                  const classes = [
                    "period-band",
                    `lane-${band.lane}`
                  ];

                  if (band.isStart) {
                    classes.push(
                      "band-start"
                    );
                  }

                  if (band.isEnd) {
                    classes.push(
                      "band-end"
                    );
                  }

                  const label =
                    band.showLabel
                      ? `<span>${escapeSalesPlanHtml(band.label)}</span>`
                      : "";

                  const bandStyle =
                    `top:${getSalesPlanCalendarBandTopMm(
                      band.lane,
                      calendar.weekCount,
                      printPaperSize
                    )}mm; background:${getSalesPlanCalendarBandColor(
                      band.lane
                    )};`;

                  return `
                    <div class="${classes.join(" ")}" style="${bandStyle}">
                      ${label}
                    </div>
                  `;
                }
              )
              .join("");

          const hiddenHtml =
            cell.hiddenBandCount > 0
              ? `<div class="band-more">ほか${cell.hiddenBandCount}件</div>`
              : "";

          const emptyHtml =
            (
              (!cell.bands ||
                cell.bands.length === 0) &&
              cell.hiddenBandCount === 0
            )
              ? '<div class="no-plan">予定なし</div>'
              : "";

          return `
            <td class="${dayClass}">
              <div class="day-number">${cell.day}</div>
              ${holidayHtml}
              ${bandsHtml}
              ${hiddenHtml}
              ${emptyHtml}
            </td>
          `;
        }
      );

  const weekRows = [];

  for (
    let index = 0;
    index < cellsHtml.length;
    index += 7
  ) {
    weekRows.push(
      `<tr>${cellsHtml.slice(index, index + 7).join("")}</tr>`
    );
  }

  const compactCalendar =
    calendar.weekCount >= 5;

  const pageMarginMm =
    isA4 ? 4 : 5;

  const rowHeightMm =
    isA4
      ? (
          calendar.weekCount <= 4
            ? 41
            : (
                calendar.weekCount === 5
                  ? 33
                  : 27.5
              )
        )
      : (
          calendar.weekCount <= 4
            ? 62
            : (
                calendar.weekCount === 5
                  ? 47
                  : 40
              )
        );

  const bodyFontPt =
    isA4
      ? (compactCalendar ? 8.3 : 8.8)
      : (compactCalendar ? 10 : 11);

  const titleFontPt =
    isA4
      ? (compactCalendar ? 15 : 16)
      : (compactCalendar ? 19 : 21);

  const summaryFontPt =
    isA4
      ? (compactCalendar ? 7.8 : 8.4)
      : (compactCalendar ? 9.4 : 10.8);

  const summaryMarginTopMm =
    isA4
      ? (compactCalendar ? 2.2 : 2.8)
      : (compactCalendar ? 4 : 6);

  const summaryMarginBottomMm =
    isA4
      ? (compactCalendar ? 3 : 3.5)
      : (compactCalendar ? 5 : 8);

  const summaryPaddingMm =
    isA4
      ? (compactCalendar ? 2.3 : 2.6)
      : (compactCalendar ? 4 : 6);

  const weekdayHeaderHeightMm =
    isA4
      ? (compactCalendar ? 6.4 : 6.8)
      : (compactCalendar ? 8 : 9);

  const weekdayHeaderFontPt =
    isA4
      ? (compactCalendar ? 8 : 8.5)
      : (compactCalendar ? 10 : 11);

  const cellPaddingTopMm =
    isA4
      ? (compactCalendar ? 4.7 : 5)
      : (compactCalendar ? 5.6 : 6.2);

  const dayFontPt =
    isA4
      ? (compactCalendar ? 9 : 9.4)
      : 11;

  const holidayFontPt =
    isA4
      ? (compactCalendar ? 6 : 6.4)
      : (compactCalendar ? 7.2 : 8.2);

  const bandHeightMm =
    isA4
      ? (compactCalendar ? 3.8 : 4)
      : (compactCalendar ? 4.6 : 5.4);

  const bandFontPt =
    isA4
      ? (compactCalendar ? 5.6 : 5.9)
      : (compactCalendar ? 6.8 : 8);

  const noPlanFontPt =
    isA4
      ? (compactCalendar ? 5.5 : 5.9)
      : (compactCalendar ? 7.1 : 8.2);

  const footerFontPt =
    isA4
      ? (compactCalendar ? 5.6 : 6)
      : (compactCalendar ? 7 : 8.4);

  const dayTopMm =
    isA4 ? 1.2 : 1.6;

  const dayLeftMm =
    isA4 ? 1.2 : 1.8;

  const holidayTopMm =
    isA4 ? 1.1 : 1.1;

  const holidayLeftMm =
    isA4 ? 6.2 : 8;

  const noPlanMarginTopMm =
    isA4 ? 5 : 6;

  const html = `
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <title>販売予定カレンダー_${escapeSalesPlanHtml(month)}_${printPaperSize}</title>

  <style>
    @page {
      size: ${printPaperSize} landscape;
      margin: ${pageMarginMm}mm;
    }

    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    body {
      margin: 0;
      color: #000;
      font-family:
        "Yu Gothic",
        "Meiryo",
        sans-serif;
      font-size: ${bodyFontPt}pt;
      font-weight: 500;
    }

    h1 {
      margin: 0;
      text-align: center;
      font-size: ${titleFontPt}pt;
      font-weight: 800;
      line-height: 1.2;
    }

    .summary {
      display: flex;
      justify-content: space-between;
      gap: 10px;
      margin: ${summaryMarginTopMm}mm 0 ${summaryMarginBottomMm}mm;
      padding: ${summaryPaddingMm}mm 3.5mm;
      border: 1.2px solid #333;
      color: #000;
      font-size: ${summaryFontPt}pt;
      font-weight: 800;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
    }

    thead {
      display: table-header-group;
    }

    tbody {
      display: table-row-group;
    }

    tr,
    th,
    td {
      break-inside: avoid;
      page-break-inside: avoid;
    }

    th,
    td {
      border: 1.2px solid #333;
    }

    th {
      height: ${weekdayHeaderHeightMm}mm;
      padding: 2px;
      text-align: center;
      background: #f3f6fa;
      color: #000;
      font-size: ${weekdayHeaderFontPt}pt;
      font-weight: 800;
    }

    td {
      position: relative;
      height: ${rowHeightMm}mm;
      padding: ${cellPaddingTopMm}mm 0 0;
      vertical-align: top;
      color: #000;
      overflow: hidden;
    }

    .day-number {
      position: absolute;
      top: ${dayTopMm}mm;
      left: ${dayLeftMm}mm;
      z-index: 5;
      font-size: ${dayFontPt}pt;
      font-weight: 800;
      line-height: 1;
    }

    .sun .day-number,
    th.sun,
    .holiday .day-number {
      color: #b00020;
    }

    .sat .day-number,
    th.sat {
      color: #003ea8;
    }

    td.sun,
    td.holiday {
      background: #fff4f4;
    }

    td.sat {
      background: #f8fbff;
    }

    .holiday-name {
      position: absolute;
      top: ${holidayTopMm}mm;
      left: ${holidayLeftMm}mm;
      right: 1mm;
      z-index: 5;
      color: #b00020;
      font-size: ${holidayFontPt}pt;
      font-weight: 800;
      line-height: 1.05;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .outside {
      background: #f7f7f7;
    }

    .period-band {
      position: absolute;
      left: -0.5mm;
      right: -0.5mm;
      height: ${bandHeightMm}mm;
      padding: 0 1mm;
      background: #1565c0;
      color: #fff;
      font-size: ${bandFontPt}pt;
      font-weight: 800;
      line-height: ${bandHeightMm}mm;
      white-space: nowrap;
      overflow: hidden;
      z-index: 3;
    }

    .period-band span {
      display: block;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .period-band.band-start {
      left: 1mm;
      border-radius: 2mm 0 0 2mm;
    }

    .period-band.band-end {
      right: 1mm;
      border-radius: 0 2mm 2mm 0;
    }

    .period-band.band-start.band-end {
      border-radius: 2mm;
    }

.period-band.lane-0 {
      top: 8.6mm;
    }

.period-band.lane-1 {
      top: 14.5mm;
      background: #2e7d32;
    }

.period-band.lane-2 {
      top: 20.4mm;
      background: #6a1b9a;
    }

.period-band.lane-3 {
      top: 26.3mm;
      background: #ef6c00;
    }

    .band-more {
      position: absolute;
      left: 1.5mm;
      right: 1.5mm;
      bottom: 1.8mm;
      color: #b00020;
      font-size: ${noPlanFontPt}pt;
      font-weight: 800;
      text-align: right;
    }

    .no-plan {
      margin-top: ${noPlanMarginTopMm}mm;
      text-align: center;
      color: #666;
      font-size: ${noPlanFontPt}pt;
      font-weight: 600;
    }

    .footer {
      margin-top: 2px;
      text-align: right;
      color: #333;
      font-size: ${footerFontPt}pt;
      font-weight: 600;
    }
  </style>
</head>

<body>
  <h1>${escapeSalesPlanHtml(calendarHeading)}</h1>

  <div class="summary">
    <span>販売予定：${plans.length.toLocaleString("ja-JP")}件</span>
    <span>予定数量合計：${totalQuantity.toLocaleString("ja-JP")}個</span>
    <span>印刷日時：${escapeSalesPlanHtml(printedAt)}</span>
  </div>

  <table>
    <thead>
      <tr>${weekdayHeaders}</tr>
    </thead>

    <tbody>
      ${weekRows.join("")}
    </tbody>
  </table>

  <div class="footer">
    ${escapeSalesPlanHtml(calendarTargetLabel)}<br>
    ※ 出荷期間は色付きの帯で表示します。帯の先頭に取引先名・副題を表示し、詳細はリスト形式で確認してください。
  </div>
</body>
</html>
  `;

  printWindow.document.open();
  printWindow.document.write(
    html
  );
  printWindow.document.close();

  printWindow.focus();

  window.setTimeout(
    function () {
      try {
        printWindow.print();
      } catch (error) {
        console.error(
          "販売予定カレンダー印刷エラー",
          error
        );
      }
    },
    500
  );
}

function getSalesPlanCalendarVisibleLaneLimit(
  weekCount,
  paperSize
) {
  const isA4 =
    normalizeSalesPlanPrintPaperSize(
      paperSize
    ) === "A4";

  if (isA4) {
    if (weekCount <= 4) {
      return 7;
    }

    if (weekCount === 5) {
      return 5;
    }

    return 4;
  }

  if (weekCount <= 4) {
    return 8;
  }

  if (weekCount === 5) {
    return 7;
  }

  return 6;
}

function getSalesPlanCalendarBandTopMm(
  lane,
  weekCount,
  paperSize
) {
  const compact =
    weekCount >= 5;

  const isA4 =
    normalizeSalesPlanPrintPaperSize(
      paperSize
    ) === "A4";

  const start =
    isA4
      ? (compact ? 5.7 : 6)
      : (compact ? 7.4 : 8.2);

  const gap =
    isA4
      ? (compact ? 4.1 : 4.4)
      : (compact ? 5.0 : 5.7);

  return start + lane * gap;
}

function getSalesPlanCalendarBandColor(
  lane
) {
  const colors = [
    "#1565c0",
    "#2e7d32",
    "#6a1b9a",
    "#ef6c00",
    "#00838f",
    "#ad1457",
    "#5d4037"
  ];

  return colors[
    lane % colors.length
  ];
}

function buildSalesPlanCalendarPrintData(
  plans,
  month,
  paperSize
) {
  const match =
    /^(\d{4})-(\d{2})$/.exec(
      String(
        month || ""
      )
    );

  if (!match) {
    return {
      cells: [],
      weekCount: 0
    };
  }

  const year =
    Number(
      match[1]
    );

  const monthNumber =
    Number(
      match[2]
    );

  const firstDate =
    new Date(
      year,
      monthNumber - 1,
      1
    );

  const lastDay =
    new Date(
      year,
      monthNumber,
      0
    ).getDate();

  const firstWeekday =
    firstDate.getDay();

  const monthStart =
    `${match[1]}-${match[2]}-01`;

  const monthEnd =
    `${match[1]}-${match[2]}-${String(lastDay).padStart(2, "0")}`;

  const groupedPeriods =
    buildSalesPlanCalendarPeriodGroups(
      plans,
      monthStart,
      monthEnd
    );

  const cells = [];

  for (
    let index = 0;
    index < firstWeekday;
    index += 1
  ) {
    cells.push({
      inMonth: false
    });
  }

  for (
    let day = 1;
    day <= lastDay;
    day += 1
  ) {
    const date =
      `${match[1]}-${match[2]}-${String(day).padStart(2, "0")}`;

    const weekday =
      new Date(
        year,
        monthNumber - 1,
        day
      ).getDay();

    cells.push({
      inMonth: true,
      day: day,
      weekday: weekday,
      date: date,
      bands: [],
      hiddenBandCount: 0
    });
  }

  while (
    cells.length % 7 !== 0
  ) {
    cells.push({
      inMonth: false
    });
  }

  const weekCount =
    cells.length / 7;

  const visibleLaneLimit =
    getSalesPlanCalendarVisibleLaneLimit(
      weekCount,
      paperSize
    );

  for (
    let weekIndex = 0;
    weekIndex < weekCount;
    weekIndex += 1
  ) {
    const weekCells =
      cells.slice(
        weekIndex * 7,
        weekIndex * 7 + 7
      );

    const inMonthCells =
      weekCells.filter(
        function (cell) {
          return cell.inMonth;
        }
      );

    if (
      inMonthCells.length === 0
    ) {
      continue;
    }

    const weekStart =
      inMonthCells[0].date;

    const weekEnd =
      inMonthCells[
        inMonthCells.length - 1
      ].date;

    const weekPeriods =
      groupedPeriods
        .filter(
          function (period) {
            return (
              period.endDate >=
                weekStart &&
              period.startDate <=
                weekEnd
            );
          }
        )
        .sort(
          function (left, right) {
            const startCompare =
              left.startDate.localeCompare(
                right.startDate
              );

            if (
              startCompare !== 0
            ) {
              return startCompare;
            }

            const endCompare =
              right.endDate.localeCompare(
                left.endDate
              );

            if (
              endCompare !== 0
            ) {
              return endCompare;
            }

            return left.label.localeCompare(
              right.label,
              "ja"
            );
          }
        );

    const laneEnds = [];

    weekPeriods.forEach(
      function (period) {
        const segmentStart =
          period.startDate <
          weekStart
            ? weekStart
            : period.startDate;

        const segmentEnd =
          period.endDate >
          weekEnd
            ? weekEnd
            : period.endDate;

        let lane = 0;

        while (
          lane <
          laneEnds.length &&
          laneEnds[lane] >=
            segmentStart
        ) {
          lane += 1;
        }

        if (
          lane ===
          laneEnds.length
        ) {
          laneEnds.push(
            segmentEnd
          );
        } else {
          laneEnds[lane] =
            segmentEnd;
        }

        for (
          const cell of
          weekCells
        ) {
          if (
            !cell.inMonth ||
            cell.date <
              segmentStart ||
            cell.date >
              segmentEnd
          ) {
            continue;
          }

          if (
            lane >= visibleLaneLimit
          ) {
            cell.hiddenBandCount +=
              1;

            continue;
          }

          cell.bands.push({
            lane: lane,
            label:
              period.label,
            isStart:
              cell.date ===
              segmentStart,
            isEnd:
              cell.date ===
              segmentEnd,
            showLabel:
              cell.date ===
              segmentStart
          });
        }
      }
    );
  }

  return {
    cells: cells,
    weekCount: weekCount
  };
}

function formatSalesPlanCalendarShortDate(
  dateString
) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(
      String(dateString || "")
    )
  ) {
    return "";
  }

  const parts =
    String(dateString)
      .split("-")
      .map(Number);

  return `${parts[1]}/${parts[2]}`;
}

function buildSalesPlanCalendarPeriodGroups(
  plans,
  monthStart,
  monthEnd
) {
  const groups =
    new Map();

  plans.forEach(
    function (record) {
      const range =
        getSalesPlanCalendarRange(
          record
        );

      if (
        !range ||
        !range.startDate ||
        !range.endDate
      ) {
        return;
      }

      if (
        range.endDate <
          monthStart ||
        range.startDate >
          monthEnd
      ) {
        return;
      }

      const clippedStart =
        range.startDate <
        monthStart
          ? monthStart
          : range.startDate;

      const clippedEnd =
        range.endDate >
        monthEnd
          ? monthEnd
          : range.endDate;

      const key =
        [
          record.customerName || "",
          record.subtitle || "",
          range.startDate,
          range.endDate
        ].join(
          "||"
        );

      if (
        !groups.has(
          key
        )
      ) {
        groups.set(
          key,
          {
            startDate:
              clippedStart,
            endDate:
              clippedEnd,
            originalStartDate:
              range.startDate,
            originalEndDate:
              range.endDate,
            customerName:
              record.customerName ||
              "取引先未登録",
            subtitle:
              record.subtitle || "",
            productCodes:
              new Set(),
            totalQuantity:
              0
          }
        );
      }

      const group =
        groups.get(
          key
        );

      group.totalQuantity +=
        Number(
          record.quantity || 0
        );

      const productKey =
        String(
          record.internalCode ||
          record.productCode ||
          record.productName ||
          ""
        );

      if (productKey) {
        group.productCodes.add(
          productKey
        );
      }
    }
  );

  return Array.from(
    groups.values()
  )
    .map(
      function (group) {
        const subtitleText =
          group.subtitle
            ? ` / ${group.subtitle}`
            : "";

        const startLabel =
          formatSalesPlanCalendarShortDate(
            group.originalStartDate
          );

        const endLabel =
          formatSalesPlanCalendarShortDate(
            group.originalEndDate
          );

        const dateText =
          startLabel && endLabel
            ? (
                startLabel === endLabel
                  ? ` ${startLabel}`
                  : ` ${startLabel}〜${endLabel}`
              )
            : "";

        return {
          ...group,
          label:
            `${group.customerName}${subtitleText}${dateText}`,
          productCount:
            group.productCodes.size
        };
      }
    );
}

function getSalesPlanCalendarRange(
  record
) {
  const type =
    getSalesPlanShippingType(
      record
    );

  if (
    type === "date"
  ) {
    const date =
      String(
        record.shippingDate || ""
      );

    if (!date) {
      return null;
    }

    return {
      startDate: date,
      endDate: date
    };
  }

  if (
    type === "period"
  ) {
    const startDate =
      String(
        record.shippingStartDate ||
        ""
      );

    const endDate =
      String(
        record.shippingEndDate ||
        ""
      );

    if (
      !startDate ||
      !endDate
    ) {
      return null;
    }

    return {
      startDate: startDate,
      endDate: endDate
    };
  }

  if (
    type === "month"
  ) {
    const shippingMonth =
      String(
        record.shippingMonth ||
        ""
      );

    if (
      !/^\d{4}-\d{2}$/.test(
        shippingMonth
      )
    ) {
      return null;
    }

    const parts =
      shippingMonth
        .split("-")
        .map(Number);

    const lastDay =
      new Date(
        parts[0],
        parts[1],
        0
      ).getDate();

    return {
      startDate:
        `${shippingMonth}-01`,
      endDate:
        `${shippingMonth}-${String(lastDay).padStart(2, "0")}`
    };
  }

  return null;
}

function getSalesPlanCalendarAnchorDate(
  record,
  monthStart,
  monthEnd
) {
  const type =
    getSalesPlanShippingType(
      record
    );

  if (
    type === "date"
  ) {
    return (
      record.shippingDate >=
        monthStart &&
      record.shippingDate <=
        monthEnd
        ? record.shippingDate
        : ""
    );
  }

  if (
    type === "period"
  ) {
    if (
      record.shippingStartDate >
        monthEnd ||
      record.shippingEndDate <
        monthStart
    ) {
      return "";
    }

    return (
      record.shippingStartDate <
      monthStart
        ? monthStart
        : record.shippingStartDate
    );
  }

  if (
    type === "month"
  ) {
    return (
      record.shippingMonth ===
      monthStart.slice(
        0,
        7
      )
        ? monthStart
        : ""
    );
  }

  return "";
}

function getSalesPlanJapaneseHoliday(
  isoDate
) {
  const holidays = {
    "2026-01-01": "元日",
    "2026-01-12": "成人の日",
    "2026-02-11": "建国記念の日",
    "2026-02-23": "天皇誕生日",
    "2026-03-20": "春分の日",
    "2026-04-29": "昭和の日",
    "2026-05-03": "憲法記念日",
    "2026-05-04": "みどりの日",
    "2026-05-05": "こどもの日",
    "2026-05-06": "休日",
    "2026-07-20": "海の日",
    "2026-08-11": "山の日",
    "2026-09-21": "敬老の日",
    "2026-09-22": "休日",
    "2026-09-23": "秋分の日",
    "2026-10-12": "スポーツの日",
    "2026-11-03": "文化の日",
    "2026-11-23": "勤労感謝の日",

    "2027-01-01": "元日",
    "2027-01-11": "成人の日",
    "2027-02-11": "建国記念の日",
    "2027-02-23": "天皇誕生日",
    "2027-03-21": "春分の日",
    "2027-03-22": "休日",
    "2027-04-29": "昭和の日",
    "2027-05-03": "憲法記念日",
    "2027-05-04": "みどりの日",
    "2027-05-05": "こどもの日",
    "2027-07-19": "海の日",
    "2027-08-11": "山の日",
    "2027-09-20": "敬老の日",
    "2027-09-23": "秋分の日",
    "2027-10-11": "スポーツの日",
    "2027-11-03": "文化の日",
    "2027-11-23": "勤労感謝の日"
  };

  return (
    holidays[
      String(
        isoDate || ""
      )
    ] || ""
  );
}

function formatSalesPlanPrintMonth(
  month
) {
  const match =
    /^(\d{4})-(\d{2})$/.exec(
      String(
        month || ""
      )
    );

  if (!match) {
    return (
      month ||
      "販売予定"
    );
  }

  return (
    `${match[1]}年${Number(match[2])}月`
  );
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
      record.subtitle,
      record.remarks,
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
      <td>${escapeSalesPlanHtml(record.subtitle || "－")}</td>
      <td class="sales-plan-remarks-cell">${escapeSalesPlanHtml(record.remarks || "－")}</td>
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
    cell.colSpan = 9;
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

  const customerCompare = String(a.customerName || "").localeCompare(
    String(b.customerName || ""),
    "ja"
  );
  if (customerCompare !== 0) return customerCompare;

  // 同じ取引先の販売予定は、副題ごとにまとめて表示します。
  // これにより、同じ案件・便名の商品が社内コード順で離れてしまうのを防ぎます。
  const subtitleCompare = String(a.subtitle || "").localeCompare(
    String(b.subtitle || ""),
    "ja",
    { numeric: true }
  );
  if (subtitleCompare !== 0) return subtitleCompare;

  return String(a.internalCode || "").localeCompare(
    String(b.internalCode || ""),
    "ja",
    { numeric: true }
  );
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
    .sales-plan-product-search-wrap { position: relative; }
    .sales-plan-product-suggestions { position: absolute; z-index: 60; top: calc(100% + 6px); left: 0; right: 0; max-height: 360px; overflow-y: auto; padding: 8px; border: 2px solid #90caf9; border-radius: 10px; background: #fff; box-shadow: 0 12px 28px rgba(15, 45, 70, .22); }
    .sales-plan-product-suggestions[hidden] { display: none !important; }
    .sales-plan-product-suggestion { width: 100%; margin: 0 0 7px; padding: 12px 14px; border: 1px solid #c8d7e1; border-radius: 8px; background: #fff; color: #16324a; text-align: left; display: grid; gap: 4px; }
    .sales-plan-product-suggestion:last-child { margin-bottom: 0; }
    .sales-plan-product-suggestion:hover, .sales-plan-product-suggestion:focus { background: #e3f2fd; border-color: #1976d2; outline: none; }
    .sales-plan-product-suggestion strong { font-size: 1rem; }
    .sales-plan-product-suggestion span { font-size: .92rem; font-weight: 600; line-height: 1.45; }
    .sales-plan-readonly { background: #eef3f6; }
    .sales-plan-shipping-note { margin: -4px 0 0; padding: 10px 12px; border-radius: 8px; background: #e3f2fd; color: #164e63; }
    #sales-plan-shipping-date-area[hidden],
    #sales-plan-shipping-period-start-area[hidden],
    #sales-plan-shipping-period-end-area[hidden] { display: none !important; }
    .sales-plan-screen-shortcuts { display: flex; flex-wrap: wrap; gap: 10px; margin: 0 0 16px; }
    .sales-plan-screen-shortcuts button { flex: 1 1 220px; margin: 0; }
    #jump-sales-plan-list-button { background: #00695c; }
    .sales-plan-add-item-area {
      display: grid;
      gap: 8px;
      margin-top: 2px;
      padding: 14px;
      border: 2px solid #90caf9;
      border-radius: 10px;
      background: #f4fbff;
    }
    #add-sales-plan-item-button {
      width: 100%;
      margin: 0;
      min-height: 52px;
      background: #1976d2;
      font-size: 1rem;
      font-weight: 800;
    }
    .sales-plan-add-item-note {
      margin: 0;
      color: #455a64;
      line-height: 1.5;
    }
    .sales-plan-pending-area {
      padding: 16px;
      border: 2px solid #a5d6a7;
      border-radius: 12px;
      background: #f5fff6;
    }
    .sales-plan-pending-area[hidden] {
      display: none !important;
    }
    .sales-plan-pending-heading {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      margin-bottom: 10px;
    }
    .sales-plan-pending-heading h4 {
      margin: 0;
      font-size: 1.05rem;
    }
    #sales-plan-pending-summary {
      color: #1b5e20;
      font-size: 1rem;
    }
    .sales-plan-pending-list {
      display: grid;
      gap: 8px;
    }
    .sales-plan-pending-empty {
      margin: 0;
      padding: 12px;
      border-radius: 8px;
      background: #ffffff;
      color: #607d8b;
      text-align: center;
    }
    .sales-plan-pending-item {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto auto;
      gap: 12px;
      align-items: center;
      padding: 12px;
      border: 1px solid #c8e6c9;
      border-radius: 9px;
      background: #ffffff;
    }
    .sales-plan-pending-item-info {
      min-width: 0;
      display: grid;
      gap: 4px;
    }
    .sales-plan-pending-item-info strong {
      font-size: 1rem;
    }
    .sales-plan-pending-item-info span {
      color: #546e7a;
      font-size: .9rem;
      line-height: 1.4;
    }
    .sales-plan-pending-quantity {
      min-width: 82px;
      text-align: right;
      color: #1b5e20;
      font-size: 1.05rem;
    }
    .sales-plan-pending-remove {
      margin: 0 !important;
      padding: 9px 14px !important;
      background: #c62828 !important;
    }
    #save-sales-plan-button:disabled {
      background: #b0bec5 !important;
      cursor: not-allowed;
    }
    .sales-plan-form-actions, .sales-plan-filter-row, .sales-plan-pager { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
    .sales-plan-filter-row > * { flex: 1 1 230px; }
    .sales-plan-table-wrap { overflow-x: auto; margin-top: 12px; }
    #sales-plan table { min-width: 1020px; width: 100%; border-collapse: collapse; }
    #sales-plan th, #sales-plan td { border: 1px solid #c8d7e1; padding: 10px; vertical-align: middle; }
    #sales-plan th { background: #00695c; color: white; white-space: nowrap; }
    .sales-plan-number { text-align: right; }
    .sales-plan-actions { white-space: nowrap; }
    .sales-plan-actions button { margin-right: 6px; }
    .sales-plan-delete-button { background: #c62828 !important; }
    .sales-plan-summary-box { background: #e8f5e9; border-radius: 10px; padding: 12px 14px; font-weight: 700; margin-top: 12px; }
    .sales-plan-print-area {
      display: grid;
      grid-template-columns: minmax(220px, 300px) repeat(2, minmax(230px, 1fr));
      gap: 10px 14px;
      align-items: end;
      margin-top: 14px;
      padding: 14px;
      border: 2px solid #90caf9;
      border-radius: 12px;
      background: #f5fbff;
    }
    .sales-plan-print-button-group {
      display: grid;
      gap: 6px;
    }
    .sales-plan-print-button-group > strong {
      color: #16324a;
      font-size: .95rem;
    }
    .sales-plan-print-button-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }
    .sales-plan-print-area button {
      width: 100%;
      min-height: 48px;
      margin: 0;
      background: #1565c0;
      font-weight: 800;
    }
    .sales-plan-print-note {
      grid-column: 1 / -1;
      margin: 0;
      color: #455a64;
      line-height: 1.5;
    }
    .sales-plan-product-choice-modal { width: min(760px, calc(100vw - 28px)); }
    .sales-plan-product-choice-list { display: grid; gap: 10px; max-height: 42vh; overflow-y: auto; margin: 14px 0; padding: 4px; }
    .sales-plan-product-choice-button { width: 100%; margin: 0; padding: 14px 16px; border: 2px solid #90caf9; border-radius: 10px; background: #fff; color: #16324a; text-align: left; display: grid; gap: 5px; }
    .sales-plan-product-choice-button:hover, .sales-plan-product-choice-button:focus { background: #e3f2fd; border-color: #1976d2; }
    .sales-plan-product-choice-button strong { font-size: 1.05rem; }
    .sales-plan-product-choice-button span { font-size: .95rem; font-weight: 600; }
    .sales-plan-pager { justify-content: center; margin-top: 14px; }
    #show-sales-plan-button { background: #00897b; }
    #show-sales-plan-list-button { background: #00695c; }
    @media (max-width: 720px) {
      .sales-plan-form-grid { grid-template-columns: 1fr; }
      .sales-plan-form-grid .sales-plan-full { grid-column: auto; }
      .sales-plan-product-row { grid-template-columns: 1fr; }
      .sales-plan-pending-item {
        grid-template-columns: 1fr auto;
      }
      .sales-plan-pending-item-info {
        grid-column: 1 / -1;
      }
      .sales-plan-pending-quantity {
        text-align: left;
      }
      .sales-plan-print-area {
        grid-template-columns: 1fr;
      }
      .sales-plan-print-button-row {
        grid-template-columns: 1fr 1fr;
      }
      .sales-plan-print-note {
        grid-column: auto;
      }
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
