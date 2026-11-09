<?php
declare(strict_types=1);
require_once __DIR__.'/shared-stocktaking-service.php';

function sharedStocktakingFinalizeAccess(PDO $pdo, array $user): void
{
    sharedStocktakingAccess($pdo,$user);
    if (($user['role']??'')!=='admin') throw new StockCsvError('棚卸の確定・在庫反映は管理者専用です。',403);
    $tables=$pdo->query("SELECT TABLE_NAME,ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN ('stock_transactions','shared_stocktaking_finalizations')")->fetchAll(PDO::FETCH_KEY_PAIR);
    if (count($tables)!==2 || array_filter($tables,fn($e)=>strtoupper((string)$e)!=='INNODB')) throw new StockCsvError('棚卸確定用のサーバー準備が必要です。',503);
}

// Preview and commit share this exact projection. In a write transaction, lock
// session first, then products/stocks in a stable order shared with stock operations.
function sharedStocktakingFinalizeSnapshot(PDO $pdo, string $id, bool $lock): array
{
    $suffix=$lock?' FOR UPDATE':'';
    $q=$pdo->prepare('SELECT * FROM shared_stocktakings WHERE id=?'.$suffix);$q->execute([$id]);$session=$q->fetch(PDO::FETCH_ASSOC);
    if (!$session || $session['status']!=='draft') throw new StockCsvError('この棚卸は確定済み、または見つかりません。再読み込みしてください。',409);
    $q=$pdo->prepare('SELECT * FROM shared_stocktaking_items WHERE stocktaking_id=? ORDER BY internal_code LIMIT 5001'.$suffix);$q->execute([$id]);$items=$q->fetchAll(PDO::FETCH_ASSOC);
    if (!$items || count($items)>5000) throw new StockCsvError('棚卸対象を確認してください。',409);
    $counts=['target'=>count($items),'checked'=>0,'unchecked'=>0,'match'=>0,'shortage'=>0,'surplus'=>0];$rows=[];
    foreach ($items as $item) {
        if ($item['counted_stock']===null) throw new StockCsvError('未確認の商品が残っています。すべての数量を保存してください。',409);
        $old=stockCsvInteger((int)$item['registered_stock'],1000000000);$next=stockCsvInteger((int)$item['counted_stock'],1000000000);
        $q=$pdo->prepare('SELECT * FROM products WHERE internal_code=?'.$suffix);$q->execute([$item['internal_code']]);$product=$q->fetch(PDO::FETCH_ASSOC);
        if (!$product || $product['internal_code']!==$item['internal_code']) throw new StockCsvError('対象商品が変更・削除されています。棚卸をやり直してください。',409);
        $q=$pdo->prepare('SELECT location_name,quantity,updated_at FROM product_stocks WHERE internal_code=? ORDER BY location_name'.$suffix);$q->execute([$item['internal_code']]);$stocks=$q->fetchAll(PDO::FETCH_ASSOC);
        $target=array_search($session['location_name'],array_column($stocks,'location_name'),true);
        if ($target===false || (int)$stocks[$target]['quantity']!==$old) throw new StockCsvError('棚卸開始後に対象の現在庫が変わっています。反映せず、在庫と棚卸内容を確認してください。',409);
        $snapshot=stockCsvSnapshot($stocks,true);$before=array_sum(array_column($snapshot,'quantity'));$after=$before+$next-$old;
        if ($after<0 || $after>1000000000) throw new StockCsvError('反映後の総在庫数が上限を超えます。',409);
        // A stock movement followed by its reversal must also invalidate a preview.
        $q=$pdo->prepare('SELECT id FROM stock_transactions WHERE internal_code=? ORDER BY id DESC LIMIT 1'.$suffix);$q->execute([$item['internal_code']]);$last=(string)($q->fetchColumn()?:0);
        $rows[]=['item'=>$item,'product'=>$product,'stocks'=>$stocks,'last_transaction_id'=>$last,'before_stock'=>$before,'after_stock'=>$after,'location_stock_before'=>$old,'location_stock_after'=>$next,'delta'=>$next-$old];
        $counts['checked']++;$counts[$next===$old?'match':($next<$old?'shortage':'surplus')]++;
    }
    $snapshot=['session'=>$session,'rows'=>$rows,'summary'=>$counts];
    $snapshot['token']=hash('sha256',json_encode($snapshot,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR));
    return $snapshot;
}

function previewSharedStocktakingFinalize(PDO $pdo,array $user,string $id): array
{
    sharedStocktakingFinalizeAccess($pdo,$user);sharedStocktakingUuid($id);
    $pdo->exec('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY');$pdo->beginTransaction();
    try {
        $snapshot=sharedStocktakingFinalizeSnapshot($pdo,$id,false);
        $rows=array_map(fn($r)=>['internal_code'=>$r['item']['internal_code'],'product_code'=>$r['item']['product_code'],'product_name'=>$r['item']['product_name'],'registered_stock'=>$r['location_stock_before'],'counted_stock'=>$r['location_stock_after'],'difference'=>$r['delta']],$snapshot['rows']);
        $pdo->commit();return ['success'=>true,'format'=>'inventory-stocktaking-finalize-preview-v1','stocktaking_id'=>$id,'preview_token'=>$snapshot['token'],'session'=>$snapshot['session'],'summary'=>$snapshot['summary'],'rows'=>$rows];
    } catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();throw $e;}
}

function finalizeSharedStocktaking(PDO $pdo,array $input,array $user): array
{
    sharedStocktakingFinalizeAccess($pdo,$user);
    $r=['action'=>'finalize','request_id'=>sharedStocktakingUuid($input['request_id']??null),'stocktaking_id'=>sharedStocktakingUuid($input['stocktaking_id']??null),'preview_token'=>$input['preview_token']??null];
    if (($input['action']??null)!=='finalize' || !is_string($r['preview_token']) || !preg_match('/^[0-9a-f]{64}$/D',$r['preview_token'])) throw new StockCsvError('反映内容を再確認してください。');
    $hash=hash('sha256',json_encode($r,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR));
    $operator=mb_substr((string)($user['display_name']??$user['username']??'管理者'),0,100);
    $pdo->exec('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ WRITE');$pdo->beginTransaction();
    try {
        try {
            $q=$pdo->prepare("INSERT INTO shared_stocktaking_requests (request_id,user_id,request_hash,result_json) VALUES (?,?,?,'{}')");$q->execute([$r['request_id'],(int)$user['id'],$hash]);
        } catch(PDOException $e) {
            if(($e->errorInfo[1]??null)!==1062)throw $e;
            $q=$pdo->prepare('SELECT * FROM shared_stocktaking_requests WHERE request_id=? FOR UPDATE');$q->execute([$r['request_id']]);$saved=$q->fetch(PDO::FETCH_ASSOC);
            if(!$saved || (int)$saved['user_id']!==(int)$user['id'] || !hash_equals($saved['request_hash'],$hash))throw new StockCsvError('操作番号が別の内容に使われています。',409);
            $result=json_decode($saved['result_json'],true,64,JSON_THROW_ON_ERROR);$pdo->commit();return $result+['replayed'=>true];
        }
        $snapshot=sharedStocktakingFinalizeSnapshot($pdo,$r['stocktaking_id'],true);
        if(!hash_equals($snapshot['token'],$r['preview_token']))throw new StockCsvError('確認後に棚卸内容または在庫が変わりました。反映内容を再確認してください。',409);
        $changed=0;
        foreach($snapshot['rows'] as $row){
            if($row['delta']===0)continue;
            $p=$row['product'];$location=$snapshot['session']['location_name'];
            $q=$pdo->prepare('UPDATE product_stocks SET quantity=?,updated_at=NOW() WHERE internal_code=? AND location_name=?');$q->execute([$row['location_stock_after'],$p['internal_code'],$location]);
            $q=$pdo->prepare('INSERT INTO stock_transactions (internal_code,product_code,product_name,jan_code,transaction_type,quantity,before_stock,after_stock,location_name,operator_name,reason,memo) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)');
            $q->execute([$p['internal_code'],$p['product_code'],$p['product_name'],$p['jan_code'],'棚卸調整',$row['delta'],$row['before_stock'],$row['after_stock'],$location,$operator,'棚卸確定',$row['item']['memo']."\n棚卸番号: ".$r['stocktaking_id']."\n操作番号: ".$r['request_id']]);$changed++;
        }
        $result=['success'=>true,'action'=>'finalize','request_id'=>$r['request_id'],'stocktaking_id'=>$r['stocktaking_id'],'preview_token'=>$r['preview_token'],'status'=>'finalized','changed_count'=>$changed,'summary'=>$snapshot['summary'],'operator_name'=>$operator];
        $json=json_encode($result,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR);
        $q=$pdo->prepare('INSERT INTO shared_stocktaking_finalizations (stocktaking_id,request_id,user_id,operator_name,before_json,result_json) VALUES (?,?,?,?,?,?)');$q->execute([$r['stocktaking_id'],$r['request_id'],(int)$user['id'],$operator,json_encode($snapshot,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR),$json]);
        $q=$pdo->prepare("UPDATE shared_stocktakings SET status='finalized' WHERE id=?");$q->execute([$r['stocktaking_id']]);
        $q=$pdo->prepare('UPDATE shared_stocktaking_requests SET result_json=? WHERE request_id=?');$q->execute([$json,$r['request_id']]);
        $pdo->commit();return $result;
    }catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();throw $e;}
}
