"use client";

import React, { useState } from "react";
import Link from "next/link";
import { MailIcon, LockIcon } from "./AuthIcons";
import { PasswordField } from "./PasswordField";

type ForgotPasswordStep = "request" | "verify" | "reset" | "success";

export function ForgotPasswordForm() {
  const [step, setStep] = useState<ForgotPasswordStep>("request");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [infoMessage, setInfoMessage] = useState<string | undefined>();

  // Step 1: Request OTP
  const handleRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim();

    if (!cleanEmail) {
      setError("Please enter your registered email address");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setError("Please enter a valid email address");
      return;
    }

    setError(undefined);
    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: cleanEmail }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || "Failed to process password reset request");
      }

      setInfoMessage("We've sent a 6-digit recovery code to your email if an account exists.");
      setStep("verify");
    } catch (err: any) {
      setError(err?.message || "An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2: Verify OTP
  const handleVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanOtp = otp.trim();

    if (!cleanOtp) {
      setError("Please enter the 6-digit verification code");
      return;
    }
    if (!/^\d{6}$/.test(cleanOtp)) {
      setError("Verification code must be exactly 6 digits");
      return;
    }

    setError(undefined);
    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/password-reset/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), otp: cleanOtp }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || "Invalid or expired verification code");
      }

      setResetToken(data.resetToken);
      setInfoMessage(undefined);
      setStep("reset");
    } catch (err: any) {
      setError(err?.message || "Verification failed. Please check the code and try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Step 3: Set New Password
  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!password) {
      setError("Please enter a new password");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters long");
      return;
    }
    if (!confirmPassword) {
      setError("Please confirm your new password");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setError(undefined);
    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/password-reset/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resetToken,
          email: email.trim(),
          otp: otp.trim(),
          password,
          confirmPassword,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || "Failed to update password");
      }

      setStep("success");
    } catch (err: any) {
      setError(err?.message || "Failed to update password. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Step 4: Success View
  if (step === "success") {
    return (
      <div className="w-full space-y-5 animate-in fade-in duration-300">
        <div
          role="status"
          aria-live="polite"
          className="p-5 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-950 space-y-2 leading-relaxed"
        >
          <div className="flex items-center gap-2 font-bold text-sm text-emerald-800">
            <span>✓ Password Successfully Updated</span>
          </div>
          <p>
            Your account credentials have been securely updated. You may now log in to your Dearr account with your new password.
          </p>
        </div>

        <Link
          href="/login"
          className="w-full h-12 rounded-input bg-primary hover:bg-[#91BC7A] active:scale-98 text-neutral-900 text-sm font-semibold tracking-wide transition-all shadow-xs flex items-center justify-center gap-2 focus-visible:outline-2 focus-visible:outline-neutral-900 cursor-pointer"
        >
          <span>Proceed to Login →</span>
        </Link>
      </div>
    );
  }

  // Step 3 View: Reset Password
  if (step === "reset") {
    return (
      <div className="w-full">
        <form onSubmit={handleResetSubmit} noValidate className="space-y-4">
          <div className="p-3.5 rounded-xl bg-neutral-100 border border-neutral-200 text-xs text-neutral-700 space-y-1">
            <span className="font-semibold text-neutral-900 block">Verified Code Accepted</span>
            <span>Enter your new high-entropy password below (minimum 8 characters).</span>
          </div>

          <div className="space-y-1.5">
            <PasswordField
              id="new-password"
              name="password"
              label="New Password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (error) setError(undefined);
              }}
              disabled={isLoading}
              placeholder="Enter new password"
              autoComplete="new-password"
            />
          </div>

          <div className="space-y-1.5">
            <PasswordField
              id="confirm-password"
              name="confirmPassword"
              label="Confirm New Password"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                if (error) setError(undefined);
              }}
              disabled={isLoading}
              placeholder="Confirm new password"
              autoComplete="new-password"
            />
          </div>

          {error && (
            <p role="alert" className="text-xs font-medium text-error mt-1 animate-in fade-in duration-150">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full h-12 rounded-input bg-primary hover:bg-[#91BC7A] active:scale-98 text-neutral-900 text-sm font-semibold tracking-wide transition-all shadow-xs flex items-center justify-center gap-2 focus-visible:outline-2 focus-visible:outline-neutral-900 disabled:opacity-60 disabled:cursor-not-allowed mt-2 cursor-pointer"
          >
            {isLoading ? <span>Updating Password...</span> : <span>Save New Password</span>}
          </button>
        </form>
      </div>
    );
  }

  // Step 2 View: Verify OTP
  if (step === "verify") {
    return (
      <div className="w-full">
        <form onSubmit={handleVerifySubmit} noValidate className="space-y-4">
          <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-950 space-y-1">
            <span className="font-semibold text-emerald-900 block">✓ Verification Code Sent</span>
            <p>
              Check your inbox for <strong className="text-neutral-900">{email}</strong>. Enter the 6-digit code below.
            </p>
            <p className="text-[11px] text-emerald-700">Code is valid for 10 minutes.</p>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="otp-input" className="block text-xs font-semibold text-neutral-900 tracking-wide">
              6-Digit Verification Code
            </label>
            <div className="relative flex items-center w-full">
              <span className="absolute left-3.5 text-neutral-400 pointer-events-none flex items-center justify-center">
                <LockIcon size={18} />
              </span>
              <input
                id="otp-input"
                name="otp"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={otp}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, "");
                  setOtp(val);
                  if (error) setError(undefined);
                }}
                placeholder="123456"
                autoComplete="one-time-code"
                disabled={isLoading}
                className="w-full h-12 pl-10 pr-4 rounded-input bg-surface text-neutral-900 text-base font-mono tracking-widest placeholder:text-neutral-400 border border-neutral-300 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
              />
            </div>
            {error && (
              <p role="alert" className="text-xs font-medium text-error mt-1 animate-in fade-in duration-150">
                {error}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={isLoading || otp.length < 6}
            className="w-full h-12 rounded-input bg-primary hover:bg-[#91BC7A] active:scale-98 text-neutral-900 text-sm font-semibold tracking-wide transition-all shadow-xs flex items-center justify-center gap-2 focus-visible:outline-2 focus-visible:outline-neutral-900 disabled:opacity-60 disabled:cursor-not-allowed mt-2 cursor-pointer"
          >
            {isLoading ? <span>Verifying Code...</span> : <span>Verify Code & Continue</span>}
          </button>

          <div className="flex items-center justify-between pt-2 text-xs">
            <button
              type="button"
              onClick={() => {
                setStep("request");
                setOtp("");
                setError(undefined);
              }}
              className="text-neutral-600 hover:text-neutral-900 underline cursor-pointer"
            >
              ← Change Email
            </button>
            <button
              type="button"
              onClick={handleRequestSubmit}
              disabled={isLoading}
              className="text-neutral-600 hover:text-neutral-900 underline cursor-pointer"
            >
              Resend Code
            </button>
          </div>
        </form>
      </div>
    );
  }

  // Step 1 View: Request Email
  return (
    <div className="w-full">
      <form onSubmit={handleRequestSubmit} noValidate className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="forgot-email" className="block text-xs font-semibold text-neutral-900 tracking-wide">
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
              className="w-full h-12 pl-10 pr-4 rounded-input bg-surface text-neutral-900 text-sm placeholder:text-neutral-400 border border-neutral-300 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
            />
          </div>
          {error && (
            <p role="alert" className="text-xs font-medium text-error mt-1 animate-in fade-in duration-150">
              {error}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full h-12 rounded-input bg-primary hover:bg-[#91BC7A] active:scale-98 text-neutral-900 text-sm font-semibold tracking-wide transition-all shadow-xs flex items-center justify-center gap-2 focus-visible:outline-2 focus-visible:outline-neutral-900 disabled:opacity-60 disabled:cursor-not-allowed mt-2 cursor-pointer"
        >
          {isLoading ? <span>Sending Code...</span> : <span>Send Recovery Code</span>}
        </button>

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
