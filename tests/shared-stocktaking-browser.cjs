'use strict';
// Actual full app, two isolated browsers, fictional in-memory API. No live requests.
const assert=require('node:assert/strict');
const fs=require('node:fs');const path=require('node:path');const http=require('node:http');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const id='12345678-1234-4234-8234-123456789012';
const records=new Map();const receipts=new Map();let lost=false;const posts=[];
const item=()=>({stocktaking_id:id,internal_code:'FAKE-001',product_code:'FAKE-P001',product_name:'架空棚卸テスト',jan_code:'4980000000000',registered_stock:10,counted_stock:null,memo:'',version:0,counted_by:null});
const fixture=()=>({session:{id,stocktaking_date:'2026-11-09',location_name:'架空倉庫',status:'draft',operator_name:'架空担当'},items:[item()]});
const format='inventory-shared-stocktaking-v1';
const server=http.createServer((req,res)=>{
 let pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
 const file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
 if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return;}
 res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':file.endsWith('.html')?'text/html':'application/octet-stream');
 res.end(fs.readFileSync(file));
});
async function main(){
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base=`http://127.0.0.1:${server.address().port}`;
 const browser=await chromium.launch({headless:true});
 try{
  async function page(role,width){
   const context=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block'});
   await context.addInitScript(({role})=>{
    localStorage.setItem('barcodeInventoryRoleMode',role);
    localStorage.setItem('barcodeInventoryWorkspace','shared');
    sessionStorage.setItem('barcodeInventoryServerAccessToken','FAKE-TOKEN');
    sessionStorage.setItem('barcodeInventoryServerAccessExpiresAt',String(Date.now()+3600000));
    sessionStorage.setItem('barcodeInventoryServerUser',JSON.stringify({username:'fake-worker',display_name:'架空担当',role}));
   },{role});
   const p=await context.newPage();
   p.on('dialog',async d=>d.accept());
   await p.route('**/*',async route=>{
    const req=route.request(),url=new URL(req.url());
    if(url.origin===base){await route.continue();return;}
    if(url.pathname.endsWith('/shared-stocktaking-auth.php')){
     const json=async(data,status=200)=>route.fulfill({status,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:JSON.stringify(data)});
     if(req.method()==='OPTIONS'){await route.fulfill({status:204,headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'GET, POST, OPTIONS'}});return;}
     if(req.method()==='GET'){
      if(url.searchParams.has('id')){await json({success:true,format,...structuredClone(records.get(id)||fixture())});return;}
      await json({success:true,format,locations:['架空倉庫'],sessions:records.size?[{...records.get(id).session,item_count:1,checked_count:records.get(id).items[0].counted_stock===null?0:1}]:[]});return;
     }
     const body=req.postDataJSON();posts.push(body);
     if(receipts.has(body.request_id)){await json(receipts.get(body.request_id));return;}
     if(body.action==='start'){
      const d=fixture();d.session.id=body.request_id;d.items[0].stocktaking_id=body.request_id;
      // The fixed fixture ID is used when opening on both devices.
      records.set(id,d);const r={success:true,request_id:body.request_id,stocktaking_id:body.request_id,item_count:1};receipts.set(body.request_id,r);await json(r);return;
     }
     const i=records.get(id).items[0];
     if(body.expected_version!==i.version){await json({success:false,message:'他の端末でこの商品が更新されました。再読み込みして数量を確認してください。'},409);return;}
     Object.assign(i,{counted_stock:body.counted_stock,memo:body.memo,counted_by:'架空担当',version:i.version+1});
     const r={success:true,request_id:body.request_id,stocktaking_id:body.stocktaking_id,internal_code:i.internal_code,counted_stock:i.counted_stock,memo:i.memo,counted_by:i.counted_by,version:i.version};receipts.set(body.request_id,r);
     if(lost){lost=false;await route.abort();return;}await json(r);return;
    }
    // No real API, external asset or inventory mutation can leave this fixture.
    await route.fulfill({status:503,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:'{"success":false,"message":"架空テスト：このAPIは使用しません"}'});
   });
   await p.goto(base);await p.waitForSelector(width<901?'.mobile-home-stocktaking-button':'#show-shared-stocktaking-button',{state:'visible'});
   // Force deterministic operation IDs without changing product data.
   await p.evaluate(id=>{crypto.randomUUID=()=>id;},id);
   return p;
  }
  const a=await page('worker',390);
  await a.click('.mobile-home-stocktaking-button');
  await a.waitForSelector('[data-location]:not(:disabled)');
  await a.selectOption('[data-location]','架空倉庫');
  await a.click('[data-start] button');
  await a.waitForSelector('[data-items] article');
  assert.match(await a.locator('[data-summary]').innerText(),/未確認 1件/);
  const b=await page('admin',1280);
  await b.click('#show-shared-stocktaking-button');
  await b.locator('[data-sessions] button').click();await b.waitForSelector('[data-items] article');
  await a.evaluate(()=>{crypto.randomUUID=()=> '12345678-1234-4234-8234-123456789013';});
  await a.locator('[data-items] input').fill('0');
  await a.locator('[data-items] textarea').fill('架空ゼロ確認');
  await a.locator('[data-items] button').click();
  await a.waitForFunction(()=>document.querySelector('[data-message]').textContent.includes('数量を共有サーバーに保存'));
  assert.match(await a.locator('[data-summary]').innerText(),/確認済み 1件/);
  await b.evaluate(()=>{crypto.randomUUID=()=> '12345678-1234-4234-8234-123456789014';});
  await b.locator('[data-items] input').fill('8');await b.locator('[data-items] button').click();
  await b.waitForFunction(()=>document.querySelector('[data-message]').textContent.includes('他の端末'));
  assert.equal(records.get(id).items[0].counted_stock,0);
  await b.click('[data-reload]');
  await b.waitForFunction(()=>document.querySelector('[data-items] input')?.value==='0');
  assert.match(await b.locator('[data-items]').innerText(),/差異：-10個/);
  lost=true;
  await b.evaluate(()=>{crypto.randomUUID=()=> '12345678-1234-4234-8234-123456789015';});
  await b.locator('[data-items] input').fill('4');await b.locator('[data-items] button').click();
  await b.waitForSelector('[data-retry]',{state:'visible'});
  assert.equal(await b.locator('[data-items] button').isDisabled(),true);
  await b.click('[data-retry]');await b.waitForSelector('[data-retry]',{state:'hidden'});
  assert.equal(records.get(id).items[0].version,2);
  assert.equal(posts.at(-1).request_id,posts.at(-2).request_id);
  // Three positive saves were attempted: zero, rejected stale version, and 4+retry.
  assert.equal(posts.filter(p=>p.action==='save').length,4);
  await a.locator('[data-search]').fill('NOT-FOUND');
  assert.equal(await a.locator('[data-items] article').count(),0);
  await a.locator('[data-search]').fill('FAKE-P001');
  assert.equal(await a.locator('[data-items] article').count(),1);
  assert.equal(await a.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'Mobile horizontal overflow');
  await a.evaluate(()=>{window.inventoryServerSearch.logout();});
  assert.equal(await a.locator('[data-items] article').count(),0);
  console.log('PASS full app: worker/admin button, mobile 390px, start, resume on another device, zero, conflict, retry, search, logout, external requests blocked');
 }finally{await browser.close();server.close();}
}
main().catch(e=>{console.error(e);server.close();process.exitCode=1;});
