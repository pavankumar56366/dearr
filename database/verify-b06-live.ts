import fs from "fs";
import path from "path";

// Load .env.local manually for cleanup query connection
const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, "utf-8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx !== -1) {
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim();
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

async function verifyLive() {
  console.log("=================================================================");
  console.log("Dearr V1 — Task B-06 Live Dev Server Verification");
  console.log("Host: http://localhost:3000");
  console.log("=================================================================\n");

  const baseUrl = "http://localhost:3000";
  const qaEmail = `qa_b06_test_${Date.now()}@dearr.test`;
  const qaPassword = "SecurePassword123!";
  const qaName = "QA B06 Customer Test";
  const qaPhone = "9876543210";
  let createdUserId: string | null = null;
  let sessionCookie: string | null = null;

  // 1. Health check for DB
  console.log("1. Verifying Database Health (GET /api/health/db)...");
  const resHealth = await fetch(`${baseUrl}/api/health/db`);
  const dataHealth = await resHealth.json();
  console.log("   Status:", resHealth.status, JSON.stringify(dataHealth));
  if (!dataHealth.ok) {
    throw new Error("DB Health check failed");
  }

  // 2. GET /api/auth/me while logged out
  console.log("\n2. Verifying GET /api/auth/me while logged out...");
  const resMeLoggedOut = await fetch(`${baseUrl}/api/auth/me`);
  const dataMeLoggedOut = await resMeLoggedOut.json();
  console.log("   Status:", resMeLoggedOut.status, JSON.stringify(dataMeLoggedOut));
  if (dataMeLoggedOut.ok !== false || dataMeLoggedOut.user !== null) {
    throw new Error("Expected ok: false, user: null when logged out");
  }
  console.log("   ✓ Correctly returned unauthenticated state (ok: false, user: null)");

  // 3. POST /api/auth/login with invalid credentials
  console.log("\n3. Verifying POST /api/auth/login with invalid credentials...");
  const resBadLogin = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "nonexistent_b06@dearr.test",
      password: "WrongPassword999!",
    }),
  });
  const dataBadLogin = await resBadLogin.json();
  console.log("   Status:", resBadLogin.status, JSON.stringify(dataBadLogin));
  if (resBadLogin.status !== 401 || dataBadLogin.ok !== false) {
    throw new Error("Expected 401 Unauthorized for invalid login");
  }
  console.log(`   ✓ Correctly rejected with status 401: "${dataBadLogin.error}"`);

  // 4. Successful signup with QA test email
  console.log(`\n4. Verifying Successful Signup (POST /api/auth/signup)...`);
  console.log(`   Email: ${qaEmail}`);
  const resSignup = await fetch(`${baseUrl}/api/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: qaName,
      email: qaEmail,
      phone: qaPhone,
      password: qaPassword,
    }),
  });
  const dataSignup = await resSignup.json();
  console.log("   Status:", resSignup.status, JSON.stringify(dataSignup));
  if (resSignup.status !== 201 || !dataSignup.ok || !dataSignup.user?.id) {
    throw new Error(`Signup failed: ${JSON.stringify(dataSignup)}`);
  }
  createdUserId = dataSignup.user.id;

  // Extract set-cookie
  const setCookieHeader = resSignup.headers.get("set-cookie");
  console.log("   Set-Cookie Header present:", !!setCookieHeader);
  if (setCookieHeader) {
    const match = setCookieHeader.match(/dearr_session=([^;]+)/);
    if (match) {
      sessionCookie = `dearr_session=${match[1]}`;
      console.log("   ✓ Captured dearr_session cookie successfully");
    }
  }
  if (!sessionCookie) {
    throw new Error("Expected dearr_session cookie in signup response");
  }

  // Security check: ensure no password_hash in response
  if (dataSignup.user.passwordHash || dataSignup.user.password_hash) {
    throw new Error("SECURITY ISSUE: password_hash leaked in signup response!");
  }
  console.log("   ✓ User created in MySQL. No password_hash exposed in response.");

  // 5. Duplicate signup returns 409
  console.log("\n5. Verifying Duplicate Email Conflict (POST /api/auth/signup with same email)...");
  const resDupSignup = await fetch(`${baseUrl}/api/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Duplicate User",
      email: qaEmail,
      phone: "9123456789",
      password: "AnotherPassword123!",
    }),
  });
  const dataDupSignup = await resDupSignup.json();
  console.log("   Status:", resDupSignup.status, JSON.stringify(dataDupSignup));
  if (resDupSignup.status !== 409 || dataDupSignup.ok !== false) {
    throw new Error("Expected 409 Conflict for duplicate email");
  }
  console.log(`   ✓ Correctly returned 409 Conflict: "${dataDupSignup.error}"`);

  // 6. GET /api/auth/me with session cookie
  console.log("\n6. Verifying GET /api/auth/me with authenticated session cookie...");
  const resMeAuth = await fetch(`${baseUrl}/api/auth/me`, {
    headers: { Cookie: sessionCookie },
  });
  const dataMeAuth = await resMeAuth.json();
  console.log("   Status:", resMeAuth.status, JSON.stringify(dataMeAuth));
  if (!dataMeAuth.ok || dataMeAuth.user?.email !== qaEmail) {
    throw new Error(`Expected authenticated user ${qaEmail}, got: ${JSON.stringify(dataMeAuth)}`);
  }
  if (dataMeAuth.user.passwordHash || dataMeAuth.user.password_hash) {
    throw new Error("SECURITY ISSUE: password_hash leaked in /api/auth/me response!");
  }
  console.log(`   ✓ Correctly hydrated authenticated customer: "${dataMeAuth.user.fullName}" (${dataMeAuth.user.email})`);

  // 7. Verify UI pages load (GET /login, GET /signup, GET /account)
  console.log("\n7. Verifying Customer UI pages HTTP status...");
  const resLoginPage = await fetch(`${baseUrl}/login`);
  console.log("   GET /login ->", resLoginPage.status);
  if (resLoginPage.status !== 200) throw new Error("GET /login failed");

  const resSignupPage = await fetch(`${baseUrl}/signup`);
  console.log("   GET /signup ->", resSignupPage.status);
  if (resSignupPage.status !== 200) throw new Error("GET /signup failed");

  const resAccountPage = await fetch(`${baseUrl}/account`, {
    headers: { Cookie: sessionCookie },
  });
  console.log("   GET /account (authenticated) ->", resAccountPage.status);
  if (resAccountPage.status !== 200) throw new Error("GET /account failed");

  // 8. POST /api/auth/logout
  console.log("\n8. Verifying POST /api/auth/logout...");
  const resLogout = await fetch(`${baseUrl}/api/auth/logout`, {
    method: "POST",
    headers: { Cookie: sessionCookie },
  });
  const dataLogout = await resLogout.json();
  console.log("   Status:", resLogout.status, JSON.stringify(dataLogout));
  const logoutCookieHeader = resLogout.headers.get("set-cookie");
  console.log("   Set-Cookie clears dearr_session:", logoutCookieHeader?.includes("Max-Age=0") || logoutCookieHeader?.includes("expires="));
  if (!dataLogout.ok) {
    throw new Error("Logout failed");
  }
  console.log("   ✓ Logged out successfully");

  // 9. GET /api/auth/me after logout (using empty or cleared cookie)
  console.log("\n9. Verifying GET /api/auth/me after logout...");
  const resMeAfterLogout = await fetch(`${baseUrl}/api/auth/me`, {
    headers: { Cookie: "dearr_session=" },
  });
  const dataMeAfterLogout = await resMeAfterLogout.json();
  console.log("   Status:", resMeAfterLogout.status, JSON.stringify(dataMeAfterLogout));
  if (dataMeAfterLogout.ok !== false || dataMeAfterLogout.user !== null) {
    throw new Error("Expected unauthenticated after logout");
  }
  console.log("   ✓ Successfully verified unauthenticated state after logout");

  // 10. POST /api/auth/login with newly created user credentials
  console.log("\n10. Verifying Re-Login with QA customer credentials (POST /api/auth/login)...");
  const resReLogin = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: qaEmail,
      password: qaPassword,
    }),
  });
  const dataReLogin = await resReLogin.json();
  console.log("   Status:", resReLogin.status, JSON.stringify(dataReLogin));
  if (!dataReLogin.ok || dataReLogin.user?.id !== createdUserId) {
    throw new Error(`Re-login failed: ${JSON.stringify(dataReLogin)}`);
  }
  console.log(`   ✓ Successfully re-logged in: Welcome back ${dataReLogin.user.fullName}`);

  console.log("\n=================================================================");
  console.log("ALL B-06 VERIFICATION CHECKS PASSED LIVE ON LOCALHOST:3000!");
  console.log("=================================================================\n");
}

verifyLive()
  .then(async () => {
    // Clean up test user from MySQL
    console.log("Performing MySQL cleanup of temporary test user...");
    const mysql = await import("mysql2/promise");
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT || "3306", 10),
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
    });
    try {
      const [res] = await connection.execute("DELETE FROM profiles WHERE email LIKE 'qa_b06_test_%@dearr.test'");
      console.log(`✓ Cleaned up ${(res as any).affectedRows} temporary test user(s) from MySQL.`);
    } finally {
      await connection.end();
    }
    process.exit(0);
  })
  .catch(async (err) => {
    console.error("VERIFICATION FAILED:", err);
    try {
      const mysql = await import("mysql2/promise");
      const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        port: parseInt(process.env.DB_PORT || "3306", 10),
        database: process.env.DB_NAME,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
      });
      await connection.execute("DELETE FROM profiles WHERE email LIKE 'qa_b06_test_%@dearr.test'");
      await connection.end();
    } catch {}
    process.exit(1);
  });
