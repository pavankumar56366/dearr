"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";
import type { CartItem } from "@/context/CartContext";
import type { DeliveryAddressFormValues } from "@/lib/checkout-validation";
import { SecureLockIcon, ShieldCheckIcon, TruckIcon } from "@/components/customer/Icons";
import { normalizeImageUrl, isUploadPath } from "@/lib/product-image";

interface CheckoutSummaryProps {
  items: CartItem[];
  subtotal: number;
  totalCount: number;
  address?: DeliveryAddressFormValues;
  onEditAddress?: () => void;
  isProcessing?: boolean;
  onProceedToPayment?: () => void;
  isAddressValid: boolean;
  hasUnavailableItems: boolean;
  actionLabel?: string;
  shippingFee?: number;
  freeShippingThreshold?: number;
  totalPayable?: number;
}

export default function CheckoutSummary({
  items,
  subtotal,
  totalCount,
  address,
  onEditAddress,
  isProcessing = false,
  onProceedToPayment,
  isAddressValid,
  hasUnavailableItems,
  actionLabel,
  shippingFee,
  freeShippingThreshold,
  totalPayable,
}: CheckoutSummaryProps) {
  const isSubmitDisabled = !isAddressValid || totalCount === 0 || hasUnavailableItems || isProcessing;
  const effectiveShipping = shippingFee !== undefined ? shippingFee : 0;
  const effectiveTotal = totalPayable !== undefined ? totalPayable : (subtotal + effectiveShipping);

  return (
    <aside
      aria-label="Order Summary and Payment Action"
      className="rounded-2xl p-5 sm:p-6 flex flex-col gap-6 sticky top-24"
      style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-neutral-100)",
        boxShadow: "var(--shadow-card)",
      }}
    >
      <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
        <h2
          className="text-base font-bold tracking-tight"
          style={{ color: "var(--color-neutral-900)" }}
        >
          Order Summary ({totalCount} {totalCount === 1 ? "item" : "items"})
        </h2>
        <Link
          href="/cart"
          className="text-xs font-semibold text-neutral-600 hover:text-neutral-900 hover:underline"
        >
          Edit Cart
        </Link>
      </div>

      {/* Cart Items Miniature Preview */}
      <div
        aria-label="Items in order"
        className="flex flex-col gap-3 max-h-72 overflow-y-auto pr-1 divide-y divide-neutral-100"
      >
        {items.map((item) => (
          <div key={item.id} className="pt-3 first:pt-0 flex items-center gap-3">
            <div className="relative w-14 h-14 rounded-xl overflow-hidden bg-neutral-100 border border-neutral-200 shrink-0">
              <Image
                src={normalizeImageUrl(item.image)}
                alt={item.name}
                fill
                unoptimized={isUploadPath(item.image)}
                className="object-cover"
                sizes="56px"
              />
              <span className="absolute bottom-0 right-0 bg-neutral-900 text-white font-extrabold text-[10px] px-1.5 py-0.5 rounded-tl-lg">
                ×{item.quantity}
              </span>
            </div>

            <div className="flex-1 min-w-0 flex flex-col">
              <span className="text-xs font-bold text-neutral-900 truncate">
                {item.name}
              </span>
              {item.variantName && (
                <span className="text-[11px] text-neutral-500 truncate">
                  Finish: {item.variantName}
                </span>
              )}
              <span className="text-[11px] text-neutral-600 mt-0.5">
                ₹{item.price.toLocaleString("en-IN")} each
              </span>
            </div>

            <div className="text-right shrink-0">
              <span className="text-xs sm:text-sm font-bold text-neutral-900">
                ₹{(item.price * item.quantity).toLocaleString("en-IN")}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Delivery Address Summary (if entered) */}
      {address && isAddressValid && (
        <div className="p-3.5 rounded-xl bg-neutral-50 border border-neutral-200 text-xs flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="font-bold text-neutral-900 flex items-center gap-1.5">
              <TruckIcon size={14} className="text-primary" />
              <span>Deliver To</span>
            </span>
            {onEditAddress && (
              <button
                type="button"
                onClick={onEditAddress}
                className="text-[11px] font-bold text-neutral-600 hover:text-neutral-900 underline"
              >
                Change
              </button>
            )}
          </div>
          <p className="font-semibold text-neutral-800">{address.fullName} ({address.phone})</p>
          <p className="text-neutral-600 text-[11px] leading-relaxed">
            {address.addressLine1}
            {address.addressLine2 ? `, ${address.addressLine2}` : ""}, {address.city}, {address.state} - {address.postalCode}
          </p>
        </div>
      )}

      {/* Pricing Breakdown */}
      <div className="flex flex-col gap-2.5 text-xs sm:text-sm pt-2 border-t border-neutral-100">
        <div className="flex items-center justify-between text-neutral-600">
          <span>Items Subtotal</span>
          <span className="font-semibold text-neutral-900">
            ₹{subtotal.toLocaleString("en-IN")}
          </span>
        </div>

        <div className="flex items-center justify-between text-neutral-600">
          <span>Standard Shipping</span>
          {effectiveShipping === 0 ? (
            <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
              Free Shipping
            </span>
          ) : (
            <span className="text-xs font-bold text-neutral-900 font-mono">
              ₹{effectiveShipping.toLocaleString("en-IN")}
            </span>
          )}
        </div>

        {effectiveShipping > 0 && freeShippingThreshold && subtotal < freeShippingThreshold && (
          <p className="text-[11px] text-neutral-500 -mt-1">
            Add ₹{(freeShippingThreshold - subtotal).toLocaleString("en-IN")} more to qualify for Free Shipping
          </p>
        )}

        <div className="flex items-center justify-between text-neutral-600">
          <span>Taxes</span>
          <span className="text-xs text-neutral-500 font-medium">
            Inclusive of all GST
          </span>
        </div>

        <div className="pt-3 border-t border-neutral-200 flex items-baseline justify-between">
          <span className="font-bold text-sm sm:text-base text-neutral-900">
            Total Payable
          </span>
          <span
            className="text-xl sm:text-2xl font-black tracking-tight"
            style={{ color: "var(--color-neutral-900)" }}
          >
            ₹{effectiveTotal.toLocaleString("en-IN")}
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
          Your cart contains unavailable products. Please return to your cart to remove them.
        </div>
      )}

      {/* Primary Action Button */}
      <div className="flex flex-col gap-2 pt-1">
        <button
          type="button"
          disabled={isSubmitDisabled}
          onClick={onProceedToPayment}
          className="w-full h-13 flex items-center justify-center gap-2 rounded-xl font-bold text-xs uppercase tracking-wider transition-all duration-200 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-md active:scale-98 cursor-pointer"
          style={{
            background: "var(--color-primary)",
            color: "var(--color-neutral-900)",
          }}
        >
          {isProcessing ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin h-4 w-4 text-neutral-900" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              <span>Verifying Details...</span>
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <SecureLockIcon size={14} />
              <span>{actionLabel || "Proceed to Payment"}</span>
            </span>
          )}
        </button>

        {!isAddressValid && (
          <p className="text-[11px] text-center text-neutral-500">
            Please fill and confirm your delivery details in Step 1 to enable payment.
          </p>
        )}
      </div>

      {/* Security note */}
      <div className="flex items-center justify-center gap-2 text-[11px] text-neutral-500 pt-1 border-t border-neutral-100">
        <ShieldCheckIcon size={14} className="text-emerald-600" />
        <span>256-Bit SSL Encrypted & Protected</span>
      </div>
    </aside>
  );
}
