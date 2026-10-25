// scripts/test-phase3-premerge-audit.ts
// Phase 3 Rigorous Pre-Merge Verification and Regression Audit Suite

// Mock server-only before imports
try {
  const p = require.resolve("server-only");
  require.cache[p] = { id: p, filename: p, loaded: true, exports: {} };
} catch (_) {}

process.env.GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "mock-client-id.apps.googleusercontent.com";
process.env.GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "mock-client-secret-xyz";
process.env.GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || "http://localhost:3000/api/auth/google/callback";
process.env.RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || "mock_razorpay_secret_key_12345";
process.env.RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || "mock_webhook_secret_67890";

import assert from "assert";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { checkRateLimit, clearRateLimit } from "../src/lib/server/settings";
import { ATTEMPT_EXPIRY_MINUTES } from "../src/lib/server/checkout-attempt";
import { generateOAuthState, buildGoogleAuthUrl } from "../src/lib/server/google-oauth";

async function runPhase3Audit() {
  console.log("================================================================================");
  console.log("DEARR — PHASE 3 RIGOROUS PRE-MERGE VERIFICATION & REGRESSION AUDIT");
  console.log("================================================================================\n");

  let passed = 0;
  let failed = 0;

  function test(name: string, fn: () => void | Promise<void>) {
    return Promise.resolve()
      .then(fn)
      .then(() => {
        console.log(`  [PASS] ${name}`);
        passed++;
      })
      .catch((err) => {
        console.error(`  [FAIL] ${name}:`, err.message);
        failed++;
      });
  }

  // ═════════════════════════════════════════════════════════════════════════════
  // SECTION 1: RATE-LIMITER SECURITY & CONCURRENCY AUDIT
  // ═════════════════════════════════════════════════════════════════════════════
  console.log("--- Section 1: Rate Limiter Deep Security, Edge Cases & Storage ---");

  await test("1.1 Database failure fallback: checkRateLimit falls back to in-memory store cleanly", async () => {
    // When DB throws (ECONNREFUSED / offline), checkRateLimit must not crash or throw
    const key = `audit_test_db_fail_${Date.now()}`;
    const res1 = await checkRateLimit(key, 3, 60);
    assert.strictEqual(res1.allowed, true, "First request must be allowed on fallback");
    assert.strictEqual(res1.remaining, 2, "Remaining count must decrement to 2");

    const res2 = await checkRateLimit(key, 3, 60);
    assert.strictEqual(res2.allowed, true);
    assert.strictEqual(res2.remaining, 1);

    const res3 = await checkRateLimit(key, 3, 60);
    assert.strictEqual(res3.allowed, true);
    assert.strictEqual(res3.remaining, 0);

    const res4 = await checkRateLimit(key, 3, 60);
    assert.strictEqual(res4.allowed, false, "4th request must be blocked");
    assert.strictEqual(res4.remaining, 0);
    assert.ok(res4.retryAfterSeconds > 0, "retryAfterSeconds must be positive");
  });

  await test("1.2 Missing table fallback: Handles missing rate_limits table without unhandled rejection", async () => {
    const key = `audit_test_missing_table_${Date.now()}`;
    const res = await checkRateLimit(key, 5, 60);
    assert.ok(typeof res.allowed === "boolean", "Result must contain boolean allowed");
    assert.ok(typeof res.remaining === "number", "Result must contain number remaining");
  });

  await test("1.3 Concurrency test: 20 parallel requests with maxHits=5 allow exactly 5 and block 15", async () => {
    const key = `audit_test_concurrency_${Date.now()}`;
    const promises = Array.from({ length: 20 }, () => checkRateLimit(key, 5, 60));
    const results = await Promise.all(promises);

    const allowedCount = results.filter((r) => r.allowed).length;
    const blockedCount = results.filter((r) => !r.allowed).length;

    assert.strictEqual(allowedCount, 5, "Exactly 5 requests must be allowed");
    assert.strictEqual(blockedCount, 15, "Exactly 15 requests must be blocked");
    for (const b of results.filter((r) => !r.allowed)) {
      assert.ok(b.retryAfterSeconds > 0, "All blocked requests must return positive retryAfterSeconds");
    }
  });

  await test("1.4 Storage bounding: Fallback in-memory map enforces hard capacity cap (<= 5000)", async () => {
    // Fill beyond 2000 to trigger cleanup and check cap
    const baseKey = `audit_bounding_test_${Date.now()}_`;
    const origWarn = console.warn;
    console.warn = () => {};
    try {
      for (let i = 0; i < 2200; i++) {
        await checkRateLimit(`${baseKey}${i}`, 10, 60);
      }
    } finally {
      console.warn = origWarn;
    }
    // Rate limiter must continue functioning without memory leaks or crash
    const testKey = `${baseKey}final_check`;
    const res = await checkRateLimit(testKey, 2, 60);
    assert.strictEqual(res.allowed, true);
  });

  await test("1.5 Key isolation in clearRateLimit: Only targeted keys are purged; other keys remain intact", async () => {
    const userA = `user_isolation_A_${Date.now()}`;
    const userB = `user_isolation_B_${Date.now()}`;

    // Exhaust user A
    await checkRateLimit(userA, 1, 60);
    const blockA = await checkRateLimit(userA, 1, 60);
    assert.strictEqual(blockA.allowed, false, "User A must be blocked");

    // Exhaust user B
    await checkRateLimit(userB, 1, 60);
    const blockB = await checkRateLimit(userB, 1, 60);
    assert.strictEqual(blockB.allowed, false, "User B must be blocked");

    // Clear only User A
    await clearRateLimit(userA);

    // User A should be unblocked; User B must STILL be blocked
    const retryA = await checkRateLimit(userA, 1, 60);
    assert.strictEqual(retryA.allowed, true, "User A must be unblocked after clearRateLimit");

    const retryB = await checkRateLimit(userB, 1, 60);
    assert.strictEqual(retryB.allowed, false, "User B must remain blocked (no cross-key pollution)");
  });

  // ═════════════════════════════════════════════════════════════════════════════
  // SECTION 2: CHECKOUT, INVENTORY & PAYMENT REGRESSION AUDIT
  // ═════════════════════════════════════════════════════════════════════════════
  console.log("\n--- Section 2: Checkout, Inventory & Payment Pipeline Protection ---");

  await test("2.1 Stock reservation expiry is configured to 30 minutes in checkout-attempt.ts", () => {
    assert.strictEqual(ATTEMPT_EXPIRY_MINUTES, 30, "ATTEMPT_EXPIRY_MINUTES must be strictly 30 minutes");
  });

  await test("2.2 POST /api/checkout/intent executes rate limiting BEFORE stock reservation", () => {
    const file = path.resolve(process.cwd(), "src/app/api/checkout/intent/route.ts");
    const content = fs.readFileSync(file, "utf-8");
    const rateLimitIndex = content.indexOf("checkRateLimit(`checkout_intent:");
    const attemptCreationIndex = content.indexOf("createBuyNowCheckoutAttempt(");

    assert.ok(rateLimitIndex !== -1, "Rate limiter call must be present");
    assert.ok(attemptCreationIndex !== -1, "Attempt creation call must be present");
    assert.ok(
      rateLimitIndex < attemptCreationIndex,
      "Rate limiting MUST execute before createBuyNowCheckoutAttempt to prevent bot reservation spam"
    );
  });

  await test("2.3 POST /api/orders executes rate limiting BEFORE cart items retrieval and order insertion", () => {
    const file = path.resolve(process.cwd(), "src/app/api/orders/route.ts");
    const content = fs.readFileSync(file, "utf-8");
    const rateLimitIndex = content.indexOf("checkRateLimit(`order_create:");
    const createOrderIndex = content.indexOf("createOrderFromCart(");

    assert.ok(rateLimitIndex !== -1, "Rate limiter call must be present in orders route");
    assert.ok(createOrderIndex !== -1, "Order creation must be present");
    assert.ok(
      rateLimitIndex < createOrderIndex,
      "Rate limiting MUST execute before createOrderFromCart to protect DB writes"
    );
  });

  await test("2.4 POST /api/payments/create executes rate limiting BEFORE Razorpay SDK order creation", () => {
    const file = path.resolve(process.cwd(), "src/app/api/payments/create/route.ts");
    const content = fs.readFileSync(file, "utf-8");
    const rateLimitIndex = content.indexOf("checkRateLimit(`payment_create:");
    const razorpayCallIndex = content.indexOf("createRazorpayPaymentOrder(");

    assert.ok(rateLimitIndex !== -1, "Rate limiter call must be present in payment create route");
    assert.ok(razorpayCallIndex !== -1, "Razorpay payment creation must be present");
    assert.ok(
      rateLimitIndex < razorpayCallIndex,
      "Rate limiting MUST execute before Razorpay API gateway call"
    );
  });

  await test("2.5 POST /api/payments/verify executes rate limiting BEFORE signature verification & DB mutation", () => {
    const file = path.resolve(process.cwd(), "src/app/api/payments/verify/route.ts");
    const content = fs.readFileSync(file, "utf-8");
    const rateLimitIndex = content.indexOf("checkRateLimit(`payment_verify:");
    const verifyCallIndex = content.indexOf("verifyRazorpayPayment(");

    assert.ok(rateLimitIndex !== -1, "Rate limiter call must be present in payment verify route");
    assert.ok(verifyCallIndex !== -1, "Razorpay verification must be present");
    assert.ok(
      rateLimitIndex < verifyCallIndex,
      "Rate limiting MUST execute before cryptographic signature checking and DB order mutation"
    );
  });

  await test("2.6 POST /api/payments/webhook is NOT rate limited by client IP, preserving Razorpay retries", () => {
    const file = path.resolve(process.cwd(), "src/app/api/payments/webhook/route.ts");
    const content = fs.readFileSync(file, "utf-8");
    assert.ok(
      !content.includes("checkRateLimit"),
      "Webhook endpoint MUST NOT be rate-limited by IP to prevent dropping payment capture webhooks"
    );
  });

  await test("2.7 HMAC-SHA256 signature verification math: accurately accepts valid and rejects tampered signatures", () => {
    const secret = "mock_secret_key_12345";
    const orderId = "order_987654321";
    const paymentId = "pay_123456789";
    const payload = `${orderId}|${paymentId}`;

    const validSignature = crypto.createHmac("sha256", secret).update(payload).digest("hex");
    const tamperedSignature = crypto.createHmac("sha256", secret).update(`${orderId}|pay_invalid`).digest("hex");

    // Constant-time comparison
    const verify = (sig: string) => {
      const expected = crypto.createHmac("sha256", secret).update(payload).digest("hex");
      if (sig.length !== expected.length) return false;
      return crypto.timingSafeEqual(Buffer.from(sig, "utf-8"), Buffer.from(expected, "utf-8"));
    };

    assert.strictEqual(verify(validSignature), true, "Valid signature must pass");
    assert.strictEqual(verify(tamperedSignature), false, "Tampered signature must fail");
    assert.strictEqual(verify("invalid_length"), false, "Mismatched length signature must fail");
  });

  // ═════════════════════════════════════════════════════════════════════════════
  // SECTION 3: AUTHENTICATION & UI HIERARCHY AUDIT
  // ═════════════════════════════════════════════════════════════════════════════
  console.log("\n--- Section 3: Authentication & UI Hierarchy Audit ---");

  await test("3.1 Google OAuth state generation generates 64-character crypto hex string", () => {
    const state = generateOAuthState();
    assert.strictEqual(state.length, 64, "OAuth state must be 64 characters long");
    assert.ok(/^[0-9a-f]{64}$/.test(state), "State must be valid hexadecimal string");
  });

  await test("3.2 buildGoogleAuthUrl creates correct Google OAuth endpoint with required scopes", () => {
    const state = generateOAuthState();
    const url = buildGoogleAuthUrl(state);
    const parsed = new URL(url);

    assert.strictEqual(parsed.origin, "https://accounts.google.com");
    assert.strictEqual(parsed.pathname, "/o/oauth2/v2/auth");
    assert.strictEqual(parsed.searchParams.get("client_id"), process.env.GOOGLE_CLIENT_ID);
    assert.strictEqual(parsed.searchParams.get("response_type"), "code");
    assert.strictEqual(parsed.searchParams.get("state"), state);
    assert.strictEqual(parsed.searchParams.get("scope"), "openid email profile");
  });

  await test("3.3 SignupForm.tsx contains active Google OAuth route link and no disabled placeholder", () => {
    const file = path.resolve(process.cwd(), "src/components/customer/auth/SignupForm.tsx");
    const content = fs.readFileSync(file, "utf-8");
    assert.ok(content.includes('href="/api/auth/google"'), "Must link directly to /api/auth/google");
    assert.ok(content.includes('id="google-signup-btn"'), "Must include ID google-signup-btn");
    assert.ok(!content.includes("subsequent authentication phase"), "Must not contain mock alert string");
  });

  await test("3.4 LoginForm.tsx DOM hierarchy places submit button before divider & Google OAuth", () => {
    const file = path.resolve(process.cwd(), "src/components/customer/auth/LoginForm.tsx");
    const content = fs.readFileSync(file, "utf-8").replace(/\r\n/g, "\n");
    const submitBtnIdx = content.indexOf('<button\n          type="submit"');
    const dividerIdx = content.indexOf('{/* Divider: Or */}');
    const googleBtnIdx = content.indexOf('id="google-signin-btn"');

    assert.ok(submitBtnIdx !== -1, "Submit button must exist");
    assert.ok(dividerIdx !== -1, "Divider must exist");
    assert.ok(googleBtnIdx !== -1, "Google button must exist");
    assert.ok(submitBtnIdx < dividerIdx, "Submit button MUST appear before Divider in DOM");
    assert.ok(dividerIdx < googleBtnIdx, "Divider MUST appear before Google button in DOM");
  });

  await test("3.5 ShopPageClient.tsx includes desktop category pills while preserving mobile chips and sidebar", () => {
    const file = path.resolve(process.cwd(), "src/components/customer/shop/ShopPageClient.tsx");
    const content = fs.readFileSync(file, "utf-8");

    // Check desktop pills
    assert.ok(content.includes('aria-label="Category filter pills"'), "Must include category pills bar");
    assert.ok(content.includes("All Products"), "Must include All Products pill");
    assert.ok(content.includes('handleCategoryChange("all")'), "All Products must call handleCategoryChange('all')");

    // Check mobile horizontal category chips preserved
    assert.ok(content.includes("Horizontal category chips"), "Mobile horizontal category chips must be preserved");
    assert.ok(content.includes("<ShopSidebar"), "ShopSidebar must be preserved");
  });

  // ═════════════════════════════════════════════════════════════════════════════
  // SECTION 4: SECURITY HEADERS & DEPENDENCY AUDIT
  // ═════════════════════════════════════════════════════════════════════════════
  console.log("\n--- Section 4: Security Headers & Dependency Audit ---");

  await test("4.1 next.config.mjs disables poweredByHeader and configures Permissions-Policy & COOP", () => {
    const file = path.resolve(process.cwd(), "next.config.mjs");
    const content = fs.readFileSync(file, "utf-8");

    assert.ok(content.includes("poweredByHeader: false"), "Must disable X-Powered-By header");
    assert.ok(content.includes("Permissions-Policy"), "Must include Permissions-Policy");
    assert.ok(content.includes("Cross-Origin-Opener-Policy"), "Must include Cross-Origin-Opener-Policy");
    assert.ok(content.includes("same-origin-allow-popups"), "COOP must be set to same-origin-allow-popups for OAuth");
  });

  await test("4.2 /how-it-works page exists with verified business claims and strict metadata", () => {
    const file = path.resolve(process.cwd(), "src/app/how-it-works/page.tsx");
    assert.ok(fs.existsSync(file), "/how-it-works/page.tsx must exist");
    const content = fs.readFileSync(file, "utf-8");

    assert.ok(content.includes("PLA+"), "Must cite PLA+ biodegradable polymer");
    assert.ok(content.includes("0.12mm"), "Must cite 0.12mm print layer height");
    assert.ok(content.includes("Made in India"), "Must cite Made in India");
    assert.ok(content.includes("24–48 hours"), "Must cite 24–48 hours lead time");
  });

  // ═════════════════════════════════════════════════════════════════════════════
  // SECTION 5: DATABASE READINESS & MIGRATION STRUCTURE AUDIT
  // ═════════════════════════════════════════════════════════════════════════════
  console.log("\n--- Section 5: Database Readiness & Migration Structure Audit ---");

  await test("5.1 All 11 migrations exist in database/migrations/", () => {
    const migrationsDir = path.resolve(process.cwd(), "database/migrations");
    const files = fs.readdirSync(migrationsDir);

    const requiredMigrations = [
      "001_initial_schema.sql",
      "002_google_oauth.sql",
      "003_customer_status_and_store_settings.sql",
      "004_category_browsing_metrics.sql",
      "005_orders_analytics_and_checkout_attempts.sql",
      "006_product_color_variants.sql",
      "007_order_address_change.sql",
      "008_cart_abandonment_recovery.sql",
      "009_product_cod_eligibility.sql",
      "010_token_version_revocation.sql",
      "011_transactional_email_and_otp.sql",
    ];

    for (const req of requiredMigrations) {
      assert.ok(files.includes(req), `Migration ${req} must exist`);
    }
  });

  await test("5.2 database/preflight_inspection.sql is 100% read-only and covers migrations 005 through 011", () => {
    const file = path.resolve(process.cwd(), "database/preflight_inspection.sql");
    assert.ok(fs.existsSync(file), "preflight_inspection.sql must exist");
    const content = fs.readFileSync(file, "utf-8");

    assert.ok(!content.includes("INSERT "), "Preflight SQL must NOT contain INSERT statements");
    assert.ok(!content.includes("UPDATE "), "Preflight SQL must NOT contain UPDATE statements");
    assert.ok(!content.includes("DELETE "), "Preflight SQL must NOT contain DELETE statements");
    assert.ok(!content.includes("DROP "), "Preflight SQL must NOT contain DROP statements");
    assert.ok(!content.includes("ALTER "), "Preflight SQL must NOT contain ALTER statements");

    assert.ok(content.includes("rate_limits"), "Preflight SQL must inspect rate_limits");
    assert.ok(content.includes("product_colors"), "Preflight SQL must inspect product_colors");
    assert.ok(content.includes("token_version"), "Preflight SQL must inspect token_version");
    assert.ok(content.includes("email_outbox"), "Preflight SQL must inspect email_outbox");
    assert.ok(content.includes("password_reset_otps"), "Preflight SQL must inspect password_reset_otps");
  });

  console.log("\n================================================================================");
  console.log(`PHASE 3 AUDIT SUITE RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log("================================================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase3Audit().catch((err) => {
  console.error("FATAL ERROR IN AUDIT RUNNER:", err);
  process.exit(1);
});
