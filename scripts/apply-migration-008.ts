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

async function getColumnType(conn: mysql.Connection, table: string, column: string): Promise<string> {
  const [rows]: any = await conn.query(
    `SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column]
  );
  return rows && rows.length > 0 ? rows[0].COLUMN_TYPE : "";
}

async function main() {
  const isDryRun = process.argv.includes("--dry-run");
  const env = loadEnv();

  console.log("=== Migration 008 Safety Pre-Flight ===");
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
      const backupPath = path.resolve(scratchDir, "backup_dearr_test_pre_008.sql");
      console.log(`\nBacking up database '${env.DB_NAME}' to ${backupPath}...`);
      const [tables]: any = await conn.query("SHOW TABLES;");
      let dumpContent = `-- SNAPSHOT BACKUP PRE MIGRATION 008\n-- Target: ${env.DB_NAME}\n-- Time: ${new Date().toISOString()}\n\n`;
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

    // Step 1: checkout_attempts updates
    const currentStatusType = await getColumnType(conn, "checkout_attempts", "status");
    console.log(`checkout_attempts.status column type: ${currentStatusType}`);
    if (!currentStatusType.includes("'abandoned'")) {
      const sql = `ALTER TABLE \`checkout_attempts\` MODIFY COLUMN \`status\` ENUM('pending', 'verified', 'converted', 'expired', 'failed', 'abandoned') NOT NULL DEFAULT 'pending'`;
      if (!isDryRun) {
        await conn.query(sql);
        console.log("  -> Updated checkout_attempts.status ENUM to include 'abandoned'");
      } else {
        console.log("  [DRY RUN] Would execute: " + sql);
      }
    }

    const recoveryShownCol = await columnExists(conn, "checkout_attempts", "recovery_shown_at");
    console.log(`checkout_attempts.recovery_shown_at exists: ${recoveryShownCol}`);
    if (!recoveryShownCol) {
      const sql = `ALTER TABLE \`checkout_attempts\` ADD COLUMN \`recovery_shown_at\` DATETIME DEFAULT NULL AFTER \`order_id\`, ADD KEY \`idx_checkout_attempts_recovery_shown\` (\`status\`, \`recovery_shown_at\`)`;
      if (!isDryRun) {
        await conn.query(sql);
        console.log("  -> Added checkout_attempts.recovery_shown_at");
      } else {
        console.log("  [DRY RUN] Would execute: " + sql);
      }
    }

    const abandonedAtCol = await columnExists(conn, "checkout_attempts", "abandoned_at");
    console.log(`checkout_attempts.abandoned_at exists: ${abandonedAtCol}`);
    if (!abandonedAtCol) {
      const sql = `ALTER TABLE \`checkout_attempts\` ADD COLUMN \`abandoned_at\` DATETIME DEFAULT NULL AFTER \`recovery_shown_at\`, ADD KEY \`idx_checkout_attempts_status_abandoned\` (\`status\`, \`abandoned_at\`)`;
      if (!isDryRun) {
        await conn.query(sql);
        console.log("  -> Added checkout_attempts.abandoned_at");
      } else {
        console.log("  [DRY RUN] Would execute: " + sql);
      }
    }

    const errorCodeCol = await columnExists(conn, "checkout_attempts", "gateway_error_code");
    console.log(`checkout_attempts.gateway_error_code exists: ${errorCodeCol}`);
    if (!errorCodeCol) {
      const sql = `ALTER TABLE \`checkout_attempts\` ADD COLUMN \`gateway_error_code\` VARCHAR(100) DEFAULT NULL AFTER \`abandoned_at\``;
      if (!isDryRun) {
        await conn.query(sql);
        console.log("  -> Added checkout_attempts.gateway_error_code");
      } else {
        console.log("  [DRY RUN] Would execute: " + sql);
      }
    }

    const errorDescCol = await columnExists(conn, "checkout_attempts", "gateway_error_desc");
    console.log(`checkout_attempts.gateway_error_desc exists: ${errorDescCol}`);
    if (!errorDescCol) {
      const sql = `ALTER TABLE \`checkout_attempts\` ADD COLUMN \`gateway_error_desc\` VARCHAR(500) DEFAULT NULL AFTER \`gateway_error_code\``;
      if (!isDryRun) {
        await conn.query(sql);
        console.log("  -> Added checkout_attempts.gateway_error_desc");
      } else {
        console.log("  [DRY RUN] Would execute: " + sql);
      }
    }

    // Step 2: checkout_feedback table
    const feedbackTable = await tableExists(conn, "checkout_feedback");
    console.log(`checkout_feedback table exists: ${feedbackTable}`);
    if (!feedbackTable) {
      const sql = `CREATE TABLE IF NOT EXISTS \`checkout_feedback\` (
        \`id\` CHAR(36) NOT NULL,
        \`attempt_id\` CHAR(36) NOT NULL,
        \`user_id\` CHAR(36) DEFAULT NULL,
        \`guest_identifier\` VARCHAR(100) DEFAULT NULL,
        \`reasons\` JSON NOT NULL,
        \`comment\` VARCHAR(300) DEFAULT NULL,
        \`skipped\` TINYINT(1) NOT NULL DEFAULT 0,
        \`ip_address\` VARCHAR(45) DEFAULT NULL,
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`idx_checkout_feedback_attempt\` (\`attempt_id\`),
        KEY \`idx_checkout_feedback_user\` (\`user_id\`),
        KEY \`idx_checkout_feedback_created_at\` (\`created_at\`),
        CONSTRAINT \`fk_checkout_feedback_attempt\` FOREIGN KEY (\`attempt_id\`) REFERENCES \`checkout_attempts\` (\`id\`) ON DELETE CASCADE ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`;
      if (!isDryRun) {
        await conn.query(sql);
        console.log("  -> Created checkout_feedback table");
      } else {
        console.log("  [DRY RUN] Would execute CREATE TABLE checkout_feedback");
      }
    }

    // Step 3: notification_consents table
    const consentTable = await tableExists(conn, "notification_consents");
    console.log(`notification_consents table exists: ${consentTable}`);
    if (!consentTable) {
      const sql = `CREATE TABLE IF NOT EXISTS \`notification_consents\` (
        \`id\` CHAR(36) NOT NULL,
        \`user_id\` CHAR(36) DEFAULT NULL,
        \`attempt_id\` CHAR(36) DEFAULT NULL,
        \`channel\` ENUM('email', 'whatsapp', 'sms') NOT NULL,
        \`contact_value\` VARCHAR(255) NOT NULL,
        \`consent_text\` VARCHAR(500) NOT NULL,
        \`source\` VARCHAR(50) NOT NULL DEFAULT 'checkout_abandonment',
        \`is_withdrawn\` TINYINT(1) NOT NULL DEFAULT 0,
        \`withdrawn_at\` DATETIME DEFAULT NULL,
        \`ip_address\` VARCHAR(45) DEFAULT NULL,
        \`user_agent\` VARCHAR(255) DEFAULT NULL,
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        KEY \`idx_notification_consents_user\` (\`user_id\`),
        KEY \`idx_notification_consents_attempt\` (\`attempt_id\`),
        KEY \`idx_notification_consents_channel_contact\` (\`channel\`, \`contact_value\`),
        KEY \`idx_notification_consents_created_at\` (\`created_at\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`;
      if (!isDryRun) {
        await conn.query(sql);
        console.log("  -> Created notification_consents table");
      } else {
        console.log("  [DRY RUN] Would execute CREATE TABLE notification_consents");
      }
    }

    // Step 4: product_price_history table
    const priceHistoryTable = await tableExists(conn, "product_price_history");
    console.log(`product_price_history table exists: ${priceHistoryTable}`);
    if (!priceHistoryTable) {
      const sql = `CREATE TABLE IF NOT EXISTS \`product_price_history\` (
        \`id\` CHAR(36) NOT NULL,
        \`product_id\` CHAR(36) NOT NULL,
        \`color_id\` CHAR(36) DEFAULT NULL,
        \`previous_price\` DECIMAL(10,2) NOT NULL,
        \`new_price\` DECIMAL(10,2) NOT NULL,
        \`current_price\` DECIMAL(10,2) NOT NULL,
        \`change_source\` VARCHAR(50) NOT NULL DEFAULT 'admin',
        \`changed_by\` CHAR(36) DEFAULT NULL,
        \`changed_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        KEY \`idx_price_history_product_time\` (\`product_id\`, \`changed_at\`),
        KEY \`idx_price_history_color\` (\`color_id\`),
        KEY \`idx_price_history_changed_at\` (\`changed_at\`),
        CONSTRAINT \`fk_price_history_product\` FOREIGN KEY (\`product_id\`) REFERENCES \`products\` (\`id\`) ON DELETE CASCADE ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`;
      if (!isDryRun) {
        await conn.query(sql);
        console.log("  -> Created product_price_history table");
      } else {
        console.log("  [DRY RUN] Would execute CREATE TABLE product_price_history");
      }
    }

    // Step 5: internal_events table
    const internalEventsTable = await tableExists(conn, "internal_events");
    console.log(`internal_events table exists: ${internalEventsTable}`);
    if (!internalEventsTable) {
      const sql = `CREATE TABLE IF NOT EXISTS \`internal_events\` (
        \`id\` CHAR(36) NOT NULL,
        \`event_type\` VARCHAR(50) NOT NULL,
        \`attempt_id\` CHAR(36) DEFAULT NULL,
        \`order_id\` CHAR(36) DEFAULT NULL,
        \`user_id\` CHAR(36) DEFAULT NULL,
        \`session_id\` VARCHAR(100) DEFAULT NULL,
        \`metadata\` JSON DEFAULT NULL,
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        KEY \`idx_internal_events_type_time\` (\`event_type\`, \`created_at\`),
        KEY \`idx_internal_events_attempt\` (\`attempt_id\`),
        KEY \`idx_internal_events_order\` (\`order_id\`),
        KEY \`idx_internal_events_created_at\` (\`created_at\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`;
      if (!isDryRun) {
        await conn.query(sql);
        console.log("  -> Created internal_events table");
      } else {
        console.log("  [DRY RUN] Would execute CREATE TABLE internal_events");
      }
    }

    // Step 6: order_export_audits export_type
    const exportTypeCol = await getColumnType(conn, "order_export_audits", "export_type");
    console.log(`order_export_audits.export_type column type: ${exportTypeCol}`);
    if (!exportTypeCol.includes("'abandonment'")) {
      const sql = `ALTER TABLE \`order_export_audits\` MODIFY COLUMN \`export_type\` ENUM('orders', 'summary', 'abandonment') NOT NULL`;
      if (!isDryRun) {
        await conn.query(sql);
        console.log("  -> Updated order_export_audits.export_type ENUM to include 'abandonment'");
      } else {
        console.log("  [DRY RUN] Would execute: " + sql);
      }
    }

    console.log(
      `\n[SUCCESS] Migration 008 ${isDryRun ? "dry-run verification" : "application"} completed successfully.`
    );
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error("\n[FAILED] Migration 008 failed:", err);
  process.exit(1);
});
