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

async function main() {
  const isDryRun = process.argv.includes("--dry-run");
  const env = loadEnv();

  console.log("=== Migration 007 Safety Pre-Flight ===");
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
      const backupPath = path.resolve(scratchDir, "backup_dearr_test_pre_007.sql");
      console.log(`\nBacking up database '${env.DB_NAME}' to ${backupPath}...`);
      const [tables]: any = await conn.query("SHOW TABLES;");
      let dumpContent = `-- SNAPSHOT BACKUP PRE MIGRATION 007\n-- Target: ${env.DB_NAME}\n-- Time: ${new Date().toISOString()}\n\n`;
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

    // Step 1: orders.address_edit_deadline & address_change_count
    const deadlineCol = await columnExists(conn, "orders", "address_edit_deadline");
    console.log(`orders.address_edit_deadline exists: ${deadlineCol}`);
    if (!deadlineCol) {
      const sql = `ALTER TABLE \`orders\` ADD COLUMN \`address_edit_deadline\` DATETIME DEFAULT NULL AFTER \`cancelled_at\`, ADD KEY \`idx_orders_address_edit_deadline\` (\`address_edit_deadline\`)`;
      if (!isDryRun) {
        await conn.query(sql);
        console.log("  -> Added orders.address_edit_deadline");
      } else {
        console.log("  [DRY RUN] Would execute: " + sql);
      }
    }

    const countCol = await columnExists(conn, "orders", "address_change_count");
    console.log(`orders.address_change_count exists: ${countCol}`);
    if (!countCol) {
      const sql = `ALTER TABLE \`orders\` ADD COLUMN \`address_change_count\` INT NOT NULL DEFAULT 0 AFTER \`address_edit_deadline\``;
      if (!isDryRun) {
        await conn.query(sql);
        console.log("  -> Added orders.address_change_count");
      } else {
        console.log("  [DRY RUN] Would execute: " + sql);
      }
    }

    // Step 2: order_address_history table
    const historyTable = await tableExists(conn, "order_address_history");
    console.log(`order_address_history table exists: ${historyTable}`);
    if (!historyTable) {
      const sql = `CREATE TABLE IF NOT EXISTS \`order_address_history\` (
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
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`;
      if (!isDryRun) {
        await conn.query(sql);
        console.log("  -> Created order_address_history table");
      } else {
        console.log("  [DRY RUN] Would execute CREATE TABLE order_address_history");
      }
    }

    // Step 3: settings_audit_history table
    const settingsAuditTable = await tableExists(conn, "settings_audit_history");
    console.log(`settings_audit_history table exists: ${settingsAuditTable}`);
    if (!settingsAuditTable) {
      const sql = `CREATE TABLE IF NOT EXISTS \`settings_audit_history\` (
        \`id\` CHAR(36) NOT NULL,
        \`actor_id\` CHAR(36) NOT NULL,
        \`setting_name\` VARCHAR(100) NOT NULL,
        \`old_value\` JSON DEFAULT NULL,
        \`new_value\` JSON NOT NULL,
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        KEY \`idx_settings_audit_history_actor\` (\`actor_id\`),
        KEY \`idx_settings_audit_history_created_at\` (\`created_at\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`;
      if (!isDryRun) {
        await conn.query(sql);
        console.log("  -> Created settings_audit_history table");
      } else {
        console.log("  [DRY RUN] Would execute CREATE TABLE settings_audit_history");
      }
    }

    // Step 4: rate_limits table
    const rateLimitsTable = await tableExists(conn, "rate_limits");
    console.log(`rate_limits table exists: ${rateLimitsTable}`);
    if (!rateLimitsTable) {
      const sql = `CREATE TABLE IF NOT EXISTS \`rate_limits\` (
        \`rate_key\` VARCHAR(150) NOT NULL,
        \`hits\` INT NOT NULL DEFAULT 1,
        \`reset_at\` DATETIME NOT NULL,
        PRIMARY KEY (\`rate_key\`),
        KEY \`idx_rate_limits_reset\` (\`reset_at\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`;
      if (!isDryRun) {
        await conn.query(sql);
        console.log("  -> Created rate_limits table");
      } else {
        console.log("  [DRY RUN] Would execute CREATE TABLE rate_limits");
      }
    }

    // Step 5: Canonical store_settings verification
    const storeSettingsTable = await tableExists(conn, "store_settings");
    if (storeSettingsTable) {
      const idCol = await columnExists(conn, "store_settings", "id");
      if (!idCol) {
        console.log("Aligning local test store_settings table to canonical schema (id, settings_json)...");
        if (!isDryRun) {
          await conn.query(`DROP TABLE IF EXISTS \`store_settings\``);
          await conn.query(`
            CREATE TABLE \`store_settings\` (
              \`id\` INT NOT NULL DEFAULT 1,
              \`settings_json\` JSON NOT NULL,
              \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
              \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
              PRIMARY KEY (\`id\`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
          `);
          console.log("  -> Re-aligned store_settings table to canonical schema");
        }
      }
    }

    console.log(`\n[SUCCESS] Migration 007 ${isDryRun ? "dry-run verification" : "application"} completed successfully.`);
  } catch (err: any) {
    console.error("\nMigration runner failed:", err);
    process.exit(1);
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
