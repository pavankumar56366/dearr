import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, handleAuthError } from "@/lib/server/auth";
import {
  getOrderById,
  updateOrderStatus,
  cancelOrder,
  markOrderCodCollected,
  getOrderAddressHistory,
  OrderValidationError,
  type OrderStatus,
} from "@/lib/server/order";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/admin/orders/[id] — Fetch single order details for admin.
 *
 * Admin-only endpoint. Requires valid founder/admin session.
 */
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    await requireAdmin();
    const { id } = await context.params;

    const order = await getOrderById(id, { isAdmin: true });
    const addressHistory = await getOrderAddressHistory(order.id, undefined, true);

    return NextResponse.json({ ok: true, order: { ...order, addressHistory } });
  } catch (err) {
    if (err instanceof OrderValidationError) {
      return NextResponse.json(
        { ok: false, error: err.message },
        { status: err.statusCode }
      );
    }
    return handleAuthError(err, "Failed to fetch admin order details");
  }
}

/**
 * PATCH /api/admin/orders/[id] — Update order fulfillment status, cancel order, or collect COD cash.
 *
 * Admin-only endpoint. Requires valid founder/admin session.
 *
 * Body:
 *   { status: OrderStatus }       — fulfillment status update (validated state-machine transitions)
 *   { action: "cancel" }           — cancel order
 *   { action: "mark_cod_collected"} — mark COD payment as collected in cash
 */
export async function PATCH(
  request: NextRequest,
  context: RouteContext
) {
  try {
    await requireAdmin();
    const { id } = await context.params;
    const body = await request.json();

    let order;

    if (body.action === "cancel") {
      order = await cancelOrder(id);
    } else if (body.action === "mark_cod_collected" || body.action === "mark_cod_paid") {
      order = await markOrderCodCollected(id);
    } else if (body.status) {
      // In B-17: Only fulfillment status is mutable. paymentStatus is strictly ignored/rejected.
      order = await updateOrderStatus(id, body.status as OrderStatus);
    } else {
      return NextResponse.json(
        { ok: false, error: "Request must include 'status' or 'action'" },
        { status: 400 }
      );
    }

    return NextResponse.json({ ok: true, order });
  } catch (err) {
    if (err instanceof OrderValidationError) {
      return NextResponse.json(
        { ok: false, error: err.message },
        { status: err.statusCode }
      );
    }
    return handleAuthError(err, "Failed to update admin order");
  }
}
