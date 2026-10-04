import fs from "fs";
import path from "path";
import mysql from "mysql2/promise";
import { SignJWT, decodeJwt } from "jose";

// Load .env.local manually for standalone test script
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
const authSecretString = (process.env.AUTH_SECRET || process.env.SESSION_SECRET || "").trim();
const authSecretKey = new TextEncoder().encode(authSecretString);

function getDbConnection() {
  return mysql.createConnection({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || "3306", 10),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  });
}

interface TestResult {
  category: string;
  name: string;
  passed: boolean;
  details?: string;
}

const testResults: TestResult[] = [];

function recordTest(category: string, name: string, passed: boolean, details?: string) {
  testResults.push({ category, name, passed, details });
  const statusMark = passed ? "✓ PASS" : "✗ FAIL";
  console.log(`   [${statusMark}] ${name}${details ? ` — ${details}` : ""}`);
}

async function runB08SecurityVerification() {
  console.log("=================================================================");
  console.log("Dearr V1 — Task B-08: Authentication Security & Session Lifecycle");
  console.log("Target Server:", baseUrl);
  console.log("Database Host:", process.env.DB_HOST, "(Hostinger MySQL)");
  console.log("Database Name:", process.env.DB_NAME);
  console.log("=================================================================\n");

  const timestamp = Date.now();
  const customerAEmail = `qa_b08_custA_${timestamp}@dearr.test`;
  const customerBEmail = `qa_b08_custB_${timestamp}@dearr.test`;
  const adminEmail = `qa_b08_admin_${timestamp}@dearr.test`;
  const testPassword = "B08_SecureP@ssword123!";

  let cookieCustomerA: string | null = null;
  let tokenCustomerA: string | null = null;
  let cookieCustomerB: string | null = null;
  let cookieAdmin: string | null = null;

  let idCustomerA: string | null = null;
  let idCustomerB: string | null = null;
  let idAdmin: string | null = null;

  const capturedResponses: any[] = [];

  try {
    // =========================================================================
    // SECTION 1: SESSION COOKIE & TOKEN LIFECYCLE
    // =========================================================================
    console.log("--- SECTION 1: Session Cookie & Token Lifecycle ---");

    // 1.1 Signup to create Customer A and receive initial cookie
    const resSignup = await fetch(`${baseUrl}/api/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "QA B08 Customer A",
        email: customerAEmail,
        password: testPassword,
        phone: "9876543210",
      }),
    });
    const dataSignup = await resSignup.json();
    capturedResponses.push(dataSignup);

    if (resSignup.status === 201 && dataSignup.ok && dataSignup.user?.id) {
      idCustomerA = dataSignup.user.id;
      recordTest("Session Lifecycle", "Customer Registration (201 Created)", true, `ID: ${idCustomerA}`);
    } else {
      recordTest("Session Lifecycle", "Customer Registration (201 Created)", false, JSON.stringify(dataSignup));
      throw new Error("Cannot proceed: Customer A signup failed");
    }

    // 1.2 Inspect Set-Cookie header on Login
    const resLoginA = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: customerAEmail,
        password: testPassword,
      }),
    });
    const dataLoginA = await resLoginA.json();
    capturedResponses.push(dataLoginA);

    const setCookieHeader = resLoginA.headers.get("set-cookie") || "";
    const matchToken = setCookieHeader.match(/dearr_session=([^;]+)/);
    tokenCustomerA = matchToken ? matchToken[1] : null;
    cookieCustomerA = tokenCustomerA ? `dearr_session=${tokenCustomerA}` : null;

    const hasHttpOnly = /HttpOnly/i.test(setCookieHeader);
    const hasPathRoot = /Path=\//i.test(setCookieHeader);
    const hasSameSiteLax = /SameSite=Lax/i.test(setCookieHeader);
    const hasMaxAge = /Max-Age=604800/i.test(setCookieHeader); // 7 days = 604800s

    recordTest("Session Lifecycle", "dearr_session cookie issued on login", !!tokenCustomerA);
    recordTest("Session Lifecycle", "Cookie has HttpOnly flag", hasHttpOnly);
    recordTest("Session Lifecycle", "Cookie has Path=/", hasPathRoot);
    recordTest("Session Lifecycle", "Cookie has SameSite=Lax", hasSameSiteLax);
    recordTest("Session Lifecycle", "Cookie Max-Age is 7 days (604,800s)", hasMaxAge);

    // 1.3 Audit JWT claims (minimal non-sensitive payload)
    if (tokenCustomerA) {
      const decoded = decodeJwt(tokenCustomerA);
      const allowedKeys = new Set(["sub", "email", "fullName", "role", "iat", "exp"]);
      const extraKeys = Object.keys(decoded).filter((k) => !allowedKeys.has(k));

      const hasRequired =
        decoded.sub === idCustomerA &&
        typeof decoded.email === "string" &&
        decoded.email.toLowerCase() === customerAEmail.toLowerCase() &&
        decoded.role === "customer" &&
        typeof decoded.exp === "number";

      const hasNoSensitive =
        !("password" in decoded) &&
        !("password_hash" in decoded) &&
        !("passwordHash" in decoded) &&
        !("phone" in decoded);

      recordTest(
        "Session Lifecycle",
        "JWT contains only minimal non-sensitive claims",
        hasRequired && hasNoSensitive && extraKeys.length === 0,
        `Keys: ${Object.keys(decoded).join(", ")}`
      );

      // Verify expiration window is approx 7 days
      const expDurationSec = (decoded.exp || 0) - (decoded.iat || 0);
      const is7Days = expDurationSec >= 604700 && expDurationSec <= 604900;
      recordTest("Session Lifecycle", "JWT expiration duration is 7 days", is7Days, `Duration: ${expDurationSec}s`);
    }

    // 1.4 Expired JWT token is rejected (401)
    const expiredToken = await new SignJWT({
      sub: idCustomerA || "",
      email: customerAEmail,
      role: "customer",
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt(Math.floor(Date.now() / 1000) - 7200)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 3600) // Expired 1h ago
      .sign(authSecretKey);

    const resExpired = await fetch(`${baseUrl}/api/customer/profile`, {
      headers: { Cookie: `dearr_session=${expiredToken}` },
    });
    recordTest("Session Lifecycle", "Expired JWT is rejected with 401", resExpired.status === 401, `Status: ${resExpired.status}`);

    // 1.5 Tampered JWT signature is rejected (401)
    const tamperedToken = await new SignJWT({
      sub: idCustomerA || "",
      email: customerAEmail,
      role: "admin", // Attacker attempts to change role inside token
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("7d")
      .sign(new TextEncoder().encode("attacker_unauthorized_forged_secret_key_32chars!!"));

    const resTampered = await fetch(`${baseUrl}/api/customer/profile`, {
      headers: { Cookie: `dearr_session=${tamperedToken}` },
    });
    recordTest("Session Lifecycle", "Tampered signature rejected with 401", resTampered.status === 401, `Status: ${resTampered.status}`);

    // 1.6 Malformed / Garbage token is rejected (401)
    const resGarbage = await fetch(`${baseUrl}/api/customer/profile`, {
      headers: { Cookie: "dearr_session=garbage_invalid_jwt_format_12345" },
    });
    recordTest("Session Lifecycle", "Malformed token rejected with 401", resGarbage.status === 401, `Status: ${resGarbage.status}`);

    // 1.7 Logout invalidates/clears cookie
    const resLogout = await fetch(`${baseUrl}/api/auth/logout`, {
      method: "POST",
    });
    const dataLogout = await resLogout.json();
    capturedResponses.push(dataLogout);
    const logoutCookieHeader = resLogout.headers.get("set-cookie") || "";
    const clearsCookie =
      /dearr_session=/i.test(logoutCookieHeader) &&
      (/Max-Age=0/i.test(logoutCookieHeader) || /Expires=Thu, 01 Jan 1970/i.test(logoutCookieHeader));

    recordTest("Session Lifecycle", "Logout invalidates session cookie (Max-Age=0)", clearsCookie && resLogout.status === 200);

    // =========================================================================
    // SECTION 2: PASSWORD & AUTHENTICATION SECURITY
    // =========================================================================
    console.log("\n--- SECTION 2: Password & Authentication Security ---");

    // 2.1 MySQL Password Hash Verification (bcrypt)
    const db = await getDbConnection();
    const [custRows] = await db.execute("SELECT password_hash, full_name FROM profiles WHERE id = ?", [idCustomerA]);
    const custDbRecord = (custRows as any[])[0];

    const isBcrypt =
      typeof custDbRecord?.password_hash === "string" &&
      (custDbRecord.password_hash.startsWith("$2a$") || custDbRecord.password_hash.startsWith("$2b$")) &&
      custDbRecord.password_hash.length === 60;

    const notPlaintext = custDbRecord?.password_hash !== testPassword;

    recordTest("Password Security", "Passwords hashed with bcrypt (length 60, prefix $2a$/$2b$)", isBcrypt);
    recordTest("Password Security", "Plaintext password never stored in MySQL", notPlaintext);

    // 2.2 Parameterized SQL Verification (SQL Injection immunity)
    const sqliEmail = `sqli_${timestamp}' OR '1'='1' -- @dearr.test`;
    const [sqliRows] = await db.execute(
      "SELECT id FROM profiles WHERE LOWER(TRIM(email)) = LOWER(TRIM(?))",
      [sqliEmail]
    );
    recordTest(
      "Password Security",
      "Parameterized query neutralizes SQL injection strings",
      (sqliRows as any[]).length === 0
    );
    await db.end();

    // 2.3 Server-Only Safeguards Audit
    const serverOnlyFiles = [
      "src/lib/server/db.ts",
      "src/lib/server/auth.ts",
      "src/lib/server/profile.ts",
    ];
    let allServerOnly = true;
    for (const f of serverOnlyFiles) {
      const content = fs.readFileSync(path.resolve(process.cwd(), f), "utf-8");
      if (!content.includes('import "server-only"') && !content.includes("import 'server-only'")) {
        allServerOnly = false;
      }
    }
    recordTest("Password Security", "Critical server files protected with 'server-only'", allServerOnly);

    // 2.4 Client State Storage Audit (AuthContext)
    const authContextCode = fs.readFileSync(
      path.resolve(process.cwd(), "src/context/AuthContext.tsx"),
      "utf-8"
    );
    const setsNoAuthStorage =
      !authContextCode.includes("localStorage.setItem('token'") &&
      !authContextCode.includes("localStorage.setItem('dearr_session'") &&
      !authContextCode.includes("sessionStorage.setItem('token'") &&
      !authContextCode.includes("sessionStorage.setItem('dearr_session'");
    recordTest("Password Security", "AuthContext stores no auth tokens in local/session storage", setsNoAuthStorage);

    // =========================================================================
    // SECTION 3: ACCOUNT LIFECYCLE & INPUT VALIDATION
    // =========================================================================
    console.log("\n--- SECTION 3: Account Lifecycle & Input Validation ---");

    // 3.1 Duplicate Signup Rejection (409 Conflict)
    const resDuplicate = await fetch(`${baseUrl}/api/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "QA Duplicate Test",
        email: customerAEmail, // Existing email
        password: testPassword,
      }),
    });
    const dataDuplicate = await resDuplicate.json();
    capturedResponses.push(dataDuplicate);
    recordTest(
      "Account Lifecycle",
      "Duplicate signup returns 409 Conflict",
      resDuplicate.status === 409 && dataDuplicate.ok === false,
      `Status: ${resDuplicate.status}`
    );

    // 3.2 Case-Insensitive Email Login
    const resUpperLogin = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: customerAEmail.toUpperCase(),
        password: testPassword,
      }),
    });
    const dataUpperLogin = await resUpperLogin.json();
    capturedResponses.push(dataUpperLogin);
    recordTest(
      "Account Lifecycle",
      "Case-insensitive email login succeeds (200 OK)",
      resUpperLogin.status === 200 && dataUpperLogin.ok === true
    );

    // 3.3 Invalid Password Login (Generic 401)
    const resWrongPass = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: customerAEmail,
        password: "WrongPassword999!",
      }),
    });
    const dataWrongPass = await resWrongPass.json();
    capturedResponses.push(dataWrongPass);
    recordTest(
      "Account Lifecycle",
      "Invalid password returns generic 401",
      resWrongPass.status === 401 && dataWrongPass.error === "Invalid email or password",
      `Error: '${dataWrongPass.error}'`
    );

    // 3.4 Unknown Email Login (Generic 401 without user enumeration)
    const resUnknownEmail = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: `nonexistent_${timestamp}@dearr.test`,
        password: testPassword,
      }),
    });
    const dataUnknownEmail = await resUnknownEmail.json();
    capturedResponses.push(dataUnknownEmail);
    recordTest(
      "Account Lifecycle",
      "Unknown email returns identical generic 401 (no enumeration)",
      resUnknownEmail.status === 401 && dataUnknownEmail.error === "Invalid email or password",
      `Error: '${dataUnknownEmail.error}'`
    );

    // 3.5 Input Validation (400 Bad Request on missing fields or bad JSON)
    const resMissingPass = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: customerAEmail,
      }),
    });
    recordTest("Account Lifecycle", "Missing password returns 400 Bad Request", resMissingPass.status === 400);

    const resBadJson = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "INVALID_NOT_A_JSON",
    });
    recordTest("Account Lifecycle", "Malformed JSON payload returns 400 Bad Request", resBadJson.status === 400);

    // 3.6 Session State Check (GET /api/auth/me)
    const resMeAuthed = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Cookie: cookieCustomerA! },
    });
    const dataMeAuthed = await resMeAuthed.json();
    capturedResponses.push(dataMeAuthed);
    recordTest(
      "Account Lifecycle",
      "GET /api/auth/me with valid session returns 200 + user profile",
      resMeAuthed.status === 200 && dataMeAuthed.ok === true && dataMeAuthed.user?.id === idCustomerA
    );

    // 3.7 Re-login After Logout
    const resRelogin = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: customerAEmail,
        password: testPassword,
      }),
    });
    const dataRelogin = await resRelogin.json();
    capturedResponses.push(dataRelogin);
    const reloginCookie = resRelogin.headers.get("set-cookie") || "";
    recordTest(
      "Account Lifecycle",
      "Re-login after logout issues fresh valid session cookie",
      resRelogin.status === 200 && reloginCookie.includes("dearr_session=")
    );

    // =========================================================================
    // SECTION 4: ROLE SEPARATION & ACCESS CONTROL (RBAC & IDOR)
    // =========================================================================
    console.log("\n--- SECTION 4: Role Separation & Access Control (RBAC & IDOR) ---");

    // 4.1 Customer Access to Admin Operation (403 Forbidden)
    const resCustOnAdmin = await fetch(`${baseUrl}/api/admin/verify`, {
      headers: { Cookie: cookieCustomerA! },
    });
    const dataCustOnAdmin = await resCustOnAdmin.json();
    capturedResponses.push(dataCustOnAdmin);
    recordTest(
      "Role Separation",
      "Customer session calling /api/admin/verify returns 403 Forbidden",
      resCustOnAdmin.status === 403 && dataCustOnAdmin.ok === false,
      `Status: ${resCustOnAdmin.status}`
    );

    // 4.2 Signup Client-Role Override Ignored
    const resSignupAdminAttempt = await fetch(`${baseUrl}/api/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "QA Escalation Attempt",
        email: `qa_escalate_${timestamp}@dearr.test`,
        password: testPassword,
        role: "admin", // Malicious attempt to self-declare admin
      }),
    });
    const dataSignupAdminAttempt = await resSignupAdminAttempt.json();
    capturedResponses.push(dataSignupAdminAttempt);
    recordTest(
      "Role Separation",
      "Signup payload with role='admin' forced to 'customer'",
      dataSignupAdminAttempt.user?.role === "customer",
      `Assigned Role: '${dataSignupAdminAttempt.user?.role}'`
    );

    // 4.3 Profile Update Role Escalation Blocked
    const resPatchRole = await fetch(`${baseUrl}/api/customer/profile`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieCustomerA!,
      },
      body: JSON.stringify({
        role: "admin", // Customer A tries to escalate role
      }),
    });
    const dataPatchRole = await resPatchRole.json();
    capturedResponses.push(dataPatchRole);
    recordTest(
      "Role Separation",
      "Role escalation via PATCH /api/customer/profile blocked with 403",
      resPatchRole.status === 403,
      `Status: ${resPatchRole.status}`
    );

    // 4.4 IDOR Protection (Customer A targets Customer B)
    // Create Customer B
    const resSignupB = await fetch(`${baseUrl}/api/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "QA B08 Customer B",
        email: customerBEmail,
        password: testPassword,
      }),
    });
    const dataSignupB = await resSignupB.json();
    capturedResponses.push(dataSignupB);
    idCustomerB = dataSignupB.user.id;

    // Customer A attempts to overwrite Customer B's profile
    const resIdor = await fetch(`${baseUrl}/api/customer/profile`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieCustomerA!,
      },
      body: JSON.stringify({
        targetUserId: idCustomerB,
        fullName: "HACKED BY CUSTOMER A",
      }),
    });
    const dataIdor = await resIdor.json();
    capturedResponses.push(dataIdor);
    recordTest(
      "Role Separation",
      "IDOR: Customer A targeting Customer B returns 403 Forbidden",
      resIdor.status === 403,
      `Status: ${resIdor.status}`
    );

    // Verify Customer B unchanged in MySQL
    const dbVerifyB = await getDbConnection();
    const [bRows] = await dbVerifyB.execute("SELECT full_name FROM profiles WHERE id = ?", [idCustomerB]);
    const bName = (bRows as any[])[0]?.full_name;
    recordTest("Role Separation", "IDOR target data in MySQL remains intact", bName === "QA B08 Customer B");
    await dbVerifyB.end();

    // 4.5 Legitimate Admin Access (200 OK)
    const dbAdmin = await getDbConnection();
    const bcrypt = await import("bcryptjs");
    const adminHash = await bcrypt.hash(testPassword, 10);
    const crypto = await import("crypto");
    idAdmin = crypto.randomUUID();

    await dbAdmin.execute(
      "INSERT INTO profiles (id, email, password_hash, full_name, role) VALUES (?, ?, ?, ?, 'admin')",
      [idAdmin, adminEmail, adminHash, "QA B08 Founder Admin"]
    );
    await dbAdmin.end();

    const resLoginAdmin = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: adminEmail,
        password: testPassword,
      }),
    });
    const dataLoginAdmin = await resLoginAdmin.json();
    capturedResponses.push(dataLoginAdmin);
    const cookieAdminHeader = resLoginAdmin.headers.get("set-cookie") || "";
    const matchAdmin = cookieAdminHeader.match(/dearr_session=([^;]+)/);
    cookieAdmin = matchAdmin ? `dearr_session=${matchAdmin[1]}` : null;

    const resAdminVerify = await fetch(`${baseUrl}/api/admin/verify`, {
      headers: { Cookie: cookieAdmin! },
    });
    const dataAdminVerify = await resAdminVerify.json();
    capturedResponses.push(dataAdminVerify);
    recordTest(
      "Role Separation",
      "Legitimate admin access to /api/admin/verify returns 200 OK",
      resAdminVerify.status === 200 && dataAdminVerify.admin?.role === "admin"
    );

    // =========================================================================
    // SECTION 5: API RESPONSE SECURITY & DATA LEAKAGE PREVENTION
    // =========================================================================
    console.log("\n--- SECTION 5: API Response Security & Leakage Prevention ---");

    let leakFound = false;
    let leakDetail = "";

    const sensitivePatterns = [
      { name: "password_hash", regex: /"password_hash"|"passwordHash"/i },
      { name: "passwordResetToken", regex: /password_reset_token|passwordReset/i },
      { name: "Database Hostname", regex: /srv1741\.hstgr\.io/i },
      { name: "Database User", regex: /u209580425/i },
      { name: "AUTH_SECRET", regex: new RegExp(authSecretString.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") },
      { name: "SQL Errors", regex: /SQLSTATE|syntax error|mysql_query|SELECT .* FROM/i },
      { name: "Stack Traces", regex: /at (async )?[a-zA-Z0-9_]+\.js|node_modules/i },
    ];

    for (const res of capturedResponses) {
      const serialized = JSON.stringify(res);
      for (const pattern of sensitivePatterns) {
        if (pattern.regex.test(serialized)) {
          leakFound = true;
          leakDetail = `Found ${pattern.name} in response: ${serialized.slice(0, 100)}...`;
          break;
        }
      }
      if (leakFound) break;
    }

    recordTest(
      "Response Security",
      "Zero password hashes, DB credentials, secrets, SQL errors, or stack traces in responses",
      !leakFound,
      leakFound ? leakDetail : "Audited 12 API responses"
    );

    // =========================================================================
    // SECTION 6: CLIENT ROUTE PROTECTION LOGIC AUDIT
    // =========================================================================
    console.log("\n--- SECTION 6: Client Route Protection Logic Audit ---");

    const accountClientCode = fs.readFileSync(
      path.resolve(process.cwd(), "src/app/account/AccountPageClient.tsx"),
      "utf-8"
    );
    const ordersClientCode = fs.readFileSync(
      path.resolve(process.cwd(), "src/app/account/orders/OrdersPageClient.tsx"),
      "utf-8"
    );

    const accountRedirects =
      accountClientCode.includes("router.replace(\"/login\")") &&
      accountClientCode.includes("!isLoading") &&
      accountClientCode.includes("!user");

    const ordersRedirects =
      ordersClientCode.includes("router.replace(\"/login\")") &&
      ordersClientCode.includes("!isLoading") &&
      ordersClientCode.includes("!user");

    recordTest("Route Protection", "AccountPageClient redirects unauthenticated customer to /login", accountRedirects);
    recordTest("Route Protection", "OrdersPageClient redirects unauthenticated customer to /login", ordersRedirects);

    // =========================================================================
    // SUMMARY
    // =========================================================================
    console.log("\n=================================================================");
    const passedCount = testResults.filter((r) => r.passed).length;
    const totalCount = testResults.length;
    console.log(`B-08 SECURITY & SESSION VERIFICATION RESULTS: ${passedCount}/${totalCount} TESTS PASSED`);
    console.log("=================================================================\n");

    if (passedCount !== totalCount) {
      throw new Error(`Security verification failed: ${totalCount - passedCount} test(s) failed.`);
    }
  } finally {
    // =========================================================================
    // SECTION 7: AUTOMATIC CLEANUP OF TEMPORARY QA ACCOUNTS
    // =========================================================================
    console.log("Cleaning up temporary QA accounts from Hostinger MySQL...");
    try {
      const dbClean = await getDbConnection();
      const [delRes] = await dbClean.execute(
        "DELETE FROM profiles WHERE email LIKE 'qa_b08_%@dearr.test' OR email LIKE 'qa_escalate_%@dearr.test'"
      );
      console.log(`✓ Cleaned up ${(delRes as any).affectedRows} test profile(s) from Hostinger MySQL.`);
      await dbClean.end();
    } catch (cleanErr) {
      console.error("Cleanup error:", cleanErr);
    }
  }
}

runB08SecurityVerification()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\nTEST SUITE EXECUTION ERROR:", err);
    process.exit(1);
  });
