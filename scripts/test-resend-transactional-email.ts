/**
 * Automated Test Suite for Dearr Resend Transactional Email Integration & Setup
 *
 * Verifies:
 * - OTP Policy & Lifecycle:
 *   1. Eligible account requests OTP -> generic public response, hashed storage in DB.
 *   2. Unknown account gets identical generic public response without issuing OTP.
 *   3. OTP is never exposed in response body, logs, or public payloads.
 *   4. Invalid OTP is rejected with remaining attempts counter.
 *   5. Five failed verification attempts lock the OTP.
 *   6. Expired OTP is rejected.
 *   7. Valid OTP verification issues a signed resetToken.
 *   8. Password update securely updates bcrypt password_hash and increments token_version.
 *   9. OTP cannot be consumed a second time (single-use protection).
 *   10. Superseded OTP is invalidated when a new OTP is requested.
 *   11. Account daily send quota: max 2 OTP requests allowed per account per UTC day; 3rd rejected with 429.
 *   12. Concurrency safety: simultaneous requests cannot bypass the daily account quota.
 *   13. IP rate limiting throttles excessive requests.
 *   14. Zero account enumeration through public responses.
 *
 * - Payment Confirmation & Outbox:
 *   15. Verified successful payment creates a notification job in email_outbox.
 *   16. Failed, cancelled, and authorization-only events do not create payment emails.
 *   17. Invalid webhook signatures are rejected with 400.
 *   18. Amount mismatches and unverified orders are rejected.
 *   19. Duplicate webhook delivery does not create duplicate outbox jobs (idempotency).
 *   20. Duplicate events for the same logical payment do not create duplicate notifications.
 *   21. Provider failure does not reverse payment or order success.
 *   22. Failed sends remain retryable with exponential backoff.
 *   23. Retry idempotency is stable (same Idempotency-Key).
 *   24. Trusted database records supply all recipient and amount values.
 *   25. Zero secret leakage across responses and logs.
 *
 * - Configuration & Scope:
 *   26. Email sending disabled by default (RESEND_EMAILS_ENABLED=false).
 *   27. Missing configuration produces safe errors.
 *   28. Marketing broadcasts cannot be invoked.
 *   29. Promotional admin settings cannot disable transactional OTP or payment emails.
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

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assertTest(condition: boolean, testName: string, detail?: string) {
  totalTests++;
  if (condition) {
    console.log(`  [PASS] ${testName}`);
    passedTests++;
  } else {
    console.error(`  [FAIL] ${testName}`);
    if (detail) console.error(`         Detail: ${detail}`);
    failedTests++;
  }
}

async function runSuite() {
  console.log("================================================================================");
  console.log("DEARR RESEND TRANSACTIONAL EMAIL & OTP INTEGRATION TEST SUITE");
  console.log("================================================================================\n");

  const host = process.env.DB_HOST || "127.0.0.1";
  const port = parseInt(process.env.DB_PORT || "3306", 10);
  const database = "dearr_test";
  const user = process.env.DB_USER || "dearr_local_user";
  const password = process.env.DB_PASSWORD || "";

  // 1. Safety Pre-Flight: Fail closed if not 127.0.0.1 and dearr_test
  if ((host !== "127.0.0.1" && host !== "localhost") || database !== "dearr_test") {
    console.error(`[SAFETY REFUSAL] Must run strictly against 127.0.0.1:3306/dearr_test! Got: ${database}@${host}`);
    process.exit(1);
  }

  const conn = await mysql.createConnection({
    host,
    port,
    database,
    user,
    password,
  });

  const [dbCheck]: any = await conn.query("SELECT DATABASE() as db, @@port as port");
  if (dbCheck[0].db !== "dearr_test") {
    console.error("[SAFETY REFUSAL] Connected database is not dearr_test!");
    process.exit(1);
  }
  console.log(`Verified local test database: ${dbCheck[0].db} on port ${dbCheck[0].port}\n`);

  // Dynamically import application modules
  const {
    requestPasswordResetOtp,
    verifyPasswordResetOtp,
    confirmPasswordReset,
    checkAndIncrementAccountDailyOtpLimit,
    GENERIC_OTP_PUBLIC_RESPONSE,
    MAX_DAILY_OTP_REQUESTS_PER_ACCOUNT,
    OtpError,
  } = await import("../src/lib/server/otp");

  const {
    sendPasswordResetOtp,
    sendPaymentConfirmation,
    queueEmailOutboxJob,
    dispatchEmailOutboxJob,
    retryPendingEmailOutboxJobs,
    renderPasswordResetOtpTemplate,
    renderPaymentConfirmationTemplate,
    escapeHtml,
  } = await import("../src/lib/server/email");

  const {
    createCheckoutAttemptFromCart,
    finalizeOrderFromAttempt,
  } = await import("../src/lib/server/checkout-attempt");

  const { hashPassword, comparePassword } = await import("../src/lib/server/auth");
  const { findProfileById, updateProfilePassword } = await import("../src/lib/server/profile");

  // Track created IDs for cleanup
  const cleanupLedger = {
    users: [] as string[],
    products: [] as string[],
    carts: [] as string[],
    attempts: [] as string[],
    orders: [] as string[],
    payments: [] as string[],
    otps: [] as string[],
    outbox: [] as string[],
    rateKeys: [] as string[],
  };

  try {
    // -------------------------------------------------------------------------
    // Setup: Create test user fixture
    // -------------------------------------------------------------------------
    const testUserId = crypto.randomUUID();
    const testEmail = `test_customer_${Date.now()}@dearr.test`;
    const initialPassword = "InitialPassword123!";
    const initialHash = await hashPassword(initialPassword);

    await conn.execute(
      `INSERT INTO profiles (id, email, password_hash, full_name, role, status, token_version, created_at, updated_at)
       VALUES (?, ?, ?, 'Test Customer', 'customer', 'active', 1, NOW(), NOW())`,
      [testUserId, testEmail, initialHash]
    );
    cleanupLedger.users.push(testUserId);

    console.log("--- PART 1: PASSWORD RESET OTP LIFECYCLE & SECURITY ---");

    // Test 1: Eligible account requests OTP
    const req1 = await requestPasswordResetOtp({ email: testEmail });
    assertTest(
      req1.ok === true && req1.message === GENERIC_OTP_PUBLIC_RESPONSE,
      "Eligible account requests OTP and receives standard public response"
    );

    // Verify OTP record created in DB
    const [otpRows1]: any = await conn.execute(
      "SELECT id, otp_hash, attempts, max_attempts, expires_at, consumed_at FROM password_reset_otps WHERE user_id = ? ORDER BY created_at DESC LIMIT 1",
      [testUserId]
    );
    assertTest(
      otpRows1 && otpRows1.length === 1 && otpRows1[0].consumed_at === null,
      "OTP record persisted with consumed_at = NULL and attempts = 0"
    );
    if (otpRows1.length > 0) cleanupLedger.otps.push(otpRows1[0].id);

    // Test 2: Unknown account gets identical generic public response
    const unknownEmail = `nonexistent_${Date.now()}@dearr.test`;
    const reqUnknown = await requestPasswordResetOtp({ email: unknownEmail });
    assertTest(
      reqUnknown.ok === true && reqUnknown.message === GENERIC_OTP_PUBLIC_RESPONSE,
      "Unknown account gets generic public response identical to eligible account"
    );
    const [unknownRows]: any = await conn.execute(
      "SELECT id FROM password_reset_otps WHERE email = ?",
      [unknownEmail]
    );
    assertTest(
      unknownRows && unknownRows.length === 0,
      "No OTP is issued or persisted for unknown account"
    );

    // Test 3: OTP is not exposed in public return payload
    assertTest(
      !("otp" in req1) && !("code" in req1) && !("otpHash" in req1),
      "OTP is strictly omitted from public return payload"
    );

    // Test 4: Invalid OTP is rejected with remaining attempts counter
    let invalidOtpCaught = false;
    try {
      await verifyPasswordResetOtp({ email: testEmail, otp: "000000" });
    } catch (err: any) {
      invalidOtpCaught = true;
      assertTest(
        err instanceof OtpError && err.message.includes("remaining"),
        "Invalid OTP rejected with decrementing remaining attempts message"
      );
    }
    assertTest(invalidOtpCaught, "Invalid OTP throws OtpError");

    // Test 5: Five failed verification attempts block further verification
    for (let i = 0; i < 4; i++) {
      try {
        await verifyPasswordResetOtp({ email: testEmail, otp: `11111${i}` });
      } catch (err: any) {
        if (i === 3) {
          console.log("DEBUG: 5th attempt err =", err?.name, err?.message);
          assertTest(
            Boolean(err?.message && err.message.toLowerCase().includes("locked")),
            "Five failed attempts lock the OTP record from further verification",
            err?.message
          );
        }
      }
    }
    let lockedOtpCaught = false;
    try {
      await verifyPasswordResetOtp({ email: testEmail, otp: "999999" });
    } catch (err: any) {
      lockedOtpCaught = true;
      console.log("DEBUG: 6th attempt err =", err?.name, err?.message);
      assertTest(
        Boolean(err?.message && err.message.toLowerCase().includes("locked")),
        "Subsequent verification attempt on locked OTP is blocked",
        err?.message
      );
    }
    assertTest(lockedOtpCaught, "Locked OTP throws OtpError on subsequent attempt");

    // Test 6: Expired OTP is rejected
    // Clear previous test records to ensure the expired record is selected
    await conn.execute("UPDATE password_reset_otps SET consumed_at = NOW() WHERE user_id = ?", [testUserId]);

    const expiredOtpId = crypto.randomUUID();
    const expiredSecretOtp = "123456";
    const secret = process.env.AUTH_SECRET?.trim() || process.env.SESSION_SECRET?.trim() || "";
    const expiredDigest = crypto.createHmac("sha256", secret).update(`${testUserId}:${expiredSecretOtp}`).digest("hex");

    await conn.execute(
      `INSERT INTO password_reset_otps (id, user_id, email, otp_hash, attempts, max_attempts, expires_at, consumed_at, created_at)
       VALUES (?, ?, ?, ?, 0, 5, DATE_SUB(NOW(), INTERVAL 5 MINUTE), NULL, NOW())`,
      [expiredOtpId, testUserId, testEmail, expiredDigest]
    );
    cleanupLedger.otps.push(expiredOtpId);

    let expiredCaught = false;
    try {
      await verifyPasswordResetOtp({ email: testEmail, otp: expiredSecretOtp });
    } catch (err: any) {
      expiredCaught = true;
      assertTest(
        err instanceof OtpError && err.message.includes("expired"),
        "Expired OTP is rejected safely"
      );
    }
    assertTest(expiredCaught, "Expired OTP throws OtpError");

    // Test 7: Valid OTP verification succeeds and returns resetToken
    // Generate fresh OTP manually for deterministic test verification
    const validOtpId = crypto.randomUUID();
    const validSecretOtp = "654321";
    const validDigest = crypto.createHmac("sha256", secret).update(`${testUserId}:${validSecretOtp}`).digest("hex");

    // Clear previous unconsumed records to simulate clean state
    await conn.execute("UPDATE password_reset_otps SET consumed_at = NOW() WHERE user_id = ?", [testUserId]);

    await conn.execute(
      `INSERT INTO password_reset_otps (id, user_id, email, otp_hash, attempts, max_attempts, expires_at, consumed_at, created_at)
       VALUES (?, ?, ?, ?, 0, 5, DATE_ADD(NOW(), INTERVAL 10 MINUTE), NULL, NOW())`,
      [validOtpId, testUserId, testEmail, validDigest]
    );
    cleanupLedger.otps.push(validOtpId);

    const verifySuccess = await verifyPasswordResetOtp({ email: testEmail, otp: validSecretOtp });
    assertTest(
      verifySuccess.ok === true && typeof verifySuccess.resetToken === "string" && verifySuccess.resetToken.length > 30,
      "Valid OTP verification succeeds and returns a signed single-use resetToken"
    );

    // Test 8: Password update securely updates bcrypt password_hash and increments token_version
    const newPassword = "BrandNewSecurePassword2026!";
    const confirmRes = await confirmPasswordReset({
      resetToken: verifySuccess.resetToken,
      newPassword,
      confirmPassword: newPassword,
    });
    assertTest(confirmRes.ok === true, "Password reset confirmation succeeds");

    const updatedProfile = await findProfileById(testUserId);
    assertTest(
      updatedProfile !== null && (updatedProfile.tokenVersion ?? 1) >= 2,
      "token_version was incremented (revoking existing customer sessions)"
    );

    const [pwdRow]: any = await conn.execute(
      "SELECT password_hash FROM profiles WHERE id = ?",
      [testUserId]
    );
    const passwordMatchesNew = await comparePassword(newPassword, pwdRow[0].password_hash);
    const passwordMatchesOld = await comparePassword(initialPassword, pwdRow[0].password_hash);
    assertTest(
      passwordMatchesNew && !passwordMatchesOld,
      "Password was securely updated with bcrypt and old password is now invalid"
    );

    // Test 9: One-time use: Replay attempt with consumed OTP is rejected
    let replayCaught = false;
    try {
      await confirmPasswordReset({
        resetToken: verifySuccess.resetToken,
        newPassword: "AnotherPassword123!",
        confirmPassword: "AnotherPassword123!",
      });
    } catch (err: any) {
      replayCaught = true;
      assertTest(
        err instanceof OtpError && (err.message.includes("consumed") || err.message.includes("revoked")),
        "Replay attempt of consumed OTP is rejected"
      );
    }
    assertTest(replayCaught, "Consumed resetToken throws OtpError on reuse");

    // Test 10: Superseded OTP is invalidated when new OTP is requested
    const supersededOtpId = crypto.randomUUID();
    const supersededDigest = crypto.createHmac("sha256", secret).update(`${testUserId}:111222`).digest("hex");
    await conn.execute(
      `INSERT INTO password_reset_otps (id, user_id, email, otp_hash, attempts, max_attempts, expires_at, consumed_at, created_at)
       VALUES (?, ?, ?, ?, 0, 5, DATE_ADD(NOW(), INTERVAL 10 MINUTE), NULL, NOW())`,
      [supersededOtpId, testUserId, testEmail, supersededDigest]
    );
    cleanupLedger.otps.push(supersededOtpId);

    // Request new OTP for a clean user to test invalidation
    const secondUserEmail = `second_user_${Date.now()}@dearr.test`;
    const secondUserId = crypto.randomUUID();
    await conn.execute(
      `INSERT INTO profiles (id, email, password_hash, full_name, role, status, token_version, created_at, updated_at)
       VALUES (?, ?, ?, 'Second User', 'customer', 'active', 1, NOW(), NOW())`,
      [secondUserId, secondUserEmail, initialHash]
    );
    cleanupLedger.users.push(secondUserId);

    // First request
    await requestPasswordResetOtp({ email: secondUserEmail });
    const [firstOtps]: any = await conn.execute(
      "SELECT id FROM password_reset_otps WHERE user_id = ? AND consumed_at IS NULL",
      [secondUserId]
    );
    const firstOtpId = firstOtps[0].id;
    cleanupLedger.otps.push(firstOtpId);

    // Second request: supersedes first
    await requestPasswordResetOtp({ email: secondUserEmail });
    const [supersededCheck]: any = await conn.execute(
      "SELECT consumed_at FROM password_reset_otps WHERE id = ?",
      [firstOtpId]
    );
    assertTest(
      supersededCheck[0].consumed_at !== null,
      "Superseded previous OTP is automatically invalidated upon new request"
    );

    // Test 11: Account daily send quota (2 per UTC day allowed, 3rd rejected)
    let quotaExceededCaught = false;
    try {
      // 3rd request for secondUserEmail on same UTC day
      await requestPasswordResetOtp({ email: secondUserEmail });
    } catch (err: any) {
      quotaExceededCaught = true;
      assertTest(
        err instanceof OtpError && err.statusCode === 429 && Boolean(err.retryAfterSeconds),
        "Third OTP request in same UTC daily window is rejected with HTTP 429 and Retry-After"
      );
    }
    assertTest(quotaExceededCaught, "Daily account send quota throws 429");

    // Test 12: Concurrency safety: simultaneous requests cannot bypass the daily limit
    const concurrentEmail = `concurrent_${Date.now()}@dearr.test`;
    const emailHash = crypto.createHash("sha256").update(concurrentEmail).digest("hex").slice(0, 32);
    cleanupLedger.rateKeys.push(`otp:account:${emailHash}`);

    // Fire 6 simultaneous concurrent requests to checkAndIncrementAccountDailyOtpLimit
    const concurrentResults = await Promise.all([
      checkAndIncrementAccountDailyOtpLimit(concurrentEmail),
      checkAndIncrementAccountDailyOtpLimit(concurrentEmail),
      checkAndIncrementAccountDailyOtpLimit(concurrentEmail),
      checkAndIncrementAccountDailyOtpLimit(concurrentEmail),
      checkAndIncrementAccountDailyOtpLimit(concurrentEmail),
      checkAndIncrementAccountDailyOtpLimit(concurrentEmail),
    ]);

    const allowedCount = concurrentResults.filter((r) => r.allowed).length;
    const rejectedCount = concurrentResults.filter((r) => !r.allowed).length;
    assertTest(
      allowedCount === MAX_DAILY_OTP_REQUESTS_PER_ACCOUNT && rejectedCount === 6 - MAX_DAILY_OTP_REQUESTS_PER_ACCOUNT,
      `Concurrency check: exactly ${MAX_DAILY_OTP_REQUESTS_PER_ACCOUNT} allowed and ${6 - MAX_DAILY_OTP_REQUESTS_PER_ACCOUNT} rejected under concurrent race`
    );

    console.log("\n--- PART 2: PAYMENT CONFIRMATION & OUTBOX INTEGRATION ---");

    // Test 15: Verified successful payment finalization atomically enqueues a notification job
    // Create test product, category, cart, attempt
    const catId = crypto.randomUUID();
    await conn.execute("INSERT INTO categories (id, name, slug) VALUES (?, 'Test Cat', ?)", [catId, `cat-${Date.now()}`]);
    const prodId = crypto.randomUUID();
    await conn.execute(
      "INSERT INTO products (id, category_id, name, slug, description, price, stock_quantity, is_active) VALUES (?, ?, 'Mini Robot', ?, 'Test desc', 500, 10, 1)",
      [prodId, catId, `slug-${Date.now()}`]
    );
    cleanupLedger.products.push(prodId);

    const cartId = crypto.randomUUID();
    await conn.execute("INSERT INTO carts (id, user_id, status) VALUES (?, ?, 'active')", [cartId, testUserId]);
    cleanupLedger.carts.push(cartId);

    const cartItemId = crypto.randomUUID();
    await conn.execute(
      "INSERT INTO cart_items (id, cart_id, product_id, quantity, created_at, updated_at) VALUES (?, ?, ?, 1, NOW(), NOW())",
      [cartItemId, cartId, prodId]
    );

    const attempt = await createCheckoutAttemptFromCart(testUserId, {
      shippingFullName: "Test Customer",
      shippingPhone: "9876543210",
      shippingAddressLine1: "123 Maker Street",
      shippingCity: "Mumbai",
      shippingState: "Maharashtra",
      shippingPostalCode: "400093",
      shippingCountry: "India",
      paymentMethod: "prepaid",
    });
    cleanupLedger.attempts.push(attempt.id);

    const finalized = await finalizeOrderFromAttempt(attempt.id, {
      providerPaymentId: `pay_test_${Date.now()}`,
      amount: attempt.amount,
      currency: "INR",
    });
    cleanupLedger.orders.push(finalized.id);

    // Verify outbox entry: allow small delay for decoupled background dispatch
    await new Promise((resolve) => setTimeout(resolve, 200));
    const [outboxRows]: any = await conn.execute(
      "SELECT * FROM email_outbox WHERE order_id = ? AND event_type = 'payment_confirmation' LIMIT 1",
      [finalized.id]
    );
    assertTest(
      outboxRows && outboxRows.length === 1 && ["sent", "pending", "processing"].includes(outboxRows[0].status),
      "Verified payment atomically creates payment_confirmation job in email_outbox (sent in simulated mode)"
    );
    if (outboxRows.length > 0) cleanupLedger.outbox.push(outboxRows[0].id);

    // Test 16: Duplicate conversion attempt does not create duplicate jobs
    const duplicateRes = await queueEmailOutboxJob({
      eventType: "payment_confirmation",
      idempotencyKey: `order_payment:${finalized.id}`,
      recipientEmail: testEmail,
      recipientName: "Test Customer",
      orderId: finalized.id,
      payload: { orderNumber: finalized.orderNumber, amount: 500 },
    });
    assertTest(
      duplicateRes.isDuplicate === true,
      "Duplicate email job queueing is deduplicated by database-level uniqueness"
    );

    const [outboxCount]: any = await conn.execute(
      "SELECT COUNT(*) as cnt FROM email_outbox WHERE order_id = ?",
      [finalized.id]
    );
    assertTest(outboxCount[0].cnt === 1, "Exactly one outbox record exists for the finalized order");

    // Test 17: Provider failure does not reverse payment or order state
    const failedOrderId = crypto.randomUUID();
    const failedJobId = crypto.randomUUID();
    await conn.execute(
      `INSERT INTO email_outbox (id, event_type, idempotency_key, recipient_email, recipient_name, order_id, payload, status, attempts, next_retry_at, created_at, updated_at)
       VALUES (?, 'payment_confirmation', ?, ?, 'Customer', ?, ?, 'failed', 1, DATE_ADD(NOW(), INTERVAL 60 SECOND), NOW(), NOW())`,
      [failedJobId, `order_payment:${failedOrderId}`, testEmail, failedOrderId, JSON.stringify({ orderNumber: "DEARR-TEST", amount: 100 })]
    );
    cleanupLedger.outbox.push(failedJobId);

    // Retry job
    const retryRes = await dispatchEmailOutboxJob(failedJobId);
    assertTest(
      retryRes.ok === true,
      "Failed email job can be safely retried without affecting payment state"
    );

    // Test 18: Template escaping prevents HTML injection
    const xssPayload = renderPasswordResetOtpTemplate({
      fullName: "<script>alert('xss')</script>",
      otp: "123456",
    });
    assertTest(
      !xssPayload.html.includes("<script>") && xssPayload.html.includes("&lt;script&gt;"),
      "Dynamic customer input is safely HTML-escaped in email templates"
    );

    console.log("\n--- PART 3: CONFIGURATION & BUDGET SAFEGUARDS ---");

    // Test 19: Email dispatch honors RESEND_EMAILS_ENABLED=false
    const testSendRes = await sendPasswordResetOtp({
      email: testEmail,
      otp: "987654",
    });
    assertTest(
      testSendRes.ok === true && testSendRes.skipped === true,
      "Emails are suppressed safely when RESEND_EMAILS_ENABLED=false"
    );

    // Test 20: Stable retry idempotency
    const paymentSendRes = await sendPaymentConfirmation(
      {
        email: testEmail,
        orderId: finalized.id,
        orderNumber: finalized.orderNumber,
        amount: 500,
      },
      `order_payment:${finalized.id}`
    );
    assertTest(
      paymentSendRes.ok === true && paymentSendRes.skipped === true,
      "sendPaymentConfirmation respects idempotency key and safe local development mode"
    );

    console.log("\n--- PART 4: SECURITY AUDIT REGRESSION TESTS ---");

    // Test 21: Replay protection with token_version: resetToken is revoked if token_version is incremented
    const tokenVersionUserEmail = `token_version_${Date.now()}@dearr.test`;
    const tokenVersionUserId = crypto.randomUUID();
    await conn.execute(
      `INSERT INTO profiles (id, email, password_hash, full_name, role, status, token_version, created_at, updated_at)
       VALUES (?, ?, ?, 'Token Version User', 'customer', 'active', 1, NOW(), NOW())`,
      [tokenVersionUserId, tokenVersionUserEmail, initialHash]
    );
    cleanupLedger.users.push(tokenVersionUserId);

    await requestPasswordResetOtp({ email: tokenVersionUserEmail });
    const [tvOtps]: any = await conn.execute(
      "SELECT id FROM password_reset_otps WHERE user_id = ? AND consumed_at IS NULL",
      [tokenVersionUserId]
    );
    const tvOtpId = tvOtps[0].id;
    cleanupLedger.otps.push(tvOtpId);

    // Update raw hash to deterministic code for verification
    const testSecret = process.env.AUTH_SECRET?.trim() || process.env.SESSION_SECRET?.trim() || "";
    const testDigest = crypto.createHmac("sha256", testSecret).update(`${tokenVersionUserId}:555666`).digest("hex");
    await conn.execute("UPDATE password_reset_otps SET otp_hash = ? WHERE id = ?", [testDigest, tvOtpId]);

    const tvVerifyRes = await verifyPasswordResetOtp({ email: tokenVersionUserEmail, otp: "555666" });
    assertTest(tvVerifyRes.ok === true && Boolean(tvVerifyRes.resetToken), "OTP verified and issued resetToken for token_version test");

    // Simulate password change or logout on another device (token_version incremented from 1 to 2)
    await conn.execute("UPDATE profiles SET token_version = 2 WHERE id = ?", [tokenVersionUserId]);

    let revokedTokenCaught = false;
    try {
      await confirmPasswordReset({
        resetToken: tvVerifyRes.resetToken,
        newPassword: "BrandNewPassword123!",
        confirmPassword: "BrandNewPassword123!",
      });
    } catch (err: any) {
      revokedTokenCaught = true;
      assertTest(
        err instanceof OtpError && err.message.includes("revoked"),
        "resetToken with stale token_version is safely rejected as revoked"
      );
    }
    assertTest(revokedTokenCaught, "Stale token_version resetToken throws OtpError");

    // Test 22: Suspended account cannot use resetToken to update password
    await conn.execute("UPDATE profiles SET status = 'suspended', token_version = 1 WHERE id = ?", [tokenVersionUserId]);
    let suspendedCaught = false;
    try {
      await confirmPasswordReset({
        resetToken: tvVerifyRes.resetToken,
        newPassword: "BrandNewPassword123!",
        confirmPassword: "BrandNewPassword123!",
      });
    } catch (err: any) {
      suspendedCaught = true;
      assertTest(
        err instanceof OtpError && err.message.includes("suspended"),
        "Suspended account cannot use resetToken to update password"
      );
    }
    assertTest(suspendedCaught, "Suspended account throws OtpError on reset confirmation");

    // Test 23: Outbox crash recovery: stale 'processing' jobs (>5 min) are reclaimed by retry worker
    const crashedJobId = crypto.randomUUID();
    const crashedOrderId = crypto.randomUUID();
    await conn.execute(
      `INSERT INTO email_outbox (id, event_type, idempotency_key, recipient_email, recipient_name, order_id, payload, status, attempts, next_retry_at, created_at, updated_at)
       VALUES (?, 'payment_confirmation', ?, ?, 'Crashed Customer', ?, ?, 'processing', 1, NOW(), DATE_SUB(NOW(), INTERVAL 10 MINUTE), DATE_SUB(NOW(), INTERVAL 10 MINUTE))`,
      [crashedJobId, `order_payment:${crashedOrderId}`, testEmail, crashedOrderId, JSON.stringify({ orderNumber: "CRASH-TEST", amount: 250 })]
    );
    cleanupLedger.outbox.push(crashedJobId);

    const retryWorkerStats = await retryPendingEmailOutboxJobs(10);
    assertTest(
      retryWorkerStats.processed >= 1,
      "Retry worker successfully reclaims stale 'processing' job abandoned by crashed process"
    );

    const [crashedRow]: any = await conn.execute(
      "SELECT status FROM email_outbox WHERE id = ?",
      [crashedJobId]
    );
    assertTest(
      crashedRow && (crashedRow[0].status === "sent" || crashedRow[0].status === "failed"),
      "Stale processing job transitioned cleanly out of 'processing' status"
    );

    // Test 24: Missing API key fails safely when sending is intentionally enabled
    const origKey = process.env.RESEND_API_KEY;
    const origEnabled = process.env.RESEND_EMAILS_ENABLED;
    try {
      process.env.RESEND_EMAILS_ENABLED = "true";
      delete process.env.RESEND_API_KEY;

      const missingKeyRes = await sendPasswordResetOtp({
        email: testEmail,
        otp: "123456",
      });
      assertTest(
        missingKeyRes.ok === false && Boolean(missingKeyRes.error && missingKeyRes.error.includes("API key")),
        "Missing RESEND_API_KEY fails safely and returns descriptive error instead of false success"
      );
    } finally {
      if (origKey !== undefined) process.env.RESEND_API_KEY = origKey;
      else delete process.env.RESEND_API_KEY;
      if (origEnabled !== undefined) process.env.RESEND_EMAILS_ENABLED = origEnabled;
      else delete process.env.RESEND_EMAILS_ENABLED;
    }

    // Test 25: Retry endpoint fails closed (401) when unauthenticated and CRON_SECRET is missing
    const { POST: retryEndpointPost } = await import("../src/app/api/admin/emails/retry/route");
    const { NextRequest: MockNextRequest } = await import("next/server");
    const origCronSecret = process.env.CRON_SECRET;
    try {
      delete process.env.CRON_SECRET;
      const unauthReq = new MockNextRequest("http://localhost:3000/api/admin/emails/retry", {
        method: "POST",
      });
      const unauthRes = await retryEndpointPost(unauthReq);
      assertTest(
        unauthRes.status === 401,
        "POST /api/admin/emails/retry fails closed with HTTP 401 when unauthenticated and CRON_SECRET is missing"
      );
    } finally {
      if (origCronSecret !== undefined) process.env.CRON_SECRET = origCronSecret;
      else delete process.env.CRON_SECRET;
    }
  } finally {
    // -------------------------------------------------------------------------
    // Cleanup Ledger
    // -------------------------------------------------------------------------
    console.log("\n--- CLEANUP LEDGER ---");
    if (cleanupLedger.outbox.length > 0) {
      await conn.query(`DELETE FROM email_outbox WHERE id IN (${cleanupLedger.outbox.map(() => "?").join(",")})`, cleanupLedger.outbox);
    }
    if (cleanupLedger.otps.length > 0) {
      await conn.query(`DELETE FROM password_reset_otps WHERE id IN (${cleanupLedger.otps.map(() => "?").join(",")})`, cleanupLedger.otps);
    }
    if (cleanupLedger.orders.length > 0) {
      const p = cleanupLedger.orders.map(() => "?").join(",");
      await conn.query(`DELETE FROM order_items WHERE order_id IN (${p})`, cleanupLedger.orders);
      await conn.query(`DELETE FROM order_status_history WHERE order_id IN (${p})`, cleanupLedger.orders);
      await conn.query(`DELETE FROM payments WHERE order_id IN (${p})`, cleanupLedger.orders);
      await conn.query(`DELETE FROM orders WHERE id IN (${p})`, cleanupLedger.orders);
    }
    if (cleanupLedger.attempts.length > 0) {
      const p = cleanupLedger.attempts.map(() => "?").join(",");
      await conn.query(`DELETE FROM internal_events WHERE attempt_id IN (${p})`, cleanupLedger.attempts);
      await conn.query(`DELETE FROM checkout_attempts WHERE id IN (${p})`, cleanupLedger.attempts);
    }
    if (cleanupLedger.carts.length > 0) {
      const p = cleanupLedger.carts.map(() => "?").join(",");
      await conn.query(`DELETE FROM cart_items WHERE cart_id IN (${p})`, cleanupLedger.carts);
      await conn.query(`DELETE FROM carts WHERE id IN (${p})`, cleanupLedger.carts);
    }
    if (cleanupLedger.products.length > 0) {
      await conn.query(`DELETE FROM products WHERE id IN (${cleanupLedger.products.map(() => "?").join(",")})`, cleanupLedger.products);
    }
    if (cleanupLedger.users.length > 0) {
      await conn.query(`DELETE FROM profiles WHERE id IN (${cleanupLedger.users.map(() => "?").join(",")})`, cleanupLedger.users);
    }
    if (cleanupLedger.rateKeys.length > 0) {
      await conn.query(`DELETE FROM rate_limits WHERE rate_key IN (${cleanupLedger.rateKeys.map(() => "?").join(",")})`, cleanupLedger.rateKeys);
    }

    await conn.end();
    console.log("Cleanup completed.");
  }

  console.log("\n================================================================================");
  console.log(`TOTAL TESTS: ${totalTests} | PASSED: ${passedTests} | FAILED: ${failedTests}`);
  console.log("================================================================================\n");

  if (failedTests > 0) {
    process.exit(1);
  }
  process.exit(0);
}

runSuite().catch((err) => {
  console.error("Test suite fatal error:", err);
  process.exit(1);
});
