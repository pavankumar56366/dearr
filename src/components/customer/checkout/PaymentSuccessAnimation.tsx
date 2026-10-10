"use client";

import React from "react";

interface PaymentSuccessAnimationProps {
  size?: number;
  className?: string;
}

/**
 * PaymentSuccessAnimation
 *
 * Lightweight, modular, and easily replaceable payment success animation component.
 * - Pure SVG & CSS keyframes for minimal bundle size and 60fps performance
 * - Non-blocking (pointer-events-none) so order confirmation details remain interactive
 * - Honors `prefers-reduced-motion` with instant, accessible fallbacks
 */
export default function PaymentSuccessAnimation({
  size = 80,
  className = "",
}: PaymentSuccessAnimationProps) {
  return (
    <div
      className={`relative inline-flex items-center justify-center select-none pointer-events-none ${className}`}
      style={{ width: size, height: size }}
      role="img"
      aria-label="Payment and order successfully completed"
    >
      <style jsx>{`
        @keyframes dearr-scale-in {
          0% {
            transform: scale(0.6);
            opacity: 0;
          }
          60% {
            transform: scale(1.08);
            opacity: 1;
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }

        @keyframes dearr-draw-check {
          0% {
            stroke-dashoffset: 48;
          }
          100% {
            stroke-dashoffset: 0;
          }
        }

        @keyframes dearr-pulse-ring {
          0% {
            transform: scale(0.85);
            opacity: 0.8;
          }
          50% {
            transform: scale(1.25);
            opacity: 0;
          }
          100% {
            transform: scale(1.25);
            opacity: 0;
          }
        }

        @keyframes dearr-sparkle {
          0% {
            transform: scale(0) rotate(0deg);
            opacity: 0;
          }
          50% {
            transform: scale(1) rotate(90deg);
            opacity: 0.9;
          }
          100% {
            transform: scale(0) rotate(180deg);
            opacity: 0;
          }
        }

        .anim-container {
          animation: dearr-scale-in 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
        }

        .anim-ring {
          animation: dearr-pulse-ring 1.4s ease-out infinite;
        }

        .anim-check {
          stroke-dasharray: 48;
          stroke-dashoffset: 48;
          animation: dearr-draw-check 0.45s 0.25s cubic-bezier(0.65, 0, 0.45, 1) forwards;
        }

        .anim-sparkle-1 {
          animation: dearr-sparkle 1.2s 0.3s ease-in-out infinite;
        }

        .anim-sparkle-2 {
          animation: dearr-sparkle 1.2s 0.6s ease-in-out infinite;
        }

        @media (prefers-reduced-motion: reduce) {
          .anim-container {
            animation: none !important;
            transform: none !important;
            opacity: 1 !important;
          }
          .anim-ring {
            display: none !important;
          }
          .anim-check {
            animation: none !important;
            stroke-dashoffset: 0 !important;
          }
          .anim-sparkle-1,
          .anim-sparkle-2 {
            display: none !important;
          }
        }
      `}</style>

      {/* Subtle outer pulsing ring */}
      <span
        className="anim-ring absolute inset-0 rounded-full bg-emerald-400/25"
        aria-hidden="true"
      />

      {/* Decorative accent sparkles */}
      <svg
        className="anim-sparkle-1 absolute -top-1.5 -right-1.5 w-4 h-4 text-emerald-500"
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M12 0l2.5 8.5L23 11l-8.5 2.5L12 22l-2.5-8.5L1 11l8.5-2.5z" />
      </svg>
      <svg
        className="anim-sparkle-2 absolute -bottom-1 -left-1 w-3.5 h-3.5 text-lime-600"
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M12 0l2.5 8.5L23 11l-8.5 2.5L12 22l-2.5-8.5L1 11l8.5-2.5z" />
      </svg>

      {/* Main SVG checkmark badge */}
      <div className="anim-container relative z-10 w-full h-full">
        <svg
          viewBox="0 0 80 80"
          className="w-full h-full drop-shadow-md"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="dearrSuccessGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#2A7C13" />
              <stop offset="100%" stopColor="#1E5C0D" />
            </linearGradient>
          </defs>

          {/* Background circle with gradient */}
          <circle cx="40" cy="40" r="38" fill="url(#dearrSuccessGradient)" />

          {/* Soft inner highlight border */}
          <circle
            cx="40"
            cy="40"
            r="36"
            stroke="rgba(255, 255, 255, 0.25)"
            strokeWidth="1.5"
          />

          {/* Animated checkmark */}
          <path
            className="anim-check"
            d="M24 41.5L34.5 52L56 28.5"
            stroke="#FFFFFF"
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </div>
  );
}
