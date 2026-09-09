"use strict";

(function () {
  const SCREEN_ID = "disposal-list-screen";
  const BUTTON_ID = "show-disposal-list-button";
  const STATUS_DRAFT = "draft";
  const STATUS_COMPLETED = "completed";

  let products = [];
  let lists = [];
  let currentList = null;
  let selectedProduct = null;
  let pendingPhotoDataUrl = "";
  let rowPhotoTargetIndex = -1;

  document.addEventListener("DOMContentLoaded", initializeDisposalListFeature);

  async function initializeDisposalListFeature() {
    createHomeButton();
    createScreen();
    createStyle();
    bindEvents();

    try {
      products = await getAllProducts();
      sortProducts();
      lists = await getAllDisposalLists();
      sortLists();
      renderSavedLists();
    } catch (error) {
      console.error("廃棄リスト初期化エラー", error);
    }
  }

  function createHomeButton() {
    if (document.querySelector(`#${BUTTON_ID}`)) return;

    const container = document.querySelector("#home-inventory-buttons");
    if (!container) return;

    const button = document.createElement("button");
    button.id = BUTTON_ID;
    button.type = "button";
    button.textContent = "廃棄リストを作成・印刷する";
    container.appendChild(button);
  }

  function createScreen() {
    if (document.querySelector(`#${SCREEN_ID}`)) return;

    const main = document.querySelector("main");
    if (!main) return;

    const section = document.createElement("section");
    section.id = SCREEN_ID;
    section.hidden = true;
    section.innerHTML = `
      <div class="disposal-heading">
        <div>
          <h2>廃棄リスト</h2>
          <p>廃棄する商品を事前に登録して、A4で印刷できます。実際に廃棄する日に「在庫へ反映」を実行します。</p>
        </div>
        <button id="disposal-back-home" type="button" class="disposal-secondary-button">ホームへ戻る</button>
      </div>

      <div class="disposal-guide">
        <strong>おすすめの流れ</strong>
        <span>① 事前にリストを作成 → ② A4で印刷 → ③ 廃棄日に現物確認 → ④ 「廃棄を在庫へ反映」</span>
      </div>

      <div class="disposal-layout">
        <section class="disposal-card disposal-saved-card">
          <div class="disposal-card-heading">
            <h3>保存済みの廃棄リスト</h3>
            <button id="disposal-new-list" type="button">新しい廃棄リストを作る</button>
          </div>
          <div id="disposal-saved-list"></div>
        </section>

        <section id="disposal-editor-card" class="disposal-card" hidden>
          <div class="disposal-editor-heading">
            <div>
              <h3 id="disposal-editor-title">新しい廃棄リスト</h3>
              <p id="disposal-editor-status" class="disposal-status-text"></p>
            </div>
            <div class="disposal-editor-actions-top">
              <button id="disposal-save-list" type="button">下書きを保存</button>
              <button id="disposal-print-list" type="button" class="disposal-print-button">A4で印刷</button>
            </div>
          </div>

          <div class="disposal-meta-grid">
            <label>
              <span>廃棄予定日 <strong class="required-mark">必須</strong></span>
              <input id="disposal-planned-date" type="date">
            </label>
            <label>
              <span>担当者</span>
              <input id="disposal-person" type="text" maxlength="60" placeholder="例：山田">
            </label>
            <label class="disposal-meta-wide">
              <span>メモ</span>
              <textarea id="disposal-memo" rows="2" maxlength="300" placeholder="廃棄理由や確認事項など"></textarea>
            </label>
          </div>

          <section id="disposal-add-area" class="disposal-add-area">
            <h4>商品をリストへ追加</h4>

            <div class="disposal-search-row">
              <label class="disposal-search-label">
                <span>商品検索</span>
                <input id="disposal-product-search" type="search" placeholder="社内コード・商品コード・JAN・商品名">
              </label>
              <button id="disposal-product-search-button" type="button">検索</button>
            </div>

            <div id="disposal-search-results" class="disposal-search-results" hidden></div>

            <div id="disposal-selected-product" class="disposal-selected-product" hidden>
              <div class="disposal-product-info">
                <strong id="disposal-selected-name"></strong>
                <span id="disposal-selected-codes"></span>
              </div>

              <div class="disposal-add-grid">
                <label>
                  <span>廃棄元の保管場所 <strong class="required-mark">必須</strong></span>
                  <select id="disposal-location"></select>
                </label>
                <label>
                  <span>数量 <strong class="required-mark">必須</strong></span>
                  <input id="disposal-quantity" type="number" min="1" step="1" inputmode="numeric" value="1">
                </label>
                <div class="disposal-photo-input-block">
                  <span>商品写真</span>
                  <div class="disposal-photo-controls">
                    <button id="disposal-select-photo" type="button" class="disposal-secondary-button">写真を選ぶ</button>
                    <span id="disposal-photo-status">写真なし</span>
                  </div>
                  <input id="disposal-photo-file" type="file" accept="image/*" capture="environment" hidden>
                </div>
              </div>

              <div class="disposal-photo-preview-wrap">
                <img id="disposal-photo-preview" alt="商品写真プレビュー" hidden>
              </div>

              <button id="disposal-add-item" type="button" class="disposal-add-button">この商品をリストへ追加</button>
            </div>
          </section>

          <div class="disposal-table-wrap">
            <table class="disposal-table">
              <thead>
                <tr>
                  <th>社内コード</th>
                  <th>商品コード</th>
                  <th>数量</th>
                  <th>商品写真</th>
                  <th>廃棄元</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody id="disposal-item-body"></tbody>
            </table>
          </div>
          <p id="disposal-empty-items" class="disposal-empty-message">まだ商品が追加されていません。</p>

          <div class="disposal-bottom-actions">
            <button id="disposal-save-list-bottom" type="button">下書きを保存</button>
            <button id="disposal-print-list-bottom" type="button" class="disposal-print-button">A4で印刷</button>
            <button id="disposal-apply-stock" type="button" class="disposal-danger-button">廃棄を在庫へ反映</button>
            <button id="disposal-delete-list" type="button" class="disposal-delete-button">このリストを削除</button>
          </div>
          <p class="disposal-stock-note">在庫へ反映すると、各商品の選択した保管場所から数量を減らし、入出庫履歴へ「出庫／廃棄」として記録します。反映済みのリストは再反映できません。</p>
        </section>
      </div>

      <input id="disposal-row-photo-file" type="file" accept="image/*" capture="environment" hidden>
    `;

    main.appendChild(section);
  }

  function createStyle() {
    if (document.querySelector("#disposal-list-style")) return;

    const style = document.createElement("style");
    style.id = "disposal-list-style";
    style.textContent = `
      #${BUTTON_ID} { background: #b54a20; }
      #${SCREEN_ID} { max-width: 1180px; margin: 0 auto; padding: 18px; }
      .disposal-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 14px; }
      .disposal-heading h2 { margin: 0 0 8px; font-size: 1.7rem; }
      .disposal-heading p { margin: 0; line-height: 1.6; }
      .disposal-guide { display: flex; flex-wrap: wrap; gap: 8px 16px; margin-bottom: 16px; padding: 14px 16px; border: 2px solid #e5a52d; border-radius: 12px; background: #fff8e8; }
      .disposal-layout { display: grid; gap: 16px; }
      .disposal-card { padding: 16px; border: 1px solid #ccd6df; border-radius: 14px; background: #fff; box-shadow: 0 2px 8px rgba(0,0,0,.05); }
      .disposal-card-heading, .disposal-editor-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 14px; }
      .disposal-card h3, .disposal-card h4 { margin: 0; }
      .disposal-editor-actions-top, .disposal-bottom-actions { display: flex; flex-wrap: wrap; gap: 10px; }
      .disposal-card button { min-height: 44px; padding: 10px 16px; border: 0; border-radius: 9px; font-weight: 700; cursor: pointer; background: #1769c2; color: #fff; }
      .disposal-card button:disabled { opacity: .5; cursor: not-allowed; }
      .disposal-secondary-button { background: #526d7a !important; }
      .disposal-print-button { background: #365d68 !important; }
      .disposal-danger-button { background: #c62828 !important; }
      .disposal-delete-button { background: #666 !important; }
      .disposal-add-button { width: 100%; margin-top: 12px; background: #247a3e !important; }
      .disposal-meta-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
      .disposal-meta-grid label, .disposal-add-grid label, .disposal-search-label { display: grid; gap: 6px; font-weight: 700; }
      .disposal-meta-wide { grid-column: 1 / -1; }
      .disposal-meta-grid input, .disposal-meta-grid textarea, .disposal-add-grid input, .disposal-add-grid select, .disposal-search-label input { width: 100%; min-height: 46px; padding: 10px 12px; border: 1px solid #aebbc5; border-radius: 8px; font: inherit; background: #fff; }
      .disposal-meta-grid textarea { min-height: 72px; resize: vertical; }
      .required-mark { color: #c62828; font-size: .82em; }
      .disposal-add-area { margin-top: 18px; padding: 14px; border: 1px solid #b8d3ea; border-radius: 12px; background: #f7fbff; }
      .disposal-search-row { display: grid; grid-template-columns: 1fr auto; align-items: end; gap: 10px; margin-top: 12px; }
      .disposal-search-results { display: grid; gap: 7px; max-height: 280px; overflow-y: auto; margin-top: 10px; padding: 8px; border: 1px solid #c7d8e8; border-radius: 9px; background: #fff; }
      .disposal-search-result { display: grid; grid-template-columns: 1fr auto; gap: 8px; align-items: center; padding: 9px 10px; border: 1px solid #d9e1e8; border-radius: 8px; }
      .disposal-search-result strong { display: block; }
      .disposal-search-result small { display: block; margin-top: 3px; color: #536873; }
      .disposal-search-result button { min-height: 38px; padding: 7px 12px; }
      .disposal-selected-product { margin-top: 12px; padding: 12px; border: 2px solid #83b6dd; border-radius: 10px; background: #fff; }
      .disposal-product-info { display: grid; gap: 4px; margin-bottom: 12px; }
      .disposal-product-info strong { font-size: 1.12rem; }
      .disposal-product-info span { color: #455a64; }
      .disposal-add-grid { display: grid; grid-template-columns: 1fr 140px 1fr; gap: 12px; align-items: end; }
      .disposal-photo-input-block { display: grid; gap: 6px; font-weight: 700; }
      .disposal-photo-controls { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
      .disposal-photo-controls span { font-size: .9rem; color: #52646e; }
      .disposal-photo-preview-wrap { margin-top: 10px; }
      #disposal-photo-preview { width: 120px; height: 90px; object-fit: contain; border: 1px solid #c7c7c7; border-radius: 7px; background: #f5f5f5; }
      .disposal-table-wrap { overflow-x: auto; margin-top: 18px; }
      .disposal-table { width: 100%; min-width: 820px; border-collapse: collapse; }
      .disposal-table th, .disposal-table td { padding: 9px 8px; border: 1px solid #d2d9df; text-align: left; vertical-align: middle; }
      .disposal-table th { background: #eef4f8; white-space: nowrap; }
      .disposal-table td:nth-child(3) { text-align: right; font-weight: 800; }
      .disposal-thumb, .disposal-photo-placeholder { width: 72px; height: 58px; border-radius: 5px; border: 1px solid #ccc; background: #f4f4f4; }
      .disposal-thumb { object-fit: contain; }
      .disposal-photo-placeholder { display: grid; place-items: center; color: #777; font-size: .78rem; }
      .disposal-row-actions { display: flex; flex-wrap: wrap; gap: 6px; }
      .disposal-row-actions button { min-height: 36px; padding: 6px 9px; font-size: .85rem; }
      .disposal-row-actions .remove { background: #777; }
      .disposal-empty-message { padding: 18px 10px; text-align: center; color: #647680; }
      .disposal-bottom-actions { margin-top: 16px; }
      .disposal-stock-note { margin: 12px 0 0; padding: 10px 12px; border-radius: 8px; background: #fff3e0; line-height: 1.55; }
      .disposal-status-text { margin: 5px 0 0; color: #52646e; }
      .disposal-status-badge { display: inline-block; padding: 3px 8px; border-radius: 999px; font-size: .82rem; font-weight: 800; }
      .disposal-status-draft { background: #fff3cd; color: #805d00; }
      .disposal-status-completed { background: #d9f2df; color: #17612b; }
      .disposal-saved-list-grid { display: grid; gap: 9px; }
      .disposal-saved-row { display: grid; grid-template-columns: minmax(0,1fr) auto; gap: 10px; align-items: center; padding: 11px 12px; border: 1px solid #d7dfe5; border-radius: 9px; }
      .disposal-saved-main { display: grid; gap: 4px; }
      .disposal-saved-main strong { font-size: 1.02rem; }
      .disposal-saved-main small { color: #596b74; }
      .disposal-saved-actions { display: flex; gap: 7px; flex-wrap: wrap; }
      .disposal-saved-actions button { min-height: 38px; padding: 7px 11px; }
      .disposal-list-empty { padding: 16px 4px; color: #677983; }
      .disposal-completed-lock { padding: 10px 12px; border-radius: 9px; background: #e8f5e9; color: #245b2e; font-weight: 700; margin-top: 12px; }
      @media (max-width: 760px) {
        #${SCREEN_ID} { padding: 10px; }
        .disposal-heading, .disposal-card-heading, .disposal-editor-heading { align-items: stretch; flex-direction: column; }
        .disposal-meta-grid, .disposal-add-grid { grid-template-columns: 1fr; }
        .disposal-search-row { grid-template-columns: 1fr; }
        .disposal-saved-row { grid-template-columns: 1fr; }
        .disposal-card button { font-size: 1rem; }
      }
    `;
    document.head.appendChild(style);
  }

  function bindEvents() {
    const showButton = document.querySelector(`#${BUTTON_ID}`);
    const backButton = document.querySelector("#disposal-back-home");
    const newButton = document.querySelector("#disposal-new-list");
    const searchButton = document.querySelector("#disposal-product-search-button");
    const searchInput = document.querySelector("#disposal-product-search");
    const selectPhotoButton = document.querySelector("#disposal-select-photo");
    const photoInput = document.querySelector("#disposal-photo-file");
    const rowPhotoInput = document.querySelector("#disposal-row-photo-file");
    const addButton = document.querySelector("#disposal-add-item");
    const saveTop = document.querySelector("#disposal-save-list");
    const saveBottom = document.querySelector("#disposal-save-list-bottom");
    const printTop = document.querySelector("#disposal-print-list");
    const printBottom = document.querySelector("#disposal-print-list-bottom");
    const applyButton = document.querySelector("#disposal-apply-stock");
    const deleteButton = document.querySelector("#disposal-delete-list");

    if (showButton) showButton.addEventListener("click", openDisposalScreen);
    if (backButton) backButton.addEventListener("click", closeDisposalScreen);
    if (newButton) newButton.addEventListener("click", createNewList);
    if (searchButton) searchButton.addEventListener("click", runProductSearch);
    if (searchInput) {
      searchInput.addEventListener("keydown", function (event) {
        if (event.key === "Enter") {
          event.preventDefault();
          runProductSearch();
        }
      });
    }
    if (selectPhotoButton && photoInput) {
      selectPhotoButton.addEventListener("click", function () {
        photoInput.value = "";
        photoInput.click();
      });
      photoInput.addEventListener("change", handlePendingPhoto);
    }
    if (rowPhotoInput) rowPhotoInput.addEventListener("change", handleRowPhoto);
    if (addButton) addButton.addEventListener("click", addSelectedProductToList);
    if (saveTop) saveTop.addEventListener("click", saveCurrentList);
    if (saveBottom) saveBottom.addEventListener("click", saveCurrentList);
    if (printTop) printTop.addEventListener("click", printCurrentList);
    if (printBottom) printBottom.addEventListener("click", printCurrentList);
    if (applyButton) applyButton.addEventListener("click", applyCurrentListToStock);
    if (deleteButton) deleteButton.addEventListener("click", deleteCurrentList);
  }

  async function openDisposalScreen() {
    document.querySelectorAll("main > section").forEach(function (section) {
      section.hidden = true;
    });

    const screen = document.querySelector(`#${SCREEN_ID}`);
    if (screen) screen.hidden = false;

    try {
      products = await getAllProducts();
      sortProducts();
      lists = await getAllDisposalLists();
      sortLists();
      renderSavedLists();
    } catch (error) {
      console.error(error);
      await showDisposalDialog({
        type: "danger",
        icon: "⚠️",
        title: "廃棄リストを読み込めませんでした",
        message: "データの読み込み中にエラーが発生しました。",
        confirmText: "閉じる"
      });
    }

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function closeDisposalScreen() {
    const screen = document.querySelector(`#${SCREEN_ID}`);
    if (screen) screen.hidden = true;

    if (window.inventoryApp && typeof window.inventoryApp.showScreen === "function") {
      window.inventoryApp.showScreen("home");
    } else {
      const home = document.querySelector("#home");
      if (home) home.hidden = false;
    }

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function createNewList() {
    const now = new Date();
    currentList = {
      id: createDisposalListId(),
      plannedDate: formatInputDate(now),
      person: "",
      memo: "",
      status: STATUS_DRAFT,
      items: [],
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      completedAt: ""
    };
    selectedProduct = null;
    pendingPhotoDataUrl = "";
    renderEditor();
    const card = document.querySelector("#disposal-editor-card");
    if (card) card.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function openSavedList(id) {
    const source = lists.find(function (list) { return list.id === id; });
    if (!source) return;

    currentList = deepClone(source);
    selectedProduct = null;
    pendingPhotoDataUrl = "";
    renderEditor();
    const card = document.querySelector("#disposal-editor-card");
    if (card) card.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function renderEditor() {
    const card = document.querySelector("#disposal-editor-card");
    if (!card || !currentList) return;

    card.hidden = false;

    const completed = currentList.status === STATUS_COMPLETED;
    setValue("#disposal-planned-date", currentList.plannedDate || "");
    setValue("#disposal-person", currentList.person || "");
    setValue("#disposal-memo", currentList.memo || "");

    const title = document.querySelector("#disposal-editor-title");
    if (title) title.textContent = completed ? "廃棄リスト（反映済み）" : "廃棄リスト（下書き）";

    const status = document.querySelector("#disposal-editor-status");
    if (status) {
      status.innerHTML = completed
        ? `<span class="disposal-status-badge disposal-status-completed">在庫反映済み</span> ${escapeHtml(formatDateTime(currentList.completedAt))}`
        : `<span class="disposal-status-badge disposal-status-draft">下書き</span> 廃棄予定日まで内容を編集できます。`;
    }

    ["#disposal-planned-date", "#disposal-person", "#disposal-memo"].forEach(function (selector) {
      const element = document.querySelector(selector);
      if (element) element.disabled = completed;
    });

    const addArea = document.querySelector("#disposal-add-area");
    if (addArea) addArea.hidden = completed;

    ["#disposal-save-list", "#disposal-save-list-bottom", "#disposal-apply-stock", "#disposal-delete-list"].forEach(function (selector) {
      const element = document.querySelector(selector);
      if (element) element.hidden = completed;
    });

    const deleteButton = document.querySelector("#disposal-delete-list");
    if (deleteButton) deleteButton.hidden = completed;

    resetProductSelection();
    renderItems();
  }

  function renderSavedLists() {
    const container = document.querySelector("#disposal-saved-list");
    if (!container) return;

    if (!lists.length) {
      container.innerHTML = '<p class="disposal-list-empty">保存済みの廃棄リストはありません。</p>';
      return;
    }

    container.innerHTML = '<div class="disposal-saved-list-grid"></div>';
    const grid = container.firstElementChild;

    lists.forEach(function (list) {
      const row = document.createElement("div");
      row.className = "disposal-saved-row";

      const main = document.createElement("div");
      main.className = "disposal-saved-main";
      const itemCount = Array.isArray(list.items) ? list.items.length : 0;
      const qty = (Array.isArray(list.items) ? list.items : []).reduce(function (sum, item) {
        return sum + normalizePositiveInteger(item.quantity);
      }, 0);
      main.innerHTML = `
        <strong>${escapeHtml(formatDate(list.plannedDate))} 廃棄予定</strong>
        <span>${list.status === STATUS_COMPLETED
          ? '<span class="disposal-status-badge disposal-status-completed">反映済み</span>'
          : '<span class="disposal-status-badge disposal-status-draft">下書き</span>'}</span>
        <small>${itemCount}商品 / 合計 ${qty.toLocaleString("ja-JP")}個${list.person ? ` / 担当 ${escapeHtml(list.person)}` : ""}</small>
      `;

      const actions = document.createElement("div");
      actions.className = "disposal-saved-actions";
      const openButton = document.createElement("button");
      openButton.type = "button";
      openButton.textContent = list.status === STATUS_COMPLETED ? "内容を見る" : "編集する";
      openButton.addEventListener("click", function () { openSavedList(list.id); });
      actions.appendChild(openButton);

      const printButton = document.createElement("button");
      printButton.type = "button";
      printButton.className = "disposal-print-button";
      printButton.textContent = "印刷";
      printButton.addEventListener("click", function () { printList(list); });
      actions.appendChild(printButton);

      row.appendChild(main);
      row.appendChild(actions);
      grid.appendChild(row);
    });
  }

  function sortLists() {
    lists.sort(function (a, b) {
      if (a.status !== b.status) return a.status === STATUS_DRAFT ? -1 : 1;
      const dateCompare = String(a.plannedDate || "").localeCompare(String(b.plannedDate || ""));
      if (dateCompare !== 0) return dateCompare;
      return String(b.updatedAt || "").localeCompare(String(a.updatedAt || ""));
    });
  }

  function sortProducts() {
    products.sort(function (a, b) {
      return String(a.internalCode || "").localeCompare(String(b.internalCode || ""), "ja", { numeric: true });
    });
  }

  function runProductSearch() {
    if (!currentList || currentList.status === STATUS_COMPLETED) return;

    const input = document.querySelector("#disposal-product-search");
    const query = normalizeSearchText(input ? input.value : "");
    const resultsContainer = document.querySelector("#disposal-search-results");
    if (!resultsContainer) return;

    if (!query) {
      resultsContainer.hidden = false;
      resultsContainer.innerHTML = '<div class="disposal-list-empty">検索する文字を入力してください。</div>';
      return;
    }

    const matches = products.filter(function (product) {
      const fields = [
        product.internalCode,
        product.productCode,
        product.janCode,
        product.productName
      ].map(normalizeSearchText);
      return fields.some(function (field) { return field.includes(query); });
    }).slice(0, 30);

    resultsContainer.hidden = false;
    resultsContainer.innerHTML = "";

    if (!matches.length) {
      resultsContainer.innerHTML = '<div class="disposal-list-empty">該当する商品が見つかりませんでした。</div>';
      return;
    }

    matches.forEach(function (product) {
      const row = document.createElement("div");
      row.className = "disposal-search-result";
      const info = document.createElement("div");
      info.innerHTML = `
        <strong>${escapeHtml(product.productName || "商品名なし")}</strong>
        <small>社内コード：${escapeHtml(product.internalCode || "")} / 商品コード：${escapeHtml(product.productCode || "-")} / 在庫：${normalizeStock(product.stock).toLocaleString("ja-JP")}個</small>
      `;
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = "選択";
      button.addEventListener("click", function () { selectProduct(product); });
      row.appendChild(info);
      row.appendChild(button);
      resultsContainer.appendChild(row);
    });
  }

  function selectProduct(product) {
    selectedProduct = product;
    pendingPhotoDataUrl = "";

    const box = document.querySelector("#disposal-selected-product");
    if (box) box.hidden = false;

    const name = document.querySelector("#disposal-selected-name");
    if (name) name.textContent = product.productName || "商品名なし";

    const codes = document.querySelector("#disposal-selected-codes");
    if (codes) {
      codes.textContent = `社内コード：${product.internalCode || ""} / 商品コード：${product.productCode || "-"} / JAN：${product.janCode || "-"}`;
    }

    const locationSelect = document.querySelector("#disposal-location");
    if (locationSelect) {
      locationSelect.innerHTML = "";
      const entries = getProductLocationStocks(product);
      const baseLocations = ["本社", "酒本倉庫1階", "酒本倉庫2階"];
      baseLocations.forEach(function (location) {
        const entry = entries.find(function (item) { return getInventoryBaseLocationName(item.location) === location; });
        const option = document.createElement("option");
        option.value = location;
        option.textContent = `${location}（現在 ${entry ? normalizeStock(entry.stock).toLocaleString("ja-JP") : "0"}個）`;
        locationSelect.appendChild(option);
      });

      const primary = getInventoryBaseLocationName(product.location);
      if (baseLocations.includes(primary)) locationSelect.value = primary;
    }

    const quantity = document.querySelector("#disposal-quantity");
    if (quantity) quantity.value = "1";

    updatePendingPhotoPreview();

    const results = document.querySelector("#disposal-search-results");
    if (results) results.hidden = true;
  }

  function resetProductSelection() {
    selectedProduct = null;
    pendingPhotoDataUrl = "";
    const box = document.querySelector("#disposal-selected-product");
    if (box) box.hidden = true;
    const search = document.querySelector("#disposal-product-search");
    if (search) search.value = "";
    const results = document.querySelector("#disposal-search-results");
    if (results) {
      results.hidden = true;
      results.innerHTML = "";
    }
    updatePendingPhotoPreview();
  }

  async function handlePendingPhoto(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    try {
      pendingPhotoDataUrl = await compressImageFile(file);
      updatePendingPhotoPreview();
    } catch (error) {
      console.error(error);
      await showDisposalDialog({
        type: "danger",
        icon: "⚠️",
        title: "写真を読み込めませんでした",
        message: "別の画像を選んでもう一度お試しください。",
        confirmText: "閉じる"
      });
    }
  }

  function updatePendingPhotoPreview() {
    const preview = document.querySelector("#disposal-photo-preview");
    const status = document.querySelector("#disposal-photo-status");
    if (!preview || !status) return;

    if (pendingPhotoDataUrl) {
      preview.src = pendingPhotoDataUrl;
      preview.hidden = false;
      status.textContent = "写真あり";
    } else {
      preview.removeAttribute("src");
      preview.hidden = true;
      status.textContent = "写真なし";
    }
  }

  function addSelectedProductToList() {
    if (!currentList || currentList.status === STATUS_COMPLETED || !selectedProduct) return;

    syncMetaFromInputs();

    const location = String(document.querySelector("#disposal-location")?.value || "").trim();
    const quantity = normalizePositiveInteger(document.querySelector("#disposal-quantity")?.value);

    if (!location) {
      void showDisposalDialog({
        type: "warning",
        icon: "⚠️",
        title: "廃棄元を選んでください",
        message: "在庫を減らす保管場所を選んでください。",
        confirmText: "閉じる"
      });
      return;
    }

    if (quantity < 1) {
      void showDisposalDialog({
        type: "warning",
        icon: "⚠️",
        title: "数量を確認してください",
        message: "廃棄数量は1個以上で入力してください。",
        confirmText: "閉じる"
      });
      return;
    }

    const duplicate = currentList.items.find(function (item) {
      return item.internalCode === selectedProduct.internalCode && item.location === location;
    });

    if (duplicate) {
      duplicate.quantity = normalizePositiveInteger(duplicate.quantity) + quantity;
      if (pendingPhotoDataUrl) duplicate.photoDataUrl = pendingPhotoDataUrl;
      duplicate.updatedAt = new Date().toISOString();
    } else {
      currentList.items.push({
        internalCode: selectedProduct.internalCode || "",
        productCode: selectedProduct.productCode || "",
        productName: selectedProduct.productName || "",
        janCode: selectedProduct.janCode || "",
        quantity: quantity,
        location: location,
        photoDataUrl: pendingPhotoDataUrl || "",
        addedAt: new Date().toISOString()
      });
    }

    currentList.updatedAt = new Date().toISOString();
    renderItems();
    resetProductSelection();
  }

  function renderItems() {
    const body = document.querySelector("#disposal-item-body");
    const empty = document.querySelector("#disposal-empty-items");
    if (!body || !empty || !currentList) return;

    body.innerHTML = "";
    const completed = currentList.status === STATUS_COMPLETED;
    const items = Array.isArray(currentList.items) ? currentList.items : [];
    empty.hidden = items.length > 0;

    items.forEach(function (item, index) {
      const tr = document.createElement("tr");

      const internal = document.createElement("td");
      internal.textContent = item.internalCode || "";
      tr.appendChild(internal);

      const product = document.createElement("td");
      product.innerHTML = `<strong>${escapeHtml(item.productCode || "-")}</strong><br><small>${escapeHtml(item.productName || "")}</small>`;
      tr.appendChild(product);

      const quantity = document.createElement("td");
      if (completed) {
        quantity.textContent = `${normalizePositiveInteger(item.quantity).toLocaleString("ja-JP")}個`;
      } else {
        const input = document.createElement("input");
        input.type = "number";
        input.min = "1";
        input.step = "1";
        input.value = String(normalizePositiveInteger(item.quantity) || 1);
        input.style.width = "90px";
        input.addEventListener("change", function () {
          item.quantity = Math.max(1, normalizePositiveInteger(input.value));
          input.value = String(item.quantity);
          currentList.updatedAt = new Date().toISOString();
        });
        quantity.appendChild(input);
      }
      tr.appendChild(quantity);

      const photo = document.createElement("td");
      if (item.photoDataUrl) {
        const img = document.createElement("img");
        img.className = "disposal-thumb";
        img.src = item.photoDataUrl;
        img.alt = "商品写真";
        photo.appendChild(img);
      } else {
        const placeholder = document.createElement("div");
        placeholder.className = "disposal-photo-placeholder";
        placeholder.textContent = "写真なし";
        photo.appendChild(placeholder);
      }
      tr.appendChild(photo);

      const location = document.createElement("td");
      location.textContent = item.location || "";
      tr.appendChild(location);

      const actions = document.createElement("td");
      actions.className = "disposal-row-actions";
      if (completed) {
        actions.textContent = "反映済み";
      } else {
        const photoButton = document.createElement("button");
        photoButton.type = "button";
        photoButton.className = "disposal-secondary-button";
        photoButton.textContent = item.photoDataUrl ? "写真変更" : "写真追加";
        photoButton.addEventListener("click", function () {
          rowPhotoTargetIndex = index;
          const input = document.querySelector("#disposal-row-photo-file");
          if (input) {
            input.value = "";
            input.click();
          }
        });
        actions.appendChild(photoButton);

        const removeButton = document.createElement("button");
        removeButton.type = "button";
        removeButton.className = "remove";
        removeButton.textContent = "削除";
        removeButton.addEventListener("click", function () {
          currentList.items.splice(index, 1);
          currentList.updatedAt = new Date().toISOString();
          renderItems();
        });
        actions.appendChild(removeButton);
      }
      tr.appendChild(actions);

      body.appendChild(tr);
    });
  }

  async function handleRowPhoto(event) {
    const file = event.target.files && event.target.files[0];
    if (!file || !currentList || rowPhotoTargetIndex < 0 || !currentList.items[rowPhotoTargetIndex]) return;

    try {
      currentList.items[rowPhotoTargetIndex].photoDataUrl = await compressImageFile(file);
      currentList.updatedAt = new Date().toISOString();
      renderItems();
    } catch (error) {
      console.error(error);
      await showDisposalDialog({
        type: "danger",
        icon: "⚠️",
        title: "写真を読み込めませんでした",
        message: "別の画像を選んでもう一度お試しください。",
        confirmText: "閉じる"
      });
    } finally {
      rowPhotoTargetIndex = -1;
    }
  }

  async function saveCurrentList() {
    if (!currentList || currentList.status === STATUS_COMPLETED) return;

    syncMetaFromInputs();
    if (!validateListForSave()) return;

    currentList.updatedAt = new Date().toISOString();

    try {
      await saveDisposalList(deepClone(currentList));
      await reloadLists();
      await showDisposalDialog({
        type: "success",
        icon: "✅",
        title: "廃棄リストを保存しました",
        message: "廃棄日まで下書きとして編集できます。",
        details: [
          { label: "廃棄予定日", value: formatDate(currentList.plannedDate) },
          { label: "商品数", value: `${currentList.items.length}商品` },
          { label: "合計数量", value: `${getListTotalQuantity(currentList).toLocaleString("ja-JP")}個` }
        ],
        confirmText: "閉じる"
      });
    } catch (error) {
      console.error(error);
      await showDisposalDialog({
        type: "danger",
        icon: "⚠️",
        title: "廃棄リストを保存できませんでした",
        message: "保存中にエラーが発生しました。",
        confirmText: "閉じる"
      });
    }
  }

  function validateListForSave() {
    if (!currentList.plannedDate) {
      void showDisposalDialog({
        type: "warning",
        icon: "⚠️",
        title: "廃棄予定日を入力してください",
        message: "廃棄リストには廃棄予定日が必要です。",
        confirmText: "閉じる"
      });
      return false;
    }

    if (!Array.isArray(currentList.items) || !currentList.items.length) {
      void showDisposalDialog({
        type: "warning",
        icon: "⚠️",
        title: "商品を追加してください",
        message: "廃棄する商品を1件以上リストへ追加してください。",
        confirmText: "閉じる"
      });
      return false;
    }

    return true;
  }

  async function deleteCurrentList() {
    if (!currentList || currentList.status === STATUS_COMPLETED) return;

    const confirmed = await showDisposalDialog({
      type: "danger",
      icon: "🗑️",
      title: "この廃棄リストを削除しますか？",
      message: "下書きの廃棄リストを削除します。在庫には影響しません。",
      isConfirm: true,
      cancelText: "戻る",
      confirmText: "削除する"
    });

    if (!confirmed) return;

    try {
      await deleteDisposalList(currentList.id);
      currentList = null;
      const card = document.querySelector("#disposal-editor-card");
      if (card) card.hidden = true;
      await reloadLists();
    } catch (error) {
      console.error(error);
      await showDisposalDialog({
        type: "danger",
        icon: "⚠️",
        title: "廃棄リストを削除できませんでした",
        message: "画面を更新してもう一度お試しください。",
        confirmText: "閉じる"
      });
    }
  }

  async function applyCurrentListToStock() {
    if (!currentList || currentList.status === STATUS_COMPLETED) return;

    syncMetaFromInputs();
    if (!validateListForSave()) return;

    if (!String(currentList.person || "").trim()) {
      await showDisposalDialog({
        type: "warning",
        icon: "⚠️",
        title: "担当者を入力してください",
        message: "在庫履歴へ記録するため、廃棄を実行する担当者名を入力してください。",
        confirmText: "閉じる"
      });
      return;
    }

    let latestProducts;
    try {
      latestProducts = await getAllProducts();
    } catch (error) {
      console.error(error);
      await showDisposalDialog({
        type: "danger",
        icon: "⚠️",
        title: "現在庫を確認できませんでした",
        message: "画面を更新してもう一度お試しください。",
        confirmText: "閉じる"
      });
      return;
    }

    const prepared = prepareDisposalStockChanges(latestProducts, currentList);
    if (prepared.errors.length) {
      await showDisposalDialog({
        type: "warning",
        icon: "⚠️",
        title: "在庫を反映できない商品があります",
        message: "現在庫を確認して、数量または廃棄元を修正してください。",
        details: prepared.errors.slice(0, 12).map(function (text, index) {
          return { label: `${index + 1}`, value: text };
        }),
        notice: prepared.errors.length > 12 ? `ほか ${prepared.errors.length - 12}件あります。` : "",
        confirmText: "確認して閉じる"
      });
      return;
    }

    const todayText = formatInputDate(new Date());
    const dateNotice = currentList.plannedDate !== todayText
      ? `廃棄予定日は ${formatDate(currentList.plannedDate)} です。今日は ${formatDate(todayText)} ですが、このまま今日の在庫へ反映します。`
      : "本日の廃棄として在庫へ反映します。";

    const confirmed = await showDisposalDialog({
      type: "danger",
      icon: "⚠️",
      title: "廃棄を在庫へ反映しますか？",
      message: "確定すると、選択した保管場所の在庫を減らし、入出庫履歴へ「出庫／廃棄」として記録します。",
      details: [
        { label: "廃棄予定日", value: formatDate(currentList.plannedDate) },
        { label: "商品数", value: `${currentList.items.length}商品` },
        { label: "合計数量", value: `${getListTotalQuantity(currentList).toLocaleString("ja-JP")}個` },
        { label: "担当者", value: currentList.person }
      ],
      notice: `${dateNotice} この操作は一括で実行され、同じリストを再度反映することはできません。`,
      isConfirm: true,
      cancelText: "戻る",
      confirmText: "廃棄を在庫へ反映する"
    });

    if (!confirmed) return;

    const completedAt = new Date().toISOString();
    const completedList = {
      ...deepClone(currentList),
      status: STATUS_COMPLETED,
      completedAt: completedAt,
      updatedAt: completedAt,
      items: currentList.items.map(function (item) {
        const applied = prepared.appliedItemMap.get(makeItemKey(item));
        return {
          ...deepClone(item),
          appliedAt: completedAt,
          appliedBeforeStock: applied ? applied.beforeStock : null,
          appliedAfterStock: applied ? applied.afterStock : null,
          appliedBeforeLocationStock: applied ? applied.beforeLocationStock : null,
          appliedAfterLocationStock: applied ? applied.afterLocationStock : null
        };
      })
    };

    try {
      await completeDisposalList(completedList, prepared.updatedProducts, prepared.movements);

      prepared.updatedProducts.forEach(function (product) {
        if (window.inventoryApp && typeof window.inventoryApp.applyUpdatedProduct === "function") {
          window.inventoryApp.applyUpdatedProduct(product);
        }
      });

      currentList = deepClone(completedList);
      await reloadLists();
      renderEditor();

      await showDisposalDialog({
        type: "success",
        icon: "✅",
        title: "廃棄を在庫へ反映しました",
        message: "在庫数を更新し、入出庫履歴へ「出庫／廃棄」として記録しました。",
        details: [
          { label: "商品数", value: `${currentList.items.length}商品` },
          { label: "廃棄数量", value: `${getListTotalQuantity(currentList).toLocaleString("ja-JP")}個` }
        ],
        notice: "この廃棄リストは反映済みとして保存されています。",
        confirmText: "閉じる"
      });
    } catch (error) {
      console.error("廃棄反映エラー", error);
      await showDisposalDialog({
        type: "danger",
        icon: "⚠️",
        title: "廃棄を在庫へ反映できませんでした",
        message: "在庫更新中にエラーが発生しました。",
        notice: "一括処理が完了していない場合は変更されません。画面を更新して現在庫と履歴を確認してください。",
        confirmText: "閉じる"
      });
    }
  }

  function prepareDisposalStockChanges(latestProducts, list) {
    const errors = [];
    const productMap = new Map(latestProducts.map(function (product) {
      return [String(product.internalCode || ""), deepClone(product)];
    }));
    const touched = new Map();
    const movements = [];
    const appliedItemMap = new Map();
    const nowIso = new Date().toISOString();

    (list.items || []).forEach(function (item, index) {
      const internalCode = String(item.internalCode || "");
      const quantity = normalizePositiveInteger(item.quantity);
      const location = getInventoryBaseLocationName(item.location);
      const product = touched.get(internalCode) || productMap.get(internalCode);

      if (!product) {
        errors.push(`${internalCode || "社内コード不明"}：商品が登録されていません。`);
        return;
      }
      if (quantity < 1) {
        errors.push(`${internalCode}：数量が正しくありません。`);
        return;
      }
      if (!["本社", "酒本倉庫1階", "酒本倉庫2階"].includes(location)) {
        errors.push(`${internalCode}：廃棄元の保管場所が正しくありません。`);
        return;
      }

      const locationStocks = getProductLocationStocks(product).map(function (entry) {
        return { location: getInventoryBaseLocationName(entry.location), stock: normalizeStock(entry.stock) };
      });
      let entry = locationStocks.find(function (locationEntry) { return locationEntry.location === location; });
      if (!entry) {
        entry = { location: location, stock: 0 };
        locationStocks.push(entry);
      }

      const beforeLocationStock = normalizeStock(entry.stock);
      const beforeStock = normalizeStock(product.stock);
      if (beforeLocationStock < quantity) {
        errors.push(`${internalCode} ${product.productCode || ""}：${location}の在庫 ${beforeLocationStock}個 に対して廃棄 ${quantity}個です。`);
        return;
      }
      if (beforeStock < quantity) {
        errors.push(`${internalCode}：総在庫 ${beforeStock}個 に対して廃棄 ${quantity}個です。`);
        return;
      }

      entry.stock = beforeLocationStock - quantity;
      const afterStock = beforeStock - quantity;
      const afterLocationStock = entry.stock;
      const updatedProduct = {
        ...product,
        stock: afterStock,
        locationStocks: locationStocks,
        updatedAt: nowIso
      };
      touched.set(internalCode, updatedProduct);

      const movement = {
        id: createDisposalMovementId(list.id, internalCode, index),
        dateTime: nowIso,
        internalCode: internalCode,
        productCode: product.productCode || item.productCode || "",
        productName: product.productName || item.productName || "",
        janCode: product.janCode || item.janCode || "",
        type: "出庫",
        quantity: quantity,
        beforeStock: beforeStock,
        afterStock: afterStock,
        person: String(list.person || "").trim(),
        reason: "廃棄",
        memo: buildDisposalMovementMemo(list),
        location: location,
        beforeLocationStock: beforeLocationStock,
        afterLocationStock: afterLocationStock,
        source: "廃棄リスト",
        sourceId: list.id
      };
      movements.push(movement);
      appliedItemMap.set(makeItemKey(item), {
        beforeStock: beforeStock,
        afterStock: afterStock,
        beforeLocationStock: beforeLocationStock,
        afterLocationStock: afterLocationStock
      });
    });

    return {
      errors: errors,
      updatedProducts: Array.from(touched.values()),
      movements: movements,
      appliedItemMap: appliedItemMap
    };
  }

  function buildDisposalMovementMemo(list) {
    const parts = [`廃棄リスト ${list.id}`, `廃棄予定日 ${list.plannedDate}`];
    if (String(list.memo || "").trim()) parts.push(String(list.memo).trim());
    return parts.join(" / ");
  }

  function printCurrentList() {
    if (!currentList) {
      void showDisposalDialog({
        type: "warning",
        icon: "⚠️",
        title: "印刷するリストがありません",
        message: "廃棄リストを作成または開いてください。",
        confirmText: "閉じる"
      });
      return;
    }
    syncMetaFromInputs();
    if (!validateListForSave()) return;
    printList(currentList);
  }

  function printList(list) {
    if (!list || !Array.isArray(list.items) || !list.items.length) return;

    const printWindow = window.open("", "_blank", "width=1000,height=1000");
    if (!printWindow) {
      void showDisposalDialog({
        type: "warning",
        icon: "⚠️",
        title: "印刷画面を開けませんでした",
        message: "ブラウザのポップアップを許可して、もう一度お試しください。",
        confirmText: "閉じる"
      });
      return;
    }

    const rows = list.items.map(function (item, index) {
      const image = item.photoDataUrl
        ? `<img class="photo" src="${escapeAttribute(item.photoDataUrl)}" alt="商品写真">`
        : '<div class="no-photo">写真なし</div>';
      return `
        <tr>
          <td class="no">${index + 1}</td>
          <td><strong>${escapeHtml(item.internalCode || "")}</strong><small>廃棄元：${escapeHtml(item.location || "")}</small></td>
          <td><strong>${escapeHtml(item.productCode || "-")}</strong><small>${escapeHtml(item.productName || "")}</small></td>
          <td class="qty">${normalizePositiveInteger(item.quantity).toLocaleString("ja-JP")}個</td>
          <td class="photo-cell">${image}</td>
        </tr>
      `;
    }).join("");

    const statusText = list.status === STATUS_COMPLETED ? "在庫反映済み" : "下書き";
    const totalQty = getListTotalQuantity(list);

    printWindow.document.open();
    printWindow.document.write(`<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>廃棄リスト_${escapeHtml(list.plannedDate || "")}</title>
<style>
  @page { size: A4 portrait; margin: 10mm; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; color: #111; background: #fff; font-family: "Yu Gothic", "Meiryo", sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font-size: 10pt; }
  h1 { margin: 0; font-size: 20pt; letter-spacing: .08em; }
  .header { display: flex; justify-content: space-between; align-items: flex-end; gap: 10mm; padding-bottom: 4mm; border-bottom: 1.2pt solid #111; }
  .status { font-weight: 700; }
  .meta { width: 100%; margin: 4mm 0; border-collapse: collapse; }
  .meta th, .meta td { padding: 2.2mm 2.5mm; border: .6pt solid #777; text-align: left; }
  .meta th { width: 18%; background: #eee; }
  table.list { width: 100%; border-collapse: collapse; table-layout: fixed; }
  .list th, .list td { border: .6pt solid #777; padding: 2mm; vertical-align: middle; }
  .list th { background: #e9eef2; text-align: center; }
  .list tr { break-inside: avoid; page-break-inside: avoid; }
  .list .no { width: 8%; text-align: center; }
  .list th:nth-child(2) { width: 22%; }
  .list th:nth-child(3) { width: 31%; }
  .list th:nth-child(4) { width: 13%; }
  .list th:nth-child(5) { width: 26%; }
  .list td { height: 34mm; }
  .list td strong { display: block; font-size: 11pt; }
  .list td small { display: block; margin-top: 1.5mm; color: #444; font-size: 8pt; }
  .qty { text-align: right; font-size: 14pt; font-weight: 800; }
  .photo-cell { text-align: center; padding: 1.5mm !important; }
  .photo { max-width: 34mm; max-height: 30mm; object-fit: contain; }
  .no-photo { width: 34mm; height: 28mm; margin: 0 auto; display: grid; place-items: center; border: .6pt dashed #999; color: #777; font-size: 8pt; }
  .summary { margin-top: 4mm; text-align: right; font-weight: 800; font-size: 11pt; }
</style>
</head>
<body>
  <div class="header">
    <h1>廃棄リスト</h1>
    <div class="status">${escapeHtml(statusText)}</div>
  </div>
  <table class="meta">
    <tr><th>廃棄予定日</th><td>${escapeHtml(formatDate(list.plannedDate))}</td><th>担当者</th><td>${escapeHtml(list.person || "")}</td></tr>
    <tr><th>メモ</th><td colspan="3">${escapeHtml(list.memo || "")}</td></tr>
  </table>
  <table class="list">
    <thead><tr><th>No.</th><th>社内コード</th><th>商品コード</th><th>数量</th><th>商品写真</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="summary">${list.items.length}商品 / 合計 ${totalQty.toLocaleString("ja-JP")}個</div>
<script>
  window.addEventListener("load", function () { setTimeout(function () { window.print(); }, 250); });
<\/script>
</body>
</html>`);
    printWindow.document.close();
  }

  async function reloadLists() {
    lists = await getAllDisposalLists();
    sortLists();
    renderSavedLists();
  }

  function syncMetaFromInputs() {
    if (!currentList || currentList.status === STATUS_COMPLETED) return;
    currentList.plannedDate = String(document.querySelector("#disposal-planned-date")?.value || "").trim();
    currentList.person = String(document.querySelector("#disposal-person")?.value || "").trim();
    currentList.memo = String(document.querySelector("#disposal-memo")?.value || "").trim();
    currentList.updatedAt = new Date().toISOString();
  }

  function getListTotalQuantity(list) {
    return (Array.isArray(list.items) ? list.items : []).reduce(function (sum, item) {
      return sum + normalizePositiveInteger(item.quantity);
    }, 0);
  }

  function makeItemKey(item) {
    return `${String(item.internalCode || "")}::${getInventoryBaseLocationName(item.location)}`;
  }

  function createDisposalListId() {
    return `disposal-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }

  function createDisposalMovementId(listId, internalCode, index) {
    return `disposal-movement-${listId}-${internalCode}-${index}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  }

  function normalizePositiveInteger(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return 0;
    return Math.max(0, Math.trunc(number));
  }

  function normalizeStock(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return 0;
    return Math.max(0, Math.trunc(number));
  }

  function normalizeSearchText(value) {
    return String(value || "").normalize("NFKC").trim().toLowerCase().replace(/[\s\u3000]+/g, "");
  }

  function deepClone(value) {
    if (typeof structuredClone === "function") return structuredClone(value);
    return JSON.parse(JSON.stringify(value));
  }

  function formatInputDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function formatDate(value) {
    const text = String(value || "");
    const match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return text || "未設定";
    return `${Number(match[1])}/${Number(match[2])}/${Number(match[3])}`;
  }

  function formatDateTime(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleString("ja-JP");
  }

  function setValue(selector, value) {
    const element = document.querySelector(selector);
    if (element) element.value = value;
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function escapeAttribute(value) {
    return escapeHtml(value);
  }

  async function compressImageFile(file) {
    if (!file || !String(file.type || "").startsWith("image/")) {
      throw new Error("画像ファイルではありません。");
    }

    const dataUrl = await readFileAsDataUrl(file);
    const image = await loadImage(dataUrl);
    const maxDimension = 800;
    const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth || image.width, image.naturalHeight || image.height));
    const width = Math.max(1, Math.round((image.naturalWidth || image.width) * scale));
    const height = Math.max(1, Math.round((image.naturalHeight || image.height) * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);
    return canvas.toDataURL("image/jpeg", 0.72);
  }

  function readFileAsDataUrl(file) {
    return new Promise(function (resolve, reject) {
      const reader = new FileReader();
      reader.onload = function () { resolve(String(reader.result || "")); };
      reader.onerror = function () { reject(reader.error || new Error("画像を読み込めません。")); };
      reader.readAsDataURL(file);
    });
  }

  function loadImage(src) {
    return new Promise(function (resolve, reject) {
      const image = new Image();
      image.onload = function () { resolve(image); };
      image.onerror = function () { reject(new Error("画像を表示できません。")); };
      image.src = src;
    });
  }

  function showDisposalDialog(options) {
    if (window.inventoryApp && typeof window.inventoryApp.showAppDialog === "function") {
      return window.inventoryApp.showAppDialog(options);
    }
    if (typeof showAppDialog === "function") return showAppDialog(options);

    const text = [options.title, options.message, options.notice].filter(Boolean).join("\n\n");
    if (options.isConfirm) return Promise.resolve(window.confirm(text));
    window.alert(text);
    return Promise.resolve(true);
  }
})();
