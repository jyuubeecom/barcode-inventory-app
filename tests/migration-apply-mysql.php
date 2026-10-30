<?php
declare(strict_types=1);
require_once __DIR__.'/../server/migration-apply-service.php';
$pdo = new PDO(getenv('STOCK_CSV_TEST_DSN') ?: 'mysql:host=127.0.0.1;dbname=inventory_csv_test;charset=utf8mb4',getenv('STOCK_CSV_TEST_USER') ?: 'root',getenv('STOCK_CSV_TEST_PASSWORD') ?: 'test-only',[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC,PDO::ATTR_EMULATE_PREPARES=>false]);
if ($pdo->query('SELECT DATABASE()')->fetchColumn()!=='inventory_csv_test')throw new RuntimeException('Disposable DB only');
if (($argv[1] ?? '')==='child') {echo json_encode(applyInventoryMigration($pdo,json_decode(stream_get_contents(STDIN),true,512,JSON_THROW_ON_ERROR),['id'=>1,'role'=>'admin']),JSON_THROW_ON_ERROR);exit;}
foreach (['inventory_migration_batches','sales_csv_rows','sales_csv_batches','stock_csv_batches','stock_transactions','product_stocks','products'] as $t)$pdo->exec('DROP TABLE IF EXISTS '.$t);
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

$pdo->exec(file_get_contents(__DIR__.'/../server/migrations/003-inventory-migration-batches.sql'));
function plan(PDO $pdo,array $products,string $id='11111111-1111-4111-8111-111111111111'):array{
    $r=previewInventoryMigration($pdo,['action'=>'preview','products'=>$products],['id'=>1,'role'=>'admin']);
    return ['action'=>'apply_new','request_id'=>$id,'products'=>$products,'comparison_sha256'=>$r['comparison_sha256']];
}
function allData(PDO $pdo):array{return [snapshot($pdo),$pdo->query('SELECT * FROM inventory_migration_batches ORDER BY request_id')->fetchAll()];}
$same=item('FAKE-SAME','架空一致','専用商品',[['location_name'=>'本社','quantity'=>3]]);
$new=item('FAKE-ADD','追加架空','廃盤予定',[['location_name'=>'本社','quantity'=>2],['location_name'=>'酒本倉庫1階','quantity'=>3]]);
$request=plan($pdo,[$same,$new]);$before=snapshot($pdo);
reject(fn()=>applyInventoryMigration($pdo,$request,['id'=>2,'role'=>'worker']),403);
$bad=$request;$bad['action']='apply';reject(fn()=>applyInventoryMigration($pdo,$bad,$admin),400);
$bad=$request;$bad['products'][1]['stocks'][0]['quantity']=1.1;reject(fn()=>applyInventoryMigration($pdo,$bad,$admin),400);
check(snapshot($pdo)===$before,'Invalid requests wrote data');
$r=applyInventoryMigration($pdo,$request,$admin);
check($r['added']===1&&$r['unchanged']===1&&$r['migrated']===true&&$r['history_replayed']===false,'Wrong result');
check($pdo->query("SELECT product_status FROM products WHERE internal_code='FAKE-ADD'")->fetchColumn()==='廃盤予定','Lost fixed state');
check((int)$pdo->query("SELECT SUM(quantity) FROM product_stocks WHERE internal_code='FAKE-ADD'")->fetchColumn()===5,'Wrong stock');
$history=$pdo->query("SELECT * FROM stock_transactions ORDER BY id")->fetchAll();
check(count($history)===2&&array_sum(array_column($history,'quantity'))===5&&$history[1]['after_stock']==5,'Wrong migration history');
check($history[0]['transaction_type']==='初期移行','Replayed a sale');
$after=allData($pdo);$retry=applyInventoryMigration($pdo,$request,$admin);check(($retry['replayed']??false)===true&&allData($pdo)===$after,'Retry duplicated records');
reject(fn()=>applyInventoryMigration($pdo,$request,['id'=>2,'role'=>'admin']),409);
$bad=$request;$bad['products'][1]['memo']='changed';reject(fn()=>applyInventoryMigration($pdo,$bad,$admin),409);
check(allData($pdo)===$after,'Conflicting retry changed data');
echo "PASS atomic missing-product addition, fixed status, per-location stock and receipt replay\n";
$request=plan($pdo,[item('FAKE-STALE','架空')],'22222222-2222-4222-8222-222222222222');
$pdo->exec("UPDATE product_stocks SET quantity=4 WHERE internal_code='FAKE-SAME'");$before=allData($pdo);
reject(fn()=>applyInventoryMigration($pdo,$request,$admin),409);check(allData($pdo)===$before,'Stale preview wrote records');
$request=plan($pdo,[item('FAKE-SAME','上書き不可'),item('FAKE-NEVER','架空')],'33333333-3333-4333-8333-333333333333');
reject(fn()=>applyInventoryMigration($pdo,$request,$admin),409);check(allData($pdo)===$before,'Different existing product was updated');
$request=plan($pdo,[item('fake-same','架空')],'44444444-4444-4444-8444-444444444444');
reject(fn()=>applyInventoryMigration($pdo,$request,$admin),409);
reject(fn()=>plan($pdo,[item('FAKE-é','架空'),item('FAKE-e','架空')]),409);
$pdo->beginTransaction();reject(fn()=>applyInventoryMigration($pdo,$request,$admin),409);check($pdo->inTransaction(),'Caller transaction affected');$pdo->rollBack();
echo "PASS stale comparison, existing differences, collation aliases and caller transaction are protected\n";
$request=plan($pdo,[item('FAKE-A-OK','架空','専用商品',[['location_name'=>'本社','quantity'=>3]]),item('FAKE-Z-FAIL','架空')],'55555555-5555-4555-8555-555555555555');
$pdo->exec("CREATE TRIGGER fail_migration BEFORE INSERT ON products FOR EACH ROW BEGIN IF NEW.internal_code='FAKE-Z-FAIL' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='fake failure'; END IF; END");
$before=allData($pdo);try{applyInventoryMigration($pdo,$request,$admin);throw new RuntimeException('Expected SQL failure');}catch(PDOException $e){}
check(allData($pdo)===$before,'Partial product/stock/history/receipt survived rollback');$pdo->exec('DROP TRIGGER fail_migration');
$r=applyInventoryMigration($pdo,$request,$admin);check($r['added']===2,'Retry after rollback failed');
check($pdo->query("SELECT product_status FROM products WHERE internal_code='FAKE-A-OK'")->fetchColumn()==='専用商品','Lost dedicated status');
check((int)$pdo->query("SELECT COUNT(*) FROM product_stocks WHERE internal_code='FAKE-Z-FAIL'")->fetchColumn()===0,'Invented stock for empty zero stock');
echo "PASS injected late failure rolls back products, stocks, history and receipt; same request can then succeed\n";

$request=plan($pdo,[item('FAKE-CONCURRENT','架空','専用商品',[['location_name'=>'本社','quantity'=>7]])],'66666666-6666-4666-8666-666666666666');
$pdo->exec("CREATE TRIGGER slow_migration BEFORE INSERT ON products FOR EACH ROW SET @migration_delay = SLEEP(0.4)");
$workers=[];
for($i=0;$i<2;$i++) {
    $pipes=[];$process=proc_open([PHP_BINARY,__FILE__,'child'],[['pipe','r'],['pipe','w'],['pipe','w']],$pipes);
    check(is_resource($process),'Child failed');fwrite($pipes[0],json_encode($request,JSON_THROW_ON_ERROR));fclose($pipes[0]);$workers[]=[$process,$pipes];
}
$replayed=0;
foreach($workers as [$process,$pipes]) {
    $output=stream_get_contents($pipes[1]);$errors=stream_get_contents($pipes[2]);fclose($pipes[1]);fclose($pipes[2]);check(proc_close($process)===0,'Concurrent apply failed '.$errors);
    $result=json_decode($output,true,512,JSON_THROW_ON_ERROR);check($result['added']===1,'Wrong concurrent result');if($result['replayed']??false)$replayed++;
}
$pdo->exec('DROP TRIGGER slow_migration');
check($replayed===1,'Concurrent retry was not replayed');
check((int)$pdo->query("SELECT SUM(quantity) FROM stock_transactions WHERE internal_code='FAKE-CONCURRENT'")->fetchColumn()===7,'Concurrent retry duplicated inventory history');
echo "PASS simultaneous retries serialize on the receipt and write inventory/history exactly once\n";
