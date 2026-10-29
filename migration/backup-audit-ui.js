"use strict";
(function () {
  const el = id => document.getElementById(id);
  let report = null, generation = 0;
  const text = (parent,tag,value) => { const node=document.createElement(tag);node.textContent=value;parent.appendChild(node);return node; };
  function clear() { report=null;el("result").replaceChildren();el("details").replaceChildren();el("share").value="";el("download").disabled=true; }
  el("file").addEventListener("change",async()=>{
    const current=++generation;clear();const file=el("file").files?.[0];if(!file)return;
    if(file.size===0 || file.size>100*1024*1024){el("message").textContent="100MBまでのJSONバックアップを選択してください。";return;}
    el("message").textContent="パソコン内で確認しています。";
    try {
      const raw=JSON.parse((await file.text()).replace(/^\uFEFF/,""));
      if(current!==generation)return;
      report=InventoryMigrationAudit.auditBackup(raw);
      text(el("result"),"h2",report.status);
      text(el("result"),"p",`要修正・確認 ${report.errorCount}件 / 注意 ${report.warningCount}件`);
      text(el("result"),"p",`商品 ${report.counts.products ?? "確認不可"}件 / 総在庫 ${report.totalStock.toLocaleString()}個 / 場所別在庫 ${report.locationRows}行`);
      const table=text(el("result"),"table","");const header=document.createElement("tr");text(header,"th","データ");text(header,"th","件数");table.appendChild(header);
      for(const [name,[label]] of Object.entries(InventoryMigrationAudit.stores)){const row=document.createElement("tr");text(row,"td",label);text(row,"td",report.counts[name]===null?"含まれていません":String(report.counts[name]));table.appendChild(row);}
      for(const [category,count] of Object.entries(report.categories))text(el("result"),"p",`${category}：${count}件`);
      for(const item of report.issues)text(el("details"),"p",`${item.severity==="error"?"要確認":"注意"} / ${item.record} / ${item.category}：${item.message}`);
      if(report.omittedIssues)text(el("details"),"p",`ほか${report.omittedIssues}件。詳細表示は先頭500件です。`);
      el("share").value=JSON.stringify(InventoryMigrationAudit.shareSummary(report),null,2);
      el("download").disabled=false;
      el("message").textContent="確認が終わりました。データの移行・修正は行っていません。";
    } catch (_) { if(current===generation){clear();el("message").textContent="バックアップを確認できませんでした。在庫アプリの「全データをバックアップする」で保存したJSONを選んでください。";} }
  });
  el("download").addEventListener("click",()=>{
    if(!report)return;const blob=new Blob([JSON.stringify(report,null,2)],{type:"application/json"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download="inventory-migration-audit.json";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  });
  el("reset").addEventListener("click",()=>{generation++;clear();el("file").value="";el("message").textContent="バックアップを選択してください。";});
})();
