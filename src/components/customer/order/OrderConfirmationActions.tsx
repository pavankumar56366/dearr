"use client";

import React from "react";
import Link from "next/link";
import { ArrowLeftIcon, PrinterIcon, ShieldCheckIcon, ShopIcon } from "@/components/customer/Icons";

interface OrderConfirmationActionsProps {
  orderNumber: string;
}

export default function OrderConfirmationActions({ orderNumber }: OrderConfirmationActionsProps) {
  const handlePrint = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* 3D Printing Workshop Message */}
      <div
        className="rounded-2xl p-5 sm:p-6 flex flex-col gap-3"
        style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-neutral-100)",
          boxShadow: "var(--shadow-card)",
        }}
      >
        <div className="flex items-center gap-2.5 font-bold text-neutral-900 text-sm">
          <PrinterIcon size={18} className="text-primary" />
          <span>What Happens Next at the Dearr 3D Workshop?</span>
        </div>
        <p className="text-xs text-neutral-600 leading-relaxed">
          Your order has entered our automated fabrication queue. Each model undergoes custom G-code slicing to calibrate filament flow, optimal infill density, and surface layer smoothness. Once printing finishes, our technicians inspect dimensional tolerance, deburr any support material, and pack each piece in shock-absorbent foam.
        </p>
        <div className="flex items-center gap-2 text-xs text-emerald-800 font-semibold bg-emerald-50 px-3 py-2 rounded-xl border border-emerald-200">
          <ShieldCheckIcon size={16} className="text-emerald-700 shrink-0" />
          <span>Domestic courier tracking information will be provided once your package is dispatched.</span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
        <Link
          href="/cart"
          className="w-full sm:w-auto px-5 py-3.5 rounded-xl border border-neutral-300 text-xs font-bold text-neutral-700 hover:bg-neutral-100 transition-colors flex items-center justify-center gap-2"
        >
          <ArrowLeftIcon size={14} />
          <span>Return to Cart</span>
        </Link>

        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <Link
            href={`/account/orders/${orderNumber}`}
            className="w-full sm:w-auto px-5 py-3.5 rounded-xl border border-neutral-300 text-xs font-bold text-neutral-700 hover:bg-neutral-100 transition-colors flex items-center justify-center gap-2"
          >
            <span>View Order</span>
          </Link>

          <button
            type="button"
            onClick={handlePrint}
            className="w-full sm:w-auto px-5 py-3.5 rounded-xl border border-neutral-300 text-xs font-bold text-neutral-700 hover:bg-neutral-100 transition-colors flex items-center justify-center gap-2 cursor-pointer"
            title="Print or save order summary"
          >
            <span>🖨️ Print Summary</span>
          </button>

          <Link
            href="/shop"
            className="w-full sm:w-auto px-7 py-3.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all duration-200 shadow-sm hover:shadow-md active:scale-98 flex items-center justify-center gap-2"
            style={{
              background: "var(--color-primary)",
              color: "var(--color-neutral-900)",
            }}
          >
            <ShopIcon size={16} />
            <span>Continue Shopping</span>
            <span>→</span>
          </Link>
        </div>
      </div>

      {/* V1 Milestone Note */}
      <p className="text-[11px] text-center text-neutral-400">
        Dearr V1 Customer Storefront · Order Reference: <strong className="text-neutral-600 font-mono">{orderNumber}</strong> · Frontend UI Demo
      </p>
    </div>
  );
}
