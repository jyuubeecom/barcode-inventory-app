<?php
declare(strict_types=1);
require_once __DIR__ . '/stock-csv-service.php';

function migrationPreviewFields(): array
{
    return ['product_code'=>100,'product_name'=>255,'jan_code'=>50,'color'=>100,'category'=>100,'supplier_name'=>255,'unit'=>50,'product_status'=>50,'memo'=>10000];
}
function migrationPreviewProducts(array $input): array
{
    if (($input['action'] ?? '') !== 'preview') throw new StockCsvError('このAPIは移行前の照合専用です。');
    $items = $input['products'] ?? null;
    if (!is_array($items) || !array_is_list($items) || count($items) < 1 || count($items) > 1000) throw new StockCsvError('商品は1～1000件で指定してください。');
    $products = []; $seen = [];
    foreach ($items as $item) {
        if (!is_array($item)) throw new StockCsvError('商品の形式を確認してください。');
        $code = stockCsvText($item['internal_code'] ?? null, 50);
        if (isset($seen[$code])) throw new StockCsvError('社内コードが重複しています。');
        $seen[$code] = true; $product = ['internal_code'=>$code];
        foreach (migrationPreviewFields() as $field=>$length) {
            $value = $item[$field] ?? null;
            if (!is_string($value) || mb_strlen($value) > $length || strpos($value, "\0") !== false) throw new StockCsvError('商品項目の形式・長さを確認してください。');
            if ($field !== 'memo' && ($value !== trim($value) || preg_match('/[\x00-\x1f\x7f]/u', $value))) throw new StockCsvError('商品項目の空白・制御文字を確認してください。');
            if ($field === 'product_name' && $value === '') throw new StockCsvError('商品名が必要です。');
            $product[$field] = $value;
        }
        if (!in_array($product['product_status'], ['通常商品','廃盤','廃盤予定','専用商品','注残'], true)) throw new StockCsvError('商品状態の対応を確認してください。');
        $product['min_stock'] = stockCsvInteger($item['min_stock'] ?? null, 1000000000);
        if (!isset($item['stocks']) || !is_array($item['stocks']) || !array_is_list($item['stocks'])) throw new StockCsvError('場所別在庫を確認してください。');
        $product['stocks'] = stockCsvSnapshot($item['stocks']);
        $products[] = $product;
    }
    usort($products, fn($a,$b)=>strcmp($a['internal_code'],$b['internal_code']));
    return $products;
}

function previewInventoryMigration(PDO $pdo, array $input, array $user): array
{
    if (($user['role'] ?? '') !== 'admin' || empty($user['id'])) throw new StockCsvError('管理者ログインが必要です。',403);
    $products = migrationPreviewProducts($input);
    if ($pdo->inTransaction()) throw new StockCsvError('既存の処理が完了してから照合してください。',409);
    // One consistent read-only snapshot: no row locks, no receipt, no inventory/history writes.
    $pdo->exec('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY');
    $pdo->beginTransaction();
    try {
        $count = (int)$pdo->query('SELECT COUNT(*) FROM products')->fetchColumn();
        if ($count > 10000) throw new StockCsvError('サーバー商品が1万件を超えています。照合方法を見直してください。',409);
        $serverCodes = $pdo->query('SELECT internal_code FROM products ORDER BY internal_code')->fetchAll(PDO::FETCH_COLUMN);
        $weights = [];
        $weightQuery = $pdo->prepare('SELECT HEX(WEIGHT_STRING(CONVERT(? USING utf8mb4) COLLATE utf8mb4_unicode_ci))');
        foreach ($products as $source) {
            $weightQuery->execute([$source['internal_code']]); $weight = $weightQuery->fetchColumn();
            if (isset($weights[$weight])) throw new StockCsvError('サーバーの照合規則で同じになる社内コードが混在しています。',409);
            $weights[$weight] = true;
        }
        $matched = []; $rows = []; $summary = ['new'=>0,'same'=>0,'different'=>0,'code_conflict'=>0,'fixed_status_conflict'=>0,'server_only'=>0];
        $snapshot = [];
        foreach ($products as $source) {
            $code = $source['internal_code'];
            $stmt = $pdo->prepare('SELECT internal_code,product_code,product_name,jan_code,color,category,supplier_name,unit,min_stock,product_status,memo FROM products WHERE internal_code=?');
            $stmt->execute([$code]); $saved = $stmt->fetch(PDO::FETCH_ASSOC);
            $row = ['internal_code'=>$code,'source_stock'=>array_sum(array_column($source['stocks'],'quantity')),'server_stock'=>null,'differences'=>[],'fixed_status_conflict'=>false];
            if (!$saved) {
                $row['result']='new';
                $row['source_status']=$source['product_status'];
                $row['server_status']=null;
                $snapshot[] = ['source'=>$source,'server'=>null];
            } else {
                $canonical = $saved['internal_code']; $matched[$canonical]=true;
                $stmt = $pdo->prepare('SELECT location_name,quantity FROM product_stocks WHERE internal_code=? ORDER BY location_name');
                $stmt->execute([$canonical]); $stocks = stockCsvSnapshot($stmt->fetchAll(PDO::FETCH_ASSOC),true);
                $row['server_stock']=array_sum(array_column($stocks,'quantity'));
                $row['source_status']=$source['product_status']; $row['server_status']=$saved['product_status'];
                $row['server_code']=$canonical;
                foreach (migrationPreviewFields() as $field=>$unused) if ($source[$field] !== (string)($saved[$field] ?? '')) $row['differences'][]=$field;
                if ($source['min_stock'] !== (int)$saved['min_stock']) $row['differences'][]='min_stock';
                if ($source['stocks'] !== $stocks) $row['differences'][]='stocks';
                $row['result']=$code !== $canonical ? 'code_conflict' : ($row['differences'] ? 'different' : 'same');
                if ($source['product_status'] !== $saved['product_status'] && (in_array($source['product_status'],['専用商品','廃盤予定'],true) || in_array($saved['product_status'],['専用商品','廃盤予定'],true))) {
                    $row['fixed_status_conflict']=true; $summary['fixed_status_conflict']++;
                }
                $snapshot[]=['source'=>$source,'server'=>$saved,'stocks'=>$stocks];
            }
            $summary[$row['result']]++; $rows[]=$row;
        }
        $serverOnly = array_values(array_filter($serverCodes,fn($code)=>!isset($matched[$code])));
        $summary['server_only']=count($serverOnly);
        $hash = hash('sha256',json_encode([$snapshot,$serverOnly],JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE));
        $pdo->commit();
        return ['success'=>true,'preview_only'=>true,'migrated'=>false,'comparison_sha256'=>$hash,'summary'=>$summary,'rows'=>$rows,
            'server_only_codes'=>$serverOnly,'message'=>'照合だけを行いました。商品・在庫・履歴は変更していません。'];
    } catch (Throwable $e) { if ($pdo->inTransaction()) $pdo->rollBack(); throw $e; }
}
