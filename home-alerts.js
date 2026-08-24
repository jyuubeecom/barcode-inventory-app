"use strict";

/* =========================================================
   v177 PCホーム右側 要確認パネル + 印刷
   ・発注必要商品
   ・次の未確定船便で船積みが必要な商品
   ・PC表示のみ
   ・要確認を「全部 / 発注のみ / 船積のみ」でA4印刷
   ========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  initializeHomeAlertPanel
);

let homeAlertLatestPurchaseData = null;
let homeAlertLatestShippingData = null;


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

      <div class="home-alert-panel-actions">
        <button
          id="home-alert-print-button"
          type="button"
          class="home-alert-print-button"
          title="要確認の内容を印刷"
        >
          印刷
        </button>

        <button
          id="home-alert-refresh-button"
          type="button"
          class="home-alert-refresh-button"
          title="最新データで再確認"
        >
          更新
        </button>
      </div>
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

  panel
    .querySelector(
      "#home-alert-print-button"
    )
    ?.addEventListener(
      "click",
      function () {
        void openHomeAlertPrintChoice();
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

  if (
    purchaseResult.status ===
    "fulfilled"
  ) {
    homeAlertLatestPurchaseData =
      purchaseResult.value;
  }

  if (
    shippingResult.status ===
    "fulfilled"
  ) {
    homeAlertLatestShippingData =
      shippingResult.value;
  }

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


async function openHomeAlertPrintChoice() {
  const button =
    document.querySelector(
      "#home-alert-print-button"
    );

  if (button) {
    button.disabled = true;
    button.textContent =
      "準備中…";
  }

  try {
    const results =
      await Promise.allSettled([
        getHomePurchaseAlertData(),
        getHomeShippingAlertData()
      ]);

    if (
      results[0].status ===
      "fulfilled"
    ) {
      homeAlertLatestPurchaseData =
        results[0].value;
    }

    if (
      results[1].status ===
      "fulfilled"
    ) {
      homeAlertLatestShippingData =
        results[1].value;
    }

    if (
      !homeAlertLatestPurchaseData &&
      !homeAlertLatestShippingData
    ) {
      await showHomeAlertPrintNotice(
        "印刷データを確認できませんでした。更新してから、もう一度お試しください。"
      );
      return;
    }

    showHomeAlertPrintChoiceDialog();
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent =
        "印刷";
    }
  }
}

function showHomeAlertPrintChoiceDialog() {
  document
    .querySelector(
      "#home-alert-print-dialog"
    )
    ?.remove();

  const purchaseCount =
    Number(
      homeAlertLatestPurchaseData &&
      homeAlertLatestPurchaseData.count ||
      0
    );

  const shippingCount =
    Number(
      homeAlertLatestShippingData &&
      homeAlertLatestShippingData.count ||
      0
    );

  const overlay =
    document.createElement("div");

  overlay.id =
    "home-alert-print-dialog";

  overlay.className =
    "home-alert-print-overlay";

  overlay.setAttribute(
    "role",
    "dialog"
  );

  overlay.setAttribute(
    "aria-modal",
    "true"
  );

  overlay.setAttribute(
    "aria-labelledby",
    "home-alert-print-dialog-title"
  );

  overlay.innerHTML = `
    <div class="home-alert-print-modal">
      <div class="home-alert-print-modal-head">
        <div>
          <span class="home-alert-print-modal-kicker">
            A4横向き
          </span>
          <h3 id="home-alert-print-dialog-title">
            要確認を印刷
          </h3>
        </div>
        <button
          type="button"
          class="home-alert-print-close"
          data-home-alert-print-close
          aria-label="閉じる"
        >
          ×
        </button>
      </div>

      <p class="home-alert-print-modal-message">
        印刷したい内容を選んでください。画面に表示されている上位5件だけではなく、対象商品をすべて印刷します。
      </p>

      <div class="home-alert-print-choice-list">
        <button
          type="button"
          class="home-alert-print-choice home-alert-print-choice-all"
          data-home-alert-print-mode="all"
        >
          <strong>要確認を全部</strong>
          <span>
            発注 ${purchaseCount.toLocaleString("ja-JP")}商品 / 船積 ${shippingCount.toLocaleString("ja-JP")}商品
          </span>
        </button>

        <button
          type="button"
          class="home-alert-print-choice home-alert-print-choice-purchase"
          data-home-alert-print-mode="purchase"
        >
          <strong>発注のみ</strong>
          <span>
            ${purchaseCount.toLocaleString("ja-JP")}商品
          </span>
        </button>

        <button
          type="button"
          class="home-alert-print-choice home-alert-print-choice-shipping"
          data-home-alert-print-mode="shipping"
        >
          <strong>船積のみ</strong>
          <span>
            ${shippingCount.toLocaleString("ja-JP")}商品
          </span>
        </button>
      </div>

      <button
        type="button"
        class="home-alert-print-cancel"
        data-home-alert-print-close
      >
        キャンセル
      </button>
    </div>
  `;

  function closeDialog() {
    document.body.classList.remove(
      "home-alert-print-dialog-open"
    );

    overlay.remove();
  }

  overlay
    .querySelectorAll(
      "[data-home-alert-print-close]"
    )
    .forEach(
      function (button) {
        button.addEventListener(
          "click",
          closeDialog
        );
      }
    );

  overlay
    .querySelectorAll(
      "[data-home-alert-print-mode]"
    )
    .forEach(
      function (button) {
        button.addEventListener(
          "click",
          function () {
            const mode =
              button.dataset
                .homeAlertPrintMode ||
              "all";

            const opened =
              printHomeAlertReport(
                mode
              );

            if (opened) {
              closeDialog();
            }
          }
        );
      }
    );

  overlay.addEventListener(
    "click",
    function (event) {
      if (event.target === overlay) {
        closeDialog();
      }
    }
  );

  function handleEscape(event) {
    if (event.key !== "Escape") {
      return;
    }

    document.removeEventListener(
      "keydown",
      handleEscape
    );

    closeDialog();
  }

  document.addEventListener(
    "keydown",
    handleEscape
  );

  document.body.classList.add(
    "home-alert-print-dialog-open"
  );

  document.body.appendChild(
    overlay
  );

  overlay
    .querySelector(
      '[data-home-alert-print-mode="all"]'
    )
    ?.focus();
}

function printHomeAlertReport(mode) {
  const normalizedMode =
    [
      "all",
      "purchase",
      "shipping"
    ].includes(mode)
      ? mode
      : "all";

  const printWindow =
    window.open(
      "",
      "_blank"
    );

  if (!printWindow) {
    void showHomeAlertPrintNotice(
      "印刷画面を開けませんでした。ブラウザのポップアップを許可してから、もう一度お試しください。"
    );
    return false;
  }

  try {
    printWindow.opener = null;
  } catch (error) {
    // 印刷画面の作成自体は続行します。
  }

  const title =
    normalizedMode === "purchase"
      ? "発注が必要 一覧"
      : normalizedMode === "shipping"
        ? "船積みが必要 一覧"
        : "要確認 一覧";

  const sections = [];

  if (
    normalizedMode === "all" ||
    normalizedMode === "purchase"
  ) {
    sections.push(
      createHomePurchasePrintSection(
        homeAlertLatestPurchaseData
      )
    );
  }

  if (
    normalizedMode === "all" ||
    normalizedMode === "shipping"
  ) {
    sections.push(
      createHomeShippingPrintSection(
        homeAlertLatestShippingData,
        normalizedMode === "all"
      )
    );
  }

  const now = new Date();
  const printedAt =
    now.toLocaleString(
      "ja-JP",
      {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit"
      }
    );

  printWindow.document.open();
  printWindow.document.write(`<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHomeAlertHtml(title)}</title>
  <style>
    @page {
      size: A4 landscape;
      margin: 9mm;
    }

    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      color: #263238;
      background: #fff;
      font-family:
        -apple-system,
        BlinkMacSystemFont,
        "Segoe UI",
        "Yu Gothic",
        "Meiryo",
        sans-serif;
      font-size: 10.5pt;
      line-height: 1.35;
    }

    .print-report-header {
      display: flex;
      align-items: end;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 8px;
      padding-bottom: 6px;
      border-bottom: 2px solid #455a64;
    }

    .print-report-header h1 {
      margin: 0;
      font-size: 18pt;
    }

    .print-report-header p {
      margin: 0;
      color: #546e7a;
      font-size: 9pt;
      white-space: nowrap;
    }

    .print-section {
      margin-top: 8px;
    }

    .print-section.page-break {
      break-before: page;
      page-break-before: always;
    }

    .print-section-title {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      margin-bottom: 6px;
      padding: 7px 9px;
      border-radius: 5px;
      background: #fff3e0;
      border-left: 5px solid #ef6c00;
    }

    .print-section-shipping .print-section-title {
      background: #f3e5f5;
      border-left-color: #7b1fa2;
    }

    .print-section-title h2 {
      margin: 0;
      font-size: 14pt;
    }

    .print-section-title strong {
      font-size: 11pt;
      white-space: nowrap;
    }

    .print-summary {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 6px;
      margin-bottom: 7px;
    }

    .print-summary-item {
      padding: 6px 8px;
      border: 1px solid #cfd8dc;
      background: #fafafa;
    }

    .print-summary-item span {
      color: #607d8b;
      font-size: 8.5pt;
      font-weight: 700;
    }

    .print-summary-item strong {
      display: block;
      margin-top: 2px;
      font-size: 12pt;
    }

    .print-schedule-info {
      display: grid;
      grid-template-columns: 1.4fr repeat(3, 1fr);
      gap: 5px;
      margin-bottom: 7px;
      padding: 7px 8px;
      border: 1px solid #d1c4e9;
      background: #faf7ff;
      font-size: 9pt;
    }

    .print-schedule-info strong {
      display: block;
      margin-top: 2px;
      color: #4527a0;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      font-size: 8.6pt;
    }

    thead {
      display: table-header-group;
    }

    tr {
      break-inside: avoid;
      page-break-inside: avoid;
    }

    th,
    td {
      padding: 4px 5px;
      border: 1px solid #90a4ae;
      vertical-align: middle;
      overflow-wrap: anywhere;
    }

    th {
      background: #eceff1;
      font-weight: 800;
      text-align: center;
    }

    td.number {
      text-align: right;
      white-space: nowrap;
    }

    td.center {
      text-align: center;
    }

    .purchase-table th:nth-child(1),
    .purchase-table td:nth-child(1) { width: 4%; }
    .purchase-table th:nth-child(2),
    .purchase-table td:nth-child(2) { width: 10%; }
    .purchase-table th:nth-child(3),
    .purchase-table td:nth-child(3) { width: 12%; }
    .purchase-table th:nth-child(4),
    .purchase-table td:nth-child(4) { width: 28%; }
    .purchase-table th:nth-child(5),
    .purchase-table td:nth-child(5) { width: 10%; }
    .purchase-table th:nth-child(6),
    .purchase-table td:nth-child(6) { width: 10%; }
    .purchase-table th:nth-child(7),
    .purchase-table td:nth-child(7) { width: 12%; }
    .purchase-table th:nth-child(8),
    .purchase-table td:nth-child(8) { width: 14%; }

    .shipping-table th:nth-child(1),
    .shipping-table td:nth-child(1) { width: 5%; }
    .shipping-table th:nth-child(2),
    .shipping-table td:nth-child(2) { width: 11%; }
    .shipping-table th:nth-child(3),
    .shipping-table td:nth-child(3) { width: 14%; }
    .shipping-table th:nth-child(4),
    .shipping-table td:nth-child(4) { width: 34%; }
    .shipping-table th:nth-child(5),
    .shipping-table td:nth-child(5) { width: 12%; }
    .shipping-table th:nth-child(6),
    .shipping-table td:nth-child(6) { width: 12%; }
    .shipping-table th:nth-child(7),
    .shipping-table td:nth-child(7) { width: 12%; }

    .shortage {
      color: #d84315;
      font-weight: 800;
    }

    .remaining {
      color: #6a1b9a;
      font-weight: 800;
    }

    .print-empty {
      padding: 16px;
      border: 1px dashed #90a4ae;
      color: #607d8b;
      text-align: center;
      font-weight: 700;
    }
  </style>
</head>
<body>
  <header class="print-report-header">
    <h1>${escapeHomeAlertHtml(title)}</h1>
    <p>印刷日時：${escapeHomeAlertHtml(printedAt)}</p>
  </header>

  ${sections.join("\n")}

  <script>
    window.addEventListener("load", function () {
      window.setTimeout(function () {
        window.focus();
        window.print();
      }, 250);
    });
  <\/script>
</body>
</html>`);
  printWindow.document.close();

  return true;
}

function createHomePurchasePrintSection(data) {
  const safeData = data || {};
  const rows =
    Array.isArray(safeData.rows)
      ? safeData.rows
      : [];
  const count =
    Number(safeData.count || rows.length || 0);
  const total =
    Number(safeData.totalShortage || 0);

  const body =
    rows.length > 0
      ? `
        <table class="purchase-table">
          <thead>
            <tr>
              <th>No.</th>
              <th>社内コード</th>
              <th>商品コード</th>
              <th>商品名</th>
              <th>現在庫</th>
              <th>発注残</th>
              <th>必要在庫</th>
              <th>不足数</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map(
              function (row, index) {
                return `
                  <tr>
                    <td class="center">${index + 1}</td>
                    <td>${escapeHomeAlertHtml(row.internalCode || "-")}</td>
                    <td>${escapeHomeAlertHtml(row.productCode || "-")}</td>
                    <td>${escapeHomeAlertHtml(row.productName || "商品名未登録")}</td>
                    <td class="number">${formatHomeAlertPrintQuantity(row.currentStock)}個</td>
                    <td class="number">${formatHomeAlertPrintQuantity(row.orderRemaining)}個</td>
                    <td class="number">${formatHomeAlertPrintQuantity(row.requiredStock)}個</td>
                    <td class="number shortage">${formatHomeAlertPrintQuantity(row.shortage)}個</td>
                  </tr>
                `;
              }
            ).join("")}
          </tbody>
        </table>
      `
      : `<div class="print-empty">現在、追加発注が必要な商品はありません。</div>`;

  return `
    <section class="print-section print-section-purchase">
      <div class="print-section-title">
        <h2>🛒 発注が必要</h2>
        <strong>${count.toLocaleString("ja-JP")}商品</strong>
      </div>

      <div class="print-summary">
        <div class="print-summary-item">
          <span>対象商品数</span>
          <strong>${count.toLocaleString("ja-JP")}商品</strong>
        </div>
        <div class="print-summary-item">
          <span>不足合計</span>
          <strong>${total.toLocaleString("ja-JP")}個</strong>
        </div>
      </div>

      ${body}
    </section>
  `;
}

function createHomeShippingPrintSection(
  data,
  pageBreak
) {
  const safeData = data || {};
  const rows =
    Array.isArray(safeData.rows)
      ? safeData.rows
      : [];
  const count =
    Number(safeData.count || rows.length || 0);
  const total =
    Number(safeData.totalRemaining || 0);
  const schedule =
    safeData.schedule || {};
  const hasSchedule =
    Boolean(safeData.hasSchedule);

  let body = "";

  if (!hasSchedule) {
    body = `
      <div class="print-empty">
        確認対象になる次の未確定船便がありません。
      </div>
    `;
  } else if (rows.length <= 0) {
    body = `
      <div class="print-empty">
        この船便で追加の船積入力が必要な商品はありません。
      </div>
    `;
  } else {
    body = `
      <table class="shipping-table">
        <thead>
          <tr>
            <th>No.</th>
            <th>社内コード</th>
            <th>商品コード</th>
            <th>商品名</th>
            <th>推奨数量</th>
            <th>入力済</th>
            <th>あと必要</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(
            function (row, index) {
              return `
                <tr>
                  <td class="center">${index + 1}</td>
                  <td>${escapeHomeAlertHtml(row.internalCode || "-")}</td>
                  <td>${escapeHomeAlertHtml(row.productCode || "-")}</td>
                  <td>${escapeHomeAlertHtml(row.productName || "商品名未登録")}</td>
                  <td class="number">${formatHomeAlertPrintQuantity(row.recommendedQuantity)}個</td>
                  <td class="number">${formatHomeAlertPrintQuantity(row.currentAllocation)}個</td>
                  <td class="number remaining">${formatHomeAlertPrintQuantity(row.remainingQuantity)}個</td>
                </tr>
              `;
            }
          ).join("")}
        </tbody>
      </table>
    `;
  }

  const scheduleInfo =
    hasSchedule
      ? `
        <div class="print-schedule-info">
          <div>
            船便
            <strong>${escapeHomeAlertHtml(schedule.name || "船便名未設定")}</strong>
          </div>
          <div>
            出港日
            <strong>${escapeHomeAlertHtml(formatHomeAlertPrintDate(schedule.departureDate))}</strong>
          </div>
          <div>
            入港日
            <strong>${escapeHomeAlertHtml(formatHomeAlertPrintDate(schedule.arrivalDate))}</strong>
          </div>
          <div>
            倉庫到着日
            <strong>${escapeHomeAlertHtml(formatHomeAlertPrintDate(schedule.warehouseArrivalDate))}</strong>
          </div>
        </div>
      `
      : "";

  return `
    <section class="print-section print-section-shipping${pageBreak ? " page-break" : ""}">
      <div class="print-section-title">
        <h2>🚢 船積みが必要</h2>
        <strong>${count.toLocaleString("ja-JP")}商品</strong>
      </div>

      ${scheduleInfo}

      <div class="print-summary">
        <div class="print-summary-item">
          <span>対象商品数</span>
          <strong>${count.toLocaleString("ja-JP")}商品</strong>
        </div>
        <div class="print-summary-item">
          <span>未入力・不足合計</span>
          <strong>${total.toLocaleString("ja-JP")}個</strong>
        </div>
      </div>

      ${body}
    </section>
  `;
}

function formatHomeAlertPrintQuantity(value) {
  const number = Number(value || 0);

  if (!Number.isFinite(number)) {
    return "0";
  }

  return number.toLocaleString(
    "ja-JP",
    {
      maximumFractionDigits: 2
    }
  );
}

function formatHomeAlertPrintDate(value) {
  const text = String(value || "");

  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return text || "-";
  }

  const parts = text.split("-");

  return (
    Number(parts[0]) +
    "/" +
    Number(parts[1]) +
    "/" +
    Number(parts[2])
  );
}

async function showHomeAlertPrintNotice(message) {
  if (
    window.inventoryApp &&
    typeof window.inventoryApp.showAppDialog ===
      "function"
  ) {
    await window.inventoryApp.showAppDialog({
      type: "warning",
      icon: "🖨",
      title: "要確認の印刷",
      message: message,
      confirmText: "閉じる"
    });
    return;
  }

  window.alert(message);
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

    .home-alert-panel-actions {
      display: flex;
      align-items: center;
      gap: 7px;
    }

    #home-alert-panel
      .home-alert-print-button {
      min-height: 36px;
      margin: 0;
      padding: 7px 11px;
      border-radius: 9px;
      background: #1565c0;
      font-size: 13px;
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


    body.home-alert-print-dialog-open {
      overflow: hidden;
    }

    .home-alert-print-overlay {
      position: fixed;
      z-index: 5000;
      inset: 0;
      display: grid;
      place-items: center;
      padding: 20px;
      background: rgba(20, 35, 45, 0.58);
    }

    .home-alert-print-modal {
      width: min(520px, 100%);
      max-height: min(760px, calc(100vh - 40px));
      overflow-y: auto;
      padding: 20px;
      border-radius: 16px;
      background: #ffffff;
      box-shadow: 0 18px 60px rgba(0, 0, 0, 0.28);
    }

    .home-alert-print-modal-head {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 14px;
      margin-bottom: 12px;
    }

    .home-alert-print-modal-kicker {
      display: block;
      margin-bottom: 3px;
      color: #607d8b;
      font-size: 12px;
      font-weight: 800;
    }

    .home-alert-print-modal h3 {
      margin: 0;
      color: #263238;
      font-size: 24px;
    }

    .home-alert-print-close {
      width: 40px;
      min-width: 40px;
      height: 40px;
      min-height: 40px;
      margin: 0;
      padding: 0;
      border-radius: 50%;
      background: #eceff1;
      color: #455a64;
      font-size: 25px;
      line-height: 1;
    }

    .home-alert-print-modal-message {
      margin: 0 0 14px;
      padding: 11px 12px;
      border-radius: 9px;
      background: #e3f2fd;
      color: #37474f;
      font-size: 14px;
      line-height: 1.65;
    }

    .home-alert-print-choice-list {
      display: grid;
      gap: 10px;
    }

    .home-alert-print-choice {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      align-items: center;
      gap: 12px;
      width: 100%;
      min-height: 62px;
      margin: 0;
      padding: 12px 14px;
      border: 2px solid #90caf9;
      border-radius: 11px;
      background: #f7fbff;
      color: #0d47a1;
      text-align: left;
    }

    .home-alert-print-choice strong {
      font-size: 17px;
    }

    .home-alert-print-choice span {
      color: #546e7a;
      font-size: 13px;
      font-weight: 800;
      white-space: nowrap;
    }

    .home-alert-print-choice-purchase {
      border-color: #ffb74d;
      background: #fffaf3;
      color: #e65100;
    }

    .home-alert-print-choice-shipping {
      border-color: #b39ddb;
      background: #fbf8ff;
      color: #6a1b9a;
    }

    .home-alert-print-cancel {
      width: 100%;
      min-height: 46px;
      margin: 14px 0 0;
      background: #607d8b;
      font-size: 15px;
    }

    @media (max-width: 600px) {
      .home-alert-print-choice {
        grid-template-columns: 1fr;
        gap: 4px;
      }

      .home-alert-print-choice span {
        white-space: normal;
      }
    }
  `;

  document.head.appendChild(
    style
  );
}
