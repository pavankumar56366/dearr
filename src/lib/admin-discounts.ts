export type DiscountType = "percentage" | "fixed";
export type DiscountScope = "all" | "products" | "categories";
export type DiscountStatus = "draft" | "scheduled" | "active" | "expired" | "deactivated";

export interface AdminDiscount {
  id: string;
  code: string;
  name: string;
  description?: string;
  type: DiscountType;
  value: number;
  minimumOrderValue?: number;
  maximumDiscountAmount?: number;
  usageLimit: number | null; // null = unlimited
  usageCount: number;
  startsAt?: string; // YYYY-MM-DD
  endsAt?: string; // YYYY-MM-DD
  appliesTo: DiscountScope;
  productIds?: string[];
  categorySlugs?: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DiscountMetrics {
  totalDiscounts: number;
  activeDiscounts: number;
  scheduledDiscounts: number;
  expiredDiscounts: number;
  deactivatedDiscounts: number;
  draftDiscounts: number;
  totalRedemptions: number;
}

/**
 * Base Demo Discounts representing realistic 3D print store promotions.
 * Spans Active, Scheduled, Expired, and Deactivated states.
 */
export const BASE_DISCOUNTS: AdminDiscount[] = [
  {
    id: "dsc-dearr10",
    code: "DEARR10",
    name: "Sitewide Launch Offer",
    description: "Flat 10% discount on all artisan 3D printed artifacts for our store launch.",
    type: "percentage",
    value: 10,
    minimumOrderValue: 499,
    maximumDiscountAmount: 200,
    usageLimit: 500,
    usageCount: 42,
    startsAt: "2026-09-01",
    endsAt: "2026-12-31",
    appliesTo: "all",
    isActive: true,
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
  },
  {
    id: "dsc-welcome200",
    code: "WELCOME200",
    name: "Welcome First Order",
    description: "Flat ₹200 off for first-time shoppers on orders above ₹999.",
    type: "fixed",
    value: 200,
    minimumOrderValue: 999,
    usageLimit: null, // Unlimited
    usageCount: 18,
    startsAt: "2026-09-15",
    appliesTo: "all",
    isActive: true,
    createdAt: "2026-09-15T00:00:00.000Z",
    updatedAt: "2026-09-15T00:00:00.000Z",
  },
  {
    id: "dsc-festive15",
    code: "FESTIVE15",
    name: "Diwali Spiritual Collection",
    description: "Exclusive 15% discount on all hand-finished Spiritual Idols.",
    type: "percentage",
    value: 15,
    minimumOrderValue: 1299,
    maximumDiscountAmount: 350,
    usageLimit: 200,
    usageCount: 0,
    startsAt: "2026-10-15",
    endsAt: "2026-11-15",
    appliesTo: "categories",
    categorySlugs: ["spiritual-idols"],
    isActive: true,
    createdAt: "2026-09-20T00:00:00.000Z",
    updatedAt: "2026-09-20T00:00:00.000Z",
  },
  {
    id: "dsc-flash50",
    code: "FLASH50",
    name: "Early Bird Flash Voucher",
    description: "Quick ₹50 discount voucher for early workshop tester accounts.",
    type: "fixed",
    value: 50,
    minimumOrderValue: 299,
    usageLimit: 50,
    usageCount: 50,
    startsAt: "2026-08-01",
    endsAt: "2026-08-31",
    appliesTo: "all",
    isActive: true,
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-31T00:00:00.000Z",
  },
  {
    id: "dsc-vipclub20",
    code: "VIPCLUB20",
    name: "VIP Collector Privilege",
    description: "20% off high-detail poseable models and articulated shelf toys.",
    type: "percentage",
    value: 20,
    minimumOrderValue: 1999,
    maximumDiscountAmount: 600,
    usageLimit: 100,
    usageCount: 8,
    startsAt: "2026-09-01",
    endsAt: "2026-12-31",
    appliesTo: "categories",
    categorySlugs: ["articulated-toys"],
    isActive: false,
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-25T00:00:00.000Z",
  },
];

const STORAGE_KEY_DISCOUNTS = "dearr_admin_discounts";

function safeParseJSON<T>(value: string | null, fallback: T): T {
  if (!value || typeof value !== "string" || !value.trim()) return fallback;
  try {
    const parsed = JSON.parse(value);
    return parsed !== null && parsed !== undefined ? (parsed as T) : fallback;
  } catch {
    return fallback;
  }
}

/**
 * Convert a Date object or YYYY-MM-DD date string into a local calendar YYYYMMDD integer.
 * Ensures robust, date-only comparison immune to time-of-day, hours, minutes, and time zones.
 */
export function toDateNumber(dateInput: string | Date | undefined | null): number | null {
  if (!dateInput) return null;
  if (dateInput instanceof Date) {
    if (isNaN(dateInput.getTime())) return null;
    return dateInput.getFullYear() * 10000 + (dateInput.getMonth() + 1) * 100 + dateInput.getDate();
  }
  const clean = dateInput.split("T")[0].trim();
  const parts = clean.split("-").map((p) => parseInt(p, 10));
  if (parts.length !== 3 || parts.some(isNaN)) return null;
  return parts[0] * 10000 + parts[1] * 100 + parts[2];
}

/**
 * Compute derived discount status based on active state, validity dates, and configuration.
 * Single source of truth for discount status across Dearr Admin.
 *
 * Rules:
 * - Deactivated: isActive = false
 * - Draft: startsAt is missing OR required configuration is incomplete (e.g. no code or value <= 0)
 * - Scheduled: isActive = true and current date < startsAt
 * - Active: isActive = true, current date >= startsAt, and (no endsAt OR current date <= endsAt)
 * - Expired: isActive = true and endsAt exists and current date > endsAt
 */
export function getDiscountStatus(discount: AdminDiscount, now: Date = new Date()): DiscountStatus {
  if (!discount.isActive) {
    return "deactivated";
  }

  if (!discount.code || !discount.value || discount.value <= 0 || !discount.startsAt) {
    return "draft";
  }

  const currentDateNum = toDateNumber(now);
  const startDateNum = toDateNumber(discount.startsAt);
  const endDateNum = toDateNumber(discount.endsAt);

  if (currentDateNum === null || startDateNum === null) {
    return "draft";
  }

  // Current date is before start date -> Scheduled
  if (currentDateNum < startDateNum) {
    return "scheduled";
  }

  // End date exists and current date is strictly after end date -> Expired
  if (endDateNum !== null && currentDateNum > endDateNum) {
    return "expired";
  }

  // Current date >= startsAt and (no endsAt OR current date <= endsAt) -> Active
  return "active";
}

/**
 * Retrieve all admin discounts from sessionStorage, falling back to BASE_DISCOUNTS.
 */
export function getAllAdminDiscounts(): AdminDiscount[] {
  let discounts: AdminDiscount[] = [...BASE_DISCOUNTS];

  if (typeof window !== "undefined") {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY_DISCOUNTS);
      if (stored) {
        const parsed = safeParseJSON<AdminDiscount[]>(stored, []);
        if (Array.isArray(parsed) && parsed.length > 0) {
          discounts = parsed;
        }
      }
    } catch (err) {
      console.warn("Failed to read admin discounts from session:", err);
    }
  }

  return discounts;
}

/**
 * Find an admin discount by its coupon code (case-insensitive).
 */
export function getAdminDiscountByCode(code: string): AdminDiscount | null {
  const all = getAllAdminDiscounts();
  const normalized = code.trim().toUpperCase();
  return all.find((d) => d.code.toUpperCase() === normalized) || null;
}

/**
 * Persist a newly created discount into sessionStorage.
 */
export function saveAdminDiscount(discount: AdminDiscount): void {
  if (typeof window === "undefined") return;

  try {
    const current = getAllAdminDiscounts();
    const normalizedCode = discount.code.trim().toUpperCase();
    const exists = current.some(
      (d) => d.id === discount.id || d.code.toUpperCase() === normalizedCode
    );

    let updated: AdminDiscount[];
    if (exists) {
      updated = current.map((d) =>
        d.id === discount.id || d.code.toUpperCase() === normalizedCode
          ? { ...discount, code: normalizedCode, updatedAt: new Date().toISOString() }
          : d
      );
    } else {
      updated = [
        {
          ...discount,
          code: normalizedCode,
          createdAt: discount.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        ...current,
      ];
    }

    sessionStorage.setItem(STORAGE_KEY_DISCOUNTS, JSON.stringify(updated));
  } catch (err) {
    console.warn("Failed to save admin discount:", err);
  }
}

/**
 * Update an existing discount by its code.
 */
export function updateAdminDiscount(
  code: string,
  updates: Partial<AdminDiscount>
): AdminDiscount | null {
  if (typeof window === "undefined") return null;

  try {
    const current = getAllAdminDiscounts();
    const normalizedCode = code.trim().toUpperCase();
    const index = current.findIndex((d) => d.code.toUpperCase() === normalizedCode);

    if (index === -1) return null;

    const existing = current[index];
    const updatedDiscount: AdminDiscount = {
      ...existing,
      ...updates,
      code: updates.code ? updates.code.trim().toUpperCase() : existing.code,
      updatedAt: new Date().toISOString(),
    };

    current[index] = updatedDiscount;
    sessionStorage.setItem(STORAGE_KEY_DISCOUNTS, JSON.stringify(current));
    return updatedDiscount;
  } catch (err) {
    console.warn("Failed to update admin discount:", err);
    return null;
  }
}

/**
 * Toggle the active status of a discount.
 */
export function toggleAdminDiscountStatus(code: string): AdminDiscount | null {
  const current = getAdminDiscountByCode(code);
  if (!current) return null;

  return updateAdminDiscount(code, {
    isActive: !current.isActive,
  });
}

/**
 * Duplicate a discount with a unique inactive copy code.
 */
export function duplicateAdminDiscount(code: string): AdminDiscount | null {
  const source = getAdminDiscountByCode(code);
  if (!source) return null;

  const all = getAllAdminDiscounts();
  const baseCode = source.code.replace(/-COPY(-\d+)?$/i, "");
  let copyCode = `${baseCode}-COPY`;
  let counter = 2;

  while (all.some((d) => d.code.toUpperCase() === copyCode.toUpperCase())) {
    copyCode = `${baseCode}-COPY-${counter}`;
    counter++;
  }

  const duplicated: AdminDiscount = {
    ...source,
    id: `dsc-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    code: copyCode,
    name: `${source.name} (Copy)`,
    isActive: false, // New duplicates start deactivated as required
    usageCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  saveAdminDiscount(duplicated);
  return duplicated;
}

/**
 * Calculate operational summary metrics across all discounts.
 */
export function getDiscountMetrics(discounts: AdminDiscount[], now: Date = new Date()): DiscountMetrics {
  let active = 0;
  let scheduled = 0;
  let expired = 0;
  let deactivated = 0;
  let draft = 0;
  let totalRedemptions = 0;

  for (const d of discounts) {
    const status = getDiscountStatus(d, now);
    if (status === "active") active++;
    else if (status === "scheduled") scheduled++;
    else if (status === "expired") expired++;
    else if (status === "deactivated") deactivated++;
    else if (status === "draft") draft++;

    totalRedemptions += Number(d.usageCount) || 0;
  }

  return {
    totalDiscounts: discounts.length,
    activeDiscounts: active,
    scheduledDiscounts: scheduled,
    expiredDiscounts: expired,
    deactivatedDiscounts: deactivated,
    draftDiscounts: draft,
    totalRedemptions,
  };
}
