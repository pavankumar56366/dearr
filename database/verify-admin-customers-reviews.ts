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

async function runAdminIntegrationVerification() {
  console.log("=================================================================");
  console.log("Dearr V1 — Admin Customers, Reviews & Settings Production Audit");
  console.log("Host:", baseUrl);
  console.log("Database:", process.env.DB_HOST, "(Hostinger MySQL)");
  console.log("=================================================================\n");

  const timestamp = Date.now();
  const testCustomerEmail = `qa_cust_${timestamp}@dearr.test`;
  const testAdminEmail = `qa_admin_${timestamp}@dearr.test`;

  let cookieCustomer: string | null = null;
  let cookieAdmin: string | null = null;

  let idCustomer: string | null = null;
  let idAdmin: string | null = null;

  const db = await getDbConnection();

  try {
    // Setup test users in MySQL
    idCustomer = `test-cust-${timestamp}`;
    idAdmin = `test-admin-${timestamp}`;

    await db.execute(
      `INSERT INTO profiles (id, email, full_name, phone, role) VALUES (?, ?, ?, ?, ?)`,
      [idCustomer, testCustomerEmail, "QA Test Customer", "+91 9988776655", "customer"]
    );

    await db.execute(
      `INSERT INTO profiles (id, email, full_name, phone, role) VALUES (?, ?, ?, ?, ?)`,
      [idAdmin, testAdminEmail, "QA Test Admin", "+91 9123456780", "admin"]
    );

    // Create a test review in MySQL
    const [products]: any = await db.execute("SELECT id, slug, name FROM products LIMIT 1");
    let testReviewId: string | null = null;
    if (products && products.length > 0) {
      testReviewId = `test-rev-${timestamp}`;
      await db.execute(
        `INSERT INTO reviews (id, product_id, user_id, customer_name, customer_email, rating, title, comment, status, verified_purchase)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          testReviewId,
          products[0].id,
          idCustomer,
          "QA Test Customer",
          testCustomerEmail,
          5,
          "Stunning 3D Print Quality",
          "Exceptional quality, layer lines are nearly invisible!",
          "pending",
          1,
        ]
      );
    }

    // Sign JWT session tokens
    const customerToken = await new SignJWT({
      sub: idCustomer,
      email: testCustomerEmail,
      role: "customer",
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("2h")
      .sign(authSecretKey);
    cookieCustomer = `dearr_session=${customerToken}`;

    const adminToken = await new SignJWT({
      sub: idAdmin,
      email: testAdminEmail,
      role: "admin",
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("2h")
      .sign(authSecretKey);
    cookieAdmin = `dearr_session=${adminToken}`;

    // -------------------------------------------------------------------------
    // 1. ADMIN CUSTOMERS API AUDIT
    // -------------------------------------------------------------------------
    console.log("1. AUDIT: GET /api/admin/customers");

    // 1a: Unauthenticated -> 401
    const resCustUnauth = await fetch(`${baseUrl}/api/admin/customers`);
    console.log("   Unauthenticated -> status:", resCustUnauth.status);
    if (resCustUnauth.status !== 401) {
      throw new Error(`Expected 401 Unauthorized, got ${resCustUnauth.status}`);
    }
    console.log("   ✓ Unauthenticated rejected with 401");

    // 1b: Customer role -> 403
    const resCustForbidden = await fetch(`${baseUrl}/api/admin/customers`, {
      headers: { Cookie: cookieCustomer },
    });
    console.log("   Customer role -> status:", resCustForbidden.status);
    if (resCustForbidden.status !== 403) {
      throw new Error(`Expected 403 Forbidden for customer role, got ${resCustForbidden.status}`);
    }
    console.log("   ✓ Customer role rejected with 403");

    // 1c: Admin role -> 200
    const resCustAdmin = await fetch(`${baseUrl}/api/admin/customers`, {
      headers: { Cookie: cookieAdmin },
    });
    const dataCustAdmin = await resCustAdmin.json();
    console.log("   Admin role -> status:", resCustAdmin.status, "count:", dataCustAdmin.customers?.length);
    if (resCustAdmin.status !== 200 || !dataCustAdmin.ok || !Array.isArray(dataCustAdmin.customers)) {
      throw new Error(`Expected 200 OK with customers array, got ${resCustAdmin.status}: ${JSON.stringify(dataCustAdmin)}`);
    }

    // Verify sanitization: NO password_hash, secrets, tokens
    const jsonStrCust = JSON.stringify(dataCustAdmin);
    if (
      jsonStrCust.includes("password_hash") ||
      jsonStrCust.includes("password") ||
      jsonStrCust.includes("secret") ||
      jsonStrCust.includes("token")
    ) {
      throw new Error("SECURITY FAILURE: Sensitive authentication fields found in customers response!");
    }
    console.log("   ✓ Admin customers list returned real profiles, 0 sensitive secrets exposed");

    // 1d: Detail endpoint GET /api/admin/customers/:id
    const resCustDetail = await fetch(`${baseUrl}/api/admin/customers/${idCustomer}`, {
      headers: { Cookie: cookieAdmin },
    });
    const dataCustDetail = await resCustDetail.json();
    console.log("   GET /api/admin/customers/:id -> status:", resCustDetail.status, "name:", dataCustDetail.customer?.name);
    if (resCustDetail.status !== 200 || !dataCustDetail.ok || dataCustDetail.customer?.id !== idCustomer) {
      throw new Error(`Expected 200 with customer details, got ${resCustDetail.status}`);
    }
    console.log("   ✓ Single customer detail fetched successfully");

    // -------------------------------------------------------------------------
    // 2. ADMIN REVIEWS API AUDIT
    // -------------------------------------------------------------------------
    console.log("\n2. AUDIT: GET /api/admin/reviews");

    // 2a: Unauthenticated -> 401
    const resRevUnauth = await fetch(`${baseUrl}/api/admin/reviews`);
    console.log("   Unauthenticated -> status:", resRevUnauth.status);
    if (resRevUnauth.status !== 401) {
      throw new Error(`Expected 401 Unauthorized, got ${resRevUnauth.status}`);
    }
    console.log("   ✓ Unauthenticated rejected with 401");

    // 2b: Customer role -> 403
    const resRevForbidden = await fetch(`${baseUrl}/api/admin/reviews`, {
      headers: { Cookie: cookieCustomer },
    });
    console.log("   Customer role -> status:", resRevForbidden.status);
    if (resRevForbidden.status !== 403) {
      throw new Error(`Expected 403 Forbidden for customer role, got ${resRevForbidden.status}`);
    }
    console.log("   ✓ Customer role rejected with 403");

    // 2c: Admin role -> 200
    const resRevAdmin = await fetch(`${baseUrl}/api/admin/reviews`, {
      headers: { Cookie: cookieAdmin },
    });
    const dataRevAdmin = await resRevAdmin.json();
    console.log("   Admin role -> status:", resRevAdmin.status, "count:", dataRevAdmin.reviews?.length);
    if (resRevAdmin.status !== 200 || !dataRevAdmin.ok || !Array.isArray(dataRevAdmin.reviews)) {
      throw new Error(`Expected 200 OK with reviews array, got ${resRevAdmin.status}: ${JSON.stringify(dataRevAdmin)}`);
    }

    // Verify sanitization
    const jsonStrRev = JSON.stringify(dataRevAdmin);
    if (
      jsonStrRev.includes("password_hash") ||
      jsonStrRev.includes("password") ||
      jsonStrRev.includes("secret")
    ) {
      throw new Error("SECURITY FAILURE: Sensitive credentials found in reviews response!");
    }
    console.log("   ✓ Admin reviews list returned real review rows, 0 sensitive secrets exposed");

    // 2d: PATCH /api/admin/reviews/:id status moderation
    if (testReviewId) {
      console.log("\n   AUDIT: PATCH /api/admin/reviews/:id (Moderation Update)");
      // Customer attempt -> 403
      const resPatchForbidden = await fetch(`${baseUrl}/api/admin/reviews/${testReviewId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Cookie: cookieCustomer },
        body: JSON.stringify({ status: "approved", adminNote: "Auto-approved by test" }),
      });
      if (resPatchForbidden.status !== 403) {
        throw new Error(`Expected 403 Forbidden for customer review patch, got ${resPatchForbidden.status}`);
      }
      console.log("   ✓ Customer review PATCH rejected with 403");

      // Admin attempt -> 200
      const resPatchAdmin = await fetch(`${baseUrl}/api/admin/reviews/${testReviewId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Cookie: cookieAdmin },
        body: JSON.stringify({ status: "approved", adminNote: "Verified and approved by QA admin" }),
      });
      const dataPatchAdmin = await resPatchAdmin.json();
      if (resPatchAdmin.status !== 200 || !dataPatchAdmin.ok || dataPatchAdmin.review?.status !== "approved") {
        throw new Error(`Expected 200 OK for admin review patch, got ${resPatchAdmin.status}`);
      }
      console.log("   ✓ Admin review PATCH succeeded, status updated to 'approved'");
    }

    // -------------------------------------------------------------------------
    // 3. ADMIN SETTINGS API AUDIT
    // -------------------------------------------------------------------------
    console.log("\n3. AUDIT: GET /api/admin/settings");

    // 3a: Unauthenticated -> 401
    const resSetUnauth = await fetch(`${baseUrl}/api/admin/settings`);
    console.log("   Unauthenticated -> status:", resSetUnauth.status);
    if (resSetUnauth.status !== 401) {
      throw new Error(`Expected 401 Unauthorized, got ${resSetUnauth.status}`);
    }
    console.log("   ✓ Unauthenticated rejected with 401");

    // 3b: Customer role -> 403
    const resSetForbidden = await fetch(`${baseUrl}/api/admin/settings`, {
      headers: { Cookie: cookieCustomer },
    });
    console.log("   Customer role -> status:", resSetForbidden.status);
    if (resSetForbidden.status !== 403) {
      throw new Error(`Expected 403 Forbidden for customer role, got ${resSetForbidden.status}`);
    }
    console.log("   ✓ Customer role rejected with 403");

    // 3c: Admin role -> 200
    const resSetAdmin = await fetch(`${baseUrl}/api/admin/settings`, {
      headers: { Cookie: cookieAdmin },
    });
    const dataSetAdmin = await resSetAdmin.json();
    console.log("   Admin role -> status:", resSetAdmin.status, "storeName:", dataSetAdmin.settings?.storeName);
    if (resSetAdmin.status !== 200 || !dataSetAdmin.ok || !dataSetAdmin.settings) {
      throw new Error(`Expected 200 OK with settings object, got ${resSetAdmin.status}`);
    }

    // Verify sanitization: Ensure ZERO private env credentials exposed
    const jsonStrSet = JSON.stringify(dataSetAdmin);
    const forbiddenKeys = [
      "DB_PASSWORD",
      "GOOGLE_CLIENT_SECRET",
      "RAZORPAY_KEY_SECRET",
      "SESSION_SECRET",
      "AUTH_SECRET",
      "GITHUB_PAT",
      "password",
      "private_key",
    ];
    for (const forbidden of forbiddenKeys) {
      if (jsonStrSet.includes(forbidden)) {
        throw new Error(`SECURITY FAILURE: Secret identifier '${forbidden}' leaked in settings response!`);
      }
    }
    console.log("   ✓ Admin settings returned safe configuration, 0 private credentials leaked");

    console.log("\n=================================================================");
    console.log("ALL ADMIN CUSTOMERS, REVIEWS & SETTINGS AUDIT TESTS PASSED (100%)");
    console.log("=================================================================");
  } finally {
    // Clean up test data from MySQL
    console.log("\nCleaning up test records from MySQL...");
    if (idCustomer) {
      await db.execute("DELETE FROM reviews WHERE user_id = ?", [idCustomer]);
      await db.execute("DELETE FROM profiles WHERE id = ?", [idCustomer]);
    }
    if (idAdmin) {
      await db.execute("DELETE FROM profiles WHERE id = ?", [idAdmin]);
    }
    await db.end();
    console.log("✓ Test records cleaned up successfully. Database clean.");
  }
}

runAdminIntegrationVerification()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\n❌ VERIFICATION FAILED:", err);
    process.exit(1);
  });
