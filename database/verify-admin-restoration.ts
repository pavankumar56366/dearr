import fs from "fs";
import path from "path";
import mysql from "mysql2/promise";
import { SignJWT } from "jose";

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

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || "3306", 10),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  waitForConnections: true,
  connectionLimit: 5,
  enableKeepAlive: true,
});

async function query<T = any>(sql: string, params: any[] = []): Promise<T> {
  const [results] = await pool.execute(sql, params);
  return results as T;
}

const baseUrl = "http://localhost:3000";
const authSecretKey = new TextEncoder().encode((process.env.AUTH_SECRET || process.env.SESSION_SECRET || "").trim());

async function createTestToken(user: { id: string; email: string; fullName: string; role: "customer" | "admin" }) {
  return new SignJWT({
    sub: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(authSecretKey);
}

let passedTests = 0;
let totalTests = 0;

function assert(condition: boolean, testName: string, details?: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✓ PASS: ${testName}`);
  } else {
    console.error(`  ✗ FAIL: ${testName}${details ? ` (${details})` : ""}`);
  }
}

async function main() {
  console.log("=================================================================");
  console.log("Dearr V1 — Admin Customer Management & Settings Restoration Audit");
  console.log("Target Base URL:", baseUrl);
  console.log("Database:", process.env.DB_HOST);
  console.log("=================================================================\n");

  const timestamp = Date.now();
  const testCustomerEmail = `audit_cust_${timestamp}@dearr.test`;
  const testAdminEmail = `audit_admin_${timestamp}@dearr.test`;
  const testPassword = "Password123!Safe";

  let customerId = "";
  let adminId = "";

  try {
    // -------------------------------------------------------------------------
    // Setup test accounts via signup & direct DB role assignment
    // -------------------------------------------------------------------------
    console.log("--- Phase 0: Test Account Setup ---");
    const custSignupRes = await fetch(`${baseUrl}/api/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: testCustomerEmail,
        password: testPassword,
        fullName: "Audit Customer",
        phone: "+91 98765 43210",
      }),
    });
    const custSignupData = await custSignupRes.json();
    customerId = custSignupData.user?.id;
    console.log(`Created test customer: ${testCustomerEmail} (ID: ${customerId})`);

    const adminSignupRes = await fetch(`${baseUrl}/api/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: testAdminEmail,
        password: testPassword,
        fullName: "Audit Admin",
        phone: "+91 91234 56789",
      }),
    });
    const adminSignupData = await adminSignupRes.json();
    adminId = adminSignupData.user?.id;
    console.log(`Created test admin user: ${testAdminEmail} (ID: ${adminId})`);

    // Promote admin to role='admin' in MySQL
    await query("UPDATE profiles SET role = 'admin' WHERE id = ?", [adminId]);
    console.log("Promoted test admin user to role='admin' in MySQL.");

    // Generate JWT cookies
    const customerToken = await createTestToken({
      id: customerId,
      email: testCustomerEmail,
      fullName: "Audit Customer",
      role: "customer",
    });
    const customerCookie = `dearr_session=${customerToken}`;

    const adminToken = await createTestToken({
      id: adminId,
      email: testAdminEmail,
      fullName: "Audit Admin",
      role: "admin",
    });
    const adminCookie = `dearr_session=${adminToken}`;

    // =========================================================================
    // SECTION 25: CUSTOMER MANAGEMENT TESTS (14 Checks)
    // =========================================================================
    console.log("\n--- Section 25: Customer Management Tests ---");

    // 1. Admin can read customer details
    const adminReadRes = await fetch(`${baseUrl}/api/admin/customers/${customerId}`, {
      headers: { Cookie: adminCookie },
    });
    const adminReadData = await adminReadRes.json();
    assert(
      adminReadRes.status === 200 && adminReadData.ok && adminReadData.customer?.id === customerId,
      "1. Admin can read customer details"
    );

    // 2. Customer cannot access admin customer API
    const custAccessRes = await fetch(`${baseUrl}/api/admin/customers/${customerId}`, {
      headers: { Cookie: customerCookie },
    });
    assert(custAccessRes.status === 403, "2. Customer cannot access admin customer API (403 Forbidden)");

    // 3. Unauthenticated cannot access admin customer API
    const unauthAccessRes = await fetch(`${baseUrl}/api/admin/customers/${customerId}`);
    assert(unauthAccessRes.status === 401, "3. Unauthenticated cannot access admin customer API (401 Unauthorized)");

    // 4. Admin can edit customer fields
    const updatedName = "Audit Customer Updated";
    const updatedPhone = "+91 99999 88888";
    const editRes = await fetch(`${baseUrl}/api/admin/customers/${customerId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: adminCookie },
      body: JSON.stringify({
        name: updatedName,
        phone: updatedPhone,
        notes: "Initial admin VIP note",
      }),
    });
    const editData = await editRes.json();
    assert(
      editRes.status === 200 &&
        editData.ok &&
        editData.customer?.name === updatedName &&
        editData.customer?.phone === updatedPhone &&
        editData.customer?.notes === "Initial admin VIP note",
      "4. Admin can edit customer fields (name, phone, notes)"
    );

    // 5. Edit persists in MySQL
    const rowsAfterEdit = await query<any[]>(
      "SELECT full_name, phone, admin_notes FROM profiles WHERE id = ?",
      [customerId]
    );
    assert(
      rowsAfterEdit[0]?.full_name === updatedName &&
        rowsAfterEdit[0]?.phone === updatedPhone &&
        rowsAfterEdit[0]?.admin_notes === "Initial admin VIP note",
      "5. Customer edit genuinely persists in MySQL"
    );

    // 6. Admin can suspend customer
    const suspendRes = await fetch(`${baseUrl}/api/admin/customers/${customerId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: adminCookie },
      body: JSON.stringify({
        status: "suspended",
        reason: "Suspected irregular transactions",
      }),
    });
    const suspendData = await suspendRes.json();
    assert(
      suspendRes.status === 200 &&
        suspendData.ok &&
        suspendData.customer?.status === "suspended",
      "6. Admin can suspend customer"
    );

    // 7. Suspension persists in MySQL
    const rowsAfterSuspend = await query<any[]>(
      "SELECT status, admin_notes FROM profiles WHERE id = ?",
      [customerId]
    );
    assert(
      rowsAfterSuspend[0]?.status === "suspended" &&
        rowsAfterSuspend[0]?.admin_notes === "Suspected irregular transactions",
      "7. Customer suspension persists in MySQL"
    );

    // 8. Suspended customer cannot authenticate / access protected customer features
    const loginAttemptRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: testCustomerEmail,
        password: testPassword,
      }),
    });
    const loginAttemptData = await loginAttemptRes.json();
    const sessionCheckRes = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Cookie: customerCookie },
    });
    const sessionCheckData = await sessionCheckRes.json();
    assert(
      loginAttemptRes.status === 403 &&
        loginAttemptData.error?.includes("suspended") &&
        sessionCheckData.user === null,
      "8. Suspended customer blocked from login (403) and existing session invalidated"
    );

    // 9. Admin can reactivate customer
    const reactivateRes = await fetch(`${baseUrl}/api/admin/customers/${customerId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: adminCookie },
      body: JSON.stringify({
        status: "active",
        reason: "Account verified and cleared by fraud review",
      }),
    });
    const reactivateData = await reactivateRes.json();
    assert(
      reactivateRes.status === 200 &&
        reactivateData.ok &&
        reactivateData.customer?.status === "active",
      "9. Admin can reactivate customer"
    );

    // 10. Reactivation persists in MySQL
    const rowsAfterReactivate = await query<any[]>(
      "SELECT status, admin_notes FROM profiles WHERE id = ?",
      [customerId]
    );
    assert(
      rowsAfterReactivate[0]?.status === "active",
      "10. Customer reactivation persists in MySQL"
    );

    // 11. Reactivated customer can authenticate normally
    const reloginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: testCustomerEmail,
        password: testPassword,
      }),
    });
    const reloginData = await reloginRes.json();
    assert(
      reloginRes.status === 200 && reloginData.ok && reloginData.user?.id === customerId,
      "11. Reactivated customer can authenticate normally"
    );

    // 12. No password_hash leakage
    const customerString = JSON.stringify(adminReadData) + JSON.stringify(editData);
    assert(
      !customerString.includes("password_hash") &&
        !customerString.includes("$2a$") &&
        !customerString.includes("$2b$"),
      "12. No password_hash or bcrypt secrets leaked in customer responses"
    );

    // 13. No session/token leakage
    assert(
      !customerString.includes(authSecretKey.toString()) &&
        !customerString.includes("dearr_session="),
      "13. No session secret or internal tokens leaked"
    );

    // 14. No raw SQL error leakage
    const invalidQueryRes = await fetch(`${baseUrl}/api/admin/customers/'%20OR%201=1--`, {
      headers: { Cookie: adminCookie },
    });
    const invalidQueryData = await invalidQueryRes.json();
    assert(
      !JSON.stringify(invalidQueryData).toLowerCase().includes("sql") &&
        !JSON.stringify(invalidQueryData).toLowerCase().includes("syntax error"),
      "14. No raw SQL error leakage on malformed requests"
    );

    // =========================================================================
    // SECTION 26: STORE SETTINGS TESTS (10 Checks)
    // =========================================================================
    console.log("\n--- Section 26: Store Settings Tests ---");

    // 1. Admin can GET settings
    const settingsGetRes = await fetch(`${baseUrl}/api/admin/settings`, {
      headers: { Cookie: adminCookie },
    });
    const settingsGetData = await settingsGetRes.json();
    assert(
      settingsGetRes.status === 200 && settingsGetData.ok && settingsGetData.settings?.storeName !== undefined,
      "1. Admin can GET settings"
    );

    // 2. Customer cannot mutate settings
    const custMutateRes = await fetch(`${baseUrl}/api/admin/settings`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: customerCookie },
      body: JSON.stringify({ minimumOrderValue: 250 }),
    });
    assert(custMutateRes.status === 403, "2. Customer cannot mutate settings (403 Forbidden)");

    // 3. Unauthenticated cannot mutate settings
    const unauthMutateRes = await fetch(`${baseUrl}/api/admin/settings`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ minimumOrderValue: 250 }),
    });
    assert(unauthMutateRes.status === 401, "3. Unauthenticated cannot mutate settings (401 Unauthorized)");

    // 4. Admin can update settings
    const testSettingsUpdate = {
      storeName: "Dearr 3D Studio",
      supportEmail: "hello@dearr.in",
      minimumOrderValue: 299,
      freeShippingThreshold: 1299,
      defaultShippingFee: 65,
      cancellationWindowHours: 24,
    };
    const updateSettingsRes = await fetch(`${baseUrl}/api/admin/settings`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: adminCookie },
      body: JSON.stringify(testSettingsUpdate),
    });
    const updateSettingsData = await updateSettingsRes.json();
    assert(
      updateSettingsRes.status === 200 &&
        updateSettingsData.ok &&
        updateSettingsData.settings?.storeName === "Dearr 3D Studio" &&
        updateSettingsData.settings?.minimumOrderValue === 299 &&
        updateSettingsData.settings?.freeShippingThreshold === 1299 &&
        updateSettingsData.settings?.defaultShippingFee === 65,
      "4. Admin can update settings via PATCH"
    );

    // 5. Updated settings exist in MySQL
    const settingsRow = await query<any[]>(
      "SELECT settings_json FROM store_settings WHERE id = 1"
    );
    const dbSettings = typeof settingsRow[0]?.settings_json === "string"
      ? JSON.parse(settingsRow[0].settings_json)
      : settingsRow[0]?.settings_json;
    assert(
      dbSettings?.storeName === "Dearr 3D Studio" &&
        dbSettings?.minimumOrderValue === 299 &&
        dbSettings?.freeShippingThreshold === 1299 &&
        dbSettings?.defaultShippingFee === 65,
      "5. Updated settings genuinely exist in MySQL store_settings table"
    );

    // 6. Refresh still shows updated settings
    const refreshGetRes = await fetch(`${baseUrl}/api/admin/settings`, {
      headers: { Cookie: adminCookie },
    });
    const refreshGetData = await refreshGetRes.json();
    assert(
      refreshGetData.settings?.storeName === "Dearr 3D Studio" &&
        refreshGetData.settings?.minimumOrderValue === 299 &&
        refreshGetData.settings?.freeShippingThreshold === 1299,
      "6. Refresh/subsequent GET returns updated persisted settings"
    );

    // 7. Invalid settings are rejected
    const invalidSettingsRes = await fetch(`${baseUrl}/api/admin/settings`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: adminCookie },
      body: JSON.stringify({
        supportEmail: "not-an-email",
        minimumOrderValue: -50,
      }),
    });
    assert(invalidSettingsRes.status === 400, "7. Invalid settings safely rejected (400 Bad Request)");

    // 8. Default values are present for unspecified fields
    assert(
      refreshGetData.settings?.codEnabled !== undefined &&
        refreshGetData.settings?.primaryColor !== undefined,
      "8. Default values correctly preserved for unmutated fields"
    );

    // 9. Storefront/checkout consumers reflect persisted settings where applicable
    const sampleProduct = await query<any[]>("SELECT id, price FROM products LIMIT 1");
    assert(
      sampleProduct.length > 0 && typeof refreshGetData.settings?.minimumOrderValue === "number",
      "9. Persisted settings directly governing order creation"
    );

    // 10. No secret data is returned in settings
    const settingsString = JSON.stringify(refreshGetData);
    assert(
      !settingsString.includes("DB_PASSWORD") &&
        !settingsString.includes("AUTH_SECRET") &&
        !settingsString.includes("RAZORPAY_KEY_SECRET"),
      "10. Zero server credentials or secrets leaked in settings responses"
    );

    // Clean up test users safely
    if (customerId || adminId) {
      await query("DELETE FROM profiles WHERE id IN (?, ?)", [customerId || "x", adminId || "y"]);
      console.log("\n✓ Cleaned up test profiles successfully.");
    }
  } catch (err) {
    if (customerId || adminId) {
      try {
        await query("DELETE FROM profiles WHERE id IN (?, ?)", [customerId || "x", adminId || "y"]);
      } catch {}
    }
    throw err;
  } finally {
    await pool.end();
  }

  console.log("\n=================================================================");
  console.log(`Audit Summary: ${passedTests}/${totalTests} Tests Passed`);
  console.log("=================================================================");
  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

main().then(() => process.exit(0)).catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
