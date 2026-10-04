import React from "react";

/**
 * AdminSettingsSkeleton — Skeleton loading placeholder for Admin Settings.
 * Provides accessible, animated layout matching multi-section configuration cards.
 */
export function AdminSettingsSkeleton() {
  return (
    <div
      className="space-y-6 animate-pulse max-w-4xl mx-auto pb-12"
      aria-busy="true"
      aria-label="Loading settings"
    >
      {/* Header Skeleton */}
      <div className="space-y-2">
        <div className="h-7 w-48 bg-neutral-200 rounded" />
        <div className="h-4 w-96 bg-neutral-100 rounded" />
      </div>

      {/* Sections Skeletons */}
      {[1, 2, 3, 4, 5].map((section) => (
        <div
          key={section}
          className="p-6 rounded-2xl bg-surface border border-neutral-200/80 space-y-4"
        >
          <div className="border-b border-neutral-100 pb-3 space-y-1.5">
            <div className="h-4 w-40 bg-neutral-200 rounded" />
            <div className="h-3 w-64 bg-neutral-100 rounded" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            <div className="space-y-1.5">
              <div className="h-3 w-24 bg-neutral-200 rounded" />
              <div className="h-10 bg-neutral-100 rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <div className="h-3 w-28 bg-neutral-200 rounded" />
              <div className="h-10 bg-neutral-100 rounded-xl" />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <div className="h-3 w-32 bg-neutral-200 rounded" />
              <div className="h-10 bg-neutral-100 rounded-xl" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
