import fs from "fs";
import path from "path";
import mysql from "mysql2/promise";

// Helper to parse .env.local manually if not in process.env
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

  console.log(`[Google OAuth Migration] Target: ${database} on ${host}:${port}`);

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
    // Step 1: Check current profiles table structure
    const [columns]: any = await connection.query(
      "SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'profiles' ORDER BY ORDINAL_POSITION",
      [database]
    );

    const colNames: string[] = columns.map((c: any) => c.COLUMN_NAME);
    console.log("[Google OAuth Migration] Current profiles columns:", colNames.join(", "));

    const hasGoogleSubject = colNames.includes("google_subject");
    const passwordHashNullable = columns.find((c: any) => c.COLUMN_NAME === "password_hash")?.IS_NULLABLE === "YES";

    // Step 2: Add google_subject if not present
    if (!hasGoogleSubject) {
      console.log("[Google OAuth Migration] Adding google_subject column...");
      await connection.query(`
        ALTER TABLE \`profiles\`
        ADD COLUMN \`google_subject\` VARCHAR(255) DEFAULT NULL AFTER \`email\`,
        ADD UNIQUE KEY \`idx_profiles_google_subject\` (\`google_subject\`)
      `);
      console.log("[Google OAuth Migration] ✓ google_subject column added with UNIQUE index.");
    } else {
      console.log("[Google OAuth Migration] ✓ google_subject already present — skipping.");
    }

    // Step 3: Make password_hash nullable for Google-only accounts
    if (!passwordHashNullable) {
      console.log("[Google OAuth Migration] Making password_hash nullable for Google-only accounts...");
      await connection.query(`
        ALTER TABLE \`profiles\`
        MODIFY COLUMN \`password_hash\` VARCHAR(255) DEFAULT NULL
      `);
      console.log("[Google OAuth Migration] ✓ password_hash is now nullable.");
    } else {
      console.log("[Google OAuth Migration] ✓ password_hash is already nullable — skipping.");
    }

    // Step 4: Verify final structure
    const [finalCols]: any = await connection.query(
      "SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'profiles' ORDER BY ORDINAL_POSITION",
      [database]
    );

    console.log("\n--- Final profiles table structure ---");
    for (const col of finalCols) {
      console.log(`  ${col.COLUMN_NAME} | ${col.COLUMN_TYPE} | nullable=${col.IS_NULLABLE}`);
    }

    const [indexes]: any = await connection.query(
      "SHOW INDEX FROM profiles WHERE Key_name = 'idx_profiles_google_subject'"
    );
    if (indexes.length > 0) {
      console.log("\n[Google OAuth Migration] ✓ UNIQUE index on google_subject confirmed.");
    } else {
      console.error("[Google OAuth Migration] ✗ UNIQUE index on google_subject NOT found.");
      process.exit(1);
    }

    console.log("\n[Google OAuth Migration] COMPLETED SUCCESSFULLY.");
  } finally {
    await connection.end();
  }
}

main().catch((err) => {
  console.error("[Google OAuth Migration] Fatal error:", err.message);
  process.exit(1);
});
