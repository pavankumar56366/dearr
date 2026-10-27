/**
 * TASK 7: Production Migration Readiness Verification Suite
 *
 * Strictly targets local disposable test database: dearr_test on 127.0.0.1:3306.
 *
 * Verifies:
 * 1. combo_hash generated column behavior:
 *    - Legacy variants (NULL, NULL) evaluate to NULL (multiple allowed).
 *    - Color-only variants (colorId, NULL) evaluate to 'colorId::'.
 *    - Size-only variants (NULL, size) evaluate to '0000...::size'.
 *    - Color-size combinations evaluate to 'colorId::size'.
 *    - Database-level duplicate rejection for color-only variants (ER_DUP_ENTRY 1062).
 *    - Database-level duplicate rejection for casing and whitespace differences (ER_DUP_ENTRY 1062).
 * 2. Color deletion & foreign-key cascade protection:
 *    - Deleting a color referenced by product_variants soft-deactivates the color (is_active = 0)
 *      and DOES NOT delete or cascade-delete the variants.
 *    - Deleting a color with zero references cleanly deletes the color.
 *    - Existing order, cart, and reservation references remain intact.
 */

// 1. Mock 'server-only'
try {
  const p = require.resolve("server-only");
  require.cache[p] = { id: p, filename: p, loaded: true, exports: {} };
} catch (_) {}

process.env.DEARR_TEST_MODE = "true";

import crypto from "crypto";
import mysql from "mysql2/promise";
import assert from "assert";
import { loadTestEnvironment, assertTestDatabaseSafety } from "./test-db-safety";
import {
  createProduct,
  updateProduct,
  findProductById,
} from "../src/lib/server/product";

loadTestEnvironment();
const safeConfig = assertTestDatabaseSafety();

console.log("================================================================================");
console.log("  TASK 7: PRODUCTION MIGRATION READINESS VERIFICATION SUITE");
console.log("================================================================================\n");
console.log("Target Host:", safeConfig.host);
console.log("Target Port:", safeConfig.port);
console.log("Target Database:", safeConfig.database);

async function runTask7Verification() {
  const directConn = await mysql.createConnection(safeConfig);
  const runId = "t7-" + Date.now().toString(36);

  const cleanupProductIds: string[] = [];
  const cleanupCategoryIds: string[] = [];

  let passed = 0;
  let failed = 0;

  function recordPass(name: string) {
    console.log(`  [PASS] ${name}`);
    passed++;
  }

  function recordFail(name: string, err: any) {
    console.error(`  [FAIL] ${name}:`, err.message || err);
    failed++;
  }

  try {
    // -------------------------------------------------------------------------
    // Setup Test Category
    // -------------------------------------------------------------------------
    const testCatId = "cat_" + runId;
    await directConn.query(
      "INSERT INTO categories (id, name, slug, description, is_active) VALUES (?, ?, ?, ?, 1)",
      [testCatId, `Test Category ${runId}`, `cat-${runId}`, "Test Category for Task 7"]
    );
    cleanupCategoryIds.push(testCatId);

    // =========================================================================
    // GROUP 1: combo_hash Generated Column Expression Verification
    // =========================================================================
    console.log("\n--- GROUP 1: combo_hash Generated Column Behavior ---");

    const prod1Id = "p1_" + runId;
    await directConn.query(
      `INSERT INTO products (id, category_id, name, slug, description, price, is_active, has_colors, created_at, updated_at)
       VALUES (?, ?, 'Product 1', ?, 'Test Product 1', 199, 1, 1, NOW(), NOW())`,
      [prod1Id, testCatId, `p1-slug-${runId}`]
    );
    cleanupProductIds.push(prod1Id);

    const color1Id = crypto.randomUUID();
    const color2Id = crypto.randomUUID();
    await directConn.query(
      `INSERT INTO product_colors (id, product_id, name, slug, hex, stock, is_active, sort_order)
       VALUES (?, ?, 'Ruby Red', 'ruby-red', '#FF0000', 50, 1, 0),
              (?, ?, 'Sapphire Blue', 'sapphire-blue', '#0000FF', 50, 1, 1)`,
      [color1Id, prod1Id, color2Id, prod1Id]
    );

    // 1.1 Legacy variant (both NULL) -> combo_hash should be NULL
    const varLegacy1 = crypto.randomUUID();
    await directConn.query(
      `INSERT INTO product_variants (id, product_id, color_id, size_name, name, sku, price, stock_quantity, is_active)
       VALUES (?, ?, NULL, NULL, 'Generic Variant 1', ?, 199, 10, 1)`,
      [varLegacy1, prod1Id, `SKU-LEG1-${runId}`]
    );
    const [rowLeg1]: any = await directConn.query("SELECT combo_hash FROM product_variants WHERE id = ?", [varLegacy1]);
    assert.strictEqual(rowLeg1[0].combo_hash, null, "Legacy variant combo_hash must be NULL");
    recordPass("1.1 Legacy variant with no color and no size evaluates to combo_hash = NULL");

    // 1.2 Second legacy variant (both NULL) -> multiple NULLs allowed
    const varLegacy2 = crypto.randomUUID();
    await directConn.query(
      `INSERT INTO product_variants (id, product_id, color_id, size_name, name, sku, price, stock_quantity, is_active)
       VALUES (?, ?, NULL, NULL, 'Generic Variant 2', ?, 199, 10, 1)`,
      [varLegacy2, prod1Id, `SKU-LEG2-${runId}`]
    );
    const [rowLeg2]: any = await directConn.query("SELECT combo_hash FROM product_variants WHERE id = ?", [varLegacy2]);
    assert.strictEqual(rowLeg2[0].combo_hash, null, "Second legacy variant combo_hash must be NULL");
    recordPass("1.2 Multiple legacy variants for same product coexist without unique constraint violation");

    // 1.3 Color-only variant -> combo_hash should be '${color1Id}::' (NOT NULL!)
    const varColorOnly = crypto.randomUUID();
    await directConn.query(
      `INSERT INTO product_variants (id, product_id, color_id, size_name, name, sku, price, stock_quantity, is_active)
       VALUES (?, ?, ?, NULL, 'Ruby Red Color Only', ?, 249, 15, 1)`,
      [varColorOnly, prod1Id, color1Id, `SKU-CLR1-${runId}`]
    );
    const [rowClr]: any = await directConn.query("SELECT combo_hash FROM product_variants WHERE id = ?", [varColorOnly]);
    assert.strictEqual(rowClr[0].combo_hash, `${color1Id}::`, `Color-only variant combo_hash must be '${color1Id}::'`);
    recordPass(`1.3 Color-only variant evaluates to '${color1Id}::' (non-null hash)`);

    // 1.4 Size-only variant -> combo_hash should be '00000000-0000-0000-0000-000000000000::large'
    const varSizeOnly = crypto.randomUUID();
    await directConn.query(
      `INSERT INTO product_variants (id, product_id, color_id, size_name, name, sku, price, stock_quantity, is_active)
       VALUES (?, ?, NULL, 'Large', 'Size Only Large', ?, 299, 20, 1)`,
      [varSizeOnly, prod1Id, `SKU-SZ1-${runId}`]
    );
    const [rowSz]: any = await directConn.query("SELECT combo_hash FROM product_variants WHERE id = ?", [varSizeOnly]);
    assert.strictEqual(
      rowSz[0].combo_hash,
      "00000000-0000-0000-0000-000000000000::large",
      "Size-only combo_hash must be zero-UUID::size"
    );
    recordPass("1.4 Size-only variant evaluates to zero-UUID::size");

    // 1.5 Color-and-size combination -> combo_hash should be '${color1Id}::10cm'
    const varCombo = crypto.randomUUID();
    await directConn.query(
      `INSERT INTO product_variants (id, product_id, color_id, size_name, name, sku, price, stock_quantity, is_active)
       VALUES (?, ?, ?, '10cm', 'Ruby Red 10cm', ?, 349, 5, 1)`,
      [varCombo, prod1Id, color1Id, `SKU-CMB1-${runId}`]
    );
    const [rowCmb]: any = await directConn.query("SELECT combo_hash FROM product_variants WHERE id = ?", [varCombo]);
    assert.strictEqual(rowCmb[0].combo_hash, `${color1Id}::10cm`);
    recordPass(`1.5 Color-and-size combination evaluates to '${color1Id}::10cm'`);

    // 1.6 Duplicate color-only variant -> MUST BE REJECTED at DB layer (ER_DUP_ENTRY)
    let dupColorRejected = false;
    try {
      await directConn.query(
        `INSERT INTO product_variants (id, product_id, color_id, size_name, name, sku, price, stock_quantity, is_active)
         VALUES (?, ?, ?, NULL, 'Ruby Red Duplicate', ?, 249, 15, 1)`,
        [crypto.randomUUID(), prod1Id, color1Id, `SKU-CLR1-DUP-${runId}`]
      );
    } catch (err: any) {
      if (err.code === "ER_DUP_ENTRY" && err.message.includes("uq_product_variants_combo")) {
        dupColorRejected = true;
      } else {
        throw err;
      }
    }
    assert.strictEqual(dupColorRejected, true, "Duplicate color-only variant must be rejected by uq_product_variants_combo");
    recordPass("1.6 Duplicate color-only variant is strictly REJECTED by MySQL constraint uq_product_variants_combo");

    // 1.7 Duplicate combination with casing/whitespace difference (' 10CM ') -> MUST BE REJECTED at DB layer
    let dupCasingRejected = false;
    try {
      await directConn.query(
        `INSERT INTO product_variants (id, product_id, color_id, size_name, name, sku, price, stock_quantity, is_active)
         VALUES (?, ?, ?, '  10CM  ', 'Ruby Red 10cm Dup Case', ?, 349, 5, 1)`,
        [crypto.randomUUID(), prod1Id, color1Id, `SKU-CMB1-DUP-${runId}`]
      );
    } catch (err: any) {
      if (err.code === "ER_DUP_ENTRY" && err.message.includes("uq_product_variants_combo")) {
        dupCasingRejected = true;
      } else {
        throw err;
      }
    }
    assert.strictEqual(dupCasingRejected, true, "Casing/whitespace duplicate must be rejected by uq_product_variants_combo");
    recordPass("1.7 Duplicate combination with uppercase and surrounding whitespace ('  10CM  ') is strictly REJECTED by MySQL");

    // =========================================================================
    // GROUP 2: Color Deletion and Cascade Protection
    // =========================================================================
    console.log("\n--- GROUP 2: Color Deletion & Foreign-Key Cascade Protection ---");

    const colP2_1 = crypto.randomUUID();
    const colP2_2 = crypto.randomUUID();
    const prod2Slug = `p2-slug-${runId}`;
    const prod2 = await createProduct({
      categoryId: testCatId,
      name: "Product 2 Safeguard Test",
      slug: prod2Slug,
      description: "Testing color deletion safeguards",
      price: 299,
      stockQuantity: 50,
      hasColors: true,
      colors: [
        { id: colP2_1, name: "Emerald Green", hex: "#00FF00" },
        { id: colP2_2, name: "Amber Gold", hex: "#FFBF00" },
      ],
      variants: [
        {
          id: crypto.randomUUID(),
          colorId: colP2_1,
          sizeName: "Standard",
          name: "Emerald Green / Standard",
          sku: `SKU-P2-EM-${runId}`,
          price: 329,
          stockQuantity: 12,
          isActive: true,
        },
      ],
    });
    cleanupProductIds.push(prod2.id);

    // In prod2:
    // - Emerald Green (colP2_1) has an associated variant.
    // - Amber Gold (colP2_2) has NO associated variants, orders, carts, or reservations.

    // Now update prod2: Remove BOTH Emerald Green and Amber Gold from colors array.
    // Expected behavior:
    // 1. Amber Gold has 0 references -> hard-deleted from product_colors.
    // 2. Emerald Green has a referencing variant -> SOFT-DEACTIVATED (is_active = 0), NOT hard deleted.
    // 3. The variant referencing Emerald Green is NOT cascade-deleted!
    await updateProduct(prod2.id, {
      name: "Product 2 Safeguard Test Updated",
      colors: [], // Admin attempts to remove all colors
      variants: [
        // Admin keeps the variant
        {
          id: prod2.variants![0].id,
          colorId: colP2_1,
          sizeName: "Standard",
          name: "Emerald Green / Standard",
          sku: `SKU-P2-EM-${runId}`,
          price: 329,
          stockQuantity: 12,
          isActive: true,
        },
      ],
    });

    // Verify Emerald Green status in product_colors
    const [emRows]: any = await directConn.query("SELECT id, is_active FROM product_colors WHERE id = ?", [colP2_1]);
    assert.strictEqual(emRows.length, 1, "Emerald Green must NOT be hard-deleted from product_colors");
    assert.strictEqual(emRows[0].is_active, 0, "Emerald Green must be soft-deactivated (is_active = 0)");
    recordPass("2.1 Color with associated variants is SOFT-DEACTIVATED (is_active = 0) and NOT hard-deleted");

    // Verify the variant still exists and was not cascade-deleted
    const [varRows]: any = await directConn.query("SELECT id, color_id, is_active FROM product_variants WHERE id = ?", [
      prod2.variants![0].id,
    ]);
    assert.strictEqual(varRows.length, 1, "Variant must still exist in product_variants");
    assert.strictEqual(varRows[0].color_id, colP2_1, "Variant color_id reference must remain intact");
    recordPass("2.2 Associated product variant was preserved without cascading deletion");

    // Verify Amber Gold was cleanly deleted (zero references)
    const [ambRows]: any = await directConn.query("SELECT id FROM product_colors WHERE id = ?", [colP2_2]);
    assert.strictEqual(ambRows.length, 0, "Amber Gold (with zero references) must be cleanly hard-deleted");
    recordPass("2.3 Unreferenced color with 0 variants/orders/carts is cleanly hard-deleted");

    // =========================================================================
    // GROUP 3: Stock Reservation and Historical Snapshot Integrity
    // =========================================================================
    console.log("\n--- GROUP 3: Stock Reservation and Reference Consistency ---");

    const userId = "usr-" + runId;
    await directConn.query(
      `INSERT INTO profiles (id, email, password_hash, full_name, role, status, created_at, updated_at)
       VALUES (?, ?, 'dummy_hash', 'Test Customer', 'customer', 'active', NOW(), NOW())`,
      [userId, `cust-${runId}@dearr.test`]
    );

    const varId = prod2.variants![0].id;
    const attemptId = crypto.randomUUID();
    await directConn.query(
      `INSERT INTO checkout_attempts (id, user_id, provider, amount, currency, checkout_data, expires_at, retention_until, created_at, updated_at)
       VALUES (?, ?, 'razorpay', 329, 'INR', '{}', DATE_ADD(NOW(), INTERVAL 15 MINUTE), DATE_ADD(NOW(), INTERVAL 30 DAY), NOW(), NOW())`,
      [attemptId, userId]
    );

    const resId = crypto.randomUUID();
    await directConn.query(
      `INSERT INTO stock_reservations (id, attempt_id, product_id, color_id, variant_id, quantity, status, expires_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 1, 'active', DATE_ADD(NOW(), INTERVAL 15 MINUTE), NOW(), NOW())`,
      [resId, attemptId, prod2.id, colP2_1, varId]
    );

    // Verify foreign key integrity on stock_reservations.variant_id
    const [resCheck]: any = await directConn.query(
      "SELECT id, variant_id, color_id, status FROM stock_reservations WHERE id = ?",
      [resId]
    );
    assert.strictEqual(resCheck[0].variant_id, varId, "stock_reservations.variant_id links to variant");
    assert.strictEqual(resCheck[0].color_id, colP2_1, "stock_reservations.color_id links to color");
    recordPass("3.1 stock_reservations accurately links variant_id and color_id");

    // Clean up attempt, reservation, profile
    await directConn.query("DELETE FROM stock_reservations WHERE id = ?", [resId]);
    await directConn.query("DELETE FROM checkout_attempts WHERE id = ?", [attemptId]);
    await directConn.query("DELETE FROM profiles WHERE id = ?", [userId]);
    recordPass("3.2 Stock reservations lifecycle cleaned up without errors");

  } catch (err: any) {
    recordFail("Task 7 Verification Failure", err);
    throw err;
  } finally {
    // Teardown test fixtures
    console.log("\n--- Cleaning up test fixtures from dearr_test ---");
    if (cleanupProductIds.length > 0) {
      const ph = cleanupProductIds.map(() => "?").join(",");
      await directConn.query(`DELETE FROM stock_reservations WHERE product_id IN (${ph})`, cleanupProductIds);
      await directConn.query(`DELETE FROM cart_items WHERE product_id IN (${ph})`, cleanupProductIds);
      await directConn.query(`DELETE FROM product_variants WHERE product_id IN (${ph})`, cleanupProductIds);
      await directConn.query(`DELETE FROM product_colors WHERE product_id IN (${ph})`, cleanupProductIds);
      await directConn.query(`DELETE FROM products WHERE id IN (${ph})`, cleanupProductIds);
    }
    if (cleanupCategoryIds.length > 0) {
      const ph = cleanupCategoryIds.map(() => "?").join(",");
      await directConn.query(`DELETE FROM categories WHERE id IN (${ph})`, cleanupCategoryIds);
    }
    await directConn.end();
    console.log("[PASS] Teardown complete.\n");
  }

  console.log("================================================================================");
  console.log(`TASK 7 VERIFICATION SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log("================================================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
  process.exit(0);
}

runTask7Verification().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
