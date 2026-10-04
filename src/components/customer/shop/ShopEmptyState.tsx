"use client";

import React from "react";
import Link from "next/link";

interface ShopEmptyStateProps {
  /** Is this a "no results" state (filters active) vs. truly empty catalog? */
  hasActiveFilters: boolean;
  /** Active search query if search was performed */
  searchQuery?: string;
  /** Callback to reset all filters */
  onClearFilters: () => void;
  /** Callback to clear only the search query */
  onClearSearch?: () => void;
}

export default function ShopEmptyState({
  hasActiveFilters,
  searchQuery = "",
  onClearFilters,
  onClearSearch,
}: ShopEmptyStateProps) {
  const isSearchActive = Boolean(searchQuery && searchQuery.trim());

  return (
    <div
      className="flex flex-col items-center justify-center text-center py-16 sm:py-20 px-6 bg-surface rounded-card border border-neutral-200/80 my-4"
      id="shop-empty-state"
    >
      {/* 3D Printer Icon Illustration */}
      <div
        className="w-20 h-20 sm:w-24 sm:h-24 rounded-full flex items-center justify-center mb-5 bg-neutral-100"
      >
        <span className="text-3xl sm:text-4xl" role="img" aria-label="3D printing search result">
          🖨️
        </span>
      </div>

      <h2
        className="text-xl sm:text-2xl font-bold mb-2 text-neutral-900"
      >
        {isSearchActive
          ? `No 3D prints found for “${searchQuery}”`
          : hasActiveFilters
          ? "No matching creations"
          : "Catalog coming soon"}
      </h2>

      <p
        className="text-sm max-w-md mb-6 text-neutral-500 leading-relaxed"
      >
        {isSearchActive
          ? "We couldn't find any 3D printed creations matching your query. Check your spelling or browse our full collection."
          : hasActiveFilters
          ? "Try adjusting your filters, selecting a different material or category, or exploring all creations."
          : "Our 3D printing workshop is currently preparing new models. Check back soon!"}
      </p>

      {/* Action buttons */}
      <div className="flex flex-wrap items-center justify-center gap-3">
        {isSearchActive ? (
          <>
            <button
              type="button"
              onClick={onClearSearch || onClearFilters}
              className="h-11 px-6 rounded-button bg-primary hover:bg-[#91BC7A] active:scale-98 text-neutral-900 text-sm font-semibold transition-all shadow-xs focus-visible:outline-2 focus-visible:outline-neutral-900"
            >
              Clear Search
            </button>
            <Link
              href="/shop"
              onClick={onClearFilters}
              className="h-11 px-6 rounded-button border border-neutral-300 hover:bg-neutral-100 active:scale-98 text-neutral-800 text-sm font-semibold transition-all inline-flex items-center justify-center focus-visible:outline-2 focus-visible:outline-primary"
            >
              Browse All 3D Prints
            </Link>
          </>
        ) : hasActiveFilters ? (
          <button
            type="button"
            onClick={onClearFilters}
            className="h-11 px-6 rounded-button bg-primary hover:bg-[#91BC7A] active:scale-98 text-neutral-900 text-sm font-semibold transition-all shadow-xs focus-visible:outline-2 focus-visible:outline-neutral-900"
          >
            Clear All Filters
          </button>
        ) : (
          <Link
            href="/"
            className="h-11 px-6 rounded-button bg-primary hover:bg-[#91BC7A] active:scale-98 text-neutral-900 text-sm font-semibold transition-all shadow-xs inline-flex items-center justify-center focus-visible:outline-2 focus-visible:outline-neutral-900"
          >
            Back to Home
          </Link>
        )}
      </div>
    </div>
  );
}
