import "server-only";
import { query } from "./db";

export type ReportingPeriod = "day" | "week" | "month" | "year" | "all";

export interface ResolvedReportingPeriod {
  period: ReportingPeriod;
  timezone: "Asia/Kolkata";
  start: Date;
  end: Date;
  startDateUtc: Date;
  endDateUtc: Date;
  startIso: string;
  endIso: string;
  startSql: string;
  endSql: string;
  startIst: string;
  endIst: string;
  label: string;
  dateKey: string;
  filenameKey: string;
}

export interface OrderDashboardMetrics {
  totalOrders: number;
  pendingDispatch: number;
  dispatched: number;
  delivered: number;
  cancelled: number;
  revenue: number;
}

export class AnalyticsValidationError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = "AnalyticsValidationError";
    this.statusCode = statusCode;
  }
}

// ---------------------------------------------------------------------------
// Asia/Kolkata Timezone Helpers
// ---------------------------------------------------------------------------

const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000; // +05:30 in milliseconds

/**
 * Gets the current date/time components in Asia/Kolkata timezone.
 */
export function getNowInAsiaKolkata(): {
  year: number;
  month: number; // 1-12
  day: number; // 1-31
  hours: number;
  minutes: number;
  seconds: number;
  dayOfWeek: number; // 0=Sun, 1=Mon, ..., 6=Sat
  dateStr: string; // YYYY-MM-DD
} {
  const now = new Date();
  const istTime = new Date(now.getTime() + IST_OFFSET_MS);

  const year = istTime.getUTCFullYear();
  const month = istTime.getUTCMonth() + 1;
  const day = istTime.getUTCDate();
  const hours = istTime.getUTCHours();
  const minutes = istTime.getUTCMinutes();
  const seconds = istTime.getUTCSeconds();
  const dayOfWeek = istTime.getUTCDay();

  const pad = (n: number) => n.toString().padStart(2, "0");
  const dateStr = `${year}-${pad(month)}-${pad(day)}`;

  return { year, month, day, hours, minutes, seconds, dayOfWeek, dateStr };
}

/**
 * Converts an Asia/Kolkata calendar date and time into a UTC Date object.
 */
export function kolkataToUtcDate(
  year: number,
  month: number, // 1-12
  day: number,
  hours = 0,
  minutes = 0,
  seconds = 0,
  ms = 0
): Date {
  const utcMs = Date.UTC(year, month - 1, day, hours, minutes, seconds, ms) - IST_OFFSET_MS;
  return new Date(utcMs);
}

/**
 * Formats a UTC Date into Asia/Kolkata SQL string "YYYY-MM-DD HH:mm:ss".
 */
export function formatKolkataSqlDateTime(date: Date): string {
  const ist = new Date(date.getTime() + IST_OFFSET_MS);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${ist.getUTCFullYear()}-${pad(ist.getUTCMonth() + 1)}-${pad(ist.getUTCDate())} ${pad(
    ist.getUTCHours()
  )}:${pad(ist.getUTCMinutes())}:${pad(ist.getUTCSeconds())}`;
}

/**
 * Formats a UTC Date into Asia/Kolkata readable string "YYYY-MM-DD HH:mm".
 */
export function formatKolkataDisplay(date: Date): string {
  const ist = new Date(date.getTime() + IST_OFFSET_MS);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${ist.getUTCFullYear()}-${pad(ist.getUTCMonth() + 1)}-${pad(ist.getUTCDate())} ${pad(
    ist.getUTCHours()
  )}:${pad(ist.getUTCMinutes())}`;
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function getDaysInMonth(year: number, month: number): number {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  if ([4, 6, 9, 11].includes(month)) return 30;
  return 31;
}

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const SHORT_MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

// ---------------------------------------------------------------------------
// Reporting Period Resolution
// ---------------------------------------------------------------------------

export interface PeriodResolutionParams {
  period?: string | null;
  date?: string | null;
  month?: string | null;
  year?: string | null;
}

/**
 * Resolves local-period boundaries in Asia/Kolkata [start, end) half-open intervals.
 * Enforces strict validation on date formats, calendar ranges, and period keywords.
 */
export function resolveReportingPeriod(
  params: PeriodResolutionParams
): ResolvedReportingPeriod {
  const rawPeriod = (params.period || "day").trim().toLowerCase();

  const validPeriods: ReportingPeriod[] = ["day", "week", "month", "year", "all"];
  if (!validPeriods.includes(rawPeriod as ReportingPeriod)) {
    throw new AnalyticsValidationError(
      `Invalid reporting period "${params.period}". Valid options: day, week, month, year, all`,
      400
    );
  }

  const period = rawPeriod as ReportingPeriod;
  const currentIst = getNowInAsiaKolkata();

  if (period === "day") {
    let targetDateStr = params.date?.trim() || currentIst.dateStr;

    // Validate format YYYY-MM-DD
    if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDateStr)) {
      throw new AnalyticsValidationError(
        `Invalid date format "${targetDateStr}". Expected YYYY-MM-DD`,
        400
      );
    }

    const [yStr, mStr, dStr] = targetDateStr.split("-");
    const y = parseInt(yStr, 10);
    const m = parseInt(mStr, 10);
    const d = parseInt(dStr, 10);

    if (m < 1 || m > 12) {
      throw new AnalyticsValidationError(`Invalid month in date "${targetDateStr}"`, 400);
    }
    const maxDays = getDaysInMonth(y, m);
    if (d < 1 || d > maxDays) {
      throw new AnalyticsValidationError(
        `Invalid day in date "${targetDateStr}". Month ${m} in year ${y} has ${maxDays} days`,
        400
      );
    }

    const start = kolkataToUtcDate(y, m, d, 0, 0, 0, 0);
    // End is next day midnight in Asia/Kolkata [start, end)
    let nextY = y;
    let nextM = m;
    let nextD = d + 1;
    if (nextD > maxDays) {
      nextD = 1;
      nextM += 1;
      if (nextM > 12) {
        nextM = 1;
        nextY += 1;
      }
    }
    const end = kolkataToUtcDate(nextY, nextM, nextD, 0, 0, 0, 0);

    const pad = (n: number) => n.toString().padStart(2, "0");
    const isToday = targetDateStr === currentIst.dateStr;
    const label = `${pad(d)} ${SHORT_MONTH_NAMES[m - 1]} ${y}${isToday ? " (Today)" : ""}`;

    return {
      period: "day",
      timezone: "Asia/Kolkata",
      start,
      end,
      startDateUtc: start,
      endDateUtc: end,
      startIso: start.toISOString(),
      endIso: end.toISOString(),
      startSql: formatKolkataSqlDateTime(start),
      endSql: formatKolkataSqlDateTime(end),
      startIst: formatKolkataSqlDateTime(start),
      endIst: formatKolkataSqlDateTime(end),
      label,
      dateKey: targetDateStr,
      filenameKey: targetDateStr,
    };
  }

  if (period === "week") {
    // "Last Week" is defined as the previous completed Monday–Sunday calendar week in Asia/Kolkata.
    // Sunday is day 0 in JS. We map Sunday to 7 so Mon=1, Tue=2, ..., Sun=7.
    const dayOfWeek = currentIst.dayOfWeek === 0 ? 7 : currentIst.dayOfWeek;

    // Days to subtract to reach current week's Monday
    const daysSinceCurrentMonday = dayOfWeek - 1;

    // Previous completed Monday is (daysSinceCurrentMonday + 7) days before today
    const prevMondayDate = new Date(
      Date.UTC(currentIst.year, currentIst.month - 1, currentIst.day) -
        (daysSinceCurrentMonday + 7) * 24 * 60 * 60 * 1000
    );

    const prevSundayDate = new Date(
      prevMondayDate.getTime() + 6 * 24 * 60 * 60 * 1000
    );

    const endMondayDate = new Date(
      prevMondayDate.getTime() + 7 * 24 * 60 * 60 * 1000
    );

    const start = kolkataToUtcDate(
      prevMondayDate.getUTCFullYear(),
      prevMondayDate.getUTCMonth() + 1,
      prevMondayDate.getUTCDate(),
      0,
      0,
      0,
      0
    );

    const end = kolkataToUtcDate(
      endMondayDate.getUTCFullYear(),
      endMondayDate.getUTCMonth() + 1,
      endMondayDate.getUTCDate(),
      0,
      0,
      0,
      0
    );

    const pad = (n: number) => n.toString().padStart(2, "0");
    const startStr = `${prevMondayDate.getUTCFullYear()}-${pad(
      prevMondayDate.getUTCMonth() + 1
    )}-${pad(prevMondayDate.getUTCDate())}`;
    const endStr = `${prevSundayDate.getUTCFullYear()}-${pad(
      prevSundayDate.getUTCMonth() + 1
    )}-${pad(prevSundayDate.getUTCDate())}`;

    const label = `${pad(prevMondayDate.getUTCDate())} ${
      SHORT_MONTH_NAMES[prevMondayDate.getUTCMonth()]
    } – ${pad(prevSundayDate.getUTCDate())} ${
      SHORT_MONTH_NAMES[prevSundayDate.getUTCMonth()]
    } ${prevSundayDate.getUTCFullYear()}`;

    return {
      period: "week",
      timezone: "Asia/Kolkata",
      start,
      end,
      startDateUtc: start,
      endDateUtc: end,
      startIso: start.toISOString(),
      endIso: end.toISOString(),
      startSql: formatKolkataSqlDateTime(start),
      endSql: formatKolkataSqlDateTime(end),
      startIst: formatKolkataSqlDateTime(start),
      endIst: formatKolkataSqlDateTime(end),
      label,
      dateKey: `${startStr}_to_${endStr}`,
      filenameKey: `${startStr}_to_${endStr}`,
    };
  }

  if (period === "month") {
    let targetMonthStr = params.month?.trim();
    if (!targetMonthStr) {
      const pad = (n: number) => n.toString().padStart(2, "0");
      targetMonthStr = `${currentIst.year}-${pad(currentIst.month)}`;
    }

    if (!/^\d{4}-\d{2}$/.test(targetMonthStr)) {
      throw new AnalyticsValidationError(
        `Invalid month format "${targetMonthStr}". Expected YYYY-MM`,
        400
      );
    }

    const [yStr, mStr] = targetMonthStr.split("-");
    const y = parseInt(yStr, 10);
    const m = parseInt(mStr, 10);

    if (m < 1 || m > 12) {
      throw new AnalyticsValidationError(`Invalid month number "${m}" in "${targetMonthStr}"`, 400);
    }

    const start = kolkataToUtcDate(y, m, 1, 0, 0, 0, 0);

    let nextY = y;
    let nextM = m + 1;
    if (nextM > 12) {
      nextM = 1;
      nextY += 1;
    }
    const end = kolkataToUtcDate(nextY, nextM, 1, 0, 0, 0, 0);

    const label = `${MONTH_NAMES[m - 1]} ${y}`;

    return {
      period: "month",
      timezone: "Asia/Kolkata",
      start,
      end,
      startDateUtc: start,
      endDateUtc: end,
      startIso: start.toISOString(),
      endIso: end.toISOString(),
      startSql: formatKolkataSqlDateTime(start),
      endSql: formatKolkataSqlDateTime(end),
      startIst: formatKolkataSqlDateTime(start),
      endIst: formatKolkataSqlDateTime(end),
      label,
      dateKey: targetMonthStr,
      filenameKey: targetMonthStr,
    };
  }

  if (period === "year") {
    let targetYearStr = params.year?.trim();
    if (!targetYearStr) {
      targetYearStr = currentIst.year.toString();
    }

    if (!/^\d{4}$/.test(targetYearStr)) {
      throw new AnalyticsValidationError(
        `Invalid year format "${targetYearStr}". Expected YYYY`,
        400
      );
    }

    const y = parseInt(targetYearStr, 10);
    if (y < 2000 || y > 2100) {
      throw new AnalyticsValidationError(`Year out of range "${y}". Must be between 2000 and 2100`, 400);
    }

    const start = kolkataToUtcDate(y, 1, 1, 0, 0, 0, 0);
    const end = kolkataToUtcDate(y + 1, 1, 1, 0, 0, 0, 0);

    return {
      period: "year",
      timezone: "Asia/Kolkata",
      start,
      end,
      startDateUtc: start,
      endDateUtc: end,
      startIso: start.toISOString(),
      endIso: end.toISOString(),
      startSql: formatKolkataSqlDateTime(start),
      endSql: formatKolkataSqlDateTime(end),
      startIst: formatKolkataSqlDateTime(start),
      endIst: formatKolkataSqlDateTime(end),
      label: `Year ${y}`,
      dateKey: targetYearStr,
      filenameKey: targetYearStr,
    };
  }

  // period === 'all'
  const start = new Date(0); // Epoch
  const end = new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000); // 100 years into future

  return {
    period: "all",
    timezone: "Asia/Kolkata",
    start,
    end,
    startDateUtc: start,
    endDateUtc: end,
    startIso: start.toISOString(),
    endIso: end.toISOString(),
    startSql: "1970-01-01 00:00:00",
    endSql: "2100-01-01 00:00:00",
    startIst: "1970-01-01 00:00:00",
    endIst: "2100-01-01 00:00:00",
    label: "All Time",
    dateKey: "all",
    filenameKey: "all",
  };
}

export const resolveReportingInterval = resolveReportingPeriod;

// ---------------------------------------------------------------------------
// Canonical Bucket Mapping & Invariant Logic
// ---------------------------------------------------------------------------

export type CanonicalMetricBucket =
  | "pending_dispatch"
  | "dispatched"
  | "delivered"
  | "cancelled"
  | "ineligible";

/**
 * Maps raw database order states into mutually exclusive canonical dashboard buckets.
 *
 * Rules:
 * 1. Cancelled orders always map to 'cancelled', even if previously shipped.
 * 2. Unpaid online payment attempts (status='pending' and payment_status in ('pending', 'failed'))
 *    are classified as 'ineligible' and never count in any order metric or revenue.
 * 3. Legitimate COD orders placed under supported COD flow count as placed orders.
 * 4. Placed orders:
 *    - 'pending', 'confirmed', 'processing' -> 'pending_dispatch'
 *    - 'shipped', 'dispatched' -> 'dispatched'
 *    - 'delivered' -> 'delivered'
 *    - 'cancelled' -> 'cancelled'
 */
export function mapToCanonicalBucket(
  status: string,
  paymentStatus: string,
  isCod = false
): CanonicalMetricBucket {
  const normStatus = (status || "").toLowerCase().trim();
  const normPayment = (paymentStatus || "").toLowerCase().trim();

  // Cancelled orders always go strictly into cancelled bucket
  if (normStatus === "cancelled") {
    // If it was never a placed order (unpaid attempt that was cancelled/failed), is it eligible?
    // Cancelled placed orders go to 'cancelled'.
    if (normPayment === "paid" || normPayment === "refunded" || isCod) {
      return "cancelled";
    }
    // Abandoned attempt that was cancelled
    return "ineligible";
  }

  // Must be a verified paid order or legitimate COD order to be considered placed
  const isPaid = normPayment === "paid" || normPayment === "simulated" || normPayment === "refunded";
  if (!isPaid && !isCod) {
    return "ineligible";
  }

  if (normStatus === "delivered") {
    return "delivered";
  }

  if (normStatus === "shipped" || normStatus === "dispatched") {
    return "dispatched";
  }

  if (
    normStatus === "confirmed" ||
    normStatus === "processing" ||
    normStatus === "pending"
  ) {
    return "pending_dispatch";
  }

  // Unknown or unmapped historical states default safely to pending_dispatch for auditability
  return "pending_dispatch";
}

/**
 * Direct canonical mapper from order status to one of the 4 mutually exclusive status buckets.
 */
export function mapToCanonicalStatus(status: string): "pending_dispatch" | "dispatched" | "delivered" | "cancelled" {
  const norm = (status || "").toLowerCase().trim();
  if (norm === "cancelled") return "cancelled";
  if (norm === "delivered") return "delivered";
  if (norm === "shipped" || norm === "dispatched") return "dispatched";
  return "pending_dispatch";
}

export const CANONICAL_STATUS_SQL_EXPRESSION = `
  CASE
    WHEN o.status = 'cancelled' THEN 'cancelled'
    WHEN o.status = 'delivered' THEN 'delivered'
    WHEN o.status IN ('shipped', 'dispatched') THEN 'dispatched'
    ELSE 'pending_dispatch'
  END
`;

// ---------------------------------------------------------------------------
// Server-Side Database Aggregation
// ---------------------------------------------------------------------------

/**
 * Authoritative SQL predicate for eligible placed orders.
 *
 * Placed orders are defined as:
 *   - Verified paid online orders (payment_status = 'paid')
 *   - Placed online orders that were subsequently refunded (payment_status = 'refunded')
 *   - Legitimate COD orders placed via supported flow (payment_status = 'cod' or provider = 'cod')
 * Excludes abandoned online checkout attempts (payment_status = 'pending' or 'failed').
 */
export const PLACED_ORDER_SQL_PREDICATE = `(
  o.payment_status = 'paid'
  OR o.payment_status = 'refunded'
  OR LOWER(COALESCE(o.payment_status, '')) = 'cod'
  OR LOWER(COALESCE(o.payment_status, '')) = 'collection_pending'
  OR (EXISTS (SELECT 1 FROM payments py WHERE py.order_id = o.id AND py.status IN ('verified', 'captured') AND py.provider_payment_id IS NOT NULL))
)`;

/**
 * Authoritative SQL predicate for revenue eligibility.
 *
 * Requirements:
 * 1. An order must NOT be cancelled (o.status != 'cancelled').
 * 2. An order must NOT be refunded (o.payment_status != 'refunded'). A captured payment record
 *    alone does NOT override the order's explicit refunded state.
 * 3. An order must have verified payment:
 *    - Either o.payment_status = 'paid'
 *    - OR an authoritative captured payment record exists (EXISTS (SELECT 1 FROM payments py WHERE py.order_id = o.id AND py.status = 'captured'))
 *
 * Deduplication Guarantee:
 * The existential subquery EXISTS (...) evaluates boolean presence and never joins or multiplies
 * rows from orders o. Thus, duplicate payment records cannot double-count or multiply revenue.
 */
export const REVENUE_ELIGIBLE_SQL_PREDICATE = `(
  o.status != 'cancelled'
  AND o.payment_status != 'refunded'
  AND (
    o.payment_status = 'paid'
    OR EXISTS (
      SELECT 1 FROM payments py
      WHERE py.order_id = o.id
        AND py.status = 'captured'
    )
  )
)`;

/**
 * Aggregates the exact six dashboard figures in MySQL for a selected reporting period.
 *
 * Invariant Guarantee:
 *   Total Orders = Pending Dispatch + Dispatched + Delivered + Cancelled
 *
 * Revenue Guarantee:
 *   Actual confirmed/captured payments from non-cancelled placed orders created in the range.
 */
export async function getOrderSummaryMetrics(
  range: ResolvedReportingPeriod
): Promise<OrderDashboardMetrics> {
  const isAllTime = range.period === "all";

  const dateCondition = isAllTime
    ? "1 = 1"
    : "(o.created_at >= ? AND o.created_at < ?)";

  const params = isAllTime ? [] : [range.startSql, range.endSql];

  const sql = `
    SELECT
      COUNT(*) AS total_orders,
      COALESCE(SUM(CASE WHEN o.status != 'cancelled' AND o.status IN ('pending', 'confirmed', 'processing') THEN 1 ELSE 0 END), 0) AS pending_dispatch,
      COALESCE(SUM(CASE WHEN o.status != 'cancelled' AND o.status IN ('shipped', 'dispatched') THEN 1 ELSE 0 END), 0) AS dispatched,
      COALESCE(SUM(CASE WHEN o.status != 'cancelled' AND o.status = 'delivered' THEN 1 ELSE 0 END), 0) AS delivered,
      COALESCE(SUM(CASE WHEN o.status = 'cancelled' THEN 1 ELSE 0 END), 0) AS cancelled,
      COALESCE(SUM(CASE WHEN ${REVENUE_ELIGIBLE_SQL_PREDICATE} THEN o.total_amount ELSE 0 END), 0) AS revenue
    FROM orders o
    WHERE ${PLACED_ORDER_SQL_PREDICATE}
      AND ${dateCondition}
  `;

  try {
    const rows = await query<any[]>(sql, params);
    const row = rows?.[0] || {};

    const totalOrders = Number(row.total_orders || 0);
    const pendingDispatch = Number(row.pending_dispatch || 0);
    const dispatched = Number(row.dispatched || 0);
    const delivered = Number(row.delivered || 0);
    const cancelled = Number(row.cancelled || 0);
    const revenue = Math.round(Number(row.revenue || 0) * 100) / 100;

    // Safety verification of the mutually exclusive invariant:
    // If there is any status outside canonical buckets, reconcile it into pending_dispatch so Total = sum of parts
    const bucketSum = pendingDispatch + dispatched + delivered + cancelled;
    const diff = totalOrders - bucketSum;
    const reconciledPending = diff > 0 ? pendingDispatch + diff : pendingDispatch;

    return {
      totalOrders,
      pendingDispatch: reconciledPending,
      dispatched,
      delivered,
      cancelled,
      revenue,
    };
  } catch (err: any) {
    console.error("[getOrderSummaryMetrics] Database aggregation failed:", err?.message || err);
    throw err;
  }
}
