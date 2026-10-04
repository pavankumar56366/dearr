import fs from "fs";
import path from "path";
import mysql from "mysql2/promise";
import { SignJWT } from "jose";

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
const authSecretKey = new TextEncoder().encode((process.env.AUTH_SECRET || process.env.SESSION_SECRET || "").trim());

function getDbConnection() {
  return mysql.createConnection({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || "3306", 10),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  });
}

async function runB07Audit() {
  console.log("=================================================================");
  console.log("Dearr V1 — Task B-07: Server-Side Authorization & Role Audit");
  console.log("Host:", baseUrl);
  console.log("Database:", process.env.DB_HOST, "(Hostinger MySQL)");
  console.log("=================================================================\n");

  const timestamp = Date.now();
  const customerAEmail = `qa_b07_custA_${timestamp}@dearr.test`;
  const customerBEmail = `qa_b07_custB_${timestamp}@dearr.test`;
  const adminEmail = `qa_b07_admin_${timestamp}@dearr.test`;
  const testPassword = "SecurePassword123!";

  let cookieCustomerA: string | null = null;
  let cookieCustomerB: string | null = null;
  let cookieAdmin: string | null = null;

  let idCustomerA: string | null = null;
  let idCustomerB: string | null = null;
  let idAdmin: string | null = null;

  try {
    // -------------------------------------------------------------------------
    // TEST 1: Unauthenticated Access to Protected Routes (Expect 401)
    // -------------------------------------------------------------------------
    console.log("1. AUDIT requireUser(): Unauthenticated access rejection (401)...");

    const resUnauthCust = await fetch(`${baseUrl}/api/customer/profile`);
    const dataUnauthCust = await resUnauthCust.json();
    console.log("   GET /api/customer/profile -> status:", resUnauthCust.status, dataUnauthCust.error);
    if (resUnauthCust.status !== 401 || dataUnauthCust.ok !== false) {
      throw new Error(`Expected 401 Unauthorized, got ${resUnauthCust.status}`);
    }
    console.log("   ✓ Unauthenticated customer route correctly returned 401");

    const resUnauthAdmin = await fetch(`${baseUrl}/api/admin/verify`);
    const dataUnauthAdmin = await resUnauthAdmin.json();
    console.log("   GET /api/admin/verify -> status:", resUnauthAdmin.status, dataUnauthAdmin.error);
    if (resUnauthAdmin.status !== 401 || dataUnauthAdmin.ok !== false) {
      throw new Error(`Expected 401 Unauthorized for admin route, got ${resUnauthAdmin.status}`);
    }
    console.log("   ✓ Unauthenticated admin route correctly returned 401");

    // -------------------------------------------------------------------------
    // TEST 2: Tampered & Expired JWT Tokens (Expect 401)
    // -------------------------------------------------------------------------
    console.log("\n2. AUDIT JWT/Session Claims: Tampered & Expired token rejection...");

    // A. Forged token with invalid signature
    const forgedToken = await new SignJWT({
      sub: "00000000-0000-0000-0000-000000000000",
      email: "hacker@dearr.test",
      role: "admin",
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("2h")
      .sign(new TextEncoder().encode("wrong_attacker_secret_key_12345678901234567890"));

    const resForged = await fetch(`${baseUrl}/api/admin/verify`, {
      headers: { Cookie: `dearr_session=${forgedToken}` },
    });
    console.log("   GET /api/admin/verify with forged signature -> status:", resForged.status);
    if (resForged.status !== 401) {
      throw new Error(`Expected 401 for forged token, got ${resForged.status}`);
    }
    console.log("   ✓ Forged/tampered signature rejected with 401");

    // B. Expired token
    const expiredToken = await new SignJWT({
      sub: "00000000-0000-0000-0000-000000000000",
      email: "expired@dearr.test",
      role: "customer",
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt(Math.floor(Date.now() / 1000) - 7200)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 3600) // expired 1h ago
      .sign(authSecretKey);

    const resExpired = await fetch(`${baseUrl}/api/customer/profile`, {
      headers: { Cookie: `dearr_session=${expiredToken}` },
    });
    console.log("   GET /api/customer/profile with expired token -> status:", resExpired.status);
    if (resExpired.status !== 401) {
      throw new Error(`Expected 401 for expired token, got ${resExpired.status}`);
    }
    console.log("   ✓ Expired token rejected with 401");

    // -------------------------------------------------------------------------
    // TEST 3: Signup Role Escalation Prevention
    // -------------------------------------------------------------------------
    console.log("\n3. AUDIT Role Escalation in Signup (Attempt { role: 'admin' })...");

    const resSignupA = await fetch(`${baseUrl}/api/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "QA Customer A",
        email: customerAEmail,
        phone: "9876543210",
        password: testPassword,
        role: "admin", // Attacker passes role: 'admin'
      }),
    });
    const dataSignupA = await resSignupA.json();
    if (resSignupA.status !== 201 || !dataSignupA.ok) {
      throw new Error(`Customer A signup failed: ${JSON.stringify(dataSignupA)}`);
    }
    idCustomerA = dataSignupA.user.id;
    const cookieHeaderA = resSignupA.headers.get("set-cookie") || "";
    const matchA = cookieHeaderA.match(/dearr_session=([^;]+)/);
    cookieCustomerA = matchA ? `dearr_session=${matchA[1]}` : null;

    // Verify role in returned payload
    console.log("   API returned role:", dataSignupA.user.role);
    if (dataSignupA.user.role !== "customer") {
      throw new Error(`ROLE ESCALATION BREACH: User was assigned role '${dataSignupA.user.role}' instead of 'customer'!`);
    }

    // Verify role in MySQL directly
    const db = await getDbConnection();
    const [rowsA] = await db.execute("SELECT role, password_hash FROM profiles WHERE id = ?", [idCustomerA]);
    const userDbA = (rowsA as any[])[0];
    await db.end();

    console.log("   MySQL database record role:", userDbA.role);
    if (userDbA.role !== "customer") {
      throw new Error(`ROLE ESCALATION BREACH: MySQL record has role '${userDbA.role}'!`);
    }
    console.log("   ✓ Signup role escalation attempt successfully neutralized (persisted as 'customer')");

    // Create Customer B for IDOR testing
    console.log("\n4. Creating Customer B for IDOR testing...");
    const resSignupB = await fetch(`${baseUrl}/api/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "QA Customer B",
        email: customerBEmail,
        phone: "9123456780",
        password: testPassword,
      }),
    });
    const dataSignupB = await resSignupB.json();
    idCustomerB = dataSignupB.user.id;
    const cookieHeaderB = resSignupB.headers.get("set-cookie") || "";
    const matchB = cookieHeaderB.match(/dearr_session=([^;]+)/);
    cookieCustomerB = matchB ? `dearr_session=${matchB[1]}` : null;
    console.log("   ✓ Customer B created with ID:", idCustomerB);

    // -------------------------------------------------------------------------
    // TEST 5: Customer Self-Service Profile Operation
    // -------------------------------------------------------------------------
    console.log("\n5. Testing Authorized Customer Profile Operations...");
    const resGetProfileA = await fetch(`${baseUrl}/api/customer/profile`, {
      headers: { Cookie: cookieCustomerA! },
    });
    const dataGetProfileA = await resGetProfileA.json();
    console.log("   GET /api/customer/profile (Customer A) -> status:", resGetProfileA.status, dataGetProfileA.profile.fullName);
    if (resGetProfileA.status !== 200 || dataGetProfileA.profile.id !== idCustomerA) {
      throw new Error("Customer A could not read own profile");
    }
    console.log("   ✓ Customer A successfully read own profile");

    // -------------------------------------------------------------------------
    // TEST 6: IDOR Protection Test (Customer A attempts to modify Customer B)
    // -------------------------------------------------------------------------
    console.log("\n6. AUDIT IDOR Protection: Customer A attempts to modify Customer B's profile...");
    const resIdor = await fetch(`${baseUrl}/api/customer/profile`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieCustomerA!,
      },
      body: JSON.stringify({
        targetUserId: idCustomerB, // IDOR attack target
        fullName: "HACKED By Customer A",
      }),
    });
    const dataIdor = await resIdor.json();
    console.log("   PATCH /api/customer/profile (target = Customer B) -> status:", resIdor.status, dataIdor.error);
    if (resIdor.status !== 403 || dataIdor.ok !== false) {
      throw new Error(`IDOR VULNERABILITY: Expected 403 Forbidden, got ${resIdor.status}`);
    }

    // Verify Customer B was NOT modified in MySQL
    const dbB = await getDbConnection();
    const [rowsB] = await dbB.execute("SELECT full_name FROM profiles WHERE id = ?", [idCustomerB]);
    const userDbB = (rowsB as any[])[0];
    await dbB.end();
    if (userDbB.full_name === "HACKED By Customer A") {
      throw new Error("IDOR VULNERABILITY: Customer B profile was modified by Customer A!");
    }
    console.log("   ✓ IDOR attack blocked with 403 Forbidden. Target record intact:", userDbB.full_name);

    // -------------------------------------------------------------------------
    // TEST 7: Role Escalation via Profile Update
    // -------------------------------------------------------------------------
    console.log("\n7. AUDIT Role Escalation in Profile Update (Customer A attempts role: 'admin')...");
    const resEscalate = await fetch(`${baseUrl}/api/customer/profile`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieCustomerA!,
      },
      body: JSON.stringify({
        fullName: "Customer A Updated",
        role: "admin", // Attacker attempts to change role to admin
      }),
    });
    const dataEscalate = await resEscalate.json();
    console.log("   PATCH /api/customer/profile (role: 'admin') -> status:", resEscalate.status, dataEscalate.error);
    if (resEscalate.status !== 403 || dataEscalate.ok !== false) {
      throw new Error(`ROLE ESCALATION VULNERABILITY: Expected 403, got ${resEscalate.status}`);
    }

    // Double-check MySQL role
    const dbCheck = await getDbConnection();
    const [rowsCheck] = await dbCheck.execute("SELECT role FROM profiles WHERE id = ?", [idCustomerA]);
    const roleAfter = (rowsCheck as any[])[0].role;
    await dbCheck.end();
    if (roleAfter !== "customer") {
      throw new Error(`ROLE ESCALATION BREACH: Customer A role changed to '${roleAfter}'!`);
    }
    console.log("   ✓ Role escalation blocked with 403 Forbidden. Role remains:", roleAfter);

    // -------------------------------------------------------------------------
    // TEST 8: Customer Access to Admin Operation (Expect 403 Forbidden)
    // -------------------------------------------------------------------------
    console.log("\n8. AUDIT requireAdmin(): Customer session calling admin endpoint...");
    const resCustOnAdmin = await fetch(`${baseUrl}/api/admin/verify`, {
      headers: { Cookie: cookieCustomerA! },
    });
    const dataCustOnAdmin = await resCustOnAdmin.json();
    console.log("   GET /api/admin/verify (Customer session) -> status:", resCustOnAdmin.status, dataCustOnAdmin.error);
    if (resCustOnAdmin.status !== 403 || dataCustOnAdmin.ok !== false) {
      throw new Error(`ADMIN BYPASS VULNERABILITY: Customer was allowed into admin! Got ${resCustOnAdmin.status}`);
    }
    console.log("   ✓ Customer access to admin correctly rejected with 403 Forbidden");

    // -------------------------------------------------------------------------
    // TEST 9: Legitimate Admin Access to Admin Operation (Expect 200 OK)
    // -------------------------------------------------------------------------
    console.log("\n9. AUDIT requireAdmin(): Legitimate admin access...");
    // Create admin user in MySQL directly (with role = 'admin')
    const dbAdmin = await getDbConnection();
    const bcrypt = await import("bcryptjs");
    const hash = await bcrypt.hash(testPassword, 10);
    const crypto = await import("crypto");
    idAdmin = crypto.randomUUID();

    await dbAdmin.execute(
      "INSERT INTO profiles (id, email, password_hash, full_name, role) VALUES (?, ?, ?, ?, 'admin')",
      [idAdmin, adminEmail, hash, "QA Founder Admin"]
    );
    await dbAdmin.end();
    console.log("   ✓ Admin record seeded in MySQL with role = 'admin', id:", idAdmin);

    // Login as Admin
    const resLoginAdmin = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: adminEmail,
        password: testPassword,
      }),
    });
    const dataLoginAdmin = await resLoginAdmin.json();
    if (!dataLoginAdmin.ok || dataLoginAdmin.user.role !== "admin") {
      throw new Error("Admin login failed");
    }
    const cookieHeaderAdmin = resLoginAdmin.headers.get("set-cookie") || "";
    const matchAdmin = cookieHeaderAdmin.match(/dearr_session=([^;]+)/);
    cookieAdmin = matchAdmin ? `dearr_session=${matchAdmin[1]}` : null;
    console.log("   ✓ Admin session cookie acquired");

    // Call GET /api/admin/verify with Admin session
    const resAdminVerify = await fetch(`${baseUrl}/api/admin/verify`, {
      headers: { Cookie: cookieAdmin! },
    });
    const dataAdminVerify = await resAdminVerify.json();
    console.log("   GET /api/admin/verify (Admin session) -> status:", resAdminVerify.status, JSON.stringify(dataAdminVerify));
    if (resAdminVerify.status !== 200 || !dataAdminVerify.ok || dataAdminVerify.admin?.role !== "admin") {
      throw new Error("Admin could not access /api/admin/verify");
    }
    console.log("   ✓ Legitimate admin verified successfully with 200 OK");

    // -------------------------------------------------------------------------
    // TEST 10: Security Checks (Zero credential leakage in responses)
    // -------------------------------------------------------------------------
    console.log("\n10. Security Checks: Verifying zero credential/hash exposure...");
    const responsesToCheck = [
      dataSignupA,
      dataSignupB,
      dataGetProfileA,
      dataLoginAdmin,
      dataAdminVerify,
    ];
    for (const data of responsesToCheck) {
      const serialized = JSON.stringify(data);
      if (serialized.includes("password_hash") || serialized.includes("passwordHash") || serialized.includes("passwordReset")) {
        throw new Error("SECURITY LEAK: Found password hash in response payload!");
      }
      if (serialized.includes("srv1741.hstgr.io") || serialized.includes("u209580425")) {
        throw new Error("SECURITY LEAK: Found database connection strings in response payload!");
      }
    }
    console.log("   ✓ All responses verified: Zero password hashes or credentials exposed.");

    console.log("\n=================================================================");
    console.log("ALL B-07 AUTHORIZATION AUDIT TESTS PASSED SUCCESSFULLY!");
    console.log("=================================================================\n");
  } finally {
    // -------------------------------------------------------------------------
    // CLEANUP: Delete temporary QA test users from MySQL
    // -------------------------------------------------------------------------
    console.log("Performing cleanup of temporary QA test users...");
    try {
      const dbClean = await getDbConnection();
      const [delRes] = await dbClean.execute(
        "DELETE FROM profiles WHERE email LIKE 'qa_b07_%@dearr.test'"
      );
      console.log(`✓ Cleaned up ${(delRes as any).affectedRows} test profile(s) from Hostinger MySQL.`);
      await dbClean.end();
    } catch (cleanErr) {
      console.error("Cleanup error:", cleanErr);
    }
  }
}

runB07Audit()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\nTEST SUITE FAILED:", err);
    process.exit(1);
  });
