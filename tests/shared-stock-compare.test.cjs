"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const compare = require("../shared-stock-compare.js");

test("compares quantities by internal code and distinguishes missing values from zero", () => {
  const backup = {
    backupType: "barcode-inventory-app",
    exportedAt: "2026-01-01T00:00:00Z",
    data: { products: [
      { internalCode: "A", productCode: "REUSED", stock: 11, orderRemaining: "9" },
      { internalCode: "B", productCode: "REUSED", stock: 0, orderRemaining: 0 },
      { internalCode: "C", stock: 3, orderRemaining: 2 }
    ] }
  };
  const shared = {
    products: [
      { internal_code: "B", total_stock: 0 },
      { internal_code: "A", total_stock: 18 },
      { internal_code: "D", total_stock: 2 }
    ],
    planning: { data: { purchaseMetadata: [
      { internalCode: "A", orderRemaining: 4 },
      { internalCode: "B", orderRemaining: 0 }
    ] } }
  };

  const result = compare(backup, shared);
  assert.deepEqual(result.counts, { stock: 1, order: 1, unknown: 2 });
  assert.deepEqual(result.rows.map(row => [row.code, row.different]), [
    ["A", true], ["B", false], ["C", true], ["D", true]
  ]);
  assert.equal(result.rows[0].local.order, 9);
  assert.equal(result.rows[3].shared.order, null);
  assert.equal(result.rows[2].shared, undefined);
  assert.equal(backup.data.products[0].orderRemaining, "9");
  assert.throws(() => compare({}, shared), /全データバックアップ/);
  backup.data.products.push(backup.data.products[0]);
  assert.throws(() => compare(backup, shared), /重複/);
});

test("offers review candidates only for confirmed changed quantities", () => {
  const { candidate } = compare;
  assert.deepEqual(candidate({ local: { stock: 0 }, shared: { stock: 12 } }, "stock"), {
    before: 12,
    after: 0
  });
  assert.equal(candidate({ local: { stock: 0 }, shared: { stock: 0 } }, "stock"), null);
  assert.equal(candidate({ local: { stock: 4 }, shared: { stock: -1 } }, "stock"), null);
  assert.equal(candidate({ local: { order: 4 }, shared: { order: null } }, "order"), null);
  assert.equal(candidate({ local: { order: 4 } }, "order"), null);
});
