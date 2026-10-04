import fs from "fs";
import path from "path";
import mysql from "mysql2/promise";
import crypto from "crypto";
import bcrypt from "bcryptjs";

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
  num: number;
  title: string;
  passed: boolean;
  details?: string;
}

const results: TestResult[] = [];

function recordTest(num: number, title: string, passed: boolean, details?: string) {
  results.push({ num, title, passed, details });
  const mark = passed ? "✓ PASS" : "✗ FAIL";
  console.log(`   [TEST ${num}] [${mark}] ${title}${details ? ` — ${details}` : ""}`);
}

async function runB09ProfileVerification() {
  console.log("=================================================================");
  console.log("Dearr V1 — Task B-09: Customer Profile API & Ownership Verification");
  console.log("Target Base URL:", baseUrl);
  console.log("Database Host:  ", process.env.DB_HOST, "(Hostinger MySQL)");
  console.log("Database Name:  ", process.env.DB_NAME);
  console.log("=================================================================\n");

  const timestamp = Date.now();
  const customerAEmail = `qa_b09_custA_${timestamp}@dearr.test`;
  const customerBEmail = `qa_b09_custB_${timestamp}@dearr.test`;
  const adminEmail = `qa_b09_admin_${timestamp}@dearr.test`;
  const testPassword = "B09_SecurePassword123!";

  let cookieCustomerA: string | null = null;
  let cookieAdmin: string | null = null;

  let idCustomerA: string | null = null;
  let idCustomerB: string | null = null;
  let idAdmin: string | null = null;

  try {
    // -------------------------------------------------------------------------
    // SETUP: Register Customer A and Customer B
    // -------------------------------------------------------------------------
    console.log("Setting up temporary QA accounts in Hostinger MySQL...");

    const resSignupA = await fetch(`${baseUrl}/api/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "QA B09 Customer A",
        email: customerAEmail,
        password: testPassword,
        phone: "9876543210",
      }),
    });
    const dataSignupA = await resSignupA.json();
    if (!resSignupA.ok || !dataSignupA.ok) {
      throw new Error(`Customer A signup failed: ${JSON.stringify(dataSignupA)}`);
    }
    idCustomerA = dataSignupA.user.id;
    const cookieHeaderA = resSignupA.headers.get("set-cookie") || "";
    const matchA = cookieHeaderA.match(/dearr_session=([^;]+)/);
    cookieCustomerA = matchA ? `dearr_session=${matchA[1]}` : null;

    const resSignupB = await fetch(`${baseUrl}/api/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "QA B09 Customer B",
        email: customerBEmail,
        password: testPassword,
        phone: "9876543211",
      }),
    });
    const dataSignupB = await resSignupB.json();
    if (!resSignupB.ok || !dataSignupB.ok) {
      throw new Error(`Customer B signup failed: ${JSON.stringify(dataSignupB)}`);
    }
    idCustomerB = dataSignupB.user.id;

    console.log(`✓ Customer A created: ${idCustomerA}`);
    console.log(`✓ Customer B created: ${idCustomerB}\n`);

    // -------------------------------------------------------------------------
    // TEST 1 — Unauthenticated GET profile (Expected: 401)
    // -------------------------------------------------------------------------
    const resTest1 = await fetch(`${baseUrl}/api/customer/profile`);
    const dataTest1 = await resTest1.json();
    recordTest(
      1,
      "Unauthenticated GET profile returns 401 Unauthorized",
      resTest1.status === 401 && dataTest1.ok === false,
      `Status: ${resTest1.status}`
    );

    // -------------------------------------------------------------------------
    // TEST 2 — Unauthenticated PATCH profile (Expected: 401)
    // -------------------------------------------------------------------------
    const resTest2 = await fetch(`${baseUrl}/api/customer/profile`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fullName: "Unauthenticated Hacker" }),
    });
    const dataTest2 = await resTest2.json();
    recordTest(
      2,
      "Unauthenticated PATCH profile returns 401 Unauthorized",
      resTest2.status === 401 && dataTest2.ok === false,
      `Status: ${resTest2.status}`
    );

    // -------------------------------------------------------------------------
    // TEST 3 — Authenticated customer GET own profile (Expected: 200 with sanitized profile)
    // -------------------------------------------------------------------------
    const resTest3 = await fetch(`${baseUrl}/api/customer/profile`, {
      headers: { Cookie: cookieCustomerA! },
    });
    const dataTest3 = await resTest3.json();
    const isProfileSanitized =
      resTest3.status === 200 &&
      dataTest3.ok === true &&
      dataTest3.profile?.id === idCustomerA &&
      dataTest3.profile?.email.toLowerCase() === customerAEmail.toLowerCase() &&
      dataTest3.profile?.role === "customer" &&
      !("password_hash" in dataTest3.profile) &&
      !("passwordHash" in dataTest3.profile);

    recordTest(
      3,
      "Authenticated customer GET own profile returns 200 with sanitized data",
      isProfileSanitized,
      `Email: ${dataTest3.profile?.email}`
    );

    // -------------------------------------------------------------------------
    // TEST 4 — Authenticated customer updates own full name (Expected: 200 and MySQL value updated)
    // -------------------------------------------------------------------------
    const updatedName = "QA B09 Customer A Updated Name";
    const resTest4 = await fetch(`${baseUrl}/api/customer/profile`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieCustomerA!,
      },
      body: JSON.stringify({ fullName: updatedName }),
    });
    const dataTest4 = await resTest4.json();

    const db4 = await getDbConnection();
    const [rows4] = await db4.execute("SELECT full_name FROM profiles WHERE id = ?", [idCustomerA]);
    const nameInDb = (rows4 as any[])[0]?.full_name;
    await db4.end();

    recordTest(
      4,
      "Authenticated customer updates full name (200 + MySQL verified)",
      resTest4.status === 200 && dataTest4.profile?.fullName === updatedName && nameInDb === updatedName,
      `MySQL: '${nameInDb}'`
    );

    // -------------------------------------------------------------------------
    // TEST 5 — Authenticated customer updates own phone (Expected: 200 and MySQL value updated)
    // -------------------------------------------------------------------------
    const updatedPhoneInput = "+91 91234 56789";
    const expectedStoredPhone = "9123456789";
    const resTest5 = await fetch(`${baseUrl}/api/customer/profile`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieCustomerA!,
      },
      body: JSON.stringify({ phone: updatedPhoneInput }),
    });
    const dataTest5 = await resTest5.json();

    const db5 = await getDbConnection();
    const [rows5] = await db5.execute("SELECT phone FROM profiles WHERE id = ?", [idCustomerA]);
    const phoneInDb = (rows5 as any[])[0]?.phone;
    await db5.end();

    recordTest(
      5,
      "Authenticated customer updates phone number (200 + normalized in MySQL)",
      resTest5.status === 200 && dataTest5.profile?.phone === expectedStoredPhone && phoneInDb === expectedStoredPhone,
      `Normalized in DB: '${phoneInDb}'`
    );

    // -------------------------------------------------------------------------
    // TEST 6 — Customer attempts role escalation ({ "role": "admin" }) (Expected: 403, DB role remains customer)
    // -------------------------------------------------------------------------
    const resTest6 = await fetch(`${baseUrl}/api/customer/profile`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieCustomerA!,
      },
      body: JSON.stringify({
        fullName: "Escalated User",
        role: "admin",
      }),
    });
    const dataTest6 = await resTest6.json();

    const db6 = await getDbConnection();
    const [rows6] = await db6.execute("SELECT role FROM profiles WHERE id = ?", [idCustomerA]);
    const roleInDb = (rows6 as any[])[0]?.role;
    await db6.end();

    recordTest(
      6,
      "Role escalation attempt rejected with 403 and MySQL role remains 'customer'",
      resTest6.status === 403 && dataTest6.ok === false && roleInDb === "customer",
      `Status: ${resTest6.status}, DB Role: '${roleInDb}'`
    );

    // -------------------------------------------------------------------------
    // TEST 7 — Customer attempts to modify another user's profile (IDOR) (Expected: 403, target user record unchanged)
    // -------------------------------------------------------------------------
    const resTest7 = await fetch(`${baseUrl}/api/customer/profile`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieCustomerA!,
      },
      body: JSON.stringify({
        targetUserId: idCustomerB,
        fullName: "Hacked Customer B By Customer A",
      }),
    });
    const dataTest7 = await resTest7.json();

    const db7 = await getDbConnection();
    const [rows7] = await db7.execute("SELECT full_name FROM profiles WHERE id = ?", [idCustomerB]);
    const bNameInDb = (rows7 as any[])[0]?.full_name;
    await db7.end();

    recordTest(
      7,
      "IDOR cross-user modification rejected with 403 and target record unchanged",
      resTest7.status === 403 && dataTest7.ok === false && bNameInDb === "QA B09 Customer B",
      `Target DB Name: '${bNameInDb}'`
    );

    // -------------------------------------------------------------------------
    // TEST 8 — Customer attempts credential manipulation (Expected: credentials intact)
    // -------------------------------------------------------------------------
    const db8 = await getDbConnection();
    const [origRows8] = await db8.execute("SELECT password_hash FROM profiles WHERE id = ?", [idCustomerA]);
    const originalHash = (origRows8 as any[])[0]?.password_hash;

    const resTest8 = await fetch(`${baseUrl}/api/customer/profile`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieCustomerA!,
      },
      body: JSON.stringify({
        fullName: "QA Name After Credential Attack",
        password_hash: "$2a$10$malicious_forged_hash_value_1234567890123456789012345",
        password: "new_plaintext_password_attack",
      }),
    });
    const dataTest8 = await resTest8.json();

    const [afterRows8] = await db8.execute("SELECT password_hash FROM profiles WHERE id = ?", [idCustomerA]);
    const hashAfter = (afterRows8 as any[])[0]?.password_hash;
    await db8.end();

    recordTest(
      8,
      "Credential manipulation attempt ignored/protected; password_hash in MySQL intact",
      hashAfter === originalHash && originalHash.length === 60,
      `Hash unchanged: ${hashAfter.slice(0, 15)}...`
    );

    // -------------------------------------------------------------------------
    // TEST 9 — Invalid profile data (Expected: 400)
    // -------------------------------------------------------------------------
    // 9a: Empty payload {}
    const res9Empty = await fetch(`${baseUrl}/api/customer/profile`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookieCustomerA! },
      body: JSON.stringify({}),
    });
    // 9b: Short name (< 2 chars)
    const res9Short = await fetch(`${baseUrl}/api/customer/profile`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookieCustomerA! },
      body: JSON.stringify({ fullName: "X" }),
    });
    // 9c: Invalid phone format (letters)
    const res9AlphaPhone = await fetch(`${baseUrl}/api/customer/profile`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookieCustomerA! },
      body: JSON.stringify({ phone: "invalid-letters-123" }),
    });
    // 9d: Invalid phone length
    const res9ShortPhone = await fetch(`${baseUrl}/api/customer/profile`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookieCustomerA! },
      body: JSON.stringify({ phone: "12345" }),
    });

    const allInvalidReturned400 =
      res9Empty.status === 400 &&
      res9Short.status === 400 &&
      res9AlphaPhone.status === 400 &&
      res9ShortPhone.status === 400;

    recordTest(
      9,
      "Invalid profile data rejected with 400 Bad Request",
      allInvalidReturned400,
      `Empty: ${res9Empty.status}, ShortName: ${res9Short.status}, BadPhone: ${res9AlphaPhone.status}, ShortPhone: ${res9ShortPhone.status}`
    );

    // -------------------------------------------------------------------------
    // TEST 10 — Password hash is never returned (GET and PATCH)
    // -------------------------------------------------------------------------
    const serializedGet = JSON.stringify(dataTest3);
    const serializedPatch = JSON.stringify(dataTest4);
    const serializedPatch8 = JSON.stringify(dataTest8);

    const hasNoHash =
      !serializedGet.includes("password_hash") &&
      !serializedGet.includes("passwordHash") &&
      !serializedPatch.includes("password_hash") &&
      !serializedPatch.includes("passwordHash") &&
      !serializedPatch8.includes("password_hash") &&
      !serializedPatch8.includes("passwordHash");

    recordTest(
      10,
      "Password hash is never returned by GET or PATCH profile responses",
      hasNoHash,
      "Verified sanitized output across 3 responses"
    );

    // -------------------------------------------------------------------------
    // TEST 11 — Session consistency (GET /api/auth/me returns updated profile)
    // -------------------------------------------------------------------------
    const finalName = "QA Session Consistency Verified";
    await fetch(`${baseUrl}/api/customer/profile`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookieCustomerA! },
      body: JSON.stringify({ fullName: finalName }),
    });

    const resMe = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Cookie: cookieCustomerA! },
    });
    const dataMe = await resMe.json();

    const sessionConsistent =
      resMe.status === 200 &&
      dataMe.ok === true &&
      dataMe.user?.fullName === finalName &&
      dataMe.user?.id === idCustomerA;

    recordTest(
      11,
      "Session consistency verified: GET /api/auth/me returns updated profile",
      sessionConsistent,
      `Name in /api/auth/me: '${dataMe.user?.fullName}'`
    );

    // -------------------------------------------------------------------------
    // TEST 12 — Admin/founder access (Verification of admin authorization)
    // -------------------------------------------------------------------------
    // Seed temporary admin in Hostinger MySQL
    const dbAdmin = await getDbConnection();
    const adminHash = await bcrypt.hash(testPassword, 10);
    idAdmin = crypto.randomUUID();

    await dbAdmin.execute(
      "INSERT INTO profiles (id, email, password_hash, full_name, role) VALUES (?, ?, ?, ?, 'admin')",
      [idAdmin, adminEmail, adminHash, "QA B09 Founder Admin"]
    );
    await dbAdmin.end();

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
    const cookieAdminHeader = resLoginAdmin.headers.get("set-cookie") || "";
    const matchAdmin = cookieAdminHeader.match(/dearr_session=([^;]+)/);
    cookieAdmin = matchAdmin ? `dearr_session=${matchAdmin[1]}` : null;

    // Admin verifies admin endpoint
    const resAdminVerify = await fetch(`${baseUrl}/api/admin/verify`, {
      headers: { Cookie: cookieAdmin! },
    });
    const dataAdminVerify = await resAdminVerify.json();

    // Admin updates a customer profile via targetUserId
    const adminCustomerUpdateName = "Customer B Managed By Admin";
    const resAdminPatch = await fetch(`${baseUrl}/api/customer/profile`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieAdmin!,
      },
      body: JSON.stringify({
        targetUserId: idCustomerB,
        fullName: adminCustomerUpdateName,
      }),
    });
    const dataAdminPatch = await resAdminPatch.json();

    const dbCheckB = await getDbConnection();
    const [rowsAdminB] = await dbCheckB.execute("SELECT full_name FROM profiles WHERE id = ?", [idCustomerB]);
    const bUpdatedByAdmin = (rowsAdminB as any[])[0]?.full_name;
    await dbCheckB.end();

    const adminChecksPass =
      resAdminVerify.status === 200 &&
      dataAdminVerify.admin?.role === "admin" &&
      resAdminPatch.status === 200 &&
      bUpdatedByAdmin === adminCustomerUpdateName;

    recordTest(
      12,
      "Admin/founder access verified: Admin can verify status and manage permitted customer resources",
      adminChecksPass,
      `Admin verify: ${resAdminVerify.status}, Managed customer DB: '${bUpdatedByAdmin}'`
    );

    // -------------------------------------------------------------------------
    // SUMMARY
    // -------------------------------------------------------------------------
    console.log("\n=================================================================");
    const passedCount = results.filter((r) => r.passed).length;
    const totalCount = results.length;
    console.log(`B-09 VERIFICATION SUMMARY: ${passedCount}/${totalCount} TESTS PASSED`);
    console.log("=================================================================\n");

    if (passedCount !== totalCount) {
      throw new Error(`B-09 verification failed: ${totalCount - passedCount} test(s) failed.`);
    }
  } finally {
    // -------------------------------------------------------------------------
    // CLEANUP: Delete temporary QA accounts from Hostinger MySQL
    // -------------------------------------------------------------------------
    console.log("Cleaning up temporary QA accounts from Hostinger MySQL...");
    try {
      const dbClean = await getDbConnection();
      const [delRes] = await dbClean.execute(
        "DELETE FROM profiles WHERE email LIKE 'qa_b09_%@dearr.test'"
      );
      console.log(`✓ Cleaned up ${(delRes as any).affectedRows} test profile(s) from Hostinger MySQL.`);
      await dbClean.end();
    } catch (cleanErr) {
      console.error("Cleanup error:", cleanErr);
    }
  }
}

runB09ProfileVerification()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\nTEST SUITE EXECUTION ERROR:", err);
    process.exit(1);
  });
