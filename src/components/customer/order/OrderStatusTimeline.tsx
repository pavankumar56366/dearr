import React from "react";
import {
  CheckIcon,
  ClockIcon,
  PackageIcon,
  TruckIcon,
  CreditCardIcon,
  AlertCircleIcon,
} from "@/components/customer/Icons";
import {
  getOrderTrackingStages,
  type TrackingStage,
} from "@/lib/order-tracking";

interface OrderStatusTimelineProps {
  currentStatus?: string;
  paymentStatus?: string;
  paymentMethod?: string;
}

function getTimelineIcon(iconType: TrackingStage["iconType"]) {
  switch (iconType) {
    case "check":
      return <CheckIcon size={16} className="stroke-[3]" />;
    case "card":
      return <CreditCardIcon size={16} />;
    case "truck":
      return <TruckIcon size={16} />;
    case "package":
      return <PackageIcon size={16} />;
    case "alert":
      return <AlertCircleIcon size={16} />;
    default:
      return <CheckIcon size={16} className="stroke-[3]" />;
  }
}

export default function OrderStatusTimeline({
  currentStatus = "confirmed",
  paymentStatus = "paid",
  paymentMethod = "Razorpay",
}: OrderStatusTimelineProps) {
  const steps = getOrderTrackingStages({
    status: currentStatus,
    paymentStatus,
    paymentMethod,
  });

  const queueBadgeText =
    currentStatus === "delivered"
      ? "Delivered"
      : currentStatus === "shipped"
      ? "In Transit"
      : currentStatus === "processing"
      ? "In Packing"
      : currentStatus === "cancelled"
      ? "Cancelled"
      : "Order Received";

  return (
    <section
      aria-labelledby="order-timeline-heading"
      className="rounded-2xl p-5 sm:p-7 flex flex-col gap-6"
      style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-neutral-100)",
        boxShadow: "var(--shadow-card)",
      }}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-neutral-100">
        <div>
          <h2
            id="order-timeline-heading"
            className="text-base sm:text-lg font-bold tracking-tight"
            style={{ color: "var(--color-neutral-900)" }}
          >
            Order Tracking Timeline
          </h2>
          <p className="text-xs text-neutral-500 font-medium mt-0.5">
            Track your order progress from placement to doorstep delivery
          </p>
        </div>

        <div
          className={`flex items-center gap-1.5 self-start sm:self-auto px-3 py-1 rounded-full text-xs font-semibold border ${
            currentStatus === "cancelled"
              ? "bg-red-50 text-red-800 border-red-200"
              : "bg-emerald-50 text-emerald-800 border-emerald-200"
          }`}
        >
          <ClockIcon
            size={13}
            className={currentStatus === "cancelled" ? "text-red-700" : "text-emerald-700"}
          />
          <span>{queueBadgeText}</span>
        </div>
      </div>

      {currentStatus === "cancelled" && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-xs text-red-900 flex items-start gap-2.5">
          <AlertCircleIcon size={18} className="text-red-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-red-950">Order Cancelled</p>
            <p className="text-red-700 mt-0.5 leading-relaxed">
              This order has been cancelled and is no longer progressing through fulfillment.
            </p>
          </div>
        </div>
      )}

      {/* Responsive Timeline Grid / List */}
      <ol className="relative flex flex-col gap-6 sm:gap-7 before:absolute before:left-4 sm:before:left-5 before:top-3 before:bottom-3 before:w-0.5 before:bg-neutral-200">
        {steps.map((step) => {
          const isCompleted = step.status === "completed";
          const isCurrent = step.status === "current";
          const isFailed = step.status === "failed";

          return (
            <li
              key={step.id}
              aria-current={isCurrent ? "step" : undefined}
              className="relative flex items-start gap-4 sm:gap-5 pl-1"
            >
              {/* Timeline Node Badge */}
              <div
                className={`relative z-10 w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center shrink-0 transition-all shadow-sm ${
                  isCompleted
                    ? "bg-[#2A7C13] text-white"
                    : isFailed
                    ? "bg-red-600 text-white ring-4 ring-red-500/25"
                    : isCurrent
                    ? "bg-[#A2CB8B] text-[#202124] ring-4 ring-[#A2CB8B]/25 font-bold"
                    : "bg-neutral-100 text-neutral-400 border border-neutral-200"
                }`}
                aria-label={`Status: ${step.label} (${step.status})`}
              >
                {isCompleted ? (
                  <CheckIcon size={16} className="stroke-[3]" />
                ) : (
                  getTimelineIcon(step.iconType)
                )}
              </div>

              {/* Step Info */}
              <div className="flex flex-col gap-0.5 pt-0.5 sm:pt-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3
                    className={`text-xs sm:text-sm font-bold tracking-tight ${
                      isCurrent
                        ? "text-neutral-900"
                        : isCompleted
                        ? "text-neutral-800"
                        : isFailed
                        ? "text-red-700"
                        : "text-neutral-400"
                    }`}
                  >
                    {step.label}
                  </h3>
                  {step.badge && (
                    <span
                      className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                        isFailed
                          ? "bg-red-100 text-red-800 border border-red-200"
                          : step.badge === "Due on Delivery" || step.badge === "Pending"
                          ? "bg-amber-100 text-amber-900 border border-amber-200"
                          : "bg-secondary text-neutral-900"
                      }`}
                    >
                      {step.badge}
                    </span>
                  )}
                  {isCompleted && (
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                      Completed
                    </span>
                  )}
                </div>
                <p className="text-xs text-neutral-500 leading-relaxed">
                  {step.description}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
