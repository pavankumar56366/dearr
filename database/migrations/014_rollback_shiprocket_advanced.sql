-- =============================================================================
-- Dearr V1 — Rollback Migration 014: Advanced Logistics & Tracking Events
-- Database: Hostinger MySQL 8.x
-- Engine: InnoDB | Character Set: utf8mb4 | Collation: utf8mb4_unicode_ci
-- =============================================================================

-- 1. Drop shipment_tracking_events table
DROP TABLE IF EXISTS `shipment_tracking_events`;

-- 2. Drop actual freight cost column on order_shipments
SET @exist_col := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'order_shipments'
    AND COLUMN_NAME = 'shipment_actual_cost'
);

SET @sql := IF(@exist_col > 0,
  'ALTER TABLE `order_shipments` DROP COLUMN `shipment_actual_cost`;',
  'SELECT "Column shipment_actual_cost does not exist on order_shipments";'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 3. Drop per-product COD fee & dispatch timeline columns
SET @exist_col := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'products'
    AND COLUMN_NAME = 'dispatch_lead_days'
);

SET @sql := IF(@exist_col > 0,
  'ALTER TABLE `products`
     DROP COLUMN `cod_fee`,
     DROP COLUMN `dispatch_lead_days`,
     DROP COLUMN `dispatch_timeline_text`;',
  'SELECT "Dispatch columns do not exist on products";'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 4. Drop logistics columns on orders
SET @exist_col := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'orders'
    AND COLUMN_NAME = 'payment_method'
);

SET @sql := IF(@exist_col > 0,
  'ALTER TABLE `orders`
     DROP COLUMN `payment_method`,
     DROP COLUMN `shipping_base_amount`,
     DROP COLUMN `shipping_markup_amount`,
     DROP COLUMN `shipping_courier_id`,
     DROP COLUMN `shipping_courier_name`,
     DROP COLUMN `shipping_estimated_days`,
     DROP COLUMN `shipping_rate_source`,
     DROP COLUMN `cod_fee_amount`,
     DROP COLUMN `cod_collected_at`;',
  'SELECT "Logistics columns do not exist on orders";'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
