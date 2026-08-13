"use strict";

window.addEventListener("DOMContentLoaded", initializeShippingArrivalFeature);

function initializeShippingArrivalFeature() {
  createShippingArrivalStyle();

  const checkButton = document.querySelector("#check-shipping-arrivals-button");
  if (checkButton) {
    checkButton.addEventListener("click", function () {
      checkAndReflectDueShippingArrivals({ showMessageWhenNone: true });
    });
  }

  [
    "#show-shipping-schedule-button",
    "#show-shipping-allocation-button",
    "#show-shipping-warehouse-allocation-button"
  ].forEach(function (selector) {
    document.querySelector(selector)?.addEventListener("click", function () {
      window.setTimeout(refreshShippingArrivalStatus, 300);
    });
  });

  window.setTimeout(function () {
    checkAndReflectDueShippingArrivals({ showMessageWhenNone: false });
  }, 900);
}

async function checkAndReflectDueShippingArrivals(options) {
  const settings = options || {};
  const button = document.querySelector("#check-shipping-arrivals-button");
  if (button) {
    button.disabled = true;
    button.textContent = "到着済み船便を確認しています...";
  }

  try {
    const [schedules, allocations, receipts, products] = await Promise.all([
      getAllShippingSchedules(),
      getAllShippingAllocations(),
      getAllShippingArrivalReceipts(),
      getAllProducts()
    ]);

    const today = getShippingArrivalTodayKey();
    const receivedIds = new Set(receipts.map(function (receipt) {
      return receipt.scheduleId || receipt.id;
    }));
    const productMap = new Map(products.map(function (product) {
      return [String(product.internalCode || "").trim(), product];
    }));

    const dueSchedules = schedules
      .filter(function (schedule) {
        return isShippingArrivalScheduleConfirmed(schedule) &&
          isShippingArrivalIsoDate(schedule.warehouseArrivalDate) &&
          schedule.warehouseArrivalDate <= today &&
          !receivedIds.has(schedule.id) &&
          getShippingArrivalConfirmedItems(schedule, allocations).length > 0;
      })
      .sort(function (a, b) {
        if (a.warehouseArrivalDate !== b.warehouseArrivalDate) {
          return a.warehouseArrivalDate.localeCompare(b.warehouseArrivalDate);
        }
        return String(a.id || "").localeCompare(String(b.id || ""));
      });

    const completed = [];
    const failed = [];

    for (const schedule of dueSchedules) {
      const scheduleAllocations = getShippingArrivalConfirmedItems(schedule, allocations);
      const grouped = groupShippingArrivalAllocations(scheduleAllocations);
      const missingCodes = grouped
        .map(function (item) { return item.internalCode; })
        .filter(function (code) { return !productMap.has(code); });

      if (missingCodes.length > 0) {
        failed.push({
          schedule: schedule,
          reason: `商品マスタにない社内コードがあります：${missingCodes.join(", ")}`
        });
        continue;
      }

      const movementDateTime = createShippingArrivalMovementDateTime(schedule.warehouseArrivalDate);
      const reflectedAt = new Date().toISOString();
      const updatedProducts = [];
      const movements = [];
      const receiptItems = [];

      grouped.forEach(function (item) {
        const product = productMap.get(item.internalCode);
        const beforeStock = Number(product.stock) || 0;
        const afterStock = beforeStock + item.quantity;
        const updatedProduct = {
          ...product,
          stock: afterStock,
          updatedAt: movementDateTime
        };
        const movement = {
          id: createShippingArrivalMovementId(schedule.id, item.internalCode),
          dateTime: movementDateTime,
          internalCode: item.internalCode,
          productCode: product.productCode || item.productCode || "",
          productName: product.productName || item.productName || "",
          janCode: product.janCode || "",
          type: "入庫",
          quantity: item.quantity,
          beforeStock: beforeStock,
          afterStock: afterStock,
          person: "自動反映",
          reason: "船便入荷",
          memo:
            `船便：${schedule.name || schedule.id} / ` +
            `倉庫到着日：${schedule.warehouseArrivalDate} / 自動入荷反映`
        };

        updatedProducts.push(updatedProduct);
        movements.push(movement);
        receiptItems.push({
          internalCode: item.internalCode,
          productCode: movement.productCode,
          productName: movement.productName,
          quantity: item.quantity,
          beforeStock: beforeStock,
          afterStock: afterStock,
          movementId: movement.id
        });
      });

      const totalQuantity = receiptItems.reduce(function (sum, item) {
        return sum + item.quantity;
      }, 0);
      const receipt = {
        id: schedule.id,
        scheduleId: schedule.id,
        scheduleName: schedule.name || "",
        departureDate: schedule.departureDate || "",
        arrivalDate: schedule.arrivalDate || "",
        warehouseArrivalDate: schedule.warehouseArrivalDate,
        reflectedAt: reflectedAt,
        movementDateTime: movementDateTime,
        productCount: receiptItems.length,
        totalQuantity: totalQuantity,
        items: receiptItems
      };

      try {
        await applyShippingArrivalReceipt(updatedProducts, movements, receipt);
        updatedProducts.forEach(function (updatedProduct) {
          productMap.set(String(updatedProduct.internalCode || "").trim(), updatedProduct);
          if (window.inventoryApp && typeof window.inventoryApp.applyUpdatedProduct === "function") {
            window.inventoryApp.applyUpdatedProduct(updatedProduct);
          }
        });
        completed.push(receipt);
      } catch (error) {
        console.error("船便入荷自動反映エラー", schedule, error);
        failed.push({
          schedule: schedule,
          reason: error && error.message ? error.message : "入荷反映処理でエラーが発生しました。"
        });
      }
    }

    await refreshShippingArrivalStatus();

    if (window.shippingScheduleFeature && typeof window.shippingScheduleFeature.refresh === "function") {
      await window.shippingScheduleFeature.refresh();
    }

    if (completed.length > 0 || failed.length > 0) {
      let message = "倉庫到着済み船便の入荷反映を確認しました。\n\n";
      if (completed.length > 0) {
        message += "【自動入荷した船便】\n";
        completed.forEach(function (receipt) {
          message +=
            `・${receipt.scheduleName || receipt.scheduleId}：` +
            `${receipt.productCount.toLocaleString("ja-JP")}商品 / ` +
            `${receipt.totalQuantity.toLocaleString("ja-JP")}個\n`;
        });
      }
      if (failed.length > 0) {
        message += "\n【反映できなかった船便】\n";
        failed.forEach(function (item) {
          message += `・${item.schedule.name || item.schedule.id}：${item.reason}\n`;
        });
      }
      alert(message.trim());
    } else if (settings.showMessageWhenNone) {
      alert("現在、倉庫到着日を迎えていて未反映の船便はありません。");
    }
  } catch (error) {
    console.error("船便入荷確認エラー", error);
    alert("船便の入荷反映状況を確認できませんでした。");
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = "到着済み船便を今すぐ確認する";
    }
  }
}

async function refreshShippingArrivalStatus() {
  const summary = document.querySelector("#shipping-arrival-status-summary");
  const list = document.querySelector("#shipping-arrival-status-list");
  if (!summary || !list) return;

  try {
    const [schedules, allocations, receipts] = await Promise.all([
      getAllShippingSchedules(),
      getAllShippingAllocations(),
      getAllShippingArrivalReceipts()
    ]);
    const receiptMap = new Map(receipts.map(function (receipt) {
      return [receipt.scheduleId || receipt.id, receipt];
    }));
    const today = getShippingArrivalTodayKey();
    const sorted = schedules.slice().sort(function (a, b) {
      const aDate = a.warehouseArrivalDate || "9999-99-99";
      const bDate = b.warehouseArrivalDate || "9999-99-99";
      if (aDate !== bDate) return aDate.localeCompare(bDate);
      return String(a.id || "").localeCompare(String(b.id || ""));
    });

    const reflectedCount = receipts.length;
    const unconfirmedCount = sorted.filter(function (schedule) {
      return !receiptMap.has(schedule.id) && !isShippingArrivalScheduleConfirmed(schedule);
    }).length;
    const duePendingCount = sorted.filter(function (schedule) {
      const quantity = getShippingArrivalConfirmedQuantity(schedule, allocations);
      return isShippingArrivalScheduleConfirmed(schedule) &&
        isShippingArrivalIsoDate(schedule.warehouseArrivalDate) &&
        schedule.warehouseArrivalDate <= today &&
        quantity > 0 &&
        !receiptMap.has(schedule.id);
    }).length;

    summary.textContent =
      `船積未確定：${unconfirmedCount.toLocaleString("ja-JP")}便 / ` +
      `入荷反映済み：${reflectedCount.toLocaleString("ja-JP")}便 / ` +
      `到着済み未反映：${duePendingCount.toLocaleString("ja-JP")}便`;

    list.innerHTML = "";
    if (sorted.length === 0) {
      const empty = document.createElement("div");
      empty.className = "shipping-arrival-empty";
      empty.textContent = "登録されている船便はありません。";
      list.appendChild(empty);
      return;
    }

    sorted.forEach(function (schedule) {
      const confirmed = isShippingArrivalScheduleConfirmed(schedule);
      const quantity = confirmed
        ? getShippingArrivalConfirmedQuantity(schedule, allocations)
        : getShippingArrivalScheduleQuantity(allocations, schedule.id);
      const receipt = receiptMap.get(schedule.id);
      const row = document.createElement("div");
      row.className = "shipping-arrival-status-row";

      const info = document.createElement("div");
      info.className = "shipping-arrival-status-info";
      const name = document.createElement("strong");
      name.textContent = schedule.name || schedule.id;
      const detail = document.createElement("span");
      detail.textContent =
        `倉庫到着日：${formatShippingArrivalDate(schedule.warehouseArrivalDate)} / ` +
        `船積数量：${quantity.toLocaleString("ja-JP")}個`;
      info.appendChild(name);
      info.appendChild(detail);

      const badge = document.createElement("strong");
      badge.className = "shipping-arrival-badge";
      if (receipt) {
        badge.textContent = `入荷反映済 ${Number(receipt.totalQuantity || 0).toLocaleString("ja-JP")}個`;
        badge.classList.add("shipping-arrival-done");
      } else if (!confirmed) {
        badge.textContent = "船積未確定";
        badge.classList.add("shipping-arrival-unconfirmed");
      } else if (!isShippingArrivalIsoDate(schedule.warehouseArrivalDate)) {
        badge.textContent = "日付確認";
        badge.classList.add("shipping-arrival-warning");
      } else if (schedule.warehouseArrivalDate > today) {
        badge.textContent = "船積確定済・到着前";
        badge.classList.add("shipping-arrival-future");
      } else if (quantity <= 0) {
        badge.textContent = "確定済・船積数量なし";
        badge.classList.add("shipping-arrival-warning");
      } else {
        badge.textContent = "確定済・到着済・未反映";
        badge.classList.add("shipping-arrival-warning");
      }

      row.appendChild(info);
      row.appendChild(badge);
      list.appendChild(row);
    });
  } catch (error) {
    console.error("船便入荷状況表示エラー", error);
    summary.textContent = "入荷反映状況を読み込めませんでした。";
  }
}

function isShippingArrivalScheduleConfirmed(schedule) {
  return Boolean(schedule && (schedule.shipmentConfirmed || schedule.shipmentConfirmedAt));
}

function getShippingArrivalConfirmedItems(schedule, allocations) {
  if (!isShippingArrivalScheduleConfirmed(schedule)) return [];
  if (Array.isArray(schedule.shipmentConfirmedItems) && schedule.shipmentConfirmedItems.length > 0) {
    return schedule.shipmentConfirmedItems
      .map(function (item) {
        return {
          internalCode: String(item.internalCode || "").trim(),
          productCode: item.productCode || "",
          productName: item.productName || "",
          quantity: Number(item.quantity) || 0
        };
      })
      .filter(function (item) { return item.internalCode && item.quantity > 0; });
  }
  return getShippingArrivalAllocationsForSchedule(allocations, schedule.id);
}

function getShippingArrivalConfirmedQuantity(schedule, allocations) {
  return getShippingArrivalConfirmedItems(schedule, allocations)
    .reduce(function (sum, item) { return sum + (Number(item.quantity) || 0); }, 0);
}

function getShippingArrivalAllocationsForSchedule(allocations, scheduleId) {
  return allocations.filter(function (allocation) {
    return allocation.scheduleId === scheduleId && Number(allocation.quantity) > 0;
  });
}

function groupShippingArrivalAllocations(allocations) {
  const map = new Map();
  allocations.forEach(function (allocation) {
    const internalCode = String(allocation.internalCode || "").trim();
    const quantity = Number(allocation.quantity) || 0;
    if (!internalCode || quantity <= 0) return;
    const current = map.get(internalCode) || {
      internalCode: internalCode,
      productCode: allocation.productCode || "",
      productName: allocation.productName || "",
      quantity: 0
    };
    current.quantity += quantity;
    map.set(internalCode, current);
  });
  return Array.from(map.values());
}

function getShippingArrivalScheduleQuantity(allocations, scheduleId) {
  return getShippingArrivalAllocationsForSchedule(allocations, scheduleId)
    .reduce(function (sum, allocation) {
      return sum + (Number(allocation.quantity) || 0);
    }, 0);
}

function getShippingArrivalTodayKey() {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0")
  ].join("-");
}

function createShippingArrivalMovementDateTime(dateText) {
  const parts = String(dateText || "").split("-").map(Number);
  if (parts.length !== 3 || parts.some(function (part) { return !Number.isFinite(part); })) {
    return new Date().toISOString();
  }
  return new Date(parts[0], parts[1] - 1, parts[2], 9, 0, 0, 0).toISOString();
}

function createShippingArrivalMovementId(scheduleId, internalCode) {
  return `shipping-arrival-${encodeURIComponent(scheduleId)}-${encodeURIComponent(internalCode)}`;
}

function isShippingArrivalIsoDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));
}

function formatShippingArrivalDate(value) {
  if (!isShippingArrivalIsoDate(value)) return value || "未設定";
  const parts = value.split("-");
  return `${Number(parts[0])}/${Number(parts[1])}/${Number(parts[2])}`;
}

function createShippingArrivalStyle() {
  if (document.querySelector("#shipping-arrival-style")) return;
  const style = document.createElement("style");
  style.id = "shipping-arrival-style";
  style.textContent = `
    #shipping-arrival-status-area {
      margin-top: 16px;
      padding: 16px;
      border: 2px solid #90a4ae;
      border-radius: 12px;
      background: #fafcfd;
    }
    #shipping-arrival-status-area h3 { margin-top: 0; }
    #shipping-arrival-status-area .shipping-arrival-note {
      background: #fff3e0;
      border-radius: 10px;
      padding: 10px 12px;
      line-height: 1.6;
      margin: 10px 0 12px;
    }
    #shipping-arrival-status-summary {
      margin: 12px 0;
      padding: 10px 12px;
      border-radius: 9px;
      background: #e8f6f6;
      font-weight: 700;
    }
    #shipping-arrival-status-list { display: grid; gap: 8px; }
    .shipping-arrival-status-row {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 12px;
      align-items: center;
      padding: 10px 12px;
      border: 1px solid #d5dde2;
      border-radius: 9px;
      background: #fff;
    }
    .shipping-arrival-status-info { display: grid; gap: 3px; }
    .shipping-arrival-status-info span { color: #455a64; }
    .shipping-arrival-badge {
      display: inline-block;
      padding: 6px 10px;
      border-radius: 999px;
      white-space: nowrap;
    }
    .shipping-arrival-done { background: #e8f5e9; color: #2e7d32; }
    .shipping-arrival-future { background: #eceff1; color: #455a64; }
    .shipping-arrival-unconfirmed { background: #ffebee; color: #c62828; }
    .shipping-arrival-warning { background: #fff3e0; color: #ef6c00; }
    .shipping-arrival-empty { padding: 12px; color: #607d8b; }
    @media (max-width: 760px) {
      .shipping-arrival-status-row { grid-template-columns: 1fr; }
      .shipping-arrival-badge { justify-self: start; }
      #check-shipping-arrivals-button { width: 100%; }
    }
  `;
  document.head.appendChild(style);
}

window.shippingArrivalApp = {
  refreshStatus: refreshShippingArrivalStatus,
  checkNow: checkAndReflectDueShippingArrivals
};
