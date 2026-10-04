"use client";

/**
 * MobileFilterSheet — Bottom sheet overlay for category / stock filtering on mobile.
 * Design Ref: docs/4.DESIGN(1) (1).md §4.4 (Corner Radius — Bottom sheets: 24px top)
 *
 * Opens as a slide-up overlay on mobile, includes category list + in-stock toggle.
 */
import { useState, useEffect, useCallback } from "react";
import { CloseIcon } from "@/components/customer/Icons";

const CATEGORY_ICON_MAP: Record<string, string> = {
  "spiritual-idols": "🕉️",
  "articulated-toys": "🦎",
  "custom-keychains": "🔑",
  "desk-organizers": "📂",
  "lithophane-lamps": "💡",
  "home-decor": "🏺",
  "miniatures-decor": "✨",
};

interface MobileFilterSheetProps {
  isOpen: boolean;
  onClose: () => void;
  activeCategory: string;
  onCategoryChange: (slug: string) => void;
  showInStock: boolean;
  onStockToggle: () => void;
  products?: any[];
  categories?: any[];
}

export default function MobileFilterSheet({
  isOpen,
  onClose,
  activeCategory,
  onCategoryChange,
  showInStock,
  onStockToggle,
  products = [],
  categories: initialCategories,
}: MobileFilterSheetProps) {
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
        console.error("[MobileFilterSheet Categories Fetch]", err);
      }
    }

    loadCategories();
    return () => {
      isMounted = false;
    };
  }, [initialCategories]);

  // Lock body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const handleCategorySelect = useCallback(
    (slug: string) => {
      onCategoryChange(slug);
      onClose();
    },
    [onCategoryChange, onClose]
  );

  const totalActive = (products || []).filter((p) => p.isActive !== false).length;

  const categoryCounts = categories.map((cat) => ({
    ...cat,
    liveCount: (products || []).filter((p) => {
      const pCatSlug =
        typeof p.category === "object" && p.category !== null
          ? p.category.slug
          : p.categorySlug;
      return pCatSlug === cat.slug && p.isActive !== false;
    }).length,
  }));

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 lg:hidden" id="mobile-filter-sheet">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sheet */}
      <div
        className="absolute bottom-0 left-0 right-0 max-h-[80vh] overflow-y-auto animate-slide-up"
        style={{
          background: "var(--color-surface)",
          borderRadius: "var(--radius-sheet) var(--radius-sheet) 0 0",
          boxShadow: "var(--shadow-modal)",
        }}
      >
        {/* Handle + Header */}
        <div className="sticky top-0 z-10 px-5 pt-3 pb-4" style={{ background: "var(--color-surface)" }}>
          <div
            className="w-10 h-1 rounded-full mx-auto mb-4"
            style={{ background: "var(--color-neutral-300)" }}
          />
          <div className="flex items-center justify-between">
            <h2
              className="text-lg font-bold"
              style={{ color: "var(--color-neutral-900)" }}
            >
              Filters
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-full flex items-center justify-center transition-colors"
              style={{
                background: "var(--color-neutral-100)",
                color: "var(--color-neutral-700)",
              }}
              aria-label="Close filters"
            >
              <CloseIcon size={18} />
            </button>
          </div>
        </div>

        {/* Categories */}
        <div className="px-5 pb-4">
          <h3
            className="text-xs font-bold uppercase tracking-wider mb-3"
            style={{ color: "var(--color-neutral-500)" }}
          >
            Categories
          </h3>
          <div className="space-y-1">
            {/* All */}
            <button
              type="button"
              onClick={() => handleCategorySelect("all")}
              className="w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-sm font-medium transition-all duration-150"
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

            {categoryCounts.map((cat) => {
              const isActive = activeCategory === cat.slug;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => handleCategorySelect(cat.slug)}
                  className="w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-sm font-medium transition-all duration-150"
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
              );
            })}
          </div>
        </div>

        {/* Divider */}
        <div
          className="mx-5"
          style={{ height: "1px", background: "var(--color-neutral-100)" }}
        />

        {/* Availability Toggle */}
        <div className="px-5 py-4">
          <h3
            className="text-xs font-bold uppercase tracking-wider mb-3"
            style={{ color: "var(--color-neutral-500)" }}
          >
            Availability
          </h3>
          <label className="flex items-center gap-3 cursor-pointer">
            <div className="relative">
              <input
                type="checkbox"
                checked={showInStock}
                onChange={onStockToggle}
                className="sr-only peer"
              />
              <div
                className="w-10 h-[22px] rounded-full transition-colors duration-200"
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

        {/* Bottom safe area padding for mobile nav */}
        <div className="h-6" />
      </div>
    </div>
  );
}
