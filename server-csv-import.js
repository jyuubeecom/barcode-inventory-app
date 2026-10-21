"use strict";

// v292: 従来の端末内CSV読込には触れず、共有サーバー専用の新規一括登録画面を追加する。
(function () {
  const ENDPOINT = "https://jyuubee.sakura.ne.jp/inventory/import-products-auth.php";
  const MAX_CSV_BYTES = 1048576; // PHP側の上限と同じ1MB
  const REQUIRED_ROLE = "admin";
  let screen, fileInput, previewButton, registerButton, status, summary, rowsBody, resultArea;
  let csvText = "";
  let preview = null;
  let busy = false;

  document.addEventListener("DOMContentLoaded", initialize);

  function initialize() {
    const openButton = document.getElementById("show-server-csv-import-button");
    const main = document.querySelector("main");
    if (!openButton || !main) return;

    injectStyles();
    screen = document.createElement("section");
    screen.id = "server-csv-import-screen";
    screen.className = "server-csv-import-screen";
    screen.hidden = true;
    screen.innerHTML = `
      <div class="server-csv-import-panel">
        <h2>共有サーバーへ商品マスタCSVを一括登録</h2>
        <p>PC・スマホ共通のMySQLに、CSV内の<strong>新規商品だけ</strong>を登録します。登録済みの商品は上書きしません。</p>
        <p class="server-csv-import-caution">最初は架空データだけでテストしてください。実際の会社情報は、会社の許可を得るまで使わないでください。</p>

        <div class="server-csv-import-step">
          <h3>1. 共有サーバーに管理者ログイン</h3>
          <p id="server-csv-import-session" aria-live="polite">ログイン状態を確認します。</p>
          <button type="button" id="server-csv-import-login">サーバーログインを開く</button>
        </div>

        <div class="server-csv-import-step">
          <h3>2. 商品マスタCSVを選択</h3>
          <p>「共有サーバーの商品マスタCSVを出力する」で保存したCSV（v290形式）を選択してください。最大1MB、UTF-8形式です。</p>
          <label for="server-csv-import-file">CSVファイル</label>
          <input id="server-csv-import-file" type="file" accept=".csv,text/csv">
          <button id="server-csv-import-preview" type="button" disabled>登録前に内容を確認する</button>
        </div>

        <div class="server-csv-import-step">
          <h3>3. 事前確認結果</h3>
          <p id="server-csv-import-status" class="server-csv-import-status" role="status" aria-live="polite">CSVを選択してください。</p>
          <div id="server-csv-import-summary" class="server-csv-import-summary" hidden></div>
          <div id="server-csv-import-table-wrap" class="server-csv-import-table-wrap" hidden>
            <table class="server-csv-import-table">
              <thead><tr><th>CSV行</th><th>判定</th><th>社内コード</th><th>商品名</th><th>現在庫</th><th>確認内容</th></tr></thead>
              <tbody id="server-csv-import-rows"></tbody>
            </table>
          </div>
          <p class="server-csv-import-caution">登録する前に新規商品の件数と在庫数を確認してください。エラーが1件でもあれば登録できません。</p>
          <button id="server-csv-import-register" type="button" disabled>確認した新規商品だけを登録する</button>
          <div id="server-csv-import-result" class="server-csv-import-result" aria-live="polite"></div>
        </div>

        <button type="button" id="server-csv-import-back" class="server-csv-import-back">ホームに戻る</button>
      </div>
    `;
    main.appendChild(screen);
    fileInput = screen.querySelector("#server-csv-import-file");
    previewButton = screen.querySelector("#server-csv-import-preview");
    registerButton = screen.querySelector("#server-csv-import-register");
    status = screen.querySelector("#server-csv-import-status");
    summary = screen.querySelector("#server-csv-import-summary");
    rowsBody = screen.querySelector("#server-csv-import-rows");
    resultArea = screen.querySelector("#server-csv-import-result");

    openButton.addEventListener("click", openScreen);
    fileInput.addEventListener("change", onFileChange);
    previewButton.addEventListener("click", previewCsv);
    registerButton.addEventListener("click", registerCsv);
    screen.querySelector("#server-csv-import-login").addEventListener("click", function () {
      window.inventoryServerSearch?.openLogin?.("");
    });
    screen.querySelector("#server-csv-import-back").addEventListener("click", returnHome);
    window.addEventListener("inventory-server-auth-changed", function () {
      updateSessionLabel();
      // ログインが変わったときは以前の確認結果を使わない。
      invalidatePreview();
    });
  }

  async function openScreen() {
    if (busy) return;
    const permissions = window.inventoryPermissions;
    if (permissions?.requireAdmin) {
      if (!(await permissions.requireAdmin("共有サーバーへのCSV一括登録"))) return;
    } else if (permissions?.isAdmin && !permissions.isAdmin()) {
      window.alert("この操作は管理者専用です。管理者モードに切り替えてください。");
      return;
    }
    document.querySelectorAll("main > section").forEach(function (section) {
      section.hidden = true;
    });
    screen.hidden = false;
    resetScreen();
    updateSessionLabel();
    screen.scrollIntoView({ block: "start" });
  }

  function returnHome() {
    if (busy) {
      window.alert("処理中です。終了するまでお待ちください。");
      return;
    }
    screen.hidden = true;
    resetScreen();
    if (window.inventoryApp?.showScreen) {
      window.inventoryApp.showScreen("home");
    } else {
      const home = document.getElementById("home");
      if (home) home.hidden = false;
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function getAdminSession() {
    const session = window.inventoryServerSearch?.getSession?.();
    return session && session.token && session.user?.role === REQUIRED_ROLE ? session : null;
  }

  function updateSessionLabel() {
    const element = screen?.querySelector("#server-csv-import-session");
    if (!element) return;
    const session = getAdminSession();
    element.textContent = session
      ? "管理者ログイン済み：" + String(session.user?.display_name || session.user?.username || "管理者")
      : "管理者としてのサーバーログインが必要です。";
  }

  function resetScreen() {
    csvText = "";
    if (fileInput) fileInput.value = "";
    invalidatePreview();
    if (status) status.textContent = "CSVを選択してください。";
    if (resultArea) resultArea.replaceChildren();
  }

  function invalidatePreview() {
    preview = null;
    if (registerButton) registerButton.disabled = true;
    if (previewButton) previewButton.disabled = busy || !fileInput?.files?.length;
    if (summary) {
      summary.hidden = true;
      summary.replaceChildren();
    }
    const wrap = screen?.querySelector("#server-csv-import-table-wrap");
    if (wrap) wrap.hidden = true;
    if (rowsBody) rowsBody.replaceChildren();
  }

  function onFileChange() {
    if (busy) return;
    csvText = "";
    invalidatePreview();
    if (resultArea) resultArea.replaceChildren();
    const file = fileInput.files?.[0];
    status.textContent = file
      ? "「" + file.name + "」を選択しました。事前確認ボタンを押してください。"
      : "CSVを選択してください。";
  }

  function setBusy(value) {
    busy = value;
    fileInput.disabled = value;
    previewButton.disabled = value || !fileInput.files?.length;
    registerButton.disabled = value || !canRegister(preview);
    screen.querySelector("#server-csv-import-back").disabled = value;
  }

  function canRegister(data) {
    return !!(
      data?.success === true &&
      data?.preview_only === true &&
      typeof data.csv_sha256 === "string" &&
      /^[a-f0-9]{64}$/.test(data.csv_sha256) &&
      Number.isInteger(data.new_count) && data.new_count > 0 && data.new_count <= 500 &&
      Number.isInteger(data.existing_count) &&
      data.error_count === 0 && csvText &&
      getAdminSession()
    );
  }

  async function onApiError(response) {
    let data = null;
    try { data = await response.json(); } catch (error) { /* JSON以外のエラーも扱う */ }
    if (response.status === 401) {
      window.inventoryServerSearch?.expireSession?.();
      updateSessionLabel();
      throw new Error("ログインの期限が切れました。管理者として再ログインしてください。");
    }
    throw new Error(data?.message || "サーバーでエラーが発生しました（HTTP " + response.status + "）。");
  }

  async function callApi(action, text, currentPreview, expectedCount) {
    const session = getAdminSession();
    if (!session) throw new Error("管理者としてサーバーにログインしてください。");
    const payload = { action, csv_text: text };
    if (action === "register") {
      payload.preview_sha256 = currentPreview.csv_sha256;
      payload.expected_new_count = expectedCount;
      payload.confirm_new_only = true;
    }
    const response = await fetch(ENDPOINT, {
      method: "POST",
      mode: "cors",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Accept: "application/json",
        Authorization: "Bearer " + session.token
      },
      body: JSON.stringify(payload)
    });
    if (!response.ok) return onApiError(response);
    let data;
    try { data = await response.json(); } catch (error) {
      throw new Error("サーバーから正しい結果を受け取れませんでした。");
    }
    if (!data || data.success !== true) throw new Error(data?.message || "処理に失敗しました。");
    return data;
  }

  async function previewCsv() {
    if (busy) return;
    const file = fileInput.files?.[0];
    if (!file) {
      status.textContent = "CSVファイルを選択してください。";
      return;
    }
    invalidatePreview();
    if (!getAdminSession()) {
      status.textContent = "管理者としてサーバーにログインしてから事前確認してください。";
      return;
    }
    if (!file.name.toLowerCase().endsWith(".csv")) {
      status.textContent = "拡張子が.csvのファイルを選択してください。";
      return;
    }
    if (file.size === 0 || file.size > MAX_CSV_BYTES) {
      status.textContent = "CSVは1MB以下の空でないファイルを選んでください。";
      return;
    }
    setBusy(true);
    status.textContent = "サーバーでCSVを事前確認しています。商品はまだ登録されません。";
    resultArea.replaceChildren();
    try {
      csvText = (await file.text()).replace(/^\uFEFF/, "");
      if (!csvText.trim()) throw new Error("CSVファイルが空です。");
      const data = await callApi("preview", csvText);
      preview = data;
      renderPreview(data);
      if (canRegister(data)) {
        status.textContent = "確認完了。新規" + data.new_count + "件を登録できます。まだ登録されていません。";
      } else if (data.error_count > 0) {
        status.textContent = "エラーが" + data.error_count + "件あります。CSVを修正してから再確認してください。";
      } else {
        status.textContent = "確認完了。新しく登録する商品はありません。";
      }
    } catch (error) {
      csvText = "";
      invalidatePreview();
      status.textContent = "確認できませんでした：" + (error.message || "通信エラー");
    } finally {
      setBusy(false);
    }
  }

  function renderPreview(data) {
    summary.replaceChildren();
    [
      ["CSVの商品", data.total_rows],
      ["新規", data.new_count],
      ["登録済み（変更なし）", data.existing_count],
      ["エラー", data.error_count]
    ].forEach(function (entry) {
      const box = document.createElement("div");
      const label = document.createElement("span");
      const count = document.createElement("strong");
      label.textContent = entry[0];
      count.textContent = String(entry[1] ?? 0) + "件";
      box.append(label, count);
      summary.appendChild(box);
    });
    summary.hidden = false;
    rowsBody.replaceChildren();
    const previewRows = Array.isArray(data.rows) ? data.rows : [];
    previewRows.forEach(function (item) {
      const row = document.createElement("tr");
      if (item.result === "error") row.className = "server-csv-import-error";
      if (item.result === "new") row.className = "server-csv-import-new";
      const values = [
        item.line, item.result === "new" ? "新規" : item.result === "existing" ? "登録済み" : "エラー",
        item.internal_code, item.product_name,
        item.total_stock == null ? "-" : String(item.total_stock) + "個", item.message
      ];
      ["CSV行", "判定", "社内コード", "商品名", "現在庫", "確認内容"].forEach(function (name, i) {
        const td = document.createElement("td");
        td.dataset.label = name;
        td.textContent = values[i] == null ? "" : String(values[i]);
        row.appendChild(td);
      });
      rowsBody.appendChild(row);
    });
    screen.querySelector("#server-csv-import-table-wrap").hidden = false;
  }

  async function confirmRegistration(data) {
    const details = [
      { label: "新規登録", value: data.new_count + "件" },
      { label: "登録済み（変更なし）", value: data.existing_count + "件" },
      { label: "エラー", value: data.error_count + "件" }
    ];
    if (window.inventoryApp?.showAppDialog) {
      return !!(await window.inventoryApp.showAppDialog({
        type: "warning", icon: "📦",
        title: "共有サーバーに新規商品を登録しますか？",
        message: "MySQLの商品・在庫・初期登録履歴を実際に変更します。既存商品は上書きしません。",
        details,
        notice: "登録前に新規商品の内容とバックアップを確認してください。",
        isConfirm: true,
        confirmText: "新規商品だけ登録する",
        cancelText: "やめる"
      }));
    }
    return window.confirm(
      "共有サーバーに新規" + data.new_count + "件を登録します。\n" +
      "既存" + data.existing_count + "件は上書きしません。\n\n登録しますか？"
    );
  }

  async function registerCsv() {
    if (busy || !canRegister(preview)) return;
    const agreed = await confirmRegistration(preview);
    if (!agreed || busy || !canRegister(preview)) return;
    const before = preview;
    setBusy(true);
    registerButton.disabled = true;
    status.textContent = "登録直前の状態をもう一度確認しています...";
    try {
      const latest = await callApi("preview", csvText);
      if (
        !canRegister(latest) ||
        latest.csv_sha256 !== before.csv_sha256 ||
        latest.new_count !== before.new_count ||
        latest.existing_count !== before.existing_count ||
        latest.error_count !== before.error_count
      ) {
        preview = latest;
        renderPreview(latest);
        status.textContent = "登録直前に商品状況が変わりました。内容を確認して、必要ならもう一度操作してください。";
        return;
      }
      status.textContent = "共有サーバーに登録しています。画面を閉じずにお待ちください...";
      const result = await callApi("register", csvText, latest, latest.new_count);
      preview = null; // 二重登録防止。再登録にはファイルを選び直して事前確認が必要。
      registerButton.disabled = true;
      if (result.registered_count !== latest.new_count) {
        status.textContent = "登録結果を再確認してください。再登録せず、サーバーの商品検索で状態を確認してください。";
      } else {
        status.textContent = "登録完了。新規" + result.registered_count + "件、履歴" + (result.history_count ?? "-") + "件を記録しました。";
      }
      resultArea.replaceChildren();
      const text = document.createElement("p");
      const codes = Array.isArray(result.registered_codes) ? result.registered_codes.join("、") : "";
      text.textContent = (result.message || "登録処理が完了しました。") +
        "\n登録した社内コード：" + (codes || "サーバーの商品検索で確認してください。") +
        "\n端末内の在庫数には自動反映しません。共有サーバーの商品検索で確認してください。";
      text.style.whiteSpace = "pre-line";
      resultArea.appendChild(text);
      if (window.inventoryServerProductList?.refresh) {
        try { window.inventoryServerProductList.refresh(); } catch (ignored) { /* 任意の更新 */ }
      }
    } catch (error) {
      preview = null;
      registerButton.disabled = true;
      status.textContent = "登録結果を確認できませんでした：" + (error.message || "通信エラー") +
        "。再登録せず、共有サーバーの商品検索で登録状況を確認してください。";
    } finally {
      setBusy(false);
      // 登録を試みたあとは、必ず新しくCSVを選び直すまで登録不可。
      if (!preview) registerButton.disabled = true;
    }
  }

  function injectStyles() {
    if (document.getElementById("server-csv-import-styles")) return;
    const style = document.createElement("style");
    style.id = "server-csv-import-styles";
    style.textContent = `
      #server-csv-import-screen[hidden], #server-csv-import-summary[hidden],
      #server-csv-import-table-wrap[hidden] {display:none !important}
      .server-csv-import-screen {max-width:1100px;margin:0 auto;padding:12px 0 48px}
      .server-csv-import-panel {background:#fff;border:1px solid #d4e0e9;border-radius:14px;padding:clamp(14px,3vw,26px);color:#173850}
      .server-csv-import-panel h2 {font-size:clamp(22px,3vw,28px);margin:0 0 14px;color:#164f91}
      .server-csv-import-panel p {line-height:1.7}
      .server-csv-import-step {margin:20px 0;padding:18px;border:1px solid #cedbe5;border-radius:12px;background:#f8fbfd}
      .server-csv-import-step h3 {margin:0 0 14px;color:#164f91;font-size:19px}
      .server-csv-import-caution {padding:12px;background:#fff3e6;border-left:5px solid #e17a17;border-radius:6px;color:#77400b;font-weight:600}
      .server-csv-import-step label {display:block;margin:10px 0 7px;font-weight:700}
      #server-csv-import-file {display:block;width:100%;box-sizing:border-box;background:#fff;border:2px solid #a2b4c5;padding:13px;border-radius:8px;font-size:16px}
      .server-csv-import-screen button {display:block;width:100%;min-height:52px;margin:12px 0 0;border:0;border-radius:9px;background:#1c69bd;color:white;font-size:17px;font-weight:700;cursor:pointer;padding:12px}
      #server-csv-import-register {background:#278039}
      #server-csv-import-register:disabled, .server-csv-import-screen button:disabled {background:#91a5af;cursor:not-allowed}
      .server-csv-import-back {background:#455d6b !important}
      .server-csv-import-status {padding:14px;border:1px solid #b5d4f2;background:#eaf4ff;border-radius:8px;font-weight:600;overflow-wrap:anywhere}
      .server-csv-import-summary {display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:12px 0}
      .server-csv-import-summary>div {display:flex;flex-direction:column;background:#fff;border:1px solid #cbd7e2;border-radius:9px;text-align:center;padding:12px 5px}
      .server-csv-import-summary span {font-size:13px;color:#465e70}
      .server-csv-import-summary strong {font-size:25px;color:#164f91}
      .server-csv-import-table-wrap {overflow-x:auto;max-height:420px;overflow-y:auto;border-radius:8px;border:1px solid #d2dbe2;margin:10px 0}
      .server-csv-import-table {width:100%;border-collapse:collapse;min-width:710px}
      .server-csv-import-table th, .server-csv-import-table td {padding:10px;border:1px solid #e1e6ea;text-align:left;vertical-align:top;overflow-wrap:anywhere}
      .server-csv-import-table th {background:#1d64b0;color:#fff;position:sticky;top:0}
      .server-csv-import-new {background:#ebf8ee}
      .server-csv-import-error {background:#fff0f0}
      .server-csv-import-result {margin-top:12px;font-weight:600;color:#1c6033}
      @media(max-width:650px) {
        .server-csv-import-screen {padding:8px 0 36px}
        .server-csv-import-step {padding:12px}
        .server-csv-import-summary {grid-template-columns:repeat(2,minmax(0,1fr))}
        .server-csv-import-table {min-width:0}
        .server-csv-import-table thead {display:none}
        .server-csv-import-table tr,.server-csv-import-table td {display:block;width:100%;box-sizing:border-box}
        .server-csv-import-table tr {border-bottom:2px solid #8ba1b3;padding:8px}
        .server-csv-import-table td {border:0;padding:5px 8px}
        .server-csv-import-table td::before {content:attr(data-label) '：';font-weight:700;display:inline}
      }
    `;
    document.head.appendChild(style);
  }
})();
