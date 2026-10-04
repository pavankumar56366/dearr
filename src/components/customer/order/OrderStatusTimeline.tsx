import React from "react";
import { CheckIcon, ClockIcon, PackageIcon, PrinterIcon, ShieldCheckIcon, TruckIcon } from "@/components/customer/Icons";

interface TimelineStep {
  id: string;
  label: string;
  description: string;
  status: "completed" | "current" | "upcoming";
  icon: React.ReactNode;
}

interface OrderStatusTimelineProps {
  currentStatus?: string;
}

export default function OrderStatusTimeline({ currentStatus = "confirmed" }: OrderStatusTimelineProps) {
  const steps: TimelineStep[] = [
    {
      id: "received",
      label: "Order Received",
      description: "Order registered and logged in workshop queue",
      status: "completed",
      icon: <CheckIcon size={16} className="stroke-[3]" />,
    },
    {
      id: "payment",
      label: "Payment Verified",
      description: "Prepaid online confirmation verified (Demo simulation)",
      status: "completed",
      icon: <CheckIcon size={16} className="stroke-[3]" />,
    },
    {
      id: "preparation",
      label: "3D Print Preparation",
      description: "Model slicing, bed leveling & filament staging",
      status: "current",
      icon: <PrinterIcon size={16} />,
    },
    {
      id: "qc",
      label: "Quality Inspection",
      description: "Layer-by-layer optical inspection & structural tolerance check",
      status: "upcoming",
      icon: <ShieldCheckIcon size={16} />,
    },
    {
      id: "dispatch",
      label: "Packed & Dispatched",
      description: "Secure protective shockproof boxing & courier handover",
      status: "upcoming",
      icon: <TruckIcon size={16} />,
    },
    {
      id: "delivered",
      label: "Delivered",
      description: "Arrives at your delivery address",
      status: "upcoming",
      icon: <PackageIcon size={16} />,
    },
  ];

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
            Fulfillment & 3D Print Production Timeline
          </h2>
          <p className="text-xs text-neutral-500 font-medium mt-0.5">
            Track how Dearr transforms your 3D models from CAD slices to physical prints
          </p>
        </div>

        <div className="flex items-center gap-1.5 self-start sm:self-auto px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-semibold">
          <ClockIcon size={13} className="text-emerald-700" />
          <span>In Production Queue</span>
        </div>
      </div>

      {/* Responsive Timeline Grid / List */}
      <ol className="relative flex flex-col gap-6 sm:gap-7 before:absolute before:left-4 sm:before:left-5 before:top-3 before:bottom-3 before:w-0.5 before:bg-neutral-200">
        {steps.map((step, idx) => {
          const isCompleted = step.status === "completed";
          const isCurrent = step.status === "current";

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
                    : isCurrent
                    ? "bg-[#A2CB8B] text-[#202124] ring-4 ring-[#A2CB8B]/25 font-bold"
                    : "bg-neutral-100 text-neutral-400 border border-neutral-200"
                }`}
                aria-label={`Status: ${step.label} (${step.status})`}
              >
                {step.icon}
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
                        : "text-neutral-400"
                    }`}
                  >
                    {step.label}
                  </h3>
                  {isCurrent && (
                    <span
                      className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full"
                      style={{ background: "var(--color-secondary)", color: "var(--color-neutral-900)" }}
                    >
                      Active Stage
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
