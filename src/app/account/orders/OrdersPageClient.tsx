"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  AccountShell,
  AccountNavigation,
  OrderHistory,
} from "@/components/customer/account";
import { useAuth } from "@/context/AuthContext";
import { DEMO_ORDERS, getAllCustomerOrders } from "@/data/demo-orders";
import type { DemoOrder } from "@/lib/order-model";

export default function OrdersPageClient() {
  const router = useRouter();
  const { user, isLoading, logout } = useAuth();
  const [orders, setOrders] = useState<DemoOrder[]>(DEMO_ORDERS);
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);

  useEffect(() => {
    async function loadOrders() {
      if (user) {
        try {
          const res = await fetch("/api/orders");
          if (res.ok) {
            const data = await res.json();
            if (data.ok && Array.isArray(data.orders)) {
              const mapped: DemoOrder[] = data.orders.map((o: any) => ({
                id: o.id,
                orderNumber: o.orderNumber,
                status: o.status,
                paymentStatus: o.paymentStatus,
                paymentMethod: o.paymentStatus === "paid" ? "Razorpay (Paid)" : "Razorpay (Pending)",
                subtotal: o.subtotal,
                shippingAmount: o.shippingAmount || 0,
                discountAmount: o.discountAmount || 0,
                totalAmount: o.totalAmount,
                currency: o.currency || "INR",
                shippingFullName: o.customerName || user.fullName || "Customer",
                shippingPhone: o.customerPhone || user.phone || "+91 98765 43210",
                shippingEmail: user.email,
                shippingAddressLine1: "",
                shippingCity: "",
                shippingState: "",
                shippingPostalCode: "",
                shippingCountry: "India",
                createdAt: typeof o.createdAt === "string" ? o.createdAt : new Date(o.createdAt).toISOString(),
                items: [],
              }));
              setOrders(mapped);
              return;
            }
          }
        } catch {}
      }
      setOrders(getAllCustomerOrders());
    }

    loadOrders();
  }, [user]);

  React.useEffect(() => {
    if (!isLoading && !user) {
      router.replace("/login");
    }
  }, [user, isLoading, router]);

  const handleSignOut = () => {
    setShowSignOutConfirm(true);
  };

  const confirmSignOut = async () => {
    try {
      await logout();
    } catch {
      // Silent catch
    }
    setShowSignOutConfirm(false);
    router.push("/login");
  };

  if (isLoading) {
    return (
      <AccountShell>
        <div className="flex gap-8 lg:gap-12 animate-pulse" aria-busy="true">
          <div className="hidden md:block w-56 lg:w-60 shrink-0 h-64 bg-neutral-200/60 rounded-2xl" />
          <div className="flex-1 space-y-6">
            <div className="h-48 bg-neutral-200/60 rounded-2xl" />
          </div>
        </div>
      </AccountShell>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <AccountShell>
      {/* Sign-out confirmation overlay */}
      {showSignOutConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-neutral-900/40 backdrop-blur-sm">
          <div
            className="bg-surface rounded-2xl shadow-modal border border-neutral-200 p-6 w-full max-w-sm"
            role="alertdialog"
            aria-labelledby="signout-title"
            aria-describedby="signout-desc"
          >
            <h3
              id="signout-title"
              className="text-lg font-bold text-neutral-900 mb-1"
            >
              Sign Out?
            </h3>
            <p
              id="signout-desc"
              className="text-sm text-neutral-500 mb-5"
            >
              You&apos;ll need to log in again to access your account and order history.
            </p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={confirmSignOut}
                className="flex-1 h-11 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-all active:scale-95"
              >
                Sign Out
              </button>
              <button
                type="button"
                onClick={() => setShowSignOutConfirm(false)}
                className="flex-1 h-11 rounded-xl border border-neutral-300 text-neutral-700 hover:bg-neutral-50 text-sm font-medium transition-all active:scale-95"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-8 lg:gap-12">
        <div className="hidden md:block w-56 lg:w-60 shrink-0">
          <AccountNavigation onSignOut={handleSignOut} />
        </div>

        <div className="flex-1 min-w-0">
          {/* Mobile Navigation */}
          <div className="md:hidden mb-5">
            <AccountNavigation onSignOut={handleSignOut} />
          </div>

          <OrderHistory orders={orders} />
        </div>
      </div>
    </AccountShell>
  );
}
