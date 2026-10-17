"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import Link from "next/link";
import {
  CalendarIcon,
  DownloadIcon,
  RefreshCwIcon,
  AlertCircleIcon,
  CheckCircleIcon,
  ShoppingCartIcon,
  ClockIcon,
  UserIcon,
  ChevronDownIcon,
  XIcon,
} from "../AdminIcons";

export type ReportingPeriod = "day" | "week" | "month" | "year" | "all";

interface AbandonmentMetrics {
  totalInitiatedCheckouts: number;
  completedOrders: number;
  abandonedCheckouts: number;
  paymentFailures: number;
  recoverySheetImpressions: number;
  recoveredAfterAbandonment: number;
  abandonmentRatePct: number;
  recoveryRatePct: number;
  potentialLostRevenue: number;
  recoveredRevenue: number;
}

interface TopReason {
  reason: string;
  count: number;
  percentage: number;
}

interface AbandonedCheckoutItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  colorName?: string;
  colorHex?: string;
}

interface AbandonedCheckoutRecord {
  id: string;
  userId: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  amount: number;
  currency: string;
  status: "pending" | "abandoned" | "failed" | "converted";
  createdAt: string;
  abandonedAt?: string | null;
  recoveryShownAt?: string | null;
  errorCode?: string | null;
  errorDesc?: string | null;
  reasons?: string[];
  comment?: string | null;
  items?: AbandonedCheckoutItem[];
}

function getTodayIstString(): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  } catch {
    return new Date().toISOString().split("T")[0];
  }
}

export function AdminAbandonmentDashboard() {
  const initialToday = useMemo(() => getTodayIstString(), []);
  const initialMonth = useMemo(() => initialToday.slice(0, 7), [initialToday]);
  const initialYear = useMemo(() => initialToday.slice(0, 4), [initialToday]);

  const [period, setPeriod] = useState<ReportingPeriod>("day");
  const [dateVal, setDateVal] = useState<string>(initialToday);
  const [monthVal, setMonthVal] = useState<string>(initialMonth);
  const [yearVal, setYearVal] = useState<string>(initialYear);

  const [metrics, setMetrics] = useState<AbandonmentMetrics>({
    totalInitiatedCheckouts: 0,
    completedOrders: 0,
    abandonedCheckouts: 0,
    paymentFailures: 0,
    recoverySheetImpressions: 0,
    recoveredAfterAbandonment: 0,
    abandonmentRatePct: 0,
    recoveryRatePct: 0,
    potentialLostRevenue: 0,
    recoveredRevenue: 0,
  });

  const [topReasons, setTopReasons] = useState<TopReason[]>([]);
  const [checkouts, setCheckouts] = useState<AbandonedCheckoutRecord[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [rangeLabel, setRangeLabel] = useState<string>("Today");

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const activeRequestIdRef = useRef<number>(0);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const buildQueryParams = useCallback(() => {
    const params = new URLSearchParams();
    params.set("period", period);
    if (period === "day") params.set("date", dateVal);
    if (period === "month") params.set("month", monthVal);
    if (period === "year") params.set("year", yearVal);
    return params.toString();
  }, [period, dateVal, monthVal, yearVal]);

  const loadData = useCallback(async () => {
    const requestId = ++activeRequestIdRef.current;
    setIsLoading(true);
    setFetchError(null);
    try {
      const q = buildQueryParams();
      const statusParam = statusFilter !== "all" ? `&status=${statusFilter}` : "";

      const [summaryRes, checkoutsRes] = await Promise.all([
        fetch(`/api/admin/abandonment/summary?${q}`),
        fetch(`/api/admin/abandonment/checkouts?${q}${statusParam}&limit=100`),
      ]);

      if (requestId !== activeRequestIdRef.current) {
        return;
      }

      if (!summaryRes.ok) {
        const errJson = await summaryRes.json().catch(() => ({}));
        throw new Error(errJson.error || `Summary request failed (${summaryRes.status})`);
      }

      if (!checkoutsRes.ok) {
        const errJson = await checkoutsRes.json().catch(() => ({}));
        throw new Error(errJson.error || `Checkouts request failed (${checkoutsRes.status})`);
      }

      const sumData = await summaryRes.json();
      const chkData = await checkoutsRes.json();

      if (requestId !== activeRequestIdRef.current) {
        return;
      }

      if (!sumData.ok) {
        throw new Error(sumData.error || "Failed to load abandonment summary");
      }
      if (!chkData.ok) {
        throw new Error(chkData.error || "Failed to load abandonment checkouts");
      }

      const metricsData = sumData.metrics || {};
      setMetrics({
        totalInitiatedCheckouts: Number(metricsData.totalInitiatedCheckouts ?? metricsData.checkoutAttempts ?? 0),
        completedOrders: Number(metricsData.completedOrders ?? metricsData.convertedAttempts ?? 0),
        abandonedCheckouts: Number(metricsData.abandonedCheckouts ?? metricsData.abandonedAttempts ?? 0),
        paymentFailures: Number(metricsData.paymentFailures ?? metricsData.failedAttempts ?? 0),
        recoverySheetImpressions: Number(metricsData.recoverySheetImpressions ?? 0),
        recoveredAfterAbandonment: Number(metricsData.recoveredAfterAbandonment ?? metricsData.recoveredOrders ?? 0),
        abandonmentRatePct: Number(metricsData.abandonmentRatePct ?? metricsData.abandonmentRate ?? 0),
        recoveryRatePct: Number(metricsData.recoveryRatePct ?? metricsData.recoveryRate ?? 0),
        potentialLostRevenue: Number(metricsData.potentialLostRevenue ?? 0),
        recoveredRevenue: Number(metricsData.recoveredRevenue ?? 0),
      });

      setTopReasons(sumData.topReasons || sumData.metrics?.topReasons || []);

      if (sumData.range?.label) {
        setRangeLabel(sumData.range.label);
      }

      setCheckouts(chkData.checkouts || []);
    } catch (err: any) {
      if (requestId === activeRequestIdRef.current) {
        console.error("[ABANDONMENT_LOAD_DATA_FAILED]", err);
        setFetchError(err.message || "Failed to refresh abandonment data. Please check your connection.");
        setMetrics({
          totalInitiatedCheckouts: 0,
          completedOrders: 0,
          abandonedCheckouts: 0,
          paymentFailures: 0,
          recoverySheetImpressions: 0,
          recoveredAfterAbandonment: 0,
          abandonmentRatePct: 0,
          recoveryRatePct: 0,
          potentialLostRevenue: 0,
          recoveredRevenue: 0,
        });
        setTopReasons([]);
        setCheckouts([]);
      }
    } finally {
      if (requestId === activeRequestIdRef.current) {
        setIsLoading(false);
      }
    }
  }, [buildQueryParams, statusFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleExportCsv = async () => {
    setIsExporting(true);
    try {
      const q = buildQueryParams();
      const exportUrl = `/api/admin/abandonment/export?${q}`;
      const res = await fetch(exportUrl);
      if (!res.ok) {
        throw new Error(`Export failed with status ${res.status}`);
      }

      const blob = await res.blob();
      const contentDisposition = res.headers.get("content-disposition");
      let filename = `cart_abandonment_${period}.csv`;
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?([^"]+)"?/);
        if (match && match[1]) {
          filename = match[1];
        }
      }

      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(downloadUrl);

      showToast(`Exported ${filename} successfully`);
    } catch (err: any) {
      showToast(err.message || "Failed to download export CSV");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          role="status"
          className="fixed bottom-6 right-6 z-50 bg-neutral-900 text-white text-xs sm:text-sm font-medium px-4 py-3 rounded-xl shadow-lg border border-neutral-700 animate-in fade-in slide-in-from-bottom-2 duration-200 flex items-center gap-2"
        >
          <span className="w-2 h-2 rounded-full bg-primary" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-neutral-900">
              Cart Abandonment & Recovery
            </h1>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-200">
              {fetchError ? "—" : `${(metrics.abandonmentRatePct ?? 0).toFixed(1)}% drop-off`}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-neutral-500 mt-1">
            Monitor checkout drop-offs, payment failures, recovery drawer engagement, and reasons for leaving.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            href="/admin/orders"
            className="px-3.5 py-2 rounded-xl border border-neutral-200 bg-surface hover:bg-neutral-100 text-xs font-bold text-neutral-700 transition-colors"
          >
            ← Back to Orders
          </Link>
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={isExporting}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-neutral-900 text-white hover:bg-neutral-800 text-xs font-bold transition-all disabled:opacity-50 shadow-2xs cursor-pointer"
          >
            <DownloadIcon size={14} />
            <span>{isExporting ? "Exporting..." : "Export CSV"}</span>
          </button>
        </div>
      </div>

      {/* Groundwork Info Alert */}
      <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200/90 text-amber-950 text-xs flex items-start sm:items-center gap-3">
        <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0 mt-1 sm:mt-0" />
        <div className="flex-1">
          <span className="font-bold">Automated Recovery Groundwork Active: </span>
          <span>
            Checkout dismissal recovery sheets, lower-priced alternative swaps, and structured feedback collection are live on customer checkouts. Future automation consent channels are stored securely (zero external emails/SMS sent).
          </span>
        </div>
      </div>

      {/* Reporting Period Filter Bar */}
      <section
        aria-label="Period Controls"
        className="p-4 rounded-2xl bg-surface border border-neutral-200/80 shadow-2xs space-y-3"
      >
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-bold text-neutral-600 mr-1 flex items-center gap-1">
              <CalendarIcon size={14} className="text-neutral-500" />
              <span>Period:</span>
            </span>
            {(
              [
                { id: "day", label: "Day" },
                { id: "week", label: "Last Week" },
                { id: "month", label: "Month" },
                { id: "year", label: "Year" },
                { id: "all", label: "Overall" },
              ] as { id: ReportingPeriod; label: string }[]
            ).map((p) => {
              const isActive = period === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPeriod(p.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    isActive
                      ? "bg-neutral-900 text-white shadow-2xs"
                      : "bg-neutral-100 hover:bg-neutral-200/80 text-neutral-700 border border-neutral-200/60"
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {period === "day" && (
              <input
                type="date"
                value={dateVal}
                onChange={(e) => setDateVal(e.target.value)}
                className="h-8 px-2.5 rounded-xl border border-neutral-200 bg-canvas text-xs font-semibold text-neutral-800 focus:outline-none focus:ring-2 focus:ring-primary/40 font-mono"
              />
            )}
            {period === "month" && (
              <input
                type="month"
                value={monthVal}
                onChange={(e) => setMonthVal(e.target.value)}
                className="h-8 px-2.5 rounded-xl border border-neutral-200 bg-canvas text-xs font-semibold text-neutral-800 focus:outline-none focus:ring-2 focus:ring-primary/40 font-mono"
              />
            )}
            {period === "year" && (
              <input
                type="number"
                min="2020"
                max="2035"
                value={yearVal}
                onChange={(e) => setYearVal(e.target.value)}
                className="h-8 w-20 px-2 rounded-xl border border-neutral-200 bg-canvas text-xs font-semibold text-neutral-800 focus:outline-none focus:ring-2 focus:ring-primary/40 font-mono"
              />
            )}

            <button
              type="button"
              onClick={() => loadData()}
              disabled={isLoading}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-neutral-200 hover:bg-neutral-100 text-xs font-semibold text-neutral-700 transition-colors cursor-pointer"
              title="Refresh Analytics"
            >
              <RefreshCwIcon size={12} className={isLoading ? "animate-spin" : ""} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Reporting Range & Loading Pulse */}
        <div className="flex items-center justify-between text-xs text-neutral-500 pt-2 border-t border-neutral-100">
          <div className="flex items-center gap-2 flex-wrap">
            <span>Reporting Range:</span>
            <span className="font-bold text-neutral-900 bg-neutral-100 px-2 py-0.5 rounded-md border border-neutral-200 font-mono text-[11px]">
              {rangeLabel}
            </span>
            <span className="text-[10px] text-neutral-400 font-semibold uppercase">
              (Asia/Kolkata IST)
            </span>
          </div>

          {isLoading && (
            <div className="text-[11px] font-semibold text-emerald-700 flex items-center gap-1.5 animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span>Updating analytics...</span>
            </div>
          )}
        </div>
      </section>

      {/* In-page Error Banner with Retry */}
      {fetchError && (
        <div
          role="alert"
          className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-center justify-between gap-3 animate-in fade-in"
        >
          <div className="flex items-center gap-2">
            <AlertCircleIcon size={16} className="text-rose-600 shrink-0" />
            <span className="font-semibold">{fetchError}</span>
          </div>
          <button
            type="button"
            onClick={() => loadData()}
            className="px-3 py-1.5 rounded-xl bg-rose-600 text-white font-bold hover:bg-rose-700 transition-colors cursor-pointer shrink-0"
          >
            Retry Connection
          </button>
        </div>
      )}

      {/* Key Metric Cards */}
      <section
        aria-label="Summary KPI Cards"
        className={`grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 transition-opacity duration-150 ${
          isLoading ? "opacity-60" : "opacity-100"
        }`}
      >
        {/* Total Initiated */}
        <div className="p-4 rounded-2xl bg-surface border border-neutral-200/80 shadow-2xs space-y-1">
          <span className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider block">
            Initiated
          </span>
          <p className="font-display text-2xl font-bold text-neutral-900">
            {fetchError ? "—" : metrics.totalInitiatedCheckouts}
          </p>
          <span className="text-[10px] text-neutral-400 block">Total checkouts</span>
        </div>

        {/* Abandoned Checkouts */}
        <div className="p-4 rounded-2xl bg-surface border border-neutral-200/80 shadow-2xs space-y-1">
          <span className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider block">
            Abandoned
          </span>
          <div className="flex items-baseline gap-2">
            <p className="font-display text-2xl font-bold text-rose-600">
              {fetchError ? "—" : metrics.abandonedCheckouts}
            </p>
            <span className="text-xs font-bold text-rose-600">
              {fetchError ? "" : `${(metrics.abandonmentRatePct ?? 0).toFixed(1)}%`}
            </span>
          </div>
          <span className="text-[10px] text-neutral-400 block">Modal dismissals</span>
        </div>

        {/* Payment Failures */}
        <div className="p-4 rounded-2xl bg-surface border border-neutral-200/80 shadow-2xs space-y-1">
          <span className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider block">
            Gateway Failures
          </span>
          <p className="font-display text-2xl font-bold text-amber-600">
            {fetchError ? "—" : metrics.paymentFailures}
          </p>
          <span className="text-[10px] text-neutral-400 block">Declined / Network</span>
        </div>

        {/* Recovery Impressions */}
        <div className="p-4 rounded-2xl bg-surface border border-neutral-200/80 shadow-2xs space-y-1">
          <span className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider block">
            Recovery Shown
          </span>
          <p className="font-display text-2xl font-bold text-blue-600">
            {fetchError ? "—" : metrics.recoverySheetImpressions}
          </p>
          <span className="text-[10px] text-neutral-400 block">Drawers opened</span>
        </div>

        {/* Recovered Orders */}
        <div className="p-4 rounded-2xl bg-surface border border-neutral-200/80 shadow-2xs space-y-1">
          <span className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider block">
            Recovered
          </span>
          <div className="flex items-baseline gap-2">
            <p className="font-display text-2xl font-bold text-emerald-600">
              {fetchError ? "—" : metrics.recoveredAfterAbandonment}
            </p>
            <span className="text-xs font-bold text-emerald-600">
              {fetchError ? "" : `${(metrics.recoveryRatePct ?? 0).toFixed(1)}%`}
            </span>
          </div>
          <span className="text-[10px] text-neutral-400 block">Orders captured</span>
        </div>

        {/* Revenue Impact */}
        <div className="p-4 rounded-2xl bg-surface border border-neutral-200/80 shadow-2xs space-y-1">
          <span className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider block">
            At-Risk Value
          </span>
          <p className="font-display text-2xl font-bold text-neutral-900 font-mono">
            {fetchError ? "—" : `₹${(metrics.potentialLostRevenue ?? 0).toLocaleString("en-IN")}`}
          </p>
          <span className="text-[10px] text-emerald-600 font-bold block">
            {fetchError ? "—" : `+₹${(metrics.recoveredRevenue ?? 0).toLocaleString("en-IN")} recovered`}
          </span>
        </div>
      </section>

      {/* Top Reasons For Leaving */}
      <section className="p-5 rounded-2xl bg-surface border border-neutral-200/80 shadow-2xs space-y-4">
        <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
          <div>
            <h2 className="text-sm font-bold text-neutral-900">
              Top Customer Reasons for Leaving
            </h2>
            <p className="text-xs text-neutral-500 mt-0.5">
              Aggregated multi-select checkout feedback submitted directly on recovery drawer
            </p>
          </div>
          <span className="text-xs font-semibold text-neutral-500">
            {topReasons.reduce((acc, r) => acc + r.count, 0)} responses
          </span>
        </div>

        {topReasons.length === 0 ? (
          <div className="py-6 text-center text-xs text-neutral-400">
            No feedback responses recorded for this reporting period.
          </div>
        ) : (
          <div className="space-y-3">
            {topReasons.map((item, idx) => (
              <div key={idx} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-neutral-800">{item.reason}</span>
                  <span className="font-mono text-neutral-500">
                    {item.count} ({item.percentage}%)
                  </span>
                </div>
                <div className="h-2 w-full bg-neutral-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-500 rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(100, Math.max(3, item.percentage))}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Checkouts Table */}
      <section className="p-5 rounded-2xl bg-surface border border-neutral-200/80 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-neutral-100 pb-3">
          <div>
            <h2 className="text-sm font-bold text-neutral-900">
              Recent Abandoned & Failed Checkout Attempts
            </h2>
            <p className="text-xs text-neutral-500 mt-0.5">
              Authoritative 90-day retention attempts isolated from confirmed placed orders
            </p>
          </div>

          {/* Filter Status Selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-neutral-500">Filter:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-8 px-2.5 rounded-xl border border-neutral-200 bg-canvas text-xs font-semibold text-neutral-800 focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer"
            >
              <option value="all">All States</option>
              <option value="abandoned">Abandoned (Dismissed)</option>
              <option value="failed">Payment Failed</option>
              <option value="converted">Recovered / Converted</option>
              <option value="pending">Pending</option>
            </select>
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto rounded-xl border border-neutral-200/70">
          <table className="w-full text-left text-xs text-neutral-700">
            <thead className="bg-neutral-50 text-[11px] font-bold text-neutral-500 uppercase tracking-wider border-b border-neutral-200/80">
              <tr>
                <th className="py-3 px-4">Attempt / Time</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Cart Items</th>
                <th className="py-3 px-4">Value</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Feedback / Error</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 font-normal">
              {checkouts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-xs text-neutral-400">
                    {fetchError ? (
                      <span className="text-rose-500 font-semibold">{fetchError}</span>
                    ) : (
                      "No checkout attempts match this period and filter."
                    )}
                  </td>
                </tr>
              ) : (
                checkouts.map((chk) => (
                  <tr key={chk.id} className="hover:bg-neutral-50/60 transition-colors">
                    {/* Attempt ID & Date */}
                    <td className="py-3 px-4 align-top">
                      <span className="font-mono font-bold text-neutral-900 block">
                        ATT-{chk.id.slice(0, 8).toUpperCase()}
                      </span>
                      <span className="text-[11px] text-neutral-400 block font-mono">
                        {new Date(chk.createdAt).toLocaleString("en-IN", {
                          timeZone: "Asia/Kolkata",
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      {chk.recoveryShownAt && (
                        <span className="inline-block mt-1 text-[10px] font-semibold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">
                          Recovery Shown
                        </span>
                      )}
                    </td>

                    {/* Customer */}
                    <td className="py-3 px-4 align-top">
                      <span className="font-bold text-neutral-900 block">
                        {chk.customerName || "Customer"}
                      </span>
                      {chk.customerEmail && (
                        <span className="text-[11px] text-neutral-500 block truncate max-w-[160px]">
                          {chk.customerEmail}
                        </span>
                      )}
                      {chk.customerPhone && (
                        <span className="text-[11px] text-neutral-400 block font-mono">
                          {chk.customerPhone}
                        </span>
                      )}
                    </td>

                    {/* Items */}
                    <td className="py-3 px-4 align-top">
                      {(chk.items || []).length > 0 ? (
                        <div className="space-y-1">
                          {(chk.items || []).map((it, i) => (
                            <div key={i} className="text-[11px] text-neutral-800 flex items-center gap-1.5">
                              {it.colorHex && (
                                <span
                                  className="w-2.5 h-2.5 rounded-full border border-black/15 inline-block shrink-0"
                                  style={{ backgroundColor: it.colorHex }}
                                />
                              )}
                              <span>
                                {it.productName}
                                {it.colorName ? ` (${it.colorName})` : ""} × {it.quantity}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-neutral-400 italic">No snapshot</span>
                      )}
                    </td>

                    {/* Value */}
                    <td className="py-3 px-4 align-top font-mono font-bold text-neutral-900 whitespace-nowrap">
                      ₹{chk.amount.toLocaleString("en-IN")}
                    </td>

                    {/* Status Badge */}
                    <td className="py-3 px-4 align-top whitespace-nowrap">
                      {chk.status === "abandoned" && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-800 border border-rose-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                          <span>Abandoned</span>
                        </span>
                      )}
                      {chk.status === "failed" && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                          <span>Payment Failed</span>
                        </span>
                      )}
                      {chk.status === "converted" && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          <span>Converted</span>
                        </span>
                      )}
                      {chk.status === "pending" && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-neutral-100 text-neutral-800 border border-neutral-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-neutral-400" />
                          <span>Pending</span>
                        </span>
                      )}
                    </td>

                    {/* Feedback / Error details */}
                    <td className="py-3 px-4 align-top max-w-[220px]">
                      {chk.reasons && chk.reasons.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-1">
                          {chk.reasons.map((r, ri) => (
                            <span
                              key={ri}
                              className="text-[10px] font-semibold bg-neutral-100 text-neutral-700 px-1.5 py-0.5 rounded"
                            >
                              {r}
                            </span>
                          ))}
                        </div>
                      )}
                      {chk.errorCode && (
                        <p className="text-[11px] text-amber-700 font-mono">
                          {chk.errorCode}: {chk.errorDesc || "Payment declined"}
                        </p>
                      )}
                      {chk.comment && (
                        <p className="text-[11px] text-neutral-500 italic mt-0.5 line-clamp-2">
                          &quot;{chk.comment}&quot;
                        </p>
                      )}
                      {!chk.errorCode && (!chk.reasons || chk.reasons.length === 0) && (
                        <span className="text-neutral-400">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
