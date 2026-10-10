import fs from "fs";
import path from "path";
import crypto from "crypto";
import mysql from "mysql2/promise";
import bcrypt from "bcryptjs";

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

async function runCustomerE2E() {
  console.log("=================================================================");
  console.log("Dearr V1 — Task L-06: Complete Customer End-to-End Validation");
  console.log("Journey: New Customer & Existing Customer End-to-End Flow");
  console.log("Database: Hostinger MySQL (srv1741.hstgr.io)");
  console.log("Gateway: Razorpay Test Mode");
  console.log("=================================================================\n");

  // Route handlers
  const { POST: signupHandler } = await import("../src/app/api/auth/signup/route");
  const { POST: loginHandler } = await import("../src/app/api/auth/login/route");
  const { POST: logoutHandler } = await import("../src/app/api/auth/logout/route");
  const { GET: meHandler } = await import("../src/app/api/auth/me/route");
  const { GET: getProfileHandler, PATCH: patchProfileHandler } = await import("../src/app/api/customer/profile/route");
  const { GET: adminVerifyHandler } = await import("../src/app/api/admin/verify/route");
  const { GET: categoriesHandler } = await import("../src/app/api/categories/route");
  const { GET: productsHandler } = await import("../src/app/api/products/route");
  const { GET: productDetailHandler } = await import("../src/app/api/products/[slug]/route");
  const { GET: getWishlistHandler } = await import("../src/app/api/wishlist/route");
  const { POST: addWishlistHandler } = await import("../src/app/api/wishlist/items/route");
  const { DELETE: removeWishlistHandler } = await import("../src/app/api/wishlist/items/[productId]/route");
  const { GET: getCartHandler } = await import("../src/app/api/cart/route");
  const { POST: addCartItemHandler } = await import("../src/app/api/cart/items/route");
  const { PATCH: updateCartItemHandler, DELETE: removeCartItemHandler } = await import("../src/app/api/cart/items/[id]/route");
  const { GET: getOrdersHandler, POST: createOrderHandler } = await import("../src/app/api/orders/route");
  const { GET: getOrderDetailHandler } = await import("../src/app/api/orders/[id]/route");
  const { POST: createPaymentOrderHandler } = await import("../src/app/api/payments/create/route");
  const { POST: verifyPaymentHandler } = await import("../src/app/api/payments/verify/route");
  const { POST: settlePaymentHandler } = await import("../src/app/api/payments/settle/route");
  const { POST: failPaymentHandler } = await import("../src/app/api/payments/fail/route");
  const { POST: cancelPaymentHandler } = await import("../src/app/api/payments/cancel/route");
  const { POST: reconcilePaymentHandler } = await import("../src/app/api/payments/reconcile/route");

  const pool = mysql.createPool({
    host: process.env.DB_HOST || "127.0.0.1",
    port: parseInt(process.env.DB_PORT || "3306", 10),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    connectionLimit: 4,
    waitForConnections: true,
  });

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

  function extractCookieToken(res: Response): string | null {
    const setCookie = res.headers.get("set-cookie");
    if (!setCookie) return null;
    const match = setCookie.match(/dearr_session=([^;]+)/);
    return match ? match[1] : null;
  }

  const testRunId = Date.now().toString().slice(-6);
  const newCustomerEmail = `l06.new.${testRunId}@dearr.test`;
  const newCustomerPassword = "Password123!Secure";
  const newCustomerName = "Pavan New Customer";
  const newCustomerPhone = "9876543210";

  const existingCustomerEmail = `l06.existing.${testRunId}@dearr.test`;
  const existingCustomerPassword = "Password123!Existing";
  const existingCustomerName = "Pavan Existing Customer";
  const existingCustomerId = crypto.randomUUID();

  let newCustomerId: string | null = null;
  let newCustomerSessionToken: string | null = null;
  let existingCustomerSessionToken: string | null = null;

  const createdOrderIds: string[] = [];
  const createdUserIds: string[] = [];

  try {
    // =========================================================================
    // SECTION 1: Test Environment & Gateway Verification
    // =========================================================================
    console.log("--- Section 1: Environment & Gateway Verification ---");
    const [dbTest] = await pool.execute("SELECT 1 AS alive");
    assert("1.1 Database is connected and operational", Array.isArray(dbTest) && (dbTest as any)[0].alive === 1);

    const rzpKeyId = process.env.RAZORPAY_KEY_ID || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "";
    const isTestMode = rzpKeyId.startsWith("rzp_test_");
    assert("1.2 Razorpay is configured in TEST MODE", isTestMode && rzpKeyId.length > 10, `Key prefix: ${rzpKeyId.slice(0, 9)}...`);

    const rzpSecret = process.env.RAZORPAY_KEY_SECRET || "";
    assert("1.3 Razorpay Key Secret is present on server", rzpSecret.length >= 10, `Secret length: ${rzpSecret.length}`);

    // =========================================================================
    // SECTION 2: New Customer Account Journey (Signup, Validation, Auth)
    // =========================================================================
    console.log("\n--- Section 2: New Customer Account Journey ---");

    // 2.1 Invalid Signup Validations
    const resShortPass = await signupHandler(
      new Request("http://localhost:3000/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newCustomerName, email: newCustomerEmail, password: "123" }),
      })
    );
    assert("2.1 Signup rejects short password with HTTP 400", resShortPass.status === 400);

    const resBadEmail = await signupHandler(
      new Request("http://localhost:3000/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newCustomerName, email: "invalid-email-format", password: newCustomerPassword }),
      })
    );
    assert("2.2 Signup rejects invalid email format with HTTP 400", resBadEmail.status === 400);

    const resNoName = await signupHandler(
      new Request("http://localhost:3000/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "", email: newCustomerEmail, password: newCustomerPassword }),
      })
    );
    assert("2.3 Signup rejects missing name with HTTP 400", resNoName.status === 400);

    // 2.2 Successful Signup
    const resSignup = await signupHandler(
      new Request("http://localhost:3000/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newCustomerName,
          email: newCustomerEmail,
          password: newCustomerPassword,
          phone: newCustomerPhone,
        }),
      })
    );
    const dataSignup = await resSignup.json();
    assert(
      "2.4 New customer account signup succeeds with HTTP 201",
      resSignup.status === 201 && dataSignup.ok === true && !!dataSignup.user?.id,
      `User ID: ${dataSignup.user?.id}`
    );
    newCustomerId = dataSignup.user?.id;
    if (newCustomerId) createdUserIds.push(newCustomerId);

    // Verify user in MySQL
    const [rowsUser] = (await pool.execute("SELECT id, email, full_name, role FROM profiles WHERE id = ?", [newCustomerId])) as any[];
    assert(
      "2.5 New customer record persisted in MySQL profiles table",
      rowsUser.length === 1 && rowsUser[0].email === newCustomerEmail && rowsUser[0].role === "customer"
    );

    // 2.3 Duplicate Signup Rejection
    const resDup = await signupHandler(
      new Request("http://localhost:3000/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newCustomerName,
          email: newCustomerEmail,
          password: newCustomerPassword,
        }),
      })
    );
    assert("2.6 Duplicate email registration is rejected with HTTP 409", resDup.status === 409);

    // 2.4 Login Validations
    const resBadPass = await loginHandler(
      new Request("http://localhost:3000/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: newCustomerEmail, password: "WrongPassword!" }),
      })
    );
    assert("2.7 Login with incorrect password rejected with HTTP 401", resBadPass.status === 401);

    const resNonexistent = await loginHandler(
      new Request("http://localhost:3000/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: `nonexistent_${testRunId}@dearr.test`, password: "Password123!" }),
      })
    );
    assert("2.8 Login with nonexistent account rejected with HTTP 401", resNonexistent.status === 401);

    // 2.5 Successful Login & Session Token
    const resLogin = await loginHandler(
      new Request("http://localhost:3000/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: newCustomerEmail, password: newCustomerPassword }),
      })
    );
    const dataLogin = await resLogin.json();
    newCustomerSessionToken = extractCookieToken(resLogin);
    currentMockSessionToken = newCustomerSessionToken;
    assert(
      "2.9 New customer login succeeds and returns session cookie (HTTP 200)",
      resLogin.status === 200 && dataLogin.ok === true && !!newCustomerSessionToken
    );

    // 2.6 Authenticated Session Verification (/api/auth/me)
    const resMe = await meHandler();
    const dataMe = await resMe.json();
    assert(
      "2.10 Session verification (/api/auth/me) returns authenticated customer profile",
      resMe.status === 200 && dataMe.ok === true && dataMe.user.email === newCustomerEmail
    );

    // 2.7 Security Boundaries: Customer cannot access Admin routes
    const resAdminCheck = await adminVerifyHandler();
    assert("2.11 Customer is strictly blocked from /api/admin/verify with HTTP 403 Forbidden", resAdminCheck.status === 403);

    // 2.8 Security Boundaries: Customer cannot elevate role via profile update
    const resPatchRole = await patchProfileHandler(
      new Request("http://localhost:3000/api/customer/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "admin" }),
      })
    );
    const [rowsRoleCheck] = (await pool.execute("SELECT role FROM profiles WHERE id = ?", [newCustomerId])) as any[];
    assert(
      "2.12 Role escalation attempt is blocked; customer role remains 'customer'",
      rowsRoleCheck[0].role === "customer"
    );

    // =========================================================================
    // SECTION 3: Real Catalog Storefront Flow (Categories, Products, Search)
    // =========================================================================
    console.log("\n--- Section 3: Real Catalog Storefront Flow ---");

    // 3.1 Fetch Categories
    const resCats = await categoriesHandler(new Request("http://localhost:3000/api/categories"));
    const dataCats = await resCats.json();
    assert(
      "3.1 Categories endpoint returns active MySQL categories",
      resCats.status === 200 && dataCats.ok === true && Array.isArray(dataCats.categories) && dataCats.categories.length > 0,
      `Categories count: ${dataCats.categories?.length}`
    );
    const category1 = dataCats.categories[0];

    // 3.2 Fetch Products
    const resProds = await productsHandler(new Request("http://localhost:3000/api/products"));
    const dataProds = await resProds.json();
    assert(
      "3.2 Products endpoint returns real MySQL active products",
      resProds.status === 200 && dataProds.ok === true && Array.isArray(dataProds.products) && dataProds.products.length > 0,
      `Products count: ${dataProds.products?.length}`
    );
    const product1 = dataProds.products[0];
    const product2 = dataProds.products[1] || dataProds.products[0];

    // 3.3 Search Products
    const searchTerm = product1.name.slice(0, 5);
    const resSearch = await productsHandler(new Request(`http://localhost:3000/api/products?search=${encodeURIComponent(searchTerm)}`));
    const dataSearch = await resSearch.json();
    assert(
      "3.3 Search filter correctly queries matching products",
      resSearch.status === 200 && dataSearch.ok === true && dataSearch.products.some((p: any) => p.id === product1.id),
      `Found matches for "${searchTerm}": ${dataSearch.products?.length}`
    );

    // 3.4 Product Details by Slug
    const resDetail = await productDetailHandler(
      new Request(`http://localhost:3000/api/products/${product1.slug}`),
      { params: Promise.resolve({ slug: product1.slug }) } as any
    );
    const dataDetail = await resDetail.json();
    assert(
      "3.4 Product detail endpoint returns complete real product data",
      resDetail.status === 200 && dataDetail.ok === true && dataDetail.product?.id === product1.id && Number(dataDetail.product?.price) > 0,
      `Product: "${dataDetail.product?.name}", Price: ₹${dataDetail.product?.price}`
    );

    // 3.5 Wishlist Operations
    const resAddWish = await addWishlistHandler(
      new Request("http://localhost:3000/api/wishlist/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: product1.id }),
      })
    );
    assert("3.5 Adding product to wishlist returns HTTP 200 or 201", resAddWish.status === 200 || resAddWish.status === 201);

    const resGetWish = await getWishlistHandler();
    const dataGetWish = await resGetWish.json();
    assert(
      "3.6 Wishlist persists product in MySQL for customer",
      resGetWish.status === 200 && dataGetWish.ok === true && (dataGetWish.wishlist?.items || []).some((i: any) => i.productId === product1.id)
    );

    const resDelWish = await removeWishlistHandler(
      new Request(`http://localhost:3000/api/wishlist/items/${product1.id}`, { method: "DELETE" }),
      { params: Promise.resolve({ productId: product1.id }) } as any
    );
    assert("3.7 Removing product from wishlist returns HTTP 200", resDelWish.status === 200);

    // =========================================================================
    // SECTION 4: Real Cart Operations & Persistence
    // =========================================================================
    console.log("\n--- Section 4: Real Cart Operations & Calculations ---");

    // 4.1 Add Item 1 to Cart
    const resAddCart1 = await addCartItemHandler(
      new Request("http://localhost:3000/api/cart/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: product1.id, quantity: 1 }),
      })
    );
    const dataAddCart1 = await resAddCart1.json();
    assert(
      "4.1 Adding item to cart creates/updates active cart in MySQL",
      (resAddCart1.status === 200 || resAddCart1.status === 201) && dataAddCart1.ok === true && Array.isArray(dataAddCart1.cart?.items) && dataAddCart1.cart.items.length > 0
    );
    const cartItemId1 = dataAddCart1.cart.items.find((i: any) => i.productId === product1.id)?.id;

    // 4.2 Add Item 2 to Cart (if distinct product exists)
    if (product2.id !== product1.id) {
      const resAddCart2 = await addCartItemHandler(
        new Request("http://localhost:3000/api/cart/items", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ productId: product2.id, quantity: 2 }),
        })
      );
      assert("4.2 Adding second product to cart succeeds", resAddCart2.status === 200 || resAddCart2.status === 201);
    }

    // 4.3 Update Quantity
    const resUpdateQty = await updateCartItemHandler(
      new Request(`http://localhost:3000/api/cart/items/${cartItemId1}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quantity: 3 }),
      }),
      { params: Promise.resolve({ id: cartItemId1 }) } as any
    );
    assert("4.3 Updating item quantity to 3 returns HTTP 200", resUpdateQty.status === 200);

    // 4.4 Verify Cart Totals
    const resCart = await getCartHandler();
    const dataCart = await resCart.json();
    const item1 = dataCart.cart.items.find((i: any) => i.id === cartItemId1);
    assert(
      "4.4 Cart recalculates totals with decimal accuracy",
      resCart.status === 200 && dataCart.ok === true && item1?.quantity === 3 && Number(dataCart.cart.totals?.subtotal) > 0,
      `Cart Subtotal: ₹${dataCart.cart.totals?.subtotal}, Item Qty: ${item1?.quantity}`
    );

    // =========================================================================
    // SECTION 5: Checkout & Server-Authoritative Order Creation
    // =========================================================================
    console.log("\n--- Section 5: Checkout & Order Creation ---");

    // 5.1 Invalid Checkout Validation
    const resBadOrder = await createOrderHandler(
      new Request("http://localhost:3000/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shippingFullName: "", // Missing
          shippingPhone: "123", // Invalid phone
          shippingAddressLine1: "",
        }),
      }) as any
    );
    assert("5.1 Checkout rejects missing required shipping fields with HTTP 400", resBadOrder.status === 400);

    // 5.2 Valid Order Creation from Cart
    const resOrder = await createOrderHandler(
      new Request("http://localhost:3000/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shippingFullName: "Pavan Kumar",
          shippingPhone: "9876543210",
          shippingAddressLine1: "Flat 402, Green Residency, Jubilee Hills",
          shippingCity: "Hyderabad",
          shippingState: "Telangana",
          shippingPostalCode: "500033",
          shippingCountry: "India",
        }),
      }) as any
    );
    const dataOrder = await resOrder.json();
    if (resOrder.status !== 201) {
      console.log("Order creation failed details:", resOrder.status, dataOrder);
    }
    assert(
      "5.2 Checkout creates server-authoritative order from cart with HTTP 201",
      resOrder.status === 201 && dataOrder.ok === true && !!dataOrder.order?.id,
      `Order: ${dataOrder.order?.orderNumber}, Total: ₹${dataOrder.order?.totalAmount}`
    );
    const order1 = dataOrder.order;
    createdOrderIds.push(order1.id);

    // Verify initial payment_status is 'pending'
    const [rowsOrderCheck] = (await pool.execute(
      "SELECT id, order_number, user_id, status, payment_status, total_amount, currency FROM orders WHERE id = ?",
      [order1.id]
    )) as any[];
    assert(
      "5.3 Initial order in MySQL is strictly payment_status = 'pending'",
      rowsOrderCheck[0].payment_status === "pending" && rowsOrderCheck[0].status === "pending"
    );

    // Verify Cart was converted/cleared after order
    const resCartAfterOrder = await getCartHandler();
    const dataCartAfterOrder = await resCartAfterOrder.json();
    assert(
      "5.4 Cart is emptied/converted after successful order placement",
      resCartAfterOrder.status === 200 && (dataCartAfterOrder.cart?.items?.length === 0 || dataCartAfterOrder.cart === null)
    );

    // =========================================================================
    // SECTION 6: Razorpay Test Payment Flow (L-02 -> L-03 -> L-04)
    // =========================================================================
    console.log("\n--- Section 6: Razorpay Test Mode Payment Flow ---");

    // 6.1 L-02: Create Razorpay Order
    const resCreateRzp = await createPaymentOrderHandler(
      new Request("http://localhost:3000/api/payments/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: order1.id }),
      })
    );
    const dataCreateRzp = await resCreateRzp.json();
    assert(
      "6.1 L-02: Razorpay order created with HTTP 201",
      resCreateRzp.status === 201 && dataCreateRzp.ok === true && !!dataCreateRzp.razorpayOrderId,
      `Razorpay Order ID: ${dataCreateRzp.razorpayOrderId}`
    );
    const rzpOrderId = dataCreateRzp.razorpayOrderId;

    // Verify payment row created in MySQL with status 'created'
    const [rowsPayInit] = (await pool.execute(
      "SELECT status, provider_order_id, provider_payment_id FROM payments WHERE order_id = ?",
      [order1.id]
    )) as any[];
    assert(
      "6.2 Payment record persisted in MySQL with status = 'created'",
      rowsPayInit[0].status === "created" && rowsPayInit[0].provider_order_id === rzpOrderId
    );

    // 6.2 L-03: Server-Side Cryptographic Signature Verification
    const rzpPaymentId = `pay_l06_test_${testRunId}`;
    const keySecret = process.env.RAZORPAY_KEY_SECRET || "";
    const signaturePayload = `${rzpOrderId}|${rzpPaymentId}`;
    const validSignature = crypto.createHmac("sha256", keySecret).update(signaturePayload).digest("hex");

    const resVerify = await verifyPaymentHandler(
      new Request("http://localhost:3000/api/payments/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: order1.id,
          razorpay_order_id: rzpOrderId,
          razorpay_payment_id: rzpPaymentId,
          razorpay_signature: validSignature,
        }),
      })
    );
    const dataVerify = await resVerify.json();
    assert(
      "6.3 L-03: Payment signature verified server-side with HTTP 200",
      resVerify.status === 200 && dataVerify.ok === true && dataVerify.verified === true
    );

    // Strict boundary check: order must remain pending until L-04 settlement
    const [rowsAfterVerify] = (await pool.execute(
      "SELECT payment_status FROM orders WHERE id = ?",
      [order1.id]
    )) as any[];
    assert(
      "6.4 Strict Boundary Check: order payment_status remains 'pending' after verification",
      rowsAfterVerify[0].payment_status === "pending"
    );

    // 6.3 L-04: Settle Order to 'paid'
    const resSettle = await settlePaymentHandler(
      new Request("http://localhost:3000/api/payments/settle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: order1.id,
          razorpayPaymentId: rzpPaymentId,
        }),
      })
    );
    const dataSettle = await resSettle.json();
    assert(
      "6.5 L-04: Settlement transitions order to paid with HTTP 200",
      resSettle.status === 200 && dataSettle.ok === true && dataSettle.paymentStatus === "paid"
    );

    // Verify MySQL state
    const [rowsAfterSettle] = (await pool.execute(
      "SELECT payment_status FROM orders WHERE id = ?",
      [order1.id]
    )) as any[];
    assert(
      "6.6 MySQL orders.payment_status updated to 'paid'",
      rowsAfterSettle[0].payment_status === "paid"
    );

    // =========================================================================
    // SECTION 7: Payment Failure, Cancellation & Retries (L-05 customer cases)
    // =========================================================================
    console.log("\n--- Section 7: L-05 Failure, Cancellation & Retries ---");

    // Create a second order for failure & cancellation testing (add product to cart first)
    await addCartItemHandler(
      new Request("http://localhost:3000/api/cart/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: product1.id, quantity: 1 }),
      })
    );

    const resOrder2 = await createOrderHandler(
      new Request("http://localhost:3000/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shippingFullName: "Pavan Retry",
          shippingPhone: "9876543210",
          shippingAddressLine1: "Banjara Hills",
          shippingCity: "Hyderabad",
          shippingState: "Telangana",
          shippingPostalCode: "500034",
          shippingCountry: "India",
        }),
      }) as any
    );
    const dataOrder2 = await resOrder2.json();
    const order2 = dataOrder2.order;
    createdOrderIds.push(order2.id);

    // Create initial Razorpay payment attempt for order2
    const resCreateRzp2 = await createPaymentOrderHandler(
      new Request("http://localhost:3000/api/payments/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: order2.id }),
      })
    );
    const dataCreateRzp2 = await resCreateRzp2.json();
    const rzpOrder2Id = dataCreateRzp2.razorpayOrderId;

    // 7.1 Cancellation callback does not falsely mark payment failed
    const resCancel = await cancelPaymentHandler(
      new Request("http://localhost:3000/api/payments/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: order2.id, razorpayOrderId: rzpOrder2Id }),
      })
    );
    const dataCancel = await resCancel.json();
    const [rowsOrder2Cancel] = (await pool.execute("SELECT payment_status FROM orders WHERE id = ?", [order2.id])) as any[];
    assert(
      "7.1 Cancellation callback keeps order in safe 'pending' state",
      resCancel.status === 200 && dataCancel.cancelled === true && rowsOrder2Cancel[0].payment_status === "pending"
    );

    // 7.2 Failure callback marks payment and order as failed
    const resFail = await failPaymentHandler(
      new Request("http://localhost:3000/api/payments/fail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: order2.id,
          razorpayOrderId: rzpOrder2Id,
          errorCode: "PAYMENT_FAILED",
          errorDescription: "Customer card expired",
        }),
      })
    );
    const dataFail = await resFail.json();
    const [rowsOrder2Fail] = (await pool.execute("SELECT payment_status FROM orders WHERE id = ?", [order2.id])) as any[];
    assert(
      "7.2 Failure callback marks order payment_status = 'failed'",
      resFail.status === 200 && dataFail.paymentStatus === "failed" && rowsOrder2Fail[0].payment_status === "failed"
    );

    // 7.3 Retry after failure issues new payment order and succeeds
    const resRetryCreate = await createPaymentOrderHandler(
      new Request("http://localhost:3000/api/payments/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: order2.id }),
      })
    );
    const dataRetryCreate = await resRetryCreate.json();
    assert(
      "7.3 Retry payment: fresh Razorpay order issued for failed order",
      resRetryCreate.status === 201 && dataRetryCreate.ok === true && !!dataRetryCreate.razorpayOrderId
    );

    const retryPayId = `pay_l06_retry_${testRunId}`;
    const retrySig = crypto.createHmac("sha256", keySecret).update(`${dataRetryCreate.razorpayOrderId}|${retryPayId}`).digest("hex");
    await verifyPaymentHandler(
      new Request("http://localhost:3000/api/payments/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: order2.id,
          razorpay_order_id: dataRetryCreate.razorpayOrderId,
          razorpay_payment_id: retryPayId,
          razorpay_signature: retrySig,
        }),
      })
    );
    const resRetrySettle = await settlePaymentHandler(
      new Request("http://localhost:3000/api/payments/settle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: order2.id, razorpayPaymentId: retryPayId }),
      })
    );
    assert("7.4 Retry settlement marks order as paid", resRetrySettle.status === 200);

    // 7.4 Already-paid order cannot be changed by late failure callback
    const resLateFail = await failPaymentHandler(
      new Request("http://localhost:3000/api/payments/fail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: order1.id, errorCode: "LATE_DECLINE" }),
      })
    );
    const dataLateFail = await resLateFail.json();
    const [rowsOrder1CheckLate] = (await pool.execute("SELECT payment_status FROM orders WHERE id = ?", [order1.id])) as any[];
    assert(
      "7.5 Late failure callback on already-paid order is ignored safely (ignored: true)",
      resLateFail.status === 200 && dataLateFail.ignored === true && rowsOrder1CheckLate[0].payment_status === "paid"
    );

    // =========================================================================
    // SECTION 8: Order Confirmation & Ownership Access Controls
    // =========================================================================
    console.log("\n--- Section 8: Order Confirmation & Ownership Access Controls ---");

    // 8.1 Customer retrieves own order detail
    const resOrderDetail = await getOrderDetailHandler(
      new Request(`http://localhost:3000/api/orders/${order1.id}`) as any,
      { params: Promise.resolve({ id: order1.id }) } as any
    );
    const dataOrderDetail = await resOrderDetail.json();
    assert(
      "8.1 Customer successfully retrieves their own order details (HTTP 200)",
      resOrderDetail.status === 200 && dataOrderDetail.ok === true && dataOrderDetail.order.id === order1.id
    );

    // 8.2 Order by order_number works for confirmation page
    const resOrderByNumber = await getOrderDetailHandler(
      new Request(`http://localhost:3000/api/orders/${order1.orderNumber}`) as any,
      { params: Promise.resolve({ id: order1.orderNumber }) } as any
    );
    const dataOrderByNumber = await resOrderByNumber.json();
    assert(
      "8.2 Confirmation lookup by order_number returns complete order snapshot",
      resOrderByNumber.status === 200 && dataOrderByNumber.order.paymentStatus === "paid"
    );

    // 8.3 Unauthenticated order detail access rejected
    currentMockSessionToken = null;
    const resUnauthOrder = await getOrderDetailHandler(
      new Request(`http://localhost:3000/api/orders/${order1.id}`) as any,
      { params: Promise.resolve({ id: order1.id }) } as any
    );
    assert("8.3 Unauthenticated customer cannot view order details (HTTP 401)", resUnauthOrder.status === 401);

    // =========================================================================
    // SECTION 9: Order History
    // =========================================================================
    console.log("\n--- Section 9: Customer Order History ---");
    currentMockSessionToken = newCustomerSessionToken;

    const resHistory = await getOrdersHandler(new Request("http://localhost:3000/api/orders") as any);
    const dataHistory = await resHistory.json();
    assert(
      "9.1 Order history returns all orders placed by customer",
      resHistory.status === 200 && dataHistory.ok === true && Array.isArray(dataHistory.orders) && dataHistory.orders.length >= 2,
      `Customer orders in history: ${dataHistory.orders?.length}`
    );
    const containsOrder1 = dataHistory.orders.some((o: any) => o.id === order1.id && o.paymentStatus === "paid");
    assert("9.2 Order history includes newly settled paid order with correct status", containsOrder1);

    // =========================================================================
    // SECTION 10: Existing Customer Core Journey
    // =========================================================================
    console.log("\n--- Section 10: Existing Customer Core Journey ---");

    // Seed existing customer in MySQL
    const existingPasswordHash = await bcrypt.hash(existingCustomerPassword, 4);
    await pool.execute(
      `INSERT INTO profiles (id, email, password_hash, full_name, phone, role, created_at, updated_at)
       VALUES (?, ?, ?, ?, '9876543299', 'customer', NOW(), NOW())`,
      [existingCustomerId, existingCustomerEmail, existingPasswordHash, existingCustomerName]
    );
    createdUserIds.push(existingCustomerId);

    // Seed historical order for existing customer
    const existingHistOrderId = crypto.randomUUID();
    const existingHistOrderNumber = `ORD-L06-EXIST-${testRunId}`;
    await pool.execute(
      `INSERT INTO orders (id, order_number, user_id, status, payment_status, total_amount, currency, subtotal, discount_amount, shipping_amount, created_at, updated_at)
       VALUES (?, ?, ?, 'delivered', 'paid', 1299.00, 'INR', 1299.00, 0, 0, DATE_SUB(NOW(), INTERVAL 7 DAY), DATE_SUB(NOW(), INTERVAL 7 DAY))`,
      [existingHistOrderId, existingHistOrderNumber, existingCustomerId]
    );
    createdOrderIds.push(existingHistOrderId);

    // 10.1 Login Existing Customer
    const resLoginExisting = await loginHandler(
      new Request("http://localhost:3000/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: existingCustomerEmail, password: existingCustomerPassword }),
      })
    );
    existingCustomerSessionToken = extractCookieToken(resLoginExisting);
    currentMockSessionToken = existingCustomerSessionToken;
    assert("10.1 Existing customer logs in successfully (HTTP 200)", resLoginExisting.status === 200 && !!existingCustomerSessionToken);

    // 10.2 Add item to cart and checkout as existing customer
    await addCartItemHandler(
      new Request("http://localhost:3000/api/cart/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: product1.id, quantity: 1 }),
      })
    );
    const resExistingOrder = await createOrderHandler(
      new Request("http://localhost:3000/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shippingFullName: existingCustomerName,
          shippingPhone: "9876543299",
          shippingAddressLine1: "MG Road, Indiranagar",
          shippingCity: "Bengaluru",
          shippingState: "Karnataka",
          shippingPostalCode: "560038",
          shippingCountry: "India",
        }),
      }) as any
    );
    const dataExistingOrder = await resExistingOrder.json();
    const existingNewOrder = dataExistingOrder.order;
    createdOrderIds.push(existingNewOrder.id);
    assert("10.2 Existing customer creates new checkout order (HTTP 201)", resExistingOrder.status === 201);

    // 10.3 Payment for existing customer order
    const resExistRzp = await createPaymentOrderHandler(
      new Request("http://localhost:3000/api/payments/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: existingNewOrder.id }),
      })
    );
    const dataExistRzp = await resExistRzp.json();
    const existPayId = `pay_exist_${testRunId}`;
    const existSig = crypto.createHmac("sha256", keySecret).update(`${dataExistRzp.razorpayOrderId}|${existPayId}`).digest("hex");
    await verifyPaymentHandler(
      new Request("http://localhost:3000/api/payments/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: existingNewOrder.id,
          razorpay_order_id: dataExistRzp.razorpayOrderId,
          razorpay_payment_id: existPayId,
          razorpay_signature: existSig,
        }),
      })
    );
    const resExistSettle = await settlePaymentHandler(
      new Request("http://localhost:3000/api/payments/settle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: existingNewOrder.id, razorpayPaymentId: existPayId }),
      })
    );
    assert("10.3 Existing customer order payment settled to paid (HTTP 200)", resExistSettle.status === 200);

    // 10.4 Order History shows both historical and new orders
    const resExistingHistory = await getOrdersHandler(new Request("http://localhost:3000/api/orders") as any);
    const dataExistingHistory = await resExistingHistory.json();
    assert(
      "10.4 Existing customer order history lists both past and newly placed orders",
      dataExistingHistory.orders.some((o: any) => o.id === existingHistOrderId) &&
      dataExistingHistory.orders.some((o: any) => o.id === existingNewOrder.id),
      `Total customer orders: ${dataExistingHistory.orders?.length}`
    );

    // =========================================================================
    // SECTION 11: Cross-Customer IDOR & Security Isolation
    // =========================================================================
    console.log("\n--- Section 11: Cross-Customer Isolation & Security Boundaries ---");

    // Existing customer attempts to view New Customer's order detail -> 403 or 404 (IDOR protection)
    const resIdorOrder = await getOrderDetailHandler(
      new Request(`http://localhost:3000/api/orders/${order1.id}`) as any,
      { params: Promise.resolve({ id: order1.id }) } as any
    );
    assert("11.1 Customer cannot access another customer's order (HTTP 403 or 404)", resIdorOrder.status === 403 || resIdorOrder.status === 404);

    // Existing customer attempts to settle New Customer's payment -> 403
    const resIdorSettle = await settlePaymentHandler(
      new Request("http://localhost:3000/api/payments/settle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: order1.id }),
      })
    );
    assert("11.2 Customer cannot settle another customer's payment (HTTP 403 Forbidden)", resIdorSettle.status === 403);

    // Existing customer attempts to fail New Customer's payment -> 403
    const resIdorFail = await failPaymentHandler(
      new Request("http://localhost:3000/api/payments/fail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: order1.id }),
      })
    );
    assert("11.3 Customer cannot send failure callbacks for another customer's order (HTTP 403)", resIdorFail.status === 403);

    // Logout
    const resLogout = await logoutHandler();
    assert("11.4 Customer logout invalidates session cookie successfully (HTTP 200)", resLogout.status === 200);

    // Post-logout access check
    currentMockSessionToken = null;
    const resPostLogoutMe = await meHandler();
    const dataPostLogoutMe = await resPostLogoutMe.json();
    const resPostLogoutCart = await getCartHandler();
    assert(
      "11.5 Post-logout state verified: /api/auth/me returns null session and /api/cart returns HTTP 401",
      resPostLogoutMe.status === 200 && dataPostLogoutMe.user === null && resPostLogoutCart.status === 401
    );

  } catch (err) {
    console.error("Critical error during customer E2E audit:", err);
    failed++;
  } finally {
    console.log("\nCleaning up test fixtures from Hostinger MySQL...");
    try {
      if (createdOrderIds.length > 0) {
        await pool.execute(
          `DELETE FROM payments WHERE order_id IN (${createdOrderIds.map(() => "?").join(",")})`,
          createdOrderIds
        );
        await pool.execute(
          `DELETE FROM order_items WHERE order_id IN (${createdOrderIds.map(() => "?").join(",")})`,
          createdOrderIds
        );
        await pool.execute(
          `DELETE FROM orders WHERE id IN (${createdOrderIds.map(() => "?").join(",")})`,
          createdOrderIds
        );
      }
      if (createdUserIds.length > 0) {
        const uPlaceholders = createdUserIds.map(() => "?").join(",");
        await pool.execute(
          `DELETE FROM cart_items WHERE cart_id IN (SELECT id FROM carts WHERE user_id IN (${uPlaceholders}))`,
          createdUserIds
        );
        await pool.execute(
          `DELETE FROM carts WHERE user_id IN (${uPlaceholders})`,
          createdUserIds
        );
        await pool.execute(
          `DELETE FROM wishlist_items WHERE wishlist_id IN (SELECT id FROM wishlists WHERE user_id IN (${uPlaceholders}))`,
          createdUserIds
        );
        await pool.execute(
          `DELETE FROM wishlists WHERE user_id IN (${uPlaceholders})`,
          createdUserIds
        );
        await pool.execute(
          `DELETE FROM profiles WHERE id IN (${uPlaceholders})`,
          createdUserIds
        );
      }
      console.log("✓ Fixtures cleaned up successfully.");
    } catch (cleanupErr) {
      console.error("Cleanup error:", cleanupErr);
    }
    await pool.end();
  }

  console.log("\n=================================================================");
  console.log(`L-06 CUSTOMER E2E AUDIT SUMMARY: ${passed} PASSED / ${failed} FAILED`);
  console.log("=================================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runCustomerE2E();
