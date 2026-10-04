interface ProductPriceProps {
  price: number;
  compareAtPrice: number | null;
}

/**
 * ProductPrice — Displays clear pricing, compare-at reference price,
 * discount savings percentage badge, and tax inclusion note.
 */
export default function ProductPrice({ price, compareAtPrice }: ProductPriceProps) {
  const hasDiscount = compareAtPrice !== null && compareAtPrice > price;
  const discountPercent = hasDiscount
    ? Math.round(((compareAtPrice! - price) / compareAtPrice!) * 100)
    : 0;
  const savings = hasDiscount ? compareAtPrice! - price : 0;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline flex-wrap gap-2.5">
        {/* Active Price */}
        <span
          className="text-2xl sm:text-3xl font-extrabold tracking-tight"
          style={{ color: "var(--color-neutral-900)" }}
        >
          ₹{price.toLocaleString("en-IN")}
        </span>

        {/* Original Price */}
        {hasDiscount && (
          <span
            className="text-base sm:text-lg line-through font-medium"
            style={{ color: "var(--color-neutral-400)" }}
          >
            ₹{compareAtPrice!.toLocaleString("en-IN")}
          </span>
        )}

        {/* Discount Badge */}
        {hasDiscount && (
          <span
            className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider"
            style={{
              background: "var(--color-secondary)",
              color: "var(--color-neutral-900)",
            }}
          >
            {discountPercent}% OFF
          </span>
        )}
      </div>

      {/* Tax & Savings Subtext */}
      <div className="flex items-center gap-2 text-xs font-medium" style={{ color: "var(--color-neutral-500)" }}>
        <span>Inclusive of all taxes</span>
        {hasDiscount && (
          <>
            <span>•</span>
            <span style={{ color: "var(--color-success)", fontWeight: 600 }}>
              You save ₹{savings.toLocaleString("en-IN")}
            </span>
          </>
        )}
      </div>
    </div>
  );
}
