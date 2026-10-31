<?php
declare(strict_types=1);
require_once __DIR__ . '/../server/sales-csv-service.php';
require_once __DIR__ . '/../server/check-sales-csv-readiness.php';
function db(): PDO {
    $pdo = new PDO(getenv('STOCK_CSV_TEST_DSN') ?: 'mysql:host=127.0.0.1;dbname=inventory_csv_test;charset=utf8mb4', getenv('STOCK_CSV_TEST_USER') ?: 'root', getenv('STOCK_CSV_TEST_PASSWORD') ?: 'test-only', [PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC, PDO::ATTR_EMULATE_PREPARES=>false]);
    if ($pdo->query('SELECT DATABASE()')->fetchColumn() !== 'inventory_csv_test') throw new RuntimeException('Disposable database only'); return $pdo;
}
$admin = ['id'=>1,'role'=>'admin','display_name'=>'架空担当'];
if (($argv[1] ?? '') === '--worker') {
    try { echo json_encode(applySalesCsv(db(), json_decode(base64_decode($argv[2]), true), $admin), JSON_THROW_ON_ERROR); }
    catch (StockCsvError $e) { echo json_encode(['status'=>$e->status]); } exit;
}
function check(bool $value, string $message): void { if (!$value) throw new RuntimeException($message); }
function fail(callable $fn, int $status): void { try { $fn(); } catch (StockCsvError $e) { check($e->status===$status,'Unexpected status: '.$e->status); return; } throw new RuntimeException('Expected rejection'); }
function row(string $code='FAKE-001', string $qty='4', string $type='売上', string $voucher='FAKE-INVOICE-1'): array { return [$code,'架空品名','','C001','架空得意先','2026-10-01',$qty,'100','400','',''.$voucher,$type]; }
function input(array $rows, string $suffix='1'): array { global $pdo,$admin; $preview = previewSalesCsv($pdo,['rows'=>$rows],$admin); return ['rows'=>$rows,'request_id'=>'12345678-1234-4234-8234-'.str_pad($suffix,12,'0',STR_PAD_LEFT),'preview_hash'=>$preview['preview_hash'],'file_name'=>'fake-sales.csv']; }
function countTable(string $table): int { global $pdo; return (int)$pdo->query('SELECT COUNT(*) FROM '.$table)->fetchColumn(); }
function total(): int { global $pdo; return (int)$pdo->query("SELECT SUM(quantity) FROM product_stocks WHERE internal_code='FAKE-001'")->fetchColumn(); }
function fixture(): void { global $pdo;
    foreach (['sales_csv_rows','sales_csv_batches','stock_csv_batches','stock_transactions','product_stocks','products'] as $t) $pdo->exec('DELETE FROM '.$t);
    $pdo->exec("INSERT INTO products (internal_code,product_name) VALUES ('FAKE-001','架空商品1'),('FAKE-002','架空商品2')");
    $pdo->exec("INSERT INTO product_stocks (internal_code,location_name,quantity) VALUES ('FAKE-001','本社',2),('FAKE-001','本社1階 A区',3),('FAKE-001','酒本倉庫1階',4),('FAKE-001','酒本倉庫2階',5),('FAKE-002','本社',1)");
}
$pdo=db();
foreach (['sales_csv_rows','sales_csv_batches','stock_csv_batches','stock_transactions','product_stocks','products'] as $t) $pdo->exec('DROP TABLE IF EXISTS '.$t);
$pdo->exec(file_get_contents(__DIR__.'/mysql-schema.sql'));
$pdo->exec(file_get_contents(__DIR__.'/../server/migrations/001-stock-csv-batches.sql'));
check(!salesCsvReadiness($pdo)['sales_tables_ready'],'Missing migration not detected');
$pdo->exec(file_get_contents(__DIR__.'/../server/migrations/002-sales-csv.sql'));
check(salesCsvReadiness($pdo)['sales_tables_ready'],'Migration not ready');
fixture(); $preview=previewSalesCsv($pdo,['rows'=>[row()]],$admin);
check(total()===14 && countTable('sales_csv_batches')===0 && countTable('stock_transactions')===0,'Preview wrote data');
$r=input([row()]); $result=applySalesCsv($pdo,$r,$admin);
check(total()===10 && countTable('sales_csv_rows')===1 && countTable('stock_transactions')===2,'Wrong apply');
$locations=$pdo->query('SELECT location_name,before_stock,after_stock,quantity FROM stock_transactions ORDER BY id')->fetchAll();
check($locations[0]['location_name']==='本社' && (int)$locations[0]['before_stock']===14 && (int)$locations[0]['after_stock']===12 && $locations[1]['location_name']==='本社1階 A区' && (int)$locations[1]['after_stock']===10,'Wrong priority/history');
check(count(json_decode($pdo->query('SELECT before_json FROM sales_csv_batches')->fetchColumn(),true)['FAKE-001'])===4,'Missing snapshot');
check(applySalesCsv($pdo,$r,$admin)['replayed']===true && total()===10 && countTable('stock_transactions')===2,'Replay decremented twice');
check(salesCsvHistory($pdo,$admin)['batches'][0]['imported_count']===1,'Shared history missing');
$changed=$r; $changed['rows'][0][6]='3'; fail(fn()=>applySalesCsv($pdo,$changed,$admin),409);
fail(fn()=>applySalesCsv($pdo,$r,['id'=>2,'role'=>'admin']),409);
fail(fn()=>applySalesCsv($pdo,$r,['id'=>1,'role'=>'worker']),403);
fail(fn()=>previewSalesCsv($pdo,['rows'=>[row()]],['id'=>1,'role'=>'worker']),403);
fail(fn()=>salesCsvHistory($pdo,['id'=>1,'role'=>'worker']),403);
echo "PASS read-only preview, ordered deduction, atomic sales/history/backup, shared history and replay authorization\n";
$dup=previewSalesCsv($pdo,['rows'=>[row()]],$admin);
check($dup['imported_count']===0 && $dup['duplicate_count']===1,'Cross-device duplicate not detected');
$second=input([row(),row('FAKE-001','2','売上','FAKE-INVOICE-2')],'2'); applySalesCsv($pdo,$second,$admin);
check(total()===8 && countTable('sales_csv_rows')===2,'Overlapping file double deduction');
echo "PASS renamed and overlapping exports skip previously imported rows\n";
fixture(); $return=input([row('FAKE-001','3','返品')]); applySalesCsv($pdo,$return,$admin);
check(total()===17 && (int)$pdo->query("SELECT quantity FROM product_stocks WHERE location_name='本社' AND internal_code='FAKE-001'")->fetchColumn()===5,'Return not in headquarters');
$negative=previewSalesCsv($pdo,['rows'=>[row('FAKE-001','-3','返品')]],$admin); check($negative['duplicate_count']===1,'Return sign bypassed duplicate');
fixture(); applySalesCsv($pdo,input([row(),row()]),$admin); check(total()===6 && countTable('sales_csv_rows')===2,'Identical legitimate repeated rows collapsed');
$repeat=previewSalesCsv($pdo,['rows'=>[row(),row()]],$admin); check($repeat['duplicate_count']===2,'Occurrence duplicate failed');
fixture(); applySalesCsv($pdo,input([row(),row('FAKE-001','4','返品')]),$admin); check(total()===14 && countTable('sales_csv_rows')===2 && countTable('stock_transactions')===0,'Zero net failed');
echo "PASS returns, sign normalization, repeated row counts and zero-net sales retention\n";
fixture(); $stale=input([row()]); $pdo->exec("UPDATE product_stocks SET quantity=6 WHERE internal_code='FAKE-001' AND location_name='酒本倉庫2階'");
fail(fn()=>applySalesCsv($pdo,$stale,$admin),409); check(total()===15 && countTable('sales_csv_batches')===0 && countTable('sales_csv_rows')===0 && countTable('stock_transactions')===0,'Stale partial writes');
fixture(); $stale=input([row()]); $pdo->exec("UPDATE products SET product_status='廃盤' WHERE internal_code='FAKE-001'"); fail(fn()=>applySalesCsv($pdo,$stale,$admin),409);
fixture(); fail(fn()=>previewSalesCsv($pdo,['rows'=>[row('FAKE-001','1'),row('FAKE-002','2')]],$admin),409);
check(total()===14 && countTable('sales_csv_rows')===0,'Shortage wrote data');
$bad=input([row()]); $bad['rows'][]=row('UNKNOWN','1'); fail(fn()=>applySalesCsv($pdo,$bad,$admin),409);
check(total()===14 && countTable('sales_csv_batches')===0,'Late validation left receipt');
fail(fn()=>previewSalesCsv($pdo,['rows'=>[row('fake-001')]],$admin),409);
$pdo->exec("UPDATE product_stocks SET location_name='未設定' WHERE internal_code='FAKE-001' AND location_name='本社'"); fail(fn()=>previewSalesCsv($pdo,['rows'=>[row('FAKE-001','13')]],$admin),409);
echo "PASS stale snapshots, discontinued products, late failure, shortages and unknown/alias codes abort all writes\n";
foreach (['0','-1','1.2','1000001','1e2','',true] as $qty) { $bad=row();$bad[6]=$qty; fail(fn()=>salesCsvRequest(['rows'=>[$bad]]),400); }
$bad=row();$bad[5]='2026-02-30';fail(fn()=>salesCsvRequest(['rows'=>[$bad]]),400);
$bad=row();$bad[4]="a\x1fb";fail(fn()=>salesCsvRequest(['rows'=>[$bad]]),400);
fail(fn()=>salesCsvRequest(['rows'=>array_fill(0,301,row())]),400);
$many=[];for($i=0;$i<101;$i++)$many[]=row('FAKE-'.$i);fail(fn()=>salesCsvRequest(['rows'=>$many]),400);
echo "PASS strict input, date, quantity, row and product limits\n";
// Trigger an error after inventory and one sales row have been written: the transaction must undo all of it.
fixture(); $r=input([row(),row('FAKE-001','1','売上','FAIL-TRIGGER')]);
$pdo->exec("CREATE TRIGGER fail_sales_row BEFORE INSERT ON sales_csv_rows FOR EACH ROW BEGIN IF NEW.voucher_number='FAIL-TRIGGER' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='test failure'; END IF; END");
try { applySalesCsv($pdo,$r,$admin); throw new RuntimeException('Expected trigger failure'); } catch(PDOException $e) {} finally { $pdo->exec('DROP TRIGGER fail_sales_row'); }
check(total()===14 && countTable('sales_csv_batches')===0 && countTable('sales_csv_rows')===0 && countTable('stock_transactions')===0,'Rollback incomplete');
echo "PASS storage failure rolls back inventory, sales, history and receipt\n";
function parallel(array $requests): array {
    $children=[];
    foreach($requests as $r) { $p=proc_open([PHP_BINARY,__FILE__,'--worker',base64_encode(json_encode($r,JSON_THROW_ON_ERROR))],[0=>['pipe','r'],1=>['pipe','w'],2=>['pipe','w']],$pipes); check(is_resource($p),'Worker start');fclose($pipes[0]);$children[]=[$p,$pipes]; }
    $results=[];foreach($children as [$p,$pipes]) { $out=stream_get_contents($pipes[1]);$err=stream_get_contents($pipes[2]);fclose($pipes[1]);fclose($pipes[2]);check(proc_close($p)===0 && $err==='','Worker failure: '.$err);$results[]=json_decode($out,true,64,JSON_THROW_ON_ERROR); }return $results;
}
fixture();$r=input([row()]);$results=parallel([$r,$r]);check(count(array_filter($results,fn($r)=>$r['success']??false))===2 && total()===10 && countTable('sales_csv_batches')===1,'Parallel replay failed');
fixture();$r=input([row()]);$s=$r;$s['request_id']='12345678-1234-4234-8234-000000000002';$results=parallel([$r,$s]);check(count(array_filter($results,fn($r)=>$r['success']??false))===1 && count(array_filter($results,fn($r)=>($r['status']??0)===409))===1 && total()===10,'Parallel different keys double-deducted');
fixture();$r=input([row()]);$s=input([row('FAKE-001','12','売上','FAKE-INVOICE-2')],'2');$results=parallel([$r,$s]);check(count(array_filter($results,fn($r)=>$r['success']??false))===1 && countTable('sales_csv_rows')===1 && total()>=0,'Competing oversell');
echo "PASS simultaneous same key, same sales/different keys and competing PCs cannot double deduct or oversell\n";

fixture();$r=input([row()]);$s=input([row('FAKE-002','1')],'2');$results=parallel([$r,$s]);check(count(array_filter($results,fn($r)=>$r['success']??false))===2 && countTable('sales_csv_rows')===2,'Unrelated products blocked each other');
echo "PASS unrelated product imports both succeed without duplicate-index gap locks\n";
fixture();$pdo->exec("INSERT INTO products (internal_code,product_name) VALUES ('100','numeric fake')");$pdo->exec("INSERT INTO product_stocks (internal_code,location_name,quantity) VALUES ('100','本社',2)");$numeric=applySalesCsv($pdo,input([row('100','1')]),$admin);check($numeric['changes'][0]['internal_code']==='100','Numeric code lost string type');
echo "PASS numeric-looking codes retain their string type\n";
