import { NextRequest, NextResponse } from "next/server";
import {
  verifyShiprocketWebhook,
  mapShiprocketStatusToTracking,
  type ShiprocketWebhookPayload,
} from "@/lib/server/shiprocket";
import { query } from "@/lib/server/db";

// Fulfillment status progression hierarchy to prevent backwards regression
const STATUS_HIERARCHY: Record<string, number> = {
  pending: 1,
  confirmed: 2,
  processing: 3,
  shipped: 4,
  delivered: 5,
};

/**
 * POST /api/webhooks/courier-updates
 * Neutral, carrier-agnostic webhook endpoint for real-time logistics events.
 *
 * Invariants:
 * 1. Constant-time token authentication via `x-api-key`. Bad/missing token -> 401.
 * 2. Authenticated requests ALWAYS return HTTP 200 (required by logistics providers).
 * 3. Fulfillment status moves FORWARD only (never regresses).
 * 4. NEVER mutates `payment_status` (payment lifecycle is strictly decoupled).
 * 5. Returns/RTO events are tagged safely and NEVER marked as delivered.
 * 6. Idempotent execution.
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Verify webhook authorization header in constant time
    const authHeader =
      request.headers.get("x-api-key") ||
      request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
      new URL(request.url).searchParams.get("token");

    if (!verifyShiprocketWebhook(authHeader)) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized caller" },
        { status: 401 }
      );
    }

    // 2. Parse payload safely
    let payload: ShiprocketWebhookPayload;
    try {
      payload = (await request.json()) as ShiprocketWebhookPayload;
    } catch {
      // Return 200 on unparseable JSON to satisfy courier webhook contract
      return NextResponse.json({ ok: true, message: "Ignored malformed payload" });
    }

    if (!payload || typeof payload !== "object") {
      return NextResponse.json({ ok: true, message: "Empty payload ignored" });
    }

    const orderNumber = String(payload.order_id || "").trim();
    const awbCode = String(payload.awb || "").trim();
    const currentStatus = String(
      payload.current_status || payload.shipment_status || ""
    ).trim();
    const courierName = String(payload.courier_name || "").trim();
    const etd = String(payload.etd || "").trim();
    const isReturn = Boolean(
      payload.is_return ||
      /RTO|RETURN|UNDELIVERED|FAILED/i.test(currentStatus)
    );

    if (!orderNumber && !awbCode) {
      return NextResponse.json({ ok: true, message: "Missing order reference, skipped" });
    }

    // 3. Resolve order by order_number or awb_code
    let orderRow: any = null;
    if (orderNumber) {
      const orders = await query<any[]>(
        "SELECT id, order_number, status, dispatched_at, delivered_at FROM orders WHERE order_number = ? LIMIT 1",
        [orderNumber]
      );
      if (orders.length > 0) orderRow = orders[0];
    }

    if (!orderRow && awbCode) {
      const orders = await query<any[]>(
        "SELECT id, order_number, status, dispatched_at, delivered_at FROM orders WHERE awb_code = ? LIMIT 1",
        [awbCode]
      );
      if (orders.length > 0) orderRow = orders[0];
    }

    if (!orderRow) {
      // Order not found in system — acknowledge with 200
      return NextResponse.json({ ok: true, message: "Order not found, skipped" });
    }

    // Cancelled orders must never be reopened or moved to shipped/delivered
    if (orderRow.status === "cancelled") {
      return NextResponse.json({ ok: true, message: "Order is cancelled, state preserved" });
    }

    // 4. Map status to canonical tracking logic
    const statusMapping = mapShiprocketStatusToTracking(currentStatus);

    const orderId = orderRow.id;
    const currentRank = STATUS_HIERARCHY[orderRow.status] || 0;
    const updates: string[] = [];
    const values: any[] = [];

    if (awbCode) {
      updates.push("awb_code = ?");
      values.push(awbCode);
    }
    if (courierName) {
      updates.push("courier_name = ?");
      values.push(courierName);
    }
    if (currentStatus) {
      updates.push("courier_status = ?");
      values.push(currentStatus.slice(0, 50));
    }

    // 5. Apply forward-only fulfillment transition (never backwards, never touch payment_status)
    if (isReturn) {
      // RTO or return: never mark delivered; record courier status
      updates.push("courier_status = ?");
      values.push("RTO / RETURN INITIATED");
    } else if (statusMapping.isDelivered && currentRank < STATUS_HIERARCHY["delivered"]) {
      updates.push("status = 'delivered'", "delivered_at = NOW()");
    } else if (
      statusMapping.isDispatched &&
      currentRank < STATUS_HIERARCHY["shipped"]
    ) {
      updates.push("status = 'shipped'", "dispatched_at = IFNULL(dispatched_at, NOW())");
    }

    if (updates.length > 0) {
      values.push(orderId);
      await query(
        `UPDATE orders SET ${updates.join(", ")}, updated_at = NOW() WHERE id = ?`,
        values
      );
    }

    // 6. Update order_shipments if available (fail-soft if table unmigrated)
    try {
      await query(
        `INSERT INTO order_shipments
           (id, order_id, shiprocket_order_id, shiprocket_shipment_id, awb_code, courier_name, status, etd, last_tracking_activity, last_tracking_at, raw_response, created_at, updated_at)
         VALUES
           (UUID(), ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, NOW(), NOW())
         ON DUPLICATE KEY UPDATE
           courier_name = IFNULL(VALUES(courier_name), courier_name),
           status = VALUES(status),
           etd = IFNULL(VALUES(etd), etd),
           last_tracking_activity = VALUES(last_tracking_activity),
           last_tracking_at = NOW(),
           raw_response = VALUES(raw_response),
           updated_at = NOW()`,
        [
          orderId,
          String(payload.order_id || ""),
          String(payload.shipment_id || ""),
          awbCode || null,
          courierName || null,
          currentStatus || "UNKNOWN",
          etd || null,
          payload.scans?.[0]?.activity || currentStatus || null,
          JSON.stringify(payload),
        ]
      );
    } catch {
      // Keep going if order_shipments table is not yet present
    }

    return NextResponse.json({
      ok: true,
      message: "Courier update event processed successfully",
      matchedOrder: orderRow.order_number,
      stage: statusMapping.stageId,
    });
  } catch (err: any) {
    console.error("[Courier Updates Webhook Error]:", err?.message);
    // Always return 200 for authenticated webhook calls to prevent webhook back-off
    return NextResponse.json({ ok: true, message: "Error handled gracefully" });
  }
}
