'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
require('../amazon-csv-core.js');
const c=globalThis.inventoryAmazonCsv;
const A='4901234567894',B='4901234567900',C='01234565';
const h=['PO','取引業者コード','配送センター','ASIN','製品コード','製品コードの種類','モデル番号','商品名','在庫状況','ウィンドウの種類','指定時間帯の始まり','ウィンドウ終了日','予定日','依頼数量'];
const quote=s=>'"'+String(s).replace(/"/g,'""')+'"';
const csv=(rows)=>'\uFEFF'+[h,...rows.map(r=>['x','x',r[0],'',r[1],'JAN',r[4]||'MODEL',r[3]||'架空商品','','','','','',r[2]])].map(r=>r.map(quote).join(',')).join('\r\n');
const build=(rows,products=[],plans=[])=>c.aggregate(c.read(csv(rows)),products,plans);
test('C/E/N are read as site/JAN/quantity; quoted commas, newlines and BOM survive',()=>{
 const rows=c.read(csv([['架空,東',A,'1,234','架空"商品\n名称']]));assert.equal(rows[0].qty,1234);assert.equal(rows[0].site,'架空,東');assert.equal(rows[0].name,'架空"商品\n名称');assert.equal(rows[0].jan,A);
 assert.equal(c.janIssue(C),'');assert.equal(c.read(csv([['東',C,2]]))[0].jan,C);
});
test('product demand sums across sites and site detail reconciles without allocating the stock twice',()=>{
 const r=build([['東',A,6],['西',A,4],['東',A,2],['東',B,5]], [{janCode:A,stock:9,internalCode:'A'}]);
 assert.equal(r.total,17);assert.equal(r.eligible,17);assert.equal(r.items.length,2);assert.equal(r.items[0].qty,12);
 assert.deepEqual(r.sites.map(s=>[s.site,s.qty]),[['西',4],['東',13]]);
 for(const g of r.sites) for(const i of g.items.filter(i=>i.jan===A)){assert.equal(i.stock,9);assert.equal(i.qty,12);assert.equal(i.shortage,true);}
});
test('duplicate inventory uses largest product total, not summed duplicates or location quantities; sales plan on other duplicate highlights',()=>{
 const products=[{janCode:A,stock:2,internalCode:'LOW',locationStocks:[{location:'東',stock:999}]},{janCode:A,stock:8,internalCode:'HIGH',productName:'最大在庫の商品'}];const plans=[{internalCode:'LOW',quantity:5}];
 const before=JSON.stringify([products,plans]);const i=build([['東',A,10]],products,plans).items[0];
 assert.equal(i.stock,8);assert.equal(i.internalCode,'HIGH');assert.equal(i.duplicates,2);assert.equal(i.planned,true);assert.equal(i.shortage,true);assert.equal(JSON.stringify([products,plans]),before);
});
test('missing JAN match, unknown inventory and zero stock remain distinct',()=>{
 const p=[{janCode:A,stock:0,internalCode:'ZERO'}];let r=build([['東',A,1],['東',B,1]],p);
 assert.equal(r.items[0].stock,0);assert.equal(r.items[0].shortage,true);assert.equal(r.items[1].stock,null);assert.equal(r.items[1].matched,false);
 r=build([['東',A,1]],[...p,{janCode:A,stock:'unknown'}]);assert.equal(r.items[0].stock,null);assert.equal(r.items[0].matched,true);
});
test('scientific and suspicious zero-tail JANs never combine distinct products; quantities still reconcile by site',()=>{
 const r=build([['東','4.90123E+12',6,'架空A','A'],['東','4901230000000',3,'架空B','B'],['西','4901230000000',4,'架空C','C']]);
 assert.equal(r.total,13);assert.equal(r.items.length,0);assert.equal(r.issues.length,3);assert.equal(r.excluded,13);assert.equal(r.sites.length,2);assert.equal(r.sites.reduce((n,s)=>n+s.qty,0),13);
});
test('wrong check digit, blank site and malformed quantity are clearly excluded and unknown totals counted',()=>{
 const r=build([['東',A,-1],['東',A,'1.5'],['東',A,''],['',A,4],['東','4901234567890',2],['東',A,3]]);
 assert.equal(r.total,9);assert.equal(r.eligible,3);assert.equal(r.excluded,6);assert.equal(r.invalidQuantityRows,3);assert.equal(r.issues.length,5);
 for(const bad of ['1e3','+2','12,34','NaN','Infinity','9007199254740992'])assert.equal(c.quantity(bad),null);
});
test('wrong headers, short rows, malformed quotes and oversized input fail before producing a report',()=>{
 assert.throws(()=>c.read('A,B,C\n1,2,3'));assert.throws(()=>c.read(h.join(',')+'\n1,2,3'));
 for(const text of ['a,"x','a,"x"oops','a,b"c'])assert.throws(()=>c.parseCsv(text));
 assert.throws(()=>c.parseCsv('a'.repeat(10*1024*1024+1)));assert.throws(()=>build([['東',A,Number.MAX_SAFE_INTEGER],['東',A,1]]));
});
test('same CSV imported twice replaces caller snapshot; pure aggregation does not accumulate or mutate rows',()=>{
 const rows=c.read(csv([['東',A,5]]));const before=JSON.stringify(rows);
 assert.equal(c.aggregate(rows,[],[]).total,5);assert.equal(c.aggregate(rows,[],[]).total,5);assert.equal(JSON.stringify(rows),before);
});

test('PickList codes prefer JAN-matched master, retain codes as strings, and never mutate source',()=>{
 const rows=[{jan:C,model:'AMZ-MODEL',name:'Long Amazon name'}];
 const result=c.resolvePickCodes(rows,[{janCode:C,productCode:'0000123'},{janCode:C,productCode:'0000123'}]);
 assert.equal(result[0].productCode,'0000123');assert.equal(result[0].codeIssue,'');
 assert.equal(rows[0].productCode,undefined);
});
test('PickList ambiguous master codes require review; numeric or absent models never masquerade as codes',()=>{
 const row={jan:C,model:'MODEL-1'};
 assert.match(c.resolvePickCodes([row],[{janCode:C,productCode:'A'},{janCode:C,productCode:'B'}])[0].productCode,/複数/);
 assert.equal(c.resolvePickCodes([row],[])[0].productCode,'MODEL-1');
 for(const model of ['',C,'4986012012216','4.986E+12'])assert.match(c.resolvePickCodes([{...row,model}],[])[0].productCode,/商品コードなし/);
 assert.equal(c.resolvePickCodes([row],[{janCode:A,productCode:'WRONG'}])[0].productCode,'MODEL-1');
});

test('preparation codes share JAN resolution and conflicting fallback models are not silently merged',()=>{
 const rows=c.read(csv([['West',A,2],['East',A,3]]));
 const master=c.aggregate(rows,[{janCode:A,productCode:'DEMO-PREP',stock:10}],[]);
 assert.equal(master.items[0].productCode,'DEMO-PREP');assert.equal(master.sites[0].items[0].productCode,'DEMO-PREP');
 assert.equal(master.total,5);assert.equal(master.items[0].stock,10);
 rows[0].model='MODEL-A';rows[1].model='MODEL-B';
 assert.match(c.aggregate(rows,[],[]).items[0].productCode,/複数/);
 rows[0].issues=['test issue'];
 assert.equal(c.aggregate(rows,[],[]).issues[0].productCode,'MODEL-A');
});

test('PickList site labels shorten only a recognized four-character prefix',()=>{
 assert.equal(c.pickSiteLabel('ABC1 - 架空市'),'ABC1');
 assert.equal(c.pickSiteLabel('XYZ2'),'XYZ2');
 assert.equal(c.pickSiteLabel('AB123 - 架空市'),'AB123 - 架空市');
 assert.equal(c.pickSiteLabel('架空配送先'),'架空配送先');
});
test('picking stock shows maximum duplicate quantity, tied quantity once, zero and unknown distinctly',()=>{
 const rows=[{jan:C,model:'MODEL'}];
 for(const [stocks,expected] of [[[2,12],12],[[12,12],12],[[0,0],0],[[2,'12'],12],[[2,undefined],null],[[2,-1],null]]) {
  const products=stocks.map(stock=>({janCode:C,productCode:'CODE',stock}));
  const before=JSON.stringify(products);
  const result=c.resolvePickCodes(rows,products)[0];
  assert.equal(result.stock,expected);assert.equal(result.stockMatched,true);
  assert.equal(JSON.stringify(products),before);
 }
 const missing=c.resolvePickCodes(rows,[])[0];assert.equal(missing.stock,null);assert.equal(missing.stockMatched,false);
 assert.equal(rows[0].stock,undefined);
});
test('duplicate JAN product codes use the greatest stock regardless of master order, without mutation',()=>{
 const rows=[{jan:C,model:'FALLBACK'}];
 const products=[{janCode:C,productCode:'LOW',stock:2},{janCode:C,productCode:'HIGH',stock:'12'}];
 const before=JSON.stringify(products);
 for(const master of [products,[...products].reverse()]) {
  assert.equal(c.resolvePickCodes(rows,master)[0].productCode,'HIGH');
  const prepared=c.aggregate([{...rows[0],site:'DEMO',qty:3,issues:[]}],master,[]);
  assert.equal(prepared.items[0].productCode,'HIGH');assert.equal(prepared.items[0].stock,12);
 }
 assert.equal(JSON.stringify(products),before);assert.equal(rows[0].productCode,undefined);
});
test('maximum-stock code ties and unknown stocks require review, but equal winners with one code resolve',()=>{
 const row={jan:C,model:'FALLBACK'};
 for(const stock of [5,undefined,'bad',-1,1.5]) {
  const master=[{janCode:C,productCode:'A',stock:5},{janCode:C,productCode:'B',stock}];
  assert.match(c.resolvePickCodes([row],master)[0].productCode,/要確認/);
 }
 const master=[{janCode:C,productCode:'A',stock:0},{janCode:C,productCode:'B',stock:5},{janCode:C,productCode:'B',stock:5}];
 assert.equal(c.resolvePickCodes([row],master)[0].productCode,'B');
});
