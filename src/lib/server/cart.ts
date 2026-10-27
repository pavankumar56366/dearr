import "server-only";
import crypto from "crypto";
import { query, withTransaction } from "./db";
import { PoolConnection } from "mysql2/promise";
import {
  getApplicableDiscountForProduct,
  computeDiscountAmount,
} from "./discount";
import {
  resolveAuthoritativeUnitPrice,
  resolveAuthoritativeEffectiveStock,
} from "./variant-resolver";

// ---------------------------------------------------------------------------
// Error Handling
// ---------------------------------------------------------------------------

export class CartValidationError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = "CartValidationError";
    this.statusCode = statusCode;
  }
}

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

export interface CartProductSummary {
  id: string;
  name: string;
  slug: string;
  image: string;
  category: string | null;
  categorySlug: string | null;
  isActive: boolean;
  codEnabled?: boolean;
}

export interface CartVariantSummary {
  id: string;
  name: string;
  sku: string;
  isActive: boolean;
}

export interface CartColorSummary {
  id: string;
  name: string;
  slug: string;
  hex: string;
  sku: string | null;
  image: string;
  isActive: boolean;
}

export interface CartItemPricing {
  unitPrice: number;
  originalUnitPrice: number;
  discountAmountPerUnit: number;
  finalUnitPrice: number;
  lineSubtotal: number;
  lineDiscount: number;
  lineTotal: number;
}

export interface CartItemStock {
  available: boolean;
  stockQuantity: number;
  requestedQuantityAvailable: boolean;
}

export interface CartItemRecord {
  id: string;
  cartId: string;
  productId: string;
  variantId: string | null;
  colorId: string | null;
  quantity: number;
  product: CartProductSummary;
  variant: CartVariantSummary | null;
  color: CartColorSummary | null;
  pricing: CartItemPricing;
  stock: CartItemStock;
  createdAt: Date;
  updatedAt: Date;
}

export interface CartTotals {
  subtotal: number;
  discount: number;
  shipping: number;
  total: number;
}

export interface CartRecord {
  id: string;
  userId: string;
  status: string;
  items: CartItemRecord[];
  totals: CartTotals;
  itemCount: number;
  isCodEligible?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AddCartItemInput {
  productId: string;
  variantId?: string | null;
  colorId?: string | null;
  quantity: number;
}

// ---------------------------------------------------------------------------
// Validation Helpers
// ---------------------------------------------------------------------------

export function validateId(id: unknown, fieldName = "ID"): string {
  if (!id || typeof id !== "string") {
    throw new CartValidationError(`${fieldName} is required and must be a string`, 400);
  }
  const clean = id.trim();
  if (clean.length === 0 || clean.length > 36) {
    throw new CartValidationError(`${fieldName} must be between 1 and 36 characters`, 400);
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(clean)) {
    throw new CartValidationError(`Invalid ${fieldName} format`, 400);
  }
  return clean;
}

export function validateQuantity(quantity: unknown): number {
  if (quantity === undefined || quantity === null) {
    throw new CartValidationError("Quantity is required", 400);
  }
  if (typeof quantity !== "number" || !Number.isInteger(quantity)) {
    throw new CartValidationError("Quantity must be a valid integer", 400);
  }
  if (quantity <= 0) {
    throw new CartValidationError("Quantity must be greater than zero", 400);
  }
  return quantity;
}

function toPublicUrl(storagePath: string | null | undefined): string {
  if (!storagePath) return "/product-samples/1.jpeg";
  if (storagePath.startsWith("http://") || storagePath.startsWith("https://")) {
    return storagePath;
  }
  return storagePath.startsWith("/") ? storagePath : `/${storagePath}`;
}

function roundToTwo(num: number): number {
  return Math.round(num * 100) / 100;
}

// ---------------------------------------------------------------------------
// Core Repository Functions
// ---------------------------------------------------------------------------

/**
 * Retrieves the customer's active cart or atomically creates one if none exists.
 * Strictly scoped to the authenticated customer ID with status = 'active'.
 */
export async function getOrCreateActiveCartForUser(userId: string): Promise<{
  id: string;
  userId: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}> {
  const cleanUserId = validateId(userId, "User ID");

  // 1. Check for existing active cart
  const existingRows = await query<any[]>(
    `SELECT id, user_id, status, created_at, updated_at
     FROM carts
     WHERE user_id = ? AND status = 'active'
     ORDER BY created_at DESC
     LIMIT 1`,
    [cleanUserId]
  );

  if (existingRows && existingRows.length > 0) {
    const row = existingRows[0];
    return {
      id: row.id,
      userId: row.user_id,
      status: row.status,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  // 2. Insert new active cart
  const newId = crypto.randomUUID();
  try {
    await query(
      `INSERT INTO carts (id, user_id, status, created_at, updated_at)
       VALUES (?, ?, 'active', NOW(), NOW())`,
      [newId, cleanUserId]
    );
  } catch {
    // If a concurrent insert occurred, proceed to query existing
  }

  // 3. Query the persisted active cart
  const rows = await query<any[]>(
    `SELECT id, user_id, status, created_at, updated_at
     FROM carts
     WHERE user_id = ? AND status = 'active'
     ORDER BY created_at DESC
     LIMIT 1`,
    [cleanUserId]
  );

  if (!rows || rows.length === 0) {
    throw new Error("Failed to initialize customer cart");
  }

  const row = rows[0];
  return {
    id: row.id,
    userId: row.user_id,
    status: row.status,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

/**
 * Retrieves the full authoritative cart for an authenticated user.
 * Joins products, variants, primary images, categories, resolves applicable discounts
 * via the B-14 engine (product > category > store precedence, no stacking), and computes
 * trusted decimal-safe server totals.
 */
export async function getCartForUser(userId: string): Promise<CartRecord> {
  const cart = await getOrCreateActiveCartForUser(userId);

  // Load cart items belonging exclusively to this active cart
  const itemRows = await query<any[]>(
    `SELECT
       ci.id AS item_id,
       ci.cart_id,
       ci.product_id,
       ci.variant_id,
       ci.color_id,
       ci.quantity,
       ci.created_at AS item_created_at,
       ci.updated_at AS item_updated_at,
       p.id AS p_id,
       p.name AS p_name,
       p.slug AS p_slug,
       p.price AS p_price,
       p.compare_at_price AS p_compare_at_price,
       p.stock_quantity AS p_stock_quantity,
       p.is_active AS p_is_active,
       p.has_colors AS p_has_colors,
       p.cod_enabled AS p_cod_enabled,
       cat.name AS category_name,
       cat.slug AS category_slug,
       pv.id AS v_id,
       pv.name AS v_name,
       pv.sku AS v_sku,
       pv.price AS v_price,
       pv.stock_quantity AS v_stock_quantity,
       pv.is_active AS v_is_active,
       pc.id AS c_id,
       pc.name AS c_name,
       pc.slug AS c_slug,
       pc.hex AS c_hex,
       pc.sku AS c_sku,
       pc.stock AS c_stock,
       pc.reserved_stock AS c_reserved_stock,
       pc.price_override AS c_price_override,
       pc.is_active AS c_is_active,
       (
         SELECT COALESCE(SUM(sr.quantity), 0)
         FROM stock_reservations sr
         WHERE sr.variant_id = pv.id AND sr.status = 'active' AND sr.expires_at > NOW()
       ) AS v_reserved_stock,
       (
         SELECT pi.storage_path
         FROM product_images pi
         WHERE pi.product_id = p.id AND (pi.color_id = ci.color_id OR (ci.color_id IS NULL AND pi.color_id IS NULL))
         ORDER BY pi.sort_order ASC, pi.created_at ASC
         LIMIT 1
       ) AS color_image,
       (
         SELECT pi.storage_path
         FROM product_images pi
         WHERE pi.product_id = p.id
         ORDER BY pi.sort_order ASC, pi.created_at ASC
         LIMIT 1
       ) AS fallback_image
     FROM cart_items ci
     INNER JOIN carts crt ON ci.cart_id = crt.id
     LEFT JOIN products p ON ci.product_id = p.id
     LEFT JOIN categories cat ON p.category_id = cat.id
     LEFT JOIN product_variants pv ON ci.variant_id = pv.id
     LEFT JOIN product_colors pc ON ci.color_id = pc.id
     WHERE crt.id = ? AND crt.user_id = ? AND crt.status = 'active'
     ORDER BY ci.created_at DESC`,
    [cart.id, cart.userId]
  );

  const now = new Date();
  const items: CartItemRecord[] = await Promise.all(
    (itemRows || []).map(async (row) => {
      const isProductActive = Boolean(row.p_is_active === 1 || row.p_is_active === true);
      const hasColor = Boolean(row.color_id);
      const hasVariant = Boolean(row.variant_id);

      const isColorActive = hasColor
        ? Boolean(row.c_is_active === 1 || row.c_is_active === true)
        : true;
      const isVariantActive = hasVariant
        ? Boolean(row.v_is_active === 1 || row.v_is_active === true)
        : true;

      const unitPrice = resolveAuthoritativeUnitPrice({
        productPrice: row.p_price,
        colorPriceOverride: hasColor ? row.c_price_override : null,
        variantPrice: hasVariant ? row.v_price : null,
      });

      const availableStock = resolveAuthoritativeEffectiveStock({
        hasVariant,
        variantStock: row.v_stock_quantity,
        variantReservedStock: row.v_reserved_stock,
        hasColor: hasColor && !hasVariant,
        colorStock: row.c_stock,
        colorReservedStock: row.c_reserved_stock,
        productStock: row.p_stock_quantity,
      });

      const originalUnitPrice =
        row.p_compare_at_price !== null &&
        row.p_compare_at_price !== undefined &&
        Number(row.p_compare_at_price) > unitPrice
          ? Number(row.p_compare_at_price)
          : unitPrice;

      // Stock & Availability flags
      const isAvailable = isProductActive && isColorActive && isVariantActive && availableStock > 0;
      const requestedQuantityAvailable =
        isAvailable && row.quantity <= availableStock && row.quantity <= 10;

      // Resolve B-14 applicable discount for this product context
      let discountAmountPerUnit = 0;
      if (isProductActive && row.p_id) {
        try {
          const discountResult = await getApplicableDiscountForProduct(row.p_id, now);
          if (discountResult && discountResult.discount) {
            const calc = computeDiscountAmount(discountResult.discount, unitPrice);
            discountAmountPerUnit = calc.discountAmount;
          }
        } catch {
          discountAmountPerUnit = 0;
        }
      }

      const finalUnitPrice = Math.max(0, roundToTwo(unitPrice - discountAmountPerUnit));
      const lineSubtotal = roundToTwo(unitPrice * row.quantity);
      const lineDiscount = roundToTwo(discountAmountPerUnit * row.quantity);
      const lineTotal = roundToTwo(finalUnitPrice * row.quantity);

      const resolvedImage = toPublicUrl(row.color_image || row.fallback_image);

      return {
        id: row.item_id,
        cartId: row.cart_id,
        productId: row.product_id,
        variantId: row.variant_id ?? null,
        colorId: row.color_id ?? null,
        quantity: Number(row.quantity),
        product: {
          id: row.p_id || row.product_id,
          name: isProductActive
            ? row.p_name
            : row.p_name
            ? `${row.p_name} (Unavailable)`
            : "Unavailable Product",
          slug: row.p_slug || `product-${row.product_id}`,
          image: resolvedImage,
          category: isProductActive ? row.category_name || null : null,
          categorySlug: isProductActive ? row.category_slug || null : null,
          isActive: isProductActive,
          codEnabled: Boolean(
            row.p_cod_enabled !== undefined && row.p_cod_enabled !== null
              ? row.p_cod_enabled
              : 1
          ),
        },
        variant: hasVariant && row.v_id
          ? {
              id: row.v_id,
              name: row.v_name || "Variant",
              sku: row.v_sku || "",
              isActive: isVariantActive,
            }
          : null,
        color: hasColor && row.c_id
          ? {
              id: row.c_id,
              name: row.c_name || "Color",
              slug: row.c_slug || "",
              hex: row.c_hex || "#000000",
              sku: row.c_sku || null,
              image: resolvedImage,
              isActive: isColorActive,
            }
          : null,
        pricing: {
          unitPrice,
          originalUnitPrice,
          discountAmountPerUnit,
          finalUnitPrice,
          lineSubtotal,
          lineDiscount,
          lineTotal,
        },
        stock: {
          available: isAvailable,
          stockQuantity: availableStock,
          requestedQuantityAvailable,
        },
        createdAt: new Date(row.item_created_at),
        updatedAt: new Date(row.item_updated_at),
      };
    })
  );

  // Calculate authoritative server-side totals
  const subtotal = roundToTwo(items.reduce((sum, it) => sum + it.pricing.lineSubtotal, 0));
  const discount = roundToTwo(items.reduce((sum, it) => sum + it.pricing.lineDiscount, 0));
  const shipping = 0; // V1 default free shipping / calculated at checkout
  const total = Math.max(0, roundToTwo(subtotal - discount + shipping));
  const itemCount = items.reduce((count, it) => count + it.quantity, 0);

  return {
    id: cart.id,
    userId: cart.userId,
    status: cart.status,
    items,
    totals: {
      subtotal,
      discount,
      shipping,
      total,
    },
    itemCount,
    isCodEligible: items.length > 0 && items.every((it) => it.product.codEnabled !== false),
    createdAt: cart.createdAt,
    updatedAt: cart.updatedAt,
  };
}

/**
 * Validates and atomically inserts or increments a single cart line inside a database connection.
 */
async function addSingleCartItemInternal(
  conn: PoolConnection,
  cartId: string,
  input: AddCartItemInput
): Promise<void> {
  const cleanProductId = validateId(input.productId, "Product ID");
  const quantityToAdd = validateQuantity(input.quantity);
  if (quantityToAdd > 10) {
    throw new CartValidationError("Maximum 10 units allowed per item/color", 400);
  }
  const cleanColorId = input.colorId ? validateId(input.colorId, "Color ID") : null;
  const cleanVariantId = input.variantId ? validateId(input.variantId, "Variant ID") : null;

  // 1. Verify referenced product exists and is active
  const [productRows]: any = await conn.execute(
    "SELECT id, name, price, stock_quantity, is_active, has_colors FROM products WHERE id = ? LIMIT 1",
    [cleanProductId]
  );

  if (!productRows || productRows.length === 0) {
    throw new CartValidationError("Product not found", 404);
  }

  const product = productRows[0];
  const isProductActive = Boolean(product.is_active === 1 || product.is_active === true);
  if (!isProductActive) {
    throw new CartValidationError(
      `Product "${product.name}" is currently inactive and cannot be added to the cart`,
      400
    );
  }

  const productHasColors = Boolean(product.has_colors === 1 || product.has_colors === true);
  let effectiveStock = 0;
  let resolvedColorId = cleanColorId;

  // 2. Validate Variant if provided
  let variantRecord: any = null;
  if (cleanVariantId) {
    const [variantRows]: any = await conn.execute(
      "SELECT id, product_id, color_id, size_name, name, sku, price, stock_quantity, is_active FROM product_variants WHERE id = ? LIMIT 1",
      [cleanVariantId]
    );

    if (!variantRows || variantRows.length === 0 || variantRows[0].product_id !== cleanProductId) {
      throw new CartValidationError("The selected variant does not belong to this product", 400);
    }

    variantRecord = variantRows[0];
    const isVariantActive = Boolean(
      variantRecord.is_active === 1 || variantRecord.is_active === true
    );
    if (!isVariantActive) {
      throw new CartValidationError("The selected variant is currently inactive", 400);
    }

    if (variantRecord.color_id) {
      if (resolvedColorId && resolvedColorId !== variantRecord.color_id) {
        throw new CartValidationError("The selected variant does not match the chosen color", 400);
      }
      resolvedColorId = variantRecord.color_id;
    }
  }

  // 3. Validate Color if required or present
  let colorRecord: any = null;
  if (productHasColors || resolvedColorId) {
    if (!resolvedColorId) {
      throw new CartValidationError("Please select a color for this product", 400);
    }

    const [colorRows]: any = await conn.execute(
      "SELECT id, product_id, name, slug, hex, sku, stock, reserved_stock, is_active FROM product_colors WHERE id = ? LIMIT 1",
      [resolvedColorId]
    );

    if (!colorRows || colorRows.length === 0 || colorRows[0].product_id !== cleanProductId) {
      throw new CartValidationError("The selected color does not belong to this product", 400);
    }

    colorRecord = colorRows[0];
    const isColorActive = Boolean(colorRecord.is_active === 1 || colorRecord.is_active === true);
    if (!isColorActive) {
      throw new CartValidationError(`The selected color "${colorRecord.name}" is currently inactive`, 400);
    }
  }

  // 4. Resolve effective stock authoritatively
  if (variantRecord) {
    const [resRows]: any = await conn.execute(
      `SELECT COALESCE(SUM(quantity), 0) AS reserved_qty
       FROM stock_reservations
       WHERE variant_id = ? AND status = 'active' AND expires_at > NOW()`,
      [variantRecord.id]
    );
    const reservedQty = Number(resRows?.[0]?.reserved_qty || 0);
    effectiveStock = resolveAuthoritativeEffectiveStock({
      hasVariant: true,
      variantStock: variantRecord.stock_quantity,
      variantReservedStock: reservedQty,
      hasColor: false,
    });
  } else if (colorRecord) {
    effectiveStock = resolveAuthoritativeEffectiveStock({
      hasVariant: false,
      hasColor: true,
      colorStock: colorRecord.stock,
      colorReservedStock: colorRecord.reserved_stock,
    });
  } else {
    // Simple product without variants or colors
    if (cleanColorId) {
      throw new CartValidationError("This product does not have color options", 400);
    }
    if (cleanVariantId) {
      throw new CartValidationError("This product does not have variants", 400);
    }
    effectiveStock = resolveAuthoritativeEffectiveStock({
      hasVariant: false,
      hasColor: false,
      productStock: product.stock_quantity,
    });
  }

  if (effectiveStock <= 0) {
    throw new CartValidationError("This item is currently out of stock", 400);
  }

  // 5. Match existing cart item for same product + variant + color combination using null-safe equality
  const [existingItemRows]: any = await conn.execute(
    `SELECT id, quantity FROM cart_items
     WHERE cart_id = ?
       AND product_id = ?
       AND (variant_id <=> ?)
       AND (color_id <=> ?)
     LIMIT 1`,
    [cartId, cleanProductId, cleanVariantId || null, resolvedColorId || null]
  );

  const existingItem = existingItemRows && existingItemRows.length > 0 ? existingItemRows[0] : null;
  const existingQuantity = existingItem ? Number(existingItem.quantity) : 0;
  const targetQuantity = existingQuantity + quantityToAdd;

  if (targetQuantity > 10) {
    throw new CartValidationError(
      `Cannot exceed 10 units per color/item (already ${existingQuantity} in cart, requested +${quantityToAdd})`,
      400
    );
  }

  if (targetQuantity > effectiveStock) {
    throw new CartValidationError(
      `Insufficient stock available. You already have ${existingQuantity} in your cart, and only ${effectiveStock} are in stock.`,
      400
    );
  }

  if (existingItem) {
    await conn.execute(
      "UPDATE cart_items SET quantity = ?, updated_at = NOW() WHERE id = ?",
      [targetQuantity, existingItem.id]
    );
  } else {
    const newItemId = crypto.randomUUID();
    await conn.execute(
      `INSERT INTO cart_items (id, cart_id, product_id, variant_id, color_id, quantity, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [newItemId, cartId, cleanProductId, cleanVariantId || null, resolvedColorId || null, targetQuantity]
    );
  }
}

/**
 * Adds multiple items to the customer's active cart atomically inside a single transaction.
 */
export async function addCartItemsBatch(
  userId: string,
  items: AddCartItemInput[]
): Promise<CartRecord> {
  const cleanUserId = validateId(userId, "User ID");
  if (!Array.isArray(items) || items.length === 0) {
    throw new CartValidationError("At least one item must be provided", 400);
  }

  const cart = await getOrCreateActiveCartForUser(cleanUserId);

  await withTransaction(async (conn) => {
    for (const it of items) {
      await addSingleCartItemInternal(conn, cart.id, it);
    }
    await conn.execute("UPDATE carts SET updated_at = NOW() WHERE id = ?", [cart.id]);
  });

  return await getCartForUser(cleanUserId);
}

/**
 * Adds an item to the customer's active cart.
 */
export async function addCartItem(
  userId: string,
  input: AddCartItemInput
): Promise<CartRecord> {
  return await addCartItemsBatch(userId, [input]);
}

/**
 * Updates an existing cart item's final quantity.
 */
export async function updateCartItemQuantity(
  userId: string,
  rawItemId: string,
  rawQuantity: unknown
): Promise<CartRecord> {
  const cleanUserId = validateId(userId, "User ID");
  const cleanItemId = validateId(rawItemId, "Cart Item ID");
  const desiredQuantity = validateQuantity(rawQuantity);

  if (desiredQuantity > 10) {
    throw new CartValidationError("Maximum quantity allowed per item is 10", 400);
  }

  // 1. Locate item with cart ownership and current product/variant/color stock
  const rows = await query<any[]>(
    `SELECT
       ci.id AS item_id,
       ci.cart_id,
       ci.product_id,
       ci.variant_id,
       ci.color_id,
       ci.quantity,
       p.name AS product_name,
       p.is_active AS product_is_active,
       p.stock_quantity AS product_stock_quantity,
       pv.name AS variant_name,
       pv.is_active AS variant_is_active,
       pv.stock_quantity AS variant_stock_quantity,
       (
         SELECT COALESCE(SUM(sr.quantity), 0)
         FROM stock_reservations sr
         WHERE sr.variant_id = pv.id AND sr.status = 'active' AND sr.expires_at > NOW()
       ) AS variant_reserved_stock,
       pc.name AS color_name,
       pc.stock AS color_stock,
       pc.reserved_stock AS color_reserved_stock,
       pc.is_active AS color_is_active
     FROM cart_items ci
     INNER JOIN carts c ON ci.cart_id = c.id
     INNER JOIN products p ON ci.product_id = p.id
     LEFT JOIN product_variants pv ON ci.variant_id = pv.id
     LEFT JOIN product_colors pc ON ci.color_id = pc.id
     WHERE ci.id = ? AND c.user_id = ? AND c.status = 'active'
     LIMIT 1`,
    [cleanItemId, cleanUserId]
  );

  if (!rows || rows.length === 0) {
    throw new CartValidationError("Cart item not found or does not belong to your active cart", 404);
  }

  const row = rows[0];
  const isProductActive = Boolean(row.product_is_active === 1 || row.product_is_active === true);
  if (!isProductActive) {
    throw new CartValidationError("This product is no longer active", 400);
  }

  let effectiveStock = 0;
  if (row.variant_id) {
    const isVariantActive = Boolean(row.variant_is_active === 1 || row.variant_is_active === true);
    if (!isVariantActive) {
      throw new CartValidationError("The selected variant is no longer active", 400);
    }
    if (row.color_id) {
      const isColorActive = Boolean(row.color_is_active === 1 || row.color_is_active === true);
      if (!isColorActive) {
        throw new CartValidationError("The selected color is no longer active", 400);
      }
    }
    effectiveStock = resolveAuthoritativeEffectiveStock({
      hasVariant: true,
      variantStock: row.variant_stock_quantity,
      variantReservedStock: row.variant_reserved_stock,
      hasColor: false,
    });
  } else if (row.color_id) {
    const isColorActive = Boolean(row.color_is_active === 1 || row.color_is_active === true);
    if (!isColorActive) {
      throw new CartValidationError("The selected color is no longer active", 400);
    }
    effectiveStock = resolveAuthoritativeEffectiveStock({
      hasVariant: false,
      hasColor: true,
      colorStock: row.color_stock,
      colorReservedStock: row.color_reserved_stock,
    });
  } else {
    effectiveStock = resolveAuthoritativeEffectiveStock({
      hasVariant: false,
      hasColor: false,
      productStock: row.product_stock_quantity,
    });
  }

  if (desiredQuantity > effectiveStock) {
    throw new CartValidationError(
      `Requested quantity (${desiredQuantity}) exceeds available stock (${effectiveStock} available)`,
      400
    );
  }

  // 3. Update quantity
  await query(
    "UPDATE cart_items SET quantity = ?, updated_at = NOW() WHERE id = ?",
    [desiredQuantity, cleanItemId]
  );

  await query("UPDATE carts SET updated_at = NOW() WHERE id = ?", [row.cart_id]);

  // 4. Return refreshed cart
  return await getCartForUser(cleanUserId);
}

/**
 * Removes an item from the customer's active cart.
 *
 * Strict Ownership Enforcement:
 * - Scoped through carts.user_id = ? AND carts.status = 'active'.
 * - Prevents IDOR: Customer A cannot delete Customer B's item.
 * - Idempotent: returns success even if already absent.
 */
export async function removeCartItem(
  userId: string,
  rawItemId: string
): Promise<{ success: boolean; removed: boolean; cart: CartRecord }> {
  const cleanUserId = validateId(userId, "User ID");
  const cleanItemId = validateId(rawItemId, "Cart Item ID");

  const result = await query<any>(
    `DELETE ci FROM cart_items ci
     INNER JOIN carts c ON ci.cart_id = c.id
     WHERE ci.id = ? AND c.user_id = ? AND c.status = 'active'`,
    [cleanItemId, cleanUserId]
  );

  const affectedRows = Number(result?.affectedRows ?? 0);
  const cart = await getCartForUser(cleanUserId);

  return {
    success: true,
    removed: affectedRows > 0,
    cart,
  };
}

/**
 * Clears all items from the customer's active cart.
 */
export async function clearCartForUser(userId: string): Promise<CartRecord> {
  const cleanUserId = validateId(userId, "User ID");

  await query(
    `DELETE ci FROM cart_items ci
     INNER JOIN carts c ON ci.cart_id = c.id
     WHERE c.user_id = ? AND c.status = 'active'`,
    [cleanUserId]
  );

  return await getCartForUser(cleanUserId);
}
