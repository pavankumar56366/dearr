"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  AdminCustomer,
  CustomerStatus,
  getAdminCustomerById,
  toggleAdminCustomerStatus,
} from "@/lib/admin-customers";
import {
  AdminOrder,
  getAllAdminOrders,
} from "@/lib/admin-orders";
import {
  ArrowLeftIcon,
  CheckCircleIcon,
  AlertCircleIcon,
  ClockIcon,
  EditIcon,
  UserIcon,
  MailIcon,
  PhoneIcon,
  MapPinIcon,
  ShoppingCartIcon,
  TrendingUpIcon,
  CalendarIcon,
  BanIcon,
  ShieldAlertIcon,
  TruckIcon,
  LayersIcon,
  XIcon,
} from "../AdminIcons";
import { AdminCustomerNotFound } from "./AdminCustomerNotFound";

interface AdminCustomerDetailsProps {
  customerId: string;
  initialCustomer?: AdminCustomer | null;
}

export function AdminCustomerDetails({
  customerId,
  initialCustomer,
}: AdminCustomerDetailsProps) {
  const [customer, setCustomer] = useState<AdminCustomer | null>(
    initialCustomer ?? null
  );
  const [allOrders, setAllOrders] = useState<AdminOrder[]>([]);
  const [loading, setLoading] = useState(!initialCustomer);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Status transition modal state
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [targetStatus, setTargetStatus] = useState<CustomerStatus>("active");
  const [statusChangeReason, setStatusChangeReason] = useState("");

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  // Sync customer and orders on mount
  useEffect(() => {
    const found = getAdminCustomerById(customerId);
    setCustomer(found);
    setAllOrders(getAllAdminOrders());
    setLoading(false);
  }, [customerId]);

  // Find orders placed by this customer
  const customerOrders = useMemo(() => {
    if (!customer) return [];
    const customerEmail = customer.email.trim().toLowerCase();
    const customerPhone = customer.phone.replace(/\D/g, "");

    return allOrders.filter((order) => {
      const orderEmail = order.customer.email.trim().toLowerCase();
      const orderPhone = order.customer.phone.replace(/\D/g, "");
      return (
        (orderEmail && orderEmail === customerEmail) ||
        (customerPhone && orderPhone && orderPhone === customerPhone)
      );
    });
  }, [customer, allOrders]);

  // Compute metrics: Total Orders, Total Spent, Average Order Value (AOV)
  const orderCount = customer ? Math.max(customer.orderCount, customerOrders.length) : 0;
  const totalSpent = useMemo(() => {
    if (!customer) return 0;
    if (customerOrders.length > 0) {
      return customerOrders.reduce((sum, o) => {
        if (o.paymentStatus === "refunded") return sum;
        return sum + o.totalAmount;
      }, 0);
    }
    return customer.totalSpent;
  }, [customer, customerOrders]);

  const averageOrderValue = orderCount > 0 ? Math.round(totalSpent / orderCount) : 0;

  // Most recent order date
  const lastOrderDate = useMemo(() => {
    if (customerOrders.length > 0) {
      const sorted = [...customerOrders].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      return sorted[0]?.createdAt;
    }
    return customer?.lastOrderAt;
  }, [customerOrders, customer]);

  // Date formatter
  const formatDate = (isoString?: string) => {
    if (!isoString) return "Never";
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return isoString;
      return d.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    } catch {
      return isoString;
    }
  };

  const handleOpenStatusModal = (st: CustomerStatus) => {
    setTargetStatus(st);
    setStatusChangeReason("");
    setShowStatusModal(true);
  };

  const handleConfirmStatusChange = () => {
    if (!customer) return;
    const updated = toggleAdminCustomerStatus(
      customer.id,
      targetStatus,
      statusChangeReason.trim() || undefined
    );
    if (updated) {
      setCustomer(updated);
      showToast(`Customer status updated to ${targetStatus.toUpperCase()}`);
    }
    setShowStatusModal(false);
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-6 w-36 bg-neutral-200 rounded" />
        <div className="h-32 bg-surface rounded-2xl border border-neutral-200" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-surface rounded-2xl border border-neutral-200" />
          ))}
        </div>
      </div>
    );
  }

  if (!customer) {
    return <AdminCustomerNotFound customerId={customerId} />;
  }

  const initial = customer.name.charAt(0).toUpperCase();

  // Helper for Order Status Badge
  const renderOrderStatusBadge = (st: string) => {
    switch (st) {
      case "delivered":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
            <CheckCircleIcon size={12} className="text-emerald-600" />
            <span className="capitalize">{st}</span>
          </span>
        );
      case "shipped":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-800 border border-indigo-200">
            <TruckIcon size={12} className="text-indigo-600" />
            <span className="capitalize">{st}</span>
          </span>
        );
      case "processing":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-violet-50 text-violet-800 border border-violet-200">
            <LayersIcon size={12} className="text-violet-600" />
            <span className="capitalize">{st}</span>
          </span>
        );
      case "confirmed":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-sky-50 text-sky-800 border border-sky-200">
            <CheckCircleIcon size={12} className="text-sky-600" />
            <span className="capitalize">{st}</span>
          </span>
        );
      case "pending":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
            <ClockIcon size={12} className="text-amber-600" />
            <span className="capitalize">{st}</span>
          </span>
        );
      case "cancelled":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-800 border border-rose-200">
            <BanIcon size={12} className="text-rose-600" />
            <span className="capitalize">{st}</span>
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-neutral-100 text-neutral-600 capitalize">
            {st}
          </span>
        );
    }
  };

  // Helper for Payment Status Badge
  const renderPaymentStatusBadge = (pst: string) => {
    switch (pst) {
      case "paid":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-100/70 text-emerald-800">
            Paid
          </span>
        );
      case "pending":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-100/70 text-amber-800">
            Pending
          </span>
        );
      case "failed":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-rose-100/70 text-rose-800">
            Failed
          </span>
        );
      case "refunded":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-purple-100/70 text-purple-800">
            Refunded
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-neutral-100 text-neutral-700 capitalize">
            {pst}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-6 right-6 z-50 bg-neutral-900 text-white text-xs font-semibold px-4 py-3 rounded-xl shadow-2xl border border-neutral-700 animate-in slide-in-from-bottom-2 duration-200 flex items-center gap-2"
        >
          <CheckCircleIcon size={16} className="text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Breadcrumb & Navigation */}
      <div className="flex items-center justify-between gap-4">
        <Link
          href="/admin/customers"
          className="inline-flex items-center gap-2 text-xs font-bold text-neutral-500 hover:text-neutral-900 transition-colors"
        >
          <ArrowLeftIcon size={14} />
          <span>Back to Customers</span>
        </Link>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {customer.status === "active" ? (
            <button
              type="button"
              onClick={() => handleOpenStatusModal("inactive")}
              className="px-3 py-1.5 rounded-xl border border-neutral-200 hover:bg-neutral-100 text-xs font-semibold text-neutral-700 transition-all cursor-pointer"
            >
              Deactivate Account
            </button>
          ) : customer.status === "inactive" ? (
            <button
              type="button"
              onClick={() => handleOpenStatusModal("active")}
              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all cursor-pointer shadow-xs"
            >
              Activate Account
            </button>
          ) : (
            <button
              type="button"
              onClick={() => handleOpenStatusModal("active")}
              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all cursor-pointer shadow-xs"
            >
              Unblock Account
            </button>
          )}

          {customer.status !== "blocked" && (
            <button
              type="button"
              onClick={() => handleOpenStatusModal("blocked")}
              className="px-3 py-1.5 rounded-xl border border-rose-200 text-rose-700 hover:bg-rose-50 text-xs font-semibold transition-all cursor-pointer"
            >
              Block Customer
            </button>
          )}

          <Link
            href={`/admin/customers/${customer.id}/edit`}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-primary hover:bg-[#91BC7A] text-neutral-900 font-bold text-xs shadow-xs transition-all cursor-pointer"
          >
            <EditIcon size={14} />
            <span>Edit Customer</span>
          </Link>
        </div>
      </div>

      {/* ====================================================================
          1. CUSTOMER HERO PROFILE CARD
          ==================================================================== */}
      <div className="p-6 rounded-2xl bg-surface border border-neutral-200/80 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-neutral-900 text-white font-display font-bold text-2xl flex items-center justify-center shrink-0 shadow-sm">
              {initial}
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="font-display text-2xl font-bold text-neutral-900">
                  {customer.name}
                </h1>
                <span className="font-mono text-xs text-neutral-500 bg-neutral-100 px-2 py-0.5 rounded-md border border-neutral-200">
                  {customer.id}
                </span>
                {customer.status === "active" ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                    <CheckCircleIcon size={12} className="text-emerald-600" />
                    <span>Active</span>
                  </span>
                ) : customer.status === "inactive" ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-neutral-100 text-neutral-700 border border-neutral-200">
                    <span>Inactive</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-800 border border-rose-200">
                    <BanIcon size={12} className="text-rose-600" />
                    <span>Blocked</span>
                  </span>
                )}
              </div>

              <div className="flex items-center gap-4 text-xs text-neutral-500 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <MailIcon size={13} className="text-neutral-400" />
                  <a
                    href={`mailto:${customer.email}`}
                    className="text-neutral-700 font-medium hover:underline"
                  >
                    {customer.email}
                  </a>
                </div>
                <div className="flex items-center gap-1.5">
                  <PhoneIcon size={13} className="text-neutral-400" />
                  <a
                    href={`tel:${customer.phone}`}
                    className="font-mono text-neutral-700 font-medium hover:underline"
                  >
                    {customer.phone}
                  </a>
                </div>
                <div className="flex items-center gap-1.5">
                  <CalendarIcon size={13} className="text-neutral-400" />
                  <span>Joined {formatDate(customer.joinedAt)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ====================================================================
          2. CUSTOMER KEY METRICS (4 CARDS)
          ==================================================================== */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Orders */}
        <div className="p-4 rounded-2xl bg-surface border border-neutral-200/80 shadow-2xs space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider">
              Total Orders
            </span>
            <ShoppingCartIcon size={16} className="text-neutral-400" />
          </div>
          <div className="text-2xl font-display font-bold text-neutral-900">
            {orderCount}
          </div>
          <div className="text-[11px] text-neutral-500 font-medium">
            Lifetime purchases placed
          </div>
        </div>

        {/* Total Spend */}
        <div className="p-4 rounded-2xl bg-surface border border-neutral-200/80 shadow-2xs space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider">
              Total Spent
            </span>
            <TrendingUpIcon size={16} className="text-primary-dark" />
          </div>
          <div className="text-2xl font-display font-bold text-neutral-900">
            ₹{totalSpent.toLocaleString("en-IN")}
          </div>
          <div className="text-[11px] text-neutral-500 font-medium">
            Net customer expenditure
          </div>
        </div>

        {/* Average Order Value (AOV) */}
        <div className="p-4 rounded-2xl bg-surface border border-neutral-200/80 shadow-2xs space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider">
              Average Order (AOV)
            </span>
            <span className="font-mono text-xs font-bold text-neutral-400">₹/ord</span>
          </div>
          <div className="text-2xl font-display font-bold text-neutral-900">
            ₹{averageOrderValue.toLocaleString("en-IN")}
          </div>
          <div className="text-[11px] text-neutral-500 font-medium">
            Per completed purchase
          </div>
        </div>

        {/* Last Order Date */}
        <div className="p-4 rounded-2xl bg-surface border border-neutral-200/80 shadow-2xs space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider">
              Last Order
            </span>
            <ClockIcon size={16} className="text-neutral-400" />
          </div>
          <div className="text-lg sm:text-xl font-display font-bold text-neutral-900 truncate">
            {formatDate(lastOrderDate)}
          </div>
          <div className="text-[11px] text-neutral-500 font-medium">
            Most recent purchase activity
          </div>
        </div>
      </div>

      {/* ====================================================================
          3. CONTACT, DEFAULT ADDRESS, & OPERATIONAL NOTES
          ==================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Saved Shipping Address Card */}
        <div className="p-5 rounded-2xl bg-surface border border-neutral-200/80 shadow-2xs space-y-3 lg:col-span-2">
          <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
            <div className="flex items-center gap-2">
              <MapPinIcon size={16} className="text-neutral-500" />
              <h2 className="text-sm font-bold text-neutral-900">
                Default Delivery Address
              </h2>
            </div>
            <Link
              href={`/admin/customers/${customer.id}/edit`}
              className="text-xs font-bold text-primary-dark hover:underline"
            >
              Edit Address
            </Link>
          </div>

          {customer.defaultAddress ? (
            <div className="p-4 rounded-xl bg-neutral-50/70 border border-neutral-200/70 text-xs text-neutral-700 space-y-1 leading-relaxed">
              <div className="font-bold text-sm text-neutral-900">
                {customer.defaultAddress.fullName}
              </div>
              <div className="text-neutral-500 font-mono text-[11px]">
                {customer.defaultAddress.phone}
              </div>
              <div className="pt-1">{customer.defaultAddress.addressLine1}</div>
              {customer.defaultAddress.addressLine2 && (
                <div>{customer.defaultAddress.addressLine2}</div>
              )}
              <div>
                {customer.defaultAddress.city},{" "}
                {customer.defaultAddress.state} —{" "}
                <span className="font-mono font-bold">
                  {customer.defaultAddress.postalCode}
                </span>
              </div>
              <div className="text-neutral-500 font-medium pt-0.5">
                {customer.defaultAddress.country}
              </div>
            </div>
          ) : (
            <div className="p-8 rounded-xl bg-neutral-50 border border-dashed border-neutral-200 text-center text-xs text-neutral-500">
              No delivery address on file for this customer yet.
            </div>
          )}
        </div>

        {/* Operational / Admin Notes Card */}
        <div className="p-5 rounded-2xl bg-surface border border-neutral-200/80 shadow-2xs space-y-3">
          <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
            <h2 className="text-sm font-bold text-neutral-900">
              Admin Notes & Logs
            </h2>
            <Link
              href={`/admin/customers/${customer.id}/edit`}
              className="text-xs font-bold text-primary-dark hover:underline"
            >
              Edit
            </Link>
          </div>

          {customer.notes ? (
            <div className="p-3.5 rounded-xl bg-amber-50/60 border border-amber-200/80 text-xs text-amber-950 whitespace-pre-line leading-relaxed font-sans">
              {customer.notes}
            </div>
          ) : (
            <div className="p-6 rounded-xl bg-neutral-50 border border-dashed border-neutral-200 text-center text-xs text-neutral-400">
              No notes recorded. You can add operational remarks in the edit customer view.
            </div>
          )}
        </div>
      </div>

      {/* ====================================================================
          4. ORDER HISTORY SECTION
          ==================================================================== */}
      <div id="orders" className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display text-lg font-bold text-neutral-900">
              Order History
            </h2>
            <p className="text-xs text-neutral-500">
              All 3D printing orders associated with {customer.email}
            </p>
          </div>
          <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-neutral-100 text-neutral-700 border border-neutral-200">
            {customerOrders.length} {customerOrders.length === 1 ? "order" : "orders"}
          </span>
        </div>

        {customerOrders.length === 0 ? (
          <div className="p-10 rounded-2xl bg-surface border border-neutral-200/80 text-center space-y-2">
            <div className="w-10 h-10 rounded-xl bg-neutral-100 text-neutral-400 flex items-center justify-center mx-auto">
              <ShoppingCartIcon size={20} />
            </div>
            <h3 className="font-bold text-sm text-neutral-800">
              No orders yet
            </h3>
            <p className="text-xs text-neutral-500 max-w-sm mx-auto">
              This customer hasn&apos;t placed any purchases on Dearr yet.
            </p>
          </div>
        ) : (
          <div className="rounded-2xl bg-surface border border-neutral-200/80 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-neutral-200/80 bg-neutral-50/75 text-[11px] font-bold uppercase tracking-wider text-neutral-500 select-none">
                    <th className="py-3.5 pl-6 pr-4">Order #</th>
                    <th className="py-3.5 px-4">Date</th>
                    <th className="py-3.5 px-4">Items</th>
                    <th className="py-3.5 px-4">Total</th>
                    <th className="py-3.5 px-4">Payment</th>
                    <th className="py-3.5 px-4">Order Status</th>
                    <th className="py-3.5 pl-4 pr-6 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 text-xs">
                  {customerOrders.map((ord) => {
                    const itemsSummary = ord.items
                      .map((i) => `${i.quantity}x ${i.name}`)
                      .join(", ");

                    return (
                      <tr
                        key={ord.id}
                        className="hover:bg-neutral-50/60 transition-colors"
                      >
                        <td className="py-4 pl-6 pr-4">
                          <Link
                            href={`/admin/orders/${ord.id}`}
                            className="font-mono font-bold text-xs bg-neutral-100 border border-neutral-200 px-2 py-0.5 rounded text-neutral-900 hover:bg-primary/20 transition-colors"
                          >
                            {ord.orderNumber}
                          </Link>
                        </td>
                        <td className="py-4 px-4 font-mono text-[11px] text-neutral-600">
                          {formatDate(ord.createdAt)}
                        </td>
                        <td className="py-4 px-4 max-w-xs truncate text-neutral-700" title={itemsSummary}>
                          {itemsSummary}
                        </td>
                        <td className="py-4 px-4 font-bold text-neutral-900">
                          ₹{ord.totalAmount.toLocaleString("en-IN")}
                        </td>
                        <td className="py-4 px-4">
                          {renderPaymentStatusBadge(ord.paymentStatus)}
                        </td>
                        <td className="py-4 px-4">
                          {renderOrderStatusBadge(ord.orderStatus)}
                        </td>
                        <td className="py-4 pl-4 pr-6 text-right">
                          <Link
                            href={`/admin/orders/${ord.id}`}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-neutral-200 hover:bg-neutral-100 text-xs font-semibold text-neutral-700 transition-colors cursor-pointer"
                          >
                            <span>View</span>
                            <span className="text-[10px]">→</span>
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ====================================================================
          5. STATUS TRANSITION MODAL (DEACTIVATE / BLOCK / ACTIVATE)
          ==================================================================== */}
      {showStatusModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150"
          role="dialog"
          aria-modal="true"
          aria-labelledby="customer-modal-title"
        >
          <div className="bg-surface rounded-2xl border border-neutral-200 shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-bold bg-neutral-100 px-2 py-0.5 rounded border border-neutral-200">
                  {customer.id}
                </span>
                <span className="text-xs text-neutral-500">Status Update</span>
              </div>
              <button
                type="button"
                onClick={() => setShowStatusModal(false)}
                aria-label="Close status update"
                className="w-8 h-8 rounded-lg border border-neutral-200 flex items-center justify-center text-neutral-400 hover:text-neutral-700 cursor-pointer"
              >
                <XIcon size={16} />
              </button>
            </div>

            <div className="space-y-1">
              <h3
                id="customer-modal-title"
                className="text-base font-bold text-neutral-900"
              >
                {targetStatus === "blocked"
                  ? "Block Customer Account"
                  : targetStatus === "inactive"
                  ? "Deactivate Customer Account"
                  : "Activate Customer Account"}
              </h3>
              <p className="text-xs text-neutral-500">
                Update account status for{" "}
                <span className="font-bold text-neutral-700">
                  {customer.name}
                </span>{" "}
                to{" "}
                <span className="font-bold uppercase text-neutral-900">
                  {targetStatus}
                </span>
                .
              </p>
            </div>

            {targetStatus === "blocked" && (
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-950 text-xs flex items-start gap-2.5">
                <BanIcon size={18} className="text-rose-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <strong>Important Security Notice:</strong>
                  <p className="leading-relaxed">
                    Blocking this account will prevent the customer from logging in or placing further orders.
                  </p>
                </div>
              </div>
            )}

            {targetStatus === "inactive" && (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2">
                <AlertCircleIcon size={16} className="text-amber-600 shrink-0 mt-0.5" />
                <span>
                  Deactivating pauses active notifications and marketing outreach while preserving historical purchase logs.
                </span>
              </div>
            )}

            <div className="space-y-1.5 pt-1">
              <label
                htmlFor="details-status-reason"
                className="block text-xs font-semibold text-neutral-700"
              >
                Reason / Note (optional)
              </label>
              <textarea
                id="details-status-reason"
                rows={2}
                value={statusChangeReason}
                onChange={(e) => setStatusChangeReason(e.target.value)}
                placeholder="Operational notes regarding this status change..."
                className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-xs text-neutral-800 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary resize-none"
              />
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
                onClick={handleConfirmStatusChange}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs ${
                  targetStatus === "blocked"
                    ? "bg-rose-600 hover:bg-rose-700 text-white"
                    : targetStatus === "inactive"
                    ? "bg-amber-600 hover:bg-amber-700 text-white"
                    : "bg-primary hover:bg-[#91BC7A] text-neutral-900"
                }`}
              >
                Confirm Status
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
