<?php
declare(strict_types=1);

// No configuration, credentials or HTTP dependencies: also used by integration tests.
final class StockCsvError extends RuntimeException
{
    public int $status;
    public function __construct(string $message, int $status = 400)
    {
        parent::__construct($message);
        $this->status = $status;
    }
}

function stockCsvLocations(): array
{
    $places = ['酒本倉庫1階', '酒本倉庫2階', '未設定'];
    foreach ([1, 2] as $floor) {
        foreach (['A', 'B', 'C', 'D', 'E', 'F'] as $area) {
            $places[] = '本社' . $floor . '階 ' . $area . '区';
        }
    }
    return $places;
}

function stockCsvInteger($value, int $maximum): int
{
    if (!is_int($value) || $value < 0 || $value > $maximum) {
        throw new StockCsvError('在庫数は指定範囲の整数で送信してください。');
    }
    return $value;
}

function stockCsvText($value, int $length): string
{
    if (!is_string($value) || $value === '' || trim($value) !== $value ||
        mb_strlen($value) > $length || preg_match('/[\x00-\x1f\x7f]/u', $value)) {
        throw new StockCsvError('社内コード・保管場所の形式を確認してください。');
    }
    return $value;
}

function stockCsvSnapshot(array $stocks, bool $fromDatabase = false): array
{
    if (count($stocks) > 300) throw new StockCsvError('保管場所の数が上限を超えています。');
    $result = [];
    $seen = [];
    $total = 0;
    foreach ($stocks as $stock) {
        if (!is_array($stock)) throw new StockCsvError('照合時の在庫情報が不正です。');
        $place = stockCsvText($stock['location_name'] ?? null, 100);
        if (isset($seen[$place])) throw new StockCsvError('保管場所が重複しています。');
        $seen[$place] = true;
        $quantity = stockCsvInteger($fromDatabase ? (int)$stock['quantity'] : ($stock['quantity'] ?? null), 1000000000);
        $total += $quantity;
        if ($total > 1000000000) throw new StockCsvError('総在庫数が上限を超えています。');
        $result[] = ['location_name' => $place, 'quantity' => $quantity];
    }
    usort($result, fn($a, $b) => strcmp($a['location_name'], $b['location_name']));
    return $result;
}

function stockCsvRequest(array $input): array
{
    $id = $input['request_id'] ?? '';
    if (!is_string($id) || !preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/D', $id)) {
        throw new StockCsvError('操作番号が不正です。再照合してください。');
    }
    $rows = $input['rows'] ?? null;
    if (!is_array($rows) || !array_is_list($rows) || count($rows) < 1 || count($rows) > 300) {
        throw new StockCsvError('反映対象は1～300行で指定してください。');
    }
    $result = []; $pairs = []; $snapshots = [];
    foreach ($rows as $row) {
        if (!is_array($row)) throw new StockCsvError('反映対象の形式が不正です。');
        $code = stockCsvText($row['internal_code'] ?? null, 50);
        $place = stockCsvText($row['location_name'] ?? null, 100);
        if (!in_array($place, stockCsvLocations(), true)) throw new StockCsvError('この保管場所は反映対象にできません。');
        $pair = json_encode([$code, $place], JSON_THROW_ON_ERROR);
        if (isset($pairs[$pair])) throw new StockCsvError('同じ商品・保管場所が重複しています。');
        $pairs[$pair] = true;
        $expected = $row['expected_stocks'] ?? null;
        if (!is_array($expected) || !array_is_list($expected)) throw new StockCsvError('再照合が必要です。');
        $expected = stockCsvSnapshot($expected);
        if (isset($snapshots[$code]) && $snapshots[$code] !== $expected) throw new StockCsvError('同じ商品の照合結果が一致しません。');
        $snapshots[$code] = $expected;
        $result[] = ['internal_code' => $code, 'location_name' => $place,
            'quantity' => stockCsvInteger($row['quantity'] ?? null, 1000000), 'expected_stocks' => $expected];
    }
    if (count($snapshots) > 100) throw new StockCsvError('商品数は100件までです。');
    usort($result, fn($a, $b) => strcmp($a['internal_code'], $b['internal_code']) ?: strcmp($a['location_name'], $b['location_name']));
    return ['request_id' => $id, 'rows' => $result];
}

function applyStockCsv(PDO $pdo, array $input, array $user): array
{
    if (($user['role'] ?? '') !== 'admin' || empty($user['id'])) throw new StockCsvError('管理者ログインが必要です。', 403);
    $request = stockCsvRequest($input);
    $hash = hash('sha256', json_encode($request['rows'], JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE));
    $id = $request['request_id'];
    $pdo->beginTransaction();
    try {
        // A unique receipt serializes retries, including a retry while the first request is committing.
        try {
            $insert = $pdo->prepare('INSERT INTO stock_csv_batches (request_id,user_id,request_hash,before_json,result_json) VALUES (?,?,?,\'[]\',\'{}\')');
            $insert->execute([$id, (int)$user['id'], $hash]);
        } catch (PDOException $e) {
            if (($e->errorInfo[1] ?? null) !== 1062) throw $e;
            $receipt = $pdo->prepare('SELECT user_id,request_hash,result_json FROM stock_csv_batches WHERE request_id=? FOR UPDATE');
            $receipt->execute([$id]); $saved = $receipt->fetch(PDO::FETCH_ASSOC);
            if (!$saved || (int)$saved['user_id'] !== (int)$user['id'] || !hash_equals($saved['request_hash'], $hash)) {
                throw new StockCsvError('操作番号が別の反映内容に使用されています。', 409);
            }
            $result = json_decode($saved['result_json'], true, 512, JSON_THROW_ON_ERROR);
            $pdo->commit();
            return $result + ['replayed' => true];
        }
        $products = []; $stocks = []; $before = []; $canonical = [];
        foreach ($request['rows'] as $row) {
            $code = $row['internal_code'];
            if (isset($products[$code])) continue;
            $stmt = $pdo->prepare('SELECT internal_code,product_code,product_name,jan_code FROM products WHERE internal_code=? FOR UPDATE');
            $stmt->execute([$code]); $product = $stmt->fetch(PDO::FETCH_ASSOC);
            if (!$product) throw new StockCsvError('商品が見つかりません。再照合してください。', 409);
            // Reject aliases caused by the database's case/accent-insensitive collation.
            if (isset($canonical[$product['internal_code']])) throw new StockCsvError('同じ商品の別表記が混在しています。', 409);
            $canonical[$product['internal_code']] = true;
            $stmt = $pdo->prepare('SELECT location_name,quantity FROM product_stocks WHERE internal_code=? ORDER BY location_name FOR UPDATE');
            $stmt->execute([$code]); $current = stockCsvSnapshot($stmt->fetchAll(PDO::FETCH_ASSOC), true);
            if ($current !== $row['expected_stocks']) throw new StockCsvError('照合後にサーバー在庫が変更されています。全件を再照合してください。', 409);
            $products[$code] = $product; $stocks[$code] = $current;
            $before[] = ['product' => $product, 'stocks' => $current];
        }
        $resultRows = [];
        foreach ($request['rows'] as $row) {
            $code = $row['internal_code']; $place = $row['location_name'];
            $index = array_search($place, array_column($stocks[$code], 'location_name'), true);
            if ($index === false) throw new StockCsvError('保管場所が未登録です。再照合してください。', 409);
            $old = $stocks[$code][$index]['quantity']; $difference = $row['quantity'] - $old;
            if ($difference === 0) throw new StockCsvError('変更のない行が含まれています。再照合してください。', 409);
            $totalBefore = array_sum(array_column($stocks[$code], 'quantity'));
            $totalAfter = $totalBefore + $difference;
            if ($totalAfter > 1000000000) throw new StockCsvError('反映後の総在庫数が上限を超えます。');
            $stmt = $pdo->prepare('UPDATE product_stocks SET quantity=?,updated_at=NOW() WHERE internal_code=? AND location_name=?');
            $stmt->execute([$row['quantity'], $code, $place]);
            $product = $products[$code];
            $stmt = $pdo->prepare('INSERT INTO stock_transactions (internal_code,product_code,product_name,jan_code,transaction_type,quantity,before_stock,after_stock,location_name,operator_name,reason,memo) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)');
            $operator = mb_substr(trim((string)($user['display_name'] ?? $user['username'] ?? '管理者')), 0, 100);
            $stmt->execute([$product['internal_code'], $product['product_code'], $product['product_name'], $product['jan_code'],
                '数量調整', $difference, $totalBefore, $totalAfter, $place, $operator, '在庫CSV反映', '操作番号: ' . $id]);
            $stocks[$code][$index]['quantity'] = $row['quantity'];
            $resultRows[] = ['internal_code' => $product['internal_code'], 'location_name' => $place,
                'before' => $old, 'after' => $row['quantity'], 'transaction_id' => (int)$pdo->lastInsertId()];
        }
        $result = ['success' => true, 'request_id' => $id, 'rows' => $resultRows, 'message' => '選択した在庫と更新履歴を保存しました。'];
        $stmt = $pdo->prepare('UPDATE stock_csv_batches SET before_json=?,result_json=? WHERE request_id=?');
        $stmt->execute([json_encode($before, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE), json_encode($result, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE), $id]);
        $pdo->commit();
        return $result;
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $e;
    }
}
