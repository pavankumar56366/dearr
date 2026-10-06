-- =============================================================================
-- Dearr V1 — Migration 003: Customer Account Status and Store Settings
-- Database: Hostinger MySQL 8.x
-- Purpose:
--   1. Add status and admin_notes to `profiles` for persistent customer management
--      and suspension enforcement.
--   2. Create `store_settings` table for persistent store configuration.
-- =============================================================================

-- Step 1: Add status and admin_notes to profiles
ALTER TABLE `profiles`
  ADD COLUMN `status` ENUM('active', 'suspended') NOT NULL DEFAULT 'active' AFTER `role`,
  ADD COLUMN `admin_notes` TEXT DEFAULT NULL AFTER `status`,
  ADD KEY `idx_profiles_status` (`status`);

-- Step 2: Create store_settings table
CREATE TABLE IF NOT EXISTS `store_settings` (
  `id` INT NOT NULL DEFAULT 1,
  `settings_json` JSON NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
