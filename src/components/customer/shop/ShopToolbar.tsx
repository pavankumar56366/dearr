"use client";

/**
 * ShopToolbar — Sort / view-mode toolbar for the Shop product grid.
 * Design Ref: docs/4.DESIGN(1) (1).md §5.2 (Inputs), §5.1 (Buttons)
 *
 * Shows: result count, sort dropdown, grid/list view toggle.
 */

export type SortOption =
  | "featured"
  | "newest"
  | "price-low"
  | "price-high"
  | "name-az";

export type ViewMode = "grid" | "list";

interface ShopToolbarProps {
  totalResults: number;
  sortBy: SortOption;
  onSortChange: (sort: SortOption) => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
}

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "featured", label: "Featured" },
  { value: "newest", label: "Newest" },
  { value: "price-low", label: "Price: Low to High" },
  { value: "price-high", label: "Price: High to Low" },
  { value: "name-az", label: "Name: A → Z" },
];

export default function ShopToolbar({
  totalResults,
  sortBy,
  onSortChange,
  viewMode,
  onViewModeChange,
}: ShopToolbarProps) {
  return (
    <div
      className="flex items-center justify-between gap-4 mb-6"
      id="shop-toolbar"
    >
      {/* Result Count */}
      <p
        className="text-sm font-medium shrink-0"
        style={{ color: "var(--color-neutral-500)" }}
      >
        <span
          className="font-bold"
          style={{ color: "var(--color-neutral-900)" }}
        >
          {totalResults}
        </span>{" "}
        {totalResults === 1 ? "product" : "products"}
      </p>

      {/* Right Side Controls */}
      <div className="flex items-center gap-3">
        {/* Sort Dropdown */}
        <div className="relative">
          <select
            id="shop-sort-select"
            value={sortBy}
            aria-label="Sort products by"
            onChange={(e) => onSortChange(e.target.value as SortOption)}
            className="appearance-none cursor-pointer text-sm font-medium pl-3 pr-8 py-2 rounded-xl transition-colors duration-150 focus:outline-none focus:ring-2"
            style={{
              border: "1px solid var(--color-neutral-300)",
              background: "var(--color-surface)",
              color: "var(--color-neutral-700)",
            }}
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          {/* Custom chevron */}
          <svg
            className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ color: "var(--color-neutral-500)" }}
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </div>

        {/* View Mode Toggle (hidden on small mobile) */}
        <div
          className="hidden sm:flex items-center rounded-xl overflow-hidden"
          style={{ border: "1px solid var(--color-neutral-300)" }}
        >
          <button
            type="button"
            onClick={() => onViewModeChange("grid")}
            className="p-2 transition-colors duration-150"
            style={{
              background:
                viewMode === "grid"
                  ? "var(--color-primary)"
                  : "var(--color-surface)",
              color:
                viewMode === "grid"
                  ? "var(--color-neutral-900)"
                  : "var(--color-neutral-500)",
            }}
            aria-label="Grid view"
            title="Grid view"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="3" width="7" height="7" />
              <rect x="14" y="3" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => onViewModeChange("list")}
            className="p-2 transition-colors duration-150"
            style={{
              background:
                viewMode === "list"
                  ? "var(--color-primary)"
                  : "var(--color-surface)",
              color:
                viewMode === "list"
                  ? "var(--color-neutral-900)"
                  : "var(--color-neutral-500)",
            }}
            aria-label="List view"
            title="List view"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="8" x2="21" y1="6" y2="6" />
              <line x1="8" x2="21" y1="12" y2="12" />
              <line x1="8" x2="21" y1="18" y2="18" />
              <line x1="3" x2="3.01" y1="6" y2="6" />
              <line x1="3" x2="3.01" y1="12" y2="12" />
              <line x1="3" x2="3.01" y1="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
