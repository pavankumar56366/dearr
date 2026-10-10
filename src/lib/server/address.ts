import "server-only";
import crypto from "crypto";
import { query, withTransaction } from "./db";

export interface CustomerAddress {
  id: string;
  userId: string;
  label: string | null;
  fullName: string;
  phone: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateAddressInput {
  label?: string | null;
  fullName: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string | null;
  city: string;
  state: string;
  postalCode: string;
  country?: string;
  isDefault?: boolean;
}

export interface UpdateAddressInput {
  label?: string | null;
  fullName?: string;
  phone?: string;
  addressLine1?: string;
  addressLine2?: string | null;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  isDefault?: boolean;
}

function mapRowToAddress(row: any): CustomerAddress {
  return {
    id: row.id,
    userId: row.user_id,
    label: row.label ?? null,
    fullName: row.full_name,
    phone: row.phone,
    addressLine1: row.address_line_1,
    addressLine2: row.address_line_2 ?? null,
    city: row.city,
    state: row.state,
    postalCode: row.postal_code,
    country: row.country || "India",
    isDefault: Boolean(row.is_default),
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

/**
 * Retrieves all saved addresses for an authenticated customer.
 * Enforces strict user_id boundary.
 */
export async function listCustomerAddresses(userId: string): Promise<CustomerAddress[]> {
  const cleanUserId = userId?.trim();
  if (!cleanUserId) return [];

  const rows = await query<any[]>(
    `SELECT * FROM addresses WHERE user_id = ? ORDER BY is_default DESC, created_at DESC`,
    [cleanUserId]
  );

  return (rows || []).map(mapRowToAddress);
}

/**
 * Retrieves a single address strictly owned by the specified customer.
 * Prevents unauthorized access across tenant boundaries.
 */
export async function getCustomerAddressById(
  userId: string,
  addressId: string
): Promise<CustomerAddress | null> {
  const cleanUserId = userId?.trim();
  const cleanAddressId = addressId?.trim();
  if (!cleanUserId || !cleanAddressId) return null;

  const rows = await query<any[]>(
    `SELECT * FROM addresses WHERE id = ? AND user_id = ? LIMIT 1`,
    [cleanAddressId, cleanUserId]
  );

  if (!rows || rows.length === 0) return null;
  return mapRowToAddress(rows[0]);
}

/**
 * Creates a new address for the customer.
 * If marked as default or is the first address, updates default flags.
 */
export async function createCustomerAddress(
  userId: string,
  input: CreateAddressInput
): Promise<CustomerAddress> {
  const cleanUserId = userId?.trim();
  if (!cleanUserId) throw new Error("User ID is required to create an address");

  const addressId = crypto.randomUUID();
  const existingCountRows = await query<any[]>(
    `SELECT COUNT(*) as count FROM addresses WHERE user_id = ?`,
    [cleanUserId]
  );
  const existingCount = Number(existingCountRows?.[0]?.count || 0);

  // If first address or explicitly marked default, make it default
  const makeDefault = Boolean(input.isDefault || existingCount === 0);

  return await withTransaction(async (conn) => {
    if (makeDefault) {
      await conn.execute(`UPDATE addresses SET is_default = 0 WHERE user_id = ?`, [cleanUserId]);
    }

    await conn.execute(
      `INSERT INTO addresses (
         id, user_id, label, full_name, phone, address_line_1, address_line_2,
         city, state, postal_code, country, is_default
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        addressId,
        cleanUserId,
        input.label?.trim() || null,
        input.fullName.trim(),
        input.phone.trim(),
        input.addressLine1.trim(),
        input.addressLine2?.trim() || null,
        input.city.trim(),
        input.state.trim(),
        input.postalCode.trim(),
        input.country?.trim() || "India",
        makeDefault ? 1 : 0,
      ]
    );

    const [rows]: any = await conn.execute(
      `SELECT * FROM addresses WHERE id = ? AND user_id = ? LIMIT 1`,
      [addressId, cleanUserId]
    );

    return mapRowToAddress(rows[0]);
  });
}

/**
 * Updates an address owned by the customer.
 */
export async function updateCustomerAddress(
  userId: string,
  addressId: string,
  input: UpdateAddressInput
): Promise<CustomerAddress> {
  const cleanUserId = userId?.trim();
  const cleanAddressId = addressId?.trim();
  if (!cleanUserId || !cleanAddressId) throw new Error("Invalid address identification");

  const existing = await getCustomerAddressById(cleanUserId, cleanAddressId);
  if (!existing) {
    throw new Error("Address not found or unauthorized");
  }

  return await withTransaction(async (conn) => {
    if (input.isDefault) {
      await conn.execute(`UPDATE addresses SET is_default = 0 WHERE user_id = ?`, [cleanUserId]);
    }

    const setClauses: string[] = [];
    const params: any[] = [];

    if (input.label !== undefined) {
      setClauses.push("label = ?");
      params.push(input.label ? input.label.trim() : null);
    }
    if (input.fullName !== undefined) {
      setClauses.push("full_name = ?");
      params.push(input.fullName.trim());
    }
    if (input.phone !== undefined) {
      setClauses.push("phone = ?");
      params.push(input.phone.trim());
    }
    if (input.addressLine1 !== undefined) {
      setClauses.push("address_line_1 = ?");
      params.push(input.addressLine1.trim());
    }
    if (input.addressLine2 !== undefined) {
      setClauses.push("address_line_2 = ?");
      params.push(input.addressLine2 ? input.addressLine2.trim() : null);
    }
    if (input.city !== undefined) {
      setClauses.push("city = ?");
      params.push(input.city.trim());
    }
    if (input.state !== undefined) {
      setClauses.push("state = ?");
      params.push(input.state.trim());
    }
    if (input.postalCode !== undefined) {
      setClauses.push("postal_code = ?");
      params.push(input.postalCode.trim());
    }
    if (input.country !== undefined) {
      setClauses.push("country = ?");
      params.push(input.country.trim());
    }
    if (input.isDefault !== undefined) {
      setClauses.push("is_default = ?");
      params.push(input.isDefault ? 1 : 0);
    }

    if (setClauses.length > 0) {
      params.push(cleanAddressId, cleanUserId);
      await conn.execute(
        `UPDATE addresses SET ${setClauses.join(", ")}, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?`,
        params
      );
    }

    const [rows]: any = await conn.execute(
      `SELECT * FROM addresses WHERE id = ? AND user_id = ? LIMIT 1`,
      [cleanAddressId, cleanUserId]
    );

    return mapRowToAddress(rows[0]);
  });
}

/**
 * Deletes an address owned by the customer.
 */
export async function deleteCustomerAddress(
  userId: string,
  addressId: string
): Promise<boolean> {
  const cleanUserId = userId?.trim();
  const cleanAddressId = addressId?.trim();
  if (!cleanUserId || !cleanAddressId) return false;

  const existing = await getCustomerAddressById(cleanUserId, cleanAddressId);
  if (!existing) return false;

  await withTransaction(async (conn) => {
    await conn.execute(
      `DELETE FROM addresses WHERE id = ? AND user_id = ?`,
      [cleanAddressId, cleanUserId]
    );

    // If the deleted address was default, promote the newest remaining address to default
    if (existing.isDefault) {
      const [remaining]: any = await conn.execute(
        `SELECT id FROM addresses WHERE user_id = ? ORDER BY created_at DESC LIMIT 1`,
        [cleanUserId]
      );
      if (remaining && remaining.length > 0) {
        await conn.execute(
          `UPDATE addresses SET is_default = 1 WHERE id = ?`,
          [remaining[0].id]
        );
      }
    }
  });

  return true;
}

/**
 * Sets a specific address as default for the customer.
 */
export async function setDefaultCustomerAddress(
  userId: string,
  addressId: string
): Promise<CustomerAddress> {
  return updateCustomerAddress(userId, addressId, { isDefault: true });
}
