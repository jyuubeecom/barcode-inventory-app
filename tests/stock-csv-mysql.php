<?php
declare(strict_types=1);
require_once __DIR__ . '/../server/stock-csv-service.php';
require_once __DIR__ . '/../server/check-stock-csv-readiness.php';

function connection(): PDO
{
    $pdo = new PDO(getenv('STOCK_CSV_TEST_DSN') ?: 'mysql:host=127.0.0.1;dbname=inventory_csv_test;charset=utf8mb4',
        getenv('STOCK_CSV_TEST_USER') ?: 'root', getenv('STOCK_CSV_TEST_PASSWORD') ?: 'test-only',
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC, PDO::ATTR_EMULATE_PREPARES => false]);
    if ($pdo->query('SELECT DATABASE()')->fetchColumn() !== 'inventory_csv_test') throw new RuntimeException('Refusing to use any database other than inventory_csv_test');
    return $pdo;
}
$admin = ['id' => 1, 'role' => 'admin', 'display_name' => '架空テスト担当'];
if (($argv[1] ?? '') === '--worker') {
    try { echo json_encode(applyStockCsv(connection(), json_decode(base64_decode($argv[2]), true), $admin), JSON_THROW_ON_ERROR); }
    catch (StockCsvError $e) { echo json_encode(['status' => $e->status]); }
    exit;
}
$pdo = connection();
foreach (['stock_csv_batches', 'stock_transactions', 'product_stocks', 'products'] as $table) $pdo->exec('DROP TABLE IF EXISTS ' . $table);
$pdo->exec(file_get_contents(__DIR__ . '/mysql-schema.sql'));
$missingBatch = stockCsvReadiness($pdo);
if (!$missingBatch['existing_tables_ready'] || $missingBatch['batch_table_ready']) throw new RuntimeException('Preflight did not detect the missing migration');
$pdo->exec(file_get_contents(__DIR__ . '/../server/migrations/001-stock-csv-batches.sql'));
$ready = stockCsvReadiness($pdo);
if (!$ready['existing_tables_ready'] || !$ready['batch_table_ready']) throw new RuntimeException('Preflight rejected the migrated schema');
echo "PASS read-only preflight detects pending and completed migration\n";

function check(bool $condition, string $message): void { if (!$condition) throw new RuntimeException($message); }
function fixture(PDO $pdo): void
{
    foreach (['stock_csv_batches', 'stock_transactions', 'product_stocks', 'products'] as $table) $pdo->exec('DELETE FROM ' . $table);
    $pdo->exec("INSERT INTO products (internal_code,product_name) VALUES ('FAKE-001','架空商品1'),('FAKE-002','架空商品2')");
    $pdo->exec("INSERT INTO product_stocks (internal_code,location_name,quantity) VALUES ('FAKE-001','本社1階 A区',5),('FAKE-001','酒本倉庫1階',2),('FAKE-002','本社1階 A区',3)");
}
function request(string $suffix = '1'): array
{
    return ['request_id' => '12345678-1234-4234-8234-' . str_pad($suffix, 12, '0', STR_PAD_LEFT), 'rows' => [
        ['internal_code' => 'FAKE-001', 'location_name' => '本社1階 A区', 'quantity' => 8, 'expected_stocks' => [
            ['location_name' => '本社1階 A区', 'quantity' => 5], ['location_name' => '酒本倉庫1階', 'quantity' => 2]]]]];
}
function failure(callable $fn, int $status): void
{
    try { $fn(); } catch (StockCsvError $e) { check($e->status === $status, 'Unexpected status: ' . $e->status); return; }
    throw new RuntimeException('Expected rejection');
}
function countRows(PDO $pdo, string $table): int { return (int)$pdo->query('SELECT COUNT(*) FROM ' . $table)->fetchColumn(); }

fixture($pdo);
$pdo->beginTransaction();
$pdo->exec("INSERT INTO products (internal_code,product_name) VALUES ('FAKE-PREFLIGHT','架空確認用')");
stockCsvReadiness($pdo);
check($pdo->inTransaction(), 'Preflight committed an existing transaction');
$pdo->rollBack();
check(countRows($pdo, 'products') === 2, 'Preflight modified or committed product data');
echo "PASS preflight preserves records and caller transaction\n";
$first = applyStockCsv($pdo, request(), $admin);
check(countRows($pdo, 'stock_transactions') === 1, 'Missing history');
$history = $pdo->query('SELECT * FROM stock_transactions')->fetch();
check((int)$history['quantity'] === 3 && (int)$history['before_stock'] === 7 && (int)$history['after_stock'] === 10, 'Wrong history totals');
$backup = json_decode($pdo->query('SELECT before_json FROM stock_csv_batches')->fetchColumn(), true);
check(count($backup[0]['stocks']) === 2, 'Missing before snapshot');
check(applyStockCsv($pdo, request(), $admin)['replayed'] === true, 'Retry not replayed');
check(countRows($pdo, 'stock_transactions') === 1, 'Duplicate history on retry');
$changed = request(); $changed['rows'][0]['quantity'] = 9;
failure(fn() => applyStockCsv($pdo, $changed, $admin), 409);
failure(fn() => applyStockCsv($pdo, request(), ['id' => 2, 'role' => 'admin']), 409);
failure(fn() => applyStockCsv($pdo, request(), ['id' => 2, 'role' => 'worker']), 403);
echo "PASS atomic apply, history, backup, receipt replay and authorization\n";

fixture($pdo);
$pdo->exec("UPDATE product_stocks SET quantity=4 WHERE internal_code='FAKE-001' AND location_name='酒本倉庫1階'");
failure(fn() => applyStockCsv($pdo, request(), $admin), 409);
check(countRows($pdo, 'stock_transactions') === 0 && countRows($pdo, 'stock_csv_batches') === 0, 'Stale request was partially saved');
echo "PASS concurrent change at an unselected location rejects the entire batch\n";

fixture($pdo);
$late = request();
$late['rows'][] = ['internal_code' => 'FAKE-002', 'location_name' => '酒本倉庫2階', 'quantity' => 9,
    'expected_stocks' => [['location_name' => '本社1階 A区', 'quantity' => 3]]];
failure(fn() => applyStockCsv($pdo, $late, $admin), 409);
check((int)$pdo->query("SELECT quantity FROM product_stocks WHERE internal_code='FAKE-001' AND location_name='本社1階 A区'")->fetchColumn() === 5, 'Earlier row not rolled back');
check(countRows($pdo, 'stock_transactions') === 0 && countRows($pdo, 'stock_csv_batches') === 0, 'Failed batch left records');
echo "PASS late-row failure rolls back earlier updates, history and receipt\n";

foreach ([-1, 1000001, 1.5, '8', null, true] as $value) {
    $bad = request(); $bad['rows'][0]['quantity'] = $value;
    failure(fn() => applyStockCsv($pdo, $bad, $admin), 400);
}
$bad = request(); $bad['rows'][] = $bad['rows'][0];
failure(fn() => applyStockCsv($pdo, $bad, $admin), 400);
$bad = request(); $bad['rows'][0]['location_name'] = '本社';
failure(fn() => applyStockCsv($pdo, $bad, $admin), 400);
$bad = request(); $bad['rows'][0]['expected_stocks'][0]['quantity'] = 6;
failure(fn() => applyStockCsv($pdo, $bad, $admin), 409);
$bad = request(); $alias = $bad['rows'][0]; $alias['internal_code'] = 'fake-001'; $alias['location_name'] = '酒本倉庫1階'; $bad['rows'][] = $alias;
failure(fn() => applyStockCsv($pdo, $bad, $admin), 409);
echo "PASS invalid quantities, duplicate pairs, aggregate locations and collation aliases\n";

fixture($pdo);
$multi = request(); $second = $multi['rows'][0]; $second['location_name'] = '酒本倉庫1階'; $second['quantity'] = 0; $multi['rows'][] = $second;
applyStockCsv($pdo, $multi, $admin);
check(countRows($pdo, 'stock_transactions') === 2, 'Two locations should write two histories');
check((int)$pdo->query("SELECT SUM(quantity) FROM product_stocks WHERE internal_code='FAKE-001'")->fetchColumn() === 8, 'Incorrect final total');
echo "PASS multiple locations and zero stock\n";

function parallelRequests(array $requests): array
{
    $children = [];
    foreach ($requests as $request) {
        $process = proc_open([PHP_BINARY, __FILE__, '--worker', base64_encode(json_encode($request, JSON_THROW_ON_ERROR))],
            [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes);
        if (!is_resource($process)) throw new RuntimeException('Could not start test worker');
        fclose($pipes[0]); $children[] = [$process, $pipes];
    }
    $results = [];
    foreach ($children as [$process, $pipes]) {
        $stdout = stream_get_contents($pipes[1]); $stderr = stream_get_contents($pipes[2]);
        fclose($pipes[1]); fclose($pipes[2]);
        check(proc_close($process) === 0 && $stderr === '', 'Worker failed: ' . $stderr);
        $results[] = json_decode($stdout, true, 512, JSON_THROW_ON_ERROR);
    }
    return $results;
}
fixture($pdo);
$results = parallelRequests([request(), request()]);
check(count(array_filter($results, fn($r) => ($r['success'] ?? false))) === 2, 'Duplicate concurrent submissions should return the same success');
check(countRows($pdo, 'stock_transactions') === 1 && countRows($pdo, 'stock_csv_batches') === 1, 'Concurrent replay duplicated writes');
echo "PASS simultaneous retry produces exactly one update\n";

fixture($pdo);
$results = parallelRequests([request('1'), request('2')]);
check(count(array_filter($results, fn($r) => ($r['success'] ?? false))) === 1, 'Only one stale competing operation should succeed');
check(count(array_filter($results, fn($r) => ($r['status'] ?? 0) === 409)) === 1, 'Competing update should require re-comparison');
check(countRows($pdo, 'stock_transactions') === 1, 'Competing batch duplicated history');
echo "PASS competing PCs cannot overwrite a changed comparison\n";
