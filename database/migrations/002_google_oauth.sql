-- =============================================================================
-- Dearr V1 — Migration 002: Google OAuth Identity Column
-- Database: Hostinger MySQL 8.x
-- Purpose: Add google_subject (Google OIDC `sub`) to profiles for OAuth login.
-- Design:
--   • Nullable so all existing email/password accounts are unaffected.
--   • UNIQUE so the same Google account cannot be linked to two Dearr profiles.
--   • VARCHAR(255) to accommodate all current and plausible future Google sub formats.
-- =============================================================================

ALTER TABLE `profiles`
  ADD COLUMN `google_subject` VARCHAR(255) DEFAULT NULL AFTER `email`,
  ADD COLUMN `password_hash_nullable` VARCHAR(255) DEFAULT NULL AFTER `password_hash`;

-- Allow password_hash to be NULL for Google-only accounts that have no password.
-- We achieve this by modifying the column to be nullable.
ALTER TABLE `profiles`
  MODIFY COLUMN `password_hash` VARCHAR(255) DEFAULT NULL;

-- Drop the temporary helper column
ALTER TABLE `profiles`
  DROP COLUMN `password_hash_nullable`;

-- Add unique index on google_subject so one Google account maps to one Dearr profile.
ALTER TABLE `profiles`
  ADD UNIQUE KEY `idx_profiles_google_subject` (`google_subject`);
