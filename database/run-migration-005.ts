import fs from "fs";
import path from "path";
import mysql from "mysql2/promise";

function loadEnv() {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, "utf-8").split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const idx = trimmed.indexOf("=");
      if (idx !== -1) {
        const key = trimmed.slice(0, idx).trim();
        const val = trimmed.slice(idx + 1).trim();
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
}

loadEnv();

const APPROVED_TARGET_HOSTS = new Set(["127.0.0.1", "localhost", "::1"]);
const APPROVED_TARGET_DATABASES = new Set(["dearr_local", "dearr_test", "dearr_dev"]);

export function isApprovedLocalTarget(host: string, db: string): boolean {
  const h = (host || "").toLowerCase().trim();
  const d = (db || "").toLowerCase().trim();
  // Fail-closed: Must be in approved whitelists AND cannot match known production indicators
  if (!APPROVED_TARGET_HOSTS.has(h)) return false;
  if (!APPROVED_TARGET_DATABASES.has(d)) return false;
  if (h.includes("hstgr.io") || h.includes("hostinger")) return false;
  return true;
}

export function isProductionTarget(host: string, db: string): boolean {
  return !isApprovedLocalTarget(host, db);
}

export { APPROVED_TARGET_HOSTS, APPROVED_TARGET_DATABASES };

async function main() {
  const isApplyMode = process.argv.includes("--apply");
  const isDryRun = !isApplyMode;
  const host = process.env.DB_HOST || "127.0.0.1";
  const port = parseInt(process.env.DB_PORT || "3306", 10);
  const user = process.env.DB_USER || "root";
  const password = process.env.DB_PASSWORD || "";
  const database = process.env.DB_NAME || "dearr_local";

  console.log("================================================================================");
  console.log("DEARR MIGRATION 005: ORDERS ANALYTICS & CHECKOUT ATTEMPTS");
  console.log("================================================================================");
  console.log(`Resolved Target : ${database} on ${host}:${port}`);
  console.log(`Execution Mode  : ${isDryRun ? "DRY RUN (Default — Safe Preflight)" : "APPLY MODE (--apply requested)"}`);

  const targetApproved = isApprovedLocalTarget(host, database);

  if (isApplyMode && !targetApproved) {
    console.error("\n[FAIL-CLOSED SAFEGUARD REFUSAL] Migration mutation mode (--apply) refused.");
    console.error(`Target "${database}" on "${host}" is not on the approved local/test whitelist.`);
    console.error("Approved local hosts: 127.0.0.1, localhost, ::1");
    console.error("Approved databases  : dearr_local, dearr_test, dearr_dev");
    console.error("Hostinger production and all unapproved database targets are strictly protected.\n");
    process.exit(1);
  }

  if (isDryRun) {
    console.log("\n[DRY RUN PREFLIGHT]");
    console.log(`Target Whitelist Status: ${targetApproved ? "Approved Local/Test Database" : "Unapproved / Production Target (Mutation Blocked)"}`);
    console.log("Migration 005 plan:");
    console.log("  1. ALTER TABLE orders: add dispatched_at, delivered_at, cancelled_at; add composite index (created_at, status).");
    console.log("  2. CREATE TABLE checkout_attempts: tracks online attempts with 30-min expiry and 30-day retention.");
    console.log("  3. CREATE TABLE order_status_history: preserves lifecycle status transitions.");
    console.log("  4. CREATE TABLE order_export_audits: administrative export audit logging.");
    console.log("\nDry-run completed successfully. Zero database mutations were performed.");
    console.log("Pass '--apply' on a verified approved non-production database to execute.\n");
    return;
  }

  const connection = await mysql.createConnection({
    host,
    port,
    user,
    password,
    database,
    multipleStatements: true,
    connectTimeout: 15000,
  });

  try {
    // 1. Check orders columns
    const [orderCols]: any = await connection.query(
      "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'orders'",
      [database]
    );
    const existingCols = new Set(orderCols.map((c: any) => c.COLUMN_NAME));

    if (!existingCols.has("dispatched_at")) {
      console.log("[Migration 005] Adding transition timestamps and index to orders table...");
      await connection.query(`
        ALTER TABLE \`orders\`
          ADD COLUMN \`dispatched_at\` DATETIME DEFAULT NULL AFTER \`updated_at\`,
          ADD COLUMN \`delivered_at\` DATETIME DEFAULT NULL AFTER \`dispatched_at\`,
          ADD COLUMN \`cancelled_at\` DATETIME DEFAULT NULL AFTER \`delivered_at\`,
          ADD KEY \`idx_orders_created_at_status\` (\`created_at\`, \`status\`),
          ADD KEY \`idx_orders_created_at_payment\` (\`created_at\`, \`payment_status\`);
      `);
      console.log("[Migration 005] ✓ Added columns and indexes to 'orders'.");
    } else {
      console.log("[Migration 005] ✓ 'orders' transition timestamp columns already exist.");
    }

    // 2. Check checkout_attempts
    const [attemptsTable]: any = await connection.query(
      "SHOW TABLES LIKE 'checkout_attempts'"
    );
    if (attemptsTable.length === 0) {
      console.log("[Migration 005] Creating 'checkout_attempts' table...");
      await connection.query(`
        CREATE TABLE IF NOT EXISTS \`checkout_attempts\` (
          \`id\` CHAR(36) NOT NULL,
          \`user_id\` CHAR(36) NOT NULL,
          \`cart_id\` CHAR(36) DEFAULT NULL,
          \`provider\` VARCHAR(50) NOT NULL DEFAULT 'razorpay',
          \`provider_order_id\` VARCHAR(100) DEFAULT NULL,
          \`provider_payment_id\` VARCHAR(100) DEFAULT NULL,
          \`order_id\` CHAR(36) DEFAULT NULL,
          \`status\` ENUM('pending', 'verified', 'converted', 'expired', 'failed') NOT NULL DEFAULT 'pending',
          \`amount\` DECIMAL(10,2) NOT NULL,
          \`currency\` CHAR(3) NOT NULL DEFAULT 'INR',
          \`checkout_data\` JSON NOT NULL,
          \`expires_at\` DATETIME NOT NULL,
          \`retention_until\` DATETIME NOT NULL,
          \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (\`id\`),
          UNIQUE KEY \`idx_checkout_attempts_provider_order\` (\`provider_order_id\`),
          KEY \`idx_checkout_attempts_user_status\` (\`user_id\`, \`status\`),
          KEY \`idx_checkout_attempts_expires_at\` (\`status\`, \`expires_at\`),
          KEY \`idx_checkout_attempts_retention\` (\`status\`, \`retention_until\`),
          KEY \`idx_checkout_attempts_order_id\` (\`order_id\`),
          KEY \`idx_checkout_attempts_created_at\` (\`created_at\`),
          CONSTRAINT \`chk_checkout_attempts_amount\` CHECK (\`amount\` >= 0),
          CONSTRAINT \`fk_checkout_attempts_user\` FOREIGN KEY (\`user_id\`) REFERENCES \`profiles\` (\`id\`) ON DELETE CASCADE ON UPDATE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);
      console.log("[Migration 005] ✓ 'checkout_attempts' table created successfully.");
    } else {
      console.log("[Migration 005] ✓ 'checkout_attempts' table already exists.");
    }

    // 3. Check order_status_history
    const [historyTable]: any = await connection.query(
      "SHOW TABLES LIKE 'order_status_history'"
    );
    if (historyTable.length === 0) {
      console.log("[Migration 005] Creating 'order_status_history' table...");
      await connection.query(`
        CREATE TABLE IF NOT EXISTS \`order_status_history\` (
          \`id\` CHAR(36) NOT NULL,
          \`order_id\` CHAR(36) NOT NULL,
          \`previous_status\` VARCHAR(50) DEFAULT NULL,
          \`new_status\` VARCHAR(50) NOT NULL,
          \`changed_by\` CHAR(36) DEFAULT NULL,
          \`note\` VARCHAR(255) DEFAULT NULL,
          \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (\`id\`),
          KEY \`idx_status_history_order\` (\`order_id\`, \`created_at\`),
          KEY \`idx_status_history_changed_by\` (\`changed_by\`),
          CONSTRAINT \`fk_status_history_order\` FOREIGN KEY (\`order_id\`) REFERENCES \`orders\` (\`id\`) ON DELETE CASCADE ON UPDATE CASCADE,
          CONSTRAINT \`fk_status_history_actor\` FOREIGN KEY (\`changed_by\`) REFERENCES \`profiles\` (\`id\`) ON DELETE SET NULL ON UPDATE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);
      console.log("[Migration 005] ✓ 'order_status_history' table created successfully.");
    } else {
      console.log("[Migration 005] ✓ 'order_status_history' table already exists.");
    }

    // 4. Check order_export_audits
    const [auditsTable]: any = await connection.query(
      "SHOW TABLES LIKE 'order_export_audits'"
    );
    if (auditsTable.length === 0) {
      console.log("[Migration 005] Creating 'order_export_audits' table...");
      await connection.query(`
        CREATE TABLE IF NOT EXISTS \`order_export_audits\` (
          \`id\` CHAR(36) NOT NULL,
          \`actor_id\` CHAR(36) NOT NULL,
          \`export_type\` ENUM('orders', 'summary') NOT NULL,
          \`period\` VARCHAR(20) NOT NULL,
          \`date_range_start\` DATETIME DEFAULT NULL,
          \`date_range_end\` DATETIME DEFAULT NULL,
          \`filter_criteria\` JSON DEFAULT NULL,
          \`row_count\` INT NOT NULL DEFAULT 0,
          \`status\` ENUM('success', 'failed') NOT NULL DEFAULT 'success',
          \`error_message\` VARCHAR(255) DEFAULT NULL,
          \`ip_address\` VARCHAR(45) DEFAULT NULL,
          \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (\`id\`),
          KEY \`idx_export_audits_actor\` (\`actor_id\`, \`created_at\`),
          KEY \`idx_export_audits_created_at\` (\`created_at\`),
          CONSTRAINT \`fk_export_audits_actor\` FOREIGN KEY (\`actor_id\`) REFERENCES \`profiles\` (\`id\`) ON DELETE CASCADE ON UPDATE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);
      console.log("[Migration 005] ✓ 'order_export_audits' table created successfully.");
    } else {
      console.log("[Migration 005] ✓ 'order_export_audits' table already exists.");
    }

    console.log("\n[Migration 005] ✓ Completed successfully on non-production target.");
  } finally {
    await connection.end();
  }
}

main().catch((err) => {
  console.error("[Migration 005 Error]:", err.message);
  process.exit(1);
});
