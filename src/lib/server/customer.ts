import "server-only";
import { query } from "./db";
import type { AdminCustomer, CustomerStatus, CustomerAddress } from "@/lib/admin-customers";

export interface CustomerListFilters {
  search?: string;
  status?: CustomerStatus | "ALL";
  role?: "customer" | "admin" | "ALL";
  page?: number;
  limit?: number;
}

interface RawCustomerRow {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: "customer" | "admin";
  status: CustomerStatus;
  admin_notes: string | null;
  created_at: string | Date;
  order_count: number | string;
  total_spent: number | string;
  last_order_at: string | Date | null;
  addr_full_name?: string | null;
  addr_phone?: string | null;
  addr_line1?: string | null;
  addr_line2?: string | null;
  addr_city?: string | null;
  addr_state?: string | null;
  addr_postal_code?: string | null;
  addr_country?: string | null;
}

function mapRowToAdminCustomer(row: RawCustomerRow): AdminCustomer {
  let defaultAddress: CustomerAddress | undefined = undefined;
  if (row.addr_line1 && row.addr_city) {
    defaultAddress = {
      fullName: row.addr_full_name || row.name,
      phone: row.addr_phone || row.phone || "",
      addressLine1: row.addr_line1,
      addressLine2: row.addr_line2 || undefined,
      city: row.addr_city,
      state: row.addr_state || "",
      postalCode: row.addr_postal_code || "",
      country: row.addr_country || "India",
    };
  }

  return {
    id: row.id,
    name: row.name || "Customer",
    email: row.email,
    phone: row.phone || "",
    status: row.status || "active",
    notes: row.admin_notes || undefined,
    joinedAt: typeof row.created_at === "string" ? row.created_at : new Date(row.created_at).toISOString(),
    lastOrderAt: row.last_order_at ? (typeof row.last_order_at === "string" ? row.last_order_at : new Date(row.last_order_at).toISOString()) : undefined,
    orderCount: Number(row.order_count || 0),
    totalSpent: Number(row.total_spent || 0),
    currency: "INR",
    defaultAddress,
  };
}

/**
 * Lists registered customers for Admin Operations.
 * Aggregates order count and total spent from orders table.
 * Resolves default shipping address from addresses table.
 * Parameterized queries only. Never returns credentials or password hashes.
 */
export async function listAdminCustomers(filters?: CustomerListFilters): Promise<AdminCustomer[]> {
  const whereClauses: string[] = [];
  const params: any[] = [];

  // Default: show customer accounts, or filter by role if provided
  if (filters?.role && filters.role !== "ALL") {
    whereClauses.push("p.role = ?");
    params.push(filters.role);
  } else {
    // By default list all registered users with customer role first
    whereClauses.push("p.role = 'customer'");
  }

  if (filters?.status && filters.status !== "ALL") {
    const dbStatus = filters.status === "blocked" || filters.status === "suspended" ? "suspended" : "active";
    whereClauses.push("p.status = ?");
    params.push(dbStatus);
  }

  if (filters?.search && filters.search.trim()) {
    const term = `%${filters.search.trim().toLowerCase()}%`;
    whereClauses.push("(LOWER(p.full_name) LIKE ? OR LOWER(p.email) LIKE ? OR p.phone LIKE ?)");
    params.push(term, term, term);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

  const sql = `
    SELECT 
      p.id,
      p.full_name AS name,
      p.email,
      p.phone,
      p.role,
      p.status,
      p.admin_notes,
      p.created_at,
      COALESCE(o.order_count, 0) AS order_count,
      COALESCE(o.total_spent, 0) AS total_spent,
      o.last_order_at,
      a.full_name AS addr_full_name,
      a.phone AS addr_phone,
      a.address_line_1 AS addr_line1,
      a.address_line_2 AS addr_line2,
      a.city AS addr_city,
      a.state AS addr_state,
      a.postal_code AS addr_postal_code,
      a.country AS addr_country
    FROM profiles p
    LEFT JOIN (
      SELECT 
        user_id,
        COUNT(id) AS order_count,
        SUM(CASE WHEN payment_status = 'paid' THEN total_amount ELSE 0 END) AS total_spent,
        MAX(created_at) AS last_order_at
      FROM orders
      GROUP BY user_id
    ) o ON o.user_id = p.id
    LEFT JOIN (
      SELECT 
        user_id,
        full_name,
        phone,
        address_line_1,
        address_line_2,
        city,
        state,
        postal_code,
        country
      FROM addresses
      WHERE is_default = 1
    ) a ON a.user_id = p.id
    ${whereSql}
    ORDER BY p.created_at DESC
  `;

  const rows = await query<RawCustomerRow[]>(sql, params);
  return (rows || []).map(mapRowToAdminCustomer);
}

/**
 * Retrieves a single customer by UUID.
 */
export async function getAdminCustomerById(id: string): Promise<AdminCustomer | null> {
  const cleanId = id?.trim();
  if (!cleanId) return null;

  const sql = `
    SELECT 
      p.id,
      p.full_name AS name,
      p.email,
      p.phone,
      p.role,
      p.status,
      p.admin_notes,
      p.created_at,
      COALESCE(o.order_count, 0) AS order_count,
      COALESCE(o.total_spent, 0) AS total_spent,
      o.last_order_at,
      a.full_name AS addr_full_name,
      a.phone AS addr_phone,
      a.address_line_1 AS addr_line1,
      a.address_line_2 AS addr_line2,
      a.city AS addr_city,
      a.state AS addr_state,
      a.postal_code AS addr_postal_code,
      a.country AS addr_country
    FROM profiles p
    LEFT JOIN (
      SELECT 
        user_id,
        COUNT(id) AS order_count,
        SUM(CASE WHEN payment_status = 'paid' THEN total_amount ELSE 0 END) AS total_spent,
        MAX(created_at) AS last_order_at
      FROM orders
      WHERE user_id = ?
      GROUP BY user_id
    ) o ON o.user_id = p.id
    LEFT JOIN (
      SELECT 
        user_id,
        full_name,
        phone,
        address_line_1,
        address_line_2,
        city,
        state,
        postal_code,
        country
      FROM addresses
      WHERE user_id = ? AND is_default = 1
      LIMIT 1
    ) a ON a.user_id = p.id
    WHERE p.id = ?
    LIMIT 1
  `;

  const rows = await query<RawCustomerRow[]>(sql, [cleanId, cleanId, cleanId]);
  if (!rows || rows.length === 0) return null;

  return mapRowToAdminCustomer(rows[0]);
}

/**
 * Updates a customer profile.
 * Restricted to safe customer fields (name, phone, status, notes, defaultAddress).
 * Role escalation protection: role and password_hash cannot be modified here.
 */
export async function updateAdminCustomerRecord(
  id: string,
  updates: {
    name?: string;
    phone?: string;
    status?: CustomerStatus;
    notes?: string;
    defaultAddress?: CustomerAddress;
  }
): Promise<AdminCustomer | null> {
  const cleanId = id?.trim();
  if (!cleanId) return null;

  const setClauses: string[] = [];
  const params: any[] = [];

  if (updates.name !== undefined && updates.name.trim()) {
    setClauses.push("full_name = ?");
    params.push(updates.name.trim());
  }

  if (updates.phone !== undefined) {
    setClauses.push("phone = ?");
    params.push(updates.phone ? updates.phone.trim() : null);
  }

  if (updates.status !== undefined) {
    const validStatus =
      updates.status === "suspended" || updates.status === "blocked"
        ? "suspended"
        : "active";
    setClauses.push("status = ?");
    params.push(validStatus);
  }

  if (updates.notes !== undefined) {
    setClauses.push("admin_notes = ?");
    params.push(updates.notes.trim() || null);
  }

  if (setClauses.length > 0) {
    params.push(cleanId);
    await query(`UPDATE profiles SET ${setClauses.join(", ")}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, params);
  }

  if (updates.defaultAddress) {
    const addr = updates.defaultAddress;
    const existing = await query<any[]>(
      "SELECT id FROM addresses WHERE user_id = ? AND is_default = 1 LIMIT 1",
      [cleanId]
    );

    if (existing && existing.length > 0) {
      await query(
        `UPDATE addresses SET 
           full_name = ?, phone = ?, address_line_1 = ?, address_line_2 = ?, 
           city = ?, state = ?, postal_code = ?, country = ?, updated_at = CURRENT_TIMESTAMP 
         WHERE id = ?`,
        [
          addr.fullName || updates.name || "Customer",
          addr.phone || updates.phone || "",
          addr.addressLine1,
          addr.addressLine2 || null,
          addr.city,
          addr.state,
          addr.postalCode,
          addr.country || "India",
          existing[0].id,
        ]
      );
    } else if (addr.addressLine1 && addr.city) {
      const crypto = await import("crypto");
      await query(
        `INSERT INTO addresses (
           id, user_id, label, full_name, phone, address_line_1, address_line_2, 
           city, state, postal_code, country, is_default
         ) VALUES (?, ?, 'Default', ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        [
          crypto.randomUUID(),
          cleanId,
          addr.fullName || updates.name || "Customer",
          addr.phone || updates.phone || "",
          addr.addressLine1,
          addr.addressLine2 || null,
          addr.city,
          addr.state,
          addr.postalCode,
          addr.country || "India",
        ]
      );
    }
  }

  return getAdminCustomerById(cleanId);
}
