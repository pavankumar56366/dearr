-- =============================================================================
-- Dearr V1 — Migration 014: Advanced Logistics, Freight Accounting & Tracking
-- Database: Hostinger MySQL 8.x
-- Engine: InnoDB | Character Set: utf8mb4 | Collation: utf8mb4_unicode_ci
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Extend `orders` with authoritative logistics & freight accounting columns
-- -----------------------------------------------------------------------------
SET @exist_col := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'orders'
    AND COLUMN_NAME = 'payment_method'
);

SET @sql := IF(@exist_col = 0,
  'ALTER TABLE `orders`
     ADD COLUMN `payment_method` VARCHAR(50) DEFAULT ''prepaid'' AFTER `currency`,
     ADD COLUMN `shipping_base_amount` DECIMAL(10,2) DEFAULT 0.00 AFTER `shipping_amount`,
     ADD COLUMN `shipping_markup_amount` DECIMAL(10,2) DEFAULT 0.00 AFTER `shipping_base_amount`,
     ADD COLUMN `shipping_courier_id` INT DEFAULT NULL AFTER `shipping_markup_amount`,
     ADD COLUMN `shipping_courier_name` VARCHAR(150) DEFAULT NULL AFTER `shipping_courier_id`,
     ADD COLUMN `shipping_estimated_days` INT DEFAULT NULL AFTER `shipping_courier_name`,
     ADD COLUMN `shipping_rate_source` VARCHAR(50) DEFAULT ''standard'' AFTER `shipping_estimated_days`,
     ADD COLUMN `cod_fee_amount` DECIMAL(10,2) DEFAULT 0.00 AFTER `shipping_rate_source`,
     ADD COLUMN `cod_collected_at` DATETIME DEFAULT NULL AFTER `cod_fee_amount`;',
  'SELECT "Logistics columns already exist on orders";'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- -----------------------------------------------------------------------------
-- 2. Extend `products` with per-product COD fee & dispatch timeline
-- -----------------------------------------------------------------------------
SET @exist_col := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'products'
    AND COLUMN_NAME = 'dispatch_lead_days'
);

SET @sql := IF(@exist_col = 0,
  'ALTER TABLE `products`
     ADD COLUMN `cod_fee` DECIMAL(10,2) DEFAULT NULL AFTER `cod_enabled`,
     ADD COLUMN `dispatch_lead_days` INT DEFAULT 2 AFTER `cod_fee`,
     ADD COLUMN `dispatch_timeline_text` VARCHAR(100) DEFAULT NULL AFTER `dispatch_lead_days`;',
  'SELECT "Dispatch columns already exist on products";'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- -----------------------------------------------------------------------------
-- 3. Extend `order_shipments` with actual freight cost
-- -----------------------------------------------------------------------------
SET @exist_col := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'order_shipments'
    AND COLUMN_NAME = 'shipment_actual_cost'
);

SET @sql := IF(@exist_col = 0,
  'ALTER TABLE `order_shipments`
     ADD COLUMN `shipment_actual_cost` DECIMAL(10,2) DEFAULT NULL AFTER `courier_name`;',
  'SELECT "shipment_actual_cost already exists on order_shipments";'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- -----------------------------------------------------------------------------
-- 4. Create `shipment_tracking_events` table for live tracking milestone history
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `shipment_tracking_events` (
  `id` CHAR(36) NOT NULL,
  `order_id` CHAR(36) NOT NULL,
  `shipment_id` CHAR(36) DEFAULT NULL,
  `awb_code` VARCHAR(100) NOT NULL,
  `activity` VARCHAR(255) NOT NULL,
  `location` VARCHAR(150) DEFAULT NULL,
  `event_timestamp` DATETIME NOT NULL,
  `sr_status` VARCHAR(50) DEFAULT NULL,
  `raw_scan` JSON DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_tracking_event_unique` (`awb_code`, `activity`, `event_timestamp`),
  KEY `idx_tracking_order_id` (`order_id`),
  CONSTRAINT `fk_tracking_order` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
