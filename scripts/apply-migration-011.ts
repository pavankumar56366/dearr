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

  const host = env.DB_HOST || "127.0.0.1";
  const port = parseInt(env.DB_PORT || "3306", 10);
  const database = "dearr_test"; // Strictly dearr_test

  console.log("=== Migration 011 Safety Pre-Flight ===");
  console.log("Target Host:", host);
  console.log("Target Port:", port);
  console.log("Target Database:", database);
  console.log("Mode:", isDryRun ? "DRY RUN (no changes)" : "APPLY MIGRATION");

  if (host !== "127.0.0.1" && host !== "localhost") {
    throw new Error("ABSOLUTE SAFEGUARD: Host is not loopback (127.0.0.1)!");
  }

  const conn = await mysql.createConnection({
    host,
    port,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database,
    multipleStatements: true,
  });

  try {
    const [targetRows]: any = await conn.query("SELECT DATABASE() as db");
    if (targetRows[0].db !== "dearr_test") {
      throw new Error("ABSOLUTE SAFEGUARD: Connected database is not dearr_test!");
    }

    // 1. Back up database first if applying
    if (!isDryRun) {
      const scratchDir = path.resolve(process.cwd(), "scratch");
      if (!fs.existsSync(scratchDir)) {
        fs.mkdirSync(scratchDir, { recursive: true });
      }
      const backupPath = path.resolve(scratchDir, `backup_${database}_pre_011.sql`);
      console.log(`\nBacking up database '${database}' to ${backupPath}...`);
      const [tables]: any = await conn.query("SHOW TABLES;");
      let dumpContent = `-- SNAPSHOT BACKUP PRE MIGRATION 011\n-- Target: ${database}\n-- Time: ${new Date().toISOString()}\n\n`;
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

    const otpsTableExists = await tableExists(conn, "password_reset_otps");
    console.log(`password_reset_otps exists: ${otpsTableExists}`);

    if (!otpsTableExists) {
      const createOtpsSql = `
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`;

      if (!isDryRun) {
        await conn.query(createOtpsSql);
        console.log("  -> Successfully created `password_reset_otps` table.");
      } else {
        console.log("  [DRY RUN] Would execute creation of `password_reset_otps`.");
      }
    } else {
      console.log("  -> `password_reset_otps` already exists.");
    }

    const outboxTableExists = await tableExists(conn, "email_outbox");
    console.log(`email_outbox exists: ${outboxTableExists}`);

    if (!outboxTableExists) {
      const createOutboxSql = `
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`;

      if (!isDryRun) {
        await conn.query(createOutboxSql);
        console.log("  -> Successfully created `email_outbox` table.");
      } else {
        console.log("  [DRY RUN] Would execute creation of `email_outbox`.");
      }
    } else {
      console.log("  -> `email_outbox` already exists.");
    }

    console.log("\n=== Migration 011 Completed Successfully ===");
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error("Migration 011 failed:", err.message);
  process.exit(1);
});
