"use strict";

const HOME_DASHBOARD_GROUPS = Object.freeze({
  "home-quick-action-buttons": [
    "show-camera-scanner-button",
    "show-list-button",
    "show-stocktaking-button",
    "show-register-button"
  ],
  "home-product-buttons": [
    "show-barcode-lookup-button",
    "show-unassigned-location-button",
    "export-products-csv-button",
    "show-csv-import-button"
  ],
  "home-inventory-buttons": [
    "show-history-button",
    "export-movements-csv-button"
  ],
  "home-sales-buttons": [
    "show-sales-plan-button",
    "show-sales-plan-list-button",
    "show-sales-actual-import-button",
    "show-purchase-required-button",
    "show-shipping-wish-button",
    "show-shipping-wish-list-button",
    "show-shipping-schedule-button",
    "show-shipping-allocation-button"
  ],
  "home-stocktaking-buttons": [
    "show-single-stock-check-button",
    "show-stocktaking-history-button",
    "show-stocktaking-aggregation-button",
    "export-stocktaking-csv-button"
  ],
  "home-backup-buttons": [
    "export-full-backup-button",
    "restore-full-backup-button",
    "restore-backup-file",
    "pwa-install-button"
  ]
});

const HOME_DASHBOARD_ACTION_CLASSES = Object.freeze({
  "show-camera-scanner-button": "home-action-camera",
  "show-list-button": "home-action-list",
  "show-stocktaking-button": "home-action-stocktaking",
  "show-register-button": "home-action-register",
  "show-barcode-lookup-button": "home-action-search",
  "show-unassigned-location-button": "home-action-location",
  "show-history-button": "home-action-history",
  "show-sales-plan-button": "home-action-sales",
  "show-sales-plan-list-button": "home-action-sales-list",
  "show-sales-actual-import-button": "home-action-sales-import",
  "show-purchase-required-button": "home-action-purchase-required",
  "show-shipping-wish-button": "home-action-shipping-wish",
  "show-shipping-wish-list-button": "home-action-shipping-wish-list",
  "show-shipping-schedule-button": "home-action-shipping-schedule",
  "show-shipping-allocation-button": "home-action-shipping-allocation",
  "show-single-stock-check-button": "home-action-stocktaking",
  "show-stocktaking-history-button": "home-action-stocktaking-history",
  "show-stocktaking-aggregation-button": "home-action-aggregation",
  "export-products-csv-button": "home-action-export",
  "export-movements-csv-button": "home-action-export",
  "export-stocktaking-csv-button": "home-action-export",
  "show-csv-import-button": "home-action-import",
  "export-full-backup-button": "home-action-backup",
  "restore-full-backup-button": "home-action-restore",
  "pwa-install-button": "home-action-install"
});

let homeDashboardObserver = null;
let homeDashboardOrganizeScheduled = false;
let homeDashboardDesktopMode = null;
let homeDashboardMobileExtrasOpen = false;
let homeDashboardVisibilityObserver = null;

document.addEventListener(
  "DOMContentLoaded",
  initializeHomeDashboard
);

function initializeHomeDashboard() {
  const homeScreen =
    document.querySelector("#home");

  if (!homeScreen) {
    return;
  }

  createHomeDashboardStyle();
  organizeHomeDashboardButtons();
  createMobileHomeControls(homeScreen);
  initializeHomeDashboardPanels();
  initializeMobileHomeLayout(homeScreen);
  watchHomeDashboardButtons(homeScreen);
  watchHomeDashboardVisibility(homeScreen);
}

function organizeHomeDashboardButtons() {
  Object.entries(
    HOME_DASHBOARD_GROUPS
  ).forEach(
    function (groupEntry) {
      const targetId = groupEntry[0];
      const elementIds = groupEntry[1];
      const target =
        document.querySelector(
          `#${targetId}`
        );

      if (!target) {
        return;
      }

      elementIds.forEach(
        function (elementId) {
          const element =
            document.querySelector(
              `#${elementId}`
            );

          if (!element) {
            return;
          }

          if (
            element.tagName ===
            "BUTTON"
          ) {
            applyHomeDashboardButtonClass(
              element
            );
          }

          if (
            element.parentElement !==
            target
          ) {
            target.appendChild(
              element
            );
          }
        }
      );
    }
  );

  updateHomeDashboardEmptyPanels();
}

function applyHomeDashboardButtonClass(
  button
) {
  button.classList.add(
    "home-dashboard-action"
  );

  const actionClass =
    HOME_DASHBOARD_ACTION_CLASSES[
      button.id
    ];

  if (actionClass) {
    button.classList.add(
      actionClass
    );
  }
}

function updateHomeDashboardEmptyPanels() {
  const panels =
    document.querySelectorAll(
      "#home .home-function-panel"
    );

  panels.forEach(
    function (panel) {
      const buttons =
        Array.from(
          panel.querySelectorAll(
            ".home-panel-buttons button"
          )
        );

      const visibleButtons =
        buttons.filter(
          function (button) {
            return (
              !button.hidden &&
              !button.classList.contains(
                "role-menu-hidden"
              )
            );
          }
        );

      panel.hidden =
        visibleButtons.length === 0;
    }
  );
}

function watchHomeDashboardButtons(
  homeScreen
) {
  if (homeDashboardObserver) {
    homeDashboardObserver.disconnect();
  }

  homeDashboardObserver =
    new MutationObserver(
      function () {
        if (
          homeDashboardOrganizeScheduled
        ) {
          return;
        }

        homeDashboardOrganizeScheduled =
          true;

        window.requestAnimationFrame(
          function () {
            homeDashboardOrganizeScheduled =
              false;

            organizeHomeDashboardButtons();
          }
        );
      }
    );

  homeDashboardObserver.observe(
    homeScreen,
    {
      childList: true,
      subtree: true
    }
  );
}

function createMobileHomeControls(
  homeScreen
) {
  const quickSection =
    homeScreen.querySelector(
      ".home-quick-section"
    );

  const functionGrid =
    homeScreen.querySelector(
      ".home-function-grid"
    );

  if (
    quickSection &&
    !quickSection.querySelector(
      ".mobile-home-primary-actions"
    )
  ) {
    const primaryActions =
      document.createElement("div");

    primaryActions.className =
      "mobile-home-primary-actions";

    const listButton =
      document.createElement("button");

    listButton.type = "button";
    listButton.className =
      "mobile-home-primary-button mobile-home-list-button";
    listButton.textContent =
      "商品一覧を見る";

    listButton.addEventListener(
      "click",
      function () {
        triggerMobileHomeAction(
          "show-list-button"
        );
      }
    );

    const stocktakingButton =
      document.createElement("button");

    stocktakingButton.type =
      "button";
    stocktakingButton.className =
      "mobile-home-primary-button mobile-home-stocktaking-button";
    stocktakingButton.textContent =
      "棚卸を開始する";

    stocktakingButton.addEventListener(
      "click",
      function () {
        triggerMobileHomeAction(
          "show-stocktaking-button"
        );
      }
    );

    primaryActions.appendChild(
      listButton
    );

    primaryActions.appendChild(
      stocktakingButton
    );

    quickSection.appendChild(
      primaryActions
    );
  }

  if (
    !functionGrid ||
    homeScreen.querySelector(
      ".mobile-home-more-control"
    )
  ) {
    return;
  }

  const control =
    document.createElement("div");

  control.className =
    "mobile-home-more-control";

  const button =
    document.createElement("button");

  button.type = "button";
  button.className =
    "mobile-home-more-button";
  button.textContent =
    "その他の機能を表示";

  const note =
    document.createElement("p");

  note.className =
    "mobile-home-more-note";
  note.textContent =
    "入出庫履歴、販売・発注、バックアップなどを使う場合はこちら。";

  button.addEventListener(
    "click",
    function () {
      homeDashboardMobileExtrasOpen =
        !homeDashboardMobileExtrasOpen;

      applyMobileExtrasState(
        homeScreen
      );
    }
  );

  control.appendChild(button);
  control.appendChild(note);

  functionGrid.parentElement.insertBefore(
    control,
    functionGrid
  );
}

function triggerMobileHomeAction(
  actionId
) {
  const target =
    document.querySelector(
      `#${actionId}`
    );

  if (
    target &&
    typeof target.click ===
      "function"
  ) {
    target.click();
    return;
  }

  window.setTimeout(
    function () {
      const retryTarget =
        document.querySelector(
          `#${actionId}`
        );

      if (
        retryTarget &&
        typeof retryTarget.click ===
          "function"
      ) {
        retryTarget.click();
        return;
      }

      window.alert(
        "画面の準備が完了していません。ページを更新して、もう一度お試しください。"
      );
    },
    150
  );
}

function isResolvedMobileHomeMode() {
  const resolvedMode =
    document.body.dataset
      .resolvedDisplayMode;

  if (resolvedMode === "mobile") {
    return true;
  }

  if (resolvedMode === "pc") {
    return false;
  }

  return !window.matchMedia(
    "(min-width: 901px)"
  ).matches;
}

function initializeMobileHomeLayout(
  homeScreen
) {
  const applyMode =
    function () {
      const isMobile =
        isResolvedMobileHomeMode();

      homeScreen.classList.toggle(
        "mobile-primary-mode",
        isMobile
      );

      const quickTitle =
        homeScreen.querySelector(
          "#home-quick-title"
        );

      const quickDescription =
        quickTitle
          ? quickTitle
              .closest(
                ".home-section-heading"
              )
              ?.querySelector("p")
          : null;

      if (quickTitle) {
        quickTitle.textContent =
          isMobile
            ? "スマホ用かんたん操作"
            : "よく使う操作";
      }

      if (quickDescription) {
        quickDescription.textContent =
          isMobile
            ? "商品一覧と棚卸を大きなボタンからすぐ開けます。"
            : "日常作業はこちらから始めます。";
      }

      if (isMobile) {
        homeDashboardMobileExtrasOpen =
          false;

        homeScreen
          .querySelectorAll(
            ".home-function-panel"
          )
          .forEach(
            function (panel) {
              panel.open = false;
            }
          );
      } else {
        homeDashboardMobileExtrasOpen =
          true;
      }

      applyMobileExtrasState(
        homeScreen
      );
    };

  applyMode();

  window.addEventListener(
    "inventory-display-mode-change",
    function () {
      applyMode();
    }
  );
}

function applyMobileExtrasState(
  homeScreen
) {
  const isMobile =
    isResolvedMobileHomeMode();

  const open =
    !isMobile ||
    homeDashboardMobileExtrasOpen;

  homeScreen.classList.toggle(
    "mobile-extra-open",
    open
  );

  const button =
    homeScreen.querySelector(
      ".mobile-home-more-button"
    );

  if (button) {
    button.textContent =
      homeDashboardMobileExtrasOpen
        ? "その他の機能を閉じる"
        : "その他の機能を表示";

    button.setAttribute(
      "aria-expanded",
      homeDashboardMobileExtrasOpen
        ? "true"
        : "false"
    );
  }
}

function watchHomeDashboardVisibility(
  homeScreen
) {
  if (
    homeDashboardVisibilityObserver
  ) {
    homeDashboardVisibilityObserver.disconnect();
  }

  homeDashboardVisibilityObserver =
    new MutationObserver(
      function (mutations) {
        const becameVisible =
          mutations.some(
            function (mutation) {
              return (
                mutation.type ===
                  "attributes" &&
                mutation.attributeName ===
                  "hidden" &&
                !homeScreen.hidden
              );
            }
          );

        if (
          !becameVisible ||
          !isResolvedMobileHomeMode()
        ) {
          return;
        }

        homeDashboardMobileExtrasOpen =
          false;

        homeScreen
          .querySelectorAll(
            ".home-function-panel"
          )
          .forEach(
            function (panel) {
              panel.open = false;
            }
          );

        applyMobileExtrasState(
          homeScreen
        );
      }
    );

  homeDashboardVisibilityObserver.observe(
    homeScreen,
    {
      attributes: true,
      attributeFilter: ["hidden"]
    }
  );
}

function initializeHomeDashboardPanels() {
  const desktopMedia =
    window.matchMedia(
      "(min-width: 901px)"
    );

  const applyMode = function () {
    const resolvedMode =
      document.body.dataset
        .resolvedDisplayMode;

    const isDesktop =
      resolvedMode === "pc"
        ? true
        : resolvedMode === "mobile"
          ? false
          : desktopMedia.matches;

    if (
      homeDashboardDesktopMode ===
      isDesktop
    ) {
      return;
    }

    homeDashboardDesktopMode =
      isDesktop;

    const panels =
      document.querySelectorAll(
        "#home .home-function-panel"
      );

    panels.forEach(
      function (panel) {
        panel.open = isDesktop;
      }
    );
  };

  applyMode();

  window.addEventListener(
    "inventory-display-mode-change",
    function () {
      homeDashboardDesktopMode = null;
      applyMode();
    }
  );

  window.addEventListener(
    "inventory-role-mode-change",
    function () {
      updateHomeDashboardEmptyPanels();
    }
  );

  if (
    typeof desktopMedia.addEventListener ===
    "function"
  ) {
    desktopMedia.addEventListener(
      "change",
      applyMode
    );
  } else if (
    typeof desktopMedia.addListener ===
    "function"
  ) {
    desktopMedia.addListener(
      applyMode
    );
  }
}

function createHomeDashboardStyle() {
  const oldStyle =
    document.querySelector(
      "#home-dashboard-style"
    );

  if (oldStyle) {
    oldStyle.remove();
  }

  const style =
    document.createElement("style");

  style.id =
    "home-dashboard-style";

  style.textContent = `
    #home.home-dashboard {
      display: grid;
      gap: 18px;
      margin-bottom: 25px;
      padding: 0;
      background: transparent;
      border-radius: 0;
      box-shadow: none;
    }

    #home.home-dashboard[hidden] {
      display: none !important;
    }

    #home .home-dashboard-heading,
    #home .home-quick-section,
    #home .home-function-panel,
    #home .home-storage-note {
      background-color: #ffffff;
      border: 1px solid #d9e2ec;
      box-shadow: 0 4px 14px rgba(31, 54, 77, 0.08);
    }

    #home .home-dashboard-heading {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 20px;
      padding: 24px;
      border-radius: 14px;
    }

    #home .home-dashboard-kicker {
      display: block;
      margin-bottom: 4px;
      color: #546e7a;
      font-size: 14px;
      font-weight: 700;
      letter-spacing: 0.08em;
    }

    #home .home-dashboard-heading h2 {
      margin: 0;
      padding: 0;
      border: 0;
      color: #123b63;
      font-size: 30px;
      line-height: 1.25;
    }

    #home .home-dashboard-subtitle,
    #home .home-section-heading p,
    #home .home-panel-description,
    #home .home-storage-note {
      display: block;
      min-width: 0;
      margin: 0;
      padding: 0;
      background: transparent;
      border-radius: 0;
      color: #546e7a;
      font-size: 15px;
      font-weight: 500;
    }

    #home .home-dashboard-subtitle {
      margin-top: 8px;
    }

    #home .home-version-badge {
      flex: 0 0 auto;
      padding: 7px 11px;
      border: 1px solid #90caf9;
      border-radius: 999px;
      background-color: #e3f2fd;
      color: #0d47a1;
      font-size: 13px;
      font-weight: 800;
      white-space: nowrap;
    }

    #home .home-summary-grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 12px;
    }

    #home .home-summary-card {
      display: flex;
      min-width: 0;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      min-height: 94px;
      padding: 18px;
      border: 1px solid #d9e2ec;
      border-radius: 14px;
      background-color: #ffffff;
      box-shadow: 0 4px 14px rgba(31, 54, 77, 0.08);
    }

    #home .home-summary-label {
      color: #455a64;
      font-size: 15px;
      font-weight: 800;
    }

    #home .home-summary-card strong {
      color: #123b63;
      font-size: 32px;
      line-height: 1;
      white-space: nowrap;
    }

    #home .home-summary-card strong small {
      margin-left: 2px;
      font-size: 14px;
    }

    #home .home-summary-products {
      border-top: 5px solid #1565c0;
    }

    #home .home-summary-stock {
      border-top: 5px solid #2e7d32;
    }

    #home #out-of-stock-summary.home-summary-card {
      min-width: 0;
      margin: 0;
      padding: 18px;
      border-top: 5px solid #c62828;
      background-color: #fff8f8;
      color: inherit;
      font-size: inherit;
    }

    #home #low-stock-summary.home-summary-card {
      min-width: 0;
      margin: 0;
      padding: 18px;
      border-top: 5px solid #ef6c00;
      background-color: #fffaf3;
      color: inherit;
      font-size: inherit;
    }

    #home .home-quick-section {
      padding: 22px;
      border-radius: 14px;
    }

    #home .home-section-heading {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 14px;
      margin-bottom: 15px;
    }

    #home .home-section-heading h3 {
      margin: 0 0 2px;
      color: #123b63;
      font-size: 20px;
    }

    #home .home-action-grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 12px;
    }

    #home .home-function-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 14px;
      align-items: start;
    }

    #home .home-function-panel {
      margin: 0;
      padding: 0;
      overflow: hidden;
      border-radius: 14px;
    }

    #home .home-function-panel > summary {
      position: relative;
      padding: 17px 50px 17px 19px;
      color: #123b63;
      font-size: 18px;
      font-weight: 800;
      cursor: pointer;
      list-style: none;
      user-select: none;
    }

    #home .home-function-panel > summary::-webkit-details-marker {
      display: none;
    }

    #home .home-function-panel > summary::after {
      content: "＋";
      position: absolute;
      top: 50%;
      right: 18px;
      width: 26px;
      height: 26px;
      transform: translateY(-50%);
      border-radius: 50%;
      background-color: #e3f2fd;
      color: #1565c0;
      text-align: center;
      font-size: 20px;
      line-height: 25px;
    }

    #home .home-function-panel[open] > summary {
      border-bottom: 1px solid #e3eaf0;
    }

    #home .home-function-panel[open] > summary::after {
      content: "−";
    }

    #home .home-panel-description {
      padding: 14px 18px 0;
    }

    #home .home-panel-buttons {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 9px;
      padding: 14px 18px 18px;
    }

    #home button.home-dashboard-action {
      width: 100%;
      min-width: 0;
      min-height: 54px;
      margin: 0;
      padding: 12px 14px;
      border: 1px solid transparent;
      border-radius: 10px;
      box-shadow: none;
      font-size: 15px;
      line-height: 1.35;
    }

    #home .home-action-grid button.home-dashboard-action {
      min-height: 72px;
      padding: 15px;
      font-size: 17px;
    }

    #home button.home-action-camera {
      background-color: #1565c0 !important;
    }

    #home button.home-action-list {
      background-color: #00796b !important;
    }

    #home button.home-action-stocktaking {
      background-color: #6a1b9a !important;
    }

    #home button.home-action-register {
      background-color: #2e7d32 !important;
    }

    #home button.home-action-search,
    #home button.home-action-history,
    #home button.home-action-stocktaking-history {
      background-color: #455a64 !important;
    }

    #home button.home-action-aggregation {
      background-color: #6a1b9a !important;
    }

    #home button.home-action-export {
      background-color: #1565c0 !important;
    }

    #home button.home-action-import {
      background-color: #2e7d32 !important;
    }

    #home button.home-action-backup {
      background-color: #5d4037 !important;
    }

    #home button.home-action-restore {
      background-color: #ef6c00 !important;
    }

    #home button.home-action-install {
      background-color: #37474f !important;
    }

    #home button.home-dashboard-action:focus-visible,
    #home .home-function-panel > summary:focus-visible {
      outline: 4px solid #90caf9;
      outline-offset: 2px;
    }

    #home .home-storage-note {
      padding: 13px 16px;
      border-radius: 12px;
      text-align: center;
    }

    #home .mobile-home-primary-actions,
    #home .mobile-home-more-control {
      display: none;
    }

    body[data-resolved-display-mode="mobile"]
      #home.mobile-primary-mode
      .home-dashboard-heading {
      order: 0;
    }

    body[data-resolved-display-mode="mobile"]
      #home.mobile-primary-mode
      .home-quick-section {
      order: 1;
      border: 2px solid #90caf9;
      background:
        linear-gradient(
          180deg,
          #ffffff 0%,
          #f4f9ff 100%
        );
    }

    body[data-resolved-display-mode="mobile"]
      #home.mobile-primary-mode
      .home-summary-grid {
      order: 2;
    }

    body[data-resolved-display-mode="mobile"]
      #home.mobile-primary-mode
      .mobile-home-more-control {
      display: grid;
      order: 3;
      gap: 8px;
      padding: 14px;
      border: 1px solid #d9e2ec;
      border-radius: 14px;
      background: #ffffff;
      box-shadow:
        0 4px 14px
        rgba(31, 54, 77, 0.08);
    }

    body[data-resolved-display-mode="mobile"]
      #home.mobile-primary-mode
      .mobile-home-more-button {
      width: 100%;
      min-height: 54px;
      margin: 0;
      border-radius: 12px;
      background: #546e7a;
      font-size: 16px;
      font-weight: 800;
    }

    body[data-resolved-display-mode="mobile"]
      #home.mobile-primary-mode
      .mobile-home-more-note {
      margin: 0;
      color: #607d8b;
      font-size: 13px;
      line-height: 1.55;
      text-align: center;
    }

    body[data-resolved-display-mode="mobile"]
      #home.mobile-primary-mode
      .home-function-grid {
      display: none !important;
      order: 4;
    }

    body[data-resolved-display-mode="mobile"]
      #home.mobile-primary-mode.mobile-extra-open
      .home-function-grid {
      display: grid !important;
    }

    body[data-resolved-display-mode="mobile"]
      #home.mobile-primary-mode
      .home-storage-note {
      order: 5;
    }

    body[data-resolved-display-mode="mobile"]
      #home.mobile-primary-mode
      #home-quick-action-buttons {
      display: none !important;
    }

    body[data-resolved-display-mode="mobile"]
      #home.mobile-primary-mode
      .mobile-home-primary-actions {
      display: grid;
      grid-template-columns:
        repeat(2, minmax(0, 1fr));
      gap: 14px;
      margin-top: 18px;
    }

    body[data-resolved-display-mode="mobile"]
      #home.mobile-primary-mode
      .mobile-home-primary-button {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 92px;
      margin: 0;
      padding: 18px 16px;
      border-radius: 16px;
      font-size: 21px;
      font-weight: 900;
      line-height: 1.35;
      box-shadow:
        0 5px 12px
        rgba(31, 54, 77, 0.14);
    }

    body[data-resolved-display-mode="mobile"]
      #home.mobile-primary-mode
      .mobile-home-list-button {
      background: #00796b;
    }

    body[data-resolved-display-mode="mobile"]
      #home.mobile-primary-mode
      .mobile-home-stocktaking-button {
      background: #6a1b9a;
    }

    body[data-resolved-display-mode="mobile"]
      #home.mobile-primary-mode
      .home-section-heading h3 {
      font-size: 22px;
    }

    body[data-resolved-display-mode="mobile"]
      #home.mobile-primary-mode
      .home-section-heading p {
      font-size: 15px;
      line-height: 1.6;
    }

    @media (max-width: 1000px) {
      #home .home-summary-grid,
      #home .home-action-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }

    #home .home-action-sales-list {
      background-color: #00695c;
    }

    #home .home-action-sales-import {
      background-color: #2e7d32 !important;
    }

    #home .home-action-purchase-required {
      background-color: #ef6c00 !important;
    }

    #home .home-action-shipping-wish {
      background-color: #5e35b1 !important;
    }

    #home .home-action-shipping-wish-list {
      background-color: #3949ab !important;
    }

    @media (max-width: 900px) {
      #home .home-function-grid {
        grid-template-columns: 1fr;
      }
    }

    @media (max-width: 700px) {
      header {
        padding: 14px 10px;
      }

      header h1 {
        font-size: 20px;
        line-height: 1.35;
      }

      main {
        padding: 12px 10px 30px;
      }

      #home.home-dashboard {
        gap: 12px;
      }

      #home .home-dashboard-heading {
        display: grid;
        gap: 12px;
        padding: 18px;
      }

      #home .home-dashboard-heading h2 {
        font-size: 26px;
      }

      #home .home-dashboard-subtitle {
        font-size: 14px;
      }

      #home .home-version-badge {
        justify-self: start;
      }

      #home .home-summary-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 8px;
      }

      #home .home-summary-card,
      #home #out-of-stock-summary.home-summary-card,
      #home #low-stock-summary.home-summary-card {
        display: grid;
        gap: 8px;
        min-height: 95px;
        padding: 13px;
      }

      #home .home-summary-label {
        font-size: 14px;
      }

      #home .home-summary-card strong {
        font-size: 30px;
      }

      #home .home-quick-section {
        padding: 17px;
      }

      body[data-resolved-display-mode="mobile"]
        #home.mobile-primary-mode
        .home-quick-section {
        padding: 16px;
      }

      body[data-resolved-display-mode="mobile"]
        #home.mobile-primary-mode
        .mobile-home-primary-actions {
        grid-template-columns: 1fr;
        gap: 12px;
      }

      body[data-resolved-display-mode="mobile"]
        #home.mobile-primary-mode
        .mobile-home-primary-button {
        min-height: 88px;
        font-size: 21px;
      }

      #home .home-section-heading {
        margin-bottom: 12px;
      }

      #home .home-section-heading h3 {
        font-size: 19px;
      }

      #home .home-section-heading p {
        font-size: 14px;
      }

      #home .home-action-grid {
        grid-template-columns: 1fr;
        gap: 9px;
      }

      #home .home-action-grid button.home-dashboard-action {
        min-height: 60px;
        font-size: 17px;
      }

      #home .home-function-panel > summary {
        min-height: 58px;
        padding: 16px 50px 16px 17px;
        font-size: 17px;
      }

      #home .home-panel-description {
        display: none;
      }

      #home .home-panel-buttons {
        grid-template-columns: 1fr;
        padding: 12px 14px 15px;
      }

      #home button.home-dashboard-action {
        min-height: 54px;
        font-size: 16px;
      }

      #home .home-storage-note {
        font-size: 13px;
        text-align: left;
      }
    }

    @media (max-width: 370px) {
      #home .home-summary-card strong {
        font-size: 26px;
      }

      #home .home-summary-label {
        font-size: 13px;
      }
    }
  `;

  document.head.appendChild(style);
}
