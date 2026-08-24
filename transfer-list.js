"use strict";

(function () {
  const LOCATION_OPTIONS = [
    "本社1階 A区",
    "本社1階 B区",
    "本社1階 C区",
    "本社1階 D区",
    "本社1階 E区",
    "本社1階 F区",
    "本社2階 A区",
    "本社2階 B区",
    "本社2階 C区",
    "本社2階 D区",
    "本社2階 E区",
    "本社2階 F区",
    "酒本倉庫1階",
    "酒本倉庫2階"
  ];

  const state = {
    products: [],
    items: [],
    editingId: null
  };

  document.addEventListener("DOMContentLoaded", initializeTransferListFeature);

  async function initializeTransferListFeature() {
    createHomeButton();
    createTransferScreen();
    createTransferStyles();
    bindEvents();
    setDefaultDate();
    populateLocationOptions();
    try {
      state.products = await getAllProducts();
      renderProductSuggestions();
    } catch (error) {
      console.error("商品読込エラー", error);
    }
  }

  function createHomeButton() {
    if (document.querySelector("#show-transfer-list-button")) return;
    const container = document.querySelector("#home-inventory-buttons");
    if (!container) return;
    const button = document.createElement("button");
    button.id = "show-transfer-list-button";
    button.type = "button";
    button.textContent = "商品移動リストを作成・印刷する";
    container.appendChild(button);
  }

  function createTransferScreen() {
    if (document.querySelector("#transfer-list")) return;
    const main = document.querySelector("main");
    if (!main) return;

    const section = document.createElement("section");
    section.id = "transfer-list";
    section.hidden = true;
    section.innerHTML = `
      <h2>商品移動リスト</h2>
      <p>
        倉庫から倉庫、本社などへ商品を移動するときのリストを作成して印刷します。
        移動先で確認して「移動完了」になると、場所別在庫へ自動反映します。総在庫数は変わりません。
      </p>

      <div class="transfer-card">
        <h3>移動内容</h3>
        <div class="transfer-form-grid">
          <div>
            <label for="transfer-date">移動日（必須）</label>
            <input id="transfer-date" type="date" required>
          </div>
          <div>
            <label for="transfer-source">移動元（必須）</label>
            <select id="transfer-source" required></select>
          </div>
          <div>
            <label for="transfer-destination">移動先（必須）</label>
            <select id="transfer-destination" required></select>
          </div>
        </div>
      </div>

      <div class="transfer-card">
        <h3>商品を追加</h3>
        <div class="transfer-add-grid">
          <div>
            <label for="transfer-internal-code">社内コード</label>
            <input
              id="transfer-internal-code"
              type="text"
              list="transfer-product-suggestions"
              autocomplete="off"
              placeholder="例：20009"
            >
            <datalist id="transfer-product-suggestions"></datalist>
          </div>
          <div>
            <label for="transfer-add-quantity">移動個数</label>
            <input id="transfer-add-quantity" type="number" min="1" step="1" value="1">
          </div>
          <button id="transfer-add-product-button" type="button">商品を追加する</button>
        </div>
        <p class="transfer-note">社内コードを入力すると、登録済みの商品コード・商品名を自動で使用します。</p>
      </div>

      <div class="transfer-card">
        <div class="transfer-heading-row">
          <h3>今回の移動商品</h3>
          <strong id="transfer-current-summary">0商品 / 0個</strong>
        </div>
        <div class="transfer-table-wrap">
          <table class="transfer-table">
            <thead>
              <tr>
                <th>No</th>
                <th>社内コード</th>
                <th>商品コード</th>
                <th>商品名</th>
                <th>現在の保管場所</th>
                <th>移動個数</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody id="transfer-current-body"></tbody>
          </table>
        </div>
        <p id="transfer-empty-message" class="transfer-empty">商品を追加してください。</p>
        <div class="transfer-actions">
          <button id="transfer-save-button" type="button">移動リストを保存する</button>
          <button id="transfer-print-current-button" type="button">この内容を印刷する</button>
          <button id="transfer-clear-button" type="button" class="transfer-secondary">入力をクリアする</button>
        </div>
        <p id="transfer-editing-message" class="transfer-editing-message" hidden></p>
      </div>

      <div class="transfer-card">
        <div class="transfer-heading-row">
          <h3>保存した移動リスト</h3>
          <strong id="transfer-saved-count">0件</strong>
        </div>
        <div class="transfer-table-wrap">
          <table class="transfer-table">
            <thead>
              <tr>
                <th>移動日</th>
                <th>移動元</th>
                <th>移動先</th>
                <th>商品数</th>
                <th>合計個数</th>
                <th>確認状況</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody id="transfer-saved-body"></tbody>
          </table>
        </div>
        <p id="transfer-saved-empty" class="transfer-empty">保存した移動リストはありません。</p>
      </div>

      <button id="back-home-from-transfer-list" type="button">ホームへ戻る</button>
    `;
    main.appendChild(section);
  }

  function createTransferStyles() {
    if (document.querySelector("#transfer-list-style")) return;
    const style = document.createElement("style");
    style.id = "transfer-list-style";
    style.textContent = `
      #transfer-list { max-width: 1180px; margin: 0 auto; scroll-margin-top: 12px; }
      .transfer-card { background: #fff; border: 1px solid #cfd8dc; border-radius: 12px; padding: 16px; margin: 16px 0; }
      .transfer-form-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
      .transfer-add-grid { display: grid; grid-template-columns: minmax(220px, 1fr) 160px auto; gap: 12px; align-items: end; }
      .transfer-form-grid label, .transfer-add-grid label { display: block; font-weight: 700; margin-bottom: 6px; }
      .transfer-form-grid input, .transfer-form-grid select, .transfer-add-grid input { width: 100%; min-height: 46px; box-sizing: border-box; font-size: 16px; }
      .transfer-heading-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
      .transfer-table-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }
      .transfer-table { width: 100%; border-collapse: collapse; min-width: 820px; }
      .transfer-table th, .transfer-table td { border-bottom: 1px solid #cfd8dc; padding: 10px 8px; text-align: left; vertical-align: middle; }
      .transfer-table th { background: #eef6ff; white-space: nowrap; }
      .transfer-quantity-input { width: 110px; min-height: 42px; font-size: 16px; }
      .transfer-remove-button, .transfer-delete-button { background: #d32f2f; }
      .transfer-secondary { background: #607d8b; }
      .transfer-actions, .transfer-row-actions { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 14px; }
      .transfer-row-actions { margin-top: 0; }
      .transfer-empty { padding: 14px; background: #f5f5f5; border-radius: 8px; }
      .transfer-note { color: #546e7a; margin-bottom: 0; }
      .transfer-location-warning { color: #ef6c00; font-size: 13px; font-weight: 700; display: block; margin-top: 4px; }
      .transfer-editing-message { background: #e3f2fd; color: #0d47a1; padding: 10px 12px; border-radius: 8px; font-weight: 700; }
      .transfer-status-badge { display: inline-flex; align-items: center; justify-content: center; min-width: 96px; padding: 5px 9px; border-radius: 999px; font-weight: 700; white-space: nowrap; }
      .transfer-status-pending { background: #eceff1; color: #455a64; }
      .transfer-status-source { background: #fff3cd; color: #8a5a00; }
      .transfer-status-complete { background: #dff3e4; color: #1b5e20; }
      .transfer-status-detail { display: block; margin-top: 5px; font-size: 12px; line-height: 1.5; color: #546e7a; white-space: nowrap; }
      .transfer-person-input-group { margin-top: 18px; }
      .transfer-person-input-label { display: block; margin-bottom: 8px; font-size: 18px; font-weight: 700; color: #263238; }
      .transfer-person-input { width: 100%; min-height: 58px; box-sizing: border-box; padding: 12px 14px; border: 2px solid #90a4ae; border-radius: 10px; background: #fff; color: #263238; font-size: 20px; }
      .transfer-person-input:focus { border-color: #1565c0; outline: 4px solid #bbdefb; outline-offset: 1px; }
      .transfer-person-input-error { min-height: 26px; margin: 8px 0 0; color: #c62828; font-size: 17px; font-weight: 700; }
      .transfer-confirm-source-button { background: #ef9a25; }
      .transfer-confirm-destination-button { background: #2e7d32; }
      @media (max-width: 760px) {
        .transfer-form-grid, .transfer-add-grid { grid-template-columns: 1fr; }
        .transfer-card { padding: 12px; }
        .transfer-actions button, .transfer-row-actions button { width: 100%; }
      }
    `;
    document.head.appendChild(style);
  }

  function bindEvents() {
    const showButton = document.querySelector("#show-transfer-list-button");
    if (showButton) showButton.addEventListener("click", showTransferScreen);

    document.querySelector("#back-home-from-transfer-list")?.addEventListener("click", showHomeScreen);
    document.querySelector("#transfer-add-product-button")?.addEventListener("click", addProductToTransfer);
    document.querySelector("#transfer-internal-code")?.addEventListener("keydown", function (event) {
      if (event.key === "Enter") {
        event.preventDefault();
        addProductToTransfer();
      }
    });
    document.querySelector("#transfer-source")?.addEventListener("change", renderCurrentItems);
    document.querySelector("#transfer-save-button")?.addEventListener("click", saveCurrentTransfer);
    document.querySelector("#transfer-print-current-button")?.addEventListener("click", printCurrentTransfer);
    document.querySelector("#transfer-clear-button")?.addEventListener("click", async function () {
      if (state.items.length > 0) {
        const totalQuantity = state.items.reduce(function (sum, item) {
          return sum + Number(item.quantity || 0);
        }, 0);
        const confirmed = await showAppDialog({
          type: "warning",
          icon: "🧹",
          title: "入力中の商品をクリアしますか？",
          message: "今回の移動商品を入力欄からすべて消します。",
          details: [
            { label: "商品数", value: `${state.items.length}商品` },
            { label: "合計個数", value: `${formatNumber(totalQuantity)}個` }
          ],
          notice: "まだ保存していない入力内容は元に戻せません。",
          isConfirm: true,
          cancelText: "戻る",
          confirmText: "入力をクリアする"
        });
        if (!confirmed) return;
      }
      resetForm();
    });
  }

  async function showTransferScreen() {
    hideMainSections();
    const section = document.querySelector("#transfer-list");
    if (section) section.hidden = false;

    // ホームなどのボタンから開いたとき、表示した商品移動リストの先頭へ自動移動する。
    // hidden解除直後はブラウザ側のレイアウト計算が終わっていない場合があるため、
    // 1フレーム待ってからスクロールする。
    if (section) {
      window.requestAnimationFrame(function () {
        section.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }

    try {
      state.products = await getAllProducts();
      renderProductSuggestions();
      await renderSavedTransfers();
      renderCurrentItems();

      // データ描画で高さが変わった場合も、画面先頭がずれないよう最後に位置を整える。
      if (section) {
        window.requestAnimationFrame(function () {
          section.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      }
    } catch (error) {
      console.error("商品移動リスト表示エラー", error);
      await showAppDialog({
        type: "danger",
        icon: "⚠️",
        title: "商品移動リストを表示できませんでした",
        message: "画面を更新して、もう一度お試しください。",
        confirmText: "閉じる"
      });
    }
  }

  function showHomeScreen() {
    hideMainSections();
    const home = document.querySelector("#home");
    if (home) home.hidden = false;
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  function hideMainSections() {
    document.querySelectorAll("main > section").forEach(function (section) {
      section.hidden = true;
    });
  }

  function setDefaultDate() {
    const input = document.querySelector("#transfer-date");
    if (!input || input.value) return;
    const now = new Date();
    input.value = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, "0"),
      String(now.getDate()).padStart(2, "0")
    ].join("-");
  }

  function populateLocationOptions() {
    ["#transfer-source", "#transfer-destination"].forEach(function (selector) {
      const select = document.querySelector(selector);
      if (!select || select.options.length > 0) return;

      // 「未確認」は、保管場所が未確定の在庫を正しい場所へ直すため、
      // 移動元だけで選べるようにします。移動先には表示しません。
      const locations = selector === "#transfer-source"
        ? LOCATION_OPTIONS.concat("未確認")
        : LOCATION_OPTIONS;

      select.innerHTML = '<option value="">選択してください</option>' + locations.map(function (location) {
        return `<option value="${escapeHtml(location)}">${escapeHtml(location)}</option>`;
      }).join("");
    });
  }

  function renderProductSuggestions() {
    const datalist = document.querySelector("#transfer-product-suggestions");
    if (!datalist) return;
    datalist.innerHTML = state.products.map(function (product) {
      const code = String(product.internalCode || "").trim();
      const name = String(product.productName || product.name || "").trim();
      return `<option value="${escapeHtml(code)}">${escapeHtml(name)}</option>`;
    }).join("");
  }

  async function addProductToTransfer() {
    const codeInput = document.querySelector("#transfer-internal-code");
    const quantityInput = document.querySelector("#transfer-add-quantity");
    const internalCode = String(codeInput?.value || "").trim();
    const quantity = Math.trunc(Number(quantityInput?.value || 0));

    if (!internalCode) {
      await showAppDialog({
        type: "warning",
        icon: "✏️",
        title: "社内コードを入力してください",
        message: "移動する商品の社内コードを入力してから、もう一度お試しください。",
        confirmText: "入力に戻る"
      });
      codeInput?.focus();
      return;
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      await showAppDialog({
        type: "warning",
        icon: "🔢",
        title: "移動個数を確認してください",
        message: "移動個数は1以上の整数で入力してください。",
        details: [
          { label: "入力した移動個数", value: String(quantityInput?.value || "未入力") }
        ],
        confirmText: "入力に戻る"
      });
      quantityInput?.focus();
      return;
    }

    const product = state.products.find(function (item) {
      return String(item.internalCode || "").trim() === internalCode;
    });
    if (!product) {
      await showAppDialog({
        type: "danger",
        icon: "🔎",
        title: "商品が見つかりません",
        message: "入力した社内コードの商品は登録されていません。",
        details: [
          { label: "社内コード", value: internalCode }
        ],
        notice: "社内コードを確認するか、商品一覧から登録状況を確認してください。",
        confirmText: "入力に戻る"
      });
      codeInput?.focus();
      return;
    }

    const existing = state.items.find(function (item) {
      return item.internalCode === internalCode;
    });
    if (existing) {
      const add = await showAppDialog({
        type: "warning",
        icon: "➕",
        title: "同じ商品がすでに追加されています",
        message: "入力した数量を、現在の移動個数へ追加しますか？",
        details: [
          { label: "商品名", value: existing.productName || "-" },
          { label: "社内コード", value: internalCode },
          { label: "現在の移動個数", value: `${formatNumber(Number(existing.quantity || 0))}個` },
          { label: "今回追加する個数", value: `${formatNumber(quantity)}個` },
          { label: "追加後", value: `${formatNumber(Number(existing.quantity || 0) + quantity)}個` }
        ],
        isConfirm: true,
        cancelText: "戻る",
        confirmText: "個数を追加する"
      });
      if (!add) return;
      existing.quantity += quantity;
    } else {
      state.items.push({
        internalCode: internalCode,
        productCode: String(product.productCode || "").trim(),
        productName: String(product.productName || product.name || "").trim(),
        storageLocation: String(product.storageLocation || product.location || "").trim(),
        quantity: quantity
      });
    }

    codeInput.value = "";
    quantityInput.value = "1";
    renderCurrentItems();
    codeInput.focus();
  }

  function normalizeLocationForCompare(value) {
    return String(value || "")
      .normalize("NFKC")
      .replace(/[\s\u3000]+/g, "")
      .trim();
  }

  function isSameLocation(left, right) {
    return normalizeLocationForCompare(left) === normalizeLocationForCompare(right);
  }

  function renderCurrentItems() {
    const body = document.querySelector("#transfer-current-body");
    const empty = document.querySelector("#transfer-empty-message");
    const summary = document.querySelector("#transfer-current-summary");
    if (!body || !empty || !summary) return;

    const sourceLocation = String(document.querySelector("#transfer-source")?.value || "");
    const totalQuantity = state.items.reduce(function (sum, item) { return sum + Number(item.quantity || 0); }, 0);
    summary.textContent = `${state.items.length}商品 / ${formatNumber(totalQuantity)}個`;
    empty.hidden = state.items.length > 0;

    body.innerHTML = state.items.map(function (item, index) {
      const locationWarning = sourceLocation && item.storageLocation && !isSameLocation(item.storageLocation, sourceLocation)
        ? `<span class="transfer-location-warning">登録保管場所は移動元と異なります</span>`
        : "";
      return `
        <tr>
          <td>${index + 1}</td>
          <td>${escapeHtml(item.internalCode)}</td>
          <td>${escapeHtml(item.productCode || "-")}</td>
          <td>${escapeHtml(item.productName)}</td>
          <td>${escapeHtml(item.storageLocation || "-")}${locationWarning}</td>
          <td>
            <input
              class="transfer-quantity-input"
              type="number"
              min="1"
              step="1"
              value="${Number(item.quantity || 0)}"
              data-transfer-quantity-index="${index}"
              aria-label="${escapeHtml(item.productName)}の移動個数"
            >
          </td>
          <td><button class="transfer-remove-button" type="button" data-transfer-remove-index="${index}">削除</button></td>
        </tr>
      `;
    }).join("");

    body.querySelectorAll("[data-transfer-quantity-index]").forEach(function (input) {
      input.addEventListener("input", function () {
        const index = Number(input.dataset.transferQuantityIndex);
        const value = Math.trunc(Number(input.value || 0));
        if (state.items[index]) state.items[index].quantity = value;
        updateCurrentSummaryOnly();
      });
    });
    body.querySelectorAll("[data-transfer-remove-index]").forEach(function (button) {
      button.addEventListener("click", function () {
        const index = Number(button.dataset.transferRemoveIndex);
        state.items.splice(index, 1);
        renderCurrentItems();
      });
    });
  }

  function updateCurrentSummaryOnly() {
    const summary = document.querySelector("#transfer-current-summary");
    if (!summary) return;
    const total = state.items.reduce(function (sum, item) {
      const quantity = Number(item.quantity || 0);
      return sum + (Number.isFinite(quantity) && quantity > 0 ? quantity : 0);
    }, 0);
    summary.textContent = `${state.items.length}商品 / ${formatNumber(total)}個`;
  }

  function validateCurrentTransfer() {
    const transferDate = String(document.querySelector("#transfer-date")?.value || "");
    const sourceLocation = String(document.querySelector("#transfer-source")?.value || "");
    const destinationLocation = String(document.querySelector("#transfer-destination")?.value || "");

    if (!transferDate) throw new Error("移動日を入力してください。");
    if (!sourceLocation) throw new Error("移動元を選択してください。");
    if (!destinationLocation) throw new Error("移動先を選択してください。");
    if (isSameLocation(sourceLocation, destinationLocation)) throw new Error("移動元と移動先は別の場所を選択してください。");
    if (state.items.length === 0) throw new Error("移動する商品を1件以上追加してください。");

    const invalidItem = state.items.find(function (item) {
      const quantity = Number(item.quantity || 0);
      return !Number.isInteger(quantity) || quantity <= 0;
    });
    if (invalidItem) throw new Error(`${invalidItem.productName} の移動個数を1以上で入力してください。`);

    return {
      transferDate: transferDate,
      sourceLocation: sourceLocation,
      destinationLocation: destinationLocation
    };
  }

  async function saveCurrentTransfer() {
    try {
      const header = validateCurrentTransfer();
      const existingRecords = await getAllTransferLists();
      const existing = state.editingId
        ? existingRecords.find(function (record) { return record.id === state.editingId; })
        : null;
      const now = new Date().toISOString();
      const normalizedItems = state.items.map(function (item) {
        return {
          internalCode: item.internalCode,
          productCode: item.productCode || "",
          productName: item.productName,
          storageLocation: item.storageLocation || "",
          quantity: Number(item.quantity)
        };
      });
      const contentChanged = existing
        ? hasTransferContentChanged(existing, header, normalizedItems)
        : false;
      const hadConfirmation = Boolean(existing?.sourceConfirmedAt || existing?.destinationConfirmedAt);
      const resetConfirmation = Boolean(existing && contentChanged && hadConfirmation);
      const record = {
        id: state.editingId || createTransferId(),
        transferDate: header.transferDate,
        sourceLocation: header.sourceLocation,
        destinationLocation: header.destinationLocation,
        items: normalizedItems,
        sourceConfirmedBy: resetConfirmation ? "" : String(existing?.sourceConfirmedBy || ""),
        sourceConfirmedAt: resetConfirmation ? "" : String(existing?.sourceConfirmedAt || ""),
        destinationConfirmedBy: resetConfirmation ? "" : String(existing?.destinationConfirmedBy || ""),
        destinationConfirmedAt: resetConfirmation ? "" : String(existing?.destinationConfirmedAt || ""),
        inventoryAppliedBy: resetConfirmation ? "" : String(existing?.inventoryAppliedBy || ""),
        inventoryAppliedAt: resetConfirmation ? "" : String(existing?.inventoryAppliedAt || ""),
        createdAt: existing?.createdAt || now,
        updatedAt: now
      };

      await saveTransferList(record);
      let message = state.editingId ? "商品移動リストを更新しました。" : "商品移動リストを保存しました。";
      if (resetConfirmation) {
        message += "\n\n確認済みの内容を変更したため、確認状況を「未確認」に戻しました。";
      }
      await showAppDialog({
        type: "success",
        icon: "✅",
        title: state.editingId ? "商品移動リストを更新しました" : "商品移動リストを保存しました",
        message: resetConfirmation
          ? "変更内容を保存しました。確認済みの内容を変更したため、確認状況は「未確認」に戻しています。"
          : "商品移動リストを保存しました。",
        confirmText: "閉じる"
      });
      resetForm();
      await renderSavedTransfers();
    } catch (error) {
      console.error("商品移動リスト保存エラー", error);
      await showAppDialog({
        type: "danger",
        icon: "⚠️",
        title: "商品移動リストを保存できませんでした",
        message: error.message || "入力内容を確認して、もう一度お試しください。",
        confirmText: "閉じる"
      });
    }
  }

  async function printCurrentTransfer() {
    try {
      const header = validateCurrentTransfer();
      const record = {
        transferDate: header.transferDate,
        sourceLocation: header.sourceLocation,
        destinationLocation: header.destinationLocation,
        items: state.items.map(function (item) { return { ...item, quantity: Number(item.quantity) }; })
      };
      await printTransferRecord(record);
    } catch (error) {
      await showAppDialog({
        type: "warning",
        icon: "🖨️",
        title: "印刷内容を確認してください",
        message: error.message || "印刷する内容を確認してください。",
        confirmText: "閉じる"
      });
    }
  }

  async function renderSavedTransfers() {
    const body = document.querySelector("#transfer-saved-body");
    const empty = document.querySelector("#transfer-saved-empty");
    const count = document.querySelector("#transfer-saved-count");
    if (!body || !empty || !count) return;

    const records = await getAllTransferLists();
    records.sort(function (a, b) {
      const dateCompare = String(b.transferDate || "").localeCompare(String(a.transferDate || ""));
      if (dateCompare !== 0) return dateCompare;
      return String(b.updatedAt || "").localeCompare(String(a.updatedAt || ""));
    });

    count.textContent = `${records.length}件`;
    empty.hidden = records.length > 0;
    body.innerHTML = records.map(function (record) {
      const items = Array.isArray(record.items) ? record.items : [];
      const total = items.reduce(function (sum, item) { return sum + Number(item.quantity || 0); }, 0);
      return `
        <tr>
          <td>${escapeHtml(formatDate(record.transferDate))}</td>
          <td>${escapeHtml(record.sourceLocation || "-")}</td>
          <td>${escapeHtml(record.destinationLocation || "-")}</td>
          <td>${items.length}商品</td>
          <td>${formatNumber(total)}個</td>
          <td>${renderTransferStatus(record)}</td>
          <td>
            <div class="transfer-row-actions">
              ${renderTransferConfirmationButton(record)}
              ${record.inventoryAppliedAt ? "" : `<button type="button" data-transfer-edit="${escapeHtml(record.id)}">編集</button>`}
              <button type="button" data-transfer-print="${escapeHtml(record.id)}">印刷</button>
              ${record.inventoryAppliedAt ? "" : `<button type="button" class="transfer-delete-button" data-transfer-delete="${escapeHtml(record.id)}">削除</button>`}
            </div>
          </td>
        </tr>
      `;
    }).join("");

    body.querySelectorAll("[data-transfer-edit]").forEach(function (button) {
      button.addEventListener("click", function () {
        const record = records.find(function (item) { return item.id === button.dataset.transferEdit; });
        if (record) loadTransferForEditing(record);
      });
    });
    body.querySelectorAll("[data-transfer-print]").forEach(function (button) {
      button.addEventListener("click", async function () {
        const record = records.find(function (item) { return item.id === button.dataset.transferPrint; });
        if (record) await printTransferRecord(record);
      });
    });
    body.querySelectorAll("[data-transfer-confirm-source]").forEach(function (button) {
      button.addEventListener("click", async function () {
        const record = records.find(function (item) { return item.id === button.dataset.transferConfirmSource; });
        if (record) await confirmTransferSource(record);
      });
    });
    body.querySelectorAll("[data-transfer-confirm-destination]").forEach(function (button) {
      button.addEventListener("click", async function () {
        const record = records.find(function (item) { return item.id === button.dataset.transferConfirmDestination; });
        if (record) await confirmTransferDestination(record);
      });
    });
    body.querySelectorAll("[data-transfer-apply-legacy]").forEach(function (button) {
      button.addEventListener("click", async function () {
        const record = records.find(function (item) { return item.id === button.dataset.transferApplyLegacy; });
        if (record) await applyLegacyCompletedTransfer(record);
      });
    });
    body.querySelectorAll("[data-transfer-delete]").forEach(function (button) {
      button.addEventListener("click", async function () {
        const record = records.find(function (item) { return item.id === button.dataset.transferDelete; });
        if (!record) return;

        const items = Array.isArray(record.items) ? record.items : [];
        const totalQuantity = items.reduce(function (sum, item) {
          return sum + Number(item.quantity || 0);
        }, 0);
        const statusText = getTransferDeleteStatusText(record);

        const confirmed = await showAppDialog({
          type: "danger",
          icon: "🗑️",
          title: "商品移動リストを削除しますか？",
          message: "次の商品移動リストを削除しようとしています。内容を確認してください。",
          details: [
            {
              label: "移動日",
              value: formatDate(record.transferDate)
            },
            {
              label: "移動元",
              value: record.sourceLocation || "-"
            },
            {
              label: "移動先",
              value: record.destinationLocation || "-"
            },
            {
              label: "商品数",
              value: `${items.length}商品`
            },
            {
              label: "合計個数",
              value: `${formatNumber(totalQuantity)}個`
            },
            {
              label: "確認状況",
              value: statusText
            }
          ],
          notice: "この操作は元に戻せません。商品そのものや入出庫履歴は削除されません。",
          isConfirm: true,
          cancelText: "戻る",
          confirmText: "移動リストを削除する"
        });

        if (!confirmed) return;

        try {
          await deleteTransferList(record.id);
          if (state.editingId === record.id) resetForm();
          await renderSavedTransfers();

          await showAppDialog({
            type: "success",
            icon: "✅",
            title: "商品移動リストを削除しました",
            message: "選択した商品移動リストを削除しました。",
            confirmText: "閉じる"
          });
        } catch (error) {
          console.error("商品移動リスト削除エラー", error);

          await showAppDialog({
            type: "danger",
            icon: "⚠️",
            title: "商品移動リストを削除できませんでした",
            message: "画面を更新して、もう一度お試しください。",
            confirmText: "閉じる"
          });
        }
      });
    });
  }

  function getTransferDeleteStatusText(record) {
    const sourceConfirmed = Boolean(record?.sourceConfirmedAt);
    const destinationConfirmed = Boolean(record?.destinationConfirmedAt);
    const inventoryApplied = Boolean(record?.inventoryAppliedAt);

    if (sourceConfirmed && destinationConfirmed && inventoryApplied) {
      return "移動完了・在庫反映済み";
    }

    if (sourceConfirmed && destinationConfirmed) {
      return "移動完了・在庫未反映";
    }

    if (sourceConfirmed) {
      return "移動元確認済";
    }

    return "未確認";
  }

  function renderTransferStatus(record) {
    const sourceConfirmed = Boolean(record?.sourceConfirmedAt);
    const destinationConfirmed = Boolean(record?.destinationConfirmedAt);
    const inventoryApplied = Boolean(record?.inventoryAppliedAt);

    if (sourceConfirmed && destinationConfirmed && inventoryApplied) {
      return `
        <span class="transfer-status-badge transfer-status-complete">移動完了</span>
        <span class="transfer-status-detail">
          移動元：${escapeHtml(record.sourceConfirmedBy || "-")} ${escapeHtml(formatDateTime(record.sourceConfirmedAt))}<br>
          移動先：${escapeHtml(record.destinationConfirmedBy || "-")} ${escapeHtml(formatDateTime(record.destinationConfirmedAt))}<br>
          在庫反映：${escapeHtml(record.inventoryAppliedBy || "-")} ${escapeHtml(formatDateTime(record.inventoryAppliedAt))}
        </span>
      `;
    }

    if (sourceConfirmed && destinationConfirmed) {
      return `
        <span class="transfer-status-badge transfer-status-source">移動完了・在庫未反映</span>
        <span class="transfer-status-detail">
          移動元：${escapeHtml(record.sourceConfirmedBy || "-")} ${escapeHtml(formatDateTime(record.sourceConfirmedAt))}<br>
          移動先：${escapeHtml(record.destinationConfirmedBy || "-")} ${escapeHtml(formatDateTime(record.destinationConfirmedAt))}<br>
          v61以前に完了した移動リストです
        </span>
      `;
    }

    if (sourceConfirmed) {
      return `
        <span class="transfer-status-badge transfer-status-source">移動元確認済</span>
        <span class="transfer-status-detail">
          ${escapeHtml(record.sourceConfirmedBy || "-")} ${escapeHtml(formatDateTime(record.sourceConfirmedAt))}
        </span>
      `;
    }

    return '<span class="transfer-status-badge transfer-status-pending">未確認</span>';
  }

  function renderTransferConfirmationButton(record) {
    if (!record?.sourceConfirmedAt) {
      return `<button type="button" class="transfer-confirm-source-button" data-transfer-confirm-source="${escapeHtml(record.id)}">移動元で確認</button>`;
    }
    if (!record?.destinationConfirmedAt) {
      return `<button type="button" class="transfer-confirm-destination-button" data-transfer-confirm-destination="${escapeHtml(record.id)}">移動先で確認</button>`;
    }
    if (!record?.inventoryAppliedAt) {
      return `<button type="button" class="transfer-confirm-destination-button" data-transfer-apply-legacy="${escapeHtml(record.id)}">在庫へ反映</button>`;
    }
    return "";
  }

  async function confirmTransferSource(record) {
    try {
      await validateTransferSourceStock(record);
    } catch (error) {
      await showAppDialog({
        type: "danger",
        icon: "⚠️",
        title: "移動元の在庫を確認してください",
        message: error.message || "移動元の在庫を確認できませんでした。",
        confirmText: "閉じる"
      });
      return;
    }

    const name = await showTransferPersonInputDialog({
      type: "info",
      icon: "📦",
      title: "移動元の確認者を入力してください",
      message: "移動元で商品を確認した担当者名を入力してください。",
      record: record,
      inputLabel: "移動元の確認者名（必須）",
      placeholder: "例：担当者",
      notice: "確認を記録すると、次は移動先での確認へ進みます。",
      confirmText: "移動元で確認する"
    });

    if (name === null) return;

    try {
      const updated = {
        ...record,
        sourceConfirmedBy: name,
        sourceConfirmedAt: new Date().toISOString(),
        destinationConfirmedBy: "",
        destinationConfirmedAt: "",
        inventoryAppliedBy: "",
        inventoryAppliedAt: "",
        updatedAt: new Date().toISOString()
      };
      await saveTransferList(updated);
      await renderSavedTransfers();

      await showAppDialog({
        type: "success",
        icon: "✅",
        title: "移動元の確認を記録しました",
        message: "移動元での確認が完了しました。次は移動先で確認してください。",
        details: [
          { label: "移動元", value: record.sourceLocation || "-" },
          { label: "確認者", value: name }
        ],
        confirmText: "閉じる"
      });
    } catch (error) {
      console.error("移動元確認保存エラー", error);
      await showAppDialog({
        type: "danger",
        icon: "⚠️",
        title: "移動元の確認を保存できませんでした",
        message: "画面を更新して、もう一度お試しください。",
        confirmText: "閉じる"
      });
    }
  }

  async function confirmTransferDestination(record) {
    if (!record?.sourceConfirmedAt) {
      await showAppDialog({
        type: "warning",
        icon: "⚠️",
        title: "先に移動元で確認してください",
        message: "移動先で確認する前に、移動元で商品の確認を完了してください。",
        confirmText: "閉じる"
      });
      return;
    }

    const name = await showTransferPersonInputDialog({
      type: "warning",
      icon: "📦",
      title: "移動先の確認者を入力してください",
      message: "移動先で商品を確認した担当者名を入力してください。",
      record: record,
      inputLabel: "移動先の確認者名（必須）",
      placeholder: "例：担当者",
      notice: "「移動完了にする」を押すと、場所別在庫へ自動反映します。移動元の在庫を減らし、移動先の在庫を増やします。総在庫数は変わりません。",
      confirmText: "移動完了にする"
    });

    if (name === null) return;

    try {
      const result = await completeTransferAndApplyInventory(
        record,
        name
      );
      applyUpdatedTransferProducts(result?.products);
      await renderSavedTransfers();

      await showAppDialog({
        type: "success",
        icon: "✅",
        title: "商品移動が完了しました",
        message: "移動先での確認と、場所別在庫への反映が完了しました。",
        details: [
          { label: "移動元", value: record.sourceLocation || "-" },
          { label: "移動先", value: record.destinationLocation || "-" },
          { label: "確認者", value: name },
          { label: "総在庫", value: "変更なし" }
        ],
        confirmText: "閉じる"
      });
    } catch (error) {
      console.error("商品移動・在庫反映エラー", error);
      await showAppDialog({
        type: "danger",
        icon: "⚠️",
        title: "商品移動を在庫へ反映できませんでした",
        message:
          error.message ||
          "商品移動を在庫へ反映できませんでした。",
        confirmText: "閉じる"
      });
    }
  }

  function showTransferPersonInputDialog(options) {
    const dialogOptions = options || {};

    return new Promise(function (resolve) {
      const existing = document.querySelector("#transfer-person-input-dialog");
      if (existing) existing.remove();

      const overlay = document.createElement("div");
      overlay.id = "transfer-person-input-dialog";
      overlay.className = "app-dialog-overlay";
      overlay.setAttribute("role", "dialog");
      overlay.setAttribute("aria-modal", "true");

      const modal = document.createElement("div");
      const type = dialogOptions.type || "info";
      modal.className = `app-dialog-modal app-dialog-${type}`;

      const header = document.createElement("div");
      header.className = "app-dialog-header";

      const icon = document.createElement("div");
      icon.className = "app-dialog-icon";
      icon.textContent = dialogOptions.icon || "📦";
      icon.setAttribute("aria-hidden", "true");

      const title = document.createElement("h2");
      title.className = "app-dialog-title";
      title.textContent = dialogOptions.title || "確認者を入力してください";

      header.appendChild(icon);
      header.appendChild(title);

      const content = document.createElement("div");
      content.className = "app-dialog-content";

      const message = document.createElement("p");
      message.className = "app-dialog-message";
      message.textContent = dialogOptions.message || "確認者名を入力してください。";
      content.appendChild(message);

      const record = dialogOptions.record || {};
      const items = Array.isArray(record.items) ? record.items : [];
      const totalQuantity = items.reduce(function (sum, item) {
        return sum + Number(item.quantity || 0);
      }, 0);

      const details = document.createElement("div");
      details.className = "app-dialog-details";
      [
        ["移動日", formatDate(record.transferDate) || "-"],
        ["移動元", record.sourceLocation || "-"],
        ["移動先", record.destinationLocation || "-"],
        ["合計個数", `${formatNumber(totalQuantity)}個`]
      ].forEach(function (detail) {
        const row = document.createElement("div");
        row.className = "app-dialog-detail-row";
        const label = document.createElement("strong");
        label.textContent = detail[0];
        const value = document.createElement("span");
        value.textContent = detail[1];
        row.appendChild(label);
        row.appendChild(value);
        details.appendChild(row);
      });
      content.appendChild(details);

      const inputGroup = document.createElement("div");
      inputGroup.className = "transfer-person-input-group";

      const inputLabel = document.createElement("label");
      inputLabel.className = "transfer-person-input-label";
      inputLabel.textContent = dialogOptions.inputLabel || "確認者名（必須）";

      const input = document.createElement("input");
      input.type = "text";
      input.className = "transfer-person-input";
      input.autocomplete = "name";
      input.placeholder = dialogOptions.placeholder || "例：担当者";
      input.setAttribute("aria-label", inputLabel.textContent);

      const error = document.createElement("p");
      error.className = "transfer-person-input-error";
      error.setAttribute("aria-live", "polite");

      inputGroup.appendChild(inputLabel);
      inputGroup.appendChild(input);
      inputGroup.appendChild(error);
      content.appendChild(inputGroup);

      if (dialogOptions.notice) {
        const notice = document.createElement("div");
        notice.className = "app-dialog-notice";
        notice.textContent = String(dialogOptions.notice);
        content.appendChild(notice);
      }

      const actions = document.createElement("div");
      actions.className = "app-dialog-actions";

      const cancelButton = document.createElement("button");
      cancelButton.type = "button";
      cancelButton.className = "app-dialog-button app-dialog-cancel";
      cancelButton.textContent = dialogOptions.cancelText || "戻る";

      const confirmButton = document.createElement("button");
      confirmButton.type = "button";
      confirmButton.className = "app-dialog-button app-dialog-confirm";
      confirmButton.textContent = dialogOptions.confirmText || "確認する";

      actions.appendChild(cancelButton);
      actions.appendChild(confirmButton);

      modal.appendChild(header);
      modal.appendChild(content);
      modal.appendChild(actions);
      overlay.appendChild(modal);
      document.body.appendChild(overlay);
      document.body.classList.add("app-dialog-open");

      let settled = false;

      function close(result) {
        if (settled) return;
        settled = true;
        document.removeEventListener("keydown", handleKeydown);
        overlay.remove();
        document.body.classList.remove("app-dialog-open");
        resolve(result);
      }

      function submit() {
        const name = String(input.value || "").trim();
        if (!name) {
          error.textContent = "確認者名を入力してください。";
          input.focus();
          return;
        }
        close(name);
      }

      function handleKeydown(event) {
        if (event.key === "Escape") {
          event.preventDefault();
          close(null);
        }
      }

      cancelButton.addEventListener("click", function () {
        close(null);
      });
      confirmButton.addEventListener("click", submit);
      input.addEventListener("keydown", function (event) {
        if (event.key === "Enter") {
          event.preventDefault();
          submit();
        }
      });
      input.addEventListener("input", function () {
        if (error.textContent) error.textContent = "";
      });
      overlay.addEventListener("click", function (event) {
        if (event.target === overlay) {
          close(null);
        }
      });
      document.addEventListener("keydown", handleKeydown);

      window.setTimeout(function () {
        input.focus();
      }, 0);
    });
  }

  async function applyLegacyCompletedTransfer(record) {
    if (record?.inventoryAppliedAt) {
      await showAppDialog({
        type: "info",
        icon: "ℹ️",
        title: "この移動リストは在庫反映済みです",
        message: "場所別在庫へすでに反映されています。追加の操作は必要ありません。",
        confirmText: "閉じる"
      });
      return;
    }

    const defaultPerson = String(
      record?.destinationConfirmedBy || ""
    ).trim();
    let person = defaultPerson;

    if (person === "") {
      const entered = await showTransferPersonInputDialog({
        type: "warning",
        icon: "📦",
        title: "在庫へ反映する担当者を入力してください",
        message: "v61以前に完了した移動リストを場所別在庫へ反映します。担当者名を入力してください。",
        inputLabel: "在庫反映の担当者名（必須）",
        placeholder: "例：担当者",
        notice: "在庫へ反映すると、移動元の在庫を減らし、移動先の在庫を増やします。総在庫数は変わりません。",
        cancelText: "戻る",
        confirmText: "次へ",
        record: record
      });
      if (entered === null) return;
      person = String(entered).trim();
    }

    const items = Array.isArray(record?.items) ? record.items : [];
    const totalQuantity = items.reduce(function (sum, item) {
      return sum + Number(item.quantity || 0);
    }, 0);
    const confirmed = await showAppDialog({
      type: "warning",
      icon: "📦",
      title: "場所別在庫へ反映しますか？",
      message: "この移動リストはv61以前に移動完了となったため、在庫にはまだ反映されていません。",
      details: [
        { label: "移動日", value: formatDate(record.transferDate) },
        { label: "移動元", value: record.sourceLocation || "-" },
        { label: "移動先", value: record.destinationLocation || "-" },
        { label: "合計個数", value: `${formatNumber(totalQuantity)}個` },
        { label: "担当者", value: person }
      ],
      notice: "確定すると、移動元の場所別在庫を減らし、移動先の場所別在庫を増やします。総在庫数は変わりません。",
      isConfirm: true,
      cancelText: "戻る",
      confirmText: "在庫へ反映する"
    });
    if (!confirmed) return;

    try {
      const result = await completeTransferAndApplyInventory(
        record,
        person
      );
      applyUpdatedTransferProducts(result?.products);
      await showAppDialog({
        type: "success",
        icon: "✅",
        title: "場所別在庫へ反映しました",
        message: "移動元と移動先の場所別在庫を更新しました。総在庫数は変わりません。",
        confirmText: "閉じる"
      });
      await renderSavedTransfers();
    } catch (error) {
      console.error("旧商品移動リスト在庫反映エラー", error);
      await showAppDialog({
        type: "danger",
        icon: "⚠️",
        title: "場所別在庫へ反映できませんでした",
        message: error.message || "在庫数を確認して、もう一度お試しください。",
        confirmText: "閉じる"
      });
    }
  }

  async function validateTransferSourceStock(record) {
    const products = await getAllProducts();
    const productMap = new Map(
      products.map(function (product) {
        return [String(product.internalCode || ""), product];
      })
    );
    const sourceLocation = normalizeLocationStockName(
      record?.sourceLocation
    );
    const grouped = new Map();

    (Array.isArray(record?.items) ? record.items : []).forEach(
      function (item) {
        const internalCode = String(item?.internalCode || "");
        const quantity = Number(item?.quantity || 0);
        grouped.set(
          internalCode,
          (grouped.get(internalCode) || 0) + quantity
        );
      }
    );

    for (const [internalCode, quantity] of grouped.entries()) {
      const product = productMap.get(internalCode);
      if (!product) {
        throw new Error(
          `社内コード ${internalCode} の商品が見つかりません。`
        );
      }

      const locationStocks = getProductLocationStocks(product);
      const sourceEntry = locationStocks.find(
        function (entry) {
          return normalizeLocationStockName(entry.location) === sourceLocation;
        }
      );
      const sourceStock = sourceEntry
        ? Number(sourceEntry.stock || 0)
        : 0;

      if (sourceStock < quantity) {
        throw new Error(
          `${product.productName || internalCode}\n` +
          `移動元「${sourceLocation}」の在庫が不足しています。\n` +
          `現在：${sourceStock}個 / 移動：${quantity}個`
        );
      }
    }
  }

  function applyUpdatedTransferProducts(updatedProducts) {
    const products = Array.isArray(updatedProducts)
      ? updatedProducts
      : [];

    products.forEach(function (product) {
      const index = state.products.findIndex(
        function (savedProduct) {
          return (
            String(savedProduct.internalCode || "") ===
            String(product.internalCode || "")
          );
        }
      );

      if (index === -1) {
        state.products.push(product);
      } else {
        state.products[index] = product;
      }

      if (
        window.inventoryApp &&
        typeof window.inventoryApp.applyUpdatedProduct === "function"
      ) {
        window.inventoryApp.applyUpdatedProduct(product);
      }
    });
  }

  function hasTransferContentChanged(existing, header, items) {
    const before = {
      transferDate: String(existing?.transferDate || ""),
      sourceLocation: String(existing?.sourceLocation || ""),
      destinationLocation: String(existing?.destinationLocation || ""),
      items: (Array.isArray(existing?.items) ? existing.items : []).map(normalizeTransferItemForCompare)
    };
    const after = {
      transferDate: String(header.transferDate || ""),
      sourceLocation: String(header.sourceLocation || ""),
      destinationLocation: String(header.destinationLocation || ""),
      items: (Array.isArray(items) ? items : []).map(normalizeTransferItemForCompare)
    };
    return JSON.stringify(before) !== JSON.stringify(after);
  }

  function normalizeTransferItemForCompare(item) {
    return {
      internalCode: String(item?.internalCode || ""),
      productCode: String(item?.productCode || ""),
      productName: String(item?.productName || ""),
      storageLocation: String(item?.storageLocation || ""),
      quantity: Number(item?.quantity || 0)
    };
  }

  function loadTransferForEditing(record) {
    state.editingId = record.id;
    document.querySelector("#transfer-date").value = record.transferDate || "";
    document.querySelector("#transfer-source").value = record.sourceLocation || "";
    document.querySelector("#transfer-destination").value = record.destinationLocation || "";
    state.items = (Array.isArray(record.items) ? record.items : []).map(function (item) {
      return {
        internalCode: String(item.internalCode || ""),
        productCode: String(item.productCode || ""),
        productName: String(item.productName || ""),
        storageLocation: String(item.storageLocation || ""),
        quantity: Number(item.quantity || 0)
      };
    });
    const message = document.querySelector("#transfer-editing-message");
    if (message) {
      message.hidden = false;
      message.textContent = "保存済みの移動リストを編集中です。保存するとこのリストを更新します。";
    }
    const saveButton = document.querySelector("#transfer-save-button");
    if (saveButton) saveButton.textContent = "移動リストを更新する";
    renderCurrentItems();
    document.querySelector("#transfer-list")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function resetForm() {
    state.items = [];
    state.editingId = null;
    const source = document.querySelector("#transfer-source");
    const destination = document.querySelector("#transfer-destination");
    const code = document.querySelector("#transfer-internal-code");
    const quantity = document.querySelector("#transfer-add-quantity");
    if (source) source.value = "";
    if (destination) destination.value = "";
    if (code) code.value = "";
    if (quantity) quantity.value = "1";
    const date = document.querySelector("#transfer-date");
    if (date) date.value = "";
    setDefaultDate();
    const message = document.querySelector("#transfer-editing-message");
    if (message) message.hidden = true;
    const saveButton = document.querySelector("#transfer-save-button");
    if (saveButton) saveButton.textContent = "移動リストを保存する";
    renderCurrentItems();
  }

  async function printTransferRecord(record) {
    const items = Array.isArray(record.items) ? record.items : [];
    if (items.length === 0) {
      await showAppDialog({
        type: "warning",
        icon: "🖨️",
        title: "印刷する商品がありません",
        message: "商品を1件以上追加してから印刷してください。",
        confirmText: "閉じる"
      });
      return;
    }
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      await showAppDialog({
        type: "danger",
        icon: "🖨️",
        title: "印刷画面を開けませんでした",
        message: "ブラウザのポップアップがブロックされている可能性があります。",
        notice: "このサイトのポップアップを許可してから、もう一度印刷してください。",
        confirmText: "閉じる"
      });
      return;
    }
    const total = items.reduce(function (sum, item) { return sum + Number(item.quantity || 0); }, 0);
    const rows = items.map(function (item, index) {
      return `
        <tr>
          <td>${index + 1}</td>
          <td>${escapeHtml(item.internalCode || "")}</td>
          <td>${escapeHtml(item.productCode || "-")}</td>
          <td>${escapeHtml(item.productName || "")}</td>
          <td class="qty">${formatNumber(Number(item.quantity || 0))}</td>
          <td><span class="check-box">${record.sourceConfirmedAt ? "☑" : "□"}</span></td>
          <td><span class="check-box">${record.destinationConfirmedAt ? "☑" : "□"}</span></td>
        </tr>
      `;
    }).join("");

    printWindow.document.open();
    printWindow.document.write(`<!DOCTYPE html>
      <html lang="ja">
      <head>
        <meta charset="UTF-8">
        <title>商品移動リスト_${escapeHtml(record.transferDate || "")}</title>
        <style>
          @page { size: A4 portrait; margin: 12mm; }
          * { box-sizing: border-box; }
          body { font-family: "Yu Gothic", "Meiryo", sans-serif; color: #111; margin: 0; font-size: 12px; }
          h1 { font-size: 22px; margin: 0 0 10px; }
          .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 18px; margin-bottom: 12px; font-size: 13px; }
          .route { grid-column: 1 / -1; font-size: 17px; font-weight: 700; border: 2px solid #222; padding: 8px 10px; }
          table { width: 100%; border-collapse: collapse; table-layout: fixed; }
          th, td { border: 1px solid #555; padding: 6px 5px; vertical-align: middle; overflow-wrap: anywhere; }
          th { background: #f1f1f1; text-align: center; }
          th:nth-child(1), td:nth-child(1) { width: 6%; text-align: center; }
          th:nth-child(2), td:nth-child(2) { width: 16%; }
          th:nth-child(3), td:nth-child(3) { width: 16%; }
          th:nth-child(4), td:nth-child(4) { width: 32%; }
          th:nth-child(5), td:nth-child(5) { width: 10%; }
          th:nth-child(6), td:nth-child(6), th:nth-child(7), td:nth-child(7) { width: 10%; text-align: center; }
          .qty { text-align: right; font-weight: 700; }
          .check-box { font-size: 22px; line-height: 1; font-family: Arial, sans-serif; }
          .summary { margin-top: 10px; text-align: right; font-size: 14px; font-weight: 700; }
          .confirm-area { margin-top: 16px; border: 1.5px solid #555; padding: 10px 12px; break-inside: avoid; }
          .confirm-title { font-size: 14px; font-weight: 700; margin-bottom: 8px; }
          .confirm-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 24px; margin-top: 8px; }
          .confirm-line { border-bottom: 1px solid #333; display: inline-block; min-width: 150px; height: 18px; vertical-align: bottom; }
          .confirm-date-line { border-bottom: 1px solid #333; display: inline-block; min-width: 100px; height: 18px; vertical-align: bottom; }
          .footer { margin-top: 10px; font-size: 10px; color: #555; }
          @media print { .no-print { display: none !important; } }
        </style>
      </head>
      <body>
        <h1>商品移動リスト</h1>
        <div class="meta">
          <div><strong>移動日：</strong>${escapeHtml(formatDate(record.transferDate))}</div>
          <div><strong>商品数：</strong>${items.length}商品</div>
          <div class="route">${escapeHtml(record.sourceLocation || "-")}　→　${escapeHtml(record.destinationLocation || "-")}</div>
        </div>
        <table>
          <thead>
            <tr><th>No</th><th>社内コード</th><th>商品コード</th><th>商品名</th><th>移動個数</th><th>移動元確認</th><th>移動先確認</th></tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <div class="summary">移動個数 合計：${formatNumber(total)}個　／　確認状況：${escapeHtml(getTransferStatusText(record))}</div>
        <div class="confirm-area">
          <div class="confirm-title">移動確認欄</div>
          <div class="confirm-row">
            <div><strong>移動元 確認者：</strong>${record.sourceConfirmedBy ? escapeHtml(record.sourceConfirmedBy) : '<span class="confirm-line"></span>'}</div>
            <div><strong>確認日：</strong>${record.sourceConfirmedAt ? escapeHtml(formatDateTime(record.sourceConfirmedAt)) : '<span class="confirm-date-line"></span>'}</div>
            <div><strong>移動先 確認者：</strong>${record.destinationConfirmedBy ? escapeHtml(record.destinationConfirmedBy) : '<span class="confirm-line"></span>'}</div>
            <div><strong>確認日：</strong>${record.destinationConfirmedAt ? escapeHtml(formatDateTime(record.destinationConfirmedAt)) : '<span class="confirm-date-line"></span>'}</div>
            <div><strong>在庫反映：</strong>${record.inventoryAppliedBy ? escapeHtml(record.inventoryAppliedBy) : '<span class="confirm-line"></span>'}</div>
            <div><strong>反映日：</strong>${record.inventoryAppliedAt ? escapeHtml(formatDateTime(record.inventoryAppliedAt)) : '<span class="confirm-date-line"></span>'}</div>
          </div>
        </div>
        <div class="footer">バーコード在庫・棚卸管理アプリ v62</div>
        <script>window.onload = function () { window.print(); };<\/script>
      </body>
      </html>`);
    printWindow.document.close();
  }

  function createTransferId() {
    return `transfer-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function formatNumber(value) {
    return Number(value || 0).toLocaleString("ja-JP");
  }

  function formatDate(value) {
    if (!value) return "";
    const parts = String(value).split("-");
    if (parts.length !== 3) return String(value);
    return `${Number(parts[0])}/${Number(parts[1])}/${Number(parts[2])}`;
  }

  function getTransferStatusText(record) {
    if (record?.sourceConfirmedAt && record?.destinationConfirmedAt && record?.inventoryAppliedAt) {
      return "移動完了・在庫反映済";
    }
    if (record?.sourceConfirmedAt && record?.destinationConfirmedAt) {
      return "移動完了・在庫未反映";
    }
    if (record?.sourceConfirmedAt) return "移動元確認済";
    return "未確認";
  }

  function formatDateTime(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleString("ja-JP", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });
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
