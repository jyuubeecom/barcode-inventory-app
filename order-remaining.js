"use strict";

const ORDER_REMAINING_PAGE_SIZE = 20;
const ORDER_REMAINING_HISTORY_PAGE_SIZE = 20;

let orderRemainingProducts = [];
let orderRemainingCurrentPage = 1;
let orderRemainingCsvPreview = null;
let orderRemainingHistories = [];
let orderRemainingHistoryCurrentPage = 1;

window.addEventListener(
  "DOMContentLoaded",
  initializeOrderRemainingFeature
);

function initializeOrderRemainingFeature() {
  const showButton =
    document.querySelector(
      "#show-order-remaining-button"
    );

  const backButton =
    document.querySelector(
      "#back-home-from-order-remaining"
    );

  const searchInput =
    document.querySelector(
      "#order-remaining-search"
    );

  const filterSelect =
    document.querySelector(
      "#order-remaining-filter"
    );

  const sortSelect =
    document.querySelector(
      "#order-remaining-sort"
    );

  const refreshButton =
    document.querySelector(
      "#refresh-order-remaining-button"
    );

  const prevButton =
    document.querySelector(
      "#order-remaining-prev-page"
    );

  const nextButton =
    document.querySelector(
      "#order-remaining-next-page"
    );

  const exportCsvButton =
    document.querySelector(
      "#export-order-remaining-csv"
    );

  const importCsvButton =
    document.querySelector(
      "#import-order-remaining-csv"
    );

  const csvFileInput =
    document.querySelector(
      "#order-remaining-csv-file"
    );

  const applyCsvButton =
    document.querySelector(
      "#apply-order-remaining-csv"
    );

  const closeCsvPreviewButton =
    document.querySelector(
      "#close-order-remaining-csv-preview"
    );

  const historyToggleButton =
    document.querySelector(
      "#toggle-order-remaining-history"
    );

  const historySearchInput =
    document.querySelector(
      "#order-remaining-history-search"
    );

  const historySourceFilter =
    document.querySelector(
      "#order-remaining-history-source"
    );

  const historyPrevButton =
    document.querySelector(
      "#order-remaining-history-prev"
    );

  const historyNextButton =
    document.querySelector(
      "#order-remaining-history-next"
    );

  const exportHistoryCsvButton =
    document.querySelector(
      "#export-order-remaining-history-csv"
    );

  if (!showButton) {
    return;
  }

  createOrderRemainingStyle();

  showButton.addEventListener(
    "click",
    openOrderRemainingScreen
  );

  if (backButton) {
    backButton.addEventListener(
      "click",
      closeOrderRemainingScreen
    );
  }

  if (searchInput) {
    searchInput.addEventListener(
      "input",
      function () {
        orderRemainingCurrentPage = 1;
        renderOrderRemainingScreen();
      }
    );
  }

  if (filterSelect) {
    filterSelect.addEventListener(
      "change",
      function () {
        orderRemainingCurrentPage = 1;
        renderOrderRemainingScreen();
      }
    );
  }

  if (sortSelect) {
    sortSelect.addEventListener(
      "change",
      function () {
        orderRemainingCurrentPage = 1;
        renderOrderRemainingScreen();
      }
    );
  }

  if (refreshButton) {
    refreshButton.addEventListener(
      "click",
      loadOrderRemainingProducts
    );
  }

  if (prevButton) {
    prevButton.addEventListener(
      "click",
      function () {
        if (
          orderRemainingCurrentPage >
          1
        ) {
          orderRemainingCurrentPage -= 1;
          renderOrderRemainingScreen();
          scrollOrderRemainingListIntoView();
        }
      }
    );
  }

  if (nextButton) {
    nextButton.addEventListener(
      "click",
      function () {
        const totalPages =
          getOrderRemainingTotalPages();

        if (
          orderRemainingCurrentPage <
          totalPages
        ) {
          orderRemainingCurrentPage += 1;
          renderOrderRemainingScreen();
          scrollOrderRemainingListIntoView();
        }
      }
    );
  }

  if (exportCsvButton) {
    exportCsvButton.addEventListener(
      "click",
      exportOrderRemainingCsv
    );
  }

  if (
    importCsvButton &&
    csvFileInput
  ) {
    importCsvButton.addEventListener(
      "click",
      function () {
        csvFileInput.value = "";
        csvFileInput.click();
      }
    );

    csvFileInput.addEventListener(
      "change",
      function () {
        const file =
          csvFileInput.files &&
          csvFileInput.files[0];

        if (file) {
          void previewOrderRemainingCsv(
            file
          );
        }
      }
    );
  }

  if (applyCsvButton) {
    applyCsvButton.addEventListener(
      "click",
      function () {
        void applyOrderRemainingCsv();
      }
    );
  }

  if (closeCsvPreviewButton) {
    closeCsvPreviewButton.addEventListener(
      "click",
      clearOrderRemainingCsvPreview
    );
  }

  if (historyToggleButton) {
    historyToggleButton.addEventListener(
      "click",
      function () {
        void toggleOrderRemainingHistoryPanel();
      }
    );
  }

  if (historySearchInput) {
    historySearchInput.addEventListener(
      "input",
      function () {
        orderRemainingHistoryCurrentPage = 1;
        renderOrderRemainingHistory();
      }
    );
  }

  if (historySourceFilter) {
    historySourceFilter.addEventListener(
      "change",
      function () {
        orderRemainingHistoryCurrentPage = 1;
        renderOrderRemainingHistory();
      }
    );
  }

  if (historyPrevButton) {
    historyPrevButton.addEventListener(
      "click",
      function () {
        if (
          orderRemainingHistoryCurrentPage >
          1
        ) {
          orderRemainingHistoryCurrentPage -= 1;
          renderOrderRemainingHistory();
        }
      }
    );
  }

  if (historyNextButton) {
    historyNextButton.addEventListener(
      "click",
      function () {
        const totalPages =
          getOrderRemainingHistoryTotalPages();

        if (
          orderRemainingHistoryCurrentPage <
          totalPages
        ) {
          orderRemainingHistoryCurrentPage += 1;
          renderOrderRemainingHistory();
        }
      }
    );
  }

  if (exportHistoryCsvButton) {
    exportHistoryCsvButton.addEventListener(
      "click",
      exportOrderRemainingHistoryCsv
    );
  }
}

async function openOrderRemainingScreen() {
  if (
    document.body.dataset.roleMode ===
    "worker"
  ) {
    await showOrderRemainingDialog({
      type: "warning",
      icon: "🔒",
      title: "管理者専用の画面です",
      message:
        "発注残数の編集は管理者モードで行ってください。",
      confirmText: "閉じる"
    });

    return;
  }

  document
    .querySelectorAll("main > section")
    .forEach(function (section) {
      section.hidden = true;
    });

  const screen =
    document.querySelector(
      "#order-remaining-management"
    );

  if (!screen) {
    return;
  }

  screen.hidden = false;
  orderRemainingCurrentPage = 1;

  await loadOrderRemainingProducts();

  screen.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

function closeOrderRemainingScreen() {
  clearOrderRemainingCsvPreview();

  const historyPanel =
    document.querySelector(
      "#order-remaining-history-panel"
    );

  const historyToggleButton =
    document.querySelector(
      "#toggle-order-remaining-history"
    );

  if (historyPanel) {
    historyPanel.hidden = true;
  }

  if (historyToggleButton) {
    historyToggleButton.textContent =
      "発注残変更履歴を見る";
  }

  const screen =
    document.querySelector(
      "#order-remaining-management"
    );

  if (screen) {
    screen.hidden = true;
  }

  if (
    window.inventoryApp &&
    typeof window.inventoryApp.showScreen ===
      "function"
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

async function loadOrderRemainingProducts() {
  const message =
    document.querySelector(
      "#order-remaining-save-message"
    );

  if (message) {
    message.textContent =
      "発注残データを読み込んでいます...";
    message.className =
      "order-remaining-save-message";
  }

  try {
    const products =
      await getAllProducts();

    orderRemainingProducts =
      products.map(
        normalizeOrderRemainingProduct
      );

    renderOrderRemainingScreen();

    if (message) {
      message.textContent = "";
    }
  } catch (error) {
    console.error(
      "発注残一覧読み込みエラー",
      error
    );

    if (message) {
      message.textContent =
        "発注残データを読み込めませんでした。";
      message.className =
        "order-remaining-save-message order-remaining-message-error";
    }

    await showOrderRemainingDialog({
      type: "danger",
      icon: "⚠️",
      title: "発注残一覧を読み込めませんでした",
      message:
        "画面を更新して、もう一度お試しください。",
      confirmText: "閉じる"
    });
  }
}

function normalizeOrderRemainingProduct(
  product
) {
  const stock =
    getOrderRemainingNumber(
      product && product.stock
    );

  const orderRemaining =
    getOrderRemainingNumber(
      product &&
        product.orderRemaining
    );

  return {
    ...product,
    stock: stock,
    orderRemaining: orderRemaining
  };
}

function getOrderRemainingNumber(value) {
  const number =
    Number(value);

  if (
    !Number.isInteger(number) ||
    number < 0
  ) {
    return 0;
  }

  return number;
}

function renderOrderRemainingScreen() {
  renderOrderRemainingSummary();
  renderOrderRemainingList();
}

function renderOrderRemainingSummary() {
  const count =
    document.querySelector(
      "#order-remaining-product-count"
    );

  const total =
    document.querySelector(
      "#order-remaining-total-count"
    );

  const remainingProducts =
    orderRemainingProducts.filter(
      function (product) {
        return (
          product.orderRemaining > 0
        );
      }
    );

  const remainingTotal =
    remainingProducts.reduce(
      function (sum, product) {
        return (
          sum +
          product.orderRemaining
        );
      },
      0
    );

  if (count) {
    count.textContent =
      remainingProducts.length.toLocaleString(
        "ja-JP"
      );
  }

  if (total) {
    total.textContent =
      remainingTotal.toLocaleString(
        "ja-JP"
      );
  }
}

function getFilteredOrderRemainingProducts() {
  const searchInput =
    document.querySelector(
      "#order-remaining-search"
    );

  const filterSelect =
    document.querySelector(
      "#order-remaining-filter"
    );

  const sortSelect =
    document.querySelector(
      "#order-remaining-sort"
    );

  const term =
    normalizeOrderRemainingSearchText(
      searchInput
        ? searchInput.value
        : ""
    );

  const filter =
    filterSelect
      ? filterSelect.value
      : "remaining";

  const sort =
    sortSelect
      ? sortSelect.value
      : "remaining-desc";

  const filtered =
    orderRemainingProducts.filter(
      function (product) {
        if (
          filter === "remaining" &&
          product.orderRemaining <= 0
        ) {
          return false;
        }

        if (
          filter === "zero" &&
          product.orderRemaining !== 0
        ) {
          return false;
        }

        if (!term) {
          return true;
        }

        return [
          product.internalCode,
          product.productCode,
          product.productName,
          product.supplier,
          product.location
        ].some(function (value) {
          return normalizeOrderRemainingSearchText(
            value
          ).includes(term);
        });
      }
    );

  filtered.sort(
    function (a, b) {
      if (
        sort === "internal-code"
      ) {
        return String(
          a.internalCode || ""
        ).localeCompare(
          String(
            b.internalCode || ""
          ),
          "ja",
          {
            numeric: true
          }
        );
      }

      if (
        sort === "product-name"
      ) {
        return String(
          a.productName || ""
        ).localeCompare(
          String(
            b.productName || ""
          ),
          "ja"
        );
      }

      if (
        sort === "supplier"
      ) {
        return (
          String(
            a.supplier || ""
          ).localeCompare(
            String(
              b.supplier || ""
            ),
            "ja"
          ) ||
          String(
            a.internalCode || ""
          ).localeCompare(
            String(
              b.internalCode || ""
            ),
            "ja",
            {
              numeric: true
            }
          )
        );
      }

      return (
        b.orderRemaining -
          a.orderRemaining ||
        String(
          a.internalCode || ""
        ).localeCompare(
          String(
            b.internalCode || ""
          ),
          "ja",
          {
            numeric: true
          }
        )
      );
    }
  );

  return filtered;
}

function normalizeOrderRemainingSearchText(
  value
) {
  return String(value || "")
    .normalize("NFKC")
    .trim()
    .toLowerCase();
}

function renderOrderRemainingList() {
  const list =
    document.querySelector(
      "#order-remaining-card-list"
    );

  const count =
    document.querySelector(
      "#order-remaining-filter-count"
    );

  const pageStatus =
    document.querySelector(
      "#order-remaining-page-status"
    );

  const prev =
    document.querySelector(
      "#order-remaining-prev-page"
    );

  const next =
    document.querySelector(
      "#order-remaining-next-page"
    );

  if (!list) {
    return;
  }

  const filtered =
    getFilteredOrderRemainingProducts();

  const totalPages =
    Math.max(
      1,
      Math.ceil(
        filtered.length /
          ORDER_REMAINING_PAGE_SIZE
      )
    );

  if (
    orderRemainingCurrentPage >
    totalPages
  ) {
    orderRemainingCurrentPage =
      totalPages;
  }

  const start =
    (
      orderRemainingCurrentPage -
      1
    ) *
    ORDER_REMAINING_PAGE_SIZE;

  const visible =
    filtered.slice(
      start,
      start +
        ORDER_REMAINING_PAGE_SIZE
    );

  list.innerHTML = "";

  if (
    visible.length === 0
  ) {
    const empty =
      document.createElement("div");

    empty.className =
      "order-remaining-empty";

    empty.textContent =
      "条件に該当する商品はありません。";

    list.appendChild(empty);
  } else {
    visible.forEach(
      function (product) {
        list.appendChild(
          createOrderRemainingCard(
            product
          )
        );
      }
    );
  }

  if (count) {
    count.textContent =
      `表示：${filtered.length.toLocaleString(
        "ja-JP"
      )}商品`;
  }

  if (pageStatus) {
    pageStatus.textContent =
      `${orderRemainingCurrentPage} / ${totalPages}ページ`;
  }

  if (prev) {
    prev.disabled =
      orderRemainingCurrentPage <=
      1;
  }

  if (next) {
    next.disabled =
      orderRemainingCurrentPage >=
      totalPages;
  }
}

function createOrderRemainingCard(
  product
) {
  const card =
    document.createElement(
      "article"
    );

  card.className =
    "order-remaining-item-card";

  if (
    product.orderRemaining > 0
  ) {
    card.classList.add(
      "order-remaining-item-active"
    );
  }

  const lifecycleStatus =
    getOrderRemainingLifecycleStatus(
      product
    );

  const backorderBadge =
    isOrderRemainingBackorder(
      product
    )
      ? '<span class="order-remaining-backorder-badge">注残</span>'
      : "";

  const lifecycleBadge =
    `<span class="order-remaining-lifecycle-badge ${getOrderRemainingLifecycleClass(
      lifecycleStatus
    )}">${escapeOrderRemainingHtml(
      lifecycleStatus
    )}</span>`;

  card.innerHTML = `
    <div class="order-remaining-item-head">
      <div class="order-remaining-item-title">
        <div class="order-remaining-item-badges">
          ${
            product.orderRemaining > 0
              ? '<span class="order-remaining-active-badge">発注残あり</span>'
              : '<span class="order-remaining-zero-badge">発注残0</span>'
          }
          ${backorderBadge}
          ${lifecycleBadge}
        </div>

        <strong class="order-remaining-item-name">
          ${escapeOrderRemainingHtml(
            product.productName ||
              "商品名未登録"
          )}
        </strong>

        <div class="order-remaining-item-codes">
          <span>
            社内コード：
            <strong>${escapeOrderRemainingHtml(
              product.internalCode ||
                ""
            )}</strong>
          </span>

          <span>
            商品コード：
            <strong>${escapeOrderRemainingHtml(
              product.productCode ||
                "未登録"
            )}</strong>
          </span>
        </div>
      </div>

      <div class="order-remaining-edit-box">
        <label>
          <span>発注残数</span>

          <div class="order-remaining-input-row">
            <input
              type="number"
              min="0"
              step="1"
              inputmode="numeric"
              class="order-remaining-edit-input"
              value="${product.orderRemaining}"
              data-internal-code="${escapeOrderRemainingHtml(
                product.internalCode ||
                  ""
              )}"
            >
            <strong>個</strong>
          </div>
        </label>

        <small class="order-remaining-saved-value">
          保存値：
          <strong>${product.orderRemaining.toLocaleString(
            "ja-JP"
          )}個</strong>
        </small>

        <button
          type="button"
          class="order-remaining-save-button"
          disabled
        >
          変更を保存
        </button>
      </div>
    </div>

    <div class="order-remaining-metrics">
      <div class="order-remaining-metric">
        <span>現在庫</span>
        <strong>
          ${product.stock.toLocaleString(
            "ja-JP"
          )}個
        </strong>
      </div>

      <div class="order-remaining-metric order-remaining-total-metric">
        <span>現在庫＋発注残</span>
        <strong class="order-remaining-stock-with-order">
          ${(
            product.stock +
            product.orderRemaining
          ).toLocaleString(
            "ja-JP"
          )}個
        </strong>
      </div>

      <div class="order-remaining-metric">
        <span>仕入先</span>
        <strong>
          ${escapeOrderRemainingHtml(
            product.supplier ||
              "未登録"
          )}
        </strong>
      </div>

      <div class="order-remaining-metric">
        <span>保管場所</span>
        <strong>
          ${escapeOrderRemainingHtml(
            product.location ||
              "未設定"
          )}
        </strong>
      </div>
    </div>

    <div class="order-remaining-item-footer">
      <span>
        最終更新：
        <strong>${escapeOrderRemainingHtml(
          formatOrderRemainingDateTime(
            product.updatedAt
          )
        )}</strong>
      </span>

      <span class="order-remaining-unsaved-status">
        保存済み
      </span>

      <button
        type="button"
        class="order-remaining-detail-button"
      >
        商品詳細を見る
      </button>
    </div>
  `;

  const input =
    card.querySelector(
      ".order-remaining-edit-input"
    );

  const saveButton =
    card.querySelector(
      ".order-remaining-save-button"
    );

  const totalDisplay =
    card.querySelector(
      ".order-remaining-stock-with-order"
    );

  const unsavedStatus =
    card.querySelector(
      ".order-remaining-unsaved-status"
    );

  const detailButton =
    card.querySelector(
      ".order-remaining-detail-button"
    );

  if (
    input &&
    saveButton
  ) {
    input.addEventListener(
      "input",
      function () {
        const value =
          Number(input.value);

        const valid =
          Number.isInteger(value) &&
          value >= 0;

        const changed =
          valid &&
          value !==
            product.orderRemaining;

        saveButton.disabled =
          !changed;

        card.classList.toggle(
          "order-remaining-item-unsaved",
          changed
        );

        if (unsavedStatus) {
          unsavedStatus.textContent =
            changed
              ? "未保存"
              : "保存済み";

          unsavedStatus.classList.toggle(
            "order-remaining-unsaved",
            changed
          );
        }

        if (totalDisplay) {
          totalDisplay.textContent =
            valid
              ? `${(
                  product.stock +
                  value
                ).toLocaleString(
                  "ja-JP"
                )}個`
              : "入力エラー";
        }
      }
    );

    saveButton.addEventListener(
      "click",
      function () {
        void saveOrderRemainingProduct(
          product,
          input
        );
      }
    );
  }

  if (detailButton) {
    detailButton.addEventListener(
      "click",
      function () {
        const screen =
          document.querySelector(
            "#order-remaining-management"
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
          window.inventoryApp.openDetailScreen(
            product.internalCode
          );
        }
      }
    );
  }

  return card;
}

async function saveOrderRemainingProduct(
  product,
  input
) {
  const newValue =
    Number(input.value);

  if (
    !Number.isInteger(newValue) ||
    newValue < 0
  ) {
    await showOrderRemainingDialog({
      type: "warning",
      icon: "📦",
      title: "発注残数を確認してください",
      message:
        "発注残数は0以上の整数で入力してください。",
      details: [
        {
          label: "入力値",
          value:
            input.value ||
            "未入力"
        },
        {
          label: "入力例",
          value:
            "0、120、300"
        }
      ],
      confirmText: "入力に戻る"
    });

    input.focus();
    return;
  }

  if (
    newValue ===
    product.orderRemaining
  ) {
    return;
  }

  const confirmed =
    await showOrderRemainingDialog({
      type: "confirm",
      icon: "📦",
      title: "発注残数を変更しますか？",
      message:
        "この商品の発注残数を更新します。",
      details: [
        {
          label: "商品",
          value:
            product.productName ||
            product.internalCode ||
            "未登録"
        },
        {
          label: "社内コード",
          value:
            product.internalCode ||
            "未登録"
        },
        {
          label: "変更前",
          value:
            `${product.orderRemaining.toLocaleString(
              "ja-JP"
            )}個`
        },
        {
          label: "変更後",
          value:
            `${newValue.toLocaleString(
              "ja-JP"
            )}個`
        }
      ],
      notice:
        "船便が入荷反映されると、その入荷数量分は発注残数から自動で減ります。",
      confirmText: "変更を保存",
      cancelText: "キャンセル"
    });

  if (!confirmed) {
    input.value =
      product.orderRemaining;
    input.dispatchEvent(
      new Event("input")
    );
    return;
  }

  const now =
    new Date().toISOString();

  const updatedProduct = {
    ...product,
    orderRemaining: newValue,
    updatedAt: now
  };

  const history = {
    id:
      `order-remaining-manual-${Date.now()}-` +
      `${Math.random().toString(36).slice(2, 8)}`,
    dateTime: now,
    recordedAt: now,
    internalCode:
      product.internalCode || "",
    productCode:
      product.productCode || "",
    productName:
      product.productName || "",
    beforeOrderRemaining:
      product.orderRemaining,
    afterOrderRemaining:
      newValue,
    change:
      newValue -
      product.orderRemaining,
    source:
      "手動編集",
    memo:
      "発注残一覧・編集画面から変更"
  };

  try {
    await saveOrderRemainingChange(
      updatedProduct,
      history
    );

    if (
      window.inventoryApp &&
      typeof window.inventoryApp
        .applyUpdatedProduct ===
        "function"
    ) {
      window.inventoryApp.applyUpdatedProduct(
        updatedProduct
      );
    }

    const message =
      document.querySelector(
        "#order-remaining-save-message"
      );

    if (message) {
      message.textContent =
        `${updatedProduct.productName || updatedProduct.internalCode} の発注残数を ${newValue.toLocaleString(
          "ja-JP"
        )}個に変更しました。`;

      message.className =
        "order-remaining-save-message order-remaining-message-success";
    }

    await loadOrderRemainingProducts();

    if (
      !document.querySelector(
        "#order-remaining-history-panel"
      )?.hidden
    ) {
      await loadOrderRemainingHistories();
    }
  } catch (error) {
    console.error(
      "発注残数保存エラー",
      error
    );

    await showOrderRemainingDialog({
      type: "danger",
      icon: "⚠️",
      title: "発注残数を保存できませんでした",
      message:
        "画面を更新して、もう一度お試しください。",
      confirmText: "閉じる"
    });
  }
}

function getOrderRemainingLifecycleStatus(
  product
) {
  const status =
    String(
      product &&
        product.productStatus
          ? product.productStatus
          : ""
    )
      .normalize("NFKC")
      .trim()
      .toLowerCase();

  if (
    status === "専用商品" ||
    status === "専用" ||
    status === "dedicated" ||
    status === "exclusive"
  ) {
    return "専用商品";
  }

  if (
    status === "廃盤予定" ||
    status ===
      "discontinued planned" ||
    status ===
      "planned discontinued" ||
    status ===
      "planned-discontinued"
  ) {
    return "廃盤予定";
  }

  if (
    status === "廃盤" ||
    status === "discontinued" ||
    status === "inactive" ||
    Boolean(
      product &&
        product.discontinued ===
          true
    )
  ) {
    return "廃盤";
  }

  return "通常商品";
}

function getOrderRemainingLifecycleClass(
  status
) {
  if (status === "専用商品") {
    return "order-remaining-lifecycle-dedicated";
  }

  if (status === "廃盤予定") {
    return "order-remaining-lifecycle-planned";
  }

  if (status === "廃盤") {
    return "order-remaining-lifecycle-discontinued";
  }

  return "order-remaining-lifecycle-active";
}

function isOrderRemainingBackorder(
  product
) {
  const status =
    String(
      product &&
        (
          product.backorderStatus ||
          product.inventoryStatus ||
          ""
        )
    )
      .normalize("NFKC")
      .trim()
      .toLowerCase();

  return (
    status === "注残" ||
    status === "backorder" ||
    status === "backordered" ||
    Boolean(
      product &&
        product.backorder === true
    )
  );
}

function formatOrderRemainingDateTime(
  value
) {
  if (!value) {
    return "未登録";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return String(value);
  }

  return new Intl.DateTimeFormat(
    "ja-JP",
    {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    }
  ).format(date);
}

function getOrderRemainingTotalPages() {
  return Math.max(
    1,
    Math.ceil(
      getFilteredOrderRemainingProducts()
        .length /
        ORDER_REMAINING_PAGE_SIZE
    )
  );
}

function scrollOrderRemainingListIntoView() {
  document
    .querySelector(
      "#order-remaining-list-area"
    )
    ?.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
}

function escapeOrderRemainingHtml(
  value
) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function showOrderRemainingDialog(
  options
) {
  const dialogOptions = {
    ...(options || {})
  };

  const isConfirmDialog =
    dialogOptions.type === "confirm" ||
    dialogOptions.isConfirm === true;

  if (isConfirmDialog) {
    dialogOptions.isConfirm = true;

    if (
      dialogOptions.type === "confirm"
    ) {
      dialogOptions.type = "info";
    }
  }

  if (
    window.inventoryApp &&
    typeof window.inventoryApp
      .showAppDialog ===
      "function"
  ) {
    return window.inventoryApp.showAppDialog(
      dialogOptions
    );
  }

  if (isConfirmDialog) {
    return Promise.resolve(
      window.confirm(
        [
          dialogOptions.title || "",
          dialogOptions.message || ""
        ]
          .filter(Boolean)
          .join("\n\n")
      )
    );
  }

  window.alert(
    [
      dialogOptions.title ||
        "お知らせ",
      dialogOptions.message || ""
    ]
      .filter(Boolean)
      .join("\n\n")
  );

  return Promise.resolve(true);
}

function exportOrderRemainingCsv() {
  if (
    !Array.isArray(
      orderRemainingProducts
    ) ||
    orderRemainingProducts.length === 0
  ) {
    void showOrderRemainingDialog({
      type: "warning",
      icon: "📄",
      title: "出力する商品がありません",
      message:
        "商品データを読み込んでから、もう一度お試しください。",
      confirmText: "閉じる"
    });

    return;
  }

  const rows = [
    [
      "社内コード",
      "商品コード",
      "商品名",
      "仕入先",
      "現在庫",
      "発注残数"
    ]
  ];

  orderRemainingProducts
    .slice()
    .sort(
      function (a, b) {
        return String(
          a.internalCode || ""
        ).localeCompare(
          String(
            b.internalCode || ""
          ),
          "ja",
          {
            numeric: true
          }
        );
      }
    )
    .forEach(
      function (product) {
        rows.push([
          product.internalCode || "",
          product.productCode || "",
          product.productName || "",
          product.supplier || "",
          product.stock,
          product.orderRemaining
        ]);
      }
    );

  const csv =
    "\uFEFF" +
    rows
      .map(
        function (row) {
          return row
            .map(
              escapeOrderRemainingCsvValue
            )
            .join(",");
        }
      )
      .join("\r\n");

  const blob =
    new Blob(
      [csv],
      {
        type:
          "text/csv;charset=utf-8"
      }
    );

  const url =
    URL.createObjectURL(blob);

  const link =
    document.createElement("a");

  link.href = url;
  link.download =
    `発注残一覧_${getOrderRemainingTodayKey()}.csv`;

  document.body.appendChild(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(url);
}

function escapeOrderRemainingCsvValue(
  value
) {
  const text =
    String(value ?? "");

  if (
    /[",\r\n]/.test(text)
  ) {
    return (
      '"' +
      text.replaceAll(
        '"',
        '""'
      ) +
      '"'
    );
  }

  return text;
}

function getOrderRemainingTodayKey() {
  const date =
    new Date();

  const year =
    date.getFullYear();

  const month =
    String(
      date.getMonth() + 1
    ).padStart(2, "0");

  const day =
    String(
      date.getDate()
    ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

async function previewOrderRemainingCsv(
  file
) {
  try {
    const text =
      await file.text();

    const parsedRows =
      parseOrderRemainingCsv(
        text
      );

    if (
      parsedRows.length < 2
    ) {
      throw new Error(
        "CSVにデータ行がありません。"
      );
    }

    const headers =
      parsedRows[0].map(
        normalizeOrderRemainingCsvHeader
      );

    const internalCodeIndex =
      findOrderRemainingCsvHeaderIndex(
        headers,
        [
          "社内コード",
          "internalcode",
          "internal_code"
        ]
      );

    const remainingIndex =
      findOrderRemainingCsvHeaderIndex(
        headers,
        [
          "発注残数",
          "orderremaining",
          "order_remaining"
        ]
      );

    if (
      internalCodeIndex < 0 ||
      remainingIndex < 0
    ) {
      throw new Error(
        "CSVの1行目に「社内コード」と「発注残数」が必要です。"
      );
    }

    const productMap =
      new Map(
        orderRemainingProducts.map(
          function (product) {
            return [
              normalizeOrderRemainingCode(
                product.internalCode
              ),
              product
            ];
          }
        )
      );

    const dataRows =
      parsedRows
        .slice(1)
        .filter(
          function (row) {
            return row.some(
              function (cell) {
                return String(
                  cell || ""
                ).trim() !== "";
              }
            );
          }
        );

    const codeCounts =
      new Map();

    dataRows.forEach(
      function (row) {
        const code =
          normalizeOrderRemainingCode(
            row[
              internalCodeIndex
            ]
          );

        if (code) {
          codeCounts.set(
            code,
            (
              codeCounts.get(
                code
              ) || 0
            ) + 1
          );
        }
      }
    );

    const previewRows =
      dataRows.map(
        function (
          row,
          index
        ) {
          const rowNumber =
            index + 2;

          const rawCode =
            String(
              row[
                internalCodeIndex
              ] || ""
            ).trim();

          const code =
            normalizeOrderRemainingCode(
              rawCode
            );

          const rawRemaining =
            String(
              row[
                remainingIndex
              ] || ""
            ).trim();

          const product =
            productMap.get(code);

          const newValue =
            Number(
              rawRemaining
            );

          let error = "";

          if (!code) {
            error =
              "社内コードが空欄です。";
          } else if (
            (
              codeCounts.get(
                code
              ) || 0
            ) > 1
          ) {
            error =
              "同じ社内コードがCSV内で重複しています。";
          } else if (!product) {
            error =
              "登録されていない社内コードです。";
          } else if (
            rawRemaining === ""
          ) {
            error =
              "発注残数が空欄です。";
          } else if (
            !Number.isInteger(
              newValue
            ) ||
            newValue < 0
          ) {
            error =
              "発注残数は0以上の整数で入力してください。";
          }

          const oldValue =
            product
              ? product.orderRemaining
              : null;

          const status =
            error
              ? "error"
              : newValue === oldValue
                ? "unchanged"
                : "change";

          return {
            rowNumber: rowNumber,
            internalCode: rawCode,
            productName:
              product
                ? product.productName ||
                  ""
                : "",
            oldValue: oldValue,
            newValue:
              Number.isFinite(
                newValue
              )
                ? newValue
                : null,
            status: status,
            error: error,
            product: product
          };
        }
      );

    const errorCount =
      previewRows.filter(
        function (row) {
          return (
            row.status === "error"
          );
        }
      ).length;

    const changeCount =
      previewRows.filter(
        function (row) {
          return (
            row.status === "change"
          );
        }
      ).length;

    const unchangedCount =
      previewRows.filter(
        function (row) {
          return (
            row.status ===
            "unchanged"
          );
        }
      ).length;

    orderRemainingCsvPreview = {
      fileName:
        file.name || "CSV",
      rows: previewRows,
      errorCount: errorCount,
      changeCount: changeCount,
      unchangedCount:
        unchangedCount
    };

    renderOrderRemainingCsvPreview();
  } catch (error) {
    console.error(
      "発注残CSV読込エラー",
      error
    );

    clearOrderRemainingCsvPreview();

    await showOrderRemainingDialog({
      type: "danger",
      icon: "⚠️",
      title: "CSVを読み込めませんでした",
      message:
        error &&
        error.message
          ? error.message
          : "CSVの内容を確認してください。",
      details: [
        {
          label: "必要な項目",
          value:
            "社内コード、発注残数"
        }
      ],
      confirmText: "閉じる"
    });
  }
}

function normalizeOrderRemainingCsvHeader(
  value
) {
  return String(value || "")
    .replace(/^\uFEFF/, "")
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");
}

function findOrderRemainingCsvHeaderIndex(
  headers,
  candidates
) {
  const normalizedCandidates =
    candidates.map(
      normalizeOrderRemainingCsvHeader
    );

  return headers.findIndex(
    function (header) {
      return normalizedCandidates.includes(
        header
      );
    }
  );
}

function normalizeOrderRemainingCode(
  value
) {
  return String(value || "")
    .normalize("NFKC")
    .trim()
    .toUpperCase();
}

function parseOrderRemainingCsv(
  text
) {
  const source =
    String(text || "")
      .replace(/^\uFEFF/, "");

  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (
    let index = 0;
    index < source.length;
    index += 1
  ) {
    const char =
      source[index];

    const next =
      source[
        index + 1
      ];

    if (char === '"') {
      if (
        inQuotes &&
        next === '"'
      ) {
        cell += '"';
        index += 1;
      } else {
        inQuotes =
          !inQuotes;
      }

      continue;
    }

    if (
      char === "," &&
      !inQuotes
    ) {
      row.push(cell);
      cell = "";
      continue;
    }

    if (
      (
        char === "\n" ||
        char === "\r"
      ) &&
      !inQuotes
    ) {
      if (
        char === "\r" &&
        next === "\n"
      ) {
        index += 1;
      }

      row.push(cell);
      rows.push(row);

      row = [];
      cell = "";
      continue;
    }

    cell += char;
  }

  if (
    cell !== "" ||
    row.length > 0
  ) {
    row.push(cell);
    rows.push(row);
  }

  return rows;
}

function renderOrderRemainingCsvPreview() {
  const panel =
    document.querySelector(
      "#order-remaining-csv-preview"
    );

  const summary =
    document.querySelector(
      "#order-remaining-csv-summary"
    );

  const list =
    document.querySelector(
      "#order-remaining-csv-preview-list"
    );

  const applyButton =
    document.querySelector(
      "#apply-order-remaining-csv"
    );

  if (
    !panel ||
    !summary ||
    !list ||
    !orderRemainingCsvPreview
  ) {
    return;
  }

  const preview =
    orderRemainingCsvPreview;

  panel.hidden = false;

  summary.innerHTML = `
    <strong>${escapeOrderRemainingHtml(
      preview.fileName
    )}</strong><br>
    変更：${preview.changeCount.toLocaleString(
      "ja-JP"
    )}件 /
    変更なし：${preview.unchangedCount.toLocaleString(
      "ja-JP"
    )}件 /
    エラー：${preview.errorCount.toLocaleString(
      "ja-JP"
    )}件
  `;

  list.innerHTML = "";

  const displayRows =
    preview.rows.slice(
      0,
      100
    );

  displayRows.forEach(
    function (row) {
      const item =
        document.createElement(
          "div"
        );

      item.className =
        "order-remaining-csv-preview-item";

      item.classList.add(
        `order-remaining-csv-${row.status}`
      );

      let statusText =
        "変更なし";

      if (
        row.status === "change"
      ) {
        statusText =
          "変更";
      } else if (
        row.status === "error"
      ) {
        statusText =
          "エラー";
      }

      const oldValueText =
        row.oldValue === null
          ? "-"
          : `${row.oldValue.toLocaleString(
              "ja-JP"
            )}個`;

      const newValueText =
        row.newValue === null ||
        !Number.isInteger(
          row.newValue
        )
          ? "-"
          : `${row.newValue.toLocaleString(
              "ja-JP"
            )}個`;

      item.innerHTML = `
        <div class="order-remaining-csv-preview-head">
          <span class="order-remaining-csv-status">
            ${statusText}
          </span>

          <strong>
            ${escapeOrderRemainingHtml(
              row.productName ||
                "商品未確認"
            )}
          </strong>
        </div>

        <div class="order-remaining-csv-preview-body">
          <span>
            行：${row.rowNumber}
          </span>

          <span>
            社内コード：
            <strong>${escapeOrderRemainingHtml(
              row.internalCode ||
                "空欄"
            )}</strong>
          </span>

          <span>
            ${oldValueText}
            →
            <strong>${newValueText}</strong>
          </span>
        </div>

        ${
          row.error
            ? `<div class="order-remaining-csv-error-text">${escapeOrderRemainingHtml(
                row.error
              )}</div>`
            : ""
        }
      `;

      list.appendChild(item);
    }
  );

  if (
    preview.rows.length >
    displayRows.length
  ) {
    const note =
      document.createElement(
        "div"
      );

    note.className =
      "order-remaining-csv-preview-limit";

    note.textContent =
      `プレビューは先頭${displayRows.length}件まで表示しています。反映時はCSV全体を処理します。`;

    list.appendChild(note);
  }

  if (applyButton) {
    applyButton.disabled =
      preview.errorCount > 0 ||
      preview.changeCount === 0;
  }

  panel.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

function clearOrderRemainingCsvPreview() {
  orderRemainingCsvPreview =
    null;

  const panel =
    document.querySelector(
      "#order-remaining-csv-preview"
    );

  const summary =
    document.querySelector(
      "#order-remaining-csv-summary"
    );

  const list =
    document.querySelector(
      "#order-remaining-csv-preview-list"
    );

  const applyButton =
    document.querySelector(
      "#apply-order-remaining-csv"
    );

  if (panel) {
    panel.hidden = true;
  }

  if (summary) {
    summary.textContent = "";
  }

  if (list) {
    list.innerHTML = "";
  }

  if (applyButton) {
    applyButton.disabled = true;
  }
}

async function applyOrderRemainingCsv() {
  const preview =
    orderRemainingCsvPreview;

  if (!preview) {
    return;
  }

  if (
    preview.errorCount > 0
  ) {
    await showOrderRemainingDialog({
      type: "warning",
      icon: "⚠️",
      title: "CSVにエラーがあります",
      message:
        "エラーを修正してから、もう一度CSVを読み込んでください。",
      details: [
        {
          label: "エラー",
          value:
            `${preview.errorCount.toLocaleString(
              "ja-JP"
            )}件`
        }
      ],
      confirmText: "閉じる"
    });

    return;
  }

  const changes =
    preview.rows.filter(
      function (row) {
        return (
          row.status === "change"
        );
      }
    );

  if (
    changes.length === 0
  ) {
    return;
  }

  const confirmed =
    await showOrderRemainingDialog({
      type: "confirm",
      icon: "📥",
      title: "発注残CSVを反映しますか？",
      message:
        "CSVの発注残数で商品データを一括更新します。",
      details: [
        {
          label: "変更する商品",
          value:
            `${changes.length.toLocaleString(
              "ja-JP"
            )}件`
        },
        {
          label: "変更なし",
          value:
            `${preview.unchangedCount.toLocaleString(
              "ja-JP"
            )}件`
        }
      ],
      notice:
        "反映前にバックアップを取っておくと、必要な場合に元の状態へ戻せます。",
      confirmText: "CSVを反映",
      cancelText: "キャンセル"
    });

  if (!confirmed) {
    return;
  }

  const now =
    new Date().toISOString();

  const bulkChanges =
    changes.map(
      function (row) {
        const updatedProduct = {
          ...row.product,
          orderRemaining:
            row.newValue,
          updatedAt: now
        };

        return {
          product:
            updatedProduct,
          history: {
            id:
              `order-remaining-csv-${Date.now()}-` +
              `${row.internalCode}-` +
              `${Math.random().toString(36).slice(2, 8)}`,
            dateTime: now,
            recordedAt: now,
            internalCode:
              row.internalCode,
            productCode:
              row.product.productCode || "",
            productName:
              row.product.productName || "",
            beforeOrderRemaining:
              row.oldValue,
            afterOrderRemaining:
              row.newValue,
            change:
              row.newValue -
              row.oldValue,
            source:
              "CSV一括更新",
            memo:
              `ファイル：${preview.fileName}`
          }
        };
      }
    );

  try {
    await applyOrderRemainingBulkChanges(
      bulkChanges
    );

    bulkChanges.forEach(
      function (item) {
        if (
          window.inventoryApp &&
          typeof window.inventoryApp
            .applyUpdatedProduct ===
            "function"
        ) {
          window.inventoryApp.applyUpdatedProduct(
            item.product
          );
        }
      }
    );
  } catch (error) {
    console.error(
      "発注残CSV反映エラー",
      error
    );

    await showOrderRemainingDialog({
      type: "danger",
      icon: "⚠️",
      title: "発注残CSVを反映できませんでした",
      message:
        "商品データは更新されていません。画面を更新して、もう一度お試しください。",
      confirmText: "閉じる"
    });

    return;
  }

  clearOrderRemainingCsvPreview();

  await loadOrderRemainingProducts();

  if (
    !document.querySelector(
      "#order-remaining-history-panel"
    )?.hidden
  ) {
    await loadOrderRemainingHistories();
  }

  await showOrderRemainingDialog({
    type: "success",
    icon: "✅",
    title: "発注残CSVを反映しました",
    message:
      `${bulkChanges.length.toLocaleString(
        "ja-JP"
      )}件の発注残数を更新しました。`,
    confirmText: "閉じる"
  });
}

async function toggleOrderRemainingHistoryPanel() {
  const panel =
    document.querySelector(
      "#order-remaining-history-panel"
    );

  const button =
    document.querySelector(
      "#toggle-order-remaining-history"
    );

  if (!panel) {
    return;
  }

  if (panel.hidden) {
    panel.hidden = false;

    if (button) {
      button.textContent =
        "発注残変更履歴を閉じる";
    }

    orderRemainingHistoryCurrentPage =
      1;

    await loadOrderRemainingHistories();

    panel.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  } else {
    panel.hidden = true;

    if (button) {
      button.textContent =
        "発注残変更履歴を見る";
    }
  }
}

async function loadOrderRemainingHistories() {
  const list =
    document.querySelector(
      "#order-remaining-history-list"
    );

  if (list) {
    list.innerHTML =
      '<div class="order-remaining-history-empty">履歴を読み込んでいます...</div>';
  }

  try {
    const histories =
      await getAllOrderRemainingHistories();

    orderRemainingHistories =
      (Array.isArray(histories)
        ? histories
        : []
      ).slice();

    renderOrderRemainingHistory();
  } catch (error) {
    console.error(
      "発注残変更履歴読み込みエラー",
      error
    );

    if (list) {
      list.innerHTML =
        '<div class="order-remaining-history-empty">履歴を読み込めませんでした。</div>';
    }
  }
}

function getFilteredOrderRemainingHistories() {
  const searchInput =
    document.querySelector(
      "#order-remaining-history-search"
    );

  const sourceFilter =
    document.querySelector(
      "#order-remaining-history-source"
    );

  const term =
    normalizeOrderRemainingSearchText(
      searchInput
        ? searchInput.value
        : ""
    );

  const source =
    sourceFilter
      ? sourceFilter.value
      : "all";

  return orderRemainingHistories
    .filter(function (history) {
      if (
        source !== "all" &&
        history.source !== source
      ) {
        return false;
      }

      if (!term) {
        return true;
      }

      return [
        history.internalCode,
        history.productCode,
        history.productName,
        history.memo
      ].some(function (value) {
        return normalizeOrderRemainingSearchText(
          value
        ).includes(term);
      });
    })
    .sort(function (a, b) {
      return String(
        b.dateTime ||
        b.recordedAt ||
        ""
      ).localeCompare(
        String(
          a.dateTime ||
          a.recordedAt ||
          ""
        )
      );
    });
}

function renderOrderRemainingHistory() {
  const list =
    document.querySelector(
      "#order-remaining-history-list"
    );

  const count =
    document.querySelector(
      "#order-remaining-history-count"
    );

  const pageStatus =
    document.querySelector(
      "#order-remaining-history-page-status"
    );

  const prev =
    document.querySelector(
      "#order-remaining-history-prev"
    );

  const next =
    document.querySelector(
      "#order-remaining-history-next"
    );

  if (!list) {
    return;
  }

  const filtered =
    getFilteredOrderRemainingHistories();

  const totalPages =
    Math.max(
      1,
      Math.ceil(
        filtered.length /
        ORDER_REMAINING_HISTORY_PAGE_SIZE
      )
    );

  if (
    orderRemainingHistoryCurrentPage >
    totalPages
  ) {
    orderRemainingHistoryCurrentPage =
      totalPages;
  }

  const start =
    (
      orderRemainingHistoryCurrentPage -
      1
    ) *
    ORDER_REMAINING_HISTORY_PAGE_SIZE;

  const visible =
    filtered.slice(
      start,
      start +
      ORDER_REMAINING_HISTORY_PAGE_SIZE
    );

  list.innerHTML = "";

  if (visible.length === 0) {
    const empty =
      document.createElement("div");

    empty.className =
      "order-remaining-history-empty";

    empty.textContent =
      "発注残の変更履歴はありません。";

    list.appendChild(empty);
  } else {
    visible.forEach(function (history) {
      const card =
        document.createElement("article");

      card.className =
        "order-remaining-history-card";

      const change =
        Number(history.change || 0);

      if (change < 0) {
        card.classList.add(
          "order-remaining-history-decrease"
        );
      } else if (change > 0) {
        card.classList.add(
          "order-remaining-history-increase"
        );
      }

      const sign =
        change > 0
          ? "+"
          : "";

      const sourceClass =
        history.source === "船便入荷"
          ? "shipping"
          : history.source ===
              "CSV一括更新"
            ? "csv"
            : "manual";

      card.innerHTML = `
        <div class="order-remaining-history-head">
          <div>
            <span class="order-remaining-history-source ${sourceClass}">
              ${escapeOrderRemainingHtml(
                history.source ||
                  "不明"
              )}
            </span>

            <strong class="order-remaining-history-name">
              ${escapeOrderRemainingHtml(
                history.productName ||
                  history.internalCode ||
                  "商品未登録"
              )}
            </strong>
          </div>

          <strong class="order-remaining-history-change ${
            change < 0
              ? "decrease"
              : change > 0
                ? "increase"
                : ""
          }">
            ${sign}${change.toLocaleString(
              "ja-JP"
            )}個
          </strong>
        </div>

        <div class="order-remaining-history-codes">
          <span>
            社内コード：
            <strong>${escapeOrderRemainingHtml(
              history.internalCode ||
                ""
            )}</strong>
          </span>

          <span>
            商品コード：
            <strong>${escapeOrderRemainingHtml(
              history.productCode ||
                "未登録"
            )}</strong>
          </span>
        </div>

        <div class="order-remaining-history-values">
          <div>
            <span>変更前</span>
            <strong>
              ${getOrderRemainingNumber(
                history.beforeOrderRemaining
              ).toLocaleString(
                "ja-JP"
              )}個
            </strong>
          </div>

          <div>
            <span>変更後</span>
            <strong>
              ${getOrderRemainingNumber(
                history.afterOrderRemaining
              ).toLocaleString(
                "ja-JP"
              )}個
            </strong>
          </div>

          <div>
            <span>日時</span>
            <strong>
              ${escapeOrderRemainingHtml(
                formatOrderRemainingDateTime(
                  history.dateTime ||
                    history.recordedAt
                )
              )}
            </strong>
          </div>
        </div>

        ${
          history.memo
            ? `<div class="order-remaining-history-memo">${escapeOrderRemainingHtml(
                history.memo
              )}</div>`
            : ""
        }
      `;

      list.appendChild(card);
    });
  }

  if (count) {
    count.textContent =
      `表示：${filtered.length.toLocaleString(
        "ja-JP"
      )}件`;
  }

  if (pageStatus) {
    pageStatus.textContent =
      `${orderRemainingHistoryCurrentPage} / ${totalPages}ページ`;
  }

  if (prev) {
    prev.disabled =
      orderRemainingHistoryCurrentPage <=
      1;
  }

  if (next) {
    next.disabled =
      orderRemainingHistoryCurrentPage >=
      totalPages;
  }
}

function exportOrderRemainingHistoryCsv() {
  const histories =
    getFilteredOrderRemainingHistories();

  if (histories.length === 0) {
    void showOrderRemainingDialog({
      type: "warning",
      icon: "📄",
      title: "出力する履歴がありません",
      message:
        "現在の検索・絞り込み条件に該当する発注残変更履歴がありません。",
      confirmText: "閉じる"
    });

    return;
  }

  const rows = [
    [
      "日時",
      "社内コード",
      "商品コード",
      "商品名",
      "変更方法",
      "変更前",
      "変更後",
      "増減数",
      "メモ"
    ]
  ];

  histories.forEach(
    function (history) {
      const before =
        getOrderRemainingNumber(
          history.beforeOrderRemaining
        );

      const after =
        getOrderRemainingNumber(
          history.afterOrderRemaining
        );

      const change =
        Number.isFinite(
          Number(history.change)
        )
          ? Number(history.change)
          : after - before;

      rows.push([
        formatOrderRemainingCsvDateTime(
          history.dateTime ||
            history.recordedAt
        ),
        history.internalCode || "",
        history.productCode || "",
        history.productName || "",
        history.source || "",
        before,
        after,
        change,
        history.memo || ""
      ]);
    }
  );

  const csv =
    "\uFEFF" +
    rows
      .map(
        function (row) {
          return row
            .map(
              escapeOrderRemainingCsvValue
            )
            .join(",");
        }
      )
      .join("\r\n");

  const blob =
    new Blob(
      [csv],
      {
        type:
          "text/csv;charset=utf-8"
      }
    );

  const url =
    URL.createObjectURL(blob);

  const link =
    document.createElement("a");

  const sourceFilter =
    document.querySelector(
      "#order-remaining-history-source"
    );

  const source =
    sourceFilter &&
    sourceFilter.value &&
    sourceFilter.value !== "all"
      ? `_${sourceFilter.value}`
      : "";

  link.href = url;
  link.download =
    `発注残変更履歴${source}_${getOrderRemainingTodayKey()}.csv`;

  document.body.appendChild(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(url);

  void showOrderRemainingDialog({
    type: "success",
    icon: "✅",
    title: "発注残変更履歴CSVを出力しました",
    message:
      `${histories.length.toLocaleString(
        "ja-JP"
      )}件の履歴をCSVに出力しました。`,
    details: [
      {
        label: "出力対象",
        value:
          sourceFilter &&
          sourceFilter.value &&
          sourceFilter.value !== "all"
            ? sourceFilter.value
            : "すべての変更方法"
      }
    ],
    confirmText: "閉じる"
  });
}

function formatOrderRemainingCsvDateTime(
  value
) {
  if (!value) {
    return "";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return String(value);
  }

  const year =
    date.getFullYear();

  const month =
    String(
      date.getMonth() + 1
    ).padStart(2, "0");

  const day =
    String(
      date.getDate()
    ).padStart(2, "0");

  const hour =
    String(
      date.getHours()
    ).padStart(2, "0");

  const minute =
    String(
      date.getMinutes()
    ).padStart(2, "0");

  const second =
    String(
      date.getSeconds()
    ).padStart(2, "0");

  return (
    `${year}/${month}/${day} ` +
    `${hour}:${minute}:${second}`
  );
}

function getOrderRemainingHistoryTotalPages() {
  return Math.max(
    1,
    Math.ceil(
      getFilteredOrderRemainingHistories()
        .length /
        ORDER_REMAINING_HISTORY_PAGE_SIZE
    )
  );
}

function createOrderRemainingStyle() {
  if (
    document.querySelector(
      "#order-remaining-style"
    )
  ) {
    return;
  }

  const style =
    document.createElement("style");

  style.id =
    "order-remaining-style";

  style.textContent = `
    #order-remaining-management {
      max-width: 1120px;
      margin: 0 auto;
    }

    #order-remaining-management .order-remaining-intro {
      margin-bottom: 14px;
      padding: 14px;
      border: 2px solid #90caf9;
      border-radius: 12px;
      background: #f3f9ff;
      color: #37474f;
      line-height: 1.7;
    }

    #order-remaining-management .order-remaining-csv-panel {
      margin-bottom: 14px;
      padding: 14px;
      border: 2px solid #80cbc4;
      border-radius: 12px;
      background: #f1fbfa;
    }

    #order-remaining-management .order-remaining-csv-panel h3 {
      margin: 0 0 7px;
      color: #00695c;
    }

    #order-remaining-management .order-remaining-csv-panel p {
      margin: 0 0 12px;
      line-height: 1.65;
    }

    #order-remaining-management .order-remaining-csv-actions {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
    }

    #order-remaining-management .order-remaining-csv-actions button {
      width: auto;
      margin: 0;
    }

    #order-remaining-management .order-remaining-csv-preview {
      margin: 14px 0;
      padding: 14px;
      border: 2px solid #90caf9;
      border-radius: 12px;
      background: #ffffff;
    }

    #order-remaining-management .order-remaining-csv-preview h3 {
      margin: 0 0 8px;
      color: #1565c0;
    }

    #order-remaining-management .order-remaining-csv-summary {
      margin-bottom: 12px;
      line-height: 1.7;
    }

    #order-remaining-management .order-remaining-csv-preview-list {
      display: grid;
      gap: 8px;
      max-height: 480px;
      overflow-y: auto;
      padding-right: 4px;
    }

    #order-remaining-management .order-remaining-csv-preview-item {
      padding: 10px 11px;
      border: 1px solid #dfe6eb;
      border-left: 5px solid #90a4ae;
      border-radius: 9px;
      background: #fafafa;
    }

    #order-remaining-management .order-remaining-csv-change {
      border-left-color: #1976d2;
      background: #f3f9ff;
    }

    #order-remaining-management .order-remaining-csv-error {
      border-left-color: #c62828;
      background: #fff5f5;
    }

    #order-remaining-management .order-remaining-csv-unchanged {
      border-left-color: #2e7d32;
      background: #f5fbf5;
    }

    #order-remaining-management .order-remaining-csv-preview-head {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
      margin-bottom: 5px;
    }

    #order-remaining-management .order-remaining-csv-status {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 999px;
      background: #eceff1;
      font-size: 12px;
      font-weight: 800;
    }

    #order-remaining-management .order-remaining-csv-change .order-remaining-csv-status {
      background: #e3f2fd;
      color: #0d47a1;
    }

    #order-remaining-management .order-remaining-csv-error .order-remaining-csv-status {
      background: #ffebee;
      color: #b71c1c;
    }

    #order-remaining-management .order-remaining-csv-unchanged .order-remaining-csv-status {
      background: #e8f5e9;
      color: #1b5e20;
    }

    #order-remaining-management .order-remaining-csv-preview-body {
      display: flex;
      gap: 14px;
      flex-wrap: wrap;
      color: #546e7a;
      font-size: 13px;
    }

    #order-remaining-management .order-remaining-csv-error-text {
      margin-top: 6px;
      color: #b71c1c;
      font-weight: 800;
    }

    #order-remaining-management .order-remaining-csv-preview-limit {
      padding: 9px;
      border-radius: 8px;
      background: #fff8e1;
      color: #6d4c00;
      font-weight: 700;
    }

    #order-remaining-management .order-remaining-csv-preview-actions {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      margin-top: 12px;
    }

    #order-remaining-management .order-remaining-csv-preview-actions button {
      width: auto;
      margin: 0;
    }

    #order-remaining-management .order-remaining-history-toggle-area {
      margin: 0 0 14px;
    }

    #order-remaining-management .order-remaining-history-toggle-area button {
      width: auto;
      margin: 0;
      background: #6a1b9a;
    }

    #order-remaining-management .order-remaining-history-panel {
      margin-bottom: 14px;
      padding: 14px;
      border: 2px solid #ce93d8;
      border-radius: 12px;
      background: #fcf7ff;
    }

    #order-remaining-management .order-remaining-history-panel h3 {
      margin: 0 0 8px;
      color: #6a1b9a;
    }

    #order-remaining-management .order-remaining-history-controls {
      display: grid;
      grid-template-columns: 2fr 1fr auto;
      gap: 10px;
      align-items: end;
      margin-bottom: 12px;
    }

    #order-remaining-management .order-remaining-history-controls input,
    #order-remaining-management .order-remaining-history-controls select {
      width: 100%;
      min-height: 44px;
      margin: 0;
      box-sizing: border-box;
    }

    #order-remaining-management .order-remaining-history-toolbar {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      flex-wrap: wrap;
      margin: 0 0 12px;
    }

    #order-remaining-management .order-remaining-history-toolbar button {
      width: auto;
      margin: 0;
      background: #455a64;
    }

    #order-remaining-management .order-remaining-history-list {
      display: grid;
      gap: 10px;
    }

    #order-remaining-management .order-remaining-history-empty {
      padding: 18px 12px;
      border: 1px dashed #b0bec5;
      border-radius: 10px;
      background: #ffffff;
      color: #607d8b;
      text-align: center;
      font-weight: 700;
    }

    #order-remaining-management .order-remaining-history-card {
      padding: 12px;
      border: 1px solid #d7e0e8;
      border-left: 5px solid #90a4ae;
      border-radius: 10px;
      background: #ffffff;
    }

    #order-remaining-management .order-remaining-history-increase {
      border-left-color: #1976d2;
    }

    #order-remaining-management .order-remaining-history-decrease {
      border-left-color: #ef6c00;
    }

    #order-remaining-management .order-remaining-history-head {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      align-items: flex-start;
      margin-bottom: 7px;
    }

    #order-remaining-management .order-remaining-history-source {
      display: inline-block;
      margin-right: 7px;
      padding: 3px 8px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 800;
      background: #eceff1;
      color: #455a64;
    }

    #order-remaining-management .order-remaining-history-source.manual {
      background: #e3f2fd;
      color: #0d47a1;
    }

    #order-remaining-management .order-remaining-history-source.csv {
      background: #e8f5e9;
      color: #1b5e20;
    }

    #order-remaining-management .order-remaining-history-source.shipping {
      background: #fff3e0;
      color: #e65100;
    }

    #order-remaining-management .order-remaining-history-name {
      color: #263238;
      font-size: 16px;
    }

    #order-remaining-management .order-remaining-history-change {
      white-space: nowrap;
      font-size: 20px;
      color: #455a64;
    }

    #order-remaining-management .order-remaining-history-change.increase {
      color: #1565c0;
    }

    #order-remaining-management .order-remaining-history-change.decrease {
      color: #e65100;
    }

    #order-remaining-management .order-remaining-history-codes {
      display: flex;
      gap: 16px;
      flex-wrap: wrap;
      margin-bottom: 8px;
      color: #607d8b;
      font-size: 13px;
    }

    #order-remaining-management .order-remaining-history-values {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 8px;
    }

    #order-remaining-management .order-remaining-history-values > div {
      padding: 8px 9px;
      border-radius: 8px;
      background: #f4f7f9;
      border: 1px solid #e0e6ea;
    }

    #order-remaining-management .order-remaining-history-values span {
      display: block;
      margin-bottom: 3px;
      color: #78909c;
      font-size: 11px;
      font-weight: 700;
    }

    #order-remaining-management .order-remaining-history-values strong {
      font-size: 14px;
      color: #263238;
    }

    #order-remaining-management .order-remaining-history-memo {
      margin-top: 8px;
      padding-top: 8px;
      border-top: 1px solid #eceff1;
      color: #546e7a;
      font-size: 13px;
      line-height: 1.5;
    }

    #order-remaining-management .order-remaining-history-pager {
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 10px;
      margin-top: 12px;
    }

    #order-remaining-management .order-remaining-history-pager button {
      width: auto;
      margin: 0;
    }

    #order-remaining-management .order-remaining-summary-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
      margin-bottom: 14px;
    }

    #order-remaining-management .order-remaining-summary-card {
      padding: 14px;
      border: 1px solid #cfd8dc;
      border-radius: 12px;
      background: #ffffff;
    }

    #order-remaining-management .order-remaining-summary-card span {
      display: block;
      margin-bottom: 4px;
      color: #607d8b;
      font-size: 13px;
      font-weight: 800;
    }

    #order-remaining-management .order-remaining-summary-card strong {
      color: #1565c0;
      font-size: 25px;
    }

    #order-remaining-management .order-remaining-controls {
      display: grid;
      grid-template-columns: 2fr 1fr 1fr;
      gap: 12px;
      align-items: end;
      margin-bottom: 12px;
      padding: 14px;
      border: 1px solid #d7e0e8;
      border-radius: 12px;
      background: #ffffff;
    }

    #order-remaining-management .order-remaining-controls label {
      display: block;
      margin-bottom: 6px;
      font-weight: 800;
    }

    #order-remaining-management .order-remaining-controls input,
    #order-remaining-management .order-remaining-controls select {
      width: 100%;
      min-height: 48px;
      margin: 0;
      box-sizing: border-box;
    }

    #order-remaining-management .order-remaining-toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
      margin-bottom: 12px;
    }

    #order-remaining-management .order-remaining-toolbar button {
      width: auto;
      margin: 0;
    }

    #order-remaining-management .order-remaining-save-message {
      min-height: 24px;
      margin: 0 0 12px;
      font-weight: 800;
    }

    #order-remaining-management .order-remaining-message-success {
      color: #1b5e20;
    }

    #order-remaining-management .order-remaining-message-error {
      color: #b71c1c;
    }

    #order-remaining-management .order-remaining-card-list {
      display: grid;
      grid-template-columns: 1fr;
      gap: 14px;
    }

    #order-remaining-management .order-remaining-empty {
      padding: 24px 14px;
      border: 1px dashed #b0bec5;
      border-radius: 12px;
      background: #fafafa;
      color: #546e7a;
      font-weight: 800;
      text-align: center;
    }

    #order-remaining-management .order-remaining-item-card {
      padding: 14px;
      border: 2px solid #d7e0e8;
      border-left: 6px solid #90a4ae;
      border-radius: 14px;
      background: #ffffff;
      box-shadow: 0 2px 7px rgba(0, 0, 0, 0.05);
    }

    #order-remaining-management .order-remaining-item-active {
      border-left-color: #1976d2;
    }

    #order-remaining-management .order-remaining-item-unsaved {
      border-left-color: #ef6c00;
      background: #fffaf2;
    }

    #order-remaining-management .order-remaining-item-head {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 250px;
      gap: 16px;
      align-items: start;
      margin-bottom: 12px;
    }

    #order-remaining-management .order-remaining-item-title {
      min-width: 0;
    }

    #order-remaining-management .order-remaining-item-badges {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-bottom: 7px;
    }

    #order-remaining-management .order-remaining-active-badge,
    #order-remaining-management .order-remaining-zero-badge,
    #order-remaining-management .order-remaining-backorder-badge,
    #order-remaining-management .order-remaining-lifecycle-badge {
      display: inline-block;
      padding: 4px 9px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 800;
      white-space: nowrap;
    }

    #order-remaining-management .order-remaining-active-badge {
      background: #e3f2fd;
      color: #0d47a1;
      border: 1px solid #90caf9;
    }

    #order-remaining-management .order-remaining-zero-badge {
      background: #eceff1;
      color: #455a64;
      border: 1px solid #b0bec5;
    }

    #order-remaining-management .order-remaining-backorder-badge {
      background: #fff3cd;
      color: #6d4c00;
      border: 1px solid #f6c343;
    }

    #order-remaining-management .order-remaining-lifecycle-active {
      background: #e8f5e9;
      color: #1b5e20;
      border: 1px solid #a5d6a7;
    }

    #order-remaining-management .order-remaining-lifecycle-dedicated {
      background: #f3e5f5;
      color: #6a1b9a;
      border: 1px solid #ba68c8;
    }

    #order-remaining-management .order-remaining-lifecycle-planned {
      background: #fff8e1;
      color: #ef6c00;
      border: 1px solid #ffcc80;
    }

    #order-remaining-management .order-remaining-lifecycle-discontinued {
      background: #ffebee;
      color: #b71c1c;
      border: 1px solid #ef9a9a;
    }

    #order-remaining-management .order-remaining-item-name {
      display: block;
      margin-bottom: 7px;
      color: #263238;
      font-size: 19px;
      line-height: 1.45;
    }

    #order-remaining-management .order-remaining-item-codes {
      display: flex;
      flex-wrap: wrap;
      gap: 18px;
      color: #546e7a;
      font-size: 14px;
    }

    #order-remaining-management .order-remaining-edit-box {
      padding: 11px 12px;
      border: 2px solid #90caf9;
      border-radius: 12px;
      background: #f3f9ff;
    }

    #order-remaining-management .order-remaining-edit-box label > span {
      display: block;
      margin-bottom: 6px;
      color: #1565c0;
      font-weight: 800;
    }

    #order-remaining-management .order-remaining-input-row {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 7px;
      align-items: center;
    }

    #order-remaining-management .order-remaining-edit-input {
      width: 100%;
      min-width: 0;
      margin: 0;
      font-size: 20px;
      font-weight: 800;
      text-align: right;
      box-sizing: border-box;
    }

    #order-remaining-management .order-remaining-saved-value {
      display: block;
      margin: 7px 0;
      color: #607d8b;
      font-weight: 700;
    }

    #order-remaining-management .order-remaining-save-button {
      width: 100%;
      min-height: 42px;
      margin: 0;
      background: #1976d2;
    }

    #order-remaining-management .order-remaining-save-button:disabled {
      background: #b0bec5;
      cursor: default;
    }

    #order-remaining-management .order-remaining-metrics {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 8px;
    }

    #order-remaining-management .order-remaining-metric {
      min-width: 0;
      padding: 10px 11px;
      border: 1px solid #dfe6eb;
      border-radius: 10px;
      background: #f4f7f9;
    }

    #order-remaining-management .order-remaining-total-metric {
      border-color: #90caf9;
      background: #edf6ff;
    }

    #order-remaining-management .order-remaining-metric span {
      display: block;
      margin-bottom: 4px;
      color: #607d8b;
      font-size: 12px;
      font-weight: 700;
    }

    #order-remaining-management .order-remaining-metric strong {
      display: block;
      color: #263238;
      font-size: 16px;
      line-height: 1.35;
      overflow-wrap: anywhere;
    }

    #order-remaining-management .order-remaining-item-footer {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
      margin-top: 10px;
      padding-top: 10px;
      border-top: 1px solid #e0e6ea;
      color: #607d8b;
      font-size: 13px;
    }

    #order-remaining-management .order-remaining-unsaved-status {
      margin-left: auto;
      padding: 4px 8px;
      border-radius: 999px;
      background: #e8f5e9;
      color: #1b5e20;
      font-weight: 800;
    }

    #order-remaining-management .order-remaining-unsaved {
      background: #fff3e0;
      color: #e65100;
    }

    #order-remaining-management .order-remaining-detail-button {
      width: auto;
      min-height: 38px;
      margin: 0;
      padding: 7px 12px;
      background: #546e7a;
      font-size: 13px;
    }

    #order-remaining-management .order-remaining-pager {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      margin: 16px 0;
    }

    #order-remaining-management .order-remaining-pager button {
      width: auto;
      margin: 0;
    }

    #order-remaining-management #back-home-from-order-remaining {
      width: auto;
    }

    @media (max-width: 900px) {
      #order-remaining-management .order-remaining-controls {
        grid-template-columns: 1fr 1fr;
      }

      #order-remaining-management .order-remaining-controls > div:first-child {
        grid-column: 1 / -1;
      }

      #order-remaining-management .order-remaining-metrics {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }

    @media (max-width: 700px) {
      #order-remaining-management .order-remaining-csv-actions,
      #order-remaining-management .order-remaining-csv-preview-actions {
        display: grid;
        grid-template-columns: 1fr;
      }

      #order-remaining-management .order-remaining-csv-actions button,
      #order-remaining-management .order-remaining-csv-preview-actions button {
        width: 100%;
      }

      #order-remaining-management .order-remaining-history-toolbar {
        display: grid;
        grid-template-columns: 1fr;
      }

      #order-remaining-management .order-remaining-history-toolbar button {
        width: 100%;
      }

      #order-remaining-management .order-remaining-history-controls {
        grid-template-columns: 1fr;
      }

      #order-remaining-management .order-remaining-history-values {
        grid-template-columns: 1fr;
      }

      #order-remaining-management .order-remaining-history-head {
        display: grid;
        grid-template-columns: 1fr;
      }

      #order-remaining-management .order-remaining-summary-grid {
        grid-template-columns: 1fr;
      }

      #order-remaining-management .order-remaining-controls {
        grid-template-columns: 1fr;
      }

      #order-remaining-management .order-remaining-controls > div:first-child {
        grid-column: auto;
      }

      #order-remaining-management .order-remaining-item-head {
        grid-template-columns: 1fr;
      }

      #order-remaining-management .order-remaining-item-codes {
        display: grid;
        gap: 4px;
      }

      #order-remaining-management .order-remaining-item-name {
        font-size: 17px;
      }

      #order-remaining-management .order-remaining-metric {
        padding: 9px;
      }

      #order-remaining-management .order-remaining-item-footer {
        align-items: stretch;
      }

      #order-remaining-management .order-remaining-unsaved-status {
        margin-left: 0;
      }

      #order-remaining-management .order-remaining-detail-button {
        width: 100%;
      }
    }
  `;

  document.head.appendChild(
    style
  );
}
