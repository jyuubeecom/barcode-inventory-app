"use strict";
(function(root){
  const auditApi = typeof module!=='undefined' && module.exports ? require('./backup-audit.js') : root.InventoryMigrationAudit;
  function prepareProducts(raw) {
    const audit = auditApi.auditBackup(raw);
    if(audit.errorCount) throw new Error('バックアップのエラーを確認してください。今回の照合は送信しません。');
    const optional = {productCode:'product_code',janCode:'jan_code',color:'color',category:'category',supplierName:'supplier_name',unit:'unit'};
    const products = raw.data.products.map((product,index)=>{
      const item={internal_code:product.internalCode,product_name:product.productName};
      for(const [from,to] of Object.entries(optional)) {
        const value=product[from] ?? '';
        if(typeof value!=='string')throw new Error(`商品${index+1}件目の${from}の形式を確認してください。`);
        item[to]=value;
      }
      const memo=product.memo ?? '';
      if(typeof memo!=='string' || Array.from(memo).length>10000 || memo.includes('\0'))throw new Error(`商品${index+1}件目のメモを確認してください。`);
      item.memo=memo;
      const min=product.minStock ?? 0;
      if((typeof min!=='number' && !(typeof min==='string' && /^(0|[1-9]\d*)$/.test(min))) || !Number.isSafeInteger(Number(min)) || Number(min)<0 || Number(min)>1000000000)throw new Error(`商品${index+1}件目の最低在庫を確認してください。`);
      item.min_stock=Number(min);
      const state=product.productStatus || '通常商品';
      item.product_status=state==='通常'?'通常商品':state;
      if(!['通常商品','廃盤','廃盤予定','専用商品','注残'].includes(item.product_status))throw new Error(`商品${index+1}件目の商品状態を確認してください。`);
      const stocks=product.locationStocks;
      if(!Array.isArray(stocks) || !stocks.length){
        if(Number(product.stock)!==0)throw new Error(`商品${index+1}件目の場所別在庫を確認してください。`);
        item.stocks=[];
      }else{
        item.stocks=stocks.map(s=>({location_name:s.location,quantity:Number(s.stock)}));
        if(item.stocks.length>300)throw new Error('場所別在庫は1商品300行までです。');
        if(item.stocks.some(s=>s.location_name!==s.location_name.trim() || !s.location_name))throw new Error('保管場所の表記を確認してください。');
      }
      return item;
    });
    if(products.length>1000)throw new Error('この照合は1000商品までです。');
    return {audit,payload:{action:'preview',products}};
  }
  const api={prepareProducts};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.InventoryMigrationProducts=api;
})(globalThis);
