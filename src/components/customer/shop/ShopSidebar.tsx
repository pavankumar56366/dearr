"use client";

/**
 * ShopSidebar — Desktop category filter sidebar for the Shop page.
 * Design Ref: docs/4.DESIGN(1) (1).md §4.3 (Grid), §5 (Components)
 *
 * Shows category list with product counts.
 * Active category is highlighted with the primary color.
 * Includes stock availability and price range filters.
 */
import { useState, useEffect } from "react";

const CATEGORY_ICON_MAP: Record<string, string> = {
  "spiritual-idols": "🕉️",
  "articulated-toys": "🦎",
  "custom-keychains": "🔑",
  "desk-organizers": "📂",
  "lithophane-lamps": "💡",
  "home-decor": "🏺",
  "miniatures-decor": "✨",
};

interface ShopSidebarProps {
  activeCategory: string;
  onCategoryChange: (slug: string) => void;
  showInStock: boolean;
  onStockToggle: () => void;
  products?: any[];
  categories?: any[];
}

export default function ShopSidebar({
  activeCategory,
  onCategoryChange,
  showInStock,
  onStockToggle,
  products = [],
  categories: initialCategories,
}: ShopSidebarProps) {
  const [categories, setCategories] = useState<any[]>(initialCategories || []);

  useEffect(() => {
    if (initialCategories && initialCategories.length > 0) {
      setCategories(initialCategories);
      return;
    }

    let isMounted = true;
    async function loadCategories() {
      try {
        const res = await fetch("/api/categories");
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data.ok && Array.isArray(data.categories)) {
            setCategories(data.categories);
          }
        }
      } catch (err) {
        console.error("[ShopSidebar Categories Fetch]", err);
      }
    }

    loadCategories();
    return () => {
      isMounted = false;
    };
  }, [initialCategories]);

  // Compute real product count per category (active products only)
  const categoryCounts = categories.map((cat) => {
    const count = (products || []).filter((p) => {
      const pCatSlug =
        typeof p.category === "object" && p.category !== null
          ? p.category.slug
          : p.categorySlug;
      return pCatSlug === cat.slug && p.isActive !== false;
    }).length;
    return { ...cat, liveCount: count };
  });

  const totalActive = (products || []).filter((p) => p.isActive !== false).length;

  return (
    <aside
      className="hidden lg:block w-[260px] shrink-0"
      id="shop-sidebar"
      aria-label="Shop filters"
    >
      <div
        className="sticky top-24 rounded-2xl overflow-hidden"
        style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-neutral-100)",
          boxShadow: "var(--shadow-card)",
        }}
      >
        {/* Categories Section */}
        <div className="p-5">
          <h2
            className="text-xs font-bold uppercase tracking-wider mb-4"
            style={{ color: "var(--color-neutral-500)" }}
          >
            Categories
          </h2>
          <ul className="space-y-1">
            {/* All Products */}
            <li>
              <button
                type="button"
                onClick={() => onCategoryChange("all")}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150"
                style={{
                  background:
                    activeCategory === "all"
                      ? "rgba(162,203,139,0.12)"
                      : "transparent",
                  color:
                    activeCategory === "all"
                      ? "var(--color-neutral-900)"
                      : "var(--color-neutral-700)",
                  fontWeight: activeCategory === "all" ? 700 : 500,
                }}
              >
                <span className="flex items-center gap-2.5">
                  <span className="text-base">🛒</span>
                  <span>All Products</span>
                </span>
                <span
                  className="text-xs font-semibold rounded-full px-2 py-0.5"
                  style={{
                    background:
                      activeCategory === "all"
                        ? "var(--color-primary)"
                        : "var(--color-neutral-100)",
                    color:
                      activeCategory === "all"
                        ? "var(--color-neutral-900)"
                        : "var(--color-neutral-500)",
                  }}
                >
                  {totalActive}
                </span>
              </button>
            </li>
            {/* Category Items */}
            {categoryCounts.map((cat) => {
              const isActive = activeCategory === cat.slug;
              return (
                <li key={cat.id}>
                  <button
                    type="button"
                    onClick={() => onCategoryChange(cat.slug)}
                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150"
                    style={{
                      background: isActive
                        ? "rgba(162,203,139,0.12)"
                        : "transparent",
                      color: isActive
                        ? "var(--color-neutral-900)"
                        : "var(--color-neutral-700)",
                      fontWeight: isActive ? 700 : 500,
                    }}
                  >
                    <span className="flex items-center gap-2.5">
                      <span className="text-base">
                        {cat.icon || CATEGORY_ICON_MAP[cat.slug] || "✨"}
                      </span>
                      <span>{cat.name}</span>
                    </span>
                    <span
                      className="text-xs font-semibold rounded-full px-2 py-0.5"
                      style={{
                        background: isActive
                          ? "var(--color-primary)"
                          : "var(--color-neutral-100)",
                        color: isActive
                          ? "var(--color-neutral-900)"
                          : "var(--color-neutral-500)",
                      }}
                    >
                      {cat.liveCount}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Divider */}
        <div
          className="mx-5"
          style={{ height: "1px", background: "var(--color-neutral-100)" }}
        />

        {/* Availability Filter */}
        <div className="p-5">
          <h2
            className="text-xs font-bold uppercase tracking-wider mb-4"
            style={{ color: "var(--color-neutral-500)" }}
          >
            Availability
          </h2>
          <label className="flex items-center gap-3 cursor-pointer group">
            <div className="relative">
              <input
                type="checkbox"
                checked={showInStock}
                onChange={onStockToggle}
                className="sr-only peer"
              />
              <div
                className="w-10 h-[22px] rounded-full transition-colors duration-200 peer-checked:bg-[#A2CB8B]"
                style={{
                  background: showInStock
                    ? "var(--color-primary)"
                    : "var(--color-neutral-300)",
                }}
              />
              <div
                className="absolute top-[3px] left-[3px] w-4 h-4 rounded-full bg-white transition-transform duration-200 shadow-sm"
                style={{
                  transform: showInStock
                    ? "translateX(18px)"
                    : "translateX(0)",
                }}
              />
            </div>
            <span
              className="text-sm font-medium"
              style={{ color: "var(--color-neutral-700)" }}
            >
              In stock only
            </span>
          </label>
        </div>
      </div>
    </aside>
  );
}
