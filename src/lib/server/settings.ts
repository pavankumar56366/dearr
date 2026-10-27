import "server-only";
import crypto from "crypto";
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
  updates: Partial<AdminSettings>,
  actorAdminId?: string
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

  // Address Change Policies Validation
  if (updates.allowAddressChange !== undefined && typeof updates.allowAddressChange !== "boolean") {
    throw new Error("allowAddressChange must be a boolean value");
  }

  if (updates.addressChangeWindowHours !== undefined) {
    const hours = Number(updates.addressChangeWindowHours);
    if (!Number.isInteger(hours) || hours < 1 || hours > 72) {
      throw new Error("Address change window must be an integer between 1 and 72 hours");
    }
  }

  if (updates.maxAddressChangesPerOrder !== undefined) {
    const maxChanges = Number(updates.maxAddressChangesPerOrder);
    if (!Number.isInteger(maxChanges) || maxChanges < 1 || maxChanges > 10) {
      throw new Error("Maximum address changes per order must be an integer between 1 and 10");
    }
  }

  // Abandonment Recovery Policies Validation
  if (updates.recoverySheetEnabled !== undefined && typeof updates.recoverySheetEnabled !== "boolean") {
    throw new Error("recoverySheetEnabled must be a boolean value");
  }

  if (updates.alternativesEnabled !== undefined && typeof updates.alternativesEnabled !== "boolean") {
    throw new Error("alternativesEnabled must be a boolean value");
  }

  if (updates.feedbackEnabled !== undefined && typeof updates.feedbackEnabled !== "boolean") {
    throw new Error("feedbackEnabled must be a boolean value");
  }

  if (updates.maxAlternatives !== undefined) {
    const maxAlt = Number(updates.maxAlternatives);
    if (!Number.isInteger(maxAlt) || maxAlt < 1 || maxAlt > 4) {
      throw new Error("Maximum alternatives must be an integer between 1 and 4");
    }
  }

  if (updates.feedbackReasons !== undefined) {
    if (!Array.isArray(updates.feedbackReasons) || updates.feedbackReasons.length === 0) {
      throw new Error("Feedback reasons must be a non-empty array of strings");
    }
    for (const r of updates.feedbackReasons) {
      if (typeof r !== "string" || r.trim().length === 0 || r.length > 100) {
        throw new Error("Each feedback reason must be a string between 1 and 100 characters");
      }
    }
  }

  // Logistics & Shipping Controls Validation
  if (updates.codMinimumFee !== undefined && updates.codMinimumFee < 0) {
    throw new Error("COD minimum fee cannot be negative");
  }

  if (updates.codMaxOrderValue !== undefined && updates.codMaxOrderValue < 0) {
    throw new Error("Maximum COD order value cannot be negative");
  }

  if (updates.fallbackShippingFee !== undefined && updates.fallbackShippingFee < 0) {
    throw new Error("Fallback shipping fee cannot be negative");
  }

  if (
    updates.shippingMarkupType !== undefined &&
    updates.shippingMarkupType !== "fixed" &&
    updates.shippingMarkupType !== "percentage"
  ) {
    throw new Error("Shipping markup type must be either 'fixed' or 'percentage'");
  }

  if (updates.shippingMarkupValue !== undefined && updates.shippingMarkupValue < 0) {
    throw new Error("Shipping markup value cannot be negative");
  }

  if (updates.shippingMarkupCap !== undefined && updates.shippingMarkupCap < 0) {
    throw new Error("Shipping markup cap cannot be negative");
  }

  if (
    updates.courierStrategy !== undefined &&
    updates.courierStrategy !== "recommended" &&
    updates.courierStrategy !== "cheapest" &&
    updates.courierStrategy !== "fastest"
  ) {
    throw new Error("Courier selection strategy must be 'recommended', 'cheapest', or 'fastest'");
  }

  if (updates.defaultPackageLength !== undefined && updates.defaultPackageLength <= 0) {
    throw new Error("Default package length must be greater than zero");
  }

  if (updates.defaultPackageWidth !== undefined && updates.defaultPackageWidth <= 0) {
    throw new Error("Default package width must be greater than zero");
  }

  if (updates.defaultPackageHeight !== undefined && updates.defaultPackageHeight <= 0) {
    throw new Error("Default package height must be greater than zero");
  }

  if (updates.defaultPackageWeightKg !== undefined && updates.defaultPackageWeightKg <= 0) {
    throw new Error("Default package weight must be greater than zero kg");
  }

  if (updates.dispatchTimeText !== undefined) {
    if (typeof updates.dispatchTimeText !== "string" || updates.dispatchTimeText.trim().length > 120) {
      throw new Error("Dispatch time wording cannot exceed 120 characters");
    }
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
    codMinimumFee:
      updates.codMinimumFee !== undefined
        ? Number(updates.codMinimumFee)
        : current.codMinimumFee ?? DEFAULT_ADMIN_SETTINGS.codMinimumFee,
    codMaxOrderValue:
      updates.codMaxOrderValue !== undefined
        ? Number(updates.codMaxOrderValue)
        : current.codMaxOrderValue ?? DEFAULT_ADMIN_SETTINGS.codMaxOrderValue,
    fallbackShippingFee:
      updates.fallbackShippingFee !== undefined
        ? Number(updates.fallbackShippingFee)
        : current.fallbackShippingFee ?? DEFAULT_ADMIN_SETTINGS.fallbackShippingFee,
    shippingMarkupType:
      updates.shippingMarkupType !== undefined
        ? updates.shippingMarkupType
        : current.shippingMarkupType ?? DEFAULT_ADMIN_SETTINGS.shippingMarkupType,
    shippingMarkupValue:
      updates.shippingMarkupValue !== undefined
        ? Number(updates.shippingMarkupValue)
        : current.shippingMarkupValue ?? DEFAULT_ADMIN_SETTINGS.shippingMarkupValue,
    shippingMarkupCap:
      updates.shippingMarkupCap !== undefined
        ? Number(updates.shippingMarkupCap)
        : current.shippingMarkupCap ?? DEFAULT_ADMIN_SETTINGS.shippingMarkupCap,
    courierStrategy:
      updates.courierStrategy !== undefined
        ? updates.courierStrategy
        : current.courierStrategy ?? DEFAULT_ADMIN_SETTINGS.courierStrategy,
    defaultPackageLength:
      updates.defaultPackageLength !== undefined
        ? Number(updates.defaultPackageLength)
        : current.defaultPackageLength ?? DEFAULT_ADMIN_SETTINGS.defaultPackageLength,
    defaultPackageWidth:
      updates.defaultPackageWidth !== undefined
        ? Number(updates.defaultPackageWidth)
        : current.defaultPackageWidth ?? DEFAULT_ADMIN_SETTINGS.defaultPackageWidth,
    defaultPackageHeight:
      updates.defaultPackageHeight !== undefined
        ? Number(updates.defaultPackageHeight)
        : current.defaultPackageHeight ?? DEFAULT_ADMIN_SETTINGS.defaultPackageHeight,
    defaultPackageWeightKg:
      updates.defaultPackageWeightKg !== undefined
        ? Number(updates.defaultPackageWeightKg)
        : current.defaultPackageWeightKg ?? DEFAULT_ADMIN_SETTINGS.defaultPackageWeightKg,
    dispatchTimeText:
      updates.dispatchTimeText !== undefined
        ? updates.dispatchTimeText.trim()
        : current.dispatchTimeText ?? DEFAULT_ADMIN_SETTINGS.dispatchTimeText,
    cancellationWindowHours:
      updates.cancellationWindowHours !== undefined
        ? Number(updates.cancellationWindowHours)
        : current.cancellationWindowHours,
    allowAddressChange:
      updates.allowAddressChange !== undefined
        ? Boolean(updates.allowAddressChange)
        : current.allowAddressChange ?? true,
    addressChangeWindowHours:
      updates.addressChangeWindowHours !== undefined
        ? Number(updates.addressChangeWindowHours)
        : current.addressChangeWindowHours ?? 6,
    maxAddressChangesPerOrder:
      updates.maxAddressChangesPerOrder !== undefined
        ? Number(updates.maxAddressChangesPerOrder)
        : current.maxAddressChangesPerOrder ?? 2,
    recoverySheetEnabled:
      updates.recoverySheetEnabled !== undefined
        ? Boolean(updates.recoverySheetEnabled)
        : current.recoverySheetEnabled ?? true,
    alternativesEnabled:
      updates.alternativesEnabled !== undefined
        ? Boolean(updates.alternativesEnabled)
        : current.alternativesEnabled ?? true,
    feedbackEnabled:
      updates.feedbackEnabled !== undefined
        ? Boolean(updates.feedbackEnabled)
        : current.feedbackEnabled ?? true,
    maxAlternatives:
      updates.maxAlternatives !== undefined
        ? Number(updates.maxAlternatives)
        : current.maxAlternatives ?? 4,
    feedbackReasons:
      updates.feedbackReasons !== undefined
        ? updates.feedbackReasons.map((r) => r.trim())
        : current.feedbackReasons ?? DEFAULT_ADMIN_SETTINGS.feedbackReasons,
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

  // Record audit history if an administrator performed the change
  if (actorAdminId) {
    try {
      const changedKeys = (Object.keys(updates) as (keyof AdminSettings)[]).filter(
        (key) => updates[key] !== undefined && updates[key] !== current[key]
      );

      for (const key of changedKeys) {
        const auditId = crypto.randomUUID();
        const oldVal = current[key] !== undefined ? JSON.stringify(current[key]) : null;
        const newVal = JSON.stringify(nextSettings[key]);

        await query(
          `INSERT INTO settings_audit_history (id, actor_id, setting_name, old_value, new_value, created_at)
           VALUES (?, ?, ?, ?, ?, NOW())`,
          [auditId, actorAdminId, String(key), oldVal, newVal]
        );
      }

      if (changedKeys.length > 0) {
        const logId = crypto.randomUUID();
        await query(
          `INSERT INTO audit_logs (id, actor_id, action, entity, entity_id, details, created_at)
           VALUES (?, ?, 'update_settings', 'store_settings', '1', ?, NOW())`,
          [
            logId,
            actorAdminId,
            JSON.stringify({
              changedKeys,
              changes: changedKeys.reduce((acc, k) => {
                acc[k] = { previous: current[k], updated: nextSettings[k] };
                return acc;
              }, {} as Record<string, any>),
            }),
          ]
        );
      }
    } catch (auditErr) {
      console.warn("[updateStoreSettings] Failed to record settings audit history:", auditErr);
    }
  }

  return nextSettings;
}

export interface SettingsAuditRecord {
  id: string;
  actorId: string;
  settingName: string;
  oldValue: any;
  newValue: any;
  createdAt: Date;
}

/**
 * Retrieves audit history for administrative store settings modifications.
 */
export async function getSettingsAuditHistory(limit = 50): Promise<SettingsAuditRecord[]> {
  try {
    const safeLimit = Math.max(1, Math.min(limit, 200));
    const rows = await query<any[]>(
      `SELECT id, actor_id, setting_name, old_value, new_value, created_at
       FROM settings_audit_history
       ORDER BY created_at DESC
       LIMIT ?`,
      [safeLimit]
    );

    return (rows || []).map((r) => ({
      id: r.id,
      actorId: r.actor_id,
      settingName: r.setting_name,
      oldValue: typeof r.old_value === "string" ? JSON.parse(r.old_value) : r.old_value,
      newValue: typeof r.new_value === "string" ? JSON.parse(r.new_value) : r.new_value,
      createdAt: new Date(r.created_at),
    }));
  } catch (err) {
    console.warn("[getSettingsAuditHistory] Failed to retrieve settings audit history:", err);
    return [];
  }
}

/**
 * Database-backed persistent rate limiter across multiple Node.js instances.
 * Increments request count for the given rate_key and returns whether the request is allowed.
 */
export async function checkRateLimit(
  rateKey: string,
  maxHits = 5,
  windowSeconds = 60,
  increment = true
): Promise<{ allowed: boolean; remaining: number; retryAfterSeconds: number }> {
  try {
    const now = new Date();
    const rows = await query<any[]>(
      `SELECT hits, reset_at FROM rate_limits WHERE rate_key = ? LIMIT 1`,
      [rateKey]
    );

    if (!rows || rows.length === 0) {
      if (!increment) {
        return { allowed: true, remaining: maxHits, retryAfterSeconds: 0 };
      }
      const resetAt = new Date(now.getTime() + windowSeconds * 1000);
      await query(
        `INSERT INTO rate_limits (rate_key, hits, reset_at) VALUES (?, 1, ?)`,
        [rateKey, resetAt]
      );
      return { allowed: true, remaining: maxHits - 1, retryAfterSeconds: 0 };
    }

    const record = rows[0];
    const resetAt = new Date(record.reset_at);

    if (now >= resetAt) {
      if (!increment) {
        return { allowed: true, remaining: maxHits, retryAfterSeconds: 0 };
      }
      // Window expired, reset window
      const newResetAt = new Date(now.getTime() + windowSeconds * 1000);
      await query(
        `UPDATE rate_limits SET hits = 1, reset_at = ? WHERE rate_key = ?`,
        [newResetAt, rateKey]
      );
      return { allowed: true, remaining: maxHits - 1, retryAfterSeconds: 0 };
    }

    // Within window
    if (record.hits >= maxHits) {
      const retryAfter = Math.ceil((resetAt.getTime() - now.getTime()) / 1000);
      return { allowed: false, remaining: 0, retryAfterSeconds: Math.max(1, retryAfter) };
    }

    if (!increment) {
      return {
        allowed: true,
        remaining: Math.max(0, maxHits - record.hits),
        retryAfterSeconds: 0,
      };
    }

    await query(
      `UPDATE rate_limits SET hits = hits + 1 WHERE rate_key = ?`,
      [rateKey]
    );
    return {
      allowed: true,
      remaining: Math.max(0, maxHits - (record.hits + 1)),
      retryAfterSeconds: 0,
    };
  } catch (err) {
    console.warn("[checkRateLimit] Fallback on error:", err);
    return { allowed: true, remaining: 1, retryAfterSeconds: 0 };
  }
}

/**
 * Resets or clears one or more rate limit keys (e.g. upon successful authentication).
 */
export async function clearRateLimit(rateKeys: string | string[]): Promise<void> {
  try {
    const keys = (Array.isArray(rateKeys) ? rateKeys : [rateKeys])
      .map((k) => k?.trim())
      .filter(Boolean);
    if (keys.length === 0) return;
    const placeholders = keys.map(() => "?").join(", ");
    await query(`DELETE FROM rate_limits WHERE rate_key IN (${placeholders})`, keys);
  } catch (err) {
    console.warn("[clearRateLimit] Failed to clear rate limits:", err);
  }
}
