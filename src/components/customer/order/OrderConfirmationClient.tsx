"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  type DemoOrder,
  adminOrderToDemoOrder,
} from "@/lib/order-model";
import {
  getAdminOrderById,
  getAllAdminOrders,
} from "@/lib/admin-orders";
import OrderStatusTimeline from "./OrderStatusTimeline";
import OrderShippingSnapshot from "./OrderShippingSnapshot";
import OrderItemSummary from "./OrderItemSummary";
import OrderConfirmationActions from "./OrderConfirmationActions";
import OrderDirectAccessFallback from "./OrderDirectAccessFallback";
import { CheckIcon, ChevronRightIcon, ShieldCheckIcon } from "@/components/customer/Icons";

export default function OrderConfirmationClient() {
  const searchParams = useSearchParams();
  const orderNumberParam = searchParams.get("orderNumber") || undefined;

  const [order, setOrder] = useState<DemoOrder | null>(null);
  const [hasCheckedState, setHasCheckedState] = useState(false);

  useEffect(() => {
    async function loadConfirmation() {
      // 1. If orderNumber param is present, try real API first
      if (orderNumberParam) {
        try {
          const res = await fetch(`/api/orders/${encodeURIComponent(orderNumberParam)}`);
          if (res.ok) {
            const data = await res.json();
            if (data.ok && data.order) {
              const o = data.order;
              setOrder({
                id: o.id,
                orderNumber: o.orderNumber,
                status: o.status,
                paymentStatus: o.paymentStatus,
                paymentMethod: o.paymentStatus === "paid" ? "Razorpay (Paid)" : "Razorpay (Pending)",
                subtotal: o.subtotal,
                shippingAmount: o.shippingAmount,
                discountAmount: o.discountAmount,
                totalAmount: o.totalAmount,
                currency: o.currency || "INR",
                shippingFullName: o.shippingFullName,
                shippingPhone: o.shippingPhone,
                shippingEmail: "customer@dearr.in",
                shippingAddressLine1: o.shippingAddressLine1,
                shippingAddressLine2: o.shippingAddressLine2 || undefined,
                shippingCity: o.shippingCity,
                shippingState: o.shippingState,
                shippingPostalCode: o.shippingPostalCode,
                shippingCountry: o.shippingCountry || "India",
                createdAt: typeof o.createdAt === "string" ? o.createdAt : new Date(o.createdAt).toISOString(),
                items: (o.items || []).map((it: any) => ({
                  id: it.id,
                  productId: it.productId || "",
                  productName: it.productName,
                  variantName: it.variantName || undefined,
                  image: "/product-samples/1.jpeg",
                  unitPrice: it.unitPrice,
                  quantity: it.quantity,
                  discountAmount: it.discountAmount,
                  lineTotal: it.lineTotal,
                })),
              });
              setHasCheckedState(true);
              return;
            }
          }
        } catch {
          // Fallback to local
        }

        const found = getAdminOrderById(orderNumberParam);
        if (found) {
          setOrder(adminOrderToDemoOrder(found));
          setHasCheckedState(true);
          return;
        }
      }

      // 2. Fall back to the most recently created order in admin orders session
      const all = getAllAdminOrders();
      if (all.length > 0) {
        setOrder(adminOrderToDemoOrder(all[0]));
        setHasCheckedState(true);
        return;
      }

      // 3. Direct access without state
      setHasCheckedState(true);
    }

    loadConfirmation();
  }, [orderNumberParam]);

  // Loading indicator while resolving client session
  if (!hasCheckedState) {
    return (
      <div
        className="min-h-screen flex items-center justify-center pb-32 md:pb-20"
        style={{ background: "var(--color-canvas)" }}
      >
        <div className="flex flex-col items-center gap-3">
          <svg className="animate-spin h-8 w-8 text-neutral-800" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          <span className="text-xs font-semibold text-neutral-600">Loading Order Confirmation...</span>
        </div>
      </div>
    );
  }

  // Graceful fallback if opened directly without order or cart items
  if (!order) {
    return (
      <div
        className="min-h-screen pb-32 md:pb-20"
        style={{ background: "var(--color-canvas)" }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
          <nav aria-label="Breadcrumb" className="pb-4">
            <ol className="flex items-center gap-1.5 text-xs font-medium text-neutral-500">
              <li>
                <Link href="/" className="inline-flex items-center py-2 px-1 -my-2 -mx-0.5 rounded-sm hover:underline hover:text-neutral-900 focus-visible:outline-2 focus-visible:outline-primary">Home</Link>
              </li>
              <li aria-hidden="true" className="text-neutral-400">
                <ChevronRightIcon size={12} />
              </li>
              <li aria-current="page" className="font-bold text-neutral-800">
                Order Confirmation
              </li>
            </ol>
          </nav>

          <OrderDirectAccessFallback />
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen pb-32 md:pb-20"
      style={{ background: "var(--color-canvas)" }}
    >
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6">
        {/* Breadcrumb Navigation */}
        <nav aria-label="Breadcrumb" className="pb-4">
          <ol className="flex items-center gap-1.5 text-xs font-medium text-neutral-500">
            <li>
              <Link href="/" className="inline-flex items-center py-2 px-1 -my-2 -mx-0.5 rounded-sm hover:underline hover:text-neutral-900 focus-visible:outline-2 focus-visible:outline-primary">Home</Link>
            </li>
            <li aria-hidden="true" className="text-neutral-400">
              <ChevronRightIcon size={12} />
            </li>
            <li>
              <Link href="/cart" className="inline-flex items-center py-2 px-1 -my-2 -mx-0.5 rounded-sm hover:underline hover:text-neutral-900 focus-visible:outline-2 focus-visible:outline-primary">Cart</Link>
            </li>
            <li aria-hidden="true" className="text-neutral-400">
              <ChevronRightIcon size={12} />
            </li>
            <li aria-current="page" className="font-bold text-neutral-800">
              Order Confirmed
            </li>
          </ol>
        </nav>

        {/* Confirmation Hero Card */}
        <header
          role="status"
          aria-live="polite"
          className="rounded-3xl p-6 sm:p-10 mb-8 text-center flex flex-col items-center gap-4 animate-in fade-in duration-300"
          style={{
            background: "var(--color-surface)",
            border: "1px solid var(--color-neutral-100)",
            boxShadow: "var(--shadow-card)",
          }}
        >
          {/* Animated Success Badge */}
          <div
            className="w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center text-white shadow-lg scale-in-95"
            style={{ background: "var(--color-success)" }}
            aria-hidden="true"
          >
            <CheckIcon size={36} className="stroke-[3]" />
          </div>

          <div className="flex flex-col gap-1 max-w-xl">
            <span
              className="text-[11px] font-extrabold uppercase tracking-widest px-3 py-1 rounded-full self-center"
              style={{ background: "rgba(42, 124, 19, 0.1)", color: "var(--color-success)" }}
            >
              Order Successfully Received
            </span>

            <h1
              className="text-2xl sm:text-4xl font-extrabold tracking-tight mt-1"
              style={{ color: "var(--color-neutral-900)" }}
            >
              Thank You for Your Order!
            </h1>

            <p className="text-xs sm:text-sm text-neutral-600 mt-1">
              Order Reference: <strong className="text-neutral-900 font-mono text-sm sm:text-base">{order.orderNumber}</strong>
            </p>
          </div>

          <div className="mt-2 p-3.5 max-w-2xl rounded-2xl bg-emerald-50/90 border border-emerald-200 text-xs text-emerald-950 flex items-start gap-2.5 text-left leading-relaxed">
            <ShieldCheckIcon size={18} className="text-emerald-700 shrink-0 mt-0.5" />
            <div>
              <strong>Order Confirmed & Secured:</strong> Your 3D print order snapshot and production timeline have been registered in our workshop queue with verified payment status.
            </div>
          </div>
        </header>

        {/* 2-Column Responsive Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start mb-8">
          {/* Left Column: Timeline + Shipping Details */}
          <div className="lg:col-span-7 flex flex-col gap-8">
            <OrderStatusTimeline currentStatus={order.status} />
            <OrderShippingSnapshot order={order} />
          </div>

          {/* Right Column: Ordered Items & Totals */}
          <div className="lg:col-span-5 w-full">
            <OrderItemSummary order={order} />
          </div>
        </div>

        {/* Bottom Actions and Workshop Guidance */}
        <OrderConfirmationActions orderNumber={order.orderNumber} />
      </main>
    </div>
  );
}
