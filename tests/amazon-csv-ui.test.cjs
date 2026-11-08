'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
function setup(products=[],plans=[]){
 const elements=new Map();let init,printed='',pops=0,focused=0,printCalls=0,reads=0;const downloads=[];
 const elem=id=>{if(!elements.has(id))elements.set(id,{id,innerHTML:'',textContent:'',value:id==='amazon-encoding'?'auto':'',files:[],hidden:false,disabled:false,attributes:{},events:{},appendChild(){},setAttribute(k,v){this.attributes[k]=v;},addEventListener(k,v){this.events[k]=v;}});return elements.get(id);};
 const document={getElementById:elem,addEventListener(event,fn){if(event==='DOMContentLoaded')init=fn;},createElement:()=>({appendChild(){},addEventListener(){}}),querySelector:s=>elem(s),querySelectorAll:()=>[],head:{appendChild(){}}};
 const popup={document:{open(){},write(html){printed=html;},close(){},getElementById:()=>elem('print-again')},focus(){focused++;},print(){printCalls++;}};
 const window={JSZip:require('../libs/jszip-3.10.1.min.js'),scrollTo(){},alert(){},open(){pops++;return popup;}};
 const context=vm.createContext({window,document,TextDecoder,console,getAllProducts:async()=>{reads++;return typeof products==='function'?products():products;},getAllSalesPlans:async()=>plans});
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../amazon-csv-core.js'),'utf8'),context);
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../csv.js'),'utf8'),context);
 context.downloadCsvFile=(text,name)=>downloads.push({text,name});
 context.downloadFileBlob=(blob,name)=>downloads.push({blob,name});
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../amazon-pick-xlsx.js'),'utf8'),context);
 let src=fs.readFileSync(path.join(__dirname,'../amazon-csv-report.js'),'utf8').replace('  function sampleInventory() {','  window.h={state,refresh,sample,render,print,loadFile,init};\n  function sampleInventory() {');vm.runInContext(src,context);
 return {h:window.h,elem,downloads,init:()=>init(),printed:()=>printed,reads:()=>reads,pops:()=>pops,printCalls:()=>printCalls};
}
const valid={line:2,jan:'4901234567894',site:'架空配送先',qty:10,name:'<script>bad</script>',model:'<script>bad</script>',issues:[]};
test('sample report renders maximum 8 with shortage and sales-plan text in both screen and print; no database reads',async()=>{
 const s=setup();s.h.init();s.h.sample();await new Promise(r=>setImmediate(r));
 assert.equal(s.reads(),0);let html=s.elem('amazon-output').innerHTML;assert.match(html,/amazon-short">8個/);assert.match(html,/販売予定あり/);assert.match(html,/15個/);assert.match(html,/同JAN 2件：最大在庫を採用/);
 s.h.state.view='site';s.h.render();s.h.print();html=s.printed();assert.match(html,/配送先別集計/);assert.equal((html.match(/<tr class="amazon-planned">/g)||[]).length,2);assert.match(html,/全配送先必要数/);assert.match(html,/在庫不足（2個）/);assert.equal(s.printCalls(),1);
});
test('CSV and inventory strings are escaped in on-screen and printed tables; unmatched JAN is not fabricated zero',async()=>{
 const s=setup();s.h.state.rows=[valid];s.h.state.name='<img src=x onerror=bad>';
 await s.h.refresh();s.h.print();for(const html of [s.elem('amazon-output').innerHTML,s.printed()]){assert.match(html,/&lt;script&gt;/);assert.match(html,/&lt;img/);assert.doesNotMatch(html,/<script>|<img src=x/);assert.match(html,/未登録/);}
});
test('a failed refresh clears previous report and prevents stale print',async()=>{
 let fail=false;const s=setup(()=>{if(fail)throw new Error('FAKE_READ_ERROR');return [];});s.h.state.rows=[valid];await s.h.refresh();assert.equal(s.elem('amazon-print').disabled,false);
 fail=true;await s.h.refresh();assert.equal(s.elem('amazon-output').innerHTML,'');assert.equal(s.elem('amazon-print').disabled,true);s.h.print();assert.equal(s.pops(),0);assert.match(s.elem('amazon-status').textContent,/FAKE_READ_ERROR/);
});
test('an older delayed stock read cannot overwrite a newer sample snapshot',async()=>{
 let resolve;const s=setup(()=>new Promise(r=>resolve=r));s.h.state.rows=[valid];const old=s.h.refresh();s.h.sample();await new Promise(r=>setImmediate(r));resolve([{janCode:valid.jan,stock:999}]);await old;
 assert.equal(s.h.state.sample,true);assert.match(s.elem('amazon-output').innerHTML,/amazon-short">8個/);assert.doesNotMatch(s.elem('amazon-output').innerHTML,/999個/);
});
test('malformed file clears prior results and disables printing; CSV import does not retain old totals',async()=>{
 const s=setup();s.h.sample();await new Promise(r=>setImmediate(r));
 s.elem('amazon-file').files=[{name:'bad.csv',size:20,arrayBuffer:async()=>new TextEncoder().encode('a,b,c\n1,2,3').buffer}];await s.h.loadFile();
 assert.equal(s.h.state.result,null);assert.equal(s.elem('amazon-output').innerHTML,'');assert.equal(s.elem('amazon-print').disabled,true);assert.match(s.elem('amazon-status').textContent,/列を確認/);
});
test('one destination prints only its own demand while shortage still uses global demand; product view remains global',async()=>{
 const s=setup();s.h.init();s.h.sample();await new Promise(r=>setImmediate(r));
 s.h.state.view='site';s.h.render();const index=s.h.state.result.sites.findIndex(g=>g.site==='架空配送先・西');
 s.elem('amazon-destination').value=String(index);s.elem('amazon-destination').events.change();s.h.print();
 let html=s.printed();assert.match(html,/表示・印刷対象：架空配送先・西.*合計 4個/);assert.doesNotMatch(html,/架空配送先・東/);assert.match(html,/在庫不足（2個）/);assert.match(html,/amazon-short">8個/);
 assert.equal((html.match(/<tr class="amazon-planned">/g)||[]).length,1);
 s.h.state.view='product';s.h.render();html=s.elem('amazon-output').innerHTML;assert.match(html,/>10<\/td>/);assert.match(html,/DEMO-CODE-B/);assert.equal(s.elem('amazon-destination-controls').hidden,true);
 s.h.state.view='site';s.h.render();assert.equal(s.elem('amazon-destination').value,String(index));
 s.elem('amazon-destination').value='';s.elem('amazon-destination').events.change();assert.match(s.elem('amazon-output').innerHTML,/架空配送先・東/);assert.match(s.elem('amazon-output').innerHTML,/すべての配送先.*合計 15個/);
});
test('selected destination filters uncertain JAN rows and partial totals too, and escapes destination names',async()=>{
 const site='<img src=x onerror=bad>';
 const s=setup();s.h.state.rows=[{...valid,site,qty:7,issues:['要確認']},{...valid,site:'別の配送先',qty:999,issues:['要確認']},{...valid,site,qty:null,issues:['数量不明']}];
 s.h.state.view='site';await s.h.refresh();s.h.state.destination=site;s.h.render();s.h.print();
 for(const html of [s.elem('amazon-output').innerHTML,s.printed()]){assert.match(html,/表示・印刷対象：&lt;img/);assert.match(html,/要確認：2行/);assert.match(html,/数量不明1行/);assert.match(html,/合計 7個/);assert.doesNotMatch(html,/<img src=x|別の配送先/);}
 assert.match(s.elem('amazon-destination').innerHTML,/&lt;img/);
});
test('refresh retains an existing destination and resets a destination absent from replacement CSV',async()=>{
 const s=setup();s.h.sample();await new Promise(r=>setImmediate(r));s.h.state.view='site';s.h.state.destination='架空配送先・西';await s.h.refresh();assert.equal(s.h.state.destination,'架空配送先・西');
 s.h.state.sample=false;s.h.state.rows=[valid];await s.h.refresh();assert.equal(s.h.state.destination,null);assert.match(s.elem('amazon-output').innerHTML,/すべての配送先/);
});


const pickHeader = 'PO,配送センター,ASIN,製品コード,製品コードの種類,モデル番号,商品名,入荷待ち,受領待ちのケース';
const pickLine = 'DEMO-PO1,架空配送先,DEMO-ASIN,01234565,JAN,,架空商品,,3';
test('picking count and maximum stock are adjacent in screen, print, CSV and numeric Excel cells',async()=>{
 for(const stocks of [[2,12],[12,12],[0,0]]) {
  const s=setup(stocks.map(stock=>({janCode:'01234565',productCode:'CODE',stock})));s.h.init();
  await loadPick(s,[pickHeader,pickLine].join('\n'));
  s.elem('amazon-pick-print').events.click();s.elem('amazon-pick-download').events.click();
  const expected=Math.max(...stocks);
  for(const html of [s.elem('amazon-pick-output').innerHTML,s.printed()]) {
   assert.match(html,/<th>ピッキング数<\/th><th>在庫数<\/th>/);
   assert.ok(html.includes(`<td>3</td><td>${expected}</td>`));
   assert.doesNotMatch(html,/<th>受領待ちのケース<\/th>/);
  }
  assert.ok(s.downloads[0].text.includes(`"CODE","3","${expected}","",""`));
  await s.elem('amazon-pick-excel').events.click();
  const zip=await require('../libs/jszip-3.10.1.min.js').loadAsync(await s.downloads[1].blob.arrayBuffer());
  const xml=await zip.file('xl/worksheets/sheet1.xml').async('string');
  assert.match(xml,/<c r="E2"><v>3<\/v>/);assert.ok(xml.includes(`<c r="F2"><v>${expected}</v></c>`));
 }
});
test('picking print uses A4 portrait with eight fixed columns, preparation retains landscape',async()=>{
 const s=setup();s.h.init();await loadPick(s,[pickHeader,pickLine].join('\n'));
 s.elem('amazon-pick-print').events.click();
 const html=s.printed();assert.match(html,/@page \{ size:A4 portrait; margin:12mm; \}/);
 assert.ok(html.lastIndexOf('A4 portrait')>html.indexOf('A4 landscape'));
 assert.match(html,/table-layout:fixed/);assert.match(html,/overflow-wrap:anywhere/);
 assert.equal((html.match(/<th>/g)||[]).length,8);
 s.h.sample();await new Promise(r=>setImmediate(r));s.h.print();
 assert.match(s.printed(),/A4 landscape/);assert.doesNotMatch(s.printed(),/A4 portrait/);
});
test('PickList groups interleaved destinations without merging PO lines; exports keep all quantities',async()=>{
 const s=setup();s.h.init();
 await loadPick(s,[pickHeader,
  pickLine.replace('架空配送先','ABC1 - 架空市'),
  pickLine.replace('架空配送先','XYZ2 - 架空市').replace('PO1','PO2'),
  pickLine.replace('架空配送先','ABC1 - 架空市').replace('PO1','PO3')].join('\n'));
 s.elem('amazon-pick-print').events.click();
 for(const html of [s.elem('amazon-pick-output').innerHTML,s.printed()]) {
  assert.equal((html.match(/<table class="amazon-table">/g)||[]).length,2);
  assert.match(html,/ABC1 ／ 2明細 ／ 6ケース/);assert.match(html,/XYZ2 ／ 1明細 ／ 3ケース/);
  assert.match(html,/3明細 ／ 9ケース/);
  assert.ok(html.indexOf('DEMO-PO3')<html.indexOf('DEMO-PO2'));
 }
 s.elem('amazon-pick-download').events.click();
 const csv=s.downloads[0].text;
 assert.ok(csv.indexOf('DEMO-PO3')<csv.indexOf('DEMO-PO2'));
 await s.elem('amazon-pick-excel').events.click();
 const zip=await require('../libs/jszip-3.10.1.min.js').loadAsync(await s.downloads[1].blob.arrayBuffer());
 const xml=await zip.file('xl/worksheets/sheet1.xml').async('string');
 assert.match(xml,/<row r="4"><c r="A4" t="inlineStr"><is><t xml:space="preserve"><\/t>/);
 assert.match(xml,/<c r="A5" t="inlineStr"><is><t xml:space="preserve">DEMO-PO2/);
 assert.equal((xml.match(/<v>3<\/v>/g)||[]).length,3);
});
async function loadPick(s, text, name='DemoPickList.csv') {
 const buffer = new TextEncoder().encode(text).buffer;
 s.elem('amazon-pick-file').files=[{name,size:buffer.byteLength,arrayBuffer:async()=>buffer}];
 await s.elem('amazon-pick-file').events.change();
}
test('PickList keeps PO lines separate, and filters printing and export by destination',async()=>{
 const s=setup();s.h.init();
 await loadPick(s,[pickHeader,pickLine,pickLine.replace('PO1','PO2'),pickLine.replace('架空配送先','別の配送先')].join('\n'));
 assert.match(s.elem('amazon-pick-status').textContent,/3明細・9ケース/);
 s.elem('amazon-pick-site').value='架空配送先';
 s.elem('amazon-pick-site').events.change();
 s.elem('amazon-pick-print').events.click();
 assert.match(s.printed(),/2明細 ／ 6ケース/);
 assert.doesNotMatch(s.printed(),/別の配送先/);
 s.elem('amazon-pick-download').events.click();
 const [{text,name}]=s.downloads;
 assert.match(name,/^Amazonピッキング・パッキング用_.*\.csv$/);
 assert.match(text,/"ピッキング数","在庫数","ピッキング確認","パッキング確認"/);
 assert.match(text,/"DEMO-PO1","架空配送先","01234565","要確認（商品コードなし）","3","未登録","",""/);
 assert.match(text,/"DEMO-PO2"/);
 assert.doesNotMatch(text,/別の配送先|ASIN|モデル番号/);
 assert.equal(s.reads(),1);
});
test('a replacement with preparation headers or damaged JAN clears the PickList output',async()=>{
 const s=setup();s.h.init();
 await loadPick(s,[pickHeader,pickLine].join('\n'));
 for(const text of [
   [pickHeader.replace('受領待ちのケース','依頼数量'),pickLine].join('\n'),
   [pickHeader,pickLine.replace('01234565','1.234E+7')].join('\n')
 ]) {
   await loadPick(s,text);
   assert.equal(s.elem('amazon-pick-output').innerHTML,'');
   assert.equal(s.elem('amazon-pick-print').disabled,true);
   assert.equal(s.elem('amazon-pick-download').disabled,true);
   assert.equal(s.elem('amazon-pick-excel').disabled,true);
   assert.match(s.elem('amazon-pick-status').textContent,/読み込めません/);
 }
});

test('PickList Excel export keeps numeric identifiers as literal strings and cases as numbers',async()=>{
 const s=setup([{janCode:'01234565',productCode:'=架空&コード'}]);s.h.init();
 await loadPick(s,[pickHeader,pickLine.replace('JAN,,架空商品','JAN,0000000000123,=架空&商品'),pickLine.replace('架空配送先','別の配送先')].join('\n'));
 s.elem('amazon-pick-site').value='架空配送先';
 s.elem('amazon-pick-site').events.change();
 await s.elem('amazon-pick-excel').events.click();
 const [{blob,name}]=s.downloads;
 assert.match(name,/^Amazonピッキング・パッキング用_.*\.xlsx$/);
 const JSZip=require('../libs/jszip-3.10.1.min.js');
 const zip=await JSZip.loadAsync(await blob.arrayBuffer());
 const sheet=await zip.file('xl/worksheets/sheet1.xml').async('string');
 assert.match(sheet,/<c r="C2" t="inlineStr"><is><t xml:space="preserve">01234565<\/t>/);
 assert.doesNotMatch(sheet,/ASIN|モデル番号|DEMO-ASIN|0000000000123/);
 assert.match(sheet,/<c r="E2"><v>3<\/v>/);
 assert.match(sheet,/>=架空&amp;コード<\/t>/);
 assert.doesNotMatch(sheet,/<f[ >]|別の配送先|<row r="3">/);
});

test('JAN-matched product code replaces long product name in screen, print and CSV',async()=>{
 const s=setup([{janCode:'01234565',productCode:'DEMO-CODE<&>'}]);s.h.init();
 await loadPick(s,[pickHeader,pickLine].join('\n'));
 s.elem('amazon-pick-print').events.click();s.elem('amazon-pick-download').events.click();
 for(const html of [s.elem('amazon-pick-output').innerHTML,s.printed()]){
  assert.match(html,/商品コード/);assert.match(html,/DEMO-CODE&lt;&amp;&gt;/);assert.doesNotMatch(html,/架空商品|<th>ASIN<\/th>|<th>モデル番号<\/th>|DEMO-ASIN/);
 }
 assert.match(s.downloads[0].text,/DEMO-CODE<&>/);
});
test('stale master lookup cannot overwrite a replacement file, and failed lookup leaves exports disabled',async()=>{
 let resolve,fail=false;const s=setup(()=>fail?Promise.reject(new Error('MASTER_FAIL')):new Promise(r=>resolve=r));s.h.init();
 const old=loadPick(s,[pickHeader,pickLine].join('\n'));await new Promise(r=>setImmediate(r));
 fail=true;await loadPick(s,[pickHeader,pickLine.replace('PO1','PO2')].join('\n'));
 resolve([{janCode:'01234565',productCode:'STALE'}]);await old;
 assert.equal(s.elem('amazon-pick-output').innerHTML,'');assert.equal(s.elem('amazon-pick-excel').disabled,true);
 assert.match(s.elem('amazon-pick-status').textContent,/MASTER_FAIL/);
});

test('preparation product and destination reports use master product codes in screen and print',async()=>{
 const s=setup([{janCode:valid.jan,productCode:'DEMO-PREP<&>',internalCode:'DEMO-INTERNAL',stock:15}]);
 s.h.init();s.h.state.rows=[{...valid,name:'LONG-NAME-OMIT',model:'MODEL-FALLBACK',qty:4}];await s.h.refresh();
 for(const view of ['product','site']){
  s.h.state.view=view;s.h.render();s.h.print();
  for(const html of [s.elem('amazon-output').innerHTML,s.printed()]){
   assert.match(html,/商品コード ／ 社内コード/);assert.match(html,/DEMO-PREP&lt;&amp;&gt;/);
   assert.doesNotMatch(html,/LONG-NAME-OMIT|MODEL-FALLBACK/);assert.match(html,/15個/);
  }
 }
});

test('PickList site codes are short in screen, print, CSV and Excel while filtering retains exact destination',async()=>{
 const s=setup();s.h.init();
 await loadPick(s,[pickHeader,pickLine.replace('架空配送先','ABC1 - 架空市'),pickLine.replace('架空配送先','XYZ2 - 別の架空市')].join('\n'));
 assert.match(s.elem('amazon-pick-site').innerHTML,/value="ABC1 - 架空市">ABC1<\/option>/);
 s.elem('amazon-pick-site').value='ABC1 - 架空市';s.elem('amazon-pick-site').events.change();
 s.elem('amazon-pick-print').events.click();s.elem('amazon-pick-download').events.click();
 for(const html of [s.elem('amazon-pick-output').innerHTML,s.printed()]){
  assert.match(html,/ABC1/);assert.match(html,/1明細 ／ 3ケース/);assert.doesNotMatch(html,/架空市|XYZ2/);
 }
 assert.match(s.downloads[0].text,/"ABC1"/);assert.doesNotMatch(s.downloads[0].text,/架空市|XYZ2/);
 await s.elem('amazon-pick-excel').events.click();
 const zip=await require('../libs/jszip-3.10.1.min.js').loadAsync(await s.downloads[1].blob.arrayBuffer());
 const xml=await zip.file('xl/worksheets/sheet1.xml').async('string');
 assert.match(xml,/>ABC1<\/t>/);assert.doesNotMatch(xml,/架空市|XYZ2/);
});

test('preparation shortens destination labels and print, preserving original grouping and issue filtering',async()=>{
 const s=setup();s.h.init();
 s.h.state.rows=[{...valid,site:'ABC1 - 架空市',qty:4},{...valid,site:'XYZ2 - 別の架空市',qty:3},
  {...valid,line:4,site:'ABC1 - 架空市',qty:2,issues:['架空の確認事項']}];
 await s.h.refresh();s.h.state.view='site';s.h.render();
 assert.match(s.elem('amazon-destination').innerHTML,/>ABC1<\/option>/);
 const index=s.h.state.result.sites.findIndex(g=>g.site==='ABC1 - 架空市');
 s.elem('amazon-destination').value=String(index);s.elem('amazon-destination').events.change();s.h.print();
 for(const html of [s.elem('amazon-output').innerHTML,s.printed()]){
  assert.match(html,/表示・印刷対象：ABC1.*合計 6個/);assert.match(html,/架空の確認事項/);
  assert.doesNotMatch(html,/架空市|XYZ2/);
 }
 assert.equal(s.h.state.destination,'ABC1 - 架空市');assert.equal(s.h.state.result.total,9);
});
