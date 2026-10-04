"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ChevronLeftIcon,
  CheckIcon,
  ClockIcon,
  PackageIcon,
  PrinterIcon,
  ShieldCheckIcon,
  TruckIcon,
  MapPinIcon,
  CreditCardIcon,
} from "@/components/customer/Icons";
import type { DemoOrder } from "@/lib/order-model";
import { getOrderStatusLabel, getOrderStatusColor } from "@/data/demo-orders";

interface OrderDetailProps {
  order: DemoOrder;
}

// 3D Printing Production Timeline steps
interface TimelineStep {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
}

const TIMELINE_STEPS: TimelineStep[] = [
  {
    id: "confirmed",
    label: "Order Received",
    description: "Registered in workshop queue",
    icon: <CheckIcon size={14} className="stroke-[3]" />,
  },
  {
    id: "payment",
    label: "Payment Verified",
    description: "Prepaid confirmation recorded",
    icon: <CreditCardIcon size={14} />,
  },
  {
    id: "processing",
    label: "3D Print Preparation",
    description: "Model slicing & filament staging",
    icon: <PrinterIcon size={14} />,
  },
  {
    id: "qc",
    label: "Quality Inspection",
    description: "Layer-by-layer tolerance check",
    icon: <ShieldCheckIcon size={14} />,
  },
  {
    id: "shipped",
    label: "Packed & Dispatched",
    description: "Shockproof packaging & courier handover",
    icon: <TruckIcon size={14} />,
  },
  {
    id: "delivered",
    label: "Delivered",
    description: "Arrived at delivery address",
    icon: <PackageIcon size={14} />,
  },
];

function getTimelineStepStatus(
  stepId: string,
  orderStatus: string
): "completed" | "current" | "upcoming" {
  const statusOrder = ["confirmed", "payment", "processing", "qc", "shipped", "delivered"];
  const statusMap: Record<string, number> = {
    confirmed: 1,   // Order received + payment verified
    processing: 2,  // 3D print preparation is current
    shipped: 4,     // Packed & dispatched (QC done)
    delivered: 5,   // Delivered
    cancelled: -1,
  };

  const stepIndex = statusOrder.indexOf(stepId);
  const currentLevel = statusMap[orderStatus] ?? 0;

  if (stepIndex < currentLevel) return "completed";
  if (stepIndex === currentLevel) return "current";
  return "upcoming";
}

export default function OrderDetail({ order }: OrderDetailProps) {
  const statusColor = getOrderStatusColor(order.status);
  const statusLabel = getOrderStatusLabel(order.status);
  const orderDate = new Date(order.createdAt).toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const orderTime = new Date(order.createdAt).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="space-y-5">
      {/* Back Navigation */}
      <Link
        href="/account/orders"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-500 hover:text-neutral-900 transition-colors group"
      >
        <ChevronLeftIcon
          size={14}
          className="group-hover:-translate-x-0.5 transition-transform"
        />
        Back to Orders
      </Link>

      {/* Order Header */}
      <div className="rounded-2xl border border-neutral-200 bg-surface shadow-card overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4 sm:px-6 border-b border-neutral-100">
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-neutral-900 tracking-tight">
              Order {order.orderNumber}
            </h1>
            <div className="flex items-center gap-1.5 text-xs text-neutral-500 mt-0.5">
              <ClockIcon size={12} className="shrink-0" />
              <span>
                {orderDate} at {orderTime}
              </span>
            </div>
          </div>
          <div
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border self-start ${statusColor.bg} ${statusColor.text} ${statusColor.border}`}
          >
            <span
              className={`w-2 h-2 rounded-full ${statusColor.dot}`}
              aria-hidden="true"
            />
            {statusLabel}
          </div>
        </div>

        {/* Status Timeline */}
        {order.status !== "cancelled" && (
          <div className="px-5 py-5 sm:px-6">
            <h2 className="text-sm font-bold text-neutral-900 mb-4">
              3D Print Production Timeline
            </h2>
            <ol className="relative flex flex-col gap-4 before:absolute before:left-[13px] before:top-2 before:bottom-2 before:w-0.5 before:bg-neutral-200">
              {TIMELINE_STEPS.map((step) => {
                const stepStatus = getTimelineStepStatus(step.id, order.status);
                const isCompleted = stepStatus === "completed";
                const isCurrent = stepStatus === "current";

                return (
                  <li
                    key={step.id}
                    aria-current={isCurrent ? "step" : undefined}
                    className="relative flex items-start gap-3.5 pl-0"
                  >
                    <div
                      className={`relative z-10 w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                        isCompleted
                          ? "bg-[#2A7C13] text-white"
                          : isCurrent
                          ? "bg-primary text-neutral-900 ring-4 ring-primary/20"
                          : "bg-neutral-100 text-neutral-400 border border-neutral-200"
                      }`}
                    >
                      {step.icon}
                    </div>
                    <div className="min-w-0 pt-0.5">
                      <p
                        className={`text-xs font-bold ${
                          isCurrent
                            ? "text-neutral-900"
                            : isCompleted
                            ? "text-neutral-700"
                            : "text-neutral-400"
                        }`}
                      >
                        {step.label}
                        {isCurrent && (
                          <span className="ml-2 text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-secondary text-neutral-900">
                            Active
                          </span>
                        )}
                      </p>
                      <p className="text-[11px] text-neutral-500">
                        {step.description}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        )}
      </div>

      {/* Order Items */}
      <div className="rounded-2xl border border-neutral-200 bg-surface shadow-card overflow-hidden">
        <div className="px-5 py-4 sm:px-6 border-b border-neutral-100">
          <h2 className="text-sm font-bold text-neutral-900">
            Ordered Products ({order.items.length})
          </h2>
        </div>
        <div className="divide-y divide-neutral-100">
          {order.items.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-4 px-5 py-4 sm:px-6"
            >
              <Link
                href={`/product/${item.slug}`}
                className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl bg-neutral-50 overflow-hidden shrink-0 relative border border-neutral-200 hover:border-primary transition-colors"
              >
                <Image
                  src={item.image}
                  alt={item.productName}
                  fill
                  sizes="80px"
                  className="object-cover"
                />
              </Link>
              <div className="flex-1 min-w-0">
                <Link
                  href={`/product/${item.slug}`}
                  className="text-sm font-semibold text-neutral-900 hover:text-primary transition-colors line-clamp-2"
                >
                  {item.productName}
                </Link>
                <div className="flex items-center gap-3 mt-1 text-xs text-neutral-500">
                  <span>Qty: {item.quantity}</span>
                  <span className="text-neutral-300">•</span>
                  <span>₹{item.unitPrice.toLocaleString("en-IN")} each</span>
                </div>
              </div>
              <p className="text-sm font-bold text-neutral-900 shrink-0">
                ₹{item.lineTotal.toLocaleString("en-IN")}
              </p>
            </div>
          ))}
        </div>

        {/* Price Summary */}
        <div className="px-5 py-4 sm:px-6 border-t border-neutral-200 bg-neutral-50/50 space-y-2">
          <div className="flex justify-between text-xs text-neutral-600">
            <span>Subtotal</span>
            <span>₹{order.subtotal.toLocaleString("en-IN")}</span>
          </div>
          <div className="flex justify-between text-xs text-neutral-600">
            <span>Shipping</span>
            <span className="text-emerald-700 font-medium">
              {order.shippingAmount === 0 ? "Free" : `₹${order.shippingAmount}`}
            </span>
          </div>
          {order.discountAmount > 0 && (
            <div className="flex justify-between text-xs text-emerald-700">
              <span>Discount</span>
              <span>-₹{order.discountAmount.toLocaleString("en-IN")}</span>
            </div>
          )}
          <div className="flex justify-between text-sm font-bold text-neutral-900 pt-2 border-t border-neutral-200">
            <span>Total</span>
            <span>₹{order.totalAmount.toLocaleString("en-IN")}</span>
          </div>
        </div>
      </div>

      {/* Delivery Address & Payment */}
      <div className="grid gap-4 sm:grid-cols-2">
        {/* Address Snapshot */}
        <div className="rounded-2xl border border-neutral-200 bg-surface shadow-card p-5 sm:p-6">
          <div className="flex items-center gap-2 mb-3">
            <MapPinIcon size={16} className="text-neutral-500" />
            <h2 className="text-sm font-bold text-neutral-900">
              Delivery Address
            </h2>
          </div>
          <div className="text-xs text-neutral-600 leading-relaxed space-y-0.5">
            <p className="font-semibold text-neutral-900">
              {order.shippingFullName}
            </p>
            <p>{order.shippingAddressLine1}</p>
            {order.shippingAddressLine2 && <p>{order.shippingAddressLine2}</p>}
            <p>
              {order.shippingCity}, {order.shippingState}{" "}
              {order.shippingPostalCode}
            </p>
            <p>{order.shippingCountry}</p>
            <p className="mt-1 text-neutral-500">{order.shippingPhone}</p>
          </div>
        </div>

        {/* Payment Info */}
        <div className="rounded-2xl border border-neutral-200 bg-surface shadow-card p-5 sm:p-6">
          <div className="flex items-center gap-2 mb-3">
            <CreditCardIcon size={16} className="text-neutral-500" />
            <h2 className="text-sm font-bold text-neutral-900">
              Payment Details
            </h2>
          </div>
          <div className="text-xs text-neutral-600 space-y-2">
            <div className="flex justify-between">
              <span className="text-neutral-500">Method</span>
              <span className="font-medium text-neutral-900">
                {order.paymentMethod}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-500">Status</span>
              <span
                className={`font-semibold capitalize ${
                  order.paymentStatus === "paid"
                    ? "text-emerald-700"
                    : order.paymentStatus === "simulated"
                    ? "text-amber-700"
                    : "text-neutral-500"
                }`}
              >
                {order.paymentStatus === "simulated"
                  ? "Simulated (Demo)"
                  : order.paymentStatus}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-500">Amount</span>
              <span className="font-bold text-neutral-900">
                ₹{order.totalAmount.toLocaleString("en-IN")}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Action Row */}
      <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
        <Link
          href="/account/orders"
          className="w-full sm:w-auto h-11 px-6 rounded-xl border border-neutral-300 text-neutral-700 hover:bg-neutral-50 text-sm font-medium transition-all active:scale-95 flex items-center justify-center gap-2"
        >
          ← All Orders
        </Link>
        <Link
          href="/shop"
          className="w-full sm:w-auto h-11 px-6 rounded-xl bg-primary hover:bg-[#91BC7A] text-neutral-900 text-sm font-semibold transition-all active:scale-95 flex items-center justify-center gap-2"
        >
          Continue Shopping
        </Link>
      </div>
    </div>
  );
}
