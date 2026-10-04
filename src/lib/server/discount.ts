import "server-only";
import crypto from "crypto";
import { query, withTransaction } from "./db";

// ---------------------------------------------------------------------------
// Types & Interfaces
// ---------------------------------------------------------------------------

export type DiscountType = "percentage" | "fixed_amount";
export type DiscountScope = "store" | "category" | "product";
export type DiscountDerivedStatus =
  | "active"
  | "scheduled"
  | "expired"
  | "deactivated"
  | "draft";

export interface Discount {
  id: string;
  name: string;
  code: string | null;
  discountType: DiscountType;
  value: number;
  scope: DiscountScope;
  startAt: Date;
  endAt: Date | null;
  isActive: boolean;
  status: DiscountDerivedStatus;
  productIds?: string[];
  categoryIds?: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateDiscountInput {
  name: string;
  code?: string | null;
  discountType: DiscountType;
  value: number;
  scope: DiscountScope;
  startAt: string | Date;
  endAt?: string | Date | null;
  isActive?: boolean;
  categoryId?: string;
  categoryIds?: string[];
  productId?: string;
  productIds?: string[];
}

export interface UpdateDiscountInput {
  name?: string;
  code?: string | null;
  discountType?: DiscountType;
  value?: number;
  scope?: DiscountScope;
  startAt?: string | Date;
  endAt?: string | Date | null;
  isActive?: boolean;
  categoryId?: string;
  categoryIds?: string[];
  productId?: string;
  productIds?: string[];
}

export interface DiscountListFilters {
  isActive?: boolean;
  scope?: DiscountScope;
  discountType?: DiscountType;
  search?: string;
  status?: DiscountDerivedStatus | "all";
}

export interface ApplicableDiscountResult {
  discount: Discount;
  discountAmount: number;
  finalPrice: number;
  precedence: "product" | "category" | "store";
}

// ---------------------------------------------------------------------------
// Error Class
// ---------------------------------------------------------------------------

export class DiscountValidationError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = "DiscountValidationError";
    this.statusCode = statusCode;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Format Date to MySQL DATETIME format string (YYYY-MM-DD HH:mm:ss)
 */
export function formatMysqlDateTime(d: Date): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  const seconds = pad(d.getSeconds());
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

/**
 * Compute derived discount status based on is_active and validity dates.
 */
export function computeDiscountStatus(
  isActive: boolean,
  startAt: Date,
  endAt: Date | null,
  now: Date = new Date()
): DiscountDerivedStatus {
  if (!isActive) {
    return "deactivated";
  }

  const nowMs = now.getTime();
  const startMs = startAt.getTime();

  if (nowMs < startMs) {
    return "scheduled";
  }

  if (endAt !== null && nowMs >= endAt.getTime()) {
    return "expired";
  }

  return "active";
}

/**
 * Normalize and validate coupon code string.
 */
export function normalizeDiscountCode(code: string | null | undefined): string | null {
  if (code === undefined || code === null) return null;
  const trimmed = code.trim().toUpperCase();
  if (trimmed.length === 0) return null;

  if (trimmed.length < 2 || trimmed.length > 50) {
    throw new DiscountValidationError(
      "Discount code must be between 2 and 50 characters",
      400
    );
  }

  if (!/^[A-Z0-9_-]+$/.test(trimmed)) {
    throw new DiscountValidationError(
      "Discount code may only contain uppercase alphanumeric characters, hyphens, and underscores",
      400
    );
  }

  return trimmed;
}

/**
 * Map raw database row to sanitized Discount object.
 */
function toDiscount(
  row: any,
  productIds: string[] = [],
  categoryIds: string[] = []
): Discount {
  const startAt = new Date(row.start_at);
  const endAt = row.end_at ? new Date(row.end_at) : null;
  const isActive = Boolean(row.is_active);

  return {
    id: row.id,
    name: row.name,
    code: row.code ?? null,
    discountType: row.discount_type as DiscountType,
    value: parseFloat(row.value),
    scope: row.scope as DiscountScope,
    startAt,
    endAt,
    isActive,
    status: computeDiscountStatus(isActive, startAt, endAt),
    productIds,
    categoryIds,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

/**
 * Verify that referenced categories exist in MySQL.
 */
async function verifyCategoriesExist(categoryIds: string[]): Promise<void> {
  if (categoryIds.length === 0) return;
  const placeholders = categoryIds.map(() => "?").join(", ");
  const rows = await query<any[]>(
    `SELECT id FROM categories WHERE id IN (${placeholders})`,
    categoryIds
  );
  const foundIds = new Set((rows || []).map((r) => r.id));
  for (const id of categoryIds) {
    if (!foundIds.has(id)) {
      throw new DiscountValidationError(
        `Referenced category with ID '${id}' does not exist`,
        400
      );
    }
  }
}

/**
 * Verify that referenced products exist in MySQL.
 */
async function verifyProductsExist(productIds: string[]): Promise<void> {
  if (productIds.length === 0) return;
  const placeholders = productIds.map(() => "?").join(", ");
  const rows = await query<any[]>(
    `SELECT id FROM products WHERE id IN (${placeholders})`,
    productIds
  );
  const foundIds = new Set((rows || []).map((r) => r.id));
  for (const id of productIds) {
    if (!foundIds.has(id)) {
      throw new DiscountValidationError(
        `Referenced product with ID '${id}' does not exist`,
        400
      );
    }
  }
}

/**
 * Check for overlapping conflicts for discounts of the SAME scope and target.
 * Rejects with 409 Conflict if another active/scheduled discount overlaps the date range.
 */
async function checkOverlapConflict(
  scope: DiscountScope,
  startAt: Date,
  endAt: Date | null,
  targetIds: string[],
  excludeDiscountId?: string
): Promise<void> {
  const startStr = formatMysqlDateTime(startAt);
  const endStr = endAt ? formatMysqlDateTime(endAt) : null;

  // An overlap exists if:
  // (existing.end_at IS NULL OR existing.end_at > newStart) AND (newEnd IS NULL OR existing.start_at < newEnd)
  let overlapTimeCondition: string;
  let timeParams: any[];

  if (endStr) {
    overlapTimeCondition = `(d.end_at IS NULL OR d.end_at > ?) AND (d.start_at < ?)`;
    timeParams = [startStr, endStr];
  } else {
    overlapTimeCondition = `(d.end_at IS NULL OR d.end_at > ?)`;
    timeParams = [startStr];
  }

  const excludeCondition = excludeDiscountId ? `AND d.id != ?` : "";
  const excludeParams = excludeDiscountId ? [excludeDiscountId] : [];

  if (scope === "store") {
    const sql = `
      SELECT d.id, d.name, d.code
      FROM discounts d
      WHERE d.scope = 'store'
        AND d.is_active = 1
        AND ${overlapTimeCondition}
        ${excludeCondition}
      LIMIT 1
    `;
    const rows = await query<any[]>(sql, [...timeParams, ...excludeParams]);
    if (rows && rows.length > 0) {
      throw new DiscountValidationError(
        `An active or scheduled store-wide discount ('${rows[0].name}') already overlaps with the specified date range`,
        409
      );
    }
  } else if (scope === "category") {
    if (targetIds.length === 0) return;
    const placeholders = targetIds.map(() => "?").join(", ");
    const sql = `
      SELECT d.id, d.name, dc.category_id
      FROM discounts d
      JOIN discount_categories dc ON dc.discount_id = d.id
      WHERE d.scope = 'category'
        AND d.is_active = 1
        AND dc.category_id IN (${placeholders})
        AND ${overlapTimeCondition}
        ${excludeCondition}
      LIMIT 1
    `;
    const rows = await query<any[]>(sql, [...targetIds, ...timeParams, ...excludeParams]);
    if (rows && rows.length > 0) {
      throw new DiscountValidationError(
        `An active or scheduled category discount ('${rows[0].name}') for this category already overlaps with the specified date range`,
        409
      );
    }
  } else if (scope === "product") {
    if (targetIds.length === 0) return;
    const placeholders = targetIds.map(() => "?").join(", ");
    const sql = `
      SELECT d.id, d.name, dp.product_id
      FROM discounts d
      JOIN discount_products dp ON dp.discount_id = d.id
      WHERE d.scope = 'product'
        AND d.is_active = 1
        AND dp.product_id IN (${placeholders})
        AND ${overlapTimeCondition}
        ${excludeCondition}
      LIMIT 1
    `;
    const rows = await query<any[]>(sql, [...targetIds, ...timeParams, ...excludeParams]);
    if (rows && rows.length > 0) {
      throw new DiscountValidationError(
        `An active or scheduled product discount ('${rows[0].name}') for this product already overlaps with the specified date range`,
        409
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Read Operations
// ---------------------------------------------------------------------------

/**
 * Fetch a single discount by ID with its assigned productIds and categoryIds.
 */
export async function findDiscountById(id: string): Promise<Discount | null> {
  const cleanId = id?.trim();
  if (!cleanId) return null;

  const rows = await query<any[]>(
    "SELECT * FROM discounts WHERE id = ? LIMIT 1",
    [cleanId]
  );
  if (!rows || rows.length === 0) {
    return null;
  }

  const [productRows, categoryRows] = await Promise.all([
    query<any[]>(
      "SELECT product_id FROM discount_products WHERE discount_id = ?",
      [cleanId]
    ),
    query<any[]>(
      "SELECT category_id FROM discount_categories WHERE discount_id = ?",
      [cleanId]
    ),
  ]);

  const productIds = (productRows || []).map((r) => r.product_id);
  const categoryIds = (categoryRows || []).map((r) => r.category_id);

  return toDiscount(rows[0], productIds, categoryIds);
}

/**
 * Fetch a single discount by code with its assigned productIds and categoryIds.
 */
export async function findDiscountByCode(code: string): Promise<Discount | null> {
  const cleanCode = code?.trim().toUpperCase();
  if (!cleanCode) return null;

  const rows = await query<any[]>(
    "SELECT * FROM discounts WHERE UPPER(code) = ? LIMIT 1",
    [cleanCode]
  );
  if (!rows || rows.length === 0) {
    return null;
  }

  const discountId = rows[0].id;
  const [productRows, categoryRows] = await Promise.all([
    query<any[]>(
      "SELECT product_id FROM discount_products WHERE discount_id = ?",
      [discountId]
    ),
    query<any[]>(
      "SELECT category_id FROM discount_categories WHERE discount_id = ?",
      [discountId]
    ),
  ]);

  const productIds = (productRows || []).map((r) => r.product_id);
  const categoryIds = (categoryRows || []).map((r) => r.category_id);

  return toDiscount(rows[0], productIds, categoryIds);
}

/**
 * List discounts based on filter criteria.
 * Enriches each discount with productIds and categoryIds.
 */
export async function listDiscounts(
  filters: DiscountListFilters = {}
): Promise<Discount[]> {
  const whereConditions: string[] = [];
  const queryParams: any[] = [];

  if (filters.isActive !== undefined) {
    whereConditions.push("d.is_active = ?");
    queryParams.push(filters.isActive ? 1 : 0);
  }

  if (filters.scope && filters.scope !== ("all" as any)) {
    whereConditions.push("d.scope = ?");
    queryParams.push(filters.scope);
  }

  if (filters.discountType && filters.discountType !== ("all" as any)) {
    whereConditions.push("d.discount_type = ?");
    queryParams.push(filters.discountType);
  }

  if (filters.search && filters.search.trim()) {
    whereConditions.push("(d.name LIKE ? OR d.code LIKE ?)");
    const searchTerm = `%${filters.search.trim()}%`;
    queryParams.push(searchTerm, searchTerm);
  }

  const whereClause =
    whereConditions.length > 0 ? `WHERE ${whereConditions.join(" AND ")}` : "";

  const sql = `
    SELECT d.*
    FROM discounts d
    ${whereClause}
    ORDER BY d.created_at DESC
  `;

  const rows = await query<any[]>(sql, queryParams);
  if (!rows || rows.length === 0) {
    return [];
  }

  const discountIds = rows.map((r) => r.id);
  const placeholders = discountIds.map(() => "?").join(", ");

  const [productRows, categoryRows] = await Promise.all([
    query<any[]>(
      `SELECT discount_id, product_id FROM discount_products WHERE discount_id IN (${placeholders})`,
      discountIds
    ),
    query<any[]>(
      `SELECT discount_id, category_id FROM discount_categories WHERE discount_id IN (${placeholders})`,
      discountIds
    ),
  ]);

  const productMap = new Map<string, string[]>();
  for (const r of productRows || []) {
    if (!productMap.has(r.discount_id)) productMap.set(r.discount_id, []);
    productMap.get(r.discount_id)!.push(r.product_id);
  }

  const categoryMap = new Map<string, string[]>();
  for (const r of categoryRows || []) {
    if (!categoryMap.has(r.discount_id)) categoryMap.set(r.discount_id, []);
    categoryMap.get(r.discount_id)!.push(r.category_id);
  }

  let discounts = rows.map((r) =>
    toDiscount(r, productMap.get(r.id) || [], categoryMap.get(r.id) || [])
  );

  // Status filter if requested
  if (filters.status && filters.status !== "all") {
    discounts = discounts.filter((d) => d.status === filters.status);
  }

  return discounts;
}

/**
 * Get all currently active discounts for storefront/public use.
 * Returns discounts where is_active = 1 AND start_at <= NOW() AND (end_at IS NULL OR NOW() < end_at).
 */
export async function getActiveDiscounts(): Promise<Discount[]> {
  const now = new Date();
  const nowStr = formatMysqlDateTime(now);

  const sql = `
    SELECT d.*
    FROM discounts d
    WHERE d.is_active = 1
      AND d.start_at <= ?
      AND (d.end_at IS NULL OR d.end_at > ?)
    ORDER BY d.created_at DESC
  `;

  const rows = await query<any[]>(sql, [nowStr, nowStr]);
  if (!rows || rows.length === 0) {
    return [];
  }

  const discountIds = rows.map((r) => r.id);
  const placeholders = discountIds.map(() => "?").join(", ");

  const [productRows, categoryRows] = await Promise.all([
    query<any[]>(
      `SELECT discount_id, product_id FROM discount_products WHERE discount_id IN (${placeholders})`,
      discountIds
    ),
    query<any[]>(
      `SELECT discount_id, category_id FROM discount_categories WHERE discount_id IN (${placeholders})`,
      discountIds
    ),
  ]);

  const productMap = new Map<string, string[]>();
  for (const r of productRows || []) {
    if (!productMap.has(r.discount_id)) productMap.set(r.discount_id, []);
    productMap.get(r.discount_id)!.push(r.product_id);
  }

  const categoryMap = new Map<string, string[]>();
  for (const r of categoryRows || []) {
    if (!categoryMap.has(r.discount_id)) categoryMap.set(r.discount_id, []);
    categoryMap.get(r.discount_id)!.push(r.category_id);
  }

  return rows.map((r) =>
    toDiscount(r, productMap.get(r.id) || [], categoryMap.get(r.id) || [])
  );
}

// ---------------------------------------------------------------------------
// Discount Resolution & Precedence (No Stacking)
// ---------------------------------------------------------------------------

/**
 * Resolves the applicable discount for a specific product following Dearr V1 precedence:
 *
 * Precedence Rule:
 * 1. Specific Product Discount (scope = 'product')
 * 2. Category Discount (scope = 'category')
 * 3. Store-wide Discount (scope = 'store')
 * 4. None (0)
 *
 * CRITICAL: DISCOUNTS ARE NEVER STACKED!
 */
export async function getApplicableDiscountForProduct(
  productId: string,
  now: Date = new Date()
): Promise<ApplicableDiscountResult | null> {
  const cleanProductId = productId?.trim();
  if (!cleanProductId) return null;

  // 1. Fetch product and its category
  const productRows = await query<any[]>(
    "SELECT id, price, category_id, is_active FROM products WHERE id = ? LIMIT 1",
    [cleanProductId]
  );
  if (!productRows || productRows.length === 0 || !productRows[0].is_active) {
    return null;
  }
  const product = productRows[0];
  const originalPrice = parseFloat(product.price);
  const categoryId = product.category_id;
  const nowStr = formatMysqlDateTime(now);

  // 2. Concurrently execute Product, Category, and Store-wide discount lookups
  const [productDiscountRows, categoryDiscountRows, storeDiscountRows] = await Promise.all([
    query<any[]>(
      `
      SELECT d.*
      FROM discounts d
      JOIN discount_products dp ON dp.discount_id = d.id
      WHERE dp.product_id = ?
        AND d.scope = 'product'
        AND d.is_active = 1
        AND d.start_at <= ?
        AND (d.end_at IS NULL OR d.end_at > ?)
      ORDER BY d.created_at DESC
      LIMIT 1
      `,
      [cleanProductId, nowStr, nowStr]
    ),
    categoryId
      ? query<any[]>(
          `
          SELECT d.*
          FROM discounts d
          JOIN discount_categories dc ON dc.discount_id = d.id
          WHERE dc.category_id = ?
            AND d.scope = 'category'
            AND d.is_active = 1
            AND d.start_at <= ?
            AND (d.end_at IS NULL OR d.end_at > ?)
          ORDER BY d.created_at DESC
          LIMIT 1
          `,
          [categoryId, nowStr, nowStr]
        )
      : Promise.resolve([]),
    query<any[]>(
      `
      SELECT d.*
      FROM discounts d
      WHERE d.scope = 'store'
        AND d.is_active = 1
        AND d.start_at <= ?
        AND (d.end_at IS NULL OR d.end_at > ?)
      ORDER BY d.created_at DESC
      LIMIT 1
      `,
      [nowStr, nowStr]
    ),
  ]);

  // Priority 1: Specific Product Discount
  if (productDiscountRows && productDiscountRows.length > 0) {
    const d = toDiscount(productDiscountRows[0], [cleanProductId], []);
    const calc = computeDiscountAmount(d, originalPrice);
    return {
      discount: d,
      discountAmount: calc.discountAmount,
      finalPrice: calc.finalPrice,
      precedence: "product",
    };
  }

  // Priority 2: Category Discount
  if (categoryDiscountRows && categoryDiscountRows.length > 0 && categoryId) {
    const d = toDiscount(categoryDiscountRows[0], [], [categoryId]);
    const calc = computeDiscountAmount(d, originalPrice);
    return {
      discount: d,
      discountAmount: calc.discountAmount,
      finalPrice: calc.finalPrice,
      precedence: "category",
    };
  }

  // Priority 3: Store-wide Discount
  if (storeDiscountRows && storeDiscountRows.length > 0) {
    const d = toDiscount(storeDiscountRows[0], [], []);
    const calc = computeDiscountAmount(d, originalPrice);
    return {
      discount: d,
      discountAmount: calc.discountAmount,
      finalPrice: calc.finalPrice,
      precedence: "store",
    };
  }

  // No discount applicable
  return null;
}

/**
 * Calculates discount amount and final price without stacking.
 */
export function computeDiscountAmount(
  discount: Discount,
  originalPrice: number
): { discountAmount: number; finalPrice: number } {
  let discountAmount = 0;

  if (discount.discountType === "percentage") {
    discountAmount = (originalPrice * discount.value) / 100;
  } else if (discount.discountType === "fixed_amount") {
    discountAmount = discount.value;
  }

  // Never discount more than the original price
  discountAmount = Math.min(discountAmount, originalPrice);
  discountAmount = Math.round(discountAmount * 100) / 100;
  const finalPrice = Math.max(0, Math.round((originalPrice - discountAmount) * 100) / 100);

  return { discountAmount, finalPrice };
}

// ---------------------------------------------------------------------------
// Write Operations
// ---------------------------------------------------------------------------

/**
 * Creates a new discount with target assignments inside a managed transaction.
 */
export async function createDiscount(input: CreateDiscountInput): Promise<Discount> {
  const id = crypto.randomUUID();

  // 1. Name validation
  const name = input.name?.trim();
  if (!name || name.length < 2 || name.length > 150) {
    throw new DiscountValidationError(
      "Discount name is required and must be between 2 and 150 characters",
      400
    );
  }

  // 2. Code validation & uniqueness
  const code = normalizeDiscountCode(input.code);
  if (code) {
    const existingCodeRows = await query<any[]>(
      "SELECT id FROM discounts WHERE UPPER(code) = ? LIMIT 1",
      [code]
    );
    if (existingCodeRows && existingCodeRows.length > 0) {
      throw new DiscountValidationError(
        `A discount with code '${code}' already exists`,
        409
      );
    }
  }

  // 3. Discount Type validation
  const discountType = input.discountType;
  if (discountType !== "percentage" && discountType !== "fixed_amount") {
    throw new DiscountValidationError(
      "Discount type must be 'percentage' or 'fixed_amount'",
      400
    );
  }

  // 4. Value validation
  const value = Number(input.value);
  if (isNaN(value) || value <= 0) {
    throw new DiscountValidationError(
      "Discount value must be a positive number greater than 0",
      400
    );
  }
  if (discountType === "percentage" && value > 100) {
    throw new DiscountValidationError(
      "Percentage discount cannot exceed 100%",
      400
    );
  }

  // 5. Scope validation
  const scope = input.scope;
  if (scope !== "store" && scope !== "category" && scope !== "product") {
    throw new DiscountValidationError(
      "Discount scope must be 'store', 'category', or 'product'",
      400
    );
  }

  // Collect target IDs
  let targetCategoryIds: string[] = [];
  let targetProductIds: string[] = [];

  if (scope === "category") {
    if (input.categoryId) {
      targetCategoryIds = [input.categoryId.trim()];
    } else if (Array.isArray(input.categoryIds) && input.categoryIds.length > 0) {
      targetCategoryIds = input.categoryIds.map((id) => id.trim()).filter(Boolean);
    }
    if (targetCategoryIds.length === 0) {
      throw new DiscountValidationError(
        "At least one category is required for category-scoped discount",
        400
      );
    }
    await verifyCategoriesExist(targetCategoryIds);
  } else if (scope === "product") {
    if (input.productId) {
      targetProductIds = [input.productId.trim()];
    } else if (Array.isArray(input.productIds) && input.productIds.length > 0) {
      targetProductIds = input.productIds.map((id) => id.trim()).filter(Boolean);
    }
    if (targetProductIds.length === 0) {
      throw new DiscountValidationError(
        "At least one product is required for product-scoped discount",
        400
      );
    }
    await verifyProductsExist(targetProductIds);
  }

  // 6. Date validation
  if (!input.startAt) {
    throw new DiscountValidationError("Discount start date is required", 400);
  }
  const startAt = new Date(input.startAt);
  if (isNaN(startAt.getTime())) {
    throw new DiscountValidationError("Invalid start date", 400);
  }

  let endAt: Date | null = null;
  if (input.endAt !== undefined && input.endAt !== null && input.endAt !== "") {
    endAt = new Date(input.endAt);
    if (isNaN(endAt.getTime())) {
      throw new DiscountValidationError("Invalid end date", 400);
    }
    if (endAt.getTime() <= startAt.getTime()) {
      throw new DiscountValidationError(
        "End date must be later than start date",
        400
      );
    }
  }

  const isActive = input.isActive !== undefined ? Boolean(input.isActive) : true;

  // 7. Check for same-scope overlapping conflict if isActive
  if (isActive) {
    const targetIds = scope === "category" ? targetCategoryIds : targetProductIds;
    await checkOverlapConflict(scope, startAt, endAt, targetIds);
  }

  // 8. Execute insert in transaction
  await withTransaction(async (conn) => {
    const startStr = formatMysqlDateTime(startAt);
    const endStr = endAt ? formatMysqlDateTime(endAt) : null;

    await conn.execute(
      `
      INSERT INTO discounts (
        id, name, code, discount_type, value, scope, start_at, end_at, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        id,
        name,
        code,
        discountType,
        value,
        scope,
        startStr,
        endStr,
        isActive ? 1 : 0,
      ]
    );

    if (scope === "category" && targetCategoryIds.length > 0) {
      for (const catId of targetCategoryIds) {
        const joinId = crypto.randomUUID();
        await conn.execute(
          `INSERT INTO discount_categories (id, discount_id, category_id) VALUES (?, ?, ?)`,
          [joinId, id, catId]
        );
      }
    } else if (scope === "product" && targetProductIds.length > 0) {
      for (const prodId of targetProductIds) {
        const joinId = crypto.randomUUID();
        await conn.execute(
          `INSERT INTO discount_products (id, discount_id, product_id) VALUES (?, ?, ?)`,
          [joinId, id, prodId]
        );
      }
    }
  });

  const created = await findDiscountById(id);
  if (!created) {
    throw new Error("Failed to retrieve discount immediately after creation");
  }

  return created;
}

/**
 * Updates an existing discount with target assignments inside a managed transaction.
 */
export async function updateDiscount(
  id: string,
  input: UpdateDiscountInput
): Promise<Discount | null> {
  const cleanId = id?.trim();
  if (!cleanId) return null;

  // Verify discount exists
  const existing = await findDiscountById(cleanId);
  if (!existing) {
    return null;
  }

  // Name validation
  let name = existing.name;
  if (input.name !== undefined) {
    const trimmed = input.name.trim();
    if (trimmed.length < 2 || trimmed.length > 150) {
      throw new DiscountValidationError(
        "Discount name must be between 2 and 150 characters",
        400
      );
    }
    name = trimmed;
  }

  // Code validation & uniqueness
  let code = existing.code;
  if (input.code !== undefined) {
    code = normalizeDiscountCode(input.code);
    if (code && code !== existing.code) {
      const existingCodeRows = await query<any[]>(
        "SELECT id FROM discounts WHERE UPPER(code) = ? AND id != ? LIMIT 1",
        [code, cleanId]
      );
      if (existingCodeRows && existingCodeRows.length > 0) {
        throw new DiscountValidationError(
          `A discount with code '${code}' already exists`,
          409
        );
      }
    }
  }

  // Type validation
  let discountType = existing.discountType;
  if (input.discountType !== undefined) {
    if (input.discountType !== "percentage" && input.discountType !== "fixed_amount") {
      throw new DiscountValidationError(
        "Discount type must be 'percentage' or 'fixed_amount'",
        400
      );
    }
    discountType = input.discountType;
  }

  // Value validation
  let value = existing.value;
  if (input.value !== undefined) {
    const num = Number(input.value);
    if (isNaN(num) || num <= 0) {
      throw new DiscountValidationError(
        "Discount value must be a positive number greater than 0",
        400
      );
    }
    if (discountType === "percentage" && num > 100) {
      throw new DiscountValidationError(
        "Percentage discount cannot exceed 100%",
        400
      );
    }
    value = num;
  } else if (discountType === "percentage" && value > 100) {
    throw new DiscountValidationError(
      "Percentage discount cannot exceed 100%",
      400
    );
  }

  // Dates validation
  let startAt = existing.startAt;
  if (input.startAt !== undefined) {
    const s = new Date(input.startAt);
    if (isNaN(s.getTime())) {
      throw new DiscountValidationError("Invalid start date", 400);
    }
    startAt = s;
  }

  let endAt = existing.endAt;
  if (input.endAt !== undefined) {
    if (input.endAt === null || input.endAt === "") {
      endAt = null;
    } else {
      const e = new Date(input.endAt);
      if (isNaN(e.getTime())) {
        throw new DiscountValidationError("Invalid end date", 400);
      }
      endAt = e;
    }
  }

  if (endAt !== null && endAt.getTime() <= startAt.getTime()) {
    throw new DiscountValidationError(
      "End date must be later than start date",
      400
    );
  }

  // Active status
  let isActive = existing.isActive;
  if (input.isActive !== undefined) {
    isActive = Boolean(input.isActive);
  }

  // Scope & Targets
  let scope = existing.scope;
  let targetCategoryIds = existing.categoryIds || [];
  let targetProductIds = existing.productIds || [];

  if (input.scope !== undefined) {
    if (
      input.scope !== "store" &&
      input.scope !== "category" &&
      input.scope !== "product"
    ) {
      throw new DiscountValidationError(
        "Discount scope must be 'store', 'category', or 'product'",
        400
      );
    }
    scope = input.scope;
  }

  // Target assignments update
  if (scope === "category") {
    if (input.categoryId !== undefined) {
      targetCategoryIds = input.categoryId ? [input.categoryId.trim()] : [];
    } else if (input.categoryIds !== undefined) {
      targetCategoryIds = input.categoryIds.map((id) => id.trim()).filter(Boolean);
    }
    if (targetCategoryIds.length === 0) {
      throw new DiscountValidationError(
        "At least one category is required for category-scoped discount",
        400
      );
    }
    await verifyCategoriesExist(targetCategoryIds);
    targetProductIds = [];
  } else if (scope === "product") {
    if (input.productId !== undefined) {
      targetProductIds = input.productId ? [input.productId.trim()] : [];
    } else if (input.productIds !== undefined) {
      targetProductIds = input.productIds.map((id) => id.trim()).filter(Boolean);
    }
    if (targetProductIds.length === 0) {
      throw new DiscountValidationError(
        "At least one product is required for product-scoped discount",
        400
      );
    }
    await verifyProductsExist(targetProductIds);
    targetCategoryIds = [];
  } else if (scope === "store") {
    targetCategoryIds = [];
    targetProductIds = [];
  }

  // Overlap conflict check if active
  if (isActive) {
    const targetIds = scope === "category" ? targetCategoryIds : targetProductIds;
    await checkOverlapConflict(scope, startAt, endAt, targetIds, cleanId);
  }

  // Execute update in transaction
  await withTransaction(async (conn) => {
    const startStr = formatMysqlDateTime(startAt);
    const endStr = endAt ? formatMysqlDateTime(endAt) : null;

    await conn.execute(
      `
      UPDATE discounts SET
        name = ?,
        code = ?,
        discount_type = ?,
        value = ?,
        scope = ?,
        start_at = ?,
        end_at = ?,
        is_active = ?
      WHERE id = ?
      `,
      [
        name,
        code,
        discountType,
        value,
        scope,
        startStr,
        endStr,
        isActive ? 1 : 0,
        cleanId,
      ]
    );

    // Clear obsolete join records
    await conn.execute("DELETE FROM discount_categories WHERE discount_id = ?", [
      cleanId,
    ]);
    await conn.execute("DELETE FROM discount_products WHERE discount_id = ?", [
      cleanId,
    ]);

    // Insert new join records
    if (scope === "category" && targetCategoryIds.length > 0) {
      for (const catId of targetCategoryIds) {
        const joinId = crypto.randomUUID();
        await conn.execute(
          `INSERT INTO discount_categories (id, discount_id, category_id) VALUES (?, ?, ?)`,
          [joinId, cleanId, catId]
        );
      }
    } else if (scope === "product" && targetProductIds.length > 0) {
      for (const prodId of targetProductIds) {
        const joinId = crypto.randomUUID();
        await conn.execute(
          `INSERT INTO discount_products (id, discount_id, product_id) VALUES (?, ?, ?)`,
          [joinId, cleanId, prodId]
        );
      }
    }
  });

  return await findDiscountById(cleanId);
}

/**
 * Hard delete a discount (intended for cleanup in test suites).
 */
export async function deleteDiscount(id: string): Promise<boolean> {
  const cleanId = id?.trim();
  if (!cleanId) return false;

  const result = await query<any>("DELETE FROM discounts WHERE id = ?", [cleanId]);
  return result.affectedRows > 0;
}
