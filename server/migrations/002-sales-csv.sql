-- Additive migration. No existing inventory or local sales records are imported.
CREATE TABLE IF NOT EXISTS sales_csv_batches (
 request_id char(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
 user_id bigint unsigned NOT NULL,
 request_hash char(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 file_name varchar(255) NOT NULL,
 before_json mediumtext NOT NULL,
 result_json mediumtext NOT NULL,
 created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
 KEY idx_sales_csv_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS sales_csv_rows (
 row_id char(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
 request_id char(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 internal_code varchar(50) NOT NULL,
 sale_date date NOT NULL,
 quantity int NOT NULL,
 customer_name varchar(255) NOT NULL,
 voucher_number varchar(255) NOT NULL,
 source_json text NOT NULL,
 created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
 KEY idx_sales_csv_code_date (internal_code,sale_date),
 KEY idx_sales_csv_request (request_id),
 CONSTRAINT fk_sales_csv_batch FOREIGN KEY (request_id) REFERENCES sales_csv_batches(request_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
