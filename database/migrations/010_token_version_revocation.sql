-- =============================================================================
-- Dearr V1 — Migration 010: Session Token Versioning and Revocation
-- Database: Hostinger MySQL 8.x
-- Engine: InnoDB | Character Set: utf8mb4 | Collation: utf8mb4_unicode_ci
-- =============================================================================

-- Add persistent per-user token_version column to profiles table.
-- Default 1 preserves active sessions; incrementing on logout or password change
-- invalidates all previously issued JWTs server-side.
ALTER TABLE `profiles`
  ADD COLUMN `token_version` INT UNSIGNED NOT NULL DEFAULT 1 AFTER `role`,
  ADD KEY `idx_profiles_token_version` (`id`, `token_version`);
