import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, handleAuthError } from "@/lib/server/auth";
import {
  resolveReportingPeriod,
  AnalyticsValidationError,
} from "@/lib/server/order-analytics";
import { generateAbandonmentCsv } from "@/lib/server/abandonment-analytics";
import { recordExportAudit } from "@/lib/server/order-export";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/abandonment/export
 *
 * Protected administrative CSV export for cart abandonment recovery data.
 *
 * Security & Compliance Guarantees:
 * 1. Strict server-side requireAdmin() check.
 * 2. UTF-8 BOM encoding for correct spreadsheet software rendering.
 * 3. Formula injection prevention (sanitizes cells starting with =, +, -, @).
 * 4. Audits the export in order_export_audits.
 * 5. Zero secrets or sensitive credentials leakage.
 */
export async function GET(request: NextRequest) {
  let admin;
  try {
    admin = await requireAdmin();
  } catch (err) {
    return handleAuthError(err, "Forbidden: Administrative export privileges required");
  }

  const url = new URL(request.url);

  let range;
  try {
    range = resolveReportingPeriod({
      period: url.searchParams.get("period"),
      date: url.searchParams.get("date"),
      month: url.searchParams.get("month"),
      year: url.searchParams.get("year"),
    });
  } catch (err: any) {
    if (err instanceof AnalyticsValidationError) {
      return NextResponse.json(
        { ok: false, error: err.message },
        { status: err.statusCode }
      );
    }
    return NextResponse.json(
      { ok: false, error: "Invalid date or reporting period parameters" },
      { status: 400 }
    );
  }

  const filename = `dearr-abandoned-checkouts-${range.period}-${range.filenameKey}.csv`;
  const clientIp =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    null;

  try {
    const { csvContent, rowCount } = await generateAbandonmentCsv(range);

    // Record audit in order_export_audits
    await recordExportAudit({
      actorId: admin.id,
      exportType: "abandonment" as any,
      period: range.period,
      startDate: range.start,
      endDate: range.end,
      rowCount,
      status: "success",
      ipAddress: clientIp,
    });

    return new Response(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "X-Export-Row-Count": String(rowCount),
      },
    });
  } catch (err: any) {
    console.error("[ABANDONMENT_CSV_EXPORT_ERROR]", err?.message || err);

    await recordExportAudit({
      actorId: admin.id,
      exportType: "abandonment" as any,
      period: range.period,
      startDate: range.start,
      endDate: range.end,
      rowCount: 0,
      status: "failed",
      errorMessage: err?.message?.slice(0, 255) || "Export generation failed",
      ipAddress: clientIp,
    }).catch(() => {});

    return NextResponse.json(
      { ok: false, error: "Failed to generate abandonment CSV export" },
      { status: 500 }
    );
  }
}
