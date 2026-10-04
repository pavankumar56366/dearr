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
  console.log("Dearr V1 — Task L-04: Razorpay Payment Settlement Audit");
  console.log("Endpoint: POST /api/payments/settle");
  console.log("Database: Hostinger MySQL");
  console.log("=================================================================\n");

  const { POST: settlePaymentHandler } = await import(
    "../src/app/api/payments/settle/route"
  );
  const { POST: verifyPaymentHandler } = await import(
    "../src/app/api/payments/verify/route"
  );
  const { PATCH: patchOrderHandler } = await import(
    "../src/app/api/orders/[id]/route"
  );
  const { createSessionToken } = await import(
    "../src/lib/server/auth"
  );

  const pool = mysql.createPool({
    host: process.env.DB_HOST || "127.0.0.1",
    port: parseInt(process.env.DB_PORT || "3306", 10),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    connectionLimit: 3,
    waitForConnections: true,
  });

  let passed = 0;
  let failed = 0;

  function assert(title: string, condition: boolean, details?: string) {
    if (condition) {
      passed++;
      console.log(`  ✓ PASS: ${title}${details ? ` (${details})` : ""}`);
    } else {
      failed++;
      console.error(`  ✗ FAIL: ${title}${details ? ` (${details})` : ""}`);
    }
  }

  // Fixture IDs
  const testRunId = Date.now().toString().slice(-6);
  const customerA_Id = crypto.randomUUID();
  const customerA_Email = `l04.test.a.${Date.now()}@dearr.test`;
  const customerB_Id = crypto.randomUUID();
  const customerB_Email = `l04.test.b.${Date.now()}@dearr.test`;

  // Order 1: Verified payment (Ready to settle)
  const order1Id = crypto.randomUUID();
  const order1Number = `ORD-L04-A-${testRunId}`;
  const order1Total = 599.0;
  const payment1Id = crypto.randomUUID();
  const rzpOrder1Id = `order_l04_v_${Date.now().toString().slice(-8)}`;
  const rzpPayment1Id = `pay_l04_v_${Date.now().toString().slice(-8)}`;

  // Order 2: 'created' unverified payment
  const order2Id = crypto.randomUUID();
  const order2Number = `ORD-L04-CREATED-${testRunId}`;
  const order2Total = 399.0;
  const payment2Id = crypto.randomUUID();
  const rzpOrder2Id = `order_l04_c_${Date.now().toString().slice(-8)}`;

  // Order 3: 'failed' payment
  const order3Id = crypto.randomUUID();
  const order3Number = `ORD-L04-FAILED-${testRunId}`;
  const order3Total = 450.0;
  const payment3Id = crypto.randomUUID();
  const rzpOrder3Id = `order_l04_f_${Date.now().toString().slice(-8)}`;

  // Order 4: Cancelled order with verified payment
  const order4Id = crypto.randomUUID();
  const order4Number = `ORD-L04-CANCELLED-${testRunId}`;
  const order4Total = 750.0;
  const payment4Id = crypto.randomUUID();
  const rzpOrder4Id = `order_l04_can_${Date.now().toString().slice(-8)}`;
  const rzpPayment4Id = `pay_l04_can_${Date.now().toString().slice(-8)}`;

  // Order 5: Refunded order
  const order5Id = crypto.randomUUID();
  const order5Number = `ORD-L04-REFUNDED-${testRunId}`;
  const order5Total = 850.0;
  const payment5Id = crypto.randomUUID();
  const rzpOrder5Id = `order_l04_ref_${Date.now().toString().slice(-8)}`;
  const rzpPayment5Id = `pay_l04_ref_${Date.now().toString().slice(-8)}`;

  // Order 6: Missing payment record
  const order6Id = crypto.randomUUID();
  const order6Number = `ORD-L04-NOPAY-${testRunId}`;
  const order6Total = 299.0;

  // Order 7: Missing provider_payment_id
  const order7Id = crypto.randomUUID();
  const order7Number = `ORD-L04-NOPAYID-${testRunId}`;
  const order7Total = 349.0;
  const payment7Id = crypto.randomUUID();
  const rzpOrder7Id = `order_l04_nopayid_${Date.now().toString().slice(-8)}`;

  // Order 8: End-to-end L-03 -> L-04 test
  const order8Id = crypto.randomUUID();
  const order8Number = `ORD-L04-E2E-${testRunId}`;
  const order8Total = 699.0;
  const payment8Id = crypto.randomUUID();
  const rzpOrder8Id = `order_l04_e2e_${Date.now().toString().slice(-8)}`;
  const rzpPayment8Id = `pay_l04_e2e_${Date.now().toString().slice(-8)}`;

  let sessionTokenA: string;
  let sessionTokenB: string;

  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keySecret) {
    throw new Error("RAZORPAY_KEY_SECRET must be set in .env.local to run tests");
  }

  function generateSignature(rzpOrderId: string, rzpPaymentId: string): string {
    return crypto
      .createHmac("sha256", keySecret!)
      .update(`${rzpOrderId}|${rzpPaymentId}`)
      .digest("hex");
  }

  try {
    console.log("Setting up test database fixtures in MySQL...");

    const passwordHash = await bcrypt.hash("Password123!", 10);

    // Create Customer A
    await pool.execute(
      `INSERT INTO profiles (id, email, password_hash, full_name, role, created_at, updated_at)
       VALUES (?, ?, ?, 'Customer A (L-04)', 'customer', NOW(), NOW())`,
      [customerA_Id, customerA_Email, passwordHash]
    );

    // Create Customer B
    await pool.execute(
      `INSERT INTO profiles (id, email, password_hash, full_name, role, created_at, updated_at)
       VALUES (?, ?, ?, 'Customer B (L-04)', 'customer', NOW(), NOW())`,
      [customerB_Id, customerB_Email, passwordHash]
    );

    sessionTokenA = await createSessionToken({
      id: customerA_Id,
      email: customerA_Email,
      fullName: "Customer A (L-04)",
      role: "customer",
    });

    sessionTokenB = await createSessionToken({
      id: customerB_Id,
      email: customerB_Email,
      fullName: "Customer B (L-04)",
      role: "customer",
    });

    // Helper to insert order
    async function insertOrder(
      id: string,
      orderNumber: string,
      userId: string,
      status: string,
      paymentStatus: string,
      total: number
    ) {
      await pool.execute(
        `INSERT INTO orders (
           id, order_number, user_id, status, payment_status,
           subtotal, discount_amount, shipping_amount, total_amount, currency,
           shipping_full_name, shipping_phone, shipping_address_line_1,
           shipping_city, shipping_state, shipping_postal_code, shipping_country,
           created_at, updated_at
         ) VALUES (
           ?, ?, ?, ?, ?,
           ?, 0, 0, ?, 'INR',
           'Customer A', '9876543210', '123 Test Street',
           'Mumbai', 'Maharashtra', '400001', 'India',
           NOW(), NOW()
         )`,
        [id, orderNumber, userId, status, paymentStatus, total, total]
      );
    }

    // Helper to insert payment
    async function insertPayment(
      id: string,
      orderId: string,
      rzpOrderId: string,
      rzpPaymentId: string | null,
      status: string,
      amount: number
    ) {
      await pool.execute(
        `INSERT INTO payments (
           id, order_id, provider, provider_order_id, provider_payment_id,
           status, amount, currency, paid_at, created_at, updated_at
         ) VALUES (
           ?, ?, 'razorpay', ?, ?,
           ?, ?, 'INR', NULL, NOW(), NOW()
         )`,
        [id, orderId, rzpOrderId, rzpPaymentId, status, amount]
      );
    }

    // Order 1: Verified payment (Ready to settle)
    await insertOrder(order1Id, order1Number, customerA_Id, "pending", "pending", order1Total);
    await insertPayment(payment1Id, order1Id, rzpOrder1Id, rzpPayment1Id, "verified", order1Total);

    // Order 2: 'created' payment
    await insertOrder(order2Id, order2Number, customerA_Id, "pending", "pending", order2Total);
    await insertPayment(payment2Id, order2Id, rzpOrder2Id, null, "created", order2Total);

    // Order 3: 'failed' payment
    await insertOrder(order3Id, order3Number, customerA_Id, "pending", "pending", order3Total);
    await insertPayment(payment3Id, order3Id, rzpOrder3Id, null, "failed", order3Total);

    // Order 4: Cancelled order
    await insertOrder(order4Id, order4Number, customerA_Id, "cancelled", "pending", order4Total);
    await insertPayment(payment4Id, order4Id, rzpOrder4Id, rzpPayment4Id, "verified", order4Total);

    // Order 5: Refunded order
    await insertOrder(order5Id, order5Number, customerA_Id, "delivered", "refunded", order5Total);
    await insertPayment(payment5Id, order5Id, rzpOrder5Id, rzpPayment5Id, "verified", order5Total);

    // Order 6: No payment record
    await insertOrder(order6Id, order6Number, customerA_Id, "pending", "pending", order6Total);

    // Order 7: Missing provider_payment_id
    await insertOrder(order7Id, order7Number, customerA_Id, "pending", "pending", order7Total);
    await insertPayment(payment7Id, order7Id, rzpOrder7Id, null, "verified", order7Total);

    // Order 8: Ready for E2E flow
    await insertOrder(order8Id, order8Number, customerA_Id, "pending", "pending", order8Total);
    await insertPayment(payment8Id, order8Id, rzpOrder8Id, null, "created", order8Total);

    console.log("✓ Fixtures created successfully.\n");

    // =========================================================================
    // SECTION 1: Endpoint Authentication & Validation
    // =========================================================================
    console.log("--- Section 1: Authentication & Request Validation ---");

    // Test 1: Unauthenticated request -> 401
    currentMockSessionToken = null;
    const resUnauth = await settlePaymentHandler(
      new Request("http://localhost:3000/api/payments/settle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: order1Id }),
      })
    );
    const dataUnauth = await resUnauth.json();
    assert(
      "Unauthenticated settlement request is rejected with HTTP 401",
      resUnauth.status === 401 && dataUnauth.ok === false,
      `Status: ${resUnauth.status}`
    );

    // Test 2: Missing orderId -> 400
    currentMockSessionToken = sessionTokenA;
    const resMissingOrderId = await settlePaymentHandler(
      new Request("http://localhost:3000/api/payments/settle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
    );
    const dataMissingOrderId = await resMissingOrderId.json();
    assert(
      "Missing orderId rejected with HTTP 400",
      resMissingOrderId.status === 400 && dataMissingOrderId.ok === false
    );

    // Test 3: Nonexistent order -> 404
    const fakeOrderId = crypto.randomUUID();
    const resNonexistent = await settlePaymentHandler(
      new Request("http://localhost:3000/api/payments/settle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: fakeOrderId }),
      })
    );
    const dataNonexistent = await resNonexistent.json();
    assert(
      "Nonexistent internal order rejected with HTTP 404",
      resNonexistent.status === 404 && dataNonexistent.ok === false
    );

    // =========================================================================
    // SECTION 2: Authorization & IDOR Protection
    // =========================================================================
    console.log("\n--- Section 2: Authorization & IDOR Protection ---");

    // Test 4: Cross-customer settlement rejected -> 403 Forbidden
    currentMockSessionToken = sessionTokenB; // Customer B trying to settle Customer A's order
    const resIdor = await settlePaymentHandler(
      new Request("http://localhost:3000/api/payments/settle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: order1Id }),
      })
    );
    const dataIdor = await resIdor.json();
    assert(
      "Cross-customer settlement (IDOR attempt) is rejected with HTTP 403",
      resIdor.status === 403 && dataIdor.ok === false,
      `Status: ${resIdor.status}`
    );

    // =========================================================================
    // SECTION 3: Settleable Payment Status Requirements
    // =========================================================================
    console.log("\n--- Section 3: Settleable Payment Status Requirements ---");

    currentMockSessionToken = sessionTokenA;

    // Test 5: 'created' unverified payment cannot settle order -> 400
    const resCreated = await settlePaymentHandler(
      new Request("http://localhost:3000/api/payments/settle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: order2Id }),
      })
    );
    const dataCreated = await resCreated.json();
    assert(
      "'created' (unverified) payment cannot settle order (HTTP 400)",
      resCreated.status === 400 && dataCreated.ok === false,
      `Error: ${dataCreated.error}`
    );

    // Test 6: 'failed' payment cannot settle order -> 400
    const resFailed = await settlePaymentHandler(
      new Request("http://localhost:3000/api/payments/settle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: order3Id }),
      })
    );
    const dataFailed = await resFailed.json();
    assert(
      "'failed' payment cannot settle order (HTTP 400)",
      resFailed.status === 400 && dataFailed.ok === false,
      `Error: ${dataFailed.error}`
    );

    // Test 7: Missing payment record rejected -> 404
    const resNoPay = await settlePaymentHandler(
      new Request("http://localhost:3000/api/payments/settle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: order6Id }),
      })
    );
    const dataNoPay = await resNoPay.json();
    assert(
      "Order with missing payment record rejected with HTTP 404",
      resNoPay.status === 404 && dataNoPay.ok === false
    );

    // Test 8: Missing provider_payment_id rejected -> 400
    const resNoPayId = await settlePaymentHandler(
      new Request("http://localhost:3000/api/payments/settle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: order7Id }),
      })
    );
    const dataNoPayId = await resNoPayId.json();
    assert(
      "Payment record missing verified payment ID rejected with HTTP 400",
      resNoPayId.status === 400 && dataNoPayId.ok === false
    );

    // Test 9: Mismatched Razorpay order ID rejected -> 400
    const resWrongRzpOrderId = await settlePaymentHandler(
      new Request("http://localhost:3000/api/payments/settle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: order1Id,
          razorpay_order_id: "order_wrong_rzp_order_id_123",
        }),
      })
    );
    const dataWrongRzpOrderId = await resWrongRzpOrderId.json();
    assert(
      "Wrong Razorpay order ID association rejected with HTTP 400",
      resWrongRzpOrderId.status === 400 && dataWrongRzpOrderId.ok === false
    );

    // Test 10: Mismatched payment ID rejected -> 400 (tampering / hijacking attempt)
    const resWrongPayId = await settlePaymentHandler(
      new Request("http://localhost:3000/api/payments/settle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: order1Id,
          razorpay_payment_id: "pay_different_payment_id_hijack",
        }),
      })
    );
    const dataWrongPayId = await resWrongPayId.json();
    assert(
      "Different payment ID cannot hijack an order (HTTP 400)",
      resWrongPayId.status === 400 && dataWrongPayId.ok === false
    );

    // =========================================================================
    // SECTION 4: Terminal / Invalid Order State Protection
    // =========================================================================
    console.log("\n--- Section 4: Terminal Order State Protection ---");

    // Test 11: Cancelled order cannot be settled -> 400
    const resCancelled = await settlePaymentHandler(
      new Request("http://localhost:3000/api/payments/settle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: order4Id }),
      })
    );
    const dataCancelled = await resCancelled.json();
    assert(
      "Cancelled order cannot be marked paid (HTTP 400)",
      resCancelled.status === 400 && dataCancelled.ok === false
    );

    // Test 12: Refunded order cannot be settled -> 400
    const resRefunded = await settlePaymentHandler(
      new Request("http://localhost:3000/api/payments/settle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: order5Id }),
      })
    );
    const dataRefunded = await resRefunded.json();
    assert(
      "Refunded order cannot be marked paid (HTTP 400)",
      resRefunded.status === 400 && dataRefunded.ok === false
    );

    // Test 13: Client-supplied amount mismatch rejected -> 400
    const resAmountMismatch = await settlePaymentHandler(
      new Request("http://localhost:3000/api/payments/settle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: order1Id, amount: 1.0 }),
      })
    );
    const dataAmountMismatch = await resAmountMismatch.json();
    assert(
      "Client-supplied amount mismatch rejected with HTTP 400",
      resAmountMismatch.status === 400 && dataAmountMismatch.ok === false
    );

    // Test 14: Client cannot directly force payment_status=paid on orders endpoint
    // Testing PATCH /api/orders/[id] with { payment_status: 'paid' } as customer -> 403 Forbidden
    const resDirectForce = await patchOrderHandler(
      new Request(`http://localhost:3000/api/orders/${order1Id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payment_status: "paid", paymentStatus: "paid" }),
      }) as any,
      { params: Promise.resolve({ id: order1Id }) }
    );
    assert(
      "Client cannot directly force payment_status=paid on orders route (HTTP 403)",
      resDirectForce.status === 403,
      `Status: ${resDirectForce.status}`
    );

    // =========================================================================
    // SECTION 5: Legitimate Settlement & Database Transitions
    // =========================================================================
    console.log("\n--- Section 5: Legitimate Settlement & Database State Transition ---");

    // Test 15: Valid verified payment settles order to paid -> 200 OK
    const resSettleSuccess = await settlePaymentHandler(
      new Request("http://localhost:3000/api/payments/settle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: order1Id }),
      })
    );
    const dataSettleSuccess = await resSettleSuccess.json();
    assert(
      "Valid verified payment settles order with HTTP 200",
      resSettleSuccess.status === 200 &&
        dataSettleSuccess.ok === true &&
        dataSettleSuccess.settled === true &&
        dataSettleSuccess.paymentStatus === "paid",
      `paymentStatus: ${dataSettleSuccess.paymentStatus}`
    );

    // Test 16: MySQL database state verification after settlement
    const [dbOrdersAfter] = (await pool.execute(
      "SELECT id, payment_status, status FROM orders WHERE id = ?",
      [order1Id]
    )) as any[];

    assert(
      "MySQL orders.payment_status transitioned strictly to 'paid'",
      dbOrdersAfter.length === 1 && dbOrdersAfter[0].payment_status === "paid",
      `orders.payment_status: ${dbOrdersAfter[0]?.payment_status}`
    );

    assert(
      "Fulfillment status is preserved without unintended mutations (remains 'pending')",
      dbOrdersAfter.length === 1 && dbOrdersAfter[0].status === "pending",
      `orders.status: ${dbOrdersAfter[0]?.status}`
    );

    const [dbPaymentsAfter] = (await pool.execute(
      "SELECT id, status, paid_at FROM payments WHERE id = ?",
      [payment1Id]
    )) as any[];

    assert(
      "MySQL payments table recorded paid_at timestamp on settlement",
      dbPaymentsAfter.length === 1 && dbPaymentsAfter[0].paid_at !== null,
      `paid_at: ${dbPaymentsAfter[0]?.paid_at}`
    );

    // =========================================================================
    // SECTION 6: Idempotency & Repeat Settlement
    // =========================================================================
    console.log("\n--- Section 6: Idempotency & Repeat Requests ---");

    // Test 17: Duplicate settlement request succeeds idempotently -> 200 OK
    const resDuplicateSettle = await settlePaymentHandler(
      new Request("http://localhost:3000/api/payments/settle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: order1Id }),
      })
    );
    const dataDuplicateSettle = await resDuplicateSettle.json();
    assert(
      "Duplicate settlement request is idempotent (HTTP 200, isExisting: true)",
      resDuplicateSettle.status === 200 &&
        dataDuplicateSettle.ok === true &&
        dataDuplicateSettle.settled === true &&
        dataDuplicateSettle.isExisting === true
    );

    // Test 18: Duplicate settlement attempt with mismatched payment ID rejected -> 409
    const resDuplicateMismatchedId = await settlePaymentHandler(
      new Request("http://localhost:3000/api/payments/settle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: order1Id,
          razorpay_payment_id: "pay_different_payment_id_hijack",
        }),
      })
    );
    const dataDuplicateMismatchedId = await resDuplicateMismatchedId.json();
    assert(
      "Already-paid order settlement with different payment ID rejected with HTTP 409",
      resDuplicateMismatchedId.status === 409 && dataDuplicateMismatchedId.ok === false
    );

    // =========================================================================
    // SECTION 7: End-to-End L-03 -> L-04 Flow & Boundary Check
    // =========================================================================
    console.log("\n--- Section 7: End-to-End L-03 -> L-04 Flow & Strict Boundary Check ---");

    // Step A: Verify via L-03
    const sig8 = generateSignature(rzpOrder8Id, rzpPayment8Id);
    const resVerify8 = await verifyPaymentHandler(
      new Request("http://localhost:3000/api/payments/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: order8Id,
          razorpay_order_id: rzpOrder8Id,
          razorpay_payment_id: rzpPayment8Id,
          razorpay_signature: sig8,
        }),
      })
    );
    const dataVerify8 = await resVerify8.json();
    assert(
      "Step A (L-03): Payment signature verified successfully (HTTP 200)",
      resVerify8.status === 200 && dataVerify8.ok === true && dataVerify8.verified === true
    );

    // Step B: Regression check: L-03 leaves the order pending!
    const [dbOrder8Mid] = (await pool.execute(
      "SELECT id, payment_status FROM orders WHERE id = ?",
      [order8Id]
    )) as any[];

    assert(
      "Step B (L-03 Boundary): Order payment_status strictly remains 'pending' after L-03 verification",
      dbOrder8Mid[0].payment_status === "pending",
      `orders.payment_status: ${dbOrder8Mid[0].payment_status}`
    );

    // Step C: Settle via L-04
    const resSettle8 = await settlePaymentHandler(
      new Request("http://localhost:3000/api/payments/settle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: order8Id }),
      })
    );
    const dataSettle8 = await resSettle8.json();
    assert(
      "Step C (L-04): Settle endpoint successfully marks order as paid",
      resSettle8.status === 200 &&
        dataSettle8.ok === true &&
        dataSettle8.settled === true &&
        dataSettle8.paymentStatus === "paid"
    );

    // Step D: Final DB verification of order 8
    const [dbOrder8Final] = (await pool.execute(
      "SELECT id, payment_status FROM orders WHERE id = ?",
      [order8Id]
    )) as any[];

    assert(
      "Step D: End-to-end flow confirmed: order payment_status is 'paid' after L-04 settlement",
      dbOrder8Final[0].payment_status === "paid"
    );

    // =========================================================================
    // SECTION 8: Security & Secret Leakage Prevention
    // =========================================================================
    console.log("\n--- Section 8: Information Leakage & Secret Sanitization ---");

    const responsePayloadStr = JSON.stringify(dataSettleSuccess);
    const errorPayloadStr = JSON.stringify(dataCreated);

    assert(
      "No Razorpay Key Secret in settlement response",
      !responsePayloadStr.includes(keySecret) && !errorPayloadStr.includes(keySecret),
      "Secret leaked: false"
    );

    const dbPassword = process.env.DB_PASSWORD || process.env.MYSQL_PASSWORD;
    assert(
      "No database passwords in settlement response",
      !dbPassword ||
        (!responsePayloadStr.includes(dbPassword) &&
          !errorPayloadStr.includes(dbPassword)),
      "DB password leaked: false"
    );

    assert(
      "No password hashes in settlement response",
      !responsePayloadStr.includes("$2a$") && !responsePayloadStr.includes("$2b$"),
      "Password hash leaked: false"
    );

    assert(
      "No SQL statements or internal stack traces in settlement response",
      !responsePayloadStr.includes("SELECT") &&
        !responsePayloadStr.includes("UPDATE") &&
        !errorPayloadStr.includes("SELECT") &&
        !errorPayloadStr.includes("UPDATE") &&
        !errorPayloadStr.includes("stack"),
      "Internal SQL/traces leaked: false"
    );

  } finally {
    console.log("\nCleaning up temporary test fixtures from MySQL...");
    try {
      await pool.execute(
        "DELETE FROM payments WHERE order_id IN (?, ?, ?, ?, ?, ?, ?, ?)",
        [
          order1Id,
          order2Id,
          order3Id,
          order4Id,
          order5Id,
          order6Id,
          order7Id,
          order8Id,
        ]
      );
      await pool.execute(
        "DELETE FROM orders WHERE id IN (?, ?, ?, ?, ?, ?, ?, ?)",
        [
          order1Id,
          order2Id,
          order3Id,
          order4Id,
          order5Id,
          order6Id,
          order7Id,
          order8Id,
        ]
      );
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
  console.log("L-04 PAYMENT SETTLEMENT AUDIT SUMMARY");
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
