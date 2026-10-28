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
import { trackShiprocketByAWB } from "@/lib/server/shiprocket";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// In-memory rate limiting map for tracking endpoints (60 req / 10 min window)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 60;

// Refresh throttle interval: 10 minutes per order
const REFRESH_THROTTLE_MS = 10 * 60 * 1000;

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

async function fetchShipment(orderId: string) {
  try {
    const shipmentRows = await query<any[]>(
      `SELECT id, shiprocket_order_id, shiprocket_shipment_id, awb_code,
              courier_name, status, etd, tracking_url,
              last_tracking_activity, last_tracking_at
       FROM order_shipments
       WHERE order_id = ?
       ORDER BY created_at DESC
       LIMIT 1`,
      [orderId]
    );
    return shipmentRows.length > 0 ? shipmentRows[0] : null;
  } catch {
    return null;
  }
}

async function fetchScanEvents(orderId: string) {
  try {
    const eventRows = await query<any[]>(
      `SELECT id, awb_code, activity, location, event_timestamp, sr_status
       FROM shipment_tracking_events
       WHERE order_id = ?
       ORDER BY event_timestamp DESC
       LIMIT 50`,
      [orderId]
    );
    return (eventRows || []).map((e) => ({
      id: e.id,
      awbCode: e.awb_code,
      activity: e.activity,
      location: e.location || null,
      timestamp: new Date(e.event_timestamp).toISOString(),
      status: e.sr_status || null,
    }));
  } catch {
    return [];
  }
}

function buildTrackingPayload(order: any, shipment: any, scanEvents: any[]) {
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

  return {
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
  };
}

/**
 * GET /api/orders/[id]/tracking
 * Customer & Admin authenticated endpoint returning real-time tracking stages,
 * courier metadata (AWB, carrier, ETD), and granular scan milestone events.
 *
 * NOTE: GET serves strictly from the database only (no external Shiprocket calls).
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

    // 2. Fetch shipment and scans strictly from DB
    const shipment = await fetchShipment(order.id);
    const scanEvents = await fetchScanEvents(order.id);

    return jsonPrivate({
      ok: true,
      tracking: buildTrackingPayload(order, shipment, scanEvents),
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

/**
 * POST /api/orders/[id]/tracking
 * Manual tracking refresh endpoint.
 *
 * Rules:
 * - Owner-only (or admin).
 * - Limited to once per 10 minutes per order (throttled with 429).
 * - Calls Shiprocket only on refresh.
 * - If Shiprocket is unreachable, falls back gracefully to last saved DB state
 *   with "Last updated <time>".
 */
export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const user = await requireUser();
    const { id } = await context.params;

    // 1. Authoritative order lookup with customer ownership enforcement
    const order = await getOrderById(id, {
      userId: user.id,
      isAdmin: user.role === "admin",
    });

    if (user.role !== "admin" && order.userId !== user.id) {
      return jsonPrivate({ ok: false, error: "Access denied" }, { status: 403 });
    }

    // 2. Fetch shipment record
    const shipment = await fetchShipment(order.id);
    const activeAwb = order.awbCode || shipment?.awb_code;

    if (!activeAwb) {
      const scanEvents = await fetchScanEvents(order.id);
      return jsonPrivate({
        ok: true,
        refreshed: false,
        message: "Order has not been shipped yet.",
        tracking: buildTrackingPayload(order, shipment, scanEvents),
      });
    }

    // 3. 10-minute refresh throttle check
    const lastTrackingAt = shipment?.last_tracking_at
      ? new Date(shipment.last_tracking_at).getTime()
      : 0;
    const now = Date.now();

    if (lastTrackingAt && now - lastTrackingAt < REFRESH_THROTTLE_MS) {
      const waitSeconds = Math.ceil((REFRESH_THROTTLE_MS - (now - lastTrackingAt)) / 1000);
      const scanEvents = await fetchScanEvents(order.id);
      return jsonPrivate(
        {
          ok: false,
          throttled: true,
          error: `Tracking can only be refreshed once every 10 minutes. Please wait ${waitSeconds}s.`,
          waitSeconds,
          lastUpdated: new Date(lastTrackingAt).toISOString(),
          tracking: buildTrackingPayload(order, shipment, scanEvents),
        },
        { status: 429 }
      );
    }

    // 4. Call Shiprocket tracking API
    let refreshed = false;
    let fallback = false;
    let warningMessage: string | null = null;

    try {
      const trackingRes = await trackShiprocketByAWB(activeAwb);
      const currentActivity =
        trackingRes.currentStatus || trackingRes.shipmentStatus || "IN_TRANSIT";

      if (shipment?.id) {
        await query(
          `UPDATE order_shipments
           SET last_tracking_at = NOW(),
               last_tracking_activity = ?,
               status = COALESCE(?, status)
           WHERE id = ?`,
          [
            currentActivity,
            trackingRes.shipmentStatus ? String(trackingRes.shipmentStatus) : null,
            shipment.id,
          ]
        );

        if (trackingRes.scans && Array.isArray(trackingRes.scans)) {
          for (const scan of trackingRes.scans) {
            if (!scan.date || !scan.activity) continue;
            const scanDate = new Date(scan.date);
            const validDate = isNaN(scanDate.getTime()) ? new Date() : scanDate;
            const status = (scan as any)["sr-status"] || scan.status || null;
            await query(
              `INSERT IGNORE INTO shipment_tracking_events
               (id, order_id, shipment_id, awb_code, activity, location, event_timestamp, sr_status)
               VALUES (UUID(), ?, ?, ?, ?, ?, ?, ?)`,
              [
                order.id,
                shipment.id,
                activeAwb,
                scan.activity,
                scan.location || null,
                validDate,
                status,
              ]
            ).catch(() => {});
          }
        }
      }
      refreshed = true;
    } catch {
      // Shiprocket is unreachable; fall back to last saved database state
      fallback = true;
      warningMessage = "Shiprocket is currently unreachable. Showing last saved tracking data.";
    }

    // 5. Return updated (or fallback) tracking state
    const updatedShipment = await fetchShipment(order.id);
    const updatedEvents = await fetchScanEvents(order.id);

    return jsonPrivate({
      ok: true,
      refreshed,
      fallback,
      warning: warningMessage,
      lastUpdated: updatedShipment?.last_tracking_at
        ? new Date(updatedShipment.last_tracking_at).toISOString()
        : null,
      tracking: buildTrackingPayload(order, updatedShipment || shipment, updatedEvents),
    });
  } catch (err) {
    if (err instanceof OrderValidationError) {
      return jsonPrivate(
        { ok: false, error: err.message },
        { status: err.statusCode }
      );
    }
    return handleAuthError(err, "Failed to refresh tracking details");
  }
}
