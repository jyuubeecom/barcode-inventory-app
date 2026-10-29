<?php
declare(strict_types=1);
require_once __DIR__ . '/stock-csv-service.php';

function salesCsvAdmin(array $user): void
{
    if (($user['role'] ?? '') !== 'admin' || empty($user['id'])) throw new StockCsvError('管理者ログインが必要です。', 403);
}

function salesCsvRequest(array $input): array
{
    $rows = $input['rows'] ?? null;
    if (!is_array($rows) || !array_is_list($rows) || count($rows) < 1 || count($rows) > 300) throw new StockCsvError('売上・返品は1～300行で指定してください。');
    $counts = []; $result = []; $codes = [];
    foreach ($rows as $source) {
        if (!is_array($source) || !array_is_list($source) || count($source) !== 12) throw new StockCsvError('売上CSVの12列を確認してください。');
        foreach ($source as $cell) {
            if (!is_string($cell)) throw new StockCsvError('CSVのセル形式が不正です。');
            if ($cell !== '') stockCsvText($cell, 255);
        }
        // Empty optional cells are allowed; required fields and numeric/date semantics are checked below.
        $code = stockCsvText($source[0], 50);
        $date = DateTimeImmutable::createFromFormat('!Y-m-d', $source[5]);
        if (!$date || $date->format('Y-m-d') !== $source[5] || $source[5] < '1900-01-01' || $source[5] > '9999-12-31') throw new StockCsvError('日付を確認してください。');
        if (!preg_match('/^-?[0-9]{1,7}$/D', $source[6]) || abs((int)$source[6]) > 1000000 || (int)$source[6] === 0) throw new StockCsvError('数量は0以外の整数（絶対値100万まで）で指定してください。');
        if (!in_array($source[11], ['売上', '返品'], true) || ($source[11] === '売上' && (int)$source[6] < 0)) throw new StockCsvError('売上は正数、返品は明細区分「返品」で指定してください。');
        $quantity = $source[11] === '返品' ? -abs((int)$source[6]) : (int)$source[6];
        $source[6] = (string)$quantity;
        $signature = hash('sha256', json_encode($source, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE));
        $occurrence = ($counts[$signature] ?? 0) + 1; $counts[$signature] = $occurrence;
        $id = hash('sha256', $signature . ':' . $occurrence);
        $result[] = ['id' => $id, 'code' => $code, 'quantity' => $quantity, 'source' => $source];
        $codes[$code] = true;
    }
    if (count($codes) > 100) throw new StockCsvError('商品数は100件までです。');
    return $result;
}

function salesCsvPriority(): array
{
    // The legacy 本社 row is physical stock on the existing server, alongside any detailed areas.
    return array_merge(['本社'], array_values(array_filter(stockCsvLocations(), fn($p) => str_starts_with($p, '本社'))), ['酒本倉庫1階', '酒本倉庫2階']);
}

// Caller owns the transaction. Lock products in a stable order, also used by other stock APIs.
function salesCsvPlan(PDO $pdo, array $rows, bool $lock): array
{
    $codes = array_values(array_unique(array_column($rows, 'code'))); sort($codes, SORT_STRING);
    $products = []; $snapshots = []; $canonical = [];
    foreach ($codes as $code) {
        $stmt = $pdo->prepare('SELECT internal_code,product_code,product_name,jan_code,product_status FROM products WHERE internal_code=?' . ($lock ? ' FOR UPDATE' : ''));
        $stmt->execute([$code]); $product = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$product) throw new StockCsvError('未登録の社内コードがあります: ' . $code, 409);
        if ($product['internal_code'] !== $code || isset($canonical[$product['internal_code']])) throw new StockCsvError('社内コードをサーバーの登録表記に合わせてください。', 409);
        $canonical[$code] = true;
        if (in_array(mb_strtolower(trim($product['product_status'])), ['廃盤', 'discontinued', 'inactive'], true)) throw new StockCsvError('廃盤商品は取り込めません: ' . $code, 409);
        $stmt = $pdo->prepare('SELECT location_name,quantity FROM product_stocks WHERE internal_code=? ORDER BY location_name' . ($lock ? ' FOR UPDATE' : ''));
        $stmt->execute([$code]); $stocks = stockCsvSnapshot($stmt->fetchAll(PDO::FETCH_ASSOC), true);
        $products[$code] = $product; $snapshots[$code] = $stocks;
    }
    $duplicates = []; $fresh = []; $net = [];
    foreach ($rows as $row) {
        $stmt = $pdo->prepare('SELECT row_id FROM sales_csv_rows WHERE row_id=?' . ($lock ? ' FOR UPDATE' : ''));
        $stmt->execute([$row['id']]);
        if ($stmt->fetchColumn() !== false) { $duplicates[] = $row['id']; continue; }
        $fresh[] = $row;
        $net[$row['code']] = ($net[$row['code']] ?? 0) + $row['quantity'];
    }
    sort($duplicates, SORT_STRING); ksort($net, SORT_STRING);
    $changes = [];
    foreach ($net as $code => $quantity) {
        $stocks = array_column($snapshots[$code], 'quantity', 'location_name');
        $before = array_sum($stocks); $after = $before - $quantity;
        if ($after < 0 || $after > 1000000000) throw new StockCsvError('在庫不足または在庫上限です: ' . $code, 409);
        $locationChanges = [];
        if ($quantity > 0) {
            $remaining = $quantity;
            foreach (salesCsvPriority() as $place) {
                $deduction = min($remaining, $stocks[$place] ?? 0);
                if ($deduction > 0) { $locationChanges[] = ['location_name' => $place, 'before' => $stocks[$place], 'after' => $stocks[$place] - $deduction]; $remaining -= $deduction; }
            }
            if ($remaining > 0) throw new StockCsvError('自動出庫の対象場所の在庫が不足しています: ' . $code, 409);
        } elseif ($quantity < 0) {
            $locationChanges[] = ['location_name' => '本社', 'before' => $stocks['本社'] ?? 0, 'after' => ($stocks['本社'] ?? 0) - $quantity];
        }
        $changes[] = ['internal_code' => $code, 'product_name' => $products[$code]['product_name'], 'quantity' => $quantity,
            'before' => $before, 'after' => $after, 'locations' => $locationChanges];
    }
    // A preview becomes stale if any inventory, product metadata, or duplicate decision changes.
    $hash = hash('sha256', json_encode([$rows, $products, $snapshots, $duplicates], JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE));
    return ['preview_hash' => $hash, 'imported_count' => count($fresh), 'duplicate_count' => count($duplicates), 'changes' => $changes,
        '_rows' => $fresh, '_products' => $products, '_before' => $snapshots];
}
function salesCsvPublicPlan(array $plan): array
{
    unset($plan['_rows'], $plan['_products'], $plan['_before']); return $plan;
}
function previewSalesCsv(PDO $pdo, array $input, array $user): array
{
    salesCsvAdmin($user); $rows = salesCsvRequest($input);
    $pdo->beginTransaction();
    try { $plan = salesCsvPlan($pdo, $rows, false); $pdo->commit(); return ['success' => true] + salesCsvPublicPlan($plan); }
    catch (Throwable $e) { if ($pdo->inTransaction()) $pdo->rollBack(); throw $e; }
}
function applySalesCsv(PDO $pdo, array $input, array $user): array
{
    salesCsvAdmin($user); $rows = salesCsvRequest($input);
    $id = $input['request_id'] ?? '';
    if (!is_string($id) || !preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/D', $id)) throw new StockCsvError('操作番号が不正です。');
    $previewHash = $input['preview_hash'] ?? '';
    if (!is_string($previewHash) || !preg_match('/^[0-9a-f]{64}$/D', $previewHash)) throw new StockCsvError('先に在庫を照合してください。');
    $fileName = stockCsvText($input['file_name'] ?? '', 255);
    $hash = hash('sha256', json_encode([$rows, $previewHash, $fileName], JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE));
    $pdo->beginTransaction();
    try {
        try {
            $stmt = $pdo->prepare("INSERT INTO sales_csv_batches (request_id,user_id,request_hash,file_name,before_json,result_json) VALUES (?,?,?,?,'{}','{}')");
            $stmt->execute([$id, (int)$user['id'], $hash, $fileName]);
        } catch (PDOException $e) {
            if (($e->errorInfo[1] ?? null) !== 1062) throw $e;
            $stmt = $pdo->prepare('SELECT user_id,request_hash,result_json FROM sales_csv_batches WHERE request_id=? FOR UPDATE');
            $stmt->execute([$id]); $saved = $stmt->fetch(PDO::FETCH_ASSOC);
            if (!$saved || (int)$saved['user_id'] !== (int)$user['id'] || !hash_equals($saved['request_hash'], $hash)) throw new StockCsvError('操作番号が別の内容に使用されています。', 409);
            $result = json_decode($saved['result_json'], true, 64, JSON_THROW_ON_ERROR); $pdo->commit(); return $result + ['replayed' => true];
        }
        $plan = salesCsvPlan($pdo, $rows, true);
        if (!hash_equals($plan['preview_hash'], $previewHash)) throw new StockCsvError('照合後に在庫・商品・取込状況が変わりました。全件を再照合してください。', 409);
        if ($plan['imported_count'] === 0) throw new StockCsvError('全件が取込済みです。在庫は変更しません。', 409);
        $operator = mb_substr(trim((string)($user['display_name'] ?? $user['username'] ?? '管理者')), 0, 100);
        foreach ($plan['changes'] as $change) {
            $code = $change['internal_code']; $total = $change['before']; $product = $plan['_products'][$code];
            foreach ($change['locations'] as $location) {
                $difference = $location['after'] - $location['before'];
                $stmt = $pdo->prepare('INSERT INTO product_stocks (internal_code,location_name,quantity) VALUES (?,?,?) ON DUPLICATE KEY UPDATE quantity=VALUES(quantity),updated_at=NOW()');
                $stmt->execute([$code, $location['location_name'], $location['after']]);
                $stmt = $pdo->prepare('INSERT INTO stock_transactions (internal_code,product_code,product_name,jan_code,transaction_type,quantity,before_stock,after_stock,location_name,operator_name,reason,memo) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)');
                $stmt->execute([$code,$product['product_code'],$product['product_name'],$product['jan_code'],$difference < 0 ? '出庫' : '入庫',abs($difference),$total,$total+$difference,$location['location_name'],$operator,$difference < 0 ? '販売実績CSV' : '販売実績CSV返品','操作番号: ' . $id]);
                $total += $difference;
            }
        }
        $stmt = $pdo->prepare('INSERT INTO sales_csv_rows (row_id,request_id,internal_code,sale_date,quantity,customer_name,voucher_number,source_json) VALUES (?,?,?,?,?,?,?,?)');
        foreach ($plan['_rows'] as $row) $stmt->execute([$row['id'],$id,$row['code'],$row['source'][5],$row['quantity'],$row['source'][4],$row['source'][10],json_encode($row['source'], JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE)]);
        $result = ['success' => true, 'request_id' => $id, 'message' => '共有サーバーに売上・在庫・出庫履歴を保存しました。'] + salesCsvPublicPlan($plan);
        $stmt = $pdo->prepare('UPDATE sales_csv_batches SET before_json=?,result_json=? WHERE request_id=?');
        $stmt->execute([json_encode($plan['_before'], JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE),json_encode($result, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE),$id]);
        $pdo->commit(); return $result;
    } catch (Throwable $e) { if ($pdo->inTransaction()) $pdo->rollBack(); throw $e; }
}
function salesCsvHistory(PDO $pdo, array $user): array
{
    salesCsvAdmin($user);
    $items = $pdo->query('SELECT request_id,file_name,created_at,result_json FROM sales_csv_batches ORDER BY created_at DESC,request_id DESC LIMIT 50')->fetchAll(PDO::FETCH_ASSOC);
    foreach ($items as &$item) { $result = json_decode($item['result_json'], true, 64, JSON_THROW_ON_ERROR); unset($item['result_json']); $item['imported_count'] = $result['imported_count']; $item['duplicate_count'] = $result['duplicate_count']; }
    unset($item); return ['success' => true, 'batches' => $items];
}
