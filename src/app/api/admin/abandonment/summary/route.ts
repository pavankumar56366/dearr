import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, handleAuthError } from "@/lib/server/auth";
import {
  resolveReportingPeriod,
  AnalyticsValidationError,
} from "@/lib/server/order-analytics";
import { getAbandonmentSummaryMetrics } from "@/lib/server/abandonment-analytics";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/abandonment/summary
 *
 * Protected administrative summary metrics for cart abandonment recovery.
 * Reuses standard reporting periods: Day, Last week, Month, Year, Overall.
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

    const metrics = await getAbandonmentSummaryMetrics(range);

    return NextResponse.json({
      ok: true,
      metrics,
      topReasons: metrics.topReasons,
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
    return handleAuthError(err, "Failed to retrieve abandonment summary");
  }
}
