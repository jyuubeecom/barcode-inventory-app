"use strict";

(function () {
  const SERVER_LOGIN_ENDPOINT =
    "https://jyuubee.sakura.ne.jp/inventory/login.php";

  const SERVER_PRODUCT_ENDPOINT =
    "https://jyuubee.sakura.ne.jp/inventory/get-product-auth.php";

  const SERVER_STOCK_HISTORY_ENDPOINT =
    "https://jyuubee.sakura.ne.jp/inventory/get-stock-history-auth.php";

  const SERVER_STOCK_IN_ENDPOINT =
    "https://jyuubee.sakura.ne.jp/inventory/stock-in-auth.php";

  const SERVER_STOCK_OUT_ENDPOINT =
    "https://jyuubee.sakura.ne.jp/inventory/stock-out-auth.php";

  const DEFAULT_TEST_INTERNAL_CODE = "TEST001";

  const TOKEN_STORAGE_KEY =
    "barcodeInventoryServerAccessToken";

  const EXPIRES_STORAGE_KEY =
    "barcodeInventoryServerAccessExpiresAt";

  const USER_STORAGE_KEY =
    "barcodeInventoryServerUser";

  let overlay = null;
  let content = null;
  let serverDetailMode = false;
  let lastServerProductData = null;
  let lastServerRequestedCode = DEFAULT_TEST_INTERNAL_CODE;
  let serverDetailReturnTarget = "server-search";
  let lastServerStockInMessage = "";
  let lastServerStockOutMessage = "";

  document.addEventListener(
    "DOMContentLoaded",
    initializeServerAuthTest
  );

  function initializeServerAuthTest() {
    createStyles();
    initializeServerProductDetailBridge();

    const button = document.querySelector(
      "#server-connection-test-button"
    );

    if (!button) {
      return;
    }

    button.addEventListener(
      "click",
      openDialog
    );
  }

  async function openDialog() {
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
          "サーバーログイン・商品検索"
        );
      }
      return;
    }

    ensureDialog();
    overlay.hidden = false;
    document.body.classList.add("server-auth-dialog-open");

    renderCurrentState();
  }

  function closeDialog() {
    if (!overlay) {
      return;
    }

    overlay.hidden = true;
    document.body.classList.remove("server-auth-dialog-open");
  }

  function ensureDialog() {
    if (overlay) {
      return;
    }

    overlay = document.createElement("div");
    overlay.id = "server-auth-dialog";
    overlay.className = "server-auth-overlay";
    overlay.hidden = true;

    overlay.innerHTML = `
      <section
        class="server-auth-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="server-auth-title"
      >
        <div class="server-auth-heading">
          <div>
            <span class="server-auth-kicker">さくらサーバー</span>
            <h2 id="server-auth-title">サーバーログイン・商品検索</h2>
          </div>

          <button
            id="server-auth-close-button"
            type="button"
            class="server-auth-close-button"
          >
            閉じる
          </button>
        </div>

        <p class="server-auth-description">
          テスト用アカウントでログインし、社内コードを入力して
          サーバーの商品データを検索できることを確認します。
          現段階では架空データだけを使用します。
        </p>

        <div
          id="server-auth-content"
          class="server-auth-content"
          aria-live="polite"
        ></div>
      </section>
    `;

    document.body.appendChild(overlay);

    content = overlay.querySelector(
      "#server-auth-content"
    );

    const closeButton = overlay.querySelector(
      "#server-auth-close-button"
    );

    if (closeButton) {
      closeButton.addEventListener(
        "click",
        closeDialog
      );
    }

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
      function (event) {
        if (
          event.key === "Escape" &&
          overlay &&
          !overlay.hidden
        ) {
          closeDialog();
        }
      }
    );
  }

  function renderCurrentState() {
    const session = getStoredSession();

    if (session) {
      renderLoggedInState(session);
      return;
    }

    renderLoginForm();
  }

  function renderLoginForm(message = "") {
    if (!content) {
      return;
    }

    const messageHtml = message
      ? `
          <div class="server-auth-status server-auth-error">
            <strong>ログインできませんでした</strong>
            <span>${escapeHtml(message)}</span>
          </div>
        `
      : `
          <div class="server-auth-status server-auth-info">
            <strong>🔐 サーバーログインが必要です</strong>
            <span>テスト用のログインIDとパスワードを入力してください。</span>
          </div>
        `;

    content.innerHTML = `
      ${messageHtml}

      <form id="server-auth-login-form" class="server-auth-login-form">
        <label>
          <span>ログインID</span>
          <input
            id="server-auth-username"
            type="text"
            autocomplete="username"
            maxlength="50"
            placeholder="例：test-admin"
            required
          >
        </label>

        <label>
          <span>パスワード</span>
          <input
            id="server-auth-password"
            type="password"
            autocomplete="current-password"
            maxlength="200"
            placeholder="パスワードを入力"
            required
          >
        </label>

        <button
          id="server-auth-login-button"
          type="submit"
          class="server-auth-primary-button"
        >
          ログインして商品検索へ進む
        </button>
      </form>

      <p class="server-auth-note">
        パスワードはこの画面やブラウザー保存領域には保存しません。
        ログイン成功後の一時的なトークンだけを、このタブを閉じるまで保持します。
      </p>
    `;

    const form = content.querySelector(
      "#server-auth-login-form"
    );

    const usernameInput = content.querySelector(
      "#server-auth-username"
    );

    if (usernameInput) {
      usernameInput.focus();
    }

    if (form) {
      form.addEventListener(
        "submit",
        handleLogin
      );
    }
  }

  async function handleLogin(event) {
    event.preventDefault();

    const usernameInput = content.querySelector(
      "#server-auth-username"
    );

    const passwordInput = content.querySelector(
      "#server-auth-password"
    );

    const loginButton = content.querySelector(
      "#server-auth-login-button"
    );

    const username = usernameInput
      ? usernameInput.value.trim()
      : "";

    const password = passwordInput
      ? passwordInput.value
      : "";

    if (!username || !password) {
      renderLoginForm(
        "ログインIDとパスワードを入力してください。"
      );
      return;
    }

    if (loginButton) {
      loginButton.disabled = true;
      loginButton.textContent = "ログイン確認中...";
    }

    try {
      const response = await fetch(
        SERVER_LOGIN_ENDPOINT,
        {
          method: "POST",
          mode: "cors",
          cache: "no-store",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json"
          },
          body: JSON.stringify({
            username,
            password
          })
        }
      );

      const data = await readJsonResponse(response);

      if (
        !response.ok ||
        !data ||
        data.success !== true ||
        !data.token
      ) {
        throw new Error(
          data && data.message
            ? data.message
            : "ログインに失敗しました。"
        );
      }

      const expiresIn = Number(data.expires_in);
      const expiresAt =
        Date.now() +
        (Number.isFinite(expiresIn) ? expiresIn : 28800) * 1000;

      storeSession({
        token: data.token,
        expiresAt,
        user: data.user || {
          username,
          display_name: username,
          role: ""
        }
      });

      notifyServerAuthChanged("login");

      if (passwordInput) {
        passwordInput.value = "";
      }

      const session = getStoredSession();

      if (!session) {
        throw new Error(
          "ログイン情報を保存できませんでした。"
        );
      }

      renderLoggedInState(session);
      await loadProtectedProduct(session, DEFAULT_TEST_INTERNAL_CODE);
    } catch (error) {
      clearStoredSession();
      renderLoginForm(
        getErrorMessage(
          error,
          "ログイン処理に失敗しました。"
        )
      );
    }
  }

  function renderLoggedInState(session) {
    if (!content) {
      return;
    }

    const user = session.user || {};
    const displayName =
      user.display_name ||
      user.username ||
      "ログインユーザー";

    const roleText =
      user.role === "admin"
        ? "管理者"
        : user.role === "worker"
          ? "作業者"
          : user.role || "-";

    content.innerHTML = `
      <div class="server-auth-status server-auth-success">
        <strong>✓ サーバーログイン済み</strong>
        <span>
          ${escapeHtml(displayName)} / ${escapeHtml(roleText)}
        </span>
      </div>

      <form
        id="server-auth-product-search-form"
        class="server-auth-product-search-form"
      >
        <label for="server-auth-product-code">
          <span>社内コードで商品を検索</span>
        </label>

        <div class="server-auth-product-search-row">
          <input
            id="server-auth-product-code"
            type="text"
            maxlength="50"
            value="${escapeHtml(lastServerRequestedCode)}"
            placeholder="例：TEST001"
            autocomplete="off"
            required
          >

          <button
            id="server-auth-product-button"
            type="submit"
            class="server-auth-primary-button"
          >
            商品を検索する
          </button>
        </div>

        <span class="server-auth-search-guide">
          現段階では架空商品「TEST001」で動作確認します。
        </span>
      </form>

      <button
        id="server-auth-logout-button"
        type="button"
        class="server-auth-secondary-button server-auth-logout-wide"
      >
        この端末のログインを解除
      </button>

      <div
        id="server-auth-product-result"
        class="server-auth-product-result"
      ></div>

      <p class="server-auth-note">
        ログイン情報はこのブラウザータブ内だけに保持します。
        実際の会社データはまだサーバーへ登録しません。
      </p>
    `;

    const searchForm = content.querySelector(
      "#server-auth-product-search-form"
    );

    const productCodeInput = content.querySelector(
      "#server-auth-product-code"
    );

    const logoutButton = content.querySelector(
      "#server-auth-logout-button"
    );

    if (searchForm) {
      searchForm.addEventListener(
        "submit",
        function (event) {
          event.preventDefault();

          const latestSession = getStoredSession();

          if (!latestSession) {
            renderLoginForm(
              "ログインの有効期限が切れました。もう一度ログインしてください。"
            );
            return;
          }

          const internalCode = productCodeInput
            ? productCodeInput.value.trim()
            : "";

          if (!internalCode) {
            if (productCodeInput) {
              productCodeInput.focus();
            }
            return;
          }

          loadProtectedProduct(
            latestSession,
            internalCode
          );
        }
      );
    }

    if (logoutButton) {
      logoutButton.addEventListener(
        "click",
        function () {
          clearStoredSession();
          notifyServerAuthChanged("logout");
          renderLoginForm();
        }
      );
    }
  }

  async function loadProtectedProduct(session, internalCode) {
    const result = content.querySelector(
      "#server-auth-product-result"
    );

    const productButton = content.querySelector(
      "#server-auth-product-button"
    );

    if (!result) {
      return;
    }

    result.innerHTML = `
      <div class="server-auth-status server-auth-loading">
        <strong>商品データを確認中...</strong>
        <span>ログイン情報を付けて「${escapeHtml(internalCode)}」を検索しています。</span>
      </div>
    `;

    if (productButton) {
      productButton.disabled = true;
    }

    try {
      const response = await fetch(
        SERVER_PRODUCT_ENDPOINT +
          "?code=" +
          encodeURIComponent(internalCode),
        {
          method: "GET",
          mode: "cors",
          cache: "no-store",
          headers: {
            Accept: "application/json",
            Authorization: "Bearer " + session.token
          }
        }
      );

      const data = await readJsonResponse(response);

      if (response.status === 401) {
        clearStoredSession();
        notifyServerAuthChanged("expired");
        renderLoginForm(
          "ログインの有効期限が切れたか、ログイン情報を確認できませんでした。"
        );
        return;
      }

      if (
        !response.ok ||
        !data ||
        data.success !== true
      ) {
        throw new Error(
          data && data.message
            ? data.message
            : "商品データの取得に失敗しました。"
        );
      }

      lastServerProductData = data;
      lastServerRequestedCode = internalCode;
      renderProductSuccess(result, data, internalCode);
    } catch (error) {
      result.innerHTML = `
        <div class="server-auth-status server-auth-error">
          <strong>⚠ 商品データを取得できませんでした</strong>
          <span>${escapeHtml(getErrorMessage(error, "サーバー通信に失敗しました。"))}</span>
        </div>
      `;
    } finally {
      if (productButton && document.body.contains(productButton)) {
        productButton.disabled = false;
      }
    }
  }

  function renderProductSuccess(result, data, requestedCode) {
    const product = data.product || {};
    const stocks = Array.isArray(data.stocks)
      ? data.stocks
      : [];

    const stockRows = stocks.length
      ? stocks.map(function (stock) {
          return `
            <div class="server-auth-stock-row">
              <span>${escapeHtml(stock.location_name || "-")}</span>
              <strong>${formatNumber(stock.quantity)}個</strong>
            </div>
          `;
        }).join("")
      : `
          <div class="server-auth-empty-stock">
            場所別在庫はありません。
          </div>
        `;

    result.innerHTML = `
      <div class="server-auth-status server-auth-success">
        <strong>✓ 認証付き商品取得に成功</strong>
        <span>ログイン済みの状態でMySQLの商品データを取得できました。</span>
      </div>

      <div class="server-auth-product">
        <span class="server-auth-product-label">商品名</span>
        <strong class="server-auth-product-name">
          ${escapeHtml(product.product_name || "-")}
        </strong>

        <div class="server-auth-code-row">
          <span>社内コード：${escapeHtml(product.internal_code || "-")}</span>
          <span>商品コード：${escapeHtml(product.product_code || "-")}</span>
        </div>
      </div>

      <div class="server-auth-total-stock">
        <span>現在庫合計</span>
        <strong>${formatNumber(data.total_stock)}個</strong>
      </div>

      <div class="server-auth-stock-list">
        <h3>保管場所別在庫</h3>
        ${stockRows}
      </div>

      <button
        id="server-auth-open-detail-button"
        type="button"
        class="server-auth-primary-button server-auth-open-detail-button"
      >
        商品詳細を見る
      </button>

      <p class="server-auth-readonly-note">
        ※ 商品詳細画面から共有サーバーへの入庫・出庫を試せます。商品編集はまだ行いません。
      </p>

      <p class="server-auth-endpoint-note">
        保護された接続先：get-product-auth.php / ${escapeHtml(requestedCode)}
      </p>
    `;

    const openDetailButton = result.querySelector(
      "#server-auth-open-detail-button"
    );

    if (openDetailButton) {
      openDetailButton.addEventListener(
        "click",
        function () {
          openServerProductDetail(
            data,
            requestedCode
          );
        }
      );
    }
  }

  function initializeServerProductDetailBridge() {
    const backButton = document.querySelector(
      "#back-list-from-detail"
    );

    if (!backButton) {
      return;
    }

    backButton.addEventListener(
      "click",
      function (event) {
        if (!serverDetailMode) {
          return;
        }

        event.preventDefault();
        event.stopImmediatePropagation();

        const returnTarget = serverDetailReturnTarget;

        restoreNormalProductDetailLayout();
        serverDetailReturnTarget = "server-search";

        if (
          returnTarget === "server-list" &&
          window.inventoryServerProductList &&
          typeof window.inventoryServerProductList.returnFromDetail === "function"
        ) {
          window.inventoryServerProductList.returnFromDetail();
          return;
        }

        if (
          window.inventoryApp &&
          typeof window.inventoryApp.showScreen === "function"
        ) {
          window.inventoryApp.showScreen("home");
        }

        openDialog();

        const session = getStoredSession();

        if (session && lastServerRequestedCode) {
          window.setTimeout(
            function () {
              loadProtectedProduct(
                session,
                lastServerRequestedCode
              );
            },
            0
          );
        }
      },
      true
    );
  }

  function openServerProductDetail(data, requestedCode) {
    if (
      !window.inventoryApp ||
      typeof window.inventoryApp.showScreen !== "function"
    ) {
      return;
    }

    const product = data && data.product
      ? data.product
      : {};

    const stocks = data && Array.isArray(data.stocks)
      ? data.stocks
      : [];

    const totalStock = toStockNumber(
      data ? data.total_stock : 0
    );

    const minStock = toStockNumber(
      product.min_stock
    );

    lastServerProductData = data;
    lastServerRequestedCode =
      requestedCode ||
      product.internal_code ||
      DEFAULT_TEST_INTERNAL_CODE;

    serverDetailMode = true;
    closeDialog();

    setDetailText(
      "#detail-internal-code",
      product.internal_code || "未登録"
    );
    setDetailText(
      "#detail-product-code",
      product.product_code || "未登録"
    );
    setDetailText(
      "#detail-product-name",
      product.product_name || "商品名未登録"
    );
    setDetailText(
      "#detail-product-color",
      product.color || "未登録"
    );
    setDetailText(
      "#detail-jan-code",
      product.jan_code || "未登録"
    );
    setDetailText(
      "#detail-stock",
      `${formatNumber(totalStock)}個`
    );
    setDetailText(
      "#detail-min-stock",
      `${formatNumber(minStock)}個`
    );

    const stockStatus = getServerStockStatus(
      product,
      totalStock,
      minStock
    );

    setDetailStatus(
      "#detail-stock-status",
      stockStatus
    );

    setDetailText(
      "#detail-category",
      product.category || "未登録"
    );

    setDetailText(
      "#detail-location",
      getServerPrimaryLocation(stocks)
    );

    renderServerLocationStocks(stocks);

    setDetailText(
      "#detail-supplier",
      product.supplier_name || "未登録"
    );
    setDetailText(
      "#detail-order-remaining",
      "未登録"
    );

    setServerLifecycleStatus(
      product.product_status || "通常商品"
    );

    setDetailText(
      "#detail-updated-at",
      "共有サーバーから取得した最新情報"
    );

    prepareServerProductDetailLayout();
    window.inventoryApp.showScreen("detail");

    loadServerStockHistory(
      product.internal_code || lastServerRequestedCode
    );

    const detailScreen = document.querySelector(
      "#product-detail"
    );

    if (detailScreen) {
      window.requestAnimationFrame(
        function () {
          detailScreen.scrollIntoView({
            behavior: "smooth",
            block: "start"
          });
        }
      );
    }
  }

  function prepareServerProductDetailLayout() {
    const detailScreen = document.querySelector(
      "#product-detail"
    );

    if (!detailScreen) {
      return;
    }

    const heading = detailScreen.querySelector("h2");

    if (heading) {
      if (!heading.dataset.normalTitle) {
        heading.dataset.normalTitle =
          heading.textContent || "商品詳細画面";
      }

      heading.textContent =
        "商品詳細";
    }

    let notice = detailScreen.querySelector(
      "#server-product-detail-notice"
    );

    if (!notice) {
      notice = document.createElement("div");
      notice.id = "server-product-detail-notice";
      notice.className =
        "server-product-detail-notice";

      const strong = document.createElement("strong");
      strong.textContent =
        "共有サーバーの商品";

      const span = document.createElement("span");
      span.textContent =
        "PC・スマホで共通の最新商品情報を表示しています。" +
        "共有サーバーへの入庫・出庫に対応しています。商品編集はまだ移行中です。";

      notice.appendChild(strong);
      notice.appendChild(span);

      const table = detailScreen.querySelector("table");

      if (table) {
        detailScreen.insertBefore(
          notice,
          table
        );
      }
    }

    notice.hidden = false;

    let operationGuide = detailScreen.querySelector(
      "#server-product-detail-operation-guide"
    );

    if (!operationGuide) {
      operationGuide = document.createElement("div");
      operationGuide.id =
        "server-product-detail-operation-guide";
      operationGuide.className =
        "server-product-detail-operation-guide";
      operationGuide.innerHTML = `
        <div class="server-product-detail-operation-heading">
          <strong>この商品でできること</strong>
          <span>共有サーバー移行中</span>
        </div>
        <div class="server-product-detail-operation-row server-product-detail-operation-ready">
          <span>現在利用できます</span>
          <strong>商品情報・在庫数・保管場所・最近の在庫履歴・入庫・出庫</strong>
        </div>
        <div class="server-product-detail-operation-row server-product-detail-operation-next">
          <span>次の段階で追加予定</span>
          <strong>商品編集</strong>
        </div>
      `;

      const table = detailScreen.querySelector("table");

      if (table) {
        table.insertAdjacentElement(
          "afterend",
          operationGuide
        );
      }
    }

    operationGuide.hidden = false;

    let stockInSection = detailScreen.querySelector(
      "#server-product-stock-in"
    );

    if (!stockInSection) {
      stockInSection = document.createElement("section");
      stockInSection.id = "server-product-stock-in";
      stockInSection.className = "server-product-stock-in";

      operationGuide.insertAdjacentElement(
        "afterend",
        stockInSection
      );
    }

    stockInSection.hidden = false;
    renderServerStockInSection(stockInSection);

    let stockOutSection = detailScreen.querySelector(
      "#server-product-stock-out"
    );

    if (!stockOutSection) {
      stockOutSection = document.createElement("section");
      stockOutSection.id = "server-product-stock-out";
      stockOutSection.className = "server-product-stock-out";

      stockInSection.insertAdjacentElement(
        "afterend",
        stockOutSection
      );
    }

    stockOutSection.hidden = false;
    renderServerStockOutSection(stockOutSection);

    let historySection = detailScreen.querySelector(
      "#server-product-stock-history"
    );

    if (!historySection) {
      historySection = document.createElement("section");
      historySection.id = "server-product-stock-history";
      historySection.className = "server-product-stock-history";
      historySection.innerHTML = `
        <div class="server-product-stock-history-heading">
          <div>
            <span>共有在庫</span>
            <h3>最近の在庫履歴</h3>
          </div>
          <span class="server-product-stock-history-badge">閲覧専用</span>
        </div>
        <div
          id="server-product-stock-history-content"
          class="server-product-stock-history-content"
          aria-live="polite"
        >
          履歴を読み込んでいます。
        </div>
      `;

      stockOutSection.insertAdjacentElement(
        "afterend",
        historySection
      );
    }

    historySection.hidden = false;

    [
      ".product-detail-action-group-main",
      "#product-detail-order-actions",
      "#product-detail-admin-actions"
    ].forEach(function (selector) {
      const element =
        detailScreen.querySelector(selector);

      if (element) {
        element.hidden = true;
      }
    });

    const workerNotice = document.querySelector(
      "#product-detail-worker-notice"
    );

    if (workerNotice) {
      workerNotice.hidden = true;
    }

    const backButton = document.querySelector(
      "#back-list-from-detail"
    );

    if (backButton) {
      backButton.textContent =
        serverDetailReturnTarget === "server-list"
          ? "商品一覧へ戻る"
          : "商品検索へ戻る";
    }
  }

  function restoreNormalProductDetailLayout() {
    serverDetailMode = false;

    const detailScreen = document.querySelector(
      "#product-detail"
    );

    if (!detailScreen) {
      return;
    }

    const heading = detailScreen.querySelector("h2");

    if (heading) {
      heading.textContent =
        heading.dataset.normalTitle ||
        "商品詳細画面";
    }

    const notice = detailScreen.querySelector(
      "#server-product-detail-notice"
    );

    if (notice) {
      notice.hidden = true;
    }

    const operationGuide = detailScreen.querySelector(
      "#server-product-detail-operation-guide"
    );

    if (operationGuide) {
      operationGuide.hidden = true;
    }

    const stockInSection = detailScreen.querySelector(
      "#server-product-stock-in"
    );

    if (stockInSection) {
      stockInSection.hidden = true;
    }

    const stockOutSection = detailScreen.querySelector(
      "#server-product-stock-out"
    );

    if (stockOutSection) {
      stockOutSection.hidden = true;
    }

    const historySection = detailScreen.querySelector(
      "#server-product-stock-history"
    );

    if (historySection) {
      historySection.hidden = true;
    }

    lastServerStockInMessage = "";
    lastServerStockOutMessage = "";

    [
      ".product-detail-action-group-main",
      "#product-detail-order-actions",
      "#product-detail-admin-actions"
    ].forEach(function (selector) {
      const element =
        detailScreen.querySelector(selector);

      if (element) {
        element.hidden = false;
      }
    });

    const backButton = document.querySelector(
      "#back-list-from-detail"
    );

    if (backButton) {
      backButton.textContent =
        "商品一覧へ戻る";
    }
  }

  function renderServerStockInSection(section) {
    if (!section) {
      return;
    }

    const data = lastServerProductData || {};
    const product = data.product || {};
    const stocks = Array.isArray(data.stocks)
      ? data.stocks
      : [];

    const internalCode = String(
      product.internal_code || lastServerRequestedCode || ""
    ).trim();

    const productName = String(
      product.product_name || "商品名未登録"
    );

    const productStatus = String(
      product.product_status || "通常商品"
    );

    const totalStock = toStockNumber(data.total_stock);
    const locationOptions = buildServerStockInLocationOptions(stocks);
    const isDiscontinued = productStatus === "廃盤";

    const statusHtml = lastServerStockInMessage
      ? `
          <div class="server-product-stock-in-status server-product-stock-in-success">
            ${escapeHtml(lastServerStockInMessage)}
          </div>
        `
      : "";

    const disabledNote = isDiscontinued
      ? `
          <div class="server-product-stock-in-status server-product-stock-in-error">
            廃盤の商品には入庫できません。
          </div>
        `
      : "";

    section.innerHTML = `
      <div class="server-product-stock-in-heading">
        <div>
          <span>共有在庫</span>
          <h3>入庫</h3>
        </div>
        <span class="server-product-stock-in-badge">v286 テスト</span>
      </div>

      <p class="server-product-stock-in-description">
        この操作は共有サーバーの在庫を実際に増やし、在庫履歴にも記録します。
        現在は架空商品で動作確認しています。
      </p>

      ${statusHtml}
      ${disabledNote}

      <form id="server-product-stock-in-form" class="server-product-stock-in-form">
        <div class="server-product-stock-in-summary">
          <span>${escapeHtml(productName)}</span>
          <strong>現在庫合計 ${formatNumber(totalStock)}個</strong>
        </div>

        <label>
          <span>入庫先の保管場所</span>
          <select id="server-product-stock-in-location" required ${isDiscontinued ? "disabled" : ""}>
            ${locationOptions}
          </select>
        </label>

        <label>
          <span>入庫数量</span>
          <input
            id="server-product-stock-in-quantity"
            type="number"
            min="1"
            max="1000000"
            step="1"
            value="1"
            inputmode="numeric"
            required
            ${isDiscontinued ? "disabled" : ""}
          >
        </label>

        <label>
          <span>理由</span>
          <select id="server-product-stock-in-reason" ${isDiscontinued ? "disabled" : ""}>
            <option value="仕入れ">仕入れ</option>
            <option value="返品">返品</option>
            <option value="棚卸調整">棚卸調整</option>
            <option value="移動">移動</option>
            <option value="その他">その他</option>
          </select>
        </label>

        <label class="server-product-stock-in-memo-label">
          <span>メモ（任意）</span>
          <textarea
            id="server-product-stock-in-memo"
            rows="2"
            maxlength="5000"
            placeholder="例：入荷伝票確認済み"
            ${isDiscontinued ? "disabled" : ""}
          ></textarea>
        </label>

        <button
          id="server-product-stock-in-submit"
          type="submit"
          ${isDiscontinued ? "disabled" : ""}
        >
          入庫内容を確認する
        </button>
      </form>
    `;

    const form = section.querySelector(
      "#server-product-stock-in-form"
    );

    if (form && !isDiscontinued) {
      form.addEventListener(
        "submit",
        function (event) {
          event.preventDefault();
          submitServerStockIn({
            section,
            internalCode,
            productName,
            totalStock
          });
        }
      );
    }
  }

  function buildServerStockInLocationOptions(stocks) {
    const values = [];

    stocks.forEach(function (stock) {
      const location = String(
        stock && stock.location_name
          ? stock.location_name
          : ""
      ).trim();

      if (location && !values.includes(location)) {
        values.push(location);
      }
    });

    ["本社", "酒本倉庫1階", "酒本倉庫2階"].forEach(function (location) {
      if (!values.includes(location)) {
        values.push(location);
      }
    });

    if (!values.length) {
      return '<option value="">保管場所を選択してください</option>';
    }

    return values.map(function (location) {
      const stock = stocks.find(function (row) {
        return String(row.location_name || "") === location;
      });

      const stockText = stock
        ? `（現在 ${formatNumber(stock.quantity)}個）`
        : "（現在 0個）";

      return `
        <option value="${escapeHtml(location)}">
          ${escapeHtml(location)} ${escapeHtml(stockText)}
        </option>
      `;
    }).join("");
  }

  async function submitServerStockIn(context) {
    const section = context && context.section
      ? context.section
      : document.querySelector("#server-product-stock-in");

    if (!section) {
      return;
    }

    const internalCode = String(
      context && context.internalCode
        ? context.internalCode
        : lastServerRequestedCode || ""
    ).trim();

    const productName = String(
      context && context.productName
        ? context.productName
        : "商品"
    );

    const totalStock = toStockNumber(
      context && context.totalStock
    );

    const locationInput = section.querySelector(
      "#server-product-stock-in-location"
    );
    const quantityInput = section.querySelector(
      "#server-product-stock-in-quantity"
    );
    const reasonInput = section.querySelector(
      "#server-product-stock-in-reason"
    );
    const memoInput = section.querySelector(
      "#server-product-stock-in-memo"
    );
    const submitButton = section.querySelector(
      "#server-product-stock-in-submit"
    );

    const locationName = locationInput
      ? locationInput.value.trim()
      : "";
    const quantity = quantityInput
      ? Math.trunc(Number(quantityInput.value))
      : 0;
    const reason = reasonInput
      ? reasonInput.value.trim()
      : "仕入れ";
    const memo = memoInput
      ? memoInput.value.trim()
      : "";

    if (!internalCode) {
      showServerStockInStatus(
        section,
        "社内コードを確認できません。",
        true
      );
      return;
    }

    if (!locationName) {
      showServerStockInStatus(
        section,
        "入庫先の保管場所を選択してください。",
        true
      );
      if (locationInput) locationInput.focus();
      return;
    }

    if (!Number.isFinite(quantity) || quantity <= 0) {
      showServerStockInStatus(
        section,
        "入庫数量は1以上で入力してください。",
        true
      );
      if (quantityInput) quantityInput.focus();
      return;
    }

    const session = getStoredSession();

    if (!session) {
      showServerStockInStatus(
        section,
        "サーバーログインが必要です。いったん商品一覧へ戻り、ログインし直してください。",
        true
      );
      return;
    }

    const afterStock = totalStock + quantity;
    const confirmMessage =
      `${productName}\n` +
      `${locationName} に ${formatNumber(quantity)}個 入庫します。\n` +
      `現在庫合計 ${formatNumber(totalStock)}個 → ${formatNumber(afterStock)}個\n\n` +
      "この内容で共有サーバーの在庫を更新しますか？";

    if (!window.confirm(confirmMessage)) {
      return;
    }

    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = "入庫を登録中...";
    }

    showServerStockInStatus(
      section,
      "共有サーバーへ入庫を登録しています。",
      false,
      true
    );

    try {
      const response = await fetch(
        SERVER_STOCK_IN_ENDPOINT,
        {
          method: "POST",
          mode: "cors",
          cache: "no-store",
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            Accept: "application/json",
            Authorization: "Bearer " + session.token
          },
          body: JSON.stringify({
            internal_code: internalCode,
            location_name: locationName,
            quantity,
            reason: reason || "仕入れ",
            memo
          })
        }
      );

      const result = await readJsonResponse(response);

      if (response.status === 401) {
        clearStoredSession();
        notifyServerAuthChanged("expired");
        throw new Error(
          "ログインの有効期限が切れました。もう一度ログインしてください。"
        );
      }

      if (!response.ok || !result || result.success !== true) {
        throw new Error(
          result && result.message
            ? result.message
            : "入庫の登録に失敗しました。"
        );
      }

      lastServerStockInMessage =
        `✓ 入庫しました。${result.location_name || locationName}：` +
        `${formatNumber(result.location_stock_before)}個 → ` +
        `${formatNumber(result.location_stock_after)}個 / ` +
        `合計 ${formatNumber(result.stock_after)}個`;

      const updatedData = await searchServerProductForApp(internalCode);
      openServerProductDetail(
        updatedData,
        internalCode
      );

      window.setTimeout(function () {
        const refreshedSection = document.querySelector(
          "#server-product-stock-in"
        );

        if (refreshedSection) {
          refreshedSection.scrollIntoView({
            behavior: "smooth",
            block: "center"
          });
        }
      }, 80);
    } catch (error) {
      showServerStockInStatus(
        section,
        getErrorMessage(
          error,
          "入庫の登録に失敗しました。"
        ),
        true
      );

      if (submitButton && document.body.contains(submitButton)) {
        submitButton.disabled = false;
        submitButton.textContent = "入庫内容を確認する";
      }
    }
  }

  function showServerStockInStatus(
    section,
    message,
    isError = false,
    isLoading = false
  ) {
    if (!section) {
      return;
    }

    let status = section.querySelector(
      "#server-product-stock-in-live-status"
    );

    if (!status) {
      status = document.createElement("div");
      status.id = "server-product-stock-in-live-status";

      const form = section.querySelector(
        "#server-product-stock-in-form"
      );

      if (form) {
        section.insertBefore(status, form);
      } else {
        section.appendChild(status);
      }
    }

    status.className =
      "server-product-stock-in-status " +
      (isError
        ? "server-product-stock-in-error"
        : isLoading
          ? "server-product-stock-in-loading"
          : "server-product-stock-in-success");

    status.textContent = String(message || "");
  }

  function renderServerStockOutSection(section) {
    if (!section) {
      return;
    }

    const data = lastServerProductData || {};
    const product = data.product || {};
    const stocks = Array.isArray(data.stocks)
      ? data.stocks
      : [];

    const internalCode = String(
      product.internal_code || lastServerRequestedCode || ""
    ).trim();

    const productName = String(
      product.product_name || "商品名未登録"
    );

    const totalStock = toStockNumber(data.total_stock);
    const availableStocks = stocks.filter(function (stock) {
      return toStockNumber(stock && stock.quantity) > 0;
    });
    const hasStock = totalStock > 0 && availableStocks.length > 0;
    const locationOptions = buildServerStockOutLocationOptions(availableStocks);

    const statusHtml = lastServerStockOutMessage
      ? `
          <div class="server-product-stock-out-status server-product-stock-out-success">
            ${escapeHtml(lastServerStockOutMessage)}
          </div>
        `
      : "";

    const disabledNote = !hasStock
      ? `
          <div class="server-product-stock-out-status server-product-stock-out-error">
            出庫できる在庫がありません。
          </div>
        `
      : "";

    section.innerHTML = `
      <div class="server-product-stock-out-heading">
        <div>
          <span>共有在庫</span>
          <h3>出庫</h3>
        </div>
        <span class="server-product-stock-out-badge">v286 テスト</span>
      </div>

      <p class="server-product-stock-out-description">
        この操作は共有サーバーの在庫を実際に減らし、在庫履歴にも記録します。
        選択した保管場所の在庫を超える数量は出庫できません。
      </p>

      ${statusHtml}
      ${disabledNote}

      <form id="server-product-stock-out-form" class="server-product-stock-out-form">
        <div class="server-product-stock-out-summary">
          <span>${escapeHtml(productName)}</span>
          <strong>現在庫合計 ${formatNumber(totalStock)}個</strong>
        </div>

        <label>
          <span>出庫元の保管場所</span>
          <select id="server-product-stock-out-location" required ${hasStock ? "" : "disabled"}>
            ${locationOptions}
          </select>
        </label>

        <label>
          <span>出庫数量</span>
          <input
            id="server-product-stock-out-quantity"
            type="number"
            min="1"
            max="1000000"
            step="1"
            value="1"
            inputmode="numeric"
            required
            ${hasStock ? "" : "disabled"}
          >
        </label>

        <label>
          <span>理由</span>
          <select id="server-product-stock-out-reason" ${hasStock ? "" : "disabled"}>
            <option value="販売">販売</option>
            <option value="出荷" selected>出荷</option>
            <option value="使用">使用</option>
            <option value="廃棄">廃棄</option>
            <option value="移動">移動</option>
            <option value="棚卸調整">棚卸調整</option>
            <option value="その他">その他</option>
          </select>
        </label>

        <label class="server-product-stock-out-memo-label">
          <span>メモ（任意）</span>
          <textarea
            id="server-product-stock-out-memo"
            rows="2"
            maxlength="5000"
            placeholder="例：出荷伝票確認済み"
            ${hasStock ? "" : "disabled"}
          ></textarea>
        </label>

        <button
          id="server-product-stock-out-submit"
          type="submit"
          ${hasStock ? "" : "disabled"}
        >
          出庫内容を確認する
        </button>
      </form>
    `;

    const form = section.querySelector(
      "#server-product-stock-out-form"
    );

    if (form && hasStock) {
      form.addEventListener(
        "submit",
        function (event) {
          event.preventDefault();
          submitServerStockOut({
            section,
            internalCode,
            productName,
            totalStock,
            stocks: availableStocks
          });
        }
      );
    }
  }

  function buildServerStockOutLocationOptions(stocks) {
    if (!Array.isArray(stocks) || !stocks.length) {
      return '<option value="">出庫できる在庫がありません</option>';
    }

    return stocks.map(function (stock) {
      const location = String(
        stock && stock.location_name
          ? stock.location_name
          : ""
      ).trim();
      const quantity = toStockNumber(stock && stock.quantity);

      return `
        <option value="${escapeHtml(location)}">
          ${escapeHtml(location)}（現在 ${formatNumber(quantity)}個）
        </option>
      `;
    }).join("");
  }

  async function submitServerStockOut(context) {
    const section = context && context.section
      ? context.section
      : document.querySelector("#server-product-stock-out");

    if (!section) {
      return;
    }

    const internalCode = String(
      context && context.internalCode
        ? context.internalCode
        : lastServerRequestedCode || ""
    ).trim();

    const productName = String(
      context && context.productName
        ? context.productName
        : "商品"
    );

    const totalStock = toStockNumber(
      context && context.totalStock
    );

    const stocks = context && Array.isArray(context.stocks)
      ? context.stocks
      : [];

    const locationInput = section.querySelector(
      "#server-product-stock-out-location"
    );
    const quantityInput = section.querySelector(
      "#server-product-stock-out-quantity"
    );
    const reasonInput = section.querySelector(
      "#server-product-stock-out-reason"
    );
    const memoInput = section.querySelector(
      "#server-product-stock-out-memo"
    );
    const submitButton = section.querySelector(
      "#server-product-stock-out-submit"
    );

    const locationName = locationInput
      ? locationInput.value.trim()
      : "";
    const quantity = quantityInput
      ? Math.trunc(Number(quantityInput.value))
      : 0;
    const reason = reasonInput
      ? reasonInput.value.trim()
      : "出荷";
    const memo = memoInput
      ? memoInput.value.trim()
      : "";

    const selectedStock = stocks.find(function (stock) {
      return String(stock && stock.location_name || "") === locationName;
    });
    const locationStock = toStockNumber(
      selectedStock && selectedStock.quantity
    );

    if (!internalCode) {
      showServerStockOutStatus(
        section,
        "社内コードを確認できません。",
        true
      );
      return;
    }

    if (!locationName) {
      showServerStockOutStatus(
        section,
        "出庫元の保管場所を選択してください。",
        true
      );
      if (locationInput) locationInput.focus();
      return;
    }

    if (!Number.isFinite(quantity) || quantity <= 0) {
      showServerStockOutStatus(
        section,
        "出庫数量は1以上で入力してください。",
        true
      );
      if (quantityInput) quantityInput.focus();
      return;
    }

    if (quantity > locationStock) {
      showServerStockOutStatus(
        section,
        `出庫数量が在庫数を超えています。${locationName}の現在庫は${formatNumber(locationStock)}個です。`,
        true
      );
      if (quantityInput) quantityInput.focus();
      return;
    }

    const session = getStoredSession();

    if (!session) {
      showServerStockOutStatus(
        section,
        "サーバーログインが必要です。いったん商品一覧へ戻り、ログインし直してください。",
        true
      );
      return;
    }

    const afterStock = Math.max(0, totalStock - quantity);
    const locationAfter = Math.max(0, locationStock - quantity);
    const confirmMessage =
      `${productName}\n` +
      `${locationName} から ${formatNumber(quantity)}個 出庫します。\n` +
      `${locationName} ${formatNumber(locationStock)}個 → ${formatNumber(locationAfter)}個\n` +
      `現在庫合計 ${formatNumber(totalStock)}個 → ${formatNumber(afterStock)}個\n\n` +
      "この内容で共有サーバーの在庫を更新しますか？";

    if (!window.confirm(confirmMessage)) {
      return;
    }

    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = "出庫を登録中...";
    }

    showServerStockOutStatus(
      section,
      "共有サーバーへ出庫を登録しています。",
      false,
      true
    );

    try {
      const response = await fetch(
        SERVER_STOCK_OUT_ENDPOINT,
        {
          method: "POST",
          mode: "cors",
          cache: "no-store",
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            Accept: "application/json",
            Authorization: "Bearer " + session.token
          },
          body: JSON.stringify({
            internal_code: internalCode,
            location_name: locationName,
            quantity,
            reason: reason || "出荷",
            memo
          })
        }
      );

      const result = await readJsonResponse(response);

      if (response.status === 401) {
        clearStoredSession();
        notifyServerAuthChanged("expired");
        throw new Error(
          "ログインの有効期限が切れました。もう一度ログインしてください。"
        );
      }

      if (!response.ok || !result || result.success !== true) {
        throw new Error(
          result && result.message
            ? result.message
            : "出庫の登録に失敗しました。"
        );
      }

      lastServerStockOutMessage =
        `✓ 出庫しました。${result.location_name || locationName}：` +
        `${formatNumber(result.location_stock_before)}個 → ` +
        `${formatNumber(result.location_stock_after)}個 / ` +
        `合計 ${formatNumber(result.stock_after)}個`;

      const updatedData = await searchServerProductForApp(internalCode);
      openServerProductDetail(
        updatedData,
        internalCode
      );

      window.setTimeout(function () {
        const refreshedSection = document.querySelector(
          "#server-product-stock-out"
        );

        if (refreshedSection) {
          refreshedSection.scrollIntoView({
            behavior: "smooth",
            block: "center"
          });
        }
      }, 80);
    } catch (error) {
      showServerStockOutStatus(
        section,
        getErrorMessage(
          error,
          "出庫の登録に失敗しました。"
        ),
        true
      );

      if (submitButton && document.body.contains(submitButton)) {
        submitButton.disabled = false;
        submitButton.textContent = "出庫内容を確認する";
      }
    }
  }

  function showServerStockOutStatus(
    section,
    message,
    isError = false,
    isLoading = false
  ) {
    if (!section) {
      return;
    }

    let status = section.querySelector(
      "#server-product-stock-out-live-status"
    );

    if (!status) {
      status = document.createElement("div");
      status.id = "server-product-stock-out-live-status";

      const form = section.querySelector(
        "#server-product-stock-out-form"
      );

      if (form) {
        section.insertBefore(status, form);
      } else {
        section.appendChild(status);
      }
    }

    status.className =
      "server-product-stock-out-status " +
      (isError
        ? "server-product-stock-out-error"
        : isLoading
          ? "server-product-stock-out-loading"
          : "server-product-stock-out-success");

    status.textContent = String(message || "");
  }

  async function loadServerStockHistory(internalCode) {
    const container = document.querySelector(
      "#server-product-stock-history-content"
    );

    if (!container) {
      return;
    }

    const code = String(internalCode || "").trim();

    if (!code) {
      container.innerHTML = `
        <div class="server-product-stock-history-message server-product-stock-history-error">
          社内コードを確認できないため、履歴を読み込めませんでした。
        </div>
      `;
      return;
    }

    const session = getStoredSession();

    if (!session) {
      container.innerHTML = `
        <div class="server-product-stock-history-message server-product-stock-history-error">
          在庫履歴を見るには、サーバーへログインしてください。
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="server-product-stock-history-message">
        在庫履歴を読み込んでいます。
      </div>
    `;

    try {
      const response = await fetch(
        SERVER_STOCK_HISTORY_ENDPOINT +
          "?code=" + encodeURIComponent(code) +
          "&limit=10",
        {
          method: "GET",
          mode: "cors",
          cache: "no-store",
          headers: {
            Accept: "application/json",
            Authorization: "Bearer " + session.token
          }
        }
      );

      const data = await readJsonResponse(response);

      if (response.status === 401) {
        clearStoredSession();
        notifyServerAuthChanged("expired");

        container.innerHTML = `
          <div class="server-product-stock-history-message server-product-stock-history-error">
            ログインの有効期限が切れました。もう一度ログインしてください。
          </div>
        `;
        return;
      }

      if (!response.ok || !data || data.success !== true) {
        throw new Error(
          data && data.message
            ? data.message
            : "在庫履歴の取得に失敗しました。"
        );
      }

      renderServerStockHistory(
        Array.isArray(data.items) ? data.items : []
      );
    } catch (error) {
      container.innerHTML = `
        <div class="server-product-stock-history-message server-product-stock-history-error">
          ${escapeHtml(
            getErrorMessage(
              error,
              "在庫履歴の読み込みに失敗しました。"
            )
          )}
        </div>
      `;
    }
  }

  function renderServerStockHistory(items) {
    const container = document.querySelector(
      "#server-product-stock-history-content"
    );

    if (!container) {
      return;
    }

    if (!items.length) {
      container.innerHTML = `
        <div class="server-product-stock-history-message">
          この商品の在庫履歴はまだありません。
        </div>
      `;
      return;
    }

    container.innerHTML = items.map(function (item) {
      const type = String(item.transaction_type || "在庫変更");
      const quantity = Number(item.quantity || 0);
      const before = Number(item.stock_before || 0);
      const after = Number(item.stock_after || 0);
      const quantityText = getHistoryQuantityText(type, quantity);
      const location = String(item.location_name || "未登録");
      const staff = String(item.staff_name || "未登録");
      const reason = String(item.reason || "未登録");
      const memo = String(item.memo || "").trim();

      return `
        <article class="server-product-stock-history-item">
          <div class="server-product-stock-history-item-top">
            <div>
              <span class="server-product-stock-history-date">
                ${escapeHtml(formatHistoryDate(item.occurred_at))}
              </span>
              <strong>${escapeHtml(type)}</strong>
            </div>
            <span class="server-product-stock-history-quantity">
              ${escapeHtml(quantityText)}
            </span>
          </div>
          <div class="server-product-stock-history-stock">
            在庫 ${formatNumber(before)}個 → <strong>${formatNumber(after)}個</strong>
          </div>
          <dl class="server-product-stock-history-meta">
            <div><dt>保管場所</dt><dd>${escapeHtml(location)}</dd></div>
            <div><dt>担当者</dt><dd>${escapeHtml(staff)}</dd></div>
            <div><dt>理由</dt><dd>${escapeHtml(reason)}</dd></div>
          </dl>
          ${memo ? `
            <p class="server-product-stock-history-memo">
              メモ：${escapeHtml(memo)}
            </p>
          ` : ""}
        </article>
      `;
    }).join("");
  }

  function getHistoryQuantityText(type, quantity) {
    const amount = Math.abs(Number.isFinite(quantity) ? quantity : 0);

    if (type.includes("出庫")) {
      return `-${formatNumber(amount)}個`;
    }

    if (amount === 0) {
      return "0個";
    }

    return `+${formatNumber(amount)}個`;
  }

  function formatHistoryDate(value) {
    const text = String(value || "").trim();

    if (!text) {
      return "日時未登録";
    }

    const match = text.match(
      /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/
    );

    if (!match) {
      return text;
    }

    return `${match[1]}/${match[2]}/${match[3]} ${match[4]}:${match[5]}`;
  }

  function setDetailText(selector, value) {
    const element = document.querySelector(selector);

    if (element) {
      element.textContent = String(value ?? "");
    }
  }

  function setDetailStatus(selector, status) {
    const element = document.querySelector(selector);

    if (!element) {
      return;
    }

    element.textContent = status;
    element.className = "";

    if (status === "廃盤") {
      element.classList.add(
        "detail-status-discontinued"
      );
    } else if (status === "在庫切れ") {
      element.classList.add("detail-status-out");
    } else if (status === "要補充") {
      element.classList.add("detail-status-low");
    } else {
      element.classList.add("detail-status-normal");
    }
  }

  function setServerLifecycleStatus(status) {
    const element = document.querySelector(
      "#detail-product-status"
    );

    if (!element) {
      return;
    }

    const normalized = String(
      status || "通常商品"
    );

    element.textContent = normalized;
    element.className =
      normalized === "廃盤"
        ? "detail-product-discontinued"
        : normalized === "廃盤予定"
          ? "detail-product-planned"
          : normalized === "専用商品"
            ? "detail-product-dedicated"
            : "detail-product-active";
  }

  function renderServerLocationStocks(stocks) {
    const container = document.querySelector(
      "#detail-location-stocks"
    );

    if (!container) {
      return;
    }

    container.innerHTML = "";

    if (!stocks.length) {
      container.textContent =
        "場所別在庫はありません。";
      return;
    }

    stocks.forEach(function (stock) {
      const line = document.createElement("div");
      line.textContent =
        `${stock.location_name || "未登録"}：` +
        `${formatNumber(stock.quantity)}個`;
      container.appendChild(line);
    });
  }

  function getServerPrimaryLocation(stocks) {
    if (!stocks.length) {
      return "未登録";
    }

    if (stocks.length === 1) {
      return stocks[0].location_name || "未登録";
    }

    return "複数保管場所";
  }

  function getServerStockStatus(
    product,
    totalStock,
    minStock
  ) {
    if (
      String(product.product_status || "") ===
      "廃盤"
    ) {
      return "廃盤";
    }

    if (totalStock <= 0) {
      return "在庫切れ";
    }

    if (
      minStock > 0 &&
      totalStock <= minStock
    ) {
      return "要補充";
    }

    return "通常";
  }

  function toStockNumber(value) {
    const number = Number(value);

    if (!Number.isFinite(number)) {
      return 0;
    }

    return Math.max(0, Math.trunc(number));
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

  function storeSession(session) {
    try {
      sessionStorage.setItem(
        TOKEN_STORAGE_KEY,
        session.token
      );

      sessionStorage.setItem(
        EXPIRES_STORAGE_KEY,
        String(session.expiresAt)
      );

      sessionStorage.setItem(
        USER_STORAGE_KEY,
        JSON.stringify(session.user || {})
      );
    } catch (error) {
      clearStoredSession();
      throw new Error(
        "ブラウザーにログイン情報を保持できませんでした。"
      );
    }
  }

  function getStoredSession() {
    try {
      const token = sessionStorage.getItem(
        TOKEN_STORAGE_KEY
      );

      const expiresAt = Number(
        sessionStorage.getItem(
          EXPIRES_STORAGE_KEY
        )
      );

      if (
        !token ||
        !Number.isFinite(expiresAt) ||
        Date.now() >= expiresAt
      ) {
        clearStoredSession();
        return null;
      }

      let user = {};

      const userText = sessionStorage.getItem(
        USER_STORAGE_KEY
      );

      if (userText) {
        try {
          user = JSON.parse(userText);
        } catch (error) {
          user = {};
        }
      }

      return {
        token,
        expiresAt,
        user
      };
    } catch (error) {
      clearStoredSession();
      return null;
    }
  }

  function clearStoredSession() {
    try {
      sessionStorage.removeItem(TOKEN_STORAGE_KEY);
      sessionStorage.removeItem(EXPIRES_STORAGE_KEY);
      sessionStorage.removeItem(USER_STORAGE_KEY);
    } catch (error) {
      // sessionStorageが利用できない場合も画面操作は継続する。
    }
  }

  function getErrorMessage(error, fallback) {
    return error && error.message
      ? error.message
      : fallback;
  }

  function notifyServerAuthChanged(reason) {
    try {
      window.dispatchEvent(
        new CustomEvent("inventory-server-auth-changed", {
          detail: {
            reason: String(reason || "changed"),
            loggedIn: hasServerSession()
          }
        })
      );
    } catch (error) {
      // 通知できない環境でもログイン処理自体は継続する。
    }
  }

  function formatNumber(value) {
    const number = Number(value);

    if (!Number.isFinite(number)) {
      return "0";
    }

    return number.toLocaleString("ja-JP");
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function hasServerSession() {
    return Boolean(getStoredSession());
  }

  async function searchServerProductForApp(internalCode) {
    const code = String(internalCode || "").trim();

    if (!code) {
      const error = new Error("社内コードを入力してください。");
      error.code = "SERVER_CODE_REQUIRED";
      throw error;
    }

    const session = getStoredSession();

    if (!session) {
      const error = new Error("サーバーログインが必要です。");
      error.code = "SERVER_LOGIN_REQUIRED";
      throw error;
    }

    const response = await fetch(
      SERVER_PRODUCT_ENDPOINT +
        "?code=" +
        encodeURIComponent(code),
      {
        method: "GET",
        mode: "cors",
        cache: "no-store",
        headers: {
          Accept: "application/json",
          Authorization: "Bearer " + session.token
        }
      }
    );

    const data = await readJsonResponse(response);

    if (response.status === 401) {
      clearStoredSession();
      notifyServerAuthChanged("expired");

      const error = new Error(
        "ログインの有効期限が切れました。もう一度ログインしてください。"
      );
      error.code = "SERVER_LOGIN_REQUIRED";
      error.status = 401;
      throw error;
    }

    if (!response.ok || !data || data.success !== true) {
      const error = new Error(
        data && data.message
          ? data.message
          : "商品データの取得に失敗しました。"
      );
      error.code = response.status === 404
        ? "SERVER_PRODUCT_NOT_FOUND"
        : "SERVER_PRODUCT_ERROR";
      error.status = response.status;
      throw error;
    }

    lastServerProductData = data;
    lastServerRequestedCode = code;

    return data;
  }

  function openServerLoginForCode(internalCode) {
    const code = String(internalCode || "").trim();

    if (code) {
      lastServerRequestedCode = code;
    }

    openDialog();
  }

  function openServerProductDetailForApp(data, internalCode, options) {
    serverDetailReturnTarget =
      options && options.returnTarget === "server-list"
        ? "server-list"
        : "server-search";

    openServerProductDetail(
      data,
      internalCode
    );
  }

  window.inventoryServerSearch = {
    hasSession: hasServerSession,
    searchProduct: searchServerProductForApp,
    openLogin: openServerLoginForCode,
    openProductDetail: openServerProductDetailForApp
  };

  function createStyles() {
    if (document.querySelector("#server-auth-style")) {
      return;
    }

    const style = document.createElement("style");
    style.id = "server-auth-style";
    style.textContent = `
      body.server-auth-dialog-open {
        overflow: hidden;
      }

      .server-auth-overlay {
        position: fixed;
        inset: 0;
        z-index: 100000;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 18px;
        background: rgba(15, 33, 48, 0.62);
      }

      .server-auth-overlay[hidden] {
        display: none !important;
      }

      .server-auth-card {
        width: min(700px, 100%);
        max-height: min(820px, calc(100vh - 36px));
        overflow: auto;
        padding: 24px;
        border: 2px solid #1565c0;
        border-radius: 18px;
        background: #ffffff;
        box-shadow: 0 18px 45px rgba(0, 0, 0, 0.24);
      }

      .server-auth-heading {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 16px;
        padding-bottom: 14px;
        border-bottom: 1px solid #cfe0ef;
      }

      .server-auth-kicker {
        display: block;
        margin-bottom: 4px;
        color: #1565c0;
        font-size: 13px;
        font-weight: 700;
      }

      .server-auth-heading h2 {
        margin: 0;
        color: #123a5a;
        font-size: 24px;
      }

      .server-auth-close-button,
      .server-auth-secondary-button {
        background: #546e7a !important;
      }

      .server-auth-close-button {
        flex: 0 0 auto;
        min-width: 92px;
        padding-left: 16px;
        padding-right: 16px;
        white-space: nowrap;
      }

      .server-auth-description {
        margin: 16px 0;
        color: #536b7d;
        line-height: 1.7;
      }

      .server-auth-content {
        display: grid;
        gap: 16px;
      }

      .server-auth-status {
        display: grid;
        gap: 5px;
        padding: 16px;
        border-radius: 12px;
      }

      .server-auth-status strong {
        font-size: 19px;
      }

      .server-auth-info,
      .server-auth-loading {
        border: 1px solid #90caf9;
        background: #eaf5ff;
        color: #0d5da8;
      }

      .server-auth-success {
        border: 1px solid #81c784;
        background: #eefaf0;
        color: #1b6e2e;
      }

      .server-auth-error {
        border: 1px solid #ef9a9a;
        background: #fff0f0;
        color: #b42318;
      }

      .server-auth-login-form {
        display: grid;
        gap: 14px;
        padding: 18px;
        border: 1px solid #d7e2eb;
        border-radius: 12px;
        background: #fafcfe;
      }

      .server-auth-login-form label {
        display: grid;
        gap: 7px;
        color: #173b58;
        font-weight: 700;
      }

      .server-auth-login-form input {
        width: 100%;
        min-height: 48px;
        padding: 10px 12px;
        border: 1px solid #aebfcd;
        border-radius: 9px;
        background: #ffffff;
        color: #173b58;
        font: inherit;
        font-weight: 400;
      }

      .server-auth-login-form input:focus {
        outline: 3px solid rgba(21, 101, 192, 0.18);
        border-color: #1565c0;
      }

      .server-auth-primary-button {
        background: #1565c0 !important;
      }

      .server-auth-session-actions {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px;
      }

      .server-auth-product-search-form {
        display: grid;
        gap: 9px;
        padding: 16px;
        border: 1px solid #d7e2eb;
        border-radius: 12px;
        background: #fafcfe;
      }

      .server-auth-product-search-form label {
        color: #173b58;
        font-weight: 700;
      }

      .server-auth-product-search-row {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 10px;
      }

      .server-auth-product-search-row input {
        width: 100%;
        min-height: 48px;
        padding: 10px 12px;
        border: 1px solid #aebfcd;
        border-radius: 9px;
        background: #ffffff;
        color: #173b58;
        font: inherit;
      }

      .server-auth-product-search-row input:focus {
        outline: 3px solid rgba(21, 101, 192, 0.18);
        border-color: #1565c0;
      }

      .server-auth-search-guide {
        color: #60788b;
        font-size: 13px;
        line-height: 1.6;
      }

      .server-auth-logout-wide {
        width: 100%;
      }

      .server-auth-product-result {
        display: grid;
        gap: 16px;
      }

      .server-auth-product {
        padding: 16px;
        border: 1px solid #d7e2eb;
        border-radius: 12px;
        background: #fafcfe;
      }

      .server-auth-product-label {
        display: block;
        margin-bottom: 4px;
        color: #60788b;
        font-size: 13px;
      }

      .server-auth-product-name {
        display: block;
        color: #173b58;
        font-size: 22px;
      }

      .server-auth-code-row {
        display: flex;
        flex-wrap: wrap;
        gap: 6px 18px;
        margin-top: 10px;
        color: #60788b;
        font-size: 14px;
      }

      .server-auth-total-stock {
        display: grid;
        gap: 4px;
        padding: 18px;
        border: 2px solid #2e8b3c;
        border-radius: 12px;
        background: #effcf2;
        text-align: center;
      }

      .server-auth-total-stock span {
        color: #557164;
      }

      .server-auth-total-stock strong {
        color: #1f7b31;
        font-size: 36px;
      }

      .server-auth-stock-list h3 {
        margin: 0 0 10px;
        color: #173b58;
        font-size: 18px;
      }

      .server-auth-stock-row {
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

      .server-auth-stock-row strong {
        color: #1565c0;
        font-size: 19px;
      }

      .server-auth-empty-stock {
        padding: 14px;
        border-radius: 10px;
        background: #f4f7f9;
        color: #60788b;
      }

      .server-auth-open-detail-button {
        width: 100%;
        margin-top: 2px;
      }

      .server-auth-readonly-note {
        margin: 0;
        color: #60788b;
        font-size: 13px;
        line-height: 1.7;
      }

      .server-product-detail-notice {
        display: grid;
        gap: 6px;
        margin: 0 0 16px;
        padding: 14px 16px;
        border: 2px solid #1976d2;
        border-radius: 12px;
        background: #eaf4ff;
        color: #0d477a;
      }

      .server-product-detail-notice strong {
        font-size: 18px;
      }

      .server-product-detail-notice span {
        line-height: 1.6;
      }

      .server-product-detail-operation-guide {
        display: grid;
        gap: 10px;
        margin: 16px 0;
        padding: 16px;
        border: 1px solid #cbdde9;
        border-radius: 12px;
        background: #f8fbfd;
      }

      .server-product-detail-operation-heading {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        flex-wrap: wrap;
      }

      .server-product-detail-operation-heading strong {
        color: #173b58;
        font-size: 18px;
      }

      .server-product-detail-operation-heading span {
        padding: 5px 9px;
        border-radius: 999px;
        background: #eaf4ff;
        color: #1565c0;
        font-size: 12px;
        font-weight: 700;
      }

      .server-product-detail-operation-row {
        display: grid;
        gap: 4px;
        padding: 12px 14px;
        border-radius: 10px;
      }

      .server-product-detail-operation-row span {
        font-size: 12px;
        font-weight: 700;
      }

      .server-product-detail-operation-row strong {
        color: #173b58;
        line-height: 1.5;
      }

      .server-product-detail-operation-ready {
        background: #eef9f0;
      }

      .server-product-detail-operation-ready span {
        color: #1f7b31;
      }

      .server-product-detail-operation-next {
        background: #fff7e8;
      }

      .server-product-detail-operation-next span {
        color: #a55d00;
      }

      .server-product-stock-in {
        display: grid;
        gap: 12px;
        margin: 16px 0;
        padding: 16px;
        border: 2px solid #43a047;
        border-radius: 12px;
        background: #f7fcf8;
      }

      .server-product-stock-in-heading {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        flex-wrap: wrap;
      }

      .server-product-stock-in-heading > div {
        display: grid;
        gap: 2px;
      }

      .server-product-stock-in-heading > div > span {
        color: #2e7d32;
        font-size: 12px;
        font-weight: 700;
      }

      .server-product-stock-in-heading h3 {
        margin: 0;
        color: #173b58;
        font-size: 20px;
      }

      .server-product-stock-in-badge {
        padding: 5px 9px;
        border-radius: 999px;
        background: #e8f5e9;
        color: #2e7d32;
        font-size: 12px;
        font-weight: 700;
      }

      .server-product-stock-in-description {
        margin: 0;
        color: #526b7c;
        line-height: 1.7;
      }

      .server-product-stock-in-status {
        padding: 12px 14px;
        border-radius: 10px;
        line-height: 1.6;
        font-weight: 700;
      }

      .server-product-stock-in-success {
        border: 1px solid #81c784;
        background: #eefaf0;
        color: #1b6e2e;
      }

      .server-product-stock-in-error {
        border: 1px solid #ef9a9a;
        background: #fff0f0;
        color: #b42318;
      }

      .server-product-stock-in-loading {
        border: 1px solid #90caf9;
        background: #eaf5ff;
        color: #0d5da8;
      }

      .server-product-stock-in-form {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 12px;
      }

      .server-product-stock-in-summary {
        grid-column: 1 / -1;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        flex-wrap: wrap;
        padding: 12px 14px;
        border-radius: 10px;
        background: #ffffff;
        color: #173b58;
      }

      .server-product-stock-in-summary strong {
        color: #2e7d32;
        font-size: 18px;
      }

      .server-product-stock-in-form label {
        display: grid;
        gap: 6px;
        color: #173b58;
        font-weight: 700;
      }

      .server-product-stock-in-form select,
      .server-product-stock-in-form input,
      .server-product-stock-in-form textarea {
        width: 100%;
        min-height: 46px;
        padding: 10px 12px;
        border: 1px solid #aebfcd;
        border-radius: 9px;
        background: #ffffff;
        color: #173b58;
        font: inherit;
        font-weight: 400;
        box-sizing: border-box;
      }

      .server-product-stock-in-form textarea {
        min-height: 76px;
        resize: vertical;
      }

      .server-product-stock-in-memo-label {
        grid-column: 1 / -1;
      }

      .server-product-stock-in-form button {
        grid-column: 1 / -1;
        min-height: 48px;
        background: #2e7d32 !important;
      }

      .server-product-stock-in-form button:disabled,
      .server-product-stock-in-form input:disabled,
      .server-product-stock-in-form select:disabled,
      .server-product-stock-in-form textarea:disabled {
        opacity: 0.62;
        cursor: not-allowed;
      }

      .server-product-stock-out {
        display: grid;
        gap: 12px;
        margin: 16px 0;
        padding: 16px;
        border: 2px solid #c62828;
        border-radius: 12px;
        background: #fff8f8;
      }

      .server-product-stock-out-heading {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        flex-wrap: wrap;
      }

      .server-product-stock-out-heading > div {
        display: grid;
        gap: 2px;
      }

      .server-product-stock-out-heading > div > span {
        color: #c62828;
        font-size: 12px;
        font-weight: 700;
      }

      .server-product-stock-out-heading h3 {
        margin: 0;
        color: #173b58;
        font-size: 20px;
      }

      .server-product-stock-out-badge {
        padding: 5px 9px;
        border-radius: 999px;
        background: #ffebee;
        color: #c62828;
        font-size: 12px;
        font-weight: 700;
      }

      .server-product-stock-out-description {
        margin: 0;
        color: #526b7c;
        line-height: 1.7;
      }

      .server-product-stock-out-status {
        padding: 12px 14px;
        border-radius: 10px;
        line-height: 1.6;
        font-weight: 700;
      }

      .server-product-stock-out-success {
        border: 1px solid #ef9a9a;
        background: #fff0f0;
        color: #9f1f1f;
      }

      .server-product-stock-out-error {
        border: 1px solid #ef9a9a;
        background: #fff0f0;
        color: #b42318;
      }

      .server-product-stock-out-loading {
        border: 1px solid #90caf9;
        background: #eaf5ff;
        color: #0d5da8;
      }

      .server-product-stock-out-form {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 12px;
      }

      .server-product-stock-out-summary {
        grid-column: 1 / -1;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        flex-wrap: wrap;
        padding: 12px 14px;
        border-radius: 10px;
        background: #ffffff;
        color: #173b58;
      }

      .server-product-stock-out-summary strong {
        color: #c62828;
        font-size: 18px;
      }

      .server-product-stock-out-form label {
        display: grid;
        gap: 6px;
        color: #173b58;
        font-weight: 700;
      }

      .server-product-stock-out-form select,
      .server-product-stock-out-form input,
      .server-product-stock-out-form textarea {
        width: 100%;
        min-height: 46px;
        padding: 10px 12px;
        border: 1px solid #aebfcd;
        border-radius: 9px;
        background: #ffffff;
        color: #173b58;
        font: inherit;
        font-weight: 400;
        box-sizing: border-box;
      }

      .server-product-stock-out-form textarea {
        min-height: 76px;
        resize: vertical;
      }

      .server-product-stock-out-memo-label {
        grid-column: 1 / -1;
      }

      .server-product-stock-out-form button {
        grid-column: 1 / -1;
        min-height: 48px;
        background: #c62828 !important;
      }

      .server-product-stock-out-form button:disabled,
      .server-product-stock-out-form input:disabled,
      .server-product-stock-out-form select:disabled,
      .server-product-stock-out-form textarea:disabled {
        opacity: 0.62;
        cursor: not-allowed;
      }

      .server-product-stock-history {
        display: grid;
        gap: 12px;
        margin: 16px 0;
        padding: 16px;
        border: 1px solid #cbdde9;
        border-radius: 12px;
        background: #ffffff;
      }

      .server-product-stock-history-heading {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        flex-wrap: wrap;
      }

      .server-product-stock-history-heading > div {
        display: grid;
        gap: 2px;
      }

      .server-product-stock-history-heading > div > span {
        color: #1565c0;
        font-size: 12px;
        font-weight: 700;
      }

      .server-product-stock-history-heading h3 {
        margin: 0;
        color: #173b58;
        font-size: 19px;
      }

      .server-product-stock-history-badge {
        padding: 5px 9px;
        border-radius: 999px;
        background: #eef9f0;
        color: #1f7b31;
        font-size: 12px;
        font-weight: 700;
      }

      .server-product-stock-history-content {
        display: grid;
        gap: 10px;
      }

      .server-product-stock-history-message {
        padding: 14px;
        border-radius: 10px;
        background: #f4f7f9;
        color: #60788b;
        line-height: 1.7;
      }

      .server-product-stock-history-error {
        background: #fff1f1;
        color: #a33131;
      }

      .server-product-stock-history-item {
        display: grid;
        gap: 10px;
        padding: 14px;
        border: 1px solid #d7e2eb;
        border-radius: 10px;
        background: #fafcfe;
      }

      .server-product-stock-history-item-top {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 12px;
      }

      .server-product-stock-history-item-top > div {
        display: grid;
        gap: 3px;
      }

      .server-product-stock-history-item-top strong {
        color: #173b58;
        font-size: 17px;
      }

      .server-product-stock-history-date {
        color: #60788b;
        font-size: 12px;
      }

      .server-product-stock-history-quantity {
        color: #1565c0;
        font-size: 18px;
        font-weight: 800;
        white-space: nowrap;
      }

      .server-product-stock-history-stock {
        padding: 9px 11px;
        border-radius: 8px;
        background: #eef4f8;
        color: #355469;
      }

      .server-product-stock-history-meta {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 8px;
        margin: 0;
      }

      .server-product-stock-history-meta > div {
        display: grid;
        gap: 2px;
        min-width: 0;
      }

      .server-product-stock-history-meta dt {
        color: #60788b;
        font-size: 11px;
      }

      .server-product-stock-history-meta dd {
        margin: 0;
        color: #173b58;
        overflow-wrap: anywhere;
      }

      .server-product-stock-history-memo {
        margin: 0;
        color: #60788b;
        line-height: 1.6;
      }

      .server-auth-note,
      .server-auth-endpoint-note {
        margin: 0;
        color: #60788b;
        font-size: 13px;
        line-height: 1.7;
      }

      @media (max-width: 600px) {
        .server-auth-overlay {
          padding: 10px;
        }

        .server-auth-card {
          max-height: calc(100vh - 20px);
          padding: 18px;
        }

        .server-auth-heading h2 {
          font-size: 22px;
        }

        .server-auth-session-actions {
          grid-template-columns: 1fr;
        }

        .server-auth-product-search-row {
          grid-template-columns: 1fr;
        }

        .server-auth-close-button,
        .server-auth-primary-button,
        .server-auth-secondary-button {
          min-height: 52px;
          font-size: 17px;
        }

        .server-product-stock-history-meta {
          grid-template-columns: 1fr;
        }

        .server-product-stock-in-form {
          grid-template-columns: 1fr;
        }

        .server-product-stock-in-summary,
        .server-product-stock-out-summary {
          align-items: flex-start;
          flex-direction: column;
        }

        .server-product-stock-out-form {
          grid-template-columns: 1fr;
        }
      }
    `;

    document.head.appendChild(style);
  }
})();
