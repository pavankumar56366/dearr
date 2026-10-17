import "server-only";
import crypto from "crypto";
import { query, withTransaction } from "./db";
import { PoolConnection } from "mysql2/promise";
import { getApplicableDiscountForProduct, computeDiscountAmount } from "./discount";
import { getStoreSettings } from "./settings";
import { recordInternalEvent } from "./events";
import { getCartForUser, CartValidationError } from "./cart";
import {
  releaseCheckoutAttemptReservations,
  createCheckoutAttemptFromCart,
  getCheckoutAttemptById,
} from "./checkout-attempt";

export interface AlternativeItem {
  id?: string;
  productId: string;
  name?: string;
  productName: string;
  slug?: string;
  productSlug: string;
  colorId: string | null;
  colorName: string | null;
  colorHex: string | null;
  imageUrl: string;
  originalPrice: number;
  discountAmount: number;
  price?: number;
  effectivePrice: number;
  savings: number;
  priceSavings?: number;
  stockAvailable: number;
}

export interface SwapCartItemInput {
  userId: string;
  sourceProductId: string;
  sourceColorId?: string | null;
  sourceVariantId?: string | null;
  alternativeProductId: string;
  alternativeColorId?: string | null;
  expectedAlternativePrice?: number;
  expectedMaxPrice?: number;
  attemptId?: string | null;
  createCheckoutAttempt?: boolean;
}

export class AlternativesError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = "AlternativesError";
    this.statusCode = statusCode;
  }
}

export class AlternativesConflictError extends AlternativesError {
  constructor(message: string) {
    super(message, 409);
    this.name = "AlternativesConflictError";
  }
}

/**
 * Normalizes a storage path into a public URL.
 */
function toPublicUrl(path: string | null | undefined): string {
  if (!path) return "/product-samples/1.jpeg";
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return path.startsWith("/") ? path : `/${path}`;
}

/**
 * Finds up to `limit` lower-priced in-stock alternative products in the same category.
 *
 * Guarantees:
 * 1. Only products belonging to the same category.
 * 2. Only active products (`is_active = 1`).
 * 3. Excludes items already present in the active cart (`cartItemProductIds`).
 * 4. Only in-stock variants / colors.
 * 5. Effective trusted price (after single applicable discount) must be strictly less than `sourcePrice`.
 * 6. Savings are computed strictly server-side.
 * 7. Records `alternative_viewed` internal event.
 */
export async function getLowerPricedAlternatives(params: {
  productId: string;
  colorId?: string | null;
  sourcePrice: number;
  quantity?: number;
  cartItemProductIds?: string[];
  excludeCartProductIds?: string[];
  limit?: number;
  attemptId?: string | null;
  userId?: string | null;
}): Promise<AlternativeItem[]> {
  const cleanProductId = (params.productId || "").trim();
  const sourcePrice = Number(params.sourcePrice);

  if (!cleanProductId || isNaN(sourcePrice) || sourcePrice <= 0) {
    return [];
  }

  let requiredQuantity = params.quantity && params.quantity > 0 ? Number(params.quantity) : 0;
  if (!requiredQuantity && params.attemptId) {
    try {
      const attempt = await getCheckoutAttemptById(params.attemptId);
      const items = attempt?.checkoutData?.items || [];
      const it = items.find(
        (i: any) => i.productId === cleanProductId && (!params.colorId || i.colorId === params.colorId)
      );
      if (it?.quantity) {
        requiredQuantity = Number(it.quantity);
      }
    } catch {}
  }
  if (!requiredQuantity) {
    requiredQuantity = 1;
  }

  const settings = await getStoreSettings();
  if (settings.alternativesEnabled === false) {
    return [];
  }

  const maxLimit = Math.min(
    settings.maxAlternatives || 4,
    Math.max(1, params.limit || 4)
  );

  // 1. Fetch category ID and source color of the original item
  const sourceRows = await query<any[]>(
    `SELECT p.id, p.category_id, p.name,
            pc.name AS color_name, pc.slug AS color_slug, pc.hex AS color_hex
     FROM products p
     LEFT JOIN product_colors pc ON pc.id = ?
     WHERE p.id = ? LIMIT 1`,
    [params.colorId || null, cleanProductId]
  );

  if (!sourceRows || sourceRows.length === 0 || !sourceRows[0].category_id) {
    return [];
  }

  const categoryId = sourceRows[0].category_id;
  const sourceColorName = sourceRows[0].color_name?.toLowerCase();
  const sourceColorSlug = sourceRows[0].color_slug?.toLowerCase();
  const sourceColorHex = sourceRows[0].color_hex?.toUpperCase();

  // 2. Build exclusions list (original product + products already in active cart)
  const excludeProductIds = new Set<string>([cleanProductId]);
  const excludeList = params.cartItemProductIds || (params as any).excludeCartProductIds;
  if (Array.isArray(excludeList)) {
    for (const pid of excludeList) {
      if (pid) excludeProductIds.add(String(pid).trim());
    }
  }

  const excludeArray = Array.from(excludeProductIds);
  const placeholders = excludeArray.map(() => "?").join(",");

  // 3. Query candidate active products in the same category
  const candidateProducts = await query<any[]>(
    `SELECT id, name, slug, price, compare_at_price, stock_quantity, has_colors, category_id
     FROM products
     WHERE category_id = ?
       AND is_active = 1
       AND id NOT IN (${placeholders})
     ORDER BY price ASC
     LIMIT 20`,
    [categoryId, ...excludeArray]
  );

  const now = new Date();
  const alternatives: AlternativeItem[] = [];

  for (const prod of candidateProducts || []) {
    if (alternatives.length >= maxLimit) break;

    const hasColors = Boolean(prod.has_colors === 1 || prod.has_colors === true);
    let chosenColorId: string | null = null;
    let chosenColorName: string | null = null;
    let chosenColorHex: string | null = null;
    let basePrice = Number(prod.price);
    let availableStock = 0;

    if (hasColors) {
      // Fetch available active colors for this candidate product
      const colors = await query<any[]>(
        `SELECT id, name, slug, hex, sku, stock, reserved_stock, price_override, sort_order
         FROM product_colors
         WHERE product_id = ? AND is_active = 1
         ORDER BY sort_order ASC, created_at ASC`,
        [prod.id]
      );

      if (!colors || colors.length === 0) continue;

      // Filter strictly to colors with sufficient available stock for full required quantity
      const inStockColors = colors.filter(
        (c) => Math.max(0, Number(c.stock ?? 0) - Number(c.reserved_stock ?? 0)) >= requiredQuantity
      );
      if (inStockColors.length === 0) continue;

      // Color matching preference:
      // Try to find matching color (by slug, name, or hex) that has sufficient stock
      let match = inStockColors.find(
        (c) =>
          (sourceColorSlug && c.slug?.toLowerCase() === sourceColorSlug) ||
          (sourceColorName && c.name?.toLowerCase() === sourceColorName) ||
          (sourceColorHex && c.hex?.toUpperCase() === sourceColorHex)
      );

      // Otherwise pick the documented first valid available color
      if (!match) {
        match = inStockColors[0];
      }

      chosenColorId = match.id;
      chosenColorName = match.name;
      chosenColorHex = match.hex;
      basePrice =
        match.price_override !== null && match.price_override !== undefined
          ? Number(match.price_override)
          : Number(prod.price);
      availableStock = Math.max(0, Number(match.stock ?? 0) - Number(match.reserved_stock ?? 0));
    } else {
      availableStock = Number(prod.stock_quantity ?? 0);
      if (availableStock < requiredQuantity) continue;
    }

    // Resolve trusted applicable discount (no stacking)
    let discountAmount = 0;
    try {
      const discountResult = await getApplicableDiscountForProduct(prod.id, now);
      if (discountResult && discountResult.discount) {
        const calc = computeDiscountAmount(discountResult.discount, basePrice);
        discountAmount = calc.discountAmount;
      }
    } catch {
      discountAmount = 0;
    }

    const effectivePrice = Math.max(0, Math.round((basePrice - discountAmount) * 100) / 100);

    // Rule: Must be strictly lower than original item's attempt-time price
    if (effectivePrice >= sourcePrice) {
      continue;
    }

    const savings = Math.max(0, Math.round((sourcePrice - effectivePrice) * 100) / 100);

    // Fetch primary image for this product/color
    let imageUrl = "/product-samples/1.jpeg";
    if (chosenColorId) {
      const imgRows = await query<any[]>(
        `SELECT storage_path FROM product_images
         WHERE product_id = ? AND (color_id = ? OR color_id IS NULL)
         ORDER BY (CASE WHEN color_id = ? THEN 0 ELSE 1 END), sort_order ASC
         LIMIT 1`,
        [prod.id, chosenColorId, chosenColorId]
      );
      if (imgRows && imgRows.length > 0) {
        imageUrl = toPublicUrl(imgRows[0].storage_path);
      }
    } else {
      const imgRows = await query<any[]>(
        `SELECT storage_path FROM product_images WHERE product_id = ? ORDER BY sort_order ASC LIMIT 1`,
        [prod.id]
      );
      if (imgRows && imgRows.length > 0) {
        imageUrl = toPublicUrl(imgRows[0].storage_path);
      }
    }

    alternatives.push({
      id: prod.id,
      productId: prod.id,
      name: prod.name,
      productName: prod.name,
      slug: prod.slug,
      productSlug: prod.slug,
      colorId: chosenColorId,
      colorName: chosenColorName,
      colorHex: chosenColorHex,
      imageUrl,
      originalPrice: basePrice,
      discountAmount,
      price: effectivePrice,
      effectivePrice,
      savings,
      priceSavings: savings,
      stockAvailable: availableStock,
    });
  }

  // Record internal event for telemetry
  if (alternatives.length > 0) {
    await recordInternalEvent({
      eventType: "alternative_viewed",
      attemptId: params.attemptId || null,
      userId: params.userId || null,
      metadata: {
        sourceProductId: cleanProductId,
        alternativesCount: alternatives.length,
        topSavings: alternatives[0].savings,
      },
    });
  }

  return alternatives;
}

export const findLowerPricedAlternatives = getLowerPricedAlternatives;

/**
 * Atomically swaps a cart line item for an alternative product/variant.
 *
 * Guarantees:
 * 1. Safe identification of the source cart item.
 * 2. Preserves source quantity.
 * 3. Server-side validation of alternative existence, active state, and inventory.
 * 4. Never trusts client-supplied price or savings.
 * 5. If alternative is out of stock or price changed stale, safely rejects with 409/400.
 * 6. Updates cart line item in MySQL.
 * 7. Records `alternative_swapped` in `internal_events`.
 * 8. Returns refreshed trusted cart.
 */
export async function swapCartItemForAlternative(
  input: SwapCartItemInput
): Promise<{
  success: boolean;
  message: string;
  cart: any;
  newAttempt?: any;
  newAttemptId?: string | null;
  swappedItem: {
    productId: string;
    colorId: string | null;
    quantity: number;
    effectivePrice: number;
  };
}> {
  const cleanUserId = (input.userId || "").trim();
  const sourcePid = (input.sourceProductId || "").trim();
  const altPid = (input.alternativeProductId || "").trim();

  if (!cleanUserId || !sourcePid || !altPid) {
    throw new AlternativesError("Missing required parameters for cart swap", 400);
  }

  if (sourcePid === altPid) {
    throw new AlternativesError("Cannot swap item for itself", 400);
  }

  const txnResult = await withTransaction(async (conn: PoolConnection) => {
    // 0. Release any held stock reservations from prior abandoned attempt
    if (input.attemptId) {
      const [attRows]: any = await conn.execute(
        "SELECT id, user_id FROM checkout_attempts WHERE id = ? FOR UPDATE",
        [input.attemptId]
      );
      if (!attRows || attRows.length === 0) {
        throw new AlternativesError("Referenced checkout attempt not found", 404);
      }
      if (attRows[0].user_id && attRows[0].user_id !== cleanUserId) {
        throw new AlternativesError("Forbidden: Unauthorized attempt access", 403);
      }
      await releaseCheckoutAttemptReservations(input.attemptId, conn);
    }

    // 1. Fetch user active cart with lock
    const [cartRows]: any = await conn.execute(
      `SELECT id, user_id, status FROM carts
       WHERE user_id = ? AND status = 'active'
       ORDER BY created_at DESC LIMIT 1 FOR UPDATE`,
      [cleanUserId]
    );

    if (!cartRows || cartRows.length === 0) {
      throw new AlternativesError("No active shopping cart found for user", 404);
    }
    const cart = cartRows[0];

    // 2. Identify the source cart item line
    let sourceQuery = `SELECT id, cart_id, product_id, variant_id, color_id, quantity
                       FROM cart_items
                       WHERE cart_id = ? AND product_id = ?`;
    const sourceParams: any[] = [cart.id, sourcePid];

    if (input.sourceColorId) {
      sourceQuery += ` AND color_id = ?`;
      sourceParams.push(input.sourceColorId);
    }
    sourceQuery += ` LIMIT 1 FOR UPDATE`;

    const [sourceItemRows]: any = await conn.execute(sourceQuery, sourceParams);
    if (!sourceItemRows || sourceItemRows.length === 0) {
      throw new AlternativesError("Original item to swap was not found in cart", 404);
    }
    const sourceItem = sourceItemRows[0];
    const sourceQuantity = Number(sourceItem.quantity);

    // 3. Validate alternative product is active and eligible
    const [altProdRows]: any = await conn.execute(
      `SELECT id, name, price, stock_quantity, is_active, has_colors, category_id
       FROM products WHERE id = ? LIMIT 1`,
      [altPid]
    );

    if (!altProdRows || altProdRows.length === 0) {
      throw new AlternativesError("Alternative product not found", 404);
    }
    const altProd = altProdRows[0];
    if (altProd.is_active !== 1 && altProd.is_active !== true) {
      throw new AlternativesError(`Alternative "${altProd.name}" is no longer available`, 400);
    }

    // Check if alternative already exists in cart (rule: do not add duplicate lines)
    const [existingAltCartRows]: any = await conn.execute(
      `SELECT id FROM cart_items WHERE cart_id = ? AND product_id = ? AND id != ? LIMIT 1`,
      [cart.id, altPid, sourceItem.id]
    );
    if (existingAltCartRows && existingAltCartRows.length > 0) {
      throw new AlternativesError("Alternative product is already in your cart", 400);
    }

    const hasColors = Boolean(altProd.has_colors === 1 || altProd.has_colors === true);
    let finalColorId: string | null = null;
    let basePrice = Number(altProd.price);
    let effectiveStock = 0;

    if (hasColors) {
      // Find eligible color
      let cleanAltColorId = input.alternativeColorId ? String(input.alternativeColorId).trim() : null;

      if (!cleanAltColorId) {
        // Query candidate active colors for this alternative product
        const [colors]: any = await conn.execute(
          `SELECT id, name, slug, hex, stock, reserved_stock, price_override
           FROM product_colors
           WHERE product_id = ? AND is_active = 1
           ORDER BY sort_order ASC, created_at ASC FOR UPDATE`,
          [altPid]
        );

        // Filter strictly to colors with sufficient available stock for full source quantity
        const inStockColors = (colors || []).filter(
          (c: any) => Math.max(0, Number(c.stock ?? 0) - Number(c.reserved_stock ?? 0)) >= sourceQuantity
        );
        if (inStockColors.length === 0) {
          throw new AlternativesConflictError(
            `Alternative "${altProd.name}" has no available colors in stock for quantity ${sourceQuantity}`
          );
        }

        // Try to retain the original color if available and in-stock
        let sourceColorSlug: string | null = null;
        let sourceColorName: string | null = null;
        let sourceColorHex: string | null = null;
        if (sourceItem.color_id) {
          const [scRows]: any = await conn.execute(
            `SELECT name, slug, hex FROM product_colors WHERE id = ? LIMIT 1`,
            [sourceItem.color_id]
          );
          if (scRows && scRows.length > 0) {
            sourceColorSlug = scRows[0].slug?.toLowerCase() || null;
            sourceColorName = scRows[0].name?.toLowerCase() || null;
            sourceColorHex = scRows[0].hex?.toUpperCase() || null;
          }
        }

        let match = inStockColors.find(
          (c: any) =>
            (sourceColorSlug && c.slug?.toLowerCase() === sourceColorSlug) ||
            (sourceColorName && c.name?.toLowerCase() === sourceColorName) ||
            (sourceColorHex && c.hex?.toUpperCase() === sourceColorHex)
        );

        cleanAltColorId = match ? match.id : inStockColors[0].id;
      }

      // Verify the selected color
      const [colorRows]: any = await conn.execute(
        `SELECT id, name, stock, reserved_stock, price_override, is_active
         FROM product_colors WHERE id = ? AND product_id = ? LIMIT 1 FOR UPDATE`,
        [cleanAltColorId, altPid]
      );
      if (!colorRows || colorRows.length === 0) {
        throw new AlternativesError("Selected alternative color does not exist", 400);
      }
      const color = colorRows[0];
      if (color.is_active !== 1 && color.is_active !== true) {
        throw new AlternativesError(`Alternative color "${color.name}" is inactive`, 400);
      }

      effectiveStock = Math.max(0, Number(color.stock ?? 0) - Number(color.reserved_stock ?? 0));
      if (sourceQuantity > effectiveStock) {
        throw new AlternativesConflictError(
          `Insufficient stock for alternative "${altProd.name} (${color.name})": requested ${sourceQuantity}, only ${effectiveStock} available`
        );
      }

      finalColorId = color.id;
      basePrice =
        color.price_override !== null && color.price_override !== undefined
          ? Number(color.price_override)
          : Number(altProd.price);
    } else {
      effectiveStock = Number(altProd.stock_quantity ?? 0);
      if (sourceQuantity > effectiveStock) {
        throw new AlternativesConflictError(
          `Insufficient stock for alternative "${altProd.name}": requested ${sourceQuantity}, only ${effectiveStock} available`
        );
      }
    }

    // 4. Compute server-trusted effective price
    const now = new Date();
    let discountAmount = 0;
    try {
      const discountResult = await getApplicableDiscountForProduct(altPid, now);
      if (discountResult && discountResult.discount) {
        const calc = computeDiscountAmount(discountResult.discount, basePrice);
        discountAmount = calc.discountAmount;
      }
    } catch {
      discountAmount = 0;
    }
    const effectivePrice = Math.max(0, Math.round((basePrice - discountAmount) * 100) / 100);

    // Stale price check (if client expected a certain price)
    if (input.expectedAlternativePrice !== undefined) {
      const expected = Number(input.expectedAlternativePrice);
      if (!isNaN(expected) && Math.abs(expected - effectivePrice) > 0.009) {
        throw new AlternativesConflictError(
          `Alternative price has changed (was ₹${expected.toFixed(2)}, now ₹${effectivePrice.toFixed(2)}). Please review the updated options.`
        );
      }
    }
    if (input.expectedMaxPrice !== undefined) {
      const maxAllowed = Number(input.expectedMaxPrice);
      if (!isNaN(maxAllowed) && effectivePrice > maxAllowed) {
        throw new AlternativesConflictError(
          `Alternative price (₹${effectivePrice.toFixed(2)}) exceeds maximum expected price (₹${maxAllowed.toFixed(2)})`
        );
      }
    }

    // 5. Update the cart line item atomically
    await conn.execute(
      `UPDATE cart_items
       SET product_id = ?,
           variant_id = NULL,
           color_id = ?,
           updated_at = NOW()
       WHERE id = ?`,
      [altPid, finalColorId, sourceItem.id]
    );

    // 6. Record alternative_swapped event
    await recordInternalEvent({
      eventType: "alternative_swapped",
      userId: cleanUserId,
      metadata: {
        sourceProductId: sourcePid,
        alternativeProductId: altPid,
        alternativeColorId: finalColorId,
        quantity: sourceQuantity,
        effectivePrice,
      },
    });

    return {
      success: true,
      message: `Successfully swapped for ${altProd.name}`,
      cart: null,
      swappedItem: {
        productId: altPid,
        colorId: finalColorId,
        quantity: sourceQuantity,
        effectivePrice,
      },
    };
  });

  // If attemptId was provided, generate a fresh checkout attempt using previous attempt's shipping address
  let newAttempt: any = null;
  if (input.attemptId && input.createCheckoutAttempt !== false) {
    try {
      const oldAttempt = await getCheckoutAttemptById(input.attemptId);
      if (oldAttempt?.userId === cleanUserId && oldAttempt?.checkoutData?.shippingAddress) {
        newAttempt = await createCheckoutAttemptFromCart(cleanUserId, oldAttempt.checkoutData.shippingAddress);
        if (newAttempt?.id) {
          await query(
            `UPDATE checkout_attempts
             SET checkout_data = JSON_SET(COALESCE(checkout_data, '{}'), '$.sourceAttemptId', ?, '$.isRecovery', true),
                 updated_at = NOW()
             WHERE id = ?`,
            [input.attemptId, newAttempt.id]
          );
        }
      }
    } catch (attemptErr) {
      console.warn("[SWAP_ATTEMPT_CREATION_WARNING]", attemptErr);
    }
  }

  return {
    success: true,
    message: txnResult.message,
    cart: null,
    newAttempt,
    newAttemptId: newAttempt?.id || null,
    swappedItem: txnResult.swappedItem,
  };
}
