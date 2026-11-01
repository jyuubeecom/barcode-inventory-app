<?php
declare(strict_types=1);
require_once __DIR__.'/../server/shared-planning-service.php';
$p=new PDO(getenv('STOCK_CSV_TEST_DSN')?:'mysql:host=127.0.0.1;dbname=inventory_csv_test;charset=utf8mb4',getenv('STOCK_CSV_TEST_USER')?:'root',getenv('STOCK_CSV_TEST_PASSWORD')?:'test-only',[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC,PDO::ATTR_EMULATE_PREPARES=>false]);
if($p->query('SELECT DATABASE()')->fetchColumn()!=='inventory_csv_test')throw new RuntimeException('Test DB only');
$p->exec('DROP TABLE IF EXISTS shared_planning_state');$p->exec(file_get_contents(__DIR__.'/../server/migrations/005-shared-planning.sql'));
$p->exec(str_replace('CREATE TABLE `','CREATE TABLE IF NOT EXISTS `',file_get_contents(__DIR__.'/mysql-schema.sql')));
$p->exec("INSERT IGNORE INTO products(internal_code,product_name) VALUES ('FAKE-PLAN-001','架空予定商品')");
$user=['id'=>1,'role'=>'admin'];$worker=['id'=>2,'role'=>'worker'];
function check(bool $v,string $m):void{if(!$v)throw new RuntimeException($m);}
function failure(callable $fn,int $status):void{try{$fn();}catch(SharedPlanningError $e){check($e->status===$status,'Wrong status');return;}throw new RuntimeException('Expected rejection');}
function fixture():array{return ['salesPlans'=>[['id'=>'PLAN-1','internalCode'=>'FAKE-PLAN-001','quantity'=>2,'shippingDate'=>'2026-12-01']], 'shippingSchedules'=>[['id'=>'SHIP-1','name'=>'架空船便']], 'shippingAllocations'=>[['id'=>'ALLOC-1','scheduleId'=>'SHIP-1','internalCode'=>'FAKE-PLAN-001','quantity'=>2]],'shippingWarehouseAllocations'=>[], 'shippingArrivalReceipts'=>[['id'=>'SHIP-1','scheduleId'=>'SHIP-1','items'=>[]]], 'purchaseMetadata'=>[['internalCode'=>'FAKE-PLAN-001','orderRemaining'=>null]]];}
function inventoryHash(PDO $p):string{return hash('sha256',json_encode([$p->query('SELECT * FROM product_stocks ORDER BY internal_code,location_name')->fetchAll(),$p->query('SELECT * FROM stock_transactions ORDER BY id')->fetchAll()]));}
$before=inventoryHash($p);check(planningRead($p,$worker)['initialized']===false,'Uninitialized represented as empty');
$data=fixture();$preview=planningInitialize($p,$user,['action'=>'preview','data'=>$data]);check($preview['can_initialize']===true&&planningRead($p,$user)['initialized']===false,'Preview wrote data');
$body=['action'=>'initialize','data'=>$data,'hash'=>$preview['hash'],'revision'=>$preview['revision'],'request_id'=>'12345678-1234-4234-8234-123456789012'];
failure(fn()=>planningInitialize($p,$worker,$body),403);failure(fn()=>planningInitialize($p,$user,[...$body,'revision'=>9]),409);
$result=planningInitialize($p,$user,$body);check($result['replayed']===false,'Initial save failed');check(planningInitialize($p,$user,$body)['replayed']===true,'Retry failed');check(planningRead($p,$worker)['data']['purchaseMetadata'][0]['orderRemaining']===null,'Unknown balance lost');
failure(fn()=>planningInitialize($p,['id'=>3,'role'=>'admin'],$body),409);
failure(fn()=>planningInitialize($p,$user,[...$body,'request_id'=>'22345678-1234-4234-8234-123456789012']),409);
$changed=$data;$changed['salesPlans'][0]['quantity']=4;failure(fn()=>planningInitialize($p,$user,[...$body,'data'=>$changed]),409);
check(inventoryHash($p)===$before,'Inventory or history changed');
$bad=fixture();$bad['salesPlans'][]=$bad['salesPlans'][0];failure(fn()=>planningPayload($bad),400);
$bad=fixture();$bad['salesPlans'][0]['quantity']=1.5;failure(fn()=>planningPayload($bad),400);
$bad=fixture();$bad['purchaseMetadata'][0]['internalCode']='NOT-A-PRODUCT';failure(fn()=>planningInitialize($p,$user,['action'=>'preview','data'=>$bad]),409);
$bad=fixture();$bad['shippingAllocations'][0]['scheduleId']='MISSING';failure(fn()=>planningInitialize($p,$user,['action'=>'preview','data'=>$bad]),409);
// Rollback on failed persistence; inventory and receipts remain untouched.
$p->exec('UPDATE shared_planning_state SET revision=0,request_id=NULL,request_hash=NULL,user_id=NULL,payload_json=NULL WHERE id=1');
$p->exec("CREATE TRIGGER fake_planning_failure BEFORE UPDATE ON shared_planning_state FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='FAKE_FAILURE'");
try{planningInitialize($p,$user,$body);throw new RuntimeException('Expected failure');}catch(PDOException $e){}
check(planningRead($p,$user)['initialized']===false&&inventoryHash($p)===$before,'Atomic rollback failed');$p->exec('DROP TRIGGER fake_planning_failure');
echo "PASS planning permissions, preview, idempotent initial save, immutable existing snapshot, unknown balance, references and no inventory/history changes\n";
