import { NextRequest, NextResponse } from "next/server";
import {
  verifyShiprocketWebhook,
  mapShiprocketStatusToTracking,
  type ShiprocketWebhookPayload,
} from "@/lib/server/shiprocket";
import { query } from "@/lib/server/db";

/**
 * POST /api/webhooks/shiprocket
 * Handles real-time shipment updates pushed by Shiprocket.
 *
 * Supported events:
 * - AWB Assigned / Generated
 * - Pickup Scheduled / Picked Up
 * - In Transit / Out for Delivery
 * - Delivered / RTO / Cancelled
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Verify webhook authorization
    const authHeader =
      request.headers.get("x-api-key") ||
      request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
      new URL(request.url).searchParams.get("token");

    if (!verifyShiprocketWebhook(authHeader)) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized webhook caller" },
        { status: 401 }
      );
    }

    // 2. Parse payload
    const payload = (await request.json()) as ShiprocketWebhookPayload;
    if (!payload || typeof payload !== "object") {
      return NextResponse.json(
        { ok: false, error: "Invalid JSON payload" },
        { status: 400 }
      );
    }

    const orderNumber = String(payload.order_id || "").trim();
    const awbCode = String(payload.awb || "").trim();
    const currentStatus = String(
      payload.current_status || payload.shipment_status || ""
    ).trim();
    const courierName = String(payload.courier_name || "").trim();

    if (!orderNumber && !awbCode) {
      return NextResponse.json(
        { ok: false, error: "Webhook missing order_id or awb" },
        { status: 400 }
      );
    }

    // 3. Map status to canonical tracking logic
    const statusMapping = mapShiprocketStatusToTracking(currentStatus);

    // 4. Update order state in database
    // Resolve order by order_number or awb_code
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

    if (orderRow) {
      const orderId = orderRow.id;
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

      // Transition order status if appropriate
      if (statusMapping.isDelivered && orderRow.status !== "delivered") {
        updates.push("status = 'delivered'", "delivered_at = NOW()");
      } else if (
        statusMapping.isDispatched &&
        orderRow.status !== "delivered" &&
        orderRow.status !== "shipped"
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

      // 5. Update or insert into order_shipments table if table exists
      try {
        await query(
          `INSERT INTO order_shipments
             (id, order_id, shiprocket_order_id, shiprocket_shipment_id, awb_code, courier_name, status, last_tracking_activity, last_tracking_at, raw_response, created_at, updated_at)
           VALUES
             (UUID(), ?, ?, ?, ?, ?, ?, ?, NOW(), ?, NOW(), NOW())
           ON DUPLICATE KEY UPDATE
             courier_name = IFNULL(VALUES(courier_name), courier_name),
             status = VALUES(status),
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
            payload.scans?.[0]?.activity || currentStatus || null,
            JSON.stringify(payload),
          ]
        );
      } catch (dbErr: any) {
        // Table might not exist yet if migration 013 hasn't been run against DB
        console.warn("[Shiprocket Webhook] order_shipments update skipped:", dbErr?.message);
      }
    }

    return NextResponse.json({
      ok: true,
      message: "Shiprocket webhook processed successfully",
      matchedOrder: orderRow?.order_number || null,
      mappedStage: statusMapping.stageId,
    });
  } catch (err: any) {
    console.error("[Shiprocket Webhook Error]:", err);
    return NextResponse.json(
      { ok: false, error: "Internal error processing webhook" },
      { status: 500 }
    );
  }
}
