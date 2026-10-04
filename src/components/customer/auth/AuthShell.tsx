"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";

interface AuthShellProps {
  title: string;
  subtitle: string;
  heroBadge?: string;
  heroHeading?: React.ReactNode;
  heroText?: string;
  topAction?: {
    text: string;
    linkText: string;
    href: string;
  };
  children: React.ReactNode;
}

export function AuthShell({
  title,
  subtitle,
  heroBadge = "Precision 3D Printing • Made for You",
  heroHeading = (
    <>
      Print Your Vision. <br />
      <span className="text-secondary">We Deliver.</span>
    </>
  ),
  heroText = "Discover bespoke 3D-printed desk planters, personalized lithophanes, and precision articulated models crafted with care.",
  topAction = {
    text: "Already registered?",
    linkText: "Log In",
    href: "/login",
  },
  children,
}: AuthShellProps) {
  return (
    <div className="w-full flex-1 flex flex-col justify-center bg-[#F4F1E8]">
      {/* ====================================================================
          DESKTOP AUTH LAYOUT (>= 768px / md:)
          Matching docs/design-references/login-desktop.jpg
          ==================================================================== */}
      <div className="hidden md:flex items-center justify-center min-h-screen py-8 px-4 sm:px-6 lg:px-8">
        <div className="w-full max-w-4xl lg:max-w-5xl bg-surface rounded-[28px] lg:rounded-[32px] shadow-modal border border-neutral-200/80 p-5 lg:p-7 flex items-stretch gap-8 lg:gap-12">
          {/* Left Hero / Showcase Panel */}
          <div className="w-1/2 rounded-[22px] lg:rounded-[26px] bg-gradient-to-br from-[#1C1D21] via-[#2A2B32] to-[#141518] p-6 lg:p-8 text-white flex flex-col justify-between relative overflow-hidden shadow-inner">
            {/* Atmospheric gradient light */}
            <div
              className="absolute -top-24 -left-24 w-72 h-72 rounded-full bg-primary/20 blur-3xl pointer-events-none"
              aria-hidden="true"
            />
            <div
              className="absolute -bottom-24 -right-24 w-72 h-72 rounded-full bg-secondary/15 blur-3xl pointer-events-none"
              aria-hidden="true"
            />

            {/* Top Bar inside Left Visual */}
            <div className="flex items-center justify-between relative z-10">
              <span className="text-xs font-semibold tracking-wider uppercase text-neutral-300">
                Dearr 3D Workshop
              </span>
              <div className="flex items-center gap-3">
                <span className="text-xs font-medium text-neutral-400">
                  {topAction.text}
                </span>
                <Link
                  href={topAction.href}
                  className="px-4 py-1.5 rounded-full border border-white/30 hover:border-white text-xs font-semibold text-white hover:bg-white/10 transition-all active:scale-95"
                >
                  {topAction.linkText}
                </Link>
              </div>
            </div>

            {/* Center Showcase Content */}
            <div className="my-auto py-8 relative z-10 space-y-4">
              <div className="inline-block px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-[11px] font-semibold text-primary tracking-wide">
                {heroBadge}
              </div>
              <h2 className="font-display text-3xl lg:text-4xl font-bold leading-tight text-white">
                {heroHeading}
              </h2>
              <p className="text-sm text-neutral-300 leading-relaxed max-w-sm">
                {heroText}
              </p>
            </div>

            {/* Bottom Profile / Workshop Badge */}
            <div className="flex items-center justify-between relative z-10 pt-4 border-t border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/30 border border-primary/50 flex items-center justify-center text-primary font-bold text-sm">
                  D
                </div>
                <div>
                  <div className="text-xs font-bold text-white">Dearr Store</div>
                  <div className="text-[11px] text-neutral-400">
                    Bespoke 3D Printing &amp; Fabrication
                  </div>
                </div>
              </div>

              {/* Decorative Nav Arrows */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  aria-label="Previous showcase"
                  className="w-8 h-8 rounded-full border border-white/20 hover:border-white/60 flex items-center justify-center text-white/70 hover:text-white transition-colors"
                >
                  <span className="text-xs">←</span>
                </button>
                <button
                  type="button"
                  aria-label="Next showcase"
                  className="w-8 h-8 rounded-full border border-white/20 hover:border-white/60 flex items-center justify-center text-white/70 hover:text-white transition-colors"
                >
                  <span className="text-xs">→</span>
                </button>
              </div>
            </div>
          </div>

          {/* Right Form Panel */}
          <div className="w-1/2 flex flex-col justify-center py-4 px-2 lg:px-6">
            <div className="flex items-center justify-between mb-6">
              <Link href="/" aria-label="Dearr Home">
                <Image
                  src="/brand/dearr-logo.png"
                  alt="Dearr - Love Collects. We Deliver."
                  width={130}
                  height={38}
                  priority
                  className="h-8 w-auto object-contain"
                  style={{ width: "auto" }}
                />
              </Link>
              <div className="text-[11px] font-semibold text-neutral-500 border border-neutral-200 rounded-full px-2.5 py-1">
                🇮🇳 IN &bull; EN
              </div>
            </div>

            <div className="mb-6">
              <h1 className="font-display text-2xl lg:text-3xl font-bold text-neutral-900 mb-1">
                {title}
              </h1>
              <p className="text-sm text-neutral-500">
                {subtitle}
              </p>
            </div>

            {children}
          </div>
        </div>
      </div>

      {/* ====================================================================
          MOBILE AUTH LAYOUT (< 768px / < md:)
          Matching docs/design-references/login-mobile.png
          ==================================================================== */}
      <div className="md:hidden flex flex-col w-full min-h-screen bg-[#F4F1E8]">
        {/* Top Hero with Curved Edge */}
        <div className="relative bg-gradient-to-br from-[#1C1D21] via-[#2A2B32] to-[#141518] text-white pt-8 pb-14 px-6 rounded-b-[36px] shadow-sm overflow-hidden">
          {/* Subtle glow */}
          <div
            className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-primary/20 blur-2xl pointer-events-none"
            aria-hidden="true"
          />

          <div className="flex items-center justify-between mb-6 relative z-10">
            <Link href="/" aria-label="Dearr Home">
              <Image
                src="/brand/dearr-logo.png"
                alt="Dearr Logo"
                width={100}
                height={30}
                priority
                className="h-6 w-auto object-contain brightness-110"
                style={{ width: "auto" }}
              />
            </Link>
            <div className="text-[10px] font-semibold text-neutral-300 border border-white/20 rounded-full px-2.5 py-1">
              🇮🇳 IN &bull; EN
            </div>
          </div>

          <div className="relative z-10 space-y-1">
            <h1 className="font-display text-2xl font-bold text-white">
              {title}
            </h1>
            <p className="text-xs text-neutral-300">
              {subtitle}
            </p>
          </div>
        </div>

        {/* Overlapping White Form Sheet */}
        <div className="px-4 -mt-6 relative z-20 pb-8 sm:pb-12 max-w-lg mx-auto w-full">
          <div className="bg-surface rounded-[24px] p-5 sm:p-6 shadow-modal border border-neutral-200/80">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
