/**
 * Dearr V1 — B-18 Fake/Test Payment Verification Test Suite
 *
 * Verifies:
 *  1. Create a valid pending order.
 *  2. Confirm newly created order has payment_status = pending.
 *  3. Run a fake/test successful payment through the server-side mechanism.
 *  4. Confirm payment_status becomes paid.
 *  5. Confirm the order total remains unchanged.
 *  6. Confirm a fake/test failed payment produces payment_status = failed.
 *  7. Confirm failed payment does not become paid.
 *  8. Confirm incorrect payment amount is rejected.
 *  9. Confirm incorrect amount cannot change payment_status to paid.
 *  10. Confirm nonexistent order fails safely.
 *  11. Confirm duplicate/already-paid success does not corrupt the order state.
 *  12. Confirm customer/browser cannot directly mutate payment status through the normal order API.
 *  13. Confirm admin/browser cannot directly mutate payment status through the normal order API.
 *  14. Confirm no sensitive credentials/secrets are returned in responses/errors.
 *  15. Confirm the test payment mechanism is clearly isolated from real Razorpay.
 *  16. Confirm failed payment retry allows successful payment with multiple payment audit records.
 *
 * Usage:
 *   npx tsx database/verify-b18-payment.ts
 *
 * Pool management: Uses connectionLimit=2 to stay within Hostinger limits.
 */

// In standalone node scripts outside Next.js bundler, mock server-only and next/headers
require.cache[require.resolve("server-only")] = {
  id: require.resolve("server-only"),
  filename: require.resolve("server-only"),
  loaded: true,
  exports: {},
} as any;

let mockSessionToken: string | null = null;

require.cache[require.resolve("next/headers")] = {
  id: require.resolve("next/headers"),
  filename: require.resolve("next/headers"),
  loaded: true,
  exports: {
    cookies: async () => ({
      get: (name: string) =>
        name === "dearr_session" && mockSessionToken
          ? { name, value: mockSessionToken }
          : undefined,
      set: () => {},
      delete: () => {},
    }),
  },
} as any;

import mysql, { Pool } from "mysql2/promise";
import crypto from "crypto";
import fs from "fs";
import path from "path";

// Load .env.local manually for standalone test runner
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

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const DB_CONFIG = {
  host: process.env.DB_HOST || "127.0.0.1",
  port: parseInt(process.env.DB_PORT || "3306", 10),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  waitForConnections: true,
  connectionLimit: 2,
  maxIdle: 2,
  idleTimeout: 30000,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
};

let pool: Pool;
let pass = 0;
let fail = 0;

// Test data IDs
const TEST_PREFIX = "b18_test_";
const testCustomerId = `${TEST_PREFIX}cust_${crypto.randomUUID().slice(0, 8)}`;
const testAdminId = `${TEST_PREFIX}admin_${crypto.randomUUID().slice(0, 8)}`;
const testCategoryId = `${TEST_PREFIX}cat_${crypto.randomUUID().slice(0, 8)}`;
const testProductId = `${TEST_PREFIX}prod_${crypto.randomUUID().slice(0, 8)}`;

const order1Id = crypto.randomUUID();
const order2Id = crypto.randomUUID();
const order3Id = crypto.randomUUID();

const order1Number = `DEAR-18001`;
const order2Number = `DEAR-18002`;
const order3Number = `DEAR-18003`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function assert(condition: boolean, label: string): void {
  if (condition) {
    pass++;
    console.log(`  ✅ ${label}`);
  } else {
    fail++;
    console.error(`  ❌ ${label}`);
  }
}

// ---------------------------------------------------------------------------
// Setup & Teardown
// ---------------------------------------------------------------------------

async function cleanup() {
  console.log("\n🧹 Cleaning up test data...");
  const conn = await pool.getConnection();
  try {
    // Delete in dependency order
    await conn.execute(
      `DELETE FROM payments WHERE order_id IN (SELECT id FROM orders WHERE user_id IN (?, ?))`,
      [testCustomerId, testAdminId]
    );
    await conn.execute(
      `DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE user_id IN (?, ?))`,
      [testCustomerId, testAdminId]
    );
    await conn.execute(
      `DELETE FROM orders WHERE user_id IN (?, ?)`,
      [testCustomerId, testAdminId]
    );
    await conn.execute(
      `DELETE FROM products WHERE id = ?`,
      [testProductId]
    );
    await conn.execute(
      `DELETE FROM categories WHERE id = ?`,
      [testCategoryId]
    );
    await conn.execute(
      `DELETE FROM profiles WHERE id IN (?, ?)`,
      [testCustomerId, testAdminId]
    );
  } finally {
    conn.release();
  }
}

async function seedTestData() {
  console.log("🌱 Seeding test fixtures in Hostinger MySQL...\n");
  const conn = await pool.getConnection();
  try {
    const dummyHash = "$2a$10$XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX";

    // 1. Customer and Admin profiles
    await conn.execute(
      `INSERT INTO profiles (id, email, password_hash, full_name, phone, role, created_at, updated_at)
       VALUES (?, 'b18cust@dearr.test', ?, 'B18 Customer', '9876543210', 'customer', NOW(), NOW())`,
      [testCustomerId, dummyHash]
    );
    await conn.execute(
      `INSERT INTO profiles (id, email, password_hash, full_name, phone, role, created_at, updated_at)
       VALUES (?, 'b18admin@dearr.test', ?, 'B18 Admin', '9876543211', 'admin', NOW(), NOW())`,
      [testAdminId, dummyHash]
    );

    // 2. Category & Product
    await conn.execute(
      `INSERT INTO categories (id, name, slug, is_active, created_at, updated_at)
       VALUES (?, 'B18 Payment Category', 'b18-pay-cat', 1, NOW(), NOW())`,
      [testCategoryId]
    );
    await conn.execute(
      `INSERT INTO products (id, category_id, name, slug, description, price, compare_at_price, stock_quantity, is_active, created_at, updated_at)
       VALUES (?, ?, 'B18 Test Product', 'b18-test-product', 'Product for B-18 test payment verification', 499.00, 599.00, 50, 1, NOW(), NOW())`,
      [testProductId, testCategoryId]
    );

    // 3. Orders:
    // Order 1: For success test (Amount = ₹1397.00)
    await conn.execute(
      `INSERT INTO orders (id, order_number, user_id, status, payment_status,
         subtotal, discount_amount, shipping_amount, total_amount, currency,
         shipping_full_name, shipping_phone,
         shipping_address_line_1, shipping_city, shipping_state, shipping_postal_code, shipping_country,
         created_at, updated_at)
       VALUES (?, ?, ?, 'pending', 'pending',
               1397.00, 0, 0, 1397.00, 'INR',
               'B18 Customer', '9876543210',
               '123 Test Street', 'Bengaluru', 'Karnataka', '560001', 'India',
               NOW(), NOW())`,
      [order1Id, order1Number, testCustomerId]
    );
    await conn.execute(
      `INSERT INTO order_items (id, order_id, product_id, product_name, unit_price, quantity, discount_amount, line_total, created_at)
       VALUES (?, ?, ?, 'B18 Test Product', 499.00, 2, 0, 998.00, NOW())`,
      [crypto.randomUUID(), order1Id, testProductId]
    );

    // Order 2: For failure & retry test (Amount = ₹598.00)
    await conn.execute(
      `INSERT INTO orders (id, order_number, user_id, status, payment_status,
         subtotal, discount_amount, shipping_amount, total_amount, currency,
         shipping_full_name, shipping_phone,
         shipping_address_line_1, shipping_city, shipping_state, shipping_postal_code, shipping_country,
         created_at, updated_at)
       VALUES (?, ?, ?, 'pending', 'pending',
               598.00, 0, 0, 598.00, 'INR',
               'B18 Customer', '9876543210',
               '123 Test Street', 'Bengaluru', 'Karnataka', '560001', 'India',
               NOW(), NOW())`,
      [order2Id, order2Number, testCustomerId]
    );
    await conn.execute(
      `INSERT INTO order_items (id, order_id, product_id, product_name, unit_price, quantity, discount_amount, line_total, created_at)
       VALUES (?, ?, ?, 'B18 Test Product', 299.00, 2, 0, 598.00, NOW())`,
      [crypto.randomUUID(), order2Id, testProductId]
    );

    // Order 3: For amount mismatch & API tampering test (Amount = ₹499.00)
    await conn.execute(
      `INSERT INTO orders (id, order_number, user_id, status, payment_status,
         subtotal, discount_amount, shipping_amount, total_amount, currency,
         shipping_full_name, shipping_phone,
         shipping_address_line_1, shipping_city, shipping_state, shipping_postal_code, shipping_country,
         created_at, updated_at)
       VALUES (?, ?, ?, 'pending', 'pending',
               499.00, 0, 0, 499.00, 'INR',
               'B18 Customer', '9876543210',
               '123 Test Street', 'Bengaluru', 'Karnataka', '560001', 'India',
               NOW(), NOW())`,
      [order3Id, order3Number, testCustomerId]
    );
    await conn.execute(
      `INSERT INTO order_items (id, order_id, product_id, product_name, unit_price, quantity, discount_amount, line_total, created_at)
       VALUES (?, ?, ?, 'B18 Test Product', 499.00, 1, 0, 499.00, NOW())`,
      [crypto.randomUUID(), order3Id, testProductId]
    );
  } finally {
    conn.release();
  }
}

// ---------------------------------------------------------------------------
// Test Suites
// ---------------------------------------------------------------------------

async function testInitialOrderState() {
  console.log("\n📋 Test Suite 1: Initial Order Creation & Payment State (Tests 1 & 2)");
  console.log("─".repeat(50));

  const [rows] = (await pool.execute(
    "SELECT id, order_number, status, payment_status, total_amount, currency FROM orders WHERE id = ?",
    [order1Id]
  )) as any;

  assert(rows.length === 1, "Order 1 exists in MySQL database");
  assert(rows[0].order_number === order1Number, `Order number matches expected format: ${rows[0].order_number}`);
  assert(rows[0].status === "pending", "Initial order fulfillment status is 'pending'");
  assert(rows[0].payment_status === "pending", "Initial order payment_status is 'pending'");
  assert(Number(rows[0].total_amount) === 1397.00, "Initial order total amount is 1397.00");
  assert(rows[0].currency === "INR", "Initial order currency is 'INR'");

  const [paymentRows] = (await pool.execute(
    "SELECT COUNT(*) AS cnt FROM payments WHERE order_id = ?",
    [order1Id]
  )) as any;
  assert(Number(paymentRows[0].cnt) === 0, "No payment records exist for newly created pending order");
}

async function testSuccessfulPaymentFlow() {
  console.log("\n📋 Test Suite 2: Fake/Test Successful Payment Flow (Tests 3, 4 & 5)");
  console.log("─".repeat(50));

  const { processTestPayment, getPaymentsByOrderId } = await import("../src/lib/server/payment");

  // Run fake/test successful payment with matching trusted amount
  const result = await processTestPayment({
    orderId: order1Id,
    outcome: "success",
    amount: 1397.00,
  });

  assert(result.success === true, "processTestPayment returns success: true");
  assert(result.paymentStatus === "paid", "processTestPayment returns paymentStatus: 'paid'");
  assert(result.order.paymentStatus === "paid", "Returned order object reflects paymentStatus: 'paid'");
  assert(result.paymentRecord.provider === "test", "Payment record provider is 'test'");
  assert(result.paymentRecord.status === "captured", "Payment record status is 'captured'");
  assert(result.paymentRecord.amount === 1397.00, "Payment record amount matches trusted order total (1397.00)");
  assert(result.paymentRecord.currency === "INR", "Payment record currency is 'INR'");
  assert(result.paymentRecord.paidAt !== null, "Payment record paidAt timestamp is populated");
  assert(result.paymentRecord.providerOrderId.startsWith("test_ord_"), "Provider order ID starts with 'test_ord_'");
  assert(result.paymentRecord.providerPaymentId !== null && result.paymentRecord.providerPaymentId.startsWith("test_pay_"), "Provider payment ID starts with 'test_pay_'");

  // Verify in MySQL
  const [orderCheck] = (await pool.execute(
    "SELECT status, payment_status, total_amount, subtotal, discount_amount, shipping_amount FROM orders WHERE id = ?",
    [order1Id]
  )) as any;

  assert(orderCheck[0].payment_status === "paid", "DB verification: orders.payment_status updated to 'paid'");
  assert(Number(orderCheck[0].total_amount) === 1397.00, "DB verification: order total_amount remains strictly unchanged (1397.00)");
  assert(Number(orderCheck[0].subtotal) === 1397.00, "DB verification: order subtotal remains strictly unchanged");
  assert(orderCheck[0].status === "pending", "DB verification: order fulfillment status remains 'pending' (decoupled from payment)");

  const payments = await getPaymentsByOrderId(order1Id);
  assert(payments.length === 1, "getPaymentsByOrderId returns exactly 1 payment record");
  assert(payments[0].status === "captured", "Persisted payment status is 'captured'");
}

async function testFailedPaymentFlow() {
  console.log("\n📋 Test Suite 3: Fake/Test Failed Payment Flow (Tests 6 & 7)");
  console.log("─".repeat(50));

  const { processTestPayment, getPaymentsByOrderId } = await import("../src/lib/server/payment");

  // Verify initial state for Order 2
  const [initCheck] = (await pool.execute(
    "SELECT payment_status FROM orders WHERE id = ?",
    [order2Id]
  )) as any;
  assert(initCheck[0].payment_status === "pending", "Order 2 initial payment_status is 'pending'");

  // Run fake/test failed payment
  const result = await processTestPayment({
    orderId: order2Id,
    outcome: "failure",
    amount: 598.00,
    failureReason: "Card declined in test mode",
  });

  assert(result.success === false, "processTestPayment returns success: false");
  assert(result.paymentStatus === "failed", "processTestPayment returns paymentStatus: 'failed'");
  assert(result.order.paymentStatus === "failed", "Returned order object reflects paymentStatus: 'failed'");
  assert(result.paymentRecord.status === "failed", "Payment record status is 'failed'");
  assert(result.paymentRecord.provider === "test", "Payment record provider is 'test'");
  assert(result.paymentRecord.providerPaymentId === null, "Failed payment has NULL providerPaymentId");
  assert(result.paymentRecord.paidAt === null, "Failed payment has NULL paidAt timestamp");

  // Verify in MySQL that failed payment never becomes paid
  const [dbCheck] = (await pool.execute(
    "SELECT payment_status, total_amount FROM orders WHERE id = ?",
    [order2Id]
  )) as any;

  assert(dbCheck[0].payment_status === "failed", "DB verification: orders.payment_status updated to 'failed'");
  assert(dbCheck[0].payment_status !== "paid", "Security verification: failed payment did NOT become 'paid'");
  assert(Number(dbCheck[0].total_amount) === 598.00, "DB verification: order total remains unchanged (598.00)");

  const payments = await getPaymentsByOrderId(order2Id);
  assert(payments.length === 1, "Exactly 1 payment record stored for failed attempt");
  assert(payments[0].status === "failed", "Persisted payment record has status 'failed'");
}

async function testAmountValidation() {
  console.log("\n📋 Test Suite 4: Payment Amount Validation & Tamper Rejection (Tests 8 & 9)");
  console.log("─".repeat(50));

  const { processTestPayment, PaymentValidationError } = await import("../src/lib/server/payment");

  // Order 3 total is ₹499.00
  // 1. Attempt underpayment (₹99.00)
  let underpayError: any = null;
  try {
    await processTestPayment({
      orderId: order3Id,
      outcome: "success",
      amount: 99.00,
    });
  } catch (err: any) {
    underpayError = err;
  }

  assert(underpayError instanceof PaymentValidationError, "Underpayment throws PaymentValidationError");
  assert(underpayError?.statusCode === 400, "Underpayment returns status 400");
  assert(
    underpayError?.message.includes("mismatch"),
    `Underpayment error message mentions amount mismatch: "${underpayError?.message}"`
  );

  // 2. Attempt overpayment (₹999.00)
  let overpayError: any = null;
  try {
    await processTestPayment({
      orderId: order3Id,
      outcome: "success",
      amount: 999.00,
    });
  } catch (err: any) {
    overpayError = err;
  }

  assert(overpayError instanceof PaymentValidationError, "Overpayment throws PaymentValidationError");
  assert(overpayError?.statusCode === 400, "Overpayment returns status 400");

  // 3. Attempt negative amount (-50.00)
  let negError: any = null;
  try {
    await processTestPayment({
      orderId: order3Id,
      outcome: "success",
      amount: -50.00,
    });
  } catch (err: any) {
    negError = err;
  }

  assert(negError instanceof PaymentValidationError, "Negative amount throws PaymentValidationError");
  assert(negError?.statusCode === 400, "Negative amount returns status 400");

  // Verify in DB that Order 3 was NOT changed to paid
  const [dbCheck] = (await pool.execute(
    "SELECT payment_status FROM orders WHERE id = ?",
    [order3Id]
  )) as any;
  assert(dbCheck[0].payment_status === "pending", "DB check: order.payment_status remains 'pending' after all mismatched attempts");

  const [payRows] = (await pool.execute(
    "SELECT COUNT(*) AS cnt FROM payments WHERE order_id = ?",
    [order3Id]
  )) as any;
  assert(Number(payRows[0].cnt) === 0, "No payment records created for rejected amount attempts");
}

async function testNonexistentAndInvalidOrders() {
  console.log("\n📋 Test Suite 5: Nonexistent & Invalid Order Safety (Test 10)");
  console.log("─".repeat(50));

  const { processTestPayment, PaymentValidationError } = await import("../src/lib/server/payment");

  // 1. Nonexistent UUID
  let notFoundError: any = null;
  try {
    await processTestPayment({
      orderId: crypto.randomUUID(),
      outcome: "success",
    });
  } catch (err: any) {
    notFoundError = err;
  }

  assert(notFoundError instanceof PaymentValidationError, "Nonexistent order throws PaymentValidationError");
  assert(notFoundError?.statusCode === 404, "Nonexistent order returns status 404 Not Found");
  assert(notFoundError?.message === "Order not found", "Error message safely states 'Order not found'");

  // 2. Empty string order ID
  let emptyIdError: any = null;
  try {
    await processTestPayment({
      orderId: "   ",
      outcome: "success",
    });
  } catch (err: any) {
    emptyIdError = err;
  }
  assert(emptyIdError?.statusCode === 400, "Empty order ID returns status 400");

  // 3. SQL injection attempt in order ID
  let sqliError: any = null;
  try {
    await processTestPayment({
      orderId: "' OR 1=1 --",
      outcome: "success",
    });
  } catch (err: any) {
    sqliError = err;
  }
  assert(sqliError?.statusCode === 400, "Malformed order ID format rejected with status 400");

  // 4. Invalid outcome string
  let badOutcomeError: any = null;
  try {
    await processTestPayment({
      orderId: order1Id,
      outcome: "invalid_outcome" as any,
    });
  } catch (err: any) {
    badOutcomeError = err;
  }
  assert(badOutcomeError?.statusCode === 400, "Invalid outcome parameter rejected with status 400");
}

async function testDuplicatePaymentProtection() {
  console.log("\n📋 Test Suite 6: Duplicate Payment / Idempotency Protection (Test 11)");
  console.log("─".repeat(50));

  const { processTestPayment, PaymentValidationError, getPaymentsByOrderId } =
    await import("../src/lib/server/payment");

  // Order 1 is already 'paid' from Test Suite 2
  const [initCheck] = (await pool.execute(
    "SELECT payment_status FROM orders WHERE id = ?",
    [order1Id]
  )) as any;
  assert(initCheck[0].payment_status === "paid", "Order 1 is currently in 'paid' state");

  // Attempt duplicate success
  let duplicateSuccessError: any = null;
  try {
    await processTestPayment({
      orderId: order1Id,
      outcome: "success",
      amount: 1397.00,
    });
  } catch (err: any) {
    duplicateSuccessError = err;
  }

  assert(duplicateSuccessError instanceof PaymentValidationError, "Duplicate success throws PaymentValidationError");
  assert(duplicateSuccessError?.statusCode === 409, "Duplicate success returns status 409 Conflict");
  assert(
    duplicateSuccessError?.message.includes("already paid"),
    `Error message explains duplicate rejection: "${duplicateSuccessError?.message}"`
  );

  // Attempt failure on an already-paid order
  let duplicateFailureError: any = null;
  try {
    await processTestPayment({
      orderId: order1Id,
      outcome: "failure",
    });
  } catch (err: any) {
    duplicateFailureError = err;
  }

  assert(duplicateFailureError?.statusCode === 409, "Cannot fail an already-paid order (status 409)");

  // Verify in MySQL: order remains 'paid' and payments table still has exactly 1 record
  const [afterCheck] = (await pool.execute(
    "SELECT payment_status FROM orders WHERE id = ?",
    [order1Id]
  )) as any;
  assert(afterCheck[0].payment_status === "paid", "Order 1 payment_status remains uncorrupted ('paid')");

  const payments = await getPaymentsByOrderId(order1Id);
  assert(payments.length === 1, "Payments count remains strictly 1 (no duplicate record inserted)");
}

async function testFailedOrderRetrySuccess() {
  console.log("\n📋 Test Suite 7: Failed Order Retry & Multi-Payment History (Test 16)");
  console.log("─".repeat(50));

  const { processTestPayment, getPaymentsByOrderId } = await import("../src/lib/server/payment");

  // Order 2 was marked 'failed' in Test Suite 3
  const [failedCheck] = (await pool.execute(
    "SELECT payment_status FROM orders WHERE id = ?",
    [order2Id]
  )) as any;
  assert(failedCheck[0].payment_status === "failed", "Order 2 is currently in 'failed' state");

  // Customer retries payment with a successful attempt
  const retryResult = await processTestPayment({
    orderId: order2Id,
    outcome: "success",
    amount: 598.00,
  });

  assert(retryResult.success === true, "Retry payment succeeds");
  assert(retryResult.paymentStatus === "paid", "Order transitions from 'failed' to 'paid' on retry");

  // DB verification
  const [dbCheck] = (await pool.execute(
    "SELECT payment_status FROM orders WHERE id = ?",
    [order2Id]
  )) as any;
  assert(dbCheck[0].payment_status === "paid", "DB verification: orders.payment_status updated to 'paid' after successful retry");

  // History verification (Schema §3.15: An order can have multiple payment records)
  const history = await getPaymentsByOrderId(order2Id);
  assert(history.length === 2, "Order 2 now has exactly 2 payment records in audit history");
  assert(history[0].status === "failed", "First payment record reflects the failed attempt");
  assert(history[1].status === "captured", "Second payment record reflects the successful retry");
  assert(history[1].paidAt !== null, "Second payment record has a confirmed paidAt timestamp");
}

async function testApiSecurityAndB17Boundary() {
  console.log("\n📋 Test Suite 8: API Isolation & B-17 HTTP Immutability Boundary (Tests 12 & 13)");
  console.log("─".repeat(50));

  const { NextRequest } = await import("next/server");
  const { createSessionToken } = await import("../src/lib/server/auth");
  const { PATCH: adminPatch } = await import("../src/app/api/admin/orders/[id]/route");
  const { PATCH: customerPatch } = await import("../src/app/api/orders/[id]/route");

  // Create session tokens
  const adminToken = await createSessionToken({
    id: testAdminId,
    email: "b18admin@dearr.test",
    fullName: "B18 Admin",
    role: "admin",
  });

  const customerToken = await createSessionToken({
    id: testCustomerId,
    email: "b18cust@dearr.test",
    fullName: "B18 Customer",
    role: "customer",
  });

  // Test Order 3 is currently 'pending'
  const [o3Init] = (await pool.execute(
    "SELECT payment_status FROM orders WHERE id = ?",
    [order3Id]
  )) as any;
  assert(o3Init[0].payment_status === "pending", "Order 3 is in 'pending' state");

  // 1. Customer HTTP PATCH attempting to set paymentStatus = 'paid' -> 403 Forbidden
  mockSessionToken = customerToken;
  const custReq = new NextRequest(`http://localhost:3000/api/orders/${order3Id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ paymentStatus: "paid" }),
  });
  const custRes = await customerPatch(custReq, {
    params: Promise.resolve({ id: order3Id }),
  });
  assert(custRes.status === 403, "Customer PATCH /api/orders/:id returns 403 Forbidden");

  const [dbCustCheck] = (await pool.execute(
    "SELECT payment_status FROM orders WHERE id = ?",
    [order3Id]
  )) as any;
  assert(dbCustCheck[0].payment_status === "pending", "Customer HTTP request CANNOT mutate payment_status (still 'pending')");

  // 2. Admin HTTP PATCH attempting paymentStatus only -> 400 Bad Request
  mockSessionToken = adminToken;
  const adminReqOnlyPay = new NextRequest(
    `http://localhost:3000/api/admin/orders/${order3Id}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentStatus: "paid" }),
    }
  );
  const adminResOnlyPay = await adminPatch(adminReqOnlyPay, {
    params: Promise.resolve({ id: order3Id }),
  });
  assert(adminResOnlyPay.status === 400, "Admin PATCH with paymentStatus only returns 400 Bad Request");

  const [dbAdminCheck1] = (await pool.execute(
    "SELECT payment_status FROM orders WHERE id = ?",
    [order3Id]
  )) as any;
  assert(dbAdminCheck1[0].payment_status === "pending", "Admin HTTP paymentStatus-only attempt CANNOT mutate payment_status");

  // 3. Admin HTTP PATCH with status + paymentStatus -> only fulfillment status changes, paymentStatus ignored
  const adminReqCombined = new NextRequest(
    `http://localhost:3000/api/admin/orders/${order3Id}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "confirmed", paymentStatus: "paid" }),
    }
  );
  const adminResCombined = await adminPatch(adminReqCombined, {
    params: Promise.resolve({ id: order3Id }),
  });
  const adminBodyCombined = await adminResCombined.json();

  assert(adminResCombined.status === 200, "Admin PATCH with fulfillment status returns 200 OK");
  assert(adminBodyCombined.order?.status === "confirmed", "Admin fulfillment status updated to 'confirmed'");

  const [dbAdminCheck2] = (await pool.execute(
    "SELECT status, payment_status FROM orders WHERE id = ?",
    [order3Id]
  )) as any;
  assert(dbAdminCheck2[0].status === "confirmed", "DB check: fulfillment status updated to 'confirmed'");
  assert(dbAdminCheck2[0].payment_status === "pending", "DB check: payment_status is STILL 'pending' (paymentStatus was completely ignored)");

  mockSessionToken = null;
}

async function testSensitiveCredentialsAndIsolation() {
  console.log("\n📋 Test Suite 9: Sensitive Credentials Masking & Razorpay Isolation (Tests 14 & 15)");
  console.log("─".repeat(50));

  const { processTestPayment } = await import("../src/lib/server/payment");

  // Run test payment for Order 3
  const result = await processTestPayment({
    orderId: order3Id,
    outcome: "success",
    amount: 499.00,
  });

  // Verify response data contains no passwords or secret keys
  const serialized = JSON.stringify(result);
  assert(!serialized.includes(process.env.DB_PASSWORD || "never_match_default"), "Response does NOT leak DB password");
  assert(!serialized.includes("AUTH_SECRET"), "Response does NOT leak AUTH_SECRET");
  assert(!serialized.includes("SESSION_SECRET"), "Response does NOT leak SESSION_SECRET");
  assert(!serialized.includes("RAZORPAY_KEY_SECRET"), "Response does NOT leak RAZORPAY_KEY_SECRET");

  // Verify clear isolation from real Razorpay
  assert(result.paymentRecord.provider === "test", "Provider is strictly 'test', not 'razorpay'");
  assert(result.paymentRecord.providerOrderId.startsWith("test_ord_"), "Provider order ID uses 'test_ord_' prefix");
  assert(result.paymentRecord.providerPaymentId!.startsWith("test_pay_"), "Provider payment ID uses 'test_pay_' prefix");
  assert(result.paymentRecord.currency === "INR", "Payment currency is INR");
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("═".repeat(60));
  console.log("  Dearr V1 — B-18 Fake/Test Payment Verification");
  console.log("═".repeat(60));

  pool = mysql.createPool(DB_CONFIG);

  try {
    // Connectivity check
    const [connCheck] = await pool.execute("SELECT 1 AS ok");
    console.log("✅ Database connected\n");

    await cleanup();
    await seedTestData();

    await testInitialOrderState();
    await testSuccessfulPaymentFlow();
    await testFailedPaymentFlow();
    await testAmountValidation();
    await testNonexistentAndInvalidOrders();
    await testDuplicatePaymentProtection();
    await testFailedOrderRetrySuccess();
    await testApiSecurityAndB17Boundary();
    await testSensitiveCredentialsAndIsolation();

    console.log("\n" + "═".repeat(60));
    console.log(`  B-18: ${pass}/${pass + fail} TESTS PASSED`);
    console.log("═".repeat(60));

    if (fail > 0) {
      console.log("\n⚠️  Some tests failed. Review the output above.");
    } else {
      console.log("\n🎉 All tests passed! B-18 Fake/Test Payment Flow is verified.");
    }
  } catch (err) {
    console.error("\n💥 Fatal error:", err);
    fail++;
  } finally {
    await cleanup();
    await pool.end();
    process.exit(fail > 0 ? 1 : 0);
  }
}

main();
