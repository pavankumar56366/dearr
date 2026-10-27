import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, handleAuthError } from "@/lib/server/auth";
import { getOrderById, OrderValidationError } from "@/lib/server/order";
import { query } from "@/lib/server/db";
import {
  isShiprocketConfigured,
  isShiprocketEnabled,
  checkCourierServiceability,
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

    // Look for shipment record in database (excluding raw_response to prevent PII leakage)
    let shipmentRecord: any = null;
    try {
      const shipments = await query<any[]>(
        `SELECT id, order_id, shiprocket_order_id, shiprocket_shipment_id, 
                awb_code, courier_id, courier_name, shipment_actual_cost, status, pickup_location, 
                pickup_scheduled_date, pickup_token, label_url, manifest_url, 
                etd, last_tracking_activity, last_tracking_at, created_at, updated_at 
         FROM order_shipments 
         WHERE order_id = ? 
         ORDER BY created_at DESC LIMIT 1`,
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

    // Available couriers for custom selection (if shipment created and live API configured)
    let availableCouriers: Array<{
      courierCompanyId: number;
      courierName: string;
      rate: number;
      estimatedDeliveryDays: number | string;
      rating?: number;
    }> = [];

    if (
      isShiprocketConfigured() &&
      isShiprocketEnabled() &&
      order.shippingPostalCode &&
      (!awbCode || !shipmentRecord?.shipment_actual_cost)
    ) {
      try {
        const isCod = Boolean(
          (order as any).paymentMethod?.toLowerCase().includes("cod") ||
          (order as any).paymentMethod?.toLowerCase().includes("cash on delivery")
        );
        const serviceability = await checkCourierServiceability({
          pickupPincode: "560038",
          deliveryPincode: order.shippingPostalCode,
          weightKg: 0.5,
          cod: isCod,
          declaredValue: order.totalAmount,
        });

        if (serviceability.availableCouriers && Array.isArray(serviceability.availableCouriers)) {
          availableCouriers = serviceability.availableCouriers.map((c) => ({
            courierCompanyId: c.courier_company_id,
            courierName: c.courier_name,
            rate: Number(c.rate || 0),
            estimatedDeliveryDays: c.estimated_delivery_days || c.etd || "2-4",
            rating: typeof c.rating === "number" ? c.rating : undefined,
          }));
        }
      } catch (err: any) {
        console.warn("[Admin Shiprocket] Serviceability fetch failed:", err?.message);
      }
    }

    const customerShipping = Number(order.shippingAmount || 0);
    const codFee = Number((order as any).codFeeAmount || 0);
    const totalShippingRevenue = customerShipping + codFee;
    const actualFreightCost =
      shipmentRecord?.shipment_actual_cost != null
        ? Number(shipmentRecord.shipment_actual_cost)
        : null;

    const netFreightMargin =
      actualFreightCost != null ? totalShippingRevenue - actualFreightCost : null;

    return NextResponse.json({
      ok: true,
      isConfigured: isShiprocketConfigured(),
      isEnabled: isShiprocketEnabled(),
      shipment: shipmentRecord,
      orderAwb: awbCode || null,
      courierName: shipmentRecord?.courier_name || (order as any).courier_name || null,
      liveTracking,
      availableCouriers,
      freightAccounting: {
        customerShippingFee: customerShipping,
        codFeeAmount: codFee,
        totalShippingCollected: totalShippingRevenue,
        actualFreightCost,
        netFreightMargin,
      },
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

    // 1. Guard against fulfilling cancelled orders
    if (order.status === "cancelled") {
      return NextResponse.json(
        { ok: false, error: "Cannot dispatch logistics actions for a cancelled order." },
        { status: 400 }
      );
    }

    // 2. Guard payment status before dispatching
    const paymentMethodLower = String((order as any).paymentMethod || "").toLowerCase();
    const isCod = paymentMethodLower.includes("cod") || paymentMethodLower.includes("cash on delivery");

    if (!isCod) {
      // Prepaid order must be paid
      if (order.paymentStatus !== "paid") {
        return NextResponse.json(
          {
            ok: false,
            error: "Cannot create shipment: Prepaid order has not been paid yet.",
          },
          { status: 400 }
        );
      }
    } else {
      // COD orders must be confirmed or in processing before booking shipment
      const validCodStatuses = ["confirmed", "processing", "shipped", "delivered"];
      if (!validCodStatuses.includes(order.status)) {
        return NextResponse.json(
          {
            ok: false,
            error: `Please confirm this COD order before booking shipment (current status: '${order.status}').`,
          },
          { status: 400 }
        );
      }
    }

    switch (action) {
      case "create_order": {
        // Prevent duplicate shipment creation for the same order
        try {
          const existingShipment = await query<any[]>(
            "SELECT id, shiprocket_shipment_id, awb_code, status FROM order_shipments WHERE order_id = ? LIMIT 1",
            [order.id]
          );
          if (existingShipment.length > 0 && existingShipment[0].shiprocket_shipment_id) {
            return NextResponse.json(
              {
                ok: false,
                error: `A shipment already exists for this order (Shipment ID: ${existingShipment[0].shiprocket_shipment_id}).`,
                shipmentId: existingShipment[0].shiprocket_shipment_id,
                awbCode: existingShipment[0].awb_code,
              },
              { status: 409 }
            );
          }
        } catch {
          // Table might not exist yet in unmigrated environment
        }

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

        let srResponse: any;
        try {
          srResponse = await createShiprocketOrder(payload);
        } catch (apiErr: any) {
          // Handle wallet balance or Shiprocket quota errors gracefully
          const errMsg = apiErr?.message || "";
          if (/wallet|insufficient|balance|credit/i.test(errMsg)) {
            return NextResponse.json(
              {
                ok: false,
                error: "Insufficient Shiprocket wallet balance. Please recharge your Shiprocket wallet to book shipments.",
              },
              { status: 402 }
            );
          }
          throw apiErr;
        }

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

        const selectedCourierId = body.courierId ? Number(body.courierId) : undefined;
        const passedCost = body.actualCost != null ? Number(body.actualCost) : null;

        let awbResult: any;
        try {
          awbResult = await generateShiprocketAWB({
            shipmentId,
            courierId: selectedCourierId,
          });
        } catch (awbErr: any) {
          const errMsg = awbErr?.message || "";
          if (/wallet|insufficient|balance|credit/i.test(errMsg)) {
            return NextResponse.json(
              {
                ok: false,
                error: "Insufficient Shiprocket wallet balance to assign AWB. Please recharge your wallet.",
              },
              { status: 402 }
            );
          }
          throw awbErr;
        }

        const finalActualCost = passedCost ?? awbResult.freightCost ?? null;

        // Update orders & order_shipments table with awb and actual cost
        if (awbResult.awbCode) {
          try {
            await query(
              "UPDATE orders SET awb_code = ?, courier_name = ?, updated_at = NOW() WHERE id = ?",
              [awbResult.awbCode, awbResult.courierName, order.id]
            );
            await query(
              `UPDATE order_shipments 
               SET awb_code = ?, courier_id = ?, courier_name = ?, shipment_actual_cost = ?, status = 'AWB_ASSIGNED', updated_at = NOW() 
               WHERE order_id = ? AND shiprocket_shipment_id = ?`,
              [
                awbResult.awbCode,
                awbResult.courierCompanyId || selectedCourierId || null,
                awbResult.courierName || null,
                finalActualCost,
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
          actualCost: finalActualCost,
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

        let pickupResult: any;
        try {
          pickupResult = await requestShiprocketPickup([shipmentId]);
        } catch (pickupErr: any) {
          const errMsg = pickupErr?.message || "";
          if (/already scheduled|pickup already exists|previously scheduled/i.test(errMsg)) {
            return NextResponse.json({
              ok: true,
              message: "Pickup has already been scheduled for this shipment.",
              alreadyScheduled: true,
            });
          }
          if (/wallet|insufficient|balance|credit/i.test(errMsg)) {
            return NextResponse.json(
              {
                ok: false,
                error: "Insufficient Shiprocket wallet balance to request pickup. Please recharge your wallet.",
              },
              { status: 402 }
            );
          }
          throw pickupErr;
        }

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
