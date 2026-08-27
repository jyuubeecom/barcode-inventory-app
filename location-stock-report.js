"use strict";

/*
  v195 保管場所別在庫表 3拠点対応
  ・保管場所ごとの在庫を画面で確認
  ・画面では社内コード / 商品コード / 商品名 / 色 / 在庫数 / 商品状態を表示
  ・選択中の保管場所、または全保管場所をA4縦向きで印刷
  ・印刷表では「商品状態」「商品名」を外し、手書き用の「確認」「備考」欄を表示
  ・備考欄は一番右端に配置し、商品名を削除した分だけ広く確保
  ・画面上の一覧は商品名を残して検索・確認しやすさを維持
  ・作業者モードでも閲覧・印刷可能
*/

(function () {
  const ALL_LOCATIONS_VALUE = "__all__";
  const LOCATION_OPTIONS = [
    "本社",
    "酒本倉庫1階",
    "酒本倉庫2階"
  ];

  const state = {
    products: [],
    rows: []
  };

  document.addEventListener(
    "DOMContentLoaded",
    initializeLocationStockReport
  );

  function initializeLocationStockReport() {
    createHomeButton();
    createScreen();
    createStyles();
    populateLocationOptions();
    bindEvents();
  }

  function createHomeButton() {
    if (
      document.querySelector(
        "#show-location-stock-report-button"
      )
    ) {
      return;
    }

    const container =
      document.querySelector(
        "#home-inventory-buttons"
      );

    if (!container) {
      return;
    }

    const button =
      document.createElement("button");

    button.id =
      "show-location-stock-report-button";
    button.type = "button";
    button.textContent =
      "保管場所別在庫表を見る";

    container.appendChild(button);
  }

  function createScreen() {
    if (
      document.querySelector(
        "#location-stock-report"
      )
    ) {
      return;
    }

    const main =
      document.querySelector("main");

    if (!main) {
      return;
    }

    const section =
      document.createElement("section");

    section.id = "location-stock-report";
    section.hidden = true;
    section.innerHTML = `
      <div class="location-stock-report-heading">
        <div>
          <span class="location-stock-report-kicker">場所ごとの在庫を確認</span>
          <h2>保管場所別在庫表</h2>
          <p>
            保管場所を選ぶと、その場所にある商品の在庫を一覧で確認できます。
          </p>
        </div>
      </div>

      <div class="location-stock-report-controls">
        <div>
          <label for="location-stock-report-location">保管場所</label>
          <select id="location-stock-report-location"></select>
        </div>

        <div>
          <label for="location-stock-report-search">商品を検索</label>
          <input
            id="location-stock-report-search"
            type="search"
            autocomplete="off"
            placeholder="社内コード・商品コード・商品名"
          >
        </div>

        <button
          id="location-stock-report-print-button"
          type="button"
        >
          印刷する
        </button>
      </div>

      <div class="location-stock-report-summary">
        <article>
          <span>表示場所</span>
          <strong id="location-stock-report-summary-location">全保管場所</strong>
        </article>
        <article>
          <span>商品数</span>
          <strong><span id="location-stock-report-product-count">0</span>商品</strong>
        </article>
        <article>
          <span>在庫合計</span>
          <strong><span id="location-stock-report-stock-total">0</span>個</strong>
        </article>
      </div>

      <div
        id="location-stock-report-status"
        class="location-stock-report-status"
        aria-live="polite"
      >
        在庫データを読み込んでいます。
      </div>

      <div class="location-stock-report-table-wrap">
        <table class="location-stock-report-table">
          <thead id="location-stock-report-head"></thead>
          <tbody id="location-stock-report-body"></tbody>
        </table>
      </div>

      <p
        id="location-stock-report-empty"
        class="location-stock-report-empty"
        hidden
      >
        この条件に該当する在庫はありません。
      </p>

      <button
        id="back-home-from-location-stock-report"
        type="button"
        class="location-stock-report-back"
      >
        ホームへ戻る
      </button>
    `;

    main.appendChild(section);
  }

  function createStyles() {
    if (
      document.querySelector(
        "#location-stock-report-style"
      )
    ) {
      return;
    }

    const style =
      document.createElement("style");

    style.id =
      "location-stock-report-style";

    style.textContent = `
      #location-stock-report {
        max-width: 1180px;
        margin: 0 auto;
        scroll-margin-top: 12px;
      }

      .location-stock-report-heading {
        margin-bottom: 16px;
      }

      .location-stock-report-heading h2 {
        margin: 4px 0 8px;
      }

      .location-stock-report-kicker {
        display: inline-block;
        color: #1565c0;
        font-weight: 800;
        font-size: 14px;
      }

      .location-stock-report-controls {
        display: grid;
        grid-template-columns: minmax(220px, 0.9fr) minmax(280px, 1.4fr) auto;
        gap: 12px;
        align-items: end;
        padding: 16px;
        border: 1px solid #cfd8dc;
        border-radius: 12px;
        background: #fff;
      }

      .location-stock-report-controls label {
        display: block;
        margin-bottom: 6px;
        font-weight: 800;
      }

      .location-stock-report-controls select,
      .location-stock-report-controls input {
        width: 100%;
        min-height: 48px;
        box-sizing: border-box;
        font-size: 16px;
      }

      #location-stock-report-print-button {
        min-height: 48px;
        min-width: 150px;
      }

      .location-stock-report-summary {
        display: grid;
        grid-template-columns: 1.4fr 1fr 1fr;
        gap: 12px;
        margin: 16px 0;
      }

      .location-stock-report-summary article {
        padding: 14px 16px;
        border: 1px solid #cfd8dc;
        border-radius: 12px;
        background: #fff;
      }

      .location-stock-report-summary span {
        display: block;
        color: #546e7a;
        font-size: 13px;
        font-weight: 700;
      }

      .location-stock-report-summary strong {
        display: block;
        margin-top: 4px;
        color: #263238;
        font-size: 22px;
      }

      .location-stock-report-summary strong span {
        display: inline;
        color: inherit;
        font-size: inherit;
      }

      .location-stock-report-status {
        margin: 12px 0;
        padding: 10px 12px;
        border-radius: 8px;
        background: #eef6ff;
        color: #0d47a1;
        font-weight: 700;
      }

      .location-stock-report-table-wrap {
        overflow-x: auto;
        -webkit-overflow-scrolling: touch;
        border: 1px solid #cfd8dc;
        border-radius: 12px;
        background: #fff;
      }

      .location-stock-report-table {
        width: 100%;
        min-width: 960px;
        border-collapse: collapse;
      }

      .location-stock-report-table th,
      .location-stock-report-table td {
        padding: 11px 10px;
        border-bottom: 1px solid #e0e0e0;
        text-align: left;
        vertical-align: middle;
      }

      .location-stock-report-table th {
        position: sticky;
        top: 0;
        z-index: 1;
        background: #eaf3ff;
        white-space: nowrap;
      }

      .location-stock-report-table tbody tr:last-child td {
        border-bottom: 0;
      }

      .location-stock-report-quantity {
        min-width: 90px;
        text-align: right !important;
        font-size: 18px;
        font-weight: 900;
        color: #0d47a1;
        white-space: nowrap;
      }

      .location-stock-report-location-cell {
        font-weight: 800;
        white-space: nowrap;
      }

      .location-stock-report-color {
        min-width: 100px;
        font-weight: 700;
      }

      .location-stock-report-status-badge {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 4px 9px;
        border-radius: 999px;
        font-size: 12px;
        font-weight: 800;
        white-space: nowrap;
        background: #e8f5e9;
        color: #1b5e20;
      }

      .location-stock-report-status-badge.is-planned {
        background: #fff3e0;
        color: #e65100;
      }

      .location-stock-report-status-badge.is-discontinued {
        background: #eceff1;
        color: #455a64;
      }

      .location-stock-report-status-badge.is-dedicated {
        background: #f3e5f5;
        color: #6a1b9a;
      }

      .location-stock-report-empty {
        padding: 18px;
        border-radius: 10px;
        background: #f5f5f5;
        color: #455a64;
        font-weight: 700;
      }

      .location-stock-report-back {
        margin-top: 18px;
      }

      body.location-stock-print-dialog-open {
        overflow: hidden;
      }

      .location-stock-print-overlay {
        position: fixed;
        inset: 0;
        z-index: 99999;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 18px;
        background: rgba(13, 32, 48, 0.58);
      }

      .location-stock-print-modal {
        width: min(620px, 100%);
        max-height: calc(100vh - 36px);
        overflow-y: auto;
        padding: 20px;
        border-radius: 16px;
        background: #fff;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.28);
      }

      .location-stock-print-modal-head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 16px;
      }

      .location-stock-print-modal-head h3 {
        margin: 3px 0 0;
      }

      .location-stock-print-modal-kicker {
        color: #1565c0;
        font-weight: 800;
        font-size: 13px;
      }

      .location-stock-print-close {
        width: 44px;
        min-width: 44px;
        height: 44px;
        padding: 0;
        border-radius: 50%;
        font-size: 26px;
        line-height: 1;
        background: #607d8b;
      }

      .location-stock-print-message {
        margin: 16px 0;
        color: #455a64;
        line-height: 1.7;
      }

      .location-stock-print-choice-list {
        display: grid;
        gap: 12px;
      }

      .location-stock-print-choice {
        width: 100%;
        padding: 15px 16px;
        text-align: left;
        border: 2px solid #90caf9;
        border-radius: 12px;
        background: #f4f9ff;
        color: #0d47a1;
      }

      .location-stock-print-choice strong,
      .location-stock-print-choice span {
        display: block;
      }

      .location-stock-print-choice strong {
        font-size: 18px;
      }

      .location-stock-print-choice span {
        margin-top: 4px;
        font-size: 13px;
        font-weight: 700;
      }

      .location-stock-print-choice-all {
        border-color: #80cbc4;
        background: #f0fbf9;
        color: #00695c;
      }

      .location-stock-print-cancel {
        width: 100%;
        margin-top: 14px;
        background: #607d8b;
      }

      @media (max-width: 760px) {
        .location-stock-report-controls,
        .location-stock-report-summary {
          grid-template-columns: 1fr;
        }

        #location-stock-report-print-button,
        .location-stock-report-back {
          width: 100%;
        }

        .location-stock-report-summary strong {
          font-size: 20px;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function populateLocationOptions() {
    const select =
      document.querySelector(
        "#location-stock-report-location"
      );

    if (!select) {
      return;
    }

    select.innerHTML = [
      `<option value="${ALL_LOCATIONS_VALUE}">全保管場所</option>`,
      ...LOCATION_OPTIONS.map(
        function (location) {
          return (
            `<option value="${escapeHtml(location)}">` +
            `${escapeHtml(location)}</option>`
          );
        }
      )
    ].join("");
  }

  function bindEvents() {
    document
      .querySelector(
        "#show-location-stock-report-button"
      )
      ?.addEventListener(
        "click",
        openLocationStockReport
      );

    document
      .querySelector(
        "#back-home-from-location-stock-report"
      )
      ?.addEventListener(
        "click",
        showHomeScreen
      );

    document
      .querySelector(
        "#location-stock-report-location"
      )
      ?.addEventListener(
        "change",
        renderReport
      );

    document
      .querySelector(
        "#location-stock-report-search"
      )
      ?.addEventListener(
        "input",
        renderReport
      );

    document
      .querySelector(
        "#location-stock-report-print-button"
      )
      ?.addEventListener(
        "click",
        openPrintChoiceDialog
      );
  }

  async function openLocationStockReport() {
    hideMainSections();

    const section =
      document.querySelector(
        "#location-stock-report"
      );

    if (section) {
      section.hidden = false;
    }

    setStatus("在庫データを読み込んでいます。");

    try {
      state.products =
        await getAllProducts();
      state.rows =
        buildAllLocationRows(
          state.products
        );
      renderReport();
    } catch (error) {
      console.error(
        "保管場所別在庫表の読込エラー",
        error
      );

      setStatus(
        "在庫データを読み込めませんでした。画面を更新して、もう一度お試しください。"
      );
    }

    if (section) {
      window.requestAnimationFrame(
        function () {
          section.scrollIntoView({
            behavior: "smooth",
            block: "start"
          });
        }
      );
    }
  }

  function hideMainSections() {
    document
      .querySelectorAll("main > section")
      .forEach(function (section) {
        section.hidden = true;
      });
  }

  function showHomeScreen() {
    hideMainSections();

    const home =
      document.querySelector("#home");

    if (home) {
      home.hidden = false;
    }

    window.scrollTo({
      top: 0,
      behavior: "auto"
    });
  }

  function buildAllLocationRows(products) {
    const rows = [];

    (Array.isArray(products)
      ? products
      : []
    ).forEach(function (product) {
      const locationStocks =
        typeof getProductLocationStocks ===
        "function"
          ? getProductLocationStocks(product)
          : getFallbackLocationStocks(product);

      locationStocks.forEach(
        function (entry) {
          const location =
            normalizeLocationName(
              entry && entry.location
            );
          const stock =
            normalizeQuantity(
              entry && entry.stock
            );

          if (
            location === "" ||
            location === "未確認" ||
            stock <= 0
          ) {
            return;
          }

          rows.push({
            location: location,
            internalCode: String(
              product &&
              product.internalCode ||
              ""
            ).trim(),
            productCode: String(
              product &&
              product.productCode ||
              ""
            ).trim(),
            productName: String(
              product &&
              product.productName ||
              ""
            ).trim(),
            productColor: String(
              product &&
              product.productColor ||
              ""
            ).trim(),
            stock: stock,
            status:
              getProductStatus(product)
          });
        }
      );
    });

    return rows.sort(compareRows);
  }

  function getFallbackLocationStocks(product) {
    const stock =
      normalizeQuantity(
        product && product.stock
      );
    const location =
      normalizeLocationName(
        product && product.location
      );

    return stock > 0 && location !== "" && location !== "未確認"
      ? [{ location: location, stock: stock }]
      : [];
  }

  function normalizeLocationName(value) {
    if (
      typeof normalizeLocationStockName ===
      "function"
    ) {
      return normalizeLocationStockName(value);
    }

    return String(value || "")
      .normalize("NFKC")
      .trim();
  }

  function normalizeQuantity(value) {
    if (
      typeof normalizeLocationStockQuantity ===
      "function"
    ) {
      return normalizeLocationStockQuantity(value);
    }

    const quantity = Number(value);

    return Number.isFinite(quantity)
      ? Math.max(
          0,
          Math.trunc(quantity)
        )
      : 0;
  }

  function getProductStatus(product) {
    if (
      typeof getProductLifecycleStatus ===
      "function"
    ) {
      return getProductLifecycleStatus(product);
    }

    const saved = String(
      product &&
      product.productStatus ||
      ""
    ).trim();

    if (
      saved === "廃盤" ||
      product &&
      product.discontinued === true
    ) {
      return "廃盤";
    }

    if (
      saved === "廃盤予定" ||
      product &&
      product.discontinuedPlanned === true
    ) {
      return "廃盤予定";
    }

    if (
      saved === "専用商品" ||
      product &&
      product.dedicatedProduct === true
    ) {
      return "専用商品";
    }

    return "通常商品";
  }

  function compareRows(left, right) {
    const locationDifference =
      getLocationOrder(left.location) -
      getLocationOrder(right.location);

    if (locationDifference !== 0) {
      return locationDifference;
    }

    const internalDifference =
      compareNatural(
        left.internalCode,
        right.internalCode
      );

    if (internalDifference !== 0) {
      return internalDifference;
    }

    const productDifference =
      compareNatural(
        left.productCode,
        right.productCode
      );

    if (productDifference !== 0) {
      return productDifference;
    }

    return compareNatural(
      left.productName,
      right.productName
    );
  }

  function compareNatural(left, right) {
    return String(left || "").localeCompare(
      String(right || ""),
      "ja",
      {
        numeric: true,
        sensitivity: "base"
      }
    );
  }

  function getLocationOrder(location) {
    const index =
      LOCATION_OPTIONS.indexOf(location);

    return index >= 0
      ? index
      : 999;
  }

  function getSelectedLocation() {
    const select =
      document.querySelector(
        "#location-stock-report-location"
      );

    return select
      ? select.value
      : ALL_LOCATIONS_VALUE;
  }

  function getSelectedLocationLabel() {
    const value = getSelectedLocation();

    return value === ALL_LOCATIONS_VALUE
      ? "全保管場所"
      : value;
  }

  function getSearchText() {
    const input =
      document.querySelector(
        "#location-stock-report-search"
      );

    return String(
      input && input.value || ""
    )
      .normalize("NFKC")
      .trim()
      .toLowerCase();
  }

  function getVisibleRows() {
    const location =
      getSelectedLocation();
    const search =
      getSearchText();

    return state.rows.filter(
      function (row) {
        if (
          location !==
            ALL_LOCATIONS_VALUE &&
          row.location !== location
        ) {
          return false;
        }

        if (search === "") {
          return true;
        }

        const haystack = [
          row.internalCode,
          row.productCode,
          row.productName,
          row.productColor,
          row.status
        ]
          .join(" ")
          .normalize("NFKC")
          .toLowerCase();

        return haystack.includes(search);
      }
    );
  }

  function renderReport() {
    const rows = getVisibleRows();
    const selectedLocation =
      getSelectedLocation();
    const isAll =
      selectedLocation ===
      ALL_LOCATIONS_VALUE;

    renderTableHeader(isAll);
    renderTableBody(rows, isAll);
    renderSummary(rows);

    const empty =
      document.querySelector(
        "#location-stock-report-empty"
      );
    const tableWrap =
      document.querySelector(
        ".location-stock-report-table-wrap"
      );

    if (empty) {
      empty.hidden = rows.length > 0;
    }

    if (tableWrap) {
      tableWrap.hidden = rows.length === 0;
    }

    setStatus(
      rows.length > 0
        ? `${getSelectedLocationLabel()}：${formatNumber(rows.length)}商品を表示しています。`
        : `${getSelectedLocationLabel()}：該当する在庫はありません。`
    );
  }

  function renderTableHeader(isAll) {
    const head =
      document.querySelector(
        "#location-stock-report-head"
      );

    if (!head) {
      return;
    }

    head.innerHTML = `
      <tr>
        <th>No</th>
        ${isAll ? "<th>保管場所</th>" : ""}
        <th>社内コード</th>
        <th>商品コード</th>
        <th>商品名</th>
        <th>色</th>
        <th>在庫数</th>
        <th>商品状態</th>
      </tr>
    `;
  }

  function renderTableBody(rows, isAll) {
    const body =
      document.querySelector(
        "#location-stock-report-body"
      );

    if (!body) {
      return;
    }

    body.innerHTML = rows.map(
      function (row, index) {
        return `
          <tr>
            <td>${index + 1}</td>
            ${
              isAll
                ? `<td class="location-stock-report-location-cell">${escapeHtml(row.location)}</td>`
                : ""
            }
            <td>${escapeHtml(row.internalCode || "-")}</td>
            <td>${escapeHtml(row.productCode || "-")}</td>
            <td>${escapeHtml(row.productName || "-")}</td>
            <td class="location-stock-report-color">${escapeHtml(row.productColor || "-")}</td>
            <td class="location-stock-report-quantity">${formatNumber(row.stock)}個</td>
            <td>${createStatusBadge(row.status)}</td>
          </tr>
        `;
      }
    ).join("");
  }

  function renderSummary(rows) {
    const locationElement =
      document.querySelector(
        "#location-stock-report-summary-location"
      );
    const countElement =
      document.querySelector(
        "#location-stock-report-product-count"
      );
    const stockElement =
      document.querySelector(
        "#location-stock-report-stock-total"
      );

    if (locationElement) {
      locationElement.textContent =
        getSelectedLocationLabel();
    }

    if (countElement) {
      countElement.textContent =
        formatNumber(rows.length);
    }

    if (stockElement) {
      stockElement.textContent =
        formatNumber(
          rows.reduce(
            function (sum, row) {
              return sum + row.stock;
            },
            0
          )
        );
    }
  }

  function setStatus(message) {
    const status =
      document.querySelector(
        "#location-stock-report-status"
      );

    if (status) {
      status.textContent = message;
    }
  }

  function createStatusBadge(status) {
    const className =
      status === "廃盤"
        ? "is-discontinued"
        : status === "廃盤予定"
          ? "is-planned"
          : status === "専用商品"
            ? "is-dedicated"
            : "";

    return (
      `<span class="location-stock-report-status-badge ${className}">` +
      `${escapeHtml(status)}</span>`
    );
  }

  function openPrintChoiceDialog() {
    document
      .querySelector(
        "#location-stock-print-dialog"
      )
      ?.remove();

    const selectedLocation =
      getSelectedLocation();
    const selectedLabel =
      getSelectedLocationLabel();
    const visibleRows =
      getVisibleRows();

    if (
      selectedLocation !==
        ALL_LOCATIONS_VALUE &&
      visibleRows.length === 0
    ) {
      showNoDataDialog();
      return;
    }

    const overlay =
      document.createElement("div");

    overlay.id =
      "location-stock-print-dialog";
    overlay.className =
      "location-stock-print-overlay";
    overlay.setAttribute(
      "role",
      "dialog"
    );
    overlay.setAttribute(
      "aria-modal",
      "true"
    );
    overlay.setAttribute(
      "aria-labelledby",
      "location-stock-print-dialog-title"
    );

    const currentChoice =
      selectedLocation ===
      ALL_LOCATIONS_VALUE
        ? ""
        : `
          <button
            type="button"
            class="location-stock-print-choice"
            data-location-stock-print-mode="current"
          >
            <strong>${escapeHtml(selectedLabel)}のみ</strong>
            <span>${formatNumber(visibleRows.length)}商品 / 画面の検索条件を反映</span>
          </button>
        `;

    overlay.innerHTML = `
      <div class="location-stock-print-modal">
        <div class="location-stock-print-modal-head">
          <div>
            <span class="location-stock-print-modal-kicker">A4縦向き</span>
            <h3 id="location-stock-print-dialog-title">保管場所別在庫表を印刷</h3>
          </div>
          <button
            type="button"
            class="location-stock-print-close"
            data-location-stock-print-close
            aria-label="閉じる"
          >
            ×
          </button>
        </div>

        <p class="location-stock-print-message">
          印刷する範囲を選んでください。各保管場所は見出し付きの在庫表として印刷します。
        </p>

        <div class="location-stock-print-choice-list">
          ${currentChoice}
          <button
            type="button"
            class="location-stock-print-choice location-stock-print-choice-all"
            data-location-stock-print-mode="all"
          >
            <strong>全保管場所</strong>
            <span>すべての保管場所を場所ごとにまとめて印刷</span>
          </button>
        </div>

        <button
          type="button"
          class="location-stock-print-cancel"
          data-location-stock-print-close
        >
          キャンセル
        </button>
      </div>
    `;

    function closeDialog() {
      document.body.classList.remove(
        "location-stock-print-dialog-open"
      );
      document.removeEventListener(
        "keydown",
        handleEscape
      );
      overlay.remove();
    }

    function handleEscape(event) {
      if (event.key === "Escape") {
        closeDialog();
      }
    }

    overlay
      .querySelectorAll(
        "[data-location-stock-print-close]"
      )
      .forEach(function (button) {
        button.addEventListener(
          "click",
          closeDialog
        );
      });

    overlay
      .querySelectorAll(
        "[data-location-stock-print-mode]"
      )
      .forEach(function (button) {
        button.addEventListener(
          "click",
          function () {
            const mode =
              button.dataset
                .locationStockPrintMode;

            const opened =
              mode === "current"
                ? printCurrentLocation()
                : printAllLocations();

            if (opened) {
              closeDialog();
            }
          }
        );
      });

    overlay.addEventListener(
      "click",
      function (event) {
        if (event.target === overlay) {
          closeDialog();
        }
      }
    );

    document.addEventListener(
      "keydown",
      handleEscape
    );

    document.body.classList.add(
      "location-stock-print-dialog-open"
    );
    document.body.appendChild(overlay);

    overlay
      .querySelector(
        "[data-location-stock-print-mode]"
      )
      ?.focus();
  }

  async function showNoDataDialog() {
    if (
      typeof showAppDialog ===
      "function"
    ) {
      await showAppDialog({
        type: "warning",
        icon: "📦",
        title: "印刷できる在庫がありません",
        message:
          "現在選んでいる保管場所・検索条件では、印刷する在庫がありません。",
        confirmText: "閉じる"
      });
      return;
    }

    window.alert(
      "現在の条件では、印刷する在庫がありません。"
    );
  }

  function printCurrentLocation() {
    const location =
      getSelectedLocation();

    if (
      location === ALL_LOCATIONS_VALUE
    ) {
      return printAllLocations();
    }

    const rows = getVisibleRows();

    if (rows.length === 0) {
      void showNoDataDialog();
      return false;
    }

    return openPrintWindow(
      `${location} 在庫表`,
      [
        createPrintLocationSection(
          location,
          rows,
          false
        )
      ]
    );
  }

  function printAllLocations() {
    const sections = [];

    LOCATION_OPTIONS.forEach(
      function (location) {
        const rows =
          state.rows.filter(
            function (row) {
              return (
                row.location ===
                location
              );
            }
          );

        // 在庫がない保管場所まで1ページずつ印刷すると紙が増えるため、
        // 全保管場所印刷では在庫がある場所だけを対象にします。
        if (rows.length === 0) {
          return;
        }

        sections.push(
          createPrintLocationSection(
            location,
            rows,
            true
          )
        );
      }
    );

    if (sections.length === 0) {
      void showNoDataDialog();
      return false;
    }

    return openPrintWindow(
      "保管場所別在庫表",
      sections
    );
  }

  function createPrintLocationSection(
    location,
    rows,
    forcePageBreak
  ) {
    const totalStock =
      rows.reduce(
        function (sum, row) {
          return sum + row.stock;
        },
        0
      );

    const body =
      rows.length > 0
        ? rows.map(
            function (row, index) {
              return `
                <tr>
                  <td class="print-no">${index + 1}</td>
                  <td>${escapeHtml(row.internalCode || "-")}</td>
                  <td>${escapeHtml(row.productCode || "-")}</td>
                  <td class="print-color">${escapeHtml(row.productColor || "-")}</td>
                  <td class="print-stock">${formatNumber(row.stock)}</td>
                  <td class="print-check"><span class="print-check-box" aria-hidden="true"></span></td>
                  <td class="print-note"></td>
                </tr>
              `;
            }
          ).join("")
        : `
            <tr>
              <td colspan="7" class="print-empty">在庫はありません。</td>
            </tr>
          `;

    return `
      <section class="print-location-section ${forcePageBreak ? "print-location-page" : ""}">
        <div class="print-location-title-row">
          <div>
            <div class="print-kicker">保管場所別在庫表</div>
            <h1>${escapeHtml(location)}</h1>
          </div>
          <div class="print-summary-box">
            <span>商品数 <strong>${formatNumber(rows.length)}商品</strong></span>
            <span>在庫合計 <strong>${formatNumber(totalStock)}個</strong></span>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>No</th>
              <th>社内コード</th>
              <th>商品コード</th>
              <th>色</th>
              <th>在庫数</th>
              <th>確認</th>
              <th>備考</th>
            </tr>
          </thead>
          <tbody>${body}</tbody>
        </table>
      </section>
    `;
  }

  function openPrintWindow(title, sections) {
    const printWindow =
      window.open("", "_blank");

    if (!printWindow) {
      if (
        typeof showAppDialog ===
        "function"
      ) {
        void showAppDialog({
          type: "warning",
          icon: "🖨️",
          title: "印刷画面を開けませんでした",
          message:
            "ブラウザでポップアップがブロックされていないか確認してください。",
          confirmText: "閉じる"
        });
      }
      return false;
    }

    const now = new Date();
    const printedAt =
      now.toLocaleString("ja-JP", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit"
      });

    printWindow.document.open();
    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="ja">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${escapeHtml(title)}</title>
        <style>
          @page {
            size: A4 portrait;
            margin: 6mm 7mm;
          }

          * {
            box-sizing: border-box;
          }

          body {
            margin: 0;
            color: #111;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Yu Gothic", "Meiryo", sans-serif;
            font-size: 8.7pt;
          }

          .print-meta {
            margin-bottom: 2.5mm;
            text-align: right;
            font-size: 7.2pt;
            color: #444;
          }

          .print-location-section {
            break-inside: auto;
          }

          .print-location-page:not(:first-of-type) {
            break-before: page;
            page-break-before: always;
          }

          .print-location-title-row {
            display: flex;
            align-items: flex-end;
            justify-content: space-between;
            gap: 4mm;
            margin-bottom: 2.5mm;
          }

          .print-kicker {
            font-size: 7.2pt;
            font-weight: 700;
            color: #333;
          }

          h1 {
            margin: 0.5mm 0 0;
            font-size: 15pt;
            line-height: 1.15;
          }

          .print-summary-box {
            display: flex;
            gap: 3mm;
            padding: 1.5mm 2.5mm;
            border: 1px solid #777;
            border-radius: 2mm;
            white-space: nowrap;
            font-size: 7.8pt;
          }

          .print-summary-box strong {
            font-size: 9.5pt;
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
            border: 1px solid #555;
            padding: 1.05mm 1mm;
            vertical-align: middle;
            overflow-wrap: anywhere;
            line-height: 1.18;
          }

          th {
            background: #e8eef5;
            font-size: 8pt;
            text-align: left;
            white-space: nowrap;
          }

          th:nth-child(1), td:nth-child(1) { width: 4%; }
          th:nth-child(2), td:nth-child(2) { width: 13%; }
          th:nth-child(3), td:nth-child(3) { width: 17%; }
          th:nth-child(4), td:nth-child(4) { width: 12%; }
          th:nth-child(5), td:nth-child(5) { width: 10%; }
          th:nth-child(6), td:nth-child(6) { width: 7%; }
          th:nth-child(7), td:nth-child(7) { width: 37%; }

          .print-no {
            text-align: center;
          }

          .print-color {
            white-space: normal;
            overflow-wrap: anywhere;
            line-height: 1.15;
          }

          .print-stock {
            text-align: right;
            font-size: 9.2pt;
            font-weight: 800;
            white-space: nowrap;
          }

          .print-check {
            text-align: center;
          }

          .print-check-box {
            display: inline-block;
            width: 3.6mm;
            height: 3.6mm;
            border: 1.2px solid #222;
            vertical-align: middle;
          }

          .print-note {
            min-height: 4.2mm;
            white-space: normal;
          }

          .print-empty {
            padding: 8mm;
            text-align: center;
            color: #555;
          }

          @media print {
            body {
              print-color-adjust: exact;
              -webkit-print-color-adjust: exact;
            }
          }
        </style>
      </head>
      <body>
        <div class="print-meta">印刷日時：${escapeHtml(printedAt)}</div>
        ${sections.join("")}
        <script>
          window.addEventListener("load", function () {
            setTimeout(function () {
              window.print();
            }, 120);
          });
        <\/script>
      </body>
      </html>
    `);
    printWindow.document.close();

    return true;
  }

  function formatNumber(value) {
    return Number(value || 0)
      .toLocaleString("ja-JP");
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
})();
