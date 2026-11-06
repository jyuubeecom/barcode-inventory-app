<?php
declare(strict_types=1);
require_once __DIR__.'/shared-planning-service.php';
function summaryDate(mixed $v):bool {
 if(!is_string($v)||!preg_match('/^(19|20)\d{2}-\d{2}-\d{2}$/D',$v))return false;
 [$y,$m,$d]=array_map('intval',explode('-',$v));return checkdate($m,$d,$y);
}
function summaryPayload(array $data):array {
 if(array_diff(array_keys($data),['rule','sourceCount','months','ranges'])||count($data)!==4||($data['rule']??'')!=='monthly-customer-exclusion-v1'||!is_int($data['sourceCount']??null)||$data['sourceCount']<1||$data['sourceCount']>1000000)throw new SharedPlanningError('実績集計の形式を確認してください。',400);
 foreach(['months'=>30000,'ranges'=>10000] as $k=>$max)if(!is_array($data[$k]??null)||!array_is_list($data[$k])||count($data[$k])>$max)throw new SharedPlanningError('実績集計の件数を確認してください。',400);
 if(!$data['months'])throw new SharedPlanningError('販売実績がありません。',400);
 $seen=[];
 foreach($data['months'] as $r){
  if(!is_array($r)||count($r)!==4||array_diff(array_keys($r),['internalCode','month','ordinary','excluded'])||!is_string($r['internalCode']??null)||trim($r['internalCode'])===''||strlen($r['internalCode'])>200||!is_string($r['month']??null)||!summaryDate($r['month'].'-01'))throw new SharedPlanningError('商品別月別実績を確認してください。',400);
  foreach(['ordinary','excluded'] as $k)if(!is_int($r[$k]??null)||abs($r[$k])>1000000000)throw new SharedPlanningError('実績数量を確認してください。',400);
  $key=$r['internalCode']."\x1f".$r['month'];if(isset($seen[$key]))throw new SharedPlanningError('月別実績が重複しています。',400);$seen[$key]=true;
 }
 foreach($data['ranges'] as $r)if(!is_array($r)||count($r)!==2||!summaryDate($r['startDate']??null)||!summaryDate($r['endDate']??null)||$r['startDate']>$r['endDate'])throw new SharedPlanningError('実績の対象期間を確認してください。',400);
 $json=json_encode(planningCanonical($data),JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR);
 if(strlen($json)>4000000)throw new SharedPlanningError('実績集計が大きすぎます。',413);
 return [$json,hash('sha256',$json)];
}
function summaryCounts(array $data):array {
 $keys=array_column($data['months'],'month');sort($keys);
 return ['sourceCount'=>$data['sourceCount'],'monthRows'=>count($keys),'startMonth'=>$keys[0],'endMonth'=>$keys[count($keys)-1],'rangeCount'=>count($data['ranges'])];
}
function summarySave(PDO $pdo,array $user,array $body):array {
 if(empty($user['id'])||($user['role']??'')!=='admin')throw new SharedPlanningError('管理者ログインが必要です。',403);
 if($pdo->inTransaction())throw new SharedPlanningError('別の処理を完了してください。');
 $action=$body['action']??'';if(!in_array($action,['preview','initialize'],true))throw new SharedPlanningError('操作を確認してください。',400);
 if(!is_array($body['data']??null))throw new SharedPlanningError('実績集計を確認してください。',400);
 [$json,$hash]=summaryPayload($body['data']);
 $engine=$pdo->query("SELECT ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='shared_sales_summary_state'")->fetchColumn();
 if(strtoupper((string)$engine)!=='INNODB')throw new SharedPlanningError('実績共有の準備が必要です。',503);
 $pdo->beginTransaction();
 try{
  $row=$pdo->query('SELECT * FROM shared_sales_summary_state WHERE id=1 FOR UPDATE')->fetch(PDO::FETCH_ASSOC);
  if(!$row)throw new SharedPlanningError('実績共有の準備が必要です。',503);
  $counts=summaryCounts($body['data']);
  if($action==='preview')$result=['success'=>true,'format'=>'inventory-summary-preview-v1','revision'=>(int)$row['revision'],'hash'=>$hash,'can_initialize'=>$row['payload_json']===null,'counts'=>$counts,'inventory_records_changed'=>false];
  else{
   $id=$body['request_id']??'';if(!is_string($id)||!preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/D',$id))throw new SharedPlanningError('操作番号を確認してください。',400);
   $replayed=$row['payload_json']!==null;
   if($replayed){if($row['request_id']!==$id||(int)$row['user_id']!==(int)$user['id']||!hash_equals((string)$row['request_hash'],$hash))throw new SharedPlanningError('実績集計は共有済みです。上書きしません。');}
   else{
    if(!is_int($body['revision']??null)||$body['revision']!==(int)$row['revision']||!is_string($body['hash']??null)||!hash_equals($hash,$body['hash']))throw new SharedPlanningError('件数を確認し直してください。');
    $q=$pdo->prepare('UPDATE shared_sales_summary_state SET revision=revision+1,request_id=?,request_hash=?,user_id=?,payload_json=?,updated_at=NOW() WHERE id=1');$q->execute([$id,$hash,$user['id'],$json]);
   }
   $result=['success'=>true,'format'=>'inventory-summary-initialize-v1','request_id'=>$id,'replayed'=>$replayed,'counts'=>$counts,'inventory_records_changed'=>false];
  }
  $pdo->commit();return $result;
 }catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();throw $e;}
}
function summaryRead(PDO $pdo,array $user):array {
 if(empty($user['id'])||!in_array($user['role']??'',['admin','worker'],true))throw new SharedPlanningError('ログインしてください。',403);
 if($pdo->inTransaction())throw new SharedPlanningError('別の処理を完了してください。');
 $names=['products','product_stocks','shared_planning_state','shared_sales_summary_state'];
 $engines=$pdo->query("SELECT ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN ('products','product_stocks','shared_planning_state','shared_sales_summary_state')")->fetchAll(PDO::FETCH_COLUMN);
 if(count($engines)!==count($names)||array_filter($engines,fn($e)=>strtoupper($e)!=='INNODB'))throw new SharedPlanningError('共有判定の準備が必要です。',503);
 $pdo->exec('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY');$pdo->beginTransaction();
 try{
  $p=$pdo->query('SELECT internal_code,product_code,product_name,supplier_name,product_status FROM products ORDER BY internal_code LIMIT 5001')->fetchAll(PDO::FETCH_ASSOC);
  $stocks=$pdo->query('SELECT internal_code,quantity FROM product_stocks LIMIT 50001')->fetchAll(PDO::FETCH_ASSOC);
  if(count($p)>5000||count($stocks)>50000)throw new SharedPlanningError('共有データが多すぎます。',413);
  $totals=[];foreach($stocks as $s)$totals[$s['internal_code']]=($totals[$s['internal_code']]??0)+(int)$s['quantity'];
  foreach($p as &$v)$v['total_stock']=$totals[$v['internal_code']]??0;unset($v);
  $plan=$pdo->query('SELECT revision,payload_json,updated_at FROM shared_planning_state WHERE id=1')->fetch(PDO::FETCH_ASSOC);
  $sales=$pdo->query('SELECT revision,payload_json,updated_at FROM shared_sales_summary_state WHERE id=1')->fetch(PDO::FETCH_ASSOC);
  if(!$plan||!$sales)throw new SharedPlanningError('共有判定の準備が必要です。',503);
  foreach([&$plan,&$sales] as &$state){$state['data']=$state['payload_json']===null?null:json_decode($state['payload_json'],true,64,JSON_THROW_ON_ERROR);unset($state['payload_json']);$state['revision']=(int)$state['revision'];}unset($state);
  $result=['success'=>true,'format'=>'inventory-shared-decisions-v1','complete'=>true,'products'=>$p,'planning'=>$plan,'sales'=>$sales,'fetched_at'=>gmdate('Y-m-d\TH:i:s\Z'),'inventory_records_changed'=>false];
  $pdo->commit();return $result;
 }catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();throw $e;}
}
