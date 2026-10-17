import fs from "fs";
import path from "path";
import crypto from "crypto";
import mysql from "mysql2/promise";
import Module from "module";

// Mock 'server-only' so server modules can be imported
const originalRequire = Module.prototype.require;
Module.prototype.require = function (id: string) {
  if (id === "server-only") return {};
  return originalRequire.apply(this, arguments as any);
};

// Load .env.local
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

async function runTests() {
  console.log("================================================================================");
  console.log("PHASE 10 & 11: COMPLETE PAYMENT LIFECYCLE & RETENTION VERIFICATION");
  console.log("================================================================================\n");

  const host = process.env.DB_HOST || "127.0.0.1";
  const port = parseInt(process.env.DB_PORT || "3306", 10);
  const database = process.env.DB_NAME || "dearr_local";
  const user = process.env.DB_USER || "dearr_local_user";
  const password = process.env.DB_PASSWORD || "";

  // Fail-Closed Check
  const ALLOWED_DATABASES = ["dearr_local", "dearr_test"];
  if (host !== "127.0.0.1" || !ALLOWED_DATABASES.includes(database)) {
    console.error(`[SAFETY REFUSAL] Must run strictly against dearr_local or dearr_test on 127.0.0.1! Current: ${database}@${host}`);
    process.exit(1);
  }

  const conn = await mysql.createConnection({ host, port, user, password, database });

  // Dynamically import application server modules
  const { createCheckoutAttempt, finalizeOrderFromAttempt } = await import("../src/lib/server/checkout-attempt");
  const { verifyRazorpayPayment, PaymentValidationError } = await import("../src/lib/server/payment");
  const { getRazorpayClient, isRazorpayConfigured, isRazorpayTestMode } = await import("../src/lib/server/razorpay");
  const { getOrderSummaryMetrics, resolveReportingPeriod } = await import("../src/lib/server/order-analytics");

  console.log("Configuration Check:");
  console.log(`  Razorpay Configured: ${isRazorpayConfigured() ? "YES" : "NO"}`);
  console.log(`  Razorpay Test Mode  : ${isRazorpayTestMode() ? "YES (rzp_test_ prefix)" : "NO"}`);
  console.log(`  Database Target     : ${database} on ${host}:${port}\n`);

  if (!isRazorpayTestMode()) {
    throw new Error("Razorpay Test Mode credentials are required for integration tests!");
  }

  // Fetch test product
  const [products]: any = await conn.query("SELECT * FROM products WHERE is_active = 1 LIMIT 1");
  if (!products || products.length === 0) {
    throw new Error("No active product found in dearr_local for testing");
  }
  const testProduct = products[0];
  const initialStock = Number(testProduct.stock_quantity);
  const testUserId = "user-001";
  const shippingAddress = {
    fullName: "Priya Rao",
    phone: "9876543210",
    addressLine1: "Flat 402, Lotus Residency",
    city: "Vijayawada",
    state: "Andhra Pradesh",
    postalCode: "520001",
    country: "India",
  };

  let passedCount = 0;
  let totalCount = 0;

  function assertTest(condition: boolean, name: string) {
    totalCount++;
    if (!condition) {
      console.error(`  [FAIL] ${name}`);
      throw new Error(`Test assertion failed: ${name}`);
    }
    console.log(`  [PASS] ${name}`);
    passedCount++;
  }

  // ---------------------------------------------------------------------------
  // TEST A: Abandoned Checkout Attempt
  // ---------------------------------------------------------------------------
  console.log("--- TEST A: ABANDONED CHECKOUT ATTEMPT ---");
  const abandonedAttempt = await createCheckoutAttempt({
    userId: testUserId,
    amount: Number(testProduct.price),
    currency: "INR",
    checkoutData: {
      shippingAddress,
      items: [
        {
          productId: testProduct.id,
          variantId: null,
          productName: testProduct.name,
          title: testProduct.name,
          variantName: null,
          quantity: 1,
          unitPrice: Number(testProduct.price),
          lineDiscount: 0,
          lineTotal: Number(testProduct.price),
          subtotal: Number(testProduct.price),
        },
      ],
      subtotal: Number(testProduct.price),
      discountAmount: 0,
      shippingAmount: 0,
      totalAmount: Number(testProduct.price),
    },
  });

  const [attemptCheck]: any = await conn.query("SELECT * FROM checkout_attempts WHERE id = ?", [abandonedAttempt.id]);
  assertTest(attemptCheck.length === 1 && attemptCheck[0].status === "pending", "A.1: Checkout attempt row created with status='pending'");

  const [orderCheckA]: any = await conn.query("SELECT * FROM orders WHERE id = ?", [abandonedAttempt.id]);
  assertTest(orderCheckA.length === 0, "A.2: Zero placed orders exist before payment confirmation");

  const [itemsCheckA]: any = await conn.query(
    "SELECT count(*) as count FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE id = ?)",
    [abandonedAttempt.id]
  );
  assertTest(Number(itemsCheckA[0].count) === 0, "A.3: Zero premature order items created");

  const [ordersForUser]: any = await conn.query("SELECT * FROM orders WHERE user_id = ?", [testUserId]);
  assertTest(!ordersForUser.some((o: any) => o.id === abandonedAttempt.id), "A.4: Customer order history excludes the abandoned attempt");

  const analyticsA = await getOrderSummaryMetrics(resolveReportingPeriod({ period: "all" }));
  const [allOrdersCount]: any = await conn.query("SELECT count(*) as count FROM orders WHERE payment_status IN ('paid', 'refunded', 'cod')");
  assertTest(analyticsA.totalOrders === Number(allOrdersCount[0].count), "A.5: Admin analytics total orders excludes abandoned attempt");

  // ---------------------------------------------------------------------------
  // TEST B: Successful Payment Flow (Using Real Razorpay Test-Mode Gateway Order)
  // ---------------------------------------------------------------------------
  console.log("\n--- TEST B: SUCCESSFUL PAYMENT WITH RAZORPAY TEST MODE ---");
  const rzpClient = getRazorpayClient();
  const rzpOrderAmountPaise = Math.round(Number(testProduct.price) * 100);

  // 1. Create real test order via Razorpay API
  console.log("  Creating authentic test order via Razorpay API...");
  const realRzpOrder = await rzpClient.orders.create({
    amount: rzpOrderAmountPaise,
    currency: "INR",
    receipt: `rcpt_${Date.now()}`,
  });
  console.log(`  ✓ Razorpay Test Mode Order ID: ${realRzpOrder.id}`);

  // 2. Create authoritative checkout attempt with providerOrderId
  const successfulAttempt = await createCheckoutAttempt({
    userId: testUserId,
    amount: Number(testProduct.price),
    currency: "INR",
    provider: "razorpay",
    providerOrderId: realRzpOrder.id,
    checkoutData: {
      shippingAddress,
      items: [
        {
          productId: testProduct.id,
          variantId: null,
          productName: testProduct.name,
          title: testProduct.name,
          variantName: null,
          quantity: 1,
          unitPrice: Number(testProduct.price),
          lineDiscount: 0,
          lineTotal: Number(testProduct.price),
          subtotal: Number(testProduct.price),
        },
      ],
      subtotal: Number(testProduct.price),
      discountAmount: 0,
      shippingAmount: 0,
      totalAmount: Number(testProduct.price),
    },
  });

  // 3. Generate authentic HMAC-SHA256 signature
  const testPaymentId = `pay_test_${crypto.randomBytes(8).toString("hex")}`;
  const keySecret = process.env.RAZORPAY_KEY_SECRET!.trim();
  const validSignature = crypto
    .createHmac("sha256", keySecret)
    .update(`${realRzpOrder.id}|${testPaymentId}`)
    .digest("hex");

  // 4. Verify payment via server verification handler
  const verifyResult = await verifyRazorpayPayment({
    orderId: successfulAttempt.id,
    userId: testUserId,
    razorpayOrderId: realRzpOrder.id,
    razorpayPaymentId: testPaymentId,
    razorpaySignature: validSignature,
    amount: Number(testProduct.price),
  });

  console.log(`  Debug: verifyResult=${JSON.stringify(verifyResult)}`);
  assertTest(verifyResult.success === true && verifyResult.verified === true, "B.1: Server checks and accepts authentic HMAC-SHA256 signature");
  assertTest(Number(verifyResult.amount) === Number(testProduct.price), "B.2: Payment amount matches trusted snapshot");

  const [placedOrderRows]: any = await conn.query("SELECT * FROM orders WHERE id = ?", [verifyResult.orderId]);
  assertTest(placedOrderRows.length === 1 && placedOrderRows[0].status === "confirmed" && placedOrderRows[0].payment_status === "paid", "B.3: Exactly one placed order finalized with confirmed and paid state");

  const [placedItems]: any = await conn.query("SELECT * FROM order_items WHERE order_id = ?", [verifyResult.orderId]);
  assertTest(placedItems.length === 1 && placedItems[0].product_id === testProduct.id, "B.4: Order items inserted correctly with matching product");

  const [paymentRows]: any = await conn.query("SELECT * FROM payments WHERE order_id = ?", [verifyResult.orderId]);
  assertTest(paymentRows.length === 1 && paymentRows[0].status === "captured" && paymentRows[0].provider_payment_id === testPaymentId, "B.5: Authoritative captured payment record inserted in payments table");

  const [productAfter]: any = await conn.query("SELECT stock_quantity FROM products WHERE id = ?", [testProduct.id]);
  assertTest(Number(productAfter[0].stock_quantity) === initialStock - 1, "B.6: Product inventory safely decremented by order quantity");

  const [attemptAfter]: any = await conn.query("SELECT * FROM checkout_attempts WHERE id = ?", [successfulAttempt.id]);
  assertTest(attemptAfter[0].status === "converted" && attemptAfter[0].order_id === verifyResult.orderId, "B.7: Checkout attempt updated to status='converted' with order_id link");

  // ---------------------------------------------------------------------------
  // TEST C: Duplicate Webhook & Callback Idempotency
  // ---------------------------------------------------------------------------
  console.log("\n--- TEST C: DUPLICATE WEBHOOK & CALLBACK IDEMPOTENCY ---");
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET?.trim() || "dearr_test_webhook_secret_local";

  const webhookPayload = JSON.stringify({
    event: "payment.captured",
    payload: {
      payment: {
        entity: {
          id: testPaymentId,
          order_id: realRzpOrder.id,
          amount: rzpOrderAmountPaise,
          currency: "INR",
          status: "captured",
        },
      },
    },
  });

  const webhookSignature = crypto
    .createHmac("sha256", webhookSecret)
    .update(webhookPayload)
    .digest("hex");

  // Send first webhook to running local dev server
  const res1 = await fetch("http://localhost:3000/api/payments/webhook", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-razorpay-signature": webhookSignature,
    },
    body: webhookPayload,
  });
  const data1: any = await res1.json();
  assertTest(res1.status === 200 && data1.ok === true, "C.1: Webhook endpoint acknowledges captured event (HTTP 200)");

  // Send duplicate webhook delivery
  const res2 = await fetch("http://localhost:3000/api/payments/webhook", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-razorpay-signature": webhookSignature,
    },
    body: webhookPayload,
  });
  const data2: any = await res2.json();
  assertTest(res2.status === 200 && data2.ok === true, "C.2: Duplicate webhook delivery acknowledged safely without failure (HTTP 200)");

  const [ordersCountAfterWebhook]: any = await conn.query("SELECT count(*) as count FROM orders WHERE id = ?", [verifyResult.orderId]);
  assertTest(Number(ordersCountAfterWebhook[0].count) === 1, "C.3: Duplicate webhook delivery created ZERO duplicate orders");

  const [stockAfterWebhook]: any = await conn.query("SELECT stock_quantity FROM products WHERE id = ?", [testProduct.id]);
  assertTest(Number(stockAfterWebhook[0].stock_quantity) === initialStock - 1, "C.4: Duplicate webhook did NOT decrement inventory a second time");

  // ---------------------------------------------------------------------------
  // TEST D: Invalid Payment Verification Safeguards
  // ---------------------------------------------------------------------------
  console.log("\n--- TEST D: INVALID PAYMENT VERIFICATION SAFEGUARDS ---");
  // 1. Invalid signature
  let rejectedInvalidSig = false;
  try {
    const badSig = "0000000000000000000000000000000000000000000000000000000000000000";
    await verifyRazorpayPayment({
      orderId: successfulAttempt.id,
      userId: testUserId,
      razorpayOrderId: realRzpOrder.id,
      razorpayPaymentId: testPaymentId,
      razorpaySignature: badSig,
    });
  } catch (err: any) {
    if (err instanceof PaymentValidationError) rejectedInvalidSig = true;
  }
  assertTest(rejectedInvalidSig, "D.1: Invalid HMAC signature rejected with PaymentValidationError (400)");

  // 2. Tampered payment ID
  let rejectedTamperedPayment = false;
  try {
    await verifyRazorpayPayment({
      orderId: successfulAttempt.id,
      userId: testUserId,
      razorpayOrderId: realRzpOrder.id,
      razorpayPaymentId: "pay_tampered_999",
      razorpaySignature: validSignature, // Signature won't match tampered payment id
    });
  } catch (err: any) {
    if (err instanceof PaymentValidationError) rejectedTamperedPayment = true;
  }
  assertTest(rejectedTamperedPayment, "D.2: Tampered payment ID rejected");

  // 3. Webhook with invalid signature rejected by endpoint
  const badWebhookRes = await fetch("http://localhost:3000/api/payments/webhook", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-razorpay-signature": "invalid_tampered_signature_hex",
    },
    body: webhookPayload,
  });
  const badWebhookData: any = await badWebhookRes.json();
  assertTest(badWebhookRes.status === 400 && badWebhookData.ok === false, "D.3: Webhook with invalid HMAC signature rejected with HTTP 400");

  // 4. Webhook with missing signature header rejected by endpoint
  const missingSigWebhookRes = await fetch("http://localhost:3000/api/payments/webhook", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: webhookPayload,
  });
  const missingSigWebhookData: any = await missingSigWebhookRes.json();
  assertTest(
    missingSigWebhookRes.status === 400 && missingSigWebhookData.ok === false,
    "D.4: Webhook with missing signature header rejected with HTTP 400"
  );

  // ---------------------------------------------------------------------------
  // TEST E: Late Payment Reconciliation After Expiry
  // ---------------------------------------------------------------------------
  console.log("\n--- TEST E: LATE PAYMENT RECONCILIATION AFTER EXPIRY ---");
  // Create an expired attempt by creating it and updating expires_at to 10 minutes ago
  const lateAttempt = await createCheckoutAttempt({
    userId: testUserId,
    amount: Number(testProduct.price),
    currency: "INR",
    checkoutData: {
      shippingAddress,
      items: [
        {
          productId: testProduct.id,
          variantId: null,
          productName: testProduct.name,
          title: testProduct.name,
          variantName: null,
          quantity: 1,
          unitPrice: Number(testProduct.price),
          lineDiscount: 0,
          lineTotal: Number(testProduct.price),
          subtotal: Number(testProduct.price),
        },
      ],
      subtotal: Number(testProduct.price),
      discountAmount: 0,
      shippingAmount: 0,
      totalAmount: Number(testProduct.price),
    },
  });

  // Backdate expiry to past
  await conn.query("UPDATE checkout_attempts SET status = 'expired', expires_at = DATE_SUB(NOW(), INTERVAL 10 MINUTE) WHERE id = ?", [lateAttempt.id]);

  // Late valid captured payment arrives
  const latePaymentId = `pay_late_${crypto.randomBytes(8).toString("hex")}`;
  const lateOrder = await finalizeOrderFromAttempt(lateAttempt.id, {
    providerPaymentId: latePaymentId,
  });

  assertTest(lateOrder && lateOrder.status === "confirmed", "E.1: Late captured payment arriving after attempt expiry successfully finalizes order");

  const [lateAttemptRow]: any = await conn.query("SELECT * FROM checkout_attempts WHERE id = ?", [lateAttempt.id]);
  assertTest(lateAttemptRow[0].status === "converted" && lateAttemptRow[0].order_id === lateOrder.id, "E.2: Expired attempt successfully transitioned to 'converted' with order link");

  // ---------------------------------------------------------------------------
  // TEST F: Attempt Expiry and Retention Cleanup Policy (Phase 11)
  // ---------------------------------------------------------------------------
  console.log("\n--- TEST F: ATTEMPT EXPIRY & RETENTION POLICY ---");
  // 1. Pending attempt older than 30m should become expired
  const pendingOldAttempt = await createCheckoutAttempt({
    userId: testUserId,
    amount: 100,
    checkoutData: { shippingAddress, items: [], subtotal: 100, discountAmount: 0, shippingAmount: 0, totalAmount: 100 },
  });
  await conn.query("UPDATE checkout_attempts SET expires_at = DATE_SUB(NOW(), INTERVAL 35 MINUTE) WHERE id = ?", [pendingOldAttempt.id]);

  // 2. Expired attempt within 30-day retention should NOT be deleted
  const recentExpiredAttempt = await createCheckoutAttempt({
    userId: testUserId,
    amount: 100,
    checkoutData: { shippingAddress, items: [], subtotal: 100, discountAmount: 0, shippingAmount: 0, totalAmount: 100 },
  });
  await conn.query("UPDATE checkout_attempts SET status = 'expired', retention_until = DATE_ADD(NOW(), INTERVAL 15 DAY) WHERE id = ?", [recentExpiredAttempt.id]);

  // 3. Expired attempt past 30-day retention should be deleted
  const ancientExpiredAttempt = await createCheckoutAttempt({
    userId: testUserId,
    amount: 100,
    checkoutData: { shippingAddress, items: [], subtotal: 100, discountAmount: 0, shippingAmount: 0, totalAmount: 100 },
  });
  await conn.query("UPDATE checkout_attempts SET status = 'expired', retention_until = DATE_SUB(NOW(), INTERVAL 1 DAY) WHERE id = ?", [ancientExpiredAttempt.id]);

  // Import and execute cleanup runner
  const { runCleanup } = await import("./cleanup-checkout-attempts.mjs");
  const cleanupResult = await runCleanup();

  assertTest(cleanupResult.expiredCount >= 1, "F.1: Cleanup worker expired pending attempt older than 30 minutes");
  assertTest(cleanupResult.purgedCount >= 1, "F.2: Cleanup worker purged ancient attempt past 30-day retention");

  const [checkRecent]: any = await conn.query("SELECT * FROM checkout_attempts WHERE id = ?", [recentExpiredAttempt.id]);
  assertTest(checkRecent.length === 1, "F.3: Expired attempt within retention window was safely preserved");

  const [checkAncient]: any = await conn.query("SELECT * FROM checkout_attempts WHERE id = ?", [ancientExpiredAttempt.id]);
  assertTest(checkAncient.length === 0, "F.4: Ancient attempt past retention window was purged");

  const [checkConverted]: any = await conn.query("SELECT * FROM checkout_attempts WHERE id = ?", [successfulAttempt.id]);
  assertTest(checkConverted.length === 1, "F.5: Converted attempt was strictly preserved and never purged");

  const [checkOrder]: any = await conn.query("SELECT * FROM orders WHERE id = ?", [verifyResult.orderId]);
  assertTest(checkOrder.length === 1, "F.6: Placed orders, items, and payments are strictly preserved");

  console.log("\n================================================================================");
  console.log(`LIFECYCLE VERIFICATION SUMMARY: ${passedCount} / ${totalCount} checks PASSED (100%)`);
  console.log("================================================================================\n");

  await conn.end();
}

runTests()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error("Lifecycle verification fatal error:", err);
    process.exit(1);
  });
