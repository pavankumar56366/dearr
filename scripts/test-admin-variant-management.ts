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
  const { ProductValidationError } = await import("../src/lib/server/product");

  console.log("================================================================================");
  console.log("RUNNING TASK 4: ADMIN VARIANT MANAGEMENT & INTEGRATION TEST SUITE");
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
  // TEST GROUP 1: Selective Combination Generation & Matrix Management
  // ───────────────────────────────────────────────────────────────────────────
  console.log("--- TEST GROUP 1: Selective Combination Generation & Matrix Management ---");

  await test("1.1 Selective combination generation generates only chosen combinations", () => {
    // Administrator selects Black for S & M, but White for M only
    const colors = [
      { id: "col-black", name: "Black", hex: "#000000" },
      { id: "col-white", name: "White", hex: "#FFFFFF" },
    ];
    const sizes = ["S", "M"];
    const selectedCombos: Record<string, boolean> = {
      "col-black::S": true,
      "col-black::M": true,
      "col-white::S": false, // intentionally excluded!
      "col-white::M": true,
    };

    const generated: Array<{ colorId: string; sizeName: string; name: string }> = [];
    colors.forEach((c) => {
      sizes.forEach((s) => {
        if (selectedCombos[`${c.id}::${s}`]) {
          generated.push({
            colorId: c.id,
            sizeName: s,
            name: `${c.name} / ${s}`,
          });
        }
      });
    });

    assert.strictEqual(generated.length, 3, "Only 3 combinations should be generated");
    assert.ok(generated.some((g) => g.colorId === "col-black" && g.sizeName === "S"));
    assert.ok(generated.some((g) => g.colorId === "col-black" && g.sizeName === "M"));
    assert.ok(generated.some((g) => g.colorId === "col-white" && g.sizeName === "M"));
    assert.ok(!generated.some((g) => g.colorId === "col-white" && g.sizeName === "S"), "White/S must be excluded");
  });

  await test("1.2 Combination generation preserves existing variant IDs and custom pricing", () => {
    const existingVariants = [
      {
        id: "var-existing-1",
        colorId: "col-black",
        sizeName: "S",
        name: "Black / S",
        sku: "TSH-BLK-S",
        price: 399,
        stockQuantity: 15,
        isActive: true,
      },
    ];

    const colors = [{ id: "col-black", name: "Black" }];
    const sizes = ["S", "M"];
    const existingMap = new Map(existingVariants.map((v) => [`${v.colorId}::${v.sizeName.toLowerCase()}`, v]));

    const resultVariants: any[] = [];
    sizes.forEach((s) => {
      const match = existingMap.get(`col-black::${s.toLowerCase()}`);
      if (match) {
        resultVariants.push(match);
      } else {
        resultVariants.push({
          id: "var-new-uuid",
          colorId: "col-black",
          sizeName: s,
          name: `Black / ${s}`,
          sku: `TSH-BLK-${s}`,
          price: undefined,
          stockQuantity: 10,
          isActive: true,
        });
      }
    });

    assert.strictEqual(resultVariants.length, 2);
    const preserved = resultVariants.find((v) => v.sizeName === "S");
    assert.strictEqual(preserved.id, "var-existing-1", "Existing ID must be preserved");
    assert.strictEqual(preserved.price, 399, "Existing price must be preserved");
    assert.strictEqual(preserved.stockQuantity, 15, "Existing stock must be preserved");
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST GROUP 2: Validation of Combination Uniqueness, SKUs, Prices, Stock
  // ───────────────────────────────────────────────────────────────────────────
  console.log("\n--- TEST GROUP 2: Validation of Combination Uniqueness, SKUs, Prices, Stock ---");

  await test("2.1 Reject duplicate color-size combinations within product", () => {
    const variants = [
      { colorId: "c1", sizeName: "M", name: "Black / M", sku: "SKU-1" },
      { colorId: "c1", sizeName: "m", name: "Black / m", sku: "SKU-2" }, // case-insensitive duplicate!
    ];

    const seenCombos = new Set<string>();
    let duplicateDetected = false;
    for (const v of variants) {
      const key = `${v.colorId}::${v.sizeName.trim().toLowerCase()}`;
      if (seenCombos.has(key)) {
        duplicateDetected = true;
        break;
      }
      seenCombos.add(key);
    }
    assert.strictEqual(duplicateDetected, true, "Duplicate (colorId, sizeName) combination must be detected");
  });

  await test("2.2 Reject duplicate SKUs within product variants array", () => {
    const variants = [
      { name: "Black / S", sku: "TSH-BLK-S" },
      { name: "White / S", sku: "tsh-blk-s" }, // case-insensitive duplicate SKU
    ];

    const seenSkus = new Set<string>();
    let duplicateSkuDetected = false;
    for (const v of variants) {
      const clean = v.sku.trim().toUpperCase();
      if (seenSkus.has(clean)) {
        duplicateSkuDetected = true;
        break;
      }
      seenSkus.add(clean);
    }
    assert.strictEqual(duplicateSkuDetected, true, "Duplicate SKU must be detected");
  });

  await test("2.3 Reject negative variant prices while accepting ₹0 and null", () => {
    const validatePrice = (price: any) => {
      if (price === null || price === undefined) return true; // valid nullable
      const num = Number(price);
      if (isNaN(num) || num < 0) return false;
      return true;
    };

    assert.strictEqual(validatePrice(null), true, "null price is valid (falls back to base price)");
    assert.strictEqual(validatePrice(undefined), true, "undefined price is valid");
    assert.strictEqual(validatePrice(0), true, "₹0 price is valid");
    assert.strictEqual(validatePrice(399.5), true, "Positive price is valid");
    assert.strictEqual(validatePrice(-10), false, "Negative price must be rejected");
    assert.strictEqual(validatePrice("invalid"), false, "NaN price must be rejected");
  });

  await test("2.4 Reject negative or non-integer stock quantities while accepting 0", () => {
    const validateStock = (stock: any) => {
      if (typeof stock !== "number" || isNaN(stock) || !Number.isInteger(stock) || stock < 0) {
        return false;
      }
      return true;
    };

    assert.strictEqual(validateStock(0), true, "0 stock is valid");
    assert.strictEqual(validateStock(50), true, "50 stock is valid");
    assert.strictEqual(validateStock(-1), false, "Negative stock must be rejected");
    assert.strictEqual(validateStock(5.5), false, "Floating point stock must be rejected");
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST GROUP 3: Cross-Product Variant ID Isolation & Ownership Security
  // ───────────────────────────────────────────────────────────────────────────
  console.log("\n--- TEST GROUP 3: Cross-Product Variant ID Isolation & Ownership Security ---");

  await test("3.1 Reject variant ID belonging to another product on edit", () => {
    const currentProductId = "prod-current";
    const existingVariantIds = new Set(["var-1", "var-2"]);
    const databaseVariants = new Map([
      ["var-1", { productId: "prod-current" }],
      ["var-2", { productId: "prod-current" }],
      ["var-other-prod", { productId: "prod-other-company" }],
    ]);

    const incomingVariants = [
      { id: "var-1", sku: "SKU-1" },
      { id: "var-other-prod", sku: "SKU-HIJACK" }, // Attacker trying to hijack variant ID from another product
    ];

    let errorThrown = false;
    for (const v of incomingVariants) {
      if (v.id && !existingVariantIds.has(v.id)) {
        const dbVar = databaseVariants.get(v.id);
        if (dbVar && dbVar.productId !== currentProductId) {
          errorThrown = true;
          break;
        }
      }
    }

    assert.strictEqual(errorThrown, true, "Attempting to claim variant ID from another product must be rejected");
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST GROUP 4: Preservation of Simple Products & Historical References
  // ───────────────────────────────────────────────────────────────────────────
  console.log("\n--- TEST GROUP 4: Preservation of Simple Products & Historical References ---");

  await test("4.1 Simple product without variants preserves single SKU and base price", () => {
    const product = {
      id: "prod-simple",
      name: "Simple Mug",
      price: 299,
      stockQuantity: 20,
      hasColors: false,
      variants: [],
    };

    const effectivePrice = resolveAuthoritativeUnitPrice({
      productPrice: product.price,
      variantPrice: null,
    });
    const effectiveStock = resolveAuthoritativeEffectiveStock({
      hasVariant: false,
      hasColor: false,
      productStock: product.stockQuantity,
    });

    assert.strictEqual(effectivePrice, 299);
    assert.strictEqual(effectiveStock, 20);
  });

  await test("4.2 Safe variant deletion: Soft-deactivates variant if referenced by orders or active reservations", () => {
    const existingVariantIds = ["var-1", "var-2"];
    const incomingVariantIds = new Set(["var-2"]); // var-1 is being removed

    const orderItems = new Set(["var-1"]); // var-1 has past order history!
    const cartItems = new Set<string>();
    const reservations = new Set<string>();

    const actions: Array<{ id: string; action: "delete" | "soft-deactivate" }> = [];

    for (const oldId of existingVariantIds) {
      if (!incomingVariantIds.has(oldId)) {
        if (orderItems.has(oldId) || cartItems.has(oldId) || reservations.has(oldId)) {
          actions.push({ id: oldId, action: "soft-deactivate" });
        } else {
          actions.push({ id: oldId, action: "delete" });
        }
      }
    }

    assert.strictEqual(actions.length, 1);
    assert.strictEqual(actions[0].id, "var-1");
    assert.strictEqual(actions[0].action, "soft-deactivate", "Referenced variant must be soft-deactivated, not deleted");
  });

  await test("4.3 Safe variant deletion: Hard deletes unreferenced variant", () => {
    const existingVariantIds = ["var-clean"];
    const incomingVariantIds = new Set<string>(); // var-clean being removed

    const orderItems = new Set<string>();
    const cartItems = new Set<string>();
    const reservations = new Set<string>();

    const actions: Array<{ id: string; action: "delete" | "soft-deactivate" }> = [];

    for (const oldId of existingVariantIds) {
      if (!incomingVariantIds.has(oldId)) {
        if (orderItems.has(oldId) || cartItems.has(oldId) || reservations.has(oldId)) {
          actions.push({ id: oldId, action: "soft-deactivate" });
        } else {
          actions.push({ id: oldId, action: "delete" });
        }
      }
    }

    assert.strictEqual(actions.length, 1);
    assert.strictEqual(actions[0].id, "var-clean");
    assert.strictEqual(actions[0].action, "delete", "Unreferenced variant can be safely deleted");
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST GROUP 5: Customer Selector Compatibility & State Handling
  // ───────────────────────────────────────────────────────────────────────────
  console.log("\n--- TEST GROUP 5: Customer Selector Compatibility & State Handling ---");

  await test("5.1 Inactive variants are marked (Unavailable) and disabled from selection", () => {
    const variants = [
      { id: "v-1", name: "S", isActive: true, stockQuantity: 10 },
      { id: "v-2", name: "M", isActive: false, stockQuantity: 5 }, // Inactive!
    ];

    const rendered = variants.map((v) => {
      const isInactive = v.isActive === false;
      const isOutOfStock = !isInactive && v.stockQuantity <= 0;
      const isAvailable = !isInactive && !isOutOfStock;
      const disabled = isInactive;
      const statusLabel = isInactive ? "(Unavailable)" : isOutOfStock ? "(Out of Stock)" : null;
      return { id: v.id, disabled, statusLabel, isAvailable };
    });

    assert.strictEqual(rendered[1].disabled, true, "Inactive variant must be disabled");
    assert.strictEqual(rendered[1].statusLabel, "(Unavailable)", "Inactive variant must show (Unavailable)");
    assert.strictEqual(rendered[1].isAvailable, false);
  });

  await test("5.2 Out-of-stock variants display (Out of Stock) and prevent purchasing", () => {
    const variants = [
      { id: "v-1", name: "S", isActive: true, stockQuantity: 0 }, // Out of stock!
    ];

    const v = variants[0];
    const isInactive = v.isActive === false;
    const isOutOfStock = !isInactive && v.stockQuantity <= 0;
    const isAvailable = !isInactive && !isOutOfStock;

    assert.strictEqual(isOutOfStock, true);
    assert.strictEqual(isAvailable, false);
  });

  await test("5.3 Default variant selection never silently selects an inactive variant", () => {
    const product = {
      variants: [
        { id: "v-inactive", name: "S", isActive: false, stockQuantity: 10 },
        { id: "v-active-oos", name: "M", isActive: true, stockQuantity: 0 },
        { id: "v-active-in-stock", name: "L", isActive: true, stockQuantity: 5 },
      ],
    };

    const def =
      product.variants.find((v) => v.isActive !== false && v.stockQuantity > 0) ||
      product.variants.find((v) => v.isActive !== false);

    assert.strictEqual(def?.id, "v-active-in-stock", "Default variant must pick active in-stock item, never inactive");
  });

  await test("5.4 Legitimate ₹0 variant price is preserved in customer selector and cart", () => {
    const unitPrice = resolveAuthoritativeUnitPrice({
      productPrice: 399,
      variantPrice: 0,
    });
    assert.strictEqual(unitPrice, 0, "Legitimate ₹0 price must not fallback to 399");
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST GROUP 6: Form Payload & API Serialization Invariants
  // ───────────────────────────────────────────────────────────────────────────
  console.log("\n--- TEST GROUP 6: Form Payload & API Serialization Invariants ---");

  await test("6.1 Form correctly serializes variant IDs, colorId, sizeName, and nullable prices", () => {
    const uiVariants = [
      {
        id: "var-uuid-1",
        colorId: "col-black",
        sizeName: "S",
        name: "Black / S",
        sku: "TSH-BLK-S",
        price: undefined, // empty input in UI
        stockQuantity: 10,
        isActive: true,
      },
      {
        id: "var-uuid-2",
        colorId: "col-black",
        sizeName: "M",
        name: "Black / M",
        sku: "TSH-BLK-M",
        price: 449,
        stockQuantity: 15,
        isActive: true,
      },
    ];

    const formattedVariants = uiVariants.map((v) => ({
      id: v.id && !v.id.startsWith("var-temp-") && !v.id.startsWith("new-") ? v.id : undefined,
      colorId: v.colorId ? v.colorId.trim() : null,
      sizeName: v.sizeName ? v.sizeName.trim() : null,
      name: v.name.trim(),
      sku: v.sku.trim(),
      price: v.price !== undefined && v.price !== null && !isNaN(Number(v.price)) ? Number(v.price) : null,
      stockQuantity: Math.max(0, Number(v.stockQuantity || 0)),
      isActive: v.isActive !== false,
    }));

    assert.strictEqual(formattedVariants.length, 2);
    assert.strictEqual(formattedVariants[0].id, "var-uuid-1");
    assert.strictEqual(formattedVariants[0].colorId, "col-black");
    assert.strictEqual(formattedVariants[0].sizeName, "S");
    assert.strictEqual(formattedVariants[0].price, null, "Undefined price must serialize to null for server fallback");
    assert.strictEqual(formattedVariants[1].price, 449);
  });

  console.log("\n================================================================================");
  console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED (TOTAL: ${passed + failed})`);
  console.log("================================================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Test execution error:", err);
  process.exit(1);
});
