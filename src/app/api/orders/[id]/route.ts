import { NextRequest, NextResponse } from "next/server";
import {
  requireUser,
  requireAdmin,
  handleAuthError,
} from "@/lib/server/auth";
import {
  getOrderById,
  updateOrderStatus,
  cancelOrder,
  OrderValidationError,
  type OrderStatus,
} from "@/lib/server/order";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/orders/[id] — Fetch a single order by ID or order_number.
 *
 * Customers can only see their own orders (ownership enforced).
 * Admins can see any order.
 */
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const user = await requireUser();
    const { id } = await context.params;

    const order = await getOrderById(id, {
      userId: user.id,
      isAdmin: user.role === "admin",
    });

    return NextResponse.json({ ok: true, order });
  } catch (err) {
    if (err instanceof OrderValidationError) {
      return NextResponse.json(
        { ok: false, error: err.message },
        { status: err.statusCode }
      );
    }
    return handleAuthError(err, "Failed to fetch order");
  }
}

/**
 * PATCH /api/orders/[id] — Update order fulfillment status or cancel order.
 *
 * Admin-only endpoint. Customers cannot mutate orders (403 Forbidden).
 *
 * Body:
 *   { status: OrderStatus } — fulfillment status update (validated transitions)
 *   { action: "cancel" }     — cancel order
 *
 * Note: paymentStatus mutation is strictly disallowed in B-17.
 */
export async function PATCH(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const admin = await requireAdmin();
    const { id } = await context.params;
    const body = await request.json();

    let order;

    if (body.action === "cancel") {
      order = await cancelOrder(id);
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
    return handleAuthError(err, "Failed to update order");
  }
}
