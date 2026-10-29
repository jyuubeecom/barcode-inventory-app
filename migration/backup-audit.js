"use strict";
(function (root) {
  const STORES = {
    products:["商品","internalCode"],stockMovements:["入出庫履歴","id"],stocktakings:["棚卸履歴","id"],
    stocktakingSubmissions:["棚卸提出","submissionId"],aggregationReflections:["棚卸反映履歴","reflectionId"],
    salesPlans:["販売予定","id"],salesActuals:["販売実績","id"],salesImportBatches:["売上取込履歴","batchId"],
    shippingWishes:["船積希望","id"],shippingSchedules:["船便予定","id"],shippingAllocations:["船便商品振分け","id"],
    shippingWarehouseAllocations:["倉庫別振分け","id"],shippingArrivalReceipts:["船便入荷履歴","id"],
    transferLists:["商品移動リスト","id"],orderRemainingHistories:["発注残履歴","id"],disposalLists:["廃棄リスト","id"],
    customers:["取引先","id"],restoreLogs:["復元履歴","id"]
  };
  const isObject = v => v !== null && typeof v === "object" && !Array.isArray(v);
  const quantity = v => (typeof v === "number" || typeof v === "string" && /^(0|[1-9]\d*)$/.test(v)) && Number.isSafeInteger(Number(v)) && Number(v) >= 0 && Number(v) <= 1000000000;
  const cleanText = (v, max) => typeof v === "string" && v.trim() === v && v.length > 0 && Array.from(v).length <= max && !/[\x00-\x1f\x7f]/.test(v);
  function placeName(value) {
    if (typeof value !== "string") return "";
    return value.trim().replace(/^本社([12])階\s*([A-Fa-f])区$/, (_,f,a) => `本社${f}階 ${a.toUpperCase()}区`);
  }
  function collationKey(value) {
    return value.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().trimEnd();
  }
  function auditBackup(raw) {
    if (!isObject(raw) || raw.backupType !== "barcode-inventory-app" || !Number.isInteger(raw.backupVersion) || raw.backupVersion < 1 || raw.backupVersion > 12 || !isObject(raw.data)) {
      throw new Error("対応する在庫アプリの全データバックアップ（形式1～12）を選んでください。");
    }
    const data = raw.data, issues = [], counts = {}, categories = {};
    let errorCount = 0, warningCount = 0, totalStock = 0, locationRows = 0;
    const add = (severity, category, record, message) => {
      if (severity === "error") errorCount++; else warningCount++;
      categories[category] = (categories[category] || 0) + 1;
      // Keep reports bounded, while retaining accurate totals for every finding.
      if (issues.length < 500) issues.push({severity,category,record,message});
    };
    const codes = new Set(), aliases = new Set(), states = Object.create(null);
    for (const [store,[label,key]] of Object.entries(STORES)) {
      if (!Object.hasOwn(data,store)) {
        const required = raw.backupVersion === 12 || ["products","stockMovements","stocktakings"].includes(store);
        add(required ? "error" : "warning","保存項目の不足",store,`${label}が含まれていません。`);
        counts[store] = null; continue;
      }
      if (!Array.isArray(data[store])) { add("error","保存項目の形式",store,`${label}が配列ではありません。`); counts[store] = null; continue; }
      const records = data[store]; counts[store] = records.length;
      if (isObject(raw.counts) && Object.hasOwn(raw.counts,store) && raw.counts[store] !== records.length) add("error","件数の不一致",store,`${label}の記録件数と実件数が一致しません。`);
      const keys = new Set();
      records.forEach((record,index) => {
        const ref = `${label} ${index + 1}件目`;
        if (!isObject(record)) { add("error","レコードの形式",ref,"データがオブジェクトではありません。"); return; }
        const value = record[key];
        const validKey = typeof value === "string" && value.trim() !== "" || typeof value === "number" && Number.isSafeInteger(value);
        if (!validKey) add("error","識別番号の不足",ref,"識別番号を確認できません。");
        else if (keys.has(String(value))) add("error","識別番号の重複",ref,"同じ識別番号が複数あります。");
        else keys.add(String(value));
        if (store !== "products") return;
        const code = record.internalCode;
        if (!cleanText(code,50)) add("error","社内コードの形式",ref,"社内コードは前後空白のない1～50文字の文字列が必要です。");
        else {
          codes.add(code);
          const normalized = collationKey(code);
          if (aliases.has(normalized)) add("error","社内コードの表記衝突",ref,"大文字小文字・全角半角・濁点等の表記を統一すると別の商品コードと衝突する可能性があります。");
          aliases.add(normalized);
        }
        if (!cleanText(record.productName,255)) add("error","商品名の形式",ref,"空欄・前後空白・長さ・制御文字を確認してください。");
        const maxLengths = {productCode:100,janCode:50,color:100,category:100,supplierName:255,unit:50};
        for (const [field,max] of Object.entries(maxLengths)) {
          const value = record[field];
          if (value !== undefined && value !== null && value !== "" && !cleanText(value,max)) add("error","商品項目の形式",ref,`${field}はサーバーで保存できる形式・長さを確認する必要があります。`);
        }
        if (!quantity(record.stock)) { add("error","在庫数の形式",ref,"総在庫は0～10億の整数が必要です。"); return; }
        totalStock += Number(record.stock);
        if (!Number.isSafeInteger(totalStock)) add("error","総在庫の上限",ref,"全商品の合計が正確に計算できる範囲を超えました。");
        const state = record.productStatus || "通常商品";
        states[String(state)] = (states[String(state)] || 0) + 1;
        if (!["通常商品","通常","廃盤","廃盤予定","専用商品","注残"].includes(state)) add("warning","商品状態の対応",ref,"サーバー側への状態の対応確認が必要です。");
        const fixed = ["廃盤予定","専用商品"].includes(state);
        if (fixed) add("warning","固定状態の引継ぎ",ref,"固定の商品状態をCSVや自動判定で変更しない移行処理が必要です。");
        if (!Object.hasOwn(record,"locationStocks") || Array.isArray(record.locationStocks) && !record.locationStocks.length) {
          if (Number(record.stock) > 0) add("warning","場所別在庫の不足",ref,"総在庫だけがあり、場所別在庫の割当確認が必要です。");
          return;
        }
        if (!Array.isArray(record.locationStocks)) { add("error","場所別在庫の形式",ref,"場所別在庫が配列ではありません。"); return; }
        let sum = 0; const places = new Set(); let aggregate = false, areas = false;
        for (const entry of record.locationStocks) {
          locationRows++;
          if (!isObject(entry) || !quantity(entry.stock) || !cleanText(entry.location,100)) { add("error","場所別在庫の形式",ref,"場所または数量が不正です。"); continue; }
          const place = placeName(entry.location);
          if (places.has(place)) add("error","保管場所の重複",ref,"同じ場所に複数の在庫行があります。自動で合算せず内容を確認します。");
          places.add(place); sum += Number(entry.stock);
          if (place !== entry.location) add("warning","保管場所の表記",ref,"本社の階・区の空白や英字表記を統一する必要があります。");
          if (place === "本社" && Number(entry.stock) > 0) aggregate = true;
          if (/^本社[12]階 [A-F]区$/.test(place) && Number(entry.stock) > 0) areas = true;
          if (!["本社","酒本倉庫1階","酒本倉庫2階"].includes(place) && !/^本社[12]階 [A-F]区$/.test(place)) add("warning","保管場所の対応",ref,"未確認・未設定等の保管場所の対応確認が必要です。");
        }
        if (sum !== Number(record.stock)) add("error","総在庫と場所別合計の不一致",ref,`総在庫 ${record.stock}個 / 場所別合計 ${sum}個。自動補正しません。`);
        if (aggregate && areas) add("warning","本社合算と棚別の混在",ref,"本社と本社の各区に在庫があります。別在庫か合算値かを確認し、二重計上を避けます。");
      });
    }
    if (counts.products === 0) add("error","空の商品データ","products","商品が0件です。会社で使っているアプリから取得したバックアップか確認してください。");
    for (const store of ["stockMovements","salesPlans","salesActuals","orderRemainingHistories"]) {
      for (const [index,record] of (Array.isArray(data[store]) ? data[store] : []).entries()) {
        if (isObject(record) && typeof record.internalCode === "string" && record.internalCode && !codes.has(record.internalCode)) add("warning","商品に対応しない履歴",`${STORES[store][0]} ${index+1}件目`,"商品マスタにない社内コードの記録があります。削除済み商品の履歴等として保持方法を確認します。");
      }
    }
    if (!isObject(raw.counts)) add("warning","件数情報の不足","counts","バックアップの件数情報がありません。実際の配列件数を集計しました。");
    if (typeof raw.exportedAt !== "string" || !/^\d{4}-\d{2}-\d{2}T/.test(raw.exportedAt) || !Number.isFinite(Date.parse(raw.exportedAt))) add("warning","作成日時の確認","exportedAt","作成日時を確認できません。最新バックアップであるか確認してください。");
    return {format:"inventory-migration-audit-v1",backupVersion:raw.backupVersion,
      backupExportedAt:typeof raw.exportedAt === "string" ? raw.exportedAt : null,
      status:errorCount ? "修正・確認が必要" : "形式チェック完了・移行は未実施",errorCount,warningCount,
      totalStock,locationRows,counts,states,categories,issues,omittedIssues:Math.max(0,errorCount+warningCount-issues.length),
      limits:["サーバーとの照合・書込は行っていません。","照合規則はMySQLの照合順序の完全な再現ではありません。","履歴等の業務ルール・関連付けの全検証は含みません。","会社の許可、移行開始時点、既存の共有データとの対応を別途確認します。"]};
  }
  // This version is safe to share: no names, codes, dates, stock totals, quantities or free text.
  function shareSummary(report) {
    return {format:report.format,status:report.errorCount ? "要確認" : "形式チェック完了",backupVersion:report.backupVersion,
      errorCount:report.errorCount,warningCount:report.warningCount,counts:report.counts,categories:report.categories,
      serverCompared:false,migrated:false};
  }
  const api = {auditBackup,shareSummary,stores:STORES};
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.InventoryMigrationAudit = api;
})(globalThis);
