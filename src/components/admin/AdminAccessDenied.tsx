"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { LockIcon, ArrowLeftIcon, LogOutIcon } from "./AdminIcons";

interface AdminAccessDeniedProps {
  user?: { email?: string; fullName?: string; role?: string } | null;
  onSignOut?: () => Promise<void> | void;
}

/**
 * AdminAccessDenied — Professional access-denied state displayed when an authenticated
 * non-admin user (role: 'customer') attempts to access the /admin operations portal.
 *
 * Implements:
 * - Clear, non-technical explanation of access restriction
 * - Displays active session identity without leaking system internals
 * - Safe navigation links back to the consumer storefront and customer account
 * - "Switch Account" action that cleanly invalidates the customer session and redirects to /admin/login
 * - Responsive layout verified across all viewports (320px to 1440px)
 */
export function AdminAccessDenied({ user, onSignOut }: AdminAccessDeniedProps) {
  const router = useRouter();
  const { logout } = useAuth();
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      if (onSignOut) {
        await onSignOut();
      } else {
        await fetch("/api/auth/logout", {
          method: "POST",
          credentials: "same-origin",
        });
        await logout();
        router.push("/admin/login");
      }
    } catch {
      router.push("/admin/login");
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <div
      className="min-h-screen w-full flex items-center justify-center p-4 sm:p-6"
      style={{ background: "#F4F1E8" }}
    >
      <div className="w-full max-w-lg bg-surface rounded-2xl sm:rounded-3xl shadow-modal border border-neutral-200/80 p-6 sm:p-8 text-center space-y-6 animate-in fade-in zoom-in-95 duration-200">
        {/* Lock Graphic */}
        <div className="mx-auto w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-700 flex items-center justify-center shadow-xs">
          <LockIcon size={32} />
        </div>

        {/* Content */}
        <div className="space-y-2">
          <div className="inline-block px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-red-100 text-red-800 border border-red-200">
            Access Restricted
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-neutral-900 tracking-tight">
            Administrator Privileges Required
          </h1>
          <p className="text-xs sm:text-sm text-neutral-600 leading-relaxed max-w-md mx-auto">
            The Dearr Operations Portal is restricted to authorized store operators and founders.
            {user?.email && (
              <span className="block mt-1 font-medium text-neutral-700">
                You are currently signed in as <strong className="text-neutral-900">{user.email}</strong> (Role: <span className="capitalize">{user.role || "customer"}</span>).
              </span>
            )}
          </p>
        </div>

        {/* Identity & Policy Box */}
        <div className="p-4 rounded-xl bg-neutral-50 border border-neutral-200 text-left text-xs space-y-1.5">
          <div className="font-bold text-neutral-800 flex items-center justify-between">
            <span>Security Policy</span>
            <span className="font-mono text-[10px] text-neutral-400">ROLE_CHECK_FAILED</span>
          </div>
          <p className="text-neutral-500 text-[11px] leading-relaxed">
            Your account does not possess administrator credentials. If you are a Dearr team member, please sign in with your designated founder credentials or contact the system administrator.
          </p>
        </div>

        {/* Navigation Actions */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <Link
            href="/"
            className="flex-1 h-11 rounded-xl bg-primary hover:bg-[#91BC7A] active:scale-98 text-neutral-900 text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-2"
          >
            <ArrowLeftIcon size={14} />
            <span>Return to Store</span>
          </Link>

          <Link
            href="/account"
            className="flex-1 h-11 rounded-xl border border-neutral-300 hover:bg-neutral-100 active:scale-98 text-neutral-700 text-xs font-semibold transition-all flex items-center justify-center gap-2"
          >
            <span>My Account</span>
          </Link>

          <button
            type="button"
            onClick={handleSignOut}
            disabled={isSigningOut}
            className="h-11 px-4 rounded-xl border border-red-200 bg-red-50/50 hover:bg-red-50 text-red-700 text-xs font-semibold transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
          >
            <LogOutIcon size={14} />
            <span>{isSigningOut ? "Signing Out..." : "Switch Account"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
