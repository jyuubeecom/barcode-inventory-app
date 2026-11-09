-- Audit table only. Importing this file never changes inventory or drafts.
CREATE TABLE IF NOT EXISTS shared_stocktaking_finalizations (
  stocktaking_id char(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
  request_id char(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL UNIQUE,
  user_id bigint unsigned NOT NULL,
  operator_name varchar(100) NOT NULL,
  before_json mediumtext NOT NULL,
  result_json mediumtext NOT NULL,
  created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_shared_stocktaking_finalization FOREIGN KEY (stocktaking_id) REFERENCES shared_stocktakings(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
