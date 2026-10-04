import fs from "fs";
import path from "path";
import mysql from "mysql2/promise";
import crypto from "crypto";

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

async function runA03Verification() {
  console.log("=================================================================");
  console.log("Dearr V1 — Task A-03: Admin Dashboard Live Metrics Audit");
  console.log("Host:", baseUrl);
  console.log("Database:", process.env.DB_HOST, "(Hostinger MySQL)");
  console.log("=================================================================\n");

  const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || "3306", 10),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: { rejectUnauthorized: false },
  });

  const adminEmail = "founder@dearr.in";
  const adminPassword = "FounderAdmin2026!";
  const testCustomerEmail = `qa_a03_cust_${Date.now()}@dearr.test`;
  const testCustomerPassword = "CustomerPass123!";

  let cookieAdmin: string | null = null;
  let cookieCustomer: string | null = null;

  try {
    // -------------------------------------------------------------------------
    // SECTION 1: Authentication & Role Setup
    // -------------------------------------------------------------------------
    console.log("--- Section 1: Authentication & Role Setup ---");

    // 1. Admin login
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

    // 2. Customer signup
    const custSignupRes = await fetch(`${baseUrl}/api/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: testCustomerEmail,
        password: testCustomerPassword,
        fullName: "QA Customer A-03",
      }),
    });
    const custSignupData = await custSignupRes.json();
    cookieCustomer = custSignupRes.headers.get("set-cookie");
    recordTest(
      2,
      "Customer account created with customer role",
      custSignupRes.status === 201 && custSignupData.user?.role === "customer" && !!cookieCustomer,
      `Role: ${custSignupData.user?.role}`
    );

    // -------------------------------------------------------------------------
    // SECTION 2: API Metrics Authorization
    // -------------------------------------------------------------------------
    console.log("\n--- Section 2: Metrics API Authorization ---");

    // 3. Unauthenticated GET /api/admin/metrics returns 401
    const unauthMetricsRes = await fetch(`${baseUrl}/api/admin/metrics`);
    recordTest(
      3,
      "Unauthenticated GET /api/admin/metrics returns 401 Unauthorized",
      unauthMetricsRes.status === 401,
      `Status: ${unauthMetricsRes.status}`
    );

    // 4. Customer GET /api/admin/metrics returns 403
    const custMetricsRes = await fetch(`${baseUrl}/api/admin/metrics`, {
      headers: { Cookie: cookieCustomer || "" },
    });
    recordTest(
      4,
      "Customer session GET /api/admin/metrics returns 403 Forbidden",
      custMetricsRes.status === 403,
      `Status: ${custMetricsRes.status}`
    );

    // 5. Admin GET /api/admin/metrics returns 200
    const adminMetricsRes = await fetch(`${baseUrl}/api/admin/metrics`, {
      headers: { Cookie: cookieAdmin || "" },
    });
    const adminMetricsData = await adminMetricsRes.json();
    recordTest(
      5,
      "Admin session GET /api/admin/metrics returns 200 OK with metrics object",
      adminMetricsRes.status === 200 && adminMetricsData.ok && !!adminMetricsData.metrics,
      `Status: ${adminMetricsRes.status}`
    );

    // -------------------------------------------------------------------------
    // SECTION 3: Database Ground Truth Cross-Check
    // -------------------------------------------------------------------------
    console.log("\n--- Section 3: Database Ground Truth Validation ---");

    const [dbProducts] = await pool.query<any[]>(
      "SELECT COUNT(*) AS total, COALESCE(SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END), 0) AS active FROM products"
    );
    const expectedTotalProducts = Number(dbProducts[0].total);
    const expectedActiveProducts = Number(dbProducts[0].active);

    const [dbOrders] = await pool.query<any[]>(
      `SELECT 
         COUNT(*) AS total,
         COALESCE(SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END), 0) AS pending,
         COALESCE(SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END), 0) AS delivered,
         COALESCE(SUM(CASE WHEN payment_status = 'paid' THEN total_amount ELSE 0 END), 0) AS revenue
       FROM orders`
    );
    const expectedTotalOrders = Number(dbOrders[0].total);
    const expectedPendingOrders = Number(dbOrders[0].pending);
    const expectedGrossRevenue = Number(dbOrders[0].revenue);

    const [dbDiscounts] = await pool.query<any[]>(
      `SELECT COUNT(*) AS active_discounts 
       FROM discounts 
       WHERE is_active = 1 
         AND start_at <= NOW() 
         AND (end_at IS NULL OR end_at > NOW())`
    );
    const expectedActiveDiscounts = Number(dbDiscounts[0].active_discounts);

    const [dbCustomers] = await pool.query<any[]>(
      "SELECT COUNT(*) AS customers FROM profiles WHERE role = 'customer'"
    );
    const expectedCustomers = Number(dbCustomers[0].customers);

    const apiMetrics = adminMetricsData.metrics;

    // 6. Cross-check Product counts
    const productsMatch =
      apiMetrics.totalProducts === expectedTotalProducts &&
      apiMetrics.activeProducts === expectedActiveProducts;
    recordTest(
      6,
      "Live Product count matches MySQL exactly",
      productsMatch,
      `API: ${apiMetrics.totalProducts} (active: ${apiMetrics.activeProducts}), DB: ${expectedTotalProducts} (active: ${expectedActiveProducts})`
    );

    // 7. Cross-check Order counts
    const ordersMatch =
      apiMetrics.totalOrders === expectedTotalOrders &&
      apiMetrics.pendingOrders === expectedPendingOrders;
    recordTest(
      7,
      "Live Order count matches MySQL exactly",
      ordersMatch,
      `API: ${apiMetrics.totalOrders} (pending: ${apiMetrics.pendingOrders}), DB: ${expectedTotalOrders} (pending: ${expectedPendingOrders})`
    );

    // 8. Cross-check Active Discounts count
    const discountsMatch = apiMetrics.activeDiscounts === expectedActiveDiscounts;
    recordTest(
      8,
      "Live Active Discounts count matches MySQL exactly",
      discountsMatch,
      `API: ${apiMetrics.activeDiscounts}, DB: ${expectedActiveDiscounts}`
    );

    // 9. Cross-check Revenue
    const revenueMatch = apiMetrics.grossRevenue === expectedGrossRevenue;
    recordTest(
      9,
      "Live Gross Revenue matches MySQL paid orders exactly",
      revenueMatch,
      `API: ₹${apiMetrics.grossRevenue}, DB: ₹${expectedGrossRevenue}`
    );

    // 10. Cross-check Registered Customers
    const customersMatch = apiMetrics.registeredCustomers === expectedCustomers;
    recordTest(
      10,
      "Live Registered Customers count matches MySQL profiles exactly",
      customersMatch,
      `API: ${apiMetrics.registeredCustomers}, DB: ${expectedCustomers}`
    );

    // -------------------------------------------------------------------------
    // SECTION 4: Dashboard SSR HTML Verification
    // -------------------------------------------------------------------------
    console.log("\n--- Section 4: Dashboard SSR HTML Verification ---");

    const dashRes = await fetch(`${baseUrl}/admin`, {
      headers: { Cookie: cookieAdmin || "" },
    });
    const dashHtml = await dashRes.text();

    recordTest(
      11,
      "Admin Dashboard SSR loads successfully (200 OK)",
      dashRes.status === 200,
      `Status: ${dashRes.status}`
    );

    const idx = dashHtml.indexOf("Catalog Products");
    console.log("DEBUG HTML SNIPPET:\n", dashHtml.slice(idx, idx + 400));
    // 12. Check live product count in SSR HTML
    const htmlHasProducts =
      dashHtml.includes("Catalog Products") &&
      dashHtml.includes(`${expectedActiveProducts} active in store`) &&
      new RegExp(`Catalog Products[\\s\\S]{1,1000}?${expectedTotalProducts}[\\s\\S]{1,500}?active in store`).test(dashHtml);
    recordTest(
      12,
      "Dashboard HTML renders live Catalog Products count from MySQL",
      htmlHasProducts,
      `Rendered count: ${expectedTotalProducts}`
    );

    // 13. Check live order count in SSR HTML
    const htmlHasOrders =
      dashHtml.includes("Total Orders") &&
      new RegExp(`Total Orders[\\s\\S]{1,1000}?${expectedTotalOrders}[\\s\\S]{1,500}?pending`).test(dashHtml);
    recordTest(
      13,
      "Dashboard HTML renders live Total Orders count from MySQL",
      htmlHasOrders,
      `Rendered count: ${expectedTotalOrders}`
    );

    // 14. Check live active discounts count in SSR HTML
    const htmlHasDiscounts =
      dashHtml.includes("Active Discounts") &&
      new RegExp(`Active Discounts[\\s\\S]{1,1000}?${expectedActiveDiscounts}[\\s\\S]{1,500}?Live promotional offers`).test(dashHtml);
    recordTest(
      14,
      "Dashboard HTML renders live Active Discounts count from MySQL",
      htmlHasDiscounts,
      `Rendered count: ${expectedActiveDiscounts}`
    );

    // 15. Check live revenue in SSR HTML
    const formattedRev = `₹${expectedGrossRevenue.toLocaleString("en-IN")}`;
    const htmlHasRevenue =
      dashHtml.includes("Gross Revenue") &&
      dashHtml.includes(formattedRev);
    recordTest(
      15,
      "Dashboard HTML renders live Gross Revenue from MySQL",
      htmlHasRevenue,
      `Rendered revenue: ${formattedRev}`
    );

    // 16. Check live customers in SSR HTML
    const htmlHasCustomers =
      dashHtml.includes("Customers") &&
      new RegExp(`Customers[\\s\\S]{1,1000}?${expectedCustomers}[\\s\\S]{1,500}?Registered accounts`).test(dashHtml);
    recordTest(
      16,
      "Dashboard HTML renders live Customers count from MySQL",
      htmlHasCustomers,
      `Rendered customers: ${expectedCustomers}`
    );

    // 17. Check that previous hardcoded mock numbers are eliminated
    // Previous static values: 124 (orders), 36 (products), ₹84,500 (rev), 218 (customers)
    const hasStaticMockValues =
      dashHtml.includes(">124<") ||
      dashHtml.includes(">36<") ||
      dashHtml.includes("84,500") ||
      dashHtml.includes(">218<");
    recordTest(
      17,
      "Previous static/mock metric values (124, 36, 84500, 218) are completely eliminated",
      !hasStaticMockValues,
      `Mock values found: ${hasStaticMockValues}`
    );

    // -------------------------------------------------------------------------
    // SECTION 5: A-04 Feature Preservation Check
    // -------------------------------------------------------------------------
    console.log("\n--- Section 5: A-04 Feature Preservation ---");

    const hasQuickActions =
      dashHtml.includes("/admin/products/new") &&
      dashHtml.includes("/admin/orders") &&
      dashHtml.includes("/admin/discounts/new");
    recordTest(
      18,
      "A-04 Quick actions (Add Product, Manage Orders, Create Discount) fully preserved",
      hasQuickActions,
      `Quick actions preserved: ${hasQuickActions}`
    );

    const hasRecentSections =
      dashHtml.includes("Recent Orders") &&
      dashHtml.includes("Recent Products");
    recordTest(
      19,
      "A-04 Recent Orders and Recent Products panels fully preserved",
      hasRecentSections,
      `Recent sections preserved: ${hasRecentSections}`
    );

    // -------------------------------------------------------------------------
    // SECTION 6: Controlled Live Mutation & Refresh Test
    // -------------------------------------------------------------------------
    console.log("\n--- Section 6: Dynamic Metric Update on Refresh ---");

    // Add a temporary product directly to MySQL to test dynamic count update
    const tempProdId = crypto.randomUUID();
    const tempSlug = `qa-a03-temp-${Date.now()}`;
    await pool.execute(
      `INSERT INTO products (id, name, slug, description, price, stock_quantity, is_active, is_featured)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [tempProdId, "QA Temp Metric Test Item", tempSlug, "Temporary product for metric refresh test", 999, 10, 1, 0]
    );

    // Fetch metrics again
    const postAddRes = await fetch(`${baseUrl}/api/admin/metrics`, {
      headers: { Cookie: cookieAdmin || "" },
    });
    const postAddData = await postAddRes.json();
    const updatedProductsCount = postAddData.metrics.totalProducts;
    const incrementedCorrectly = updatedProductsCount === expectedTotalProducts + 1;

    // Clean up temporary product
    await pool.execute("DELETE FROM products WHERE id = ?", [tempProdId]);

    recordTest(
      20,
      "Metrics dynamically increment upon catalog addition and reflect on refresh",
      incrementedCorrectly,
      `Before: ${expectedTotalProducts}, After add: ${updatedProductsCount}, Expected: ${expectedTotalProducts + 1}`
    );

  } finally {
    // Clean up temporary test customer
    if (testCustomerEmail) {
      console.log("\nCleaning up QA customer record from MySQL...");
      try {
        await pool.execute("DELETE FROM profiles WHERE email = ?", [testCustomerEmail]);
        console.log("✓ Cleaned up QA customer profile.");
      } catch (err: any) {
        console.warn("Cleanup warning:", err.message);
      }
    }
    await pool.end();
  }

  console.log("\n=================================================================");
  console.log("A-03 ADMIN DASHBOARD METRICS AUDIT SUMMARY");
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

runA03Verification().catch((err) => {
  console.error("Verification script failed:", err);
  process.exit(1);
});
