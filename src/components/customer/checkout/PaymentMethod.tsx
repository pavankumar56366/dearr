"use client";

import React from "react";
import { CreditCardIcon, SecureLockIcon, ShieldCheckIcon } from "@/components/customer/Icons";

export type PaymentOption = "razorpay" | "cod";

interface PaymentMethodProps {
  selectedMethod: PaymentOption;
  onSelectMethod: (method: PaymentOption) => void;
}

export default function PaymentMethod({
  selectedMethod,
  onSelectMethod,
}: PaymentMethodProps) {
  return (
    <section
      aria-labelledby="payment-method-heading"
      className="rounded-2xl p-5 sm:p-7 flex flex-col gap-5"
      style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-neutral-100)",
        boxShadow: "var(--shadow-card)",
      }}
    >
      <div className="flex items-center gap-2.5 pb-4 border-b border-neutral-100">
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: "rgba(162, 203, 139, 0.2)", color: "var(--color-neutral-900)" }}
        >
          <CreditCardIcon size={18} />
        </div>
        <div>
          <h2
            id="payment-method-heading"
            className="text-base sm:text-lg font-bold tracking-tight"
            style={{ color: "var(--color-neutral-900)" }}
          >
            Step 2: Payment Method
          </h2>
          <p className="text-xs text-neutral-500 font-medium">
            Choose your preferred secure payment option
          </p>
        </div>
      </div>

      {/* Payment Options */}
      <div className="flex flex-col gap-3.5" role="radiogroup" aria-label="Select Payment Method">
        {/* Option 1: Razorpay (Primary & Recommended) */}
        <label
          htmlFor="payment-razorpay"
          className={`relative flex flex-col p-4 sm:p-5 rounded-2xl border-2 transition-all cursor-pointer ${
            selectedMethod === "razorpay"
              ? "border-[#A2CB8B] bg-[#A2CB8B]/5 shadow-sm"
              : "border-neutral-200 hover:border-neutral-300 bg-white"
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <input
                id="payment-razorpay"
                name="payment-method"
                type="radio"
                checked={selectedMethod === "razorpay"}
                onChange={() => onSelectMethod("razorpay")}
                className="mt-1 w-4 h-4 accent-[#A2CB8B] cursor-pointer"
              />
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-bold text-neutral-900">
                    Razorpay Secure Online Payment
                  </span>
                  <span
                    className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full"
                    style={{ background: "var(--color-secondary)", color: "var(--color-neutral-900)" }}
                  >
                    Recommended
                  </span>
                </div>
                <p className="text-xs text-neutral-600">
                  Instant confirmation via UPI (Google Pay, PhonePe, Paytm), Credit/Debit Cards, Net Banking & Wallets.
                </p>
              </div>
            </div>

            <div className="hidden sm:flex items-center gap-1.5 shrink-0 text-neutral-500">
              <SecureLockIcon size={14} />
              <span className="text-[11px] font-semibold">256-bit SSL</span>
            </div>
          </div>

          {/* Payment Method Badges */}
          <div className="mt-3.5 pt-3 border-t border-neutral-100 flex items-center gap-2 flex-wrap text-[11px] font-medium text-neutral-600">
            <span className="px-2.5 py-1 rounded-md bg-neutral-100 font-bold text-neutral-800">UPI</span>
            <span className="px-2.5 py-1 rounded-md bg-neutral-100 font-bold text-neutral-800">Visa / Mastercard</span>
            <span className="px-2.5 py-1 rounded-md bg-neutral-100 font-bold text-neutral-800">RuPay</span>
            <span className="px-2.5 py-1 rounded-md bg-neutral-100 font-bold text-neutral-800">NetBanking</span>
          </div>
        </label>

        {/* Option 2: Cash on Delivery (Disabled / Explanatory) */}
        <div
          className="relative flex flex-col p-4 sm:p-5 rounded-2xl border border-dashed border-neutral-200 bg-neutral-50/70 opacity-75 cursor-not-allowed select-none"
        >
          <div className="flex items-start gap-3">
            <input
              id="payment-cod"
              name="payment-method"
              type="radio"
              disabled
              checked={false}
              className="mt-1 w-4 h-4 cursor-not-allowed"
            />
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-neutral-500">
                  Cash on Delivery (COD)
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-neutral-200 text-neutral-600">
                  Unavailable
                </span>
              </div>
              <p className="text-xs text-neutral-500">
                To eliminate material waste and prevent uncollected custom fabrication, all precision 3D-printed items require online prepaid confirmation.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Trust & Guarantee Banner */}
      <div
        className="p-3.5 rounded-xl flex items-center gap-3 text-xs"
        style={{
          background: "rgba(42, 124, 19, 0.08)",
          color: "var(--color-success)",
          border: "1px solid rgba(42, 124, 19, 0.2)",
        }}
      >
        <ShieldCheckIcon size={20} className="shrink-0" />
        <div className="flex flex-col gap-0.5">
          <span className="font-bold text-neutral-900">Dearr 3D Precision Guarantee</span>
          <span className="text-neutral-600 text-[11px]">
            Every print undergoes high-resolution layer inspection before packaging.
          </span>
        </div>
      </div>

      {/* Integration Disclaimer */}
      <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-900 leading-relaxed">
        <strong>V1 Architecture Note:</strong> Real Razorpay API keys and payment verification webhooks are configured in Phase 5. In this frontend task, placing your order validates your details and demonstrates the complete customer checkout UI locally.
      </div>
    </section>
  );
}
