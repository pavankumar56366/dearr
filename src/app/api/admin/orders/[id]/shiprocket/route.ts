import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, handleAuthError } from "@/lib/server/auth";
import { getOrderById, OrderValidationError } from "@/lib/server/order";
import { query } from "@/lib/server/db";
import {
  isShiprocketConfigured,
  isShiprocketEnabled,
  createShiprocketOrder,
  generateShiprocketAWB,
  requestShiprocketPickup,
  generateShiprocketLabel,
  generateShiprocketManifest,
  trackShiprocketByAWB,
  trackShiprocketByOrderId,
  mapDearrOrderToShiprocketPayload,
  ShiprocketError,
  ShiprocketConfigError,
} from "@/lib/server/shiprocket";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/admin/orders/[id]/shiprocket
 * Fetches current Shiprocket shipment details & live courier tracking for an order.
 */
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    await requireAdmin();
    const { id } = await context.params;

    const order = await getOrderById(id, { isAdmin: true });

    // Look for shipment record in database
    let shipmentRecord: any = null;
    try {
      const shipments = await query<any[]>(
        "SELECT * FROM order_shipments WHERE order_id = ? ORDER BY created_at DESC LIMIT 1",
        [order.id]
      );
      if (shipments.length > 0) shipmentRecord = shipments[0];
    } catch {
      // order_shipments table might not be migrated yet
    }

    const awbCode = shipmentRecord?.awb_code || (order as any).awb_code;
    let liveTracking: any = null;

    if (isShiprocketConfigured() && isShiprocketEnabled() && (awbCode || order.orderNumber)) {
      try {
        if (awbCode) {
          liveTracking = await trackShiprocketByAWB(awbCode);
        } else {
          liveTracking = await trackShiprocketByOrderId(order.orderNumber);
        }
      } catch (trackErr: any) {
        liveTracking = { error: trackErr.message };
      }
    }

    return NextResponse.json({
      ok: true,
      isConfigured: isShiprocketConfigured(),
      isEnabled: isShiprocketEnabled(),
      shipment: shipmentRecord,
      orderAwb: awbCode || null,
      courierName: shipmentRecord?.courier_name || (order as any).courier_name || null,
      liveTracking,
    });
  } catch (err: any) {
    if (err instanceof OrderValidationError) {
      return NextResponse.json(
        { ok: false, error: err.message },
        { status: err.statusCode }
      );
    }
    return handleAuthError(err, "Failed to fetch order shipment details");
  }
}

/**
 * POST /api/admin/orders/[id]/shiprocket
 * Dispatches logistics management actions to Shiprocket.
 *
 * Supported Actions:
 *  - "create_order": Create custom order on Shiprocket
 *  - "generate_awb": Assign courier and generate AWB
 *  - "request_pickup": Schedule courier pickup
 *  - "generate_label": Generate shipping label PDF URL
 *  - "generate_manifest": Generate manifest PDF URL
 */
export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  try {
    await requireAdmin();
    const { id } = await context.params;

    const body = await request.json();
    const action = body?.action;

    if (!action) {
      return NextResponse.json(
        { ok: false, error: "Missing required 'action' in request body" },
        { status: 400 }
      );
    }

    if (!isShiprocketConfigured() || !isShiprocketEnabled()) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Shiprocket is not enabled or configured in environment variables (SHIPROCKET_EMAIL, SHIPROCKET_PASSWORD, SHIPROCKET_ENABLED=true).",
        },
        { status: 503 }
      );
    }

    const order = await getOrderById(id, { isAdmin: true });

    switch (action) {
      case "create_order": {
        const payload = mapDearrOrderToShiprocketPayload(
          {
            orderNumber: order.orderNumber,
            createdAt: order.createdAt,
            totalAmount: order.totalAmount,
            subtotal: order.subtotal,
            discountAmount: order.discountAmount,
            shippingAmount: order.shippingAmount,
            paymentMethod: (order as any).paymentMethod,
            paymentStatus: order.paymentStatus,
            shippingFullName: order.shippingFullName,
            shippingPhone: order.shippingPhone,
            shippingAddressLine1: order.shippingAddressLine1,
            shippingAddressLine2: order.shippingAddressLine2,
            shippingCity: order.shippingCity,
            shippingPostalCode: order.shippingPostalCode,
            shippingState: order.shippingState,
            shippingCountry: order.shippingCountry,
            customerEmail: (order as any).customerEmail,
            items: order.items.map((i) => ({
              productName: i.productName,
              variantName: i.variantName,
              sku: i.sku,
              quantity: i.quantity,
              unitPrice: i.unitPrice,
              discountAmount: i.discountAmount,
            })),
          },
          {
            weightKg: body.weightKg || 0.5,
            pickupLocation: body.pickupLocation,
            dimensions: body.dimensions,
          }
        );

        const srResponse = await createShiprocketOrder(payload);

        // Record in order_shipments
        try {
          await query(
            `INSERT INTO order_shipments
               (id, order_id, shiprocket_order_id, shiprocket_shipment_id, awb_code, courier_name, status, pickup_location, raw_response, created_at, updated_at)
             VALUES
               (UUID(), ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
            [
              order.id,
              String(srResponse.order_id),
              String(srResponse.shipment_id),
              srResponse.awb_code || null,
              srResponse.courier_name || null,
              srResponse.status || "NEW",
              payload.pickup_location,
              JSON.stringify(srResponse),
            ]
          );
        } catch (dbErr: any) {
          console.warn("[Admin Shiprocket] order_shipments insert skipped:", dbErr?.message);
        }

        return NextResponse.json({
          ok: true,
          message: "Shiprocket order created successfully",
          shiprocketOrderId: srResponse.order_id,
          shipmentId: srResponse.shipment_id,
          status: srResponse.status,
        });
      }

      case "generate_awb": {
        const shipmentId = Number(body.shipmentId);
        if (!shipmentId) {
          return NextResponse.json(
            { ok: false, error: "Missing required 'shipmentId' for AWB generation" },
            { status: 400 }
          );
        }

        const awbResult = await generateShiprocketAWB({
          shipmentId,
          courierId: body.courierId ? Number(body.courierId) : undefined,
        });

        // Update orders table with awb
        if (awbResult.awbCode) {
          try {
            await query(
              "UPDATE orders SET awb_code = ?, courier_name = ?, updated_at = NOW() WHERE id = ?",
              [awbResult.awbCode, awbResult.courierName, order.id]
            );
            await query(
              "UPDATE order_shipments SET awb_code = ?, courier_id = ?, courier_name = ?, status = 'AWB_ASSIGNED', updated_at = NOW() WHERE order_id = ? AND shiprocket_shipment_id = ?",
              [
                awbResult.awbCode,
                awbResult.courierCompanyId || null,
                awbResult.courierName || null,
                order.id,
                String(shipmentId),
              ]
            );
          } catch (dbErr: any) {
            console.warn("[Admin Shiprocket] DB update error:", dbErr?.message);
          }
        }

        return NextResponse.json({
          ok: true,
          message: "AWB generated successfully",
          awbCode: awbResult.awbCode,
          courierName: awbResult.courierName,
        });
      }

      case "request_pickup": {
        const shipmentId = Number(body.shipmentId);
        if (!shipmentId) {
          return NextResponse.json(
            { ok: false, error: "Missing required 'shipmentId' for pickup request" },
            { status: 400 }
          );
        }

        const pickupResult = await requestShiprocketPickup([shipmentId]);

        try {
          await query(
            "UPDATE order_shipments SET pickup_scheduled_date = ?, pickup_token = ?, status = 'PICKUP_SCHEDULED', updated_at = NOW() WHERE order_id = ? AND shiprocket_shipment_id = ?",
            [
              pickupResult.pickupScheduledDate || null,
              pickupResult.pickupTokenNumber || null,
              order.id,
              String(shipmentId),
            ]
          );
        } catch (dbErr: any) {
          console.warn("[Admin Shiprocket] DB update error:", dbErr?.message);
        }

        return NextResponse.json({
          ok: true,
          message: "Pickup requested successfully",
          pickupScheduledDate: pickupResult.pickupScheduledDate,
          pickupToken: pickupResult.pickupTokenNumber,
        });
      }

      case "generate_label": {
        const shipmentId = Number(body.shipmentId);
        if (!shipmentId) {
          return NextResponse.json(
            { ok: false, error: "Missing required 'shipmentId' for label generation" },
            { status: 400 }
          );
        }

        const labelResult = await generateShiprocketLabel([shipmentId]);

        if (labelResult.labelUrl) {
          try {
            await query(
              "UPDATE order_shipments SET label_url = ?, updated_at = NOW() WHERE order_id = ? AND shiprocket_shipment_id = ?",
              [labelResult.labelUrl, order.id, String(shipmentId)]
            );
          } catch (dbErr: any) {
            console.warn("[Admin Shiprocket] DB update error:", dbErr?.message);
          }
        }

        return NextResponse.json({
          ok: true,
          labelUrl: labelResult.labelUrl,
        });
      }

      case "generate_manifest": {
        const shipmentId = Number(body.shipmentId);
        if (!shipmentId) {
          return NextResponse.json(
            { ok: false, error: "Missing required 'shipmentId' for manifest generation" },
            { status: 400 }
          );
        }

        const manifestResult = await generateShiprocketManifest([shipmentId]);

        if (manifestResult.manifestUrl) {
          try {
            await query(
              "UPDATE order_shipments SET manifest_url = ?, updated_at = NOW() WHERE order_id = ? AND shiprocket_shipment_id = ?",
              [manifestResult.manifestUrl, order.id, String(shipmentId)]
            );
          } catch (dbErr: any) {
            console.warn("[Admin Shiprocket] DB update error:", dbErr?.message);
          }
        }

        return NextResponse.json({
          ok: true,
          manifestUrl: manifestResult.manifestUrl,
        });
      }

      default:
        return NextResponse.json(
          { ok: false, error: `Unsupported action: '${action}'` },
          { status: 400 }
        );
    }
  } catch (err: any) {
    if (err instanceof ShiprocketError || err instanceof ShiprocketConfigError) {
      return NextResponse.json(
        { ok: false, error: err.message, data: err.data },
        { status: err.statusCode || 500 }
      );
    }
    if (err instanceof OrderValidationError) {
      return NextResponse.json(
        { ok: false, error: err.message },
        { status: err.statusCode }
      );
    }
    return handleAuthError(err, "Failed to perform Shiprocket logistics action");
  }
}
