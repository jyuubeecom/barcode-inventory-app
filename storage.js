"use strict";

const DATABASE_NAME =
  "barcodeInventoryDatabase";

const DATABASE_VERSION = 3;

const PRODUCT_STORE_NAME =
  "products";

const MOVEMENT_STORE_NAME =
  "stockMovements";

const STOCKTAKING_STORE_NAME =
  "stocktakings";

function openDatabase() {
  return new Promise(function (
    resolve,
    reject
  ) {
    const request = indexedDB.open(
      DATABASE_NAME,
      DATABASE_VERSION
    );

    request.onupgradeneeded = function (
      event
    ) {
      const database =
        event.target.result;

      if (
        !database.objectStoreNames.contains(
          PRODUCT_STORE_NAME
        )
      ) {
        const productStore =
          database.createObjectStore(
            PRODUCT_STORE_NAME,
            {
              keyPath: "internalCode"
            }
          );

        productStore.createIndex(
          "productCode",
          "productCode",
          {
            unique: true
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
    };

    request.onsuccess = function () {
      resolve(request.result);
    };

    request.onerror = function () {
      reject(request.error);
    };
  });
}

async function saveProduct(product) {
  const database = await openDatabase();

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

    productStore.add(product);

    transaction.oncomplete = function () {
      database.close();
      resolve();
    };

    transaction.onerror = function () {
      const error = transaction.error;

      database.close();
      reject(error);
    };

    transaction.onabort = function () {
      const error = transaction.error;

      database.close();
      reject(error);
    };
  });
}

async function saveProductAndMovement(
  product,
  movement
) {
  const database = await openDatabase();

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

    productStore.add(product);
    movementStore.add(movement);

    transaction.oncomplete = function () {
      database.close();
      resolve();
    };

    transaction.onerror = function () {
      const error = transaction.error;

      database.close();
      reject(error);
    };

    transaction.onabort = function () {
      const error = transaction.error;

      database.close();
      reject(error);
    };
  });
}

async function updateProduct(product) {
  const database = await openDatabase();

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

    productStore.put(product);

    transaction.oncomplete = function () {
      database.close();
      resolve();
    };

    transaction.onerror = function () {
      const error = transaction.error;

      database.close();
      reject(error);
    };

    transaction.onabort = function () {
      const error = transaction.error;

      database.close();
      reject(error);
    };
  });
}

async function deleteProduct(
  internalCode
) {
  const database = await openDatabase();

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

    productStore.delete(internalCode);

    transaction.oncomplete = function () {
      database.close();
      resolve();
    };

    transaction.onerror = function () {
      const error = transaction.error;

      database.close();
      reject(error);
    };

    transaction.onabort = function () {
      const error = transaction.error;

      database.close();
      reject(error);
    };
  });
}

async function getAllProducts() {
  const database = await openDatabase();

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

    request.onsuccess = function () {
      savedProducts =
        request.result;
    };

    transaction.oncomplete = function () {
      database.close();
      resolve(savedProducts);
    };

    transaction.onerror = function () {
      const error = transaction.error;

      database.close();
      reject(error);
    };
  });
}

async function getAllStockMovements() {
  const database = await openDatabase();

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

    request.onsuccess = function () {
      savedMovements =
        request.result;
    };

    transaction.oncomplete = function () {
      database.close();
      resolve(savedMovements);
    };

    transaction.onerror = function () {
      const error = transaction.error;

      database.close();
      reject(error);
    };
  });
}

async function recordStockMovement(
  updatedProduct,
  movement
) {
  const database = await openDatabase();

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

    transaction.oncomplete = function () {
      database.close();
      resolve();
    };

    transaction.onerror = function () {
      const error = transaction.error;

      database.close();
      reject(error);
    };

    transaction.onabort = function () {
      const error = transaction.error;

      database.close();
      reject(error);
    };
  });
}

async function saveStocktakingSession(
  stocktaking
) {
  const database = await openDatabase();

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

    transaction.oncomplete = function () {
      database.close();
      resolve();
    };

    transaction.onerror = function () {
      const error = transaction.error;

      database.close();
      reject(error);
    };

    transaction.onabort = function () {
      const error = transaction.error;

      database.close();
      reject(error);
    };
  });
}

async function updateStocktakingSession(
  stocktaking
) {
  const database = await openDatabase();

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

    transaction.oncomplete = function () {
      database.close();
      resolve();
    };

    transaction.onerror = function () {
      const error = transaction.error;

      database.close();
      reject(error);
    };

    transaction.onabort = function () {
      const error = transaction.error;

      database.close();
      reject(error);
    };
  });
}

async function getOpenStocktakingSessions() {
  const database = await openDatabase();

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
      statusIndex.getAll("進行中");

    let stocktakings = [];

    request.onsuccess = function () {
      stocktakings =
        request.result;
    };

    transaction.oncomplete = function () {
      database.close();
      resolve(stocktakings);
    };

    transaction.onerror = function () {
      const error = transaction.error;

      database.close();
      reject(error);
    };
  });
}

async function getStocktakingSession(
  stocktakingId
) {
  const database = await openDatabase();

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

    request.onsuccess = function () {
      stocktaking =
        request.result || null;
    };

    transaction.oncomplete = function () {
      database.close();
      resolve(stocktaking);
    };

    transaction.onerror = function () {
      const error = transaction.error;

      database.close();
      reject(error);
    };
  });
}

async function deleteStocktakingSession(
  stocktakingId
) {
  const database = await openDatabase();

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

    transaction.oncomplete = function () {
      database.close();
      resolve();
    };

    transaction.onerror = function () {
      const error = transaction.error;

      database.close();
      reject(error);
    };

    transaction.onabort = function () {
      const error = transaction.error;

      database.close();
      reject(error);
    };
  });
}