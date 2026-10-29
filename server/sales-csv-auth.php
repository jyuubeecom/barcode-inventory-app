<?php
declare(strict_types=1);
header('Content-Type: application/json; charset=UTF-8');
header('Cache-Control: no-store');
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (in_array($origin, ['null', 'https://jyuubeecom.github.io', 'https://jyuubee.sakura.ne.jp'], true)) {
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Vary: Origin');
}
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
function stockCsvSend(array $data, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') { http_response_code(204); exit; }
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') stockCsvSend(['success' => false, 'message' => 'POSTで送信してください。'], 405);
require_once __DIR__ . '/sales-csv-service.php';
try {
    $config = require '/home/jyuubee/private/db-config.php';
    require_once '/home/jyuubee/private/auth.php';
    $pdo = new PDO(sprintf('mysql:host=%s;dbname=%s;charset=%s', $config['host'], $config['dbname'], $config['charset']), $config['user'], $config['password'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC, PDO::ATTR_EMULATE_PREPARES => false,
    ]);
    $user = getAuthenticatedUser($pdo);
    if (($user['role'] ?? '') !== 'admin') throw new StockCsvError('管理者ログインが必要です。', 403);
    $body = file_get_contents('php://input', false, null, 0, 1048577);
    if ($body === false || strlen($body) > 1048576) throw new StockCsvError('送信内容が大きすぎます。', 413);
    try { $input = json_decode($body, true, 64, JSON_THROW_ON_ERROR); }
    catch (JsonException $e) { throw new StockCsvError('送信形式が不正です。'); }
    if (!is_array($input)) throw new StockCsvError('送信形式が不正です。');
    $action = $input['action'] ?? '';
    $result = match ($action) {
        'preview' => previewSalesCsv($pdo, $input, $user),
        'apply' => applySalesCsv($pdo, $input, $user),
        'history' => salesCsvHistory($pdo, $user),
        default => throw new StockCsvError('操作を確認してください。'),
    };
    stockCsvSend($result);
} catch (Throwable $e) {
    $status = 500; $message = '反映結果を確認できません。同じ操作番号で再試行してください。';
    if ($e instanceof StockCsvError) { $status = $e->status; $message = $e->getMessage(); }
    elseif (in_array($e->getMessage(), ['AUTH_REQUIRED', 'AUTH_INVALID'], true)) { $status = 401; $message = '再ログインしてください。'; }
    stockCsvSend(['success' => false, 'message' => $message], $status);
}
