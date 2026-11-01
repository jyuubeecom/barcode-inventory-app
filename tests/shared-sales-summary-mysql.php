<?php
declare(strict_types=1);
require_once __DIR__.'/../server/shared-sales-summary-service.php';
$p=new PDO(getenv('STOCK_CSV_TEST_DSN')?:'mysql:host=127.0.0.1;dbname=inventory_csv_test;charset=utf8mb4',getenv('STOCK_CSV_TEST_USER')?:'root',getenv('STOCK_CSV_TEST_PASSWORD')?:'test-only',[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC,PDO::ATTR_EMULATE_PREPARES=>false]);
if($p->query('SELECT DATABASE()')->fetchColumn()!=='inventory_csv_test')throw new RuntimeException('Test DB only');
$p->exec(str_replace('CREATE TABLE `','CREATE TABLE IF NOT EXISTS `',file_get_contents(__DIR__.'/mysql-schema.sql')));
$p->exec(file_get_contents(__DIR__.'/../server/migrations/005-shared-planning.sql'));
$p->exec('DROP TABLE IF EXISTS shared_sales_summary_state');$p->exec(file_get_contents(__DIR__.'/../server/migrations/006-shared-sales-summary.sql'));
$p->exec("INSERT IGNORE INTO products(internal_code,product_name,supplier_name) VALUES ('FAKE-SUM-001','架空月別商品','株式会社モービック')");
$p->exec("INSERT INTO product_stocks(internal_code,location_name,quantity) VALUES ('FAKE-SUM-001','本社',10) ON DUPLICATE KEY UPDATE quantity=10");
function check(bool $v,string $m):void{if(!$v)throw new RuntimeException($m);}
function failure(callable $f,int $status):void{try{$f();}catch(SharedPlanningError $e){check($e->status===$status,'Wrong status');return;}throw new RuntimeException('Expected rejection');}
function inventoryHash(PDO $p):string{return hash('sha256',json_encode([$p->query('SELECT * FROM products ORDER BY internal_code')->fetchAll(),$p->query('SELECT * FROM product_stocks ORDER BY internal_code,location_name')->fetchAll(),$p->query('SELECT * FROM stock_transactions ORDER BY id')->fetchAll()]));}
$a=['id'=>1,'role'=>'admin'];$w=['id'=>2,'role'=>'worker'];$data=['rule'=>'monthly-customer-exclusion-v1','sourceCount'=>4,'months'=>[['internalCode'=>'FAKE-SUM-001','month'=>'2026-10','ordinary'=>28,'excluded'=>900],['internalCode'=>'FAKE-HISTORICAL','month'=>'2026-09','ordinary'=>-2,'excluded'=>0]],'ranges'=>[['startDate'=>'2026-05-01','endDate'=>'2026-10-31']]];
$before=inventoryHash($p);check(summaryRead($p,$w)['sales']['data']===null,'Missing is not zero');failure(fn()=>summaryRead($p,[]),403);failure(fn()=>summarySave($p,$w,['action'=>'preview','data'=>$data]),403);
$preview=summarySave($p,$a,['action'=>'preview','data'=>$data]);check($preview['can_initialize']&&summaryRead($p,$w)['sales']['data']===null,'Preview persisted data');
$body=['action'=>'initialize','data'=>$data,'hash'=>$preview['hash'],'revision'=>0,'request_id'=>'12345678-1234-4234-8234-123456789012'];failure(fn()=>summarySave($p,$a,[...$body,'revision'=>99]),409);
check(summarySave($p,$a,$body)['replayed']===false,'Initial save failed');check(summarySave($p,$a,$body)['replayed']===true,'Retry failed');failure(fn()=>summarySave($p,['id'=>3,'role'=>'admin'],$body),409);failure(fn()=>summarySave($p,$a,[...$body,'request_id'=>'22345678-1234-4234-8234-123456789012']),409);
$read=summaryRead($p,$w);check($read['complete']&&$read['sales']['data']['months'][0]['ordinary']===28,'Summary read failed');check(array_values(array_filter($read['products'],fn($r)=>$r['internal_code']==='FAKE-SUM-001'))[0]['total_stock']===10,'Current stock missing');check(inventoryHash($p)===$before,'Historical upload or read changed inventory');
$p->beginTransaction();failure(fn()=>summaryRead($p,$a),409);failure(fn()=>summarySave($p,$a,['action'=>'preview','data'=>$data]),409);check($p->inTransaction(),'Caller transaction changed');$p->rollBack();
foreach(['duplicate','fraction','month','rule','range','extra'] as $mode){$bad=$data;if($mode==='duplicate')$bad['months'][]=$bad['months'][0];if($mode==='fraction')$bad['months'][0]['ordinary']=1.5;if($mode==='month')$bad['months'][0]['month']='2026-13';if($mode==='rule')$bad['rule']='unknown';if($mode==='range')$bad['ranges'][0]['startDate']='2026-02-30';if($mode==='extra')$bad['stock']=1;failure(fn()=>summaryPayload($bad),400);}
$p->exec('UPDATE shared_sales_summary_state SET revision=0,request_id=NULL,request_hash=NULL,user_id=NULL,payload_json=NULL WHERE id=1');
$p->exec("CREATE TRIGGER fake_summary_failure BEFORE UPDATE ON shared_sales_summary_state FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='FAKE_FAILURE'");
try{summarySave($p,$a,$body);throw new RuntimeException('Expected rollback');}catch(PDOException $e){}
check(summaryRead($p,$w)['sales']['data']===null&&inventoryHash($p)===$before,'Rollback failed');$p->exec('DROP TRIGGER fake_summary_failure');
echo "PASS summary preview, roles, initial copy, idempotent retry, immutable data, signed returns, unknown historical codes, current inventory snapshot and rollback without stock/history changes\n";
