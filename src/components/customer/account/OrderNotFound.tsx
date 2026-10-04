import React from "react";
import Link from "next/link";
import { AlertCircleIcon, ShopIcon } from "@/components/customer/Icons";

interface OrderNotFoundProps {
  orderNumber?: string;
}

export default function OrderNotFound({ orderNumber }: OrderNotFoundProps) {
  return (
    <section
      aria-labelledby="order-not-found-heading"
      className="flex flex-col items-center justify-center text-center py-16 sm:py-20 px-4"
    >
      <div className="w-20 h-20 rounded-2xl bg-red-50 flex items-center justify-center mb-5">
        <AlertCircleIcon size={36} className="text-red-300" />
      </div>

      <h1
        id="order-not-found-heading"
        className="text-lg sm:text-xl font-bold text-neutral-900 mb-2"
      >
        Order Not Found
      </h1>

      <p className="text-sm text-neutral-500 max-w-sm mb-6 leading-relaxed">
        {orderNumber ? (
          <>
            We couldn&apos;t find an order with number{" "}
            <span className="font-semibold text-neutral-700">{orderNumber}</span>.
            Please check the order reference and try again.
          </>
        ) : (
          "The order you're looking for doesn't exist or may have been removed."
        )}
      </p>

      <div className="flex flex-col sm:flex-row items-center gap-3">
        <Link
          href="/account/orders"
          className="h-11 px-6 rounded-xl border border-neutral-300 text-neutral-700 hover:bg-neutral-50 text-sm font-medium transition-all active:scale-95 flex items-center justify-center"
        >
          ← Back to Orders
        </Link>
        <Link
          href="/shop"
          className="h-11 px-6 rounded-xl bg-primary hover:bg-[#91BC7A] text-neutral-900 text-sm font-semibold transition-all active:scale-95 flex items-center justify-center gap-2"
        >
          <ShopIcon size={16} />
          Explore 3D Prints
        </Link>
      </div>
    </section>
  );
}
