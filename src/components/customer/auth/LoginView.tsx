"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { LoginForm } from "./LoginForm";

/**
 * LoginView — Dedicated Authentication Screen for Dearr V1.
 */
export function LoginView() {
  const router = useRouter();
  const { isLoggedIn, isLoading } = useAuth();

  const oauthError = React.useMemo(() => {
    if (typeof window === "undefined") return null;
    return new URLSearchParams(window.location.search).get("error");
  }, []);

  React.useEffect(() => {
    if (!isLoading && isLoggedIn) {
      const redirectParam =
        typeof window !== "undefined"
          ? new URLSearchParams(window.location.search).get("redirect")
          : null;
      const destination =
        redirectParam && redirectParam.startsWith("/") && !redirectParam.startsWith("//")
          ? redirectParam
          : "/account";
      router.replace(destination);
    }
  }, [isLoading, isLoggedIn, router]);

  return (
    <div className="w-full flex-1 flex flex-col justify-center bg-[#F4F1E8]">
      {/* ====================================================================
          DESKTOP LOGIN LAYOUT (>= 768px / md:)
          Focused split card on #F4F1E8 background
          ==================================================================== */}
      <div className="hidden md:flex items-center justify-center min-h-screen py-8 px-4 sm:px-6 lg:px-8">
        <div className="w-full max-w-4xl lg:max-w-5xl bg-surface rounded-[28px] lg:rounded-[32px] shadow-modal border border-neutral-200/80 p-5 lg:p-7 flex items-stretch gap-8 lg:gap-12">
          {/* Left Panel: ONLY Dearr branding/logo + supplied Krishna 3D print photo */}
          <div className="w-1/2 min-h-[580px] lg:min-h-[620px] rounded-[22px] lg:rounded-[26px] bg-[#1a1b1e] relative overflow-hidden flex flex-col justify-between p-6 lg:p-8 shadow-inner select-none">
            {/* Supplied Krishna/Radha Krishna Product Image */}
            <Image
              src="/product-samples/1.jpeg"
              alt="Dearr 3D Printed Radha Krishna Idol"
              fill
              priority
              className="object-cover object-[center_15%]"
              sizes="(max-width: 1024px) 45vw, 500px"
            />

            {/* Subtle top vignette for crystal clear logo visibility */}
            <div
              className="absolute inset-0 bg-gradient-to-b from-black/55 via-transparent to-black/35 pointer-events-none"
              aria-hidden="true"
            />

            {/* Dearr Branding / Logo at Top - ONLY */}
            <div className="relative z-10 flex items-center justify-between">
              <Link
                href="/"
                className="inline-flex items-center focus-visible:outline-2 focus-visible:outline-primary rounded-lg transition-transform active:scale-98"
                aria-label="Dearr Home"
              >
                <Image
                  src="/brand/dearr-logo.png"
                  alt="Dearr - Love Collects. We Deliver."
                  width={120}
                  height={36}
                  priority
                  className="h-8 w-auto object-contain brightness-0 invert drop-shadow-md"
                  style={{ width: "auto" }}
                />
              </Link>
            </div>

            {/* Clean bottom anchor: No marketing text, slogans, or carousel arrows */}
            <div className="relative z-10" />
          </div>

          {/* Right Form Panel: Intact Login Form & Brand Header */}
          <div className="w-1/2 flex flex-col justify-center py-4 px-2 lg:px-6">
            <div className="flex items-center justify-between mb-6">
              <Link
                href="/"
                aria-label="Dearr Home"
                className="focus-visible:outline-2 focus-visible:outline-primary rounded-lg"
              >
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
                Welcome Back
              </h1>
              <p className="text-sm text-neutral-500">
                Sign in to access your orders, wishlist, and cart
              </p>
            </div>

            <LoginForm oauthError={oauthError} />
          </div>
        </div>
      </div>

      {/* ====================================================================
          MOBILE LOGIN LAYOUT (< 768px / < md:)
          Focused auth screen: Krishna hero + curved edge + overlapping form sheet
          Zero navbar chrome, zero bottom dead space.
          ==================================================================== */}
      <div className="md:hidden flex flex-col w-full min-h-screen bg-[#F4F1E8]">
        {/* Top Curved Hero with clean Krishna image & Dearr branding */}
        <div className="relative h-64 sm:h-72 w-full rounded-b-[36px] overflow-hidden shadow-sm flex flex-col justify-between p-5 bg-[#18191B]">
          {/* Krishna Image */}
          <Image
            src="/product-samples/1.jpeg"
            alt="Dearr 3D Printed Radha Krishna"
            fill
            priority
            className="object-cover object-[center_18%]"
            sizes="100vw"
          />

          {/* Gradient overlay for contrast and text legibility */}
          <div
            className="absolute inset-0 bg-gradient-to-b from-black/65 via-black/25 to-black/60 pointer-events-none"
            aria-hidden="true"
          />

          {/* Dearr Branding Logo */}
          <div className="relative z-10 flex items-center justify-between">
            <Link
              href="/"
              aria-label="Dearr Home"
              className="focus-visible:outline-2 focus-visible:outline-primary rounded-lg"
            >
              <Image
                src="/brand/dearr-logo.png"
                alt="Dearr Logo"
                width={100}
                height={30}
                priority
                className="h-6 w-auto object-contain brightness-0 invert drop-shadow"
                style={{ width: "auto" }}
              />
            </Link>
            <div className="text-[10px] font-semibold text-white/90 border border-white/30 rounded-full px-2.5 py-1 backdrop-blur-xs">
              🇮🇳 IN &bull; EN
            </div>
          </div>

          {/* Hero Welcome Heading */}
          <div className="relative z-10 space-y-1">
            <h1 className="font-display text-2xl font-bold text-white drop-shadow-sm">
              Welcome Back
            </h1>
            <p className="text-xs text-white/85">
              Sign in to access your orders, wishlist, and cart
            </p>
          </div>
        </div>

        {/* Overlapping White Form Sheet */}
        <div className="px-4 -mt-5 relative z-20 pb-8 sm:pb-12 max-w-lg mx-auto w-full">
          <div className="bg-surface rounded-[24px] p-5 sm:p-6 shadow-modal border border-neutral-200/80">
            <LoginForm oauthError={oauthError} />
          </div>
        </div>
      </div>
    </div>
  );
}
