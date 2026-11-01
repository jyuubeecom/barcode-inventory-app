'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
function setup(products=[],plans=[]){
 const elements=new Map();let init,printed='',pops=0,focused=0,printCalls=0,reads=0;
 const elem=id=>{if(!elements.has(id))elements.set(id,{id,innerHTML:'',textContent:'',value:id==='amazon-encoding'?'auto':'',files:[],hidden:false,disabled:false,attributes:{},events:{},appendChild(){},setAttribute(k,v){this.attributes[k]=v;},addEventListener(k,v){this.events[k]=v;}});return elements.get(id);};
 const document={getElementById:elem,addEventListener(event,fn){if(event==='DOMContentLoaded')init=fn;},createElement:()=>({appendChild(){},addEventListener(){}}),querySelector:s=>elem(s),querySelectorAll:()=>[],head:{appendChild(){}}};
 const popup={document:{open(){},write(html){printed=html;},close(){},getElementById:()=>elem('print-again')},focus(){focused++;},print(){printCalls++;}};
 const window={scrollTo(){},alert(){},open(){pops++;return popup;}};
 const context=vm.createContext({window,document,TextDecoder,console,getAllProducts:async()=>{reads++;return typeof products==='function'?products():products;},getAllSalesPlans:async()=>plans});
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../amazon-csv-core.js'),'utf8'),context);
 let src=fs.readFileSync(path.join(__dirname,'../amazon-csv-report.js'),'utf8').replace('  function sampleInventory() {','  window.h={state,refresh,sample,render,print,loadFile,init};\n  function sampleInventory() {');vm.runInContext(src,context);
 return {h:window.h,elem,init:()=>init(),printed:()=>printed,reads:()=>reads,pops:()=>pops,printCalls:()=>printCalls};
}
const valid={line:2,jan:'4901234567894',site:'架空配送先',qty:10,name:'<script>bad</script>',issues:[]};
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
 s.h.state.view='product';s.h.render();html=s.elem('amazon-output').innerHTML;assert.match(html,/>10<\/td>/);assert.match(html,/架空商品B/);assert.equal(s.elem('amazon-destination-controls').hidden,true);
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
