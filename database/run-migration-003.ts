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

  console.log(`[Migration 003] Target: ${database} on ${host}:${port}`);

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
    // 1. Inspect profiles columns
    const [columns]: any = await connection.query(
      "SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'profiles' ORDER BY ORDINAL_POSITION",
      [database]
    );

    const colNames: string[] = columns.map((c: any) => c.COLUMN_NAME);
    console.log("[Migration 003] Existing profiles columns:", colNames.join(", "));

    // 2. Add status column if missing
    if (!colNames.includes("status")) {
      console.log("[Migration 003] Adding 'status' ENUM('active','suspended') to profiles...");
      await connection.query(`
        ALTER TABLE \`profiles\`
        ADD COLUMN \`status\` ENUM('active', 'suspended') NOT NULL DEFAULT 'active' AFTER \`role\`
      `);
      console.log("[Migration 003] ✓ 'status' column added.");
    } else {
      console.log("[Migration 003] ✓ 'status' column already exists.");
    }

    // 3. Add admin_notes column if missing
    if (!colNames.includes("admin_notes")) {
      console.log("[Migration 003] Adding 'admin_notes' TEXT to profiles...");
      await connection.query(`
        ALTER TABLE \`profiles\`
        ADD COLUMN \`admin_notes\` TEXT DEFAULT NULL AFTER \`status\`
      `);
      console.log("[Migration 003] ✓ 'admin_notes' column added.");
    } else {
      console.log("[Migration 003] ✓ 'admin_notes' column already exists.");
    }

    // 4. Ensure status index exists
    const [indexes]: any = await connection.query(
      "SHOW INDEX FROM `profiles` WHERE Key_name = 'idx_profiles_status'"
    );
    if (indexes.length === 0) {
      console.log("[Migration 003] Adding index 'idx_profiles_status' on profiles...");
      await connection.query(`
        ALTER TABLE \`profiles\`
        ADD KEY \`idx_profiles_status\` (\`status\`)
      `);
      console.log("[Migration 003] ✓ 'idx_profiles_status' index added.");
    } else {
      console.log("[Migration 003] ✓ 'idx_profiles_status' index already exists.");
    }

    // 5. Create store_settings table if missing
    console.log("[Migration 003] Ensuring store_settings table exists...");
    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`store_settings\` (
        \`id\` INT NOT NULL DEFAULT 1,
        \`settings_json\` JSON NOT NULL,
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log("[Migration 003] ✓ 'store_settings' table verified.");

    // 6. Verify final structure
    const [updatedCols]: any = await connection.query(
      "SELECT COLUMN_NAME, COLUMN_TYPE, COLUMN_DEFAULT FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'profiles' ORDER BY ORDINAL_POSITION",
      [database]
    );
    console.log("\n--- Updated profiles Columns ---");
    for (const col of updatedCols) {
      console.log(`  ${col.COLUMN_NAME}: ${col.COLUMN_TYPE} (default: ${col.COLUMN_DEFAULT})`);
    }

    const [settingsTables]: any = await connection.query(
      "SHOW TABLES LIKE 'store_settings'"
    );
    console.log(`\n--- store_settings check: ${settingsTables.length > 0 ? "EXISTS" : "MISSING"} ---`);

    console.log("\n[Migration 003] ✓ Completed successfully.");
  } finally {
    await connection.end();
  }
}

main().catch((err) => {
  console.error("[Migration 003 Error]:", err);
  process.exit(1);
});
