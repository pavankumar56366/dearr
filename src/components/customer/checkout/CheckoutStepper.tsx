"use client";

import React from "react";
import { CheckIcon, MapPinIcon, CreditCardIcon, ShieldCheckIcon } from "@/components/customer/Icons";

export type CheckoutStep = "delivery" | "payment" | "confirmation";

interface CheckoutStepperProps {
  currentStep: CheckoutStep;
  onStepClick?: (step: CheckoutStep) => void;
  canNavigateToPayment: boolean;
}

export default function CheckoutStepper({
  currentStep,
  onStepClick,
  canNavigateToPayment,
}: CheckoutStepperProps) {
  const steps: { id: CheckoutStep; label: string; number: number; icon: React.ReactNode }[] = [
    {
      id: "delivery",
      label: "Delivery Address",
      number: 1,
      icon: <MapPinIcon size={16} />,
    },
    {
      id: "payment",
      label: "Review & Payment",
      number: 2,
      icon: <CreditCardIcon size={16} />,
    },
    {
      id: "confirmation",
      label: "Confirmation",
      number: 3,
      icon: <ShieldCheckIcon size={16} />,
    },
  ];

  return (
    <nav
      aria-label="Checkout Progress"
      className="w-full py-4 px-3 sm:px-6 rounded-2xl mb-8"
      style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-neutral-100)",
        boxShadow: "var(--shadow-card)",
      }}
    >
      <ol className="flex items-center justify-between max-w-2xl mx-auto relative">
        {/* Connecting Line */}
        <div
          aria-hidden="true"
          className="absolute top-1/2 left-8 right-8 -translate-y-1/2 h-0.5 bg-neutral-200 -z-0"
        />

        {steps.map((step, index) => {
          const isCurrent = currentStep === step.id;
          const isCompleted =
            (step.id === "delivery" && (currentStep === "payment" || currentStep === "confirmation")) ||
            (step.id === "payment" && currentStep === "confirmation");

          const isClickable =
            (step.id === "delivery" && currentStep !== "delivery") ||
            (step.id === "payment" && canNavigateToPayment && currentStep !== "payment");

          return (
            <li
              key={step.id}
              aria-current={isCurrent ? "step" : undefined}
              className="relative z-10 flex flex-col items-center gap-1.5"
            >
              <button
                type="button"
                disabled={!isClickable}
                onClick={() => isClickable && onStepClick?.(step.id)}
                className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-bold text-xs transition-all duration-200 ${
                  isCurrent
                    ? "ring-4 ring-[#A2CB8B]/30 text-[#202124] shadow-md scale-105"
                    : isCompleted
                    ? "bg-[#2A7C13] text-white hover:opacity-90 cursor-pointer"
                    : "bg-neutral-100 text-neutral-400 cursor-not-allowed"
                }`}
                style={{
                  background: isCurrent
                    ? "var(--color-primary)"
                    : isCompleted
                    ? "var(--color-success)"
                    : "var(--color-neutral-100)",
                }}
                aria-label={`Step ${step.number}: ${step.label} (${
                  isCompleted ? "Completed" : isCurrent ? "Current" : "Upcoming"
                })`}
              >
                {isCompleted ? (
                  <CheckIcon size={16} className="stroke-[3]" />
                ) : (
                  <span>{step.number}</span>
                )}
              </button>

              <span
                className={`text-[11px] sm:text-xs font-semibold tracking-tight text-center ${
                  isCurrent
                    ? "text-neutral-900 font-bold"
                    : isCompleted
                    ? "text-neutral-700"
                    : "text-neutral-400"
                }`}
              >
                {step.label}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
