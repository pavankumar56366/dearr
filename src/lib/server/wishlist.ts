import "server-only";
import crypto from "crypto";
import { query } from "./db";

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

export interface WishlistProductSummary {
  id: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  compareAtPrice: number | null;
  image: string;
  category: string | null;
  categorySlug: string | null;
  isFeatured: boolean;
  isActive: boolean;
  stockQuantity: number;
  isAvailable: boolean;
}

export interface WishlistItem {
  id: string;
  wishlistId: string;
  productId: string;
  createdAt: Date;
  product: WishlistProductSummary;
}

export interface WishlistRecord {
  id: string;
  userId: string;
  items: WishlistItem[];
  count: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface AddWishlistItemResult {
  item: WishlistItem;
  alreadyInWishlist: boolean;
}

// ---------------------------------------------------------------------------
// Error Handling
// ---------------------------------------------------------------------------

export class WishlistValidationError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = "WishlistValidationError";
    this.statusCode = statusCode;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Normalizes a storage path into a public URL.
 */
function toPublicUrl(storagePath: string | null | undefined): string {
  if (!storagePath) return "/product-samples/1.jpeg";
  if (storagePath.startsWith("http://") || storagePath.startsWith("https://")) {
    return storagePath;
  }
  return storagePath.startsWith("/") ? storagePath : `/${storagePath}`;
}

/**
 * Validates a product ID string. Must be non-empty, alphanumeric with hyphens/underscores,
 * and within standard 36-character length limits.
 */
export function validateProductId(productId: unknown): string {
  if (!productId || typeof productId !== "string") {
    throw new WishlistValidationError("Product ID is required and must be a string", 400);
  }
  const clean = productId.trim();
  if (clean.length === 0 || clean.length > 36) {
    throw new WishlistValidationError("Product ID must be between 1 and 36 characters", 400);
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(clean)) {
    throw new WishlistValidationError("Invalid product ID format", 400);
  }
  return clean;
}

// ---------------------------------------------------------------------------
// Repository Functions
// ---------------------------------------------------------------------------

/**
 * Retrieves the existing wishlist for a user or atomically creates one if none exists.
 * Strictly enforces one wishlist per customer (V1 rule).
 *
 * Scoped directly to the authenticated user's ID.
 */
export async function getOrCreateWishlistForUser(userId: string): Promise<{
  id: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}> {
  if (!userId || typeof userId !== "string") {
    throw new WishlistValidationError("User ID is required", 400);
  }
  const cleanUserId = userId.trim();

  // 1. Check for existing customer wishlist
  const existingRows = await query<any[]>(
    "SELECT id, user_id, created_at, updated_at FROM wishlists WHERE user_id = ? LIMIT 1",
    [cleanUserId]
  );

  if (existingRows && existingRows.length > 0) {
    const row = existingRows[0];
    return {
      id: row.id,
      userId: row.user_id,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  // 2. Insert new wishlist with UUID, handling concurrent race conditions safely
  const newId = crypto.randomUUID();
  try {
    await query(
      `INSERT INTO wishlists (id, user_id, created_at, updated_at)
       VALUES (?, ?, NOW(), NOW())
       ON DUPLICATE KEY UPDATE updated_at = NOW()`,
      [newId, cleanUserId]
    );
  } catch {
    // If unique key collision or race occurred, proceed to query existing
  }

  // 3. Query the persisted row
  const rows = await query<any[]>(
    "SELECT id, user_id, created_at, updated_at FROM wishlists WHERE user_id = ? LIMIT 1",
    [cleanUserId]
  );

  if (!rows || rows.length === 0) {
    throw new Error("Failed to initialize customer wishlist");
  }

  const row = rows[0];
  return {
    id: row.id,
    userId: row.user_id,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

/**
 * Retrieves the customer's full wishlist, joining item metadata, product details,
 * categories, and primary product images.
 *
 * Strict Ownership:
 * - Scoped exclusively to the authenticated user ID.
 * - Inactive or deactivated products are safely marked as unavailable without breaking UI.
 * - Sensitive database credentials, passwords, and admin data are NEVER returned.
 */
export async function getWishlistForUser(userId: string): Promise<WishlistRecord> {
  const wishlist = await getOrCreateWishlistForUser(userId);

  const itemRows = await query<any[]>(
    `SELECT 
       wi.id AS item_id,
       wi.wishlist_id,
       wi.product_id,
       wi.created_at AS item_created_at,
       p.id AS p_id,
       p.name AS p_name,
       p.slug AS p_slug,
       p.description AS p_description,
       p.price AS p_price,
       p.compare_at_price AS p_compare_at_price,
       p.stock_quantity AS p_stock_quantity,
       p.is_featured AS p_is_featured,
       p.is_active AS p_is_active,
       c.name AS category_name,
       c.slug AS category_slug,
       (
         SELECT pi.storage_path 
         FROM product_images pi 
         WHERE pi.product_id = p.id 
         ORDER BY pi.sort_order ASC, pi.created_at ASC 
         LIMIT 1
       ) AS primary_image
     FROM wishlist_items wi
     INNER JOIN wishlists w ON wi.wishlist_id = w.id
     LEFT JOIN products p ON wi.product_id = p.id
     LEFT JOIN categories c ON p.category_id = c.id
     WHERE w.user_id = ?
     ORDER BY wi.created_at DESC`,
    [wishlist.userId]
  );

  const items: WishlistItem[] = (itemRows || []).map((row) => {
    const isActive = Boolean(row.p_is_active === 1 || row.p_is_active === true);
    const isAvailable = Boolean(row.p_id && isActive);
    const primaryImg = toPublicUrl(row.primary_image);

    const productSummary: WishlistProductSummary = {
      id: row.p_id || row.product_id,
      name: isAvailable
        ? row.p_name
        : row.p_name
        ? `${row.p_name} (Unavailable)`
        : "Unavailable Product",
      slug: row.p_slug || `product-${row.product_id}`,
      description: isAvailable ? row.p_description || "" : "",
      price: row.p_price !== null && row.p_price !== undefined ? Number(row.p_price) : 0,
      compareAtPrice:
        row.p_compare_at_price !== null && row.p_compare_at_price !== undefined
          ? Number(row.p_compare_at_price)
          : null,
      image: primaryImg,
      category: isAvailable ? row.category_name || null : null,
      categorySlug: isAvailable ? row.category_slug || null : null,
      isFeatured: isAvailable ? Boolean(row.p_is_featured) : false,
      isActive: isAvailable,
      stockQuantity: isAvailable ? Number(row.p_stock_quantity || 0) : 0,
      isAvailable,
    };

    return {
      id: row.item_id,
      wishlistId: row.wishlist_id,
      productId: row.product_id,
      createdAt: new Date(row.item_created_at),
      product: productSummary,
    };
  });

  return {
    id: wishlist.id,
    userId: wishlist.userId,
    items,
    count: items.length,
    createdAt: wishlist.createdAt,
    updatedAt: wishlist.updatedAt,
  };
}

/**
 * Adds a product to the authenticated customer's wishlist.
 *
 * Guarantees:
 * - Product must exist in the database.
 * - Product must be active (storefront visibility rule).
 * - Scoped exclusively to the authenticated user's wishlist.
 * - Respects database UNIQUE(wishlist_id, product_id) constraint.
 * - Idempotent: repeated calls do NOT create duplicate rows or throw unhandled errors.
 */
export async function addProductToWishlist(
  userId: string,
  rawProductId: string
): Promise<AddWishlistItemResult> {
  const cleanProductId = validateProductId(rawProductId);

  // 1. Verify referenced product exists and follows storefront visibility
  const productRows = await query<any[]>(
    `SELECT 
       p.id,
       p.name,
       p.slug,
       p.description,
       p.price,
       p.compare_at_price,
       p.stock_quantity,
       p.is_featured,
       p.is_active,
       c.name AS category_name,
       c.slug AS category_slug,
       (
         SELECT pi.storage_path 
         FROM product_images pi 
         WHERE pi.product_id = p.id 
         ORDER BY pi.sort_order ASC, pi.created_at ASC 
         LIMIT 1
       ) AS primary_image
     FROM products p
     LEFT JOIN categories c ON p.category_id = c.id
     WHERE p.id = ?
     LIMIT 1`,
    [cleanProductId]
  );

  if (!productRows || productRows.length === 0) {
    throw new WishlistValidationError("Product not found", 404);
  }

  const pRow = productRows[0];
  const isActive = Boolean(pRow.is_active === 1 || pRow.is_active === true);
  if (!isActive) {
    throw new WishlistValidationError(
      "This product is currently inactive and cannot be saved to your wishlist",
      400
    );
  }

  // 2. Resolve customer's wishlist
  const wishlist = await getOrCreateWishlistForUser(userId);

  // 3. Check if already present in wishlist
  const existingItemRows = await query<any[]>(
    "SELECT id, created_at FROM wishlist_items WHERE wishlist_id = ? AND product_id = ? LIMIT 1",
    [wishlist.id, cleanProductId]
  );

  const productSummary: WishlistProductSummary = {
    id: pRow.id,
    name: pRow.name,
    slug: pRow.slug,
    description: pRow.description || "",
    price: Number(pRow.price),
    compareAtPrice:
      pRow.compare_at_price !== null && pRow.compare_at_price !== undefined
        ? Number(pRow.compare_at_price)
        : null,
    image: toPublicUrl(pRow.primary_image),
    category: pRow.category_name || null,
    categorySlug: pRow.category_slug || null,
    isFeatured: Boolean(pRow.is_featured),
    isActive: true,
    stockQuantity: Number(pRow.stock_quantity || 0),
    isAvailable: true,
  };

  if (existingItemRows && existingItemRows.length > 0) {
    const existing = existingItemRows[0];
    return {
      item: {
        id: existing.id,
        wishlistId: wishlist.id,
        productId: cleanProductId,
        createdAt: new Date(existing.created_at),
        product: productSummary,
      },
      alreadyInWishlist: true,
    };
  }

  // 4. Insert new item with UUID
  const newItemId = crypto.randomUUID();
  try {
    await query(
      `INSERT INTO wishlist_items (id, wishlist_id, product_id, created_at)
       VALUES (?, ?, ?, NOW())`,
      [newItemId, wishlist.id, cleanProductId]
    );

    return {
      item: {
        id: newItemId,
        wishlistId: wishlist.id,
        productId: cleanProductId,
        createdAt: new Date(),
        product: productSummary,
      },
      alreadyInWishlist: false,
    };
  } catch (err: any) {
    // If unique constraint triggered due to concurrent insert, load existing row
    if (err?.code === "ER_DUP_ENTRY") {
      const racedRows = await query<any[]>(
        "SELECT id, created_at FROM wishlist_items WHERE wishlist_id = ? AND product_id = ? LIMIT 1",
        [wishlist.id, cleanProductId]
      );
      if (racedRows && racedRows.length > 0) {
        return {
          item: {
            id: racedRows[0].id,
            wishlistId: wishlist.id,
            productId: cleanProductId,
            createdAt: new Date(racedRows[0].created_at),
            product: productSummary,
          },
          alreadyInWishlist: true,
        };
      }
    }
    throw err;
  }
}

/**
 * Removes a product from the customer's wishlist.
 *
 * Strict Ownership Enforcement:
 * - Scoped strictly through `wishlists.user_id = ?`.
 * - Prevents IDOR vulnerabilities: Customer A cannot delete Customer B's saved item.
 * - Idempotent: returns success even if the item was already absent.
 */
export async function removeProductFromWishlist(
  userId: string,
  rawProductId: string
): Promise<{ success: boolean; removed: boolean }> {
  const cleanProductId = validateProductId(rawProductId);

  if (!userId || typeof userId !== "string") {
    throw new WishlistValidationError("User ID is required", 400);
  }
  const cleanUserId = userId.trim();

  const result = await query<any>(
    `DELETE wi FROM wishlist_items wi
     INNER JOIN wishlists w ON wi.wishlist_id = w.id
     WHERE w.user_id = ? AND wi.product_id = ?`,
    [cleanUserId, cleanProductId]
  );

  const affectedRows = Number(result?.affectedRows ?? 0);

  return {
    success: true,
    removed: affectedRows > 0,
  };
}

/**
 * Clears all items from the customer's wishlist.
 * Scoped strictly to the authenticated user's ID.
 */
export async function clearWishlistForUser(
  userId: string
): Promise<{ success: boolean; count: number }> {
  if (!userId || typeof userId !== "string") {
    throw new WishlistValidationError("User ID is required", 400);
  }
  const cleanUserId = userId.trim();

  const result = await query<any>(
    `DELETE wi FROM wishlist_items wi
     INNER JOIN wishlists w ON wi.wishlist_id = w.id
     WHERE w.user_id = ?`,
    [cleanUserId]
  );

  const affectedRows = Number(result?.affectedRows ?? 0);

  return {
    success: true,
    count: affectedRows,
  };
}

/**
 * Checks whether a specific product is currently saved in the customer's wishlist.
 * Scoped strictly through `wishlists.user_id = ?`.
 */
export async function isProductInWishlist(
  userId: string,
  rawProductId: string
): Promise<boolean> {
  const cleanProductId = validateProductId(rawProductId);

  if (!userId || typeof userId !== "string") {
    return false;
  }
  const cleanUserId = userId.trim();

  const rows = await query<any[]>(
    `SELECT 1 FROM wishlist_items wi
     INNER JOIN wishlists w ON wi.wishlist_id = w.id
     WHERE w.user_id = ? AND wi.product_id = ?
     LIMIT 1`,
    [cleanUserId, cleanProductId]
  );

  return Boolean(rows && rows.length > 0);
}
