"use strict";

(function () {
  const LOCATION_OPTIONS = ["本社", "酒本倉庫1階", "酒本倉庫2階"];
  const AUTO_SUGGEST_MIN_LENGTH = 2;
  const AUTO_SUGGEST_LIMIT = 10;
  const AUTO_SUGGEST_DELAY = 120;

  let products = [];
  let sourceProduct = null;
  let targetProduct = null;
  const suggestTimers = { source: null, target: null };

  document.addEventListener("DOMContentLoaded", initializeProcessingConversion);

  function initializeProcessingConversion() {
    const showButton = document.querySelector("#show-processing-conversion-button");
    const screen = document.querySelector("#processing-conversion-screen");
    const form = document.querySelector("#processing-conversion-form");

    if (!showButton || !screen || !form) return;

    createStyle();
    setToday();
    populateLocationSelect(document.querySelector("#processing-source-location"));
    populateLocationSelect(document.querySelector("#processing-target-location"));

    showButton.addEventListener("click", openScreen);
    document.querySelector("#back-home-from-processing-conversion")?.addEventListener("click", backHome);
    document.querySelector("#processing-conversion-clear-button")?.addEventListener("click", clearForm);

    document.querySelector("#processing-source-search-button")?.addEventListener("click", function () {
      void searchProducts("source");
    });
    document.querySelector("#processing-target-search-button")?.addEventListener("click", function () {
      void searchProducts("target");
    });

    setupPredictiveSearch("source");
    setupPredictiveSearch("target");

    document.querySelector("#processing-source-location")?.addEventListener("change", updateSourceLocationStock);
    document.querySelector("#processing-target-location")?.addEventListener("change", updateTargetLocationStock);
    document.querySelector("#processing-source-quantity")?.addEventListener("input", updateDifference);
    document.querySelector("#processing-target-quantity")?.addEventListener("input", updateDifference);

    form.addEventListener("submit", handleSubmit);
  }

  async function openScreen() {
    if (typeof requireAdminPermission === "function") {
      const allowed = await requireAdminPermission("加工・商品切替の在庫反映");
      if (!allowed) return;
    }

    await refreshProducts();

    document.querySelectorAll("main > section").forEach(function (section) {
      section.hidden = true;
    });

    const screen = document.querySelector("#processing-conversion-screen");
    screen.hidden = false;
    setToday();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function refreshProducts() {
    try {
      products = typeof getAllProducts === "function" ? await getAllProducts() : [];
    } catch (error) {
      console.error(error);
      products = [];
      await showDialog({
        type: "danger",
        icon: "⚠️",
        title: "商品データを読み込めませんでした",
        message: "画面を更新して、もう一度お試しください。",
        confirmText: "閉じる"
      });
    }
  }

  function setToday() {
    const input = document.querySelector("#processing-conversion-date");
    if (!input || input.value) return;

    const now = new Date();
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    input.value = local.toISOString().slice(0, 10);
  }


  function setupPredictiveSearch(role) {
    const input = document.querySelector(`#processing-${role}-search`);
    if (!input) return;

    input.setAttribute("autocomplete", "off");
    input.setAttribute("aria-autocomplete", "list");

    input.addEventListener("input", function () {
      clearSelectedProductIfSearchChanged(role);

      if (suggestTimers[role]) {
        window.clearTimeout(suggestTimers[role]);
      }

      const query = normalizeSearchText(input.value);
      if (query.length < AUTO_SUGGEST_MIN_LENGTH) {
        hideCandidates(role);
        return;
      }

      suggestTimers[role] = window.setTimeout(function () {
        void showPredictiveSuggestions(role);
      }, AUTO_SUGGEST_DELAY);
    });

    input.addEventListener("focus", function () {
      const query = normalizeSearchText(input.value);
      if (query.length >= AUTO_SUGGEST_MIN_LENGTH) {
        void showPredictiveSuggestions(role);
      }
    });

    input.addEventListener("keydown", function (event) {
      if (event.key === "Enter") {
        event.preventDefault();
        void searchProducts(role);
        return;
      }

      if (event.key === "Escape") {
        hideCandidates(role);
      }
    });
  }

  function clearSelectedProductIfSearchChanged(role) {
    const selectedProduct = role === "source" ? sourceProduct : targetProduct;
    if (!selectedProduct) return;

    const input = document.querySelector(`#processing-${role}-search`);
    const current = normalizeSearchText(input?.value);
    const selectedValues = [
      selectedProduct.internalCode,
      selectedProduct.productCode,
      selectedProduct.productName
    ].map(normalizeSearchText).filter(Boolean);

    if (selectedValues.includes(current)) return;

    if (role === "source") {
      sourceProduct = null;
    } else {
      targetProduct = null;
    }

    const selectedArea = document.querySelector(`#processing-${role}-selected`);
    if (selectedArea) selectedArea.hidden = true;

    setText(`#processing-${role}-internal-code`, "-");
    setText(`#processing-${role}-product-code`, "-");
    setText(`#processing-${role}-product-name`, "-");
    setText(`#processing-${role}-color`, "-");
    setText(`#processing-${role}-total-stock`, "0個");

    const stockOutput = document.querySelector(`#processing-${role}-location-stock`);
    if (stockOutput) stockOutput.value = "0個";

    updateDifference();
  }

  async function showPredictiveSuggestions(role) {
    if (products.length === 0) await refreshProducts();

    const input = document.querySelector(`#processing-${role}-search`);
    const query = normalizeSearchText(input?.value);

    if (query.length < AUTO_SUGGEST_MIN_LENGTH) {
      hideCandidates(role);
      return;
    }

    const matches = getPredictiveMatches(query).slice(0, AUTO_SUGGEST_LIMIT);
    if (!matches.length) {
      hideCandidates(role);
      return;
    }

    renderCandidates(role, matches, {
      title: `予測候補：${matches.length}商品`,
      isPredictive: true
    });
  }

  function getPredictiveMatches(query) {
    return products
      .map(function (product, index) {
        const internalCode = normalizeSearchText(product.internalCode);
        const productCode = normalizeSearchText(product.productCode);
        const productName = normalizeSearchText(product.productName);

        let score = Number.POSITIVE_INFINITY;

        if (internalCode === query || productCode === query) {
          score = 0;
        } else if (internalCode.startsWith(query) || productCode.startsWith(query)) {
          score = 1;
        } else if (productName.startsWith(query)) {
          score = 2;
        } else if (internalCode.includes(query) || productCode.includes(query)) {
          score = 3;
        } else if (productName.includes(query)) {
          score = 4;
        }

        return { product: product, score: score, index: index };
      })
      .filter(function (entry) {
        return Number.isFinite(entry.score);
      })
      .sort(function (a, b) {
        if (a.score !== b.score) return a.score - b.score;

        const aCode = String(a.product.productCode || a.product.internalCode || "");
        const bCode = String(b.product.productCode || b.product.internalCode || "");
        const codeCompare = aCode.localeCompare(bCode, "ja", { numeric: true, sensitivity: "base" });
        return codeCompare || a.index - b.index;
      })
      .map(function (entry) {
        return entry.product;
      });
  }

  function hideCandidates(role) {
    const area = document.querySelector(`#processing-${role}-candidates`);
    if (!area) return;
    area.innerHTML = "";
    area.hidden = true;
  }

  function normalizeSearchText(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "");
  }

  async function searchProducts(role) {
    if (products.length === 0) await refreshProducts();

    const input = document.querySelector(`#processing-${role}-search`);
    const query = normalizeSearchText(input?.value);

    if (!query) {
      await showDialog({
        type: "warning",
        icon: "🔎",
        title: "検索する文字を入力してください",
        message: "社内コード・商品コード・商品名のどれかを入力してください。",
        confirmText: "閉じる"
      });
      input?.focus();
      return;
    }

    const exactMatches = products.filter(function (product) {
      return [product.internalCode, product.productCode]
        .map(normalizeSearchText)
        .some(function (value) { return value === query; });
    });

    const matches = exactMatches.length > 0
      ? exactMatches
      : products.filter(function (product) {
          return [
            product.internalCode,
            product.productCode,
            product.productName,
            product.productColor
          ].map(normalizeSearchText).some(function (value) {
            return value.includes(query);
          });
        }).slice(0, 30);

    if (matches.length === 0) {
      renderCandidates(role, []);
      await showDialog({
        type: "warning",
        icon: "🔎",
        title: "商品が見つかりませんでした",
        message: "社内コードや商品コードを確認して、もう一度検索してください。",
        confirmText: "閉じる"
      });
      return;
    }

    if (matches.length === 1) {
      selectProduct(role, matches[0]);
      return;
    }

    renderCandidates(role, matches);
  }

  function renderCandidates(role, matches, options) {
    const area = document.querySelector(`#processing-${role}-candidates`);
    if (!area) return;

    area.innerHTML = "";

    if (!matches.length) {
      area.hidden = true;
      return;
    }

    const title = document.createElement("strong");
    title.textContent = options?.title || `候補：${matches.length}商品（該当商品を選んでください）`;
    area.appendChild(title);

    if (options?.isPredictive) {
      area.classList.add("is-predictive");
    } else {
      area.classList.remove("is-predictive");
    }

    const list = document.createElement("div");
    list.className = "processing-conversion-candidate-list";

    matches.forEach(function (product) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "processing-conversion-candidate";

      const code = document.createElement("strong");
      code.textContent = `${product.internalCode || "-"} / ${product.productCode || "-"}`;

      const name = document.createElement("span");
      name.textContent = `${product.productName || "商品名未登録"}${product.productColor ? ` / ${product.productColor}` : ""}`;

      const stock = document.createElement("small");
      stock.textContent = `総在庫：${toNonNegativeInteger(product.stock)}個`;

      button.setAttribute(
        "aria-label",
        `${product.internalCode || "-"} ${product.productCode || "-"} ${product.productName || "商品名未登録"} 総在庫${toNonNegativeInteger(product.stock)}個`
      );

      button.append(code, name, stock);
      button.addEventListener("click", function () {
        selectProduct(role, product);
      });
      list.appendChild(button);
    });

    area.appendChild(list);
    area.hidden = false;
  }

  function selectProduct(role, product) {
    if (role === "source") {
      sourceProduct = product;
    } else {
      targetProduct = product;
    }

    const selectedArea = document.querySelector(`#processing-${role}-selected`);
    const candidates = document.querySelector(`#processing-${role}-candidates`);
    const searchInput = document.querySelector(`#processing-${role}-search`);

    if (candidates) {
      candidates.innerHTML = "";
      candidates.hidden = true;
      candidates.classList.remove("is-predictive");
    }

    if (searchInput) {
      searchInput.value = product.internalCode || product.productCode || product.productName || "";
    }

    setText(`#processing-${role}-internal-code`, product.internalCode || "-");
    setText(`#processing-${role}-product-code`, product.productCode || "-");
    setText(`#processing-${role}-product-name`, product.productName || "-");
    setText(`#processing-${role}-color`, product.productColor || "-");
    setText(`#processing-${role}-total-stock`, `${toNonNegativeInteger(product.stock)}個`);

    const locationSelect = document.querySelector(`#processing-${role}-location`);
    populateLocationSelect(locationSelect, chooseDefaultLocation(product, role === "source"));

    if (selectedArea) selectedArea.hidden = false;

    if (role === "source") {
      updateSourceLocationStock();
    } else {
      updateTargetLocationStock();
    }

    updateDifference();
  }

  function chooseDefaultLocation(product, requireStock) {
    const stocks = getLocationStocks(product);
    const current = normalizeLocation(product.location);

    if (requireStock) {
      const currentEntry = stocks.find(function (entry) {
        return entry.location === current && entry.stock > 0;
      });
      if (currentEntry) return current;

      const stocked = stocks.find(function (entry) { return entry.stock > 0; });
      if (stocked) return stocked.location;
    }

    if (LOCATION_OPTIONS.includes(current)) return current;
    return LOCATION_OPTIONS[0];
  }

  function populateLocationSelect(select, selected) {
    if (!select) return;
    const wanted = normalizeLocation(selected);
    select.innerHTML = "";

    LOCATION_OPTIONS.forEach(function (location) {
      const option = document.createElement("option");
      option.value = location;
      option.textContent = location;
      option.selected = location === wanted;
      select.appendChild(option);
    });

    if (!select.value) select.value = LOCATION_OPTIONS[0];
  }

  function normalizeLocation(value) {
    const text = String(value || "").trim();
    if (typeof normalizeLocationStockName === "function") {
      return normalizeLocationStockName(text);
    }
    return LOCATION_OPTIONS.includes(text) ? text : "本社";
  }

  function getLocationStocks(product) {
    let raw = [];

    if (typeof getProductLocationStocks === "function") {
      raw = getProductLocationStocks(product) || [];
    } else if (Array.isArray(product?.locationStocks)) {
      raw = product.locationStocks;
    }

    const map = new Map();
    raw.forEach(function (entry) {
      const location = normalizeLocation(entry.location);
      if (!LOCATION_OPTIONS.includes(location)) return;
      map.set(location, (map.get(location) || 0) + toNonNegativeInteger(entry.stock));
    });

    return LOCATION_OPTIONS.map(function (location) {
      return { location: location, stock: map.get(location) || 0 };
    });
  }

  function getLocationStock(product, location) {
    const normalized = normalizeLocation(location);
    const entry = getLocationStocks(product).find(function (item) {
      return item.location === normalized;
    });
    return entry ? entry.stock : 0;
  }

  function updateSourceLocationStock() {
    const select = document.querySelector("#processing-source-location");
    const output = document.querySelector("#processing-source-location-stock");
    if (!output) return;
    output.value = sourceProduct ? `${getLocationStock(sourceProduct, select?.value)}個` : "0個";
  }

  function updateTargetLocationStock() {
    const select = document.querySelector("#processing-target-location");
    const output = document.querySelector("#processing-target-location-stock");
    if (!output) return;
    output.value = targetProduct ? `${getLocationStock(targetProduct, select?.value)}個` : "0個";
  }

  function updateDifference() {
    const sourceQuantity = getPositiveInteger("#processing-source-quantity", 0);
    const targetQuantity = getPositiveInteger("#processing-target-quantity", 0);
    const difference = sourceQuantity - targetQuantity;

    const sourceSummary = document.querySelector("#processing-summary-source-quantity");
    const targetSummary = document.querySelector("#processing-summary-target-quantity");
    const differenceSummary = document.querySelector("#processing-summary-difference");

    if (sourceSummary) sourceSummary.value = `${sourceQuantity}個`;
    if (targetSummary) targetSummary.value = `${targetQuantity}個`;
    if (differenceSummary) {
      differenceSummary.value = `${difference}個`;
      differenceSummary.classList.toggle("processing-conversion-difference-warning", difference < 0);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!sourceProduct || !targetProduct) {
      await showDialog({
        type: "warning",
        icon: "⚠️",
        title: "加工元と加工後の商品を選んでください",
        message: "A商品とB商品をそれぞれ検索して選択してください。",
        confirmText: "閉じる"
      });
      return;
    }

    if (sourceProduct.internalCode === targetProduct.internalCode) {
      await showDialog({
        type: "danger",
        icon: "⚠️",
        title: "同じ商品は選べません",
        message: "加工元Aと加工後Bには別の商品を選んでください。",
        confirmText: "閉じる"
      });
      return;
    }

    const workDate = document.querySelector("#processing-conversion-date")?.value || "";
    const person = document.querySelector("#processing-conversion-person")?.value.trim() || "";
    const workplace = document.querySelector("#processing-conversion-workplace")?.value.trim() || "";
    const workNo = document.querySelector("#processing-conversion-work-no")?.value.trim() || "";
    const memo = document.querySelector("#processing-conversion-memo")?.value.trim() || "";
    const sourceLocation = normalizeLocation(document.querySelector("#processing-source-location")?.value);
    const targetLocation = normalizeLocation(document.querySelector("#processing-target-location")?.value);
    const sourceQuantity = getPositiveInteger("#processing-source-quantity", 0);
    const targetQuantity = getPositiveInteger("#processing-target-quantity", 0);

    if (!workDate) {
      await validationError("作業日を入力してください。", "#processing-conversion-date");
      return;
    }
    if (!person) {
      await validationError("担当者を入力してください。", "#processing-conversion-person");
      return;
    }
    if (sourceQuantity < 1) {
      await validationError("加工元Aの使用数量を1個以上で入力してください。", "#processing-source-quantity");
      return;
    }
    if (targetQuantity < 1) {
      await validationError("加工後Bの完成数量を1個以上で入力してください。", "#processing-target-quantity");
      return;
    }

    const sourceLocationStock = getLocationStock(sourceProduct, sourceLocation);
    if (sourceQuantity > sourceLocationStock) {
      await showDialog({
        type: "danger",
        icon: "⚠️",
        title: "加工元Aの在庫が足りません",
        message: `${sourceLocation}の在庫は${sourceLocationStock}個ですが、使用数量は${sourceQuantity}個です。使用数量または保管場所を確認してください。`,
        confirmText: "閉じる"
      });
      return;
    }

    const targetLocationStock = getLocationStock(targetProduct, targetLocation);
    const sourceBeforeTotal = toNonNegativeInteger(sourceProduct.stock);
    const targetBeforeTotal = toNonNegativeInteger(targetProduct.stock);
    const sourceAfterTotal = sourceBeforeTotal - sourceQuantity;
    const targetAfterTotal = targetBeforeTotal + targetQuantity;
    const difference = sourceQuantity - targetQuantity;

    const details = [
      { label: "加工元A", value: `${sourceProduct.internalCode} / ${sourceProduct.productCode || "-"} / ${sourceProduct.productName || "-"}` },
      { label: "A 使用数量", value: `${sourceQuantity}個` },
      { label: `A ${sourceLocation}`, value: `${sourceLocationStock}個 → ${sourceLocationStock - sourceQuantity}個` },
      { label: "A 総在庫", value: `${sourceBeforeTotal}個 → ${sourceAfterTotal}個` },
      { label: "加工後B", value: `${targetProduct.internalCode} / ${targetProduct.productCode || "-"} / ${targetProduct.productName || "-"}` },
      { label: "B 完成数量", value: `${targetQuantity}個` },
      { label: `B ${targetLocation}`, value: `${targetLocationStock}個 → ${targetLocationStock + targetQuantity}個` },
      { label: "B 総在庫", value: `${targetBeforeTotal}個 → ${targetAfterTotal}個` },
      { label: "差異（使用－完成）", value: `${difference}個` }
    ];

    if (workNo) details.push({ label: "作業番号", value: workNo });

    const confirmed = await showDialog({
      type: difference < 0 ? "warning" : "info",
      icon: "🔄",
      title: "加工・商品切替を在庫へ反映しますか？",
      message: difference < 0
        ? "完成数量が使用数量を上回っています。記入シートの数量をもう一度確認してください。内容が正しければ登録できます。"
        : "A商品を減らし、B商品を増やします。確定後は両商品の入出庫履歴に記録されます。",
      details: details,
      notice: "この操作はAとBを同時に更新します。内容を確認してから登録してください。",
      isConfirm: true,
      cancelText: "戻って確認",
      confirmText: "在庫へ反映する"
    });

    if (!confirmed) return;

    await applyConversion({
      workDate,
      person,
      workplace,
      workNo,
      memo,
      sourceLocation,
      targetLocation,
      sourceQuantity,
      targetQuantity,
      sourceLocationStock,
      targetLocationStock,
      sourceBeforeTotal,
      targetBeforeTotal,
      sourceAfterTotal,
      targetAfterTotal,
      difference
    });
  }

  async function applyConversion(data) {
    const now = new Date().toISOString();
    const processingId = createProcessingId();

    const sourceLocationStocks = updateLocationStocks(sourceProduct, data.sourceLocation, -data.sourceQuantity);
    const targetLocationStocks = updateLocationStocks(targetProduct, data.targetLocation, data.targetQuantity);

    const updatedSourceProduct = {
      ...sourceProduct,
      stock: data.sourceAfterTotal,
      location: choosePrimaryLocation(sourceProduct, sourceLocationStocks, data.sourceLocation),
      locationStocks: sourceLocationStocks,
      updatedAt: now
    };

    const updatedTargetProduct = {
      ...targetProduct,
      stock: data.targetAfterTotal,
      location: choosePrimaryLocation(targetProduct, targetLocationStocks, data.targetLocation),
      locationStocks: targetLocationStocks,
      updatedAt: now
    };

    const commonMemoParts = [];
    if (data.workDate) commonMemoParts.push(`作業日:${data.workDate}`);
    if (data.workplace) commonMemoParts.push(`作業場所:${data.workplace}`);
    if (data.workNo) commonMemoParts.push(`作業番号:${data.workNo}`);
    commonMemoParts.push(`加工番号:${processingId}`);
    commonMemoParts.push(`差異:${data.difference}個`);
    if (data.memo) commonMemoParts.push(data.memo);

    const sourceMemo = [
      `加工先:${targetProduct.internalCode}/${targetProduct.productCode || "-"}/${targetProduct.productName || "-"}`,
      ...commonMemoParts
    ].join(" / ");

    const targetMemo = [
      `加工元:${sourceProduct.internalCode}/${sourceProduct.productCode || "-"}/${sourceProduct.productName || "-"}`,
      ...commonMemoParts
    ].join(" / ");

    const sourceMovement = {
      id: createMovementIdSafe(),
      dateTime: now,
      internalCode: sourceProduct.internalCode,
      productCode: sourceProduct.productCode,
      productName: sourceProduct.productName,
      janCode: sourceProduct.janCode || "",
      type: "出庫",
      quantity: data.sourceQuantity,
      beforeStock: data.sourceBeforeTotal,
      afterStock: data.sourceAfterTotal,
      person: data.person,
      reason: "加工・商品切替",
      memo: sourceMemo,
      location: data.sourceLocation,
      beforeLocationStock: data.sourceLocationStock,
      afterLocationStock: data.sourceLocationStock - data.sourceQuantity,
      processingId: processingId,
      processingRole: "加工元",
      counterpartInternalCode: targetProduct.internalCode
    };

    const targetMovement = {
      id: createMovementIdSafe(),
      dateTime: now,
      internalCode: targetProduct.internalCode,
      productCode: targetProduct.productCode,
      productName: targetProduct.productName,
      janCode: targetProduct.janCode || "",
      type: "入庫",
      quantity: data.targetQuantity,
      beforeStock: data.targetBeforeTotal,
      afterStock: data.targetAfterTotal,
      person: data.person,
      reason: "加工・商品切替",
      memo: targetMemo,
      location: data.targetLocation,
      beforeLocationStock: data.targetLocationStock,
      afterLocationStock: data.targetLocationStock + data.targetQuantity,
      processingId: processingId,
      processingRole: "加工後",
      counterpartInternalCode: sourceProduct.internalCode
    };

    try {
      if (typeof recordProcessingConversion !== "function") {
        throw new Error("recordProcessingConversion is not available");
      }

      await recordProcessingConversion(
        updatedSourceProduct,
        updatedTargetProduct,
        sourceMovement,
        targetMovement
      );

      if (window.inventoryApp?.applyUpdatedProduct) {
        window.inventoryApp.applyUpdatedProduct(updatedSourceProduct);
        window.inventoryApp.applyUpdatedProduct(updatedTargetProduct);
      }

      sourceProduct = updatedSourceProduct;
      targetProduct = updatedTargetProduct;

      await showDialog({
        type: "success",
        icon: "✅",
        title: "加工・商品切替を在庫へ反映しました",
        message: "A商品を減らし、B商品を増やしました。両商品の入出庫履歴にも記録しています。",
        details: [
          { label: "加工番号", value: processingId },
          { label: "加工元A", value: `${updatedSourceProduct.internalCode}　－${data.sourceQuantity}個` },
          { label: "加工後B", value: `${updatedTargetProduct.internalCode}　＋${data.targetQuantity}個` },
          { label: "差異", value: `${data.difference}個` }
        ],
        confirmText: "閉じる"
      });

      clearForm();
    } catch (error) {
      console.error(error);
      await showDialog({
        type: "danger",
        icon: "⚠️",
        title: "在庫へ反映できませんでした",
        message: "A商品・B商品の在庫は更新していません。画面を更新して、もう一度お試しください。",
        confirmText: "閉じる"
      });
    }
  }

  function updateLocationStocks(product, location, delta) {
    const normalizedLocation = normalizeLocation(location);
    const map = new Map();

    getLocationStocks(product).forEach(function (entry) {
      map.set(entry.location, entry.stock);
    });

    const next = Math.max(0, (map.get(normalizedLocation) || 0) + delta);
    map.set(normalizedLocation, next);

    return LOCATION_OPTIONS
      .map(function (item) {
        return { location: item, stock: map.get(item) || 0 };
      })
      .filter(function (entry) { return entry.stock > 0; });
  }

  function choosePrimaryLocation(product, locationStocks, preferredLocation) {
    const current = normalizeLocation(product.location);
    if (locationStocks.some(function (entry) { return entry.location === current && entry.stock > 0; })) {
      return current;
    }

    const preferred = normalizeLocation(preferredLocation);
    if (locationStocks.some(function (entry) { return entry.location === preferred && entry.stock > 0; })) {
      return preferred;
    }

    return locationStocks[0]?.location || preferred || "本社";
  }

  function createProcessingId() {
    const now = new Date();
    const pad = function (value) { return String(value).padStart(2, "0"); };
    const datePart = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
    const timePart = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    const random = Math.random().toString(36).slice(2, 6).toUpperCase();
    return `PRC-${datePart}-${timePart}-${random}`;
  }

  function createMovementIdSafe() {
    if (typeof createMovementId === "function") return createMovementId();
    return `movement-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  function clearForm() {
    const form = document.querySelector("#processing-conversion-form");
    form?.reset();
    sourceProduct = null;
    targetProduct = null;

    ["source", "target"].forEach(function (role) {
      const selected = document.querySelector(`#processing-${role}-selected`);
      const candidates = document.querySelector(`#processing-${role}-candidates`);
      if (selected) selected.hidden = true;
      if (candidates) {
        candidates.innerHTML = "";
        candidates.hidden = true;
        candidates.classList.remove("is-predictive");
      }
      populateLocationSelect(document.querySelector(`#processing-${role}-location`));
    });

    const sourceQty = document.querySelector("#processing-source-quantity");
    const targetQty = document.querySelector("#processing-target-quantity");
    if (sourceQty) sourceQty.value = "1";
    if (targetQty) targetQty.value = "1";

    setToday();
    updateDifference();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function backHome() {
    const screen = document.querySelector("#processing-conversion-screen");
    if (screen) screen.hidden = true;

    if (window.inventoryApp?.showScreen) {
      window.inventoryApp.showScreen("home");
    } else {
      const home = document.querySelector("#home");
      if (home) home.hidden = false;
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function validationError(message, selector) {
    await showDialog({
      type: "warning",
      icon: "⚠️",
      title: "入力内容を確認してください",
      message: message,
      confirmText: "閉じる"
    });
    document.querySelector(selector)?.focus();
  }

  function showDialog(options) {
    if (window.inventoryApp?.showAppDialog) {
      return window.inventoryApp.showAppDialog(options);
    }
    if (typeof showAppDialog === "function") return showAppDialog(options);
    window.alert(options?.message || options?.title || "お知らせ");
    return Promise.resolve(true);
  }

  function getPositiveInteger(selector, fallback) {
    const value = Number(document.querySelector(selector)?.value);
    if (!Number.isFinite(value) || value < 0) return fallback;
    return Math.floor(value);
  }

  function toNonNegativeInteger(value) {
    const number = Number(value);
    if (!Number.isFinite(number) || number < 0) return 0;
    return Math.floor(number);
  }

  function setText(selector, value) {
    const element = document.querySelector(selector);
    if (element) element.textContent = String(value ?? "");
  }

  function createStyle() {
    if (document.querySelector("#processing-conversion-style")) return;

    const style = document.createElement("style");
    style.id = "processing-conversion-style";
    style.textContent = `
      #processing-conversion-screen[hidden] { display: none !important; }
      #processing-conversion-screen { max-width: 1100px; margin: 0 auto 48px; padding: 24px; }
      .processing-conversion-heading { padding: 20px 22px; background: #fff; border: 1px solid #d7e1ea; border-radius: 14px; box-shadow: 0 4px 16px rgba(31,54,77,.08); }
      .processing-conversion-heading h2 { margin: 0 0 8px; color: #1565c0; }
      .processing-conversion-heading p { margin: 0; color: #455a64; }
      .processing-conversion-guide { display: grid; gap: 5px; margin: 16px 0; padding: 14px 16px; background: #fff8e1; border-left: 5px solid #ffb300; border-radius: 10px; color: #5d4037; }
      .processing-conversion-card { margin: 16px 0; padding: 18px; background: #fff; border: 1px solid #d7e1ea; border-radius: 14px; box-shadow: 0 3px 12px rgba(31,54,77,.06); }
      .processing-conversion-card h3 { margin: 0 0 14px; }
      .processing-source-card { border-left: 6px solid #ef6c00; }
      .processing-target-card { border-left: 6px solid #2e7d32; }
      .processing-conversion-card-title { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 14px; }
      .processing-conversion-card-title > div { display: flex; align-items: center; gap: 10px; font-size: 19px; }
      .processing-conversion-card-title > span { color: #607d8b; font-size: 13px; }
      .processing-conversion-badge { display: inline-grid; place-items: center; width: 38px; height: 38px; border-radius: 50%; color: #fff; font-weight: 900; }
      .processing-conversion-badge-a { background: #ef6c00; }
      .processing-conversion-badge-b { background: #2e7d32; }
      .processing-conversion-grid { display: grid; gap: 14px; }
      .processing-conversion-grid-4 { grid-template-columns: repeat(4, minmax(0, 1fr)); }
      .processing-conversion-grid-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
      .processing-conversion-grid label, .processing-conversion-memo-label { display: grid; gap: 7px; font-weight: 700; }
      .processing-conversion-grid input, .processing-conversion-grid select, .processing-conversion-memo-label textarea, .processing-conversion-search-row input { width: 100%; min-height: 46px; padding: 10px 12px; border: 1px solid #b0bec5; border-radius: 8px; background: #fff; font: inherit; }
      .processing-conversion-grid input[readonly] { background: #f2f6f8; color: #37474f; font-weight: 800; }
      .processing-conversion-search-row { display: grid; grid-template-columns: 1fr auto; gap: 10px; align-items: stretch; }
      .processing-conversion-search-row button { min-width: 150px; background: #1565c0; color: #fff; font-weight: 800; }
      .processing-conversion-candidates { margin-top: 12px; padding: 12px; background: #f7fbff; border: 1px solid #bbdefb; border-radius: 10px; }
      .processing-conversion-candidates.is-predictive { margin-top: 4px; padding: 8px; box-shadow: 0 8px 20px rgba(21,101,192,.12); }
      .processing-conversion-candidates.is-predictive > strong { display: block; margin: 2px 4px 7px; color: #1565c0; font-size: 13px; }
      .processing-conversion-candidate-list { display: grid; gap: 8px; margin-top: 8px; max-height: 330px; overflow: auto; }
      .processing-conversion-candidate { display: grid; gap: 3px; width: 100%; padding: 11px 13px; text-align: left; background: #fff; color: #263238; border: 1px solid #cfd8dc; border-radius: 8px; }
      .processing-conversion-candidate:hover, .processing-conversion-candidate:focus-visible { border-color: #42a5f5; background: #eef7ff; outline: 2px solid #90caf9; outline-offset: 1px; }
      .processing-conversion-candidate span { font-weight: 600; }
      .processing-conversion-candidate small { color: #607d8b; }
      .processing-conversion-selected { margin-top: 14px; }
      .processing-conversion-product-summary { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; margin-bottom: 14px; }
      .processing-conversion-product-summary > div { display: grid; gap: 4px; padding: 10px 12px; background: #f5f8fa; border-radius: 8px; }
      .processing-conversion-product-summary .wide { grid-column: span 2; }
      .processing-conversion-product-summary span { font-size: 12px; color: #607d8b; }
      .processing-conversion-product-summary strong { overflow-wrap: anywhere; }
      .processing-conversion-arrow { margin: -2px 0; text-align: center; color: #1565c0; font-size: 22px; font-weight: 900; }
      .processing-conversion-memo-label { margin-top: 14px; }
      .processing-conversion-memo-label textarea { resize: vertical; }
      .processing-conversion-difference-warning { background: #fff3e0 !important; color: #bf360c !important; }
      .processing-conversion-actions { display: flex; flex-wrap: wrap; gap: 12px; margin: 18px 0; }
      #processing-conversion-confirm-button { flex: 1 1 360px; background: #2e7d32; color: #fff; font-weight: 900; }
      #processing-conversion-clear-button { background: #ef6c00; color: #fff; }
      #back-home-from-processing-conversion { background: #607d8b; color: #fff; }
      @media (max-width: 900px) {
        .processing-conversion-grid-4 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .processing-conversion-product-summary { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      }
      @media (max-width: 650px) {
        #processing-conversion-screen { padding: 12px; }
        .processing-conversion-grid-4, .processing-conversion-grid-3, .processing-conversion-product-summary { grid-template-columns: 1fr; }
        .processing-conversion-product-summary .wide { grid-column: auto; }
        .processing-conversion-search-row { grid-template-columns: 1fr; }
        .processing-conversion-search-row button { min-height: 50px; }
        .processing-conversion-card-title { align-items: flex-start; flex-direction: column; }
      }
    `;
    document.head.appendChild(style);
  }
})();
