import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, handleAuthError } from "@/lib/server/auth";
import {
  listAllOrders,
  OrderValidationError,
} from "@/lib/server/order";
import { AnalyticsValidationError } from "@/lib/server/order-analytics";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/orders — List placed orders for admin dashboard.
 *
 * Admin-only endpoint.
 *
 * Query params:
 *   period? — reporting period (day, week, month, year, all)
 *   date? — specific date (YYYY-MM-DD)
 *   month? — specific month (YYYY-MM)
 *   year? — specific year (YYYY)
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
      period: url.searchParams.get("period") || undefined,
      date: url.searchParams.get("date") || undefined,
      month: url.searchParams.get("month") || undefined,
      year: url.searchParams.get("year") || undefined,
      status: (url.searchParams.get("status") as any) || undefined,
      paymentStatus: (url.searchParams.get("paymentStatus") as any) || undefined,
      search: url.searchParams.get("search") || undefined,
      page: parseInt(url.searchParams.get("page") || "1", 10),
      limit: parseInt(url.searchParams.get("limit") || "20", 10),
      placedOnly: true, // Abandoned online payment attempts are excluded
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    if (err instanceof OrderValidationError || err instanceof AnalyticsValidationError) {
      return NextResponse.json(
        { ok: false, error: err.message },
        { status: err.statusCode }
      );
    }
    return handleAuthError(err, "Failed to fetch orders");
  }
}
