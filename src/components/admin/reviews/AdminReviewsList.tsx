"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  AdminReview,
  ReviewStatus,
  getReviewMetrics,
} from "@/lib/admin-reviews";
import { getAllAdminProducts } from "@/lib/admin-catalog";
import { getAllAdminCustomers } from "@/lib/admin-customers";
import {
  SearchIcon,
  XIcon,
  MoreVerticalIcon,
  EyeIcon,
  EditIcon,
  CheckCircleIcon,
  AlertCircleIcon,
  StarIcon,
  BanIcon,
  ShieldAlertIcon,
  ClockIcon,
  PackageIcon,
  UserIcon,
  TrendingUpIcon,
  CalendarIcon,
  CheckIcon,
} from "../AdminIcons";
import { AdminReviewsSkeleton } from "./AdminReviewsSkeleton";

type RatingFilter = "ALL" | 1 | 2 | 3 | 4 | 5;
type PurchaseFilter = "ALL" | "VERIFIED" | "UNVERIFIED";
type DateFilter = "ALL" | "TODAY" | "7DAYS" | "30DAYS";

export function AdminReviewsList() {
  const [reviews, setReviews] = useState<AdminReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<"ALL" | ReviewStatus>("ALL");
  const [selectedRating, setSelectedRating] = useState<RatingFilter>("ALL");
  const [selectedPurchase, setSelectedPurchase] = useState<PurchaseFilter>("ALL");
  const [selectedDateRange, setSelectedDateRange] = useState<DateFilter>("ALL");

  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const [showSkeletonDemo, setShowSkeletonDemo] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Status transition modal state
  const [reviewToModerate, setReviewToModerate] = useState<AdminReview | null>(null);
  const [targetStatus, setTargetStatus] = useState<ReviewStatus>("approved");
  const [moderationNote, setModerationNote] = useState("");

  // Edit Note Modal state
  const [reviewToEditNote, setReviewToEditNote] = useState<AdminReview | null>(null);
  const [adminNoteInput, setAdminNoteInput] = useState("");

  const dropdownRef = useRef<HTMLDivElement | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  const fetchReviews = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/admin/reviews");
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          throw new Error("Admin authorization required to view reviews.");
        }
        throw new Error("Failed to load customer reviews.");
      }
      const data = await res.json();
      setReviews(data.reviews || []);
    } catch (err: any) {
      setError(err.message || "Failed to load reviews.");
    } finally {
      setLoading(false);
    }
  };

  // Sync reviews on mount from real API
  useEffect(() => {
    fetchReviews();
  }, []);

  // Outside click & ESC listeners
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpenDropdownId(null);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpenDropdownId(null);
        setReviewToModerate(null);
        setReviewToEditNote(null);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  // Compute live metrics dynamically
  const metrics = useMemo(() => {
    return getReviewMetrics(reviews);
  }, [reviews]);

  // Check if any filter is active
  const isFiltered =
    searchQuery.trim() !== "" ||
    selectedStatus !== "ALL" ||
    selectedRating !== "ALL" ||
    selectedPurchase !== "ALL" ||
    selectedDateRange !== "ALL";

  // Filter reset
  const handleClearAllFilters = () => {
    setSearchQuery("");
    setSelectedStatus("ALL");
    setSelectedRating("ALL");
    setSelectedPurchase("ALL");
    setSelectedDateRange("ALL");
  };

  // Product and Customer lookup maps for safe historical fallback
  const validProductSlugs = useMemo(() => {
    const prods = getAllAdminProducts();
    return new Set(prods.map((p) => p.slug));
  }, []);

  const validCustomerIds = useMemo(() => {
    const custs = getAllAdminCustomers();
    return new Set(custs.map((c) => c.id));
  }, []);

  // Composable filter logic
  const filteredReviews = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    const now = new Date();

    return reviews.filter((review) => {
      // 1. Instant Text Search across Product name, Customer name, Email, Review title, Comment
      if (q) {
        const prodMatch = review.productName.toLowerCase().includes(q);
        const custMatch = review.customerName.toLowerCase().includes(q);
        const emailMatch = review.customerEmail.toLowerCase().includes(q);
        const titleMatch = review.title.toLowerCase().includes(q);
        const commentMatch = review.comment.toLowerCase().includes(q);

        if (
          !prodMatch &&
          !custMatch &&
          !emailMatch &&
          !titleMatch &&
          !commentMatch
        ) {
          return false;
        }
      }

      // 2. Status Filter
      if (selectedStatus !== "ALL" && review.status !== selectedStatus) {
        return false;
      }

      // 3. Rating Filter
      if (selectedRating !== "ALL" && review.rating !== selectedRating) {
        return false;
      }

      // 4. Purchase Verification Filter
      if (selectedPurchase === "VERIFIED" && !review.verifiedPurchase) {
        return false;
      }
      if (selectedPurchase === "UNVERIFIED" && review.verifiedPurchase) {
        return false;
      }

      // 5. Date Filter (Timezone-safe)
      if (selectedDateRange !== "ALL") {
        const revDate = new Date(review.createdAt);
        if (isNaN(revDate.getTime())) return false;

        if (selectedDateRange === "TODAY") {
          const isToday =
            revDate.getDate() === now.getDate() &&
            revDate.getMonth() === now.getMonth() &&
            revDate.getFullYear() === now.getFullYear();
          if (!isToday) return false;
        } else if (selectedDateRange === "7DAYS") {
          const diffMs = now.getTime() - revDate.getTime();
          const diffDays = diffMs / (1000 * 60 * 60 * 24);
          if (diffDays > 7 || diffDays < 0) return false;
        } else if (selectedDateRange === "30DAYS") {
          const diffMs = now.getTime() - revDate.getTime();
          const diffDays = diffMs / (1000 * 60 * 60 * 24);
          if (diffDays > 30 || diffDays < 0) return false;
        }
      }

      return true;
    });
  }, [
    reviews,
    searchQuery,
    selectedStatus,
    selectedRating,
    selectedPurchase,
    selectedDateRange,
  ]);

  // Open moderation modal
  const handleOpenModerationModal = (
    review: AdminReview,
    status: ReviewStatus
  ) => {
    setOpenDropdownId(null);
    setReviewToModerate(review);
    setTargetStatus(status);
    setModerationNote(review.adminNote || "");
  };

  // Confirm moderation status update via API
  const handleConfirmModeration = async () => {
    if (!reviewToModerate) return;

    try {
      const res = await fetch(`/api/admin/reviews/${reviewToModerate.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: targetStatus,
          adminNote: moderationNote.trim() || undefined,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to update review status");
      }

      const data = await res.json();
      if (data.ok && data.review) {
        setReviews((prev) =>
          prev.map((r) => (r.id === data.review.id ? data.review : r))
        );
        showToast(
          `Review marked as ${targetStatus.toUpperCase()}`
        );
      }
    } catch (err: any) {
      showToast(err.message || "Failed to update review status");
    } finally {
      setReviewToModerate(null);
    }
  };

  // Open Edit Note Modal
  const handleOpenEditNote = (review: AdminReview) => {
    setOpenDropdownId(null);
    setReviewToEditNote(review);
    setAdminNoteInput(review.adminNote || "");
  };

  // Save Admin Note via API
  const handleSaveAdminNote = async () => {
    if (!reviewToEditNote) return;

    try {
      const res = await fetch(`/api/admin/reviews/${reviewToEditNote.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adminNote: adminNoteInput.trim() || undefined,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to update admin note");
      }

      const data = await res.json();
      if (data.ok && data.review) {
        setReviews((prev) =>
          prev.map((r) => (r.id === data.review.id ? data.review : r))
        );
        showToast("Admin moderation note updated");
      }
    } catch (err: any) {
      showToast(err.message || "Failed to update admin note");
    } finally {
      setReviewToEditNote(null);
    }
  };

  // Helper date formatter
  const formatDate = (isoString?: string) => {
    if (!isoString) return "Unknown";
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return isoString;
      return d.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    } catch {
      return isoString;
    }
  };

  // Render Status Badge
  const renderStatusBadge = (status: ReviewStatus) => {
    switch (status) {
      case "approved":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
            <CheckCircleIcon size={12} className="text-emerald-600 shrink-0" />
            <span>Approved</span>
          </span>
        );
      case "pending":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
            <ClockIcon size={12} className="text-amber-600 shrink-0" />
            <span>Pending</span>
          </span>
        );
      case "flagged":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-50 text-purple-800 border border-purple-200">
            <ShieldAlertIcon size={12} className="text-purple-600 shrink-0" />
            <span>Flagged</span>
          </span>
        );
      case "rejected":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-800 border border-rose-200">
            <BanIcon size={12} className="text-rose-600 shrink-0" />
            <span>Rejected</span>
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-neutral-100 text-neutral-600 capitalize">
            {status}
          </span>
        );
    }
  };

  // Render Star Rating with accessible text
  const renderStarRating = (rating: number) => {
    return (
      <div
        className="flex items-center gap-1"
        aria-label={`${rating} out of 5 stars`}
        title={`${rating} out of 5 stars`}
      >
        <div className="flex items-center gap-0.5 text-amber-400">
          {[1, 2, 3, 4, 5].map((star) => (
            <StarIcon
              key={star}
              size={13}
              className={
                star <= rating
                  ? "fill-amber-400 text-amber-400"
                  : "text-neutral-200 fill-neutral-100"
              }
            />
          ))}
        </div>
        <span className="text-[11px] font-bold text-neutral-700 ml-1">
          {rating}.0
        </span>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-6 right-6 z-50 bg-neutral-900 text-white text-xs font-semibold px-4 py-3 rounded-xl shadow-2xl border border-neutral-700 animate-in slide-in-from-bottom-2 duration-200 flex items-center gap-2"
        >
          <CheckCircleIcon size={16} className="text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-neutral-900 tracking-tight">
            Reviews & Ratings
          </h1>
          <p className="text-xs sm:text-sm text-neutral-500 mt-1">
            Moderate customer product feedback, review ratings, and manage publication queues.
          </p>
        </div>

        {/* Skeleton Toggle */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowSkeletonDemo(!showSkeletonDemo)}
            className="text-[11px] font-semibold text-neutral-400 hover:text-neutral-700 px-2.5 py-1.5 rounded-lg border border-dashed border-neutral-300 hover:bg-neutral-50 transition-colors cursor-pointer"
            title="Preview skeleton loading state"
          >
            {showSkeletonDemo ? "Hide Skeleton" : "Preview Skeleton"}
          </button>
        </div>
      </div>

      {loading || showSkeletonDemo ? (
        <AdminReviewsSkeleton />
      ) : error ? (
        <div className="p-8 rounded-2xl bg-surface border border-rose-200 text-center space-y-3">
          <div className="w-10 h-10 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
            <AlertCircleIcon size={20} />
          </div>
          <div className="space-y-1">
            <h3 className="font-display text-sm font-bold text-neutral-900">
              Failed to load reviews
            </h3>
            <p className="text-xs text-neutral-500 max-w-sm mx-auto">{error}</p>
          </div>
          <button
            type="button"
            onClick={() => fetchReviews()}
            className="px-4 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-bold transition-all cursor-pointer shadow-2xs"
          >
            Retry Loading
          </button>
        </div>
      ) : (
        <>
          {/* ====================================================================
              1. REVIEW METRIC CARDS (6 CARDS)
              ==================================================================== */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
            {/* Total Reviews */}
            <div className="p-4 rounded-2xl bg-surface border border-neutral-200/80 shadow-2xs space-y-1">
              <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider block">
                Total
              </span>
              <div className="text-2xl font-display font-bold text-neutral-900">
                {metrics.totalReviews}
              </div>
              <div className="text-[11px] text-neutral-500 font-medium">
                All submissions
              </div>
            </div>

            {/* Pending Reviews */}
            <div className="p-4 rounded-2xl bg-surface border border-neutral-200/80 shadow-2xs space-y-1">
              <span className="text-[11px] font-bold text-amber-600 uppercase tracking-wider block">
                Pending
              </span>
              <div className="text-2xl font-display font-bold text-neutral-900">
                {metrics.pendingReviews}
              </div>
              <div className="text-[11px] text-neutral-500 font-medium">
                Needs moderation
              </div>
            </div>

            {/* Approved Reviews */}
            <div className="p-4 rounded-2xl bg-surface border border-neutral-200/80 shadow-2xs space-y-1">
              <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider block">
                Approved
              </span>
              <div className="text-2xl font-display font-bold text-neutral-900">
                {metrics.approvedReviews}
              </div>
              <div className="text-[11px] text-neutral-500 font-medium">
                Ready for publish
              </div>
            </div>

            {/* Flagged Reviews */}
            <div className="p-4 rounded-2xl bg-surface border border-neutral-200/80 shadow-2xs space-y-1">
              <span className="text-[11px] font-bold text-purple-600 uppercase tracking-wider block">
                Flagged
              </span>
              <div className="text-2xl font-display font-bold text-neutral-900">
                {metrics.flaggedReviews}
              </div>
              <div className="text-[11px] text-neutral-500 font-medium">
                Spam or alerts
              </div>
            </div>

            {/* Average Rating */}
            <div className="p-4 rounded-2xl bg-surface border border-neutral-200/80 shadow-2xs space-y-1">
              <span className="text-[11px] font-bold text-amber-500 uppercase tracking-wider block">
                Avg Rating
              </span>
              <div className="text-2xl font-display font-bold text-neutral-900 flex items-center gap-1">
                <span>{metrics.averageRating}</span>
                <StarIcon size={18} className="fill-amber-400 text-amber-400" />
              </div>
              <div className="text-[11px] text-neutral-500 font-medium">
                Overall score
              </div>
            </div>

            {/* Verified Purchases */}
            <div className="p-4 rounded-2xl bg-surface border border-neutral-200/80 shadow-2xs space-y-1">
              <span className="text-[11px] font-bold text-blue-600 uppercase tracking-wider block">
                Verified
              </span>
              <div className="text-2xl font-display font-bold text-neutral-900">
                {metrics.verifiedPurchases}
              </div>
              <div className="text-[11px] text-neutral-500 font-medium">
                Confirmed buyers
              </div>
            </div>
          </div>

          {/* ====================================================================
              2. SEARCH & COMPOSABLE FILTERS TOOLBAR
              ==================================================================== */}
          <div className="p-4 rounded-2xl bg-surface border border-neutral-200/80 shadow-2xs space-y-3">
            <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3">
              {/* Search Bar */}
              <div className="relative flex-1">
                <SearchIcon
                  size={16}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none"
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search product, customer, email, title, or review text..."
                  aria-label="Search reviews"
                  className="w-full h-10 pl-10 pr-9 rounded-xl border border-neutral-200 bg-canvas text-xs text-neutral-800 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    aria-label="Clear review search query"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700 cursor-pointer"
                  >
                    <XIcon size={14} />
                  </button>
                )}
              </div>

              {/* Composable Filters Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {/* 1. Status Filter */}
                <select
                  value={selectedStatus}
                  onChange={(e) =>
                    setSelectedStatus(e.target.value as "ALL" | ReviewStatus)
                  }
                  aria-label="Filter by review status"
                  className="h-10 px-3 rounded-xl border border-neutral-200 bg-canvas text-xs font-semibold text-neutral-700 focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                  <option value="flagged">Flagged</option>
                </select>

                {/* 2. Rating Filter */}
                <select
                  value={selectedRating}
                  onChange={(e) =>
                    setSelectedRating(
                      e.target.value === "ALL"
                        ? "ALL"
                        : (Number(e.target.value) as RatingFilter)
                    )
                  }
                  aria-label="Filter by star rating"
                  className="h-10 px-3 rounded-xl border border-neutral-200 bg-canvas text-xs font-semibold text-neutral-700 focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer"
                >
                  <option value="ALL">All Ratings</option>
                  <option value="5">5 Stars</option>
                  <option value="4">4 Stars</option>
                  <option value="3">3 Stars</option>
                  <option value="2">2 Stars</option>
                  <option value="1">1 Star</option>
                </select>

                {/* 3. Purchase Verification Filter */}
                <select
                  value={selectedPurchase}
                  onChange={(e) =>
                    setSelectedPurchase(e.target.value as PurchaseFilter)
                  }
                  aria-label="Filter by purchase verification"
                  className="h-10 px-3 rounded-xl border border-neutral-200 bg-canvas text-xs font-semibold text-neutral-700 focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer"
                >
                  <option value="ALL">All Purchases</option>
                  <option value="VERIFIED">Verified Purchase</option>
                  <option value="UNVERIFIED">Unverified</option>
                </select>

                {/* 4. Date Filter */}
                <select
                  value={selectedDateRange}
                  onChange={(e) =>
                    setSelectedDateRange(e.target.value as DateFilter)
                  }
                  aria-label="Filter by submission date"
                  className="h-10 px-3 rounded-xl border border-neutral-200 bg-canvas text-xs font-semibold text-neutral-700 focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer"
                >
                  <option value="ALL">All Time</option>
                  <option value="TODAY">Today</option>
                  <option value="7DAYS">Last 7 Days</option>
                  <option value="30DAYS">Last 30 Days</option>
                </select>
              </div>
            </div>

            {/* Results count & Clear button */}
            <div className="flex items-center justify-between text-xs text-neutral-500 pt-1">
              <div>
                Showing{" "}
                <span className="font-bold text-neutral-800">
                  {filteredReviews.length}
                </span>{" "}
                of{" "}
                <span className="font-bold text-neutral-800">
                  {reviews.length}
                </span>{" "}
                reviews
              </div>

              {isFiltered && (
                <button
                  type="button"
                  onClick={handleClearAllFilters}
                  className="font-bold text-primary-dark hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <XIcon size={12} />
                  <span>Clear all filters</span>
                </button>
              )}
            </div>
          </div>

          {/* ====================================================================
              3. REVIEWS TABLE (DESKTOP) / CARDS (MOBILE)
              ==================================================================== */}
          {filteredReviews.length === 0 ? (
            <div className="p-12 rounded-2xl bg-surface border border-neutral-200/80 text-center space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-neutral-100 text-neutral-400 flex items-center justify-center mx-auto">
                <StarIcon size={24} />
              </div>
              <div className="space-y-1">
                <h3 className="font-display text-base font-bold text-neutral-800">
                  {reviews.length === 0 ? "No reviews yet" : "No reviews found"}
                </h3>
                <p className="text-xs text-neutral-500 max-w-sm mx-auto">
                  {reviews.length === 0
                    ? "Customer reviews submitted for moderation will appear here."
                    : "Try adjusting your search query or filter criteria."}
                </p>
              </div>
              {isFiltered && (
                <button
                  type="button"
                  onClick={handleClearAllFilters}
                  className="px-4 py-2 rounded-xl bg-primary hover:bg-[#91BC7A] text-neutral-900 text-xs font-bold transition-all cursor-pointer shadow-2xs"
                >
                  Clear all filters
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Desktop Table (>= 1024px) */}
              <div className="hidden lg:block rounded-2xl bg-surface border border-neutral-200/80 shadow-2xs overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-neutral-200/80 bg-neutral-50/75 text-[11px] font-bold uppercase tracking-wider text-neutral-500 select-none">
                      <th className="py-3.5 pl-6 pr-4">Review Content</th>
                      <th className="py-3.5 px-4">Product</th>
                      <th className="py-3.5 px-4">Customer</th>
                      <th className="py-3.5 px-4">Rating</th>
                      <th className="py-3.5 px-4 text-center">Purchase</th>
                      <th className="py-3.5 px-4">Date</th>
                      <th className="py-3.5 px-4">Status</th>
                      <th className="py-3.5 pl-4 pr-6 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100 text-xs">
                    {filteredReviews.map((review) => {
                      const isDropdownOpen = openDropdownId === review.id;
                      const hasValidProduct = validProductSlugs.has(review.productSlug);
                      const hasValidCustomer = validCustomerIds.has(review.customerId);

                      return (
                        <tr
                          key={review.id}
                          className="hover:bg-neutral-50/60 transition-colors group"
                        >
                          {/* Review Title & Comment */}
                          <td className="py-4 pl-6 pr-4 max-w-xs">
                            <div className="space-y-1">
                              <Link
                                href={`/admin/reviews/${review.id}`}
                                className="font-bold text-neutral-900 hover:text-primary-dark transition-colors block text-xs line-clamp-1"
                              >
                                {review.title}
                              </Link>
                              <p className="text-[11px] text-neutral-500 line-clamp-2 leading-relaxed">
                                &ldquo;{review.comment}&rdquo;
                              </p>
                              {review.adminNote && (
                                <span className="inline-block text-[10px] bg-neutral-100 text-neutral-600 px-1.5 py-0.5 rounded border border-neutral-200/80 truncate max-w-full">
                                  Note: {review.adminNote}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Product */}
                          <td className="py-4 px-4 max-w-[200px]">
                            {hasValidProduct ? (
                              <Link
                                href={`/admin/products/${review.productSlug}/edit`}
                                className="flex items-center gap-2 group/prod"
                              >
                                {review.productImage ? (
                                  <div className="w-8 h-8 rounded-lg bg-neutral-100 overflow-hidden relative shrink-0 border border-neutral-200/60">
                                    <Image
                                      src={review.productImage}
                                      alt={review.productName}
                                      fill
                                      className="object-cover"
                                      sizes="32px"
                                    />
                                  </div>
                                ) : (
                                  <div className="w-8 h-8 rounded-lg bg-neutral-100 flex items-center justify-center text-neutral-400 shrink-0">
                                    <PackageIcon size={14} />
                                  </div>
                                )}
                                <span className="font-medium text-neutral-800 group-hover/prod:text-primary-dark transition-colors line-clamp-2 text-xs">
                                  {review.productName}
                                </span>
                              </Link>
                            ) : (
                              <span className="text-neutral-400 italic text-[11px]">
                                Product unavailable
                              </span>
                            )}
                          </td>

                          {/* Customer */}
                          <td className="py-4 px-4 max-w-[160px]">
                            {hasValidCustomer ? (
                              <div className="space-y-0.5">
                                <Link
                                  href={`/admin/customers/${review.customerId}`}
                                  className="font-bold text-neutral-900 hover:text-primary-dark transition-colors block truncate"
                                >
                                  {review.customerName}
                                </Link>
                                <span className="text-[11px] text-neutral-400 truncate block">
                                  {review.customerEmail}
                                </span>
                              </div>
                            ) : (
                              <div className="space-y-0.5">
                                <span className="font-bold text-neutral-700 block truncate">
                                  {review.customerName}
                                </span>
                                <span className="text-[10px] text-neutral-400 italic block">
                                  Customer unavailable
                                </span>
                              </div>
                            )}
                          </td>

                          {/* Rating */}
                          <td className="py-4 px-4 whitespace-nowrap">
                            {renderStarRating(review.rating)}
                          </td>

                          {/* Purchase Verification */}
                          <td className="py-4 px-4 text-center whitespace-nowrap">
                            {review.verifiedPurchase ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                <CheckIcon size={12} className="text-emerald-600" />
                                <span>Verified</span>
                              </span>
                            ) : (
                              <span className="text-[11px] font-medium text-neutral-400">
                                Unverified
                              </span>
                            )}
                          </td>

                          {/* Date */}
                          <td className="py-4 px-4 font-mono text-[11px] text-neutral-600 whitespace-nowrap">
                            {formatDate(review.createdAt)}
                          </td>

                          {/* Status */}
                          <td className="py-4 px-4 whitespace-nowrap">
                            {renderStatusBadge(review.status)}
                          </td>

                          {/* Actions */}
                          <td className="py-4 pl-4 pr-6 text-right relative whitespace-nowrap">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenDropdownId(
                                  isDropdownOpen ? null : review.id
                                );
                              }}
                              aria-label={`Moderation actions for review ${review.id}`}
                              aria-expanded={isDropdownOpen}
                              className="w-8 h-8 rounded-lg border border-neutral-200 hover:bg-neutral-100 inline-flex items-center justify-center text-neutral-600 transition-colors cursor-pointer"
                            >
                              <MoreVerticalIcon size={16} />
                            </button>

                            {/* Dropdown Menu */}
                            {isDropdownOpen && (
                              <div
                                ref={dropdownRef}
                                className="absolute right-6 top-12 z-40 w-44 rounded-xl bg-white border border-neutral-200 shadow-xl p-1.5 space-y-0.5 text-left animate-in fade-in zoom-in-95 duration-100"
                              >
                                <Link
                                  href={`/admin/reviews/${review.id}`}
                                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900 transition-colors cursor-pointer"
                                >
                                  <EyeIcon size={14} className="text-neutral-400" />
                                  <span>View Review</span>
                                </Link>

                                {review.status !== "approved" && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleOpenModerationModal(review, "approved")
                                    }
                                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-emerald-700 hover:bg-emerald-50 transition-colors cursor-pointer"
                                  >
                                    <CheckCircleIcon size={14} className="text-emerald-500" />
                                    <span>Approve</span>
                                  </button>
                                )}

                                {review.status !== "rejected" && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleOpenModerationModal(review, "rejected")
                                    }
                                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-rose-700 hover:bg-rose-50 transition-colors cursor-pointer"
                                  >
                                    <BanIcon size={14} className="text-rose-500" />
                                    <span>Reject</span>
                                  </button>
                                )}

                                {review.status !== "flagged" && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleOpenModerationModal(review, "flagged")
                                    }
                                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-purple-700 hover:bg-purple-50 transition-colors cursor-pointer"
                                  >
                                    <ShieldAlertIcon size={14} className="text-purple-500" />
                                    <span>Flag as Spam</span>
                                  </button>
                                )}

                                <div className="border-t border-neutral-100 my-1" />

                                <button
                                  type="button"
                                  onClick={() => handleOpenEditNote(review)}
                                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-neutral-700 hover:bg-neutral-100 transition-colors cursor-pointer"
                                >
                                  <EditIcon size={14} className="text-neutral-400" />
                                  <span>Edit Admin Note</span>
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

              {/* Mobile Review Cards (< 1024px) */}
              <div className="lg:hidden space-y-3">
                {filteredReviews.map((review) => {
                  const isDropdownOpen = openDropdownId === review.id;
                  const hasValidProduct = validProductSlugs.has(review.productSlug);
                  const hasValidCustomer = validCustomerIds.has(review.customerId);

                  return (
                    <div
                      key={review.id}
                      className="p-4 rounded-2xl bg-surface border border-neutral-200/80 shadow-2xs space-y-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1">
                          <Link
                            href={`/admin/reviews/${review.id}`}
                            className="font-bold text-sm text-neutral-900 block hover:text-primary-dark"
                          >
                            {review.title}
                          </Link>
                          {renderStarRating(review.rating)}
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {renderStatusBadge(review.status)}

                          {/* 3-Dot Mobile Action Trigger (>= 44px) */}
                          <div className="relative">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenDropdownId(
                                  isDropdownOpen ? null : review.id
                                );
                              }}
                              aria-label={`Moderation actions for review ${review.id}`}
                              className="w-11 h-11 rounded-lg border border-neutral-200 hover:bg-neutral-100 flex items-center justify-center text-neutral-600 cursor-pointer"
                            >
                              <MoreVerticalIcon size={16} />
                            </button>

                            {/* Dropdown Menu */}
                            {isDropdownOpen && (
                              <div
                                ref={dropdownRef}
                                className="absolute right-0 top-12 z-40 w-44 rounded-xl bg-white border border-neutral-200 shadow-xl p-1.5 space-y-0.5 text-left"
                              >
                                <Link
                                  href={`/admin/reviews/${review.id}`}
                                  className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-semibold text-neutral-700 hover:bg-neutral-100 cursor-pointer"
                                >
                                  <EyeIcon size={14} />
                                  <span>View Review</span>
                                </Link>

                                {review.status !== "approved" && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleOpenModerationModal(review, "approved")
                                    }
                                    className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-semibold text-emerald-700 hover:bg-emerald-50 cursor-pointer"
                                  >
                                    <CheckCircleIcon size={14} />
                                    <span>Approve</span>
                                  </button>
                                )}

                                {review.status !== "rejected" && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleOpenModerationModal(review, "rejected")
                                    }
                                    className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-semibold text-rose-700 hover:bg-rose-50 cursor-pointer"
                                  >
                                    <BanIcon size={14} />
                                    <span>Reject</span>
                                  </button>
                                )}

                                {review.status !== "flagged" && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleOpenModerationModal(review, "flagged")
                                    }
                                    className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-semibold text-purple-700 hover:bg-purple-50 cursor-pointer"
                                  >
                                    <ShieldAlertIcon size={14} />
                                    <span>Flag as Spam</span>
                                  </button>
                                )}

                                <button
                                  type="button"
                                  onClick={() => handleOpenEditNote(review)}
                                  className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-semibold text-neutral-700 hover:bg-neutral-100 cursor-pointer"
                                >
                                  <EditIcon size={14} />
                                  <span>Edit Admin Note</span>
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Comment text */}
                      <p className="text-xs text-neutral-600 line-clamp-3 leading-relaxed">
                        &ldquo;{review.comment}&rdquo;
                      </p>

                      {/* Product and Customer Info */}
                      <div className="pt-2 border-t border-neutral-100 space-y-1.5 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] uppercase font-bold text-neutral-400">
                            Product
                          </span>
                          {hasValidProduct ? (
                            <Link
                              href={`/admin/products/${review.productSlug}/edit`}
                              className="font-medium text-neutral-800 hover:text-primary-dark truncate max-w-[200px]"
                            >
                              {review.productName}
                            </Link>
                          ) : (
                            <span className="text-neutral-400 italic">
                              Product unavailable
                            </span>
                          )}
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-[10px] uppercase font-bold text-neutral-400">
                            Customer
                          </span>
                          {hasValidCustomer ? (
                            <Link
                              href={`/admin/customers/${review.customerId}`}
                              className="font-medium text-neutral-800 hover:text-primary-dark truncate max-w-[200px]"
                            >
                              {review.customerName}
                            </Link>
                          ) : (
                            <span className="text-neutral-600">
                              {review.customerName}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center justify-between pt-1">
                          <span className="font-mono text-[11px] text-neutral-500">
                            {formatDate(review.createdAt)}
                          </span>
                          {review.verifiedPurchase ? (
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                              Verified Purchase
                            </span>
                          ) : (
                            <span className="text-[10px] text-neutral-400">
                              Unverified
                            </span>
                          )}
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
          4. MODERATION CONFIRMATION MODAL
          ==================================================================== */}
      {reviewToModerate && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150"
          role="dialog"
          aria-modal="true"
          aria-labelledby="moderation-modal-title"
        >
          <div className="bg-surface rounded-2xl border border-neutral-200 shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-bold bg-neutral-100 px-2 py-0.5 rounded border border-neutral-200">
                  {reviewToModerate.id}
                </span>
                <span className="text-xs text-neutral-500">
                  Review Moderation
                </span>
              </div>
              <button
                type="button"
                onClick={() => setReviewToModerate(null)}
                aria-label="Close moderation modal"
                className="w-8 h-8 rounded-lg border border-neutral-200 flex items-center justify-center text-neutral-400 hover:text-neutral-700 cursor-pointer"
              >
                <XIcon size={16} />
              </button>
            </div>

            <div className="space-y-1">
              <h3
                id="moderation-modal-title"
                className="text-base font-bold text-neutral-900"
              >
                {targetStatus === "approved"
                  ? "Approve Review"
                  : targetStatus === "rejected"
                  ? "Reject Review"
                  : "Flag Review as Spam"}
              </h3>
              <p className="text-xs text-neutral-500">
                You are updating the status of this review for{" "}
                <span className="font-bold text-neutral-800">
                  {reviewToModerate.productName}
                </span>{" "}
                to{" "}
                <span className="font-bold uppercase text-neutral-900">
                  {targetStatus}
                </span>
                .
              </p>
            </div>

            {/* Operational Explanations */}
            {targetStatus === "approved" && (
              <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950 text-xs flex items-start gap-2.5">
                <CheckCircleIcon size={18} className="text-emerald-600 shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  Approving this review will make it eligible for future storefront display once the real review backend is connected.
                </p>
              </div>
            )}

            {targetStatus === "rejected" && (
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-950 text-xs flex items-start gap-2.5">
                <BanIcon size={18} className="text-rose-600 shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  Rejecting this review will hide it from customer-facing channels while keeping the historical record in your admin log.
                </p>
              </div>
            )}

            {targetStatus === "flagged" && (
              <div className="p-3.5 rounded-xl bg-purple-50 border border-purple-200 text-purple-950 text-xs flex items-start gap-2.5">
                <ShieldAlertIcon size={18} className="text-purple-600 shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  Flagging marks this review for security and anti-spam verification before any potential publication.
                </p>
              </div>
            )}

            {/* Internal Admin Note */}
            <div className="space-y-1.5 pt-1">
              <label
                htmlFor="moderation-reason-input"
                className="block text-xs font-semibold text-neutral-700"
              >
                Admin Moderation Note{" "}
                <span className="text-neutral-400 font-normal">(internal only)</span>
              </label>
              <textarea
                id="moderation-reason-input"
                rows={2}
                value={moderationNote}
                onChange={(e) => setModerationNote(e.target.value)}
                placeholder="Add internal notes about why this review was approved, rejected, or flagged..."
                className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-xs text-neutral-800 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-neutral-100">
              <button
                type="button"
                onClick={() => setReviewToModerate(null)}
                className="px-4 py-2 rounded-xl border border-neutral-200 text-xs font-semibold text-neutral-700 hover:bg-neutral-100 transition-colors cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleConfirmModeration}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs ${
                  targetStatus === "approved"
                    ? "bg-primary hover:bg-[#91BC7A] text-neutral-900"
                    : targetStatus === "rejected"
                    ? "bg-rose-600 hover:bg-rose-700 text-white"
                    : "bg-purple-600 hover:bg-purple-700 text-white"
                }`}
              >
                Confirm {targetStatus.toUpperCase()}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================
          5. EDIT ADMIN NOTE MODAL
          ==================================================================== */}
      {reviewToEditNote && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150"
          role="dialog"
          aria-modal="true"
          aria-labelledby="note-modal-title"
        >
          <div className="bg-surface rounded-2xl border border-neutral-200 shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <span className="font-bold text-sm text-neutral-900">
                Edit Admin Moderation Note
              </span>
              <button
                type="button"
                onClick={() => setReviewToEditNote(null)}
                aria-label="Close note modal"
                className="w-8 h-8 rounded-lg border border-neutral-200 flex items-center justify-center text-neutral-400 hover:text-neutral-700"
              >
                <XIcon size={16} />
              </button>
            </div>

            <div className="space-y-1">
              <h3 id="note-modal-title" className="text-xs font-bold text-neutral-700">
                Review: {reviewToEditNote.title}
              </h3>
              <p className="text-xs text-neutral-500">
                Internal remarks are visible only to the Dearr operations team.
              </p>
            </div>

            <textarea
              rows={4}
              value={adminNoteInput}
              onChange={(e) => setAdminNoteInput(e.target.value)}
              placeholder="e.g. Verified photo from WhatsApp inquiry; customer requested size recommendation..."
              className="w-full p-3 rounded-xl border border-neutral-200 text-xs text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary resize-none"
            />

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-100">
              <button
                type="button"
                onClick={() => setReviewToEditNote(null)}
                className="px-4 py-2 rounded-xl border border-neutral-200 text-xs font-semibold text-neutral-700 hover:bg-neutral-100 cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleSaveAdminNote}
                className="px-4 py-2 rounded-xl bg-primary hover:bg-[#91BC7A] text-neutral-900 text-xs font-bold cursor-pointer shadow-xs"
              >
                Save Note
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
