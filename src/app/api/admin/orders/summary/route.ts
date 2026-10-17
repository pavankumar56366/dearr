import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, handleAuthError } from "@/lib/server/auth";
import {
  resolveReportingPeriod,
  getOrderSummaryMetrics,
  AnalyticsValidationError,
} from "@/lib/server/order-analytics";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/orders/summary
 *
 * Protected administrative summary endpoint returning the exact six canonical figures:
 * 1. Total Orders
 * 2. Pending Dispatch
 * 3. Dispatched
 * 4. Delivered
 * 5. Cancelled
 * 6. Revenue
 *
 * Parameters:
 *   period — 'day' | 'week' | 'month' | 'year' | 'all' (default 'day')
 *   date   — YYYY-MM-DD (defaults to Today in Asia/Kolkata)
 *   month  — YYYY-MM (defaults to current month in Asia/Kolkata)
 *   year   — YYYY (defaults to current year in Asia/Kolkata)
 *
 * Invariant Guarantee:
 *   Total Orders = Pending Dispatch + Dispatched + Delivered + Cancelled
 */
export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
    const url = new URL(request.url);

    const range = resolveReportingPeriod({
      period: url.searchParams.get("period"),
      date: url.searchParams.get("date"),
      month: url.searchParams.get("month"),
      year: url.searchParams.get("year"),
    });

    const metrics = await getOrderSummaryMetrics(range);

    return NextResponse.json({
      ok: true,
      metrics,
      summary: metrics,
      range: {
        period: range.period,
        timezone: range.timezone,
        start: range.startIso,
        end: range.endIso,
        label: range.label,
        dateKey: range.dateKey,
      },
    });
  } catch (err: any) {
    if (err instanceof AnalyticsValidationError) {
      return NextResponse.json(
        { ok: false, error: err.message },
        { status: err.statusCode }
      );
    }
    return handleAuthError(err, "Failed to calculate orders summary");
  }
}
