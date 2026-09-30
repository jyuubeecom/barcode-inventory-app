"use strict";

(function () {
  const MONITORED_CUSTOMERS_KEY =
    "barcodeInventoryMonitoredCustomers";

  let customers = [];
  let products = [];
  let editingCustomerId = "";
  let originalMonitorKeyword = "";
  let draftProductNotes = [];

  document.addEventListener(
    "DOMContentLoaded",
    initializeCustomerMaster
  );

  function initializeCustomerMaster() {
    createCustomerMasterStyle();
    bindCustomerMasterEvents();
  }

  function bindCustomerMasterEvents() {
    document
      .querySelector("#show-customer-master-button")
      ?.addEventListener("click", openCustomerMasterScreen);

    document
      .querySelector("#back-home-from-customer-master")
      ?.addEventListener("click", closeCustomerMasterScreen);

    document
      .querySelector("#customer-master-new-button")
      ?.addEventListener("click", openNewCustomerEditor);

    document
      .querySelector("#customer-master-search")
      ?.addEventListener("input", renderCustomerList);

    document
      .querySelector("#customer-master-save-button")
      ?.addEventListener("click", saveCurrentCustomer);

    document
      .querySelector("#customer-master-cancel-button")
      ?.addEventListener("click", closeCustomerEditor);

    document
      .querySelector("#customer-master-delete-button")
      ?.addEventListener("click", deleteCurrentCustomer);

    document
      .querySelector("#customer-master-monitor")
      ?.addEventListener("change", handleMonitorToggle);

    document
      .querySelector("#customer-master-name")
      ?.addEventListener("input", function () {
        const checkbox = document.querySelector(
          "#customer-master-monitor"
        );
        const keywordInput = document.querySelector(
          "#customer-master-monitor-keyword"
        );
        if (
          checkbox?.checked &&
          keywordInput &&
          !normalizeText(keywordInput.value)
        ) {
          keywordInput.value = normalizeText(
            document.querySelector("#customer-master-name")?.value
          );
        }
      });

    document
      .querySelector("#customer-master-product-search")
      ?.addEventListener("input", renderProductSearchResults);
  }

  async function openCustomerMasterScreen() {
    if (
      document.body.dataset.roleMode === "worker"
    ) {
      await showCustomerMasterDialog({
        type: "warning",
        icon: "🔒",
        title: "管理者向けの機能です",
        message:
          "取引先の担当者名や連絡先を扱うため、管理者モードで使用してください。",
        confirmText: "閉じる"
      });
      return;
    }

    try {
      const results = await Promise.all([
        getAllCustomers(),
        getAllProducts()
      ]);
      customers = normalizeCustomerList(results[0]);
      products = Array.isArray(results[1])
        ? results[1].slice()
        : [];
      sortCustomers();
      closeCustomerEditor();
      renderCustomerList();
      showExclusiveScreen();
    } catch (error) {
      console.error("取引先マスタ読込エラー", error);
      await showCustomerMasterDialog({
        type: "danger",
        icon: "⚠️",
        title: "取引先マスタを読み込めませんでした",
        message:
          "画面を更新して、もう一度お試しください。",
        confirmText: "閉じる"
      });
    }
  }

  function showExclusiveScreen() {
    const screen = document.querySelector(
      "#customer-master-screen"
    );
    if (!screen) return;

    document
      .querySelectorAll("main > section")
      .forEach(function (section) {
        section.hidden =
          section.id !== "customer-master-screen";
      });

    screen.hidden = false;
    screen.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }

  function closeCustomerMasterScreen() {
    closeCustomerEditor();

    const screen = document.querySelector(
      "#customer-master-screen"
    );
    if (screen) screen.hidden = true;

    if (
      window.inventoryApp &&
      typeof window.inventoryApp.showScreen === "function"
    ) {
      window.inventoryApp.showScreen("home");
    } else {
      const home = document.querySelector("#home");
      if (home) home.hidden = false;
    }

    document.querySelector("#home")?.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }

  function normalizeCustomerList(records) {
    return (Array.isArray(records) ? records : [])
      .filter(function (record) {
        return record && typeof record === "object";
      })
      .map(function (record) {
        return {
          id: normalizeText(record.id),
          customerCode: normalizeText(record.customerCode),
          customerName: normalizeText(record.customerName),
          contactPerson: normalizeText(record.contactPerson),
          phone: normalizeText(record.phone),
          email: normalizeText(record.email),
          address: normalizeMultiline(record.address),
          shippingAddress: normalizeMultiline(record.shippingAddress),
          shippingNote: normalizeMultiline(record.shippingNote),
          memo: normalizeMultiline(record.memo),
          monitorSalesActual: Boolean(record.monitorSalesActual),
          monitorKeyword: normalizeText(record.monitorKeyword),
          productNotes: normalizeProductNotes(record.productNotes),
          createdAt: normalizeText(record.createdAt),
          updatedAt: normalizeText(record.updatedAt)
        };
      });
  }

  function normalizeProductNotes(notes) {
    return (Array.isArray(notes) ? notes : [])
      .filter(function (item) {
        return item && typeof item === "object";
      })
      .map(function (item) {
        return {
          internalCode: normalizeText(item.internalCode),
          productCode: normalizeText(item.productCode),
          productName: normalizeText(item.productName),
          note: normalizeMultiline(item.note)
        };
      })
      .filter(function (item) {
        return item.internalCode;
      });
  }

  function sortCustomers() {
    customers.sort(function (left, right) {
      const nameCompare = left.customerName.localeCompare(
        right.customerName,
        "ja"
      );
      if (nameCompare !== 0) return nameCompare;
      return left.customerCode.localeCompare(
        right.customerCode,
        "ja"
      );
    });
  }

  function renderCustomerList() {
    const body = document.querySelector(
      "#customer-master-list-body"
    );
    const empty = document.querySelector(
      "#customer-master-empty"
    );
    const count = document.querySelector(
      "#customer-master-count"
    );
    const monitorCount = document.querySelector(
      "#customer-master-monitor-count"
    );
    if (!body || !empty) return;

    const keyword = normalizeSearchText(
      document.querySelector("#customer-master-search")?.value
    );

    const filtered = customers.filter(function (customer) {
      if (!keyword) return true;
      const target = normalizeSearchText([
        customer.customerCode,
        customer.customerName,
        customer.contactPerson,
        customer.phone
      ].join(" "));
      return target.includes(keyword);
    });

    if (count) {
      count.textContent = `${customers.length.toLocaleString("ja-JP")}社`;
    }
    if (monitorCount) {
      const monitored = customers.filter(function (customer) {
        return customer.monitorSalesActual;
      }).length;
      monitorCount.textContent = `${monitored.toLocaleString("ja-JP")}社`;
    }

    empty.hidden = filtered.length > 0;
    body.innerHTML = filtered.map(function (customer) {
      const monitor = customer.monitorSalesActual
        ? `<span class="customer-master-monitor-on">対象</span><small>${escapeHtml(customer.monitorKeyword || customer.customerName)}</small>`
        : `<span class="customer-master-monitor-off">対象外</span>`;

      return `
        <tr>
          <td>${escapeHtml(customer.customerCode || "-")}</td>
          <td><strong>${escapeHtml(customer.customerName)}</strong></td>
          <td>${escapeHtml(customer.contactPerson || "-")}</td>
          <td>${escapeHtml(customer.phone || "-")}</td>
          <td class="customer-master-monitor-cell">${monitor}</td>
          <td>
            <button type="button" class="customer-master-edit-button" data-customer-id="${escapeAttribute(customer.id)}">編集する</button>
          </td>
        </tr>
      `;
    }).join("");

    body
      .querySelectorAll("[data-customer-id]")
      .forEach(function (button) {
        button.addEventListener("click", function () {
          openExistingCustomerEditor(
            button.getAttribute("data-customer-id") || ""
          );
        });
      });
  }

  function openNewCustomerEditor() {
    editingCustomerId = "";
    originalMonitorKeyword = "";
    draftProductNotes = [];
    clearEditorFields();

    setText("#customer-master-editor-title", "取引先を登録");
    setText("#customer-master-editor-status", "新規");
    const deleteButton = document.querySelector(
      "#customer-master-delete-button"
    );
    if (deleteButton) deleteButton.hidden = true;

    openEditor();
  }

  function openExistingCustomerEditor(id) {
    const customer = customers.find(function (item) {
      return item.id === id;
    });
    if (!customer) return;

    editingCustomerId = customer.id;
    originalMonitorKeyword = customer.monitorSalesActual
      ? normalizeText(customer.monitorKeyword || customer.customerName)
      : "";
    draftProductNotes = normalizeProductNotes(
      customer.productNotes
    );

    setValue("#customer-master-name", customer.customerName);
    setValue("#customer-master-code", customer.customerCode);
    setValue("#customer-master-contact", customer.contactPerson);
    setValue("#customer-master-phone", customer.phone);
    setValue("#customer-master-email", customer.email);
    setValue("#customer-master-address", customer.address);
    setValue("#customer-master-shipping-address", customer.shippingAddress);
    setValue("#customer-master-shipping-note", customer.shippingNote);
    setValue("#customer-master-memo", customer.memo);

    const monitor = document.querySelector(
      "#customer-master-monitor"
    );
    if (monitor) monitor.checked = customer.monitorSalesActual;
    setValue(
      "#customer-master-monitor-keyword",
      customer.monitorKeyword || customer.customerName
    );
    updateMonitorKeywordAvailability();

    setText("#customer-master-editor-title", "取引先情報を編集");
    setText("#customer-master-editor-status", "編集");
    const deleteButton = document.querySelector(
      "#customer-master-delete-button"
    );
    if (deleteButton) deleteButton.hidden = false;

    renderDraftProductNotes();
    clearProductSearch();
    openEditor();
  }

  function openEditor() {
    const editor = document.querySelector(
      "#customer-master-editor"
    );
    if (!editor) return;
    editor.hidden = false;
    renderDraftProductNotes();
    editor.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }

  function closeCustomerEditor() {
    editingCustomerId = "";
    originalMonitorKeyword = "";
    draftProductNotes = [];
    clearEditorFields();
    clearProductSearch();
    const editor = document.querySelector(
      "#customer-master-editor"
    );
    if (editor) editor.hidden = true;
  }

  function clearEditorFields() {
    [
      "#customer-master-name",
      "#customer-master-code",
      "#customer-master-contact",
      "#customer-master-phone",
      "#customer-master-email",
      "#customer-master-address",
      "#customer-master-shipping-address",
      "#customer-master-shipping-note",
      "#customer-master-memo",
      "#customer-master-monitor-keyword"
    ].forEach(function (selector) {
      setValue(selector, "");
    });
    const monitor = document.querySelector(
      "#customer-master-monitor"
    );
    if (monitor) monitor.checked = false;
    updateMonitorKeywordAvailability();
    renderDraftProductNotes();
  }

  function handleMonitorToggle() {
    const checkbox = document.querySelector(
      "#customer-master-monitor"
    );
    const keywordInput = document.querySelector(
      "#customer-master-monitor-keyword"
    );
    const nameInput = document.querySelector(
      "#customer-master-name"
    );
    if (
      checkbox?.checked &&
      keywordInput &&
      !normalizeText(keywordInput.value)
    ) {
      keywordInput.value = normalizeText(nameInput?.value);
    }
    updateMonitorKeywordAvailability();
  }

  function updateMonitorKeywordAvailability() {
    const checkbox = document.querySelector(
      "#customer-master-monitor"
    );
    const input = document.querySelector(
      "#customer-master-monitor-keyword"
    );
    if (!input) return;
    input.disabled = !checkbox?.checked;
  }

  async function saveCurrentCustomer() {
    const record = collectEditorRecord();
    if (!record) return;

    const duplicateName = customers.find(function (customer) {
      return customer.id !== editingCustomerId &&
        normalizeSearchText(customer.customerName) ===
          normalizeSearchText(record.customerName);
    });
    if (duplicateName) {
      await showCustomerMasterDialog({
        type: "warning",
        icon: "⚠️",
        title: "同じ取引先名が登録されています",
        message: `「${record.customerName}」はすでに取引先マスタにあります。`,
        confirmText: "閉じる"
      });
      return;
    }

    if (record.customerCode) {
      const duplicateCode = customers.find(function (customer) {
        return customer.id !== editingCustomerId &&
          normalizeSearchText(customer.customerCode) ===
            normalizeSearchText(record.customerCode);
      });
      if (duplicateCode) {
        await showCustomerMasterDialog({
          type: "warning",
          icon: "⚠️",
          title: "取引先コードが重複しています",
          message: `「${record.customerCode}」は別の取引先で使用されています。`,
          confirmText: "閉じる"
        });
        return;
      }
    }

    const existing = customers.find(function (customer) {
      return customer.id === editingCustomerId;
    });
    const now = new Date().toISOString();
    record.id = editingCustomerId || createCustomerId();
    record.createdAt = existing?.createdAt || now;
    record.updatedAt = now;

    try {
      await saveCustomer(record);
      customers = customers.filter(function (customer) {
        return customer.id !== record.id;
      });
      customers.push(record);
      sortCustomers();

      await syncMonitorSettingsAfterSave(record);

      renderCustomerList();
      closeCustomerEditor();
      await showCustomerMasterDialog({
        type: "success",
        icon: "✅",
        title: "取引先を保存しました",
        message: `${record.customerName} を取引先マスタに保存しました。`,
        details: [
          {
            label: "商品別注意事項",
            value: `${record.productNotes.length}商品`
          },
          {
            label: "販売実績監視",
            value: record.monitorSalesActual
              ? `対象（${record.monitorKeyword}）`
              : "対象外"
          }
        ],
        confirmText: "閉じる"
      });
    } catch (error) {
      console.error("取引先保存エラー", error);
      await showCustomerMasterDialog({
        type: "danger",
        icon: "⚠️",
        title: "取引先を保存できませんでした",
        message:
          "画面を更新して、もう一度お試しください。",
        confirmText: "閉じる"
      });
    }
  }

  function collectEditorRecord() {
    syncDraftProductNotesFromDom();

    const customerName = normalizeText(
      document.querySelector("#customer-master-name")?.value
    );
    if (!customerName) {
      void showCustomerMasterDialog({
        type: "warning",
        icon: "⚠️",
        title: "取引先名を入力してください",
        message: "取引先名は必須です。",
        confirmText: "閉じる"
      });
      return null;
    }

    const monitorSalesActual = Boolean(
      document.querySelector("#customer-master-monitor")?.checked
    );
    const monitorKeyword = monitorSalesActual
      ? normalizeText(
          document.querySelector("#customer-master-monitor-keyword")?.value
        ) || customerName
      : "";

    return {
      customerCode: normalizeText(
        document.querySelector("#customer-master-code")?.value
      ),
      customerName: customerName,
      contactPerson: normalizeText(
        document.querySelector("#customer-master-contact")?.value
      ),
      phone: normalizeText(
        document.querySelector("#customer-master-phone")?.value
      ),
      email: normalizeText(
        document.querySelector("#customer-master-email")?.value
      ),
      address: normalizeMultiline(
        document.querySelector("#customer-master-address")?.value
      ),
      shippingAddress: normalizeMultiline(
        document.querySelector("#customer-master-shipping-address")?.value
      ),
      shippingNote: normalizeMultiline(
        document.querySelector("#customer-master-shipping-note")?.value
      ),
      memo: normalizeMultiline(
        document.querySelector("#customer-master-memo")?.value
      ),
      monitorSalesActual: monitorSalesActual,
      monitorKeyword: monitorKeyword,
      productNotes: normalizeProductNotes(draftProductNotes)
    };
  }

  async function deleteCurrentCustomer() {
    const customer = customers.find(function (item) {
      return item.id === editingCustomerId;
    });
    if (!customer) return;

    const confirmed = await showCustomerMasterDialog({
      type: "danger",
      icon: "🗑️",
      title: "この取引先を削除しますか？",
      message: `${customer.customerName} の担当者・連絡先・注意事項を削除します。`,
      notice:
        "商品マスタ・販売実績・販売予定そのものは削除しません。",
      isConfirm: true,
      cancelText: "戻る",
      confirmText: "削除する"
    });
    if (!confirmed) return;

    try {
      await deleteCustomer(customer.id);
      customers = customers.filter(function (item) {
        return item.id !== customer.id;
      });
      if (customer.monitorSalesActual) {
        removeMonitorKeywordIfUnused(
          customer.monitorKeyword || customer.customerName,
          ""
        );
      }
      renderCustomerList();
      closeCustomerEditor();
    } catch (error) {
      console.error("取引先削除エラー", error);
      await showCustomerMasterDialog({
        type: "danger",
        icon: "⚠️",
        title: "取引先を削除できませんでした",
        message: "もう一度お試しください。",
        confirmText: "閉じる"
      });
    }
  }

  function renderProductSearchResults() {
    const container = document.querySelector(
      "#customer-master-product-search-results"
    );
    const input = document.querySelector(
      "#customer-master-product-search"
    );
    if (!container || !input) return;

    const keyword = normalizeSearchText(input.value);
    if (!keyword) {
      container.innerHTML = "";
      return;
    }

    const addedCodes = new Set(
      draftProductNotes.map(function (item) {
        return item.internalCode;
      })
    );

    const matched = products
      .filter(function (product) {
        const internalCode = normalizeText(product?.internalCode);
        if (!internalCode || addedCodes.has(internalCode)) return false;
        const target = normalizeSearchText([
          internalCode,
          product?.productCode,
          product?.name,
          product?.productName
        ].join(" "));
        return target.includes(keyword);
      })
      .slice(0, 8);

    if (!matched.length) {
      container.innerHTML =
        '<p class="customer-master-product-search-empty">該当する未追加の商品はありません。</p>';
      return;
    }

    container.innerHTML = matched.map(function (product) {
      const name = normalizeText(product.name || product.productName);
      return `
        <div class="customer-master-product-result">\n          <div>\n            <strong>${escapeHtml(name || "商品名なし")}</strong>\n            <small>社内コード：${escapeHtml(product.internalCode || "-")} / 商品コード：${escapeHtml(product.productCode || "-")}</small>\n          </div>\n          <button type="button" data-add-product-note="${escapeAttribute(product.internalCode || "")}">追加</button>\n        </div>
      `;
    }).join("");

    container
      .querySelectorAll("[data-add-product-note]")
      .forEach(function (button) {
        button.addEventListener("click", function () {
          addProductNote(
            button.getAttribute("data-add-product-note") || ""
          );
        });
      });
  }

  function addProductNote(internalCode) {
    const product = products.find(function (item) {
      return normalizeText(item?.internalCode) === internalCode;
    });
    if (!product) return;

    syncDraftProductNotesFromDom();
    if (
      draftProductNotes.some(function (item) {
        return item.internalCode === internalCode;
      })
    ) {
      return;
    }

    draftProductNotes.push({
      internalCode: internalCode,
      productCode: normalizeText(product.productCode),
      productName: normalizeText(product.name || product.productName),
      note: ""
    });

    clearProductSearch();
    renderDraftProductNotes();
  }

  function renderDraftProductNotes() {
    const container = document.querySelector(
      "#customer-master-product-notes-list"
    );
    if (!container) return;

    if (!draftProductNotes.length) {
      container.innerHTML =
        '<p class="customer-master-product-notes-empty">商品別の注意事項はまだありません。</p>';
      return;
    }

    container.innerHTML = draftProductNotes.map(function (item, index) {
      return `
        <div class="customer-master-product-note-card" data-product-note-index="${index}">\n          <div class="customer-master-product-note-heading">\n            <div>\n              <strong>${escapeHtml(item.productCode || item.internalCode)}</strong>\n              <small>${escapeHtml(item.productName || "")} / 社内コード：${escapeHtml(item.internalCode)}</small>\n            </div>\n            <button type="button" class="customer-master-remove-note" data-remove-product-note="${index}">削除</button>\n          </div>\n          <textarea rows="2" data-product-note-text="${index}" placeholder="この商品をこの取引先へ出荷するときの注意事項">${escapeHtml(item.note || "")}</textarea>\n        </div>
      `;
    }).join("");

    container
      .querySelectorAll("[data-remove-product-note]")
      .forEach(function (button) {
        button.addEventListener("click", function () {
          syncDraftProductNotesFromDom();
          const index = Number(
            button.getAttribute("data-remove-product-note")
          );
          if (!Number.isInteger(index)) return;
          draftProductNotes.splice(index, 1);
          renderDraftProductNotes();
        });
      });
  }

  function syncDraftProductNotesFromDom() {
    document
      .querySelectorAll("[data-product-note-text]")
      .forEach(function (textarea) {
        const index = Number(
          textarea.getAttribute("data-product-note-text")
        );
        if (
          Number.isInteger(index) &&
          draftProductNotes[index]
        ) {
          draftProductNotes[index].note =
            normalizeMultiline(textarea.value);
        }
      });
  }

  function clearProductSearch() {
    setValue("#customer-master-product-search", "");
    const container = document.querySelector(
      "#customer-master-product-search-results"
    );
    if (container) container.innerHTML = "";
  }

  async function syncMonitorSettingsAfterSave(record) {
    const newKeyword = record.monitorSalesActual
      ? normalizeText(record.monitorKeyword || record.customerName)
      : "";

    if (
      originalMonitorKeyword &&
      normalizeMonitorMatch(originalMonitorKeyword) !==
        normalizeMonitorMatch(newKeyword)
    ) {
      removeMonitorKeywordIfUnused(
        originalMonitorKeyword,
        record.id
      );
    }

    if (newKeyword) {
      addMonitorKeyword(newKeyword);
    }

    originalMonitorKeyword = newKeyword;
  }

  function getMonitorKeywords() {
    const raw = localStorage.getItem(
      MONITORED_CUSTOMERS_KEY
    );
    if (raw === null) return ["清水産業", "後藤"];
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return ["清水産業", "後藤"];
      return parsed
        .map(normalizeText)
        .filter(Boolean)
        .filter(function (value, index, list) {
          return list.findIndex(function (other) {
            return normalizeMonitorMatch(other) ===
              normalizeMonitorMatch(value);
          }) === index;
        });
    } catch (error) {
      return ["清水産業", "後藤"];
    }
  }

  function saveMonitorKeywords(values) {
    const normalized = values
      .map(normalizeText)
      .filter(Boolean)
      .filter(function (value, index, list) {
        return list.findIndex(function (other) {
          return normalizeMonitorMatch(other) ===
            normalizeMonitorMatch(value);
        }) === index;
      });
    localStorage.setItem(
      MONITORED_CUSTOMERS_KEY,
      JSON.stringify(normalized)
    );
    window.dispatchEvent(
      new CustomEvent(
        "inventory-monitored-customers-change",
        { detail: { customers: normalized.slice() } }
      )
    );
  }

  function addMonitorKeyword(keyword) {
    const values = getMonitorKeywords();
    const match = normalizeMonitorMatch(keyword);
    if (
      !values.some(function (value) {
        return normalizeMonitorMatch(value) === match;
      })
    ) {
      values.push(keyword);
      saveMonitorKeywords(values);
    }
  }

  function removeMonitorKeywordIfUnused(keyword, excludedCustomerId) {
    const match = normalizeMonitorMatch(keyword);
    if (!match) return;

    const usedByOtherCustomer = customers.some(function (customer) {
      if (customer.id === excludedCustomerId) return false;
      if (!customer.monitorSalesActual) return false;
      return normalizeMonitorMatch(
        customer.monitorKeyword || customer.customerName
      ) === match;
    });
    if (usedByOtherCustomer) return;

    const values = getMonitorKeywords().filter(function (value) {
      return normalizeMonitorMatch(value) !== match;
    });
    saveMonitorKeywords(values);
  }

  function normalizeMonitorMatch(value) {
    return normalizeText(value)
      .replace(/[\s\u3000]+/g, "")
      .toLocaleLowerCase("ja-JP");
  }

  function createCustomerId() {
    return `customer-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 9)}`;
  }

  function normalizeText(value) {
    return String(value || "")
      .normalize("NFKC")
      .replace(/\u3000/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function normalizeMultiline(value) {
    return String(value || "")
      .normalize("NFKC")
      .replace(/\r\n?/g, "\n")
      .split("\n")
      .map(function (line) {
        return line.replace(/[\t\u3000]+/g, " ").trimEnd();
      })
      .join("\n")
      .trim();
  }

  function normalizeSearchText(value) {
    return normalizeText(value)
      .replace(/[\s\u3000]+/g, "")
      .toLocaleLowerCase("ja-JP");
  }

  function setValue(selector, value) {
    const element = document.querySelector(selector);
    if (element) element.value = value || "";
  }

  function setText(selector, value) {
    const element = document.querySelector(selector);
    if (element) element.textContent = value || "";
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function escapeAttribute(value) {
    return escapeHtml(value).replace(/`/g, "&#096;");
  }

  function showCustomerMasterDialog(options) {
    if (typeof showAppDialog === "function") {
      return showAppDialog(options);
    }

    const text = [
      options.title,
      options.message,
      options.notice
    ].filter(Boolean).join("\n\n");

    if (options.isConfirm) {
      return Promise.resolve(window.confirm(text));
    }
    window.alert(text);
    return Promise.resolve(true);
  }

  function createCustomerMasterStyle() {
    if (document.querySelector("#customer-master-style")) return;

    const style = document.createElement("style");
    style.id = "customer-master-style";
    style.textContent = `
      #customer-master-screen {
        max-width: 1180px;
        margin: 20px auto;
        padding: 20px;
        background: #fff;
        border-radius: 14px;
        box-shadow: 0 4px 18px rgba(0, 0, 0, .08);
      }
      .customer-master-title-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 16px;
        border-bottom: 2px solid #78b7ff;
        padding-bottom: 10px;
      }
      .customer-master-title-row h2 { margin: 2px 0 0; color: #1267b9; }
      .customer-master-kicker { margin: 0; color: #1267b9; font-size: .85rem; font-weight: 700; }
      #back-home-from-customer-master { background: #546e7a; }
      .customer-master-intro { line-height: 1.8; }
      .customer-master-security-note {
        margin: 12px 0 16px;
        padding: 12px 14px;
        border: 1px solid #efb34d;
        border-radius: 10px;
        background: #fff7e4;
        color: #754800;
        line-height: 1.7;
      }
      .customer-master-toolbar {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        align-items: end;
        gap: 12px;
        padding: 14px;
        border: 1px solid #bdd8ef;
        border-radius: 12px;
        background: #f7fbff;
      }
      .customer-master-toolbar label { display: grid; gap: 6px; font-weight: 700; }
      .customer-master-toolbar input { width: 100%; min-height: 44px; }
      #customer-master-new-button { background: #087f6c; min-height: 44px; }
      .customer-master-summary {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 12px;
        margin: 14px 0;
      }
      .customer-master-summary > div {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
        padding: 13px 16px;
        border: 1px solid #d5e0e8;
        border-radius: 10px;
        background: #fff;
      }
      .customer-master-summary strong { font-size: 1.35rem; color: #0d579c; }
      .customer-master-table-wrap { overflow-x: auto; }
      .customer-master-table { width: 100%; border-collapse: collapse; }
      .customer-master-table th,
      .customer-master-table td { border: 1px solid #d6dee5; padding: 10px; vertical-align: middle; }
      .customer-master-table th { background: #eaf2f8; white-space: nowrap; }
      .customer-master-table td strong { color: #183d5a; }
      .customer-master-edit-button { background: #176dcc; white-space: nowrap; }
      .customer-master-monitor-cell small { display: block; margin-top: 3px; color: #617180; }
      .customer-master-monitor-on,
      .customer-master-monitor-off {
        display: inline-block;
        padding: 3px 8px;
        border-radius: 999px;
        font-size: .82rem;
        font-weight: 800;
      }
      .customer-master-monitor-on { background: #dff3e3; color: #16722b; }
      .customer-master-monitor-off { background: #eceff1; color: #607078; }
      .customer-master-empty { padding: 20px; text-align: center; color: #6d7f8a; }
      .customer-master-editor {
        margin-top: 18px;
        padding: 16px;
        border: 2px solid #63a9ee;
        border-radius: 14px;
        background: #fbfdff;
      }
      .customer-master-editor-heading {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 10px;
        margin-bottom: 14px;
      }
      .customer-master-editor-heading h3 { margin: 0; color: #125d9e; }
      #customer-master-editor-status {
        padding: 4px 10px;
        border-radius: 999px;
        background: #e6f1fc;
        color: #125d9e;
        font-weight: 800;
      }
      .customer-master-form-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 12px;
      }
      .customer-master-form-grid label,
      .customer-master-monitor-box label {
        display: grid;
        gap: 6px;
        font-weight: 700;
      }
      .customer-master-form-grid input,
      .customer-master-form-grid textarea,
      .customer-master-monitor-box input,
      .customer-master-product-search-row input,
      .customer-master-product-note-card textarea {
        width: 100%;
      }
      .customer-master-wide-fields { margin-top: 12px; }
      .required { color: #d62e2e; font-size: .85rem; }
      .customer-master-monitor-box {
        margin-top: 16px;
        padding: 14px;
        border: 1px solid #8acbc1;
        border-radius: 12px;
        background: #eefaf8;
      }
      .customer-master-monitor-box p { margin: 8px 0 0; color: #496864; }
      .customer-master-check-label {
        display: flex !important;
        grid-template-columns: none !important;
        flex-direction: row;
        align-items: center;
        gap: 8px !important;
        margin-bottom: 10px;
      }
      .customer-master-check-label input { width: 22px !important; height: 22px; }
      .customer-master-product-notes {
        margin-top: 16px;
        padding: 14px;
        border: 1px solid #d4dce4;
        border-radius: 12px;
        background: #fff;
      }
      .customer-master-product-notes h4 { margin: 0 0 6px; color: #263f55; }
      .customer-master-product-search-row { margin: 10px 0; }
      .customer-master-product-search-results { display: grid; gap: 8px; }
      .customer-master-product-result {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 10px;
        padding: 10px;
        border: 1px solid #bed8ec;
        border-radius: 9px;
        background: #f4faff;
      }
      .customer-master-product-result small,
      .customer-master-product-note-heading small { display: block; margin-top: 3px; color: #607889; }
      .customer-master-product-result button { background: #1976d2; }
      .customer-master-product-notes-list { display: grid; gap: 10px; margin-top: 12px; }
      .customer-master-product-note-card {
        padding: 10px;
        border: 1px solid #d6dee5;
        border-radius: 10px;
        background: #fafafa;
      }
      .customer-master-product-note-heading {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 10px;
        margin-bottom: 8px;
      }
      .customer-master-remove-note { background: #777; padding: 8px 12px; }
      .customer-master-product-notes-empty,
      .customer-master-product-search-empty { color: #71818d; }
      .customer-master-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        margin-top: 16px;
      }
      #customer-master-save-button { background: #24843a; }
      #customer-master-cancel-button { background: #607d8b; }
      #customer-master-delete-button { background: #c62828; margin-left: auto; }
      @media (max-width: 760px) {
        #customer-master-screen { margin: 8px; padding: 13px; }
        .customer-master-title-row,
        .customer-master-product-result,
        .customer-master-product-note-heading { align-items: stretch; flex-direction: column; }
        .customer-master-toolbar,
        .customer-master-form-grid,
        .customer-master-summary { grid-template-columns: 1fr; }
        .customer-master-table th:nth-child(1),
        .customer-master-table td:nth-child(1),
        .customer-master-table th:nth-child(4),
        .customer-master-table td:nth-child(4) { display: none; }
        #customer-master-delete-button { margin-left: 0; }
      }
    `;
    document.head.appendChild(style);
  }
})();
