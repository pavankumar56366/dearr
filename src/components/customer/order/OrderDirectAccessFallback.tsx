import React from "react";
import Link from "next/link";
import { AlertCircleIcon, CartIcon, ShopIcon } from "@/components/customer/Icons";

export default function OrderDirectAccessFallback() {
  return (
    <div
      className="max-w-xl mx-auto my-12 p-8 sm:p-10 rounded-3xl text-center flex flex-col items-center gap-6"
      style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-neutral-100)",
        boxShadow: "var(--shadow-card)",
      }}
    >
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center text-amber-600"
        style={{ background: "rgba(255, 203, 86, 0.2)" }}
      >
        <AlertCircleIcon size={34} />
      </div>

      <div className="flex flex-col gap-2">
        <h2
          className="text-xl sm:text-2xl font-bold tracking-tight"
          style={{ color: "var(--color-neutral-900)" }}
        >
          Your Confirmation Details Are Not Available
        </h2>
        <p className="text-xs sm:text-sm text-neutral-600 leading-relaxed">
          No active order session was found. If you navigated here directly or your browser session ended, your details cannot be displayed without an active checkout flow.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-3 pt-2 w-full justify-center">
        <Link
          href="/shop"
          className="w-full sm:w-auto px-6 h-12 flex items-center justify-center gap-2 rounded-xl font-bold text-xs uppercase tracking-wider transition-all duration-200 shadow-sm hover:shadow-md"
          style={{
            background: "var(--color-primary)",
            color: "var(--color-neutral-900)",
          }}
        >
          <ShopIcon size={16} />
          <span>Continue Shopping</span>
        </Link>

        <Link
          href="/cart"
          className="w-full sm:w-auto px-6 h-12 flex items-center justify-center gap-2 rounded-xl font-bold text-xs uppercase tracking-wider border border-neutral-300 hover:bg-neutral-100 transition-colors text-neutral-800"
        >
          <CartIcon size={16} />
          <span>Return to Cart</span>
        </Link>
      </div>
    </div>
  );
}
