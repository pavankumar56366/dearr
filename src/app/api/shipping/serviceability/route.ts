import { NextRequest, NextResponse } from "next/server";
import {
  isShiprocketConfigured,
  isShiprocketEnabled,
  checkCourierServiceability,
} from "@/lib/server/shiprocket";

// 30-minute in-memory cache for serviceability lookups to minimize external API hits
interface CacheEntry {
  timestamp: number;
  data: any;
}

const SERVICEABILITY_CACHE = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
const MAX_CACHE_ENTRIES = 1000;

function getCachedServiceability(key: string): any | null {
  const entry = SERVICEABILITY_CACHE.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    SERVICEABILITY_CACHE.delete(key);
    return null;
  }
  return entry.data;
}

function setCachedServiceability(key: string, data: any): void {
  // Simple eviction if map grows too large
  if (SERVICEABILITY_CACHE.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = SERVICEABILITY_CACHE.keys().next().value;
    if (oldestKey) SERVICEABILITY_CACHE.delete(oldestKey);
  }
  SERVICEABILITY_CACHE.set(key, { timestamp: Date.now(), data });
}

/**
 * GET /api/shipping/serviceability
 * Checks deliverability and estimated delivery timeframe for an Indian pincode.
 *
 * Query Params:
 *  - pincode: string (6-digit Indian pincode)
 *  - weight: number (weight in kg, defaults to 0.5)
 *  - cod: boolean (optional, true if checking COD availability)
 *  - declared_value: number (optional order amount for insurance/rate calc)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const deliveryPincode = (searchParams.get("pincode") || "").trim();
    const weightKg = parseFloat(searchParams.get("weight") || "0.5") || 0.5;
    const isCod = searchParams.get("cod") === "true";
    const declaredValue = parseFloat(searchParams.get("declared_value") || "0") || undefined;

    // Validate 6-digit Indian PIN code format
    if (!/^[1-9][0-9]{5}$/.test(deliveryPincode)) {
      return NextResponse.json(
        {
          ok: false,
          error: "Invalid delivery pincode. Please enter a valid 6-digit Indian PIN code.",
        },
        { status: 400 }
      );
    }

    const cacheKey = `${deliveryPincode}:${isCod ? 1 : 0}:${weightKg}`;
    const cached = getCachedServiceability(cacheKey);
    if (cached) {
      return NextResponse.json({
        ...cached,
        cached: true,
      });
    }

    // Default warehouse/store origin pincode if not provided
    const pickupPincode = (
      process.env.SHIPROCKET_PICKUP_PINCODE ||
      process.env.DEFAULT_STORE_PINCODE ||
      "560001"
    ).trim();

    // If Shiprocket integration is not configured or disabled in environment,
    // respond gracefully with standard domestic delivery fallback (₹50 fallback).
    if (!isShiprocketConfigured() || !isShiprocketEnabled()) {
      const fallbackData = {
        ok: true,
        source: "fallback",
        serviceable: true,
        deliveryPincode,
        estimatedDeliveryDays: 3,
        estimatedDeliveryText: "3 to 5 business days",
        availableCouriers: [
          {
            courierCompanyId: 0,
            courierName: "Standard Express Delivery",
            rate: 50,
            etd: "3-5 business days",
            cod: isCod ? 1 : 0,
          },
        ],
      };
      setCachedServiceability(cacheKey, fallbackData);
      return NextResponse.json(fallbackData);
    }

    const result = await checkCourierServiceability({
      pickupPincode,
      deliveryPincode,
      weightKg,
      cod: isCod,
      declaredValue,
    });

    const couriers = result.availableCouriers.map((c) => ({
      courierCompanyId: c.courier_company_id,
      courierName: c.courier_name,
      rate: c.rate,
      etd: c.etd,
      estimatedDeliveryDays: c.estimated_delivery_days,
      cod: c.cod,
      rating: c.rating,
    }));

    const responseData = {
      ok: true,
      source: "shiprocket",
      serviceable: result.isServiceable,
      deliveryPincode,
      recommendedCourier: result.recommendedCourierName,
      availableCouriers: couriers,
    };

    setCachedServiceability(cacheKey, responseData);
    return NextResponse.json(responseData);
  } catch (err: any) {
    console.error("[Shiprocket Serviceability API Error]:", err);
    // Graceful fallback to avoid blocking customer checkout (flat ₹50 fallback)
    return NextResponse.json(
      {
        ok: true,
        source: "fallback_on_error",
        serviceable: true,
        message: "Delivery is available to your pincode.",
        estimatedDeliveryDays: 4,
        rate: 50,
      },
      { status: 200 }
    );
  }
}
