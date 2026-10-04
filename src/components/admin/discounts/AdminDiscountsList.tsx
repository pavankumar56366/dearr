"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import Link from "next/link";
import {
  AdminDiscount,
  BASE_DISCOUNTS,
  getAllAdminDiscounts,
  toggleAdminDiscountStatus,
  duplicateAdminDiscount,
  getDiscountStatus,
  getDiscountMetrics,
  DiscountStatus,
} from "@/lib/admin-discounts";
import {
  TagIcon,
  SearchIcon,
  XIcon,
  PlusIcon,
  MoreVerticalIcon,
  EditIcon,
  PowerIcon,
  CopyIcon,
  EyeIcon,
  AlertCircleIcon,
} from "../AdminIcons";
import { AdminDiscountsSkeleton } from "./AdminDiscountsSkeleton";
import { getAllAdminProducts, AdminProduct } from "@/lib/admin-catalog";
import { getAllAdminCategories, AdminCategory } from "@/lib/admin-categories";

export function AdminDiscountsList() {
  const [discounts, setDiscounts] = useState<AdminDiscount[]>(BASE_DISCOUNTS);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<"ALL" | "ACTIVE" | "SCHEDULED" | "EXPIRED" | "DEACTIVATED" | "DRAFT">("ALL");
  const [selectedType, setSelectedType] = useState<"ALL" | "PERCENTAGE" | "FIXED">("ALL");
  const [selectedScope, setSelectedScope] = useState<"ALL" | "ALL_PRODUCTS" | "PRODUCTS" | "CATEGORIES">("ALL");

  const [openDropdownCode, setOpenDropdownCode] = useState<string | null>(null);
  const [showSkeletonDemo, setShowSkeletonDemo] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [allProducts, setAllProducts] = useState<AdminProduct[]>([]);
  const [allCategories, setAllCategories] = useState<AdminCategory[]>([]);

  // Deactivation confirmation modal state
  const [discountToDeactivate, setDiscountToDeactivate] = useState<AdminDiscount | null>(null);

  // View Details Modal state
  const [viewDetailsDiscount, setViewDetailsDiscount] = useState<AdminDiscount | null>(null);

  const dropdownRef = useRef<HTMLDivElement | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  // Sync discounts, products & categories on mount & outside click listeners
  useEffect(() => {
    async function loadDiscounts() {
      try {
        const res = await fetch("/api/admin/discounts");
        if (res.ok) {
          const data = await res.json();
          if (data.ok && Array.isArray(data.discounts)) {
            const mapped: AdminDiscount[] = data.discounts.map((d: any) => ({
              id: d.id,
              code: d.code || d.name.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10),
              name: d.name,
              type: d.discountType === "fixed_amount" ? "fixed" : "percentage",
              value: Number(d.value),
              startsAt: d.startAt ? d.startAt.split("T")[0] : undefined,
              endsAt: d.endAt ? d.endAt.split("T")[0] : undefined,
              appliesTo: d.scope === "store" ? "all" : d.scope === "category" ? "categories" : "products",
              productIds: d.productIds || [],
              categorySlugs: (d.categoryIds || []).map((catId: string) => {
                const found = allCategories.find((c) => c.id === catId);
                return found ? found.slug : catId;
              }),
              isActive: d.isActive,
              usageLimit: null,
              usageCount: 0,
              createdAt: d.createdAt,
              updatedAt: d.updatedAt,
            }));
            if (mapped.length > 0) {
              setDiscounts(mapped);
              return;
            }
          }
        }
      } catch {
        // Fallback to session
      }
      setDiscounts(getAllAdminDiscounts());
    }

    setAllProducts(getAllAdminProducts());
    setAllCategories(getAllAdminCategories());
    loadDiscounts();
  }, []);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpenDropdownCode(null);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpenDropdownCode(null);
        setDiscountToDeactivate(null);
        setViewDetailsDiscount(null);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  // Summary Metrics
  const metrics = useMemo(() => {
    return getDiscountMetrics(discounts);
  }, [discounts]);

  // Filtered Discounts
  const filteredDiscounts = useMemo(() => {
    const now = new Date();
    return discounts.filter((d) => {
      // 1. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesCode = d.code.toLowerCase().includes(q);
        const matchesName = d.name.toLowerCase().includes(q);
        const matchesDesc = (d.description || "").toLowerCase().includes(q);
        if (!matchesCode && !matchesName && !matchesDesc) return false;
      }

      // 2. Status Filter
      const status = getDiscountStatus(d, now);
      if (selectedStatus !== "ALL") {
        if (selectedStatus.toLowerCase() !== status) return false;
      }

      // 3. Type Filter
      if (selectedType !== "ALL") {
        if (selectedType.toLowerCase() !== d.type) return false;
      }

      // 4. Scope Filter
      if (selectedScope !== "ALL") {
        if (selectedScope === "ALL_PRODUCTS" && d.appliesTo !== "all") return false;
        if (selectedScope === "PRODUCTS" && d.appliesTo !== "products") return false;
        if (selectedScope === "CATEGORIES" && d.appliesTo !== "categories") return false;
      }

      return true;
    });
  }, [discounts, searchQuery, selectedStatus, selectedType, selectedScope]);

  // Handle Toggle Status
  const handleToggleClick = (discount: AdminDiscount) => {
    setOpenDropdownCode(null);

    // If currently active or scheduled, show confirmation dialog before deactivating
    const status = getDiscountStatus(discount);
    if (status === "active" || status === "scheduled") {
      setDiscountToDeactivate(discount);
      return;
    }

    // Otherwise (if deactivated, draft, etc.), toggle directly
    executeToggle(discount.code);
  };

  const executeToggle = async (code: string) => {
    const target = discounts.find((d) => d.code === code);
    if (target) {
      const isRealUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(target.id);
      if (isRealUuid) {
        try {
          await fetch(`/api/admin/discounts/${target.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ isActive: !target.isActive }),
          });
        } catch (err) {
          console.warn("Failed to patch discount active state:", err);
        }
      }
    }
    const updated = toggleAdminDiscountStatus(code);
    if (updated) {
      setDiscounts((prev) =>
        prev.map((d) => (d.code === code ? { ...d, isActive: !d.isActive } : d))
      );
      showToast(
        !target || !target.isActive
          ? `Discount ${code} activated`
          : `Discount ${code} deactivated`
      );
    }
    setDiscountToDeactivate(null);
  };

  // Handle Duplicate
  const handleDuplicate = (code: string) => {
    setOpenDropdownCode(null);
    const duplicated = duplicateAdminDiscount(code);
    if (duplicated) {
      setDiscounts(getAllAdminDiscounts());
      showToast(`Discount duplicated as ${duplicated.code}`);
    }
  };

  const handleClearFilters = () => {
    setSearchQuery("");
    setSelectedStatus("ALL");
    setSelectedType("ALL");
    setSelectedScope("ALL");
  };

  const hasActiveFilters =
    Boolean(searchQuery.trim()) ||
    selectedStatus !== "ALL" ||
    selectedType !== "ALL" ||
    selectedScope !== "ALL";

  const renderStatusBadge = (status: DiscountStatus) => {
    switch (status) {
      case "active":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-primary/20 text-neutral-900 border border-primary/40">
            <span className="w-1.5 h-1.5 rounded-full bg-primary-dark animate-pulse" />
            <span>Active</span>
          </span>
        );
      case "scheduled":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-800 border border-blue-200">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            <span>Scheduled</span>
          </span>
        );
      case "expired":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-900 border border-amber-200">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            <span>Expired</span>
          </span>
        );
      case "draft":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-neutral-100 text-neutral-600 border border-neutral-300">
            <span className="w-1.5 h-1.5 rounded-full bg-neutral-400" />
            <span>Draft</span>
          </span>
        );
      case "deactivated":
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-neutral-100 text-neutral-500 border border-neutral-200">
            <span className="w-1.5 h-1.5 rounded-full bg-neutral-400" />
            <span>Deactivated</span>
          </span>
        );
    }
  };

  const formatScopeLabel = (d: AdminDiscount) => {
    if (d.appliesTo === "all") return "All Products";
    if (d.appliesTo === "categories") {
      const count = d.categorySlugs?.length || 0;
      return `${count} ${count === 1 ? "Category" : "Categories"}`;
    }
    if (d.appliesTo === "products") {
      const count = d.productIds?.length || 0;
      return `${count} ${count === 1 ? "Product" : "Products"}`;
    }
    return "All Products";
  };

  const getResolvedScopeNames = (d: AdminDiscount): string[] => {
    if (d.appliesTo === "all") {
      return ["All Products"];
    }
    if (d.appliesTo === "categories" && d.categorySlugs) {
      const catMap = new Map(allCategories.map((c) => [c.slug, c.name]));
      return d.categorySlugs.map(
        (slug) =>
          catMap.get(slug) ||
          slug
            .split("-")
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
            .join(" ")
      );
    }
    if (d.appliesTo === "products" && d.productIds) {
      const prodMap = new Map(allProducts.map((p) => [p.id, p.name]));
      return d.productIds.map((id) => prodMap.get(id) || `Product (${id})`);
    }
    return [];
  };

  const formatValidity = (d: AdminDiscount) => {
    if (!d.startsAt) return "Indefinite";
    const s = d.startsAt.split("T")[0];
    if (!d.endsAt) return `From ${s}`;
    const e = d.endsAt.split("T")[0];
    return `${s} → ${e}`;
  };

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

      {/* Header & Primary CTA */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-neutral-900">
              Discounts
            </h1>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-neutral-100 text-neutral-600 border border-neutral-200">
              {discounts.length} total
            </span>
          </div>
          <p className="text-xs sm:text-sm text-neutral-500 mt-1">
            Create and manage promotional offers for the Dearr store.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Skeleton QA Toggle */}
          <button
            type="button"
            onClick={() => setShowSkeletonDemo(!showSkeletonDemo)}
            className="px-3 py-2 rounded-xl border border-neutral-200 hover:bg-neutral-100 text-xs font-semibold text-neutral-600 transition-colors cursor-pointer"
            title="Preview skeleton loading state for QA verification"
          >
            {showSkeletonDemo ? "Hide Skeleton" : "Preview Skeleton"}
          </button>

          <Link
            href="/admin/discounts/new"
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-primary hover:bg-[#91BC7A] text-neutral-900 font-bold text-xs shadow-xs transition-all cursor-pointer"
          >
            <PlusIcon size={16} />
            <span>+ Add Discount</span>
          </Link>
        </div>
      </div>

      {/* Conditional Skeleton Demo Mode */}
      {showSkeletonDemo ? (
        <AdminDiscountsSkeleton />
      ) : (
        <>
          {/* Summary Metric Cards (4 Cards) */}
          <section
            aria-label="Discounts Summary Metrics"
            className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4"
          >
            <div className="p-4 rounded-2xl bg-surface border border-neutral-200/80 shadow-2xs space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-primary-dark">
                Active Discounts
              </span>
              <div className="text-2xl sm:text-3xl font-display font-bold text-neutral-900">
                {metrics.activeDiscounts}
              </div>
              <p className="text-[11px] text-neutral-500">
                Live &amp; redeemable now
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-surface border border-neutral-200/80 shadow-2xs space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-blue-700">
                Scheduled Discounts
              </span>
              <div className="text-2xl sm:text-3xl font-display font-bold text-neutral-900">
                {metrics.scheduledDiscounts}
              </div>
              <p className="text-[11px] text-neutral-500">
                Future campaign starts
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-surface border border-neutral-200/80 shadow-2xs space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700">
                Expired Discounts
              </span>
              <div className="text-2xl sm:text-3xl font-display font-bold text-neutral-900">
                {metrics.expiredDiscounts}
              </div>
              <p className="text-[11px] text-neutral-500">
                Past validity window
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-surface border border-neutral-200/80 shadow-2xs space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-600">
                Total Redemptions
              </span>
              <div className="text-2xl sm:text-3xl font-display font-bold text-neutral-900">
                {metrics.totalRedemptions}
              </div>
              <p className="text-[11px] text-neutral-500">
                Orders with applied promo
              </p>
            </div>
          </section>

          {/* Search & Composable Filter Bar */}
          <section
            aria-label="Search and Filter Discounts"
            className="p-4 rounded-2xl bg-surface border border-neutral-200/80 shadow-2xs space-y-3"
          >
            <div className="flex flex-col md:flex-row gap-3">
              {/* Search Input */}
              <div className="relative flex-1">
                <SearchIcon
                  size={16}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400"
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by coupon code, name, or description..."
                  className="w-full pl-10 pr-9 py-2.5 rounded-xl border border-neutral-200 bg-white text-xs sm:text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
                  aria-label="Search discounts"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    aria-label="Clear discount search"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700 cursor-pointer"
                  >
                    <XIcon size={14} />
                  </button>
                )}
              </div>

              {/* Status Dropdown */}
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value as any)}
                aria-label="Filter discounts by status"
                className="px-3.5 py-2.5 rounded-xl border border-neutral-200 bg-white text-xs font-semibold text-neutral-700 focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer"
              >
                <option value="ALL">All Status</option>
                <option value="ACTIVE">Active</option>
                <option value="SCHEDULED">Scheduled</option>
                <option value="EXPIRED">Expired</option>
                <option value="DEACTIVATED">Deactivated</option>
                <option value="DRAFT">Draft</option>
              </select>

              {/* Type Dropdown */}
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value as any)}
                aria-label="Filter discounts by type"
                className="px-3.5 py-2.5 rounded-xl border border-neutral-200 bg-white text-xs font-semibold text-neutral-700 focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer"
              >
                <option value="ALL">All Types</option>
                <option value="PERCENTAGE">Percentage (%)</option>
                <option value="FIXED">Fixed Amount (₹)</option>
              </select>

              {/* Scope Dropdown */}
              <select
                value={selectedScope}
                onChange={(e) => setSelectedScope(e.target.value as any)}
                aria-label="Filter discounts by scope"
                className="px-3.5 py-2.5 rounded-xl border border-neutral-200 bg-white text-xs font-semibold text-neutral-700 focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer"
              >
                <option value="ALL">All Scopes</option>
                <option value="ALL_PRODUCTS">All Products</option>
                <option value="PRODUCTS">Specific Products</option>
                <option value="CATEGORIES">Category Scope</option>
              </select>
            </div>

            {/* Results count & reset filters banner */}
            <div className="flex items-center justify-between text-xs text-neutral-500 pt-1 border-t border-neutral-100">
              <div>
                Showing <span className="font-bold text-neutral-800">{filteredDiscounts.length}</span> of{" "}
                <span className="font-bold text-neutral-800">{discounts.length}</span> discounts
              </div>

              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={handleClearFilters}
                  className="font-bold text-primary-dark hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <XIcon size={12} />
                  <span>Clear all filters</span>
                </button>
              )}
            </div>
          </section>

          {/* Discounts Content: Empty State vs Desktop Table / Mobile Cards */}
          {filteredDiscounts.length === 0 ? (
            <div className="p-12 text-center rounded-2xl bg-surface border border-neutral-200/80 shadow-2xs space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-neutral-100 flex items-center justify-center text-neutral-400 mx-auto">
                <TagIcon size={24} />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-neutral-900">
                  {discounts.length === 0 ? "No discounts yet" : "No discounts found"}
                </h3>
                <p className="text-xs text-neutral-500 max-w-sm mx-auto">
                  {discounts.length === 0
                    ? "Create your first promotional offer for the Dearr store."
                    : "Try changing your search or filters."}
                </p>
              </div>
              <div className="pt-2">
                {discounts.length === 0 ? (
                  <Link
                    href="/admin/discounts/new"
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-primary hover:bg-[#91BC7A] text-neutral-900 font-bold text-xs shadow-xs transition-all cursor-pointer"
                  >
                    <PlusIcon size={16} />
                    <span>+ Add Discount</span>
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={handleClearFilters}
                    className="px-4 py-2 rounded-xl border border-neutral-200 text-xs font-semibold text-neutral-700 hover:bg-neutral-100 transition-colors cursor-pointer"
                  >
                    Clear Filters
                  </button>
                )}
              </div>
            </div>
          ) : (
            <>
              {/* Desktop Table (>= 1024px) */}
              <div className="hidden lg:block rounded-2xl bg-surface border border-neutral-200/80 shadow-2xs overflow-visible">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-neutral-200/80 text-[11px] font-bold uppercase tracking-wider text-neutral-400 bg-neutral-50/50">
                      <th scope="col" className="py-3 px-4">Coupon Code</th>
                      <th scope="col" className="py-3 px-4">Discount Name</th>
                      <th scope="col" className="py-3 px-4">Value</th>
                      <th scope="col" className="py-3 px-4">Scope</th>
                      <th scope="col" className="py-3 px-4">Validity</th>
                      <th scope="col" className="py-3 px-4">Usage</th>
                      <th scope="col" className="py-3 px-4">Status</th>
                      <th scope="col" className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100 text-xs text-neutral-700">
                    {filteredDiscounts.map((discount) => {
                      const status = getDiscountStatus(discount);
                      const isDropdownOpen = openDropdownCode === discount.code;

                      return (
                        <tr
                          key={discount.id}
                          className="hover:bg-neutral-50/70 transition-colors"
                        >
                          {/* Code */}
                          <td className="py-3.5 px-4 font-mono font-bold text-neutral-900">
                            <span className="bg-neutral-100 border border-neutral-200 px-2 py-1 rounded-md tracking-wider">
                              {discount.code}
                            </span>
                          </td>

                          {/* Discount Name & Description Preview */}
                          <td className="py-3.5 px-4 max-w-xs">
                            <div className="font-semibold text-neutral-900">
                              {discount.name}
                            </div>
                            {discount.description && (
                              <p className="text-[11px] text-neutral-500 truncate max-w-xs">
                                {discount.description}
                              </p>
                            )}
                          </td>

                          {/* Value */}
                          <td className="py-3.5 px-4 font-bold text-neutral-900">
                            {discount.type === "percentage" ? (
                              <span>{discount.value}% OFF</span>
                            ) : (
                              <span>₹{discount.value.toLocaleString("en-IN")} OFF</span>
                            )}
                          </td>

                          {/* Scope */}
                          <td className="py-3.5 px-4 text-neutral-600 font-medium">
                            <span
                              title={getResolvedScopeNames(discount).join(", ")}
                              className={discount.appliesTo !== "all" ? "cursor-help underline decoration-dotted decoration-neutral-300" : ""}
                            >
                              {formatScopeLabel(discount)}
                            </span>
                          </td>

                          {/* Validity */}
                          <td className="py-3.5 px-4 text-neutral-600 font-mono text-[11px]">
                            {formatValidity(discount)}
                          </td>

                          {/* Usage */}
                          <td className="py-3.5 px-4 text-neutral-600 font-medium">
                            {discount.usageLimit !== null ? (
                              <span>
                                {discount.usageCount} / {discount.usageLimit}
                              </span>
                            ) : (
                              <span>{discount.usageCount} / Unlimited</span>
                            )}
                          </td>

                          {/* Status */}
                          <td className="py-3.5 px-4">
                            {renderStatusBadge(status)}
                          </td>

                          {/* 3-Dot Actions */}
                          <td className="py-3.5 px-4 text-right relative">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenDropdownCode(isDropdownOpen ? null : discount.code);
                              }}
                              aria-label={`Actions for ${discount.code}`}
                              aria-expanded={isDropdownOpen}
                              className="w-8 h-8 rounded-lg border border-neutral-200 hover:bg-neutral-100 inline-flex items-center justify-center text-neutral-600 transition-colors cursor-pointer"
                            >
                              <MoreVerticalIcon size={16} />
                            </button>

                            {/* Dropdown Menu */}
                            {isDropdownOpen && (
                              <div
                                ref={dropdownRef}
                                className="absolute right-4 top-12 z-40 w-44 rounded-xl bg-white border border-neutral-200 shadow-xl p-1.5 space-y-0.5 text-left animate-in fade-in zoom-in-95 duration-100"
                              >
                                <Link
                                  href={`/admin/discounts/${encodeURIComponent(discount.code)}/edit`}
                                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900 transition-colors cursor-pointer"
                                >
                                  <EditIcon size={14} className="text-neutral-400" />
                                  <span>Edit</span>
                                </Link>

                                <button
                                  type="button"
                                  onClick={() => handleToggleClick(discount)}
                                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-neutral-700 hover:bg-neutral-100 transition-colors cursor-pointer"
                                >
                                  <PowerIcon size={14} className="text-neutral-400" />
                                  <span>{discount.isActive ? "Deactivate" : "Activate"}</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleDuplicate(discount.code)}
                                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-neutral-700 hover:bg-neutral-100 transition-colors cursor-pointer"
                                >
                                  <CopyIcon size={14} className="text-neutral-400" />
                                  <span>Duplicate</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenDropdownCode(null);
                                    setViewDetailsDiscount(discount);
                                  }}
                                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-neutral-700 hover:bg-neutral-100 transition-colors cursor-pointer"
                                >
                                  <EyeIcon size={14} className="text-neutral-400" />
                                  <span>View Details</span>
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards (<= 768px / Tablet < 1024px) */}
              <div className="lg:hidden space-y-3">
                {filteredDiscounts.map((discount) => {
                  const status = getDiscountStatus(discount);
                  const isDropdownOpen = openDropdownCode === discount.code;

                  return (
                    <div
                      key={discount.id}
                      className="p-4 rounded-2xl bg-surface border border-neutral-200/80 shadow-2xs space-y-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono font-bold text-xs bg-neutral-100 border border-neutral-200 px-2 py-0.5 rounded text-neutral-900">
                          {discount.code}
                        </span>
                        <div className="flex items-center gap-2">
                          {renderStatusBadge(status)}

                          {/* 3-Dot Menu on Mobile */}
                          <div className="relative">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenDropdownCode(isDropdownOpen ? null : discount.code);
                              }}
                              aria-label={`Actions for ${discount.code}`}
                              className="w-9 h-9 rounded-lg border border-neutral-200 hover:bg-neutral-100 flex items-center justify-center text-neutral-600 cursor-pointer"
                            >
                              <MoreVerticalIcon size={16} />
                            </button>

                            {isDropdownOpen && (
                              <div
                                ref={dropdownRef}
                                className="absolute right-0 top-10 z-40 w-44 rounded-xl bg-white border border-neutral-200 shadow-xl p-1.5 space-y-0.5 text-left"
                              >
                                <Link
                                  href={`/admin/discounts/${encodeURIComponent(discount.code)}/edit`}
                                  className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-semibold text-neutral-700 hover:bg-neutral-100 cursor-pointer"
                                >
                                  <EditIcon size={14} />
                                  <span>Edit</span>
                                </Link>

                                <button
                                  type="button"
                                  onClick={() => handleToggleClick(discount)}
                                  className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-semibold text-neutral-700 hover:bg-neutral-100 cursor-pointer"
                                >
                                  <PowerIcon size={14} />
                                  <span>{discount.isActive ? "Deactivate" : "Activate"}</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleDuplicate(discount.code)}
                                  className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-semibold text-neutral-700 hover:bg-neutral-100 cursor-pointer"
                                >
                                  <CopyIcon size={14} />
                                  <span>Duplicate</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenDropdownCode(null);
                                    setViewDetailsDiscount(discount);
                                  }}
                                  className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-semibold text-neutral-700 hover:bg-neutral-100 cursor-pointer"
                                >
                                  <EyeIcon size={14} />
                                  <span>View Details</span>
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      <div>
                        <div className="text-sm font-bold text-neutral-900">
                          {discount.name}
                        </div>
                        {discount.description && (
                          <p className="text-xs text-neutral-500 line-clamp-2 mt-0.5">
                            {discount.description}
                          </p>
                        )}
                      </div>

                      <div className="pt-2 border-t border-neutral-100 grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-neutral-400 block text-[10px] uppercase font-bold">Value</span>
                          <span className="font-bold text-neutral-900">
                            {discount.type === "percentage" ? `${discount.value}% OFF` : `₹${discount.value} OFF`}
                          </span>
                        </div>
                        <div>
                          <span className="text-neutral-400 block text-[10px] uppercase font-bold">Scope</span>
                          <span
                            title={getResolvedScopeNames(discount).join(", ")}
                            className="font-medium text-neutral-700"
                          >
                            {formatScopeLabel(discount)}
                          </span>
                        </div>
                        <div>
                          <span className="text-neutral-400 block text-[10px] uppercase font-bold">Validity</span>
                          <span className="font-mono text-[11px] text-neutral-600">
                            {formatValidity(discount)}
                          </span>
                        </div>
                        <div>
                          <span className="text-neutral-400 block text-[10px] uppercase font-bold">Usage</span>
                          <span className="font-medium text-neutral-700">
                            {discount.usageLimit !== null
                              ? `${discount.usageCount} / ${discount.usageLimit}`
                              : `${discount.usageCount} / Unlimited`}
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

      {/* Deactivation Confirmation Modal */}
      {discountToDeactivate && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150"
          role="dialog"
          aria-modal="true"
          aria-labelledby="deactivate-dialog-title"
        >
          <div className="bg-surface rounded-2xl border border-neutral-200 shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 flex items-center justify-center">
              <AlertCircleIcon size={20} />
            </div>

            <div className="space-y-1.5">
              <h3 id="deactivate-dialog-title" className="text-base font-bold text-neutral-900">
                Deactivate this discount?
              </h3>
              <p className="text-xs text-neutral-600 leading-relaxed">
                Customers will no longer be able to use code{" "}
                <span className="font-mono font-bold text-neutral-900">{discountToDeactivate.code}</span> at checkout.
                Existing orders that used this promotion will not be affected.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setDiscountToDeactivate(null)}
                className="px-4 py-2 rounded-xl border border-neutral-200 text-xs font-semibold text-neutral-700 hover:bg-neutral-100 transition-colors cursor-pointer"
              >
                Keep Active
              </button>

              <button
                type="button"
                onClick={() => executeToggle(discountToDeactivate.code)}
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-colors cursor-pointer"
              >
                Deactivate Discount
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Details Inspection Modal */}
      {viewDetailsDiscount && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150"
          role="dialog"
          aria-modal="true"
          aria-labelledby="details-dialog-title"
        >
          <div className="bg-surface rounded-2xl border border-neutral-200 shadow-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-bold bg-neutral-100 px-2 py-0.5 rounded border border-neutral-200">
                  {viewDetailsDiscount.code}
                </span>
                {renderStatusBadge(getDiscountStatus(viewDetailsDiscount))}
              </div>
              <button
                type="button"
                onClick={() => setViewDetailsDiscount(null)}
                aria-label="Close details"
                className="w-8 h-8 rounded-lg border border-neutral-200 flex items-center justify-center text-neutral-400 hover:text-neutral-700 cursor-pointer"
              >
                <XIcon size={16} />
              </button>
            </div>

            <div className="space-y-1">
              <h3 id="details-dialog-title" className="text-base font-bold text-neutral-900">
                {viewDetailsDiscount.name}
              </h3>
              {viewDetailsDiscount.description && (
                <p className="text-xs text-neutral-500 leading-relaxed">
                  {viewDetailsDiscount.description}
                </p>
              )}
            </div>

            <div className="p-3.5 rounded-xl bg-neutral-50 border border-neutral-200/80 grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-[10px] text-neutral-400 uppercase font-bold block">Discount Value</span>
                <span className="font-bold text-neutral-900 text-sm">
                  {viewDetailsDiscount.type === "percentage"
                    ? `${viewDetailsDiscount.value}% OFF`
                    : `₹${viewDetailsDiscount.value.toLocaleString("en-IN")} OFF`}
                </span>
              </div>

              <div>
                <span className="text-[10px] text-neutral-400 uppercase font-bold block">Discount Type</span>
                <span className="font-semibold text-neutral-800 capitalize">
                  {viewDetailsDiscount.type === "percentage" ? "Percentage Discount" : "Fixed Amount"}
                </span>
              </div>

              <div>
                <span className="text-[10px] text-neutral-400 uppercase font-bold block">Min Order Spend</span>
                <span className="font-semibold text-neutral-800">
                  {viewDetailsDiscount.minimumOrderValue
                    ? `₹${viewDetailsDiscount.minimumOrderValue.toLocaleString("en-IN")}`
                    : "No minimum"}
                </span>
              </div>

              {viewDetailsDiscount.type === "percentage" && viewDetailsDiscount.maximumDiscountAmount ? (
                <div>
                  <span className="text-[10px] text-neutral-400 uppercase font-bold block">Max Savings Cap</span>
                  <span className="font-semibold text-neutral-800">
                    ₹{viewDetailsDiscount.maximumDiscountAmount.toLocaleString("en-IN")}
                  </span>
                </div>
              ) : (
                <div>
                  <span className="text-[10px] text-neutral-400 uppercase font-bold block">Max Savings Cap</span>
                  <span className="font-semibold text-neutral-800">
                    No cap
                  </span>
                </div>
              )}

              <div>
                <span className="text-[10px] text-neutral-400 uppercase font-bold block">Usage / Redemptions</span>
                <span className="font-semibold text-neutral-800">
                  {viewDetailsDiscount.usageLimit !== null
                    ? `${viewDetailsDiscount.usageCount} / ${viewDetailsDiscount.usageLimit} redemptions`
                    : `${viewDetailsDiscount.usageCount} / Unlimited`}
                </span>
              </div>

              <div>
                <span className="text-[10px] text-neutral-400 uppercase font-bold block">Active Switch</span>
                <span className="font-semibold text-neutral-800 flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${viewDetailsDiscount.isActive ? "bg-primary" : "bg-neutral-400"}`} />
                  {viewDetailsDiscount.isActive ? "Enabled" : "Deactivated"}
                </span>
              </div>

              <div className="col-span-2">
                <span className="text-[10px] text-neutral-400 uppercase font-bold block">Validity Window</span>
                <span className="font-mono text-[11px] text-neutral-700">
                  {formatValidity(viewDetailsDiscount)}
                </span>
              </div>

              <div className="col-span-2 pt-1 border-t border-neutral-200/60">
                <span className="text-[10px] text-neutral-400 uppercase font-bold block mb-1">Applicable Scope</span>
                <div className="space-y-1.5">
                  <span className="font-semibold text-neutral-900 block">
                    {formatScopeLabel(viewDetailsDiscount)}
                  </span>
                  {viewDetailsDiscount.appliesTo !== "all" && (
                    <div className="flex flex-wrap gap-1.5 pt-0.5 max-h-28 overflow-y-auto pr-1">
                      {getResolvedScopeNames(viewDetailsDiscount).map((itemName, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 rounded-md bg-white border border-neutral-200 text-[11px] font-medium text-neutral-700 shadow-2xs"
                        >
                          {itemName}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-100">
              <Link
                href={`/admin/discounts/${encodeURIComponent(viewDetailsDiscount.code)}/edit`}
                className="px-4 py-2 rounded-xl bg-primary hover:bg-[#91BC7A] text-neutral-900 font-bold text-xs shadow-xs transition-all cursor-pointer"
              >
                Edit Discount
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
