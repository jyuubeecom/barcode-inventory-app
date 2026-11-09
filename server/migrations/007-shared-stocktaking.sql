-- New draft tables only. Never update product_stocks or stock_transactions.
CREATE TABLE IF NOT EXISTS shared_stocktakings (
  id char(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
  stocktaking_date date NOT NULL,
  location_name varchar(100) NOT NULL,
  created_by bigint unsigned NOT NULL,
  operator_name varchar(100) NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'draft',
  created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_shared_stocktaking_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS shared_stocktaking_items (
  stocktaking_id char(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  internal_code varchar(50) COLLATE utf8mb4_bin NOT NULL,
  product_code varchar(100) DEFAULT NULL,
  product_name varchar(255) NOT NULL,
  jan_code varchar(50) DEFAULT NULL,
  registered_stock int unsigned NOT NULL,
  counted_stock int unsigned DEFAULT NULL,
  memo text NOT NULL,
  version int unsigned NOT NULL DEFAULT 0,
  counted_by varchar(100) DEFAULT NULL,
  updated_at datetime DEFAULT NULL,
  PRIMARY KEY (stocktaking_id, internal_code),
  CONSTRAINT fk_shared_stocktaking_item FOREIGN KEY (stocktaking_id) REFERENCES shared_stocktakings(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS shared_stocktaking_requests (
  request_id char(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
  user_id bigint unsigned NOT NULL,
  request_hash char(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  result_json mediumtext NOT NULL,
  created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
