"use strict";

const ORDER_REMAINING_PAGE_SIZE = 20;

let orderRemainingProducts = [];
let orderRemainingCurrentPage = 1;

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

  const updatedProduct = {
    ...product,
    orderRemaining: newValue,
    updatedAt:
      new Date().toISOString()
  };

  try {
    await updateProduct(
      updatedProduct
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
  if (
    window.inventoryApp &&
    typeof window.inventoryApp
      .showAppDialog ===
      "function"
  ) {
    return window.inventoryApp.showAppDialog(
      options || {}
    );
  }

  if (
    options &&
    options.type === "confirm"
  ) {
    return Promise.resolve(
      window.confirm(
        [
          options.title || "",
          options.message || ""
        ]
          .filter(Boolean)
          .join("\n\n")
      )
    );
  }

  window.alert(
    [
      options?.title || "お知らせ",
      options?.message || ""
    ]
      .filter(Boolean)
      .join("\n\n")
  );

  return Promise.resolve(true);
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
