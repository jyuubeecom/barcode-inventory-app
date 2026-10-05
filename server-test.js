"use strict";

(function () {
  const SERVER_LOGIN_ENDPOINT =
    "https://jyuubee.sakura.ne.jp/inventory/login.php";

  const SERVER_PRODUCT_ENDPOINT =
    "https://jyuubee.sakura.ne.jp/inventory/get-product-auth.php";

  const DEFAULT_TEST_INTERNAL_CODE = "TEST001";

  const TOKEN_STORAGE_KEY =
    "barcodeInventoryServerAccessToken";

  const EXPIRES_STORAGE_KEY =
    "barcodeInventoryServerAccessExpiresAt";

  const USER_STORAGE_KEY =
    "barcodeInventoryServerUser";

  let overlay = null;
  let content = null;

  document.addEventListener(
    "DOMContentLoaded",
    initializeServerAuthTest
  );

  function initializeServerAuthTest() {
    createStyles();

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
          "サーバーログイン・接続確認"
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
            <h2 id="server-auth-title">サーバーログイン・接続確認</h2>
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
            value="${DEFAULT_TEST_INTERNAL_CODE}"
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

      <p class="server-auth-endpoint-note">
        保護された接続先：get-product-auth.php / ${escapeHtml(requestedCode)}
      </p>
    `;
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
      }
    `;

    document.head.appendChild(style);
  }
})();
