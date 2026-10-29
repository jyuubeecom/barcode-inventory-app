'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
function load(...files) {
  const window = {addEventListener() {}};
  const document = {querySelector() {return null;}, addEventListener() {}};
  const context = vm.createContext({window, document, console});
  for (const file of files) vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, {filename:file});
  return context;
}
function plain(v) {return JSON.parse(JSON.stringify(v));}
test('all application scripts and inline scripts compile', () => {
  const files = fs.readdirSync(root).filter(f => f.endsWith('.js'));
  files.push('libs/barcode-detector-zxing-adapter.js');
  for (const file of files) new vm.Script(fs.readFileSync(path.join(root, file), 'utf8'), {filename:file});
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  for (const match of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)) if (match[1].trim()) new vm.Script(match[1]);
});
test('HTML script references and service-worker cached files exist and use the same versions', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const context = vm.createContext({self:{registration:{scope:'https://example.invalid/inventory-test-v2933/'}, addEventListener() {}}});
  vm.runInContext(fs.readFileSync(path.join(root, 'service-worker.js'), 'utf8') + '\nglobalThis.files = APP_FILES;', context);
  for (const file of context.files) assert.ok(fs.existsSync(path.join(root, file.split('?')[0])), file);
  for (const m of html.matchAll(/<script\b[^>]*src="([^"]+)"/g)) {
    if (/^https?:/.test(m[1])) continue;
    assert.ok(fs.existsSync(path.join(root, m[1].split('?')[0])), m[1]);
    assert.ok(context.files.includes('./' + m[1].replace(/^\.\//,'')), 'cache version: ' + m[1]);
  }
});
test('inventory location lookup and cloning preserve stock and the source product', () => {
  const c = load('storage.js', 'inventory.js');
  const product = {internalCode:'FAKE-001', stock:12, location:'本社', locationStocks:[{location:'本社', stock:7}, {location:'酒本倉庫1階', stock:5}]};
  assert.equal(c.getInventoryLocationStock(product, '酒本倉庫1階'), 5);
  assert.equal(c.getInventoryLocationStock(product, '酒本倉庫2階'), 0);
  const clone = c.cloneInventoryLocationStocks(product); clone[0].stock = 999;
  assert.equal(product.locationStocks[0].stock, 7);
  assert.equal(product.stock, 12);
});
test('purchase calculation uses the previous six months across a year boundary', () => {
  const c = load('purchase-required.js');
  const r = c.buildPurchaseRequiredDateContext(new Date(2026, 0, 15));
  assert.deepEqual(plain(r.actualMonthKeys), ['2025-07','2025-08','2025-09','2025-10','2025-11','2025-12']);
  assert.equal(r.actualStartDate, '2025-07-01'); assert.equal(r.actualEndDate, '2025-12-31');
});
test('purchase excludes discontinued, dedicated and scheduled-discontinued products', () => {
  const c = load('purchase-required.js');
  for (const productStatus of ['廃盤','廃盤予定','専用商品']) assert.equal(c.isPurchaseDiscontinuedProduct({productStatus}), true);
  assert.equal(c.isPurchaseDiscontinuedProduct({productStatus:'通常'}), false);
  assert.equal(c.getPurchaseOrderRemaining({orderRemaining:120}), 120);
});
test('purchase sales plans include overlapping periods and exclude out-of-range dates', () => {
  const c = load('purchase-required.js');
  const map = c.aggregatePurchasePlans([
    {internalCode:'FAKE-001', shippingType:'date', shippingDate:'2026-10-30', quantity:3},
    {internalCode:'FAKE-001', shippingType:'period', shippingStartDate:'2026-09-01', shippingEndDate:'2026-10-02', quantity:4},
    {internalCode:'FAKE-001', shippingType:'date', shippingDate:'2026-11-01', quantity:100}
  ], '2026-10-01','2026-10-31');
  assert.equal(map.get('FAKE-001'), 7);
});
test('shipping uses confirmed snapshot and ignores unconfirmed schedules', () => {
  const c = load('shipping-arrival.js');
  const allocations = [{scheduleId:'FAKE-TRIP', internalCode:'FAKE-001', quantity:100}];
  assert.equal(c.getShippingArrivalConfirmedQuantity({id:'FAKE-TRIP'}, allocations), 0);
  assert.equal(c.getShippingArrivalConfirmedQuantity({id:'FAKE-TRIP', shipmentConfirmed:true, shipmentConfirmedItems:[{internalCode:'FAKE-001', quantity:6}]}, allocations), 6);
  assert.equal(c.groupShippingArrivalAllocations([{internalCode:'FAKE-001', quantity:2}, {internalCode:'FAKE-001', quantity:3}])[0].quantity, 5);
});
test('stocktaking detects a location transfer even when total stock is unchanged', () => {
  const c = load('storage.js', 'stocktaking.js');
  const before = [{location:'本社', stock:8}, {location:'酒本倉庫1階', stock:2}];
  const after = [{location:'本社', stock:6}, {location:'酒本倉庫1階', stock:4}];
  assert.equal(c.areStocktakingStockSnapshotsEqual(before, before.slice().reverse()), true);
  assert.equal(c.areStocktakingStockSnapshotsEqual(before, after), false);
  assert.deepEqual(plain(c.createStocktakingMovementLocationChanges(before, after)).map(r => r.change), [-2, 2]);
});
