import React from "react";

/**
 * AdminProductsSkeleton — Reusable skeleton loading state for Admin Products table & cards.
 * Provides accessible, animated placeholders for future API loading cycles.
 */
export function AdminProductsSkeleton() {
  return (
    <div className="space-y-6 animate-pulse" aria-busy="true" aria-label="Loading products">
      {/* Metric Cards Skeleton */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="p-4 rounded-2xl bg-surface border border-neutral-200/80 space-y-2.5"
          >
            <div className="h-3 w-20 bg-neutral-200 rounded" />
            <div className="h-7 w-12 bg-neutral-200 rounded" />
            <div className="h-2.5 w-28 bg-neutral-100 rounded" />
          </div>
        ))}
      </div>

      {/* Toolbar Skeleton */}
      <div className="p-4 rounded-2xl bg-surface border border-neutral-200/80 flex flex-col sm:flex-row gap-3">
        <div className="h-10 flex-1 bg-neutral-100 rounded-xl" />
        <div className="h-10 w-36 bg-neutral-100 rounded-xl" />
        <div className="h-10 w-32 bg-neutral-100 rounded-xl" />
      </div>

      {/* Desktop Table Skeleton */}
      <div className="hidden md:block rounded-2xl bg-surface border border-neutral-200/80 overflow-hidden">
        <div className="p-4 border-b border-neutral-100 flex items-center justify-between">
          <div className="h-4 w-32 bg-neutral-200 rounded" />
          <div className="h-4 w-24 bg-neutral-100 rounded" />
        </div>
        <div className="divide-y divide-neutral-100">
          {[1, 2, 3, 4, 5, 6].map((row) => (
            <div key={row} className="p-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 flex-1">
                <div className="w-12 h-12 rounded-xl bg-neutral-200 shrink-0" />
                <div className="space-y-1.5 flex-1 max-w-sm">
                  <div className="h-4 bg-neutral-200 rounded w-3/4" />
                  <div className="h-3 bg-neutral-100 rounded w-1/2" />
                </div>
              </div>
              <div className="h-4 w-24 bg-neutral-100 rounded hidden lg:block" />
              <div className="h-4 w-16 bg-neutral-200 rounded" />
              <div className="h-6 w-20 bg-neutral-100 rounded-full" />
              <div className="h-6 w-16 bg-neutral-100 rounded-full" />
              <div className="h-8 w-8 bg-neutral-100 rounded-lg shrink-0" />
            </div>
          ))}
        </div>
      </div>

      {/* Mobile Cards Skeleton */}
      <div className="md:hidden space-y-3">
        {[1, 2, 3, 4].map((card) => (
          <div
            key={card}
            className="p-4 rounded-2xl bg-surface border border-neutral-200/80 space-y-3"
          >
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-xl bg-neutral-200 shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-neutral-200 rounded w-3/4" />
                <div className="h-3 bg-neutral-100 rounded w-1/2" />
              </div>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-neutral-100">
              <div className="h-4 w-16 bg-neutral-200 rounded" />
              <div className="h-6 w-20 bg-neutral-100 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
