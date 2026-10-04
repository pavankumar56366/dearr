import React from "react";
import Link from "next/link";
import { PrinterIcon, ShopIcon } from "@/components/customer/Icons";

export default function CheckoutEmptyState() {
  return (
    <div
      className="max-w-2xl mx-auto my-12 p-8 sm:p-12 rounded-3xl text-center flex flex-col items-center gap-5"
      style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-neutral-100)",
        boxShadow: "var(--shadow-card)",
      }}
    >
      <div
        className="w-20 h-20 rounded-2xl flex items-center justify-center text-primary"
        style={{ background: "rgba(162, 203, 139, 0.15)" }}
      >
        <PrinterIcon size={40} />
      </div>

      <div className="flex flex-col gap-2 max-w-md">
        <h2
          className="text-xl sm:text-2xl font-bold tracking-tight"
          style={{ color: "var(--color-neutral-900)" }}
        >
          Your Checkout Queue is Empty
        </h2>
        <p className="text-sm text-neutral-600 leading-relaxed">
          You don't have any 3D-printed planters, lithophanes, or custom items in your cart. Add products to your cart before proceeding to checkout.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-3 pt-2 w-full justify-center">
        <Link
          href="/shop"
          className="w-full sm:w-auto px-6 h-12 flex items-center justify-center gap-2 rounded-xl font-bold text-xs uppercase tracking-wider transition-all duration-200 shadow-sm hover:shadow-md active:scale-98"
          style={{
            background: "var(--color-primary)",
            color: "var(--color-neutral-900)",
          }}
        >
          <ShopIcon size={16} />
          <span>Browse 3D Printed Catalog</span>
        </Link>

        <Link
          href="/cart"
          className="w-full sm:w-auto px-6 h-12 flex items-center justify-center gap-2 rounded-xl font-bold text-xs uppercase tracking-wider border border-neutral-300 hover:bg-neutral-100 transition-colors text-neutral-800"
        >
          <span>View Shopping Cart</span>
        </Link>
      </div>
    </div>
  );
}
