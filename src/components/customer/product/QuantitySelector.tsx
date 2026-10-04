"use client";

import { MinusIcon, PlusIcon } from "@/components/customer/Icons";

interface QuantitySelectorProps {
  quantity: number;
  onQuantityChange: (qty: number) => void;
  min?: number;
  max?: number;
  disabled?: boolean;
}

/**
 * QuantitySelector — Accessible, responsive quantity stepper for product pages.
 * Bounds quantity strictly between min (default 1) and max (available stock).
 */
export default function QuantitySelector({
  quantity,
  onQuantityChange,
  min = 1,
  max = 99,
  disabled = false,
}: QuantitySelectorProps) {
  const handleDecrement = () => {
    if (disabled || quantity <= min) return;
    onQuantityChange(quantity - 1);
  };

  const handleIncrement = () => {
    if (disabled || quantity >= max) return;
    onQuantityChange(quantity + 1);
  };

  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor="quantity-input"
        className="text-xs font-bold uppercase tracking-wider"
        style={{ color: "var(--color-neutral-700)" }}
      >
        Quantity
      </label>

      <div
        className="inline-flex items-center rounded-xl p-1 select-none"
        style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-neutral-300)",
          width: "fit-content",
          opacity: disabled ? 0.5 : 1,
        }}
      >
        <button
          type="button"
          onClick={handleDecrement}
          disabled={disabled || quantity <= min}
          aria-label="Decrease quantity"
          className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors disabled:cursor-not-allowed disabled:opacity-40 hover:bg-neutral-100 focus:outline-none focus:ring-2 focus:ring-primary"
          style={{ color: "var(--color-neutral-700)" }}
        >
          <MinusIcon size={14} />
        </button>

        <span
          id="quantity-input"
          aria-live="polite"
          className="w-12 text-center text-sm font-bold"
          style={{ color: "var(--color-neutral-900)" }}
        >
          {disabled ? 0 : quantity}
        </span>

        <button
          type="button"
          onClick={handleIncrement}
          disabled={disabled || quantity >= max}
          aria-label="Increase quantity"
          className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors disabled:cursor-not-allowed disabled:opacity-40 hover:bg-neutral-100 focus:outline-none focus:ring-2 focus:ring-primary"
          style={{ color: "var(--color-neutral-700)" }}
        >
          <PlusIcon size={14} />
        </button>
      </div>

      {max > 0 && max <= 5 && !disabled && (
        <span className="text-[11px] font-medium" style={{ color: "var(--color-error)" }}>
          Only {max} left in stock — order soon!
        </span>
      )}
    </div>
  );
}
