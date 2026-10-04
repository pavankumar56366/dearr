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
  });

  try {
    console.log(`[Dearr B-03 Audit] Connected to ${database} on ${host}:${port}`);

    // 1. Audit Tables
    const [tables]: any = await connection.query(`
      SELECT table_name, engine, table_collation
      FROM information_schema.tables
      WHERE table_schema = DATABASE()
      ORDER BY table_name;
    `);
    console.log(`\n=== 1. TABLES AUDIT (${tables.length} tables found) ===`);
    console.table(tables);

    // 2. Audit Primary Keys
    const [pks]: any = await connection.query(`
      SELECT 
        k.table_name,
        k.column_name,
        c.data_type,
        c.column_type
      FROM information_schema.table_constraints t
      JOIN information_schema.key_column_usage k
        ON t.constraint_name = k.constraint_name
        AND t.table_schema = k.table_schema
        AND t.table_name = k.table_name
      JOIN information_schema.columns c
        ON k.table_schema = c.table_schema
        AND k.table_name = c.table_name
        AND k.column_name = c.column_name
      WHERE t.constraint_type = 'PRIMARY KEY'
        AND t.table_schema = DATABASE()
      ORDER BY k.table_name;
    `);
    console.log(`\n=== 2. PRIMARY KEYS AUDIT (${pks.length} primary keys) ===`);
    console.table(pks);

    // 3. Audit Foreign Keys with ON DELETE & ON UPDATE rules
    const [fks]: any = await connection.query(`
      SELECT 
        r.constraint_name,
        r.table_name AS child_table,
        k.column_name AS child_column,
        r.referenced_table_name AS parent_table,
        k.referenced_column_name AS parent_column,
        r.delete_rule,
        r.update_rule
      FROM information_schema.referential_constraints r
      JOIN information_schema.key_column_usage k
        ON r.constraint_name = k.constraint_name
        AND r.constraint_schema = k.constraint_schema
      WHERE r.constraint_schema = DATABASE()
      ORDER BY r.table_name, r.constraint_name;
    `);
    console.log(`\n=== 3. FOREIGN KEYS & CASCADE RULES (${fks.length} foreign keys) ===`);
    console.table(fks);

    // 4. Audit Unique Constraints
    const [uniques]: any = await connection.query(`
      SELECT 
        t.table_name,
        t.constraint_name,
        GROUP_CONCAT(k.column_name ORDER BY k.ordinal_position) AS unique_columns
      FROM information_schema.table_constraints t
      JOIN information_schema.key_column_usage k
        ON t.constraint_name = k.constraint_name
        AND t.table_schema = k.table_schema
        AND t.table_name = k.table_name
      WHERE t.constraint_type = 'UNIQUE'
        AND t.table_schema = DATABASE()
      GROUP BY t.table_name, t.constraint_name
      ORDER BY t.table_name, t.constraint_name;
    `);
    console.log(`\n=== 4. UNIQUE CONSTRAINTS (${uniques.length} unique constraints) ===`);
    console.table(uniques);

    // 5. Audit CHECK Constraints (MySQL 8.0.16+)
    const [checks]: any = await connection.query(`
      SELECT 
        tc.table_name,
        tc.constraint_name,
        cc.check_clause
      FROM information_schema.table_constraints tc
      JOIN information_schema.check_constraints cc
        ON tc.constraint_name = cc.constraint_name
        AND tc.constraint_schema = cc.constraint_schema
      WHERE tc.table_schema = DATABASE()
      ORDER BY tc.table_name, tc.constraint_name;
    `);
    console.log(`\n=== 5. CHECK CONSTRAINTS (${checks.length} check constraints) ===`);
    console.table(checks);

    // 6. Audit Indexes
    const [indexes]: any = await connection.query(`
      SELECT 
        table_name,
        index_name,
        non_unique,
        GROUP_CONCAT(column_name ORDER BY seq_in_index) AS indexed_columns
      FROM information_schema.statistics
      WHERE table_schema = DATABASE()
      GROUP BY table_name, index_name, non_unique
      ORDER BY table_name, index_name;
    `);
    console.log(`\n=== 6. INDEXES AUDIT (${indexes.length} indexes) ===`);
    console.table(indexes);

  } finally {
    await connection.end();
  }
}

main().catch((err) => {
  console.error("Audit error:", err);
  process.exit(1);
});
