"use strict";

document.addEventListener(
  "DOMContentLoaded",
  initializePwa
);

function initializePwa() {
  registerServiceWorker();
  showNetworkStatus();
}

async function registerServiceWorker() {
  if (
    !("serviceWorker" in navigator)
  ) {
    console.log(
      "このブラウザーはService Workerに対応していません。"
    );

    return;
  }

  try {
    const registration =
      await navigator.serviceWorker.register(
        "./service-worker.js"
      );

    console.log(
      "Service Workerを登録しました。",
      registration.scope
    );

    registration.addEventListener(
      "updatefound",
      function () {
        const installingWorker =
          registration.installing;

        if (!installingWorker) {
          return;
        }

        installingWorker.addEventListener(
          "statechange",
          function () {
            if (
              installingWorker.state ===
                "installed" &&
              navigator.serviceWorker.controller
            ) {
              showPwaUpdateNotice();
            }
          }
        );
      }
    );
  } catch (error) {
    console.error(
      "Service Workerを登録できませんでした。",
      error
    );
  }
}

function showNetworkStatus() {
  createNetworkStatusArea();
  updateNetworkStatus();

  window.addEventListener(
    "online",
    updateNetworkStatus
  );

  window.addEventListener(
    "offline",
    updateNetworkStatus
  );
}

function createNetworkStatusArea() {
  if (
    document.querySelector(
      "#network-status"
    )
  ) {
    return;
  }

  const statusArea =
    document.createElement("div");

  statusArea.id =
    "network-status";

  statusArea.setAttribute(
    "role",
    "status"
  );

  statusArea.setAttribute(
    "aria-live",
    "polite"
  );

  document.body.prepend(
    statusArea
  );

  const style =
    document.createElement("style");

  style.id =
    "pwa-status-style";

  style.textContent = `
    #network-status {
      position: sticky;
      top: 0;
      z-index: 9999;
      width: 100%;
      padding: 8px 12px;
      text-align: center;
      font-weight: bold;
      box-sizing: border-box;
    }

    #network-status.online {
      display: none;
    }

    #network-status.offline {
      display: block;
      background-color: #ef6c00;
      color: #ffffff;
    }

    .pwa-update-notice {
      position: fixed;
      right: 12px;
      bottom: 12px;
      left: 12px;
      z-index: 10000;
      max-width: 520px;
      margin: 0 auto;
      padding: 14px;
      border-radius: 10px;
      background-color: #1565c0;
      color: #ffffff;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
      text-align: center;
      font-weight: bold;
    }

    .pwa-update-notice button {
      margin-top: 10px;
      background-color: #ffffff;
      color: #1565c0;
    }
  `;

  document.head.appendChild(
    style
  );
}

function updateNetworkStatus() {
  const statusArea =
    document.querySelector(
      "#network-status"
    );

  if (!statusArea) {
    return;
  }

  if (navigator.onLine) {
    statusArea.className =
      "online";

    statusArea.textContent =
      "オンライン";
  } else {
    statusArea.className =
      "offline";

    statusArea.textContent =
      "オフラインで使用しています";
  }
}

function showPwaUpdateNotice() {
  if (
    document.querySelector(
      ".pwa-update-notice"
    )
  ) {
    return;
  }

  const notice =
    document.createElement("div");

  notice.className =
    "pwa-update-notice";

  notice.innerHTML = `
    <div>
      アプリの新しいバージョンがあります。
    </div>

    <button
      type="button"
      id="reload-pwa-button"
    >
      更新して開き直す
    </button>
  `;

  document.body.appendChild(
    notice
  );

  document
    .querySelector(
      "#reload-pwa-button"
    )
    .addEventListener(
      "click",
      function () {
        window.location.reload();
      }
    );
}