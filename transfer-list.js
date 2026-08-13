"use strict";

(function () {
  const LOCATION_OPTIONS = [
    "酒本倉庫1階",
    "酒本倉庫2階",
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
    "本社2階 F区"
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
        この機能では現在庫の数量や保管場所は自動変更しません。
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
    document.querySelector("#transfer-clear-button")?.addEventListener("click", function () {
      if (state.items.length > 0 && !window.confirm("入力中の商品をすべてクリアしますか？")) return;
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
      alert("商品移動リストを表示できませんでした。");
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
      select.innerHTML = '<option value="">選択してください</option>' + LOCATION_OPTIONS.map(function (location) {
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

  function addProductToTransfer() {
    const codeInput = document.querySelector("#transfer-internal-code");
    const quantityInput = document.querySelector("#transfer-add-quantity");
    const internalCode = String(codeInput?.value || "").trim();
    const quantity = Math.trunc(Number(quantityInput?.value || 0));

    if (!internalCode) {
      alert("社内コードを入力してください。");
      codeInput?.focus();
      return;
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      alert("移動個数は1以上の数字で入力してください。");
      quantityInput?.focus();
      return;
    }

    const product = state.products.find(function (item) {
      return String(item.internalCode || "").trim() === internalCode;
    });
    if (!product) {
      alert(`社内コード「${internalCode}」の商品は登録されていません。`);
      codeInput?.focus();
      return;
    }

    const existing = state.items.find(function (item) {
      return item.internalCode === internalCode;
    });
    if (existing) {
      const add = window.confirm(
        `${internalCode} ${existing.productName} はすでに追加されています。\n\n現在 ${existing.quantity}個 に ${quantity}個を追加しますか？`
      );
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
      const record = {
        id: state.editingId || createTransferId(),
        transferDate: header.transferDate,
        sourceLocation: header.sourceLocation,
        destinationLocation: header.destinationLocation,
        items: state.items.map(function (item) {
          return {
            internalCode: item.internalCode,
            productCode: item.productCode || "",
            productName: item.productName,
            storageLocation: item.storageLocation || "",
            quantity: Number(item.quantity)
          };
        }),
        createdAt: existing?.createdAt || now,
        updatedAt: now
      };

      await saveTransferList(record);
      alert(state.editingId ? "商品移動リストを更新しました。" : "商品移動リストを保存しました。");
      resetForm();
      await renderSavedTransfers();
    } catch (error) {
      console.error("商品移動リスト保存エラー", error);
      alert(error.message || "商品移動リストを保存できませんでした。");
    }
  }

  function printCurrentTransfer() {
    try {
      const header = validateCurrentTransfer();
      const record = {
        transferDate: header.transferDate,
        sourceLocation: header.sourceLocation,
        destinationLocation: header.destinationLocation,
        items: state.items.map(function (item) { return { ...item, quantity: Number(item.quantity) }; })
      };
      printTransferRecord(record);
    } catch (error) {
      alert(error.message || "印刷する内容を確認してください。");
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
          <td>
            <div class="transfer-row-actions">
              <button type="button" data-transfer-edit="${escapeHtml(record.id)}">編集</button>
              <button type="button" data-transfer-print="${escapeHtml(record.id)}">印刷</button>
              <button type="button" class="transfer-delete-button" data-transfer-delete="${escapeHtml(record.id)}">削除</button>
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
      button.addEventListener("click", function () {
        const record = records.find(function (item) { return item.id === button.dataset.transferPrint; });
        if (record) printTransferRecord(record);
      });
    });
    body.querySelectorAll("[data-transfer-delete]").forEach(function (button) {
      button.addEventListener("click", async function () {
        const record = records.find(function (item) { return item.id === button.dataset.transferDelete; });
        if (!record) return;
        const confirmed = window.confirm(
          `${formatDate(record.transferDate)}\n${record.sourceLocation} → ${record.destinationLocation}\n\nこの商品移動リストを削除しますか？`
        );
        if (!confirmed) return;
        try {
          await deleteTransferList(record.id);
          if (state.editingId === record.id) resetForm();
          await renderSavedTransfers();
        } catch (error) {
          console.error("商品移動リスト削除エラー", error);
          alert("商品移動リストを削除できませんでした。");
        }
      });
    });
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

  function printTransferRecord(record) {
    const items = Array.isArray(record.items) ? record.items : [];
    if (items.length === 0) {
      alert("印刷する商品がありません。");
      return;
    }
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("印刷画面を開けませんでした。ブラウザのポップアップ許可を確認してください。");
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
          th:nth-child(1), td:nth-child(1) { width: 8%; text-align: center; }
          th:nth-child(2), td:nth-child(2) { width: 18%; }
          th:nth-child(3), td:nth-child(3) { width: 20%; }
          th:nth-child(4), td:nth-child(4) { width: 42%; }
          th:nth-child(5), td:nth-child(5) { width: 12%; }
          .qty { text-align: right; font-weight: 700; }
          .summary { margin-top: 10px; text-align: right; font-size: 14px; font-weight: 700; }
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
            <tr><th>No</th><th>社内コード</th><th>商品コード</th><th>商品名</th><th>移動個数</th></tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <div class="summary">移動個数 合計：${formatNumber(total)}個</div>
        <div class="footer">バーコード在庫・棚卸管理アプリ v54</div>
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

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
})();
