import fs from "fs";
import path from "path";
import crypto from "crypto";
import mysql from "mysql2/promise";
import bcrypt from "bcryptjs";

// In standalone node scripts outside Next.js bundler, mock server-only and next/headers
require.cache[require.resolve("server-only")] = {
  id: require.resolve("server-only"),
  filename: require.resolve("server-only"),
  loaded: true,
  exports: {},
} as any;

let currentMockSessionToken: string | null = null;

require.cache[require.resolve("next/headers")] = {
  id: require.resolve("next/headers"),
  filename: require.resolve("next/headers"),
  loaded: true,
  exports: {
    cookies: async () => ({
      get: (name: string) =>
        name === "dearr_session" && currentMockSessionToken
          ? { name, value: currentMockSessionToken }
          : undefined,
      set: () => {},
      delete: () => {},
    }),
  },
} as any;

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

async function runAudit() {
  console.log("=================================================================");
  console.log("Dearr V1 — Task L-02: Razorpay Payment Creation Endpoint Audit");
  console.log("Endpoint: POST /api/payments/create");
  console.log("Database: Hostinger MySQL");
  console.log("=================================================================\n");

  const { POST: createPaymentHandler } = await import(
    "../src/app/api/payments/create/route"
  );
  const { createSessionToken } = await import("../src/lib/server/auth");
  const { getRazorpayClient } = await import("../src/lib/server/razorpay");

  const pool = mysql.createPool({
    host: process.env.DB_HOST || "127.0.0.1",
    port: parseInt(process.env.DB_PORT || "3306", 10),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    connectionLimit: 2,
    waitForConnections: true,
  });

  let passed = 0;
  let failed = 0;

  function assert(title: string, condition: boolean, details?: string) {
    if (condition) {
      console.log(`   [✓ PASS] ${title}${details ? ` — ${details}` : ""}`);
      passed++;
    } else {
      console.error(`   [✗ FAIL] ${title}${details ? ` — ${details}` : ""}`);
      failed++;
    }
  }

  // Generate test fixtures
  const testRunId = Date.now();
  const customerA_Id = crypto.randomUUID();
  const customerB_Id = crypto.randomUUID();
  const customerA_Email = `qa_cust_a_${testRunId}@dearr.test`;
  const customerB_Email = `qa_cust_b_${testRunId}@dearr.test`;

  const order1Id = crypto.randomUUID();
  const order1Number = `DEAR-QA${testRunId.toString().slice(-4)}1`;
  const order1Amount = 499.00;

  const order2Id = crypto.randomUUID();
  const order2Number = `DEAR-QA${testRunId.toString().slice(-4)}2`;

  const paidOrderId = crypto.randomUUID();
  const paidOrderNumber = `DEAR-QA${testRunId.toString().slice(-4)}3`;

  const cancelledOrderId = crypto.randomUUID();
  const cancelledOrderNumber = `DEAR-QA${testRunId.toString().slice(-4)}4`;

  let tokenCustomerA = "";
  let tokenCustomerB = "";

  try {
    console.log("Setting up temporary test fixtures in MySQL...");
    const hashedPassword = await bcrypt.hash("TestPass123!", 10);

    // Insert customer profiles
    await pool.execute(
      `INSERT INTO profiles (id, email, password_hash, full_name, role, created_at, updated_at)
       VALUES (?, ?, ?, 'QA Customer A', 'customer', NOW(), NOW()),
              (?, ?, ?, 'QA Customer B', 'customer', NOW(), NOW())`,
      [customerA_Id, customerA_Email, hashedPassword, customerB_Id, customerB_Email, hashedPassword]
    );

    tokenCustomerA = await createSessionToken({
      id: customerA_Id,
      email: customerA_Email,
      fullName: "QA Customer A",
      role: "customer",
    });

    tokenCustomerB = await createSessionToken({
      id: customerB_Id,
      email: customerB_Email,
      fullName: "QA Customer B",
      role: "customer",
    });

    // Insert Orders
    // Order 1: Belongs to Customer A (Payable, Pending)
    await pool.execute(
      `INSERT INTO orders (
         id, order_number, user_id, status, payment_status, subtotal, discount_amount, shipping_amount, total_amount, currency,
         shipping_full_name, shipping_phone, shipping_address_line_1, shipping_city, shipping_state, shipping_postal_code, created_at, updated_at
       ) VALUES (?, ?, ?, 'pending', 'pending', ?, 0.00, 0.00, ?, 'INR',
         'QA Recipient A', '9876543210', '123 Test St', 'Bengaluru', 'Karnataka', '560001', NOW(), NOW())`,
      [order1Id, order1Number, customerA_Id, order1Amount, order1Amount]
    );

    // Order 2: Belongs to Customer B
    await pool.execute(
      `INSERT INTO orders (
         id, order_number, user_id, status, payment_status, subtotal, discount_amount, shipping_amount, total_amount, currency,
         shipping_full_name, shipping_phone, shipping_address_line_1, shipping_city, shipping_state, shipping_postal_code, created_at, updated_at
       ) VALUES (?, ?, ?, 'pending', 'pending', 799.00, 0.00, 0.00, 799.00, 'INR',
         'QA Recipient B', '9876543210', '456 Other St', 'Mumbai', 'Maharashtra', '400001', NOW(), NOW())`,
      [order2Id, order2Number, customerB_Id]
    );

    // Paid Order: Belongs to Customer A (already paid)
    await pool.execute(
      `INSERT INTO orders (
         id, order_number, user_id, status, payment_status, subtotal, discount_amount, shipping_amount, total_amount, currency,
         shipping_full_name, shipping_phone, shipping_address_line_1, shipping_city, shipping_state, shipping_postal_code, created_at, updated_at
       ) VALUES (?, ?, ?, 'processing', 'paid', 350.00, 0.00, 0.00, 350.00, 'INR',
         'QA Recipient A', '9876543210', '123 Test St', 'Bengaluru', 'Karnataka', '560001', NOW(), NOW())`,
      [paidOrderId, paidOrderNumber, customerA_Id]
    );

    // Cancelled Order: Belongs to Customer A (cancelled)
    await pool.execute(
      `INSERT INTO orders (
         id, order_number, user_id, status, payment_status, subtotal, discount_amount, shipping_amount, total_amount, currency,
         shipping_full_name, shipping_phone, shipping_address_line_1, shipping_city, shipping_state, shipping_postal_code, created_at, updated_at
       ) VALUES (?, ?, ?, 'cancelled', 'pending', 600.00, 0.00, 0.00, 600.00, 'INR',
         'QA Recipient A', '9876543210', '123 Test St', 'Bengaluru', 'Karnataka', '560001', NOW(), NOW())`,
      [cancelledOrderId, cancelledOrderNumber, customerA_Id]
    );

    console.log("✓ Fixtures seeded successfully.\n");

    // =========================================================================
    // SECTION 1: Authentication & Authorization Tests
    // =========================================================================
    console.log("--- Section 1: Authentication & Authorization ---");

    // Test 1: Unauthenticated request returns 401
    currentMockSessionToken = null;
    const resUnauth = await createPaymentHandler(
      new Request("http://localhost:3000/api/payments/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: order1Id }),
      })
    );
    assert(
      "Unauthenticated request returns 401 Unauthorized",
      resUnauth.status === 401,
      `Status: ${resUnauth.status}`
    );

    // Test 2: Customer B attempting to pay for Customer A's order returns 403 Forbidden (IDOR)
    currentMockSessionToken = tokenCustomerB;
    const resIdor = await createPaymentHandler(
      new Request("http://localhost:3000/api/payments/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: order1Id }),
      })
    );
    const dataIdor = await resIdor.json();
    assert(
      "Customer cannot create payment order for another customer's order (403 Forbidden)",
      resIdor.status === 403 && dataIdor.ok === false,
      `Status: ${resIdor.status}, Error: "${dataIdor.error}"`
    );

    // =========================================================================
    // SECTION 2: Real Razorpay Test Mode Order Creation & Persistence
    // =========================================================================
    console.log("\n--- Section 2: Real Razorpay Test Mode Order Creation ---");

    // Test 3: Customer A creates payment order for own order
    currentMockSessionToken = tokenCustomerA;
    const resCreate = await createPaymentHandler(
      new Request("http://localhost:3000/api/payments/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: order1Id }),
      })
    );
    const dataCreate = await resCreate.json();

    assert(
      "Customer can create Razorpay payment order for their own order (201 Created)",
      resCreate.status === 201 && dataCreate.ok === true,
      `Status: ${resCreate.status}`
    );

    assert(
      "Returned Razorpay order ID is valid format (starts with 'order_')",
      typeof dataCreate.razorpayOrderId === "string" &&
        dataCreate.razorpayOrderId.startsWith("order_"),
      `Razorpay Order ID: ${dataCreate.razorpayOrderId}`
    );

    assert(
      "Returned amount in paise matches trusted order total (₹499.00 = 49900 paise)",
      dataCreate.amountInPaise === 49900 && dataCreate.amount === 499.00,
      `Amount: ₹${dataCreate.amount}, Paise: ${dataCreate.amountInPaise}`
    );

    assert(
      "Returned currency is INR",
      dataCreate.currency === "INR",
      `Currency: ${dataCreate.currency}`
    );

    assert(
      "Returned public Key ID matches configured test key (starts with 'rzp_test_')",
      typeof dataCreate.keyId === "string" && dataCreate.keyId.startsWith("rzp_test_"),
      `Key ID Prefix: ${dataCreate.keyId.slice(0, 9)}...`
    );

    // Test 4: Database persistence in MySQL payments table
    const [paymentRows] = (await pool.execute(
      "SELECT * FROM payments WHERE order_id = ? AND provider = 'razorpay'",
      [order1Id]
    )) as any[];

    assert(
      "Payment record successfully persisted in MySQL with provider = 'razorpay'",
      paymentRows.length === 1 && paymentRows[0].provider === "razorpay",
      `Persisted records: ${paymentRows.length}`
    );

    const savedPayment = paymentRows[0];
    assert(
      "Persisted provider_order_id matches returned Razorpay order ID",
      savedPayment.provider_order_id === dataCreate.razorpayOrderId,
      `Saved provider_order_id: ${savedPayment.provider_order_id}`
    );

    assert(
      "Persisted payment status is 'created' (NOT marked paid!)",
      savedPayment.status === "created" && savedPayment.paid_at === null,
      `Payment status: ${savedPayment.status}, paid_at: ${savedPayment.paid_at}`
    );

    // Test 5: Verify internal order status remains untouched
    const [updatedOrderRows] = (await pool.execute(
      "SELECT status, payment_status, total_amount FROM orders WHERE id = ?",
      [order1Id]
    )) as any[];
    const updatedOrder = updatedOrderRows[0];

    assert(
      "Internal order payment_status remains strictly 'pending' (NOT marked as paid)",
      updatedOrder.payment_status === "pending",
      `Order payment_status: ${updatedOrder.payment_status}`
    );

    assert(
      "Internal order fulfillment status remains 'pending'",
      updatedOrder.status === "pending",
      `Order status: ${updatedOrder.status}`
    );

    assert(
      "Internal order total_amount remains strictly unchanged",
      Number(updatedOrder.total_amount) === 499.00,
      `Total: ₹${updatedOrder.total_amount}`
    );

    // =========================================================================
    // SECTION 3: Idempotency & Repeated Request Handling
    // =========================================================================
    console.log("\n--- Section 3: Idempotency & Repeated Requests ---");

    // Test 6: Repeated request for same order reuses existing Razorpay order ID
    const resRepeat = await createPaymentHandler(
      new Request("http://localhost:3000/api/payments/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: order1Id }),
      })
    );
    const dataRepeat = await resRepeat.json();

    assert(
      "Repeated request successfully reuses existing Razorpay order ID (idempotency)",
      resRepeat.status === 201 &&
        dataRepeat.razorpayOrderId === dataCreate.razorpayOrderId &&
        dataRepeat.isExisting === true,
      `Reused order ID: ${dataRepeat.razorpayOrderId}, isExisting: ${dataRepeat.isExisting}`
    );

    const [allPaymentRows] = (await pool.execute(
      "SELECT id FROM payments WHERE order_id = ? AND provider = 'razorpay'",
      [order1Id]
    )) as any[];

    assert(
      "No duplicate payment rows created in MySQL for repeated request",
      allPaymentRows.length === 1,
      `Total payment rows: ${allPaymentRows.length}`
    );

    // =========================================================================
    // SECTION 4: Amount Tampering, Validation & State Machine Rejections
    // =========================================================================
    console.log("\n--- Section 4: Amount Tampering & State Machine Checks ---");

    // Test 7: Client-supplied mismatched amount is rejected with 400 Bad Request
    const resTamper = await createPaymentHandler(
      new Request("http://localhost:3000/api/payments/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: order1Id, amount: 99.00 }),
      })
    );
    const dataTamper = await resTamper.json();
    assert(
      "Client-supplied mismatched amount is rejected (400 Bad Request)",
      resTamper.status === 400 && dataTamper.ok === false,
      `Status: ${resTamper.status}, Error: "${dataTamper.error}"`
    );

    // Test 8: Nonexistent order returns 404 Not Found
    const fakeOrderId = crypto.randomUUID();
    const resNotFound = await createPaymentHandler(
      new Request("http://localhost:3000/api/payments/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: fakeOrderId }),
      })
    );
    assert(
      "Nonexistent order returns 404 Not Found",
      resNotFound.status === 404,
      `Status: ${resNotFound.status}`
    );

    // Test 9: Already paid order rejected with 409 Conflict
    const resPaid = await createPaymentHandler(
      new Request("http://localhost:3000/api/payments/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: paidOrderId }),
      })
    );
    const dataPaid = await resPaid.json();
    assert(
      "Already paid order rejected safely with 409 Conflict",
      resPaid.status === 409 && dataPaid.ok === false,
      `Status: ${resPaid.status}, Error: "${dataPaid.error}"`
    );

    // Test 10: Cancelled order rejected with 400 Bad Request
    const resCancelled = await createPaymentHandler(
      new Request("http://localhost:3000/api/payments/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: cancelledOrderId }),
      })
    );
    const dataCancelled = await resCancelled.json();
    assert(
      "Cancelled order rejected safely with 400 Bad Request",
      resCancelled.status === 400 && dataCancelled.ok === false,
      `Status: ${resCancelled.status}, Error: "${dataCancelled.error}"`
    );

    // Test 11: Malformed order reference rejected with 400 Bad Request
    const resMalformed = await createPaymentHandler(
      new Request("http://localhost:3000/api/payments/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: "   " }),
      })
    );
    assert(
      "Malformed/empty order reference rejected with 400 Bad Request",
      resMalformed.status === 400,
      `Status: ${resMalformed.status}`
    );

    // =========================================================================
    // SECTION 5: Razorpay Test Mode Live Order Verification
    // =========================================================================
    console.log("\n--- Section 5: Razorpay Gateway Remote Order Verification ---");

    // Test 12: Query Razorpay Test API using official client to verify order exists on Razorpay
    const razorpayClient = getRazorpayClient();
    let rzpRemoteOrder: any = null;
    try {
      rzpRemoteOrder = await razorpayClient.orders.fetch(dataCreate.razorpayOrderId);
    } catch (err: any) {
      console.error("Failed to fetch order from Razorpay Test API:", err);
    }

    assert(
      "Order verified directly on Razorpay Test API servers",
      rzpRemoteOrder !== null && rzpRemoteOrder.id === dataCreate.razorpayOrderId,
      `Remote ID: ${rzpRemoteOrder?.id}, Status: ${rzpRemoteOrder?.status}`
    );

    assert(
      "Remote Razorpay order amount matches paise calculation exactly (49900)",
      rzpRemoteOrder?.amount === 49900 && rzpRemoteOrder?.currency === "INR",
      `Remote Amount: ${rzpRemoteOrder?.amount} ${rzpRemoteOrder?.currency}`
    );

    // =========================================================================
    // SECTION 6: Secret & Error Safety Verification
    // =========================================================================
    console.log("\n--- Section 6: Security & Leakage Prevention ---");

    const rawResponseText = JSON.stringify(dataCreate);
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    assert(
      "API response does NOT leak RAZORPAY_KEY_SECRET",
      keySecret ? !rawResponseText.includes(keySecret) : true,
      "Key secret leaked: false"
    );

    assert(
      "API response does NOT leak database password or connection details",
      !rawResponseText.includes(process.env.DB_PASSWORD || "impossible_db_pwd") &&
        !rawResponseText.includes("u209580425_dearr_user"),
      "Database credentials leaked: false"
    );

    assert(
      "Error responses do NOT leak SQL statements or stack traces",
      !JSON.stringify(dataTamper).includes("SELECT") &&
        !JSON.stringify(dataTamper).includes("INSERT") &&
        !JSON.stringify(dataPaid).includes("stack"),
      "Internal SQL/traces leaked: false"
    );

  } finally {
    console.log("\nCleaning up temporary test fixtures from MySQL...");
    try {
      await pool.execute("DELETE FROM payments WHERE order_id IN (?, ?, ?, ?)", [
        order1Id,
        order2Id,
        paidOrderId,
        cancelledOrderId,
      ]);
      await pool.execute("DELETE FROM orders WHERE id IN (?, ?, ?, ?)", [
        order1Id,
        order2Id,
        paidOrderId,
        cancelledOrderId,
      ]);
      await pool.execute("DELETE FROM profiles WHERE id IN (?, ?)", [
        customerA_Id,
        customerB_Id,
      ]);
      console.log("✓ Fixtures cleaned up successfully.");
    } catch (cleanupErr) {
      console.error("Cleanup error:", cleanupErr);
    }
    await pool.end();
  }

  console.log("\n=================================================================");
  console.log("L-02 PAYMENT CREATION AUDIT SUMMARY");
  console.log("=================================================================");
  console.log(`TOTAL TESTS:  ${passed + failed}`);
  console.log(`PASSED:       ${passed}`);
  console.log(`FAILED:       ${failed}`);
  console.log("=================================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runAudit().catch((err) => {
  console.error("Unexpected error in audit runner:", err);
  process.exit(1);
});
