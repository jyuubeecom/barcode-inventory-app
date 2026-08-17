"use strict";

(function () {
  const DISPLAY_MODE_KEY =
    "barcodeInventoryDisplayMode";
  const ROLE_MODE_KEY =
    "barcodeInventoryRoleMode";
  const ADMIN_PIN_HASH_KEY =
    "barcodeInventoryAdminPinHash";

  const DISPLAY_MODES = new Set([
    "auto",
    "pc",
    "mobile"
  ]);

  const ROLE_MODES = new Set([
    "admin",
    "worker"
  ]);

  const WORKER_HOME_ACTIONS = new Set([
    "show-camera-scanner-button",
    "show-list-button",
    "show-stocktaking-button",
    "show-barcode-lookup-button",
    "show-history-button",
    "show-transfer-list-button",
    "show-sales-plan-list-button",
    "show-purchase-required-button",
    "show-low-shipment-button",
    "show-stocktaking-history-button"
  ]);

  let homeObserver = null;
  let displayMedia = null;

  document.addEventListener(
    "DOMContentLoaded",
    initializeAppSettings
  );

  function initializeAppSettings() {
    createAppSettingsStyle();
    bindAppSettingsEvents();

    displayMedia = window.matchMedia(
      "(min-width: 901px)"
    );

    if (
      typeof displayMedia.addEventListener ===
      "function"
    ) {
      displayMedia.addEventListener(
        "change",
        handleAutoDisplayModeChange
      );
    } else if (
      typeof displayMedia.addListener ===
      "function"
    ) {
      displayMedia.addListener(
        handleAutoDisplayModeChange
      );
    }

    applySavedAppSettings();
    updatePinSettingsArea();
    watchHomeMenuChanges();
    watchPermissionSensitiveElements();
  }

  function getSavedDisplayMode() {
    const saved =
      localStorage.getItem(
        DISPLAY_MODE_KEY
      );

    return DISPLAY_MODES.has(saved)
      ? saved
      : "auto";
  }

  function getSavedRoleMode() {
    const saved =
      localStorage.getItem(
        ROLE_MODE_KEY
      );

    // 既存利用者のメニューが突然減らないよう、初期値は管理者にします。
    return ROLE_MODES.has(saved)
      ? saved
      : "admin";
  }

  function resolveDisplayMode(
    displayMode
  ) {
    if (displayMode === "pc") {
      return "pc";
    }

    if (displayMode === "mobile") {
      return "mobile";
    }

    const media =
      displayMedia ||
      window.matchMedia(
        "(min-width: 901px)"
      );

    return media.matches
      ? "pc"
      : "mobile";
  }

  function applySavedAppSettings() {
    const displayMode =
      getSavedDisplayMode();
    const roleMode =
      getSavedRoleMode();

    applyDisplayMode(displayMode);
    applyRoleMode(roleMode);
    syncSettingsInputs(
      displayMode,
      roleMode
    );
    updateHomeModeStatus(
      displayMode,
      roleMode
    );
  }

  function applyDisplayMode(
    displayMode
  ) {
    const resolvedMode =
      resolveDisplayMode(displayMode);

    document.body.dataset.displayMode =
      displayMode;
    document.body.dataset.resolvedDisplayMode =
      resolvedMode;

    window.dispatchEvent(
      new CustomEvent(
        "inventory-display-mode-change",
        {
          detail: {
            displayMode: displayMode,
            resolvedMode: resolvedMode
          }
        }
      )
    );
  }

  function applyRoleMode(roleMode) {
    document.body.dataset.roleMode =
      roleMode;

    applyHomeMenuVisibility(
      roleMode
    );
    applyAdminOnlyVisibility(
      roleMode
    );
    updatePinSettingsArea();
    enforceWorkerScreenRestriction(
      roleMode
    );

    window.dispatchEvent(
      new CustomEvent(
        "inventory-role-mode-change",
        {
          detail: {
            roleMode: roleMode
          }
        }
      )
    );
  }

  function applyHomeMenuVisibility(
    roleMode
  ) {
    const buttons =
      document.querySelectorAll(
        "#home button[id]"
      );

    buttons.forEach(
      function (button) {
        if (
          button.id ===
          "show-app-settings-button"
        ) {
          button.classList.remove(
            "role-menu-hidden"
          );
          return;
        }

        if (roleMode === "admin") {
          button.classList.remove(
            "role-menu-hidden"
          );
          return;
        }

        const isAllowed =
          WORKER_HOME_ACTIONS.has(
            button.id
          );

        button.classList.toggle(
          "role-menu-hidden",
          !isAllowed
        );
      }
    );

    const notice =
      document.querySelector(
        "#home-role-notice"
      );

    if (notice) {
      const shouldHide =
        roleMode !== "worker";

      notice.hidden =
        shouldHide;
      notice.classList.toggle(
        "role-menu-hidden",
        shouldHide
      );
    }
  }

  function syncSettingsInputs(
    displayMode,
    roleMode
  ) {
    const displaySelect =
      document.querySelector(
        "#app-display-mode"
      );
    const roleSelect =
      document.querySelector(
        "#app-role-mode"
      );

    if (displaySelect) {
      displaySelect.value =
        displayMode;
    }

    if (roleSelect) {
      roleSelect.value = roleMode;
    }
  }

  function updateHomeModeStatus(
    displayMode,
    roleMode
  ) {
    const status =
      document.querySelector(
        "#home-mode-status"
      );

    if (!status) {
      return;
    }

    const resolvedMode =
      resolveDisplayMode(displayMode);

    const displayText =
      displayMode === "auto"
        ? `自動（${
            resolvedMode === "pc"
              ? "PC表示"
              : "スマホ表示"
          }）`
        : displayMode === "pc"
          ? "PC表示"
          : "スマホ表示";

    const roleText =
      roleMode === "admin"
        ? "管理者"
        : "作業者";

    status.textContent =
      `${displayText} / ${roleText}`;

    status.classList.toggle(
      "home-mode-admin",
      roleMode === "admin"
    );
    status.classList.toggle(
      "home-mode-worker",
      roleMode === "worker"
    );
  }

  function bindAppSettingsEvents() {
    document
      .querySelector(
        "#show-app-settings-button"
      )
      ?.addEventListener(
        "click",
        openAppSettingsScreen
      );

    document
      .querySelector(
        "#save-app-settings-button"
      )
      ?.addEventListener(
        "click",
        saveAppSettings
      );

    document
      .querySelector(
        "#back-home-from-app-settings"
      )
      ?.addEventListener(
        "click",
        closeAppSettingsScreen
      );

    document
      .querySelector(
        "#app-role-mode"
      )
      ?.addEventListener(
        "change",
        updatePinSettingsArea
      );
  }

  function openAppSettingsScreen() {
    const settingsScreen =
      document.querySelector(
        "#app-settings-screen"
      );

    if (!settingsScreen) {
      return;
    }

    syncSettingsInputs(
      getSavedDisplayMode(),
      getSavedRoleMode()
    );

    document
      .querySelectorAll(
        "main > section"
      )
      .forEach(
        function (section) {
          if (
            section.id ===
            "app-settings-screen"
          ) {
            return;
          }

          section.hidden = true;
          section.classList.add(
            "app-settings-exclusive-hidden"
          );
        }
      );

    settingsScreen.classList.remove(
      "app-settings-exclusive-hidden"
    );
    settingsScreen.hidden = false;
    settingsScreen.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }

  function closeAppSettingsScreen() {
    const settingsScreen =
      document.querySelector(
        "#app-settings-screen"
      );

    if (settingsScreen) {
      settingsScreen.hidden = true;
    }

    document
      .querySelectorAll(
        "main > section"
      )
      .forEach(
        function (section) {
          section.classList.remove(
            "app-settings-exclusive-hidden"
          );
        }
      );

    if (
      window.inventoryApp &&
      typeof window.inventoryApp.showScreen ===
        "function"
    ) {
      window.inventoryApp.showScreen(
        "home"
      );
    } else {
      const home =
        document.querySelector("#home");

      if (home) {
        home.hidden = false;
      }
    }

    document
      .querySelector("#home")
      ?.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
  }

  async function saveAppSettings() {
    const displaySelect =
      document.querySelector(
        "#app-display-mode"
      );
    const roleSelect =
      document.querySelector(
        "#app-role-mode"
      );

    if (!displaySelect || !roleSelect) {
      return;
    }

    const displayMode =
      DISPLAY_MODES.has(
        displaySelect.value
      )
        ? displaySelect.value
        : "auto";

    const requestedRole =
      ROLE_MODES.has(roleSelect.value)
        ? roleSelect.value
        : "admin";

    const currentRole =
      getSavedRoleMode();

    if (currentRole === "admin") {
      const pinSaved =
        await saveAdminPinIfEntered();

      if (!pinSaved) {
        return;
      }

      if (
        requestedRole === "worker" &&
        !hasAdminPin()
      ) {
        await showSettingsDialog({
          type: "warning",
          icon: "🔐",
          title: "管理者PINを設定してください",
          message:
            "作業者モードへ切り替える前に、管理者へ戻るためのPINを設定してください。",
          notice:
            "管理者PINは4～8桁の数字で設定します。",
          confirmText: "PINを設定する"
        });

        document
          .querySelector("#admin-pin-input")
          ?.focus();

        return;
      }
    }

    let roleMode = requestedRole;

    if (
      currentRole === "worker" &&
      requestedRole === "admin"
    ) {
      const verified =
        await requestAdminPin();

      if (!verified) {
        roleSelect.value = "worker";
        return;
      }

      roleMode = "admin";
    }

    localStorage.setItem(
      DISPLAY_MODE_KEY,
      displayMode
    );
    localStorage.setItem(
      ROLE_MODE_KEY,
      roleMode
    );

    applyDisplayMode(displayMode);
    applyRoleMode(roleMode);
    syncSettingsInputs(
      displayMode,
      roleMode
    );
    updateHomeModeStatus(
      displayMode,
      roleMode
    );

    const displayText =
      displayMode === "auto"
        ? "自動"
        : displayMode === "pc"
          ? "PC表示"
          : "スマホ表示";
    const roleText =
      roleMode === "admin"
        ? "管理者"
        : "作業者";

    await showSettingsDialog({
      type: "success",
      icon: "✅",
      title: "表示・権限設定を保存しました",
      message:
        "この端末で使う表示モードと権限モードを保存しました。",
      details: [
        {
          label: "表示モード",
          value: displayText
        },
        {
          label: "権限モード",
          value: roleText
        }
      ],
      notice:
        roleMode === "worker"
          ? "作業者モードでは、商品登録・商品編集・商品削除・数量調整などの管理操作を制限します。"
          : "管理者モードでは、管理操作を使用できます。",
      confirmText: "閉じる"
    });
  }

  async function saveAdminPinIfEntered() {
    const pinInput =
      document.querySelector(
        "#admin-pin-input"
      );
    const confirmInput =
      document.querySelector(
        "#admin-pin-confirm-input"
      );

    if (!pinInput || !confirmInput) {
      return true;
    }

    const pin =
      String(pinInput.value || "").trim();
    const pinConfirm =
      String(confirmInput.value || "").trim();

    if (pin === "" && pinConfirm === "") {
      return true;
    }

    if (!/^\d{4,8}$/.test(pin)) {
      await showSettingsDialog({
        type: "warning",
        icon: "🔢",
        title: "管理者PINを確認してください",
        message:
          "管理者PINは4～8桁の数字で入力してください。",
        details: [
          {
            label: "入力できる形式",
            value: "4～8桁の数字"
          }
        ],
        confirmText: "入力に戻る"
      });

      pinInput.focus();
      return false;
    }

    if (pin !== pinConfirm) {
      await showSettingsDialog({
        type: "warning",
        icon: "⚠️",
        title: "管理者PINが一致しません",
        message:
          "確認用PINに同じ数字を入力してください。",
        confirmText: "入力に戻る"
      });

      confirmInput.focus();
      return false;
    }

    const pinHash =
      await hashAdminPin(pin);

    localStorage.setItem(
      ADMIN_PIN_HASH_KEY,
      pinHash
    );

    pinInput.value = "";
    confirmInput.value = "";

    updatePinSettingsArea();

    return true;
  }

  function hasAdminPin() {
    return Boolean(
      localStorage.getItem(
        ADMIN_PIN_HASH_KEY
      )
    );
  }

  async function hashAdminPin(pin) {
    const source =
      new TextEncoder().encode(
        String(pin)
      );

    if (
      window.crypto &&
      window.crypto.subtle
    ) {
      const digest =
        await window.crypto.subtle.digest(
          "SHA-256",
          source
        );

      return Array.from(
        new Uint8Array(digest)
      )
        .map(function (value) {
          return value
            .toString(16)
            .padStart(2, "0");
        })
        .join("");
    }

    // 古いブラウザ向けの簡易フォールバック。
    // 本機能は端末内の誤操作防止用であり、本格認証ではありません。
    return Array.from(source)
      .map(function (value) {
        return value
          .toString(16)
          .padStart(2, "0");
      })
      .join("");
  }

  async function verifyAdminPin(pin) {
    const savedHash =
      localStorage.getItem(
        ADMIN_PIN_HASH_KEY
      );

    if (!savedHash) {
      return false;
    }

    return (
      (await hashAdminPin(pin)) ===
      savedHash
    );
  }

  function requestAdminPin() {
    return new Promise(
      function (resolve) {
        const oldDialog =
          document.querySelector(
            "#admin-pin-dialog"
          );

        if (oldDialog) {
          oldDialog.remove();
        }

        const overlay =
          document.createElement("div");
        overlay.id = "admin-pin-dialog";
        overlay.className =
          "app-dialog-overlay";
        overlay.setAttribute(
          "role",
          "dialog"
        );
        overlay.setAttribute(
          "aria-modal",
          "true"
        );

        const modal =
          document.createElement("div");
        modal.className =
          "app-dialog-modal app-dialog-warning";

        const header =
          document.createElement("div");
        header.className =
          "app-dialog-header";

        const icon =
          document.createElement("div");
        icon.className =
          "app-dialog-icon";
        icon.textContent = "🔐";

        const title =
          document.createElement("h2");
        title.className =
          "app-dialog-title";
        title.textContent =
          "管理者PINを入力してください";

        header.appendChild(icon);
        header.appendChild(title);

        const content =
          document.createElement("div");
        content.className =
          "app-dialog-content";

        const message =
          document.createElement("p");
        message.className =
          "app-dialog-message";
        message.textContent =
          "管理者モードへ切り替えるには、設定した管理者PINが必要です。";

        const input =
          document.createElement("input");
        input.type = "password";
        input.inputMode = "numeric";
        input.autocomplete = "off";
        input.maxLength = 8;
        input.placeholder =
          "4～8桁の管理者PIN";
        input.className =
          "admin-pin-dialog-input";

        const error =
          document.createElement("p");
        error.className =
          "admin-pin-dialog-error";
        error.hidden = true;

        content.appendChild(message);
        content.appendChild(input);
        content.appendChild(error);

        const actions =
          document.createElement("div");
        actions.className =
          "app-dialog-actions";

        const cancelButton =
          document.createElement("button");
        cancelButton.type = "button";
        cancelButton.className =
          "app-dialog-button app-dialog-cancel";
        cancelButton.textContent = "戻る";

        const confirmButton =
          document.createElement("button");
        confirmButton.type = "button";
        confirmButton.className =
          "app-dialog-button app-dialog-confirm";
        confirmButton.textContent =
          "管理者モードへ切り替える";

        actions.appendChild(
          cancelButton
        );
        actions.appendChild(
          confirmButton
        );

        modal.appendChild(header);
        modal.appendChild(content);
        modal.appendChild(actions);
        overlay.appendChild(modal);
        document.body.appendChild(
          overlay
        );
        document.body.classList.add(
          "app-dialog-open"
        );

        let finished = false;

        function finish(result) {
          if (finished) {
            return;
          }

          finished = true;
          overlay.remove();
          document.body.classList.remove(
            "app-dialog-open"
          );
          resolve(result);
        }

        async function confirmPin() {
          const pin =
            String(input.value || "")
              .trim();

          if (!/^\d{4,8}$/.test(pin)) {
            error.textContent =
              "4～8桁の数字を入力してください。";
            error.hidden = false;
            input.focus();
            return;
          }

          const verified =
            await verifyAdminPin(pin);

          if (!verified) {
            error.textContent =
              "管理者PINが違います。もう一度確認してください。";
            error.hidden = false;
            input.select();
            return;
          }

          finish(true);
        }

        cancelButton.addEventListener(
          "click",
          function () {
            finish(false);
          }
        );

        confirmButton.addEventListener(
          "click",
          confirmPin
        );

        input.addEventListener(
          "keydown",
          function (event) {
            if (event.key === "Enter") {
              event.preventDefault();
              void confirmPin();
            }

            if (event.key === "Escape") {
              finish(false);
            }
          }
        );

        window.setTimeout(
          function () {
            input.focus();
          },
          0
        );
      }
    );
  }

  function updatePinSettingsArea() {
    const pinArea =
      document.querySelector(
        "#admin-pin-settings"
      );
    const pinStatus =
      document.querySelector(
        "#admin-pin-status"
      );
    const roleSelect =
      document.querySelector(
        "#app-role-mode"
      );

    if (!pinArea || !pinStatus) {
      return;
    }

    const currentRole =
      getSavedRoleMode();

    const hidePinArea =
      currentRole !== "admin";

    pinArea.hidden =
      hidePinArea;
    pinArea.classList.toggle(
      "role-menu-hidden",
      hidePinArea
    );

    pinStatus.textContent =
      hasAdminPin()
        ? "管理者PIN：設定済み"
        : "管理者PIN：未設定";

    pinStatus.classList.toggle(
      "pin-configured",
      hasAdminPin()
    );

    if (
      roleSelect &&
      currentRole === "worker"
    ) {
      roleSelect.title =
        "管理者へ切り替える場合はPIN確認があります。";
    }
  }

  function isAdminMode() {
    return (
      getSavedRoleMode() === "admin"
    );
  }

  function isWorkerMode() {
    return !isAdminMode();
  }

  function applyAdminOnlyVisibility(
    roleMode
  ) {
    const adminOnlySelectors = [
      "#show-register-button",
      "#stock-adjust-from-detail-button",
      "#edit-from-detail-button",
      "#delete-from-detail-button"
    ];

    adminOnlySelectors.forEach(
      function (selector) {
        document
          .querySelectorAll(selector)
          .forEach(
            function (element) {
              element.classList.toggle(
                "role-menu-hidden",
                roleMode === "worker"
              );
            }
          );
      }
    );

    const detailNotice =
      document.querySelector(
        "#product-detail-worker-notice"
      );

    if (detailNotice) {
      const shouldHide =
        roleMode !== "worker";

      detailNotice.hidden =
        shouldHide;
      detailNotice.classList.toggle(
        "role-menu-hidden",
        shouldHide
      );
    }
  }

  function enforceWorkerScreenRestriction(
    roleMode
  ) {
    if (roleMode !== "worker") {
      return;
    }

    const protectedSections = [
      "#product-register",
      "#product-edit",
      "#stock-adjust",
      "#unassigned-location-products"
    ];

    const openProtected =
      protectedSections.some(
        function (selector) {
          const section =
            document.querySelector(
              selector
            );

          return (
            section &&
            !section.hidden
          );
        }
      );

    if (!openProtected) {
      return;
    }

    if (
      window.inventoryApp &&
      typeof window.inventoryApp.showScreen ===
        "function"
    ) {
      window.inventoryApp.showScreen(
        "home"
      );
    }
  }

  async function showWorkerRestriction(
    actionName
  ) {
    await showSettingsDialog({
      type: "warning",
      icon: "🔒",
      title: "管理者専用の操作です",
      message:
        "作業者モードでは、この操作は実行できません。",
      details: [
        {
          label: "操作",
          value:
            actionName ||
            "管理操作"
        }
      ],
      notice:
        "必要な場合は「表示・権限設定」で管理者モードへ切り替えてください。管理者PINが必要です。",
      confirmText: "閉じる"
    });

    return false;
  }

  async function requireAdmin(
    actionName
  ) {
    if (isAdminMode()) {
      return true;
    }

    await showWorkerRestriction(
      actionName
    );
    return false;
  }

  function showSettingsDialog(options) {
    if (
      window.inventoryApp &&
      typeof window.inventoryApp.showAppDialog ===
        "function"
    ) {
      return window.inventoryApp.showAppDialog(
        options || {}
      );
    }

    const message = [
      options?.title || "お知らせ",
      options?.message || "",
      options?.notice || ""
    ]
      .filter(Boolean)
      .join("\n\n");

    window.alert(message);
    return Promise.resolve(true);
  }

  function watchPermissionSensitiveElements() {
    const observer =
      new MutationObserver(
        function () {
          applyAdminOnlyVisibility(
            getSavedRoleMode()
          );
        }
      );

    observer.observe(
      document.body,
      {
        childList: true,
        subtree: true
      }
    );
  }

  function handleAutoDisplayModeChange() {
    const displayMode =
      getSavedDisplayMode();

    if (displayMode !== "auto") {
      return;
    }

    applyDisplayMode("auto");
    updateHomeModeStatus(
      "auto",
      getSavedRoleMode()
    );
  }

  function watchHomeMenuChanges() {
    const home =
      document.querySelector("#home");

    if (!home) {
      return;
    }

    if (homeObserver) {
      homeObserver.disconnect();
    }

    homeObserver =
      new MutationObserver(
        function () {
          applyHomeMenuVisibility(
            getSavedRoleMode()
          );
        }
      );

    homeObserver.observe(home, {
      childList: true,
      subtree: true
    });
  }

  function createAppSettingsStyle() {
    const oldStyle =
      document.querySelector(
        "#app-settings-style"
      );

    if (oldStyle) {
      oldStyle.remove();
    }

    const style =
      document.createElement("style");
    style.id = "app-settings-style";
    style.textContent = `
      .role-menu-hidden,
      [hidden].role-menu-hidden {
        display: none !important;
      }

      .app-settings-exclusive-hidden {
        display: none !important;
      }

      #home-role-notice[hidden],
      #product-detail-worker-notice[hidden],
      #admin-pin-settings[hidden] {
        display: none !important;
      }

      .home-mode-actions {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: flex-end;
        gap: 8px;
      }

      #home-mode-status {
        display: inline-flex;
        align-items: center;
        min-height: 36px;
        padding: 7px 11px;
        border: 1px solid #90caf9;
        border-radius: 999px;
        background: #ffffff;
        color: #0d47a1;
        font-size: 14px;
        font-weight: 800;
        box-sizing: border-box;
      }

      #home-mode-status.home-mode-admin {
        border-color: #90caf9;
        background: #e3f2fd;
        color: #0d47a1;
      }

      #home-mode-status.home-mode-worker {
        border-color: #a5d6a7;
        background: #e8f5e9;
        color: #1b5e20;
      }

      #show-app-settings-button {
        width: auto;
        min-height: 40px;
        margin: 0;
        padding: 8px 14px;
        background: #455a64;
        font-size: 14px;
      }

      #home-role-notice {
        margin: 12px 0 0;
        padding: 12px 14px;
        border: 2px solid #90caf9;
        border-radius: 12px;
        background: #e3f2fd;
        color: #0d47a1;
        font-weight: 800;
      }

      #app-settings-screen {
        max-width: 880px;
        margin: 0 auto;
      }

      .app-settings-card {
        margin: 16px 0;
        padding: 18px;
        border: 2px solid #90caf9;
        border-radius: 16px;
        background: #ffffff;
      }

      .app-settings-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 16px;
      }

      .app-settings-grid label {
        display: block;
        margin-bottom: 7px;
        font-size: 17px;
        font-weight: 800;
      }

      .app-settings-grid select {
        width: 100%;
        min-height: 50px;
        margin: 0;
        font-size: 17px;
      }

      #admin-pin-settings {
        margin-top: 16px;
        padding: 16px;
        border: 2px solid #ffcc80;
        border-radius: 14px;
        background: #fff8e1;
      }

      #admin-pin-status {
        display: inline-block;
        margin-bottom: 12px;
        padding: 6px 10px;
        border-radius: 999px;
        background: #ffebee;
        color: #b71c1c;
        font-weight: 800;
      }

      #admin-pin-status.pin-configured {
        background: #e8f5e9;
        color: #1b5e20;
      }

      .admin-pin-fields {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
      }

      .admin-pin-fields input,
      .admin-pin-dialog-input {
        width: 100%;
        min-height: 52px;
        box-sizing: border-box;
        font-size: 20px;
        letter-spacing: 0.12em;
      }

      .admin-pin-dialog-error {
        margin: 10px 0 0;
        padding: 10px 12px;
        border-radius: 10px;
        background: #ffebee;
        color: #b71c1c;
        font-weight: 800;
      }

      #product-detail-worker-notice {
        margin: 14px 0;
        padding: 14px;
        border: 2px solid #90caf9;
        border-radius: 12px;
        background: #e3f2fd;
        color: #0d47a1;
        font-weight: 800;
      }

      .app-settings-note {
        margin: 14px 0 0;
        padding: 14px;
        border-radius: 12px;
        background: #fff8e1;
        color: #6d4c00;
        line-height: 1.7;
      }

      .app-settings-worker-menu {
        margin: 14px 0 0;
        padding: 14px;
        border-radius: 12px;
        background: #f5f7fa;
      }

      .app-settings-worker-menu strong {
        display: block;
        margin-bottom: 8px;
      }

      .app-settings-actions {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
        margin-top: 18px;
      }

      .app-settings-actions button {
        margin: 0;
        min-height: 52px;
        font-size: 17px;
      }

      #save-app-settings-button {
        background: #1565c0;
      }

      body[data-resolved-display-mode="mobile"]
        #home .home-function-grid {
        grid-template-columns: 1fr !important;
      }

      body[data-resolved-display-mode="mobile"]
        #home .home-action-grid {
        grid-template-columns: 1fr !important;
      }

      body[data-resolved-display-mode="mobile"]
        #home .home-summary-grid {
        grid-template-columns:
          repeat(2, minmax(0, 1fr)) !important;
      }

      body[data-resolved-display-mode="mobile"]
        #home button.home-dashboard-action {
        min-height: 58px;
        font-size: 17px;
      }

      body[data-resolved-display-mode="pc"]
        #home .home-function-grid {
        grid-template-columns:
          repeat(2, minmax(0, 1fr)) !important;
      }

      body[data-resolved-display-mode="pc"]
        #home .home-action-grid {
        grid-template-columns:
          repeat(4, minmax(0, 1fr)) !important;
      }

      body[data-resolved-display-mode="pc"]
        #home .home-summary-grid {
        grid-template-columns:
          repeat(4, minmax(0, 1fr)) !important;
      }

      @media (max-width: 700px) {
        .home-mode-actions {
          width: 100%;
          justify-content: stretch;
        }

        #home-mode-status,
        #home-mode-status.home-mode-admin {
        border-color: #90caf9;
        background: #e3f2fd;
        color: #0d47a1;
      }

      #home-mode-status.home-mode-worker {
        border-color: #a5d6a7;
        background: #e8f5e9;
        color: #1b5e20;
      }

      #show-app-settings-button {
          flex: 1 1 100%;
          justify-content: center;
          text-align: center;
        }

        .app-settings-grid,
        .app-settings-actions,
        .admin-pin-fields {
          grid-template-columns: 1fr;
        }
      }
    `;

    document.head.appendChild(style);
  }

  window.inventoryAppSettings = {
    getDisplayMode:
      getSavedDisplayMode,
    getResolvedDisplayMode:
      function () {
        return resolveDisplayMode(
          getSavedDisplayMode()
        );
      },
    getRoleMode:
      getSavedRoleMode,
    applySavedSettings:
      applySavedAppSettings
  };

  window.inventoryPermissions = {
    isAdmin: isAdminMode,
    isWorker: isWorkerMode,
    requireAdmin: requireAdmin,
    showWorkerRestriction:
      showWorkerRestriction,
    hasAdminPin: hasAdminPin
  };
})();
