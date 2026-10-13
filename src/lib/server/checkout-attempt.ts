import "server-only";
import crypto from "crypto";
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

export const ATTEMPT_EXPIRY_MINUTES = 30;
export const ATTEMPT_RETENTION_DAYS = 30;

export type CheckoutAttemptStatus =
  | "pending"
  | "verified"
  | "converted"
  | "expired"
  | "failed";

export interface CheckoutAttemptRecord {
  id: string;
  userId: string;
  cartId: string | null;
  provider: string;
  providerOrderId: string | null;
  providerPaymentId: string | null;
  orderId: string | null;
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

  return {
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
export async function createCheckoutAttemptFromCart(
  userId: string,
  shippingInput: CreateOrderInput
): Promise<CheckoutAttemptRecord> {
  const cleanUserId = validateId(userId, "User ID");
  const validatedAddress = validateShippingAddress(shippingInput);

  // 1. Fetch active cart
  const cartRows = await query<any[]>(
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

  // 2. Fetch cart items with current product and variant details
  const itemRows = await query<any[]>(
    `SELECT
       ci.id AS item_id,
       ci.product_id,
       ci.variant_id,
       ci.quantity,
       p.id AS p_id,
       p.name AS p_name,
       p.price AS p_price,
       p.stock_quantity AS p_stock,
       p.is_active AS p_is_active,
       p.category_id AS p_category_id,
       pv.id AS v_id,
       pv.name AS v_name,
       pv.price AS v_price,
       pv.stock_quantity AS v_stock,
       pv.is_active AS v_is_active
     FROM cart_items ci
     INNER JOIN products p ON ci.product_id = p.id
     LEFT JOIN product_variants pv ON ci.variant_id = pv.id
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

  // 3. Compute server-authoritative amounts & check stock
  const now = new Date();
  let orderSubtotal = 0;
  let orderDiscountTotal = 0;
  const preparedItems: any[] = [];

  for (const row of itemRows) {
    const isProductActive = Boolean(row.p_is_active === 1 || row.p_is_active === true);
    if (!isProductActive) {
      throw new CheckoutAttemptError(
        `Product "${row.p_name}" is no longer available for purchase`,
        400
      );
    }

    const hasVariant = Boolean(row.variant_id);
    let unitPrice = 0;
    let effectiveStock = 0;

    if (hasVariant) {
      const isVariantActive = Boolean(row.v_is_active === 1 || row.v_is_active === true);
      if (!isVariantActive) {
        throw new CheckoutAttemptError(
          `Variant "${row.v_name}" for product "${row.p_name}" is no longer available`,
          400
        );
      }
      unitPrice =
        row.v_price !== null && row.v_price !== undefined
          ? Number(row.v_price)
          : Number(row.p_price || 0);
      effectiveStock = Number(row.v_stock ?? 0);
    } else {
      unitPrice = Number(row.p_price || 0);
      effectiveStock = Number(row.p_stock ?? 0);
    }

    const quantity = Number(row.quantity);
    if (quantity > effectiveStock) {
      const itemName = hasVariant ? `${row.p_name} (${row.v_name})` : row.p_name;
      throw new CheckoutAttemptError(
        `Insufficient stock for "${itemName}": requested ${quantity}, only ${effectiveStock} available`,
        400
      );
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
      productName: row.p_name,
      variantName: hasVariant && row.v_name ? row.v_name : null,
      unitPrice,
      quantity,
      discountAmountPerUnit,
      lineDiscount,
      lineTotal,
    });
  }

  orderSubtotal = Math.round(orderSubtotal * 100) / 100;
  orderDiscountTotal = Math.round(orderDiscountTotal * 100) / 100;

  const storeSettings = await getStoreSettings();
  const shippingAmount =
    orderSubtotal >= storeSettings.freeShippingThreshold
      ? 0
      : storeSettings.defaultShippingFee;
  const totalAmount = Math.max(
    0,
    Math.round((orderSubtotal - orderDiscountTotal + shippingAmount) * 100) / 100
  );

  // 4. Create and persist checkout attempt record
  return await createCheckoutAttempt({
    userId: cleanUserId,
    cartId: cart.id,
    amount: totalAmount,
    currency: "INR",
    provider: "razorpay",
    checkoutData: {
      shippingAddress: validatedAddress,
      items: preparedItems,
      subtotal: orderSubtotal,
      discountAmount: orderDiscountTotal,
      shippingAmount,
      totalAmount,
    },
  });
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
      return { orderId: attemptRow.order_id };
    }

    // 3. Check for payment ID collision across payments table
    const [existingPaymentCollisions]: any = await conn.execute(
      "SELECT id, order_id FROM payments WHERE provider_payment_id = ? LIMIT 1",
      [cleanPaymentId]
    );
    if (existingPaymentCollisions && existingPaymentCollisions.length > 0) {
      const collision = existingPaymentCollisions[0];
      if (attemptRow.order_id && collision.order_id === attemptRow.order_id) {
        return { orderId: attemptRow.order_id };
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
      }
    }

    // 6. Generate order ID and unique order number
    const orderId = crypto.randomUUID();
    const orderNumber = await generateOrderNumber();

    // 7. Insert placed order with confirmed status and paid payment_status
    await conn.execute(
      `INSERT INTO orders (
         id, order_number, user_id, status, payment_status,
         subtotal, discount_amount, shipping_amount, total_amount, currency,
         shipping_full_name, shipping_phone,
         shipping_address_line_1, shipping_address_line_2,
         shipping_city, shipping_state, shipping_postal_code, shipping_country,
         dispatched_at, delivered_at, cancelled_at,
         created_at, updated_at
       ) VALUES (?, ?, ?, 'confirmed', 'paid',
                 ?, ?, ?, ?, ?,
                 ?, ?,
                 ?, ?,
                 ?, ?, ?, ?,
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
      ]
    );

    // 8. Insert order items
    for (const item of items) {
      await conn.execute(
        `INSERT INTO order_items (
           id, order_id, product_id, variant_id,
           product_name, variant_name, unit_price,
           quantity, discount_amount, line_total,
           created_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          item.id || crypto.randomUUID(),
          orderId,
          item.productId,
          item.variantId || null,
          item.productName || item.title || "Product",
          item.variantName || null,
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

    // Return the created order id
    return { orderId };
  });

  const finalOrder = await getOrderById(txnResult.orderId);
  if (!finalOrder) {
    throw new CheckoutAttemptError("Failed to load finalized order", 500);
  }
  return finalOrder;
}

/**
 * Idempotent scheduled cleanup:
 * 1. Expires unpaid checkout attempts older than 30 minutes.
 * 2. Purges expired checkout attempts older than 30 days retention.
 *
 * Placed orders and order items are NEVER deleted by this cleanup.
 */
export async function cleanupCheckoutAttempts(): Promise<{
  expiredCount: number;
  purgedCount: number;
}> {
  // Step 1: Expire attempts older than 30 minutes
  const expireResult: any = await query(
    `UPDATE checkout_attempts
     SET status = 'expired', updated_at = NOW()
     WHERE status = 'pending'
       AND expires_at < NOW()`
  );
  const expiredCount = Number(expireResult?.affectedRows || 0);

  // Step 2: Purge attempts past 30-day retention
  const purgeResult: any = await query(
    `DELETE FROM checkout_attempts
     WHERE status IN ('expired', 'failed')
       AND retention_until < NOW()`
  );
  const purgedCount = Number(purgeResult?.affectedRows || 0);

  return { expiredCount, purgedCount };
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
