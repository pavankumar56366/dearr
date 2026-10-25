-- =============================================================================
-- Dearr V1 — Production Database Schema Preflight Inspection
-- Database Engine: Hostinger MySQL 8.x
-- Purpose: Read-Only Verification of Migrations 005 through 011
--
-- INSTRUCTIONS FOR AUTHORIZED DATABASE OPERATOR:
-- 1. Log in to Hostinger phpMyAdmin (or open MySQL command line).
-- 2. Select the target Dearr database (e.g. USE `u123456789_dearr`;).
-- 3. Run this script in its entirety.
-- 4. SAFETY GUARANTEE: This script is 100% READ-ONLY. It executes only SELECT
--    queries against `information_schema` and `DATABASE()`. No tables, rows,
--    or schemas are created, altered, or deleted.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- REPORT 1: MIGRATION ROLLUP & COVERAGE SUMMARY
-- Evaluates the existence of all schema objects introduced in migrations 005 - 011.
-- -----------------------------------------------------------------------------
SELECT 
  m.migration_id AS `Migration`,
  m.feature_description AS `Feature Description`,
  CASE 
    WHEN m.found_count = m.expected_count THEN 'CONFIRMED APPLIED'
    WHEN m.found_count = 0 THEN 'CONFIRMED ABSENT'
    ELSE 'PARTIALLY APPLIED / INCOMPLETE'
  END AS `Status`,
  CONCAT(m.found_count, ' / ', m.expected_count, ' items detected') AS `Item Coverage`,
  CASE 
    WHEN m.found_count = m.expected_count THEN 'DO NOT RUN (Already present)'
    WHEN m.found_count = 0 THEN 'SAFE TO APPLY'
    ELSE 'ACTION REQUIRED: Review individual columns/tables before applying'
  END AS `Operator Guidance`
FROM (
  -- Migration 005: Orders Analytics & Checkout Attempts
  SELECT 
    '005_orders_analytics' AS migration_id,
    'Order timestamps (dispatched/delivered/cancelled) & checkout_attempts' AS feature_description,
    (
      SELECT COUNT(*) FROM information_schema.columns 
      WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name IN ('dispatched_at', 'delivered_at', 'cancelled_at')
    ) + (
      SELECT COUNT(*) FROM information_schema.tables 
      WHERE table_schema = DATABASE() AND table_name IN ('checkout_attempts', 'order_status_history', 'order_export_audits')
    ) AS found_count,
    6 AS expected_count

  UNION ALL

  -- Migration 006: Product Color Variants
  SELECT 
    '006_product_color_variants',
    'Product colors, color galleries, & multi-color cart/order snapshots',
    (
      SELECT COUNT(*) FROM information_schema.columns 
      WHERE table_schema = DATABASE() AND (
        (table_name = 'products' AND column_name = 'has_colors') OR
        (table_name = 'product_images' AND column_name = 'color_id') OR
        (table_name = 'cart_items' AND column_name = 'color_id') OR
        (table_name = 'order_items' AND column_name IN ('color_id', 'color_name', 'color_hex', 'sku', 'image_url'))
      )
    ) + (
      SELECT COUNT(*) FROM information_schema.tables 
      WHERE table_schema = DATABASE() AND table_name IN ('product_colors', 'stock_reservations')
    ),
    10

  UNION ALL

  -- Migration 007: Order Address Change & Rate Limiting
  SELECT 
    '007_order_address_change',
    'Customer address edit deadline, audit history, & rate_limits table',
    (
      SELECT COUNT(*) FROM information_schema.columns 
      WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name IN ('address_edit_deadline', 'address_change_count')
    ) + (
      SELECT COUNT(*) FROM information_schema.tables 
      WHERE table_schema = DATABASE() AND table_name IN ('order_address_history', 'settings_audit_history', 'rate_limits')
    ),
    5

  UNION ALL

  -- Migration 008: Cart Abandonment Recovery
  SELECT 
    '008_cart_abandonment_recovery',
    'Cart abandonment recovery, checkout feedback, & internal events',
    (
      SELECT COUNT(*) FROM information_schema.columns 
      WHERE table_schema = DATABASE() AND table_name = 'checkout_attempts' AND column_name IN ('recovery_shown_at', 'abandoned_at', 'gateway_error_code', 'gateway_error_desc')
    ) + (
      SELECT COUNT(*) FROM information_schema.tables 
      WHERE table_schema = DATABASE() AND table_name IN ('checkout_feedback', 'notification_consents', 'product_price_history', 'internal_events')
    ),
    8

  UNION ALL

  -- Migration 009: Product-level COD Eligibility
  SELECT 
    '009_product_cod_eligibility',
    'Product-level Cash on Delivery (COD) eligibility flag',
    (
      SELECT COUNT(*) FROM information_schema.columns 
      WHERE table_schema = DATABASE() AND table_name = 'products' AND column_name = 'cod_enabled'
    ),
    1

  UNION ALL

  -- Migration 010: Session Token Versioning
  SELECT 
    '010_token_version_revocation',
    'Server-side JWT token versioning & session revocation',
    (
      SELECT COUNT(*) FROM information_schema.columns 
      WHERE table_schema = DATABASE() AND table_name = 'profiles' AND column_name = 'token_version'
    ),
    1

  UNION ALL

  -- Migration 011: Transactional Email & Password Reset OTP
  SELECT 
    '011_transactional_email_and_otp',
    'Password reset OTP table & transactional email outbox',
    (
      SELECT COUNT(*) FROM information_schema.tables 
      WHERE table_schema = DATABASE() AND table_name IN ('password_reset_otps', 'email_outbox')
    ),
    2
) AS m;

-- -----------------------------------------------------------------------------
-- REPORT 2: DETAILED TABLE PRESENCE AUDIT
-- -----------------------------------------------------------------------------
SELECT 
  req.table_name AS `Table Name`,
  req.introduced_in AS `Migration`,
  CASE 
    WHEN t.table_name IS NOT NULL THEN 'CONFIRMED PRESENT'
    ELSE 'ABSENT (Pending Migration)'
  END AS `Existence Status`,
  t.engine AS `Engine`,
  t.table_rows AS `Approx Rows`
FROM (
  SELECT 'checkout_attempts' AS table_name, '005' AS introduced_in UNION ALL
  SELECT 'order_status_history', '005' UNION ALL
  SELECT 'order_export_audits', '005' UNION ALL
  SELECT 'product_colors', '006' UNION ALL
  SELECT 'stock_reservations', '006' UNION ALL
  SELECT 'order_address_history', '007' UNION ALL
  SELECT 'settings_audit_history', '007' UNION ALL
  SELECT 'rate_limits', '007' UNION ALL
  SELECT 'checkout_feedback', '008' UNION ALL
  SELECT 'notification_consents', '008' UNION ALL
  SELECT 'product_price_history', '008' UNION ALL
  SELECT 'internal_events', '008' UNION ALL
  SELECT 'password_reset_otps', '011' UNION ALL
  SELECT 'email_outbox', '011'
) AS req
LEFT JOIN information_schema.tables t 
  ON t.table_schema = DATABASE() AND t.table_name = req.table_name
ORDER BY req.introduced_in, req.table_name;

-- -----------------------------------------------------------------------------
-- REPORT 3: DETAILED COLUMN PRESENCE AUDIT ON EXISTING TABLES
-- -----------------------------------------------------------------------------
SELECT 
  req.table_name AS `Table Name`,
  req.column_name AS `Column Name`,
  req.introduced_in AS `Migration`,
  CASE 
    WHEN c.column_name IS NOT NULL THEN 'CONFIRMED PRESENT'
    ELSE 'ABSENT (Pending Migration)'
  END AS `Existence Status`,
  c.column_type AS `Data Type`,
  c.is_nullable AS `Nullable`,
  c.column_default AS `Default Value`
FROM (
  SELECT 'orders' AS table_name, 'dispatched_at' AS column_name, '005' AS introduced_in UNION ALL
  SELECT 'orders', 'delivered_at', '005' UNION ALL
  SELECT 'orders', 'cancelled_at', '005' UNION ALL
  SELECT 'orders', 'address_edit_deadline', '007' UNION ALL
  SELECT 'orders', 'address_change_count', '007' UNION ALL
  SELECT 'products', 'has_colors', '006' UNION ALL
  SELECT 'products', 'cod_enabled', '009' UNION ALL
  SELECT 'product_images', 'color_id', '006' UNION ALL
  SELECT 'cart_items', 'color_id', '006' UNION ALL
  SELECT 'order_items', 'color_id', '006' UNION ALL
  SELECT 'order_items', 'color_name', '006' UNION ALL
  SELECT 'order_items', 'color_hex', '006' UNION ALL
  SELECT 'order_items', 'sku', '006' UNION ALL
  SELECT 'order_items', 'image_url', '006' UNION ALL
  SELECT 'profiles', 'token_version', '010' UNION ALL
  SELECT 'checkout_attempts', 'recovery_shown_at', '008' UNION ALL
  SELECT 'checkout_attempts', 'abandoned_at', '008' UNION ALL
  SELECT 'checkout_attempts', 'gateway_error_code', '008' UNION ALL
  SELECT 'checkout_attempts', 'gateway_error_desc', '008' UNION ALL
  SELECT 'password_reset_otps', 'otp_hash', '011' UNION ALL
  SELECT 'email_outbox', 'idempotency_key', '011'
) AS req
LEFT JOIN information_schema.columns c
  ON c.table_schema = DATABASE() AND c.table_name = req.table_name AND c.column_name = req.column_name
ORDER BY req.introduced_in, req.table_name, req.column_name;

-- -----------------------------------------------------------------------------
-- REPORT 4: CRITICAL INDEXES AUDIT
-- -----------------------------------------------------------------------------
SELECT 
  req.table_name AS `Table Name`,
  req.index_name AS `Expected Index`,
  req.introduced_in AS `Migration`,
  CASE 
    WHEN s.index_name IS NOT NULL THEN 'CONFIRMED PRESENT'
    ELSE 'ABSENT'
  END AS `Index Status`,
  GROUP_CONCAT(s.column_name ORDER BY s.seq_in_index) AS `Indexed Columns`
FROM (
  SELECT 'orders' AS table_name, 'idx_orders_created_at_status' AS index_name, '005' AS introduced_in UNION ALL
  SELECT 'orders', 'idx_orders_address_edit_deadline', '007' UNION ALL
  SELECT 'products', 'idx_products_has_colors', '006' UNION ALL
  SELECT 'products', 'idx_products_cod_enabled', '009' UNION ALL
  SELECT 'profiles', 'idx_profiles_token_version', '010' UNION ALL
  SELECT 'checkout_attempts', 'idx_checkout_attempts_provider_order', '005' UNION ALL
  SELECT 'email_outbox', 'idx_email_outbox_idempotency', '011' UNION ALL
  SELECT 'password_reset_otps', 'idx_password_reset_otps_user', '011'
) AS req
LEFT JOIN information_schema.statistics s
  ON s.table_schema = DATABASE() AND s.table_name = req.table_name AND s.index_name = req.index_name
GROUP BY req.table_name, req.index_name, req.introduced_in, s.index_name
ORDER BY req.introduced_in, req.table_name;
