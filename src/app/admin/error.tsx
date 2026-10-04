"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { AlertCircleIcon, RefreshCwIcon, LayoutDashboardIcon } from "@/components/admin/AdminIcons";

interface AdminErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * Admin Dashboard Error Boundary
 * Safe, professional error screen if an unexpected exception occurs during dashboard rendering.
 * Never exposes database connection details, environment variables, or raw SQL.
 */
export default function AdminError({ error, reset }: AdminErrorProps) {
  useEffect(() => {
    // Log sanitized error message to console for diagnostics without leaking credentials
    console.error("[Admin Dashboard Boundary Error]:", error?.message || "Unknown error");
  }, [error]);

  return (
    <div className="max-w-2xl mx-auto py-12 px-4 sm:px-6">
      <div className="p-6 sm:p-8 rounded-2xl bg-surface border border-neutral-200/80 shadow-xs space-y-6 text-center">
        <div className="w-14 h-14 rounded-2xl bg-rose-50 border border-rose-200/60 text-rose-600 flex items-center justify-center mx-auto">
          <AlertCircleIcon size={28} />
        </div>

        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-800 border border-rose-200">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
            <span>Dashboard Operations Offline</span>
          </div>
          <h1 className="font-display text-xl sm:text-2xl font-bold text-neutral-900">
            Unable to Load Dashboard
          </h1>
          <p className="text-xs sm:text-sm text-neutral-500 max-w-md mx-auto leading-relaxed">
            The admin dashboard encountered a temporary communication failure with the backend services. No data was altered.
          </p>
        </div>

        <div className="p-4 rounded-xl bg-neutral-50 border border-neutral-200/70 text-left text-xs text-neutral-600 space-y-1">
          <div className="font-semibold text-neutral-700">What you can do:</div>
          <ul className="list-disc list-inside space-y-0.5 text-neutral-500 text-[11px]">
            <li>Check if Hostinger MySQL database service is reachable.</li>
            <li>Retry the dashboard connection using the button below.</li>
            <li>Verify your administrator session has not expired.</li>
          </ul>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => reset()}
            id="admin-error-retry"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-primary hover:bg-[#91BC7A] text-xs font-bold text-neutral-900 transition-all shadow-xs"
          >
            <RefreshCwIcon size={14} />
            <span>Retry Connection</span>
          </button>

          <Link
            href="/admin"
            id="admin-error-reload"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border border-neutral-300 hover:border-neutral-400 bg-surface hover:bg-neutral-50 text-xs font-semibold text-neutral-800 transition-all shadow-xs"
          >
            <LayoutDashboardIcon size={14} />
            <span>Reload Admin</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
