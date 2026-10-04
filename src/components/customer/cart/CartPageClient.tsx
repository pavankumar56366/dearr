"use client";

import { useState } from "react";
import Link from "next/link";
import { useCart } from "@/context/CartContext";
import { ChevronRightIcon } from "@/components/customer/Icons";

import CartItemRow from "./CartItemRow";
import CartSummary from "./CartSummary";
import CartEmptyState from "./CartEmptyState";

/**
 * CartPageClient — Client container for the Customer Shopping Cart screen.
 * Design Ref: docs/4.DESIGN(1) (1).md §6.4 (Cart & Checkout)
 * Flow Ref: docs/3.APPFLOW(1).md §4.6 (Cart Management)
 */
export default function CartPageClient() {
  const {
    items,
    totalCount,
    subtotal,
    discount,
    total,
    hasUnavailableItems,
    updateQuantity,
    removeItem,
    clearCart,
  } = useCart();

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  const handleRemove = (itemId: string) => {
    const item = items.find((i) => i.id === itemId);
    removeItem(itemId);
    if (item) {
      showToast(`Removed "${item.name}" from your cart`);
    }
  };

  const handleClear = () => {
    clearCart();
    showToast("Shopping cart cleared");
  };

  const handleProceedToCheckout = () => {
    if (hasUnavailableItems) {
      showToast("Please remove out-of-stock items before proceeding");
      return;
    }
    showToast("Checkout flow will be connected in Phase 4");
  };

  return (
    <div
      className="min-h-screen pb-32 md:pb-20"
      style={{ background: "var(--color-canvas)" }}
    >
      {/* Toast Notification */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-[calc(6rem+env(safe-area-inset-bottom,0px))] left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 px-4 py-2.5 rounded-full shadow-lg text-xs font-semibold animate-in fade-in slide-in-from-bottom-3 duration-200"
          style={{
            background: "var(--color-neutral-900)",
            color: "#FFFFFF",
            maxWidth: "90vw",
          }}
        >
          <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
          <span className="truncate">{toastMessage}</span>
        </div>
      )}

      {/* Breadcrumb Navigation */}
      <nav
        aria-label="Breadcrumb"
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-2"
      >
        <ol className="flex items-center gap-1.5 text-xs font-medium text-neutral-500">
          <li>
            <Link
              href="/"
              className="inline-flex items-center py-2 px-1 -my-2 -mx-0.5 rounded-sm hover:underline transition-colors hover:text-neutral-900 focus-visible:outline-2 focus-visible:outline-primary"
            >
              Home
            </Link>
          </li>
          <li aria-hidden="true" className="text-neutral-400">
            <ChevronRightIcon size={12} />
          </li>
          <li
            aria-current="page"
            className="font-bold"
            style={{ color: "var(--color-neutral-800)" }}
          >
            Shopping Cart
          </li>
        </ol>
      </nav>

      {/* Main Cart Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-2 sm:pt-4">
        {items.length === 0 ? (
          <CartEmptyState />
        ) : (
          <div className="flex flex-col gap-6">
            {/* Cart Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-neutral-200">
              <div className="flex items-baseline gap-3">
                <h1
                  className="text-2xl sm:text-3xl font-black tracking-tight"
                  style={{ color: "var(--color-neutral-900)" }}
                >
                  Shopping Cart
                </h1>
                <span
                  className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-bold"
                  style={{
                    background: "rgba(162, 203, 139, 0.2)",
                    color: "var(--color-neutral-900)",
                  }}
                  aria-label={`${totalCount} items in cart`}
                >
                  {totalCount} {totalCount === 1 ? "item" : "items"}
                </span>
              </div>

              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={handleClear}
                  className="text-xs font-semibold text-neutral-500 hover:text-red-600 transition-colors focus:outline-none"
                >
                  Clear Cart
                </button>
                <Link
                  href="/shop"
                  className="inline-flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-lg border border-neutral-300 hover:bg-neutral-100 transition-colors"
                  style={{ color: "var(--color-neutral-800)" }}
                >
                  <span>Continue Shopping</span>
                  <ChevronRightIcon size={12} />
                </Link>
              </div>
            </div>

            {/* Two-Column Responsive Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* Left Column: Cart Items List */}
              <section
                aria-label="Shopping cart items"
                className="lg:col-span-8 flex flex-col gap-3.5"
              >
                {items.map((item) => (
                  <CartItemRow
                    key={item.id}
                    item={item}
                    onUpdateQuantity={updateQuantity}
                    onRemove={handleRemove}
                  />
                ))}
              </section>

              {/* Right Column: Order Summary */}
              <div className="lg:col-span-4 w-full">
                <CartSummary
                  subtotal={subtotal}
                  discount={discount}
                  total={total}
                  totalCount={totalCount}
                  hasUnavailableItems={hasUnavailableItems}
                  onProceedToCheckout={handleProceedToCheckout}
                />
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
