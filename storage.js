"use strict";

const DATABASE_NAME =
  "barcodeInventoryDatabase";

const DATABASE_VERSION = 15;

const PRODUCT_STORE_NAME =
  "products";

const MOVEMENT_STORE_NAME =
  "stockMovements";

const STOCKTAKING_STORE_NAME =
  "stocktakings";

const STOCKTAKING_SUBMISSION_STORE_NAME =
  "stocktakingSubmissions";

const STOCKTAKING_AGGREGATION_REFLECTION_STORE_NAME =
  "stocktakingAggregationReflections";

const RESTORE_LOG_STORE_NAME =
  "restoreLogs";

const SALES_PLAN_STORE_NAME =
  "salesPlans";

const SALES_ACTUAL_STORE_NAME =
  "salesActuals";

const SALES_IMPORT_BATCH_STORE_NAME =
  "salesImportBatches";

const SHIPPING_WISH_STORE_NAME =
  "shippingWishes";

const SHIPPING_SCHEDULE_STORE_NAME =
  "shippingSchedules";

const SHIPPING_ALLOCATION_STORE_NAME =
  "shippingAllocations";

const SHIPPING_WAREHOUSE_ALLOCATION_STORE_NAME =
  "shippingWarehouseAllocations";

const SHIPPING_ARRIVAL_RECEIPT_STORE_NAME =
  "shippingArrivalReceipts";

const TRANSFER_LIST_STORE_NAME =
  "transferLists";

const ORDER_REMAINING_HISTORY_STORE_NAME =
  "orderRemainingHistories";

const LOCATION_STOCK_UNCONFIRMED_NAME =
  "未確認";

const SALES_ACTUAL_OUTBOUND_LOCATION_PRIORITY = Object.freeze([
  "本社1階 A区",
  "本社1階 B区",
  "本社1階 C区",
  "本社1階 D区",
  "本社1階 E区",
  "本社1階 F区",
  "本社2階 A区",
  "本社2階 B区",
  "本社2階 C区",
  "本社2階 D区",
  "本社2階 E区",
  "本社2階 F区",
  "酒本倉庫1階",
  "酒本倉庫2階"
]);

const SALES_ACTUAL_RETURN_LOCATION =
  "本社1階 A区";

const LOCATION_STOCK_DISPLAY_ORDER = Object.freeze([
  ...SALES_ACTUAL_OUTBOUND_LOCATION_PRIORITY,
  LOCATION_STOCK_UNCONFIRMED_NAME
]);

function sortLocationStocksByDisplayOrder(entries) {
  const order = new Map(
    LOCATION_STOCK_DISPLAY_ORDER.map(function (location, index) {
      return [location, index];
    })
  );

  return (Array.isArray(entries) ? entries : []).slice().sort(
    function (left, right) {
      const leftLocation = normalizeLocationStockName(left && left.location);
      const rightLocation = normalizeLocationStockName(right && right.location);
      const leftIndex = order.has(leftLocation) ? order.get(leftLocation) : 999;
      const rightIndex = order.has(rightLocation) ? order.get(rightLocation) : 999;

      if (leftIndex !== rightIndex) {
        return leftIndex - rightIndex;
      }

      return leftLocation.localeCompare(rightLocation, "ja");
    }
  );
}

function normalizeLocationStockName(value) {
  let location = String(value || "")
    .normalize("NFKC")
    .trim()
    .replace(/[\s\u3000]+/g, " ");

  if (location === "") {
    return "";
  }

  const headquartersMatch = location.match(
    /^本社([12])階\s*([A-Fa-f])区$/
  );

  if (headquartersMatch) {
    return (
      `本社${headquartersMatch[1]}階 ` +
      `${headquartersMatch[2].toUpperCase()}区`
    );
  }

  if (location === "酒本倉庫1階") {
    return "酒本倉庫1階";
  }

  if (location === "酒本倉庫2階") {
    return "酒本倉庫2階";
  }

  if (location === LOCATION_STOCK_UNCONFIRMED_NAME) {
    return LOCATION_STOCK_UNCONFIRMED_NAME;
  }

  return location;
}

function normalizeLocationStockQuantity(value) {
  const quantity = Number(value);

  if (!Number.isFinite(quantity)) {
    return 0;
  }

  return Math.max(0, Math.trunc(quantity));
}

function getProductLocationStocks(product) {
  const targetStock =
    normalizeLocationStockQuantity(
      product && product.stock
    );

  const primaryLocation =
    normalizeLocationStockName(
      product && product.location
    );

  const merged = new Map();
  const savedLocationStocks =
    product && Array.isArray(product.locationStocks)
      ? product.locationStocks
      : [];

  savedLocationStocks.forEach(function (entry) {
    const location = normalizeLocationStockName(
      entry && entry.location
    );

    if (location === "") {
      return;
    }

    const quantity =
      normalizeLocationStockQuantity(
        entry && entry.stock
      );

    merged.set(
      location,
      (merged.get(location) || 0) + quantity
    );
  });

  let entries = Array.from(
    merged,
    function ([location, stock]) {
      return {
        location: location,
        stock: stock
      };
    }
  );

  if (entries.length === 0) {
    if (
      primaryLocation !== "" ||
      targetStock > 0
    ) {
      entries.push({
        location:
          primaryLocation ||
          LOCATION_STOCK_UNCONFIRMED_NAME,
        stock: targetStock
      });
    }

    return sortLocationStocksByDisplayOrder(entries);
  }

  const currentTotal = entries.reduce(
    function (sum, entry) {
      return sum + entry.stock;
    },
    0
  );

  const difference = targetStock - currentTotal;

  if (difference > 0) {
    let targetEntry = entries.find(
      function (entry) {
        return (
          primaryLocation !== "" &&
          entry.location === primaryLocation
        );
      }
    );

    if (!targetEntry) {
      targetEntry = entries[0];
    }

    if (!targetEntry) {
      targetEntry = {
        location:
          primaryLocation ||
          LOCATION_STOCK_UNCONFIRMED_NAME,
        stock: 0
      };
      entries.push(targetEntry);
    }

    targetEntry.stock += difference;
  } else if (difference < 0) {
    let remaining = Math.abs(difference);

    const orderedEntries = entries.slice().sort(
      function (left, right) {
        const leftPrimary =
          primaryLocation !== "" &&
          left.location === primaryLocation;
        const rightPrimary =
          primaryLocation !== "" &&
          right.location === primaryLocation;

        if (leftPrimary === rightPrimary) {
          return 0;
        }

        return leftPrimary ? -1 : 1;
      }
    );

    orderedEntries.forEach(function (entry) {
      if (remaining <= 0) {
        return;
      }

      const deduction = Math.min(
        entry.stock,
        remaining
      );

      entry.stock -= deduction;
      remaining -= deduction;
    });
  }

  entries = entries.filter(
    function (entry) {
      if (entry.stock > 0) {
        return true;
      }

      if (
        primaryLocation !== "" &&
        entry.location === primaryLocation
      ) {
        return true;
      }

      return targetStock === 0 && entries.length === 1;
    }
  );

  if (
    entries.length === 0 &&
    targetStock > 0
  ) {
    entries.push({
      location:
        primaryLocation ||
        LOCATION_STOCK_UNCONFIRMED_NAME,
      stock: targetStock
    });
  }

  return sortLocationStocksByDisplayOrder(entries);
}

function normalizeProductLocationStocks(product) {
  const source = product || {};

  return {
    ...source,
    locationStocks:
      getProductLocationStocks(source)
  };
}

function getLocationStocksAfterPrimaryLocationChange(
  product,
  nextLocation
) {
  const normalizedProduct =
    normalizeProductLocationStocks(
      product
    );

  const locationStocks =
    normalizedProduct.locationStocks.map(
      function (entry) {
        return {
          location: entry.location,
          stock: normalizeLocationStockQuantity(
            entry.stock
          )
        };
      }
    );

  const beforeLocation =
    normalizeLocationStockName(
      product && product.location
    );

  const afterLocation =
    normalizeLocationStockName(
      nextLocation
    );

  if (
    beforeLocation !== afterLocation &&
    locationStocks.length <= 1
  ) {
    if (
      afterLocation === "" &&
      normalizeLocationStockQuantity(
        product && product.stock
      ) <= 0
    ) {
      return [];
    }

    return [
      {
        location:
          afterLocation ||
          LOCATION_STOCK_UNCONFIRMED_NAME,
        stock: normalizeLocationStockQuantity(
          product && product.stock
        )
      }
    ];
  }

  return locationStocks;
}

async function migrateProductLocationStocks() {
  const database = await openDatabase();

  return new Promise(function (resolve, reject) {
    const transaction = database.transaction(
      PRODUCT_STORE_NAME,
      "readwrite"
    );
    const store = transaction.objectStore(
      PRODUCT_STORE_NAME
    );
    const request = store.getAll();
    let updatedCount = 0;

    request.onsuccess = function () {
      const records = request.result || [];

      records.forEach(function (product) {
        const normalized =
          normalizeProductLocationStocks(product);

        const before = Array.isArray(
          product.locationStocks
        )
          ? product.locationStocks
          : null;

        if (
          before === null ||
          JSON.stringify(before) !==
            JSON.stringify(
              normalized.locationStocks
            )
        ) {
          store.put(normalized);
          updatedCount += 1;
        }
      });
    };

    transaction.oncomplete = function () {
      database.close();
      resolve(updatedCount);
    };

    transaction.onerror = function () {
      const error = transaction.error;
      database.close();
      reject(error);
    };

    transaction.onabort =
      transaction.onerror;
  });
}

function openDatabase() {
  return new Promise(function (
    resolve,
    reject
  ) {
    const request =
      indexedDB.open(
        DATABASE_NAME,
        DATABASE_VERSION
      );

    request.onupgradeneeded =
      function (event) {
        const database =
          event.target.result;

        const upgradeTransaction =
          event.target.transaction;

        if (
          !database.objectStoreNames.contains(
            PRODUCT_STORE_NAME
          )
        ) {
          const productStore =
            database.createObjectStore(
              PRODUCT_STORE_NAME,
              {
                keyPath:
                  "internalCode"
              }
            );

          productStore.createIndex(
            "productCode",
            "productCode",
            {
              unique: false
            }
          );
        } else if (
          event.oldVersion < 4
        ) {
          const productStore =
            upgradeTransaction.objectStore(
              PRODUCT_STORE_NAME
            );

          if (
            productStore.indexNames.contains(
              "productCode"
            )
          ) {
            productStore.deleteIndex(
              "productCode"
            );
          }

          productStore.createIndex(
            "productCode",
            "productCode",
            {
              unique: false
            }
          );
        }

        if (
          !database.objectStoreNames.contains(
            MOVEMENT_STORE_NAME
          )
        ) {
          const movementStore =
            database.createObjectStore(
              MOVEMENT_STORE_NAME,
              {
                keyPath: "id"
              }
            );

          movementStore.createIndex(
            "internalCode",
            "internalCode",
            {
              unique: false
            }
          );

          movementStore.createIndex(
            "dateTime",
            "dateTime",
            {
              unique: false
            }
          );

          movementStore.createIndex(
            "type",
            "type",
            {
              unique: false
            }
          );
        }

        if (
          !database.objectStoreNames.contains(
            STOCKTAKING_STORE_NAME
          )
        ) {
          const stocktakingStore =
            database.createObjectStore(
              STOCKTAKING_STORE_NAME,
              {
                keyPath: "id"
              }
            );

          stocktakingStore.createIndex(
            "status",
            "status",
            {
              unique: false
            }
          );

          stocktakingStore.createIndex(
            "stocktakingDate",
            "stocktakingDate",
            {
              unique: false
            }
          );

          stocktakingStore.createIndex(
            "startedAt",
            "startedAt",
            {
              unique: false
            }
          );
        }

        if (
          !database.objectStoreNames.contains(
            STOCKTAKING_SUBMISSION_STORE_NAME
          )
        ) {
          const submissionStore =
            database.createObjectStore(
              STOCKTAKING_SUBMISSION_STORE_NAME,
              {
                keyPath: "submissionId"
              }
            );

          submissionStore.createIndex(
            "stocktakingDate",
            "stocktakingDate",
            {
              unique: false
            }
          );

          submissionStore.createIndex(
            "sourceSessionId",
            "sourceSessionId",
            {
              unique: false
            }
          );

          submissionStore.createIndex(
            "importedAt",
            "importedAt",
            {
              unique: false
            }
          );
        }

        if (
          !database.objectStoreNames.contains(
            STOCKTAKING_AGGREGATION_REFLECTION_STORE_NAME
          )
        ) {
          const reflectionStore =
            database.createObjectStore(
              STOCKTAKING_AGGREGATION_REFLECTION_STORE_NAME,
              {
                keyPath: "reflectionId"
              }
            );

          reflectionStore.createIndex(
            "stocktakingDate",
            "stocktakingDate",
            {
              unique: false
            }
          );

          reflectionStore.createIndex(
            "sourceKey",
            "sourceKey",
            {
              unique: true
            }
          );

          reflectionStore.createIndex(
            "reflectedAt",
            "reflectedAt",
            {
              unique: false
            }
          );
        }

        if (
          !database.objectStoreNames.contains(
            RESTORE_LOG_STORE_NAME
          )
        ) {
          const restoreLogStore =
            database.createObjectStore(
              RESTORE_LOG_STORE_NAME,
              { keyPath: "id" }
            );

          restoreLogStore.createIndex(
            "restoredAt",
            "restoredAt",
            { unique: false }
          );
        }

        if (
          !database.objectStoreNames.contains(
            SALES_PLAN_STORE_NAME
          )
        ) {
          const salesPlanStore =
            database.createObjectStore(
              SALES_PLAN_STORE_NAME,
              { keyPath: "id" }
            );

          salesPlanStore.createIndex(
            "internalCode",
            "internalCode",
            { unique: false }
          );

          salesPlanStore.createIndex(
            "shippingMonth",
            "shippingMonth",
            { unique: false }
          );

          salesPlanStore.createIndex(
            "customerName",
            "customerName",
            { unique: false }
          );
        }

        if (
          !database.objectStoreNames.contains(
            SALES_ACTUAL_STORE_NAME
          )
        ) {
          const salesActualStore =
            database.createObjectStore(
              SALES_ACTUAL_STORE_NAME,
              { keyPath: "id" }
            );

          salesActualStore.createIndex(
            "internalCode",
            "internalCode",
            { unique: false }
          );

          salesActualStore.createIndex(
            "saleDate",
            "saleDate",
            { unique: false }
          );

          salesActualStore.createIndex(
            "batchId",
            "batchId",
            { unique: false }
          );
        }

        if (
          !database.objectStoreNames.contains(
            SALES_IMPORT_BATCH_STORE_NAME
          )
        ) {
          const salesImportBatchStore =
            database.createObjectStore(
              SALES_IMPORT_BATCH_STORE_NAME,
              { keyPath: "batchId" }
            );

          salesImportBatchStore.createIndex(
            "fileFingerprint",
            "fileFingerprint",
            { unique: true }
          );

          salesImportBatchStore.createIndex(
            "importedAt",
            "importedAt",
            { unique: false }
          );

          salesImportBatchStore.createIndex(
            "reportStartDate",
            "reportStartDate",
            { unique: false }
          );
        }

        if (
          !database.objectStoreNames.contains(
            SHIPPING_WISH_STORE_NAME
          )
        ) {
          const shippingWishStore =
            database.createObjectStore(
              SHIPPING_WISH_STORE_NAME,
              { keyPath: "id" }
            );

          shippingWishStore.createIndex(
            "internalCode",
            "internalCode",
            { unique: false }
          );

          shippingWishStore.createIndex(
            "desiredMonth",
            "desiredMonth",
            { unique: false }
          );

          shippingWishStore.createIndex(
            "status",
            "status",
            { unique: false }
          );
        }

        if (
          !database.objectStoreNames.contains(
            SHIPPING_SCHEDULE_STORE_NAME
          )
        ) {
          const shippingScheduleStore =
            database.createObjectStore(
              SHIPPING_SCHEDULE_STORE_NAME,
              { keyPath: "id" }
            );

          shippingScheduleStore.createIndex(
            "departureDate",
            "departureDate",
            { unique: false }
          );

          shippingScheduleStore.createIndex(
            "warehouseArrivalDate",
            "warehouseArrivalDate",
            { unique: false }
          );
        }

        if (
          !database.objectStoreNames.contains(
            SHIPPING_ALLOCATION_STORE_NAME
          )
        ) {
          const shippingAllocationStore =
            database.createObjectStore(
              SHIPPING_ALLOCATION_STORE_NAME,
              { keyPath: "id" }
            );

          shippingAllocationStore.createIndex(
            "scheduleId",
            "scheduleId",
            { unique: false }
          );

          shippingAllocationStore.createIndex(
            "shippingWishId",
            "shippingWishId",
            { unique: false }
          );

          shippingAllocationStore.createIndex(
            "internalCode",
            "internalCode",
            { unique: false }
          );
        }

        if (
          !database.objectStoreNames.contains(
            SHIPPING_WAREHOUSE_ALLOCATION_STORE_NAME
          )
        ) {
          const shippingWarehouseAllocationStore =
            database.createObjectStore(
              SHIPPING_WAREHOUSE_ALLOCATION_STORE_NAME,
              { keyPath: "id" }
            );

          shippingWarehouseAllocationStore.createIndex(
            "scheduleId",
            "scheduleId",
            { unique: false }
          );

          shippingWarehouseAllocationStore.createIndex(
            "internalCode",
            "internalCode",
            { unique: false }
          );

          shippingWarehouseAllocationStore.createIndex(
            "destination",
            "destination",
            { unique: false }
          );
        }

        if (
          !database.objectStoreNames.contains(
            SHIPPING_ARRIVAL_RECEIPT_STORE_NAME
          )
        ) {
          const shippingArrivalReceiptStore =
            database.createObjectStore(
              SHIPPING_ARRIVAL_RECEIPT_STORE_NAME,
              { keyPath: "id" }
            );

          shippingArrivalReceiptStore.createIndex(
            "warehouseArrivalDate",
            "warehouseArrivalDate",
            { unique: false }
          );

          shippingArrivalReceiptStore.createIndex(
            "reflectedAt",
            "reflectedAt",
            { unique: false }
          );
        }

        if (
          !database.objectStoreNames.contains(
            TRANSFER_LIST_STORE_NAME
          )
        ) {
          const transferListStore =
            database.createObjectStore(
              TRANSFER_LIST_STORE_NAME,
              { keyPath: "id" }
            );

          transferListStore.createIndex(
            "transferDate",
            "transferDate",
            { unique: false }
          );

          transferListStore.createIndex(
            "sourceLocation",
            "sourceLocation",
            { unique: false }
          );

          transferListStore.createIndex(
            "destinationLocation",
            "destinationLocation",
            { unique: false }
          );
        }

        if (
          !database.objectStoreNames.contains(
            ORDER_REMAINING_HISTORY_STORE_NAME
          )
        ) {
          const orderRemainingHistoryStore =
            database.createObjectStore(
              ORDER_REMAINING_HISTORY_STORE_NAME,
              { keyPath: "id" }
            );

          orderRemainingHistoryStore.createIndex(
            "internalCode",
            "internalCode",
            { unique: false }
          );

          orderRemainingHistoryStore.createIndex(
            "dateTime",
            "dateTime",
            { unique: false }
          );

          orderRemainingHistoryStore.createIndex(
            "source",
            "source",
            { unique: false }
          );
        }
      };

    request.onsuccess =
      function () {
        resolve(
          request.result
        );
      };

    request.onerror =
      function () {
        reject(
          request.error
        );
      };
  });
}

async function saveProduct(
  product
) {
  const database =
    await openDatabase();

  return new Promise(function (
    resolve,
    reject
  ) {
    const transaction =
      database.transaction(
        PRODUCT_STORE_NAME,
        "readwrite"
      );

    const productStore =
      transaction.objectStore(
        PRODUCT_STORE_NAME
      );

    productStore.add(
      normalizeProductLocationStocks(
        product
      )
    );

    transaction.oncomplete =
      function () {
        database.close();
        resolve();
      };

    transaction.onerror =
      function () {
        const error =
          transaction.error;

        database.close();
        reject(error);
      };

    transaction.onabort =
      function () {
        const error =
          transaction.error;

        database.close();
        reject(error);
      };
  });
}

async function saveProductAndMovement(
  product,
  movement
) {
  const database =
    await openDatabase();

  return new Promise(function (
    resolve,
    reject
  ) {
    const transaction =
      database.transaction(
        [
          PRODUCT_STORE_NAME,
          MOVEMENT_STORE_NAME
        ],
        "readwrite"
      );

    const productStore =
      transaction.objectStore(
        PRODUCT_STORE_NAME
      );

    const movementStore =
      transaction.objectStore(
        MOVEMENT_STORE_NAME
      );

    productStore.add(
      normalizeProductLocationStocks(
        product
      )
    );

    movementStore.add(
      movement
    );

    transaction.oncomplete =
      function () {
        database.close();
        resolve();
      };

    transaction.onerror =
      function () {
        const error =
          transaction.error;

        database.close();
        reject(error);
      };

    transaction.onabort =
      function () {
        const error =
          transaction.error;

        database.close();
        reject(error);
      };
  });
}

async function updateProduct(
  product
) {
  const database =
    await openDatabase();

  return new Promise(function (
    resolve,
    reject
  ) {
    const transaction =
      database.transaction(
        PRODUCT_STORE_NAME,
        "readwrite"
      );

    const productStore =
      transaction.objectStore(
        PRODUCT_STORE_NAME
      );

    productStore.put(
      normalizeProductLocationStocks(
        product
      )
    );

    transaction.oncomplete =
      function () {
        database.close();
        resolve();
      };

    transaction.onerror =
      function () {
        const error =
          transaction.error;

        database.close();
        reject(error);
      };

    transaction.onabort =
      function () {
        const error =
          transaction.error;

        database.close();
        reject(error);
      };
  });
}

async function saveOrderRemainingChange(
  updatedProduct,
  history
) {
  const database =
    await openDatabase();

  return new Promise(function (
    resolve,
    reject
  ) {
    const transaction =
      database.transaction(
        [
          PRODUCT_STORE_NAME,
          ORDER_REMAINING_HISTORY_STORE_NAME
        ],
        "readwrite"
      );

    const productStore =
      transaction.objectStore(
        PRODUCT_STORE_NAME
      );

    const historyStore =
      transaction.objectStore(
        ORDER_REMAINING_HISTORY_STORE_NAME
      );

    productStore.put(
      normalizeProductLocationStocks(
        updatedProduct
      )
    );

    historyStore.add(
      history
    );

    transaction.oncomplete =
      function () {
        database.close();
        resolve();
      };

    transaction.onerror =
      function () {
        const error =
          transaction.error;

        database.close();
        reject(error);
      };

    transaction.onabort =
      transaction.onerror;
  });
}

async function applyOrderRemainingBulkChanges(
  changes
) {
  const items =
    Array.isArray(changes)
      ? changes
      : [];

  if (items.length === 0) {
    return;
  }

  const database =
    await openDatabase();

  return new Promise(function (
    resolve,
    reject
  ) {
    const transaction =
      database.transaction(
        [
          PRODUCT_STORE_NAME,
          ORDER_REMAINING_HISTORY_STORE_NAME
        ],
        "readwrite"
      );

    const productStore =
      transaction.objectStore(
        PRODUCT_STORE_NAME
      );

    const historyStore =
      transaction.objectStore(
        ORDER_REMAINING_HISTORY_STORE_NAME
      );

    items.forEach(function (item) {
      productStore.put(
        normalizeProductLocationStocks(
          item.product
        )
      );

      historyStore.add(
        item.history
      );
    });

    transaction.oncomplete =
      function () {
        database.close();
        resolve();
      };

    transaction.onerror =
      function () {
        const error =
          transaction.error;

        database.close();
        reject(error);
      };

    transaction.onabort =
      transaction.onerror;
  });
}

async function getAllOrderRemainingHistories() {
  return getAllRecordsFromStore(
    ORDER_REMAINING_HISTORY_STORE_NAME
  );
}

async function deleteProduct(
  internalCode
) {
  const database =
    await openDatabase();

  return new Promise(function (
    resolve,
    reject
  ) {
    const transaction =
      database.transaction(
        PRODUCT_STORE_NAME,
        "readwrite"
      );

    const productStore =
      transaction.objectStore(
        PRODUCT_STORE_NAME
      );

    productStore.delete(
      internalCode
    );

    transaction.oncomplete =
      function () {
        database.close();
        resolve();
      };

    transaction.onerror =
      function () {
        const error =
          transaction.error;

        database.close();
        reject(error);
      };

    transaction.onabort =
      function () {
        const error =
          transaction.error;

        database.close();
        reject(error);
      };
  });
}

async function getAllProducts() {
  const database =
    await openDatabase();

  return new Promise(function (
    resolve,
    reject
  ) {
    const transaction =
      database.transaction(
        PRODUCT_STORE_NAME,
        "readonly"
      );

    const productStore =
      transaction.objectStore(
        PRODUCT_STORE_NAME
      );

    const request =
      productStore.getAll();

    let savedProducts = [];

    request.onsuccess =
      function () {
        savedProducts =
          (request.result || []).map(
            normalizeProductLocationStocks
          );
      };

    transaction.oncomplete =
      function () {
        database.close();

        resolve(
          savedProducts
        );
      };

    transaction.onerror =
      function () {
        const error =
          transaction.error;

        database.close();
        reject(error);
      };
  });
}

async function getAllStockMovements() {
  const database =
    await openDatabase();

  return new Promise(function (
    resolve,
    reject
  ) {
    const transaction =
      database.transaction(
        MOVEMENT_STORE_NAME,
        "readonly"
      );

    const movementStore =
      transaction.objectStore(
        MOVEMENT_STORE_NAME
      );

    const request =
      movementStore.getAll();

    let savedMovements = [];

    request.onsuccess =
      function () {
        savedMovements =
          request.result || [];
      };

    transaction.oncomplete =
      function () {
        database.close();

        resolve(
          savedMovements
        );
      };

    transaction.onerror =
      function () {
        const error =
          transaction.error;

        database.close();
        reject(error);
      };
  });
}

async function recordStockMovement(
  updatedProduct,
  movement
) {
  const database =
    await openDatabase();

  return new Promise(function (
    resolve,
    reject
  ) {
    const transaction =
      database.transaction(
        [
          PRODUCT_STORE_NAME,
          MOVEMENT_STORE_NAME
        ],
        "readwrite"
      );

    const productStore =
      transaction.objectStore(
        PRODUCT_STORE_NAME
      );

    const movementStore =
      transaction.objectStore(
        MOVEMENT_STORE_NAME
      );

    productStore.put(
      normalizeProductLocationStocks(
        updatedProduct
      )
    );

    movementStore.add(
      movement
    );

    transaction.oncomplete =
      function () {
        database.close();
        resolve();
      };

    transaction.onerror =
      function () {
        const error =
          transaction.error;

        database.close();
        reject(error);
      };

    transaction.onabort =
      function () {
        const error =
          transaction.error;

        database.close();
        reject(error);
      };
  });
}

async function saveStocktakingSession(
  stocktaking
) {
  const database =
    await openDatabase();

  return new Promise(function (
    resolve,
    reject
  ) {
    const transaction =
      database.transaction(
        STOCKTAKING_STORE_NAME,
        "readwrite"
      );

    const stocktakingStore =
      transaction.objectStore(
        STOCKTAKING_STORE_NAME
      );

    stocktakingStore.add(
      stocktaking
    );

    transaction.oncomplete =
      function () {
        database.close();
        resolve();
      };

    transaction.onerror =
      function () {
        const error =
          transaction.error;

        database.close();
        reject(error);
      };

    transaction.onabort =
      function () {
        const error =
          transaction.error;

        database.close();
        reject(error);
      };
  });
}

async function updateStocktakingSession(
  stocktaking
) {
  const database =
    await openDatabase();

  return new Promise(function (
    resolve,
    reject
  ) {
    const transaction =
      database.transaction(
        STOCKTAKING_STORE_NAME,
        "readwrite"
      );

    const stocktakingStore =
      transaction.objectStore(
        STOCKTAKING_STORE_NAME
      );

    stocktakingStore.put(
      stocktaking
    );

    transaction.oncomplete =
      function () {
        database.close();
        resolve();
      };

    transaction.onerror =
      function () {
        const error =
          transaction.error;

        database.close();
        reject(error);
      };

    transaction.onabort =
      function () {
        const error =
          transaction.error;

        database.close();
        reject(error);
      };
  });
}

async function getOpenStocktakingSessions() {
  const database =
    await openDatabase();

  return new Promise(function (
    resolve,
    reject
  ) {
    const transaction =
      database.transaction(
        STOCKTAKING_STORE_NAME,
        "readonly"
      );

    const stocktakingStore =
      transaction.objectStore(
        STOCKTAKING_STORE_NAME
      );

    const statusIndex =
      stocktakingStore.index(
        "status"
      );

    const request =
      statusIndex.getAll(
        "進行中"
      );

    let stocktakings = [];

    request.onsuccess =
      function () {
        stocktakings =
          request.result || [];
      };

    transaction.oncomplete =
      function () {
        database.close();

        resolve(
          stocktakings
        );
      };

    transaction.onerror =
      function () {
        const error =
          transaction.error;

        database.close();
        reject(error);
      };
  });
}

async function getStocktakingSession(
  stocktakingId
) {
  const database =
    await openDatabase();

  return new Promise(function (
    resolve,
    reject
  ) {
    const transaction =
      database.transaction(
        STOCKTAKING_STORE_NAME,
        "readonly"
      );

    const stocktakingStore =
      transaction.objectStore(
        STOCKTAKING_STORE_NAME
      );

    const request =
      stocktakingStore.get(
        stocktakingId
      );

    let stocktaking = null;

    request.onsuccess =
      function () {
        stocktaking =
          request.result || null;
      };

    transaction.oncomplete =
      function () {
        database.close();

        resolve(
          stocktaking
        );
      };

    transaction.onerror =
      function () {
        const error =
          transaction.error;

        database.close();
        reject(error);
      };
  });
}

async function deleteStocktakingSession(
  stocktakingId
) {
  const database =
    await openDatabase();

  return new Promise(function (
    resolve,
    reject
  ) {
    const transaction =
      database.transaction(
        STOCKTAKING_STORE_NAME,
        "readwrite"
      );

    const stocktakingStore =
      transaction.objectStore(
        STOCKTAKING_STORE_NAME
      );

    stocktakingStore.delete(
      stocktakingId
    );

    transaction.oncomplete =
      function () {
        database.close();
        resolve();
      };

    transaction.onerror =
      function () {
        const error =
          transaction.error;

        database.close();
        reject(error);
      };

    transaction.onabort =
      function () {
        const error =
          transaction.error;

        database.close();
        reject(error);
      };
  });
}

async function completeStocktakingSession(
  stocktaking,
  updatedProducts,
  movements
) {
  const database =
    await openDatabase();

  return new Promise(function (
    resolve,
    reject
  ) {
    const transaction =
      database.transaction(
        [
          PRODUCT_STORE_NAME,
          MOVEMENT_STORE_NAME,
          STOCKTAKING_STORE_NAME
        ],
        "readwrite"
      );

    const productStore =
      transaction.objectStore(
        PRODUCT_STORE_NAME
      );

    const movementStore =
      transaction.objectStore(
        MOVEMENT_STORE_NAME
      );

    const stocktakingStore =
      transaction.objectStore(
        STOCKTAKING_STORE_NAME
      );

    updatedProducts.forEach(
      function (product) {
        productStore.put(
          normalizeProductLocationStocks(
            product
          )
        );
      }
    );

    movements.forEach(
      function (movement) {
        movementStore.add(
          movement
        );
      }
    );

    stocktakingStore.put(
      stocktaking
    );

    transaction.oncomplete =
      function () {
        database.close();
        resolve();
      };

    transaction.onerror =
      function () {
        const error =
          transaction.error;

        database.close();
        reject(error);
      };

    transaction.onabort =
      function () {
        const error =
          transaction.error;

        database.close();
        reject(error);
      };
  });
}

async function saveStocktakingSubmission(
  submission
) {
  const database =
    await openDatabase();

  return new Promise(function (
    resolve,
    reject
  ) {
    const transaction =
      database.transaction(
        STOCKTAKING_SUBMISSION_STORE_NAME,
        "readwrite"
      );

    const store =
      transaction.objectStore(
        STOCKTAKING_SUBMISSION_STORE_NAME
      );

    store.add(submission);

    transaction.oncomplete =
      function () {
        database.close();
        resolve();
      };

    transaction.onerror =
      function () {
        const error =
          transaction.error;

        database.close();
        reject(error);
      };

    transaction.onabort =
      function () {
        const error =
          transaction.error;

        database.close();
        reject(error);
      };
  });
}

async function getAllStocktakingSubmissions() {
  const database =
    await openDatabase();

  return new Promise(function (
    resolve,
    reject
  ) {
    const transaction =
      database.transaction(
        STOCKTAKING_SUBMISSION_STORE_NAME,
        "readonly"
      );

    const store =
      transaction.objectStore(
        STOCKTAKING_SUBMISSION_STORE_NAME
      );

    const request =
      store.getAll();

    let submissions = [];

    request.onsuccess =
      function () {
        submissions =
          request.result || [];
      };

    transaction.oncomplete =
      function () {
        database.close();
        resolve(submissions);
      };

    transaction.onerror =
      function () {
        const error =
          transaction.error;

        database.close();
        reject(error);
      };
  });
}

async function deleteStocktakingSubmission(
  submissionId
) {
  const database =
    await openDatabase();

  return new Promise(function (
    resolve,
    reject
  ) {
    const transaction =
      database.transaction(
        STOCKTAKING_SUBMISSION_STORE_NAME,
        "readwrite"
      );

    const store =
      transaction.objectStore(
        STOCKTAKING_SUBMISSION_STORE_NAME
      );

    store.delete(submissionId);

    transaction.oncomplete =
      function () {
        database.close();
        resolve();
      };

    transaction.onerror =
      function () {
        const error =
          transaction.error;

        database.close();
        reject(error);
      };

    transaction.onabort =
      function () {
        const error =
          transaction.error;

        database.close();
        reject(error);
      };
  });
}



async function completeStocktakingAggregationReflection(
  reflection,
  updatedProducts,
  movements
) {
  const database =
    await openDatabase();

  return new Promise(function (
    resolve,
    reject
  ) {
    const transaction =
      database.transaction(
        [
          PRODUCT_STORE_NAME,
          MOVEMENT_STORE_NAME,
          STOCKTAKING_AGGREGATION_REFLECTION_STORE_NAME
        ],
        "readwrite"
      );

    const productStore =
      transaction.objectStore(
        PRODUCT_STORE_NAME
      );

    const movementStore =
      transaction.objectStore(
        MOVEMENT_STORE_NAME
      );

    const reflectionStore =
      transaction.objectStore(
        STOCKTAKING_AGGREGATION_REFLECTION_STORE_NAME
      );

    updatedProducts.forEach(
      function (product) {
        productStore.put(
          normalizeProductLocationStocks(
            product
          )
        );
      }
    );

    movements.forEach(
      function (movement) {
        movementStore.add(movement);
      }
    );

    reflectionStore.add(reflection);

    transaction.oncomplete =
      function () {
        database.close();
        resolve();
      };

    transaction.onerror =
      function () {
        const error =
          transaction.error;

        database.close();
        reject(error);
      };

    transaction.onabort =
      function () {
        const error =
          transaction.error;

        database.close();
        reject(error);
      };
  });
}

async function getAllStocktakingAggregationReflections() {
  const database =
    await openDatabase();

  return new Promise(function (
    resolve,
    reject
  ) {
    const transaction =
      database.transaction(
        STOCKTAKING_AGGREGATION_REFLECTION_STORE_NAME,
        "readonly"
      );

    const store =
      transaction.objectStore(
        STOCKTAKING_AGGREGATION_REFLECTION_STORE_NAME
      );

    const request = store.getAll();
    let reflections = [];

    request.onsuccess = function () {
      reflections = request.result || [];
    };

    transaction.oncomplete = function () {
      database.close();
      resolve(reflections);
    };

    transaction.onerror = function () {
      const error = transaction.error;
      database.close();
      reject(error);
    };
  });
}

async function getStocktakingAggregationReflectionBySourceKey(
  sourceKey
) {
  const database =
    await openDatabase();

  return new Promise(function (
    resolve,
    reject
  ) {
    const transaction =
      database.transaction(
        STOCKTAKING_AGGREGATION_REFLECTION_STORE_NAME,
        "readonly"
      );

    const store =
      transaction.objectStore(
        STOCKTAKING_AGGREGATION_REFLECTION_STORE_NAME
      );

    const index =
      store.index("sourceKey");

    const request =
      index.get(sourceKey);

    let reflection = null;

    request.onsuccess = function () {
      reflection = request.result || null;
    };

    transaction.oncomplete = function () {
      database.close();
      resolve(reflection);
    };

    transaction.onerror = function () {
      const error = transaction.error;
      database.close();
      reject(error);
    };
  });
}


async function getAllRecordsFromStore(storeName) {
  const database = await openDatabase();

  return new Promise(function (resolve, reject) {
    const transaction = database.transaction(
      storeName,
      "readonly"
    );
    const store = transaction.objectStore(storeName);
    const request = store.getAll();
    let records = [];

    request.onsuccess = function () {
      records = request.result || [];
    };
    transaction.oncomplete = function () {
      database.close();
      resolve(records);
    };
    transaction.onerror = function () {
      const error = transaction.error;
      database.close();
      reject(error);
    };
  });
}

async function getAllRestoreLogs() {
  return getAllRecordsFromStore(
    RESTORE_LOG_STORE_NAME
  );
}

async function updateProductsInBatch(updatedProducts) {
  const database = await openDatabase();

  return new Promise(function (resolve, reject) {
    const transaction = database.transaction(
      PRODUCT_STORE_NAME,
      "readwrite"
    );
    const store = transaction.objectStore(
      PRODUCT_STORE_NAME
    );

    updatedProducts.forEach(function (product) {
      store.put(
        normalizeProductLocationStocks(
          product
        )
      );
    });

    transaction.oncomplete = function () {
      database.close();
      resolve();
    };
    transaction.onerror = function () {
      const error = transaction.error;
      database.close();
      reject(error);
    };
    transaction.onabort = transaction.onerror;
  });
}


async function saveSalesPlan(record) {
  const database = await openDatabase();

  return new Promise(function (resolve, reject) {
    const transaction = database.transaction(
      SALES_PLAN_STORE_NAME,
      "readwrite"
    );
    transaction.objectStore(
      SALES_PLAN_STORE_NAME
    ).add(record);

    transaction.oncomplete = function () {
      database.close();
      resolve();
    };
    transaction.onerror = function () {
      const error = transaction.error;
      database.close();
      reject(error);
    };
    transaction.onabort = transaction.onerror;
  });
}

async function updateSalesPlan(record) {
  const database = await openDatabase();

  return new Promise(function (resolve, reject) {
    const transaction = database.transaction(
      SALES_PLAN_STORE_NAME,
      "readwrite"
    );
    transaction.objectStore(
      SALES_PLAN_STORE_NAME
    ).put(record);

    transaction.oncomplete = function () {
      database.close();
      resolve();
    };
    transaction.onerror = function () {
      const error = transaction.error;
      database.close();
      reject(error);
    };
    transaction.onabort = transaction.onerror;
  });
}

async function deleteSalesPlan(id) {
  const database = await openDatabase();

  return new Promise(function (resolve, reject) {
    const transaction = database.transaction(
      SALES_PLAN_STORE_NAME,
      "readwrite"
    );
    transaction.objectStore(
      SALES_PLAN_STORE_NAME
    ).delete(id);

    transaction.oncomplete = function () {
      database.close();
      resolve();
    };
    transaction.onerror = function () {
      const error = transaction.error;
      database.close();
      reject(error);
    };
    transaction.onabort = transaction.onerror;
  });
}

async function getAllSalesPlans() {
  return getAllRecordsFromStore(
    SALES_PLAN_STORE_NAME
  );
}

async function getAllSalesActuals() {
  return getAllRecordsFromStore(
    SALES_ACTUAL_STORE_NAME
  );
}

async function getAllSalesImportBatches() {
  return getAllRecordsFromStore(
    SALES_IMPORT_BATCH_STORE_NAME
  );
}

function createSalesActualInventoryMovementId(batchId, internalCode) {
  const safeBatch = String(batchId || "sales-batch").replace(/[^a-zA-Z0-9_-]/g, "_");
  const safeCode = String(internalCode || "unknown").replace(/[^a-zA-Z0-9_-]/g, "_");
  return `sales-inventory-${safeBatch}-${safeCode}`;
}

function formatSalesActualLocationChanges(changes) {
  return changes.map(function (change) {
    const sign = change.change > 0 ? "+" : "";
    return `${change.location} ${sign}${change.change}個`;
  }).join(" / ");
}

async function saveSalesActualImportBatch(batchRecord, salesRecords) {
  const database = await openDatabase();

  return new Promise(function (resolve, reject) {
    const transaction = database.transaction(
      [
        SALES_ACTUAL_STORE_NAME,
        SALES_IMPORT_BATCH_STORE_NAME,
        PRODUCT_STORE_NAME,
        MOVEMENT_STORE_NAME
      ],
      "readwrite"
    );

    const salesStore = transaction.objectStore(SALES_ACTUAL_STORE_NAME);
    const batchStore = transaction.objectStore(SALES_IMPORT_BATCH_STORE_NAME);
    const productStore = transaction.objectStore(PRODUCT_STORE_NAME);
    const movementStore = transaction.objectStore(MOVEMENT_STORE_NAME);

    const netSalesByCode = new Map();
    const productCodes = [];
    const productsByCode = new Map();
    const updatedProducts = [];
    let savedBatch = null;
    let failureError = null;
    let pendingRequests = 0;
    let startedWrites = false;

    function abortWithMessage(message) {
      if (failureError) return;
      failureError = message instanceof Error
        ? message
        : new Error(String(message || "販売実績の在庫反映に失敗しました。"));
      try {
        transaction.abort();
      } catch (error) {
        // すでに終了している場合は何もしません。
      }
    }

    salesRecords.forEach(function (record) {
      const internalCode = String(record && record.internalCode || "").trim();
      const quantity = Number(record && record.quantity);

      if (!internalCode) return;
      if (!Number.isFinite(quantity) || !Number.isInteger(quantity)) {
        abortWithMessage(
          `社内コード ${internalCode} の販売数量が整数ではありません。\n` +
          "在庫は整数で管理しているため、このCSVは取り込めません。"
        );
        return;
      }

      netSalesByCode.set(
        internalCode,
        (netSalesByCode.get(internalCode) || 0) + quantity
      );
    });

    if (failureError) return;

    netSalesByCode.forEach(function (quantity, internalCode) {
      if (quantity !== 0) productCodes.push(internalCode);
    });

    function startWrites() {
      if (startedWrites || failureError) return;
      startedWrites = true;

      const inventoryAdjustments = [];
      const inventorySkippedCodes = [];
      const now = new Date().toISOString();

      productCodes.forEach(function (internalCode) {
        if (failureError) return;

        const savedProduct = productsByCode.get(internalCode);
        const netSalesQuantity = netSalesByCode.get(internalCode) || 0;

        if (!savedProduct) {
          inventorySkippedCodes.push(internalCode);
          return;
        }

        const product = normalizeProductLocationStocks(savedProduct);
        const beforeStock = normalizeLocationStockQuantity(product.stock);
        const locationStocks = product.locationStocks.map(function (entry) {
          return {
            location: normalizeLocationStockName(entry.location),
            stock: normalizeLocationStockQuantity(entry.stock)
          };
        });
        const locationChanges = [];

        if (netSalesQuantity > 0) {
          if (beforeStock < netSalesQuantity) {
            abortWithMessage(
              `社内コード：${internalCode}\n` +
              `商品コード：${product.productCode || "-"}\n\n` +
              `販売実績CSVの出庫数量が現在庫を上回っています。\n` +
              `現在庫：${beforeStock}個 / CSV出庫：${netSalesQuantity}個\n\n` +
              "在庫数を確認してから、もう一度CSVを取り込んでください。"
            );
            return;
          }

          let remaining = netSalesQuantity;

          SALES_ACTUAL_OUTBOUND_LOCATION_PRIORITY.forEach(function (location) {
            if (remaining <= 0) return;

            const entry = locationStocks.find(function (item) {
              return item.location === location;
            });
            if (!entry || entry.stock <= 0) return;

            const deduction = Math.min(entry.stock, remaining);
            entry.stock -= deduction;
            remaining -= deduction;
            locationChanges.push({
              location: location,
              change: -deduction
            });
          });

          if (remaining > 0) {
            const eligibleStock = netSalesQuantity - remaining;
            abortWithMessage(
              `社内コード：${internalCode}\n` +
              `商品コード：${product.productCode || "-"}\n\n` +
              "販売実績CSVを出庫する保管場所の在庫が不足しています。\n" +
              `自動出庫の対象在庫：${eligibleStock}個 / CSV出庫：${netSalesQuantity}個\n\n` +
              "自動出庫は「本社1階 → 本社2階 → 酒本倉庫1階 → 酒本倉庫2階」の順です。"
            );
            return;
          }
        } else if (netSalesQuantity < 0) {
          const returnQuantity = Math.abs(netSalesQuantity);
          let returnEntry = locationStocks.find(function (item) {
            return item.location === SALES_ACTUAL_RETURN_LOCATION;
          });

          if (!returnEntry) {
            returnEntry = {
              location: SALES_ACTUAL_RETURN_LOCATION,
              stock: 0
            };
            locationStocks.push(returnEntry);
          }

          returnEntry.stock += returnQuantity;
          locationChanges.push({
            location: SALES_ACTUAL_RETURN_LOCATION,
            change: returnQuantity
          });
        }

        const totalChange = locationChanges.reduce(function (sum, item) {
          return sum + item.change;
        }, 0);
        const afterStock = beforeStock + totalChange;
        const positiveEntries = locationStocks.filter(function (entry) {
          return entry.stock > 0;
        });
        let primaryLocation = normalizeLocationStockName(product.location);
        const primaryStillHasStock = positiveEntries.some(function (entry) {
          return entry.location === primaryLocation;
        });

        if (!primaryStillHasStock && positiveEntries.length > 0) {
          const priorityMap = new Map(
            SALES_ACTUAL_OUTBOUND_LOCATION_PRIORITY.map(function (location, index) {
              return [location, index];
            })
          );
          positiveEntries.sort(function (left, right) {
            const leftIndex = priorityMap.has(left.location) ? priorityMap.get(left.location) : 999;
            const rightIndex = priorityMap.has(right.location) ? priorityMap.get(right.location) : 999;
            return leftIndex - rightIndex;
          });
          primaryLocation = positiveEntries[0].location;
        }

        if (!primaryLocation) {
          primaryLocation = SALES_ACTUAL_RETURN_LOCATION;
        }

        const updatedProduct = normalizeProductLocationStocks({
          ...product,
          stock: afterStock,
          location: primaryLocation,
          locationStocks: locationStocks.filter(function (entry) {
            return entry.stock > 0;
          }),
          updatedAt: now
        });

        updatedProducts.push(updatedProduct);
        productStore.put(updatedProduct);

        const movementId = createSalesActualInventoryMovementId(
          batchRecord.batchId,
          internalCode
        );
        const isOutbound = netSalesQuantity > 0;

        movementStore.add({
          id: movementId,
          dateTime: now,
          internalCode: updatedProduct.internalCode,
          productCode: updatedProduct.productCode || "",
          productName: updatedProduct.productName || "",
          janCode: updatedProduct.janCode || "",
          type: isOutbound ? "出庫" : "入庫",
          quantity: Math.abs(netSalesQuantity),
          beforeStock: beforeStock,
          afterStock: afterStock,
          person: "販売実績CSV",
          reason: isOutbound ? "販売実績CSV" : "販売実績CSV返品",
          memo: isOutbound
            ? `自動出庫：${formatSalesActualLocationChanges(locationChanges)}`
            : `返品自動反映：${formatSalesActualLocationChanges(locationChanges)}`,
          location: locationChanges.length === 1
            ? locationChanges[0].location
            : "複数保管場所",
          salesBatchId: batchRecord.batchId,
          locationChanges: locationChanges
        });

        inventoryAdjustments.push({
          internalCode: internalCode,
          netSalesQuantity: netSalesQuantity,
          beforeStock: beforeStock,
          afterStock: afterStock,
          locationChanges: locationChanges,
          movementId: movementId
        });
      });

      if (failureError) return;

      savedBatch = {
        ...batchRecord,
        inventoryAppliedAt: now,
        inventoryAdjustmentCount: inventoryAdjustments.length,
        inventoryAdjustments: inventoryAdjustments,
        inventorySkippedCodes: inventorySkippedCodes,
        inventoryRule: "本社1階→本社2階→酒本倉庫1階→酒本倉庫2階"
      };

      batchStore.add(savedBatch);
      salesRecords.forEach(function (record) {
        salesStore.add(record);
      });
    }

    if (productCodes.length === 0) {
      startWrites();
    } else {
      pendingRequests = productCodes.length;
      productCodes.forEach(function (internalCode) {
        const request = productStore.get(internalCode);
        request.onsuccess = function () {
          productsByCode.set(internalCode, request.result || null);
          pendingRequests -= 1;
          if (pendingRequests === 0) startWrites();
        };
        request.onerror = function () {
          abortWithMessage(
            request.error ||
            `社内コード ${internalCode} の商品を読み込めませんでした。`
          );
        };
      });
    }

    transaction.oncomplete = function () {
      database.close();
      resolve({
        batch: savedBatch || batchRecord,
        products: updatedProducts
      });
    };
    transaction.onerror = function () {
      const error = failureError || transaction.error;
      database.close();
      reject(error);
    };
    transaction.onabort = function () {
      const error = failureError || transaction.error;
      database.close();
      reject(error);
    };
  });
}

async function deleteSalesActualImportBatch(batchId) {
  const database = await openDatabase();

  return new Promise(function (resolve, reject) {
    const transaction = database.transaction(
      [
        SALES_ACTUAL_STORE_NAME,
        SALES_IMPORT_BATCH_STORE_NAME,
        PRODUCT_STORE_NAME,
        MOVEMENT_STORE_NAME
      ],
      "readwrite"
    );

    const salesStore = transaction.objectStore(SALES_ACTUAL_STORE_NAME);
    const batchStore = transaction.objectStore(SALES_IMPORT_BATCH_STORE_NAME);
    const productStore = transaction.objectStore(PRODUCT_STORE_NAME);
    const movementStore = transaction.objectStore(MOVEMENT_STORE_NAME);
    const salesIndex = salesStore.index("batchId");
    const updatedProducts = [];
    let failureError = null;
    let batch = null;
    let pendingProducts = 0;
    let rollbackStarted = false;

    function abortWithMessage(message) {
      if (failureError) return;
      failureError = message instanceof Error
        ? message
        : new Error(String(message || "販売実績CSVの取消に失敗しました。"));
      try {
        transaction.abort();
      } catch (error) {
        // すでに終了している場合は何もしません。
      }
    }

    function deleteSalesRecordsAndBatch() {
      const request = salesIndex.openCursor(IDBKeyRange.only(batchId));
      request.onsuccess = function () {
        const cursor = request.result;
        if (!cursor) {
          batchStore.delete(batchId);
          return;
        }
        cursor.delete();
        cursor.continue();
      };
      request.onerror = function () {
        abortWithMessage(request.error || "販売実績を削除できませんでした。");
      };
    }

    function startRollback() {
      if (rollbackStarted || failureError) return;
      rollbackStarted = true;

      const adjustments = batch && Array.isArray(batch.inventoryAdjustments)
        ? batch.inventoryAdjustments
        : [];

      if (adjustments.length === 0) {
        deleteSalesRecordsAndBatch();
        return;
      }

      pendingProducts = adjustments.length;

      adjustments.forEach(function (adjustment) {
        const request = productStore.get(adjustment.internalCode);
        request.onsuccess = function () {
          const savedProduct = request.result || null;
          if (!savedProduct) {
            abortWithMessage(
              `社内コード ${adjustment.internalCode} の商品が見つからないため、在庫を元に戻せません。`
            );
            return;
          }

          const product = normalizeProductLocationStocks(savedProduct);
          const locationStocks = product.locationStocks.map(function (entry) {
            return {
              location: normalizeLocationStockName(entry.location),
              stock: normalizeLocationStockQuantity(entry.stock)
            };
          });
          const changes = Array.isArray(adjustment.locationChanges)
            ? adjustment.locationChanges
            : [];

          for (const change of changes) {
            const location = normalizeLocationStockName(change.location);
            const appliedChange = Number(change.change) || 0;
            let entry = locationStocks.find(function (item) {
              return item.location === location;
            });

            if (!entry) {
              entry = { location: location, stock: 0 };
              locationStocks.push(entry);
            }

            if (appliedChange > 0 && entry.stock < appliedChange) {
              abortWithMessage(
                `${product.productName || adjustment.internalCode}\n` +
                `販売実績CSVの取込取消に必要な在庫が「${location}」にありません。\n` +
                `現在：${entry.stock}個 / 戻すために必要：${appliedChange}個\n\n` +
                "その後の入出庫を確認してから取消してください。"
              );
              return;
            }

            entry.stock -= appliedChange;
          }

          const totalAppliedChange = changes.reduce(function (sum, change) {
            return sum + (Number(change.change) || 0);
          }, 0);
          const restoredStock = normalizeLocationStockQuantity(product.stock) - totalAppliedChange;
          const positiveEntries = locationStocks.filter(function (entry) {
            return entry.stock > 0;
          });
          let primaryLocation = normalizeLocationStockName(product.location);

          if (!positiveEntries.some(function (entry) {
            return entry.location === primaryLocation;
          })) {
            primaryLocation = positiveEntries.length > 0
              ? positiveEntries[0].location
              : primaryLocation || LOCATION_STOCK_UNCONFIRMED_NAME;
          }

          const restoredProduct = normalizeProductLocationStocks({
            ...product,
            stock: restoredStock,
            location: primaryLocation,
            locationStocks: positiveEntries,
            updatedAt: new Date().toISOString()
          });

          productStore.put(restoredProduct);
          updatedProducts.push(restoredProduct);

          if (adjustment.movementId) {
            movementStore.delete(adjustment.movementId);
          }

          pendingProducts -= 1;
          if (pendingProducts === 0) {
            deleteSalesRecordsAndBatch();
          }
        };
        request.onerror = function () {
          abortWithMessage(
            request.error ||
            `社内コード ${adjustment.internalCode} の商品を読み込めませんでした。`
          );
        };
      });
    }

    const batchRequest = batchStore.get(batchId);
    batchRequest.onsuccess = function () {
      batch = batchRequest.result || null;
      if (!batch) {
        abortWithMessage("取消対象の販売実績CSVが見つかりませんでした。");
        return;
      }
      startRollback();
    };
    batchRequest.onerror = function () {
      abortWithMessage(
        batchRequest.error ||
        "販売実績CSVの履歴を読み込めませんでした。"
      );
    };

    transaction.oncomplete = function () {
      database.close();
      resolve({ products: updatedProducts });
    };
    transaction.onerror = function () {
      const error = failureError || transaction.error;
      database.close();
      reject(error);
    };
    transaction.onabort = function () {
      const error = failureError || transaction.error;
      database.close();
      reject(error);
    };
  });
}



async function saveShippingWish(record) {
  const database = await openDatabase();

  return new Promise(function (resolve, reject) {
    const transaction = database.transaction(
      SHIPPING_WISH_STORE_NAME,
      "readwrite"
    );
    transaction.objectStore(
      SHIPPING_WISH_STORE_NAME
    ).add(record);

    transaction.oncomplete = function () {
      database.close();
      resolve();
    };
    transaction.onerror = function () {
      const error = transaction.error;
      database.close();
      reject(error);
    };
    transaction.onabort = transaction.onerror;
  });
}

async function updateShippingWish(record) {
  const database = await openDatabase();

  return new Promise(function (resolve, reject) {
    const transaction = database.transaction(
      SHIPPING_WISH_STORE_NAME,
      "readwrite"
    );
    transaction.objectStore(
      SHIPPING_WISH_STORE_NAME
    ).put(record);

    transaction.oncomplete = function () {
      database.close();
      resolve();
    };
    transaction.onerror = function () {
      const error = transaction.error;
      database.close();
      reject(error);
    };
    transaction.onabort = transaction.onerror;
  });
}

async function deleteShippingWish(id) {
  const database = await openDatabase();

  return new Promise(function (resolve, reject) {
    const transaction = database.transaction(
      SHIPPING_WISH_STORE_NAME,
      "readwrite"
    );
    transaction.objectStore(
      SHIPPING_WISH_STORE_NAME
    ).delete(id);

    transaction.oncomplete = function () {
      database.close();
      resolve();
    };
    transaction.onerror = function () {
      const error = transaction.error;
      database.close();
      reject(error);
    };
    transaction.onabort = transaction.onerror;
  });
}

async function getAllShippingWishes() {
  return getAllRecordsFromStore(
    SHIPPING_WISH_STORE_NAME
  );
}

async function saveShippingSchedule(record) {
  const database = await openDatabase();
  return new Promise(function (resolve, reject) {
    const transaction = database.transaction(
      SHIPPING_SCHEDULE_STORE_NAME,
      "readwrite"
    );
    transaction.objectStore(SHIPPING_SCHEDULE_STORE_NAME).add(record);
    transaction.oncomplete = function () { database.close(); resolve(); };
    transaction.onerror = function () { const error = transaction.error; database.close(); reject(error); };
    transaction.onabort = transaction.onerror;
  });
}

async function updateShippingSchedule(record) {
  const database = await openDatabase();
  return new Promise(function (resolve, reject) {
    const transaction = database.transaction(
      SHIPPING_SCHEDULE_STORE_NAME,
      "readwrite"
    );
    transaction.objectStore(SHIPPING_SCHEDULE_STORE_NAME).put(record);
    transaction.oncomplete = function () { database.close(); resolve(); };
    transaction.onerror = function () { const error = transaction.error; database.close(); reject(error); };
    transaction.onabort = transaction.onerror;
  });
}

async function getAllShippingSchedules() {
  return getAllRecordsFromStore(SHIPPING_SCHEDULE_STORE_NAME);
}

async function getAllShippingAllocations() {
  return getAllRecordsFromStore(SHIPPING_ALLOCATION_STORE_NAME);
}

async function saveShippingAllocation(record) {
  const database = await openDatabase();
  return new Promise(function (resolve, reject) {
    const transaction = database.transaction(
      SHIPPING_ALLOCATION_STORE_NAME,
      "readwrite"
    );
    transaction.objectStore(SHIPPING_ALLOCATION_STORE_NAME).put(record);
    transaction.oncomplete = function () { database.close(); resolve(); };
    transaction.onerror = function () { const error = transaction.error; database.close(); reject(error); };
    transaction.onabort = transaction.onerror;
  });
}

async function deleteShippingAllocation(id) {
  const database = await openDatabase();
  return new Promise(function (resolve, reject) {
    const transaction = database.transaction(
      SHIPPING_ALLOCATION_STORE_NAME,
      "readwrite"
    );
    transaction.objectStore(SHIPPING_ALLOCATION_STORE_NAME).delete(id);
    transaction.oncomplete = function () { database.close(); resolve(); };
    transaction.onerror = function () { const error = transaction.error; database.close(); reject(error); };
    transaction.onabort = transaction.onerror;
  });
}

async function getAllShippingWarehouseAllocations() {
  return getAllRecordsFromStore(SHIPPING_WAREHOUSE_ALLOCATION_STORE_NAME);
}

async function saveShippingWarehouseAllocation(record) {
  const database = await openDatabase();
  return new Promise(function (resolve, reject) {
    const transaction = database.transaction(
      SHIPPING_WAREHOUSE_ALLOCATION_STORE_NAME,
      "readwrite"
    );
    transaction.objectStore(SHIPPING_WAREHOUSE_ALLOCATION_STORE_NAME).put(record);
    transaction.oncomplete = function () { database.close(); resolve(); };
    transaction.onerror = function () { const error = transaction.error; database.close(); reject(error); };
    transaction.onabort = transaction.onerror;
  });
}

async function deleteShippingWarehouseAllocation(id) {
  const database = await openDatabase();
  return new Promise(function (resolve, reject) {
    const transaction = database.transaction(
      SHIPPING_WAREHOUSE_ALLOCATION_STORE_NAME,
      "readwrite"
    );
    transaction.objectStore(SHIPPING_WAREHOUSE_ALLOCATION_STORE_NAME).delete(id);
    transaction.oncomplete = function () { database.close(); resolve(); };
    transaction.onerror = function () { const error = transaction.error; database.close(); reject(error); };
    transaction.onabort = transaction.onerror;
  });
}

async function getAllShippingArrivalReceipts() {
  return getAllRecordsFromStore(SHIPPING_ARRIVAL_RECEIPT_STORE_NAME);
}

async function getShippingArrivalReceipt(scheduleId) {
  const database = await openDatabase();
  return new Promise(function (resolve, reject) {
    const transaction = database.transaction(
      SHIPPING_ARRIVAL_RECEIPT_STORE_NAME,
      "readonly"
    );
    const request = transaction
      .objectStore(SHIPPING_ARRIVAL_RECEIPT_STORE_NAME)
      .get(scheduleId);
    request.onsuccess = function () {
      const result = request.result || null;
      database.close();
      resolve(result);
    };
    request.onerror = function () {
      const error = request.error;
      database.close();
      reject(error);
    };
  });
}

async function applyShippingArrivalReceipt(
  updatedProducts,
  movements,
  receipt,
  orderRemainingHistories
) {
  const database = await openDatabase();
  return new Promise(function (resolve, reject) {
    const transaction = database.transaction(
      [
        PRODUCT_STORE_NAME,
        MOVEMENT_STORE_NAME,
        SHIPPING_ARRIVAL_RECEIPT_STORE_NAME,
        ORDER_REMAINING_HISTORY_STORE_NAME
      ],
      "readwrite"
    );

    const productStore = transaction.objectStore(PRODUCT_STORE_NAME);
    const movementStore = transaction.objectStore(MOVEMENT_STORE_NAME);
    const receiptStore = transaction.objectStore(SHIPPING_ARRIVAL_RECEIPT_STORE_NAME);
    const orderRemainingHistoryStore = transaction.objectStore(
      ORDER_REMAINING_HISTORY_STORE_NAME
    );

    updatedProducts.forEach(function (product) {
      productStore.put(
        normalizeProductLocationStocks(
          product
        )
      );
    });
    movements.forEach(function (movement) {
      movementStore.add(movement);
    });

    (Array.isArray(orderRemainingHistories)
      ? orderRemainingHistories
      : []
    ).forEach(function (history) {
      orderRemainingHistoryStore.add(history);
    });

    receiptStore.add(receipt);

    transaction.oncomplete = function () {
      database.close();
      resolve();
    };
    transaction.onerror = function () {
      const error = transaction.error;
      database.close();
      reject(error);
    };
    transaction.onabort = transaction.onerror;
  });
}

async function deleteShippingScheduleWithAllocations(scheduleId) {
  const database = await openDatabase();
  return new Promise(function (resolve, reject) {
    const transaction = database.transaction(
      [
        SHIPPING_SCHEDULE_STORE_NAME,
        SHIPPING_ALLOCATION_STORE_NAME,
        SHIPPING_WAREHOUSE_ALLOCATION_STORE_NAME,
        SHIPPING_ARRIVAL_RECEIPT_STORE_NAME
      ],
      "readwrite"
    );
    const scheduleStore = transaction.objectStore(SHIPPING_SCHEDULE_STORE_NAME);
    const allocationStore = transaction.objectStore(SHIPPING_ALLOCATION_STORE_NAME);
    const warehouseStore = transaction.objectStore(SHIPPING_WAREHOUSE_ALLOCATION_STORE_NAME);
    const receiptStore = transaction.objectStore(SHIPPING_ARRIVAL_RECEIPT_STORE_NAME);
    const allocationIndex = allocationStore.index("scheduleId");
    const warehouseIndex = warehouseStore.index("scheduleId");
    const allocationRequest = allocationIndex.openCursor(IDBKeyRange.only(scheduleId));
    const warehouseRequest = warehouseIndex.openCursor(IDBKeyRange.only(scheduleId));

    allocationRequest.onsuccess = function () {
      const cursor = allocationRequest.result;
      if (!cursor) return;
      cursor.delete();
      cursor.continue();
    };

    warehouseRequest.onsuccess = function () {
      const cursor = warehouseRequest.result;
      if (!cursor) {
        scheduleStore.delete(scheduleId);
    receiptStore.delete(scheduleId);
        return;
      }
      cursor.delete();
      cursor.continue();
    };

    transaction.oncomplete = function () { database.close(); resolve(); };
    transaction.onerror = function () { const error = transaction.error; database.close(); reject(error); };
    transaction.onabort = transaction.onerror;
  });
}

async function getAllTransferLists() {
  return getAllRecordsFromStore(TRANSFER_LIST_STORE_NAME);
}

async function saveTransferList(record) {
  const database = await openDatabase();
  return new Promise(function (resolve, reject) {
    const transaction = database.transaction(
      TRANSFER_LIST_STORE_NAME,
      "readwrite"
    );
    transaction.objectStore(TRANSFER_LIST_STORE_NAME).put(record);
    transaction.oncomplete = function () { database.close(); resolve(); };
    transaction.onerror = function () {
      const error = transaction.error;
      database.close();
      reject(error);
    };
    transaction.onabort = transaction.onerror;
  });
}


function createTransferMovementId(transferId, internalCode) {
  const randomText = Math.random()
    .toString(36)
    .slice(2, 10);

  return (
    `transfer-${String(transferId || "")}-` +
    `${String(internalCode || "")}-` +
    `${Date.now()}-${randomText}`
  );
}

async function completeTransferAndApplyInventory(
  transferRecord,
  confirmerName
) {
  const record = transferRecord || {};
  const transferId = String(record.id || "").trim();
  const person = String(confirmerName || "").trim();
  const sourceLocation = normalizeLocationStockName(
    record.sourceLocation
  );
  const destinationLocation = normalizeLocationStockName(
    record.destinationLocation
  );
  const rawItems = Array.isArray(record.items)
    ? record.items
    : [];

  if (transferId === "") {
    throw new Error(
      "商品移動リストのIDが見つかりません。"
    );
  }

  if (person === "") {
    throw new Error(
      "確認者名を入力してください。"
    );
  }

  if (
    sourceLocation === "" ||
    destinationLocation === ""
  ) {
    throw new Error(
      "移動元または移動先が設定されていません。"
    );
  }

  if (sourceLocation === destinationLocation) {
    throw new Error(
      "移動元と移動先は別の場所にしてください。"
    );
  }

  const groupedItems = new Map();

  rawItems.forEach(function (item) {
    const internalCode = String(
      item && item.internalCode || ""
    ).trim();
    const quantity = Number(
      item && item.quantity || 0
    );

    if (internalCode === "") {
      throw new Error(
        "社内コードが空欄の商品があります。"
      );
    }

    if (
      !Number.isInteger(quantity) ||
      quantity <= 0
    ) {
      throw new Error(
        `${item && item.productName || internalCode} の` +
        "移動個数を確認してください。"
      );
    }

    const current = groupedItems.get(
      internalCode
    );

    if (current) {
      current.quantity += quantity;
      return;
    }

    groupedItems.set(
      internalCode,
      {
        internalCode: internalCode,
        productCode: String(
          item && item.productCode || ""
        ),
        productName: String(
          item && item.productName || ""
        ),
        quantity: quantity
      }
    );
  });

  const items = Array.from(
    groupedItems.values()
  );

  if (items.length === 0) {
    throw new Error(
      "移動する商品がありません。"
    );
  }

  const database = await openDatabase();

  return new Promise(function (resolve, reject) {
    const transaction = database.transaction(
      [
        PRODUCT_STORE_NAME,
        MOVEMENT_STORE_NAME,
        TRANSFER_LIST_STORE_NAME
      ],
      "readwrite"
    );

    const productStore = transaction.objectStore(
      PRODUCT_STORE_NAME
    );
    const movementStore = transaction.objectStore(
      MOVEMENT_STORE_NAME
    );
    const transferStore = transaction.objectStore(
      TRANSFER_LIST_STORE_NAME
    );

    const productsByCode = new Map();
    let currentTransfer = null;
    let pendingRequests = items.length + 1;
    let failureError = null;
    let result = null;

    function abortWithMessage(message) {
      if (failureError) {
        return;
      }

      failureError = message instanceof Error
        ? message
        : new Error(String(message));

      try {
        transaction.abort();
      } catch (error) {
        database.close();
        reject(failureError);
      }
    }

    function requestCompleted() {
      pendingRequests -= 1;

      if (
        pendingRequests === 0 &&
        !failureError
      ) {
        applyInventoryChanges();
      }
    }

    function applyInventoryChanges() {
      if (!currentTransfer) {
        abortWithMessage(
          "保存済みの商品移動リストが見つかりません。"
        );
        return;
      }

      if (currentTransfer.inventoryAppliedAt) {
        abortWithMessage(
          "この商品移動リストは、すでに在庫へ反映済みです。"
        );
        return;
      }

      if (!currentTransfer.sourceConfirmedAt) {
        abortWithMessage(
          "先に移動元で確認してください。"
        );
        return;
      }

      const savedSourceLocation = normalizeLocationStockName(
        currentTransfer.sourceLocation
      );
      const savedDestinationLocation = normalizeLocationStockName(
        currentTransfer.destinationLocation
      );
      const savedGroupedItems = new Map();

      (Array.isArray(currentTransfer.items)
        ? currentTransfer.items
        : []
      ).forEach(function (item) {
        const internalCode = String(
          item && item.internalCode || ""
        ).trim();
        const quantity = Number(
          item && item.quantity || 0
        );

        savedGroupedItems.set(
          internalCode,
          (savedGroupedItems.get(internalCode) || 0) + quantity
        );
      });

      const savedItemsSignature = JSON.stringify(
        Array.from(savedGroupedItems.entries()).sort()
      );
      const clickedItemsSignature = JSON.stringify(
        items.map(function (item) {
          return [item.internalCode, item.quantity];
        }).sort()
      );

      if (
        savedSourceLocation !== sourceLocation ||
        savedDestinationLocation !== destinationLocation ||
        savedItemsSignature !== clickedItemsSignature
      ) {
        abortWithMessage(
          "商品移動リストの内容が更新されています。画面を開き直して、もう一度確認してください。"
        );
        return;
      }

      const now = new Date().toISOString();
      const updatedProducts = [];

      for (const item of items) {
        const savedProduct = productsByCode.get(
          item.internalCode
        );

        if (!savedProduct) {
          abortWithMessage(
            `社内コード ${item.internalCode} の商品が見つかりません。`
          );
          return;
        }

        const product = normalizeProductLocationStocks(
          savedProduct
        );
        const locationStocks = product.locationStocks.map(
          function (entry) {
            return {
              location: normalizeLocationStockName(
                entry.location
              ),
              stock: normalizeLocationStockQuantity(
                entry.stock
              )
            };
          }
        );

        const sourceEntry = locationStocks.find(
          function (entry) {
            return entry.location === sourceLocation;
          }
        );
        const sourceStock = sourceEntry
          ? sourceEntry.stock
          : 0;

        if (sourceStock < item.quantity) {
          abortWithMessage(
            `${product.productName || item.productName || item.internalCode}\n` +
            `移動元「${sourceLocation}」の在庫が不足しています。\n` +
            `現在：${sourceStock}個 / 移動：${item.quantity}個`
          );
          return;
        }

        sourceEntry.stock -= item.quantity;

        let destinationEntry = locationStocks.find(
          function (entry) {
            return entry.location === destinationLocation;
          }
        );

        const destinationStockBefore =
          destinationEntry
            ? normalizeLocationStockQuantity(
                destinationEntry.stock
              )
            : 0;

        if (!destinationEntry) {
          destinationEntry = {
            location: destinationLocation,
            stock: 0
          };
          locationStocks.push(destinationEntry);
        }

        destinationEntry.stock += item.quantity;

        let primaryLocation = normalizeLocationStockName(
          product.location
        );

        if (
          primaryLocation === "" ||
          (
            primaryLocation === sourceLocation &&
            sourceEntry.stock === 0
          )
        ) {
          primaryLocation = destinationLocation;
        }

        const cleanedLocationStocks = locationStocks.filter(
          function (entry) {
            return (
              entry.stock > 0 ||
              entry.location === primaryLocation
            );
          }
        );

        const beforeStock = normalizeLocationStockQuantity(
          product.stock
        );
        const updatedProduct = normalizeProductLocationStocks({
          ...product,
          stock: beforeStock,
          location: primaryLocation,
          locationStocks: cleanedLocationStocks,
          updatedAt: now
        });

        updatedProducts.push(updatedProduct);
        productStore.put(updatedProduct);

        movementStore.add({
          id: createTransferMovementId(
            transferId,
            item.internalCode
          ),
          dateTime: now,
          internalCode: updatedProduct.internalCode,
          productCode: updatedProduct.productCode || "",
          productName: updatedProduct.productName || "",
          janCode: updatedProduct.janCode || "",
          type: "移動",
          quantity: item.quantity,
          beforeStock: beforeStock,
          afterStock: beforeStock,
          person: person,
          reason: "移動",
          memo: `${sourceLocation} → ${destinationLocation}`,
          sourceLocation: sourceLocation,
          destinationLocation: destinationLocation,
          locationChanges: [
            {
              location: sourceLocation,
              beforeStock: sourceStock,
              afterStock: sourceEntry.stock,
              change: -item.quantity
            },
            {
              location: destinationLocation,
              beforeStock: destinationStockBefore,
              afterStock: destinationEntry.stock,
              change: item.quantity
            }
          ],
          transferListId: transferId
        });
      }

      const updatedTransfer = {
        ...currentTransfer,
        destinationConfirmedBy: person,
        destinationConfirmedAt:
          currentTransfer.destinationConfirmedAt || now,
        inventoryAppliedBy: person,
        inventoryAppliedAt: now,
        updatedAt: now
      };

      transferStore.put(updatedTransfer);

      result = {
        transfer: updatedTransfer,
        products: updatedProducts
      };
    }

    const transferRequest = transferStore.get(
      transferId
    );

    transferRequest.onsuccess = function () {
      currentTransfer = transferRequest.result || null;
      requestCompleted();
    };

    transferRequest.onerror = function () {
      abortWithMessage(
        transferRequest.error ||
        "商品移動リストを読み込めませんでした。"
      );
    };

    items.forEach(function (item) {
      const request = productStore.get(
        item.internalCode
      );

      request.onsuccess = function () {
        productsByCode.set(
          item.internalCode,
          request.result || null
        );
        requestCompleted();
      };

      request.onerror = function () {
        abortWithMessage(
          request.error ||
          `社内コード ${item.internalCode} の商品を読み込めませんでした。`
        );
      };
    });

    transaction.oncomplete = function () {
      database.close();
      resolve(result);
    };

    transaction.onerror = function () {
      const error = failureError || transaction.error;
      database.close();
      reject(error);
    };

    transaction.onabort = function () {
      const error = failureError || transaction.error;
      database.close();
      reject(error);
    };
  });
}

async function deleteTransferList(id) {
  const database = await openDatabase();
  return new Promise(function (resolve, reject) {
    const transaction = database.transaction(
      TRANSFER_LIST_STORE_NAME,
      "readwrite"
    );
    transaction.objectStore(TRANSFER_LIST_STORE_NAME).delete(id);
    transaction.oncomplete = function () { database.close(); resolve(); };
    transaction.onerror = function () {
      const error = transaction.error;
      database.close();
      reject(error);
    };
    transaction.onabort = transaction.onerror;
  });
}

