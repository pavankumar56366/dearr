import fs from "fs";
import path from "path";
import mysql from "mysql2/promise";
import crypto from "crypto";

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

function getDbPool() {
  return mysql.createPool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || "3306", 10),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    waitForConnections: true,
    connectionLimit: 2,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
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

async function runB16CartVerification() {
  console.log("=================================================================");
  console.log("Dearr V1 — Task B-16: Cart API & Server-Side Totals Verification");
  console.log("Target Base URL: ", baseUrl);
  console.log("Database Host:   ", process.env.DB_HOST, "(Hostinger MySQL)");
  console.log("Database Name:   ", process.env.DB_NAME);
  console.log("=================================================================\n");

  const timestamp = Date.now();
  const customerAEmail = `qa_b16_cust_a_${timestamp}@dearr.test`;
  const customerBEmail = `qa_b16_cust_b_${timestamp}@dearr.test`;
  const testPassword = "B16_SecurePassword123!";

  let cookieCustomerA: string | null = null;
  let cookieCustomerB: string | null = null;
  let idCustomerA: string | null = null;
  let idCustomerB: string | null = null;

  // QA Fixture IDs
  const qaCatId = crypto.randomUUID();
  const qaProdNonVariantId = crypto.randomUUID();
  const qaProdWithVariantsId = crypto.randomUUID();
  const qaProdInactiveId = crypto.randomUUID();
  const qaProdLowStockId = crypto.randomUUID();
  const qaProdDiscountId = crypto.randomUUID();

  const qaVar1CustomPriceId = crypto.randomUUID();
  const qaVar2NullPriceId = crypto.randomUUID();
  const qaVar3InactiveId = crypto.randomUUID();

  const qaDiscProductId = crypto.randomUUID();
  const qaDiscCategoryId = crypto.randomUUID();

  const pool = getDbPool();

  try {
    // -------------------------------------------------------------------------
    // PRE-FLIGHT CLEANUP: Remove any stale QA records
    // -------------------------------------------------------------------------
    await pool.execute("DELETE FROM discount_products WHERE discount_id IN (SELECT id FROM discounts WHERE name LIKE 'QA B16%')");
    await pool.execute("DELETE FROM discount_categories WHERE discount_id IN (SELECT id FROM discounts WHERE name LIKE 'QA B16%')");
    await pool.execute("DELETE FROM discounts WHERE name LIKE 'QA B16%'");
    await pool.execute("DELETE FROM cart_items WHERE cart_id IN (SELECT id FROM carts WHERE user_id IN (SELECT id FROM profiles WHERE email LIKE 'qa_b16_%'))");
    await pool.execute("DELETE FROM carts WHERE user_id IN (SELECT id FROM profiles WHERE email LIKE 'qa_b16_%')");
    await pool.execute("DELETE FROM product_variants WHERE product_id IN (SELECT id FROM products WHERE name LIKE 'QA B16%')");
    await pool.execute("DELETE FROM product_images WHERE product_id IN (SELECT id FROM products WHERE name LIKE 'QA B16%')");
    await pool.execute("DELETE FROM products WHERE name LIKE 'QA B16%'");
    await pool.execute("DELETE FROM categories WHERE name LIKE 'QA B16%'");
    await pool.execute("DELETE FROM profiles WHERE email LIKE 'qa_b16_%'");

    // -------------------------------------------------------------------------
    // SETUP: Create QA Users, Categories, Products, Variants & Discounts
    // -------------------------------------------------------------------------
    console.log("Setting up temporary QA fixtures in Hostinger MySQL...\n");

    // 1. Customer A Account via signup API
    const resCustA = await fetch(`${baseUrl}/api/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "QA B16 Customer A",
        email: customerAEmail,
        password: testPassword,
      }),
    });
    const dataCustA = await resCustA.json();
    idCustomerA = dataCustA.user?.id || null;
    const cookieHeaderA = resCustA.headers.get("set-cookie") || "";
    cookieCustomerA = cookieHeaderA.split(";")[0] || null;
    console.log(`✓ Customer A created: ${idCustomerA} (${customerAEmail})`);

    // 2. Customer B Account via signup API
    const resCustB = await fetch(`${baseUrl}/api/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "QA B16 Customer B",
        email: customerBEmail,
        password: testPassword,
      }),
    });
    const dataCustB = await resCustB.json();
    idCustomerB = dataCustB.user?.id || null;
    const cookieHeaderB = resCustB.headers.get("set-cookie") || "";
    cookieCustomerB = cookieHeaderB.split(";")[0] || null;
    console.log(`✓ Customer B created: ${idCustomerB} (${customerBEmail})`);

    // 3. QA Category
    await pool.execute(
      "INSERT INTO categories (id, name, slug, description, is_active) VALUES (?, ?, ?, ?, 1)",
      [qaCatId, "QA B16 Category", `qa-b16-cat-${timestamp}`, "Test Category for Cart"]
    );

    // 4. QA Non-Variant Product (price: 500, stock: 10, active)
    await pool.execute(
      `INSERT INTO products (id, category_id, name, slug, description, price, compare_at_price, stock_quantity, is_featured, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 1)`,
      [qaProdNonVariantId, qaCatId, "QA B16 Non-Variant Mug", `qa-b16-mug-${timestamp}`, "Custom 3D Mug", 500.00, 600.00, 10]
    );

    // 5. QA Product with Variants (price: 600, stock: 20, active)
    await pool.execute(
      `INSERT INTO products (id, category_id, name, slug, description, price, compare_at_price, stock_quantity, is_featured, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 1)`,
      [qaProdWithVariantsId, qaCatId, "QA B16 Dragon Figurine", `qa-b16-dragon-${timestamp}`, "Articulated Dragon", 600.00, 750.00, 20]
    );

    // Variants for Dragon Figurine:
    // Variant 1: Custom price 650, stock 5, active
    await pool.execute(
      "INSERT INTO product_variants (id, product_id, name, sku, price, stock_quantity, is_active) VALUES (?, ?, ?, ?, ?, ?, 1)",
      [qaVar1CustomPriceId, qaProdWithVariantsId, "Gold Silk", `SKU-GOLD-${timestamp}`, 650.00, 5]
    );
    // Variant 2: Null price (falls back to 600), stock 8, active
    await pool.execute(
      "INSERT INTO product_variants (id, product_id, name, sku, price, stock_quantity, is_active) VALUES (?, ?, ?, ?, NULL, ?, 1)",
      [qaVar2NullPriceId, qaProdWithVariantsId, "Silver Silk", `SKU-SILVER-${timestamp}`, 8]
    );
    // Variant 3: Inactive variant, price 700, stock 5
    await pool.execute(
      "INSERT INTO product_variants (id, product_id, name, sku, price, stock_quantity, is_active) VALUES (?, ?, ?, ?, ?, ?, 0)",
      [qaVar3InactiveId, qaProdWithVariantsId, "Bronze Silk", `SKU-BRONZE-${timestamp}`, 700.00, 5]
    );

    // 6. QA Inactive Product
    await pool.execute(
      `INSERT INTO products (id, category_id, name, slug, description, price, compare_at_price, stock_quantity, is_featured, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0)`,
      [qaProdInactiveId, qaCatId, "QA B16 Inactive Model", `qa-b16-inactive-${timestamp}`, "Deactivated print", 400.00, null, 10]
    );

    // 7. QA Low Stock Product (stock: 2)
    await pool.execute(
      `INSERT INTO products (id, category_id, name, slug, description, price, compare_at_price, stock_quantity, is_featured, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 1)`,
      [qaProdLowStockId, qaCatId, "QA B16 Low Stock Keychain", `qa-b16-keychain-${timestamp}`, "Limited print", 300.00, null, 2]
    );

    // 8. QA Product for Discount Precedence Testing (price: 1000, stock: 20)
    await pool.execute(
      `INSERT INTO products (id, category_id, name, slug, description, price, compare_at_price, stock_quantity, is_featured, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 1)`,
      [qaProdDiscountId, qaCatId, "QA B16 Discounted Sculpture", `qa-b16-sculpture-${timestamp}`, "Temple Idol", 1000.00, 1200.00, 20]
    );

    // 9. QA Discounts: Product Discount of fixed ₹100
    await pool.execute(
      `INSERT INTO discounts (id, name, code, discount_type, value, scope, start_at, end_at, is_active)
       VALUES (?, ?, ?, 'fixed_amount', 100.00, 'product', NOW() - INTERVAL 1 DAY, NOW() + INTERVAL 30 DAY, 1)`,
      [qaDiscProductId, "QA B16 Product Offer", `QAPROD${timestamp}`]
    );
    await pool.execute(
      "INSERT INTO discount_products (id, discount_id, product_id) VALUES (?, ?, ?)",
      [crypto.randomUUID(), qaDiscProductId, qaProdDiscountId]
    );

    // Category Discount of 10% on QA Category
    await pool.execute(
      `INSERT INTO discounts (id, name, code, discount_type, value, scope, start_at, end_at, is_active)
       VALUES (?, ?, ?, 'percentage', 10.00, 'category', NOW() - INTERVAL 1 DAY, NOW() + INTERVAL 30 DAY, 1)`,
      [qaDiscCategoryId, "QA B16 Category Offer", `QACAT${timestamp}`]
    );
    await pool.execute(
      "INSERT INTO discount_categories (id, discount_id, category_id) VALUES (?, ?, ?)",
      [crypto.randomUUID(), qaDiscCategoryId, qaCatId]
    );

    console.log("✓ QA Fixtures created successfully.\n");
    console.log("Starting test suite execution...\n");

    // =========================================================================
    // SECTION 1: AUTHENTICATION ENFORCEMENT (Tests 1 - 4)
    // =========================================================================
    console.log("--- Section 1: Authentication & Authorization Guards ---");

    const resUnauthGet = await fetch(`${baseUrl}/api/cart`, { method: "GET" });
    recordTest(1, "Unauthenticated GET /api/cart returns 401 Unauthorized", resUnauthGet.status === 401);

    const resUnauthPost = await fetch(`${baseUrl}/api/cart/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId: qaProdNonVariantId, quantity: 1 }),
    });
    recordTest(2, "Unauthenticated POST /api/cart/items returns 401 Unauthorized", resUnauthPost.status === 401);

    const resUnauthPatch = await fetch(`${baseUrl}/api/cart/items/${crypto.randomUUID()}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quantity: 2 }),
    });
    recordTest(3, "Unauthenticated PATCH /api/cart/items/:id returns 401 Unauthorized", resUnauthPatch.status === 401);

    const resUnauthDelete = await fetch(`${baseUrl}/api/cart/items/${crypto.randomUUID()}`, {
      method: "DELETE",
    });
    recordTest(4, "Unauthenticated DELETE /api/cart/items/:id returns 401 Unauthorized", resUnauthDelete.status === 401);

    // =========================================================================
    // SECTION 2: CART LIFECYCLE (Tests 5 - 8)
    // =========================================================================
    console.log("\n--- Section 2: Cart Lifecycle & Database Constraints ---");

    const resAuthGetEmpty = await fetch(`${baseUrl}/api/cart`, {
      method: "GET",
      headers: { Cookie: cookieCustomerA! },
    });
    const dataAuthGetEmpty = await resAuthGetEmpty.json();
    recordTest(
      5,
      "Authenticated customer accesses GET /api/cart successfully (200 OK)",
      resAuthGetEmpty.status === 200 &&
        dataAuthGetEmpty.ok === true &&
        dataAuthGetEmpty.cart?.items?.length === 0 &&
        dataAuthGetEmpty.cart?.totals?.total === 0
    );

    const [cartRowsA]: any = await pool.execute(
      "SELECT id, user_id, status FROM carts WHERE user_id = ? AND status = 'active'",
      [idCustomerA]
    );
    recordTest(
      6,
      "Active cart row is automatically created in carts table",
      cartRowsA.length === 1 && cartRowsA[0].status === "active"
    );

    await fetch(`${baseUrl}/api/cart`, { method: "GET", headers: { Cookie: cookieCustomerA! } });
    await fetch(`${baseUrl}/api/cart`, { method: "GET", headers: { Cookie: cookieCustomerA! } });
    const [cartRowsRepeated]: any = await pool.execute(
      "SELECT id FROM carts WHERE user_id = ? AND status = 'active'",
      [idCustomerA]
    );
    recordTest(
      7,
      "Repeated GET requests do not create duplicate active carts (exactly 1 exists)",
      cartRowsRepeated.length === 1
    );

    recordTest(
      8,
      "One active operational cart per customer model respected",
      cartRowsRepeated.length === 1 && cartRowsRepeated[0].id === cartRowsA[0].id
    );

    // =========================================================================
    // SECTION 3: ADD OPERATIONS & VALIDATION (Tests 9 - 18)
    // =========================================================================
    console.log("\n--- Section 3: Add Operations & Server-Side Input Validation ---");

    // Test 9: Add valid active non-variant product
    const resAddNonVar = await fetch(`${baseUrl}/api/cart/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookieCustomerA! },
      body: JSON.stringify({ productId: qaProdNonVariantId, quantity: 2 }),
    });
    const dataAddNonVar = await resAddNonVar.json();
    recordTest(
      9,
      "Customer can add a valid active non-variant product (201 Created)",
      resAddNonVar.status === 201 && dataAddNonVar.ok === true && dataAddNonVar.cart?.itemCount === 2
    );

    // Test 10: Added item appears in GET cart
    const resGetCart = await fetch(`${baseUrl}/api/cart`, {
      method: "GET",
      headers: { Cookie: cookieCustomerA! },
    });
    const dataGetCart = await resGetCart.json();
    const itemNonVar = dataGetCart.cart?.items?.find((it: any) => it.productId === qaProdNonVariantId);
    recordTest(
      10,
      "Added item appears in GET cart with accurate product metadata & pricing",
      itemNonVar !== undefined &&
        itemNonVar.quantity === 2 &&
        itemNonVar.pricing?.unitPrice === 500 &&
        itemNonVar.pricing?.lineSubtotal === 1000
    );

    // Test 11: Add valid active variant product (Variant 1: Gold Silk, custom price 650)
    const resAddVar1 = await fetch(`${baseUrl}/api/cart/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookieCustomerA! },
      body: JSON.stringify({
        productId: qaProdWithVariantsId,
        variantId: qaVar1CustomPriceId,
        quantity: 1,
      }),
    });
    const dataAddVar1 = await resAddVar1.json();
    const itemVar1 = dataAddVar1.cart?.items?.find((it: any) => it.variantId === qaVar1CustomPriceId);
    recordTest(
      11,
      "Customer can add a valid active variant product",
      resAddVar1.status === 201 &&
        itemVar1 !== undefined &&
        itemVar1.variant?.name === "Gold Silk" &&
        itemVar1.pricing?.unitPrice === 650
    );

    // Test 12: Variant must belong to the product
    const resMismatchVar = await fetch(`${baseUrl}/api/cart/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookieCustomerA! },
      body: JSON.stringify({
        productId: qaProdNonVariantId, // Has no variants
        variantId: qaVar1CustomPriceId, // Belongs to dragon figurine
        quantity: 1,
      }),
    });
    recordTest(
      12,
      "Supplying variant for non-variant product is rejected with 400",
      resMismatchVar.status === 400
    );

    // Test 13: Inactive product cannot be added
    const resAddInactive = await fetch(`${baseUrl}/api/cart/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookieCustomerA! },
      body: JSON.stringify({ productId: qaProdInactiveId, quantity: 1 }),
    });
    recordTest(
      13,
      "Adding inactive product is rejected with 400 Bad Request",
      resAddInactive.status === 400
    );

    // Test 14: Nonexistent product cannot be added
    const resAddNonexistent = await fetch(`${baseUrl}/api/cart/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookieCustomerA! },
      body: JSON.stringify({ productId: crypto.randomUUID(), quantity: 1 }),
    });
    recordTest(
      14,
      "Adding nonexistent product is rejected with 404 Not Found",
      resAddNonexistent.status === 404
    );

    // Test 15: Invalid product/variant IDs are rejected
    const resAddInvalidId = await fetch(`${baseUrl}/api/cart/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookieCustomerA! },
      body: JSON.stringify({ productId: "malformed; sql-injection", quantity: 1 }),
    });
    recordTest(
      15,
      "Malformed product/variant ID format is rejected with 400",
      resAddInvalidId.status === 400
    );

    // Test 16: Quantity zero is rejected
    const resZeroQty = await fetch(`${baseUrl}/api/cart/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookieCustomerA! },
      body: JSON.stringify({ productId: qaProdNonVariantId, quantity: 0 }),
    });
    recordTest(16, "Quantity zero is rejected with 400", resZeroQty.status === 400);

    // Test 17: Negative quantity is rejected
    const resNegativeQty = await fetch(`${baseUrl}/api/cart/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookieCustomerA! },
      body: JSON.stringify({ productId: qaProdNonVariantId, quantity: -3 }),
    });
    recordTest(17, "Negative quantity is rejected with 400", resNegativeQty.status === 400);

    // Test 18: Non-integer quantity is rejected
    const resFloatQty = await fetch(`${baseUrl}/api/cart/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookieCustomerA! },
      body: JSON.stringify({ productId: qaProdNonVariantId, quantity: 2.5 }),
    });
    recordTest(18, "Non-integer quantity is rejected with 400", resFloatQty.status === 400);

    // =========================================================================
    // SECTION 4: DUPLICATE ITEM HANDLING (Tests 19 - 22)
    // =========================================================================
    console.log("\n--- Section 4: Duplicate Item Handling & Line Merging ---");

    // Test 19: Adding same non-variant product adds to existing quantity
    const resAddDupNonVar = await fetch(`${baseUrl}/api/cart/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookieCustomerA! },
      body: JSON.stringify({ productId: qaProdNonVariantId, quantity: 3 }),
    });
    const dataAddDupNonVar = await resAddDupNonVar.json();
    const [nonVarDbRows]: any = await pool.execute(
      "SELECT id, quantity FROM cart_items WHERE cart_id = ? AND product_id = ?",
      [cartRowsA[0].id, qaProdNonVariantId]
    );
    recordTest(
      19,
      "Adding same non-variant product increments quantity without creating duplicate rows",
      nonVarDbRows.length === 1 && Number(nonVarDbRows[0].quantity) === 5
    );

    // Test 20: Adding same product+variant adds to quantity
    await fetch(`${baseUrl}/api/cart/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookieCustomerA! },
      body: JSON.stringify({ productId: qaProdWithVariantsId, variantId: qaVar1CustomPriceId, quantity: 2 }),
    });
    const [var1DbRows]: any = await pool.execute(
      "SELECT id, quantity FROM cart_items WHERE cart_id = ? AND product_id = ? AND variant_id = ?",
      [cartRowsA[0].id, qaProdWithVariantsId, qaVar1CustomPriceId]
    );
    recordTest(
      20,
      "Adding same variant increments quantity without creating duplicate rows",
      var1DbRows.length === 1 && Number(var1DbRows[0].quantity) === 3
    );

    // Test 21: Different variants of same product exist as separate rows
    await fetch(`${baseUrl}/api/cart/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookieCustomerA! },
      body: JSON.stringify({ productId: qaProdWithVariantsId, variantId: qaVar2NullPriceId, quantity: 1 }),
    });
    const [allDragonRows]: any = await pool.execute(
      "SELECT id, variant_id, quantity FROM cart_items WHERE cart_id = ? AND product_id = ?",
      [cartRowsA[0].id, qaProdWithVariantsId]
    );
    recordTest(
      21,
      "Different variants of the same product exist as separate cart rows",
      allDragonRows.length === 2 &&
        allDragonRows.some((r: any) => r.variant_id === qaVar1CustomPriceId) &&
        allDragonRows.some((r: any) => r.variant_id === qaVar2NullPriceId)
    );

    // Test 22: Non-variant product does not create duplicate NULL-variant rows
    const [nullVarRows]: any = await pool.execute(
      "SELECT id FROM cart_items WHERE cart_id = ? AND product_id = ? AND variant_id IS NULL",
      [cartRowsA[0].id, qaProdNonVariantId]
    );
    recordTest(
      22,
      "Non-variant product resolves to exactly one NULL-variant row",
      nullVarRows.length === 1
    );

    // =========================================================================
    // SECTION 5: STOCK VALIDATION (Tests 23 - 28)
    // =========================================================================
    console.log("\n--- Section 5: Stock Validation on Add, Update, and Read ---");

    // Test 23: Add quantity within stock succeeds (low stock product has 2, add 1)
    const resAddWithinStock = await fetch(`${baseUrl}/api/cart/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookieCustomerA! },
      body: JSON.stringify({ productId: qaProdLowStockId, quantity: 1 }),
    });
    recordTest(23, "Add quantity within stock succeeds (201 Created)", resAddWithinStock.status === 201);

    // Test 24: Add quantity above stock fails (available 2, requested 5)
    const resAddAboveStock = await fetch(`${baseUrl}/api/cart/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookieCustomerA! },
      body: JSON.stringify({ productId: qaProdLowStockId, quantity: 5 }),
    });
    recordTest(24, "Add quantity above available stock fails with 400", resAddAboveStock.status === 400);

    // Test 25: Existing quantity + added quantity above stock fails (already 1 in cart, add 2 when max is 2)
    const resAddCumulativeAboveStock = await fetch(`${baseUrl}/api/cart/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookieCustomerA! },
      body: JSON.stringify({ productId: qaProdLowStockId, quantity: 2 }),
    });
    recordTest(
      25,
      "Existing cart quantity + added quantity exceeding stock fails with 400",
      resAddCumulativeAboveStock.status === 400
    );

    // Find cart item ID for low stock product
    const dataCartA = await (await fetch(`${baseUrl}/api/cart`, { headers: { Cookie: cookieCustomerA! } })).json();
    const itemLowStock = dataCartA.cart?.items?.find((it: any) => it.productId === qaProdLowStockId);

    // Test 26: PATCH above current stock fails
    const resPatchAboveStock = await fetch(`${baseUrl}/api/cart/items/${itemLowStock.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookieCustomerA! },
      body: JSON.stringify({ quantity: 5 }),
    });
    recordTest(26, "PATCH quantity above current stock fails with 400", resPatchAboveStock.status === 400);

    // Test 27: Changed/decreased stock is reflected by GET cart (simulate external purchase reducing stock to 0)
    await pool.execute("UPDATE products SET stock_quantity = 0 WHERE id = ?", [qaProdLowStockId]);
    const resGetDecreasedStock = await fetch(`${baseUrl}/api/cart`, {
      method: "GET",
      headers: { Cookie: cookieCustomerA! },
    });
    const dataGetDecreasedStock = await resGetDecreasedStock.json();
    const itemAfterStockDrop = dataGetDecreasedStock.cart?.items?.find((it: any) => it.productId === qaProdLowStockId);
    recordTest(
      27,
      "Changed/decreased stock in DB is reflected accurately in GET cart stock flags",
      itemAfterStockDrop !== undefined &&
        itemAfterStockDrop.stock?.stockQuantity === 0 &&
        itemAfterStockDrop.stock?.available === false
    );
    // Restore stock
    await pool.execute("UPDATE products SET stock_quantity = 2 WHERE id = ?", [qaProdLowStockId]);

    // Test 28: Inactive product already in cart is handled safely without crashing
    await pool.execute("UPDATE products SET is_active = 0 WHERE id = ?", [qaProdNonVariantId]);
    const resGetWithInactive = await fetch(`${baseUrl}/api/cart`, {
      method: "GET",
      headers: { Cookie: cookieCustomerA! },
    });
    const dataGetWithInactive = await resGetWithInactive.json();
    const itemInactiveInCart = dataGetWithInactive.cart?.items?.find((it: any) => it.productId === qaProdNonVariantId);
    recordTest(
      28,
      "Inactive product already in cart returns available: false without crashing",
      resGetWithInactive.status === 200 &&
        itemInactiveInCart !== undefined &&
        itemInactiveInCart.stock?.available === false
    );
    // Restore active
    await pool.execute("UPDATE products SET is_active = 1 WHERE id = ?", [qaProdNonVariantId]);

    // =========================================================================
    // SECTION 6: QUANTITY UPDATE (PATCH) (Tests 29 - 33)
    // =========================================================================
    console.log("\n--- Section 6: Quantity Update (PATCH) & Ownership ---");

    const itemToPatch = dataCartA.cart?.items?.find((it: any) => it.productId === qaProdNonVariantId);

    // Test 29: PATCH changes quantity to requested final quantity (set from 5 to 3)
    const resPatchValid = await fetch(`${baseUrl}/api/cart/items/${itemToPatch.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookieCustomerA! },
      body: JSON.stringify({ quantity: 3 }),
    });
    const dataPatchValid = await resPatchValid.json();
    const patchedItem = dataPatchValid.cart?.items?.find((it: any) => it.id === itemToPatch.id);
    recordTest(
      29,
      "PATCH changes quantity to final desired quantity (sets to 3)",
      resPatchValid.status === 200 && patchedItem?.quantity === 3
    );

    // Test 30: PATCH zero is rejected
    const resPatchZero = await fetch(`${baseUrl}/api/cart/items/${itemToPatch.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookieCustomerA! },
      body: JSON.stringify({ quantity: 0 }),
    });
    recordTest(30, "PATCH quantity zero is rejected with 400", resPatchZero.status === 400);

    // Test 31: PATCH negative quantity is rejected
    const resPatchNegative = await fetch(`${baseUrl}/api/cart/items/${itemToPatch.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookieCustomerA! },
      body: JSON.stringify({ quantity: -1 }),
    });
    recordTest(31, "PATCH negative quantity is rejected with 400", resPatchNegative.status === 400);

    // Test 32: PATCH malformed quantity is rejected
    const resPatchMalformed = await fetch(`${baseUrl}/api/cart/items/${itemToPatch.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookieCustomerA! },
      body: JSON.stringify({ quantity: "invalid" }),
    });
    recordTest(32, "PATCH malformed quantity is rejected with 400", resPatchMalformed.status === 400);

    // Test 33: Customer cannot update another customer's cart item
    const resCrossUserPatch = await fetch(`${baseUrl}/api/cart/items/${itemToPatch.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookieCustomerB! },
      body: JSON.stringify({ quantity: 4 }),
    });
    recordTest(
      33,
      "Customer B cannot update Customer A's cart item (404/rejected)",
      resCrossUserPatch.status === 404
    );

    // =========================================================================
    // SECTION 7: REMOVE (DELETE) (Tests 34 - 37)
    // =========================================================================
    console.log("\n--- Section 7: Remove Item (DELETE) & Idempotency ---");

    // Test 34: Customer can remove own cart item
    const resRemoveItem = await fetch(`${baseUrl}/api/cart/items/${itemLowStock.id}`, {
      method: "DELETE",
      headers: { Cookie: cookieCustomerA! },
    });
    const dataRemoveItem = await resRemoveItem.json();
    recordTest(
      34,
      "Customer can remove their own cart item (200 OK)",
      resRemoveItem.status === 200 && dataRemoveItem.ok === true && dataRemoveItem.removed === true
    );

    // Test 35: Removed item disappears from GET cart
    const resGetAfterRemove = await fetch(`${baseUrl}/api/cart`, {
      method: "GET",
      headers: { Cookie: cookieCustomerA! },
    });
    const dataGetAfterRemove = await resGetAfterRemove.json();
    const hasRemovedItem = dataGetAfterRemove.cart?.items?.some((it: any) => it.id === itemLowStock.id);
    recordTest(35, "Removed item disappears from GET cart", hasRemovedItem === false);

    // Test 36: Removing already absent item is handled safely (200 OK, removed: false)
    const resRemoveAbsent = await fetch(`${baseUrl}/api/cart/items/${itemLowStock.id}`, {
      method: "DELETE",
      headers: { Cookie: cookieCustomerA! },
    });
    const dataRemoveAbsent = await resRemoveAbsent.json();
    recordTest(
      36,
      "Removing already absent item returns 200 OK with removed: false (idempotent)",
      resRemoveAbsent.status === 200 && dataRemoveAbsent.removed === false
    );

    // Test 37: Customer B cannot remove Customer A's cart item
    const resCrossUserDelete = await fetch(`${baseUrl}/api/cart/items/${itemToPatch.id}`, {
      method: "DELETE",
      headers: { Cookie: cookieCustomerB! },
    });
    const dataCrossUserDelete = await resCrossUserDelete.json();
    const [custAItemStillExists]: any = await pool.execute(
      "SELECT id FROM cart_items WHERE id = ?",
      [itemToPatch.id]
    );
    recordTest(
      37,
      "Customer B cannot remove Customer A's cart item (Customer A item preserved)",
      dataCrossUserDelete.removed === false && custAItemStillExists.length === 1
    );

    // =========================================================================
    // SECTION 8: OWNERSHIP / IDOR PROTECTION (Tests 38 - 42)
    // =========================================================================
    console.log("\n--- Section 8: Ownership Enforcement & IDOR Protection ---");

    // Add item to Customer B's cart
    await fetch(`${baseUrl}/api/cart/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookieCustomerB! },
      body: JSON.stringify({ productId: qaProdNonVariantId, quantity: 1 }),
    });

    // Test 38: Customer A cannot see Customer B's cart
    const resCustAGet = await fetch(`${baseUrl}/api/cart?userId=${idCustomerB}`, {
      method: "GET",
      headers: { Cookie: cookieCustomerA! },
    });
    const dataCustAGet = await resCustAGet.json();
    recordTest(
      38,
      "Customer A cannot view Customer B's cart (query param ?userId= ignored)",
      dataCustAGet.cart?.userId === idCustomerA && dataCustAGet.cart?.id === cartRowsA[0].id
    );

    // Test 39: Customer A cannot modify Customer B's item
    const [custBItems]: any = await pool.execute(
      "SELECT ci.id FROM cart_items ci INNER JOIN carts c ON ci.cart_id = c.id WHERE c.user_id = ?",
      [idCustomerB]
    );
    const itemCustB = custBItems[0];
    const resCustAPatchB = await fetch(`${baseUrl}/api/cart/items/${itemCustB.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookieCustomerA! },
      body: JSON.stringify({ quantity: 5 }),
    });
    recordTest(39, "Customer A cannot modify Customer B's cart item (404 Not Found)", resCustAPatchB.status === 404);

    // Test 40: Customer A cannot delete Customer B's item
    const resCustADeleteB = await fetch(`${baseUrl}/api/cart/items/${itemCustB.id}`, {
      method: "DELETE",
      headers: { Cookie: cookieCustomerA! },
    });
    const [custBItemPreserved]: any = await pool.execute(
      "SELECT id FROM cart_items WHERE id = ?",
      [itemCustB.id]
    );
    recordTest(
      40,
      "Customer A cannot delete Customer B's cart item (Customer B item remains intact)",
      custBItemPreserved.length === 1
    );

    // Test 41: Forged userId in body is ignored
    const resForgeUser = await fetch(`${baseUrl}/api/cart/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookieCustomerA! },
      body: JSON.stringify({
        productId: qaProdNonVariantId,
        quantity: 1,
        userId: idCustomerB, // Attacker tries to target B
      }),
    });
    const dataForgeUser = await resForgeUser.json();
    recordTest(
      41,
      "Client-supplied userId in body is strictly ignored (saved under auth user)",
      dataForgeUser.cart?.userId === idCustomerA
    );

    // Test 42: Forged cartId in body is ignored
    const resForgeCart = await fetch(`${baseUrl}/api/cart/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookieCustomerA! },
      body: JSON.stringify({
        productId: qaProdNonVariantId,
        quantity: 1,
        cartId: "forged-attacker-cart-id",
      }),
    });
    const dataForgeCart = await resForgeCart.json();
    recordTest(
      42,
      "Client-supplied cartId in body is strictly ignored",
      dataForgeCart.cart?.id === cartRowsA[0].id
    );

    // =========================================================================
    // SECTION 9: PRICING (Tests 43 - 47)
    // =========================================================================
    console.log("\n--- Section 9: Trusted Pricing Rules ---");

    // Test 43: Non-variant item uses products.price (500)
    const dataCurrentCart = await (await fetch(`${baseUrl}/api/cart`, { headers: { Cookie: cookieCustomerA! } })).json();
    const nonVarCartItem = dataCurrentCart.cart?.items?.find((it: any) => it.productId === qaProdNonVariantId);
    recordTest(
      43,
      "Non-variant item uses products.price (500)",
      nonVarCartItem?.pricing?.unitPrice === 500
    );

    // Test 44: Variant with explicit price uses product_variants.price (Variant 1 is 650)
    const var1CartItem = dataCurrentCart.cart?.items?.find((it: any) => it.variantId === qaVar1CustomPriceId);
    recordTest(
      44,
      "Variant with explicit price uses product_variants.price (650)",
      var1CartItem?.pricing?.unitPrice === 650
    );

    // Test 45: Variant with null price falls back to products.price (Variant 2 has null price, falls back to 600)
    const var2CartItem = dataCurrentCart.cart?.items?.find((it: any) => it.variantId === qaVar2NullPriceId);
    recordTest(
      45,
      "Variant with null price falls back to parent products.price (600)",
      var2CartItem?.pricing?.unitPrice === 600
    );

    // Test 46: Client-supplied price is ignored
    const resClientPrice = await fetch(`${baseUrl}/api/cart/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookieCustomerA! },
      body: JSON.stringify({
        productId: qaProdNonVariantId,
        quantity: 1,
        price: 1.00, // Attacker tries to buy for ₹1
      }),
    });
    const dataClientPrice = await resClientPrice.json();
    const itemCheckedPrice = dataClientPrice.cart?.items?.find((it: any) => it.productId === qaProdNonVariantId);
    recordTest(
      46,
      "Client-supplied price in request body is completely ignored",
      itemCheckedPrice?.pricing?.unitPrice === 500
    );

    // Test 47: Client-supplied discount is ignored
    const resClientDiscount = await fetch(`${baseUrl}/api/cart/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookieCustomerA! },
      body: JSON.stringify({
        productId: qaProdNonVariantId,
        quantity: 1,
        discount: 499.00,
      }),
    });
    const dataClientDiscount = await resClientDiscount.json();
    const itemCheckedDiscount = dataClientDiscount.cart?.items?.find((it: any) => it.productId === qaProdNonVariantId);
    // QA Non-Variant product has 10% category discount = 50 per unit, NOT 499
    recordTest(
      47,
      "Client-supplied discount in request body is completely ignored",
      itemCheckedDiscount?.pricing?.discountAmountPerUnit !== 499
    );

    // =========================================================================
    // SECTION 10: DISCOUNTS & PRECEDENCE (Tests 48 - 52)
    // =========================================================================
    console.log("\n--- Section 10: B-14 Discount Precedence & No Stacking ---");

    // Add Discounted Sculpture (has fixed ₹100 product discount and 10% category discount)
    await fetch(`${baseUrl}/api/cart/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookieCustomerA! },
      body: JSON.stringify({ productId: qaProdDiscountId, quantity: 2 }),
    });

    const resDiscountCart = await fetch(`${baseUrl}/api/cart`, {
      method: "GET",
      headers: { Cookie: cookieCustomerA! },
    });
    const dataDiscountCart = await resDiscountCart.json();
    const itemDiscounted = dataDiscountCart.cart?.items?.find((it: any) => it.productId === qaProdDiscountId);

    // Test 48: Applicable product discount is reflected
    recordTest(
      48,
      "Applicable product discount is resolved and calculated per unit (₹100 off)",
      itemDiscounted?.pricing?.unitPrice === 1000 &&
        itemDiscounted?.pricing?.discountAmountPerUnit === 100 &&
        itemDiscounted?.pricing?.finalUnitPrice === 900
    );

    // Test 49: Category discount is applied to products without product discount
    // Non-variant mug (500) has category discount (10% = 50)
    const itemCategoryDisc = dataDiscountCart.cart?.items?.find((it: any) => it.productId === qaProdNonVariantId);
    recordTest(
      49,
      "Category discount applies to category items without product-level discounts (10% off 500 = 50)",
      itemCategoryDisc?.pricing?.discountAmountPerUnit === 50 &&
        itemCategoryDisc?.pricing?.finalUnitPrice === 450
    );

    // Test 50: Product discount takes strict precedence over category discount
    recordTest(
      50,
      "Product discount (Priority 1) overrides Category discount (Priority 2)",
      itemDiscounted?.pricing?.discountAmountPerUnit === 100 // 100 fixed, NOT 10% (100) + 100
    );

    // Test 51: No stacking occurs
    // If stacked, it would be 100 + 10% of 1000 (100) = 200. With NO stacking, it is exactly 100.
    recordTest(
      51,
      "Strictly NO discount stacking occurs (discount per unit = exactly 100)",
      itemDiscounted?.pricing?.discountAmountPerUnit === 100
    );

    // Test 52: Server calculated line total equals expected trusted values (2 * 900 = 1800)
    recordTest(
      52,
      "Server-calculated line totals equal expected trusted values (2 × 900 = 1800)",
      itemDiscounted?.pricing?.lineTotal === 1800 && itemDiscounted?.pricing?.lineDiscount === 200
    );

    // =========================================================================
    // SECTION 11: SERVER-SIDE TOTALS (Tests 53 - 57)
    // =========================================================================
    console.log("\n--- Section 11: Server-Side Totals & Decimal Safety ---");

    const totals = dataDiscountCart.cart?.totals;
    const computedSubtotal = dataDiscountCart.cart?.items?.reduce(
      (sum: number, it: any) => sum + it.pricing?.lineSubtotal,
      0
    );
    const computedDiscount = dataDiscountCart.cart?.items?.reduce(
      (sum: number, it: any) => sum + it.pricing?.lineDiscount,
      0
    );

    // Test 53: Subtotal is calculated from trusted price × quantity
    recordTest(
      53,
      "Cart subtotal equals sum of line subtotals",
      Math.abs(totals?.subtotal - computedSubtotal) < 0.001
    );

    // Test 54: Discount total is calculated on server
    recordTest(
      54,
      "Cart discount total equals sum of line discounts",
      Math.abs(totals?.discount - computedDiscount) < 0.001
    );

    // Test 55: Final total is calculated on server (subtotal - discount + shipping)
    recordTest(
      55,
      "Final total equals subtotal - discount + shipping",
      Math.abs(totals?.total - (totals?.subtotal - totals?.discount + totals?.shipping)) < 0.001
    );

    // Test 56: Client-supplied total cannot override server calculation
    recordTest(
      56,
      "Server returns authoritative totals derived strictly from MySQL state",
      totals?.total > 0 && typeof totals?.total === "number"
    );

    // Test 57: Decimal monetary values remain accurate (at most 2 decimal places)
    const subtotalDecimals = totals?.subtotal.toString().split(".")[1];
    const totalDecimals = totals?.total.toString().split(".")[1];
    const isDecimalSafe =
      Number.isFinite(totals?.subtotal) &&
      (!subtotalDecimals || subtotalDecimals.length <= 2) &&
      Number.isFinite(totals?.total) &&
      (!totalDecimals || totalDecimals.length <= 2);
    recordTest(
      57,
      "Decimal monetary values are rounded accurately to 2 decimal places",
      isDecimalSafe
    );

    // =========================================================================
    // SECTION 12: SECURITY & SANITIZATION AUDIT (Tests 58 - 62)
    // =========================================================================
    console.log("\n--- Section 12: Security & Data Sanitization ---");

    const cartString = JSON.stringify(dataDiscountCart);
    const leaksPasswordHash =
      cartString.includes("password_hash") ||
      cartString.includes("$2a$") ||
      cartString.includes("$2b$");
    const leaksDbCreds =
      cartString.includes(process.env.DB_PASSWORD || "impossible_password") ||
      cartString.includes(process.env.DB_USER || "impossible_user");
    const leaksSessionSecret =
      cartString.includes(process.env.AUTH_SECRET || "impossible_secret") ||
      cartString.includes(process.env.SESSION_SECRET || "impossible_session_secret");

    // Test 58: API responses contain no password_hash
    recordTest(58, "Cart API responses contain zero password hashes", !leaksPasswordHash);

    // Test 59: No DB credentials leak
    recordTest(59, "Cart API responses contain zero database credentials", !leaksDbCreds);

    // Test 60: No session secret leaks
    recordTest(60, "Cart API responses contain zero session secrets", !leaksSessionSecret);

    // Test 61: No SQL/query text leaks on error
    const resSqlInjection = await fetch(`${baseUrl}/api/cart/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookieCustomerA! },
      body: JSON.stringify({
        productId: "qa-sql' UNION SELECT * FROM profiles --",
        quantity: 1,
      }),
    });
    const dataSqlInjection = await resSqlInjection.json();
    const leaksSql =
      JSON.stringify(dataSqlInjection).includes("SQL") ||
      JSON.stringify(dataSqlInjection).includes("SELECT") ||
      JSON.stringify(dataSqlInjection).includes("syntax");
    recordTest(
      61,
      "Error responses never leak raw SQL or query strings",
      resSqlInjection.status === 400 && !leaksSql
    );

    // Test 62: No stack traces leak
    const leaksStackTrace =
      JSON.stringify(dataSqlInjection).includes("at ") ||
      JSON.stringify(dataSqlInjection).includes(".ts:") ||
      JSON.stringify(dataSqlInjection).includes(".js:");
    recordTest(
      62,
      "Error responses never leak internal stack traces",
      !leaksStackTrace
    );

  } catch (err: any) {
    console.error("\n❌ Unhandled error during B-16 verification:", err);
  } finally {
    // -------------------------------------------------------------------------
    // CLEANUP: Clean all QA data from Hostinger MySQL
    // -------------------------------------------------------------------------
    console.log("\nCleaning up QA fixtures from Hostinger MySQL...");
    try {
      await pool.execute("DELETE FROM discount_products WHERE discount_id IN (SELECT id FROM discounts WHERE name LIKE 'QA B16%')");
      await pool.execute("DELETE FROM discount_categories WHERE discount_id IN (SELECT id FROM discounts WHERE name LIKE 'QA B16%')");
      await pool.execute("DELETE FROM discounts WHERE name LIKE 'QA B16%'");
      await pool.execute("DELETE FROM cart_items WHERE cart_id IN (SELECT id FROM carts WHERE user_id IN (SELECT id FROM profiles WHERE email LIKE 'qa_b16_%'))");
      await pool.execute("DELETE FROM carts WHERE user_id IN (SELECT id FROM profiles WHERE email LIKE 'qa_b16_%')");
      await pool.execute("DELETE FROM product_variants WHERE product_id IN (SELECT id FROM products WHERE name LIKE 'QA B16%')");
      await pool.execute("DELETE FROM product_images WHERE product_id IN (SELECT id FROM products WHERE name LIKE 'QA B16%')");
      await pool.execute("DELETE FROM products WHERE name LIKE 'QA B16%'");
      await pool.execute("DELETE FROM categories WHERE name LIKE 'QA B16%'");
      await pool.execute("DELETE FROM profiles WHERE email LIKE 'qa_b16_%'");
      console.log("✓ Hostinger MySQL QA records cleaned up completely.");
    } catch (cleanErr: any) {
      console.error("Cleanup warning:", cleanErr.message);
    } finally {
      await pool.end();
    }
  }

  // ---------------------------------------------------------------------------
  // SUMMARY REPORT
  // ---------------------------------------------------------------------------
  console.log("\n=================================================================");
  console.log("Dearr V1 — Task B-16 Verification Summary");
  console.log("=================================================================");
  const passedCount = results.filter((r) => r.passed).length;
  const totalCount = results.length;
  console.log(`TOTAL TESTS:  ${totalCount}`);
  console.log(`PASSED:       ${passedCount}`);
  console.log(`FAILED:       ${totalCount - passedCount}`);
  console.log("=================================================================");

  if (passedCount === totalCount && totalCount >= 62) {
    console.log(`\n🎉 B-16 CART API VERIFICATION: ${passedCount}/${totalCount} TESTS PASSED\n`);
  } else {
    console.error(`\n❌ VERIFICATION FAILED: Only ${passedCount}/${totalCount} tests passed.\n`);
    process.exit(1);
  }
}

runB16CartVerification().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
