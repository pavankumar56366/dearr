import "server-only";
import { getStoreSettings } from "@/lib/server/settings";
import {
  isShiprocketConfigured,
  isShiprocketEnabled,
  checkCourierServiceability,
  type ShiprocketCourierCompany,
} from "@/lib/server/shiprocket";

/**
 * =============================================================================
 * Shipping Quote Domain Model & Calculation Engine (Task S-02)
 * =============================================================================
 * Server-authoritative logistics quote engine:
 *  - Free shipping threshold applied strictly to prepaid orders (₹0).
 *  - Cash on Delivery (COD) orders at or above threshold pay the admin COD fee.
 *  - Max COD order value cap enforcement (admin-configurable, default ₹1500).
 *  - Courier selection strategies: Recommended (Shiprocket AI), Cheapest, Fastest.
 *  - Admin shipping markup (fixed / percentage with cap).
 *  - Fallback flat shipping fee (default ₹50) when API is unavailable.
 *  - 30-minute in-memory caching per route to prevent rate limit starvation.
 * =============================================================================
 */

export interface ShippingCartItem {
  productId?: string;
  quantity?: number;
  codEnabled?: boolean;
  cod_enabled?: boolean | number;
  cod_available?: boolean | number;
  codFee?: number;
  cod_fee?: number;
  price?: number;
}

export interface ShippingQuoteRequest {
  deliveryPincode: string;
  subtotal: number;
  paymentMethod: "prepaid" | "cod" | string;
  weightKg?: number;
  declaredValue?: number;
  productCodFeeOverride?: number;
  cartItems?: ShippingCartItem[];
}

export interface ShippingQuote {
  serviceable: boolean;
  deliveryPincode: string;
  paymentMethod: "prepaid" | "cod";
  isCodEligible: boolean;
  ineligibilityReason?: string;
  baseCourierAmount: number;
  markupAmount: number;
  codFeeAmount: number;
  finalCustomerShippingFee: number;
  rateSource: "free_threshold" | "cod_fee_only" | "live_shiprocket" | "fallback";
  courierCompanyId?: number;
  courierName?: string;
  estimatedDeliveryDays?: number;
  estimatedDeliveryText?: string;
  breakdown: {
    subtotal: number;
    freeShippingThreshold: number;
    isFreeShippingEligible: boolean;
    courierFee: number;
    markupFee: number;
    codFee: number;
    totalShippingCharged: number;
  };
}

// In-memory 30-minute LRU cache for live courier lookups
interface CourierCacheEntry {
  timestamp: number;
  couriers: ShiprocketCourierCompany[];
  recommendedName?: string;
}

const COURIER_CACHE = new Map<string, CourierCacheEntry>();
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
const MAX_CACHE_ENTRIES = 1000;

function getCachedCouriers(key: string): CourierCacheEntry | null {
  const entry = COURIER_CACHE.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    COURIER_CACHE.delete(key);
    return null;
  }
  return entry;
}

function setCachedCouriers(key: string, data: { couriers: ShiprocketCourierCompany[]; recommendedName?: string }): void {
  if (COURIER_CACHE.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = COURIER_CACHE.keys().next().value;
    if (oldestKey) COURIER_CACHE.delete(oldestKey);
  }
  COURIER_CACHE.set(key, { timestamp: Date.now(), ...data });
}

export function clearShippingQuoteCacheForTesting(): void {
  COURIER_CACHE.clear();
}

/**
 * Selects the optimal courier according to founder/admin strategy.
 */
function selectCourierByStrategy(
  couriers: ShiprocketCourierCompany[],
  strategy: "recommended" | "cheapest" | "fastest",
  recommendedName?: string
): ShiprocketCourierCompany | null {
  if (!couriers || couriers.length === 0) return null;

  if (strategy === "cheapest") {
    return [...couriers].sort((a, b) => a.rate - b.rate)[0];
  }

  if (strategy === "fastest") {
    return [...couriers].sort((a, b) => {
      const daysA = Number(a.estimated_delivery_days) || 99;
      const daysB = Number(b.estimated_delivery_days) || 99;
      if (daysA !== daysB) return daysA - daysB;
      return a.rate - b.rate;
    })[0];
  }

  // "recommended" (Shiprocket AI / Smart Routing)
  if (recommendedName) {
    const matched = couriers.find(
      (c) => c.courier_name.toLowerCase() === recommendedName.toLowerCase()
    );
    if (matched) return matched;
  }

  // Fallback: pick courier with highest rating or first available
  return [...couriers].sort((a, b) => (b.rating || 0) - (a.rating || 0))[0];
}

/**
 * Calculates server-authoritative shipping fee and courier quote for an order.
 */
export async function getShippingQuote(
  req: ShippingQuoteRequest
): Promise<ShippingQuote> {
  const cleanPincode = (req.deliveryPincode || "").trim().replace(/\D/g, "");
  if (!/^[1-9][0-9]{5}$/.test(cleanPincode)) {
    throw new Error("Invalid delivery pincode. Must be a valid 6-digit Indian PIN code.");
  }

  const settings = await getStoreSettings();
  const subtotal = Math.max(0, Number(req.subtotal || 0));
  const isCod =
    String(req.paymentMethod || "").toLowerCase().includes("cod") ||
    String(req.paymentMethod || "").toLowerCase().includes("cash");
  const canonicalPaymentMethod: "prepaid" | "cod" = isCod ? "cod" : "prepaid";

  let highestProductCodFee = 0;
  let isCodEligible = true;
  let ineligibilityReason: string | undefined;

  if (req.cartItems && req.cartItems.length > 0) {
    for (const item of req.cartItems) {
      const itemCodFee = Number(item.codFee ?? item.cod_fee ?? 0);
      if (itemCodFee > highestProductCodFee) {
        highestProductCodFee = itemCodFee;
      }
      const isItemCodAllowed =
        item.codEnabled !== false &&
        item.cod_enabled !== 0 &&
        item.cod_enabled !== false &&
        item.cod_available !== 0 &&
        item.cod_available !== false;
      if (!isItemCodAllowed) {
        isCodEligible = false;
        ineligibilityReason = "One or more items in your cart are not eligible for Cash on Delivery.";
      }
    }
  }

  const effectiveCodFee = Math.max(
    settings.codMinimumFee ?? 50,
    highestProductCodFee,
    req.productCodFeeOverride ?? 0
  );

  if (isCod) {
    if (!settings.codEnabled) {
      isCodEligible = false;
      ineligibilityReason = "Cash on Delivery is currently disabled by store policy.";
    } else if (settings.codMaxOrderValue && (subtotal + effectiveCodFee) > settings.codMaxOrderValue) {
      isCodEligible = false;
      ineligibilityReason = `Order total with fees exceeds the maximum Cash on Delivery limit of ₹${settings.codMaxOrderValue}.`;
    }
  }

  const freeShippingThreshold = typeof settings.freeShippingThreshold === "number"
    ? settings.freeShippingThreshold
    : (settings.freeShippingThreshold ? Number(settings.freeShippingThreshold) : 0);
  const isFreeShippingEligible = freeShippingThreshold > 0 && subtotal >= freeShippingThreshold;

  // Case 1: Prepaid order qualifies for free shipping
  if (isFreeShippingEligible && !isCod) {
    return {
      serviceable: true,
      deliveryPincode: cleanPincode,
      paymentMethod: "prepaid",
      isCodEligible,
      ineligibilityReason,
      baseCourierAmount: 0,
      markupAmount: 0,
      codFeeAmount: 0,
      finalCustomerShippingFee: 0,
      rateSource: "free_threshold",
      courierName: "Standard Express Delivery",
      estimatedDeliveryDays: 3,
      estimatedDeliveryText: "3 to 5 business days",
      breakdown: {
        subtotal,
        freeShippingThreshold,
        isFreeShippingEligible: true,
        courierFee: 0,
        markupFee: 0,
        codFee: 0,
        totalShippingCharged: 0,
      },
    };
  }

  // Case 2: COD order reaches free shipping threshold
  // Founder rule: courier shipping is waived, but COD handling fee MUST be paid
  if (isFreeShippingEligible && isCod) {
    return {
      serviceable: true,
      deliveryPincode: cleanPincode,
      paymentMethod: "cod",
      isCodEligible,
      ineligibilityReason,
      baseCourierAmount: 0,
      markupAmount: 0,
      codFeeAmount: effectiveCodFee,
      finalCustomerShippingFee: effectiveCodFee,
      rateSource: "cod_fee_only",
      courierName: "Standard Express Delivery",
      estimatedDeliveryDays: 3,
      estimatedDeliveryText: "3 to 5 business days",
      breakdown: {
        subtotal,
        freeShippingThreshold,
        isFreeShippingEligible: true,
        courierFee: 0,
        markupFee: 0,
        codFee: effectiveCodFee,
        totalShippingCharged: effectiveCodFee,
      },
    };
  }

  // Case 3: Below free shipping threshold -> Calculate courier freight + markup + optional COD fee
  const weightKg = req.weightKg || settings.defaultPackageWeightKg || 0.5;
  const cacheKey = `${cleanPincode}:${isCod ? 1 : 0}:${weightKg}`;

  let selectedCourier: ShiprocketCourierCompany | null = null;
  let recommendedName: string | undefined;
  let apiAttempted = false;
  let apiFailed = false;
  let isLiveServiceable = true;

  if (isShiprocketConfigured() && isShiprocketEnabled()) {
    apiAttempted = true;
    try {
      const cached = getCachedCouriers(cacheKey);
      if (cached) {
        selectedCourier = selectCourierByStrategy(
          cached.couriers,
          settings.courierStrategy || "recommended",
          cached.recommendedName
        );
        isLiveServiceable = cached.couriers.length > 0;
      } else {
        const pickupPincode = (
          process.env.SHIPROCKET_PICKUP_PINCODE ||
          process.env.DEFAULT_STORE_PINCODE ||
          settings.postalCode ||
          "560001"
        ).trim();

        const serviceability = await checkCourierServiceability({
          pickupPincode,
          deliveryPincode: cleanPincode,
          weightKg,
          cod: isCod,
          declaredValue: req.declaredValue || subtotal,
        });

        isLiveServiceable = Boolean(serviceability.isServiceable && serviceability.availableCouriers.length > 0);
        recommendedName = serviceability.recommendedCourierName;

        setCachedCouriers(cacheKey, {
          couriers: serviceability.availableCouriers,
          recommendedName,
        });

        selectedCourier = selectCourierByStrategy(
          serviceability.availableCouriers,
          settings.courierStrategy || "recommended",
          recommendedName
        );
      }
    } catch (err: unknown) {
      console.warn("[getShippingQuote] Shiprocket lookup failed, falling back to static rate:", err);
      apiFailed = true;
      selectedCourier = null;
    }
  }

  // Rule A2: If live Shiprocket lookup was successful and reports unserviceable,
  // we must BLOCK checkout (serviceable: false). Fallback rate applies ONLY on API failure/timeout/disabled.
  if (apiAttempted && !apiFailed && (!isLiveServiceable || !selectedCourier || selectedCourier.rate <= 0)) {
    return {
      serviceable: false,
      deliveryPincode: cleanPincode,
      paymentMethod: canonicalPaymentMethod,
      isCodEligible: false,
      ineligibilityReason: "Delivery is not serviceable for this pincode by available couriers. Please provide a different delivery address.",
      baseCourierAmount: 0,
      markupAmount: 0,
      codFeeAmount: 0,
      finalCustomerShippingFee: 0,
      rateSource: "live_shiprocket",
      courierName: "Unserviceable",
      estimatedDeliveryDays: 0,
      estimatedDeliveryText: "Not Serviceable",
      breakdown: {
        subtotal,
        freeShippingThreshold,
        isFreeShippingEligible: false,
        courierFee: 0,
        markupFee: 0,
        codFee: 0,
        totalShippingCharged: 0,
      },
    };
  }

  // If live courier rate obtained
  if (selectedCourier && selectedCourier.rate > 0) {
    const baseCourierAmount = Math.max(0, Math.round(Number(selectedCourier.rate)));

    // Check if courier supports COD for this specific route
    if (selectedCourier.cod === 0) {
      isCodEligible = false;
      if (!ineligibilityReason) {
        ineligibilityReason = "Cash on Delivery is not serviceable for this delivery pincode by available couriers. Online payment is required.";
      }
    }

    // Calculate admin markup
    let markupAmount = 0;
    if (settings.shippingMarkupType === "percentage") {
      markupAmount = Math.max(0, Math.round((baseCourierAmount * Math.max(0, Number(settings.shippingMarkupValue || 0))) / 100));
    } else {
      markupAmount = Math.max(0, Math.round(Number(settings.shippingMarkupValue ?? 10)));
    }

    if (settings.shippingMarkupCap !== undefined && settings.shippingMarkupCap >= 0) {
      markupAmount = Math.min(markupAmount, Math.max(0, Math.round(Number(settings.shippingMarkupCap))));
    }

    const courierWithMarkup = baseCourierAmount + markupAmount;
    const codFee = isCod ? effectiveCodFee : 0;
    const finalCustomerShippingFee = Math.max(0, courierWithMarkup + codFee);

    return {
      serviceable: isLiveServiceable,
      deliveryPincode: cleanPincode,
      paymentMethod: canonicalPaymentMethod,
      isCodEligible,
      ineligibilityReason,
      baseCourierAmount,
      markupAmount,
      codFeeAmount: codFee,
      finalCustomerShippingFee,
      rateSource: "live_shiprocket",
      courierCompanyId: selectedCourier.courier_company_id,
      courierName: selectedCourier.courier_name,
      estimatedDeliveryDays: Number(selectedCourier.estimated_delivery_days) || 4,
      estimatedDeliveryText: selectedCourier.etd || "3 to 5 business days",
      breakdown: {
        subtotal,
        freeShippingThreshold,
        isFreeShippingEligible: false,
        courierFee: baseCourierAmount,
        markupFee: markupAmount,
        codFee,
        totalShippingCharged: finalCustomerShippingFee,
      },
    };
  }

  // Fallback flat shipping rate when live API is unconfigured, disabled, or unreachable
  const fallbackCourierFee = Math.round(Number(settings.fallbackShippingFee ?? 50));
  const fallbackCodFee = isCod ? effectiveCodFee : 0;
  const fallbackTotal = fallbackCourierFee + fallbackCodFee;

  return {
    serviceable: true,
    deliveryPincode: cleanPincode,
    paymentMethod: canonicalPaymentMethod,
    isCodEligible,
    ineligibilityReason,
    baseCourierAmount: fallbackCourierFee,
    markupAmount: 0,
    codFeeAmount: fallbackCodFee,
    finalCustomerShippingFee: fallbackTotal,
    rateSource: "fallback",
    courierName: "Standard Express Delivery",
    estimatedDeliveryDays: 4,
    estimatedDeliveryText: "3 to 5 business days",
    breakdown: {
      subtotal,
      freeShippingThreshold,
      isFreeShippingEligible: false,
      courierFee: fallbackCourierFee,
      markupFee: 0,
      codFee: fallbackCodFee,
      totalShippingCharged: fallbackTotal,
    },
  };
}
