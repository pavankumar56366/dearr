import "server-only";
import { query } from "./db";
import type { AdminReview, ReviewStatus } from "@/lib/admin-reviews";

export interface ReviewListFilters {
  search?: string;
  status?: ReviewStatus | "ALL";
  rating?: number | "ALL";
  productId?: string;
}

interface RawReviewRow {
  id: string;
  product_id: string;
  product_slug?: string | null;
  product_name?: string | null;
  product_image?: string | null;
  user_id?: string | null;
  customer_name: string;
  customer_email: string;
  rating: number;
  title: string;
  comment: string;
  status: ReviewStatus;
  verified_purchase: number | boolean;
  admin_note?: string | null;
  created_at: string | Date;
  updated_at: string | Date;
}

function mapRowToAdminReview(row: RawReviewRow): AdminReview {
  return {
    id: row.id,
    productId: row.product_id,
    productSlug: row.product_slug || `product-${row.product_id}`,
    productName: row.product_name || "Dearr 3D Product",
    productImage: row.product_image || "/product-samples/1.jpeg",
    customerId: row.user_id || "",
    customerName: row.customer_name || "Customer",
    customerEmail: row.customer_email || "",
    rating: Number(row.rating || 5),
    title: row.title || "",
    comment: row.comment || "",
    status: row.status,
    verifiedPurchase: Boolean(row.verified_purchase),
    adminNote: row.admin_note || undefined,
    createdAt: typeof row.created_at === "string" ? row.created_at : new Date(row.created_at).toISOString(),
    updatedAt: typeof row.updated_at === "string" ? row.updated_at : new Date(row.updated_at).toISOString(),
  };
}

/**
 * Lists customer reviews from reviews table.
 * Joins products table to resolve product name and primary image.
 * Parameterized queries only. Never leaks passwords or secrets.
 */
export async function listAdminReviews(filters?: ReviewListFilters): Promise<AdminReview[]> {
  const whereClauses: string[] = [];
  const params: any[] = [];

  if (filters?.status && filters.status !== "ALL") {
    whereClauses.push("r.status = ?");
    params.push(filters.status);
  }

  if (filters?.rating && filters.rating !== "ALL") {
    whereClauses.push("r.rating = ?");
    params.push(filters.rating);
  }

  if (filters?.productId) {
    whereClauses.push("r.product_id = ?");
    params.push(filters.productId);
  }

  if (filters?.search && filters.search.trim()) {
    const term = `%${filters.search.trim().toLowerCase()}%`;
    whereClauses.push(
      "(LOWER(r.customer_name) LIKE ? OR LOWER(r.customer_email) LIKE ? OR LOWER(r.title) LIKE ? OR LOWER(r.comment) LIKE ? OR LOWER(p.name) LIKE ?)"
    );
    params.push(term, term, term, term, term);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

  const sql = `
    SELECT 
      r.id,
      r.product_id,
      p.slug AS product_slug,
      p.name AS product_name,
      (SELECT storage_path FROM product_images WHERE product_id = p.id ORDER BY sort_order ASC LIMIT 1) AS product_image,
      r.user_id,
      r.customer_name,
      r.customer_email,
      r.rating,
      r.title,
      r.comment,
      r.status,
      r.verified_purchase,
      r.admin_note,
      r.created_at,
      r.updated_at
    FROM reviews r
    LEFT JOIN products p ON p.id = r.product_id
    ${whereSql}
    ORDER BY r.created_at DESC
  `;

  const rows = await query<RawReviewRow[]>(sql, params);
  return (rows || []).map(mapRowToAdminReview);
}

/**
 * Retrieves a single review by UUID.
 */
export async function getAdminReviewById(id: string): Promise<AdminReview | null> {
  const cleanId = id?.trim();
  if (!cleanId) return null;

  const sql = `
    SELECT 
      r.id,
      r.product_id,
      p.slug AS product_slug,
      p.name AS product_name,
      (SELECT storage_path FROM product_images WHERE product_id = p.id ORDER BY sort_order ASC LIMIT 1) AS product_image,
      r.user_id,
      r.customer_name,
      r.customer_email,
      r.rating,
      r.title,
      r.comment,
      r.status,
      r.verified_purchase,
      r.admin_note,
      r.created_at,
      r.updated_at
    FROM reviews r
    LEFT JOIN products p ON p.id = r.product_id
    WHERE r.id = ?
    LIMIT 1
  `;

  const rows = await query<RawReviewRow[]>(sql, [cleanId]);
  if (!rows || rows.length === 0) return null;

  return mapRowToAdminReview(rows[0]);
}

/**
 * Updates review moderation status and administrative notes.
 */
export async function updateAdminReview(
  id: string,
  updates: { status?: ReviewStatus; adminNote?: string }
): Promise<AdminReview | null> {
  const cleanId = id?.trim();
  if (!cleanId) return null;

  const allowedStatuses = ["pending", "approved", "rejected", "flagged"];
  const setClauses: string[] = [];
  const params: any[] = [];

  if (updates.status !== undefined) {
    if (!allowedStatuses.includes(updates.status)) {
      throw new Error(`Invalid review status: ${updates.status}`);
    }
    setClauses.push("status = ?");
    params.push(updates.status);
  }

  if (updates.adminNote !== undefined) {
    setClauses.push("admin_note = ?");
    params.push(updates.adminNote.trim() || null);
  }

  if (setClauses.length > 0) {
    params.push(cleanId);
    await query(`UPDATE reviews SET ${setClauses.join(", ")}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, params);
  }

  return getAdminReviewById(cleanId);
}
