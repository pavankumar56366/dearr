"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import type { CartItem } from "@/context/CartContext";
import type { DeliveryAddressFormValues } from "@/lib/checkout-validation";
import { CheckIcon, PrinterIcon, ShieldCheckIcon, TruckIcon } from "@/components/customer/Icons";

interface CheckoutDemoSuccessProps {
  orderNumber: string;
  items: CartItem[];
  subtotal: number;
  totalCount: number;
  address: DeliveryAddressFormValues;
  onReset: () => void;
}

export default function CheckoutDemoSuccess({
  orderNumber,
  items,
  subtotal,
  totalCount,
  address,
  onReset,
}: CheckoutDemoSuccessProps) {
  return (
    <div
      className="max-w-3xl mx-auto my-6 p-6 sm:p-10 rounded-3xl flex flex-col gap-8 animate-in fade-in zoom-in-95 duration-300"
      style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-neutral-100)",
        boxShadow: "var(--shadow-card)",
      }}
    >
      {/* Header Banner */}
      <div className="flex flex-col items-center text-center gap-3 pb-6 border-b border-neutral-100">
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center text-white shadow-md"
          style={{ background: "var(--color-success)" }}
        >
          <CheckIcon size={32} className="stroke-[3]" />
        </div>

        <div className="flex flex-col gap-1">
          <span
            className="text-[11px] font-extrabold uppercase tracking-widest px-3 py-1 rounded-full self-center"
            style={{ background: "rgba(42, 124, 19, 0.1)", color: "var(--color-success)" }}
          >
            Frontend Checkout Simulation Verified
          </span>
          <h2
            className="text-2xl sm:text-3xl font-extrabold tracking-tight mt-1"
            style={{ color: "var(--color-neutral-900)" }}
          >
            Order Details Prepared!
          </h2>
          <p className="text-xs sm:text-sm text-neutral-600 max-w-md">
            Order Reference: <strong className="text-neutral-900 font-mono">{orderNumber}</strong>
          </p>
        </div>
      </div>



      {/* Order Snapshot & Delivery Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Delivery Details Card */}
        <div className="p-4 sm:p-5 rounded-2xl bg-neutral-50 border border-neutral-200 flex flex-col gap-2.5">
          <div className="flex items-center gap-2 font-bold text-neutral-900 text-xs uppercase tracking-wider">
            <TruckIcon size={16} className="text-primary" />
            <span>Shipping Destination</span>
          </div>
          <div className="text-xs text-neutral-700 flex flex-col gap-1">
            <p className="font-bold text-neutral-900">{address.fullName}</p>
            <p>Phone: +91 {address.phone}</p>
            <p>Email: {address.email}</p>
            <p className="text-neutral-600 mt-1 leading-relaxed">
              {address.addressLine1}
              {address.addressLine2 ? `, ${address.addressLine2}` : ""}
              <br />
              {address.city}, {address.state} - {address.postalCode}
              <br />
              {address.country}
            </p>
          </div>
        </div>

        {/* Payment Simulation Card */}
        <div className="p-4 sm:p-5 rounded-2xl bg-neutral-50 border border-neutral-200 flex flex-col gap-2.5">
          <div className="flex items-center gap-2 font-bold text-neutral-900 text-xs uppercase tracking-wider">
            <PrinterIcon size={16} className="text-primary" />
            <span>Workshop Fulfillment Queue</span>
          </div>
          <div className="text-xs text-neutral-700 flex flex-col gap-1.5">
            <p className="flex justify-between">
              <span className="text-neutral-500">Method:</span>
              <span className="font-semibold text-neutral-900">Razorpay (Prepaid Online)</span>
            </p>
            <p className="flex justify-between">
              <span className="text-neutral-500">Logistics:</span>
              <span className="font-semibold text-emerald-700">Standard 3D Print Logistics</span>
            </p>
            <p className="flex justify-between">
              <span className="text-neutral-500">Total Items:</span>
              <span className="font-semibold text-neutral-900">{totalCount} items</span>
            </p>
            <div className="pt-2 border-t border-neutral-200 flex justify-between items-baseline">
              <span className="font-bold text-neutral-900">Total Amount:</span>
              <span className="text-lg font-black text-neutral-900">₹{subtotal.toLocaleString("en-IN")}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Items Snapshot Table */}
      <div className="flex flex-col gap-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-700">
          Items Ordered ({totalCount})
        </h3>
        <div className="border border-neutral-200 rounded-2xl divide-y divide-neutral-100 overflow-hidden bg-white">
          {items.map((item) => (
            <div key={item.id} className="p-3.5 flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-3">
                <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-neutral-100 border border-neutral-200 shrink-0">
                  <Image src={item.image} alt={item.name} fill className="object-cover" sizes="48px" />
                </div>
                <div className="flex flex-col">
                  <span className="font-bold text-neutral-900">{item.name}</span>
                  {item.variantName && (
                    <span className="text-[11px] text-neutral-500">Variant: {item.variantName}</span>
                  )}
                  <span className="text-[11px] text-neutral-500">
                    Qty: {item.quantity} × ₹{item.price.toLocaleString("en-IN")}
                  </span>
                </div>
              </div>
              <span className="font-bold text-neutral-900 shrink-0">
                ₹{(item.price * item.quantity).toLocaleString("en-IN")}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Navigation Buttons */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-neutral-100">
        <button
          type="button"
          onClick={onReset}
          className="w-full sm:w-auto px-5 py-3 rounded-xl border border-neutral-300 text-xs font-bold text-neutral-700 hover:bg-neutral-100 transition-colors"
        >
          ← Edit Delivery Information
        </button>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <Link
            href="/cart"
            className="w-full sm:w-auto px-5 py-3 rounded-xl border border-neutral-300 text-xs font-bold text-neutral-700 hover:bg-neutral-100 transition-colors text-center"
          >
            Return to Cart
          </Link>

          <Link
            href="/shop"
            className="w-full sm:w-auto px-6 py-3 rounded-xl font-bold text-xs uppercase tracking-wider text-center transition-all shadow-sm hover:shadow-md"
            style={{
              background: "var(--color-primary)",
              color: "var(--color-neutral-900)",
            }}
          >
            Continue Shopping →
          </Link>
        </div>
      </div>
    </div>
  );
}
