"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AuthShell } from "./AuthShell";
import { ResetPasswordForm } from "./ResetPasswordForm";
import { AlertCircleIcon } from "@/components/customer/Icons";

export function ResetPasswordView() {
  const searchParams = useSearchParams();
  const tokenParam = searchParams.get("token");

  // Allow explicit demo testing if query parameter exists or tester enables demo mode
  const [activeToken, setActiveToken] = useState<string | null>(tokenParam || null);

  const isTokenExpiredOrMissing = !activeToken || activeToken === "expired" || activeToken === "invalid";

  return (
    <AuthShell
      title="Reset Password"
      subtitle="Create a new secure password for your Dearr account"
      topAction={{
        text: "Need to sign in?",
        linkText: "Log In",
        href: "/login",
      }}
      heroBadge="Account Security • Password Update"
      heroHeading={
        <>
          Security First. <br />
          <span className="text-secondary">Seamless Access.</span>
        </>
      }
      heroText="Protect your saved 3D printing configurations and orders with an updated, high-entropy password."
    >
      {isTokenExpiredOrMissing ? (
        <div className="w-full space-y-5 animate-in fade-in duration-200">
          <div className="p-5 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-950 space-y-2 leading-relaxed">
            <div className="flex items-center gap-2 font-bold text-sm text-amber-900">
              <AlertCircleIcon size={18} className="text-amber-700 shrink-0" />
              <span>Reset Link Unavailable or Expired</span>
            </div>
            <p>
              Your password reset link is not available or has expired. For your security, password recovery links are single-use and expire after a short validity window.
            </p>
          </div>

          <div className="flex flex-col gap-2.5 pt-2">
            <Link
              href="/login"
              className="w-full h-12 rounded-input bg-primary hover:bg-[#91BC7A] active:scale-98 text-neutral-900 text-sm font-semibold tracking-wide transition-all shadow-xs flex items-center justify-center gap-2 focus-visible:outline-2 focus-visible:outline-neutral-900 cursor-pointer"
            >
              <span>Back to Login</span>
            </Link>

            <Link
              href="/forgot-password"
              className="w-full py-2.5 text-xs font-semibold text-neutral-700 hover:text-neutral-900 text-center transition-colors underline"
            >
              Request a new reset link
            </Link>

            {/* Demo testing helper button */}
            <div className="pt-2 border-t border-neutral-100 text-center">
              <button
                type="button"
                onClick={() => setActiveToken("demo_reset_token_xyz123")}
                className="text-[11px] font-semibold text-neutral-500 hover:text-neutral-800 underline cursor-pointer"
              >
                ⚡ Test Form with Demo Token
              </button>
            </div>
          </div>
        </div>
      ) : (
        <ResetPasswordForm token={activeToken} />
      )}
    </AuthShell>
  );
}
