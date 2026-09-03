"use strict";

/* =========================================================
   v222 PCホーム右側 要確認パネル + 販売予定在庫不足 + 注残優先表示 + 印刷 + 折りたたみ + 更新通知
   ・発注必要商品
   ・次の未確定船便で船積みが必要な商品
   ・今後の販売予定数量に対して「現在庫＋発注残」が不足する商品
   ・PC表示のみ
   ・通常は折りたたんでホーム画面を広く使う
   ・発注 / 船積み / 販売予定不足の内容が変わったら画面上部へ通知
   ・折りたたみ中は「更新あり」バッジを残す
   ・要確認を「全部 / 発注のみ / 船積のみ / 販売予定不足のみ」でA4印刷
   ========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  initializeHomeAlertPanel
);

let homeAlertLatestPurchaseData = null;
let homeAlertLatestShippingData = null;
let homeAlertLatestSalesPlanData = null;

const HOME_ALERT_COLLAPSED_KEY =
  "barcode-inventory-home-alert-collapsed-v194";
const HOME_ALERT_SNAPSHOT_KEY =
  "barcode-inventory-home-alert-snapshot-v194";
const HOME_ALERT_UNREAD_KEY =
  "barcode-inventory-home-alert-unread-v194";

let homeAlertCollapsed =
  loadHomeAlertCollapsedState();
let homeAlertUnreadState =
  loadHomeAlertUnreadState();
let homeAlertLastSnapshot =
  loadHomeAlertSnapshot();
let homeAlertToastTimer = null;


function initializeHomeAlertPanel() {
  createHomeAlertPanelStyle();
  createHomeAlertPanel();
  applyHomeAlertCollapsedState();
  updateHomeAlertUnreadBadge();

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

  document.addEventListener(
    "visibilitychange",
    function () {
      if (
        !document.hidden &&
        isHomeAlertPanelUsable()
      ) {
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
    <button
      id="home-alert-compact-toggle"
      type="button"
      class="home-alert-compact-toggle"
      aria-expanded="false"
      title="要確認を開く"
    >
      <span class="home-alert-compact-icon">⚠</span>
      <strong>要確認</strong>
      <span
        id="home-alert-compact-purchase"
        class="home-alert-compact-count home-alert-compact-purchase"
      >
        発注 --
      </span>
      <span
        id="home-alert-compact-shipping"
        class="home-alert-compact-count home-alert-compact-shipping"
      >
        船積 --
      </span>
      <span
        id="home-alert-compact-sales-plan"
        class="home-alert-compact-count home-alert-compact-sales-plan"
      >
        予定 --
      </span>
      <span
        id="home-alert-unread-badge"
        class="home-alert-unread-badge"
        hidden
      >
        更新あり
      </span>
    </button>

    <div class="home-alert-expanded-content">
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

          <button
            id="home-alert-collapse-button"
            type="button"
            class="home-alert-collapse-button"
            title="要確認を折りたたむ"
          >
            閉じる
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
        id="home-alert-sales-plan"
        class="home-alert-card home-alert-sales-plan"
      ></div>

      <div
        id="home-alert-updated"
        class="home-alert-updated"
      ></div>
    </div>
  `;

  document.body.appendChild(
    panel
  );

  panel
    .querySelector(
      "#home-alert-compact-toggle"
    )
    ?.addEventListener(
      "click",
      function () {
        setHomeAlertCollapsed(false);
        markHomeAlertUpdatesRead();
      }
    );

  panel
    .querySelector(
      "#home-alert-collapse-button"
    )
    ?.addEventListener(
      "click",
      function () {
        setHomeAlertCollapsed(true);
      }
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

function loadHomeAlertCollapsedState() {
  try {
    const saved =
      window.localStorage.getItem(
        HOME_ALERT_COLLAPSED_KEY
      );

    if (saved === null) {
      return true;
    }

    return saved !== "false";
  } catch (error) {
    return true;
  }
}

function saveHomeAlertCollapsedState() {
  try {
    window.localStorage.setItem(
      HOME_ALERT_COLLAPSED_KEY,
      String(homeAlertCollapsed)
    );
  } catch (error) {
    // 保存できない環境でも動作は継続する。
  }
}

function loadHomeAlertUnreadState() {
  try {
    const raw =
      window.localStorage.getItem(
        HOME_ALERT_UNREAD_KEY
      );

    if (!raw) {
      return {
        purchase: false,
        shipping: false,
        salesPlan: false
      };
    }

    const parsed =
      JSON.parse(raw);

    return {
      purchase: Boolean(
        parsed && parsed.purchase
      ),
      shipping: Boolean(
        parsed && parsed.shipping
      ),
      salesPlan: Boolean(
        parsed && parsed.salesPlan
      )
    };
  } catch (error) {
    return {
      purchase: false,
      shipping: false,
      salesPlan: false
    };
  }
}

function saveHomeAlertUnreadState() {
  try {
    window.localStorage.setItem(
      HOME_ALERT_UNREAD_KEY,
      JSON.stringify(
        homeAlertUnreadState
      )
    );
  } catch (error) {
    // 保存できない環境でも動作は継続する。
  }
}

function loadHomeAlertSnapshot() {
  try {
    const raw =
      window.localStorage.getItem(
        HOME_ALERT_SNAPSHOT_KEY
      );

    if (!raw) {
      return null;
    }

    return JSON.parse(raw);
  } catch (error) {
    return null;
  }
}

function saveHomeAlertSnapshot(snapshot) {
  homeAlertLastSnapshot = snapshot;

  try {
    window.localStorage.setItem(
      HOME_ALERT_SNAPSHOT_KEY,
      JSON.stringify(snapshot)
    );
  } catch (error) {
    // 保存できない環境でも動作は継続する。
  }
}

function setHomeAlertCollapsed(collapsed) {
  homeAlertCollapsed =
    Boolean(collapsed);

  saveHomeAlertCollapsedState();
  applyHomeAlertCollapsedState();

  if (!homeAlertCollapsed) {
    markHomeAlertUpdatesRead();
  }
}

function applyHomeAlertCollapsedState() {
  const panel =
    document.querySelector(
      "#home-alert-panel"
    );

  if (!panel) {
    return;
  }

  panel.classList.toggle(
    "is-collapsed",
    homeAlertCollapsed
  );

  const compactToggle =
    panel.querySelector(
      "#home-alert-compact-toggle"
    );

  if (compactToggle) {
    compactToggle.setAttribute(
      "aria-expanded",
      String(!homeAlertCollapsed)
    );

    compactToggle.title =
      homeAlertCollapsed
        ? "要確認を開く"
        : "要確認を表示中";
  }
}

function markHomeAlertUpdatesRead() {
  if (
    !homeAlertUnreadState.purchase &&
    !homeAlertUnreadState.shipping &&
    !homeAlertUnreadState.salesPlan
  ) {
    return;
  }

  homeAlertUnreadState = {
    purchase: false,
    shipping: false,
    salesPlan: false
  };

  saveHomeAlertUnreadState();
  updateHomeAlertUnreadBadge();
}

function updateHomeAlertUnreadBadge() {
  const badge =
    document.querySelector(
      "#home-alert-unread-badge"
    );

  if (!badge) {
    return;
  }

  const hasUnread =
    homeAlertUnreadState.purchase ||
    homeAlertUnreadState.shipping ||
    homeAlertUnreadState.salesPlan;

  badge.hidden = !hasUnread;

  const labels = [];

  if (homeAlertUnreadState.purchase) {
    labels.push("発注");
  }

  if (homeAlertUnreadState.shipping) {
    labels.push("船積");
  }

  if (homeAlertUnreadState.salesPlan) {
    labels.push("販売予定");
  }

  badge.textContent =
    hasUnread
      ? labels.join("・") + " 更新"
      : "";
}

function updateHomeAlertCompactSummary(
  purchaseData,
  shippingData,
  salesPlanData
) {
  const purchase =
    document.querySelector(
      "#home-alert-compact-purchase"
    );
  const shipping =
    document.querySelector(
      "#home-alert-compact-shipping"
    );
  const salesPlan =
    document.querySelector(
      "#home-alert-compact-sales-plan"
    );

  if (purchase) {
    purchase.textContent =
      "発注 " +
      Number(
        purchaseData &&
        purchaseData.count ||
        0
      ).toLocaleString("ja-JP");
  }

  if (shipping) {
    const hasSchedule =
      Boolean(
        shippingData &&
        shippingData.hasSchedule
      );

    shipping.textContent =
      hasSchedule
        ? (
          "船積 " +
          Number(
            shippingData.count || 0
          ).toLocaleString("ja-JP")
        )
        : "船積 -";
  }

  if (salesPlan) {
    salesPlan.textContent =
      "予定 " +
      Number(
        salesPlanData &&
        salesPlanData.count ||
        0
      ).toLocaleString("ja-JP");
  }
}

function createHomeAlertSnapshot(
  purchaseData,
  shippingData,
  salesPlanData
) {
  const purchaseRows =
    Array.isArray(
      purchaseData && purchaseData.rows
    )
      ? purchaseData.rows
      : [];

  const shippingRows =
    Array.isArray(
      shippingData && shippingData.rows
    )
      ? shippingData.rows
      : [];

  const salesPlanRows =
    Array.isArray(
      salesPlanData && salesPlanData.rows
    )
      ? salesPlanData.rows
      : [];

  return {
    purchase: {
      count: Number(
        purchaseData &&
        purchaseData.count ||
        0
      ),
      total: Number(
        purchaseData &&
        purchaseData.totalShortage ||
        0
      ),
      rows: purchaseRows.map(
        function (row) {
          return [
            String(
              row.internalCode ||
              row.productCode ||
              ""
            ),
            Number(row.shortage || 0),
            Number(row.currentStock || 0),
            Number(row.orderRemaining || 0),
            Number(row.requiredStock || 0)
          ];
        }
      )
    },
    shipping: {
      hasSchedule: Boolean(
        shippingData &&
        shippingData.hasSchedule
      ),
      scheduleId: String(
        shippingData &&
        shippingData.schedule &&
        shippingData.schedule.id ||
        ""
      ),
      scheduleName: String(
        shippingData &&
        shippingData.schedule &&
        shippingData.schedule.name ||
        ""
      ),
      count: Number(
        shippingData &&
        shippingData.count ||
        0
      ),
      total: Number(
        shippingData &&
        shippingData.totalRemaining ||
        0
      ),
      rows: shippingRows.map(
        function (row) {
          return [
            String(
              row.internalCode ||
              row.productCode ||
              ""
            ),
            Number(
              row.recommendedQuantity ||
              0
            ),
            Number(
              row.currentAllocation ||
              0
            ),
            Number(
              row.remainingQuantity ||
              0
            ),
            Boolean(row.isBackorder)
          ];
        }
      )
    },
    salesPlan: {
      count: Number(
        salesPlanData &&
        salesPlanData.count ||
        0
      ),
      total: Number(
        salesPlanData &&
        salesPlanData.totalShortage ||
        0
      ),
      rows: salesPlanRows.map(
        function (row) {
          return [
            String(
              row.internalCode ||
              row.productCode ||
              ""
            ),
            Number(row.plannedQuantity || 0),
            Number(row.currentStock || 0),
            Number(row.orderRemaining || 0),
            Number(row.shortage || 0),
            String(row.nextShippingDate || "")
          ];
        }
      )
    }
  };
}

function homeAlertSnapshotPartChanged(
  before,
  after
) {
  return JSON.stringify(before) !==
    JSON.stringify(after);
}

function handleHomeAlertSnapshotChange(
  purchaseData,
  shippingData,
  salesPlanData
) {
  const nextSnapshot =
    createHomeAlertSnapshot(
      purchaseData,
      shippingData,
      salesPlanData
    );

  const previousSnapshot =
    homeAlertLastSnapshot;

  saveHomeAlertSnapshot(
    nextSnapshot
  );

  if (!previousSnapshot) {
    return;
  }

  const purchaseChanged =
    homeAlertSnapshotPartChanged(
      previousSnapshot.purchase,
      nextSnapshot.purchase
    );
  const shippingChanged =
    homeAlertSnapshotPartChanged(
      previousSnapshot.shipping,
      nextSnapshot.shipping
    );
  const salesPlanChanged =
    previousSnapshot.salesPlan
      ? homeAlertSnapshotPartChanged(
          previousSnapshot.salesPlan,
          nextSnapshot.salesPlan
        )
      : Number(
          nextSnapshot.salesPlan &&
          nextSnapshot.salesPlan.count ||
          0
        ) > 0;

  if (
    !purchaseChanged &&
    !shippingChanged &&
    !salesPlanChanged
  ) {
    return;
  }

  homeAlertUnreadState = {
    purchase:
      homeAlertUnreadState.purchase ||
      purchaseChanged,
    shipping:
      homeAlertUnreadState.shipping ||
      shippingChanged,
    salesPlan:
      homeAlertUnreadState.salesPlan ||
      salesPlanChanged
  };

  saveHomeAlertUnreadState();
  updateHomeAlertUnreadBadge();

  showHomeAlertUpdateToast({
    purchaseChanged: purchaseChanged,
    shippingChanged: shippingChanged,
    salesPlanChanged: salesPlanChanged,
    previousSnapshot: previousSnapshot,
    nextSnapshot: nextSnapshot
  });
}

function showHomeAlertUpdateToast(change) {
  let toast =
    document.querySelector(
      "#home-alert-update-toast"
    );

  if (!toast) {
    toast =
      document.createElement("div");
    toast.id =
      "home-alert-update-toast";
    toast.className =
      "home-alert-update-toast";
    toast.setAttribute(
      "role",
      "status"
    );
    toast.setAttribute(
      "aria-live",
      "polite"
    );
    document.body.appendChild(toast);
  }

  const lines = [];

  if (change.purchaseChanged) {
    const oldCount = Number(
      change.previousSnapshot &&
      change.previousSnapshot.purchase &&
      change.previousSnapshot.purchase.count ||
      0
    );
    const newCount = Number(
      change.nextSnapshot.purchase.count ||
      0
    );

    lines.push(
      "発注が必要：" +
      oldCount.toLocaleString("ja-JP") +
      " → " +
      newCount.toLocaleString("ja-JP") +
      "商品"
    );
  }

  if (change.shippingChanged) {
    const oldCount = Number(
      change.previousSnapshot &&
      change.previousSnapshot.shipping &&
      change.previousSnapshot.shipping.count ||
      0
    );
    const newCount = Number(
      change.nextSnapshot.shipping.count ||
      0
    );

    lines.push(
      "船積みが必要：" +
      oldCount.toLocaleString("ja-JP") +
      " → " +
      newCount.toLocaleString("ja-JP") +
      "商品"
    );
  }

  if (change.salesPlanChanged) {
    const oldCount = Number(
      change.previousSnapshot &&
      change.previousSnapshot.salesPlan &&
      change.previousSnapshot.salesPlan.count ||
      0
    );
    const newCount = Number(
      change.nextSnapshot.salesPlan.count ||
      0
    );

    lines.push(
      "販売予定の在庫不足：" +
      oldCount.toLocaleString("ja-JP") +
      " → " +
      newCount.toLocaleString("ja-JP") +
      "商品"
    );
  }

  toast.innerHTML = `
    <div class="home-alert-update-toast-icon">🔔</div>
    <div class="home-alert-update-toast-body">
      <strong>要確認の内容が更新されました</strong>
      <span>${escapeHomeAlertHtml(lines.join(" / "))}</span>
    </div>
    <button
      type="button"
      class="home-alert-update-toast-open"
    >
      確認する
    </button>
    <button
      type="button"
      class="home-alert-update-toast-close"
      aria-label="通知を閉じる"
      title="閉じる"
    >
      ×
    </button>
  `;

  toast.hidden = false;
  toast.classList.add("is-visible");

  toast
    .querySelector(
      ".home-alert-update-toast-open"
    )
    ?.addEventListener(
      "click",
      function () {
        setHomeAlertCollapsed(false);
        markHomeAlertUpdatesRead();
        hideHomeAlertUpdateToast();
      },
      { once: true }
    );

  toast
    .querySelector(
      ".home-alert-update-toast-close"
    )
    ?.addEventListener(
      "click",
      function () {
        hideHomeAlertUpdateToast();
      },
      { once: true }
    );

  if (homeAlertToastTimer) {
    window.clearTimeout(
      homeAlertToastTimer
    );
  }

  homeAlertToastTimer =
    window.setTimeout(
      hideHomeAlertUpdateToast,
      9000
    );
}

function hideHomeAlertUpdateToast() {
  const toast =
    document.querySelector(
      "#home-alert-update-toast"
    );

  if (!toast) {
    return;
  }

  toast.classList.remove(
    "is-visible"
  );

  window.setTimeout(
    function () {
      if (
        !toast.classList.contains(
          "is-visible"
        )
      ) {
        toast.hidden = true;
      }
    },
    220
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
    "(min-width: 1180px)"
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

  if (panel.hidden) {
    hideHomeAlertUpdateToast();
  }
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

  const salesPlanBox =
    panel.querySelector(
      "#home-alert-sales-plan"
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

  if (salesPlanBox) {
    salesPlanBox.innerHTML =
      createHomeAlertSkeleton(
        "販売予定に対して在庫不足",
        "📅"
      );
  }

  const results =
    await Promise.allSettled([
      getHomePurchaseAlertData(),
      getHomeShippingAlertData(),
      getHomeSalesPlanStockAlertData()
    ]);

  if (loading) {
    loading.hidden = true;
  }

  const purchaseResult =
    results[0];

  const shippingResult =
    results[1];

  const salesPlanResult =
    results[2];

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

  if (
    salesPlanResult.status ===
    "fulfilled"
  ) {
    homeAlertLatestSalesPlanData =
      salesPlanResult.value;
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

  if (salesPlanBox) {
    if (
      salesPlanResult.status ===
      "fulfilled"
    ) {
      renderHomeSalesPlanStockAlert(
        salesPlanBox,
        salesPlanResult.value
      );
    } else {
      renderHomeAlertError(
        salesPlanBox,
        "販売予定に対して在庫不足",
        "📅"
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

  updateHomeAlertCompactSummary(
    purchaseResult.status === "fulfilled"
      ? purchaseResult.value
      : homeAlertLatestPurchaseData,
    shippingResult.status === "fulfilled"
      ? shippingResult.value
      : homeAlertLatestShippingData,
    salesPlanResult.status === "fulfilled"
      ? salesPlanResult.value
      : homeAlertLatestSalesPlanData
  );

  if (
    purchaseResult.status === "fulfilled" &&
    shippingResult.status === "fulfilled" &&
    salesPlanResult.status === "fulfilled"
  ) {
    handleHomeAlertSnapshotChange(
      purchaseResult.value,
      shippingResult.value,
      salesPlanResult.value
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


async function getHomeSalesPlanStockAlertData() {
  if (
    typeof getAllProducts !== "function" ||
    typeof getAllSalesPlans !== "function"
  ) {
    throw new Error(
      "販売予定または商品データを読み込めません。"
    );
  }

  const results = await Promise.all([
    getAllProducts(),
    getAllSalesPlans()
  ]);

  const products = Array.isArray(results[0]) ? results[0] : [];
  const plans = Array.isArray(results[1]) ? results[1] : [];
  const today = formatHomeAlertIsoDate(new Date());
  const productMap = new Map();
  const planMap = new Map();

  products.forEach(function (product) {
    const code = String(product && product.internalCode || "").trim();
    if (code) productMap.set(code, product);
  });

  plans.forEach(function (plan) {
    if (!isHomeAlertFutureSalesPlan(plan, today)) return;

    const code = String(plan && plan.internalCode || "").trim();
    const quantity = Number(plan && plan.quantity || 0);
    if (!code || !Number.isFinite(quantity) || quantity <= 0) return;

    const current = planMap.get(code) || {
      plannedQuantity: 0,
      planCount: 0,
      nextShippingDate: "",
      customers: new Set()
    };

    current.plannedQuantity += quantity;
    current.planCount += 1;

    const startDate = getHomeAlertSalesPlanStartDate(plan);
    if (
      startDate &&
      (!current.nextShippingDate || startDate < current.nextShippingDate)
    ) {
      current.nextShippingDate = startDate;
    }

    const customer = String(plan && plan.customerName || "").trim();
    if (customer) current.customers.add(customer);

    planMap.set(code, current);
  });

  const rows = [];

  planMap.forEach(function (summary, internalCode) {
    const product = productMap.get(internalCode);
    if (!product) return;

    const currentStock = getHomeAlertNonNegativeNumber(product.stock);
    const orderRemaining = getHomeAlertNonNegativeInteger(product.orderRemaining);
    const availableQuantity = currentStock + orderRemaining;
    const plannedQuantity = Math.max(0, Number(summary.plannedQuantity || 0));
    const shortage = Math.max(0, plannedQuantity - availableQuantity);

    if (shortage <= 0) return;

    rows.push({
      internalCode: internalCode,
      productCode: product.productCode || "",
      productName: product.productName || "",
      currentStock: currentStock,
      orderRemaining: orderRemaining,
      availableQuantity: availableQuantity,
      plannedQuantity: plannedQuantity,
      shortage: shortage,
      planCount: Number(summary.planCount || 0),
      nextShippingDate: summary.nextShippingDate || "",
      customers: Array.from(summary.customers || []).slice(0, 3)
    });
  });

  rows.sort(function (a, b) {
    if (b.shortage !== a.shortage) return b.shortage - a.shortage;
    if (a.nextShippingDate !== b.nextShippingDate) {
      if (!a.nextShippingDate) return 1;
      if (!b.nextShippingDate) return -1;
      return a.nextShippingDate.localeCompare(b.nextShippingDate);
    }
    return String(a.internalCode).localeCompare(
      String(b.internalCode),
      "ja",
      { numeric: true }
    );
  });

  return {
    count: rows.length,
    totalShortage: rows.reduce(function (sum, row) {
      return sum + Number(row.shortage || 0);
    }, 0),
    rows: rows,
    evaluationDate: today
  };
}

function isHomeAlertFutureSalesPlan(plan, today) {
  if (!plan) return false;

  const shippingDate = String(plan.shippingDate || "");
  const startDate = String(plan.shippingStartDate || "");
  const endDate = String(plan.shippingEndDate || "");

  if (isHomeAlertIsoDate(shippingDate)) {
    return shippingDate >= today;
  }

  if (isHomeAlertIsoDate(startDate) && isHomeAlertIsoDate(endDate)) {
    return endDate >= today;
  }

  return false;
}

function getHomeAlertSalesPlanStartDate(plan) {
  if (!plan) return "";
  const shippingDate = String(plan.shippingDate || "");
  const startDate = String(plan.shippingStartDate || "");

  if (isHomeAlertIsoDate(shippingDate)) return shippingDate;
  if (isHomeAlertIsoDate(startDate)) return startDate;
  return "";
}

function isHomeAlertIsoDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));
}

function formatHomeAlertIsoDate(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")
  ].join("-");
}

function getHomeAlertNonNegativeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function getHomeAlertNonNegativeInteger(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : 0;
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
            <div class="home-alert-item ${row.isBackorder ? "home-alert-item-backorder" : ""}">
              <div>
                <strong>
                  ${escapeHomeAlertHtml(
                    row.productCode ||
                    row.internalCode ||
                    "コード未登録"
                  )}
                  ${row.isBackorder ? '<em class="home-alert-backorder-badge">注残</em>' : ""}
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


function renderHomeSalesPlanStockAlert(box, data) {
  const count = Number(data && data.count || 0);
  const total = Number(data && data.totalShortage || 0);
  const rows = Array.isArray(data && data.rows) ? data.rows : [];

  box.className = "home-alert-card home-alert-sales-plan";

  if (count <= 0) {
    box.classList.add("home-alert-card-ok");
    box.innerHTML = `
      <div class="home-alert-card-title">
        <span>📅</span>
        <strong>販売予定の在庫確認</strong>
      </div>
      <div class="home-alert-zero">
        <strong>0商品</strong>
        <span>現在庫＋発注残で、登録済みの今後の販売予定数量をまかなえます。</span>
      </div>
      <button
        type="button"
        class="home-alert-open-button home-alert-open-sales-plan"
        data-home-alert-action="sales-plan"
      >
        販売予定一覧を見る
      </button>
    `;
    bindHomeAlertButtons(box);
    return;
  }

  box.innerHTML = `
    <div class="home-alert-card-title">
      <span>📅</span>
      <strong>販売予定に対して在庫不足</strong>
    </div>
    <div class="home-alert-count-row">
      <strong>${count.toLocaleString("ja-JP")}商品</strong>
      <span>不足合計 ${total.toLocaleString("ja-JP")}個</span>
    </div>
    <p class="home-alert-schedule-name">
      判定：今後の販売予定合計 ＞ 現在庫＋発注残
    </p>
    <div class="home-alert-item-list">
      ${rows.slice(0, 5).map(function (row) {
        const code = row.productCode || row.internalCode || "-";
        const nextDate = row.nextShippingDate
          ? formatHomeAlertPrintDate(row.nextShippingDate)
          : "日付未設定";
        return `
          <div class="home-alert-item home-alert-item-sales-plan">
            <div>
              <strong>${escapeHomeAlertHtml(code)}</strong>
              <span>${escapeHomeAlertHtml(row.productName || "商品名未登録")}</span>
              <small>
                予定 ${Number(row.plannedQuantity || 0).toLocaleString("ja-JP")}個 / 在庫＋発注残 ${Number(row.availableQuantity || 0).toLocaleString("ja-JP")}個 / 最短 ${escapeHomeAlertHtml(nextDate)}
              </small>
            </div>
            <b>不足 ${Number(row.shortage || 0).toLocaleString("ja-JP")}個</b>
          </div>
        `;
      }).join("")}
    </div>
    ${rows.length > 5
      ? `<p class="home-alert-more">ほか ${(rows.length - 5).toLocaleString("ja-JP")}商品</p>`
      : ""}
    <button
      type="button"
      class="home-alert-open-button home-alert-open-sales-plan"
      data-home-alert-action="sales-plan"
    >
      販売予定一覧を見る
    </button>
  `;

  bindHomeAlertButtons(box);
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

            if (
              action ===
              "sales-plan"
            ) {
              const button =
                document.querySelector(
                  "#show-sales-plan-list-button"
                );

              if (button) {
                button.click();
              } else {
                document.querySelector(
                  "#show-sales-plan-button"
                )?.click();
              }
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
        getHomeShippingAlertData(),
        getHomeSalesPlanStockAlertData()
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
      results[2].status ===
      "fulfilled"
    ) {
      homeAlertLatestSalesPlanData =
        results[2].value;
    }

    if (
      !homeAlertLatestPurchaseData &&
      !homeAlertLatestShippingData &&
      !homeAlertLatestSalesPlanData
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

  const salesPlanCount =
    Number(
      homeAlertLatestSalesPlanData &&
      homeAlertLatestSalesPlanData.count ||
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
            発注 ${purchaseCount.toLocaleString("ja-JP")}商品 / 船積 ${shippingCount.toLocaleString("ja-JP")}商品 / 販売予定不足 ${salesPlanCount.toLocaleString("ja-JP")}商品
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
        <button
          type="button"
          class="home-alert-print-choice home-alert-print-choice-sales-plan"
          data-home-alert-print-mode="sales-plan"
        >
          <strong>販売予定不足のみ</strong>
          <span>
            ${salesPlanCount.toLocaleString("ja-JP")}商品
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
      "shipping",
      "sales-plan"
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
        : normalizedMode === "sales-plan"
          ? "販売予定 在庫不足 一覧"
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

  if (
    normalizedMode === "all" ||
    normalizedMode === "sales-plan"
  ) {
    sections.push(
      createHomeSalesPlanPrintSection(
        homeAlertLatestSalesPlanData,
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

    .print-section-sales-plan .print-section-title {
      background: #e3f2fd;
      border-left-color: #1976d2;
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

    .sales-plan-alert-table th:nth-child(1),
    .sales-plan-alert-table td:nth-child(1) { width: 5%; }
    .sales-plan-alert-table th:nth-child(2),
    .sales-plan-alert-table td:nth-child(2) { width: 10%; }
    .sales-plan-alert-table th:nth-child(3),
    .sales-plan-alert-table td:nth-child(3) { width: 12%; }
    .sales-plan-alert-table th:nth-child(4),
    .sales-plan-alert-table td:nth-child(4) { width: 25%; }
    .sales-plan-alert-table th:nth-child(5),
    .sales-plan-alert-table td:nth-child(5) { width: 12%; }
    .sales-plan-alert-table th:nth-child(6),
    .sales-plan-alert-table td:nth-child(6) { width: 12%; }
    .sales-plan-alert-table th:nth-child(7),
    .sales-plan-alert-table td:nth-child(7) { width: 12%; }
    .sales-plan-alert-table th:nth-child(8),
    .sales-plan-alert-table td:nth-child(8) { width: 12%; }

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


function createHomeSalesPlanPrintSection(data, pageBreak) {
  const safeData = data || {};
  const rows = Array.isArray(safeData.rows) ? safeData.rows : [];
  const count = Number(safeData.count || rows.length || 0);
  const total = Number(safeData.totalShortage || 0);

  const body = rows.length > 0
    ? `
      <table class="sales-plan-alert-table">
        <thead>
          <tr>
            <th>No.</th>
            <th>社内コード</th>
            <th>商品コード</th>
            <th>商品名</th>
            <th>販売予定</th>
            <th>現在庫</th>
            <th>発注残</th>
            <th>不足数</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(function (row, index) {
            return `
              <tr>
                <td class="center">${index + 1}</td>
                <td>${escapeHomeAlertHtml(row.internalCode || "-")}</td>
                <td>${escapeHomeAlertHtml(row.productCode || "-")}</td>
                <td>${escapeHomeAlertHtml(row.productName || "商品名未登録")}</td>
                <td class="number">${formatHomeAlertPrintQuantity(row.plannedQuantity)}個</td>
                <td class="number">${formatHomeAlertPrintQuantity(row.currentStock)}個</td>
                <td class="number">${formatHomeAlertPrintQuantity(row.orderRemaining)}個</td>
                <td class="number shortage">${formatHomeAlertPrintQuantity(row.shortage)}個</td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
    `
    : `<div class="print-empty">現在、販売予定に対する在庫不足はありません。</div>`;

  return `
    <section class="print-section print-section-sales-plan${pageBreak ? " page-break" : ""}">
      <div class="print-section-title">
        <h2>📅 販売予定に対して在庫不足</h2>
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

    @media (min-width: 1180px) {
      body[data-resolved-display-mode="pc"]
        #home-alert-panel:not([hidden]) {
        position: fixed;
        z-index: 500;
        top: 108px;
        right: 16px;
        display: block;
        width: min(420px, calc(100vw - 32px));
        min-width: 380px;
        max-height: calc(100vh - 132px);
        box-sizing: border-box;
        overflow-y: auto;
        padding: 15px;
        border: 1px solid #cfd8dc;
        border-radius: 16px;
        background: rgba(255, 255, 255, 0.97);
        box-shadow:
          0 8px 28px rgba(31, 54, 77, 0.15);
        backdrop-filter: blur(8px);
        transition:
          width 0.2s ease,
          min-width 0.2s ease,
          padding 0.2s ease;
      }

      body[data-resolved-display-mode="pc"]
        #home-alert-panel.is-collapsed:not([hidden]) {
        width: 112px;
        min-width: 112px;
        max-height: none;
        overflow: visible;
        padding: 0;
        border: 0;
        background: transparent;
        box-shadow: none;
        backdrop-filter: none;
      }
    }

    .home-alert-expanded-content {
      display: grid;
      gap: 12px;
    }

    .home-alert-compact-toggle {
      display: none;
    }

    #home-alert-panel.is-collapsed
      .home-alert-expanded-content {
      display: none;
    }

    #home-alert-panel.is-collapsed
      .home-alert-compact-toggle {
      position: relative;
      display: grid;
      width: 112px;
      min-height: 176px;
      margin: 0;
      padding: 12px 8px;
      place-items: center;
      align-content: center;
      gap: 6px;
      border: 2px solid #ffb74d;
      border-radius: 14px 0 0 14px;
      background: rgba(255, 250, 243, 0.98);
      color: #e65100;
      box-shadow: 0 6px 22px rgba(31, 54, 77, 0.16);
      font-size: 13px;
      line-height: 1.25;
    }

    #home-alert-panel.is-collapsed
      .home-alert-compact-toggle:hover {
      filter: brightness(0.98);
      transform: translateX(-2px);
    }

    .home-alert-compact-icon {
      font-size: 27px;
      line-height: 1;
    }

    .home-alert-compact-toggle strong {
      font-size: 16px;
      white-space: nowrap;
    }

    .home-alert-compact-count {
      display: block;
      width: 100%;
      padding: 4px 5px;
      border-radius: 7px;
      background: #ffffff;
      color: #455a64;
      font-size: 11px;
      font-weight: 800;
      white-space: nowrap;
    }

    .home-alert-compact-shipping {
      color: #6a1b9a;
    }

    .home-alert-compact-sales-plan {
      color: #1565c0;
    }

    .home-alert-unread-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 24px;
      padding: 4px 7px;
      border-radius: 999px;
      background: #d32f2f;
      color: #ffffff;
      font-size: 10px;
      font-weight: 900;
      white-space: nowrap;
      animation: homeAlertUnreadPulse 1.6s ease-in-out infinite;
    }

    .home-alert-unread-badge[hidden] {
      display: none !important;
    }

    @keyframes homeAlertUnreadPulse {
      0%, 100% {
        box-shadow: 0 0 0 0 rgba(211, 47, 47, 0.30);
      }
      50% {
        box-shadow: 0 0 0 6px rgba(211, 47, 47, 0);
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

    #home-alert-panel
      .home-alert-collapse-button {
      min-height: 36px;
      margin: 0;
      padding: 7px 10px;
      border: 1px solid #cfd8dc;
      border-radius: 9px;
      background: #ffffff;
      color: #455a64;
      font-size: 12px;
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

    .home-alert-item-backorder {
      border: 2px solid #f9a825;
      background: #fff8d7;
      box-shadow: 0 0 0 1px rgba(249, 168, 37, 0.08);
    }

    .home-alert-backorder-badge {
      display: inline-flex;
      align-items: center;
      margin-left: 6px;
      padding: 2px 6px;
      border: 1px solid #f9a825;
      border-radius: 999px;
      background: #fff176;
      color: #5d4a00;
      font-size: 10px;
      font-style: normal;
      font-weight: 900;
      vertical-align: middle;
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


    .home-alert-update-toast {
      position: fixed;
      z-index: 5500;
      top: 116px;
      left: 50%;
      display: grid;
      grid-template-columns: auto minmax(0, 1fr) auto auto;
      align-items: center;
      gap: 10px;
      width: min(620px, calc(100vw - 36px));
      padding: 12px 13px;
      border: 2px solid #ffb74d;
      border-radius: 14px;
      background: rgba(255, 255, 255, 0.98);
      box-shadow: 0 12px 36px rgba(31, 54, 77, 0.24);
      transform: translate(-50%, -18px);
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.2s ease, transform 0.2s ease;
    }

    .home-alert-update-toast[hidden] {
      display: none !important;
    }

    .home-alert-update-toast.is-visible {
      transform: translate(-50%, 0);
      opacity: 1;
      pointer-events: auto;
    }

    .home-alert-update-toast-icon {
      font-size: 26px;
      line-height: 1;
    }

    .home-alert-update-toast-body {
      min-width: 0;
    }

    .home-alert-update-toast-body strong,
    .home-alert-update-toast-body span {
      display: block;
    }

    .home-alert-update-toast-body strong {
      color: #bf360c;
      font-size: 15px;
    }

    .home-alert-update-toast-body span {
      margin-top: 3px;
      color: #546e7a;
      font-size: 12px;
      font-weight: 700;
    }

    .home-alert-update-toast-open {
      min-height: 38px;
      margin: 0;
      padding: 8px 13px;
      border-radius: 9px;
      background: #1565c0;
      font-size: 13px;
      white-space: nowrap;
    }

    .home-alert-update-toast-close {
      min-width: 34px;
      min-height: 34px;
      margin: 0;
      padding: 5px;
      border-radius: 50%;
      background: #eceff1;
      color: #546e7a;
      font-size: 20px;
      line-height: 1;
    }

    @media (max-width: 760px) {
      .home-alert-update-toast {
        grid-template-columns: auto minmax(0, 1fr) auto;
      }

      .home-alert-update-toast-open {
        grid-column: 1 / -1;
        width: 100%;
      }
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
