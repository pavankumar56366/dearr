"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  AdminOrder,
  OrderStatus,
  PaymentStatus,
  getAdminOrderById,
  updateAdminOrderStatus,
} from "@/lib/admin-orders";
import {
  ArrowLeftIcon,
  CheckCircleIcon,
  ClockIcon,
  PackageIcon,
  XCircleIcon,
  UserIcon,
  MapPinIcon,
  CreditCardIcon,
  CopyIcon,
  TagIcon,
  AlertCircleIcon,
  XIcon,
  LayersIcon,
} from "../AdminIcons";
import { AdminOrderNotFound } from "./AdminOrderNotFound";

interface AdminOrderDetailsProps {
  orderId: string;
  initialOrder?: AdminOrder | null;
}

export function AdminOrderDetails({
  orderId,
  initialOrder,
}: AdminOrderDetailsProps) {
  const [order, setOrder] = useState<AdminOrder | null>(initialOrder ?? null);
  const [loading, setLoading] = useState(!initialOrder);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Status update modal state
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [targetStatus, setTargetStatus] = useState<OrderStatus>(
    initialOrder?.orderStatus || "processing"
  );

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  useEffect(() => {
    async function fetchOrder() {
      try {
        const res = await fetch(`/api/admin/orders/${encodeURIComponent(orderId)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.ok && data.order) {
            const o = data.order;
            const mappedOrder: AdminOrder = {
              id: o.id,
              orderNumber: o.orderNumber,
              customer: {
                name: o.shippingFullName || "Customer",
                email: o.customerEmail || "customer@dearr.in",
                phone: o.shippingPhone || "+91 98765 43210",
              },
              items: (o.items || []).map((it: any) => ({
                id: it.id,
                productId: it.productId || "",
                name: it.productName,
                slug: "",
                image: "/product-samples/1.jpeg",
                unitPrice: it.unitPrice,
                quantity: it.quantity,
                lineTotal: it.lineTotal,
                variantName: it.variantName || undefined,
              })),
              subtotal: o.subtotal,
              discountAmount: o.discountAmount,
              shippingAmount: o.shippingAmount,
              totalAmount: o.totalAmount,
              currency: o.currency || "INR",
              orderStatus: o.status,
              paymentStatus: o.paymentStatus,
              paymentMethod: "Razorpay (Online)",
              shippingAddress: {
                fullName: o.shippingFullName,
                phone: o.shippingPhone,
                addressLine1: o.shippingAddressLine1,
                addressLine2: o.shippingAddressLine2 || undefined,
                city: o.shippingCity,
                state: o.shippingState,
                postalCode: o.shippingPostalCode,
                country: o.shippingCountry || "India",
              },
              createdAt: typeof o.createdAt === "string" ? o.createdAt : new Date(o.createdAt).toISOString(),
              updatedAt: typeof o.updatedAt === "string" ? o.updatedAt : new Date(o.updatedAt).toISOString(),
            };
            setOrder(mappedOrder);
            setTargetStatus(mappedOrder.orderStatus);
            setLoading(false);
            return;
          }
        }
      } catch (err) {
        console.warn("Could not fetch order from API, falling back to local:", err);
      }

      const found = getAdminOrderById(orderId);
      if (found) {
        setOrder(found);
        setTargetStatus(found.orderStatus);
      }
      setLoading(false);
    }

    fetchOrder();
  }, [orderId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[350px]">
        <div className="flex flex-col items-center gap-2">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-neutral-500 font-medium">
            Loading order details...
          </span>
        </div>
      </div>
    );
  }

  if (!order) {
    return <AdminOrderNotFound orderIdOrNumber={orderId} />;
  }

  const handleCopy = (text: string, label: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      showToast(`Copied ${label} to clipboard`);
    } else {
      showToast(`${label}: ${text}`);
    }
  };

  const handleConfirmStatusUpdate = async () => {
    try {
      const res = await fetch(`/api/admin/orders/${encodeURIComponent(order.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: targetStatus }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.ok && data.order) {
          setOrder((prev) => prev ? { ...prev, orderStatus: data.order.status } : null);
          showToast(`Order ${data.order.orderNumber} updated to ${data.order.status}`);
          setShowStatusModal(false);
          return;
        }
      } else {
        const data = await res.json().catch(() => ({}));
        showToast(data.error || "Failed to update status on server");
      }
    } catch {
      // Fallback
    }

    const updated = updateAdminOrderStatus(order.id, targetStatus);
    if (updated) {
      setOrder(updated);
      showToast(`Order ${updated.orderNumber} updated to ${updated.orderStatus}`);
    }
    setShowStatusModal(false);
  };

  const renderOrderStatusBadge = (status: OrderStatus) => {
    switch (status) {
      case "pending":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-900 border border-amber-200">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            <span>Pending</span>
          </span>
        );
      case "confirmed":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-900 border border-blue-200">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            <span>Confirmed</span>
          </span>
        );
      case "processing":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-purple-50 text-purple-900 border border-purple-200">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
            <span>Processing</span>
          </span>
        );
      case "shipped":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-900 border border-indigo-200">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
            <span>Shipped</span>
          </span>
        );
      case "delivered":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-primary/20 text-neutral-900 border border-primary/40">
            <span className="w-1.5 h-1.5 rounded-full bg-primary-dark" />
            <span>Delivered</span>
          </span>
        );
      case "cancelled":
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-red-50 text-red-900 border border-red-200">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
            <span>Cancelled</span>
          </span>
        );
    }
  };

  const renderPaymentStatusBadge = (status: PaymentStatus) => {
    switch (status) {
      case "paid":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
            <CheckCircleIcon size={13} className="text-emerald-600" />
            <span>Paid</span>
          </span>
        );
      case "pending":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
            <ClockIcon size={13} className="text-amber-600" />
            <span>Pending</span>
          </span>
        );
      case "failed":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold bg-red-50 text-red-800 border border-red-200">
            <XCircleIcon size={13} className="text-red-600" />
            <span>Failed</span>
          </span>
        );
      case "refunded":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold bg-neutral-100 text-neutral-700 border border-neutral-300">
            <span>Refunded</span>
          </span>
        );
    }
  };

  const formatDateTime = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return isoString;
    }
  };

  // 5-Stage Stepper
  const stages: { key: OrderStatus; label: string }[] = [
    { key: "pending", label: "Received" },
    { key: "confirmed", label: "Confirmed" },
    { key: "processing", label: "3D Printing" },
    { key: "shipped", label: "Dispatched" },
    { key: "delivered", label: "Delivered" },
  ];

  const currentStageIndex =
    order.orderStatus === "cancelled"
      ? -1
      : stages.findIndex((s) => s.key === order.orderStatus);

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-16">
      {/* Toast Notification Banner */}
      {toastMessage && (
        <div
          role="status"
          className="fixed bottom-6 right-6 z-50 bg-neutral-900 text-white text-xs sm:text-sm font-medium px-4 py-3 rounded-xl shadow-lg border border-neutral-700 animate-in fade-in slide-in-from-bottom-2 duration-200 flex items-center gap-2"
        >
          <span className="w-2 h-2 rounded-full bg-primary" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Header & Breadcrumbs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-neutral-200/80">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-semibold text-neutral-500">
            <Link
              href="/admin/orders"
              className="inline-flex items-center gap-1 hover:text-neutral-900 transition-colors"
            >
              <ArrowLeftIcon size={14} />
              <span>Back to Orders</span>
            </Link>
            <span className="text-neutral-300">/</span>
            <span className="text-neutral-800 font-bold font-mono">
              {order.orderNumber}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-neutral-900">
              Order {order.orderNumber}
            </h1>
            <div className="flex items-center gap-2">
              {renderOrderStatusBadge(order.orderStatus)}
              {renderPaymentStatusBadge(order.paymentStatus)}
            </div>
          </div>
          <p className="text-xs text-neutral-500">
            Placed on {formatDateTime(order.createdAt)} • Last updated on{" "}
            {formatDateTime(order.updatedAt)}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => handleCopy(order.orderNumber, "Order #")}
            className="px-3.5 py-2.5 rounded-xl border border-neutral-200 hover:bg-neutral-100 text-xs font-semibold text-neutral-700 transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <CopyIcon size={14} />
            <span>Copy #</span>
          </button>

          <button
            type="button"
            onClick={() => setShowStatusModal(true)}
            className="px-4 py-2.5 rounded-xl bg-primary hover:bg-[#91BC7A] text-neutral-900 font-bold text-xs flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
          >
            <LayersIcon size={15} />
            <span>Update Status</span>
          </button>
        </div>
      </div>

      {/* Fulfillment Progress Stepper */}
      {order.orderStatus === "cancelled" ? (
        <div className="p-4 rounded-2xl bg-red-50/60 border border-red-200 flex items-center gap-3 text-red-900">
          <XCircleIcon size={22} className="text-red-600 shrink-0" />
          <div className="text-xs">
            <div className="font-bold text-sm">This order has been cancelled</div>
            <div className="text-neutral-600 mt-0.5">
              {order.notes || "Fulfillment stopped and customer payment refunded or voided."}
            </div>
          </div>
        </div>
      ) : (
        <div className="p-5 rounded-2xl bg-surface border border-neutral-200/80 shadow-2xs space-y-4">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold uppercase tracking-wider text-neutral-400 text-[11px]">
              Fulfillment Pipeline
            </span>
            <span className="text-neutral-500 font-medium">
              Current stage:{" "}
              <strong className="text-neutral-900 capitalize">
                {order.orderStatus}
              </strong>
            </span>
          </div>

          <div className="grid grid-cols-5 gap-2 relative">
            {stages.map((stage, idx) => {
              const isPast = idx < currentStageIndex;
              const isCurrent = idx === currentStageIndex;

              return (
                <div key={stage.key} className="space-y-2 text-center">
                  <div className="relative flex items-center justify-center">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                        isCurrent
                          ? "bg-primary text-neutral-900 ring-4 ring-primary/20 shadow-xs"
                          : isPast
                          ? "bg-emerald-500 text-white"
                          : "bg-neutral-100 text-neutral-400 border border-neutral-200"
                      }`}
                    >
                      {isPast ? <CheckCircleIcon size={16} /> : idx + 1}
                    </div>
                  </div>
                  <div
                    className={`text-[11px] font-semibold ${
                      isCurrent
                        ? "text-neutral-900 font-bold"
                        : isPast
                        ? "text-neutral-700"
                        : "text-neutral-400"
                    }`}
                  >
                    {stage.label}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Grid: Order Items & Pricing (Left 8 cols) + Customer & Shipping (Right 4 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (8 cols): Line Items & Totals */}
        <div className="lg:col-span-8 space-y-6">
          {/* Purchased Line Items */}
          <section
            aria-label="Order Items"
            className="rounded-2xl bg-surface border border-neutral-200/80 shadow-2xs overflow-hidden"
          >
            <div className="p-4 border-b border-neutral-100 flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-900 flex items-center gap-2">
                <PackageIcon size={16} className="text-primary" />
                <span>Line Items ({order.items.length})</span>
              </h2>
              <span className="text-xs text-neutral-500">
                Custom 3D Fabrication
              </span>
            </div>

            <div className="divide-y divide-neutral-100">
              {order.items.map((item) => (
                <div
                  key={item.id}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="relative w-14 h-14 rounded-xl bg-neutral-100 border border-neutral-200 overflow-hidden shrink-0">
                      <Image
                        src={item.image}
                        alt={item.name}
                        fill
                        sizes="56px"
                        className="object-cover"
                      />
                    </div>
                    <div className="min-w-0 space-y-0.5">
                      <div className="font-semibold text-neutral-900 text-xs sm:text-sm">
                        {item.name}
                      </div>
                      {item.variantName && (
                        <div className="text-[11px] text-neutral-500 font-medium">
                          Variant: {item.variantName}
                        </div>
                      )}
                      <div className="text-[11px] text-neutral-400 font-mono">
                        SKU: {item.productId}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-6 text-xs shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-neutral-50">
                    <div className="text-neutral-500">
                      ₹{item.unitPrice.toLocaleString("en-IN")} × {item.quantity}
                    </div>
                    <div className="font-bold text-neutral-900 text-sm">
                      ₹{item.lineTotal.toLocaleString("en-IN")}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Pricing Breakdown Summary */}
          <section
            aria-label="Payment Summary"
            className="p-5 rounded-2xl bg-surface border border-neutral-200/80 shadow-2xs space-y-3"
          >
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-900 border-b border-neutral-100 pb-2">
              Financial Breakdown
            </h3>

            <div className="space-y-2 text-xs text-neutral-600">
              <div className="flex items-center justify-between">
                <span>Subtotal ({order.items.length} items):</span>
                <span className="font-semibold text-neutral-900">
                  ₹{order.subtotal.toLocaleString("en-IN")}
                </span>
              </div>

              {order.discountAmount > 0 && (
                <div className="flex items-center justify-between text-emerald-700">
                  <span className="flex items-center gap-1.5">
                    <TagIcon size={13} />
                    <span>
                      Discount applied {order.discountCode && `(${order.discountCode})`}:
                    </span>
                  </span>
                  <span className="font-bold">
                    -₹{order.discountAmount.toLocaleString("en-IN")}
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between">
                <span>Standard Delivery:</span>
                <span className="font-semibold text-neutral-900">
                  {order.shippingAmount > 0
                    ? `₹${order.shippingAmount.toLocaleString("en-IN")}`
                    : "Free Shipping (₹0)"}
                </span>
              </div>

              <div className="pt-2 border-t border-neutral-200/80 flex items-center justify-between text-sm sm:text-base font-bold text-neutral-900">
                <span>Total Amount:</span>
                <span className="font-display font-extrabold text-lg sm:text-xl text-neutral-900">
                  ₹{order.totalAmount.toLocaleString("en-IN")}
                </span>
              </div>
            </div>
          </section>
        </div>

        {/* Right Column (4 cols): Customer & Shipping Cards */}
        <aside className="lg:col-span-4 space-y-6">
          {/* Customer Card */}
          <div className="p-5 rounded-2xl bg-surface border border-neutral-200/80 shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-900 flex items-center gap-2">
                <UserIcon size={16} className="text-primary" />
                <span>Customer Profile</span>
              </h3>
            </div>

            <div className="space-y-2 text-xs">
              <div>
                <span className="text-[10px] text-neutral-400 uppercase font-bold block">
                  Name
                </span>
                <span className="font-bold text-neutral-900 text-sm">
                  {order.customer.name}
                </span>
              </div>

              <div>
                <span className="text-[10px] text-neutral-400 uppercase font-bold block">
                  Email
                </span>
                <a
                  href={`mailto:${order.customer.email}`}
                  className="font-semibold text-primary-dark hover:underline"
                >
                  {order.customer.email}
                </a>
              </div>

              <div>
                <span className="text-[10px] text-neutral-400 uppercase font-bold block">
                  Phone
                </span>
                <a
                  href={`tel:${order.customer.phone}`}
                  className="font-mono text-neutral-800 hover:underline"
                >
                  {order.customer.phone}
                </a>
              </div>
            </div>
          </div>

          {/* Shipping Address Card */}
          <div className="p-5 rounded-2xl bg-surface border border-neutral-200/80 shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-900 flex items-center gap-2">
                <MapPinIcon size={16} className="text-primary" />
                <span>Shipping Address</span>
              </h3>
            </div>

            <div className="text-xs leading-relaxed text-neutral-700 space-y-1">
              <div className="font-bold text-neutral-900">
                {order.shippingAddress.fullName}
              </div>
              <div>{order.shippingAddress.addressLine1}</div>
              {order.shippingAddress.addressLine2 && (
                <div>{order.shippingAddress.addressLine2}</div>
              )}
              <div>
                {order.shippingAddress.city}, {order.shippingAddress.state} —{" "}
                {order.shippingAddress.postalCode}
              </div>
              <div className="text-[11px] text-neutral-500 font-semibold pt-1">
                {order.shippingAddress.country}
              </div>
            </div>
          </div>

          {/* Payment & Gateway Reconciliation */}
          <div className="p-5 rounded-2xl bg-surface border border-neutral-200/80 shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-900 flex items-center gap-2">
                <CreditCardIcon size={16} className="text-primary" />
                <span>Payment &amp; Gateway</span>
              </h3>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-neutral-500">Status:</span>
                {renderPaymentStatusBadge(order.paymentStatus)}
              </div>

              <div className="flex items-center justify-between">
                <span className="text-neutral-500">Method:</span>
                <span className="font-semibold text-neutral-800">
                  {order.paymentMethod || "Razorpay Gateway"}
                </span>
              </div>

              {order.discountCode && (
                <div className="flex items-center justify-between">
                  <span className="text-neutral-500">Coupon Used:</span>
                  <span className="font-mono font-bold text-primary-dark bg-primary/10 px-2 py-0.5 rounded border border-primary/20">
                    {order.discountCode}
                  </span>
                </div>
              )}

              {order.notes && (
                <div className="pt-2 border-t border-neutral-100">
                  <span className="text-[10px] text-neutral-400 uppercase font-bold block mb-1">
                    Special Instructions / Notes
                  </span>
                  <p className="text-xs text-neutral-600 bg-neutral-50 p-2.5 rounded-lg border border-neutral-200">
                    {order.notes}
                  </p>
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>

      {/* Status Transition Modal */}
      {showStatusModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150"
          role="dialog"
          aria-modal="true"
          aria-labelledby="order-details-update-status-title"
        >
          <div className="bg-surface rounded-2xl border border-neutral-200 shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-bold bg-neutral-100 px-2 py-0.5 rounded border border-neutral-200">
                  {order.orderNumber}
                </span>
                <span className="text-xs text-neutral-500">Update Status</span>
              </div>
              <button
                type="button"
                onClick={() => setShowStatusModal(false)}
                aria-label="Close status modal"
                className="w-8 h-8 rounded-lg border border-neutral-200 flex items-center justify-center text-neutral-400 hover:text-neutral-700 cursor-pointer"
              >
                <XIcon size={16} />
              </button>
            </div>

            <div className="space-y-1">
              <h3
                id="order-details-update-status-title"
                className="text-base font-bold text-neutral-900"
              >
                Update Fulfillment Status
              </h3>
              <p className="text-xs text-neutral-500">
                Advance or update the operational stage for this order.
              </p>
            </div>

            {order.orderStatus === "delivered" && targetStatus !== "delivered" && (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2">
                <AlertCircleIcon size={16} className="text-amber-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Caution:</strong> This order has already been marked as
                  Delivered. Reverting will re-open production tracking.
                </span>
              </div>
            )}

            <div className="space-y-2 pt-1">
              {(
                [
                  "pending",
                  "confirmed",
                  "processing",
                  "shipped",
                  "delivered",
                  "cancelled",
                ] as OrderStatus[]
              ).map((st) => (
                <label
                  key={st}
                  className={`flex items-center justify-between p-3 rounded-xl border text-xs font-semibold cursor-pointer transition-all ${
                    targetStatus === st
                      ? "bg-primary/20 border-primary text-neutral-900 shadow-2xs"
                      : "bg-white border-neutral-200 text-neutral-700 hover:bg-neutral-50"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="detailsTargetStatus"
                      checked={targetStatus === st}
                      onChange={() => setTargetStatus(st)}
                      className="accent-primary"
                    />
                    <span className="capitalize">{st}</span>
                  </div>
                  {renderOrderStatusBadge(st)}
                </label>
              ))}
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-neutral-100">
              <button
                type="button"
                onClick={() => setShowStatusModal(false)}
                className="px-4 py-2 rounded-xl border border-neutral-200 text-xs font-semibold text-neutral-700 hover:bg-neutral-100 transition-colors cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleConfirmStatusUpdate}
                className="px-4 py-2 rounded-xl bg-primary hover:bg-[#91BC7A] text-neutral-900 text-xs font-bold transition-colors cursor-pointer shadow-xs"
              >
                Save Status
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
