-- =============================================================================
-- Dearr V1 — Migration 013: Shiprocket Logistics Integration & Order Shipments
-- Database: Hostinger MySQL 8.x
-- Engine: InnoDB | Character Set: utf8mb4 | Collation: utf8mb4_unicode_ci
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. order_shipments
-- Dedicated relational table for logistics lifecycle, courier assignments,
-- AWB generation, pickup tokens, and tracking snapshots.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `order_shipments` (
  `id` CHAR(36) NOT NULL,
  `order_id` CHAR(36) NOT NULL,
  `shiprocket_order_id` VARCHAR(100) DEFAULT NULL,
  `shiprocket_shipment_id` VARCHAR(100) DEFAULT NULL,
  `awb_code` VARCHAR(100) DEFAULT NULL,
  `courier_id` INT DEFAULT NULL,
  `courier_name` VARCHAR(150) DEFAULT NULL,
  `status` VARCHAR(50) NOT NULL DEFAULT 'NEW',
  `pickup_location` VARCHAR(100) NOT NULL DEFAULT 'Primary',
  `pickup_scheduled_date` DATETIME DEFAULT NULL,
  `pickup_token` VARCHAR(100) DEFAULT NULL,
  `etd` VARCHAR(50) DEFAULT NULL,
  `label_url` TEXT DEFAULT NULL,
  `manifest_url` TEXT DEFAULT NULL,
  `tracking_url` TEXT DEFAULT NULL,
  `last_tracking_activity` VARCHAR(255) DEFAULT NULL,
  `last_tracking_at` DATETIME DEFAULT NULL,
  `raw_response` JSON DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_order_shipments_awb` (`awb_code`),
  KEY `idx_order_shipments_order_id` (`order_id`),
  KEY `idx_order_shipments_sr_order` (`shiprocket_order_id`),
  KEY `idx_order_shipments_sr_shipment` (`shiprocket_shipment_id`),
  KEY `idx_order_shipments_status` (`status`),
  CONSTRAINT `fk_order_shipments_order` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 2. Fast lookup courier columns on `orders`
-- Adds lightweight courier references directly to the orders table.
-- -----------------------------------------------------------------------------
SET @exist_col := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'orders'
    AND COLUMN_NAME = 'awb_code'
);

SET @sql := IF(@exist_col = 0,
  'ALTER TABLE `orders`
     ADD COLUMN `awb_code` VARCHAR(100) DEFAULT NULL AFTER `cancelled_at`,
     ADD COLUMN `courier_name` VARCHAR(150) DEFAULT NULL AFTER `awb_code`,
     ADD COLUMN `courier_status` VARCHAR(50) DEFAULT NULL AFTER `courier_name`,
     ADD KEY `idx_orders_awb_code` (`awb_code`);',
  'SELECT "Column awb_code already exists on orders";'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
