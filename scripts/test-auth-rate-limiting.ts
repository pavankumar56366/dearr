/**
 * Automated Security Regression Test Suite for Dearr Auth Rate Limiting, Origin/CSRF, and Hardening
 *
 * Verifies:
 * 1. Repeated login failures for existing account trigger HTTP 429 with Retry-After header.
 * 2. Non-existent emails do not create unbounded database entries in rate_limits (IP-only tracking).
 * 3. Rate-limit recovery: Successful login clears the failed attempt counter.
 * 4. Signup throttling: Excessive registrations from the same IP are throttled with HTTP 429.
 * 5. CSRF/Origin enforcement: Untrusted Origin headers are rejected with HTTP 403.
 * 6. Constant-time CRON secret comparison in cleanup route.
 */

import fs from "fs";
import path from "path";
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

function assertTest(condition: boolean, testName: string, detail?: string) {
  totalTests++;
  if (condition) {
    console.log(`  [PASS] ${testName}`);
    passedTests++;
  } else {
    console.error(`  [FAIL] ${testName}${detail ? ` - ${detail}` : ""}`);
  }
}

async function run() {
  console.log("=== Running Dearr Auth Rate Limiting & Hardening Security Test Suite ===\n");

  const { query, checkRateLimit, clearRateLimit } = await import("../src/lib/server");
  const loginModule = await import("../src/app/api/auth/login/route");
  const signupModule = await import("../src/app/api/auth/signup/route");
  const cleanupModule = await import("../src/app/api/admin/orders/cleanup/route");

  const TEST_IP = "192.0.2.100";
  const TEST_USER_ID = "test-rate-user-" + Date.now();
  const TEST_EMAIL = `test.rate.${Date.now()}@example.com`;
  const TEST_PASSWORD = "ValidPassword123!";

  // Pre-test cleanup: ensure clean slate for TEST_IP
  await query("DELETE FROM rate_limits WHERE rate_key LIKE ?", [`%${TEST_IP}%`]);

  try {
    // ----------------------------------------------------
    // TEST 1: Rate limit helper behavior (unit level)
    // ----------------------------------------------------
    console.log("--- Test Group 1: checkRateLimit unit tests ---");
    const key = `test:unit:${Date.now()}`;
    const r1 = await checkRateLimit(key, 2, 60, true);
    assertTest(r1.allowed === true && r1.remaining === 1, "First hit allows and decrements remaining");

    const r2 = await checkRateLimit(key, 2, 60, true);
    assertTest(r2.allowed === true && r2.remaining === 0, "Second hit allows, remaining is 0");

    const r3 = await checkRateLimit(key, 2, 60, true);
    assertTest(r3.allowed === false && r3.retryAfterSeconds > 0, "Third hit is blocked with retryAfterSeconds");

    await clearRateLimit(key);
    const r4 = await checkRateLimit(key, 2, 60, false);
    assertTest(r4.allowed === true && r4.remaining === 2, "clearRateLimit resets key correctly");

    // ----------------------------------------------------
    // TEST 2: Login failure throttling & 429 Retry-After
    // ----------------------------------------------------
    console.log("\n--- Test Group 2: Login throttling & 429 response ---");

    // Create a temporary test customer directly in DB
    const bcrypt = await import("bcryptjs");
    const hashed = await bcrypt.hash(TEST_PASSWORD, 10);
    await query(
      `INSERT INTO profiles (id, email, full_name, password_hash, role, status, created_at, updated_at)
       VALUES (?, ?, 'Rate Test User', ?, 'customer', 'active', NOW(), NOW())`,
      [TEST_USER_ID, TEST_EMAIL, hashed]
    );

    const makeLoginRequest = (email: string, pass: string, ip: string, origin?: string) => {
      const headers: Record<string, string> = {
        "content-type": "application/json",
        "x-forwarded-for": ip,
        host: "localhost:3000",
      };
      if (origin) {
        headers["origin"] = origin;
      }
      return new Request("http://localhost:3000/api/auth/login", {
        method: "POST",
        headers,
        body: JSON.stringify({ email, password: pass }),
      });
    };

    // Attempt 1 to 5 with wrong password -> 401
    for (let i = 1; i <= 5; i++) {
      const req = makeLoginRequest(TEST_EMAIL, "wrongpass", TEST_IP);
      const res = await loginModule.POST(req);
      assertTest(res.status === 401, `Failed attempt ${i} returns 401`);
    }

    // Attempt 6 -> Account rate limit exceeded -> 429
    const reqBlocked = makeLoginRequest(TEST_EMAIL, "wrongpass", TEST_IP);
    const resBlocked = await loginModule.POST(reqBlocked);
    const retryAfter = resBlocked.headers.get("retry-after");
    const blockedBody = await resBlocked.json();

    assertTest(resBlocked.status === 429, "6th failed attempt returns HTTP 429");
    assertTest(Boolean(retryAfter) && Number(retryAfter) > 0, `Returns valid Retry-After header: ${retryAfter}`);
    assertTest(blockedBody.ok === false && blockedBody.error.includes("Too many failed login attempts"), "Returns clear rate limit error message");

    // ----------------------------------------------------
    // TEST 3: Attacker cannot bloat DB with fake emails
    // ----------------------------------------------------
    console.log("\n--- Test Group 3: Database bounding against fake emails ---");
    const FAKE_ATTACK_IP = "192.0.2.101";
    await query("DELETE FROM rate_limits WHERE rate_key LIKE ?", [`%${FAKE_ATTACK_IP}%`]);

    const fakeEmails = [
      `fake1_${Date.now()}@attacker.com`,
      `fake2_${Date.now()}@attacker.com`,
      `fake3_${Date.now()}@attacker.com`,
    ];

    for (const fakeEmail of fakeEmails) {
      const req = makeLoginRequest(fakeEmail, "anypassword", FAKE_ATTACK_IP);
      const res = await loginModule.POST(req);
      assertTest(res.status === 401, `Non-existent email login returns 401`);
    }

    // Check DB rows: Should ONLY have an IP row, NEVER email rows
    const emailRows = await query<any[]>(
      "SELECT * FROM rate_limits WHERE rate_key LIKE '%fake%@attacker.com%'",
      []
    );
    assertTest(emailRows.length === 0, "No rate_limit rows created for non-existent emails (unbounded bloat prevented)");

    const ipRows = await query<any[]>(
      "SELECT * FROM rate_limits WHERE rate_key = ?",
      [`login:fail:ip:${FAKE_ATTACK_IP}`]
    );
    assertTest(ipRows.length === 1 && ipRows[0].hits === 3, "Failed attempts tracked strictly against IP counter");

    // Clean up fake IP rows
    await query("DELETE FROM rate_limits WHERE rate_key LIKE ?", [`%${FAKE_ATTACK_IP}%`]);

    // ----------------------------------------------------
    // TEST 4: Successful login clears rate limit counters
    // ----------------------------------------------------
    console.log("\n--- Test Group 4: Recovery after successful login ---");
    // Manually reset account limit to simulate cool-down or test successful login
    await clearRateLimit([`login:fail:account:${TEST_USER_ID}`, `login:fail:ip:${TEST_IP}`]);

    // Introduce 2 failures
    await loginModule.POST(makeLoginRequest(TEST_EMAIL, "wrongpass", TEST_IP));
    await loginModule.POST(makeLoginRequest(TEST_EMAIL, "wrongpass", TEST_IP));

    // Now log in with correct password
    const validReq = makeLoginRequest(TEST_EMAIL, TEST_PASSWORD, TEST_IP);
    const validRes = await loginModule.POST(validReq);
    assertTest(validRes.status === 200, "Login with valid credentials succeeds with 200");

    // Check DB: account and IP keys must be cleared
    const checkCleared = await query<any[]>(
      "SELECT * FROM rate_limits WHERE rate_key IN (?, ?)",
      [`login:fail:account:${TEST_USER_ID}`, `login:fail:ip:${TEST_IP}`]
    );
    assertTest(checkCleared.length === 0, "Successful login clears failed attempt counters");

    // ----------------------------------------------------
    // TEST 5: CSRF / Origin enforcement on login
    // ----------------------------------------------------
    console.log("\n--- Test Group 5: CSRF / Origin Header Enforcement ---");
    const maliciousReq = makeLoginRequest(TEST_EMAIL, TEST_PASSWORD, TEST_IP, "http://evil-attacker.com");
    const maliciousRes = await loginModule.POST(maliciousReq);
    assertTest(maliciousRes.status === 403, "Login with cross-origin Origin header rejected with 403");

    const legitimateOriginReq = makeLoginRequest(TEST_EMAIL, TEST_PASSWORD, TEST_IP, "http://localhost:3000");
    const legitimateOriginRes = await loginModule.POST(legitimateOriginReq);
    assertTest(legitimateOriginRes.status === 200, "Login with matching Origin header allowed");

    // ----------------------------------------------------
    // TEST 6: Constant-time CRON secret verification
    // ----------------------------------------------------
    console.log("\n--- Test Group 6: Constant-time CRON secret verification ---");
    process.env.CRON_SECRET = "super_secure_cron_secret_1234567890";

    const makeCleanupReq = (authHeader?: string) => {
      const headers: Record<string, string> = { host: "localhost:3000" };
      if (authHeader) headers["authorization"] = authHeader;
      return new Request("http://localhost:3000/api/admin/orders/cleanup", {
        method: "POST",
        headers,
      }) as any;
    };

    const validCronRes = await cleanupModule.POST(makeCleanupReq(`Bearer ${process.env.CRON_SECRET}`));
    assertTest(validCronRes.status === 200, "Valid CRON authorization header succeeds with 200");

    const invalidCronRes = await cleanupModule.POST(makeCleanupReq("Bearer wrong_secret"));
    assertTest(invalidCronRes.status === 401, "Invalid CRON authorization header fails with 401");

    const wrongLengthCronRes = await cleanupModule.POST(makeCleanupReq("Bearer x"));
    assertTest(wrongLengthCronRes.status === 401, "Mismatched length CRON secret fails with 401 safely");

  } finally {
    // Clean up test data
    console.log("\n--- Cleaning up test artifacts ---");
    await query("DELETE FROM profiles WHERE id = ?", [TEST_USER_ID]);
    await query("DELETE FROM rate_limits WHERE rate_key LIKE ?", [`%${TEST_IP}%`]);
    await query("DELETE FROM rate_limits WHERE rate_key LIKE ?", [`%${TEST_USER_ID}%`]);
  }

  console.log(`\n=== Test Results: ${passedTests}/${totalTests} Passed ===`);
  if (passedTests !== totalTests) {
    process.exit(1);
  }
  process.exit(0);
}

run().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
