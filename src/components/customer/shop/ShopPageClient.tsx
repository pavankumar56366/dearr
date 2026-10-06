"use client";

/**
 * ShopPageClient — Main client-side Shop / Product Listing page.
 * Design Ref: docs/4.DESIGN(1) (1).md §4.3 (Grid), §5.3 (Product Card)
 * Flow Ref: docs/3.APPFLOW(1).md §1 (Shop / All Products)
 *
 * Features:
 * - URL-driven category filtering (?cat=slug)
 * - URL-driven sort (?sort=price-low)
 * - In-stock toggle
 * - Grid / list view toggle (desktop)
 * - Mobile filter bottom sheet
 * - Breadcrumb navigation
 * - Responsive product grid (2 col mobile → 3 col tablet → 3 col desktop)
 * - Empty / no-results state
 *
 * All state is local + URL params — no backend.
 */
import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";

import ProductCard from "@/components/customer/home/ProductCard";
import { HeartIcon } from "@/components/customer/Icons";
import { useCart } from "@/context/CartContext";
import ShopSidebar from "./ShopSidebar";
import ShopToolbar from "./ShopToolbar";
import type { SortOption, ViewMode } from "./ShopToolbar";
import MobileFilterSheet from "./MobileFilterSheet";
import ShopEmptyState from "./ShopEmptyState";

const CATEGORY_ICON_MAP: Record<string, string> = {
  "spiritual-idols": "🕉️",
  "articulated-toys": "🦎",
  "custom-keychains": "🔑",
  "desk-organizers": "📂",
  "lithophane-lamps": "💡",
  "home-decor": "🏺",
  "miniatures-decor": "✨",
};

export interface PaginationInfo {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

interface ShopPageClientProps {
  initialProducts?: any[];
  initialCategories?: any[];
  initialPagination?: PaginationInfo;
}

export default function ShopPageClient({
  initialProducts,
  initialCategories,
  initialPagination,
}: ShopPageClientProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // ─── State from URL params ──────────────────────────────────────────────
  const urlCategory = searchParams.get("cat") || searchParams.get("category") || "all";
  const urlSort = (searchParams.get("sort") as SortOption) || "featured";
  const urlQuery = searchParams.get("q") || searchParams.get("search") || "";
  const urlPage = parseInt(searchParams.get("page") || "1", 10) || 1;

  // ─── Catalog State ──────────────────────────────────────────────────────
  const [allProducts, setAllProducts] = useState<any[]>(initialProducts || []);
  const [categories, setCategories] = useState<any[]>(initialCategories || []);
  const [pagination, setPagination] = useState<PaginationInfo>(
    initialPagination || {
      page: urlPage,
      pageSize: 24,
      totalCount: initialProducts?.length || 0,
      totalPages: Math.ceil((initialProducts?.length || 0) / 24) || 1,
      hasNextPage: false,
      hasPrevPage: false,
    }
  );
  const [isLoading, setIsLoading] = useState(!initialProducts || initialProducts.length === 0);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const isFirstMount = useRef(true);

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
        console.error("[Shop Client Categories Fetch Error]", err);
      }
    }

    loadCategories();
    return () => {
      isMounted = false;
    };
  }, [initialCategories]);

  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      if (initialProducts && initialProducts.length > 0) {
        return;
      }
    }

    let isMounted = true;
    async function loadProducts() {
      setIsLoading(true);
      setFetchError(null);
      try {
        const params = new URLSearchParams();
        params.set("page", String(urlPage));
        params.set("pageSize", "24");
        if (urlCategory && urlCategory !== "all") {
          params.set("cat", urlCategory);
        }
        if (urlQuery.trim()) {
          params.set("q", urlQuery.trim());
        }
        if (urlSort && urlSort !== "featured") {
          params.set("sort", urlSort);
        }

        const res = await fetch(`/api/products?${params.toString()}`);
        if (!res.ok) {
          throw new Error("Failed to load products");
        }
        const data = await res.json();
        if (isMounted) {
          if (data.ok && Array.isArray(data.products)) {
            setAllProducts(data.products);
            if (data.pagination) {
              setPagination(data.pagination);
            }
          } else {
            setAllProducts([]);
          }
        }
      } catch (err: unknown) {
        if (isMounted) {
          console.error("[Shop Client Fetch Error]", err);
          setFetchError("Unable to load products right now. Please try refreshing.");
          setAllProducts([]);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadProducts();
    return () => {
      isMounted = false;
    };
  }, [urlCategory, urlSort, urlQuery, urlPage, initialProducts]);

  const [activeCategory, setActiveCategory] = useState(urlCategory);
  const [sortBy, setSortBy] = useState<SortOption>(urlSort);
  const [searchQuery, setSearchQuery] = useState(urlQuery);
  const [showInStock, setShowInStock] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);

  // Sync state from URL on param change
  useEffect(() => {
    setActiveCategory(urlCategory);
  }, [urlCategory]);

  useEffect(() => {
    if (urlSort) setSortBy(urlSort);
  }, [urlSort]);

  useEffect(() => {
    setSearchQuery(urlQuery);
  }, [urlQuery]);

  // ─── URL Update Helper ──────────────────────────────────────────────────
  const updateURL = useCallback(
    (params: Record<string, string | null>) => {
      const newParams = new URLSearchParams(searchParams.toString());
      Object.entries(params).forEach(([key, value]) => {
        if (
          value === null ||
          value === "" ||
          value === "all" ||
          value === "featured" ||
          (key === "page" && (value === "1" || value === null))
        ) {
          newParams.delete(key);
        } else {
          newParams.set(key, value);
        }
      });
      // Delete legacy "category" query if canonical "cat" is set
      if (params.cat !== undefined && newParams.has("category")) {
        newParams.delete("category");
      }
      // Delete legacy "search" query if canonical "q" is set
      if (params.q !== undefined && newParams.has("search")) {
        newParams.delete("search");
      }
      const qs = newParams.toString();
      router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
    },
    [searchParams, router, pathname]
  );

  // ─── Handlers ───────────────────────────────────────────────────────────
  const handleCategoryChange = useCallback(
    (slug: string) => {
      setActiveCategory(slug);
      updateURL({ cat: slug === "all" ? null : slug, page: null });
    },
    [updateURL]
  );

  const handleClearSearch = useCallback(() => {
    setSearchQuery("");
    updateURL({ q: null, page: null });
  }, [updateURL]);

  const handleSortChange = useCallback(
    (sort: SortOption) => {
      setSortBy(sort);
      updateURL({ sort: sort === "featured" ? null : sort, page: null });
    },
    [updateURL]
  );

  const handlePageChange = useCallback(
    (newPage: number) => {
      if (newPage < 1 || (pagination.totalPages > 0 && newPage > pagination.totalPages)) return;
      updateURL({ page: newPage === 1 ? null : String(newPage) });
      if (typeof window !== "undefined") {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    },
    [pagination.totalPages, updateURL]
  );

  const handleStockToggle = useCallback(() => {
    setShowInStock((prev) => !prev);
  }, []);

  const handleClearFilters = useCallback(() => {
    setActiveCategory("all");
    setSortBy("featured");
    setShowInStock(false);
    setSearchQuery("");
    router.replace(pathname, { scroll: false });
  }, [router, pathname]);

  // ─── Category label for breadcrumb ──────────────────────────────────────
  const activeCategoryLabel = useMemo(() => {
    if (activeCategory === "all") return "All Products";
    const found = categories.find((c) => c.slug === activeCategory);
    return found?.name || activeCategory;
  }, [activeCategory, categories]);

  // ─── Filter + Sort ──────────────────────────────────────────────────────
  const filteredProducts = useMemo(() => {
    // Inactive products must NOT appear in the customer storefront
    let results: any[] = allProducts.filter((p) => p.isActive !== false);

    // Search query filter (case-insensitive across name, description, category, slug)
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      results = results.filter((p) => {
        const nameMatch = p.name?.toLowerCase().includes(q);
        const descMatch = p.description?.toLowerCase().includes(q);
        const catName =
          typeof p.category === "object" && p.category !== null
            ? p.category.name
            : p.category || "";
        const catMatch = catName.toLowerCase().includes(q);
        const slugMatch = p.slug?.toLowerCase().includes(q);
        return nameMatch || descMatch || catMatch || slugMatch;
      });
    }

    // Category filter
    if (activeCategory !== "all") {
      results = results.filter((p) => {
        const catSlug =
          typeof p.category === "object" && p.category !== null
            ? p.category.slug
            : p.categorySlug;
        return catSlug === activeCategory;
      });
    }

    // Stock filter
    if (showInStock) {
      results = results.filter((p) => p.isActive !== false && (p.stockQuantity ?? 0) > 0);
    }

    // Sort
    switch (sortBy) {
      case "price-low":
        results.sort((a, b) => Number(a.price) - Number(b.price));
        break;
      case "price-high":
        results.sort((a, b) => Number(b.price) - Number(a.price));
        break;
      case "name-az":
        results.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
        break;
      case "newest":
        results.sort((a, b) => {
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return dateB - dateA;
        });
        break;
      case "featured":
      default:
        // Featured first, then rest
        results.sort((a, b) => {
          const featA = Boolean(a.isFeatured);
          const featB = Boolean(b.isFeatured);
          if (featA !== featB) return featA ? -1 : 1;
          return 0;
        });
        break;
    }

    return results;
  }, [allProducts, searchQuery, activeCategory, showInStock, sortBy]);

  const hasActiveFilters =
    activeCategory !== "all" || showInStock || sortBy !== "featured" || Boolean(searchQuery.trim());

  // ─── Active filter chips (mobile) ───────────────────────────────────────
  const activeFilterChips = useMemo(() => {
    const chips: { label: string; onRemove: () => void }[] = [];
    if (searchQuery.trim()) {
      chips.push({
        label: `Search: "${searchQuery}"`,
        onRemove: handleClearSearch,
      });
    }
    if (activeCategory !== "all") {
      chips.push({
        label: activeCategoryLabel,
        onRemove: () => handleCategoryChange("all"),
      });
    }
    if (showInStock) {
      chips.push({
        label: "In stock",
        onRemove: () => setShowInStock(false),
      });
    }
    return chips;
  }, [
    searchQuery,
    handleClearSearch,
    activeCategory,
    activeCategoryLabel,
    handleCategoryChange,
    showInStock,
  ]);

  if (isLoading && allProducts.length === 0) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: "var(--color-canvas)" }}
      >
        <div className="flex flex-col items-center gap-3">
          <div
            className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
            style={{ borderColor: "var(--color-primary)", borderTopColor: "transparent" }}
          />
          <span
            className="text-sm font-medium"
            style={{ color: "var(--color-neutral-500)" }}
          >
            Loading shop…
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--color-canvas)" }}>
      {/* ─── Page Header / Breadcrumb ─────────────────────────────── */}
      <div
        className="border-b"
        style={{
          borderColor: "var(--color-neutral-100)",
          background: "var(--color-surface)",
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-6">
          {/* Breadcrumb */}
          <nav
            className="flex flex-wrap items-center gap-1.5 text-xs sm:text-sm mb-2"
            aria-label="Breadcrumb"
          >
            <Link
              href="/"
              className="inline-flex items-center py-2 px-1 -my-2 -mx-0.5 rounded-sm font-medium transition-colors hover:underline focus-visible:outline-2 focus-visible:outline-primary"
              style={{ color: "var(--color-neutral-500)" }}
            >
              Home
            </Link>
            <span style={{ color: "var(--color-neutral-300)" }}>
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m9 18 6-6-6-6" />
              </svg>
            </span>
            <Link
              href="/shop"
              className={`inline-flex items-center py-2 px-1 -my-2 -mx-0.5 rounded-sm font-medium transition-colors hover:underline focus-visible:outline-2 focus-visible:outline-primary ${
                activeCategory !== "all" || searchQuery.trim() ? "" : "pointer-events-none"
              }`}
              style={{
                color:
                  activeCategory !== "all" || searchQuery.trim()
                    ? "var(--color-neutral-500)"
                    : "var(--color-neutral-900)",
              }}
            >
              Shop
            </Link>
            {activeCategory !== "all" && (
              <>
                <span style={{ color: "var(--color-neutral-300)" }}>
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="m9 18 6-6-6-6" />
                  </svg>
                </span>
                <Link
                  href={`/shop?cat=${activeCategory}`}
                  className={`font-semibold hover:underline ${
                    searchQuery.trim() ? "text-neutral-500" : "text-neutral-900"
                  }`}
                >
                  {activeCategoryLabel}
                </Link>
              </>
            )}
            {searchQuery.trim() && (
              <>
                <span style={{ color: "var(--color-neutral-300)" }}>
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="m9 18 6-6-6-6" />
                  </svg>
                </span>
                <span className="font-semibold text-neutral-900">
                  Search: &ldquo;{searchQuery}&rdquo;
                </span>
              </>
            )}
          </nav>

          {/* Title */}
          {searchQuery.trim() ? (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-neutral-900">
                  Search results for: &ldquo;{searchQuery}&rdquo;
                </h1>
                <p className="text-sm mt-1 text-neutral-500">
                  Showing {filteredProducts.length} 3D printed {filteredProducts.length === 1 ? "creation" : "creations"}
                  {activeCategory !== "all" ? ` in ${activeCategoryLabel}` : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={handleClearSearch}
                className="self-start sm:self-auto inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-neutral-100 hover:bg-neutral-200 text-neutral-800 transition-colors focus-visible:outline-2 focus-visible:outline-primary border border-neutral-300"
              >
                <span>Clear search</span>
                <span aria-hidden="true">&times;</span>
              </button>
            </div>
          ) : (
            <>
              <h1
                className="text-2xl sm:text-3xl font-bold"
                style={{ color: "var(--color-neutral-900)" }}
              >
                {activeCategoryLabel}
              </h1>
              {activeCategory !== "all" && (
                <p
                  className="text-sm mt-1 max-w-lg"
                  style={{ color: "var(--color-neutral-500)" }}
                >
                  {categories.find((c) => c.slug === activeCategory)
                    ?.description || "Browse our 3D printed creations"}
                </p>
              )}
            </>
          )}
        </div>
      </div>

      {/* ─── Mobile Category Chips + Filter Button ────────────── */}
      <div className="lg:hidden">
        <div
          className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-2 overflow-x-auto scrollbar-hide"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          {/* Filter Button */}
          <button
            type="button"
            onClick={() => setMobileFilterOpen(true)}
            className="shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold transition-colors border"
            style={{
              borderColor: "var(--color-neutral-300)",
              background: "var(--color-surface)",
              color: "var(--color-neutral-700)",
            }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
            </svg>
            Filters
            {activeFilterChips.length > 0 && (
              <span
                className="w-4.5 h-4.5 rounded-full text-[10px] font-bold flex items-center justify-center"
                style={{
                  background: "var(--color-primary)",
                  color: "var(--color-neutral-900)",
                  minWidth: "18px",
                  height: "18px",
                }}
              >
                {activeFilterChips.length}
              </span>
            )}
          </button>

          {/* Horizontal category chips */}
          <button
            type="button"
            onClick={() => handleCategoryChange("all")}
            className={`shrink-0 px-3.5 py-2 rounded-full text-xs font-semibold transition-all border ${
              activeCategory === "all" ? "border-transparent" : ""
            }`}
            style={{
              background:
                activeCategory === "all"
                  ? "var(--color-primary)"
                  : "var(--color-surface)",
              color: "var(--color-neutral-900)",
              borderColor:
                activeCategory === "all"
                  ? "transparent"
                  : "var(--color-neutral-300)",
            }}
          >
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => handleCategoryChange(cat.slug)}
              className={`shrink-0 px-3.5 py-2 rounded-full text-xs font-semibold transition-all border whitespace-nowrap ${
                activeCategory === cat.slug ? "border-transparent" : ""
              }`}
              style={{
                background:
                  activeCategory === cat.slug
                    ? "var(--color-primary)"
                    : "var(--color-surface)",
                color: "var(--color-neutral-900)",
                borderColor:
                  activeCategory === cat.slug
                    ? "transparent"
                    : "var(--color-neutral-300)",
              }}
            >
              {cat.icon || CATEGORY_ICON_MAP[cat.slug] || "✨"} {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* ─── Main Content ─────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
        <div className="flex gap-8">
          {/* Desktop Sidebar */}
          <ShopSidebar
            activeCategory={activeCategory}
            onCategoryChange={handleCategoryChange}
            showInStock={showInStock}
            onStockToggle={handleStockToggle}
            products={allProducts}
            categories={categories}
          />

          {/* Product Grid Area */}
          <div className="flex-1 min-w-0">
            {fetchError && (
              <div
                className="rounded-2xl p-4 text-center text-sm font-medium mb-4"
                style={{
                  background: "#FFF5F5",
                  color: "#C53030",
                  border: "1px solid #FEB2B2",
                }}
              >
                {fetchError}
              </div>
            )}

            {/* Toolbar */}
            <ShopToolbar
              totalResults={pagination.totalCount || filteredProducts.length}
              sortBy={sortBy}
              onSortChange={handleSortChange}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
            />

            {/* Products */}
            {filteredProducts.length === 0 ? (
              <ShopEmptyState
                hasActiveFilters={hasActiveFilters}
                searchQuery={searchQuery}
                onClearFilters={handleClearFilters}
                onClearSearch={handleClearSearch}
              />
            ) : viewMode === "grid" ? (
              /* ─── Grid View ───────────────────────────────── */
              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 lg:gap-5">
                {filteredProducts.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            ) : (
              /* ─── List View ───────────────────────────────── */
              <div className="space-y-3">
                {filteredProducts.map((product) => (
                  <ListProductCard key={product.id} product={product} />
                ))}
              </div>
            )}

            {/* ─── Pagination Controls ─────────────────────── */}
            {pagination.totalPages > 1 && (
              <nav
                aria-label="Shop catalog pagination"
                className="mt-8 pt-6 border-t border-neutral-200 flex flex-col sm:flex-row items-center justify-between gap-4"
              >
                <p className="text-xs text-neutral-500 font-medium">
                  Showing page <span className="font-bold text-neutral-800">{pagination.page}</span> of{" "}
                  <span className="font-bold text-neutral-800">{pagination.totalPages}</span> ({pagination.totalCount} products)
                </p>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handlePageChange(pagination.page - 1)}
                    disabled={!pagination.hasPrevPage || pagination.page <= 1}
                    className="px-3.5 py-2 rounded-xl border border-neutral-200 bg-surface text-xs font-semibold text-neutral-700 hover:bg-neutral-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer shadow-2xs"
                  >
                    ← Previous
                  </button>

                  <div className="flex items-center gap-1">
                    {Array.from({ length: pagination.totalPages }, (_, i) => i + 1)
                      .filter((p) => Math.abs(p - pagination.page) <= 2 || p === 1 || p === pagination.totalPages)
                      .map((p, idx, arr) => {
                        const showEllipsis = idx > 0 && p - arr[idx - 1] > 1;
                        return (
                          <React.Fragment key={p}>
                            {showEllipsis && <span className="px-1 text-xs text-neutral-400">…</span>}
                            <button
                              type="button"
                              onClick={() => handlePageChange(p)}
                              className={`w-8 h-8 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                pagination.page === p
                                  ? "bg-primary text-neutral-900 shadow-2xs"
                                  : "bg-surface border border-neutral-200 text-neutral-700 hover:bg-neutral-50"
                              }`}
                            >
                              {p}
                            </button>
                          </React.Fragment>
                        );
                      })}
                  </div>

                  <button
                    type="button"
                    onClick={() => handlePageChange(pagination.page + 1)}
                    disabled={!pagination.hasNextPage || pagination.page >= pagination.totalPages}
                    className="px-3.5 py-2 rounded-xl border border-neutral-200 bg-surface text-xs font-semibold text-neutral-700 hover:bg-neutral-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer shadow-2xs"
                  >
                    Next →
                  </button>
                </div>
              </nav>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Filter Sheet */}
      <MobileFilterSheet
        isOpen={mobileFilterOpen}
        onClose={() => setMobileFilterOpen(false)}
        activeCategory={activeCategory}
        onCategoryChange={handleCategoryChange}
        showInStock={showInStock}
        onStockToggle={handleStockToggle}
        products={allProducts}
        categories={categories}
      />
    </div>
  );
}

// ─── List View Product Card ──────────────────────────────────────────────────

function ListProductCard({ product }: { product: any }) {
  const { addItem } = useCart();
  const [isAdded, setIsAdded] = useState(false);

  const rawFirstImage =
    product.images && product.images.length > 0 ? product.images[0] : null;
  const rawImage =
    (typeof rawFirstImage === "string"
      ? rawFirstImage
      : rawFirstImage?.url || rawFirstImage?.storagePath) ||
    product.image ||
    "/product-samples/1.jpeg";
  const displayImage =
    rawImage.startsWith("http") || rawImage.startsWith("/")
      ? rawImage
      : `/${rawImage}`;

  const categoryName =
    typeof product.category === "object" && product.category !== null
      ? product.category.name
      : product.category || "3D Printing";

  const isOutOfStock =
    product.isActive === false || (product.stockQuantity ?? 10) <= 0;

  const compareAt =
    product.compareAtPrice !== null && product.compareAtPrice !== undefined
      ? Number(product.compareAtPrice)
      : null;
  const currentPrice = Number(product.price);

  const hasDiscount = compareAt !== null && compareAt > currentPrice;
  const discountPercent = hasDiscount
    ? Math.round(((compareAt - currentPrice) / compareAt) * 100)
    : null;

  return (
    <article
      className="group flex rounded-2xl overflow-hidden transition-all duration-200 hover:shadow-lg"
      style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-neutral-100)",
        boxShadow: "var(--shadow-card)",
      }}
    >
      {/* Image */}
      <div className="relative w-32 sm:w-44 shrink-0 bg-[#f4f7f2]">
        <Image
          src={displayImage}
          alt={product.name}
          fill
          sizes="(max-width: 640px) 128px, 176px"
          className={`object-cover transition-transform duration-300 group-hover:scale-105 ${
            isOutOfStock ? "opacity-75 grayscale-30" : ""
          }`}
        />
        {/* Badges */}
        <div className="absolute top-2 left-2 flex flex-col gap-1 z-10">
          {isOutOfStock ? (
            <span
              className="inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider shadow-sm"
              style={{ background: "#E53E3E", color: "#FFFFFF" }}
            >
              Out of Stock
            </span>
          ) : (
            hasDiscount && (
              <span
                className="inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider shadow-sm"
                style={{
                  background: "var(--color-secondary)",
                  color: "var(--color-neutral-900)",
                }}
              >
                {discountPercent}% Off
              </span>
            )
          )}
        </div>
      </div>

      {/* Info */}
      <div className="flex flex-col flex-1 p-3.5 sm:p-4 min-w-0">
        <span
          className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider mb-1"
          style={{ color: "var(--color-neutral-500)" }}
        >
          {categoryName}
        </span>
        <Link
          href={`/product/${product.slug}`}
          className="text-sm sm:text-[15px] font-bold leading-snug hover:underline line-clamp-2 mb-1"
          style={{ color: "var(--color-neutral-900)" }}
        >
          {product.name}
        </Link>
        <p
          className="text-xs leading-relaxed line-clamp-2 mb-auto hidden sm:block"
          style={{ color: "var(--color-neutral-500)" }}
        >
          {product.description}
        </p>

        <div className="flex items-center justify-between gap-3 mt-3">
          {/* Price */}
          <div className="flex items-baseline gap-2">
            <span
              className="text-base sm:text-lg font-bold"
              style={{ color: "var(--color-neutral-900)" }}
            >
              ₹{currentPrice.toLocaleString("en-IN")}
            </span>
            {hasDiscount && (
              <span
                className="text-xs line-through"
                style={{ color: "var(--color-neutral-500)" }}
              >
                ₹{compareAt!.toLocaleString("en-IN")}
              </span>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-110 shadow-sm"
              style={{
                background: "rgba(255,255,255,0.92)",
                border: "1px solid var(--color-neutral-100)",
              }}
              aria-label={`Add ${product.name} to wishlist`}
            >
              <HeartIcon
                size={14}
                style={{ color: "var(--color-neutral-500)" }}
              />
            </button>
            <button
              type="button"
              disabled={isOutOfStock}
              onClick={() => {
                if (isOutOfStock) return;
                addItem(
                  {
                    ...product,
                    price: currentPrice,
                    compareAtPrice: compareAt,
                    image: displayImage,
                    category: categoryName,
                    stockQuantity: product.stockQuantity ?? 10,
                    isActive: !isOutOfStock,
                  } as any,
                  1
                );
                setIsAdded(true);
                setTimeout(() => setIsAdded(false), 2000);
              }}
              className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
                isOutOfStock
                  ? "cursor-not-allowed opacity-60"
                  : isAdded
                  ? "text-white"
                  : "btn-primary hover:opacity-95"
              }`}
              style={
                isOutOfStock
                  ? {
                      background: "var(--color-neutral-200)",
                      color: "var(--color-neutral-600)",
                      border: "1px solid var(--color-neutral-300)",
                    }
                  : isAdded
                  ? {
                      background: "var(--color-success)",
                      color: "#FFFFFF",
                    }
                  : {}
              }
            >
              {isAdded ? "Added!" : isOutOfStock ? "Out of Stock" : "Add to Cart"}
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
