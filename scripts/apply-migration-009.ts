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

async function main() {
  const isDryRun = process.argv.includes("--dry-run");
  const env = loadEnv();

  console.log("=== Migration 009 Safety Pre-Flight ===");
  console.log("Target Host:", env.DB_HOST);
  console.log("Target Port:", env.DB_PORT);
  console.log("Target Database:", env.DB_NAME);
  console.log("Mode:", isDryRun ? "DRY RUN (no changes)" : "APPLY MIGRATION");

  if (env.DB_HOST !== "127.0.0.1" && env.DB_HOST !== "localhost") {
    throw new Error("ABSOLUTE SAFEGUARD: Host is not loopback (127.0.0.1)!");
  }
  if (env.DB_NAME !== "dearr_test" && env.DB_NAME !== "dearr_local") {
    throw new Error("ABSOLUTE SAFEGUARD: Database name must strictly be 'dearr_test' or 'dearr_local'!");
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
      const backupPath = path.resolve(scratchDir, `backup_${env.DB_NAME}_pre_009.sql`);
      console.log(`\nBacking up database '${env.DB_NAME}' to ${backupPath}...`);
      const [tables]: any = await conn.query("SHOW TABLES;");
      let dumpContent = `-- SNAPSHOT BACKUP PRE MIGRATION 009\n-- Target: ${env.DB_NAME}\n-- Time: ${new Date().toISOString()}\n\n`;
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

    const codEnabledExists = await columnExists(conn, "products", "cod_enabled");
    console.log(`products.cod_enabled exists: ${codEnabledExists}`);

    if (!codEnabledExists) {
      const sql = `ALTER TABLE \`products\` ADD COLUMN \`cod_enabled\` TINYINT(1) NOT NULL DEFAULT 1 AFTER \`has_colors\`, ADD KEY \`idx_products_cod_enabled\` (\`cod_enabled\`)`;
      if (!isDryRun) {
        await conn.query(sql);
        console.log("  -> Successfully added products.cod_enabled column with default 1 and index.");
      } else {
        console.log("  [DRY RUN] Would execute: " + sql);
      }
    } else {
      console.log("  -> products.cod_enabled already exists. No alteration needed.");
    }

    console.log("\n=== Migration 009 Completed Successfully ===");
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error("Migration 009 failed:", err.message);
  process.exit(1);
});
