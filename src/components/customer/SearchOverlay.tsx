"use client";

import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { SearchInput } from "./search/SearchInput";
import { SearchSuggestions } from "./search/SearchSuggestions";
import { TrendingSearchProducts } from "./search/TrendingSearchProducts";
import { CloseIcon } from "./Icons";
import {
  POPULAR_SEARCHES,
  SEARCH_CATEGORIES,
  TRENDING_PRODUCTS,
  RECENT_SEARCHES,
} from "./search/search-mock-data";

interface SearchOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  initialQuery?: string;
}

export function SearchOverlay({
  isOpen,
  onClose,
  initialQuery = "",
}: SearchOverlayProps) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [trendingProducts, setTrendingProducts] = useState(TRENDING_PRODUCTS);
  const [popularCategories, setPopularCategories] = useState(SEARCH_CATEGORIES.slice(0, 3));
  const containerRef = useRef<HTMLDivElement>(null);

  // Load real trending products from MySQL orders & catalog data
  useEffect(() => {
    let isMounted = true;
    async function loadTrending() {
      try {
        const res = await fetch("/api/products?trending=true&limit=4");
        if (!res.ok) return;
        const data = await res.json();
        if (isMounted && data.ok && Array.isArray(data.products) && data.products.length > 0) {
          const seen = new Set<string>();
          const distinct: any[] = [];
          for (const p of data.products) {
            if (p && p.id && !seen.has(p.id)) {
              seen.add(p.id);
              distinct.push(p);
            }
          }
          const mapped = distinct.slice(0, 4).map((p: any) => ({
            id: p.id,
            title: p.name,
            ctaText: "view creation →",
            category: p.category?.name || "3D Printing",
            href: `/product/${p.slug}`,
            image: p.images?.[0]?.url || "/product-samples/1.jpeg",
            price: Number(p.price),
          }));
          setTrendingProducts(mapped);
        }
      } catch {
        // Fall back to baseline trending products
      }
    }
    loadTrending();

    return () => {
      isMounted = false;
    };
  }, []);

  // Load popular categories from metrics / catalog (at most 3)
  useEffect(() => {
    let isMounted = true;
    async function loadCategories() {
      try {
        const res = await fetch("/api/categories?popular=true&limit=3");
        if (!res.ok) return;
        const data = await res.json();
        if (isMounted && data.ok && Array.isArray(data.categories) && data.categories.length > 0) {
          const mapped = data.categories.slice(0, 3).map((c: any) => ({
            id: c.id,
            name: c.name,
            slug: c.slug,
            count: Number(c.productCount ?? c.viewCount ?? 0),
          }));
          setPopularCategories(mapped);
        }
      } catch {
        // Fall back to baseline popular categories
      }
    }
    loadCategories();

    return () => {
      isMounted = false;
    };
  }, []);

  // Sync initial query if passed
  useEffect(() => {
    if (isOpen) {
      setQuery(initialQuery);
    }
  }, [isOpen, initialQuery]);

  // Lock body scroll and handle Escape key
  useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSearchSubmit = (searchQuery: string) => {
    const clean = searchQuery.trim();
    if (!clean) return;
    onClose();

    if (typeof window !== "undefined") {
      const currentUrl = new URL(window.location.href);
      if (currentUrl.pathname === "/shop") {
        const cat = currentUrl.searchParams.get("cat") || currentUrl.searchParams.get("category");
        if (cat && cat !== "all") {
          router.push(`/shop?cat=${encodeURIComponent(cat)}&q=${encodeURIComponent(clean)}`);
          return;
        }
      }
    }

    router.push(`/shop?q=${encodeURIComponent(clean)}`);
  };

  const handleSelectQuery = (selected: string) => {
    setQuery(selected);
    handleSearchSubmit(selected);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Search Dearr"
      className="fixed inset-0 z-50 overflow-y-auto bg-neutral-900/50 backdrop-blur-xs flex items-start justify-center p-0 md:p-6 lg:p-10 animate-in fade-in duration-200"
    >
      {/* Backdrop click listener */}
      <div
        className="fixed inset-0 -z-10"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Main Overlay Surface Card */}
      <div
        ref={containerRef}
        className="w-full max-w-4xl bg-canvas min-h-screen md:min-h-0 md:max-h-[88vh] md:rounded-2xl border-0 md:border md:border-neutral-300 shadow-modal overflow-y-auto flex flex-col"
      >
        {/* ==================================================================
            Header Bar: Mobile Top Bar vs Desktop Header Bar
            ================================================================== */}
        {/* Mobile Header (Matching search-mobile.png) */}
        <div className="md:hidden flex items-center justify-between px-4 py-3 border-b border-neutral-200 bg-surface sticky top-0 z-10">
          <button
            type="button"
            onClick={onClose}
            aria-label="Back to previous page"
            className="p-2 -ml-2 text-neutral-800 hover:text-neutral-900 rounded-full active:scale-95 transition-colors focus-visible:outline-2 focus-visible:outline-primary"
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>

          <div className="flex items-center">
            <Image
              src="/brand/dearr-logo.png"
              alt="Dearr Logo"
              width={100}
              height={28}
              priority
              className="h-6 w-auto object-contain"
              style={{ width: "auto" }}
            />
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close search"
            className="p-2 -mr-2 text-neutral-800 hover:text-neutral-900 rounded-full active:scale-95 transition-colors focus-visible:outline-2 focus-visible:outline-primary"
          >
            <CloseIcon size={20} />
          </button>
        </div>

        {/* Desktop Header Dismiss Bar */}
        <div className="hidden md:flex items-center justify-between px-6 pt-5 pb-2">
          <div className="flex items-center gap-2">
            <Image
              src="/brand/dearr-logo.png"
              alt="Dearr Logo"
              width={110}
              height={32}
              priority
              className="h-7 w-auto object-contain"
              style={{ width: "auto" }}
            />
            <span className="text-xs font-semibold text-neutral-400 uppercase tracking-widest ml-2">
              Search Catalog
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close search overlay"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 transition-colors focus-visible:outline-2 focus-visible:outline-primary"
          >
            <span>Close</span>
            <span className="text-xs bg-neutral-200 px-1.5 py-0.5 rounded text-neutral-600 font-mono text-[10px]">
              ESC
            </span>
            <CloseIcon size={16} />
          </button>
        </div>

        {/* ==================================================================
            Body Content Area (Input, Suggestions, Trending)
            ================================================================== */}
        <div className="p-4 md:p-6 lg:p-8 space-y-6 md:space-y-8 flex-1">
          {/* Prominent Search Input Box */}
          <div className="w-full">
            <SearchInput
              value={query}
              onChange={setQuery}
              onClear={() => setQuery("")}
              onSubmit={handleSearchSubmit}
              autoFocus
            />
          </div>

          {/* Popular Searches & Browse Categories */}
          <SearchSuggestions
            onSelectQuery={handleSelectQuery}
            onSelectCategory={onClose}
            popularSearches={POPULAR_SEARCHES}
            categories={popularCategories}
            recentSearches={RECENT_SEARCHES}
          />

          {/* Trending Products Grid (Dynamic & Top Selling) */}
          <TrendingSearchProducts
            products={trendingProducts}
            onSelectProduct={onClose}
          />
        </div>
      </div>
    </div>
  );
}
