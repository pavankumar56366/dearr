import React from "react";
import Link from "next/link";
import { ShopIcon, PackageIcon } from "@/components/customer/Icons";

export default function AccountEmptyOrders() {
  return (
    <section
      aria-labelledby="empty-orders-heading"
      className="flex flex-col items-center justify-center text-center py-12 sm:py-16 px-4"
    >
      <div className="w-20 h-20 rounded-2xl bg-neutral-100 flex items-center justify-center mb-5">
        <PackageIcon size={36} className="text-neutral-300" />
      </div>

      <h2
        id="empty-orders-heading"
        className="text-lg sm:text-xl font-bold text-neutral-900 mb-2"
      >
        No orders yet
      </h2>

      <p className="text-sm text-neutral-500 max-w-sm mb-6 leading-relaxed">
        Your 3D print order history will appear here once you&apos;ve placed
        your first order. Explore our precision-crafted collection to get started.
      </p>

      <Link
        href="/shop"
        className="inline-flex items-center gap-2 h-12 px-7 rounded-xl bg-primary hover:bg-[#91BC7A] text-neutral-900 text-sm font-semibold transition-all active:scale-95 shadow-sm"
      >
        <ShopIcon size={18} />
        Explore 3D Prints
      </Link>
    </section>
  );
}
