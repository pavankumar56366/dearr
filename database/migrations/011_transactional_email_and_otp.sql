-- =============================================================================
-- Dearr V1 — Migration 011: Transactional Email Outbox & Password Reset OTP
-- Database: Hostinger MySQL 8.x
-- Authoritative Source: docs/5.SCHEMA(1).md
-- Engine: InnoDB | Character Set: utf8mb4 | Collation: utf8mb4_unicode_ci
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. password_reset_otps
-- Cryptographically secure, rate-limited, single-use password reset OTP records.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `password_reset_otps` (
  `id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) NOT NULL,
  `email` VARCHAR(255) NOT NULL,
  `otp_hash` VARCHAR(255) NOT NULL,
  `attempts` INT NOT NULL DEFAULT 0,
  `max_attempts` INT NOT NULL DEFAULT 5,
  `expires_at` DATETIME NOT NULL,
  `consumed_at` DATETIME DEFAULT NULL,
  `ip_address` VARCHAR(45) DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_password_reset_otps_user` (`user_id`, `created_at`),
  KEY `idx_password_reset_otps_email` (`email`),
  KEY `idx_password_reset_otps_expires` (`expires_at`),
  CONSTRAINT `fk_password_reset_otps_user` FOREIGN KEY (`user_id`) REFERENCES `profiles` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 2. email_outbox
-- Durable transactional email outbox for order payment confirmations & system notices.
-- Provides database-level idempotency, retry tracking, and decoupled provider dispatch.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `email_outbox` (
  `id` CHAR(36) NOT NULL,
  `event_type` VARCHAR(50) NOT NULL,
  `idempotency_key` VARCHAR(120) NOT NULL,
  `recipient_email` VARCHAR(255) NOT NULL,
  `recipient_name` VARCHAR(150) DEFAULT NULL,
  `order_id` CHAR(36) DEFAULT NULL,
  `payload` JSON DEFAULT NULL,
  `status` ENUM('pending', 'processing', 'sent', 'failed') NOT NULL DEFAULT 'pending',
  `attempts` INT NOT NULL DEFAULT 0,
  `max_attempts` INT NOT NULL DEFAULT 5,
  `next_retry_at` DATETIME DEFAULT NULL,
  `provider_message_id` VARCHAR(100) DEFAULT NULL,
  `last_error` TEXT DEFAULT NULL,
  `sent_at` DATETIME DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_email_outbox_idempotency` (`idempotency_key`),
  KEY `idx_email_outbox_status_retry` (`status`, `next_retry_at`),
  KEY `idx_email_outbox_order` (`order_id`),
  KEY `idx_email_outbox_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
