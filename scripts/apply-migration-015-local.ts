import mysql from "mysql2/promise";

async function applyMigration015() {
  console.log("Applying Migration 015 to local databases (dearr_local, dearr_test)...");

  const targets = ["dearr_local", "dearr_test"];

  for (const db of targets) {
    console.log(`Connecting to local ${db}...`);
    const conn = await mysql.createConnection({
      host: "127.0.0.1",
      port: 3306,
      user: "dearr_app",
      password: "Y!T+gHkYrtE=8Y8zu6nAZpGe",
      database: db,
    });

    const [check]: any = await conn.query("SELECT DATABASE() as db");
    if (check[0].db !== db) throw new Error("Database mismatch");

    // 1. Check unique key on order_shipments
    const [indexes]: any = await conn.query(
      `SELECT CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'order_shipments' AND CONSTRAINT_NAME = 'uq_order_shipments_order_id'`,
      [db]
    );

    if (indexes.length === 0) {
      console.log(`  Adding unique key uq_order_shipments_order_id on ${db}.order_shipments...`);
      await conn.query("ALTER TABLE `order_shipments` ADD UNIQUE KEY `uq_order_shipments_order_id` (`order_id`)");
      console.log(`  ✓ Added unique key to order_shipments on ${db}`);
    } else {
      console.log(`  . Unique key already exists on ${db}.order_shipments`);
    }

    // 2. Check stock_restored_at and rto_at columns on orders
    const [cols]: any = await conn.query(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'stock_restored_at'`,
      [db]
    );

    if (cols.length === 0) {
      console.log(`  Adding stock_restored_at and rto_at to ${db}.orders...`);
      await conn.query(`
        ALTER TABLE \`orders\`
          ADD COLUMN \`stock_restored_at\` DATETIME DEFAULT NULL AFTER \`cod_collected_at\`,
          ADD COLUMN \`rto_at\` DATETIME DEFAULT NULL AFTER \`stock_restored_at\`
      `);
      console.log(`  ✓ Added stock_restored_at and rto_at to orders on ${db}`);
    } else {
      console.log(`  . Columns stock_restored_at / rto_at already exist on ${db}.orders`);
    }

    await conn.end();
  }
}

applyMigration015()
  .then(() => {
    console.log("Migration 015 successfully applied locally.");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Migration 015 failed:", err);
    process.exit(1);
  });
