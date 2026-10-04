import React from "react";

/**
 * AdminDashboardSkeleton — Reusable loading skeleton for Admin Dashboard (/admin).
 * Matches the exact grid dimensions and responsive hierarchy of the live dashboard:
 * - Header (Badges, title, subtitle, CTA button placeholders)
 * - 5 Summary Metric Cards (grid-cols-2 sm:grid-cols-3 lg:grid-cols-5)
 * - 3 Quick Action Cards (grid-cols-1 sm:grid-cols-3)
 * - 2 Recent Panels (Recent Orders & Recent Products side-by-side on xl screens)
 */
export function AdminDashboardSkeleton() {
  return (
    <div
      className="space-y-6 max-w-7xl mx-auto animate-pulse"
      aria-busy="true"
      aria-label="Loading Admin Dashboard"
    >
      {/* 1. Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-neutral-200/60">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="h-4 w-24 bg-neutral-200 rounded" />
            <div className="h-4 w-28 bg-neutral-100 rounded" />
          </div>
          <div className="h-8 w-44 bg-neutral-200 rounded-xl" />
          <div className="h-3.5 w-72 max-w-full bg-neutral-100 rounded" />
        </div>

        <div className="flex items-center gap-3">
          <div className="h-9 w-32 bg-neutral-100 rounded-xl" />
          <div className="h-9 w-28 bg-neutral-200 rounded-xl" />
        </div>
      </div>

      {/* 2. Summary Metric Cards Skeleton (5 cards) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="p-4 sm:p-5 rounded-2xl bg-surface border border-neutral-200/80 shadow-xs flex flex-col justify-between gap-3 min-h-[110px]"
          >
            <div className="flex items-center justify-between">
              <div className="h-3 w-20 bg-neutral-200 rounded" />
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-neutral-100 shrink-0" />
            </div>
            <div className="space-y-1.5">
              <div className="h-7 w-16 bg-neutral-200 rounded-lg" />
              <div className="h-2.5 w-24 bg-neutral-100 rounded" />
            </div>
          </div>
        ))}
      </div>

      {/* 3. Quick Actions Skeleton (3 action cards) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="h-3.5 w-28 bg-neutral-200 rounded" />
          <div className="h-3 w-36 bg-neutral-100 rounded" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="p-4 sm:p-5 rounded-2xl bg-surface border border-neutral-200/80 shadow-xs flex items-start justify-between gap-3"
            >
              <div className="space-y-2 flex-1">
                <div className="w-10 h-10 rounded-xl bg-neutral-100 mb-2" />
                <div className="h-4 w-32 bg-neutral-200 rounded" />
                <div className="h-3 w-full bg-neutral-100 rounded" />
                <div className="h-3 w-3/4 bg-neutral-100 rounded" />
              </div>
              <div className="w-7 h-7 rounded-full bg-neutral-100 shrink-0 mt-1" />
            </div>
          ))}
        </div>
      </div>

      {/* 4. Recent Data Panels Skeleton (2 panels) */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 pt-2">
        {/* Panel 1: Recent Orders Skeleton */}
        <div className="p-5 rounded-2xl bg-surface border border-neutral-200/80 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
            <div className="space-y-1">
              <div className="h-4 w-28 bg-neutral-200 rounded" />
              <div className="h-3 w-44 bg-neutral-100 rounded" />
            </div>
            <div className="h-3.5 w-24 bg-neutral-100 rounded" />
          </div>

          <div className="space-y-3">
            {[1, 2, 3, 4].map((row) => (
              <div key={row} className="py-2 flex items-center justify-between gap-3 border-b border-neutral-50">
                <div className="h-3.5 w-24 bg-neutral-200 rounded font-mono" />
                <div className="h-3.5 w-28 bg-neutral-100 rounded" />
                <div className="h-5 w-16 bg-neutral-100 rounded-full" />
                <div className="h-3.5 w-14 bg-neutral-200 rounded" />
              </div>
            ))}
          </div>

          <div className="pt-2 border-t border-neutral-100 flex items-center justify-between">
            <div className="h-3 w-28 bg-neutral-100 rounded" />
            <div className="h-3 w-20 bg-neutral-100 rounded" />
          </div>
        </div>

        {/* Panel 2: Recent Products Skeleton */}
        <div className="p-5 rounded-2xl bg-surface border border-neutral-200/80 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
            <div className="space-y-1">
              <div className="h-4 w-32 bg-neutral-200 rounded" />
              <div className="h-3 w-48 bg-neutral-100 rounded" />
            </div>
            <div className="h-3.5 w-24 bg-neutral-100 rounded" />
          </div>

          <div className="space-y-3">
            {[1, 2, 3, 4].map((row) => (
              <div key={row} className="py-2 flex items-center justify-between gap-3 border-b border-neutral-50">
                <div className="flex items-center gap-2.5 flex-1 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-neutral-200 shrink-0" />
                  <div className="space-y-1 flex-1">
                    <div className="h-3.5 w-3/4 bg-neutral-200 rounded" />
                    <div className="h-2.5 w-1/2 bg-neutral-100 rounded" />
                  </div>
                </div>
                <div className="h-5 w-14 bg-neutral-100 rounded-full" />
                <div className="h-3.5 w-12 bg-neutral-200 rounded" />
              </div>
            ))}
          </div>

          <div className="pt-2 border-t border-neutral-100 flex items-center justify-between">
            <div className="h-3 w-28 bg-neutral-100 rounded" />
            <div className="h-3 w-20 bg-neutral-100 rounded" />
          </div>
        </div>
      </div>
    </div>
  );
}
