/**
 * Standalone Idempotent Checkout Attempts Cleanup Script
 *
 * Can be executed via Node/tsx or scheduled in Hostinger cron:
 *   e.g. Every 15 minutes: * /15 * * * * node scripts/cleanup-checkout-attempts.mjs
 *
 * Lifecycle Rules:
 * 1. Expire unpaid checkout attempts older than 30 minutes.
 * 2. Purge expired checkout attempts past the 30-day retention period.
 * 3. Never touches placed orders, customers, or products.
 */

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

async function runCleanup() {
  const host = process.env.DB_HOST || "127.0.0.1";
  const port = parseInt(process.env.DB_PORT || "3306", 10);
  const user = process.env.DB_USER || "root";
  const password = process.env.DB_PASSWORD || "";
  const database = process.env.DB_NAME || "dearr_local";

  console.log(`[Checkout Attempt Cleanup] Connecting to ${database} on ${host}:${port}...`);

  const connection = await mysql.createConnection({
    host,
    port,
    user,
    password,
    database,
    connectTimeout: 10000,
  });

  try {
    const [tables]: any = await connection.query("SHOW TABLES LIKE 'checkout_attempts'");
    if (tables.length === 0) {
      console.log("[Checkout Attempt Cleanup] Table 'checkout_attempts' does not exist. Nothing to clean.");
      return;
    }

    // 1. Expire attempts older than 30 minutes and set 90-day retention
    const [expireResult]: any = await connection.query(
      `UPDATE checkout_attempts
       SET status = 'expired',
           retention_until = DATE_ADD(NOW(), INTERVAL 90 DAY),
           updated_at = NOW()
       WHERE status = 'pending'
         AND expires_at < NOW()`
    );
    console.log(`[Checkout Attempt Cleanup] Expired attempts (>30 min): ${expireResult?.affectedRows || 0}`);

    // 2. Purge expired/failed/abandoned attempts older than retention period
    const [toPurge]: any = await connection.query(
      `SELECT id FROM checkout_attempts
       WHERE status IN ('expired', 'failed', 'abandoned')
         AND retention_until < NOW()`
    );
    if (toPurge && toPurge.length > 0) {
      const purgeIds = toPurge.map((a: any) => a.id);
      const placeholders = purgeIds.map(() => "?").join(",");
      await connection.query(
        `DELETE FROM stock_reservations WHERE attempt_id IN (${placeholders})`,
        purgeIds
      );
    }

    const [purgeResult]: any = await connection.query(
      `DELETE FROM checkout_attempts
       WHERE status IN ('expired', 'failed', 'abandoned')
         AND retention_until < NOW()`
    );
    console.log(`[Checkout Attempt Cleanup] Purged attempts (>retention deadline): ${purgeResult?.affectedRows || 0}`);

    console.log("[Checkout Attempt Cleanup] ✓ Completed successfully.");
  } finally {
    await connection.end();
  }
}

export { runCleanup as cleanupCheckoutAttempts };

if (process.argv[1] && process.argv[1].includes("cleanup-checkout-attempts")) {
  runCleanup().catch((err) => {
    console.error("[Checkout Attempt Cleanup Error]:", err.message);
    process.exit(1);
  });
}
