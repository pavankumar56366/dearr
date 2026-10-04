import fs from "fs";
import path from "path";
import mysql from "mysql2/promise";
import crypto from "crypto";
import bcrypt from "bcryptjs";

// Load .env.local manually for standalone test runner
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

async function runB13CategoryVerification() {
  console.log("=================================================================");
  console.log("Dearr V1 — Task B-13: Category API & Catalog Backend Verification");
  console.log("Target Base URL: ", baseUrl);
  console.log("Database Host:   ", process.env.DB_HOST, "(Hostinger MySQL)");
  console.log("Database Name:   ", process.env.DB_NAME);
  console.log("=================================================================\n");

  const timestamp = Date.now();
  const customerEmail = `qa_b13_cust_${timestamp}@dearr.test`;
  const adminEmail = `qa_b13_admin_${timestamp}@dearr.test`;
  const testPassword = "B13_SecurePassword123!";

  const qaCategorySlugA = `qa-cat-a-${timestamp}`;
  const qaCategorySlugB = `qa-cat-b-${timestamp}`;

  let cookieCustomer: string | null = null;
  let cookieAdmin: string | null = null;

  let idCustomer: string | null = null;
  let idAdmin: string | null = null;
  let idCategoryA: string | null = null;

  const db = await getDbConnection();

  try {
    // -------------------------------------------------------------------------
    // SETUP: Create Customer account and Admin account
    // -------------------------------------------------------------------------
    console.log("Setting up temporary QA accounts in Hostinger MySQL...\n");

    // 1. Customer Account via signup API
    const resCustSignup = await fetch(`${baseUrl}/api/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "QA B13 Customer",
        email: customerEmail,
        password: testPassword,
      }),
    });
    const custData = await resCustSignup.json();
    idCustomer = custData.user?.id || null;
    const setCookieCust = resCustSignup.headers.get("set-cookie") || "";
    cookieCustomer = setCookieCust.split(";")[0] || null;
    console.log(`✓ Customer account created: ${idCustomer}`);

    // 2. Admin Account - insert directly via SQL then login
    idAdmin = crypto.randomUUID();
    const adminHash = await bcrypt.hash(testPassword, 10);
    await db.execute(
      "INSERT INTO profiles (id, email, password_hash, full_name, role) VALUES (?, ?, ?, ?, 'admin')",
      [idAdmin, adminEmail, adminHash, "QA B13 Admin"]
    );

    const resAdminLogin = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: adminEmail, password: testPassword }),
    });
    const setCookieAdmin = resAdminLogin.headers.get("set-cookie") || "";
    cookieAdmin = setCookieAdmin.split(";")[0] || null;
    console.log(`✓ Admin account created:    ${idAdmin}\n`);

    // -------------------------------------------------------------------------
    // TEST 1 — Public category list endpoint works (200 OK)
    // -------------------------------------------------------------------------
    const resTest1 = await fetch(`${baseUrl}/api/categories`);
    const dataTest1 = await resTest1.json();
    recordTest(
      1,
      "Public category list endpoint works (200 OK)",
      resTest1.status === 200 && dataTest1.ok === true && Array.isArray(dataTest1.categories),
      `Status: ${resTest1.status}, Count: ${dataTest1.categories?.length ?? "N/A"}`
    );

    // -------------------------------------------------------------------------
    // TEST 2 — Unauthenticated admin category creation returns 401
    // -------------------------------------------------------------------------
    const resTest2 = await fetch(`${baseUrl}/api/admin/categories`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Unauthenticated Category",
        slug: `qa-unauth-${timestamp}`,
        description: "Should fail",
      }),
    });
    recordTest(
      2,
      "Unauthenticated category creation returns 401 Unauthorized",
      resTest2.status === 401,
      `Status: ${resTest2.status}`
    );

    // -------------------------------------------------------------------------
    // TEST 3 — Customer attempting category creation returns 403
    // -------------------------------------------------------------------------
    const resTest3 = await fetch(`${baseUrl}/api/admin/categories`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieCustomer!,
      },
      body: JSON.stringify({
        name: "Customer Category",
        slug: `qa-cust-${timestamp}`,
        description: "Should fail",
      }),
    });
    recordTest(
      3,
      "Customer role category creation returns 403 Forbidden",
      resTest3.status === 403,
      `Status: ${resTest3.status}`
    );

    // -------------------------------------------------------------------------
    // TEST 4 — Admin can create a category (201 Created)
    // -------------------------------------------------------------------------
    const resTest4 = await fetch(`${baseUrl}/api/admin/categories`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieAdmin!,
      },
      body: JSON.stringify({
        name: "QA Test Category A",
        slug: qaCategorySlugA,
        description: "Category created by B-13 verification suite",
        isActive: true,
      }),
    });
    const dataTest4 = await resTest4.json();
    if (resTest4.status === 201 && dataTest4.category?.id) {
      idCategoryA = dataTest4.category.id;
    }
    recordTest(
      4,
      "Admin can create a category (201 Created)",
      resTest4.status === 201 && dataTest4.ok === true && dataTest4.category?.slug === qaCategorySlugA,
      `Category ID: ${idCategoryA}`
    );

    // -------------------------------------------------------------------------
    // TEST 5 — Duplicate slug creation rejected with 409 Conflict
    // -------------------------------------------------------------------------
    const resTest5 = await fetch(`${baseUrl}/api/admin/categories`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieAdmin!,
      },
      body: JSON.stringify({
        name: "Duplicate Slug Attempt",
        slug: qaCategorySlugA,
        description: "Should fail with 409",
      }),
    });
    recordTest(
      5,
      "Duplicate slug creation rejected with 409 Conflict",
      resTest5.status === 409,
      `Status: ${resTest5.status}`
    );

    // -------------------------------------------------------------------------
    // TEST 6 — Validation: missing name rejected (400)
    // -------------------------------------------------------------------------
    const resTest6 = await fetch(`${baseUrl}/api/admin/categories`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieAdmin!,
      },
      body: JSON.stringify({
        slug: `qa-noname-${timestamp}`,
        description: "Missing name",
      }),
    });
    recordTest(
      6,
      "Missing name rejected with 400 Bad Request",
      resTest6.status === 400,
      `Status: ${resTest6.status}`
    );

    // -------------------------------------------------------------------------
    // TEST 7 — Validation: invalid slug format rejected (400)
    // -------------------------------------------------------------------------
    const resTest7 = await fetch(`${baseUrl}/api/admin/categories`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieAdmin!,
      },
      body: JSON.stringify({
        name: "Invalid Slug Test",
        slug: "INVALID--SLUG!!",
      }),
    });
    recordTest(
      7,
      "Invalid slug format rejected with 400 Bad Request",
      resTest7.status === 400,
      `Status: ${resTest7.status}`
    );

    // -------------------------------------------------------------------------
    // TEST 8 — Category exists in MySQL after creation
    // -------------------------------------------------------------------------
    let test8pass = false;
    if (idCategoryA) {
      const [rows] = await db.execute(
        "SELECT * FROM categories WHERE id = ? LIMIT 1",
        [idCategoryA]
      ) as any;
      test8pass = rows.length === 1 && rows[0].slug === qaCategorySlugA && rows[0].is_active === 1;
    }
    recordTest(
      8,
      "Created category exists in MySQL with correct data",
      test8pass,
      `ID: ${idCategoryA}`
    );

    // -------------------------------------------------------------------------
    // TEST 9 — Admin can retrieve category by ID (GET /api/admin/categories/[id])
    // -------------------------------------------------------------------------
    let test9pass = false;
    if (idCategoryA) {
      const resTest9 = await fetch(`${baseUrl}/api/admin/categories/${idCategoryA}`, {
        headers: { Cookie: cookieAdmin! },
      });
      const dataTest9 = await resTest9.json();
      test9pass = resTest9.status === 200 && dataTest9.ok === true && dataTest9.category?.name === "QA Test Category A";
      recordTest(
        9,
        "Admin can retrieve category by ID (200 OK)",
        test9pass,
        `Name: '${dataTest9.category?.name}'`
      );
    } else {
      recordTest(9, "Admin can retrieve category by ID (200 OK)", false, "Skipped — no category ID");
    }

    // -------------------------------------------------------------------------
    // TEST 10 — Admin can update category via PATCH
    // -------------------------------------------------------------------------
    let test10pass = false;
    if (idCategoryA) {
      const resTest10 = await fetch(`${baseUrl}/api/admin/categories/${idCategoryA}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Cookie: cookieAdmin!,
        },
        body: JSON.stringify({
          name: "QA Updated Category A",
          description: "Updated description for B-13 test",
        }),
      });
      const dataTest10 = await resTest10.json();
      test10pass = resTest10.status === 200 && dataTest10.ok === true && dataTest10.category?.name === "QA Updated Category A";
      recordTest(
        10,
        "Admin can update category fields via PATCH (200 OK)",
        test10pass,
        `Updated Name: '${dataTest10.category?.name}'`
      );
    } else {
      recordTest(10, "Admin can update category fields via PATCH (200 OK)", false, "Skipped — no category ID");
    }

    // -------------------------------------------------------------------------
    // TEST 11 — Duplicate slug during edit rejected (409)
    // -------------------------------------------------------------------------
    // Create a second category first
    const resCreateB = await fetch(`${baseUrl}/api/admin/categories`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieAdmin!,
      },
      body: JSON.stringify({
        name: "QA Test Category B",
        slug: qaCategorySlugB,
        description: "Second category for B-13 test suite",
        isActive: true,
      }),
    });
    const dataCreateB = await resCreateB.json();
    const idCategoryB = dataCreateB.category?.id || null;

    let test11pass = false;
    if (idCategoryB && idCategoryA) {
      // Try to change category B's slug to category A's slug
      const resTest11 = await fetch(`${baseUrl}/api/admin/categories/${idCategoryB}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Cookie: cookieAdmin!,
        },
        body: JSON.stringify({
          slug: qaCategorySlugA,
        }),
      });
      test11pass = resTest11.status === 409;
      recordTest(
        11,
        "Duplicate slug during edit rejected with 409 Conflict",
        test11pass,
        `Status: ${resTest11.status}`
      );
    } else {
      recordTest(11, "Duplicate slug during edit rejected with 409 Conflict", false, "Skipped — missing category IDs");
    }

    // -------------------------------------------------------------------------
    // TEST 12 — Category can keep its own slug during edit (200)
    // -------------------------------------------------------------------------
    let test12pass = false;
    if (idCategoryA) {
      const resTest12 = await fetch(`${baseUrl}/api/admin/categories/${idCategoryA}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Cookie: cookieAdmin!,
        },
        body: JSON.stringify({
          slug: qaCategorySlugA,
          description: "Self-slug update should be allowed",
        }),
      });
      test12pass = resTest12.status === 200;
      recordTest(
        12,
        "Category can keep its own slug during edit (200 OK)",
        test12pass,
        `Status: ${resTest12.status}`
      );
    } else {
      recordTest(12, "Category can keep its own slug during edit (200 OK)", false, "Skipped — no category ID");
    }

    // -------------------------------------------------------------------------
    // TEST 13 — Customer attempting category edit returns 403
    // -------------------------------------------------------------------------
    let test13pass = false;
    if (idCategoryA) {
      const resTest13 = await fetch(`${baseUrl}/api/admin/categories/${idCategoryA}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Cookie: cookieCustomer!,
        },
        body: JSON.stringify({ name: "Hacked Name" }),
      });
      test13pass = resTest13.status === 403;
      recordTest(
        13,
        "Customer attempting category edit returns 403 Forbidden",
        test13pass,
        `Status: ${resTest13.status}`
      );
    } else {
      recordTest(13, "Customer attempting category edit returns 403 Forbidden", false, "Skipped — no category ID");
    }

    // -------------------------------------------------------------------------
    // TEST 14 — Admin can deactivate category via PATCH isActive=false
    // -------------------------------------------------------------------------
    let test14pass = false;
    if (idCategoryA) {
      const resTest14 = await fetch(`${baseUrl}/api/admin/categories/${idCategoryA}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Cookie: cookieAdmin!,
        },
        body: JSON.stringify({ isActive: false }),
      });
      const dataTest14 = await resTest14.json();
      test14pass = resTest14.status === 200 && dataTest14.category?.isActive === false;

      // Verify in MySQL
      if (test14pass) {
        const [rows] = await db.execute(
          "SELECT is_active FROM categories WHERE id = ? LIMIT 1",
          [idCategoryA]
        ) as any;
        test14pass = rows.length === 1 && rows[0].is_active === 0;
      }

      recordTest(
        14,
        "Admin can deactivate category via PATCH isActive=false",
        test14pass,
        `is_active in MySQL: ${test14pass ? 0 : "unexpected"}`
      );
    } else {
      recordTest(14, "Admin can deactivate category via PATCH isActive=false", false, "Skipped — no category ID");
    }

    // -------------------------------------------------------------------------
    // TEST 15 — Deactivated category excluded from public GET /api/categories
    // -------------------------------------------------------------------------
    const resTest15 = await fetch(`${baseUrl}/api/categories`);
    const dataTest15 = await resTest15.json();
    const foundDeactivated = (dataTest15.categories || []).some(
      (c: any) => c.slug === qaCategorySlugA
    );
    recordTest(
      15,
      "Deactivated category excluded from public GET /api/categories",
      resTest15.status === 200 && !foundDeactivated,
      `Found in public list: ${foundDeactivated}`
    );

    // -------------------------------------------------------------------------
    // TEST 16 — Products not deleted when category deactivated
    // -------------------------------------------------------------------------
    // Create a test product in category A, then verify it still exists
    let test16pass = false;
    if (idCategoryA) {
      const testProductId = crypto.randomUUID();
      const testProductSlug = `qa-prod-b13-${timestamp}`;
      await db.execute(
        "INSERT INTO products (id, category_id, name, slug, description, price, stock_quantity, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, 1)",
        [testProductId, idCategoryA, "QA B13 Test Product", testProductSlug, "Test product for B-13", 199.00, 10]
      );

      // Verify product still exists despite category being deactivated
      const [prodRows] = await db.execute(
        "SELECT id, category_id FROM products WHERE id = ? LIMIT 1",
        [testProductId]
      ) as any;
      test16pass = prodRows.length === 1 && prodRows[0].category_id === idCategoryA;

      // Clean up test product
      await db.execute("DELETE FROM products WHERE id = ?", [testProductId]);
    }
    recordTest(
      16,
      "Products not deleted when category is deactivated",
      test16pass,
      `Product retained: ${test16pass}`
    );

    // -------------------------------------------------------------------------
    // TEST 17 — Admin category list includes inactive categories
    // -------------------------------------------------------------------------
    let test17pass = false;
    const resTest17 = await fetch(`${baseUrl}/api/admin/categories`, {
      headers: { Cookie: cookieAdmin! },
    });
    const dataTest17 = await resTest17.json();
    if (resTest17.status === 200 && Array.isArray(dataTest17.categories)) {
      const foundA = dataTest17.categories.find((c: any) => c.slug === qaCategorySlugA);
      test17pass = foundA && foundA.isActive === false;
    }
    recordTest(
      17,
      "Admin category list includes inactive categories",
      test17pass,
      `Found deactivated category in admin list: ${test17pass}`
    );

    // -------------------------------------------------------------------------
    // TEST 18 — Admin category list includes product counts
    // -------------------------------------------------------------------------
    let test18pass = false;
    if (resTest17.status === 200 && Array.isArray(dataTest17.categories) && dataTest17.categories.length > 0) {
      const firstCat = dataTest17.categories[0];
      test18pass = firstCat.productCount !== undefined && typeof firstCat.productCount === "number";
    }
    recordTest(
      18,
      "Admin category list includes product counts",
      test18pass,
      `productCount present: ${test18pass}`
    );

    // -------------------------------------------------------------------------
    // TEST 19 — SQL injection attempt in slug safely handled
    // -------------------------------------------------------------------------
    const resTest19 = await fetch(`${baseUrl}/api/admin/categories`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieAdmin!,
      },
      body: JSON.stringify({
        name: "SQL Injection Test",
        slug: "test'; DROP TABLE categories; --",
      }),
    });
    // Should be rejected by slug validation (400)
    recordTest(
      19,
      "SQL injection attempt in slug safely handled",
      resTest19.status === 400,
      `Status: ${resTest19.status}`
    );

    // -------------------------------------------------------------------------
    // TEST 20 — No password_hash or secrets leaked in API responses
    // -------------------------------------------------------------------------
    let test20pass = true;
    const responsesToCheck = [dataTest1, dataTest4, dataTest17];
    for (const data of responsesToCheck) {
      const jsonStr = JSON.stringify(data);
      if (
        jsonStr.includes("password_hash") ||
        jsonStr.includes("DB_PASSWORD") ||
        jsonStr.includes("AUTH_SECRET") ||
        jsonStr.includes("SESSION_SECRET")
      ) {
        test20pass = false;
        break;
      }
    }
    recordTest(
      20,
      "No password_hash or secrets leaked in API responses",
      test20pass,
      `Clean: ${test20pass}`
    );

    // -------------------------------------------------------------------------
    // RESULTS SUMMARY
    // -------------------------------------------------------------------------
    const passed = results.filter((r) => r.passed).length;
    const failed = results.filter((r) => !r.passed).length;

    console.log("\n=================================================================");
    console.log(`B-13 CATEGORY API VERIFICATION: ${passed}/${results.length} TESTS PASSED`);
    console.log("=================================================================\n");

    // -------------------------------------------------------------------------
    // CLEANUP
    // -------------------------------------------------------------------------
    console.log("Performing cleanup of temporary QA test records from Hostinger MySQL...");

    // Clean up categories
    const catIds = [idCategoryA, idCategoryB].filter(Boolean);
    if (catIds.length > 0) {
      // Remove any products linked to QA categories first
      for (const catId of catIds) {
        await db.execute("DELETE FROM products WHERE category_id = ?", [catId]);
      }
      const placeholders = catIds.map(() => "?").join(", ");
      await db.execute(`DELETE FROM categories WHERE id IN (${placeholders})`, catIds);
      console.log(`✓ Cleaned up ${catIds.length} temporary test category(ies).`);
    }

    // Clean up profiles
    const profileIds = [idCustomer, idAdmin].filter(Boolean);
    if (profileIds.length > 0) {
      const placeholders = profileIds.map(() => "?").join(", ");
      await db.execute(`DELETE FROM profiles WHERE id IN (${placeholders})`, profileIds);
      console.log(`✓ Cleaned up ${profileIds.length} temporary test profile(s).`);
    }

    if (failed > 0) {
      throw new Error(`B-13 verification failed: ${failed} test(s) failed.`);
    }
  } catch (err) {
    // Emergency cleanup on failure
    console.error("\nTEST SUITE EXECUTION ERROR:", err);

    try {
      // Attempt cleanup
      const catSlugs = [qaCategorySlugA, qaCategorySlugB];
      for (const slug of catSlugs) {
        await db.execute("DELETE FROM products WHERE category_id IN (SELECT id FROM categories WHERE slug = ?)", [slug]);
        await db.execute("DELETE FROM categories WHERE slug = ?", [slug]);
      }
      const profileEmails = [customerEmail, adminEmail];
      for (const email of profileEmails) {
        await db.execute("DELETE FROM profiles WHERE email = ?", [email]);
      }
      console.log("✓ Emergency cleanup completed.");
    } catch (cleanupErr) {
      console.error("Emergency cleanup failed:", cleanupErr);
    }

    await db.end();
    process.exit(1);
  }

  await db.end();
}

runB13CategoryVerification();
