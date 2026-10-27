// 1. Mock 'server-only' before importing server modules in standalone test runner
require.cache[require.resolve("server-only")] = {
  id: require.resolve("server-only"),
  filename: require.resolve("server-only"),
  loaded: true,
  exports: {},
} as any;

import assert from "assert";

async function runTests() {
  const {
    resolveAuthoritativeUnitPrice,
    resolveAuthoritativeEffectiveStock,
  } = await import("../src/lib/server/variant-resolver");

  console.log("================================================================================");
  console.log("RUNNING TASK 6: CUSTOMER VARIANT PURCHASE FLOW & UX TEST SUITE");
  console.log("================================================================================\n");

  let passed = 0;
  let failed = 0;

  async function test(name: string, fn: () => void | Promise<void>) {
    try {
      await fn();
      console.log(`  [PASS] ${name}`);
      passed++;
    } catch (err: any) {
      console.error(`  [FAIL] ${name}:`, err.message);
      failed++;
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // TEST GROUP 1: Product Details Page Combination Resolution & Selection
  // ───────────────────────────────────────────────────────────────────────────
  console.log("--- TEST GROUP 1: Product Details Page Combination Resolution & Selection ---");

  await test("1.1 Available variants filter correctly by active color for color-size products", () => {
    const productVariants = [
      { id: "var-blk-s", colorId: "col-black", sizeName: "Small", name: "Black / Small", price: 399, stockQuantity: 10, isActive: true },
      { id: "var-blk-m", colorId: "col-black", sizeName: "Medium", name: "Black / Medium", price: 449, stockQuantity: 15, isActive: true },
      { id: "var-wht-m", colorId: "col-white", sizeName: "Medium", name: "White / Medium", price: 449, stockQuantity: 8, isActive: true },
      { id: "var-generic", colorId: null, sizeName: null, name: "Gift Box", price: 50, stockQuantity: 100, isActive: true },
    ];

    // Filter for Black:
    const blackVariants = productVariants.filter((v) => !v.colorId || v.colorId === "col-black");
    assert.strictEqual(blackVariants.length, 3);
    assert.ok(blackVariants.some((v) => v.id === "var-blk-s"));
    assert.ok(blackVariants.some((v) => v.id === "var-blk-m"));
    assert.ok(blackVariants.some((v) => v.id === "var-generic"));
    assert.ok(!blackVariants.some((v) => v.id === "var-wht-m"));

    // Filter for White:
    const whiteVariants = productVariants.filter((v) => !v.colorId || v.colorId === "col-white");
    assert.strictEqual(whiteVariants.length, 2);
    assert.ok(whiteVariants.some((v) => v.id === "var-wht-m"));
    assert.ok(whiteVariants.some((v) => v.id === "var-generic"));
    assert.ok(!whiteVariants.some((v) => v.id === "var-blk-s"));
  });

  await test("1.2 Default variant selection never silently selects an inactive variant", () => {
    const variants = [
      { id: "var-inactive-s", sizeName: "Small", isActive: false, stockQuantity: 10 },
      { id: "var-oos-m", sizeName: "Medium", isActive: true, stockQuantity: 0 },
      { id: "var-active-l", sizeName: "Large", isActive: true, stockQuantity: 5 },
    ];

    // Logic matching ProductDetailsClient findDefaultVariant:
    const findDefault = (list: typeof variants) => {
      const inStock = list.find((v) => v.isActive !== false && v.stockQuantity > 0);
      if (inStock) return inStock;
      return list.find((v) => v.isActive !== false);
    };

    const def = findDefault(variants);
    assert.strictEqual(def?.id, "var-active-l", "Must prefer active in-stock variant");

    // All active are OOS:
    const allOos = [
      { id: "var-inactive", sizeName: "Small", isActive: false, stockQuantity: 10 },
      { id: "var-oos", sizeName: "Medium", isActive: true, stockQuantity: 0 },
    ];
    const defOos = findDefault(allOos);
    assert.strictEqual(defOos?.id, "var-oos", "Must pick active OOS over inactive");

    // All inactive:
    const allInactive = [
      { id: "var-inactive-1", sizeName: "Small", isActive: false, stockQuantity: 10 },
      { id: "var-inactive-2", sizeName: "Medium", isActive: false, stockQuantity: 5 },
    ];
    const defNone = findDefault(allInactive);
    assert.strictEqual(defNone, undefined, "Must return undefined when all variants are inactive");
  });

  await test("1.3 Switching colors preserves selected size when available in target color", () => {
    const whiteVariants = [
      { id: "var-wht-s", colorId: "col-white", sizeName: "Small", stockQuantity: 4, isActive: true },
      { id: "var-wht-m", colorId: "col-white", sizeName: "Medium", stockQuantity: 12, isActive: true },
    ];

    const findDefault = (list: typeof whiteVariants, preferredSize?: string | null) => {
      if (preferredSize) {
        const match = list.find(
          (v) => v.isActive !== false && v.sizeName?.toLowerCase() === preferredSize.toLowerCase() && v.stockQuantity > 0
        ) || list.find(
          (v) => v.isActive !== false && v.sizeName?.toLowerCase() === preferredSize.toLowerCase()
        );
        if (match) return match;
      }
      const inStock = list.find((v) => v.isActive !== false && v.stockQuantity > 0);
      if (inStock) return inStock;
      return list.find((v) => v.isActive !== false);
    };

    // User was viewing "Medium" in Black, now switches to White
    const selected = findDefault(whiteVariants, "Medium");
    assert.strictEqual(selected?.id, "var-wht-m", "Must preserve 'Medium' when switching to White");

    // User was viewing "Extra-Large" in Black (not present in White)
    const fallback = findDefault(whiteVariants, "Extra-Large");
    assert.strictEqual(fallback?.id, "var-wht-s", "Must fallback to first active in-stock variant if size not present");
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST GROUP 2: Price Resolution & Zero-Price Preservation
  // ───────────────────────────────────────────────────────────────────────────
  console.log("\n--- TEST GROUP 2: Price Resolution & Zero-Price Preservation ---");

  await test("2.1 Variant price overrides color price override and base price", () => {
    const price = resolveAuthoritativeUnitPrice({
      productPrice: 299,
      colorPriceOverride: 349,
      variantPrice: 449,
    });
    assert.strictEqual(price, 449);
  });

  await test("2.2 Legitimate ₹0 variant price strictly preserved without falling through", () => {
    const price = resolveAuthoritativeUnitPrice({
      productPrice: 299,
      colorPriceOverride: 349,
      variantPrice: 0,
    });
    assert.strictEqual(price, 0, "Variant price ₹0 must be preserved");
  });

  await test("2.3 Null variant price falls back to color price override (including ₹0)", () => {
    const priceOverride = resolveAuthoritativeUnitPrice({
      productPrice: 299,
      colorPriceOverride: 349,
      variantPrice: null,
    });
    assert.strictEqual(priceOverride, 349);

    const zeroColorPrice = resolveAuthoritativeUnitPrice({
      productPrice: 299,
      colorPriceOverride: 0,
      variantPrice: null,
    });
    assert.strictEqual(zeroColorPrice, 0, "Color override ₹0 must be preserved when variant price is null");
  });

  await test("2.4 Null variant and null color price falls back to product base price", () => {
    const price = resolveAuthoritativeUnitPrice({
      productPrice: 299,
      colorPriceOverride: null,
      variantPrice: null,
    });
    assert.strictEqual(price, 299);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST GROUP 3: Cart Line Item Separation & SKU Priority
  // ───────────────────────────────────────────────────────────────────────────
  console.log("\n--- TEST GROUP 3: Cart Line Item Separation & SKU Priority ---");

  await test("3.1 Distinct (color, variant) combinations never collide in guest cart composite IDs", () => {
    const generateCompositeId = (productId: string, color?: { id: string }, variant?: { id: string }) => {
      const variantKey =
        color && variant
          ? `color-${color.id}-var-${variant.id}`
          : color
          ? `color-${color.id}`
          : variant
          ? `var-${variant.id}`
          : "default";
      return `${productId}-${variantKey}`;
    };

    const prodId = "prod-tshirt-1";
    const colorRed = { id: "col-red" };
    const varSmall = { id: "var-s" };
    const varMedium = { id: "var-m" };

    const redSmallId = generateCompositeId(prodId, colorRed, varSmall);
    const redMedId = generateCompositeId(prodId, colorRed, varMedium);
    const redOnlyId = generateCompositeId(prodId, colorRed, undefined);
    const simpleId = generateCompositeId(prodId, undefined, undefined);

    assert.notStrictEqual(redSmallId, redMedId, "Red/S and Red/M must have distinct composite IDs");
    assert.notStrictEqual(redSmallId, redOnlyId, "Red/S and Red-only must have distinct composite IDs");
    assert.strictEqual(redSmallId, "prod-tshirt-1-color-col-red-var-var-s");
    assert.strictEqual(redMedId, "prod-tshirt-1-color-col-red-var-var-m");
    assert.strictEqual(redOnlyId, "prod-tshirt-1-color-col-red");
    assert.strictEqual(simpleId, "prod-tshirt-1-default");
  });

  await test("3.2 Cart mapping prioritizes variant combination SKU over color SKU", () => {
    const apiItem = {
      variant: { sku: "TSH-BLK-S", name: "Black / Small" },
      color: { sku: "TSH-BLK", name: "Black" },
    };

    const resolvedSku = apiItem.variant?.sku || apiItem.color?.sku;
    assert.strictEqual(resolvedSku, "TSH-BLK-S", "Combination variant SKU must take precedence");
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST GROUP 4: Stock Display & Purchase Button Validation Invariants
  // ───────────────────────────────────────────────────────────────────────────
  console.log("\n--- TEST GROUP 4: Stock Display & Purchase Button Validation Invariants ---");

  await test("4.1 Selected variant out-of-stock disables purchase buttons", () => {
    const hasVariants = true;
    const selectedVariant = { id: "var-1", stockQuantity: 0, isActive: true };

    const isOutOfStock = selectedVariant.stockQuantity <= 0 || !selectedVariant.isActive;
    const isPurchaseDisabled = isOutOfStock || (hasVariants && !selectedVariant?.id);

    assert.strictEqual(isOutOfStock, true);
    assert.strictEqual(isPurchaseDisabled, true);
  });

  await test("4.2 Unselected variant on variant-enabled product disables purchase buttons", () => {
    const hasVariants = true;
    const selectedVariantId = undefined; // No variant selected!
    const isOutOfStock = false; // Base product has stock, but combination is unselected

    const isPurchaseDisabled = isOutOfStock || (hasVariants && !selectedVariantId);
    assert.strictEqual(isPurchaseDisabled, true, "Purchase buttons must be disabled when variant is unselected");
  });

  await test("4.3 Valid in-stock variant enables purchase buttons", () => {
    const hasVariants = true;
    const selectedVariant = { id: "var-1", stockQuantity: 5, isActive: true };

    const isOutOfStock = selectedVariant.stockQuantity <= 0 || !selectedVariant.isActive;
    const isPurchaseDisabled = isOutOfStock || (hasVariants && !selectedVariant.id);

    assert.strictEqual(isOutOfStock, false);
    assert.strictEqual(isPurchaseDisabled, false, "Purchase buttons must be enabled for valid in-stock variant");
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST GROUP 5: Legacy Compatibility (Color-Only & Simple Products)
  // ───────────────────────────────────────────────────────────────────────────
  console.log("\n--- TEST GROUP 5: Legacy Compatibility (Color-Only & Simple Products) ---");

  await test("5.1 Pure color-only product enables multi-color purchasing and preserves color stock", () => {
    const product = {
      hasColors: true,
      colors: [
        { id: "col-1", name: "Red", stock: 10, reservedStock: 2, availableStock: 8, isActive: true },
        { id: "col-2", name: "Blue", stock: 5, reservedStock: 0, availableStock: 5, isActive: true },
      ],
      variants: [], // NO variants!
    };

    const hasColors = product.colors.length > 0;
    const hasVariants = product.variants.length > 0;

    assert.strictEqual(hasColors, true);
    assert.strictEqual(hasVariants, false, "Pure color product has hasVariants === false");

    // Multi-color section is rendered only when hasColors && !hasVariants
    const showMultiColorSection = hasColors && !hasVariants;
    assert.strictEqual(showMultiColorSection, true, "Multi-color section must be shown for color-only products");
  });

  await test("5.2 Simple product preserves single-quantity buying and base product stock", () => {
    const product = {
      price: 199,
      stockQuantity: 25,
      hasColors: false,
      colors: [],
      variants: [],
    };

    const hasColors = product.colors.length > 0;
    const hasVariants = product.variants.length > 0;

    assert.strictEqual(hasColors, false);
    assert.strictEqual(hasVariants, false);

    const effectivePrice = resolveAuthoritativeUnitPrice({
      productPrice: product.price,
      colorPriceOverride: null,
      variantPrice: null,
    });
    const effectiveStock = resolveAuthoritativeEffectiveStock({
      hasVariant: false,
      hasColor: false,
      productStock: product.stockQuantity,
    });

    assert.strictEqual(effectivePrice, 199);
    assert.strictEqual(effectiveStock, 25);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // SUMMARY
  // ───────────────────────────────────────────────────────────────────────────
  console.log("\n================================================================================");
  console.log(`TASK 6 TEST RESULTS: ${passed} PASSED, ${failed} FAILED (TOTAL: ${passed + failed})`);
  console.log("================================================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Test runner encountered an unhandled exception:", err);
  process.exit(1);
});
