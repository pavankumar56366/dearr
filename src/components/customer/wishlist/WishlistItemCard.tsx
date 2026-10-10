"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import type { SampleProduct } from "@/data/sample-products";
import { CartIcon, CloseIcon, CheckIcon } from "@/components/customer/Icons";
import { normalizeImageUrl, isUploadPath } from "@/lib/product-image";

interface WishlistItemCardProps {
  product: SampleProduct;
  onRemove: (productId: string) => void;
  onAddToCart: (product: SampleProduct) => void;
}

/**
 * WishlistItemCard — Single saved 3D printing product card for the Wishlist page.
 * Design Ref: docs/4.DESIGN(1) (1).md §6.6 (Wishlist Card)
 *
 * Provides:
 * - Product image (aspect-square with zoom transition)
 * - Remove wishlist button (accessible top-right control)
 * - Category badge & Product title linking to /product/[slug]
 * - Current price & compare-at price
 * - Add to Cart action with local confirmation state
 * - Out-of-stock state handling
 */
export default function WishlistItemCard({
  product,
  onRemove,
  onAddToCart,
}: WishlistItemCardProps) {
  const [isAdded, setIsAdded] = useState(false);

  const isOutOfStock = !product.isActive || product.stockQuantity <= 0;
  const hasDiscount =
    product.compareAtPrice !== null && product.compareAtPrice > product.price;
  const discountPercent = hasDiscount
    ? Math.round(
        ((product.compareAtPrice! - product.price) / product.compareAtPrice!) * 100
      )
    : null;

  const handleAddToCart = () => {
    if (isOutOfStock) return;
    setIsAdded(true);
    onAddToCart(product);
    setTimeout(() => {
      setIsAdded(false);
    }, 2000);
  };

  return (
    <article
      className="group relative flex flex-col rounded-2xl overflow-hidden transition-all duration-200 hover:shadow-lg"
      style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-neutral-100)",
        boxShadow: "var(--shadow-card)",
      }}
    >
      {/* Product Image Container */}
      <div className="relative aspect-square w-full overflow-hidden bg-[#f4f7f2]">
        <Link href={`/product/${product.slug}`} className="block w-full h-full">
          <Image
            src={normalizeImageUrl(product.image)}
            alt={`${product.name} — Precision 3D Printed`}
            fill
            unoptimized={isUploadPath(product.image)}
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className={`object-cover transition-transform duration-300 group-hover:scale-105 ${
              isOutOfStock ? "opacity-75 grayscale-30" : ""
            }`}
          />
        </Link>

        {/* Badges Overlay */}
        <div className="absolute top-2.5 left-2.5 flex flex-col gap-1.5 z-10 pointer-events-none">
          {isOutOfStock ? (
            <span
              className="inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider shadow-sm"
              style={{
                background: "#E53E3E",
                color: "#FFFFFF",
              }}
            >
              Out of Stock
            </span>
          ) : (
            <>
              {hasDiscount && (
                <span
                  className="inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider shadow-sm"
                  style={{
                    background: "var(--color-secondary)",
                    color: "var(--color-neutral-900)",
                  }}
                >
                  {discountPercent}% Off
                </span>
              )}
              {product.isFeatured && (
                <span
                  className="inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider shadow-sm"
                  style={{
                    background: "var(--color-primary)",
                    color: "var(--color-neutral-900)",
                  }}
                >
                  Featured
                </span>
              )}
            </>
          )}
        </div>

        {/* Remove Wishlist Button */}
        <button
          type="button"
          onClick={() => onRemove(product.id)}
          aria-label={`Remove ${product.name} from wishlist`}
          className="absolute top-2.5 right-2.5 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 z-10 shadow-sm hover:scale-110 active:scale-95 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-error"
          style={{
            background: "rgba(255, 255, 255, 0.92)",
            color: "var(--color-neutral-600)",
          }}
        >
          <CloseIcon size={14} className="hover:text-red-600 transition-colors" />
        </button>
      </div>

      {/* Content Area */}
      <div className="flex flex-col gap-1.5 p-3.5 sm:p-4 flex-1">
        {/* Category */}
        <span
          className="text-[11px] font-semibold uppercase tracking-wider"
          style={{ color: "var(--color-neutral-500)" }}
        >
          {product.category}
        </span>

        {/* Product Title */}
        <Link
          href={`/product/${product.slug}`}
          className="text-xs sm:text-sm font-bold leading-snug hover:underline line-clamp-2"
          style={{ color: "var(--color-neutral-900)" }}
        >
          {product.name}
        </Link>

        {/* Price Row */}
        <div className="flex items-baseline gap-2 mt-auto pt-2">
          <span
            className="text-sm sm:text-base font-bold"
            style={{ color: "var(--color-neutral-900)" }}
          >
            ₹{product.price.toLocaleString("en-IN")}
          </span>
          {hasDiscount && (
            <span
              className="text-xs line-through"
              style={{ color: "var(--color-neutral-400)" }}
            >
              ₹{product.compareAtPrice!.toLocaleString("en-IN")}
            </span>
          )}
        </div>

        {/* Action Button: Add to Cart / Out of Stock */}
        <button
          type="button"
          disabled={isOutOfStock}
          onClick={handleAddToCart}
          aria-label={
            isOutOfStock
              ? `${product.name} is out of stock`
              : `Add ${product.name} to cart`
          }
          className="w-full mt-2 flex items-center justify-center gap-1.5 h-9 sm:h-10 rounded-xl font-bold text-xs uppercase tracking-wider transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed active:scale-98 shadow-xs"
          style={{
            background: isAdded
              ? "var(--color-success)"
              : isOutOfStock
              ? "var(--color-neutral-200)"
              : "var(--color-primary)",
            color: isAdded
              ? "#FFFFFF"
              : isOutOfStock
              ? "var(--color-neutral-500)"
              : "var(--color-neutral-900)",
          }}
        >
          {isAdded ? (
            <>
              <CheckIcon size={14} />
              <span>Added!</span>
            </>
          ) : isOutOfStock ? (
            <span>Out of Stock</span>
          ) : (
            <>
              <CartIcon size={14} />
              <span>Add to Cart</span>
            </>
          )}
        </button>
      </div>
    </article>
  );
}
