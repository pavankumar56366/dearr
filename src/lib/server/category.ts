import "server-only";
import crypto from "crypto";
import { query } from "./db";

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  isActive: boolean;
  productCount?: number;
  activeProductCount?: number;
  viewCount?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateCategoryInput {
  name: string;
  slug?: string;
  description?: string | null;
  isActive?: boolean;
}

export interface UpdateCategoryInput {
  name?: string;
  slug?: string;
  description?: string | null;
  isActive?: boolean;
}

export interface CategoryListFilters {
  isActive?: boolean;
  search?: string;
  includeProductCounts?: boolean;
}

// ---------------------------------------------------------------------------
// Validation Error
// ---------------------------------------------------------------------------

export class CategoryValidationError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = "CategoryValidationError";
    this.statusCode = statusCode;
  }
}

// ---------------------------------------------------------------------------
// Slug helpers (consistent with product.ts)
// ---------------------------------------------------------------------------

/**
 * Normalizes a category name to a URL-friendly slug.
 */
export function generateCategorySlug(name: string): string {
  const slug = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || `category-${crypto.randomUUID().slice(0, 8)}`;
}

/**
 * Validates a slug format. Must be URL-safe (lowercase alphanumeric + hyphens).
 */
export function validateCategorySlug(slug: string): void {
  if (!slug || typeof slug !== "string") {
    throw new CategoryValidationError("Slug must be a non-empty string", 400);
  }
  const clean = slug.trim().toLowerCase();
  if (clean.length < 2 || clean.length > 150) {
    throw new CategoryValidationError("Slug must be between 2 and 150 characters", 400);
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(clean)) {
    throw new CategoryValidationError(
      "Invalid slug format: Only lowercase alphanumeric characters and single hyphens are allowed",
      400
    );
  }
}

// ---------------------------------------------------------------------------
// Row mapper
// ---------------------------------------------------------------------------

/**
 * Maps raw database row to a sanitized Category object.
 */
function toCategory(row: any): Category {
  const cat: Category = {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description ?? null,
    isActive: Boolean(row.is_active),
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };

  // Attach product counts if joined
  if (row.product_count !== undefined) {
    cat.productCount = Number(row.product_count);
  }
  if (row.active_product_count !== undefined) {
    cat.activeProductCount = Number(row.active_product_count);
  }
  if (row.view_count !== undefined) {
    cat.viewCount = Number(row.view_count);
  }

  return cat;
}

// ---------------------------------------------------------------------------
// Read operations
// ---------------------------------------------------------------------------

/**
 * Finds a single category by primary key UUID.
 */
export async function findCategoryById(
  id: string,
  includeInactive = false
): Promise<Category | null> {
  const cleanId = id?.trim();
  if (!cleanId) return null;

  let sql = `SELECT * FROM categories WHERE id = ?`;
  const params: any[] = [cleanId];

  if (!includeInactive) {
    sql += " AND is_active = 1";
  }

  sql += " LIMIT 1";

  const rows = await query<any[]>(sql, params);
  if (!rows || rows.length === 0) {
    return null;
  }

  return toCategory(rows[0]);
}

/**
 * Finds a single category by unique URL slug.
 */
export async function findCategoryBySlug(
  slug: string,
  includeInactive = false
): Promise<Category | null> {
  const cleanSlug = slug?.trim().toLowerCase();
  if (!cleanSlug) return null;

  let sql = `SELECT * FROM categories WHERE slug = ?`;
  const params: any[] = [cleanSlug];

  if (!includeInactive) {
    sql += " AND is_active = 1";
  }

  sql += " LIMIT 1";

  const rows = await query<any[]>(sql, params);
  if (!rows || rows.length === 0) {
    return null;
  }

  return toCategory(rows[0]);
}

/**
 * Lists categories matching filter criteria.
 * Optionally enriches with product counts.
 */
export async function listCategories(
  filters: CategoryListFilters = {}
): Promise<Category[]> {
  const whereConditions: string[] = [];
  const queryParams: any[] = [];

  // Active status filter
  if (filters.isActive !== undefined) {
    whereConditions.push("c.is_active = ?");
    queryParams.push(filters.isActive ? 1 : 0);
  }

  // Search keyword (matches name, slug, or description)
  if (filters.search && filters.search.trim()) {
    whereConditions.push("(c.name LIKE ? OR c.slug LIKE ? OR c.description LIKE ?)");
    const searchTerm = `%${filters.search.trim()}%`;
    queryParams.push(searchTerm, searchTerm, searchTerm);
  }

  const whereClause = whereConditions.length > 0
    ? `WHERE ${whereConditions.join(" AND ")}`
    : "";

  if (filters.includeProductCounts) {
    // LEFT JOIN products to compute product counts
    const sql = `
      SELECT c.*,
        COUNT(p.id) AS product_count,
        SUM(CASE WHEN p.is_active = 1 THEN 1 ELSE 0 END) AS active_product_count
      FROM categories c
      LEFT JOIN products p ON p.category_id = c.id
      ${whereClause}
      GROUP BY c.id
      ORDER BY c.name ASC
    `;
    const rows = await query<any[]>(sql, queryParams);
    return (rows || []).map(toCategory);
  }

  const sql = `
    SELECT c.*
    FROM categories c
    ${whereClause}
    ORDER BY c.name ASC
  `;
  const rows = await query<any[]>(sql, queryParams);
  return (rows || []).map(toCategory);
}

// ---------------------------------------------------------------------------
// Write operations
// ---------------------------------------------------------------------------

/**
 * Creates a new category in MySQL.
 * Validates input and checks slug uniqueness.
 */
export async function createCategory(
  input: CreateCategoryInput
): Promise<Category> {
  const id = crypto.randomUUID();

  // Name validation
  const name = input.name?.trim();
  if (!name || name.length < 2 || name.length > 150) {
    throw new CategoryValidationError("Category name is required (2–150 characters)", 400);
  }

  // Slug: provided or auto-generated from name
  const slug = input.slug ? input.slug.trim().toLowerCase() : generateCategorySlug(name);
  validateCategorySlug(slug);

  // Slug uniqueness check
  const existingRows = await query<any[]>(
    "SELECT id FROM categories WHERE slug = ? LIMIT 1",
    [slug]
  );
  if (existingRows && existingRows.length > 0) {
    throw new CategoryValidationError(`A category with slug '${slug}' already exists`, 409);
  }

  // Description validation
  let description: string | null = null;
  if (input.description !== undefined && input.description !== null) {
    const desc = input.description.trim();
    if (desc.length > 0) {
      if (desc.length > 1000) {
        throw new CategoryValidationError("Description cannot exceed 1000 characters", 400);
      }
      description = desc;
    }
  }

  const isActive = input.isActive !== undefined ? Boolean(input.isActive) : true;

  // Insert
  await query<any>(
    `INSERT INTO categories (id, name, slug, description, is_active) VALUES (?, ?, ?, ?, ?)`,
    [id, name, slug, description, isActive ? 1 : 0]
  );

  // Fetch and return the created category
  const created = await findCategoryById(id, true);
  if (!created) {
    throw new Error("Failed to retrieve category immediately after creation");
  }
  return created;
}

/**
 * Updates an existing category in MySQL.
 * Validates input and checks slug uniqueness (excluding self).
 */
export async function updateCategory(
  id: string,
  input: UpdateCategoryInput
): Promise<Category | null> {
  const cleanId = id?.trim();
  if (!cleanId) return null;

  // Verify category exists
  const existingRows = await query<any[]>(
    "SELECT * FROM categories WHERE id = ? LIMIT 1",
    [cleanId]
  );
  if (!existingRows || existingRows.length === 0) {
    return null;
  }
  const current = existingRows[0];

  const fields: string[] = [];
  const values: any[] = [];

  // Name update
  if (input.name !== undefined) {
    const name = input.name.trim();
    if (name.length < 2 || name.length > 150) {
      throw new CategoryValidationError("Category name must be between 2 and 150 characters", 400);
    }
    fields.push("name = ?");
    values.push(name);
  }

  // Slug update
  if (input.slug !== undefined) {
    const slug = input.slug.trim().toLowerCase();
    validateCategorySlug(slug);
    if (slug !== current.slug) {
      // Check uniqueness against other categories
      const slugRows = await query<any[]>(
        "SELECT id FROM categories WHERE slug = ? AND id != ? LIMIT 1",
        [slug, cleanId]
      );
      if (slugRows && slugRows.length > 0) {
        throw new CategoryValidationError(`A category with slug '${slug}' already exists`, 409);
      }
    }
    fields.push("slug = ?");
    values.push(slug);
  }

  // Description update
  if (input.description !== undefined) {
    if (input.description === null) {
      fields.push("description = NULL");
    } else {
      const desc = input.description.trim();
      if (desc.length > 1000) {
        throw new CategoryValidationError("Description cannot exceed 1000 characters", 400);
      }
      fields.push("description = ?");
      values.push(desc.length > 0 ? desc : null);
    }
  }

  // isActive update
  if (input.isActive !== undefined) {
    fields.push("is_active = ?");
    values.push(input.isActive ? 1 : 0);
  }

  if (fields.length === 0) {
    // Nothing to update, return current state
    return toCategory(current);
  }

  values.push(cleanId);
  const updateSql = `UPDATE categories SET ${fields.join(", ")} WHERE id = ?`;
  await query<any>(updateSql, values);

  return await findCategoryById(cleanId, true);
}

/**
 * Records a customer browsing view for a category with deduplication.
 * Rate/duplication protection: Ignores views from the same session_hash within 30 minutes.
 * If category_views table does not exist yet (pending production migration), fails silently.
 */
export async function recordCategoryView(
  categoryId: string,
  sessionHash?: string
): Promise<boolean> {
  if (!categoryId || typeof categoryId !== "string") return false;
  const cleanId = categoryId.trim();

  try {
    // 1. Verify category exists and is active
    const catRows = await query<any[]>(
      "SELECT id FROM categories WHERE (id = ? OR slug = ?) AND is_active = 1 LIMIT 1",
      [cleanId, cleanId]
    );
    if (!catRows || catRows.length === 0) return false;
    const resolvedId = catRows[0].id;

    // 2. Check deduplication window (30 minutes) if sessionHash provided
    if (sessionHash) {
      const cleanHash = sessionHash.trim().slice(0, 64);
      const recent = await query<any[]>(
        `SELECT id FROM category_views
         WHERE category_id = ? AND session_hash = ? AND viewed_at >= DATE_SUB(NOW(), INTERVAL 30 MINUTE)
         LIMIT 1`,
        [resolvedId, cleanHash]
      );
      if (recent && recent.length > 0) {
        return false; // Deduplicated
      }

      await query(
        `INSERT INTO category_views (id, category_id, viewed_at, session_hash) VALUES (?, ?, NOW(), ?)`,
        [crypto.randomUUID(), resolvedId, cleanHash]
      );
    } else {
      await query(
        `INSERT INTO category_views (id, category_id, viewed_at, session_hash) VALUES (?, ?, NOW(), NULL)`,
        [crypto.randomUUID(), resolvedId]
      );
    }
    return true;
  } catch (err: any) {
    // Graceful fallback if table does not exist or migration is pending
    if (err?.code === "ER_NO_SUCH_TABLE" || err?.errno === 1146 || String(err).includes("doesn't exist")) {
      return false;
    }
    console.warn("[recordCategoryView] Non-fatal error recording view:", err?.message || err);
    return false;
  }
}

/**
 * Retrieves the top popular categories by genuine browsing activity.
 * Returns at most `limit` active categories.
 * Falls back deterministically to active categories if metrics table is absent or empty.
 */
export async function getPopularCategories(limit = 3, days = 30): Promise<Category[]> {
  const safeLimit = Math.max(1, Math.min(limit, 10));
  const safeDays = Math.max(1, Math.min(days, 365));

  try {
    const sql = `
      SELECT c.*, COUNT(cv.id) AS view_count
      FROM categories c
      INNER JOIN category_views cv ON cv.category_id = c.id
      WHERE c.is_active = 1
        AND cv.viewed_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
      GROUP BY c.id
      ORDER BY view_count DESC, c.name ASC
      LIMIT ?
    `;
    const rows = await query<any[]>(sql, [safeDays, safeLimit]);
    if (rows && rows.length > 0) {
      const categories = rows.map(toCategory);
      if (categories.length >= safeLimit) {
        return categories.slice(0, safeLimit);
      }
      // Fill remaining deterministically with other active categories
      const existingIds = new Set(categories.map((c) => c.id));
      const remainingLimit = safeLimit - categories.length;
      const allActive = await listCategories({ isActive: true });
      const fill = allActive.filter((c) => !existingIds.has(c.id)).slice(0, remainingLimit);
      return [...categories, ...fill];
    }
  } catch (err: any) {
    // If category_views table doesn't exist, proceed to deterministic fallback
    if (err?.code !== "ER_NO_SUCH_TABLE" && err?.errno !== 1146 && !String(err).includes("doesn't exist")) {
      console.warn("[getPopularCategories] Non-fatal error querying metrics:", err?.message || err);
    }
  }

  // Deterministic fallback: active categories ordered alphabetically
  const fallback = await listCategories({ isActive: true });
  return fallback.slice(0, safeLimit);
}
