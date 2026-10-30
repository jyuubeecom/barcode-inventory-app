<?php
declare(strict_types=1);
require_once __DIR__ . '/migration-preview-service.php';

// Stage one: add missing products only. Existing differences must be reviewed separately.
function applyInventoryMigration(PDO $pdo, array $input, array $user): array
{
    if (($user['role'] ?? '') !== 'admin' || empty($user['id'])) throw new StockCsvError('管理者ログインが必要です。',403);
    if (($input['action'] ?? '') !== 'apply_new') throw new StockCsvError('未登録商品の追加だけを指定してください。');
    $id = $input['request_id'] ?? null;
    $expected = $input['comparison_sha256'] ?? null;
    if (!is_string($id) || !preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/D',$id) || !is_string($expected) || !preg_match('/^[0-9a-f]{64}$/D',$expected)) throw new StockCsvError('操作番号・照合結果を確認してください。');
    $products = migrationPreviewProducts(['action'=>'preview','products'=>$input['products'] ?? null]);
    $hash = hash('sha256',json_encode([$products,$expected],JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE));
    if ($pdo->inTransaction()) throw new StockCsvError('既存の処理が完了してから移行してください。',409);
    $engines=$pdo->query("SELECT TABLE_NAME,ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN ('products','product_stocks','stock_transactions','inventory_migration_batches')")->fetchAll(PDO::FETCH_KEY_PAIR);
    if (count($engines)!==4 || array_filter($engines,fn($engine)=>strtoupper((string)$engine)!=='INNODB')) throw new StockCsvError('移行用テーブルとInnoDBの設定を確認してください。',409);
    $pdo->exec('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ WRITE');
    $pdo->beginTransaction();
    try {
        try {
            $stmt=$pdo->prepare("INSERT INTO inventory_migration_batches (request_id,user_id,request_hash,before_json,result_json) VALUES (?,?,?,'[]','{}')");
            $stmt->execute([$id,(int)$user['id'],$hash]);
        } catch (PDOException $e) {
            if (($e->errorInfo[1] ?? null)!==1062) throw $e;
            $stmt=$pdo->prepare('SELECT user_id,request_hash,result_json FROM inventory_migration_batches WHERE request_id=? FOR UPDATE');
            $stmt->execute([$id]);$saved=$stmt->fetch(PDO::FETCH_ASSOC);
            if (!$saved || (int)$saved['user_id']!==(int)$user['id'] || !hash_equals($saved['request_hash'],$hash)) throw new StockCsvError('操作番号が別の移行に使われています。',409);
            $result=json_decode($saved['result_json'],true,512,JSON_THROW_ON_ERROR);
            $pdo->commit(); return $result+['replayed'=>true];
        }
        // A short, bounded global inventory lock also protects missing code ranges.
        // These locking reads happen before the first consistent read snapshot.
        $codes=$pdo->query('SELECT internal_code FROM products ORDER BY internal_code FOR UPDATE')->fetchAll(PDO::FETCH_COLUMN);
        if (count($codes)>10000) throw new StockCsvError('サーバー商品が1万件を超えています。',409);
        $pdo->query('SELECT internal_code,location_name FROM product_stocks ORDER BY internal_code,location_name FOR UPDATE')->fetchAll();
        $comparison=compareInventoryMigrationSnapshot($pdo,$products);
        if (!hash_equals($expected,$comparison['comparison_sha256'])) throw new StockCsvError('照合後に内容が変わっています。再照合してください。',409);
        if ($comparison['summary']['different'] || $comparison['summary']['code_conflict']) throw new StockCsvError('既存商品に差異があります。上書きせず移行を中止しました。',409);
        if (!$comparison['summary']['new']) throw new StockCsvError('追加する未登録商品がありません。',409);
        $newCodes=array_column(array_filter($comparison['rows'],fn($r)=>$r['result']==='new'),'internal_code');
        $newSet=array_fill_keys($newCodes,true); $before=[];
        foreach ($products as $product) {
            $code=$product['internal_code'];if (!isset($newSet[$code])) continue;
            $before[]=['internal_code'=>$code,'product'=>null,'stocks'=>[]];
            $fields=array_merge(['internal_code'],array_keys(migrationPreviewFields()),['min_stock']);
            $stmt=$pdo->prepare('INSERT INTO products ('.implode(',',$fields).') VALUES ('.implode(',',array_fill(0,count($fields),'?')).')');
            $stmt->execute(array_map(fn($key)=>$product[$key],$fields));
            $total=0;
            foreach ($product['stocks'] as $stock) {
                $stmt=$pdo->prepare('INSERT INTO product_stocks (internal_code,location_name,quantity) VALUES (?,?,?)');
                $stmt->execute([$code,$stock['location_name'],$stock['quantity']]);
                if (!$stock['quantity']) continue;
                $after=$total+$stock['quantity'];
                $stmt=$pdo->prepare('INSERT INTO stock_transactions (internal_code,product_code,product_name,jan_code,transaction_type,quantity,before_stock,after_stock,location_name,operator_name,reason,memo) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)');
                $operator=mb_substr((string)($user['display_name'] ?? $user['username'] ?? '管理者'),0,100);
                $stmt->execute([$code,$product['product_code'],$product['product_name'],$product['jan_code'],'初期移行',$stock['quantity'],$total,$after,$stock['location_name'],$operator,'商品・在庫の初期移行','操作番号: '.$id]);
                $total=$after;
            }
        }
        $result=['success'=>true,'migrated'=>true,'request_id'=>$id,'added'=>count($newCodes),'unchanged'=>$comparison['summary']['same'],'history_replayed'=>false,'message'=>'未登録の商品・場所別在庫と初期移行履歴を保存しました。既存商品と過去の売上は変更していません。'];
        $stmt=$pdo->prepare('UPDATE inventory_migration_batches SET before_json=?,result_json=? WHERE request_id=?');
        $stmt->execute([json_encode($before,JSON_THROW_ON_ERROR|JSON_UNESCAPED_UNICODE),json_encode($result,JSON_THROW_ON_ERROR|JSON_UNESCAPED_UNICODE),$id]);
        $pdo->commit();return $result;
    } catch (Throwable $e) { if ($pdo->inTransaction()) $pdo->rollBack();throw $e; }
}
