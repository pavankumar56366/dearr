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
  let host = process.env.DB_HOST || "srv1741.hstgr.io";
  const port = parseInt(process.env.DB_PORT || "3306", 10);
  const user = process.env.DB_USER || "u209580425_dearr_user";
  const password = process.env.DB_PASSWORD;
  const database = process.env.DB_NAME || "u209580425_Dearr";

  console.log(`[Dearr Migration] Target Database: ${database} on ${host}:${port} (user: ${user})`);

  let connection: mysql.Connection | null = null;
  try {
    connection = await mysql.createConnection({
      host,
      port,
      user,
      password,
      database,
      multipleStatements: true,
      connectTimeout: 10000,
    });
  } catch (err: any) {
    // If the configured DB_HOST failed and was an IP, attempt srv1741.hstgr.io
    if (host !== "srv1741.hstgr.io") {
      console.warn(`[Dearr Migration] Connection to ${host} failed (${err.message}). Trying srv1741.hstgr.io...`);
      host = "srv1741.hstgr.io";
      try {
        connection = await mysql.createConnection({
          host,
          port,
          user,
          password,
          database,
          multipleStatements: true,
          connectTimeout: 10000,
        });
        console.log(`[Dearr Migration] Successfully connected via srv1741.hstgr.io`);
      } catch (err2: any) {
        console.error(`[Dearr Migration Error] Connection failed:`, err2.message);
        process.exit(1);
      }
    } else {
      console.error(`[Dearr Migration Error] Connection failed:`, err.message);
      process.exit(1);
    }
  }

  try {
    // 1. Inspect existing tables before making changes
    const [existingTables]: any = await connection.query("SHOW TABLES;");
    console.log(`[Dearr Migration] Pre-check: Found ${existingTables.length} existing tables in database.`);

    // 2. Read migration file
    const migrationFile = path.resolve(process.cwd(), "database/migrations/001_initial_schema.sql");
    const sql = fs.readFileSync(migrationFile, "utf-8");

    console.log(`[Dearr Migration] Executing 001_initial_schema.sql...`);
    await connection.query(sql);
    console.log(`[Dearr Migration] Migration executed successfully!`);

    // 3. Verify tables
    const expectedTables = [
      "profiles",
      "categories",
      "products",
      "product_images",
      "product_variants",
      "wishlists",
      "wishlist_items",
      "carts",
      "cart_items",
      "discounts",
      "discount_products",
      "discount_categories",
      "addresses",
      "orders",
      "order_items",
      "payments",
      "reviews",
      "audit_logs",
    ];

    const [postTables]: any = await connection.query("SHOW TABLES;");
    const tableNames: string[] = postTables.map((r: any) => Object.values(r)[0]);

    console.log("\n--- Verified Tables in Database ---");
    let allFound = true;
    for (const expected of expectedTables) {
      const exists = tableNames.includes(expected);
      console.log(`  ${exists ? "✓" : "✗"} ${expected}`);
      if (!exists) allFound = false;
    }

    if (allFound) {
      console.log(`\n[Dearr Migration] PASSED: All 18 Dearr V1 relational tables exist in MySQL.`);
    } else {
      console.error(`\n[Dearr Migration] FAILED: Some tables were missing.`);
      process.exit(1);
    }
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

main().catch((err) => {
  console.error("Migration fatal error:", err);
  process.exit(1);
});
