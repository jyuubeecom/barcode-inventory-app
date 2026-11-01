<?php
declare(strict_types=1);
header('Content-Type: application/json; charset=UTF-8');header('Cache-Control: no-store');
$origin=$_SERVER['HTTP_ORIGIN']??'';
if(in_array($origin,['null','https://jyuubeecom.github.io','https://jyuubee.sakura.ne.jp'],true)){header('Access-Control-Allow-Origin: '.$origin);header('Vary: Origin');}
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');header('Access-Control-Allow-Headers: Content-Type, Authorization');
$method=$_SERVER['REQUEST_METHOD']??'';
if($method==='OPTIONS'){http_response_code(204);exit;}
if(!in_array($method,['GET','POST'],true)){http_response_code(405);echo '{"success":false,"message":"操作を確認してください。"}';exit;}
require_once __DIR__.'/shared-planning-service.php';
try{
 $c=require '/home/jyuubee/private/db-config.php';require_once '/home/jyuubee/private/auth.php';
 $pdo=new PDO(sprintf('mysql:host=%s;dbname=%s;charset=%s',$c['host'],$c['dbname'],$c['charset']),$c['user'],$c['password'],[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC,PDO::ATTR_EMULATE_PREPARES=>false]);
 $user=getAuthenticatedUser($pdo);
 if($method==='GET')$result=planningRead($pdo,$user);
 else{
  if((int)($_SERVER['CONTENT_LENGTH']??0)>5000000)throw new SharedPlanningError('送信量が大きすぎます。',413);
  $raw=file_get_contents('php://input',false,null,0,5000001);
  if($raw===false||strlen($raw)>5000000)throw new SharedPlanningError('送信量が大きすぎます。',413);
  $body=json_decode($raw,true,64,JSON_THROW_ON_ERROR);if(!is_array($body))throw new SharedPlanningError('送信形式を確認してください。',400);
  $result=planningInitialize($pdo,$user,$body);
 }
 echo json_encode($result,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR);
}catch(Throwable $e){$status=500;$message='共有予定を取得・保存できませんでした。保存結果が不明な場合は同じ操作番号で再確認してください。';
 if($e instanceof SharedPlanningError){$status=$e->status;$message=$e->getMessage();}elseif($e instanceof JsonException||$e instanceof TypeError){$status=400;$message='送信形式を確認してください。';}elseif(in_array($e->getMessage(),['AUTH_REQUIRED','AUTH_INVALID'],true)){$status=401;$message='再ログインしてください。';}
 http_response_code($status);echo json_encode(['success'=>false,'message'=>$message],JSON_UNESCAPED_UNICODE);
}
