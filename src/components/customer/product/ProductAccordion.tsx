"use client";

import { useState } from "react";
import {
  ChevronDownIcon,
  TruckIcon,
  RotateCcwIcon,
  ShieldCheckIcon,
} from "@/components/customer/Icons";

interface AccordionItem {
  id: string;
  title: string;
  icon: React.ReactNode;
  content: React.ReactNode;
}

/**
 * ProductAccordion — Accessible, collapsible product info sections:
 * - Shipping & Delivery Information
 * - Returns & Replacement Policy
 * - 3D Printing Quality Guarantee & Care
 */
export default function ProductAccordion() {
  const [openItems, setOpenItems] = useState<Record<string, boolean>>({
    shipping: false,
    returns: false,
    quality: false,
  });

  const toggleItem = (id: string) => {
    setOpenItems((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const items: AccordionItem[] = [
    {
      id: "shipping",
      title: "Shipping & Delivery Information",
      icon: <TruckIcon size={18} />,
      content: (
        <div className="space-y-2 text-xs leading-relaxed" style={{ color: "var(--color-neutral-700)" }}>
          <p>
            • Orders are custom printed and dispatched securely from our workshop in India.
          </p>
          <p>
            • Products are safely enclosed in multi-layer shockproof cushioning to protect fine 3D details during transit.
          </p>
          <p>
            • Standard shipping is available across India with tracking updates provided once dispatched.
          </p>
        </div>
      ),
    },
    {
      id: "returns",
      title: "Returns & Replacement Policy",
      icon: <RotateCcwIcon size={18} />,
      content: (
        <div className="space-y-2 text-xs leading-relaxed" style={{ color: "var(--color-neutral-700)" }}>
          <p>
            • <strong>Transit Damage Guarantee:</strong> In the rare event an item arrives damaged, please reach out with unboxing photos for a swift free replacement.
          </p>
          <p>
            • Because each item is 3D printed to order, customized/personalized items cannot be returned for change of mind once production has started.
          </p>
        </div>
      ),
    },
    {
      id: "quality",
      title: "3D Printing & Quality Assurance",
      icon: <ShieldCheckIcon size={18} />,
      content: (
        <div className="space-y-2 text-xs leading-relaxed" style={{ color: "var(--color-neutral-700)" }}>
          <p>
            • Every piece is crafted from durable, non-toxic, plant-based PLA bioplastic filaments.
          </p>
          <p>
            • Fine horizontal layer lines are intrinsic to the FDM 3D printing process and represent authentic additive manufacturing craftsmanship.
          </p>
          <p>
            • <strong>Care Note:</strong> PLA is heat-sensitive; keep prints away from intense heat sources or prolonged direct summer sunlight inside cars (&gt;50°C).
          </p>
        </div>
      ),
    },
  ];

  return (
    <div
      className="rounded-2xl divide-y overflow-hidden w-full"
      style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-neutral-100)",
        boxShadow: "var(--shadow-card)",
        borderColor: "var(--color-neutral-200)",
      }}
    >
      {items.map((item) => {
        const isOpen = openItems[item.id];
        const contentId = `accordion-content-${item.id}`;
        const buttonId = `accordion-button-${item.id}`;

        return (
          <div key={item.id} className="transition-colors">
            <button
              id={buttonId}
              type="button"
              aria-expanded={isOpen}
              aria-controls={contentId}
              onClick={() => toggleItem(item.id)}
              className="w-full flex items-center justify-between p-4 sm:p-5 text-left transition-colors hover:bg-neutral-50 focus:outline-none focus:bg-neutral-50"
            >
              <div className="flex items-center gap-3">
                <span
                  className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                  style={{
                    background: "rgba(162, 203, 139, 0.15)",
                    color: "var(--color-neutral-800)",
                  }}
                >
                  {item.icon}
                </span>
                <span
                  className="text-xs sm:text-sm font-bold tracking-tight"
                  style={{ color: "var(--color-neutral-900)" }}
                >
                  {item.title}
                </span>
              </div>

              <span
                className={`transition-transform duration-200 shrink-0 ml-2 ${
                  isOpen ? "rotate-180" : ""
                }`}
                style={{ color: "var(--color-neutral-500)" }}
              >
                <ChevronDownIcon size={16} />
              </span>
            </button>

            {isOpen && (
              <div
                id={contentId}
                role="region"
                aria-labelledby={buttonId}
                className="px-4 pb-4 sm:px-5 sm:pb-5 pt-1 animate-in fade-in duration-150"
              >
                <div
                  className="p-3.5 rounded-xl border border-neutral-100"
                  style={{ background: "var(--color-canvas)" }}
                >
                  {item.content}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
