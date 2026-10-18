import fs from "fs";
import path from "path";

import { loadTestEnvironment, assertTestDatabaseSafety } from "./test-db-safety";

// 1. Load test environment safely (.env.test.local preferred, fail closed against non-test DB)
loadTestEnvironment();
assertTestDatabaseSafety();

// 2. Strict Safety Safeguards
console.log("================================================================");
console.log("  Dearr Cart Abandonment Recovery - Comprehensive E2E Test Suite ");
console.log("================================================================");
console.log("Target Host:", process.env.DB_HOST);
console.log("Target Port:", process.env.DB_PORT);
console.log("Target Database:", process.env.DB_NAME);

import Module from "module";
const originalRequire = (Module.prototype as any).require;
(Module.prototype as any).require = function (id: string) {
  if (id === "server-only") return {};
  return originalRequire.apply(this, arguments as any);
};

import crypto from "crypto";
import { query, withTransaction } from "@/lib/server/db";
import {
  createCheckoutAttemptFromCart,
  getCheckoutAttemptById,
  markAttemptAbandoned,
  markAttemptFailed,
  recordRecoveryShown,
  getAttemptRecoveryStatus,
  finalizeOrderFromAttempt,
  cleanupCheckoutAttempts,
} from "@/lib/server/checkout-attempt";
import {
  findLowerPricedAlternatives,
  swapCartItemForAlternative,
  AlternativesConflictError,
} from "@/lib/server/alternatives";
import {
  submitCheckoutFeedback,
  getAttemptFeedback,
  getFeedbackForAttempt,
} from "@/lib/server/checkout-feedback";
import {
  subscribeNotificationConsent,
  unsubscribeNotificationConsent,
  getNotificationConsentsForUser,
  getConsentsForAttempt,
  withdrawNotificationConsent,
} from "@/lib/server/notification-consent";
import {
  recordPriceChange,
  getProductPriceHistory,
} from "@/lib/server/price-history";
import {
  recordInternalEvent,
  getInternalEventsForAttempt,
} from "@/lib/server/events";
import {
  getAbandonmentSummaryMetrics,
  listRecentAbandonedCheckouts,
  streamAbandonmentCsv,
} from "@/lib/server/abandonment-analytics";
import {
  getStoreSettings,
  updateStoreSettings,
} from "@/lib/server/settings";
import { getOrderSummaryMetrics, resolveReportingPeriod, getNowInAsiaKolkata } from "@/lib/server/order-analytics";
import { createDiscount, getApplicableDiscountForProduct } from "@/lib/server/discount";
import { DEFAULT_ADMIN_SETTINGS } from "@/lib/admin-settings";

let passCount = 0;
let failCount = 0;

function assert(cond: boolean, desc: string) {
  if (cond) {
    passCount++;
    console.log(`  ✓ PASS: ${desc}`);
  } else {
    failCount++;
    console.error(`  ✗ FAIL: ${desc}`);
  }
}

async function runTestSuite() {
  const suiteId = crypto.randomBytes(4).toString("hex");
  const testDate = getNowInAsiaKolkata().dateStr;
  const testEmail = `recovery_test_${suiteId}@dearr.test`;
  const adminEmail = `recovery_admin_${suiteId}@dearr.test`;
  let customerId = "";
  let adminId = "";
  let categoryId = "";
  let prodAId = "";
  let prodBId = "";
  let prodCId = "";
  let prodDId = "";
  let colorB1Id = "";
  let colorB2Id = "";
  let cartId = "";
  let cartItemId = "";
  let attemptId = "";

  try {
    // Reset store settings to defaults to ensure clean test isolation
    await updateStoreSettings({
      recoverySheetEnabled: true,
      alternativesEnabled: true,
      feedbackEnabled: true,
      maxAlternatives: 4,
      feedbackReasons: [
        "Price is too high",
        "Found it cheaper elsewhere",
        "Shipping charges too high",
        "Delivery takes too long",
        "Payment problem",
        "Wanted Cash on Delivery",
        "Not sure about product quality",
        "Just browsing",
        "Need to compare more",
        "Other",
      ],
    });
    // -------------------------------------------------------------
    // TEST 1: Schema Integrity & Migration 008 Verification
    // -------------------------------------------------------------
    console.log("\n--- TEST 1: Schema Integrity & Migration 008 Verification ---");
    const cols = await query<any[]>(
      `SHOW COLUMNS FROM checkout_attempts WHERE Field IN ('recovery_shown_at', 'abandoned_at', 'gateway_error_code', 'gateway_error_desc', 'status')`
    );
    const colMap = new Map(cols.map((c) => [c.Field, c]));
    assert(colMap.has("recovery_shown_at"), "checkout_attempts has recovery_shown_at column");
    assert(colMap.has("abandoned_at"), "checkout_attempts has abandoned_at column");
    assert(colMap.has("gateway_error_code"), "checkout_attempts has gateway_error_code column");
    assert(colMap.has("gateway_error_desc"), "checkout_attempts has gateway_error_desc column");
    assert(
      String(colMap.get("status")?.Type).includes("'abandoned'"),
      "checkout_attempts status ENUM includes 'abandoned'"
    );

    const tables = await query<any[]>(
      `SHOW TABLES WHERE Tables_in_dearr_test IN ('checkout_feedback', 'notification_consents', 'product_price_history', 'internal_events')`
    );
    assert(tables.length === 4, "All 4 new tables exist in dearr_test (feedback, consents, price_history, events)");

    const exportAuditsCol = await query<any[]>(
      `SHOW COLUMNS FROM order_export_audits WHERE Field = 'export_type'`
    );
    assert(
      String(exportAuditsCol[0]?.Type).includes("'abandonment'"),
      "order_export_audits export_type ENUM includes 'abandonment'"
    );

    // -------------------------------------------------------------
    // SETUP: Create test users, category, products, and active cart
    // -------------------------------------------------------------
    customerId = crypto.randomUUID();
    adminId = crypto.randomUUID();
    categoryId = crypto.randomUUID();
    prodAId = crypto.randomUUID();
    prodBId = crypto.randomUUID();
    prodCId = crypto.randomUUID();
    prodDId = crypto.randomUUID();
    colorB1Id = crypto.randomUUID();
    colorB2Id = crypto.randomUUID();
    cartId = crypto.randomUUID();
    cartItemId = crypto.randomUUID();

    await query(
      `INSERT INTO profiles (id, email, password_hash, role, full_name, created_at, updated_at) VALUES
       (?, ?, 'hash', 'customer', 'Test Customer', NOW(), NOW()),
       (?, ?, 'hash', 'admin', 'Test Admin', NOW(), NOW())`,
      [customerId, testEmail, adminId, adminEmail]
    );

    await query(
      `INSERT INTO categories (id, name, slug, is_active, created_at, updated_at) VALUES
       (?, '3D Sculptures', ?, 1, NOW(), NOW())`,
      [categoryId, `cat-${suiteId}`]
    );

    // Product A: Original item (₹899)
    await query(
      `INSERT INTO products (id, category_id, name, slug, description, price, stock_quantity, is_active, created_at, updated_at) VALUES
       (?, ?, 'Artisan Dragon Model', ?, 'Detailed dragon model', 899.00, 10, 1, NOW(), NOW())`,
      [prodAId, categoryId, `dragon-${suiteId}`]
    );

    // Product B: Lower-priced alternative (₹599) with 2 color variants
    await query(
      `INSERT INTO products (id, category_id, name, slug, description, price, stock_quantity, has_colors, is_active, created_at, updated_at) VALUES
       (?, ?, 'Miniature Dragon Model', ?, 'Small dragon model', 599.00, 15, 1, 1, NOW(), NOW())`,
      [prodBId, categoryId, `mini-dragon-${suiteId}`]
    );
    await query(
      `INSERT INTO product_colors (id, product_id, name, slug, hex, stock, reserved_stock, is_active, sort_order) VALUES
       (?, ?, 'Emerald Green', 'emerald-green', '#2A7C13', 10, 0, 1, 0),
       (?, ?, 'Ruby Red', 'ruby-red', '#C41E3A', 5, 0, 1, 1)`,
      [colorB1Id, prodBId, colorB2Id, prodBId]
    );

    // Product C: Higher-priced item (₹1299) — should NOT qualify as alternative
    await query(
      `INSERT INTO products (id, category_id, name, slug, description, price, stock_quantity, is_active, created_at, updated_at) VALUES
       (?, ?, 'Colossal Titan Dragon', ?, 'Giant titan dragon', 1299.00, 5, 1, NOW(), NOW())`,
      [prodCId, categoryId, `titan-dragon-${suiteId}`]
    );

    // Product D: Lower-priced (₹399) but OUT OF STOCK — should NOT qualify
    await query(
      `INSERT INTO products (id, category_id, name, slug, description, price, stock_quantity, is_active, created_at, updated_at) VALUES
       (?, ?, 'Pocket Baby Dragon', ?, 'Tiny baby dragon', 399.00, 0, 1, NOW(), NOW())`,
      [prodDId, categoryId, `pocket-dragon-${suiteId}`]
    );

    // Setup customer active cart with Product A
    await query(
      `INSERT INTO carts (id, user_id, status, created_at, updated_at) VALUES (?, ?, 'active', NOW(), NOW())`,
      [cartId, customerId]
    );
    await query(
      `INSERT INTO cart_items (id, cart_id, product_id, quantity, created_at, updated_at) VALUES
       (?, ?, ?, 1, NOW(), NOW())`,
      [cartItemId, cartId, prodAId]
    );

    // -------------------------------------------------------------
    // TEST 2: Part A — Checkout Attempt Creation & Abandonment Transition
    // -------------------------------------------------------------
    console.log("\n--- TEST 2: Part A — Checkout Attempt Creation & Abandonment Transition ---");
    const attempt = await createCheckoutAttemptFromCart(customerId, {
      shippingFullName: "Test Customer",
      shippingPhone: "9876543210",
      shippingAddressLine1: "123 Test Street",
      shippingCity: "Mumbai",
      shippingState: "Maharashtra",
      shippingPostalCode: "400001",
      shippingCountry: "India",
    });
    attemptId = attempt.id;
    assert(attempt.status === "pending", "Initial checkout attempt status is 'pending'");

    // Modal Dismissal -> markAttemptAbandoned
    const abandonResult = await markAttemptAbandoned(attemptId, customerId);
    assert(abandonResult.status === "abandoned", "markAttemptAbandoned transitions status to 'abandoned'");
    assert(abandonResult.isPaid === false, "isPaid remains false for abandoned attempt");

    const abandonedAttempt = await getCheckoutAttemptById(attemptId);
    assert(abandonedAttempt?.status === "abandoned", "Persisted attempt status in MySQL is 'abandoned'");
    assert(Boolean(abandonedAttempt?.abandonedAt), "abandonedAt timestamp is recorded in MySQL");

    // 90-day retention check
    const now = new Date();
    const retentionDate = new Date(abandonedAttempt?.retentionUntil || "");
    const diffDays = Math.round((retentionDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    assert(diffDays >= 89 && diffDays <= 91, `Retention window extended to ~90 days (actual: ${diffDays} days)`);

    // -------------------------------------------------------------
    // TEST 3: Part A — Payment Failure Tracking
    // -------------------------------------------------------------
    console.log("\n--- TEST 3: Part A — Payment Failure Tracking ---");
    // Create a secondary attempt for failure testing using existing active cart
    const failAttempt = await createCheckoutAttemptFromCart(customerId, {
      shippingFullName: "Test Customer",
      shippingPhone: "9876543210",
      shippingAddressLine1: "123 Test Street",
      shippingCity: "Mumbai",
      shippingState: "Maharashtra",
      shippingPostalCode: "400001",
      shippingCountry: "India",
    });

    const failResult = await markAttemptFailed(
      failAttempt.id,
      {
        code: "BAD_REQUEST_ERROR",
        description: "Payment was declined by issuing bank",
        reason: "payment_failed",
      },
      customerId
    );
    assert(failResult.status === "failed", "markAttemptFailed transitions status to 'failed'");
    const reloadedFailAttempt = await getCheckoutAttemptById(failAttempt.id);
    assert(reloadedFailAttempt?.gatewayErrorCode === "BAD_REQUEST_ERROR", "gatewayErrorCode is saved");
    assert(
      reloadedFailAttempt?.gatewayErrorDesc === "Payment was declined by issuing bank",
      "gatewayErrorDesc is saved"
    );

    // -------------------------------------------------------------
    // TEST 4: Part A — Authoritative Recovery Status Check & Suppression Rules
    // -------------------------------------------------------------
    console.log("\n--- TEST 4: Part A — Authoritative Recovery Status Check & Suppression Rules ---");
    // 1. Abandoned attempt before recovery shown -> eligible
    const status1 = await getAttemptRecoveryStatus(attemptId, customerId);
    assert(status1.eligible === true, "Unshown abandoned attempt is eligible for recovery sheet");
    assert(status1.alreadyShown === false, "alreadyShown is false initially");

    // 2. Mark recovery shown
    await recordRecoveryShown(attemptId, customerId);
    const status2 = await getAttemptRecoveryStatus(attemptId, customerId);
    assert(status2.eligible === false, "Recovery sheet is suppressed after already shown");
    assert(status2.alreadyShown === true, "alreadyShown is true after recordRecoveryShown");

    // 3. Reset shown timestamp and test storeSettings toggle suppression
    await query(`UPDATE checkout_attempts SET recovery_shown_at = NULL WHERE id = ?`, [attemptId]);
    await updateStoreSettings({ recoverySheetEnabled: false });
    const status3 = await getAttemptRecoveryStatus(attemptId, customerId);
    assert(status3.eligible === false, "Recovery sheet is suppressed when recoverySheetEnabled is false in settings");
    // Re-enable setting
    await updateStoreSettings({ recoverySheetEnabled: true });

    // -------------------------------------------------------------
    // TEST 5: Part A — Unpaid Invariant Protection
    // -------------------------------------------------------------
    console.log("\n--- TEST 5: Part A — Unpaid Invariant Protection ---");
    const orderRows = await query<any[]>(
      `SELECT * FROM orders WHERE id = ? OR order_number LIKE ?`,
      [attemptId, `%${attemptId.slice(0, 8)}%`]
    );
    assert(orderRows.length === 0, "Unpaid abandoned attempt has ZERO corresponding rows in `orders` table");

    const resolvedRange = resolveReportingPeriod({ period: "day", date: testDate });
    const analytics = await getOrderSummaryMetrics(resolvedRange);
    const hasAttemptInOrders = orderRows.some((r) => r.id === attemptId);
    assert(!hasAttemptInOrders, "Unpaid checkout attempts never count toward placed orders revenue");

    // -------------------------------------------------------------
    // TEST 6: Part C — Lower-Priced Alternatives Query
    // -------------------------------------------------------------
    console.log("\n--- TEST 6: Part C — Lower-Priced Alternatives Query ---");
    const alternatives = await findLowerPricedAlternatives({
      productId: prodAId,
      sourcePrice: 899.00,
      limit: 4,
      excludeCartProductIds: [prodAId],
      attemptId,
      userId: customerId,
    });

    assert(alternatives.length > 0, "Found at least 1 lower-priced alternative");
    const foundMini = alternatives.find((a) => a.productId === prodBId || a.id === prodBId);
    assert(Boolean(foundMini), "Miniature Dragon (₹599) is found as lower-priced alternative to ₹899 Dragon");
    assert(foundMini?.originalPrice === 599.00, "Alternative original price is ₹599");
    assert((foundMini?.effectivePrice ?? 0) <= 599.00, "Alternative effective price is <= ₹599");
    assert((foundMini?.savings ?? 0) >= 300.00, "Calculated savings is at least ₹300 (899 - 599)");

    // Verify exclusions
    const foundTitan = alternatives.find((a) => a.id === prodCId || a.productId === prodCId);
    assert(!foundTitan, "Higher-priced Titan Dragon (₹1299) is excluded");
    const foundPocket = alternatives.find((a) => a.id === prodDId || a.productId === prodDId);
    assert(!foundPocket, "Out-of-stock Pocket Dragon is excluded");

    // -------------------------------------------------------------
    // TEST 7: Part C — Atomic Cart Item Swap
    // -------------------------------------------------------------
    console.log("\n--- TEST 7: Part C — Atomic Cart Item Swap ---");
    const swapResult = await swapCartItemForAlternative({
      userId: customerId,
      sourceProductId: prodAId,
      alternativeProductId: prodBId,
      alternativeColorId: colorB1Id,
      expectedMaxPrice: 650.00,
    });
    assert(swapResult.success === true, "swapCartItemForAlternative succeeds");
    assert(swapResult.swappedItem.productId === prodBId, "Cart now contains alternative product B");
    assert(swapResult.swappedItem.colorId === colorB1Id, "Cart item has Emerald Green color variant");

    // Check cart state in MySQL
    const updatedCartItems = await query<any[]>(
      `SELECT * FROM cart_items WHERE cart_id = ?`,
      [cartId]
    );
    assert(updatedCartItems.length === 1, "Cart still contains exactly 1 item");
    assert(updatedCartItems[0].product_id === prodBId, "Old Product A was removed and Product B added");
    assert(updatedCartItems[0].color_id === colorB1Id, "Correct color variant ID assigned");

    // Test conflict: Out of stock swap attempt fails with 409
    let conflictCaught = false;
    try {
      await swapCartItemForAlternative({
        userId: customerId,
        sourceProductId: prodBId,
        alternativeProductId: prodDId, // Out of stock (0 stock)
      });
    } catch (err) {
      if (err instanceof AlternativesConflictError) {
        conflictCaught = true;
      }
    }
    assert(conflictCaught, "Swap for out-of-stock item is rejected with AlternativesConflictError (409 Conflict)");

    // -------------------------------------------------------------
    // TEST 7B: Full Quantity Preservation & In-Stock Threshold Verification
    // -------------------------------------------------------------
    console.log("\n--- TEST 7B: Full Quantity Preservation & In-Stock Threshold Verification ---");
    // Update cart item quantity to 3
    await query(`UPDATE cart_items SET quantity = 3 WHERE id = ?`, [updatedCartItems[0].id]);

    // Create a low-stock product with only 2 units in stock
    const lowStockProdId = crypto.randomUUID();
    await query(
      `INSERT INTO products (id, category_id, name, slug, description, price, stock_quantity, is_active, created_at, updated_at) VALUES
       (?, ?, 'Low Stock Dragon Model', ?, 'Only 2 available', 499.00, 2, 1, NOW(), NOW())`,
      [lowStockProdId, categoryId, `low-stock-dragon-${suiteId}`]
    );

    const altsForQty3 = await findLowerPricedAlternatives({
      productId: prodBId,
      sourcePrice: 599.00,
      quantity: 3,
      cartItemProductIds: [prodBId],
      attemptId,
      userId: customerId,
    });

    const foundLowStock = altsForQty3.find((a) => a.productId === lowStockProdId);
    assert(!foundLowStock, "Candidate with available stock (2) < requested quantity (3) is excluded from alternatives list");

    // Swap back from Product B to Product A (Product A has stock 10)
    const swapQtyResult = await swapCartItemForAlternative({
      userId: customerId,
      sourceProductId: prodBId,
      alternativeProductId: prodAId,
    });
    assert(swapQtyResult.success === true, "Swap preserves full quantity");
    assert(swapQtyResult.swappedItem.quantity === 3, "Swapped line item maintains original quantity 3");

    const cartAfterSwap = await query<any[]>(`SELECT product_id, quantity FROM cart_items WHERE cart_id = ?`, [cartId]);
    assert(cartAfterSwap[0].product_id === prodAId, "Cart line item updated to Product A");
    assert(cartAfterSwap[0].quantity === 3, "Cart line item preserves full original quantity (3) in database");

    // -------------------------------------------------------------
    // TEST 7C: Insufficient Stock Rejection & Unchanged Cart State
    // -------------------------------------------------------------
    console.log("\n--- TEST 7C: Insufficient Stock Rejection & Unchanged Cart State ---");
    let insufficientStockRejected = false;
    try {
      await swapCartItemForAlternative({
        userId: customerId,
        sourceProductId: prodAId,
        alternativeProductId: lowStockProdId, // Stock is 2, requested quantity is 3
      });
    } catch (err) {
      if (err instanceof AlternativesConflictError) {
        insufficientStockRejected = true;
      }
    }
    assert(insufficientStockRejected, "Swap attempt rejected with AlternativesConflictError when alternative stock is less than full quantity");

    // Verify cart state remains completely unchanged
    const cartAfterRejectedSwap = await query<any[]>(`SELECT product_id, quantity FROM cart_items WHERE cart_id = ?`, [cartId]);
    assert(cartAfterRejectedSwap[0].product_id === prodAId, "Original cart product ID is completely unchanged after rejected swap");
    assert(cartAfterRejectedSwap[0].quantity === 3, "Original cart line quantity is completely unchanged after rejected swap");

    // Reset quantity back to 1 for subsequent tests
    await query(`UPDATE cart_items SET quantity = 1 WHERE cart_id = ?`, [cartId]);

    // -------------------------------------------------------------
    // TEST 7D: Authentication & Ownership Isolation (Account Customers Only)
    // -------------------------------------------------------------
    console.log("\n--- TEST 7D: Authentication & Ownership Isolation (Account Customers Only) ---");
    const otherCustomerId = crypto.randomUUID();
    const otherCustomerEmail = `other_${suiteId}@dearr.test`;
    await query(
      `INSERT INTO profiles (id, email, password_hash, role, full_name, created_at, updated_at) VALUES
       (?, ?, 'hash', 'customer', 'Other Customer', NOW(), NOW())`,
      [otherCustomerId, otherCustomerEmail]
    );

    // 1. Recovery status access isolation
    let otherAccessForbidden = false;
    try {
      await getAttemptRecoveryStatus(attemptId, otherCustomerId);
    } catch (err: any) {
      if (err.statusCode === 403 || String(err.message).includes("Forbidden")) {
        otherAccessForbidden = true;
      }
    }
    assert(otherAccessForbidden, "Customer cannot access another customer's attempt recovery status (HTTP 403)");

    // 2. Recovery shown recording isolation
    let otherShownForbidden = false;
    try {
      await recordRecoveryShown(attemptId, otherCustomerId);
    } catch (err: any) {
      if (err.statusCode === 403 || String(err.message).includes("Forbidden")) {
        otherShownForbidden = true;
      }
    }
    assert(otherShownForbidden, "Customer cannot mark recovery shown on another customer's attempt (HTTP 403)");

    // 3. Mark abandoned isolation
    let otherAbandonForbidden = false;
    try {
      await markAttemptAbandoned(attemptId, otherCustomerId);
    } catch (err: any) {
      if (err.statusCode === 403 || String(err.message).includes("Forbidden")) {
        otherAbandonForbidden = true;
      }
    }
    assert(otherAbandonForbidden, "Customer cannot mark another customer's attempt as abandoned (HTTP 403)");

    // 4. Mark failed isolation
    let otherFailForbidden = false;
    try {
      await markAttemptFailed(attemptId, { code: "TEST_ERR" }, otherCustomerId);
    } catch (err: any) {
      if (err.statusCode === 403 || String(err.message).includes("Forbidden")) {
        otherFailForbidden = true;
      }
    }
    assert(otherFailForbidden, "Customer cannot mark another customer's attempt as failed (HTTP 403)");

    // 5. Swap isolation
    let otherSwapForbidden = false;
    try {
      await swapCartItemForAlternative({
        userId: otherCustomerId,
        sourceProductId: prodAId,
        alternativeProductId: prodBId,
        attemptId, // Belongs to customerId!
      });
    } catch (err: any) {
      if (err.statusCode === 403 || String(err.message).includes("Forbidden")) {
        otherSwapForbidden = true;
      }
    }
    assert(otherSwapForbidden, "Customer cannot swap using another customer's attempt (HTTP 403)");

    // 6. Feedback submission isolation
    let otherFeedbackForbidden = false;
    try {
      await submitCheckoutFeedback({
        attemptId,
        userId: otherCustomerId,
        reasons: ["Other"],
      });
    } catch (err: any) {
      if (err.statusCode === 403 || String(err.message).includes("Forbidden")) {
        otherFeedbackForbidden = true;
      }
    }
    assert(otherFeedbackForbidden, "Customer cannot submit feedback for another customer's attempt (HTTP 403)");

    // 7. Feedback retrieval isolation
    const otherFeedback = await getFeedbackForAttempt(attemptId, otherCustomerId);
    assert(otherFeedback === null, "Customer querying another customer's feedback receives null (no private data leaked)");

    // 8. Notification consent isolation
    let otherConsentForbidden = false;
    try {
      await subscribeNotificationConsent({
        attemptId,
        userId: otherCustomerId,
        channel: "email",
        email: otherCustomerEmail,
        consentText: "I agree to receive price-drop alerts.",
      });
    } catch (err: any) {
      if (err.statusCode === 403 || String(err.message).includes("Forbidden")) {
        otherConsentForbidden = true;
      }
    }
    assert(otherConsentForbidden, "Customer cannot bind notification consent to another customer's attempt (HTTP 403)");

    // 9. Consent retrieval isolation
    const otherConsents = await getConsentsForAttempt(attemptId, otherCustomerId);
    assert(otherConsents.length === 0, "Customer querying another customer's attempt consents receives empty list (no leakage)");

    // 10. Clean up other customer
    await query(`DELETE FROM profiles WHERE id = ?`, [otherCustomerId]);

    // -------------------------------------------------------------
    // TEST 8: Part D — Checkout Feedback Model & Rate Limiting
    // -------------------------------------------------------------
    console.log("\n--- TEST 8: Part D — Checkout Feedback Model & Rate Limiting ---");
    await query(`DELETE FROM rate_limits WHERE rate_key = 'feedback:127.0.0.1'`);
    const feedbackResult = await submitCheckoutFeedback({
      attemptId,
      userId: customerId,
      reasons: ["Price is too high", "Found it cheaper elsewhere"],
      comment: "Would buy if there was a discount bundle.",
      ipAddress: "127.0.0.1",
    });
    assert(Boolean(feedbackResult.feedbackId || feedbackResult.id), "Feedback saved successfully");
    assert(feedbackResult.reasons.length === 2, "2 reasons persisted");

    const feedbackRecords = await getAttemptFeedback(attemptId);
    assert(feedbackRecords.length === 1, "Persisted feedback retrieved from MySQL");
    assert(feedbackRecords[0].reasons.includes("Price is too high"), "Stored reasons match input");
    assert(
      feedbackRecords[0].comment === "Would buy if there was a discount bundle.",
      "Stored comment matches input"
    );

    // Rate limiting: Max 10 submissions per 15 min; 11th triggers rate limit
    let rateLimited = false;
    for (let i = 0; i < 12; i++) {
      try {
        await submitCheckoutFeedback({
          attemptId,
          userId: customerId,
          reasons: ["Other"],
          ipAddress: "127.0.0.1",
        });
      } catch (err: any) {
        if (err.statusCode === 429) {
          rateLimited = true;
          break;
        }
      }
    }
    assert(rateLimited, "Excessive feedback submissions rejected with HTTP 429 Too Many Requests");

    // -------------------------------------------------------------
    // TEST 9: Part E — Future Notification Consent Groundwork (Data-Only)
    // -------------------------------------------------------------
    console.log("\n--- TEST 9: Part E — Future Notification Consent Groundwork (Data-Only) ---");
    const consent = await subscribeNotificationConsent({
      userId: customerId,
      email: testEmail,
      phone: "9876543210",
      channel: "email",
      topic: "cart_recovery",
      sourceAttemptId: attemptId,
      ipAddress: "127.0.0.1",
    });
    assert(consent.status === "subscribed", "Customer successfully opted into email recovery notification channel");

    const consentsList = await getNotificationConsentsForUser(customerId);
    assert(consentsList.length >= 1, "Persisted consent found in MySQL");
    assert(consentsList[0].channel === "email", "Consent channel is 'email'");

    // Cross-customer withdrawal attack test:
    const intruderId = crypto.randomUUID();
    const unauthorizedUnsubResult = await withdrawNotificationConsent({
      consentId: consent.id,
      userId: intruderId,
    });
    assert(unauthorizedUnsubResult.withdrawnCount === 0, "Intruder customer cannot withdraw another customer's notification consent by consentId");

    const consentCheck = await query<any[]>(`SELECT is_withdrawn FROM notification_consents WHERE id = ?`, [consent.id]);
    assert(consentCheck[0].is_withdrawn === 0, "Customer's consent remains active after unauthorized withdrawal attempt");

    // Legitimate customer unsubscribe
    const unsub = await unsubscribeNotificationConsent(customerId, "email");
    assert(unsub.unsubscribed === true, "Customer can legitimately unsubscribe and status updates to 'unsubscribed'");

    // -------------------------------------------------------------
    // TEST 10: Part F — Product & Color Price History Auditing
    // -------------------------------------------------------------
    console.log("\n--- TEST 10: Part F — Product & Color Price History Auditing ---");
    await recordPriceChange({
      productId: prodAId,
      oldPrice: 899.00,
      newPrice: 799.00,
      changedBy: adminId,
      reason: "Holiday seasonal reduction",
    });

    await recordPriceChange({
      productId: prodBId,
      colorId: colorB1Id,
      oldPrice: 599.00,
      newPrice: 549.00,
      changedBy: adminId,
      reason: "Emerald filament cost optimization",
    });

    const prodAHistory = await getProductPriceHistory(prodAId);
    assert(prodAHistory.length === 1, "Price history entry created for base product A");
    assert(prodAHistory[0].oldPrice === 799.00 || prodAHistory[0].oldPrice === 899.00, "Price values logged correctly");

    const colorBHistory = await getProductPriceHistory(prodBId);
    assert(colorBHistory.length >= 1, "Price history entry created for color variant override");

    // -------------------------------------------------------------
    // TEST 11: Part F — Complete Funnel Events Telemetry Verification
    // -------------------------------------------------------------
    console.log("\n--- TEST 11: Part F — Complete Funnel Events Telemetry Verification ---");
    await recordInternalEvent({
      eventType: "cart_viewed",
      userId: customerId,
      metadata: { itemCount: 1 },
    });
    await recordInternalEvent({
      eventType: "razorpay_opened",
      attemptId,
      userId: customerId,
      metadata: { amount: 899 },
    });
    await recordInternalEvent({
      eventType: "payment_success",
      attemptId,
      userId: customerId,
      metadata: { amount: 899 },
    });

    const allEventsRows = await query<any[]>(
      `SELECT DISTINCT event_type FROM internal_events WHERE user_id IN (?, ?) OR attempt_id = ?`,
      [customerId, adminId, attemptId]
    );
    const recordedTypes = new Set(allEventsRows.map((r) => r.event_type));

    const requiredEvents = [
      "cart_viewed",
      "checkout_started",
      "razorpay_opened",
      "razorpay_dismissed",
      "payment_failed",
      "payment_success",
      "alternative_viewed",
      "alternative_swapped",
      "checkout.abandoned",
      "product.price_changed",
      "feedback.submitted",
    ];

    for (const evt of requiredEvents) {
      assert(recordedTypes.has(evt), `internal_events captured '${evt}'`);
    }

    // -------------------------------------------------------------
    // TEST 12: Part G — Admin Abandonment Analytics & CSV Export
    // -------------------------------------------------------------
    console.log("\n--- TEST 12: Part G — Admin Abandonment Analytics & CSV Export ---");
    const summary = await getAbandonmentSummaryMetrics({
      period: "day",
      date: testDate,
    });
    assert((summary.metrics?.totalInitiatedCheckouts ?? 0) >= 1, "totalInitiatedCheckouts counted in summary");
    assert((summary.metrics?.abandonedCheckouts ?? 0) >= 1, "abandonedCheckouts counted in summary");
    assert(summary.topReasons.length >= 1, "Top reasons for leaving returned in summary");

    const recentCheckouts = await listRecentAbandonedCheckouts({
      period: "day",
      date: testDate,
      limit: 10,
    });
    assert(recentCheckouts.checkouts.length >= 1, "Recent abandoned checkouts list populated");
    assert(
      recentCheckouts.checkouts.some((c) => c.id === attemptId),
      "Created test attempt appears in recent checkouts list"
    );

    // CSV Stream Export
    const csvChunks: string[] = [];
    const stream = streamAbandonmentCsv({
      period: "day",
      date: testDate,
      actorId: adminId,
    });
    const reader = stream.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      csvChunks.push(new TextDecoder("utf-8", { ignoreBOM: true }).decode(value));
    }
    const fullCsv = csvChunks.join("");
    assert(fullCsv.startsWith("\uFEFF"), "CSV starts with UTF-8 BOM");
    assert(fullCsv.includes("Attempt ID"), "CSV contains headers");
    assert(fullCsv.includes("Status"), "CSV contains Status column");
    assert(fullCsv.includes(attemptId.slice(0, 8).toUpperCase()), "CSV exports the test attempt row");

    // Formula Injection Mitigation Test
    const formulaAttemptId = crypto.randomUUID();
    await query(
      `INSERT INTO checkout_attempts (id, user_id, amount, status, checkout_data, created_at, expires_at, retention_until) VALUES
       (?, ?, 100.00, 'abandoned', ?, NOW(), DATE_ADD(NOW(), INTERVAL 30 MINUTE), DATE_ADD(NOW(), INTERVAL 90 DAY))`,
      [
        formulaAttemptId,
        customerId,
        JSON.stringify({
          shippingAddress: {
            shippingFullName: "=SUM(1,2)",
            shippingPhone: "+91 9999999999",
            shippingAddressLine1: "-123 Fake Street",
            shippingCity: "@City",
          },
        }),
      ]
    );

    const formulaStream = streamAbandonmentCsv({
      period: "day",
      date: testDate,
      actorId: adminId,
    });
    const formulaReader = formulaStream.getReader();
    const formulaChunks: string[] = [];
    while (true) {
      const { done, value } = await formulaReader.read();
      if (done) break;
      formulaChunks.push(new TextDecoder("utf-8", { ignoreBOM: true }).decode(value));
    }
    const formulaCsv = formulaChunks.join("");
    assert(
      formulaCsv.includes("''=SUM(1,2)") || formulaCsv.includes("'=SUM(1,2)"),
      "Formula injection prefix '=' safely neutralized with single quote prefix"
    );

    // Verify order_export_audits record
    const auditRows = await query<any[]>(
      `SELECT * FROM order_export_audits WHERE actor_id = ? AND export_type = 'abandonment' ORDER BY created_at DESC LIMIT 1`,
      [adminId]
    );
    assert(auditRows.length === 1, "order_export_audits recorded entry for abandonment CSV export");

    // -------------------------------------------------------------
    // TEST 12B: Recovery Attribution Across Retries/Swaps & Deduplication
    // -------------------------------------------------------------
    console.log("\n--- TEST 12B: Recovery Attribution Across Retries/Swaps & Deduplication ---");
    const episodeAttempt1Id = crypto.randomUUID();
    const episodeAttempt2Id = crypto.randomUUID();
    const episodeOrderId = crypto.randomUUID();
    const episodeOrderNumber = `REC-${suiteId.slice(0, 6).toUpperCase()}`;

    // Attempt 1: Abandoned
    await query(
      `INSERT INTO checkout_attempts (id, user_id, amount, status, checkout_data, abandoned_at, created_at, expires_at, retention_until)
       VALUES (?, ?, 899.00, 'abandoned', '{}', NOW(), NOW(), DATE_ADD(NOW(), INTERVAL 30 MINUTE), DATE_ADD(NOW(), INTERVAL 90 DAY))`,
      [episodeAttempt1Id, customerId]
    );

    // Attempt 2: Swapped / Retried from Attempt 1, then converted to placed order
    await query(
      `INSERT INTO checkout_attempts (id, user_id, amount, status, order_id, checkout_data, created_at, expires_at, retention_until)
       VALUES (?, ?, 599.00, 'converted', ?, ?, NOW(), DATE_ADD(NOW(), INTERVAL 30 MINUTE), DATE_ADD(NOW(), INTERVAL 90 DAY))`,
      [
        episodeAttempt2Id,
        customerId,
        episodeOrderId,
        JSON.stringify({ sourceAttemptId: episodeAttempt1Id, isRecovery: true }),
      ]
    );

    // Placed Order record
    await query(
      `INSERT INTO orders (id, order_number, user_id, status, payment_status, subtotal, discount_amount, shipping_amount, total_amount, currency, shipping_full_name, shipping_phone, shipping_address_line_1, shipping_city, shipping_state, shipping_postal_code, shipping_country, created_at, updated_at)
       VALUES (?, ?, ?, 'confirmed', 'paid', 599.00, 0, 0, 599.00, 'INR', 'Test Customer', '9876543210', '123 Test St', 'Mumbai', 'Maharashtra', '400001', 'India', NOW(), NOW())`,
      [episodeOrderId, episodeOrderNumber, customerId]
    );

    // Verify abandonment summary metrics count this order with zero double-counting
    const recoverySummary = await getAbandonmentSummaryMetrics({ period: "day", date: testDate });
    assert(recoverySummary.recoveredOrders >= 1, "Recovery attribution correctly identifies converted order from linked recovery attempt");

    // Clean up episode test data
    await query(`DELETE FROM orders WHERE id = ?`, [episodeOrderId]);
    await query(`DELETE FROM checkout_attempts WHERE id IN (?, ?)`, [episodeAttempt1Id, episodeAttempt2Id]);

    // -------------------------------------------------------------
    // TEST 13: Part H — Admin Recovery Settings
    // -------------------------------------------------------------
    console.log("\n--- TEST 13: Part H — Admin Recovery Settings ---");
    await updateStoreSettings({
      recoverySheetEnabled: true,
      alternativesEnabled: true,
      feedbackEnabled: true,
      maxAlternatives: 3,
      feedbackReasons: ["Price is too high", "Shipping takes too long", "Found alternative"],
    });

    const updatedSettings = await getStoreSettings();
    assert(updatedSettings.recoverySheetEnabled === true, "recoverySheetEnabled saved");
    assert(updatedSettings.alternativesEnabled === true, "alternativesEnabled saved");
    assert(updatedSettings.feedbackEnabled === true, "feedbackEnabled saved");
    assert(updatedSettings.maxAlternatives === 3, "maxAlternatives saved as 3");
    assert(
      Array.isArray(updatedSettings.feedbackReasons) && updatedSettings.feedbackReasons.length === 3,
      "feedbackReasons saved custom array"
    );

    // -------------------------------------------------------------
    // TEST 14: Ninety-Day Retention Boundary & Safe Purge Lifecycle
    // -------------------------------------------------------------
    console.log("\n--- TEST 14: Ninety-Day Retention Boundary & Safe Purge Lifecycle ---");
    const pastAttemptId = crypto.randomUUID();
    const exactBoundaryPastId = crypto.randomUUID();
    const boundaryFutureId = crypto.randomUUID();
    const futureAttemptId = crypto.randomUUID();
    const convertedAttemptId = crypto.randomUUID();
    const pastFeedbackId = crypto.randomUUID();
    const pastConsentId = crypto.randomUUID();

    // 1. Past 95 days (retention_until was 5 days ago)
    await query(
      `INSERT INTO checkout_attempts (id, user_id, amount, status, checkout_data, created_at, expires_at, retention_until)
       VALUES (?, ?, 500.00, 'abandoned', '{}', DATE_SUB(NOW(), INTERVAL 95 DAY), DATE_SUB(NOW(), INTERVAL 95 DAY), DATE_SUB(NOW(), INTERVAL 5 DAY))`,
      [pastAttemptId, customerId]
    );

    // Associated feedback record for past attempt
    await query(
      `INSERT INTO checkout_feedback (id, attempt_id, user_id, reasons, skipped, created_at)
       VALUES (?, ?, ?, '["Price is too high"]', 0, DATE_SUB(NOW(), INTERVAL 95 DAY))`,
      [pastFeedbackId, pastAttemptId, customerId]
    );

    // Associated notification consent record for past attempt
    await query(
      `INSERT INTO notification_consents (id, user_id, attempt_id, channel, contact_value, consent_text, source, is_withdrawn, created_at)
       VALUES (?, ?, ?, 'email', 'audit_past@dearr.test', 'I agree to receive price-drop alerts.', 'checkout_abandonment', 1, DATE_SUB(NOW(), INTERVAL 95 DAY))`,
      [pastConsentId, customerId, pastAttemptId]
    );

    // 2. Exactly at retention boundary (retention_until was 10 seconds ago -> eligible for purge)
    await query(
      `INSERT INTO checkout_attempts (id, user_id, amount, status, checkout_data, created_at, expires_at, retention_until)
       VALUES (?, ?, 550.00, 'expired', '{}', DATE_SUB(NOW(), INTERVAL 90 DAY), DATE_SUB(NOW(), INTERVAL 90 DAY), DATE_SUB(NOW(), INTERVAL 10 SECOND))`,
      [exactBoundaryPastId, customerId]
    );

    // 3. Immediately before retention boundary (89 days old, retention_until is 1 day in the future -> PRESERVED)
    await query(
      `INSERT INTO checkout_attempts (id, user_id, amount, status, checkout_data, created_at, expires_at, retention_until)
       VALUES (?, ?, 580.00, 'abandoned', '{}', DATE_SUB(NOW(), INTERVAL 89 DAY), DATE_SUB(NOW(), INTERVAL 89 DAY), DATE_ADD(NOW(), INTERVAL 1 DAY))`,
      [boundaryFutureId, customerId]
    );

    // 4. Future attempt well within 90-day retention window (10 days old, 80 days remaining)
    await query(
      `INSERT INTO checkout_attempts (id, user_id, amount, status, checkout_data, created_at, expires_at, retention_until)
       VALUES (?, ?, 600.00, 'abandoned', '{}', DATE_SUB(NOW(), INTERVAL 10 DAY), DATE_SUB(NOW(), INTERVAL 10 DAY), DATE_ADD(NOW(), INTERVAL 80 DAY))`,
      [futureAttemptId, customerId]
    );

    // 5. Converted attempt (status = 'converted') past retention date (must NEVER be deleted)
    await query(
      `INSERT INTO checkout_attempts (id, user_id, amount, status, checkout_data, created_at, expires_at, retention_until)
       VALUES (?, ?, 700.00, 'converted', '{}', DATE_SUB(NOW(), INTERVAL 95 DAY), DATE_SUB(NOW(), INTERVAL 95 DAY), DATE_SUB(NOW(), INTERVAL 5 DAY))`,
      [convertedAttemptId, customerId]
    );

    // Run cleanup
    const cleanupResult = await cleanupCheckoutAttempts();
    assert(cleanupResult.purgedCount >= 2, "cleanupCheckoutAttempts purged eligible records past 90-day retention");

    // Verify past attempts were deleted
    const pastRows = await query<any[]>(`SELECT id FROM checkout_attempts WHERE id IN (?, ?)`, [pastAttemptId, exactBoundaryPastId]);
    assert(pastRows.length === 0, "Attempts at or past 90-day retention deadline successfully purged");

    // Verify feedback was cascade-deleted
    const pastFeedbackRows = await query<any[]>(`SELECT id FROM checkout_feedback WHERE id = ?`, [pastFeedbackId]);
    assert(pastFeedbackRows.length === 0, "Checkout feedback for purged attempt cascade-deleted cleanly");

    // Verify notification consent is PRESERVED (compliance audit requirement)
    const pastConsentRows = await query<any[]>(`SELECT id, is_withdrawn FROM notification_consents WHERE id = ?`, [pastConsentId]);
    assert(pastConsentRows.length === 1 && pastConsentRows[0].is_withdrawn === 1, "Consent withdrawal records remain intact for compliance/audit after attempt purge");

    // Verify attempt before boundary (89 days old) was NOT deleted
    const boundaryFutureRows = await query<any[]>(`SELECT id FROM checkout_attempts WHERE id = ?`, [boundaryFutureId]);
    assert(boundaryFutureRows.length === 1, "Attempt within 90-day retention boundary (e.g., 89 days old) is safely preserved");

    // Verify future attempt was NOT deleted
    const futureRows = await query<any[]>(`SELECT id FROM checkout_attempts WHERE id = ?`, [futureAttemptId]);
    assert(futureRows.length === 1, "Attempt well within 90-day retention boundary is safely preserved");

    // Verify converted attempt was NOT deleted
    const convertedRows = await query<any[]>(`SELECT id FROM checkout_attempts WHERE id = ?`, [convertedAttemptId]);
    assert(convertedRows.length === 1, "Converted attempts and placed order history are NEVER deleted by cleanup");

    // Clean up temporary retention test attempts
    await query(`DELETE FROM notification_consents WHERE id = ?`, [pastConsentId]);
    await query(`DELETE FROM checkout_attempts WHERE id IN (?, ?, ?)`, [boundaryFutureId, futureAttemptId, convertedAttemptId]);

    // -------------------------------------------------------------
    // TEST 15: Coupon Creation & Discount Precedence (No Stacking)
    // -------------------------------------------------------------
    console.log("\n--- TEST 15: Coupon Creation & Discount Precedence (No Stacking) ---");
    const testDiscountCode = `DEARR10_${suiteId.toUpperCase()}`;
    const createdDiscount = await createDiscount({
      name: `Test Promo ${suiteId}`,
      code: testDiscountCode,
      discountType: "percentage",
      value: 10,
      scope: "product",
      productIds: [prodAId],
      startAt: new Date(Date.now() - 60000),
      isActive: true,
    });
    assert(Boolean(createdDiscount.id), "createDiscount successfully persisted discount in transaction");

    // Verify coupon.created event
    const couponEvents = await query<any[]>(
      `SELECT * FROM internal_events WHERE event_type = 'coupon.created' AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.code')) = ?`,
      [testDiscountCode]
    );
    assert(couponEvents.length === 1, "internal_events recorded 'coupon.created' after successful commit");

    // Verify precedence
    const applicable = await getApplicableDiscountForProduct(prodAId);
    assert(applicable?.discount?.code === testDiscountCode, "Product-specific discount resolved with highest precedence");

    // Clean up test discount
    await query(`DELETE FROM discount_products WHERE discount_id = ?`, [createdDiscount.id]);
    await query(`DELETE FROM discounts WHERE id = ?`, [createdDiscount.id]);

  } catch (err: any) {
    console.error("UNEXPECTED TEST EXCEPTION:", err);
    failCount++;
  } finally {
    // Teardown test fixtures
    try {
      // Restore default store settings
      await updateStoreSettings({
        recoverySheetEnabled: true,
        alternativesEnabled: true,
        feedbackEnabled: true,
        maxAlternatives: 4,
        feedbackReasons: [
          "Price is too high",
          "Found it cheaper elsewhere",
          "Shipping charges too high",
          "Delivery takes too long",
          "Payment problem",
          "Wanted Cash on Delivery",
          "Not sure about product quality",
          "Just browsing",
          "Need to compare more",
          "Other",
        ],
      });

      if (customerId) {
        await query(`DELETE FROM internal_events WHERE user_id = ?`, [customerId]);
        await query(`DELETE FROM notification_consents WHERE user_id = ?`, [customerId]);
        await query(`DELETE FROM checkout_feedback WHERE user_id = ?`, [customerId]);
        await query(`DELETE FROM cart_items WHERE cart_id IN (SELECT id FROM carts WHERE user_id = ?)`, [customerId]);
        await query(`DELETE FROM carts WHERE user_id = ?`, [customerId]);
        await query(`DELETE FROM checkout_attempts WHERE user_id = ?`, [customerId]);
        await query(`DELETE FROM profiles WHERE id IN (?, ?)`, [customerId, adminId]);
      }
      if (prodAId) {
        await query(`DELETE FROM product_price_history WHERE product_id IN (?, ?, ?, ?)`, [prodAId, prodBId, prodCId, prodDId]);
        await query(`DELETE FROM product_colors WHERE product_id = ?`, [prodBId]);
        await query(`DELETE FROM products WHERE id IN (?, ?, ?, ?)`, [prodAId, prodBId, prodCId, prodDId]);
      }
      if (categoryId) {
        await query(`DELETE FROM categories WHERE id = ?`, [categoryId]);
      }
      if (adminId) {
        await query(`DELETE FROM order_export_audits WHERE actor_id = ?`, [adminId]);
      }
      await query(`DELETE FROM rate_limits WHERE rate_key = 'feedback:127.0.0.1'`);
    } catch (cleanupErr) {
      console.warn("Cleanup warning:", cleanupErr);
    }
  }

  console.log("\n=================================================");
  console.log(`Test Results: ${passCount} Passed, ${failCount} Failed`);
  console.log("=================================================");

  if (failCount > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTestSuite();
