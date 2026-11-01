"use strict";
(function (root) {
  const KEY = 'barcodeInventoryWorkspace';
  function isAdmin() {
    return (root.document?.body?.dataset.roleMode || read('barcodeInventoryRoleMode') || 'admin') === 'admin';
  }
  function read(key) {try {return root.localStorage.getItem(key);} catch (_) {return null;}}
  function mode() {return isAdmin() && read(KEY) === 'legacy' ? 'legacy' : 'shared';}
  function source() {return mode() === 'shared' ? 'server' : 'local';}
  function setMode(value) {
    if (!isAdmin()) throw new Error('管理者設定で変更してください。');
    if (!['shared','legacy'].includes(value)) throw new Error('表示方法を確認してください。');
    root.localStorage.setItem(KEY,value);
    apply();
    root.inventoryApp?.showScreen('home');
  }
  root.inventoryCommonWorkspace = {mode,source,setMode};
  function apply() {
    root.document.body.dataset.workspace = mode();
    const select = root.document.getElementById('inventory-workspace-mode');
    if (select) select.value = mode();
    const settings = root.document.getElementById('inventory-workspace-settings');
    if (settings) settings.hidden = !isAdmin();
    const status = root.document.getElementById('common-workspace-status');
    if (status) status.textContent = root.inventoryServerSearch?.hasSession()
      ? '全員共通の在庫を使います。入庫・出庫は商品詳細から操作できます。'
      : '商品一覧または現在庫表を開いてログインしてください。';
    root.dispatchEvent(new CustomEvent('inventory-workspace-changed',{detail:{mode:mode(),source:source()}}));
  }
  root.document.addEventListener('DOMContentLoaded', function () {
    const style = root.document.createElement('style');
    style.textContent = `
      body[data-workspace="shared"] #home-natural-stock-search,
      body[data-workspace="shared"] #home .home-summary-grid,
      body[data-workspace="shared"] #home .home-function-grid,
      body[data-workspace="shared"] #home-alert-panel,
      body[data-workspace="shared"] #home-quick-action-buttons > :not(#show-list-button):not(#show-location-stock-report-button),
      body[data-workspace="shared"] #product-list-source-switch,
      body[data-workspace="shared"] #location-stock-report-source-label,
      body[data-workspace="shared"] #location-stock-report-source,
      body[data-workspace="shared"] .location-stock-report-legacy-note {display:none!important;}
      #common-workspace-home {padding:18px;background:#edf7ff;border:1px solid #b6d5f0;border-radius:12px;}
      #common-workspace-home p {margin:8px 0;line-height:1.7;}
      #common-workspace-legacy {padding:16px;background:#fff5dc;border:2px solid #d59c22;border-radius:10px;}
      body[data-workspace="shared"] #common-workspace-legacy,
      body[data-workspace="legacy"] #common-workspace-home {display:none!important;}
      #inventory-workspace-settings {margin:16px 0;padding:16px;border:1px solid #b6d5f0;border-radius:10px;}
      #inventory-workspace-settings select {width:100%;margin:8px 0;}
      #inventory-workspace-settings p {line-height:1.7;}
    `;
    root.document.head.appendChild(style);
    const home = root.document.getElementById('home');
    if (home) {
      const box = root.document.createElement('section');
      box.id = 'common-workspace-home';
      box.innerHTML = '<strong>みんなの在庫</strong><p id="common-workspace-status" role="status"></p><p>商品を探す → 在庫を見る → 入庫・出庫。別の端末で更新した後は「再読み込み」を押してください。</p><details><summary>利用できる機能</summary><p>商品一覧・現在庫表・商品詳細からの入庫と出庫が共通データに対応しています。棚卸・販売実績・加工・移動などは接続準備中です。</p></details>';
      home.querySelector('.home-dashboard-heading')?.insertAdjacentElement('afterend',box);
      const legacy = root.document.createElement('p');legacy.id = 'common-workspace-legacy';
      legacy.textContent = '管理者用：端末内の従来機能です。ここでの棚卸・売上・加工・移動は共通在庫に反映されません。設定から「共通データ」に戻れます。';
      home.prepend(legacy);
    }
    const settings = root.document.getElementById('app-settings-screen');
    if (settings) {
      const box = root.document.createElement('section');box.id = 'inventory-workspace-settings';
      box.innerHTML = '<label for="inventory-workspace-mode"><strong>在庫の使い方（管理者用）</strong></label><select id="inventory-workspace-mode"><option value="shared">共通データで使う</option><option value="legacy">端末内の従来機能を使う</option></select><p>通常は「共通データ」を使います。従来機能は棚卸などの移行準備用です。数量を合算・上書きしたり、保存済みのデータを削除したりする設定ではありません。</p>';
      settings.querySelector('h2')?.insertAdjacentElement('afterend',box);
      box.querySelector('select').addEventListener('change',function(event) {
        try {setMode(event.target.value);} catch(error) {root.alert(error.message);apply();}
      });
    }
    apply();
    root.addEventListener('inventory-role-mode-change',apply);
    root.addEventListener('inventory-server-auth-changed',function(){
      const status=root.document.getElementById('common-workspace-status');
      if(status)status.textContent=root.inventoryServerSearch?.hasSession()?'ログイン済みです。商品一覧・現在庫表から共通在庫を確認できます。':'商品一覧または現在庫表を開いてログインしてください。';
    });
    root.addEventListener('storage',function(event){if([KEY,'barcodeInventoryRoleMode'].includes(event.key))apply();});
  });
})(window);
