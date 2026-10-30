<?php
declare(strict_types=1);
require_once __DIR__.'/../server/migration-preview-service.php';
$pdo = new PDO(getenv('STOCK_CSV_TEST_DSN') ?: 'mysql:host=127.0.0.1;dbname=inventory_csv_test;charset=utf8mb4',getenv('STOCK_CSV_TEST_USER') ?: 'root',getenv('STOCK_CSV_TEST_PASSWORD') ?: 'test-only',[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC,PDO::ATTR_EMULATE_PREPARES=>false]);
if ($pdo->query('SELECT DATABASE()')->fetchColumn()!=='inventory_csv_test')throw new RuntimeException('Disposable DB only');
foreach (['sales_csv_rows','sales_csv_batches','stock_csv_batches','stock_transactions','product_stocks','products'] as $t)$pdo->exec('DROP TABLE IF EXISTS '.$t);
$pdo->exec(file_get_contents(__DIR__.'/mysql-schema.sql'));
$pdo->exec("INSERT INTO products (internal_code,product_name,product_status) VALUES ('FAKE-SAME','架空一致','専用商品'),('FAKE-DIFF','架空差異','廃盤予定'),('FAKE-ONLY','架空サーバーのみ','通常商品')");
$pdo->exec("INSERT INTO product_stocks (internal_code,location_name,quantity) VALUES ('FAKE-SAME','本社',3),('FAKE-DIFF','酒本倉庫1階',4)");
$admin=['id'=>1,'role'=>'admin'];
function check(bool $ok,string $message):void{if(!$ok)throw new RuntimeException($message);}
function item(string $code,string $name,string $state='通常商品',array $stocks=[]):array{
    return ['internal_code'=>$code,'product_name'=>$name,'product_code'=>'','jan_code'=>'','color'=>'','category'=>'','supplier_name'=>'','unit'=>'','memo'=>'','min_stock'=>0,'product_status'=>$state,'stocks'=>$stocks];
}
function reject(callable $fn,int $status):void{try{$fn();}catch(StockCsvError $e){check($e->status===$status,'Unexpected status '.$e->status);return;}throw new RuntimeException('Expected rejection');}
function snapshot(PDO $pdo):array{return [$pdo->query('SELECT * FROM products ORDER BY internal_code')->fetchAll(),$pdo->query('SELECT * FROM product_stocks ORDER BY internal_code,location_name')->fetchAll(),$pdo->query('SELECT * FROM stock_transactions ORDER BY id')->fetchAll()];}
$before=snapshot($pdo);
$input=['action'=>'preview','products'=>[
    item('FAKE-SAME','架空一致','専用商品',[['location_name'=>'本社','quantity'=>3]]),
    item('FAKE-DIFF','架空差異','専用商品',[['location_name'=>'酒本倉庫1階','quantity'=>5]]),
    item('FAKE-NEW','架空新規')]];
$r=previewInventoryMigration($pdo,$input,$admin);
check($r['summary']===['new'=>1,'same'=>1,'different'=>1,'code_conflict'=>0,'fixed_status_conflict'=>1,'server_only'=>1],'Wrong classifications');
check($r['preview_only']===true && $r['migrated']===false,'Unexpected apply');
check($r['server_only_codes']===['FAKE-ONLY'],'Server-only not retained');
check(snapshot($pdo)===$before,'Preview changed data/history/timestamps');
check(previewInventoryMigration($pdo,$input,$admin)['comparison_sha256']===$r['comparison_sha256'],'Unstable comparison');
echo "PASS consistent preview classifies new/equal/different/fixed status/server-only without changing records\n";
reject(fn()=>previewInventoryMigration($pdo,$input,['id'=>2,'role'=>'worker']),403);
$bad=$input;$bad['action']='apply';reject(fn()=>previewInventoryMigration($pdo,$bad,$admin),400);
$bad=$input;$bad['products'][0]['stocks'][0]['quantity']=1.2;reject(fn()=>previewInventoryMigration($pdo,$bad,$admin),400);
$bad=$input;$bad['products'][0]['min_stock']=-1;reject(fn()=>previewInventoryMigration($pdo,$bad,$admin),400);
$bad=$input;$bad['products'][0]['product_status']='UNKNOWN';reject(fn()=>previewInventoryMigration($pdo,$bad,$admin),400);
$bad=$input;$bad['products'][]=$bad['products'][0];reject(fn()=>previewInventoryMigration($pdo,$bad,$admin),400);
$bad=$input;$bad['products']=[];reject(fn()=>previewInventoryMigration($pdo,$bad,$admin),400);
$bad=$input;$bad['products']=array_fill(0,1001,item('FAKE','架空'));reject(fn()=>previewInventoryMigration($pdo,$bad,$admin),400);
check(snapshot($pdo)===$before,'Rejected preview changed data');
echo "PASS role, apply rejection, strict quantities/status, duplicate codes and size limits\n";
$alias=['action'=>'preview','products'=>[item('fake-same','架空一致','専用商品',[['location_name'=>'本社','quantity'=>3]])]];
$r=previewInventoryMigration($pdo,$alias,$admin);check($r['summary']['code_conflict']===1 && $r['rows'][0]['server_code']==='FAKE-SAME','Alias not flagged');
$alias=['action'=>'preview','products'=>[item('FAKE-NEW','架空'),item('fake-new','架空')]];reject(fn()=>previewInventoryMigration($pdo,$alias,$admin),409);
$alias=['action'=>'preview','products'=>[item('NEW-é','架空'),item('NEW-e','架空')]];reject(fn()=>previewInventoryMigration($pdo,$alias,$admin),409);
echo "PASS existing and new code aliases checked with actual MySQL collation\n";
$pdo->beginTransaction();$pdo->exec("UPDATE products SET product_name='uncommitted fake' WHERE internal_code='FAKE-ONLY'");reject(fn()=>previewInventoryMigration($pdo,$input,$admin),409);check($pdo->inTransaction(),'Caller transaction committed/rolled back');$pdo->rollBack();
check(snapshot($pdo)===$before,'Caller transaction affected');
$pdo->exec("UPDATE product_stocks SET quantity=5 WHERE internal_code='FAKE-DIFF'");
$r2=previewInventoryMigration($pdo,$input,$admin);check($r2['comparison_sha256']!==$r['comparison_sha256'],'Changed stock not in hash');
check((int)$pdo->query('SELECT COUNT(*) FROM stock_transactions')->fetchColumn()===0,'Generated shipment history');
echo "PASS caller transaction preserved; comparison changes with server stock and never replays historical sales\n";
