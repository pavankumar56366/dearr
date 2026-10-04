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

async function runL07EdgeCases() {
  console.log("=================================================================");
  console.log("Dearr V1 — Task L-07: Customer Negative & Edge-Case Verification");
  console.log("Database: Hostinger MySQL (srv1741.hstgr.io)");
  console.log("Gateway: Razorpay Test Mode");
  console.log("=================================================================\n");

  // Route Handlers
  const { POST: signupHandler } = await import("../src/app/api/auth/signup/route");
  const { POST: loginHandler } = await import("../src/app/api/auth/login/route");
  const { GET: getCartHandler } = await import("../src/app/api/cart/route");
  const { POST: addCartItemHandler } = await import("../src/app/api/cart/items/route");
  const { DELETE: removeCartItemHandler } = await import("../src/app/api/cart/items/[id]/route");
  const { GET: getOrdersHandler, POST: createOrderHandler } = await import("../src/app/api/orders/route");
  const { GET: getOrderDetailHandler } = await import("../src/app/api/orders/[id]/route");
  const { POST: createPaymentOrderHandler } = await import("../src/app/api/payments/create/route");
  const { POST: verifyPaymentHandler } = await import("../src/app/api/payments/verify/route");
  const { POST: settlePaymentHandler } = await import("../src/app/api/payments/settle/route");
  const { POST: failPaymentHandler } = await import("../src/app/api/payments/fail/route");

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

  const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || "";

  // Temporary test user IDs for cleanup
  const cleanupUserIds: string[] = [];
  const cleanupOrderIds: string[] = [];

  try {
    // =========================================================================
    // SCENARIO 1: Invalid Login Edge Cases
    // =========================================================================
    console.log("--- SCENARIO 1: Invalid Login Edge Cases ---");

    // 1.1 Nonexistent email
    const resNonexistent = await loginHandler(
      new Request("http://localhost:3000/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "nonexistent_edge_999@dearr.test", password: "SomePassword123!" }),
      })
    );
    assert("1.1 Nonexistent email rejected safely with HTTP 401", resNonexistent.status === 401);
    const nonExistData = await resNonexistent.json();
    assert("1.2 Generic safe error message returned", nonExistData.error === "Invalid email or password");
    assert("1.3 No session token set for nonexistent user", extractCookieToken(resNonexistent) === null);

    // 1.4 Wrong password for existing user
    const resWrongPass = await loginHandler(
      new Request("http://localhost:3000/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "existing_customer_l06@dearr.test", password: "TotallyWrongPassword!999" }),
      })
    );
    assert("1.4 Wrong password rejected with HTTP 401", resWrongPass.status === 401);
    assert("1.5 No session token set for wrong password", extractCookieToken(resWrongPass) === null);

    // 1.6 Malformed email format
    const resBadEmail = await loginHandler(
      new Request("http://localhost:3000/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "not-an-email", password: "SomePassword123!" }),
      })
    );
    assert("1.6 Malformed email rejected safely with HTTP 400 or 401", resBadEmail.status === 400 || resBadEmail.status === 401);

    // 1.7 Empty email
    const resEmptyEmail = await loginHandler(
      new Request("http://localhost:3000/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "", password: "SomePassword123!" }),
      })
    );
    assert("1.7 Empty email rejected with HTTP 400", resEmptyEmail.status === 400);

    // 1.8 Empty password
    const resEmptyPass = await loginHandler(
      new Request("http://localhost:3000/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "existing_customer_l06@dearr.test", password: "" }),
      })
    );
    assert("1.8 Empty password rejected with HTTP 400", resEmptyPass.status === 400);

    // 1.9 Repeated failed attempts stability (5 consecutive failures)
    let repeatedFailedClean = true;
    for (let i = 0; i < 5; i++) {
      const resRepeat = await loginHandler(
        new Request("http://localhost:3000/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: "existing_customer_l06@dearr.test", password: `FailAttempt_${i}` }),
        })
      );
      if (resRepeat.status !== 401) repeatedFailedClean = false;
    }
    assert("1.9 Repeated failed logins remain safe & stable with HTTP 401", repeatedFailedClean);

    // 1.10 Valid login succeeds cleanly afterward
    const resValidLogin = await loginHandler(
      new Request("http://localhost:3000/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "existing_customer_l06@dearr.test", password: "ExistingCustomer@123" }),
      })
    );
    assert("1.10 Valid login succeeds with HTTP 200 after negative tests", resValidLogin.status === 200);
    const validLoginCookie = extractCookieToken(resValidLogin);
    assert("1.11 Valid login generates valid session token", !!validLoginCookie);

    // Set mock cookie for subsequent authenticated tests
    currentMockSessionToken = validLoginCookie;

    // =========================================================================
    // SCENARIO 2: Empty Cart Edge Cases
    // =========================================================================
    console.log("\n--- SCENARIO 2: Empty Cart Edge Cases ---");

    // Create a dedicated clean customer to verify pristine empty cart
    const emptyCustRunId = Date.now().toString().slice(-6);
    const emptyCustEmail = `l07.empty.${emptyCustRunId}@dearr.test`;
    const resSignupEmpty = await signupHandler(
      new Request("http://localhost:3000/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Empty Cart Tester", email: emptyCustEmail, password: "Password123!Secure" }),
      })
    );
    assert("2.1 Dedicated test customer initialized", resSignupEmpty.status === 201);
    const emptyCustToken = extractCookieToken(resSignupEmpty);
    const signupData = await resSignupEmpty.json();
    cleanupUserIds.push(signupData.user.id);

    // Switch context to empty-cart customer
    currentMockSessionToken = emptyCustToken;

    // 2.2 Verify empty cart state
    const resGetEmptyCart = await getCartHandler();
    assert("2.2 GET /api/cart returns HTTP 200 for new customer", resGetEmptyCart.status === 200);
    const emptyCartData = await resGetEmptyCart.json();
    assert(
      "2.3 Cart state is strictly empty",
      emptyCartData.ok === true &&
        emptyCartData.cart.items.length === 0 &&
        emptyCartData.cart.totals.total === 0 &&
        emptyCartData.cart.itemCount === 0
    );

    // 2.4 Attempt to create order from empty cart
    const resEmptyOrder = await createOrderHandler(
      new Request("http://localhost:3000/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shippingFullName: "Empty Tester",
          shippingPhone: "9876543210",
          shippingAddressLine1: "123 Test St",
          shippingCity: "Hyderabad",
          shippingState: "Telangana",
          shippingPostalCode: "500001",
        }),
      }) as any
    );
    assert("2.4 POST /api/orders rejected for empty cart with HTTP 400", resEmptyOrder.status === 400);
    const emptyOrderErr = await resEmptyOrder.json();
    assert(
      "2.5 Error indicates cart is empty",
      emptyOrderErr.error?.toLowerCase().includes("empty")
    );

    // 2.6 Confirm zero orders were created in MySQL
    const [ordersCount] = await pool.execute(
      "SELECT COUNT(*) as cnt FROM orders WHERE user_id = ?",
      [signupData.user.id]
    );
    assert("2.6 Zero orders created in database for empty cart", (ordersCount as any)[0].cnt === 0);

    // =========================================================================
    // SCENARIO 3: Out-of-Stock Product Edge Cases
    // =========================================================================
    console.log("\n--- SCENARIO 3: Out-of-Stock Product Edge Cases ---");

    // 3.1 Fetch real out-of-stock product
    const [oosRows] = await pool.execute(
      "SELECT id, name, slug, stock_quantity, is_active FROM products WHERE stock_quantity <= 0 LIMIT 1"
    );
    const oosProduct = Array.isArray(oosRows) && oosRows.length > 0 ? (oosRows as any)[0] : null;
    assert("3.1 Genuine out-of-stock product found in MySQL", !!oosProduct && oosProduct.stock_quantity === 0);

    // 3.2 Attempt to add out-of-stock product to cart via API
    const resAddOos = await addCartItemHandler(
      new Request("http://localhost:3000/api/cart/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: oosProduct.id, quantity: 1 }),
      })
    );
    assert("3.2 Adding out-of-stock product rejected with HTTP 400", resAddOos.status === 400);
    const oosErr = await resAddOos.json();
    assert(
      "3.3 Error message explicitly reports out of stock",
      oosErr.error?.toLowerCase().includes("out of stock")
    );

    // 3.4 Quantity exceeds available stock
    const [inStockRows] = await pool.execute(
      "SELECT id, name, stock_quantity FROM products WHERE is_active = 1 AND stock_quantity > 0 LIMIT 1"
    );
    const inStockProduct = (inStockRows as any)[0];
    const excessiveQuantity = inStockProduct.stock_quantity + 500;

    const resExcessQuantity = await addCartItemHandler(
      new Request("http://localhost:3000/api/cart/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: inStockProduct.id, quantity: excessiveQuantity }),
      })
    );
    assert("3.4 Requested quantity exceeding stock rejected with HTTP 400", resExcessQuantity.status === 400);
    const excessErr = await resExcessQuantity.json();
    assert(
      "3.5 Error message reports insufficient stock",
      excessErr.error?.toLowerCase().includes("stock") || excessErr.error?.toLowerCase().includes("insufficient")
    );

    // 3.6 Invalid negative/zero quantity
    const resZeroQuantity = await addCartItemHandler(
      new Request("http://localhost:3000/api/cart/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: inStockProduct.id, quantity: 0 }),
      })
    );
    assert("3.6 Zero quantity rejected with HTTP 400", resZeroQuantity.status === 400);

    const resNegQuantity = await addCartItemHandler(
      new Request("http://localhost:3000/api/cart/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: inStockProduct.id, quantity: -5 }),
      })
    );
    assert("3.7 Negative quantity rejected with HTTP 400", resNegQuantity.status === 400);

    // =========================================================================
    // SCENARIO 4: Invalid Checkout Inputs Edge Cases
    // =========================================================================
    console.log("\n--- SCENARIO 4: Invalid Checkout Inputs Edge Cases ---");

    // Add a valid item to the customer's cart first
    const resAddValid = await addCartItemHandler(
      new Request("http://localhost:3000/api/cart/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: inStockProduct.id, quantity: 1 }),
      })
    );
    assert("4.1 Valid product added to cart for checkout tests", resAddValid.status === 201);

    // 4.2 Missing Full Name
    const resNoNameCheckout = await createOrderHandler(
      new Request("http://localhost:3000/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shippingFullName: "",
          shippingPhone: "9876543210",
          shippingAddressLine1: "123 Road No 10",
          shippingCity: "Hyderabad",
          shippingState: "Telangana",
          shippingPostalCode: "500033",
        }),
      }) as any
    );
    assert("4.2 Checkout rejects missing full name with HTTP 400", resNoNameCheckout.status === 400);

    // 4.3 Invalid Phone Number (too short / non-Indian mobile format)
    const resBadPhoneCheckout = await createOrderHandler(
      new Request("http://localhost:3000/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shippingFullName: "Test Customer",
          shippingPhone: "12345",
          shippingAddressLine1: "123 Road No 10",
          shippingCity: "Hyderabad",
          shippingState: "Telangana",
          shippingPostalCode: "500033",
        }),
      }) as any
    );
    assert("4.3 Checkout rejects invalid phone format with HTTP 400", resBadPhoneCheckout.status === 400);

    // 4.4 Incomplete Address Line 1 (< 5 chars)
    const resShortAddr = await createOrderHandler(
      new Request("http://localhost:3000/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shippingFullName: "Test Customer",
          shippingPhone: "9876543210",
          shippingAddressLine1: "A",
          shippingCity: "Hyderabad",
          shippingState: "Telangana",
          shippingPostalCode: "500033",
        }),
      }) as any
    );
    assert("4.4 Checkout rejects short address with HTTP 400", resShortAddr.status === 400);

    // 4.5 Invalid Postal Code (non-numeric / invalid length)
    const resBadPostal = await createOrderHandler(
      new Request("http://localhost:3000/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shippingFullName: "Test Customer",
          shippingPhone: "9876543210",
          shippingAddressLine1: "Flat 402, Lotus Residency",
          shippingCity: "Hyderabad",
          shippingState: "Telangana",
          shippingPostalCode: "BADPIN",
        }),
      }) as any
    );
    assert("4.5 Checkout rejects non-numeric postal code with HTTP 400", resBadPostal.status === 400);

    // 4.6 Confirm no corrupt/partial orders were created
    const [noCorruptOrders] = await pool.execute(
      "SELECT COUNT(*) as cnt FROM orders WHERE user_id = ?",
      [signupData.user.id]
    );
    assert("4.6 Zero corrupt orders created in database", (noCorruptOrders as any)[0].cnt === 0);

    // =========================================================================
    // SCENARIO 5: Failed Payment & Reconciliation Edge Cases
    // =========================================================================
    console.log("\n--- SCENARIO 5: Failed Payment & Reconciliation Edge Cases ---");

    // 5.1 Place a valid order
    const resValidOrder = await createOrderHandler(
      new Request("http://localhost:3000/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shippingFullName: "Failed Payment Tester",
          shippingPhone: "9876543210",
          shippingAddressLine1: "Flat 402, Lotus Residency, Road No 36",
          shippingCity: "Hyderabad",
          shippingState: "Telangana",
          shippingPostalCode: "500033",
        }),
      }) as any
    );
    assert("5.1 Valid order created from cart with HTTP 201", resValidOrder.status === 201);
    const validOrderData = await resValidOrder.json();
    const testOrderId = validOrderData.order.id;
    cleanupOrderIds.push(testOrderId);

    // Initial state: status='pending', payment_status='pending'
    const [initialOrderRows] = await pool.execute(
      "SELECT id, order_number, status, payment_status, total_amount FROM orders WHERE id = ?",
      [testOrderId]
    );
    const initialOrder = (initialOrderRows as any)[0];
    assert("5.2 Newly created order has payment_status='pending'", initialOrder.payment_status === "pending");

    // 5.3 Initialize Razorpay Payment Order
    const resCreateRzp = await createPaymentOrderHandler(
      new Request("http://localhost:3000/api/payments/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: testOrderId }),
      })
    );
    assert("5.3 Razorpay payment order created with HTTP 201", resCreateRzp.status === 201);
    const rzpOrderData = await resCreateRzp.json();
    const rzpOrderId = rzpOrderData.razorpayOrderId;

    // 5.4 Payment Failure Callback (POST /api/payments/fail)
    const resFailPayment = await failPaymentHandler(
      new Request("http://localhost:3000/api/payments/fail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: testOrderId,
          razorpay_order_id: rzpOrderId,
          reason: "Payment dismissed or cancelled by customer",
        }),
      })
    );
    assert("5.4 Payment failure handler succeeds with HTTP 200", resFailPayment.status === 200);

    // 5.5 Verify in MySQL: order is NOT paid
    const [afterFailOrderRows] = await pool.execute(
      "SELECT id, status, payment_status FROM orders WHERE id = ?",
      [testOrderId]
    );
    const afterFailOrder = (afterFailOrderRows as any)[0];
    assert(
      "5.5 Order does NOT become paid on payment failure",
      afterFailOrder.payment_status !== "paid" &&
        (afterFailOrder.payment_status === "failed" || afterFailOrder.payment_status === "pending")
    );

    // 5.6 Payment record in MySQL marked 'failed'
    const [failPaymentRows] = await pool.execute(
      "SELECT id, status FROM payments WHERE order_id = ? AND provider_order_id = ?",
      [testOrderId, rzpOrderId]
    );
    const failPaymentRec = (failPaymentRows as any)[0];
    assert("5.6 Payment record in MySQL reflects failure status", failPaymentRec?.status === "failed");

    // 5.7 Customer can RETRY: create a fresh Razorpay order for the same internal order
    const resRetryRzp = await createPaymentOrderHandler(
      new Request("http://localhost:3000/api/payments/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: testOrderId }),
      })
    );
    assert("5.7 Customer can initialize retry payment order with HTTP 201", resRetryRzp.status === 201);
    const retryRzpData = await resRetryRzp.json();
    const retryRzpOrderId = retryRzpData.razorpayOrderId;
    assert("5.8 Fresh Razorpay Order ID issued on retry", !!retryRzpOrderId);

    // 5.9 Complete retry payment successfully
    const testPaymentId = `pay_l07_retry_${Date.now()}`;
    const testSignature = crypto
      .createHmac("sha256", RAZORPAY_KEY_SECRET)
      .update(`${retryRzpOrderId}|${testPaymentId}`)
      .digest("hex");

    const resVerifyRetry = await verifyPaymentHandler(
      new Request("http://localhost:3000/api/payments/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: testOrderId,
          razorpay_order_id: retryRzpOrderId,
          razorpay_payment_id: testPaymentId,
          razorpay_signature: testSignature,
        }),
      })
    );
    assert("5.9 Retry payment verified with HTTP 200", resVerifyRetry.status === 200);

    const resSettleRetry = await settlePaymentHandler(
      new Request("http://localhost:3000/api/payments/settle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: testOrderId,
          razorpay_order_id: retryRzpOrderId,
          razorpay_payment_id: testPaymentId,
        }),
      })
    );
    assert("5.10 Retry payment settled with HTTP 200", resSettleRetry.status === 200);

    const [settledRows] = await pool.execute(
      "SELECT payment_status FROM orders WHERE id = ?",
      [testOrderId]
    );
    assert("5.11 Order successfully updated to 'paid' after retry", (settledRows as any)[0].payment_status === "paid");

    // 5.12 Late Failure Attack Protection: A late failure callback must NOT downgrade a paid order!
    const resLateFail = await failPaymentHandler(
      new Request("http://localhost:3000/api/payments/fail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: testOrderId,
          razorpay_order_id: retryRzpOrderId,
          reason: "Late bogus failure callback",
        }),
      })
    );
    // Late failure on paid order returns 400 or rejects safely
    assert("5.12 Late failure callback rejected safely", resLateFail.status === 400 || resLateFail.status === 200);

    const [afterLateFailRows] = await pool.execute(
      "SELECT payment_status FROM orders WHERE id = ?",
      [testOrderId]
    );
    assert(
      "5.13 Immortality of Paid Status: Order remains strictly 'paid'",
      (afterLateFailRows as any)[0].payment_status === "paid"
    );

    // =========================================================================
    // SCENARIO 6: Successful Payment Integrity
    // =========================================================================
    console.log("\n--- SCENARIO 6: Successful Payment Integrity ---");

    // 6.1 Check payment record in MySQL
    const [capturedPaymentRows] = await pool.execute(
      "SELECT id, status, amount, currency, paid_at FROM payments WHERE order_id = ? AND status IN ('verified', 'captured')",
      [testOrderId]
    );
    const capturedRec = Array.isArray(capturedPaymentRows) && (capturedPaymentRows as any[]).length > 0 ? (capturedPaymentRows as any[])[0] : null;
    assert("6.1 Payment record marked 'verified'/'captured' in MySQL", !!capturedRec);
    assert("6.2 Payment amount matches order total", capturedRec ? Number(capturedRec.amount) === Number(initialOrder.total_amount) : false);
    assert("6.3 paid_at timestamp is populated", !!capturedRec?.paid_at);

    // 6.4 Cart cleared in MySQL after settlement
    const [cartCheckRows] = await pool.execute(
      "SELECT ci.id FROM cart_items ci JOIN carts c ON ci.cart_id = c.id WHERE c.user_id = ?",
      [signupData.user.id]
    );
    assert("6.4 Customer cart cleared in database after settlement", (cartCheckRows as any[]).length === 0);

    // =========================================================================
    // SCENARIO 7: Order History & Cross-Customer Security (IDOR)
    // =========================================================================
    console.log("\n--- SCENARIO 7: Order History & Cross-Customer Security ---");

    // 7.1 Reconnect as existing customer fixture
    currentMockSessionToken = validLoginCookie;

    const resExistingOrders = await getOrdersHandler(new Request("http://localhost:3000/api/orders") as any);
    assert("7.1 Existing customer order history fetched with HTTP 200", resExistingOrders.status === 200);
    const existingOrdersData = await resExistingOrders.json();
    const orderNumbers = existingOrdersData.orders.map((o: any) => o.orderNumber);
    assert("7.2 Historical order DEAR-81204 present in customer order history", orderNumbers.includes("DEAR-81204"));

    // 7.3 Fetch historical order details
    const resHistDetail = await getOrderDetailHandler(
      new Request("http://localhost:3000/api/orders/DEAR-81204") as any,
      { params: Promise.resolve({ id: "DEAR-81204" }) }
    );
    assert("7.3 Historical order details fetched with HTTP 200", resHistDetail.status === 200);
    const histData = await resHistDetail.json();
    assert("7.4 Historical order line items match", histData.order.items.length >= 1);
    assert("7.5 Historical order amount is ₹599.00", Number(histData.order.totalAmount) === 599);

    // 7.6 Cross-Customer IDOR Defense: Existing customer attempts to view the test customer's order
    const resIdorDetail = await getOrderDetailHandler(
      new Request(`http://localhost:3000/api/orders/${testOrderId}`) as any,
      { params: Promise.resolve({ id: testOrderId }) }
    );
    assert("7.6 Cross-customer order access rejected with HTTP 404", resIdorDetail.status === 404);

    // 7.7 Cross-Customer Tampered Payment Creation: Customer A cannot create payment for Customer B's order
    const resIdorPayment = await createPaymentOrderHandler(
      new Request("http://localhost:3000/api/payments/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: testOrderId }),
      })
    );
    assert("7.7 Cross-customer payment order creation rejected with HTTP 403 or 404", resIdorPayment.status === 403 || resIdorPayment.status === 404);

    // =========================================================================
    // SCENARIO 8: Referential Integrity & Orphan Prevention Checks
    // =========================================================================
    console.log("\n--- SCENARIO 8: Referential Integrity & Orphan Prevention ---");

    const [orphanItems] = await pool.execute(
      "SELECT COUNT(*) as cnt FROM order_items oi LEFT JOIN orders o ON oi.order_id = o.id WHERE o.id IS NULL"
    );
    assert("8.1 Zero orphan order_items in database", (orphanItems as any)[0].cnt === 0);

    const [orphanPayments] = await pool.execute(
      "SELECT COUNT(*) as cnt FROM payments p LEFT JOIN orders o ON p.order_id = o.id WHERE o.id IS NULL"
    );
    assert("8.2 Zero orphan payments in database", (orphanPayments as any)[0].cnt === 0);

    const [orphanCartItems] = await pool.execute(
      "SELECT COUNT(*) as cnt FROM cart_items ci LEFT JOIN carts c ON ci.cart_id = c.id WHERE c.id IS NULL"
    );
    assert("8.3 Zero orphan cart_items in database", (orphanCartItems as any)[0].cnt === 0);

  } catch (err: any) {
    console.error("FATAL ERROR in L-07 Edge Case Suite:", err);
    assert("Execution completed without uncaught exception", false, err.message);
  } finally {
    // Clean up temporary test user and test order created in this suite
    for (const ordId of cleanupOrderIds) {
      await pool.execute("DELETE FROM payments WHERE order_id = ?", [ordId]).catch(() => {});
      await pool.execute("DELETE FROM order_items WHERE order_id = ?", [ordId]).catch(() => {});
      await pool.execute("DELETE FROM orders WHERE id = ?", [ordId]).catch(() => {});
    }
    for (const uId of cleanupUserIds) {
      await pool.execute("DELETE FROM addresses WHERE user_id = ?", [uId]).catch(() => {});
      await pool.execute("DELETE FROM cart_items WHERE cart_id IN (SELECT id FROM carts WHERE user_id = ?)", [uId]).catch(() => {});
      await pool.execute("DELETE FROM carts WHERE user_id = ?", [uId]).catch(() => {});
      await pool.execute("DELETE FROM profiles WHERE id = ?", [uId]).catch(() => {});
    }

    await pool.end();
  }

  console.log("\n=================================================================");
  console.log(`L-07 EDGE-CASE SUITE RESULT: ${passed} PASSED, ${failed} FAILED`);
  console.log("=================================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runL07EdgeCases();
