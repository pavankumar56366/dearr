"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import Link from "next/link";
import {
  AdminCategory,
  BASE_CATEGORIES,
  getAllAdminCategories,
  toggleAdminCategoryStatus,
  getCategoryMetrics,
} from "@/lib/admin-categories";
import {
  LayersIcon,
  SearchIcon,
  XIcon,
  PlusIcon,
  MoreVerticalIcon,
  EditIcon,
  PowerIcon,
  PackageIcon,
  AlertCircleIcon,
} from "../AdminIcons";
import { AdminCategoriesSkeleton } from "./AdminCategoriesSkeleton";

export function AdminCategoriesList() {
  const [categories, setCategories] = useState<AdminCategory[]>(BASE_CATEGORIES);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const [showSkeletonDemo, setShowSkeletonDemo] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Deactivation confirmation modal state
  const [categoryToDeactivate, setCategoryToDeactivate] = useState<AdminCategory | null>(null);

  const dropdownRef = useRef<HTMLDivElement | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  // Sync categories on mount and listen to outside clicks
  useEffect(() => {
    setCategories(getAllAdminCategories());
  }, []);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpenDropdownId(null);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpenDropdownId(null);
        setCategoryToDeactivate(null);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  // Live Summary Metrics
  const metrics = useMemo(() => {
    return getCategoryMetrics();
  }, [categories]);

  // Combined Search & Filter Logic
  const filteredCategories = useMemo(() => {
    return categories.filter((cat) => {
      // 1. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = cat.name.toLowerCase().includes(q);
        const matchesSlug = cat.slug.toLowerCase().includes(q);
        const matchesDesc = cat.description.toLowerCase().includes(q);
        if (!matchesName && !matchesSlug && !matchesDesc) return false;
      }

      // 2. Status Filter
      if (selectedStatus === "ACTIVE" && !cat.isActive) return false;
      if (selectedStatus === "INACTIVE" && cat.isActive) return false;

      return true;
    });
  }, [categories, searchQuery, selectedStatus]);

  // Handle Toggle Status
  const handleToggleClick = (cat: AdminCategory) => {
    setOpenDropdownId(null);

    // If currently active and used by products, prompt with confirmation
    if (cat.isActive && (cat.productCount || 0) > 0) {
      setCategoryToDeactivate(cat);
      return;
    }

    // Otherwise toggle directly
    executeToggle(cat);
  };

  const executeToggle = (cat: AdminCategory) => {
    const res = toggleAdminCategoryStatus(cat.id);
    if (res.success) {
      setCategories(getAllAdminCategories());
      showToast(
        res.newStatus
          ? `Category "${cat.name}" activated`
          : `Category "${cat.name}" deactivated`
      );
    }
    setCategoryToDeactivate(null);
  };

  const handleClearFilters = () => {
    setSearchQuery("");
    setSelectedStatus("ALL");
  };

  const hasActiveFilters = Boolean(searchQuery.trim()) || selectedStatus !== "ALL";

  return (
    <div className="space-y-6 pb-20">
      {/* Toast Notification Banner */}
      {toastMessage && (
        <div
          role="status"
          className="fixed bottom-6 right-6 z-50 bg-neutral-900 text-white text-xs sm:text-sm font-medium px-4 py-3 rounded-xl shadow-lg border border-neutral-700 animate-in fade-in slide-in-from-bottom-2 duration-200 flex items-center gap-2"
        >
          <span className="w-2 h-2 rounded-full bg-primary" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ====================================================================
          1. PAGE HEADER & PRIMARY ACTION
          ==================================================================== */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-neutral-900">
              Categories
            </h1>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-neutral-100 text-neutral-600 border border-neutral-200">
              {categories.length} total
            </span>
          </div>
          <p className="text-xs sm:text-sm text-neutral-500 mt-1">
            Manage the categories used across your Dearr product catalog.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Skeleton Preview QA Toggle */}
          <button
            type="button"
            onClick={() => setShowSkeletonDemo(!showSkeletonDemo)}
            aria-label="Toggle skeleton preview mode"
            className="text-[11px] font-semibold text-neutral-500 hover:text-neutral-900 px-3 py-2 rounded-xl border border-neutral-200 hover:bg-neutral-100 transition-colors cursor-pointer"
          >
            {showSkeletonDemo ? "Hide Skeleton" : "Preview Skeleton"}
          </button>

          {/* Primary CTA */}
          <Link
            href="/admin/categories/new"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm bg-primary hover:bg-[#91BC7A] text-neutral-900 transition-all shadow-xs cursor-pointer"
          >
            <PlusIcon size={16} />
            <span>Add Category</span>
          </Link>
        </div>
      </div>

      {showSkeletonDemo ? (
        <AdminCategoriesSkeleton />
      ) : (
        <>
          {/* ====================================================================
              2. SUMMARY METRICS CARDS (4 Cards)
              ==================================================================== */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {/* 1. Total Categories */}
            <div className="p-4 rounded-2xl bg-surface border border-neutral-200/80 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between text-neutral-500 mb-2">
                <span className="text-xs font-bold uppercase tracking-wider">
                  Total Categories
                </span>
                <LayersIcon size={16} className="text-neutral-400" />
              </div>
              <div className="text-2xl sm:text-3xl font-extrabold text-neutral-900 font-display">
                {metrics.totalCategories}
              </div>
              <p className="text-[11px] text-neutral-400 mt-1">
                Defined in catalog
              </p>
            </div>

            {/* 2. Active Categories */}
            <div className="p-4 rounded-2xl bg-surface border border-neutral-200/80 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between text-neutral-500 mb-2">
                <span className="text-xs font-bold uppercase tracking-wider">
                  Active
                </span>
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
              </div>
              <div className="text-2xl sm:text-3xl font-extrabold text-emerald-800 font-display">
                {metrics.activeCategories}
              </div>
              <p className="text-[11px] text-neutral-400 mt-1">
                Visible on storefront
              </p>
            </div>

            {/* 3. Inactive Categories */}
            <div className="p-4 rounded-2xl bg-surface border border-neutral-200/80 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between text-neutral-500 mb-2">
                <span className="text-xs font-bold uppercase tracking-wider">
                  Inactive
                </span>
                <span className="w-2 h-2 rounded-full bg-neutral-400" />
              </div>
              <div className="text-2xl sm:text-3xl font-extrabold text-neutral-600 font-display">
                {metrics.inactiveCategories}
              </div>
              <p className="text-[11px] text-neutral-400 mt-1">
                Hidden from filters
              </p>
            </div>

            {/* 4. Products Without Category */}
            <div className="p-4 rounded-2xl bg-surface border border-neutral-200/80 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between text-neutral-500 mb-2">
                <span className="text-xs font-bold uppercase tracking-wider truncate">
                  Uncategorized
                </span>
                <PackageIcon size={16} className="text-amber-500" />
              </div>
              <div
                className={`text-2xl sm:text-3xl font-extrabold font-display ${
                  metrics.productsWithoutCategory > 0
                    ? "text-amber-700"
                    : "text-neutral-900"
                }`}
              >
                {metrics.productsWithoutCategory}
              </div>
              <p className="text-[11px] text-neutral-400 mt-1">
                Products without match
              </p>
            </div>
          </div>

          {/* ====================================================================
              3. SEARCH & FILTER TOOLBAR
              ==================================================================== */}
          <div className="p-3.5 sm:p-4 rounded-2xl bg-surface border border-neutral-200/80 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex-1 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              {/* Search Bar */}
              <div className="relative flex-1">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-400">
                  <SearchIcon size={16} />
                </div>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by category name, slug, or description..."
                  aria-label="Search categories"
                  className="w-full pl-10 pr-9 py-2 rounded-xl border border-neutral-200 hover:border-neutral-300 focus:outline-none focus:ring-2 focus:ring-primary text-xs sm:text-sm bg-white text-neutral-900 transition-all placeholder:text-neutral-400"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    aria-label="Clear category search"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-neutral-400 hover:text-neutral-600"
                  >
                    <XIcon size={14} />
                  </button>
                )}
              </div>

              {/* Status Filter */}
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value as "ALL" | "ACTIVE" | "INACTIVE")}
                aria-label="Filter categories by active status"
                className="px-3 py-2 rounded-xl border border-neutral-200 hover:border-neutral-300 text-xs sm:text-sm text-neutral-800 bg-white focus:outline-none focus:ring-2 focus:ring-primary font-medium"
              >
                <option value="ALL">All Statuses</option>
                <option value="ACTIVE">Active Only</option>
                <option value="INACTIVE">Inactive Only</option>
              </select>
            </div>

            {/* Result count & Clear Filters */}
            <div className="flex items-center justify-between sm:justify-end gap-3 text-xs text-neutral-500 pt-1 sm:pt-0 border-t sm:border-t-0 border-neutral-100">
              <span className="font-medium">
                Showing {filteredCategories.length} of {categories.length} categories
              </span>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={handleClearFilters}
                  className="text-xs font-semibold text-primary hover:underline cursor-pointer"
                >
                  Reset
                </button>
              )}
            </div>
          </div>

          {/* ====================================================================
              4. CATEGORIES LIST CONTENT (Desktop Table / Mobile Cards)
              ==================================================================== */}
          {filteredCategories.length === 0 ? (
            /* Empty State */
            <div className="p-12 rounded-2xl bg-surface border border-neutral-200/80 shadow-xs text-center space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-neutral-100 text-neutral-400 mx-auto flex items-center justify-center">
                <LayersIcon size={28} />
              </div>
              <div>
                <h3 className="text-base font-bold text-neutral-900">
                  {categories.length === 0 ? "No categories yet" : "No categories found"}
                </h3>
                <p className="text-xs sm:text-sm text-neutral-500 max-w-sm mx-auto mt-1">
                  {categories.length === 0
                    ? "Create your first product category to organize the Dearr catalog."
                    : "Try a different search or clear your filters."}
                </p>
              </div>
              <div>
                {categories.length === 0 ? (
                  <Link
                    href="/admin/categories/new"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs bg-primary hover:bg-[#91BC7A] text-neutral-900 transition-all cursor-pointer"
                  >
                    <PlusIcon size={14} />
                    <span>Add Category</span>
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={handleClearFilters}
                    className="px-4 py-2 rounded-xl border border-neutral-200 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 transition-colors cursor-pointer"
                  >
                    Clear Search
                  </button>
                )}
              </div>
            </div>
          ) : (
            <>
              <h2 className="sr-only">Category List</h2>
              {/* DESKTOP TABLE (>= 1024px) */}
              <div
                ref={dropdownRef}
                className="hidden lg:block rounded-2xl bg-surface border border-neutral-200/80 shadow-xs overflow-visible"
              >
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-neutral-200/80 bg-neutral-50/70 text-[11px] font-bold uppercase tracking-wider text-neutral-500 select-none">
                      <th scope="col" className="py-3 px-4">
                        Category
                      </th>
                      <th scope="col" className="py-3 px-3">
                        Slug
                      </th>
                      <th scope="col" className="py-3 px-3">
                        Products
                      </th>
                      <th scope="col" className="py-3 px-3">
                        Status
                      </th>
                      <th scope="col" className="py-3 px-3">
                        Updated
                      </th>
                      <th scope="col" className="py-3 px-4 text-right">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100 text-xs text-neutral-800">
                    {filteredCategories.map((cat) => {
                      const isDropdownOpen = openDropdownId === cat.id;
                      const formattedDate = new Date(cat.updatedAt).toLocaleDateString(
                        "en-IN",
                        {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        }
                      );

                      return (
                        <tr
                          key={cat.id}
                          className="hover:bg-neutral-50/60 transition-colors"
                        >
                          {/* Category Name & Description */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-3">
                              <span className="w-9 h-9 rounded-xl bg-neutral-100 border border-neutral-200/60 flex items-center justify-center text-lg shrink-0 select-none">
                                {cat.icon || "📁"}
                              </span>
                              <div className="min-w-0">
                                <span className="font-bold text-neutral-900 block truncate">
                                  {cat.name}
                                </span>
                                <span className="text-[11px] text-neutral-500 block truncate max-w-xs">
                                  {cat.description || "No description provided"}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* Slug */}
                          <td className="py-3.5 px-3">
                            <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-neutral-100 text-neutral-700 border border-neutral-200/60">
                              {cat.slug}
                            </span>
                          </td>

                          {/* Products Count */}
                          <td className="py-3.5 px-3">
                            <div className="flex items-baseline gap-1.5">
                              <span className="font-bold text-neutral-900">
                                {cat.activeProductCount || 0}
                              </span>
                              <span className="text-[11px] text-neutral-400">
                                active
                              </span>
                              {(cat.productCount || 0) !== (cat.activeProductCount || 0) && (
                                <span className="text-[10px] text-neutral-400">
                                  ({cat.productCount} total)
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Status */}
                          <td className="py-3.5 px-3">
                            {cat.isActive ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                <span>Active</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-neutral-100 text-neutral-500 border border-neutral-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-neutral-400" />
                                <span>Inactive</span>
                              </span>
                            )}
                          </td>

                          {/* Updated At */}
                          <td className="py-3.5 px-3 text-neutral-500 text-[11px]">
                            {formattedDate}
                          </td>

                          {/* Action Menu (3-dot) */}
                          <td className="py-3.5 px-4 text-right relative">
                            <div className="inline-block text-left">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setOpenDropdownId(
                                    isDropdownOpen ? null : cat.id
                                  );
                                }}
                                aria-label={`Action menu for ${cat.name}`}
                                aria-expanded={isDropdownOpen}
                                className="w-8 h-8 rounded-lg border border-neutral-200 hover:bg-neutral-100 flex items-center justify-center text-neutral-600 transition-colors cursor-pointer"
                              >
                                <MoreVerticalIcon size={16} />
                              </button>

                              {isDropdownOpen && (
                                <div className="absolute right-4 mt-1 w-44 rounded-xl bg-surface border border-neutral-200 shadow-xl py-1 z-30 animate-in fade-in duration-100">
                                  {/* Edit Category */}
                                  <Link
                                    href={`/admin/categories/${cat.slug}/edit`}
                                    className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-neutral-700 hover:bg-neutral-50 hover:text-neutral-900 transition-colors"
                                  >
                                    <EditIcon size={14} className="text-neutral-400" />
                                    <span>Edit Category</span>
                                  </Link>

                                  {/* View Products */}
                                  <Link
                                    href={`/admin/products?category=${encodeURIComponent(cat.name)}`}
                                    className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-neutral-700 hover:bg-neutral-50 hover:text-neutral-900 transition-colors"
                                  >
                                    <PackageIcon size={14} className="text-neutral-400" />
                                    <span>View Products</span>
                                  </Link>

                                  <div className="my-1 border-t border-neutral-100" />

                                  {/* Activate / Deactivate Toggle */}
                                  <button
                                    type="button"
                                    onClick={() => handleToggleClick(cat)}
                                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold transition-colors cursor-pointer text-left ${
                                      cat.isActive
                                        ? "text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900"
                                        : "text-emerald-700 hover:bg-emerald-50"
                                    }`}
                                  >
                                    <PowerIcon
                                      size={14}
                                      className={
                                        cat.isActive
                                          ? "text-neutral-400"
                                          : "text-emerald-500"
                                      }
                                    />
                                    <span>
                                      {cat.isActive ? "Deactivate" : "Activate"}
                                    </span>
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

              {/* MOBILE CARDS (< 1024px) */}
              <div className="lg:hidden space-y-3">
                {filteredCategories.map((cat) => {
                  const isDropdownOpen = openDropdownId === cat.id;

                  return (
                    <div
                      key={cat.id}
                      className="p-4 rounded-2xl bg-surface border border-neutral-200/80 shadow-xs space-y-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="w-10 h-10 rounded-xl bg-neutral-100 border border-neutral-200/60 flex items-center justify-center text-lg shrink-0">
                            {cat.icon || "📁"}
                          </span>
                          <div className="min-w-0">
                            <h3 className="font-bold text-sm text-neutral-900 truncate">
                              {cat.name}
                            </h3>
                            <span className="font-mono text-[10px] text-neutral-500">
                              /{cat.slug}
                            </span>
                          </div>
                        </div>

                        {/* Mobile 3-dot dropdown */}
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() =>
                              setOpenDropdownId(isDropdownOpen ? null : cat.id)
                            }
                            aria-label={`Options for ${cat.name}`}
                            aria-expanded={isDropdownOpen}
                            className="w-11 h-11 rounded-xl border border-neutral-200 hover:bg-neutral-100 flex items-center justify-center text-neutral-600 cursor-pointer"
                          >
                            <MoreVerticalIcon size={18} />
                          </button>

                          {isDropdownOpen && (
                            <div className="absolute right-0 mt-1 w-44 rounded-xl bg-surface border border-neutral-200 shadow-xl py-1 z-30">
                              <Link
                                href={`/admin/categories/${cat.slug}/edit`}
                                className="flex items-center gap-2.5 px-3 py-2.5 text-xs font-medium text-neutral-700"
                              >
                                <EditIcon size={14} />
                                <span>Edit Category</span>
                              </Link>
                              <Link
                                href={`/admin/products?category=${encodeURIComponent(cat.name)}`}
                                className="flex items-center gap-2.5 px-3 py-2.5 text-xs font-medium text-neutral-700"
                              >
                                <PackageIcon size={14} />
                                <span>View Products</span>
                              </Link>
                              <div className="my-1 border-t border-neutral-100" />
                              <button
                                type="button"
                                onClick={() => handleToggleClick(cat)}
                                className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs font-semibold text-left"
                              >
                                <PowerIcon size={14} />
                                <span>{cat.isActive ? "Deactivate" : "Activate"}</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      {cat.description && (
                        <p className="text-xs text-neutral-600 line-clamp-2">
                          {cat.description}
                        </p>
                      )}

                      <div className="flex items-center justify-between pt-2 border-t border-neutral-100 text-xs">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-neutral-900">
                            {cat.activeProductCount || 0}
                          </span>
                          <span className="text-neutral-500">
                            products ({cat.productCount} total)
                          </span>
                        </div>

                        {cat.isActive ? (
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
          5. OPERATIONAL DEACTIVATION WARNING MODAL
          ==================================================================== */}
      {categoryToDeactivate && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="deactivate-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/50 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div className="w-full max-w-md bg-surface rounded-2xl p-6 border border-neutral-200 shadow-xl space-y-4">
            <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center border border-amber-200">
              <AlertCircleIcon size={22} />
            </div>

            <div>
              <h3
                id="deactivate-modal-title"
                className="text-lg font-bold text-neutral-900"
              >
                Deactivate &ldquo;{categoryToDeactivate.name}&rdquo;?
              </h3>
              <p className="text-sm text-neutral-600 mt-2 leading-relaxed">
                This category is currently used by{" "}
                <strong className="text-neutral-900 font-bold">
                  {categoryToDeactivate.productCount} products
                </strong>
                . Deactivating it will hide the category from customer filters, but
                will keep those products unchanged in your catalog.
              </p>
            </div>

            <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setCategoryToDeactivate(null)}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-neutral-200 hover:bg-neutral-100 text-xs sm:text-sm font-semibold text-neutral-700 cursor-pointer"
              >
                Keep Active
              </button>
              <button
                type="button"
                onClick={() => executeToggle(categoryToDeactivate)}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white text-xs sm:text-sm font-bold transition-all cursor-pointer"
              >
                Confirm Deactivation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
