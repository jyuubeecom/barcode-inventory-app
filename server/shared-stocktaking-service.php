<?php
declare(strict_types=1);
require_once __DIR__.'/stock-csv-service.php';

function sharedStocktakingUuid($value): string
{
    if (!is_string($value) || !preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/D', $value)) {
        throw new StockCsvError('棚卸番号・操作番号を確認してください。');
    }
    return $value;
}

function sharedStocktakingAccess(PDO $pdo, array $user): void
{
    if (empty($user['id']) || !in_array($user['role'] ?? '', ['admin','worker'], true)) throw new StockCsvError('ログインが必要です。',403);
    if ($pdo->inTransaction()) throw new StockCsvError('実行中の処理を完了してください。',409);
    $tables=$pdo->query("SELECT TABLE_NAME,ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN ('products','product_stocks','shared_stocktakings','shared_stocktaking_items','shared_stocktaking_requests')")->fetchAll(PDO::FETCH_KEY_PAIR);
    if (count($tables)!==5 || array_filter($tables,fn($engine)=>strtoupper((string)$engine)!=='INNODB')) throw new StockCsvError('共有棚卸のサーバー準備が必要です。',503);
}

function readSharedStocktaking(PDO $pdo, array $user, ?string $id=null): array
{
    sharedStocktakingAccess($pdo,$user);
    if ($id!==null) sharedStocktakingUuid($id);
    $pdo->exec('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY');
    $pdo->beginTransaction();
    try {
        if ($id===null) {
            $locations=$pdo->query('SELECT DISTINCT location_name FROM product_stocks ORDER BY location_name LIMIT 301')->fetchAll(PDO::FETCH_COLUMN);
            if (count($locations)>300) throw new StockCsvError('保管場所が300件を超えています。',413);
            // Counts use the same snapshot as the draft list.
            $sessions=$pdo->query("SELECT s.*,COUNT(i.internal_code) AS item_count,SUM(i.counted_stock IS NOT NULL) AS checked_count FROM shared_stocktakings s JOIN shared_stocktaking_items i ON i.stocktaking_id=s.id WHERE s.status='draft' GROUP BY s.id ORDER BY s.created_at DESC,s.id DESC LIMIT 100")->fetchAll(PDO::FETCH_ASSOC);
            foreach ($sessions as &$s) { $s['item_count']=(int)$s['item_count'];$s['checked_count']=(int)$s['checked_count']; } unset($s);
            $result=['success'=>true,'format'=>'inventory-shared-stocktaking-v1','locations'=>$locations,'sessions'=>$sessions];
        } else {
            $q=$pdo->prepare('SELECT * FROM shared_stocktakings WHERE id=?');$q->execute([$id]);$session=$q->fetch(PDO::FETCH_ASSOC);
            if (!$session) throw new StockCsvError('棚卸が見つかりません。再読み込みしてください。',404);
            $q=$pdo->prepare('SELECT * FROM shared_stocktaking_items WHERE stocktaking_id=? ORDER BY internal_code LIMIT 5001');$q->execute([$id]);$items=$q->fetchAll(PDO::FETCH_ASSOC);
            if (count($items)>5000) throw new StockCsvError('棚卸対象が5000件を超えています。',413);
            foreach ($items as &$item) {
                $item['registered_stock']=(int)$item['registered_stock'];$item['version']=(int)$item['version'];
                $item['counted_stock']=$item['counted_stock']===null?null:(int)$item['counted_stock'];
            } unset($item);
            $result=['success'=>true,'format'=>'inventory-shared-stocktaking-v1','session'=>$session,'items'=>$items];
        }
        $pdo->commit();return $result;
    } catch (Throwable $e) { if ($pdo->inTransaction()) $pdo->rollBack();throw $e; }
}

function sharedStocktakingRequest(array $input): array
{
    $r=['request_id'=>sharedStocktakingUuid($input['request_id']??null),'action'=>$input['action']??null];
    if ($r['action']==='start') {
        $date=$input['stocktaking_date']??null;
        if (!is_string($date)||!preg_match('/^(\d{4})-(\d{2})-(\d{2})$/D',$date,$parts)||!checkdate((int)$parts[2],(int)$parts[3],(int)$parts[1])) throw new StockCsvError('棚卸日を確認してください。');
        $r['stocktaking_date']=$date;$r['location_name']=stockCsvText($input['location_name']??null,100);
    } elseif ($r['action']==='save') {
        $r['stocktaking_id']=sharedStocktakingUuid($input['stocktaking_id']??null);
        $r['internal_code']=stockCsvText($input['internal_code']??null,50);
        $r['expected_version']=stockCsvInteger($input['expected_version']??null,1000000000);
        $r['counted_stock']=stockCsvInteger($input['counted_stock']??null,1000000000);
        $memo=$input['memo']??'';
        if (!is_string($memo)||mb_strlen($memo)>1000||preg_match('/[\x00]/u',$memo)) throw new StockCsvError('メモは1000文字以内にしてください。');
        $r['memo']=$memo;
    } else throw new StockCsvError('棚卸の操作を確認してください。');
    return $r;
}

// Only draft records are writable. There is deliberately no finalize/apply action.
function writeSharedStocktaking(PDO $pdo, array $input, array $user): array
{
    sharedStocktakingAccess($pdo,$user);$r=sharedStocktakingRequest($input);
    $hash=hash('sha256',json_encode($r,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR));
    $operator=mb_substr((string)($user['display_name']??$user['username']??'担当者'),0,100);
    $pdo->exec('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ WRITE');$pdo->beginTransaction();
    try {
        try {
            $q=$pdo->prepare("INSERT INTO shared_stocktaking_requests (request_id,user_id,request_hash,result_json) VALUES (?,?,?,'{}')");$q->execute([$r['request_id'],(int)$user['id'],$hash]);
        } catch (PDOException $e) {
            if (($e->errorInfo[1]??null)!==1062) throw $e;
            $q=$pdo->prepare('SELECT * FROM shared_stocktaking_requests WHERE request_id=? FOR UPDATE');$q->execute([$r['request_id']]);$saved=$q->fetch(PDO::FETCH_ASSOC);
            if (!$saved||(int)$saved['user_id']!==(int)$user['id']||!hash_equals($saved['request_hash'],$hash)) throw new StockCsvError('操作番号が別の内容に使われています。',409);
            $result=json_decode($saved['result_json'],true,64,JSON_THROW_ON_ERROR);$pdo->commit();return $result+['replayed'=>true];
        }
        if ($r['action']==='start') {
            // Never accept an inventory snapshot from the browser or local backup.
            $q=$pdo->prepare('SELECT p.internal_code,p.product_code,p.product_name,p.jan_code,ps.quantity FROM products p JOIN product_stocks ps ON ps.internal_code=p.internal_code WHERE ps.location_name=? ORDER BY p.internal_code LIMIT 5001');$q->execute([$r['location_name']]);$items=$q->fetchAll(PDO::FETCH_ASSOC);
            if (!$items) throw new StockCsvError('この保管場所には棚卸対象の商品がありません。',409);
            if (count($items)>5000) throw new StockCsvError('棚卸対象が5000件を超えています。',413);
            $id=$r['request_id'];
            $q=$pdo->prepare('INSERT INTO shared_stocktakings (id,stocktaking_date,location_name,created_by,operator_name) VALUES (?,?,?,?,?)');$q->execute([$id,$r['stocktaking_date'],$r['location_name'],(int)$user['id'],$operator]);
            $q=$pdo->prepare("INSERT INTO shared_stocktaking_items (stocktaking_id,internal_code,product_code,product_name,jan_code,registered_stock,memo) VALUES (?,?,?,?,?,?,'')");
            foreach ($items as $item) {
                $stock=stockCsvInteger((int)$item['quantity'],1000000000);
                $q->execute([$id,$item['internal_code'],$item['product_code'],$item['product_name'],$item['jan_code'],$stock]);
            }
            $result=['success'=>true,'request_id'=>$r['request_id'],'stocktaking_id'=>$id,'item_count'=>count($items)];
        } else {
            $q=$pdo->prepare('SELECT status FROM shared_stocktakings WHERE id=? FOR UPDATE');$q->execute([$r['stocktaking_id']]);
            if ($q->fetchColumn()!=='draft') throw new StockCsvError('保存可能な棚卸がありません。再読み込みしてください。',409);
            $q=$pdo->prepare('SELECT version FROM shared_stocktaking_items WHERE stocktaking_id=? AND internal_code=? FOR UPDATE');$q->execute([$r['stocktaking_id'],$r['internal_code']]);$version=$q->fetchColumn();
            if ($version===false||(int)$version!==$r['expected_version']) throw new StockCsvError('他の端末でこの商品が更新されました。再読み込みして数量を確認してください。',409);
            $q=$pdo->prepare('UPDATE shared_stocktaking_items SET counted_stock=?,memo=?,counted_by=?,version=version+1,updated_at=NOW() WHERE stocktaking_id=? AND internal_code=?');
            $q->execute([$r['counted_stock'],$r['memo'],$operator,$r['stocktaking_id'],$r['internal_code']]);
            $result=['success'=>true,'request_id'=>$r['request_id'],'stocktaking_id'=>$r['stocktaking_id'],'internal_code'=>$r['internal_code'],'counted_stock'=>$r['counted_stock'],'memo'=>$r['memo'],'counted_by'=>$operator,'version'=>$r['expected_version']+1];
        }
        $q=$pdo->prepare('UPDATE shared_stocktaking_requests SET result_json=? WHERE request_id=?');$q->execute([json_encode($result,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR),$r['request_id']]);
        $pdo->commit();return $result;
    } catch (Throwable $e) { if ($pdo->inTransaction()) $pdo->rollBack();throw $e; }
}
