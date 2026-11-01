<?php
declare(strict_types=1);
final class SharedPlanningError extends RuntimeException {
 public function __construct(string $message,public int $status=409){parent::__construct($message);}
}
const PLANNING_KINDS=['salesPlans','shippingSchedules','shippingAllocations','shippingWarehouseAllocations','shippingArrivalReceipts','purchaseMetadata'];
function planningCanonical(mixed $value):mixed {
 if(!is_array($value))return $value;
 if(!array_is_list($value))ksort($value,SORT_STRING);
 foreach($value as &$v)$v=planningCanonical($v);unset($v);return $value;
}
function planningPayload(array $input):array {
 if(array_diff(array_keys($input),PLANNING_KINDS)||array_diff(PLANNING_KINDS,array_keys($input)))throw new SharedPlanningError('必要な予定データがそろっていません。',400);
 $total=0;
 foreach(PLANNING_KINDS as $kind){
  if(!is_array($input[$kind])||!array_is_list($input[$kind])||count($input[$kind])>10000)throw new SharedPlanningError('予定データの件数を確認してください。',400);
  $seen=[];
  foreach($input[$kind] as $row){
   if(!is_array($row)||array_is_list($row)||++$total>30000)throw new SharedPlanningError('予定データの形式を確認してください。',400);
   $id=$kind==='purchaseMetadata'?($row['internalCode']??null):($row['id']??null);
   if((!is_string($id)&&!is_int($id))||strlen((string)$id)>200||(string)$id===''||isset($seen[(string)$id]))throw new SharedPlanningError('識別番号の欠落・重複があります。',400);
   $seen[(string)$id]=true;
   if($kind==='purchaseMetadata'){
    if(array_diff(array_keys($row),['internalCode','orderRemaining'])||!array_key_exists('orderRemaining',$row)||($row['orderRemaining']!==null&&(!is_int($row['orderRemaining'])||$row['orderRemaining']<0||$row['orderRemaining']>1000000000)))throw new SharedPlanningError('発注残の形式を確認してください。',400);
   }
   if($kind==='salesPlans'&&(!is_string($row['internalCode']??null)||!is_int($row['quantity']??null)||$row['quantity']<1||$row['quantity']>1000000000))throw new SharedPlanningError('販売予定の商品・数量を確認してください。',400);
   if(strlen(json_encode($row,JSON_THROW_ON_ERROR))>200000)throw new SharedPlanningError('1件の予定データが大きすぎます。',413);
  }
 }
 $json=json_encode(planningCanonical($input),JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR);
 if(strlen($json)>4000000)throw new SharedPlanningError('予定データが大きすぎます。',413);
 return [$json,hash('sha256',$json)];
}
function planningCounts(array $data):array {return array_map(fn($k)=>['kind'=>$k,'count'=>count($data[$k])],PLANNING_KINDS);}
function planningRead(PDO $pdo,array $user):array {
 if(empty($user['id'])||!in_array($user['role']??'',['admin','worker'],true))throw new SharedPlanningError('ログインしてください。',403);
 $row=$pdo->query('SELECT revision,payload_json,updated_at FROM shared_planning_state WHERE id=1')->fetch(PDO::FETCH_ASSOC);
 if(!$row)throw new SharedPlanningError('共有予定の準備が必要です。',503);
 $data=$row['payload_json']===null?null:json_decode($row['payload_json'],true,64,JSON_THROW_ON_ERROR);
 return ['success'=>true,'format'=>'inventory-shared-planning-v1','initialized'=>$data!==null,'revision'=>(int)$row['revision'],'updated_at'=>$row['updated_at'],'counts'=>$data===null?null:planningCounts($data),'data'=>$data,'inventory_records_changed'=>false];
}
function planningInitialize(PDO $pdo,array $user,array $body):array {
 if(empty($user['id'])||($user['role']??'')!=='admin')throw new SharedPlanningError('管理者ログインが必要です。',403);
 $action=$body['action']??'';
 if(!in_array($action,['preview','initialize'],true))throw new SharedPlanningError('操作を確認してください。',400);
 [$json,$hash]=planningPayload($body['data']??[]);
 // Validate product codes using exact strings, never collation aliases.
 $codes=$pdo->query('SELECT internal_code FROM products')->fetchAll(PDO::FETCH_COLUMN);
 $known=array_fill_keys($codes,true);$data=json_decode($json,true,64,JSON_THROW_ON_ERROR);
 foreach($data as $rows)foreach($rows as $row)if(isset($row['internalCode'])&&!isset($known[$row['internalCode']]))throw new SharedPlanningError('共有商品に未登録の社内コードがあります。商品を先に照合してください。');
 $scheduleIds=array_fill_keys(array_map(fn($r)=>(string)$r['id'],$data['shippingSchedules']),true);
 foreach(['shippingAllocations','shippingWarehouseAllocations','shippingArrivalReceipts'] as $kind)foreach($data[$kind] as $row)if(!isset($row['scheduleId'])||!isset($scheduleIds[(string)$row['scheduleId']]))throw new SharedPlanningError('船便の対応が確認できないデータがあります。');
 if($pdo->inTransaction())throw new SharedPlanningError('別の処理を完了してください。');
 $engine=$pdo->query("SELECT ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='shared_planning_state'")->fetchColumn();
 if(strtoupper((string)$engine)!=='INNODB')throw new SharedPlanningError('共有予定テーブルを確認してください。',503);
 $pdo->beginTransaction();
 try {
  $row=$pdo->query('SELECT * FROM shared_planning_state WHERE id=1 FOR UPDATE')->fetch(PDO::FETCH_ASSOC);
  if(!$row)throw new SharedPlanningError('共有予定の準備が必要です。',503);
  if($action==='preview'){
   $result=['success'=>true,'format'=>'inventory-planning-preview-v1','revision'=>(int)$row['revision'],'hash'=>$hash,'can_initialize'=>$row['payload_json']===null,'counts'=>planningCounts($data),'inventory_records_changed'=>false];
  }else{
   $id=$body['request_id']??'';
   if(!is_string($id)||!preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/D',$id))throw new SharedPlanningError('操作番号を確認してください。',400);
   if($row['payload_json']!==null){
    if($row['request_id']!==$id||(int)$row['user_id']!==(int)$user['id']||$row['request_hash']!==$hash)throw new SharedPlanningError('共有予定は登録済みです。上書きしません。');
    $replayed=true;
   }else{
    if(($body['revision']??null)!==(int)$row['revision']||($body['hash']??'')!==$hash)throw new SharedPlanningError('もう一度件数を確認してください。');
    $q=$pdo->prepare('UPDATE shared_planning_state SET revision=revision+1,request_id=?,request_hash=?,user_id=?,payload_json=?,updated_at=NOW() WHERE id=1');$q->execute([$id,$hash,$user['id'],$json]);$replayed=false;
   }
   $result=['success'=>true,'format'=>'inventory-planning-initialize-v1','request_id'=>$id,'replayed'=>$replayed,'counts'=>planningCounts($data),'inventory_records_changed'=>false];
  }
  $pdo->commit();return $result;
 }catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();throw $e;}
}
