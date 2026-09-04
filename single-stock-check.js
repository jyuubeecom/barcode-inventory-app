"use strict";

(function () {
  const SCREEN_ID = "single-stock-check-screen";
  const BUTTON_ID = "show-single-stock-check-button";
  const LOCATION_ORDER = ["本社", "酒本倉庫1階", "酒本倉庫2階"];

  let selectedProduct = null;
  let allProducts = [];

  document.addEventListener("DOMContentLoaded", initializeSingleStockCheck);

  function initializeSingleStockCheck() {
    createHomeButton();
    createScreen();
    createStyle();
  }

  function createHomeButton() {
    if (document.querySelector(`#${BUTTON_ID}`)) {
      return;
    }

    const button = document.createElement("button");
    button.id = BUTTON_ID;
    button.type = "button";
    button.textContent = "商品単体の在庫確認";
    button.classList.add("home-action-stocktaking");
    button.addEventListener("click", openSingleStockCheck);

    const target = document.querySelector("#home-stocktaking-buttons");
    if (target) {
      target.prepend(button);
      return;
    }

    const home = document.querySelector("#home");
    if (home) {
      home.appendChild(button);
    }
  }

  function createScreen() {
    const existing = document.querySelector(`#${SCREEN_ID}`);
    if (existing) {
      existing.remove();
    }

    const main = document.querySelector("main");
    if (!main) {
      return;
    }

    const section = document.createElement("section");
    section.id = SCREEN_ID;
    section.hidden = true;
    section.innerHTML = `
      <div class="single-check-shell">
        <div class="single-check-heading">
          <div>
            <span class="single-check-kicker">在庫の再確認</span>
            <h2>商品単体の在庫確認</h2>
          </div>
          <button id="single-check-back-home" type="button">ホームへ戻る</button>
        </div>

        <div class="single-check-notice">
          <strong>おすすめの確認タイミング</strong>
          <span>当日の出荷が終わり、当日の販売実績CSVを反映したあとにカウントしてください。</span>
          <span>この画面では、選んだ1商品と実在庫を入力した保管場所だけを確認します。他の商品には影響しません。</span>
        </div>

        <section class="single-check-panel">
          <h3>1. 確認する商品を探す</h3>
          <div class="single-check-search-row">
            <input id="single-check-search" type="search" autocomplete="off" placeholder="社内コード・商品コード・JANコード・商品名で検索">
            <button id="single-check-search-button" type="button">商品を検索</button>
          </div>
          <p id="single-check-search-status" class="single-check-status" aria-live="polite">商品を検索してください。</p>
          <div id="single-check-candidates" class="single-check-candidates" hidden></div>
        </section>

        <section id="single-check-product-panel" class="single-check-panel" hidden>
          <div class="single-check-product-title-row">
            <div>
              <h3 id="single-check-product-name">商品名</h3>
              <div id="single-check-product-codes" class="single-check-product-codes"></div>
            </div>
            <div class="single-check-total-card">
              <span>登録総在庫</span>
              <strong id="single-check-total-stock">0個</strong>
            </div>
          </div>

          <div class="single-check-location-help">
            <strong>2. 実際に数えた数量を入力</strong>
            <span>確認した場所だけ入力してください。空欄の場所は変更も記録もされません。0個を確認した場合は「0」と入力します。</span>
          </div>

          <div class="single-check-location-table-wrap">
            <table class="single-check-location-table">
              <thead>
                <tr>
                  <th>保管場所</th>
                  <th>登録在庫</th>
                  <th>実在庫</th>
                  <th>差異</th>
                </tr>
              </thead>
              <tbody id="single-check-location-body"></tbody>
            </table>
          </div>

          <div class="single-check-summary" id="single-check-summary">
            実在庫を入力すると差異を表示します。
          </div>

          <div class="single-check-form-grid">
            <div>
              <label for="single-check-person">担当者（必須）</label>
              <input id="single-check-person" type="text" autocomplete="name" placeholder="例：柳生">
            </div>
            <div>
              <label for="single-check-memo">メモ（任意）</label>
              <input id="single-check-memo" type="text" placeholder="例：出荷終了後に再確認">
            </div>
          </div>

          <div class="single-check-action-info">
            <div>
              <strong>確認結果だけ保存</strong>
              <span>在庫数は変更せず、「在庫確認」として履歴を残します。</span>
            </div>
            <div>
              <strong>実在庫を現在庫へ反映</strong>
              <span>入力した保管場所だけを実在庫へ修正し、「棚卸調整」として履歴を残します。</span>
            </div>
          </div>

          <div class="single-check-actions">
            <button id="single-check-save-only" type="button" class="single-check-secondary">確認結果だけ保存</button>
            <button id="single-check-apply" type="button" class="single-check-primary">実在庫を現在庫へ反映</button>
          </div>

          <p class="single-check-final-note">
            ※ 本社の商品が複数区画に置かれている場合は、本社1階A～F区・本社2階にある同じ商品をすべて数え、その合計を「本社」の実在庫として入力してください。
          </p>
        </section>
      </div>
    `;

    main.appendChild(section);

    section.querySelector("#single-check-back-home").addEventListener("click", closeSingleStockCheck);
    section.querySelector("#single-check-search-button").addEventListener("click", runProductSearch);
    section.querySelector("#single-check-search").addEventListener("keydown", function (event) {
      if (event.key === "Enter") {
        event.preventDefault();
        void runProductSearch();
      }
    });
    section.querySelector("#single-check-location-body").addEventListener("input", handleActualStockInput);
    section.querySelector("#single-check-save-only").addEventListener("click", function () {
      void saveSingleCheck(false);
    });
    section.querySelector("#single-check-apply").addEventListener("click", function () {
      void saveSingleCheck(true);
    });
  }

  async function openSingleStockCheck() {
    hideAllMainSections();
    const screen = document.querySelector(`#${SCREEN_ID}`);
    if (!screen) {
      return;
    }

    screen.hidden = false;
    selectedProduct = null;
    resetProductPanel();

    try {
      allProducts = typeof getAllProducts === "function" ? await getAllProducts() : [];
      allProducts = Array.isArray(allProducts) ? allProducts : [];
    } catch (error) {
      console.error(error);
      allProducts = [];
      await showDialog({
        type: "danger",
        icon: "⚠️",
        title: "商品データを読み込めませんでした",
        message: "画面を更新して、もう一度お試しください。",
        confirmText: "閉じる"
      });
    }

    const search = document.querySelector("#single-check-search");
    if (search) {
      search.value = "";
      search.focus();
    }
  }

  function closeSingleStockCheck() {
    const screen = document.querySelector(`#${SCREEN_ID}`);
    if (screen) {
      screen.hidden = true;
    }

    if (window.inventoryApp && typeof window.inventoryApp.showScreen === "function") {
      window.inventoryApp.showScreen("home");
      return;
    }

    const home = document.querySelector("#home");
    if (home) {
      home.hidden = false;
    }
  }

  function hideAllMainSections() {
    document.querySelectorAll("main > section").forEach(function (section) {
      section.hidden = true;
    });
  }

  async function runProductSearch() {
    const input = document.querySelector("#single-check-search");
    const keyword = normalizeSearchText(input ? input.value : "");
    const status = document.querySelector("#single-check-search-status");
    const candidates = document.querySelector("#single-check-candidates");

    if (!keyword) {
      if (status) {
        status.textContent = "社内コード・商品コード・JANコード・商品名を入力してください。";
      }
      if (input) input.focus();
      return;
    }

    if (!allProducts.length) {
      try {
        allProducts = await getAllProducts();
      } catch (error) {
        console.error(error);
      }
    }

    const exactMatches = allProducts.filter(function (product) {
      return [product.internalCode, product.productCode, product.janCode]
        .map(normalizeSearchText)
        .some(function (value) {
          return value !== "" && value === keyword;
        });
    });

    if (exactMatches.length === 1) {
      selectProduct(exactMatches[0]);
      return;
    }

    const matches = allProducts.filter(function (product) {
      const values = [
        product.internalCode,
        product.productCode,
        product.janCode,
        product.productName,
        product.productColor
      ].map(normalizeSearchText);

      return values.some(function (value) {
        return value.includes(keyword);
      });
    }).slice(0, 30);

    if (matches.length === 0) {
      selectedProduct = null;
      resetProductPanel();
      if (status) status.textContent = `「${input.value.trim()}」に一致する商品が見つかりませんでした。`;
      if (candidates) candidates.hidden = true;
      return;
    }

    if (matches.length === 1) {
      selectProduct(matches[0]);
      return;
    }

    if (status) {
      status.textContent = `${matches.length}件の候補があります。確認する商品を選んでください。`;
    }

    if (candidates) {
      candidates.innerHTML = "";
      matches.forEach(function (product) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "single-check-candidate";
        button.innerHTML = `
          <strong>${escapeHtml(product.productName || "商品名未登録")}</strong>
          <span>社内コード：${escapeHtml(product.internalCode || "-")}　商品コード：${escapeHtml(product.productCode || "-")}　JAN：${escapeHtml(product.janCode || "-")}</span>
        `;
        button.addEventListener("click", function () {
          selectProduct(product);
        });
        candidates.appendChild(button);
      });
      candidates.hidden = false;
    }
  }

  function selectProduct(product) {
    selectedProduct = product;

    const status = document.querySelector("#single-check-search-status");
    const candidates = document.querySelector("#single-check-candidates");
    const panel = document.querySelector("#single-check-product-panel");
    const productName = document.querySelector("#single-check-product-name");
    const productCodes = document.querySelector("#single-check-product-codes");
    const totalStock = document.querySelector("#single-check-total-stock");
    const body = document.querySelector("#single-check-location-body");

    if (status) status.textContent = "確認する商品を選択しました。実在庫を入力してください。";
    if (candidates) candidates.hidden = true;
    if (panel) panel.hidden = false;
    if (productName) productName.textContent = product.productName || "商品名未登録";
    if (productCodes) {
      productCodes.textContent = `社内コード：${product.internalCode || "-"}　商品コード：${product.productCode || "-"}　JAN：${product.janCode || "-"}`;
    }
    if (totalStock) totalStock.textContent = `${toInt(product.stock)}個`;

    const stocks = getThreeBaseStocks(product);
    if (body) {
      body.innerHTML = LOCATION_ORDER.map(function (location) {
        const registered = stocks[location] || 0;
        return `
          <tr data-location="${escapeHtml(location)}" data-registered="${registered}">
            <th>${escapeHtml(location)}</th>
            <td class="single-check-registered">${registered.toLocaleString("ja-JP")}個</td>
            <td>
              <input class="single-check-actual" type="number" min="0" step="1" inputmode="numeric" placeholder="未確認" aria-label="${escapeHtml(location)}の実在庫">
            </td>
            <td class="single-check-difference">未確認</td>
          </tr>
        `;
      }).join("");
    }

    const person = document.querySelector("#single-check-person");
    const memo = document.querySelector("#single-check-memo");
    if (person) person.value = "";
    if (memo) memo.value = "";
    updateSummary();

    const firstInput = document.querySelector(".single-check-actual");
    if (firstInput) {
      firstInput.focus();
    }
  }

  function resetProductPanel() {
    const panel = document.querySelector("#single-check-product-panel");
    const candidates = document.querySelector("#single-check-candidates");
    const status = document.querySelector("#single-check-search-status");
    if (panel) panel.hidden = true;
    if (candidates) {
      candidates.hidden = true;
      candidates.innerHTML = "";
    }
    if (status) status.textContent = "商品を検索してください。";
  }

  function handleActualStockInput(event) {
    if (!event.target.classList.contains("single-check-actual")) {
      return;
    }

    const row = event.target.closest("tr");
    if (!row) return;

    const differenceCell = row.querySelector(".single-check-difference");
    const registered = toInt(row.dataset.registered);
    const raw = event.target.value;

    if (raw === "") {
      if (differenceCell) {
        differenceCell.textContent = "未確認";
        differenceCell.className = "single-check-difference";
      }
      updateSummary();
      return;
    }

    const actual = Number(raw);
    if (!Number.isInteger(actual) || actual < 0) {
      if (differenceCell) {
        differenceCell.textContent = "入力確認";
        differenceCell.className = "single-check-difference is-warning";
      }
      updateSummary();
      return;
    }

    const diff = actual - registered;
    if (differenceCell) {
      differenceCell.textContent = formatDifference(diff);
      differenceCell.className = "single-check-difference " + (diff === 0 ? "is-zero" : diff < 0 ? "is-minus" : "is-plus");
    }
    updateSummary();
  }

  function updateSummary() {
    const summary = document.querySelector("#single-check-summary");
    if (!summary) return;

    const entries = collectCheckedEntries(false);
    if (entries.length === 0) {
      summary.textContent = "実在庫を入力すると差異を表示します。";
      summary.className = "single-check-summary";
      return;
    }

    const invalid = entries.some(function (entry) { return !entry.valid; });
    if (invalid) {
      summary.textContent = "0以上の整数で実在庫を入力してください。";
      summary.className = "single-check-summary is-warning";
      return;
    }

    const registered = entries.reduce(function (sum, entry) { return sum + entry.registered; }, 0);
    const actual = entries.reduce(function (sum, entry) { return sum + entry.actual; }, 0);
    const diff = actual - registered;
    summary.textContent = `確認場所：${entries.length}か所　登録 ${registered.toLocaleString("ja-JP")}個 → 実在庫 ${actual.toLocaleString("ja-JP")}個　差異 ${formatDifference(diff)}`;
    summary.className = "single-check-summary " + (diff === 0 ? "is-zero" : diff < 0 ? "is-minus" : "is-plus");
  }

  function collectCheckedEntries(onlyValid) {
    return Array.from(document.querySelectorAll("#single-check-location-body tr")).map(function (row) {
      const input = row.querySelector(".single-check-actual");
      const raw = input ? input.value : "";
      if (raw === "") return null;
      const actual = Number(raw);
      const entry = {
        location: row.dataset.location,
        registered: toInt(row.dataset.registered),
        actual: actual,
        valid: Number.isInteger(actual) && actual >= 0
      };
      if (onlyValid && !entry.valid) return null;
      return entry;
    }).filter(Boolean);
  }

  async function saveSingleCheck(applyInventory) {
    if (!selectedProduct) {
      await showDialog({
        type: "warning",
        icon: "🔎",
        title: "商品を選択してください",
        message: "確認する商品を検索して選択してください。",
        confirmText: "確認する"
      });
      return;
    }

    const entries = collectCheckedEntries(false);
    if (entries.length === 0) {
      await showDialog({
        type: "warning",
        icon: "📦",
        title: "実在庫を入力してください",
        message: "確認した保管場所の実在庫を1か所以上入力してください。0個を確認した場合は「0」と入力してください。",
        confirmText: "入力に戻る"
      });
      return;
    }

    if (entries.some(function (entry) { return !entry.valid; })) {
      await showDialog({
        type: "warning",
        icon: "⚠️",
        title: "実在庫を確認してください",
        message: "実在庫は0以上の整数で入力してください。",
        confirmText: "入力に戻る"
      });
      return;
    }

    const personInput = document.querySelector("#single-check-person");
    const memoInput = document.querySelector("#single-check-memo");
    const person = personInput ? personInput.value.trim() : "";
    const memo = memoInput ? memoInput.value.trim() : "";

    if (!person) {
      await showDialog({
        type: "warning",
        icon: "👤",
        title: "担当者を入力してください",
        message: "在庫確認を記録する担当者名を入力してください。",
        confirmText: "入力に戻る"
      });
      if (personInput) personInput.focus();
      return;
    }

    const beforeTotal = toInt(selectedProduct.stock);
    const totalDifference = entries.reduce(function (sum, entry) {
      return sum + (entry.actual - entry.registered);
    }, 0);
    const afterTotal = beforeTotal + totalDifference;

    if (applyInventory && afterTotal < 0) {
      await showDialog({
        type: "danger",
        icon: "⚠️",
        title: "在庫数を反映できません",
        message: "反映後の総在庫が0個未満になるため、入力内容を確認してください。",
        confirmText: "入力に戻る"
      });
      return;
    }

    const locationDetails = entries.map(function (entry) {
      return `${entry.location}：${entry.registered}個 → ${entry.actual}個（差異 ${formatDifference(entry.actual - entry.registered)}）`;
    });

    const confirmed = await showDialog({
      type: applyInventory ? "warning" : "info",
      icon: applyInventory ? "📦" : "🔎",
      title: applyInventory ? "実在庫を現在庫へ反映しますか？" : "在庫確認結果を保存しますか？",
      message: applyInventory
        ? "入力した保管場所だけを実在庫へ修正します。他の商品と空欄の保管場所は変更しません。"
        : "現在庫は変更せず、確認結果だけを履歴へ保存します。",
      details: [
        { label: "商品", value: `${selectedProduct.productCode || selectedProduct.internalCode} ${selectedProduct.productName || ""}`.trim() },
        { label: "確認場所", value: `${entries.length}か所` },
        { label: "総差異", value: formatDifference(totalDifference) },
        { label: "担当者", value: person }
      ].concat(locationDetails.map(function (text, index) {
        return { label: `確認${index + 1}`, value: text };
      })),
      notice: applyInventory
        ? "確定すると、入力した保管場所の在庫だけを変更し、入出庫履歴へ「棚卸調整」として記録します。"
        : "この保存では在庫数を変更しません。",
      isConfirm: true,
      cancelText: "戻る",
      confirmText: applyInventory ? "実在庫を反映する" : "確認結果を保存する"
    });

    if (!confirmed) return;

    try {
      const now = new Date().toISOString();
      let productToSave = { ...selectedProduct };
      let movement;

      const detailMemo = [
        "商品単体の在庫再確認",
        applyInventory ? "実在庫を現在庫へ反映" : "確認のみ・在庫未反映",
        ...locationDetails,
        memo ? `メモ：${memo}` : ""
      ].filter(Boolean).join(" / ");

      if (applyInventory) {
        const currentStocks = getThreeBaseStocks(selectedProduct);
        entries.forEach(function (entry) {
          currentStocks[entry.location] = entry.actual;
        });

        let locationStocks = LOCATION_ORDER.map(function (location) {
          return { location: location, stock: toInt(currentStocks[location]) };
        }).filter(function (entry) {
          return entry.stock > 0;
        });

        if (afterTotal === 0) {
          locationStocks = [{ location: entries[0].location, stock: 0 }];
        }

        const currentPrimary = normalizeToBaseLocation(selectedProduct.location);
        const positiveLocations = locationStocks.filter(function (entry) { return entry.stock > 0; });
        const primaryLocation = positiveLocations.some(function (entry) { return entry.location === currentPrimary; })
          ? currentPrimary
          : positiveLocations.length > 0
            ? positiveLocations[0].location
            : entries[0].location;

        productToSave = {
          ...selectedProduct,
          stock: afterTotal,
          location: primaryLocation,
          locationStocks: locationStocks,
          updatedAt: now
        };

        movement = {
          id: createCheckMovementId("single-adjust"),
          dateTime: now,
          internalCode: selectedProduct.internalCode,
          productCode: selectedProduct.productCode || "",
          productName: selectedProduct.productName || "",
          janCode: selectedProduct.janCode || "",
          type: "棚卸調整",
          quantity: totalDifference,
          beforeStock: beforeTotal,
          afterStock: afterTotal,
          person: person,
          reason: "商品単体の在庫再確認",
          memo: detailMemo,
          location: entries.map(function (entry) { return entry.location; }).join(" / ")
        };
      } else {
        movement = {
          id: createCheckMovementId("single-check"),
          dateTime: now,
          internalCode: selectedProduct.internalCode,
          productCode: selectedProduct.productCode || "",
          productName: selectedProduct.productName || "",
          janCode: selectedProduct.janCode || "",
          type: "在庫確認",
          quantity: 0,
          beforeStock: beforeTotal,
          afterStock: beforeTotal,
          person: person,
          reason: "商品単体の在庫再確認",
          memo: detailMemo,
          location: entries.map(function (entry) { return entry.location; }).join(" / ")
        };
      }

      if (typeof recordStockMovement !== "function") {
        throw new Error("recordStockMovement is not available");
      }

      await recordStockMovement(productToSave, movement);

      if (applyInventory && window.inventoryApp && typeof window.inventoryApp.applyUpdatedProduct === "function") {
        window.inventoryApp.applyUpdatedProduct(productToSave);
      }

      selectedProduct = productToSave;
      allProducts = allProducts.map(function (product) {
        return product.internalCode === productToSave.internalCode ? productToSave : product;
      });
      selectProduct(productToSave);

      await showDialog({
        type: "success",
        icon: "✅",
        title: applyInventory ? "実在庫を反映しました" : "在庫確認を記録しました",
        message: applyInventory
          ? "入力した保管場所だけを更新しました。他の商品には影響していません。"
          : "現在庫は変更せず、確認結果だけを履歴へ保存しました。",
        details: [
          { label: "商品", value: selectedProduct.productName || "商品名未登録" },
          { label: "差異", value: formatDifference(totalDifference) },
          { label: "現在の総在庫", value: `${toInt(productToSave.stock)}個` }
        ],
        confirmText: "閉じる"
      });
    } catch (error) {
      console.error(error);
      await showDialog({
        type: "danger",
        icon: "⚠️",
        title: "在庫確認を保存できませんでした",
        message: "保存処理でエラーが発生しました。画面を更新して、もう一度お試しください。",
        confirmText: "閉じる"
      });
    }
  }

  function getThreeBaseStocks(product) {
    const result = { "本社": 0, "酒本倉庫1階": 0, "酒本倉庫2階": 0 };
    const entries = Array.isArray(product && product.locationStocks) ? product.locationStocks : [];

    if (entries.length === 0) {
      const location = normalizeToBaseLocation(product && product.location);
      if (location && Object.prototype.hasOwnProperty.call(result, location)) {
        result[location] = toInt(product && product.stock);
      }
      return result;
    }

    entries.forEach(function (entry) {
      const location = normalizeToBaseLocation(entry && entry.location);
      if (location && Object.prototype.hasOwnProperty.call(result, location)) {
        result[location] += toInt(entry && entry.stock);
      }
    });

    return result;
  }

  function normalizeToBaseLocation(value) {
    const text = String(value || "").normalize("NFKC").trim().replace(/[\s\u3000]+/g, " ");
    if (/^本社(?:[12]階(?: [A-F]区)?)?$/.test(text) || /^本社[12]階\s*[A-Fa-f]区$/.test(text)) {
      return "本社";
    }
    if (text === "本社") return "本社";
    if (text === "酒本倉庫1階") return "酒本倉庫1階";
    if (text === "酒本倉庫2階") return "酒本倉庫2階";
    return text;
  }

  function normalizeSearchText(value) {
    return String(value || "").normalize("NFKC").trim().toLowerCase().replace(/[\s\u3000]+/g, "");
  }

  function toInt(value) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(0, Math.trunc(number)) : 0;
  }

  function formatDifference(value) {
    const number = Number(value) || 0;
    if (number > 0) return `＋${number.toLocaleString("ja-JP")}個`;
    return `${number.toLocaleString("ja-JP")}個`;
  }

  function createCheckMovementId(prefix) {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  async function showDialog(options) {
    if (window.inventoryApp && typeof window.inventoryApp.showAppDialog === "function") {
      return window.inventoryApp.showAppDialog(options);
    }

    const message = [options.title, options.message].filter(Boolean).join("\n\n");
    if (options.isConfirm) {
      return window.confirm(message);
    }
    window.alert(message);
    return true;
  }

  function createStyle() {
    if (document.querySelector("#single-stock-check-style")) return;
    const style = document.createElement("style");
    style.id = "single-stock-check-style";
    style.textContent = `
      #${SCREEN_ID} { max-width: 1120px; margin: 0 auto; padding: 24px 18px 60px; }
      .single-check-shell { background:#fff; border-radius:16px; box-shadow:0 6px 22px rgba(30,74,120,.1); padding:24px; }
      .single-check-heading { display:flex; align-items:flex-start; justify-content:space-between; gap:16px; border-bottom:2px solid #71b7ff; padding-bottom:14px; margin-bottom:18px; }
      .single-check-heading h2 { margin:4px 0 0; color:#075fb8; }
      .single-check-kicker { font-size:.82rem; font-weight:800; color:#1768b7; }
      #single-check-back-home { background:#176cc7; color:#fff; border:0; border-radius:8px; padding:12px 18px; font-weight:800; }
      .single-check-notice { display:grid; gap:6px; padding:14px 16px; border-left:5px solid #ef8a00; background:#fff6e6; border-radius:8px; margin-bottom:18px; line-height:1.7; }
      .single-check-panel { border:1px solid #b9d9f6; border-radius:12px; padding:18px; margin-top:16px; }
      .single-check-panel h3 { margin:0 0 14px; color:#183a59; }
      .single-check-search-row { display:grid; grid-template-columns:1fr auto; gap:10px; }
      .single-check-search-row input, .single-check-form-grid input, .single-check-actual { width:100%; min-height:46px; border:1px solid #9fb4c7; border-radius:8px; padding:9px 12px; font-size:1rem; box-sizing:border-box; }
      #single-check-search-button { min-width:150px; background:#176cc7; color:#fff; border:0; border-radius:8px; font-weight:800; padding:0 18px; }
      .single-check-status { margin:10px 0 0; padding:10px 12px; background:#eef6fd; border-radius:8px; }
      .single-check-candidates { display:grid; gap:8px; margin-top:10px; max-height:360px; overflow:auto; }
      .single-check-candidate { display:grid; gap:4px; text-align:left; border:1px solid #a9ccef; background:#fff; border-radius:8px; padding:12px; cursor:pointer; }
      .single-check-candidate:hover { background:#f0f7ff; }
      .single-check-candidate span { font-size:.9rem; color:#52687b; }
      .single-check-product-title-row { display:flex; justify-content:space-between; gap:16px; align-items:center; }
      .single-check-product-title-row h3 { font-size:1.35rem; color:#006c64; margin-bottom:6px; }
      .single-check-product-codes { color:#4b6477; line-height:1.6; }
      .single-check-total-card { min-width:150px; display:grid; gap:3px; padding:12px 16px; background:#eefaf8; border:1px solid #9fdcd4; border-radius:10px; text-align:right; }
      .single-check-total-card span { font-size:.85rem; color:#4c7070; }
      .single-check-total-card strong { font-size:1.5rem; color:#006c64; }
      .single-check-location-help { display:grid; gap:5px; margin:18px 0 10px; padding:12px; background:#f2f8fd; border-radius:8px; }
      .single-check-location-table-wrap { overflow-x:auto; }
      .single-check-location-table { width:100%; border-collapse:collapse; min-width:620px; }
      .single-check-location-table th, .single-check-location-table td { border:1px solid #c5d5e2; padding:12px; vertical-align:middle; }
      .single-check-location-table thead th { background:#31566a; color:#fff; }
      .single-check-location-table tbody th { text-align:left; background:#f6fafc; }
      .single-check-registered { font-weight:800; text-align:right; }
      .single-check-actual { max-width:180px; font-size:1.1rem; font-weight:800; }
      .single-check-difference { font-weight:800; text-align:center; color:#647787; }
      .single-check-difference.is-zero, .single-check-summary.is-zero { color:#1d7b36; }
      .single-check-difference.is-minus, .single-check-summary.is-minus { color:#c62929; }
      .single-check-difference.is-plus, .single-check-summary.is-plus { color:#d16a00; }
      .single-check-difference.is-warning, .single-check-summary.is-warning { color:#a35400; }
      .single-check-summary { margin-top:12px; padding:12px 14px; background:#f6f8fa; border-radius:8px; font-weight:800; }
      .single-check-form-grid { display:grid; grid-template-columns:1fr 1fr; gap:14px; margin-top:18px; }
      .single-check-form-grid label { display:block; font-weight:800; margin-bottom:6px; }
      .single-check-action-info { display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-top:18px; }
      .single-check-action-info > div { display:grid; gap:5px; padding:12px; border:1px solid #c8d8e6; border-radius:8px; background:#fbfdff; }
      .single-check-action-info span { font-size:.9rem; color:#52687b; line-height:1.55; }
      .single-check-actions { display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-top:12px; }
      .single-check-actions button { min-height:52px; border:0; border-radius:9px; color:#fff; font-weight:900; font-size:1rem; }
      .single-check-secondary { background:#526f80; }
      .single-check-primary { background:#148334; }
      .single-check-final-note { margin:16px 0 0; padding:12px 14px; background:#fff6e8; border-left:4px solid #ef8a00; border-radius:7px; line-height:1.65; }
      @media (max-width: 700px) {
        #${SCREEN_ID} { padding:12px 8px 40px; }
        .single-check-shell { padding:14px; border-radius:10px; }
        .single-check-heading { display:grid; }
        #single-check-back-home { width:100%; }
        .single-check-search-row, .single-check-form-grid, .single-check-action-info, .single-check-actions { grid-template-columns:1fr; }
        .single-check-product-title-row { display:grid; }
        .single-check-total-card { min-width:0; text-align:left; }
      }
    `;
    document.head.appendChild(style);
  }
})();
