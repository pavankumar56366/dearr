import React from "react";
import Image from "next/image";
import Link from "next/link";

interface AdminBrandProps {
  variant?: "sidebar" | "header" | "login";
  className?: string;
  showLink?: boolean;
}

/**
 * AdminBrand — Standardized Dearr Founder/Admin branding identity.
 *
 * Displays official Dearr logo asset (public/brand/dearr-logo.png)
 * paired with a clear, subtle "Founder Admin" role badge.
 */
export function AdminBrand({
  variant = "sidebar",
  className = "",
  showLink = true,
}: AdminBrandProps) {
  const isLogin = variant === "login";
  const isHeader = variant === "header";

  const brandContent = (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* Official Dearr Brand Logo */}
      <div className="relative shrink-0">
        <Image
          src="/brand/dearr-logo.png"
          alt="Dearr Admin"
          width={isLogin ? 130 : isHeader ? 95 : 110}
          height={isLogin ? 38 : isHeader ? 28 : 32}
          priority
          className="h-7 sm:h-8 w-auto object-contain"
          style={{ width: "auto" }}
        />
      </div>

      {/* Role / Context Badge */}
      <div className="flex flex-col">
        <span
          className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase border"
          style={{
            background: "rgba(162, 203, 139, 0.18)",
            color: "var(--color-neutral-900)",
            borderColor: "rgba(162, 203, 139, 0.4)",
          }}
        >
          Founder Admin
        </span>
        {isLogin && (
          <span className="text-[11px] text-neutral-500 font-medium mt-0.5 hidden sm:inline">
            3D Printing Operations
          </span>
        )}
      </div>
    </div>
  );

  if (showLink) {
    return (
      <Link
        href="/admin"
        className="inline-flex items-center focus-visible:outline-2 focus-visible:outline-primary rounded-lg transition-transform active:scale-98"
        aria-label="Dearr Founder Admin Dashboard"
      >
        {brandContent}
      </Link>
    );
  }

  return brandContent;
}
