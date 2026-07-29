"use strict";

let deferredInstallPrompt = null;

/*
  Android Chromeのインストール通知を取り逃さないように、
  DOMContentLoadedより前から監視します。
*/
window.addEventListener(
  "beforeinstallprompt",
  handleBeforeInstallPrompt
);

window.addEventListener(
  "appinstalled",
  handlePwaInstalled
);

document.addEventListener(
  "DOMContentLoaded",
  initializePwa
);

function handleBeforeInstallPrompt(event) {
  event.preventDefault();

  deferredInstallPrompt =
    event;

  updatePwaInstallButton();
}

function handlePwaInstalled() {
  deferredInstallPrompt =
    null;

  updatePwaInstallButton();

  alert(
    "アプリをインストールしました。ホーム画面から起動できます。"
  );
}

function initializePwa() {
  registerServiceWorker();
  showNetworkStatus();
  createPwaInstallButton();
  createPwaInstallDialog();
  watchPwaDisplayMode();
  updatePwaInstallButton();
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

  createPwaStyle();
}

function createPwaStyle() {
  if (
    document.querySelector(
      "#pwa-status-style"
    )
  ) {
    return;
  }

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

    #pwa-install-button {
      background-color: #6a1b9a;
    }

    #pwa-install-button[hidden] {
      display: none;
    }

    .pwa-install-dialog {
      position: fixed;
      inset: 0;
      z-index: 12000;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
      background-color: rgba(0, 0, 0, 0.55);
      box-sizing: border-box;
    }

    .pwa-install-dialog[hidden] {
      display: none;
    }

    .pwa-install-dialog-content {
      width: min(100%, 520px);
      max-height: 90vh;
      overflow-y: auto;
      padding: 22px;
      border-radius: 14px;
      background-color: #ffffff;
      color: #263238;
      box-sizing: border-box;
    }

    .pwa-install-dialog-content h2 {
      margin-top: 0;
    }

    .pwa-install-dialog-content ol {
      padding-left: 24px;
      line-height: 1.8;
    }

    .pwa-install-dialog-content button {
      width: 100%;
      margin-top: 12px;
      background-color: #546e7a;
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

function createPwaInstallButton() {
  if (
    document.querySelector(
      "#pwa-install-button"
    )
  ) {
    return;
  }

  const homeScreen =
    findPwaHomeScreen();

  if (!homeScreen) {
    console.error(
      "インストールボタンを追加するホーム画面が見つかりません。"
    );

    return;
  }

  const button =
    document.createElement("button");

  button.id =
    "pwa-install-button";

  button.type =
    "button";

  button.textContent =
    "アプリの追加方法を確認する";

  button.addEventListener(
    "click",
    handlePwaInstallButton
  );

  homeScreen.appendChild(
    button
  );
}

function findPwaHomeScreen() {
  const knownSelectors = [
    "#home-screen",
    "#home",
    '[data-screen="home"]'
  ];

  for (
    const selector of knownSelectors
  ) {
    const screen =
      document.querySelector(
        selector
      );

    if (screen) {
      return screen;
    }
  }

  const sections =
    Array.from(
      document.querySelectorAll(
        "main > section"
      )
    );

  const homeSection =
    sections.find(
      function (section) {
        const text =
          section.textContent || "";

        return (
          text.includes(
            "登録商品数"
          ) ||
          text.includes(
            "総在庫数"
          )
        );
      }
    );

  return (
    homeSection ||
    sections[0] ||
    document.querySelector("main")
  );
}

function createPwaInstallDialog() {
  if (
    document.querySelector(
      "#pwa-install-dialog"
    )
  ) {
    return;
  }

  const dialog =
    document.createElement("div");

  dialog.id =
    "pwa-install-dialog";

  dialog.className =
    "pwa-install-dialog";

  dialog.hidden =
    true;

  dialog.setAttribute(
    "role",
    "dialog"
  );

  dialog.setAttribute(
    "aria-modal",
    "true"
  );

  dialog.setAttribute(
    "aria-labelledby",
    "pwa-install-dialog-title"
  );

  dialog.innerHTML = `
    <div class="pwa-install-dialog-content">
      <h2 id="pwa-install-dialog-title">
        ホーム画面へ追加する
      </h2>

      <div id="pwa-install-dialog-body"></div>

      <button
        id="close-pwa-install-dialog"
        type="button"
      >
        閉じる
      </button>
    </div>
  `;

  document.body.appendChild(
    dialog
  );

  document
    .querySelector(
      "#close-pwa-install-dialog"
    )
    .addEventListener(
      "click",
      closePwaInstallDialog
    );

  dialog.addEventListener(
    "click",
    function (event) {
      if (
        event.target === dialog
      ) {
        closePwaInstallDialog();
      }
    }
  );
}

function watchPwaDisplayMode() {
  const displayModeMedia =
    window.matchMedia(
      "(display-mode: standalone)"
    );

  if (
    typeof displayModeMedia.addEventListener ===
      "function"
  ) {
    displayModeMedia.addEventListener(
      "change",
      updatePwaInstallButton
    );
  } else if (
    typeof displayModeMedia.addListener ===
      "function"
  ) {
    displayModeMedia.addListener(
      updatePwaInstallButton
    );
  }
}

function updatePwaInstallButton() {
  const button =
    document.querySelector(
      "#pwa-install-button"
    );

  if (!button) {
    return;
  }

  if (isPwaInstalled()) {
    button.hidden =
      true;

    return;
  }

  button.hidden =
    false;

  if (
    deferredInstallPrompt
  ) {
    button.textContent =
      "アプリをインストールする";

    return;
  }

  if (
    isIosDevice()
  ) {
    button.textContent =
      "iPhoneのホーム画面に追加する";

    return;
  }

  if (
    isAndroidDevice()
  ) {
    button.textContent =
      "Androidのホーム画面に追加する";

    return;
  }

  button.textContent =
    "アプリの追加方法を確認する";
}

async function handlePwaInstallButton() {
  if (isPwaInstalled()) {
    alert(
      "このアプリはすでにインストールされています。"
    );

    return;
  }

  if (
    deferredInstallPrompt
  ) {
    try {
      deferredInstallPrompt.prompt();

      const choice =
        await deferredInstallPrompt.userChoice;

      if (
        choice.outcome ===
        "accepted"
      ) {
        console.log(
          "アプリのインストールが選択されました。"
        );
      } else {
        console.log(
          "アプリのインストールがキャンセルされました。"
        );
      }
    } catch (error) {
      console.error(
        "インストール画面を開けませんでした。",
        error
      );
    } finally {
      deferredInstallPrompt =
        null;

      updatePwaInstallButton();
    }

    return;
  }

  showPwaInstallInstructions();
}

function showPwaInstallInstructions() {
  const dialog =
    document.querySelector(
      "#pwa-install-dialog"
    );

  const body =
    document.querySelector(
      "#pwa-install-dialog-body"
    );

  if (
    !dialog ||
    !body
  ) {
    return;
  }

  if (isIosDevice()) {
    body.innerHTML = `
      <p>
        Safariで次の操作を行ってください。
      </p>

      <ol>
        <li>
          画面下の共有ボタンを押します。
        </li>
        <li>
          「ホーム画面に追加」を押します。
        </li>
        <li>
          右上の「追加」を押します。
        </li>
      </ol>
    `;
  } else if (
    isAndroidDevice()
  ) {
    body.innerHTML = `
      <p>
        Android版Chromeで次の操作を行ってください。
      </p>

      <ol>
        <li>
          画面右上の「︙」を押します。
        </li>
        <li>
          「アプリをインストール」または
          「ホーム画面に追加」を押します。
        </li>
        <li>
          表示された確認画面で
          「インストール」または「追加」を押します。
        </li>
      </ol>

      <p>
        項目が出ない場合は、このページを30秒以上開き、
        画面を一度タップしてから更新してください。
      </p>
    `;
  } else {
    body.innerHTML = `
      <p>
        ChromeまたはEdgeのメニューから追加できます。
      </p>

      <ol>
        <li>
          ブラウザーのメニューを開きます。
        </li>
        <li>
          「アプリをインストール」を選びます。
        </li>
        <li>
          表示された確認画面で追加します。
        </li>
      </ol>
    `;
  }

  dialog.hidden =
    false;
}

function closePwaInstallDialog() {
  const dialog =
    document.querySelector(
      "#pwa-install-dialog"
    );

  if (dialog) {
    dialog.hidden =
      true;
  }
}

function isPwaInstalled() {
  const standaloneDisplay =
    window.matchMedia(
      "(display-mode: standalone)"
    ).matches;

  const iosStandalone =
    window.navigator.standalone ===
    true;

  return (
    standaloneDisplay ||
    iosStandalone
  );
}

function isAndroidDevice() {
  return /android/i.test(
    window.navigator.userAgent
  );
}

function isIosDevice() {
  const userAgent =
    window.navigator.userAgent
      .toLowerCase();

  const isAppleMobile =
    /iphone|ipad|ipod/.test(
      userAgent
    );

  const isIpadDesktopMode =
    navigator.platform ===
      "MacIntel" &&
    navigator.maxTouchPoints > 1;

  return (
    isAppleMobile ||
    isIpadDesktopMode
  );
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