import fs from "fs";
import path from "path";
import mysql from "mysql2/promise";
import { loadTestEnvironment, assertTestDatabaseSafety } from "./test-db-safety";

async function columnExists(conn: mysql.Connection, table: string, column: string): Promise<boolean> {
  const [rows]: any = await conn.query(
    "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?",
    [table, column]
  );
  return rows && rows.length > 0;
}

async function tableExists(conn: mysql.Connection, table: string): Promise<boolean> {
  const [rows]: any = await conn.query(
    "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?",
    [table]
  );
  return rows && rows.length > 0;
}

async function indexExists(conn: mysql.Connection, table: string, indexName: string): Promise<boolean> {
  const [rows]: any = await conn.query(
    "SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?",
    [table, indexName]
  );
  return rows && rows.length > 0;
}

async function foreignKeyExists(conn: mysql.Connection, table: string, fkName: string): Promise<boolean> {
  const [rows]: any = await conn.query(
    "SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND CONSTRAINT_NAME = ?",
    [table, fkName]
  );
  return rows && rows.length > 0;
}

async function main() {
  console.log("================================================================================");
  console.log("APPLYING MIGRATIONS 006 - 012 TO LOCAL TEST DATABASE (dearr_test)");
  console.log("================================================================================\n");

  loadTestEnvironment();
  const safeConfig = assertTestDatabaseSafety();

  console.log("Target Host:", safeConfig.host);
  console.log("Target Port:", safeConfig.port);
  console.log("Target Database:", safeConfig.database);

  const conn = await mysql.createConnection({
    ...safeConfig,
    multipleStatements: true,
  });

  const [dbRows]: any = await conn.query("SELECT DATABASE() as db");
  if (dbRows[0].db !== "dearr_test") {
    throw new Error(`ABSOLUTE SAFETY REFUSAL: Connected to "${dbRows[0].db}", expected "dearr_test"!`);
  }

  console.log("\n[VERIFIED] Connected to isolated local test database: dearr_test\n");

  // ─────────────────────────────────────────────────────────────────────────────
  // Migration 006: Product Colors, Stock Reservations, Multi-color Snapshots
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("--- Migration 006: Product Colors & Stock Reservations ---");

  // Step 1: products.has_colors
  if (!(await columnExists(conn, "products", "has_colors"))) {
    await conn.query(
      "ALTER TABLE `products` ADD COLUMN `has_colors` TINYINT(1) NOT NULL DEFAULT 0 AFTER `is_active`, ADD KEY `idx_products_has_colors` (`has_colors`)"
    );
    console.log("  [+] Added products.has_colors");
  } else {
    console.log("  [.] products.has_colors already exists");
  }

  // Step 2: product_colors table
  if (!(await tableExists(conn, "product_colors"))) {
    await conn.query(`
      CREATE TABLE IF NOT EXISTS \`product_colors\` (
        \`id\` CHAR(36) NOT NULL,
        \`product_id\` CHAR(36) NOT NULL,
        \`name\` VARCHAR(100) NOT NULL,
        \`slug\` VARCHAR(100) NOT NULL,
        \`hex\` VARCHAR(20) NOT NULL,
        \`sku\` VARCHAR(100) DEFAULT NULL,
        \`stock\` INT NOT NULL DEFAULT 0,
        \`reserved_stock\` INT NOT NULL DEFAULT 0,
        \`price_override\` DECIMAL(10,2) DEFAULT NULL,
        \`sort_order\` INT NOT NULL DEFAULT 0,
        \`is_active\` TINYINT(1) NOT NULL DEFAULT 1,
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uq_product_colors_product_name\` (\`product_id\`, \`name\`),
        UNIQUE KEY \`uq_product_colors_product_slug\` (\`product_id\`, \`slug\`),
        UNIQUE KEY \`uq_product_colors_sku\` (\`sku\`),
        KEY \`idx_product_colors_product_sort\` (\`product_id\`, \`sort_order\`),
        KEY \`idx_product_colors_is_active\` (\`is_active\`),
        CONSTRAINT \`chk_product_colors_stock\` CHECK (\`stock\` >= 0),
        CONSTRAINT \`chk_product_colors_reserved_stock\` CHECK (\`reserved_stock\` >= 0),
        CONSTRAINT \`chk_product_colors_price_override\` CHECK (\`price_override\` IS NULL OR \`price_override\` >= 0),
        CONSTRAINT \`chk_product_colors_sort_order\` CHECK (\`sort_order\` >= 0),
        CONSTRAINT \`fk_product_colors_product\` FOREIGN KEY (\`product_id\`) REFERENCES \`products\` (\`id\`) ON DELETE CASCADE ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log("  [+] Created table product_colors");
  } else {
    console.log("  [.] Table product_colors already exists");
  }

  // Step 3: product_images.color_id
  if (!(await columnExists(conn, "product_images", "color_id"))) {
    await conn.query(`
      ALTER TABLE \`product_images\`
        ADD COLUMN \`color_id\` CHAR(36) DEFAULT NULL AFTER \`product_id\`,
        ADD KEY \`idx_product_images_color\` (\`color_id\`),
        ADD KEY \`idx_product_images_product_color_sort\` (\`product_id\`, \`color_id\`, \`sort_order\`),
        ADD CONSTRAINT \`fk_product_images_color\` FOREIGN KEY (\`color_id\`) REFERENCES \`product_colors\` (\`id\`) ON DELETE CASCADE ON UPDATE CASCADE;
    `);
    console.log("  [+] Added product_images.color_id and foreign key");
  } else {
    console.log("  [.] product_images.color_id already exists");
  }

  // Step 4: cart_items.color_id
  if (!(await columnExists(conn, "cart_items", "color_id"))) {
    await conn.query(`
      ALTER TABLE \`cart_items\`
        ADD COLUMN \`color_id\` CHAR(36) DEFAULT NULL AFTER \`variant_id\`,
        ADD KEY \`idx_cart_items_color_id\` (\`color_id\`),
        ADD KEY \`idx_cart_items_cart_product_color\` (\`cart_id\`, \`product_id\`, \`color_id\`),
        ADD CONSTRAINT \`fk_cart_items_color\` FOREIGN KEY (\`color_id\`) REFERENCES \`product_colors\` (\`id\`) ON DELETE SET NULL ON UPDATE CASCADE;
    `);
    console.log("  [+] Added cart_items.color_id and foreign key");
  } else {
    console.log("  [.] cart_items.color_id already exists");
  }

  // Step 5: order_items color snapshots
  if (!(await columnExists(conn, "order_items", "color_id"))) {
    await conn.query(`
      ALTER TABLE \`order_items\`
        ADD COLUMN \`color_id\` CHAR(36) DEFAULT NULL AFTER \`variant_id\`,
        ADD COLUMN \`color_name\` VARCHAR(100) DEFAULT NULL AFTER \`variant_name\`,
        ADD COLUMN \`color_hex\` VARCHAR(20) DEFAULT NULL AFTER \`color_name\`,
        ADD COLUMN \`sku\` VARCHAR(100) DEFAULT NULL AFTER \`color_hex\`,
        ADD COLUMN \`image_url\` VARCHAR(500) DEFAULT NULL AFTER \`line_total\`,
        ADD KEY \`idx_order_items_color_id\` (\`color_id\`),
        ADD CONSTRAINT \`fk_order_items_color\` FOREIGN KEY (\`color_id\`) REFERENCES \`product_colors\` (\`id\`) ON DELETE SET NULL ON UPDATE CASCADE;
    `);
    console.log("  [+] Added order_items color snapshot columns");
  } else {
    console.log("  [.] order_items color columns already exist");
  }

  // Step 6: stock_reservations table
  if (!(await tableExists(conn, "stock_reservations"))) {
    await conn.query(`
      CREATE TABLE IF NOT EXISTS \`stock_reservations\` (
        \`id\` CHAR(36) NOT NULL,
        \`attempt_id\` CHAR(36) NOT NULL,
        \`product_id\` CHAR(36) NOT NULL,
        \`color_id\` CHAR(36) DEFAULT NULL,
        \`quantity\` INT NOT NULL,
        \`status\` ENUM('active', 'consumed', 'released') NOT NULL DEFAULT 'active',
        \`expires_at\` DATETIME NOT NULL,
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        KEY \`idx_stock_reservations_attempt\` (\`attempt_id\`),
        KEY \`idx_stock_reservations_color_status\` (\`color_id\`, \`status\`),
        KEY \`idx_stock_reservations_status_expires\` (\`status\`, \`expires_at\`),
        CONSTRAINT \`chk_stock_reservations_quantity\` CHECK (\`quantity\` > 0),
        CONSTRAINT \`fk_stock_reservations_attempt\` FOREIGN KEY (\`attempt_id\`) REFERENCES \`checkout_attempts\` (\`id\`) ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT \`fk_stock_reservations_product\` FOREIGN KEY (\`product_id\`) REFERENCES \`products\` (\`id\`) ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT \`fk_stock_reservations_color\` FOREIGN KEY (\`color_id\`) REFERENCES \`product_colors\` (\`id\`) ON DELETE SET NULL ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log("  [+] Created table stock_reservations");
  } else {
    console.log("  [.] Table stock_reservations already exists");
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Migration 007: Order Address Change & Rate Limiting
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n--- Migration 007: Order Address Change & Rate Limiting ---");
  if (!(await columnExists(conn, "orders", "address_edit_deadline"))) {
    await conn.query(`
      ALTER TABLE \`orders\`
        ADD COLUMN \`address_edit_deadline\` DATETIME DEFAULT NULL AFTER \`cancelled_at\`,
        ADD COLUMN \`address_change_count\` INT NOT NULL DEFAULT 0 AFTER \`address_edit_deadline\`,
        ADD KEY \`idx_orders_address_edit_deadline\` (\`address_edit_deadline\`);
    `);
    console.log("  [+] Added orders address edit deadline and change counter");
  }

  if (!(await tableExists(conn, "order_address_history"))) {
    await conn.query(`
      CREATE TABLE IF NOT EXISTS \`order_address_history\` (
        \`id\` CHAR(36) NOT NULL,
        \`order_id\` CHAR(36) NOT NULL,
        \`old_address\` JSON NOT NULL,
        \`new_address\` JSON NOT NULL,
        \`changed_by\` ENUM('customer', 'admin') NOT NULL DEFAULT 'customer',
        \`actor_id\` CHAR(36) DEFAULT NULL,
        \`ip_address\` VARCHAR(45) DEFAULT NULL,
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        KEY \`idx_order_address_history_order\` (\`order_id\`),
        KEY \`idx_order_address_history_created_at\` (\`created_at\`),
        CONSTRAINT \`fk_order_address_history_order\` FOREIGN KEY (\`order_id\`) REFERENCES \`orders\` (\`id\`) ON DELETE CASCADE ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log("  [+] Created table order_address_history");
  }

  if (!(await tableExists(conn, "rate_limits"))) {
    await conn.query(`
      CREATE TABLE IF NOT EXISTS \`rate_limits\` (
        \`rate_key\` VARCHAR(150) NOT NULL,
        \`hits\` INT NOT NULL DEFAULT 1,
        \`reset_at\` DATETIME NOT NULL,
        PRIMARY KEY (\`rate_key\`),
        KEY \`idx_rate_limits_reset\` (\`reset_at\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log("  [+] Created table rate_limits");
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Migration 008: Cart Abandonment Recovery
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n--- Migration 008: Cart Abandonment Recovery ---");
  if (!(await columnExists(conn, "checkout_attempts", "abandoned_at"))) {
    await conn.query(`
      ALTER TABLE \`checkout_attempts\`
        MODIFY COLUMN \`status\` ENUM('pending', 'verified', 'converted', 'expired', 'failed', 'abandoned') NOT NULL DEFAULT 'pending',
        ADD COLUMN \`recovery_shown_at\` DATETIME DEFAULT NULL AFTER \`order_id\`,
        ADD COLUMN \`abandoned_at\` DATETIME DEFAULT NULL AFTER \`recovery_shown_at\`,
        ADD COLUMN \`gateway_error_code\` VARCHAR(100) DEFAULT NULL AFTER \`abandoned_at\`,
        ADD COLUMN \`gateway_error_desc\` VARCHAR(500) DEFAULT NULL AFTER \`gateway_error_code\`,
        ADD KEY \`idx_checkout_attempts_status_abandoned\` (\`status\`, \`abandoned_at\`),
        ADD KEY \`idx_checkout_attempts_recovery_shown\` (\`status\`, \`recovery_shown_at\`);
    `);
    console.log("  [+] Added checkout_attempts abandonment and recovery columns");
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Migration 009: Product COD Eligibility
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n--- Migration 009: Product COD Eligibility ---");
  if (!(await columnExists(conn, "products", "cod_enabled"))) {
    await conn.query(`
      ALTER TABLE \`products\`
        ADD COLUMN \`cod_enabled\` TINYINT(1) NOT NULL DEFAULT 1 AFTER \`has_colors\`,
        ADD KEY \`idx_products_cod_enabled\` (\`cod_enabled\`);
    `);
    console.log("  [+] Added products.cod_enabled");
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Migration 010: Token Version Revocation
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n--- Migration 010: Token Version Revocation ---");
  if (!(await columnExists(conn, "profiles", "token_version"))) {
    await conn.query(`
      ALTER TABLE \`profiles\`
        ADD COLUMN \`token_version\` INT UNSIGNED NOT NULL DEFAULT 1 AFTER \`role\`,
        ADD KEY \`idx_profiles_token_version\` (\`id\`, \`token_version\`);
    `);
    console.log("  [+] Added profiles.token_version");
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Migration 011: Transactional Email & Password Reset OTP
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n--- Migration 011: Transactional Email & Password Reset OTP ---");
  if (!(await tableExists(conn, "password_reset_otps"))) {
    await conn.query(`
      CREATE TABLE IF NOT EXISTS \`password_reset_otps\` (
        \`id\` CHAR(36) NOT NULL,
        \`user_id\` CHAR(36) NOT NULL,
        \`email\` VARCHAR(255) NOT NULL,
        \`otp_hash\` VARCHAR(255) NOT NULL,
        \`attempts\` INT NOT NULL DEFAULT 0,
        \`max_attempts\` INT NOT NULL DEFAULT 5,
        \`expires_at\` DATETIME NOT NULL,
        \`consumed_at\` DATETIME DEFAULT NULL,
        \`ip_address\` VARCHAR(45) DEFAULT NULL,
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        KEY \`idx_password_reset_otps_user\` (\`user_id\`, \`created_at\`),
        KEY \`idx_password_reset_otps_email\` (\`email\`),
        KEY \`idx_password_reset_otps_expires\` (\`expires_at\`),
        CONSTRAINT \`fk_password_reset_otps_user\` FOREIGN KEY (\`user_id\`) REFERENCES \`profiles\` (\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log("  [+] Created table password_reset_otps");
  }

  if (!(await tableExists(conn, "email_outbox"))) {
    await conn.query(`
      CREATE TABLE IF NOT EXISTS \`email_outbox\` (
        \`id\` CHAR(36) NOT NULL,
        \`event_type\` VARCHAR(50) NOT NULL,
        \`idempotency_key\` VARCHAR(120) NOT NULL,
        \`recipient_email\` VARCHAR(255) NOT NULL,
        \`recipient_name\` VARCHAR(150) DEFAULT NULL,
        \`order_id\` CHAR(36) DEFAULT NULL,
        \`payload\` JSON DEFAULT NULL,
        \`status\` ENUM('pending', 'processing', 'sent', 'failed') NOT NULL DEFAULT 'pending',
        \`attempts\` INT NOT NULL DEFAULT 0,
        \`max_attempts\` INT NOT NULL DEFAULT 5,
        \`next_retry_at\` DATETIME DEFAULT NULL,
        \`provider_message_id\` VARCHAR(100) DEFAULT NULL,
        \`last_error\` TEXT DEFAULT NULL,
        \`sent_at\` DATETIME DEFAULT NULL,
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`idx_email_outbox_idempotency\` (\`idempotency_key\`),
        KEY \`idx_email_outbox_status_retry\` (\`status\`, \`next_retry_at\`),
        KEY \`idx_email_outbox_order\` (\`order_id\`),
        KEY \`idx_email_outbox_created_at\` (\`created_at\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log("  [+] Created table email_outbox");
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Migration 012: Variant-Specific Pricing Data Model
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n--- Migration 012: Variant-Specific Pricing Data Model ---");

  // Step 1: product_variants (color_id, size_name, combo_hash, indexes, foreign key)
  if (!(await columnExists(conn, "product_variants", "color_id"))) {
    console.log("  Applying product_variants extensions from 012_variant_specific_pricing.sql...");
    await conn.query(`
      ALTER TABLE \`product_variants\`
        ADD COLUMN \`color_id\` CHAR(36) DEFAULT NULL AFTER \`product_id\`,
        ADD COLUMN \`size_name\` VARCHAR(100) DEFAULT NULL AFTER \`color_id\`,
        ADD COLUMN \`combo_hash\` VARCHAR(150) GENERATED ALWAYS AS (
          CASE
            WHEN \`color_id\` IS NOT NULL OR (\`size_name\` IS NOT NULL AND TRIM(\`size_name\`) != '') THEN
              CONCAT(COALESCE(\`color_id\`, '00000000-0000-0000-0000-000000000000'), '::', COALESCE(LOWER(TRIM(\`size_name\`)), ''))
            ELSE NULL
          END
        ) VIRTUAL AFTER \`size_name\`,
        ADD KEY \`idx_product_variants_color_id\` (\`color_id\`),
        ADD KEY \`idx_product_variants_size_name\` (\`size_name\`),
        ADD UNIQUE KEY \`uq_product_variants_combo\` (\`product_id\`, \`combo_hash\`),
        ADD CONSTRAINT \`fk_product_variants_color\`
          FOREIGN KEY (\`color_id\`) REFERENCES \`product_colors\` (\`id\`) ON DELETE CASCADE ON UPDATE CASCADE;
    `);
    console.log("  [+] product_variants extensions applied (color_id, size_name, combo_hash, uq_product_variants_combo, fk_product_variants_color)");
  } else {
    console.log("  [.] product_variants.color_id already exists. Ensuring combo_hash definition is up-to-date...");
    await conn.query(`
      ALTER TABLE \`product_variants\`
        MODIFY COLUMN \`combo_hash\` VARCHAR(150) GENERATED ALWAYS AS (
          CASE
            WHEN \`color_id\` IS NOT NULL OR (\`size_name\` IS NOT NULL AND TRIM(\`size_name\`) != '') THEN
              CONCAT(COALESCE(\`color_id\`, '00000000-0000-0000-0000-000000000000'), '::', COALESCE(LOWER(TRIM(\`size_name\`)), ''))
            ELSE NULL
          END
        ) VIRTUAL;
    `);
    console.log("  [+] product_variants.combo_hash updated to safe non-null expression.");
  }

  // Step 2: stock_reservations (variant_id, index, foreign key)
  if (!(await columnExists(conn, "stock_reservations", "variant_id"))) {
    console.log("  Applying stock_reservations extensions from 012_variant_specific_pricing.sql...");
    await conn.query(`
      ALTER TABLE \`stock_reservations\`
        ADD COLUMN \`variant_id\` CHAR(36) DEFAULT NULL AFTER \`color_id\`,
        ADD KEY \`idx_stock_reservations_variant_status\` (\`variant_id\`, \`status\`),
        ADD CONSTRAINT \`fk_stock_reservations_variant\`
          FOREIGN KEY (\`variant_id\`) REFERENCES \`product_variants\` (\`id\`) ON DELETE SET NULL ON UPDATE CASCADE;
    `);
    console.log("  [+] stock_reservations.variant_id applied (variant_id, idx_stock_reservations_variant_status, fk_stock_reservations_variant)");
  } else {
    console.log("  [.] stock_reservations.variant_id already exists");
  }

  console.log("\n================================================================================");
  console.log("ALL MIGRATIONS 006 - 012 SUCCESSFULLY APPLIED & VERIFIED ON dearr_test");
  console.log("================================================================================\n");

  await conn.end();
}

main().catch((err) => {
  console.error("Migration application failed:", err);
  process.exit(1);
});
