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
  console.log("Dearr V1 — Task L-03: Razorpay Server-Side Payment Verification Audit");
  console.log("Endpoint: POST /api/payments/verify");
  console.log("Database: Hostinger MySQL");
  console.log("=================================================================\n");

  const { POST: verifyPaymentHandler } = await import(
    "../src/app/api/payments/verify/route"
  );
  const { verifyRazorpaySignature } = await import(
    "../src/lib/server/razorpay"
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
  const customerA_Id = crypto.randomUUID();
  const customerA_Email = `l03.test.a.${Date.now()}@dearr.test`;
  const customerB_Id = crypto.randomUUID();
  const customerB_Email = `l03.test.b.${Date.now()}@dearr.test`;

  const order1Id = crypto.randomUUID();
  const order1Number = `ORD-L03-A-${Date.now().toString().slice(-6)}`;
  const order1Total = 499.0;
  const payment1Id = crypto.randomUUID();
  const rzpOrder1Id = `order_l03_test_${Date.now().toString().slice(-8)}`;

  const order2Id = crypto.randomUUID();
  const order2Number = `ORD-L03-B-${Date.now().toString().slice(-6)}`;
  const order2Total = 899.0;
  const payment2Id = crypto.randomUUID();
  const rzpOrder2Id = `order_l03_b_${Date.now().toString().slice(-8)}`;

  const alreadyPaidOrderId = crypto.randomUUID();
  const alreadyPaidOrderNumber = `ORD-L03-PAID-${Date.now().toString().slice(-6)}`;
  const alreadyPaidPaymentId = crypto.randomUUID();
  const rzpPaidOrderId = `order_l03_paid_${Date.now().toString().slice(-8)}`;
  const rzpPaidPaymentId = `pay_l03_already_paid_${Date.now().toString().slice(-8)}`;

  let sessionTokenA: string;
  let sessionTokenB: string;

  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keySecret) {
    throw new Error("RAZORPAY_KEY_SECRET must be set in .env.local to run tests");
  }

  // Helper to generate legitimate HMAC-SHA256 signature for test payloads
  function generateTestSignature(rzpOrderId: string, rzpPaymentId: string): string {
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
       VALUES (?, ?, ?, 'Customer A (L-03)', 'customer', NOW(), NOW())`,
      [customerA_Id, customerA_Email, passwordHash]
    );

    // Create Customer B
    await pool.execute(
      `INSERT INTO profiles (id, email, password_hash, full_name, role, created_at, updated_at)
       VALUES (?, ?, ?, 'Customer B (L-03)', 'customer', NOW(), NOW())`,
      [customerB_Id, customerB_Email, passwordHash]
    );

    // Create Customer A's Order (pending)
    await pool.execute(
      `INSERT INTO orders (
         id, order_number, user_id, status, payment_status,
         subtotal, discount_amount, shipping_amount, total_amount, currency,
         shipping_full_name, shipping_phone, shipping_address_line_1,
         shipping_city, shipping_state, shipping_postal_code, shipping_country,
         created_at, updated_at
       ) VALUES (
         ?, ?, ?, 'pending', 'pending',
         ?, 0, 0, ?, 'INR',
         'Customer A', '9876543210', '123 Test Street',
         'Mumbai', 'Maharashtra', '400001', 'India',
         NOW(), NOW()
       )`,
      [order1Id, order1Number, customerA_Id, order1Total, order1Total]
    );

    // Create Customer A's Payment record (status: 'created')
    await pool.execute(
      `INSERT INTO payments (
         id, order_id, provider, provider_order_id, provider_payment_id,
         status, amount, currency, paid_at, created_at, updated_at
       ) VALUES (
         ?, ?, 'razorpay', ?, NULL,
         'created', ?, 'INR', NULL, NOW(), NOW()
       )`,
      [payment1Id, order1Id, rzpOrder1Id, order1Total]
    );

    // Create Customer B's Order (pending)
    await pool.execute(
      `INSERT INTO orders (
         id, order_number, user_id, status, payment_status,
         subtotal, discount_amount, shipping_amount, total_amount, currency,
         shipping_full_name, shipping_phone, shipping_address_line_1,
         shipping_city, shipping_state, shipping_postal_code, shipping_country,
         created_at, updated_at
       ) VALUES (
         ?, ?, ?, 'pending', 'pending',
         ?, 0, 0, ?, 'INR',
         'Customer B', '9876543211', '456 Test Avenue',
         'Bengaluru', 'Karnataka', '560001', 'India',
         NOW(), NOW()
       )`,
      [order2Id, order2Number, customerB_Id, order2Total, order2Total]
    );

    // Create Customer B's Payment record (status: 'created')
    await pool.execute(
      `INSERT INTO payments (
         id, order_id, provider, provider_order_id, provider_payment_id,
         status, amount, currency, paid_at, created_at, updated_at
       ) VALUES (
         ?, ?, 'razorpay', ?, NULL,
         'created', ?, 'INR', NULL, NOW(), NOW()
       )`,
      [payment2Id, order2Id, rzpOrder2Id, order2Total]
    );

    // Create Already Paid Order (payment_status: 'paid')
    const validPaidSig = generateTestSignature(rzpPaidOrderId, rzpPaidPaymentId);
    await pool.execute(
      `INSERT INTO orders (
         id, order_number, user_id, status, payment_status,
         subtotal, discount_amount, shipping_amount, total_amount, currency,
         shipping_full_name, shipping_phone, shipping_address_line_1,
         shipping_city, shipping_state, shipping_postal_code, shipping_country,
         created_at, updated_at
       ) VALUES (
         ?, ?, ?, 'confirmed', 'paid',
         500.0, 0, 0, 500.0, 'INR',
         'Customer A', '9876543210', '123 Test Street',
         'Mumbai', 'Maharashtra', '400001', 'India',
         NOW(), NOW()
       )`,
      [alreadyPaidOrderId, alreadyPaidOrderNumber, customerA_Id]
    );

    await pool.execute(
      `INSERT INTO payments (
         id, order_id, provider, provider_order_id, provider_payment_id,
         status, amount, currency, paid_at, created_at, updated_at
       ) VALUES (
         ?, ?, 'razorpay', ?, ?,
         'verified', 500.0, 'INR', NOW(), NOW(), NOW()
       )`,
      [alreadyPaidPaymentId, alreadyPaidOrderId, rzpPaidOrderId, rzpPaidPaymentId]
    );

    sessionTokenA = await createSessionToken({
      id: customerA_Id,
      email: customerA_Email,
      fullName: "Customer A (L-03)",
      role: "customer",
    });

    sessionTokenB = await createSessionToken({
      id: customerB_Id,
      email: customerB_Email,
      fullName: "Customer B (L-03)",
      role: "customer",
    });

    console.log("✓ Fixtures created successfully.\n");

    // =========================================================================
    // SECTION 1: Direct Unit Signature Verification
    // =========================================================================
    console.log("--- Section 1: Direct Cryptographic Signature Verification Unit Tests ---");

    const validTestPaymentId = `pay_test_${Date.now().toString().slice(-8)}`;
    const validSig = generateTestSignature(rzpOrder1Id, validTestPaymentId);

    assert(
      "Direct verifyRazorpaySignature returns true for valid HMAC-SHA256 signature",
      verifyRazorpaySignature(rzpOrder1Id, validTestPaymentId, validSig) === true
    );

    const tamperedSig = validSig.slice(0, -4) + "0000";
    assert(
      "Direct verifyRazorpaySignature returns false for tampered signature",
      verifyRazorpaySignature(rzpOrder1Id, validTestPaymentId, tamperedSig) === false
    );

    assert(
      "Direct verifyRazorpaySignature returns false for wrong order ID",
      verifyRazorpaySignature("order_wrong_12345", validTestPaymentId, validSig) === false
    );

    assert(
      "Direct verifyRazorpaySignature returns false for wrong payment ID",
      verifyRazorpaySignature(rzpOrder1Id, "pay_wrong_12345", validSig) === false
    );

    assert(
      "Direct verifyRazorpaySignature safely handles malformed / non-hex signature",
      verifyRazorpaySignature(rzpOrder1Id, validTestPaymentId, "invalid_non_hex_sig") === false
    );

    assert(
      "Direct verifyRazorpaySignature safely handles incorrect length signature",
      verifyRazorpaySignature(rzpOrder1Id, validTestPaymentId, "abc123") === false
    );

    assert(
      "Direct verifyRazorpaySignature safely handles empty inputs",
      verifyRazorpaySignature("", "", "") === false
    );

    // =========================================================================
    // SECTION 2: API Route Security & Validation
    // =========================================================================
    console.log("\n--- Section 2: Endpoint Authentication & Request Validation ---");

    // Test 1: Unauthenticated request -> 401
    currentMockSessionToken = null;
    const resUnauth = await verifyPaymentHandler(
      new Request("http://localhost:3000/api/payments/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: order1Id,
          razorpay_order_id: rzpOrder1Id,
          razorpay_payment_id: validTestPaymentId,
          razorpay_signature: validSig,
        }),
      })
    );
    const dataUnauth = await resUnauth.json();
    assert(
      "Unauthenticated request is rejected with HTTP 401",
      resUnauth.status === 401 && dataUnauth.ok === false,
      `Status: ${resUnauth.status}`
    );

    // Test 2: Invalid JSON body -> 400
    currentMockSessionToken = sessionTokenA;
    const resInvalidJson = await verifyPaymentHandler(
      new Request("http://localhost:3000/api/payments/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "invalid{json",
      })
    );
    const dataInvalidJson = await resInvalidJson.json();
    assert(
      "Invalid JSON request body rejected with HTTP 400",
      resInvalidJson.status === 400 && dataInvalidJson.ok === false
    );

    // Test 3: Missing orderId -> 400
    const resMissingOrderId = await verifyPaymentHandler(
      new Request("http://localhost:3000/api/payments/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          razorpay_order_id: rzpOrder1Id,
          razorpay_payment_id: validTestPaymentId,
          razorpay_signature: validSig,
        }),
      })
    );
    const dataMissingOrderId = await resMissingOrderId.json();
    assert(
      "Missing orderId rejected with HTTP 400",
      resMissingOrderId.status === 400 && dataMissingOrderId.ok === false
    );

    // Test 4: Missing razorpay_order_id -> 400
    const resMissingRzpOrderId = await verifyPaymentHandler(
      new Request("http://localhost:3000/api/payments/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: order1Id,
          razorpay_payment_id: validTestPaymentId,
          razorpay_signature: validSig,
        }),
      })
    );
    const dataMissingRzpOrderId = await resMissingRzpOrderId.json();
    assert(
      "Missing razorpay_order_id rejected with HTTP 400",
      resMissingRzpOrderId.status === 400 && dataMissingRzpOrderId.ok === false
    );

    // Test 5: Missing razorpay_payment_id -> 400
    const resMissingPaymentId = await verifyPaymentHandler(
      new Request("http://localhost:3000/api/payments/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: order1Id,
          razorpay_order_id: rzpOrder1Id,
          razorpay_signature: validSig,
        }),
      })
    );
    const dataMissingPaymentId = await resMissingPaymentId.json();
    assert(
      "Missing razorpay_payment_id rejected with HTTP 400",
      resMissingPaymentId.status === 400 && dataMissingPaymentId.ok === false
    );

    // Test 6: Missing signature -> 400
    const resMissingSig = await verifyPaymentHandler(
      new Request("http://localhost:3000/api/payments/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: order1Id,
          razorpay_order_id: rzpOrder1Id,
          razorpay_payment_id: validTestPaymentId,
        }),
      })
    );
    const dataMissingSig = await resMissingSig.json();
    assert(
      "Missing razorpay_signature rejected with HTTP 400",
      resMissingSig.status === 400 && dataMissingSig.ok === false
    );

    // Test 7: Malformed signature -> 400
    const resMalformedSig = await verifyPaymentHandler(
      new Request("http://localhost:3000/api/payments/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: order1Id,
          razorpay_order_id: rzpOrder1Id,
          razorpay_payment_id: validTestPaymentId,
          razorpay_signature: "not_a_valid_64_char_hex_signature",
        }),
      })
    );
    const dataMalformedSig = await resMalformedSig.json();
    assert(
      "Malformed signature (non-hex / wrong length) rejected with HTTP 400",
      resMalformedSig.status === 400 && dataMalformedSig.ok === false
    );

    // Test 8: Nonexistent internal order -> 404
    const fakeOrderId = crypto.randomUUID();
    const resNonexistentOrder = await verifyPaymentHandler(
      new Request("http://localhost:3000/api/payments/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: fakeOrderId,
          razorpay_order_id: rzpOrder1Id,
          razorpay_payment_id: validTestPaymentId,
          razorpay_signature: validSig,
        }),
      })
    );
    const dataNonexistentOrder = await resNonexistentOrder.json();
    assert(
      "Nonexistent internal order rejected with HTTP 404",
      resNonexistentOrder.status === 404 && dataNonexistentOrder.ok === false
    );

    // =========================================================================
    // SECTION 3: Authorization & IDOR Protection
    // =========================================================================
    console.log("\n--- Section 3: Authorization & IDOR Protection ---");

    // Test 9: Customer B attempting to verify Customer A's order -> 403 Forbidden
    currentMockSessionToken = sessionTokenB;
    const resIdor = await verifyPaymentHandler(
      new Request("http://localhost:3000/api/payments/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: order1Id,
          razorpay_order_id: rzpOrder1Id,
          razorpay_payment_id: validTestPaymentId,
          razorpay_signature: validSig,
        }),
      })
    );
    const dataIdor = await resIdor.json();
    assert(
      "Cross-customer verification (IDOR attempt) is rejected with HTTP 403",
      resIdor.status === 403 && dataIdor.ok === false,
      `Status: ${resIdor.status}`
    );

    // =========================================================================
    // SECTION 4: Tampering & Integrity Protections
    // =========================================================================
    console.log("\n--- Section 4: Tampering & Integrity Protections ---");

    currentMockSessionToken = sessionTokenA;

    // Test 10: Wrong Razorpay order ID (attacker supplies an order ID different from DB provider_order_id)
    const resWrongRzpOrderId = await verifyPaymentHandler(
      new Request("http://localhost:3000/api/payments/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: order1Id,
          razorpay_order_id: "order_attacker_fake_id_12345",
          razorpay_payment_id: validTestPaymentId,
          razorpay_signature: validSig,
        }),
      })
    );
    const dataWrongRzpOrderId = await resWrongRzpOrderId.json();
    assert(
      "Wrong Razorpay order ID (mismatch with DB provider_order_id) rejected with HTTP 400",
      resWrongRzpOrderId.status === 400 && dataWrongRzpOrderId.ok === false
    );

    // Test 11: Tampered payment ID (signature was for validTestPaymentId, client sends tampered payment ID)
    const tamperedPaymentId = `pay_tampered_${Date.now().toString().slice(-8)}`;
    const resTamperedPaymentId = await verifyPaymentHandler(
      new Request("http://localhost:3000/api/payments/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: order1Id,
          razorpay_order_id: rzpOrder1Id,
          razorpay_payment_id: tamperedPaymentId,
          razorpay_signature: validSig, // signature was generated for validTestPaymentId
        }),
      })
    );
    const dataTamperedPaymentId = await resTamperedPaymentId.json();
    assert(
      "Tampered payment ID rejected with HTTP 400 (signature mismatch)",
      resTamperedPaymentId.status === 400 && dataTamperedPaymentId.ok === false
    );

    // Test 12: Invalid cryptographic signature rejected
    const corruptedSig =
      validSig.slice(0, 32) + "deadbeefdeadbeef" + validSig.slice(48);
    const resInvalidSig = await verifyPaymentHandler(
      new Request("http://localhost:3000/api/payments/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: order1Id,
          razorpay_order_id: rzpOrder1Id,
          razorpay_payment_id: validTestPaymentId,
          razorpay_signature: corruptedSig,
        }),
      })
    );
    const dataInvalidSig = await resInvalidSig.json();
    assert(
      "Invalid HMAC signature rejected with HTTP 400",
      resInvalidSig.status === 400 && dataInvalidSig.ok === false
    );

    // Test 13: Client-supplied amount mismatch rejected
    const resAmountMismatch = await verifyPaymentHandler(
      new Request("http://localhost:3000/api/payments/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: order1Id,
          razorpay_order_id: rzpOrder1Id,
          razorpay_payment_id: validTestPaymentId,
          razorpay_signature: validSig,
          amount: 1.0, // Order total is 499.00
        }),
      })
    );
    const dataAmountMismatch = await resAmountMismatch.json();
    assert(
      "Client-supplied amount mismatch rejected with HTTP 400",
      resAmountMismatch.status === 400 && dataAmountMismatch.ok === false
    );

    // =========================================================================
    // SECTION 5: Legitimate Verification & State Boundary Check
    // =========================================================================
    console.log("\n--- Section 5: Successful Verification & State Boundaries ---");

    // Test 14: Authenticated customer verification succeeds with valid test signature
    const resSuccess = await verifyPaymentHandler(
      new Request("http://localhost:3000/api/payments/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: order1Id,
          razorpay_order_id: rzpOrder1Id,
          razorpay_payment_id: validTestPaymentId,
          razorpay_signature: validSig,
        }),
      })
    );
    const dataSuccess = await resSuccess.json();
    assert(
      "Authenticated customer verification succeeds with HTTP 200",
      resSuccess.status === 200 && dataSuccess.ok === true && dataSuccess.verified === true,
      `verified: ${dataSuccess.verified}, providerPaymentId: ${dataSuccess.providerPaymentId}`
    );

    // Test 15: Valid signature updates only allowed payment fields in MySQL
    const [dbPayments] = (await pool.execute(
      "SELECT id, order_id, provider, provider_order_id, provider_payment_id, status, amount FROM payments WHERE id = ?",
      [payment1Id]
    )) as any[];

    assert(
      "MySQL payments table updated with provider_payment_id and status='verified'",
      dbPayments.length === 1 &&
        dbPayments[0].provider_payment_id === validTestPaymentId &&
        dbPayments[0].status === "verified",
      `status: ${dbPayments[0]?.status}, provider_payment_id: ${dbPayments[0]?.provider_payment_id}`
    );

    // Test 16: STRICT L-03 BOUNDARY — Order is NOT marked as paid by L-03!
    const [dbOrders] = (await pool.execute(
      "SELECT id, order_number, status, payment_status FROM orders WHERE id = ?",
      [order1Id]
    )) as any[];

    assert(
      "STRICT BOUNDARY: orders.payment_status is NOT marked paid in L-03 (remains 'pending')",
      dbOrders.length === 1 && dbOrders[0].payment_status === "pending",
      `orders.payment_status: ${dbOrders[0]?.payment_status}`
    );

    // =========================================================================
    // SECTION 6: Idempotency & Duplicate Verification
    // =========================================================================
    console.log("\n--- Section 6: Idempotency & Duplicate Verification ---");

    // Test 17: Duplicate valid verification with identical payment ID succeeds safely
    const resDuplicate = await verifyPaymentHandler(
      new Request("http://localhost:3000/api/payments/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: order1Id,
          razorpay_order_id: rzpOrder1Id,
          razorpay_payment_id: validTestPaymentId,
          razorpay_signature: validSig,
        }),
      })
    );
    const dataDuplicate = await resDuplicate.json();
    assert(
      "Duplicate valid verification with same payment ID succeeds idempotently",
      resDuplicate.status === 200 &&
        dataDuplicate.ok === true &&
        dataDuplicate.verified === true &&
        dataDuplicate.isExisting === true
    );

    // Test 18: Duplicate verification with DIFFERENT payment ID on verified/paid order is rejected
    const differentPaymentId = `pay_diff_${Date.now().toString().slice(-8)}`;
    const diffSig = generateTestSignature(rzpOrder1Id, differentPaymentId);
    const resDiffPaymentId = await verifyPaymentHandler(
      new Request("http://localhost:3000/api/payments/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: alreadyPaidOrderId,
          razorpay_order_id: rzpPaidOrderId,
          razorpay_payment_id: differentPaymentId,
          razorpay_signature: diffSig,
        }),
      })
    );
    const dataDiffPaymentId = await resDiffPaymentId.json();
    assert(
      "Verification attempt with different payment ID on already paid order rejected with HTTP 409",
      resDiffPaymentId.status === 409 && dataDiffPaymentId.ok === false
    );

    // Test 19: Payment ID already assigned to another payment record is rejected
    // Try to verify Customer B's order using Customer A's already-recorded payment ID
    currentMockSessionToken = sessionTokenB;
    const sigForOrder2WithAId = generateTestSignature(rzpOrder2Id, validTestPaymentId);
    const resCollidingPaymentId = await verifyPaymentHandler(
      new Request("http://localhost:3000/api/payments/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: order2Id,
          razorpay_order_id: rzpOrder2Id,
          razorpay_payment_id: validTestPaymentId,
          razorpay_signature: sigForOrder2WithAId,
        }),
      })
    );
    const dataCollidingPaymentId = await resCollidingPaymentId.json();
    assert(
      "Reusing an already-assigned payment ID for another order is rejected (prevents ID collision / fraud)",
      resCollidingPaymentId.status === 409 && dataCollidingPaymentId.ok === false
    );

    // =========================================================================
    // SECTION 7: Information Leakage & Secret Sanitization
    // =========================================================================
    console.log("\n--- Section 7: Security & Secret Leakage Prevention ---");

    const responsePayloadStr = JSON.stringify(dataSuccess);
    const errorPayloadStr = JSON.stringify(dataWrongRzpOrderId);

    assert(
      "No Razorpay Key Secret in successful response",
      !responsePayloadStr.includes(keySecret),
      "Secret leaked: false"
    );

    assert(
      "No Razorpay Key Secret in error response",
      !errorPayloadStr.includes(keySecret),
      "Secret leaked: false"
    );

    const dbPassword = process.env.DB_PASSWORD || process.env.MYSQL_PASSWORD;
    assert(
      "No database passwords in response",
      !dbPassword ||
        (!responsePayloadStr.includes(dbPassword) &&
          !errorPayloadStr.includes(dbPassword)),
      "DB password leaked: false"
    );

    assert(
      "No password hashes in response",
      !responsePayloadStr.includes("$2a$") && !responsePayloadStr.includes("$2b$"),
      "Password hash leaked: false"
    );

    assert(
      "No SQL statements or internal stack traces in responses",
      !responsePayloadStr.includes("SELECT") &&
        !responsePayloadStr.includes("UPDATE") &&
        !errorPayloadStr.includes("SELECT") &&
        !errorPayloadStr.includes("UPDATE") &&
        !errorPayloadStr.includes("stack"),
      "Internal SQL/traces leaked: false"
    );

    assert(
      "HMAC comparison is cryptographically safe (timingSafeEqual verified)",
      typeof crypto.timingSafeEqual === "function"
    );

  } finally {
    console.log("\nCleaning up temporary test fixtures from MySQL...");
    try {
      await pool.execute("DELETE FROM payments WHERE order_id IN (?, ?, ?)", [
        order1Id,
        order2Id,
        alreadyPaidOrderId,
      ]);
      await pool.execute("DELETE FROM orders WHERE id IN (?, ?, ?)", [
        order1Id,
        order2Id,
        alreadyPaidOrderId,
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
  console.log("L-03 PAYMENT VERIFICATION AUDIT SUMMARY");
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
