"use client";

import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  SearchIcon,
  CartIcon,
  HeartIcon,
  UserIcon,
  MenuIcon,
  ChevronDownIcon,
} from "./Icons";
import {
  NavbarData,
  DEFAULT_NAVBAR_DATA,
  DEFAULT_CATEGORIES,
  CategoryItem,
} from "./types";

interface DesktopHeaderProps {
  data?: NavbarData;
  categories?: CategoryItem[];
  onOpenSearch?: () => void;
}

export function DesktopHeader({
  data = DEFAULT_NAVBAR_DATA,
  categories = DEFAULT_CATEGORIES,
  onOpenSearch,
}: DesktopHeaderProps) {
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsCategoryOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsCategoryOpen(false);
      }
    }

    if (isCategoryOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isCategoryOpen]);

  const handleSearchClick = (e?: React.SyntheticEvent) => {
    if (onOpenSearch) {
      e?.preventDefault();
      onOpenSearch();
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onOpenSearch) {
      onOpenSearch();
    } else if (searchQuery.trim()) {
      window.location.href = `/shop?q=${encodeURIComponent(searchQuery.trim())}`;
    }
  };

  return (
    <header className="hidden md:block sticky top-0 z-40 w-full bg-surface/95 backdrop-blur-md border-b border-neutral-300 shadow-xs transition-shadow">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-16 lg:h-[68px] flex items-center justify-between gap-4 lg:gap-8">
        {/* Left Section: Logo & Category Navigation */}
        <div className="flex items-center gap-4 lg:gap-6 shrink-0">
          <Link
            href="/"
            className="flex items-center shrink-0 focus-visible:outline-2 focus-visible:outline-primary rounded-lg transition-transform active:scale-98"
            aria-label="Dearr Home"
          >
            <Image
              src="/brand/dearr-logo.png"
              alt="Dearr - Love Collects. We Deliver."
              width={140}
              height={40}
              priority
              className="h-8 lg:h-9 w-auto object-contain"
              style={{ width: "auto" }}
            />
          </Link>

          {/* Shop by Category Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setIsCategoryOpen((prev) => !prev)}
              aria-expanded={isCategoryOpen}
              aria-haspopup="true"
              aria-label="Shop by category"
              className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-neutral-100 text-neutral-900 font-semibold text-xs tracking-wider uppercase transition-colors focus-visible:outline-2 focus-visible:outline-primary"
            >
              <MenuIcon size={18} className="text-neutral-900" />
              <span>Shop by Category</span>
              <ChevronDownIcon
                size={14}
                className={`text-neutral-500 transition-transform duration-200 ${
                  isCategoryOpen ? "rotate-180 text-neutral-900" : ""
                }`}
              />
            </button>

            {isCategoryOpen && (
              <div
                role="menu"
                aria-label="Product Categories"
                className="absolute left-0 top-full mt-2 w-64 bg-surface rounded-xl shadow-modal border border-neutral-300 p-2 z-50 animate-in fade-in duration-150"
              >
                <div className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-neutral-500 border-b border-neutral-100 mb-1">
                  Browse Collections
                </div>
                {categories.map((cat) => (
                  <Link
                    key={cat.id}
                    href={cat.slug === "all" ? "/shop" : `/shop?category=${cat.slug}`}
                    onClick={() => setIsCategoryOpen(false)}
                    role="menuitem"
                    className="flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium text-neutral-700 hover:text-neutral-900 hover:bg-neutral-100 transition-colors"
                  >
                    <span>{cat.name}</span>
                    <span className="text-xs text-neutral-300">›</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Center Section: Search Access Area */}
        <form
          role="search"
          onSubmit={handleSearchSubmit}
          className="flex-1 max-w-xl mx-2 lg:mx-6"
        >
          <div
            onClick={handleSearchClick}
            className="relative flex items-center w-full h-11 rounded-full bg-neutral-100 border border-neutral-300 pl-4 pr-1.5 focus-within:border-primary focus-within:bg-surface focus-within:ring-2 focus-within:ring-primary/20 transition-all cursor-pointer"
          >
            <SearchIcon size={18} className="text-neutral-500 shrink-0 mr-2.5" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onClick={handleSearchClick}
              onFocus={handleSearchClick}
              placeholder="Search 3D printed products, keychains, decor..."
              aria-label="Search for products"
              className="w-full bg-transparent text-neutral-900 text-sm placeholder:text-neutral-500 focus:outline-none cursor-pointer"
            />
            <button
              type="submit"
              aria-label="Submit Search"
              className="shrink-0 h-8 px-4 rounded-full bg-primary hover:bg-[#91BC7A] text-neutral-900 text-xs font-bold tracking-wider uppercase transition-all active:scale-95 focus-visible:outline-2 focus-visible:outline-neutral-900"
            >
              SEARCH
            </button>
          </div>
        </form>

        {/* Right Section: User, Wishlist, Cart Access */}
        <div className="flex items-center gap-4 lg:gap-6 shrink-0">
          {/* User / Account Access */}
          <Link
            href={data.isLoggedIn ? "/account" : "/login"}
            className="flex items-center gap-2 text-neutral-700 hover:text-neutral-900 group transition-colors focus-visible:outline-2 focus-visible:outline-primary rounded-lg py-1 px-1.5"
            aria-label={
              data.isLoggedIn
                ? `Account: ${data.userName || "User"}`
                : "Login or Register"
            }
          >
            <UserIcon
              size={20}
              className="text-neutral-700 group-hover:text-primary transition-colors"
            />
            <span className="text-sm font-medium text-neutral-900 group-hover:text-neutral-900">
              {data.isLoggedIn ? data.userName || "Account" : "Login / Register"}
            </span>
          </Link>

          {/* Wishlist Access */}
          <Link
            href="/wishlist"
            className="relative p-2 text-neutral-900 hover:text-neutral-900 transition-colors focus-visible:outline-2 focus-visible:outline-primary rounded-full group"
            aria-label={`Wishlist (${data.wishlistCount} items)`}
          >
            <HeartIcon
              size={22}
              className="group-hover:scale-105 transition-transform"
            />
            {data.wishlistCount > 0 && (
              <span
                className="absolute -top-0.5 -right-0.5 min-w-[20px] h-5 px-1.5 rounded-full bg-secondary text-neutral-900 font-bold text-[11px] flex items-center justify-center shadow-xs ring-2 ring-surface"
                aria-hidden="true"
              >
                {data.wishlistCount}
              </span>
            )}
          </Link>

          {/* Cart Access */}
          <Link
            href="/cart"
            className="flex items-center gap-2 text-neutral-900 hover:text-neutral-900 transition-colors focus-visible:outline-2 focus-visible:outline-primary rounded-lg py-1 px-1.5 group"
            aria-label={`Shopping Cart (${data.cartCount} items, total ${data.cartTotal})`}
          >
            <div className="relative p-1">
              <CartIcon
                size={22}
                className="group-hover:scale-105 transition-transform"
              />
              {data.cartCount > 0 && (
                <span
                  className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1.5 rounded-full bg-primary text-neutral-900 font-bold text-[11px] flex items-center justify-center shadow-xs ring-2 ring-surface"
                  aria-hidden="true"
                >
                  {data.cartCount}
                </span>
              )}
            </div>
            <span className="text-sm font-bold text-neutral-900 whitespace-nowrap">
              {data.cartTotal}
            </span>
          </Link>
        </div>
      </div>
    </header>
  );
}
