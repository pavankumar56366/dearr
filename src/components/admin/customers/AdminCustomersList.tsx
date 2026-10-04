"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import Link from "next/link";
import {
  AdminCustomer,
  CustomerStatus,
  getCustomerMetrics,
} from "@/lib/admin-customers";
import {
  SearchIcon,
  XIcon,
  MoreVerticalIcon,
  EyeIcon,
  EditIcon,
  UserIcon,
  CheckCircleIcon,
  AlertCircleIcon,
  UsersIcon,
  TrendingUpIcon,
  CalendarIcon,
  PhoneIcon,
  MailIcon,
  BanIcon,
  ShieldAlertIcon,
  ShoppingCartIcon,
} from "../AdminIcons";
import { AdminCustomersSkeleton } from "./AdminCustomersSkeleton";

type ActivityFilter = "ALL" | "WITH_ORDERS" | "NO_ORDERS";
type SpendingFilter = "ALL" | "ZERO" | "1_TO_999" | "1000_TO_4999" | "5000_PLUS";
type DateFilter = "ALL" | "TODAY" | "7DAYS" | "30DAYS";

export function AdminCustomersList() {
  const [customers, setCustomers] = useState<AdminCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<"ALL" | CustomerStatus>("ALL");
  const [selectedActivity, setSelectedActivity] = useState<ActivityFilter>("ALL");
  const [selectedSpending, setSelectedSpending] = useState<SpendingFilter>("ALL");
  const [selectedDateRange, setSelectedDateRange] = useState<DateFilter>("ALL");

  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const [showSkeletonDemo, setShowSkeletonDemo] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Status transition modals state
  const [customerToChangeStatus, setCustomerToChangeStatus] = useState<AdminCustomer | null>(null);
  const [targetStatus, setTargetStatus] = useState<CustomerStatus>("active");
  const [statusChangeReason, setStatusChangeReason] = useState("");

  const dropdownRef = useRef<HTMLDivElement | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/admin/customers");
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          throw new Error("Admin authorization required to view customers.");
        }
        throw new Error("Failed to load customer accounts.");
      }
      const data = await res.json();
      setCustomers(data.customers || []);
    } catch (err: any) {
      setError(err.message || "Failed to load customers.");
    } finally {
      setLoading(false);
    }
  };

  // Sync customers on mount from real API
  useEffect(() => {
    fetchCustomers();
  }, []);

  // Listen to outside clicks and escape key
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpenDropdownId(null);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpenDropdownId(null);
        setCustomerToChangeStatus(null);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  // Compute live metrics dynamically from customer list
  const metrics = useMemo(() => {
    return getCustomerMetrics(customers);
  }, [customers]);

  // Check if any filters are currently active
  const isFiltered =
    searchQuery.trim() !== "" ||
    selectedStatus !== "ALL" ||
    selectedActivity !== "ALL" ||
    selectedSpending !== "ALL" ||
    selectedDateRange !== "ALL";

  // Filter reset handler
  const handleClearAllFilters = () => {
    setSearchQuery("");
    setSelectedStatus("ALL");
    setSelectedActivity("ALL");
    setSelectedSpending("ALL");
    setSelectedDateRange("ALL");
  };

  // Composable filtering logic
  const filteredCustomers = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    const now = new Date();

    return customers.filter((customer) => {
      // 1. Text Search across Name, Email, Phone, and Customer ID
      if (q) {
        const nameMatch = customer.name.toLowerCase().includes(q);
        const emailMatch = customer.email.toLowerCase().includes(q);
        const phoneMatch = customer.phone.toLowerCase().includes(q);
        const idMatch = customer.id.toLowerCase().includes(q);

        if (!nameMatch && !emailMatch && !phoneMatch && !idMatch) {
          return false;
        }
      }

      // 2. Status Filter
      if (selectedStatus !== "ALL" && customer.status !== selectedStatus) {
        return false;
      }

      // 3. Activity Filter
      if (selectedActivity === "WITH_ORDERS" && customer.orderCount === 0) {
        return false;
      }
      if (selectedActivity === "NO_ORDERS" && customer.orderCount > 0) {
        return false;
      }

      // 4. Spending Filter
      if (selectedSpending === "ZERO" && customer.totalSpent > 0) {
        return false;
      }
      if (
        selectedSpending === "1_TO_999" &&
        (customer.totalSpent < 1 || customer.totalSpent > 999)
      ) {
        return false;
      }
      if (
        selectedSpending === "1000_TO_4999" &&
        (customer.totalSpent < 1000 || customer.totalSpent > 4999)
      ) {
        return false;
      }
      if (selectedSpending === "5000_PLUS" && customer.totalSpent < 5000) {
        return false;
      }

      // 5. Joined Date Filter (Timezone safe)
      if (selectedDateRange !== "ALL") {
        const joinedDate = new Date(customer.joinedAt);
        if (isNaN(joinedDate.getTime())) return false;

        if (selectedDateRange === "TODAY") {
          const isToday =
            joinedDate.getDate() === now.getDate() &&
            joinedDate.getMonth() === now.getMonth() &&
            joinedDate.getFullYear() === now.getFullYear();
          if (!isToday) return false;
        } else if (selectedDateRange === "7DAYS") {
          const diffMs = now.getTime() - joinedDate.getTime();
          const diffDays = diffMs / (1000 * 60 * 60 * 24);
          if (diffDays > 7 || diffDays < 0) return false;
        } else if (selectedDateRange === "30DAYS") {
          const diffMs = now.getTime() - joinedDate.getTime();
          const diffDays = diffMs / (1000 * 60 * 60 * 24);
          if (diffDays > 30 || diffDays < 0) return false;
        }
      }

      return true;
    });
  }, [
    customers,
    searchQuery,
    selectedStatus,
    selectedActivity,
    selectedSpending,
    selectedDateRange,
  ]);

  // Open modal for status changes
  const handleOpenStatusModal = (
    customer: AdminCustomer,
    target: CustomerStatus
  ) => {
    setOpenDropdownId(null);
    setCustomerToChangeStatus(customer);
    setTargetStatus(target);
    setStatusChangeReason("");
  };

  // Confirm status change via API
  const handleConfirmStatusChange = async () => {
    if (!customerToChangeStatus) return;

    try {
      const res = await fetch(`/api/admin/customers/${customerToChangeStatus.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: targetStatus,
          reason: statusChangeReason.trim() || undefined,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to update customer status");
      }

      const data = await res.json();
      if (data.ok && data.customer) {
        setCustomers((prev) =>
          prev.map((c) => (c.id === data.customer.id ? data.customer : c))
        );
        showToast(
          `Customer "${customerToChangeStatus.name}" marked as ${targetStatus.toUpperCase()}`
        );
      }
    } catch (err: any) {
      showToast(err.message || "Failed to update customer status");
    } finally {
      setCustomerToChangeStatus(null);
    }
  };

  // Helper date formatter
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

  // Render Status Badge
  const renderStatusBadge = (status: CustomerStatus) => {
    switch (status) {
      case "active":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
            <CheckCircleIcon size={12} className="text-emerald-600 shrink-0" />
            <span>Active</span>
          </span>
        );
      case "inactive":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-neutral-100 text-neutral-600 border border-neutral-200">
            <span className="w-1.5 h-1.5 rounded-full bg-neutral-400" />
            <span>Inactive</span>
          </span>
        );
      case "blocked":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-800 border border-rose-200">
            <BanIcon size={12} className="text-rose-600 shrink-0" />
            <span>Blocked</span>
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-neutral-100 text-neutral-600">
            {status}
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

      {/* Header & Page Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-neutral-900 tracking-tight">
            Customers
          </h1>
          <p className="text-xs sm:text-sm text-neutral-500 mt-1">
            Manage registered accounts, view purchase volumes, and maintain account statuses.
          </p>
        </div>

        {/* Dev / Preview Skeleton Toggle */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowSkeletonDemo(!showSkeletonDemo)}
            className="text-[11px] font-semibold text-neutral-400 hover:text-neutral-700 px-2.5 py-1.5 rounded-lg border border-dashed border-neutral-300 hover:bg-neutral-50 transition-colors cursor-pointer"
            title="Preview skeleton loading state"
          >
            {showSkeletonDemo ? "Hide Skeleton" : "Preview Skeleton"}
          </button>
        </div>
      </div>

      {loading || showSkeletonDemo ? (
        <AdminCustomersSkeleton />
      ) : error ? (
        <div className="p-8 rounded-2xl bg-surface border border-rose-200 text-center space-y-3">
          <div className="w-10 h-10 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
            <AlertCircleIcon size={20} />
          </div>
          <div className="space-y-1">
            <h3 className="font-display text-sm font-bold text-neutral-900">
              Failed to load customers
            </h3>
            <p className="text-xs text-neutral-500 max-w-sm mx-auto">{error}</p>
          </div>
          <button
            type="button"
            onClick={() => fetchCustomers()}
            className="px-4 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-bold transition-all cursor-pointer shadow-2xs"
          >
            Retry Loading
          </button>
        </div>
      ) : (
        <>
          {/* ====================================================================
              1. DYNAMIC METRIC CARDS (5 Cards)
              ==================================================================== */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
            {/* Total Customers */}
            <div className="p-4 rounded-2xl bg-surface border border-neutral-200/80 shadow-2xs space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider">
                  Total
                </span>
                <UsersIcon size={16} className="text-neutral-400" />
              </div>
              <div className="text-2xl font-display font-bold text-neutral-900">
                {metrics.totalCustomers}
              </div>
              <div className="text-[11px] text-neutral-500 font-medium">
                Registered profiles
              </div>
            </div>

            {/* Active Customers */}
            <div className="p-4 rounded-2xl bg-surface border border-neutral-200/80 shadow-2xs space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider">
                  Active
                </span>
                <CheckCircleIcon size={16} className="text-emerald-500" />
              </div>
              <div className="text-2xl font-display font-bold text-neutral-900">
                {metrics.activeCustomers}
              </div>
              <div className="text-[11px] text-neutral-500 font-medium">
                Good standing
              </div>
            </div>

            {/* New Customers (Last 30 Days) */}
            <div className="p-4 rounded-2xl bg-surface border border-neutral-200/80 shadow-2xs space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">
                  New (30d)
                </span>
                <CalendarIcon size={16} className="text-blue-500" />
              </div>
              <div className="text-2xl font-display font-bold text-neutral-900">
                {metrics.newCustomers}
              </div>
              <div className="text-[11px] text-neutral-500 font-medium">
                Recent registrations
              </div>
            </div>

            {/* Customers with Orders */}
            <div className="p-4 rounded-2xl bg-surface border border-neutral-200/80 shadow-2xs space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-violet-600 uppercase tracking-wider">
                  With Orders
                </span>
                <ShoppingCartIcon size={16} className="text-violet-500" />
              </div>
              <div className="text-2xl font-display font-bold text-neutral-900">
                {metrics.customersWithOrders}
              </div>
              <div className="text-[11px] text-neutral-500 font-medium">
                Converted buyers
              </div>
            </div>

            {/* Total Revenue */}
            <div className="p-4 rounded-2xl bg-surface border border-neutral-200/80 shadow-2xs space-y-1.5 col-span-2 lg:col-span-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider">
                  Revenue
                </span>
                <TrendingUpIcon size={16} className="text-primary-dark" />
              </div>
              <div className="text-2xl font-display font-bold text-neutral-900">
                ₹{metrics.totalRevenue.toLocaleString("en-IN")}
              </div>
              <div className="text-[11px] text-neutral-500 font-medium">
                Lifetime customer spend
              </div>
            </div>
          </div>

          {/* ====================================================================
              2. SEARCH & COMPOSABLE FILTERS TOOLBAR
              ==================================================================== */}
          <div className="p-4 rounded-2xl bg-surface border border-neutral-200/80 shadow-2xs space-y-3">
            <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3">
              {/* Search Bar */}
              <div className="relative flex-1">
                <SearchIcon
                  size={16}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none"
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search name, email, phone, or customer ID..."
                  aria-label="Search customers"
                  className="w-full h-10 pl-10 pr-9 rounded-xl border border-neutral-200 bg-canvas text-xs text-neutral-800 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    aria-label="Clear customer search query"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700 cursor-pointer"
                  >
                    <XIcon size={14} />
                  </button>
                )}
              </div>

              {/* Composable Filters Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {/* 1. Status Filter */}
                <select
                  value={selectedStatus}
                  onChange={(e) =>
                    setSelectedStatus(e.target.value as "ALL" | CustomerStatus)
                  }
                  aria-label="Filter by account status"
                  className="h-10 px-3 rounded-xl border border-neutral-200 bg-canvas text-xs font-semibold text-neutral-700 focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="blocked">Blocked</option>
                </select>

                {/* 2. Activity Filter */}
                <select
                  value={selectedActivity}
                  onChange={(e) =>
                    setSelectedActivity(e.target.value as ActivityFilter)
                  }
                  aria-label="Filter by purchase activity"
                  className="h-10 px-3 rounded-xl border border-neutral-200 bg-canvas text-xs font-semibold text-neutral-700 focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer"
                >
                  <option value="ALL">All Customers</option>
                  <option value="WITH_ORDERS">With Orders</option>
                  <option value="NO_ORDERS">No Orders</option>
                </select>

                {/* 3. Spending Filter */}
                <select
                  value={selectedSpending}
                  onChange={(e) =>
                    setSelectedSpending(e.target.value as SpendingFilter)
                  }
                  aria-label="Filter by total customer spend"
                  className="h-10 px-3 rounded-xl border border-neutral-200 bg-canvas text-xs font-semibold text-neutral-700 focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer"
                >
                  <option value="ALL">All Spending</option>
                  <option value="ZERO">₹0 (No Spend)</option>
                  <option value="1_TO_999">₹1–₹999</option>
                  <option value="1000_TO_4999">₹1,000–₹4,999</option>
                  <option value="5000_PLUS">₹5,000+</option>
                </select>

                {/* 4. Joined Date Filter */}
                <select
                  value={selectedDateRange}
                  onChange={(e) =>
                    setSelectedDateRange(e.target.value as DateFilter)
                  }
                  aria-label="Filter by registration date"
                  className="h-10 px-3 rounded-xl border border-neutral-200 bg-canvas text-xs font-semibold text-neutral-700 focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer"
                >
                  <option value="ALL">All Time</option>
                  <option value="TODAY">Today</option>
                  <option value="7DAYS">Last 7 Days</option>
                  <option value="30DAYS">Last 30 Days</option>
                </select>
              </div>
            </div>

            {/* Results Counter and Active Filter Reset */}
            <div className="flex items-center justify-between text-xs text-neutral-500 pt-1">
              <div>
                Showing{" "}
                <span className="font-bold text-neutral-800">
                  {filteredCustomers.length}
                </span>{" "}
                of{" "}
                <span className="font-bold text-neutral-800">
                  {customers.length}
                </span>{" "}
                customers
              </div>

              {isFiltered && (
                <button
                  type="button"
                  onClick={handleClearAllFilters}
                  className="font-bold text-primary-dark hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <XIcon size={12} />
                  <span>Clear all filters</span>
                </button>
              )}
            </div>
          </div>

          {/* ====================================================================
              3. CUSTOMERS LIST (TABLE FOR DESKTOP / CARDS FOR MOBILE)
              ==================================================================== */}
          {filteredCustomers.length === 0 ? (
            /* Empty State */
            <div className="p-12 rounded-2xl bg-surface border border-neutral-200/80 text-center space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-neutral-100 text-neutral-400 flex items-center justify-center mx-auto">
                <UsersIcon size={24} />
              </div>
              <div className="space-y-1">
                <h3 className="font-display text-base font-bold text-neutral-800">
                  {customers.length === 0
                    ? "No customers yet"
                    : "No customers found"}
                </h3>
                <p className="text-xs text-neutral-500 max-w-sm mx-auto">
                  {customers.length === 0
                    ? "Customers will appear here when they register or place orders on the storefront."
                    : "Try adjusting your search or filters."}
                </p>
              </div>
              {isFiltered && (
                <button
                  type="button"
                  onClick={handleClearAllFilters}
                  className="px-4 py-2 rounded-xl bg-primary hover:bg-[#91BC7A] text-neutral-900 text-xs font-bold transition-all cursor-pointer shadow-2xs"
                >
                  Clear all filters
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Desktop Table (>= 1024px) */}
              <div className="hidden lg:block rounded-2xl bg-surface border border-neutral-200/80 shadow-2xs overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-neutral-200/80 bg-neutral-50/75 text-[11px] font-bold uppercase tracking-wider text-neutral-500 select-none">
                      <th className="py-3.5 pl-6 pr-4">Customer</th>
                      <th className="py-3.5 px-4">Contact</th>
                      <th className="py-3.5 px-4 text-center">Orders</th>
                      <th className="py-3.5 px-4">Total Spent</th>
                      <th className="py-3.5 px-4">Last Order</th>
                      <th className="py-3.5 px-4">Status</th>
                      <th className="py-3.5 pl-4 pr-6 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100 text-xs">
                    {filteredCustomers.map((customer) => {
                      const isDropdownOpen = openDropdownId === customer.id;
                      const initial = customer.name.charAt(0).toUpperCase();

                      return (
                        <tr
                          key={customer.id}
                          className="hover:bg-neutral-50/60 transition-colors group"
                        >
                          {/* Customer Name & ID */}
                          <td className="py-4 pl-6 pr-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-neutral-900 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-2xs">
                                {initial}
                              </div>
                              <div className="space-y-0.5">
                                <Link
                                  href={`/admin/customers/${customer.id}`}
                                  className="font-bold text-neutral-900 hover:text-primary-dark transition-colors block text-sm"
                                >
                                  {customer.name}
                                </Link>
                                <span className="font-mono text-[10px] text-neutral-400 bg-neutral-100 px-1.5 py-0.5 rounded border border-neutral-200">
                                  {customer.id}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* Contact Info */}
                          <td className="py-4 px-4 text-neutral-600">
                            <div className="space-y-1">
                              <div className="flex items-center gap-1.5 text-neutral-800">
                                <MailIcon size={13} className="text-neutral-400" />
                                <span className="truncate max-w-[190px]">
                                  {customer.email}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 text-neutral-500 font-mono text-[11px]">
                                <PhoneIcon size={13} className="text-neutral-400" />
                                <span>{customer.phone}</span>
                              </div>
                            </div>
                          </td>

                          {/* Orders Count */}
                          <td className="py-4 px-4 text-center">
                            {customer.orderCount > 0 ? (
                              <Link
                                href={`/admin/customers/${customer.id}#orders`}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-800 font-bold text-xs transition-colors"
                                title="View customer orders"
                              >
                                <span>{customer.orderCount}</span>
                                <span className="text-[10px] text-neutral-500 font-normal">
                                  {customer.orderCount === 1 ? "order" : "orders"}
                                </span>
                              </Link>
                            ) : (
                              <span className="text-neutral-400 font-medium text-[11px]">
                                0 orders
                              </span>
                            )}
                          </td>

                          {/* Total Spent */}
                          <td className="py-4 px-4 font-bold text-neutral-900">
                            ₹{customer.totalSpent.toLocaleString("en-IN")}
                          </td>

                          {/* Last Order Date */}
                          <td className="py-4 px-4 text-neutral-600">
                            <div className="space-y-0.5">
                              <span className="font-medium block">
                                {formatDate(customer.lastOrderAt)}
                              </span>
                              <span className="text-[10px] text-neutral-400 block">
                                Joined {formatDate(customer.joinedAt)}
                              </span>
                            </div>
                          </td>

                          {/* Status Badge */}
                          <td className="py-4 px-4">
                            {renderStatusBadge(customer.status)}
                          </td>

                          {/* Actions (3-Dot Menu) */}
                          <td className="py-4 pl-4 pr-6 text-right relative">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenDropdownId(
                                  isDropdownOpen ? null : customer.id
                                );
                              }}
                              aria-label={`Actions for customer ${customer.name}`}
                              aria-expanded={isDropdownOpen}
                              className="w-8 h-8 rounded-lg border border-neutral-200 hover:bg-neutral-100 inline-flex items-center justify-center text-neutral-600 transition-colors cursor-pointer"
                            >
                              <MoreVerticalIcon size={16} />
                            </button>

                            {/* Dropdown Menu */}
                            {isDropdownOpen && (
                              <div
                                ref={dropdownRef}
                                className="absolute right-6 top-12 z-40 w-48 rounded-xl bg-white border border-neutral-200 shadow-xl p-1.5 space-y-0.5 text-left animate-in fade-in zoom-in-95 duration-100"
                              >
                                <Link
                                  href={`/admin/customers/${customer.id}`}
                                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900 transition-colors cursor-pointer"
                                >
                                  <EyeIcon size={14} className="text-neutral-400" />
                                  <span>View Customer</span>
                                </Link>

                                <Link
                                  href={`/admin/customers/${customer.id}#orders`}
                                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900 transition-colors cursor-pointer"
                                >
                                  <ShoppingCartIcon size={14} className="text-neutral-400" />
                                  <span>View Orders ({customer.orderCount})</span>
                                </Link>

                                <Link
                                  href={`/admin/customers/${customer.id}/edit`}
                                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900 transition-colors cursor-pointer"
                                >
                                  <EditIcon size={14} className="text-neutral-400" />
                                  <span>Edit Customer</span>
                                </Link>

                                <div className="border-t border-neutral-100 my-1" />

                                {/* Contextual Status Actions */}
                                {customer.status === "active" && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleOpenStatusModal(customer, "inactive")
                                      }
                                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-amber-700 hover:bg-amber-50 transition-colors cursor-pointer"
                                    >
                                      <AlertCircleIcon size={14} className="text-amber-500" />
                                      <span>Deactivate</span>
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleOpenStatusModal(customer, "blocked")
                                      }
                                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-rose-700 hover:bg-rose-50 transition-colors cursor-pointer"
                                    >
                                      <BanIcon size={14} className="text-rose-500" />
                                      <span>Block Customer</span>
                                    </button>
                                  </>
                                )}

                                {customer.status === "inactive" && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleOpenStatusModal(customer, "active")
                                      }
                                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-emerald-700 hover:bg-emerald-50 transition-colors cursor-pointer"
                                    >
                                      <CheckCircleIcon size={14} className="text-emerald-500" />
                                      <span>Activate Account</span>
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleOpenStatusModal(customer, "blocked")
                                      }
                                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-rose-700 hover:bg-rose-50 transition-colors cursor-pointer"
                                    >
                                      <BanIcon size={14} className="text-rose-500" />
                                      <span>Block Customer</span>
                                    </button>
                                  </>
                                )}

                                {customer.status === "blocked" && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleOpenStatusModal(customer, "active")
                                    }
                                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-emerald-700 hover:bg-emerald-50 transition-colors cursor-pointer"
                                  >
                                    <ShieldAlertIcon size={14} className="text-emerald-500" />
                                    <span>Unblock (Reactivate)</span>
                                  </button>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Responsive Cards (< 1024px) */}
              <div className="lg:hidden space-y-3">
                {filteredCustomers.map((customer) => {
                  const isDropdownOpen = openDropdownId === customer.id;
                  const initial = customer.name.charAt(0).toUpperCase();

                  return (
                    <div
                      key={customer.id}
                      className="p-4 rounded-2xl bg-surface border border-neutral-200/80 shadow-2xs space-y-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-9 h-9 rounded-full bg-neutral-900 text-white font-bold text-xs flex items-center justify-center shrink-0">
                            {initial}
                          </div>
                          <div className="min-w-0">
                            <Link
                              href={`/admin/customers/${customer.id}`}
                              className="font-bold text-sm text-neutral-900 truncate block hover:text-primary-dark"
                            >
                              {customer.name}
                            </Link>
                            <span className="font-mono text-[10px] text-neutral-400">
                              {customer.id}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {renderStatusBadge(customer.status)}

                          {/* 3-Dot Mobile Action Trigger (Touch target >= 44px) */}
                          <div className="relative">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenDropdownId(
                                  isDropdownOpen ? null : customer.id
                                );
                              }}
                              aria-label={`Actions for customer ${customer.name}`}
                              className="w-11 h-11 rounded-lg border border-neutral-200 hover:bg-neutral-100 flex items-center justify-center text-neutral-600 cursor-pointer"
                            >
                              <MoreVerticalIcon size={16} />
                            </button>

                            {/* Mobile Dropdown */}
                            {isDropdownOpen && (
                              <div
                                ref={dropdownRef}
                                className="absolute right-0 top-12 z-40 w-48 rounded-xl bg-white border border-neutral-200 shadow-xl p-1.5 space-y-0.5 text-left"
                              >
                                <Link
                                  href={`/admin/customers/${customer.id}`}
                                  className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-semibold text-neutral-700 hover:bg-neutral-100 cursor-pointer"
                                >
                                  <EyeIcon size={14} />
                                  <span>View Customer</span>
                                </Link>

                                <Link
                                  href={`/admin/customers/${customer.id}#orders`}
                                  className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-semibold text-neutral-700 hover:bg-neutral-100 cursor-pointer"
                                >
                                  <ShoppingCartIcon size={14} />
                                  <span>View Orders ({customer.orderCount})</span>
                                </Link>

                                <Link
                                  href={`/admin/customers/${customer.id}/edit`}
                                  className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-semibold text-neutral-700 hover:bg-neutral-100 cursor-pointer"
                                >
                                  <EditIcon size={14} />
                                  <span>Edit Customer</span>
                                </Link>

                                <div className="border-t border-neutral-100 my-1" />

                                {customer.status === "active" && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleOpenStatusModal(customer, "inactive")
                                      }
                                      className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-semibold text-amber-700 hover:bg-amber-50 cursor-pointer"
                                    >
                                      <AlertCircleIcon size={14} />
                                      <span>Deactivate</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleOpenStatusModal(customer, "blocked")
                                      }
                                      className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-semibold text-rose-700 hover:bg-rose-50 cursor-pointer"
                                    >
                                      <BanIcon size={14} />
                                      <span>Block Customer</span>
                                    </button>
                                  </>
                                )}

                                {customer.status === "inactive" && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleOpenStatusModal(customer, "active")
                                      }
                                      className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-semibold text-emerald-700 hover:bg-emerald-50 cursor-pointer"
                                    >
                                      <CheckCircleIcon size={14} />
                                      <span>Activate Account</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleOpenStatusModal(customer, "blocked")
                                      }
                                      className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-semibold text-rose-700 hover:bg-rose-50 cursor-pointer"
                                    >
                                      <BanIcon size={14} />
                                      <span>Block Customer</span>
                                    </button>
                                  </>
                                )}

                                {customer.status === "blocked" && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleOpenStatusModal(customer, "active")
                                    }
                                    className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-semibold text-emerald-700 hover:bg-emerald-50 cursor-pointer"
                                  >
                                    <ShieldAlertIcon size={14} />
                                    <span>Unblock (Reactivate)</span>
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Contact details */}
                      <div className="text-xs text-neutral-600 space-y-1">
                        <div className="flex items-center gap-2">
                          <MailIcon size={12} className="text-neutral-400" />
                          <span className="truncate">{customer.email}</span>
                        </div>
                        <div className="flex items-center gap-2 font-mono text-[11px]">
                          <PhoneIcon size={12} className="text-neutral-400" />
                          <span>{customer.phone}</span>
                        </div>
                      </div>

                      {/* Financial Summary */}
                      <div className="pt-2 border-t border-neutral-100 grid grid-cols-3 gap-2 text-xs">
                        <div>
                          <span className="text-neutral-400 block text-[10px] uppercase font-bold">
                            Orders
                          </span>
                          <span className="font-bold text-neutral-800">
                            {customer.orderCount}
                          </span>
                        </div>

                        <div>
                          <span className="text-neutral-400 block text-[10px] uppercase font-bold">
                            Total Spent
                          </span>
                          <span className="font-bold text-neutral-900">
                            ₹{customer.totalSpent.toLocaleString("en-IN")}
                          </span>
                        </div>

                        <div>
                          <span className="text-neutral-400 block text-[10px] uppercase font-bold">
                            Last Order
                          </span>
                          <span className="text-[11px] text-neutral-600 truncate block">
                            {formatDate(customer.lastOrderAt)}
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

      {/* ====================================================================
          4. STATUS TRANSITION MODAL (DEACTIVATE / BLOCK / ACTIVATE)
          ==================================================================== */}
      {customerToChangeStatus && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150"
          role="dialog"
          aria-modal="true"
          aria-labelledby="customer-status-modal-title"
        >
          <div className="bg-surface rounded-2xl border border-neutral-200 shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-bold bg-neutral-100 px-2 py-0.5 rounded border border-neutral-200">
                  {customerToChangeStatus.id}
                </span>
                <span className="text-xs text-neutral-500">
                  Status Transition
                </span>
              </div>
              <button
                type="button"
                onClick={() => setCustomerToChangeStatus(null)}
                aria-label="Close status modal"
                className="w-8 h-8 rounded-lg border border-neutral-200 flex items-center justify-center text-neutral-400 hover:text-neutral-700 cursor-pointer"
              >
                <XIcon size={16} />
              </button>
            </div>

            <div className="space-y-1">
              <h3
                id="customer-status-modal-title"
                className="text-base font-bold text-neutral-900"
              >
                {targetStatus === "blocked"
                  ? "Block Customer Account"
                  : targetStatus === "inactive"
                  ? "Deactivate Customer Account"
                  : "Activate Customer Account"}
              </h3>
              <p className="text-xs text-neutral-500">
                You are about to change the status of{" "}
                <span className="font-bold text-neutral-700">
                  {customerToChangeStatus.name}
                </span>{" "}
                ({customerToChangeStatus.email}) to{" "}
                <span className="font-bold uppercase text-neutral-900">
                  {targetStatus}
                </span>
                .
              </p>
            </div>

            {/* Warning / Caution Alerts */}
            {targetStatus === "blocked" && (
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-950 text-xs flex items-start gap-2.5">
                <BanIcon size={18} className="text-rose-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <strong>Important Security Notice:</strong>
                  <p className="leading-relaxed">
                    Blocking this account immediately prevents the customer from placing orders, redeeming discounts, or logging into customer portals.
                  </p>
                </div>
              </div>
            )}

            {targetStatus === "inactive" && (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2">
                <AlertCircleIcon size={16} className="text-amber-600 shrink-0 mt-0.5" />
                <span>
                  Deactivating keeps historical orders safe while pausing active customer marketing campaigns.
                </span>
              </div>
            )}

            {/* Optional Reason / Log */}
            <div className="space-y-1.5 pt-1">
              <label
                htmlFor="status-reason-input"
                className="block text-xs font-semibold text-neutral-700"
              >
                Administrative Reason / Note{" "}
                <span className="text-neutral-400 font-normal">(optional)</span>
              </label>
              <textarea
                id="status-reason-input"
                rows={2}
                value={statusChangeReason}
                onChange={(e) => setStatusChangeReason(e.target.value)}
                placeholder="e.g. Requested dormancy, resolved support inquiry, or fraud prevention..."
                className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-xs text-neutral-800 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary resize-none"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-neutral-100">
              <button
                type="button"
                onClick={() => setCustomerToChangeStatus(null)}
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
                {targetStatus === "blocked"
                  ? "Confirm & Block"
                  : targetStatus === "inactive"
                  ? "Confirm Deactivation"
                  : "Confirm Activation"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
