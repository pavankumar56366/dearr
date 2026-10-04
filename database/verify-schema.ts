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

  const connection = await mysql.createConnection({
    host,
    port,
    user,
    password,
    database,
    multipleStatements: true,
  });

  try {
    console.log(`[Dearr Schema Verification] Checking tables in ${database} on ${host}...`);

    // 1. Check Tables
    const [tables]: any = await connection.query(`
      SELECT 
        table_name AS tableName,
        engine,
        table_collation AS collation
      FROM information_schema.tables
      WHERE table_schema = DATABASE()
      ORDER BY table_name ASC;
    `);

    console.log("\n--- Relational Tables in MySQL ---");
    console.table(tables);

    // 2. Check Foreign Keys
    const [fks]: any = await connection.query(`
      SELECT 
        constraint_name AS constraintName,
        table_name AS tableName,
        referenced_table_name AS referencedTable
      FROM information_schema.referential_constraints
      WHERE constraint_schema = DATABASE()
      ORDER BY table_name, constraint_name;
    `);

    console.log("\n--- Foreign Key Constraints ---");
    console.table(fks);

    console.log(`\nTotal Tables: ${tables.length}`);
    console.log(`Total Foreign Keys: ${fks.length}`);
    console.log("[Dearr Schema Verification] Verification completed successfully.");
  } finally {
    await connection.end();
  }
}

main().catch((err) => {
  console.error("Verification error:", err);
  process.exit(1);
});
