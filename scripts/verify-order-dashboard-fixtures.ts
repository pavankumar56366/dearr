import fs from "fs";
import path from "path";
import assert from "assert";
import mysql from "mysql2/promise";
import Module from "module";

// Mock 'server-only' so we can import application server modules directly
const originalRequire = Module.prototype.require;
Module.prototype.require = function (id: string) {
  if (id === "server-only") return {};
  return originalRequire.apply(this, arguments as any);
};

function loadEnv() {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, "utf-8").split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const idx = trimmed.indexOf("=");
      if (idx !== -1) {
        const k = trimmed.slice(0, idx).trim();
        const v = trimmed.slice(idx + 1).trim();
        if (!process.env[k]) {
          process.env[k] = v;
        }
      }
    }
  }
}

loadEnv();

let passedCount = 0;
let totalCount = 0;

function runTest(name: string, fn: () => void | Promise<void>) {
  totalCount++;
  try {
    const res = fn();
    if (res instanceof Promise) {
      return res
        .then(() => {
          passedCount++;
          console.log(`  [PASS] ${name}`);
        })
        .catch((err) => {
          console.error(`  [FAIL] ${name}:`, err.message);
          throw err;
        });
    } else {
      passedCount++;
      console.log(`  [PASS] ${name}`);
    }
  } catch (err: any) {
    console.error(`  [FAIL] ${name}:`, err.message);
    throw err;
  }
}

async function verifyAll() {
  console.log("================================================================================");
  console.log("DEARR ORDER DASHBOARD FIXTURE VERIFICATION SUITE");
  console.log("================================================================================\n");

  const host = process.env.DB_HOST || "127.0.0.1";
  const database = process.env.DB_NAME || "dearr_test";
  const port = parseInt(process.env.DB_PORT || "3306", 10);
  const user = process.env.DB_USER || "dearr_local_user";
  const password = process.env.DB_PASSWORD || "";

  // 1. Strict Fail-Closed Verification
  const ALLOWED_HOSTS = ["127.0.0.1", "localhost", "::1"];
  const ALLOWED_DBS = ["dearr_test"];

  if (!ALLOWED_HOSTS.includes(host.toLowerCase())) {
    console.error(`[SAFETY REFUSAL] Target host "${host}" is not local loopback!`);
    process.exit(1);
  }

  if (!ALLOWED_DBS.includes(database.toLowerCase())) {
    console.error(`[SAFETY REFUSAL] Target database "${database}" is NOT the approved test database 'dearr_test'!`);
    process.exit(1);
  }

  console.log(`Configuration:`);
  console.log(`  Target Database : ${database}`);
  console.log(`  Target Host     : ${host}:${port}`);
  console.log(`  Target User     : ${user}\n`);

  // Import application server helpers
  const {
    resolveReportingPeriod,
    getOrderSummaryMetrics,
    PLACED_ORDER_SQL_PREDICATE,
    REVENUE_ELIGIBLE_SQL_PREDICATE,
  } = await import("../src/lib/server/order-analytics");

  const { listAllOrders } = await import("../src/lib/server/order");
  const { generateSummaryCsv, streamOrdersListCsv, resolveOrderExportAmounts } = await import("../src/lib/server/order-export");

  // Raw database connection for aggregate query cross-check
  const rawConn = await mysql.createConnection({
    host,
    port,
    user,
    password,
    database,
  });

  try {
    console.log("--- PART 1: REPORTING PERIOD AGGREGATIONS ---");

    // Helper to calculate baseline non-fixture metrics as specified in Section 5
    async function getBaselineMetrics(r: any) {
      const isAllTime = r.period === "all";
      const dateCondition = isAllTime ? "1 = 1" : "(o.created_at >= ? AND o.created_at < ?)";
      const params = isAllTime ? [] : [r.startSql, r.endSql];
      const sql = `
        SELECT
          COUNT(*) AS total_orders,
          COALESCE(SUM(CASE WHEN o.status != 'cancelled' AND o.status IN ('pending', 'confirmed', 'processing') THEN 1 ELSE 0 END), 0) AS pending_dispatch,
          COALESCE(SUM(CASE WHEN o.status != 'cancelled' AND o.status IN ('shipped', 'dispatched') THEN 1 ELSE 0 END), 0) AS dispatched,
          COALESCE(SUM(CASE WHEN o.status != 'cancelled' AND o.status = 'delivered' THEN 1 ELSE 0 END), 0) AS delivered,
          COALESCE(SUM(CASE WHEN o.status = 'cancelled' THEN 1 ELSE 0 END), 0) AS cancelled,
          COALESCE(SUM(CASE WHEN ${REVENUE_ELIGIBLE_SQL_PREDICATE} THEN o.total_amount ELSE 0 END), 0) AS revenue
        FROM orders o
        WHERE ${PLACED_ORDER_SQL_PREDICATE}
          AND o.order_number NOT LIKE 'QA-DASH-%'
          AND ${dateCondition}
      `;
      const [rows]: any = await rawConn.query(sql, params);
      const row = rows[0] || {};
      return {
        totalOrders: Number(row.total_orders || 0),
        pendingDispatch: Number(row.pending_dispatch || 0),
        dispatched: Number(row.dispatched || 0),
        delivered: Number(row.delivered || 0),
        cancelled: Number(row.cancelled || 0),
        revenue: Math.round(Number(row.revenue || 0) * 100) / 100,
      };
    }

    async function getFixtureMetrics(r: any) {
      const overall = await getOrderSummaryMetrics(r);
      const baseline = await getBaselineMetrics(r);
      return {
        totalOrders: overall.totalOrders - baseline.totalOrders,
        pendingDispatch: overall.pendingDispatch - baseline.pendingDispatch,
        dispatched: overall.dispatched - baseline.dispatched,
        delivered: overall.delivered - baseline.delivered,
        cancelled: overall.cancelled - baseline.cancelled,
        revenue: Math.round((overall.revenue - baseline.revenue) * 100) / 100,
        overall,
        baseline,
      };
    }

    // Case A: Day — 13 October 2026
    await runTest("Case A (Day 13 Oct 2026): Exact metrics match specification", async () => {
      const range = resolveReportingPeriod({ period: "day", date: "2026-10-13" });
      const metrics = await getFixtureMetrics(range);

      assert.strictEqual(metrics.totalOrders, 10, "Total fixture orders must be 10");
      assert.strictEqual(metrics.pendingDispatch, 4, "Pending dispatch must be 4");
      assert.strictEqual(metrics.dispatched, 1, "Dispatched must be 1");
      assert.strictEqual(metrics.delivered, 3, "Delivered must be 3");
      assert.strictEqual(metrics.cancelled, 2, "Cancelled must be 2");
      assert.strictEqual(metrics.revenue, 5141.10, "Revenue must be 5141.10");

      assert.strictEqual(
        metrics.totalOrders,
        metrics.pendingDispatch + metrics.dispatched + metrics.delivered + metrics.cancelled,
        "Invariant: Total = Pending + Dispatched + Delivered + Cancelled"
      );
    });

    // Case B: Last Week — 5 to 11 October 2026
    await runTest("Case B (Last Week 5-11 Oct 2026): Exact metrics match specification", async () => {
      const range = resolveReportingPeriod({ period: "week" });
      const metrics = await getFixtureMetrics(range);

      assert.strictEqual(metrics.totalOrders, 5, "Total fixture orders must be 5");
      assert.strictEqual(metrics.pendingDispatch, 2, "Pending dispatch must be 2");
      assert.strictEqual(metrics.dispatched, 1, "Dispatched must be 1");
      assert.strictEqual(metrics.delivered, 1, "Delivered must be 1");
      assert.strictEqual(metrics.cancelled, 1, "Cancelled must be 1");
      assert.strictEqual(metrics.revenue, 3624.00, "Revenue must be 3624.00");

      assert.strictEqual(
        metrics.totalOrders,
        metrics.pendingDispatch + metrics.dispatched + metrics.delivered + metrics.cancelled,
        "Invariant holds for Last Week"
      );
    });

    // Case C: Month — October 2026
    await runTest("Case C (Month Oct 2026): Exact metrics match specification", async () => {
      const range = resolveReportingPeriod({ period: "month", month: "2026-10" });
      const metrics = await getFixtureMetrics(range);

      assert.strictEqual(metrics.totalOrders, 18, "Total fixture orders must be 18");
      assert.strictEqual(metrics.pendingDispatch, 8, "Pending dispatch must be 8");
      assert.strictEqual(metrics.dispatched, 2, "Dispatched must be 2");
      assert.strictEqual(metrics.delivered, 5, "Delivered must be 5");
      assert.strictEqual(metrics.cancelled, 3, "Cancelled must be 3");
      assert.strictEqual(metrics.revenue, 11014.10, "Revenue must be 11014.10");

      assert.strictEqual(
        metrics.totalOrders,
        metrics.pendingDispatch + metrics.dispatched + metrics.delivered + metrics.cancelled,
        "Invariant holds for Month"
      );
    });

    // Case D: Year — 2026
    await runTest("Case D (Year 2026): Exact metrics match specification", async () => {
      const range = resolveReportingPeriod({ period: "year", year: "2026" });
      const metrics = await getFixtureMetrics(range);

      assert.strictEqual(metrics.totalOrders, 20, "Total fixture orders must be 20");
      assert.strictEqual(metrics.pendingDispatch, 8, "Pending dispatch must be 8");
      assert.strictEqual(metrics.dispatched, 3, "Dispatched must be 3");
      assert.strictEqual(metrics.delivered, 6, "Delivered must be 6");
      assert.strictEqual(metrics.cancelled, 3, "Cancelled must be 3");
      assert.strictEqual(metrics.revenue, 13212.10, "Revenue must be 13212.10");

      assert.strictEqual(
        metrics.totalOrders,
        metrics.pendingDispatch + metrics.dispatched + metrics.delivered + metrics.cancelled,
        "Invariant holds for Year 2026"
      );
    });

    // Case E: Year — 2025
    await runTest("Case E (Year 2025): Exact metrics match specification", async () => {
      const range = resolveReportingPeriod({ period: "year", year: "2025" });
      const metrics = await getFixtureMetrics(range);

      assert.strictEqual(metrics.totalOrders, 1, "Total fixture orders must be 1");
      assert.strictEqual(metrics.pendingDispatch, 1, "Pending dispatch must be 1");
      assert.strictEqual(metrics.dispatched, 0, "Dispatched must be 0");
      assert.strictEqual(metrics.delivered, 0, "Delivered must be 0");
      assert.strictEqual(metrics.cancelled, 0, "Cancelled must be 0");
      assert.strictEqual(metrics.revenue, 1499.00, "Revenue must be 1499.00");

      assert.strictEqual(
        metrics.totalOrders,
        metrics.pendingDispatch + metrics.dispatched + metrics.delivered + metrics.cancelled,
        "Invariant holds for Year 2025"
      );
    });

    // Case F: Overall — All Time
    await runTest("Case F (Overall): Exact metrics match specification", async () => {
      const range = resolveReportingPeriod({ period: "all" });
      const metrics = await getFixtureMetrics(range);

      assert.strictEqual(metrics.totalOrders, 21, "Total fixture orders must be 21");
      assert.strictEqual(metrics.pendingDispatch, 9, "Pending dispatch must be 9");
      assert.strictEqual(metrics.dispatched, 3, "Dispatched must be 3");
      assert.strictEqual(metrics.delivered, 6, "Delivered must be 6");
      assert.strictEqual(metrics.cancelled, 3, "Cancelled must be 3");
      assert.strictEqual(metrics.revenue, 14711.10, "Revenue must be 14711.10");

      assert.strictEqual(
        metrics.totalOrders,
        metrics.pendingDispatch + metrics.dispatched + metrics.delivered + metrics.cancelled,
        "Invariant holds for Overall"
      );
    });

    console.log("\n--- PART 2: TIMEZONE & BOUNDARY CONDITIONS ---");

    await runTest("Boundary 23:50 IST order QA-DASH-010 belongs strictly to 13 October", async () => {
      const range13 = resolveReportingPeriod({ period: "day", date: "2026-10-13" });
      const [rows13]: any = await rawConn.query(
        `SELECT order_number FROM orders o WHERE ${PLACED_ORDER_SQL_PREDICATE} AND created_at >= ? AND created_at < ? AND order_number = 'QA-DASH-010'`,
        [range13.startSql, range13.endSql]
      );
      assert.strictEqual(rows13.length, 1, "QA-DASH-010 must be found on 13 October");

      const range14 = resolveReportingPeriod({ period: "day", date: "2026-10-14" });
      const [rows14]: any = await rawConn.query(
        `SELECT order_number FROM orders o WHERE ${PLACED_ORDER_SQL_PREDICATE} AND created_at >= ? AND created_at < ? AND order_number = 'QA-DASH-010'`,
        [range14.startSql, range14.endSql]
      );
      assert.strictEqual(rows14.length, 0, "QA-DASH-010 must NOT appear on 14 October");
    });

    await runTest("Boundary 00:00 IST order QA-DASH-018 belongs strictly to 14 October", async () => {
      const range13 = resolveReportingPeriod({ period: "day", date: "2026-10-13" });
      const [rows13]: any = await rawConn.query(
        `SELECT order_number FROM orders o WHERE ${PLACED_ORDER_SQL_PREDICATE} AND created_at >= ? AND created_at < ? AND order_number = 'QA-DASH-018'`,
        [range13.startSql, range13.endSql]
      );
      assert.strictEqual(rows13.length, 0, "QA-DASH-018 must NOT appear on 13 October");

      const range14 = resolveReportingPeriod({ period: "day", date: "2026-10-14" });
      const [rows14]: any = await rawConn.query(
        `SELECT order_number FROM orders o WHERE ${PLACED_ORDER_SQL_PREDICATE} AND created_at >= ? AND created_at < ? AND order_number = 'QA-DASH-018'`,
        [range14.startSql, range14.endSql]
      );
      assert.strictEqual(rows14.length, 1, "QA-DASH-018 must appear on 14 October");
    });

    await runTest("Boundary 23:50 IST order QA-DASH-020 belongs strictly to Year 2025", async () => {
      const range2025 = resolveReportingPeriod({ period: "year", year: "2025" });
      const [rows2025]: any = await rawConn.query(
        `SELECT order_number FROM orders o WHERE ${PLACED_ORDER_SQL_PREDICATE} AND created_at >= ? AND created_at < ? AND order_number = 'QA-DASH-020'`,
        [range2025.startSql, range2025.endSql]
      );
      assert.strictEqual(rows2025.length, 1, "QA-DASH-020 must appear in Year 2025");

      const range2026 = resolveReportingPeriod({ period: "year", year: "2026" });
      const [rows2026]: any = await rawConn.query(
        `SELECT order_number FROM orders o WHERE ${PLACED_ORDER_SQL_PREDICATE} AND created_at >= ? AND created_at < ? AND order_number = 'QA-DASH-020'`,
        [range2026.startSql, range2026.endSql]
      );
      assert.strictEqual(rows2026.length, 0, "QA-DASH-020 must NOT appear in Year 2026");
    });

    console.log("\n--- PART 3: CANCELLATIONS, REFUNDS & REVENUE RULES ---");

    await runTest("Order cancelled AFTER dispatch (QA-DASH-014) counts ONLY in Cancelled bucket", async () => {
      const [rows]: any = await rawConn.query(
        `SELECT status, dispatched_at, cancelled_at FROM orders WHERE order_number = 'QA-DASH-014'`
      );
      assert.strictEqual(rows.length, 1);
      assert.strictEqual(rows[0].status, "cancelled");
      assert.ok(rows[0].dispatched_at !== null, "dispatched_at must be preserved");
      assert.ok(rows[0].cancelled_at !== null, "cancelled_at must be recorded");

      const rangeWeek = resolveReportingPeriod({ period: "week" });
      const metrics = await getOrderSummaryMetrics(rangeWeek);
      // In Last Week, there are 5 orders: 2 pending, 1 dispatched (012), 1 delivered (013), 1 cancelled (014)
      assert.strictEqual(metrics.dispatched, 1, "Dispatched must not include 014");
      assert.strictEqual(metrics.cancelled, 1, "Cancelled must include 014");
    });

    await runTest("Cancelled & refunded orders contribute strictly zero revenue", async () => {
      const rangeDay = resolveReportingPeriod({ period: "day", date: "2026-10-13" });
      const [revRows]: any = await rawConn.query(
        `SELECT order_number, total_amount, ${REVENUE_ELIGIBLE_SQL_PREDICATE} AS is_rev
         FROM orders o
         WHERE o.order_number IN ('QA-DASH-007', 'QA-DASH-008', 'QA-DASH-009')`
      );

      for (const r of revRows) {
        assert.strictEqual(Number(r.is_rev), 0, `${r.order_number} must be excluded from revenue (is_rev=0)`);
      }
    });

    await runTest("Specific snapshot QA-DASH-003: 549 subtotal - 54.90 discount + 50 shipping = 544.10", async () => {
      const [rows]: any = await rawConn.query(
        `SELECT subtotal, discount_amount, shipping_amount, total_amount FROM orders WHERE order_number = 'QA-DASH-003'`
      );
      assert.strictEqual(rows.length, 1);
      assert.strictEqual(Number(rows[0].subtotal), 549.00);
      assert.strictEqual(Number(rows[0].discount_amount), 54.90);
      assert.strictEqual(Number(rows[0].shipping_amount), 50.00);
      assert.strictEqual(Number(rows[0].total_amount), 544.10);
    });

    await runTest("Specific snapshot QA-DASH-016: multiple item lines sum cleanly to 1050.00", async () => {
      const [orderRows]: any = await rawConn.query(
        `SELECT total_amount FROM orders WHERE order_number = 'QA-DASH-016'`
      );
      assert.strictEqual(Number(orderRows[0].total_amount), 1050.00);

      const [itemRows]: any = await rawConn.query(
        `SELECT SUM(line_total) AS items_sum, COUNT(*) AS items_count
         FROM order_items oi
         JOIN orders o ON oi.order_id = o.id
         WHERE o.order_number = 'QA-DASH-016'`
      );
      assert.strictEqual(Number(itemRows[0].items_count), 2, "QA-DASH-016 must have 2 item lines");
      assert.strictEqual(Number(itemRows[0].items_sum), 1050.00, "Item lines sum must equal 1050.00");
    });

    console.log("\n--- PART 4: ABANDONED ATTEMPTS & EXCLUSION ---");

    await runTest("Abandoned attempts never appear in placed orders list or revenue", async () => {
      const listRes = await listAllOrders({ period: "all", placedOnly: true, limit: 100 });
      const orderNumbers = listRes.orders.map((o) => o.orderNumber);

      for (const num of orderNumbers) {
        assert.ok(!num.startsWith("QA-ATT-"), `Placed orders must not include attempt ${num}`);
      }

      // Check count in orders table
      const [attemptInOrders]: any = await rawConn.query(
        "SELECT COUNT(*) AS cnt FROM orders WHERE order_number LIKE 'QA-ATT-%'"
      );
      assert.strictEqual(attemptInOrders[0].cnt, 0, "Zero QA-ATT- rows in orders table");
    });

    await runTest("Converted attempt QA-ATT-004 is properly linked to QA-DASH-001", async () => {
      const [rows]: any = await rawConn.query(
        `SELECT ca.id, ca.status, ca.order_id, o.order_number
         FROM checkout_attempts ca
         JOIN orders o ON ca.order_id = o.id
         WHERE ca.id = 'QA-ATT-004'`
      );
      assert.strictEqual(rows.length, 1);
      assert.strictEqual(rows[0].status, "converted");
      assert.strictEqual(rows[0].order_number, "QA-DASH-001");
    });

    console.log("\n--- PART 5: ORDER LIST API & CSV EXPORTS ---");

    await runTest("Order list API returns itemCount and product items array populated", async () => {
      const listRes = await listAllOrders({ period: "day", date: "2026-10-13", limit: 20 });
      const qaOrders = listRes.orders.filter((o) => o.orderNumber.startsWith("QA-DASH-"));
      assert.strictEqual(qaOrders.length, 10, "10 QA-DASH orders on 13 Oct 2026");

      for (const o of qaOrders) {
        assert.ok(typeof o.itemCount === "number" && o.itemCount > 0, `Order ${o.orderNumber} must have itemCount > 0`);
        assert.ok(Array.isArray(o.items) && o.items.length > 0, `Order ${o.orderNumber} must have items array populated`);
        assert.ok(o.items[0].productName, `Order ${o.orderNumber} item must have productName`);
      }
    });

    await runTest("Summary CSV matches dashboard metrics exactly", async () => {
      const range = resolveReportingPeriod({ period: "day", date: "2026-10-13" });
      const fixtureMetrics = await getFixtureMetrics(range);
      const { csvContent } = await generateSummaryCsv(fixtureMetrics);

      assert.ok(csvContent.includes("\uFEFF"), "CSV must include UTF-8 BOM");
      assert.ok(csvContent.includes("Metric,Value"), "CSV must have header");
      assert.ok(csvContent.includes("Total Orders,10"), "Summary CSV must have Total Orders 10");
      assert.ok(csvContent.includes("Pending Dispatch,4"), "Summary CSV must have Pending Dispatch 4");
      assert.ok(csvContent.includes("Dispatched,1"), "Summary CSV must have Dispatched 1");
      assert.ok(csvContent.includes("Delivered,3"), "Summary CSV must have Delivered 3");
      assert.ok(csvContent.includes("Cancelled,2"), "Summary CSV must have Cancelled 2");
      assert.ok(csvContent.includes("5141.10"), "Summary CSV must have Revenue 5141.10");
    });

    await runTest("Orders CSV export streams correctly and contains all date-filtered records", async () => {
      const range = resolveReportingPeriod({ period: "day", date: "2026-10-13" });
      const chunks: string[] = [];
      for await (const chunk of streamOrdersListCsv(range)) {
        chunks.push(chunk);
      }
      const fullCsv = chunks.join("");
      assert.ok(fullCsv.includes("\uFEFF"), "CSV must include UTF-8 BOM");
      assert.ok(fullCsv.includes("order_id,created_at,customer_name"), "CSV must include headers");

      // Verify all 10 day orders QA-DASH-001 through QA-DASH-010 are in the CSV
      for (let i = 1; i <= 10; i++) {
        const orderNum = `QA-DASH-${String(i).padStart(3, "0")}`;
        assert.ok(fullCsv.includes(orderNum), `CSV must contain ${orderNum}`);
      }

      // Verify orders from other dates are NOT in this day's CSV
      for (let i = 11; i <= 21; i++) {
        const orderNum = `QA-DASH-${String(i).padStart(3, "0")}`;
        assert.ok(!fullCsv.includes(orderNum), `Day CSV must not contain ${orderNum}`);
      }

      // Verify abandoned attempts are NOT present in CSV
      assert.ok(!fullCsv.includes("QA-ATT-"), "CSV must not include abandoned checkout attempts");
    });

    console.log("\n--- PART 6: CHECKOUT ATTEMPTS CLEANUP WORKER ---");

    const { cleanupCheckoutAttempts } = await import("../src/lib/server/checkout-attempt");

    await runTest("Cleanup worker purges QA-ATT-003 (past retention) while strictly preserving active, in-retention, and converted attempts", async () => {
      // Check before state
      const [beforeRows]: any = await rawConn.query(
        "SELECT id, status FROM checkout_attempts WHERE id LIKE 'QA-ATT-%'"
      );
      assert.strictEqual(beforeRows.length, 4, "Before cleanup: 4 attempts present");

      // Run cleanup
      const { expiredCount, purgedCount } = await cleanupCheckoutAttempts();
      assert.ok(purgedCount >= 1, "At least 1 attempt past retention was purged");

      // Check after state
      const [afterRows]: any = await rawConn.query(
        "SELECT id, status FROM checkout_attempts WHERE id LIKE 'QA-ATT-%'"
      );
      const afterIds = afterRows.map((r: any) => r.id);

      assert.ok(!afterIds.includes("QA-ATT-003"), "QA-ATT-003 past retention was safely purged");
      assert.ok(afterIds.includes("QA-ATT-001"), "Active pending QA-ATT-001 was safely preserved");
      assert.ok(afterIds.includes("QA-ATT-002"), "Expired within retention QA-ATT-002 was safely preserved");
      assert.ok(afterIds.includes("QA-ATT-004"), "Converted QA-ATT-004 was strictly preserved");

      // Verify all placed orders and items preserved
      const [orderCount]: any = await rawConn.query("SELECT COUNT(*) AS cnt FROM orders WHERE order_number LIKE 'QA-DASH-%'");
      assert.strictEqual(orderCount[0].cnt, 21, "All 21 placed orders preserved");

      // Re-seed QA-ATT-003 so full test fixtures remain intact in dearr_test for user inspection
      const sampleAddress = JSON.stringify({ fullName: "QA Customer", city: "Bengaluru", country: "India" });
      const sampleCart = JSON.stringify([]);
      await rawConn.query(
        `INSERT INTO checkout_attempts (
           id, user_id, email, shipping_address, cart_snapshot, amount, currency, provider,
           provider_order_id, status, order_id, expires_at, retention_until, created_at, updated_at
         )
         VALUES (
           'QA-ATT-003', 'qa-cust-03', 'qa-orders-003@example.test', ?, ?, 799.00, 'INR', 'razorpay',
           'order_qa_att_003', 'expired', NULL,
           DATE_SUB(NOW(), INTERVAL 31 DAY), DATE_SUB(NOW(), INTERVAL 1 HOUR),
           DATE_SUB(DATE_SUB(NOW(), INTERVAL 31 DAY), INTERVAL 30 MINUTE), DATE_SUB(NOW(), INTERVAL 31 DAY)
         )
         ON DUPLICATE KEY UPDATE status=VALUES(status)`,
        [sampleAddress, sampleCart]
      );
    });

    console.log("\n================================================================================");
    console.log(`TEST SUMMARY: ${passedCount}/${totalCount} tests passed (100%)`);
    console.log("================================================================================\n");

  } finally {
    await rawConn.end();
  }
}

verifyAll()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error("Verification suite failed:", err);
    process.exit(1);
  });
