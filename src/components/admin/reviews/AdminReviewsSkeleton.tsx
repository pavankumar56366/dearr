import React from "react";

/**
 * AdminReviewsSkeleton — Skeleton loading placeholder for Admin Reviews.
 * Provides accessible, animated layout matching metric cards, search toolbar, and review rows/cards.
 */
export function AdminReviewsSkeleton() {
  return (
    <div
      className="space-y-6 animate-pulse"
      aria-busy="true"
      aria-label="Loading reviews"
    >
      {/* Metric Cards Skeleton (6 Cards) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            className="p-4 rounded-2xl bg-surface border border-neutral-200/80 space-y-2.5"
          >
            <div className="h-3 w-20 bg-neutral-200 rounded" />
            <div className="h-7 w-12 bg-neutral-200 rounded" />
            <div className="h-2.5 w-24 bg-neutral-100 rounded" />
          </div>
        ))}
      </div>

      {/* Toolbar / Search Bar Skeleton */}
      <div className="p-4 rounded-2xl bg-surface border border-neutral-200/80 flex flex-col lg:flex-row gap-3">
        <div className="h-10 flex-1 bg-neutral-100 rounded-xl" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 lg:w-auto">
          <div className="h-10 w-28 bg-neutral-100 rounded-xl" />
          <div className="h-10 w-28 bg-neutral-100 rounded-xl" />
          <div className="h-10 w-28 bg-neutral-100 rounded-xl" />
          <div className="h-10 w-28 bg-neutral-100 rounded-xl" />
        </div>
      </div>

      {/* Desktop Table Skeleton (>= 1024px) */}
      <div className="hidden lg:block rounded-2xl bg-surface border border-neutral-200/80 overflow-hidden">
        <div className="p-4 border-b border-neutral-100 flex items-center justify-between">
          <div className="h-4 w-36 bg-neutral-200 rounded" />
          <div className="h-4 w-24 bg-neutral-100 rounded" />
        </div>
        <div className="divide-y divide-neutral-100">
          {[1, 2, 3, 4, 5].map((row) => (
            <div
              key={row}
              className="p-4 flex items-center justify-between gap-4"
            >
              <div className="space-y-1.5 flex-1 max-w-xs">
                <div className="h-4 bg-neutral-200 rounded w-4/5" />
                <div className="h-3 bg-neutral-100 rounded w-full" />
              </div>
              <div className="h-4 w-32 bg-neutral-200 rounded" />
              <div className="h-4 w-28 bg-neutral-100 rounded" />
              <div className="h-4 w-20 bg-neutral-200 rounded" />
              <div className="h-4 w-20 bg-neutral-100 rounded" />
              <div className="h-4 w-24 bg-neutral-100 rounded" />
              <div className="h-6 w-20 bg-neutral-100 rounded-full" />
              <div className="h-8 w-8 bg-neutral-100 rounded-lg shrink-0" />
            </div>
          ))}
        </div>
      </div>

      {/* Mobile Cards Skeleton (< 1024px) */}
      <div className="lg:hidden space-y-3">
        {[1, 2, 3, 4].map((card) => (
          <div
            key={card}
            className="p-4 rounded-2xl bg-surface border border-neutral-200/80 space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="h-4 w-32 bg-neutral-200 rounded" />
              <div className="h-6 w-16 bg-neutral-100 rounded-full" />
            </div>
            <div className="h-3 w-48 bg-neutral-100 rounded" />
            <div className="h-3 w-full bg-neutral-100 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
