/**
 * Standalone Idempotent Checkout Attempts Cleanup Script (Pure Node.js ESM)
 *
 * Compatible with pure Node.js runtime across all Node versions without tsx or ts-node:
 *   node scripts/cleanup-checkout-attempts.mjs
 *
 * Can also be scheduled in Hostinger cron or local cron scheduler:
 *   Every 15 minutes: *\/15 * * * * cd /path/to/dearr && node scripts/cleanup-checkout-attempts.mjs >> /var/log/dearr-cleanup.log 2>&1
 *
 * Lifecycle Rules:
 * 1. Expire unpaid checkout attempts older than 30 minutes (status = 'pending' AND expires_at < NOW()).
 * 2. Purge expired/failed checkout attempts past the 30-day retention period (retention_until < NOW()).
 * 3. Never touches converted attempts (status = 'converted'), placed orders, customers, or products.
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

export async function runCleanup() {
  const host = process.env.DB_HOST || "127.0.0.1";
  const port = parseInt(process.env.DB_PORT || "3306", 10);
  const user = process.env.DB_USER || "root";
  const password = process.env.DB_PASSWORD || "";
  const database = process.env.DB_NAME || "dearr_local";

  console.log(`[Checkout Attempt Cleanup] Target: ${database} on ${host}:${port}`);

  const connection = await mysql.createConnection({
    host,
    port,
    user,
    password,
    database,
    connectTimeout: 10000,
  });

  try {
    const [tables] = await connection.query("SHOW TABLES LIKE 'checkout_attempts'");
    if (!tables || tables.length === 0) {
      console.log("[Checkout Attempt Cleanup] Table 'checkout_attempts' does not exist. Nothing to clean.");
      return { expiredCount: 0, purgedCount: 0 };
    }

    // 1. Expire attempts older than 30 minutes
    const [expireResult] = await connection.query(
      `UPDATE checkout_attempts
       SET status = 'expired', updated_at = NOW()
       WHERE status = 'pending'
         AND expires_at < NOW()`
    );
    const expiredCount = Number(expireResult?.affectedRows || 0);
    console.log(`[Checkout Attempt Cleanup] Expired unpaid attempts (>30 min): ${expiredCount}`);

    // 2. Purge expired attempts older than 30 days post-expiry retention
    const [purgeResult] = await connection.query(
      `DELETE FROM checkout_attempts
       WHERE status IN ('expired', 'failed')
         AND retention_until < NOW()`
    );
    const purgedCount = Number(purgeResult?.affectedRows || 0);
    console.log(`[Checkout Attempt Cleanup] Purged attempts past 30-day retention: ${purgedCount}`);

    console.log("[Checkout Attempt Cleanup] ✓ Completed successfully.");
    return { expiredCount, purgedCount };
  } finally {
    await connection.end();
  }
}

// Auto-run if executed directly as entrypoint
if (import.meta.url === `file://${process.argv[1]}` || (process.argv[1] && process.argv[1].endsWith("cleanup-checkout-attempts.mjs"))) {
  runCleanup().catch((err) => {
    console.error("[Checkout Attempt Cleanup Error]:", err.message);
    process.exit(1);
  });
}
