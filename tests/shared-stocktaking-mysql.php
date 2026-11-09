<?php
declare(strict_types=1);
require_once __DIR__.'/../server/shared-stocktaking-service.php';
$pdo=new PDO(getenv('STOCK_CSV_TEST_DSN')?:'mysql:host=127.0.0.1;dbname=inventory_csv_test;charset=utf8mb4',getenv('STOCK_CSV_TEST_USER')?:'root',getenv('STOCK_CSV_TEST_PASSWORD')?:'test-only',[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC,PDO::ATTR_EMULATE_PREPARES=>false]);
if($pdo->query('SELECT DATABASE()')->fetchColumn()!=='inventory_csv_test')throw new RuntimeException('Disposable DB only');
foreach(['shared_stocktaking_finalizations','shared_stocktaking_items','shared_stocktakings','shared_stocktaking_requests','sales_csv_rows','sales_csv_batches','stock_csv_batches','stock_transactions','product_stocks','products']as$t)$pdo->exec('DROP TABLE IF EXISTS '.$t);
$pdo->exec(file_get_contents(__DIR__.'/mysql-schema.sql'));
$pdo->exec(file_get_contents(__DIR__.'/../server/migrations/007-shared-stocktaking.sql'));
function check(bool $ok,string $message):void{if(!$ok)throw new RuntimeException($message);}
function reject(callable $f,int $status):void{try{$f();}catch(StockCsvError $e){check($e->status===$status,'Wrong status '.$e->getMessage());return;}throw new RuntimeException('Expected rejection');}
function inventory(PDO $pdo):array{return [$pdo->query('SELECT * FROM products ORDER BY internal_code')->fetchAll(),$pdo->query('SELECT * FROM product_stocks ORDER BY internal_code,location_name')->fetchAll(),$pdo->query('SELECT * FROM stock_transactions ORDER BY id')->fetchAll()];}
function uuid(int $i):string{return '12345678-1234-4234-8234-'.sprintf('%012d',$i);}
$worker=['id'=>2,'role'=>'worker','display_name'=>'架空担当A'];$other=['id'=>3,'role'=>'worker','display_name'=>'架空担当B'];$admin=['id'=>1,'role'=>'admin'];
$pdo->exec("INSERT INTO products (internal_code,product_code,product_name,jan_code) VALUES ('FAKE-A','CODE-A','架空商品A','4980000000000'),('FAKE-B','CODE-B','架空商品B','4980000000000'),('FAKE-C','CODE-C','架空商品C',NULL)");
$pdo->exec("INSERT INTO product_stocks (internal_code,location_name,quantity) VALUES ('FAKE-A','架空倉庫',10),('FAKE-B','架空倉庫',0),('FAKE-A','別の架空倉庫',5),('FAKE-C','別の架空倉庫',1)");
$baseline=inventory($pdo);
reject(fn()=>readSharedStocktaking($pdo,[]),403);
reject(fn()=>writeSharedStocktaking($pdo,[],['id'=>4,'role'=>'viewer']),403);
$start=['action'=>'start','request_id'=>uuid(1),'stocktaking_date'=>'2026-11-09','location_name'=>'架空倉庫'];
reject(fn()=>writeSharedStocktaking($pdo,array_replace($start,['stocktaking_date'=>'2026-02-30']),$worker),400);
reject(fn()=>writeSharedStocktaking($pdo,array_replace($start,['location_name'=>'存在しない架空倉庫']),$worker),409);
check($pdo->query('SELECT COUNT(*) FROM shared_stocktaking_requests')->fetchColumn()==0,'Rejected request leaked');
$r=writeSharedStocktaking($pdo,$start,$worker);check($r['item_count']===2,'Location target or explicit zero lost');
check(writeSharedStocktaking($pdo,$start,$worker)['replayed']===true,'Start replay duplicated session');
reject(fn()=>writeSharedStocktaking($pdo,$start,$other),409);
reject(fn()=>writeSharedStocktaking($pdo,array_replace($start,['stocktaking_date'=>'2026-11-10']),$worker),409);
$data=readSharedStocktaking($pdo,$other,$r['stocktaking_id']);check(count($data['items'])===2,'Other worker cannot resume');
check($data['items'][0]['counted_stock']===null&&$data['items'][1]['registered_stock']===0,'Unchecked or zero snapshot lost');
check($data['items'][0]['internal_code']!==$data['items'][1]['internal_code'],'Duplicate JAN collapsed');
$save=['action'=>'save','request_id'=>uuid(2),'stocktaking_id'=>uuid(1),'internal_code'=>'FAKE-A','expected_version'=>0,'counted_stock'=>0,'memo'=>'架空テスト'];
$saved=writeSharedStocktaking($pdo,$save,$worker);check($saved['version']===1,'Version not advanced');
check(writeSharedStocktaking($pdo,$save,$worker)['replayed']===true,'Lost-response retry failed');
reject(fn()=>writeSharedStocktaking($pdo,array_replace($save,['counted_stock'=>1]),$worker),409);
reject(fn()=>writeSharedStocktaking($pdo,array_replace($save,['request_id'=>uuid(3)]),$other),409);
$otherSave=array_replace($save,['request_id'=>uuid(3),'internal_code'=>'FAKE-B','counted_stock'=>2]);writeSharedStocktaking($pdo,$otherSave,$other);
$data=readSharedStocktaking($pdo,$admin,uuid(1));check($data['items'][0]['counted_stock']===0&&$data['items'][1]['counted_stock']===2,'Confirmed zero or distinct products overwritten');
check($data['items'][1]['counted_by']==='架空担当B','Authenticated operator lost');
$overview=readSharedStocktaking($pdo,$worker);check($overview['sessions'][0]['checked_count']===2,'Shared checked summary wrong');
check(inventory($pdo)===$baseline,'Draft operations changed inventory or history');
foreach([-1,1.5,'2',null,1000000001]as$q)reject(fn()=>writeSharedStocktaking($pdo,array_replace($save,['request_id'=>uuid(4),'counted_stock'=>$q]),$worker),400);
reject(fn()=>writeSharedStocktaking($pdo,array_replace($save,['request_id'=>uuid(4),'memo'=>str_repeat('あ',1001)]),$worker),400);
reject(fn()=>writeSharedStocktaking($pdo,['action'=>'finalize','request_id'=>uuid(4)],$admin),400);
reject(fn()=>readSharedStocktaking($pdo,$worker,uuid(99)),404);
$pdo->exec("UPDATE product_stocks SET quantity=99 WHERE internal_code='FAKE-A' AND location_name='架空倉庫'");
check(readSharedStocktaking($pdo,$worker,uuid(1))['items'][0]['registered_stock']===10,'Start snapshot followed changing stock');
$latest=array_replace($save,['request_id'=>uuid(5),'expected_version'=>1,'counted_stock'=>3]);writeSharedStocktaking($pdo,$latest,$other);
check(writeSharedStocktaking($pdo,$save,$worker)['version']===1,'Old replay overwrote newer save');
check(readSharedStocktaking($pdo,$worker,uuid(1))['items'][0]['counted_stock']===3,'Stale retry rewrote count');
$pdo->beginTransaction();reject(fn()=>readSharedStocktaking($pdo,$worker),409);check($pdo->inTransaction(),'Caller transaction affected');$pdo->rollBack();
// An unexpected database failure after one item insert must remove the entire draft.
$pdo->exec("CREATE TRIGGER fake_stocktaking_failure BEFORE INSERT ON shared_stocktaking_items FOR EACH ROW BEGIN IF NEW.internal_code='FAKE-B' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='FAKE_ROLLBACK'; END IF; END");
try{writeSharedStocktaking($pdo,array_replace($start,['request_id'=>uuid(6)]),$worker);throw new RuntimeException('Expected fake SQL failure');}catch(PDOException $e){check(str_contains($e->getMessage(),'FAKE_ROLLBACK'),'Unexpected SQL error');}
check(!$pdo->inTransaction(),'Failed transaction leaked');
check($pdo->query("SELECT COUNT(*) FROM shared_stocktakings WHERE id='".uuid(6)."'")->fetchColumn()==0,'Partial draft leaked');
check($pdo->query("SELECT COUNT(*) FROM shared_stocktaking_requests WHERE request_id='".uuid(6)."'")->fetchColumn()==0,'Failed receipt leaked');
$pdo->exec('DROP TRIGGER fake_stocktaking_failure');
echo "PASS shared stocktaking: location snapshots, zero/unchecked, duplicate JAN, worker/admin, retries, conflict, validation, snapshot stability, SQL rollback, no inventory writes\n";
