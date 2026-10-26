import mysql from "mysql2/promise";
import fs from "fs";
import path from "path";

async function applyMigration012ToLocal() {
  console.log("================================================================================");
  console.log("APPLYING MIGRATION 012 TO LOCAL DATABASE (dearr_local)");
  console.log("================================================================================\n");

  const conn = await mysql.createConnection({
    host: "127.0.0.1",
    port: 3306,
    user: "dearr_app",
    password: "Y!T+gHkYrtE=8Y8zu6nAZpGe",
    database: "dearr_local",
    multipleStatements: true,
  });

  const [dbRows]: any = await conn.query("SELECT DATABASE() as db");
  if (dbRows[0].db !== "dearr_local") {
    throw new Error(`Connected to ${dbRows[0].db}, expected dearr_local!`);
  }

  console.log(`[VERIFIED] Connected to local database: ${dbRows[0].db}\n`);

  // Step 1: Check and apply product_variants extensions
  const [cols1]: any = await conn.query(
    "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'product_variants' AND COLUMN_NAME = 'color_id'"
  );

  if (cols1.length === 0) {
    console.log("Applying Migration 012 Step 1 to product_variants...");
    await conn.query(`
      ALTER TABLE \`product_variants\`
        ADD COLUMN \`color_id\` CHAR(36) DEFAULT NULL AFTER \`product_id\`,
        ADD COLUMN \`size_name\` VARCHAR(100) DEFAULT NULL AFTER \`color_id\`,
        ADD COLUMN \`combo_hash\` VARCHAR(150) GENERATED ALWAYS AS (
          CASE
            WHEN \`color_id\` IS NOT NULL OR (\`size_name\` IS NOT NULL AND TRIM(\`size_name\`) != '') THEN
              CONCAT(COALESCE(\`color_id\`, '00000000-0000-0000-0000-000000000000'), '::', LOWER(TRIM(\`size_name\`)))
            ELSE NULL
          END
        ) VIRTUAL AFTER \`size_name\`,
        ADD KEY \`idx_product_variants_color_id\` (\`color_id\`),
        ADD KEY \`idx_product_variants_size_name\` (\`size_name\`),
        ADD UNIQUE KEY \`uq_product_variants_combo\` (\`product_id\`, \`combo_hash\`),
        ADD CONSTRAINT \`fk_product_variants_color\`
          FOREIGN KEY (\`color_id\`) REFERENCES \`product_colors\` (\`id\`) ON DELETE CASCADE ON UPDATE CASCADE;
    `);
    console.log("  [+] product_variants extensions applied (color_id, size_name, combo_hash, uq_product_variants_combo, fk_product_variants_color)");
  } else {
    console.log("  [.] product_variants.color_id already exists.");
  }

  // Step 2: Check and apply stock_reservations extensions
  const [cols2]: any = await conn.query(
    "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'stock_reservations' AND COLUMN_NAME = 'variant_id'"
  );

  if (cols2.length === 0) {
    console.log("Applying Migration 012 Step 2 to stock_reservations...");
    await conn.query(`
      ALTER TABLE \`stock_reservations\`
        ADD COLUMN \`variant_id\` CHAR(36) DEFAULT NULL AFTER \`color_id\`,
        ADD KEY \`idx_stock_reservations_variant_status\` (\`variant_id\`, \`status\`),
        ADD CONSTRAINT \`fk_stock_reservations_variant\`
          FOREIGN KEY (\`variant_id\`) REFERENCES \`product_variants\` (\`id\`) ON DELETE SET NULL ON UPDATE CASCADE;
    `);
    console.log("  [+] stock_reservations extensions applied (variant_id, idx_stock_reservations_variant_status, fk_stock_reservations_variant)");
  } else {
    console.log("  [.] stock_reservations.variant_id already exists.");
  }

  await conn.end();
  console.log("\n================================================================================");
  console.log("MIGRATION 012 SUCCESSFULLY APPLIED TO dearr_local");
  console.log("================================================================================\n");
}

applyMigration012ToLocal().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
