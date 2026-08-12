"use strict";

const SHIPPING_SCHEDULE_PAGE_SIZE = 20;
const SHIPPING_ALLOCATION_PAGE_SIZE = 20;
const SHIPPING_DESTINATION_LOCATIONS = [
  "酒本倉庫1階",
  "酒本倉庫2階",
  "本社1階　A区",
  "本社1階　B区",
  "本社1階　C区",
  "本社1階　D区",
  "本社1階　E区",
  "本社1階　F区",
  "本社2階　A区",
  "本社2階　B区",
  "本社2階　C区",
  "本社2階　D区",
  "本社2階　E区",
  "本社2階　F区"
];
let shippingScheduleRecords = [];
let shippingScheduleAllocations = [];
let shippingScheduleProducts = [];
let shippingScheduleSalesActuals = [];
let shippingScheduleSalesPlans = [];
let shippingWarehouseAllocations = [];
let shippingArrivalReceipts = [];
let shippingWarehouseEditingInternalCode = "";
let shippingScheduleEditingId = "";
let shippingScheduleCurrentPage = 1;
let shippingAllocationCurrentPage = 1;

window.addEventListener("DOMContentLoaded", initializeShippingScheduleFeature);

function initializeShippingScheduleFeature() {
  const showScheduleButton = document.querySelector("#show-shipping-schedule-button");
  const showAllocationButton = document.querySelector("#show-shipping-allocation-button");
  const showWarehouseButton = document.querySelector("#show-shipping-warehouse-allocation-button");
  const form = document.querySelector("#shipping-schedule-form");
  const backButton = document.querySelector("#back-home-from-shipping-schedule");
  const cancelEditButton = document.querySelector("#cancel-shipping-schedule-edit-button");
  const jumpFormButton = document.querySelector("#jump-shipping-schedule-form-button");
  const jumpAllocationButton = document.querySelector("#jump-shipping-allocation-button");
  const jumpWarehouseButton = document.querySelector("#jump-shipping-warehouse-button");
  const scheduleSelect = document.querySelector("#shipping-allocation-schedule");
  const allocationSearch = document.querySelector("#shipping-allocation-search");
  const saveVisibleButton = document.querySelector("#save-visible-shipping-allocations");
  const printButton = document.querySelector("#print-shipping-allocation-list");
  const prevSchedule = document.querySelector("#shipping-schedule-prev-page");
  const nextSchedule = document.querySelector("#shipping-schedule-next-page");
  const prevAllocation = document.querySelector("#shipping-allocation-prev-page");
  const nextAllocation = document.querySelector("#shipping-allocation-next-page");
  const warehouseScheduleSelect = document.querySelector("#shipping-warehouse-schedule");
  const warehouseSearch = document.querySelector("#shipping-warehouse-search");
  const warehouseSaveButton = document.querySelector("#save-shipping-warehouse-allocation");
  const warehouseCancelButton = document.querySelector("#cancel-shipping-warehouse-allocation");
  const warehouseFillCurrentButton = document.querySelector("#shipping-warehouse-fill-current-location");
  const warehouseClearButton = document.querySelector("#shipping-warehouse-clear-inputs");
  const warehousePrintButton = document.querySelector("#print-shipping-warehouse-list");

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
  if (showWarehouseButton) {
    showWarehouseButton.addEventListener("click", function () {
      openShippingScheduleScreen("warehouse");
    });
  }
  if (backButton) backButton.addEventListener("click", closeShippingScheduleScreen);
  if (cancelEditButton) cancelEditButton.addEventListener("click", resetShippingScheduleForm);
  if (jumpFormButton) jumpFormButton.addEventListener("click", scrollShippingScheduleFormIntoView);
  if (jumpAllocationButton) jumpAllocationButton.addEventListener("click", scrollShippingAllocationIntoView);
  if (jumpWarehouseButton) jumpWarehouseButton.addEventListener("click", scrollShippingWarehouseIntoView);
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
  if (printButton) printButton.addEventListener("click", printShippingAllocationList);

  if (warehouseScheduleSelect) {
    warehouseScheduleSelect.addEventListener("change", function () {
      shippingWarehouseEditingInternalCode = "";
      hideShippingWarehouseEditor();
      renderShippingWarehouseProductTable();
    });
  }
  if (warehouseSearch) {
    warehouseSearch.addEventListener("input", renderShippingWarehouseProductTable);
  }
  if (warehouseSaveButton) warehouseSaveButton.addEventListener("click", saveShippingWarehouseEditor);
  if (warehouseCancelButton) warehouseCancelButton.addEventListener("click", hideShippingWarehouseEditor);
  if (warehouseFillCurrentButton) warehouseFillCurrentButton.addEventListener("click", fillShippingWarehouseCurrentLocation);
  if (warehouseClearButton) warehouseClearButton.addEventListener("click", clearShippingWarehouseInputs);
  if (warehousePrintButton) warehousePrintButton.addEventListener("click", printShippingWarehouseList);

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
  else if (target === "warehouse") scrollShippingWarehouseIntoView();
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

function scrollShippingWarehouseIntoView() {
  const target = document.querySelector("#shipping-warehouse-area");
  if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function refreshShippingScheduleData() {
  const results = await Promise.all([
    getAllShippingSchedules(),
    getAllShippingAllocations(),
    getAllProducts(),
    getAllSalesActuals(),
    getAllSalesPlans(),
    getAllShippingWarehouseAllocations(),
    typeof getAllShippingArrivalReceipts === "function" ? getAllShippingArrivalReceipts() : Promise.resolve([])
  ]);
  shippingScheduleRecords = results[0].slice().sort(compareShippingSchedules);
  shippingScheduleAllocations = results[1].slice();
  shippingScheduleProducts = results[2].slice();
  shippingScheduleSalesActuals = results[3].slice();
  shippingScheduleSalesPlans = results[4].slice();
  shippingWarehouseAllocations = results[5].slice();
  shippingArrivalReceipts = results[6].slice();
  renderShippingScheduleTable();
  populateShippingScheduleSelect();
  populateShippingWarehouseScheduleSelect();
  renderShippingAllocationTable();
  renderShippingWarehouseProductTable();
  if (window.shippingArrivalApp && typeof window.shippingArrivalApp.refreshStatus === "function") {
    window.shippingArrivalApp.refreshStatus();
  }
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
    if (window.shippingArrivalApp && typeof window.shippingArrivalApp.checkNow === "function") {
      window.setTimeout(function () {
        window.shippingArrivalApp.checkNow({ showMessageWhenNone: false });
      }, 100);
    }
    scrollShippingScheduleFormIntoView();
  } catch (error) {
    console.error("船便スケジュール保存エラー", error);
    alert("船便スケジュールを保存できませんでした。");
  }
}

function editShippingSchedule(id) {
  const record = shippingScheduleRecords.find(function (item) { return item.id === id; });
  if (!record) return;

  if (isShippingScheduleReceived(id)) {
    alert("この船便はすでに倉庫到着分を在庫へ入荷反映済みのため、スケジュールを編集できません。");
    return;
  }

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

  const arrivalReceipt = shippingArrivalReceipts.find(function (receipt) {
    return receipt.scheduleId === id || receipt.id === id;
  });
  if (arrivalReceipt) {
    alert(
      `船便「${record.name}」はすでに倉庫到着分を在庫へ入荷反映済みのため削除できません。\n\n` +
      `倉庫到着日：${formatShippingDate(record.warehouseArrivalDate)}\n` +
      `入荷反映数量：${(Number(arrivalReceipt.totalQuantity) || 0).toLocaleString("ja-JP")}個\n\n` +
      "入出庫履歴との整合性を守るため、反映済み船便は履歴として残します。"
    );
    return;
  }

  const allocations = shippingScheduleAllocations.filter(function (allocation) {
    return allocation.scheduleId === id && Number(allocation.quantity) > 0;
  });
  const allocatedQuantity = allocations.reduce(function (sum, item) {
    return sum + (Number(item.quantity) || 0);
  }, 0);

  const confirmed = window.confirm(
    `船便「${record.name}」を削除しますか？\n\n` +
    `出港日：${formatShippingDate(record.departureDate)}\n` +
    `振分商品：${getUniqueAllocationProductCount(allocations)}件 / ${allocatedQuantity.toLocaleString("ja-JP")}個\n` +
    `倉庫別振分け：${getShippingWarehouseRecordsForSchedule(id).length}件\n\n` +
    "削除すると、この船便への商品振分けと倉庫別振分けも解除されます。"
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
      appendShippingScheduleCell(row, `${getUniqueAllocationProductCount(allocations)}件`);
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

function getSelectedShippingSchedule() {
  const scheduleId = document.querySelector("#shipping-allocation-schedule")?.value || "";
  return shippingScheduleRecords.find(function (record) { return record.id === scheduleId; }) || null;
}

function isShippingScheduleReceived(scheduleId) {
  return shippingArrivalReceipts.some(function (receipt) {
    return receipt.scheduleId === scheduleId || receipt.id === scheduleId;
  });
}

function getShippingAllocationRows(schedule) {
  if (!schedule || !isShippingIsoDate(schedule.warehouseArrivalDate)) return [];

  const targetPeriod = getShippingTargetPeriod(schedule);
  if (!targetPeriod.valid) return [];

  const monthKey = schedule.warehouseArrivalDate.slice(0, 7);
  const averageContext = buildShippingAverageContext(monthKey);
  const actualByProduct = aggregateShippingActuals(averageContext.monthKeys);
  const planByProduct = aggregateShippingPlansForRange(targetPeriod.startDate, targetPeriod.endDate);
  const priorScheduleIds = getPriorShippingScheduleIds(schedule);
  const periodDays = targetPeriod.days;

  return shippingScheduleProducts
    .filter(function (product) {
      return !isShippingDiscontinuedProduct(product) && String(product.internalCode || "").trim();
    })
    .map(function (product) {
      const internalCode = String(product.internalCode || "").trim();
      const sixMonthSales = actualByProduct.get(internalCode) || 0;
      const monthlyAverage = Math.max(0, Math.ceil(sixMonthSales / 6));
      const periodSalesEstimate = Math.max(0, Math.ceil((monthlyAverage / 30) * periodDays));
      const plannedQuantity = planByProduct.get(internalCode) || 0;
      const requiredQuantity = Math.max(0, Math.ceil(periodSalesEstimate + plannedQuantity));
      const currentStock = getShippingNumber(product.stock);
      const priorAllocated = getAllocatedQuantityForProductInSchedules(internalCode, priorScheduleIds);
      const recommendedQuantity = Math.max(0, requiredQuantity - currentStock - priorAllocated);
      const currentAllocation = getCurrentScheduleAllocationQuantity(schedule.id, internalCode);

      return {
        internalCode: internalCode,
        productCode: product.productCode || "",
        productName: product.productName || "",
        currentStock: currentStock,
        sixMonthSales: sixMonthSales,
        monthlyAverage: monthlyAverage,
        periodSalesEstimate: periodSalesEstimate,
        plannedQuantity: plannedQuantity,
        requiredQuantity: requiredQuantity,
        priorAllocated: priorAllocated,
        recommendedQuantity: recommendedQuantity,
        currentAllocation: currentAllocation,
        location: product.location || "",
        averageStartMonth: averageContext.startMonth,
        averageEndMonth: averageContext.endMonth,
        targetStartDate: targetPeriod.startDate,
        targetEndDate: targetPeriod.endDate,
        targetDays: targetPeriod.days,
        nextScheduleId: targetPeriod.nextSchedule ? targetPeriod.nextSchedule.id : "",
        nextScheduleName: targetPeriod.nextSchedule ? targetPeriod.nextSchedule.name : ""
      };
    })
    .filter(function (row) {
      return row.recommendedQuantity > 0 || row.currentAllocation > 0;
    })
    .sort(function (a, b) {
      if (b.recommendedQuantity !== a.recommendedQuantity) return b.recommendedQuantity - a.recommendedQuantity;
      return a.internalCode.localeCompare(b.internalCode, "ja", { numeric: true });
    });
}

function getFilteredShippingAllocationRows(schedule) {
  const search = String(document.querySelector("#shipping-allocation-search")?.value || "").trim().toLowerCase();
  const rows = getShippingAllocationRows(schedule);
  if (!search) return rows;

  return rows.filter(function (row) {
    return [row.internalCode, row.productCode, row.productName, row.location]
      .map(function (value) { return String(value || "").toLowerCase(); })
      .some(function (value) { return value.includes(search); });
  });
}

function getShippingAllocationTotalPages() {
  const schedule = getSelectedShippingSchedule();
  return Math.max(1, Math.ceil(getFilteredShippingAllocationRows(schedule).length / SHIPPING_ALLOCATION_PAGE_SIZE));
}

function renderShippingAllocationTable() {
  const body = document.querySelector("#shipping-allocation-table-body");
  const summary = document.querySelector("#shipping-allocation-summary");
  const info = document.querySelector("#shipping-allocation-schedule-info");
  const pageStatus = document.querySelector("#shipping-allocation-page-status");
  const prev = document.querySelector("#shipping-allocation-prev-page");
  const next = document.querySelector("#shipping-allocation-next-page");
  const saveButton = document.querySelector("#save-visible-shipping-allocations");
  const printButton = document.querySelector("#print-shipping-allocation-list");
  if (!body || !summary || !pageStatus) return;

  const schedule = getSelectedShippingSchedule();
  body.innerHTML = "";

  if (!schedule) {
    summary.textContent = "船便を選択すると、今回の倉庫到着日から次便の倉庫到着日前日までを自動計算します。";
    if (info) info.textContent = "";
    if (saveButton) saveButton.disabled = true;
    if (printButton) printButton.disabled = true;
    pageStatus.textContent = "1 / 1ページ";
    if (prev) prev.disabled = true;
    if (next) next.disabled = true;
    return;
  }

  const scheduleReceived = isShippingScheduleReceived(schedule.id);
  const targetPeriod = getShippingTargetPeriod(schedule);
  const monthKey = schedule.warehouseArrivalDate.slice(0, 7);
  const averageContext = buildShippingAverageContext(monthKey);

  if (!targetPeriod.valid) {
    if (info) {
      info.innerHTML =
        `<strong>${escapeShippingHtml(schedule.name)}</strong><br>` +
        `出港 ${escapeShippingHtml(formatShippingDate(schedule.departureDate))} / ` +
        `入港 ${escapeShippingHtml(formatShippingDate(schedule.arrivalDate))} / ` +
        `倉庫到着 ${escapeShippingHtml(formatShippingDate(schedule.warehouseArrivalDate))}<br>` +
        `<span class="shipping-target-warning">次の船便が未登録のため、対象期間を確定できません。</span>`;
    }
    summary.textContent = "次の船便の倉庫到着日を登録すると、不足数量を自動計算できます。";
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 12;
    cell.textContent = "次の船便が未登録です。先に次便のスケジュールを登録してください。";
    row.appendChild(cell);
    body.appendChild(row);
    if (saveButton) saveButton.disabled = true;
    if (printButton) printButton.disabled = true;
    pageStatus.textContent = "1 / 1ページ";
    if (prev) prev.disabled = true;
    if (next) next.disabled = true;
    return;
  }

  if (info) {
    info.innerHTML =
      `<strong>${escapeShippingHtml(schedule.name)}</strong><br>` +
      `出港 ${escapeShippingHtml(formatShippingDate(schedule.departureDate))} / ` +
      `入港 ${escapeShippingHtml(formatShippingDate(schedule.arrivalDate))} / ` +
      `倉庫到着 ${escapeShippingHtml(formatShippingDate(schedule.warehouseArrivalDate))}<br>` +
      `対象期間：${escapeShippingHtml(formatShippingDate(targetPeriod.startDate))} ～ ${escapeShippingHtml(formatShippingDate(targetPeriod.endDate))}（${targetPeriod.days.toLocaleString("ja-JP")}日）<br>` +
      `次便：${escapeShippingHtml(targetPeriod.nextSchedule.name)} / 倉庫到着 ${escapeShippingHtml(formatShippingDate(targetPeriod.nextSchedule.warehouseArrivalDate))}<br>` +
      `月平均：${escapeShippingHtml(formatShippingMonth(averageContext.startMonth))} ～ ${escapeShippingHtml(formatShippingMonth(averageContext.endMonth))} の6か月平均` +
      (scheduleReceived ? `<br><span class="shipping-received-note">この船便は入荷反映済みです。船積数量は履歴保護のため編集できません。</span>` : "");
  }

  const allRows = getShippingAllocationRows(schedule);
  const filtered = getFilteredShippingAllocationRows(schedule);
  const totalPages = Math.max(1, Math.ceil(filtered.length / SHIPPING_ALLOCATION_PAGE_SIZE));
  if (shippingAllocationCurrentPage > totalPages) shippingAllocationCurrentPage = totalPages;
  const start = (shippingAllocationCurrentPage - 1) * SHIPPING_ALLOCATION_PAGE_SIZE;
  const visible = filtered.slice(start, start + SHIPPING_ALLOCATION_PAGE_SIZE);

  const totalRecommended = allRows.reduce(function (sum, row) {
    return sum + row.recommendedQuantity;
  }, 0);
  const currentAllocated = allRows.reduce(function (sum, row) {
    return sum + row.currentAllocation;
  }, 0);
  summary.textContent =
    `不足候補：${allRows.length.toLocaleString("ja-JP")}商品 / ` +
    `推奨数量合計：${totalRecommended.toLocaleString("ja-JP")}個 / ` +
    `この船便の保存済み数量：${currentAllocated.toLocaleString("ja-JP")}個`;

  if (visible.length === 0) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 12;
    cell.textContent = "この船便の対象期間で不足する商品はありません。";
    row.appendChild(cell);
    body.appendChild(row);
  } else {
    visible.forEach(function (item) {
      const row = document.createElement("tr");
      row.dataset.internalCode = item.internalCode;
      appendShippingScheduleCell(row, item.internalCode);
      appendShippingScheduleCell(row, item.productCode || "-");
      appendShippingScheduleCell(row, item.productName || "");
      appendShippingScheduleCell(row, `${item.monthlyAverage.toLocaleString("ja-JP")}個`);
      appendShippingScheduleCell(row, `${item.periodSalesEstimate.toLocaleString("ja-JP")}個`);
      appendShippingScheduleCell(row, `${formatShippingQuantity(item.plannedQuantity)}個`);
      appendShippingScheduleCell(row, `${item.currentStock.toLocaleString("ja-JP")}個`);
      appendShippingScheduleCell(row, `${item.priorAllocated.toLocaleString("ja-JP")}個`);
      appendShippingScheduleCell(row, `${item.requiredQuantity.toLocaleString("ja-JP")}個`);
      appendShippingScheduleCell(row, `${item.recommendedQuantity.toLocaleString("ja-JP")}個`);

      const inputCell = document.createElement("td");
      const input = document.createElement("input");
      input.type = "number";
      input.min = "0";
      input.step = "1";
      input.value = String(item.currentAllocation > 0 ? item.currentAllocation : item.recommendedQuantity);
      input.className = "shipping-allocation-quantity";
      input.dataset.internalCode = item.internalCode;
      input.dataset.recommendedQuantity = String(item.recommendedQuantity);
      input.disabled = scheduleReceived;
      inputCell.appendChild(input);
      row.appendChild(inputCell);

      appendShippingScheduleCell(row, item.location || "");
      body.appendChild(row);
    });
  }

  if (saveButton) saveButton.disabled = visible.length === 0 || scheduleReceived;
  if (printButton) printButton.disabled = getSavedAllocationsForSchedule(schedule.id).length === 0;
  pageStatus.textContent = `${shippingAllocationCurrentPage} / ${totalPages}ページ`;
  if (prev) prev.disabled = shippingAllocationCurrentPage <= 1;
  if (next) next.disabled = shippingAllocationCurrentPage >= totalPages;
}

async function saveVisibleShippingAllocations() {
  const schedule = getSelectedShippingSchedule();
  if (!schedule) {
    alert("振り分ける船便を選択してください。");
    return;
  }
  if (isShippingScheduleReceived(schedule.id)) {
    alert("この船便はすでに在庫へ入荷反映済みのため、船積数量は変更できません。");
    return;
  }

  const inputs = Array.from(document.querySelectorAll("#shipping-allocation-table-body .shipping-allocation-quantity"));
  if (inputs.length === 0) return;

  const changes = [];
  let overRecommendedCount = 0;

  for (const input of inputs) {
    const internalCode = String(input.dataset.internalCode || "").trim();
    const product = shippingScheduleProducts.find(function (item) {
      return String(item.internalCode || "").trim() === internalCode;
    });
    if (!product) continue;

    const quantity = Number(input.value);
    if (!Number.isInteger(quantity) || quantity < 0) {
      alert(`${product.productName || internalCode} の振分数量は0以上の整数で入力してください。`);
      input.focus();
      return;
    }

    const warehouseAllocated = getShippingWarehouseAllocatedQuantity(schedule.id, internalCode);
    if (quantity < warehouseAllocated) {
      alert(
        `${product.productName || internalCode} は倉庫へ ${warehouseAllocated.toLocaleString("ja-JP")}個 振分け済みです。\n\n` +
        `今回の船便数量を ${quantity.toLocaleString("ja-JP")}個 に減らす前に、先に「倉庫別に振り分ける」で倉庫数量を減らしてください。`
      );
      input.focus();
      return;
    }

    const currentQuantity = getCurrentScheduleAllocationQuantity(schedule.id, internalCode);
    const recommendedQuantity = Number(input.dataset.recommendedQuantity || 0);
    if (quantity > recommendedQuantity && quantity !== currentQuantity) overRecommendedCount += 1;

    if (quantity !== currentQuantity) {
      changes.push({
        product: product,
        internalCode: internalCode,
        quantity: quantity,
        recommendedQuantity: recommendedQuantity
      });
    }
  }

  if (changes.length === 0) {
    alert("変更された振分数量はありません。");
    return;
  }

  let message = `${schedule.name} の振分数量を保存します。\n\n変更商品：${changes.length}件`;
  if (overRecommendedCount > 0) {
    message += `\n推奨数量を超える商品：${overRecommendedCount}件`;
  }
  message += "\n\nよろしいですか？";

  const confirmed = window.confirm(message);
  if (!confirmed) return;

  try {
    for (const change of changes) {
      const existingRecords = getAllocationRecordsForScheduleProduct(schedule.id, change.internalCode);
      for (const existing of existingRecords) {
        await deleteShippingAllocation(existing.id);
      }

      if (change.quantity > 0) {
        await saveShippingAllocation({
          id: createShippingProductAllocationId(schedule.id, change.internalCode),
          scheduleId: schedule.id,
          shippingWishId: "",
          internalCode: change.internalCode,
          productCode: change.product.productCode || "",
          productName: change.product.productName || "",
          quantity: change.quantity,
          source: "auto-shortage",
          updatedAt: new Date().toISOString()
        });
      }
    }

    await refreshShippingScheduleData();
    alert("船便への商品振分けを保存しました。");
    if (window.shippingArrivalApp && typeof window.shippingArrivalApp.checkNow === "function") {
      window.setTimeout(function () {
        window.shippingArrivalApp.checkNow({ showMessageWhenNone: false });
      }, 100);
    }
  } catch (error) {
    console.error("船便振分保存エラー", error);
    alert("船便への振分けを保存できませんでした。");
  }
}

function printShippingAllocationList() {
  const schedule = getSelectedShippingSchedule();
  if (!schedule) {
    alert("印刷する船便を選択してください。");
    return;
  }

  const targetPeriod = getShippingTargetPeriod(schedule);
  if (!targetPeriod.valid) {
    alert("次の船便が未登録のため、対象期間を確定できません。先に次便のスケジュールを登録してください。");
    return;
  }

  const saved = getSavedAllocationsForSchedule(schedule.id);
  if (saved.length === 0) {
    alert("この船便には保存済みの振分商品がありません。先に振分数量を保存してください。");
    return;
  }

  const rowsByCode = new Map(getShippingAllocationRows(schedule).map(function (row) {
    return [row.internalCode, row];
  }));

  const printRows = saved
    .map(function (allocation) {
      const code = String(allocation.internalCode || "").trim();
      const computed = rowsByCode.get(code);
      const product = shippingScheduleProducts.find(function (item) {
        return String(item.internalCode || "").trim() === code;
      }) || {};
      return {
        internalCode: code,
        productCode: allocation.productCode || product.productCode || "",
        productName: allocation.productName || product.productName || "",
        monthlyAverage: computed ? computed.monthlyAverage : "",
        periodSalesEstimate: computed ? computed.periodSalesEstimate : "",
        plannedQuantity: computed ? computed.plannedQuantity : "",
        currentStock: computed ? computed.currentStock : getShippingNumber(product.stock),
        priorAllocated: computed ? computed.priorAllocated : "",
        requiredQuantity: computed ? computed.requiredQuantity : "",
        recommendedQuantity: computed ? computed.recommendedQuantity : "",
        quantity: Number(allocation.quantity) || 0,
        location: product.location || ""
      };
    })
    .filter(function (row) { return row.quantity > 0; })
    .sort(function (a, b) {
      return a.internalCode.localeCompare(b.internalCode, "ja", { numeric: true });
    });

  const totalQuantity = printRows.reduce(function (sum, row) { return sum + row.quantity; }, 0);
  const averageContext = buildShippingAverageContext(schedule.warehouseArrivalDate.slice(0, 7));
  const printDate = formatShippingDateForPrint(new Date());

  const tableRows = printRows.map(function (row, index) {
    return `
      <tr>
        <td>${index + 1}</td>
        <td>${escapeShippingHtml(row.internalCode)}</td>
        <td>${escapeShippingHtml(row.productCode || "-")}</td>
        <td>${escapeShippingHtml(row.productName)}</td>
        <td class="num">${formatShippingPrintNumber(row.monthlyAverage)}</td>
        <td class="num">${formatShippingPrintNumber(row.periodSalesEstimate)}</td>
        <td class="num">${formatShippingPrintNumber(row.plannedQuantity)}</td>
        <td class="num">${formatShippingPrintNumber(row.currentStock)}</td>
        <td class="num">${formatShippingPrintNumber(row.priorAllocated)}</td>
        <td class="num">${formatShippingPrintNumber(row.requiredQuantity)}</td>
        <td class="num">${formatShippingPrintNumber(row.recommendedQuantity)}</td>
        <td class="num strong">${row.quantity.toLocaleString("ja-JP")}</td>
        <td>${escapeShippingHtml(row.location)}</td>
      </tr>`;
  }).join("");

  const html = `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<title>${escapeShippingHtml(schedule.name)} 船積リスト</title>
<style>
  @page { size: A4 landscape; margin: 8mm; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: "Yu Gothic", "Meiryo", sans-serif; color: #111; font-size: 9.5pt; }
  h1 { margin: 0 0 7px; font-size: 16pt; }
  .meta { display: grid; grid-template-columns: repeat(4, 1fr); gap: 5px 10px; margin-bottom: 8px; }
  .meta div { border-bottom: 1px solid #aaa; padding: 3px 0; }
  .note { margin: 7px 0 9px; padding: 5px 7px; background: #f3f4f6; font-size: 8.5pt; }
  table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  th, td { border: 1px solid #777; padding: 3px 4px; vertical-align: middle; word-break: break-word; }
  th { background: #e8eef4; font-size: 7.6pt; }
  td { font-size: 7.8pt; }
  .num { text-align: right; }
  .strong { font-weight: 700; font-size: 8.8pt; }
  .total { margin-top: 7px; text-align: right; font-size: 10.5pt; font-weight: 700; }
  .footer { margin-top: 7px; font-size: 7.5pt; color: #444; }
</style>
</head>
<body>
  <h1>船積リスト　${escapeShippingHtml(schedule.name)}</h1>
  <div class="meta">
    <div><strong>出港日：</strong>${escapeShippingHtml(formatShippingDate(schedule.departureDate))}</div>
    <div><strong>入港日：</strong>${escapeShippingHtml(formatShippingDate(schedule.arrivalDate))}</div>
    <div><strong>倉庫到着日：</strong>${escapeShippingHtml(formatShippingDate(schedule.warehouseArrivalDate))}</div>
    <div><strong>印刷日：</strong>${escapeShippingHtml(printDate)}</div>
    <div><strong>対象期間：</strong>${escapeShippingHtml(formatShippingDate(targetPeriod.startDate))} ～ ${escapeShippingHtml(formatShippingDate(targetPeriod.endDate))}</div>
    <div><strong>対象日数：</strong>${targetPeriod.days.toLocaleString("ja-JP")}日</div>
    <div><strong>次便：</strong>${escapeShippingHtml(targetPeriod.nextSchedule.name)}</div>
    <div><strong>次便倉庫到着：</strong>${escapeShippingHtml(formatShippingDate(targetPeriod.nextSchedule.warehouseArrivalDate))}</div>
  </div>
  <div class="note">
    月平均：${escapeShippingHtml(formatShippingMonth(averageContext.startMonth))} ～ ${escapeShippingHtml(formatShippingMonth(averageContext.endMonth))} の6か月平均。
    期間販売見込＝月平均÷30日×対象日数（小数切り上げ）。
    期間指定の販売予定は、対象期間と重なる日数分を按分して小数切り上げしています。
  </div>
  <table>
    <thead>
      <tr>
        <th style="width:3%">No</th>
        <th style="width:6%">社内コード</th>
        <th style="width:7%">商品コード</th>
        <th style="width:15%">商品名</th>
        <th style="width:6%">月平均</th>
        <th style="width:7%">期間見込</th>
        <th style="width:7%">期間予定</th>
        <th style="width:6%">現在庫</th>
        <th style="width:7%">前便振分</th>
        <th style="width:6%">必要数</th>
        <th style="width:6%">推奨</th>
        <th style="width:7%">今回数量</th>
        <th style="width:11%">保管場所</th>
      </tr>
    </thead>
    <tbody>${tableRows}</tbody>
  </table>
  <div class="total">振分商品：${printRows.length.toLocaleString("ja-JP")}件　／　振分数量合計：${totalQuantity.toLocaleString("ja-JP")}個</div>
  <div class="footer">バーコード在庫・棚卸管理アプリ v47</div>
</body>
</html>`;

  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  iframe.setAttribute("aria-hidden", "true");
  document.body.appendChild(iframe);

  const printWindow = iframe.contentWindow;
  const printDocument = iframe.contentDocument || printWindow.document;
  printDocument.open();
  printDocument.write(html);
  printDocument.close();

  window.setTimeout(function () {
    try {
      printWindow.focus();
      printWindow.print();
    } finally {
      window.setTimeout(function () { iframe.remove(); }, 1500);
    }
  }, 300);
}


function populateShippingWarehouseScheduleSelect() {
  const select = document.querySelector("#shipping-warehouse-schedule");
  if (!select) return;
  const previous = select.value;
  select.innerHTML = '<option value="">船便を選択してください</option>';

  shippingScheduleRecords.forEach(function (record) {
    const saved = getSavedAllocationsForSchedule(record.id);
    const option = document.createElement("option");
    option.value = record.id;
    option.textContent = `${record.name}｜倉庫 ${formatShippingDate(record.warehouseArrivalDate)}｜船積 ${saved.length}商品`;
    select.appendChild(option);
  });

  if (previous && shippingScheduleRecords.some(function (record) { return record.id === previous; })) {
    select.value = previous;
  }
}

function getSelectedShippingWarehouseSchedule() {
  const scheduleId = document.querySelector("#shipping-warehouse-schedule")?.value || "";
  return shippingScheduleRecords.find(function (record) { return record.id === scheduleId; }) || null;
}

function getShippingWarehouseRecordsForSchedule(scheduleId) {
  return shippingWarehouseAllocations.filter(function (record) {
    return record.scheduleId === scheduleId && Number(record.quantity) > 0;
  });
}

function getShippingWarehouseRecordsForProduct(scheduleId, internalCode) {
  return shippingWarehouseAllocations.filter(function (record) {
    return record.scheduleId === scheduleId &&
      String(record.internalCode || "").trim() === String(internalCode || "").trim() &&
      Number(record.quantity) > 0;
  });
}

function getShippingWarehouseAllocatedQuantity(scheduleId, internalCode) {
  return getShippingWarehouseRecordsForProduct(scheduleId, internalCode).reduce(function (sum, record) {
    return sum + (Number(record.quantity) || 0);
  }, 0);
}

function renderShippingWarehouseProductTable() {
  const body = document.querySelector("#shipping-warehouse-product-body");
  const summary = document.querySelector("#shipping-warehouse-summary");
  const printButton = document.querySelector("#print-shipping-warehouse-list");
  if (!body || !summary) return;

  const schedule = getSelectedShippingWarehouseSchedule();
  body.innerHTML = "";

  if (!schedule) {
    summary.textContent = "船便を選択すると、保存済みの船積商品を表示します。";
    if (printButton) printButton.disabled = true;
    hideShippingWarehouseEditor();
    return;
  }

  const search = String(document.querySelector("#shipping-warehouse-search")?.value || "").trim().toLowerCase();
  const saved = getSavedAllocationsForSchedule(schedule.id);
  const rows = saved
    .map(function (allocation) {
      const code = String(allocation.internalCode || "").trim();
      const product = shippingScheduleProducts.find(function (item) {
        return String(item.internalCode || "").trim() === code;
      }) || {};
      const shipQuantity = Number(allocation.quantity) || 0;
      const warehouseQuantity = getShippingWarehouseAllocatedQuantity(schedule.id, code);
      const remaining = Math.max(0, shipQuantity - warehouseQuantity);
      return {
        internalCode: code,
        productCode: allocation.productCode || product.productCode || "",
        productName: allocation.productName || product.productName || "",
        shipQuantity: shipQuantity,
        warehouseQuantity: warehouseQuantity,
        remaining: remaining,
        currentLocation: product.location || ""
      };
    })
    .filter(function (row) {
      if (!search) return true;
      return [row.internalCode, row.productCode, row.productName]
        .map(function (value) { return String(value || "").toLowerCase(); })
        .some(function (value) { return value.includes(search); });
    })
    .sort(function (a, b) {
      if (b.remaining !== a.remaining) return b.remaining - a.remaining;
      return a.internalCode.localeCompare(b.internalCode, "ja", { numeric: true });
    });

  const totalShip = saved.reduce(function (sum, row) { return sum + (Number(row.quantity) || 0); }, 0);
  const allWarehouse = getShippingWarehouseRecordsForSchedule(schedule.id).reduce(function (sum, row) {
    return sum + (Number(row.quantity) || 0);
  }, 0);
  const totalRemaining = Math.max(0, totalShip - allWarehouse);
  const completeProducts = saved.filter(function (allocation) {
    const code = String(allocation.internalCode || "").trim();
    return getShippingWarehouseAllocatedQuantity(schedule.id, code) === (Number(allocation.quantity) || 0);
  }).length;

  summary.textContent =
    `${schedule.name}｜船積 ${saved.length.toLocaleString("ja-JP")}商品・${totalShip.toLocaleString("ja-JP")}個 / ` +
    `倉庫振分済 ${allWarehouse.toLocaleString("ja-JP")}個 / ` +
    `未振分 ${totalRemaining.toLocaleString("ja-JP")}個 / 完了 ${completeProducts.toLocaleString("ja-JP")}商品`;

  if (rows.length === 0) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 8;
    cell.textContent = saved.length === 0
      ? "この船便には保存済みの船積商品がありません。先に「船便別に商品を振り分ける」で数量を保存してください。"
      : "検索条件に一致する商品はありません。";
    row.appendChild(cell);
    body.appendChild(row);
  } else {
    rows.forEach(function (item) {
      const row = document.createElement("tr");
      appendShippingScheduleCell(row, item.internalCode);
      appendShippingScheduleCell(row, item.productCode || "-");
      appendShippingScheduleCell(row, item.productName || "");
      appendShippingScheduleCell(row, `${item.shipQuantity.toLocaleString("ja-JP")}個`);
      appendShippingScheduleCell(row, `${item.warehouseQuantity.toLocaleString("ja-JP")}個`);
      appendShippingScheduleCell(row, `${item.remaining.toLocaleString("ja-JP")}個`);

      const statusCell = document.createElement("td");
      const status = document.createElement("strong");
      if (item.remaining === 0 && item.shipQuantity > 0) {
        status.textContent = "振分完了";
        status.className = "shipping-warehouse-status-complete";
      } else {
        status.textContent = "未完了";
        status.className = "shipping-warehouse-status-pending";
      }
      statusCell.appendChild(status);
      row.appendChild(statusCell);

      const actionCell = document.createElement("td");
      const button = document.createElement("button");
      button.type = "button";
      const scheduleReceived = isShippingScheduleReceived(schedule.id);
      button.textContent = scheduleReceived
        ? "入荷反映済"
        : (item.warehouseQuantity > 0 ? "振分けを編集" : "倉庫へ振り分ける");
      button.disabled = scheduleReceived;
      button.addEventListener("click", function () {
        openShippingWarehouseEditor(item.internalCode);
      });
      actionCell.appendChild(button);
      row.appendChild(actionCell);
      body.appendChild(row);
    });
  }

  if (printButton) printButton.disabled = saved.length === 0;
}

function openShippingWarehouseEditor(internalCode) {
  const schedule = getSelectedShippingWarehouseSchedule();
  if (!schedule) return;
  if (isShippingScheduleReceived(schedule.id)) {
    alert("この船便はすでに在庫へ入荷反映済みのため、倉庫別振分けは編集できません。");
    return;
  }
  const saved = getSavedAllocationsForSchedule(schedule.id).find(function (allocation) {
    return String(allocation.internalCode || "").trim() === String(internalCode || "").trim();
  });
  if (!saved) return;

  const product = shippingScheduleProducts.find(function (item) {
    return String(item.internalCode || "").trim() === String(internalCode || "").trim();
  }) || {};
  const shipQuantity = Number(saved.quantity) || 0;
  const existing = getShippingWarehouseRecordsForProduct(schedule.id, internalCode);
  const byDestination = new Map(existing.map(function (record) {
    return [record.destination, Number(record.quantity) || 0];
  }));

  shippingWarehouseEditingInternalCode = String(internalCode || "").trim();
  const editor = document.querySelector("#shipping-warehouse-editor");
  const title = document.querySelector("#shipping-warehouse-editor-title");
  const grid = document.querySelector("#shipping-warehouse-location-grid");
  if (!editor || !grid) return;

  if (title) {
    title.textContent = `${saved.productName || product.productName || internalCode} を倉庫へ振り分ける`;
  }
  editor.dataset.shipQuantity = String(shipQuantity);
  editor.dataset.currentLocation = String(product.location || "");
  grid.innerHTML = "";

  SHIPPING_DESTINATION_LOCATIONS.forEach(function (destination) {
    const item = document.createElement("div");
    item.className = "shipping-warehouse-location-item";
    const label = document.createElement("label");
    label.textContent = destination;
    if (destination === product.location) {
      const current = document.createElement("small");
      current.textContent = "現在の保管場所";
      label.appendChild(current);
    }
    const input = document.createElement("input");
    input.type = "number";
    input.min = "0";
    input.step = "1";
    input.value = String(byDestination.get(destination) || 0);
    input.className = "shipping-warehouse-location-input";
    input.dataset.destination = destination;
    input.addEventListener("input", updateShippingWarehouseEditorSummary);
    item.appendChild(label);
    item.appendChild(input);
    grid.appendChild(item);
  });

  editor.hidden = false;
  updateShippingWarehouseEditorSummary();
  editor.scrollIntoView({ behavior: "smooth", block: "start" });
}

function hideShippingWarehouseEditor() {
  shippingWarehouseEditingInternalCode = "";
  const editor = document.querySelector("#shipping-warehouse-editor");
  if (editor) editor.hidden = true;
}

function getShippingWarehouseEditorInputTotal() {
  return Array.from(document.querySelectorAll("#shipping-warehouse-location-grid .shipping-warehouse-location-input"))
    .reduce(function (sum, input) {
      const value = Number(input.value);
      return sum + (Number.isFinite(value) && value > 0 ? value : 0);
    }, 0);
}

function updateShippingWarehouseEditorSummary() {
  const editor = document.querySelector("#shipping-warehouse-editor");
  const summary = document.querySelector("#shipping-warehouse-editor-summary");
  if (!editor || !summary || editor.hidden) return;
  const shipQuantity = Number(editor.dataset.shipQuantity || 0);
  const allocated = getShippingWarehouseEditorInputTotal();
  const remaining = shipQuantity - allocated;
  summary.textContent =
    `船積数量：${shipQuantity.toLocaleString("ja-JP")}個 / ` +
    `入力合計：${allocated.toLocaleString("ja-JP")}個 / ` +
    `${remaining >= 0 ? "未振分" : "超過"}：${Math.abs(remaining).toLocaleString("ja-JP")}個`;
  summary.classList.toggle("shipping-warehouse-over", remaining < 0);
}

function fillShippingWarehouseCurrentLocation() {
  const editor = document.querySelector("#shipping-warehouse-editor");
  if (!editor || editor.hidden) return;
  const currentLocation = String(editor.dataset.currentLocation || "");
  const shipQuantity = Number(editor.dataset.shipQuantity || 0);
  if (!SHIPPING_DESTINATION_LOCATIONS.includes(currentLocation)) {
    alert("この商品の現在の保管場所が倉庫振分け候補にありません。手入力で振り分けてください。");
    return;
  }
  document.querySelectorAll("#shipping-warehouse-location-grid .shipping-warehouse-location-input").forEach(function (input) {
    input.value = input.dataset.destination === currentLocation ? String(shipQuantity) : "0";
  });
  updateShippingWarehouseEditorSummary();
}

function clearShippingWarehouseInputs() {
  document.querySelectorAll("#shipping-warehouse-location-grid .shipping-warehouse-location-input").forEach(function (input) {
    input.value = "0";
  });
  updateShippingWarehouseEditorSummary();
}

async function saveShippingWarehouseEditor() {
  const schedule = getSelectedShippingWarehouseSchedule();
  const internalCode = shippingWarehouseEditingInternalCode;
  if (!schedule || !internalCode) return;
  if (isShippingScheduleReceived(schedule.id)) {
    alert("この船便はすでに在庫へ入荷反映済みのため、倉庫別振分けは変更できません。");
    return;
  }

  const saved = getSavedAllocationsForSchedule(schedule.id).find(function (allocation) {
    return String(allocation.internalCode || "").trim() === internalCode;
  });
  if (!saved) {
    alert("この商品の船積数量が見つかりません。画面を更新してもう一度お試しください。");
    return;
  }

  const shipQuantity = Number(saved.quantity) || 0;
  const inputs = Array.from(document.querySelectorAll("#shipping-warehouse-location-grid .shipping-warehouse-location-input"));
  const entries = [];
  for (const input of inputs) {
    const quantity = Number(input.value);
    if (!Number.isInteger(quantity) || quantity < 0) {
      alert(`${input.dataset.destination} の数量は0以上の整数で入力してください。`);
      input.focus();
      return;
    }
    if (quantity > 0) entries.push({ destination: input.dataset.destination, quantity: quantity });
  }

  const total = entries.reduce(function (sum, entry) { return sum + entry.quantity; }, 0);
  if (total > shipQuantity) {
    alert(
      `倉庫への振分合計が船積数量を超えています。\n\n` +
      `船積数量：${shipQuantity.toLocaleString("ja-JP")}個\n` +
      `倉庫振分合計：${total.toLocaleString("ja-JP")}個\n` +
      `超過：${(total - shipQuantity).toLocaleString("ja-JP")}個`
    );
    return;
  }

  const remaining = shipQuantity - total;
  let message =
    `${saved.productName || internalCode} の倉庫振分けを保存します。\n\n` +
    `船積数量：${shipQuantity.toLocaleString("ja-JP")}個\n` +
    `倉庫振分合計：${total.toLocaleString("ja-JP")}個\n` +
    `未振分：${remaining.toLocaleString("ja-JP")}個`;
  if (remaining > 0) message += "\n\n未振分が残っています。この状態でも保存できます。";
  message += "\n\nよろしいですか？";
  if (!window.confirm(message)) return;

  try {
    const existing = getShippingWarehouseRecordsForProduct(schedule.id, internalCode);
    for (const record of existing) {
      await deleteShippingWarehouseAllocation(record.id);
    }

    const product = shippingScheduleProducts.find(function (item) {
      return String(item.internalCode || "").trim() === internalCode;
    }) || {};
    const now = new Date().toISOString();
    for (const entry of entries) {
      await saveShippingWarehouseAllocation({
        id: createShippingWarehouseAllocationId(schedule.id, internalCode, entry.destination),
        scheduleId: schedule.id,
        internalCode: internalCode,
        productCode: saved.productCode || product.productCode || "",
        productName: saved.productName || product.productName || "",
        destination: entry.destination,
        quantity: entry.quantity,
        updatedAt: now
      });
    }

    shippingWarehouseAllocations = await getAllShippingWarehouseAllocations();
    renderShippingWarehouseProductTable();
    hideShippingWarehouseEditor();
    alert(remaining === 0 ? "倉庫への振分けを保存しました。振分完了です。" : "倉庫への振分けを保存しました。未振分数量が残っています。");
  } catch (error) {
    console.error("倉庫別振分け保存エラー", error);
    alert("倉庫への振分けを保存できませんでした。");
  }
}

function createShippingWarehouseAllocationId(scheduleId, internalCode, destination) {
  return `${scheduleId}::warehouse::${encodeURIComponent(internalCode)}::${encodeURIComponent(destination)}`;
}

function printShippingWarehouseList() {
  const schedule = getSelectedShippingWarehouseSchedule();
  if (!schedule) {
    alert("印刷する船便を選択してください。");
    return;
  }

  const saved = getSavedAllocationsForSchedule(schedule.id);
  if (saved.length === 0) {
    alert("この船便には保存済みの船積商品がありません。");
    return;
  }

  const destinationGroups = new Map();
  SHIPPING_DESTINATION_LOCATIONS.forEach(function (destination) {
    destinationGroups.set(destination, []);
  });

  getShippingWarehouseRecordsForSchedule(schedule.id).forEach(function (record) {
    if (!destinationGroups.has(record.destination)) destinationGroups.set(record.destination, []);
    destinationGroups.get(record.destination).push(record);
  });

  const unallocated = saved.map(function (allocation) {
    const code = String(allocation.internalCode || "").trim();
    const shipQuantity = Number(allocation.quantity) || 0;
    const warehouseQuantity = getShippingWarehouseAllocatedQuantity(schedule.id, code);
    return {
      internalCode: code,
      productCode: allocation.productCode || "",
      productName: allocation.productName || "",
      shipQuantity: shipQuantity,
      allocatedQuantity: warehouseQuantity,
      remaining: Math.max(0, shipQuantity - warehouseQuantity)
    };
  }).filter(function (row) { return row.remaining > 0; });

  const groupHtml = Array.from(destinationGroups.entries())
    .filter(function (entry) { return entry[1].length > 0; })
    .map(function (entry) {
      const destination = entry[0];
      const rows = entry[1].slice().sort(function (a, b) {
        return String(a.internalCode || "").localeCompare(String(b.internalCode || ""), "ja", { numeric: true });
      });
      const total = rows.reduce(function (sum, row) { return sum + (Number(row.quantity) || 0); }, 0);
      const tr = rows.map(function (row, index) {
        return `<tr><td>${index + 1}</td><td>${escapeShippingHtml(row.internalCode)}</td><td>${escapeShippingHtml(row.productCode || "-")}</td><td>${escapeShippingHtml(row.productName)}</td><td class="num strong">${(Number(row.quantity) || 0).toLocaleString("ja-JP")}</td></tr>`;
      }).join("");
      return `<section class="warehouse"><h2>${escapeShippingHtml(destination)}　合計 ${total.toLocaleString("ja-JP")}個</h2><table><thead><tr><th style="width:7%">No</th><th style="width:18%">社内コード</th><th style="width:20%">商品コード</th><th>商品名</th><th style="width:15%">数量</th></tr></thead><tbody>${tr}</tbody></table></section>`;
    }).join("");

  const unallocatedHtml = unallocated.length > 0
    ? `<section class="warehouse warning"><h2>未振分商品</h2><table><thead><tr><th>No</th><th>社内コード</th><th>商品コード</th><th>商品名</th><th>船積数量</th><th>振分済</th><th>未振分</th></tr></thead><tbody>${unallocated.map(function (row, index) { return `<tr><td>${index + 1}</td><td>${escapeShippingHtml(row.internalCode)}</td><td>${escapeShippingHtml(row.productCode || "-")}</td><td>${escapeShippingHtml(row.productName)}</td><td class="num">${row.shipQuantity.toLocaleString("ja-JP")}</td><td class="num">${row.allocatedQuantity.toLocaleString("ja-JP")}</td><td class="num strong">${row.remaining.toLocaleString("ja-JP")}</td></tr>`; }).join("")}</tbody></table></section>`
    : "";

  const totalShip = saved.reduce(function (sum, row) { return sum + (Number(row.quantity) || 0); }, 0);
  const totalAllocated = getShippingWarehouseRecordsForSchedule(schedule.id).reduce(function (sum, row) { return sum + (Number(row.quantity) || 0); }, 0);
  const html = `<!doctype html><html lang="ja"><head><meta charset="utf-8"><title>${escapeShippingHtml(schedule.name)} 倉庫別振分け</title><style>
    @page { size: A4 portrait; margin: 10mm; }
    * { box-sizing: border-box; }
    body { margin:0; font-family:"Yu Gothic","Meiryo",sans-serif; color:#111; font-size:10pt; }
    h1 { margin:0 0 8px; font-size:17pt; }
    .meta { margin-bottom:10px; padding:8px; background:#f3f4f6; line-height:1.7; }
    .warehouse { break-inside: avoid; margin:0 0 14px; }
    .warehouse h2 { margin:0 0 5px; padding:5px 7px; background:#e8eef4; font-size:12pt; }
    .warning h2 { background:#fff3e0; }
    table { width:100%; border-collapse:collapse; }
    th,td { border:1px solid #777; padding:4px 5px; vertical-align:middle; }
    th { background:#f5f5f5; }
    .num { text-align:right; }
    .strong { font-weight:700; }
    .footer { margin-top:8px; font-size:8pt; color:#555; }
  </style></head><body>
    <h1>倉庫別 船積振分けリスト　${escapeShippingHtml(schedule.name)}</h1>
    <div class="meta"><strong>出港日：</strong>${escapeShippingHtml(formatShippingDate(schedule.departureDate))}　 <strong>入港日：</strong>${escapeShippingHtml(formatShippingDate(schedule.arrivalDate))}　 <strong>倉庫到着日：</strong>${escapeShippingHtml(formatShippingDate(schedule.warehouseArrivalDate))}<br><strong>船積数量合計：</strong>${totalShip.toLocaleString("ja-JP")}個　 <strong>倉庫振分済：</strong>${totalAllocated.toLocaleString("ja-JP")}個　 <strong>未振分：</strong>${Math.max(0,totalShip-totalAllocated).toLocaleString("ja-JP")}個　 <strong>印刷日：</strong>${escapeShippingHtml(formatShippingDateForPrint(new Date()))}</div>
    ${groupHtml || '<p>倉庫への振分けはまだ登録されていません。</p>'}
    ${unallocatedHtml}
    <div class="footer">バーコード在庫・棚卸管理アプリ v47</div>
  </body></html>`;

  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  iframe.setAttribute("aria-hidden", "true");
  document.body.appendChild(iframe);
  const printWindow = iframe.contentWindow;
  const printDocument = iframe.contentDocument || printWindow.document;
  printDocument.open();
  printDocument.write(html);
  printDocument.close();
  window.setTimeout(function () {
    try { printWindow.focus(); printWindow.print(); }
    finally { window.setTimeout(function () { iframe.remove(); }, 1500); }
  }, 300);
}

function buildShippingAverageContext(targetMonth) {
  const match = /^(\d{4})-(\d{2})$/.exec(String(targetMonth || ""));
  if (!match) return { monthKeys: [], startMonth: "", endMonth: "" };
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const monthKeys = [];
  for (let offset = 6; offset >= 1; offset -= 1) {
    const date = new Date(year, monthIndex - offset, 1);
    monthKeys.push(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`);
  }
  return {
    monthKeys: monthKeys,
    startMonth: monthKeys[0] || "",
    endMonth: monthKeys[monthKeys.length - 1] || ""
  };
}

function aggregateShippingActuals(monthKeys) {
  const monthSet = new Set(monthKeys);
  const result = new Map();
  shippingScheduleSalesActuals.forEach(function (record) {
    const saleDate = String(record.saleDate || "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(saleDate)) return;
    if (!monthSet.has(saleDate.slice(0, 7))) return;
    const code = String(record.internalCode || "").trim();
    if (!code) return;
    const quantity = Number(record.quantity || 0);
    if (!Number.isFinite(quantity)) return;
    result.set(code, (result.get(code) || 0) + quantity);
  });
  return result;
}

function aggregateShippingPlansForRange(startDate, endDate) {
  const raw = new Map();
  if (!isShippingIsoDate(startDate) || !isShippingIsoDate(endDate) || startDate > endDate) return new Map();

  shippingScheduleSalesPlans.forEach(function (plan) {
    const code = String(plan.internalCode || "").trim();
    if (!code) return;
    const quantity = Number(plan.quantity || 0);
    if (!Number.isFinite(quantity) || quantity === 0) return;

    const planRange = getShippingPlanDateRange(plan);
    if (!planRange) return;

    const overlapStart = planRange.startDate > startDate ? planRange.startDate : startDate;
    const overlapEnd = planRange.endDate < endDate ? planRange.endDate : endDate;
    if (overlapStart > overlapEnd) return;

    let contribution = quantity;
    if (planRange.startDate !== planRange.endDate) {
      const totalDays = getShippingInclusiveDayCount(planRange.startDate, planRange.endDate);
      const overlapDays = getShippingInclusiveDayCount(overlapStart, overlapEnd);
      if (totalDays <= 0 || overlapDays <= 0) return;
      contribution = quantity * (overlapDays / totalDays);
    }

    raw.set(code, (raw.get(code) || 0) + contribution);
  });

  const rounded = new Map();
  raw.forEach(function (value, code) {
    rounded.set(code, Math.ceil(value));
  });
  return rounded;
}

function getShippingPlanDateRange(plan) {
  const type = getShippingPlanType(plan);
  if (type === "date") {
    return { startDate: plan.shippingDate, endDate: plan.shippingDate };
  }
  if (type === "period") {
    return { startDate: plan.shippingStartDate, endDate: plan.shippingEndDate };
  }
  if (type === "month") {
    return {
      startDate: `${plan.shippingMonth}-01`,
      endDate: getShippingLastDateOfMonth(plan.shippingMonth)
    };
  }
  return null;
}

function shippingPlanOverlapsRange(plan, startDate, endDate) {
  const type = getShippingPlanType(plan);
  if (type === "date") return plan.shippingDate >= startDate && plan.shippingDate <= endDate;
  if (type === "period") return plan.shippingStartDate <= endDate && plan.shippingEndDate >= startDate;
  if (type === "month") {
    const monthStart = `${plan.shippingMonth}-01`;
    const monthEnd = getShippingLastDateOfMonth(plan.shippingMonth);
    return monthStart <= endDate && monthEnd >= startDate;
  }
  return false;
}

function getShippingPlanType(plan) {
  if (plan && plan.shippingType === "date" && isShippingIsoDate(plan.shippingDate)) return "date";
  if (plan && plan.shippingType === "period" && isShippingIsoDate(plan.shippingStartDate) && isShippingIsoDate(plan.shippingEndDate)) return "period";
  if (plan && isShippingIsoDate(plan.shippingDate)) return "date";
  if (plan && isShippingIsoDate(plan.shippingStartDate) && isShippingIsoDate(plan.shippingEndDate)) return "period";
  if (plan && /^\d{4}-\d{2}$/.test(String(plan.shippingMonth || ""))) return "month";
  return "unknown";
}

function getShippingTargetPeriod(currentSchedule) {
  if (!currentSchedule || !isShippingIsoDate(currentSchedule.warehouseArrivalDate)) {
    return { valid: false, startDate: "", endDate: "", days: 0, nextSchedule: null };
  }

  const currentDate = currentSchedule.warehouseArrivalDate;
  const nextSchedule = shippingScheduleRecords
    .filter(function (record) {
      return record.id !== currentSchedule.id &&
        isShippingIsoDate(record.warehouseArrivalDate) &&
        record.warehouseArrivalDate > currentDate;
    })
    .sort(compareShippingScheduleChronology)[0] || null;

  if (!nextSchedule) {
    return { valid: false, startDate: currentDate, endDate: "", days: 0, nextSchedule: null };
  }

  const endDate = addShippingDays(nextSchedule.warehouseArrivalDate, -1);
  const days = getShippingInclusiveDayCount(currentDate, endDate);
  if (!isShippingIsoDate(endDate) || days <= 0) {
    return { valid: false, startDate: currentDate, endDate: endDate, days: 0, nextSchedule: nextSchedule };
  }

  return {
    valid: true,
    startDate: currentDate,
    endDate: endDate,
    days: days,
    nextSchedule: nextSchedule
  };
}

function getShippingInclusiveDayCount(startDate, endDate) {
  if (!isShippingIsoDate(startDate) || !isShippingIsoDate(endDate) || startDate > endDate) return 0;
  const start = parseShippingIsoDate(startDate);
  const end = parseShippingIsoDate(endDate);
  if (!start || !end) return 0;
  return Math.floor((end.getTime() - start.getTime()) / 86400000) + 1;
}

function addShippingDays(value, days) {
  const date = parseShippingIsoDate(value);
  if (!date) return "";
  date.setUTCDate(date.getUTCDate() + Number(days || 0));
  return formatShippingIsoDate(date);
}

function parseShippingIsoDate(value) {
  if (!isShippingIsoDate(value)) return null;
  const parts = String(value).split("-").map(Number);
  const date = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
  if (
    date.getUTCFullYear() !== parts[0] ||
    date.getUTCMonth() !== parts[1] - 1 ||
    date.getUTCDate() !== parts[2]
  ) return null;
  return date;
}

function formatShippingIsoDate(date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function getPriorShippingScheduleIds(currentSchedule) {
  const currentDate = String(currentSchedule && currentSchedule.warehouseArrivalDate || "");
  if (!isShippingIsoDate(currentDate)) return new Set();

  return new Set(
    shippingScheduleRecords
      .filter(function (record) {
        const alreadyReceived = shippingArrivalReceipts.some(function (receipt) {
          return receipt.scheduleId === record.id || receipt.id === record.id;
        });
        return record.id !== currentSchedule.id &&
          !alreadyReceived &&
          isShippingIsoDate(record.warehouseArrivalDate) &&
          record.warehouseArrivalDate < currentDate;
      })
      .map(function (record) { return record.id; })
  );
}

function compareShippingScheduleChronology(a, b) {
  const aWarehouse = a.warehouseArrivalDate || "9999-99-99";
  const bWarehouse = b.warehouseArrivalDate || "9999-99-99";
  if (aWarehouse !== bWarehouse) return aWarehouse.localeCompare(bWarehouse);
  const aDeparture = a.departureDate || "9999-99-99";
  const bDeparture = b.departureDate || "9999-99-99";
  if (aDeparture !== bDeparture) return aDeparture.localeCompare(bDeparture);
  return String(a.id || "").localeCompare(String(b.id || ""));
}

function getAllocatedQuantityForProductInSchedules(internalCode, scheduleIds) {
  if (!scheduleIds || scheduleIds.size === 0) return 0;
  return shippingScheduleAllocations
    .filter(function (allocation) {
      return scheduleIds.has(allocation.scheduleId) &&
        String(allocation.internalCode || "").trim() === internalCode;
    })
    .reduce(function (sum, allocation) {
      return sum + (Number(allocation.quantity) || 0);
    }, 0);
}

function getCurrentScheduleAllocationQuantity(scheduleId, internalCode) {
  return getAllocationRecordsForScheduleProduct(scheduleId, internalCode)
    .reduce(function (sum, allocation) {
      return sum + (Number(allocation.quantity) || 0);
    }, 0);
}

function getAllocationRecordsForScheduleProduct(scheduleId, internalCode) {
  return shippingScheduleAllocations.filter(function (allocation) {
    return allocation.scheduleId === scheduleId &&
      String(allocation.internalCode || "").trim() === internalCode;
  });
}

function getSavedAllocationsForSchedule(scheduleId) {
  const merged = new Map();
  shippingScheduleAllocations
    .filter(function (allocation) {
      return allocation.scheduleId === scheduleId && Number(allocation.quantity) > 0;
    })
    .forEach(function (allocation) {
      const code = String(allocation.internalCode || "").trim();
      if (!code) return;
      const current = merged.get(code) || {
        internalCode: code,
        productCode: allocation.productCode || "",
        productName: allocation.productName || "",
        quantity: 0
      };
      current.quantity += Number(allocation.quantity) || 0;
      if (!current.productCode && allocation.productCode) current.productCode = allocation.productCode;
      if (!current.productName && allocation.productName) current.productName = allocation.productName;
      merged.set(code, current);
    });
  return Array.from(merged.values());
}

function getUniqueAllocationProductCount(allocations) {
  return new Set(
    allocations
      .filter(function (allocation) { return Number(allocation.quantity) > 0; })
      .map(function (allocation) { return String(allocation.internalCode || "").trim(); })
      .filter(Boolean)
  ).size;
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

function createShippingScheduleId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return `shipping-schedule-${window.crypto.randomUUID()}`;
  }
  return `shipping-schedule-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function createShippingProductAllocationId(scheduleId, internalCode) {
  return `${scheduleId}::product::${encodeURIComponent(internalCode)}`;
}

function formatShippingDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) return value || "";
  const parts = value.split("-");
  return `${Number(parts[0])}/${Number(parts[1])}/${Number(parts[2])}`;
}

function formatShippingMonth(value) {
  const match = /^(\d{4})-(\d{2})$/.exec(String(value || ""));
  if (!match) return value || "";
  return `${Number(match[1])}年${Number(match[2])}月`;
}

function formatShippingDateForPrint(date) {
  return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;
}

function formatShippingQuantity(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "0";
  return Number.isInteger(number)
    ? number.toLocaleString("ja-JP")
    : number.toLocaleString("ja-JP", { maximumFractionDigits: 2 });
}

function formatShippingPrintNumber(value) {
  if (value === "" || value === null || typeof value === "undefined") return "-";
  const number = Number(value);
  return Number.isFinite(number) ? number.toLocaleString("ja-JP") : "-";
}

function getShippingNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function isShippingDiscontinuedProduct(product) {
  const status = String(product && (product.productStatus || product.status || "") || "").trim().toLowerCase();
  return status === "廃盤" || status === "discontinued" || Boolean(product && product.discontinued === true);
}

function isShippingIsoDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));
}

function getShippingLastDateOfMonth(month) {
  const match = /^(\d{4})-(\d{2})$/.exec(String(month || ""));
  if (!match) return "";
  const lastDay = new Date(Number(match[1]), Number(match[2]), 0).getDate();
  return `${match[1]}-${match[2]}-${String(lastDay).padStart(2, "0")}`;
}

function escapeShippingHtml(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
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
    #shipping-schedule .shipping-target-warning {
      color: #c62828;
      font-weight: 700;
    }
    #shipping-schedule .shipping-allocation-note {
      margin: 10px 0;
      padding: 10px 12px;
      border-radius: 10px;
      background: #fff3e0;
      color: #8a3b00;
      line-height: 1.7;
    }
    #shipping-schedule .shipping-schedule-table-wrap,
    #shipping-schedule .shipping-allocation-table-wrap {
      overflow-x: auto;
      max-width: 100%;
    }
    #shipping-schedule table {
      width: 100%;
      min-width: 1180px;
      border-collapse: collapse;
    }
    #shipping-schedule th,
    #shipping-schedule td {
      padding: 10px;
      border-bottom: 1px solid #cfd8dc;
      text-align: left;
      vertical-align: middle;
    }
    #shipping-schedule .shipping-schedule-actions { white-space: nowrap; }
    #shipping-schedule .shipping-schedule-delete { background: #d32f2f; }
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
    #shipping-schedule #print-shipping-allocation-list { background: #455a64; }
    #shipping-schedule #print-shipping-warehouse-list { background: #455a64; }
    #shipping-schedule .shipping-warehouse-editor {
      margin: 18px 0 6px;
      padding: 16px;
      border: 2px solid #90a4ae;
      border-radius: 12px;
      background: #fafcfd;
    }
    #shipping-schedule .shipping-warehouse-location-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px 14px;
      margin: 12px 0;
    }
    #shipping-schedule .shipping-warehouse-location-item {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 120px;
      gap: 10px;
      align-items: center;
      padding: 8px 10px;
      border: 1px solid #d7dee2;
      border-radius: 9px;
      background: #fff;
    }
    #shipping-schedule .shipping-warehouse-location-item label { margin: 0; }
    #shipping-schedule .shipping-warehouse-location-item small {
      display: block;
      color: #1976d2;
      font-weight: 700;
    }
    #shipping-schedule .shipping-warehouse-quick-actions {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      margin: 10px 0;
    }
    #shipping-schedule .shipping-warehouse-status-complete { color: #2e7d32; }
    #shipping-schedule .shipping-warehouse-status-pending { color: #ef6c00; }
    #shipping-schedule .shipping-warehouse-over {
      background: #ffebee;
      color: #c62828;
    }
    #shipping-schedule .shipping-received-note {
      color: #2e7d32;
      font-weight: 700;
    }
    @media (max-width: 760px) {
      #shipping-schedule .shipping-schedule-grid,
      #shipping-schedule .shipping-allocation-controls,
      #shipping-schedule .shipping-warehouse-location-grid { grid-template-columns: 1fr; }
      #shipping-schedule .shipping-warehouse-location-item { grid-template-columns: 1fr 110px; }
      #shipping-schedule .shipping-schedule-card { padding: 14px; }
    }
  `;
  document.head.appendChild(style);
}


window.shippingScheduleFeature = {
  refresh: refreshShippingScheduleData
};
