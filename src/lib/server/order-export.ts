import "server-only";
import crypto from "crypto";
import { query } from "./db";
import {
  type ResolvedReportingPeriod,
  formatKolkataDisplay,
  getOrderSummaryMetrics,
  resolveReportingPeriod,
  PLACED_ORDER_SQL_PREDICATE,
} from "./order-analytics";

export type ExportType = "orders" | "summary";

/**
 * Escapes a cell according to RFC 4180 CSV specifications and neutralizes formula injection.
 *
 * Security rules:
 * 1. If text starts with formula triggers (=, +, -, @) or whitespace followed by them,
 *    prepends a single quote (') to force spreadsheet software to treat as raw text.
 * 2. Proper CSV escaping: quotes cells containing comma, double quote, newline or carriage return.
 * 3. Does not corrupt pure numeric amounts or quantities.
 */
export function sanitizeCsvCell(value: unknown, isNumeric = false): string {
  if (value === null || value === undefined) {
    return "";
  }

  const str = String(value);

  if (isNumeric) {
    // Pure numeric values (like amounts and quantities) must not be corrupted with formula prefix
    return str;
  }

  // Formula injection prevention for untrusted text fields
  let sanitized = str;
  const trimmed = str.trimStart();
  if (
    trimmed.startsWith("=") ||
    trimmed.startsWith("+") ||
    trimmed.startsWith("-") ||
    trimmed.startsWith("@")
  ) {
    // Escape leading formula character
    sanitized = `'${str}`;
  }

  // RFC 4180 quoting
  if (
    sanitized.includes(",") ||
    sanitized.includes('"') ||
    sanitized.includes("\n") ||
    sanitized.includes("\r")
  ) {
    return `"${sanitized.replace(/"/g, '""')}"`;
  }

  return sanitized;
}

export function neutralizeFormula(str: string): string {
  const s = String(str);
  const trimmed = s.trimStart();
  if (
    trimmed.startsWith("=") ||
    trimmed.startsWith("+") ||
    trimmed.startsWith("-") ||
    trimmed.startsWith("@")
  ) {
    return `'${s}`;
  }
  return s;
}

export function escapeCsvValue(value: unknown, isNumeric = false): string {
  return sanitizeCsvCell(value, isNumeric);
}

export function formatIstTimestamp(date: Date): string {
  return formatKolkataDisplay(date);
}

export function formatPlainDecimal(amount: number): string {
  return Number(amount || 0).toFixed(2);
}

export function generateOrdersCsvFilename(rangeOrParams: any): string {
  if (rangeOrParams && rangeOrParams.filenameKey) {
    return getExportFilename("orders", rangeOrParams);
  }
  const resolved = resolveReportingPeriod(rangeOrParams);
  return getExportFilename("orders", resolved);
}

export function generateSummaryCsvFilename(rangeOrParams: any): string {
  if (rangeOrParams && rangeOrParams.filenameKey) {
    return getExportFilename("summary", rangeOrParams);
  }
  const resolved = resolveReportingPeriod(rangeOrParams);
  return getExportFilename("summary", resolved);
}

/**
 * Generates canonical, sanitized export filenames server-side based on period and type.
 * Examples:
 *   Orders: orders_2026-10-05.csv, orders_2026-10-05_to_2026-10-11.csv, orders_2026-10.csv, orders_all.csv
 *   Summary: orders_summary_2026-10-05.csv, orders_summary_all.csv
 */
export function getExportFilename(
  type: ExportType,
  range: ResolvedReportingPeriod
): string {
  const prefix = type === "summary" ? "orders_summary" : "orders";
  return `${prefix}_${range.filenameKey}.csv`;
}

/**
 * Records an export audit log entry for compliance.
 * Never stores customer PII, phone, email, or CSV data.
 */
export async function recordExportAudit(entry: {
  actorId: string;
  exportType: ExportType;
  period: string;
  startDate?: Date | null;
  endDate?: Date | null;
  rowCount: number;
  status: "success" | "failed";
  errorMessage?: string | null;
  ipAddress?: string | null;
}): Promise<void> {
  const id = crypto.randomUUID();
  try {
    await query(
      `INSERT INTO order_export_audits (
         id, actor_id, export_type, period,
         date_range_start, date_range_end,
         row_count, status, error_message, ip_address,
         created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        id,
        entry.actorId,
        entry.exportType,
        entry.period,
        entry.startDate ? entry.startDate : null,
        entry.endDate ? entry.endDate : null,
        entry.rowCount,
        entry.status,
        entry.errorMessage || null,
        entry.ipAddress || null,
      ]
    );
  } catch (err) {
    // Fall back to general audit_logs if table is not yet migrated
    try {
      await query(
        `INSERT INTO audit_logs (
           id, actor_id, action, entity, entity_id, details, created_at
         ) VALUES (?, ?, 'order_csv_export', 'orders', ?, ?, NOW())`,
        [
          id,
          entry.actorId,
          entry.exportType,
          JSON.stringify({
            period: entry.period,
            rowCount: entry.rowCount,
            status: entry.status,
            error: entry.errorMessage || null,
          }),
        ]
      );
    } catch (auditErr) {
      console.warn("[recordExportAudit] Audit logging notice:", auditErr);
    }
  }
}

/**
 * Formats in-memory summary metrics into CSV string with UTF-8 BOM.
 */
export function formatSummaryMetricsCsv(metrics: {
  totalOrders: number;
  pendingDispatch: number;
  dispatched: number;
  delivered: number;
  cancelled: number;
  revenue: number;
}): string {
  const BOM = "\uFEFF";
  const rows = [
    ["Metric", "Value"],
    ["Total Orders", sanitizeCsvCell(metrics.totalOrders, true)],
    ["Pending Dispatch", sanitizeCsvCell(metrics.pendingDispatch, true)],
    ["Dispatched", sanitizeCsvCell(metrics.dispatched, true)],
    ["Delivered", sanitizeCsvCell(metrics.delivered, true)],
    ["Cancelled", sanitizeCsvCell(metrics.cancelled, true)],
    ["Revenue", sanitizeCsvCell(Number(metrics.revenue || 0).toFixed(2), true)],
  ];

  return BOM + rows.map((r) => r.join(",")).join("\r\n") + "\r\n";
}

/**
 * Generates Summary CSV string with UTF-8 BOM, plain decimal amounts, and the six canonical figures.
 */
export async function generateSummaryCsv(
  rangeOrMetrics: ResolvedReportingPeriod | any
): Promise<{ csvContent: string; rowCount: number }> {
  let metrics: any;
  if (rangeOrMetrics && "totalOrders" in rangeOrMetrics) {
    metrics = rangeOrMetrics;
  } else {
    metrics = await getOrderSummaryMetrics(rangeOrMetrics);
  }

  const csvContent = formatSummaryMetricsCsv(metrics);
  return { csvContent, rowCount: 6 };
}

/**
 * Resolves the displayable amount paid and refund amount for an order in CSV export.
 *
 * Requirements:
 * 1. If payment_status === 'refunded', the order is conclusively defined as a full refund
 *    according to the application's monetary semantics:
 *    - amount_paid = total_amount (original captured payment)
 *    - refund_amount = total_amount (full refund amount)
 * 2. If payment_status === 'paid' and status !== 'cancelled', this is an active verified paid order:
 *    - amount_paid = total_amount
 *    - refund_amount = '0.00' (no refund issued)
 * 3. If status === 'cancelled' and order was previously paid, but refund has not yet transitioned to 'refunded':
 *    - amount_paid = total_amount
 *    - refund_amount = '' (unknown/pending: do not falsely confirm 0.00)
 * 4. Otherwise (unpaid online attempt or uncollected COD):
 *    - amount_paid = '0.00'
 *    - refund_amount = '0.00'
 */
export function resolveOrderExportAmounts(order: {
  payment_status?: string | null;
  status?: string | null;
  total_amount?: number | string | null;
}): { amountPaid: string; refundAmount: string } {
  const normPayment = String(order.payment_status || "").toLowerCase().trim();
  const normStatus = String(order.status || "").toLowerCase().trim();
  const total = Number(order.total_amount || 0);

  const wasPaid = normPayment === "paid" || normPayment === "refunded";
  const isCurrentlyPaid = normPayment === "paid";
  const isRefunded = normPayment === "refunded";
  const isCancelled = normStatus === "cancelled";

  const amountPaid = wasPaid ? total.toFixed(2) : "0.00";

  let refundAmount: string;
  if (isRefunded) {
    // Conclusively defined as a full refund in application semantics
    refundAmount = total.toFixed(2);
  } else if (isCurrentlyPaid && !isCancelled) {
    // Verified active, paid order with no refund recorded
    refundAmount = "0.00";
  } else if (isCancelled && wasPaid) {
    // Cancelled paid order with no explicit refund record: represent unknown as empty
    refundAmount = "";
  } else {
    // Unpaid online attempt or uncollected COD
    refundAmount = "0.00";
  }

  return { amountPaid, refundAmount };
}

/**
 * Streams the Orders List CSV in bounded-memory batches.
 *
 * Columns:
 *   order_id, created_at, customer_name, customer_phone, customer_email,
 *   items, quantity, payment_method, amount_paid, refund_amount,
 *   current_status, dispatched_at, delivered_at, cancelled_at
 */
export async function* streamOrdersListCsv(
  range: ResolvedReportingPeriod
): AsyncGenerator<string, { totalRows: number }, void> {
  // Yield UTF-8 BOM so Excel natively opens Hindi/Unicode and ₹ characters
  yield "\uFEFF";

  const headers = [
    "order_id",
    "created_at",
    "customer_name",
    "customer_phone",
    "customer_email",
    "items",
    "quantity",
    "payment_method",
    "amount_paid",
    "refund_amount",
    "current_status",
    "dispatched_at",
    "delivered_at",
    "cancelled_at",
  ];

  yield headers.join(",") + "\r\n";

  const isAllTime = range.period === "all";
  const dateCondition = isAllTime
    ? "1 = 1"
    : "(o.created_at >= ? AND o.created_at < ?)";
  const baseParams = isAllTime ? [] : [range.startSql, range.endSql];

  const BATCH_SIZE = 250;
  let offset = 0;
  let totalRows = 0;

  while (true) {
    const ordersBatch = await query<any[]>(
      `SELECT
         o.id,
         o.order_number,
         o.shipping_full_name,
         o.shipping_phone,
         p.email AS customer_email,
         o.payment_status,
         o.status,
         o.total_amount,
         o.created_at,
         o.dispatched_at,
         o.delivered_at,
         o.cancelled_at
       FROM orders o
       LEFT JOIN profiles p ON o.user_id = p.id
       WHERE ${PLACED_ORDER_SQL_PREDICATE}
         AND ${dateCondition}
       ORDER BY o.created_at DESC
       LIMIT ? OFFSET ?`,
      [...baseParams, BATCH_SIZE, offset]
    );

    if (!ordersBatch || ordersBatch.length === 0) {
      break;
    }

    const orderIds = ordersBatch.map((o) => o.id);

    // Fetch line items for this batch in one query (avoid N+1)
    const placeholders = orderIds.map(() => "?").join(",");
    const itemsRows = await query<any[]>(
      `SELECT
         oi.order_id,
         oi.product_name,
         oi.variant_name,
         oi.quantity
       FROM order_items oi
       WHERE oi.order_id IN (${placeholders})
       ORDER BY oi.created_at ASC`,
      orderIds
    );

    const itemsByOrder = new Map<string, { summary: string; totalQty: number }>();
    for (const item of itemsRows || []) {
      const existing = itemsByOrder.get(item.order_id) || { summary: "", totalQty: 0 };
      const desc = item.variant_name
        ? `${item.product_name} (${item.variant_name}) x${item.quantity}`
        : `${item.product_name} x${item.quantity}`;
      existing.summary = existing.summary ? `${existing.summary}; ${desc}` : desc;
      existing.totalQty += Number(item.quantity || 0);
      itemsByOrder.set(item.order_id, existing);
    }

    const batchLines: string[] = [];

    for (const o of ordersBatch) {
      totalRows++;

      const isCod =
        String(o.payment_status || "").toLowerCase() === "cod" ||
        String(o.payment_status || "").toLowerCase() === "collection_pending";

      const itemInfo = itemsByOrder.get(o.id) || { summary: "0 items", totalQty: 0 };
      const { amountPaid, refundAmount } = resolveOrderExportAmounts(o);

      const paymentMethod = isCod
        ? "Cash on Delivery"
        : "Razorpay (Online)";

      const row = [
        sanitizeCsvCell(o.order_number),
        sanitizeCsvCell(formatKolkataDisplay(new Date(o.created_at))),
        sanitizeCsvCell(o.shipping_full_name || "Customer"),
        sanitizeCsvCell(o.shipping_phone || ""),
        sanitizeCsvCell(o.customer_email || ""),
        sanitizeCsvCell(itemInfo.summary),
        sanitizeCsvCell(itemInfo.totalQty, true),
        sanitizeCsvCell(paymentMethod),
        sanitizeCsvCell(amountPaid, true),
        sanitizeCsvCell(refundAmount, refundAmount !== ""),
        sanitizeCsvCell(o.status),
        sanitizeCsvCell(o.dispatched_at ? formatKolkataDisplay(new Date(o.dispatched_at)) : ""),
        sanitizeCsvCell(o.delivered_at ? formatKolkataDisplay(new Date(o.delivered_at)) : ""),
        sanitizeCsvCell(o.cancelled_at ? formatKolkataDisplay(new Date(o.cancelled_at)) : ""),
      ];

      batchLines.push(row.join(","));
    }

    yield batchLines.join("\r\n") + "\r\n";

    if (ordersBatch.length < BATCH_SIZE) {
      break;
    }
    offset += BATCH_SIZE;
  }

  return { totalRows };
}
