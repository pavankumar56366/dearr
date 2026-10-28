import mysql from "mysql2/promise";
import fs from "fs";
import path from "path";

async function applyMigrationsToLocal() {
  console.log("================================================================================");
  console.log("APPLYING MIGRATIONS 013 & 014 TO LOCAL DATABASES ONLY");
  console.log("================================================================================\n");

  const targetDatabases = ["dearr_local", "dearr_test"];

  for (const dbName of targetDatabases) {
    try {
      console.log(`\nConnecting to local database: ${dbName}...`);
      const conn = await mysql.createConnection({
        host: "127.0.0.1",
        port: 3306,
        user: "dearr_app",
        password: "Y!T+gHkYrtE=8Y8zu6nAZpGe",
        database: dbName,
        multipleStatements: true,
      });

      const [dbRows]: any = await conn.query("SELECT DATABASE() as db");
      if (dbRows[0].db !== dbName) {
        throw new Error(`Connected to ${dbRows[0].db}, expected ${dbName}!`);
      }
      console.log(`[VERIFIED] Connected to local ${dbName}`);

      // Read migration 013
      const mig013Path = path.resolve(__dirname, "../database/migrations/013_shiprocket_integration.sql");
      if (fs.existsSync(mig013Path)) {
        const sql013 = fs.readFileSync(mig013Path, "utf-8");
        console.log(`  Applying Migration 013 to ${dbName}...`);
        await conn.query(sql013);
        console.log(`  [+] Migration 013 applied successfully to ${dbName}`);
      }

      // Read migration 014
      const mig014Path = path.resolve(__dirname, "../database/migrations/014_shiprocket_advanced_logistics.sql");
      if (fs.existsSync(mig014Path)) {
        const sql014 = fs.readFileSync(mig014Path, "utf-8");
        console.log(`  Applying Migration 014 to ${dbName}...`);
        await conn.query(sql014);
        console.log(`  [+] Migration 014 applied successfully to ${dbName}`);
      }

      await conn.end();
    } catch (err: any) {
      console.warn(`  [!] Could not apply to ${dbName}:`, err?.message);
    }
  }

  console.log("\n================================================================================");
  console.log("Local migrations finished.");
  console.log("================================================================================\n");
}

applyMigrationsToLocal()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
  });
