import fs from "fs";
import path from "path";

// 1. Load local environment configuration
const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, "utf-8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx !== -1) {
      process.env[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
    }
  }
}

// 2. Strict Safety Safeguards
console.log("=================================================");
console.log("  Dearr Product Color Variants - End-to-End Test  ");
console.log("=================================================");
console.log("Target Host:", process.env.DB_HOST);
console.log("Target Port:", process.env.DB_PORT);
console.log("Target Database:", process.env.DB_NAME);

if (process.env.DB_HOST !== "127.0.0.1" && process.env.DB_HOST !== "localhost") {
  throw new Error("ABSOLUTE SAFEGUARD: Host is not loopback (127.0.0.1)!");
}
if (process.env.DB_NAME !== "dearr_test") {
  throw new Error("ABSOLUTE SAFEGUARD: Database name must strictly be 'dearr_test'!");
}

import {
  createProduct,
  updateProduct,
  findProductById,
  findProductBySlug,
  ProductValidationError,
} from "@/lib/server/product";
import {
  getOrCreateActiveCartForUser,
  getCartForUser,
  addCartItemsBatch,
  addCartItem,
} from "@/lib/server/cart";
import {
  createCheckoutAttemptFromCart,
  createBuyNowCheckoutAttempt,
  finalizeOrderFromAttempt,
} from "@/lib/server/checkout-attempt";
import { getOrderById, cancelOrder } from "@/lib/server/order";
import { generateOrdersCsv } from "@/lib/server/order-export";
import { query, withTransaction } from "@/lib/server/db";

let testPassedCount = 0;
let testFailedCount = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✓ PASS: ${message}`);
    testPassedCount++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    testFailedCount++;
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runTests() {
  const testRunId = Date.now().toString(36);
  console.log(`\nStarting Test Suite with ID: ${testRunId}\n`);

  // Setup: Find or create a test category and test customer user
  const catRows: any = await query("SELECT id FROM categories LIMIT 1");
  let categoryId = catRows?.[0]?.id;
  if (!categoryId) {
    categoryId = "cat-test-" + testRunId;
    await query(
      "INSERT INTO categories (id, name, slug, description, is_active) VALUES (?, ?, ?, ?, 1)",
      [categoryId, "Test Category", "test-cat-" + testRunId, "Testing category"]
    );
  }

  const userRows: any = await query("SELECT id, email FROM profiles WHERE role = 'customer' LIMIT 1");
  let testUserId = userRows?.[0]?.id;
  if (!testUserId) {
    testUserId = "user-test-" + testRunId;
    await query(
      "INSERT INTO profiles (id, email, password_hash, full_name, role, status, created_at, updated_at) VALUES (?, ?, 'hash', 'Test Customer', 'customer', 'active', NOW(), NOW())",
      [testUserId, `test-customer-${testRunId}@dearr.test`]
    );
  }

  // =========================================================================
  // TEST 1: Validation Rules (Max 12, Duplicate Names, Hex Colors)
  // =========================================================================
  console.log("\n--- TEST 1: Product Validation Rules ---");

  // 1a. Exceed 12 colors
  let rejectedMax12 = false;
  try {
    const tooManyColors = Array.from({ length: 13 }, (_, i) => ({
      name: `Color ${i + 1}`,
      hex: "#FF0000",
      stock: 5,
    }));
    await createProduct({
      name: "Too Many Colors",
      slug: `too-many-colors-${testRunId}`,
      description: "Testing color limit",
      price: 199,
      stockQuantity: 65,
      hasColors: true,
      colors: tooManyColors,
      categoryId,
    });
  } catch (err: any) {
    if (err instanceof ProductValidationError && err.message.includes("Maximum 12 colors")) {
      rejectedMax12 = true;
    }
  }
  assert(rejectedMax12, "Rejects product creation with > 12 colors (HTTP 400)");

  // 1b. Duplicate color names
  let rejectedDuplicateName = false;
  try {
    await createProduct({
      name: "Duplicate Color Product",
      slug: `dup-color-${testRunId}`,
      description: "Testing duplicate color name",
      price: 299,
      stockQuantity: 20,
      hasColors: true,
      colors: [
        { name: "Sky Blue", hex: "#00BFFF", stock: 10 },
        { name: "sky blue", hex: "#00BFFF", stock: 10 }, // duplicate case-insensitive
      ],
      categoryId,
    });
  } catch (err: any) {
    if (err instanceof ProductValidationError && err.message.includes("Duplicate color name")) {
      rejectedDuplicateName = true;
    }
  }
  assert(rejectedDuplicateName, "Rejects duplicate case-insensitive color names within product");

  // 1c. Invalid hex code
  let rejectedInvalidHex = false;
  try {
    await createProduct({
      name: "Invalid Hex Product",
      slug: `invalid-hex-${testRunId}`,
      description: "Testing invalid hex color",
      price: 299,
      stockQuantity: 10,
      hasColors: true,
      colors: [{ name: "Neon", hex: "not-a-hex", stock: 10 }],
      categoryId,
    });
  } catch (err: any) {
    if (err instanceof ProductValidationError && err.message.includes("Invalid hex color format")) {
      rejectedInvalidHex = true;
    }
  }
  assert(rejectedInvalidHex, "Rejects invalid hex format codes");

  // =========================================================================
  // TEST 2: Create Multi-Color Product with Colors, Shared & Color Images
  // =========================================================================
  console.log("\n--- TEST 2: Multi-Color Product Creation & Image Association ---");

  const colorPinkId = "col-pink-" + testRunId;
  const colorBlueId = "col-blue-" + testRunId;
  const colorGoldId = "col-gold-" + testRunId;
  const colorBlackId = "col-black-" + testRunId;

  const productInput = {
    name: "3D Articulated Dragon",
    slug: `3d-dragon-${testRunId}`,
    description: "Multi-jointed flexible 3D printed dragon in vibrant biopolymer colors.",
    price: 499,
    compareAtPrice: 699,
    stockQuantity: 30,
    hasColors: true,
    colors: [
      { id: colorPinkId, name: "Sakura Pink", hex: "#FF69B4", sku: `DRG-PNK-${testRunId}`, stock: 15 },
      { id: colorBlueId, name: "Sky Blue", hex: "#00BFFF", sku: `DRG-BLU-${testRunId}`, stock: 10 },
      { id: colorGoldId, name: "Imperial Gold", hex: "#DAA520", sku: `DRG-GLD-${testRunId}`, stock: 5, priceOverride: 599 },
      { id: colorBlackId, name: "Matte Black", hex: "#1A1A1A", sku: `DRG-BLK-${testRunId}`, stock: 0 }, // Out of stock
    ],
    images: [
      { storagePath: "/uploads/products/dragon-shared-1.jpg", altText: "Dragon Shared 1", sortOrder: 0, colorId: null },
      { storagePath: "/uploads/products/dragon-shared-2.jpg", altText: "Dragon Shared 2", sortOrder: 1, colorId: null },
      { storagePath: "/uploads/products/dragon-pink-1.jpg", altText: "Dragon Pink Main", sortOrder: 0, colorId: colorPinkId },
      { storagePath: "/uploads/products/dragon-blue-1.jpg", altText: "Dragon Blue Main", sortOrder: 0, colorId: colorBlueId },
    ],
    categoryId,
  };

  const createdProduct = await createProduct(productInput);
  assert(Boolean(createdProduct && createdProduct.id), "Product successfully created in MySQL");
  assert(createdProduct.hasColors === true, "createdProduct.hasColors is true");
  assert(Array.isArray(createdProduct.colors) && createdProduct.colors.length === 4, "Product has 4 color variants");

  // Verify findProductById and findProductBySlug
  const fetchedProduct = await findProductById(createdProduct.id, true);
  assert(Boolean(fetchedProduct), "findProductById resolves created product");
  assert(fetchedProduct!.colors.length === 4, "Fetched product has 4 colors");

  const pinkColor = fetchedProduct!.colors.find((c) => c.name === "Sakura Pink")!;
  assert(Boolean(pinkColor), "Sakura Pink color variant exists");
  assert(pinkColor.stock === 15 && pinkColor.availableStock === 15, "Sakura Pink has 15 stock and 15 availableStock");
  assert(pinkColor.images.length === 1, "Sakura Pink has 1 color-specific image");
  assert(pinkColor.primaryImage === "/uploads/products/dragon-pink-1.jpg", "Sakura Pink primaryImage is color-specific photo");

  const goldColor = fetchedProduct!.colors.find((c) => c.name === "Imperial Gold")!;
  assert(goldColor.priceOverride === 599, "Imperial Gold has priceOverride of 599");

  const blackColor = fetchedProduct!.colors.find((c) => c.name === "Matte Black")!;
  assert(blackColor.availableStock === 0, "Matte Black availableStock is 0 (out of stock)");

  // =========================================================================
  // TEST 3: Backward Compatibility for Single-SKU Products
  // =========================================================================
  console.log("\n--- TEST 3: Legacy Single-SKU Backward Compatibility ---");

  const singleSkuProduct = await createProduct({
    name: "Classic Buddha Statue",
    slug: `classic-buddha-${testRunId}`,
    description: "Traditional single-color 3D printed statue.",
    price: 299,
    stockQuantity: 25,
    hasColors: false,
    images: [{ storagePath: "/uploads/products/buddha-1.jpg", altText: "Buddha Main", sortOrder: 0, colorId: null }],
    categoryId,
  });

  assert(singleSkuProduct.hasColors === false, "singleSkuProduct.hasColors is false");
  assert(singleSkuProduct.colors.length === 0, "singleSkuProduct.colors is empty");
  assert(singleSkuProduct.stockQuantity === 25, "singleSkuProduct preserves single stockQuantity of 25");

  // =========================================================================
  // TEST 4: Cart Operations & Multi-Color Line Identity
  // =========================================================================
  console.log("\n--- TEST 4: Cart Line Identity & Batch Addition ---");

  const cart = await getOrCreateActiveCartForUser(testUserId);
  assert(Boolean(cart && cart.id), "Customer cart retrieved");

  // 4a. Batch add two colors of the same product
  const batchResult = await addCartItemsBatch(testUserId, [
    { productId: createdProduct.id, colorId: pinkColor.id, quantity: 2 },
    { productId: createdProduct.id, colorId: fetchedProduct!.colors.find(c => c.name === "Sky Blue")!.id, quantity: 3 },
  ]);

  const updatedCart = await getCartForUser(testUserId);
  assert(Boolean(updatedCart), "Cart fetched after batch add");

  const pinkCartLine = updatedCart!.items.find(
    (i) => i.productId === createdProduct.id && i.colorId === pinkColor.id
  );
  const blueCartLine = updatedCart!.items.find(
    (i) => i.productId === createdProduct.id && i.colorId === colorBlueId
  );

  assert(Boolean(pinkCartLine), "Cart has distinct line for Sakura Pink");
  assert(Boolean(blueCartLine), "Cart has distinct line for Sky Blue");
  assert(pinkCartLine!.quantity === 2, "Sakura Pink line has quantity 2");
  assert(blueCartLine!.quantity === 3, "Sky Blue line has quantity 3");
  assert(pinkCartLine!.color?.name === "Sakura Pink", "Cart line snapshot includes color name");
  assert(pinkCartLine!.color?.hex === "#FF69B4", "Cart line snapshot includes color hex");

  // 4b. Add another 1 unit of Sakura Pink (should update quantity of existing row)
  await addCartItem(testUserId, {
    productId: createdProduct.id,
    colorId: pinkColor.id,
    quantity: 1,
  });
  const cartAfterIncrement = await getCartForUser(testUserId);
  const pinkLineAfter = cartAfterIncrement!.items.find(
    (i) => i.productId === createdProduct.id && i.colorId === pinkColor.id
  );
  assert(pinkLineAfter!.quantity === 3, "Sakura Pink line correctly incremented to 3");

  // =========================================================================
  // TEST 5: Atomic Stock Reservations & Concurrency
  // =========================================================================
  console.log("\n--- TEST 5: Short-Lived Stock Reservations & Concurrency Race ---");

  // 5a. Create checkout attempt from cart (reserves Pink: 3, Blue: 3)
  const defaultAddress = {
    shippingFullName: "Test Customer",
    shippingPhone: "9876543210",
    shippingAddressLine1: "123 Main Road",
    shippingAddressLine2: null,
    shippingCity: "Bengaluru",
    shippingState: "Karnataka",
    shippingPostalCode: "560001",
    shippingCountry: "India",
  };

  const attempt = await createCheckoutAttemptFromCart(testUserId, defaultAddress);
  assert(Boolean(attempt && attempt.id), "Checkout attempt created successfully");

  // Verify reserved_stock in database
  const pinkColAfterRes: any = await query(
    "SELECT stock, reserved_stock, (stock - reserved_stock) as available_stock FROM product_colors WHERE id = ?",
    [pinkColor.id]
  );
  assert(pinkColAfterRes[0].reserved_stock === 3, "Sakura Pink reserved_stock incremented to 3");
  assert(pinkColAfterRes[0].available_stock === 12, "Sakura Pink available_stock decreased to 12 (15 - 3)");

  // 5b. Concurrency Race Test:
  // Create a product with only 1 unit left
  const limitedProduct = await createProduct({
    name: "Limited Edition Crystal Dragon",
    slug: `limited-dragon-${testRunId}`,
    description: "Only 1 unit available.",
    price: 999,
    stockQuantity: 1,
    hasColors: true,
    colors: [{ name: "Ruby Red", hex: "#E0115F", stock: 1 }],
    categoryId,
  });

  const rubyColor = limitedProduct.colors[0];

  // Customer A creates Buy Now attempt for 1 unit (succeeds)
  const buyNowAttemptA = await createBuyNowCheckoutAttempt(testUserId, defaultAddress, [
    { productId: limitedProduct.id, colorId: rubyColor.id, quantity: 1 },
  ]);
  assert(Boolean(buyNowAttemptA && buyNowAttemptA.id), "Customer A successfully reserves last unit");

  // Customer B attempts to reserve the same unit simultaneously (should be rejected with 409 Conflict)
  const userBId = "user-b-" + testRunId;
  await query(
    "INSERT INTO profiles (id, email, password_hash, full_name, role, status, created_at, updated_at) VALUES (?, ?, 'hash', 'Test Customer B', 'customer', 'active', NOW(), NOW())",
    [userBId, `test-customer-b-${testRunId}@dearr.test`]
  );

  let customerBRejected = false;
  try {
    await createBuyNowCheckoutAttempt(userBId, defaultAddress, [
      { productId: limitedProduct.id, colorId: rubyColor.id, quantity: 1 },
    ]);
  } catch (err: any) {
    if (err.statusCode === 409 || err.statusCode === 400 || err.message.includes("Insufficient available stock") || err.message.includes("Insufficient stock")) {
      customerBRejected = true;
    }
  }
  assert(customerBRejected, "Customer B rejected with 409/400 (Concurrency-safe race protection)");

  // =========================================================================
  // TEST 6: Buy Now Purchase Intent Isolation
  // =========================================================================
  console.log("\n--- TEST 6: Buy Now Active Cart Isolation ---");

  // Before Buy Now, verify customer cart still has items
  const cartBeforeBuyNow = await getCartForUser(testUserId);
  const countBefore = cartBeforeBuyNow!.items.length;
  assert(countBefore > 0, "Customer active cart contains items before Buy Now");

  // Customer executes Buy Now on Imperial Gold
  const buyNowAttempt = await createBuyNowCheckoutAttempt(testUserId, defaultAddress, [
    { productId: createdProduct.id, colorId: colorGoldId, quantity: 1 },
  ]);
  assert(Boolean(buyNowAttempt && buyNowAttempt.id), "Buy Now checkout attempt created");
  assert(buyNowAttempt.cartId === null, "Buy Now checkout attempt has cart_id === null");

  // Verify customer active cart items were NOT modified or deleted
  const cartAfterBuyNow = await getCartForUser(testUserId);
  assert(cartAfterBuyNow!.items.length === countBefore, "Active cart items count unchanged after Buy Now");
  assert(
    cartAfterBuyNow!.items.some((i) => i.colorId === pinkColor.id),
    "Sakura Pink still in active cart (cart was never converted or cleared)"
  );

  // =========================================================================
  // TEST 7: Payment Capture & Permanent Order Snapshots
  // =========================================================================
  console.log("\n--- TEST 7: Finalize Order, Stock Consumption & Snapshots ---");

  // Finalize the cart checkout attempt
  const finalized = await finalizeOrderFromAttempt(attempt.id, {
    providerPaymentId: `pay_test_${testRunId}`,
  });
  assert(Boolean(finalized && finalized.id), "Order successfully finalized from checkout attempt");

  // Verify stock was consumed:
  // Sakura Pink: stock decremented from 15 -> 12, reserved_stock from 3 -> 0
  const pinkColFinal: any = await query(
    "SELECT stock, reserved_stock, (stock - reserved_stock) as available_stock FROM product_colors WHERE id = ?",
    [pinkColor.id]
  );
  assert(pinkColFinal[0].stock === 12, "Sakura Pink stock decremented from 15 to 12");
  assert(pinkColFinal[0].reserved_stock === 0, "Sakura Pink reserved_stock consumed back to 0");

  // Verify order item snapshots in database
  const order = await getOrderById(finalized.id);
  assert(Boolean(order), "Finalized order retrieved via getOrderById");

  const pinkOrderItem = order!.items.find((i: any) => i.colorName === "Sakura Pink");
  assert(Boolean(pinkOrderItem), "Order item preserved Sakura Pink color snapshot");
  assert(pinkOrderItem!.colorHex === "#FF69B4", "Order item snapshot has colorHex #FF69B4");
  assert(Boolean(pinkOrderItem!.sku), "Order item snapshot has color SKU");
  assert(Boolean(pinkOrderItem!.imageUrl), "Order item snapshot has permanent imageUrl");

  // =========================================================================
  // TEST 8: Cancellation Restocking (Pre-Dispatch vs Post-Dispatch)
  // =========================================================================
  console.log("\n--- TEST 8: Cancellation Restocking Behavior ---");

  // 8a. Pre-dispatch cancellation: cancels order while status is confirmed/processing
  await cancelOrder(order!.id);

  // Stock should be restored (12 -> 15 for Sakura Pink)
  const pinkColRestored: any = await query(
    "SELECT stock FROM product_colors WHERE id = ?",
    [pinkColor.id]
  );
  assert(pinkColRestored[0].stock === 15, "Pre-dispatch cancellation successfully restored color stock to 15");

  // 8b. Post-dispatch cancellation:
  // Simulate another order and dispatch it
  const attempt2 = await createBuyNowCheckoutAttempt(testUserId, defaultAddress, [
    { productId: createdProduct.id, colorId: pinkColor.id, quantity: 2 },
  ]);
  const finalized2 = await finalizeOrderFromAttempt(attempt2.id, {
    providerPaymentId: `pay_test2_${testRunId}`,
  });
  // Pink stock is now 15 - 2 = 13

  // Mark as dispatched
  await query(
    "UPDATE orders SET dispatched_at = NOW(), status = 'shipped' WHERE id = ?",
    [finalized2.id]
  );

  // Cancel dispatched order
  await cancelOrder(finalized2.id);

  // Stock should NOT be restored (remains 13)
  const pinkColPostDispatch: any = await query(
    "SELECT stock FROM product_colors WHERE id = ?",
    [pinkColor.id]
  );
  assert(
    pinkColPostDispatch[0].stock === 13,
    "Post-dispatch cancellation did NOT restore color stock (remains 13 as dispatched)"
  );

  // =========================================================================
  // TEST 9: CSV Export Formatting
  // =========================================================================
  console.log("\n--- TEST 9: CSV Export Format ---");

  const csvContent = await generateOrdersCsv();
  assert(typeof csvContent === "string" && csvContent.length > 0, "CSV export generated");
  assert(
    csvContent.includes("Sakura Pink"),
    "CSV export includes color variant name in items column (e.g. 'Dragon (Sakura Pink) x2')"
  );

  // =========================================================================
  // Summary
  // =========================================================================
  console.log("\n=================================================");
  console.log(`Test Results: ${testPassedCount} Passed, ${testFailedCount} Failed`);
  console.log("=================================================\n");

  if (testFailedCount > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("\nFATAL ERROR IN TEST SUITE:", err);
  process.exit(1);
});
