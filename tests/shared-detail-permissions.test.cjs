'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function fixture(initialRole) {
  let role = initialRole;
  const listeners = {};
  const elements = new Map();
  for (const selector of ['#server-product-edit-action', '#server-product-adjust-action',
    '.server-product-detail-operation-ready strong', '#server-product-detail-notice span',
    '#server-product-stock-in', '#server-product-stock-out', '#server-product-stock-history']) {
    const classes = new Set();
    elements.set(selector, {hidden:false, textContent:'', classes,
      classList:{toggle(name, enabled) { enabled ? classes.add(name) : classes.delete(name); }}});
  }
  const detail = {querySelector:selector => elements.get(selector)};
  const window = {inventoryPermissions:{isAdmin:()=>role === 'admin'},
    addEventListener:(name, handler)=>listeners[name]=handler};
  const document = {addEventListener(){}, querySelector:selector=>selector === '#product-detail' ? detail : null};
  const source = fs.readFileSync(path.join(__dirname, '../server-test.js'), 'utf8')
    .replace('  function syncServerProductDetailPermissions() {',
      '  window.detailTest = {sync:syncServerProductDetailPermissions, open(){serverDetailMode=true;}, close(){serverDetailMode=false;}};\n  function syncServerProductDetailPermissions() {');
  vm.runInNewContext(source, {window, document});
  return {window, elements, sync:window.detailTest.sync, change(next) {
    role=next; listeners['inventory-role-mode-change']();
  }};
}

test('worker hides shared edit and adjustment while keeping stock operations and history visible',()=>{
  const f=fixture('worker'); f.sync();
  for(const id of ['edit','adjust']) {
    const button=f.elements.get(`#server-product-${id}-action`);
    assert.equal(button.hidden,true); assert.ok(button.classes.has('role-menu-hidden'));
  }
  for(const id of ['in','out','history']) assert.equal(f.elements.get(`#server-product-stock-${id}`).hidden,false);
  for(const selector of ['.server-product-detail-operation-ready strong','#server-product-detail-notice span']) {
    const text=f.elements.get(selector).textContent;
    assert.match(text,/入庫・出庫/); assert.doesNotMatch(text,/商品編集|数量調整/);
  }
});

test('role changes on an open shared detail hide and restore admin controls and descriptions',()=>{
  const f=fixture('admin'); f.window.detailTest.open(); f.sync();
  assert.equal(f.elements.get('#server-product-edit-action').hidden,false);
  f.change('worker'); assert.equal(f.elements.get('#server-product-adjust-action').hidden,true);
  f.change('admin');
  for(const id of ['edit','adjust']) {
    const button=f.elements.get(`#server-product-${id}-action`);
    assert.equal(button.hidden,false); assert.ok(!button.classes.has('role-menu-hidden'));
  }
  assert.match(f.elements.get('.server-product-detail-operation-ready strong').textContent,/商品編集・数量調整/);
});

test('missing permissions fail closed for admin controls',()=>{
  const f=fixture('admin'); delete f.window.inventoryPermissions; f.sync();
  assert.equal(f.elements.get('#server-product-edit-action').hidden,true);
  assert.equal(f.elements.get('#server-product-adjust-action').hidden,true);
});
