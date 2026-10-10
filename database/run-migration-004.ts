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

async function main() {
  const host = process.env.DB_HOST || "srv1741.hstgr.io";
  const port = parseInt(process.env.DB_PORT || "3306", 10);
  const user = process.env.DB_USER || "u209580425_dearr_user";
  const password = process.env.DB_PASSWORD;
  const database = process.env.DB_NAME || "u209580425_Dearr";

  console.log(`[Migration 004] Target: ${database} on ${host}:${port}`);

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
    // 1. Check if category_views table already exists
    const [existing]: any = await connection.query(
      "SHOW TABLES LIKE 'category_views'"
    );

    if (existing.length === 0) {
      console.log("[Migration 004] Creating 'category_views' table...");
      await connection.query(`
        CREATE TABLE IF NOT EXISTS \`category_views\` (
          \`id\` VARCHAR(36) NOT NULL,
          \`category_id\` VARCHAR(36) NOT NULL,
          \`viewed_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          \`session_hash\` VARCHAR(64) DEFAULT NULL,
          PRIMARY KEY (\`id\`),
          KEY \`idx_cat_views_category_time\` (\`category_id\`, \`viewed_at\`),
          KEY \`idx_cat_views_session_window\` (\`category_id\`, \`session_hash\`, \`viewed_at\`),
          CONSTRAINT \`fk_cat_views_category\` FOREIGN KEY (\`category_id\`) REFERENCES \`categories\` (\`id\`) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);
      console.log("[Migration 004] ✓ 'category_views' table created successfully.");
    } else {
      console.log("[Migration 004] ✓ 'category_views' table already exists.");
    }

    // 2. Verify structure
    const [cols]: any = await connection.query(
      "SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'category_views'",
      [database]
    );
    console.log("\n--- Verified category_views Columns ---");
    for (const c of cols) {
      console.log(`  ${c.COLUMN_NAME}: ${c.COLUMN_TYPE} (nullable: ${c.IS_NULLABLE})`);
    }

    console.log("\n[Migration 004] ✓ Completed successfully.");
  } finally {
    await connection.end();
  }
}

main().catch((err) => {
  console.error("[Migration 004 Error]:", err.message);
  process.exit(1);
});
