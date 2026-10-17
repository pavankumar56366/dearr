-- =============================================================================
-- Dearr V1 — Migration 008: Cart Abandonment Recovery, Checkout Feedback,
-- Notification Consent, Product Price History, and Internal Events
-- Database: Hostinger MySQL 8.x / Local Test Database (dearr_test)
-- =============================================================================

-- Step 1: Extend `checkout_attempts` table with recovery and error details
ALTER TABLE `checkout_attempts`
  MODIFY COLUMN `status` ENUM('pending', 'verified', 'converted', 'expired', 'failed', 'abandoned') NOT NULL DEFAULT 'pending',
  ADD COLUMN `recovery_shown_at` DATETIME DEFAULT NULL AFTER `order_id`,
  ADD COLUMN `abandoned_at` DATETIME DEFAULT NULL AFTER `recovery_shown_at`,
  ADD COLUMN `gateway_error_code` VARCHAR(100) DEFAULT NULL AFTER `abandoned_at`,
  ADD COLUMN `gateway_error_desc` VARCHAR(500) DEFAULT NULL AFTER `gateway_error_code`,
  ADD KEY `idx_checkout_attempts_status_abandoned` (`status`, `abandoned_at`),
  ADD KEY `idx_checkout_attempts_recovery_shown` (`status`, `recovery_shown_at`);

-- Step 2: Create `checkout_feedback` table for post-abandonment customer feedback
CREATE TABLE IF NOT EXISTS `checkout_feedback` (
  `id` CHAR(36) NOT NULL,
  `attempt_id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) DEFAULT NULL,
  `guest_identifier` VARCHAR(100) DEFAULT NULL,
  `reasons` JSON NOT NULL,
  `comment` VARCHAR(300) DEFAULT NULL,
  `skipped` TINYINT(1) NOT NULL DEFAULT 0,
  `ip_address` VARCHAR(45) DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_checkout_feedback_attempt` (`attempt_id`),
  KEY `idx_checkout_feedback_user` (`user_id`),
  KEY `idx_checkout_feedback_created_at` (`created_at`),
  CONSTRAINT `fk_checkout_feedback_attempt` FOREIGN KEY (`attempt_id`) REFERENCES `checkout_attempts` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Step 3: Create `notification_consents` table for future cart recovery notifications (data-only)
CREATE TABLE IF NOT EXISTS `notification_consents` (
  `id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) DEFAULT NULL,
  `attempt_id` CHAR(36) DEFAULT NULL,
  `channel` ENUM('email', 'whatsapp', 'sms') NOT NULL,
  `contact_value` VARCHAR(255) NOT NULL,
  `consent_text` VARCHAR(500) NOT NULL,
  `source` VARCHAR(50) NOT NULL DEFAULT 'checkout_abandonment',
  `is_withdrawn` TINYINT(1) NOT NULL DEFAULT 0,
  `withdrawn_at` DATETIME DEFAULT NULL,
  `ip_address` VARCHAR(45) DEFAULT NULL,
  `user_agent` VARCHAR(255) DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_notification_consents_user` (`user_id`),
  KEY `idx_notification_consents_attempt` (`attempt_id`),
  KEY `idx_notification_consents_channel_contact` (`channel`, `contact_value`),
  KEY `idx_notification_consents_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Step 4: Create `product_price_history` table for auditing and future price-drop notifications
CREATE TABLE IF NOT EXISTS `product_price_history` (
  `id` CHAR(36) NOT NULL,
  `product_id` CHAR(36) NOT NULL,
  `color_id` CHAR(36) DEFAULT NULL,
  `previous_price` DECIMAL(10,2) NOT NULL,
  `new_price` DECIMAL(10,2) NOT NULL,
  `current_price` DECIMAL(10,2) NOT NULL,
  `change_source` VARCHAR(50) NOT NULL DEFAULT 'admin',
  `changed_by` CHAR(36) DEFAULT NULL,
  `changed_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_price_history_product_time` (`product_id`, `changed_at`),
  KEY `idx_price_history_color` (`color_id`),
  KEY `idx_price_history_changed_at` (`changed_at`),
  CONSTRAINT `fk_price_history_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Step 5: Create `internal_events` table for checkout funnel and recovery tracking
CREATE TABLE IF NOT EXISTS `internal_events` (
  `id` CHAR(36) NOT NULL,
  `event_type` VARCHAR(50) NOT NULL,
  `attempt_id` CHAR(36) DEFAULT NULL,
  `order_id` CHAR(36) DEFAULT NULL,
  `user_id` CHAR(36) DEFAULT NULL,
  `session_id` VARCHAR(100) DEFAULT NULL,
  `metadata` JSON DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_internal_events_type_time` (`event_type`, `created_at`),
  KEY `idx_internal_events_attempt` (`attempt_id`),
  KEY `idx_internal_events_order` (`order_id`),
  KEY `idx_internal_events_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Step 6: Extend `order_export_audits` to support abandonment analytics exports
ALTER TABLE `order_export_audits`
  MODIFY COLUMN `export_type` ENUM('orders', 'summary', 'abandonment') NOT NULL;
