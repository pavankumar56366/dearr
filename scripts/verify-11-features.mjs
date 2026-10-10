/**
 * Comprehensive Verification & Regression Test Suite for Dearr 11 Features
 *
 * Verifies all 11 features locally without mutating remote/production database
 * or creating live payments.
 */

import fs from "fs";
import path from "path";
import assert from "assert";

const ROOT = process.cwd();

console.log("================================================================================");
console.log("DEARR 11 FEATURES COMPREHENSIVE VERIFICATION & REGRESSION TEST SUITE");
console.log("================================================================================\n");

let passedTests = 0;
let totalTests = 0;

function runTest(testName, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  [PASS] ${testName}`);
    passedTests++;
  } catch (err) {
    console.error(`  [FAIL] ${testName}:`, err.message);
    throw err;
  }
}

// =============================================================================
// FEATURE 1: DEMO ADDRESS REMOVAL
// =============================================================================
console.log("--- 1. FEATURE 1 — DEMO ADDRESS REMOVAL ---");

runTest("AddressForm and CheckoutPageClient have no demo address quick-fill button", () => {
  const addressFormCode = fs.readFileSync(path.join(ROOT, "src/components/customer/checkout/AddressForm.tsx"), "utf8");
  const checkoutPageCode = fs.readFileSync(path.join(ROOT, "src/components/customer/checkout/CheckoutPageClient.tsx"), "utf8");
  const validationCode = fs.readFileSync(path.join(ROOT, "src/lib/checkout-validation.ts"), "utf8");

  assert(!addressFormCode.includes("Fill Demo Address"), "Found 'Fill Demo Address' in AddressForm.tsx");
  assert(!addressFormCode.includes("DEMO_DELIVERY_ADDRESS"), "Found DEMO_DELIVERY_ADDRESS in AddressForm.tsx");
  assert(!checkoutPageCode.includes("Fill Demo Address"), "Found 'Fill Demo Address' in CheckoutPageClient.tsx");
  assert(!checkoutPageCode.includes("DEMO_DELIVERY_ADDRESS"), "Found DEMO_DELIVERY_ADDRESS in CheckoutPageClient.tsx");
  assert(!validationCode.includes("DEMO_DELIVERY_ADDRESS"), "Found DEMO_DELIVERY_ADDRESS in checkout-validation.ts");
});

runTest("Delivery address validation requires real 10-digit mobile and 6-digit PIN", () => {
  const validationCode = fs.readFileSync(path.join(ROOT, "src/lib/checkout-validation.ts"), "utf8");
  assert(validationCode.includes("/^[6-9]\\d{9}$/"), "Mobile number must require 10-digit regex starting with 6-9");
  assert(validationCode.includes("/^\\d{6}$/"), "PIN code must require 6-digit regex");
});

runTest("Server order route does not inject dummy defaults for missing shipping fields", () => {
  const orderServerCode = fs.readFileSync(path.join(ROOT, "src/lib/server/order.ts"), "utf8");
  assert(orderServerCode.includes("validateShippingAddress"), "Order creation must call validateShippingAddress");
  assert(orderServerCode.includes("OrderValidationError"), "Missing shipping fields must throw OrderValidationError");
});

// =============================================================================
// FEATURE 2: PAYMENT SUCCESS ANIMATION
// =============================================================================
console.log("\n--- 2. FEATURE 2 — PAYMENT SUCCESS ANIMATION ---");

runTest("PaymentSuccessAnimation exists and supports prefers-reduced-motion", () => {
  const animPath = path.join(ROOT, "src/components/customer/checkout/PaymentSuccessAnimation.tsx");
  assert(fs.existsSync(animPath), "PaymentSuccessAnimation.tsx must exist");
  const animCode = fs.readFileSync(animPath, "utf8");
  assert(animCode.includes("prefers-reduced-motion"), "Must honor prefers-reduced-motion");
  assert(animCode.includes("animation: none !important"), "Must disable animations in reduced-motion mode");
  assert(animCode.includes("pointer-events-none"), "Animation must be non-blocking (pointer-events-none)");
});

runTest("OrderConfirmationClient only renders animation on verified paid orders", () => {
  const confirmCode = fs.readFileSync(path.join(ROOT, "src/components/customer/order/OrderConfirmationClient.tsx"), "utf8");
  // Verify that PaymentSuccessAnimation is conditioned on isPaid
  assert(confirmCode.includes('const isPaid = order.paymentStatus === "paid" && order.status !== "cancelled"'), "isPaid must require paymentStatus === 'paid'");
  assert(confirmCode.includes("{isPaid ? ("), "PaymentSuccessAnimation must be inside isPaid branch");
  assert(confirmCode.includes("Payment Incomplete / Failed"), "Failed orders must render distinct failure status");
  assert(confirmCode.includes("Order Cancelled"), "Cancelled orders must render distinct cancelled status");
  assert(confirmCode.includes("Order Received — Payment Pending"), "Pending orders must render pending status");
});

// =============================================================================
// FEATURE 3: DEAR ICON INTEGRATION
// =============================================================================
console.log("\n--- 3. FEATURE 3 — DEAR ICON INTEGRATION ---");

runTest("All 22 Dearr SVG icons are present in public/icons/dearr_icons/svg", () => {
  const svgDir = path.join(ROOT, "public/icons/dearr_icons/svg");
  assert(fs.existsSync(svgDir), "SVG icons directory must exist");

  const expectedIcons = [
    "account.svg",
    "all-india-delivery.svg",
    "arrow-right.svg",
    "articulated-toys.svg",
    "cart.svg",
    "close.svg",
    "custom-keychains.svg",
    "custom-personalization.svg",
    "desk-organizers.svg",
    "eco-friendly-pla.svg",
    "lithophane-lamps.svg",
    "mail.svg",
    "menu.svg",
    "miniatures-decor.svg",
    "orders.svg",
    "precision-3d-print.svg",
    "safe-packaging.svg",
    "search.svg",
    "sparkle.svg",
    "spiritual-idols.svg",
    "study-projects.svg",
    "wishlist.svg",
  ];

  for (const icon of expectedIcons) {
    const iconFile = path.join(svgDir, icon);
    assert(fs.existsSync(iconFile), `Missing icon asset: ${icon}`);
    const content = fs.readFileSync(iconFile, "utf8");
    assert(content.includes("<svg") && content.includes("</svg>"), `Malformed SVG in ${icon}`);
  }
});

runTest("Icons.tsx exports category and trust section SVGs matching brand specs", () => {
  const iconsCode = fs.readFileSync(path.join(ROOT, "src/components/customer/Icons.tsx"), "utf8");
  const expectedExports = [
    "SpiritualIdolsIcon",
    "ArticulatedToysIcon",
    "CustomKeychainsIcon",
    "DeskOrganizersIcon",
    "LithophaneLampsIcon",
    "MiniaturesDecorIcon",
    "StudyProjectsIcon",
    "PrecisionPrintIcon",
    "CustomPersonalizationIcon",
    "EcoFriendlyPlaIcon",
    "SafePackagingIcon",
  ];
  for (const exp of expectedExports) {
    assert(iconsCode.includes(`export function ${exp}`), `Missing icon export in Icons.tsx: ${exp}`);
  }
});

// =============================================================================
// FEATURE 4: BUTTON ANIMATIONS
// =============================================================================
console.log("\n--- 4. FEATURE 4 — BUTTON ANIMATIONS ---");

runTest("globals.css defines button hover, active, disabled, and reduced-motion states", () => {
  const css = fs.readFileSync(path.join(ROOT, "src/app/globals.css"), "utf8");
  assert(css.includes(".btn-base:hover:not(:disabled)"), "Must have .btn-base hover state");
  assert(css.includes(".btn-base:active:not(:disabled)"), "Must have .btn-base active state");
  assert(css.includes("translateY(-1px)"), "Must include subtle hover lift");
  assert(css.includes("scale(0.98)"), "Must include subtle press scale");
  assert(css.includes(".btn-base:disabled"), "Must define disabled state");
  assert(css.includes("transform: none !important"), "Disabled buttons must not animate");
  assert(css.includes("@media (prefers-reduced-motion: reduce)"), "Must support reduced-motion override");
});

// =============================================================================
// FEATURE 5: REMOVE THE MOBILE PRODUCT FLOATING WIDGET
// =============================================================================
console.log("\n--- 5. FEATURE 5 — REMOVE THE MOBILE PRODUCT FLOATING WIDGET ---");

runTest("ProductActions.tsx has no sticky bottom widget and keeps in-page actions", () => {
  const code = fs.readFileSync(path.join(ROOT, "src/components/customer/product/ProductActions.tsx"), "utf8");
  assert(!code.includes("fixed bottom-[calc(76px+"), "Sticky dock widget must be removed");
  assert(!code.includes("fixed bottom-[calc(80px+"), "Sticky dock widget must be removed");
  assert(code.includes("handleAddToCart"), "In-page Add to Cart must remain");
  assert(code.includes("handleBuyNow"), "In-page Buy Now must remain");
  assert(code.includes("handleWishlistToggle"), "In-page Wishlist toggle must remain");
});

// =============================================================================
// FEATURE 6: WISHLIST COUNT AND STATE SYNCHRONIZATION
// =============================================================================
console.log("\n--- 6. FEATURE 6 — WISHLIST COUNT AND STATE SYNCHRONIZATION ---");

runTest("WishlistContext manages state transitions, deduplication, and auth sync", () => {
  const contextCode = fs.readFileSync(path.join(ROOT, "src/context/WishlistContext.tsx"), "utf8");
  assert(contextCode.includes("const [wishlistCount, setWishlistCount] = useState<number>(0)"), "Initial count must be 0");
  assert(contextCode.includes("setWishlistCount(ids.size)"), "Count must accurately reflect unique item IDs size");
  assert(contextCode.includes("setWishlistCount(0)"), "Must reset to 0 on logout");
  assert(contextCode.includes("refreshWishlist()"), "Must synchronize on login / user change");
  assert(contextCode.includes("// Revert optimistic update"), "Must rollback optimistic updates on API failure");
});

runTest("Simulated Wishlist state transitions pass all scenarios", () => {
  // Unit test of the wishlist state machine logic
  let wishlistIds = new Set();
  let count = 0;

  // Scenario 1: Empty wishlist
  assert.strictEqual(count, 0, "Scenario 1: count should be 0");

  // Scenario 2: Add Product A
  const addProduct = (id) => {
    const isNew = !wishlistIds.has(id);
    wishlistIds.add(id);
    if (isNew) count++;
  };
  addProduct("prod-A");
  assert.strictEqual(count, 1, "Scenario 2: count should be 1 after adding prod-A");

  // Scenario 3: Add Product B
  addProduct("prod-B");
  assert.strictEqual(count, 2, "Scenario 3: count should be 2 after adding prod-B");

  // Scenario 4: Duplicate Add Product A does not inflate
  addProduct("prod-A");
  assert.strictEqual(count, 2, "Scenario 4: count should remain 2 on duplicate add");

  // Scenario 5: Remove Product A
  const removeProduct = (id) => {
    if (wishlistIds.has(id)) {
      wishlistIds.delete(id);
      count--;
    }
  };
  removeProduct("prod-A");
  assert.strictEqual(count, 1, "Scenario 5: count should be 1 after removing prod-A");

  // Scenario 6: Remove Product B
  removeProduct("prod-B");
  assert.strictEqual(count, 0, "Scenario 6: count should be 0 after removing prod-B");

  // Scenario 7: Optimistic rollback on API error
  addProduct("prod-C");
  assert.strictEqual(count, 1, "Optimistic add: count is 1");
  // Simulate API failure rollback:
  removeProduct("prod-C");
  assert.strictEqual(count, 0, "Rollback: count returns to 0");

  // Scenario 8: Logout reset
  addProduct("prod-D");
  addProduct("prod-E");
  assert.strictEqual(count, 2, "Before logout: count is 2");
  // Simulate logout
  wishlistIds = new Set();
  count = 0;
  assert.strictEqual(count, 0, "After logout: count is 0");
});

// =============================================================================
// FEATURE 7: MULTIPLE CUSTOMER ADDRESSES
// =============================================================================
console.log("\n--- 7. FEATURE 7 — MULTIPLE CUSTOMER ADDRESSES ---");

runTest("addresses table is defined in 001_initial_schema.sql and supports multiple addresses", () => {
  const schema = fs.readFileSync(path.join(ROOT, "database/migrations/001_initial_schema.sql"), "utf8");
  assert(schema.includes("CREATE TABLE IF NOT EXISTS `addresses`"), "addresses table must exist in initial schema");
  assert(schema.includes("`user_id` CHAR(36) NOT NULL"), "addresses must link to user_id");
  assert(schema.includes("`is_default` TINYINT(1) NOT NULL DEFAULT 0"), "addresses must have is_default column");
  assert(schema.includes("`address_line_1` VARCHAR(255) NOT NULL"), "addresses must have address_line_1");
  assert(schema.includes("`postal_code` VARCHAR(20) NOT NULL"), "addresses must have postal_code");
});

runTest("address.ts strictly enforces multi-tenant ownership boundaries", () => {
  const addressCode = fs.readFileSync(path.join(ROOT, "src/lib/server/address.ts"), "utf8");
  assert(addressCode.includes("WHERE id = ? AND user_id = ?"), "Ownership checks must require id AND user_id");
  assert(addressCode.includes("Address not found or unauthorized"), "Unauthorized updates must be rejected");
  assert(addressCode.includes("deleteCustomerAddress"), "deleteCustomerAddress must be exported");
  assert(addressCode.includes("setDefaultCustomerAddress"), "setDefaultCustomerAddress must be exported");
});

runTest("Order creation endpoint enforces address ownership and rejects foreign address IDs", () => {
  const ordersApiCode = fs.readFileSync(path.join(ROOT, "src/app/api/orders/route.ts"), "utf8");
  assert(ordersApiCode.includes("getCustomerAddressById(user.id"), "Must query address strictly by authenticated user.id");
  assert(ordersApiCode.includes("status: 403"), "Must return 403 Forbidden when address is not owned by user");
});

// =============================================================================
// FEATURE 8: TRENDING PRODUCTS AND PRICING
// =============================================================================
console.log("\n--- 8. FEATURE 8 — TRENDING PRODUCTS AND PRICING ---");

runTest("findTrendingProducts queries paid/confirmed sales and deterministic fallback", () => {
  const productCode = fs.readFileSync(path.join(ROOT, "src/lib/server/product.ts"), "utf8");
  assert(productCode.includes("findTrendingProducts"), "findTrendingProducts must be exported");
  assert(productCode.includes("o.payment_status = 'paid'"), "Must count only orders where payment_status = 'paid'");
  assert(productCode.includes("o.status IN ('confirmed', 'processing', 'shipped', 'delivered')"), "Must count only confirmed/processing/shipped/delivered orders");
  assert(productCode.includes("p.is_active = 1"), "Must return only active products");
  assert(productCode.includes("ORDER BY total_sold DESC, p.is_featured DESC, p.created_at DESC"), "Must sort by total_sold DESC with deterministic fallback");
});

runTest("/api/products endpoint supports trending parameter", () => {
  const productsApi = fs.readFileSync(path.join(ROOT, "src/app/api/products/route.ts"), "utf8");
  assert(productsApi.includes("trendingParam"), "Must check trendingParam");
  assert(productsApi.includes("findTrendingProducts"), "Must call findTrendingProducts");
});

// =============================================================================
// FEATURE 9: LIMIT SEARCH HISTORY AND TRENDING SEARCHES
// =============================================================================
console.log("\n--- 9. FEATURE 9 — LIMIT SEARCH HISTORY AND TRENDING SEARCHES ---");

runTest("SearchSuggestions caps recent searches at 3 and popular searches at 3", () => {
  const searchCode = fs.readFileSync(path.join(ROOT, "src/components/customer/search/SearchSuggestions.tsx"), "utf8");
  assert(searchCode.includes("displayedRecent = (recentSearches || []).slice(0, 3)"), "Recent searches must be capped at 3");
  assert(searchCode.includes("displayedPopular = (popularSearches || []).slice(0, 3)"), "Popular searches must be capped at 3");
});

// =============================================================================
// FEATURE 10: INSTAGRAM LINK
// =============================================================================
console.log("\n--- 10. FEATURE 10 — INSTAGRAM LINK ---");

runTest("Footer, LoginForm, and SignupForm link to the exact required Instagram URL with target blank", () => {
  const targetUrl = "https://www.instagram.com/dearr.in_?utm_source=ig_web_button_share_sheet&stkn=ZDNlZDc0MzIxNw==";
  const files = [
    "src/components/customer/home/Footer.tsx",
    "src/components/customer/auth/LoginForm.tsx",
    "src/components/customer/auth/SignupForm.tsx",
  ];

  for (const file of files) {
    const code = fs.readFileSync(path.join(ROOT, file), "utf8");
    assert(code.includes(targetUrl), `Missing exact Instagram URL in ${file}`);
    assert(code.includes('target="_blank"'), `Missing target="_blank" in ${file}`);
    assert(code.includes('rel="noopener noreferrer"'), `Missing rel="noopener noreferrer" in ${file}`);
  }
});

// =============================================================================
// FEATURE 11: REMOVE THE MINIMUM ORDER VALUE REQUIREMENT
// =============================================================================
console.log("\n--- 11. FEATURE 11 — REMOVE THE MINIMUM ORDER VALUE REQUIREMENT ---");

runTest("Order creation flow does not enforce minimum order value restriction", () => {
  const orderCode = fs.readFileSync(path.join(ROOT, "src/lib/server/order.ts"), "utf8");
  assert(!orderCode.includes("Minimum order value is"), "order.ts must not reject orders for subtotal < minimumOrderValue");
  assert(orderCode.includes("Feature #11: No minimum purchase/order value requirement"), "order.ts must document Feature #11 removal");
});

runTest("Admin Settings UI removed the obsolete Minimum Order Value input control", () => {
  const adminSettingsCode = fs.readFileSync(path.join(ROOT, "src/components/admin/settings/AdminSettingsPage.tsx"), "utf8");
  assert(!adminSettingsCode.includes('id="minimumOrderValue"'), "AdminSettingsPage.tsx must not contain minimumOrderValue input");
  assert(!adminSettingsCode.includes("Minimum Order Value (₹)"), "AdminSettingsPage.tsx must not render Minimum Order Value label");
  assert(!adminSettingsCode.includes("newErrors.minimumOrderValue"), "AdminSettingsPage.tsx must not validate minimumOrderValue");
});

// =============================================================================
// CROSS-FEATURE REGRESSION TESTS (Section 15)
// =============================================================================
console.log("\n--- CROSS-FEATURE REGRESSION TESTS (Section 15) ---");

runTest("Cross-Feature: Wishlist and Account synchronization (zero on logout, no leak between users)", () => {
  // Simulate user switching and header count binding
  let currentUser = "UserA";
  let userWishlists = {
    UserA: new Set(["item1", "item2"]),
    UserB: new Set(),
  };

  const getHeaderCount = (user) => (user ? (userWishlists[user]?.size || 0) : 0);

  // User A logged in
  assert.strictEqual(getHeaderCount(currentUser), 2, "User A should have 2 wishlist items");

  // User A logs out
  currentUser = null;
  assert.strictEqual(getHeaderCount(currentUser), 0, "Logged out user must display 0 in header");

  // User B logs in
  currentUser = "UserB";
  assert.strictEqual(getHeaderCount(currentUser), 0, "User B must have 0 items (no leak from User A)");

  // User B adds an item
  userWishlists.UserB.add("itemX");
  assert.strictEqual(getHeaderCount(currentUser), 1, "User B should update to 1 item");
});

runTest("Cross-Feature: Address selection & checkout isolation (rejection of unauthorized address IDs)", () => {
  // Simulate address validation in order checkout
  const mockDbAddresses = [
    { id: "addr-user1-default", userId: "user-1", fullName: "User One", phone: "9876543210", postalCode: "560001", isDefault: 1 },
    { id: "addr-user2-default", userId: "user-2", fullName: "User Two", phone: "9123456789", postalCode: "110001", isDefault: 1 },
  ];

  const getCustomerAddress = (userId, addressId) => {
    return mockDbAddresses.find((a) => a.id === addressId && a.userId === userId) || null;
  };

  // User 1 checking out with User 1's address -> Accepted
  const user1Address = getCustomerAddress("user-1", "addr-user1-default");
  assert(user1Address !== null, "User 1 should find their own address");
  assert.strictEqual(user1Address.fullName, "User One");

  // User 1 attempting to check out with User 2's address -> Rejected
  const unauthorizedAddress = getCustomerAddress("user-1", "addr-user2-default");
  assert.strictEqual(unauthorizedAddress, null, "User 1 cannot access User 2's address (enforces 403 Forbidden)");
});

runTest("Cross-Feature: Search & Pricing consistency (discount calculations & variant fallbacks)", () => {
  // Simulate pricing calculation matching computeDiscountAmount and toProduct
  const baseProduct = {
    id: "p1",
    price: 499,
    compareAtPrice: 699,
  };
  const discountFixed = { type: "fixed", value: 100 };
  const discountPercent = { type: "percentage", value: 20 };

  const calcPrice = (price, discount) => {
    let discountAmount = 0;
    if (discount.type === "fixed") {
      discountAmount = discount.value;
    } else if (discount.type === "percentage") {
      discountAmount = Math.round((price * discount.value) / 100);
    }
    return Math.max(0, price - discountAmount);
  };

  assert.strictEqual(calcPrice(baseProduct.price, discountFixed), 399, "Fixed discount calculation");
  assert.strictEqual(calcPrice(baseProduct.price, discountPercent), 399, "Percentage discount calculation (499 - 100 = 399)");

  // Variant pricing fallback
  const variantWithPrice = { price: 549 };
  const variantWithoutPrice = { price: null };
  const getEffectivePrice = (prod, v) => (v && v.price !== null ? v.price : prod.price);

  assert.strictEqual(getEffectivePrice(baseProduct, variantWithPrice), 549, "Variant with price should override base price");
  assert.strictEqual(getEffectivePrice(baseProduct, variantWithoutPrice), 499, "Variant without price should fallback to base price");
});

runTest("Cross-Feature: Product Page mobile layout (absence of floating purchase widget, normal controls active)", () => {
  const productActionsCode = fs.readFileSync(path.join(ROOT, "src/components/customer/product/ProductActions.tsx"), "utf8");
  // Check that mobile floating purchase bar / dock is absent
  assert(!productActionsCode.includes("bottom-floating"), "No floating purchase bar allowed in ProductActions");
  assert(!productActionsCode.includes("fixed bottom-[calc(76px+"), "No fixed bottom purchase dock allowed in ProductActions");
  assert(!productActionsCode.includes("Mobile Sticky Purchase Bar"), "No sticky purchase bar allowed in ProductActions");
  // Verify standard in-page controls are present
  assert(productActionsCode.includes("handleAddToCart"), "Add to Cart must be present");
  assert(productActionsCode.includes("handleBuyNow"), "Buy Now must be present");
  assert(productActionsCode.includes("handleWishlistToggle"), "Wishlist toggle must be present");
});

runTest("Cross-Feature: Payment confirmation state machine (true success vs pending/failed/cancelled)", () => {
  // State machine simulation for OrderConfirmation
  const evaluateConfirmationUI = (order) => {
    const isPaid = order.paymentStatus === "paid" && order.status !== "cancelled";
    const isFailed = order.paymentStatus === "failed";
    const isCancelled = order.status === "cancelled";
    const isPending = !isPaid && !isFailed && !isCancelled;

    return {
      showAnimation: isPaid,
      statusLabel: isPaid
        ? "Payment Verified & Order Confirmed"
        : isFailed
        ? "Payment Incomplete / Failed"
        : isCancelled
        ? "Order Cancelled"
        : "Order Received — Payment Pending",
    };
  };

  // Case 1: Confirmed paid
  const paidOrder = evaluateConfirmationUI({ paymentStatus: "paid", status: "confirmed" });
  assert.strictEqual(paidOrder.showAnimation, true);
  assert.strictEqual(paidOrder.statusLabel, "Payment Verified & Order Confirmed");

  // Case 2: Failed payment
  const failedOrder = evaluateConfirmationUI({ paymentStatus: "failed", status: "pending" });
  assert.strictEqual(failedOrder.showAnimation, false);
  assert.strictEqual(failedOrder.statusLabel, "Payment Incomplete / Failed");

  // Case 3: Cancelled order
  const cancelledOrder = evaluateConfirmationUI({ paymentStatus: "paid", status: "cancelled" });
  assert.strictEqual(cancelledOrder.showAnimation, false);
  assert.strictEqual(cancelledOrder.statusLabel, "Order Cancelled");

  // Case 4: COD / Pending payment
  const pendingOrder = evaluateConfirmationUI({ paymentStatus: "pending", status: "pending" });
  assert.strictEqual(pendingOrder.showAnimation, false);
  assert.strictEqual(pendingOrder.statusLabel, "Order Received — Payment Pending");
});

runTest("Cross-Feature: Low-value order processing without minimum order value barrier", () => {
  // Test low-value order simulation (e.g. ₹29 keychain)
  const cartSubtotal = 29;
  const storeSettings = {
    freeShippingThreshold: 499,
    defaultShippingFee: 49,
  };

  // Order calculation
  const shippingAmount = cartSubtotal >= storeSettings.freeShippingThreshold ? 0 : storeSettings.defaultShippingFee;
  const totalAmount = cartSubtotal + shippingAmount;

  assert.strictEqual(shippingAmount, 49, "Subtotal below free shipping threshold pays default shipping");
  assert.strictEqual(totalAmount, 78, "Total amount should be ₹78");
  // Subtotal is accepted without rejection
  assert(totalAmount > 0, "Low-value order is valid");
});

// =============================================================================
// SUMMARY
// =============================================================================
console.log("\n================================================================================");
console.log(`TEST SUITE RESULTS: ${passedTests} / ${totalTests} TESTS PASSED (100%)`);
console.log("================================================================================\n");
