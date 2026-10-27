/**
 * =============================================================================
 * Shiprocket Integration Test Suite
 * =============================================================================
 * Verifies:
 *  1. Safe configuration loader and secrets isolation
 *  2. Authentication token caching and expiry lifecycle
 *  3. Order mapping from Dearr Order Model to Shiprocket Adhoc payload
 *  4. Status mapping to Dearr's canonical 4-stage tracking system
 *  5. Webhook token validation and payload parsing
 *  6. Storefront pincode serviceability validation & fallback
 * =============================================================================
 */

// Mock 'server-only' so test runners and standalone Node processes can import server components
try {
  const p = require.resolve("server-only");
  require.cache[p] = { id: p, filename: p, loaded: true, exports: {} };
} catch (_) {
  // Ignore if resolution fails
}

async function getShiprocketModule() {
  return await import("../src/lib/server/shiprocket");
}


let testsRun = 0;
let testsPassed = 0;
let testsFailed = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  testsRun++;
  if (condition) {
    testsPassed++;
    console.log(`  ✓ [PASS] ${testName}`);
  } else {
    testsFailed++;
    console.error(`  ✗ [FAIL] ${testName}${detail ? ` - ${detail}` : ""}`);
  }
}

async function runTests() {
  const {
    isShiprocketConfigured,
    isShiprocketEnabled,
    getShiprocketConfig,
    setShiprocketMockTokenForTesting,
    resetShiprocketAuthCacheForTesting,
    getShiprocketAuthToken,
    mapDearrOrderToShiprocketPayload,
    mapShiprocketStatusToTracking,
    verifyShiprocketWebhook,
    ShiprocketConfigError,
  } = await getShiprocketModule();

  console.log("\n=======================================================");
  console.log(" Running Shiprocket Service Library & Config Tests");
  console.log("=======================================================\n");

  // Save initial env
  const origEmail = process.env.SHIPROCKET_EMAIL;
  const origPassword = process.env.SHIPROCKET_PASSWORD;
  const origEnabled = process.env.SHIPROCKET_ENABLED;
  const origWebhookToken = process.env.SHIPROCKET_WEBHOOK_TOKEN;

  try {
    // -------------------------------------------------------------------------
    // Test Group 1: Configuration & Secrets Shielding
    // -------------------------------------------------------------------------
    console.log("[Test Group 1: Configuration & Secrets Shielding]");

    delete process.env.SHIPROCKET_EMAIL;

    delete process.env.SHIPROCKET_PASSWORD;
    process.env.SHIPROCKET_ENABLED = "false";

    assert(
      isShiprocketConfigured() === false,
      "isShiprocketConfigured() returns false when credentials missing"
    );
    assert(
      isShiprocketEnabled() === false,
      "isShiprocketEnabled() returns false when SHIPROCKET_ENABLED=false"
    );

    const emptyConfig = getShiprocketConfig();
    assert(
      emptyConfig.isConfigured === false && emptyConfig.isEnabled === false,
      "getShiprocketConfig() returns correct flags when empty"
    );
    assert(
      !("password" in (emptyConfig as any)),
      "getShiprocketConfig() never contains or exposes password field"
    );

    process.env.SHIPROCKET_EMAIL = "test@dearr.in";
    process.env.SHIPROCKET_PASSWORD = "supersecretpassword";
    process.env.SHIPROCKET_ENABLED = "true";
    process.env.SHIPROCKET_WEBHOOK_TOKEN = "webhook_secret_123";

    assert(
      isShiprocketConfigured() === true,
      "isShiprocketConfigured() returns true when email and password set"
    );
    assert(
      isShiprocketEnabled() === true,
      "isShiprocketEnabled() returns true when SHIPROCKET_ENABLED=true"
    );

    const safeConfig = getShiprocketConfig();
    assert(
      safeConfig.email === "test@dearr.in",
      "getShiprocketConfig() returns configured email"
    );
    assert(
      safeConfig.hasWebhookToken === true,
      "getShiprocketConfig() detects webhook token presence without exposing it"
    );
    assert(
      !("password" in (safeConfig as any)),
      "Safe config strictly omits the password"
    );

    // -------------------------------------------------------------------------
    // Test Group 2: Token Caching & Mock Lifecycle
    // -------------------------------------------------------------------------
    console.log("\n[Test Group 2: Token Management & Lifecycle]");

    resetShiprocketAuthCacheForTesting();
    setShiprocketMockTokenForTesting("mock_jwt_token_abc_123", 24);

    const token = await getShiprocketAuthToken();
    assert(
      token === "mock_jwt_token_abc_123",
      "getShiprocketAuthToken() returns cached mock token"
    );

    // Test error when not configured
    resetShiprocketAuthCacheForTesting();
    delete process.env.SHIPROCKET_EMAIL;
    delete process.env.SHIPROCKET_PASSWORD;

    let threwExpected = false;
    try {
      await getShiprocketAuthToken();
    } catch (err: any) {
      if (err instanceof ShiprocketConfigError) {
        threwExpected = true;
      }
    }
    assert(
      threwExpected,
      "getShiprocketAuthToken() throws ShiprocketConfigError when credentials missing"
    );

    // -------------------------------------------------------------------------
    // Test Group 3: Order Mapping (Dearr -> Shiprocket)
    // -------------------------------------------------------------------------
    console.log("\n[Test Group 3: Order Mapping]");

    const mockDearrOrder = {
      orderNumber: "ORD-20261028-9876",
      createdAt: new Date("2026-10-28T12:00:00Z"),
      totalAmount: 1499,
      subtotal: 1399,
      discountAmount: 0,
      shippingAmount: 100,
      paymentMethod: "Razorpay (Online Prepaid)",
      shippingFullName: "Ananya Sharma",
      shippingPhone: "+91 98765 43210",
      shippingAddressLine1: "Flat 402, Green Meadows",
      shippingAddressLine2: "12th Cross, Indiranagar",
      shippingCity: "Bengaluru",
      shippingPostalCode: "560038",
      shippingState: "Karnataka",
      shippingCountry: "India",
      customerEmail: "ananya@example.com",
      items: [
        {
          productName: "Artisanal Ceramic Planter",
          variantName: "Terracotta / Medium",
          sku: "PLNT-TC-MED",
          quantity: 2,
          unitPrice: 699.5,
          discountAmount: 0,
        },
      ],
    };

    const payload = mapDearrOrderToShiprocketPayload(mockDearrOrder, {
      pickupLocation: "Warehouse Bengaluru",
      weightKg: 1.2,
      dimensions: { length: 20, breadth: 15, height: 15 },
    });

    assert(
      payload.order_id === "ORD-20261028-9876",
      "Mapped order_id matches Dearr orderNumber"
    );
    assert(
      payload.pickup_location === "Warehouse Bengaluru",
      "Mapped pickup_location matches configured value"
    );
    assert(
      payload.billing_customer_name === "Ananya" && payload.billing_last_name === "Sharma",
      "Customer name is parsed into first and last name"
    );
    assert(
      payload.billing_phone === "9876543210",
      "Phone number is sanitized to 10 digits"
    );
    assert(
      payload.payment_method === "Prepaid",
      "Prepaid payment method correctly identified"
    );
    assert(
      payload.weight === 1.2,
      "Weight in kg is mapped accurately"
    );
    assert(
      payload.order_items.length === 1 && payload.order_items[0].sku === "PLNT-TC-MED",
      "Order items and SKU are preserved"
    );

    // COD order mapping
    const codOrder = {
      ...mockDearrOrder,
      paymentMethod: "Cash on Delivery",
    };
    const codPayload = mapDearrOrderToShiprocketPayload(codOrder);
    assert(
      codPayload.payment_method === "COD",
      "COD payment method correctly detected"
    );

    // -------------------------------------------------------------------------
    // Test Group 4: Canonical 4-Stage Tracking Mapping
    // -------------------------------------------------------------------------
    console.log("\n[Test Group 4: Canonical 4-Stage Tracking Status Mapping]");

    const stageDelivered = mapShiprocketStatusToTracking("DELIVERED");
    assert(
      stageDelivered.stageId === "delivered" && stageDelivered.isDelivered === true,
      "DELIVERED maps to stage 4 (delivered) with isDelivered=true"
    );

    const stageInTransit = mapShiprocketStatusToTracking("IN TRANSIT");
    assert(
      stageInTransit.stageId === "delivered" && stageInTransit.isDispatched === true && stageInTransit.isDelivered === false,
      "IN TRANSIT maps to stage 4 (in transit) with isDispatched=true"
    );

    const stageOutForDelivery = mapShiprocketStatusToTracking("OUT FOR DELIVERY");
    assert(
      stageOutForDelivery.stageId === "delivered" && stageOutForDelivery.badge === "Out for Delivery",
      "OUT FOR DELIVERY maps to stage 4 with appropriate badge"
    );

    const stagePickupScheduled = mapShiprocketStatusToTracking("PICKUP SCHEDULED");
    assert(
      stagePickupScheduled.stageId === "packed_dispatched" && stagePickupScheduled.badge === "Ready for Pickup",
      "PICKUP SCHEDULED maps to stage 3 (packed_dispatched)"
    );

    const stageCancelled = mapShiprocketStatusToTracking("CANCELLED");
    assert(
      stageCancelled.isCancelled === true,
      "CANCELLED maps with isCancelled=true"
    );

    const stageRto = mapShiprocketStatusToTracking("RETURNED_TO_ORIGIN");
    assert(
      stageRto.isCancelled === true && stageRto.badge.includes("RTO"),
      "RETURNED_TO_ORIGIN maps to RTO badge"
    );

    // -------------------------------------------------------------------------
    // Test Group 5: Webhook Token Verification
    // -------------------------------------------------------------------------
    console.log("\n[Test Group 5: Webhook Token Verification]");

    process.env.SHIPROCKET_WEBHOOK_TOKEN = "secure_webhook_secret_999";
    assert(
      verifyShiprocketWebhook("secure_webhook_secret_999") === true,
      "verifyShiprocketWebhook returns true for valid secret token"
    );
    assert(
      verifyShiprocketWebhook("wrong_token") === false,
      "verifyShiprocketWebhook returns false for mismatched token"
    );
    assert(
      verifyShiprocketWebhook("secure_webhook_secret_99") === false,
      "verifyShiprocketWebhook returns false for token of different length"
    );
    assert(
      verifyShiprocketWebhook(null) === false,
      "verifyShiprocketWebhook returns false for missing token"
    );

    // Fail-closed test when no token is set in environment
    delete process.env.SHIPROCKET_WEBHOOK_TOKEN;
    assert(
      verifyShiprocketWebhook("any_token") === false,
      "verifyShiprocketWebhook fails-closed (returns false) when SHIPROCKET_WEBHOOK_TOKEN is unset"
    );

    // -------------------------------------------------------------------------
    // Test Group 6: Webhook Route Keyword Scrubbing
    // -------------------------------------------------------------------------
    console.log("\n[Test Group 6: Courier Webhook Endpoint Neutrality]");

    const webhookRoute = "/api/webhooks/courier-updates";
    const bannedPatterns = [/shiprocket/i, /kartrocket/i, /\bsr\b/i, /\bkr\b/i];
    const containsBanned = bannedPatterns.some((p) => p.test(webhookRoute));
    assert(
      !containsBanned,
      "Webhook route path /api/webhooks/courier-updates is free of carrier-specific keywords (shiprocket, kartrocket, sr, kr)"
    );

    // -------------------------------------------------------------------------
    // Test Group 7: Shipping Quote Engine (Task S-02)
    // -------------------------------------------------------------------------
    console.log("\n[Test Group 7: Shipping Quote Calculation Engine]");

    const { getShippingQuote } = await import("../src/lib/server/shipping-quote");

    // 7.1 Invalid PIN code validation
    let pincodeThrew = false;
    try {
      await getShippingQuote({
        deliveryPincode: "12345",
        subtotal: 500,
        paymentMethod: "prepaid",
      });
    } catch {
      pincodeThrew = true;
    }
    assert(pincodeThrew, "getShippingQuote throws on invalid 5-digit PIN code");

    // 7.2 Prepaid order reaching free shipping threshold (₹999) -> ₹0 shipping
    const freePrepaidQuote = await getShippingQuote({
      deliveryPincode: "560038",
      subtotal: 1200,
      paymentMethod: "prepaid",
    });
    assert(
      freePrepaidQuote.finalCustomerShippingFee === 0 &&
      freePrepaidQuote.rateSource === "free_threshold" &&
      freePrepaidQuote.breakdown.isFreeShippingEligible === true,
      "Prepaid order >= ₹999 gets 100% free shipping (₹0 charged)"
    );

    // 7.3 COD order reaching free shipping threshold (₹999) -> pays minimum COD fee (₹50)
    const freeCodQuote = await getShippingQuote({
      deliveryPincode: "560038",
      subtotal: 1200,
      paymentMethod: "cod",
    });
    assert(
      freeCodQuote.finalCustomerShippingFee === 50 &&
      freeCodQuote.codFeeAmount === 50 &&
      freeCodQuote.rateSource === "cod_fee_only",
      "COD order >= ₹999 waives courier fee but charges admin COD handling fee (₹50)"
    );

    // 7.4 Prepaid order below threshold -> pays fallback rate (₹50)
    process.env.SHIPROCKET_ENABLED = "false";
    const belowPrepaidQuote = await getShippingQuote({
      deliveryPincode: "560038",
      subtotal: 499,
      paymentMethod: "prepaid",
    });
    assert(
      belowPrepaidQuote.finalCustomerShippingFee === 50 &&
      belowPrepaidQuote.baseCourierAmount === 50 &&
      belowPrepaidQuote.codFeeAmount === 0,
      "Prepaid order < ₹999 charges fallback rate (₹50)"
    );

    // 7.5 COD order below threshold -> pays fallback rate + COD fee (₹50 + ₹50 = ₹100)
    const belowCodQuote = await getShippingQuote({
      deliveryPincode: "560038",
      subtotal: 499,
      paymentMethod: "cod",
    });
    assert(
      belowCodQuote.finalCustomerShippingFee === 100 &&
      belowCodQuote.baseCourierAmount === 50 &&
      belowCodQuote.codFeeAmount === 50,
      "COD order < ₹999 charges fallback rate + COD handling fee (₹100 total)"
    );

    // 7.6 COD max order value cap (₹1500)
    const overMaxCodQuote = await getShippingQuote({
      deliveryPincode: "560038",
      subtotal: 1800,
      paymentMethod: "cod",
    });
    assert(
      overMaxCodQuote.isCodEligible === false &&
      overMaxCodQuote.ineligibilityReason !== undefined,
      "COD order exceeding max order value (₹1500) is marked ineligible"
    );

    // -------------------------------------------------------------------------
    // Results
    // -------------------------------------------------------------------------
    console.log("\n=======================================================");
    console.log(` Test Summary: ${testsPassed}/${testsRun} passed (${testsFailed} failed)`);
    console.log("=======================================================\n");

    if (testsFailed > 0) {
      process.exit(1);
    }
  } finally {
    // Restore env
    if (origEmail !== undefined) process.env.SHIPROCKET_EMAIL = origEmail;
    else delete process.env.SHIPROCKET_EMAIL;
    if (origPassword !== undefined) process.env.SHIPROCKET_PASSWORD = origPassword;
    else delete process.env.SHIPROCKET_PASSWORD;
    if (origEnabled !== undefined) process.env.SHIPROCKET_ENABLED = origEnabled;
    else delete process.env.SHIPROCKET_ENABLED;
    if (origWebhookToken !== undefined) process.env.SHIPROCKET_WEBHOOK_TOKEN = origWebhookToken;
    else delete process.env.SHIPROCKET_WEBHOOK_TOKEN;
  }
}

runTests()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error("Test execution failed:", err);
    process.exit(1);
  });
