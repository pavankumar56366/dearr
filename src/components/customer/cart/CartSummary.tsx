"use client";

import Link from "next/link";
import { ChevronRightIcon, ShieldCheckIcon } from "@/components/customer/Icons";

interface CartSummaryProps {
  subtotal: number;
  discount?: number;
  total?: number;
  totalCount: number;
  hasUnavailableItems: boolean;
  onProceedToCheckout?: () => void;
}

/**
 * CartSummary — Order totals, tax notes, shipping note, and checkout CTA.
 * Sticky on desktop viewports.
 */
export default function CartSummary({
  subtotal,
  discount = 0,
  total,
  totalCount,
  hasUnavailableItems,
  onProceedToCheckout,
}: CartSummaryProps) {
  const isCheckoutDisabled = totalCount === 0 || hasUnavailableItems;
  const finalTotal = total !== undefined ? total : Math.max(0, subtotal - discount);

  return (
    <aside
      aria-label="Order Summary"
      className="rounded-2xl p-5 sm:p-6 flex flex-col gap-5 sticky top-24"
      style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-neutral-100)",
        boxShadow: "var(--shadow-card)",
      }}
    >
      <h2
        className="text-base font-bold tracking-tight pb-3 border-b border-neutral-100"
        style={{ color: "var(--color-neutral-900)" }}
      >
        Order Summary
      </h2>

      {/* Totals Breakdown */}
      <div className="flex flex-col gap-3 text-xs sm:text-sm">
        <div className="flex items-center justify-between text-neutral-600">
          <span>Items Subtotal ({totalCount} {totalCount === 1 ? "item" : "items"})</span>
          <span className="font-semibold text-neutral-900">
            ₹{subtotal.toLocaleString("en-IN")}
          </span>
        </div>

        {discount > 0 && (
          <div className="flex items-center justify-between text-emerald-700 font-semibold">
            <span>Promotion Discount</span>
            <span>-₹{discount.toLocaleString("en-IN")}</span>
          </div>
        )}

        <div className="flex items-center justify-between text-neutral-600">
          <span>Shipping & Delivery</span>
          <span className="text-xs text-neutral-500 font-medium">
            Calculated at checkout
          </span>
        </div>

        <div className="flex items-center justify-between text-neutral-600">
          <span>Taxes</span>
          <span className="text-xs text-neutral-500 font-medium">
            Inclusive of all taxes
          </span>
        </div>

        <div className="pt-3 border-t border-neutral-200 flex items-baseline justify-between">
          <span className="font-bold text-sm sm:text-base text-neutral-900">
            Estimated Total
          </span>
          <span
            className="text-xl sm:text-2xl font-black tracking-tight"
            style={{ color: "var(--color-neutral-900)" }}
          >
            ₹{finalTotal.toLocaleString("en-IN")}
          </span>
        </div>
      </div>

      {/* Unavailable Items Warning */}
      {hasUnavailableItems && (
        <div
          className="p-3 rounded-xl text-xs font-semibold"
          style={{
            background: "rgba(192, 7, 7, 0.08)",
            color: "var(--color-error)",
            border: "1px solid rgba(192, 7, 7, 0.2)",
          }}
        >
          Your cart contains out-of-stock items. Please remove them before proceeding to checkout.
        </div>
      )}

      {/* Checkout CTA */}
      <div className="flex flex-col gap-2.5 pt-1">
        <button
          type="button"
          disabled={isCheckoutDisabled}
          onClick={onProceedToCheckout}
          className="w-full h-12 flex items-center justify-center gap-2 rounded-xl font-bold text-xs uppercase tracking-wider transition-all duration-200 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-md active:scale-98"
          style={{
            background: "var(--color-primary)",
            color: "var(--color-neutral-900)",
          }}
        >
          <span>Proceed to Checkout</span>
          <ChevronRightIcon size={14} />
        </button>

        <Link
          href="/shop"
          className="w-full h-10 flex items-center justify-center text-xs font-bold rounded-xl border border-neutral-300 hover:bg-neutral-50 transition-colors text-neutral-700"
        >
          Continue Shopping
        </Link>
      </div>

      {/* Trust & Craftsmanship Assurance */}
      <div
        className="p-3.5 rounded-xl flex items-start gap-2.5"
        style={{ background: "var(--color-neutral-100)" }}
      >
        <span className="text-primary shrink-0 mt-0.5" aria-hidden="true">
          <ShieldCheckIcon size={18} />
        </span>
        <div className="flex flex-col text-[11px] leading-relaxed text-neutral-600">
          <span className="font-bold text-neutral-900">
            Dearr 3D Guarantee
          </span>
          <span>
            Every piece is printed with eco-friendly PLA bioplastic and safely packaged with shockproof cushioning.
          </span>
        </div>
      </div>
    </aside>
  );
}
