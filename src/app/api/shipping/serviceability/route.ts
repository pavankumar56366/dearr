import { NextRequest, NextResponse } from "next/server";
import {
  isShiprocketConfigured,
  isShiprocketEnabled,
  checkCourierServiceability,
} from "@/lib/server/shiprocket";

// 30-minute in-memory cache for serviceability lookups per pincode + cod flag
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
  if (SERVICEABILITY_CACHE.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = SERVICEABILITY_CACHE.keys().next().value;
    if (oldestKey) SERVICEABILITY_CACHE.delete(oldestKey);
  }
  SERVICEABILITY_CACHE.set(key, { timestamp: Date.now(), data });
}

// In-memory per-IP rate limiting: 60 requests per minute
const ipRateLimitMap = new Map<string, { count: number; resetAt: number }>();
const IP_RATE_LIMIT_WINDOW_MS = 60 * 1000;
const IP_RATE_LIMIT_MAX = 60;

function checkIpRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = ipRateLimitMap.get(ip);
  if (!record || now > record.resetAt) {
    ipRateLimitMap.set(ip, { count: 1, resetAt: now + IP_RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (record.count >= IP_RATE_LIMIT_MAX) {
    return false;
  }
  record.count++;
  return true;
}

/**
 * GET /api/shipping/serviceability
 * Public endpoint to check deliverability and estimated delivery timeframe for an Indian PIN code.
 *
 * Security & Data Privacy Constraints (A8):
 * - Per-IP rate limiting (60 req/min)
 * - Server-side caching (~30 min per pincode + cod flag)
 * - Strict 6-digit Indian PIN code validation (/^[1-9][0-9]{5}$/)
 * - Response strictly limited to serviceable / estimated days / courier name
 * - NEVER leaks base courier rate, markup, or internal freight accounting
 */
export async function GET(request: NextRequest) {
  try {
    // 1. Per-IP Rate Limiting
    const forwarded = request.headers.get("x-forwarded-for");
    const ip = forwarded ? forwarded.split(",")[0].trim() : "127.0.0.1";

    if (!checkIpRateLimit(ip)) {
      return NextResponse.json(
        {
          ok: false,
          error: "Too many serviceability requests. Please try again in a minute.",
        },
        { status: 429 }
      );
    }

    const { searchParams } = new URL(request.url);
    const deliveryPincode = (searchParams.get("pincode") || "").trim();
    const weightKg = parseFloat(searchParams.get("weight") || "0.5") || 0.5;
    const isCod = searchParams.get("cod") === "true";
    const declaredValue = parseFloat(searchParams.get("declared_value") || "0") || undefined;

    // 2. Strict 6-digit Indian PIN code format validation
    if (!/^[1-9][0-9]{5}$/.test(deliveryPincode)) {
      return NextResponse.json(
        {
          ok: false,
          error: "Invalid delivery pincode. Please enter a valid 6-digit Indian PIN code.",
        },
        { status: 400 }
      );
    }

    // 3. Cache lookup (30 min per pincode + cod flag)
    const cacheKey = `${deliveryPincode}:${isCod ? 1 : 0}`;
    const cached = getCachedServiceability(cacheKey);
    if (cached) {
      return NextResponse.json({
        ...cached,
        cached: true,
      });
    }

    // Default warehouse/store origin pincode
    const pickupPincode = (
      process.env.SHIPROCKET_PICKUP_PINCODE ||
      process.env.DEFAULT_STORE_PINCODE ||
      "560001"
    ).trim();

    // 4. Fallback if Shiprocket integration is not configured or disabled
    if (!isShiprocketConfigured() || !isShiprocketEnabled()) {
      const fallbackData = {
        ok: true,
        serviceable: true,
        deliveryPincode,
        estimatedDeliveryDays: 4,
        estimatedDeliveryText: "3 to 5 business days",
        courierName: "Standard Express Delivery",
        recommendedCourier: "Standard Express Delivery",
      };
      setCachedServiceability(cacheKey, fallbackData);
      return NextResponse.json(fallbackData);
    }

    // 5. Live Shiprocket check
    const result = await checkCourierServiceability({
      pickupPincode,
      deliveryPincode,
      weightKg,
      cod: isCod,
      declaredValue,
    });

    const primaryCourier = result.availableCouriers?.[0];
    const estimatedDays = primaryCourier?.estimated_delivery_days
      ? Number(primaryCourier.estimated_delivery_days)
      : 3;
    const courierName =
      result.recommendedCourierName ||
      primaryCourier?.courier_name ||
      "Standard Courier";

    const responseData = {
      ok: true,
      serviceable: result.isServiceable,
      deliveryPincode,
      estimatedDeliveryDays: estimatedDays,
      estimatedDeliveryText: `${estimatedDays} to ${estimatedDays + 2} business days`,
      courierName,
      recommendedCourier: courierName,
      ...(result.isServiceable
        ? {}
        : { message: "Delivery is currently not available to this pincode." }),
    };

    setCachedServiceability(cacheKey, responseData);
    return NextResponse.json(responseData);
  } catch (err: any) {
    console.error("[Shiprocket Serviceability API Error]:", err);
    // Graceful fallback on network error/timeout (standard domestic delivery)
    return NextResponse.json(
      {
        ok: true,
        serviceable: true,
        deliveryPincode: "",
        estimatedDeliveryDays: 4,
        estimatedDeliveryText: "3 to 5 business days",
        courierName: "Standard Express Delivery",
        recommendedCourier: "Standard Express Delivery",
      },
      { status: 200 }
    );
  }
}
