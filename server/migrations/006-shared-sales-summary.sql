-- Analytical snapshot only. Never replay historical stock movements.
CREATE TABLE IF NOT EXISTS shared_sales_summary_state (
 id tinyint unsigned NOT NULL PRIMARY KEY,
 revision int unsigned NOT NULL DEFAULT 0,
 request_id char(36) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
 request_hash char(64) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
 user_id bigint unsigned DEFAULT NULL,
 payload_json mediumtext DEFAULT NULL,
 updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
INSERT IGNORE INTO shared_sales_summary_state (id,revision) VALUES (1,0);
