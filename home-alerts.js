"use strict";

/* =========================================================
   v140 PCホーム右側 要確認パネル
   ・発注必要商品
   ・次の未確定船便で船積みが必要な商品
   ・PC表示のみ
   ========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  initializeHomeAlertPanel
);

function initializeHomeAlertPanel() {
  createHomeAlertPanelStyle();
  createHomeAlertPanel();

  const home =
    document.querySelector(
      "#home"
    );

  if (home) {
    const observer =
      new MutationObserver(
        function () {
          updateHomeAlertPanelVisibility();

          if (!home.hidden) {
            void refreshHomeAlertPanel();
          }
        }
      );

    observer.observe(
      home,
      {
        attributes: true,
        attributeFilter: [
          "hidden",
          "class"
        ]
      }
    );
  }

  window.addEventListener(
    "inventory-display-mode-change",
    function () {
      updateHomeAlertPanelVisibility();
    }
  );

  window.addEventListener(
    "resize",
    updateHomeAlertPanelVisibility
  );

  window.addEventListener(
    "focus",
    function () {
      if (isHomeAlertPanelUsable()) {
        void refreshHomeAlertPanel();
      }
    }
  );

  updateHomeAlertPanelVisibility();

  window.setTimeout(
    function () {
      void refreshHomeAlertPanel();
    },
    700
  );
}

function createHomeAlertPanel() {
  if (
    document.querySelector(
      "#home-alert-panel"
    )
  ) {
    return;
  }

  const panel =
    document.createElement("aside");

  panel.id =
    "home-alert-panel";

  panel.className =
    "home-alert-panel";

  panel.setAttribute(
    "aria-label",
    "要確認"
  );

  panel.innerHTML = `
    <div class="home-alert-panel-header">
      <div>
        <span class="home-alert-panel-kicker">
          PC用
        </span>
        <h2>⚠ 要確認</h2>
      </div>

      <button
        id="home-alert-refresh-button"
        type="button"
        class="home-alert-refresh-button"
        title="最新データで再確認"
      >
        更新
      </button>
    </div>

    <div
      id="home-alert-loading"
      class="home-alert-loading"
    >
      最新データを確認しています…
    </div>

    <div
      id="home-alert-purchase"
      class="home-alert-card home-alert-purchase"
    ></div>

    <div
      id="home-alert-shipping"
      class="home-alert-card home-alert-shipping"
    ></div>

    <div
      id="home-alert-updated"
      class="home-alert-updated"
    ></div>
  `;

  document.body.appendChild(
    panel
  );

  panel
    .querySelector(
      "#home-alert-refresh-button"
    )
    ?.addEventListener(
      "click",
      function () {
        void refreshHomeAlertPanel();
      }
    );
}

function isHomeAlertPanelUsable() {
  const home =
    document.querySelector(
      "#home"
    );

  if (
    !home ||
    home.hidden
  ) {
    return false;
  }

  if (
    document.body.dataset
      .resolvedDisplayMode !== "pc"
  ) {
    return false;
  }

  return window.matchMedia(
    "(min-width: 1500px)"
  ).matches;
}

function updateHomeAlertPanelVisibility() {
  const panel =
    document.querySelector(
      "#home-alert-panel"
    );

  if (!panel) {
    return;
  }

  panel.hidden =
    !isHomeAlertPanelUsable();
}

async function refreshHomeAlertPanel() {
  const panel =
    document.querySelector(
      "#home-alert-panel"
    );

  if (!panel) {
    return;
  }

  updateHomeAlertPanelVisibility();

  if (
    panel.hidden
  ) {
    return;
  }

  const loading =
    panel.querySelector(
      "#home-alert-loading"
    );

  const purchaseBox =
    panel.querySelector(
      "#home-alert-purchase"
    );

  const shippingBox =
    panel.querySelector(
      "#home-alert-shipping"
    );

  const updated =
    panel.querySelector(
      "#home-alert-updated"
    );

  if (loading) {
    loading.hidden = false;
    loading.textContent =
      "最新データを確認しています…";
  }

  if (purchaseBox) {
    purchaseBox.innerHTML =
      createHomeAlertSkeleton(
        "発注が必要",
        "🛒"
      );
  }

  if (shippingBox) {
    shippingBox.innerHTML =
      createHomeAlertSkeleton(
        "船積みが必要",
        "🚢"
      );
  }

  const results =
    await Promise.allSettled([
      getHomePurchaseAlertData(),
      getHomeShippingAlertData()
    ]);

  if (loading) {
    loading.hidden = true;
  }

  const purchaseResult =
    results[0];

  const shippingResult =
    results[1];

  if (purchaseBox) {
    if (
      purchaseResult.status ===
      "fulfilled"
    ) {
      renderHomePurchaseAlert(
        purchaseBox,
        purchaseResult.value
      );
    } else {
      renderHomeAlertError(
        purchaseBox,
        "発注が必要",
        "🛒"
      );
    }
  }

  if (shippingBox) {
    if (
      shippingResult.status ===
      "fulfilled"
    ) {
      renderHomeShippingAlert(
        shippingBox,
        shippingResult.value
      );
    } else {
      renderHomeAlertError(
        shippingBox,
        "船積みが必要",
        "🚢"
      );
    }
  }

  if (updated) {
    updated.textContent =
      "最終確認：" +
      new Date().toLocaleTimeString(
        "ja-JP",
        {
          hour: "2-digit",
          minute: "2-digit"
        }
      );
  }
}

async function getHomePurchaseAlertData() {
  if (
    !window.purchaseRequiredApp ||
    typeof window
      .purchaseRequiredApp
      .getHomeAlertData !==
      "function"
  ) {
    throw new Error(
      "発注判定機能を読み込めません。"
    );
  }

  return window
    .purchaseRequiredApp
    .getHomeAlertData();
}

async function getHomeShippingAlertData() {
  if (
    !window.shippingScheduleApp ||
    typeof window
      .shippingScheduleApp
      .getHomeAlertData !==
      "function"
  ) {
    throw new Error(
      "船便判定機能を読み込めません。"
    );
  }

  return window
    .shippingScheduleApp
    .getHomeAlertData();
}

function createHomeAlertSkeleton(
  title,
  icon
) {
  return `
    <div class="home-alert-card-title">
      <span>${icon}</span>
      <strong>${title}</strong>
    </div>
    <p class="home-alert-card-message">
      確認中…
    </p>
  `;
}

function renderHomePurchaseAlert(
  box,
  data
) {
  const count =
    Number(
      data &&
        data.count ||
        0
    );

  const total =
    Number(
      data &&
        data.totalShortage ||
        0
    );

  const rows =
    Array.isArray(
      data &&
        data.rows
    )
      ? data.rows
      : [];

  box.className =
    "home-alert-card home-alert-purchase";

  if (count <= 0) {
    box.classList.add(
      "home-alert-card-ok"
    );

    box.innerHTML = `
      <div class="home-alert-card-title">
        <span>🛒</span>
        <strong>発注が必要</strong>
      </div>

      <div class="home-alert-zero">
        <strong>0商品</strong>
        <span>現在、追加発注が必要な商品はありません。</span>
      </div>

      <button
        type="button"
        class="home-alert-open-button"
        data-home-alert-action="purchase"
      >
        発注必要一覧を見る
      </button>
    `;

    bindHomeAlertButtons(
      box
    );

    return;
  }

  const topRows =
    rows.slice(0, 5);

  box.innerHTML = `
    <div class="home-alert-card-title">
      <span>🛒</span>
      <strong>発注が必要</strong>
    </div>

    <div class="home-alert-count-row">
      <strong>${count.toLocaleString("ja-JP")}商品</strong>
      <span>
        不足合計
        ${total.toLocaleString("ja-JP")}個
      </span>
    </div>

    <div class="home-alert-item-list">
      ${topRows.map(
        function (row) {
          return `
            <div class="home-alert-item">
              <div>
                <strong>
                  ${escapeHomeAlertHtml(
                    row.productCode ||
                    row.internalCode ||
                    "コード未登録"
                  )}
                </strong>
                <span>
                  ${escapeHomeAlertHtml(
                    row.productName ||
                    "商品名未登録"
                  )}
                </span>
              </div>

              <b>
                不足
                ${Number(
                  row.shortage || 0
                ).toLocaleString("ja-JP")}個
              </b>
            </div>
          `;
        }
      ).join("")}
    </div>

    ${
      count > topRows.length
        ? `
          <p class="home-alert-more">
            ほか
            ${(count - topRows.length)
              .toLocaleString("ja-JP")}
            商品
          </p>
        `
        : ""
    }

    <button
      type="button"
      class="home-alert-open-button"
      data-home-alert-action="purchase"
    >
      発注必要一覧を見る
    </button>
  `;

  bindHomeAlertButtons(
    box
  );
}

function renderHomeShippingAlert(
  box,
  data
) {
  const hasSchedule =
    Boolean(
      data &&
        data.hasSchedule
    );

  const schedule =
    data &&
    data.schedule
      ? data.schedule
      : null;

  const count =
    Number(
      data &&
        data.count ||
        0
    );

  const total =
    Number(
      data &&
        data.totalRemaining ||
        0
    );

  const rows =
    Array.isArray(
      data &&
        data.rows
    )
      ? data.rows
      : [];

  box.className =
    "home-alert-card home-alert-shipping";

  if (!hasSchedule) {
    box.classList.add(
      "home-alert-card-neutral"
    );

    box.innerHTML = `
      <div class="home-alert-card-title">
        <span>🚢</span>
        <strong>船積みが必要</strong>
      </div>

      <div class="home-alert-zero">
        <strong>未確定船便なし</strong>
        <span>
          確認対象になる次の船便がありません。
        </span>
      </div>

      <button
        type="button"
        class="home-alert-open-button home-alert-open-shipping"
        data-home-alert-action="shipping"
      >
        船便振り分けを見る
      </button>
    `;

    bindHomeAlertButtons(
      box
    );

    return;
  }

  const scheduleName =
    schedule.name ||
    "船便名未設定";

  if (count <= 0) {
    box.classList.add(
      "home-alert-card-ok"
    );

    box.innerHTML = `
      <div class="home-alert-card-title">
        <span>🚢</span>
        <strong>船積みが必要</strong>
      </div>

      <p class="home-alert-schedule-name">
        ${escapeHomeAlertHtml(
          scheduleName
        )}
      </p>

      <div class="home-alert-zero">
        <strong>0商品</strong>
        <span>
          この船便で追加の船積入力が必要な商品はありません。
        </span>
      </div>

      <button
        type="button"
        class="home-alert-open-button home-alert-open-shipping"
        data-home-alert-action="shipping"
      >
        船便振り分けを見る
      </button>
    `;

    bindHomeAlertButtons(
      box
    );

    return;
  }

  const topRows =
    rows.slice(0, 5);

  box.innerHTML = `
    <div class="home-alert-card-title">
      <span>🚢</span>
      <strong>船積みが必要</strong>
    </div>

    <p class="home-alert-schedule-name">
      ${escapeHomeAlertHtml(
        scheduleName
      )}
    </p>

    <div class="home-alert-count-row">
      <strong>${count.toLocaleString("ja-JP")}商品</strong>
      <span>
        未入力・不足
        ${total.toLocaleString("ja-JP")}個
      </span>
    </div>

    <div class="home-alert-item-list">
      ${topRows.map(
        function (row) {
          return `
            <div class="home-alert-item">
              <div>
                <strong>
                  ${escapeHomeAlertHtml(
                    row.productCode ||
                    row.internalCode ||
                    "コード未登録"
                  )}
                </strong>
                <span>
                  ${escapeHomeAlertHtml(
                    row.productName ||
                    "商品名未登録"
                  )}
                </span>
              </div>

              <b>
                あと
                ${Number(
                  row.remainingQuantity ||
                  0
                ).toLocaleString("ja-JP")}個
              </b>
            </div>
          `;
        }
      ).join("")}
    </div>

    ${
      count > topRows.length
        ? `
          <p class="home-alert-more">
            ほか
            ${(count - topRows.length)
              .toLocaleString("ja-JP")}
            商品
          </p>
        `
        : ""
    }

    <button
      type="button"
      class="home-alert-open-button home-alert-open-shipping"
      data-home-alert-action="shipping"
    >
      船便振り分けを見る
    </button>
  `;

  bindHomeAlertButtons(
    box
  );
}

function renderHomeAlertError(
  box,
  title,
  icon
) {
  box.className =
    "home-alert-card home-alert-card-error";

  box.innerHTML = `
    <div class="home-alert-card-title">
      <span>${icon}</span>
      <strong>${title}</strong>
    </div>

    <p class="home-alert-card-message">
      データを確認できませんでした。
      「更新」を押してもう一度お試しください。
    </p>
  `;
}

function bindHomeAlertButtons(
  box
) {
  box
    .querySelectorAll(
      "[data-home-alert-action]"
    )
    .forEach(
      function (button) {
        button.addEventListener(
          "click",
          function () {
            const action =
              button.dataset
                .homeAlertAction;

            if (
              action ===
              "purchase"
            ) {
              window
                .purchaseRequiredApp
                ?.open?.();
            }

            if (
              action ===
              "shipping"
            ) {
              window
                .shippingScheduleApp
                ?.openAllocation?.();
            }
          }
        );
      }
    );
}

function escapeHomeAlertHtml(
  value
) {
  return String(
    value == null
      ? ""
      : value
  )
    .replace(
      /&/g,
      "&amp;"
    )
    .replace(
      /</g,
      "&lt;"
    )
    .replace(
      />/g,
      "&gt;"
    )
    .replace(
      /"/g,
      "&quot;"
    )
    .replace(
      /'/g,
      "&#39;"
    );
}

function createHomeAlertPanelStyle() {
  if (
    document.querySelector(
      "#home-alert-panel-style"
    )
  ) {
    return;
  }

  const style =
    document.createElement("style");

  style.id =
    "home-alert-panel-style";

  style.textContent = `
    #home-alert-panel {
      display: none;
    }

    @media (min-width: 1500px) {
      body[data-resolved-display-mode="pc"]
        #home-alert-panel:not([hidden]) {
        position: fixed;
        z-index: 500;
        top: 108px;
        right: 22px;
        display: grid;
        width: min(420px, calc(100vw - 32px));
        min-width: 380px;
        max-height: calc(100vh - 132px);
        box-sizing: border-box;
        gap: 12px;
        overflow-y: auto;
        padding: 15px;
        border: 1px solid #cfd8dc;
        border-radius: 16px;
        background: rgba(255, 255, 255, 0.97);
        box-shadow:
          0 8px 28px rgba(31, 54, 77, 0.15);
        backdrop-filter: blur(8px);
      }
    }

    .home-alert-panel-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      padding-bottom: 10px;
      border-bottom: 2px solid #ffcc80;
    }

    .home-alert-panel-kicker {
      display: block;
      margin-bottom: 2px;
      color: #78909c;
      font-size: 11px;
      font-weight: 800;
    }

    .home-alert-panel-header h2 {
      margin: 0;
      padding: 0;
      border: 0;
      color: #e65100;
      font-size: 22px;
      line-height: 1.25;
    }

    #home-alert-panel
      .home-alert-refresh-button {
      min-height: 36px;
      margin: 0;
      padding: 7px 11px;
      border-radius: 9px;
      background: #546e7a;
      font-size: 13px;
    }

    .home-alert-loading {
      padding: 10px 12px;
      border-radius: 9px;
      background: #eceff1;
      color: #546e7a;
      font-size: 13px;
      font-weight: 700;
    }

    .home-alert-card {
      padding: 13px;
      border: 2px solid #ffb74d;
      border-radius: 13px;
      background: #fffaf3;
    }

    .home-alert-shipping {
      border-color: #b39ddb;
      background: #fbf8ff;
    }

    .home-alert-card-ok {
      border-color: #a5d6a7;
      background: #f5fbf5;
    }

    .home-alert-card-neutral {
      border-color: #b0bec5;
      background: #fafbfc;
    }

    .home-alert-card-error {
      border-color: #ef9a9a;
      background: #fff7f7;
    }

    .home-alert-card-title {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 9px;
      color: #263238;
      font-size: 17px;
    }

    .home-alert-card-title > span {
      font-size: 20px;
      line-height: 1;
    }

    .home-alert-count-row {
      display: grid;
      grid-template-columns: 1fr;
      gap: 3px;
      margin-bottom: 10px;
      padding: 9px 10px;
      border-radius: 9px;
      background: rgba(255,255,255,0.8);
    }

    .home-alert-count-row strong {
      color: #d84315;
      font-size: 25px;
      line-height: 1.15;
    }

    .home-alert-shipping
      .home-alert-count-row strong {
      color: #6a1b9a;
    }

    .home-alert-count-row span {
      color: #546e7a;
      font-size: 13px;
      font-weight: 700;
    }

    .home-alert-schedule-name {
      margin: 0 0 9px;
      color: #5e35b1;
      font-size: 13px;
      font-weight: 800;
      line-height: 1.45;
    }

    .home-alert-item-list {
      display: grid;
      gap: 7px;
    }

    .home-alert-item {
      display: grid;
      grid-template-columns:
        minmax(0, 1fr) auto;
      align-items: center;
      gap: 8px;
      padding: 8px 9px;
      border: 1px solid #eceff1;
      border-radius: 8px;
      background: #ffffff;
    }

    .home-alert-item > div {
      min-width: 0;
    }

    .home-alert-item strong,
    .home-alert-item span {
      display: block;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .home-alert-item strong {
      color: #263238;
      font-size: 13px;
    }

    .home-alert-item span {
      margin-top: 2px;
      color: #78909c;
      font-size: 11px;
    }

    .home-alert-item b {
      color: #e65100;
      font-size: 13px;
      white-space: nowrap;
    }

    .home-alert-shipping
      .home-alert-item b {
      color: #6a1b9a;
    }

    .home-alert-more {
      margin: 8px 0 0;
      color: #78909c;
      font-size: 12px;
      font-weight: 700;
      text-align: right;
    }

    .home-alert-zero {
      display: grid;
      gap: 5px;
      margin-bottom: 10px;
      padding: 10px;
      border-radius: 9px;
      background: rgba(255,255,255,0.8);
    }

    .home-alert-zero strong {
      color: #2e7d32;
      font-size: 18px;
    }

    .home-alert-zero span {
      color: #607d8b;
      font-size: 12px;
      line-height: 1.55;
    }

    #home-alert-panel
      .home-alert-open-button {
      width: 100%;
      min-height: 40px;
      margin: 10px 0 0;
      padding: 8px 10px;
      background: #ef6c00;
      font-size: 13px;
    }

    #home-alert-panel
      .home-alert-open-shipping {
      background: #6a1b9a;
    }

    .home-alert-card-message {
      margin: 0;
      color: #607d8b;
      font-size: 12px;
      line-height: 1.6;
    }

    .home-alert-updated {
      color: #90a4ae;
      font-size: 11px;
      text-align: right;
    }
  `;

  document.head.appendChild(
    style
  );
}
