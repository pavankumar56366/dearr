-- =============================================================================
-- Dearr V1 — Rollback Migration 015: Shiprocket Concurrency Guards & RTO Stock
-- Database: Hostinger MySQL 8.x
-- =============================================================================

SET @exist_fk := (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'order_shipments'
    AND CONSTRAINT_NAME = 'uq_order_shipments_order_id'
);

SET @sql_uq := IF(@exist_fk > 0,
  'ALTER TABLE `order_shipments` DROP INDEX `uq_order_shipments_order_id`;',
  'SELECT "Unique index uq_order_shipments_order_id does not exist";'
);

PREPARE stmt_uq FROM @sql_uq;
EXECUTE stmt_uq;
DEALLOCATE PREPARE stmt_uq;

SET @exist_stock_col := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'orders'
    AND COLUMN_NAME = 'stock_restored_at'
);

SET @sql_stock := IF(@exist_stock_col > 0,
  'ALTER TABLE `orders` DROP COLUMN `stock_restored_at`, DROP COLUMN `rto_at`;',
  'SELECT "Columns do not exist on orders";'
);

PREPARE stmt_stock FROM @sql_stock;
EXECUTE stmt_stock;
DEALLOCATE PREPARE stmt_stock;
