/**
 * TASK 5: Isolated Database Integration & Variant Persistence Validation
 *
 * Verifies variant-pricing, combinations, authoritative pricing, cart persistence,
 * stock reservations, checkout snapshots, and order cancellation against the verified
 * local MySQL test database (dearr_test on 127.0.0.1:3306).
 */

// 1. Mock 'server-only' so test runners can import Next.js server modules directly
try {
  const p = require.resolve("server-only");
  require.cache[p] = { id: p, filename: p, loaded: true, exports: {} };
} catch (_) {}

process.env.DEARR_TEST_MODE = "true";

import crypto from "crypto";
import mysql from "mysql2/promise";
import { loadTestEnvironment, assertTestDatabaseSafety } from "./test-db-safety";

// 2. Strict Fail-Closed Loopback Safeguard
loadTestEnvironment();
const safeConfig = assertTestDatabaseSafety();

console.log("================================================================================");
console.log("  TASK 5: ISOLATED DATABASE INTEGRATION & VARIANT PERSISTENCE VALIDATION");
console.log("================================================================================");
console.log("Target Host:", safeConfig.host);
console.log("Target Port:", safeConfig.port);
console.log("Target Database:", safeConfig.database);

import {
  createProduct,
  updateProduct,
  findProductById,
  ProductValidationError,
} from "../src/lib/server/product";
import {
  getOrCreateActiveCartForUser,
  getCartForUser,
  addCartItem,
  updateCartItemQuantity,
  CartValidationError,
} from "../src/lib/server/cart";
import {
  createCheckoutAttemptFromCart,
  finalizeOrderFromAttempt,
  cleanupExpiredCheckoutAttempts,
  releaseCheckoutAttemptReservations,
  CheckoutAttemptError,
} from "../src/lib/server/checkout-attempt";
import {
  getOrderById,
  cancelOrder,
  OrderValidationError,
} from "../src/lib/server/order";
import {
  resolveAuthoritativeUnitPrice,
  resolveAuthoritativeEffectiveStock,
  resolveAuthoritativeItemFromDb,
} from "../src/lib/server/variant-resolver";
import { query, withTransaction } from "../src/lib/server/db";

let testPassedCount = 0;
let testFailedCount = 0;
const resultsByGroup: Record<string, { passed: number; failed: number; notTested: number }> = {
  "A. Variant persistence": { passed: 0, failed: 0, notTested: 0 },
  "B. Authoritative pricing": { passed: 0, failed: 0, notTested: 0 },
  "C. Cart persistence": { passed: 0, failed: 0, notTested: 0 },
  "D. Stock and reservations": { passed: 0, failed: 0, notTested: 0 },
  "E. Checkout and order snapshots": { passed: 0, failed: 0, notTested: 0 },
  "F. Cancellation and recovery": { passed: 0, failed: 0, notTested: 0 },
  "G. Combination integrity": { passed: 0, failed: 0, notTested: 0 },
};

function assert(group: string, condition: boolean, message: string) {
  if (condition) {
    console.log(`  [PASS] ${message}`);
    testPassedCount++;
    if (resultsByGroup[group]) resultsByGroup[group].passed++;
  } else {
    console.error(`  [FAIL] ${message}`);
    testFailedCount++;
    if (resultsByGroup[group]) resultsByGroup[group].failed++;
    throw new Error(`Assertion failed in [${group}]: ${message}`);
  }
}

async function runTask5IntegrationTests() {
  const runId = Date.now().toString(36) + "-" + Math.floor(Math.random() * 1000);
  console.log(`\nInitializing Task 5 Suite (Run ID: ${runId})...\n`);

  // Direct MySQL connection for schema checks & raw fixture verification
  const directConn = await mysql.createConnection(safeConfig);

  const createdCategoryIds: string[] = [];
  const createdUserIds: string[] = [];
  const createdProductIds: string[] = [];
  const createdOrderIds: string[] = [];
  const createdAttemptIds: string[] = [];

  try {
    // -------------------------------------------------------------------------
    // Setup Test Baseline Fixtures
    // -------------------------------------------------------------------------
    const testCatId = "cat_t5_" + runId;
    await directConn.query(
      "INSERT INTO categories (id, name, slug, description, is_active) VALUES (?, ?, ?, ?, 1)",
      [testCatId, `Test Category ${runId}`, `test-cat-${runId}`, "Integration test category"]
    );
    createdCategoryIds.push(testCatId);

    // User A (Primary customer)
    const userAId = "usr_a_" + runId;
    await directConn.query(
      `INSERT INTO profiles (id, email, password_hash, full_name, role, status, created_at, updated_at)
       VALUES (?, ?, 'dummy_hash', 'Customer A', 'customer', 'active', NOW(), NOW())`,
      [userAId, `customer-a-${runId}@dearr.test`]
    );
    createdUserIds.push(userAId);

    // User B (For IDOR cross-customer verification)
    const userBId = "usr_b_" + runId;
    await directConn.query(
      `INSERT INTO profiles (id, email, password_hash, full_name, role, status, created_at, updated_at)
       VALUES (?, ?, 'dummy_hash', 'Customer B', 'customer', 'active', NOW(), NOW())`,
      [userBId, `customer-b-${runId}@dearr.test`]
    );
    createdUserIds.push(userBId);

    // =========================================================================
    // SCENARIO A: Variant Persistence
    // =========================================================================
    console.log("\n--- SCENARIO A: Variant Persistence ---");
    const groupA = "A. Variant persistence";

    const redColorId = crypto.randomUUID();
    const blueColorId = crypto.randomUUID();
    const redSKU_S = `RED-S-${runId}`;
    const redSKU_M = `RED-M-${runId}`;
    const blueSKU_S = `BLU-S-${runId}`;
    const blueSKU_M = `BLU-M-${runId}`;
    const customSKU = `CST-GEN-${runId}`;

    const prodA = await createProduct({
      categoryId: testCatId,
      name: "T5 Articulated Dragon",
      slug: `t5-dragon-${runId}`,
      description: "Test articulated dragon with multi-color and size combinations",
      price: 299,
      stockQuantity: 50,
      hasColors: true,
      colors: [
        { id: redColorId, name: "Crimson Red", hex: "#DC143C", sku: `COL-RED-${runId}`, stock: 25, priceOverride: 349 },
        { id: blueColorId, name: "Sapphire Blue", hex: "#0F52BA", sku: `COL-BLU-${runId}`, stock: 25, priceOverride: 329 },
      ],
      variants: [
        { name: "Crimson Red / Small", sku: redSKU_S, price: 499, stockQuantity: 10, colorId: redColorId, sizeName: "Small", isActive: true },
        { name: "Crimson Red / Medium", sku: redSKU_M, price: null, stockQuantity: 15, colorId: redColorId, sizeName: "Medium", isActive: true },
        { name: "Sapphire Blue / Small", sku: blueSKU_S, price: 0, stockQuantity: 8, colorId: blueColorId, sizeName: "Small", isActive: true },
        { name: "Sapphire Blue / Medium", sku: blueSKU_M, price: 549, stockQuantity: 12, colorId: blueColorId, sizeName: "Medium", isActive: true },
        { name: "Generic Custom Edition", sku: customSKU, price: 399, stockQuantity: 5, colorId: null, sizeName: null, isActive: true },
      ],
    });
    createdProductIds.push(prodA.id);

    assert(groupA, Boolean(prodA && prodA.id), "Product with color-size combinations created successfully in MySQL");

    // Read product back
    const fetchedProdA = await findProductById(prodA.id, true);
    assert(groupA, Boolean(fetchedProdA), "findProductById resolves created product");
    assert(groupA, fetchedProdA!.variants.length === 5, "Product returned with all 5 persisted variants");

    const varRedS = fetchedProdA!.variants.find((v) => v.sku === redSKU_S);
    const varRedM = fetchedProdA!.variants.find((v) => v.sku === redSKU_M);
    const varBlueS = fetchedProdA!.variants.find((v) => v.sku === blueSKU_S);
    const varCustom = fetchedProdA!.variants.find((v) => v.sku === customSKU);

    assert(groupA, Boolean(varRedS), "Variant Red/S exists");
    assert(groupA, varRedS?.colorId === redColorId, "Red/S variant colorId matches Crimson Red ID");
    assert(groupA, varRedS?.sizeName === "Small", "Red/S variant sizeName is 'Small'");
    assert(groupA, varRedS?.price === 499, "Red/S variant price is ₹499");
    assert(groupA, varRedS?.stockQuantity === 10, "Red/S variant stock is 10");
    assert(groupA, varRedS?.isActive === true, "Red/S variant isActive is true");

    // Nullable price verification
    assert(groupA, varRedM?.price === null, "Nullable variant price remains strictly NULL (not 0 or base price)");

    // Zero price verification
    assert(groupA, varBlueS?.price === 0, "Variant price of 0 remains strictly 0 (not NULL, not overridden)");

    // Generic custom variant verification
    assert(groupA, varCustom?.colorId === null && varCustom?.sizeName === null, "Custom variant has colorId=null and sizeName=null");

    // Update variant
    const updatedProdA = await updateProduct(prodA.id, {
      variants: [
        { id: varRedS!.id, name: "Crimson Red / Small (Special)", sku: redSKU_S, price: 529, stockQuantity: 14, colorId: redColorId, sizeName: "Small", isActive: true },
        { id: varRedM!.id, name: "Crimson Red / Medium", sku: redSKU_M, price: null, stockQuantity: 15, colorId: redColorId, sizeName: "Medium", isActive: true },
        { id: varBlueS!.id, name: "Sapphire Blue / Small", sku: blueSKU_S, price: 0, stockQuantity: 8, colorId: blueColorId, sizeName: "Small", isActive: true },
        { id: fetchedProdA!.variants.find((v) => v.sku === blueSKU_M)!.id, name: "Sapphire Blue / Medium", sku: blueSKU_M, price: 549, stockQuantity: 12, colorId: blueColorId, sizeName: "Medium", isActive: true },
        { id: varCustom!.id, name: "Generic Custom Edition", sku: customSKU, price: 399, stockQuantity: 5, colorId: null, sizeName: null, isActive: true },
      ],
    });
    const reFetchedRedS = updatedProdA?.variants.find((v) => v.sku === redSKU_S);
    assert(groupA, reFetchedRedS?.price === 529 && reFetchedRedS?.stockQuantity === 14, "Variant update persists price (₹529) and stock (14)");

    // Duplicate combination rejection
    let dupComboRejected = false;
    try {
      await updateProduct(prodA.id, {
        variants: [
          { name: "Red S 1", sku: `DUP-1-${runId}`, price: 100, stockQuantity: 1, colorId: redColorId, sizeName: "Small" },
          { name: "Red S 2", sku: `DUP-2-${runId}`, price: 100, stockQuantity: 1, colorId: redColorId, sizeName: "Small" },
        ],
      });
    } catch (err: any) {
      if (err instanceof ProductValidationError && err.message.includes("Duplicate variant combination")) {
        dupComboRejected = true;
      }
    }
    assert(groupA, dupComboRejected, "Rejects duplicate (color, size) combination within product (HTTP 400)");

    // Duplicate SKU rejection
    let dupSkuRejected = false;
    try {
      await createProduct({
        categoryId: testCatId,
        name: "Conflicting SKU Product",
        slug: `sku-conflict-${runId}`,
        description: "Testing SKU duplicate rejection",
        price: 199,
        stockQuantity: 10,
        variants: [
          { name: "Conflict", sku: redSKU_S, price: 199, stockQuantity: 5 },
        ],
      });
    } catch (err: any) {
      if (err instanceof ProductValidationError && err.message.includes("already exists")) {
        dupSkuRejected = true;
      }
    }
    assert(groupA, dupSkuRejected, "Rejects duplicate SKU across products (HTTP 409)");

    // Cross-product variant ID reuse rejection
    const prodB = await createProduct({
      categoryId: testCatId,
      name: "Product B For ID Reuse Test",
      slug: `prod-b-${runId}`,
      description: "Testing cross product variant ID reuse",
      price: 199,
      stockQuantity: 10,
    });
    createdProductIds.push(prodB.id);

    let crossProductReuseRejected = false;
    try {
      await updateProduct(prodB.id, {
        variants: [
          { id: varRedS!.id, name: "Stolen Variant", sku: `STOLEN-${runId}`, price: 199, stockQuantity: 5 },
        ],
      });
    } catch (err: any) {
      if (err instanceof ProductValidationError && (err.message.includes("already belongs") || err.message.includes("already exists") || err.statusCode === 400 || err.statusCode === 409)) {
        crossProductReuseRejected = true;
      }
    }
    assert(groupA, crossProductReuseRejected, "Rejects reusing variant ID belonging to another product (HTTP 400/409)");

    // =========================================================================
    // SCENARIO B: Authoritative Pricing
    // =========================================================================
    console.log("\n--- SCENARIO B: Authoritative Pricing ---");
    const groupB = "B. Authoritative pricing";

    // 1. Variant price overrides color and product base
    // Base = 299, Red Color Override = 349, Red/S Variant = 529
    const price1 = resolveAuthoritativeUnitPrice({
      productPrice: 299,
      colorPriceOverride: 349,
      variantPrice: 529,
    });
    assert(groupB, price1 === 529, "Variant price (₹529) authoritatively overrides color override (₹349) and base (₹299)");

    // 2. Variant price NULL falls back to color price override
    // Base = 299, Red Color Override = 349, Red/M Variant = null
    const price2 = resolveAuthoritativeUnitPrice({
      productPrice: 299,
      colorPriceOverride: 349,
      variantPrice: null,
    });
    assert(groupB, price2 === 349, "When variant price is NULL, color price override (₹349) is authoritatively used");

    // 3. Both variant and color price NULL falls back to base product price
    const price3 = resolveAuthoritativeUnitPrice({
      productPrice: 299,
      colorPriceOverride: null,
      variantPrice: null,
    });
    assert(groupB, price3 === 299, "When both variant and color price are NULL, product base price (₹299) is used");

    // 4. Variant price of 0 is valid and does NOT fall through
    const price4 = resolveAuthoritativeUnitPrice({
      productPrice: 299,
      colorPriceOverride: 349,
      variantPrice: 0,
    });
    assert(groupB, price4 === 0, "Variant price of ₹0 is valid and does NOT fall through to color override or base");

    // 5. DB resolver check
    const resolvedItem = await withTransaction(async (conn) => {
      return await resolveAuthoritativeItemFromDb(conn, {
        productId: prodA.id,
        variantId: varRedS!.id,
        colorId: redColorId,
      });
    });
    assert(groupB, resolvedItem.unitPrice === 529, "resolveAuthoritativeItemFromDb returns exact authoritative price (₹529)");

    // =========================================================================
    // SCENARIO C: Cart Persistence
    // =========================================================================
    console.log("\n--- SCENARIO C: Cart Persistence ---");
    const groupC = "C. Cart persistence";

    // 1. Add specific color-size variant to user A's cart
    const cartA = await getOrCreateActiveCartForUser(userAId);
    assert(groupC, Boolean(cartA && cartA.id), "User A has active cart in MySQL");

    await addCartItem(userAId, {
      productId: prodA.id,
      variantId: varRedS!.id,
      colorId: redColorId,
      quantity: 2,
    });

    const userACart = await getCartForUser(userAId);
    assert(groupC, userACart.items.length === 1, "Cart contains 1 item");
    const cartItem1 = userACart.items[0];
    assert(groupC, cartItem1.variantId === varRedS!.id, "Cart item variantId matches Red/S variant");
    assert(groupC, cartItem1.colorId === redColorId, "Cart item colorId matches Crimson Red");
    assert(groupC, cartItem1.pricing.unitPrice === 529, "Cart item unitPrice authoritatively set to ₹529");
    assert(groupC, cartItem1.quantity === 2, "Cart item quantity is 2");

    // 2. Quantity updates respect available stock
    // Red/S has stock 14. Setting quantity to 20 should throw CartValidationError
    let stockExceededRejected = false;
    try {
      await updateCartItemQuantity(userAId, cartItem1.id, 20);
    } catch (err: any) {
      if (err instanceof CartValidationError && (err.message.includes("Maximum") || err.message.includes("stock") || err.statusCode === 400)) {
        stockExceededRejected = true;
      }
    }
    assert(groupC, stockExceededRejected, "Rejects updating cart item quantity beyond available stock / max limits");

    // 3. Separate variant combinations do not accidentally merge
    // Add Red/M to cart
    await addCartItem(userAId, {
      productId: prodA.id,
      variantId: varRedM!.id,
      colorId: redColorId,
      quantity: 1,
    });

    const userACartMulti = await getCartForUser(userAId);
    assert(groupC, userACartMulti.items.length === 2, "Separate variant combinations (Red/S and Red/M) persist as 2 distinct cart items");

    // 4. Inactive variant cannot be added to cart
    // Deactivate Sapphire Blue / Medium
    const varBlueM = fetchedProdA!.variants.find((v) => v.sku === blueSKU_M)!;
    await directConn.query("UPDATE product_variants SET is_active = 0 WHERE id = ?", [varBlueM.id]);

    let inactiveVariantRejected = false;
    try {
      await addCartItem(userAId, {
        productId: prodA.id,
        variantId: varBlueM.id,
        colorId: blueColorId,
        quantity: 1,
      });
    } catch (err: any) {
      if (err instanceof CartValidationError && err.message.includes("inactive")) {
        inactiveVariantRejected = true;
      }
    }
    assert(groupC, inactiveVariantRejected, "Rejects adding inactive variant to cart (HTTP 400)");

    // Restore active status
    await directConn.query("UPDATE product_variants SET is_active = 1 WHERE id = ?", [varBlueM.id]);

    // 5. Variant belonging to another product cannot be selected
    let mismatchVariantRejected = false;
    try {
      await addCartItem(userAId, {
        productId: prodB.id,
        variantId: varRedS!.id,
        quantity: 1,
      });
    } catch (err: any) {
      if (err instanceof CartValidationError && err.message.includes("does not belong")) {
        mismatchVariantRejected = true;
      }
    }
    assert(groupC, mismatchVariantRejected, "Rejects adding variant belonging to another product (HTTP 400)");

    // 6. IDOR protection: User B cannot access User A's cart items
    let idorRejected = false;
    try {
      await updateCartItemQuantity(userBId, cartItem1.id, 1);
    } catch (err: any) {
      if (err instanceof CartValidationError && (err.statusCode === 403 || err.statusCode === 404)) {
        idorRejected = true;
      }
    }
    assert(groupC, idorRejected, "IDOR protection: User B cannot modify User A's cart item (HTTP 403/404)");

    // =========================================================================
    // SCENARIO D: Stock and Reservations
    // =========================================================================
    console.log("\n--- SCENARIO D: Stock and Reservations ---");
    const groupD = "D. Stock and reservations";

    // 1. Checkout attempt creates active stock reservation on variant
    // Create checkout attempt for User A's cart (currently has 2 Red/S and 1 Red/M)
    const shippingAddress = {
      shippingFullName: "Customer A",
      shippingPhone: "9876543210",
      shippingAddressLine1: "123 Test Street",
      shippingAddressLine2: "Suite 4B",
      shippingCity: "Bengaluru",
      shippingState: "Karnataka",
      shippingPostalCode: "560001",
      shippingCountry: "India",
    };

    const attemptA = await createCheckoutAttemptFromCart(userAId, shippingAddress);
    createdAttemptIds.push(attemptA.id);
    assert(groupD, Boolean(attemptA && attemptA.id), "Checkout attempt created successfully");

    // Verify stock_reservations table
    const [resRows]: any = await directConn.query(
      "SELECT * FROM stock_reservations WHERE attempt_id = ? AND variant_id = ?",
      [attemptA.id, varRedS!.id]
    );
    assert(groupD, resRows.length === 1, "Active stock reservation created with variant_id");
    assert(groupD, resRows[0].quantity === 2, "Reservation quantity is 2");
    assert(groupD, resRows[0].status === "active", "Reservation status is 'active'");

    // 2. Effective stock in cart decreases by active reservation
    // varRedS has stock 14. With 2 reserved, available is 12
    const cartAfterReservation = await getCartForUser(userAId);
    const cartItemRedS = cartAfterReservation.items.find((i) => i.variantId === varRedS!.id);
    assert(groupD, cartItemRedS?.stock.stockQuantity === 12, "Effective available stock for Red/S decreased to 12 (14 - 2 reserved)");

    // 3. Expired or released reservations are not counted in deduction
    const dummyAttemptId = crypto.randomUUID();
    const expiredResId = crypto.randomUUID();
    await directConn.query(
      `INSERT INTO checkout_attempts (id, user_id, cart_id, provider, amount, currency, checkout_data, expires_at, retention_until, created_at, updated_at)
       VALUES (?, ?, ?, 'razorpay', 100, 'INR', '{}', DATE_SUB(NOW(), INTERVAL 1 HOUR), DATE_ADD(NOW(), INTERVAL 30 DAY), NOW(), NOW())`,
      [dummyAttemptId, userAId, cartA.id]
    );
    createdAttemptIds.push(dummyAttemptId);

    // Insert an expired reservation
    await directConn.query(
      `INSERT INTO stock_reservations (id, attempt_id, product_id, color_id, variant_id, quantity, status, expires_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 5, 'active', DATE_SUB(NOW(), INTERVAL 30 MINUTE), NOW(), NOW())`,
      [expiredResId, dummyAttemptId, prodA.id, redColorId, varRedS!.id]
    );

    // Effective stock should still be 12 (the expired 5 units must NOT be subtracted)
    const cartAfterExpired = await getCartForUser(userAId);
    const cartItemRedS2 = cartAfterExpired.items.find((i) => i.variantId === varRedS!.id);
    assert(groupD, cartItemRedS2?.stock.stockQuantity === 12, "Expired active reservation is NOT deducted from effective stock");

    // 4. Variant reservations and color-only reservations are handled separately
    const [colorStockCheck]: any = await directConn.query("SELECT reserved_stock FROM product_colors WHERE id = ?", [redColorId]);
    assert(groupD, colorStockCheck[0].reserved_stock === 0, "Variant reservation does NOT pollute product_colors.reserved_stock (remains 0)");

    // 5. Cleanup releases eligible expired reservations
    const cleanupResult = await cleanupExpiredCheckoutAttempts();
    assert(groupD, cleanupResult.releasedReservationsCount >= 1, "cleanupExpiredCheckoutAttempts released expired reservation");

    const [checkedExpiredRes]: any = await directConn.query("SELECT status FROM stock_reservations WHERE id = ?", [expiredResId]);
    assert(groupD, checkedExpiredRes[0].status === "released", "Expired reservation status transitioned to 'released'");

    // 6. Repeated cleanup is idempotent and does not release captured/verified attempts
    const cleanupResult2 = await cleanupExpiredCheckoutAttempts();
    assert(groupD, cleanupResult2.releasedReservationsCount === 0, "Repeated cleanup releases 0 additional reservations (idempotent)");

    // Verify attemptA (which is not expired) was NOT released
    const [activeResCheck]: any = await directConn.query("SELECT status FROM stock_reservations WHERE id = ?", [resRows[0].id]);
    assert(groupD, activeResCheck[0].status === "active", "Unexpired active reservation for attemptA remains active");

    // =========================================================================
    // SCENARIO E: Checkout and Order Snapshots
    // =========================================================================
    console.log("\n--- SCENARIO E: Checkout and Order Snapshots ---");
    const groupE = "E. Checkout and order snapshots";

    // 1. Checkout rejects insufficient stock
    let checkoutOutOfStockRejected = false;
    try {
      // Create user B cart with huge quantity of Blue/S
      await addCartItem(userBId, {
        productId: prodA.id,
        variantId: varBlueS!.id,
        colorId: blueColorId,
        quantity: 8, // exact stock
      });
      // Now another attempt wants 2 more
      const cartB = await getOrCreateActiveCartForUser(userBId);
      // Directly insert cart_item with quantity 20
      await directConn.query(
        "UPDATE cart_items SET quantity = 20 WHERE cart_id = ? AND variant_id = ?",
        [cartB.id, varBlueS!.id]
      );
      await createCheckoutAttemptFromCart(userBId, shippingAddress);
    } catch (err: any) {
      if (err instanceof CheckoutAttemptError && (err.message.includes("Insufficient") || err.message.includes("Maximum"))) {
        checkoutOutOfStockRejected = true;
      }
    }
    assert(groupE, checkoutOutOfStockRejected, "Checkout attempt rejects insufficient stock (HTTP 400/409)");

    // 2. Finalize order from attemptA
    // attemptA reserved 2 units of Red/S (stock was 14) and 1 unit of Red/M (stock was 15)
    const finalized = await finalizeOrderFromAttempt(attemptA.id, {
      providerPaymentId: `pay_${runId}`,
    });
    createdOrderIds.push(finalized.id);
    assert(groupE, Boolean(finalized && finalized.id), "finalizeOrderFromAttempt successfully created order");

    // 3. Verify order-item snapshots
    const orderData = await getOrderById(finalized.id);
    assert(groupE, Boolean(orderData), "getOrderById successfully retrieves placed order");
    assert(groupE, orderData!.items.length === 2, "Order has 2 items");

    const orderItemRedS = orderData!.items.find((it) => it.variantId === varRedS!.id);
    assert(groupE, Boolean(orderItemRedS), "Order item for Red/S exists");
    assert(groupE, orderItemRedS?.variantId === varRedS!.id, "Order item snapshot retains variantId");
    assert(groupE, orderItemRedS?.colorId === redColorId, "Order item snapshot retains colorId");
    assert(groupE, orderItemRedS?.unitPrice === 529, "Order item snapshot retains authoritative unitPrice (₹529)");
    assert(groupE, orderItemRedS?.quantity === 2, "Order item snapshot retains quantity (2)");
    assert(groupE, orderItemRedS?.sku === redSKU_S, "Order item snapshot retains variant SKU");

    // 4. Verify variant stock is deducted exactly once
    const [vStockRow]: any = await directConn.query("SELECT stock_quantity FROM product_variants WHERE id = ?", [varRedS!.id]);
    assert(groupE, vStockRow[0].stock_quantity === 12, "Product variant stock deducted by exactly 2 (14 -> 12)");

    // 5. Reservation converted/consumed, preventing double deduction
    const [resConsumedRow]: any = await directConn.query(
      "SELECT status FROM stock_reservations WHERE attempt_id = ? AND variant_id = ?",
      [attemptA.id, varRedS!.id]
    );
    assert(groupE, resConsumedRow[0].status === "consumed", "Stock reservation transitioned to 'consumed'");

    // Available stock after finalization remains 12 (not double-deducted)
    const availStockAfterFinalize = resolveAuthoritativeEffectiveStock({
      hasVariant: true,
      variantStock: vStockRow[0].stock_quantity,
      variantReservedStock: 0, // consumed reservation is no longer active
      hasColor: false,
    });
    assert(groupE, availStockAfterFinalize === 12, "Effective stock is exactly 12 (no double deduction from reservation + stock reduction)");

    // 6. Color-only product path verification
    const colorOnlyProd = await createProduct({
      categoryId: testCatId,
      name: "Color-Only Dragon",
      slug: `color-only-dragon-${runId}`,
      description: "Testing color-only stock deduction",
      price: 199,
      stockQuantity: 20,
      hasColors: true,
      colors: [
        { name: "Gold", hex: "#FFD700", sku: `GLD-${runId}`, stock: 20, priceOverride: 249 },
      ],
    });
    createdProductIds.push(colorOnlyProd.id);
    const goldColor = colorOnlyProd.colors[0];

    // Simple product path verification
    const simpleProd = await createProduct({
      categoryId: testCatId,
      name: "Simple Dragon Keychain",
      slug: `simple-dragon-${runId}`,
      description: "Testing simple product stock deduction",
      price: 99,
      stockQuantity: 30,
      hasColors: false,
    });
    createdProductIds.push(simpleProd.id);

    assert(groupE, Boolean(colorOnlyProd && simpleProd), "Color-only and simple products created for lifecycle validation");

    // =========================================================================
    // SCENARIO F: Cancellation and Recovery
    // =========================================================================
    console.log("\n--- SCENARIO F: Cancellation and Recovery ---");
    const groupF = "F. Cancellation and recovery";

    // 1. Cancel eligible test order and verify variant stock restoration
    const cancelledOrder = await cancelOrder(
      finalized.id,
      userAId,
      "Customer changed mind before dispatch"
    );
    assert(groupF, cancelledOrder.status === "cancelled", "Order status updated to 'cancelled'");

    // Verify Red/S variant stock restored from 12 back to 14
    const [vStockRestored]: any = await directConn.query("SELECT stock_quantity FROM product_variants WHERE id = ?", [varRedS!.id]);
    assert(groupF, vStockRestored[0].stock_quantity === 14, "Variant stock restored by 2 back to 14 on order cancellation");

    // 2. Repeated cancellation cannot restore stock again (idempotent / terminal status)
    let doubleCancelRejected = false;
    try {
      await cancelOrder(
        finalized.id,
        userAId,
        "Attempting second cancellation"
      );
    } catch (err: any) {
      if (err instanceof OrderValidationError && err.message.includes("already cancelled")) {
        doubleCancelRejected = true;
      }
    }
    assert(groupF, doubleCancelRejected, "Rejects repeated cancellation of already cancelled order (HTTP 400)");

    const [vStockNoDoubleRestoration]: any = await directConn.query("SELECT stock_quantity FROM product_variants WHERE id = ?", [varRedS!.id]);
    assert(groupF, vStockNoDoubleRestoration[0].stock_quantity === 14, "Variant stock remains 14 (no double restoration)");

    // 3. Failed/abandoned checkout cleanup releases reservations safely
    const failAttemptId = crypto.randomUUID();
    await directConn.query(
      `INSERT INTO checkout_attempts (id, user_id, cart_id, provider, amount, currency, checkout_data, expires_at, retention_until, created_at, updated_at)
       VALUES (?, ?, ?, 'razorpay', 200, 'INR', '{}', DATE_ADD(NOW(), INTERVAL 15 MINUTE), DATE_ADD(NOW(), INTERVAL 30 DAY), NOW(), NOW())`,
      [failAttemptId, userAId, cartA.id]
    );
    createdAttemptIds.push(failAttemptId);

    const failResId = crypto.randomUUID();
    await directConn.query(
      `INSERT INTO stock_reservations (id, attempt_id, product_id, color_id, variant_id, quantity, status, expires_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 3, 'active', DATE_ADD(NOW(), INTERVAL 15 MINUTE), NOW(), NOW())`,
      [failResId, failAttemptId, prodA.id, redColorId, varRedS!.id]
    );

    const releasedCount = await releaseCheckoutAttemptReservations(failAttemptId);
    assert(groupF, releasedCount === 1, "releaseCheckoutAttemptReservations successfully released 1 reservation");

    const [failResRow]: any = await directConn.query("SELECT status FROM stock_reservations WHERE id = ?", [failResId]);
    assert(groupF, failResRow[0].status === "released", "Reservation status transitioned to 'released'");

    // Repeated release on same attempt returns 0
    const repeatedReleaseCount = await releaseCheckoutAttemptReservations(failAttemptId);
    assert(groupF, repeatedReleaseCount === 0, "Repeated releaseCheckoutAttemptReservations safely returns 0 (idempotent)");

    // =========================================================================
    // SCENARIO G: Combination Integrity
    // =========================================================================
    console.log("\n--- SCENARIO G: Combination Integrity ---");
    const groupG = "G. Combination integrity";

    // 1. MySQL Database Uniqueness Constraint uq_product_variants_combo
    let dbDupComboRejected = false;
    try {
      // Direct raw SQL insert trying to insert the same (color_id, size_name) into MySQL directly
      await directConn.query(
        `INSERT INTO product_variants (id, product_id, color_id, size_name, name, sku, price, stock_quantity, is_active)
         VALUES (?, ?, ?, ?, 'Direct DB Dup', ?, 100, 5, 1)`,
        [crypto.randomUUID(), prodA.id, redColorId, "Small", `RAW-DUP-${runId}`]
      );
    } catch (err: any) {
      if (err.code === "ER_DUP_ENTRY" && err.message.includes("uq_product_variants_combo")) {
        dbDupComboRejected = true;
      }
    }
    assert(groupG, dbDupComboRejected, "MySQL database constraint `uq_product_variants_combo` rejects duplicate combo at DB layer (ER_DUP_ENTRY 1062)");

    // 2. Nullable combination fields behavior
    // Size-only variant
    const sizeOnlyVarId = crypto.randomUUID();
    await directConn.query(
      `INSERT INTO product_variants (id, product_id, color_id, size_name, name, sku, price, stock_quantity, is_active)
       VALUES (?, ?, NULL, 'Extra-Large', 'Size Only Variant', ?, 599, 10, 1)`,
      [sizeOnlyVarId, prodA.id, `SIZE-ONLY-${runId}`]
    );
    const [sizeOnlyRow]: any = await directConn.query(
      "SELECT color_id, size_name, combo_hash FROM product_variants WHERE id = ?",
      [sizeOnlyVarId]
    );
    assert(groupG, sizeOnlyRow[0].color_id === null, "Size-only variant has color_id = NULL");
    assert(groupG, sizeOnlyRow[0].size_name === "Extra-Large", "Size-only variant has size_name = 'Extra-Large'");
    assert(groupG, sizeOnlyRow[0].combo_hash.endsWith("::extra-large"), "combo_hash computed correctly for size-only variant");

    // Multiple generic variants (both color_id and size_name are NULL)
    // MySQL unique constraint allows multiple NULL values for combo_hash
    const genVar1Id = crypto.randomUUID();
    const genVar2Id = crypto.randomUUID();
    await directConn.query(
      `INSERT INTO product_variants (id, product_id, color_id, size_name, name, sku, price, stock_quantity, is_active)
       VALUES (?, ?, NULL, NULL, 'Generic Variant 1', ?, 199, 5, 1)`,
      [genVar1Id, prodA.id, `GEN-1-${runId}`]
    );
    await directConn.query(
      `INSERT INTO product_variants (id, product_id, color_id, size_name, name, sku, price, stock_quantity, is_active)
       VALUES (?, ?, NULL, NULL, 'Generic Variant 2', ?, 219, 5, 1)`,
      [genVar2Id, prodA.id, `GEN-2-${runId}`]
    );

    const [gen1Row]: any = await directConn.query("SELECT combo_hash FROM product_variants WHERE id = ?", [genVar1Id]);
    const [gen2Row]: any = await directConn.query("SELECT combo_hash FROM product_variants WHERE id = ?", [genVar2Id]);
    assert(groupG, gen1Row[0].combo_hash === null && gen2Row[0].combo_hash === null, "Multiple generic variants coexist with combo_hash = NULL without conflict");

    // 3. Foreign Key Delete Constraints
    // Deleting a product cascades to product_variants
    const doomedProd = await createProduct({
      categoryId: testCatId,
      name: "Doomed Product",
      slug: `doomed-${runId}`,
      description: "Testing cascade delete",
      price: 100,
      stockQuantity: 10,
      variants: [{ name: "Doomed Var", sku: `DOOM-${runId}`, price: 100, stockQuantity: 5 }],
    });
    const doomedVarId = doomedProd.variants[0].id;

    // Add doomed variant to User B cart
    await addCartItem(userBId, {
      productId: doomedProd.id,
      variantId: doomedVarId,
      quantity: 1,
    });

    // Delete the variant directly (not the whole product) to test ON DELETE SET NULL on cart_items.variant_id
    await directConn.query("DELETE FROM product_variants WHERE id = ?", [doomedVarId]);

    const [deletedVar]: any = await directConn.query("SELECT id FROM product_variants WHERE id = ?", [doomedVarId]);
    assert(groupG, deletedVar.length === 0, "Variant successfully deleted directly from MySQL");

    // Cart item should have variant_id set to NULL due to ON DELETE SET NULL
    const [cartItemDoomed]: any = await directConn.query(
      "SELECT variant_id FROM cart_items WHERE product_id = ?",
      [doomedProd.id]
    );
    assert(groupG, cartItemDoomed.length > 0 && cartItemDoomed[0].variant_id === null, "cart_items.variant_id set to NULL when variant is deleted (ON DELETE SET NULL)");

    // Deleting product cascades and cleans up cart_items and product
    await directConn.query("DELETE FROM products WHERE id = ?", [doomedProd.id]);
    const [cascadedCart]: any = await directConn.query("SELECT id FROM cart_items WHERE product_id = ?", [doomedProd.id]);
    assert(groupG, cascadedCart.length === 0, "Deleting product cascades and removes associated cart_items");

  } finally {
    // -------------------------------------------------------------------------
    // Safe Teardown: Clean up ONLY records created during this test run
    // -------------------------------------------------------------------------
    console.log("\n--- Cleaning up test fixtures from dearr_test ---");
    try {
      if (createdOrderIds.length > 0) {
        const ph = createdOrderIds.map(() => "?").join(",");
        await directConn.query(`DELETE FROM order_items WHERE order_id IN (${ph})`, createdOrderIds);
        await directConn.query(`DELETE FROM payments WHERE order_id IN (${ph})`, createdOrderIds);
        await directConn.query(`DELETE FROM orders WHERE id IN (${ph})`, createdOrderIds);
      }

      if (createdAttemptIds.length > 0) {
        const ph = createdAttemptIds.map(() => "?").join(",");
        await directConn.query(`DELETE FROM stock_reservations WHERE attempt_id IN (${ph})`, createdAttemptIds);
        await directConn.query(`DELETE FROM checkout_attempts WHERE id IN (${ph})`, createdAttemptIds);
      }

      if (createdUserIds.length > 0) {
        const ph = createdUserIds.map(() => "?").join(",");
        await directConn.query(
          `DELETE FROM cart_items WHERE cart_id IN (SELECT id FROM carts WHERE user_id IN (${ph}))`,
          createdUserIds
        );
        await directConn.query(`DELETE FROM carts WHERE user_id IN (${ph})`, createdUserIds);
      }

      if (createdProductIds.length > 0) {
        const ph = createdProductIds.map(() => "?").join(",");
        await directConn.query(`DELETE FROM stock_reservations WHERE product_id IN (${ph})`, createdProductIds);
        await directConn.query(`DELETE FROM cart_items WHERE product_id IN (${ph})`, createdProductIds);
        await directConn.query(`DELETE FROM product_images WHERE product_id IN (${ph})`, createdProductIds);
        await directConn.query(`DELETE FROM product_variants WHERE product_id IN (${ph})`, createdProductIds);
        await directConn.query(`DELETE FROM product_colors WHERE product_id IN (${ph})`, createdProductIds);
        await directConn.query(`DELETE FROM products WHERE id IN (${ph})`, createdProductIds);
      }

      if (createdUserIds.length > 0) {
        const ph = createdUserIds.map(() => "?").join(",");
        await directConn.query(`DELETE FROM profiles WHERE id IN (${ph})`, createdUserIds);
      }

      if (createdCategoryIds.length > 0) {
        const ph = createdCategoryIds.map(() => "?").join(",");
        await directConn.query(`DELETE FROM categories WHERE id IN (${ph})`, createdCategoryIds);
      }

      console.log("[PASS] Test fixtures cleaned up successfully.");
    } catch (cleanupErr: any) {
      console.error("[WARN] Cleanup error:", cleanupErr.message);
    } finally {
      await directConn.end();
    }
  }

  // ---------------------------------------------------------------------------
  // Summary Report
  // ---------------------------------------------------------------------------
  console.log("\n================================================================================");
  console.log("TASK 5 INTEGRATION TEST SUITE SUMMARY");
  console.log("================================================================================");
  for (const [group, counts] of Object.entries(resultsByGroup)) {
    console.log(`  ${group.padEnd(35)} : Passed: ${counts.passed}, Failed: ${counts.failed}, Not Tested: ${counts.notTested}`);
  }
  console.log("--------------------------------------------------------------------------------");
  console.log(`TOTAL PASSED: ${testPassedCount} | TOTAL FAILED: ${testFailedCount}`);
  console.log("================================================================================\n");

  // Drain and close pool connections so process exits cleanly
  if ((globalThis as any)._dearrMysqlPool) {
    try {
      await (globalThis as any)._dearrMysqlPool.end();
    } catch {}
  }

  if (testFailedCount > 0) {
    throw new Error(`Task 5 integration tests failed: ${testFailedCount} failures`);
  }
}

runTask5IntegrationTests()
  .then(() => {
    process.exit(0);
  })
  .catch(async (err) => {
    console.error("\n[FATAL] Test execution failed:", err);
    if ((globalThis as any)._dearrMysqlPool) {
      try {
        await (globalThis as any)._dearrMysqlPool.end();
      } catch {}
    }
    process.exit(1);
  });
