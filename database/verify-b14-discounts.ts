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
  return mysql.createPool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || "3306", 10),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    waitForConnections: true,
    connectionLimit: 5,
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
  console.log(`   [TEST ${num.toString().padStart(2, "0")}] [${mark}] ${title}${details ? ` — ${details}` : ""}`);
}

async function runB14DiscountVerification() {
  console.log("=================================================================");
  console.log("Dearr V1 — Task B-14: Discount API & Precedence Rule Verification");
  console.log("Target Base URL: ", baseUrl);
  console.log("Database Host:   ", process.env.DB_HOST, "(Hostinger MySQL)");
  console.log("Database Name:   ", process.env.DB_NAME);
  console.log("=================================================================\n");

  const timestamp = Date.now();
  const customerEmail = `qa_b14_cust_${timestamp}@dearr.test`;
  const adminEmail = `qa_b14_admin_${timestamp}@dearr.test`;
  const testPassword = "B14_SecurePassword123!";

  let cookieCustomer: string | null = null;
  let cookieAdmin: string | null = null;

  let idCustomer: string | null = null;
  let idAdmin: string | null = null;

  // QA Categories and Products for testing
  const qaCatIdLamps = crypto.randomUUID();
  const qaCatIdToys = crypto.randomUUID();
  const qaProdIdDragon = crypto.randomUUID();
  const qaProdIdDesk = crypto.randomUUID();
  const qaProdIdToy = crypto.randomUUID();

  // Created discounts to clean up
  const createdDiscountIds: string[] = [];

  const db = await getDbConnection();

  try {
    // -------------------------------------------------------------------------
    // PRE-FLIGHT CLEANUP: Remove any stale QA records from previous runs
    // -------------------------------------------------------------------------
    await db.execute("DELETE FROM discount_products WHERE discount_id IN (SELECT id FROM discounts WHERE name LIKE 'QA%' OR code LIKE 'QA%')");
    await db.execute("DELETE FROM discount_categories WHERE discount_id IN (SELECT id FROM discounts WHERE name LIKE 'QA%' OR code LIKE 'QA%')");
    await db.execute("DELETE FROM discounts WHERE name LIKE 'QA%' OR code LIKE 'QA%'");
    await db.execute("DELETE FROM products WHERE name LIKE 'QA%'");
    await db.execute("DELETE FROM categories WHERE name LIKE 'QA%'");
    await db.execute("DELETE FROM profiles WHERE email LIKE 'qa_%'");

    // -------------------------------------------------------------------------
    // SETUP: Create QA Users, Categories & Products in Hostinger MySQL
    // -------------------------------------------------------------------------
    console.log("Setting up temporary QA fixtures in Hostinger MySQL...\n");

    // 1. Customer Account
    const resCustSignup = await fetch(`${baseUrl}/api/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "QA B14 Customer",
        email: customerEmail,
        password: testPassword,
      }),
    });
    const custData = await resCustSignup.json();
    idCustomer = custData.user?.id || null;
    const setCookieCust = resCustSignup.headers.get("set-cookie") || "";
    cookieCustomer = setCookieCust.split(";")[0] || null;
    console.log(`✓ Customer account created: ${idCustomer}`);

    // 2. Admin Account
    idAdmin = crypto.randomUUID();
    const adminHash = await bcrypt.hash(testPassword, 10);
    await db.execute(
      "INSERT INTO profiles (id, email, password_hash, full_name, role) VALUES (?, ?, ?, ?, 'admin')",
      [idAdmin, adminEmail, adminHash, "QA B14 Admin"]
    );

    const resAdminLogin = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: adminEmail, password: testPassword }),
    });
    const setCookieAdmin = resAdminLogin.headers.get("set-cookie") || "";
    cookieAdmin = setCookieAdmin.split(";")[0] || null;
    console.log(`✓ Admin account created:    ${idAdmin}`);

    // 3. QA Categories
    await db.execute(
      "INSERT INTO categories (id, name, slug, description, is_active) VALUES (?, ?, ?, ?, 1)",
      [qaCatIdLamps, "QA Lamps", `qa-lamps-${timestamp}`, "Test Lamp Category"]
    );
    await db.execute(
      "INSERT INTO categories (id, name, slug, description, is_active) VALUES (?, ?, ?, ?, 1)",
      [qaCatIdToys, "QA Toys", `qa-toys-${timestamp}`, "Test Toy Category"]
    );
    console.log(`✓ QA Categories created: Lamps (${qaCatIdLamps}), Toys (${qaCatIdToys})`);

    // 4. QA Products
    // Dragon Lamp (Lamps category, price 1000)
    await db.execute(
      "INSERT INTO products (id, category_id, name, slug, description, price, stock_quantity, is_active) VALUES (?, ?, ?, ?, ?, 1000.00, 10, 1)",
      [qaProdIdDragon, qaCatIdLamps, "QA Dragon Lamp", `qa-dragon-lamp-${timestamp}`, "Dragon lamp"]
    );
    // Desk Lamp (Lamps category, price 500)
    await db.execute(
      "INSERT INTO products (id, category_id, name, slug, description, price, stock_quantity, is_active) VALUES (?, ?, ?, ?, ?, 500.00, 10, 1)",
      [qaProdIdDesk, qaCatIdLamps, "QA Desk Lamp", `qa-desk-lamp-${timestamp}`, "Desk lamp"]
    );
    // Action Figure (Toys category, price 800)
    await db.execute(
      "INSERT INTO products (id, category_id, name, slug, description, price, stock_quantity, is_active) VALUES (?, ?, ?, ?, ?, 800.00, 10, 1)",
      [qaProdIdToy, qaCatIdToys, "QA Action Figure", `qa-action-figure-${timestamp}`, "Toy figure"]
    );
    console.log(`✓ QA Products created: Dragon Lamp, Desk Lamp, Action Figure\n`);

    // -------------------------------------------------------------------------
    // TEST 1 — Public active discount endpoint works (200 OK)
    // -------------------------------------------------------------------------
    const resTest1 = await fetch(`${baseUrl}/api/discounts/active`);
    const dataTest1 = await resTest1.json();
    recordTest(
      1,
      "Public GET /api/discounts/active returns 200 OK",
      resTest1.status === 200 && dataTest1.ok === true && Array.isArray(dataTest1.discounts),
      `Status: ${resTest1.status}, Count: ${dataTest1.discounts?.length ?? "N/A"}`
    );

    // -------------------------------------------------------------------------
    // TEST 2 — Authorization: unauthenticated POST /api/admin/discounts returns 401
    // -------------------------------------------------------------------------
    const resTest2 = await fetch(`${baseUrl}/api/admin/discounts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Unauth Discount",
        discountType: "percentage",
        value: 10,
        scope: "store",
        startAt: new Date().toISOString(),
      }),
    });
    recordTest(
      2,
      "Unauthenticated discount creation returns 401 Unauthorized",
      resTest2.status === 401,
      `Status: ${resTest2.status}`
    );

    // -------------------------------------------------------------------------
    // TEST 3 — Authorization: customer role returns 403 Forbidden
    // -------------------------------------------------------------------------
    const resTest3 = await fetch(`${baseUrl}/api/admin/discounts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieCustomer!,
      },
      body: JSON.stringify({
        name: "Customer Attempt",
        discountType: "percentage",
        value: 10,
        scope: "store",
        startAt: new Date().toISOString(),
      }),
    });
    recordTest(
      3,
      "Customer role discount creation returns 403 Forbidden",
      resTest3.status === 403,
      `Status: ${resTest3.status}`
    );

    // -------------------------------------------------------------------------
    // TEST 4 — Store-wide discount creation by Admin (201 Created)
    // -------------------------------------------------------------------------
    const codeStore = `QA_STORE_${timestamp}`;
    const resTest4 = await fetch(`${baseUrl}/api/admin/discounts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieAdmin!,
      },
      body: JSON.stringify({
        name: "QA Storewide 10%",
        code: codeStore,
        discountType: "percentage",
        value: 10,
        scope: "store",
        startAt: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
        endAt: new Date(Date.now() + 86400000).toISOString(),  // 1 day future
        isActive: true,
      }),
    });
    const dataTest4 = await resTest4.json();
    let idStoreDiscount = dataTest4.discount?.id;
    if (idStoreDiscount) createdDiscountIds.push(idStoreDiscount);

    recordTest(
      4,
      "Admin can create a store-wide discount (201 Created)",
      resTest4.status === 201 && dataTest4.ok === true && dataTest4.discount?.scope === "store",
      `ID: ${idStoreDiscount}`
    );

    // -------------------------------------------------------------------------
    // TEST 5 — Category-scoped discount creation (201 Created)
    // -------------------------------------------------------------------------
    const codeCat = `QA_CAT_${timestamp}`;
    const resTest5 = await fetch(`${baseUrl}/api/admin/discounts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieAdmin!,
      },
      body: JSON.stringify({
        name: "QA Lamps 20%",
        code: codeCat,
        discountType: "percentage",
        value: 20,
        scope: "category",
        categoryId: qaCatIdLamps,
        startAt: new Date(Date.now() - 3600000).toISOString(),
        endAt: new Date(Date.now() + 86400000).toISOString(),
        isActive: true,
      }),
    });
    const dataTest5 = await resTest5.json();
    let idCatDiscount = dataTest5.discount?.id;
    if (idCatDiscount) createdDiscountIds.push(idCatDiscount);

    recordTest(
      5,
      "Admin can create a category-scoped discount (201 Created)",
      resTest5.status === 201 && dataTest5.ok === true && dataTest5.discount?.categoryIds?.includes(qaCatIdLamps),
      `ID: ${idCatDiscount}`
    );

    // -------------------------------------------------------------------------
    // TEST 6 — Product-specific discount creation (201 Created)
    // -------------------------------------------------------------------------
    const codeProd = `QA_PROD_${timestamp}`;
    const resTest6 = await fetch(`${baseUrl}/api/admin/discounts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieAdmin!,
      },
      body: JSON.stringify({
        name: "QA Dragon Lamp 30%",
        code: codeProd,
        discountType: "percentage",
        value: 30,
        scope: "product",
        productId: qaProdIdDragon,
        startAt: new Date(Date.now() - 3600000).toISOString(),
        endAt: new Date(Date.now() + 86400000).toISOString(),
        isActive: true,
      }),
    });
    const dataTest6 = await resTest6.json();
    let idProdDiscount = dataTest6.discount?.id;
    if (idProdDiscount) createdDiscountIds.push(idProdDiscount);

    recordTest(
      6,
      "Admin can create a product-specific discount (201 Created)",
      resTest6.status === 201 && dataTest6.ok === true && dataTest6.discount?.productIds?.includes(qaProdIdDragon),
      `ID: ${idProdDiscount}`
    );

    // -------------------------------------------------------------------------
    // TEST 7 — Join table records created in MySQL
    // -------------------------------------------------------------------------
    const [joinProdRows] = (await db.execute(
      "SELECT * FROM discount_products WHERE discount_id = ?",
      [idProdDiscount]
    )) as any;
    const [joinCatRows] = (await db.execute(
      "SELECT * FROM discount_categories WHERE discount_id = ?",
      [idCatDiscount]
    )) as any;

    recordTest(
      7,
      "Join table rows created in discount_products & discount_categories",
      joinProdRows.length === 1 &&
        joinProdRows[0].product_id === qaProdIdDragon &&
        joinCatRows.length === 1 &&
        joinCatRows[0].category_id === qaCatIdLamps,
      `Prod Join: ${joinProdRows.length}, Cat Join: ${joinCatRows.length}`
    );

    // -------------------------------------------------------------------------
    // TEST 8 — Precedence Rule: Dragon Lamp matches product (30%), category (20%), store (10%)
    // Result MUST BE 30% (Product scope wins, NO STACKING!)
    // -------------------------------------------------------------------------
    const resTest8 = await fetch(`${baseUrl}/api/discounts/active?productId=${qaProdIdDragon}`);
    const dataTest8 = await resTest8.json();
    const dragonApp = dataTest8.applicable;

    const test8pass =
      resTest8.status === 200 &&
      dragonApp !== null &&
      dragonApp.precedence === "product" &&
      dragonApp.discount?.value === 30 &&
      dragonApp.discountAmount === 300 &&
      dragonApp.finalPrice === 700; // 1000 - 300 = 700

    recordTest(
      8,
      "Precedence: Product discount takes priority over category & store (30% off ₹1000 = ₹700, no stacking)",
      test8pass,
      `Discount Amount: ₹${dragonApp?.discountAmount}, Final: ₹${dragonApp?.finalPrice}`
    );

    // -------------------------------------------------------------------------
    // TEST 9 — Precedence Rule: Desk Lamp matches category (20%) and store (10%)
    // Result MUST BE 20% (Category scope wins, NO STACKING!)
    // -------------------------------------------------------------------------
    const resTest9 = await fetch(`${baseUrl}/api/discounts/active?productId=${qaProdIdDesk}`);
    const dataTest9 = await resTest9.json();
    const deskApp = dataTest9.applicable;

    const test9pass =
      resTest9.status === 200 &&
      deskApp !== null &&
      deskApp.precedence === "category" &&
      deskApp.discount?.value === 20 &&
      deskApp.discountAmount === 100 &&
      deskApp.finalPrice === 400; // 500 - 100 = 400

    recordTest(
      9,
      "Precedence: Category discount takes priority over store (20% off ₹500 = ₹400, no stacking)",
      test9pass,
      `Discount Amount: ₹${deskApp?.discountAmount}, Final: ₹${deskApp?.finalPrice}`
    );

    // -------------------------------------------------------------------------
    // TEST 10 — Precedence Rule: Action Figure matches store (10%) only
    // Result MUST BE 10%
    // -------------------------------------------------------------------------
    const resTest10 = await fetch(`${baseUrl}/api/discounts/active?productId=${qaProdIdToy}`);
    const dataTest10 = await resTest10.json();
    const toyApp = dataTest10.applicable;

    const test10pass =
      resTest10.status === 200 &&
      toyApp !== null &&
      toyApp.precedence === "store" &&
      toyApp.discount?.value === 10 &&
      toyApp.discountAmount === 80 &&
      toyApp.finalPrice === 720; // 800 - 80 = 720

    recordTest(
      10,
      "Precedence: Store-wide discount applies to products outside category (10% off ₹800 = ₹720)",
      test10pass,
      `Discount Amount: ₹${toyApp?.discountAmount}, Final: ₹${toyApp?.finalPrice}`
    );

    // -------------------------------------------------------------------------
    // TEST 11 — Same-priority overlap conflict rejected with 409 Conflict
    // Attempt to create second product discount for Dragon Lamp during overlapping period
    // -------------------------------------------------------------------------
    const resTest11 = await fetch(`${baseUrl}/api/admin/discounts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieAdmin!,
      },
      body: JSON.stringify({
        name: "Conflicting Dragon Lamp Discount",
        code: `QA_CONFLICT_${timestamp}`,
        discountType: "percentage",
        value: 50,
        scope: "product",
        productId: qaProdIdDragon,
        startAt: new Date(Date.now() - 1800000).toISOString(),
        endAt: new Date(Date.now() + 43200000).toISOString(),
        isActive: true,
      }),
    });
    recordTest(
      11,
      "Same-priority overlapping discount rejected with 409 Conflict",
      resTest11.status === 409,
      `Status: ${resTest11.status}`
    );

    // -------------------------------------------------------------------------
    // TEST 12 — Duplicate coupon code rejected with 409 Conflict
    // -------------------------------------------------------------------------
    const resTest12 = await fetch(`${baseUrl}/api/admin/discounts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieAdmin!,
      },
      body: JSON.stringify({
        name: "Duplicate Code Attempt",
        code: codeStore, // Existing code
        discountType: "fixed_amount",
        value: 50,
        scope: "store",
        startAt: new Date(Date.now() + 100000000).toISOString(), // future non-overlapping
        isActive: true,
      }),
    });
    recordTest(
      12,
      "Duplicate coupon code rejected with 409 Conflict",
      resTest12.status === 409,
      `Status: ${resTest12.status}`
    );

    // -------------------------------------------------------------------------
    // TEST 13 — Edit discount can retain its own code (200 OK)
    // -------------------------------------------------------------------------
    const resTest13 = await fetch(`${baseUrl}/api/admin/discounts/${idStoreDiscount}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieAdmin!,
      },
      body: JSON.stringify({
        name: "QA Storewide 10% (Updated)",
        code: codeStore,
      }),
    });
    recordTest(
      13,
      "Edit discount can retain its own code (200 OK)",
      resTest13.status === 200,
      `Status: ${resTest13.status}`
    );

    // -------------------------------------------------------------------------
    // TEST 14 — Type & Value validation (percentage must be 0 < v <= 100)
    // -------------------------------------------------------------------------
    const resTest14a = await fetch(`${baseUrl}/api/admin/discounts`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookieAdmin! },
      body: JSON.stringify({
        name: "Invalid Percentage 0%",
        discountType: "percentage",
        value: 0,
        scope: "store",
        startAt: new Date().toISOString(),
      }),
    });
    const resTest14b = await fetch(`${baseUrl}/api/admin/discounts`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookieAdmin! },
      body: JSON.stringify({
        name: "Invalid Percentage 105%",
        discountType: "percentage",
        value: 105,
        scope: "store",
        startAt: new Date().toISOString(),
      }),
    });
    recordTest(
      14,
      "Percentage validation rejects value 0 and value > 100 (400 Bad Request)",
      resTest14a.status === 400 && resTest14b.status === 400,
      `0%: ${resTest14a.status}, 105%: ${resTest14b.status}`
    );

    // -------------------------------------------------------------------------
    // TEST 15 — Fixed amount validation (must be > 0)
    // -------------------------------------------------------------------------
    const resTest15 = await fetch(`${baseUrl}/api/admin/discounts`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookieAdmin! },
      body: JSON.stringify({
        name: "Invalid Fixed Amount Negative",
        discountType: "fixed_amount",
        value: -20,
        scope: "store",
        startAt: new Date().toISOString(),
      }),
    });
    recordTest(
      15,
      "Fixed amount validation rejects negative value (400 Bad Request)",
      resTest15.status === 400,
      `Status: ${resTest15.status}`
    );

    // -------------------------------------------------------------------------
    // TEST 16 — Date validation: end date earlier or equal to start date rejected (400)
    // -------------------------------------------------------------------------
    const resTest16 = await fetch(`${baseUrl}/api/admin/discounts`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookieAdmin! },
      body: JSON.stringify({
        name: "Invalid End Date",
        discountType: "percentage",
        value: 10,
        scope: "store",
        startAt: "2026-11-15T00:00:00",
        endAt: "2026-11-10T00:00:00", // earlier than start
      }),
    });
    recordTest(
      16,
      "End date before start date rejected with 400 Bad Request",
      resTest16.status === 400,
      `Status: ${resTest16.status}`
    );

    // -------------------------------------------------------------------------
    // TEST 17 — Scope target validation: category scope requires existing categoryId
    // -------------------------------------------------------------------------
    const resTest17a = await fetch(`${baseUrl}/api/admin/discounts`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookieAdmin! },
      body: JSON.stringify({
        name: "Missing Category Target",
        discountType: "percentage",
        value: 15,
        scope: "category",
        startAt: new Date().toISOString(),
      }),
    });
    const resTest17b = await fetch(`${baseUrl}/api/admin/discounts`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookieAdmin! },
      body: JSON.stringify({
        name: "Nonexistent Category Target",
        discountType: "percentage",
        value: 15,
        scope: "category",
        categoryId: crypto.randomUUID(), // fake
        startAt: new Date().toISOString(),
      }),
    });
    recordTest(
      17,
      "Category scope requires valid existing category (400 Bad Request)",
      resTest17a.status === 400 && resTest17b.status === 400,
      `Missing: ${resTest17a.status}, Nonexistent: ${resTest17b.status}`
    );

    // -------------------------------------------------------------------------
    // TEST 18 — Soft deactivation: PATCH isActive=false excludes from public active endpoint
    // -------------------------------------------------------------------------
    const resTest18 = await fetch(`${baseUrl}/api/admin/discounts/${idStoreDiscount}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookieAdmin! },
      body: JSON.stringify({ isActive: false }),
    });
    const resActiveAfterDeact = await fetch(`${baseUrl}/api/discounts/active`);
    const dataActiveAfterDeact = await resActiveAfterDeact.json();
    const storeInActive = (dataActiveAfterDeact.discounts || []).some(
      (d: any) => d.id === idStoreDiscount
    );

    recordTest(
      18,
      "Soft deactivation excludes discount from public GET /api/discounts/active",
      resTest18.status === 200 && !storeInActive,
      `In active list: ${storeInActive}`
    );

    // -------------------------------------------------------------------------
    // TEST 19 — Scheduled discounts excluded from public active endpoint
    // -------------------------------------------------------------------------
    const codeScheduled = `QA_SCHED_${timestamp}`;
    const resTest19 = await fetch(`${baseUrl}/api/admin/discounts`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookieAdmin! },
      body: JSON.stringify({
        name: "Future Scheduled Discount",
        code: codeScheduled,
        discountType: "percentage",
        value: 25,
        scope: "store",
        startAt: new Date(Date.now() + 86400000 * 5).toISOString(), // 5 days in future
        endAt: new Date(Date.now() + 86400000 * 10).toISOString(),
        isActive: true,
      }),
    });
    const dataTest19 = await resTest19.json();
    if (dataTest19.discount?.id) createdDiscountIds.push(dataTest19.discount.id);

    const resActiveSched = await fetch(`${baseUrl}/api/discounts/active`);
    const dataActiveSched = await resActiveSched.json();
    const schedInActive = (dataActiveSched.discounts || []).some(
      (d: any) => d.code === codeScheduled
    );

    recordTest(
      19,
      "Future scheduled discount excluded from public GET /api/discounts/active",
      resTest19.status === 201 && dataTest19.discount?.status === "scheduled" && !schedInActive,
      `Status: ${dataTest19.discount?.status}, In Active List: ${schedInActive}`
    );

    // -------------------------------------------------------------------------
    // TEST 20 — Security: No password_hash or database secrets leaked in responses
    // -------------------------------------------------------------------------
    let test20pass = true;
    const responsesToCheck = [dataTest1, dataTest4, dataTest5, dataTest6];
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
      "No password_hash, database credentials, or auth secrets leaked in API responses",
      test20pass,
      `Clean: ${test20pass}`
    );

    // -------------------------------------------------------------------------
    // RESULTS SUMMARY
    // -------------------------------------------------------------------------
    const passed = results.filter((r) => r.passed).length;
    const failed = results.filter((r) => !r.passed).length;

    console.log("\n=================================================================");
    console.log(`B-14 DISCOUNT API VERIFICATION: ${passed}/${results.length} TESTS PASSED`);
    console.log("=================================================================\n");

    // -------------------------------------------------------------------------
    // CLEANUP
    // -------------------------------------------------------------------------
    console.log("Cleaning up temporary QA test records from Hostinger MySQL...");

    // Clean up created discounts (cascade removes join rows)
    if (createdDiscountIds.length > 0) {
      const placeholders = createdDiscountIds.map(() => "?").join(", ");
      await db.execute(`DELETE FROM discount_products WHERE discount_id IN (${placeholders})`, createdDiscountIds);
      await db.execute(`DELETE FROM discount_categories WHERE discount_id IN (${placeholders})`, createdDiscountIds);
      await db.execute(`DELETE FROM discounts WHERE id IN (${placeholders})`, createdDiscountIds);
      console.log(`✓ Cleaned up ${createdDiscountIds.length} test discount(s).`);
    }

    // Clean up test products
    const prodIds = [qaProdIdDragon, qaProdIdDesk, qaProdIdToy];
    const prodPlaceholders = prodIds.map(() => "?").join(", ");
    await db.execute(`DELETE FROM products WHERE id IN (${prodPlaceholders})`, prodIds);
    console.log(`✓ Cleaned up ${prodIds.length} test product(s).`);

    // Clean up test categories
    const catIds = [qaCatIdLamps, qaCatIdToys];
    const catPlaceholders = catIds.map(() => "?").join(", ");
    await db.execute(`DELETE FROM categories WHERE id IN (${catPlaceholders})`, catIds);
    console.log(`✓ Cleaned up ${catIds.length} test category(ies).`);

    // Clean up profiles
    const profileIds = [idCustomer, idAdmin].filter(Boolean);
    if (profileIds.length > 0) {
      const placeholders = profileIds.map(() => "?").join(", ");
      await db.execute(`DELETE FROM profiles WHERE id IN (${placeholders})`, profileIds);
      console.log(`✓ Cleaned up ${profileIds.length} test profile(s).`);
    }

    if (failed > 0) {
      throw new Error(`B-14 verification failed: ${failed} test(s) failed.`);
    }
  } catch (err) {
    console.error("\nTEST SUITE EXECUTION ERROR:", err);

    try {
      // Emergency cleanup
      const catIds = [qaCatIdLamps, qaCatIdToys];
      const prodIds = [qaProdIdDragon, qaProdIdDesk, qaProdIdToy];
      const profileEmails = [customerEmail, adminEmail];

      if (createdDiscountIds.length > 0) {
        const placeholders = createdDiscountIds.map(() => "?").join(", ");
        await db.execute(`DELETE FROM discount_products WHERE discount_id IN (${placeholders})`, createdDiscountIds);
        await db.execute(`DELETE FROM discount_categories WHERE discount_id IN (${placeholders})`, createdDiscountIds);
        await db.execute(`DELETE FROM discounts WHERE id IN (${placeholders})`, createdDiscountIds);
      }
      for (const pid of prodIds) {
        await db.execute("DELETE FROM products WHERE id = ?", [pid]);
      }
      for (const cid of catIds) {
        await db.execute("DELETE FROM categories WHERE id = ?", [cid]);
      }
      for (const email of profileEmails) {
        await db.execute("DELETE FROM profiles WHERE email = ?", [email]);
      }
      console.log("✓ Emergency cleanup completed.");
    } catch (cleanupErr) {
      console.error("Emergency cleanup error:", cleanupErr);
    }

    await db.end();
    process.exit(1);
  }

  await db.end();
}

runB14DiscountVerification();
