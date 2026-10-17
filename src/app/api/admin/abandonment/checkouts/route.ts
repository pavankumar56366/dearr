import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, handleAuthError } from "@/lib/server/auth";
import {
  resolveReportingPeriod,
  AnalyticsValidationError,
} from "@/lib/server/order-analytics";
import { getRecentAbandonedCheckouts } from "@/lib/server/abandonment-analytics";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/abandonment/checkouts
 *
 * Protected administrative table of recent abandoned checkout attempts.
 * Includes items snapshot, snapshot value, feedback reasons, and consent state.
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

    const rawLimit = url.searchParams.get("limit");
    const limit = rawLimit ? parseInt(rawLimit, 10) : 50;
    const maskContact = url.searchParams.get("maskContact") === "true";
    const status = url.searchParams.get("status") || undefined;

    const checkouts = await getRecentAbandonedCheckouts(range, limit, maskContact, status);

    return NextResponse.json({
      ok: true,
      checkouts,
      count: checkouts.length,
      range: {
        period: range.period,
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
    return handleAuthError(err, "Failed to retrieve recent abandoned checkouts");
  }
}
