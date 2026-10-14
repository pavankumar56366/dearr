import fs from "fs";
import path from "path";
import mysql from "mysql2/promise";

function loadEnv() {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return {};
  const lines = fs.readFileSync(envPath, "utf-8").split("\n");
  const env: Record<string, string> = {};
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx !== -1) {
      env[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
    }
  }
  return env;
}

async function columnExists(conn: mysql.Connection, table: string, column: string): Promise<boolean> {
  const [rows]: any = await conn.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column]
  );
  return rows && rows.length > 0;
}

async function tableExists(conn: mysql.Connection, table: string): Promise<boolean> {
  const [rows]: any = await conn.query(
    `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    [table]
  );
  return rows && rows.length > 0;
}

async function indexExists(conn: mysql.Connection, table: string, indexName: string): Promise<boolean> {
  const [rows]: any = await conn.query(
    `SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?`,
    [table, indexName]
  );
  return rows && rows.length > 0;
}

async function main() {
  const isDryRun = process.argv.includes("--dry-run");
  const env = loadEnv();

  console.log("=== Migration 006 Safety Pre-Flight ===");
  console.log("Target Host:", env.DB_HOST);
  console.log("Target Port:", env.DB_PORT);
  console.log("Target Database:", env.DB_NAME);
  console.log("Mode:", isDryRun ? "DRY RUN (no changes)" : "APPLY MIGRATION");

  if (env.DB_HOST !== "127.0.0.1" && env.DB_HOST !== "localhost") {
    throw new Error("ABSOLUTE SAFEGUARD: Host is not loopback (127.0.0.1)!");
  }
  if (env.DB_NAME !== "dearr_test") {
    throw new Error("ABSOLUTE SAFEGUARD: Database name must strictly be 'dearr_test'!");
  }

  const conn = await mysql.createConnection({
    host: env.DB_HOST,
    port: parseInt(env.DB_PORT || "3306", 10),
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
  });

  try {
    // 1. Back up database first if applying
    if (!isDryRun) {
      const scratchDir = path.resolve(process.cwd(), "scratch");
      if (!fs.existsSync(scratchDir)) {
        fs.mkdirSync(scratchDir, { recursive: true });
      }
      const backupPath = path.resolve(scratchDir, "backup_dearr_test_pre_006.sql");
      console.log(`\nBacking up database '${env.DB_NAME}' to ${backupPath}...`);
      const [tables]: any = await conn.query("SHOW TABLES;");
      let dumpContent = `-- SNAPSHOT BACKUP PRE MIGRATION 006\n-- Target: ${env.DB_NAME}\n-- Time: ${new Date().toISOString()}\n\n`;
      for (const row of tables) {
        const tbl = Object.values(row)[0] as string;
        const [createTable]: any = await conn.query(`SHOW CREATE TABLE \`${tbl}\``);
        dumpContent += `DROP TABLE IF EXISTS \`${tbl}\`;\n`;
        dumpContent += `${createTable[0]["Create Table"]};\n\n`;
      }
      fs.writeFileSync(backupPath, dumpContent, "utf-8");
      console.log(`[PASS] Backup verified (${tables.length} tables, ${fs.statSync(backupPath).size} bytes).`);
    }

    console.log("\nInspecting schema operations...");

    // Step 1: products.has_colors
    const hasColorsCol = await columnExists(conn, "products", "has_colors");
    console.log(`products.has_colors exists: ${hasColorsCol}`);
    if (!hasColorsCol) {
      const sql = `ALTER TABLE \`products\` ADD COLUMN \`has_colors\` TINYINT(1) NOT NULL DEFAULT 0 AFTER \`is_active\`, ADD KEY \`idx_products_has_colors\` (\`has_colors\`)`;
      if (!isDryRun) {
        await conn.query(sql);
        console.log("  -> Added products.has_colors");
      } else {
        console.log("  [DRY RUN] Would execute:", sql);
      }
    }

    // Step 2: product_colors table
    const colorsTable = await tableExists(conn, "product_colors");
    console.log(`product_colors table exists: ${colorsTable}`);
    if (!colorsTable) {
      const sql = `CREATE TABLE IF NOT EXISTS \`product_colors\` (
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
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`;
      if (!isDryRun) {
        await conn.query(sql);
        console.log("  -> Created product_colors table");
      } else {
        console.log("  [DRY RUN] Would create table product_colors");
      }
    }

    // Step 3: product_images.color_id
    const imgColorCol = await columnExists(conn, "product_images", "color_id");
    console.log(`product_images.color_id exists: ${imgColorCol}`);
    if (!imgColorCol) {
      const sql = `ALTER TABLE \`product_images\`
        ADD COLUMN \`color_id\` CHAR(36) DEFAULT NULL AFTER \`product_id\`,
        ADD KEY \`idx_product_images_color\` (\`color_id\`),
        ADD KEY \`idx_product_images_product_color_sort\` (\`product_id\`, \`color_id\`, \`sort_order\`),
        ADD CONSTRAINT \`fk_product_images_color\` FOREIGN KEY (\`color_id\`) REFERENCES \`product_colors\` (\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`;
      if (!isDryRun) {
        await conn.query(sql);
        console.log("  -> Added product_images.color_id");
      } else {
        console.log("  [DRY RUN] Would execute:", sql);
      }
    }

    // Step 4: cart_items.color_id
    const cartColorCol = await columnExists(conn, "cart_items", "color_id");
    console.log(`cart_items.color_id exists: ${cartColorCol}`);
    if (!cartColorCol) {
      const sql = `ALTER TABLE \`cart_items\`
        ADD COLUMN \`color_id\` CHAR(36) DEFAULT NULL AFTER \`variant_id\`,
        ADD KEY \`idx_cart_items_color_id\` (\`color_id\`),
        ADD KEY \`idx_cart_items_cart_product_color\` (\`cart_id\`, \`product_id\`, \`color_id\`),
        ADD CONSTRAINT \`fk_cart_items_color\` FOREIGN KEY (\`color_id\`) REFERENCES \`product_colors\` (\`id\`) ON DELETE SET NULL ON UPDATE CASCADE`;
      if (!isDryRun) {
        await conn.query(sql);
        console.log("  -> Added cart_items.color_id");
      } else {
        console.log("  [DRY RUN] Would execute:", sql);
      }
    }

    // Step 5: order_items color snapshot fields
    const orderColorCol = await columnExists(conn, "order_items", "color_id");
    console.log(`order_items.color_id exists: ${orderColorCol}`);
    if (!orderColorCol) {
      const sql = `ALTER TABLE \`order_items\`
        ADD COLUMN \`color_id\` CHAR(36) DEFAULT NULL AFTER \`variant_id\`,
        ADD COLUMN \`color_name\` VARCHAR(100) DEFAULT NULL AFTER \`variant_name\`,
        ADD COLUMN \`color_hex\` VARCHAR(20) DEFAULT NULL AFTER \`color_name\`,
        ADD COLUMN \`sku\` VARCHAR(100) DEFAULT NULL AFTER \`color_hex\`,
        ADD COLUMN \`image_url\` VARCHAR(500) DEFAULT NULL AFTER \`line_total\`,
        ADD KEY \`idx_order_items_color_id\` (\`color_id\`),
        ADD CONSTRAINT \`fk_order_items_color\` FOREIGN KEY (\`color_id\`) REFERENCES \`product_colors\` (\`id\`) ON DELETE SET NULL ON UPDATE CASCADE`;
      if (!isDryRun) {
        await conn.query(sql);
        console.log("  -> Added order_items snapshot fields");
      } else {
        console.log("  [DRY RUN] Would execute:", sql);
      }
    }

    // Step 6: stock_reservations table
    const resTable = await tableExists(conn, "stock_reservations");
    console.log(`stock_reservations table exists: ${resTable}`);
    if (!resTable) {
      const sql = `CREATE TABLE IF NOT EXISTS \`stock_reservations\` (
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
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`;
      if (!isDryRun) {
        await conn.query(sql);
        console.log("  -> Created stock_reservations table");
      } else {
        console.log("  [DRY RUN] Would create table stock_reservations");
      }
    }

    console.log("\n[SUCCESS] Migration 006 check completed successfully.");
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error("Migration runner failed:", err);
  process.exit(1);
});
