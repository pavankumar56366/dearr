import { NextRequest, NextResponse } from "next/server";
import { requireUser, handleAuthError, assertSafeOrigin, jsonPrivate } from "@/lib/server";
import {
  updateOrderShippingAddress,
  OrderValidationError,
} from "@/lib/server/order";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * PATCH /api/orders/[id]/shipping-address — Customer or admin delivery address update
 *
 * Enforces safe origin, ownership, deadline, status locks, serviceability, rate limiting, and row-level atomicity.
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    assertSafeOrigin(request);
    const user = await requireUser();
    const { id } = await context.params;
    const body = await request.json();

    const clientIp =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "127.0.0.1";

    const result = await updateOrderShippingAddress({
      orderId: id,
      userId: user.id,
      newAddress: {
        shippingFullName: body.shippingFullName || body.fullName,
        shippingPhone: body.shippingPhone || body.phone,
        shippingAddressLine1: body.shippingAddressLine1 || body.addressLine1,
        shippingAddressLine2: body.shippingAddressLine2 ?? body.addressLine2,
        shippingCity: body.shippingCity || body.city,
        shippingState: body.shippingState || body.state,
        shippingPostalCode: body.shippingPostalCode || body.postalCode,
        shippingCountry: body.shippingCountry || body.country || "India",
      },
      clientIp,
      isAdmin: user.role === "admin",
    });

    return jsonPrivate({
      ok: true,
      message: "Delivery address updated successfully.",
      order: result.order,
      changesLeft: result.changesLeft,
    });
  } catch (err) {
    if (err instanceof OrderValidationError) {
      return jsonPrivate(
        { ok: false, error: err.message },
        { status: err.statusCode }
      );
    }
    return handleAuthError(err, "Failed to update delivery address");
  }
}
