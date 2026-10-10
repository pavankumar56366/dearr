"use client";

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { DesktopHeader } from "./DesktopHeader";
import { MobileBottomNav } from "./MobileBottomNav";
import { SearchOverlay } from "./SearchOverlay";
import { SearchIcon, CartIcon, HeartIcon } from "./Icons";
import {
  NavbarData,
  DEFAULT_NAVBAR_DATA,
  DEFAULT_CATEGORIES,
  CategoryItem,
} from "./types";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import { useWishlist } from "@/context/WishlistContext";

export interface CustomerHeaderProps {
  initialData?: Partial<NavbarData>;
  categories?: CategoryItem[];
}

export function CustomerHeader({
  initialData,
  categories = DEFAULT_CATEGORIES,
}: CustomerHeaderProps) {
  const { totalCount, subtotal } = useCart();
  const { user, isLoggedIn } = useAuth();
  const { wishlistCount } = useWishlist();

  const data: NavbarData = {
    ...DEFAULT_NAVBAR_DATA,
    ...initialData,
    wishlistCount: initialData?.wishlistCount !== undefined ? initialData.wishlistCount : wishlistCount,
    cartCount: totalCount,
    cartTotal: `₹${subtotal.toLocaleString("en-IN")}`,
    isLoggedIn: initialData?.isLoggedIn !== undefined ? initialData.isLoggedIn : isLoggedIn,
    userName:
      initialData?.userName ||
      (user?.fullName ? user.fullName.trim().split(" ")[0] : undefined),
  };

  const [isSearchOpen, setIsSearchOpen] = useState(false);

  return (
    <>
      {/* ====================================================================
          Desktop Customer Header (>= 768px / md:)
          ==================================================================== */}
      <DesktopHeader
        data={data}
        categories={categories}
        onOpenSearch={() => setIsSearchOpen(true)}
      />

      {/* ====================================================================
          Mobile Customer Top Header (< 768px / < md:)
          ==================================================================== */}
      <header className="md:hidden sticky top-0 z-40 w-full bg-surface/95 backdrop-blur-md border-b border-neutral-300 shadow-xs">
        <div className="h-16 px-4 flex items-center justify-between gap-3">
          {/* Brand Logo */}
          <Link
            href="/"
            className="flex items-center shrink-0 focus-visible:outline-2 focus-visible:outline-primary rounded-lg transition-transform active:scale-98"
            aria-label="Dearr Home"
          >
            <Image
              src="/brand/dearr-logo.png"
              alt="Dearr - Love Collects. We Deliver."
              width={120}
              height={36}
              priority
              className="h-7 w-auto object-contain"
              style={{ width: "auto" }}
            />
          </Link>

          {/* Right Mobile Actions: Search, Wishlist, Cart */}
          <div className="flex items-center gap-1 sm:gap-2">
            {/* Search Trigger (Opens full Mobile Search UI) */}
            <button
              type="button"
              onClick={() => setIsSearchOpen(true)}
              aria-expanded={isSearchOpen}
              aria-label="Open search"
              className="p-2 text-neutral-700 hover:text-neutral-900 active:scale-95 rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-primary"
            >
              <SearchIcon size={20} />
            </button>

            {/* Wishlist Link with Count Badge */}
            <Link
              href="/wishlist"
              className="relative p-2 text-neutral-700 hover:text-neutral-900 active:scale-95 rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-primary"
              aria-label={`Wishlist (${data.wishlistCount} items)`}
            >
              <HeartIcon size={20} />
              {data.wishlistCount > 0 && (
                <span
                  className="absolute top-0.5 right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-secondary text-neutral-900 font-bold text-[10px] flex items-center justify-center ring-2 ring-surface shadow-xs"
                  aria-hidden="true"
                >
                  {data.wishlistCount}
                </span>
              )}
            </Link>

            {/* Cart Link with Count Badge */}
            <Link
              href="/cart"
              className="relative p-2 text-neutral-700 hover:text-neutral-900 active:scale-95 rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-primary"
              aria-label={`Shopping Cart (${data.cartCount} items)`}
            >
              <CartIcon size={20} />
              {data.cartCount > 0 && (
                <span
                  className="absolute top-0.5 right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-neutral-900 font-bold text-[10px] flex items-center justify-center ring-2 ring-surface shadow-xs"
                  aria-hidden="true"
                >
                  {data.cartCount}
                </span>
              )}
            </Link>
          </div>
        </div>
      </header>

      {/* ====================================================================
          Mobile Floating Bottom Navigation Dock (< 768px / < md:)
          ==================================================================== */}
      <MobileBottomNav
        data={data}
        onSearchClick={() => setIsSearchOpen(true)}
      />

      {/* ====================================================================
          Unified Search Overlay (Desktop Modal & Mobile Fullscreen Sheet)
          ==================================================================== */}
      <SearchOverlay
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
      />
    </>
  );
}

// Re-export subcomponents and types for clean imports
export { DesktopHeader } from "./DesktopHeader";
export { MobileBottomNav } from "./MobileBottomNav";
export { SearchOverlay } from "./SearchOverlay";
export * from "./types";
export * from "./search/search-mock-data";
export * from "./search/SearchInput";
export * from "./search/SearchSuggestions";
export * from "./search/TrendingSearchProducts";
