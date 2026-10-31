<?php
declare(strict_types=1);

final class SharedProductsError extends RuntimeException
{
    public function __construct(string $message, public int $status = 409) { parent::__construct($message); }
}

// No local backup is accepted here. Both queries belong to the same read-only snapshot.
function readSharedProducts(PDO $pdo, array $user): array
{
    if (empty($user['id']) || !in_array($user['role'] ?? '', ['admin', 'worker'], true)) {
        throw new SharedProductsError('ログインが必要です。', 403);
    }
    if ($pdo->inTransaction()) throw new SharedProductsError('実行中の処理を完了してください。');
    $engines = $pdo->query("SELECT TABLE_NAME, ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN ('products','product_stocks')")->fetchAll(PDO::FETCH_KEY_PAIR);
    if (count($engines) !== 2 || array_filter($engines, fn($engine) => strtoupper($engine) !== 'INNODB')) {
        throw new SharedProductsError('在庫テーブルの構成を確認してください。');
    }
    $pdo->exec('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY');
    $pdo->beginTransaction();
    try {
        $items = $pdo->query('SELECT internal_code, product_code, product_name, jan_code, color, category, supplier_name, unit, min_stock, product_status FROM products ORDER BY internal_code LIMIT 5001')->fetchAll(PDO::FETCH_ASSOC);
        if (count($items) > 5000) throw new SharedProductsError('商品が5000件を超えています。一覧取得方法の拡張が必要です。', 413);
        $stocks = $pdo->query('SELECT internal_code, location_name, quantity FROM product_stocks ORDER BY internal_code, location_name LIMIT 50001')->fetchAll(PDO::FETCH_ASSOC);
        if (count($stocks) > 50000) throw new SharedProductsError('場所別在庫が50000件を超えています。一覧取得方法の拡張が必要です。', 413);
        $byCode = [];
        foreach ($stocks as $stock) $byCode[$stock['internal_code']][] = ['location_name'=>$stock['location_name'], 'quantity'=>(int)$stock['quantity']];
        foreach ($items as &$item) {
            $item['min_stock'] = (int)$item['min_stock'];
            $item['stocks'] = $byCode[$item['internal_code']] ?? [];
            $item['total_stock'] = array_sum(array_column($item['stocks'], 'quantity'));
            $item['locations'] = implode(' / ', array_column($item['stocks'], 'location_name'));
        }
        unset($item);
        $result = ['success'=>true, 'format'=>'inventory-shared-products-v1', 'complete'=>true, 'count'=>count($items), 'items'=>$items, 'fetched_at'=>gmdate('Y-m-d\TH:i:s\Z')];
        $pdo->commit();
        return $result;
    } catch (Throwable $e) { if ($pdo->inTransaction()) $pdo->rollBack(); throw $e; }
}
