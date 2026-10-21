"use strict";

// v292.2: 共有サーバー管理者本人のログインID・パスワード変更画面。
// 既存ログイン処理を共用。パスワードはブラウザーに保存しない。
(function () {
  const ENDPOINT = "https://jyuubee.sakura.ne.jp/inventory/change-admin-credentials-auth.php";
  const USERNAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{2,49}$/;
  let screen = null;
  let form = null;
  let status = null;
  let busy = false;

  document.addEventListener("DOMContentLoaded", initialize);

  function initialize() {
    const opener = document.getElementById("server-admin-credentials-button");
    const main = document.querySelector("main");
    if (!opener || !main) return;

    installStyle();
    screen = document.createElement("section");
    screen.id = "server-admin-credentials-screen";
    screen.hidden = true;
    screen.innerHTML = `
      <div class="server-credentials-panel">
        <h2>管理者ログインID・パスワード変更</h2>
        <p>共有サーバーの管理者アカウントを変更します。商品や在庫のデータは変更しません。</p>
        <div id="server-credentials-session" class="server-credentials-notice" role="status" aria-live="polite"></div>
        <button id="server-credentials-login" type="button">サーバーにログインする</button>

        <form id="server-credentials-form" autocomplete="off" hidden>
          <label for="server-credentials-username">新しいログインID（必須）</label>
          <input id="server-credentials-username" type="text" maxlength="50"
                 autocomplete="off" autocapitalize="none" spellcheck="false" required>
          <small>英数字で始まる3～50文字。英数字と「. _ -」を使用できます。変更しない場合はそのままにしてください。</small>

          <label for="server-credentials-current-password">現在のパスワード（必須）</label>
          <input id="server-credentials-current-password" type="password"
                 maxlength="200" autocomplete="current-password" required>

          <label for="server-credentials-new-password">新しいパスワード（変更する場合のみ）</label>
          <input id="server-credentials-new-password" type="password"
                 maxlength="72" autocomplete="new-password">
          <small>8文字以上・72バイト以内。安全のため英数字・記号を組み合わせた12文字以上をおすすめします。ログインIDだけ変更する場合は空欄で大丈夫です。</small>

          <label for="server-credentials-confirm-password">新しいパスワード（確認）</label>
          <input id="server-credentials-confirm-password" type="password"
                 maxlength="72" autocomplete="new-password">

          <p class="server-credentials-warning">変更に成功すると、PC・スマホを含むすべての端末で再ログインが必要になります。新しいログインIDとパスワードはパスワード管理アプリなどに控えてください。チャットには送らないでください。</p>
          <button id="server-credentials-submit" class="server-credentials-submit" type="submit">ログイン情報の変更を確認する</button>
        </form>

        <div id="server-credentials-result" role="status" aria-live="polite" hidden></div>
        <button id="server-credentials-back" class="server-credentials-back" type="button">ホームへ戻る</button>
      </div>
    `;
    main.appendChild(screen);
    form = screen.querySelector("#server-credentials-form");
    status = screen.querySelector("#server-credentials-session");

    opener.addEventListener("click", openScreen);
    form.addEventListener("submit", submitChange);
    screen.querySelector("#server-credentials-back").addEventListener("click", goHome);
    screen.querySelector("#server-credentials-login").addEventListener("click", function () {
      window.inventoryServerSearch?.openLogin?.("");
    });
    window.addEventListener("inventory-server-auth-changed", function () {
      if (screen && !screen.hidden && !busy) {
        clearSecrets();
        syncSession();
      }
    });
  }

  function installStyle() {
    if (document.getElementById("server-credentials-style")) return;
    const style = document.createElement("style");
    style.id = "server-credentials-style";
    style.textContent = `
      #server-admin-credentials-button { background:#455a64; color:white; }
      #server-admin-credentials-screen { max-width:760px; margin:0 auto; padding:12px; }
      .server-credentials-panel { padding:clamp(15px, 3vw, 28px); background:#fff; border:1px solid #cfd8dc; border-radius:14px; color:#263238; }
      .server-credentials-panel h2 { margin-top:0; line-height:1.5; }
      .server-credentials-panel form { margin-top:20px; }
      .server-credentials-panel form label { display:block; font-weight:700; margin:18px 0 7px; }
      .server-credentials-panel form input { display:block; box-sizing:border-box; width:100%; min-height:48px; padding:11px 13px; border:2px solid #b0bec5; border-radius:8px; font-size:17px; }
      .server-credentials-panel form input:focus { border-color:#1565c0; outline:2px solid #90caf9; }
      .server-credentials-panel form small { display:block; margin:7px 0 0; color:#455a64; line-height:1.6; }
      .server-credentials-panel button { display:block; width:100%; min-height:48px; margin:13px 0; padding:10px; border:0; border-radius:9px; font-size:16px; font-weight:700; cursor:pointer; }
      #server-credentials-login { background:#1565c0; color:#fff; }
      .server-credentials-submit { background:#2e7d32; color:#fff; }
      .server-credentials-back { background:#546e7a; color:#fff; }
      .server-credentials-panel button:disabled { opacity:.55; cursor:wait; }
      .server-credentials-warning { background:#fff8e1; padding:12px; border-radius:8px; color:#795548; line-height:1.7; }
      .server-credentials-notice { background:#e3f2fd; padding:14px; border-radius:9px; line-height:1.7; }
      .server-credentials-notice.error { background:#ffebee; color:#b71c1c; }
      .server-credentials-notice.success { background:#e8f5e9; color:#1b5e20; }
      #server-credentials-result { padding:13px; border-radius:9px; background:#e8f5e9; color:#1b5e20; line-height:1.8; margin:15px 0; }
    `;
    document.head.appendChild(style);
  }

  function getAdminSession() {
    const session = window.inventoryServerSearch?.getSession?.();
    return session?.token && session?.user?.role === "admin" ? session : null;
  }

  async function openScreen() {
    if (busy) return;
    const permissions = window.inventoryPermissions;
    if (permissions?.requireAdmin) {
      if (!(await permissions.requireAdmin("管理者ログイン情報の変更"))) return;
    } else if (permissions?.isAdmin && !permissions.isAdmin()) {
      window.alert("管理者モードに切り替えてください。");
      return;
    }
    document.querySelectorAll("main > section").forEach(function (section) {
      section.hidden = true;
    });
    screen.hidden = false;
    clearSecrets();
    screen.querySelector("#server-credentials-result").hidden = true;
    syncSession();
    screen.scrollIntoView({block:"start"});
  }

  function clearSecrets() {
    if (!form) return;
    for (const id of ["current-password", "new-password", "confirm-password"]) {
      const field = screen.querySelector("#server-credentials-" + id);
      if (field) field.value = "";
    }
  }

  function syncSession() {
    if (!screen || screen.hidden) return;
    const session = getAdminSession();
    const login = screen.querySelector("#server-credentials-login");
    const username = screen.querySelector("#server-credentials-username");
    if (!session) {
      form.hidden = true;
      login.hidden = false;
      status.textContent = "共有サーバーへ管理者としてログインしてください。";
      status.className = "server-credentials-notice";
      username.value = "";
      return;
    }
    form.hidden = false;
    login.hidden = true;
    username.value = String(session.user.username || "");
    status.textContent = "管理者ログイン済み：" + String(session.user.display_name || session.user.username || "管理者") + "。ログインIDまたはパスワードを変更できます。";
    status.className = "server-credentials-notice";
  }

  function goHome() {
    if (busy) {
      window.alert("変更処理中です。結果が出るまでお待ちください。");
      return;
    }
    clearSecrets();
    screen.hidden = true;
    if (window.inventoryApp?.showScreen) {
      window.inventoryApp.showScreen("home");
    } else {
      const home = document.getElementById("home");
      if (home) home.hidden = false;
    }
    window.scrollTo({top:0,behavior:"smooth"});
  }

  async function submitChange(event) {
    event.preventDefault();
    if (busy) return;
    const session = getAdminSession();
    if (!session) {
      syncSession();
      window.alert("管理者としてサーバーに再ログインしてください。");
      return;
    }
    const username = screen.querySelector("#server-credentials-username").value.trim();
    const current = screen.querySelector("#server-credentials-current-password").value;
    const password = screen.querySelector("#server-credentials-new-password").value;
    const confirmPassword = screen.querySelector("#server-credentials-confirm-password").value;
    if (!USERNAME_PATTERN.test(username)) {
      window.alert("ログインIDは英数字で始まる3～50文字（英数字・._-）にしてください。");
      return;
    }
    if (!current) {
      window.alert("現在のパスワードを入力してください。");
      return;
    }
    if (password) {
      const characterCount = Array.from(password).length;
      const byteCount = new TextEncoder().encode(password).length;
      if (characterCount < 8) {
        window.alert("新しいパスワードは8文字以上で入力してください。");
        return;
      }
      if (byteCount > 72) {
        window.alert("新しいパスワードは72バイト以内で入力してください。");
        return;
      }
      if (password !== confirmPassword) {
        window.alert("新しいパスワードと確認入力が一致しません。");
        return;
      }
    } else if (confirmPassword) {
      window.alert("新しいパスワードも入力してください。");
      return;
    }
    if (username === String(session.user.username || "") && !password) {
      window.alert("変更したいログインID、または新しいパスワードを入力してください。");
      return;
    }

    const description = [
      "共有サーバーのログイン情報を変更します。",
      "新しいログインID：" + username,
      "パスワード：" + (password ? "変更する" : "変更しない"),
      "変更後、すべての端末で再ログインが必要になります。",
      "この内容で変更しますか？"
    ].join("\n");
    if (!window.confirm(description)) return;

    busy = true;
    const submit = screen.querySelector("#server-credentials-submit");
    submit.disabled = true;
    submit.textContent = "変更しています...";
    status.className = "server-credentials-notice";
    status.textContent = "サーバーで変更を確認しています。";

    const payload = JSON.stringify({
      current_password: current,
      new_username: username,
      new_password: password,
      new_password_confirm: confirmPassword
    });
    // 画面・ブラウザー保存領域にはパスワードを残さない。
    clearSecrets();
    try {
      const response = await fetch(ENDPOINT, {
        method: "POST",
        mode: "cors",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          Accept: "application/json",
          Authorization: "Bearer " + session.token
        },
        body: payload
      });
      const data = await response.json();
      if (response.status === 401) {
        window.inventoryServerSearch?.expireSession?.();
        syncSession();
        throw new Error("ログインの有効期限が切れました。再ログインしてください。");
      }
      if (!response.ok || data?.success !== true) {
        throw new Error(data?.message || "ログイン情報を変更できませんでした。");
      }

      window.inventoryServerSearch?.expireSession?.();
      form.hidden = true;
      screen.querySelector("#server-credentials-login").hidden = false;
      const result = screen.querySelector("#server-credentials-result");
      result.hidden = false;
      result.textContent = "変更が完了しました。新しいログインIDは「" + String(data.username || username) + "」です。すべての端末でログインし直してください。";
      status.className = "server-credentials-notice success";
      status.textContent = "ログイン情報の変更が成功しました。";
    } catch (error) {
      // 通信断では変更だけ成功した可能性もある。自動再送を行わない。
      if (error instanceof TypeError || error instanceof SyntaxError) {
        window.inventoryServerSearch?.expireSession?.();
        form.hidden = true;
        screen.querySelector("#server-credentials-login").hidden = false;
        status.textContent = "通信結果を確認できませんでした。再度変更ボタンを押さず、新しいログイン情報でログインできるか確認してください。";
      } else {
        status.textContent = error?.message || "変更できませんでした。";
      }
      status.className = "server-credentials-notice error";
    } finally {
      busy = false;
      submit.disabled = false;
      submit.textContent = "ログイン情報の変更を確認する";
    }
  }
})();
