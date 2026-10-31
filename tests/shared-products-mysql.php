<?php
declare(strict_types=1);
require_once __DIR__.'/../server/shared-products-service.php';
$pdo = new PDO(getenv('STOCK_CSV_TEST_DSN') ?: 'mysql:host=127.0.0.1;dbname=inventory_csv_test;charset=utf8mb4',getenv('STOCK_CSV_TEST_USER') ?: 'root',getenv('STOCK_CSV_TEST_PASSWORD') ?: 'test-only',[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC,PDO::ATTR_EMULATE_PREPARES=>false]);
if ($pdo->query('SELECT DATABASE()')->fetchColumn() !== 'inventory_csv_test') throw new RuntimeException('Disposable DB only');
foreach (['sales_csv_rows','sales_csv_batches','stock_csv_batches','stock_transactions','product_stocks','products'] as $t) $pdo->exec('DROP TABLE IF EXISTS '.$t);
$pdo->exec(file_get_contents(__DIR__.'/mysql-schema.sql'));
function check(bool $ok,string $message):void {if (!$ok) throw new RuntimeException($message);}
function reject(callable $f,int $status):void {try {$f();} catch (SharedProductsError $e) {check($e->status===$status,'Wrong status');return;} throw new RuntimeException('Expected rejection');}
function snapshot(PDO $pdo):array {return [$pdo->query('SELECT * FROM products ORDER BY internal_code')->fetchAll(),$pdo->query('SELECT * FROM product_stocks ORDER BY internal_code,location_name')->fetchAll(),$pdo->query('SELECT * FROM stock_transactions ORDER BY id')->fetchAll()];}
$admin=['id'=>1,'role'=>'admin'];$worker=['id'=>2,'role'=>'worker'];
check(readSharedProducts($pdo,$worker)['items']===[],'Empty list');
$insert=$pdo->prepare("INSERT INTO products (internal_code,product_name,product_status) VALUES (?,?,'専用商品')");
for ($i=0;$i<597;$i++) $insert->execute(['FAKE-'.sprintf('%04d',$i),'架空'.$i]);
$pdo->exec("INSERT INTO product_stocks (internal_code,location_name,quantity) VALUES ('FAKE-0596','本社 / 特別区画',2),('FAKE-0596','酒本倉庫1階',1),('FAKE-0000','本社',0)");
$before=snapshot($pdo);$r=readSharedProducts($pdo,$worker);
check($r['complete']===true && $r['count']===597,'Truncated at 200');
$last=$r['items'][596];check($last['total_stock']===3 && count($last['stocks'])===2,'Location stock lost');
check($last['product_status']==='専用商品','Fixed state changed');
check($r['items'][1]['total_stock']===0 && $r['items'][1]['stocks']===[],'Missing stocks');
check($r['items'][0]['stocks'][0]['quantity']===0,'Explicit zero lost');
check(snapshot($pdo)===$before,'Read changed records');
reject(fn()=>readSharedProducts($pdo,[]),403);reject(fn()=>readSharedProducts($pdo,['id'=>3,'role'=>'unknown']),403);
$pdo->beginTransaction();$pdo->exec("UPDATE products SET product_name='pending' WHERE internal_code='FAKE-0000'");
reject(fn()=>readSharedProducts($pdo,$admin),409);check($pdo->inTransaction(),'Caller transaction affected');$pdo->rollBack();
for ($i=597;$i<5001;$i++) $insert->execute(['FAKE-'.sprintf('%04d',$i),'架空'.$i]);
reject(fn()=>readSharedProducts($pdo,$admin),413);check(!$pdo->inTransaction(),'Failed read transaction leaked');
$pdo->exec("DELETE FROM products WHERE internal_code > 'FAKE-0596'");check(readSharedProducts($pdo,$admin)['count']===597,'Recovery failed');
echo "PASS shared list: 597 products, exact locations, fixed state, zero/empty stocks, worker/admin access, no writes, caller transaction, bounded overflow and recovery\n";
