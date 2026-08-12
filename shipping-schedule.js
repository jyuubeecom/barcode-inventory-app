"use strict";

const SHIPPING_SCHEDULE_PAGE_SIZE = 20;
const SHIPPING_ALLOCATION_PAGE_SIZE = 20;
let shippingScheduleRecords = [];
let shippingScheduleAllocations = [];
let shippingScheduleWishes = [];
let shippingScheduleEditingId = "";
let shippingScheduleCurrentPage = 1;
let shippingAllocationCurrentPage = 1;

window.addEventListener("DOMContentLoaded", initializeShippingScheduleFeature);

function initializeShippingScheduleFeature() {
  const showScheduleButton = document.querySelector("#show-shipping-schedule-button");
  const showAllocationButton = document.querySelector("#show-shipping-allocation-button");
  const form = document.querySelector("#shipping-schedule-form");
  const backButton = document.querySelector("#back-home-from-shipping-schedule");
  const cancelEditButton = document.querySelector("#cancel-shipping-schedule-edit-button");
  const jumpFormButton = document.querySelector("#jump-shipping-schedule-form-button");
  const jumpAllocationButton = document.querySelector("#jump-shipping-allocation-button");
  const scheduleSelect = document.querySelector("#shipping-allocation-schedule");
  const allocationSearch = document.querySelector("#shipping-allocation-search");
  const saveVisibleButton = document.querySelector("#save-visible-shipping-allocations");
  const prevSchedule = document.querySelector("#shipping-schedule-prev-page");
  const nextSchedule = document.querySelector("#shipping-schedule-next-page");
  const prevAllocation = document.querySelector("#shipping-allocation-prev-page");
  const nextAllocation = document.querySelector("#shipping-allocation-next-page");

  if (!showScheduleButton || !form) return;

  createShippingScheduleStyle();

  showScheduleButton.addEventListener("click", function () {
    openShippingScheduleScreen("form");
  });
  if (showAllocationButton) {
    showAllocationButton.addEventListener("click", function () {
      openShippingScheduleScreen("allocation");
    });
  }
  if (backButton) backButton.addEventListener("click", closeShippingScheduleScreen);
  if (cancelEditButton) cancelEditButton.addEventListener("click", resetShippingScheduleForm);
  if (jumpFormButton) jumpFormButton.addEventListener("click", scrollShippingScheduleFormIntoView);
  if (jumpAllocationButton) jumpAllocationButton.addEventListener("click", scrollShippingAllocationIntoView);
  form.addEventListener("submit", saveShippingScheduleFromForm);

  if (scheduleSelect) {
    scheduleSelect.addEventListener("change", function () {
      shippingAllocationCurrentPage = 1;
      renderShippingAllocationTable();
    });
  }
  if (allocationSearch) {
    allocationSearch.addEventListener("input", function () {
      shippingAllocationCurrentPage = 1;
      renderShippingAllocationTable();
    });
  }
  if (saveVisibleButton) saveVisibleButton.addEventListener("click", saveVisibleShippingAllocations);

  if (prevSchedule) {
    prevSchedule.addEventListener("click", function () {
      if (shippingScheduleCurrentPage > 1) {
        shippingScheduleCurrentPage -= 1;
        renderShippingScheduleTable();
      }
    });
  }
  if (nextSchedule) {
    nextSchedule.addEventListener("click", function () {
      const totalPages = Math.max(1, Math.ceil(shippingScheduleRecords.length / SHIPPING_SCHEDULE_PAGE_SIZE));
      if (shippingScheduleCurrentPage < totalPages) {
        shippingScheduleCurrentPage += 1;
        renderShippingScheduleTable();
      }
    });
  }
  if (prevAllocation) {
    prevAllocation.addEventListener("click", function () {
      if (shippingAllocationCurrentPage > 1) {
        shippingAllocationCurrentPage -= 1;
        renderShippingAllocationTable();
      }
    });
  }
  if (nextAllocation) {
    nextAllocation.addEventListener("click", function () {
      const totalPages = getShippingAllocationTotalPages();
      if (shippingAllocationCurrentPage < totalPages) {
        shippingAllocationCurrentPage += 1;
        renderShippingAllocationTable();
      }
    });
  }
}

async function openShippingScheduleScreen(target) {
  document.querySelectorAll("main > section").forEach(function (section) {
    section.hidden = true;
  });

  const screen = document.querySelector("#shipping-schedule");
  if (!screen) return;
  screen.hidden = false;

  try {
    await refreshShippingScheduleData();
  } catch (error) {
    console.error("船便スケジュール読込エラー", error);
    alert("船便スケジュールを読み込めませんでした。");
    return;
  }

  if (target === "allocation") scrollShippingAllocationIntoView();
  else scrollShippingScheduleFormIntoView();
}

function closeShippingScheduleScreen() {
  const screen = document.querySelector("#shipping-schedule");
  if (screen) screen.hidden = true;

  if (window.inventoryApp && typeof window.inventoryApp.showScreen === "function") {
    window.inventoryApp.showScreen("home");
  } else {
    const home = document.querySelector("#home");
    if (home) home.hidden = false;
  }
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function scrollShippingScheduleFormIntoView() {
  const target = document.querySelector("#shipping-schedule-form-area");
  if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
}

function scrollShippingAllocationIntoView() {
  const target = document.querySelector("#shipping-allocation-area");
  if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function refreshShippingScheduleData() {
  const results = await Promise.all([
    getAllShippingSchedules(),
    getAllShippingAllocations(),
    getAllShippingWishes()
  ]);
  shippingScheduleRecords = results[0].slice().sort(compareShippingSchedules);
  shippingScheduleAllocations = results[1].slice();
  shippingScheduleWishes = results[2].slice().sort(compareShippingWishesForSchedule);
  renderShippingScheduleTable();
  populateShippingScheduleSelect();
  renderShippingAllocationTable();
}

async function saveShippingScheduleFromForm(event) {
  event.preventDefault();

  const nameInput = document.querySelector("#shipping-schedule-name");
  const departureInput = document.querySelector("#shipping-schedule-departure-date");
  const arrivalInput = document.querySelector("#shipping-schedule-arrival-date");
  const warehouseInput = document.querySelector("#shipping-schedule-warehouse-date");

  const departureDate = departureInput.value;
  const arrivalDate = arrivalInput.value;
  const warehouseArrivalDate = warehouseInput.value;
  let name = nameInput.value.trim();

  if (!departureDate || !arrivalDate || !warehouseArrivalDate) {
    alert("出港日・入港日・倉庫到着日をすべて入力してください。");
    return;
  }
  if (arrivalDate < departureDate) {
    alert("入港日は出港日以降の日付にしてください。");
    arrivalInput.focus();
    return;
  }
  if (warehouseArrivalDate < arrivalDate) {
    alert("倉庫到着日は入港日以降の日付にしてください。");
    warehouseInput.focus();
    return;
  }

  if (!name) name = `${formatShippingDate(departureDate)} 出港便`;

  const now = new Date().toISOString();
  const existing = shippingScheduleEditingId
    ? shippingScheduleRecords.find(function (record) { return record.id === shippingScheduleEditingId; })
    : null;

  const record = {
    id: shippingScheduleEditingId || createShippingScheduleId(),
    name: name,
    departureDate: departureDate,
    arrivalDate: arrivalDate,
    warehouseArrivalDate: warehouseArrivalDate,
    createdAt: existing && existing.createdAt ? existing.createdAt : now,
    updatedAt: now
  };

  try {
    const wasEditing = Boolean(shippingScheduleEditingId);
    if (wasEditing) await updateShippingSchedule(record);
    else await saveShippingSchedule(record);

    resetShippingScheduleForm();
    await refreshShippingScheduleData();
    alert(wasEditing ? "船便スケジュールを変更しました。" : "船便スケジュールを登録しました。");
    scrollShippingScheduleFormIntoView();
  } catch (error) {
    console.error("船便スケジュール保存エラー", error);
    alert("船便スケジュールを保存できませんでした。");
  }
}

function editShippingSchedule(id) {
  const record = shippingScheduleRecords.find(function (item) { return item.id === id; });
  if (!record) return;

  shippingScheduleEditingId = id;
  document.querySelector("#shipping-schedule-name").value = record.name || "";
  document.querySelector("#shipping-schedule-departure-date").value = record.departureDate || "";
  document.querySelector("#shipping-schedule-arrival-date").value = record.arrivalDate || "";
  document.querySelector("#shipping-schedule-warehouse-date").value = record.warehouseArrivalDate || "";
  document.querySelector("#save-shipping-schedule-button").textContent = "変更内容を保存する";
  document.querySelector("#cancel-shipping-schedule-edit-button").hidden = false;
  scrollShippingScheduleFormIntoView();
}

async function removeShippingSchedule(id) {
  const record = shippingScheduleRecords.find(function (item) { return item.id === id; });
  if (!record) return;

  const allocations = shippingScheduleAllocations.filter(function (allocation) {
    return allocation.scheduleId === id && Number(allocation.quantity) > 0;
  });
  const allocatedQuantity = allocations.reduce(function (sum, item) {
    return sum + (Number(item.quantity) || 0);
  }, 0);

  const confirmed = window.confirm(
    `船便「${record.name}」を削除しますか？\n\n` +
    `出港日：${formatShippingDate(record.departureDate)}\n` +
    `振分商品：${allocations.length}件 / ${allocatedQuantity.toLocaleString("ja-JP")}個\n\n` +
    "削除すると、この船便への商品振分けも解除されます。"
  );
  if (!confirmed) return;

  try {
    await deleteShippingScheduleWithAllocations(id);
    if (shippingScheduleEditingId === id) resetShippingScheduleForm();
    await refreshShippingScheduleData();
  } catch (error) {
    console.error("船便削除エラー", error);
    alert("船便を削除できませんでした。");
  }
}

function resetShippingScheduleForm() {
  shippingScheduleEditingId = "";
  const form = document.querySelector("#shipping-schedule-form");
  if (form) form.reset();
  const saveButton = document.querySelector("#save-shipping-schedule-button");
  const cancelButton = document.querySelector("#cancel-shipping-schedule-edit-button");
  if (saveButton) saveButton.textContent = "船便スケジュールを登録する";
  if (cancelButton) cancelButton.hidden = true;
}

function renderShippingScheduleTable() {
  const body = document.querySelector("#shipping-schedule-table-body");
  const summary = document.querySelector("#shipping-schedule-summary");
  const pageStatus = document.querySelector("#shipping-schedule-page-status");
  const prev = document.querySelector("#shipping-schedule-prev-page");
  const next = document.querySelector("#shipping-schedule-next-page");
  if (!body || !summary || !pageStatus) return;

  const totalPages = Math.max(1, Math.ceil(shippingScheduleRecords.length / SHIPPING_SCHEDULE_PAGE_SIZE));
  if (shippingScheduleCurrentPage > totalPages) shippingScheduleCurrentPage = totalPages;
  const start = (shippingScheduleCurrentPage - 1) * SHIPPING_SCHEDULE_PAGE_SIZE;
  const visible = shippingScheduleRecords.slice(start, start + SHIPPING_SCHEDULE_PAGE_SIZE);

  summary.textContent = `登録船便：${shippingScheduleRecords.length}件`;
  body.innerHTML = "";

  if (visible.length === 0) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 8;
    cell.textContent = "船便スケジュールはまだ登録されていません。";
    row.appendChild(cell);
    body.appendChild(row);
  } else {
    visible.forEach(function (record) {
      const allocations = shippingScheduleAllocations.filter(function (allocation) {
        return allocation.scheduleId === record.id && Number(allocation.quantity) > 0;
      });
      const quantity = allocations.reduce(function (sum, allocation) {
        return sum + (Number(allocation.quantity) || 0);
      }, 0);

      const row = document.createElement("tr");
      appendShippingScheduleCell(row, record.name || "");
      appendShippingScheduleCell(row, formatShippingDate(record.departureDate));
      appendShippingScheduleCell(row, formatShippingDate(record.arrivalDate));
      appendShippingScheduleCell(row, formatShippingDate(record.warehouseArrivalDate));
      appendShippingScheduleCell(row, `${allocations.length}件`);
      appendShippingScheduleCell(row, `${quantity.toLocaleString("ja-JP")}個`);

      const allocationCell = document.createElement("td");
      const allocationButton = document.createElement("button");
      allocationButton.type = "button";
      allocationButton.textContent = "商品を振り分ける";
      allocationButton.addEventListener("click", function () {
        const select = document.querySelector("#shipping-allocation-schedule");
        if (select) select.value = record.id;
        shippingAllocationCurrentPage = 1;
        renderShippingAllocationTable();
        scrollShippingAllocationIntoView();
      });
      allocationCell.appendChild(allocationButton);
      row.appendChild(allocationCell);

      const actionCell = document.createElement("td");
      actionCell.className = "shipping-schedule-actions";
      const edit = document.createElement("button");
      edit.type = "button";
      edit.textContent = "編集";
      edit.addEventListener("click", function () { editShippingSchedule(record.id); });
      const del = document.createElement("button");
      del.type = "button";
      del.textContent = "削除";
      del.className = "shipping-schedule-delete";
      del.addEventListener("click", function () { removeShippingSchedule(record.id); });
      actionCell.appendChild(edit);
      actionCell.appendChild(del);
      row.appendChild(actionCell);
      body.appendChild(row);
    });
  }

  pageStatus.textContent = `${shippingScheduleCurrentPage} / ${totalPages}ページ`;
  if (prev) prev.disabled = shippingScheduleCurrentPage <= 1;
  if (next) next.disabled = shippingScheduleCurrentPage >= totalPages;
}

function populateShippingScheduleSelect() {
  const select = document.querySelector("#shipping-allocation-schedule");
  if (!select) return;
  const previous = select.value;
  select.innerHTML = '<option value="">船便を選択してください</option>';

  shippingScheduleRecords.forEach(function (record) {
    const option = document.createElement("option");
    option.value = record.id;
    option.textContent = `${record.name}｜出港 ${formatShippingDate(record.departureDate)}｜倉庫 ${formatShippingDate(record.warehouseArrivalDate)}`;
    select.appendChild(option);
  });

  if (previous && shippingScheduleRecords.some(function (record) { return record.id === previous; })) {
    select.value = previous;
  }
}

function getFilteredShippingAllocationWishes() {
  const search = String(document.querySelector("#shipping-allocation-search")?.value || "").trim().toLowerCase();
  const scheduleId = document.querySelector("#shipping-allocation-schedule")?.value || "";
  if (!scheduleId) return [];

  return shippingScheduleWishes.filter(function (wish) {
    const currentQuantity = getAllocationQuantity(scheduleId, wish.id);
    const allocatedTotal = getAllocatedTotalForWish(wish.id);
    const remaining = Math.max(0, Number(wish.quantity || 0) - allocatedTotal);
    if (remaining <= 0 && currentQuantity <= 0) return false;

    if (!search) return true;
    const haystack = [wish.internalCode, wish.productCode, wish.productName, wish.desiredMonth, wish.note]
      .map(function (value) { return String(value || "").toLowerCase(); })
      .join(" ");
    return haystack.includes(search);
  });
}

function getShippingAllocationTotalPages() {
  return Math.max(1, Math.ceil(getFilteredShippingAllocationWishes().length / SHIPPING_ALLOCATION_PAGE_SIZE));
}

function renderShippingAllocationTable() {
  const body = document.querySelector("#shipping-allocation-table-body");
  const summary = document.querySelector("#shipping-allocation-summary");
  const info = document.querySelector("#shipping-allocation-schedule-info");
  const pageStatus = document.querySelector("#shipping-allocation-page-status");
  const prev = document.querySelector("#shipping-allocation-prev-page");
  const next = document.querySelector("#shipping-allocation-next-page");
  const saveButton = document.querySelector("#save-visible-shipping-allocations");
  if (!body || !summary || !pageStatus) return;

  const scheduleId = document.querySelector("#shipping-allocation-schedule")?.value || "";
  const schedule = shippingScheduleRecords.find(function (record) { return record.id === scheduleId; });
  body.innerHTML = "";

  if (!schedule) {
    summary.textContent = "船便を選択すると、船積希望商品を振り分けできます。";
    if (info) info.textContent = "";
    if (saveButton) saveButton.disabled = true;
    pageStatus.textContent = "1 / 1ページ";
    if (prev) prev.disabled = true;
    if (next) next.disabled = true;
    return;
  }

  if (info) {
    info.textContent = `${schedule.name}｜出港 ${formatShippingDate(schedule.departureDate)}｜入港 ${formatShippingDate(schedule.arrivalDate)}｜倉庫到着 ${formatShippingDate(schedule.warehouseArrivalDate)}`;
  }

  const filtered = getFilteredShippingAllocationWishes();
  const totalPages = Math.max(1, Math.ceil(filtered.length / SHIPPING_ALLOCATION_PAGE_SIZE));
  if (shippingAllocationCurrentPage > totalPages) shippingAllocationCurrentPage = totalPages;
  const start = (shippingAllocationCurrentPage - 1) * SHIPPING_ALLOCATION_PAGE_SIZE;
  const visible = filtered.slice(start, start + SHIPPING_ALLOCATION_PAGE_SIZE);

  const wishTotal = shippingScheduleWishes.reduce(function (sum, wish) {
    return sum + (Number(wish.quantity) || 0);
  }, 0);
  const allAllocated = shippingScheduleAllocations.reduce(function (sum, allocation) {
    return sum + (Number(allocation.quantity) || 0);
  }, 0);
  const currentAllocated = shippingScheduleAllocations
    .filter(function (allocation) { return allocation.scheduleId === scheduleId; })
    .reduce(function (sum, allocation) { return sum + (Number(allocation.quantity) || 0); }, 0);
  const remainingTotal = Math.max(0, wishTotal - allAllocated);
  summary.textContent = `船積希望合計：${wishTotal.toLocaleString("ja-JP")}個 / この船便：${currentAllocated.toLocaleString("ja-JP")}個 / 全船便未振分：${remainingTotal.toLocaleString("ja-JP")}個`;

  if (visible.length === 0) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 10;
    cell.textContent = "振り分けできる船積希望商品はありません。";
    row.appendChild(cell);
    body.appendChild(row);
  } else {
    visible.forEach(function (wish) {
      const currentQuantity = getAllocationQuantity(scheduleId, wish.id);
      const allocatedTotal = getAllocatedTotalForWish(wish.id);
      const otherAllocated = Math.max(0, allocatedTotal - currentQuantity);
      const remainingAfterCurrent = Math.max(0, Number(wish.quantity || 0) - allocatedTotal);

      const row = document.createElement("tr");
      row.dataset.shippingWishId = wish.id;
      appendShippingScheduleCell(row, wish.internalCode || "");
      appendShippingScheduleCell(row, wish.productCode || "未登録");
      appendShippingScheduleCell(row, wish.productName || "");
      appendShippingScheduleCell(row, `${Number(wish.quantity || 0).toLocaleString("ja-JP")}個`);
      appendShippingScheduleCell(row, `${otherAllocated.toLocaleString("ja-JP")}個`);

      const inputCell = document.createElement("td");
      const input = document.createElement("input");
      input.type = "number";
      input.min = "0";
      input.step = "1";
      input.value = String(currentQuantity || 0);
      input.className = "shipping-allocation-quantity";
      input.dataset.shippingWishId = wish.id;
      inputCell.appendChild(input);
      row.appendChild(inputCell);

      appendShippingScheduleCell(row, `${remainingAfterCurrent.toLocaleString("ja-JP")}個`);
      appendShippingScheduleCell(row, formatShippingWishMonthForSchedule(wish.desiredMonth));
      appendShippingScheduleCell(row, wish.note || "");
      appendShippingScheduleCell(row, currentQuantity > 0 ? "振分済み" : "未振分");
      body.appendChild(row);
    });
  }

  if (saveButton) saveButton.disabled = visible.length === 0;
  pageStatus.textContent = `${shippingAllocationCurrentPage} / ${totalPages}ページ`;
  if (prev) prev.disabled = shippingAllocationCurrentPage <= 1;
  if (next) next.disabled = shippingAllocationCurrentPage >= totalPages;
}

async function saveVisibleShippingAllocations() {
  const scheduleId = document.querySelector("#shipping-allocation-schedule")?.value || "";
  const schedule = shippingScheduleRecords.find(function (record) { return record.id === scheduleId; });
  if (!schedule) {
    alert("振り分ける船便を選択してください。");
    return;
  }

  const inputs = Array.from(document.querySelectorAll("#shipping-allocation-table-body .shipping-allocation-quantity"));
  if (inputs.length === 0) return;

  const changes = [];
  for (const input of inputs) {
    const wishId = input.dataset.shippingWishId;
    const wish = shippingScheduleWishes.find(function (item) { return item.id === wishId; });
    if (!wish) continue;

    const quantity = Number(input.value);
    if (!Number.isInteger(quantity) || quantity < 0) {
      alert(`${wish.productName || wish.internalCode} の振分数量は0以上の整数で入力してください。`);
      input.focus();
      return;
    }

    const currentQuantity = getAllocationQuantity(scheduleId, wishId);
    const otherAllocated = Math.max(0, getAllocatedTotalForWish(wishId) - currentQuantity);
    const maxForThisSchedule = Math.max(0, Number(wish.quantity || 0) - otherAllocated);
    if (quantity > maxForThisSchedule) {
      alert(
        `${wish.productName || wish.internalCode} は希望数量を超えて振り分けできません。\n\n` +
        `希望数量：${Number(wish.quantity || 0).toLocaleString("ja-JP")}個\n` +
        `他の船便：${otherAllocated.toLocaleString("ja-JP")}個\n` +
        `今回の船便に振分可能：${maxForThisSchedule.toLocaleString("ja-JP")}個`
      );
      input.focus();
      return;
    }

    if (quantity !== currentQuantity) changes.push({ wish: wish, quantity: quantity });
  }

  if (changes.length === 0) {
    alert("変更された振分数量はありません。");
    return;
  }

  const confirmed = window.confirm(
    `${schedule.name} の振分数量を保存します。\n\n変更商品：${changes.length}件\n\nよろしいですか？`
  );
  if (!confirmed) return;

  try {
    for (const change of changes) {
      const id = createShippingAllocationId(scheduleId, change.wish.id);
      if (change.quantity === 0) {
        await deleteShippingAllocation(id);
      } else {
        await saveShippingAllocation({
          id: id,
          scheduleId: scheduleId,
          shippingWishId: change.wish.id,
          internalCode: change.wish.internalCode || "",
          productCode: change.wish.productCode || "",
          productName: change.wish.productName || "",
          quantity: change.quantity,
          updatedAt: new Date().toISOString()
        });
      }
    }

    await refreshShippingScheduleData();
    if (typeof refreshShippingWishData === "function") {
      try { await refreshShippingWishData(); } catch (error) { console.warn(error); }
    }
    alert("船便への商品振分けを保存しました。");
  } catch (error) {
    console.error("船便振分保存エラー", error);
    alert("船便への振分けを保存できませんでした。");
  }
}

function getAllocationQuantity(scheduleId, wishId) {
  const record = shippingScheduleAllocations.find(function (allocation) {
    return allocation.scheduleId === scheduleId && allocation.shippingWishId === wishId;
  });
  return record ? Number(record.quantity) || 0 : 0;
}

function getAllocatedTotalForWish(wishId) {
  return shippingScheduleAllocations
    .filter(function (allocation) { return allocation.shippingWishId === wishId; })
    .reduce(function (sum, allocation) { return sum + (Number(allocation.quantity) || 0); }, 0);
}

function appendShippingScheduleCell(row, value) {
  const cell = document.createElement("td");
  cell.textContent = value;
  row.appendChild(cell);
}

function compareShippingSchedules(a, b) {
  const aDate = a.departureDate || "9999-99-99";
  const bDate = b.departureDate || "9999-99-99";
  if (aDate !== bDate) return aDate.localeCompare(bDate);
  return String(a.name || "").localeCompare(String(b.name || ""), "ja");
}

function compareShippingWishesForSchedule(a, b) {
  const aMonth = a.desiredMonth || "9999-99";
  const bMonth = b.desiredMonth || "9999-99";
  if (aMonth !== bMonth) return aMonth.localeCompare(bMonth);
  return String(a.internalCode || "").localeCompare(String(b.internalCode || ""), "ja", { numeric: true });
}

function createShippingScheduleId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return `shipping-schedule-${window.crypto.randomUUID()}`;
  }
  return `shipping-schedule-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function createShippingAllocationId(scheduleId, wishId) {
  return `${scheduleId}::${wishId}`;
}

function formatShippingDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) return value || "";
  const parts = value.split("-");
  return `${Number(parts[0])}/${Number(parts[1])}/${Number(parts[2])}`;
}

function formatShippingWishMonthForSchedule(value) {
  if (!/^\d{4}-\d{2}$/.test(String(value || ""))) return "未指定";
  const parts = value.split("-");
  return `${Number(parts[0])}年${Number(parts[1])}月`;
}

function createShippingScheduleStyle() {
  if (document.querySelector("#shipping-schedule-style")) return;
  const style = document.createElement("style");
  style.id = "shipping-schedule-style";
  style.textContent = `
    #shipping-schedule .shipping-schedule-card {
      margin: 18px 0;
      padding: 18px;
      border: 1px solid #b0bec5;
      border-radius: 14px;
      background: #fff;
    }
    #shipping-schedule .shipping-schedule-shortcuts,
    #shipping-schedule .shipping-schedule-actions,
    #shipping-schedule .shipping-schedule-pager {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      align-items: center;
      margin: 12px 0;
    }
    #shipping-schedule .shipping-schedule-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 14px;
    }
    #shipping-schedule .shipping-schedule-full { grid-column: 1 / -1; }
    #shipping-schedule .shipping-schedule-summary,
    #shipping-schedule .shipping-allocation-summary,
    #shipping-schedule .shipping-allocation-info {
      margin: 12px 0;
      padding: 12px 14px;
      border-radius: 10px;
      background: #e0f2f1;
      font-weight: 700;
    }
    #shipping-schedule .shipping-schedule-table-wrap,
    #shipping-schedule .shipping-allocation-table-wrap {
      overflow-x: auto;
      max-width: 100%;
    }
    #shipping-schedule table {
      width: 100%;
      min-width: 980px;
      border-collapse: collapse;
    }
    #shipping-schedule th,
    #shipping-schedule td {
      padding: 10px;
      border-bottom: 1px solid #cfd8dc;
      text-align: left;
      vertical-align: middle;
    }
    #shipping-schedule .shipping-schedule-actions {
      white-space: nowrap;
    }
    #shipping-schedule .shipping-schedule-delete {
      background: #d32f2f;
    }
    #shipping-schedule .shipping-allocation-controls {
      display: grid;
      grid-template-columns: minmax(0, 2fr) minmax(220px, 1fr);
      gap: 14px;
      margin-bottom: 12px;
    }
    #shipping-schedule .shipping-allocation-quantity {
      width: 110px;
      min-width: 90px;
    }
    @media (max-width: 760px) {
      #shipping-schedule .shipping-schedule-grid,
      #shipping-schedule .shipping-allocation-controls {
        grid-template-columns: 1fr;
      }
      #shipping-schedule .shipping-schedule-card { padding: 14px; }
    }
  `;
  document.head.appendChild(style);
}
