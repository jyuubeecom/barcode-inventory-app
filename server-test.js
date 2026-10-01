"use strict";

(function () {
  const SERVER_TEST_ENDPOINT =
    "https://jyuubee.sakura.ne.jp/inventory/app-server-test.php";

  let serverTestOverlay = null;
  let serverTestResult = null;
  let serverTestRetryButton = null;

  document.addEventListener(
    "DOMContentLoaded",
    initializeServerConnectionTest
  );

  function initializeServerConnectionTest() {
    createServerTestStyle();

    const button = document.querySelector(
      "#server-connection-test-button"
    );

    if (!button) {
      return;
    }

    button.addEventListener(
      "click",
      openServerConnectionTest
    );
  }

  async function openServerConnectionTest() {
    if (
      window.inventoryPermissions &&
      typeof window.inventoryPermissions.isAdmin === "function" &&
      !window.inventoryPermissions.isAdmin()
    ) {
      if (
        typeof window.inventoryPermissions.showWorkerRestriction ===
        "function"
      ) {
        await window.inventoryPermissions.showWorkerRestriction(
          "サーバー接続テスト"
        );
      }
      return;
    }

    ensureServerTestDialog();
    serverTestOverlay.hidden = false;
    document.body.classList.add(
      "server-test-dialog-open"
    );

    await runServerConnectionTest();
  }

  function closeServerConnectionTest() {
    if (!serverTestOverlay) {
      return;
    }

    serverTestOverlay.hidden = true;
    document.body.classList.remove(
      "server-test-dialog-open"
    );
  }

  function ensureServerTestDialog() {
    if (serverTestOverlay) {
      return;
    }

    serverTestOverlay = document.createElement("div");
    serverTestOverlay.id = "server-connection-test-dialog";
    serverTestOverlay.className = "server-test-overlay";
    serverTestOverlay.hidden = true;

    serverTestOverlay.innerHTML = `
      <section
        class="server-test-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="server-test-title"
      >
        <div class="server-test-heading">
          <div>
            <span class="server-test-kicker">さくらサーバー</span>
            <h2 id="server-test-title">サーバー接続テスト</h2>
          </div>

          <button
            id="server-test-close-button"
            type="button"
            class="server-test-close-button"
          >
            閉じる
          </button>
        </div>

        <p class="server-test-description">
          架空商品「TEST001」をサーバーから読み込みます。
          このテストでは実際の会社データは使用しません。
        </p>

        <div
          id="server-test-result"
          class="server-test-result"
          aria-live="polite"
        ></div>

        <div class="server-test-actions">
          <button
            id="server-test-retry-button"
            type="button"
          >
            もう一度確認する
          </button>

          <button
            id="server-test-bottom-close-button"
            type="button"
            class="server-test-secondary-button"
          >
            閉じる
          </button>
        </div>
      </section>
    `;

    document.body.appendChild(
      serverTestOverlay
    );

    serverTestResult =
      serverTestOverlay.querySelector(
        "#server-test-result"
      );

    serverTestRetryButton =
      serverTestOverlay.querySelector(
        "#server-test-retry-button"
      );

    const closeButtons = [
      serverTestOverlay.querySelector(
        "#server-test-close-button"
      ),
      serverTestOverlay.querySelector(
        "#server-test-bottom-close-button"
      )
    ];

    closeButtons.forEach(function (button) {
      if (!button) return;
      button.addEventListener(
        "click",
        closeServerConnectionTest
      );
    });

    if (serverTestRetryButton) {
      serverTestRetryButton.addEventListener(
        "click",
        runServerConnectionTest
      );
    }

    serverTestOverlay.addEventListener(
      "click",
      function (event) {
        if (event.target === serverTestOverlay) {
          closeServerConnectionTest();
        }
      }
    );

    document.addEventListener(
      "keydown",
      function (event) {
        if (
          event.key === "Escape" &&
          serverTestOverlay &&
          !serverTestOverlay.hidden
        ) {
          closeServerConnectionTest();
        }
      }
    );
  }

  async function runServerConnectionTest() {
    if (!serverTestResult) {
      return;
    }

    serverTestResult.innerHTML = `
      <div class="server-test-status server-test-loading">
        <strong>接続確認中...</strong>
        <span>さくらサーバーからTEST001を読み込んでいます。</span>
      </div>
    `;

    if (serverTestRetryButton) {
      serverTestRetryButton.disabled = true;
    }

    try {
      const response = await fetch(
        SERVER_TEST_ENDPOINT,
        {
          method: "GET",
          mode: "cors",
          cache: "no-store",
          headers: {
            Accept: "application/json"
          }
        }
      );

      let data = null;

      try {
        data = await response.json();
      } catch (jsonError) {
        throw new Error(
          "サーバーから正しい形式の応答がありません。"
        );
      }

      if (
        !response.ok ||
        !data ||
        data.success !== true
      ) {
        throw new Error(
          data && data.message
            ? data.message
            : "サーバー接続テストに失敗しました。"
        );
      }

      renderServerTestSuccess(data);
    } catch (error) {
      renderServerTestError(error);
    } finally {
      if (serverTestRetryButton) {
        serverTestRetryButton.disabled = false;
      }
    }
  }

  function renderServerTestSuccess(data) {
    const product = data.product || {};
    const stocks = Array.isArray(data.stocks)
      ? data.stocks
      : [];

    const stockRows = stocks.length
      ? stocks.map(function (stock) {
          return `
            <div class="server-test-stock-row">
              <span>${escapeServerTestHtml(stock.location_name || "-")}</span>
              <strong>${formatServerTestNumber(stock.quantity)}個</strong>
            </div>
          `;
        }).join("")
      : `
          <div class="server-test-empty-stock">
            場所別在庫はありません。
          </div>
        `;

    serverTestResult.innerHTML = `
      <div class="server-test-status server-test-success">
        <strong>✓ サーバー接続成功</strong>
        <span>PC・スマホから同じMySQLデータを取得できています。</span>
      </div>

      <div class="server-test-product">
        <span class="server-test-product-label">商品名</span>
        <strong class="server-test-product-name">
          ${escapeServerTestHtml(product.product_name || "-")}
        </strong>

        <div class="server-test-code-row">
          <span>社内コード：${escapeServerTestHtml(product.internal_code || "-")}</span>
          <span>商品コード：${escapeServerTestHtml(product.product_code || "-")}</span>
        </div>
      </div>

      <div class="server-test-total-stock">
        <span>現在庫合計</span>
        <strong>${formatServerTestNumber(data.total_stock)}個</strong>
      </div>

      <div class="server-test-stock-list">
        <h3>保管場所別在庫</h3>
        ${stockRows}
      </div>

      <p class="server-test-endpoint-note">
        接続先：jyuubee.sakura.ne.jp / TEST001（架空データ）
      </p>
    `;
  }

  function renderServerTestError(error) {
    const message =
      error && error.message
        ? error.message
        : "サーバーへ接続できませんでした。";

    serverTestResult.innerHTML = `
      <div class="server-test-status server-test-error">
        <strong>⚠ サーバー接続に失敗しました</strong>
        <span>${escapeServerTestHtml(message)}</span>
      </div>

      <div class="server-test-help">
        <p>次の3点を確認してください。</p>
        <p>① インターネットに接続されているか</p>
        <p>② さくらサーバーが利用できる状態か</p>
        <p>③ app-server-test.php がサーバーに置かれているか</p>
      </div>
    `;
  }

  function formatServerTestNumber(value) {
    const number = Number(value);

    if (!Number.isFinite(number)) {
      return "0";
    }

    return number.toLocaleString("ja-JP");
  }

  function escapeServerTestHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function createServerTestStyle() {
    if (
      document.querySelector(
        "#server-test-style"
      )
    ) {
      return;
    }

    const style = document.createElement("style");
    style.id = "server-test-style";
    style.textContent = `
      body.server-test-dialog-open {
        overflow: hidden;
      }

      .server-test-overlay {
        position: fixed;
        inset: 0;
        z-index: 100000;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 18px;
        background: rgba(15, 33, 48, 0.62);
      }

      .server-test-overlay[hidden] {
        display: none !important;
      }

      .server-test-card {
        width: min(680px, 100%);
        max-height: min(760px, calc(100vh - 36px));
        overflow: auto;
        padding: 24px;
        border: 2px solid #1565c0;
        border-radius: 18px;
        background: #ffffff;
        box-shadow: 0 18px 45px rgba(0, 0, 0, 0.24);
      }

      .server-test-heading {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 16px;
        padding-bottom: 14px;
        border-bottom: 1px solid #cfe0ef;
      }

      .server-test-kicker {
        display: block;
        margin-bottom: 4px;
        color: #1565c0;
        font-size: 13px;
        font-weight: 700;
      }

      .server-test-heading h2 {
        margin: 0;
        color: #123a5a;
        font-size: 24px;
      }

      .server-test-close-button,
      .server-test-secondary-button {
        background: #546e7a !important;
      }

      .server-test-description {
        margin: 16px 0;
        color: #536b7d;
        line-height: 1.7;
      }

      .server-test-status {
        display: grid;
        gap: 5px;
        margin-bottom: 16px;
        padding: 16px;
        border-radius: 12px;
      }

      .server-test-status strong {
        font-size: 19px;
      }

      .server-test-loading {
        border: 1px solid #90caf9;
        background: #eaf5ff;
        color: #0d5da8;
      }

      .server-test-success {
        border: 1px solid #81c784;
        background: #eefaf0;
        color: #1b6e2e;
      }

      .server-test-error {
        border: 1px solid #ef9a9a;
        background: #fff0f0;
        color: #b42318;
      }

      .server-test-product {
        padding: 16px;
        border: 1px solid #d7e2eb;
        border-radius: 12px;
        background: #fafcfe;
      }

      .server-test-product-label {
        display: block;
        margin-bottom: 4px;
        color: #60788b;
        font-size: 13px;
      }

      .server-test-product-name {
        display: block;
        color: #173b58;
        font-size: 22px;
      }

      .server-test-code-row {
        display: flex;
        flex-wrap: wrap;
        gap: 6px 18px;
        margin-top: 10px;
        color: #60788b;
        font-size: 14px;
      }

      .server-test-total-stock {
        display: grid;
        gap: 4px;
        margin: 16px 0;
        padding: 18px;
        border: 2px solid #2e8b3c;
        border-radius: 12px;
        background: #effcf2;
        text-align: center;
      }

      .server-test-total-stock span {
        color: #557164;
      }

      .server-test-total-stock strong {
        color: #1f7b31;
        font-size: 36px;
      }

      .server-test-stock-list h3 {
        margin: 0 0 10px;
        color: #173b58;
        font-size: 18px;
      }

      .server-test-stock-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        margin-top: 8px;
        padding: 14px;
        border: 1px solid #d7e2eb;
        border-radius: 10px;
        background: #ffffff;
      }

      .server-test-stock-row strong {
        color: #1565c0;
        font-size: 19px;
      }

      .server-test-empty-stock,
      .server-test-help {
        padding: 14px;
        border-radius: 10px;
        background: #f4f7f9;
        color: #526878;
      }

      .server-test-help p {
        margin: 5px 0;
      }

      .server-test-endpoint-note {
        margin: 16px 0 0;
        color: #718696;
        font-size: 12px;
      }

      .server-test-actions {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px;
        margin-top: 20px;
      }

      .server-test-actions button,
      .server-test-close-button {
        min-height: 46px;
        padding: 10px 16px;
        border: 0;
        border-radius: 9px;
        background: #1565c0;
        color: #ffffff;
        font-size: 15px;
        font-weight: 700;
        cursor: pointer;
      }

      .server-test-actions button:disabled {
        cursor: wait;
        opacity: 0.58;
      }

      @media (max-width: 640px) {
        .server-test-overlay {
          align-items: stretch;
          padding: 8px;
        }

        .server-test-card {
          max-height: calc(100vh - 16px);
          padding: 18px;
          border-radius: 14px;
        }

        .server-test-heading h2 {
          font-size: 21px;
        }

        .server-test-heading {
          gap: 8px;
        }

        .server-test-close-button {
          min-width: 74px;
        }

        .server-test-actions {
          grid-template-columns: 1fr;
        }
      }
    `;

    document.head.appendChild(style);
  }
})();
