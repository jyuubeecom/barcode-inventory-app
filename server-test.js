"use strict";

(function () {
  const SERVER_LOGIN_ENDPOINT =
    "https://jyuubee.sakura.ne.jp/inventory/login.php";

  const SERVER_PRODUCT_ENDPOINT =
    "https://jyuubee.sakura.ne.jp/inventory/get-product-auth.php";

  const SERVER_STOCK_HISTORY_ENDPOINT =
    "https://jyuubee.sakura.ne.jp/inventory/get-stock-history-auth.php";

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
        ※ 現在は閲覧専用です。次の段階で、入庫・出庫などの共有操作を追加していきます。
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
        "現在は閲覧専用です。";

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
          <strong>商品情報・在庫数・保管場所・最近の在庫履歴の確認</strong>
        </div>
        <div class="server-product-detail-operation-row server-product-detail-operation-next">
          <span>次の段階で追加予定</span>
          <strong>入庫・出庫・商品編集</strong>
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

      operationGuide.insertAdjacentElement(
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

    const historySection = detailScreen.querySelector(
      "#server-product-stock-history"
    );

    if (historySection) {
      historySection.hidden = true;
    }

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
      }
    `;

    document.head.appendChild(style);
  }
})();
