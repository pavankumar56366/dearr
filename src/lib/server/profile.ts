import "server-only";
import crypto from "crypto";
import { query } from "./db";

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  role: "customer" | "admin";
  emailVerifiedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserProfileWithPassword extends UserProfile {
  passwordHash: string;
}

export interface CreateProfileInput {
  id?: string;
  email: string;
  /**
   * bcrypt password hash for email/password accounts.
   * NULL is permitted for Google-only accounts that have no Dearr password.
   */
  passwordHash: string | null;
  fullName: string;
  phone?: string | null;
  role?: "customer" | "admin";
}

export interface UpdateProfileInput {
  fullName?: string;
  phone?: string | null;
  role?: "customer" | "admin";
  emailVerifiedAt?: Date | null;
  passwordResetTokenHash?: string | null;
  passwordResetExpiresAt?: Date | null;
}

interface RawProfileRow {
  id: string;
  email: string;
  password_hash?: string;
  full_name: string;
  phone: string | null;
  role: "customer" | "admin";
  email_verified_at: string | Date | null;
  password_reset_token_hash?: string | null;
  password_reset_expires_at?: string | Date | null;
  created_at: string | Date;
  updated_at: string | Date;
}

/**
 * Maps raw database row to sanitized UserProfile.
 * Guaranteed never to expose password_hash or reset tokens.
 */
function toSanitizedProfile(row: RawProfileRow): UserProfile {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    phone: row.phone ?? null,
    role: row.role,
    emailVerifiedAt: row.email_verified_at ? new Date(row.email_verified_at) : null,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

/**
 * Finds a customer or admin profile by email address.
 * Never returns password_hash.
 */
export async function findProfileByEmail(email: string): Promise<UserProfile | null> {
  const normalizedEmail = email?.trim().toLowerCase();
  if (!normalizedEmail) return null;

  const sql = `
    SELECT id, email, full_name, phone, role, email_verified_at, created_at, updated_at
    FROM profiles
    WHERE email = ?
    LIMIT 1
  `;
  const rows = await query<RawProfileRow[]>(sql, [normalizedEmail]);

  if (!rows || rows.length === 0) {
    return null;
  }

  return toSanitizedProfile(rows[0]);
}

/**
 * Internal authentication helper: Finds a profile with password_hash by email address.
 * RESTRICTED: Must only be used by server-side authentication verification logic.
 */
export async function findProfileWithPasswordByEmail(
  email: string
): Promise<UserProfileWithPassword | null> {
  const normalizedEmail = email?.trim().toLowerCase();
  if (!normalizedEmail) return null;

  const sql = `
    SELECT id, email, password_hash, full_name, phone, role, email_verified_at, created_at, updated_at
    FROM profiles
    WHERE email = ?
    LIMIT 1
  `;
  const rows = await query<RawProfileRow[]>(sql, [normalizedEmail]);

  if (!rows || rows.length === 0) {
    return null;
  }

  const row = rows[0];
  return {
    ...toSanitizedProfile(row),
    passwordHash: row.password_hash ?? "",
  };
}

/**
 * Finds a customer or admin profile by primary key UUID.
 * Never returns password_hash.
 */
export async function findProfileById(id: string): Promise<UserProfile | null> {
  const cleanId = id?.trim();
  if (!cleanId) return null;

  const sql = `
    SELECT id, email, full_name, phone, role, email_verified_at, created_at, updated_at
    FROM profiles
    WHERE id = ?
    LIMIT 1
  `;
  const rows = await query<RawProfileRow[]>(sql, [cleanId]);

  if (!rows || rows.length === 0) {
    return null;
  }

  return toSanitizedProfile(rows[0]);
}

/**
 * Creates a new customer or admin profile with a pre-hashed password.
 * Uses parameterized SQL queries exclusively.
 * Returns the created UserProfile (without password_hash).
 */
export async function createProfile(input: CreateProfileInput): Promise<UserProfile> {
  const id = input.id?.trim() || crypto.randomUUID();
  const normalizedEmail = input.email.trim().toLowerCase();
  const fullName = input.fullName.trim();
  const phone = input.phone?.trim() || null;
  const role = input.role || "customer";

  if (!normalizedEmail) {
    throw new Error("Email is required to create a profile");
  }
  if (!fullName) {
    throw new Error("Full name is required to create a profile");
  }
  // passwordHash may be NULL for Google-only accounts with no Dearr password

  const sql = `
    INSERT INTO profiles (id, email, password_hash, full_name, phone, role)
    VALUES (?, ?, ?, ?, ?, ?)
  `;

  await query(sql, [id, normalizedEmail, input.passwordHash ?? null, fullName, phone, role]);

  const created = await findProfileById(id);
  if (!created) {
    throw new Error("Profile creation failed to persist in database");
  }

  return created;
}

/**
 * Updates an existing profile's fields using parameterized SQL.
 * Returns the updated UserProfile (never exposes password_hash).
 */
export async function updateProfile(
  id: string,
  updates: UpdateProfileInput
): Promise<UserProfile | null> {
  const cleanId = id?.trim();
  if (!cleanId) return null;

  const fields: string[] = [];
  const values: any[] = [];

  if (updates.fullName !== undefined) {
    fields.push("full_name = ?");
    values.push(updates.fullName.trim());
  }

  if (updates.phone !== undefined) {
    fields.push("phone = ?");
    values.push(updates.phone ? updates.phone.trim() : null);
  }

  if (updates.role !== undefined) {
    fields.push("role = ?");
    values.push(updates.role);
  }

  if (updates.emailVerifiedAt !== undefined) {
    fields.push("email_verified_at = ?");
    values.push(updates.emailVerifiedAt);
  }

  if (updates.passwordResetTokenHash !== undefined) {
    fields.push("password_reset_token_hash = ?");
    values.push(updates.passwordResetTokenHash);
  }

  if (updates.passwordResetExpiresAt !== undefined) {
    fields.push("password_reset_expires_at = ?");
    values.push(updates.passwordResetExpiresAt);
  }

  if (fields.length === 0) {
    return findProfileById(cleanId);
  }

  values.push(cleanId);
  const sql = `UPDATE profiles SET ${fields.join(", ")} WHERE id = ?`;

  await query(sql, values);
  return findProfileById(cleanId);
}

/**
 * Updates a user's password hash securely.
 * Restricted to internal authentication / password reset flows.
 */
export async function updateProfilePassword(
  id: string,
  newPasswordHash: string
): Promise<boolean> {
  const cleanId = id?.trim();
  if (!cleanId || !newPasswordHash) return false;

  const sql = `
    UPDATE profiles
    SET password_hash = ?, password_reset_token_hash = NULL, password_reset_expires_at = NULL
    WHERE id = ?
  `;
  await query(sql, [newPasswordHash, cleanId]);
  return true;
}

/**
 * Updates a customer profile with strict field filtering.
 * Role escalation protection:
 * - Only modifies fullName and phone.
 * - Disallows modifying role or credentials.
 */
export async function updateCustomerProfile(
  id: string,
  updates: { fullName?: string; phone?: string | null }
): Promise<UserProfile | null> {
  return updateProfile(id, {
    fullName: updates.fullName,
    phone: updates.phone,
  });
}
