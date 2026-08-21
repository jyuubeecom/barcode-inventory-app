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
  } else {
    // 完全一致がないときだけ、社内コード・商品コード・商品名の部分一致候補を表示します。
    matches = salesPlanProducts
      .filter(function (product) {
        const internalCode = normalizeSalesPlanSearchText(product.internalCode);
        const productCode = normalizeSalesPlanSearchText(product.productCode);
        const productName = normalizeSalesPlanSearchText(product.productName);

        return (
          internalCode.includes(target) ||
          productCode.includes(target) ||
          productName.includes(target)
        );
      })
      .sort(function (a, b) {
        const aInternal = normalizeSalesPlanSearchText(a.internalCode);
        const bInternal = normalizeSalesPlanSearchText(b.internalCode);
        const aProduct = normalizeSalesPlanSearchText(a.productCode);
        const bProduct = normalizeSalesPlanSearchText(b.productCode);

        const getRank = function (internalCode, productCode) {
          if (internalCode.startsWith(target)) return 0;
          if (productCode.startsWith(target)) return 1;
          return 2;
        };

        const rankDiff =
          getRank(aInternal, aProduct) -
          getRank(bInternal, bProduct);

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
    codes.textContent = `社内コード：${product.internalCode || "未登録"}　商品コード：${product.productCode || "未登録"}`;

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
        title: "社内コードまたは商品コードを入力してください",
        message: "販売予定の商品を検索するコードを入力してください。",
        notice: "社内コード・商品コードのどちらでも検索できます。",
        confirmText: "入力に戻る"
      });
    } else if (!findSalesPlanProductMatches(enteredCode).length) {
      await showSalesPlanDialog({
        type: "danger",
        icon: "🔎",
        title: "商品が見つかりません",
        message: "入力した社内コード・商品コードに一致する商品は登録されていません。",
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

  return salesPlanProducts.filter(function (product) {
    return normalizeSalesPlanSearchText(product.productCode) === target;
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
    title.textContent = "同じ商品コードの商品が複数あります";

    header.appendChild(icon);
    header.appendChild(title);

    const content = document.createElement("div");
    content.className = "app-dialog-content";

    const message = document.createElement("p");
    message.className = "app-dialog-message";
    message.textContent = "登録する商品を選んでください。商品コードは重複登録できるため、社内コードと商品名を確認してください。";
    content.appendChild(message);

    const details = document.createElement("div");
    details.className = "app-dialog-details";
    const row = document.createElement("div");
    row.className = "app-dialog-detail-row";
    const label = document.createElement("strong");
    label.textContent = "入力した商品コード";
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
        codes.textContent = `社内コード：${product.internalCode || "未登録"}　商品コード：${product.productCode || "未登録"}`;

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
    notice.textContent = "商品コードが同じでも、社内コードが違えば別の商品として管理されています。";
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
          "社内コード・商品コード・商品名から検索できます。",
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
        "商品ごとに1件ずつ販売予定として保存します。取引先名・副題・出荷時期はすべて同じ内容になります。",
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
    cell.colSpan = 8;
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
