"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import {
  AccountShell,
  AccountNavigation,
  AccountOverview,
  ProfileCard,
  OrderHistory,
} from "@/components/customer/account";
import { DEMO_CUSTOMER } from "@/data/demo-account";
import { DEMO_ORDERS } from "@/data/demo-orders";

export default function AccountPageClient() {
  const router = useRouter();
  const { user, isLoading, logout } = useAuth();
  const [customer, setCustomer] = useState(DEMO_CUSTOMER);
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);

  React.useEffect(() => {
    if (!isLoading) {
      if (!user) {
        router.replace("/login");
      } else {
        setCustomer({
          id: user.id,
          fullName: user.fullName || "Dearr Customer",
          email: user.email,
          phone: user.phone || "Not provided",
          role: "customer",
          createdAt:
            typeof user.createdAt === "string"
              ? user.createdAt
              : new Date(user.createdAt).toISOString(),
        });
      }
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
            <div className="h-36 bg-neutral-200/60 rounded-2xl" />
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

      {/* Desktop: Sidebar + Content layout */}
      <div className="flex gap-8 lg:gap-12">
        {/* Sidebar */}
        <div className="hidden md:block w-56 lg:w-60 shrink-0">
          <AccountNavigation onSignOut={handleSignOut} />
        </div>

        {/* Main Content */}
        <div className="flex-1 min-w-0 space-y-6">
          {/* Mobile Navigation */}
          <div className="md:hidden">
            <AccountNavigation onSignOut={handleSignOut} />
          </div>

          <AccountOverview
            orders={DEMO_ORDERS}
            customerName={customer.fullName}
          />

          <ProfileCard profile={customer} />

          <OrderHistory orders={DEMO_ORDERS} compact />
        </div>
      </div>
    </AccountShell>
  );
}
