"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { MailIcon, GoogleIcon, SocialIcon } from "./AuthIcons";
import { PasswordField } from "./PasswordField";

/** Maps Google OAuth callback error codes to user-friendly messages. */
const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  google_denied: "Google sign-in was cancelled. You can try again or use your email and password.",
  google_error: "Google sign-in encountered an error. Please try again.",
  missing_code: "Google sign-in was incomplete. Please try again.",
  missing_state: "Security validation failed during Google sign-in. Please try again.",
  invalid_state: "Security validation failed during Google sign-in. Please try again.",
  token_error: "Could not verify your Google identity. Please try again.",
  email_not_verified: "Your Google account email is not verified. Please verify your email with Google and try again.",
  email_exists_use_password:
    "An account with this email already exists. Please sign in with your email and password, or use the Forgot Password link.",
  account_conflict: "A Google account conflict was detected. Please contact support.",
  profile_error: "Could not create or load your account. Please try again or contact support.",
  oauth_config_error: "Google sign-in is temporarily unavailable. Please use email and password.",
  server_error: "An unexpected error occurred during Google sign-in. Please try again.",
};

export function LoginForm({ oauthError }: { oauthError?: string | null }) {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [isLoading, setIsLoading] = useState(false);
  const [simulatedFeedback, setSimulatedFeedback] = useState<string | null>(
    // Show friendly OAuth error message on mount if redirected from Google callback
    oauthError ? (OAUTH_ERROR_MESSAGES[oauthError] ?? "Google sign-in failed. Please try again.") : null
  );

  const validate = () => {
    const nextErrors: { email?: string; password?: string } = {};

    if (!email.trim()) {
      nextErrors.email = "Please enter your email address";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      nextErrors.email = "Please enter a valid email address";
    }

    if (!password) {
      nextErrors.password = "Please enter your password";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSimulatedFeedback(null);

    if (!validate()) {
      return;
    }

    setIsLoading(true);

    try {
      const result = await login(email, password);

      if (!result.ok) {
        setSimulatedFeedback(result.error || "Invalid email or password.");
      } else {
        setSimulatedFeedback("Login successful! Redirecting...");
        const redirectParam =
          typeof window !== "undefined"
            ? new URLSearchParams(window.location.search).get("redirect")
            : null;
        const destination =
          redirectParam && redirectParam.startsWith("/") && !redirectParam.startsWith("//")
            ? redirectParam
            : "/account";

        setTimeout(() => {
          router.push(destination);
          router.refresh();
        }, 800);
      }
    } catch {
      setSimulatedFeedback("Unable to reach the server. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full">
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        {/* Simulated feedback banner */}
        {simulatedFeedback && (
          <div
            role="status"
            className="p-3 rounded-xl bg-primary/20 border border-primary text-neutral-900 text-xs font-medium animate-in fade-in duration-200"
          >
            {simulatedFeedback}
          </div>
        )}

        {/* Email Field */}
        <div className="space-y-1.5">
          <label
            htmlFor="login-email"
            className="block text-xs font-semibold text-neutral-900 tracking-wide"
          >
            Email
          </label>
          <div className="relative flex items-center w-full">
            <span className="absolute left-3.5 text-neutral-400 pointer-events-none flex items-center justify-center">
              <MailIcon size={18} />
            </span>
            <input
              id="login-email"
              name="email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }));
              }}
              placeholder="name@example.com"
              autoComplete="email"
              disabled={isLoading}
              aria-invalid={!!errors.email}
              aria-describedby={errors.email ? "email-error" : undefined}
              className={`w-full h-12 pl-10 pr-4 rounded-input bg-surface text-neutral-900 text-sm placeholder:text-neutral-400 border transition-all outline-none ${
                errors.email
                  ? "border-error focus:ring-2 focus:ring-error/20"
                  : "border-neutral-300 focus:border-primary focus:ring-2 focus:ring-primary/20"
              } ${isLoading ? "bg-neutral-100 cursor-not-allowed" : ""}`}
            />
          </div>
          {errors.email && (
            <p
              id="email-error"
              role="alert"
              aria-live="polite"
              className="text-xs font-medium text-error mt-1 animate-in fade-in duration-150"
            >
              {errors.email}
            </p>
          )}
        </div>

        {/* Password Field with Show/Hide Toggle */}
        <div className="space-y-1.5">
          <PasswordField
            id="login-password"
            name="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (errors.password) {
                setErrors((prev) => ({ ...prev, password: undefined }));
              }
            }}
            disabled={isLoading}
            error={errors.password}
            placeholder="••••••••"
          />

          {/* Forgot Password Link */}
          <div className="flex justify-end pt-0.5">
            <Link
              href="/forgot-password"
              className="text-xs font-medium text-neutral-700 hover:text-error transition-colors focus-visible:outline-2 focus-visible:outline-primary rounded-sm"
            >
              Forgot password?
            </Link>
          </div>
        </div>

        {/* Divider: Or */}
        <div className="relative py-2 flex items-center justify-center">
          <div className="w-full border-t border-neutral-200" />
          <span className="absolute px-3 bg-surface text-xs text-neutral-400 font-medium">
            or
          </span>
        </div>

        {/* Google OAuth Button — initiates server-side OAuth flow */}
        <a
          href="/api/auth/google"
          id="google-signin-btn"
          aria-label="Continue with Google"
          className={`w-full h-12 rounded-input border border-neutral-300 bg-surface hover:bg-neutral-100/60 active:scale-98 transition-all flex items-center justify-center gap-3 text-sm font-medium text-neutral-900 focus-visible:outline-2 focus-visible:outline-primary ${isLoading ? "pointer-events-none opacity-60" : ""}`}
        >
          <GoogleIcon size={18} />
          <span>Continue with Google</span>
        </a>

        {/* Primary Login Button */}
        <button
          type="submit"
          disabled={isLoading}
          className="w-full h-12 rounded-input bg-primary hover:bg-[#91BC7A] active:scale-98 text-neutral-900 text-sm font-semibold tracking-wide transition-all shadow-xs flex items-center justify-center gap-2 focus-visible:outline-2 focus-visible:outline-neutral-900 disabled:opacity-60 disabled:cursor-not-allowed"
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
              <span>Signing in...</span>
            </>
          ) : (
            <span>Login</span>
          )}
        </button>

        {/* Sign up prompt */}
        <p className="text-center text-xs text-neutral-600 pt-2">
          Don&apos;t have an account?{" "}
          <Link
            href="/signup"
            className="font-semibold text-neutral-900 hover:text-primary transition-colors underline focus-visible:outline-2 focus-visible:outline-primary rounded-sm"
          >
            Sign up
          </Link>
        </p>

        {/* Social / Trust Icons Footer (from references) */}
        <div className="pt-4 flex items-center justify-center gap-4 text-neutral-400">
          <span className="p-2 rounded-full hover:text-neutral-700 transition-colors cursor-pointer">
            <SocialIcon name="facebook" size={16} />
            <span className="sr-only">Facebook</span>
          </span>
          <span className="p-2 rounded-full hover:text-neutral-700 transition-colors cursor-pointer">
            <SocialIcon name="twitter" size={16} />
            <span className="sr-only">Twitter</span>
          </span>
          <span className="p-2 rounded-full hover:text-neutral-700 transition-colors cursor-pointer">
            <SocialIcon name="instagram" size={16} />
            <span className="sr-only">Instagram</span>
          </span>
        </div>
      </form>
    </div>
  );
}
