"use strict";

let selectedProductHistoryInternalCode = "";
let allProductHistoryMovements = [];
let productHistoryFilter = "all";

window.addEventListener(
  "DOMContentLoaded",
  initializeProductHistoryFeature
);

function initializeProductHistoryFeature() {
  const openButton =
    document.querySelector(
      "#product-history-from-detail-button"
    );

  const backButton =
    document.querySelector(
      "#back-detail-from-product-history"
    );

  if (openButton) {
    openButton.addEventListener(
      "click",
      openSelectedProductHistory
    );
  }

  document
    .querySelectorAll(
      "[data-product-history-filter]"
    )
    .forEach(function (button) {
      button.addEventListener(
        "click",
        function () {
          productHistoryFilter =
            button.dataset.productHistoryFilter ||
            "all";

          updateProductHistoryFilterButtons();
          renderProductHistoryRows(
            allProductHistoryMovements
          );
        }
      );
    });

  if (backButton) {
    backButton.addEventListener(
      "click",
      function () {
        if (
          selectedProductHistoryInternalCode &&
          window.inventoryApp &&
          typeof window.inventoryApp.openDetailScreen ===
            "function"
        ) {
          window.inventoryApp.openDetailScreen(
            selectedProductHistoryInternalCode
          );
          return;
        }

        if (
          window.inventoryApp &&
          typeof window.inventoryApp.showScreen ===
            "function"
        ) {
          window.inventoryApp.showScreen(
            "list"
          );
        }
      }
    );
  }
}

async function openSelectedProductHistory() {
  if (
    !window.inventoryApp ||
    typeof window.inventoryApp.getSelectedDetailInternalCode !==
      "function"
  ) {
    return;
  }

  const internalCode = String(
    window.inventoryApp.getSelectedDetailInternalCode() || ""
  ).trim();

  if (!internalCode) {
    await showProductHistoryDialog({
      type: "warning",
      icon: "⚠️",
      title: "商品が選択されていません",
      message:
        "商品詳細画面から、在庫履歴を確認する商品を選んでください。",
      confirmText: "閉じる"
    });
    return;
  }

  await openProductStockHistory(
    internalCode
  );
}

async function openProductStockHistory(
  internalCode
) {
  const product =
    window.inventoryApp &&
    typeof window.inventoryApp.getProductByInternalCode ===
      "function"
      ? window.inventoryApp.getProductByInternalCode(
          internalCode
        )
      : null;

  if (!product) {
    await showProductHistoryDialog({
      type: "danger",
      icon: "🔎",
      title: "商品情報が見つかりません",
      message:
        "在庫履歴を表示する商品を確認できませんでした。",
      details: [
        {
          label: "社内コード",
          value: internalCode || "未指定"
        }
      ],
      confirmText: "閉じる"
    });
    return;
  }

  selectedProductHistoryInternalCode =
    product.internalCode;

  renderProductHistoryHeader(product);
  renderProductHistoryLoading();

  window.inventoryApp.showScreen(
    "productHistory"
  );

  moveToProductHistoryScreen();

  try {
    const movements =
      await getAllStockMovements();

    const productMovements =
      (Array.isArray(movements)
        ? movements
        : []
      )
        .filter(function (movement) {
          return (
            String(
              movement &&
                movement.internalCode ||
                ""
            ).trim() ===
            String(
              product.internalCode || ""
            ).trim()
          );
        })
        .sort(function (left, right) {
          return (
            getMovementTime(right) -
            getMovementTime(left)
          );
        });

    allProductHistoryMovements =
      productMovements;
    productHistoryFilter = "all";

    updateProductHistoryFilterButtons();
    renderProductHistorySummary(
      productMovements
    );
    renderProductHistoryRows(
      productMovements
    );
  } catch (error) {
    console.error(
      "商品別在庫履歴 読込エラー",
      error
    );

    renderProductHistoryError();

    await showProductHistoryDialog({
      type: "danger",
      icon: "⚠️",
      title: "在庫履歴を読み込めませんでした",
      message:
        "この商品の入出庫履歴を読み込めませんでした。画面を更新して、もう一度お試しください。",
      confirmText: "閉じる"
    });
  }
}

function renderProductHistoryHeader(product) {
  setProductHistoryText(
    "#product-history-product-name",
    product.productName || "未登録"
  );

  setProductHistoryText(
    "#product-history-internal-code",
    product.internalCode || "未登録"
  );

  setProductHistoryText(
    "#product-history-product-code",
    product.productCode || "未登録"
  );

  setProductHistoryText(
    "#product-history-current-stock",
    `${Number(product.stock || 0)}個`
  );

  const locationStocks =
    typeof getProductLocationStocks ===
      "function"
      ? getProductLocationStocks(product)
      : [];

  const locationText =
    locationStocks.length > 0
      ? locationStocks
          .map(function (entry) {
            return (
              `${entry.location}：` +
              `${Number(entry.stock || 0)}個`
            );
          })
          .join(" / ")
      : product.location
        ? `${product.location}：${Number(product.stock || 0)}個`
        : "未登録";

  setProductHistoryText(
    "#product-history-location-stocks",
    locationText
  );
}

function renderProductHistoryLoading() {
  const count =
    document.querySelector(
      "#product-history-count"
    );
  const body =
    document.querySelector(
      "#product-history-body"
    );

  if (count) {
    count.textContent =
      "履歴を読み込んでいます。";
  }

  if (body) {
    body.innerHTML = `
      <tr class="product-history-empty-row">
        <td colspan="7">
          履歴を読み込んでいます。
        </td>
      </tr>
    `;
  }
}

function renderProductHistoryRows(movements) {
  const count =
    document.querySelector(
      "#product-history-count"
    );
  const body =
    document.querySelector(
      "#product-history-body"
    );

  if (!count || !body) {
    return;
  }

  const sourceMovements =
    Array.isArray(movements)
      ? movements
      : [];

  const visibleMovements =
    sourceMovements.filter(
      function (movement) {
        return matchesProductHistoryFilter(
          movement,
          productHistoryFilter
        );
      }
    );

  const filterLabel =
    getProductHistoryFilterLabel(
      productHistoryFilter
    );

  count.textContent =
    productHistoryFilter === "all"
      ? `この商品の在庫履歴：${visibleMovements.length}件`
      : `${filterLabel}：${visibleMovements.length}件 / 全${sourceMovements.length}件`;

  body.innerHTML = "";

  if (visibleMovements.length === 0) {
    const row = document.createElement("tr");
    row.className =
      "product-history-empty-row";

    const cell = document.createElement("td");
    cell.colSpan = 7;
    cell.textContent =
      productHistoryFilter === "all"
        ? "この商品の在庫履歴はまだありません。"
        : `「${filterLabel}」に該当する履歴はありません。`;

    row.appendChild(cell);
    body.appendChild(row);
    return;
  }

  visibleMovements.forEach(
    function (movement) {
      const row =
        document.createElement("tr");

      row.classList.add(
        getProductHistoryRowClass(
          movement.type
        )
      );

      appendProductHistoryDateTimeCell(
        row,
        movement.dateTime
      );

      appendProductHistoryTypeCell(
        row,
        movement
      );

      const quantityCell =
        appendProductHistoryCell(
          row,
          formatProductHistoryQuantity(
            movement
          ),
          "数量"
        );

      quantityCell.classList.add(
        getProductHistoryQuantityClass(
          movement
        )
      );

      appendProductHistoryCell(
        row,
        formatProductHistoryStockChange(
          movement
        ),
        "総在庫"
      );

      appendProductHistoryCell(
        row,
        formatProductHistoryLocation(
          movement
        ),
        "保管場所・移動"
      );

      appendProductHistoryPersonReasonCell(
        row,
        movement
      );

      appendProductHistoryCell(
        row,
        movement.memo || "－",
        "メモ"
      );

      body.appendChild(row);
    }
  );
}

function renderProductHistorySummary(
  movements
) {
  const source =
    Array.isArray(movements)
      ? movements
      : [];

  const counts = {
    all: source.length,
    registration: 0,
    in: 0,
    out: 0,
    adjust: 0,
    transfer: 0
  };

  source.forEach(function (movement) {
    const group =
      getProductHistoryGroup(
        movement
      );

    if (counts[group] !== undefined) {
      counts[group] += 1;
    }
  });

  setProductHistoryText(
    "#product-history-summary-all",
    `${counts.all}件`
  );
  setProductHistoryText(
    "#product-history-summary-registration",
    `${counts.registration}件`
  );
  setProductHistoryText(
    "#product-history-summary-in",
    `${counts.in}件`
  );
  setProductHistoryText(
    "#product-history-summary-out",
    `${counts.out}件`
  );
  setProductHistoryText(
    "#product-history-summary-adjust",
    `${counts.adjust}件`
  );
  setProductHistoryText(
    "#product-history-summary-transfer",
    `${counts.transfer}件`
  );
}

function updateProductHistoryFilterButtons() {
  document
    .querySelectorAll(
      "[data-product-history-filter]"
    )
    .forEach(function (button) {
      const isActive =
        button.dataset.productHistoryFilter ===
        productHistoryFilter;

      button.classList.toggle(
        "is-active",
        isActive
      );

      button.setAttribute(
        "aria-pressed",
        isActive ? "true" : "false"
      );
    });
}

function matchesProductHistoryFilter(
  movement,
  filter
) {
  if (!filter || filter === "all") {
    return true;
  }

  return (
    getProductHistoryGroup(movement) ===
    filter
  );
}

function getProductHistoryFilterLabel(
  filter
) {
  if (filter === "registration") {
    return "初期登録";
  }

  if (filter === "in") {
    return "入庫";
  }

  if (filter === "out") {
    return "出庫";
  }

  if (filter === "adjust") {
    return "調整・棚卸";
  }

  if (filter === "transfer") {
    return "商品移動";
  }

  return "すべて";
}

function getProductHistoryGroup(
  movement
) {
  const type =
    String(
      movement &&
        movement.type ||
        ""
    ).trim();

  if (type === "初期登録") {
    return "registration";
  }

  if (
    type.includes("移動")
  ) {
    return "transfer";
  }

  if (
    type.includes("入庫")
  ) {
    return "in";
  }

  if (
    type.includes("出庫") ||
    type.includes("販売")
  ) {
    return "out";
  }

  return "adjust";
}

function appendProductHistoryDateTimeCell(
  row,
  value
) {
  const cell =
    document.createElement("td");

  cell.dataset.label = "日時";
  cell.className =
    "product-history-datetime";

  const date =
    value ? new Date(value) : null;

  if (
    !date ||
    Number.isNaN(date.getTime())
  ) {
    cell.textContent =
      value || "記録なし";
    row.appendChild(cell);
    return cell;
  }

  const dateLine =
    document.createElement("strong");
  dateLine.textContent =
    date.toLocaleDateString("ja-JP");

  const timeLine =
    document.createElement("span");
  timeLine.textContent =
    date.toLocaleTimeString(
      "ja-JP",
      {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
      }
    );

  cell.appendChild(dateLine);
  cell.appendChild(timeLine);
  row.appendChild(cell);

  return cell;
}

function appendProductHistoryTypeCell(
  row,
  movement
) {
  const cell =
    document.createElement("td");
  cell.dataset.label = "内容";
  cell.className =
    "product-history-type";

  const badge =
    document.createElement("span");
  badge.className =
    "product-history-type-badge";

  const group =
    getProductHistoryGroup(
      movement
    );

  badge.classList.add(
    `product-history-type-${group}`
  );

  badge.textContent =
    movement.type || "未登録";

  cell.appendChild(badge);
  row.appendChild(cell);

  return cell;
}

function appendProductHistoryPersonReasonCell(
  row,
  movement
) {
  const cell =
    document.createElement("td");

  cell.dataset.label =
    "担当者・理由";
  cell.className =
    "product-history-person-reason";

  const person =
    document.createElement("strong");
  person.textContent =
    movement.person || "未入力";

  const reason =
    document.createElement("span");
  reason.textContent =
    movement.reason
      ? `理由：${movement.reason}`
      : "理由：未入力";

  cell.appendChild(person);
  cell.appendChild(reason);
  row.appendChild(cell);

  return cell;
}

function renderProductHistoryError() {
  const count =
    document.querySelector(
      "#product-history-count"
    );
  const body =
    document.querySelector(
      "#product-history-body"
    );

  if (count) {
    count.textContent =
      "在庫履歴を読み込めませんでした。";
  }

  if (body) {
    body.innerHTML = `
      <tr class="product-history-empty-row">
        <td colspan="7">
          在庫履歴の読み込みでエラーが発生しました。
        </td>
      </tr>
    `;
  }
}

function formatProductHistoryQuantity(
  movement
) {
  const quantity = Number(
    movement && movement.quantity || 0
  );
  const type = String(
    movement && movement.type || ""
  );

  if (type === "出庫") {
    return `－${Math.abs(quantity)}個`;
  }

  if (
    type === "入庫" ||
    type === "初期登録"
  ) {
    return `＋${Math.abs(quantity)}個`;
  }

  if (type === "移動") {
    return `${Math.abs(quantity)}個移動`;
  }

  if (quantity > 0) {
    return `＋${quantity}個`;
  }

  if (quantity < 0) {
    return `－${Math.abs(quantity)}個`;
  }

  return "0個";
}

function formatProductHistoryStockChange(
  movement
) {
  const beforeStock = Number(
    movement && movement.beforeStock || 0
  );
  const afterStock = Number(
    movement && movement.afterStock || 0
  );

  return (
    `${beforeStock}個 → ` +
    `${afterStock}個`
  );
}

function formatProductHistoryLocation(
  movement
) {
  if (!movement) {
    return "記録なし";
  }

  const sourceLocation = String(
    movement.sourceLocation || ""
  ).trim();
  const destinationLocation = String(
    movement.destinationLocation || ""
  ).trim();

  if (
    Array.isArray(
      movement.locationChanges
    ) &&
    movement.locationChanges.length > 0
  ) {
    return movement.locationChanges
      .map(function (change) {
        const quantity = Number(
          change && change.change || 0
        );
        const sign =
          quantity > 0
            ? "＋"
            : quantity < 0
              ? "－"
              : "±";

        const locationName =
          change.location ||
          "保管場所不明";

        if (
          change.beforeStock !== undefined &&
          change.afterStock !== undefined
        ) {
          return (
            `${locationName}：` +
            `${Number(change.beforeStock || 0)}個 → ` +
            `${Number(change.afterStock || 0)}個 ` +
            `(${sign}${Math.abs(quantity)}個)`
          );
        }

        return (
          `${locationName} ` +
          `${sign}${Math.abs(quantity)}個`
        );
      })
      .join(" / ");
  }

  if (
    sourceLocation &&
    destinationLocation
  ) {
    return (
      `${sourceLocation} → ` +
      `${destinationLocation} ` +
      "（場所別在庫の変更前後は旧履歴のため記録なし）"
    );
  }

  const location = String(
    movement.location || ""
  ).trim();

  if (
    location &&
    movement.beforeLocationStock !==
      undefined &&
    movement.afterLocationStock !==
      undefined
  ) {
    return (
      `${location}：` +
      `${Number(movement.beforeLocationStock || 0)}個 → ` +
      `${Number(movement.afterLocationStock || 0)}個`
    );
  }

  const stocktakingLocation = String(
    movement.stocktakingLocation || ""
  ).trim();

  if (stocktakingLocation) {
    return `棚卸：${stocktakingLocation}`;
  }

  if (location) {
    return location;
  }

  if (movement.type === "初期登録") {
    return "商品登録時（保管場所記録なし）";
  }

  return "保管場所記録なし";
}

function getProductHistoryRowClass(type) {
  const group =
    getProductHistoryGroup({
      type: type
    });

  if (group === "registration") {
    return "product-history-registration";
  }

  if (group === "in") {
    return "product-history-in";
  }

  if (group === "out") {
    return "product-history-out";
  }

  if (group === "transfer") {
    return "product-history-transfer";
  }

  return "product-history-other";
}

function getProductHistoryQuantityClass(
  movement
) {
  const type = String(
    movement && movement.type || ""
  );
  const quantity = Number(
    movement && movement.quantity || 0
  );

  if (type === "移動") {
    return "product-history-qty-transfer";
  }

  if (type === "出庫" || quantity < 0) {
    return "product-history-qty-minus";
  }

  if (
    type === "入庫" ||
    type === "初期登録" ||
    quantity > 0
  ) {
    return "product-history-qty-plus";
  }

  return "";
}

function appendProductHistoryCell(
  row,
  text,
  label
) {
  const cell =
    document.createElement("td");

  if (label) {
    cell.dataset.label = label;
  }

  cell.textContent =
    String(text ?? "");
  row.appendChild(cell);
  return cell;
}

function setProductHistoryText(
  selector,
  text
) {
  const element =
    document.querySelector(selector);

  if (element) {
    element.textContent = String(
      text ?? ""
    );
  }
}

function getMovementTime(movement) {
  const time = new Date(
    movement && movement.dateTime || ""
  ).getTime();

  return Number.isNaN(time)
    ? 0
    : time;
}

function formatProductHistoryDateTime(value) {
  if (!value) {
    return "記録なし";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleString("ja-JP");
}

function moveToProductHistoryScreen() {
  window.requestAnimationFrame(
    function () {
      document
        .querySelector(
          "#product-stock-history"
        )
        ?.scrollIntoView({
          behavior: "smooth",
          block: "start"
        });
    }
  );
}

function showProductHistoryDialog(options) {
  if (
    window.inventoryApp &&
    typeof window.inventoryApp.showAppDialog ===
      "function"
  ) {
    return window.inventoryApp.showAppDialog(
      options || {}
    );
  }

  window.alert(
    options && options.message
      ? options.message
      : "処理を確認できませんでした。"
  );

  return Promise.resolve(true);
}
