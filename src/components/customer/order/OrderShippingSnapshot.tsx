import React from "react";
import type { DemoOrder } from "@/lib/order-model";
import { CreditCardIcon, MapPinIcon, TruckIcon } from "@/components/customer/Icons";

interface OrderShippingSnapshotProps {
  order: DemoOrder;
}

export default function OrderShippingSnapshot({ order }: OrderShippingSnapshotProps) {
  return (
    <section
      aria-labelledby="shipping-snapshot-heading"
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
          <TruckIcon size={18} />
        </div>
        <div>
          <h2
            id="shipping-snapshot-heading"
            className="text-base sm:text-lg font-bold tracking-tight"
            style={{ color: "var(--color-neutral-900)" }}
          >
            Delivery & Recipient Snapshot
          </h2>
          <p className="text-xs text-neutral-500 font-medium">
            Delivery address verified from customer checkout
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs text-neutral-700">
        {/* Recipient & Address */}
        <div className="p-4 rounded-xl bg-neutral-50 border border-neutral-200 flex flex-col gap-2">
          <div className="flex items-center gap-1.5 font-bold text-neutral-900 uppercase tracking-wider text-[11px]">
            <MapPinIcon size={14} className="text-primary" />
            <span>Shipping Address</span>
          </div>
          <p className="font-bold text-sm text-neutral-900">{order.shippingFullName}</p>
          <p className="text-neutral-600 leading-relaxed">
            {order.shippingAddressLine1}
            {order.shippingAddressLine2 ? `, ${order.shippingAddressLine2}` : ""}
            <br />
            {order.shippingCity}, {order.shippingState} - {order.shippingPostalCode}
            <br />
            {order.shippingCountry}
          </p>
          <div className="pt-2 border-t border-neutral-200 flex flex-col gap-1 text-[11px] text-neutral-600">
            <p>
              <strong className="text-neutral-800">Phone:</strong> +91 {order.shippingPhone}
            </p>
            <p>
              <strong className="text-neutral-800">Email:</strong> {order.shippingEmail}
            </p>
          </div>
        </div>

        {/* Payment & Logistics Method */}
        <div className="p-4 rounded-xl bg-neutral-50 border border-neutral-200 flex flex-col gap-3">
          <div className="flex items-center gap-1.5 font-bold text-neutral-900 uppercase tracking-wider text-[11px]">
            <CreditCardIcon size={14} className="text-primary" />
            <span>Payment & Dispatch Details</span>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-center">
              <span className="text-neutral-500">Payment Provider:</span>
              <span className="font-semibold text-neutral-900">{order.paymentMethod}</span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-neutral-500">Payment Status:</span>
              <span
                className={`font-bold px-2 py-0.5 rounded text-[11px] ${
                  order.paymentStatus === "paid"
                    ? "text-emerald-700 bg-emerald-50"
                    : "text-amber-700 bg-amber-50"
                }`}
              >
                {order.paymentStatus === "paid"
                  ? "Paid"
                  : order.paymentStatus === "refunded"
                  ? "Refunded"
                  : "Pending Payment"}
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-neutral-500">Logistics Partner:</span>
              <span className="font-semibold text-neutral-900">Standard 3D Print Logistics</span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-neutral-500">Packaging:</span>
              <span className="font-semibold text-neutral-900">Shockproof Foam & Sealed Box</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
