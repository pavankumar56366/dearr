// 1. Mock 'server-only' before importing server modules in standalone test runner
try {
  const p = require.resolve("server-only");
  require.cache[p] = { id: p, filename: p, loaded: true, exports: {} };
} catch (_) {
  // Graceful fallback
}

process.env.GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "test-client-id.apps.googleusercontent.com";
process.env.GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "test-client-secret-mock";
process.env.GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || "http://localhost:3000/api/auth/google/callback";

import assert from "assert";
import fs from "fs";
import path from "path";
import {
  generateOAuthState,
  buildGoogleAuthUrl,
} from "../src/lib/server/google-oauth";
import { checkRateLimit, clearRateLimit } from "../src/lib/server/settings";
import { ATTEMPT_EXPIRY_MINUTES } from "../src/lib/server/checkout-attempt";

async function runTests() {
  console.log("================================================================================");
  console.log("RUNNING PHASE 2 HARDENING & SECURITY VALIDATION SUITE");
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

  // ───────────────────────────────────────────────────────────────────────────
  // TEST GROUP 1: Rate Limiting Abuse Limits & Legitimate Retries
  // ───────────────────────────────────────────────────────────────────────────
  console.log("--- Test Group 1: Rate Limiting & Legitimate Retries ---");

  await test("checkRateLimit allows requests up to maxHits and decrements remaining", async () => {
    const testKey = `test_rate_limit_${Date.now()}`;
    await clearRateLimit(testKey);

    const res1 = await checkRateLimit(testKey, 3, 10, true);
    assert.strictEqual(res1.allowed, true, "First request must be allowed");
    assert.strictEqual(res1.remaining, 2, "Remaining count should be 2");

    const res2 = await checkRateLimit(testKey, 3, 10, true);
    assert.strictEqual(res2.allowed, true, "Second request must be allowed");
    assert.strictEqual(res2.remaining, 1, "Remaining count should be 1");

    const res3 = await checkRateLimit(testKey, 3, 10, true);
    assert.strictEqual(res3.allowed, true, "Third request must be allowed");
    assert.strictEqual(res3.remaining, 0, "Remaining count should be 0");
  });

  await test("checkRateLimit blocks requests exceeding maxHits with retryAfterSeconds", async () => {
    const testKey = `test_rate_limit_block_${Date.now()}`;
    await clearRateLimit(testKey);

    // Hit 2 times with limit of 2
    await checkRateLimit(testKey, 2, 5, true);
    await checkRateLimit(testKey, 2, 5, true);

    // 3rd hit must be blocked
    const resBlocked = await checkRateLimit(testKey, 2, 5, true);
    assert.strictEqual(resBlocked.allowed, false, "Excess request must be blocked");
    assert.strictEqual(resBlocked.remaining, 0, "Remaining should be 0 when blocked");
    assert.ok(resBlocked.retryAfterSeconds > 0, "retryAfterSeconds must be positive");
  });

  await test("clearRateLimit allows legitimate retries after lockout reset", async () => {
    const testKey = `test_rate_limit_reset_${Date.now()}`;
    await clearRateLimit(testKey);

    await checkRateLimit(testKey, 1, 60, true);
    const blocked = await checkRateLimit(testKey, 1, 60, true);
    assert.strictEqual(blocked.allowed, false, "Should be blocked initially");

    // Clear rate limit (simulating window expiry or successful auth)
    await clearRateLimit(testKey);

    const allowedAgain = await checkRateLimit(testKey, 1, 60, true);
    assert.strictEqual(allowedAgain.allowed, true, "Should be allowed after limit reset");
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST GROUP 2: Stock Reservation Expiry & Inventory Protection
  // ───────────────────────────────────────────────────────────────────────────
  console.log("\n--- Test Group 2: Stock Reservation Expiry & Inventory Defense ---");

  await test("ATTEMPT_EXPIRY_MINUTES is configured to 30 minutes", () => {
    assert.strictEqual(ATTEMPT_EXPIRY_MINUTES, 30, "Checkout attempt expiry must be 30 minutes");
  });

  await test("POST /api/checkout/intent is protected with checkRateLimit in source", () => {
    const file = path.resolve(process.cwd(), "src/app/api/checkout/intent/route.ts");
    const content = fs.readFileSync(file, "utf-8");
    assert.ok(content.includes("checkRateLimit"), "checkout/intent route must import checkRateLimit");
    assert.ok(content.includes("checkout_intent:"), "checkout/intent route must enforce checkout_intent rate key");
    assert.ok(content.includes("status: 429"), "checkout/intent route must return HTTP 429 when rate limited");
  });

  await test("POST /api/orders is protected with checkRateLimit in source", () => {
    const file = path.resolve(process.cwd(), "src/app/api/orders/route.ts");
    const content = fs.readFileSync(file, "utf-8");
    assert.ok(content.includes("checkRateLimit"), "orders route must import checkRateLimit");
    assert.ok(content.includes("order_create:"), "orders route must enforce order_create rate key");
    assert.ok(content.includes("status: 429"), "orders route must return HTTP 429 when rate limited");
  });

  await test("POST /api/payments/create is protected with checkRateLimit in source", () => {
    const file = path.resolve(process.cwd(), "src/app/api/payments/create/route.ts");
    const content = fs.readFileSync(file, "utf-8");
    assert.ok(content.includes("checkRateLimit"), "payments/create must import checkRateLimit");
    assert.ok(content.includes("payment_create:"), "payments/create must enforce payment_create rate key");
    assert.ok(content.includes("status: 429"), "payments/create must return HTTP 429 when rate limited");
  });

  await test("POST /api/payments/verify is protected with checkRateLimit in source", () => {
    const file = path.resolve(process.cwd(), "src/app/api/payments/verify/route.ts");
    const content = fs.readFileSync(file, "utf-8");
    assert.ok(content.includes("checkRateLimit"), "payments/verify must import checkRateLimit");
    assert.ok(content.includes("payment_verify:"), "payments/verify must enforce payment_verify rate key");
    assert.ok(content.includes("status: 429"), "payments/verify must return HTTP 429 when rate limited");
  });

  await test("GET /api/products is protected with search rate limiting in source", () => {
    const file = path.resolve(process.cwd(), "src/app/api/products/route.ts");
    const content = fs.readFileSync(file, "utf-8");
    assert.ok(content.includes("checkRateLimit"), "products route must import checkRateLimit");
    assert.ok(content.includes("search:"), "products route must enforce search rate key");
    assert.ok(content.includes("status: 429"), "products route must return HTTP 429 when search is rate limited");
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST GROUP 3: OAuth Behavior & Authentication UI Hierarchy
  // ───────────────────────────────────────────────────────────────────────────
  console.log("\n--- Test Group 3: OAuth Behavior & Authentication UI ---");

  await test("generateOAuthState produces 64-char crypto-random hex string", () => {
    const state1 = generateOAuthState();
    const state2 = generateOAuthState();
    assert.strictEqual(state1.length, 64, "State must be 64 characters");
    assert.strictEqual(/^[0-9a-f]{64}$/.test(state1), true, "State must be valid hex");
    assert.notStrictEqual(state1, state2, "States must be randomly unique");
  });

  await test("buildGoogleAuthUrl formats correct OAuth endpoint with required scopes", () => {
    const state = generateOAuthState();
    const url = buildGoogleAuthUrl(state);
    assert.ok(url.startsWith("https://accounts.google.com/o/oauth2/v2/auth"), "Must target Google OAuth v2 endpoint");
    assert.ok(url.includes("response_type=code"), "Must request authorization code");
    assert.ok(url.includes("scope="), "Must include scope param");
    assert.ok(url.includes(`state=${state}`), "Must embed generated state in URL");
  });

  await test("SignupForm.tsx has active link to /api/auth/google and no mock message", () => {
    const file = path.resolve(process.cwd(), "src/components/customer/auth/SignupForm.tsx");
    const content = fs.readFileSync(file, "utf-8");
    assert.ok(content.includes('href="/api/auth/google"'), "SignupForm must link directly to /api/auth/google");
    assert.ok(content.includes('id="google-signup-btn"'), "SignupForm must have google-signup-btn");
    assert.ok(
      !content.includes("Google OAuth registration is scheduled for subsequent authentication phase"),
      "Mock placeholder message must be completely removed"
    );
  });

  await test("LoginForm.tsx places submit button directly after password field before divider", () => {
    const file = path.resolve(process.cwd(), "src/components/customer/auth/LoginForm.tsx");
    const content = fs.readFileSync(file, "utf-8").replace(/\r\n/g, "\n");
    const submitBtnIdx = content.indexOf('<button\n          type="submit"');
    const dividerIdx = content.indexOf('{/* Divider: Or */}');
    const googleBtnIdx = content.indexOf('href="/api/auth/google"');

    assert.ok(submitBtnIdx !== -1, "Submit button must exist");
    assert.ok(dividerIdx !== -1, "Divider must exist");
    assert.ok(googleBtnIdx !== -1, "Google button must exist");
    assert.ok(
      submitBtnIdx < dividerIdx,
      `Submit button (idx: ${submitBtnIdx}) must be before divider (idx: ${dividerIdx})`
    );
    assert.ok(
      dividerIdx < googleBtnIdx,
      `Divider (idx: ${dividerIdx}) must be before Google button (idx: ${googleBtnIdx})`
    );
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST GROUP 4: Category Filter Pills & Discovery Compatibility
  // ───────────────────────────────────────────────────────────────────────────
  console.log("\n--- Test Group 4: Category Pills & Discovery Compatibility ---");

  await test("ShopPageClient.tsx contains desktop category filter pills", () => {
    const file = path.resolve(process.cwd(), "src/components/customer/shop/ShopPageClient.tsx");
    const content = fs.readFileSync(file, "utf-8");
    assert.ok(content.includes("Desktop Category Filter Pills"), "ShopPageClient must contain desktop category pills");
    assert.ok(content.includes('aria-label="Category filter pills"'), "Category pills must have accessibility label");
    assert.ok(content.includes('onClick={() => handleCategoryChange("all")}'), "Pills must include All Products option");
    assert.ok(content.includes("handleCategoryChange(cat.slug)"), "Pills must invoke handleCategoryChange on click");
  });

  await test("ShopPageClient.tsx preserves mobile category chips and filter drawer trigger", () => {
    const file = path.resolve(process.cwd(), "src/components/customer/shop/ShopPageClient.tsx");
    const content = fs.readFileSync(file, "utf-8");
    assert.ok(content.includes('<div className="lg:hidden">'), "Mobile chips container must exist");
    assert.ok(content.includes("setMobileFilterOpen(true)"), "Filter drawer trigger must exist");
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST GROUP 5: Security Headers Hardening & How It Works Page
  // ───────────────────────────────────────────────────────────────────────────
  console.log("\n--- Test Group 5: Security Headers & How It Works Page ---");

  await test("next.config.mjs disables poweredByHeader and adds Permissions-Policy & COOP", () => {
    const file = path.resolve(process.cwd(), "next.config.mjs");
    const content = fs.readFileSync(file, "utf-8");
    assert.ok(content.includes("poweredByHeader: false"), "poweredByHeader must be set to false");
    assert.ok(content.includes("Permissions-Policy"), "Permissions-Policy header must be configured");
    assert.ok(content.includes("Cross-Origin-Opener-Policy"), "Cross-Origin-Opener-Policy must be configured");
    assert.ok(content.includes("same-origin-allow-popups"), "COOP must permit OAuth popups safely");
  });

  await test("How It Works page exists with verified business claims", () => {
    const file = path.resolve(process.cwd(), "src/app/how-it-works/page.tsx");
    assert.ok(fs.existsSync(file), "src/app/how-it-works/page.tsx must exist");
    const content = fs.readFileSync(file, "utf-8");
    assert.ok(content.includes("PLA+"), "Must detail eco-friendly PLA+ polymer");
    assert.ok(content.includes("0.12mm"), "Must detail 0.12mm precision layer resolution");
    assert.ok(content.includes("Made in India"), "Must detail Made in India manufacturing");
  });

  await test("DesktopHeader.tsx links to /how-it-works and /shop", () => {
    const file = path.resolve(process.cwd(), "src/components/customer/DesktopHeader.tsx");
    const content = fs.readFileSync(file, "utf-8");
    assert.ok(content.includes('href="/how-it-works"'), "DesktopHeader must link to /how-it-works");
    assert.ok(content.includes('href="/shop"'), "DesktopHeader must link to /shop");
  });

  console.log("\n================================================================================");
  console.log(`TEST SUITE RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log("================================================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
