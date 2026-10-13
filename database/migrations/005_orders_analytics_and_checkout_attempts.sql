-- =============================================================================
-- Dearr V1 — Migration 005: Orders Analytics, Transition Timestamps,
-- Export Audits, and Checkout Attempt Lifecycle
-- Database: Hostinger MySQL 8.x
--
-- STATUS: LOCAL UNAPPLIED MIGRATION. DO NOT EXECUTE AGAINST HOSTINGER IN THIS TASK.
--
-- Purpose:
--   1. Add transition timestamps (dispatched_at, delivered_at, cancelled_at) to orders
--   2. Add composite index on orders (created_at, status) for reporting range aggregation
--   3. Create checkout_attempts table for separating unpaid online checkout attempts
--      with 30-minute expiry and 30-day retention
--   4. Create order_status_history table to preserve historical transition timestamps
--   5. Create order_export_audits table to securely log administrative CSV exports
-- =============================================================================

-- Step 1: Add transition timestamps and reporting index to `orders` table
ALTER TABLE `orders`
  ADD COLUMN `dispatched_at` DATETIME DEFAULT NULL AFTER `updated_at`,
  ADD COLUMN `delivered_at` DATETIME DEFAULT NULL AFTER `dispatched_at`,
  ADD COLUMN `cancelled_at` DATETIME DEFAULT NULL AFTER `delivered_at`,
  ADD KEY `idx_orders_created_at_status` (`created_at`, `status`),
  ADD KEY `idx_orders_created_at_payment` (`created_at`, `payment_status`);

-- Step 2: Create `checkout_attempts` table
-- Tracks online payment checkout attempts separately from placed orders.
-- Unpaid attempts expire after 30 minutes and are purged after 30 days retention.
CREATE TABLE IF NOT EXISTS `checkout_attempts` (
  `id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) NOT NULL,
  `cart_id` CHAR(36) DEFAULT NULL,
  `provider` VARCHAR(50) NOT NULL DEFAULT 'razorpay',
  `provider_order_id` VARCHAR(100) DEFAULT NULL,
  `provider_payment_id` VARCHAR(100) DEFAULT NULL,
  `order_id` CHAR(36) DEFAULT NULL,
  `status` ENUM('pending', 'verified', 'converted', 'expired', 'failed') NOT NULL DEFAULT 'pending',
  `amount` DECIMAL(10,2) NOT NULL,
  `currency` CHAR(3) NOT NULL DEFAULT 'INR',
  `checkout_data` JSON NOT NULL,
  `expires_at` DATETIME NOT NULL,
  `retention_until` DATETIME NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_checkout_attempts_provider_order` (`provider_order_id`),
  KEY `idx_checkout_attempts_user_status` (`user_id`, `status`),
  KEY `idx_checkout_attempts_expires_at` (`status`, `expires_at`),
  KEY `idx_checkout_attempts_retention` (`status`, `retention_until`),
  KEY `idx_checkout_attempts_order_id` (`order_id`),
  KEY `idx_checkout_attempts_created_at` (`created_at`),
  CONSTRAINT `chk_checkout_attempts_amount` CHECK (`amount` >= 0),
  CONSTRAINT `fk_checkout_attempts_user` FOREIGN KEY (`user_id`) REFERENCES `profiles` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Step 3: Create `order_status_history` table
-- Reliably preserves order lifecycle status transitions and actor notes.
CREATE TABLE IF NOT EXISTS `order_status_history` (
  `id` CHAR(36) NOT NULL,
  `order_id` CHAR(36) NOT NULL,
  `previous_status` VARCHAR(50) DEFAULT NULL,
  `new_status` VARCHAR(50) NOT NULL,
  `changed_by` CHAR(36) DEFAULT NULL,
  `note` VARCHAR(255) DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_status_history_order` (`order_id`, `created_at`),
  KEY `idx_status_history_changed_by` (`changed_by`),
  CONSTRAINT `fk_status_history_order` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_status_history_actor` FOREIGN KEY (`changed_by`) REFERENCES `profiles` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Step 4: Create `order_export_audits` table
-- Administrative tracking for order and summary CSV exports (actor, range, row count, outcome).
CREATE TABLE IF NOT EXISTS `order_export_audits` (
  `id` CHAR(36) NOT NULL,
  `actor_id` CHAR(36) NOT NULL,
  `export_type` ENUM('orders', 'summary') NOT NULL,
  `period` VARCHAR(20) NOT NULL,
  `date_range_start` DATETIME DEFAULT NULL,
  `date_range_end` DATETIME DEFAULT NULL,
  `filter_criteria` JSON DEFAULT NULL,
  `row_count` INT NOT NULL DEFAULT 0,
  `status` ENUM('success', 'failed') NOT NULL DEFAULT 'success',
  `error_message` VARCHAR(255) DEFAULT NULL,
  `ip_address` VARCHAR(45) DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_export_audits_actor` (`actor_id`, `created_at`),
  KEY `idx_export_audits_created_at` (`created_at`),
  CONSTRAINT `fk_export_audits_actor` FOREIGN KEY (`actor_id`) REFERENCES `profiles` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
