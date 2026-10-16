import fs from "fs";
import path from "path";
import crypto from "crypto";
import mysql from "mysql2/promise";
import bcrypt from "bcryptjs";
import { NextRequest } from "next/server";

// Mock server-only and next/headers for standalone Node execution
require.cache[require.resolve("server-only")] = {
  id: require.resolve("server-only"),
  filename: require.resolve("server-only"),
  loaded: true,
  exports: {},
} as any;

let currentMockSessionToken: string | null = null;

require.cache[require.resolve("next/headers")] = {
  id: require.resolve("next/headers"),
  filename: require.resolve("next/headers"),
  loaded: true,
  exports: {
    cookies: async () => ({
      get: (name: string) =>
        name === "dearr_session" && currentMockSessionToken
          ? { name, value: currentMockSessionToken }
          : undefined,
      set: () => {},
      delete: () => {},
    }),
  },
} as any;

// Load .env.local
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

async function runTests() {
  console.log("=================================================================");
  console.log("Dearr — Product-Level Cash on Delivery (COD) Policy Verification");
  console.log("Database: Hostinger MySQL (dearr_test)");
  console.log("=================================================================\n");

  const pool = mysql.createPool({
    host: process.env.DB_HOST || "127.0.0.1",
    port: parseInt(process.env.DB_PORT || "3306", 10),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    connectionLimit: 4,
    waitForConnections: true,
  });

  const { POST: createOrderHandler } = await import("../src/app/api/orders/route");
  const { POST: addCartItemHandler } = await import("../src/app/api/cart/items/route");
  const { DELETE: clearCartHandler, GET: getCartHandler } = await import("../src/app/api/cart/route");
  const { POST: createProductHandler } = await import("../src/app/api/admin/products/route");
  const { PATCH: patchProductHandler } = await import("../src/app/api/admin/products/[id]/route");
  const { findProductById } = await import("../src/lib/server/product");
  const { createSessionToken } = await import("../src/lib/server/auth");
  const { updateStoreSettings } = await import("../src/lib/server/settings");

  let passed = 0;
  let failed = 0;

  function assert(title: string, condition: boolean, details?: string) {
    if (condition) {
      passed++;
      console.log(`  ✓ PASS: ${title}${details ? ` (${details})` : ""}`);
    } else {
      failed++;
      console.error(`  ✗ FAIL: ${title}${details ? ` (${details})` : ""}`);
    }
  }

  const testRunId = Date.now().toString().slice(-6);

  // Setup test customer and admin users
  const customerId = crypto.randomUUID();
  const customerEmail = `customer.cod.${testRunId}@dearr.test`;

  const adminId = crypto.randomUUID();
  const adminEmail = `admin.cod.${testRunId}@dearr.test`;

  const hashedPw = await bcrypt.hash("Password123!Secure", 10);

  // Insert profiles into MySQL
  await pool.query(
    `INSERT INTO profiles (id, email, password_hash, full_name, phone, role, status, created_at, updated_at)
     VALUES (?, ?, ?, 'Test COD Customer', '9876543210', 'customer', 'active', NOW(), NOW())`,
    [customerId, customerEmail, hashedPw]
  );

  await pool.query(
    `INSERT INTO profiles (id, email, password_hash, full_name, phone, role, status, created_at, updated_at)
     VALUES (?, ?, ?, 'Test COD Admin', '9876543211', 'admin', 'active', NOW(), NOW())`,
    [adminId, adminEmail, hashedPw]
  );

  const customerSessionToken = await createSessionToken({
    id: customerId,
    email: customerEmail,
    fullName: "Test COD Customer",
    role: "customer",
  });

  const adminSessionToken = await createSessionToken({
    id: adminId,
    email: adminEmail,
    fullName: "Test COD Admin",
    role: "admin",
  });

  // Ensure store master switch has codEnabled = true
  await updateStoreSettings({ codEnabled: true });

  // Create two distinct test products:
  // 1. cod_enabled = 1 (Eligible)
  // 2. cod_enabled = 0 (Ineligible)
  const eligibleProductId = crypto.randomUUID();
  const ineligibleProductId = crypto.randomUUID();

  await pool.query(
    `INSERT INTO products (id, name, slug, description, price, compare_at_price, stock_quantity, is_active, has_colors, cod_enabled, created_at, updated_at)
     VALUES (?, 'Eligible 3D Widget', ?, 'Precision 3D printed widget', 599.00, 799.00, 50, 1, 0, 1, NOW(), NOW())`,
    [eligibleProductId, `widget-eligible-${testRunId}`]
  );

  await pool.query(
    `INSERT INTO products (id, name, slug, description, price, compare_at_price, stock_quantity, is_active, has_colors, cod_enabled, created_at, updated_at)
     VALUES (?, 'Custom Print Ineligible', ?, 'Non-COD custom fabrication', 899.00, 1099.00, 50, 1, 0, 0, NOW(), NOW())`,
    [ineligibleProductId, `custom-ineligible-${testRunId}`]
  );

  const baseAddress = {
    shippingFullName: "Test Recipient",
    shippingPhone: "9876543210",
    shippingAddressLine1: "123 Indiranagar 100ft Road",
    shippingCity: "Bengaluru",
    shippingState: "Karnataka",
    shippingPostalCode: "560038",
    shippingCountry: "India",
  };

  try {
    // -------------------------------------------------------------------------
    // Test 1: Enabled product allows COD when master switch is ON
    // -------------------------------------------------------------------------
    console.log("\n[Test 1] Eligible product in cart allows COD order placement");
    currentMockSessionToken = customerSessionToken;
    await clearCartHandler();

    // Add eligible product to cart
    await addCartItemHandler(
      new Request("http://localhost/api/cart/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: eligibleProductId, quantity: 1 }),
      })
    );

    // Verify cart payload exposes codEnabled: true and isCodEligible: true
    const cartRes = await getCartHandler();
    const cartData = await cartRes.json();
    assert(
      "Cart product exposes codEnabled = true",
      cartData.cart?.items?.[0]?.product?.codEnabled === true,
      `got ${cartData.cart?.items?.[0]?.product?.codEnabled}`
    );
    assert(
      "Cart aggregate isCodEligible = true",
      cartData.cart?.isCodEligible === true,
      `got ${cartData.cart?.isCodEligible}`
    );

    // Place COD order
    const orderRes1 = await createOrderHandler(
      new NextRequest("http://localhost/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...baseAddress,
          paymentMethod: "cod",
        }),
      })
    );
    const orderData1 = await orderRes1.json();
    assert(
      "Eligible product COD order succeeds with HTTP 201",
      orderRes1.status === 201 && orderData1.ok === true && Boolean(orderData1.order?.id),
      `status=${orderRes1.status}, error=${orderData1.error}`
    );

    // -------------------------------------------------------------------------
    // Test 2: Ineligible product rejects COD with HTTP 400
    // -------------------------------------------------------------------------
    console.log("\n[Test 2] Ineligible product in cart rejects COD with HTTP 400");
    await clearCartHandler();

    await addCartItemHandler(
      new Request("http://localhost/api/cart/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: ineligibleProductId, quantity: 1 }),
      })
    );

    const cartRes2 = await getCartHandler();
    const cartData2 = await cartRes2.json();
    assert(
      "Ineligible cart product exposes codEnabled = false",
      cartData2.cart?.items?.[0]?.product?.codEnabled === false
    );
    assert(
      "Ineligible cart aggregate isCodEligible = false",
      cartData2.cart?.isCodEligible === false
    );

    const orderRes2 = await createOrderHandler(
      new NextRequest("http://localhost/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...baseAddress,
          paymentMethod: "cod",
        }),
      })
    );
    const orderData2 = await orderRes2.json();
    assert(
      "Ineligible product COD order rejected with HTTP 400",
      orderRes2.status === 400 && orderData2.ok === false,
      `status=${orderRes2.status}, error=${orderData2.error}`
    );
    assert(
      "Error explains COD ineligibility and online payment requirement",
      orderData2.error?.toLowerCase().includes("not eligible for cash on delivery") ||
        orderData2.error?.toLowerCase().includes("online payment is required"),
      `error="${orderData2.error}"`
    );

    // -------------------------------------------------------------------------
    // Test 3: Mixed-eligibility cart rejects COD, does NOT silently split orders
    // -------------------------------------------------------------------------
    console.log("\n[Test 3] Mixed-eligibility cart rejects COD and leaves cart intact");
    await clearCartHandler();

    // Add both eligible and ineligible
    await addCartItemHandler(
      new Request("http://localhost/api/cart/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: eligibleProductId, quantity: 1 }),
      })
    );
    await addCartItemHandler(
      new Request("http://localhost/api/cart/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: ineligibleProductId, quantity: 1 }),
      })
    );

    const mixedCartRes = await getCartHandler();
    const mixedCartData = await mixedCartRes.json();
    assert(
      "Mixed cart has 2 distinct items",
      mixedCartData.cart?.items?.length === 2
    );
    assert(
      "Mixed cart aggregate isCodEligible = false",
      mixedCartData.cart?.isCodEligible === false
    );

    const mixedOrderRes = await createOrderHandler(
      new NextRequest("http://localhost/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...baseAddress,
          paymentMethod: "cod",
        }),
      })
    );
    const mixedOrderData = await mixedOrderRes.json();
    assert(
      "Mixed cart COD order rejected with HTTP 400",
      mixedOrderRes.status === 400 && mixedOrderData.ok === false,
      `status=${mixedOrderRes.status}, error=${mixedOrderData.error}`
    );

    // Verify cart was NOT converted or split
    const postMixedCartRes = await getCartHandler();
    const postMixedCartData = await postMixedCartRes.json();
    assert(
      "Mixed cart items preserved intact without silent order splitting",
      postMixedCartData.cart?.items?.length === 2 && postMixedCartData.cart?.status === "active",
      `remainingItems=${postMixedCartData.cart?.items?.length}`
    );

    // -------------------------------------------------------------------------
    // Test 4: Buy Now flow (Eligible vs Ineligible)
    // -------------------------------------------------------------------------
    console.log("\n[Test 4] Buy Now COD validation");
    // Buy Now with eligible product
    const buyNowRes1 = await createOrderHandler(
      new NextRequest("http://localhost/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...baseAddress,
          paymentMethod: "cod",
          isBuyNow: true,
          items: [{ productId: eligibleProductId, quantity: 1 }],
        }),
      })
    );
    const buyNowData1 = await buyNowRes1.json();
    assert(
      "Buy Now with eligible product succeeds with HTTP 201",
      buyNowRes1.status === 201 && buyNowData1.ok === true && Boolean(buyNowData1.order?.id),
      `status=${buyNowRes1.status}, error=${buyNowData1.error}`
    );

    // Buy Now with ineligible product
    const buyNowRes2 = await createOrderHandler(
      new NextRequest("http://localhost/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...baseAddress,
          paymentMethod: "cod",
          isBuyNow: true,
          items: [{ productId: ineligibleProductId, quantity: 1 }],
        }),
      })
    );
    const buyNowData2 = await buyNowRes2.json();
    assert(
      "Buy Now with ineligible product rejects with HTTP 400",
      buyNowRes2.status === 400 && buyNowData2.ok === false,
      `status=${buyNowRes2.status}, error=${buyNowData2.error}`
    );

    // Verify customer's cart still has the 2 items from before (Buy Now doesn't clear cart)
    const cartAfterBuyNow = await getCartHandler();
    const cartAfterBuyNowData = await cartAfterBuyNow.json();
    assert(
      "Buy Now flow did not touch or clear the customer's active cart",
      cartAfterBuyNowData.cart?.items?.length === 2
    );

    // -------------------------------------------------------------------------
    // Test 5: Forged browser values are ignored
    // -------------------------------------------------------------------------
    console.log("\n[Test 5] Forged browser COD values are rejected based on database truth");
    const forgedOrderRes = await createOrderHandler(
      new NextRequest("http://localhost/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...baseAddress,
          paymentMethod: "cod",
          isCodEligible: true, // Forged
          codEnabled: true, // Forged
          isBuyNow: true,
          items: [{ productId: ineligibleProductId, quantity: 1, codEnabled: true, isCodEligible: true }],
        }),
      })
    );
    const forgedOrderData = await forgedOrderRes.json();
    assert(
      "Forged browser values cannot bypass database COD check",
      forgedOrderRes.status === 400 && forgedOrderData.ok === false,
      `status=${forgedOrderRes.status}, error=${forgedOrderData.error}`
    );

    // -------------------------------------------------------------------------
    // Test 6: Global master switch OFF overrides product eligibility
    // -------------------------------------------------------------------------
    console.log("\n[Test 6] Master switch disabled rejects COD even for eligible products");
    await updateStoreSettings({ codEnabled: false });

    const masterOffRes = await createOrderHandler(
      new NextRequest("http://localhost/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...baseAddress,
          paymentMethod: "cod",
          isBuyNow: true,
          items: [{ productId: eligibleProductId, quantity: 1 }],
        }),
      })
    );
    const masterOffData = await masterOffRes.json();
    assert(
      "Master switch OFF rejects COD with HTTP 400",
      masterOffRes.status === 400 && masterOffData.ok === false,
      `status=${masterOffRes.status}, error=${masterOffData.error}`
    );

    // Restore master switch
    await updateStoreSettings({ codEnabled: true });

    // -------------------------------------------------------------------------
    // Test 7: Unauthorized admin access
    // -------------------------------------------------------------------------
    console.log("\n[Test 7] Non-admin cannot modify product COD eligibility");
    currentMockSessionToken = customerSessionToken; // customer role

    const unauthPatchRes = await patchProductHandler(
      new Request(`http://localhost/api/admin/products/${eligibleProductId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codEnabled: false }),
      }),
      { params: Promise.resolve({ id: eligibleProductId }) } as any
    );
    assert(
      "Non-admin PATCH /api/admin/products/:id is denied (401/403)",
      unauthPatchRes.status === 401 || unauthPatchRes.status === 403,
      `status=${unauthPatchRes.status}`
    );

    // Verify DB was NOT updated
    const [pCheck]: any = await pool.query(
      "SELECT cod_enabled FROM products WHERE id = ?",
      [eligibleProductId]
    );
    assert(
      "Product in DB was untouched by unauthorized request",
      pCheck[0]?.cod_enabled === 1
    );

    // -------------------------------------------------------------------------
    // Test 8: Admin persistence after reload (Create -> Read -> Patch -> Read)
    // -------------------------------------------------------------------------
    console.log("\n[Test 8] Admin persistence across create, read, patch, and reload");
    currentMockSessionToken = adminSessionToken; // admin role

    const newAdminProductSlug = `admin-toggle-prod-${testRunId}`;
    const createProdRes = await createProductHandler(
      new Request("http://localhost/api/admin/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Admin COD Toggle Product",
          slug: newAdminProductSlug,
          description: "Admin COD toggle product description for testing",
          price: 499,
          compareAtPrice: 699,
          stockQuantity: 25,
          isActive: true,
          hasColors: false,
          codEnabled: false, // Created with COD disabled
        }),
      })
    );
    const createProdData = await createProdRes.json();
    assert(
      "Admin product creation succeeds with HTTP 201",
      createProdRes.status === 201 && createProdData.ok === true,
      `status=${createProdRes.status}, error=${createProdData.error}`
    );

    const createdProdId = createProdData.product?.id;

    // Read through trusted product layer
    const readProd1 = await findProductById(createdProdId, true);
    assert(
      "Product initially persisted with codEnabled = false",
      readProd1?.codEnabled === false,
      `codEnabled=${readProd1?.codEnabled}`
    );

    // Admin updates product to codEnabled: true
    const patchProdRes = await patchProductHandler(
      new Request(`http://localhost/api/admin/products/${createdProdId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codEnabled: true }),
      }),
      { params: Promise.resolve({ id: createdProdId }) } as any
    );
    const patchProdData = await patchProdRes.json();
    assert(
      "Admin product update succeeds with HTTP 200",
      patchProdRes.status === 200 && patchProdData.ok === true,
      `status=${patchProdRes.status}`
    );

    // Read again through trusted product layer
    const readProd2 = await findProductById(createdProdId, true);
    assert(
      "Product updated and persisted with codEnabled = true after reload",
      readProd2?.codEnabled === true,
      `codEnabled=${readProd2?.codEnabled}`
    );

    // -------------------------------------------------------------------------
    // Cleanup
    // -------------------------------------------------------------------------
    console.log("\n[Cleanup] Cleaning test artifacts...");
    await pool.query("DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE user_id = ?)", [customerId]);
    await pool.query("DELETE FROM orders WHERE user_id = ?", [customerId]);
    await pool.query("DELETE FROM cart_items WHERE cart_id IN (SELECT id FROM carts WHERE user_id = ?)", [customerId]);
    await pool.query("DELETE FROM profiles WHERE id IN (?, ?)", [customerId, adminId]);
    await pool.query("DELETE FROM products WHERE id IN (?, ?, ?)", [eligibleProductId, ineligibleProductId, createdProdId]);

    console.log("\n=================================================================");
    console.log(`Results: ${passed} passed, ${failed} failed`);
    console.log("=================================================================\n");

    if (failed > 0) {
      process.exit(1);
    }
  } finally {
    await pool.end();
    process.exit(failed > 0 ? 1 : 0);
  }
}

runTests().catch((err) => {
  console.error("Test execution failed with error:", err);
  process.exit(1);
});
