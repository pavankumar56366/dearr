import React from "react";
import Link from "next/link";
import { ArrowLeftIcon, AlertCircleIcon } from "../AdminIcons";

interface AdminOrderNotFoundProps {
  orderIdOrNumber: string;
}

export function AdminOrderNotFound({ orderIdOrNumber }: AdminOrderNotFoundProps) {
  return (
    <div className="max-w-2xl mx-auto py-16 px-4 text-center space-y-5">
      <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 flex items-center justify-center mx-auto">
        <AlertCircleIcon size={28} />
      </div>

      <div className="space-y-2">
        <h1 className="font-display text-2xl font-bold text-neutral-900">
          Order Not Found
        </h1>
        <p className="text-xs sm:text-sm text-neutral-500 max-w-md mx-auto">
          We couldn&apos;t find an order matching{" "}
          <span className="font-mono font-bold text-neutral-800 bg-neutral-100 px-2 py-0.5 rounded border border-neutral-200">
            {orderIdOrNumber}
          </span>
          . It may have been modified or is not present in local store operations.
        </p>
      </div>

      <div className="pt-2">
        <Link
          href="/admin/orders"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary hover:bg-[#91BC7A] text-neutral-900 font-bold text-xs shadow-xs transition-all cursor-pointer"
        >
          <ArrowLeftIcon size={14} />
          <span>Back to All Orders</span>
        </Link>
      </div>
    </div>
  );
}
