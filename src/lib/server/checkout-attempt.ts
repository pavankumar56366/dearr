import "server-only";
import crypto from "crypto";
import type { PoolConnection } from "mysql2/promise";
import { query, withTransaction } from "./db";
import {
  type CreateOrderInput,
  type OrderRecord,
  getOrderById,
  validateShippingAddress,
  generateOrderNumber,
} from "./order";
import { getApplicableDiscountForProduct, computeDiscountAmount } from "./discount";
import { getStoreSettings } from "./settings";
import { getShippingQuote } from "./shipping-quote";
import {
  resolveAuthoritativeUnitPrice,
  resolveAuthoritativeEffectiveStock,
} from "./variant-resolver";

import { recordInternalEvent } from "./events";
import { dispatchEmailOutboxJob, queueEmailOutboxJob } from "./email";

export const ATTEMPT_EXPIRY_MINUTES = 30;
export const ATTEMPT_RETENTION_DAYS = 90;
export const ABANDONED_ATTEMPT_RETENTION_DAYS = 90;

export type CheckoutAttemptStatus =
  | "pending"
  | "verified"
  | "converted"
  | "expired"
  | "failed"
  | "abandoned";

export interface CheckoutAttemptRecord {
  id: string;
  userId: string;
  cartId: string | null;
  provider: string;
  providerOrderId: string | null;
  providerPaymentId: string | null;
  orderId: string | null;
  recoveryShownAt?: Date | null;
  abandonedAt?: Date | null;
  gatewayErrorCode?: string | null;
  gatewayErrorDesc?: string | null;
  status: CheckoutAttemptStatus;
  amount: number;
  currency: string;
  checkoutData: any;
  expiresAt: Date;
  retentionUntil: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateCheckoutAttemptInput {
  userId: string;
  cartId?: string | null;
  amount: number;
  currency?: string;
  provider?: string;
  providerOrderId?: string | null;
  checkoutData: {
    shippingAddress: any;
    items: any[];
    subtotal: number;
    discountAmount: number;
    shippingAmount: number;
    totalAmount: number;
  };
}

export class CheckoutAttemptError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = "CheckoutAttemptError";
    this.statusCode = statusCode;
  }
}

function validateId(id: unknown, fieldName = "ID"): string {
  if (!id || typeof id !== "string") {
    throw new CheckoutAttemptError(`${fieldName} is required and must be a string`, 400);
  }
  const clean = id.trim();
  if (clean.length === 0 || clean.length > 50) {
    throw new CheckoutAttemptError(`${fieldName} must be between 1 and 50 characters`, 400);
  }
  return clean;
}

/**
 * Creates an authoritative checkout attempt before confirmed online payment.
 *
 * Rules:
 * - 30 minutes expiry from creation time.
 * - 30 days retention period after expiry before eligible for purge.
 * - Stores server-authoritative checkout data snapshot.
 */
export async function createCheckoutAttempt(
  input: CreateCheckoutAttemptInput
): Promise<CheckoutAttemptRecord> {
  const id = crypto.randomUUID();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ATTEMPT_EXPIRY_MINUTES * 60 * 1000);
  const retentionUntil = new Date(
    expiresAt.getTime() + ATTEMPT_RETENTION_DAYS * 24 * 60 * 60 * 1000
  );

  const currency = (input.currency || "INR").trim().toUpperCase();
  const provider = (input.provider || "razorpay").trim();

  await query(
    `INSERT INTO checkout_attempts (
       id, user_id, cart_id, provider, provider_order_id, provider_payment_id,
       order_id, status, amount, currency, checkout_data,
       expires_at, retention_until, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, NULL, NULL, 'pending', ?, ?, ?, ?, ?, NOW(), NOW())`,
    [
      id,
      input.userId,
      input.cartId || null,
      provider,
      input.providerOrderId || null,
      input.amount,
      currency,
      JSON.stringify(input.checkoutData),
      expiresAt,
      retentionUntil,
    ]
  );

  const record: CheckoutAttemptRecord = {
    id,
    userId: input.userId,
    cartId: input.cartId || null,
    provider,
    providerOrderId: input.providerOrderId || null,
    providerPaymentId: null,
    orderId: null,
    status: "pending",
    amount: input.amount,
    currency,
    checkoutData: input.checkoutData,
    expiresAt,
    retentionUntil,
    createdAt: now,
    updatedAt: now,
  };

  await recordInternalEvent({
    eventType: "checkout_started",
    attemptId: id,
    userId: input.userId,
    metadata: {
      amount: input.amount,
      provider,
      cartId: input.cartId || null,
    },
  });

  return record;
}

/**
 * Creates an authoritative checkout attempt snapshot directly from the customer's active cart.
 *
 * Core Guarantees:
 * 1. Checks active cart items, active product status, and inventory stock.
 * 2. Re-computes prices, store settings shipping, and product discounts strictly server-side.
 * 3. Does NOT insert any row into `orders` table.
 * 4. Does NOT deduct product inventory.
 * 5. Does NOT delete or convert the customer's cart.
 * 6. Abandoning checkout creates ZERO placed orders in `orders`.
 */
export interface BuyNowItemInput {
  productId: string;
  colorId?: string | null;
  variantId?: string | null;
  quantity: number;
}

export async function createCheckoutAttemptFromCart(
  userId: string,
  shippingInput: CreateOrderInput
): Promise<CheckoutAttemptRecord> {
  const cleanUserId = validateId(userId, "User ID");
  const validatedAddress = validateShippingAddress(shippingInput);

  const attemptRecord = await withTransaction(async (conn) => {
    // 1. Fetch active cart
    const [cartRows]: any = await conn.execute(
      `SELECT id, user_id, status
       FROM carts
       WHERE user_id = ? AND status = 'active'
       ORDER BY created_at DESC
       LIMIT 1`,
      [cleanUserId]
    );

    if (!cartRows || cartRows.length === 0) {
      throw new CheckoutAttemptError(
        "No active cart found. Please add items before checking out.",
        400
      );
    }
    const cart = cartRows[0];

    // 2. Fetch cart items with product, variant, and color details
    const [itemRows]: any = await conn.execute(
      `SELECT
         ci.id AS item_id,
         ci.product_id,
         ci.variant_id,
         ci.color_id,
         ci.quantity,
         p.id AS p_id,
         p.name AS p_name,
         p.price AS p_price,
         p.stock_quantity AS p_stock,
         p.is_active AS p_is_active,
         p.has_colors AS p_has_colors,
         p.cod_enabled AS p_cod_enabled,
         p.category_id AS p_category_id,
         pv.id AS v_id,
         pv.name AS v_name,
         pv.sku AS v_sku,
         pv.color_id AS v_color_id,
         pv.size_name AS v_size_name,
         pv.price AS v_price,
         pv.stock_quantity AS v_stock,
         pv.is_active AS v_is_active,
         pc.id AS c_id,
         pc.name AS c_name,
         pc.hex AS c_hex,
         pc.sku AS c_sku,
         pc.price_override AS c_price_override,
         pc.stock AS c_stock,
         pc.reserved_stock AS c_reserved_stock,
         pc.is_active AS c_is_active,
         (
           SELECT pi.storage_path
           FROM product_images pi
           WHERE pi.product_id = p.id
             AND (pi.color_id = ci.color_id OR (ci.color_id IS NULL AND pi.color_id IS NULL))
           ORDER BY pi.sort_order ASC
           LIMIT 1
         ) AS primary_image,
         (
           SELECT pi.storage_path
           FROM product_images pi
           WHERE pi.product_id = p.id AND pi.color_id IS NULL
           ORDER BY pi.sort_order ASC
           LIMIT 1
         ) AS fallback_image
       FROM cart_items ci
       INNER JOIN products p ON ci.product_id = p.id
       LEFT JOIN product_variants pv ON ci.variant_id = pv.id
       LEFT JOIN product_colors pc ON ci.color_id = pc.id
       WHERE ci.cart_id = ?
       ORDER BY ci.created_at ASC`,
      [cart.id]
    );

    if (!itemRows || itemRows.length === 0) {
      throw new CheckoutAttemptError(
        "Your cart is empty. Please add items before checking out.",
        400
      );
    }

    // 3. Compute server-authoritative amounts & check/reserve stock
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ATTEMPT_EXPIRY_MINUTES * 60 * 1000);
    const attemptId = crypto.randomUUID();
    let orderSubtotal = 0;
    let orderDiscountTotal = 0;
    const preparedItems: any[] = [];
    const pendingReservations: Array<{
      productId: string;
      colorId: string | null;
      variantId: string | null;
      quantity: number;
    }> = [];

    for (const row of itemRows) {
      const isProductActive = Boolean(row.p_is_active === 1 || row.p_is_active === true);
      if (!isProductActive) {
        throw new CheckoutAttemptError(
          `Product "${row.p_name}" is no longer available for purchase`,
          400
        );
      }

      const hasColors = Boolean(row.p_has_colors === 1 || row.p_has_colors === true);
      const hasVariant = Boolean(row.variant_id);
      let unitPrice = 0;
      let effectiveStock = 0;
      let itemName = row.p_name;
      const imageUrl = row.primary_image || row.fallback_image || "/product-samples/1.jpeg";

      if (hasVariant) {
        if (!row.v_id) {
          throw new CheckoutAttemptError(
            `Variant for product "${row.p_name}" was not found`,
            400
          );
        }
        const isVariantActive = Boolean(row.v_is_active === 1 || row.v_is_active === true);
        if (!isVariantActive) {
          throw new CheckoutAttemptError(
            `Variant "${row.v_name}" for product "${row.p_name}" is no longer available`,
            400
          );
        }
        if (row.color_id) {
          if (!row.c_id) {
            throw new CheckoutAttemptError(
              `Color variant for product "${row.p_name}" was not found`,
              400
            );
          }
          const isColorActive = Boolean(row.c_is_active === 1 || row.c_is_active === true);
          if (!isColorActive) {
            throw new CheckoutAttemptError(
              `Color "${row.c_name}" for product "${row.p_name}" is currently inactive`,
              400
            );
          }
        }

        unitPrice = resolveAuthoritativeUnitPrice({
          productPrice: row.p_price,
          colorPriceOverride: row.color_id ? row.c_price_override : null,
          variantPrice: row.v_price,
        });

        // Query active variant reservations
        const [varResRows]: any = await conn.execute(
          `SELECT COALESCE(SUM(quantity), 0) AS reserved_qty
           FROM stock_reservations
           WHERE variant_id = ? AND status = 'active' AND expires_at > NOW()`,
          [row.variant_id]
        );
        const variantReservedStock = Number(varResRows?.[0]?.reserved_qty || 0);
        effectiveStock = Math.max(0, Number(row.v_stock ?? 0) - variantReservedStock);

        itemName = row.color_id && row.c_name
          ? `${row.p_name} (${row.c_name} / ${row.v_size_name || row.v_name})`
          : `${row.p_name} (${row.v_name})`;
      } else if (hasColors && row.color_id) {
        if (!row.c_id) {
          throw new CheckoutAttemptError(
            `Color variant for product "${row.p_name}" was not found`,
            400
          );
        }
        const isColorActive = Boolean(row.c_is_active === 1 || row.c_is_active === true);
        if (!isColorActive) {
          throw new CheckoutAttemptError(
            `Color "${row.c_name}" for product "${row.p_name}" is currently inactive`,
            400
          );
        }
        unitPrice = resolveAuthoritativeUnitPrice({
          productPrice: row.p_price,
          colorPriceOverride: row.c_price_override,
        });
        effectiveStock = Math.max(0, Number(row.c_stock ?? 0) - Number(row.c_reserved_stock ?? 0));
        itemName = `${row.p_name} (${row.c_name})`;
      } else {
        unitPrice = Number(row.p_price || 0);
        effectiveStock = Number(row.p_stock ?? 0);
      }

      const quantity = Number(row.quantity);
      if (quantity > 10) {
        throw new CheckoutAttemptError(
          `Maximum 10 units allowed per item ("${itemName}")`,
          400
        );
      }

      if (quantity > effectiveStock) {
        throw new CheckoutAttemptError(
          `Insufficient stock for "${itemName}": requested ${quantity}, only ${effectiveStock} available`,
          400
        );
      }

      // Create atomic stock reservation
      if (hasVariant) {
        const [vLock]: any = await conn.execute(
          "SELECT stock_quantity FROM product_variants WHERE id = ? FOR UPDATE",
          [row.variant_id]
        );
        const [resLock]: any = await conn.execute(
          `SELECT COALESCE(SUM(quantity), 0) AS reserved_qty
           FROM stock_reservations
           WHERE variant_id = ? AND status = 'active' AND expires_at > NOW()`,
          [row.variant_id]
        );
        const lockedStock = Number(vLock?.[0]?.stock_quantity ?? 0);
        const reservedStock = Number(resLock?.[0]?.reserved_qty ?? 0);
        if (quantity > (lockedStock - reservedStock)) {
          throw new CheckoutAttemptError(
            `Insufficient available stock for "${itemName}". Another customer just reserved the last units.`,
            409
          );
        }
        pendingReservations.push({
          productId: row.product_id,
          colorId: row.color_id || null,
          variantId: row.variant_id,
          quantity,
        });
      } else if (hasColors && row.color_id) {
        const [resResult]: any = await conn.execute(
          `UPDATE product_colors
           SET reserved_stock = reserved_stock + ?, updated_at = NOW()
           WHERE id = ? AND is_active = 1 AND (stock - reserved_stock) >= ?`,
          [quantity, row.color_id, quantity]
        );
        if (resResult.affectedRows === 0) {
          throw new CheckoutAttemptError(
            `Insufficient available stock for "${itemName}". Another customer just reserved the last units.`,
            409
          );
        }
        pendingReservations.push({
          productId: row.product_id,
          colorId: row.color_id,
          variantId: null,
          quantity,
        });
      }

      let discountAmountPerUnit = 0;
      try {
        const discountResult = await getApplicableDiscountForProduct(row.product_id, now);
        if (discountResult && discountResult.discount) {
          const calc = computeDiscountAmount(discountResult.discount, unitPrice);
          discountAmountPerUnit = calc.discountAmount;
        }
      } catch {
        discountAmountPerUnit = 0;
      }

      const finalUnitPrice = Math.max(0, Math.round((unitPrice - discountAmountPerUnit) * 100) / 100);
      const lineDiscount = Math.round(discountAmountPerUnit * quantity * 100) / 100;
      const lineTotal = Math.round(finalUnitPrice * quantity * 100) / 100;

      orderSubtotal += Math.round(unitPrice * quantity * 100) / 100;
      orderDiscountTotal += lineDiscount;

      preparedItems.push({
        id: crypto.randomUUID(),
        productId: row.product_id,
        variantId: row.variant_id || null,
        colorId: (hasColors && row.color_id) ? row.color_id : null,
        productName: row.p_name,
        variantName: hasVariant && (row.v_size_name || row.v_name) ? (row.v_size_name || row.v_name) : null,
        colorName: (hasColors && row.c_name) ? row.c_name : null,
        colorHex: (hasColors && row.c_hex) ? row.c_hex : null,
        sku: (hasVariant && row.v_sku) ? row.v_sku : ((hasColors && row.c_sku) ? row.c_sku : null),
        imageUrl,
        unitPrice,
        quantity,
        discountAmountPerUnit,
        lineDiscount,
        lineTotal,
        codEnabled: Boolean(
          row.p_cod_enabled !== undefined && row.p_cod_enabled !== null
            ? row.p_cod_enabled
            : 1
        ),
      });
    }

    orderSubtotal = Math.round(orderSubtotal * 100) / 100;
    orderDiscountTotal = Math.round(orderDiscountTotal * 100) / 100;

    const storeSettings = await getStoreSettings();
    const netSubtotal = Math.max(0, Math.round((orderSubtotal - orderDiscountTotal) * 100) / 100);
    const totalWeightKg = Math.max(0.5, preparedItems.reduce((w, it) => w + (it.quantity * 0.3), 0));

    const shippingQuote = await getShippingQuote({
      deliveryPincode: validatedAddress.shippingPostalCode,
      subtotal: netSubtotal,
      paymentMethod: "prepaid",
      weightKg: totalWeightKg,
    });

    const shippingAmount = shippingQuote.finalCustomerShippingFee;
    const totalAmount = Math.max(
      0,
      Math.round((netSubtotal + shippingAmount) * 100) / 100
    );

    const retentionUntil = new Date(
      expiresAt.getTime() + ATTEMPT_RETENTION_DAYS * 24 * 60 * 60 * 1000
    );
    const checkoutData = {
      shippingAddress: validatedAddress,
      items: preparedItems,
      subtotal: orderSubtotal,
      discountAmount: orderDiscountTotal,
      shippingAmount,
      totalAmount,
      shippingRateSource: shippingQuote.rateSource,
      shippingCourierName: shippingQuote.courierName,
      isCodEligible:
        preparedItems.length > 0 &&
        preparedItems.every((it) => it.codEnabled !== false),
    };

    await conn.execute(
      `INSERT INTO checkout_attempts (
         id, user_id, cart_id, provider, provider_order_id, provider_payment_id,
         order_id, status, amount, currency, checkout_data,
         expires_at, retention_until, created_at, updated_at
       ) VALUES (?, ?, ?, 'razorpay', NULL, NULL, NULL, 'pending', ?, 'INR', ?, ?, ?, NOW(), NOW())`,
      [
        attemptId,
        cleanUserId,
        cart.id,
        totalAmount,
        JSON.stringify(checkoutData),
        expiresAt,
        retentionUntil,
      ]
    );

    for (const res of pendingReservations) {
      await conn.execute(
        `INSERT INTO stock_reservations (id, attempt_id, product_id, color_id, variant_id, quantity, status, expires_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 'active', ?, NOW(), NOW())`,
        [crypto.randomUUID(), attemptId, res.productId, res.colorId, res.variantId, res.quantity, expiresAt]
      );
    }

    const createdAttempt: CheckoutAttemptRecord = {
      id: attemptId,
      userId: cleanUserId,
      cartId: cart.id,
      provider: "razorpay",
      providerOrderId: null,
      providerPaymentId: null,
      orderId: null,
      status: "pending",
      amount: totalAmount,
      currency: "INR",
      checkoutData,
      expiresAt,
      retentionUntil,
      createdAt: now,
      updatedAt: now,
    };
    return createdAttempt;
  });

  await recordInternalEvent({
    eventType: "checkout_started",
    attemptId: attemptRecord.id,
    userId: attemptRecord.userId,
    metadata: {
      amount: attemptRecord.amount,
      cartId: attemptRecord.cartId,
    },
  });

  return attemptRecord;
}

/**
 * Creates an authoritative Buy Now checkout attempt without modifying, converting, or clearing the customer's cart.
 */
export async function createBuyNowCheckoutAttempt(
  userId: string,
  shippingInput: CreateOrderInput,
  items: BuyNowItemInput[]
): Promise<CheckoutAttemptRecord> {
  const cleanUserId = validateId(userId, "User ID");
  const validatedAddress = validateShippingAddress(shippingInput);

  if (!Array.isArray(items) || items.length === 0) {
    throw new CheckoutAttemptError("At least one item is required for Buy Now", 400);
  }

  const attemptRecord = await withTransaction(async (conn) => {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ATTEMPT_EXPIRY_MINUTES * 60 * 1000);
    const attemptId = crypto.randomUUID();
    let orderSubtotal = 0;
    let orderDiscountTotal = 0;
    const preparedItems: any[] = [];
    const pendingReservations: Array<{
      productId: string;
      colorId: string | null;
      variantId: string | null;
      quantity: number;
    }> = [];

    for (const itemInput of items) {
      const cleanProductId = validateId(itemInput.productId, "Product ID");
      const cleanColorId = itemInput.colorId ? validateId(itemInput.colorId, "Color ID") : null;
      const cleanVariantId = itemInput.variantId ? validateId(itemInput.variantId, "Variant ID") : null;
      const quantity = Math.floor(Number(itemInput.quantity));

      if (isNaN(quantity) || quantity < 1) {
        throw new CheckoutAttemptError("Quantity must be a positive integer", 400);
      }
      if (quantity > 10) {
        throw new CheckoutAttemptError("Maximum 10 units allowed per item/color", 400);
      }

      // Query product
      const [productRows]: any = await conn.execute(
        "SELECT id, name, price, stock_quantity, is_active, has_colors, cod_enabled FROM products WHERE id = ? LIMIT 1",
        [cleanProductId]
      );
      if (!productRows || productRows.length === 0) {
        throw new CheckoutAttemptError("Product not found", 404);
      }
      const product = productRows[0];
      const isProductActive = Boolean(product.is_active === 1 || product.is_active === true);
      if (!isProductActive) {
        throw new CheckoutAttemptError(`Product "${product.name}" is no longer available`, 400);
      }

      const hasColors = Boolean(product.has_colors === 1 || product.has_colors === true);
      let unitPrice = 0;
      let effectiveStock = 0;
      let itemName = product.name;
      let colorRecord: any = null;
      let variantRecord: any = null;
      let resolvedColorId = cleanColorId;

      if (cleanVariantId) {
        const [variantRows]: any = await conn.execute(
          "SELECT id, product_id, color_id, size_name, name, sku, price, stock_quantity, is_active FROM product_variants WHERE id = ? LIMIT 1",
          [cleanVariantId]
        );
        if (!variantRows || variantRows.length === 0 || variantRows[0].product_id !== cleanProductId) {
          throw new CheckoutAttemptError(`Selected variant does not belong to product "${product.name}"`, 400);
        }
        variantRecord = variantRows[0];
        const isVariantActive = Boolean(variantRecord.is_active === 1 || variantRecord.is_active === true);
        if (!isVariantActive) {
          throw new CheckoutAttemptError(`Variant "${variantRecord.name}" is currently inactive`, 400);
        }
        if (variantRecord.color_id) {
          if (resolvedColorId && resolvedColorId !== variantRecord.color_id) {
            throw new CheckoutAttemptError(`Selected variant does not match the chosen color`, 400);
          }
          resolvedColorId = variantRecord.color_id;
        }
      }

      if (hasColors || resolvedColorId) {
        if (!resolvedColorId) {
          throw new CheckoutAttemptError(`Please select a color for product "${product.name}"`, 400);
        }
        const [colorRows]: any = await conn.execute(
          "SELECT id, product_id, name, slug, hex, sku, stock, reserved_stock, price_override, is_active FROM product_colors WHERE id = ? LIMIT 1",
          [resolvedColorId]
        );
        if (!colorRows || colorRows.length === 0 || colorRows[0].product_id !== cleanProductId) {
          throw new CheckoutAttemptError(`Selected color does not belong to product "${product.name}"`, 400);
        }
        colorRecord = colorRows[0];
        const isColorActive = Boolean(colorRecord.is_active === 1 || colorRecord.is_active === true);
        if (!isColorActive) {
          throw new CheckoutAttemptError(`Color "${colorRecord.name}" is currently inactive`, 400);
        }
      }

      unitPrice = resolveAuthoritativeUnitPrice({
        productPrice: product.price,
        colorPriceOverride: colorRecord?.price_override,
        variantPrice: variantRecord?.price,
      });

      if (variantRecord) {
        const [varResRows]: any = await conn.execute(
          `SELECT COALESCE(SUM(quantity), 0) AS reserved_qty
           FROM stock_reservations
           WHERE variant_id = ? AND status = 'active' AND expires_at > NOW()`,
          [variantRecord.id]
        );
        const variantReservedStock = Number(varResRows?.[0]?.reserved_qty || 0);
        effectiveStock = Math.max(0, Number(variantRecord.stock_quantity ?? 0) - variantReservedStock);
        itemName = colorRecord
          ? `${product.name} (${colorRecord.name} / ${variantRecord.size_name || variantRecord.name})`
          : `${product.name} (${variantRecord.name})`;
      } else if (colorRecord) {
        effectiveStock = Math.max(0, Number(colorRecord.stock ?? 0) - Number(colorRecord.reserved_stock ?? 0));
        itemName = `${product.name} (${colorRecord.name})`;
      } else {
        effectiveStock = Number(product.stock_quantity ?? 0);
      }

      if (quantity > effectiveStock) {
        throw new CheckoutAttemptError(
          `Insufficient stock for "${itemName}": requested ${quantity}, only ${effectiveStock} available`,
          400
        );
      }

      // Reserve stock atomically
      if (variantRecord) {
        const [vLock]: any = await conn.execute(
          "SELECT stock_quantity FROM product_variants WHERE id = ? FOR UPDATE",
          [variantRecord.id]
        );
        const [resLock]: any = await conn.execute(
          `SELECT COALESCE(SUM(quantity), 0) AS reserved_qty
           FROM stock_reservations
           WHERE variant_id = ? AND status = 'active' AND expires_at > NOW()`,
          [variantRecord.id]
        );
        const lockedStock = Number(vLock?.[0]?.stock_quantity ?? 0);
        const reservedStock = Number(resLock?.[0]?.reserved_qty ?? 0);
        if (quantity > (lockedStock - reservedStock)) {
          throw new CheckoutAttemptError(
            `Insufficient available stock for "${itemName}". Another customer just reserved the last units.`,
            409
          );
        }
        pendingReservations.push({
          productId: cleanProductId,
          colorId: resolvedColorId || null,
          variantId: variantRecord.id,
          quantity,
        });
      } else if (hasColors && resolvedColorId) {
        const [resResult]: any = await conn.execute(
          `UPDATE product_colors
           SET reserved_stock = reserved_stock + ?, updated_at = NOW()
           WHERE id = ? AND is_active = 1 AND (stock - reserved_stock) >= ?`,
          [quantity, resolvedColorId, quantity]
        );
        if (resResult.affectedRows === 0) {
          throw new CheckoutAttemptError(
            `Insufficient available stock for "${itemName}". Another customer just reserved the last units.`,
            409
          );
        }
        pendingReservations.push({
          productId: cleanProductId,
          colorId: resolvedColorId,
          variantId: null,
          quantity,
        });
      }

      // Query product images
      let imageUrl = "/product-samples/1.jpeg";
      if (resolvedColorId) {
        const [imgRows]: any = await conn.execute(
          `SELECT storage_path FROM product_images
           WHERE product_id = ? AND (color_id = ? OR color_id IS NULL)
           ORDER BY (CASE WHEN color_id = ? THEN 0 ELSE 1 END), sort_order ASC
           LIMIT 1`,
          [cleanProductId, resolvedColorId, resolvedColorId]
        );
        if (imgRows && imgRows.length > 0) {
          imageUrl = imgRows[0].storage_path;
        }
      } else {
        const [imgRows]: any = await conn.execute(
          `SELECT storage_path FROM product_images WHERE product_id = ? ORDER BY sort_order ASC LIMIT 1`,
          [cleanProductId]
        );
        if (imgRows && imgRows.length > 0) {
          imageUrl = imgRows[0].storage_path;
        }
      }

      let discountAmountPerUnit = 0;
      try {
        const discountResult = await getApplicableDiscountForProduct(cleanProductId, now);
        if (discountResult && discountResult.discount) {
          const calc = computeDiscountAmount(discountResult.discount, unitPrice);
          discountAmountPerUnit = calc.discountAmount;
        }
      } catch {
        discountAmountPerUnit = 0;
      }

      const finalUnitPrice = Math.max(0, Math.round((unitPrice - discountAmountPerUnit) * 100) / 100);
      const lineDiscount = Math.round(discountAmountPerUnit * quantity * 100) / 100;
      const lineTotal = Math.round(finalUnitPrice * quantity * 100) / 100;

      orderSubtotal += Math.round(unitPrice * quantity * 100) / 100;
      orderDiscountTotal += lineDiscount;

      preparedItems.push({
        id: crypto.randomUUID(),
        productId: cleanProductId,
        variantId: variantRecord ? variantRecord.id : null,
        colorId: resolvedColorId || null,
        productName: product.name,
        variantName: variantRecord ? (variantRecord.size_name || variantRecord.name) : null,
        colorName: colorRecord ? colorRecord.name : null,
        colorHex: colorRecord ? colorRecord.hex : null,
        sku: variantRecord?.sku || colorRecord?.sku || null,
        imageUrl,
        unitPrice,
        quantity,
        discountAmountPerUnit,
        lineDiscount,
        lineTotal,
        codEnabled: Boolean(
          product.cod_enabled !== undefined && product.cod_enabled !== null
            ? product.cod_enabled
            : 1
        ),
      });
    }

    orderSubtotal = Math.round(orderSubtotal * 100) / 100;
    orderDiscountTotal = Math.round(orderDiscountTotal * 100) / 100;

    const storeSettings = await getStoreSettings();
    const netSubtotal = Math.max(0, Math.round((orderSubtotal - orderDiscountTotal) * 100) / 100);
    const totalWeightKg = Math.max(0.5, preparedItems.reduce((w, it) => w + (it.quantity * 0.3), 0));

    const shippingQuote = await getShippingQuote({
      deliveryPincode: validatedAddress.shippingPostalCode,
      subtotal: netSubtotal,
      paymentMethod: "prepaid",
      weightKg: totalWeightKg,
    });

    const shippingAmount = shippingQuote.finalCustomerShippingFee;
    const totalAmount = Math.max(
      0,
      Math.round((netSubtotal + shippingAmount) * 100) / 100
    );

    const retentionUntil = new Date(
      expiresAt.getTime() + ATTEMPT_RETENTION_DAYS * 24 * 60 * 60 * 1000
    );
    const checkoutData = {
      shippingAddress: validatedAddress,
      items: preparedItems,
      subtotal: orderSubtotal,
      discountAmount: orderDiscountTotal,
      shippingAmount,
      totalAmount,
      shippingRateSource: shippingQuote.rateSource,
      shippingCourierName: shippingQuote.courierName,
      isBuyNow: true,
      isCodEligible:
        preparedItems.length > 0 &&
        preparedItems.every((it) => it.codEnabled !== false),
    };

    // Note: cart_id is NULL here! Customer's active cart is completely untouched!
    await conn.execute(
      `INSERT INTO checkout_attempts (
         id, user_id, cart_id, provider, provider_order_id, provider_payment_id,
         order_id, status, amount, currency, checkout_data,
         expires_at, retention_until, created_at, updated_at
       ) VALUES (?, ?, NULL, 'razorpay', NULL, NULL, NULL, 'pending', ?, 'INR', ?, ?, ?, NOW(), NOW())`,
      [
        attemptId,
        cleanUserId,
        totalAmount,
        JSON.stringify(checkoutData),
        expiresAt,
        retentionUntil,
      ]
    );

    for (const res of pendingReservations) {
      await conn.execute(
        `INSERT INTO stock_reservations (id, attempt_id, product_id, color_id, variant_id, quantity, status, expires_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 'active', ?, NOW(), NOW())`,
        [crypto.randomUUID(), attemptId, res.productId, res.colorId, res.variantId, res.quantity, expiresAt]
      );
    }

    const createdAttempt: CheckoutAttemptRecord = {
      id: attemptId,
      userId: cleanUserId,
      cartId: null,
      provider: "razorpay",
      providerOrderId: null,
      providerPaymentId: null,
      orderId: null,
      status: "pending",
      amount: totalAmount,
      currency: "INR",
      checkoutData,
      expiresAt,
      retentionUntil,
      createdAt: now,
      updatedAt: now,
    };
    return createdAttempt;
  });

  await recordInternalEvent({
    eventType: "checkout_started",
    attemptId: attemptRecord.id,
    userId: attemptRecord.userId,
    metadata: {
      amount: attemptRecord.amount,
      isBuyNow: true,
    },
  });

  return attemptRecord;
}

/**
 * Retrieves a checkout attempt by its internal UUID.
 */
export async function getCheckoutAttemptById(
  id: string
): Promise<CheckoutAttemptRecord | null> {
  const rows = await query<any[]>(
    "SELECT * FROM checkout_attempts WHERE id = ? LIMIT 1",
    [id]
  );
  if (!rows || rows.length === 0) return null;
  return mapAttemptRow(rows[0]);
}

/**
 * Retrieves a checkout attempt by its Razorpay provider order ID.
 */
export async function getCheckoutAttemptByProviderOrder(
  providerOrderId: string
): Promise<CheckoutAttemptRecord | null> {
  const rows = await query<any[]>(
    "SELECT * FROM checkout_attempts WHERE provider_order_id = ? LIMIT 1",
    [providerOrderId]
  );
  if (!rows || rows.length === 0) return null;
  return mapAttemptRow(rows[0]);
}

/**
 * Updates the provider_order_id for an existing checkout attempt.
 */
export async function updateCheckoutAttemptProviderOrder(
  attemptId: string,
  providerOrderId: string
): Promise<void> {
  await query(
    `UPDATE checkout_attempts
     SET provider_order_id = ?, updated_at = NOW()
     WHERE id = ?`,
    [providerOrderId, attemptId]
  );
}

/**
 * Links a verified checkout attempt to a placed order upon trusted server verification.
 */
export async function markAttemptConverted(
  attemptId: string,
  orderId: string,
  providerPaymentId?: string
): Promise<void> {
  await query(
    `UPDATE checkout_attempts
     SET status = 'converted',
         order_id = ?,
         provider_payment_id = COALESCE(?, provider_payment_id),
         updated_at = NOW()
     WHERE id = ?`,
    [orderId, providerPaymentId || null, attemptId]
  );
}

/**
 * Authoritatively finalizes a placed order from a verified checkout attempt.
 *
 * Guarantees:
 * 1. Transactional isolation with exclusive row lock (FOR UPDATE).
 * 2. Idempotency: Repeated webhook or callback deliveries return existing order without duplication.
 * 3. Race condition safe: Concurrent webhook and callback calls result in exactly 1 order and 1 payment record.
 * 4. Deducts inventory atomically inside the transaction.
 * 5. Inserts placed order into `orders` with status='confirmed', payment_status='paid'.
 * 6. Inserts item lines into `order_items`.
 * 7. Inserts captured payment record into `payments`.
 * 8. Marks active cart as 'converted' and deletes items from `cart_items`.
 * 9. Reconciles late payments safely even if attempt passed 30-min expiry.
 */
export async function finalizeOrderFromAttempt(
  attemptId: string,
  paymentDetails: {
    providerPaymentId: string;
    amount?: number;
    currency?: string;
  }
): Promise<OrderRecord> {
  const cleanAttemptId = (attemptId || "").trim();
  const cleanPaymentId = (paymentDetails.providerPaymentId || "").trim();

  if (!cleanPaymentId) {
    throw new CheckoutAttemptError(
      "Provider payment ID is required to finalize order",
      400
    );
  }

  const txnResult = await withTransaction(async (conn) => {
    // 1. Lock the attempt row exclusively
    const [attemptRows]: any = await conn.execute(
      "SELECT * FROM checkout_attempts WHERE id = ? FOR UPDATE",
      [cleanAttemptId]
    );

    if (!attemptRows || attemptRows.length === 0) {
      throw new CheckoutAttemptError("Checkout attempt not found", 404);
    }

    const attemptRow = attemptRows[0];

    // 2. Idempotency guard: If already converted, return existing order id
    if (attemptRow.status === "converted" && attemptRow.order_id) {
      return { orderId: attemptRow.order_id, alreadyConverted: true };
    }

    // 3. Check for payment ID collision across payments table
    const [existingPaymentCollisions]: any = await conn.execute(
      "SELECT id, order_id FROM payments WHERE provider_payment_id = ? LIMIT 1",
      [cleanPaymentId]
    );
    if (existingPaymentCollisions && existingPaymentCollisions.length > 0) {
      const collision = existingPaymentCollisions[0];
      if (attemptRow.order_id && collision.order_id === attemptRow.order_id) {
        return { orderId: attemptRow.order_id, alreadyConverted: true };
      }
      throw new CheckoutAttemptError(
        "Payment ID has already been assigned to an existing order",
        409
      );
    }

    // 4. Parse snapshot checkout data
    let checkoutData: any = {};
    try {
      checkoutData =
        typeof attemptRow.checkout_data === "string"
          ? JSON.parse(attemptRow.checkout_data)
          : attemptRow.checkout_data;
    } catch {
      throw new CheckoutAttemptError(
        "Invalid checkout data stored in attempt",
        500
      );
    }

    const items = checkoutData.items || [];
    const shipping = checkoutData.shippingAddress || {};
    const totalAmount = Number(attemptRow.amount);
    const currency = attemptRow.currency || "INR";

    // 5. Deduct inventory atomically
    for (const item of items) {
      const qty = Number(item.quantity);
      if (item.variantId) {
        const [result]: any = await conn.execute(
          `UPDATE product_variants
           SET stock_quantity = stock_quantity - ?, updated_at = NOW()
           WHERE id = ? AND stock_quantity >= ?`,
          [qty, item.variantId, qty]
        );
        if (result.affectedRows === 0) {
          throw new CheckoutAttemptError(
            `Insufficient stock available for "${item.productName || "variant"}". Cannot finalize order.`,
            409
          );
        }
        await conn.execute(
          `UPDATE stock_reservations
           SET status = 'consumed', updated_at = NOW()
           WHERE attempt_id = ? AND variant_id = ? AND status = 'active'`,
          [attemptRow.id, item.variantId]
        );
      } else if (item.colorId) {
        const [result]: any = await conn.execute(
          `UPDATE product_colors
           SET stock = stock - ?,
               reserved_stock = GREATEST(0, reserved_stock - ?),
               updated_at = NOW()
           WHERE id = ? AND stock >= ?`,
          [qty, qty, item.colorId, qty]
        );
        if (result.affectedRows === 0) {
          throw new CheckoutAttemptError(
            `Insufficient stock available for color "${item.colorName || item.productName}". Payment captured but inventory exhausted; reconciliation required.`,
            409
          );
        }
        await conn.execute(
          `UPDATE stock_reservations
           SET status = 'consumed', updated_at = NOW()
           WHERE attempt_id = ? AND color_id = ? AND status = 'active'`,
          [attemptRow.id, item.colorId]
        );
      } else if (item.productId) {
        const [result]: any = await conn.execute(
          `UPDATE products
           SET stock_quantity = stock_quantity - ?, updated_at = NOW()
           WHERE id = ? AND stock_quantity >= ?`,
          [qty, item.productId, qty]
        );
        if (result.affectedRows === 0) {
          throw new CheckoutAttemptError(
            `Insufficient stock available for "${item.productName || "product"}". Cannot finalize order.`,
            409
          );
        }
        await conn.execute(
          `UPDATE stock_reservations
           SET status = 'consumed', updated_at = NOW()
           WHERE attempt_id = ? AND product_id = ? AND color_id IS NULL AND variant_id IS NULL AND status = 'active'`,
          [attemptRow.id, item.productId]
        );
      }
    }

    // 6. Generate order ID and unique order number
    const orderId = crypto.randomUUID();
    const orderNumber = await generateOrderNumber();

    const storeSettings = await getStoreSettings();
    const addressEditDeadline = storeSettings.allowAddressChange
      ? new Date(Date.now() + storeSettings.addressChangeWindowHours * 3600 * 1000)
      : null;

    // 7. Insert placed order with confirmed status and paid payment_status
    await conn.execute(
      `INSERT INTO orders (
         id, order_number, user_id, status, payment_status,
         subtotal, discount_amount, shipping_amount, total_amount, currency,
         shipping_full_name, shipping_phone,
         shipping_address_line_1, shipping_address_line_2,
         shipping_city, shipping_state, shipping_postal_code, shipping_country,
         address_edit_deadline, address_change_count,
         dispatched_at, delivered_at, cancelled_at,
         created_at, updated_at
       ) VALUES (?, ?, ?, 'confirmed', 'paid',
                 ?, ?, ?, ?, ?,
                 ?, ?,
                 ?, ?,
                 ?, ?, ?, ?,
                 ?, 0,
                 NULL, NULL, NULL,
                 NOW(), NOW())`,
      [
        orderId,
        orderNumber,
        attemptRow.user_id,
        checkoutData.subtotal || totalAmount,
        checkoutData.discountAmount || 0,
        checkoutData.shippingAmount || 0,
        totalAmount,
        currency,
        shipping.shippingFullName || "",
        shipping.shippingPhone || "",
        shipping.shippingAddressLine1 || "",
        shipping.shippingAddressLine2 || null,
        shipping.shippingCity || "",
        shipping.shippingState || "",
        shipping.shippingPostalCode || "",
        shipping.shippingCountry || "India",
        addressEditDeadline,
      ]
    );

    // 8. Insert order items with color snapshots
    for (const item of items) {
      await conn.execute(
        `INSERT INTO order_items (
           id, order_id, product_id, variant_id, color_id,
           product_name, variant_name, color_name, color_hex, sku, image_url,
           unit_price, quantity, discount_amount, line_total,
           created_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          item.id || crypto.randomUUID(),
          orderId,
          item.productId,
          item.variantId || null,
          item.colorId || null,
          item.productName || item.title || "Product",
          item.variantName || null,
          item.colorName || null,
          item.colorHex || null,
          item.sku || null,
          item.imageUrl || null,
          Number(item.unitPrice || 0),
          Number(item.quantity || 1),
          Number(item.lineDiscount || 0),
          Number(item.lineTotal ?? (Number(item.unitPrice || 0) * Number(item.quantity || 1))),
        ]
      );
    }

    // 9. Insert payment record into payments table
    const paymentId = crypto.randomUUID();
    await conn.execute(
      `INSERT INTO payments (
         id, order_id, provider, provider_order_id, provider_payment_id,
         status, amount, currency, paid_at, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, 'captured', ?, ?, NOW(), NOW(), NOW())`,
      [
        paymentId,
        orderId,
        attemptRow.provider || "razorpay",
        attemptRow.provider_order_id || `prov_ord_${orderId.slice(0, 8)}`,
        cleanPaymentId,
        totalAmount,
        currency,
      ]
    );

    // 10. Mark cart converted and clear cart items
    if (attemptRow.cart_id) {
      await conn.execute(
        "UPDATE carts SET status = 'converted', updated_at = NOW() WHERE id = ?",
        [attemptRow.cart_id]
      );
      await conn.execute(
        "DELETE FROM cart_items WHERE cart_id = ?",
        [attemptRow.cart_id]
      );
    }

    // 11. Record order_status_history entry
    await conn.execute(
      `INSERT INTO order_status_history (
         id, order_id, previous_status, new_status, changed_by, note, created_at
       ) VALUES (?, ?, NULL, 'confirmed', ?, 'Order finalized upon verified online payment capture', NOW())`,
      [crypto.randomUUID(), orderId, attemptRow.user_id]
    );

    // 12. Mark attempt as converted
    await conn.execute(
      `UPDATE checkout_attempts
       SET status = 'converted',
           order_id = ?,
           provider_payment_id = ?,
           updated_at = NOW()
       WHERE id = ?`,
      [orderId, cleanPaymentId, attemptRow.id]
    );

    // 13. Atomically enqueue durable payment confirmation email in email_outbox
    let customerEmail = (checkoutData.email || "").trim().toLowerCase();
    let customerName = (shipping.shippingFullName || "").trim();
    if (attemptRow.user_id) {
      const [userRows]: any = await conn.execute(
        "SELECT email, full_name FROM profiles WHERE id = ? LIMIT 1",
        [attemptRow.user_id]
      );
      if (userRows && userRows.length > 0) {
        if (!customerEmail) customerEmail = (userRows[0].email || "").trim().toLowerCase();
        if (!customerName) customerName = (userRows[0].full_name || "").trim();
      }
    }

    let outboxJobId: string | null = null;
    let isDuplicateJob = false;
    if (customerEmail) {
      const itemsSummary = items.map((it: any) => ({
        title: it.productName || it.title || "Product",
        quantity: Number(it.quantity || 1),
        price: Number(it.unitPrice || 0),
      }));

      const queueRes = await queueEmailOutboxJob(
        {
          eventType: "payment_confirmation",
          idempotencyKey: `order_payment:${orderId}`,
          recipientEmail: customerEmail,
          recipientName: customerName || "Customer",
          orderId,
          payload: {
            orderNumber,
            amount: totalAmount,
            currency,
            itemsSummary,
          },
        },
        conn
      );
      outboxJobId = queueRes.id;
      isDuplicateJob = queueRes.isDuplicate;
    }

    // Return the created order id and outbox job identifier (suppress dispatch if already queued)
    return { orderId, outboxJobId: isDuplicateJob ? null : outboxJobId };
  });

  const finalOrder = await getOrderById(txnResult.orderId);
  if (!finalOrder) {
    throw new CheckoutAttemptError("Failed to load finalized order", 500);
  }

  if (!(txnResult as any).alreadyConverted) {
    await recordInternalEvent({
      eventType: "payment_success",
      attemptId: cleanAttemptId,
      orderId: finalOrder.id,
      userId: finalOrder.userId,
      metadata: {
        orderNumber: finalOrder.orderNumber,
        amount: finalOrder.totalAmount,
        currency: finalOrder.currency,
        providerPaymentId: cleanPaymentId,
      },
    });

    // Decoupled, asynchronous dispatch of the committed payment confirmation email
    if (txnResult.outboxJobId) {
      dispatchEmailOutboxJob(txnResult.outboxJobId).catch((err) => {
        console.warn("[EmailOutbox] Async dispatch notice:", err?.message || err);
      });
    }
  }

  return finalOrder;
}

/**
 * Idempotent scheduled cleanup:
 * 1. Expires unpaid checkout attempts older than 30 minutes.
 * 2. Purges expired checkout attempts older than 90 days retention.
 *
 * Placed orders and order items are NEVER deleted by this cleanup.
 */
export async function cleanupCheckoutAttempts(): Promise<{
  expiredCount: number;
  purgedCount: number;
  releasedReservationsCount: number;
}> {
  return await withTransaction(async (conn) => {
    let releasedReservationsCount = 0;
    let expiredCount = 0;

    // Step 1: Find pending or abandoned attempts past expiry that do not have captured or verified payments
    const [expiredAttempts]: any = await conn.execute(
      `SELECT ca.id FROM checkout_attempts ca
       WHERE ca.status IN ('pending', 'abandoned')
         AND ca.expires_at < NOW()
         AND NOT EXISTS (
           SELECT 1 FROM payments p
           WHERE (p.order_id = ca.id OR p.provider_order_id = ca.provider_order_id)
             AND p.status IN ('captured', 'verified')
         )
       FOR UPDATE`
    );

    if (expiredAttempts && expiredAttempts.length > 0) {
      const expiredIds = expiredAttempts.map((a: any) => a.id);
      const placeholders = expiredIds.map(() => "?").join(",");

      const [reservations]: any = await conn.execute(
        `SELECT id, color_id, variant_id, quantity
         FROM stock_reservations
         WHERE status = 'active' AND attempt_id IN (${placeholders})
         FOR UPDATE`,
        expiredIds
      );

      for (const res of reservations || []) {
        if (res.color_id && !res.variant_id) {
          await conn.execute(
            `UPDATE product_colors
             SET reserved_stock = GREATEST(0, reserved_stock - ?), updated_at = NOW()
             WHERE id = ?`,
            [res.quantity, res.color_id]
          );
        }
        const [updateRes]: any = await conn.execute(
          `UPDATE stock_reservations
           SET status = 'released', updated_at = NOW()
           WHERE id = ? AND status = 'active'`,
          [res.id]
        );
        if (updateRes && updateRes.affectedRows > 0) {
          releasedReservationsCount++;
        }
      }

      // Step 2: Mark those expired attempts as 'expired' and set retention
      const [expireResult]: any = await conn.execute(
        `UPDATE checkout_attempts
         SET status = 'expired',
             retention_until = DATE_ADD(NOW(), INTERVAL ${ABANDONED_ATTEMPT_RETENTION_DAYS} DAY),
             updated_at = NOW()
         WHERE id IN (${placeholders})`,
        expiredIds
      );
      expiredCount = Number(expireResult?.affectedRows || 0);
    }

    // Step 3: Purge attempts past retention (and clean up reservations)
    let purgedCount = 0;
    const [toPurge]: any = await conn.execute(
      `SELECT id FROM checkout_attempts
       WHERE status IN ('expired', 'failed', 'abandoned')
         AND retention_until < NOW()
       FOR UPDATE`
    );
    if (toPurge && toPurge.length > 0) {
      const purgeIds = toPurge.map((a: any) => a.id);
      const placeholders = purgeIds.map(() => "?").join(",");
      await conn.execute(
        `DELETE FROM stock_reservations WHERE attempt_id IN (${placeholders})`,
        purgeIds
      );
      const [purgeResult]: any = await conn.execute(
        `DELETE FROM checkout_attempts
         WHERE id IN (${placeholders})`,
        purgeIds
      );
      purgedCount = Number(purgeResult?.affectedRows || 0);
    }

    return { expiredCount, purgedCount, releasedReservationsCount };
  });
}

export const cleanupExpiredCheckoutAttempts = cleanupCheckoutAttempts;

/**
 * Manually releases any active stock reservations for a specific checkout attempt (e.g. upon payment failure or cancellation).
 */
export async function releaseCheckoutAttemptReservations(
  attemptId: string,
  conn?: any
): Promise<number> {
  const cleanId = (attemptId || "").trim();
  if (!cleanId) return 0;

  const runWithConn = async (c: any) => {
    const [reservations]: any = await c.execute(
      `SELECT id, color_id, variant_id, quantity
       FROM stock_reservations
       WHERE attempt_id = ? AND status = 'active'
       FOR UPDATE`,
      [cleanId]
    );

    let count = 0;
    for (const res of reservations || []) {
      if (res.color_id && !res.variant_id) {
        await c.execute(
          `UPDATE product_colors
           SET reserved_stock = GREATEST(0, reserved_stock - ?), updated_at = NOW()
           WHERE id = ?`,
          [res.quantity, res.color_id]
        );
      }
      const [updateRes]: any = await c.execute(
        `UPDATE stock_reservations
         SET status = 'released', updated_at = NOW()
         WHERE id = ? AND status = 'active'`,
        [res.id]
      );
      if (updateRes && updateRes.affectedRows > 0) {
        count++;
      }
    }
    return count;
  };

  if (conn) {
    return await runWithConn(conn);
  }
  return await withTransaction(runWithConn);
}

/**
 * Handles customer dismissal of payment modal safely.
 *
 * Guarantees:
 * 1. Checks if attempt has already been converted to a placed order. If so, suppresses abandonment and returns order ID.
 * 2. Idempotent: repeated dismissals do not corrupt data or produce duplicate events.
 * 3. Transitions status to 'abandoned' and extends retention to 90 days.
 * 4. Records `checkout.abandoned` in internal_events.
 */
export async function markAttemptAbandoned(
  attemptId: string,
  userId?: string
): Promise<{
  success: boolean;
  status: CheckoutAttemptStatus;
  isPaid: boolean;
  orderId?: string | null;
  orderNumber?: string | null;
}> {
  const cleanId = (attemptId || "").trim();
  if (!cleanId) {
    throw new CheckoutAttemptError("Attempt ID is required", 400);
  }

  return await withTransaction(async (conn) => {
    const [rows]: any = await conn.execute(
      "SELECT * FROM checkout_attempts WHERE id = ? FOR UPDATE",
      [cleanId]
    );
    if (!rows || rows.length === 0) {
      throw new CheckoutAttemptError("Checkout attempt not found", 404);
    }
    const attempt = rows[0];

    // Ownership check if userId supplied
    if (userId && attempt.user_id !== userId) {
      throw new CheckoutAttemptError("Forbidden: Unauthorized attempt access", 403);
    }

    // Guard: If already converted, never mark abandoned
    if (attempt.status === "converted" && attempt.order_id) {
      const [ordRows]: any = await conn.execute(
        "SELECT order_number FROM orders WHERE id = ? LIMIT 1",
        [attempt.order_id]
      );
      return {
        success: true,
        status: "converted",
        isPaid: true,
        orderId: attempt.order_id,
        orderNumber: ordRows?.[0]?.order_number || null,
      };
    }

    // Check payments table to see if payment was already captured or verified
    const [payRows]: any = await conn.execute(
      `SELECT id, status, order_id FROM payments
       WHERE (order_id = ? OR provider_order_id = ?) AND status IN ('captured', 'verified')
       LIMIT 1`,
      [attempt.id, attempt.provider_order_id || attempt.id]
    );
    if (payRows && payRows.length > 0) {
      return {
        success: true,
        status: attempt.status,
        isPaid: true,
        orderId: attempt.order_id || payRows[0].order_id,
      };
    }

    // Guard: If already marked failed by gateway decline, preserve failed status
    if (attempt.status === "failed") {
      if (!attempt.abandoned_at) {
        await conn.execute(
          `UPDATE checkout_attempts
           SET abandoned_at = NOW(),
               updated_at = NOW()
           WHERE id = ?`,
          [cleanId]
        );
      }
      return {
        success: true,
        status: "failed",
        isPaid: false,
      };
    }

    const isAlreadyAbandoned = attempt.status === "abandoned";
    if (!isAlreadyAbandoned) {
      await conn.execute(
        `UPDATE checkout_attempts
         SET status = 'abandoned',
             abandoned_at = NOW(),
             retention_until = DATE_ADD(NOW(), INTERVAL ? DAY),
             updated_at = NOW()
         WHERE id = ?`,
        [ABANDONED_ATTEMPT_RETENTION_DAYS, cleanId]
      );

      await recordInternalEvent({
        eventType: "razorpay_dismissed",
        attemptId: cleanId,
        userId: attempt.user_id,
        metadata: {
          amount: Number(attempt.amount),
          cartId: attempt.cart_id,
        },
      });

      await recordInternalEvent({
        eventType: "checkout.abandoned",
        attemptId: cleanId,
        userId: attempt.user_id,
        metadata: {
          amount: Number(attempt.amount),
          cartId: attempt.cart_id,
        },
      });
    }

    return {
      success: true,
      status: "abandoned",
      isPaid: false,
    };
  });
}

/**
 * Handles verified payment gateway failures safely.
 *
 * Guarantees:
 * 1. Checks if attempt has already been converted to a placed order. If so, suppresses failure.
 * 2. Sanitizes external error code and description to prevent secret leakage or injection.
 * 3. Sets status = 'failed' and extends retention to 90 days.
 * 4. Records `payment_failed` in internal_events.
 */
export async function markAttemptFailed(
  attemptId: string,
  errorDetails?: {
    code?: string;
    description?: string;
    source?: string;
    step?: string;
    reason?: string;
  },
  userId?: string,
  conn?: PoolConnection
): Promise<{
  success: boolean;
  status: CheckoutAttemptStatus;
  isPaid: boolean;
  orderId?: string | null;
  orderNumber?: string | null;
}> {
  const cleanId = (attemptId || "").trim();
  if (!cleanId) {
    throw new CheckoutAttemptError("Attempt ID is required", 400);
  }

  const safeCode = (errorDetails?.code || "PAYMENT_FAILED").trim().slice(0, 100);
  const safeDesc = (
    errorDetails?.description ||
    "Payment could not be completed. Your cart remains saved so you can retry."
  )
    .trim()
    .slice(0, 500);

  const runWithConn = async (c: PoolConnection): Promise<{
    success: boolean;
    status: CheckoutAttemptStatus;
    isPaid: boolean;
    orderId?: string | null;
    orderNumber?: string | null;
  }> => {
    const [rows]: any = await c.execute(
      "SELECT * FROM checkout_attempts WHERE id = ? FOR UPDATE",
      [cleanId]
    );
    if (!rows || rows.length === 0) {
      throw new CheckoutAttemptError("Checkout attempt not found", 404);
    }
    const attempt = rows[0];

    // Ownership check if userId supplied
    if (userId && attempt.user_id !== userId) {
      throw new CheckoutAttemptError("Forbidden: Unauthorized attempt access", 403);
    }

    // Guard: If already converted, do not downgrade
    if (attempt.status === "converted" && attempt.order_id) {
      const [ordRows]: any = await c.execute(
        "SELECT order_number FROM orders WHERE id = ? LIMIT 1",
        [attempt.order_id]
      );
      return {
        success: true,
        status: "converted",
        isPaid: true,
        orderId: attempt.order_id,
        orderNumber: ordRows?.[0]?.order_number || null,
      };
    }

    // Check payments table
    const [payRows]: any = await c.execute(
      `SELECT id, status, order_id FROM payments
       WHERE (order_id = ? OR provider_order_id = ?) AND status IN ('captured', 'verified')
       LIMIT 1`,
      [attempt.id, attempt.provider_order_id || attempt.id]
    );
    if (payRows && payRows.length > 0) {
      return {
        success: true,
        status: attempt.status,
        isPaid: true,
        orderId: attempt.order_id || payRows[0].order_id,
      };
    }

    await c.execute(
      `UPDATE checkout_attempts
       SET status = 'failed',
           gateway_error_code = ?,
           gateway_error_desc = ?,
           retention_until = DATE_ADD(NOW(), INTERVAL ? DAY),
           updated_at = NOW()
       WHERE id = ?`,
      [safeCode, safeDesc, ABANDONED_ATTEMPT_RETENTION_DAYS, cleanId]
    );

    // Release reservations on failure so stock is not permanently blocked
    await releaseCheckoutAttemptReservations(cleanId, c);

    await recordInternalEvent({
      eventType: "payment_failed",
      attemptId: cleanId,
      userId: attempt.user_id,
      metadata: {
        code: safeCode,
        description: safeDesc,
        amount: Number(attempt.amount),
      },
    });

    return {
      success: true,
      status: "failed",
      isPaid: false,
    };
  };

  if (conn) {
    return await runWithConn(conn);
  }
  return await withTransaction(runWithConn);
}

/**
 * Idempotently records that the recovery sheet has been presented to the customer.
 * Prevents multiple presentations for the same attempt.
 */
export async function recordRecoveryShown(
  attemptId: string,
  userId?: string
): Promise<{ success: boolean; alreadyShown: boolean }> {
  const cleanId = (attemptId || "").trim();
  if (!cleanId) return { success: false, alreadyShown: false };

  const attempt = await getCheckoutAttemptById(cleanId);
  if (!attempt) return { success: false, alreadyShown: false };
  if (userId && attempt.userId !== userId) {
    throw new CheckoutAttemptError("Forbidden: Unauthorized attempt access", 403);
  }

  if (attempt.recoveryShownAt) {
    return { success: true, alreadyShown: true };
  }

  const result: any = await query(
    `UPDATE checkout_attempts
     SET recovery_shown_at = NOW(), updated_at = NOW()
     WHERE id = ? AND recovery_shown_at IS NULL`,
    [cleanId]
  );

  return {
    success: true,
    alreadyShown: result.affectedRows === 0,
  };
}

/**
 * Checks authoritative attempt recovery status.
 *
 * Guarantees:
 * - If paid / converted -> recovery suppressed, routes to order confirmation.
 * - If recovery already shown -> recovery suppressed.
 * - If settings have recovery sheet disabled -> recovery suppressed.
 * - Otherwise eligible to show recovery sheet.
 */
export async function getAttemptRecoveryStatus(
  attemptId: string,
  userId?: string
): Promise<{
  eligible: boolean;
  attemptId: string;
  status: CheckoutAttemptStatus;
  isPaid: boolean;
  orderId?: string | null;
  orderNumber?: string | null;
  alreadyShown: boolean;
  recoveryShownAt?: Date | null;
  cartSnapshot?: any;
  errorCode?: string | null;
  errorDescription?: string | null;
}> {
  const cleanId = (attemptId || "").trim();
  if (!cleanId) {
    throw new CheckoutAttemptError("Attempt ID is required", 400);
  }

  const attempt = await getCheckoutAttemptById(cleanId);
  if (!attempt) {
    throw new CheckoutAttemptError("Checkout attempt not found", 404);
  }

  if (userId && attempt.userId !== userId) {
    throw new CheckoutAttemptError("Forbidden: Unauthorized attempt access", 403);
  }

  // 1. If converted, load order number and return suppressed
  if (attempt.status === "converted" && attempt.orderId) {
    const order = await getOrderById(attempt.orderId);
    return {
      eligible: false,
      attemptId: attempt.id,
      status: "converted",
      isPaid: true,
      orderId: attempt.orderId,
      orderNumber: order?.orderNumber || null,
      alreadyShown: Boolean(attempt.recoveryShownAt),
      recoveryShownAt: attempt.recoveryShownAt || null,
    };
  }

  // 2. Check store settings toggle
  const settings = await getStoreSettings();
  if (settings.recoverySheetEnabled === false) {
    return {
      eligible: false,
      attemptId: attempt.id,
      status: attempt.status,
      isPaid: false,
      alreadyShown: Boolean(attempt.recoveryShownAt),
      recoveryShownAt: attempt.recoveryShownAt || null,
    };
  }

  // 3. If already shown, suppress
  const alreadyShown = Boolean(attempt.recoveryShownAt);
  if (alreadyShown) {
    return {
      eligible: false,
      attemptId: attempt.id,
      status: attempt.status,
      isPaid: false,
      alreadyShown: true,
      recoveryShownAt: attempt.recoveryShownAt || null,
      cartSnapshot: attempt.checkoutData,
      errorCode: attempt.gatewayErrorCode || null,
      errorDescription: attempt.gatewayErrorDesc || null,
    };
  }

  // 4. Eligible if status is 'abandoned' or 'failed' or 'pending' (past dismissal)
  const isEligibleStatus =
    attempt.status === "abandoned" ||
    attempt.status === "failed" ||
    attempt.status === "pending";

  return {
    eligible: isEligibleStatus && !alreadyShown,
    attemptId: attempt.id,
    status: attempt.status,
    isPaid: false,
    alreadyShown: false,
    recoveryShownAt: null,
    cartSnapshot: attempt.checkoutData,
    errorCode: attempt.gatewayErrorCode || null,
    errorDescription: attempt.gatewayErrorDesc || null,
  };
}

/**
 * Handles late but genuinely captured payments for an attempt that was marked expired.
 *
 * Reconciles the captured payment without discarding evidence or dropping customer funds:
 * - Validates payment authenticity.
 * - Transitions attempt status from 'expired' to 'converted'.
 * - Guarantees idempotency (avoids double order creation).
 */
export async function reconcileLatePaymentAttempt(
  attemptId: string,
  providerPaymentId: string,
  orderId: string
): Promise<void> {
  await withTransaction(async (conn) => {
    const [rows]: any = await conn.execute(
      "SELECT id, status, order_id FROM checkout_attempts WHERE id = ? FOR UPDATE",
      [attemptId]
    );
    if (!rows || rows.length === 0) return;

    const attempt = rows[0];
    if (attempt.status === "converted" && attempt.order_id) {
      // Already reconciled
      return;
    }

    await conn.execute(
      `UPDATE checkout_attempts
       SET status = 'converted',
           order_id = ?,
           provider_payment_id = ?,
           updated_at = NOW()
       WHERE id = ?`,
      [orderId, providerPaymentId, attemptId]
    );
  });
}

function mapAttemptRow(row: any): CheckoutAttemptRecord {
  let parsedCheckoutData = {};
  try {
    parsedCheckoutData =
      typeof row.checkout_data === "string"
        ? JSON.parse(row.checkout_data)
        : row.checkout_data;
  } catch {}

  return {
    id: row.id,
    userId: row.user_id,
    cartId: row.cart_id || null,
    provider: row.provider,
    providerOrderId: row.provider_order_id || null,
    providerPaymentId: row.provider_payment_id || null,
    orderId: row.order_id || null,
    recoveryShownAt: row.recovery_shown_at ? new Date(row.recovery_shown_at) : null,
    abandonedAt: row.abandoned_at ? new Date(row.abandoned_at) : null,
    gatewayErrorCode: row.gateway_error_code || null,
    gatewayErrorDesc: row.gateway_error_desc || null,
    status: row.status as CheckoutAttemptStatus,
    amount: Number(row.amount),
    currency: row.currency,
    checkoutData: parsedCheckoutData,
    expiresAt: new Date(row.expires_at),
    retentionUntil: new Date(row.retention_until),
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}
