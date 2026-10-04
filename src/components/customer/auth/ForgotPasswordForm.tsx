"use client";

import React, { useState } from "react";
import Link from "next/link";
import { MailIcon } from "./AuthIcons";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const validate = (): boolean => {
    if (!email.trim()) {
      setError("Please enter your registered email address");
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Please enter a valid email address");
      return false;
    }
    setError(undefined);
    return true;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    setIsLoading(true);

    setTimeout(() => {
      setIsLoading(false);
      setIsSuccess(true);
    }, 850);
  };

  if (isSuccess) {
    return (
      <div className="w-full space-y-5 animate-in fade-in duration-300">
        <div
          role="status"
          aria-live="polite"
          className="p-5 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-950 space-y-2 leading-relaxed"
        >
          <div className="flex items-center gap-2 font-bold text-sm text-emerald-800">
            <span>✓ Reset Instructions Queued</span>
          </div>
          <p>
            If an account is associated with <strong className="text-neutral-900">{email}</strong>, password recovery instructions will be sent.
          </p>
          <p className="text-[11px] text-emerald-700 font-medium">
            (Demo Mode: Email service integration with secure reset tokens will be configured in Phase 2).
          </p>
        </div>

        <div className="flex flex-col gap-2.5 pt-2">
          <Link
            href="/login"
            className="w-full h-12 rounded-input bg-primary hover:bg-[#91BC7A] active:scale-98 text-neutral-900 text-sm font-semibold tracking-wide transition-all shadow-xs flex items-center justify-center gap-2 focus-visible:outline-2 focus-visible:outline-neutral-900 cursor-pointer"
          >
            <span>Back to Login</span>
          </Link>

          <button
            type="button"
            onClick={() => {
              setIsSuccess(false);
              setEmail("");
            }}
            className="w-full py-2.5 text-xs font-semibold text-neutral-600 hover:text-neutral-900 transition-colors"
          >
            ← Send to another email
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        {/* Email Field */}
        <div className="space-y-1.5">
          <label
            htmlFor="forgot-email"
            className="block text-xs font-semibold text-neutral-900 tracking-wide"
          >
            Registered Email Address
          </label>
          <div className="relative flex items-center w-full">
            <span className="absolute left-3.5 text-neutral-400 pointer-events-none flex items-center justify-center">
              <MailIcon size={18} />
            </span>
            <input
              id="forgot-email"
              name="email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (error) setError(undefined);
              }}
              placeholder="name@example.com"
              autoComplete="email"
              disabled={isLoading}
              aria-invalid={!!error}
              aria-describedby={error ? "forgot-email-error" : undefined}
              className={`w-full h-12 pl-10 pr-4 rounded-input bg-surface text-neutral-900 text-sm placeholder:text-neutral-400 border transition-all outline-none ${
                error
                  ? "border-error focus:ring-2 focus:ring-error/20"
                  : "border-neutral-300 focus:border-primary focus:ring-2 focus:ring-primary/20"
              } ${isLoading ? "bg-neutral-100 cursor-not-allowed" : ""}`}
            />
          </div>
          {error && (
            <p
              id="forgot-email-error"
              role="alert"
              aria-live="polite"
              className="text-xs font-medium text-error mt-1 animate-in fade-in duration-150"
            >
              {error}
            </p>
          )}
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isLoading}
          className="w-full h-12 rounded-input bg-primary hover:bg-[#91BC7A] active:scale-98 text-neutral-900 text-sm font-semibold tracking-wide transition-all shadow-xs flex items-center justify-center gap-2 focus-visible:outline-2 focus-visible:outline-neutral-900 disabled:opacity-60 disabled:cursor-not-allowed mt-2 cursor-pointer"
        >
          {isLoading ? (
            <>
              <svg
                className="animate-spin h-4 w-4 text-neutral-900"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              <span>Sending Link...</span>
            </>
          ) : (
            <span>Send Reset Link</span>
          )}
        </button>

        {/* Back to Login Link */}
        <p className="text-center text-xs text-neutral-600 pt-3">
          Remember your password?{" "}
          <Link
            href="/login"
            className="font-semibold text-neutral-900 hover:text-primary transition-colors underline focus-visible:outline-2 focus-visible:outline-primary rounded-sm"
          >
            Back to login
          </Link>
        </p>
      </form>
    </div>
  );
}
