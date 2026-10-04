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

async function runB15WishlistVerification() {
  console.log("=================================================================");
  console.log("Dearr V1 — Task B-15: Wishlist Backend API & Ownership Verification");
  console.log("Target Base URL: ", baseUrl);
  console.log("Database Host:   ", process.env.DB_HOST, "(Hostinger MySQL)");
  console.log("Database Name:   ", process.env.DB_NAME);
  console.log("=================================================================\n");

  const timestamp = Date.now();
  const customerAEmail = `qa_b15_cust_a_${timestamp}@dearr.test`;
  const customerBEmail = `qa_b15_cust_b_${timestamp}@dearr.test`;
  const testPassword = "B15_SecurePassword123!";

  let cookieCustomerA: string | null = null;
  let cookieCustomerB: string | null = null;
  let idCustomerA: string | null = null;
  let idCustomerB: string | null = null;

  // QA Fixture IDs
  const qaCatId = crypto.randomUUID();
  const qaProdIdActive1 = crypto.randomUUID();
  const qaProdIdActive2 = crypto.randomUUID();
  const qaProdIdInactive = crypto.randomUUID();
  const qaImgId1 = crypto.randomUUID();
  const qaImgId2 = crypto.randomUUID();

  const pool = getDbPool();

  try {
    // -------------------------------------------------------------------------
    // PRE-FLIGHT CLEANUP: Remove any stale QA records
    // -------------------------------------------------------------------------
    await pool.execute("DELETE FROM wishlist_items WHERE wishlist_id IN (SELECT id FROM wishlists WHERE user_id IN (SELECT id FROM profiles WHERE email LIKE 'qa_b15_%'))");
    await pool.execute("DELETE FROM wishlists WHERE user_id IN (SELECT id FROM profiles WHERE email LIKE 'qa_b15_%')");
    await pool.execute("DELETE FROM product_images WHERE product_id IN (SELECT id FROM products WHERE name LIKE 'QA B15%')");
    await pool.execute("DELETE FROM products WHERE name LIKE 'QA B15%'");
    await pool.execute("DELETE FROM categories WHERE name LIKE 'QA B15%'");
    await pool.execute("DELETE FROM profiles WHERE email LIKE 'qa_b15_%'");

    // -------------------------------------------------------------------------
    // SETUP: Create QA Users, Category & Products in Hostinger MySQL
    // -------------------------------------------------------------------------
    console.log("Setting up temporary QA fixtures in Hostinger MySQL...\n");

    // 1. Customer A Account via signup API
    const resCustA = await fetch(`${baseUrl}/api/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "QA B15 Customer A",
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
        name: "QA B15 Customer B",
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
      [qaCatId, "QA B15 Category", `qa-b15-cat-${timestamp}`, "Test Category for Wishlist"]
    );

    // 4. QA Active Product 1
    await pool.execute(
      `INSERT INTO products (id, category_id, name, slug, description, price, compare_at_price, stock_quantity, is_featured, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 1)`,
      [qaProdIdActive1, qaCatId, "QA B15 Radha Krishna Print", `qa-b15-radha-krishna-${timestamp}`, "Silk PLA 3D printed idol", 799.00, 999.00, 15]
    );
    await pool.execute(
      "INSERT INTO product_images (id, product_id, storage_path, alt_text, sort_order) VALUES (?, ?, ?, ?, 0)",
      [qaImgId1, qaProdIdActive1, "uploads/products/qa-krishna.webp", "Krishna Idol View"]
    );

    // 5. QA Active Product 2
    await pool.execute(
      `INSERT INTO products (id, category_id, name, slug, description, price, compare_at_price, stock_quantity, is_featured, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 1)`,
      [qaProdIdActive2, qaCatId, "QA B15 Articulated Dragon", `qa-b15-dragon-${timestamp}`, "Flexible articulated toy", 450.00, null, 8]
    );
    await pool.execute(
      "INSERT INTO product_images (id, product_id, storage_path, alt_text, sort_order) VALUES (?, ?, ?, ?, 0)",
      [qaImgId2, qaProdIdActive2, "uploads/products/qa-dragon.webp", "Dragon Toy View"]
    );

    // 6. QA Inactive Product
    await pool.execute(
      `INSERT INTO products (id, category_id, name, slug, description, price, compare_at_price, stock_quantity, is_featured, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0)`,
      [qaProdIdInactive, qaCatId, "QA B15 Retired Print", `qa-b15-retired-${timestamp}`, "Retired de-listed 3D model", 299.00, null, 0]
    );

    console.log("✓ QA Products & Category created successfully.\n");
    console.log("Starting test suite execution...\n");

    // =========================================================================
    // SECTION 1: AUTHENTICATION ENFORCEMENT
    // =========================================================================
    console.log("--- Section 1: Authentication & Authorization Guards ---");

    // Test 01: Unauthenticated GET /api/wishlist -> 401
    const resUnauthGet = await fetch(`${baseUrl}/api/wishlist`, { method: "GET" });
    const dataUnauthGet = await resUnauthGet.json();
    recordTest(
      1,
      "Unauthenticated GET /api/wishlist returns 401 Unauthorized",
      resUnauthGet.status === 401 && dataUnauthGet.ok === false,
      `HTTP status: ${resUnauthGet.status}`
    );

    // Test 02: Unauthenticated POST /api/wishlist/items -> 401
    const resUnauthPost = await fetch(`${baseUrl}/api/wishlist/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId: qaProdIdActive1 }),
    });
    const dataUnauthPost = await resUnauthPost.json();
    recordTest(
      2,
      "Unauthenticated POST /api/wishlist/items returns 401 Unauthorized",
      resUnauthPost.status === 401 && dataUnauthPost.ok === false,
      `HTTP status: ${resUnauthPost.status}`
    );

    // Test 03: Unauthenticated DELETE /api/wishlist/items/:productId -> 401
    const resUnauthDelete = await fetch(`${baseUrl}/api/wishlist/items/${qaProdIdActive1}`, {
      method: "DELETE",
    });
    const dataUnauthDelete = await resUnauthDelete.json();
    recordTest(
      3,
      "Unauthenticated DELETE /api/wishlist/items/:id returns 401 Unauthorized",
      resUnauthDelete.status === 401 && dataUnauthDelete.ok === false,
      `HTTP status: ${resUnauthDelete.status}`
    );

    // =========================================================================
    // SECTION 2: WISHLIST LIFECYCLE & AUTO-CREATION
    // =========================================================================
    console.log("\n--- Section 2: Wishlist Lifecycle & Database Constraints ---");

    // Test 04: Authenticated customer with no wishlist accesses GET /api/wishlist
    const resAuthGetEmpty = await fetch(`${baseUrl}/api/wishlist`, {
      method: "GET",
      headers: { Cookie: cookieCustomerA! },
    });
    const dataAuthGetEmpty = await resAuthGetEmpty.json();
    recordTest(
      4,
      "Authenticated customer accesses GET /api/wishlist successfully (200 OK)",
      resAuthGetEmpty.status === 200 &&
        dataAuthGetEmpty.ok === true &&
        Array.isArray(dataAuthGetEmpty.wishlist?.items) &&
        dataAuthGetEmpty.wishlist.items.length === 0 &&
        dataAuthGetEmpty.wishlist.count === 0,
      `Wishlist items: ${dataAuthGetEmpty.wishlist?.count}`
    );

    // Test 05: Verify wishlist row automatically created in MySQL wishlists table
    const [wishlistRowsA]: any = await pool.execute(
      "SELECT id, user_id, created_at FROM wishlists WHERE user_id = ?",
      [idCustomerA]
    );
    recordTest(
      5,
      "Customer wishlist row is automatically created in wishlists table",
      wishlistRowsA.length === 1 && wishlistRowsA[0].user_id === idCustomerA,
      `Wishlist ID: ${wishlistRowsA[0]?.id}`
    );

    // Test 06: Repeated GET does not duplicate wishlists
    await fetch(`${baseUrl}/api/wishlist`, { method: "GET", headers: { Cookie: cookieCustomerA! } });
    await fetch(`${baseUrl}/api/wishlist`, { method: "GET", headers: { Cookie: cookieCustomerA! } });
    const [wishlistRowsRepeated]: any = await pool.execute(
      "SELECT id FROM wishlists WHERE user_id = ?",
      [idCustomerA]
    );
    recordTest(
      6,
      "Repeated GET requests do not create duplicate wishlist rows (exactly 1 exists)",
      wishlistRowsRepeated.length === 1,
      `Rows found: ${wishlistRowsRepeated.length}`
    );

    // Test 07: Database UNIQUE(user_id) constraint rejects raw duplicate insert attempt
    let uniqueConstraintProtected = false;
    try {
      await pool.execute(
        "INSERT INTO wishlists (id, user_id, created_at, updated_at) VALUES (?, ?, NOW(), NOW())",
        [crypto.randomUUID(), idCustomerA]
      );
    } catch (err: any) {
      if (err?.code === "ER_DUP_ENTRY") {
        uniqueConstraintProtected = true;
      }
    }
    recordTest(
      7,
      "Database schema enforces UNIQUE constraint on wishlists.user_id",
      uniqueConstraintProtected,
      "ER_DUP_ENTRY caught as expected"
    );

    // =========================================================================
    // SECTION 3: ADD ITEM TO WISHLIST
    // =========================================================================
    console.log("\n--- Section 3: Add Item & Idempotency Operations ---");

    // Test 08: Customer A adds an existing valid product (POST /api/wishlist/items)
    const resAddProd1 = await fetch(`${baseUrl}/api/wishlist/items`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieCustomerA!,
      },
      body: JSON.stringify({ productId: qaProdIdActive1 }),
    });
    const dataAddProd1 = await resAddProd1.json();
    recordTest(
      8,
      "Customer can add valid product to wishlist (201 Created)",
      resAddProd1.status === 201 &&
        dataAddProd1.ok === true &&
        dataAddProd1.alreadyInWishlist === false &&
        dataAddProd1.item?.productId === qaProdIdActive1,
      `Added item ID: ${dataAddProd1.item?.id}`
    );

    // Test 09: Added product details appear in GET /api/wishlist with enriched metadata
    const resGetAfterAdd = await fetch(`${baseUrl}/api/wishlist`, {
      method: "GET",
      headers: { Cookie: cookieCustomerA! },
    });
    const dataGetAfterAdd = await resGetAfterAdd.json();
    const item1 = dataGetAfterAdd.wishlist?.items?.[0];
    recordTest(
      9,
      "Added product appears in GET /api/wishlist with correct fields & primary image",
      resGetAfterAdd.status === 200 &&
        dataGetAfterAdd.wishlist?.count === 1 &&
        item1?.productId === qaProdIdActive1 &&
        item1?.product?.name === "QA B15 Radha Krishna Print" &&
        item1?.product?.price === 799 &&
        item1?.product?.compareAtPrice === 999 &&
        item1?.product?.isFeatured === true &&
        item1?.product?.image?.includes("qa-krishna.webp"),
      `Product: ${item1?.product?.name} (₹${item1?.product?.price})`
    );

    // Test 10: Repeated add of same product is idempotent (200 OK, alreadyInWishlist: true)
    const resAddDuplicate = await fetch(`${baseUrl}/api/wishlist/items`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieCustomerA!,
      },
      body: JSON.stringify({ productId: qaProdIdActive1 }),
    });
    const dataAddDuplicate = await resAddDuplicate.json();
    recordTest(
      10,
      "Repeated add is safe & idempotent without MySQL errors (200 OK)",
      resAddDuplicate.status === 200 &&
        dataAddDuplicate.ok === true &&
        dataAddDuplicate.alreadyInWishlist === true,
      `Message: "${dataAddDuplicate.message}"`
    );

    // Test 11: Database count verifies exactly 1 row in wishlist_items for that product
    const [itemRows]: any = await pool.execute(
      "SELECT id FROM wishlist_items WHERE wishlist_id = ? AND product_id = ?",
      [wishlistRowsA[0].id, qaProdIdActive1]
    );
    recordTest(
      11,
      "Database UNIQUE(wishlist_id, product_id) prevents duplicate item rows",
      itemRows.length === 1,
      `Rows in wishlist_items: ${itemRows.length}`
    );

    // Test 12: Adding nonexistent product returns 404
    const resAddNonexistent = await fetch(`${baseUrl}/api/wishlist/items`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieCustomerA!,
      },
      body: JSON.stringify({ productId: crypto.randomUUID() }),
    });
    const dataAddNonexistent = await resAddNonexistent.json();
    recordTest(
      12,
      "Adding nonexistent product is rejected safely (404 Not Found)",
      resAddNonexistent.status === 404 && dataAddNonexistent.ok === false,
      `Error: "${dataAddNonexistent.error}"`
    );

    // Test 13: Adding inactive product is rejected per storefront visibility rules (400)
    const resAddInactive = await fetch(`${baseUrl}/api/wishlist/items`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieCustomerA!,
      },
      body: JSON.stringify({ productId: qaProdIdInactive }),
    });
    const dataAddInactive = await resAddInactive.json();
    recordTest(
      13,
      "Adding inactive product is rejected per storefront visibility rules (400)",
      resAddInactive.status === 400 && dataAddInactive.ok === false,
      `Error: "${dataAddInactive.error}"`
    );

    // Test 14: Malformed request body / invalid product ID format rejected (400)
    const resAddMalformed = await fetch(`${baseUrl}/api/wishlist/items`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieCustomerA!,
      },
      body: JSON.stringify({ productId: "malformed'; DROP TABLE wishlist_items; --" }),
    });
    const dataAddMalformed = await resAddMalformed.json();
    recordTest(
      14,
      "Malformed product ID format is safely rejected with 400 Bad Request",
      resAddMalformed.status === 400 && dataAddMalformed.ok === false,
      `Error: "${dataAddMalformed.error}"`
    );

    // =========================================================================
    // SECTION 4: REMOVE ITEM FROM WISHLIST
    // =========================================================================
    console.log("\n--- Section 4: Remove Item & Idempotent Deletion ---");

    // Add second product so we have 2 items
    await fetch(`${baseUrl}/api/wishlist/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookieCustomerA! },
      body: JSON.stringify({ productId: qaProdIdActive2 }),
    });

    // Test 15: Customer removes own item (DELETE /api/wishlist/items/:productId)
    const resRemoveItem1 = await fetch(`${baseUrl}/api/wishlist/items/${qaProdIdActive1}`, {
      method: "DELETE",
      headers: { Cookie: cookieCustomerA! },
    });
    const dataRemoveItem1 = await resRemoveItem1.json();
    recordTest(
      15,
      "Customer can remove their own wishlist item (200 OK)",
      resRemoveItem1.status === 200 && dataRemoveItem1.ok === true && dataRemoveItem1.removed === true,
      `Response: "${dataRemoveItem1.message}"`
    );

    // Test 16: Removed item no longer appears in GET /api/wishlist
    const resGetAfterRemove = await fetch(`${baseUrl}/api/wishlist`, {
      method: "GET",
      headers: { Cookie: cookieCustomerA! },
    });
    const dataGetAfterRemove = await resGetAfterRemove.json();
    const remainingItems = dataGetAfterRemove.wishlist?.items || [];
    const hasRemoved = remainingItems.some((it: any) => it.productId === qaProdIdActive1);
    const hasRemaining = remainingItems.some((it: any) => it.productId === qaProdIdActive2);
    recordTest(
      16,
      "Removed item is absent from GET /api/wishlist; remaining items intact",
      !hasRemoved && hasRemaining && dataGetAfterRemove.wishlist?.count === 1,
      `Remaining items count: ${dataGetAfterRemove.wishlist?.count}`
    );

    // Test 17: Removing an already removed item is idempotent (200 OK, removed: false)
    const resRemoveAbsent = await fetch(`${baseUrl}/api/wishlist/items/${qaProdIdActive1}`, {
      method: "DELETE",
      headers: { Cookie: cookieCustomerA! },
    });
    const dataRemoveAbsent = await resRemoveAbsent.json();
    recordTest(
      17,
      "Removing an absent product is idempotent and safe (200 OK)",
      resRemoveAbsent.status === 200 && dataRemoveAbsent.ok === true && dataRemoveAbsent.removed === false,
      `Removed flag: ${dataRemoveAbsent.removed}`
    );

    // =========================================================================
    // SECTION 5: OWNERSHIP ENFORCEMENT & IDOR ISOLATION
    // =========================================================================
    console.log("\n--- Section 5: Ownership Enforcement & IDOR Protection ---");

    // Add Product 1 to Customer B's wishlist
    const resCustBAdd = await fetch(`${baseUrl}/api/wishlist/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookieCustomerB! },
      body: JSON.stringify({ productId: qaProdIdActive1 }),
    });
    const dataCustBAdd = await resCustBAdd.json();
    console.log(`Added Product 1 to Customer B's wishlist: ${dataCustBAdd.item?.id}`);

    // Test 18: Customer A cannot read Customer B's wishlist items
    const resCustAGet = await fetch(`${baseUrl}/api/wishlist?userId=${idCustomerB}`, {
      method: "GET",
      headers: { Cookie: cookieCustomerA! },
    });
    const dataCustAGet = await resCustAGet.json();
    const custAItems = dataCustAGet.wishlist?.items || [];
    const custAHasCustBProduct = custAItems.some((it: any) => it.productId === qaProdIdActive1);
    recordTest(
      18,
      "Customer A cannot view Customer B's wishlist (query param ?userId= ignored)",
      custAHasCustBProduct === false && dataCustAGet.wishlist?.id === wishlistRowsA[0].id,
      `Customer A wishlist ID: ${dataCustAGet.wishlist?.id}`
    );

    // Test 19: Customer A cannot delete Customer B's wishlist item
    // Customer A attempts to delete qaProdIdActive1 (which is currently ONLY in Customer B's wishlist)
    const resCustADeleteB = await fetch(`${baseUrl}/api/wishlist/items/${qaProdIdActive1}`, {
      method: "DELETE",
      headers: { Cookie: cookieCustomerA! },
    });
    const dataCustADeleteB = await resCustADeleteB.json();

    // Verify Customer B's item is STILL present in MySQL database
    const [custBItemsInDb]: any = await pool.execute(
      `SELECT wi.id FROM wishlist_items wi
       INNER JOIN wishlists w ON wi.wishlist_id = w.id
       WHERE w.user_id = ? AND wi.product_id = ?`,
      [idCustomerB, qaProdIdActive1]
    );

    recordTest(
      19,
      "Customer A cannot delete Customer B's wishlist item (IDOR strictly blocked)",
      dataCustADeleteB.removed === false && custBItemsInDb.length === 1,
      `Customer B item preserved: ${custBItemsInDb.length === 1}`
    );

    // Test 20: Body-supplied userId / wishlistId cannot hijack item creation
    const resHijackAdd = await fetch(`${baseUrl}/api/wishlist/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookieCustomerA! },
      body: JSON.stringify({
        productId: qaProdIdActive1,
        userId: idCustomerB, // Attacker attempts to target Customer B
        wishlistId: "attacker-override-wishlist-id",
      }),
    });
    const dataHijackAdd = await resHijackAdd.json();

    // Verify item was created for Customer A, NOT Customer B
    const [hijackedRowInB]: any = await pool.execute(
      `SELECT wi.id FROM wishlist_items wi
       INNER JOIN wishlists w ON wi.wishlist_id = w.id
       WHERE w.user_id = ? AND wi.id = ?`,
      [idCustomerB, dataHijackAdd.item?.id]
    );

    recordTest(
      20,
      "Client-supplied userId or wishlistId in request body is strictly ignored",
      dataHijackAdd.item?.wishlistId === wishlistRowsA[0].id && hijackedRowInB.length === 0,
      `Saved under authenticated wishlist: ${dataHijackAdd.item?.wishlistId}`
    );

    // =========================================================================
    // SECTION 6: PRODUCT VISIBILITY & WISHLIST CLEAR
    // =========================================================================
    console.log("\n--- Section 6: Inactive Product Graceful Handling & Clear Wishlist ---");

    // Test 21: Deactivating a saved product retains row but marks unavailable in UI
    await pool.execute("UPDATE products SET is_active = 0 WHERE id = ?", [qaProdIdActive1]);

    const resGetWithInactive = await fetch(`${baseUrl}/api/wishlist`, {
      method: "GET",
      headers: { Cookie: cookieCustomerA! },
    });
    const dataGetWithInactive = await resGetWithInactive.json();
    const inactiveSavedItem = dataGetWithInactive.wishlist?.items?.find(
      (it: any) => it.productId === qaProdIdActive1
    );

    recordTest(
      21,
      "Deactivated saved product is marked unavailable without crashing or leaking hidden data",
      inactiveSavedItem !== undefined &&
        inactiveSavedItem.product?.isActive === false &&
        inactiveSavedItem.product?.isAvailable === false &&
        inactiveSavedItem.product?.stockQuantity === 0,
      `Product state: isAvailable=${inactiveSavedItem?.product?.isAvailable}`
    );

    // Restore product active state for remaining tests
    await pool.execute("UPDATE products SET is_active = 1 WHERE id = ?", [qaProdIdActive1]);

    // Test 22: DELETE /api/wishlist clears all items for the customer
    const resClearWishlist = await fetch(`${baseUrl}/api/wishlist`, {
      method: "DELETE",
      headers: { Cookie: cookieCustomerA! },
    });
    const dataClearWishlist = await resClearWishlist.json();

    const resGetAfterClear = await fetch(`${baseUrl}/api/wishlist`, {
      method: "GET",
      headers: { Cookie: cookieCustomerA! },
    });
    const dataGetAfterClear = await resGetAfterClear.json();

    recordTest(
      22,
      "DELETE /api/wishlist clears all customer wishlist items atomically",
      resClearWishlist.status === 200 &&
        dataClearWishlist.ok === true &&
        dataGetAfterClear.wishlist?.count === 0,
      `Items count after clear: ${dataGetAfterClear.wishlist?.count}`
    );

    // =========================================================================
    // SECTION 7: SECURITY & SANITIZATION AUDIT
    // =========================================================================
    console.log("\n--- Section 7: Security & Data Sanitization ---");

    // Test 23: Wishlist responses never contain password_hash or session secrets
    const rawWishlistString = JSON.stringify(dataGetAfterAdd);
    const leaksPasswordHash =
      rawWishlistString.includes("password_hash") ||
      rawWishlistString.includes("$2a$") ||
      rawWishlistString.includes("$2b$");
    const leaksSecrets =
      rawWishlistString.includes(process.env.DB_PASSWORD || "impossible_secret_test") ||
      rawWishlistString.includes(process.env.AUTH_SECRET || "impossible_auth_secret");

    recordTest(
      23,
      "Wishlist API responses are strictly sanitized (no password hashes or secrets)",
      !leaksPasswordHash && !leaksSecrets,
      "Zero credentials or sensitive auth hashes leaked"
    );

    // Test 24: Error responses never leak raw SQL or database internal stack traces
    const resSqlErrorTest = await fetch(`${baseUrl}/api/wishlist/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookieCustomerA! },
      body: JSON.stringify({ productId: "qa-sql' UNION SELECT * FROM profiles --" }),
    });
    const dataSqlErrorTest = await resSqlErrorTest.json();
    const leaksSql =
      JSON.stringify(dataSqlErrorTest).includes("SQL") ||
      JSON.stringify(dataSqlErrorTest).includes("syntax") ||
      JSON.stringify(dataSqlErrorTest).includes("SELECT");

    recordTest(
      24,
      "Error responses never leak raw SQL, query text, or internal stack traces",
      resSqlErrorTest.status === 400 && !leaksSql,
      `Error response: "${dataSqlErrorTest.error}"`
    );

  } catch (err: any) {
    console.error("\n❌ Unhandled error during B-15 verification:", err);
  } finally {
    // -------------------------------------------------------------------------
    // CLEANUP: Clean all QA data from Hostinger MySQL
    // -------------------------------------------------------------------------
    console.log("\nCleaning up QA fixtures from Hostinger MySQL...");
    try {
      await pool.execute("DELETE FROM wishlist_items WHERE wishlist_id IN (SELECT id FROM wishlists WHERE user_id IN (SELECT id FROM profiles WHERE email LIKE 'qa_b15_%'))");
      await pool.execute("DELETE FROM wishlists WHERE user_id IN (SELECT id FROM profiles WHERE email LIKE 'qa_b15_%')");
      await pool.execute("DELETE FROM product_images WHERE product_id IN (SELECT id FROM products WHERE name LIKE 'QA B15%')");
      await pool.execute("DELETE FROM products WHERE name LIKE 'QA B15%'");
      await pool.execute("DELETE FROM categories WHERE name LIKE 'QA B15%'");
      await pool.execute("DELETE FROM profiles WHERE email LIKE 'qa_b15_%'");
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
  console.log("Dearr V1 — Task B-15 Verification Summary");
  console.log("=================================================================");
  const passedCount = results.filter((r) => r.passed).length;
  const totalCount = results.length;
  console.log(`TOTAL TESTS:  ${totalCount}`);
  console.log(`PASSED:       ${passedCount}`);
  console.log(`FAILED:       ${totalCount - passedCount}`);
  console.log("=================================================================");

  if (passedCount === totalCount && totalCount > 0) {
    console.log(`\n🎉 B-15 WISHLIST API VERIFICATION: ${passedCount}/${totalCount} TESTS PASSED\n`);
  } else {
    console.error(`\n❌ VERIFICATION FAILED: Only ${passedCount}/${totalCount} tests passed.\n`);
    process.exit(1);
  }
}

runB15WishlistVerification().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
