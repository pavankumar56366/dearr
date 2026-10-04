import React from "react";
import Link from "next/link";
import { TagIcon, ArrowLeftIcon, LayoutDashboardIcon } from "../AdminIcons";

interface AdminDiscountNotFoundProps {
  code?: string;
}

/**
 * AdminDiscountNotFound — Dedicated operational empty/not-found screen
 * for invalid discount edit requests in the Dearr founder portal.
 */
export function AdminDiscountNotFound({ code }: AdminDiscountNotFoundProps) {
  return (
    <div className="max-w-2xl mx-auto py-12 px-4 text-center space-y-6">
      {/* Visual icon badge */}
      <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 mx-auto flex items-center justify-center shadow-xs">
        <TagIcon size={32} />
      </div>

      {/* Copy */}
      <div className="space-y-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-amber-900 bg-amber-100/80 px-2.5 py-0.5 rounded-full border border-amber-200">
          Discount Lookup Error
        </span>
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-neutral-900">
          Discount not found
        </h1>
        <p className="text-sm text-neutral-600 max-w-md mx-auto leading-relaxed">
          The promotional discount you&apos;re trying to edit does not exist or has been removed
          from the current admin preview storage.
        </p>
        {code && (
          <p className="text-xs font-mono text-neutral-500 bg-neutral-100 rounded-lg py-1 px-2.5 inline-block font-bold">
            Coupon Code: {code.toUpperCase()}
          </p>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
        <Link
          href="/admin/discounts"
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm bg-primary hover:bg-[#91BC7A] text-neutral-900 transition-all shadow-xs cursor-pointer"
        >
          <ArrowLeftIcon size={16} />
          <span>Back to Discounts</span>
        </Link>

        <Link
          href="/admin"
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-xs sm:text-sm border border-neutral-300 hover:bg-neutral-100 text-neutral-700 transition-all cursor-pointer"
        >
          <LayoutDashboardIcon size={16} />
          <span>Go to Admin Dashboard</span>
        </Link>
      </div>
    </div>
  );
}
