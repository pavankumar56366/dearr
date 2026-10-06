import "server-only";
import { query } from "./db";
import {
  AdminSettings,
  DEFAULT_ADMIN_SETTINGS,
} from "@/lib/admin-settings";

interface StoreSettingsRow {
  id: number;
  settings_json: string | AdminSettings;
  created_at: Date | string;
  updated_at: Date | string;
}

/**
 * Retrieves the persisted store settings from Hostinger MySQL.
 * Falls back to DEFAULT_ADMIN_SETTINGS if no record exists yet,
 * and merges with defaults to ensure all fields are always populated.
 */
export async function getStoreSettings(): Promise<AdminSettings> {
  try {
    const rows = await query<StoreSettingsRow[]>(
      "SELECT id, settings_json, updated_at FROM store_settings WHERE id = 1 LIMIT 1"
    );

    if (!rows || rows.length === 0) {
      return { ...DEFAULT_ADMIN_SETTINGS };
    }

    const raw = rows[0].settings_json;
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;

    return {
      ...DEFAULT_ADMIN_SETTINGS,
      ...parsed,
    };
  } catch (err: unknown) {
    console.error("[getStoreSettings] Failed to query settings, using defaults:", err);
    return { ...DEFAULT_ADMIN_SETTINGS };
  }
}

/**
 * Validates and updates store settings in Hostinger MySQL.
 * Merges partial updates with existing settings and guarantees persistence.
 */
export async function updateStoreSettings(
  updates: Partial<AdminSettings>
): Promise<AdminSettings> {
  const current = await getStoreSettings();

  // Validate critical fields
  if (updates.supportEmail !== undefined) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(updates.supportEmail.trim())) {
      throw new Error("Invalid support email address");
    }
  }

  if (updates.minimumOrderValue !== undefined && updates.minimumOrderValue < 0) {
    throw new Error("Minimum order value cannot be negative");
  }

  if (updates.freeShippingThreshold !== undefined && updates.freeShippingThreshold < 0) {
    throw new Error("Free shipping threshold cannot be negative");
  }

  if (updates.defaultShippingFee !== undefined && updates.defaultShippingFee < 0) {
    throw new Error("Default shipping fee cannot be negative");
  }

  if (updates.cancellationWindowHours !== undefined && updates.cancellationWindowHours <= 0) {
    throw new Error("Cancellation window must be greater than zero hours");
  }

  const nextSettings: AdminSettings = {
    ...current,
    ...updates,
    // Ensure numerical fields are proper numbers
    minimumOrderValue:
      updates.minimumOrderValue !== undefined
        ? Number(updates.minimumOrderValue)
        : current.minimumOrderValue,
    freeShippingThreshold:
      updates.freeShippingThreshold !== undefined
        ? Number(updates.freeShippingThreshold)
        : current.freeShippingThreshold,
    defaultShippingFee:
      updates.defaultShippingFee !== undefined
        ? Number(updates.defaultShippingFee)
        : current.defaultShippingFee,
    cancellationWindowHours:
      updates.cancellationWindowHours !== undefined
        ? Number(updates.cancellationWindowHours)
        : current.cancellationWindowHours,
  };

  const jsonString = JSON.stringify(nextSettings);

  await query(
    `INSERT INTO store_settings (id, settings_json, created_at, updated_at)
     VALUES (1, ?, NOW(), NOW())
     ON DUPLICATE KEY UPDATE 
       settings_json = VALUES(settings_json),
       updated_at = NOW()`,
    [jsonString]
  );

  return nextSettings;
}
