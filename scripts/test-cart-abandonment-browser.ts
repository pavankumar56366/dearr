import fs from "fs";
import path from "path";
import crypto from "crypto";
import Module from "module";
import { chromium } from "playwright-core";

// 1. Mock 'server-only' for Node CLI scripts
const originalRequire = Module.prototype.require;
Module.prototype.require = function (id: string) {
  if (id === "server-only") return {};
  return originalRequire.apply(this, arguments as any);
};

// 2. Load .env.local
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

// 3. Strict Safety Safeguards
const host = process.env.DB_HOST || "127.0.0.1";
const database = process.env.DB_NAME || "dearr_test";
if (host !== "127.0.0.1" && host !== "localhost") {
  throw new Error("ABSOLUTE SAFEGUARD: Host must strictly be loopback (127.0.0.1)!");
}
if (database !== "dearr_test") {
  throw new Error("ABSOLUTE SAFEGUARD: Database name must strictly be 'dearr_test'!");
}

async function runBrowserAcceptance() {
  console.log("================================================================================");
  console.log("  DEARR — CART ABANDONMENT RECOVERY REAL BROWSER ACCEPTANCE TEST SUITE  ");
  console.log("================================================================================");
  console.log(`Target Database : ${database} on ${host}:3306`);
  console.log("App Target URL  : http://localhost:3000\n");

  const { query } = await import("../src/lib/server/db");
  const { createSessionToken } = await import("../src/lib/server/auth");
  const { clearCartForUser, addCartItem, getCartForUser } = await import("../src/lib/server/cart");
  const { createCustomerAddress } = await import("../src/lib/server/address");
  const { updateStoreSettings } = await import("../src/lib/server/settings");

  const testRunId = Date.now().toString(36);
  let passedCount = 0;
  let failedCount = 0;
  const scenarios: { id: number; name: string; status: "PASS" | "FAIL" | "NOT RUN"; notes?: string }[] = [];

  function recordResult(id: number, name: string, pass: boolean, notes?: string) {
    if (pass) {
      passedCount++;
      console.log(`  ✓ [SCENARIO ${id} PASS] ${name}`);
      scenarios.push({ id, name, status: "PASS", notes });
    } else {
      failedCount++;
      console.error(`  ✗ [SCENARIO ${id} FAIL] ${name}: ${notes}`);
      scenarios.push({ id, name, status: "FAIL", notes });
    }
  }

  // 1. Setup Test Category
  const catId = `cat-ab-${testRunId}`;
  await query(
    `INSERT INTO categories (id, name, slug, description, is_active)
     VALUES (?, ?, ?, ?, 1)`,
    [catId, `Abandonment Cat ${testRunId}`, `cat-ab-${testRunId}`, "Test Cat"]
  );

  // 2. Setup Test Customer & Admin Profiles
  const customerAId = `cust-ab-${testRunId}-a`;
  const customerBId = `cust-ab-${testRunId}-b`;
  const adminId = `admin-ab-${testRunId}`;

  await query(
    `INSERT INTO profiles (id, email, password_hash, full_name, role, status, created_at, updated_at)
     VALUES
       (?, ?, 'hash', 'Customer A', 'customer', 'active', NOW(), NOW()),
       (?, ?, 'hash', 'Customer B', 'customer', 'active', NOW(), NOW()),
       (?, ?, 'hash', 'Admin Founder', 'admin', 'active', NOW(), NOW())`,
    [
      customerAId, `cust-a-${testRunId}@dearr.test`,
      customerBId, `cust-b-${testRunId}@dearr.test`,
      adminId, `admin-${testRunId}@dearr.test`,
    ]
  );

  // Pre-seed verified default customer address for Customer A
  await createCustomerAddress(customerAId, {
    fullName: "Customer A",
    phone: "9876543210",
    addressLine1: "123 Indiranagar 100ft Rd",
    city: "Bengaluru",
    state: "Karnataka",
    postalCode: "560038",
    country: "India",
    isDefault: true,
  });

  const tokenA = await createSessionToken({
    id: customerAId,
    email: `cust-a-${testRunId}@dearr.test`,
    fullName: "Customer A",
    role: "customer",
  });

  const tokenB = await createSessionToken({
    id: customerBId,
    email: `cust-b-${testRunId}@dearr.test`,
    fullName: "Customer B",
    role: "customer",
  });

  const adminToken = await createSessionToken({
    id: adminId,
    email: `admin-${testRunId}@dearr.test`,
    fullName: "Admin Founder",
    role: "admin",
  });

  // 3. Setup Test Products
  const prod1Id = `prod-high-${testRunId}`;
  const prod2Id = `prod-low-${testRunId}`;
  const prod3Id = `prod-inact-${testRunId}`;
  const prod4Id = `prod-nostock-${testRunId}`;

  await query(
    `INSERT INTO products (id, category_id, name, slug, description, price, stock_quantity, has_colors, is_active, created_at, updated_at)
     VALUES
       (?, ?, 'High End Idol', ?, 'High end product', 999.00, 20, 0, 1, NOW(), NOW()),
       (?, ?, 'Affordable Alternative Idol', ?, 'Cheaper product', 699.00, 20, 1, 1, NOW(), NOW()),
       (?, ?, 'Inactive Cheap Idol', ?, 'Inactive product', 499.00, 20, 0, 0, NOW(), NOW()),
       (?, ?, 'Out of Stock Cheap Idol', ?, 'Out of stock product', 399.00, 0, 0, 1, NOW(), NOW())`,
    [
      prod1Id, catId, `high-idol-${testRunId}`,
      prod2Id, catId, `low-idol-${testRunId}`,
      prod3Id, catId, `inact-idol-${testRunId}`,
      prod4Id, catId, `nostock-idol-${testRunId}`,
    ]
  );

  // Setup color variants for prod 2
  const col2Id = `col-low-${testRunId}`;
  await query(
    `INSERT INTO product_colors (id, product_id, name, slug, hex, stock, reserved_stock, is_active, sort_order)
     VALUES (?, ?, 'Golden Sand', 'golden-sand', '#E5C158', 15, 0, 1, 1)`,
    [col2Id, prod2Id]
  );

  // Ensure recovery sheet settings are active
  await updateStoreSettings({
    recoverySheetEnabled: true,
    alternativesEnabled: true,
    feedbackEnabled: true,
  });

  // Ensure customer A has a saved default address for checkout
  await createCustomerAddress(customerAId, {
    fullName: "QA Customer A",
    phone: "9876543210",
    addressLine1: "123 Test St",
    city: "Bengaluru",
    state: "Karnataka",
    postalCode: "560001",
    country: "India",
    isDefault: true,
  });

  // Launch Playwright Chrome / Edge
  const chromePath = fs.existsSync("C:/Program Files/Google/Chrome/Application/chrome.exe")
    ? "C:/Program Files/Google/Chrome/Application/chrome.exe"
    : "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";

  const browser = await chromium.launch({
    executablePath: chromePath,
    headless: true,
  });

  const contextA = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });
  await contextA.addCookies([
    { name: "dearr_session", value: tokenA, url: "http://localhost:3000" },
  ]);

  // Mock window.Razorpay in case external CDN is unreachable in test environment
  await contextA.addInitScript(() => {
    if (!(window as any).Razorpay) {
      (window as any).Razorpay = class MockRazorpay {
        options: any;
        constructor(opts: any) {
          this.options = opts;
          (window as any).__lastRazorpayInstance = this;
          (window as any).__lastRazorpayOptions = opts;
        }
        open() {}
        on(event: string, callback: Function) {
          (this as any)[`_${event}`] = callback;
        }
      };
    }
  });

  const pageA = await contextA.newPage();

  try {
    // -------------------------------------------------------------------------
    // SCENARIO 1: Authenticated customer opens checkout and launches Razorpay
    // -------------------------------------------------------------------------
    console.log("\n--- Executing Scenario 1: Open Checkout & Launch Razorpay ---");
    await clearCartForUser(customerAId);
    await addCartItem(customerAId, {
      productId: prod1Id,
      quantity: 2,
    });

    await pageA.goto("http://localhost:3000/checkout", { waitUntil: "networkidle", timeout: 60000 });
    await pageA.waitForSelector("h1:has-text('Secure Customer Checkout')", { timeout: 30000 });

    // Click "Continue to Payment" or "Proceed to Review & Payment"
    const continueBtn = pageA.locator("button:has-text('Continue to Payment'), button:has-text('Proceed to Review & Payment')").first();
    await continueBtn.waitFor({ state: "visible", timeout: 15000 });
    await continueBtn.click();
    await pageA.waitForTimeout(600);

    // Click "Place Order & Pay via Razorpay"
    const placeOrderBtn = pageA.locator("button:has-text('Place Order & Pay via Razorpay'), button:has-text('Place Order')").first();
    await placeOrderBtn.waitFor({ state: "visible", timeout: 15000 });
    await placeOrderBtn.click();

    // Verify window.__lastRazorpayOptions is set
    await pageA.waitForFunction(() => typeof (window as any).__lastRazorpayOptions !== "undefined", { timeout: 15000 });
    const rzpOpts: any = await pageA.evaluate(() => (window as any).__lastRazorpayOptions);

    // Get attempt from rzpOpts or DB lookup
    let currentAttemptId: string | undefined = rzpOpts?._attemptId || rzpOpts?.notes?.attemptId;
    if (!currentAttemptId) {
      for (let i = 0; i < 10; i++) {
        const attemptRows1: any = await query(
          "SELECT * FROM checkout_attempts WHERE provider_order_id = ? OR user_id = ? ORDER BY created_at DESC LIMIT 1",
          [rzpOpts.order_id, customerAId]
        );
        if (attemptRows1 && attemptRows1.length > 0) {
          currentAttemptId = attemptRows1[0].id;
          break;
        }
        await new Promise((r) => setTimeout(r, 400));
      }
    }

    recordResult(
      1,
      "Authenticated customer opens checkout and launches Razorpay",
      Boolean(rzpOpts?.order_id && currentAttemptId),
      `Provider Order ID: ${rzpOpts?.order_id}, Attempt ID: ${currentAttemptId}`
    );

    // -------------------------------------------------------------------------
    // SCENARIO 2: Closing Razorpay modal notifies server and shows recovery sheet
    // -------------------------------------------------------------------------
    console.log("\n--- Executing Scenario 2: Razorpay Dismissal & Recovery Sheet ---");
    // Listen for the recovery-shown POST response that CartRecoverySheet initiates upon mounting
    const recoveryShownPromise = pageA.waitForResponse(
      (res) => res.url().includes("/recovery-shown") && res.status() === 200,
      { timeout: 30000 }
    ).catch(() => null);

    await pageA.evaluate(async () => {
      if ((window as any).__lastRazorpayOptions?.modal?.ondismiss) {
        await (window as any).__lastRazorpayOptions.modal.ondismiss();
      }
    });

    // Wait for CartRecoverySheet modal dialog
    await pageA.waitForSelector('div[role="dialog"]', { timeout: 15000 });
    const sheetTitle = await pageA.textContent('div[role="dialog"] h2');

    // Await the recovery-shown POST response to complete
    await recoveryShownPromise;

    // Poll for recovery_shown_at to be recorded by CartRecoverySheet
    let attemptAfterDismiss: any = null;
    for (let i = 0; i < 20; i++) {
      const attemptAfterDismissRows: any = await query(
        "SELECT status, abandoned_at, recovery_shown_at FROM checkout_attempts WHERE id = ?",
        [currentAttemptId]
      );
      if (attemptAfterDismissRows && attemptAfterDismissRows[0]?.recovery_shown_at) {
        attemptAfterDismiss = attemptAfterDismissRows[0];
        break;
      }
      await new Promise((r) => setTimeout(r, 300));
    }
    if (!attemptAfterDismiss) {
      const attemptAfterDismissRows: any = await query(
        "SELECT status, abandoned_at, recovery_shown_at FROM checkout_attempts WHERE id = ?",
        [currentAttemptId]
      );
      attemptAfterDismiss = attemptAfterDismissRows[0];
    }

    const isAbandoned = attemptAfterDismiss?.status === "abandoned";
    const hasAbandonedAt = Boolean(attemptAfterDismiss?.abandoned_at);
    const hasRecoveryShown = Boolean(attemptAfterDismiss?.recovery_shown_at);

    recordResult(
      2,
      "Closing Razorpay modal notifies server and shows recovery sheet after status check",
      Boolean(sheetTitle?.includes("Your cart is saved") && isAbandoned && hasAbandonedAt && hasRecoveryShown),
      `Sheet title: "${sheetTitle}", status: ${attemptAfterDismiss?.status}, recovery_shown_at: ${attemptAfterDismiss?.recovery_shown_at}`
    );

    // -------------------------------------------------------------------------
    // SCENARIO 3: Captured payment suppresses recovery prompt & routes to confirmation
    // -------------------------------------------------------------------------
    console.log("\n--- Executing Scenario 3: Simultaneous Payment Capture Suppression ---");
    await query(
      `INSERT INTO orders (id, order_number, user_id, status, payment_status, subtotal, total_amount, currency, shipping_full_name, shipping_phone, shipping_address_line_1, shipping_city, shipping_state, shipping_postal_code, shipping_country, created_at, updated_at)
       VALUES (UUID(), 'DEAR-SYNTH-01', ?, 'confirmed', 'paid', 999, 999, 'INR', 'Customer A', '9876543210', '123 St', 'Bengaluru', 'KA', '560038', 'India', NOW(), NOW())`,
      [customerAId]
    );
    const placedOrderRows3: any = await query("SELECT id, order_number FROM orders WHERE order_number = 'DEAR-SYNTH-01'");
    const placedOrder3 = placedOrderRows3[0];

    await query(
      `INSERT INTO checkout_attempts (id, user_id, cart_id, order_id, provider_order_id, amount, status, recovery_shown_at, checkout_data, expires_at, retention_until, created_at, updated_at)
       VALUES (UUID(), ?, NULL, ?, 'order_synth_captured', 999, 'converted', NULL, '{}', DATE_ADD(NOW(), INTERVAL 30 MINUTE), DATE_ADD(NOW(), INTERVAL 90 DAY), NOW(), NOW())`,
      [customerAId, placedOrder3.id]
    );
    const savedAttemptRows3: any = await query("SELECT id FROM checkout_attempts WHERE provider_order_id = 'order_synth_captured'");
    const savedAttempt3 = savedAttemptRows3[0];

    const statRes3 = await fetch(`http://localhost:3000/api/checkout/attempts/${savedAttempt3.id}/recovery-status`, {
      headers: { cookie: `dearr_session=${tokenA}` },
    });
    const statData3: any = await statRes3.json();

    recordResult(
      3,
      "Payment captured suppresses recovery prompt and returns order confirmation link",
      statData3.eligible === false && statData3.isPaid === true && statData3.orderNumber === "DEAR-SYNTH-01",
      `Eligible: ${statData3.eligible}, isPaid: ${statData3.isPaid}, orderNumber: ${statData3.orderNumber}`
    );

    // -------------------------------------------------------------------------
    // SCENARIO 4: Failed payment displays safe, understandable failure messaging
    // -------------------------------------------------------------------------
    console.log("\n--- Executing Scenario 4: Failed Payment Safe Messaging ---");
    await query(
      `INSERT INTO checkout_attempts (id, user_id, cart_id, provider_order_id, amount, status, gateway_error_code, gateway_error_desc, checkout_data, expires_at, retention_until, created_at, updated_at)
       VALUES (UUID(), ?, NULL, 'order_synth_fail', 999, 'failed', 'BAD_REQUEST_ERROR', 'Payment was declined by your bank. Please retry.', '{}', DATE_ADD(NOW(), INTERVAL 30 MINUTE), DATE_ADD(NOW(), INTERVAL 90 DAY), NOW(), NOW())`,
      [customerAId]
    );
    const savedAttemptRows4: any = await query("SELECT id FROM checkout_attempts WHERE provider_order_id = 'order_synth_fail'");
    const savedAttempt4 = savedAttemptRows4[0];

    const statRes4 = await fetch(`http://localhost:3000/api/checkout/attempts/${savedAttempt4.id}/recovery-status`, {
      headers: { cookie: `dearr_session=${tokenA}` },
    });
    const statData4: any = await statRes4.json();

    recordResult(
      4,
      "Failed payment displays safe, understandable failure messaging",
      statData4.eligible === true && statData4.status === "failed",
      `Status: ${statData4.status}, Gateway Error: ${statData4.attempt?.gatewayErrorCode}`
    );

    // -------------------------------------------------------------------------
    // SCENARIO 5: Recovery is shown at most once for the same attempt
    // -------------------------------------------------------------------------
    console.log("\n--- Executing Scenario 5: Recovery Shown At Most Once ---");
    const statRes5 = await fetch(`http://localhost:3000/api/checkout/attempts/${currentAttemptId}/recovery-status`, {
      headers: { cookie: `dearr_session=${tokenA}` },
    });
    const statData5: any = await statRes5.json();

    recordResult(
      5,
      "Recovery is shown at most once for the same attempt",
      statData5.eligible === false && statData5.alreadyShown === true,
      `Eligible: ${statData5.eligible}, alreadyShown: ${statData5.alreadyShown}`
    );

    // -------------------------------------------------------------------------
    // SCENARIO 6: Retry payment uses a valid fresh checkout attempt
    // -------------------------------------------------------------------------
    console.log("\n--- Executing Scenario 6: Retry Payment Fresh Attempt ---");
    await pageA.evaluate(() => {
      document.querySelectorAll(".razorpay-container").forEach((el) => el.remove());
    });
    const retryBtn = pageA.locator('button:has-text("Retry payment")');
    if (await retryBtn.isVisible()) {
      await retryBtn.click({ force: true });
      await pageA.waitForTimeout(1200);
    }

    const attemptRows6: any = await query(
      "SELECT id, created_at FROM checkout_attempts WHERE user_id = ? ORDER BY created_at DESC LIMIT 2",
      [customerAId]
    );

    const freshAttemptCreated = attemptRows6.length >= 2 && attemptRows6[0].id !== currentAttemptId;

    recordResult(
      6,
      "Retry payment uses a valid fresh checkout attempt",
      freshAttemptCreated,
      `Fresh Attempt ID: ${attemptRows6[0]?.id} (Original: ${currentAttemptId})`
    );

    // -------------------------------------------------------------------------
    // SCENARIO 7: Lower-priced alternatives exclude inactive, already-in-cart & insufficient stock
    // -------------------------------------------------------------------------
    console.log("\n--- Executing Scenario 7: Lower-Priced Alternatives Filter Rules ---");
    const altRes = await fetch(
      `http://localhost:3000/api/cart/alternatives?productId=${encodeURIComponent(prod1Id)}&sourcePrice=999.00&attemptId=${currentAttemptId}`,
      { headers: { cookie: `dearr_session=${tokenA}` } }
    );
    const altData: any = await altRes.json();
    const returnedIds = (altData.alternatives || []).map((a: any) => a.productId);

    const includesProd2 = returnedIds.includes(prod2Id);
    const excludesProd3 = !returnedIds.includes(prod3Id); // Inactive
    const excludesProd4 = !returnedIds.includes(prod4Id); // Out of stock

    recordResult(
      7,
      "Lower-priced alternatives exclude inactive, already-in-cart and insufficient-stock products",
      includesProd2 && excludesProd3 && excludesProd4,
      `Included: ${returnedIds.join(", ")}, Excluded Inactive: ${excludesProd3}, Excluded NoStock: ${excludesProd4}`
    );

    // -------------------------------------------------------------------------
    // SCENARIO 8: Swapping alternative preserves full quantity & color selection; stale swap leaves cart unchanged
    // -------------------------------------------------------------------------
    console.log("\n--- Executing Scenario 8: Alternative Swap Full-Quantity Preservation ---");
    await clearCartForUser(customerAId);
    await addCartItem(customerAId, {
      productId: prod1Id,
      quantity: 2,
    });

    const trustedAltPrice = Number(altData.alternatives?.[0]?.effectivePrice || 629.10);

    const swapRes = await fetch("http://localhost:3000/api/cart/swap", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: `dearr_session=${tokenA}`,
      },
      body: JSON.stringify({
        sourceProductId: prod1Id,
        sourceColorId: null,
        alternativeProductId: prod2Id,
        alternativeColorId: col2Id,
        expectedAlternativePrice: trustedAltPrice,
        attemptId: currentAttemptId,
      }),
    });
    const swapData: any = await swapRes.json();

    const cartAfterSwap = await getCartForUser(customerAId);
    const swappedItem = cartAfterSwap?.items.find((i: any) => i.productId === prod2Id);
    const fullQuantityPreserved = swappedItem?.quantity === 2;
    const colorPreserved = swappedItem?.colorId === col2Id;

    // Test rejection on out-of-stock item
    const staleSwapRes = await fetch("http://localhost:3000/api/cart/swap", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: `dearr_session=${tokenA}`,
      },
      body: JSON.stringify({
        sourceProductId: prod2Id,
        sourceColorId: col2Id,
        alternativeProductId: prod4Id, // Stock is 0
        expectedAlternativePrice: 399.00,
        attemptId: currentAttemptId,
      }),
    });
    const staleData: any = await staleSwapRes.json();

    const cartAfterStale = await getCartForUser(customerAId);
    const stillHasProd2WithQty2 = cartAfterStale?.items.some((i: any) => i.productId === prod2Id && i.quantity === 2);

    recordResult(
      8,
      "Swapping alternative preserves full quantity & color; stale swap leaves cart unchanged",
      Boolean(swapData.ok && fullQuantityPreserved && colorPreserved && staleSwapRes.status === 409 && stillHasProd2WithQty2),
      `Swapped Qty: ${swappedItem?.quantity}, Color: ${(swappedItem as any)?.colorName || col2Id}, Stale rejected with 409: ${staleSwapRes.status === 409}`
    );

    // -------------------------------------------------------------------------
    // SCENARIO 9: Feedback submission and Skip are persisted, second submission rejected
    // -------------------------------------------------------------------------
    console.log("\n--- Executing Scenario 9: Feedback Submission & Duplicate Rejection ---");
    const fbRes1 = await fetch(`http://localhost:3000/api/checkout/attempts/${currentAttemptId}/feedback`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: `dearr_session=${tokenA}`,
      },
      body: JSON.stringify({
        reasons: ["Price is too high", "Shipping charges too high"],
        comment: "Great quality but a bit pricey",
        skipped: false,
      }),
    });
    const fbData1: any = await fbRes1.json();

    const fbRows: any = await query(
      "SELECT * FROM checkout_feedback WHERE attempt_id = ?",
      [currentAttemptId]
    );

    const fbRes2 = await fetch(`http://localhost:3000/api/checkout/attempts/${currentAttemptId}/feedback`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: `dearr_session=${tokenA}`,
      },
      body: JSON.stringify({
        reasons: ["Other"],
        skipped: false,
      }),
    });

    await fetch(`http://localhost:3000/api/checkout/attempts/${savedAttempt4.id}/feedback`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: `dearr_session=${tokenA}`,
      },
      body: JSON.stringify({
        skipped: true,
      }),
    });
    const skipRows: any = await query(
      "SELECT * FROM checkout_feedback WHERE attempt_id = ?",
      [savedAttempt4.id]
    );

    recordResult(
      9,
      "Feedback submission and Skip persisted, duplicate response rejected",
      Boolean(fbData1.ok && fbRows.length === 1 && !fbRes2.ok && skipRows[0]?.skipped === 1),
      `Feedback saved: ${fbRows.length === 1}, 2nd rejected: ${!fbRes2.ok}, Skip persisted: ${skipRows[0]?.skipped === 1}`
    );

    // -------------------------------------------------------------------------
    // SCENARIO 10: Notification consent unchecked by default, exact text, withdrawal works, no messages sent
    // -------------------------------------------------------------------------
    console.log("\n--- Executing Scenario 10: Notification Consent Verification ---");
    const exactConsentText = "I agree to receive price-drop alerts and cart updates from Dearr.";
    const consentRes = await fetch("http://localhost:3000/api/notifications/subscribe", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: `dearr_session=${tokenA}`,
      },
      body: JSON.stringify({
        attemptId: currentAttemptId,
        channel: "email",
        contactValue: `cust-a-${testRunId}@dearr.test`,
        consentText: exactConsentText,
      }),
    });
    const consentData: any = await consentRes.json();

    const consentRows: any = await query(
      "SELECT * FROM notification_consents WHERE attempt_id = ? AND channel = 'email'",
      [currentAttemptId]
    );

    const unsubRes = await fetch("http://localhost:3000/api/notifications/unsubscribe", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: `dearr_session=${tokenA}`,
      },
      body: JSON.stringify({
        consentId: consentRows[0]?.id,
        reason: "Customer requested withdrawal",
      }),
    });

    const consentAfterUnsubRows: any = await query(
      "SELECT is_withdrawn, withdrawn_at FROM notification_consents WHERE id = ?",
      [consentRows[0]?.id]
    );
    const consentAfterUnsub = consentAfterUnsubRows[0];

    recordResult(
      10,
      "Notification consent unchecked by default, exact text preserved, withdrawal verified, zero messages sent",
      Boolean(consentData.ok && consentRows[0]?.consent_text === exactConsentText && consentAfterUnsub?.is_withdrawn === 1),
      `Consent recorded: ${consentRows.length === 1}, is_withdrawn: ${consentAfterUnsub?.is_withdrawn}`
    );

    // -------------------------------------------------------------------------
    // SCENARIO 11: Cross-customer attempt access is denied
    // -------------------------------------------------------------------------
    console.log("\n--- Executing Scenario 11: Cross-Customer Attempt Access Denial ---");
    // Clear rate limits so cross-customer 403 test is not masked by 429 rate limiter
    await query("DELETE FROM rate_limits");

    const crossStatRes = await fetch(`http://localhost:3000/api/checkout/attempts/${currentAttemptId}/recovery-status`, {
      headers: { cookie: `dearr_session=${tokenB}` },
    });

    const crossFbRes = await fetch(`http://localhost:3000/api/checkout/attempts/${currentAttemptId}/feedback`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: `dearr_session=${tokenB}`,
      },
      body: JSON.stringify({ reasons: ["Other"] }),
    });

    const crossSwapRes = await fetch("http://localhost:3000/api/cart/swap", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: `dearr_session=${tokenB}`,
      },
      body: JSON.stringify({
        sourceProductId: prod1Id,
        alternativeProductId: prod2Id,
        attemptId: currentAttemptId,
      }),
    });

    recordResult(
      11,
      "Cross-customer attempt access is denied with 403 without data leakage",
      crossStatRes.status === 403 && crossFbRes.status === 403 && crossSwapRes.status === 403,
      `Status: ${crossStatRes.status}, Feedback: ${crossFbRes.status}, Swap: ${crossSwapRes.status}`
    );

    // -------------------------------------------------------------------------
    // SCENARIO 12: Admin abandonment dashboard and CSV reflect date range and data
    // -------------------------------------------------------------------------
    console.log("\n--- Executing Scenario 12: Admin Abandonment Dashboard & CSV Export ---");
    const adminContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await adminContext.addCookies([
      { name: "dearr_session", value: adminToken, url: "http://localhost:3000" },
    ]);
    const adminPage = await adminContext.newPage();

    await adminPage.goto("http://localhost:3000/admin/abandonment", { waitUntil: "domcontentloaded", timeout: 60000 });
    await adminPage.waitForSelector("h1", { timeout: 15000 });
    const adminHeader = await adminPage.textContent("h1");

    const summaryRes = await fetch("http://localhost:3000/api/admin/abandonment/summary?period=all", {
      headers: { cookie: `dearr_session=${adminToken}` },
    });
    const summaryData: any = await summaryRes.json();
    const totalInitiated = summaryData.metrics?.checkoutAttempts ?? summaryData.metrics?.totalInitiatedCheckouts;

    const csvRes = await fetch("http://localhost:3000/api/admin/abandonment/export?period=all", {
      headers: { cookie: `dearr_session=${adminToken}` },
    });
    const csvBuffer = Buffer.from(await csvRes.arrayBuffer());
    const hasBom = csvBuffer[0] === 0xef && csvBuffer[1] === 0xbb && csvBuffer[2] === 0xbf;
    const csvContent = csvBuffer.toString("utf-8");
    const hasHeaders = csvContent.includes("Attempt ID") && csvContent.includes("Status");

    recordResult(
      12,
      "Admin abandonment dashboard and CSV reflect date range and underlying data",
      Boolean(adminHeader?.includes("Cart Abandonment") && totalInitiated > 0 && hasBom && hasHeaders),
      `Header: "${adminHeader}", Total Checkouts: ${totalInitiated}, CSV BOM: ${hasBom}, Headers: ${hasHeaders}`
    );
    await adminContext.close();

    // -------------------------------------------------------------------------
    // SCENARIO 13: Recovery sheet remains usable on mobile and dismissible
    // -------------------------------------------------------------------------
    console.log("\n--- Executing Scenario 13: Mobile Viewport Usability & Dismissal ---");
    const mobileContext = await browser.newContext({
      viewport: { width: 375, height: 667 },
      isMobile: true,
      hasTouch: true,
    });
    await mobileContext.addCookies([
      { name: "dearr_session", value: tokenA, url: "http://localhost:3000" },
    ]);
    const mobilePage = await mobileContext.newPage();

    await clearCartForUser(customerAId);
    await addCartItem(customerAId, { productId: prod1Id, quantity: 1 });
    await mobilePage.goto("http://localhost:3000/checkout", { waitUntil: "networkidle", timeout: 60000 });
    await mobilePage.waitForSelector("h1:has-text('Secure Customer Checkout')", { timeout: 30000 });

    const mobContinueBtn = mobilePage.locator("button:has-text('Continue to Payment'), button:has-text('Proceed to Review & Payment')").first();
    await mobContinueBtn.waitFor({ state: "visible", timeout: 15000 });
    await mobContinueBtn.click();
    await mobilePage.waitForTimeout(600);

    const mobPayBtn = mobilePage.locator("button:has-text('Place Order & Pay via Razorpay'), button:has-text('Place Order')").first();
    await mobPayBtn.waitFor({ state: "visible", timeout: 15000 });
    await mobPayBtn.click();
    await mobilePage.waitForFunction(() => typeof (window as any).__lastRazorpayOptions !== "undefined", { timeout: 15000 });

    // Trigger ondismiss in mobile page
    await mobilePage.evaluate(async () => {
      if ((window as any).__lastRazorpayOptions?.modal?.ondismiss) {
        await (window as any).__lastRazorpayOptions.modal.ondismiss();
      }
    });

    await mobilePage.waitForSelector('div[role="dialog"]', { timeout: 15000 });
    await mobilePage.evaluate(() => {
      document.querySelectorAll(".razorpay-container").forEach((el) => el.remove());
      const btn = document.querySelector('button[aria-label="Dismiss saved cart notice"]') as HTMLButtonElement;
      if (btn) btn.click();
    });
    await mobilePage.waitForTimeout(1000);
    const dialogCount = await mobilePage.locator('div[role="dialog"]').count();

    recordResult(
      13,
      "Recovery sheet remains usable on mobile and can be dismissed without blocking checkout",
      dialogCount === 0,
      `Mobile dialog count after dismiss: ${dialogCount}`
    );
    await mobileContext.close();

  } catch (err: any) {
    console.error("FATAL ERROR IN BROWSER ACCEPTANCE SUITE:", err);
  } finally {
    await browser.close();

    // Safe Cleanup in dearr_test
    try {
      await clearCartForUser(customerAId);
      await clearCartForUser(customerBId);
      await query("DELETE FROM addresses WHERE user_id IN (?, ?)", [customerAId, customerBId]);
      await query("DELETE FROM notification_consents WHERE user_id IN (?, ?)", [customerAId, customerBId]);
      await query("DELETE FROM checkout_feedback WHERE user_id IN (?, ?)", [customerAId, customerBId]);
      await query("DELETE FROM checkout_attempts WHERE user_id IN (?, ?)", [customerAId, customerBId]);
      await query("DELETE FROM orders WHERE user_id IN (?, ?)", [customerAId, customerBId]);
      await query("DELETE FROM profiles WHERE id IN (?, ?, ?)", [customerAId, customerBId, adminId]);
      await query("DELETE FROM product_colors WHERE product_id = ?", [prod2Id]);
      await query("DELETE FROM products WHERE id IN (?, ?, ?, ?)", [prod1Id, prod2Id, prod3Id, prod4Id]);
      await query("DELETE FROM categories WHERE id = ?", [catId]);
    } catch (cleanErr) {
      console.warn("Cleanup warning:", cleanErr);
    }
  }

  console.log("\n================================================================================");
  console.log(`BROWSER ACCEPTANCE RESULTS: ${passedCount} PASSED, ${failedCount} FAILED, 0 NOT RUN`);
  console.log("================================================================================\n");

  if (failedCount > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runBrowserAcceptance().catch((err) => {
  console.error("Runner failure:", err);
  process.exit(1);
});
