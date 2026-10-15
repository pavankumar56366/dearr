"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { AlternativeItem } from "@/lib/server/alternatives";

interface CartRecoverySheetProps {
  attemptId: string;
  isOpen: boolean;
  isFailed?: boolean;
  errorCode?: string | null;
  errorDescription?: string | null;
  defaultReasons?: string[];
  customerEmail?: string;
  customerPhone?: string;
  onClose: () => void;
  onRetryPayment: () => void;
  onCartSwapped?: () => void;
}

export function CartRecoverySheet({
  attemptId,
  isOpen,
  isFailed = false,
  errorCode,
  errorDescription,
  defaultReasons = [
    "Price is too high",
    "Found it cheaper elsewhere",
    "Shipping charges too high",
    "Delivery takes too long",
    "Payment problem",
    "Wanted Cash on Delivery",
    "Not sure about product quality",
    "Just browsing",
    "Need to compare more",
    "Other",
  ],
  customerEmail = "",
  customerPhone = "",
  onClose,
  onRetryPayment,
  onCartSwapped,
}: CartRecoverySheetProps) {
  // Alternatives State
  const [showAlternatives, setShowAlternatives] = useState(false);
  const [alternatives, setAlternatives] = useState<AlternativeItem[]>([]);
  const [loadingAlternatives, setLoadingAlternatives] = useState(false);
  const [swappingId, setSwappingId] = useState<string | null>(null);
  const [swapMessage, setSwapMessage] = useState<string | null>(null);

  // Feedback State
  const [selectedReasons, setSelectedReasons] = useState<string[]>([]);
  const [feedbackComment, setFeedbackComment] = useState("");
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);

  // Notification Consent State (Data only, unchecked by default)
  const [consentEmail, setConsentEmail] = useState(false);
  const [consentWhatsApp, setConsentWhatsApp] = useState(false);
  const [consentSms, setConsentSms] = useState(false);
  const [consentRecorded, setConsentRecorded] = useState(false);

  // When sheet opens, mark recovery_shown_at on server
  useEffect(() => {
    if (isOpen && attemptId) {
      fetch(`/api/checkout/attempts/${attemptId}/recovery-shown`, {
        method: "POST",
      }).catch(() => {});
    }
  }, [isOpen, attemptId]);

  // Load lower-priced alternatives
  const handleLoadAlternatives = async () => {
    setShowAlternatives(true);
    setLoadingAlternatives(true);
    try {
      // First get attempt cart items from recovery-status
      const statRes = await fetch(`/api/checkout/attempts/${attemptId}/recovery-status`);
      const statData = await statRes.json();
      const items = statData?.cartSnapshot?.items || [];
      if (items.length > 0) {
        const firstItem = items[0];
        const res = await fetch(
          `/api/cart/alternatives?productId=${encodeURIComponent(
            firstItem.productId
          )}&colorId=${encodeURIComponent(firstItem.colorId || "")}&sourcePrice=${encodeURIComponent(
            firstItem.unitPrice
          )}&attemptId=${encodeURIComponent(attemptId)}`
        );
        const data = await res.json();
        if (data.ok && data.alternatives) {
          setAlternatives(data.alternatives);
        }
      }
    } catch {
      // Graceful fallback
    } finally {
      setLoadingAlternatives(false);
    }
  };

  // Handle Cart Swap
  const handleSwap = async (alt: AlternativeItem) => {
    setSwappingId(alt.productId);
    setSwapMessage(null);
    try {
      const statRes = await fetch(`/api/checkout/attempts/${attemptId}/recovery-status`);
      const statData = await statRes.json();
      const items = statData?.cartSnapshot?.items || [];
      const firstItem = items[0];

      const res = await fetch("/api/cart/swap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceProductId: firstItem.productId,
          sourceColorId: firstItem.colorId || null,
          alternativeProductId: alt.productId,
          alternativeColorId: alt.colorId || null,
          expectedAlternativePrice: alt.effectivePrice,
          attemptId,
        }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setSwapMessage(`Swapped to ${alt.productName}! Your cart has been updated with savings of ₹${alt.savings}.`);
        if (onCartSwapped) onCartSwapped();
      } else {
        setSwapMessage(data.error || "Failed to swap item. Please try another option.");
      }
    } catch (err: any) {
      setSwapMessage(err.message || "Failed to swap item.");
    } finally {
      setSwappingId(null);
    }
  };

  // Toggle reason selection
  const toggleReason = (reason: string) => {
    setSelectedReasons((prev) =>
      prev.includes(reason)
        ? prev.filter((r) => r !== reason)
        : [...prev, reason]
    );
  };

  // Submit Feedback
  const handleSubmitFeedback = async (skipped = false) => {
    setSubmittingFeedback(true);
    setFeedbackError(null);
    try {
      const res = await fetch(`/api/checkout/attempts/${attemptId}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          skipped,
          reasons: skipped ? [] : selectedReasons,
          comment: skipped ? "" : feedbackComment,
        }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setFeedbackSubmitted(true);
      } else {
        setFeedbackError(data.error || "Failed to submit feedback.");
      }
    } catch (err: any) {
      setFeedbackError(err.message || "Failed to submit feedback.");
    } finally {
      setSubmittingFeedback(false);
    }
  };

  // Save Notification Consent (Optional)
  const handleSaveConsent = async () => {
    const consentText = "I agree to receive price-drop alerts and cart updates from Dearr.";
    try {
      if (consentEmail && customerEmail) {
        await fetch("/api/notifications/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            attemptId,
            channel: "email",
            contactValue: customerEmail,
            consentText,
          }),
        });
      }
      if (consentWhatsApp && customerPhone) {
        await fetch("/api/notifications/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            attemptId,
            channel: "whatsapp",
            contactValue: customerPhone,
            consentText,
          }),
        });
      }
      if (consentSms && customerPhone) {
        await fetch("/api/notifications/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            attemptId,
            channel: "sms",
            contactValue: customerPhone,
            consentText,
          }),
        });
      }
      setConsentRecorded(true);
    } catch {}
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="recovery-sheet-title"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-xs transition-opacity animate-fade-in"
    >
      <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl border border-[#E5E7EB] text-[#1E1E1E] p-6 space-y-6">
        {/* Dismiss Button */}
        <button
          onClick={onClose}
          aria-label="Dismiss saved cart notice"
          className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Header & Reassurance */}
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-full bg-[#A2CB8B]/20 text-[#2A7C13] shrink-0 mt-0.5">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <h2 id="recovery-sheet-title" className="text-xl font-bold text-[#1E1E1E]">
              Your cart is saved.
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              {isFailed
                ? errorDescription ||
                  "Your bank or payment provider declined the transaction. Don't worry—your items are reserved."
                : "You closed the checkout modal, but your cart items and selections remain saved."}
            </p>
          </div>
        </div>

        {/* Primary Action: Retry Payment */}
        <div className="space-y-2">
          <button
            onClick={onRetryPayment}
            className="w-full py-3.5 px-4 bg-[#2A7C13] hover:bg-[#236810] text-white font-medium rounded-xl shadow-sm transition-all duration-150 flex items-center justify-center gap-2 cursor-pointer"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Retry payment
          </button>
          <p className="text-xs text-center text-gray-500">
            You can try another UPI app, card, net banking, or available payment method.
          </p>
        </div>

        {/* Section: Lower-priced alternatives */}
        <div className="pt-2 border-t border-gray-100">
          {!showAlternatives ? (
            <button
              onClick={handleLoadAlternatives}
              className="w-full py-2.5 px-3 text-sm text-[#2A7C13] font-medium hover:bg-[#A2CB8B]/10 rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
              Looking for a lower price? See similar alternatives
            </button>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-900">
                  Lower-priced alternatives
                </span>
                <button
                  onClick={() => setShowAlternatives(false)}
                  className="text-xs text-gray-500 hover:text-gray-700"
                >
                  Hide
                </button>
              </div>

              {loadingAlternatives ? (
                <div className="py-6 text-center text-xs text-gray-500">
                  Finding cheaper in-stock alternatives...
                </div>
              ) : alternatives.length === 0 ? (
                <p className="text-xs text-gray-500 py-2">
                  No lower-priced alternatives found in this category. You already have the best deal!
                </p>
              ) : (
                <div className="space-y-2.5">
                  {swapMessage && (
                    <div className="p-2.5 bg-green-50 border border-green-200 text-green-800 text-xs rounded-lg">
                      {swapMessage}
                    </div>
                  )}
                  {alternatives.map((alt) => (
                    <div
                      key={alt.productId}
                      className="p-3 bg-gray-50 border border-gray-200 rounded-xl flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="relative w-12 h-12 rounded-lg bg-gray-200 overflow-hidden shrink-0">
                          <Image
                            src={alt.imageUrl}
                            alt={alt.productName}
                            fill
                            className="object-cover"
                            sizes="48px"
                          />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-gray-900 truncate">
                            {alt.productName}
                          </p>
                          {alt.colorName && (
                            <p className="text-gray-500 text-[11px] flex items-center gap-1">
                              {alt.colorHex && (
                                <span
                                  className="w-2.5 h-2.5 rounded-full border border-gray-300 inline-block"
                                  style={{ backgroundColor: alt.colorHex }}
                                />
                              )}
                              {alt.colorName}
                            </p>
                          )}
                          <p className="text-[#2A7C13] font-bold mt-0.5">
                            ₹{alt.effectivePrice.toFixed(2)}
                            <span className="text-gray-400 font-normal ml-1">
                              (Save ₹{alt.savings.toFixed(2)})
                            </span>
                          </p>
                        </div>
                      </div>

                      <button
                        onClick={() => handleSwap(alt)}
                        disabled={swappingId === alt.productId}
                        className="py-1.5 px-3 bg-[#1E1E1E] hover:bg-black text-white text-xs font-medium rounded-lg shrink-0 disabled:opacity-50 cursor-pointer"
                      >
                        {swappingId === alt.productId ? "Swapping..." : "Swap"}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Section: Checkout Feedback Form */}
        <div className="pt-2 border-t border-gray-100">
          {feedbackSubmitted ? (
            <div className="p-3 bg-green-50 text-green-800 text-xs rounded-xl flex items-center gap-2">
              <svg className="w-4 h-4 text-green-600 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              Thank you for your feedback! It helps us improve our checkout experience.
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-700">
                  Why couldn&apos;t you complete your order?
                </span>
                <button
                  type="button"
                  onClick={() => handleSubmitFeedback(true)}
                  disabled={submittingFeedback}
                  className="text-xs text-gray-400 hover:text-gray-600 cursor-pointer"
                >
                  Skip
                </button>
              </div>

              {feedbackError && (
                <p className="text-xs text-red-600">{feedbackError}</p>
              )}

              <div className="flex flex-wrap gap-1.5">
                {defaultReasons.map((reason) => {
                  const isSelected = selectedReasons.includes(reason);
                  return (
                    <button
                      key={reason}
                      type="button"
                      onClick={() => toggleReason(reason)}
                      className={`py-1 px-2.5 rounded-full text-[11px] font-medium border transition-colors cursor-pointer ${
                        isSelected
                          ? "bg-[#2A7C13] text-white border-[#2A7C13]"
                          : "bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100"
                      }`}
                    >
                      {reason}
                    </button>
                  );
                })}
              </div>

              <textarea
                value={feedbackComment}
                onChange={(e) => setFeedbackComment(e.target.value.slice(0, 300))}
                placeholder="Optional thoughts or suggestions (max 300 characters)..."
                rows={2}
                className="w-full p-2.5 text-xs border border-gray-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-[#2A7C13] focus:border-[#2A7C13]"
              />

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => handleSubmitFeedback(true)}
                  disabled={submittingFeedback}
                  className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700 rounded-lg"
                >
                  Skip
                </button>
                <button
                  type="button"
                  onClick={() => handleSubmitFeedback(false)}
                  disabled={submittingFeedback || selectedReasons.length === 0}
                  className="px-4 py-1.5 bg-[#1E1E1E] hover:bg-black text-white text-xs font-medium rounded-lg disabled:opacity-50 cursor-pointer"
                >
                  {submittingFeedback ? "Saving..." : "Submit feedback"}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Section: Optional Notification Consent (Unchecked by default) */}
        <div className="pt-2 border-t border-gray-100 space-y-2 text-xs">
          <p className="font-semibold text-gray-800">
            Get notified if this item goes on sale or prices drop (optional)
          </p>
          <div className="space-y-1.5">
            {customerEmail && (
              <label className="flex items-center gap-2 text-gray-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={consentEmail}
                  onChange={(e) => setConsentEmail(e.target.checked)}
                  className="rounded-sm border-gray-300 text-[#2A7C13] focus:ring-[#2A7C13]"
                />
                Email alerts ({customerEmail})
              </label>
            )}
            {customerPhone && (
              <>
                <label className="flex items-center gap-2 text-gray-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={consentWhatsApp}
                    onChange={(e) => setConsentWhatsApp(e.target.checked)}
                    className="rounded-sm border-gray-300 text-[#2A7C13] focus:ring-[#2A7C13]"
                  />
                  WhatsApp alerts ({customerPhone})
                </label>
                <label className="flex items-center gap-2 text-gray-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={consentSms}
                    onChange={(e) => setConsentSms(e.target.checked)}
                    className="rounded-sm border-gray-300 text-[#2A7C13] focus:ring-[#2A7C13]"
                  />
                  SMS alerts ({customerPhone})
                </label>
              </>
            )}
          </div>

          {(consentEmail || consentWhatsApp || consentSms) && !consentRecorded && (
            <button
              type="button"
              onClick={handleSaveConsent}
              className="mt-2 text-xs text-[#2A7C13] font-semibold hover:underline cursor-pointer"
            >
              Save notification preferences
            </button>
          )}

          {consentRecorded && (
            <p className="text-[11px] text-[#2A7C13] font-medium mt-1">
              ✓ Preferences saved. You can unsubscribe anytime in your account.
            </p>
          )}
        </div>

        {/* Footer Close */}
        <div className="pt-2 border-t border-gray-100 flex justify-between items-center">
          <button
            onClick={onClose}
            className="text-xs text-gray-500 hover:text-gray-800 underline cursor-pointer"
          >
            Keep shopping
          </button>
          <span className="text-[11px] text-gray-400">
            Reference: {attemptId.slice(0, 8)}
          </span>
        </div>
      </div>
    </div>
  );
}
