<?php
declare(strict_types=1);
header('Content-Type: application/json; charset=UTF-8');
header('Cache-Control: no-store');
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (in_array($origin, ['null', 'https://jyuubeecom.github.io', 'https://jyuubee.sakura.ne.jp'], true)) {
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Vary: Origin');
}
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') { http_response_code(204); exit; }
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') {
    http_response_code(405); echo json_encode(['success'=>false, 'message'=>'GETで取得してください。'], JSON_UNESCAPED_UNICODE); exit;
}
require_once __DIR__ . '/shared-products-service.php';
try {
    $config = require '/home/jyuubee/private/db-config.php';
    require_once '/home/jyuubee/private/auth.php';
    $pdo = new PDO(sprintf('mysql:host=%s;dbname=%s;charset=%s', $config['host'], $config['dbname'], $config['charset']), $config['user'], $config['password'], [PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC, PDO::ATTR_EMULATE_PREPARES=>false]);
    $user = getAuthenticatedUser($pdo);
    echo json_encode(readSharedProducts($pdo, $user), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
} catch (Throwable $e) {
    $status = 500; $message = '共有商品一覧を取得できませんでした。サーバーの配置と接続を確認してください。';
    if ($e instanceof SharedProductsError) { $status=$e->status; $message=$e->getMessage(); }
    elseif (in_array($e->getMessage(), ['AUTH_REQUIRED', 'AUTH_INVALID'], true)) { $status=401; $message='再ログインしてください。'; }
    http_response_code($status);
    echo json_encode(['success'=>false, 'message'=>$message], JSON_UNESCAPED_UNICODE);
}
