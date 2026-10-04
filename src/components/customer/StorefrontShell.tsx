"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { CustomerHeader } from "./CustomerHeader";

interface StorefrontShellProps {
  children: React.ReactNode;
}

const AUTH_ROUTES = new Set([
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
]);

/**
 * StorefrontShell manages global storefront chrome (CustomerHeader,
 * DesktopHeader, MobileBottomNav, and mobile bottom clearance).
 *
 * Route Isolation Rule:
 * Authentication screens (/login, /signup, /forgot-password, /reset-password)
 * are dedicated auth experiences and MUST NOT display ecommerce chrome
 * (no desktop navbar, no mobile top header, no mobile bottom nav dock).
 *
 * All other storefront routes (/, /shop, /product/*, /wishlist, /cart,
 * /checkout, /account, etc.) render the full global chrome normally.
 */
export function StorefrontShell({ children }: StorefrontShellProps) {
  const pathname = usePathname();
  const isAdminRoute = pathname.startsWith("/admin");
  const isAuthRoute = AUTH_ROUTES.has(pathname);

  // Admin routes: dedicated business operations shell (no customer storefront navbar/dock)
  if (isAdminRoute) {
    return <div className="flex-1 flex flex-col min-h-screen">{children}</div>;
  }

  // Customer auth routes: focused full-viewport authentication experience
  if (isAuthRoute) {
    return (
      <div className="flex-1 flex flex-col min-h-screen bg-[#F4F1E8]">
        {children}
      </div>
    );
  }

  return (
    <>
      <CustomerHeader />
      <div className="flex-1 pb-[calc(6rem+env(safe-area-inset-bottom,0px))] md:pb-0">{children}</div>
    </>
  );
}
