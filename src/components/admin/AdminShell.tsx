"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { AdminBrand } from "./AdminBrand";
import { AdminAccessDenied } from "./AdminAccessDenied";
import {
  LayoutDashboardIcon,
  PackageIcon,
  LayersIcon,
  TagIcon,
  ShoppingCartIcon,
  UsersIcon,
  SlidersIcon,
  LogOutIcon,
  MenuIcon,
  XIcon,
  ExternalLinkIcon,
  ShieldCheckIcon,
  StarIcon,
} from "./AdminIcons";

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  isImplemented: boolean;
  badge?: string;
}

const NAV_ITEMS: NavItem[] = [
  {
    name: "Dashboard",
    href: "/admin",
    icon: LayoutDashboardIcon,
    isImplemented: true,
  },
  {
    name: "Products",
    href: "/admin/products",
    icon: PackageIcon,
    isImplemented: true,
  },
  {
    name: "Categories",
    href: "/admin/categories",
    icon: LayersIcon,
    isImplemented: true,
  },
  {
    name: "Discounts",
    href: "/admin/discounts",
    icon: TagIcon,
    isImplemented: true,
  },
  {
    name: "Orders",
    href: "/admin/orders",
    icon: ShoppingCartIcon,
    isImplemented: true,
  },
  {
    name: "Customers",
    href: "/admin/customers",
    icon: UsersIcon,
    isImplemented: true,
  },
  {
    name: "Reviews",
    href: "/admin/reviews",
    icon: StarIcon,
    isImplemented: true,
  },
  {
    name: "Settings",
    href: "/admin/settings",
    icon: SlidersIcon,
    isImplemented: true,
  },
];

interface AdminShellProps {
  children: React.ReactNode;
}

interface AdminProfile {
  id: string;
  email: string;
  fullName: string;
  role: "admin";
}

/**
 * AdminShell — Foundation layout shell for Dearr Founder/Admin operations.
 *
 * Implements:
 * - Server-side authorization verification via GET /api/admin/verify (Step §3 & §4)
 * - Zero auth flicker: accessible loading skeleton during initial credential check
 * - Access-denied state for authenticated non-admin customers (Step §5)
 * - Unauthenticated redirect to /admin/login?redirect=... (Step §8)
 * - Safe admin sign-out via POST /api/auth/logout with state clearance (Step §6)
 * - Real admin profile identity display in desktop sidebar & mobile drawer
 */
export function AdminShell({ children }: AdminShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [authStatus, setAuthStatus] = useState<"loading" | "authorized" | "denied" | "unauthenticated">("loading");
  const [adminProfile, setAdminProfile] = useState<AdminProfile | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);

  // Close mobile drawer on route changes or ESC key
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileMenuOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Server-Authoritative Admin Authorization Verification
  useEffect(() => {
    let isMounted = true;

    async function verifyAdmin() {
      try {
        const res = await fetch("/api/admin/verify", {
          method: "GET",
          headers: { "Cache-Control": "no-cache" },
          credentials: "same-origin",
        });

        if (!isMounted) return;

        if (res.status === 200) {
          const data = await res.json().catch(() => null);
          if (data?.ok && data.admin) {
            setAdminProfile(data.admin);
            setAuthStatus("authorized");
            return;
          }
        }

        if (res.status === 403) {
          setAuthStatus("denied");
          return;
        }

        // 401 Unauthorized or any other status -> redirect to admin login
        setAuthStatus("unauthenticated");
        const redirectParam = encodeURIComponent(pathname);
        router.replace(`/admin/login?redirect=${redirectParam}`);
      } catch {
        if (!isMounted) return;
        setAuthStatus("unauthenticated");
        router.replace(`/admin/login?redirect=${encodeURIComponent(pathname)}`);
      }
    }

    verifyAdmin();

    return () => {
      isMounted = false;
    };
  }, [pathname, router]);

  // Real Admin Logout
  const handleSignOut = async () => {
    if (isSigningOut) return;
    setIsSigningOut(true);

    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "same-origin",
      });
      await logout();
      router.replace("/admin/login");
    } catch {
      router.replace("/admin/login");
    } finally {
      setIsSigningOut(false);
    }
  };

  // 1. Loading Skeleton — Prevents UI flicker exposing admin data
  if (authStatus === "loading") {
    return (
      <div
        className="h-[100dvh] min-h-[100dvh] max-h-[100dvh] bg-[#F4F1E8] flex flex-col md:flex-row overflow-hidden antialiased"
        aria-busy="true"
        aria-label="Verifying administrator credentials"
      >
        {/* Desktop Sidebar Skeleton */}
        <aside
          className="hidden md:flex flex-col w-64 lg:w-[270px] shrink-0 h-full bg-surface border-r border-neutral-200/80 p-5 justify-between select-none"
          aria-hidden="true"
        >
          <div className="space-y-6">
            <div className="h-8 w-28 bg-neutral-200/70 rounded-xl animate-pulse" />
            <div className="space-y-2 pt-2">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="h-10 bg-neutral-200/50 rounded-xl animate-pulse" />
              ))}
            </div>
          </div>
          <div className="h-14 bg-neutral-200/60 rounded-xl animate-pulse" />
        </aside>

        {/* Main Content Area Skeleton */}
        <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
          <header className="h-14 md:h-16 border-b border-neutral-200/80 bg-surface flex items-center justify-between px-4 sm:px-6">
            <div className="h-4 w-36 bg-neutral-200/70 rounded animate-pulse" />
            <div className="h-7 w-24 bg-neutral-200/70 rounded-full animate-pulse" />
          </header>
          <main className="flex-1 p-6 flex flex-col items-center justify-center gap-3">
            <div className="w-8 h-8 rounded-full border-3 border-primary border-t-transparent animate-spin" />
            <span className="text-xs font-semibold text-neutral-600">
              Verifying administrator authorization...
            </span>
          </main>
        </div>
      </div>
    );
  }

  // 2. Access Denied Screen for authenticated Customers
  if (authStatus === "denied") {
    return <AdminAccessDenied user={user} onSignOut={handleSignOut} />;
  }

  // 3. Unauthenticated State (actively redirecting to /admin/login)
  if (authStatus === "unauthenticated") {
    return null;
  }

  // 4. Authenticated Administrator View
  return (
    <div className="h-[100dvh] min-h-[100dvh] max-h-[100dvh] bg-canvas text-neutral-800 flex flex-col md:flex-row overflow-hidden antialiased">
      {/* ====================================================================
          1. DESKTOP STICKY/FIXED SIDEBAR (>= 768px / md:)
          ==================================================================== */}
      <aside
        className="hidden md:flex flex-col w-64 lg:w-[270px] shrink-0 h-full bg-surface border-r border-neutral-200/80 select-none z-30 overflow-hidden"
        aria-label="Admin Navigation Sidebar"
      >
        {/* Brand / Top Identity */}
        <div className="p-5 border-b border-neutral-100 flex items-center justify-between shrink-0">
          <AdminBrand variant="sidebar" />
        </div>

        {/* Navigation List */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto min-h-0">
          <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-neutral-400">
            Operations Menu
          </div>

          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.href === "/admin"
                ? pathname === "/admin"
                : pathname.startsWith(item.href);

            if (!item.isImplemented) {
              return (
                <div
                  key={item.name}
                  className="flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold text-neutral-400 cursor-not-allowed group"
                  title={`${item.name} management will be unlocked in Phase 4`}
                >
                  <div className="flex items-center gap-3">
                    <Icon size={18} className="text-neutral-300" />
                    <span>{item.name}</span>
                  </div>
                  {item.badge && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-500 border border-neutral-200">
                      {item.badge}
                    </span>
                  )}
                </div>
              );
            }

            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                  isActive
                    ? "bg-primary/20 text-neutral-900 border border-primary/40 shadow-xs"
                    : "text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    size={18}
                    className={isActive ? "text-neutral-900" : "text-neutral-500"}
                  />
                  <span>{item.name}</span>
                </div>
              </Link>
            );
          })}
        </nav>

        {/* Bottom Operational Controls */}
        <div className="p-3 border-t border-neutral-100 space-y-1 bg-neutral-50/50 shrink-0">
          <div className="flex items-center justify-between px-3 py-2 text-xs font-semibold text-neutral-400 cursor-not-allowed">
            <div className="flex items-center gap-3">
              <SlidersIcon size={17} className="text-neutral-300" />
              <span>Settings</span>
            </div>
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-500 border border-neutral-200">
              Phase 4
            </span>
          </div>

          <Link
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 transition-colors"
          >
            <div className="flex items-center gap-3">
              <ExternalLinkIcon size={16} className="text-neutral-400" />
              <span>Live Storefront</span>
            </div>
            <span className="text-[10px] text-neutral-400">↗</span>
          </Link>

          {/* Secure Admin Sign Out Button */}
          <button
            type="button"
            onClick={handleSignOut}
            disabled={isSigningOut}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold text-error hover:bg-red-50 transition-colors mt-1 cursor-pointer disabled:opacity-50 text-left"
          >
            <LogOutIcon size={16} />
            <span>{isSigningOut ? "Signing Out..." : "Sign Out"}</span>
          </button>

          {/* Admin Identity Card with Real Session Data */}
          <div className="pt-2 px-1">
            <div className="p-2.5 rounded-xl bg-white border border-neutral-200/80 flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-neutral-900 text-white flex items-center justify-center text-xs font-bold shrink-0">
                {(adminProfile?.fullName || "A").charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold text-neutral-900 truncate">
                  {adminProfile?.fullName || "Administrator"}
                </div>
                <div className="text-[10px] text-neutral-500 truncate flex items-center gap-1">
                  <ShieldCheckIcon size={11} className="text-primary shrink-0" />
                  <span>Super Administrator</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* ====================================================================
          2. MOBILE TOP HEADER (< 768px / < md:)
          ==================================================================== */}
      <header
        className="md:hidden shrink-0 z-40 bg-surface border-b border-neutral-200/80 h-14 px-4 flex items-center justify-between select-none"
        aria-label="Mobile Admin Header"
      >
        <AdminBrand variant="header" />

        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-primary/20 text-neutral-900 border border-primary/30">
            Founder
          </span>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Open admin navigation"
            aria-expanded={mobileMenuOpen}
            className="w-9 h-9 rounded-xl border border-neutral-200 flex items-center justify-center text-neutral-700 hover:bg-neutral-100 transition-colors cursor-pointer"
          >
            {mobileMenuOpen ? <XIcon size={18} /> : <MenuIcon size={18} />}
          </button>
        </div>
      </header>

      {/* Mobile Slide-Out Navigation Drawer */}
      {mobileMenuOpen && (
        <div
          className="md:hidden fixed inset-0 z-50 bg-neutral-900/40 backdrop-blur-xs flex animate-in fade-in duration-150"
          onClick={() => setMobileMenuOpen(false)}
        >
          <div
            className="w-4/5 max-w-xs h-full bg-surface border-r border-neutral-200 p-4 flex flex-col justify-between shadow-2xl animate-in slide-in-from-left duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
                <AdminBrand variant="sidebar" />
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  aria-label="Close menu"
                  className="p-1 rounded-lg text-neutral-500 hover:bg-neutral-100"
                >
                  <XIcon size={18} />
                </button>
              </div>

              <nav className="space-y-1">
                {NAV_ITEMS.map((item) => {
                  const Icon = item.icon;
                  const isActive =
                    item.href === "/admin"
                      ? pathname === "/admin"
                      : pathname.startsWith(item.href);

                  if (!item.isImplemented) {
                    return (
                      <div
                        key={item.name}
                        className="flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold text-neutral-400"
                      >
                        <div className="flex items-center gap-3">
                          <Icon size={18} className="text-neutral-300" />
                          <span>{item.name}</span>
                        </div>
                        {item.badge && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-500 border border-neutral-200">
                            {item.badge}
                          </span>
                        )}
                      </div>
                    );
                  }

                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                        isActive
                          ? "bg-primary/20 text-neutral-900 border border-primary/40"
                          : "text-neutral-700 hover:bg-neutral-100"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon size={18} className="text-neutral-900" />
                        <span>{item.name}</span>
                      </div>
                    </Link>
                  );
                })}
              </nav>
            </div>

            {/* Mobile Drawer Bottom */}
            <div className="pt-3 border-t border-neutral-100 space-y-2">
              <Link
                href="/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium text-neutral-600 hover:bg-neutral-100"
              >
                <span>Live Storefront</span>
                <span>↗</span>
              </Link>
              <button
                type="button"
                onClick={handleSignOut}
                disabled={isSigningOut}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-error hover:bg-red-50 cursor-pointer disabled:opacity-50 text-left"
              >
                <LogOutIcon size={16} />
                <span>{isSigningOut ? "Signing Out..." : "Sign Out"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================
          3. MAIN CONTENT CONTAINER
          ==================================================================== */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Desktop Top Operational Bar */}
        <header
          className="hidden md:flex items-center justify-between h-16 px-6 lg:px-8 border-b border-neutral-200/80 bg-surface shrink-0 z-20 select-none"
          aria-label="Admin Header"
        >
          <div className="flex items-center gap-2.5">
            <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider">
              Dearr Operations
            </span>
            <span className="text-neutral-300">/</span>
            {pathname === "/admin/products/new" ? (
              <>
                <Link
                  href="/admin/products"
                  className="text-xs font-bold text-neutral-500 hover:text-neutral-900 transition-colors"
                >
                  Products
                </Link>
                <span className="text-neutral-300">/</span>
                <span className="text-xs font-bold text-neutral-900">
                  New Product
                </span>
              </>
            ) : pathname.startsWith("/admin/products/") && pathname.endsWith("/edit") ? (
              <>
                <Link
                  href="/admin/products"
                  className="text-xs font-bold text-neutral-500 hover:text-neutral-900 transition-colors"
                >
                  Products
                </Link>
                <span className="text-neutral-300">/</span>
                <span className="text-xs font-bold text-neutral-900">
                  Edit Product
                </span>
              </>
            ) : pathname.startsWith("/admin/categories/new") ? (
              <>
                <Link
                  href="/admin/categories"
                  className="text-xs font-bold text-neutral-500 hover:text-neutral-900 transition-colors"
                >
                  Categories
                </Link>
                <span className="text-neutral-300">/</span>
                <span className="text-xs font-bold text-neutral-900">
                  New Category
                </span>
              </>
            ) : pathname.startsWith("/admin/categories/") && pathname.endsWith("/edit") ? (
              <>
                <Link
                  href="/admin/categories"
                  className="text-xs font-bold text-neutral-500 hover:text-neutral-900 transition-colors"
                >
                  Categories
                </Link>
                <span className="text-neutral-300">/</span>
                <span className="text-xs font-bold text-neutral-900">
                  Edit Category
                </span>
              </>
            ) : pathname.startsWith("/admin/discounts/new") ? (
              <>
                <Link
                  href="/admin/discounts"
                  className="text-xs font-bold text-neutral-500 hover:text-neutral-900 transition-colors"
                >
                  Discounts
                </Link>
                <span className="text-neutral-300">/</span>
                <span className="text-xs font-bold text-neutral-900">
                  New Discount
                </span>
              </>
            ) : pathname.startsWith("/admin/discounts/") && pathname.endsWith("/edit") ? (
              <>
                <Link
                  href="/admin/discounts"
                  className="text-xs font-bold text-neutral-500 hover:text-neutral-900 transition-colors"
                >
                  Discounts
                </Link>
                <span className="text-neutral-300">/</span>
                <span className="text-xs font-bold text-neutral-900">
                  Edit Discount
                </span>
              </>
            ) : pathname.startsWith("/admin/orders/") ? (
              <>
                <Link
                  href="/admin/orders"
                  className="text-xs font-bold text-neutral-500 hover:text-neutral-900 transition-colors"
                >
                  Orders
                </Link>
                <span className="text-neutral-300">/</span>
                <span className="text-xs font-bold text-neutral-900 font-mono">
                  {decodeURIComponent(pathname.replace("/admin/orders/", ""))}
                </span>
              </>
            ) : pathname.startsWith("/admin/customers/") && pathname.endsWith("/edit") ? (
              <>
                <Link
                  href="/admin/customers"
                  className="text-xs font-bold text-neutral-500 hover:text-neutral-900 transition-colors"
                >
                  Customers
                </Link>
                <span className="text-neutral-300">/</span>
                <span className="text-xs font-bold text-neutral-900">
                  Edit Customer
                </span>
              </>
            ) : pathname.startsWith("/admin/customers/") ? (
              <>
                <Link
                  href="/admin/customers"
                  className="text-xs font-bold text-neutral-500 hover:text-neutral-900 transition-colors"
                >
                  Customers
                </Link>
                <span className="text-neutral-300">/</span>
                <span className="text-xs font-bold text-neutral-900 font-mono">
                  {decodeURIComponent(pathname.replace("/admin/customers/", ""))}
                </span>
              </>
            ) : pathname.startsWith("/admin/reviews/") ? (
              <>
                <Link
                  href="/admin/reviews"
                  className="text-xs font-bold text-neutral-500 hover:text-neutral-900 transition-colors"
                >
                  Reviews
                </Link>
                <span className="text-neutral-300">/</span>
                <span className="text-xs font-bold text-neutral-900 font-mono">
                  {decodeURIComponent(pathname.replace("/admin/reviews/", ""))}
                </span>
              </>
            ) : (
              <span className="text-xs font-bold text-neutral-800">
                {pathname.startsWith("/admin/products")
                  ? "Products"
                  : pathname.startsWith("/admin/categories")
                  ? "Categories"
                  : pathname.startsWith("/admin/discounts")
                  ? "Discounts"
                  : pathname.startsWith("/admin/orders")
                  ? "Orders"
                  : pathname.startsWith("/admin/customers")
                  ? "Customers"
                  : pathname.startsWith("/admin/reviews")
                  ? "Reviews"
                  : pathname.startsWith("/admin/settings")
                  ? "Settings"
                  : "Overview"}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3.5">
            {/* Live Operations Indicator */}
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-primary/20 text-neutral-900 border border-primary/30">
              <span className="w-1.5 h-1.5 rounded-full bg-primary" />
              <span>Operations Live</span>
            </span>

            {/* External Storefront Link */}
            <Link
              href="/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-200 hover:border-neutral-300 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 transition-all"
            >
              <span>View Storefront</span>
              <ExternalLinkIcon size={13} className="text-neutral-500" />
            </Link>
          </div>
        </header>

        {/* Page Children Content */}
        <main
          id="admin-main-content"
          className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto min-h-0"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
