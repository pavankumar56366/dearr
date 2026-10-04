"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { SAMPLE_PRODUCTS, type SampleProduct } from "@/data/sample-products";
import { getAllAdminProducts } from "@/lib/admin-catalog";
import { getAllAdminCategories } from "@/lib/admin-categories";
import {
  PackageIcon,
  SearchIcon,
  XIcon,
  PlusIcon,
  MoreVerticalIcon,
  ExternalLinkIcon,
  EditIcon,
  CopyIcon,
  PowerIcon,
  CheckCircleIcon,
  ShieldCheckIcon,
} from "./AdminIcons";
import { AdminProductsSkeleton } from "./AdminProductsSkeleton";

/**
 * AdminProductsList — Main operational catalog management interface for Dearr V1.
 *
 * Implements:
 * - 4 Summary metric cards derived dynamically from local sample product data
 * - Instant case-insensitive search across product name, slug, and category
 * - Composable multi-dimensional filtering (Category + Status + Stock)
 * - Professional desktop data table with product thumbnails, formatted pricing, stock badges
 * - Responsive tablet column pruning and mobile touch-friendly card transformation
 * - Action dropdowns (View, Edit preview, Duplicate demo, Deactivate/Activate toggle)
 * - Safe Add Product preview modal (Task A-07 bridge)
 * - Reusable loading skeleton preview toggle
 * - No products found / empty states
 */
export function AdminProductsList() {
  const searchParams = useSearchParams();
  const urlCategory = searchParams.get("category") || searchParams.get("cat");

  const [products, setProducts] = useState<SampleProduct[]>(SAMPLE_PRODUCTS);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [selectedStatus, setSelectedStatus] = useState("ALL");
  const [selectedStock, setSelectedStock] = useState("ALL");
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showSkeletonDemo, setShowSkeletonDemo] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const dropdownRef = useRef<HTMLDivElement | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  // Close dropdowns on outside click or ESC key
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpenDropdownId(null);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpenDropdownId(null);
        setShowAddModal(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  // Sync products on mount with any demo-created or edited products in session
  useEffect(() => {
    setProducts(getAllAdminProducts());
  }, []);

  // Unique categories derived dynamically from catalog and products
  const categories = useMemo(() => {
    const fromProducts = products.map((p) => p.category);
    const fromAdminCats = getAllAdminCategories().map((c) => c.name);
    return Array.from(new Set([...fromProducts, ...fromAdminCats])).sort();
  }, [products]);

  // Sync category filter if URL query param was provided (e.g. from "View Products")
  useEffect(() => {
    if (urlCategory) {
      const match = categories.find(
        (c) =>
          c.toLowerCase() === urlCategory.toLowerCase() ||
          c.toLowerCase().replace(/[^\w\s-]/g, "").replace(/[\s_-]+/g, "-") === urlCategory.toLowerCase()
      );
      if (match) {
        setSelectedCategory(match);
      }
    }
  }, [urlCategory, categories]);

  // Summary Metrics calculated directly from current local dataset
  const metrics = useMemo(() => {
    const total = products.length;
    const active = products.filter((p) => p.isActive).length;
    const outOfStock = products.filter((p) => p.stockQuantity <= 0).length;
    const lowStock = products.filter((p) => p.stockQuantity > 0 && p.stockQuantity <= 5).length;
    return { total, active, outOfStock, lowStock };
  }, [products]);

  // Combined Search & Filter Logic
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      // 1. Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = p.name.toLowerCase().includes(q);
        const matchesSlug = p.slug.toLowerCase().includes(q);
        const matchesCategory = p.category.toLowerCase().includes(q);
        if (!matchesName && !matchesSlug && !matchesCategory) return false;
      }

      // 2. Category filter
      if (selectedCategory !== "ALL" && p.category !== selectedCategory) {
        return false;
      }

      // 3. Status filter
      if (selectedStatus === "ACTIVE" && !p.isActive) return false;
      if (selectedStatus === "INACTIVE" && p.isActive) return false;

      // 4. Stock filter
      if (selectedStock === "IN_STOCK" && p.stockQuantity <= 5) return false;
      if (selectedStock === "LOW_STOCK" && (p.stockQuantity <= 0 || p.stockQuantity > 5)) return false;
      if (selectedStock === "OUT_OF_STOCK" && p.stockQuantity > 0) return false;

      return true;
    });
  }, [products, searchQuery, selectedCategory, selectedStatus, selectedStock]);

  const isFiltered =
    searchQuery.trim() !== "" ||
    selectedCategory !== "ALL" ||
    selectedStatus !== "ALL" ||
    selectedStock !== "ALL";

  const handleClearFilters = () => {
    setSearchQuery("");
    setSelectedCategory("ALL");
    setSelectedStatus("ALL");
    setSelectedStock("ALL");
  };

  // Demo Action Handlers
  const handleDuplicate = (product: SampleProduct) => {
    const duplicate: SampleProduct = {
      ...product,
      id: `sp-copy-${Date.now()}`,
      name: `${product.name} (Copy)`,
      slug: `${product.slug}-copy-${Math.floor(Math.random() * 1000)}`,
    };
    setProducts((prev) => [duplicate, ...prev]);
    setOpenDropdownId(null);
    showToast(`Duplicated "${product.name}" as demo catalog item.`);
  };

  const handleToggleStatus = (product: SampleProduct) => {
    const nextState = !product.isActive;
    setProducts((prev) =>
      prev.map((p) => (p.id === product.id ? { ...p, isActive: nextState } : p))
    );
    setOpenDropdownId(null);
    showToast(
      `"${product.name}" marked as ${nextState ? "Active" : "Inactive"} (Demo preview).`
    );
  };

  const handleEditClick = (product: SampleProduct) => {
    setOpenDropdownId(null);
    showToast(`Product editing for "${product.name}" will be connected in Task A-08.`);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto" ref={dropdownRef}>
      {/* Toast Notification */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-2.5 rounded-xl shadow-modal text-xs font-semibold animate-in fade-in slide-in-from-bottom-3 duration-200 bg-neutral-900 text-white border border-neutral-700"
        >
          <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ====================================================================
          1. PAGE HEADER & PRIMARY CTA
          ==================================================================== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-neutral-200/60">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-primary/20 text-neutral-900 border border-primary/40">
              Catalog Management
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-neutral-100 text-neutral-600 border border-neutral-200">
              V1 Catalog
            </span>
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-neutral-900">
            Products
          </h1>
          <p className="text-xs sm:text-sm text-neutral-500 mt-0.5">
            Manage your 3D printed catalog, pricing, and product availability.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Skeleton Preview Toggle for QA */}
          <button
            type="button"
            onClick={() => setShowSkeletonDemo(!showSkeletonDemo)}
            className="px-3 py-2 rounded-xl border border-neutral-300 hover:bg-neutral-100 text-xs font-semibold text-neutral-600 transition-all cursor-pointer"
            title="Toggle skeleton loading state representation"
          >
            {showSkeletonDemo ? "Show Live Table" : "Preview Skeleton"}
          </button>

          {/* Primary Add Product CTA */}
          <Link
            href="/admin/products/new"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm tracking-wide text-neutral-900 bg-primary hover:bg-[#91BC7A] active:scale-98 transition-all shadow-xs focus-visible:outline-2 focus-visible:outline-neutral-900 cursor-pointer"
          >
            <PlusIcon size={16} />
            <span>Add Product</span>
          </Link>
        </div>
      </div>

      {/* Show Loading Skeleton Preview if toggled */}
      {showSkeletonDemo ? (
        <AdminProductsSkeleton />
      ) : (
        <>
          {/* ====================================================================
              2. SUMMARY METRICS (4 CARDS)
              ==================================================================== */}
          <section
            aria-label="Product Summary Metrics"
            className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4"
          >
            <div className="p-4 rounded-2xl bg-surface border border-neutral-200/80 shadow-xs flex flex-col justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">
                Total Products
              </span>
              <div className="text-2xl sm:text-3xl font-extrabold text-neutral-900 tracking-tight mt-1">
                {metrics.total}
              </div>
              <span className="text-[11px] text-neutral-400 font-medium mt-1">
                All catalog items
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-surface border border-neutral-200/80 shadow-xs flex flex-col justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">
                Active Catalog
              </span>
              <div className="text-2xl sm:text-3xl font-extrabold text-emerald-700 tracking-tight mt-1">
                {metrics.active}
              </div>
              <span className="text-[11px] text-emerald-600 font-medium mt-1">
                Published to store
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-surface border border-neutral-200/80 shadow-xs flex flex-col justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">
                Low Stock
              </span>
              <div className="text-2xl sm:text-3xl font-extrabold text-amber-600 tracking-tight mt-1">
                {metrics.lowStock}
              </div>
              <span className="text-[11px] text-amber-600 font-medium mt-1">
                ≤ 5 units left
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-surface border border-neutral-200/80 shadow-xs flex flex-col justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">
                Out of Stock
              </span>
              <div className="text-2xl sm:text-3xl font-extrabold text-red-600 tracking-tight mt-1">
                {metrics.outOfStock}
              </div>
              <span className="text-[11px] text-red-500 font-medium mt-1">
                0 units available
              </span>
            </div>
          </section>

          {/* ====================================================================
              3. SEARCH & FILTER TOOLBAR
              ==================================================================== */}
          <section
            aria-label="Filter products"
            className="p-3.5 sm:p-4 rounded-2xl bg-surface border border-neutral-200/80 shadow-xs flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3"
          >
            {/* Search Input */}
            <div className="relative flex-1">
              <div
                className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-400"
                aria-hidden="true"
              >
                <SearchIcon size={17} />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search products by name, slug, or category..."
                aria-label="Search products"
                className="w-full h-11 pl-10 pr-9 rounded-xl border border-neutral-300 text-xs sm:text-sm text-neutral-900 placeholder:text-neutral-400 bg-surface focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  aria-label="Clear search text"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-neutral-400 hover:text-neutral-700"
                >
                  <XIcon size={15} />
                </button>
              )}
            </div>

            {/* Filter Dropdowns */}
            <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
              {/* Category Filter */}
              <div className="flex-1 sm:flex-none">
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  aria-label="Filter by category"
                  className="w-full sm:w-auto h-11 px-3 rounded-xl border border-neutral-300 bg-surface text-xs font-semibold text-neutral-700 focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer"
                >
                  <option value="ALL">All Categories</option>
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              {/* Status Filter */}
              <div className="flex-1 sm:flex-none">
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  aria-label="Filter by status"
                  className="w-full sm:w-auto h-11 px-3 rounded-xl border border-neutral-300 bg-surface text-xs font-semibold text-neutral-700 focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer"
                >
                  <option value="ALL">All Status</option>
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                </select>
              </div>

              {/* Stock Filter */}
              <div className="flex-1 sm:flex-none">
                <select
                  value={selectedStock}
                  onChange={(e) => setSelectedStock(e.target.value)}
                  aria-label="Filter by stock availability"
                  className="w-full sm:w-auto h-11 px-3 rounded-xl border border-neutral-300 bg-surface text-xs font-semibold text-neutral-700 focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer"
                >
                  <option value="ALL">All Stock</option>
                  <option value="IN_STOCK">In Stock (&gt; 5)</option>
                  <option value="LOW_STOCK">Low Stock (1-5)</option>
                  <option value="OUT_OF_STOCK">Out of Stock (0)</option>
                </select>
              </div>

              {/* Clear Filters Button (Visible when filters applied) */}
              {isFiltered && (
                <button
                  type="button"
                  onClick={handleClearFilters}
                  className="h-11 px-3 rounded-xl border border-neutral-200 bg-neutral-100 hover:bg-neutral-200 text-xs font-semibold text-neutral-700 transition-colors shrink-0"
                >
                  Reset
                </button>
              )}
            </div>
          </section>

          {/* Results Summary Bar */}
          <div className="flex items-center justify-between text-xs text-neutral-500 px-1">
            <span>
              Showing{" "}
              <strong className="text-neutral-900 font-bold">
                {filteredProducts.length}
              </strong>{" "}
              of {products.length} products
            </span>
            {isFiltered && (
              <span className="text-[11px] font-medium text-primary">
                Filtered View
              </span>
            )}
          </div>

          {/* ====================================================================
              4. EMPTY STATES
              ==================================================================== */}
          {products.length === 0 ? (
            /* No Products State */
            <div className="p-12 rounded-2xl bg-surface border border-neutral-200/80 text-center space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-neutral-100 text-neutral-400 mx-auto flex items-center justify-center">
                <PackageIcon size={28} />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-neutral-900">
                  No products yet
                </h3>
                <p className="text-xs text-neutral-500 max-w-sm mx-auto">
                  Your Dearr catalog is ready for its first 3D print.
                </p>
              </div>
              <Link
                href="/admin/products/new"
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-bold text-xs bg-primary text-neutral-900 hover:bg-[#91BC7A] transition-all cursor-pointer"
              >
                <PlusIcon size={14} />
                <span>Add Product</span>
              </Link>
            </div>
          ) : filteredProducts.length === 0 ? (
            /* No Search/Filter Results State */
            <div className="p-12 rounded-2xl bg-surface border border-neutral-200/80 text-center space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-700 mx-auto flex items-center justify-center">
                <SearchIcon size={26} />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-neutral-900">
                  No products found
                </h3>
                <p className="text-xs text-neutral-500 max-w-sm mx-auto">
                  Try a different search term or clear your active filters.
                </p>
              </div>
              <button
                type="button"
                onClick={handleClearFilters}
                className="px-4 py-2.5 rounded-xl font-bold text-xs border border-neutral-300 bg-surface hover:bg-neutral-50 text-neutral-800 transition-all cursor-pointer"
              >
                Clear Filters
              </button>
            </div>
          ) : (
            <>
              <h2 className="sr-only">Catalog Inventory List</h2>
              {/* ====================================================================
                  5. DESKTOP & TABLET DATA TABLE (>= 768px)
                  ==================================================================== */}
              <div className="hidden md:block rounded-2xl bg-surface border border-neutral-200/80 shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-neutral-200/80 bg-neutral-50/70 text-[11px] font-bold uppercase tracking-wider text-neutral-500">
                        <th className="py-3 px-4">Product</th>
                        <th className="py-3 px-3 hidden lg:table-cell">Category</th>
                        <th className="py-3 px-3">Price</th>
                        <th className="py-3 px-3">Stock Status</th>
                        <th className="py-3 px-3">Status</th>
                        <th className="py-3 px-3 hidden xl:table-cell">Catalog Ref</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100 text-neutral-700">
                      {filteredProducts.map((p) => {
                        const isOutOfStock = p.stockQuantity <= 0;
                        const isLowStock = p.stockQuantity > 0 && p.stockQuantity <= 5;
                        const hasDiscount =
                          p.compareAtPrice !== null && p.compareAtPrice > p.price;
                        const isDropdownOpen = openDropdownId === p.id;

                        return (
                          <tr
                            key={p.id}
                            className="hover:bg-neutral-50/70 transition-colors"
                          >
                            {/* Product Info */}
                            <td className="py-3.5 px-4">
                              <div className="flex items-center gap-3">
                                <div className="relative w-11 h-11 rounded-xl bg-neutral-100 border border-neutral-200/80 overflow-hidden shrink-0">
                                  <Image
                                    src={p.image}
                                    alt={p.name}
                                    fill
                                    sizes="44px"
                                    className="object-cover"
                                  />
                                </div>
                                <div className="min-w-0 max-w-xs sm:max-w-sm">
                                  <div className="font-bold text-neutral-900 truncate">
                                    {p.name}
                                  </div>
                                  <div className="text-[11px] text-neutral-400 font-mono truncate">
                                    {p.slug}
                                  </div>
                                </div>
                              </div>
                            </td>

                            {/* Category */}
                            <td className="py-3.5 px-3 hidden lg:table-cell">
                              <span className="inline-block px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-neutral-100 text-neutral-700 border border-neutral-200/60 truncate max-w-[140px]">
                                {p.category}
                              </span>
                            </td>

                            {/* Price */}
                            <td className="py-3.5 px-3">
                              <div className="flex flex-col">
                                <span className="font-bold text-neutral-900">
                                  ₹{p.price.toLocaleString("en-IN")}
                                </span>
                                {hasDiscount && (
                                  <span className="text-[10px] text-neutral-400 line-through">
                                    ₹{p.compareAtPrice?.toLocaleString("en-IN")}
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Stock Badge */}
                            <td className="py-3.5 px-3">
                              {isOutOfStock ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-red-50 text-red-700 border border-red-200">
                                  <span className="w-1.5 h-1.5 rounded-full bg-red-600" />
                                  <span>Out of Stock (0)</span>
                                </span>
                              ) : isLowStock ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                  <span>Low Stock ({p.stockQuantity})</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                                  <span>In Stock ({p.stockQuantity})</span>
                                </span>
                              )}
                            </td>

                            {/* Active Status */}
                            <td className="py-3.5 px-3">
                              {p.isActive ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                  Active
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-neutral-100 text-neutral-500 border border-neutral-200">
                                  <span className="w-1.5 h-1.5 rounded-full bg-neutral-400" />
                                  Inactive
                                </span>
                              )}
                            </td>

                            {/* Catalog Identifier / SKU */}
                            <td className="py-3.5 px-3 hidden xl:table-cell">
                              <span className="font-mono text-[11px] text-neutral-400">
                                {p.id.toUpperCase()}
                              </span>
                            </td>

                            {/* Action Menu */}
                            <td className="py-3.5 px-4 text-right relative">
                              <div className="inline-block text-left">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setOpenDropdownId(isDropdownOpen ? null : p.id);
                                  }}
                                  aria-label={`Actions for ${p.name}`}
                                  aria-expanded={isDropdownOpen}
                                  className="w-8 h-8 rounded-lg border border-neutral-200 hover:bg-neutral-100 flex items-center justify-center text-neutral-600 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                                >
                                  <MoreVerticalIcon size={16} />
                                </button>

                                {isDropdownOpen && (
                                  <div className="absolute right-4 mt-1 w-44 rounded-xl bg-surface border border-neutral-200 shadow-modal py-1 z-30 animate-in fade-in zoom-in-95 duration-100 text-xs">
                                    <Link
                                      href={`/product/${p.slug}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      onClick={() => setOpenDropdownId(null)}
                                      className="w-full flex items-center gap-2.5 px-3 py-2 text-neutral-700 hover:bg-neutral-100 transition-colors"
                                    >
                                      <ExternalLinkIcon size={14} className="text-neutral-400" />
                                      <span>View on Store</span>
                                    </Link>

                                    <Link
                                      href={`/admin/products/${p.slug}/edit`}
                                      onClick={() => setOpenDropdownId(null)}
                                      className="w-full flex items-center gap-2.5 px-3 py-2 text-neutral-700 hover:bg-neutral-100 transition-colors cursor-pointer text-left"
                                    >
                                      <EditIcon size={14} className="text-neutral-400" />
                                      <span>Edit Product</span>
                                    </Link>

                                    <button
                                      type="button"
                                      onClick={() => handleDuplicate(p)}
                                      className="w-full flex items-center gap-2.5 px-3 py-2 text-neutral-700 hover:bg-neutral-100 transition-colors cursor-pointer text-left"
                                    >
                                      <CopyIcon size={14} className="text-neutral-400" />
                                      <span>Duplicate</span>
                                    </button>

                                    <div className="border-t border-neutral-100 my-1" />

                                    <button
                                      type="button"
                                      onClick={() => handleToggleStatus(p)}
                                      className="w-full flex items-center gap-2.5 px-3 py-2 text-neutral-700 hover:bg-neutral-100 transition-colors cursor-pointer text-left"
                                    >
                                      <PowerIcon
                                        size={14}
                                        className={p.isActive ? "text-amber-500" : "text-emerald-500"}
                                      />
                                      <span>{p.isActive ? "Deactivate" : "Activate"}</span>
                                    </button>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* ====================================================================
                  6. MOBILE PRODUCT CARDS (< 768px)
                  ==================================================================== */}
              <div className="md:hidden space-y-3">
                {filteredProducts.map((p) => {
                  const isOutOfStock = p.stockQuantity <= 0;
                  const isLowStock = p.stockQuantity > 0 && p.stockQuantity <= 5;
                  const hasDiscount =
                    p.compareAtPrice !== null && p.compareAtPrice > p.price;
                  const isDropdownOpen = openDropdownId === p.id;

                  return (
                    <div
                      key={p.id}
                      className="p-4 rounded-2xl bg-surface border border-neutral-200/80 shadow-xs space-y-3 relative"
                    >
                      <div className="flex items-start gap-3">
                        {/* Thumbnail */}
                        <div className="relative w-16 h-16 rounded-xl bg-neutral-100 border border-neutral-200/80 overflow-hidden shrink-0">
                          <Image
                            src={p.image}
                            alt={p.name}
                            fill
                            sizes="64px"
                            className="object-cover"
                          />
                        </div>

                        {/* Title, Category & Slug */}
                        <div className="min-w-0 flex-1 pr-8">
                          <span className="inline-block text-[10px] font-bold text-neutral-500 uppercase tracking-wider mb-0.5">
                            {p.category}
                          </span>
                          <h3 className="font-bold text-sm text-neutral-900 leading-snug line-clamp-2">
                            {p.name}
                          </h3>
                          <div className="text-[11px] text-neutral-400 font-mono truncate mt-0.5">
                            {p.slug}
                          </div>
                        </div>

                        {/* Mobile 3-Dot Action Menu Button */}
                        <div className="absolute top-3 right-3">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenDropdownId(isDropdownOpen ? null : p.id);
                            }}
                            aria-label={`Actions for ${p.name}`}
                            aria-expanded={isDropdownOpen}
                            className="w-10 h-10 rounded-xl border border-neutral-200 hover:bg-neutral-100 flex items-center justify-center text-neutral-600 transition-colors"
                          >
                            <MoreVerticalIcon size={18} />
                          </button>

                          {isDropdownOpen && (
                            <div className="absolute right-0 mt-1 w-44 rounded-xl bg-surface border border-neutral-200 shadow-modal py-1 z-30 text-xs">
                              <Link
                                href={`/product/${p.slug}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={() => setOpenDropdownId(null)}
                                className="w-full flex items-center gap-2.5 px-3 py-2.5 text-neutral-700 hover:bg-neutral-100"
                              >
                                <ExternalLinkIcon size={14} className="text-neutral-400" />
                                <span>View on Store</span>
                              </Link>

                              <Link
                                href={`/admin/products/${p.slug}/edit`}
                                onClick={() => setOpenDropdownId(null)}
                                className="w-full flex items-center gap-2.5 px-3 py-2.5 text-neutral-700 hover:bg-neutral-100 text-left"
                              >
                                <EditIcon size={14} className="text-neutral-400" />
                                <span>Edit Product</span>
                              </Link>

                              <button
                                type="button"
                                onClick={() => handleDuplicate(p)}
                                className="w-full flex items-center gap-2.5 px-3 py-2.5 text-neutral-700 hover:bg-neutral-100 text-left"
                              >
                                <CopyIcon size={14} className="text-neutral-400" />
                                <span>Duplicate</span>
                              </button>

                              <div className="border-t border-neutral-100 my-1" />

                              <button
                                type="button"
                                onClick={() => handleToggleStatus(p)}
                                className="w-full flex items-center gap-2.5 px-3 py-2.5 text-neutral-700 hover:bg-neutral-100 text-left"
                              >
                                <PowerIcon
                                  size={14}
                                  className={p.isActive ? "text-amber-500" : "text-emerald-500"}
                                />
                                <span>{p.isActive ? "Deactivate" : "Activate"}</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Pricing and Badges Strip */}
                      <div className="flex items-center justify-between pt-2 border-t border-neutral-100">
                        <div className="flex items-baseline gap-1.5">
                          <span className="font-extrabold text-sm text-neutral-900">
                            ₹{p.price.toLocaleString("en-IN")}
                          </span>
                          {hasDiscount && (
                            <span className="text-[11px] text-neutral-400 line-through">
                              ₹{p.compareAtPrice?.toLocaleString("en-IN")}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          {/* Stock Badge */}
                          {isOutOfStock ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-700 border border-red-200">
                              Out of Stock
                            </span>
                          ) : isLowStock ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                              Low ({p.stockQuantity})
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                              In Stock ({p.stockQuantity})
                            </span>
                          )}

                          {/* Active Badge */}
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                              p.isActive
                                ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                                : "bg-neutral-100 text-neutral-500 border-neutral-200"
                            }`}
                          >
                            {p.isActive ? "Active" : "Inactive"}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </>
      )}

      {/* ====================================================================
          7. ADD PRODUCT PREVIEW MODAL (TASK A-07 BRIDGE)
          ==================================================================== */}
      {showAddModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-product-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div className="bg-surface rounded-2xl max-w-md w-full p-6 shadow-modal border border-neutral-200 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary/20 text-neutral-900 flex items-center justify-center">
                  <PlusIcon size={18} />
                </div>
                <h3
                  id="add-product-modal-title"
                  className="font-bold text-base text-neutral-900"
                >
                  Add 3D Print Product
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                aria-label="Close dialog"
                className="w-8 h-8 rounded-lg border border-neutral-200 hover:bg-neutral-100 flex items-center justify-center text-neutral-500"
              >
                <XIcon size={16} />
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-950 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-amber-900">
                <ShieldCheckIcon size={14} className="text-amber-700" />
                <span>Task A-07 Preview Notice</span>
              </div>
              <p className="leading-relaxed">
                The comprehensive product creation form (image upload, filament
                selection, dimensions, pricing, and variants) will be built in
                Task A-07.
              </p>
            </div>

            <div className="space-y-2 text-xs text-neutral-600">
              <div className="font-semibold text-neutral-800">
                Planned Product Creation Pipeline:
              </div>
              <ul className="space-y-1.5 text-neutral-500 list-disc list-inside">
                <li>Bespoke product title, slug generator &amp; category assignment</li>
                <li>High-resolution 3D print photo gallery uploads</li>
                <li>Material specifications (PLA, PETG, Resin) &amp; dimensions</li>
                <li>Inventory quantity, retail price &amp; reference price</li>
              </ul>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl font-bold text-xs bg-primary text-neutral-900 hover:bg-[#91BC7A] transition-all cursor-pointer"
              >
                Understood
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
