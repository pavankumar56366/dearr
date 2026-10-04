"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ChevronRightIcon,
  PackageIcon,
  ClockIcon,
} from "@/components/customer/Icons";
import type { DemoOrder } from "@/lib/order-model";
import { getOrderStatusLabel, getOrderStatusColor } from "@/data/demo-orders";

interface OrderHistoryCardProps {
  order: DemoOrder;
}

export default function OrderHistoryCard({ order }: OrderHistoryCardProps) {
  const statusColor = getOrderStatusColor(order.status);
  const statusLabel = getOrderStatusLabel(order.status);
  const orderDate = new Date(order.createdAt).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <Link
      href={`/account/orders/${order.orderNumber}`}
      className="group block rounded-2xl border border-neutral-200 bg-surface shadow-card hover:shadow-modal hover:border-neutral-300 transition-all duration-200 overflow-hidden"
    >
      {/* Header Row */}
      <div className="flex items-center justify-between gap-4 px-4 sm:px-5 pt-4 sm:pt-5 pb-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-neutral-100 flex items-center justify-center shrink-0">
            <PackageIcon size={16} className="text-neutral-600" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-neutral-900 tracking-tight">
              {order.orderNumber}
            </p>
            <div className="flex items-center gap-1.5 text-[11px] text-neutral-500 mt-0.5">
              <ClockIcon size={11} className="shrink-0" />
              <span>{orderDate}</span>
              <span className="text-neutral-300">•</span>
              <span>
                {itemCount} {itemCount === 1 ? "item" : "items"}
              </span>
            </div>
          </div>
        </div>

        {/* Status Badge */}
        <div
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border shrink-0 ${statusColor.bg} ${statusColor.text} ${statusColor.border}`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${statusColor.dot}`}
            aria-hidden="true"
          />
          {statusLabel}
        </div>
      </div>

      {/* Product Image Strip */}
      <div className="flex items-center gap-2 px-4 sm:px-5 py-3 border-t border-neutral-100/80">
        <div className="flex -space-x-2">
          {order.items.slice(0, 4).map((item) => (
            <div
              key={item.id}
              className="w-10 h-10 sm:w-11 sm:h-11 rounded-lg border-2 border-surface bg-neutral-50 overflow-hidden shrink-0 relative"
            >
              <Image
                src={item.image}
                alt={item.productName}
                fill
                sizes="44px"
                className="object-cover"
              />
            </div>
          ))}
          {order.items.length > 4 && (
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-lg border-2 border-surface bg-neutral-100 flex items-center justify-center text-xs font-bold text-neutral-500 shrink-0">
              +{order.items.length - 4}
            </div>
          )}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <span className="text-sm sm:text-base font-bold text-neutral-900">
            ₹{order.totalAmount.toLocaleString("en-IN")}
          </span>
          <ChevronRightIcon
            size={16}
            className="text-neutral-400 group-hover:text-neutral-900 group-hover:translate-x-0.5 transition-all"
          />
        </div>
      </div>
    </Link>
  );
}
