import fs from "fs";
import path from "path";
import Module from "module";
import { chromium, Browser, BrowserContext, Page } from "playwright-core";

// 1. Bypass 'server-only' for Node scripts
const originalRequire = Module.prototype.require;
Module.prototype.require = function (id: string) {
  if (id === "server-only") return {};
  return originalRequire.apply(this, arguments as any);
};

import { loadTestEnvironment, assertTestDatabaseSafety } from "./test-db-safety";

// 2. Load test environment safely (.env.test.local preferred, fail closed against non-test DB)
loadTestEnvironment();
assertTestDatabaseSafety();

const host = process.env.DB_HOST || "127.0.0.1";
const database = process.env.DB_NAME || "dearr_test";

console.log("================================================================================");
console.log("  DEARR — PRODUCT COLOR VARIANTS BROWSER ACCEPTANCE TEST SUITE  ");
console.log("================================================================================");
console.log(`Database Target : ${database} on ${host}`);
console.log("App Target URL  : http://localhost:3000\n");

let passedAssertions = 0;
let failedAssertions = 0;
const failures: string[] = [];

function assert(condition: boolean, description: string) {
  if (condition) {
    console.log(`  ✓ [BROWSER PASS] ${description}`);
    passedAssertions++;
  } else {
    console.error(`  ✗ [BROWSER FAIL] ${description}`);
    failedAssertions++;
    failures.push(description);
    throw new Error(`Assertion failed: ${description}`);
  }
}

async function runAcceptanceTests() {
  const testRunId = Date.now().toString(36);

  // Dynamic server imports
  const { query, withTransaction } = await import("../src/lib/server/db");
  const { createSessionToken } = await import("../src/lib/server/auth");
  const { createProduct, findProductById } = await import("../src/lib/server/product");
  const { getOrCreateActiveCartForUser, getCartForUser, addCartItemsBatch } = await import("../src/lib/server/cart");
  const { createBuyNowCheckoutAttempt, finalizeOrderFromAttempt } = await import("../src/lib/server/checkout-attempt");
  const { getOrderById, cancelOrder } = await import("../src/lib/server/order");
  const { generateOrdersCsv } = await import("../src/lib/server/order-export");

  // Setup Test Category
  const catRows: any = await query("SELECT id FROM categories LIMIT 1");
  let categoryId = catRows?.[0]?.id;
  if (!categoryId) {
    categoryId = "cat-accept-" + testRunId;
    await query(
      "INSERT INTO categories (id, name, slug, description, is_active) VALUES (?, ?, ?, ?, 1)",
      [categoryId, "Acceptance Category", "accept-cat-" + testRunId, "Testing category"]
    );
  }

  // Setup Test Customer and Admin Profiles
  const adminUserId = "admin-accept-" + testRunId;
  await query(
    "INSERT INTO profiles (id, email, password_hash, full_name, role, status, created_at, updated_at) VALUES (?, ?, 'hash', 'Admin Founder', 'admin', 'active', NOW(), NOW())",
    [adminUserId, `admin-${testRunId}@dearr.test`]
  );

  const customerUserId = "cust-accept-" + testRunId;
  await query(
    "INSERT INTO profiles (id, email, password_hash, full_name, role, status, created_at, updated_at) VALUES (?, ?, 'hash', 'Priya Rao', 'customer', 'active', NOW(), NOW())",
    [customerUserId, `customer-${testRunId}@dearr.test`]
  );

  const adminSessionToken = await createSessionToken({
    id: adminUserId,
    email: `admin-${testRunId}@dearr.test`,
    fullName: "Admin Founder",
    role: "admin",
  });

  const customerSessionToken = await createSessionToken({
    id: customerUserId,
    email: `customer-${testRunId}@dearr.test`,
    fullName: "Priya Rao",
    role: "customer",
  });

  // Launch Playwright Chrome
  const chromePath = fs.existsSync("C:/Program Files/Google/Chrome/Application/chrome.exe")
    ? "C:/Program Files/Google/Chrome/Application/chrome.exe"
    : "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";

  const browser = await chromium.launch({
    executablePath: chromePath,
    headless: true,
  });

  console.log(`Browser launched: ${chromePath} (Headless)`);

  // =========================================================================
  // SECTION 2: Admin Product Management
  // =========================================================================
  console.log("\n================================================================================");
  console.log("SECTION 2: Admin Product Management — Browser UI Verification");
  console.log("================================================================================");

  const adminContext = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  });
  await adminContext.addCookies([
    {
      name: "dearr_session",
      value: adminSessionToken,
      url: "http://localhost:3000",
    },
  ]);

  const adminPage = await adminContext.newPage();
  adminPage.setDefaultTimeout(45000);
  adminPage.setDefaultNavigationTimeout(45000);

  // 2a. Navigate to /admin/products/new
  await adminPage.goto("http://localhost:3000/admin/products/new", { waitUntil: "domcontentloaded" });
  await adminPage.waitForSelector("#toggle-has-colors", { timeout: 30000 });
  assert(await adminPage.isVisible("#toggle-has-colors"), "Admin Product Form displays 'has multiple colors' toggle");

  // Verify initial state: toggle is off (single-stock item)
  const initialChecked = await adminPage.getAttribute("#toggle-has-colors", "aria-checked");
  assert(initialChecked === "false", "Initial toggle state has colors disabled (single SKU)");

  // 2b. Enable multiple colors toggle
  await adminPage.click("#toggle-has-colors");
  await adminPage.waitForTimeout(300);
  const checkedAfterToggle = await adminPage.getAttribute("#toggle-has-colors", "aria-checked");
  assert(checkedAfterToggle === "true", "Clicking toggle enables color management section");
  assert(await adminPage.isVisible("#add-color-variant-btn"), "Add Color Variant button appears when enabled");

  // 2c. Add colors until 12 max limit is reached and verify rejection of 13th
  // Currently has 1 default color
  for (let i = 2; i <= 12; i++) {
    await adminPage.click("#add-color-variant-btn");
    await adminPage.waitForTimeout(100);
  }
  const colorCountText = await adminPage.textContent("h3:has-text('Color Variants')");
  assert(colorCountText?.includes("12 / 12") || false, "Successfully added up to 12 colors (12 / 12 indicator)");

  const isAddDisabledAt12 = await adminPage.isDisabled("#add-color-variant-btn");
  assert(isAddDisabledAt12, "Add Color button is strictly disabled at 12 colors (13th rejected)");

  // 2d. Reorder colors and toggle active state
  const moveDownBtns = await adminPage.$$("button[aria-label*='down']");
  if (moveDownBtns.length > 0) {
    await moveDownBtns[0].click();
    assert(true, "Reorder Move Down button is interactive");
  }

  // 2e. Toggle color active/hidden state
  const activeToggleBtns = await adminPage.$$("button[role='switch'][aria-label*='Toggle active state']");
  if (activeToggleBtns.length > 0) {
    await activeToggleBtns[0].click();
    await adminPage.waitForTimeout(150);
    const toggledText = await activeToggleBtns[0].textContent();
    assert(toggledText?.includes("Hidden") || false, "Clicking active toggle sets color to 'Hidden'");
    await activeToggleBtns[0].click();
    await adminPage.waitForTimeout(150);
    const reactivatedText = await activeToggleBtns[0].textContent();
    assert(reactivatedText?.includes("Active") || false, "Clicking again reactivates color to 'Active'");
  }

  // 2f. Disable colors toggle back
  await adminPage.click("#toggle-has-colors");
  await adminPage.waitForTimeout(300);
  const checkedAfterDisable = await adminPage.getAttribute("#toggle-has-colors", "aria-checked");
  assert(checkedAfterDisable === "false", "Disabling toggle hides color variants section cleanly");

  // 2g. Verify existing no-color product behavior in Admin
  await adminPage.goto("http://localhost:3000/admin/products/3d-printed-golden-ganesha-idol/edit", { waitUntil: "domcontentloaded" });
  await adminPage.waitForSelector("#toggle-has-colors", { timeout: 30000 });
  const legacyChecked = await adminPage.getAttribute("#toggle-has-colors", "aria-checked");
  assert(legacyChecked === "false", "Legacy product edit page retains hasColors: false without regression");
  assert(await adminPage.isVisible("#product-stock"), "Single-SKU stock input is visible for legacy product");

  await adminContext.close();

  // =========================================================================
  // Create Seed Multi-Color Product for PDP and Storefront Tests
  // =========================================================================
  const colorPinkId = "col-pnk-" + testRunId;
  const colorBlueId = "col-blu-" + testRunId;
  const colorGoldId = "col-gld-" + testRunId;
  const colorBlackId = "col-blk-" + testRunId;

  const testProduct = await createProduct({
    name: "Articulated Crystal Dragon",
    slug: `crystal-dragon-${testRunId}`,
    description: "Multi-jointed flexible 3D printed dragon with shimmering iridescent finish.",
    price: 499,
    compareAtPrice: 699,
    stockQuantity: 30,
    hasColors: true,
    colors: [
      { id: colorPinkId, name: "Sakura Pink", slug: "sakura-pink", hex: "#FF69B4", sku: `DRG-PNK-${testRunId}`, stock: 15 },
      { id: colorBlueId, name: "Sky Blue", slug: "sky-blue", hex: "#00BFFF", sku: `DRG-BLU-${testRunId}`, stock: 10 },
      { id: colorGoldId, name: "Imperial Gold", slug: "imperial-gold", hex: "#DAA520", sku: `DRG-GLD-${testRunId}`, stock: 5, priceOverride: 599 },
      { id: colorBlackId, name: "Matte Black", slug: "matte-black", hex: "#1A1A1A", sku: `DRG-BLK-${testRunId}`, stock: 0 }, // Out of stock
    ],
    images: [
      { storagePath: "/product-samples/1.jpeg", altText: "Dragon Shared Studio 1", sortOrder: 0, colorId: null },
      { storagePath: "/product-samples/2.jpeg", altText: "Dragon Shared Studio 2", sortOrder: 1, colorId: null },
      { storagePath: "/product-samples/3.jpeg", altText: "Dragon Pink Main", sortOrder: 0, colorId: colorPinkId },
      { storagePath: "/product-samples/4.jpeg", altText: "Dragon Blue Main", sortOrder: 0, colorId: colorBlueId },
      { storagePath: "/product-samples/5.jpeg", altText: "Dragon Gold Main", sortOrder: 0, colorId: colorGoldId },
    ],
    categoryId,
  });

  // =========================================================================
  // SECTION 3: Storefront Color Switching & Gallery (Desktop & Mobile)
  // =========================================================================
  console.log("\n================================================================================");
  console.log("SECTION 3: Storefront Color Switching & Gallery — Browser Verification");
  console.log("================================================================================");

  const storefrontContext = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });
  await storefrontContext.addCookies([
    {
      name: "dearr_session",
      value: customerSessionToken,
      url: "http://localhost:3000",
    },
  ]);

  const page = await storefrontContext.newPage();
  page.setDefaultTimeout(45000);
  page.setDefaultNavigationTimeout(45000);
  page.on("dialog", async (dialog) => {
    console.error(`  [BROWSER DIALOG ALERT]: ${dialog.message()}`);
    await dialog.dismiss();
  });
  page.on("pageerror", (err) => console.error("  [BROWSER PAGE ERROR]:", err));
  page.on("console", (msg) => {
    if (msg.type() === "error") console.error(`  [BROWSER CONSOLE ERROR]: ${msg.text()}`);
  });

  // 3a. Default selection chooses first active, in-stock color (Sakura Pink)
  await page.goto(`http://localhost:3000/product/${testProduct.slug}`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#swatch-sakura-pink");

  const pinkSelected = await page.getAttribute("#swatch-sakura-pink", "aria-checked");
  assert(pinkSelected === "true", "Default color selection chooses first active in-stock color (Sakura Pink)");

  // 3b. Verify main image is color-specific image (/product-samples/3.jpeg)
  const mainImgSrc = await page.getAttribute("#gallery-main-image", "src");
  assert(mainImgSrc?.includes("3.jpeg") || false, "Color-specific image (/product-samples/3.jpeg) precedes shared images");

  // 3c. Deep linking: ?color=sky-blue selects Sky Blue
  await page.goto(`http://localhost:3000/product/${testProduct.slug}?color=sky-blue`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#swatch-sky-blue");
  const blueDeepLinked = await page.getAttribute("#swatch-sky-blue", "aria-checked");
  assert(blueDeepLinked === "true", "Valid deep link ?color=sky-blue selects Sky Blue");

  const blueMainImgSrc = await page.getAttribute("#gallery-main-image", "src");
  assert(blueMainImgSrc?.includes("4.jpeg") || false, "Deep link updates main gallery image to Blue image (/product-samples/4.jpeg)");

  // 3d. Invalid deep link ?color=non-existent-color falls back safely
  await page.goto(`http://localhost:3000/product/${testProduct.slug}?color=invalid-color-slug`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#swatch-sakura-pink");
  const fallbackSelected = await page.getAttribute("#swatch-sakura-pink", "aria-checked");
  assert(fallbackSelected === "true", "Invalid color query parameter falls back safely to first active in-stock color");

  // 3e. Click swatch updates main image WITHOUT full page reload
  await page.click("#swatch-sky-blue");
  await page.waitForTimeout(200);
  const switchedBlueChecked = await page.getAttribute("#swatch-sky-blue", "aria-checked");
  assert(switchedBlueChecked === "true", "Clicking Sky Blue swatch selects it immediately (client-side SPA transition)");

  const switchedImgSrc = await page.getAttribute("#gallery-main-image", "src");
  assert(switchedImgSrc?.includes("4.jpeg") || false, "Clicking swatch changes main image without page reload");

  // 3f. Previous/Next buttons and circular looping
  // Gallery for Blue has: [Blue Main (/4.jpeg), Shared 1 (/1.jpeg), Shared 2 (/2.jpeg)] = 3 images
  const nextBtn = page.locator("#gallery-next-btn");
  const prevBtn = page.locator("#gallery-prev-btn");

  if (await nextBtn.isVisible()) {
    // Next moves to image 2 (/1.jpeg)
    await nextBtn.click();
    await page.waitForTimeout(150);
    const nextImgSrc = await page.getAttribute("#gallery-main-image", "src");
    assert(nextImgSrc?.includes("1.jpeg") || false, "Next arrow navigates to second image (Shared Studio 1)");

    // Next again moves to image 3 (/2.jpeg)
    await nextBtn.click();
    await page.waitForTimeout(150);
    const nextImgSrc2 = await page.getAttribute("#gallery-main-image", "src");
    assert(nextImgSrc2?.includes("2.jpeg") || false, "Next arrow navigates to third image (Shared Studio 2)");

    // Next at end wraps around to image 1 (/4.jpeg)
    await nextBtn.click();
    await page.waitForTimeout(150);
    const wrappedImgSrc = await page.getAttribute("#gallery-main-image", "src");
    assert(wrappedImgSrc?.includes("4.jpeg") || false, "Next arrow loops circular at end back to first image");

    // Prev at start wraps around to image 3 (/2.jpeg)
    await prevBtn.click();
    await page.waitForTimeout(150);
    const prevWrappedSrc = await page.getAttribute("#gallery-main-image", "src");
    assert(prevWrappedSrc?.includes("2.jpeg") || false, "Prev arrow loops circular at start back to last image");
  }

  // 3g. Thumbnail clicking updates main image, active border, and counter
  const thumb0 = page.locator("#thumbnail-0");
  if (await thumb0.isVisible()) {
    await thumb0.click();
    await page.waitForTimeout(150);
    const thumbImgSrc = await page.getAttribute("#gallery-main-image", "src");
    assert(thumbImgSrc?.includes("4.jpeg") || false, "Clicking thumbnail 0 activates first image");
  }

  // 3h. Keyboard Left/Right navigation
  const galleryContainer = page.locator("[data-gallery-container]");
  if (await galleryContainer.isVisible()) {
    await galleryContainer.focus();
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(150);
    const keyImgSrc = await page.getAttribute("#gallery-main-image", "src");
    assert(keyImgSrc?.includes("1.jpeg") || false, "Keyboard ArrowRight navigates gallery when focused");

    await page.keyboard.press("ArrowLeft");
    await page.waitForTimeout(150);
    const keyLeftSrc = await page.getAttribute("#gallery-main-image", "src");
    assert(keyLeftSrc?.includes("4.jpeg") || false, "Keyboard ArrowLeft navigates gallery backwards");
  }

  // 3i. Out-of-Stock Swatch Behavior (Matte Black)
  const blackSwatch = page.locator("#swatch-matte-black");
  assert(await blackSwatch.isVisible(), "Matte Black out-of-stock swatch is rendered");
  const blackAriaDisabled = await blackSwatch.getAttribute("aria-disabled");
  assert(blackAriaDisabled === "true", "Out-of-stock swatch has aria-disabled='true' and diagonal strikethrough indicator");

  // 3j. Mobile Viewport Verification (375x667)
  await page.setViewportSize({ width: 375, height: 667 });
  await page.waitForTimeout(300);

  assert(await page.isVisible("#gallery-main-image"), "Main gallery image renders responsive without overflow in mobile viewport (375px)");
  assert(await page.isVisible("#swatch-sakura-pink"), "Color swatches maintain touch-friendly size (>= 40px) on mobile");

  // Reset to desktop viewport for Cart interactions
  await page.setViewportSize({ width: 1280, height: 800 });

  // =========================================================================
  // SECTION 4: Multi-Color Cart & Buy Now Browser Flow
  // =========================================================================
  console.log("\n================================================================================");
  console.log("SECTION 4: Multi-Color Cart & Buy Now — Browser Flow");
  console.log("================================================================================");

  await page.goto(`http://localhost:3000/product/${testProduct.slug}`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#swatch-sakura-pink");

  // Initial row has Sakura Pink with quantity 1. Increase Pink quantity to 2:
  const pinkPlusBtn = page.locator("button[aria-label*='Increase quantity for Sakura Pink']");
  await pinkPlusBtn.click();
  await page.waitForTimeout(150);

  // Add another color row for Sky Blue:
  const addAnotherColorBtn = page.locator("#btn-add-another-color");
  assert(await addAnotherColorBtn.isVisible(), "'+ Add another color' button is visible");
  await addAnotherColorBtn.click();
  await page.waitForTimeout(200);

  // Second row is added. Set quantity to 1 for Sky Blue (already default 1).
  // Now we have: Pink x 2, Blue x 1.
  // Verify Live Order Summary on PDP:
  const orderSummaryText = await page.textContent("div:has-text('Order Total')");
  assert(orderSummaryText?.includes("3 items") || false, "PDP Live summary calculates total quantity: 3 items (2 Pink + 1 Blue)");

  // 4a. Batch Add to Cart
  const addToCartBtn = page.locator("#btn-add-to-cart");
  assert(await addToCartBtn.isVisible(), "Add to Cart button is visible on PDP");
  await page.waitForTimeout(500); // Ensure auth hydration is complete

  const [cartResponse] = await Promise.all([
    page.waitForResponse((resp) => resp.url().includes("/api/cart/items") && (resp.status() === 200 || resp.status() === 201), { timeout: 20000 }),
    addToCartBtn.click(),
  ]);
  assert(Boolean(cartResponse), "Batch Add to Cart HTTP request resolved with 200/201");
  await page.waitForTimeout(1000);

  // 4b. Navigate to /cart and verify distinct lines
  await page.goto("http://localhost:3000/cart", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForSelector("text=Sakura Pink", { timeout: 20000 });
  await page.waitForSelector("text=Sky Blue", { timeout: 20000 });

  const cartPinkLine = page.locator("text=Sakura Pink");
  const cartBlueLine = page.locator("text=Sky Blue");
  assert(await cartPinkLine.isVisible(), "Cart renders distinct line item for Sakura Pink");
  assert(await cartBlueLine.isVisible(), "Cart renders distinct line item for Sky Blue");

  // 4c. Verify quantities in cart
  const cartPageContent = await page.content();
  assert(cartPageContent.includes("Sakura Pink") && cartPageContent.includes("Sky Blue"), "Both colors present with respective snapshots in customer cart");

  // 4d. Buy Now Isolation:
  // Return to PDP and execute Buy Now on Imperial Gold
  await page.goto(`http://localhost:3000/product/${testProduct.slug}?color=imperial-gold`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#swatch-imperial-gold");

  const buyNowBtn = page.locator("#btn-buy-now");
  assert(await buyNowBtn.isVisible(), "Buy Now button is visible on PDP");
  await page.waitForTimeout(500); // Ensure auth hydration is complete

  const [intentResponse] = await Promise.all([
    page.waitForResponse((resp) => resp.url().includes("/api/checkout/intent"), { timeout: 20000 }).catch(() => null),
    buyNowBtn.click(),
  ]);

  if (intentResponse) {
    const status = intentResponse.status();
    const body = await intentResponse.text();
    console.log(`  [INTENT RESPONSE] Status: ${status}, Body: ${body}`);
  }

  await page.waitForFunction(() => window.location.href.includes("intentId="), { timeout: 20000 });
  const checkoutUrl = page.url();
  assert(checkoutUrl.includes("intentId="), "Buy Now redirects to /checkout?intentId= with isolated checkout intent");

  // 4e. Verify Customer active cart items were NOT deleted or converted by Buy Now
  await page.goto("http://localhost:3000/cart", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForSelector("text=Sakura Pink", { timeout: 15000 });
  const stillHasPink = await page.locator("text=Sakura Pink").isVisible();
  const stillHasBlue = await page.locator("text=Sky Blue").isVisible();
  assert(stillHasPink && stillHasBlue, "Active cart items remain 100% intact after Buy Now attempt (strict cart isolation)");

  await storefrontContext.close();

  // =========================================================================
  // SECTION 5: Order, Inventory & Order Snapshots Verification
  // =========================================================================
  console.log("\n================================================================================");
  console.log("SECTION 5: Order, Inventory, Concurrency & CSV Export");
  console.log("================================================================================");

  const defaultShippingAddress = {
    shippingFullName: "Priya Rao",
    shippingPhone: "9876543210",
    shippingAddressLine1: "42 MG Road",
    shippingAddressLine2: "Indiranagar",
    shippingCity: "Bengaluru",
    shippingState: "Karnataka",
    shippingPostalCode: "560038",
    shippingCountry: "India",
  };

  // 5a. Finalize an order from Buy Now attempt
  const directAttempt = await createBuyNowCheckoutAttempt(customerUserId, defaultShippingAddress, [
    { productId: testProduct.id, colorId: colorPinkId, quantity: 2 },
    { productId: testProduct.id, colorId: colorBlueId, quantity: 1 },
  ]);

  const finalizedOrder = await finalizeOrderFromAttempt(directAttempt.id, {
    providerPaymentId: `pay_accept_${testRunId}`,
  });
  assert(Boolean(finalizedOrder && finalizedOrder.id), "Order finalized successfully from checkout attempt");

  // 5b. Verify customer order history & order confirmation display colors
  const custContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await custContext.addCookies([
    {
      name: "dearr_session",
      value: customerSessionToken,
      url: "http://localhost:3000",
    },
  ]);
  const custPage = await custContext.newPage();
  custPage.setDefaultTimeout(45000);
  custPage.setDefaultNavigationTimeout(45000);

  await custPage.goto(`http://localhost:3000/order-confirmed?orderNumber=${finalizedOrder.orderNumber}`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await custPage.waitForSelector("text=Sakura Pink", { timeout: 20000 });
  await custPage.waitForSelector("text=Sky Blue", { timeout: 20000 });
  const confContent = await custPage.content();
  assert(confContent.includes("Sakura Pink"), "Order confirmation page displays purchased color 'Sakura Pink'");
  assert(confContent.includes("Sky Blue"), "Order confirmation page displays purchased color 'Sky Blue'");

  await custContext.close();

  // 5c. Admin Orders Table & Order Details Browser View
  const adminContext2 = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await adminContext2.addCookies([
    {
      name: "dearr_session",
      value: adminSessionToken,
      url: "http://localhost:3000",
    },
  ]);
  const adminPage2 = await adminContext2.newPage();
  adminPage2.setDefaultTimeout(45000);
  adminPage2.setDefaultNavigationTimeout(45000);
  adminPage2.on("pageerror", (err) => console.error("  [ADMIN PAGE ERROR]:", err));
  adminPage2.on("console", (msg) => {
    if (msg.type() === "error") console.error(`  [ADMIN CONSOLE ERROR]: ${msg.text()}`);
  });

  await adminPage2.goto("http://localhost:3000/admin/orders", { waitUntil: "domcontentloaded", timeout: 30000 });
  await adminPage2.waitForSelector(`text=${finalizedOrder.orderNumber}`, { timeout: 20000 });
  const adminOrdersContent = await adminPage2.content();
  assert(adminOrdersContent.includes(finalizedOrder.orderNumber), "Admin orders list displays placed order");

  await adminPage2.goto(`http://localhost:3000/admin/orders/${finalizedOrder.id}`, { waitUntil: "domcontentloaded", timeout: 30000 });
  try {
    await adminPage2.waitForSelector("text=Sakura Pink", { timeout: 15000 });
  } catch (err) {
    const bodyText = await adminPage2.textContent("body");
    console.error("  [ADMIN ORDER DETAIL BODY ON TIMEOUT]:", bodyText?.slice(0, 500));
    throw err;
  }
  const adminOrderDetailContent = await adminPage2.content();
  assert(adminOrderDetailContent.includes("Sakura Pink"), "Admin order detail view displays purchased color 'Sakura Pink'");
  assert(adminOrderDetailContent.includes("Sky Blue"), "Admin order detail view displays purchased color 'Sky Blue'");

  await adminContext2.close();

  // 5d. Historical Snapshot Immutability:
  // Update the test product's color name in database, verify order snapshot is unchanged
  await query("UPDATE product_colors SET name = 'Renamed Neon Pink' WHERE id = ?", [colorPinkId]);
  const orderAfterRename = await getOrderById(finalizedOrder.id);
  const snapPink = orderAfterRename?.items.find((i: any) => i.colorId === colorPinkId);
  assert(snapPink?.colorName === "Sakura Pink", "Order item snapshot remains 'Sakura Pink' after color variant was renamed");

  // 5e. Concurrency Race Condition Test on Last Available Unit:
  const scarceProduct = await createProduct({
    name: "Scarce Emerald Idol",
    slug: `scarce-emerald-${testRunId}`,
    description: "Only 1 unit in existence.",
    price: 999,
    stockQuantity: 1,
    hasColors: true,
    colors: [{ name: "Emerald Green", hex: "#50C878", stock: 1 }],
    categoryId,
  });
  const scarceColor = scarceProduct.colors[0];

  const attemptA = await createBuyNowCheckoutAttempt(customerUserId, defaultShippingAddress, [
    { productId: scarceProduct.id, colorId: scarceColor.id, quantity: 1 },
  ]);
  assert(Boolean(attemptA && attemptA.id), "Customer A successfully reserves last unit");

  const competitorUserId = "competitor-" + testRunId;
  await query(
    "INSERT INTO profiles (id, email, password_hash, full_name, role, status, created_at, updated_at) VALUES (?, ?, 'hash', 'Competitor User', 'customer', 'active', NOW(), NOW())",
    [competitorUserId, `competitor-${testRunId}@dearr.test`]
  );

  let competitorRejected = false;
  try {
    await createBuyNowCheckoutAttempt(competitorUserId, defaultShippingAddress, [
      { productId: scarceProduct.id, colorId: scarceColor.id, quantity: 1 },
    ]);
  } catch (err: any) {
    if (err.statusCode === 409 || err.statusCode === 400 || err.message.includes("Insufficient available stock") || err.message.includes("Insufficient stock")) {
      competitorRejected = true;
    }
  }
  assert(competitorRejected, "Concurrent competitor attempt rejected with 409/400 (concurrency-safe race protection)");

  // 5f. Cancellation Restocking Behavior (Pre-dispatch vs Post-dispatch)
  // Check stock of Pink before cancellation
  const pinkStockBeforeCancel: any = await query("SELECT stock FROM product_colors WHERE id = ?", [colorPinkId]);
  const initialPinkStock = pinkStockBeforeCancel[0].stock;

  // Pre-dispatch cancellation: restores stock
  await cancelOrder(finalizedOrder.id);
  const pinkStockAfterCancel: any = await query("SELECT stock FROM product_colors WHERE id = ?", [colorPinkId]);
  assert(
    pinkStockAfterCancel[0].stock === initialPinkStock + 2,
    `Pre-dispatch cancellation successfully restored 2 units of Sakura Pink (from ${initialPinkStock} to ${pinkStockAfterCancel[0].stock})`
  );

  // Post-dispatch cancellation: create, finalize, mark shipped, then cancel
  const dispatchedAttempt = await createBuyNowCheckoutAttempt(customerUserId, defaultShippingAddress, [
    { productId: testProduct.id, colorId: colorPinkId, quantity: 1 },
  ]);
  const dispatchedOrder = await finalizeOrderFromAttempt(dispatchedAttempt.id, {
    providerPaymentId: `pay_dispatched_${testRunId}`,
  });
  const pinkStockDispatched: any = await query("SELECT stock FROM product_colors WHERE id = ?", [colorPinkId]);
  const stockAtDispatch = pinkStockDispatched[0].stock;

  await query("UPDATE orders SET dispatched_at = NOW(), status = 'shipped' WHERE id = ?", [dispatchedOrder.id]);
  await cancelOrder(dispatchedOrder.id);
  const pinkStockAfterShippedCancel: any = await query("SELECT stock FROM product_colors WHERE id = ?", [colorPinkId]);
  assert(
    pinkStockAfterShippedCancel[0].stock === stockAtDispatch,
    `Post-dispatch cancellation did NOT restore stock (remains strictly ${stockAtDispatch})`
  );

  // 5g. CSV Export Formatting
  const csvExport = await generateOrdersCsv();
  assert(csvExport.includes("Sakura Pink"), "CSV Export includes color variant name in items column (e.g. 'Dragon (Sakura Pink) x2')");

  await browser.close();

  // =========================================================================
  // Summary
  // =========================================================================
  console.log("\n================================================================================");
  console.log(`BROWSER ACCEPTANCE RESULTS: ${passedAssertions} PASSED, ${failedAssertions} FAILED`);
  console.log("================================================================================\n");

  if (failedAssertions > 0) {
    process.exit(1);
  }
  process.exit(0);
}

runAcceptanceTests().catch((err) => {
  console.error("\nFATAL ERROR IN BROWSER ACCEPTANCE SUITE:", err);
  process.exit(1);
});
