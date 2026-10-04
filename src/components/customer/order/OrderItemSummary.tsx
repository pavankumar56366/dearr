import React from "react";
import Image from "next/image";
import Link from "next/link";
import type { DemoOrder } from "@/lib/order-model";
import { PackageIcon, ShieldCheckIcon } from "@/components/customer/Icons";

interface OrderItemSummaryProps {
  order: DemoOrder;
}

export default function OrderItemSummary({ order }: OrderItemSummaryProps) {
  const totalItemCount = order.items.reduce((acc, item) => acc + item.quantity, 0);

  return (
    <section
      aria-labelledby="order-items-heading"
      className="rounded-2xl p-5 sm:p-7 flex flex-col gap-6"
      style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-neutral-100)",
        boxShadow: "var(--shadow-card)",
      }}
    >
      <div className="flex items-center justify-between pb-4 border-b border-neutral-100">
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: "rgba(162, 203, 139, 0.2)", color: "var(--color-neutral-900)" }}
          >
            <PackageIcon size={18} />
          </div>
          <div>
            <h2
              id="order-items-heading"
              className="text-base sm:text-lg font-bold tracking-tight"
              style={{ color: "var(--color-neutral-900)" }}
            >
              Purchased Items Snapshot ({totalItemCount} {totalItemCount === 1 ? "item" : "items"})
            </h2>
            <p className="text-xs text-neutral-500 font-medium">
              3D print specifications registered for this order
            </p>
          </div>
        </div>
      </div>

      {/* Items List */}
      <div className="flex flex-col divide-y divide-neutral-100 border border-neutral-200 rounded-2xl overflow-hidden bg-white">
        {order.items.map((item) => (
          <div
            key={item.id}
            className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
          >
            <div className="flex items-center gap-4 min-w-0">
              {/* Product Thumbnail */}
              <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden bg-neutral-100 border border-neutral-200 shrink-0">
                <Image
                  src={item.image}
                  alt={item.productName}
                  fill
                  className="object-cover"
                  sizes="80px"
                />
              </div>

              {/* Product Info */}
              <div className="flex flex-col gap-1 min-w-0">
                <Link
                  href={`/product/${item.slug}`}
                  className="text-sm font-bold text-neutral-900 hover:text-[#2A7C13] hover:underline truncate transition-colors"
                >
                  {item.productName}
                </Link>
                {item.variantName && (
                  <span className="text-xs font-semibold text-neutral-500">
                    Finish / Color: <strong className="text-neutral-700">{item.variantName}</strong>
                  </span>
                )}
                <div className="flex items-center gap-2 text-xs text-neutral-600 mt-0.5">
                  <span>Qty: <strong className="text-neutral-900">{item.quantity}</strong></span>
                  <span>·</span>
                  <span>Unit Price: <strong>₹{item.unitPrice.toLocaleString("en-IN")}</strong></span>
                </div>
              </div>
            </div>

            {/* Line Total */}
            <div className="text-right sm:self-center shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-neutral-100 flex sm:flex-col justify-between sm:justify-center items-baseline sm:items-end">
              <span className="sm:hidden text-xs text-neutral-500">Line Total:</span>
              <span className="text-sm sm:text-base font-extrabold text-neutral-900">
                ₹{item.lineTotal.toLocaleString("en-IN")}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Pricing Breakdown */}
      <div className="p-4 sm:p-5 rounded-xl bg-neutral-50 border border-neutral-200 flex flex-col gap-2.5 text-xs sm:text-sm">
        <div className="flex items-center justify-between text-neutral-600">
          <span>Items Subtotal</span>
          <span className="font-semibold text-neutral-900">
            ₹{order.subtotal.toLocaleString("en-IN")}
          </span>
        </div>

        <div className="flex items-center justify-between text-neutral-600">
          <span>Domestic Logistics</span>
          <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
            Free Shipping
          </span>
        </div>

        <div className="flex items-center justify-between text-neutral-600">
          <span>Taxes</span>
          <span className="text-xs text-neutral-500 font-medium">
            Inclusive of all GST
          </span>
        </div>

        <div className="pt-3 border-t border-neutral-200 flex items-baseline justify-between">
          <span className="font-bold text-sm sm:text-base text-neutral-900">
            Total Amount (INR)
          </span>
          <span
            className="text-xl sm:text-2xl font-black tracking-tight"
            style={{ color: "var(--color-neutral-900)" }}
          >
            ₹{order.totalAmount.toLocaleString("en-IN")}
          </span>
        </div>
      </div>

      {/* Workshop Quality Note */}
      <div className="flex items-center gap-2 text-xs text-neutral-500 pt-1">
        <ShieldCheckIcon size={16} className="text-emerald-600 shrink-0" />
        <span>Fabricated in our precision workshop using industrial-grade thermoplastic extruders.</span>
      </div>
    </section>
  );
}
