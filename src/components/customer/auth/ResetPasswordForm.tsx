"use client";

import React, { useState } from "react";
import Link from "next/link";
import { PasswordField } from "./PasswordField";

interface ResetPasswordFormProps {
  token?: string;
}

export function ResetPasswordForm({ token }: ResetPasswordFormProps) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<{ password?: string; confirmPassword?: string }>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const validate = (): boolean => {
    const nextErrors: { password?: string; confirmPassword?: string } = {};

    if (!password) {
      nextErrors.password = "Please enter a new password";
    } else if (password.length < 8) {
      nextErrors.password = "Password must be at least 8 characters";
    }

    if (!confirmPassword) {
      nextErrors.confirmPassword = "Please confirm your new password";
    } else if (confirmPassword !== password) {
      nextErrors.confirmPassword = "Passwords do not match";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
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
    }, 900);
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
            <span>✓ Password Successfully Updated</span>
          </div>
          <p>
            Your new password has been validated for your Dearr account.
          </p>
          <p className="text-[11px] text-emerald-700 font-medium">
            (Demo Mode: In Phase 2, this will update the password_hash with bcrypt in the Hostinger MySQL database).
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

  return (
    <div className="w-full">
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        {/* Token Context Badge */}
        {token && (
          <div className="px-3 py-1.5 rounded-lg bg-neutral-100 text-[11px] font-mono text-neutral-600 flex items-center justify-between">
            <span>Token Context:</span>
            <span className="font-bold text-neutral-900 truncate max-w-[180px]">{token}</span>
          </div>
        )}

        {/* New Password */}
        <div className="space-y-1.5">
          <PasswordField
            id="reset-password"
            name="password"
            label="New Password (min. 8 characters)"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }));
            }}
            disabled={isLoading}
            error={errors.password}
            placeholder="Enter new password"
            autoComplete="new-password"
          />
        </div>

        {/* Confirm New Password */}
        <div className="space-y-1.5">
          <PasswordField
            id="reset-confirm-password"
            name="confirmPassword"
            label="Confirm New Password"
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value);
              if (errors.confirmPassword) {
                setErrors((prev) => ({ ...prev, confirmPassword: undefined }));
              }
            }}
            disabled={isLoading}
            error={errors.confirmPassword}
            placeholder="Repeat new password"
            autoComplete="new-password"
          />
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
              <span>Updating Password...</span>
            </>
          ) : (
            <span>Update Password</span>
          )}
        </button>

        {/* Back to Login Link */}
        <p className="text-center text-xs text-neutral-600 pt-2">
          Remember your credentials?{" "}
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
