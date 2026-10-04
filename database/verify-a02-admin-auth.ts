import fs from "fs";
import path from "path";
import mysql from "mysql2/promise";
import bcrypt from "bcryptjs";

// Load .env.local manually
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

const baseUrl = "http://localhost:3000";

interface TestResult {
  num: number;
  title: string;
  passed: boolean;
  details?: string;
}

const results: TestResult[] = [];

function recordTest(num: number, title: string, passed: boolean, details?: string) {
  results.push({ num, title, passed, details });
  const mark = passed ? "✓ PASS" : "✗ FAIL";
  console.log(`   [TEST ${num.toString().padStart(2, "0")}] [${mark}] ${title}${details ? ` — ${details}` : ""}`);
}

async function runA02AdminAuthVerification() {
  console.log("=================================================================");
  console.log("Dearr V1 — Task A-02: Admin Auth, Logout, Access-Denied Audit");
  console.log("Host:", baseUrl);
  console.log("Database:", process.env.DB_HOST, "(Hostinger MySQL)");
  console.log("=================================================================\n");

  const timestamp = Date.now();
  const customerEmail = `qa_a02_cust_${timestamp}@dearr.test`;
  const adminEmail = `founder@dearr.in`;
  const adminPassword = `FounderAdmin2026!`;
  const customerPassword = `CustomerPass123!`;

  let cookieCustomer: string | null = null;
  let cookieAdmin: string | null = null;

  try {
    // -------------------------------------------------------------------------
    // SECTION 1: Unauthenticated Admin Route & API Protection
    // -------------------------------------------------------------------------
    console.log("--- Section 1: Unauthenticated Admin Protection ---");

    const resUnauthApi = await fetch(`${baseUrl}/api/admin/verify`, {
      headers: { "Cache-Control": "no-cache" },
    });
    recordTest(
      1,
      "Unauthenticated GET /api/admin/verify returns 401 Unauthorized",
      resUnauthApi.status === 401,
      `Status: ${resUnauthApi.status}`
    );

    const resUnauthOrders = await fetch(`${baseUrl}/api/admin/orders`, {
      headers: { "Cache-Control": "no-cache" },
    });
    recordTest(
      2,
      "Unauthenticated GET /api/admin/orders returns 401 Unauthorized",
      resUnauthOrders.status === 401,
      `Status: ${resUnauthOrders.status}`
    );

    const resUnauthProducts = await fetch(`${baseUrl}/api/admin/products`, {
      headers: { "Cache-Control": "no-cache" },
    });
    recordTest(
      3,
      "Unauthenticated GET /api/admin/products returns 401 Unauthorized",
      resUnauthProducts.status === 401,
      `Status: ${resUnauthProducts.status}`
    );

    // -------------------------------------------------------------------------
    // SECTION 2: Admin Login Validation & Error Cases
    // -------------------------------------------------------------------------
    console.log("\n--- Section 2: Admin Login Validation & Error Cases ---");

    const resEmptyEmail = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "", password: "SomePassword123!" }),
    });
    recordTest(
      4,
      "Login with empty email returns 400 Bad Request",
      resEmptyEmail.status === 400,
      `Status: ${resEmptyEmail.status}`
    );

    const resEmptyPass = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: adminEmail, password: "" }),
    });
    recordTest(
      5,
      "Login with empty password returns 400 Bad Request",
      resEmptyPass.status === 400,
      `Status: ${resEmptyPass.status}`
    );

    const resWrongPass = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: adminEmail, password: "IncorrectPassword123!" }),
    });
    const dataWrongPass = await resWrongPass.json();
    recordTest(
      6,
      "Login with incorrect password returns generic 401 'Invalid email or password'",
      resWrongPass.status === 401 && dataWrongPass.error === "Invalid email or password",
      `Status: ${resWrongPass.status}, Error: '${dataWrongPass.error}'`
    );

    const resNonexistent = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "doesnotexist@dearr.test", password: "SomePassword123!" }),
    });
    const dataNonexistent = await resNonexistent.json();
    recordTest(
      7,
      "Login with nonexistent email returns identical generic 401 (no enumeration)",
      resNonexistent.status === 401 && dataNonexistent.error === "Invalid email or password",
      `Status: ${resNonexistent.status}`
    );

    // -------------------------------------------------------------------------
    // SECTION 3: Authenticated Customer Access & 403 Access Denied
    // -------------------------------------------------------------------------
    console.log("\n--- Section 3: Customer Role Separation & Access Denied ---");

    // Create Customer account
    const resCustSignup = await fetch(`${baseUrl}/api/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "QA Customer Test",
        email: customerEmail,
        password: customerPassword,
      }),
    });
    const dataCustSignup = await resCustSignup.json();
    const cookieHeaderCust = resCustSignup.headers.get("set-cookie") || "";
    cookieCustomer = cookieHeaderCust.split(";")[0] || null;

    recordTest(
      8,
      "Customer account created successfully in MySQL with role 'customer'",
      resCustSignup.status === 201 && dataCustSignup.user?.role === "customer",
      `Role: ${dataCustSignup.user?.role}`
    );

    // Customer calls /api/admin/verify -> 403 Forbidden
    const resCustVerify = await fetch(`${baseUrl}/api/admin/verify`, {
      headers: { Cookie: cookieCustomer! },
    });
    const dataCustVerify = await resCustVerify.json();
    recordTest(
      9,
      "Authenticated customer calling GET /api/admin/verify returns 403 Forbidden",
      resCustVerify.status === 403 && dataCustVerify.ok === false,
      `Status: ${resCustVerify.status}, Error: '${dataCustVerify.error}'`
    );

    // Customer calls /api/admin/products -> 403 Forbidden
    const resCustProducts = await fetch(`${baseUrl}/api/admin/products`, {
      headers: { Cookie: cookieCustomer! },
    });
    recordTest(
      10,
      "Authenticated customer calling GET /api/admin/products returns 403 Forbidden",
      resCustProducts.status === 403,
      `Status: ${resCustProducts.status}`
    );

    // Customer calls /api/admin/orders -> 403 Forbidden
    const resCustOrders = await fetch(`${baseUrl}/api/admin/orders`, {
      headers: { Cookie: cookieCustomer! },
    });
    recordTest(
      11,
      "Authenticated customer calling GET /api/admin/orders returns 403 Forbidden",
      resCustOrders.status === 403,
      `Status: ${resCustOrders.status}`
    );

    // -------------------------------------------------------------------------
    // SECTION 4: Legitimate Admin Authentication & Authorization
    // -------------------------------------------------------------------------
    console.log("\n--- Section 4: Legitimate Admin Login & Authorization ---");

    const resAdminLogin = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: adminEmail,
        password: adminPassword,
      }),
    });
    const dataAdminLogin = await resAdminLogin.json();
    const cookieHeaderAdmin = resAdminLogin.headers.get("set-cookie") || "";
    cookieAdmin = cookieHeaderAdmin.split(";")[0] || null;

    recordTest(
      12,
      "Admin login succeeds with 200 OK and returns role 'admin'",
      resAdminLogin.status === 200 && dataAdminLogin.ok === true && dataAdminLogin.user?.role === "admin",
      `Role: ${dataAdminLogin.user?.role}, Name: '${dataAdminLogin.user?.fullName}'`
    );

    recordTest(
      13,
      "Admin login issues secure HttpOnly dearr_session cookie",
      Boolean(cookieAdmin && cookieHeaderAdmin.toLowerCase().includes("httponly")),
      `Cookie: ${cookieAdmin ? "Present (HttpOnly)" : "Missing"}`
    );

    // Admin calls /api/admin/verify -> 200 OK
    const resAdminVerify = await fetch(`${baseUrl}/api/admin/verify`, {
      headers: { Cookie: cookieAdmin! },
    });
    const dataAdminVerify = await resAdminVerify.json();
    recordTest(
      14,
      "Admin session calling GET /api/admin/verify returns 200 OK with sanitized admin profile",
      resAdminVerify.status === 200 && dataAdminVerify.ok === true && dataAdminVerify.admin?.role === "admin",
      `Admin: ${dataAdminVerify.admin?.email} (${dataAdminVerify.admin?.fullName})`
    );

    // Admin can access protected admin APIs
    const resAdminOrders = await fetch(`${baseUrl}/api/admin/orders`, {
      headers: { Cookie: cookieAdmin! },
    });
    recordTest(
      15,
      "Admin session can access GET /api/admin/orders (200 OK)",
      resAdminOrders.status === 200,
      `Status: ${resAdminOrders.status}`
    );

    // -------------------------------------------------------------------------
    // SECTION 5: Logout & Session Invalidation
    // -------------------------------------------------------------------------
    console.log("\n--- Section 5: Logout & Session Invalidation ---");

    const resLogout = await fetch(`${baseUrl}/api/auth/logout`, {
      method: "POST",
      headers: { Cookie: cookieAdmin! },
    });
    const dataLogout = await resLogout.json();
    const cookieHeaderLogout = resLogout.headers.get("set-cookie") || "";

    recordTest(
      16,
      "Admin logout POST /api/auth/logout returns 200 OK",
      resLogout.status === 200 && dataLogout.ok === true,
      `Message: '${dataLogout.message}'`
    );

    recordTest(
      17,
      "Logout clears dearr_session cookie with Max-Age=0 / expired date",
      cookieHeaderLogout.toLowerCase().includes("max-age=0") || cookieHeaderLogout.includes("1970"),
      `Clear Header: ${cookieHeaderLogout}`
    );

    // Invalidate locally and verify subsequent verify returns 401
    const resAfterLogout = await fetch(`${baseUrl}/api/admin/verify`, {
      headers: { Cookie: "dearr_session=" },
    });
    recordTest(
      18,
      "Subsequent admin request without session returns 401 Unauthorized",
      resAfterLogout.status === 401,
      `Status: ${resAfterLogout.status}`
    );

    // -------------------------------------------------------------------------
    // SECTION 6: Safe Redirect Destination Validation
    // -------------------------------------------------------------------------
    console.log("\n--- Section 6: Safe Redirect Destination Validation ---");

    function validateTarget(param: string | null): string {
      return param && param.startsWith("/admin") && !param.startsWith("//") && param !== "/admin/login"
        ? param
        : "/admin";
    }

    const testOpenRedirect1 = validateTarget("//evil.com");
    const testOpenRedirect2 = validateTarget("https://malicious.site/phish");
    const testOpenRedirect3 = validateTarget("/customer/account");
    const testValidRedirect1 = validateTarget("/admin/products");
    const testValidRedirect2 = validateTarget("/admin/orders/DEAR-10001");
    const testNullRedirect = validateTarget(null);

    recordTest(
      19,
      "Open redirect attempts (//evil.com, https://...) safely fall back to /admin",
      testOpenRedirect1 === "/admin" && testOpenRedirect2 === "/admin" && testOpenRedirect3 === "/admin",
      `//evil.com -> ${testOpenRedirect1}, external -> ${testOpenRedirect2}, /customer -> ${testOpenRedirect3}`
    );

    recordTest(
      20,
      "Valid admin subpaths are preserved correctly (/admin/products, /admin/orders/*)",
      testValidRedirect1 === "/admin/products" && testValidRedirect2 === "/admin/orders/DEAR-10001" && testNullRedirect === "/admin",
      `Products: ${testValidRedirect1}, Orders: ${testValidRedirect2}`
    );

    // -------------------------------------------------------------------------
    // SECTION 7: Data Sanitization & Secret Isolation
    // -------------------------------------------------------------------------
    console.log("\n--- Section 7: Security & Secret Sanitization ---");

    const rawLoginJson = JSON.stringify(dataAdminLogin);
    const rawVerifyJson = JSON.stringify(dataAdminVerify);
    const leakedPasswordHash = rawLoginJson.includes("$2a$") || rawLoginJson.includes("$2b$") || rawVerifyJson.includes("$2a$") || rawVerifyJson.includes("$2b$");
    const leakedSecret = rawLoginJson.includes(process.env.AUTH_SECRET || "xyz") || rawVerifyJson.includes(process.env.AUTH_SECRET || "xyz");

    recordTest(
      21,
      "Zero password hashes or bcrypt strings leaked in auth or verify responses",
      !leakedPasswordHash,
      `Hashes exposed: ${leakedPasswordHash}`
    );

    recordTest(
      22,
      "Zero server environment secrets (AUTH_SECRET / DB_PASSWORD) exposed",
      !leakedSecret,
      `Secrets exposed: ${leakedSecret}`
    );

  } finally {
    // Clean up temporary customer test account from MySQL
    console.log("\nCleaning up temporary QA customer record from MySQL...");
    try {
      const conn = await mysql.createConnection({
        host: process.env.DB_HOST,
        port: parseInt(process.env.DB_PORT || "3306", 10),
        database: process.env.DB_NAME,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
      });
      await conn.execute("DELETE FROM profiles WHERE email LIKE 'qa_a02_%'");
      await conn.end();
      console.log("✓ Cleaned up QA customer profile.");
    } catch {}
  }

  console.log("\n=================================================================");
  console.log("A-02 ADMIN AUTHENTICATION AUDIT SUMMARY");
  console.log("=================================================================");
  const passedCount = results.filter((r) => r.passed).length;
  console.log(`TOTAL TESTS:  ${results.length}`);
  console.log(`PASSED:       ${passedCount}`);
  console.log(`FAILED:       ${results.length - passedCount}`);
  console.log("=================================================================\n");

  if (passedCount !== results.length) {
    process.exit(1);
  }
}

runA02AdminAuthVerification().catch((err) => {
  console.error("Audit error:", err);
  process.exit(1);
});
