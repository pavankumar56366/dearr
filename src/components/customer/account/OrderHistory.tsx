"use client";

import React from "react";
import Link from "next/link";
import type { DemoOrder } from "@/lib/order-model";
import OrderHistoryCard from "./OrderHistoryCard";
import AccountEmptyOrders from "./AccountEmptyOrders";

interface OrderHistoryProps {
  orders: DemoOrder[];
  /** Show compact version (limit items) for the account overview */
  compact?: boolean;
}

export default function OrderHistory({ orders, compact = false }: OrderHistoryProps) {
  if (orders.length === 0) {
    return <AccountEmptyOrders />;
  }

  const displayOrders = compact ? orders.slice(0, 3) : orders;

  return (
    <section aria-labelledby="orders-heading">
      <div className="flex items-center justify-between mb-4">
        <h2
          id="orders-heading"
          className="text-base sm:text-lg font-bold text-neutral-900 tracking-tight"
        >
          {compact ? "Recent Orders" : "Order History"}
        </h2>
        {compact && orders.length > 3 && (
          <Link
            href="/account/orders"
            className="text-xs font-semibold text-primary hover:text-[#91BC7A] transition-colors"
          >
            View All ({orders.length})
          </Link>
        )}
      </div>

      <div className="flex flex-col gap-3">
        {displayOrders.map((order) => (
          <OrderHistoryCard key={order.id} order={order} />
        ))}
      </div>
    </section>
  );
}
