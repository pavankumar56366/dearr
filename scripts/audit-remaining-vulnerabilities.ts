import fs from "fs";
import path from "path";
import crypto from "crypto";
import mysql from "mysql2/promise";
import { SignJWT, decodeJwt } from "jose";

import { loadTestEnvironment, assertTestDatabaseSafety } from "./test-db-safety";

// Load test environment safely (.env.test.local preferred, fail closed against non-test DB)
loadTestEnvironment();
assertTestDatabaseSafety();

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const dbHost = process.env.DB_HOST || "127.0.0.1";
const dbPort = parseInt(process.env.DB_PORT || "3306", 10);
const dbName = "dearr_test";
const dbUser = process.env.DB_USER || "dearr_local_user";
const dbPassword = process.env.DB_PASSWORD || "";
const authSecretString = (process.env.AUTH_SECRET || process.env.SESSION_SECRET || "").trim();
const authSecretKey = new TextEncoder().encode(authSecretString);
const razorpayKeySecret = (process.env.RAZORPAY_KEY_SECRET || "").trim();
const razorpayWebhookSecret = (process.env.RAZORPAY_WEBHOOK_SECRET || "").trim();

// Absolute safety preflight
assertTestDatabaseSafety({
  host: dbHost,
  port: dbPort,
  database: dbName,
  user: dbUser,
  password: dbPassword,
  isTestMode: true,
});

export type TestStatus = "PASS" | "FAIL" | "BLOCKED" | "NOT TESTED";

export interface TestResult {
  id: string;
  category: string;
  name: string;
  status: TestStatus;
  route: string;
  evidence: string;
  details?: string;
}

const results: TestResult[] = [];

function record(
  id: string,
  category: string,
  name: string,
  status: TestStatus,
  route: string,
  evidence: string,
  details?: string
) {
  results.push({ id, category, name, status, route, evidence, details });
  const icon = status === "PASS" ? "✓ PASS" : status === "FAIL" ? "✗ FAIL" : status === "BLOCKED" ? "⊘ BLOCKED" : "? NOT TESTED";
  console.log(`[${icon}] ${id}: ${name} (${route})`);
  console.log(`       Evidence: ${evidence}`);
}

async function getDb() {
  return mysql.createConnection({
    host: dbHost,
    port: dbPort,
    database: dbName,
    user: dbUser,
    password: dbPassword,
  });
}

async function main() {
  console.log("================================================================================");
  console.log("DEARR V1 — REMAINING SECURITY VULNERABILITY AUDIT");
  console.log(`Target: ${baseUrl} | Database: ${dbName}@${dbHost}:${dbPort}`);
  console.log("================================================================================\n");

  const db = await getDb();
  const timestamp = Date.now();

  // Synthetic Test Users
  const custA_Email = `qa_audit_a_${timestamp}@dearr.test`;
  const custB_Email = `qa_audit_b_${timestamp}@dearr.test`;
  const testPassword = "AuditP@ssword987!";

  let tokenA = "";
  let cookieA = "";
  let idA = "";

  let tokenB = "";
  let cookieB = "";
  let idB = "";

  let adminToken = "";
  let adminCookie = "";

  try {
    // -------------------------------------------------------------------------
    // SETUP: Create Synthetic Customer A, Customer B, and locate Admin
    // -------------------------------------------------------------------------
    console.log("--- SETUP: Preparing Isolated Synthetic Accounts ---");

    // Register Customer A
    const resA = await fetch(`${baseUrl}/api/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "QA Customer A", email: custA_Email, password: testPassword }),
    });
    const dataA = await resA.json();
    idA = dataA.user?.id;
    const cookieHeaderA = resA.headers.get("set-cookie") || "";
    const matchA = cookieHeaderA.match(/dearr_session=([^;]+)/);
    tokenA = matchA ? matchA[1] : "";
    cookieA = `dearr_session=${tokenA}`;

    // Register Customer B
    const resB = await fetch(`${baseUrl}/api/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "QA Customer B", email: custB_Email, password: testPassword }),
    });
    const dataB = await resB.json();
    idB = dataB.user?.id;
    const cookieHeaderB = resB.headers.get("set-cookie") || "";
    const matchB = cookieHeaderB.match(/dearr_session=([^;]+)/);
    tokenB = matchB ? matchB[1] : "";
    cookieB = `dearr_session=${tokenB}`;

    // Locate or create Admin session
    const [adminRows]: any = await db.query("SELECT id, email, role, token_version FROM profiles WHERE role = 'admin' LIMIT 1");
    let adminUser = adminRows[0];
    if (!adminUser) {
      const adminId = `admin_qa_${timestamp}`;
      const adminEmail = `admin_qa_${timestamp}@dearr.test`;
      await db.query(
        "INSERT INTO profiles (id, email, full_name, role, status, token_version, created_at, updated_at) VALUES (?, ?, 'QA Admin', 'admin', 'active', 1, NOW(), NOW())",
        [adminId, adminEmail]
      );
      adminUser = { id: adminId, email: adminEmail, role: "admin", token_version: 1 };
    }

    adminToken = await new SignJWT({
      sub: adminUser.id,
      email: adminUser.email,
      fullName: "QA Admin",
      role: "admin",
      tokenVersion: adminUser.token_version ?? 1,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("7d")
      .sign(authSecretKey);
    adminCookie = `dearr_session=${adminToken}`;

    console.log(`Synthetic Accounts Initialized: Customer A (${idA}), Customer B (${idB}), Admin (${adminUser.id})\n`);

    // Fetch sample active product & color for testing
    const [prodRows]: any = await db.query(
      "SELECT id, name, price, stock_quantity, has_colors, cod_enabled FROM products WHERE is_active = 1 LIMIT 1"
    );
    const testProduct = prodRows[0];
    let testColorId: string | null = null;
    if (testProduct.has_colors) {
      const [colorRows]: any = await db.query(
        "SELECT id FROM product_colors WHERE product_id = ? AND is_active = 1 AND stock > 0 ORDER BY stock DESC LIMIT 1",
        [testProduct.id]
      );
      if (colorRows && colorRows.length > 0) {
        testColorId = colorRows[0].id;
      }
    }

    // =========================================================================
    // PRIORITY 1: PAYMENT END-TO-END
    // =========================================================================
    console.log("=== PRIORITY 1: Payment End-to-End ===");

    // 1.1 Test-mode Gateway Intent & Payment Order Creation
    const orderAttemptRes = await fetch(`${baseUrl}/api/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookieA },
      body: JSON.stringify({
        shippingFullName: "QA Customer A",
        shippingPhone: "9876543210",
        shippingAddressLine1: "123 Test St",
        shippingCity: "Hyderabad",
        shippingState: "Telangana",
        shippingPostalCode: "500001",
        shippingCountry: "India",
        isBuyNow: true,
        items: [{ productId: testProduct.id, colorId: testColorId || undefined, quantity: 1 }],
      }),
    });
    const orderAttemptData = await orderAttemptRes.json();
    const testAttemptId = orderAttemptData.attemptId;

    let pmtCreateData: any = {};
    if (testAttemptId) {
      const pmtCreateRes = await fetch(`${baseUrl}/api/payments/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookieA },
        body: JSON.stringify({ orderId: testAttemptId }),
      });
      pmtCreateData = await pmtCreateRes.json();
    }

    const hasTestPrefix = pmtCreateData.keyId?.startsWith("rzp_test_") || false;
    const hasOrderPrefix = pmtCreateData.razorpayOrderId?.startsWith("order_") || false;
    record(
      "PAY-01",
      "Payment E2E",
      "Test-mode Gateway Order Creation",
      hasTestPrefix && hasOrderPrefix ? "PASS" : "FAIL",
      "POST /api/payments/create",
      `keyId prefix (rzp_test_): ${hasTestPrefix}, razorpayOrderId: ${hasOrderPrefix ? "order_***" : pmtCreateData.razorpayOrderId || "N/A"}`
    );

    // 1.2 Payment Failure Lifecycle
    if (testAttemptId) {
      const failRes = await fetch(`${baseUrl}/api/checkout/attempts/${testAttemptId}/failed`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookieA },
        body: JSON.stringify({
          errorCode: "BAD_REQUEST_ERROR",
          errorDescription: "Payment failed at test gateway",
        }),
      });
      const [attemptAfterFail]: any = await db.query("SELECT status, order_id FROM checkout_attempts WHERE id = ?", [testAttemptId]);
      const statusIsFailed = attemptAfterFail[0]?.status === "failed";
      const noOrderCreated = attemptAfterFail[0]?.order_id === null;

      record(
        "PAY-02",
        "Payment E2E",
        "Payment Failure Lifecycle & Isolation",
        failRes.status === 200 && statusIsFailed && noOrderCreated ? "PASS" : "FAIL",
        "POST /api/checkout/attempts/[id]/failed",
        `HTTP ${failRes.status}, attempt status: '${attemptAfterFail[0]?.status}', order_id: ${attemptAfterFail[0]?.order_id}`
      );
    } else {
      record("PAY-02", "Payment E2E", "Payment Failure Lifecycle & Isolation", "BLOCKED", "POST /api/checkout/attempts/[id]/failed", "Attempt creation failed");
    }

    // 1.3 Payment Cancellation / Dismissal Lifecycle
    const orderAttemptRes2 = await fetch(`${baseUrl}/api/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookieA },
      body: JSON.stringify({
        shippingFullName: "QA Customer A",
        shippingPhone: "9876543210",
        shippingAddressLine1: "123 Test St",
        shippingCity: "Hyderabad",
        shippingState: "Telangana",
        shippingPostalCode: "500001",
        shippingCountry: "India",
        isBuyNow: true,
        items: [{ productId: testProduct.id, colorId: testColorId || undefined, quantity: 1 }],
      }),
    });
    const orderAttemptData2 = await orderAttemptRes2.json();
    const dismissAttemptId = orderAttemptData2.attemptId;

    if (dismissAttemptId) {
      const dismissRes = await fetch(`${baseUrl}/api/checkout/attempts/${dismissAttemptId}/dismissed`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookieA },
        body: JSON.stringify({ reason: "user_closed_modal" }),
      });
      const [attemptAfterDismiss]: any = await db.query("SELECT status, order_id FROM checkout_attempts WHERE id = ?", [dismissAttemptId]);
      const statusIsAbandoned = attemptAfterDismiss[0]?.status === "abandoned";
      const noOrderCreated = attemptAfterDismiss[0]?.order_id === null;

      record(
        "PAY-03",
        "Payment E2E",
        "Payment Dismissal / Cancellation Lifecycle",
        dismissRes.status === 200 && statusIsAbandoned && noOrderCreated ? "PASS" : "FAIL",
        "POST /api/checkout/attempts/[id]/dismissed",
        `HTTP ${dismissRes.status}, attempt status: '${attemptAfterDismiss[0]?.status}', order_id: ${attemptAfterDismiss[0]?.order_id}`
      );
    } else {
      record("PAY-03", "Payment E2E", "Payment Dismissal / Cancellation Lifecycle", "BLOCKED", "POST /api/checkout/attempts/[id]/dismissed", "Attempt creation failed");
    }

    // 1.4 Webhook Replay & Idempotency
    const webhookOrderId = `order_wh_test_${timestamp}`;
    const webhookPaymentId = `pay_wh_test_${timestamp}`;
    const whAttemptId = `att_wh_${timestamp}`;
    await db.query(
      `INSERT INTO checkout_attempts (id, user_id, provider, provider_order_id, amount, currency, status, checkout_data, expires_at, retention_until, created_at, updated_at)
       VALUES (?, ?, 'razorpay', ?, ?, 'INR', 'pending', ?, DATE_ADD(NOW(), INTERVAL 30 MINUTE), DATE_ADD(NOW(), INTERVAL 30 DAY), NOW(), NOW())`,
      [
        whAttemptId,
        idA,
        webhookOrderId,
        testProduct.price,
        JSON.stringify({
          shippingFullName: "QA Customer A",
          shippingPhone: "9876543210",
          shippingAddressLine1: "123 Test St",
          shippingCity: "Hyderabad",
          shippingState: "Telangana",
          shippingPostalCode: "500001",
          shippingCountry: "India",
          isBuyNow: true,
          items: [{ productId: testProduct.id, colorId: testColorId || undefined, quantity: 1, unitPrice: testProduct.price }],
        }),
      ]
    );

    const webhookPayload = JSON.stringify({
      entity: "event",
      account_id: "acc_test",
      event: "payment.captured",
      contains: ["payment"],
      payload: {
        payment: {
          entity: {
            id: webhookPaymentId,
            order_id: webhookOrderId,
            amount: testProduct.price * 100,
            currency: "INR",
            status: "captured",
          },
        },
      },
      created_at: Math.floor(Date.now() / 1000),
    });

    const validWebhookSig = crypto
      .createHmac("sha256", razorpayWebhookSecret)
      .update(webhookPayload)
      .digest("hex");

    // First delivery
    const whRes1 = await fetch(`${baseUrl}/api/payments/webhook`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-razorpay-signature": validWebhookSig,
      },
      body: webhookPayload,
    });

    // Second delivery (Replay)
    const whRes2 = await fetch(`${baseUrl}/api/payments/webhook`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-razorpay-signature": validWebhookSig,
      },
      body: webhookPayload,
    });
    const whData2 = await whRes2.json();

    const [whOrders]: any = await db.query(
      "SELECT o.id, o.order_number, o.payment_status FROM orders o INNER JOIN payments p ON o.id = p.order_id WHERE p.provider_payment_id = ?",
      [webhookPaymentId]
    );

    const exactlyOneOrder = whOrders.length === 1;
    const isPaid = whOrders[0]?.payment_status === "paid";
    const replayHandledCleanly = whRes2.status === 200 && whData2.ok === true;

    record(
      "PAY-04",
      "Payment E2E",
      "Webhook Signature Verification & Idempotent Replay Handling",
      whRes1.status === 200 && replayHandledCleanly && exactlyOneOrder && isPaid ? "PASS" : "FAIL",
      "POST /api/payments/webhook",
      `First call: HTTP ${whRes1.status}, Replay call: HTTP ${whRes2.status}, Orders matching payment ID: ${whOrders.length}`
    );

    // 1.5 Webhook Bad Signature Rejection
    const badWebhookSig = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
    const whBadRes = await fetch(`${baseUrl}/api/payments/webhook`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-razorpay-signature": badWebhookSig,
      },
      body: webhookPayload,
    });
    record(
      "PAY-05",
      "Payment E2E",
      "Forged Webhook Signature Rejection",
      whBadRes.status === 400 ? "PASS" : "FAIL",
      "POST /api/payments/webhook",
      `HTTP ${whBadRes.status} (expected 400 Bad Request)`
    );

    // 1.6 Duplicate Verification Idempotency on /api/payments/verify
    const verifyOrderId = `ord_verify_${timestamp}`;
    const verifyRzpOrderId = `order_v_${timestamp}`;
    const verifyPaymentId = `pay_v_${timestamp}`;

    await db.query(
      `INSERT INTO orders (id, order_number, user_id, status, payment_status, subtotal, discount_amount, shipping_amount, total_amount, currency, shipping_full_name, shipping_phone, shipping_address_line_1, shipping_city, shipping_state, shipping_postal_code, shipping_country, created_at, updated_at)
       VALUES (?, ?, ?, 'pending', 'pending', ?, 0, 0, ?, 'INR', 'QA Customer A', '9876543210', '123 Test St', 'Hyderabad', 'Telangana', '500001', 'India', NOW(), NOW())`,
      [verifyOrderId, `DEAR-V${timestamp.toString().slice(-4)}`, idA, testProduct.price, testProduct.price]
    );

    await db.query(
      `INSERT INTO payments (id, order_id, amount, currency, status, provider, provider_order_id, created_at, updated_at)
       VALUES (?, ?, ?, 'INR', 'pending', 'razorpay', ?, NOW(), NOW())`,
      [`pmt_v_${timestamp}`, verifyOrderId, testProduct.price, verifyRzpOrderId]
    );

    const validVerifySig = crypto
      .createHmac("sha256", razorpayKeySecret)
      .update(`${verifyRzpOrderId}|${verifyPaymentId}`)
      .digest("hex");

    // Call 1
    const vRes1 = await fetch(`${baseUrl}/api/payments/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookieA },
      body: JSON.stringify({
        orderId: verifyOrderId,
        razorpay_order_id: verifyRzpOrderId,
        razorpay_payment_id: verifyPaymentId,
        razorpay_signature: validVerifySig,
      }),
    });

    // Call 2 (Duplicate)
    const vRes2 = await fetch(`${baseUrl}/api/payments/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookieA },
      body: JSON.stringify({
        orderId: verifyOrderId,
        razorpay_order_id: verifyRzpOrderId,
        razorpay_payment_id: verifyPaymentId,
        razorpay_signature: validVerifySig,
      }),
    });

    const [pmtRows]: any = await db.query("SELECT status, provider_payment_id FROM payments WHERE id = ?", [`pmt_v_${timestamp}`]);
    record(
      "PAY-06",
      "Payment E2E",
      "Duplicate Payment Verification Idempotency",
      vRes1.status === 200 && vRes2.status === 200 && pmtRows[0]?.status === "verified" ? "PASS" : "FAIL",
      "POST /api/payments/verify",
      `Call 1: HTTP ${vRes1.status}, Call 2: HTTP ${vRes2.status}, Payment status in DB: '${pmtRows[0]?.status}'`
    );

    // =========================================================================
    // PRIORITY 2: IDOR AND AUTHORIZATION
    // =========================================================================
    console.log("\n=== PRIORITY 2: IDOR and Authorization ===");

    // Create an order owned by Customer B
    const orderB_Id = `ord_custB_${timestamp}`;
    await db.query(
      `INSERT INTO orders (id, order_number, user_id, status, payment_status, subtotal, discount_amount, shipping_amount, total_amount, currency, shipping_full_name, shipping_phone, shipping_address_line_1, shipping_city, shipping_state, shipping_postal_code, shipping_country, created_at, updated_at)
       VALUES (?, ?, ?, 'pending', 'paid', 500, 0, 0, 500, 'INR', 'Customer B', '9876543211', '456 B St', 'Mumbai', 'Maharashtra', '400001', 'India', NOW(), NOW())`,
      [orderB_Id, `DEAR-B${timestamp.toString().slice(-4)}`, idB]
    );

    // 2.1 Order Read IDOR: Customer A attempts to fetch Customer B's order
    const idorOrderRes = await fetch(`${baseUrl}/api/orders/${orderB_Id}`, {
      headers: { Cookie: cookieA },
    });
    record(
      "IDOR-01",
      "IDOR & Authorization",
      "Cross-Customer Order Read IDOR Defense",
      idorOrderRes.status === 404 ? "PASS" : "FAIL",
      "GET /api/orders/[id]",
      `HTTP ${idorOrderRes.status} (expected 404 Not Found to prevent IDOR and enumeration)`
    );

    // 2.2 Order Address Change IDOR: Customer A attempts to update Customer B's shipping address
    const idorAddrRes = await fetch(`${baseUrl}/api/orders/${orderB_Id}/shipping-address`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookieA },
      body: JSON.stringify({
        shippingFullName: "Attacker A",
        shippingPhone: "9876543210",
        shippingAddressLine1: "123 Attacker St",
        shippingCity: "Mumbai",
        shippingState: "Maharashtra",
        shippingPostalCode: "400001",
        shippingCountry: "India",
      }),
    });
    record(
      "IDOR-02",
      "IDOR & Authorization",
      "Cross-Customer Order Address Mutation IDOR Defense",
      idorAddrRes.status === 403 || idorAddrRes.status === 404 ? "PASS" : "FAIL",
      "PATCH /api/orders/[id]/shipping-address",
      `HTTP ${idorAddrRes.status} (expected 403 Forbidden or 404 Not Found)`
    );

    // 2.3 Address Book IDOR: Customer B creates an address, Customer A attempts to read/edit/delete it
    const createAddrB = await fetch(`${baseUrl}/api/customer/addresses`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookieB },
      body: JSON.stringify({
        fullName: "Customer B Private",
        phone: "9876543211",
        email: custB_Email,
        addressLine1: "Private Residence B",
        city: "Bengaluru",
        state: "Karnataka",
        postalCode: "560001",
        country: "India",
      }),
    });
    const addrBData = await createAddrB.json();
    const addrB_Id = addrBData.address?.id;

    if (addrB_Id) {
      // Customer A tries to update B's address
      const patchAddrRes = await fetch(`${baseUrl}/api/customer/addresses/${addrB_Id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Cookie: cookieA },
        body: JSON.stringify({ fullName: "Attacker A Overwrite" }),
      });
      // Customer A tries to delete B's address
      const deleteAddrRes = await fetch(`${baseUrl}/api/customer/addresses/${addrB_Id}`, {
        method: "DELETE",
        headers: { Cookie: cookieA },
      });

      record(
        "IDOR-03",
        "IDOR & Authorization",
        "Cross-Customer Saved Address IDOR Defense",
        (patchAddrRes.status === 403 || patchAddrRes.status === 404) && (deleteAddrRes.status === 403 || deleteAddrRes.status === 404) ? "PASS" : "FAIL",
        "PATCH / DELETE /api/customer/addresses/[id]",
        `Patch: HTTP ${patchAddrRes.status}, Delete: HTTP ${deleteAddrRes.status} (expected 403/404)`
      );
    } else {
      record("IDOR-03", "IDOR & Authorization", "Cross-Customer Saved Address IDOR Defense", "BLOCKED", "GET /api/customer/addresses/[id]", `Address creation failed: ${JSON.stringify(addrBData)}`);
    }

    // 2.4 Profile Mutation IDOR: Customer A attempts to update Customer B's profile
    const idorProfileRes = await fetch(`${baseUrl}/api/customer/profile`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookieA },
      body: JSON.stringify({
        targetUserId: idB,
        fullName: "Hacked By A",
      }),
    });
    record(
      "IDOR-04",
      "IDOR & Authorization",
      "Profile Modification IDOR Defense",
      idorProfileRes.status === 403 ? "PASS" : "FAIL",
      "PATCH /api/customer/profile",
      `HTTP ${idorProfileRes.status} (expected 403 Forbidden)`
    );

    // 2.5 Admin API Authorization: Customer A calling Admin endpoints
    const adminEndpoints = [
      { name: "Admin Orders List", route: "/api/admin/orders" },
      { name: "Admin Products List", route: "/api/admin/products" },
      { name: "Admin Store Settings", route: "/api/admin/settings" },
      { name: "Admin Abandonment Dashboard", route: "/api/admin/abandonment/summary" },
      { name: "Admin Privilege Verification", route: "/api/admin/verify" },
    ];

    let allAdminBlocked = true;
    const adminStatusSummary: string[] = [];

    for (const ep of adminEndpoints) {
      const res = await fetch(`${baseUrl}${ep.route}`, {
        headers: { Cookie: cookieA },
      });
      if (res.status !== 403) {
        allAdminBlocked = false;
      }
      adminStatusSummary.push(`${ep.name}: ${res.status}`);
    }

    record(
      "IDOR-05",
      "IDOR & Authorization",
      "Customer Calling Admin Endpoints Authorization Barrier",
      allAdminBlocked ? "PASS" : "FAIL",
      "/api/admin/*",
      adminStatusSummary.join(" | ")
    );

    // =========================================================================
    // PRIORITY 3: CSRF & ORIGIN VALIDATION
    // =========================================================================
    console.log("\n=== PRIORITY 3: CSRF & Origin Validation ===");

    // Test endpoints against hostile Origin: https://evil-attacker.com
    const csrfEndpoints = [
      { id: "CSRF-01", name: "User Registration", method: "POST", route: "/api/auth/signup", body: { name: "Attacker", email: `evil_${timestamp}@test.com`, password: "P@" } },
      { id: "CSRF-02", name: "User Login", method: "POST", route: "/api/auth/login", body: { email: custA_Email, password: testPassword } },
      { id: "CSRF-03", name: "User Logout", method: "POST", route: "/api/auth/logout", body: {} },
      { id: "CSRF-04", name: "Order Placement", method: "POST", route: "/api/orders", body: { shippingFullName: "Attacker" } },
      { id: "CSRF-05", name: "Address Edit", method: "PATCH", route: `/api/orders/${orderB_Id}/shipping-address`, body: { shippingCity: "EvilCity" } },
      { id: "CSRF-06", name: "Cart Mutation", method: "POST", route: "/api/cart/items", body: { productId: testProduct.id, quantity: 1 } },
      { id: "CSRF-07", name: "Customer Address", method: "POST", route: "/api/customer/addresses", body: { fullName: "Evil", addressLine1: "123" } },
      { id: "CSRF-08", name: "Customer Profile", method: "PATCH", route: "/api/customer/profile", body: { fullName: "Hacked" } },
      { id: "CSRF-09", name: "Admin Settings", method: "POST", route: "/api/admin/settings", body: { storeName: "Compromised" } },
    ];

    for (const ep of csrfEndpoints) {
      const hostileRes = await fetch(`${baseUrl}${ep.route}`, {
        method: ep.method,
        headers: {
          "Content-Type": "application/json",
          Origin: "https://evil-attacker.com",
          Cookie: ep.route.startsWith("/api/admin") ? adminCookie : cookieA,
        },
        body: JSON.stringify(ep.body),
      });

      const blocksHostile = hostileRes.status === 403;
      record(
        ep.id,
        "CSRF / Origin",
        `${ep.name} Hostile Origin Enforcement`,
        blocksHostile ? "PASS" : "FAIL",
        `${ep.method} ${ep.route}`,
        `Origin 'https://evil-attacker.com' -> HTTP ${hostileRes.status} (assertSafeOrigin enforced: ${blocksHostile})`
      );
    }

    // =========================================================================
    // PRIORITY 4: SESSION LIFECYCLE
    // =========================================================================
    console.log("\n=== PRIORITY 4: Session Lifecycle ===");

    // 4.1 Logout Set-Cookie clearing and server-side revocation
    const logoutRes = await fetch(`${baseUrl}/api/auth/logout`, {
      method: "POST",
      headers: { Cookie: cookieA },
    });
    const logoutCookie = logoutRes.headers.get("set-cookie") || "";
    const clearsCookie = logoutCookie.includes("Max-Age=0") || logoutCookie.includes("Expires=Thu, 01 Jan 1970");
    record(
      "SESS-01",
      "Session Lifecycle",
      "Logout Set-Cookie Clearing (Max-Age=0)",
      clearsCookie && logoutRes.status === 200 ? "PASS" : "FAIL",
      "POST /api/auth/logout",
      `HTTP ${logoutRes.status}, Set-Cookie: ${clearsCookie ? "Max-Age=0 confirmed" : "Missing expiration"}`
    );

    // 4.2 Stateless JWT Token Usability After Logout (Residual Risk Audit)
    const postLogoutMeRes = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Cookie: cookieA },
    });
    const postLogoutMeData = await postLogoutMeRes.json();
    const tokenStillValid = postLogoutMeRes.status === 200 && postLogoutMeData.ok === true;
    record(
      "SESS-02",
      "Session Lifecycle",
      "Stateless JWT Usability Post-Logout (Token Revocation Gap)",
      tokenStillValid ? "FAIL" : "PASS",
      "GET /api/auth/me with copied JWT",
      tokenStillValid
        ? "Copied JWT remains accepted (HTTP 200) after logout due to stateless HMAC verification without server-side revocation list"
        : "Copied JWT rejected after logout"
    );

    // Re-authenticate Customer A after logout to verify new session works and refresh cookieA
    const reAuthRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: custA_Email, password: testPassword }),
    });
    const reAuthCookieHeader = reAuthRes.headers.get("set-cookie") || "";
    const reAuthMatch = reAuthCookieHeader.match(/dearr_session=([^;]+)/);
    if (reAuthMatch) {
      tokenA = reAuthMatch[1];
      cookieA = `dearr_session=${tokenA}`;
    }

    // 4.3 Expired Token Rejection
    const expiredToken = await new SignJWT({
      sub: idA,
      email: custA_Email,
      role: "customer",
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt(Math.floor(Date.now() / 1000) - 7200)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 3600)
      .sign(authSecretKey);

    const expiredRes = await fetch(`${baseUrl}/api/customer/profile`, {
      headers: { Cookie: `dearr_session=${expiredToken}` },
    });
    record(
      "SESS-03",
      "Session Lifecycle",
      "Expired JWT Cryptographic Rejection",
      expiredRes.status === 401 ? "PASS" : "FAIL",
      "GET /api/customer/profile",
      `HTTP ${expiredRes.status} (expected 401 Unauthorized)`
    );

    // 4.4 Suspended Account Access Control
    await db.query("UPDATE profiles SET status = 'suspended' WHERE id = ?", [idA]);
    const suspendedRes = await fetch(`${baseUrl}/api/customer/profile`, {
      headers: { Cookie: cookieA },
    });
    await db.query("UPDATE profiles SET status = 'active' WHERE id = ?", [idA]);

    record(
      "SESS-04",
      "Session Lifecycle",
      "Suspended Customer Account Access Control",
      suspendedRes.status === 403 ? "PASS" : "FAIL",
      "GET /api/customer/profile",
      `HTTP ${suspendedRes.status} (expected 403 Forbidden for suspended profile)`
    );

    // =========================================================================
    // PRIORITY 5: RATE-LIMIT BYPASS & PROXY FORWARDING
    // =========================================================================
    // Reset rate limits for test IPs and unknown accounts before testing to ensure clean baseline
    await db.query("DELETE FROM rate_limits WHERE rate_key = 'login:fail:unknown_accounts' OR rate_key LIKE 'login:fail:ip:198.51.100.%'");

    // Send 20 failed login requests with cycling X-Forwarded-For IPs
    let spoofAllowedCount = 0;
    for (let i = 1; i <= 20; i++) {
      const spoofIp = `198.51.100.${i}`;
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Forwarded-For": spoofIp,
        },
        body: JSON.stringify({ email: `nonexistent_${timestamp}_${i}@dearr.test`, password: "WrongPassword123!" }),
      });
      if (res.status === 401) {
        spoofAllowedCount++;
      }
    }

    const spoofBypassed = spoofAllowedCount === 20;
    record(
      "RATE-01",
      "Rate Limiting & Proxy",
      "Client-Supplied X-Forwarded-For Spoofing Audit",
      spoofBypassed ? "FAIL" : "PASS",
      "POST /api/auth/login",
      spoofBypassed
        ? `All 20 attempts evaluated under spoofed IPs (HTTP 401, not throttled to 429). Client-supplied X-Forwarded-For bypasses rate limit unless sanitized by reverse proxy`
        : `Rate limit enforced despite spoofed headers`
    );

    // =========================================================================
    // PRIORITY 6: UPLOADS SECURITY
    // =========================================================================
    console.log("\n=== PRIORITY 6: Uploads Security ===");

    // 6.1 Unauthenticated Upload
    const unauthUpload = await fetch(`${baseUrl}/api/admin/products/images`, {
      method: "POST",
      body: new FormData(),
    });
    record(
      "UPL-01",
      "Uploads",
      "Unauthenticated Image Upload Barrier",
      unauthUpload.status === 401 ? "PASS" : "FAIL",
      "POST /api/admin/products/images",
      `HTTP ${unauthUpload.status} (expected 401)`
    );

    // 6.2 Customer Session Upload
    const custUpload = await fetch(`${baseUrl}/api/admin/products/images`, {
      method: "POST",
      headers: { Cookie: cookieA },
      body: new FormData(),
    });
    record(
      "UPL-02",
      "Uploads",
      "Customer Session Image Upload Privilege Barrier",
      custUpload.status === 403 ? "PASS" : "FAIL",
      "POST /api/admin/products/images",
      `HTTP ${custUpload.status} (expected 403)`
    );

    // 6.3 Spoofed MIME / Executable Disguised as JPEG
    const fakeJpegForm = new FormData();
    const fakeJpegBuffer = Buffer.from("<?php echo 'vulnerable'; ?>\n", "utf-8");
    fakeJpegForm.append("file", new Blob([fakeJpegBuffer], { type: "image/jpeg" }), "payload.jpg");

    const fakeJpegRes = await fetch(`${baseUrl}/api/admin/products/images`, {
      method: "POST",
      headers: { Cookie: adminCookie },
      body: fakeJpegForm,
    });
    const fakeJpegData = await fakeJpegRes.json();
    record(
      "UPL-03",
      "Uploads",
      "Magic Bytes Verification on Spoofed MIME Payload",
      fakeJpegRes.status === 400 && fakeJpegData.error?.includes("format") ? "PASS" : "FAIL",
      "POST /api/admin/products/images",
      `HTTP ${fakeJpegRes.status}, error: '${fakeJpegData.error}'`
    );

    // 6.4 Unsupported Type (.svg, .html)
    const svgForm = new FormData();
    const svgBuffer = Buffer.from("<svg onload='alert(1)'></svg>", "utf-8");
    svgForm.append("file", new Blob([svgBuffer], { type: "image/svg+xml" }), "vector.svg");

    const svgRes = await fetch(`${baseUrl}/api/admin/products/images`, {
      method: "POST",
      headers: { Cookie: adminCookie },
      body: svgForm,
    });
    record(
      "UPL-04",
      "Uploads",
      "Unsupported File Type (.svg) Rejection",
      svgRes.status === 400 ? "PASS" : "FAIL",
      "POST /api/admin/products/images",
      `HTTP ${svgRes.status} (expected 400 Bad Request)`
    );

    // 6.5 Oversized Payload (> 5MB)
    const largeForm = new FormData();
    const largeBuffer = Buffer.alloc(6 * 1024 * 1024); // 6MB
    largeForm.append("file", new Blob([largeBuffer], { type: "image/jpeg" }), "large.jpg");

    const largeRes = await fetch(`${baseUrl}/api/admin/products/images`, {
      method: "POST",
      headers: { Cookie: adminCookie },
      body: largeForm,
    });
    record(
      "UPL-05",
      "Uploads",
      "Oversized File Size Barrier (> 5 MB)",
      largeRes.status === 400 ? "PASS" : "FAIL",
      "POST /api/admin/products/images",
      `HTTP ${largeRes.status} (expected 400 Bad Request)`
    );

    // 6.6 Directory Traversal on Delete
    const deleteTraversalRes = await fetch(`${baseUrl}/api/admin/products/images?filename=../../package.json`, {
      method: "DELETE",
      headers: { Cookie: adminCookie },
    });
    const deleteTraversalData = await deleteTraversalRes.json();
    record(
      "UPL-06",
      "Uploads",
      "Directory Traversal Defense on Image Delete",
      deleteTraversalRes.status === 400 && deleteTraversalData.error?.includes("traversal") ? "PASS" : "FAIL",
      "DELETE /api/admin/products/images",
      `HTTP ${deleteTraversalRes.status}, error: '${deleteTraversalData.error}'`
    );

    // =========================================================================
    // PRIORITY 7: CART / ORDER / DISCOUNT LOGIC
    // =========================================================================
    console.log("\n=== PRIORITY 7: Cart, Order, and Discount Logic ===");

    // 7.1 Direct Mode Bypass Blocked
    const directRes = await fetch(`${baseUrl}/api/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookieA },
      body: JSON.stringify({
        mode: "direct",
        shippingFullName: "QA Customer A",
        shippingPhone: "9876543210",
        shippingAddressLine1: "123 Test St",
        shippingCity: "Hyderabad",
        shippingState: "Telangana",
        shippingPostalCode: "500001",
      }),
    });
    record(
      "ORD-01",
      "Order Logic",
      "Customer-Supplied Direct Order Mode Rejection",
      directRes.status === 400 ? "PASS" : "FAIL",
      "POST /api/orders",
      `HTTP ${directRes.status} (expected 400 Bad Request)`
    );

    // 7.2 Client Price Tampering in Buy Now
    const tamperRes = await fetch(`${baseUrl}/api/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookieA },
      body: JSON.stringify({
        isBuyNow: true,
        paymentMethod: "cod",
        items: [{ productId: testProduct.id, colorId: testColorId || undefined, quantity: 1, price: 1, unitPrice: 1, totalAmount: 1 }],
        shippingFullName: "QA Customer A",
        shippingPhone: "9876543210",
        shippingAddressLine1: "123 Test St",
        shippingCity: "Hyderabad",
        shippingState: "Telangana",
        shippingPostalCode: "500001",
      }),
    });
    const tamperData = await tamperRes.json();
    const serverEnforcedPrice =
      tamperRes.status === 400 || (tamperRes.status === 201 && tamperData.order?.totalAmount >= testProduct.price);
    record(
      "ORD-02",
      "Order Logic",
      "Client Price Tampering Immunity (Server-Authoritative Pricing)",
      serverEnforcedPrice ? "PASS" : "FAIL",
      "POST /api/orders",
      `HTTP ${tamperRes.status}, Order total charged: ₹${tamperData.order?.totalAmount || "N/A"} (Authoritative product price: ₹${testProduct.price})`
    );

    // 7.3 Invalid Quantity in Cart Addition (0, negative, excessive)
    const qty0Res = await fetch(`${baseUrl}/api/cart/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookieA },
      body: JSON.stringify({ productId: testProduct.id, quantity: 0 }),
    });
    const qtyNegRes = await fetch(`${baseUrl}/api/cart/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookieA },
      body: JSON.stringify({ productId: testProduct.id, quantity: -5 }),
    });
    record(
      "ORD-03",
      "Order Logic",
      "Invalid / Negative Cart Quantity Rejection",
      qty0Res.status === 400 && qtyNegRes.status === 400 ? "PASS" : "FAIL",
      "POST /api/cart/items",
      `Qty 0: HTTP ${qty0Res.status}, Qty -5: HTTP ${qtyNegRes.status} (both expected 400)`
    );

    // =========================================================================
    // PRIORITY 8: CACHING & INFORMATION LEAKAGE
    // =========================================================================
    console.log("\n=== PRIORITY 8: Caching and Information Leakage ===");

    // 8.1 Sensitive Endpoint Cache-Control Header Audit
    const meRes = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Cookie: cookieA },
    });
    const meCache = meRes.headers.get("cache-control") || "";
    const hasNoStore = meCache.includes("no-store") || meCache.includes("no-cache") || meCache.includes("private");
    record(
      "CACHE-01",
      "Caching & Leakage",
      "User Session API Cache-Control Directive Audit",
      hasNoStore ? "PASS" : "FAIL",
      "GET /api/auth/me",
      hasNoStore ? `Cache-Control: '${meCache}'` : `Cache-Control header is '${meCache || "MISSING"}'. Intermediary proxies could cache user profile`
    );

    // 8.2 Error Information Leakage
    const sqliErrorRes = await fetch(`${baseUrl}/api/orders/'%20OR%201=1--`, {
      headers: { Cookie: cookieA },
    });
    const sqliErrorText = await sqliErrorRes.text();
    const leaksSql =
      sqliErrorText.includes("SQL syntax") ||
      sqliErrorText.includes("mysql") ||
      sqliErrorText.includes("FROM orders") ||
      sqliErrorText.includes("at Object.query") ||
      sqliErrorText.includes(".ts:");
    record(
      "LEAK-01",
      "Caching & Leakage",
      "Database & Stack Trace Information Leakage on Errors",
      !leaksSql ? "PASS" : "FAIL",
      "GET /api/orders/[id]",
      !leaksSql ? `Sanitized JSON error returned without SQL/stack traces` : `Raw SQL or stack trace leaked in response body`
    );

    // Clean up synthetic test data
    console.log("\n--- CLEANUP: Removing Synthetic Test Records ---");
    await db.query("DELETE FROM payments WHERE id LIKE 'pmt_v_%' OR provider_payment_id LIKE 'pay_wh_test_%'");
    await db.query("DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE user_id IN (?, ?))", [idA, idB]);
    await db.query("DELETE FROM orders WHERE user_id IN (?, ?)", [idA, idB]);
    await db.query("DELETE FROM checkout_attempts WHERE user_id IN (?, ?)", [idA, idB]);
    await db.query("DELETE FROM addresses WHERE user_id IN (?, ?)", [idA, idB]);
    await db.query("DELETE FROM profiles WHERE id IN (?, ?)", [idA, idB]);
    await db.query("DELETE FROM rate_limits WHERE rate_key = 'login:fail:unknown_accounts' OR rate_key LIKE 'login:fail:ip:198.51.100.%'");
    console.log("Synthetic test data cleaned successfully.");
  } finally {
    await db.end();
  }

  // Summary Report
  console.log("\n================================================================================");
  console.log("AUDIT SUMMARY MATRIX");
  console.log("================================================================================");

  const passed = results.filter((r) => r.status === "PASS").length;
  const failed = results.filter((r) => r.status === "FAIL").length;
  const blocked = results.filter((r) => r.status === "BLOCKED").length;

  console.log(`Total Cases Tested : ${results.length}`);
  console.log(`PASS               : ${passed}`);
  console.log(`FAIL (Residual)    : ${failed}`);
  console.log(`BLOCKED            : ${blocked}\n`);

  console.log("DETAILED RESULTS BY AREA:");
  for (const r of results) {
    console.log(`[${r.status}] ${r.id.padEnd(8)} | ${r.category.padEnd(20)} | ${r.name}`);
  }
}

main().catch((err) => {
  console.error("[FATAL AUDIT ERROR]", err);
  process.exit(1);
});
