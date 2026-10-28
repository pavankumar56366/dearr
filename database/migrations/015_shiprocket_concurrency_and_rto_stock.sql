-- =============================================================================
-- Dearr V1 — Migration 015: Shiprocket Concurrency Guards & RTO Stock Restoration
-- Database: Hostinger MySQL 8.x
-- Engine: InnoDB | Character Set: utf8mb4 | Collation: utf8mb4_unicode_ci
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Enforce UNIQUE(order_id) on order_shipments to prevent double fulfillment
-- -----------------------------------------------------------------------------
SET @exist_fk := (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'order_shipments'
    AND CONSTRAINT_NAME = 'uq_order_shipments_order_id'
);

SET @sql_uq := IF(@exist_fk = 0,
  'ALTER TABLE `order_shipments` ADD UNIQUE KEY `uq_order_shipments_order_id` (`order_id`);',
  'SELECT "Unique key uq_order_shipments_order_id already exists";'
);

PREPARE stmt_uq FROM @sql_uq;
EXECUTE stmt_uq;
DEALLOCATE PREPARE stmt_uq;

-- -----------------------------------------------------------------------------
-- 2. Add stock restoration and RTO timestamps to `orders` table
-- -----------------------------------------------------------------------------
SET @exist_stock_col := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'orders'
    AND COLUMN_NAME = 'stock_restored_at'
);

SET @sql_stock := IF(@exist_stock_col = 0,
  'ALTER TABLE `orders`
     ADD COLUMN `stock_restored_at` DATETIME DEFAULT NULL AFTER `cod_collected_at`,
     ADD COLUMN `rto_at` DATETIME DEFAULT NULL AFTER `stock_restored_at`;',
  'SELECT "stock_restored_at and rto_at already exist on orders";'
);

PREPARE stmt_stock FROM @sql_stock;
EXECUTE stmt_stock;
DEALLOCATE PREPARE stmt_stock;
