"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  AdminReview,
  ReviewStatus,
  getAdminReviewById,
  updateAdminReviewStatus,
} from "@/lib/admin-reviews";
import { getAllAdminProducts } from "@/lib/admin-catalog";
import { getAllAdminCustomers } from "@/lib/admin-customers";
import {
  ArrowLeftIcon,
  CheckCircleIcon,
  AlertCircleIcon,
  StarIcon,
  BanIcon,
  ShieldAlertIcon,
  ClockIcon,
  PackageIcon,
  UserIcon,
  EditIcon,
  XIcon,
  CheckIcon,
  ExternalLinkIcon,
} from "../AdminIcons";
import { AdminReviewNotFound } from "./AdminReviewNotFound";

interface AdminReviewDetailsProps {
  reviewId: string;
  initialReview?: AdminReview | null;
}

export function AdminReviewDetails({
  reviewId,
  initialReview,
}: AdminReviewDetailsProps) {
  const [review, setReview] = useState<AdminReview | null>(
    initialReview ?? null
  );
  const [loading, setLoading] = useState(!initialReview);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Status moderation modal state
  const [showModerationModal, setShowModerationModal] = useState(false);
  const [targetStatus, setTargetStatus] = useState<ReviewStatus>("approved");
  const [moderationReason, setModerationReason] = useState("");

  // Edit Admin Note modal state
  const [showEditNoteModal, setShowEditNoteModal] = useState(false);
  const [adminNoteInput, setAdminNoteInput] = useState("");

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  useEffect(() => {
    const found = getAdminReviewById(reviewId);
    setReview(found);
    setLoading(false);
  }, [reviewId]);

  // Product validation
  const matchedProduct = useMemo(() => {
    if (!review) return null;
    const prods = getAllAdminProducts();
    return prods.find((p) => p.slug === review.productSlug) ?? null;
  }, [review]);

  // Customer validation
  const matchedCustomer = useMemo(() => {
    if (!review) return null;
    const custs = getAllAdminCustomers();
    return custs.find((c) => c.id === review.customerId) ?? null;
  }, [review]);

  const handleOpenModeration = (st: ReviewStatus) => {
    setTargetStatus(st);
    setModerationReason(review?.adminNote || "");
    setShowModerationModal(true);
  };

  const handleConfirmModeration = () => {
    if (!review) return;
    const updated = updateAdminReviewStatus(
      review.id,
      targetStatus,
      moderationReason.trim() || undefined
    );
    if (updated) {
      setReview(updated);
      showToast(`Review status updated to ${targetStatus.toUpperCase()}`);
    }
    setShowModerationModal(false);
  };

  const handleOpenEditNote = () => {
    if (!review) return;
    setAdminNoteInput(review.adminNote || "");
    setShowEditNoteModal(true);
  };

  const handleSaveAdminNote = () => {
    if (!review) return;
    const updated = updateAdminReviewStatus(
      review.id,
      review.status,
      adminNoteInput.trim() || undefined
    );
    if (updated) {
      setReview(updated);
      showToast("Admin note saved");
    }
    setShowEditNoteModal(false);
  };

  const formatDate = (isoString?: string) => {
    if (!isoString) return "Unknown";
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return isoString;
      return d.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return isoString;
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-6 w-36 bg-neutral-200 rounded" />
        <div className="h-44 bg-surface rounded-2xl border border-neutral-200" />
      </div>
    );
  }

  if (!review) {
    return <AdminReviewNotFound reviewId={reviewId} />;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Toast */}
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

      {/* Top Breadcrumb & Actions */}
      <div className="flex items-center justify-between gap-4">
        <Link
          href="/admin/reviews"
          className="inline-flex items-center gap-2 text-xs font-bold text-neutral-500 hover:text-neutral-900 transition-colors"
        >
          <ArrowLeftIcon size={14} />
          <span>Back to Reviews</span>
        </Link>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {review.status !== "approved" && (
            <button
              type="button"
              onClick={() => handleOpenModeration("approved")}
              className="px-3.5 py-1.5 rounded-xl bg-primary hover:bg-[#91BC7A] text-neutral-900 font-bold text-xs shadow-xs transition-all cursor-pointer"
            >
              Approve Review
            </button>
          )}

          {review.status !== "rejected" && (
            <button
              type="button"
              onClick={() => handleOpenModeration("rejected")}
              className="px-3.5 py-1.5 rounded-xl border border-rose-200 text-rose-700 hover:bg-rose-50 font-semibold text-xs transition-all cursor-pointer"
            >
              Reject Review
            </button>
          )}

          {review.status !== "flagged" && (
            <button
              type="button"
              onClick={() => handleOpenModeration("flagged")}
              className="px-3.5 py-1.5 rounded-xl border border-purple-200 text-purple-700 hover:bg-purple-50 font-semibold text-xs transition-all cursor-pointer"
            >
              Flag as Spam
            </button>
          )}
        </div>
      </div>

      {/* ====================================================================
          1. MAIN REVIEW CARD
          ==================================================================== */}
      <div className="p-6 rounded-2xl bg-surface border border-neutral-200/80 shadow-2xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-100 pb-4">
          <div className="space-y-1">
            <span className="font-mono text-xs text-neutral-400 bg-neutral-100 px-2 py-0.5 rounded border border-neutral-200">
              {review.id}
            </span>
            <h1 className="font-display text-xl sm:text-2xl font-bold text-neutral-900">
              {review.title}
            </h1>
          </div>

          <div className="flex items-center gap-2">
            {review.status === "approved" ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                <CheckCircleIcon size={13} className="text-emerald-600" />
                <span>Approved</span>
              </span>
            ) : review.status === "pending" ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
                <ClockIcon size={13} className="text-amber-600" />
                <span>Pending Moderation</span>
              </span>
            ) : review.status === "flagged" ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-purple-50 text-purple-800 border border-purple-200">
                <ShieldAlertIcon size={13} className="text-purple-600" />
                <span>Flagged</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-800 border border-rose-200">
                <BanIcon size={13} className="text-rose-600" />
                <span>Rejected</span>
              </span>
            )}
          </div>
        </div>

        {/* Rating and Verification Row */}
        <div className="flex items-center justify-between gap-4 flex-wrap text-xs">
          <div
            className="flex items-center gap-2"
            aria-label={`${review.rating} out of 5 stars`}
          >
            <div className="flex items-center gap-0.5 text-amber-400">
              {[1, 2, 3, 4, 5].map((star) => (
                <StarIcon
                  key={star}
                  size={18}
                  className={
                    star <= review.rating
                      ? "fill-amber-400 text-amber-400"
                      : "text-neutral-200 fill-neutral-100"
                  }
                />
              ))}
            </div>
            <span className="font-bold text-neutral-800 text-sm">
              {review.rating} out of 5 stars
            </span>
          </div>

          <div className="flex items-center gap-3">
            {review.verifiedPurchase ? (
              <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                <CheckIcon size={13} className="text-emerald-600" />
                <span>Verified Buyer Purchase</span>
              </span>
            ) : (
              <span className="text-xs font-medium text-neutral-400">
                Unverified Review
              </span>
            )}
            <span className="text-neutral-400">•</span>
            <span className="text-neutral-500 font-mono text-[11px]">
              Submitted {formatDate(review.createdAt)}
            </span>
          </div>
        </div>

        {/* Review Comment Body */}
        <div className="p-4 rounded-xl bg-neutral-50 border border-neutral-200/70 text-xs sm:text-sm text-neutral-800 leading-relaxed font-sans">
          &ldquo;{review.comment}&rdquo;
        </div>
      </div>

      {/* ====================================================================
          2. ASSOCIATED PRODUCT & CUSTOMER METRICS (2 COLUMNS)
          ==================================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {/* Product Information Card */}
        <div className="p-5 rounded-2xl bg-surface border border-neutral-200/80 shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
            <h2 className="text-sm font-bold text-neutral-900">
              Target 3D Product
            </h2>
            <PackageIcon size={16} className="text-neutral-400" />
          </div>

          <div className="flex items-start gap-3.5">
            {review.productImage ? (
              <div className="w-14 h-14 rounded-xl bg-neutral-100 overflow-hidden relative shrink-0 border border-neutral-200/80">
                <Image
                  src={review.productImage}
                  alt={review.productName}
                  fill
                  className="object-cover"
                  sizes="56px"
                />
              </div>
            ) : (
              <div className="w-14 h-14 rounded-xl bg-neutral-100 flex items-center justify-center text-neutral-400 shrink-0">
                <PackageIcon size={24} />
              </div>
            )}

            <div className="space-y-1 min-w-0">
              <div className="font-bold text-sm text-neutral-900 truncate">
                {review.productName}
              </div>
              <div className="font-mono text-[11px] text-neutral-400 truncate">
                slug: {review.productSlug}
              </div>
              <div className="text-[11px] text-neutral-500">
                ID: {review.productId}
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-neutral-100 flex items-center gap-3 text-xs">
            {matchedProduct ? (
              <Link
                href={`/admin/products/${review.productSlug}/edit`}
                className="font-bold text-primary-dark hover:underline flex items-center gap-1"
              >
                <span>Edit Product Specs</span>
                <ExternalLinkIcon size={12} />
              </Link>
            ) : (
              <span className="text-neutral-400 italic">
                Product unavailable in active catalog
              </span>
            )}
          </div>
        </div>

        {/* Customer Information Card */}
        <div className="p-5 rounded-2xl bg-surface border border-neutral-200/80 shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
            <h2 className="text-sm font-bold text-neutral-900">
              Reviewer Profile
            </h2>
            <UserIcon size={16} className="text-neutral-400" />
          </div>

          <div className="space-y-1.5 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-neutral-900 text-white font-bold text-xs flex items-center justify-center">
                {review.customerName.charAt(0).toUpperCase()}
              </div>
              <div>
                <span className="font-bold text-sm text-neutral-900 block">
                  {review.customerName}
                </span>
                <span className="font-mono text-[11px] text-neutral-400">
                  {review.customerId}
                </span>
              </div>
            </div>

            <div className="pt-2 text-neutral-600">
              <span className="text-[10px] text-neutral-400 uppercase font-bold block">
                Email
              </span>
              <a
                href={`mailto:${review.customerEmail}`}
                className="text-neutral-800 font-semibold hover:underline"
              >
                {review.customerEmail}
              </a>
            </div>
          </div>

          <div className="pt-2 border-t border-neutral-100 flex items-center gap-3 text-xs">
            {matchedCustomer ? (
              <Link
                href={`/admin/customers/${review.customerId}`}
                className="font-bold text-primary-dark hover:underline flex items-center gap-1"
              >
                <span>View Customer Profile & Orders</span>
                <ExternalLinkIcon size={12} />
              </Link>
            ) : (
              <span className="text-neutral-400 italic">
                Customer unavailable in active session
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ====================================================================
          3. ADMIN MODERATION NOTES
          ==================================================================== */}
      <div className="p-5 rounded-2xl bg-surface border border-neutral-200/80 shadow-2xs space-y-3">
        <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
          <h2 className="text-sm font-bold text-neutral-900">
            Internal Moderation Note
          </h2>
          <button
            type="button"
            onClick={handleOpenEditNote}
            className="text-xs font-bold text-primary-dark hover:underline flex items-center gap-1 cursor-pointer"
          >
            <EditIcon size={12} />
            <span>Edit Note</span>
          </button>
        </div>

        {review.adminNote ? (
          <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200 text-xs text-amber-950 whitespace-pre-line leading-relaxed">
            {review.adminNote}
          </div>
        ) : (
          <div className="p-6 rounded-xl bg-neutral-50 border border-dashed border-neutral-200 text-center text-xs text-neutral-400">
            No moderation note recorded. Click &ldquo;Edit Note&rdquo; to add internal team remarks.
          </div>
        )}
      </div>

      {/* Moderation Confirmation Modal */}
      {showModerationModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150"
          role="dialog"
          aria-modal="true"
          aria-labelledby="review-moderation-modal-title"
        >
          <div className="bg-surface rounded-2xl border border-neutral-200 shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <span className="font-mono text-sm font-bold bg-neutral-100 px-2 py-0.5 rounded border border-neutral-200">
                {review.id}
              </span>
              <button
                type="button"
                onClick={() => setShowModerationModal(false)}
                aria-label="Close moderation modal"
                className="w-8 h-8 rounded-lg border border-neutral-200 flex items-center justify-center text-neutral-400 hover:text-neutral-700"
              >
                <XIcon size={16} />
              </button>
            </div>

            <div className="space-y-1">
              <h3
                id="review-moderation-modal-title"
                className="text-base font-bold text-neutral-900"
              >
                Confirm Status: {targetStatus.toUpperCase()}
              </h3>
              <p className="text-xs text-neutral-500">
                You are changing this review for{" "}
                <span className="font-bold text-neutral-800">
                  {review.productName}
                </span>{" "}
                to {targetStatus}.
              </p>
            </div>

            {targetStatus === "approved" && (
              <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950 text-xs">
                Approving this review will make it eligible for future storefront display once the real review backend is connected.
              </div>
            )}

            {targetStatus === "rejected" && (
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-950 text-xs">
                Rejecting hides this review from public display while preserving the record for operational history.
              </div>
            )}

            {targetStatus === "flagged" && (
              <div className="p-3.5 rounded-xl bg-purple-50 border border-purple-200 text-purple-950 text-xs">
                Flagging marks this review as suspicious spam or promotional intrusion.
              </div>
            )}

            <div className="space-y-1.5 pt-1">
              <label
                htmlFor="details-moderation-note"
                className="block text-xs font-semibold text-neutral-700"
              >
                Admin Moderation Note (internal only)
              </label>
              <textarea
                id="details-moderation-note"
                rows={2}
                value={moderationReason}
                onChange={(e) => setModerationReason(e.target.value)}
                placeholder="Operational notes regarding this status change..."
                className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-xs text-neutral-800 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-neutral-100">
              <button
                type="button"
                onClick={() => setShowModerationModal(false)}
                className="px-4 py-2 rounded-xl border border-neutral-200 text-xs font-semibold text-neutral-700 hover:bg-neutral-100 cursor-pointer"
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
                Confirm Status
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Admin Note Modal */}
      {showEditNoteModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-note-modal-title"
        >
          <div className="bg-surface rounded-2xl border border-neutral-200 shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <span className="font-bold text-sm text-neutral-900">
                Edit Admin Moderation Note
              </span>
              <button
                type="button"
                onClick={() => setShowEditNoteModal(false)}
                aria-label="Close note modal"
                className="w-8 h-8 rounded-lg border border-neutral-200 flex items-center justify-center text-neutral-400 hover:text-neutral-700"
              >
                <XIcon size={16} />
              </button>
            </div>

            <textarea
              id="edit-note-modal-title"
              rows={4}
              value={adminNoteInput}
              onChange={(e) => setAdminNoteInput(e.target.value)}
              placeholder="Internal remarks regarding this review..."
              className="w-full p-3 rounded-xl border border-neutral-200 text-xs text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary resize-none"
            />

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-100">
              <button
                type="button"
                onClick={() => setShowEditNoteModal(false)}
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
