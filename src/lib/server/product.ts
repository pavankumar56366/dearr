import "server-only";
import crypto from "crypto";
import { query, withTransaction } from "./db";
import { PoolConnection } from "mysql2/promise";

export interface ProductImage {
  id: string;
  productId: string;
  storagePath: string;
  url: string;
  altText: string | null;
  sortOrder: number;
  createdAt: Date;
}

export interface ProductVariant {
  id: string;
  productId: string;
  name: string;
  sku: string;
  price: number | null;
  stockQuantity: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProductCategoryInfo {
  id: string;
  name: string;
  slug: string;
  description: string | null;
}

export interface Product {
  id: string;
  categoryId: string | null;
  category?: ProductCategoryInfo | null;
  name: string;
  slug: string;
  description: string;
  price: number;
  compareAtPrice: number | null;
  stockQuantity: number;
  isFeatured: boolean;
  isActive: boolean;
  images: ProductImage[];
  variants: ProductVariant[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ProductListFilters {
  categoryId?: string;
  categorySlug?: string;
  isFeatured?: boolean;
  isActive?: boolean;
  search?: string;
  page?: number;
  pageSize?: number;
  sort?: "price-asc" | "price-desc" | "newest" | "featured";
}

export interface CreateProductInput {
  id?: string;
  categoryId?: string | null;
  name: string;
  slug?: string;
  description: string;
  price: number;
  compareAtPrice?: number | null;
  stockQuantity: number;
  isFeatured?: boolean;
  isActive?: boolean;
  images?: Array<{
    id?: string;
    storagePath: string;
    altText?: string | null;
    sortOrder?: number;
  }>;
  variants?: Array<{
    id?: string;
    name: string;
    sku: string;
    price?: number | null;
    stockQuantity: number;
    isActive?: boolean;
  }>;
}

export interface UpdateProductInput {
  categoryId?: string | null;
  name?: string;
  slug?: string;
  description?: string;
  price?: number;
  compareAtPrice?: number | null;
  stockQuantity?: number;
  isFeatured?: boolean;
  isActive?: boolean;
  images?: Array<{
    id?: string;
    storagePath: string;
    altText?: string | null;
    sortOrder?: number;
  }>;
  variants?: Array<{
    id?: string;
    name: string;
    sku: string;
    price?: number | null;
    stockQuantity: number;
    isActive?: boolean;
  }>;
}

export class ProductValidationError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = "ProductValidationError";
    this.statusCode = statusCode;
  }
}

/**
 * Normalizes a slug to lowercase alphanumeric with single hyphens.
 */
export function generateSlug(name: string): string {
  const slug = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || `product-${crypto.randomUUID().slice(0, 8)}`;
}

/**
 * Validates a slug format. Must be URL-safe (lowercase alphanumeric + hyphens).
 */
export function validateSlug(slug: string): void {
  if (!slug || typeof slug !== "string") {
    throw new ProductValidationError("Slug must be a non-empty string", 400);
  }
  const clean = slug.trim().toLowerCase();
  if (clean.length < 2 || clean.length > 255) {
    throw new ProductValidationError("Slug must be between 2 and 255 characters", 400);
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(clean)) {
    throw new ProductValidationError(
      "Invalid slug format: Only lowercase alphanumeric characters and single hyphens are allowed",
      400
    );
  }
}

/**
 * Normalizes a storage path into a public URL.
 */
function toPublicUrl(storagePath: string): string {
  if (!storagePath) return "";
  if (storagePath.startsWith("http://") || storagePath.startsWith("https://")) {
    return storagePath;
  }
  return storagePath.startsWith("/") ? storagePath : `/${storagePath}`;
}

/**
 * Maps raw database rows to a sanitized ProductImage object.
 */
function toProductImage(row: any): ProductImage {
  return {
    id: row.id,
    productId: row.product_id,
    storagePath: row.storage_path,
    url: toPublicUrl(row.storage_path),
    altText: row.alt_text ?? null,
    sortOrder: Number(row.sort_order ?? 0),
    createdAt: new Date(row.created_at),
  };
}

/**
 * Maps raw database rows to a sanitized ProductVariant object.
 */
function toProductVariant(row: any): ProductVariant {
  return {
    id: row.id,
    productId: row.product_id,
    name: row.name,
    sku: row.sku,
    price: row.price !== null && row.price !== undefined ? Number(row.price) : null,
    stockQuantity: Number(row.stock_quantity ?? 0),
    isActive: Boolean(row.is_active),
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

/**
 * Maps raw database row and associated relations to a sanitized Product object.
 */
function toProduct(
  row: any,
  category: ProductCategoryInfo | null = null,
  images: ProductImage[] = [],
  variants: ProductVariant[] = []
): Product {
  return {
    id: row.id,
    categoryId: row.category_id ?? null,
    category: category,
    name: row.name,
    slug: row.slug,
    description: row.description,
    price: Number(row.price),
    compareAtPrice: row.compare_at_price !== null && row.compare_at_price !== undefined ? Number(row.compare_at_price) : null,
    stockQuantity: Number(row.stock_quantity ?? 0),
    isFeatured: Boolean(row.is_featured),
    isActive: Boolean(row.is_active),
    images,
    variants,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

/**
 * Finds a single product by primary key UUID.
 * Includes category, images, and variants.
 */
export async function findProductById(
  id: string,
  includeInactive = false
): Promise<Product | null> {
  const cleanId = id?.trim();
  if (!cleanId) return null;

  let sql = `
    SELECT p.*, c.name AS category_name, c.slug AS category_slug, c.description AS category_description
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE p.id = ?
  `;
  const params: any[] = [cleanId];

  if (!includeInactive) {
    sql += " AND p.is_active = 1";
  }

  sql += " LIMIT 1";

  const rows = await query<any[]>(sql, params);
  if (!rows || rows.length === 0) {
    return null;
  }

  const row = rows[0];

  const category: ProductCategoryInfo | null = row.category_id
    ? {
        id: row.category_id,
        name: row.category_name,
        slug: row.category_slug,
        description: row.category_description ?? null,
      }
    : null;

  const [imageRows, variantRows] = await Promise.all([
    query<any[]>(
      "SELECT * FROM product_images WHERE product_id = ? ORDER BY sort_order ASC, created_at ASC",
      [cleanId]
    ),
    query<any[]>(
      "SELECT * FROM product_variants WHERE product_id = ? ORDER BY created_at ASC",
      [cleanId]
    ),
  ]);

  const images = (imageRows || []).map(toProductImage);
  const variants = (variantRows || []).map(toProductVariant);

  return toProduct(row, category, images, variants);
}

/**
 * Finds a single product by unique URL slug.
 * Includes category, images, and variants.
 */
export async function findProductBySlug(
  slug: string,
  includeInactive = false
): Promise<Product | null> {
  const cleanSlug = slug?.trim().toLowerCase();
  if (!cleanSlug) return null;

  let sql = `
    SELECT p.*, c.name AS category_name, c.slug AS category_slug, c.description AS category_description
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE p.slug = ?
  `;
  const params: any[] = [cleanSlug];

  if (!includeInactive) {
    sql += " AND p.is_active = 1";
  }

  sql += " LIMIT 1";

  const rows = await query<any[]>(sql, params);
  if (!rows || rows.length === 0) {
    return null;
  }

  const row = rows[0];

  const category: ProductCategoryInfo | null = row.category_id
    ? {
        id: row.category_id,
        name: row.category_name,
        slug: row.category_slug,
        description: row.category_description ?? null,
      }
    : null;

  const [imageRows, variantRows] = await Promise.all([
    query<any[]>(
      "SELECT * FROM product_images WHERE product_id = ? ORDER BY sort_order ASC, created_at ASC",
      [row.id]
    ),
    query<any[]>(
      "SELECT * FROM product_variants WHERE product_id = ? ORDER BY created_at ASC",
      [row.id]
    ),
  ]);

  const images = (imageRows || []).map(toProductImage);
  const variants = (variantRows || []).map(toProductVariant);

  return toProduct(row, category, images, variants);
}

/**
 * Retrieves related products for a product details page.
 * Prioritizes active products from the same category, followed by newest catalog items,
 * excluding the current product, in a single index-backed SQL query.
 */
export async function getRelatedProducts(
  productId: string,
  categoryId: string | null = null,
  limit = 4
): Promise<Product[]> {
  const cleanId = productId?.trim();
  if (!cleanId) return [];

  const safeLimit = Math.min(20, Math.max(1, limit));

  const sql = `
    SELECT p.id, p.category_id, p.name, p.slug, p.price, p.compare_at_price, p.stock_quantity, p.is_featured, p.is_active,
           p.created_at, p.updated_at,
           c.name AS category_name, c.slug AS category_slug, c.description AS category_description,
           (
             SELECT pi.storage_path 
             FROM product_images pi 
             WHERE pi.product_id = p.id 
             ORDER BY pi.sort_order ASC, pi.created_at ASC 
             LIMIT 1
           ) AS primary_image
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE p.id != ? AND p.is_active = 1
    ORDER BY (CASE WHEN p.category_id = ? THEN 0 ELSE 1 END) ASC, p.created_at DESC
    LIMIT ?
  `;

  const rows = await query<any[]>(sql, [cleanId, categoryId || "", safeLimit]);
  if (!rows || rows.length === 0) {
    return [];
  }

  return rows.map((row) => {
    const category: ProductCategoryInfo | null = row.category_id
      ? {
          id: row.category_id,
          name: row.category_name,
          slug: row.category_slug,
          description: row.category_description ?? null,
        }
      : null;

    const images: ProductImage[] = row.primary_image
      ? [
          {
            id: `img-${row.id}`,
            productId: row.id,
            storagePath: row.primary_image,
            url: toPublicUrl(row.primary_image),
            altText: row.name,
            sortOrder: 0,
            createdAt: new Date(row.created_at),
          },
        ]
      : [];

    return toProduct(row, category, images, []);
  });
}

/**
 * Lists products matching filter criteria with pagination.
 */
export async function listProducts(filters: ProductListFilters = {}): Promise<{
  products: Product[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}> {
  const page = Math.max(1, filters.page || 1);
  const pageSize = Math.min(100, Math.max(1, filters.pageSize || 24));
  const offset = (page - 1) * pageSize;

  const whereConditions: string[] = [];
  const queryParams: any[] = [];

  // Active status filter (defaults to active=1 for public queries)
  if (filters.isActive !== undefined) {
    whereConditions.push("p.is_active = ?");
    queryParams.push(filters.isActive ? 1 : 0);
  } else {
    whereConditions.push("p.is_active = 1");
  }

  // Featured filter
  if (filters.isFeatured !== undefined) {
    whereConditions.push("p.is_featured = ?");
    queryParams.push(filters.isFeatured ? 1 : 0);
  }

  // Category ID filter
  if (filters.categoryId) {
    whereConditions.push("p.category_id = ?");
    queryParams.push(filters.categoryId.trim());
  }

  // Category Slug filter
  if (filters.categorySlug) {
    whereConditions.push("c.slug = ?");
    queryParams.push(filters.categorySlug.trim().toLowerCase());
  }

  // Search keyword (matches in name or description)
  if (filters.search && filters.search.trim()) {
    whereConditions.push("(p.name LIKE ? OR p.description LIKE ?)");
    const searchTerm = `%${filters.search.trim()}%`;
    queryParams.push(searchTerm, searchTerm);
  }

  const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(" AND ")}` : "";

  // 1. Count query
  const countSql = `
    SELECT COUNT(*) AS total
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    ${whereClause}
  `;
  const countRows = await query<any[]>(countSql, queryParams);
  const total = Number(countRows[0]?.total ?? 0);
  const totalPages = Math.ceil(total / pageSize) || 0;

  if (total === 0) {
    return {
      products: [],
      pagination: { page, pageSize, total: 0, totalPages: 0 },
    };
  }

  // 2. Sorting
  let orderBy = "p.created_at DESC";
  switch (filters.sort) {
    case "price-asc":
      orderBy = "p.price ASC, p.created_at DESC";
      break;
    case "price-desc":
      orderBy = "p.price DESC, p.created_at DESC";
      break;
    case "featured":
      orderBy = "p.is_featured DESC, p.created_at DESC";
      break;
    case "newest":
    default:
      orderBy = "p.created_at DESC";
      break;
  }

  // 3. Data query
  const dataSql = `
    SELECT p.*, c.name AS category_name, c.slug AS category_slug, c.description AS category_description
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    ${whereClause}
    ORDER BY ${orderBy}
    LIMIT ? OFFSET ?
  `;
  const dataParams = [...queryParams, pageSize, offset];
  const productRows = await query<any[]>(dataSql, dataParams);

  if (!productRows || productRows.length === 0) {
    return {
      products: [],
      pagination: { page, pageSize, total, totalPages },
    };
  }

  const productIds = productRows.map((r) => r.id);

  // Batch query images and variants for retrieved products
  const placeholders = productIds.map(() => "?").join(", ");
  const [imagesRows, variantsRows] = await Promise.all([
    query<any[]>(
      `SELECT * FROM product_images WHERE product_id IN (${placeholders}) ORDER BY sort_order ASC, created_at ASC`,
      productIds
    ),
    query<any[]>(
      `SELECT * FROM product_variants WHERE product_id IN (${placeholders}) ORDER BY created_at ASC`,
      productIds
    ),
  ]);

  const imagesByProductId = new Map<string, ProductImage[]>();
  for (const row of imagesRows || []) {
    const img = toProductImage(row);
    if (!imagesByProductId.has(img.productId)) {
      imagesByProductId.set(img.productId, []);
    }
    imagesByProductId.get(img.productId)!.push(img);
  }

  const variantsByProductId = new Map<string, ProductVariant[]>();
  for (const row of variantsRows || []) {
    const v = toProductVariant(row);
    if (!variantsByProductId.has(v.productId)) {
      variantsByProductId.set(v.productId, []);
    }
    variantsByProductId.get(v.productId)!.push(v);
  }

  const products = productRows.map((row) => {
    const category: ProductCategoryInfo | null = row.category_id
      ? {
          id: row.category_id,
          name: row.category_name,
          slug: row.category_slug,
          description: row.category_description ?? null,
        }
      : null;
    return toProduct(
      row,
      category,
      imagesByProductId.get(row.id) || [],
      variantsByProductId.get(row.id) || []
    );
  });

  return {
    products,
    pagination: {
      page,
      pageSize,
      total,
      totalPages,
    },
  };
}

/**
 * Creates a new product with associated images and variants inside a managed transaction.
 */
export async function createProduct(input: CreateProductInput): Promise<Product> {
  const id = input.id?.trim() || crypto.randomUUID();
  const name = input.name?.trim();
  if (!name || name.length < 2 || name.length > 255) {
    throw new ProductValidationError("Product name is required (2–255 characters)", 400);
  }

  const slug = input.slug ? input.slug.trim().toLowerCase() : generateSlug(name);
  validateSlug(slug);

  if (typeof input.description !== "string" || input.description.trim().length === 0) {
    throw new ProductValidationError("Product description is required", 400);
  }
  const description = input.description.trim();

  if (typeof input.price !== "number" || isNaN(input.price) || input.price < 0) {
    throw new ProductValidationError("Product price must be a valid non-negative number", 400);
  }
  const price = input.price;

  let compareAtPrice: number | null = null;
  if (input.compareAtPrice !== undefined && input.compareAtPrice !== null) {
    if (typeof input.compareAtPrice !== "number" || isNaN(input.compareAtPrice) || input.compareAtPrice < 0) {
      throw new ProductValidationError("Compare at price must be a valid non-negative number or null", 400);
    }
    compareAtPrice = input.compareAtPrice;
  }

  if (typeof input.stockQuantity !== "number" || !Number.isInteger(input.stockQuantity) || input.stockQuantity < 0) {
    throw new ProductValidationError("Stock quantity must be a non-negative integer", 400);
  }
  const stockQuantity = input.stockQuantity;

  const isFeatured = Boolean(input.isFeatured);
  const isActive = input.isActive !== undefined ? Boolean(input.isActive) : true;

  await withTransaction(async (conn: PoolConnection) => {
    // Check slug uniqueness
    const [existingSlug] = await conn.execute(
      "SELECT id FROM products WHERE slug = ? LIMIT 1",
      [slug]
    );
    if ((existingSlug as any[]).length > 0) {
      throw new ProductValidationError(`A product with slug '${slug}' already exists`, 409);
    }

    // Verify category exists if provided
    let categoryId: string | null = null;
    if (input.categoryId && input.categoryId.trim()) {
      const cleanCatId = input.categoryId.trim();
      const [catRows] = await conn.execute(
        "SELECT id FROM categories WHERE id = ? OR slug = ? OR name = ? LIMIT 1",
        [cleanCatId, cleanCatId, cleanCatId]
      );
      if ((catRows as any[]).length === 0) {
        throw new ProductValidationError(`Referenced category '${cleanCatId}' does not exist`, 400);
      }
      categoryId = (catRows as any[])[0].id;
    }

    // Insert Product row
    const insertProductSql = `
      INSERT INTO products (
        id, category_id, name, slug, description, price, compare_at_price,
        stock_quantity, is_featured, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    await conn.execute(insertProductSql, [
      id,
      categoryId,
      name,
      slug,
      description,
      price,
      compareAtPrice,
      stockQuantity,
      isFeatured ? 1 : 0,
      isActive ? 1 : 0,
    ]);

    // Insert Images if provided
    if (input.images && Array.isArray(input.images)) {
      for (let i = 0; i < input.images.length; i++) {
        const img = input.images[i];
        if (!img.storagePath || typeof img.storagePath !== "string") {
          throw new ProductValidationError("Each image must have a valid storagePath", 400);
        }
        const imgId = img.id?.trim() || crypto.randomUUID();
        const sortOrder = img.sortOrder !== undefined ? img.sortOrder : i;
        await conn.execute(
          "INSERT INTO product_images (id, product_id, storage_path, alt_text, sort_order) VALUES (?, ?, ?, ?, ?)",
          [imgId, id, img.storagePath.trim(), img.altText?.trim() || null, sortOrder]
        );
      }
    }

    // Insert Variants if provided
    if (input.variants && Array.isArray(input.variants)) {
      for (const v of input.variants) {
        if (!v.name || typeof v.name !== "string" || v.name.trim().length === 0) {
          throw new ProductValidationError("Variant name is required", 400);
        }
        if (!v.sku || typeof v.sku !== "string" || v.sku.trim().length === 0) {
          throw new ProductValidationError("Variant SKU is required", 400);
        }
        const sku = v.sku.trim();
        // Check SKU uniqueness
        const [existingSku] = await conn.execute(
          "SELECT id FROM product_variants WHERE sku = ? LIMIT 1",
          [sku]
        );
        if ((existingSku as any[]).length > 0) {
          throw new ProductValidationError(`Variant SKU '${sku}' already exists`, 409);
        }

        const vPrice = v.price !== undefined && v.price !== null ? v.price : null;
        if (vPrice !== null && (typeof vPrice !== "number" || isNaN(vPrice) || vPrice < 0)) {
          throw new ProductValidationError("Variant price must be non-negative or null", 400);
        }

        const vStock = v.stockQuantity !== undefined ? v.stockQuantity : 0;
        if (typeof vStock !== "number" || !Number.isInteger(vStock) || vStock < 0) {
          throw new ProductValidationError("Variant stock quantity must be a non-negative integer", 400);
        }

        const varId = v.id?.trim() || crypto.randomUUID();
        await conn.execute(
          "INSERT INTO product_variants (id, product_id, name, sku, price, stock_quantity, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)",
          [varId, id, v.name.trim(), sku, vPrice, vStock, v.isActive !== false ? 1 : 0]
        );
      }
    }
  });

  // Fetch and return the fully populated created product after transaction commits
  const created = await findProductById(id, true);
  if (!created) {
    throw new Error("Failed to retrieve product immediately after creation");
  }
  return created;
}

/**
 * Updates an existing product and optionally replaces its images or variants inside a transaction.
 */
export async function updateProduct(
  id: string,
  input: UpdateProductInput
): Promise<Product | null> {
  const cleanId = id?.trim();
  if (!cleanId) return null;

  const exists = await withTransaction(async (conn: PoolConnection) => {
    // Verify product exists
    const [existingRows] = await conn.execute(
      "SELECT * FROM products WHERE id = ? LIMIT 1",
      [cleanId]
    );
    if ((existingRows as any[]).length === 0) {
      return false;
    }
    const current = (existingRows as any[])[0];

    const fields: string[] = [];
    const values: any[] = [];

    // Name update
    if (input.name !== undefined) {
      const name = input.name.trim();
      if (name.length < 2 || name.length > 255) {
        throw new ProductValidationError("Product name must be between 2 and 255 characters", 400);
      }
      fields.push("name = ?");
      values.push(name);
    }

    // Slug update
    if (input.slug !== undefined) {
      const slug = input.slug.trim().toLowerCase();
      validateSlug(slug);
      if (slug !== current.slug) {
        const [existingSlug] = await conn.execute(
          "SELECT id FROM products WHERE slug = ? AND id != ? LIMIT 1",
          [slug, cleanId]
        );
        if ((existingSlug as any[]).length > 0) {
          throw new ProductValidationError(`A product with slug '${slug}' already exists`, 409);
        }
      }
      fields.push("slug = ?");
      values.push(slug);
    }

    // Description update
    if (input.description !== undefined) {
      fields.push("description = ?");
      values.push(input.description.trim());
    }

    // Price update
    if (input.price !== undefined) {
      if (typeof input.price !== "number" || isNaN(input.price) || input.price < 0) {
        throw new ProductValidationError("Product price must be a valid non-negative number", 400);
      }
      fields.push("price = ?");
      values.push(input.price);
    }

    // Compare at price update
    if (input.compareAtPrice !== undefined) {
      if (input.compareAtPrice !== null && (typeof input.compareAtPrice !== "number" || isNaN(input.compareAtPrice) || input.compareAtPrice < 0)) {
        throw new ProductValidationError("Compare at price must be non-negative or null", 400);
      }
      fields.push("compare_at_price = ?");
      values.push(input.compareAtPrice);
    }

    // Stock quantity update
    if (input.stockQuantity !== undefined) {
      if (typeof input.stockQuantity !== "number" || !Number.isInteger(input.stockQuantity) || input.stockQuantity < 0) {
        throw new ProductValidationError("Stock quantity must be a non-negative integer", 400);
      }
      fields.push("stock_quantity = ?");
      values.push(input.stockQuantity);
    }

    // Category ID update
    if (input.categoryId !== undefined) {
      if (input.categoryId !== null && input.categoryId.trim() !== "") {
        const catId = input.categoryId.trim();
        const [catRows] = await conn.execute(
          "SELECT id FROM categories WHERE id = ? OR slug = ? OR name = ? LIMIT 1",
          [catId, catId, catId]
        );
        if ((catRows as any[]).length === 0) {
          throw new ProductValidationError(`Referenced category '${catId}' does not exist`, 400);
        }
        fields.push("category_id = ?");
        values.push((catRows as any[])[0].id);
      } else {
        fields.push("category_id = NULL");
      }
    }

    // Featured toggle
    if (input.isFeatured !== undefined) {
      fields.push("is_featured = ?");
      values.push(input.isFeatured ? 1 : 0);
    }

    // Active toggle
    if (input.isActive !== undefined) {
      fields.push("is_active = ?");
      values.push(input.isActive ? 1 : 0);
    }

    if (fields.length > 0) {
      values.push(cleanId);
      const updateSql = `UPDATE products SET ${fields.join(", ")} WHERE id = ?`;
      await conn.execute(updateSql, values);
    }

    // Replace images if an images array was provided
    if (input.images !== undefined && Array.isArray(input.images)) {
      await conn.execute("DELETE FROM product_images WHERE product_id = ?", [cleanId]);
      for (let i = 0; i < input.images.length; i++) {
        const img = input.images[i];
        if (!img.storagePath || typeof img.storagePath !== "string") {
          throw new ProductValidationError("Each image must have a valid storagePath", 400);
        }
        const imgId = img.id?.trim() || crypto.randomUUID();
        const sortOrder = img.sortOrder !== undefined ? img.sortOrder : i;
        await conn.execute(
          "INSERT INTO product_images (id, product_id, storage_path, alt_text, sort_order) VALUES (?, ?, ?, ?, ?)",
          [imgId, cleanId, img.storagePath.trim(), img.altText?.trim() || null, sortOrder]
        );
      }
    }

    // Replace variants if a variants array was provided
    if (input.variants !== undefined && Array.isArray(input.variants)) {
      await conn.execute("DELETE FROM product_variants WHERE product_id = ?", [cleanId]);
      for (const v of input.variants) {
        if (!v.name || typeof v.name !== "string" || v.name.trim().length === 0) {
          throw new ProductValidationError("Variant name is required", 400);
        }
        if (!v.sku || typeof v.sku !== "string" || v.sku.trim().length === 0) {
          throw new ProductValidationError("Variant SKU is required", 400);
        }
        const sku = v.sku.trim();
        const [existingSku] = await conn.execute(
          "SELECT id FROM product_variants WHERE sku = ? AND product_id != ? LIMIT 1",
          [sku, cleanId]
        );
        if ((existingSku as any[]).length > 0) {
          throw new ProductValidationError(`Variant SKU '${sku}' already exists`, 409);
        }

        const vPrice = v.price !== undefined && v.price !== null ? v.price : null;
        if (vPrice !== null && (typeof vPrice !== "number" || isNaN(vPrice) || vPrice < 0)) {
          throw new ProductValidationError("Variant price must be non-negative or null", 400);
        }

        const vStock = v.stockQuantity !== undefined ? v.stockQuantity : 0;
        if (typeof vStock !== "number" || !Number.isInteger(vStock) || vStock < 0) {
          throw new ProductValidationError("Variant stock quantity must be a non-negative integer", 400);
        }

        const varId = v.id?.trim() || crypto.randomUUID();
        await conn.execute(
          "INSERT INTO product_variants (id, product_id, name, sku, price, stock_quantity, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)",
          [varId, cleanId, v.name.trim(), sku, vPrice, vStock, v.isActive !== false ? 1 : 0]
        );
      }
    }

    return true;
  });

  if (!exists) {
    return null;
  }

  return await findProductById(cleanId, true);
}

/**
 * Performs a safe soft deactivation of a product (sets is_active = 0).
 * Preserves historical orders and relational integrity.
 */
export async function deactivateProduct(id: string): Promise<boolean> {
  const cleanId = id?.trim();
  if (!cleanId) return false;

  const res = await query<any>(
    "UPDATE products SET is_active = 0 WHERE id = ?",
    [cleanId]
  );
  return Boolean(res && (res as any).affectedRows > 0);
}
