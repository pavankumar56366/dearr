-- =============================================================================
-- Dearr V1 — Migration 006: Product Color Variants, Color Galleries,
-- Multi-Color Cart & Checkout Snapshots, and Stock Reservations
-- Database: Hostinger MySQL 8.x
--
-- STATUS: LOCAL UNAPPLIED MIGRATION. DO NOT EXECUTE AGAINST HOSTINGER IN THIS TASK.
--
-- Purpose:
--   1. Add has_colors boolean flag to `products` (defaults to 0 for single-SKU legacy products).
--   2. Create `product_colors` table for up to 12 colors per product with independent stock,
--      reserved_stock, slug, hex, sku, price_override, sort_order, and is_active flag.
--   3. Extend `product_images` with color_id (NULL = shared image, UUID = color-specific image).
--   4. Extend `cart_items` with color_id for distinct product+color cart line identities.
--   5. Extend `order_items` with color_id, color_name, color_hex, sku, and image_url snapshots.
--   6. Create `stock_reservations` table for transactional, attempt-bound stock reservations.
-- =============================================================================

-- Step 1: Add has_colors flag to `products`
ALTER TABLE `products`
  ADD COLUMN `has_colors` TINYINT(1) NOT NULL DEFAULT 0 AFTER `is_active`,
  ADD KEY `idx_products_has_colors` (`has_colors`);

-- Step 2: Create `product_colors` table
CREATE TABLE IF NOT EXISTS `product_colors` (
  `id` CHAR(36) NOT NULL,
  `product_id` CHAR(36) NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `slug` VARCHAR(100) NOT NULL,
  `hex` VARCHAR(20) NOT NULL,
  `sku` VARCHAR(100) DEFAULT NULL,
  `stock` INT NOT NULL DEFAULT 0,
  `reserved_stock` INT NOT NULL DEFAULT 0,
  `price_override` DECIMAL(10,2) DEFAULT NULL,
  `sort_order` INT NOT NULL DEFAULT 0,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_product_colors_product_name` (`product_id`, `name`),
  UNIQUE KEY `uq_product_colors_product_slug` (`product_id`, `slug`),
  UNIQUE KEY `uq_product_colors_sku` (`sku`),
  KEY `idx_product_colors_product_sort` (`product_id`, `sort_order`),
  KEY `idx_product_colors_is_active` (`is_active`),
  CONSTRAINT `chk_product_colors_stock` CHECK (`stock` >= 0),
  CONSTRAINT `chk_product_colors_reserved_stock` CHECK (`reserved_stock` >= 0),
  CONSTRAINT `chk_product_colors_price_override` CHECK (`price_override` IS NULL OR `price_override` >= 0),
  CONSTRAINT `chk_product_colors_sort_order` CHECK (`sort_order` >= 0),
  CONSTRAINT `fk_product_colors_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Step 3: Extend `product_images` with color_id
ALTER TABLE `product_images`
  ADD COLUMN `color_id` CHAR(36) DEFAULT NULL AFTER `product_id`,
  ADD KEY `idx_product_images_color` (`color_id`),
  ADD KEY `idx_product_images_product_color_sort` (`product_id`, `color_id`, `sort_order`),
  ADD CONSTRAINT `fk_product_images_color` FOREIGN KEY (`color_id`) REFERENCES `product_colors` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Step 4: Extend `cart_items` with color_id
ALTER TABLE `cart_items`
  ADD COLUMN `color_id` CHAR(36) DEFAULT NULL AFTER `variant_id`,
  ADD KEY `idx_cart_items_color_id` (`color_id`),
  ADD KEY `idx_cart_items_cart_product_color` (`cart_id`, `product_id`, `color_id`),
  ADD CONSTRAINT `fk_cart_items_color` FOREIGN KEY (`color_id`) REFERENCES `product_colors` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- Step 5: Extend `order_items` with historical color snapshot fields
ALTER TABLE `order_items`
  ADD COLUMN `color_id` CHAR(36) DEFAULT NULL AFTER `variant_id`,
  ADD COLUMN `color_name` VARCHAR(100) DEFAULT NULL AFTER `variant_name`,
  ADD COLUMN `color_hex` VARCHAR(20) DEFAULT NULL AFTER `color_name`,
  ADD COLUMN `sku` VARCHAR(100) DEFAULT NULL AFTER `color_hex`,
  ADD COLUMN `image_url` VARCHAR(500) DEFAULT NULL AFTER `line_total`,
  ADD KEY `idx_order_items_color_id` (`color_id`),
  ADD CONSTRAINT `fk_order_items_color` FOREIGN KEY (`color_id`) REFERENCES `product_colors` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- Step 6: Create `stock_reservations` table for transactional checkout attempts
CREATE TABLE IF NOT EXISTS `stock_reservations` (
  `id` CHAR(36) NOT NULL,
  `attempt_id` CHAR(36) NOT NULL,
  `product_id` CHAR(36) NOT NULL,
  `color_id` CHAR(36) DEFAULT NULL,
  `quantity` INT NOT NULL,
  `status` ENUM('active', 'consumed', 'released') NOT NULL DEFAULT 'active',
  `expires_at` DATETIME NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_stock_reservations_attempt` (`attempt_id`),
  KEY `idx_stock_reservations_color_status` (`color_id`, `status`),
  KEY `idx_stock_reservations_status_expires` (`status`, `expires_at`),
  CONSTRAINT `chk_stock_reservations_quantity` CHECK (`quantity` > 0),
  CONSTRAINT `fk_stock_reservations_attempt` FOREIGN KEY (`attempt_id`) REFERENCES `checkout_attempts` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_stock_reservations_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_stock_reservations_color` FOREIGN KEY (`color_id`) REFERENCES `product_colors` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
