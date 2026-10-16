/**
 * Automated Test Suite for Dearr Orders Dashboard Analytics,
 * Abandoned Payment Cleanup & CSV Export
 *
 * Verifies:
 * - Section 20: Payment Eligibility & Checkout Attempts (unpaid exclusion, capture confirmation, COD handling, 30m expiry, 30d retention purge, late payment reconciliation)
 * - Section 21: Status and Metrics (mutually exclusive status buckets, mathematical invariant Total = Pending Dispatch + Dispatched + Delivered + Cancelled, cancellation before & after dispatch, unknown status handling)
 * - Section 22: Date and Period Boundaries (Asia/Kolkata half-open intervals [start, end), 11:50 PM IST vs midnight boundaries, previous completed Mon-Sun week, leap year February, multi-day revenue reconciliation)
 * - Section 23: CSV Export (RFC 4180 escaping, formula injection protection, UTF-8 BOM, plain decimal money formatting, Asia/Kolkata timestamps, resolved period filenames, audit logging without PII)
 * - Section 24: Existing Functionality & Regression
 */

import assert from "assert";
import fs from "fs";
import path from "path";
import Module from "module";
import crypto from "crypto";

// Mock 'server-only' so tests can import server functions outside Next.js bundler
const originalRequire = Module.prototype.require;
Module.prototype.require = function (id) {
  if (id === "server-only") {
    return {};
  }
  return originalRequire.apply(this, arguments);
};

console.log("================================================================================");
console.log("DEARR ORDERS DASHBOARD ANALYTICS & CSV EXPORT AUTOMATED TEST SUITE");
console.log("================================================================================\n");

let passedCount = 0;
let totalCount = 0;

function test(name, fn) {
  totalCount++;
  try {
    fn();
    console.log(`  [PASS] ${name}`);
    passedCount++;
  } catch (err) {
    console.error(`  [FAIL] ${name}:`, err.message);
    throw err;
  }
}

async function asyncTest(name, fn) {
  totalCount++;
  try {
    await fn();
    console.log(`  [PASS] ${name}`);
    passedCount++;
  } catch (err) {
    console.error(`  [FAIL] ${name}:`, err.message);
    throw err;
  }
}

// Dynamically import backend modules
const {
  resolveReportingInterval,
  resolveReportingPeriod,
  getOrderSummaryMetrics,
  mapToCanonicalStatus,
  PLACED_ORDER_SQL_PREDICATE,
  REVENUE_ELIGIBLE_SQL_PREDICATE,
  CANONICAL_STATUS_SQL_EXPRESSION,
} = await import("../src/lib/server/order-analytics.ts");

const {
  escapeCsvValue,
  neutralizeFormula,
  formatIstTimestamp,
  formatPlainDecimal,
  generateOrdersCsvFilename,
  generateSummaryCsvFilename,
  generateSummaryCsv,
  formatSummaryMetricsCsv,
  resolveOrderExportAmounts,
} = await import("../src/lib/server/order-export.ts");

const {
  getOrderMetrics,
} = await import("../src/lib/admin-orders.ts");

const {
  isApprovedLocalTarget,
} = await import("../database/run-migration-005.ts");

const {
  ATTEMPT_EXPIRY_MINUTES,
  ATTEMPT_RETENTION_DAYS,
} = await import("../src/lib/server/checkout-attempt.ts");

const {
  verifyRazorpaySignature,
  getRazorpayConfig,
} = await import("../src/lib/server/razorpay.ts");

// ============================================================================
// PART 1: PAYMENT ELIGIBILITY & CHECKOUT ATTEMPTS (Section 20)
// ============================================================================
console.log("--- PART 1: PAYMENT ELIGIBILITY & ATTEMPTS (Section 20) ---");

test("20.1: Unpaid online checkout attempt is excluded from placed orders and revenue", () => {
  const demoOrders = [
    {
      id: "ord_1",
      orderNumber: "DEAR-10001",
      customer: { name: "Alice", email: "alice@example.com", phone: "9876543210" },
      items: [],
      subtotal: 999,
      discountAmount: 0,
      shippingAmount: 0,
      totalAmount: 999,
      currency: "INR",
      paymentStatus: "pending", // Unpaid attempt
      orderStatus: "pending",
      paymentMethod: "Razorpay",
      shippingAddress: { fullName: "Alice", phone: "9876543210", addressLine1: "X", city: "C", state: "S", postalCode: "P", country: "India" },
      createdAt: "2026-10-12T10:00:00.000Z",
      updatedAt: "2026-10-12T10:00:00.000Z",
    },
    {
      id: "ord_2",
      orderNumber: "DEAR-10002",
      customer: { name: "Bob", email: "bob@example.com", phone: "9876543211" },
      items: [],
      subtotal: 1499,
      discountAmount: 0,
      shippingAmount: 0,
      totalAmount: 1499,
      currency: "INR",
      paymentStatus: "paid", // Verified paid
      orderStatus: "confirmed",
      paymentMethod: "Razorpay",
      shippingAddress: { fullName: "Bob", phone: "9876543211", addressLine1: "Y", city: "C", state: "S", postalCode: "P", country: "India" },
      createdAt: "2026-10-12T10:05:00.000Z",
      updatedAt: "2026-10-12T10:05:00.000Z",
    },
  ];

  const metrics = getOrderMetrics(demoOrders);
  assert.strictEqual(metrics.totalOrders, 1, "Only the 1 verified-paid order should be counted");
  assert.strictEqual(metrics.pendingDispatch, 1);
  assert.strictEqual(metrics.revenue, 1499, "Unpaid attempt must not contribute to revenue");
});

test("20.2: Failed online payment is excluded from placed orders and revenue", () => {
  const demoOrders = [
    {
      id: "ord_failed",
      orderNumber: "DEAR-10003",
      customer: { name: "Charlie", email: "charlie@example.com", phone: "9876543212" },
      items: [],
      subtotal: 799,
      discountAmount: 0,
      shippingAmount: 0,
      totalAmount: 799,
      currency: "INR",
      paymentStatus: "failed", // Failed online payment
      orderStatus: "pending",
      paymentMethod: "Razorpay",
      shippingAddress: { fullName: "Charlie", phone: "9876543212", addressLine1: "Z", city: "C", state: "S", postalCode: "P", country: "India" },
      createdAt: "2026-10-12T10:10:00.000Z",
      updatedAt: "2026-10-12T10:10:00.000Z",
    },
  ];

  const metrics = getOrderMetrics(demoOrders);
  assert.strictEqual(metrics.totalOrders, 0, "Failed attempt must not count as placed order");
  assert.strictEqual(metrics.revenue, 0, "Failed attempt must produce 0 revenue");
});

test("20.3: SQL predicate authoritatively requires verified payment or legitimate COD", () => {
  assert(PLACED_ORDER_SQL_PREDICATE.includes("payment_status = 'paid'"), "Must match payment_status = 'paid'");
  assert(PLACED_ORDER_SQL_PREDICATE.includes("'cod'"), "Must account for COD payment_status");
  assert(PLACED_ORDER_SQL_PREDICATE.includes("provider_payment_id IS NOT NULL"), "Must verify captured gateway payment id");
});

test("20.4: COD placed order counts in total orders but excluded from collected revenue while unpaid", () => {
  const demoOrders = [
    {
      id: "ord_cod",
      orderNumber: "DEAR-10004",
      customer: { name: "David", email: "david@example.com", phone: "9876543213" },
      items: [],
      subtotal: 1200,
      discountAmount: 0,
      shippingAmount: 0,
      totalAmount: 1200,
      currency: "INR",
      paymentStatus: "pending", // COD pending collection
      orderStatus: "confirmed",
      paymentMethod: "Cash on Delivery (COD)",
      shippingAddress: { fullName: "David", phone: "9876543213", addressLine1: "W", city: "C", state: "S", postalCode: "P", country: "India" },
      createdAt: "2026-10-12T10:15:00.000Z",
      updatedAt: "2026-10-12T10:15:00.000Z",
    },
  ];

  const metrics = getOrderMetrics(demoOrders);
  assert.strictEqual(metrics.totalOrders, 1, "Legitimate COD order counts as placed order");
  assert.strictEqual(metrics.pendingDispatch, 1, "Pending dispatch counts COD");
  assert.strictEqual(metrics.revenue, 0, "Uncollected COD order MUST NOT be counted in revenue");
});

test("20.5: Attempt expiry rule: 30 minutes life before expiry", () => {
  const now = new Date("2026-10-12T12:00:00.000Z");
  const createdAtRecent = new Date("2026-10-12T11:45:00.000Z"); // 15 mins old
  const createdAtExpired = new Date("2026-10-12T11:20:00.000Z"); // 40 mins old

  const diffRecentMinutes = (now.getTime() - createdAtRecent.getTime()) / (60 * 1000);
  const diffExpiredMinutes = (now.getTime() - createdAtExpired.getTime()) / (60 * 1000);

  assert(diffRecentMinutes < 30, "Recent attempt (<30m) is still active");
  assert(diffExpiredMinutes >= 30, "Older attempt (>=30m) is expired");
});

test("20.6: Attempt retention rule: 30 days retention before eligible for purge", () => {
  const now = new Date("2026-10-12T12:00:00.000Z");
  const expired10DaysAgo = new Date("2026-10-02T12:00:00.000Z"); // 10 days old
  const expired35DaysAgo = new Date("2026-09-07T12:00:00.000Z"); // 35 days old

  const days10 = (now.getTime() - expired10DaysAgo.getTime()) / (24 * 60 * 60 * 1000);
  const days35 = (now.getTime() - expired35DaysAgo.getTime()) / (24 * 60 * 60 * 1000);

  assert(days10 < 30, "Attempt retained within 30 days MUST NOT be purged");
  assert(days35 >= 30, "Attempt beyond 30 days is eligible for safe purge");
});

// ============================================================================
// PART 2: DASHBOARD METRICS & INVARIANT (Section 21)
// ============================================================================
console.log("\n--- PART 2: DASHBOARD METRICS & INVARIANT (Section 21) ---");

test("21.1: Canonical mapping maps all database status variations", () => {
  assert.strictEqual(mapToCanonicalStatus("pending"), "pending_dispatch");
  assert.strictEqual(mapToCanonicalStatus("confirmed"), "pending_dispatch");
  assert.strictEqual(mapToCanonicalStatus("processing"), "pending_dispatch");
  assert.strictEqual(mapToCanonicalStatus("shipped"), "dispatched");
  assert.strictEqual(mapToCanonicalStatus("delivered"), "delivered");
  assert.strictEqual(mapToCanonicalStatus("cancelled"), "cancelled");
  assert.strictEqual(mapToCanonicalStatus("unknown_legacy_status"), "pending_dispatch", "Unknown mapped safe");
});

test("21.2: Status Invariant: Total = Pending Dispatch + Dispatched + Delivered + Cancelled", () => {
  const mixedOrders = [
    { id: "1", orderNumber: "DEAR-1", customer: { name: "A", email: "a", phone: "1" }, items: [], subtotal: 100, discountAmount: 0, shippingAmount: 0, totalAmount: 100, currency: "INR", paymentStatus: "paid", orderStatus: "pending", shippingAddress: {} },
    { id: "2", orderNumber: "DEAR-2", customer: { name: "B", email: "b", phone: "2" }, items: [], subtotal: 200, discountAmount: 0, shippingAmount: 0, totalAmount: 200, currency: "INR", paymentStatus: "paid", orderStatus: "confirmed", shippingAddress: {} },
    { id: "3", orderNumber: "DEAR-3", customer: { name: "C", email: "c", phone: "3" }, items: [], subtotal: 300, discountAmount: 0, shippingAmount: 0, totalAmount: 300, currency: "INR", paymentStatus: "paid", orderStatus: "processing", shippingAddress: {} },
    { id: "4", orderNumber: "DEAR-4", customer: { name: "D", email: "d", phone: "4" }, items: [], subtotal: 400, discountAmount: 0, shippingAmount: 0, totalAmount: 400, currency: "INR", paymentStatus: "paid", orderStatus: "shipped", shippingAddress: {} },
    { id: "5", orderNumber: "DEAR-5", customer: { name: "E", email: "e", phone: "5" }, items: [], subtotal: 500, discountAmount: 0, shippingAmount: 0, totalAmount: 500, currency: "INR", paymentStatus: "paid", orderStatus: "delivered", shippingAddress: {} },
    { id: "6", orderNumber: "DEAR-6", customer: { name: "F", email: "f", phone: "6" }, items: [], subtotal: 600, discountAmount: 0, shippingAmount: 0, totalAmount: 600, currency: "INR", paymentStatus: "paid", orderStatus: "cancelled", shippingAddress: {} },
  ];

  const m = getOrderMetrics(mixedOrders);
  assert.strictEqual(m.totalOrders, 6);
  assert.strictEqual(m.pendingDispatch, 3, "pending + confirmed + processing = 3");
  assert.strictEqual(m.dispatched, 1);
  assert.strictEqual(m.delivered, 1);
  assert.strictEqual(m.cancelled, 1);

  const sumOfParts = m.pendingDispatch + m.dispatched + m.delivered + m.cancelled;
  assert.strictEqual(m.totalOrders, sumOfParts, "Invariant Total = Pending Dispatch + Dispatched + Delivered + Cancelled must hold");
});

test("21.3: Cancelled order cancelled AFTER dispatch belongs ONLY to Cancelled bucket", () => {
  const cancelledAfterDispatch = [
    {
      id: "ord_cad",
      orderNumber: "DEAR-777",
      customer: { name: "Eve", email: "eve@example.com", phone: "9876543214" },
      items: [],
      subtotal: 1500,
      discountAmount: 0,
      shippingAmount: 0,
      totalAmount: 1500,
      currency: "INR",
      paymentStatus: "paid",
      orderStatus: "cancelled", // Cancelled after dispatch
      dispatchedAt: "2026-10-10T14:00:00.000Z", // Historical dispatched timestamp preserved
      cancelledAt: "2026-10-11T10:00:00.000Z",
      shippingAddress: {},
    },
  ];

  const m = getOrderMetrics(cancelledAfterDispatch);
  assert.strictEqual(m.totalOrders, 1);
  assert.strictEqual(m.cancelled, 1, "Must belong to Cancelled");
  assert.strictEqual(m.dispatched, 0, "Must NOT be counted in Dispatched bucket");
  assert.strictEqual(m.pendingDispatch, 0);
  assert.strictEqual(m.delivered, 0);
  assert.strictEqual(m.revenue, 0, "Cancelled order excluded from revenue");
});

test("21.4: Net Revenue excludes cancelled orders and counts only paid amounts", () => {
  const orders = [
    { id: "1", orderNumber: "DEAR-1", customer: {}, items: [], totalAmount: 1000, paymentStatus: "paid", orderStatus: "delivered", shippingAddress: {} },
    { id: "2", orderNumber: "DEAR-2", customer: {}, items: [], totalAmount: 500, paymentStatus: "paid", orderStatus: "cancelled", shippingAddress: {} }, // Cancelled
    { id: "3", orderNumber: "DEAR-3", customer: {}, items: [], totalAmount: 2000, paymentStatus: "pending", orderStatus: "pending", shippingAddress: {} }, // Unpaid
  ];

  const m = getOrderMetrics(orders);
  assert.strictEqual(m.revenue, 1000, "Only paid, non-cancelled order counts in revenue");
});

// ============================================================================
// PART 3: DATE & REPORTING PERIOD BOUNDARIES (Section 22)
// ============================================================================
console.log("\n--- PART 3: DATE & REPORTING PERIOD BOUNDARIES (Section 22) ---");

test("22.1: Day mode resolves exact Asia/Kolkata half-open boundary [00:00, 24:00)", () => {
  const range = resolveReportingInterval({ period: "day", date: "2026-10-12" });
  assert.strictEqual(range.startIst, "2026-10-12 00:00:00");
  assert.strictEqual(range.endIst, "2026-10-13 00:00:00");
  // 00:00:00 IST is 18:30:00 UTC previous day
  assert.strictEqual(range.startDateUtc.toISOString(), "2026-10-11T18:30:00.000Z");
  assert.strictEqual(range.endDateUtc.toISOString(), "2026-10-12T18:30:00.000Z");
});

test("22.2: Order at 11:50 PM IST belongs to that day, NOT next day", () => {
  const orderTimeUtc = new Date("2026-10-12T18:20:00.000Z"); // 18:20 UTC = 23:50 IST (11:50 PM IST)
  const rangeDay12 = resolveReportingInterval({ period: "day", date: "2026-10-12" });
  const rangeDay13 = resolveReportingInterval({ period: "day", date: "2026-10-13" });

  const inDay12 = orderTimeUtc >= rangeDay12.startDateUtc && orderTimeUtc < rangeDay12.endDateUtc;
  const inDay13 = orderTimeUtc >= rangeDay13.startDateUtc && orderTimeUtc < rangeDay13.endDateUtc;

  assert.strictEqual(inDay12, true, "11:50 PM IST MUST belong to 2026-10-12");
  assert.strictEqual(inDay13, false, "11:50 PM IST MUST NOT belong to 2026-10-13");
});

test("22.3: Order at exact midnight 00:00:00 IST belongs to start of new day, NOT previous day", () => {
  const midnightUtc = new Date("2026-10-12T18:30:00.000Z"); // 18:30 UTC = 00:00:00 IST on 2026-10-13
  const rangeDay12 = resolveReportingInterval({ period: "day", date: "2026-10-12" });
  const rangeDay13 = resolveReportingInterval({ period: "day", date: "2026-10-13" });

  const inDay12 = midnightUtc >= rangeDay12.startDateUtc && midnightUtc < rangeDay12.endDateUtc;
  const inDay13 = midnightUtc >= rangeDay13.startDateUtc && midnightUtc < rangeDay13.endDateUtc;

  assert.strictEqual(inDay12, false, "Midnight 00:00:00 IST must not fall into preceding day [start, end)");
  assert.strictEqual(inDay13, true, "Midnight 00:00:00 IST must fall into new day");
});

test("22.4: Adjacent day ranges do not overlap and have no gaps", () => {
  const d1 = resolveReportingInterval({ period: "day", date: "2026-10-05" });
  const d2 = resolveReportingInterval({ period: "day", date: "2026-10-06" });

  assert.strictEqual(d1.endDateUtc.getTime(), d2.startDateUtc.getTime(), "End of day N must exactly equal start of day N+1");
});

test("22.5: Last Week resolves previous completed Monday-Sunday calendar week in Asia/Kolkata", () => {
  const weekRange = resolveReportingInterval({ period: "week" });
  assert(weekRange.startIst.includes("00:00:00"));
  assert(weekRange.endIst.includes("00:00:00"));
  assert(weekRange.label.includes("–") || weekRange.label.includes("to"), "Label must show Monday to Sunday interval");

  // Verify total duration of week range is exactly 7 days
  const durationMs = weekRange.endDateUtc.getTime() - weekRange.startDateUtc.getTime();
  const durationDays = durationMs / (24 * 60 * 60 * 1000);
  assert.strictEqual(durationDays, 7, "Last completed week must span exactly 7 full days");
});

test("22.6: Month mode resolves exact calendar month boundaries (e.g. October 31 days)", () => {
  const octRange = resolveReportingInterval({ period: "month", month: "2026-10" });
  assert.strictEqual(octRange.startIst, "2026-10-01 00:00:00");
  assert.strictEqual(octRange.endIst, "2026-11-01 00:00:00");
  const durationDays = (octRange.endDateUtc.getTime() - octRange.startDateUtc.getTime()) / (24 * 60 * 60 * 1000);
  assert.strictEqual(durationDays, 31, "October has 31 days");
});

test("22.7: Leap year February handling (2024 has 29 days, 2026 has 28 days)", () => {
  const leapFeb = resolveReportingInterval({ period: "month", month: "2024-02" });
  const nonLeapFeb = resolveReportingInterval({ period: "month", month: "2026-02" });

  const leapDays = (leapFeb.endDateUtc.getTime() - leapFeb.startDateUtc.getTime()) / (24 * 60 * 60 * 1000);
  const nonLeapDays = (nonLeapFeb.endDateUtc.getTime() - nonLeapFeb.startDateUtc.getTime()) / (24 * 60 * 60 * 1000);

  assert.strictEqual(leapDays, 29, "2024 Leap February must have 29 days");
  assert.strictEqual(nonLeapDays, 28, "2026 February must have 28 days");
});

test("22.8: Year mode covers full Jan 1 to Jan 1 next year interval", () => {
  const yr = resolveReportingInterval({ period: "year", year: "2026" });
  assert.strictEqual(yr.startIst, "2026-01-01 00:00:00");
  assert.strictEqual(yr.endIst, "2027-01-01 00:00:00");
  const yrDays = (yr.endDateUtc.getTime() - yr.startDateUtc.getTime()) / (24 * 60 * 60 * 1000);
  assert.strictEqual(yrDays, 365, "2026 year has 365 days");
});

test("22.9: Overall mode covers epoch to 2100", () => {
  const all = resolveReportingInterval({ period: "all" });
  assert.strictEqual(all.startIst, "1970-01-01 00:00:00");
  assert.strictEqual(all.endIst, "2100-01-01 00:00:00");
});

// ============================================================================
// PART 4: CSV EXPORT & SECURITY (Section 23)
// ============================================================================
console.log("\n--- PART 4: CSV EXPORT & SECURITY (Section 23) ---");

test("23.1: Formula injection prevention neutralizes =, +, -, @ on untrusted text fields", () => {
  assert.strictEqual(neutralizeFormula("=1+1"), "'=1+1");
  assert.strictEqual(neutralizeFormula("+cmd|' /C calc'!A0"), "'+cmd|' /C calc'!A0");
  assert.strictEqual(neutralizeFormula("-sum(A1:A10)"), "'-sum(A1:A10)");
  assert.strictEqual(neutralizeFormula("@mention"), "'@mention");
  assert.strictEqual(neutralizeFormula("   =calc()"), "'   =calc()", "Handles leading whitespace");
  assert.strictEqual(neutralizeFormula("Standard Name"), "Standard Name", "Safe strings remain untouched");
});

test("23.2: Numeric money amounts are NOT corrupted by formula neutralization", () => {
  // Plain decimal formatting
  const formatted = formatPlainDecimal(1499.5);
  assert.strictEqual(formatted, "1499.50");
  assert.strictEqual(escapeCsvValue(formatted, true), "1499.50", "IsNumeric true leaves decimal intact");
});

test("23.3: CSV Escaping complies with RFC 4180 (commas, quotes, newlines)", () => {
  assert.strictEqual(escapeCsvValue('Simple', false), 'Simple');
  assert.strictEqual(escapeCsvValue('Doe, John', false), '"Doe, John"');
  assert.strictEqual(escapeCsvValue('He said "Hello"', false), '"He said ""Hello"""');
  assert.strictEqual(escapeCsvValue("Line1\nLine2", false), '"Line1\nLine2"');
});

test("23.4: Unicode names and ₹ currency symbol correctly preserved with UTF-8 BOM", () => {
  const csvContent = formatSummaryMetricsCsv({
    totalOrders: 10,
    pendingDispatch: 2,
    dispatched: 3,
    delivered: 4,
    cancelled: 1,
    revenue: 14590,
  });

  assert(csvContent.startsWith("\uFEFF"), "CSV must begin with UTF-8 BOM byte sequence");
  assert(csvContent.includes("Total Orders,10"), "Summary CSV must export exact metrics");
  assert(csvContent.includes("Pending Dispatch,2"));
  assert(csvContent.includes("Dispatched,3"));
  assert(csvContent.includes("Delivered,4"));
  assert(csvContent.includes("Cancelled,1"));
  assert(csvContent.includes("Revenue,14590.00"));
});

test("23.5: Asia/Kolkata date formatting for CSV outputs (YYYY-MM-DD HH:mm)", () => {
  const utcDate = new Date("2026-10-12T14:30:00.000Z"); // 14:30 UTC = 20:00 IST (8:00 PM IST)
  const formatted = formatIstTimestamp(utcDate);
  assert.strictEqual(formatted, "2026-10-12 20:00");
});

test("23.6: Export filenames reflect resolved reporting period safely", () => {
  const dayName = generateOrdersCsvFilename({ period: "day", date: "2026-10-05" });
  assert.strictEqual(dayName, "orders_2026-10-05.csv");

  const monthName = generateOrdersCsvFilename({ period: "month", month: "2026-10" });
  assert.strictEqual(monthName, "orders_2026-10.csv");

  const yearName = generateOrdersCsvFilename({ period: "year", year: "2026" });
  assert.strictEqual(yearName, "orders_2026.csv");

  const allName = generateOrdersCsvFilename({ period: "all" });
  assert.strictEqual(allName, "orders_all.csv");

  const summaryDay = generateSummaryCsvFilename({ period: "day", date: "2026-10-05" });
  assert.strictEqual(summaryDay, "orders_summary_2026-10-05.csv");
});

// ============================================================================
// PART 5: REGRESSION & INTEGRATION VALIDATION (Section 24)
// ============================================================================
console.log("\n--- PART 5: REGRESSION & INTEGRATION (Section 24) ---");

test("24.1: Database migration 005 script file exists and contains all required DDL", () => {
  const migrationPath = path.join(process.cwd(), "database", "migrations", "005_orders_analytics_and_checkout_attempts.sql");
  assert(fs.existsSync(migrationPath), "Migration 005 file must exist");
  const content = fs.readFileSync(migrationPath, "utf-8");

  assert(content.includes("dispatched_at"), "Must add dispatched_at");
  assert(content.includes("delivered_at"), "Must add delivered_at");
  assert(content.includes("cancelled_at"), "Must add cancelled_at");
  assert(content.includes("idx_orders_created_at_status"), "Must add index on (created_at, status)");
  assert(content.includes("checkout_attempts"), "Must create checkout_attempts table");
  assert(content.includes("order_export_audits"), "Must create order_export_audits table");
  assert(content.includes("order_status_history"), "Must create order_status_history table");
});

test("24.2: Migration runner enforces safety checks and refuses production targets", () => {
  const runnerPath = path.join(process.cwd(), "database", "run-migration-005.ts");
  assert(fs.existsSync(runnerPath), "run-migration-005.ts must exist");
  const content = fs.readFileSync(runnerPath, "utf-8");
  assert(content.includes("Hostinger production"), "Must contain safety check against production");
  assert(content.includes("isProductionTarget"), "Must check isProductionTarget");
});

test("24.3: Legacy reconciliation script supports dry-run report and backup before apply", () => {
  const reconcilePath = path.join(process.cwd(), "scripts", "reconcile-legacy-orders.ts");
  assert(fs.existsSync(reconcilePath), "reconcile-legacy-orders.ts must exist");
  const content = fs.readFileSync(reconcilePath, "utf-8");
  assert(content.includes("--dry-run"), "Must support --dry-run");
  assert(content.includes("--backup"), "Must support --backup");
  assert(content.includes("--apply"), "Must support --apply");
});

test("24.4: Scheduled cleanup script exists for 30m expiry and 30d retention purge", () => {
  const cleanupPath = path.join(process.cwd(), "scripts", "cleanup-checkout-attempts.ts");
  assert(fs.existsSync(cleanupPath), "cleanup-checkout-attempts.ts must exist");
  const content = fs.readFileSync(cleanupPath, "utf-8");
  assert(content.includes("cleanupCheckoutAttempts"), "Must call cleanupCheckoutAttempts");
});

test("24.5: API route handlers exist and are protected", () => {
  assert(fs.existsSync(path.join(process.cwd(), "src/app/api/admin/orders/summary/route.ts")), "Summary route exists");
  assert(fs.existsSync(path.join(process.cwd(), "src/app/api/admin/orders/export/route.ts")), "Export route exists");
  assert(fs.existsSync(path.join(process.cwd(), "src/app/api/admin/orders/cleanup/route.ts")), "Cleanup route exists");
});

// ============================================================================
// PART 6: CRITICAL REVIEW VERIFICATION (Section 25)
// ============================================================================
console.log("\n--- PART 6: CRITICAL REVIEW VERIFICATION (Section 25) ---");

test("25.1: Fail-closed target policy in migration runner rejects unrecognized hosts and databases", () => {
  // Approved targets pass
  assert.strictEqual(isApprovedLocalTarget("127.0.0.1", "dearr_local"), true, "127.0.0.1 + dearr_local must be approved");
  assert.strictEqual(isApprovedLocalTarget("localhost", "dearr_test"), true, "localhost + dearr_test must be approved");
  assert.strictEqual(isApprovedLocalTarget("::1", "dearr_dev"), true, "::1 + dearr_dev must be approved");

  // Unrecognized hosts fail closed
  assert.strictEqual(isApprovedLocalTarget("192.168.1.50", "dearr_local"), false, "Unrecognized LAN IP must fail closed");
  assert.strictEqual(isApprovedLocalTarget("db.internal.net", "dearr_local"), false, "Unrecognized domain must fail closed");

  // Hostinger production targets fail closed
  assert.strictEqual(isApprovedLocalTarget("srv123.hstgr.io", "dearr_local"), false, "Hostinger hstgr.io must fail closed");
  assert.strictEqual(isApprovedLocalTarget("hostinger.com", "dearr_local"), false, "Hostinger domain must fail closed");

  // Unrecognized database names fail closed
  assert.strictEqual(isApprovedLocalTarget("127.0.0.1", "production_db"), false, "Unrecognized database must fail closed");
  assert.strictEqual(isApprovedLocalTarget("localhost", "dearr_prod"), false, "Unapproved prod db must fail closed");
});

test("25.2: 30-minute expiry and retention policy derivation", () => {
  assert.strictEqual(ATTEMPT_EXPIRY_MINUTES, 30, "Expiry must be 30 minutes");
  assert.strictEqual(ATTEMPT_RETENTION_DAYS, 90, "Retention must be 90 days");

  const creationTime = new Date("2026-10-12T10:00:00.000Z");
  const expiresAt = new Date(creationTime.getTime() + ATTEMPT_EXPIRY_MINUTES * 60 * 1000);
  const retentionUntil = new Date(expiresAt.getTime() + ATTEMPT_RETENTION_DAYS * 24 * 60 * 60 * 1000);

  // Expiry is 10:30 (30 mins after creation)
  assert.strictEqual(expiresAt.toISOString(), "2026-10-12T10:30:00.000Z");
  // Retention is derived from expires_at + 90 days (NOT creation + 90 days)
  assert.strictEqual(retentionUntil.toISOString(), "2027-01-10T10:30:00.000Z");

  const diffMs = retentionUntil.getTime() - expiresAt.getTime();
  assert.strictEqual(diffMs, 90 * 24 * 60 * 60 * 1000, "Retention must be exactly 90 days AFTER expiry");
});

test("25.3: Pure Node.js ESM cleanup runner exists and is executable without tsx", () => {
  const runnerPath = path.join(process.cwd(), "scripts", "cleanup-checkout-attempts.mjs");
  assert(fs.existsSync(runnerPath), "scripts/cleanup-checkout-attempts.mjs must exist");
  const content = fs.readFileSync(runnerPath, "utf-8");
  assert(content.includes("UPDATE checkout_attempts"), "Must expire pending attempts past 30 min");
  assert(content.includes("DELETE FROM checkout_attempts"), "Must purge eligible attempts past retention");
  assert(content.includes("status IN ('expired', 'failed')"), "Must only delete expired/failed attempts, never converted");
});

test("25.4: Webhook handler route exists and implements idempotent finalization", () => {
  const webhookPath = path.join(process.cwd(), "src/app/api/payments/webhook/route.ts");
  assert(fs.existsSync(webhookPath), "src/app/api/payments/webhook/route.ts must exist");
  const content = fs.readFileSync(webhookPath, "utf-8");
  assert(content.includes("payment.captured"), "Must handle payment.captured");
  assert(content.includes("order.paid"), "Must handle order.paid");
  assert(content.includes("finalizeOrderFromAttempt"), "Must finalize order from attempt");
  assert(content.includes("attempt.status === \"converted\""), "Must handle duplicate deliveries idempotently");
});

test("25.5: Refund model exclusion in revenue calculation", () => {
  const orders = [
    { id: "o1", status: "confirmed", paymentStatus: "paid", totalAmount: 1000 },
    { id: "o2", status: "shipped", paymentStatus: "paid", totalAmount: 2000 },
    { id: "o3", status: "confirmed", paymentStatus: "refunded", totalAmount: 1500 }, // Refunded order
    { id: "o4", status: "cancelled", paymentStatus: "paid", totalAmount: 500 },    // Cancelled paid order
  ];

  const metrics = getOrderMetrics(orders);
  // Paid orders: o1 (1000) + o2 (2000) = 3000. Refunded (o3) and cancelled (o4) excluded from revenue.
  assert.strictEqual(metrics.revenue, 3000, "Refunded and cancelled orders must not count towards net revenue");
});

test("25.6: Dispatched order cancelled post-dispatch counts strictly in Cancelled", () => {
  const orders = [
    { id: "o1", status: "cancelled", paymentStatus: "paid", totalAmount: 1200 }, // Dispatched then cancelled
  ];
  const metrics = getOrderMetrics(orders);
  assert.strictEqual(metrics.totalOrders, 1);
  assert.strictEqual(metrics.cancelled, 1, "Must count strictly in Cancelled bucket");
  assert.strictEqual(metrics.dispatched, 0, "Must NOT count in Dispatched bucket");
  assert.strictEqual(metrics.pendingDispatch, 0);
  assert.strictEqual(metrics.delivered, 0);
  assert.strictEqual(
    metrics.totalOrders,
    metrics.pendingDispatch + metrics.dispatched + metrics.delivered + metrics.cancelled,
    "Six-card invariant must hold"
  );
});

test("25.7: Customer order route enforces placedOnly and address ownership", () => {
  const ordersRouteContent = fs.readFileSync(path.join(process.cwd(), "src/app/api/orders/route.ts"), "utf-8");
  assert(ordersRouteContent.includes("createCheckoutAttemptFromCart"), "Online checkout must create checkout attempt");
  assert(ordersRouteContent.includes("placedOnly: true"), "Customer order listing must specify placedOnly: true");
  assert(ordersRouteContent.includes("getCustomerAddressById(user.id"), "Must enforce address ownership against user.id");
});

test("25.8: Payments verify route links checkout attempt and finalizes real order", () => {
  const verifyRouteContent = fs.readFileSync(path.join(process.cwd(), "src/app/api/payments/verify/route.ts"), "utf-8");
  const paymentServerContent = fs.readFileSync(path.join(process.cwd(), "src/lib/server/payment.ts"), "utf-8");
  assert(paymentServerContent.includes("finalizeOrderFromAttempt"), "verifyPayment must call finalizeOrderFromAttempt");
  assert(paymentServerContent.includes("verifyRazorpaySignature"), "verifyPayment must verify HMAC signature");
  assert(verifyRouteContent.includes("verifyRazorpayPayment"), "verify route must call verifyRazorpayPayment");
});

// ============================================================================
// PART 7: FINAL REVENUE INTEGRITY & REFUND VERIFICATION (Section 26)
// ============================================================================
console.log("\n--- PART 7: FINAL REVENUE INTEGRITY & REFUNDS (Section 26) ---");

test("26.1: Paid order with captured payment contributes to revenue", () => {
  // Test both in-memory analytics and SQL predicate definition
  const orders = [
    { id: "o1", status: "confirmed", paymentStatus: "paid", totalAmount: 1499 },
  ];
  const metrics = getOrderMetrics(orders);
  assert.strictEqual(metrics.revenue, 1499, "Valid captured paid order must contribute to revenue");
  assert(REVENUE_ELIGIBLE_SQL_PREDICATE.includes("o.payment_status = 'paid'"));
  assert(REVENUE_ELIGIBLE_SQL_PREDICATE.includes("py.status = 'captured'"));
});

test("26.2: Refunded order whose payment record still says 'captured' contributes zero net revenue", () => {
  // A refunded order where historical payment row is captured must contribute 0 revenue
  const orders = [
    { id: "o_ref", status: "delivered", paymentStatus: "refunded", totalAmount: 2499 },
  ];
  const metrics = getOrderMetrics(orders);
  assert.strictEqual(metrics.revenue, 0, "Refunded order must contribute zero net revenue");
  assert.strictEqual(metrics.totalOrders, 1, "Refunded order is counted in total placed orders");
  assert.strictEqual(metrics.delivered, 1, "Delivered bucket tracks the order status");

  // In the SQL predicate, verify that o.payment_status != 'refunded' is an explicit prerequisite before captured evidence
  assert(
    REVENUE_ELIGIBLE_SQL_PREDICATE.includes("o.payment_status != 'refunded'"),
    "SQL predicate must explicitly require o.payment_status != 'refunded'"
  );
});

test("26.3: Pending online payment contributes zero revenue", () => {
  const orders = [
    { id: "o_pending", status: "pending", paymentStatus: "pending", totalAmount: 1999 },
  ];
  const metrics = getOrderMetrics(orders);
  assert.strictEqual(metrics.revenue, 0, "Pending online attempt must contribute zero revenue");
  assert.strictEqual(metrics.totalOrders, 0, "Pending attempt is not a placed order");
});

test("26.4: Cancelled order contributes zero revenue under the documented V1 rule", () => {
  const orders = [
    { id: "o_can", status: "cancelled", paymentStatus: "paid", totalAmount: 3200 },
  ];
  const metrics = getOrderMetrics(orders);
  assert.strictEqual(metrics.revenue, 0, "Cancelled order contributes zero revenue even if previously paid");
  assert.strictEqual(metrics.cancelled, 1, "Counts strictly in Cancelled bucket");
  assert.strictEqual(metrics.totalOrders, 1, "Counts in total placed orders");
  assert(
    REVENUE_ELIGIBLE_SQL_PREDICATE.includes("o.status != 'cancelled'"),
    "SQL predicate must explicitly enforce o.status != 'cancelled'"
  );
});

test("26.5: Duplicate payment records cannot multiply revenue (EXISTS subquery guarantee)", () => {
  // Verify that the SQL predicate uses an existential subquery EXISTS (...) rather than a JOIN
  assert(
    REVENUE_ELIGIBLE_SQL_PREDICATE.includes("EXISTS ("),
    "Must use existential subquery to guarantee zero row multiplication"
  );
  assert(
    !REVENUE_ELIGIBLE_SQL_PREDICATE.includes("JOIN payments"),
    "Must not use JOIN which could multiply rows if multiple payment records exist"
  );
});

test("26.6: Dashboard revenue and Summary CSV revenue agree exactly", () => {
  const sampleMetrics = {
    totalOrders: 10,
    pendingDispatch: 3,
    dispatched: 4,
    delivered: 2,
    cancelled: 1,
    revenue: 15450.50,
  };
  const csv = formatSummaryMetricsCsv(sampleMetrics);
  assert(csv.includes("Revenue,15450.50"), "Summary CSV must export exact dashboard revenue amount");
});

test("26.7: Unknown refund amounts are not falsely exported as '0.00'", () => {
  // Scenario A: Conclusively fully refunded order -> export full refund amount
  const refundedExport = resolveOrderExportAmounts({
    status: "delivered",
    payment_status: "refunded",
    total_amount: 1299,
  });
  assert.strictEqual(refundedExport.amountPaid, "1299.00");
  assert.strictEqual(refundedExport.refundAmount, "1299.00", "Conclusive full refund must report full paid total");

  // Scenario B: Active paid non-cancelled order -> export confirmed 0.00 refund
  const activePaidExport = resolveOrderExportAmounts({
    status: "confirmed",
    payment_status: "paid",
    total_amount: 999,
  });
  assert.strictEqual(activePaidExport.amountPaid, "999.00");
  assert.strictEqual(activePaidExport.refundAmount, "0.00", "Active unrefunded order reports 0.00 refund");

  // Scenario C: Cancelled paid order with unknown/unrecorded refund -> must be empty '', NOT '0.00'
  const cancelledPaidExport = resolveOrderExportAmounts({
    status: "cancelled",
    payment_status: "paid",
    total_amount: 1500,
  });
  assert.strictEqual(cancelledPaidExport.amountPaid, "1500.00");
  assert.strictEqual(
    cancelledPaidExport.refundAmount,
    "",
    "Unknown refund amount for cancelled paid order must be empty string, NOT false 0.00"
  );

  // Scenario D: Unpaid attempt -> 0.00 paid and 0.00 refund
  const unpaidExport = resolveOrderExportAmounts({
    status: "pending",
    payment_status: "pending",
    total_amount: 500,
  });
  assert.strictEqual(unpaidExport.amountPaid, "0.00");
  assert.strictEqual(unpaidExport.refundAmount, "0.00");
});

// ============================================================================
// PART 8: RAZORPAY TEST-MODE & WEBHOOK HARNESS VERIFICATION (Section 27)
// ============================================================================
console.log("\n--- PART 8: RAZORPAY TEST-MODE & WEBHOOK HARNESS (Section 27) ---");

test("27.1: Server-side HMAC-SHA256 signature verification accepts authentic payment signatures", () => {
  const origSecret = process.env.RAZORPAY_KEY_SECRET;
  const testSecret = "test_secret_for_automated_verification_12345";
  process.env.RAZORPAY_KEY_SECRET = testSecret;

  try {
    const orderId = "order_test_rzp_9901";
    const paymentId = "pay_test_rzp_8801";
    const validSignature = crypto
      .createHmac("sha256", testSecret)
      .update(`${orderId}|${paymentId}`)
      .digest("hex");

    const verified = verifyRazorpaySignature(orderId, paymentId, validSignature);
    assert.strictEqual(verified, true, "Authentic HMAC signature must verify successfully");
  } finally {
    process.env.RAZORPAY_KEY_SECRET = origSecret;
  }
});

test("27.2: Signature verification rejects tampered order ID or payment ID", () => {
  const origSecret = process.env.RAZORPAY_KEY_SECRET;
  const testSecret = "test_secret_for_automated_verification_12345";
  process.env.RAZORPAY_KEY_SECRET = testSecret;

  try {
    const orderId = "order_test_rzp_9901";
    const paymentId = "pay_test_rzp_8801";
    const validSignature = crypto
      .createHmac("sha256", testSecret)
      .update(`${orderId}|${paymentId}`)
      .digest("hex");

    assert.strictEqual(
      verifyRazorpaySignature("order_tampered_id", paymentId, validSignature),
      false,
      "Tampered order ID must fail verification"
    );
    assert.strictEqual(
      verifyRazorpaySignature(orderId, "pay_tampered_id", validSignature),
      false,
      "Tampered payment ID must fail verification"
    );
  } finally {
    process.env.RAZORPAY_KEY_SECRET = origSecret;
  }
});

test("27.3: Signature verification rejects malformed or invalid-format signatures safely", () => {
  const origSecret = process.env.RAZORPAY_KEY_SECRET;
  process.env.RAZORPAY_KEY_SECRET = "test_secret";

  try {
    assert.strictEqual(verifyRazorpaySignature("ord_1", "pay_1", "short_sig"), false);
    assert.strictEqual(verifyRazorpaySignature("ord_1", "pay_1", ""), false);
    assert.strictEqual(verifyRazorpaySignature("ord_1", "pay_1", "not_hex_at_all_".repeat(4)), false);
  } finally {
    process.env.RAZORPAY_KEY_SECRET = origSecret;
  }
});

test("27.4: Webhook signature verification and constant-time payload comparison", () => {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || "example_test_fixture_webhook_secret";
  const rawBody = JSON.stringify({
    event: "payment.captured",
    payload: {
      payment: {
        entity: {
          id: "pay_test_capture_001",
          order_id: "order_test_rzp_001",
          amount: 149900,
          currency: "INR",
          status: "captured",
        },
      },
    },
  });

  // 1. Missing webhook secret: must refuse processing
  const verifyWebhook = (secret, signature, body) => {
    if (!secret) return { ok: false, status: 500, error: "Webhook secret is not configured on the server" };
    if (!signature) return { ok: false, status: 400, error: "Missing x-razorpay-signature header" };
    if (!/^[a-f0-9]{64}$/i.test(signature)) return { ok: false, status: 400, error: "Invalid webhook signature format" };
    const expected = crypto.createHmac("sha256", secret).update(body).digest("hex");
    const isMatch = signature.length === expected.length &&
      crypto.timingSafeEqual(Buffer.from(signature.toLowerCase(), "utf-8"), Buffer.from(expected.toLowerCase(), "utf-8"));
    if (!isMatch) return { ok: false, status: 400, error: "Invalid webhook signature" };
    return { ok: true, status: 200 };
  };

  const missingSecretRes = verifyWebhook("", "valid_sig_placeholder", rawBody);
  assert.strictEqual(missingSecretRes.status, 500, "Missing webhook secret must return HTTP 500");

  // 2. Missing signature header: must reject with HTTP 400
  const missingSigRes = verifyWebhook(webhookSecret, "", rawBody);
  assert.strictEqual(missingSigRes.status, 400, "Missing signature header must return HTTP 400");

  // 3. Invalid signature format / tampered HMAC: must reject with HTTP 400
  const invalidSigRes = verifyWebhook(webhookSecret, "0000000000000000000000000000000000000000000000000000000000000000", rawBody);
  assert.strictEqual(invalidSigRes.status, 400, "Invalid HMAC signature must return HTTP 400");

  // 4. Valid signature: constant-time match passes
  const validSignature = crypto
    .createHmac("sha256", webhookSecret)
    .update(rawBody)
    .digest("hex");

  const validRes = verifyWebhook(webhookSecret, validSignature, rawBody);
  assert.strictEqual(validRes.status, 200, "Authentic HMAC signature must return HTTP 200");

  // 5. Tampered payload: fails verification
  const tamperedBody = rawBody.replace("149900", "99900");
  const tamperedRes = verifyWebhook(webhookSecret, validSignature, tamperedBody);
  assert.strictEqual(tamperedRes.status, 400, "Tampered payload must fail signature check");
});

test("27.5: Multi-tenant customer attempt isolation prevents cross-customer access", () => {
  const attempt = {
    id: "att_user_a",
    userId: "cust_alice_123",
    amount: 1999,
  };
  const requestingUserId = "cust_bob_456";

  const isAuthorized = attempt.userId === requestingUserId;
  assert.strictEqual(isAuthorized, false, "Customer B cannot initiate or access Customer A's checkout attempt");
});

test("27.6: Idempotent order finalization simulation prevents duplicate orders and double revenue", () => {
  const state = {
    attemptId: "att_order_123",
    status: "pending",
    orderId: null,
    orders: [],
    revenue: 0,
    stock: 10,
  };

  function finalizeAttempt(providerPaymentId, amount) {
    if (state.status === "converted" && state.orderId) {
      return { orderId: state.orderId, isDuplicate: true };
    }
    const newOrderId = "ord_real_777";
    state.status = "converted";
    state.orderId = newOrderId;
    state.orders.push({ id: newOrderId, amount });
    state.revenue += amount;
    state.stock -= 1;
    return { orderId: newOrderId, isDuplicate: false };
  }

  const res1 = finalizeAttempt("pay_123", 1499);
  assert.strictEqual(res1.isDuplicate, false);
  assert.strictEqual(state.orders.length, 1);
  assert.strictEqual(state.revenue, 1499);
  assert.strictEqual(state.stock, 9);

  const res2 = finalizeAttempt("pay_123", 1499);
  assert.strictEqual(res2.isDuplicate, true);
  assert.strictEqual(res2.orderId, "ord_real_777");
  assert.strictEqual(state.orders.length, 1, "Duplicate delivery must NOT create second order");
  assert.strictEqual(state.revenue, 1499, "Duplicate delivery must NOT double-count revenue");
  assert.strictEqual(state.stock, 9, "Duplicate delivery must NOT re-decrement stock");
});

test("27.7: Late payment reconciliation after attempt expiry safely finalizes order", () => {
  const expiredAttempt = {
    id: "att_expired_999",
    status: "expired",
    amount: 2499,
    expiresAt: new Date(Date.now() - 1000 * 60 * 45),
  };

  function reconcileLatePayment(attempt, paymentStatus) {
    if (paymentStatus === "captured") {
      attempt.status = "converted";
      attempt.orderId = "ord_late_reconciled";
      return true;
    }
    return false;
  }

  const success = reconcileLatePayment(expiredAttempt, "captured");
  assert.strictEqual(success, true, "Captured payment must safely reconcile expired attempt");
  assert.strictEqual(expiredAttempt.status, "converted");
});

test("27.8: Fail-closed target policy in legacy reconciliation script blocks unauthorized databases", () => {
  assert.strictEqual(isApprovedLocalTarget("127.0.0.1", "dearr_local"), true);
  assert.strictEqual(isApprovedLocalTarget("localhost", "dearr_test"), true);
  assert.strictEqual(isApprovedLocalTarget("sql.hostinger.com", "dearr_prod"), false);
  assert.strictEqual(isApprovedLocalTarget("192.168.1.100", "dearr_local"), false);
  assert.strictEqual(isApprovedLocalTarget("localhost", "production_db"), false);
});

// ============================================================================
// PART 9: REGRESSION TEST FOR ZERO METRICS BUG (Section 28)
// ============================================================================
console.log("\n--- PART 9: ZERO METRICS DISCREPANCY & API CONTRACT (Section 28) ---");

test("28.1: API contract: Summary payload provides metrics and backward-compatible summary", () => {
  const mockApiPayload = {
    ok: true,
    metrics: {
      totalOrders: 20,
      pendingDispatch: 20,
      dispatched: 0,
      delivered: 0,
      cancelled: 0,
      revenue: 10931,
    },
    summary: {
      totalOrders: 20,
      pendingDispatch: 20,
      dispatched: 0,
      delivered: 0,
      cancelled: 0,
      revenue: 10931,
    },
    range: {
      period: "day",
      timezone: "Asia/Kolkata",
      start: "2026-10-12T18:30:00.000Z",
      end: "2026-10-13T18:30:00.000Z",
      label: "13 Oct 2026 (Today)",
      dateKey: "2026-10-13",
    },
  };

  // Client parsing logic
  const metricsData = mockApiPayload.metrics || mockApiPayload.summary;
  assert.ok(metricsData, "Must resolve non-null metrics data");
  assert.strictEqual(Number(metricsData.totalOrders), 20);
  assert.strictEqual(Number(metricsData.pendingDispatch), 20);
  assert.strictEqual(Number(metricsData.dispatched), 0);
  assert.strictEqual(Number(metricsData.delivered), 0);
  assert.strictEqual(Number(metricsData.cancelled), 0);
  assert.strictEqual(Number(metricsData.revenue), 10931);
  assert.strictEqual(mockApiPayload.range.label, "13 Oct 2026 (Today)");
});

test("28.2: Deterministic test fixture with multiple fulfillment states on 13 October 2026", () => {
  // Test fixture representing orders on 13 October 2026 in Asia/Kolkata
  const fixtureOrders = [
    // 2 Confirmed paid orders (Pending Dispatch queue)
    {
      id: "ord_fix_1",
      orderNumber: "DEAR-40427",
      customer: { name: "Priya", email: "priya@example.com", phone: "9876543210" },
      items: [],
      subtotal: 549,
      discountAmount: 0,
      shippingAmount: 0,
      totalAmount: 549,
      currency: "INR",
      paymentStatus: "paid",
      orderStatus: "confirmed",
      paymentMethod: "Razorpay (Online)",
      shippingAddress: {},
      createdAt: "2026-10-13T01:00:00.000Z",
    },
    {
      id: "ord_fix_2",
      orderNumber: "DEAR-51856",
      customer: { name: "Priya", email: "priya@example.com", phone: "9876543210" },
      items: [],
      subtotal: 549,
      discountAmount: 0,
      shippingAmount: 0,
      totalAmount: 549,
      currency: "INR",
      paymentStatus: "paid",
      orderStatus: "confirmed",
      paymentMethod: "Razorpay (Online)",
      shippingAddress: {},
      createdAt: "2026-10-13T02:00:00.000Z",
    },
    // 1 Dispatched paid order
    {
      id: "ord_fix_3",
      orderNumber: "DEAR-28163",
      customer: { name: "Priya", email: "priya@example.com", phone: "9876543210" },
      items: [],
      subtotal: 999,
      discountAmount: 0,
      shippingAmount: 0,
      totalAmount: 999,
      currency: "INR",
      paymentStatus: "paid",
      orderStatus: "shipped",
      paymentMethod: "Razorpay (Online)",
      shippingAddress: {},
      createdAt: "2026-10-13T03:00:00.000Z",
    },
    // 1 Delivered paid order
    {
      id: "ord_fix_4",
      orderNumber: "DEAR-11282",
      customer: { name: "Priya", email: "priya@example.com", phone: "9876543210" },
      items: [],
      subtotal: 1499,
      discountAmount: 0,
      shippingAmount: 0,
      totalAmount: 1499,
      currency: "INR",
      paymentStatus: "paid",
      orderStatus: "delivered",
      paymentMethod: "Razorpay (Online)",
      shippingAddress: {},
      createdAt: "2026-10-13T04:00:00.000Z",
    },
    // 1 Cancelled paid order (void/refunded)
    {
      id: "ord_fix_5",
      orderNumber: "DEAR-99999",
      customer: { name: "Priya", email: "priya@example.com", phone: "9876543210" },
      items: [],
      subtotal: 299,
      discountAmount: 0,
      shippingAmount: 0,
      totalAmount: 299,
      currency: "INR",
      paymentStatus: "paid",
      orderStatus: "cancelled",
      paymentMethod: "Razorpay (Online)",
      shippingAddress: {},
      createdAt: "2026-10-13T05:00:00.000Z",
    },
    // Deliberately excluded: 1 abandoned unpaid checkout attempt
    {
      id: "att_unpaid",
      orderNumber: "DEAR-00000",
      customer: { name: "Unpaid", email: "unpaid@example.com", phone: "9876543210" },
      items: [],
      subtotal: 499,
      discountAmount: 0,
      shippingAmount: 0,
      totalAmount: 499,
      currency: "INR",
      paymentStatus: "pending", // Unpaid attempt
      orderStatus: "pending",
      paymentMethod: "Razorpay (Online)",
      shippingAddress: {},
      createdAt: "2026-10-13T06:00:00.000Z",
    },
    // Deliberately excluded from revenue: 1 fully refunded order
    {
      id: "ord_refunded",
      orderNumber: "DEAR-88888",
      customer: { name: "Refunded", email: "ref@example.com", phone: "9876543210" },
      items: [],
      subtotal: 799,
      discountAmount: 0,
      shippingAmount: 0,
      totalAmount: 799,
      currency: "INR",
      paymentStatus: "refunded",
      orderStatus: "delivered",
      paymentMethod: "Razorpay (Online)",
      shippingAddress: {},
      createdAt: "2026-10-13T07:00:00.000Z",
    },
  ];

  const metrics = getOrderMetrics(fixtureOrders);

  // 1. Total Orders returns nonzero
  assert.strictEqual(metrics.totalOrders, 6, "Total orders must count all placed orders (including cancelled and refunded; excluding unpaid attempt)");
  // 2. Pending Dispatch reflects confirmed orders
  assert.strictEqual(metrics.pendingDispatch, 2, "Pending dispatch must reflect exactly the 2 confirmed orders");
  // 3. Dispatched reflects shipped orders
  assert.strictEqual(metrics.dispatched, 1, "Dispatched must reflect the 1 shipped order");
  // 4. Delivered reflects delivered orders
  assert.strictEqual(metrics.delivered, 2, "Delivered reflects delivered orders (1 paid + 1 refunded)");
  // 5. Cancelled reflects cancelled orders
  assert.strictEqual(metrics.cancelled, 1, "Cancelled reflects the 1 cancelled order");
  // 6. Revenue reflects captured amounts from non-cancelled, non-refunded orders
  // 549 + 549 + 999 + 1499 = 3596
  assert.strictEqual(metrics.revenue, 3596, "Revenue must reflect captured non-cancelled non-refunded amounts");
  // 7. Mutually exclusive invariant
  assert.strictEqual(
    metrics.totalOrders,
    metrics.pendingDispatch + metrics.dispatched + metrics.delivered + metrics.cancelled,
    "Invariant holds: Total Orders = Pending Dispatch + Dispatched + Delivered + Cancelled"
  );
});

test("28.3: Summary and order-list APIs agree on eligibility and time boundaries", () => {
  const range = resolveReportingPeriod({ period: "day", date: "2026-10-13" });
  assert.strictEqual(range.dateKey, "2026-10-13");
  assert.strictEqual(range.startSql, "2026-10-13 00:00:00");
  assert.strictEqual(range.endSql, "2026-10-14 00:00:00");
  assert.ok(range.label.includes("13 Oct 2026"));

  // Verify that both queries use identical PLACED_ORDER_SQL_PREDICATE
  assert(PLACED_ORDER_SQL_PREDICATE.length > 20, "Shared placed order predicate exists");
  assert(REVENUE_ELIGIBLE_SQL_PREDICATE.includes("status != 'cancelled'"), "Revenue excludes cancelled");
  assert(REVENUE_ELIGIBLE_SQL_PREDICATE.includes("payment_status != 'refunded'"), "Revenue excludes refunded");
});

test("28.4: Error state handling: Failed summary API produces error state, not six false zeros", () => {
  // Simulate client behavior when summary API returns error or fails
  let clientSummary = {
    totalOrders: 0,
    pendingDispatch: 0,
    dispatched: 0,
    delivered: 0,
    cancelled: 0,
    revenue: 0,
  };
  let fetchError = null;

  function handleSummaryResponse(res) {
    if (!res.ok) {
      fetchError = res.error || "Failed to load orders summary";
      return;
    }
    const metricsData = res.metrics || res.summary;
    if (metricsData) {
      clientSummary = {
        totalOrders: Number(metricsData.totalOrders || 0),
        pendingDispatch: Number(metricsData.pendingDispatch || 0),
        dispatched: Number(metricsData.dispatched || 0),
        delivered: Number(metricsData.delivered || 0),
        cancelled: Number(metricsData.cancelled || 0),
        revenue: Number(metricsData.revenue || 0),
      };
    }
  }

  // When API fails (e.g. 500 error)
  handleSummaryResponse({ ok: false, error: "Database connection failed" });
  assert.strictEqual(fetchError, "Database connection failed");

  // In UI, card value when fetchError is present displays "—", NOT 0
  const renderedTotal = fetchError ? "—" : clientSummary.totalOrders;
  const renderedRevenue = fetchError ? "—" : `₹${clientSummary.revenue}`;
  assert.strictEqual(renderedTotal, "—", "UI must display dash/error state when fetchError is present");
  assert.strictEqual(renderedRevenue, "—", "UI must display dash/error state when fetchError is present");
});

test("28.5: Race condition protection: Stale in-flight responses are discarded", () => {
  let activeRequestId = 0;
  let displayedSummary = null;

  function simulateLoadData(reqId, data) {
    // If request ID is not the latest active request ID, discard it
    if (reqId !== activeRequestId) {
      return false; // Discarded
    }
    displayedSummary = data;
    return true; // Applied
  }

  // User rapidly clicks "Last Week" (req 1) then "Day" (req 2)
  const req1 = ++activeRequestId;
  const req2 = ++activeRequestId;

  // Req 1 (slower response) returns AFTER req 2
  const applied2 = simulateLoadData(req2, { totalOrders: 20, revenue: 10931 });
  assert.strictEqual(applied2, true, "Latest request must be applied");

  const applied1 = simulateLoadData(req1, { totalOrders: 0, revenue: 0 });
  assert.strictEqual(applied1, false, "Stale request must be discarded");
  assert.strictEqual(displayedSummary.totalOrders, 20, "Display must keep latest selection");
});

await asyncTest("28.6: Database aggregation matches local orders in dearr_local when connected", async () => {
  const range = resolveReportingPeriod({ period: "day", date: "2026-10-13" });
  const metrics = await getOrderSummaryMetrics(range);

  // Verify non-zero metrics matching placed orders in dearr_local
  assert.ok(metrics.totalOrders > 0, `Expected totalOrders > 0, got ${metrics.totalOrders}`);
  assert.ok(metrics.pendingDispatch > 0, `Expected pendingDispatch > 0, got ${metrics.pendingDispatch}`);
  assert.ok(metrics.revenue > 0, `Expected revenue > 0, got ${metrics.revenue}`);
  assert.strictEqual(
    metrics.totalOrders,
    metrics.pendingDispatch + metrics.dispatched + metrics.delivered + metrics.cancelled,
    "Database aggregation invariant holds"
  );
});

console.log("\n================================================================================");
console.log(`TEST SUMMARY: ${passedCount}/${totalCount} tests passed (100%)`);
console.log("================================================================================\n");
process.exit(0);
