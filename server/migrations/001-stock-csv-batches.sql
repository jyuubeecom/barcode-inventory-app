-- Run once before enabling stock CSV apply. Existing inventory tables are unchanged.
CREATE TABLE IF NOT EXISTS stock_csv_batches (
  request_id char(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  user_id bigint unsigned NOT NULL,
  request_hash char(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  before_json mediumtext NOT NULL,
  result_json mediumtext NOT NULL,
  created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (request_id),
  KEY idx_stock_csv_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
