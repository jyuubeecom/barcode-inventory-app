<?php
declare(strict_types=1);
// Reuse the existing disposable fixtures and their no-inventory-write assertions.
require __DIR__.'/shared-stocktaking-mysql.php';
require_once __DIR__.'/../server/shared-stocktaking-finalize-service.php';
$pdo->exec(file_get_contents(__DIR__.'/../server/migrations/008-shared-stocktaking-finalize.sql'));
$pdo->exec("UPDATE product_stocks SET quantity=10 WHERE internal_code='FAKE-A' AND location_name='架空倉庫'");
$initial=inventory($pdo);
reject(fn()=>previewSharedStocktakingFinalize($pdo,$worker,uuid(1)),403);
reject(fn()=>finalizeSharedStocktaking($pdo,[],$worker),403);
$start2=array_replace($start,['request_id'=>uuid(20)]);writeSharedStocktaking($pdo,$start2,$admin);
reject(fn()=>previewSharedStocktakingFinalize($pdo,$admin,uuid(20)),409);
check(inventory($pdo)===$initial,'Preview or incomplete count changed inventory');
$preview=previewSharedStocktakingFinalize($pdo,$admin,uuid(1));
check($preview['summary']===['target'=>2,'checked'=>2,'unchecked'=>0,'match'=>0,'shortage'=>1,'surplus'=>1],'Preview counts wrong');
$final=['action'=>'finalize','request_id'=>uuid(21),'stocktaking_id'=>uuid(1),'preview_token'=>$preview['preview_token']];
reject(fn()=>finalizeSharedStocktaking($pdo,array_replace($final,['preview_token'=>'bad']),$admin),400);
// A saved quantity changed after preview: no stale count may reach stock.
writeSharedStocktaking($pdo,array_replace($save,['request_id'=>uuid(22),'expected_version'=>2,'counted_stock'=>0]),$worker);
reject(fn()=>finalizeSharedStocktaking($pdo,$final,$admin),409);
check(inventory($pdo)===$initial,'Stale preview changed stock');
$preview=previewSharedStocktakingFinalize($pdo,$admin,uuid(1));$final['preview_token']=$preview['preview_token'];
$pdo->exec("UPDATE product_stocks SET quantity=11 WHERE internal_code='FAKE-A' AND location_name='架空倉庫'");
reject(fn()=>previewSharedStocktakingFinalize($pdo,$admin,uuid(1)),409);
reject(fn()=>finalizeSharedStocktaking($pdo,$final,$admin),409);
$pdo->exec("UPDATE product_stocks SET quantity=10 WHERE internal_code='FAKE-A' AND location_name='架空倉庫'");
// A real stock operation followed by its reversal invalidates the preview even
// when quantities and second-resolution stock timestamps have returned unchanged.
$preview=previewSharedStocktakingFinalize($pdo,$admin,uuid(1));$final['preview_token']=$preview['preview_token'];
$pdo->exec("INSERT INTO stock_transactions (internal_code,product_name,transaction_type,quantity,before_stock,after_stock) VALUES ('FAKE-A','架空商品A','入庫',1,15,16),('FAKE-A','架空商品A','出庫',-1,16,15)");
reject(fn()=>finalizeSharedStocktaking($pdo,$final,$admin),409);
$before=inventory($pdo);$preview=previewSharedStocktakingFinalize($pdo,$admin,uuid(1));$final['preview_token']=$preview['preview_token'];
// Fault on the second product history insert: all stocks, first history, audit,
// receipt and status must roll back together.
$pdo->exec("CREATE TRIGGER fake_finalize_failure BEFORE INSERT ON stock_transactions FOR EACH ROW BEGIN IF NEW.internal_code='FAKE-B' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='FAKE_FINALIZE_ROLLBACK'; END IF; END");
try{finalizeSharedStocktaking($pdo,$final,$admin);throw new RuntimeException('Expected finalize failure');}catch(PDOException $e){check(str_contains($e->getMessage(),'FAKE_FINALIZE_ROLLBACK'),'Unexpected error');}
check(inventory($pdo)===$before,'Partial inventory/history update escaped rollback');
check(readSharedStocktaking($pdo,$admin,uuid(1))['session']['status']==='draft','Failed finalize changed status');
check($pdo->query('SELECT COUNT(*) FROM shared_stocktaking_finalizations')->fetchColumn()==0,'Failed audit survived');
check($pdo->query("SELECT COUNT(*) FROM shared_stocktaking_requests WHERE request_id='".uuid(21)."'")->fetchColumn()==0,'Failed receipt survived');
$pdo->exec('DROP TRIGGER fake_finalize_failure');
// A second connection holding the draft lock prevents a finalization from
// slipping past a concurrent save. Timeout must roll back its new receipt.
$second=new PDO(getenv('STOCK_CSV_TEST_DSN')?:'mysql:host=127.0.0.1;dbname=inventory_csv_test;charset=utf8mb4',getenv('STOCK_CSV_TEST_USER')?:'root',getenv('STOCK_CSV_TEST_PASSWORD')?:'test-only',[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
$second->beginTransaction();$second->query("SELECT id FROM shared_stocktakings WHERE id='".uuid(1)."' FOR UPDATE")->fetchAll();
$pdo->exec('SET SESSION innodb_lock_wait_timeout=1');
try{finalizeSharedStocktaking($pdo,$final,$admin);throw new RuntimeException('Expected draft lock timeout');}catch(PDOException $e){check(($e->errorInfo[1]??null)===1205,'Unexpected concurrent lock failure');}finally{$second->rollBack();}
check(!$pdo->inTransaction()&&inventory($pdo)===$before,'Timed out finalize leaked transaction or stock');
$done=finalizeSharedStocktaking($pdo,$final,$admin);
check($done['changed_count']===2&&$done['status']==='finalized','Finalize result wrong');
check($pdo->query("SELECT quantity FROM product_stocks WHERE internal_code='FAKE-A' AND location_name='架空倉庫'")->fetchColumn()==0,'Confirmed zero not applied');
check($pdo->query("SELECT quantity FROM product_stocks WHERE internal_code='FAKE-B' AND location_name='架空倉庫'")->fetchColumn()==2,'Duplicate JAN merged');
check($pdo->query("SELECT quantity FROM product_stocks WHERE internal_code='FAKE-A' AND location_name='別の架空倉庫'")->fetchColumn()==5,'Other location changed');
$history=$pdo->query("SELECT * FROM stock_transactions WHERE transaction_type='棚卸調整' ORDER BY id")->fetchAll();
check(count($history)===2&&$history[0]['quantity']==-10&&$history[0]['before_stock']==15&&$history[0]['after_stock']==5,'Aggregate history incorrect');
check($history[1]['quantity']==2&&$history[1]['before_stock']==0&&$history[1]['after_stock']==2,'Surplus history incorrect');
check(str_contains($history[0]['memo'],uuid(1))&&$history[0]['reason']==='棚卸確定','Audit linkage missing');
$after=inventory($pdo);check(finalizeSharedStocktaking($pdo,$final,$admin)['replayed']===true,'Lost response replay failed');
check(inventory($pdo)===$after,'Replay wrote inventory twice');
reject(fn()=>finalizeSharedStocktaking($pdo,array_replace($final,['request_id'=>uuid(23)]),$admin),409);
reject(fn()=>finalizeSharedStocktaking($pdo,$final,['id'=>9,'role'=>'admin']),409);
reject(fn()=>writeSharedStocktaking($pdo,array_replace($save,['request_id'=>uuid(24),'expected_version'=>3]),$worker),409);
$sessions=readSharedStocktaking($pdo,$worker)['sessions'];check(count(array_filter($sessions,fn($s)=>$s['id']===uuid(1)&&$s['status']==='finalized'))===1,'Finalized result not viewable');
check($pdo->query('SELECT COUNT(*) FROM shared_stocktaking_finalizations')->fetchColumn()==1,'Duplicate audit');
// A no-difference count confirms with no fake stock movement.
foreach(['FAKE-A'=>0,'FAKE-B'=>2]as$code=>$qty)writeSharedStocktaking($pdo,['action'=>'save','request_id'=>uuid($code==='FAKE-A'?25:26),'stocktaking_id'=>uuid(20),'internal_code'=>$code,'expected_version'=>0,'counted_stock'=>$qty,'memo'=>''],$admin);
// This older draft still has its original stock and must reject rather than rebase.
reject(fn()=>previewSharedStocktakingFinalize($pdo,$admin,uuid(20)),409);
writeSharedStocktaking($pdo,array_replace($start,['request_id'=>uuid(30)]),$admin);
foreach(['FAKE-A'=>0,'FAKE-B'=>2]as$code=>$qty)writeSharedStocktaking($pdo,['action'=>'save','request_id'=>uuid($code==='FAKE-A'?31:32),'stocktaking_id'=>uuid(30),'internal_code'=>$code,'expected_version'=>0,'counted_stock'=>$qty,'memo'=>''],$admin);
$p=previewSharedStocktakingFinalize($pdo,$admin,uuid(30));$before=inventory($pdo);
check(finalizeSharedStocktaking($pdo,['action'=>'finalize','request_id'=>uuid(33),'stocktaking_id'=>uuid(30),'preview_token'=>$p['preview_token']],$admin)['changed_count']===0,'Unchanged items treated as adjustment');
check(inventory($pdo)===$before,'No-difference finalize wrote inventory');
echo "PASS finalize: admin only, incomplete blocked, stale counts/stocks/reversal blocked, complete rollback, confirmed zero, duplicate JAN, other locations preserved, adjustment history, durable receipt replay, one-time status, read-only finalized, no-difference\n";
