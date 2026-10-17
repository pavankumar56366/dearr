-- =============================================================================
-- Dearr V1 — Migration 007: Customer Delivery Address Change with Admin-Controlled
-- Time Window, Order Address History, Settings Audit History, and Rate Limiting
-- Database: Hostinger MySQL 8.x / Local Test Database
-- =============================================================================

-- Step 1: Extend `orders` table with fixed address-edit deadline and change counter
ALTER TABLE `orders`
  ADD COLUMN `address_edit_deadline` DATETIME DEFAULT NULL AFTER `cancelled_at`,
  ADD COLUMN `address_change_count` INT NOT NULL DEFAULT 0 AFTER `address_edit_deadline`,
  ADD KEY `idx_orders_address_edit_deadline` (`address_edit_deadline`);

-- Step 2: Create `order_address_history` table for immutable address change snapshots
CREATE TABLE IF NOT EXISTS `order_address_history` (
  `id` CHAR(36) NOT NULL,
  `order_id` CHAR(36) NOT NULL,
  `old_address` JSON NOT NULL,
  `new_address` JSON NOT NULL,
  `changed_by` ENUM('customer', 'admin') NOT NULL DEFAULT 'customer',
  `actor_id` CHAR(36) DEFAULT NULL,
  `ip_address` VARCHAR(45) DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_order_address_history_order` (`order_id`),
  KEY `idx_order_address_history_created_at` (`created_at`),
  CONSTRAINT `fk_order_address_history_order` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Step 3: Create `settings_audit_history` table for administrative order policy audits
CREATE TABLE IF NOT EXISTS `settings_audit_history` (
  `id` CHAR(36) NOT NULL,
  `actor_id` CHAR(36) NOT NULL,
  `setting_name` VARCHAR(100) NOT NULL,
  `old_value` JSON DEFAULT NULL,
  `new_value` JSON NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_settings_audit_history_actor` (`actor_id`),
  KEY `idx_settings_audit_history_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Step 4: Create `rate_limits` table for multi-instance persistent rate limiting
CREATE TABLE IF NOT EXISTS `rate_limits` (
  `rate_key` VARCHAR(150) NOT NULL,
  `hits` INT NOT NULL DEFAULT 1,
  `reset_at` DATETIME NOT NULL,
  PRIMARY KEY (`rate_key`),
  KEY `idx_rate_limits_reset` (`reset_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
