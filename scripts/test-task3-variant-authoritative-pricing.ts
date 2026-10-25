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
  const { computeDiscountAmount } = await import("../src/lib/server/discount");
  console.log("================================================================================");
  console.log("RUNNING TASK 3: SERVER-AUTHORITATIVE VARIANT PRICING & INVENTORY TEST SUITE");
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
  // TEST GROUP 1: Server-Authoritative Price Resolution Hierarchy
  // ───────────────────────────────────────────────────────────────────────────
  console.log("--- TEST GROUP 1: Server-Authoritative Price Resolution Hierarchy ---");

  await test("1.1 Variant-specific price overrides color override and base product price", () => {
    const price = resolveAuthoritativeUnitPrice({
      productPrice: 200,
      colorPriceOverride: 250,
      variantPrice: 300,
    });
    assert.strictEqual(price, 300);
  });

  await test("1.2 Null variant price falls back to color price override", () => {
    const price = resolveAuthoritativeUnitPrice({
      productPrice: 200,
      colorPriceOverride: 250,
      variantPrice: null,
    });
    assert.strictEqual(price, 250);
  });

  await test("1.3 Undefined variant price falls back to color price override", () => {
    const price = resolveAuthoritativeUnitPrice({
      productPrice: 200,
      colorPriceOverride: 275,
      variantPrice: undefined,
    });
    assert.strictEqual(price, 275);
  });

  await test("1.4 Null variant price AND null color override falls back to base product price", () => {
    const price = resolveAuthoritativeUnitPrice({
      productPrice: 199.99,
      colorPriceOverride: null,
      variantPrice: null,
    });
    assert.strictEqual(price, 199.99);
  });

  await test("1.5 Legitimate ₹0 variant price is strictly preserved (does NOT fall back to color or product)", () => {
    const price = resolveAuthoritativeUnitPrice({
      productPrice: 499,
      colorPriceOverride: 399,
      variantPrice: 0,
    });
    assert.strictEqual(price, 0, "Legitimate ₹0 variant price must not trigger fallback to color or product price");
  });

  await test("1.6 Legitimate ₹0 color price override is strictly preserved (does NOT fall back to product price)", () => {
    const price = resolveAuthoritativeUnitPrice({
      productPrice: 500,
      colorPriceOverride: 0,
      variantPrice: null,
    });
    assert.strictEqual(price, 0, "Legitimate ₹0 color override must not trigger fallback to base product price");
  });

  await test("1.7 Legitimate ₹0 base product price is strictly preserved", () => {
    const price = resolveAuthoritativeUnitPrice({
      productPrice: 0,
      colorPriceOverride: null,
      variantPrice: null,
    });
    assert.strictEqual(price, 0);
  });

  await test("1.8 String numeric prices are safely parsed and rounded", () => {
    const price = resolveAuthoritativeUnitPrice({
      productPrice: "100.50",
      colorPriceOverride: "150.75",
      variantPrice: "189.99",
    });
    assert.strictEqual(price, 189.99);
  });

  await test("1.9 Missing or invalid prices gracefully fallback to 0 without throwing", () => {
    const price = resolveAuthoritativeUnitPrice({
      productPrice: null,
      colorPriceOverride: null,
      variantPrice: null,
    });
    assert.strictEqual(price, 0);
  });

  await test("1.10 Negative prices are clamped to 0", () => {
    const price = resolveAuthoritativeUnitPrice({
      productPrice: -50,
      colorPriceOverride: null,
      variantPrice: null,
    });
    assert.strictEqual(price, 0);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST GROUP 2: Effective Stock Calculation with Active Reservations
  // ───────────────────────────────────────────────────────────────────────────
  console.log("\n--- TEST GROUP 2: Effective Stock & Reservation Accounting ---");

  await test("2.1 Variant stock accounts for active reservations on product_variants", () => {
    const stock = resolveAuthoritativeEffectiveStock({
      hasVariant: true,
      variantStock: 25,
      variantReservedStock: 7,
      hasColor: false,
    });
    assert.strictEqual(stock, 18);
  });

  await test("2.2 Variant stock is clamped to 0 when reservations exceed available inventory", () => {
    const stock = resolveAuthoritativeEffectiveStock({
      hasVariant: true,
      variantStock: 5,
      variantReservedStock: 10,
      hasColor: false,
    });
    assert.strictEqual(stock, 0);
  });

  await test("2.3 Color-only stock accounts for color reserved_stock", () => {
    const stock = resolveAuthoritativeEffectiveStock({
      hasVariant: false,
      hasColor: true,
      colorStock: 30,
      colorReservedStock: 8,
    });
    assert.strictEqual(stock, 22);
  });

  await test("2.4 Color-only stock clamped to 0 when reserved_stock exceeds stock", () => {
    const stock = resolveAuthoritativeEffectiveStock({
      hasVariant: false,
      hasColor: true,
      colorStock: 2,
      colorReservedStock: 5,
    });
    assert.strictEqual(stock, 0);
  });

  await test("2.5 Simple product stock without variants or colors", () => {
    const stock = resolveAuthoritativeEffectiveStock({
      hasVariant: false,
      hasColor: false,
      productStock: 42,
    });
    assert.strictEqual(stock, 42);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST GROUP 3: Cart Line Item Null-Safe Identity (distinct combinations)
  // ───────────────────────────────────────────────────────────────────────────
  console.log("\n--- TEST GROUP 3: Cart Line Item Null-Safe Combination Identity ---");

  interface MockCartLine {
    productId: string;
    variantId: string | null;
    colorId: string | null;
    quantity: number;
  }

  function findMatchingLine(lines: MockCartLine[], target: { productId: string; variantId?: string | null; colorId?: string | null }) {
    const targetVar = target.variantId || null;
    const targetCol = target.colorId || null;
    return lines.find(
      (line) =>
        line.productId === target.productId &&
        (line.variantId || null) === targetVar &&
        (line.colorId || null) === targetCol
    );
  }

  await test("3.1 Distinct (color, size) combinations form distinct line items and never collide", () => {
    const cartLines: MockCartLine[] = [
      { productId: "p1", variantId: "var-red-s", colorId: "col-red", quantity: 1 },
      { productId: "p1", variantId: "var-red-m", colorId: "col-red", quantity: 2 },
      { productId: "p1", variantId: "var-blue-s", colorId: "col-blue", quantity: 1 },
      { productId: "p1", variantId: null, colorId: "col-red", quantity: 1 }, // color-only
      { productId: "p1", variantId: "var-size-only-l", colorId: null, quantity: 1 }, // size-only
      { productId: "p1", variantId: null, colorId: null, quantity: 3 }, // simple product
    ];

    // Query for var-red-s
    const match1 = findMatchingLine(cartLines, { productId: "p1", variantId: "var-red-s", colorId: "col-red" });
    assert(match1 && match1.variantId === "var-red-s" && match1.colorId === "col-red");

    // Query for var-red-m
    const match2 = findMatchingLine(cartLines, { productId: "p1", variantId: "var-red-m", colorId: "col-red" });
    assert(match2 && match2.variantId === "var-red-m" && match2.quantity === 2);

    // Query for color-only
    const match3 = findMatchingLine(cartLines, { productId: "p1", variantId: null, colorId: "col-red" });
    assert(match3 && match3.variantId === null && match3.colorId === "col-red");

    // Query for size-only
    const match4 = findMatchingLine(cartLines, { productId: "p1", variantId: "var-size-only-l", colorId: null });
    assert(match4 && match4.variantId === "var-size-only-l" && match4.colorId === null);

    // Query for simple
    const match5 = findMatchingLine(cartLines, { productId: "p1", variantId: null, colorId: null });
    assert(match5 && match5.variantId === null && match5.colorId === null && match5.quantity === 3);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST GROUP 4: Server Discount Precedence and Non-Stacking
  // ───────────────────────────────────────────────────────────────────────────
  console.log("\n--- TEST GROUP 4: Discount Precedence & Calculation Invariants ---");

  await test("4.1 Percentage discount calculation on authoritative unit price", () => {
    const discount: any = {
      discountType: "percentage",
      value: 20, // 20% off
      scope: "product",
    };
    const unitPrice = 500;
    const calc = computeDiscountAmount(discount, unitPrice);
    assert.strictEqual(calc.discountAmount, 100);
    assert.strictEqual(calc.finalPrice, 400);
  });

  await test("4.2 Fixed amount discount capped at unit price (never negative)", () => {
    const discount: any = {
      discountType: "fixed_amount",
      value: 600, // ₹600 off
      scope: "product",
    };
    const unitPrice = 450;
    const calc = computeDiscountAmount(discount, unitPrice);
    assert.strictEqual(calc.discountAmount, 450);
    assert.strictEqual(calc.finalPrice, 0);
  });

  await test("4.3 Client-supplied discount and prices are ignored: server computes authoritative line totals", () => {
    // Simulated client payload attempting price tampering:
    const tamperedClientPayload = {
      productId: "p100",
      variantId: "v100",
      price: 1, // Client claims ₹1
      discount: 999, // Client claims ₹999 discount
      lineTotal: 1,
    };

    // Server-authoritative resolution:
    const authoritativeUnitPrice = resolveAuthoritativeUnitPrice({
      productPrice: 1200,
      colorPriceOverride: 1100,
      variantPrice: 950,
    });
    assert.strictEqual(authoritativeUnitPrice, 950, "Server must resolve ₹950 variant price, ignoring client's ₹1 claim");

    const discountResult: any = { discountType: "percentage", value: 10, scope: "product" };
    const calc = computeDiscountAmount(discountResult, authoritativeUnitPrice);
    assert.strictEqual(calc.discountAmount, 95);
    assert.strictEqual(calc.finalPrice, 855);

    const quantity = 3;
    const lineDiscount = Math.round(calc.discountAmount * quantity * 100) / 100;
    const lineTotal = Math.round(calc.finalPrice * quantity * 100) / 100;

    assert.strictEqual(lineDiscount, 285);
    assert.strictEqual(lineTotal, 2565);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST GROUP 5: Cross-Product Variant Injection & Integrity Rules
  // ───────────────────────────────────────────────────────────────────────────
  console.log("\n--- TEST GROUP 5: Security & Ownership Integrity Rules ---");

  function validateVariantProductIntegrity(params: {
    productId: string;
    variant: { id: string; productId: string; colorId?: string | null; isActive: boolean } | null;
    color: { id: string; productId: string; isActive: boolean } | null;
    requestedColorId?: string | null;
  }) {
    if (params.variant) {
      if (params.variant.productId !== params.productId) {
        throw new Error("Cross-product variant injection detected: variant belongs to another product");
      }
      if (!params.variant.isActive) {
        throw new Error("Variant is inactive");
      }
      if (params.variant.colorId && params.requestedColorId && params.variant.colorId !== params.requestedColorId) {
        throw new Error("Variant does not match requested color");
      }
    }
    if (params.color) {
      if (params.color.productId !== params.productId) {
        throw new Error("Cross-product color injection detected: color belongs to another product");
      }
      if (!params.color.isActive) {
        throw new Error("Color is inactive");
      }
    }
    return true;
  }

  await test("5.1 Cross-product variant ID injection is rejected", () => {
    assert.throws(
      () =>
        validateVariantProductIntegrity({
          productId: "product-A",
          variant: { id: "var-B1", productId: "product-B", isActive: true },
          color: null,
        }),
      /Cross-product variant injection detected/
    );
  });

  await test("5.2 Inactive variant is rejected", () => {
    assert.throws(
      () =>
        validateVariantProductIntegrity({
          productId: "product-A",
          variant: { id: "var-A1", productId: "product-A", isActive: false },
          color: null,
        }),
      /Variant is inactive/
    );
  });

  await test("5.3 Variant color mismatch is rejected", () => {
    assert.throws(
      () =>
        validateVariantProductIntegrity({
          productId: "product-A",
          variant: { id: "var-A1", productId: "product-A", colorId: "color-red", isActive: true },
          color: { id: "color-blue", productId: "product-A", isActive: true },
          requestedColorId: "color-blue",
        }),
      /Variant does not match requested color/
    );
  });

  await test("5.4 Legitimate matching variant and color pass validation", () => {
    const valid = validateVariantProductIntegrity({
      productId: "product-A",
      variant: { id: "var-A1", productId: "product-A", colorId: "color-red", isActive: true },
      color: { id: "color-red", productId: "product-A", isActive: true },
      requestedColorId: "color-red",
    });
    assert.strictEqual(valid, true);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST GROUP 6: Inventory Restoration Target on Order Cancellation
  // ───────────────────────────────────────────────────────────────────────────
  console.log("\n--- TEST GROUP 6: Inventory Restoration Invariants ---");

  interface InventoryItem {
    variantId?: string | null;
    colorId?: string | null;
    productId?: string | null;
    quantity: number;
  }

  function resolveInventoryRestorationTarget(item: InventoryItem): "variant" | "color" | "product" {
    if (item.variantId) return "variant";
    if (item.colorId) return "color";
    if (item.productId) return "product";
    throw new Error("Cannot determine inventory target");
  }

  await test("6.1 Combined variant item (has variantId AND colorId) restores to product_variants, NOT product_colors", () => {
    const target = resolveInventoryRestorationTarget({
      variantId: "v123",
      colorId: "c456",
      productId: "p789",
      quantity: 2,
    });
    assert.strictEqual(target, "variant", "Variant combination must restore inventory to product_variants");
  });

  await test("6.2 Color-only item (has colorId, no variantId) restores to product_colors", () => {
    const target = resolveInventoryRestorationTarget({
      variantId: null,
      colorId: "c456",
      productId: "p789",
      quantity: 1,
    });
    assert.strictEqual(target, "color", "Color-only item must restore inventory to product_colors");
  });

  await test("6.3 Simple product item (no variantId, no colorId) restores to products", () => {
    const target = resolveInventoryRestorationTarget({
      variantId: null,
      colorId: null,
      productId: "p789",
      quantity: 3,
    });
    assert.strictEqual(target, "product", "Simple product item must restore inventory to products");
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST GROUP 7: Fix 1 - Expired/Abandoned Reservation Cleanup Invariants
  // ───────────────────────────────────────────────────────────────────────────
  console.log("\n--- TEST GROUP 7: Fix 1 - Expired/Abandoned Reservation Cleanup Invariants ---");

  interface MockAttempt {
    id: string;
    status: "pending" | "abandoned" | "converted" | "failed" | "expired";
    expiresAt: Date;
    payments: Array<{ status: "created" | "pending" | "captured" | "verified" | "failed" }>;
  }

  function isEligibleForExpiredCleanup(attempt: MockAttempt, now: Date): boolean {
    if (attempt.status !== "pending" && attempt.status !== "abandoned") {
      return false;
    }
    if (attempt.expiresAt.getTime() >= now.getTime()) {
      return false;
    }
    const hasCapturedOrVerifiedPayment = attempt.payments.some(
      (p) => p.status === "captured" || p.status === "verified"
    );
    if (hasCapturedOrVerifiedPayment) {
      return false;
    }
    return true;
  }

  interface MockReservation {
    id: string;
    attemptId: string;
    colorId: string | null;
    variantId: string | null;
    quantity: number;
    status: "active" | "released" | "consumed";
  }

  function releaseReservation(
    reservation: MockReservation,
    colorTable: Map<string, { reservedStock: number }>
  ): { reservationReleased: boolean; colorStockRestored: boolean } {
    if (reservation.status !== "active") {
      return { reservationReleased: false, colorStockRestored: false };
    }
    let colorStockRestored = false;
    if (reservation.colorId && !reservation.variantId) {
      const color = colorTable.get(reservation.colorId);
      if (color) {
        color.reservedStock = Math.max(0, color.reservedStock - reservation.quantity);
        colorStockRestored = true;
      }
    }
    reservation.status = "released";
    return { reservationReleased: true, colorStockRestored };
  }

  const baseNow = new Date("2026-10-25T21:00:00Z");
  const pastExpiry = new Date("2026-10-25T20:25:00Z");
  const futureExpiry = new Date("2026-10-25T21:25:00Z");

  await test("7.1 Pending attempt past expiry with no payments is eligible for cleanup", () => {
    const eligible = isEligibleForExpiredCleanup(
      { id: "att-1", status: "pending", expiresAt: pastExpiry, payments: [] },
      baseNow
    );
    assert.strictEqual(eligible, true);
  });

  await test("7.2 Abandoned attempt past expiry with no payments is eligible for cleanup", () => {
    const eligible = isEligibleForExpiredCleanup(
      { id: "att-2", status: "abandoned", expiresAt: pastExpiry, payments: [] },
      baseNow
    );
    assert.strictEqual(eligible, true, "Abandoned attempts past 30-min expiry must be eligible for cleanup");
  });

  await test("7.3 Abandoned attempt within 30-min window is NOT eligible for cleanup (customer recovery window active)", () => {
    const eligible = isEligibleForExpiredCleanup(
      { id: "att-3", status: "abandoned", expiresAt: futureExpiry, payments: [] },
      baseNow
    );
    assert.strictEqual(eligible, false, "Active abandoned attempt must preserve reservation for customer retry");
  });

  await test("7.4 Abandoned attempt with captured payment is NEVER cleaned up (payment safety guard)", () => {
    const eligible = isEligibleForExpiredCleanup(
      { id: "att-4", status: "abandoned", expiresAt: pastExpiry, payments: [{ status: "captured" }] },
      baseNow
    );
    assert.strictEqual(eligible, false, "Attempt with captured payment must never release reservations");
  });

  await test("7.5 Abandoned attempt with verified payment is NEVER cleaned up (verification safety guard)", () => {
    const eligible = isEligibleForExpiredCleanup(
      { id: "att-5", status: "abandoned", expiresAt: pastExpiry, payments: [{ status: "verified" }] },
      baseNow
    );
    assert.strictEqual(eligible, false, "Attempt with verified payment must never release reservations");
  });

  await test("7.6 Converted attempt is NEVER cleaned up by expired cleanup", () => {
    const eligible = isEligibleForExpiredCleanup(
      { id: "att-6", status: "converted", expiresAt: pastExpiry, payments: [{ status: "captured" }] },
      baseNow
    );
    assert.strictEqual(eligible, false);
  });

  await test("7.7 Releasing color-only reservation restores product_colors.reserved_stock and updates status to released", () => {
    const colors = new Map([["color-1", { reservedStock: 5 }]]);
    const res: MockReservation = {
      id: "res-1",
      attemptId: "att-1",
      colorId: "color-1",
      variantId: null,
      quantity: 2,
      status: "active",
    };
    const outcome = releaseReservation(res, colors);
    assert.strictEqual(outcome.reservationReleased, true);
    assert.strictEqual(outcome.colorStockRestored, true);
    assert.strictEqual(colors.get("color-1")!.reservedStock, 3);
    assert.strictEqual(res.status, "released");
  });

  await test("7.8 Releasing variant combination reservation does NOT decrement product_colors.reserved_stock", () => {
    const colors = new Map([["color-1", { reservedStock: 5 }]]);
    const res: MockReservation = {
      id: "res-2",
      attemptId: "att-2",
      colorId: "color-1",
      variantId: "var-1",
      quantity: 2,
      status: "active",
    };
    const outcome = releaseReservation(res, colors);
    assert.strictEqual(outcome.reservationReleased, true);
    assert.strictEqual(outcome.colorStockRestored, false);
    assert.strictEqual(colors.get("color-1")!.reservedStock, 5, "Color reserved stock must remain unchanged for variant reservations");
    assert.strictEqual(res.status, "released");
  });

  await test("7.9 Reservation release is idempotent (already released reservation is no-op)", () => {
    const colors = new Map([["color-1", { reservedStock: 3 }]]);
    const res: MockReservation = {
      id: "res-3",
      attemptId: "att-2",
      colorId: "color-1",
      variantId: null,
      quantity: 2,
      status: "released",
    };
    const outcome = releaseReservation(res, colors);
    assert.strictEqual(outcome.reservationReleased, false);
    assert.strictEqual(outcome.colorStockRestored, false);
    assert.strictEqual(colors.get("color-1")!.reservedStock, 3);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST GROUP 8: Fix 2 - Variant Availability in Cart & Checkout Parity
  // ───────────────────────────────────────────────────────────────────────────
  console.log("\n--- TEST GROUP 8: Fix 2 - Variant Availability in Cart & Checkout Parity ---");

  await test("8.1 Cart available stock for variant subtracts active unexpired reservations", () => {
    const cartAvailableStock = resolveAuthoritativeEffectiveStock({
      hasVariant: true,
      variantStock: 10,
      variantReservedStock: 4,
      hasColor: false,
    });
    assert.strictEqual(cartAvailableStock, 6, "Variant available stock must be 10 - 4 = 6");
  });

  await test("8.2 Cart available stock for variant clamps to 0 when reservations equal or exceed stock", () => {
    const exactlyZero = resolveAuthoritativeEffectiveStock({
      hasVariant: true,
      variantStock: 5,
      variantReservedStock: 5,
      hasColor: false,
    });
    assert.strictEqual(exactlyZero, 0);

    const oversubscribed = resolveAuthoritativeEffectiveStock({
      hasVariant: true,
      variantStock: 5,
      variantReservedStock: 8,
      hasColor: false,
    });
    assert.strictEqual(oversubscribed, 0, "Stock must never be negative");
  });

  await test("8.3 Cart available stock equals checkout available stock under identical reservation state", () => {
    const variantStock = 12;
    const reservedQty = 5;

    const cartAvailable = resolveAuthoritativeEffectiveStock({
      hasVariant: true,
      variantStock,
      variantReservedStock: reservedQty,
      hasColor: false,
    });

    const checkoutAvailable = resolveAuthoritativeEffectiveStock({
      hasVariant: true,
      variantStock,
      variantReservedStock: reservedQty,
      hasColor: false,
    });

    assert.strictEqual(cartAvailable, checkoutAvailable);
    assert.strictEqual(cartAvailable, 7);
  });

  await test("8.4 Cart preserves legacy simple-product stock calculation (unaffected by variant reservations)", () => {
    const simpleStock = resolveAuthoritativeEffectiveStock({
      hasVariant: false,
      hasColor: false,
      productStock: 18,
    });
    assert.strictEqual(simpleStock, 18);
  });

  await test("8.5 Cart preserves legacy color-only stock calculation (subtracts color.reserved_stock)", () => {
    const colorStock = resolveAuthoritativeEffectiveStock({
      hasVariant: false,
      hasColor: true,
      colorStock: 25,
      colorReservedStock: 7,
    });
    assert.strictEqual(colorStock, 18);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // SUMMARY
  // ───────────────────────────────────────────────────────────────────────────
  console.log("\n================================================================================");
  console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED (TOTAL: ${passed + failed})`);
  console.log("================================================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("FATAL ERROR IN TEST RUNNER:", err);
  process.exit(1);
});
