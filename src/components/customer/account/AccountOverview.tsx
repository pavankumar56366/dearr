"use client";

import React from "react";
import Link from "next/link";
import {
  PackageIcon,
  TruckIcon,
  CheckIcon,
  PrinterIcon,
} from "@/components/customer/Icons";
import type { DemoOrder } from "@/lib/order-model";

interface AccountOverviewProps {
  orders: DemoOrder[];
  customerName: string;
}

export default function AccountOverview({ orders, customerName }: AccountOverviewProps) {
  const stats = {
    total: orders.length,
    processing: orders.filter((o) => o.status === "processing" || o.status === "confirmed").length,
    shipped: orders.filter((o) => o.status === "shipped").length,
    delivered: orders.filter((o) => o.status === "delivered").length,
  };

  const firstName = customerName.split(" ")[0];

  return (
    <section aria-labelledby="overview-heading" className="space-y-5">
      {/* Welcome Banner */}
      <div className="rounded-2xl bg-gradient-to-br from-[#1C1D21] via-[#2A2B32] to-[#141518] p-5 sm:p-7 text-white relative overflow-hidden">
        {/* Atmospheric glow */}
        <div
          className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-primary/20 blur-3xl pointer-events-none"
          aria-hidden="true"
        />
        <div
          className="absolute -bottom-16 -left-16 w-48 h-48 rounded-full bg-secondary/15 blur-3xl pointer-events-none"
          aria-hidden="true"
        />

        <div className="relative z-10">
          <p className="text-xs font-semibold uppercase tracking-wider text-neutral-300 mb-1">
            Welcome back
          </p>
          <h1
            id="overview-heading"
            className="text-xl sm:text-2xl font-bold text-white font-display"
          >
            {firstName}&apos;s Workshop 🖨️
          </h1>
          <p className="text-xs text-neutral-400 mt-1">
            Your Dearr 3D printing account dashboard
          </p>
        </div>
      </div>

      {/* Order Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          icon={<PackageIcon size={18} />}
          label="Total Orders"
          value={stats.total}
          href="/account/orders"
          color="bg-neutral-100 text-neutral-600"
        />
        <StatCard
          icon={<PrinterIcon size={18} />}
          label="In Production"
          value={stats.processing}
          href="/account/orders"
          color="bg-amber-50 text-amber-700"
        />
        <StatCard
          icon={<TruckIcon size={18} />}
          label="In Transit"
          value={stats.shipped}
          href="/account/orders"
          color="bg-blue-50 text-blue-700"
        />
        <StatCard
          icon={<CheckIcon size={18} className="stroke-[3]" />}
          label="Delivered"
          value={stats.delivered}
          href="/account/orders"
          color="bg-emerald-50 text-emerald-700"
        />
      </div>
    </section>
  );
}

function StatCard({
  icon,
  label,
  value,
  href,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  href: string;
  color: string;
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col items-center sm:items-start gap-2 p-4 rounded-2xl border border-neutral-200 bg-surface hover:shadow-card transition-all"
    >
      <div
        className={`w-9 h-9 rounded-lg flex items-center justify-center ${color}`}
      >
        {icon}
      </div>
      <div className="text-center sm:text-left">
        <p className="text-xl sm:text-2xl font-bold text-neutral-900">{value}</p>
        <p className="text-[11px] font-medium text-neutral-500 uppercase tracking-wide">
          {label}
        </p>
      </div>
    </Link>
  );
}
