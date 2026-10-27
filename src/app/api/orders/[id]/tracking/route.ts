import { NextRequest, NextResponse } from "next/server";
import {
  requireUser,
  handleAuthError,
  jsonPrivate,
} from "@/lib/server";
import { query } from "@/lib/server/db";
import {
  getOrderById,
  OrderValidationError,
} from "@/lib/server/order";
import { getOrderTrackingStages } from "@/lib/order-tracking";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// In-memory rate limiting map for tracking endpoints (60 req / 10 min window)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 60;

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(key);

  if (!record || now > record.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (record.count >= RATE_LIMIT_MAX_REQUESTS) {
    return false;
  }

  record.count++;
  return true;
}

/**
 * GET /api/orders/[id]/tracking
 * Customer & Admin authenticated endpoint returning real-time tracking stages,
 * courier metadata (AWB, carrier, ETD), and granular scan milestone events.
 *
 * Security:
 * - Customers can ONLY inspect tracking for their own orders (enforced by getOrderById).
 * - Admins can inspect tracking for any order.
 * - Rate-limited to prevent brute-force order scanning.
 */
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const user = await requireUser();
    const { id } = await context.params;

    const rateLimitKey = `${user.id}:${id}`;
    if (!checkRateLimit(rateLimitKey)) {
      return jsonPrivate(
        { ok: false, error: "Too many tracking requests. Please try again shortly." },
        { status: 429 }
      );
    }

    // 1. Authoritative order lookup with customer ownership enforcement
    const order = await getOrderById(id, {
      userId: user.id,
      isAdmin: user.role === "admin",
    });

    // 2. Fetch shipment record from order_shipments if available
    let shipment: any = null;
    try {
      const shipmentRows = await query<any[]>(
        `SELECT id, shiprocket_order_id, shiprocket_shipment_id, awb_code,
                courier_name, status, etd, tracking_url,
                last_tracking_activity, last_tracking_at
         FROM order_shipments
         WHERE order_id = ?
         ORDER BY created_at DESC
         LIMIT 1`,
        [order.id]
      );
      if (shipmentRows.length > 0) {
        shipment = shipmentRows[0];
      }
    } catch {
      // order_shipments table may be empty or unmigrated; fail-soft
    }

    // 3. Fetch granular scan milestone events from shipment_tracking_events
    let scanEvents: any[] = [];
    try {
      const eventRows = await query<any[]>(
        `SELECT id, awb_code, activity, location, event_timestamp, sr_status
         FROM shipment_tracking_events
         WHERE order_id = ?
         ORDER BY event_timestamp DESC
         LIMIT 50`,
        [order.id]
      );
      scanEvents = (eventRows || []).map((e) => ({
        id: e.id,
        awbCode: e.awb_code,
        activity: e.activity,
        location: e.location || null,
        timestamp: new Date(e.event_timestamp).toISOString(),
        status: e.sr_status || null,
      }));
    } catch {
      // Fail-soft if tracking events table is unmigrated or empty
    }

    // 4. Compute canonical 4-stage tracking status
    const stages = getOrderTrackingStages({
      status: order.status,
      paymentStatus: order.paymentStatus,
      paymentMethod: order.paymentMethod,
    });

    const activeAwb = order.awbCode || shipment?.awb_code || null;
    const activeCourier = order.courierName || shipment?.courier_name || null;
    const activeCourierStatus = order.courierStatus || shipment?.status || null;
    const publicTrackingUrl =
      shipment?.tracking_url ||
      (activeAwb ? `https://shiprocket.co/tracking/${encodeURIComponent(activeAwb)}` : null);

    return jsonPrivate({
      ok: true,
      tracking: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        paymentStatus: order.paymentStatus,
        paymentMethod: order.paymentMethod || "prepaid",
        awbCode: activeAwb,
        courierName: activeCourier,
        courierStatus: activeCourierStatus,
        etd: shipment?.etd || null,
        trackingUrl: publicTrackingUrl,
        lastActivity: shipment?.last_tracking_activity || null,
        lastActivityAt: shipment?.last_tracking_at
          ? new Date(shipment.last_tracking_at).toISOString()
          : null,
        stages,
        scanEvents,
      },
    });
  } catch (err) {
    if (err instanceof OrderValidationError) {
      return jsonPrivate(
        { ok: false, error: err.message },
        { status: err.statusCode }
      );
    }
    return handleAuthError(err, "Failed to fetch order tracking details");
  }
}
