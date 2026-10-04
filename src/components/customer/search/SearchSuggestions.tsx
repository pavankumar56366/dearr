"use client";

import React from "react";
import Link from "next/link";
import {
  PopularSearchItem,
  CategorySearchItem,
  POPULAR_SEARCHES,
  SEARCH_CATEGORIES,
  RECENT_SEARCHES,
} from "./search-mock-data";

interface SearchSuggestionsProps {
  onSelectQuery: (query: string) => void;
  onSelectCategory?: (category: CategorySearchItem) => void;
  popularSearches?: PopularSearchItem[];
  categories?: CategorySearchItem[];
  recentSearches?: string[];
}

export function SearchSuggestions({
  onSelectQuery,
  onSelectCategory,
  popularSearches = POPULAR_SEARCHES,
  categories = SEARCH_CATEGORIES,
  recentSearches = RECENT_SEARCHES,
}: SearchSuggestionsProps) {
  return (
    <div className="w-full space-y-6">
      {/* Recent Searches Tags / Chips */}
      {recentSearches.length > 0 && (
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-neutral-500 mb-2">
            Recent Searches
          </div>
          <div className="flex flex-wrap gap-2">
            {recentSearches.map((term, index) => (
              <button
                key={index}
                type="button"
                onClick={() => onSelectQuery(term)}
                className="px-3 py-1.5 rounded-full bg-neutral-100 hover:bg-primary/20 text-neutral-800 text-xs font-medium transition-colors border border-neutral-200 active:scale-95 focus-visible:outline-2 focus-visible:outline-primary"
              >
                {term}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Two Column Grid on Desktop, Stack on Mobile (Matching search-desktop.png) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12">
        {/* Popular Searches Column */}
        <div className="space-y-1">
          <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500 mb-2">
            Popular Searches
          </h3>
          <ul className="divide-y divide-neutral-100" role="list">
            {popularSearches.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => onSelectQuery(item.query)}
                  className="w-full py-3 flex items-center justify-between text-left group hover:text-primary transition-colors focus-visible:outline-2 focus-visible:outline-primary rounded-sm"
                >
                  <span className="text-sm font-medium text-neutral-900 group-hover:text-primary transition-colors">
                    {item.query}
                  </span>
                  <span
                    className="text-neutral-400 group-hover:text-primary group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all text-xs font-semibold"
                    aria-hidden="true"
                  >
                    ↗
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* Browse Categories Column */}
        <div className="space-y-1">
          <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500 mb-2">
            Browse Categories
          </h3>
          <ul className="divide-y divide-neutral-100" role="list">
            {categories.map((cat) => (
              <li key={cat.id}>
                <Link
                  href={`/shop?cat=${cat.slug}`}
                  onClick={() => onSelectCategory && onSelectCategory(cat)}
                  className="w-full py-3 flex items-center justify-between text-left group hover:text-primary transition-colors focus-visible:outline-2 focus-visible:outline-primary rounded-sm"
                >
                  <span className="text-sm font-medium text-neutral-900 group-hover:text-primary transition-colors">
                    {cat.name}
                  </span>
                  <span className="text-xs font-semibold text-neutral-400 group-hover:text-primary transition-colors tabular-nums">
                    {cat.count}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
