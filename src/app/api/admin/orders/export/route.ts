import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, handleAuthError } from "@/lib/server/auth";
import {
  resolveReportingPeriod,
  AnalyticsValidationError,
} from "@/lib/server/order-analytics";
import {
  getExportFilename,
  generateSummaryCsv,
  streamOrdersListCsv,
  recordExportAudit,
  type ExportType,
} from "@/lib/server/order-export";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/orders/export
 *
 * Secure server-generated CSV export for:
 * - Orders List CSV (bounded-memory stream with line item details)
 * - Summary CSV (six canonical dashboard figures)
 *
 * Query params:
 *   type: 'orders' | 'summary' (required)
 *   period: 'day' | 'week' | 'month' | 'year' | 'all'
 *   date: YYYY-MM-DD
 *   month: YYYY-MM
 *   year: YYYY
 *
 * Security & Compliance Guarantees:
 * 1. Strict server-side requireAdmin() authorization check.
 * 2. UTF-8 BOM encoding for correct spreadsheet rendering of ₹ and Unicode names.
 * 3. Formula injection prevention: text cells starting with [=, +, -, @] are neutralized.
 * 4. Numeric monetary values preserved without symbol corruption.
 * 5. Bounded-memory MySQL streaming prevents memory spikes on large date ranges.
 * 6. Audit logged in order_export_audits (actor, range, row count, outcome) without logging PII.
 */
export async function GET(request: NextRequest) {
  let admin;
  try {
    admin = await requireAdmin();
  } catch (err) {
    return handleAuthError(err, "Forbidden: Administrative export privileges required");
  }

  const url = new URL(request.url);
  const rawType = (url.searchParams.get("type") || "").toLowerCase().trim();

  if (rawType !== "orders" && rawType !== "summary") {
    return NextResponse.json(
      { ok: false, error: "Invalid export type. Must be 'orders' or 'summary'" },
      { status: 400 }
    );
  }
  const exportType = rawType as ExportType;

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

  const filename = getExportFilename(exportType, range);
  const clientIp = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip");

  if (exportType === "summary") {
    try {
      const { csvContent, rowCount } = await generateSummaryCsv(range);

      await recordExportAudit({
        actorId: admin.id,
        exportType: "summary",
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
        },
      });
    } catch (err: any) {
      await recordExportAudit({
        actorId: admin.id,
        exportType: "summary",
        period: range.period,
        startDate: range.start,
        endDate: range.end,
        rowCount: 0,
        status: "failed",
        errorMessage: err?.message || "Failed to generate summary CSV",
        ipAddress: clientIp,
      });

      console.error("[API_ORDERS_EXPORT_SUMMARY_ERROR]", err);
      return NextResponse.json(
        { ok: false, error: "Failed to generate summary export" },
        { status: 500 }
      );
    }
  }

  // exportType === 'orders' (server-streamed bounded memory batches)
  try {
    const encoder = new TextEncoder();
    const generator = streamOrdersListCsv(range);
    let rowCount = 0;

    const stream = new ReadableStream({
      async pull(controller) {
        try {
          const { value, done } = await generator.next();
          if (done) {
            controller.close();
            // Record audit on stream completion
            await recordExportAudit({
              actorId: admin.id,
              exportType: "orders",
              period: range.period,
              startDate: range.start,
              endDate: range.end,
              rowCount,
              status: "success",
              ipAddress: clientIp,
            });
            return;
          }
          if (value) {
            controller.enqueue(encoder.encode(value));
            // Count rows approximately (newlines minus header)
            const lines = value.split("\n").filter((l) => l.trim().length > 0);
            rowCount += lines.length;
          }
        } catch (streamErr: any) {
          controller.error(streamErr);
          await recordExportAudit({
            actorId: admin.id,
            exportType: "orders",
            period: range.period,
            startDate: range.start,
            endDate: range.end,
            rowCount,
            status: "failed",
            errorMessage: streamErr?.message || "Stream interrupted",
            ipAddress: clientIp,
          });
        }
      },
    });

    return new Response(stream, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "Transfer-Encoding": "chunked",
      },
    });
  } catch (err: any) {
    await recordExportAudit({
      actorId: admin.id,
      exportType: "orders",
      period: range.period,
      startDate: range.start,
      endDate: range.end,
      rowCount: 0,
      status: "failed",
      errorMessage: err?.message || "Failed to initialize orders stream",
      ipAddress: clientIp,
    });

    console.error("[API_ORDERS_EXPORT_ORDERS_ERROR]", err);
    return NextResponse.json(
      { ok: false, error: "Failed to stream orders export" },
      { status: 500 }
    );
  }
}
