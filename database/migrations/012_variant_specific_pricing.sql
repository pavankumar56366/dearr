-- =============================================================================
-- Dearr V1 — Migration 012: Variant-Specific Pricing Data Model
-- Database: Hostinger MySQL 8.x / Local Test Database
-- Authoritative Source: docs/5.SCHEMA(1).md & Task 1 Audit
-- Engine: InnoDB | Character Set: utf8mb4 | Collation: utf8mb4_unicode_ci
--
-- STATUS: LOCAL UNAPPLIED MIGRATION. DO NOT EXECUTE AGAINST HOSTINGER IN THIS TASK.
--
-- Purpose:
--   1. Extend `product_variants` with nullable `color_id` referencing `product_colors(id)`
--      to link purchasable variant combinations to specific product colorways.
--   2. Extend `product_variants` with nullable `size_name` (e.g., '10cm', '15cm', 'Small', 'Large')
--      for structured size specifications.
--   3. Add deterministic generated virtual/stored column `combo_hash` on `product_variants`
--      and a composite unique key `uq_product_variants_combo` on `(product_id, combo_hash)`
--      to guarantee that no duplicate (color, size) combinations exist for the same product,
--      while preserving multiple generic legacy variants (where both color_id and size_name are NULL).
--   4. Extend `stock_reservations` with nullable `variant_id` referencing `product_variants(id)`
--      to establish the data-model foundation for transactional combination stock reservations.
-- =============================================================================

-- Step 1: Extend `product_variants` table
ALTER TABLE `product_variants`
  ADD COLUMN `color_id` CHAR(36) DEFAULT NULL AFTER `product_id`,
  ADD COLUMN `size_name` VARCHAR(100) DEFAULT NULL AFTER `color_id`,
  ADD COLUMN `combo_hash` VARCHAR(150) GENERATED ALWAYS AS (
    CASE
      WHEN `color_id` IS NOT NULL OR (`size_name` IS NOT NULL AND TRIM(`size_name`) != '') THEN
        CONCAT(COALESCE(`color_id`, '00000000-0000-0000-0000-000000000000'), '::', LOWER(TRIM(`size_name`)))
      ELSE NULL
    END
  ) VIRTUAL AFTER `size_name`,
  ADD KEY `idx_product_variants_color_id` (`color_id`),
  ADD KEY `idx_product_variants_size_name` (`size_name`),
  ADD UNIQUE KEY `uq_product_variants_combo` (`product_id`, `combo_hash`),
  ADD CONSTRAINT `fk_product_variants_color`
    FOREIGN KEY (`color_id`) REFERENCES `product_colors` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Step 2: Extend `stock_reservations` table
ALTER TABLE `stock_reservations`
  ADD COLUMN `variant_id` CHAR(36) DEFAULT NULL AFTER `color_id`,
  ADD KEY `idx_stock_reservations_variant_status` (`variant_id`, `status`),
  ADD CONSTRAINT `fk_stock_reservations_variant`
    FOREIGN KEY (`variant_id`) REFERENCES `product_variants` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- =============================================================================
-- Rollback Instructions (Safe & Reversible):
--
-- ALTER TABLE `stock_reservations`
--   DROP FOREIGN KEY `fk_stock_reservations_variant`,
--   DROP KEY `idx_stock_reservations_variant_status`,
--   DROP COLUMN `variant_id`;
--
-- ALTER TABLE `product_variants`
--   DROP FOREIGN KEY `fk_product_variants_color`,
--   DROP KEY `uq_product_variants_combo`,
--   DROP KEY `idx_product_variants_color_id`,
--   DROP KEY `idx_product_variants_size_name`,
--   DROP COLUMN `combo_hash`,
--   DROP COLUMN `size_name`,
--   DROP COLUMN `color_id`;
-- =============================================================================
