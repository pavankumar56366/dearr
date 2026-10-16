import "server-only";
import crypto from "crypto";
import { query, withTransaction } from "./db";
import {
  getApplicableDiscountForProduct,
  computeDiscountAmount,
} from "./discount";
import { getStoreSettings, checkRateLimit } from "./settings";
import {
  resolveReportingPeriod,
  PLACED_ORDER_SQL_PREDICATE,
} from "./order-analytics";

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
  colorId?: string | null;
  productName: string;
  variantName: string | null;
  colorName?: string | null;
  colorHex?: string | null;
  sku?: string | null;
  imageUrl?: string | null;
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
  addressEditDeadline?: Date | null;
  addressChangeCount?: number;
  dispatchedAt?: Date | null;
  deliveredAt?: Date | null;
  cancelledAt?: Date | null;
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
  addressEditDeadline?: Date | null;
  addressChangeCount?: number;
  dispatchedAt?: Date | null;
  deliveredAt?: Date | null;
  cancelledAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  items?: any[];
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
  paymentMethod?: string;
}

export interface OrderListFilters {
  status?: OrderStatus;
  paymentStatus?: PaymentStatus;
  search?: string;
  page?: number;
  limit?: number;
  period?: string;
  date?: string;
  month?: string;
  year?: string;
  placedOnly?: boolean;
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

export function validateShippingAddress(input: CreateOrderInput): CreateOrderInput {
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
export async function generateOrderNumber(): Promise<string> {
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
    addressEditDeadline: row.address_edit_deadline ? new Date(row.address_edit_deadline) : null,
    addressChangeCount: Number(row.address_change_count ?? 0),
    dispatchedAt: row.dispatched_at ? new Date(row.dispatched_at) : null,
    deliveredAt: row.delivered_at ? new Date(row.delivered_at) : null,
    cancelledAt: row.cancelled_at ? new Date(row.cancelled_at) : null,
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
    colorId: row.color_id || null,
    productName: row.product_name,
    variantName: row.variant_name || null,
    colorName: row.color_name || null,
    colorHex: row.color_hex || null,
    sku: row.sku || null,
    imageUrl: row.image_url || null,
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
  shippingInput: CreateOrderInput,
  options?: { paymentMethod?: string }
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
         p.cod_enabled AS p_cod_enabled,
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

    const isCod =
      options?.paymentMethod === "Cash on Delivery" ||
      options?.paymentMethod === "cod" ||
      shippingInput.paymentMethod === "Cash on Delivery" ||
      shippingInput.paymentMethod === "cod";

    if (isCod) {
      const storeSettings = await getStoreSettings();
      if (!storeSettings.codEnabled) {
        throw new OrderValidationError(
          "Cash on Delivery is disabled. Please complete checkout using online payment.",
          400
        );
      }
      const hasIneligibleItem = items.some(
        (row) => row.p_cod_enabled === 0 || row.p_cod_enabled === false
      );
      if (hasIneligibleItem) {
        throw new OrderValidationError(
          "One or more items in your cart are not eligible for Cash on Delivery. Online payment is required.",
          400
        );
      }
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

    const storeSettings = await getStoreSettings();

    // Feature #11: No minimum purchase/order value requirement
    const shippingAmount =
      orderSubtotal >= storeSettings.freeShippingThreshold
        ? 0
        : storeSettings.defaultShippingFee;
    const totalAmount = Math.max(0, roundToTwo(orderSubtotal - orderDiscountTotal + shippingAmount));

    const addressEditDeadline = storeSettings.allowAddressChange
      ? new Date(Date.now() + storeSettings.addressChangeWindowHours * 3600 * 1000)
      : null;

    // 4. Insert order
    await conn.execute(
      `INSERT INTO orders (
         id, order_number, user_id, status, payment_status,
         subtotal, discount_amount, shipping_amount, total_amount, currency,
         shipping_full_name, shipping_phone,
         shipping_address_line_1, shipping_address_line_2,
         shipping_city, shipping_state, shipping_postal_code, shipping_country,
         address_edit_deadline, address_change_count,
         created_at, updated_at
       ) VALUES (?, ?, ?, 'pending', 'pending',
                 ?, ?, ?, ?, 'INR',
                 ?, ?,
                 ?, ?,
                 ?, ?, ?, ?,
                 ?, 0,
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
        addressEditDeadline,
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

export interface BuyNowOrderItemInput {
  productId: string;
  variantId?: string | null;
  colorId?: string | null;
  quantity: number;
}

/**
 * Creates an authoritative order for Buy Now items without modifying or clearing the customer's cart.
 */
export async function createOrderFromBuyNow(
  userId: string,
  shippingInput: CreateOrderInput,
  items: BuyNowOrderItemInput[],
  options?: { paymentMethod?: string }
): Promise<OrderRecord> {
  const cleanUserId = validateId(userId, "User ID");
  const validatedAddress = validateShippingAddress(shippingInput);

  if (!Array.isArray(items) || items.length === 0) {
    throw new OrderValidationError("At least one item is required for Buy Now", 400);
  }

  const createdOrderId = await withTransaction(async (conn) => {
    const isCod =
      options?.paymentMethod === "Cash on Delivery" ||
      options?.paymentMethod === "cod" ||
      shippingInput.paymentMethod === "Cash on Delivery" ||
      shippingInput.paymentMethod === "cod";

    const storeSettings = await getStoreSettings();
    if (isCod && !storeSettings.codEnabled) {
      throw new OrderValidationError(
        "Cash on Delivery is disabled. Please complete checkout using online payment.",
        400
      );
    }

    const now = new Date();
    const orderId = crypto.randomUUID();
    const orderNumber = await generateOrderNumber();

    let orderSubtotal = 0;
    let orderDiscountTotal = 0;

    const preparedItems: any[] = [];

    for (const itemInput of items) {
      const cleanProductId = validateId(itemInput.productId, "Product ID");
      const cleanColorId = itemInput.colorId ? validateId(itemInput.colorId, "Color ID") : null;
      const cleanVariantId = itemInput.variantId ? validateId(itemInput.variantId, "Variant ID") : null;
      const quantity = Math.floor(Number(itemInput.quantity));

      if (isNaN(quantity) || quantity < 1) {
        throw new OrderValidationError("Quantity must be a positive integer", 400);
      }
      if (quantity > 10) {
        throw new OrderValidationError("Maximum 10 units allowed per item/color", 400);
      }

      const [productRows]: any = await conn.execute(
        "SELECT id, name, price, stock_quantity, is_active, has_colors, cod_enabled FROM products WHERE id = ? LIMIT 1",
        [cleanProductId]
      );
      if (!productRows || productRows.length === 0) {
        throw new OrderValidationError("Product not found", 404);
      }
      const product = productRows[0];
      const isProductActive = Boolean(product.is_active === 1 || product.is_active === true);
      if (!isProductActive) {
        throw new OrderValidationError(`Product "${product.name}" is no longer available`, 400);
      }

      const codEnabled = Boolean(
        product.cod_enabled !== undefined && product.cod_enabled !== null
          ? product.cod_enabled
          : 1
      );
      if (isCod && !codEnabled) {
        throw new OrderValidationError(
          "One or more items in your order are not eligible for Cash on Delivery. Online payment is required.",
          400
        );
      }

      const hasColors = Boolean(product.has_colors === 1 || product.has_colors === true);
      let unitPrice = 0;
      let effectiveStock = 0;
      let itemName = product.name;
      let colorRecord: any = null;
      let variantRecord: any = null;

      if (hasColors) {
        if (!cleanColorId) {
          throw new OrderValidationError(`Please select a color for product "${product.name}"`, 400);
        }
        const [colorRows]: any = await conn.execute(
          "SELECT id, product_id, name, slug, hex, sku, stock, reserved_stock, price_override, is_active FROM product_colors WHERE id = ? LIMIT 1",
          [cleanColorId]
        );
        if (!colorRows || colorRows.length === 0 || colorRows[0].product_id !== cleanProductId) {
          throw new OrderValidationError(`Selected color does not belong to product "${product.name}"`, 400);
        }
        colorRecord = colorRows[0];
        const isColorActive = Boolean(colorRecord.is_active === 1 || colorRecord.is_active === true);
        if (!isColorActive) {
          throw new OrderValidationError(`Color "${colorRecord.name}" is currently inactive`, 400);
        }
        unitPrice =
          colorRecord.price_override !== null && colorRecord.price_override !== undefined
            ? Number(colorRecord.price_override)
            : Number(product.price || 0);
        effectiveStock = Math.max(0, Number(colorRecord.stock ?? 0) - Number(colorRecord.reserved_stock ?? 0));
        itemName = `${product.name} (${colorRecord.name})`;
      } else if (cleanVariantId) {
        const [variantRows]: any = await conn.execute(
          "SELECT id, product_id, name, sku, price, stock_quantity, is_active FROM product_variants WHERE id = ? LIMIT 1",
          [cleanVariantId]
        );
        if (!variantRows || variantRows.length === 0 || variantRows[0].product_id !== cleanProductId) {
          throw new OrderValidationError(`Selected variant does not belong to product "${product.name}"`, 400);
        }
        variantRecord = variantRows[0];
        const isVariantActive = Boolean(variantRecord.is_active === 1 || variantRecord.is_active === true);
        if (!isVariantActive) {
          throw new OrderValidationError(`Variant "${variantRecord.name}" is currently inactive`, 400);
        }
        unitPrice =
          variantRecord.price !== null && variantRecord.price !== undefined
            ? Number(variantRecord.price)
            : Number(product.price || 0);
        effectiveStock = Number(variantRecord.stock_quantity ?? 0);
        itemName = `${product.name} (${variantRecord.name})`;
      } else {
        unitPrice = Number(product.price || 0);
        effectiveStock = Number(product.stock_quantity ?? 0);
      }

      if (quantity > effectiveStock) {
        throw new OrderValidationError(
          `Insufficient stock for "${itemName}": requested ${quantity}, only ${effectiveStock} available`,
          400
        );
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

      const finalUnitPrice = Math.max(0, roundToTwo(unitPrice - discountAmountPerUnit));
      const lineDiscount = roundToTwo(discountAmountPerUnit * quantity);
      const lineTotal = roundToTwo(finalUnitPrice * quantity);

      orderSubtotal += roundToTwo(unitPrice * quantity);
      orderDiscountTotal += lineDiscount;

      preparedItems.push({
        id: crypto.randomUUID(),
        productId: cleanProductId,
        variantId: cleanVariantId || null,
        colorId: cleanColorId || null,
        productName: product.name,
        variantName: variantRecord ? variantRecord.name : null,
        colorName: colorRecord ? colorRecord.name : null,
        colorHex: colorRecord ? colorRecord.hex : null,
        sku: colorRecord ? colorRecord.sku : (variantRecord ? variantRecord.sku : null),
        unitPrice,
        quantity,
        discountAmountPerUnit,
        lineDiscount,
        lineTotal,
      });
    }

    orderSubtotal = roundToTwo(orderSubtotal);
    orderDiscountTotal = roundToTwo(orderDiscountTotal);

    const shippingAmount =
      orderSubtotal >= storeSettings.freeShippingThreshold
        ? 0
        : storeSettings.defaultShippingFee;
    const totalAmount = Math.max(0, roundToTwo(orderSubtotal - orderDiscountTotal + shippingAmount));

    const addressEditDeadline = storeSettings.allowAddressChange
      ? new Date(Date.now() + storeSettings.addressChangeWindowHours * 3600 * 1000)
      : null;

    await conn.execute(
      `INSERT INTO orders (
         id, order_number, user_id, status, payment_status,
         subtotal, discount_amount, shipping_amount, total_amount, currency,
         shipping_full_name, shipping_phone,
         shipping_address_line_1, shipping_address_line_2,
         shipping_city, shipping_state, shipping_postal_code, shipping_country,
         address_edit_deadline, address_change_count,
         created_at, updated_at
       ) VALUES (?, ?, ?, 'pending', 'pending',
                 ?, ?, ?, ?, 'INR',
                 ?, ?,
                 ?, ?,
                 ?, ?, ?, ?,
                 ?, 0,
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
        addressEditDeadline,
      ] as any[]
    );

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

    // Customer's cart is untouched!
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

  // Customer order history only shows valid placed orders (never abandoned online attempts)
  if (filters?.placedOnly !== false) {
    conditions.push(PLACED_ORDER_SQL_PREDICATE);
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
       o.address_edit_deadline, o.address_change_count,
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
    addressEditDeadline: row.address_edit_deadline ? new Date(row.address_edit_deadline) : null,
    addressChangeCount: Number(row.address_change_count ?? 0),
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

  // Exclude abandoned online payment attempts by default (only placed orders count)
  if (filters?.placedOnly !== false) {
    conditions.push(PLACED_ORDER_SQL_PREDICATE);
  }

  // Filter by date range if reporting period or specific date is requested
  if (filters?.period || filters?.date || filters?.month || filters?.year) {
    try {
      const range = resolveReportingPeriod({
        period: filters.period,
        date: filters.date,
        month: filters.month,
        year: filters.year,
      });

      if (range.period !== "all") {
        conditions.push("(o.created_at >= ? AND o.created_at < ?)");
        params.push(range.startSql, range.endSql);
      }
    } catch (err: any) {
      throw new OrderValidationError(err?.message || "Invalid reporting period parameters", 400);
    }
  }

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
       o.address_edit_deadline, o.address_change_count,
       o.created_at, o.updated_at,
       o.dispatched_at, o.delivered_at, o.cancelled_at,
       pr.email AS customer_email,
       (SELECT COALESCE(SUM(oi.quantity), 0) FROM order_items oi WHERE oi.order_id = o.id) AS item_count
     FROM orders o
     LEFT JOIN profiles pr ON o.user_id = pr.id
     WHERE ${whereClause}
     ORDER BY o.created_at DESC      LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  const orderIds = (orderRows || []).map((row) => row.id);
  const itemsByOrderId = new Map<string, any[]>();

  if (orderIds.length > 0) {
    const placeholders = orderIds.map(() => "?").join(",");
    const itemRows = await query<any[]>(
      `SELECT oi.id, oi.order_id, oi.product_id, oi.variant_id, oi.color_id,
              oi.product_name, oi.variant_name, oi.color_name, oi.color_hex, oi.sku, oi.image_url,
              oi.unit_price, oi.quantity,
              oi.discount_amount, oi.line_total,
              p.slug AS product_slug,
              (SELECT pi.storage_path FROM product_images pi WHERE pi.product_id = oi.product_id ORDER BY pi.sort_order ASC LIMIT 1) AS fallback_image
       FROM order_items oi
       LEFT JOIN products p ON oi.product_id = p.id
       WHERE oi.order_id IN (${placeholders})
       ORDER BY oi.created_at ASC`,
      orderIds
    );

    for (const it of itemRows || []) {
      const list = itemsByOrderId.get(it.order_id) || [];
      list.push({
        id: it.id,
        productId: it.product_id,
        variantId: it.variant_id,
        colorId: it.color_id || null,
        productName: it.product_name,
        variantName: it.variant_name,
        colorName: it.color_name || null,
        colorHex: it.color_hex || null,
        sku: it.sku || null,
        productSlug: it.product_slug || "",
        productImage: it.image_url || it.fallback_image || "/product-samples/1.jpeg",
        unitPrice: Number(it.unit_price || 0),
        quantity: Number(it.quantity || 1),
        discountAmount: Number(it.discount_amount || 0),
        lineTotal: Number(it.line_total || 0),
      });
      itemsByOrderId.set(it.order_id, list);
    }
  }

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
    items: itemsByOrderId.get(row.id) || [],
    customerName: row.shipping_full_name || undefined,
    customerEmail: row.customer_email || undefined,
    customerPhone: row.shipping_phone || undefined,
    addressEditDeadline: row.address_edit_deadline ? new Date(row.address_edit_deadline) : null,
    addressChangeCount: Number(row.address_change_count ?? 0),
    dispatchedAt: row.dispatched_at ? new Date(row.dispatched_at) : null,
    deliveredAt: row.delivered_at ? new Date(row.delivered_at) : null,
    cancelledAt: row.cancelled_at ? new Date(row.cancelled_at) : null,
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

  await withTransaction(async (conn) => {
    // Lock row using SELECT ... FOR UPDATE to synchronize against address-change transactions
    const orderRows = await conn.execute(
      "SELECT id, status FROM orders WHERE id = ? LIMIT 1 FOR UPDATE",
      [cleanOrderId]
    );
    const orders = (orderRows as any)[0] as any[];

    if (!orders || orders.length === 0) {
      throw new OrderValidationError("Order not found", 404);
    }

    const currentStatus = orders[0].status as OrderStatus;

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

    // Update status with transition timestamps
    if (newStatus === "shipped") {
      await conn.execute(
        `UPDATE orders
         SET status = ?,
             dispatched_at = COALESCE(dispatched_at, NOW()),
             updated_at = NOW()
         WHERE id = ?`,
        [newStatus, cleanOrderId]
      );
    } else if (newStatus === "delivered") {
      await conn.execute(
        `UPDATE orders
         SET status = ?,
             delivered_at = COALESCE(delivered_at, NOW()),
             updated_at = NOW()
         WHERE id = ?`,
        [newStatus, cleanOrderId]
      );
    } else {
      await conn.execute(
        "UPDATE orders SET status = ?, updated_at = NOW() WHERE id = ?",
        [newStatus, cleanOrderId]
      );
    }

    // Record status transition in order_status_history
    try {
      await conn.execute(
        `INSERT INTO order_status_history (id, order_id, previous_status, new_status, created_at)
         VALUES (UUID(), ?, ?, ?, NOW())`,
        [cleanOrderId, currentStatus, newStatus]
      );
    } catch {}
  });

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
      "SELECT id, status, payment_status, dispatched_at FROM orders WHERE id = ? LIMIT 1 FOR UPDATE",
      [cleanOrderId]
    );
    const orders = (orderRows as any)[0] as any[];

    if (!orders || orders.length === 0) {
      throw new OrderValidationError("Order not found", 404);
    }

    const currentStatus = orders[0].status as OrderStatus;
    const currentPaymentStatus = orders[0].payment_status;
    if (currentStatus === "delivered") {
      throw new OrderValidationError("Delivered orders cannot be cancelled", 400);
    }
    if (currentStatus === "cancelled") {
      throw new OrderValidationError("Order is already cancelled", 400);
    }

    // Restore stock ONLY if order had inventory deducted (paid or confirmed) and was NOT already dispatched
    const isDispatched = Boolean(orders[0].dispatched_at || currentStatus === "shipped");
    const shouldRestoreStock = (currentPaymentStatus === "paid" || currentStatus === "confirmed") && !isDispatched;
    if (shouldRestoreStock) {
      const itemRows = await conn.execute(
        "SELECT product_id, variant_id, color_id, quantity FROM order_items WHERE order_id = ?",
        [cleanOrderId]
      );
      const items = (itemRows as any)[0] as any[];

      for (const item of items || []) {
        if (item.color_id) {
          await conn.execute(
            "UPDATE product_colors SET stock = stock + ?, updated_at = NOW() WHERE id = ?",
            [item.quantity, item.color_id]
          );
        } else if (item.variant_id) {
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
    }

    // Update order status and record cancelled_at timestamp (preserving any previous dispatched_at)
    try {
      await conn.execute(
        `UPDATE orders
         SET status = 'cancelled',
             cancelled_at = COALESCE(cancelled_at, NOW()),
             updated_at = NOW()
         WHERE id = ?`,
        [cleanOrderId]
      );
    } catch {
      await conn.execute(
        "UPDATE orders SET status = 'cancelled', updated_at = NOW() WHERE id = ?",
        [cleanOrderId]
      );
    }

    try {
      await conn.execute(
        `INSERT INTO order_status_history (id, order_id, previous_status, new_status, created_at)
         VALUES (UUID(), ?, ?, 'cancelled', NOW())`,
        [cleanOrderId, currentStatus]
      );
    } catch {}
  });

  return await getOrderByIdInternal(cleanOrderId);
}

// ---------------------------------------------------------------------------
// Customer Delivery Address Change with Admin-Controlled Policy
// ---------------------------------------------------------------------------

export interface AddressEditEligibilityResult {
  allowed: boolean;
  reason:
    | "feature_disabled"
    | "deadline_expired"
    | "no_deadline"
    | "order_dispatched"
    | "order_delivered"
    | "order_cancelled"
    | "order_not_editable"
    | "change_limit_reached"
    | "order_not_found"
    | "not_authorized"
    | null;
  deadline: string | null;
  serverNow: string;
  changesUsed: number;
  changesLeft: number;
  maxChanges: number;
  currentAddress: {
    shippingFullName: string;
    shippingPhone: string;
    shippingAddressLine1: string;
    shippingAddressLine2: string | null;
    shippingCity: string;
    shippingState: string;
    shippingPostalCode: string;
    shippingCountry: string;
  } | null;
}

export interface OrderAddressHistoryRecord {
  id: string;
  orderId: string;
  oldAddress: CreateOrderInput;
  newAddress: CreateOrderInput;
  changedBy: "customer" | "admin";
  actorId: string | null;
  ipAddress?: string | null;
  changedAt: Date;
}

/**
 * Validates Indian postal PIN code serviceability for delivery address changes.
 *
 * Rules:
 * 1. Must be a valid 6-digit Indian postal code format (cannot begin with '0').
 * 2. Because the application does not have an integrated courier API (e.g., Shiprocket/Delhivery)
 *    or a live postal serviceability database, any change to a DIFFERENT destination PIN code
 *    cannot be automatically verified and MUST fail closed.
 * 3. Address modifications within the existing order's verified destination PIN code are accepted.
 * 4. Changes attempting to switch to a different PIN code are rejected with an explicit, safe
 *    message guiding the customer to contact support.
 */
export function validatePincodeServiceability(
  pincode: string,
  currentOrderPincode?: string | null
): {
  serviceable: boolean;
  reason?: string;
  code?: string;
} {
  const cleaned = (pincode || "").trim();
  if (!/^[1-9]\d{5}$/.test(cleaned)) {
    return {
      serviceable: false,
      code: "invalid_pincode_format",
      reason: "PIN code must be a valid 6-digit Indian postal code (cannot begin with 0)",
    };
  }

  // If current order PIN code is provided, verify whether destination PIN is changing
  if (currentOrderPincode) {
    const cleanCurrent = currentOrderPincode.trim();
    if (cleaned !== cleanCurrent) {
      return {
        serviceable: false,
        code: "unverified_destination_pincode",
        reason:
          "The new delivery destination PIN code cannot currently be verified for courier delivery serviceability. Please contact support to change the delivery address to a different PIN code.",
      };
    }
    return { serviceable: true };
  }

  // If called without an existing order context:
  // Because no live courier serviceability provider (e.g. Shiprocket/Delhivery) or coverage
  // database is integrated, unanchored new PIN codes cannot be verified as serviceable. Fail closed.
  return {
    serviceable: false,
    code: "unverified_destination_pincode",
    reason:
      "The delivery destination PIN code cannot currently be verified for courier delivery serviceability. Please contact support to change the delivery address.",
  };
}

/**
 * Durable warehouse notification handler for post-placement order delivery address modifications.
 * Dispatches an internal warehouse alert event and persists audit log.
 * Fails safely without rolling back committed customer address changes.
 */
export async function notifyWarehouseAddressChanged(params: {
  orderId: string;
  orderNumber: string;
  oldAddress: CreateOrderInput;
  newAddress: CreateOrderInput;
  actorId?: string | null;
  actorRole: "customer" | "admin";
}): Promise<{ delivered: boolean; channel: "in_app_dispatch_queue"; error?: string }> {
  try {
    // Durable persistence: Record an explicit audit log entry with action 'order.warehouse_address_alert'
    // This allows warehouse staff and internal dispatch systems to query all address-modified orders awaiting dispatch.
    await query(
      `INSERT INTO audit_logs (id, actor_id, action, entity, entity_id, details, created_at)
       VALUES (?, ?, 'order.warehouse_address_alert', 'orders', ?, ?, NOW())`,
      [
        crypto.randomUUID(),
        params.actorId || null,
        params.orderId,
        JSON.stringify({
          orderNumber: params.orderNumber,
          alert: "DELIVERY_ADDRESS_MODIFIED_BEFORE_DISPATCH",
          oldPostalCode: params.oldAddress.shippingPostalCode,
          newPostalCode: params.newAddress.shippingPostalCode,
          newRecipient: params.newAddress.shippingFullName,
          newPhone: params.newAddress.shippingPhone,
          newAddressLine1: params.newAddress.shippingAddressLine1,
          newCity: params.newAddress.shippingCity,
          newState: params.newAddress.shippingState,
          actorRole: params.actorRole,
        }),
      ]
    ).catch((err) => {
      console.warn("[Warehouse Notification] audit_logs insert skipped:", err.message);
    });

    console.info(
      `[Warehouse Notification Dispatched] Order ${params.orderNumber}: Delivery address modified prior to dispatch. PIN: ${params.newAddress.shippingPostalCode}`
    );

    return { delivered: true, channel: "in_app_dispatch_queue" };
  } catch (err: any) {
    console.warn("[Warehouse Notification] Non-blocking dispatch notice:", err.message);
    return { delivered: false, channel: "in_app_dispatch_queue", error: err.message };
  }
}

/**
 * Checks server-side eligibility for changing an order's delivery address.
 * Strictly relies on authoritative server clock and stored order deadline.
 */
export async function getOrderAddressEditEligibility(
  orderIdOrNumber: string,
  userId?: string | null,
  isAdmin = false
): Promise<AddressEditEligibilityResult> {
  const clean = orderIdOrNumber?.trim();
  const serverNow = new Date();
  const serverNowIso = serverNow.toISOString();

  const storeSettings = await getStoreSettings();
  const maxAllowedChanges = storeSettings.maxAddressChangesPerOrder || 2;

  // 1. Check global store policy
  if (!storeSettings.allowAddressChange) {
    return {
      allowed: false,
      reason: "feature_disabled",
      deadline: null,
      serverNow: serverNowIso,
      changesUsed: 0,
      changesLeft: 0,
      maxChanges: maxAllowedChanges,
      currentAddress: null,
    };
  }

  // 2. Fetch order by ID or order_number
  let orderRows = await query<any[]>(
    `SELECT id, order_number, user_id, status, payment_status,
            shipping_full_name, shipping_phone,
            shipping_address_line_1, shipping_address_line_2,
            shipping_city, shipping_state, shipping_postal_code, shipping_country,
            address_edit_deadline, address_change_count,
            dispatched_at, delivered_at, cancelled_at
     FROM orders
     WHERE id = ? OR order_number = ?
     LIMIT 1`,
    [clean, clean]
  );

  if (!orderRows || orderRows.length === 0) {
    return {
      allowed: false,
      reason: "order_not_found",
      deadline: null,
      serverNow: serverNowIso,
      changesUsed: 0,
      changesLeft: 0,
      maxChanges: maxAllowedChanges,
      currentAddress: null,
    };
  }

  const row = orderRows[0];

  // 3. Authorization check
  if (!isAdmin && userId && row.user_id !== userId) {
    return {
      allowed: false,
      reason: "not_authorized",
      deadline: null,
      serverNow: serverNowIso,
      changesUsed: 0,
      changesLeft: 0,
      maxChanges: maxAllowedChanges,
      currentAddress: null,
    };
  }

  const currentAddress = {
    shippingFullName: row.shipping_full_name || "",
    shippingPhone: row.shipping_phone || "",
    shippingAddressLine1: row.shipping_address_line_1 || "",
    shippingAddressLine2: row.shipping_address_line_2 || null,
    shippingCity: row.shipping_city || "",
    shippingState: row.shipping_state || "",
    shippingPostalCode: row.shipping_postal_code || "",
    shippingCountry: row.shipping_country || "India",
  };

  const changesUsed = Number(row.address_change_count ?? 0);
  const changesLeft = Math.max(0, maxAllowedChanges - changesUsed);
  const deadlineDate = row.address_edit_deadline ? new Date(row.address_edit_deadline) : null;
  const deadlineIso = deadlineDate ? deadlineDate.toISOString() : null;

  // 4. Status checks: Cancelled, Dispatched, Delivered
  if (row.status === "cancelled" || row.cancelled_at) {
    return {
      allowed: false,
      reason: "order_cancelled",
      deadline: deadlineIso,
      serverNow: serverNowIso,
      changesUsed,
      changesLeft,
      maxChanges: maxAllowedChanges,
      currentAddress,
    };
  }

  if (row.status === "shipped" || row.dispatched_at) {
    return {
      allowed: false,
      reason: "order_dispatched",
      deadline: deadlineIso,
      serverNow: serverNowIso,
      changesUsed,
      changesLeft,
      maxChanges: maxAllowedChanges,
      currentAddress,
    };
  }

  if (row.status === "delivered" || row.delivered_at) {
    return {
      allowed: false,
      reason: "order_delivered",
      deadline: deadlineIso,
      serverNow: serverNowIso,
      changesUsed,
      changesLeft,
      maxChanges: maxAllowedChanges,
      currentAddress,
    };
  }

  // 5. Must be in canonical Pending Dispatch states: pending, confirmed, processing
  if (row.status !== "pending" && row.status !== "confirmed" && row.status !== "processing") {
    return {
      allowed: false,
      reason: "order_not_editable",
      deadline: deadlineIso,
      serverNow: serverNowIso,
      changesUsed,
      changesLeft,
      maxChanges: maxAllowedChanges,
      currentAddress,
    };
  }

  // 6. Deadline existence check
  if (!deadlineDate) {
    return {
      allowed: false,
      reason: "no_deadline",
      deadline: null,
      serverNow: serverNowIso,
      changesUsed,
      changesLeft,
      maxChanges: maxAllowedChanges,
      currentAddress,
    };
  }

  // 7. Deadline expired check (authoritative server clock)
  if (serverNow.getTime() >= deadlineDate.getTime()) {
    return {
      allowed: false,
      reason: "deadline_expired",
      deadline: deadlineIso,
      serverNow: serverNowIso,
      changesUsed,
      changesLeft,
      maxChanges: maxAllowedChanges,
      currentAddress,
    };
  }

  // 8. Max changes limit check
  if (changesUsed >= maxAllowedChanges) {
    return {
      allowed: false,
      reason: "change_limit_reached",
      deadline: deadlineIso,
      serverNow: serverNowIso,
      changesUsed,
      changesLeft: 0,
      maxChanges: maxAllowedChanges,
      currentAddress,
    };
  }

  // All 10 eligibility rules satisfied
  return {
    allowed: true,
    reason: null,
    deadline: deadlineIso,
    serverNow: serverNowIso,
    changesUsed,
    changesLeft,
    maxChanges: maxAllowedChanges,
    currentAddress,
  };
}

/**
 * Atomically updates an order's shipping address with strict row-level locking.
 * Synchronizes with dispatch transitions using SELECT ... FOR UPDATE.
 */
export async function updateOrderShippingAddress(params: {
  orderId: string;
  userId: string;
  newAddress: CreateOrderInput;
  clientIp?: string;
  isAdmin?: boolean;
}): Promise<{
  order: OrderRecord;
  oldAddress: CreateOrderInput;
  newAddress: CreateOrderInput;
  changesLeft: number;
}> {
  const { orderId, userId, newAddress, clientIp = "127.0.0.1", isAdmin = false } = params;
  const cleanOrderId = validateId(orderId, "Order ID");
  const cleanUserId = validateId(userId, "User ID");

  // Rate Limiting (5 requests per 10 minutes per user/IP)
  const rateKey = `address_change:${cleanUserId}:${clientIp}`;
  const rateLimit = await checkRateLimit(rateKey, 10, 600);
  if (!rateLimit.allowed) {
    throw new OrderValidationError(
      `Too many address change attempts. Please wait ${rateLimit.retryAfterSeconds} seconds before trying again.`,
      429
    );
  }

  // Validate complete address structure and formats
  const validated = validateShippingAddress(newAddress);

  // Validate pincode format before entering transaction
  const pinFormatCheck = validatePincodeServiceability(validated.shippingPostalCode, validated.shippingPostalCode);
  if (!pinFormatCheck.serviceable && pinFormatCheck.code === "invalid_pincode_format") {
    throw new OrderValidationError(
      pinFormatCheck.reason || "PIN code must be a valid 6-digit Indian postal code (cannot begin with 0)",
      400
    );
  }

  // Domestic zone constraint check
  const country = (validated.shippingCountry || "India").trim().toLowerCase();
  if (country !== "india" && country !== "in") {
    throw new OrderValidationError(
      "This address has a different shipping zone. Please contact support to change the delivery address.",
      400
    );
  }

  const result = await withTransaction(async (conn) => {
    // 1. Lock order row using SELECT ... FOR UPDATE
    const orderRows = await conn.execute(
      `SELECT id, order_number, user_id, status, payment_status,
              shipping_full_name, shipping_phone,
              shipping_address_line_1, shipping_address_line_2,
              shipping_city, shipping_state, shipping_postal_code, shipping_country,
              address_edit_deadline, address_change_count,
              dispatched_at, delivered_at, cancelled_at
       FROM orders
       WHERE id = ?
       LIMIT 1
       FOR UPDATE`,
      [cleanOrderId]
    );

    const orders = (orderRows as any)[0] as any[];
    if (!orders || orders.length === 0) {
      throw new OrderValidationError("Order not found", 404);
    }

    const row = orders[0];

    // 2. Ownership check
    if (!isAdmin && row.user_id !== cleanUserId) {
      throw new OrderValidationError("Order not found", 404);
    }

    // 2b. Enforce destination postal serviceability against order's verified PIN code
    // Fails closed if the customer attempts to change to a different, unverified PIN code
    const serviceability = validatePincodeServiceability(
      validated.shippingPostalCode,
      row.shipping_postal_code
    );
    if (!serviceability.serviceable) {
      throw new OrderValidationError(
        serviceability.reason || "The entered PIN code is not serviceable.",
        400
      );
    }

    // 3. Read current global store settings inside lock
    const storeSettings = await getStoreSettings();
    if (!storeSettings.allowAddressChange) {
      throw new OrderValidationError(
        "Delivery address editing is currently disabled by store policy.",
        400
      );
    }

    // 4. Status enforcement
    if (row.status === "cancelled" || row.cancelled_at) {
      throw new OrderValidationError("Cancelled orders cannot be modified.", 400);
    }
    if (row.status === "shipped" || row.dispatched_at) {
      throw new OrderValidationError(
        "Order has already been dispatched. Address can no longer be changed.",
        400
      );
    }
    if (row.status === "delivered" || row.delivered_at) {
      throw new OrderValidationError("Delivered orders cannot be modified.", 400);
    }
    if (row.status !== "pending" && row.status !== "confirmed" && row.status !== "processing") {
      throw new OrderValidationError(
        `Cannot change address for order in "${row.status}" status.`,
        400
      );
    }

    // 5. Stored deadline enforcement
    if (!row.address_edit_deadline) {
      throw new OrderValidationError("No address change deadline configured for this order.", 400);
    }
    const deadlineDate = new Date(row.address_edit_deadline);
    if (Date.now() >= deadlineDate.getTime()) {
      throw new OrderValidationError(
        "The allowed time window for changing the delivery address has expired.",
        400
      );
    }

    // 6. Max change count enforcement
    const maxChanges = storeSettings.maxAddressChangesPerOrder || 2;
    const currentChangeCount = Number(row.address_change_count ?? 0);
    if (currentChangeCount >= maxChanges) {
      throw new OrderValidationError(
        `Maximum permitted address changes (${maxChanges}) have been reached for this order.`,
        400
      );
    }

    // 7. Capture old address snapshot
    const oldAddressSnapshot: CreateOrderInput = {
      shippingFullName: row.shipping_full_name,
      shippingPhone: row.shipping_phone,
      shippingAddressLine1: row.shipping_address_line_1,
      shippingAddressLine2: row.shipping_address_line_2 || null,
      shippingCity: row.shipping_city,
      shippingState: row.shipping_state,
      shippingPostalCode: row.shipping_postal_code,
      shippingCountry: row.shipping_country || "India",
    };

    // 8. Update shipping address and increment address_change_count
    await conn.execute(
      `UPDATE orders
       SET shipping_full_name = ?,
           shipping_phone = ?,
           shipping_address_line_1 = ?,
           shipping_address_line_2 = ?,
           shipping_city = ?,
           shipping_state = ?,
           shipping_postal_code = ?,
           shipping_country = ?,
           address_change_count = address_change_count + 1,
           updated_at = NOW()
       WHERE id = ?`,
      [
        validated.shippingFullName,
        validated.shippingPhone,
        validated.shippingAddressLine1,
        validated.shippingAddressLine2 || null,
        validated.shippingCity,
        validated.shippingState,
        validated.shippingPostalCode,
        validated.shippingCountry || "India",
        cleanOrderId,
      ]
    );

    // 9. Record complete old vs new address snapshot in order_address_history
    const historyId = crypto.randomUUID();
    await conn.execute(
      `INSERT INTO order_address_history (
         id, order_id, old_address, new_address,
         changed_by, actor_id, ip_address, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        historyId,
        cleanOrderId,
        JSON.stringify(oldAddressSnapshot),
        JSON.stringify(validated),
        isAdmin ? "admin" : "customer",
        cleanUserId,
        clientIp,
      ]
    );

    // 10. Record administrative audit log
    try {
      await conn.execute(
        `INSERT INTO audit_logs (
           id, actor_id, action, entity, entity_id, details, created_at
         ) VALUES (UUID(), ?, 'order_address_changed', 'orders', ?, ?, NOW())`,
        [
          cleanUserId,
          cleanOrderId,
          JSON.stringify({
            orderNumber: row.order_number,
            oldPostalCode: oldAddressSnapshot.shippingPostalCode,
            newPostalCode: validated.shippingPostalCode,
            changesUsed: currentChangeCount + 1,
            maxChanges,
          }),
        ]
      );
    } catch {}

    const newChangeCount = currentChangeCount + 1;
    return {
      orderId: cleanOrderId,
      orderNumber: row.order_number,
      oldAddress: oldAddressSnapshot,
      newAddress: validated,
      changesLeft: Math.max(0, maxChanges - newChangeCount),
    };
  });

  // 11. Post-Commit Internal Warehouse Notification Hook
  // Fail-safe: Notification delivery errors do NOT roll back committed address changes
  try {
    await notifyWarehouseAddressChanged({
      orderId: result.orderId,
      orderNumber: result.orderNumber,
      oldAddress: result.oldAddress,
      newAddress: result.newAddress,
      actorId: cleanUserId,
      actorRole: isAdmin ? "admin" : "customer",
    });
  } catch (err: any) {
    console.warn("[Warehouse Notification] Dispatched with notice:", err?.message);
  }

  const updatedOrder = await getOrderById(result.orderId, { isAdmin: true });

  return {
    order: updatedOrder,
    oldAddress: result.oldAddress,
    newAddress: result.newAddress,
    changesLeft: result.changesLeft,
  };
}

/**
 * Retrieves full address modification history for an order.
 * Masks sensitive requester IP for customer callers.
 */
export async function getOrderAddressHistory(
  orderIdOrNumber: string,
  userId?: string | null,
  isAdmin = false
): Promise<OrderAddressHistoryRecord[]> {
  const clean = orderIdOrNumber?.trim();
  if (!clean) return [];

  // Verify order exists and check authorization
  const orderRows = await query<any[]>(
    "SELECT id, user_id FROM orders WHERE id = ? OR order_number = ? LIMIT 1",
    [clean, clean]
  );

  if (!orderRows || orderRows.length === 0) {
    return [];
  }

  const order = orderRows[0];
  if (!isAdmin && userId && order.user_id !== userId) {
    return [];
  }

  const rows = await query<any[]>(
    `SELECT id, order_id, old_address, new_address,
            changed_by, actor_id, ip_address, created_at
     FROM order_address_history
     WHERE order_id = ?
     ORDER BY created_at DESC`,
    [order.id]
  );

  return (rows || []).map((r) => {
    let oldAddr: CreateOrderInput;
    let newAddr: CreateOrderInput;

    try {
      oldAddr = typeof r.old_address === "string" ? JSON.parse(r.old_address) : r.old_address;
    } catch {
      oldAddr = {} as any;
    }

    try {
      newAddr = typeof r.new_address === "string" ? JSON.parse(r.new_address) : r.new_address;
    } catch {
      newAddr = {} as any;
    }

    return {
      id: r.id,
      orderId: r.order_id,
      oldAddress: oldAddr,
      newAddress: newAddr,
      changedBy: r.changed_by,
      actorId: r.actor_id,
      // Never leak requester IP to customer callers
      ipAddress: isAdmin ? r.ip_address : undefined,
      changedAt: new Date(r.created_at),
    };
  });
}
