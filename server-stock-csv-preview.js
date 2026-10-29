"use strict";

/*
 * v293.3 第1段階：v293.2の読み取り専用比較に「反映候補の選択・確認」を追加する。
 * サーバー在庫や履歴は変更せず、反映用APIも呼び出さない。
 * v293.2 第1段階：在庫CSVと共有サーバーの保管場所別在庫を読み取り専用で照合する。
 * CSVファイルはブラウザ内で解析し、認証済みの既存商品取得APIをGETするだけ。
 * 在庫数の変更、サーバーへのCSV送信、端末内データの変更は一切行わない。
 */
(function () {
  const PRODUCT_ENDPOINT = "https://jyuubee.sakura.ne.jp/inventory/get-product-auth.php";
  const MAX_FILE_BYTES = 512 * 1024;
  const MAX_ROWS = 300;
  const MAX_PRODUCTS = 100;
  const HEADERS = ["社内コード", "保管場所", "在庫数"];
  const KNOWN_LOCATIONS = [
    "本社", "本社1階 A区", "本社1階 B区", "本社1階 C区", "本社1階 D区",
    "本社1階 E区", "本社1階 F区", "本社2階 A区", "本社2階 B区",
    "本社2階 C区", "本社2階 D区", "本社2階 E区", "本社2階 F区",
    "酒本倉庫1階", "酒本倉庫2階", "未設定"
  ];

  let screen = null;
  let processing = false;
  let generation = 0;
  let activeController = null;
  // v293.3: 反映候補は画面内メモリだけに保持し、保存・送信しない。
  let selectableRows = [];
  const selectedLines = new Set();

  document.addEventListener("DOMContentLoaded", initialize);

  function element(id) {
    return document.getElementById(id);
  }

  function getAdminSession() {
    const auth = window.inventoryServerSearch?.getSession?.();
    return auth?.token && auth?.user?.role === "admin" ? auth : null;
  }

  function initialize() {
    const buttons = element("home-data-buttons");
    const main = document.querySelector("main");
    if (!buttons || !main || element("show-server-stock-csv-preview")) return;

    addStyles();
    const openButton = document.createElement("button");
    openButton.id = "show-server-stock-csv-preview";
    openButton.type = "button";
    openButton.className = "home-dashboard-action home-action-settings";
    openButton.textContent = "在庫CSVと共有サーバーを照合（試作）";
    buttons.appendChild(openButton);

    screen = document.createElement("section");
    screen.id = "server-stock-csv-preview-screen";
    screen.hidden = true;
    screen.innerHTML = `
      <div class="v2932-stock-panel">
        <h2>在庫CSV・保管場所別在庫の事前照合</h2>
        <p class="v2932-stock-intro">在庫CSVの数量と、共有サーバーに保存された数量を比べます。</p>
        <div class="v2932-stock-alert" role="note">
          <strong>読み取り・比較だけを行う試作版です。</strong>
          この画面から商品・数量・入出庫履歴・販売予定は変更できません。CSVファイル自体もサーバーへ送信しません。
          在庫を反映する機能は今後追加します。
        </div>
        <div class="v2932-stock-box">
          <h3>1．管理者ログイン</h3>
          <p id="v2932-stock-login-state">ログイン状態を確認中です。</p>
          <button type="button" id="v2932-stock-login">サーバーログインを開く</button>
        </div>
        <div class="v2932-stock-box">
          <h3>2．在庫CSVを選ぶ</h3>
          <p>1行目の見出しは<strong>「社内コード,保管場所,在庫数」</strong>です。1行が1商品・1保管場所を表します。</p>
          <p class="v2932-stock-help">UTF-8 CSV、最大512KB・300行・100商品。数量は0以上の整数。テストには架空データを使用してください。</p>
          <input type="file" id="v2932-stock-file" accept=".csv,text/csv" aria-label="在庫CSVファイルを選択">
          <button type="button" id="v2932-stock-check">CSVとサーバーの在庫を比較する</button>
        </div>
        <div class="v2932-stock-box">
          <h3>3．比較結果（保存されません）</h3>
          <p id="v2932-stock-message" role="status" aria-live="polite">CSVを選択してください。</p>
          <div id="v2932-stock-counts" class="v2932-stock-counts" hidden></div>
          <div id="v2932-stock-table-wrap" class="v2932-stock-table-wrap" hidden>
            <table>
              <thead><tr>
                <th>CSV行</th><th>社内コード</th><th>保管場所</th>
                <th>CSV数量</th><th>サーバー数量</th><th>差異（CSV－サーバー）</th><th>判定</th>
              </tr></thead>
              <tbody id="v2932-stock-rows"></tbody>
            </table>
          </div>
          <p class="v2932-stock-help">※ 商品コードの有無や在庫数の一致だけでは、CSVをそのまま本番反映してよいとは限りません。保管場所の対応と更新履歴の保存を別途確認する必要があります。</p>
        </div>
        <div class="v2932-stock-box" id="v2933-stock-plan" hidden>
          <h3>4．反映候補を確認する（まだ更新しません）</h3>
          <p class="v2932-stock-help">差異がある行から反映候補を選べます。選択内容はこの画面で確認するだけで、サーバーや端末内の在庫は変更しません。再照合・画面移動・ログアウト時には選択を破棄します。</p>
          <div id="v2933-stock-options" class="v2933-stock-options"></div>
          <p id="v2933-stock-selection" role="status" aria-live="polite">0件選択中</p>
          <button id="v2933-stock-show-plan" type="button" disabled>選択した反映候補を確認する</button>
          <div id="v2933-stock-confirm" class="v2933-stock-confirm" hidden aria-live="polite">
            <h4>反映前の確認内容（プレビューのみ）</h4>
            <p>これは更新予定の確認です。実際の更新ボタンではありません。更新直前にはサーバー在庫の再照合・バックアップ・履歴保存が必要です。</p>
            <div id="v2933-stock-confirm-rows"></div>
          </div>
        </div>
        <button id="v2932-stock-back" type="button" class="v2932-stock-back">ホームに戻る</button>
      </div>`;
    main.appendChild(screen);

    // 他の画面からhiddenが変更された場合も、古い照合結果を残さない。
    new MutationObserver(function () {
      if (screen.hidden) resetResult();
    }).observe(screen, { attributes: true, attributeFilter: ["hidden"] });

    openButton.addEventListener("click", openScreen);
    element("v2932-stock-login").addEventListener("click", function () {
      window.inventoryServerSearch?.openLogin?.("");
    });
    element("v2932-stock-file").addEventListener("change", resetResult);
    element("v2932-stock-check").addEventListener("click", checkStockCsv);
    element("v2932-stock-back").addEventListener("click", returnHome);
    element("v2933-stock-show-plan").addEventListener("click", showSelectedPlan);
    window.addEventListener("inventory-server-auth-changed", function () {
      generation += 1;
      refreshLogin();
      resetResult();
    });
  }

  async function openScreen() {
    const permissions = window.inventoryPermissions;
    if (permissions?.requireAdmin) {
      if (!(await permissions.requireAdmin("在庫CSVと共有サーバーの照合"))) return;
    } else if (permissions?.isAdmin && !permissions.isAdmin()) {
      window.alert("この画面は管理者専用です。");
      return;
    }
    document.querySelectorAll("main > section").forEach(function (section) {
      section.hidden = true;
    });
    screen.hidden = false;
    refreshLogin();
    resetResult();
    window.scrollTo(0, 0);
  }

  function returnHome() {
    generation += 1;
    resetResult();
    element("v2932-stock-file").value = "";
    screen.hidden = true;
    if (window.inventoryApp?.showScreen) window.inventoryApp.showScreen("home");
    else if (element("home")) element("home").hidden = false;
    window.scrollTo(0, 0);
  }

  function refreshLogin() {
    element("v2932-stock-login-state").textContent = getAdminSession()
      ? "管理者ログイン済みです。共有サーバーの在庫を読み取れます。"
      : "管理者として共有サーバーにログインしてください。";
  }

  function resetResult() {
    if (!screen) return;
    generation += 1;
    if (activeController) activeController.abort();
    activeController = null;
    setProcessing(false);
    element("v2932-stock-message").textContent = "CSVを選択して、比較ボタンを押してください。";
    element("v2932-stock-counts").replaceChildren();
    element("v2932-stock-counts").hidden = true;
    element("v2932-stock-rows").replaceChildren();
    element("v2932-stock-table-wrap").hidden = true;
    selectableRows = [];
    selectedLines.clear();
    element("v2933-stock-options").replaceChildren();
    element("v2933-stock-confirm-rows").replaceChildren();
    element("v2933-stock-confirm").hidden = true;
    element("v2933-stock-plan").hidden = true;
    element("v2933-stock-show-plan").disabled = true;
    element("v2933-stock-selection").textContent = "0件選択中";
  }

  function setProcessing(value) {
    processing = Boolean(value);
    element("v2932-stock-check").disabled = processing;
    element("v2932-stock-check").textContent = processing
      ? "共有サーバーの在庫を確認中..." : "CSVとサーバーの在庫を比較する";
  }

  function parseCsv(text) {
    const rows = [];
    let row = [];
    let field = "";
    let quoted = false;
    let quoteClosed = false;
    let fieldStarted = false;
    const input = String(text || "").replace(/^\uFEFF/, "");
    for (let i = 0; i < input.length; i += 1) {
      const ch = input[i];
      if (quoted) {
        if (ch === '"' && input[i + 1] === '"') {
          field += '"'; i += 1;
        } else if (ch === '"') {
          quoted = false;
          quoteClosed = true;
        } else {
          field += ch;
        }
      } else if (quoteClosed && ch !== "," && ch !== "\r" && ch !== "\n") {
        throw new Error("CSVの閉じ引用符の後に余分な文字があります。");
      } else if (ch === '"' && !fieldStarted) {
        quoted = true;
        fieldStarted = true;
      } else if (ch === '"') {
        throw new Error("CSVの引用符の形式が正しくありません。");
      } else if (ch === ",") {
        row.push(field); field = ""; fieldStarted = false; quoteClosed = false;
      } else if (ch === "\r" || ch === "\n") {
        if (ch === "\r" && input[i + 1] === "\n") i += 1;
        row.push(field); rows.push(row);
        row = []; field = ""; fieldStarted = false; quoteClosed = false;
      } else {
        field += ch;
        fieldStarted = true;
      }
    }
    if (quoted) throw new Error("CSVのダブルクォーテーションが閉じていません。");
    if (field !== "" || row.length > 0 || fieldStarted) {
      row.push(field); rows.push(row);
    }
    return rows;
  }

  function normalizeCode(value) {
    const text = String(value ?? "").trim();
    // Excelが ="00123" 形式で出力した文字列も、社内コードとして安全に認識する。
    const formula = text.match(/^="([^"]+)"$/);
    return formula ? formula[1].trim() : text;
  }

  function normalizeLocation(value) {
    return String(value ?? "").trim().replace(/\s+/g, " ");
  }

  function validateRows(allRows) {
    if (!allRows.length) throw new Error("空のCSVです。見出し行と商品データを入れてください。");
    const header = allRows[0].map(function (v) { return String(v || "").trim(); });
    if (header.length !== 3 || HEADERS.some(function (h, i) { return h !== header[i]; })) {
      throw new Error("見出しが一致しません。1行目を「社内コード,保管場所,在庫数」にしてください。");
    }
    const active = allRows.slice(1).map(function (cells, i) {
      return { cells: cells, line: i + 2 };
    }).filter(function (r) {
      return r.cells.some(function (v) { return String(v).trim() !== ""; });
    });
    if (!active.length) throw new Error("見出し以外の商品データがありません。");
    if (active.length > MAX_ROWS) throw new Error("CSVは最大300行までです。分割して確認してください。");

    const rows = active.map(function (item) {
      const values = item.cells;
      const r = {
        line: item.line,
        code: normalizeCode(values[0]),
        location: normalizeLocation(values[1]),
        quantity: Number(String(values[2] ?? "").trim()),
        rawQuantity: String(values[2] ?? "").trim(),
        errors: [], status: "", serverQuantity: null, difference: null
      };
      if (values.length !== 3) r.errors.push("列数が3列ではありません");
      if (!r.code) r.errors.push("社内コードが空欄です");
      if (!r.location) r.errors.push("保管場所が空欄です");
      if (!/^\d+$/.test(r.rawQuantity) || !Number.isSafeInteger(r.quantity) || r.quantity > 1000000) {
        r.errors.push("在庫数は0～1,000,000の整数で指定してください");
      }
      if (r.location && !KNOWN_LOCATIONS.includes(r.location)) {
        r.errors.push("保管場所が現在の候補にありません。名称を確認してください");
      }
      return r;
    });

    const seen = new Map();
    rows.forEach(function (r) {
      if (!r.code || !r.location) return;
      const key = JSON.stringify([r.code, r.location]);
      if (seen.has(key)) {
        r.errors.push("同じ商品・保管場所がCSVに重複しています");
        const previous = seen.get(key);
        if (!previous.errors.includes("同じ商品・保管場所がCSVに重複しています")) {
          previous.errors.push("同じ商品・保管場所がCSVに重複しています");
        }
      } else {
        seen.set(key, r);
      }
    });
    const codes = new Set(rows.filter(function (r) { return !r.errors.length; }).map(function (r) { return r.code; }));
    if (codes.size > MAX_PRODUCTS) throw new Error("商品数が100件を超えています。CSVを分割してください。");
    return rows;
  }

  async function loadServerProduct(code, token, signal) {
    const response = await fetch(PRODUCT_ENDPOINT + "?code=" + encodeURIComponent(code), {
      method: "GET", mode: "cors", cache: "no-store", signal: signal,
      headers: { Accept: "application/json", Authorization: "Bearer " + token }
    });
    let data = null;
    try { data = await response.json(); } catch (_) { /* 以下でHTTPエラーとして扱う */ }
    if (response.status === 401) {
      window.inventoryServerSearch?.expireSession?.();
      throw new Error("ログインの有効期限が切れました。再ログインしてください。");
    }
    if (response.status === 404) return { found: false };
    if (!response.ok || data?.success !== true || !Array.isArray(data.stocks)) {
      throw new Error(data?.message || "商品「" + code + "」の取得に失敗しました。HTTP " + response.status);
    }
    return { found: true, data: data };
  }

  async function checkStockCsv() {
    if (processing) return;
    resetResult();
    const session = getAdminSession();
    if (!session) {
      element("v2932-stock-message").textContent = "管理者でサーバーにログインしてから実行してください。";
      return;
    }
    const file = element("v2932-stock-file").files?.[0];
    if (!file) {
      element("v2932-stock-message").textContent = "CSVファイルを選択してください。";
      return;
    }
    if (file.size === 0 || file.size > MAX_FILE_BYTES) {
      element("v2932-stock-message").textContent = "CSVファイルは空でない512KB以下のものを選んでください。";
      return;
    }

    const run = ++generation;
    const controller = new AbortController();
    activeController = controller;
    setProcessing(true);
    try {
      const csv = await file.text();
      if (run !== generation) return;
      const rows = validateRows(parseCsv(csv));
      const cache = new Map();
      const validCodes = Array.from(new Set(rows.filter(function (r) {
        return r.errors.length === 0;
      }).map(function (r) { return r.code; })));

      for (let i = 0; i < validCodes.length; i += 1) {
        if (run !== generation) return;
        const code = validCodes[i];
        element("v2932-stock-message").textContent =
          "共有サーバーの商品を照合中です（" + (i + 1) + "/" + validCodes.length + "）。";
        try {
          cache.set(code, await loadServerProduct(code, session.token, controller.signal));
        } catch (error) {
          if (run !== generation) return;
          if (!getAdminSession()) throw error;
          cache.set(code, { error: String(error?.message || error) });
        }
      }
      if (run !== generation) return;
      rows.forEach(function (r) {
        if (r.errors.length) {
          r.status = "入力エラー";
          return;
        }
        const result = cache.get(r.code);
        if (!result || result.error) {
          r.status = "取得失敗";
          r.errors.push(result?.error || "サーバーから取得できませんでした");
          return;
        }
        if (!result.found) {
          r.status = "商品未登録";
          return;
        }
        if (result.data.stocks.some(function (stock) {
          return !stock || typeof stock.location_name !== "string" || !normalizeLocation(stock.location_name);
        })) {
          r.status = "取得失敗";
          r.errors.push("サーバーの保管場所の形式が不正です");
          return;
        }
        const locationEntries = result.data.stocks.filter(function (stock) {
          return normalizeLocation(stock.location_name) === r.location;
        });
        // APIの値が不正な場合、差異を「0個」と誤表示しない。
        const numbers = locationEntries.map(function (stock) {
          const value = stock.quantity;
          // null・空欄・真偽値等をNumber()で0/1に変換しない。
          if (typeof value !== "number" &&
              (typeof value !== "string" || !/^\d+$/.test(value.trim()))) return NaN;
          return Number(value);
        });
        if (locationEntries.length > 1) {
          r.status = "取得失敗";
          r.errors.push("サーバーの同じ保管場所が重複しています。登録内容を確認してください");
          return;
        }
        if (numbers.some(function (n) { return !Number.isSafeInteger(n) || n < 0; })) {
          r.status = "取得失敗";
          r.errors.push("サーバーの在庫数の形式が不正です");
          return;
        }
        r.serverQuantity = numbers.reduce(function (a, b) { return a + b; }, 0);
        r.difference = r.quantity - r.serverQuantity;
        if (!locationEntries.length) r.status = "保管場所未登録";
        else r.status = r.difference === 0 ? "一致" : "差異あり";
      });
      renderResults(rows);
    } catch (error) {
      if (run !== generation) return;
      element("v2932-stock-message").textContent = "照合できませんでした：" + String(error?.message || error);
    } finally {
      // キャンセル後に開始した別の照合のボタン状態を変更しない。
      if (run === generation) {
        activeController = null;
        setProcessing(false);
      }
    }
  }

  function renderResults(rows) {
    const summary = [
      ["CSV行数", rows.length],
      ["一致", rows.filter(function (r) { return r.status === "一致"; }).length],
      ["差異あり", rows.filter(function (r) { return r.status === "差異あり"; }).length],
      ["商品・場所未登録", rows.filter(function (r) { return r.status === "商品未登録" || r.status === "保管場所未登録"; }).length],
      ["入力・取得エラー", rows.filter(function (r) { return r.status === "入力エラー" || r.status === "取得失敗"; }).length]
    ];
    const counts = element("v2932-stock-counts");
    summary.forEach(function (pair) {
      const card = document.createElement("div");
      const title = document.createElement("span");
      const number = document.createElement("strong");
      title.textContent = pair[0]; number.textContent = pair[1] + "件";
      card.append(title, number); counts.appendChild(card);
    });
    counts.hidden = false;
    const tbody = element("v2932-stock-rows");
    rows.forEach(function (r) {
      const tr = document.createElement("tr");
      tr.className = r.status === "一致" ? "v2932-stock-ok" : r.status === "差異あり" ? "v2932-stock-diff" : "v2932-stock-check-row";
      const values = [
        r.line, r.code, r.location,
        Number.isSafeInteger(r.quantity) && r.quantity >= 0 ? r.quantity : r.rawQuantity,
        r.serverQuantity === null ? "―" : r.serverQuantity,
        r.difference === null ? "―" : (r.difference > 0 ? "+" : "") + r.difference,
        r.status + (r.errors.length ? "：" + r.errors.join("／") : "")
      ];
      values.forEach(function (v) {
        const td = document.createElement("td");
        td.textContent = String(v ?? "");
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    element("v2932-stock-table-wrap").hidden = false;
    renderSelectionPlan(rows);
    element("v2932-stock-message").textContent =
      "照合が完了しました。CSVとサーバーの在庫を比較しただけで、データは一切保存・変更していません。";
  }

  // 現時点では「差異あり」かつ保管場所が明確な行だけを候補にする。
  // 「本社」は集計値のため、どの棚へ反映すべきか判断できず選択不可。
  function isSafeCandidate(row) {
    return row.status === "差異あり" &&
      row.location !== "本社" &&
      KNOWN_LOCATIONS.includes(row.location) &&
      Number.isSafeInteger(row.quantity) &&
      Number.isSafeInteger(row.serverQuantity);
  }

  function renderSelectionPlan(rows) {
    const plan = element("v2933-stock-plan");
    const options = element("v2933-stock-options");
    selectableRows = rows.filter(function (r) { return r.status === "差異あり"; });
    selectedLines.clear();
    options.replaceChildren();
    element("v2933-stock-confirm").hidden = true;
    element("v2933-stock-confirm-rows").replaceChildren();
    plan.hidden = false;
    if (!selectableRows.length) {
      const message = document.createElement("p");
      message.textContent = "差異がある行はありません。反映候補は0件です。";
      options.appendChild(message);
    }
    selectableRows.forEach(function (r) {
      const safe = isSafeCandidate(r);
      const label = document.createElement("label");
      label.className = "v2933-stock-option" + (safe ? "" : " v2933-stock-disabled");
      const input = document.createElement("input");
      input.type = "checkbox";
      input.disabled = !safe;
      input.setAttribute("aria-label", r.code + "・" + r.location + "を反映候補にする");
      const info = document.createElement("span");
      const title = document.createElement("strong");
      title.textContent = r.code + " ／ " + r.location;
      const details = document.createElement("small");
      details.textContent = "サーバー " + r.serverQuantity + "個 → CSV " + r.quantity + "個 （差異 " +
        (r.difference > 0 ? "+" : "") + r.difference + "個）";
      info.append(title, details);
      if (!safe) {
        const caution = document.createElement("small");
        caution.textContent = "この保管場所は直接反映できません。棚・保管場所を確認してください。";
        info.appendChild(caution);
      }
      label.append(input, info);
      options.appendChild(label);
      input.addEventListener("change", function () {
        if (input.checked) selectedLines.add(r.line);
        else selectedLines.delete(r.line);
        updateSelectedCount();
      });
    });
    updateSelectedCount();
  }

  function updateSelectedCount() {
    element("v2933-stock-selection").textContent =
      selectedLines.size + "件選択中（保存・更新はされません）";
    element("v2933-stock-show-plan").disabled = selectedLines.size === 0;
    element("v2933-stock-confirm").hidden = true;
    element("v2933-stock-confirm-rows").replaceChildren();
  }

  function showSelectedPlan() {
    if (!getAdminSession()) {
      resetResult();
      element("v2933-stock-selection").textContent = "管理者として再ログインし、再照合してください。";
      return;
    }
    if (processing) return;
    const preview = element("v2933-stock-confirm-rows");
    preview.replaceChildren();
    const candidates = selectableRows.filter(function (r) {
      return selectedLines.has(r.line) && isSafeCandidate(r);
    });
    if (!candidates.length) return;
    candidates.forEach(function (r) {
      const line = document.createElement("div");
      line.className = "v2933-stock-preview-row";
      line.textContent = r.code + " ／ " + r.location + "：現在 " +
        r.serverQuantity + "個 → CSV " + r.quantity + "個";
      preview.appendChild(line);
    });
    element("v2933-stock-confirm").hidden = false;
    element("v2933-stock-confirm").scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function addStyles() {
    if (element("v2932-stock-style")) return;
    const style = document.createElement("style");
    style.id = "v2932-stock-style";
    style.textContent = `
      #server-stock-csv-preview-screen[hidden], #v2932-stock-counts[hidden], #v2932-stock-table-wrap[hidden], #v2933-stock-plan[hidden], #v2933-stock-confirm[hidden] { display:none!important; }
      .v2932-stock-panel {max-width:980px;margin:12px auto 45px;padding:clamp(15px,3vw,28px);background:#fff;border:1px solid #d7e1e9;border-radius:16px;color:#163349;}
      .v2932-stock-panel h2 {font-size:clamp(21px,3vw,28px);color:#1663bc;line-height:1.45;border-bottom:2px solid #8cc4f5;padding-bottom:12px;}
      .v2932-stock-panel h3 {font-size:19px;margin:0 0 12px;}
      .v2932-stock-panel p {line-height:1.65;}
      .v2932-stock-alert {border-left:4px solid #ee8b09;background:#fff0db;padding:14px;line-height:1.7;margin:14px 0;}
      .v2932-stock-alert strong {display:block;}
      .v2932-stock-box {border:1px solid #d2e0e8;border-radius:12px;padding:16px;margin:14px 0;}
      .v2932-stock-box > p {margin:9px 0;}
      .v2932-stock-help {font-size:13px;color:#486475;}
      #v2932-stock-file {display:block;width:100%;font-size:16px;padding:13px;border:1px solid #b7c7d1;border-radius:8px;margin:15px 0;box-sizing:border-box;}
      #v2932-stock-login, #v2932-stock-check {background:#1264b8;color:#fff;border:0;border-radius:9px;min-height:49px;padding:12px 17px;font-size:16px;font-weight:700;cursor:pointer;}
      #v2932-stock-check:disabled {background:#9bb6c8;cursor:wait;}
      .v2932-stock-back {background:#4e6977;color:#fff;border:0;border-radius:9px;min-height:50px;width:100%;font-size:16px;font-weight:700;cursor:pointer;}
      .v2932-stock-counts {display:grid;grid-template-columns:repeat(auto-fit,minmax(112px,1fr));gap:9px;margin:16px 0;}
      .v2932-stock-counts>div {padding:12px;border:1px solid #d7e4ec;border-radius:8px;display:flex;flex-direction:column;gap:7px;}
      .v2932-stock-counts span {font-size:13px;}
      .v2932-stock-counts strong {font-size:21px;color:#17613c;}
      .v2932-stock-table-wrap {overflow:auto;max-width:100%;border:1px solid #d4dfe7;border-radius:8px;}
      .v2932-stock-table-wrap table {width:100%;min-width:780px;border-collapse:collapse;font-size:14px;}
      .v2932-stock-table-wrap th, .v2932-stock-table-wrap td {border:1px solid #d8e1e7;padding:10px 8px;text-align:left;vertical-align:top;overflow-wrap:anywhere;}
      .v2932-stock-table-wrap th {background:#075f58;color:#fff;}
      .v2932-stock-ok {background:#eff9f1;}
      .v2932-stock-diff {background:#fff3dd;}
      .v2932-stock-check-row {background:#f4f6f8;}
      .v2933-stock-options {display:grid;gap:10px;margin:14px 0;}
      .v2933-stock-option {display:flex;align-items:center;gap:14px;border:1px solid #cbdce7;border-radius:10px;padding:12px;cursor:pointer;}
      .v2933-stock-option input {width:24px;height:24px;flex-shrink:0;accent-color:#1663bc;}
      .v2933-stock-option span {display:grid;gap:5px;min-width:0;overflow-wrap:anywhere;}
      .v2933-stock-option small {font-size:13px;line-height:1.5;}
      .v2933-stock-disabled {background:#f5f6f7;cursor:not-allowed;color:#526574;}
      #v2933-stock-show-plan {min-height:50px;border:0;border-radius:9px;padding:12px 18px;background:#1764b8;color:#fff;font-size:16px;font-weight:700;cursor:pointer;}
      #v2933-stock-show-plan:disabled {background:#a5b4bd;cursor:not-allowed;}
      .v2933-stock-confirm {border:2px solid #1663bc;border-radius:10px;background:#f0f7ff;padding:14px;margin-top:14px;}
      .v2933-stock-confirm h4 {margin:0 0 8px;font-size:17px;}
      .v2933-stock-preview-row {border-top:1px solid #d4e3ef;padding:12px 4px;overflow-wrap:anywhere;}
      @media(max-width:600px){#v2933-stock-show-plan{width:100%;}.v2933-stock-option{padding:12px 8px;}}
      @media(max-width:600px){.v2932-stock-panel{margin:8px auto 25px;padding:12px}.v2932-stock-box{padding:12px}.v2932-stock-panel h2{font-size:21px}#v2932-stock-login,#v2932-stock-check{width:100%}}
    `;
    document.head.appendChild(style);
  }
})();
