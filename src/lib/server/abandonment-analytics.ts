import "server-only";
import crypto from "crypto";
import { query } from "./db";
import {
  type ResolvedReportingPeriod,
  resolveReportingPeriod,
  formatKolkataDisplay,
} from "./order-analytics";
import {
  sanitizeCsvCell,
  formatPlainDecimal,
  recordExportAudit,
} from "./order-export";

export function ensureResolvedPeriod(
  rangeOrParams: ResolvedReportingPeriod | { period?: any; date?: string; range?: string } | any
): ResolvedReportingPeriod {
  if (
    rangeOrParams &&
    typeof rangeOrParams === "object" &&
    "startSql" in rangeOrParams &&
    "endSql" in rangeOrParams
  ) {
    return rangeOrParams as ResolvedReportingPeriod;
  }
  return resolveReportingPeriod(rangeOrParams || {});
}

export interface AbandonmentSummaryMetrics {
  checkoutAttempts: number;
  totalInitiatedCheckouts?: number;
  abandonedAttempts: number;
  abandonedCheckouts?: number;
  failedAttempts: number;
  paymentFailures?: number;
  convertedAttempts: number;
  completedOrders?: number;
  abandonmentRate: number; // Percentage: (abandoned + failed) / checkoutAttempts * 100
  abandonmentRatePct?: number;
  potentialLostRevenue: number; // Sum of amount from unpaid abandoned/failed attempts
  recoveredOrders: number; // Placed orders recovered after abandonment
  recoveredAfterAbandonment?: number;
  recoveryRate: number; // Percentage: recoveredOrders / (abandoned + failed) * 100
  recoveryRatePct?: number;
  recoverySheetImpressions?: number;
  recoveredRevenue?: number;
  feedbackTotal: number;
  feedbackCompleted: number;
  feedbackSkipped: number;
  feedbackCompletionRate: number; // Percentage: completed / total * 100
  alternativesViewed: number;
  alternativesSwapped: number;
  topReasons: Array<{
    reason: string;
    count: number;
    percentage: number;
  }>;
  metrics?: AbandonmentSummaryMetrics;
}

export interface AbandonedCheckoutRow {
  id: string;
  createdAt: string; // IST
  createdAtIso: string;
  userId: string | null;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  status: string;
  amount: number;
  currency: string;
  itemsSummary: string;
  itemCount: number;
  items?: Array<{
    productId: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    colorName?: string;
    colorHex?: string;
  }>;
  gatewayErrorCode: string | null;
  gatewayErrorDesc: string | null;
  errorCode?: string | null;
  errorDesc?: string | null;
  feedbackStatus: "submitted" | "skipped" | "none";
  feedbackReasons: string[];
  reasons?: string[];
  feedbackComment: string | null;
  comment?: string | null;
  recoveryShownAt?: string | null;
  abandonedAt?: string | null;
  consentChannels: string[];
  consentGiven: boolean;
}

/**
 * Aggregates abandonment recovery analytics for the given period.
 *
 * Denominator & Formula Invariants:
 * 1. Checkout Attempts = count of all attempts initialized in range.
 * 2. Abandonment Rate = (abandonedAttempts + failedAttempts) / checkoutAttempts * 100.
 * 3. Potential Lost Revenue = sum(amount) from attempts in range that remain unpaid (status in ('abandoned', 'failed') AND order_id IS NULL).
 * 4. Recovered Orders = count of attempts that converted to a placed order after previously being marked abandoned or failed.
 * 5. Recovery Rate = recoveredOrders / (abandonedAttempts + failedAttempts) * 100 (or 0 if none).
 * 6. Mathematical safety: Unpaid attempts never count towards real store orders or revenue.
 */
export async function getAbandonmentSummaryMetrics(
  rangeOrParams: ResolvedReportingPeriod | any
): Promise<AbandonmentSummaryMetrics> {
  const range = ensureResolvedPeriod(rangeOrParams);
  const isAllTime = range.period === "all";
  const dateCondition = isAllTime
    ? "1 = 1"
    : "(ca.created_at >= ? AND ca.created_at < ?)";
  const params = isAllTime ? [] : [range.startSql, range.endSql];

  // 1. Core checkout attempt figures
  const attemptSql = `
    SELECT
      COUNT(*) AS total_attempts,
      COALESCE(SUM(CASE WHEN ca.status = 'abandoned' THEN 1 ELSE 0 END), 0) AS abandoned_attempts,
      COALESCE(SUM(CASE WHEN ca.status = 'failed' THEN 1 ELSE 0 END), 0) AS failed_attempts,
      COALESCE(SUM(CASE WHEN ca.status = 'converted' THEN 1 ELSE 0 END), 0) AS converted_attempts,
      COALESCE(SUM(CASE WHEN ca.recovery_shown_at IS NOT NULL THEN 1 ELSE 0 END), 0) AS recovery_sheet_impressions,
      COALESCE(SUM(CASE WHEN ca.status IN ('abandoned', 'failed') AND ca.order_id IS NULL THEN ca.amount ELSE 0 END), 0) AS potential_lost_revenue,
      COALESCE(COUNT(DISTINCT CASE
        WHEN ca.status = 'converted' AND ca.order_id IS NOT NULL AND (
          ca.abandoned_at IS NOT NULL
          OR ca.recovery_shown_at IS NOT NULL
          OR JSON_UNQUOTE(JSON_EXTRACT(ca.checkout_data, '$.isRecovery')) = 'true'
          OR JSON_UNQUOTE(JSON_EXTRACT(ca.checkout_data, '$.sourceAttemptId')) IS NOT NULL
        ) THEN ca.order_id ELSE NULL END), 0) AS recovered_orders,
      COALESCE(SUM(CASE
        WHEN ca.status = 'converted' AND ca.order_id IS NOT NULL AND (
          ca.abandoned_at IS NOT NULL
          OR ca.recovery_shown_at IS NOT NULL
          OR JSON_UNQUOTE(JSON_EXTRACT(ca.checkout_data, '$.isRecovery')) = 'true'
          OR JSON_UNQUOTE(JSON_EXTRACT(ca.checkout_data, '$.sourceAttemptId')) IS NOT NULL
        ) THEN ca.amount ELSE 0 END), 0) AS recovered_revenue
    FROM checkout_attempts ca
    WHERE ${dateCondition}
  `;

  const [attemptRow] = await query<any[]>(attemptSql, params);

  const checkoutAttempts = Number(attemptRow?.total_attempts || 0);
  const abandonedAttempts = Number(attemptRow?.abandoned_attempts || 0);
  const failedAttempts = Number(attemptRow?.failed_attempts || 0);
  const convertedAttempts = Number(attemptRow?.converted_attempts || 0);
  const recoverySheetImpressions = Number(attemptRow?.recovery_sheet_impressions || 0);
  const potentialLostRevenue = Math.round(Number(attemptRow?.potential_lost_revenue || 0) * 100) / 100;
  const recoveredOrders = Number(attemptRow?.recovered_orders || 0);
  const recoveredRevenue = Math.round(Number(attemptRow?.recovered_revenue || 0) * 100) / 100;

  const totalUnpaid = abandonedAttempts + failedAttempts;
  const abandonmentRate =
    checkoutAttempts > 0
      ? Math.round((totalUnpaid / checkoutAttempts) * 1000) / 10
      : 0;

  const recoveryRate =
    totalUnpaid > 0
      ? Math.round((recoveredOrders / totalUnpaid) * 1000) / 10
      : 0;

  // 2. Feedback metrics
  const feedbackDateCondition = isAllTime
    ? "1 = 1"
    : "(cf.created_at >= ? AND cf.created_at < ?)";
  const feedbackSql = `
    SELECT
      COUNT(*) AS total_feedback,
      COALESCE(SUM(CASE WHEN cf.skipped = 0 THEN 1 ELSE 0 END), 0) AS completed_feedback,
      COALESCE(SUM(CASE WHEN cf.skipped = 1 THEN 1 ELSE 0 END), 0) AS skipped_feedback
    FROM checkout_feedback cf
    WHERE ${feedbackDateCondition}
  `;

  const [feedbackRow] = await query<any[]>(feedbackSql, params);
  const feedbackTotal = Number(feedbackRow?.total_feedback || 0);
  const feedbackCompleted = Number(feedbackRow?.completed_feedback || 0);
  const feedbackSkipped = Number(feedbackRow?.skipped_feedback || 0);
  const feedbackCompletionRate =
    feedbackTotal > 0
      ? Math.round((feedbackCompleted / feedbackTotal) * 1000) / 10
      : 0;

  // 3. Top Reasons breakdown
  const reasonsSql = `
    SELECT cf.reasons
    FROM checkout_feedback cf
    WHERE cf.skipped = 0 AND ${feedbackDateCondition}
  `;
  const feedbackReasonRows = await query<any[]>(reasonsSql, params);

  const reasonCounts: Record<string, number> = {};
  let totalReasonSelections = 0;

  for (const row of feedbackReasonRows || []) {
    let list: string[] = [];
    try {
      list = typeof row.reasons === "string" ? JSON.parse(row.reasons) : row.reasons || [];
    } catch {}
    for (const r of list) {
      const clean = String(r || "").trim();
      if (!clean) continue;
      reasonCounts[clean] = (reasonCounts[clean] || 0) + 1;
      totalReasonSelections++;
    }
  }

  const topReasons = Object.entries(reasonCounts)
    .map(([reason, count]) => ({
      reason,
      count,
      percentage:
        feedbackCompleted > 0
          ? Math.round((count / feedbackCompleted) * 1000) / 10
          : 0,
    }))
    .sort((a, b) => b.count - a.count);

  // 4. Alternatives telemetry events
  const eventsDateCondition = isAllTime
    ? "1 = 1"
    : "(created_at >= ? AND created_at < ?)";
  const eventsSql = `
    SELECT
      COALESCE(SUM(CASE WHEN event_type = 'alternative_viewed' THEN 1 ELSE 0 END), 0) AS viewed,
      COALESCE(SUM(CASE WHEN event_type = 'alternative_swapped' THEN 1 ELSE 0 END), 0) AS swapped
    FROM internal_events
    WHERE event_type IN ('alternative_viewed', 'alternative_swapped')
      AND ${eventsDateCondition}
  `;
  const [eventsRow] = await query<any[]>(eventsSql, params);
  const alternativesViewed = Number(eventsRow?.viewed || 0);
  const alternativesSwapped = Number(eventsRow?.swapped || 0);

  const metricsData = {
    checkoutAttempts,
    totalInitiatedCheckouts: checkoutAttempts,
    completedOrders: convertedAttempts,
    abandonedAttempts,
    abandonedCheckouts: abandonedAttempts,
    failedAttempts,
    paymentFailures: failedAttempts,
    convertedAttempts,
    recoverySheetImpressions,
    recoveredOrders,
    recoveredAfterAbandonment: recoveredOrders,
    abandonmentRate,
    abandonmentRatePct: abandonmentRate,
    recoveryRate,
    recoveryRatePct: recoveryRate,
    potentialLostRevenue,
    recoveredRevenue,
    feedbackTotal,
    feedbackCompleted,
    feedbackSkipped,
    feedbackCompletionRate,
    alternativesViewed,
    alternativesSwapped,
  };

  const summaryResult: AbandonmentSummaryMetrics = {
    ...metricsData,
    topReasons,
    metrics: metricsData as any,
  };

  return summaryResult;
}

/**
 * Retrieves the recent abandoned checkout attempts with customer context, feedback, and consent.
 */
export async function getRecentAbandonedCheckouts(
  rangeOrParams: ResolvedReportingPeriod | any,
  limit = 50,
  maskContact = false,
  statusFilter?: string
): Promise<AbandonedCheckoutRow[]> {
  const range = ensureResolvedPeriod(rangeOrParams);
  const isAllTime = range.period === "all";
  const dateCondition = isAllTime
    ? "1 = 1"
    : "(ca.created_at >= ? AND ca.created_at < ?)";
  const params: any[] = [];

  let statusCondition = "ca.status IN ('abandoned', 'failed', 'pending', 'converted')";
  if (statusFilter && statusFilter !== "all") {
    statusCondition = "ca.status = ?";
    params.push(statusFilter);
  }

  if (!isAllTime) {
    params.push(range.startSql, range.endSql);
  }
  params.push(Math.max(1, Math.min(200, limit)));

  const sql = `
    SELECT
      ca.id,
      ca.created_at,
      ca.abandoned_at,
      ca.recovery_shown_at,
      ca.user_id,
      ca.status,
      ca.amount,
      ca.currency,
      ca.checkout_data,
      ca.gateway_error_code,
      ca.gateway_error_desc,
      p.full_name AS profile_name,
      p.phone AS profile_phone,
      p.email AS profile_email,
      cf.id AS feedback_id,
      cf.skipped AS feedback_skipped,
      cf.reasons AS feedback_reasons,
      cf.comment AS feedback_comment,
      (
        SELECT GROUP_CONCAT(DISTINCT nc.channel SEPARATOR ', ')
        FROM notification_consents nc
        WHERE nc.attempt_id = ca.id AND nc.is_withdrawn = 0
      ) AS consent_channels
    FROM checkout_attempts ca
    LEFT JOIN profiles p ON ca.user_id = p.id
    LEFT JOIN checkout_feedback cf ON cf.attempt_id = ca.id
    WHERE ${statusCondition}
      AND ${dateCondition}
    ORDER BY ca.created_at DESC
    LIMIT ?
  `;

  const rows = await query<any[]>(sql, params);

  return (rows || []).map((row) => {
    let parsedCheckoutData: any = {};
    try {
      parsedCheckoutData =
        typeof row.checkout_data === "string"
          ? JSON.parse(row.checkout_data)
          : row.checkout_data || {};
    } catch {}

    const items = parsedCheckoutData.items || [];
    const shipping = parsedCheckoutData.shippingAddress || {};

    const rawName = shipping.shippingFullName || row.profile_name || "Customer";
    const rawPhone = shipping.shippingPhone || row.profile_phone || "";
    const rawEmail = row.profile_email || "";

    const customerName = rawName;
    const customerPhone = maskContact && rawPhone.length > 5
      ? `${rawPhone.slice(0, 3)}****${rawPhone.slice(-2)}`
      : rawPhone;
    const customerEmail = maskContact && rawEmail.includes("@")
      ? `${rawEmail[0]}***@${rawEmail.split("@")[1]}`
      : rawEmail;

    const itemsSummary = items
      .map((it: any) => `${it.productName || it.title || "Item"}${it.colorName ? ` (${it.colorName})` : ""}${it.quantity > 1 ? ` × ${it.quantity}` : ""}`)
      .join("; ");

    const mappedItems = items.map((it: any) => ({
      productId: it.productId || it.id || "",
      productName: it.productName || it.title || "Item",
      quantity: Number(it.quantity || 1),
      unitPrice: Number(it.unitPrice || it.price || 0),
      colorName: it.colorName || undefined,
      colorHex: it.colorHex || undefined,
    }));

    let feedbackStatus: "submitted" | "skipped" | "none" = "none";
    let parsedReasons: string[] = [];
    if (row.feedback_id) {
      if (row.feedback_skipped === 1 || row.feedback_skipped === true) {
        feedbackStatus = "skipped";
      } else {
        feedbackStatus = "submitted";
        try {
          parsedReasons =
            typeof row.feedback_reasons === "string"
              ? JSON.parse(row.feedback_reasons)
              : row.feedback_reasons || [];
        } catch {}
      }
    }

    const consentChannels = row.consent_channels
      ? String(row.consent_channels).split(", ")
      : [];

    return {
      id: row.id,
      createdAt: formatKolkataDisplay(new Date(row.created_at)),
      createdAtIso: new Date(row.created_at).toISOString(),
      userId: row.user_id || null,
      customerName,
      customerPhone,
      customerEmail,
      status: row.status,
      amount: Number(row.amount),
      currency: row.currency || "INR",
      itemsSummary: itemsSummary || "—",
      itemCount: items.length,
      items: mappedItems,
      gatewayErrorCode: row.gateway_error_code || null,
      gatewayErrorDesc: row.gateway_error_desc || null,
      errorCode: row.gateway_error_code || null,
      errorDesc: row.gateway_error_desc || null,
      feedbackStatus,
      feedbackReasons: parsedReasons,
      reasons: parsedReasons,
      feedbackComment: row.feedback_comment || null,
      comment: row.feedback_comment || null,
      recoveryShownAt: row.recovery_shown_at ? new Date(row.recovery_shown_at).toISOString() : null,
      abandonedAt: row.abandoned_at ? new Date(row.abandoned_at).toISOString() : null,
      consentChannels,
      consentGiven: consentChannels.length > 0,
    };
  });
}

/**
 * Generates an RFC 4180 compliant CSV export for abandoned checkout attempts.
 *
 * Guarantees:
 * - UTF-8 BOM encoding for Excel/Numbers compatibility.
 * - Formula injection prevention: text cells starting with [=, +, -, @] are sanitized with single quote prefix.
 * - Accurate decimal currency formatting without symbol corruption.
 * - Zero secrets or token leakage.
 */
export async function listRecentAbandonedCheckouts(params: {
  period?: any;
  date?: string;
  range?: any;
  limit?: number;
  maskContact?: boolean;
}): Promise<{ checkouts: AbandonedCheckoutRow[]; total: number }> {
  const range = ensureResolvedPeriod(params);
  const checkouts = await getRecentAbandonedCheckouts(
    range,
    params.limit || 50,
    params.maskContact || false
  );
  return {
    checkouts,
    total: checkouts.length,
  };
}

/**
 * Generates an RFC 4180 compliant CSV export for abandoned checkout attempts.
 *
 * Guarantees:
 * - UTF-8 BOM encoding for Excel/Numbers compatibility.
 * - Formula injection prevention: text cells starting with [=, +, -, @] are sanitized with single quote prefix.
 * - Accurate decimal currency formatting without symbol corruption.
 * - Zero secrets or token leakage.
 */
export async function generateAbandonmentCsv(
  rangeOrParams: ResolvedReportingPeriod | any,
  maskContact = false
): Promise<{ csvContent: string; rowCount: number }> {
  const range = ensureResolvedPeriod(rangeOrParams);
  const checkouts = await getRecentAbandonedCheckouts(range, 1000, maskContact);

  const headers = [
    "Attempt ID",
    "Created Date (IST)",
    "Customer Name",
    "Customer Phone",
    "Customer Email",
    "Status",
    "Cart Items",
    "Total Value (INR)",
    "Error Code",
    "Error Reason",
    "Feedback Status",
    "Feedback Reasons",
    "Feedback Comment",
    "Consent Channels",
  ];

  const rows: string[][] = [];

  for (const c of checkouts) {
    const formattedId = `${c.id.slice(0, 8).toUpperCase()} (${c.id})`;
    rows.push([
      sanitizeCsvCell(formattedId),
      sanitizeCsvCell(c.createdAt),
      sanitizeCsvCell(c.customerName),
      sanitizeCsvCell(c.customerPhone),
      sanitizeCsvCell(c.customerEmail),
      sanitizeCsvCell(c.status),
      sanitizeCsvCell(c.itemsSummary),
      formatPlainDecimal(c.amount),
      sanitizeCsvCell(c.gatewayErrorCode || "—"),
      sanitizeCsvCell(c.gatewayErrorDesc || "—"),
      sanitizeCsvCell(c.feedbackStatus),
      sanitizeCsvCell(c.feedbackReasons.join("; ") || "—"),
      sanitizeCsvCell(c.feedbackComment || "—"),
      sanitizeCsvCell(c.consentChannels.join(", ") || "None"),
    ]);
  }

  const csvRows = [
    headers.map((h) => sanitizeCsvCell(h)).join(","),
    ...rows.map((r) => r.join(",")),
  ];

  // UTF-8 BOM prefix \uFEFF
  const csvContent = "\uFEFF" + csvRows.join("\r\n");

  return {
    csvContent,
    rowCount: checkouts.length,
  };
}

export function streamAbandonmentCsv(params: {
  period?: any;
  date?: string;
  range?: any;
  actorId?: string | null;
  maskContact?: boolean;
}): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const resolved = ensureResolvedPeriod(params);
        const { csvContent, rowCount } = await generateAbandonmentCsv(resolved, params.maskContact);
        controller.enqueue(encoder.encode(csvContent));

        if (params.actorId) {
          await recordExportAudit({
            actorId: params.actorId,
            exportType: "abandonment" as any,
            period: resolved.period,
            startDate: resolved.start,
            endDate: resolved.end,
            rowCount,
            status: "success",
          });
        }

        controller.close();
      } catch (err: any) {
        if (params.actorId) {
          try {
            const resolved = ensureResolvedPeriod(params);
            await recordExportAudit({
              actorId: params.actorId,
              exportType: "abandonment" as any,
              period: resolved.period,
              startDate: resolved.start,
              endDate: resolved.end,
              rowCount: 0,
              status: "failed",
              errorMessage: err?.message || "Export error",
            });
          } catch {}
        }
        controller.error(err);
      }
    },
  });
}
