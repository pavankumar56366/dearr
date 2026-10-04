"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import Link from "next/link";
import {
  AdminOrder,
  OrderStatus,
  PaymentStatus,
  BASE_ORDERS,
  getAllAdminOrders,
  updateAdminOrderStatus,
  updateAdminPaymentStatus,
  getOrderMetrics,
} from "@/lib/admin-orders";
import {
  SearchIcon,
  XIcon,
  MoreVerticalIcon,
  EyeIcon,
  CopyIcon,
  UserIcon,
  CheckCircleIcon,
  AlertCircleIcon,
  ClockIcon,
  TruckIcon,
  PackageIcon,
  XCircleIcon,
  ChevronDownIcon,
  LayersIcon,
  CreditCardIcon,
} from "../AdminIcons";
import { AdminOrdersSkeleton } from "./AdminOrdersSkeleton";

export function AdminOrdersList() {
  const [orders, setOrders] = useState<AdminOrder[]>(BASE_ORDERS);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedOrderStatus, setSelectedOrderStatus] = useState<"ALL" | OrderStatus>("ALL");
  const [selectedPaymentStatus, setSelectedPaymentStatus] = useState<"ALL" | PaymentStatus>("ALL");
  const [selectedDateRange, setSelectedDateRange] = useState<"ALL" | "TODAY" | "7DAYS" | "30DAYS">("ALL");

  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const [showSkeletonDemo, setShowSkeletonDemo] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Status transition modal state
  const [orderToUpdateStatus, setOrderToUpdateStatus] = useState<AdminOrder | null>(null);
  const [targetStatus, setTargetStatus] = useState<OrderStatus>("processing");

  // Payment status update modal state
  const [orderToUpdatePayment, setOrderToUpdatePayment] = useState<AdminOrder | null>(null);
  const [targetPaymentStatus, setTargetPaymentStatus] = useState<PaymentStatus>("paid");

  // Customer inspection modal state
  const [inspectCustomerOrder, setInspectCustomerOrder] = useState<AdminOrder | null>(null);

  const dropdownRef = useRef<HTMLDivElement | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  // Sync orders from API and sessionStorage on mount
  useEffect(() => {
    async function loadOrders() {
      try {
        const res = await fetch("/api/admin/orders");
        if (res.ok) {
          const data = await res.json();
          if (data.ok && Array.isArray(data.orders)) {
            const mapped: AdminOrder[] = data.orders.map((o: any) => ({
              id: o.id,
              orderNumber: o.orderNumber,
              customer: {
                name: o.customerName || "Customer",
                email: o.customerEmail || "customer@dearr.in",
                phone: o.customerPhone || "+91 98765 43210",
              },
              items: [],
              subtotal: Number(o.subtotal || 0),
              discountAmount: Number(o.discountAmount || 0),
              shippingAmount: Number(o.shippingAmount || 0),
              totalAmount: Number(o.totalAmount || 0),
              currency: o.currency || "INR",
              orderStatus: o.status,
              paymentStatus: o.paymentStatus,
              paymentMethod: "Razorpay (Online)",
              shippingAddress: {
                fullName: o.customerName || "Customer",
                phone: o.customerPhone || "",
                addressLine1: "",
                city: "",
                state: "",
                postalCode: "",
                country: "India",
              },
              createdAt: typeof o.createdAt === "string" ? o.createdAt : new Date(o.createdAt).toISOString(),
              updatedAt: typeof o.updatedAt === "string" ? o.updatedAt : new Date(o.updatedAt).toISOString(),
            }));

            // Merge with local session/base orders so demo orders still display if DB has few
            const sessionOrders = getAllAdminOrders();
            const existingOrderNumbers = new Set(mapped.map((m) => m.orderNumber));
            const combined = [...mapped, ...sessionOrders.filter((so) => !existingOrderNumbers.has(so.orderNumber))];
            setOrders(combined);
            return;
          }
        }
      } catch (err) {
        console.warn("Could not fetch /api/admin/orders, falling back to local:", err);
      }
      setOrders(getAllAdminOrders());
    }

    loadOrders();
  }, []);

  // Outside click & ESC listeners
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpenDropdownId(null);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpenDropdownId(null);
        setOrderToUpdateStatus(null);
        setOrderToUpdatePayment(null);
        setInspectCustomerOrder(null);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  // Summary Metrics
  const metrics = useMemo(() => {
    return getOrderMetrics(orders);
  }, [orders]);

  // Filtered Orders
  const filteredOrders = useMemo(() => {
    const now = new Date();

    return orders.filter((order) => {
      // 1. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesNumber = order.orderNumber.toLowerCase().includes(q);
        const matchesCustomer = order.customer.name.toLowerCase().includes(q);
        const matchesEmail = order.customer.email.toLowerCase().includes(q);
        const matchesPhone = order.customer.phone.toLowerCase().includes(q);
        const matchesProducts = order.items.some((item) =>
          item.name.toLowerCase().includes(q)
        );
        if (
          !matchesNumber &&
          !matchesCustomer &&
          !matchesEmail &&
          !matchesPhone &&
          !matchesProducts
        ) {
          return false;
        }
      }

      // 2. Order Status Filter
      if (selectedOrderStatus !== "ALL") {
        if (order.orderStatus !== selectedOrderStatus) return false;
      }

      // 3. Payment Status Filter
      if (selectedPaymentStatus !== "ALL") {
        if (order.paymentStatus !== selectedPaymentStatus) return false;
      }

      // 4. Date Range Filter
      if (selectedDateRange !== "ALL") {
        const orderTime = new Date(order.createdAt).getTime();
        const nowTime = now.getTime();
        const diffHours = (nowTime - orderTime) / (1000 * 60 * 60);

        if (selectedDateRange === "TODAY") {
          const orderDateLocal = new Date(order.createdAt).toLocaleDateString("en-CA");
          const todayLocal = now.toLocaleDateString("en-CA");
          if (orderDateLocal !== todayLocal && diffHours > 24) return false;
        } else if (selectedDateRange === "7DAYS") {
          if (diffHours > 7 * 24) return false;
        } else if (selectedDateRange === "30DAYS") {
          if (diffHours > 30 * 24) return false;
        }
      }

      return true;
    });
  }, [
    orders,
    searchQuery,
    selectedOrderStatus,
    selectedPaymentStatus,
    selectedDateRange,
  ]);

  // Handle Copy Order Number
  const handleCopyOrderNumber = (orderNumber: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(orderNumber);
      showToast(`Copied order #${orderNumber} to clipboard`);
    } else {
      showToast(`Order #${orderNumber}`);
    }
    setOpenDropdownId(null);
  };

  // Handle Order Status Update
  const handleOpenStatusModal = (order: AdminOrder) => {
    setOpenDropdownId(null);
    setOrderToUpdateStatus(order);
    setTargetStatus(order.orderStatus);
  };

  const handleConfirmStatusUpdate = () => {
    if (!orderToUpdateStatus) return;
    const updated = updateAdminOrderStatus(
      orderToUpdateStatus.id,
      targetStatus
    );
    if (updated) {
      setOrders(getAllAdminOrders());
      showToast(
        `Order ${updated.orderNumber} updated to ${updated.orderStatus}`
      );
    }
    setOrderToUpdateStatus(null);
  };

  // Handle Payment Status Update
  const handleOpenPaymentModal = (order: AdminOrder) => {
    setOpenDropdownId(null);
    setOrderToUpdatePayment(order);
    setTargetPaymentStatus(order.paymentStatus);
  };

  const handleConfirmPaymentUpdate = () => {
    if (!orderToUpdatePayment) return;
    const updated = updateAdminPaymentStatus(
      orderToUpdatePayment.id,
      targetPaymentStatus
    );
    if (updated) {
      setOrders(getAllAdminOrders());
      showToast(
        `Payment for ${updated.orderNumber} updated to ${updated.paymentStatus}`
      );
    }
    setOrderToUpdatePayment(null);
  };

  const handleClearFilters = () => {
    setSearchQuery("");
    setSelectedOrderStatus("ALL");
    setSelectedPaymentStatus("ALL");
    setSelectedDateRange("ALL");
  };

  const hasActiveFilters =
    Boolean(searchQuery.trim()) ||
    selectedOrderStatus !== "ALL" ||
    selectedPaymentStatus !== "ALL" ||
    selectedDateRange !== "ALL";

  // Badges
  const renderOrderStatusBadge = (status: OrderStatus) => {
    switch (status) {
      case "pending":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-900 border border-amber-200">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            <span>Pending</span>
          </span>
        );
      case "confirmed":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-900 border border-blue-200">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            <span>Confirmed</span>
          </span>
        );
      case "processing":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-purple-50 text-purple-900 border border-purple-200">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
            <span>Processing</span>
          </span>
        );
      case "shipped":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-900 border border-indigo-200">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
            <span>Shipped</span>
          </span>
        );
      case "delivered":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-primary/20 text-neutral-900 border border-primary/40">
            <span className="w-1.5 h-1.5 rounded-full bg-primary-dark" />
            <span>Delivered</span>
          </span>
        );
      case "cancelled":
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-red-50 text-red-900 border border-red-200">
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
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
            <CheckCircleIcon size={11} className="text-emerald-600" />
            <span>Paid</span>
          </span>
        );
      case "pending":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
            <ClockIcon size={11} className="text-amber-600" />
            <span>Pending</span>
          </span>
        );
      case "failed":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-red-50 text-red-800 border border-red-200">
            <XCircleIcon size={11} className="text-red-600" />
            <span>Failed</span>
          </span>
        );
      case "refunded":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-neutral-100 text-neutral-700 border border-neutral-300">
            <span>Refunded</span>
          </span>
        );
    }
  };

  const formatDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    } catch {
      return isoString.split("T")[0];
    }
  };

  return (
    <div className="space-y-6 pb-20">
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

      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-neutral-900">
              Orders
            </h1>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-neutral-100 text-neutral-600 border border-neutral-200">
              {orders.length} total
            </span>
          </div>
          <p className="text-xs sm:text-sm text-neutral-500 mt-1">
            Track customer orders, 3D printing fulfillment stages, and payments.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Skeleton QA Toggle */}
          <button
            type="button"
            onClick={() => setShowSkeletonDemo(!showSkeletonDemo)}
            className="px-3 py-2 rounded-xl border border-neutral-200 hover:bg-neutral-100 text-xs font-semibold text-neutral-600 transition-colors cursor-pointer"
            title="Preview skeleton loading state for QA verification"
          >
            {showSkeletonDemo ? "Hide Skeleton" : "Preview Skeleton"}
          </button>
        </div>
      </div>

      {/* Conditional Skeleton Demo Mode */}
      {showSkeletonDemo ? (
        <AdminOrdersSkeleton />
      ) : (
        <>
          {/* Summary Metric Cards (6 Cards) */}
          <section
            aria-label="Orders Summary Metrics"
            className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4"
          >
            {/* Total Orders */}
            <div className="p-4 rounded-2xl bg-surface border border-neutral-200/80 shadow-2xs space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">
                Total Orders
              </span>
              <div className="text-2xl sm:text-3xl font-display font-bold text-neutral-900">
                {metrics.totalOrders}
              </div>
              <p className="text-[11px] text-neutral-500">All customer orders</p>
            </div>

            {/* Pending Orders */}
            <div className="p-4 rounded-2xl bg-surface border border-neutral-200/80 shadow-2xs space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700">
                Pending
              </span>
              <div className="text-2xl sm:text-3xl font-display font-bold text-neutral-900">
                {metrics.pendingOrders}
              </div>
              <p className="text-[11px] text-neutral-500">Awaiting confirmation</p>
            </div>

            {/* Processing Orders */}
            <div className="p-4 rounded-2xl bg-surface border border-neutral-200/80 shadow-2xs space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-purple-700">
                Processing
              </span>
              <div className="text-2xl sm:text-3xl font-display font-bold text-neutral-900">
                {metrics.processingOrders}
              </div>
              <p className="text-[11px] text-neutral-500">In 3D print queue</p>
            </div>

            {/* Delivered Orders */}
            <div className="p-4 rounded-2xl bg-surface border border-neutral-200/80 shadow-2xs space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-primary-dark">
                Delivered
              </span>
              <div className="text-2xl sm:text-3xl font-display font-bold text-neutral-900">
                {metrics.deliveredOrders}
              </div>
              <p className="text-[11px] text-neutral-500">Fulfilled packages</p>
            </div>

            {/* Cancelled Orders */}
            <div className="p-4 rounded-2xl bg-surface border border-neutral-200/80 shadow-2xs space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-red-700">
                Cancelled
              </span>
              <div className="text-2xl sm:text-3xl font-display font-bold text-neutral-900">
                {metrics.cancelledOrders}
              </div>
              <p className="text-[11px] text-neutral-500">Void / refunded</p>
            </div>

            {/* Total Revenue */}
            <div className="p-4 rounded-2xl bg-surface border border-neutral-200/80 shadow-2xs space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
                Total Revenue
              </span>
              <div className="text-xl sm:text-2xl font-display font-bold text-neutral-900 truncate">
                ₹{metrics.totalRevenue.toLocaleString("en-IN")}
              </div>
              <p className="text-[11px] text-neutral-500">From paid orders</p>
            </div>
          </section>

          {/* Search & Composable Filter Bar */}
          <section
            aria-label="Search and Filter Orders"
            className="p-4 rounded-2xl bg-surface border border-neutral-200/80 shadow-2xs space-y-3"
          >
            <div className="flex flex-col md:flex-row gap-3">
              {/* Search Input */}
              <div className="relative flex-1">
                <SearchIcon
                  size={16}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400"
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by order #, customer, email, phone, or product..."
                  className="w-full pl-10 pr-9 py-2.5 rounded-xl border border-neutral-200 bg-white text-xs sm:text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
                  aria-label="Search orders"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    aria-label="Clear order search"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700 cursor-pointer"
                  >
                    <XIcon size={14} />
                  </button>
                )}
              </div>

              {/* Order Status Dropdown */}
              <select
                value={selectedOrderStatus}
                onChange={(e) =>
                  setSelectedOrderStatus(e.target.value as "ALL" | OrderStatus)
                }
                aria-label="Filter orders by fulfillment status"
                className="px-3.5 py-2.5 rounded-xl border border-neutral-200 bg-white text-xs font-semibold text-neutral-700 focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer"
              >
                <option value="ALL">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="confirmed">Confirmed</option>
                <option value="processing">Processing</option>
                <option value="shipped">Shipped</option>
                <option value="delivered">Delivered</option>
                <option value="cancelled">Cancelled</option>
              </select>

              {/* Payment Status Dropdown */}
              <select
                value={selectedPaymentStatus}
                onChange={(e) =>
                  setSelectedPaymentStatus(e.target.value as "ALL" | PaymentStatus)
                }
                aria-label="Filter orders by payment status"
                className="px-3.5 py-2.5 rounded-xl border border-neutral-200 bg-white text-xs font-semibold text-neutral-700 focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer"
              >
                <option value="ALL">All Payments</option>
                <option value="paid">Paid</option>
                <option value="pending">Pending</option>
                <option value="failed">Failed</option>
                <option value="refunded">Refunded</option>
              </select>

              {/* Date Filter Dropdown */}
              <select
                value={selectedDateRange}
                onChange={(e) =>
                  setSelectedDateRange(
                    e.target.value as "ALL" | "TODAY" | "7DAYS" | "30DAYS"
                  )
                }
                aria-label="Filter orders by date"
                className="px-3.5 py-2.5 rounded-xl border border-neutral-200 bg-white text-xs font-semibold text-neutral-700 focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer"
              >
                <option value="ALL">All Dates</option>
                <option value="TODAY">Today</option>
                <option value="7DAYS">Last 7 Days</option>
                <option value="30DAYS">Last 30 Days</option>
              </select>
            </div>

            {/* Results count & reset filters banner */}
            <div className="flex items-center justify-between text-xs text-neutral-500 pt-1 border-t border-neutral-100">
              <div>
                Showing{" "}
                <span className="font-bold text-neutral-800">
                  {filteredOrders.length}
                </span>{" "}
                of{" "}
                <span className="font-bold text-neutral-800">
                  {orders.length}
                </span>{" "}
                orders
              </div>

              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={handleClearFilters}
                  className="font-bold text-primary-dark hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <XIcon size={12} />
                  <span>Clear all filters</span>
                </button>
              )}
            </div>
          </section>

          {/* Orders Content: Empty State vs Desktop Table / Mobile Cards */}
          {filteredOrders.length === 0 ? (
            <div className="p-12 text-center rounded-2xl bg-surface border border-neutral-200/80 shadow-2xs space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-neutral-100 flex items-center justify-center text-neutral-400 mx-auto">
                <TruckIcon size={24} />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-neutral-900">
                  {orders.length === 0 ? "No orders yet" : "No orders found"}
                </h3>
                <p className="text-xs text-neutral-500 max-w-sm mx-auto">
                  {orders.length === 0
                    ? "Orders will appear here when customers place purchases."
                    : "Try adjusting your search or filters."}
                </p>
              </div>
              {hasActiveFilters && (
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleClearFilters}
                    className="px-4 py-2 rounded-xl border border-neutral-200 text-xs font-semibold text-neutral-700 hover:bg-neutral-100 transition-colors cursor-pointer"
                  >
                    Clear all filters
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Desktop Table (>= 1024px) */}
              <div className="hidden lg:block rounded-2xl bg-surface border border-neutral-200/80 shadow-2xs overflow-visible">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-neutral-200/80 text-[11px] font-bold uppercase tracking-wider text-neutral-400 bg-neutral-50/50">
                      <th scope="col" className="py-3 px-4">Order</th>
                      <th scope="col" className="py-3 px-4">Customer</th>
                      <th scope="col" className="py-3 px-4">Items</th>
                      <th scope="col" className="py-3 px-4">Total</th>
                      <th scope="col" className="py-3 px-4">Payment</th>
                      <th scope="col" className="py-3 px-4">Order Status</th>
                      <th scope="col" className="py-3 px-4">Date</th>
                      <th scope="col" className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100 text-xs text-neutral-700">
                    {filteredOrders.map((order) => {
                      const isDropdownOpen = openDropdownId === order.id;
                      const productNamesList = order.items
                        .map((i) => `${i.quantity}x ${i.name}`)
                        .join(", ");

                      return (
                        <tr
                          key={order.id}
                          className="hover:bg-neutral-50/70 transition-colors"
                        >
                          {/* Order Number */}
                          <td className="py-3.5 px-4 font-mono font-bold text-neutral-900">
                            <Link
                              href={`/admin/orders/${order.id}`}
                              className="bg-neutral-100 border border-neutral-200 px-2 py-1 rounded-md tracking-wider hover:bg-primary/20 hover:border-primary/40 transition-colors"
                            >
                              {order.orderNumber}
                            </Link>
                          </td>

                          {/* Customer */}
                          <td className="py-3.5 px-4">
                            <div className="font-semibold text-neutral-900">
                              {order.customer.name}
                            </div>
                            <div className="text-[11px] text-neutral-400 truncate max-w-xs">
                              {order.customer.email}
                            </div>
                          </td>

                          {/* Items */}
                          <td className="py-3.5 px-4">
                            <span
                              title={productNamesList}
                              className="font-medium text-neutral-700 cursor-help underline decoration-dotted decoration-neutral-300"
                            >
                              {order.items.length}{" "}
                              {order.items.length === 1 ? "item" : "items"}
                            </span>
                            <div className="text-[11px] text-neutral-400 truncate max-w-[200px]">
                              {order.items[0]?.name}
                              {order.items.length > 1 && ` +${order.items.length - 1} more`}
                            </div>
                          </td>

                          {/* Total */}
                          <td className="py-3.5 px-4 font-bold text-neutral-900">
                            ₹{order.totalAmount.toLocaleString("en-IN")}
                          </td>

                          {/* Payment */}
                          <td className="py-3.5 px-4">
                            {renderPaymentStatusBadge(order.paymentStatus)}
                          </td>

                          {/* Order Status */}
                          <td className="py-3.5 px-4">
                            {renderOrderStatusBadge(order.orderStatus)}
                          </td>

                          {/* Date */}
                          <td className="py-3.5 px-4 text-neutral-500 font-mono text-[11px]">
                            {formatDate(order.createdAt)}
                          </td>

                          {/* Actions */}
                          <td className="py-3.5 px-4 text-right relative">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenDropdownId(
                                  isDropdownOpen ? null : order.id
                                );
                              }}
                              aria-label={`Actions for order ${order.orderNumber}`}
                              aria-expanded={isDropdownOpen}
                              className="w-8 h-8 rounded-lg border border-neutral-200 hover:bg-neutral-100 inline-flex items-center justify-center text-neutral-600 transition-colors cursor-pointer"
                            >
                              <MoreVerticalIcon size={16} />
                            </button>

                            {/* Dropdown Menu */}
                            {isDropdownOpen && (
                              <div
                                ref={dropdownRef}
                                className="absolute right-4 top-12 z-40 w-44 rounded-xl bg-white border border-neutral-200 shadow-xl p-1.5 space-y-0.5 text-left animate-in fade-in zoom-in-95 duration-100"
                              >
                                <Link
                                  href={`/admin/orders/${order.id}`}
                                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900 transition-colors cursor-pointer"
                                >
                                  <EyeIcon size={14} className="text-neutral-400" />
                                  <span>View Order</span>
                                </Link>

                                <button
                                  type="button"
                                  onClick={() => handleOpenStatusModal(order)}
                                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-neutral-700 hover:bg-neutral-100 transition-colors cursor-pointer"
                                >
                                  <LayersIcon size={14} className="text-neutral-400" />
                                  <span>Update Status</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleOpenPaymentModal(order)}
                                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-neutral-700 hover:bg-neutral-100 transition-colors cursor-pointer"
                                >
                                  <CreditCardIcon size={14} className="text-neutral-400" />
                                  <span>Update Payment</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenDropdownId(null);
                                    setInspectCustomerOrder(order);
                                  }}
                                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-neutral-700 hover:bg-neutral-100 transition-colors cursor-pointer"
                                >
                                  <UserIcon size={14} className="text-neutral-400" />
                                  <span>View Customer</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleCopyOrderNumber(order.orderNumber)}
                                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-neutral-700 hover:bg-neutral-100 transition-colors cursor-pointer"
                                >
                                  <CopyIcon size={14} className="text-neutral-400" />
                                  <span>Copy Order #</span>
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards (< 1024px) */}
              <div className="lg:hidden space-y-3">
                {filteredOrders.map((order) => {
                  const isDropdownOpen = openDropdownId === order.id;
                  const productNamesList = order.items
                    .map((i) => `${i.quantity}x ${i.name}`)
                    .join(", ");

                  return (
                    <div
                      key={order.id}
                      className="p-4 rounded-2xl bg-surface border border-neutral-200/80 shadow-2xs space-y-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <Link
                          href={`/admin/orders/${order.id}`}
                          className="font-mono font-bold text-xs bg-neutral-100 border border-neutral-200 px-2 py-0.5 rounded text-neutral-900 hover:bg-primary/20 transition-colors"
                        >
                          {order.orderNumber}
                        </Link>
                        <div className="flex items-center gap-2">
                          {renderOrderStatusBadge(order.orderStatus)}

                          {/* 3-Dot Menu */}
                          <div className="relative">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenDropdownId(
                                  isDropdownOpen ? null : order.id
                                );
                              }}
                              aria-label={`Actions for order ${order.orderNumber}`}
                              className="w-9 h-9 rounded-lg border border-neutral-200 hover:bg-neutral-100 flex items-center justify-center text-neutral-600 cursor-pointer"
                            >
                              <MoreVerticalIcon size={16} />
                            </button>

                            {isDropdownOpen && (
                              <div
                                ref={dropdownRef}
                                className="absolute right-0 top-10 z-40 w-44 rounded-xl bg-white border border-neutral-200 shadow-xl p-1.5 space-y-0.5 text-left"
                              >
                                <Link
                                  href={`/admin/orders/${order.id}`}
                                  className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-semibold text-neutral-700 hover:bg-neutral-100 cursor-pointer"
                                >
                                  <EyeIcon size={14} />
                                  <span>View Order</span>
                                </Link>

                                <button
                                  type="button"
                                  onClick={() => handleOpenStatusModal(order)}
                                  className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-semibold text-neutral-700 hover:bg-neutral-100 cursor-pointer"
                                >
                                  <LayersIcon size={14} />
                                  <span>Update Status</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleOpenPaymentModal(order)}
                                  className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-semibold text-neutral-700 hover:bg-neutral-100 cursor-pointer"
                                >
                                  <CreditCardIcon size={14} />
                                  <span>Update Payment</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenDropdownId(null);
                                    setInspectCustomerOrder(order);
                                  }}
                                  className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-semibold text-neutral-700 hover:bg-neutral-100 cursor-pointer"
                                >
                                  <UserIcon size={14} />
                                  <span>View Customer</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleCopyOrderNumber(order.orderNumber)}
                                  className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-semibold text-neutral-700 hover:bg-neutral-100 cursor-pointer"
                                >
                                  <CopyIcon size={14} />
                                  <span>Copy Order #</span>
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Customer Info */}
                      <div>
                        <div className="text-sm font-bold text-neutral-900">
                          {order.customer.name}
                        </div>
                        <div className="text-xs text-neutral-400">
                          {order.customer.email} • {order.customer.phone}
                        </div>
                      </div>

                      {/* Items & Financial Summary */}
                      <div className="pt-2 border-t border-neutral-100 grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-neutral-400 block text-[10px] uppercase font-bold">
                            Items
                          </span>
                          <span
                            title={productNamesList}
                            className="font-medium text-neutral-700 truncate block"
                          >
                            {order.items.length}{" "}
                            {order.items.length === 1 ? "item" : "items"}
                          </span>
                        </div>

                        <div>
                          <span className="text-neutral-400 block text-[10px] uppercase font-bold">
                            Total
                          </span>
                          <span className="font-bold text-neutral-900">
                            ₹{order.totalAmount.toLocaleString("en-IN")}
                          </span>
                        </div>

                        <div>
                          <span className="text-neutral-400 block text-[10px] uppercase font-bold">
                            Payment
                          </span>
                          <span>{renderPaymentStatusBadge(order.paymentStatus)}</span>
                        </div>

                        <div>
                          <span className="text-neutral-400 block text-[10px] uppercase font-bold">
                            Date
                          </span>
                          <span className="font-mono text-[11px] text-neutral-600">
                            {formatDate(order.createdAt)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </>
      )}

      {/* Order Status Update Modal */}
      {orderToUpdateStatus && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150"
          role="dialog"
          aria-modal="true"
          aria-labelledby="update-status-dialog-title"
        >
          <div className="bg-surface rounded-2xl border border-neutral-200 shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-bold bg-neutral-100 px-2 py-0.5 rounded border border-neutral-200">
                  {orderToUpdateStatus.orderNumber}
                </span>
                <span className="text-xs text-neutral-500">Update Status</span>
              </div>
              <button
                type="button"
                onClick={() => setOrderToUpdateStatus(null)}
                aria-label="Close status update"
                className="w-8 h-8 rounded-lg border border-neutral-200 flex items-center justify-center text-neutral-400 hover:text-neutral-700 cursor-pointer"
              >
                <XIcon size={16} />
              </button>
            </div>

            <div className="space-y-1">
              <h3
                id="update-status-dialog-title"
                className="text-base font-bold text-neutral-900"
              >
                Update Fulfillment Stage
              </h3>
              <p className="text-xs text-neutral-500">
                Select the new progress status for customer order{" "}
                <span className="font-bold text-neutral-700">
                  {orderToUpdateStatus.orderNumber}
                </span>
                .
              </p>
            </div>

            {/* Warning if current status is Delivered */}
            {orderToUpdateStatus.orderStatus === "delivered" &&
              targetStatus !== "delivered" && (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2">
                  <AlertCircleIcon size={16} className="text-amber-600 shrink-0 mt-0.5" />
                  <span>
                    <strong>Caution:</strong> This order is already marked as
                    Delivered. Reverting it will re-open fulfillment tracking.
                  </span>
                </div>
              )}

            {/* Status Options */}
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
                      name="targetOrderStatus"
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
                onClick={() => setOrderToUpdateStatus(null)}
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

      {/* Payment Status Update Modal */}
      {orderToUpdatePayment && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150"
          role="dialog"
          aria-modal="true"
          aria-labelledby="update-payment-dialog-title"
        >
          <div className="bg-surface rounded-2xl border border-neutral-200 shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-bold bg-neutral-100 px-2 py-0.5 rounded border border-neutral-200">
                  {orderToUpdatePayment.orderNumber}
                </span>
                <span className="text-xs text-neutral-500">Update Payment</span>
              </div>
              <button
                type="button"
                onClick={() => setOrderToUpdatePayment(null)}
                aria-label="Close payment status update"
                className="w-8 h-8 rounded-lg border border-neutral-200 flex items-center justify-center text-neutral-400 hover:text-neutral-700 cursor-pointer"
              >
                <XIcon size={16} />
              </button>
            </div>

            <div className="space-y-1">
              <h3
                id="update-payment-dialog-title"
                className="text-base font-bold text-neutral-900"
              >
                Update Payment Status
              </h3>
              <p className="text-xs text-neutral-500">
                Update payment verification status for customer order{" "}
                <span className="font-bold text-neutral-700">
                  {orderToUpdatePayment.orderNumber}
                </span>
                .
              </p>
            </div>

            {/* Caution if target is Refunded */}
            {targetPaymentStatus === "refunded" && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-start gap-2">
                <AlertCircleIcon size={16} className="text-rose-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Caution:</strong> Marking an order as Refunded records that payment was returned to the customer.
                </span>
              </div>
            )}

            {/* Payment Options */}
            <div className="space-y-2 pt-1">
              {(
                [
                  "pending",
                  "paid",
                  "failed",
                  "refunded",
                ] as PaymentStatus[]
              ).map((pst) => (
                <label
                  key={pst}
                  className={`flex items-center justify-between p-3 rounded-xl border text-xs font-semibold cursor-pointer transition-all ${
                    targetPaymentStatus === pst
                      ? "bg-primary/20 border-primary text-neutral-900 shadow-2xs"
                      : "bg-white border-neutral-200 text-neutral-700 hover:bg-neutral-50"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="targetPaymentStatus"
                      checked={targetPaymentStatus === pst}
                      onChange={() => setTargetPaymentStatus(pst)}
                      className="accent-primary"
                    />
                    <span className="capitalize">{pst}</span>
                  </div>
                  {renderPaymentStatusBadge(pst)}
                </label>
              ))}
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-neutral-100">
              <button
                type="button"
                onClick={() => setOrderToUpdatePayment(null)}
                className="px-4 py-2 rounded-xl border border-neutral-200 text-xs font-semibold text-neutral-700 hover:bg-neutral-100 transition-colors cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleConfirmPaymentUpdate}
                className="px-4 py-2 rounded-xl bg-primary hover:bg-[#91BC7A] text-neutral-900 text-xs font-bold transition-colors cursor-pointer shadow-xs"
              >
                Save Payment Status
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Customer Inspection Modal */}
      {inspectCustomerOrder && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150"
          role="dialog"
          aria-modal="true"
          aria-labelledby="customer-dialog-title"
        >
          <div className="bg-surface rounded-2xl border border-neutral-200 shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-full bg-neutral-900 text-white flex items-center justify-center text-xs font-bold">
                  {inspectCustomerOrder.customer.name.charAt(0)}
                </span>
                <span className="font-bold text-sm text-neutral-900">
                  Customer Profile
                </span>
              </div>
              <button
                type="button"
                onClick={() => setInspectCustomerOrder(null)}
                aria-label="Close customer inspection"
                className="w-8 h-8 rounded-lg border border-neutral-200 flex items-center justify-center text-neutral-400 hover:text-neutral-700 cursor-pointer"
              >
                <XIcon size={16} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3.5 rounded-xl bg-neutral-50 border border-neutral-200/80 space-y-2">
                <div>
                  <span className="text-[10px] text-neutral-400 uppercase font-bold block">
                    Full Name
                  </span>
                  <span className="font-bold text-neutral-900 text-sm">
                    {inspectCustomerOrder.customer.name}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] text-neutral-400 uppercase font-bold block">
                    Email Address
                  </span>
                  <a
                    href={`mailto:${inspectCustomerOrder.customer.email}`}
                    className="font-semibold text-primary-dark hover:underline"
                  >
                    {inspectCustomerOrder.customer.email}
                  </a>
                </div>

                <div>
                  <span className="text-[10px] text-neutral-400 uppercase font-bold block">
                    Phone Number
                  </span>
                  <a
                    href={`tel:${inspectCustomerOrder.customer.phone}`}
                    className="font-mono text-neutral-800 hover:underline"
                  >
                    {inspectCustomerOrder.customer.phone}
                  </a>
                </div>
              </div>

              <div>
                <span className="text-[10px] text-neutral-400 uppercase font-bold block mb-1">
                  Delivery Destination
                </span>
                <div className="p-3 rounded-xl bg-white border border-neutral-200 text-neutral-700 space-y-0.5 leading-relaxed">
                  <div className="font-bold text-neutral-900">
                    {inspectCustomerOrder.shippingAddress.fullName}
                  </div>
                  <div>{inspectCustomerOrder.shippingAddress.addressLine1}</div>
                  {inspectCustomerOrder.shippingAddress.addressLine2 && (
                    <div>{inspectCustomerOrder.shippingAddress.addressLine2}</div>
                  )}
                  <div>
                    {inspectCustomerOrder.shippingAddress.city},{" "}
                    {inspectCustomerOrder.shippingAddress.state} —{" "}
                    {inspectCustomerOrder.shippingAddress.postalCode}
                  </div>
                  <div className="text-[11px] text-neutral-500 font-medium pt-0.5">
                    {inspectCustomerOrder.shippingAddress.country}
                  </div>
                </div>
              </div>

              {inspectCustomerOrder.notes && (
                <div className="p-3 rounded-xl bg-amber-50/50 border border-amber-200 text-amber-900">
                  <span className="text-[10px] uppercase font-bold block text-amber-700 mb-0.5">
                    Order Note
                  </span>
                  <p className="text-xs">{inspectCustomerOrder.notes}</p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-100">
              <Link
                href={`/admin/orders/${inspectCustomerOrder.id}`}
                className="px-4 py-2 rounded-xl bg-primary hover:bg-[#91BC7A] text-neutral-900 font-bold text-xs shadow-xs transition-all cursor-pointer"
              >
                View Full Order Details
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
