<?php
declare(strict_types=1);
// Upload ONLY to /home/jyuubee/private. Never expose this helper over HTTP.
if (PHP_SAPI!=='cli') { http_response_code(404);exit; }
try {
    $config=require '/home/jyuubee/private/db-config.php';
    $pdo=new PDO(sprintf('mysql:host=%s;dbname=%s;charset=%s',$config['host'],$config['dbname'],$config['charset']),$config['user'],$config['password'],[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
    if (($argv[1]??'')==='migrate') {
        $sql=file_get_contents(__DIR__.'/inventory-v29311.sql');
        if ($sql===false) throw new RuntimeException('Missing SQL');
        $pdo->exec($sql);
    }
    $tables=$pdo->query("SELECT TABLE_NAME,ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN ('products','product_stocks','stock_transactions','shared_stock_operation_batches')")->fetchAll(PDO::FETCH_KEY_PAIR);
    $ready=count($tables)===4&&!array_filter($tables,fn($v)=>strtoupper((string)$v)!=='INNODB');
    $columns=$pdo->query('SHOW COLUMNS FROM shared_stock_operation_batches')->fetchAll(PDO::FETCH_COLUMN);
    $ready=$ready&&!array_diff(['request_id','user_id','request_hash','before_json','result_json','created_at'],$columns);
    echo json_encode(['operation_table_ready'=>$ready,'inventory_records_changed'=>false],JSON_UNESCAPED_UNICODE).PHP_EOL;
    exit($ready?0:1);
} catch (Throwable $e) {fwrite(STDERR,"SETUP_FAILED: 配置先・接続・テーブルを確認してください。\n");exit(1);}
