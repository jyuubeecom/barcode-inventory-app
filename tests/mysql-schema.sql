-- Schema only, no production records. Used only in the disposable CI database.
CREATE TABLE `products` (
  `internal_code` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '社内コード',
  `product_code` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '商品コード',
  `product_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '商品名',
  `jan_code` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'JANコード',
  `color` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '色',
  `category` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'カテゴリー',
  `supplier_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '仕入先名',
  `unit` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '単位',
  `min_stock` int NOT NULL DEFAULT '0' COMMENT '最低在庫数',
  `product_status` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '通常商品' COMMENT '商品状態',
  `memo` text COLLATE utf8mb4_unicode_ci COMMENT 'メモ',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '登録日時',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新日時',
  PRIMARY KEY (`internal_code`),
  KEY `idx_product_code` (`product_code`),
  KEY `idx_jan_code` (`jan_code`),
  KEY `idx_product_name` (`product_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `product_stocks` (
  `internal_code` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '社内コード',
  `location_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '保管場所',
  `quantity` int unsigned NOT NULL DEFAULT '0' COMMENT '現在庫数',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新日時',
  PRIMARY KEY (`internal_code`,`location_name`),
  CONSTRAINT `fk_product_stocks_product` FOREIGN KEY (`internal_code`) REFERENCES `products` (`internal_code`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `stock_transactions` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `internal_code` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `product_code` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `product_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `jan_code` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `transaction_type` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `quantity` int NOT NULL DEFAULT '0',
  `before_stock` int NOT NULL DEFAULT '0',
  `after_stock` int NOT NULL DEFAULT '0',
  `location_name` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `operator_name` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `reason` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `memo` text COLLATE utf8mb4_unicode_ci,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_stock_transactions_internal_code` (`internal_code`),
  KEY `idx_stock_transactions_created_at` (`created_at`),
  KEY `idx_stock_transactions_type` (`transaction_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
