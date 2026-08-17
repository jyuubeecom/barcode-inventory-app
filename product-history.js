"use strict";

let selectedProductHistoryInternalCode = "";

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
      <tr>
        <td colspan="8">
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

  count.textContent =
    `この商品の在庫履歴：${movements.length}件`;
  body.innerHTML = "";

  if (movements.length === 0) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 8;
    cell.textContent =
      "この商品の在庫履歴はまだありません。";
    row.appendChild(cell);
    body.appendChild(row);
    return;
  }

  movements.forEach(function (movement) {
    const row = document.createElement("tr");
    row.classList.add(
      getProductHistoryRowClass(
        movement.type
      )
    );

    appendProductHistoryCell(
      row,
      formatProductHistoryDateTime(
        movement.dateTime
      )
    );

    const typeCell =
      appendProductHistoryCell(
        row,
        movement.type || "未登録"
      );
    typeCell.classList.add(
      "product-history-type"
    );

    const quantityCell =
      appendProductHistoryCell(
        row,
        formatProductHistoryQuantity(
          movement
        )
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
      )
    );

    appendProductHistoryCell(
      row,
      formatProductHistoryLocation(
        movement
      )
    );

    appendProductHistoryCell(
      row,
      movement.person || "未入力"
    );

    appendProductHistoryCell(
      row,
      movement.reason || "未入力"
    );

    appendProductHistoryCell(
      row,
      movement.memo || ""
    );

    body.appendChild(row);
  });
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
      <tr>
        <td colspan="8">
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
    sourceLocation &&
    destinationLocation
  ) {
    return (
      `${sourceLocation} → ` +
      destinationLocation
    );
  }

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
          quantity > 0 ? "＋" : "－";

        return (
          `${change.location || "保管場所不明"} ` +
          `${sign}${Math.abs(quantity)}個`
        );
      })
      .join(" / ");
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
    return "商品登録時";
  }

  return "記録なし";
}

function getProductHistoryRowClass(type) {
  if (type === "入庫") {
    return "product-history-in";
  }

  if (type === "出庫") {
    return "product-history-out";
  }

  if (type === "移動") {
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
  text
) {
  const cell = document.createElement("td");
  cell.textContent = String(text ?? "");
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
