<?php
declare(strict_types=1);

// CLI-only, read-only deployment check. Never prints credentials or business records.
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }

function salesCsvReadiness(PDO $pdo): array
{
    $required = [
        'products' => ['internal_code', 'product_code', 'product_name', 'jan_code', 'product_status'],
        'product_stocks' => ['internal_code', 'location_name', 'quantity', 'updated_at'],
        'stock_transactions' => ['id', 'internal_code', 'product_code', 'product_name', 'jan_code',
            'transaction_type', 'quantity', 'before_stock', 'after_stock', 'location_name',
            'operator_name', 'reason', 'memo', 'created_at'],
        'sales_csv_batches' => ['request_id', 'user_id', 'request_hash', 'file_name', 'before_json', 'result_json', 'created_at'],
        'sales_csv_rows' => ['row_id', 'request_id', 'internal_code', 'sale_date', 'quantity', 'customer_name', 'voucher_number', 'source_json', 'created_at'],
    ];
    $tables = [];
    foreach ($required as $table => $columns) {
        $stmt = $pdo->prepare('SELECT ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=?');
        $stmt->execute([$table]); $engine = $stmt->fetchColumn();
        $found = $engine !== false;
        $actual = $found ? array_column($pdo->query('SHOW COLUMNS FROM `' . $table . '`')->fetchAll(PDO::FETCH_ASSOC), 'Field') : [];
        $missing = array_values(array_diff($columns, $actual));
        $tables[$table] = ['exists' => $found, 'innodb' => $engine === 'InnoDB', 'missing_columns' => $missing];
    }
    $existingReady = true;
    foreach (['products', 'product_stocks', 'stock_transactions'] as $table) {
        $state = $tables[$table];
        $existingReady = $existingReady && $state['exists'] && $state['innodb'] && !$state['missing_columns'];
    }
    $salesReady = true;
    foreach (['sales_csv_batches' => 'request_id', 'sales_csv_rows' => 'row_id'] as $table => $key) {
        $state = $tables[$table];
        $ready = $state['exists'] && $state['innodb'] && !$state['missing_columns'];
        if ($ready) {
            $indexes = $pdo->query('SHOW INDEX FROM `' . $table . '`')->fetchAll(PDO::FETCH_ASSOC);
            $primary = array_values(array_filter($indexes, fn($row) => $row['Key_name'] === 'PRIMARY'));
            $ready = count($primary) === 1 && $primary[0]['Column_name'] === $key;
        }
        $salesReady = $salesReady && $ready;
    }
    return ['existing_tables_ready' => $existingReady, 'sales_tables_ready' => $salesReady, 'tables' => $tables];
}

// Requiring this file from the disposable integration test does not run the live check.
if (realpath($_SERVER['SCRIPT_FILENAME'] ?? '') !== __FILE__) return;

try {
    $extensions = ['pdo_mysql' => extension_loaded('pdo_mysql'), 'mbstring' => extension_loaded('mbstring')];
    if (PHP_VERSION_ID < 80200 || in_array(false, $extensions, true)) {
        echo json_encode(['status' => 'PHP_REQUIREMENTS_NOT_MET', 'php' => PHP_VERSION, 'extensions' => $extensions], JSON_PRETTY_PRINT) . PHP_EOL;
        exit(1);
    }
    $configPath = '/home/jyuubee/private/db-config.php';
    $authPath = '/home/jyuubee/private/auth.php';
    if (!is_readable($configPath) || !is_readable($authPath)) {
        echo json_encode(['status' => 'PRIVATE_CONFIG_OR_AUTH_NOT_READABLE'], JSON_PRETTY_PRINT) . PHP_EOL;
        exit(1);
    }
    $config = require $configPath;
    $pdo = new PDO(sprintf('mysql:host=%s;dbname=%s;charset=%s', $config['host'], $config['dbname'], $config['charset']),
        $config['user'], $config['password'], [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_EMULATE_PREPARES => false]);
    $database = salesCsvReadiness($pdo);
    $apiDirectory = '/home/jyuubee/www/inventory/';
    $apis = [];
    foreach (['sales-csv-auth.php', 'sales-csv-service.php', 'stock-csv-service.php'] as $file) {
        $apis[$file] = is_readable($apiDirectory . $file);
    }
    echo json_encode(['status' => $database['existing_tables_ready'] ? 'CHECK_COMPLETE' : 'EXISTING_SCHEMA_NEEDS_REVIEW',
        'read_only' => true, 'php' => PHP_VERSION, 'extensions' => $extensions,
        'database' => $database, 'api_files_present' => $apis,
        'note' => 'No database records, tables or application files were changed. File presence does not verify deployment contents.'], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . PHP_EOL;
} catch (Throwable $e) {
    // Raw PDO/config errors can contain host/user information; do not print them.
    echo json_encode(['status' => 'CHECK_FAILED', 'read_only' => true,
        'note' => 'Check server configuration and database access. No credentials or database records are printed.'], JSON_PRETTY_PRINT) . PHP_EOL;
    exit(1);
}
