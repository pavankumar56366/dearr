"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ChevronLeftIcon,
  CheckIcon,
  ClockIcon,
  PackageIcon,
  TruckIcon,
  MapPinIcon,
  CreditCardIcon,
  AlertCircleIcon,
} from "@/components/customer/Icons";
import type { DemoOrder } from "@/lib/order-model";
import { getOrderStatusLabel, getOrderStatusColor } from "@/data/demo-orders";
import {
  getOrderTrackingStages,
  type TrackingStage,
} from "@/lib/order-tracking";

interface OrderDetailProps {
  order: DemoOrder;
}

function getStageIcon(iconType: TrackingStage["iconType"]) {
  switch (iconType) {
    case "check":
      return <CheckIcon size={14} className="stroke-[3]" />;
    case "card":
      return <CreditCardIcon size={14} />;
    case "truck":
      return <TruckIcon size={14} />;
    case "package":
      return <PackageIcon size={14} />;
    case "alert":
      return <AlertCircleIcon size={14} />;
    default:
      return <CheckIcon size={14} className="stroke-[3]" />;
  }
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

  const [currentAddress, setCurrentAddress] = React.useState({
    shippingFullName: order.shippingFullName,
    shippingPhone: order.shippingPhone,
    shippingAddressLine1: order.shippingAddressLine1,
    shippingAddressLine2: order.shippingAddressLine2,
    shippingCity: order.shippingCity,
    shippingState: order.shippingState,
    shippingPostalCode: order.shippingPostalCode,
    shippingCountry: order.shippingCountry || "India",
  });

  const [eligibility, setEligibility] = React.useState<{
    allowed: boolean;
    reason: string | null;
    deadline: string | null;
    serverNow: string;
    changesUsed: number;
    changesLeft: number;
    maxChanges: number;
  } | null>(null);

  const [remainingSeconds, setRemainingSeconds] = React.useState<number | null>(null);
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [modalStep, setModalStep] = React.useState<"form" | "confirm">("form");
  const [formValues, setFormValues] = React.useState({
    fullName: order.shippingFullName,
    phone: order.shippingPhone,
    addressLine1: order.shippingAddressLine1,
    addressLine2: order.shippingAddressLine2 || "",
    city: order.shippingCity,
    state: order.shippingState,
    postalCode: order.shippingPostalCode,
  });
  const [formErrors, setFormErrors] = React.useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [successBanner, setSuccessBanner] = React.useState<string | null>(null);

  const fetchEligibility = React.useCallback(async () => {
    try {
      const orderIdentifier = order.id || order.orderNumber;
      const res = await fetch(`/api/orders/${encodeURIComponent(orderIdentifier)}/address-edit-status`);
      if (res.ok) {
        const data = await res.json();
        if (data.ok) {
          setEligibility(data);
          if (data.deadline && data.serverNow) {
            const serverMs = new Date(data.serverNow).getTime();
            const deadlineMs = new Date(data.deadline).getTime();
            const diffSec = Math.max(0, Math.floor((deadlineMs - serverMs) / 1000));
            setRemainingSeconds(diffSec);
          }
          if (data.currentAddress) {
            setCurrentAddress({
              shippingFullName: data.currentAddress.shippingFullName,
              shippingPhone: data.currentAddress.shippingPhone,
              shippingAddressLine1: data.currentAddress.shippingAddressLine1,
              shippingAddressLine2: data.currentAddress.shippingAddressLine2 || undefined,
              shippingCity: data.currentAddress.shippingCity,
              shippingState: data.currentAddress.shippingState,
              shippingPostalCode: data.currentAddress.shippingPostalCode,
              shippingCountry: data.currentAddress.shippingCountry || "India",
            });
          }
        }
      }
    } catch (err) {
      console.warn("Failed to fetch address edit status:", err);
    }
  }, [order.id, order.orderNumber]);

  React.useEffect(() => {
    fetchEligibility();
  }, [fetchEligibility]);

  // Server-synchronized decrement timer
  React.useEffect(() => {
    if (remainingSeconds === null || remainingSeconds <= 0) return;

    const timer = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(timer);
          fetchEligibility(); // Refresh status upon expiration
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [remainingSeconds, fetchEligibility]);

  const formatRemaining = (sec: number) => {
    const hours = Math.floor(sec / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    const secs = sec % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m ${secs}s`;
  };

  const openModal = () => {
    setFormValues({
      fullName: currentAddress.shippingFullName,
      phone: currentAddress.shippingPhone,
      addressLine1: currentAddress.shippingAddressLine1,
      addressLine2: currentAddress.shippingAddressLine2 || "",
      city: currentAddress.shippingCity,
      state: currentAddress.shippingState,
      postalCode: currentAddress.shippingPostalCode,
    });
    setFormErrors({});
    setSubmitError(null);
    setModalStep("form");
    setIsModalOpen(true);
  };

  const handleReview = (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!formValues.fullName.trim() || formValues.fullName.trim().length < 2) {
      errs.fullName = "Full name must be at least 2 characters";
    }
    if (!/^[6-9]\d{9}$/.test(formValues.phone.trim())) {
      errs.phone = "Enter a valid 10-digit Indian mobile number (e.g. 9876543210)";
    }
    if (!formValues.addressLine1.trim() || formValues.addressLine1.trim().length < 5) {
      errs.addressLine1 = "Address line 1 is required (min 5 characters)";
    }
    if (!formValues.city.trim() || formValues.city.trim().length < 2) {
      errs.city = "City is required";
    }
    if (!formValues.state.trim() || formValues.state.trim().length < 2) {
      errs.state = "State is required";
    }
    if (!/^[1-9]\d{5}$/.test(formValues.postalCode.trim())) {
      errs.postalCode = "Enter a valid 6-digit Indian PIN code (cannot start with 0)";
    }

    setFormErrors(errs);
    if (Object.keys(errs).length === 0) {
      setModalStep("confirm");
    }
  };

  const handleConfirmSubmit = async () => {
    try {
      setIsSubmitting(true);
      setSubmitError(null);
      const orderIdentifier = order.id || order.orderNumber;
      const res = await fetch(`/api/orders/${encodeURIComponent(orderIdentifier)}/shipping-address`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shippingFullName: formValues.fullName.trim(),
          shippingPhone: formValues.phone.trim(),
          shippingAddressLine1: formValues.addressLine1.trim(),
          shippingAddressLine2: formValues.addressLine2.trim() || null,
          shippingCity: formValues.city.trim(),
          shippingState: formValues.state.trim(),
          shippingPostalCode: formValues.postalCode.trim(),
          shippingCountry: "India",
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to update delivery address.");
      }

      setCurrentAddress({
        shippingFullName: formValues.fullName.trim(),
        shippingPhone: formValues.phone.trim(),
        shippingAddressLine1: formValues.addressLine1.trim(),
        shippingAddressLine2: formValues.addressLine2.trim() || undefined,
        shippingCity: formValues.city.trim(),
        shippingState: formValues.state.trim(),
        shippingPostalCode: formValues.postalCode.trim(),
        shippingCountry: "India",
      });

      setSuccessBanner("Delivery address updated successfully.");
      setIsModalOpen(false);
      fetchEligibility();
    } catch (err: any) {
      setSubmitError(err.message || "An unexpected error occurred while saving your address.");
      fetchEligibility(); // Refresh eligibility in case status changed (e.g. dispatched race)
    } finally {
      setIsSubmitting(false);
    }
  };

  const getReasonMessage = (reason: string | null) => {
    switch (reason) {
      case "order_dispatched":
        return "Address can no longer be changed because your order has been dispatched. Contact support for help.";
      case "order_delivered":
        return "Address cannot be changed because your order has been delivered.";
      case "order_cancelled":
        return "Address cannot be changed because this order is cancelled.";
      case "deadline_expired":
        return "The address change window for this order has expired.";
      case "change_limit_reached":
        return `Maximum address changes (${eligibility?.maxChanges || 2}) reached for this order.`;
      case "feature_disabled":
        return "Delivery address change is currently disabled by store policy.";
      default:
        return null;
    }
  };

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
        {order.status === "cancelled" ? (
          <div className="px-5 py-5 sm:px-6">
            <h2 className="text-sm font-bold text-neutral-900 mb-3">
              Order Tracking Timeline
            </h2>
            <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-xs text-red-900 flex items-start gap-2.5">
              <PackageIcon size={18} className="text-red-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-red-950">Order Cancelled</p>
                <p className="text-red-700 mt-0.5 leading-relaxed">
                  This order has been cancelled and is not progressing toward delivery.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="px-5 py-5 sm:px-6">
            <h2 className="text-sm font-bold text-neutral-900 mb-4">
              Order Tracking Timeline
            </h2>
            <ol className="relative flex flex-col gap-4 before:absolute before:left-[13px] before:top-2 before:bottom-2 before:w-0.5 before:bg-neutral-200">
              {getOrderTrackingStages({
                status: order.status,
                paymentStatus: order.paymentStatus,
                paymentMethod: order.paymentMethod,
              }).map((stage) => {
                const isCompleted = stage.status === "completed";
                const isCurrent = stage.status === "current";
                const isFailed = stage.status === "failed";

                return (
                  <li
                    key={stage.id}
                    aria-current={isCurrent ? "step" : undefined}
                    className="relative flex items-start gap-3.5 pl-0"
                  >
                    <div
                      className={`relative z-10 w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                        isCompleted
                          ? "bg-[#2A7C13] text-white"
                          : isFailed
                          ? "bg-red-600 text-white ring-4 ring-red-500/20"
                          : isCurrent
                          ? "bg-primary text-neutral-900 ring-4 ring-primary/20"
                          : "bg-neutral-100 text-neutral-400 border border-neutral-200"
                      }`}
                    >
                      {isCompleted ? (
                        <CheckIcon size={14} className="stroke-[3]" />
                      ) : (
                        getStageIcon(stage.iconType)
                      )}
                    </div>
                    <div className="min-w-0 pt-0.5">
                      <p
                        className={`text-xs font-bold ${
                          isCurrent
                            ? "text-neutral-900"
                            : isCompleted
                            ? "text-neutral-700"
                            : isFailed
                            ? "text-red-700"
                            : "text-neutral-400"
                        }`}
                      >
                        {stage.label}
                        {stage.badge && (
                          <span
                            className={`ml-2 text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded ${
                              stage.status === "failed"
                                ? "bg-red-100 text-red-800 border border-red-200"
                                : stage.badge === "Due on Delivery"
                                ? "bg-amber-100 text-amber-900 border border-amber-200"
                                : stage.badge === "Pending"
                                ? "bg-amber-100 text-amber-900 border border-amber-200"
                                : "bg-secondary text-neutral-900"
                            }`}
                          >
                            {stage.badge}
                          </span>
                        )}
                      </p>
                      <p className="text-[11px] text-neutral-500">
                        {stage.description}
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
                {item.colorName && (
                  <div className="flex items-center gap-1.5 mt-1 text-xs text-neutral-600">
                    <span
                      className="w-3 h-3 rounded-full border border-black/15 shadow-xs shrink-0"
                      style={{ backgroundColor: item.colorHex || "#6366F1" }}
                    />
                    <span>
                      Color: <strong className="text-neutral-800">{item.colorName}</strong>
                    </span>
                  </div>
                )}
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
        <div className="rounded-2xl border border-neutral-200 bg-surface shadow-card p-5 sm:p-6 space-y-3">
          <div className="flex items-center justify-between border-b border-neutral-100 pb-2.5">
            <div className="flex items-center gap-2">
              <MapPinIcon size={16} className="text-neutral-500" />
              <h2 className="text-sm font-bold text-neutral-900">
                Delivery Address
              </h2>
            </div>
            {eligibility?.allowed && (
              <button
                type="button"
                onClick={openModal}
                className="px-3 py-1.5 text-xs font-bold rounded-xl bg-primary text-neutral-900 hover:bg-[#91BC7A] transition-all shadow-xs active:scale-95 cursor-pointer"
              >
                Change address
              </button>
            )}
          </div>

          {/* Success Banner */}
          {successBanner && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-center justify-between">
              <span>{successBanner}</span>
              <button
                type="button"
                onClick={() => setSuccessBanner(null)}
                className="text-emerald-700 hover:text-emerald-900 font-bold ml-2 text-sm"
              >
                ✕
              </button>
            </div>
          )}

          <div className="text-xs text-neutral-600 leading-relaxed space-y-0.5">
            <p className="font-semibold text-neutral-900">
              {currentAddress.shippingFullName}
            </p>
            <p>{currentAddress.shippingAddressLine1}</p>
            {currentAddress.shippingAddressLine2 && (
              <p>{currentAddress.shippingAddressLine2}</p>
            )}
            <p>
              {currentAddress.shippingCity}, {currentAddress.shippingState}{" "}
              {currentAddress.shippingPostalCode}
            </p>
            <p>{currentAddress.shippingCountry}</p>
            <p className="mt-1 text-neutral-500">{currentAddress.shippingPhone}</p>
          </div>

          {/* Policy & Deadline Banner */}
          {eligibility?.allowed && remainingSeconds !== null && (
            <div className="pt-2 border-t border-neutral-100">
              <div className="p-3 rounded-xl bg-primary/10 border border-primary/20 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                <div className="flex items-center gap-2 text-neutral-900 font-medium">
                  <ClockIcon size={14} className="text-primary-dark shrink-0" />
                  <span>
                    You can change the address for{" "}
                    <strong>{formatRemaining(remainingSeconds)}</strong>
                  </span>
                </div>
                <span className="text-[11px] text-neutral-600 font-semibold self-start sm:self-auto">
                  {eligibility.changesLeft}{" "}
                  {eligibility.changesLeft === 1 ? "change" : "changes"} left
                </span>
              </div>
            </div>
          )}

          {/* Ineligible reason notice */}
          {!eligibility?.allowed && eligibility?.reason && (
            <div className="pt-2 border-t border-neutral-100">
              <div className="p-3 rounded-xl bg-neutral-100 border border-neutral-200 text-xs text-neutral-600 flex items-start gap-2">
                <AlertCircleIcon size={14} className="text-neutral-500 shrink-0 mt-0.5" />
                <p>{getReasonMessage(eligibility.reason)}</p>
              </div>
            </div>
          )}
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

      {/* Address Edit & Confirmation Modal */}
      {isModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="address-modal-title"
          className="fixed inset-0 z-50 bg-neutral-900/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
        >
          <div className="bg-surface rounded-2xl border border-neutral-200 shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 space-y-5 my-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <div>
                <h3
                  id="address-modal-title"
                  className="text-base font-bold text-neutral-900"
                >
                  {modalStep === "form" ? "Edit Delivery Address" : "Confirm Address Change"}
                </h3>
                <p className="text-xs text-neutral-500 mt-0.5">
                  Order {order.orderNumber}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors cursor-pointer"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            {/* Error Message */}
            {submitError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-2">
                <AlertCircleIcon size={14} className="text-rose-600 shrink-0 mt-0.5" />
                <p>{submitError}</p>
              </div>
            )}

            {/* Step 1: Address Edit Form */}
            {modalStep === "form" ? (
              <form onSubmit={handleReview} className="space-y-4" noValidate>
                <div>
                  <label htmlFor="modal-name" className="block text-xs font-bold text-neutral-800 mb-1">
                    Full Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="modal-name"
                    type="text"
                    value={formValues.fullName}
                    onChange={(e) => setFormValues((p) => ({ ...p, fullName: e.target.value }))}
                    className="w-full h-10 px-3.5 rounded-xl border border-neutral-200 bg-canvas text-xs text-neutral-900 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                    placeholder="Recipient Name"
                  />
                  {formErrors.fullName && (
                    <p className="text-[11px] text-rose-600 mt-1 font-medium">{formErrors.fullName}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="modal-phone" className="block text-xs font-bold text-neutral-800 mb-1">
                    Mobile Number <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="modal-phone"
                    type="tel"
                    maxLength={10}
                    value={formValues.phone}
                    onChange={(e) => setFormValues((p) => ({ ...p, phone: e.target.value }))}
                    className="w-full h-10 px-3.5 rounded-xl border border-neutral-200 bg-canvas text-xs text-neutral-900 font-mono focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                    placeholder="10-digit Indian Mobile"
                  />
                  {formErrors.phone && (
                    <p className="text-[11px] text-rose-600 mt-1 font-medium">{formErrors.phone}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="modal-addr1" className="block text-xs font-bold text-neutral-800 mb-1">
                    Address Line 1 <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="modal-addr1"
                    type="text"
                    value={formValues.addressLine1}
                    onChange={(e) => setFormValues((p) => ({ ...p, addressLine1: e.target.value }))}
                    className="w-full h-10 px-3.5 rounded-xl border border-neutral-200 bg-canvas text-xs text-neutral-900 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                    placeholder="Flat / House No., Building, Street"
                  />
                  {formErrors.addressLine1 && (
                    <p className="text-[11px] text-rose-600 mt-1 font-medium">{formErrors.addressLine1}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="modal-addr2" className="block text-xs font-bold text-neutral-800 mb-1">
                    Address Line 2 (Optional)
                  </label>
                  <input
                    id="modal-addr2"
                    type="text"
                    value={formValues.addressLine2}
                    onChange={(e) => setFormValues((p) => ({ ...p, addressLine2: e.target.value }))}
                    className="w-full h-10 px-3.5 rounded-xl border border-neutral-200 bg-canvas text-xs text-neutral-900 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                    placeholder="Landmark, Area, Sector"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="modal-city" className="block text-xs font-bold text-neutral-800 mb-1">
                      City <span className="text-rose-500">*</span>
                    </label>
                    <input
                      id="modal-city"
                      type="text"
                      value={formValues.city}
                      onChange={(e) => setFormValues((p) => ({ ...p, city: e.target.value }))}
                      className="w-full h-10 px-3.5 rounded-xl border border-neutral-200 bg-canvas text-xs text-neutral-900 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                      placeholder="City"
                    />
                    {formErrors.city && (
                      <p className="text-[11px] text-rose-600 mt-1 font-medium">{formErrors.city}</p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="modal-state" className="block text-xs font-bold text-neutral-800 mb-1">
                      State <span className="text-rose-500">*</span>
                    </label>
                    <input
                      id="modal-state"
                      type="text"
                      value={formValues.state}
                      onChange={(e) => setFormValues((p) => ({ ...p, state: e.target.value }))}
                      className="w-full h-10 px-3.5 rounded-xl border border-neutral-200 bg-canvas text-xs text-neutral-900 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                      placeholder="State"
                    />
                    {formErrors.state && (
                      <p className="text-[11px] text-rose-600 mt-1 font-medium">{formErrors.state}</p>
                    )}
                  </div>
                </div>

                <div>
                  <label htmlFor="modal-pin" className="block text-xs font-bold text-neutral-800 mb-1">
                    PIN Code <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="modal-pin"
                    type="text"
                    maxLength={6}
                    value={formValues.postalCode}
                    onChange={(e) => setFormValues((p) => ({ ...p, postalCode: e.target.value }))}
                    className="w-full h-10 px-3.5 rounded-xl border border-neutral-200 bg-canvas text-xs text-neutral-900 font-mono focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                    placeholder="6-digit Indian PIN Code"
                  />
                  {formErrors.postalCode && (
                    <p className="text-[11px] text-rose-600 mt-1 font-medium">{formErrors.postalCode}</p>
                  )}
                  {Boolean(
                    formValues.postalCode.trim() &&
                    currentAddress.shippingPostalCode &&
                    formValues.postalCode.trim() !== currentAddress.shippingPostalCode.trim()
                  ) && (
                    <div className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2.5 mt-2 flex items-start gap-1.5 leading-relaxed">
                      <span className="font-bold shrink-0">Note:</span>
                      <span>
                        Changing to a different destination PIN code ({formValues.postalCode.trim()}) cannot be automatically verified online.
                        To update your street address, apartment, or contact details, please retain your original PIN code ({currentAddress.shippingPostalCode}).
                        To request delivery to a different PIN code, please contact support.
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-neutral-100">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 rounded-xl text-xs font-medium text-neutral-600 hover:bg-neutral-100 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-xl bg-primary hover:bg-[#91BC7A] text-neutral-900 text-xs font-bold transition-all shadow-xs active:scale-95 cursor-pointer"
                  >
                    Review Change →
                  </button>
                </div>
              </form>
            ) : (
              /* Step 2: Old Address vs New Address Comparison */
              <div className="space-y-4">
                <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200/80 text-xs text-amber-900">
                  <p className="font-bold">Review your updated address:</p>
                  <p className="mt-0.5 text-[11px] text-amber-700">
                    Changes remaining after this:{" "}
                    <strong>{Math.max(0, (eligibility?.changesLeft || 1) - 1)}</strong>
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Old Address */}
                  <div className="p-3.5 rounded-xl bg-neutral-50 border border-neutral-200 text-xs space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block mb-1">
                      Current Address
                    </span>
                    <p className="font-semibold text-neutral-800">
                      {currentAddress.shippingFullName}
                    </p>
                    <p className="text-neutral-600">{currentAddress.shippingAddressLine1}</p>
                    {currentAddress.shippingAddressLine2 && (
                      <p className="text-neutral-600">{currentAddress.shippingAddressLine2}</p>
                    )}
                    <p className="text-neutral-600">
                      {currentAddress.shippingCity}, {currentAddress.shippingState}{" "}
                      {currentAddress.shippingPostalCode}
                    </p>
                    <p className="text-neutral-500 font-mono text-[11px]">{currentAddress.shippingPhone}</p>
                  </div>

                  {/* New Proposed Address */}
                  <div className="p-3.5 rounded-xl bg-primary/10 border border-primary/30 text-xs space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-primary-dark block mb-1">
                      New Proposed Address
                    </span>
                    <p className="font-bold text-neutral-900">
                      {formValues.fullName}
                    </p>
                    <p className="text-neutral-800">{formValues.addressLine1}</p>
                    {formValues.addressLine2 && (
                      <p className="text-neutral-800">{formValues.addressLine2}</p>
                    )}
                    <p className="text-neutral-800">
                      {formValues.city}, {formValues.state}{" "}
                      {formValues.postalCode}
                    </p>
                    <p className="text-neutral-700 font-mono text-[11px]">{formValues.phone}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-neutral-100">
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => setModalStep("form")}
                    className="px-4 py-2 rounded-xl text-xs font-medium text-neutral-600 hover:bg-neutral-100 transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    ← Back to Edit
                  </button>
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={handleConfirmSubmit}
                    className="px-5 py-2.5 rounded-xl bg-primary hover:bg-[#91BC7A] text-neutral-900 text-xs font-bold transition-all shadow-xs active:scale-95 disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                  >
                    {isSubmitting ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-neutral-900 border-t-transparent rounded-full animate-spin" />
                        <span>Updating...</span>
                      </>
                    ) : (
                      <span>Confirm change</span>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
