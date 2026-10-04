"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  UserIcon,
  PackageIcon,
  MapPinIcon,
  LogOutIcon,
  ChevronLeftIcon,
} from "@/components/customer/Icons";

interface AccountNavigationProps {
  onSignOut?: () => void;
}

interface NavItem {
  id: string;
  label: string;
  href: string;
  icon: React.ReactNode;
  matchPaths: string[];
}

const NAV_ITEMS: NavItem[] = [
  {
    id: "overview",
    label: "Overview",
    href: "/account",
    icon: <UserIcon size={18} />,
    matchPaths: ["/account"],
  },
  {
    id: "orders",
    label: "My Orders",
    href: "/account/orders",
    icon: <PackageIcon size={18} />,
    matchPaths: ["/account/orders"],
  },
  {
    id: "addresses",
    label: "Addresses",
    href: "/account",
    icon: <MapPinIcon size={18} />,
    matchPaths: [],
  },
];

export default function AccountNavigation({ onSignOut }: AccountNavigationProps) {
  const pathname = usePathname();

  const isActive = (item: NavItem) => {
    if (item.id === "overview") {
      return pathname === "/account";
    }
    return item.matchPaths.some((p) => pathname.startsWith(p));
  };

  return (
    <>
      {/* Desktop Sidebar Navigation */}
      <nav
        aria-label="Account navigation"
        className="hidden md:flex flex-col gap-1"
      >
        <Link
          href="/"
          className="flex items-center gap-2 text-xs font-medium text-neutral-500 hover:text-neutral-900 mb-4 transition-colors group"
        >
          <ChevronLeftIcon size={14} className="group-hover:-translate-x-0.5 transition-transform" />
          Back to Store
        </Link>

        {NAV_ITEMS.map((item) => {
          const active = isActive(item);
          return (
            <Link
              key={item.id}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                active
                  ? "bg-primary/10 text-neutral-900 font-semibold"
                  : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
              }`}
            >
              <span className={active ? "text-primary" : "text-neutral-400"}>
                {item.icon}
              </span>
              {item.label}
            </Link>
          );
        })}

        <div className="my-3 border-t border-neutral-200" />

        <button
          type="button"
          onClick={onSignOut}
          className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 transition-all w-full text-left"
        >
          <LogOutIcon size={18} />
          Sign Out
        </button>
      </nav>

      {/* Mobile Horizontal Tab Navigation */}
      <nav
        aria-label="Account navigation"
        className="md:hidden flex items-center gap-1 overflow-x-auto pb-2 scrollbar-hide -mx-1 px-1"
      >
        {NAV_ITEMS.map((item) => {
          const active = isActive(item);
          return (
            <Link
              key={item.id}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all shrink-0 ${
                active
                  ? "bg-neutral-900 text-white shadow-sm"
                  : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
              }`}
            >
              {item.icon}
              {item.label}
            </Link>
          );
        })}

        <button
          type="button"
          onClick={onSignOut}
          className="flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap bg-red-50 text-red-600 hover:bg-red-100 transition-all shrink-0"
        >
          <LogOutIcon size={14} />
          Sign Out
        </button>
      </nav>
    </>
  );
}
