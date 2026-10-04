"use client";

export interface ProductVariantItem {
  id: string;
  name: string;
  sku?: string;
  price?: number | null;
  stockQuantity: number;
  isActive?: boolean;
}

interface ProductVariantsProps {
  variants?: ProductVariantItem[];
  selectedVariantId?: string;
  onSelectVariant: (variantId: string) => void;
  disabled?: boolean;
}

/**
 * ProductVariants — Reusable variant selector component.
 * Architecture matches MySQL schema: product_variants (id, name, sku, price, stock_quantity, is_active).
 *
 * NOTE: If no variants are provided or variants list is empty,
 * this component renders null cleanly without inventing live-looking fake options.
 */
export default function ProductVariants({
  variants,
  selectedVariantId,
  onSelectVariant,
  disabled = false,
}: ProductVariantsProps) {
  // If product does not have variants defined, render nothing
  if (!variants || variants.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2.5">
      <label
        className="text-xs font-bold uppercase tracking-wider"
        style={{ color: "var(--color-neutral-700)" }}
      >
        Select Option
      </label>

      <div
        className="flex flex-wrap gap-2"
        role="radiogroup"
        aria-label="Product options"
      >
        {variants.map((v) => {
          const isSelected = selectedVariantId === v.id;
          const isAvailable = v.isActive && v.stockQuantity > 0;

          return (
            <button
              key={v.id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              disabled={disabled || !v.isActive}
              onClick={() => onSelectVariant(v.id)}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold transition-all duration-150 focus:outline-none cursor-pointer disabled:cursor-not-allowed"
              style={{
                background: isSelected
                  ? "rgba(162, 203, 139, 0.18)"
                  : "var(--color-surface)",
                border: isSelected
                  ? "2px solid var(--color-primary)"
                  : "1px solid var(--color-neutral-300)",
                color: isSelected
                  ? "var(--color-neutral-900)"
                  : isAvailable
                  ? "var(--color-neutral-700)"
                  : "var(--color-neutral-400)",
                opacity: v.isActive ? 1 : 0.6,
                boxShadow: isSelected
                  ? "0 0 0 2px rgba(162, 203, 139, 0.2)"
                  : "none",
              }}
            >
              <span>{v.name}</span>
              {!isAvailable && (
                <span className="ml-1.5 text-[10px] text-neutral-400 font-normal">
                  (Out of Stock)
                </span>
              )}
              {v.price && (
                <span className="ml-1.5 opacity-80">
                  (₹{v.price.toLocaleString("en-IN")})
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
