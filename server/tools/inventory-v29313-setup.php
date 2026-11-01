<?php
declare(strict_types=1);
// Upload ONLY to /home/jyuubee/private. Never expose this helper over HTTP.
if (PHP_SAPI!=='cli') { http_response_code(404);exit; }
try {
    $config=require '/home/jyuubee/private/db-config.php';
    $pdo=new PDO(sprintf('mysql:host=%s;dbname=%s;charset=%s',$config['host'],$config['dbname'],$config['charset']),$config['user'],$config['password'],[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
    if (($argv[1]??'')==='migrate') {
        $sql=file_get_contents(__DIR__.'/inventory-v29313.sql');
        if ($sql===false) throw new RuntimeException('Missing SQL');
        $pdo->exec($sql);
    }
    $engine=$pdo->query("SELECT ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='shared_planning_state'")->fetchColumn();
    $ready=strtoupper((string)$engine)==='INNODB' && (int)$pdo->query('SELECT COUNT(*) FROM shared_planning_state WHERE id=1')->fetchColumn()===1;
    echo json_encode(['planning_table_ready'=>$ready,'inventory_records_changed'=>false],JSON_UNESCAPED_UNICODE).PHP_EOL;
    exit($ready?0:1);
} catch (Throwable $e) {fwrite(STDERR,"SETUP_FAILED: 配置先・接続・テーブルを確認してください。\n");exit(1);}
