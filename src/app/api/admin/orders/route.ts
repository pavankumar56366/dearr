import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, handleAuthError } from "@/lib/server/auth";
import {
  listAllOrders,
  OrderValidationError,
} from "@/lib/server/order";

/**
 * GET /api/admin/orders — List all orders for admin dashboard.
 *
 * Admin-only endpoint.
 *
 * Query params:
 *   status? — filter by order status
 *   paymentStatus? — filter by payment status
 *   search? — search by order number or customer name
 *   page? — pagination page (default 1)
 *   limit? — items per page (default 20, max 100)
 */
export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
    const url = new URL(request.url);

    const result = await listAllOrders({
      status: (url.searchParams.get("status") as any) || undefined,
      paymentStatus: (url.searchParams.get("paymentStatus") as any) || undefined,
      search: url.searchParams.get("search") || undefined,
      page: parseInt(url.searchParams.get("page") || "1", 10),
      limit: parseInt(url.searchParams.get("limit") || "20", 10),
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    if (err instanceof OrderValidationError) {
      return NextResponse.json(
        { ok: false, error: err.message },
        { status: err.statusCode }
      );
    }
    return handleAuthError(err, "Failed to fetch orders");
  }
}
