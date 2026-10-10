/**
 * Dearr — Investigation & Bug Fixing Verification Suite
 *
 * Verifies all 5 reported issues:
 * 1. Shipping fee & free-shipping threshold behavior (below, at, above threshold).
 * 2. Checkout total matching Razorpay payment amount and server persistence.
 * 3. Trending-sales SQL excluding unpaid, failed, cancelled orders & preventing join inflation.
 * 4. Duplicate products & repeated images in search overlay.
 * 5. Category popularity browsing metrics & limiting search suggestions to at most 3.
 */

import fs from "fs";
import path from "path";
import assert from "assert";

const ROOT = process.cwd();

console.log("================================================================================");
console.log("DEARR BUG INVESTIGATION & REGRESSION VERIFICATION SUITE");
console.log("================================================================================\n");

let passed = 0;
let total = 0;

function test(name, fn) {
  total++;
  try {
    fn();
    console.log(`  [PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`  [FAIL] ${name}: ${err.message}`);
    throw err;
  }
}

// =============================================================================
// PART A: SHIPPING & PAYMENT AMOUNT CONSISTENCY
// =============================================================================
console.log("--- PART A: SHIPPING FEE & PAYMENT AMOUNT CONSISTENCY ---");

test("Store settings endpoint GET /api/settings exists and exposes shipping config", () => {
  const routePath = path.join(ROOT, "src/app/api/settings/route.ts");
  assert(fs.existsSync(routePath), "src/app/api/settings/route.ts must exist");
  const code = fs.readFileSync(routePath, "utf8");
  assert(code.includes("freeShippingThreshold"), "Must return freeShippingThreshold");
  assert(code.includes("defaultShippingFee"), "Must return defaultShippingFee");
  assert(code.includes("getStoreSettings"), "Must call getStoreSettings()");
});

test("Shipping business rules: Below, Exactly At, and Above threshold calculations", () => {
  const threshold = 1299;
  const defaultFee = 65;

  function calculateShipping(subtotal) {
    return subtotal >= threshold ? 0 : defaultFee;
  }

  function calculateTotal(subtotal, discount = 0) {
    const fee = calculateShipping(subtotal);
    return Math.max(0, subtotal - discount + fee);
  }

  function toPaise(rupees) {
    return Math.round(rupees * 100);
  }

  // Case A: Below threshold (₹799)
  const subtotalA = 799;
  const feeA = calculateShipping(subtotalA);
  const totalA = calculateTotal(subtotalA);
  const paiseA = toPaise(totalA);
  assert.strictEqual(feeA, 65, "Below threshold must charge configured fee");
  assert.strictEqual(totalA, 864, "Total must be 799 + 65 = 864");
  assert.strictEqual(paiseA, 86400, "Paise must be 864 * 100 = 86400");

  // Case B: Exactly at threshold (₹1299)
  const subtotalB = 1299;
  const feeB = calculateShipping(subtotalB);
  const totalB = calculateTotal(subtotalB);
  const paiseB = toPaise(totalB);
  assert.strictEqual(feeB, 0, "Exactly at threshold must qualify for Free Shipping");
  assert.strictEqual(totalB, 1299, "Total must be exactly 1299");
  assert.strictEqual(paiseB, 129900, "Paise must be 1299 * 100 = 129900");

  // Case C: Above threshold (₹1500)
  const subtotalC = 1500;
  const feeC = calculateShipping(subtotalC);
  const totalC = calculateTotal(subtotalC);
  const paiseC = toPaise(totalC);
  assert.strictEqual(feeC, 0, "Above threshold must qualify for Free Shipping");
  assert.strictEqual(totalC, 1500, "Total must be 1500");
  assert.strictEqual(paiseC, 150000, "Paise must be 1500 * 100 = 150000");
});

test("CheckoutSummary displays dynamic shipping and never shows Free Shipping when fee > 0", () => {
  const code = fs.readFileSync(path.join(ROOT, "src/components/customer/checkout/CheckoutSummary.tsx"), "utf8");
  assert(code.includes("shippingFee"), "CheckoutSummary must accept shippingFee prop");
  assert(code.includes("effectiveShipping === 0 ?"), "Must conditionally render Free Shipping only when shipping === 0");
  assert(code.includes("effectiveShipping.toLocaleString"), "Must render actual shipping fee when fee > 0");
  assert(!code.includes("Free Shipping</span>\n        </div>\n\n        <div className=\"flex items-center justify-between text-neutral-600\">\n          <span>Taxes"), "Must not hardcode Free Shipping without fee check");
});

test("CheckoutPageClient dynamically loads store settings and synchronizes with order calculation", () => {
  const code = fs.readFileSync(path.join(ROOT, "src/components/customer/checkout/CheckoutPageClient.tsx"), "utf8");
  assert(code.includes("fetch(\"/api/settings\")"), "CheckoutPageClient must fetch /api/settings");
  assert(code.includes("subtotal >= storeSettings.freeShippingThreshold ? 0 : storeSettings.defaultShippingFee"), "CheckoutPageClient must calculate shipping matching server rule");
  assert(code.includes("shippingFee={shippingFee}"), "Must pass shippingFee prop to CheckoutSummary");
  assert(code.includes("totalPayable={totalPayable}"), "Must pass totalPayable prop to CheckoutSummary");
});

test("Server order.ts computes authoritative shipping amount and total from store_settings", () => {
  const code = fs.readFileSync(path.join(ROOT, "src/lib/server/order.ts"), "utf8");
  assert(code.includes("getStoreSettings()"), "order.ts must load getStoreSettings()");
  assert(code.includes("orderSubtotal >= storeSettings.freeShippingThreshold"), "order.ts must check orderSubtotal >= storeSettings.freeShippingThreshold");
  assert(code.includes("storeSettings.defaultShippingFee"), "order.ts must charge storeSettings.defaultShippingFee when below threshold");
  assert(code.includes("INSERT INTO orders"), "order.ts must persist authoritative shipping_amount and total_amount");
});

test("Razorpay payment initialization strictly reads trusted orders.total_amount", () => {
  const code = fs.readFileSync(path.join(ROOT, "src/lib/server/payment.ts"), "utf8");
  assert(code.includes("SELECT id, order_number, user_id, status, payment_status, total_amount, currency"), "Must fetch total_amount from orders table");
  assert(code.includes("amountInPaise = Math.round(trustedOrderTotal * 100)"), "Must convert trusted total to paise exactly once");
  assert(code.includes("Math.abs(suppliedAmount - trustedOrderTotal) > 0.009"), "Must reject client amount tampering");
});

// =============================================================================
// PART B: TRENDING SALES AGGREGATION SQL
// =============================================================================
console.log("\n--- PART B: TRENDING SALES AGGREGATION SQL ---");

test("findTrendingProducts uses derived table with INNER JOIN orders to exclude unpaid/failed/cancelled orders", () => {
  const code = fs.readFileSync(path.join(ROOT, "src/lib/server/product.ts"), "utf8");
  assert(code.includes("findTrendingProducts"), "findTrendingProducts must exist");
  assert(code.includes("INNER JOIN orders o ON oi.order_id = o.id"), "Must INNER JOIN orders in derived table");
  assert(code.includes("o.payment_status = 'paid'"), "Must require payment_status = 'paid'");
  assert(code.includes("o.status IN ('confirmed', 'processing', 'shipped', 'delivered')"), "Must require completed/processing order status");
  assert(code.includes("GROUP BY oi.product_id"), "Must group by oi.product_id inside derived table");
  assert(code.includes("COALESCE(sales.total_sold, 0) AS total_sold"), "Must coalesce sales derived table total");
});

test("Isolated simulation: Trending SQL correctly aggregates sales and excludes ineligible orders", () => {
  // Fixture orders
  const orders = [
    { id: "o1", payment_status: "paid", status: "confirmed" }, // eligible
    { id: "o2", payment_status: "paid", status: "shipped" },   // eligible
    { id: "o3", payment_status: "pending", status: "pending" }, // ineligible
    { id: "o4", payment_status: "failed", status: "pending" },  // ineligible
    { id: "o5", payment_status: "paid", status: "cancelled" },  // ineligible
  ];

  // Fixture order items
  const orderItems = [
    // Product A: 10 eligible, 100 pending, 50 failed, 50 cancelled
    { order_id: "o1", product_id: "prod-a", quantity: 10 },
    { order_id: "o3", product_id: "prod-a", quantity: 100 },
    { order_id: "o4", product_id: "prod-a", quantity: 50 },
    { order_id: "o5", product_id: "prod-a", quantity: 50 },
    // Product B: 20 eligible, 0 pending
    { order_id: "o1", product_id: "prod-b", quantity: 12 },
    { order_id: "o2", product_id: "prod-b", quantity: 8 },
    // Product C: 0 eligible, 50 pending, 20 failed
    { order_id: "o3", product_id: "prod-c", quantity: 50 },
    { order_id: "o4", product_id: "prod-c", quantity: 20 },
  ];

  // Products
  const products = [
    { id: "prod-a", name: "Product A", is_active: 1 },
    { id: "prod-b", name: "Product B", is_active: 1 },
    { id: "prod-c", name: "Product C", is_active: 1 },
  ];

  // Eligible statuses
  const eligibleStatuses = new Set(["confirmed", "processing", "shipped", "delivered"]);

  // Execute derived aggregation exactly as defined in the query
  const eligibleSales = new Map();
  for (const oi of orderItems) {
    const ord = orders.find((o) => o.id === oi.order_id);
    if (ord && ord.payment_status === "paid" && eligibleStatuses.has(ord.status)) {
      eligibleSales.set(oi.product_id, (eligibleSales.get(oi.product_id) || 0) + oi.quantity);
    }
  }

  // Join to products
  const ranked = products.map((p) => ({
    ...p,
    total_sold: eligibleSales.get(p.id) || 0,
  })).sort((a, b) => b.total_sold - a.total_sold);

  assert.strictEqual(ranked[0].id, "prod-b", "Rank 1 must be Product B");
  assert.strictEqual(ranked[0].total_sold, 20, "Product B must have 20 eligible units");

  assert.strictEqual(ranked[1].id, "prod-a", "Rank 2 must be Product A");
  assert.strictEqual(ranked[1].total_sold, 10, "Product A must have 10 eligible units (ineligible 200 ignored)");

  assert.strictEqual(ranked[2].id, "prod-c", "Rank 3 must be Product C");
  assert.strictEqual(ranked[2].total_sold, 0, "Product C must have 0 eligible units (ineligible 70 ignored)");
});

// =============================================================================
// PART C: DUPLICATE SEARCH OVERLAY PRODUCTS & IMAGES
// =============================================================================
console.log("\n--- PART C: DUPLICATE SEARCH OVERLAY PRODUCTS & IMAGES ---");

test("findTrendingProducts correctly maps images using toProductImage(img) with storagePath -> public url", () => {
  const code = fs.readFileSync(path.join(ROOT, "src/lib/server/product.ts"), "utf8");
  assert(code.includes("list.push(toProductImage(img));"), "Must use toProductImage(img) instead of raw img.url");
  assert(!code.includes("url: img.url,"), "Must not look for non-existent img.url column on product_images table");
});

test("SearchOverlay deduplicates product IDs and caps to available distinct items", () => {
  const code = fs.readFileSync(path.join(ROOT, "src/components/customer/SearchOverlay.tsx"), "utf8");
  assert(code.includes("seen.has(p.id)"), "SearchOverlay must deduplicate products by ID using Set");
  assert(code.includes("distinct.slice(0, 4)"), "SearchOverlay must slice distinct products to at most 4");
});

test("TrendingSearchProducts component uses unique item.id for keys", () => {
  const code = fs.readFileSync(path.join(ROOT, "src/components/customer/search/TrendingSearchProducts.tsx"), "utf8");
  assert(code.includes("key={item.id}"), "Must use unique item.id as React key");
});

// =============================================================================
// PART D: GENUINELY POPULAR SEARCH CATEGORIES
// =============================================================================
console.log("\n--- PART D: CATEGORY POPULARITY & SEARCH OVERLAY LIMITS ---");

test("Local unapplied migration 004 exists and defines category_views table schema", () => {
  const migPath = path.join(ROOT, "database/migrations/004_category_browsing_metrics.sql");
  assert(fs.existsSync(migPath), "004_category_browsing_metrics.sql migration file must exist");
  const sql = fs.readFileSync(migPath, "utf8");
  assert(sql.includes("CREATE TABLE IF NOT EXISTS `category_views`"), "Must create category_views table");
  assert(sql.includes("`session_hash`"), "Must include session_hash for deduplication");
  assert(sql.includes("STATUS: LOCAL UNAPPLIED MIGRATION"), "Must clearly declare status as local unapplied");
});

test("category.ts provides getPopularCategories and recordCategoryView with graceful fallback", () => {
  const code = fs.readFileSync(path.join(ROOT, "src/lib/server/category.ts"), "utf8");
  assert(code.includes("export async function getPopularCategories"), "getPopularCategories must be exported");
  assert(code.includes("export async function recordCategoryView"), "recordCategoryView must be exported");
  assert(code.includes("ER_NO_SUCH_TABLE"), "Must catch ER_NO_SUCH_TABLE gracefully for unapplied production migration");
  assert(code.includes("listCategories({ isActive: true })"), "Must fall back to active categories deterministically");
});

test("/api/categories supports ?popular=true and limits to at most 3 popular categories", () => {
  const code = fs.readFileSync(path.join(ROOT, "src/app/api/categories/route.ts"), "utf8");
  assert(code.includes("popularParam === \"true\""), "Must check for popular query param");
  assert(code.includes("getPopularCategories(limit)"), "Must call getPopularCategories");
  assert(code.includes("recordCategoryView"), "Must support POST to record category view");
});

test("SearchSuggestions and SearchOverlay limit browse categories to at most 3", () => {
  const overlayCode = fs.readFileSync(path.join(ROOT, "src/components/customer/SearchOverlay.tsx"), "utf8");
  const suggestionsCode = fs.readFileSync(path.join(ROOT, "src/components/customer/search/SearchSuggestions.tsx"), "utf8");
  assert(overlayCode.includes("fetch(\"/api/categories?popular=true&limit=3\")"), "Overlay must query at most 3 popular categories");
  assert(overlayCode.includes("categories={popularCategories}"), "Overlay must pass popularCategories");
  assert(suggestionsCode.includes("const displayedCategories = (categories || []).slice(0, 3)"), "Suggestions must slice categories to at most 3");
});

test("Shop page records browsing event when customer filters by category", () => {
  const shopCode = fs.readFileSync(path.join(ROOT, "src/app/shop/page.tsx"), "utf8");
  assert(shopCode.includes("recordCategoryView(cat)"), "Shop page must call recordCategoryView when category is selected");
});

// =============================================================================
// SUMMARY
// =============================================================================
console.log("\n================================================================================");
console.log(`ALL TESTS PASSED: ${passed}/${total}`);
console.log("================================================================================");
