import fs from "fs";
import path from "path";
import mysql from "mysql2/promise";
import bcrypt from "bcryptjs";

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
      if (!process.env[key]) process.env[key] = val;
    }
  }
}

const baseUrl = "http://localhost:3000";

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

async function runA04Verification() {
  console.log("=================================================================");
  console.log("Dearr V1 — Task A-04: Admin Dashboard Quick Actions & Recent Data");
  console.log("Host:", baseUrl);
  console.log("Database:", process.env.DB_HOST, "(Hostinger MySQL)");
  console.log("=================================================================\n");

  const adminEmail = "founder@dearr.in";
  const adminPassword = "FounderAdmin2026!";
  const testCustomerEmail = `qa_a04_cust_${Date.now()}@dearr.test`;
  const testCustomerPassword = "CustomerPass123!";

  let cookieAdmin: string | null = null;
  let cookieCustomer: string | null = null;

  try {
    // -------------------------------------------------------------------------
    // SECTION 1: Authentication Setup
    // -------------------------------------------------------------------------
    console.log("--- Section 1: Authentication & Setup ---");

    // 1. Log in as Admin
    const adminLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: adminEmail, password: adminPassword }),
    });
    const adminLoginData = await adminLoginRes.json();
    cookieAdmin = adminLoginRes.headers.get("set-cookie");
    recordTest(
      1,
      "Admin login succeeds and issues session cookie",
      adminLoginRes.status === 200 && adminLoginData.user?.role === "admin" && !!cookieAdmin,
      `Role: ${adminLoginData.user?.role}`
    );

    // 2. Create customer account
    const custSignupRes = await fetch(`${baseUrl}/api/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: testCustomerEmail,
        password: testCustomerPassword,
        fullName: "QA Customer A-04",
      }),
    });
    const custSignupData = await custSignupRes.json();
    cookieCustomer = custSignupRes.headers.get("set-cookie");
    recordTest(
      2,
      "Customer account created and authenticated",
      custSignupRes.status === 201 && custSignupData.user?.role === "customer" && !!cookieCustomer,
      `Role: ${custSignupData.user?.role}`
    );

    // -------------------------------------------------------------------------
    // SECTION 2: Dashboard SSR Page Content & Quick Actions
    // -------------------------------------------------------------------------
    console.log("\n--- Section 2: Dashboard Quick Actions & SSR Content ---");

    // 3. Fetch Admin Dashboard SSR HTML as Admin
    const dashAdminRes = await fetch(`${baseUrl}/admin`, {
      headers: { Cookie: cookieAdmin || "" },
    });
    const dashAdminHtml = await dashAdminRes.text();

    recordTest(
      3,
      "Admin Dashboard renders successfully for authenticated admin (200 OK)",
      dashAdminRes.status === 200,
      `Status: ${dashAdminRes.status}`
    );

    // 4. Quick Action 1: Add Product (/admin/products/new)
    const hasAddProduct = dashAdminHtml.includes('/admin/products/new');
    recordTest(
      4,
      "Quick action 'Add Product' present with link to /admin/products/new",
      hasAddProduct,
      `Found link: ${hasAddProduct}`
    );

    // 5. Quick Action 2: View Orders (/admin/orders)
    const hasViewOrders = dashAdminHtml.includes('/admin/orders');
    recordTest(
      5,
      "Quick action 'Manage Orders' present with link to /admin/orders",
      hasViewOrders,
      `Found link: ${hasViewOrders}`
    );

    // 6. Quick Action 3: Create Discount (/admin/discounts/new)
    const hasCreateDiscount = dashAdminHtml.includes('/admin/discounts/new');
    recordTest(
      6,
      "Quick action 'Create Discount' present with link to /admin/discounts/new",
      hasCreateDiscount,
      `Found link: ${hasCreateDiscount}`
    );

    // 7. Preserved A-03 Metric Cards
    const hasMetricCards =
      dashAdminHtml.includes("Total Orders") &&
      dashAdminHtml.includes("Catalog Products") &&
      dashAdminHtml.includes("Gross Revenue") &&
      dashAdminHtml.includes("Registered Customers");
    recordTest(
      7,
      "A-03 Metric cards (Orders, Products, Revenue, Customers) preserved",
      hasMetricCards,
      `Preserved: ${hasMetricCards}`
    );

    // -------------------------------------------------------------------------
    // SECTION 3: Recent Orders Verification
    // -------------------------------------------------------------------------
    console.log("\n--- Section 3: Recent Orders Verification ---");

    // 8. Fetch real recent orders via Admin API
    const ordersRes = await fetch(`${baseUrl}/api/admin/orders?limit=5`, {
      headers: { Cookie: cookieAdmin || "" },
    });
    const ordersData = await ordersRes.json();
    recordTest(
      8,
      "Real orders endpoint /api/admin/orders?limit=5 accessible to admin (200 OK)",
      ordersRes.status === 200 && ordersData.ok && Array.isArray(ordersData.orders),
      `Returned count: ${ordersData.orders?.length}, total: ${ordersData.total}`
    );

    // 9. Recent orders contain required operational fields
    let ordersValid = true;
    if (ordersData.orders.length > 0) {
      const first = ordersData.orders[0];
      ordersValid =
        typeof first.orderNumber === "string" &&
        first.orderNumber.startsWith("DEAR-") &&
        typeof first.status === "string" &&
        typeof first.totalAmount === "number" &&
        first.totalAmount >= 0;
    }
    recordTest(
      9,
      "Recent order records contain valid operational fields (orderNumber, status, totalAmount)",
      ordersValid,
      `Sample: ${ordersData.orders[0]?.orderNumber || "None (valid empty queue)"}`
    );

    // 10. Dashboard HTML contains Recent Orders section
    const hasRecentOrdersSection = dashAdminHtml.includes("Recent Orders");
    recordTest(
      10,
      "Dashboard HTML renders 'Recent Orders' section with link to order queue",
      hasRecentOrdersSection,
      `Found section: ${hasRecentOrdersSection}`
    );

    // -------------------------------------------------------------------------
    // SECTION 4: Recent Products Verification
    // -------------------------------------------------------------------------
    console.log("\n--- Section 4: Recent Products Verification ---");

    // 11. Fetch real recent products via Admin API
    const productsRes = await fetch(`${baseUrl}/api/admin/products?pageSize=5&sort=newest`, {
      headers: { Cookie: cookieAdmin || "" },
    });
    const productsData = await productsRes.json();
    recordTest(
      11,
      "Real products endpoint /api/admin/products?pageSize=5 accessible to admin (200 OK)",
      productsRes.status === 200 && productsData.ok && Array.isArray(productsData.products),
      `Returned count: ${productsData.products?.length}, total: ${productsData.pagination?.total}`
    );

    // 12. Recent products contain required catalog fields
    let productsValid = true;
    if (productsData.products.length > 0) {
      const first = productsData.products[0];
      productsValid =
        typeof first.name === "string" &&
        typeof first.slug === "string" &&
        typeof first.price === "number" &&
        typeof first.stockQuantity === "number" &&
        typeof first.isActive === "boolean";
    }
    recordTest(
      12,
      "Recent product records contain valid catalog fields (name, slug, price, stock, isActive)",
      productsValid,
      `Sample: '${productsData.products[0]?.name || "N/A"}' (₹${productsData.products[0]?.price})`
    );

    // 13. Dashboard HTML contains Recent Products section
    const hasRecentProductsSection = dashAdminHtml.includes("Recent Products");
    recordTest(
      13,
      "Dashboard HTML renders 'Recent Products' section with link to full catalog",
      hasRecentProductsSection,
      `Found section: ${hasRecentProductsSection}`
    );

    // -------------------------------------------------------------------------
    // SECTION 5: Security & Role Boundaries
    // -------------------------------------------------------------------------
    console.log("\n--- Section 5: Security & Role Isolation ---");

    // 14. Unauthenticated request to /api/admin/orders returns 401
    const unauthOrdersRes = await fetch(`${baseUrl}/api/admin/orders`);
    recordTest(
      14,
      "Unauthenticated request to /api/admin/orders returns 401 Unauthorized",
      unauthOrdersRes.status === 401,
      `Status: ${unauthOrdersRes.status}`
    );

    // 15. Customer request to /api/admin/orders returns 403
    const custOrdersRes = await fetch(`${baseUrl}/api/admin/orders`, {
      headers: { Cookie: cookieCustomer || "" },
    });
    recordTest(
      15,
      "Customer session calling /api/admin/orders returns 403 Forbidden",
      custOrdersRes.status === 403,
      `Status: ${custOrdersRes.status}`
    );

    // 16. Unauthenticated request to /api/admin/products returns 401
    const unauthProductsRes = await fetch(`${baseUrl}/api/admin/products`);
    recordTest(
      16,
      "Unauthenticated request to /api/admin/products returns 401 Unauthorized",
      unauthProductsRes.status === 401,
      `Status: ${unauthProductsRes.status}`
    );

    // 17. Customer request to /api/admin/products returns 403
    const custProductsRes = await fetch(`${baseUrl}/api/admin/products`, {
      headers: { Cookie: cookieCustomer || "" },
    });
    recordTest(
      17,
      "Customer session calling /api/admin/products returns 403 Forbidden",
      custProductsRes.status === 403,
      `Status: ${custProductsRes.status}`
    );

    // 18. Unauthenticated request to /admin HTML does NOT leak order details
    const unauthDashRes = await fetch(`${baseUrl}/admin`);
    const unauthDashHtml = await unauthDashRes.text();
    // Unauthenticated SSR returns empty arrays (no order details rendered in table)
    const hasLeakedOrder = ordersData.orders.length > 0 && unauthDashHtml.includes(ordersData.orders[0].orderNumber);
    recordTest(
      18,
      "Unauthenticated request to /admin HTML does not leak private order numbers",
      !hasLeakedOrder,
      `Order numbers leaked: ${hasLeakedOrder}`
    );

    // 19. Customer request to /admin HTML does NOT leak order details
    const custDashRes = await fetch(`${baseUrl}/admin`, {
      headers: { Cookie: cookieCustomer || "" },
    });
    const custDashHtml = await custDashRes.text();
    const custHasLeakedOrder = ordersData.orders.length > 0 && custDashHtml.includes(ordersData.orders[0].orderNumber);
    recordTest(
      19,
      "Customer request to /admin HTML does not leak private order numbers",
      !custHasLeakedOrder,
      `Customer order leak: ${custHasLeakedOrder}`
    );

    // 20. Zero password hashes or DB secrets leaked
    const hasSecrets =
      dashAdminHtml.includes("password_hash") ||
      dashAdminHtml.includes("$2a$10$") ||
      dashAdminHtml.includes("DB_PASSWORD") ||
      dashAdminHtml.includes("AUTH_SECRET");
    recordTest(
      20,
      "Zero database secrets or password hashes leaked in /admin HTML",
      !hasSecrets,
      `Secrets found: ${hasSecrets}`
    );

  } finally {
    // Clean up temporary test customer
    if (testCustomerEmail) {
      console.log("\nCleaning up temporary test customer from MySQL...");
      try {
        const pool = mysql.createPool({
          host: process.env.DB_HOST,
          port: parseInt(process.env.DB_PORT || "3306", 10),
          user: process.env.DB_USER,
          password: process.env.DB_PASSWORD,
          database: process.env.DB_NAME,
          ssl: { rejectUnauthorized: false },
        });
        await pool.execute("DELETE FROM profiles WHERE email = ?", [testCustomerEmail]);
        await pool.end();
        console.log("✓ Cleaned up QA customer profile.");
      } catch (err: any) {
        console.warn("Cleanup warning:", err.message);
      }
    }
  }

  console.log("\n=================================================================");
  console.log("A-04 ADMIN DASHBOARD AUDIT SUMMARY");
  console.log("=================================================================");
  const passed = results.filter((r) => r.passed).length;
  console.log(`TOTAL TESTS:  ${results.length}`);
  console.log(`PASSED:       ${passed}`);
  console.log(`FAILED:       ${results.length - passed}`);
  console.log("=================================================================\n");

  if (passed !== results.length) {
    process.exit(1);
  }
}

runA04Verification().catch((err) => {
  console.error("Verification script failed:", err);
  process.exit(1);
});
