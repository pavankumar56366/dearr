-- =============================================================================
-- Dearr V1 — Migration 009: Product-level Cash on Delivery (COD) Eligibility
-- Database: Hostinger MySQL 8.x
-- Engine: InnoDB | Character Set: utf8mb4 | Collation: utf8mb4_unicode_ci
-- =============================================================================

-- Add persistent per-product COD eligibility column to products table
-- Default 1 (enabled) preserves COD eligibility for products when global store COD is active.
ALTER TABLE `products`
  ADD COLUMN `cod_enabled` TINYINT(1) NOT NULL DEFAULT 1 AFTER `has_colors`,
  ADD KEY `idx_products_cod_enabled` (`cod_enabled`);
