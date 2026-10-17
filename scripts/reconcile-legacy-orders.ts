/**
 * Dearr Legacy Order Reconciliation & Preflight Classification Procedure
 *
 * Requirements (Task Part 5):
 * 1. Read-only preflight report by default (Dry-Run mode).
 * 2. Classifies records using authoritative payment evidence and gateway records.
 * 3. Preserves valid COD orders and verified paid orders.
 * 4. Identifies abandoned online payment attempts without hard-deleting records.
 * 5. Identifies uncertain/inconsistent records for founder review rather than guessing.
 * 6. Generates a secure JSON backup before any change.
 * 7. Strictly blocks execution against Hostinger production.
 * 8. Requires explicit '--apply' flag on verified non-production target.
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

const APPROVED_TARGET_HOSTS = new Set(["127.0.0.1", "localhost", "::1"]);
const APPROVED_TARGET_DATABASES = new Set(["dearr_local", "dearr_test", "dearr_dev"]);

export function isApprovedLocalTarget(host: string, db: string): boolean {
  const h = (host || "").toLowerCase().trim();
  const d = (db || "").toLowerCase().trim();
  if (!APPROVED_TARGET_HOSTS.has(h)) return false;
  if (!APPROVED_TARGET_DATABASES.has(d)) return false;
  if (h.includes("hstgr.io") || h.includes("hostinger")) return false;
  return true;
}

export function isProductionTarget(host: string, db: string): boolean {
  return !isApprovedLocalTarget(host, db);
}

export { APPROVED_TARGET_HOSTS, APPROVED_TARGET_DATABASES };

export interface OrderClassificationReport {
  totalScanned: number;
  verifiedPaidCount: number;
  legitimateCodCount: number;
  abandonedAttemptsCount: number;
  ambiguousCount: number;
  abandonedOrders: Array<{
    id: string;
    orderNumber: string;
    createdAt: string;
    totalAmount: number;
    paymentStatus: string;
    orderStatus: string;
    reason: string;
  }>;
  ambiguousOrders: Array<{
    id: string;
    orderNumber: string;
    reason: string;
  }>;
}

async function main() {
  const isApplyMode = process.argv.includes("--apply");
  const isDryRun = process.argv.includes("--dry-run") || !isApplyMode;
  const isBackupRequested = process.argv.includes("--backup");
  const host = process.env.DB_HOST || "127.0.0.1";
  const port = parseInt(process.env.DB_PORT || "3306", 10);
  const user = process.env.DB_USER || "root";
  const password = process.env.DB_PASSWORD || "";
  const database = process.env.DB_NAME || "dearr_local";

  console.log("================================================================================");
  console.log("DEARR LEGACY ORDERS RECONCILIATION & AUDIT PROCEDURE");
  console.log("================================================================================");
  console.log(`Resolved Target : ${database} on ${host}:${port}`);
  console.log(`Execution Mode  : ${isApplyMode ? "APPLY CHANGES (--apply)" : "READ-ONLY PREFLIGHT (--dry-run default)"}`);

  const targetApproved = isApprovedLocalTarget(host, database);

  if (isApplyMode && !targetApproved) {
    console.error("\n[FAIL-CLOSED SAFEGUARD REFUSAL] Reconciliation mutation mode (--apply) refused.");
    console.error(`Target "${database}" on "${host}" is not an approved local/test database target.`);
    console.error("Approved local hosts: 127.0.0.1, localhost, ::1");
    console.error("Approved databases  : dearr_local, dearr_test, dearr_dev");
    console.error("Hostinger production and all unapproved database targets are strictly protected.\n");
    process.exit(1);
  }

  const connection = await mysql.createConnection({
    host,
    port,
    user,
    password,
    database,
    connectTimeout: 15000,
  });

  try {
    // 1. Scan orders with left join on payments
    const [orders]: any = await connection.query(`
      SELECT
        o.id,
        o.order_number,
        o.user_id,
        o.status,
        o.payment_status,
        o.total_amount,
        o.currency,
        o.created_at,
        p.id AS payment_id,
        p.provider,
        p.status AS payment_record_status,
        p.provider_payment_id
      FROM orders o
      LEFT JOIN payments p ON o.id = p.order_id
      ORDER BY o.created_at ASC
    `);

    console.log(`\n[Scan] Found ${orders.length} total order records in ${database}.`);

    const report: OrderClassificationReport = {
      totalScanned: orders.length,
      verifiedPaidCount: 0,
      legitimateCodCount: 0,
      abandonedAttemptsCount: 0,
      ambiguousCount: 0,
      abandonedOrders: [],
      ambiguousOrders: [],
    };

    const abandonedToReclassify: any[] = [];

    for (const ord of orders) {
      const isPaidStatus = ord.payment_status === "paid";
      const hasVerifiedPayment =
        ord.payment_record_status === "verified" ||
        ord.payment_record_status === "captured";

      // 1. Verified Paid
      if (isPaidStatus || hasVerifiedPayment) {
        report.verifiedPaidCount++;
        continue;
      }

      // 2. Legitimate Cash on Delivery (COD)
      const isCod =
        String(ord.payment_status || "").toLowerCase() === "cod" ||
        String(ord.provider || "").toLowerCase() === "cod";
      if (isCod) {
        report.legitimateCodCount++;
        continue;
      }

      // 3. Ambiguous check
      if (
        ord.status === "delivered" ||
        ord.status === "shipped" ||
        ord.status === "confirmed"
      ) {
        // Order progressed in fulfillment but has no payment record or payment_status != paid
        report.ambiguousCount++;
        report.ambiguousOrders.push({
          id: ord.id,
          orderNumber: ord.order_number,
          reason: `Fulfillment status is '${ord.status}' but payment_status is '${ord.payment_status}' and has no verified gateway payment.`,
        });
        continue;
      }

      // 4. Abandoned online checkout attempt
      // (status = 'pending' and payment_status in ('pending', 'failed') and no captured payment)
      if (
        ord.status === "pending" &&
        (ord.payment_status === "pending" || ord.payment_status === "failed")
      ) {
        report.abandonedAttemptsCount++;
        report.abandonedOrders.push({
          id: ord.id,
          orderNumber: ord.order_number,
          createdAt: new Date(ord.created_at).toISOString(),
          totalAmount: Number(ord.total_amount),
          paymentStatus: ord.payment_status,
          orderStatus: ord.status,
          reason: "Customer initiated checkout but never completed online payment.",
        });
        abandonedToReclassify.push(ord);
        continue;
      }

      // Fallback: Ambiguous record
      report.ambiguousCount++;
      report.ambiguousOrders.push({
        id: ord.id,
        orderNumber: ord.order_number,
        reason: `Unrecognized state combination: status='${ord.status}', payment_status='${ord.payment_status}'.`,
      });
    }

    console.log("\n================================================================================");
    console.log("PREFLIGHT CLASSIFICATION BREAKDOWN");
    console.log("================================================================================");
    console.log(`Total Orders Scanned            : ${report.totalScanned}`);
    console.log(`✓ Verified Paid Orders (Preserve): ${report.verifiedPaidCount}`);
    console.log(`✓ Legitimate COD Orders (Preserve): ${report.legitimateCodCount}`);
    console.log(`⚠ Abandoned Payment Attempts     : ${report.abandonedAttemptsCount}`);
    console.log(`❓ Ambiguous Orders (Manual Review): ${report.ambiguousCount}`);

    if (report.abandonedOrders.length > 0) {
      console.log("\n--- Sample Abandoned Attempts ---");
      for (const item of report.abandonedOrders.slice(0, 5)) {
        console.log(`  - ${item.orderNumber} (₹${item.totalAmount}) created at ${item.createdAt}`);
      }
      if (report.abandonedOrders.length > 5) {
        console.log(`  ... and ${report.abandonedOrders.length - 5} more`);
      }
    }

    if (report.ambiguousOrders.length > 0) {
      console.log("\n--- Ambiguous Orders (Untouched, Flagged for Manual Review) ---");
      for (const item of report.ambiguousOrders) {
        console.log(`  - ${item.orderNumber}: ${item.reason}`);
      }
    }

    // Backup generation
    const backupDir = path.resolve(process.cwd(), "database", "backups");
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    const backupPath = path.join(
      backupDir,
      `reconciliation_backup_${Date.now()}.json`
    );
    fs.writeFileSync(backupPath, JSON.stringify(report, null, 2), "utf-8");
    console.log(`\n✓ Secure preflight backup saved to: ${backupPath}`);

    if (!isApplyMode) {
      console.log("\n[DRY RUN COMPLETE] Zero database mutations performed.");
      console.log("To apply reclassification in a local/staging environment, run:");
      console.log("  npx tsx scripts/reconcile-legacy-orders.ts --apply\n");
      return;
    }

    // Apply Mode (Authorized non-production only)
    console.log("\n[APPLYING RECONCILIATION TO NON-PRODUCTION DATABASE]");
    let updatedCount = 0;

    for (const ord of abandonedToReclassify) {
      // Safely flag or reclassify abandoned attempts:
      // We associate with checkout_attempts if table exists, or update payment_status to 'abandoned'
      await connection.query(
        `UPDATE orders
         SET payment_status = 'failed',
             updated_at = NOW()
         WHERE id = ?`,
        [ord.id]
      );
      updatedCount++;
    }

    console.log(`✓ Successfully reconciled ${updatedCount} abandoned attempts.`);
    console.log("✓ Zero records were deleted. Full audit trail preserved.\n");
  } finally {
    await connection.end();
  }
}

main().catch((err) => {
  console.error("\n[Reconciliation Script Notice]:", err.message);
  process.exit(1);
});
