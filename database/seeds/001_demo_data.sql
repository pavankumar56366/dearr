-- =============================================================================
-- Dearr V1 — Development Seed Data (Optional — NOT for Production)
-- Source: docs/5.SCHEMA(1).md (Section 5: Example Rows)
-- DO NOT EXECUTE AUTOMATICALLY ON PRODUCTION
-- =============================================================================

SET @OLD_FOREIGN_KEY_CHECKS = @@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS = 0;

-- 1. Profiles (Bcrypt hash corresponds to sample dev passwords)
INSERT INTO `profiles` (`id`, `email`, `password_hash`, `full_name`, `phone`, `role`)
VALUES
  ('user-001', 'priya@example.com', '$2a$10$w8T9c0sK3E1m4P0Z2Y8L.ex81f6P7P2cK0R9j7N4v5E1m8P0Z2Y8L', 'Priya Rao', '9876543210', 'customer'),
  ('admin-001', 'founder@dearr.in', '$2a$10$w8T9c0sK3E1m4P0Z2Y8L.ex81f6P7P2cK0R9j7N4v5E1m8P0Z2Y8L', 'Dearr Founder', '9123456780', 'admin')
ON DUPLICATE KEY UPDATE `email` = VALUES(`email`);

-- 2. Categories
INSERT INTO `categories` (`id`, `name`, `slug`, `description`, `is_active`)
VALUES
  ('cat-001', 'Gifts', 'gifts', 'Curated 3D printed gifting items', 1),
  ('cat-002', 'Home Decor', 'home-decor', 'Artistic prints and functional tabletop decor', 1)
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);

-- 3. Products
INSERT INTO `products` (`id`, `category_id`, `name`, `slug`, `description`, `price`, `compare_at_price`, `stock_quantity`, `is_featured`, `is_active`)
VALUES
  ('prod-001', 'cat-001', 'Love Mug', 'love-mug', 'Custom dual-tone 3D printed keepsake mug', 499.00, 599.00, 25, 1, 1),
  ('prod-002', 'cat-002', 'Mini Vase', 'mini-vase', 'Geometric architectural tabletop vase in silk PLA', 399.00, 399.00, 12, 0, 1)
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);

-- 4. Product Images
INSERT INTO `product_images` (`id`, `product_id`, `storage_path`, `alt_text`, `sort_order`)
VALUES
  ('img-001', 'prod-001', 'uploads/products/love-mug/main.webp', 'Love Mug front view', 0),
  ('img-002', 'prod-001', 'uploads/products/love-mug/side.webp', 'Love Mug side view', 1)
ON DUPLICATE KEY UPDATE `storage_path` = VALUES(`storage_path`);

-- 5. Product Variants
INSERT INTO `product_variants` (`id`, `product_id`, `name`, `sku`, `price`, `stock_quantity`, `is_active`)
VALUES
  ('var-001', 'prod-001', 'Pink', 'MUG-PINK-01', 499.00, 10, 1),
  ('var-002', 'prod-001', 'Yellow', 'MUG-YELLOW-01', 499.00, 15, 1)
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);

-- 6. Discounts
INSERT INTO `discounts` (`id`, `name`, `code`, `discount_type`, `value`, `scope`, `start_at`, `end_at`, `is_active`)
VALUES
  ('disc-001', 'Festival Sale', 'FEST10', 'percentage', 10.00, 'store', '2026-01-01 00:00:00', NULL, 1),
  ('disc-002', 'Mug Offer', 'MUG50', 'fixed_amount', 50.00, 'product', '2026-01-01 00:00:00', NULL, 1)
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);

-- 7. Discount Product & Category mappings
INSERT INTO `discount_products` (`id`, `discount_id`, `product_id`)
VALUES ('dp-001', 'disc-002', 'prod-001')
ON DUPLICATE KEY UPDATE `id` = VALUES(`id`);

INSERT INTO `discount_categories` (`id`, `discount_id`, `category_id`)
VALUES ('dc-001', 'disc-001', 'cat-001')
ON DUPLICATE KEY UPDATE `id` = VALUES(`id`);

-- 8. Customer Saved Addresses
INSERT INTO `addresses` (`id`, `user_id`, `label`, `full_name`, `phone`, `address_line_1`, `city`, `state`, `postal_code`, `country`, `is_default`)
VALUES
  ('addr-001', 'user-001', 'Home', 'Priya Rao', '9876543210', 'Flat 402, Lotus Residency, MG Road', 'Vijayawada', 'Andhra Pradesh', '520001', 'India', 1),
  ('addr-002', 'user-001', 'Office', 'Priya Rao', '9876543210', 'Plot 12, Tech Zone, IT Expressway', 'Vijayawada', 'Andhra Pradesh', '520010', 'India', 0)
ON DUPLICATE KEY UPDATE `full_name` = VALUES(`full_name`);

SET FOREIGN_KEY_CHECKS = @OLD_FOREIGN_KEY_CHECKS;
