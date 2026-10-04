"use client";

import Link from "next/link";
import Image from "next/image";
import type { CartItem } from "@/context/CartContext";
import { MinusIcon, PlusIcon, CloseIcon } from "@/components/customer/Icons";

interface CartItemRowProps {
  item: CartItem;
  onUpdateQuantity: (itemId: string, newQuantity: number) => void;
  onRemove: (itemId: string) => void;
}

/**
 * CartItemRow — Renders a single 3D printed product row inside the shopping cart.
 * Displays photo, name, category, variant, unit price, quantity stepper,
 * line total, and accessible remove button.
 */
export default function CartItemRow({
  item,
  onUpdateQuantity,
  onRemove,
}: CartItemRowProps) {
  const isOutOfStock = !item.isActive || item.stockQuantity <= 0;
  const lineTotal = item.price * item.quantity;

  const handleDecrement = () => {
    if (isOutOfStock || item.quantity <= 1) return;
    onUpdateQuantity(item.id, item.quantity - 1);
  };

  const handleIncrement = () => {
    if (isOutOfStock || item.quantity >= item.stockQuantity) return;
    onUpdateQuantity(item.id, item.quantity + 1);
  };

  return (
    <article
      className="p-4 sm:p-5 rounded-2xl transition-all duration-200"
      style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-neutral-100)",
        boxShadow: "var(--shadow-card)",
      }}
    >
      <div className="flex gap-3.5 sm:gap-5 items-start">
        {/* Product Thumbnail */}
        <Link
          href={`/product/${item.slug}`}
          className="relative w-20 h-20 sm:w-24 sm:h-24 shrink-0 rounded-xl overflow-hidden bg-[#f4f7f2] border border-neutral-200/80 focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <Image
            src={item.image}
            alt={`${item.name} — Precision 3D Printed`}
            fill
            sizes="96px"
            className={`object-cover ${isOutOfStock ? "opacity-75 grayscale-30" : ""}`}
          />
        </Link>

        {/* Product Details & Controls */}
        <div className="flex-1 flex flex-col justify-between min-h-[80px] sm:min-h-[96px] min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex flex-col gap-0.5 min-w-0">
              {/* Category */}
              <span
                className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider truncate"
                style={{ color: "var(--color-neutral-500)" }}
              >
                {item.category}
              </span>

              {/* Product Title */}
              <Link
                href={`/product/${item.slug}`}
                className="text-xs sm:text-sm font-bold leading-snug hover:underline line-clamp-2"
                style={{ color: "var(--color-neutral-900)" }}
              >
                {item.name}
              </Link>

              {/* Selected Variant */}
              {item.variantName && (
                <span
                  className="text-[11px] font-medium"
                  style={{ color: "var(--color-neutral-600)" }}
                >
                  Option: <span className="font-semibold">{item.variantName}</span>
                </span>
              )}

              {/* Out of Stock Warning */}
              {isOutOfStock && (
                <span
                  className="inline-flex items-center gap-1 mt-1 text-[11px] font-bold"
                  style={{ color: "var(--color-error)" }}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-error" />
                  Out of Stock — Please remove to checkout
                </span>
              )}
            </div>

            {/* Remove Action Button */}
            <button
              type="button"
              onClick={() => onRemove(item.id)}
              aria-label={`Remove ${item.name} from cart`}
              className="p-1.5 rounded-lg text-neutral-400 hover:text-red-600 hover:bg-red-50 transition-colors focus:outline-none focus:ring-2 focus:ring-error"
            >
              <CloseIcon size={16} />
            </button>
          </div>

          {/* Bottom Row: Stepper + Line Total */}
          <div className="flex items-center justify-between gap-3 pt-3 mt-1 border-t border-neutral-100 flex-wrap">
            {/* Quantity Stepper */}
            <div
              className="inline-flex items-center rounded-lg p-0.5 select-none"
              style={{
                background: "var(--color-neutral-100)",
                opacity: isOutOfStock ? 0.5 : 1,
              }}
            >
              <button
                type="button"
                onClick={handleDecrement}
                disabled={isOutOfStock || item.quantity <= 1}
                aria-label={`Decrease quantity of ${item.name}`}
                className="w-7 h-7 rounded-md flex items-center justify-center transition-colors disabled:cursor-not-allowed disabled:opacity-40 hover:bg-white focus:outline-none focus:ring-1 focus:ring-primary"
                style={{ color: "var(--color-neutral-700)" }}
              >
                <MinusIcon size={12} />
              </button>

              <span
                aria-live="polite"
                aria-label={`Quantity: ${item.quantity}`}
                className="w-9 text-center text-xs font-bold"
                style={{ color: "var(--color-neutral-900)" }}
              >
                {item.quantity}
              </span>

              <button
                type="button"
                onClick={handleIncrement}
                disabled={isOutOfStock || item.quantity >= item.stockQuantity}
                aria-label={`Increase quantity of ${item.name}`}
                className="w-7 h-7 rounded-md flex items-center justify-center transition-colors disabled:cursor-not-allowed disabled:opacity-40 hover:bg-white focus:outline-none focus:ring-1 focus:ring-primary"
                style={{ color: "var(--color-neutral-700)" }}
              >
                <PlusIcon size={12} />
              </button>
            </div>

            {/* Price Calculations */}
            <div className="flex items-baseline gap-2">
              <span className="text-[11px] font-medium text-neutral-400">
                ₹{item.price.toLocaleString("en-IN")} each
              </span>
              <span
                className="text-sm sm:text-base font-extrabold"
                style={{ color: "var(--color-neutral-900)" }}
              >
                ₹{lineTotal.toLocaleString("en-IN")}
              </span>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
