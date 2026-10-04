import type { Metadata } from "next";
import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { AdminLoginForm } from "@/components/admin/AdminLoginForm";
import { AdminBrand } from "@/components/admin/AdminBrand";
import { ShieldCheckIcon } from "@/components/admin/AdminIcons";

export const metadata: Metadata = {
  title: "Admin Sign In — Dearr Founder Operations",
  description: "Sign in to the Dearr founder operations and 3D printing management dashboard.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function AdminLoginPage() {
  return (
    <main className="w-full min-h-screen flex flex-col items-center justify-center bg-[#F4F1E8] px-4 py-8 sm:px-6">
      {/* ====================================================================
          DESKTOP SPLIT CARD LAYOUT (>= 1024px)
          ==================================================================== */}
      <div className="w-full max-w-4xl lg:max-w-5xl bg-surface rounded-[28px] lg:rounded-[32px] shadow-modal border border-neutral-200/80 p-5 lg:p-7 hidden lg:flex items-stretch gap-10">
        {/* Left Side: Operations Brand Showcase */}
        <div className="w-1/2 rounded-[22px] lg:rounded-[26px] bg-[#18191B] p-8 text-white flex flex-col justify-between relative overflow-hidden shadow-inner select-none">
          {/* Subtle atmosphere glow */}
          <div
            className="absolute -top-24 -left-24 w-72 h-72 rounded-full bg-primary/20 blur-3xl pointer-events-none"
            aria-hidden="true"
          />
          <div
            className="absolute -bottom-24 -right-24 w-72 h-72 rounded-full bg-secondary/10 blur-3xl pointer-events-none"
            aria-hidden="true"
          />

          {/* Top Brand & Badge */}
          <div className="relative z-10 flex items-center justify-between">
            <Link href="/" aria-label="Dearr Storefront" className="inline-flex items-center">
              <Image
                src="/brand/dearr-logo.png"
                alt="Dearr Logo"
                width={120}
                height={36}
                priority
                className="h-8 w-auto object-contain brightness-0 invert drop-shadow"
                style={{ width: "auto" }}
              />
            </Link>
            <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-white/10 text-primary border border-primary/30 backdrop-blur-xs">
              Founder Admin
            </span>
          </div>

          {/* Center Message */}
          <div className="relative z-10 my-auto py-8 space-y-5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-xs font-semibold text-neutral-300">
              <ShieldCheckIcon size={14} className="text-primary" />
              <span>3D Printing Operations Control</span>
            </div>

            <h1 className="font-display text-3xl font-bold leading-snug text-white">
              Bespoke Manufacturing <br />
              <span className="text-primary">&amp; Store Management.</span>
            </h1>

            <p className="text-xs text-neutral-300 leading-relaxed max-w-sm">
              Live operational visibility across custom print queues, filament
              inventory, order fulfillment timelines, and customer metrics.
            </p>

            <ul className="space-y-2.5 text-xs text-neutral-300 pt-2">
              <li className="flex items-center gap-2.5">
                <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                <span>6-Stage 3D Print Order Tracking</span>
              </li>
              <li className="flex items-center gap-2.5">
                <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                <span>Product Catalog &amp; Specification Management</span>
              </li>
              <li className="flex items-center gap-2.5">
                <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                <span>Founder-Level Security &amp; Data Ownership</span>
              </li>
            </ul>
          </div>

          {/* Bottom Hostinger Stack Note */}
          <div className="relative z-10 pt-4 border-t border-white/10 flex items-center justify-between text-[11px] text-neutral-400">
            <span>Dearr V1 Operational Portal</span>
            <span className="font-mono text-[10px] text-neutral-500">Hostinger • MySQL</span>
          </div>
        </div>

        {/* Right Side: Admin Login Form */}
        <div className="w-1/2 flex flex-col justify-center py-4 px-2 lg:px-6">
          <div className="flex items-center justify-between mb-6">
            <AdminBrand variant="login" showLink={false} />
            <Link
              href="/"
              className="text-xs font-semibold text-neutral-500 hover:text-neutral-900 transition-colors"
            >
              ← Back to Storefront
            </Link>
          </div>

          <div className="mb-6 text-left">
            <h2 className="font-display text-2xl font-bold text-neutral-900 mb-1">
              Welcome back
            </h2>
            <p className="text-xs sm:text-sm text-neutral-500">
              Sign in to manage your Dearr store.
            </p>
          </div>

          <Suspense
            fallback={
              <div className="h-48 flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            }
          >
            <AdminLoginForm />
          </Suspense>
        </div>
      </div>

      {/* ====================================================================
          MOBILE & TABLET CARD LAYOUT (< 1024px)
          ==================================================================== */}
      <div className="w-full max-w-md lg:hidden flex flex-col gap-4">
        {/* Top Mobile Brand Bar */}
        <div className="flex items-center justify-between px-2">
          <AdminBrand variant="login" showLink={false} />
          <Link
            href="/"
            className="text-xs font-semibold text-neutral-600 hover:text-neutral-900"
          >
            ← Storefront
          </Link>
        </div>

        {/* Form Container Card */}
        <div className="bg-surface rounded-2xl shadow-modal border border-neutral-200/80 p-6 sm:p-7">
          <div className="mb-6 text-left">
            <div className="inline-block px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-primary/20 text-neutral-900 border border-primary/30 mb-2">
              Founder Admin
            </div>
            <h1 className="font-display text-2xl font-bold text-neutral-900 mb-1">
              Welcome back
            </h1>
            <p className="text-xs text-neutral-500">
              Sign in to manage your Dearr store.
            </p>
          </div>

          <Suspense
            fallback={
              <div className="h-48 flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            }
          >
            <AdminLoginForm />
          </Suspense>
        </div>

        {/* Mobile Footer Note */}
        <div className="text-center text-[11px] text-neutral-500">
          Dearr 3D Printing Operations &bull; Founder Access
        </div>
      </div>
    </main>
  );
}
