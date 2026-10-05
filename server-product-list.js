"use strict";

(function () {
  const SERVER_PRODUCTS_ENDPOINT =
    "https://jyuubee.sakura.ne.jp/inventory/get-products-auth.php";

  const MAX_ITEMS = 200;

  let panel = null;
  let content = null;
  let listScreen = null;
  let lastKeyword = "";
  let isLoading = false;
  let lastItems = [];
  let lastResponseData = null;
  let lastStockFilter = "all";
  let lastProductStatusFilter = "all";
  let lastLocationFilter = "all";
  let lastSort = "internal_asc";

  document.addEventListener(
    "DOMContentLoaded",
    initializeServerProductList
  );

  function initializeServerProductList() {
    listScreen = document.querySelector("#product-list");

    if (!listScreen) {
      return;
    }

    createStyles();
    createPanel();
    observeProductListVisibility();

    window.addEventListener(
      "inventory-server-auth-changed",
      handleServerAuthChanged
    );

    if (!listScreen.hidden) {
      refreshPanelForCurrentSession();
    }
  }

  function createPanel() {
    if (document.querySelector("#server-product-list-panel")) {
      panel = document.querySelector("#server-product-list-panel");
      content = panel.querySelector("#server-product-list-content");
      return;
    }

    panel = document.createElement("section");
    panel.id = "server-product-list-panel";
    panel.className = "server-product-list-panel";

    panel.innerHTML = `
      <div class="server-product-list-heading">
        <div>
          <span class="server-product-list-kicker">さくらサーバー</span>
          <h3>サーバー商品一覧（閲覧専用）</h3>
        </div>
        <span class="server-product-list-badge">テスト中</span>
      </div>

      <p class="server-product-list-description">
        MySQLに保存した商品を、この商品一覧画面から確認するテストです。
        現段階では架空データだけを表示し、編集・削除・入出庫は行いません。
      </p>

      <div
        id="server-product-list-content"
        class="server-product-list-content"
        aria-live="polite"
      ></div>
    `;

    content = panel.querySelector("#server-product-list-content");

    const backButton = listScreen.querySelector("#back-home-from-list");
    const tableArea = listScreen.querySelector(".product-list-table-area");

    if (tableArea) {
      listScreen.insertBefore(panel, tableArea);
    } else if (backButton && backButton.nextSibling) {
      listScreen.insertBefore(panel, backButton.nextSibling);
    } else {
      listScreen.appendChild(panel);
    }
  }

  function observeProductListVisibility() {
    const observer = new MutationObserver(function (mutations) {
      const becameVisible = mutations.some(function (mutation) {
        return (
          mutation.type === "attributes" &&
          mutation.attributeName === "hidden" &&
          !listScreen.hidden
        );
      });

      if (becameVisible) {
        refreshPanelForCurrentSession();
      }
    });

    observer.observe(listScreen, {
      attributes: true,
      attributeFilter: ["hidden"]
    });
  }

  function handleServerAuthChanged(event) {
    if (!listScreen || listScreen.hidden) {
      return;
    }

    const loggedIn = Boolean(
      event && event.detail && event.detail.loggedIn
    );

    if (loggedIn) {
      loadServerProducts(lastKeyword);
    } else {
      renderLoginRequired();
    }
  }

  function refreshPanelForCurrentSession() {
    const bridge = getServerBridge();

    if (!bridge || !bridge.hasSession()) {
      renderLoginRequired();
      return;
    }

    loadServerProducts(lastKeyword);
  }

  function renderLoginRequired() {
    if (!content) {
      return;
    }

    content.innerHTML = `
      <div class="server-product-list-notice server-product-list-info">
        <strong>🔐 サーバーログインが必要です</strong>
        <span>
          サーバーの商品一覧を見るには、テスト用アカウントでログインしてください。
        </span>
      </div>

      <button
        id="server-product-list-login-button"
        type="button"
        class="server-product-list-primary-button"
      >
        サーバーログインして一覧を見る
      </button>
    `;

    const button = content.querySelector(
      "#server-product-list-login-button"
    );

    if (button) {
      button.addEventListener("click", function () {
        const bridge = getServerBridge();

        if (bridge && typeof bridge.openLogin === "function") {
          bridge.openLogin("");
        }
      });
    }
  }

  async function loadServerProducts(keyword) {
    if (isLoading || !content) {
      return;
    }

    const bridge = getServerBridge();

    if (!bridge || !bridge.hasSession()) {
      renderLoginRequired();
      return;
    }

    lastKeyword = String(keyword || "").trim();
    isLoading = true;

    renderLoading();

    try {
      const url = new URL(SERVER_PRODUCTS_ENDPOINT);
      url.searchParams.set("limit", String(MAX_ITEMS));

      if (lastKeyword) {
        url.searchParams.set("q", lastKeyword);
      }

      const token = getServerToken();

      if (!token) {
        renderLoginRequired();
        return;
      }

      const response = await fetch(url.toString(), {
        method: "GET",
        mode: "cors",
        cache: "no-store",
        headers: {
          Accept: "application/json",
          Authorization: "Bearer " + token
        }
      });

      const data = await readJsonResponse(response);

      if (response.status === 401) {
        clearServerSessionForList();
        renderLoginRequired();
        return;
      }

      if (!response.ok || !data || data.success !== true) {
        throw new Error(
          data && data.message
            ? data.message
            : "サーバーの商品一覧を取得できませんでした。"
        );
      }

      renderServerProducts(
        Array.isArray(data.items) ? data.items : [],
        data
      );
    } catch (error) {
      renderError(
        error && error.message
          ? error.message
          : "サーバー通信に失敗しました。"
      );
    } finally {
      isLoading = false;
    }
  }

  function renderLoading() {
    content.innerHTML = `
      <div class="server-product-list-notice server-product-list-info">
        <strong>商品一覧を読み込んでいます...</strong>
        <span>ログイン情報を付けてMySQLの商品を確認しています。</span>
      </div>
    `;
  }

  function renderServerProducts(items, data) {
    if (!content) {
      return;
    }

    lastItems = Array.isArray(items) ? items.slice() : [];
    lastResponseData = data || {};

    const serverCount = Number.isFinite(Number(data && data.count))
      ? Number(data.count)
      : lastItems.length;

    const productStatuses = Array.from(
      new Set(
        lastItems
          .map(function (item) {
            return String(item.product_status || "通常商品").trim();
          })
          .filter(Boolean)
      )
    ).sort(function (a, b) {
      return a.localeCompare(b, "ja");
    });

    if (
      lastProductStatusFilter !== "all" &&
      !productStatuses.includes(lastProductStatusFilter)
    ) {
      lastProductStatusFilter = "all";
    }

    const locations = Array.from(
      new Set(
        lastItems.flatMap(function (item) {
          return getLocationNames(item.locations);
        })
      )
    ).sort(function (a, b) {
      return a.localeCompare(b, "ja", { numeric: true, sensitivity: "base" });
    });

    if (
      lastLocationFilter !== "all" &&
      !locations.includes(lastLocationFilter)
    ) {
      lastLocationFilter = "all";
    }

    const stockCounts = getStockStatusCounts(lastItems);
    const filteredItems = applyLocalFiltersAndSort(lastItems);

    const cards = filteredItems.length
      ? filteredItems.map(createProductCardHtml).join("")
      : `
          <div class="server-product-list-empty">
            ${lastKeyword || lastStockFilter !== "all" || lastProductStatusFilter !== "all" || lastLocationFilter !== "all"
              ? "条件に一致するサーバー商品はありません。"
              : "サーバーに登録されている商品はありません。"}
          </div>
        `;

    content.innerHTML = `
      <div class="server-product-list-notice server-product-list-success">
        <strong>✓ サーバー商品一覧を取得しました</strong>
        <span>
          サーバー検索結果 ${escapeHtml(String(serverCount))}件 / 現在表示 ${escapeHtml(String(filteredItems.length))}件。
          現在は閲覧専用です。
        </span>
      </div>

      <div class="server-product-list-stock-summary" aria-label="在庫状況のまとめ">
        <button
          type="button"
          class="server-product-list-summary-button server-product-list-summary-out${lastStockFilter === "out" ? " server-product-list-summary-active" : ""}"
          data-stock-filter="out"
        >
          <span>在庫切れ</span>
          <strong>${escapeHtml(String(stockCounts.out))}件</strong>
        </button>

        <button
          type="button"
          class="server-product-list-summary-button server-product-list-summary-low${lastStockFilter === "low" ? " server-product-list-summary-active" : ""}"
          data-stock-filter="low"
        >
          <span>要補充</span>
          <strong>${escapeHtml(String(stockCounts.low))}件</strong>
        </button>

        <button
          type="button"
          class="server-product-list-summary-button server-product-list-summary-normal${lastStockFilter === "normal" ? " server-product-list-summary-active" : ""}"
          data-stock-filter="normal"
        >
          <span>通常</span>
          <strong>${escapeHtml(String(stockCounts.normal))}件</strong>
        </button>
      </div>

      <form
        id="server-product-list-search-form"
        class="server-product-list-search-form"
      >
        <label for="server-product-list-search-input">
          サーバー商品を検索
        </label>

        <div class="server-product-list-search-row">
          <input
            id="server-product-list-search-input"
            type="search"
            value="${escapeHtml(lastKeyword)}"
            placeholder="社内コード・商品コード・商品名・JANなど"
            autocomplete="off"
          >

          <button
            type="submit"
            class="server-product-list-primary-button"
          >
            検索
          </button>
        </div>
      </form>

      <div class="server-product-list-filter-box">
        <div class="server-product-list-filter-field">
          <label for="server-product-list-stock-filter">在庫状態</label>
          <select id="server-product-list-stock-filter">
            <option value="all"${lastStockFilter === "all" ? " selected" : ""}>すべて</option>
            <option value="normal"${lastStockFilter === "normal" ? " selected" : ""}>通常</option>
            <option value="low"${lastStockFilter === "low" ? " selected" : ""}>要補充</option>
            <option value="out"${lastStockFilter === "out" ? " selected" : ""}>在庫切れ</option>
          </select>
        </div>

        <div class="server-product-list-filter-field">
          <label for="server-product-list-status-filter">商品状態</label>
          <select id="server-product-list-status-filter">
            <option value="all"${lastProductStatusFilter === "all" ? " selected" : ""}>すべて</option>
            ${productStatuses.map(function (status) {
              return `<option value="${escapeHtml(status)}"${lastProductStatusFilter === status ? " selected" : ""}>${escapeHtml(status)}</option>`;
            }).join("")}
          </select>
        </div>

        <div class="server-product-list-filter-field">
          <label for="server-product-list-location-filter">保管場所</label>
          <select id="server-product-list-location-filter">
            <option value="all"${lastLocationFilter === "all" ? " selected" : ""}>すべて</option>
            ${locations.map(function (location) {
              return `<option value="${escapeHtml(location)}"${lastLocationFilter === location ? " selected" : ""}>${escapeHtml(location)}</option>`;
            }).join("")}
          </select>
        </div>

        <div class="server-product-list-filter-field">
          <label for="server-product-list-sort">並べ替え</label>
          <select id="server-product-list-sort">
            <option value="internal_asc"${lastSort === "internal_asc" ? " selected" : ""}>社内コード順</option>
            <option value="name_asc"${lastSort === "name_asc" ? " selected" : ""}>商品名順</option>
            <option value="stock_desc"${lastSort === "stock_desc" ? " selected" : ""}>在庫数が多い順</option>
            <option value="stock_asc"${lastSort === "stock_asc" ? " selected" : ""}>在庫数が少ない順</option>
          </select>
        </div>
      </div>

      <div class="server-product-list-actions">
        <button
          id="server-product-list-clear-button"
          type="button"
          class="server-product-list-secondary-button"
        >
          条件を解除
        </button>

        <button
          id="server-product-list-refresh-button"
          type="button"
          class="server-product-list-secondary-button"
        >
          再読み込み
        </button>
      </div>

      <div class="server-product-list-grid">
        ${cards}
      </div>

      <p class="server-product-list-footnote">
        ※ 絞り込み・並べ替えは、取得したサーバー商品に対してこの画面上で行います。
        詳細を開くときは、最新の商品情報をサーバーからもう一度取得します。
      </p>
    `;

    const searchForm = content.querySelector(
      "#server-product-list-search-form"
    );
    const searchInput = content.querySelector(
      "#server-product-list-search-input"
    );
    const stockFilter = content.querySelector(
      "#server-product-list-stock-filter"
    );
    const statusFilter = content.querySelector(
      "#server-product-list-status-filter"
    );
    const locationFilter = content.querySelector(
      "#server-product-list-location-filter"
    );
    const sortSelect = content.querySelector(
      "#server-product-list-sort"
    );
    const clearButton = content.querySelector(
      "#server-product-list-clear-button"
    );
    const refreshButton = content.querySelector(
      "#server-product-list-refresh-button"
    );
    const summaryButtons = content.querySelectorAll(
      ".server-product-list-summary-button"
    );

    if (searchForm) {
      searchForm.addEventListener("submit", function (event) {
        event.preventDefault();
        loadServerProducts(
          searchInput ? searchInput.value : ""
        );
      });
    }

    if (stockFilter) {
      stockFilter.addEventListener("change", function () {
        lastStockFilter = stockFilter.value || "all";
        renderServerProducts(lastItems, lastResponseData);
      });
    }

    if (statusFilter) {
      statusFilter.addEventListener("change", function () {
        lastProductStatusFilter = statusFilter.value || "all";
        renderServerProducts(lastItems, lastResponseData);
      });
    }

    if (locationFilter) {
      locationFilter.addEventListener("change", function () {
        lastLocationFilter = locationFilter.value || "all";
        renderServerProducts(lastItems, lastResponseData);
      });
    }

    summaryButtons.forEach(function (button) {
      button.addEventListener("click", function () {
        const nextFilter = button.dataset.stockFilter || "all";
        lastStockFilter = lastStockFilter === nextFilter ? "all" : nextFilter;
        renderServerProducts(lastItems, lastResponseData);
      });
    });

    if (sortSelect) {
      sortSelect.addEventListener("change", function () {
        lastSort = sortSelect.value || "internal_asc";
        renderServerProducts(lastItems, lastResponseData);
      });
    }

    if (clearButton) {
      clearButton.addEventListener("click", function () {
        lastKeyword = "";
        lastStockFilter = "all";
        lastProductStatusFilter = "all";
        lastLocationFilter = "all";
        lastSort = "internal_asc";
        loadServerProducts("");
      });
    }

    if (refreshButton) {
      refreshButton.addEventListener("click", function () {
        loadServerProducts(lastKeyword);
      });
    }

    content.querySelectorAll(
      ".server-product-list-detail-button"
    ).forEach(function (button) {
      button.addEventListener("click", function () {
        openServerProductDetail(
          button.dataset.internalCode || "",
          button
        );
      });
    });
  }

  function applyLocalFiltersAndSort(items) {
    const filtered = items.filter(function (item) {
      const totalStock = toNumber(item.total_stock);
      const minStock = toNumber(item.min_stock);
      const stockStatus = getStockStatus(
        item.product_status,
        totalStock,
        minStock
      );

      if (lastStockFilter === "normal" && stockStatus !== "通常") {
        return false;
      }
      if (lastStockFilter === "low" && stockStatus !== "要補充") {
        return false;
      }
      if (lastStockFilter === "out" && stockStatus !== "在庫切れ") {
        return false;
      }

      if (
        lastProductStatusFilter !== "all" &&
        String(item.product_status || "通常商品") !== lastProductStatusFilter
      ) {
        return false;
      }

      if (
        lastLocationFilter !== "all" &&
        !getLocationNames(item.locations).includes(lastLocationFilter)
      ) {
        return false;
      }

      return true;
    });

    filtered.sort(function (a, b) {
      if (lastSort === "name_asc") {
        return String(a.product_name || "").localeCompare(
          String(b.product_name || ""),
          "ja"
        );
      }

      if (lastSort === "stock_desc") {
        return toNumber(b.total_stock) - toNumber(a.total_stock);
      }

      if (lastSort === "stock_asc") {
        return toNumber(a.total_stock) - toNumber(b.total_stock);
      }

      return String(a.internal_code || "").localeCompare(
        String(b.internal_code || ""),
        "ja",
        { numeric: true, sensitivity: "base" }
      );
    });

    return filtered;
  }

  function createProductCardHtml(item) {
    const totalStock = toNumber(item.total_stock);
    const minStock = toNumber(item.min_stock);
    const stockStatus = getStockStatus(
      item.product_status,
      totalStock,
      minStock
    );

    return `
      <article class="server-product-list-card">
        <div class="server-product-list-card-top">
          <div>
            <span class="server-product-list-code">
              ${escapeHtml(item.internal_code || "未登録")}
            </span>
            <h4>${escapeHtml(item.product_name || "商品名未登録")}</h4>
          </div>

          <span class="server-product-list-stock-badge ${getStockStatusClass(stockStatus)}">
            ${escapeHtml(stockStatus)}
          </span>
        </div>

        <dl class="server-product-list-meta">
          <div>
            <dt>商品コード</dt>
            <dd>${escapeHtml(item.product_code || "未登録")}</dd>
          </div>
          <div>
            <dt>現在庫</dt>
            <dd><strong>${formatNumber(totalStock)}個</strong></dd>
          </div>
          <div>
            <dt>最低在庫</dt>
            <dd>${formatNumber(minStock)}個</dd>
          </div>
          <div>
            <dt>商品状態</dt>
            <dd>${escapeHtml(item.product_status || "通常商品")}</dd>
          </div>
          <div class="server-product-list-meta-wide">
            <dt>保管場所</dt>
            <dd>${escapeHtml(item.locations || "未登録")}</dd>
          </div>
        </dl>

        <button
          type="button"
          class="server-product-list-primary-button server-product-list-detail-button"
          data-internal-code="${escapeHtml(item.internal_code || "")}"
        >
          詳細を見る
        </button>
      </article>
    `;
  }

  async function openServerProductDetail(internalCode, button) {
    const bridge = getServerBridge();

    if (
      !bridge ||
      typeof bridge.searchProduct !== "function" ||
      typeof bridge.openProductDetail !== "function"
    ) {
      renderError(
        "商品詳細を開く機能を確認できませんでした。画面を再読み込みしてください。"
      );
      return;
    }

    if (button) {
      button.disabled = true;
      button.textContent = "読み込み中...";
    }

    try {
      const data = await bridge.searchProduct(internalCode);
      bridge.openProductDetail(data, internalCode);
    } catch (error) {
      if (error && error.code === "SERVER_LOGIN_REQUIRED") {
        renderLoginRequired();
      } else {
        renderError(
          error && error.message
            ? error.message
            : "商品詳細を取得できませんでした。"
        );
      }
    } finally {
      if (button && document.body.contains(button)) {
        button.disabled = false;
        button.textContent = "詳細を見る";
      }
    }
  }

  function renderError(message) {
    if (!content) {
      return;
    }

    content.innerHTML = `
      <div class="server-product-list-notice server-product-list-error">
        <strong>⚠ サーバー商品一覧を取得できませんでした</strong>
        <span>${escapeHtml(message)}</span>
      </div>

      <button
        id="server-product-list-retry-button"
        type="button"
        class="server-product-list-primary-button"
      >
        もう一度確認する
      </button>
    `;

    const retryButton = content.querySelector(
      "#server-product-list-retry-button"
    );

    if (retryButton) {
      retryButton.addEventListener("click", function () {
        refreshPanelForCurrentSession();
      });
    }
  }

  function getServerBridge() {
    return window.inventoryServerSearch || null;
  }

  function getServerToken() {
    try {
      return sessionStorage.getItem(
        "barcodeInventoryServerAccessToken"
      ) || "";
    } catch (error) {
      return "";
    }
  }

  function clearServerSessionForList() {
    try {
      sessionStorage.removeItem("barcodeInventoryServerAccessToken");
      sessionStorage.removeItem("barcodeInventoryServerAccessExpiresAt");
      sessionStorage.removeItem("barcodeInventoryServerUser");
    } catch (error) {
      // 保存領域が使えない場合も画面表示は継続する。
    }

    try {
      window.dispatchEvent(
        new CustomEvent("inventory-server-auth-changed", {
          detail: {
            reason: "expired",
            loggedIn: false
          }
        })
      );
    } catch (error) {
      // 通知できなくても一覧画面は継続する。
    }
  }

  async function readJsonResponse(response) {
    try {
      return await response.json();
    } catch (error) {
      throw new Error(
        "サーバーから正しい形式の応答がありません。"
      );
    }
  }

  function getLocationNames(value) {
    return String(value || "")
      .split(/\s*[\/／\n]+\s*/)
      .map(function (part) {
        return part
          .replace(/\s*[：:]\s*-?\d[\d,]*\s*個?.*$/, "")
          .trim();
      })
      .filter(Boolean);
  }

  function getStockStatusCounts(items) {
    const counts = {
      normal: 0,
      low: 0,
      out: 0
    };

    items.forEach(function (item) {
      const status = getStockStatus(
        item.product_status,
        toNumber(item.total_stock),
        toNumber(item.min_stock)
      );

      if (status === "在庫切れ") {
        counts.out += 1;
      } else if (status === "要補充") {
        counts.low += 1;
      } else if (status === "通常") {
        counts.normal += 1;
      }
    });

    return counts;
  }

  function getStockStatus(productStatus, stock, minStock) {
    if (String(productStatus || "") === "廃盤") {
      return "廃盤";
    }

    if (stock <= 0) {
      return "在庫切れ";
    }

    if (minStock > 0 && stock <= minStock) {
      return "要補充";
    }

    return "通常";
  }

  function getStockStatusClass(status) {
    if (status === "廃盤") {
      return "server-product-list-stock-discontinued";
    }
    if (status === "在庫切れ") {
      return "server-product-list-stock-out";
    }
    if (status === "要補充") {
      return "server-product-list-stock-low";
    }
    return "server-product-list-stock-normal";
  }

  function toNumber(value) {
    const number = Number(value);
    return Number.isFinite(number)
      ? Math.max(0, Math.trunc(number))
      : 0;
  }

  function formatNumber(value) {
    return toNumber(value).toLocaleString("ja-JP");
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function createStyles() {
    if (document.querySelector("#server-product-list-style")) {
      return;
    }

    const style = document.createElement("style");
    style.id = "server-product-list-style";
    style.textContent = `
      .server-product-list-panel {
        margin: 22px 0;
        padding: 20px;
        border: 2px solid #64b5f6;
        border-radius: 16px;
        background: #f8fcff;
      }

      .server-product-list-heading {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 14px;
        margin-bottom: 10px;
      }

      .server-product-list-kicker {
        display: block;
        margin-bottom: 3px;
        color: #1565c0;
        font-size: 13px;
        font-weight: 700;
      }

      .server-product-list-heading h3 {
        margin: 0;
        color: #123a5a;
      }

      .server-product-list-badge {
        flex: 0 0 auto;
        padding: 6px 10px;
        border-radius: 999px;
        background: #e3f2fd;
        color: #1565c0;
        font-size: 12px;
        font-weight: 800;
      }

      .server-product-list-description,
      .server-product-list-footnote {
        color: #5b7284;
        line-height: 1.7;
      }

      .server-product-list-content {
        display: grid;
        gap: 14px;
      }

      .server-product-list-notice {
        display: grid;
        gap: 5px;
        padding: 14px 16px;
        border-radius: 12px;
      }

      .server-product-list-info {
        border: 1px solid #90caf9;
        background: #eaf5ff;
        color: #0d5da8;
      }

      .server-product-list-success {
        border: 1px solid #81c784;
        background: #eefaf0;
        color: #1b6e2e;
      }

      .server-product-list-error {
        border: 1px solid #ef9a9a;
        background: #fff0f0;
        color: #b42318;
      }

      .server-product-list-primary-button {
        background: #1565c0 !important;
      }

      .server-product-list-secondary-button {
        background: #546e7a !important;
      }

      .server-product-list-stock-summary {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 10px;
      }

      .server-product-list-summary-button {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        min-height: 54px;
        padding: 10px 14px;
        border: 1px solid transparent;
        border-radius: 12px;
        font: inherit;
        font-weight: 800;
        cursor: pointer;
      }

      .server-product-list-summary-button strong {
        font-size: 18px;
      }

      .server-product-list-summary-out {
        border-color: #ef9a9a;
        background: #fff0f0;
        color: #b42318;
      }

      .server-product-list-summary-low {
        border-color: #ffcc80;
        background: #fff7e8;
        color: #a84b00;
      }

      .server-product-list-summary-normal {
        border-color: #a5d6a7;
        background: #eefaf0;
        color: #1b6e2e;
      }

      .server-product-list-summary-active {
        outline: 3px solid #1565c0;
        outline-offset: 1px;
      }

      .server-product-list-search-form {
        display: grid;
        gap: 8px;
        padding: 14px;
        border: 1px solid #d7e2eb;
        border-radius: 12px;
        background: #ffffff;
      }

      .server-product-list-search-form label {
        color: #173b58;
        font-weight: 800;
      }

      .server-product-list-search-row {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 10px;
      }

      .server-product-list-search-row input {
        width: 100%;
        min-height: 48px;
        padding: 10px 12px;
        border: 1px solid #aebfcd;
        border-radius: 9px;
        font: inherit;
      }

      .server-product-list-filter-box {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 10px;
        padding: 14px;
        border: 1px solid #d7e2eb;
        border-radius: 12px;
        background: #ffffff;
      }

      .server-product-list-filter-field {
        display: grid;
        gap: 6px;
      }

      .server-product-list-filter-field label {
        color: #173b58;
        font-size: 13px;
        font-weight: 800;
      }

      .server-product-list-filter-field select {
        width: 100%;
        min-height: 46px;
        padding: 8px 10px;
        border: 1px solid #aebfcd;
        border-radius: 9px;
        background: #ffffff;
        color: #173b58;
        font: inherit;
      }

      .server-product-list-actions {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px;
      }

      .server-product-list-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 14px;
      }

      .server-product-list-card {
        display: grid;
        gap: 14px;
        padding: 16px;
        border: 1px solid #cddbe6;
        border-radius: 14px;
        background: #ffffff;
      }

      .server-product-list-card-top {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 10px;
      }

      .server-product-list-card h4 {
        margin: 4px 0 0;
        color: #173b58;
        font-size: 20px;
      }

      .server-product-list-code {
        color: #60788b;
        font-size: 13px;
        font-weight: 700;
      }

      .server-product-list-stock-badge {
        flex: 0 0 auto;
        padding: 6px 9px;
        border-radius: 999px;
        font-size: 12px;
        font-weight: 800;
      }

      .server-product-list-stock-normal {
        background: #e8f5e9;
        color: #1b5e20;
      }

      .server-product-list-stock-low {
        background: #fff3e0;
        color: #b45309;
      }

      .server-product-list-stock-out,
      .server-product-list-stock-discontinued {
        background: #ffebee;
        color: #b71c1c;
      }

      .server-product-list-meta {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px;
        margin: 0;
      }

      .server-product-list-meta > div {
        min-width: 0;
        padding: 9px 10px;
        border-radius: 9px;
        background: #f6f9fb;
      }

      .server-product-list-meta-wide {
        grid-column: 1 / -1;
      }

      .server-product-list-meta dt {
        margin-bottom: 3px;
        color: #60788b;
        font-size: 12px;
      }

      .server-product-list-meta dd {
        margin: 0;
        color: #173b58;
        overflow-wrap: anywhere;
      }

      .server-product-list-empty {
        padding: 18px;
        border: 1px dashed #b8c9d6;
        border-radius: 12px;
        background: #ffffff;
        color: #536b7d;
        text-align: center;
      }

      @media (max-width: 760px) {
        .server-product-list-panel {
          padding: 16px;
        }

        .server-product-list-heading {
          align-items: center;
        }

        .server-product-list-stock-summary,
        .server-product-list-search-row,
        .server-product-list-filter-box,
        .server-product-list-actions,
        .server-product-list-grid {
          grid-template-columns: 1fr;
        }

        .server-product-list-search-row button,
        .server-product-list-actions button,
        .server-product-list-detail-button,
        #server-product-list-login-button,
        #server-product-list-retry-button {
          width: 100%;
          min-height: 54px;
        }

        .server-product-list-meta {
          grid-template-columns: 1fr;
        }

        .server-product-list-meta-wide {
          grid-column: auto;
        }
      }
    `;

    document.head.appendChild(style);
  }
})();
