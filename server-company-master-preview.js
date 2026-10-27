"use strict";

// v293.1: 社内商品マスタCSVの事前確認と、再検証付きの管理者によるサーバー反映。
(function () {
  const ENDPOINT = "https://jyuubee.sakura.ne.jp/inventory/apply-company-master-auth.php";
  const MAX_BYTES = 8 * 1024 * 1024;
  let screen;
  let busy = false;
  let preview = null;
  let csvText = "";
  let previewLoginToken = "";

  document.addEventListener("DOMContentLoaded", initialize);

  function initialize() {
    const host = document.getElementById("home-data-buttons");
    const main = document.querySelector("main");
    if (!host || !main || document.getElementById("show-server-company-master-preview")) return;
    addStyle();
    const button = document.createElement("button");
    button.id = "show-server-company-master-preview";
    button.type = "button";
    button.className = "home-dashboard-action home-action-settings";
    button.textContent = "社内商品マスタCSVをサーバーへ登録・更新";
    host.appendChild(button);
    screen = document.createElement("section");
    screen.id = "server-company-master-preview-screen";
    screen.hidden = true;
    screen.innerHTML = `
      <div class="v293-preview-panel">
        <h2>社内商品マスタCSVの事前確認・反映</h2>
        <p>社内CSVのA～AQ列を読み、共有サーバーに登録済みの商品と比較します。</p>
        <p class="v293-preview-alert"><strong>事前確認は読み取り専用です。</strong>「反映する」を確定した場合だけ共有サーバーの商品情報を変更します。既存商品は色・商品状態だけを変更し、専用商品・廃盤予定の状態は固定します。新規商品の在庫は0個、保管場所は未設定です。既存商品の在庫数・保管場所・商品名・商品コード・JAN・カテゴリー・仕入先は変更しません。</p>
        <div class="v293-preview-box">
          <h3>1．管理者ログイン</h3>
          <p id="v293-preview-login-state">ログイン状態を確認しています。</p>
          <button id="v293-preview-login" type="button">サーバーログインを開く</button>
        </div>
        <div class="v293-preview-box">
          <h3>2．社内商品マスタCSVを選ぶ</h3>
          <p>A列：社内コード、B列：商品コード、C列：商品名、E列：色、F列：JAN、I列：カテゴリー、AK列：廃番区分、AQ列：仕入れ先名。UTF-8 CSV、最大8MBです。</p>
          <input id="v293-preview-file" type="file" accept=".csv,text/csv">
          <button id="v293-preview-check" type="button">CSVの内容を事前確認する</button>
        </div>
        <div class="v293-preview-box">
          <h3>3．事前確認結果（ここでは保存されません）</h3>
          <p id="v293-preview-message" role="status" aria-live="polite">CSVを選択してください。</p>
          <div id="v293-preview-counts" class="v293-preview-counts" hidden></div>
          <p id="v293-preview-extra" hidden></p>
          <div id="v293-preview-scroll" class="v293-preview-scroll" hidden>
            <table><thead><tr><th>CSV行</th><th>判定</th><th>社内コード</th><th>商品名</th><th>確認内容</th></tr></thead><tbody id="v293-preview-rows"></tbody></table>
          </div>
        </div>
        <div class="v293-preview-box" id="v293-apply-area">
          <h3>4．サーバーへ商品マスタを反映する</h3>
          <p class="v293-preview-alert">注意：ここから先は実際のMySQLデータを変更します。先に<strong>MySQLのバックアップ</strong>を保存し、架空の商品データでテストしてください。最大1,000商品／回。商品・在庫は端末内へ自動反映されません。</p>
          <label class="v293-apply-check"><input id="v293-apply-backup" type="checkbox"> MySQLのバックアップを取り、確認結果を確認しました</label>
          <button type="button" id="v293-apply-button" disabled>確認した新規商品・更新候補だけをサーバーへ反映する</button>
          <p id="v293-apply-result" role="status" aria-live="polite"></p>
        </div>
        <button id="v293-preview-back" class="v293-preview-back" type="button">ホームに戻る</button>
      </div>`;
    main.appendChild(screen);
    button.addEventListener("click", openScreen);
    get("v293-preview-login").addEventListener("click", function () {
      window.inventoryServerSearch?.openLogin?.("");
    });
    get("v293-preview-file").addEventListener("change", clearResults);
    get("v293-preview-check").addEventListener("click", checkCsv);
    get("v293-apply-backup").addEventListener("change", updateApplyButton);
    get("v293-apply-button").addEventListener("click", applyCsv);
    get("v293-preview-back").addEventListener("click", returnHome);
    window.addEventListener("inventory-server-auth-changed", function () {
      refreshLogin();
      clearResults();
    });
  }
  function get(id) { return document.getElementById(id); }
  function session() {
    const data = window.inventoryServerSearch?.getSession?.();
    return data?.token && data?.user?.role === "admin" ? data : null;
  }
  function refreshLogin() {
    get("v293-preview-login-state").textContent = session()
      ? "管理者ログイン済み。CSVの確認ができます。"
      : "管理者として共有サーバーにログインしてください。";
  }
  async function openScreen() {
    if (busy) return;
    const permissions = window.inventoryPermissions;
    if (permissions?.requireAdmin) {
      if (!(await permissions.requireAdmin("社内商品マスタCSVのサーバー事前確認"))) return;
    } else if (permissions?.isAdmin && !permissions.isAdmin()) {
      alert("この画面は管理者専用です。");
      return;
    }
    document.querySelectorAll("main > section").forEach(function (s) { s.hidden = true; });
    screen.hidden = false;
    refreshLogin();
    clearResults();
    window.scrollTo(0, 0);
  }
  function returnHome() {
    if (busy) return;
    screen.hidden = true;
    if (window.inventoryApp?.showScreen) window.inventoryApp.showScreen("home");
    else if (get("home")) get("home").hidden = false;
    window.scrollTo(0, 0);
  }
  function clearResults() {
    preview = null;
    csvText = "";
    previewLoginToken = "";
    get("v293-apply-backup").checked = false;
    get("v293-apply-result").textContent = "";
    updateApplyButton();
    get("v293-preview-message").textContent = "CSVを選択して、事前確認ボタンを押してください。";
    get("v293-preview-counts").hidden = true;
    get("v293-preview-counts").replaceChildren();
    get("v293-preview-rows").replaceChildren();
    get("v293-preview-scroll").hidden = true;
    get("v293-preview-extra").hidden = true;
    get("v293-preview-extra").textContent = "";
  }
  function setBusy(value) {
    busy = value;
    get("v293-preview-file").disabled = value;
    get("v293-preview-check").disabled = value;
    get("v293-preview-back").disabled = value;
    get("v293-apply-backup").disabled = value;
    updateApplyButton();
  }
  function canApply() {
    const auth = session();
    return !busy && auth && auth.token === previewLoginToken && preview && csvText &&
      /^[a-f0-9]{64}$/.test(preview.csv_sha256 || "") &&
      /^[a-f0-9]{64}$/.test(preview.snapshot_sha256 || "") &&
      preview.error_count === 0 &&
      preview.new_count + preview.update_count > 0 &&
      preview.total_rows <= 1000 &&
      get("v293-apply-backup").checked;
  }
  function updateApplyButton() {
    const b = get("v293-apply-button");
    if (b) b.disabled = !canApply();
  }
  async function checkCsv() {
    if (busy) return;
    clearResults();
    const auth = session();
    const file = get("v293-preview-file").files?.[0];
    if (!auth) {
      get("v293-preview-message").textContent = "先に管理者ログインしてください。";
      return;
    }
    if (!file || !file.name.toLowerCase().endsWith(".csv") || file.size === 0 || file.size > MAX_BYTES) {
      get("v293-preview-message").textContent = "8MB以下のCSVファイルを選択してください。";
      return;
    }
    setBusy(true);
    get("v293-preview-message").textContent = "サーバーでCSVを確認中です。在庫データは変更されません。";
    try {
      csvText = (await file.text()).replace(/^\uFEFF/, "");
      const response = await fetch(ENDPOINT, {
        method: "POST", mode: "cors", cache: "no-store",
        headers: {
          "Content-Type": "application/json; charset=utf-8", Accept: "application/json",
          Authorization: "Bearer " + auth.token
        },
        body: JSON.stringify({ action: "preview", csv_text: csvText })
      });
      const data = await response.json();
      if (!response.ok || data?.success !== true || data?.preview_only !== true) {
        const reasons = Array.isArray(data?.errors) ? " " + data.errors.join(" / ") : "";
        throw new Error((data?.message || "確認できませんでした。") + reasons);
      }
      if (typeof data.snapshot_sha256 !== "string") throw new Error("サーバーの登録・更新機能が未更新です。PHPの追加を確認してください。");
      preview = data;
      previewLoginToken = auth.token;
      get("v293-preview-message").textContent = "事前確認が完了しました。ここでは商品・在庫・履歴は変更していません。";
      const summary = [
        ["CSVの商品数", data.total_rows],
        ["新規登録候補", data.new_count],
        ["更新候補（色・状態）", data.update_count],
        ["変更なし", data.unchanged_count],
        ["エラー", data.error_count]
      ];
      const counts = get("v293-preview-counts");
      summary.forEach(function ([name, count]) {
        const item = document.createElement("div");
        const label = document.createElement("span");
        const strong = document.createElement("strong");
        label.textContent = name;
        strong.textContent = String(count ?? 0) + "件";
        item.append(label, strong);
        counts.appendChild(item);
      });
      counts.hidden = false;
      const stateText = { new: "新規", update: "更新候補", unchanged: "変更なし", error: "エラー" };
      (Array.isArray(data.rows) ? data.rows : []).forEach(function (r) {
        const tr = document.createElement("tr");
        [r.line, stateText[r.result] || "不明", r.internal_code, r.product_name, r.message].forEach(function (value) {
          const td = document.createElement("td");
          td.textContent = value == null ? "" : String(value);
          tr.appendChild(td);
        });
        get("v293-preview-rows").appendChild(tr);
      });
      get("v293-preview-scroll").hidden = false;
      if (data.error_count > 0) {
        get("v293-apply-result").textContent = "CSVにエラーがあります。修正して事前確認をやり直してください。";
      } else if (data.total_rows > 1000) {
        get("v293-apply-result").textContent = "反映は1回1,000商品までです。CSVを分割してください。";
      }
      if (Number(data.truncated_rows) > 0) {
        get("v293-preview-extra").textContent = "表は先頭300件だけ表示しています。全件数は上の集計に反映されています。";
        get("v293-preview-extra").hidden = false;
      }
    } catch (error) {
      get("v293-preview-message").textContent = "確認できませんでした：" + String(error?.message || error);
    } finally {
      setBusy(false);
    }
  }
  async function applyCsv() {
    if (!canApply()) return;
    const data = preview;
    const newCount = data.new_count;
    const updateCount = data.update_count;
    const unchangedCount = data.unchanged_count;
    if (!window.confirm("共有サーバー（MySQL）の商品マスタを実際に変更します。\n" +
        "新規登録：" + newCount + "件（初期在庫0個）\n" +
        "既存商品の色・商品状態を更新：" + updateCount + "件\n" +
        "変更なし：" + unchangedCount + "件\n" +
        "既存の在庫数・保管場所は変更しません。\n\nこの内容で反映しますか？")) return;
    const auth = session();
    if (!auth || auth.token !== previewLoginToken) {
      clearResults();
      get("v293-preview-message").textContent = "管理者として再ログインして事前確認をやり直してください。";
      return;
    }
    setBusy(true);
    get("v293-apply-result").textContent = "共有サーバーへの反映を実行しています。";
    try {
      const response = await fetch(ENDPOINT, {
        method: "POST", mode: "cors", cache: "no-store",
        headers: { "Content-Type": "application/json; charset=utf-8", Accept: "application/json",
                   Authorization: "Bearer " + auth.token },
        body: JSON.stringify({ action: "apply", csv_text: csvText,
          preview_sha256: data.csv_sha256,
          snapshot_sha256: data.snapshot_sha256,
          expected_counts: { new: newCount, update: updateCount, unchanged: unchangedCount, error: data.error_count },
          confirm_apply: true })
      });
      const result = await response.json();
      if (!response.ok || result?.success !== true || result?.preview_only !== false) {
        throw new Error(result?.message || "サーバーへの反映に失敗しました。HTTP " + response.status);
      }
      get("v293-apply-result").textContent = "反映完了：新規" + result.registered_count +
        "件、既存更新" + result.updated_count + "件、変更なし" + result.unchanged_count +
        "件。在庫の数量変更は0件です。サーバーの商品検索で確認してください。";
      get("v293-preview-message").textContent = "登録・更新が完了しました。再度反映する場合はCSVの事前確認からやり直してください。";
    } catch (error) {
      get("v293-apply-result").textContent = "結果を確定できませんでした：" + String(error?.message || error) +
        "。通信が切れた場合は反映済みの可能性もあるため、再実行前にサーバーの商品検索で確認してください。";
    } finally {
      preview = null;
      csvText = "";
      previewLoginToken = "";
      get("v293-apply-backup").checked = false;
      setBusy(false);
    }
  }
  function addStyle() {
    if (get("v293-preview-styles")) return;
    const style = document.createElement("style");
    style.id = "v293-preview-styles";
    style.textContent = `
      #server-company-master-preview-screen[hidden], #v293-preview-counts[hidden],
      #v293-preview-scroll[hidden], #v293-preview-extra[hidden] {display:none!important}
      .v293-preview-panel {max-width:970px;margin:12px auto 45px;padding:clamp(14px,3vw,26px);border:1px solid #dae1e7;border-radius:16px;background:#fff;color:#153248}
      .v293-preview-panel h2 {color:#145eb5;font-size:clamp(21px,3vw,29px)}
      .v293-preview-panel h3 {font-size:20px;margin:0 0 12px}
      .v293-preview-panel p {line-height:1.7}
      .v293-preview-box {padding:16px;margin:17px 0;border:1px solid #d3dfe6;border-radius:12px}
      .v293-preview-alert {background:#fff2dd;border-left:5px solid #e58a12;padding:13px}
      .v293-preview-panel button {min-height:52px;border:0;border-radius:9px;background:#1161b8;color:#fff;font-size:17px;font-weight:700;padding:10px 18px;cursor:pointer}
      .v293-preview-panel button:disabled {opacity:.55}
      .v293-preview-panel input[type=file] {display:block;margin:12px 0;max-width:100%;font-size:16px}
      .v293-apply-check {display:flex;align-items:flex-start;gap:12px;font-size:16px;font-weight:700;margin:18px 0;line-height:1.5}
      .v293-apply-check input {width:23px;height:23px;flex-shrink:0}
      #v293-apply-button {background:#267737;width:100%}
      #v293-apply-result {color:#195e35;font-weight:700;overflow-wrap:anywhere}
      .v293-preview-back {background:#4a626b!important;width:100%}
      .v293-preview-counts {display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px}
      .v293-preview-counts div {border:1px solid #d5e4ee;border-radius:9px;padding:12px}
      .v293-preview-counts span,.v293-preview-counts strong {display:block}
      .v293-preview-counts strong {font-size:25px;color:#16733f}
      .v293-preview-scroll {overflow:auto;max-height:420px;margin-top:20px}
      .v293-preview-scroll table {width:100%;min-width:580px;border-collapse:collapse}
      .v293-preview-scroll td,.v293-preview-scroll th {padding:10px;border:1px solid #dce4e8;text-align:left;vertical-align:top}
    `;
    document.head.appendChild(style);
  }
})();
