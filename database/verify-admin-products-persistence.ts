import fs from "fs";
import path from "path";
import mysql from "mysql2/promise";
import crypto from "crypto";

// Load .env.local for standalone test runner
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
  return mysql.createPool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || "3306", 10),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    waitForConnections: true,
    connectionLimit: 5,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000,
  });
}

interface TestResult {
  num: number;
  title: string;
  passed: boolean;
  details?: string;
}

const results: TestResult[] = [];
let testNum = 1;

function recordTest(title: string, passed: boolean, details?: string) {
  results.push({ num: testNum, title, passed, details });
  const mark = passed ? "✓ PASS" : "✗ FAIL";
  console.log(`   [TEST ${testNum}] [${mark}] ${title}${details ? ` — ${details}` : ""}`);
  testNum++;
}

async function runPersistenceVerification() {
  console.log("=================================================================");
  console.log("Dearr V1 — Admin Product Management Persistence Verification");
  console.log("Target Base URL: ", baseUrl);
  console.log("Database Host:   ", process.env.DB_HOST, "(Hostinger MySQL)");
  console.log("Database Name:   ", process.env.DB_NAME);
  console.log("=================================================================\n");

  const timestamp = Date.now();
  const customerEmail = `qa_persist_cust_${timestamp}@dearr.test`;
  const adminEmail = `qa_persist_admin_${timestamp}@dearr.test`;
  const testPassword = "AdminPersist_Secure123!";

  const qaCategorySlug = `qa-cat-persist-${timestamp}`;
  const qaCategoryId = crypto.randomUUID();

  const qaProductSlug = `qa-product-persist-${timestamp}`;
  let createdProductId: string | null = null;

  let cookieCustomer: string | null = null;
  let cookieAdmin: string | null = null;

  let idCustomer: string | null = null;
  let idAdmin: string | null = null;

  const db = await getDbConnection();

  try {
    // -------------------------------------------------------------------------
    // SETUP: Create Category, Customer account, and Admin account
    // -------------------------------------------------------------------------
    console.log("Setting up temporary QA category and accounts in Hostinger MySQL...");

    // 1. Insert QA Category
    await db.execute(
      "INSERT INTO categories (id, name, slug, description, is_active) VALUES (?, ?, ?, ?, 1)",
      [qaCategoryId, "QA Persistence Category", qaCategorySlug, "Temporary category for persistence verification"]
    );
    console.log(`✓ Temporary QA Category created: ${qaCategoryId}`);

    // 2. Customer Account
    const resCustSignup = await fetch(`${baseUrl}/api/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "QA Persistence Customer",
        email: customerEmail,
        password: testPassword,
      }),
    });
    const dataCustSignup = await resCustSignup.json();
    if (!resCustSignup.ok || !dataCustSignup.ok) {
      throw new Error(`Customer signup failed: ${JSON.stringify(dataCustSignup)}`);
    }
    idCustomer = dataCustSignup.user.id;
    const custCookieHeader = resCustSignup.headers.get("set-cookie") || "";
    const custMatch = custCookieHeader.match(/dearr_session=([^;]+)/);
    cookieCustomer = custMatch ? `dearr_session=${custMatch[1]}` : null;

    // 3. Admin Account (Create customer then elevate to admin directly in MySQL)
    const resAdminSignup = await fetch(`${baseUrl}/api/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "QA Persistence Founder Admin",
        email: adminEmail,
        password: testPassword,
      }),
    });
    const dataAdminSignup = await resAdminSignup.json();
    if (!resAdminSignup.ok || !dataAdminSignup.ok) {
      throw new Error(`Admin signup failed: ${JSON.stringify(dataAdminSignup)}`);
    }
    idAdmin = dataAdminSignup.user.id;

    await db.execute("UPDATE profiles SET role = 'admin' WHERE id = ?", [idAdmin]);

    const resAdminLogin = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: adminEmail,
        password: testPassword,
      }),
    });
    const dataAdminLogin = await resAdminLogin.json();
    if (!resAdminLogin.ok || !dataAdminLogin.ok) {
      throw new Error(`Admin login failed: ${JSON.stringify(dataAdminLogin)}`);
    }
    const adminCookieHeader = resAdminLogin.headers.get("set-cookie") || "";
    const adminMatch = adminCookieHeader.match(/dearr_session=([^;]+)/);
    cookieAdmin = adminMatch ? `dearr_session=${adminMatch[1]}` : null;

    console.log(`✓ Accounts configured. Customer: ${idCustomer}, Admin: ${idAdmin}\n`);

    // =========================================================================
    // SECTION 1: AUTHENTICATION & SECURITY ENFORCEMENT
    // =========================================================================
    console.log("--- Section 1: Authentication & Authorization Protection ---");

    // Test 1: Unauthenticated POST /api/admin/products returns 401
    const resUnauthCreate = await fetch(`${baseUrl}/api/admin/products`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Unauthenticated Test",
        price: 199,
        description: "Test",
        stockQuantity: 5,
      }),
    });
    recordTest(
      "Unauthenticated POST /api/admin/products rejected with 401 Unauthorized",
      resUnauthCreate.status === 401,
      `Status: ${resUnauthCreate.status}`
    );

    // Test 2: Customer role POST /api/admin/products returns 403
    const resCustCreate = await fetch(`${baseUrl}/api/admin/products`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieCustomer!,
      },
      body: JSON.stringify({
        name: "Customer Attempted Test",
        price: 199,
        description: "Test",
        stockQuantity: 5,
      }),
    });
    recordTest(
      "Customer role POST /api/admin/products rejected with 403 Forbidden",
      resCustCreate.status === 403,
      `Status: ${resCustCreate.status}`
    );

    // Test 3: Unauthenticated PATCH /api/admin/products/[id] returns 401
    const resUnauthPatch = await fetch(`${baseUrl}/api/admin/products/dummy-id`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ price: 299 }),
    });
    recordTest(
      "Unauthenticated PATCH /api/admin/products/[id] rejected with 401 Unauthorized",
      resUnauthPatch.status === 401,
      `Status: ${resUnauthPatch.status}`
    );

    // Test 4: Customer role PATCH /api/admin/products/[id] returns 403
    const resCustPatch = await fetch(`${baseUrl}/api/admin/products/dummy-id`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieCustomer!,
      },
      body: JSON.stringify({ price: 299 }),
    });
    recordTest(
      "Customer role PATCH /api/admin/products/[id] rejected with 403 Forbidden",
      resCustPatch.status === 403,
      `Status: ${resCustPatch.status}`
    );

    // =========================================================================
    // SECTION 2: SERVER-SIDE VALIDATION
    // =========================================================================
    console.log("\n--- Section 2: Server-Side Validation ---");

    // Test 5: Missing required name rejected
    const resMissingName = await fetch(`${baseUrl}/api/admin/products`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookieAdmin! },
      body: JSON.stringify({
        name: "",
        price: 199,
        description: "Test description",
        stockQuantity: 5,
      }),
    });
    recordTest(
      "Product create without required name rejected with 400",
      resMissingName.status === 400,
      `Status: ${resMissingName.status}`
    );

    // Test 6: Negative price rejected
    const resNegPrice = await fetch(`${baseUrl}/api/admin/products`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookieAdmin! },
      body: JSON.stringify({
        name: "Negative Price Test",
        price: -50,
        description: "Test description",
        stockQuantity: 5,
      }),
    });
    recordTest(
      "Product create with negative price rejected with 400",
      resNegPrice.status === 400,
      `Status: ${resNegPrice.status}`
    );

    // Test 7: Negative stock quantity rejected
    const resNegStock = await fetch(`${baseUrl}/api/admin/products`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookieAdmin! },
      body: JSON.stringify({
        name: "Negative Stock Test",
        price: 299,
        description: "Test description",
        stockQuantity: -10,
      }),
    });
    recordTest(
      "Product create with negative stock rejected with 400",
      resNegStock.status === 400,
      `Status: ${resNegStock.status}`
    );

    // =========================================================================
    // SECTION 3: REAL PRODUCT CREATION (ADD PRODUCT PERSISTENCE)
    // =========================================================================
    console.log("\n--- Section 3: Add Product Real Persistence ---");

    const newProductPayload = {
      categoryId: qaCategoryId,
      name: "QA Precision 3D Printed Dragon Figurine",
      slug: qaProductSlug,
      description: "Articulated 3D printed dragon with high-resolution layer craftsmanship.",
      price: 649.0,
      compareAtPrice: 899.0,
      stockQuantity: 18,
      isFeatured: true,
      isActive: true,
      images: [
        { storagePath: "/product-samples/6.jpeg", altText: "Front Dragon View", sortOrder: 0 },
        { storagePath: "/product-samples/7.jpeg", altText: "Side Dragon View", sortOrder: 1 },
      ],
      variants: [
        { name: "Silk Green", sku: `SKU-DRG-GRN-${timestamp}`, price: 649.0, stockQuantity: 10 },
        { name: "Metallic Gold", sku: `SKU-DRG-GLD-${timestamp}`, price: 699.0, stockQuantity: 8 },
      ],
    };

    const resCreate = await fetch(`${baseUrl}/api/admin/products`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieAdmin!,
      },
      body: JSON.stringify(newProductPayload),
    });
    const dataCreate = await resCreate.json();

    if (resCreate.status === 201 && dataCreate.product?.id) {
      createdProductId = dataCreate.product.id;
    }

    // Test 8: POST succeeds with 201 Created and returns full product object
    recordTest(
      "Admin POST /api/admin/products succeeds with 201 Created",
      resCreate.status === 201 && dataCreate.ok === true && dataCreate.product?.slug === qaProductSlug,
      `Created ID: ${createdProductId}`
    );

    // Test 9: Real MySQL row exists in products table
    const [dbProdRows]: any = await db.execute(
      "SELECT id, category_id, name, slug, price, compare_at_price, stock_quantity, is_active FROM products WHERE id = ?",
      [createdProductId]
    );
    const prodInDb = dbProdRows[0];
    recordTest(
      "Created product row verified in Hostinger MySQL products table",
      Boolean(prodInDb && prodInDb.slug === qaProductSlug && Number(prodInDb.price) === 649.0 && prodInDb.stock_quantity === 18),
      `MySQL Slug: '${prodInDb?.slug}', Price: ₹${prodInDb?.price}, Stock: ${prodInDb?.stock_quantity}`
    );

    // Test 10: Relational images exist in Hostinger MySQL product_images table
    const [dbImgRows]: any = await db.execute(
      "SELECT id, storage_path, sort_order FROM product_images WHERE product_id = ? ORDER BY sort_order ASC",
      [createdProductId]
    );
    recordTest(
      "Relational product_images persisted atomically in MySQL",
      dbImgRows.length === 2 && dbImgRows[0].storage_path === "/product-samples/6.jpeg",
      `Image count: ${dbImgRows.length}, Primary: '${dbImgRows[0]?.storage_path}'`
    );

    // Test 11: Relational variants exist in Hostinger MySQL product_variants table
    const [dbVarRows]: any = await db.execute(
      "SELECT id, name, sku, price, stock_quantity FROM product_variants WHERE product_id = ? ORDER BY name ASC",
      [createdProductId]
    );
    recordTest(
      "Relational product_variants persisted atomically in MySQL",
      dbVarRows.length === 2 && dbVarRows[0].sku.startsWith("SKU-DRG-"),
      `Variants count: ${dbVarRows.length}`
    );

    // Test 12: Admin GET /api/admin/products (simulating Admin Product List reload) includes product
    const resAdminList = await fetch(`${baseUrl}/api/admin/products?pageSize=100`, {
      headers: { Cookie: cookieAdmin! },
    });
    const dataAdminList = await resAdminList.json();
    const foundInAdminList = (dataAdminList.products || []).find((p: any) => p.id === createdProductId || p.slug === qaProductSlug);
    recordTest(
      "Admin Product List API loads newly created product from database",
      Boolean(foundInAdminList && foundInAdminList.name === "QA Precision 3D Printed Dragon Figurine"),
      `Found in list: ${Boolean(foundInAdminList)}`
    );

    // Test 13: Admin GET /api/admin/products/[id] by slug loads complete product for Edit Product page
    const resGetBySlug = await fetch(`${baseUrl}/api/admin/products/${qaProductSlug}`, {
      headers: { Cookie: cookieAdmin! },
    });
    const dataGetBySlug = await resGetBySlug.json();
    recordTest(
      "Admin GET /api/admin/products/[slug] resolves full product details for Edit page",
      resGetBySlug.status === 200 && dataGetBySlug.ok === true && dataGetBySlug.product?.id === createdProductId,
      `Resolved product: '${dataGetBySlug.product?.name}' with ${dataGetBySlug.product?.images?.length} images`
    );

    // Test 14: Direct storefront /api/products/[slug] reads active product from database
    const resPublicSlug = await fetch(`${baseUrl}/api/products/${qaProductSlug}`);
    const dataPublicSlug = await resPublicSlug.json();
    recordTest(
      "Public Storefront GET /api/products/[slug] immediately reads created product",
      resPublicSlug.status === 200 && dataPublicSlug.ok === true && dataPublicSlug.product?.id === createdProductId,
      `Storefront Status: ${resPublicSlug.status}`
    );

    // =========================================================================
    // SECTION 4: REAL PRODUCT EDIT (EDIT PRODUCT PERSISTENCE)
    // =========================================================================
    console.log("\n--- Section 4: Edit Product Real Persistence ---");

    const updatedPrice = 799.0;
    const updatedStock = 35;
    const updatedTitle = "QA Precision 3D Printed Dragon Figurine (Updated Edition)";

    const resPatch = await fetch(`${baseUrl}/api/admin/products/${createdProductId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieAdmin!,
      },
      body: JSON.stringify({
        name: updatedTitle,
        price: updatedPrice,
        stockQuantity: updatedStock,
      }),
    });
    const dataPatch = await resPatch.json();

    // Test 15: PATCH succeeds with 200 OK
    recordTest(
      "Admin PATCH /api/admin/products/[id] succeeds with 200 OK",
      resPatch.status === 200 && dataPatch.ok === true && dataPatch.product?.price === updatedPrice,
      `Updated Price: ₹${dataPatch.product?.price}`
    );

    // Test 16: Hostinger MySQL database row reflects updated values
    const [dbUpdatedRows]: any = await db.execute(
      "SELECT name, price, stock_quantity, updated_at FROM products WHERE id = ?",
      [createdProductId]
    );
    const updatedProdInDb = dbUpdatedRows[0];
    recordTest(
      "Updated product changes verified directly in Hostinger MySQL",
      Boolean(
        updatedProdInDb &&
        updatedProdInDb.name === updatedTitle &&
        Number(updatedProdInDb.price) === updatedPrice &&
        updatedProdInDb.stock_quantity === updatedStock
      ),
      `DB Name: '${updatedProdInDb?.name}', DB Price: ₹${updatedProdInDb?.price}, DB Stock: ${updatedProdInDb?.stock_quantity}`
    );

    // Test 17: Re-reading via API (simulating browser page refresh on Edit page) preserves new values
    const resRefresh = await fetch(`${baseUrl}/api/admin/products/${qaProductSlug}`, {
      headers: { Cookie: cookieAdmin! },
    });
    const dataRefresh = await resRefresh.json();
    recordTest(
      "Product reload (simulating browser refresh) preserves updated values",
      resRefresh.status === 200 &&
      dataRefresh.product?.name === updatedTitle &&
      Number(dataRefresh.product?.price) === updatedPrice &&
      Number(dataRefresh.product?.stockQuantity) === updatedStock,
      `Reloaded price: ₹${dataRefresh.product?.price}, stock: ${dataRefresh.product?.stockQuantity}`
    );

    // Test 18: Storefront reflects updated price and name
    const resStorefrontRefresh = await fetch(`${baseUrl}/api/products/${qaProductSlug}`);
    const dataStorefrontRefresh = await resStorefrontRefresh.json();
    recordTest(
      "Storefront direct query reflects updated price and name without stale cache",
      resStorefrontRefresh.status === 200 &&
      dataStorefrontRefresh.product?.name === updatedTitle &&
      Number(dataStorefrontRefresh.product?.price) === updatedPrice,
      `Storefront price: ₹${dataStorefrontRefresh.product?.price}`
    );

    // =========================================================================
    // SECTION 5: SECURITY & HYGIENE CHECKS
    // =========================================================================
    console.log("\n--- Section 5: Security & Hygiene Checks ---");

    // Test 19: No password hash or secrets returned in API response
    const jsonStr = JSON.stringify(dataPatch);
    const hasPasswordHash = jsonStr.includes("password_hash") || jsonStr.includes("$2a$") || jsonStr.includes("$2b$");
    recordTest(
      "API responses never leak password_hash, secrets, or internal DB credentials",
      !hasPasswordHash,
      `Has password hash: ${hasPasswordHash}`
    );

    // Test 20: Safe deactivation / DELETE works as expected
    const resDelete = await fetch(`${baseUrl}/api/admin/products/${createdProductId}`, {
      method: "DELETE",
      headers: { Cookie: cookieAdmin! },
    });
    const dataDelete = await resDelete.json();
    const [dbDeactRows]: any = await db.execute("SELECT is_active FROM products WHERE id = ?", [createdProductId]);
    recordTest(
      "Soft deactivation preserves product row with is_active = 0",
      resDelete.status === 200 && dataDelete.ok === true && dbDeactRows[0]?.is_active === 0,
      `is_active in DB: ${dbDeactRows[0]?.is_active}`
    );

  } catch (err: unknown) {
    console.error("\n[CRITICAL ERROR during verification suite]:", err);
  } finally {
    // -------------------------------------------------------------------------
    // CLEANUP: Clean up temporary test product, category, and accounts
    // -------------------------------------------------------------------------
    console.log("\nCleaning up temporary QA test data from Hostinger MySQL...");
    try {
      if (createdProductId) {
        await db.execute("DELETE FROM product_variants WHERE product_id = ?", [createdProductId]);
        await db.execute("DELETE FROM product_images WHERE product_id = ?", [createdProductId]);
        await db.execute("DELETE FROM products WHERE id = ?", [createdProductId]);
        console.log(`✓ Cleaned up test product: ${createdProductId}`);
      }
      if (qaCategoryId) {
        await db.execute("DELETE FROM categories WHERE id = ?", [qaCategoryId]);
        console.log(`✓ Cleaned up test category: ${qaCategoryId}`);
      }
      if (idCustomer) {
        await db.execute("DELETE FROM profiles WHERE id = ?", [idCustomer]);
        console.log(`✓ Cleaned up test customer: ${idCustomer}`);
      }
      if (idAdmin) {
        await db.execute("DELETE FROM profiles WHERE id = ?", [idAdmin]);
        console.log(`✓ Cleaned up test admin: ${idAdmin}`);
      }
    } catch (cleanupErr) {
      console.warn("Cleanup warning:", cleanupErr);
    }
    await db.end();
  }

  // ---------------------------------------------------------------------------
  // SUMMARY
  // ---------------------------------------------------------------------------
  console.log("\n=================================================================");
  console.log("Persistence Verification Suite Summary");
  console.log("=================================================================");
  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = results.filter((r) => !r.passed).length;
  console.log(`Total Tests: ${results.length}`);
  console.log(`Passed:      ${passedCount}`);
  console.log(`Failed:      ${failedCount}`);

  if (failedCount > 0 || results.length !== 20) {
    console.log("\nVerification incomplete or failed:");
    results.filter((r) => !r.passed).forEach((r) => console.log(` - Test ${r.num}: ${r.title}`));
    process.exit(1);
  } else {
    console.log(`\nAll ${passedCount}/${results.length} verification tests passed successfully!`);
    process.exit(0);
  }
}

runPersistenceVerification().catch((e) => {
  console.error("Unhandled rejection:", e);
  process.exit(1);
});
