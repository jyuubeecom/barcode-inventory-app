<?php
declare(strict_types=1);
require_once __DIR__.'/stock-csv-service.php';

function sharedStockOperationRequest(array $input): array
{
    $id=$input['request_id']??null;
    if (!is_string($id)||!preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/D',$id)) throw new StockCsvError('操作番号が不正です。');
    $action=$input['action']??null;
    if (!in_array($action,['in','out'],true)) throw new StockCsvError('入庫・出庫を指定してください。');
    $quantity=stockCsvInteger($input['quantity']??null,1000000);
    if (!$quantity) throw new StockCsvError('数量は1～1000000の整数にしてください。');
    $expected=$input['expected_stocks']??null;
    if (!is_array($expected)||!array_is_list($expected)) throw new StockCsvError('商品詳細を再取得してください。');
    $memo=$input['memo']??'';
    if (!is_string($memo)||mb_strlen($memo)>5000||preg_match('/[\x00]/u',$memo)) throw new StockCsvError('メモを確認してください。');
    return ['request_id'=>$id,'action'=>$action,'internal_code'=>stockCsvText($input['internal_code']??null,50),
        'location_name'=>stockCsvText($input['location_name']??null,100),'quantity'=>$quantity,
        'reason'=>stockCsvText($input['reason']??null,100),'memo'=>$memo,'expected_stocks'=>stockCsvSnapshot($expected)];
}

function applySharedStockOperation(PDO $pdo,array $input,array $user): array
{
    if (empty($user['id'])||!in_array($user['role']??'',['admin','worker'],true)) throw new StockCsvError('ログインが必要です。',403);
    $r=sharedStockOperationRequest($input);
    $hash=hash('sha256',json_encode($r,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR));
    if ($pdo->inTransaction()) throw new StockCsvError('処理中です。',409);
    $tables=$pdo->query("SELECT TABLE_NAME,ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN ('products','product_stocks','stock_transactions','shared_stock_operation_batches')")->fetchAll(PDO::FETCH_KEY_PAIR);
    if (count($tables)!==4||array_filter($tables,fn($v)=>strtoupper((string)$v)!=='INNODB')) throw new StockCsvError('入出庫用テーブルの準備を確認してください。',503);
    $pdo->exec('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ WRITE');
    $pdo->beginTransaction();
    try {
        try {
            $s=$pdo->prepare("INSERT INTO shared_stock_operation_batches (request_id,user_id,request_hash,before_json,result_json) VALUES (?,?,?,'[]','{}')");
            $s->execute([$r['request_id'],(int)$user['id'],$hash]);
        } catch (PDOException $e) {
            if (($e->errorInfo[1]??null)!==1062) throw $e;
            $s=$pdo->prepare('SELECT user_id,request_hash,result_json FROM shared_stock_operation_batches WHERE request_id=? FOR UPDATE');$s->execute([$r['request_id']]);$saved=$s->fetch(PDO::FETCH_ASSOC);
            if (!$saved||(int)$saved['user_id']!==(int)$user['id']||!hash_equals($saved['request_hash'],$hash)) throw new StockCsvError('操作番号が別の内容に使われています。',409);
            $result=json_decode($saved['result_json'],true,512,JSON_THROW_ON_ERROR);$pdo->commit();return $result+['replayed'=>true];
        }
        $s=$pdo->prepare('SELECT internal_code,product_code,product_name,jan_code,product_status FROM products WHERE internal_code=? FOR UPDATE');$s->execute([$r['internal_code']]);$p=$s->fetch(PDO::FETCH_ASSOC);
        if (!$p||$p['internal_code']!==$r['internal_code']) throw new StockCsvError('商品が変わっています。商品詳細を再取得してください。',409);
        if ($r['action']==='in'&&$p['product_status']==='廃盤') throw new StockCsvError('廃盤の商品には入庫できません。',409);
        $s=$pdo->prepare('SELECT location_name,quantity FROM product_stocks WHERE internal_code=? ORDER BY location_name FOR UPDATE');$s->execute([$r['internal_code']]);$stocks=stockCsvSnapshot($s->fetchAll(PDO::FETCH_ASSOC),true);
        if ($stocks!==$r['expected_stocks']) throw new StockCsvError('他の操作で在庫が変わりました。商品詳細を再取得し、数量を確認してください。',409);
        $i=array_search($r['location_name'],array_column($stocks,'location_name'),true);
        if ($i===false&&!in_array($r['location_name'],array_merge(['本社'],stockCsvLocations()),true)) throw new StockCsvError('入庫先の保管場所を確認してください。');
        $old=$i===false?0:$stocks[$i]['quantity'];$delta=$r['action']==='in'?$r['quantity']:-$r['quantity'];$next=$old+$delta;
        $before=array_sum(array_column($stocks,'quantity'));$after=$before+$delta;
        if ($next<0) throw new StockCsvError('保管場所の在庫が不足しています。',409);
        if ($next>1000000000||$after>1000000000) throw new StockCsvError('在庫数の上限を超えます。');
        if ($i===false) {
            $s=$pdo->prepare('INSERT INTO product_stocks (internal_code,location_name,quantity) VALUES (?,?,?)');$s->execute([$p['internal_code'],$r['location_name'],$next]);
        } else {
            $s=$pdo->prepare('UPDATE product_stocks SET quantity=?,updated_at=NOW() WHERE internal_code=? AND location_name=?');$s->execute([$next,$p['internal_code'],$r['location_name']]);
        }
        $operator=mb_substr((string)($user['display_name']??$user['username']??'担当者'),0,100);
        $s=$pdo->prepare('INSERT INTO stock_transactions (internal_code,product_code,product_name,jan_code,transaction_type,quantity,before_stock,after_stock,location_name,operator_name,reason,memo) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)');
        $s->execute([$p['internal_code'],$p['product_code'],$p['product_name'],$p['jan_code'],$r['action']==='in'?'入庫':'出庫',$delta,$before,$after,$r['location_name'],$operator,$r['reason'],$r['memo']."\n操作番号: ".$r['request_id']]);
        $result=['success'=>true,'request_id'=>$r['request_id'],'transaction_id'=>(int)$pdo->lastInsertId(),'location_name'=>$r['location_name'],'location_stock_before'=>$old,'location_stock_after'=>$next,'stock_before'=>$before,'stock_after'=>$after];
        $s=$pdo->prepare('UPDATE shared_stock_operation_batches SET before_json=?,result_json=? WHERE request_id=?');
        $s->execute([json_encode(['product'=>$p,'stocks'=>$stocks],JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR),json_encode($result,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR),$r['request_id']]);
        $pdo->commit();return $result;
    } catch (Throwable $e) {if ($pdo->inTransaction()) $pdo->rollBack();throw $e;}
}
