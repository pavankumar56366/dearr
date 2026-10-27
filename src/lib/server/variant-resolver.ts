import "server-only";
import { query } from "./db";

export class AuthoritativeResolverError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = "AuthoritativeResolverError";
    this.statusCode = statusCode;
  }
}

export interface AuthoritativeItemResolution {
  productId: string;
  productName: string;
  hasColors: boolean;
  codEnabled: boolean;
  categoryId: string | null;
  variantId: string | null;
  variantName: string | null;
  colorId: string | null;
  colorName: string | null;
  colorHex: string | null;
  sku: string | null;
  imageUrl: string;
  unitPrice: number;
  effectiveStock: number;
  isProductActive: boolean;
  isColorActive: boolean;
  isVariantActive: boolean;
}

/**
 * Resolves the server-authoritative unit price according to strict hierarchy:
 * 1. Variant-specific price (pv.price) if non-null and defined.
 *    CRITICAL: Legitimate ₹0 price (0) is valid and must NOT fallback!
 * 2. Color price override (pc.price_override) if non-null and defined.
 *    CRITICAL: Legitimate ₹0 price (0) is valid and must NOT fallback!
 * 3. Base product price (p.price).
 */
export function resolveAuthoritativeUnitPrice(params: {
  productPrice: number | string;
  colorPriceOverride?: number | string | null;
  variantPrice?: number | string | null;
}): number {
  if (params.variantPrice !== null && params.variantPrice !== undefined) {
    const num = Number(params.variantPrice);
    if (!isNaN(num) && num >= 0) {
      return Math.round(num * 100) / 100;
    }
  }

  if (params.colorPriceOverride !== null && params.colorPriceOverride !== undefined) {
    const num = Number(params.colorPriceOverride);
    if (!isNaN(num) && num >= 0) {
      return Math.round(num * 100) / 100;
    }
  }

  const num = Number(params.productPrice || 0);
  return Math.max(0, Math.round((isNaN(num) ? 0 : num) * 100) / 100);
}

/**
 * Resolves the server-authoritative available stock quantity:
 * 1. If variant is selected: variant.stock_quantity - active variant stock reservations.
 * 2. If color-only product: color.stock - color.reserved_stock.
 * 3. Simple product: product.stock_quantity.
 */
export function resolveAuthoritativeEffectiveStock(params: {
  hasVariant: boolean;
  variantStock?: number | null;
  variantReservedStock?: number | null;
  hasColor: boolean;
  colorStock?: number | null;
  colorReservedStock?: number | null;
  productStock?: number | null;
}): number {
  if (params.hasVariant) {
    const base = Math.max(0, Number(params.variantStock ?? 0));
    const reserved = Math.max(0, Number(params.variantReservedStock ?? 0));
    return Math.max(0, base - reserved);
  }

  if (params.hasColor) {
    const base = Math.max(0, Number(params.colorStock ?? 0));
    const reserved = Math.max(0, Number(params.colorReservedStock ?? 0));
    return Math.max(0, base - reserved);
  }

  return Math.max(0, Number(params.productStock ?? 0));
}

/**
 * Validates product, color, and variant combination authoritatively from MySQL
 * and resolves trusted unit price, stock, SKU, and metadata.
 */
export async function resolveAuthoritativeItemFromDb(
  conn: any,
  input: {
    productId: string;
    variantId?: string | null;
    colorId?: string | null;
    forUpdate?: boolean;
    excludeAttemptId?: string | null;
  }
): Promise<AuthoritativeItemResolution> {
  const cleanProductId = (input.productId || "").trim();
  const cleanColorId = input.colorId ? input.colorId.trim() : null;
  const cleanVariantId = input.variantId ? input.variantId.trim() : null;

  if (!cleanProductId) {
    throw new AuthoritativeResolverError("Product ID is required", 400);
  }

  // 1. Fetch Product
  const productLock = input.forUpdate ? " FOR UPDATE" : "";
  const [productRows]: any = await conn.execute(
    `SELECT id, name, price, stock_quantity, is_active, has_colors, cod_enabled, category_id
     FROM products WHERE id = ? LIMIT 1${productLock}`,
    [cleanProductId]
  );

  if (!productRows || productRows.length === 0) {
    throw new AuthoritativeResolverError("Product not found", 404);
  }
  const product = productRows[0];
  const isProductActive = Boolean(product.is_active === 1 || product.is_active === true);
  if (!isProductActive) {
    throw new AuthoritativeResolverError(
      `Product "${product.name}" is no longer available for purchase`,
      400
    );
  }

  const hasColors = Boolean(product.has_colors === 1 || product.has_colors === true);
  let colorRecord: any = null;
  let variantRecord: any = null;
  let resolvedColorId = cleanColorId;

  // 2. Fetch Variant if specified
  if (cleanVariantId) {
    const variantLock = input.forUpdate ? " FOR UPDATE" : "";
    const [variantRows]: any = await conn.execute(
      `SELECT id, product_id, color_id, size_name, name, sku, price, stock_quantity, is_active
       FROM product_variants WHERE id = ? LIMIT 1${variantLock}`,
      [cleanVariantId]
    );

    if (!variantRows || variantRows.length === 0 || variantRows[0].product_id !== cleanProductId) {
      throw new AuthoritativeResolverError(
        `Selected variant does not belong to product "${product.name}"`,
        400
      );
    }

    variantRecord = variantRows[0];
    const isVariantActive = Boolean(variantRecord.is_active === 1 || variantRecord.is_active === true);
    if (!isVariantActive) {
      throw new AuthoritativeResolverError(
        `Variant "${variantRecord.name}" is currently inactive`,
        400
      );
    }

    // Cross-validate variant's color linkage if set
    if (variantRecord.color_id) {
      if (resolvedColorId && resolvedColorId !== variantRecord.color_id) {
        throw new AuthoritativeResolverError(
          `Selected variant does not match the chosen color`,
          400
        );
      }
      resolvedColorId = variantRecord.color_id;
    }
  }

  // 3. Fetch Color if required or linked
  if (hasColors || resolvedColorId) {
    if (!resolvedColorId) {
      throw new AuthoritativeResolverError(
        `Please select a color for product "${product.name}"`,
        400
      );
    }

    const colorLock = input.forUpdate ? " FOR UPDATE" : "";
    const [colorRows]: any = await conn.execute(
      `SELECT id, product_id, name, slug, hex, sku, stock, reserved_stock, price_override, is_active
       FROM product_colors WHERE id = ? LIMIT 1${colorLock}`,
      [resolvedColorId]
    );

    if (!colorRows || colorRows.length === 0 || colorRows[0].product_id !== cleanProductId) {
      throw new AuthoritativeResolverError(
        `Selected color does not belong to product "${product.name}"`,
        400
      );
    }

    colorRecord = colorRows[0];
    const isColorActive = Boolean(colorRecord.is_active === 1 || colorRecord.is_active === true);
    if (!isColorActive) {
      throw new AuthoritativeResolverError(
        `Color "${colorRecord.name}" is currently inactive`,
        400
      );
    }
  }

  // 4. Resolve Authoritative Unit Price
  const unitPrice = resolveAuthoritativeUnitPrice({
    productPrice: product.price,
    colorPriceOverride: colorRecord?.price_override,
    variantPrice: variantRecord?.price,
  });

  // 5. Resolve Variant Active Reservations
  let variantReservedStock = 0;
  if (variantRecord) {
    const excludeClause = input.excludeAttemptId ? " AND attempt_id != ?" : "";
    const excludeParams = input.excludeAttemptId ? [variantRecord.id, input.excludeAttemptId] : [variantRecord.id];
    const [resRows]: any = await conn.execute(
      `SELECT COALESCE(SUM(quantity), 0) AS reserved_qty
       FROM stock_reservations
       WHERE variant_id = ? AND status = 'active' AND expires_at > NOW()${excludeClause}`,
      excludeParams
    );
    variantReservedStock = Number(resRows?.[0]?.reserved_qty || 0);
  }

  // 6. Resolve Authoritative Effective Stock
  const effectiveStock = resolveAuthoritativeEffectiveStock({
    hasVariant: Boolean(variantRecord),
    variantStock: variantRecord?.stock_quantity,
    variantReservedStock,
    hasColor: Boolean(colorRecord && !variantRecord),
    colorStock: colorRecord?.stock,
    colorReservedStock: colorRecord?.reserved_stock,
    productStock: product.stock_quantity,
  });

  // 7. Resolve Product Image
  let imageUrl = "/product-samples/1.jpeg";
  if (resolvedColorId) {
    const [imgRows]: any = await conn.execute(
      `SELECT storage_path FROM product_images
       WHERE product_id = ? AND (color_id = ? OR color_id IS NULL)
       ORDER BY (CASE WHEN color_id = ? THEN 0 ELSE 1 END), sort_order ASC
       LIMIT 1`,
      [cleanProductId, resolvedColorId, resolvedColorId]
    );
    if (imgRows && imgRows.length > 0 && imgRows[0].storage_path) {
      imageUrl = imgRows[0].storage_path;
    }
  } else {
    const [imgRows]: any = await conn.execute(
      `SELECT storage_path FROM product_images
       WHERE product_id = ?
       ORDER BY sort_order ASC
       LIMIT 1`,
      [cleanProductId]
    );
    if (imgRows && imgRows.length > 0 && imgRows[0].storage_path) {
      imageUrl = imgRows[0].storage_path;
    }
  }

  const sku = variantRecord?.sku || colorRecord?.sku || null;

  let variantName: string | null = null;
  if (variantRecord) {
    variantName = variantRecord.size_name || variantRecord.name || "Variant";
  }

  return {
    productId: cleanProductId,
    productName: product.name,
    hasColors,
    codEnabled: Boolean(
      product.cod_enabled !== undefined && product.cod_enabled !== null
        ? product.cod_enabled
        : 1
    ),
    categoryId: product.category_id || null,
    variantId: variantRecord ? variantRecord.id : null,
    variantName,
    colorId: colorRecord ? colorRecord.id : null,
    colorName: colorRecord ? colorRecord.name : null,
    colorHex: colorRecord ? colorRecord.hex : null,
    sku,
    imageUrl,
    unitPrice,
    effectiveStock,
    isProductActive,
    isColorActive: colorRecord ? Boolean(colorRecord.is_active) : true,
    isVariantActive: variantRecord ? Boolean(variantRecord.is_active) : true,
  };
}
