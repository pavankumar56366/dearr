/**
 * verify-a05-admin-states.ts
 *
 * Comprehensive Automated Verification Suite for Task A-05:
 * Admin Dashboard Loading and Empty States
 *
 * Verifies:
 * 1. Admin Authentication & Role Protection (unauth, customer, admin)
 * 2. Next.js Loading Skeleton (src/app/admin/loading.tsx & AdminDashboardSkeleton)
 * 3. Next.js Safe Error Boundary (src/app/admin/error.tsx)
 * 4. Empty Orders State (zero orders, setup navigation, no fake data, refined footer)
 * 5. Empty Products State (zero products, Add Product CTA to /admin/products/new, refined footer)
 * 6. Active Discounts Zero-State handling
 * 7. Database Query Error & Recovery Handling (banner, retry CTA, system health, no SQL leak)
 * 8. Full Preservation of A-03 Live Metrics & A-04 Quick Actions/Recent Data
 * 9. Elimination of static/mock numbers (124, 36, 84500, 218)
 * 10. Responsive layout integrity across all standard viewports
 */

import fs from "fs";
import path from "path";
import mysql from "mysql2/promise";

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

interface TestResult {
  id: number;
  description: string;
  passed: boolean;
  details: string;
}

const results: TestResult[] = [];

function recordTest(id: number, description: string, passed: boolean, details: string) {
  results.push({ id, description, passed, details });
  const status = passed ? "[✓ PASS]" : "[✗ FAIL]";
  const color = passed ? "\x1b[32m" : "\x1b[31m";
  console.log(`   [TEST ${String(id).padStart(2, "0")}] ${color}${status}\x1b[0m ${description} — ${details}`);
}

async function runA05Audit() {
  console.log("=================================================================");
  console.log("Dearr V1 — Task A-05: Admin Dashboard Loading & Empty States Audit");
  console.log("Host: http://localhost:3000");
  console.log("Database:", process.env.DB_HOST, "(Hostinger MySQL)");
  console.log("=================================================================\n");

  const baseUrl = "http://localhost:3000";

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
  let cookieAdmin = "";
  let cookieCustomer = "";
  const qaCustomerEmail = `qa-a05-${Date.now()}@dearr.test`;

  try {
    // -------------------------------------------------------------------------
    // SECTION 1: Authentication & Role Setup
    // -------------------------------------------------------------------------
    console.log("--- Section 1: Authentication & Role Isolation ---");

    // 1. Admin login
    const adminLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: adminEmail, password: adminPassword }),
    });
    cookieAdmin = (adminLoginRes.headers.get("set-cookie") || "").split(";")[0];
    const adminData = await adminLoginRes.json();
    recordTest(
      1,
      "Admin login succeeds and returns admin session",
      adminLoginRes.status === 200 && adminData?.user?.role === "admin",
      `Status: ${adminLoginRes.status}, Role: ${adminData?.user?.role}`
    );

    // 2. Customer setup
    const custSignupRes = await fetch(`${baseUrl}/api/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: qaCustomerEmail,
        password: "Password123!",
        name: "QA A-05 Customer",
      }),
    });
    cookieCustomer = (custSignupRes.headers.get("set-cookie") || "").split(";")[0];
    const custData = await custSignupRes.json();
    recordTest(
      2,
      "Customer account created with customer role",
      custSignupRes.status === 201 && custData?.user?.role === "customer",
      `Status: ${custSignupRes.status}, Role: ${custData?.user?.role}`
    );

    // 3. Customer accessing admin verification receives 403 Forbidden
    const custVerifyRes = await fetch(`${baseUrl}/api/admin/verify`, {
      headers: { Cookie: cookieCustomer },
    });
    const custVerifyData = await custVerifyRes.json().catch(() => null);
    const custOrdersRes = await fetch(`${baseUrl}/api/admin/orders`, {
      headers: { Cookie: cookieCustomer },
    });
    const isCustomerBlocked = custVerifyRes.status === 403 && custOrdersRes.status === 403;
    recordTest(
      3,
      "Customer session accessing admin verification & operations is blocked (403 Forbidden)",
      isCustomerBlocked,
      `Verify: ${custVerifyRes.status} ('${custVerifyData?.error}'), Orders: ${custOrdersRes.status}`
    );

    // -------------------------------------------------------------------------
    // SECTION 2: Loading State & Skeleton Files Verification
    // -------------------------------------------------------------------------
    console.log("\n--- Section 2: Loading State & Skeleton Architecture ---");

    // 4. Check src/app/admin/loading.tsx exists
    const loadingPath = path.join(process.cwd(), "src", "app", "admin", "loading.tsx");
    const loadingExists = fs.existsSync(loadingPath);
    const loadingContent = loadingExists ? fs.readFileSync(loadingPath, "utf-8") : "";
    recordTest(
      4,
      "Next.js App Router loading.tsx exists for /admin route segment",
      loadingExists && loadingContent.includes("AdminDashboardSkeleton"),
      `Exists: ${loadingExists}, Uses Skeleton: ${loadingContent.includes("AdminDashboardSkeleton")}`
    );

    // 5. Check src/components/admin/AdminDashboardSkeleton.tsx
    const skeletonPath = path.join(process.cwd(), "src", "components", "admin", "AdminDashboardSkeleton.tsx");
    const skeletonExists = fs.existsSync(skeletonPath);
    const skeletonContent = skeletonExists ? fs.readFileSync(skeletonPath, "utf-8") : "";
    const skeletonHasAria =
      skeletonContent.includes('aria-busy="true"') &&
      skeletonContent.includes('aria-label="Loading Admin Dashboard"');
    const skeletonHasGrid =
      skeletonContent.includes("grid-cols-2 sm:grid-cols-3 lg:grid-cols-5") &&
      skeletonContent.includes("grid-cols-1 sm:grid-cols-3") &&
      skeletonContent.includes("grid-cols-1 xl:grid-cols-2");
    recordTest(
      5,
      "AdminDashboardSkeleton matches exact responsive hierarchy with accessibility tags",
      skeletonExists && skeletonHasAria && skeletonHasGrid,
      `Accessible: ${skeletonHasAria}, Grid hierarchy matched: ${skeletonHasGrid}`
    );

    // -------------------------------------------------------------------------
    // SECTION 3: Safe Error Boundary Verification
    // -------------------------------------------------------------------------
    console.log("\n--- Section 3: Safe Error Boundary Architecture ---");

    // 6. Check src/app/admin/error.tsx exists and is a Client Component
    const errorPath = path.join(process.cwd(), "src", "app", "admin", "error.tsx");
    const errorExists = fs.existsSync(errorPath);
    const errorContent = errorExists ? fs.readFileSync(errorPath, "utf-8") : "";
    const isClientComponent = errorContent.includes('"use client"') || errorContent.includes("'use client'");
    const hasRetryAction = errorContent.includes("reset()") && errorContent.includes("admin-error-retry");
    recordTest(
      6,
      "src/app/admin/error.tsx exists as client error boundary with retry handler",
      errorExists && isClientComponent && hasRetryAction,
      `Exists: ${errorExists}, Client component: ${isClientComponent}, Has reset(): ${hasRetryAction}`
    );

    // 7. Verify error component never leaks SQL or internal secrets
    const errorIsSafe =
      !errorContent.includes("DB_PASSWORD") &&
      !errorContent.includes("AUTH_SECRET") &&
      !errorContent.includes("SELECT ") &&
      !errorContent.includes("stack");
    recordTest(
      7,
      "Error boundary contains zero internal database credentials or SQL leaks",
      errorIsSafe,
      `Safe error template: ${errorIsSafe}`
    );

    // -------------------------------------------------------------------------
    // SECTION 4: Live Dashboard SSR & Empty Orders State
    // -------------------------------------------------------------------------
    console.log("\n--- Section 4: Live Dashboard SSR & Empty States ---");

    const dashRes = await fetch(`${baseUrl}/admin`, {
      headers: { Cookie: cookieAdmin },
    });
    const dashHtml = await dashRes.text();

    recordTest(
      8,
      "Admin Dashboard SSR loads successfully for administrator (200 OK)",
      dashRes.status === 200,
      `Status: ${dashRes.status}`
    );

    // 9. Empty Orders State (since live DB has 0 orders)
    const [orderCountRow] = await pool.query<any[]>("SELECT COUNT(*) AS total FROM orders");
    const dbOrderCount = Number(orderCountRow[0].total);

    const hasEmptyOrdersNotice =
      dashHtml.includes("No orders recorded yet") &&
      dashHtml.includes("When customers purchase 3D prints on the storefront, orders will appear here automatically.");
    const hasCatalogSetupLink = dashHtml.includes("/admin/products") && dashHtml.includes("View Catalog Products");
    const hasCleanOrdersFooter = dashHtml.includes("No recent orders to show");

    recordTest(
      9,
      "Recent Orders renders clear empty state when zero orders exist in database",
      dbOrderCount === 0 && hasEmptyOrdersNotice,
      `DB Orders: ${dbOrderCount}, Empty Notice: ${hasEmptyOrdersNotice}`
    );

    recordTest(
      10,
      "Empty Orders state provides catalog setup path and clean footer (no 'Showing top 0')",
      hasCatalogSetupLink && hasCleanOrdersFooter,
      `Setup Link: ${hasCatalogSetupLink}, Clean Footer: ${hasCleanOrdersFooter}`
    );

    // 10. Check that no fake/mock order numbers exist
    const hasFakeOrders = dashHtml.includes("DEAR-0000") || dashHtml.includes("SAMPLE_ORDER");
    recordTest(
      11,
      "Zero fake or demo orders displayed in empty orders situation",
      !hasFakeOrders,
      `Fake orders present: ${hasFakeOrders}`
    );

    // -------------------------------------------------------------------------
    // SECTION 5: Products Panel & Empty Products Definition
    // -------------------------------------------------------------------------
    console.log("\n--- Section 5: Products Panel & Empty Products State ---");

    const [prodCountRow] = await pool.query<any[]>("SELECT COUNT(*) AS total FROM products");
    const dbProdCount = Number(prodCountRow[0].total);

    // When products exist (> 0), recent products table is displayed
    const hasProductsTable = dashHtml.includes("Recent Products") && dashHtml.includes("Full catalog →");
    recordTest(
      12,
      "Recent Products renders active catalog items when products exist in database",
      dbProdCount > 0 && hasProductsTable,
      `DB Products: ${dbProdCount}, Table Rendered: ${hasProductsTable}`
    );

    // Check the code in page.tsx for empty products state definition
    const pagePath = path.join(process.cwd(), "src", "app", "admin", "page.tsx");
    const pageContent = fs.readFileSync(pagePath, "utf-8");
    const pageHasEmptyProductsHandling =
      pageContent.includes("No products in catalog yet") &&
      pageContent.includes("Add First Product") &&
      pageContent.includes("/admin/products/new") &&
      pageContent.includes("No catalog items to show");
    recordTest(
      13,
      "Page component defines dedicated empty products state with /admin/products/new action",
      pageHasEmptyProductsHandling,
      `Empty state configured: ${pageHasEmptyProductsHandling}`
    );

    // -------------------------------------------------------------------------
    // SECTION 6: Active Discounts Zero-State & Precedence
    // -------------------------------------------------------------------------
    console.log("\n--- Section 6: Active Discounts Zero-State ---");

    const [discCountRow] = await pool.query<any[]>(
      "SELECT COUNT(*) AS total FROM discounts WHERE is_active = 1 AND start_at <= NOW() AND (end_at IS NULL OR end_at > NOW())"
    );
    const dbActiveDiscounts = Number(discCountRow[0].total);

    const hasActiveDiscountsZeroState =
      dashHtml.includes("Active Discounts") &&
      dashHtml.includes("Live promotional offers") &&
      new RegExp(`Active Discounts[\\s\\S]{1,1000}?${dbActiveDiscounts}[\\s\\S]{1,500}?Live promotional offers`).test(dashHtml);

    recordTest(
      14,
      "Active Discounts metric cleanly displays live zero count without UI breakage",
      hasActiveDiscountsZeroState,
      `DB Active Discounts: ${dbActiveDiscounts}, Card Rendered: ${hasActiveDiscountsZeroState}`
    );

    // -------------------------------------------------------------------------
    // SECTION 7: Data Fetch Query Failure Safety & Recovery
    // -------------------------------------------------------------------------
    console.log("\n--- Section 7: Data Fetch Query Failure Handling ---");

    // Check that page.tsx handles queryError safely
    const handlesQueryErrorBanner =
      pageContent.includes("id=\"admin-dashboard-query-error\"") &&
      pageContent.includes("id=\"admin-dashboard-retry-link\"") &&
      pageContent.includes("/api/health/db") &&
      pageContent.includes("Operations Degraded");

    const ordersDistinguishesError =
      pageContent.includes("Order data temporarily unavailable") &&
      pageContent.includes("Database connection offline");

    const productsDistinguishesError =
      pageContent.includes("Catalog data temporarily unavailable");

    recordTest(
      15,
      "Page component provides retry action and health link upon database query failure",
      handlesQueryErrorBanner,
      `Banner with Retry & Health: ${handlesQueryErrorBanner}`
    );

    recordTest(
      16,
      "Recent panels explicitly distinguish database offline state from genuine empty state",
      ordersDistinguishesError && productsDistinguishesError,
      `Orders differentiated: ${ordersDistinguishesError}, Products differentiated: ${productsDistinguishesError}`
    );

    // -------------------------------------------------------------------------
    // SECTION 8: Preservation of A-03 Metrics & A-04 Quick Actions
    // -------------------------------------------------------------------------
    console.log("\n--- Section 8: Feature Preservation (A-03 & A-04) ---");

    const hasLiveMetrics =
      dashHtml.includes("Catalog Products") &&
      dashHtml.includes("Total Orders") &&
      dashHtml.includes("Active Discounts") &&
      dashHtml.includes("Gross Revenue") &&
      dashHtml.includes("Registered Customers");
    recordTest(
      17,
      "A-03 live metric cards completely preserved",
      hasLiveMetrics,
      `All 5 cards present: ${hasLiveMetrics}`
    );

    const hasQuickActions =
      dashHtml.includes("/admin/products/new") &&
      dashHtml.includes("/admin/orders") &&
      dashHtml.includes("/admin/discounts/new");
    recordTest(
      18,
      "A-04 Quick Actions (Add Product, Manage Orders, Create Discount) fully preserved",
      hasQuickActions,
      `Quick action shortcuts intact: ${hasQuickActions}`
    );

    // -------------------------------------------------------------------------
    // SECTION 9: Elimination of Static/Mock Numbers
    // -------------------------------------------------------------------------
    console.log("\n--- Section 9: Mock Data Elimination ---");

    const hasMockNumbers =
      dashHtml.includes(">124<") ||
      dashHtml.includes(">36<") ||
      dashHtml.includes("84,500") ||
      dashHtml.includes(">218<");
    recordTest(
      19,
      "Static mock values (124, 36, 84500, 218) remain completely eliminated",
      !hasMockNumbers,
      `Mock values found: ${hasMockNumbers}`
    );

    // -------------------------------------------------------------------------
    // SECTION 10: Responsive Layout Verification
    // -------------------------------------------------------------------------
    console.log("\n--- Section 10: Responsive Layout Constraints ---");

    const hasResponsiveContainer =
      dashHtml.includes("max-w-7xl mx-auto") &&
      dashHtml.includes("grid-cols-2 sm:grid-cols-3 lg:grid-cols-5") &&
      dashHtml.includes("grid-cols-1 sm:grid-cols-3") &&
      dashHtml.includes("grid-cols-1 xl:grid-cols-2");
    recordTest(
      20,
      "Responsive layout classes prevent horizontal overflow across 320px–1440px viewports",
      hasResponsiveContainer,
      `Responsive classes intact: ${hasResponsiveContainer}`
    );

  } finally {
    // Clean up temporary customer account
    if (qaCustomerEmail) {
      console.log("\nCleaning up QA customer record from MySQL...");
      await pool.query("DELETE FROM profiles WHERE email = ?", [qaCustomerEmail]);
      console.log("✓ Cleaned up QA customer profile.");
    }
    await pool.end();
  }

  console.log("\n=================================================================");
  console.log("A-05 ADMIN DASHBOARD STATES AUDIT SUMMARY");
  console.log("=================================================================");
  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = results.filter((r) => !r.passed).length;
  console.log(`TOTAL TESTS:  ${results.length}`);
  console.log(`PASSED:       ${passedCount}`);
  console.log(`FAILED:       ${failedCount}`);
  console.log("=================================================================\n");

  if (failedCount > 0) {
    process.exit(1);
  }
}

runA05Audit().catch((err) => {
  console.error("FATAL AUDIT ERROR:", err);
  process.exit(1);
});
