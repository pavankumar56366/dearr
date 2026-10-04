"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import {
  MailIcon,
  LockIcon,
  EyeIcon,
  EyeOffIcon,
  ShieldCheckIcon,
  AlertCircleIcon,
} from "./AdminIcons";

/**
 * AdminLoginForm — Real administrator authentication form for the Dearr Operations Portal.
 *
 * Implements:
 * - Real credential authentication against POST /api/auth/login
 * - Server-authoritative role verification: rejects accounts with role !== 'admin'
 * - Safe redirect destination validation (restricted to /admin/*, prevents open redirects)
 * - Session expiry detection (?expired=true display banner)
 * - Accessible 48px inputs, password toggle, ARIA validation attributes
 * - No sensitive tokens or secrets stored in localStorage/sessionStorage
 */
export function AdminLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isLoading: isAuthLoading, refresh } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [isLoading, setIsLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [forgotPasswordNote, setForgotPasswordNote] = useState(false);

  // Safe redirect destination resolution (Rule §8)
  const redirectParam = searchParams.get("redirect");
  const isSessionExpired = searchParams.get("expired") === "true";

  const targetDestination =
    redirectParam &&
    redirectParam.startsWith("/admin") &&
    !redirectParam.startsWith("//") &&
    redirectParam !== "/admin/login"
      ? redirectParam
      : "/admin";

  // Automatically redirect if already authenticated as admin
  useEffect(() => {
    if (!isAuthLoading && user && user.role === "admin") {
      router.replace(targetDestination);
    }
  }, [user, isAuthLoading, router, targetDestination]);

  const validate = () => {
    const newErrors: { email?: string; password?: string } = {};

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      newErrors.email = "Please enter your admin email address";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      newErrors.email = "Please enter a valid email address";
    }

    if (!password) {
      newErrors.password = "Password is required";
    } else if (password.length < 8) {
      newErrors.password = "Password must be at least 8 characters";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);

    if (!validate()) return;

    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        setServerError(data?.error || "Invalid email or password");
        setIsLoading(false);
        return;
      }

      // Role check: Only users with role === 'admin' are authorized
      if (data.user?.role !== "admin") {
        setServerError(
          "Access denied: Administrator privileges required. Your account has Customer role."
        );
        setIsLoading(false);
        return;
      }

      // Refresh global session state and navigate to destination
      await refresh();
      router.replace(targetDestination);
    } catch {
      setServerError("Network error: Unable to connect to server. Please try again.");
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="w-full space-y-4">
      {/* Session Expired Notice */}
      {isSessionExpired && !serverError && (
        <div
          role="status"
          className="p-3.5 rounded-xl border border-amber-300 bg-amber-50 text-amber-900 text-xs font-semibold flex items-start gap-2.5 animate-in fade-in duration-200"
        >
          <AlertCircleIcon size={16} className="text-amber-600 shrink-0 mt-0.5" />
          <span>Your admin session has expired. Please sign in again to continue.</span>
        </div>
      )}

      {/* Server Error Alert */}
      {serverError && (
        <div
          role="alert"
          className="p-3.5 rounded-xl border border-red-200 bg-red-50 text-red-800 text-xs font-semibold flex items-start gap-2.5 animate-in fade-in duration-200"
        >
          <AlertCircleIcon size={16} className="text-error shrink-0 mt-0.5" />
          <span>{serverError}</span>
        </div>
      )}

      {/* Email Address Field */}
      <div className="space-y-1.5 text-left">
        <label
          htmlFor="admin-email"
          className="block text-xs font-bold uppercase tracking-wider text-neutral-700"
        >
          Admin Email Address
        </label>
        <div className="relative">
          <div
            className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-400"
            aria-hidden="true"
          >
            <MailIcon size={18} />
          </div>
          <input
            id="admin-email"
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }));
              if (serverError) setServerError(null);
            }}
            placeholder="founder@dearr.in"
            autoComplete="email"
            disabled={isLoading}
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? "admin-email-error" : undefined}
            className={`w-full h-12 pl-10 pr-4 rounded-xl border text-sm text-neutral-900 placeholder:text-neutral-400 transition-all focus:outline-none focus:ring-2 focus:ring-primary/40 ${
              errors.email
                ? "border-error bg-red-50/20 focus:border-error"
                : "border-neutral-300 bg-surface focus:border-primary"
            }`}
          />
        </div>
        {errors.email && (
          <p
            id="admin-email-error"
            role="alert"
            className="flex items-center gap-1.5 text-xs font-medium text-error pt-0.5"
          >
            <AlertCircleIcon size={13} className="shrink-0" />
            <span>{errors.email}</span>
          </p>
        )}
      </div>

      {/* Password Field */}
      <div className="space-y-1.5 text-left">
        <div className="flex items-center justify-between">
          <label
            htmlFor="admin-password"
            className="block text-xs font-bold uppercase tracking-wider text-neutral-700"
          >
            Admin Password
          </label>
        </div>
        <div className="relative">
          <div
            className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-400"
            aria-hidden="true"
          >
            <LockIcon size={18} />
          </div>
          <input
            id="admin-password"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (errors.password) {
                setErrors((prev) => ({ ...prev, password: undefined }));
              }
              if (serverError) setServerError(null);
            }}
            placeholder="••••••••••••"
            autoComplete="current-password"
            disabled={isLoading}
            aria-invalid={Boolean(errors.password)}
            aria-describedby={errors.password ? "admin-password-error" : undefined}
            className={`w-full h-12 pl-10 pr-11 rounded-xl border text-sm text-neutral-900 placeholder:text-neutral-400 transition-all focus:outline-none focus:ring-2 focus:ring-primary/40 ${
              errors.password
                ? "border-error bg-red-50/20 focus:border-error"
                : "border-neutral-300 bg-surface focus:border-primary"
            }`}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-neutral-400 hover:text-neutral-700 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-r-xl cursor-pointer"
          >
            {showPassword ? <EyeOffIcon size={18} /> : <EyeIcon size={18} />}
          </button>
        </div>
        {errors.password && (
          <p
            id="admin-password-error"
            role="alert"
            className="flex items-center gap-1.5 text-xs font-medium text-error pt-0.5"
          >
            <AlertCircleIcon size={13} className="shrink-0" />
            <span>{errors.password}</span>
          </p>
        )}
      </div>

      {/* Forgot Password Accordion / Notice */}
      <div className="text-right">
        <button
          type="button"
          onClick={() => setForgotPasswordNote(!forgotPasswordNote)}
          className="text-xs font-semibold text-neutral-600 hover:text-neutral-900 transition-colors underline underline-offset-2 cursor-pointer"
        >
          Forgot password?
        </button>
        {forgotPasswordNote && (
          <div className="mt-2 p-3 rounded-xl bg-neutral-100 text-left text-xs text-neutral-600 space-y-1 animate-in fade-in duration-150 border border-neutral-200">
            <div className="font-semibold text-neutral-800 flex items-center gap-1.5">
              <ShieldCheckIcon size={14} className="text-primary" />
              <span>Founder Account Recovery</span>
            </div>
            <p className="text-[11px] text-neutral-500 leading-relaxed">
              Founder admin credentials are provisioned securely via Hostinger MySQL
              environment variables and profiles database table. Contact store operators for credential rotation.
            </p>
          </div>
        )}
      </div>

      {/* Primary Submit Button */}
      <button
        type="submit"
        disabled={isLoading}
        className="w-full h-12 rounded-xl font-bold text-sm tracking-wide text-neutral-900 transition-all shadow-xs flex items-center justify-center gap-2 focus-visible:outline-2 focus-visible:outline-neutral-900 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed active:scale-98"
        style={{
          background: "var(--color-primary)",
        }}
      >
        {isLoading ? (
          <>
            <span className="w-4 h-4 border-2 border-neutral-900 border-t-transparent rounded-full animate-spin" />
            <span>Verifying Credentials...</span>
          </>
        ) : (
          <span>Sign In to Admin</span>
        )}
      </button>

      {/* Security Notice */}
      <div className="pt-2 text-center">
        <p className="text-[11px] text-neutral-500 flex items-center justify-center gap-1.5">
          <ShieldCheckIcon size={13} className="text-neutral-400" />
          <span>Restricted to authorized Dearr founders and operators.</span>
        </p>
      </div>
    </form>
  );
}
