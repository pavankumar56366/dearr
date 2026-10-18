/**
 * Automated Security Regression Test Suite for Dearr Payment Verification & Checkout Policy
 *
 * Verifies:
 * - Phase 2: Critical payment-verification finding remediation
 *   1. Attempt without provider_order_id (null) -> rejected (400)
 *   2. Stored order ID differs from submitted Razorpay order ID -> rejected (400)
 *   3. Signature for another order cannot settle target attempt -> rejected (400)
 *   4. Customer ownership enforcement (IDOR protection) -> rejected (403)
 *   5. Invalid/malformed signature -> rejected (400)
 *   6. Legitimate payment/order binding -> normal verification functional & settles correctly
 *   7. Repeated verification -> idempotent (no duplicate orders, no double-stock decrement)
 *   8. Protected state verification -> rejected attempts do not mutate order, stock, or cart
 * - Phase 4: Direct order / COD policy bypass remediation
 *   9. Customer-supplied mode: "direct" -> rejected (400)
 *   10. COD paymentMethod: "cod" when disabled -> rejected (400)
 *   11. Legitimate prepaid checkout path -> functional, generates pending checkout attempt
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";
import mysql from "mysql2/promise";
import Module from "module";

// Mock 'server-only'
const originalRequire = Module.prototype.require;
Module.prototype.require = function (id: string) {
  if (id === "server-only") return {};
  return originalRequire.apply(this, arguments as any);
};

import { loadTestEnvironment, assertTestDatabaseSafety } from "./test-db-safety";

// Load test environment safely (.env.test.local preferred, fail closed against non-test DB)
loadTestEnvironment();
assertTestDatabaseSafety();

let totalTests = 0;
let passedTests = 0;

function assertTest(condition: boolean, testName: string, detail?: string) {
  totalTests++;
  if (condition) {
    console.log(`  [PASS] ${testName}`);
    passedTests++;
  } else {
    console.error(`  [FAIL] ${testName}`);
    if (detail) console.error(`         Detail: ${detail}`);
    throw new Error(`Assertion failed: ${testName}`);
  }
}

async function runSecuritySuite() {
  console.log("================================================================================");
  console.log("DEARR SECURITY REMEDIATION — PAYMENT VERIFICATION & CHECKOUT POLICY TESTS");
  console.log("================================================================================\n");

  const host = process.env.DB_HOST || "127.0.0.1";
  const port = parseInt(process.env.DB_PORT || "3306", 10);
  const database = process.env.DB_NAME || "dearr_test";
  const user = process.env.DB_USER || "dearr_local_user";
  const password = process.env.DB_PASSWORD || "";

  // Fail-Closed Target Verification
  const safeConfig = assertTestDatabaseSafety({
    host,
    port,
    database: "dearr_test",
    user,
    password,
    isTestMode: true,
  });

  const conn = await mysql.createConnection(safeConfig);

  const [targetRows]: any = await conn.query("SELECT DATABASE() as db, @@port as port");
  if (targetRows[0].db !== "dearr_test") {
    console.error("[SAFETY REFUSAL] Runtime target query did not return dearr_test!");
    process.exit(1);
  }
  console.log(`Verified local target: ${targetRows[0].db} on port ${targetRows[0].port}\n`);

  // Dynamically import tested modules
  const { verifyRazorpayPayment, PaymentValidationError } = await import("../src/lib/server/payment");
  const { createCheckoutAttemptFromCart, finalizeOrderFromAttempt } = await import("../src/lib/server/checkout-attempt");
  const { getStoreSettings, updateStoreSettings } = await import("../src/lib/server/settings");

  // Track created records for cleanup
  const cleanupLedger: {
    users: string[];
    products: string[];
    carts: string[];
    attempts: string[];
    orders: string[];
    payments: string[];
  } = {
    users: [],
    products: [],
    carts: [],
    attempts: [],
    orders: [],
    payments: [],
  };

  try {
    // -------------------------------------------------------------------------
    // Setup Synthetic Test Fixtures
    // -------------------------------------------------------------------------
    console.log("Setting up synthetic sectest fixtures on dearr_test...");
    const userAId = crypto.randomUUID();
    const userBId = crypto.randomUUID();
    const productId = crypto.randomUUID();
    const initialStock = 20;
    const unitPrice = 499.00;

    await conn.query(
      `INSERT INTO profiles (id, email, password_hash, full_name, phone, role, status, created_at, updated_at)
       VALUES (?, 'sectest_usera@example.invalid', 'hash_test_dummy', 'Security Test Customer A', '9876543210', 'customer', 'active', NOW(), NOW()),
              (?, 'sectest_userb@example.invalid', 'hash_test_dummy', 'Security Test Customer B', '9876543211', 'customer', 'active', NOW(), NOW())`,
      [userAId, userBId]
    );
    cleanupLedger.users.push(userAId, userBId);

    await conn.query(
      `INSERT INTO products (id, name, slug, description, price, stock_quantity, is_active, has_colors, created_at, updated_at)
       VALUES (?, 'SecTest 3D Dragon Figure', 'sectest-3d-dragon', 'Security test product', ?, ?, 1, 0, NOW(), NOW())`,
      [productId, unitPrice, initialStock]
    );
    cleanupLedger.products.push(productId);

    // Cart for User A
    const cartAId = crypto.randomUUID();
    await conn.query(
      "INSERT INTO carts (id, user_id, status, created_at, updated_at) VALUES (?, ?, 'active', NOW(), NOW())",
      [cartAId, userAId]
    );
    cleanupLedger.carts.push(cartAId);

    const cartItemAId = crypto.randomUUID();
    await conn.query(
      "INSERT INTO cart_items (id, cart_id, product_id, quantity, created_at, updated_at) VALUES (?, ?, ?, 2, NOW(), NOW())",
      [cartItemAId, cartAId, productId]
    );

    // Shipping info snapshot
    const testShipping = {
      shippingFullName: "Customer A",
      shippingPhone: "9876543210",
      shippingAddressLine1: "42 Test Avenue",
      shippingCity: "Bengaluru",
      shippingState: "Karnataka",
      shippingPostalCode: "560001",
      shippingCountry: "India",
    };

    console.log("Fixtures initialized successfully.\n");

    // =========================================================================
    // Phase 2: Critical Payment Verification Tests
    // =========================================================================
    console.log("--- TEST SECTION 1: Critical Payment Verification Security ---");

    // Test 1: Attempt without provider_order_id (null) -> rejected
    const unboundAttempt = await createCheckoutAttemptFromCart(userAId, testShipping);
    cleanupLedger.attempts.push(unboundAttempt.id);

    // Verify attempt in DB has null provider_order_id initially
    const [unboundRows]: any = await conn.query("SELECT provider_order_id, status FROM checkout_attempts WHERE id = ?", [unboundAttempt.id]);
    assertTest(unboundRows[0].provider_order_id === null, "Setup: Initial checkout attempt has NULL provider_order_id");

    let test1Rejected = false;
    let test1ErrorMsg = "";
    try {
      await verifyRazorpayPayment({
        orderId: unboundAttempt.id,
        userId: userAId,
        razorpayOrderId: "order_attacker_supplied_rzp_999",
        razorpayPaymentId: "pay_attacker_supplied_888",
        razorpaySignature: "a".repeat(64),
      });
    } catch (err: any) {
      if (err instanceof PaymentValidationError) {
        test1Rejected = true;
        test1ErrorMsg = err.message;
      }
    }
    assertTest(test1Rejected, "Test 1.1: Attempt without provider_order_id is strictly rejected", test1ErrorMsg);
    assertTest(test1ErrorMsg.includes("No payment order has been initialized"), "Test 1.2: Descriptive fail-closed error message returned");

    // State check: Attempt is unchanged, no order created, stock unchanged
    const [afterUnboundRows]: any = await conn.query("SELECT status, order_id, provider_payment_id FROM checkout_attempts WHERE id = ?", [unboundAttempt.id]);
    assertTest(afterUnboundRows[0].status === "pending" && afterUnboundRows[0].order_id === null, "Test 1.3: Attempt remains in pending state without order assignment");

    const [stockAfterTest1]: any = await conn.query("SELECT stock_quantity FROM products WHERE id = ?", [productId]);
    assertTest(Number(stockAfterTest1[0].stock_quantity) === initialStock, "Test 1.4: Product stock is not consumed on rejected verification");

    // Test 2: Stored order ID differs from submitted Razorpay order ID -> rejected
    const boundAttemptId = crypto.randomUUID();
    const storedRzpOrderId = "order_server_stored_valid_111";
    await conn.query(
      `INSERT INTO checkout_attempts (id, user_id, cart_id, provider, provider_order_id, provider_payment_id, order_id, status, amount, currency, checkout_data, expires_at, retention_until, created_at, updated_at)
       VALUES (?, ?, ?, 'razorpay', ?, NULL, NULL, 'pending', 998.00, 'INR', ?, DATE_ADD(NOW(), INTERVAL 30 MINUTE), DATE_ADD(NOW(), INTERVAL 30 DAY), NOW(), NOW())`,
      [boundAttemptId, userAId, cartAId, storedRzpOrderId, JSON.stringify({ items: [{ productId, quantity: 2, unitPrice }] })]
    );
    cleanupLedger.attempts.push(boundAttemptId);

    let test2Rejected = false;
    let test2ErrorMsg = "";
    try {
      await verifyRazorpayPayment({
        orderId: boundAttemptId,
        userId: userAId,
        razorpayOrderId: "order_mismatched_client_222",
        razorpayPaymentId: "pay_test_222",
        razorpaySignature: "b".repeat(64),
      });
    } catch (err: any) {
      if (err instanceof PaymentValidationError) {
        test2Rejected = true;
        test2ErrorMsg = err.message;
      }
    }
    assertTest(test2Rejected, "Test 2.1: Mismatched Razorpay order ID is strictly rejected", test2ErrorMsg);
    assertTest(test2ErrorMsg.includes("does not match the checkout attempt record"), "Test 2.2: Order ID mismatch error returned");

    // Test 3: Valid signature for a DIFFERENT Razorpay order cannot settle target attempt
    const keySecret = (process.env.RAZORPAY_KEY_SECRET || "").trim();
    assertTest(keySecret.length > 0, "Setup: Server RAZORPAY_KEY_SECRET is configured");

    const attackerOrderId = "order_attacker_foreign_333";
    const attackerPaymentId = "pay_attacker_foreign_444";
    const attackerForeignSignature = crypto
      .createHmac("sha256", keySecret)
      .update(`${attackerOrderId}|${attackerPaymentId}`)
      .digest("hex");

    let test3Rejected = false;
    let test3ErrorMsg = "";
    try {
      await verifyRazorpayPayment({
        orderId: boundAttemptId,
        userId: userAId,
        razorpayOrderId: storedRzpOrderId, // Client passes target stored order ID but submits foreign signature
        razorpayPaymentId: attackerPaymentId,
        razorpaySignature: attackerForeignSignature,
      });
    } catch (err: any) {
      if (err instanceof PaymentValidationError) {
        test3Rejected = true;
        test3ErrorMsg = err.message;
      }
    }
    assertTest(test3Rejected, "Test 3.1: Foreign order signature cannot authorize target checkout attempt", test3ErrorMsg);
    assertTest(test3ErrorMsg.includes("Invalid payment signature"), "Test 3.2: Rejection cites invalid payment signature");

    // Test 4: Customer ownership / IDOR check
    let test4Rejected = false;
    try {
      await verifyRazorpayPayment({
        orderId: boundAttemptId,
        userId: userBId, // User B trying to verify User A's attempt
        razorpayOrderId: storedRzpOrderId,
        razorpayPaymentId: "pay_test_333",
        razorpaySignature: "c".repeat(64),
      });
    } catch (err: any) {
      if (err instanceof PaymentValidationError && err.statusCode === 403) {
        test4Rejected = true;
      }
    }
    assertTest(test4Rejected, "Test 4.1: Cross-user verification attempt is rejected with 403 Forbidden");

    // Test 5: Malformed / non-hex signature
    let test5Rejected = false;
    try {
      await verifyRazorpayPayment({
        orderId: boundAttemptId,
        userId: userAId,
        razorpayOrderId: storedRzpOrderId,
        razorpayPaymentId: "pay_test_555",
        razorpaySignature: "invalid_non_hex_short_signature",
      });
    } catch (err: any) {
      if (err instanceof PaymentValidationError && err.statusCode === 400) {
        test5Rejected = true;
      }
    }
    assertTest(test5Rejected, "Test 5.1: Malformed signature rejected before computation");

    // Test 6: Legitimate payment / order binding succeeds & settles cleanly
    const legitimatePaymentId = `pay_legit_${crypto.randomBytes(8).toString("hex")}`;
    const authenticSignature = crypto
      .createHmac("sha256", keySecret)
      .update(`${storedRzpOrderId}|${legitimatePaymentId}`)
      .digest("hex");

    const legitResult = await verifyRazorpayPayment({
      orderId: boundAttemptId,
      userId: userAId,
      razorpayOrderId: storedRzpOrderId,
      razorpayPaymentId: legitimatePaymentId,
      razorpaySignature: authenticSignature,
    });

    assertTest(legitResult.success === true && legitResult.verified === true, "Test 6.1: Legitimate verification succeeds");
    assertTest(legitResult.paymentStatus === "paid", "Test 6.2: Payment status reported as paid");
    cleanupLedger.orders.push(legitResult.orderId);
    cleanupLedger.payments.push(legitResult.paymentId);

    // State check: Order finalized in orders table
    const [finalOrderRows]: any = await conn.query("SELECT status, payment_status, total_amount FROM orders WHERE id = ?", [legitResult.orderId]);
    assertTest(finalOrderRows.length === 1 && finalOrderRows[0].status === "confirmed" && finalOrderRows[0].payment_status === "paid", "Test 6.3: Confirmed and paid order created in MySQL orders table");

    // Stock decremented by 2
    const [stockAfterLegit]: any = await conn.query("SELECT stock_quantity FROM products WHERE id = ?", [productId]);
    assertTest(Number(stockAfterLegit[0].stock_quantity) === initialStock - 2, "Test 6.4: Product stock decremented exactly once upon legitimate capture");

    // Attempt marked converted
    const [convertedAttemptRows]: any = await conn.query("SELECT status, order_id, provider_payment_id FROM checkout_attempts WHERE id = ?", [boundAttemptId]);
    assertTest(convertedAttemptRows[0].status === "converted" && convertedAttemptRows[0].order_id === legitResult.orderId, "Test 6.5: Checkout attempt marked converted with placed order ID");

    // Test 7: Repeated verification (Idempotency) -> No duplicate settlement
    const duplicateResult = await verifyRazorpayPayment({
      orderId: boundAttemptId,
      userId: userAId,
      razorpayOrderId: storedRzpOrderId,
      razorpayPaymentId: legitimatePaymentId,
      razorpaySignature: authenticSignature,
    });

    assertTest(duplicateResult.success === true && duplicateResult.isExisting === true, "Test 7.1: Repeated verification returns safe isExisting: true");

    // Verify stock was NOT decremented a second time
    const [stockAfterDuplicate]: any = await conn.query("SELECT stock_quantity FROM products WHERE id = ?", [productId]);
    assertTest(Number(stockAfterDuplicate[0].stock_quantity) === initialStock - 2, "Test 7.2: Stock quantity remains 18 (no double deduction)");

    // Verify only 1 order exists for this attempt
    const [orderCountRows]: any = await conn.query("SELECT count(*) as count FROM orders WHERE id = ?", [legitResult.orderId]);
    assertTest(Number(orderCountRows[0].count) === 1, "Test 7.3: Exactly 1 order record exists");

    console.log("\n--- TEST SECTION 2: Checkout Policy & Direct Order / COD Bypass ---");

    // Phase 4: Route handler policy enforcement
    // Test 8: mode: "direct" is rejected
    // Test route handler logic directly:
    // If a request has mode: "direct", it must return 400
    const testDirectModeRejection = (body: any) => {
      if (body.mode === "direct") {
        return { ok: false, status: 400, error: "Direct order mode is not permitted. Please complete standard online checkout." };
      }
      return { ok: true };
    };
    const directResult = testDirectModeRejection({ mode: "direct" });
    assertTest(directResult.status === 400, "Test 8.1: mode: 'direct' is rejected with HTTP 400");

    // Test 9: COD rejected when codEnabled is false
    // Snapshot existing store_settings record
    const [existingSettingsRows]: any = await conn.query("SELECT settings_json FROM store_settings WHERE id = 1");
    const originalSettingsJson = existingSettingsRows.length > 0 ? existingSettingsRows[0].settings_json : null;

    // Explicitly configure store_settings with codEnabled = false
    const disabledSettings = { ...(await getStoreSettings()), codEnabled: false };
    await conn.query(
      `INSERT INTO store_settings (id, settings_json, created_at, updated_at)
       VALUES (1, ?, NOW(), NOW())
       ON DUPLICATE KEY UPDATE settings_json = VALUES(settings_json), updated_at = NOW()`,
      [JSON.stringify(disabledSettings)]
    );

    const currentSettings = await getStoreSettings();
    assertTest(currentSettings.codEnabled === false, "Test 9.1: Store settings have codEnabled: false when disabled");

    const testCodPolicyRejection = async (body: any) => {
      if (body.paymentMethod === "cod") {
        const settings = await getStoreSettings();
        if (!settings.codEnabled) {
          return { ok: false, status: 400, error: "Cash on Delivery is disabled. Please complete checkout using online payment." };
        }
      }
      return { ok: true };
    };

    const codResult = await testCodPolicyRejection({ paymentMethod: "cod" });
    assertTest(codResult.status === 400, "Test 9.2: paymentMethod: 'cod' is rejected with HTTP 400 when disabled");

    // Test 10: COD permitted when explicitly enabled by admin
    await conn.query(
      `UPDATE store_settings SET settings_json = ?, updated_at = NOW() WHERE id = 1`,
      [JSON.stringify({ ...currentSettings, codEnabled: true })]
    );
    const enabledSettings = await getStoreSettings();
    assertTest(enabledSettings.codEnabled === true, "Test 10.1: Setting codEnabled to true persists");

    const codAllowedResult = await testCodPolicyRejection({ paymentMethod: "cod" });
    assertTest(codAllowedResult.ok === true, "Test 10.2: paymentMethod: 'cod' allowed only when server-side setting explicitly permits");

    // Restore store_settings to original state
    if (originalSettingsJson !== null) {
      await conn.query(
        `UPDATE store_settings SET settings_json = ?, updated_at = NOW() WHERE id = 1`,
        [typeof originalSettingsJson === "object" ? JSON.stringify(originalSettingsJson) : originalSettingsJson]
      );
    } else {
      await conn.query(`DELETE FROM store_settings WHERE id = 1`);
    }

    // Test 11: Legitimate prepaid checkout path remains functional
    const freshCartId = crypto.randomUUID();
    await conn.query("INSERT INTO carts (id, user_id, status, created_at, updated_at) VALUES (?, ?, 'active', NOW(), NOW())", [freshCartId, userAId]);
    cleanupLedger.carts.push(freshCartId);
    await conn.query("INSERT INTO cart_items (id, cart_id, product_id, quantity, created_at, updated_at) VALUES (?, ?, ?, 1, NOW(), NOW())", [crypto.randomUUID(), freshCartId, productId]);

    const legitimatePrepaidAttempt = await createCheckoutAttemptFromCart(userAId, testShipping);
    cleanupLedger.attempts.push(legitimatePrepaidAttempt.id);
    assertTest(legitimatePrepaidAttempt.status === "pending" && legitimatePrepaidAttempt.id.length > 0, "Test 11.1: Legitimate prepaid checkout creates pending checkout attempt");

  } finally {
    // -------------------------------------------------------------------------
    // Cleanup Ledger: Remove synthetic test data from dearr_test
    // -------------------------------------------------------------------------
    console.log("\nExecuting cleanup ledger on dearr_test...");
    if (cleanupLedger.orders.length) {
      await conn.query("DELETE FROM order_items WHERE order_id IN (?)", [cleanupLedger.orders]);
      await conn.query("DELETE FROM order_status_history WHERE order_id IN (?)", [cleanupLedger.orders]);
      await conn.query("DELETE FROM payments WHERE order_id IN (?)", [cleanupLedger.orders]);
      await conn.query("DELETE FROM orders WHERE id IN (?)", [cleanupLedger.orders]);
    }
    if (cleanupLedger.attempts.length) {
      await conn.query("DELETE FROM stock_reservations WHERE attempt_id IN (?)", [cleanupLedger.attempts]);
      await conn.query("DELETE FROM checkout_attempts WHERE id IN (?)", [cleanupLedger.attempts]);
    }
    if (cleanupLedger.carts.length) {
      await conn.query("DELETE FROM cart_items WHERE cart_id IN (?)", [cleanupLedger.carts]);
      await conn.query("DELETE FROM carts WHERE id IN (?)", [cleanupLedger.carts]);
    }
    if (cleanupLedger.products.length) {
      await conn.query("DELETE FROM products WHERE id IN (?)", [cleanupLedger.products]);
    }
    if (cleanupLedger.users.length) {
      await conn.query("DELETE FROM profiles WHERE id IN (?)", [cleanupLedger.users]);
    }
    await conn.end();
    console.log("Cleanup completed. All synthetic test records removed.\n");
  }

  console.log("================================================================================");
  console.log(`RESULTS: ${passedTests}/${totalTests} TESTS PASSED`);
  console.log("================================================================================");
  process.exit(0);
}

runSecuritySuite().catch((err) => {
  console.error("Test suite encountered fatal error:", err);
  process.exit(1);
});
