"use client";

import React, { useState } from "react";
import { LockIcon, EyeIcon, EyeOffIcon } from "./AuthIcons";

interface PasswordFieldProps {
  id?: string;
  name?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
  placeholder?: string;
  label?: string;
  error?: string;
  disabled?: boolean;
  autoComplete?: string;
}

export function PasswordField({
  id = "password",
  name = "password",
  value,
  onChange,
  onBlur,
  placeholder = "Enter your password",
  label = "Password",
  error,
  disabled = false,
  autoComplete = "current-password",
}: PasswordFieldProps) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="w-full space-y-1.5">
      <div className="flex items-center justify-between">
        <label
          htmlFor={id}
          className="block text-xs font-semibold text-neutral-900 tracking-wide"
        >
          {label}
        </label>
      </div>

      <div className="relative flex items-center w-full">
        {/* Leading Lock Icon */}
        <span className="absolute left-3.5 text-neutral-400 pointer-events-none flex items-center justify-center">
          <LockIcon size={18} />
        </span>

        {/* Input */}
        <input
          id={id}
          name={name}
          type={showPassword ? "text" : "password"}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          disabled={disabled}
          placeholder={placeholder}
          autoComplete={autoComplete}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
          className={`w-full h-12 pl-10 pr-11 rounded-input bg-surface text-neutral-900 text-sm placeholder:text-neutral-400 border transition-all outline-none ${
            error
              ? "border-error focus:ring-2 focus:ring-error/20"
              : "border-neutral-300 focus:border-primary focus:ring-2 focus:ring-primary/20"
          } ${disabled ? "bg-neutral-100 cursor-not-allowed text-neutral-400" : ""}`}
        />

        {/* Password Visibility Toggle */}
        <button
          type="button"
          tabIndex={0}
          onClick={() => setShowPassword((prev) => !prev)}
          disabled={disabled}
          aria-label={showPassword ? "Hide password" : "Show password"}
          className="absolute right-3 p-1.5 text-neutral-400 hover:text-neutral-700 active:scale-95 rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-primary"
        >
          {showPassword ? <EyeOffIcon size={18} /> : <EyeIcon size={18} />}
        </button>
      </div>

      {/* Accessible Inline Error Message */}
      {error && (
        <p
          id={`${id}-error`}
          role="alert"
          aria-live="polite"
          className="text-xs font-medium text-error flex items-center gap-1 mt-1 animate-in fade-in duration-150"
        >
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}
