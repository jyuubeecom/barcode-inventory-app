"use strict";

const DATABASE_NAME =
  "barcodeInventoryDatabase";

const DATABASE_VERSION = 9;

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
      product
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
      product
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
      product
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
          request.result || [];
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
      updatedProduct
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
          product
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
        productStore.put(product);
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
      store.put(product);
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

async function saveSalesActualImportBatch(batchRecord, salesRecords) {
  const database = await openDatabase();

  return new Promise(function (resolve, reject) {
    const transaction = database.transaction(
      [
        SALES_ACTUAL_STORE_NAME,
        SALES_IMPORT_BATCH_STORE_NAME
      ],
      "readwrite"
    );

    const salesStore = transaction.objectStore(
      SALES_ACTUAL_STORE_NAME
    );
    const batchStore = transaction.objectStore(
      SALES_IMPORT_BATCH_STORE_NAME
    );

    batchStore.add(batchRecord);
    salesRecords.forEach(function (record) {
      salesStore.add(record);
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

async function deleteSalesActualImportBatch(batchId) {
  const database = await openDatabase();

  return new Promise(function (resolve, reject) {
    const transaction = database.transaction(
      [
        SALES_ACTUAL_STORE_NAME,
        SALES_IMPORT_BATCH_STORE_NAME
      ],
      "readwrite"
    );

    const salesStore = transaction.objectStore(
      SALES_ACTUAL_STORE_NAME
    );
    const batchStore = transaction.objectStore(
      SALES_IMPORT_BATCH_STORE_NAME
    );
    const index = salesStore.index("batchId");
    const request = index.openCursor(IDBKeyRange.only(batchId));

    request.onsuccess = function () {
      const cursor = request.result;
      if (!cursor) {
        batchStore.delete(batchId);
        return;
      }
      cursor.delete();
      cursor.continue();
    };

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

