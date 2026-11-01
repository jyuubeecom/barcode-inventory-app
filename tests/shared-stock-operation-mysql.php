<?php
declare(strict_types=1);
require_once __DIR__.'/../server/shared-stock-operation-service.php';
function connection():PDO {
 $p=new PDO(getenv('STOCK_CSV_TEST_DSN')?:'mysql:host=127.0.0.1;dbname=inventory_csv_test;charset=utf8mb4',getenv('STOCK_CSV_TEST_USER')?:'root',getenv('STOCK_CSV_TEST_PASSWORD')?:'test-only',[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC,PDO::ATTR_EMULATE_PREPARES=>false]);
 if ($p->query('SELECT DATABASE()')->fetchColumn()!=='inventory_csv_test') throw new RuntimeException('Test DB only');return $p;
}
$user=['id'=>1,'role'=>'worker','display_name'=>'架空担当'];
function request(string $id='1'):array {return ['request_id'=>'12345678-1234-4234-8234-'.str_pad($id,12,'0',STR_PAD_LEFT),'action'=>'out','internal_code'=>'FAKE-001','location_name'=>'本社','quantity'=>2,'reason'=>'出荷','memo'=>'架空','expected_stocks'=>[['location_name'=>'本社','quantity'=>5],['location_name'=>'酒本倉庫1階','quantity'=>2]]];}
if (($argv[1]??'')==='--worker') {try {echo json_encode(applySharedStockOperation(connection(),json_decode(base64_decode($argv[2]),true),$user),JSON_THROW_ON_ERROR);}catch(StockCsvError $e){echo json_encode(['status'=>$e->status]);}exit;}
$p=connection();
foreach(['shared_stock_operation_batches','stock_transactions','product_stocks','products'] as $t)$p->exec('DROP TABLE IF EXISTS '.$t);
$p->exec(file_get_contents(__DIR__.'/mysql-schema.sql'));$p->exec(file_get_contents(__DIR__.'/../server/migrations/004-shared-stock-operations.sql'));
function fixture(PDO $p):void {foreach(['shared_stock_operation_batches','stock_transactions','product_stocks','products'] as $t)$p->exec('DELETE FROM '.$t);$p->exec("INSERT INTO products(internal_code,product_name) VALUES ('FAKE-001','架空商品')");$p->exec("INSERT INTO product_stocks VALUES ('FAKE-001','本社',5,NOW()),('FAKE-001','酒本倉庫1階',2,NOW())");}
function check(bool $v,string $s):void{if(!$v)throw new RuntimeException($s);}
function failure(callable $fn,int $code):void{try{$fn();}catch(StockCsvError $e){check($e->status===$code,'Wrong status '.$e->status);return;}throw new RuntimeException('Expected rejection');}
function countHistory(PDO $p):int{return (int)$p->query('SELECT COUNT(*) FROM stock_transactions')->fetchColumn();}
fixture($p);$r=request();$result=applySharedStockOperation($p,$r,$user);
check($result['location_stock_after']===3&&$result['stock_after']===5,'Wrong stock');check(countHistory($p)===1,'Missing history');
$history=$p->query('SELECT * FROM stock_transactions')->fetch();check((int)$history['quantity']===-2&&$history['operator_name']==='架空担当','Wrong history');
check(applySharedStockOperation($p,$r,$user)['replayed']===true&&countHistory($p)===1,'Retry doubled');
$changed=$r;$changed['quantity']=1;failure(fn()=>applySharedStockOperation($p,$changed,$user),409);
failure(fn()=>applySharedStockOperation($p,$r,['id'=>2,'role'=>'admin']),409);
$stale=request('2');failure(fn()=>applySharedStockOperation($p,$stale,$user),409);check(countHistory($p)===1,'Stale changed inventory');
echo "PASS receipt replay, account binding, exact stock snapshot and worker history\n";
foreach([0,-1,1.2,'2',1000001] as $qty){$bad=request('3');$bad['quantity']=$qty;failure(fn()=>applySharedStockOperation($p,$bad,$user),400);}
failure(fn()=>applySharedStockOperation($p,request('3'),['id'=>1,'role'=>'guest']),403);
fixture($p);$r=request();$r['quantity']=6;failure(fn()=>applySharedStockOperation($p,$r,$user),409);check(countHistory($p)===0,'Overdraw wrote history');
$r=request();$r['action']='in';$r['location_name']='本社1階 A区';$result=applySharedStockOperation($p,$r,$user);check($result['stock_after']===9,'New location deposit failed');
fixture($p);$p->exec("UPDATE products SET product_status='廃盤'");$r=request();$r['action']='in';failure(fn()=>applySharedStockOperation($p,$r,$user),409);
echo "PASS invalid input, permissions, overdraft, new location, discontinued deposit\n";
// A history failure rolls back both the stock update and its receipt.
fixture($p);$p->exec("CREATE TRIGGER fake_operation_failure BEFORE INSERT ON stock_transactions FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='FAKE_FAILURE'");
try{applySharedStockOperation($p,request(),$user);throw new RuntimeException('Expected trigger error');}catch(PDOException $e){}
check((int)$p->query("SELECT quantity FROM product_stocks WHERE location_name='本社'")->fetchColumn()===5&&countHistory($p)===0,'Rollback lost');check((int)$p->query('SELECT COUNT(*) FROM shared_stock_operation_batches')->fetchColumn()===0,'Receipt rollback lost');$p->exec('DROP TRIGGER fake_operation_failure');
echo "PASS stock, history and receipt atomic rollback\n";
function concurrent(array $requests):array {
 $jobs=[];foreach($requests as $r){$pipes=[];$proc=proc_open([PHP_BINARY,__FILE__,'--worker',base64_encode(json_encode($r))],[1=>['pipe','w'],2=>['pipe','w']],$pipes);$jobs[]=[$proc,$pipes];}
 $results=[];foreach($jobs as [$proc,$pipes]){$s=stream_get_contents($pipes[1]);$err=stream_get_contents($pipes[2]);fclose($pipes[1]);fclose($pipes[2]);check(proc_close($proc)===0,'Worker failed '.$err);$results[]=json_decode($s,true,512,JSON_THROW_ON_ERROR);}return $results;
}
fixture($p);$results=concurrent([request(),request()]);check(countHistory($p)===1&&count(array_filter($results,fn($r)=>!empty($r['success'])))===2,'Concurrent retry doubled');
fixture($p);$results=concurrent([request('1'),request('2')]);check(countHistory($p)===1&&count(array_filter($results,fn($r)=>($r['status']??0)===409))===1,'Concurrent writers overwrote');
echo "PASS concurrent retry once and conflicting snapshot rejected\n";
