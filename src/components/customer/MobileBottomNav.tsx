"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  HomeIcon,
  SearchIcon,
  ShopIcon,
  HeartIcon,
  UserIcon,
} from "./Icons";
import { NavbarData, DEFAULT_NAVBAR_DATA } from "./types";

interface MobileBottomNavProps {
  data?: NavbarData;
  onSearchClick?: () => void;
}

interface NavDestination {
  id: string;
  label: string;
  href: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  badgeCount?: number;
}

export function MobileBottomNav({
  data = DEFAULT_NAVBAR_DATA,
  onSearchClick,
}: MobileBottomNavProps) {
  const pathname = usePathname();

  const destinations: NavDestination[] = [
    {
      id: "home",
      label: "Home",
      href: "/",
      icon: HomeIcon,
    },
    {
      id: "search",
      label: "Search",
      href: "/shop",
      icon: SearchIcon,
    },
    {
      id: "shop",
      label: "Shop",
      href: "/shop",
      icon: ShopIcon,
    },
    {
      id: "wishlist",
      label: "Wishlist",
      href: "/wishlist",
      icon: HeartIcon,
      badgeCount: data.wishlistCount,
    },
    {
      id: "account",
      label: data.isLoggedIn ? "Account" : "User",
      href: data.isLoggedIn ? "/account" : "/login",
      icon: UserIcon,
    },
  ];

  return (
    <nav
      role="navigation"
      aria-label="Mobile Bottom Navigation"
      className="md:hidden fixed bottom-[calc(1rem+env(safe-area-inset-bottom,0px))] left-1/2 -translate-x-1/2 z-50 w-auto max-w-[calc(100vw-24px)] select-none"
    >
      <div className="bg-neutral-900/95 backdrop-blur-md text-white rounded-full p-1.5 shadow-modal border border-neutral-700/50 flex items-center justify-center gap-1 sm:gap-1.5">
        {destinations.map((dest) => {
          const Icon = dest.icon;
          const isActive =
            dest.id === "search"
              ? false
              : dest.href === "/"
              ? pathname === "/"
              : pathname.startsWith(dest.href);

          // If onSearchClick is provided and this is search, handle search trigger
          const handleClick = (e: React.MouseEvent) => {
            if (dest.id === "search" && onSearchClick) {
              e.preventDefault();
              onSearchClick();
            }
          };

          return (
            <Link
              key={dest.id}
              href={dest.href}
              onClick={handleClick}
              aria-current={isActive ? "page" : undefined}
              aria-label={`${dest.label}${
                dest.badgeCount ? ` (${dest.badgeCount} items)` : ""
              }`}
              className={`relative min-h-[44px] flex items-center justify-center rounded-full transition-all duration-200 focus-visible:outline-2 focus-visible:outline-primary ${
                isActive
                  ? "bg-primary !text-neutral-900 font-semibold px-3.5 sm:px-4 py-2 text-xs shadow-sm"
                  : "p-2.5 text-neutral-400 hover:text-white active:scale-95"
              }`}
              style={isActive ? { color: "var(--color-neutral-900)" } : undefined}
            >
              <div
                className="relative flex items-center gap-1.5"
                style={isActive ? { color: "var(--color-neutral-900)" } : undefined}
              >
                <Icon size={18} className="shrink-0" />
                {isActive && (
                  <span
                    className="text-xs font-semibold whitespace-nowrap"
                    style={{ color: "var(--color-neutral-900)" }}
                  >
                    {dest.label}
                  </span>
                )}
                {/* Badge indicator for inactive items with counts (e.g. Wishlist) */}
                {!isActive && dest.badgeCount !== undefined && dest.badgeCount > 0 && (
                  <span
                    className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-secondary ring-2 ring-neutral-900"
                    aria-hidden="true"
                  />
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
