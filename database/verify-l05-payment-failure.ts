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
  console.log("Dearr V1 — Task L-05: Razorpay Payment Failure, Cancellation,");
  console.log("Delayed/Unknown Status, Amount Mismatch & Reconciliation Audit");
  console.log("Database: Hostinger MySQL");
  console.log("=================================================================\n");

  const { POST: failPaymentHandler } = await import(
    "../src/app/api/payments/fail/route"
  );
  const { POST: cancelPaymentHandler } = await import(
    "../src/app/api/payments/cancel/route"
  );
  const { POST: reconcilePaymentHandler } = await import(
    "../src/app/api/payments/reconcile/route"
  );
  const { POST: settlePaymentHandler } = await import(
    "../src/app/api/payments/settle/route"
  );
  const { POST: verifyPaymentHandler } = await import(
    "../src/app/api/payments/verify/route"
  );
  const { PATCH: patchOrderHandler } = await import(
    "../src/app/api/orders/[id]/route"
  );
  const { createRazorpayPaymentOrder } = await import(
    "../src/lib/server/payment"
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
    connectionLimit: 4,
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

  const testRunId = Date.now().toString().slice(-6);
  const customerA_Id = crypto.randomUUID();
  const customerA_Email = `l05.test.a.${Date.now()}@dearr.test`;
  const customerB_Id = crypto.randomUUID();
  const customerB_Email = `l05.test.b.${Date.now()}@dearr.test`;

  // Fixture Order IDs
  const order1Id = crypto.randomUUID(); // For payment failure test
  const order1Number = `ORD-L05-FAIL-${testRunId}`;
  const rzpOrder1 = `order_l05_fail_${testRunId}`;
  const rzpPay1 = `pay_l05_fail_${testRunId}`;

  const order2Id = crypto.randomUUID(); // For cancellation test
  const order2Number = `ORD-L05-CANCEL-${testRunId}`;
  const rzpOrder2 = `order_l05_cancel_${testRunId}`;

  const order3Id = crypto.randomUUID(); // For delayed/unknown status reconciliation
  const order3Number = `ORD-L05-DELAY-${testRunId}`;
  const rzpOrder3 = `order_l05_delay_${testRunId}`;

  const order4Id = crypto.randomUUID(); // For retry flow
  const order4Number = `ORD-L05-RETRY-${testRunId}`;
  const rzpOrder4_1 = `order_l05_r1_${testRunId}`;
  const rzpPay4_1 = `pay_l05_r1_${testRunId}`;
  const rzpOrder4_2 = `order_l05_r2_${testRunId}`;
  const rzpPay4_2 = `pay_l05_r2_${testRunId}`;

  const order5Id = crypto.randomUUID(); // Already paid order
  const order5Number = `ORD-L05-PAID-${testRunId}`;
  const rzpOrder5 = `order_l05_paid_${testRunId}`;
  const rzpPay5 = `pay_l05_paid_${testRunId}`;

  const order6Id = crypto.randomUUID(); // For verified payment protection
  const order6Number = `ORD-L05-VERIFIED-${testRunId}`;
  const rzpOrder6 = `order_l05_v_${testRunId}`;
  const rzpPay6 = `pay_l05_v_${testRunId}`;

  const order7Id = crypto.randomUUID(); // Customer B order for cross-customer IDOR
  const order7Number = `ORD-L05-IDOR-${testRunId}`;
  const rzpOrder7 = `order_l05_idor_${testRunId}`;

  let sessionTokenA: string;
  let sessionTokenB: string;

  try {
    // 1. Setup test users and orders
    const passwordHash = await bcrypt.hash("Password123!", 4);

    await pool.execute(
      `INSERT INTO profiles (id, email, password_hash, full_name, phone, role, created_at, updated_at)
       VALUES (?, ?, ?, 'Customer L05 A', '9876543210', 'customer', NOW(), NOW())`,
      [customerA_Id, customerA_Email, passwordHash]
    );

    await pool.execute(
      `INSERT INTO profiles (id, email, password_hash, full_name, phone, role, created_at, updated_at)
       VALUES (?, ?, ?, 'Customer L05 B', '9876543211', 'customer', NOW(), NOW())`,
      [customerB_Id, customerB_Email, passwordHash]
    );

    sessionTokenA = await createSessionToken({
      id: customerA_Id,
      email: customerA_Email,
      fullName: "Customer L05 A",
      role: "customer",
    });

    sessionTokenB = await createSessionToken({
      id: customerB_Id,
      email: customerB_Email,
      fullName: "Customer L05 B",
      role: "customer",
    });

    // Insert Order 1: pending with created payment
    await pool.execute(
      `INSERT INTO orders (id, order_number, user_id, status, payment_status, total_amount, currency, subtotal, discount_amount, shipping_amount, created_at, updated_at)
       VALUES (?, ?, ?, 'pending', 'pending', 499.00, 'INR', 499.00, 0, 0, NOW(), NOW())`,
      [order1Id, order1Number, customerA_Id]
    );
    await pool.execute(
      `INSERT INTO payments (id, order_id, provider, provider_order_id, status, amount, currency, created_at, updated_at)
       VALUES (?, ?, 'razorpay', ?, 'created', 499.00, 'INR', NOW(), NOW())`,
      [crypto.randomUUID(), order1Id, rzpOrder1]
    );

    // Insert Order 2: pending with created payment
    await pool.execute(
      `INSERT INTO orders (id, order_number, user_id, status, payment_status, total_amount, currency, subtotal, discount_amount, shipping_amount, created_at, updated_at)
       VALUES (?, ?, ?, 'pending', 'pending', 699.00, 'INR', 699.00, 0, 0, NOW(), NOW())`,
      [order2Id, order2Number, customerA_Id]
    );
    await pool.execute(
      `INSERT INTO payments (id, order_id, provider, provider_order_id, status, amount, currency, created_at, updated_at)
       VALUES (?, ?, 'razorpay', ?, 'created', 699.00, 'INR', NOW(), NOW())`,
      [crypto.randomUUID(), order2Id, rzpOrder2]
    );

    // Insert Order 3: pending with created payment
    await pool.execute(
      `INSERT INTO orders (id, order_number, user_id, status, payment_status, total_amount, currency, subtotal, discount_amount, shipping_amount, created_at, updated_at)
       VALUES (?, ?, ?, 'pending', 'pending', 799.00, 'INR', 799.00, 0, 0, NOW(), NOW())`,
      [order3Id, order3Number, customerA_Id]
    );
    await pool.execute(
      `INSERT INTO payments (id, order_id, provider, provider_order_id, status, amount, currency, created_at, updated_at)
       VALUES (?, ?, 'razorpay', ?, 'created', 799.00, 'INR', NOW(), NOW())`,
      [crypto.randomUUID(), order3Id, rzpOrder3]
    );

    // Insert Order 4: pending for retry flow
    await pool.execute(
      `INSERT INTO orders (id, order_number, user_id, status, payment_status, total_amount, currency, subtotal, discount_amount, shipping_amount, created_at, updated_at)
       VALUES (?, ?, ?, 'pending', 'pending', 899.00, 'INR', 899.00, 0, 0, NOW(), NOW())`,
      [order4Id, order4Number, customerA_Id]
    );
    await pool.execute(
      `INSERT INTO payments (id, order_id, provider, provider_order_id, status, amount, currency, created_at, updated_at)
       VALUES (?, ?, 'razorpay', ?, 'created', 899.00, 'INR', NOW(), NOW())`,
      [crypto.randomUUID(), order4Id, rzpOrder4_1]
    );

    // Insert Order 5: already paid with captured payment
    await pool.execute(
      `INSERT INTO orders (id, order_number, user_id, status, payment_status, total_amount, currency, subtotal, discount_amount, shipping_amount, created_at, updated_at)
       VALUES (?, ?, ?, 'processing', 'paid', 999.00, 'INR', 999.00, 0, 0, NOW(), NOW())`,
      [order5Id, order5Number, customerA_Id]
    );
    await pool.execute(
      `INSERT INTO payments (id, order_id, provider, provider_order_id, provider_payment_id, status, amount, currency, paid_at, created_at, updated_at)
       VALUES (?, ?, 'razorpay', ?, ?, 'captured', 999.00, 'INR', NOW(), NOW(), NOW())`,
      [crypto.randomUUID(), order5Id, rzpOrder5, rzpPay5]
    );

    // Insert Order 6: pending with verified payment (ready for L-04 settlement)
    await pool.execute(
      `INSERT INTO orders (id, order_number, user_id, status, payment_status, total_amount, currency, subtotal, discount_amount, shipping_amount, created_at, updated_at)
       VALUES (?, ?, ?, 'pending', 'pending', 350.00, 'INR', 350.00, 0, 0, NOW(), NOW())`,
      [order6Id, order6Number, customerA_Id]
    );
    await pool.execute(
      `INSERT INTO payments (id, order_id, provider, provider_order_id, provider_payment_id, status, amount, currency, created_at, updated_at)
       VALUES (?, ?, 'razorpay', ?, ?, 'verified', 350.00, 'INR', NOW(), NOW())`,
      [crypto.randomUUID(), order6Id, rzpOrder6, rzpPay6]
    );

    // Insert Order 7: customer B order
    await pool.execute(
      `INSERT INTO orders (id, order_number, user_id, status, payment_status, total_amount, currency, subtotal, discount_amount, shipping_amount, created_at, updated_at)
       VALUES (?, ?, ?, 'pending', 'pending', 550.00, 'INR', 550.00, 0, 0, NOW(), NOW())`,
      [order7Id, order7Number, customerB_Id]
    );
    await pool.execute(
      `INSERT INTO payments (id, order_id, provider, provider_order_id, status, amount, currency, created_at, updated_at)
       VALUES (?, ?, 'razorpay', ?, 'created', 550.00, 'INR', NOW(), NOW())`,
      [crypto.randomUUID(), order7Id, rzpOrder7]
    );

    console.log("Test fixtures initialized successfully. Running test suite...\n");

    // =========================================================================
    // Test 1: Failed payment does not mark order paid
    // =========================================================================
    currentMockSessionToken = sessionTokenA;
    const req1 = new Request("http://localhost:3000/api/payments/fail", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderId: order1Id,
        razorpayOrderId: rzpOrder1,
        razorpayPaymentId: rzpPay1,
        errorCode: "BAD_REQUEST_ERROR",
        errorDescription: "Payment declined by issuing bank",
      }),
    });
    const res1 = await failPaymentHandler(req1);
    const data1 = await res1.json();

    const [rowsOrder1] = (await pool.execute(
      "SELECT payment_status FROM orders WHERE id = ?",
      [order1Id]
    )) as any[];
    assert(
      "1. Failed payment does not mark order paid",
      res1.status === 200 && data1.ok === true && rowsOrder1[0].payment_status !== "paid" && data1.paymentStatus === "failed",
      `Status: ${rowsOrder1[0].payment_status}`
    );

    // =========================================================================
    // Test 2: Failed payment state is persisted correctly where supported
    // =========================================================================
    const [rowsPay1] = (await pool.execute(
      "SELECT status, provider_payment_id FROM payments WHERE order_id = ? AND provider_order_id = ?",
      [order1Id, rzpOrder1]
    )) as any[];
    assert(
      "2. Failed payment state is persisted correctly in MySQL payments table",
      rowsPay1[0].status === "failed" && rowsPay1[0].provider_payment_id === rzpPay1,
      `Payment status: ${rowsPay1[0].status}, Payment ID: ${rowsPay1[0].provider_payment_id}`
    );

    // =========================================================================
    // Test 3: Customer cancellation does not falsely mark payment failed
    // =========================================================================
    const req3 = new Request("http://localhost:3000/api/payments/cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderId: order2Id,
        razorpayOrderId: rzpOrder2,
      }),
    });
    const res3 = await cancelPaymentHandler(req3);
    const data3 = await res3.json();

    const [rowsPay2] = (await pool.execute(
      "SELECT status FROM payments WHERE order_id = ? AND provider_order_id = ?",
      [order2Id, rzpOrder2]
    )) as any[];
    assert(
      "3. Customer cancellation does not falsely mark payment failed",
      res3.status === 200 && data3.ok === true && rowsPay2[0].status === "created" && data3.status === "pending",
      `Payment status: ${rowsPay2[0].status}`
    );

    // =========================================================================
    // Test 4: Cancellation does not mark order paid
    // =========================================================================
    const [rowsOrder2] = (await pool.execute(
      "SELECT payment_status FROM orders WHERE id = ?",
      [order2Id]
    )) as any[];
    assert(
      "4. Cancellation does not mark order paid",
      rowsOrder2[0].payment_status === "pending",
      `Order payment_status: ${rowsOrder2[0].payment_status}`
    );

    // =========================================================================
    // Test 5: Delayed / unknown status leaves order safe in pending state
    // =========================================================================
    const req5 = new Request("http://localhost:3000/api/payments/reconcile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderId: order3Id,
        razorpayOrderId: rzpOrder3,
      }),
    });
    const res5 = await reconcilePaymentHandler(req5);
    const data5 = await res5.json();

    const [rowsOrder3] = (await pool.execute(
      "SELECT payment_status FROM orders WHERE id = ?",
      [order3Id]
    )) as any[];
    assert(
      "5. Delayed/unknown status leaves order safe in pending state",
      res5.status === 200 && data5.ok === true && rowsOrder3[0].payment_status === "pending",
      `Reconcile response: ${data5.status}, DB payment_status: ${rowsOrder3[0].payment_status}`
    );

    // =========================================================================
    // Test 6: Unknown provider status cannot mark order paid
    // =========================================================================
    assert(
      "6. Unknown provider status cannot mark order paid",
      data5.paymentStatus !== "paid" && rowsOrder3[0].payment_status !== "paid",
      `Status: ${rowsOrder3[0].payment_status}`
    );

    // =========================================================================
    // Test 7: Retry after failed attempt behaves correctly
    // =========================================================================
    // First, fail attempt 1 on order 4
    await pool.execute(
      "UPDATE payments SET status = 'failed', provider_payment_id = ? WHERE order_id = ?",
      [rzpPay4_1, order4Id]
    );
    await pool.execute(
      "UPDATE orders SET payment_status = 'failed' WHERE id = ?",
      [order4Id]
    );

    // Now request new payment order (retry)
    const retryResult = await createRazorpayPaymentOrder({
      orderId: order4Id,
      userId: customerA_Id,
    });
    assert(
      "7. Retry after failed attempt behaves correctly and creates new payment order",
      retryResult.success === true && retryResult.isExisting === false && !!retryResult.razorpayOrderId,
      `New RZP Order: ${retryResult.razorpayOrderId}`
    );

    // =========================================================================
    // Test 8: Valid new payment can proceed after failed attempt
    // =========================================================================
    // Mark second attempt as verified
    await pool.execute(
      `UPDATE payments SET status = 'verified', provider_payment_id = ? WHERE provider_order_id = ?`,
      [rzpPay4_2, retryResult.razorpayOrderId]
    );

    // Settle the retry attempt
    const req8 = new Request("http://localhost:3000/api/payments/settle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderId: order4Id,
        razorpayPaymentId: rzpPay4_2,
      }),
    });
    const res8 = await settlePaymentHandler(req8);
    const data8 = await res8.json();

    const [rowsOrder4] = (await pool.execute(
      "SELECT payment_status FROM orders WHERE id = ?",
      [order4Id]
    )) as any[];
    assert(
      "8. Valid new payment can proceed and settle after failed attempt",
      res8.status === 200 && data8.ok === true && rowsOrder4[0].payment_status === "paid",
      `Settled payment_status: ${rowsOrder4[0].payment_status}`
    );

    // =========================================================================
    // Test 9: Already-paid order cannot be changed by later failure callback
    // =========================================================================
    const req9 = new Request("http://localhost:3000/api/payments/fail", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderId: order5Id,
        razorpayOrderId: rzpOrder5,
        razorpayPaymentId: `pay_late_fail_${testRunId}`,
        errorCode: "LATE_FAILURE",
      }),
    });
    const res9 = await failPaymentHandler(req9);
    const data9 = await res9.json();

    const [rowsOrder5] = (await pool.execute(
      "SELECT payment_status FROM orders WHERE id = ?",
      [order5Id]
    )) as any[];
    assert(
      "9. Already-paid order cannot be changed by later failure callback",
      res9.status === 200 && data9.ignored === true && rowsOrder5[0].payment_status === "paid",
      `DB payment_status: ${rowsOrder5[0].payment_status}, ignored: ${data9.ignored}`
    );

    // =========================================================================
    // Test 10: Already-paid order cannot be changed by cancellation callback
    // =========================================================================
    const req10 = new Request("http://localhost:3000/api/payments/cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderId: order5Id,
        razorpayOrderId: rzpOrder5,
      }),
    });
    const res10 = await cancelPaymentHandler(req10);
    const data10 = await res10.json();

    const [rowsOrder5Again] = (await pool.execute(
      "SELECT payment_status FROM orders WHERE id = ?",
      [order5Id]
    )) as any[];
    assert(
      "10. Already-paid order cannot be changed by cancellation callback",
      res10.status === 200 && data10.ignored === true && rowsOrder5Again[0].payment_status === "paid",
      `DB payment_status: ${rowsOrder5Again[0].payment_status}`
    );

    // =========================================================================
    // Test 11: Amount mismatch is rejected (client amount differs from order)
    // =========================================================================
    const req11 = new Request("http://localhost:3000/api/payments/fail", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderId: order1Id,
        amount: 1.00, // Trusted is 499.00
      }),
    });
    const res11 = await failPaymentHandler(req11);
    const data11 = await res11.json();
    assert(
      "11. Client amount mismatch is rejected with 400",
      res11.status === 400 && data11.error.includes("amount mismatch"),
      `Error: ${data11.error}`
    );

    // =========================================================================
    // Test 12: Provider amount mismatch is rejected in settlement / reconcile
    // =========================================================================
    const order12Id = crypto.randomUUID();
    const rzpOrder12 = `order_l05_amt_mismatch_${testRunId}`;
    const rzpPay12 = `pay_l05_amt_mismatch_${testRunId}`;
    await pool.execute(
      `INSERT INTO orders (id, order_number, user_id, status, payment_status, total_amount, currency, subtotal, discount_amount, shipping_amount, created_at, updated_at)
       VALUES (?, 'ORD-L05-AMT', ?, 'pending', 'pending', 500.00, 'INR', 500.00, 0, 0, NOW(), NOW())`,
      [order12Id, customerA_Id]
    );
    await pool.execute(
      `INSERT INTO payments (id, order_id, provider, provider_order_id, provider_payment_id, status, amount, currency, created_at, updated_at)
       VALUES (?, ?, 'razorpay', ?, ?, 'verified', 250.00, 'INR', NOW(), NOW())`,
      [crypto.randomUUID(), order12Id, rzpOrder12, rzpPay12]
    );

    const req12 = new Request("http://localhost:3000/api/payments/settle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderId: order12Id,
        razorpayPaymentId: rzpPay12,
      }),
    });
    const res12 = await settlePaymentHandler(req12);
    const data12 = await res12.json();

    const [rowsOrder12] = (await pool.execute(
      "SELECT payment_status FROM orders WHERE id = ?",
      [order12Id]
    )) as any[];
    assert(
      "12. Provider payment amount mismatch is rejected and prevents settlement",
      res12.status === 400 && data12.error.includes("amount mismatch") && rowsOrder12[0].payment_status !== "paid",
      `Error: ${data12.error}, Status: ${rowsOrder12[0].payment_status}`
    );

    // =========================================================================
    // Test 13: Currency mismatch is rejected
    // =========================================================================
    const req13 = new Request("http://localhost:3000/api/payments/settle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderId: order6Id,
        razorpayPaymentId: rzpPay6,
        currency: "USD", // Order is INR
      }),
    });
    const res13 = await settlePaymentHandler(req13);
    const data13 = await res13.json();
    assert(
      "13. Currency mismatch is rejected with 400",
      res13.status === 400 && data13.error.includes("currency mismatch"),
      `Error: ${data13.error}`
    );

    // =========================================================================
    // Test 14: Client cannot force payment_status = paid directly via orders API
    // =========================================================================
    const req14 = new Request(`http://localhost:3000/api/orders/${order1Id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        payment_status: "paid",
        status: "delivered",
      }),
    });
    const res14 = await patchOrderHandler(req14 as any, { params: Promise.resolve({ id: order1Id }) } as any);
    const data14 = await res14.json();

    const [rowsOrder1Check] = (await pool.execute(
      "SELECT payment_status FROM orders WHERE id = ?",
      [order1Id]
    )) as any[];
    assert(
      "14. Client cannot force payment_status = paid directly on orders API",
      (res14.status === 403 || res14.status === 400) && rowsOrder1Check[0].payment_status !== "paid",
      `Status code: ${res14.status}, payment_status in DB: ${rowsOrder1Check[0].payment_status}`
    );

    // =========================================================================
    // Test 15: Client cannot override trusted order amount in payment endpoints
    // =========================================================================
    const req15 = new Request("http://localhost:3000/api/payments/settle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderId: order6Id,
        razorpayPaymentId: rzpPay6,
        amount: 10.00, // Order is 350.00
      }),
    });
    const res15 = await settlePaymentHandler(req15);
    const data15 = await res15.json();
    assert(
      "15. Client cannot override trusted order amount",
      res15.status === 400 && data15.error.includes("amount mismatch"),
      `Error: ${data15.error}`
    );

    // =========================================================================
    // Test 16: Cross-customer payment/status lookup rejected (IDOR defense)
    // =========================================================================
    // Customer B tries to fail Customer A's order
    currentMockSessionToken = sessionTokenB;
    const req16 = new Request("http://localhost:3000/api/payments/fail", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderId: order1Id,
        razorpayOrderId: rzpOrder1,
      }),
    });
    const res16 = await failPaymentHandler(req16);
    const data16 = await res16.json();
    assert(
      "16. Cross-customer failure callback is rejected with 403 Forbidden",
      res16.status === 403 && data16.error.includes("Forbidden"),
      `Status: ${res16.status}, Error: ${data16.error}`
    );

    // =========================================================================
    // Test 17: Invalid/nonexistent payment ID or order ID rejected
    // =========================================================================
    currentMockSessionToken = sessionTokenA;
    const req17 = new Request("http://localhost:3000/api/payments/fail", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderId: crypto.randomUUID(),
      }),
    });
    const res17 = await failPaymentHandler(req17);
    const data17 = await res17.json();
    assert(
      "17. Nonexistent order ID rejected with 404",
      res17.status === 404 && data17.error.includes("Order not found"),
      `Error: ${data17.error}`
    );

    // =========================================================================
    // Test 18: Payment from another order cannot affect current order
    // =========================================================================
    // Try to attach Customer A's order to rzpPay5 (which belongs to order 5)
    const req18 = new Request("http://localhost:3000/api/payments/fail", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderId: order2Id,
        razorpayPaymentId: rzpPay5, // Belongs to order5
      }),
    });
    const res18 = await failPaymentHandler(req18);
    const data18 = await res18.json();
    assert(
      "18. Reusing payment ID from another order is rejected with 409 Conflict",
      res18.status === 409 && data18.error.includes("different order"),
      `Error: ${data18.error}`
    );

    // =========================================================================
    // Test 19: Duplicate failure callback is idempotent
    // =========================================================================
    const req19 = new Request("http://localhost:3000/api/payments/fail", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderId: order1Id,
        razorpayOrderId: rzpOrder1,
        razorpayPaymentId: rzpPay1,
      }),
    });
    const res19 = await failPaymentHandler(req19);
    const data19 = await res19.json();
    assert(
      "19. Duplicate failure callback is idempotent and returns HTTP 200",
      res19.status === 200 && data19.ok === true && data19.status === "failed",
      `isExisting: ${data19.isExisting}`
    );

    // =========================================================================
    // Test 20: Duplicate cancellation callback is idempotent
    // =========================================================================
    const req20 = new Request("http://localhost:3000/api/payments/cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderId: order2Id,
        razorpayOrderId: rzpOrder2,
      }),
    });
    const res20 = await cancelPaymentHandler(req20);
    const data20 = await res20.json();
    assert(
      "20. Duplicate cancellation callback is idempotent and returns HTTP 200",
      res20.status === 200 && data20.ok === true && data20.cancelled === true,
      `Cancelled: ${data20.cancelled}`
    );

    // =========================================================================
    // Test 21: Duplicate reconciliation/status check is safe
    // =========================================================================
    const req21 = new Request("http://localhost:3000/api/payments/reconcile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderId: order3Id,
        razorpayOrderId: rzpOrder3,
      }),
    });
    const res21 = await reconcilePaymentHandler(req21);
    const data21 = await res21.json();
    assert(
      "21. Duplicate reconciliation check is safe and returns safe status",
      res21.status === 200 && data21.ok === true,
      `Status: ${data21.status}`
    );

    // =========================================================================
    // Test 22: Race condition around paid vs failed transition is safe
    // =========================================================================
    // Settle order 6 concurrently with a failure callback
    const settlePromise = settlePaymentHandler(
      new Request("http://localhost:3000/api/payments/settle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: order6Id,
          razorpayPaymentId: rzpPay6,
        }),
      })
    );
    const failPromise = failPaymentHandler(
      new Request("http://localhost:3000/api/payments/fail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: order6Id,
          razorpayPaymentId: `pay_race_${testRunId}`,
        }),
      })
    );

    const [settleRes, failRes] = await Promise.all([settlePromise, failPromise]);
    const settleData = await settleRes.json();
    const failData = await failRes.json();

    const [rowsOrder6] = (await pool.execute(
      "SELECT payment_status FROM orders WHERE id = ?",
      [order6Id]
    )) as any[];
    assert(
      "22. Race condition between settlement and failure protects paid status",
      settleRes.status === 200 && rowsOrder6[0].payment_status === "paid" && (failData.ignored === true || failRes.status === 200),
      `Order payment_status: ${rowsOrder6[0].payment_status}, fail ignored: ${failData.ignored}`
    );

    // =========================================================================
    // Test 23: Verified payment remains protected from failure callbacks
    // =========================================================================
    const req23 = new Request("http://localhost:3000/api/payments/fail", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderId: order6Id,
        razorpayOrderId: rzpOrder6,
      }),
    });
    const res23 = await failPaymentHandler(req23);
    const data23 = await res23.json();

    const [rowsPay6] = (await pool.execute(
      "SELECT status FROM payments WHERE order_id = ? AND provider_order_id = ?",
      [order6Id, rzpOrder6]
    )) as any[];
    assert(
      "23. Verified payment remains protected from failure callbacks",
      res23.status === 200 && data23.ignored === true && (rowsPay6[0].status === "verified" || rowsPay6[0].status === "captured"),
      `Payment status: ${rowsPay6[0].status}, callback ignored: ${data23.ignored}`
    );

    // =========================================================================
    // Test 24: Failed payment cannot bypass L-04 settlement rules
    // =========================================================================
    const req24 = new Request("http://localhost:3000/api/payments/settle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderId: order1Id, // Has status = 'failed'
        razorpayPaymentId: rzpPay1,
      }),
    });
    const res24 = await settlePaymentHandler(req24);
    const data24 = await res24.json();
    assert(
      "24. Failed payment cannot bypass L-04 settlement rules (rejected 400)",
      res24.status === 400 && (data24.error.includes("failed") || data24.error.includes("verified")),
      `Error: ${data24.error}`
    );

    // =========================================================================
    // Test 25: L-03 valid verification + correct amount remains successful
    // =========================================================================
    const order25Id = crypto.randomUUID();
    const rzpOrder25 = `order_l05_l03test_${testRunId}`;
    const rzpPay25 = `pay_l05_l03test_${testRunId}`;
    const keySecret = process.env.RAZORPAY_KEY_SECRET || "rzp_test_mock_secret";
    const sigPayload = `${rzpOrder25}|${rzpPay25}`;
    const validSignature = crypto
      .createHmac("sha256", keySecret)
      .update(sigPayload)
      .digest("hex");

    await pool.execute(
      `INSERT INTO orders (id, order_number, user_id, status, payment_status, total_amount, currency, subtotal, discount_amount, shipping_amount, created_at, updated_at)
       VALUES (?, 'ORD-L05-L03', ?, 'pending', 'pending', 320.00, 'INR', 320.00, 0, 0, NOW(), NOW())`,
      [order25Id, customerA_Id]
    );
    await pool.execute(
      `INSERT INTO payments (id, order_id, provider, provider_order_id, status, amount, currency, created_at, updated_at)
       VALUES (?, ?, 'razorpay', ?, 'created', 320.00, 'INR', NOW(), NOW())`,
      [crypto.randomUUID(), order25Id, rzpOrder25]
    );

    const req25 = new Request("http://localhost:3000/api/payments/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderId: order25Id,
        razorpay_order_id: rzpOrder25,
        razorpay_payment_id: rzpPay25,
        razorpay_signature: validSignature,
        amount: 320.00,
        currency: "INR",
      }),
    });
    const res25 = await verifyPaymentHandler(req25);
    const data25 = await res25.json();
    assert(
      "25. L-03 valid verification with correct amount & currency remains successful",
      res25.status === 200 && data25.ok === true && data25.verified === true,
      `Verified: ${data25.verified}`
    );

    // =========================================================================
    // Test 26: L-04 valid settlement still works after L-05 additions
    // =========================================================================
    const req26 = new Request("http://localhost:3000/api/payments/settle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderId: order25Id,
        razorpayPaymentId: rzpPay25,
        currency: "INR",
      }),
    });
    const res26 = await settlePaymentHandler(req26);
    const data26 = await res26.json();

    const [rowsOrder25] = (await pool.execute(
      "SELECT payment_status FROM orders WHERE id = ?",
      [order25Id]
    )) as any[];
    assert(
      "26. L-04 valid settlement still works cleanly after L-05 additions",
      res26.status === 200 && data26.ok === true && rowsOrder25[0].payment_status === "paid",
      `Payment status: ${rowsOrder25[0].payment_status}`
    );

    // =========================================================================
    // Test 27: Cancellation on verified payment does not undo verified state
    // =========================================================================
    const req27 = new Request("http://localhost:3000/api/payments/cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderId: order25Id,
      }),
    });
    const res27 = await cancelPaymentHandler(req27);
    const data27 = await res27.json();
    assert(
      "27. Cancellation on verified/paid order ignores cancellation safely",
      res27.status === 200 && data27.ignored === true,
      `Ignored: ${data27.ignored}`
    );

    // =========================================================================
    // Test 28: Unauthenticated requests to /api/payments/* return 401
    // =========================================================================
    currentMockSessionToken = null;
    const req28Fail = new Request("http://localhost:3000/api/payments/fail", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: order1Id }),
    });
    const res28Fail = await failPaymentHandler(req28Fail);

    const req28Cancel = new Request("http://localhost:3000/api/payments/cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: order1Id }),
    });
    const res28Cancel = await cancelPaymentHandler(req28Cancel);

    const req28Reconcile = new Request("http://localhost:3000/api/payments/reconcile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: order1Id }),
    });
    const res28Reconcile = await reconcilePaymentHandler(req28Reconcile);

    assert(
      "28. Unauthenticated requests to /fail, /cancel, /reconcile return 401 Unauthorized",
      res28Fail.status === 401 && res28Cancel.status === 401 && res28Reconcile.status === 401,
      `Fail: ${res28Fail.status}, Cancel: ${res28Cancel.status}, Reconcile: ${res28Reconcile.status}`
    );

    // =========================================================================
    // Test 29: Zero secret leakage in API error messages
    // =========================================================================
    currentMockSessionToken = sessionTokenA;
    const req29 = new Request("http://localhost:3000/api/payments/reconcile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderId: order1Id,
        razorpayOrderId: "order_nonexistent_999",
      }),
    });
    const res29 = await reconcilePaymentHandler(req29);
    const data29 = await res29.json();
    const strResponse = JSON.stringify(data29);
    const keySecretToFind = process.env.RAZORPAY_KEY_SECRET || "impossible_secret_string";
    const hasSecretLeak = keySecretToFind.length > 5 && strResponse.includes(keySecretToFind);
    const hasSqlLeak = /SELECT|INSERT|UPDATE|DELETE|FROM\s+orders/i.test(strResponse);

    assert(
      "29. API responses never leak Razorpay secret, DB queries, or stack traces",
      !hasSecretLeak && !hasSqlLeak && data29.stack === undefined,
      `Clean error: "${data29.error || 'N/A'}"`
    );

  } catch (error) {
    console.error("Test execution failed with unexpected exception:", error);
    failed++;
  } finally {
    console.log("\nCleaning up test fixtures from Hostinger MySQL...");
    try {
      const orderIds = [order1Id, order2Id, order3Id, order4Id, order5Id, order6Id, order7Id];
      await pool.execute(
        `DELETE FROM payments WHERE order_id IN (${orderIds.map(() => "?").join(",")})`,
        orderIds
      );
      await pool.execute(
        `DELETE FROM orders WHERE id IN (${orderIds.map(() => "?").join(",")})`,
        orderIds
      );
      await pool.execute(
        `DELETE FROM payments WHERE order_id NOT IN (SELECT id FROM orders)`
      );
      await pool.execute(
        `DELETE FROM orders WHERE user_id IN (?, ?)`,
        [customerA_Id, customerB_Id]
      );
      await pool.execute(
        `DELETE FROM profiles WHERE id IN (?, ?)`,
        [customerA_Id, customerB_Id]
      );
    } catch (cleanupErr) {
      console.error("Cleanup error:", cleanupErr);
    }
    await pool.end();
  }

  console.log("\n=================================================================");
  console.log(`L-05 AUDIT SUMMARY: ${passed} PASSED / ${failed} FAILED`);
  console.log("=================================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runAudit();
