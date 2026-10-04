"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { GoogleIcon, MailIcon, PhoneIcon, SocialIcon } from "./AuthIcons";
import { UserIcon } from "@/components/customer/Icons";
import { PasswordField } from "./PasswordField";

interface SignupErrors {
  fullName?: string;
  email?: string;
  phone?: string;
  password?: string;
  confirmPassword?: string;
}

export function SignupForm() {
  const router = useRouter();
  const { signup } = useAuth();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<SignupErrors>({});
  const [isLoading, setIsLoading] = useState(false);
  const [simulatedFeedback, setSimulatedFeedback] = useState<string | null>(null);

  const validate = (): boolean => {
    const nextErrors: SignupErrors = {};

    if (!fullName.trim()) {
      nextErrors.fullName = "Please enter your full name";
    } else if (fullName.trim().length < 2) {
      nextErrors.fullName = "Full name must be at least 2 characters";
    }

    if (!email.trim()) {
      nextErrors.email = "Please enter your email address";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      nextErrors.email = "Please enter a valid email address";
    }

    if (!phone.trim()) {
      nextErrors.phone = "Please enter your mobile number";
    } else if (!/^[6-9]\d{9}$/.test(phone.trim().replace(/\D/g, ""))) {
      nextErrors.phone = "Please enter a valid 10-digit mobile number (e.g. 9876543210)";
    }

    if (!password) {
      nextErrors.password = "Please enter a password";
    } else if (password.length < 8) {
      nextErrors.password = "Password must be at least 8 characters";
    }

    if (!confirmPassword) {
      nextErrors.confirmPassword = "Please confirm your password";
    } else if (confirmPassword !== password) {
      nextErrors.confirmPassword = "Passwords do not match";
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
      const result = await signup({
        name: fullName,
        email,
        phone,
        password,
      });

      if (!result.ok) {
        const errorMsg = result.error || "Registration failed. Please check your details.";
        setSimulatedFeedback(errorMsg);
        if (errorMsg.toLowerCase().includes("email")) {
          setErrors((prev) => ({ ...prev, email: errorMsg }));
        }
      } else {
        setSimulatedFeedback("Account created successfully! Redirecting...");
        setTimeout(() => {
          router.push("/account");
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
            aria-live="polite"
            className="p-3.5 rounded-xl bg-primary/20 border border-primary text-neutral-900 text-xs font-medium animate-in fade-in duration-200"
          >
            {simulatedFeedback}
          </div>
        )}

        {/* Full Name */}
        <div className="space-y-1.5">
          <label
            htmlFor="signup-name"
            className="block text-xs font-semibold text-neutral-900 tracking-wide"
          >
            Full Name
          </label>
          <div className="relative flex items-center w-full">
            <span className="absolute left-3.5 text-neutral-400 pointer-events-none flex items-center justify-center">
              <UserIcon size={18} />
            </span>
            <input
              id="signup-name"
              name="fullName"
              type="text"
              value={fullName}
              onChange={(e) => {
                setFullName(e.target.value);
                if (errors.fullName) setErrors((prev) => ({ ...prev, fullName: undefined }));
              }}
              placeholder="e.g. John Doe"
              autoComplete="name"
              disabled={isLoading}
              aria-invalid={!!errors.fullName}
              aria-describedby={errors.fullName ? "name-error" : undefined}
              className={`w-full h-12 pl-10 pr-4 rounded-input bg-surface text-neutral-900 text-sm placeholder:text-neutral-400 border transition-all outline-none ${
                errors.fullName
                  ? "border-error focus:ring-2 focus:ring-error/20"
                  : "border-neutral-300 focus:border-primary focus:ring-2 focus:ring-primary/20"
              } ${isLoading ? "bg-neutral-100 cursor-not-allowed" : ""}`}
            />
          </div>
          {errors.fullName && (
            <p
              id="name-error"
              role="alert"
              aria-live="polite"
              className="text-xs font-medium text-error mt-1 animate-in fade-in duration-150"
            >
              {errors.fullName}
            </p>
          )}
        </div>

        {/* Email Field */}
        <div className="space-y-1.5">
          <label
            htmlFor="signup-email"
            className="block text-xs font-semibold text-neutral-900 tracking-wide"
          >
            Email Address
          </label>
          <div className="relative flex items-center w-full">
            <span className="absolute left-3.5 text-neutral-400 pointer-events-none flex items-center justify-center">
              <MailIcon size={18} />
            </span>
            <input
              id="signup-email"
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
              aria-describedby={errors.email ? "signup-email-error" : undefined}
              className={`w-full h-12 pl-10 pr-4 rounded-input bg-surface text-neutral-900 text-sm placeholder:text-neutral-400 border transition-all outline-none ${
                errors.email
                  ? "border-error focus:ring-2 focus:ring-error/20"
                  : "border-neutral-300 focus:border-primary focus:ring-2 focus:ring-primary/20"
              } ${isLoading ? "bg-neutral-100 cursor-not-allowed" : ""}`}
            />
          </div>
          {errors.email && (
            <p
              id="signup-email-error"
              role="alert"
              aria-live="polite"
              className="text-xs font-medium text-error mt-1 animate-in fade-in duration-150"
            >
              {errors.email}
            </p>
          )}
        </div>

        {/* Phone Field */}
        <div className="space-y-1.5">
          <label
            htmlFor="signup-phone"
            className="block text-xs font-semibold text-neutral-900 tracking-wide"
          >
            Mobile Number
          </label>
          <div className="relative flex items-center w-full">
            <span className="absolute left-3.5 text-neutral-400 pointer-events-none flex items-center justify-center">
              <PhoneIcon size={18} />
            </span>
            <span className="absolute left-10 text-xs font-bold text-neutral-400 select-none">
              +91
            </span>
            <input
              id="signup-phone"
              name="phone"
              type="tel"
              maxLength={10}
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value.replace(/\D/g, ""));
                if (errors.phone) setErrors((prev) => ({ ...prev, phone: undefined }));
              }}
              placeholder="9876543210"
              autoComplete="tel"
              disabled={isLoading}
              aria-invalid={!!errors.phone}
              aria-describedby={errors.phone ? "signup-phone-error" : undefined}
              className={`w-full h-12 pl-18 pr-4 rounded-input bg-surface text-neutral-900 text-sm placeholder:text-neutral-400 border transition-all outline-none ${
                errors.phone
                  ? "border-error focus:ring-2 focus:ring-error/20"
                  : "border-neutral-300 focus:border-primary focus:ring-2 focus:ring-primary/20"
              } ${isLoading ? "bg-neutral-100 cursor-not-allowed" : ""}`}
            />
          </div>
          {errors.phone && (
            <p
              id="signup-phone-error"
              role="alert"
              aria-live="polite"
              className="text-xs font-medium text-error mt-1 animate-in fade-in duration-150"
            >
              {errors.phone}
            </p>
          )}
        </div>

        {/* Password */}
        <div className="space-y-1.5">
          <PasswordField
            id="signup-password"
            name="password"
            label="Password (min. 8 characters)"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }));
            }}
            disabled={isLoading}
            error={errors.password}
            placeholder="Create password"
            autoComplete="new-password"
          />
        </div>

        {/* Confirm Password */}
        <div className="space-y-1.5">
          <PasswordField
            id="signup-confirm-password"
            name="confirmPassword"
            label="Confirm Password"
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value);
              if (errors.confirmPassword) setErrors((prev) => ({ ...prev, confirmPassword: undefined }));
            }}
            disabled={isLoading}
            error={errors.confirmPassword}
            placeholder="Repeat password"
            autoComplete="new-password"
          />
        </div>

        {/* Primary Create Account Button */}
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
              <span>Creating Account...</span>
            </>
          ) : (
            <span>Create Account</span>
          )}
        </button>

        {/* Divider: Or */}
        <div className="relative py-1 flex items-center justify-center">
          <div className="w-full border-t border-neutral-200" />
          <span className="absolute px-3 bg-surface text-xs text-neutral-400 font-medium">
            or
          </span>
        </div>

        {/* Mock Google Button */}
        <button
          type="button"
          disabled={isLoading}
          onClick={() => {
            setSimulatedFeedback("Google OAuth registration is scheduled for subsequent authentication phase.");
          }}
          className="w-full h-12 rounded-input border border-neutral-300 bg-surface hover:bg-neutral-100/60 active:scale-98 transition-all flex items-center justify-center gap-3 text-sm font-medium text-neutral-900 focus-visible:outline-2 focus-visible:outline-primary cursor-pointer"
        >
          <GoogleIcon size={18} />
          <span>Sign up with Google</span>
        </button>

        {/* Existing customer login link */}
        <p className="text-center text-xs text-neutral-600 pt-2">
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-semibold text-neutral-900 hover:text-primary transition-colors underline focus-visible:outline-2 focus-visible:outline-primary rounded-sm"
          >
            Log in
          </Link>
        </p>

        {/* Social Icons */}
        <div className="pt-2 flex items-center justify-center gap-4 text-neutral-400">
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
