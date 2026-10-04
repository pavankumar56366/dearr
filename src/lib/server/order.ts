import "server-only";
import crypto from "crypto";
import { query, withTransaction } from "./db";
import {
  getApplicableDiscountForProduct,
  computeDiscountAmount,
} from "./discount";

// ---------------------------------------------------------------------------
// Error Handling
// ---------------------------------------------------------------------------

export class OrderValidationError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = "OrderValidationError";
    this.statusCode = statusCode;
  }
}

// ---------------------------------------------------------------------------
// Types & Interfaces
// ---------------------------------------------------------------------------

export type OrderStatus =
  | "pending"
  | "confirmed"
  | "processing"
  | "shipped"
  | "delivered"
  | "cancelled";

export type PaymentStatus = "pending" | "paid" | "failed" | "refunded";

export interface OrderItemSnapshot {
  id: string;
  orderId: string;
  productId: string | null;
  variantId: string | null;
  productName: string;
  variantName: string | null;
  unitPrice: number;
  quantity: number;
  discountAmount: number;
  lineTotal: number;
  createdAt: Date;
}

export interface OrderRecord {
  id: string;
  orderNumber: string;
  userId: string | null;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  subtotal: number;
  discountAmount: number;
  shippingAmount: number;
  totalAmount: number;
  currency: string;
  shippingFullName: string;
  shippingPhone: string;
  shippingAddressLine1: string;
  shippingAddressLine2: string | null;
  shippingCity: string;
  shippingState: string;
  shippingPostalCode: string;
  shippingCountry: string;
  items: OrderItemSnapshot[];
  createdAt: Date;
  updatedAt: Date;
}

export interface OrderSummary {
  id: string;
  orderNumber: string;
  userId: string | null;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  subtotal: number;
  discountAmount: number;
  shippingAmount: number;
  totalAmount: number;
  currency: string;
  itemCount: number;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateOrderInput {
  shippingFullName: string;
  shippingPhone: string;
  shippingAddressLine1: string;
  shippingAddressLine2?: string | null;
  shippingCity: string;
  shippingState: string;
  shippingPostalCode: string;
  shippingCountry?: string;
}

export interface OrderListFilters {
  status?: OrderStatus;
  paymentStatus?: PaymentStatus;
  search?: string;
  page?: number;
  limit?: number;
}

// ---------------------------------------------------------------------------
// Validation Helpers
// ---------------------------------------------------------------------------

const VALID_ORDER_STATUSES: OrderStatus[] = [
  "pending",
  "confirmed",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
];

const VALID_PAYMENT_STATUSES: PaymentStatus[] = [
  "pending",
  "paid",
  "failed",
  "refunded",
];

/** Valid order status transitions — each key lists the statuses it can move to */
const ALLOWED_STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["processing", "cancelled"],
  processing: ["shipped", "cancelled"],
  shipped: ["delivered"],
  delivered: [],
  cancelled: [],
};

function validateId(id: unknown, fieldName = "ID"): string {
  if (!id || typeof id !== "string") {
    throw new OrderValidationError(`${fieldName} is required and must be a string`, 400);
  }
  const clean = id.trim();
  if (clean.length === 0 || clean.length > 36) {
    throw new OrderValidationError(`${fieldName} must be between 1 and 36 characters`, 400);
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(clean)) {
    throw new OrderValidationError(`Invalid ${fieldName} format`, 400);
  }
  return clean;
}

function roundToTwo(num: number): number {
  return Math.round(num * 100) / 100;
}

function validateShippingAddress(input: CreateOrderInput): CreateOrderInput {
  const fullName = input.shippingFullName?.trim();
  if (!fullName || fullName.length < 2 || fullName.length > 150) {
    throw new OrderValidationError(
      "Shipping full name is required and must be between 2 and 150 characters",
      400
    );
  }

  const phone = input.shippingPhone?.trim();
  if (!phone || !/^[6-9]\d{9}$/.test(phone)) {
    throw new OrderValidationError(
      "A valid 10-digit Indian mobile number is required for shipping",
      400
    );
  }

  const addressLine1 = input.shippingAddressLine1?.trim();
  if (!addressLine1 || addressLine1.length < 5) {
    throw new OrderValidationError(
      "Shipping address line 1 is required (minimum 5 characters)",
      400
    );
  }

  const addressLine2 = input.shippingAddressLine2?.trim() || null;

  const city = input.shippingCity?.trim();
  if (!city || city.length < 2) {
    throw new OrderValidationError("Shipping city is required", 400);
  }

  const state = input.shippingState?.trim();
  if (!state || state.length < 2) {
    throw new OrderValidationError("Shipping state is required", 400);
  }

  const postalCode = input.shippingPostalCode?.trim();
  if (!postalCode || !/^\d{6}$/.test(postalCode)) {
    throw new OrderValidationError(
      "A valid 6-digit Indian PIN code is required for shipping",
      400
    );
  }

  const country = input.shippingCountry?.trim() || "India";

  return {
    shippingFullName: fullName,
    shippingPhone: phone,
    shippingAddressLine1: addressLine1,
    shippingAddressLine2: addressLine2,
    shippingCity: city,
    shippingState: state,
    shippingPostalCode: postalCode,
    shippingCountry: country,
  };
}

// ---------------------------------------------------------------------------
// Order Number Generation
// ---------------------------------------------------------------------------

/**
 * Generates a unique human-friendly order number in the format DEAR-XXXXX.
 * Checks the MySQL orders table for collisions.
 */
async function generateOrderNumber(): Promise<string> {
  let candidate = "";
  let attempts = 0;

  do {
    const randomSuffix = Math.floor(10000 + Math.random() * 90000);
    candidate = `DEAR-${randomSuffix}`;

    const existing = await query<any[]>(
      "SELECT id FROM orders WHERE order_number = ? LIMIT 1",
      [candidate]
    );

    if (!existing || existing.length === 0) {
      return candidate;
    }

    attempts++;
  } while (attempts < 100);

  // Fallback: use timestamp-based suffix for extreme collision scenarios
  const tsSuffix = Date.now().toString().slice(-6);
  return `DEAR-${tsSuffix}`;
}

// ---------------------------------------------------------------------------
// Row Mappers
// ---------------------------------------------------------------------------

function mapOrderRow(row: any): Omit<OrderRecord, "items"> {
  return {
    id: row.id,
    orderNumber: row.order_number,
    userId: row.user_id || null,
    status: row.status as OrderStatus,
    paymentStatus: row.payment_status as PaymentStatus,
    subtotal: Number(row.subtotal),
    discountAmount: Number(row.discount_amount),
    shippingAmount: Number(row.shipping_amount),
    totalAmount: Number(row.total_amount),
    currency: row.currency,
    shippingFullName: row.shipping_full_name,
    shippingPhone: row.shipping_phone,
    shippingAddressLine1: row.shipping_address_line_1,
    shippingAddressLine2: row.shipping_address_line_2 || null,
    shippingCity: row.shipping_city,
    shippingState: row.shipping_state,
    shippingPostalCode: row.shipping_postal_code,
    shippingCountry: row.shipping_country,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function mapOrderItemRow(row: any): OrderItemSnapshot {
  return {
    id: row.id,
    orderId: row.order_id,
    productId: row.product_id || null,
    variantId: row.variant_id || null,
    productName: row.product_name,
    variantName: row.variant_name || null,
    unitPrice: Number(row.unit_price),
    quantity: Number(row.quantity),
    discountAmount: Number(row.discount_amount),
    lineTotal: Number(row.line_total),
    createdAt: new Date(row.created_at),
  };
}

// ---------------------------------------------------------------------------
// Core Repository Functions
// ---------------------------------------------------------------------------

/**
 * Creates an order from the authenticated customer's active cart.
 *
 * Trusted Server-Side Flow:
 * 1. Load the customer's active cart with current product/variant/stock data
 * 2. Validate all items are active and have sufficient stock
 * 3. Re-compute all prices and discounts server-side (NEVER from browser)
 * 4. Insert order + order_items in a single transaction
 * 5. Deduct stock from products/variants
 * 6. Mark the cart as 'converted'
 * 7. Clear cart items
 *
 * Payment status starts as 'pending'. B-18 Razorpay integration will update it.
 */
export async function createOrderFromCart(
  userId: string,
  shippingInput: CreateOrderInput
): Promise<OrderRecord> {
  const cleanUserId = validateId(userId, "User ID");
  const validatedAddress = validateShippingAddress(shippingInput);

  const createdOrderId = await withTransaction(async (conn) => {
    // 1. Load the active cart
    const cartRows = await conn.execute(
      `SELECT id, user_id, status
       FROM carts
       WHERE user_id = ? AND status = 'active'
       ORDER BY created_at DESC
       LIMIT 1`,
      [cleanUserId]
    );
    const carts = (cartRows as any)[0] as any[];
    if (!carts || carts.length === 0) {
      throw new OrderValidationError("No active cart found. Please add items before checking out.", 400);
    }
    const cart = carts[0];

    // 2. Load cart items with current product/variant data
    const itemRows = await conn.execute(
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
    const items = (itemRows as any)[0] as any[];

    if (!items || items.length === 0) {
      throw new OrderValidationError("Your cart is empty. Please add items before checking out.", 400);
    }

    // 3. Validate stock and compute server-authoritative prices
    const now = new Date();
    const orderId = crypto.randomUUID();
    const orderNumber = await generateOrderNumber();

    let orderSubtotal = 0;
    let orderDiscountTotal = 0;

    interface PreparedItem {
      id: string;
      productId: string;
      variantId: string | null;
      productName: string;
      variantName: string | null;
      unitPrice: number;
      quantity: number;
      discountAmountPerUnit: number;
      lineDiscount: number;
      lineTotal: number;
      effectiveStock: number;
      isVariant: boolean;
    }
    const preparedItems: PreparedItem[] = [];

    for (const row of items) {
      const isProductActive = Boolean(row.p_is_active === 1 || row.p_is_active === true);
      if (!isProductActive) {
        throw new OrderValidationError(
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
          throw new OrderValidationError(
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
        throw new OrderValidationError(
          `Insufficient stock for "${itemName}": requested ${quantity}, only ${effectiveStock} available`,
          400
        );
      }

      // Resolve B-14 applicable discount for this product
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

      const finalUnitPrice = Math.max(0, roundToTwo(unitPrice - discountAmountPerUnit));
      const lineDiscount = roundToTwo(discountAmountPerUnit * quantity);
      const lineTotal = roundToTwo(finalUnitPrice * quantity);

      orderSubtotal += roundToTwo(unitPrice * quantity);
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
        effectiveStock,
        isVariant: hasVariant,
      });
    }

    orderSubtotal = roundToTwo(orderSubtotal);
    orderDiscountTotal = roundToTwo(orderDiscountTotal);

    // V1: Free shipping
    const shippingAmount = 0;
    const totalAmount = Math.max(0, roundToTwo(orderSubtotal - orderDiscountTotal + shippingAmount));

    // 4. Insert order
    await conn.execute(
      `INSERT INTO orders (
         id, order_number, user_id, status, payment_status,
         subtotal, discount_amount, shipping_amount, total_amount, currency,
         shipping_full_name, shipping_phone,
         shipping_address_line_1, shipping_address_line_2,
         shipping_city, shipping_state, shipping_postal_code, shipping_country,
         created_at, updated_at
       ) VALUES (?, ?, ?, 'pending', 'pending',
                 ?, ?, ?, ?, 'INR',
                 ?, ?,
                 ?, ?,
                 ?, ?, ?, ?,
                 NOW(), NOW())`,
      [
        orderId,
        orderNumber,
        cleanUserId,
        orderSubtotal,
        orderDiscountTotal,
        shippingAmount,
        totalAmount,
        validatedAddress.shippingFullName,
        validatedAddress.shippingPhone,
        validatedAddress.shippingAddressLine1,
        validatedAddress.shippingAddressLine2 ?? null,
        validatedAddress.shippingCity,
        validatedAddress.shippingState,
        validatedAddress.shippingPostalCode,
        validatedAddress.shippingCountry,
      ] as any[]
    );

    // 5. Insert order items (historical snapshots)
    for (const item of preparedItems) {
      await conn.execute(
        `INSERT INTO order_items (
           id, order_id, product_id, variant_id,
           product_name, variant_name, unit_price,
           quantity, discount_amount, line_total,
           created_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          item.id,
          orderId,
          item.productId,
          item.variantId ?? null,
          item.productName,
          item.variantName ?? null,
          item.unitPrice,
          item.quantity,
          item.lineDiscount,
          item.lineTotal,
        ] as any[]
      );
    }

    // 6. Stock: In B-17, stock is strictly validated above (sufficient quantity required),
    // but NOT decremented here. Stock decrement belongs to the payment verification flow (B-18 / Razorpay).
    // An unpaid pending order must not silently consume inventory.

    // 7. Mark cart as converted and clear items
    await conn.execute(
      "UPDATE carts SET status = 'converted', updated_at = NOW() WHERE id = ?",
      [cart.id]
    );
    await conn.execute("DELETE FROM cart_items WHERE cart_id = ?", [cart.id]);

    // 8. Return the created order ID to be fetched post-commit
    return orderId;
  });

  return await getOrderByIdInternal(createdOrderId);
}

// ---------------------------------------------------------------------------
// Read Operations
// ---------------------------------------------------------------------------

/**
 * Internal helper to fetch an order with its items (no ownership check).
 * Supports optional connection for transactional queries.
 */
async function getOrderByIdInternal(
  orderId: string,
  conn?: any
): Promise<OrderRecord> {
  const orderRows = conn
    ? ((await conn.execute(`SELECT * FROM orders WHERE id = ? LIMIT 1`, [orderId])) as any[])[0]
    : await query<any[]>(`SELECT * FROM orders WHERE id = ? LIMIT 1`, [orderId]);

  if (!orderRows || orderRows.length === 0) {
    throw new OrderValidationError("Order not found", 404);
  }

  const order = mapOrderRow(orderRows[0]);

  const itemRows = conn
    ? ((await conn.execute(`SELECT * FROM order_items WHERE order_id = ? ORDER BY created_at ASC`, [orderId])) as any[])[0]
    : await query<any[]>(`SELECT * FROM order_items WHERE order_id = ? ORDER BY created_at ASC`, [orderId]);

  const items = (itemRows || []).map(mapOrderItemRow);

  return { ...order, items };
}

/**
 * Fetches an order by ID or order_number.
 * For customer requests, enforces ownership (user_id must match).
 * For admin requests, skips ownership check.
 */
export async function getOrderById(
  idOrOrderNumber: string,
  options?: { userId?: string; isAdmin?: boolean }
): Promise<OrderRecord> {
  const clean = idOrOrderNumber.trim();
  if (!clean) {
    throw new OrderValidationError("Order ID or order number is required", 400);
  }

  // Try by ID first, then by order_number
  let orderRows = await query<any[]>(
    "SELECT * FROM orders WHERE id = ? LIMIT 1",
    [clean]
  );

  if (!orderRows || orderRows.length === 0) {
    orderRows = await query<any[]>(
      "SELECT * FROM orders WHERE order_number = ? LIMIT 1",
      [clean]
    );
  }

  if (!orderRows || orderRows.length === 0) {
    throw new OrderValidationError("Order not found", 404);
  }

  const orderRow = orderRows[0];

  // Enforce ownership for non-admin requests
  if (options?.userId && !options?.isAdmin) {
    if (orderRow.user_id !== options.userId) {
      throw new OrderValidationError("Order not found", 404);
    }
  }

  const order = mapOrderRow(orderRow);

  const itemRows = await query<any[]>(
    "SELECT * FROM order_items WHERE order_id = ? ORDER BY created_at ASC",
    [order.id]
  );

  const items = (itemRows || []).map(mapOrderItemRow);

  return { ...order, items };
}

/**
 * Lists orders for a specific customer, sorted by most recent first.
 */
export async function listCustomerOrders(
  userId: string,
  filters?: OrderListFilters
): Promise<{ orders: OrderSummary[]; total: number; page: number; limit: number }> {
  const cleanUserId = validateId(userId, "User ID");
  const page = Math.max(1, filters?.page || 1);
  const limit = Math.min(50, Math.max(1, filters?.limit || 20));
  const offset = (page - 1) * limit;

  const conditions: string[] = ["o.user_id = ?"];
  const params: any[] = [cleanUserId];

  if (filters?.status && VALID_ORDER_STATUSES.includes(filters.status)) {
    conditions.push("o.status = ?");
    params.push(filters.status);
  }

  if (filters?.paymentStatus && VALID_PAYMENT_STATUSES.includes(filters.paymentStatus)) {
    conditions.push("o.payment_status = ?");
    params.push(filters.paymentStatus);
  }

  const whereClause = conditions.join(" AND ");

  // Count total
  const countRows = await query<any[]>(
    `SELECT COUNT(*) AS total FROM orders o WHERE ${whereClause}`,
    params
  );
  const total = Number(countRows?.[0]?.total || 0);

  // Fetch summaries with item count
  const orderRows = await query<any[]>(
    `SELECT
       o.id, o.order_number, o.user_id, o.status, o.payment_status,
       o.subtotal, o.discount_amount, o.shipping_amount, o.total_amount, o.currency,
       o.shipping_full_name, o.shipping_phone,
       o.created_at, o.updated_at,
       (SELECT COALESCE(SUM(oi.quantity), 0) FROM order_items oi WHERE oi.order_id = o.id) AS item_count
     FROM orders o
     WHERE ${whereClause}
     ORDER BY o.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  const orders: OrderSummary[] = (orderRows || []).map((row) => ({
    id: row.id,
    orderNumber: row.order_number,
    userId: row.user_id || null,
    status: row.status as OrderStatus,
    paymentStatus: row.payment_status as PaymentStatus,
    subtotal: Number(row.subtotal),
    discountAmount: Number(row.discount_amount),
    shippingAmount: Number(row.shipping_amount),
    totalAmount: Number(row.total_amount),
    currency: row.currency,
    itemCount: Number(row.item_count || 0),
    customerName: row.shipping_full_name || undefined,
    customerPhone: row.shipping_phone || undefined,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  }));

  return { orders, total, page, limit };
}

/**
 * Lists all orders for admin dashboard, with optional filtering.
 */
export async function listAllOrders(
  filters?: OrderListFilters
): Promise<{ orders: OrderSummary[]; total: number; page: number; limit: number }> {
  const page = Math.max(1, filters?.page || 1);
  const limit = Math.min(100, Math.max(1, filters?.limit || 20));
  const offset = (page - 1) * limit;

  const conditions: string[] = ["1 = 1"];
  const params: any[] = [];

  if (filters?.status && VALID_ORDER_STATUSES.includes(filters.status)) {
    conditions.push("o.status = ?");
    params.push(filters.status);
  }

  if (filters?.paymentStatus && VALID_PAYMENT_STATUSES.includes(filters.paymentStatus)) {
    conditions.push("o.payment_status = ?");
    params.push(filters.paymentStatus);
  }

  if (filters?.search) {
    const search = `%${filters.search.trim()}%`;
    conditions.push("(o.order_number LIKE ? OR o.shipping_full_name LIKE ?)");
    params.push(search, search);
  }

  const whereClause = conditions.join(" AND ");

  const countRows = await query<any[]>(
    `SELECT COUNT(*) AS total FROM orders o WHERE ${whereClause}`,
    params
  );
  const total = Number(countRows?.[0]?.total || 0);

  const orderRows = await query<any[]>(
    `SELECT
       o.id, o.order_number, o.user_id, o.status, o.payment_status,
       o.subtotal, o.discount_amount, o.shipping_amount, o.total_amount, o.currency,
       o.shipping_full_name, o.shipping_phone,
       o.created_at, o.updated_at,
       pr.email AS customer_email,
       (SELECT COALESCE(SUM(oi.quantity), 0) FROM order_items oi WHERE oi.order_id = o.id) AS item_count
     FROM orders o
     LEFT JOIN profiles pr ON o.user_id = pr.id
     WHERE ${whereClause}
     ORDER BY o.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  const orders: OrderSummary[] = (orderRows || []).map((row) => ({
    id: row.id,
    orderNumber: row.order_number,
    userId: row.user_id || null,
    status: row.status as OrderStatus,
    paymentStatus: row.payment_status as PaymentStatus,
    subtotal: Number(row.subtotal),
    discountAmount: Number(row.discount_amount),
    shippingAmount: Number(row.shipping_amount),
    totalAmount: Number(row.total_amount),
    currency: row.currency,
    itemCount: Number(row.item_count || 0),
    customerName: row.shipping_full_name || undefined,
    customerEmail: row.customer_email || undefined,
    customerPhone: row.shipping_phone || undefined,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  }));

  return { orders, total, page, limit };
}

// ---------------------------------------------------------------------------
// Write Operations — Admin
// ---------------------------------------------------------------------------

/**
 * Updates the fulfillment status of an order.
 * Enforces valid status transitions per the state machine.
 *
 * Only admins may call this. The route handler must call requireAdmin() first.
 */
export async function updateOrderStatus(
  orderId: string,
  newStatus: OrderStatus
): Promise<OrderRecord> {
  const cleanOrderId = validateId(orderId, "Order ID");

  if (!VALID_ORDER_STATUSES.includes(newStatus)) {
    throw new OrderValidationError(
      `Invalid order status "${newStatus}". Valid values: ${VALID_ORDER_STATUSES.join(", ")}`,
      400
    );
  }

  // Fetch current order
  const orderRows = await query<any[]>(
    "SELECT id, status FROM orders WHERE id = ? LIMIT 1",
    [cleanOrderId]
  );

  if (!orderRows || orderRows.length === 0) {
    throw new OrderValidationError("Order not found", 404);
  }

  const currentStatus = orderRows[0].status as OrderStatus;

  // Validate transition
  const allowed = ALLOWED_STATUS_TRANSITIONS[currentStatus];
  if (!allowed || !allowed.includes(newStatus)) {
    throw new OrderValidationError(
      `Cannot transition order from "${currentStatus}" to "${newStatus}". Allowed transitions from "${currentStatus}": ${
        allowed && allowed.length > 0 ? allowed.join(", ") : "none"
      }`,
      400
    );
  }

  await query(
    "UPDATE orders SET status = ?, updated_at = NOW() WHERE id = ?",
    [newStatus, cleanOrderId]
  );

  return await getOrderByIdInternal(cleanOrderId);
}

/**
 * Updates the payment status of an order.
 *
 * NOTE: Reserved for controlled server-side payment verification (B-18 / payment webhook).
 * This function is NOT exposed through any B-17 public or admin HTTP route.
 * B-17 orders are created with payment_status = 'pending' and cannot be arbitrarily
 * modified from browser or HTTP input.
 */
export async function updatePaymentStatus(
  orderId: string,
  newPaymentStatus: PaymentStatus
): Promise<OrderRecord> {
  const cleanOrderId = validateId(orderId, "Order ID");

  if (!VALID_PAYMENT_STATUSES.includes(newPaymentStatus)) {
    throw new OrderValidationError(
      `Invalid payment status "${newPaymentStatus}". Valid values: ${VALID_PAYMENT_STATUSES.join(", ")}`,
      400
    );
  }

  const orderRows = await query<any[]>(
    "SELECT id FROM orders WHERE id = ? LIMIT 1",
    [cleanOrderId]
  );

  if (!orderRows || orderRows.length === 0) {
    throw new OrderValidationError("Order not found", 404);
  }

  await query(
    "UPDATE orders SET payment_status = ?, updated_at = NOW() WHERE id = ?",
    [newPaymentStatus, cleanOrderId]
  );

  return await getOrderByIdInternal(cleanOrderId);
}

/**
 * Admin-only: Cancel an order and restore stock.
 * Only works for orders that haven't been delivered.
 */
export async function cancelOrder(orderId: string): Promise<OrderRecord> {
  const cleanOrderId = validateId(orderId, "Order ID");

  await withTransaction(async (conn) => {
    const orderRows = await conn.execute(
      "SELECT id, status FROM orders WHERE id = ? LIMIT 1 FOR UPDATE",
      [cleanOrderId]
    );
    const orders = (orderRows as any)[0] as any[];

    if (!orders || orders.length === 0) {
      throw new OrderValidationError("Order not found", 404);
    }

    const currentStatus = orders[0].status as OrderStatus;
    if (currentStatus === "delivered") {
      throw new OrderValidationError("Delivered orders cannot be cancelled", 400);
    }
    if (currentStatus === "cancelled") {
      throw new OrderValidationError("Order is already cancelled", 400);
    }

    // Restore stock
    const itemRows = await conn.execute(
      "SELECT product_id, variant_id, quantity FROM order_items WHERE order_id = ?",
      [cleanOrderId]
    );
    const items = (itemRows as any)[0] as any[];

    for (const item of items || []) {
      if (item.variant_id) {
        await conn.execute(
          "UPDATE product_variants SET stock_quantity = stock_quantity + ?, updated_at = NOW() WHERE id = ?",
          [item.quantity, item.variant_id]
        );
      } else if (item.product_id) {
        await conn.execute(
          "UPDATE products SET stock_quantity = stock_quantity + ?, updated_at = NOW() WHERE id = ?",
          [item.quantity, item.product_id]
        );
      }
    }

    // Update order status
    await conn.execute(
      "UPDATE orders SET status = 'cancelled', updated_at = NOW() WHERE id = ?",
      [cleanOrderId]
    );
  });

  return await getOrderByIdInternal(cleanOrderId);
}
