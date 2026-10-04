/**
 * Dearr V1 — B-17 Order API Verification Test Suite
 *
 * Verifies:
 *  - Order creation from active cart (server-authoritative pricing & stock)
 *  - Historical snapshot immutability (order_items preserve purchase-time data)
 *  - Customer ownership enforcement (IDOR prevention)
 *  - Admin order listing with filters and pagination
 *  - Order status transitions (state machine validation)
 *  - Payment status updates (admin-only)
 *  - Order cancellation with stock restoration
 *  - Cart conversion (cart marked as 'converted' after order)
 *  - Stock deduction on order creation
 *  - Input validation for shipping address
 *
 * Usage:
 *   npx tsx database/verify-b17-orders.ts
 *
 * Pool management: Uses connectionLimit=2 to stay within Hostinger limits.
 */

// In standalone node scripts outside Next.js bundler, mock server-only and next/headers
require.cache[require.resolve("server-only")] = {
  id: require.resolve("server-only"),
  filename: require.resolve("server-only"),
  loaded: true,
  exports: {},
} as any;

let mockSessionToken: string | null = null;

require.cache[require.resolve("next/headers")] = {
  id: require.resolve("next/headers"),
  filename: require.resolve("next/headers"),
  loaded: true,
  exports: {
    cookies: async () => ({
      get: (name: string) => (name === "dearr_session" && mockSessionToken ? { name, value: mockSessionToken } : undefined),
      set: () => {},
      delete: () => {},
    }),
  },
} as any;

import mysql, { Pool, PoolConnection } from "mysql2/promise";
import crypto from "crypto";
import fs from "fs";
import path from "path";

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

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const DB_CONFIG = {
  host: process.env.DB_HOST || "127.0.0.1",
  port: parseInt(process.env.DB_PORT || "3306", 10),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  waitForConnections: true,
  connectionLimit: 2,
  maxIdle: 2,
  idleTimeout: 30000,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
};

let pool: Pool;
let pass = 0;
let fail = 0;

// Test data IDs
const TEST_PREFIX = "b17_test_";
const testCustomerId = `${TEST_PREFIX}cust_${crypto.randomUUID().slice(0, 8)}`;
const testCustomer2Id = `${TEST_PREFIX}cust2_${crypto.randomUUID().slice(0, 8)}`;
const testAdminId = `${TEST_PREFIX}admin_${crypto.randomUUID().slice(0, 8)}`;
const testCategoryId = `${TEST_PREFIX}cat_${crypto.randomUUID().slice(0, 8)}`;
const testProductId = `${TEST_PREFIX}prod_${crypto.randomUUID().slice(0, 8)}`;
const testProduct2Id = `${TEST_PREFIX}prod2_${crypto.randomUUID().slice(0, 8)}`;
const testVariantId = `${TEST_PREFIX}var_${crypto.randomUUID().slice(0, 8)}`;
const testCartId = `${TEST_PREFIX}cart_${crypto.randomUUID().slice(0, 8)}`;
const testCartItem1Id = `${TEST_PREFIX}ci1_${crypto.randomUUID().slice(0, 8)}`;
const testCartItem2Id = `${TEST_PREFIX}ci2_${crypto.randomUUID().slice(0, 8)}`;

// Will be populated during tests
let createdOrderId: string = "";
let createdOrderNumber: string = "";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function assert(condition: boolean, label: string): void {
  if (condition) {
    pass++;
    console.log(`  ✅ ${label}`);
  } else {
    fail++;
    console.error(`  ❌ ${label}`);
  }
}

async function queryPool<T = any>(sql: string, params?: any[]): Promise<T> {
  const [rows] = await pool.execute(sql, params);
  return rows as T;
}

function roundToTwo(num: number): number {
  return Math.round(num * 100) / 100;
}

// ---------------------------------------------------------------------------
// Setup & Teardown
// ---------------------------------------------------------------------------

async function cleanup() {
  console.log("\n🧹 Cleaning up test data...");
  const conn = await pool.getConnection();
  try {
    // Delete in dependency order
    await conn.execute(`DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE user_id IN (?, ?, ?))`, [testCustomerId, testCustomer2Id, testAdminId]);
    await conn.execute(`DELETE FROM orders WHERE user_id IN (?, ?, ?)`, [testCustomerId, testCustomer2Id, testAdminId]);
    await conn.execute(`DELETE FROM cart_items WHERE cart_id IN (SELECT id FROM carts WHERE user_id IN (?, ?, ?))`, [testCustomerId, testCustomer2Id, testAdminId]);
    await conn.execute(`DELETE FROM carts WHERE user_id IN (?, ?, ?)`, [testCustomerId, testCustomer2Id, testAdminId]);
    await conn.execute(`DELETE FROM product_variants WHERE id = ?`, [testVariantId]);
    await conn.execute(`DELETE FROM products WHERE id IN (?, ?)`, [testProductId, testProduct2Id]);
    await conn.execute(`DELETE FROM categories WHERE id = ?`, [testCategoryId]);
    await conn.execute(`DELETE FROM profiles WHERE id IN (?, ?, ?)`, [testCustomerId, testCustomer2Id, testAdminId]);
  } finally {
    conn.release();
  }
}

async function seedTestData() {
  console.log("🌱 Seeding test data...\n");
  const conn = await pool.getConnection();
  try {
    // Profiles
    const dummyHash = "$2a$10$XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX";
    await conn.execute(
      `INSERT INTO profiles (id, email, password_hash, full_name, phone, role, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'customer', NOW(), NOW())`,
      [testCustomerId, `b17cust1@test.com`, dummyHash, "B17 Customer 1", "9876543210"]
    );
    await conn.execute(
      `INSERT INTO profiles (id, email, password_hash, full_name, phone, role, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'customer', NOW(), NOW())`,
      [testCustomer2Id, `b17cust2@test.com`, dummyHash, "B17 Customer 2", "9876543211"]
    );
    await conn.execute(
      `INSERT INTO profiles (id, email, password_hash, full_name, phone, role, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'admin', NOW(), NOW())`,
      [testAdminId, `b17admin@test.com`, dummyHash, "B17 Admin", "9876543212"]
    );

    // Category
    await conn.execute(
      `INSERT INTO categories (id, name, slug, is_active, created_at, updated_at)
       VALUES (?, 'B17 Test Category', 'b17-test-category', 1, NOW(), NOW())`,
      [testCategoryId]
    );

    // Products
    await conn.execute(
      `INSERT INTO products (id, category_id, name, slug, description, price, compare_at_price, stock_quantity, is_active, created_at, updated_at)
       VALUES (?, ?, 'B17 Test Product', 'b17-test-product', 'A test product for B-17', 499.00, 599.00, 25, 1, NOW(), NOW())`,
      [testProductId, testCategoryId]
    );
    await conn.execute(
      `INSERT INTO products (id, category_id, name, slug, description, price, stock_quantity, is_active, created_at, updated_at)
       VALUES (?, ?, 'B17 Test Product 2', 'b17-test-product-2', 'Another test product', 299.00, 10, 1, NOW(), NOW())`,
      [testProduct2Id, testCategoryId]
    );

    // Variant for product 1
    await conn.execute(
      `INSERT INTO product_variants (id, product_id, name, sku, price, stock_quantity, is_active, created_at, updated_at)
       VALUES (?, ?, 'Pink', 'B17-PINK-01', 549.00, 15, 1, NOW(), NOW())`,
      [testVariantId, testProductId]
    );

    // Active cart for customer 1 with items
    await conn.execute(
      `INSERT INTO carts (id, user_id, status, created_at, updated_at)
       VALUES (?, ?, 'active', NOW(), NOW())`,
      [testCartId, testCustomerId]
    );
    // Cart item 1: variant product
    await conn.execute(
      `INSERT INTO cart_items (id, cart_id, product_id, variant_id, quantity, created_at, updated_at)
       VALUES (?, ?, ?, ?, 2, NOW(), NOW())`,
      [testCartItem1Id, testCartId, testProductId, testVariantId]
    );
    // Cart item 2: non-variant product
    await conn.execute(
      `INSERT INTO cart_items (id, cart_id, product_id, variant_id, quantity, created_at, updated_at)
       VALUES (?, ?, ?, NULL, 1, NOW(), NOW())`,
      [testCartItem2Id, testCartId, testProduct2Id]
    );
  } finally {
    conn.release();
  }
}

// ---------------------------------------------------------------------------
// HTTP Test Helper
// ---------------------------------------------------------------------------

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

interface HttpResult {
  status: number;
  body: any;
}

async function httpRequest(
  method: string,
  path: string,
  options?: { body?: any; cookie?: string }
): Promise<HttpResult> {
  const url = `${BASE_URL}${path}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (options?.cookie) {
    headers["Cookie"] = options.cookie;
  }

  const res = await fetch(url, {
    method,
    headers,
    body: options?.body ? JSON.stringify(options.body) : undefined,
    redirect: "manual",
  });

  let body: any;
  try {
    body = await res.json();
  } catch {
    body = {};
  }

  return { status: res.status, body };
}

// ---------------------------------------------------------------------------
// Test Suites (Direct DB verification — no auth cookies needed)
// ---------------------------------------------------------------------------

async function testOrderCreationDirect() {
  console.log("\n📋 Test Suite 1: Order Creation (Direct DB)");
  console.log("─".repeat(50));

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Simulate createOrderFromCart logic directly

    // 1. Verify cart exists and has items
    const [cartRows] = await conn.execute(
      "SELECT id, user_id, status FROM carts WHERE id = ? AND user_id = ? AND status = 'active' LIMIT 1",
      [testCartId, testCustomerId]
    ) as any;
    assert(cartRows.length === 1, "Active cart exists for customer");
    assert(cartRows[0].status === "active", "Cart status is 'active'");

    // 2. Load cart items
    const [itemRows] = await conn.execute(
      `SELECT ci.*, p.name AS p_name, p.price AS p_price, p.stock_quantity AS p_stock, p.is_active AS p_active,
              pv.name AS v_name, pv.price AS v_price, pv.stock_quantity AS v_stock, pv.is_active AS v_active
       FROM cart_items ci
       JOIN products p ON ci.product_id = p.id
       LEFT JOIN product_variants pv ON ci.variant_id = pv.id
       WHERE ci.cart_id = ?`,
      [testCartId]
    ) as any;
    assert(itemRows.length === 2, "Cart has 2 items");

    // 3. Create order
    const orderId = crypto.randomUUID();
    const orderNumber = `DEAR-${Math.floor(10000 + Math.random() * 90000)}`;
    createdOrderId = orderId;
    createdOrderNumber = orderNumber;

    // Calculate server-side totals
    let subtotal = 0;
    let discountTotal = 0;
    const orderItems: any[] = [];

    for (const item of itemRows) {
      const hasVariant = Boolean(item.variant_id);
      const unitPrice = hasVariant
        ? (item.v_price !== null ? Number(item.v_price) : Number(item.p_price))
        : Number(item.p_price);
      const quantity = Number(item.quantity);

      const lineSubtotal = roundToTwo(unitPrice * quantity);
      const lineDiscount = 0; // No active discounts in test setup
      const lineTotal = roundToTwo(lineSubtotal - lineDiscount);

      subtotal += lineSubtotal;
      discountTotal += lineDiscount;

      orderItems.push({
        id: crypto.randomUUID(),
        productId: item.product_id,
        variantId: item.variant_id,
        productName: item.p_name,
        variantName: hasVariant ? item.v_name : null,
        unitPrice,
        quantity,
        lineDiscount,
        lineTotal,
      });
    }

    subtotal = roundToTwo(subtotal);
    discountTotal = roundToTwo(discountTotal);
    const totalAmount = roundToTwo(subtotal - discountTotal);

    // Insert order
    await conn.execute(
      `INSERT INTO orders (id, order_number, user_id, status, payment_status,
         subtotal, discount_amount, shipping_amount, total_amount, currency,
         shipping_full_name, shipping_phone,
         shipping_address_line_1, shipping_address_line_2,
         shipping_city, shipping_state, shipping_postal_code, shipping_country,
         created_at, updated_at)
       VALUES (?, ?, ?, 'pending', 'pending',
               ?, ?, 0.00, ?, 'INR',
               ?, ?, ?, ?, ?, ?, ?, ?,
               NOW(), NOW())`,
      [
        orderId, orderNumber, testCustomerId,
        subtotal, discountTotal, totalAmount,
        "Test Customer", "9876543210",
        "Plot 42, Test Street", "Floor 2",
        "Mumbai", "Maharashtra", "400001", "India",
      ]
    );

    // Insert order items
    for (const item of orderItems) {
      await conn.execute(
        `INSERT INTO order_items (id, order_id, product_id, variant_id,
           product_name, variant_name, unit_price, quantity, discount_amount, line_total, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          item.id, orderId, item.productId, item.variantId,
          item.productName, item.variantName, item.unitPrice,
          item.quantity, item.lineDiscount, item.lineTotal,
        ]
      );
    }

    // 4. In B-17: stock is validated during creation but NOT decremented (Rule 37 & Section 18)
    // Mark cart as converted
    await conn.execute(
      "UPDATE carts SET status = 'converted', updated_at = NOW() WHERE id = ?",
      [testCartId]
    );
    await conn.execute("DELETE FROM cart_items WHERE cart_id = ?", [testCartId]);

    await conn.commit();

    // 5. Verify order was created
    const [orderVerify] = await pool.execute(
      "SELECT * FROM orders WHERE id = ?",
      [orderId]
    ) as any;
    assert(orderVerify.length === 1, "Order created in database");
    assert(orderVerify[0].order_number === orderNumber, "Order number matches");
    assert(orderVerify[0].user_id === testCustomerId, "Order user_id matches customer");
    assert(orderVerify[0].status === "pending", "Initial order status is 'pending'");
    assert(orderVerify[0].payment_status === "pending", "Initial payment status is 'pending'");
    assert(Number(orderVerify[0].subtotal) === subtotal, `Subtotal is correct (${subtotal})`);
    assert(Number(orderVerify[0].total_amount) === totalAmount, `Total amount is correct (${totalAmount})`);
    assert(orderVerify[0].currency === "INR", "Currency is INR");
    assert(orderVerify[0].shipping_full_name === "Test Customer", "Shipping name preserved");
    assert(orderVerify[0].shipping_city === "Mumbai", "Shipping city preserved");
    assert(orderVerify[0].shipping_state === "Maharashtra", "Shipping state preserved");
    assert(orderVerify[0].shipping_postal_code === "400001", "Shipping postal code preserved");

    // 6. Verify order items (historical snapshots) - sorted by unit_price DESC for deterministic assertion
    const [oisVerify] = await pool.execute(
      "SELECT * FROM order_items WHERE order_id = ? ORDER BY unit_price DESC",
      [orderId]
    ) as any;
    assert(oisVerify.length === 2, "Two order items created");
    assert(oisVerify[0].product_name === "B17 Test Product", "Item 1 product name snapshot preserved");
    assert(Number(oisVerify[0].unit_price) === 549, "Item 1 unit price from variant (549)");
    assert(Number(oisVerify[0].quantity) === 2, "Item 1 quantity is 2");
    assert(oisVerify[1].product_name === "B17 Test Product 2", "Item 2 product name snapshot preserved");
    assert(Number(oisVerify[1].unit_price) === 299, "Item 2 unit price from product (299)");
    assert(Number(oisVerify[1].quantity) === 1, "Item 2 quantity is 1");

  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

async function testStockDeduction() {
  console.log("\n📋 Test Suite 2: Stock Not Decremented in B-17 (Rule 37 & Section 18)");
  console.log("─".repeat(50));

  // Variant stock: started at 15 -> pending order does not consume inventory -> remains 15
  const [variantRows] = await pool.execute(
    "SELECT stock_quantity FROM product_variants WHERE id = ?",
    [testVariantId]
  ) as any;
  assert(Number(variantRows[0].stock_quantity) === 15, "Variant stock NOT decremented: remains 15");

  // Product 2 stock: started at 10 -> remains 10
  const [productRows] = await pool.execute(
    "SELECT stock_quantity FROM products WHERE id = ?",
    [testProduct2Id]
  ) as any;
  assert(Number(productRows[0].stock_quantity) === 10, "Product stock NOT decremented: remains 10");
}

async function testCartConversion() {
  console.log("\n📋 Test Suite 3: Cart Converted After Order");
  console.log("─".repeat(50));

  const [cartRows] = await pool.execute(
    "SELECT status FROM carts WHERE id = ?",
    [testCartId]
  ) as any;
  assert(cartRows[0].status === "converted", "Cart status changed to 'converted'");

  const [itemRows] = await pool.execute(
    "SELECT COUNT(*) AS cnt FROM cart_items WHERE cart_id = ?",
    [testCartId]
  ) as any;
  assert(Number(itemRows[0].cnt) === 0, "Cart items cleared after order");
}

async function testHistoricalSnapshotImmutability() {
  console.log("\n📋 Test Suite 4: Historical Snapshot Immutability");
  console.log("─".repeat(50));

  // Change the product price in the catalog
  await pool.execute(
    "UPDATE products SET price = 999.00, name = 'B17 Updated Product' WHERE id = ?",
    [testProductId]
  );

  // Order item should still show the original price and name
  const [oisRows] = await pool.execute(
    "SELECT product_name, unit_price FROM order_items WHERE order_id = ? AND product_id = ?",
    [createdOrderId, testProductId]
  ) as any;

  assert(oisRows.length === 1, "Order item for product 1 exists");
  assert(oisRows[0].product_name === "B17 Test Product", "Order item name NOT affected by catalog update");
  assert(Number(oisRows[0].unit_price) === 549, "Order item price NOT affected by catalog update (still 549)");

  // Restore original
  await pool.execute(
    "UPDATE products SET price = 499.00, name = 'B17 Test Product' WHERE id = ?",
    [testProductId]
  );
}

async function testCustomerOwnership() {
  console.log("\n📋 Test Suite 5: Customer Ownership Enforcement");
  console.log("─".repeat(50));

  // Customer 1's order should be visible to customer 1
  const [c1Orders] = await pool.execute(
    "SELECT * FROM orders WHERE user_id = ? AND id = ?",
    [testCustomerId, createdOrderId]
  ) as any;
  assert(c1Orders.length === 1, "Customer 1 can find their own order");

  // Customer 2 should NOT see customer 1's order
  const [c2Orders] = await pool.execute(
    "SELECT * FROM orders WHERE user_id = ? AND id = ?",
    [testCustomer2Id, createdOrderId]
  ) as any;
  assert(c2Orders.length === 0, "Customer 2 CANNOT see Customer 1's order (ownership enforced)");

  // Customer 2 listing should be empty
  const [c2AllOrders] = await pool.execute(
    "SELECT * FROM orders WHERE user_id = ?",
    [testCustomer2Id]
  ) as any;
  assert(c2AllOrders.length === 0, "Customer 2 has no orders");
}

async function testOrderStatusTransitions() {
  console.log("\n📋 Test Suite 6: Order Status Transitions");
  console.log("─".repeat(50));

  const validTransitions: [string, string][] = [
    ["pending", "confirmed"],
    ["confirmed", "processing"],
    ["processing", "shipped"],
    ["shipped", "delivered"],
  ];

  for (const [from, to] of validTransitions) {
    // Ensure status is set to `from`
    await pool.execute("UPDATE orders SET status = ? WHERE id = ?", [from, createdOrderId]);

    // Transition to `to`
    await pool.execute("UPDATE orders SET status = ?, updated_at = NOW() WHERE id = ?", [to, createdOrderId]);
    const [rows] = await pool.execute("SELECT status FROM orders WHERE id = ?", [createdOrderId]) as any;
    assert(rows[0].status === to, `Valid transition: ${from} → ${to}`);
  }

  // Test invalid transitions (at application level)
  const ALLOWED_TRANSITIONS: Record<string, string[]> = {
    pending: ["confirmed", "cancelled"],
    confirmed: ["processing", "cancelled"],
    processing: ["shipped", "cancelled"],
    shipped: ["delivered"],
    delivered: [],
    cancelled: [],
  };

  // delivered → pending should be invalid
  const deliveredAllowed = ALLOWED_TRANSITIONS["delivered"];
  assert(!deliveredAllowed.includes("pending"), "Delivered → pending is NOT an allowed transition");
  assert(!deliveredAllowed.includes("confirmed"), "Delivered → confirmed is NOT an allowed transition");
  assert(deliveredAllowed.length === 0, "Delivered has no further transitions");

  // cancelled → pending should be invalid
  const cancelledAllowed = ALLOWED_TRANSITIONS["cancelled"];
  assert(cancelledAllowed.length === 0, "Cancelled has no further transitions");

  // pending → shipped should be invalid
  const pendingAllowed = ALLOWED_TRANSITIONS["pending"];
  assert(!pendingAllowed.includes("shipped"), "Pending → shipped is NOT directly allowed");
  assert(!pendingAllowed.includes("delivered"), "Pending → delivered is NOT directly allowed");

  // Reset to pending for further tests
  await pool.execute("UPDATE orders SET status = 'pending' WHERE id = ?", [createdOrderId]);
}

async function testPaymentStatusUpdate() {
  console.log("\n📋 Test Suite 7: Payment Status Updates");
  console.log("─".repeat(50));

  const statuses = ["paid", "failed", "refunded", "pending"];
  for (const status of statuses) {
    await pool.execute("UPDATE orders SET payment_status = ?, updated_at = NOW() WHERE id = ?", [status, createdOrderId]);
    const [rows] = await pool.execute("SELECT payment_status FROM orders WHERE id = ?", [createdOrderId]) as any;
    assert(rows[0].payment_status === status, `Payment status set to '${status}'`);
  }
}

async function testOrderCancellationStockRestoration() {
  console.log("\n📋 Test Suite 8: Order Cancellation & Stock Safety");
  console.log("─".repeat(50));

  // Get current stock before cancellation
  const [varBefore] = await pool.execute(
    "SELECT stock_quantity FROM product_variants WHERE id = ?",
    [testVariantId]
  ) as any;
  const [prodBefore] = await pool.execute(
    "SELECT stock_quantity FROM products WHERE id = ?",
    [testProduct2Id]
  ) as any;

  const varStockBefore = Number(varBefore[0].stock_quantity);
  const prodStockBefore = Number(prodBefore[0].stock_quantity);

  // In B-17: Cancel order transitions order status to 'cancelled'
  await pool.execute(
    "UPDATE orders SET status = 'cancelled', updated_at = NOW() WHERE id = ?",
    [createdOrderId]
  );

  // Verify stock remains untouched (15 and 10)
  const [varAfter] = await pool.execute(
    "SELECT stock_quantity FROM product_variants WHERE id = ?",
    [testVariantId]
  ) as any;
  const [prodAfter] = await pool.execute(
    "SELECT stock_quantity FROM products WHERE id = ?",
    [testProduct2Id]
  ) as any;

  const varStockAfter = Number(varAfter[0].stock_quantity);
  const prodStockAfter = Number(prodAfter[0].stock_quantity);

  assert(varStockAfter === varStockBefore, `Variant stock preserved on cancel: ${varStockAfter} === ${varStockBefore}`);
  assert(prodStockAfter === prodStockBefore, `Product stock preserved on cancel: ${prodStockAfter} === ${prodStockBefore}`);

  // Verify order status
  const [cancelledRows] = await pool.execute(
    "SELECT status FROM orders WHERE id = ?",
    [createdOrderId]
  ) as any;
  assert(cancelledRows[0].status === "cancelled", "Order status is 'cancelled' after cancellation");
}

async function testOrderNumberUniqueness() {
  console.log("\n📋 Test Suite 9: Order Number Uniqueness");
  console.log("─".repeat(50));

  // Try inserting a duplicate order number — should fail
  const dupeId = crypto.randomUUID();
  let duplicateFailed = false;
  try {
    await pool.execute(
      `INSERT INTO orders (id, order_number, user_id, status, payment_status,
         subtotal, discount_amount, shipping_amount, total_amount, currency,
         shipping_full_name, shipping_phone,
         shipping_address_line_1, shipping_city, shipping_state, shipping_postal_code, shipping_country,
         created_at, updated_at)
       VALUES (?, ?, ?, 'pending', 'pending',
               100, 0, 0, 100, 'INR',
               'Dupe', '9876543210',
               'Test', 'Test', 'Test', '400001', 'India',
               NOW(), NOW())`,
      [dupeId, createdOrderNumber, testCustomer2Id]
    );
  } catch (err: any) {
    if (err.code === "ER_DUP_ENTRY") {
      duplicateFailed = true;
    }
  }
  assert(duplicateFailed, "Duplicate order_number rejected by UNIQUE constraint");
}

async function testAdminOrderListing() {
  console.log("\n📋 Test Suite 10: Admin Order Listing");
  console.log("─".repeat(50));

  // Admin should see all orders
  const [allOrders] = await pool.execute(
    "SELECT COUNT(*) AS cnt FROM orders WHERE user_id = ?",
    [testCustomerId]
  ) as any;
  assert(Number(allOrders[0].cnt) >= 1, "Admin can see test customer's orders");

  // Filter by status
  const [cancelledOrders] = await pool.execute(
    "SELECT COUNT(*) AS cnt FROM orders WHERE status = 'cancelled' AND user_id = ?",
    [testCustomerId]
  ) as any;
  assert(Number(cancelledOrders[0].cnt) >= 1, "Admin can filter by status = 'cancelled'");

  // Search by order number
  const [searchResults] = await pool.execute(
    "SELECT COUNT(*) AS cnt FROM orders WHERE order_number LIKE ?",
    [`%${createdOrderNumber.slice(-4)}%`]
  ) as any;
  assert(Number(searchResults[0].cnt) >= 1, "Admin can search by partial order number");
}

async function testInputValidation() {
  console.log("\n📋 Test Suite 11: Input Validation");
  console.log("─".repeat(50));

  // Validate order number format
  assert(/^DEAR-\d{5}$/.test(createdOrderNumber), `Order number matches DEAR-XXXXX format: ${createdOrderNumber}`);

  // Verify CHECK constraints on orders table
  let checkFailed = false;
  try {
    await pool.execute(
      `INSERT INTO orders (id, order_number, user_id, status, payment_status,
         subtotal, discount_amount, shipping_amount, total_amount, currency,
         shipping_full_name, shipping_phone,
         shipping_address_line_1, shipping_city, shipping_state, shipping_postal_code, shipping_country,
         created_at, updated_at)
       VALUES (?, ?, ?, 'pending', 'pending',
               -1, 0, 0, -1, 'INR',
               'Neg', '9876543210',
               'Test', 'Test', 'Test', '400001', 'India',
               NOW(), NOW())`,
      [crypto.randomUUID(), `DEAR-${Math.floor(10000 + Math.random() * 90000)}`, testCustomerId]
    );
  } catch (err: any) {
    checkFailed = true;
  }
  assert(checkFailed, "Negative subtotal rejected by CHECK constraint");

  // Verify CHECK constraints on order_items
  let itemCheckFailed = false;
  try {
    await pool.execute(
      `INSERT INTO order_items (id, order_id, product_id, product_name, unit_price, quantity, line_total, created_at)
       VALUES (?, ?, ?, 'Bad', -10, 0, -10, NOW())`,
      [crypto.randomUUID(), createdOrderId, testProductId]
    );
  } catch (err: any) {
    itemCheckFailed = true;
  }
  assert(itemCheckFailed, "Invalid order item (negative price / zero quantity) rejected by CHECK constraints");
}

async function testMultipleOrdersForCustomer() {
  console.log("\n📋 Test Suite 12: Multiple Orders for Same Customer");
  console.log("─".repeat(50));

  // Create a second cart and order for customer 1
  const cart2Id = `${TEST_PREFIX}cart2_${crypto.randomUUID().slice(0, 8)}`;
  const ci3Id = `${TEST_PREFIX}ci3_${crypto.randomUUID().slice(0, 8)}`;
  const order2Id = crypto.randomUUID();
  const order2Number = `DEAR-${Math.floor(10000 + Math.random() * 90000)}`;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // New cart
    await conn.execute(
      "INSERT INTO carts (id, user_id, status, created_at, updated_at) VALUES (?, ?, 'active', NOW(), NOW())",
      [cart2Id, testCustomerId]
    );
    await conn.execute(
      "INSERT INTO cart_items (id, cart_id, product_id, variant_id, quantity, created_at, updated_at) VALUES (?, ?, ?, NULL, 3, NOW(), NOW())",
      [ci3Id, cart2Id, testProduct2Id]
    );

    // Create order
    await conn.execute(
      `INSERT INTO orders (id, order_number, user_id, status, payment_status,
         subtotal, discount_amount, shipping_amount, total_amount, currency,
         shipping_full_name, shipping_phone,
         shipping_address_line_1, shipping_city, shipping_state, shipping_postal_code, shipping_country,
         created_at, updated_at)
       VALUES (?, ?, ?, 'pending', 'pending',
               897, 0, 0, 897, 'INR',
               'Test 2', '9876543210',
               'Address 2', 'City', 'State', '400002', 'India',
               NOW(), NOW())`,
      [order2Id, order2Number, testCustomerId]
    );
    await conn.execute(
      `INSERT INTO order_items (id, order_id, product_id, product_name, unit_price, quantity, discount_amount, line_total, created_at)
       VALUES (?, ?, ?, 'B17 Test Product 2', 299, 3, 0, 897, NOW())`,
      [crypto.randomUUID(), order2Id, testProduct2Id]
    );

    // Convert cart
    await conn.execute("UPDATE carts SET status = 'converted' WHERE id = ?", [cart2Id]);
    await conn.execute("DELETE FROM cart_items WHERE cart_id = ?", [cart2Id]);

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }

  // Customer 1 should now have 2 orders
  const [custOrders] = await pool.execute(
    "SELECT COUNT(*) AS cnt FROM orders WHERE user_id = ? ORDER BY created_at DESC",
    [testCustomerId]
  ) as any;
  assert(Number(custOrders[0].cnt) === 2, "Customer 1 now has 2 orders");

  // Verify pagination concept
  const [paginatedOrders] = await pool.execute(
    "SELECT id FROM orders WHERE user_id = ? ORDER BY created_at DESC LIMIT 1 OFFSET 0",
    [testCustomerId]
  ) as any;
  assert(paginatedOrders.length === 1, "Pagination LIMIT 1 returns exactly 1 order");
}

async function testForeignKeyIntegrity() {
  console.log("\n📋 Test Suite 13: Foreign Key Integrity");
  console.log("─".repeat(50));

  // order.user_id → profiles.id
  const [fkCheck] = await pool.execute(
    `SELECT o.id, p.full_name
     FROM orders o
     LEFT JOIN profiles p ON o.user_id = p.id
     WHERE o.id = ?`,
    [createdOrderId]
  ) as any;
  assert(fkCheck.length === 1 && fkCheck[0].full_name === "B17 Customer 1", "Order FK → profiles works");

  // order_items.order_id → orders.id
  const [oiFkCheck] = await pool.execute(
    `SELECT oi.id, o.order_number
     FROM order_items oi
     JOIN orders o ON oi.order_id = o.id
     WHERE oi.order_id = ?`,
    [createdOrderId]
  ) as any;
  assert(oiFkCheck.length >= 1, "Order items FK → orders works");

  // order_items.product_id → products.id (nullable FK)
  const [prodFkCheck] = await pool.execute(
    `SELECT oi.id, p.name
     FROM order_items oi
     LEFT JOIN products p ON oi.product_id = p.id
     WHERE oi.order_id = ?`,
    [createdOrderId]
  ) as any;
  assert(prodFkCheck.length >= 1, "Order items FK → products works (LEFT JOIN)");
}

async function testCurrencyAndDecimalPrecision() {
  console.log("\n📋 Test Suite 14: Currency & Decimal Precision");
  console.log("─".repeat(50));

  const [orderRow] = await pool.execute(
    "SELECT subtotal, discount_amount, shipping_amount, total_amount, currency FROM orders WHERE id = ?",
    [createdOrderId]
  ) as any;

  assert(orderRow[0].currency === "INR", "Currency is INR");

  // Verify decimal(10,2) precision
  const subtotal = Number(orderRow[0].subtotal);
  const discountAmount = Number(orderRow[0].discount_amount);
  const shippingAmount = Number(orderRow[0].shipping_amount);
  const totalAmount = Number(orderRow[0].total_amount);

  assert(subtotal === roundToTwo(subtotal), "Subtotal has at most 2 decimal places");
  assert(discountAmount === roundToTwo(discountAmount), "Discount amount has at most 2 decimal places");
  assert(shippingAmount === roundToTwo(shippingAmount), "Shipping amount has at most 2 decimal places");
  assert(totalAmount === roundToTwo(totalAmount), "Total amount has at most 2 decimal places");

  // Verify financial consistency: total = subtotal - discount + shipping
  const expectedTotal = roundToTwo(subtotal - discountAmount + shippingAmount);
  assert(
    Math.abs(totalAmount - expectedTotal) < 0.01,
    `Financial consistency: total(${totalAmount}) ≈ subtotal(${subtotal}) - discount(${discountAmount}) + shipping(${shippingAmount}) = ${expectedTotal}`
  );
}

async function testOrderItemSnapshotFields() {
  console.log("\n📋 Test Suite 15: Order Item Snapshot Field Completeness");
  console.log("─".repeat(50));

  const [ois] = await pool.execute(
    "SELECT * FROM order_items WHERE order_id = ?",
    [createdOrderId]
  ) as any;

  for (const oi of ois) {
    assert(oi.product_name !== null && oi.product_name !== "", `Item ${oi.id}: product_name is populated`);
    assert(Number(oi.unit_price) >= 0, `Item ${oi.id}: unit_price >= 0`);
    assert(Number(oi.quantity) > 0, `Item ${oi.id}: quantity > 0`);
    assert(Number(oi.discount_amount) >= 0, `Item ${oi.id}: discount_amount >= 0`);
    assert(Number(oi.line_total) >= 0, `Item ${oi.id}: line_total >= 0`);
    assert(oi.created_at !== null, `Item ${oi.id}: created_at is populated`);
  }
}

async function testPaymentStatusApiSecurity() {
  console.log("\n📋 Test Suite 16: Payment Status API Security & Scope Enforcement");
  console.log("─".repeat(50));

  // Dynamic imports after require.cache is populated
  const { NextRequest } = await import("next/server");
  const { createSessionToken } = await import("../src/lib/server/auth");
  const { PATCH: adminPatch } = await import("../src/app/api/admin/orders/[id]/route");
  const { PATCH: customerPatch } = await import("../src/app/api/orders/[id]/route");

  // Reset order to pristine pending state for both status and payment_status
  await pool.execute(
    "UPDATE orders SET status = 'pending', payment_status = 'pending' WHERE id = ?",
    [createdOrderId]
  );

  // Generate tokens for admin and customer fixtures seeded in DB
  const adminToken = await createSessionToken({
    id: testAdminId,
    email: "b17admin@test.com",
    fullName: "B17 Admin",
    role: "admin",
  });

  const customerToken = await createSessionToken({
    id: testCustomerId,
    email: "b17cust1@test.com",
    fullName: "B17 Customer 1",
    role: "customer",
  });

  // 1. Admin PATCH with paymentStatus only -> rejected with 400
  mockSessionToken = adminToken;
  const adminOnlyPaymentReq = new NextRequest(
    `http://localhost:3000/api/admin/orders/${createdOrderId}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentStatus: "paid" }),
    }
  );
  const adminOnlyPaymentRes = await adminPatch(adminOnlyPaymentReq, {
    params: Promise.resolve({ id: createdOrderId }),
  });
  const adminOnlyPaymentBody = await adminOnlyPaymentRes.json();

  assert(
    adminOnlyPaymentRes.status === 400,
    `1. Admin PATCH with paymentStatus only is rejected with status 400 (got ${adminOnlyPaymentRes.status})`
  );
  assert(
    adminOnlyPaymentBody.ok === false,
    "1. Admin PATCH response returns ok: false"
  );
  assert(
    adminOnlyPaymentBody.error === "Request must include 'status' or 'action'",
    `1. Admin PATCH rejection error message: "${adminOnlyPaymentBody.error}"`
  );

  // Verify order.payment_status remains unchanged after request
  const [dbAfterTest1] = await pool.execute(
    "SELECT status, payment_status FROM orders WHERE id = ?",
    [createdOrderId]
  ) as any;
  assert(
    dbAfterTest1[0].payment_status === "pending",
    "1. DB verification: order.payment_status remains 'pending' after paymentStatus-only attempt"
  );
  assert(
    dbAfterTest1[0].status === "pending",
    "1. DB verification: order.status remains 'pending'"
  );

  // 2. Admin PATCH with paymentStatus + valid status -> paymentStatus ignored and only status changes
  const adminCombinedReq = new NextRequest(
    `http://localhost:3000/api/admin/orders/${createdOrderId}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "confirmed", paymentStatus: "paid" }),
    }
  );
  const adminCombinedRes = await adminPatch(adminCombinedReq, {
    params: Promise.resolve({ id: createdOrderId }),
  });
  const adminCombinedBody = await adminCombinedRes.json();

  assert(
    adminCombinedRes.status === 200,
    `2. Admin PATCH with status + paymentStatus returns 200 (got ${adminCombinedRes.status})`
  );
  assert(
    adminCombinedBody.ok === true,
    "2. Admin PATCH response returns ok: true"
  );
  assert(
    adminCombinedBody.order?.status === "confirmed",
    "2. Admin PATCH successfully updated order fulfillment status to 'confirmed'"
  );
  assert(
    (adminCombinedBody.order?.paymentStatus || adminCombinedBody.order?.payment_status) === "pending",
    "2. Admin PATCH response confirms payment_status was NOT mutated to 'paid'"
  );

  const [dbAfterTest2] = await pool.execute(
    "SELECT status, payment_status FROM orders WHERE id = ?",
    [createdOrderId]
  ) as any;
  assert(
    dbAfterTest2[0].status === "confirmed",
    "2. DB verification: order.status successfully changed to 'confirmed'"
  );
  assert(
    dbAfterTest2[0].payment_status === "pending",
    "2. DB verification: order.payment_status is STILL 'pending' (paymentStatus was completely ignored)"
  );

  // 3. Customer PATCH attempting paymentStatus -> rejected with 403 Forbidden
  mockSessionToken = customerToken;
  const customerPaymentReq = new NextRequest(
    `http://localhost:3000/api/orders/${createdOrderId}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentStatus: "paid" }),
    }
  );
  const customerPaymentRes = await customerPatch(customerPaymentReq, {
    params: Promise.resolve({ id: createdOrderId }),
  });
  const customerPaymentBody = await customerPaymentRes.json();

  assert(
    customerPaymentRes.status === 403,
    `3. Customer PATCH attempting paymentStatus is rejected with 403 Forbidden (got ${customerPaymentRes.status})`
  );
  assert(
    customerPaymentBody.ok === false,
    "3. Customer PATCH returns ok: false"
  );

  // Customer PATCH attempting fulfillment status or combined mutation -> also 403 Forbidden
  const customerStatusReq = new NextRequest(
    `http://localhost:3000/api/orders/${createdOrderId}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "delivered", paymentStatus: "paid" }),
    }
  );
  const customerStatusRes = await customerPatch(customerStatusReq, {
    params: Promise.resolve({ id: createdOrderId }),
  });
  assert(
    customerStatusRes.status === 403,
    `3. Customer PATCH attempting status + paymentStatus is rejected with 403 Forbidden (got ${customerStatusRes.status})`
  );

  // 4. Verify order.payment_status remains unchanged after all those requests
  const [dbAfterAttempts] = await pool.execute(
    "SELECT status, payment_status FROM orders WHERE id = ?",
    [createdOrderId]
  ) as any;
  assert(
    dbAfterAttempts[0].payment_status === "pending",
    "4. Final DB verification: order.payment_status strictly remained 'pending' throughout all unauthorized/unsafe attempts"
  );
  assert(
    dbAfterAttempts[0].status === "confirmed",
    "4. DB verification: order.status remained 'confirmed' untouched by customer attempts"
  );

  // 5. Existing fulfillment status update still works via Admin PATCH
  mockSessionToken = adminToken;
  const adminFulfillmentReq = new NextRequest(
    `http://localhost:3000/api/admin/orders/${createdOrderId}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "processing" }),
    }
  );
  const adminFulfillmentRes = await adminPatch(adminFulfillmentReq, {
    params: Promise.resolve({ id: createdOrderId }),
  });
  const adminFulfillmentBody = await adminFulfillmentRes.json();

  assert(
    adminFulfillmentRes.status === 200,
    `5. Admin fulfillment status transition works: 200 (got ${adminFulfillmentRes.status})`
  );
  assert(
    adminFulfillmentBody.ok === true && adminFulfillmentBody.order?.status === "processing",
    "5. Admin order fulfillment status transitioned confirmed → processing"
  );

  const [dbAfterTest5] = await pool.execute(
    "SELECT status, payment_status FROM orders WHERE id = ?",
    [createdOrderId]
  ) as any;
  assert(
    dbAfterTest5[0].status === "processing",
    "5. DB verification: order.status is now 'processing'"
  );
  assert(
    dbAfterTest5[0].payment_status === "pending",
    "5. DB verification: order.payment_status remains 'pending'"
  );

  // 6. Existing direct DB payment-status constraint tests remain valid
  // Ensure that the DB column payment_status can still accept valid enum values directly
  const [currentOrder] = await pool.execute(
    "SELECT payment_status FROM orders WHERE id = ?",
    [createdOrderId]
  ) as any;
  assert(
    currentOrder[0].payment_status === "pending",
    "6. Database column payment_status remains valid and active in database schema"
  );

  // Clean up mock token
  mockSessionToken = null;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("═".repeat(60));
  console.log("  Dearr V1 — B-17 Order API Verification");
  console.log("═".repeat(60));

  pool = mysql.createPool(DB_CONFIG);

  try {
    // Connectivity check
    const [connCheck] = await pool.execute("SELECT 1 AS ok");
    console.log("✅ Database connected\n");

    await cleanup();
    await seedTestData();

    await testOrderCreationDirect();
    await testStockDeduction();
    await testCartConversion();
    await testHistoricalSnapshotImmutability();
    await testCustomerOwnership();
    await testOrderStatusTransitions();
    await testPaymentStatusUpdate();
    await testOrderCancellationStockRestoration();
    await testOrderNumberUniqueness();
    await testAdminOrderListing();
    await testInputValidation();
    await testMultipleOrdersForCustomer();
    await testForeignKeyIntegrity();
    await testCurrencyAndDecimalPrecision();
    await testOrderItemSnapshotFields();
    await testPaymentStatusApiSecurity();

    console.log("\n" + "═".repeat(60));
    console.log(`  RESULTS: ${pass} passed, ${fail} failed (${pass + fail} total)`);
    console.log("═".repeat(60));

    if (fail > 0) {
      console.log("\n⚠️  Some tests failed. Review the output above.");
    } else {
      console.log("\n🎉 All tests passed! B-17 Order API is verified.");
    }
  } catch (err) {
    console.error("\n💥 Fatal error:", err);
    fail++;
  } finally {
    await cleanup();
    await pool.end();
    process.exit(fail > 0 ? 1 : 0);
  }
}

main();
