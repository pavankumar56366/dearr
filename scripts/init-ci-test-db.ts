import fs from "fs";
import path from "path";
import mysql from "mysql2/promise";
import { assertTestDatabaseSafety } from "./test-db-safety";

async function main() {
  console.log("================================================================================");
  console.log("DEARR ISOLATED TEST DATABASE INITIALIZER (CI & TEST RUNNERS)");
  console.log("================================================================================\n");

  const host = process.env.DB_HOST || "127.0.0.1";
  const port = parseInt(process.env.DB_PORT || "3306", 10);
  const database = process.env.DB_NAME || "dearr_test";
  const user = process.env.DB_USER || "root";
  const password = process.env.DB_PASSWORD || "rootpassword";

  // Strict Fail-Closed Safeguard using centralized database safety validator
  assertTestDatabaseSafety({
    host,
    port,
    database,
    user,
    password,
    isTestMode: true,
  });

  console.log(`Connecting to local MySQL at ${host}:${port} as ${user}...`);

  // 1. Connect without selecting database to ensure database exists
  const serverConn = await mysql.createConnection({
    host,
    port,
    user,
    password,
    multipleStatements: true,
  });

  console.log(`Ensuring database '${database}' exists...`);
  await serverConn.query(`CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
  await serverConn.end();

  // 2. Connect directly to target test database
  console.log(`Connecting to '${database}'...`);
  const conn = await mysql.createConnection({
    host,
    port,
    user,
    password,
    database,
    multipleStatements: true,
  });

  // 3. Inspect existing tables
  const [existingTables]: any = await conn.query("SHOW TABLES;");
  const tableNames = existingTables.map((t: any) => Object.values(t)[0]);
  console.log(`Existing tables in ${database}: ${tableNames.length}`);

  // 4. Apply all migration files in sequence if not already fully applied
  const migrationsDir = path.resolve(process.cwd(), "database/migrations");
  const migrationFiles = fs
    .readdirSync(migrationsDir)
    .filter((f) => /^0\d+_.*\.sql$/.test(f))
    .sort();

  if (tableNames.length === 0) {
    console.log(`Applying ${migrationFiles.length} migrations sequentially...`);
    for (const file of migrationFiles) {
      console.log(`  Applying ${file}...`);
      const sql = fs.readFileSync(path.join(migrationsDir, file), "utf-8");
      await conn.query(sql);
    }
    console.log("[PASS] All database migrations applied successfully.");

    // 5. Seed baseline catalog demo fixtures
    console.log("Applying baseline demo seeds from database/seeds/001_demo_data.sql...");
    const seedSql = fs.readFileSync(path.resolve(process.cwd(), "database/seeds/001_demo_data.sql"), "utf-8");
    await conn.query(seedSql);
    console.log("[PASS] Baseline catalog demo fixtures seeded.");
  } else {
    console.log(`[SKIP] Database already contains ${tableNames.length} tables. Running schema verification.`);
  }

  const [finalTables]: any = await conn.query("SHOW TABLES;");
  console.log(`\nVerified tables in ${database}: ${finalTables.length}`);

  await conn.end();
  console.log("\n================================================================================");
  console.log("TEST DATABASE INITIALIZATION COMPLETED SUCCESSFULLY");
  console.log("================================================================================\n");
}

main().catch((err) => {
  console.error("[FATAL ERROR during test database initialization]:", err);
  process.exit(1);
});
