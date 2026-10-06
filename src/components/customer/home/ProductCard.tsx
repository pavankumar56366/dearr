"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { HeartIcon, CheckIcon } from "@/components/customer/Icons";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";

export interface ProductCardInput {
  id: string;
  name: string;
  slug: string;
  price: number;
  compareAtPrice?: number | null;
  stockQuantity?: number;
  isActive?: boolean;
  isFeatured?: boolean;
  image?: string;
  images?: Array<{ url?: string; storagePath?: string; altText?: string | null } | string>;
  category?: string | { id?: string; name: string; slug?: string } | null;
  [key: string]: any;
}

/**
 * ProductCard — Single 3D printed product card used in storefront grids.
 * Design Ref: docs/4.DESIGN(1) (1).md §5.5 (Cards)
 *
 * Surface: White, Radius: 16px, Shadow: Soft, Padding: 16px
 * Shows: actual product photo, discount badge, out-of-stock state,
 * wishlist toggle, product name, price, original price, Add to Cart.
 */
interface ProductCardProps {
  product: ProductCardInput;
}

export default function ProductCard({ product }: ProductCardProps) {
  const { addItem } = useCart();
  const [isAdded, setIsAdded] = useState(false);

  const rawFirstImage =
    product.images && product.images.length > 0 ? product.images[0] : null;
  const rawImage =
    (typeof rawFirstImage === "string"
      ? rawFirstImage
      : rawFirstImage?.url || rawFirstImage?.storagePath) ||
    product.image ||
    "/product-samples/1.jpeg";
  const displayImage =
    rawImage.startsWith("http") || rawImage.startsWith("/")
      ? rawImage
      : `/${rawImage}`;

  const categoryName =
    typeof product.category === "object" && product.category !== null
      ? product.category.name
      : product.category || "3D Printing";

  const isOutOfStock =
    product.isActive === false || (product.stockQuantity ?? 10) <= 0;

  const compareAt =
    product.compareAtPrice !== null && product.compareAtPrice !== undefined
      ? Number(product.compareAtPrice)
      : null;
  const currentPrice = Number(product.price);

  const hasDiscount = compareAt !== null && compareAt > currentPrice;
  const discountPercent = hasDiscount
    ? Math.round(((compareAt - currentPrice) / compareAt) * 100)
    : null;

  const { isLoggedIn } = useAuth();
  const router = useRouter();
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [isWishlistLoading, setIsWishlistLoading] = useState(false);

  const handleWishlistClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!isLoggedIn) {
      router.push(`/login?redirect=${encodeURIComponent(`/product/${product.slug}`)}`);
      return;
    }

    if (isWishlistLoading) return;
    setIsWishlistLoading(true);

    const nextState = !isWishlisted;
    setIsWishlisted(nextState);

    try {
      if (nextState) {
        await fetch("/api/wishlist/items", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ productId: product.id }),
        });
      } else {
        await fetch(`/api/wishlist/items/${product.id}`, {
          method: "DELETE",
          credentials: "same-origin",
        });
      }
    } catch {
      setIsWishlisted(!nextState);
    } finally {
      setIsWishlistLoading(false);
    }
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
      {/* Image Area */}
      <div
        className="relative aspect-square w-full overflow-hidden bg-[#f4f7f2]"
      >
        <Image
          src={displayImage}
          alt={product.name}
          fill
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          className={`object-cover transition-transform duration-300 group-hover:scale-105 ${
            isOutOfStock ? "opacity-75 grayscale-30" : ""
          }`}
          priority={false}
        />

        {/* Badges Overlay */}
        <div className="absolute top-2.5 left-2.5 flex flex-col gap-1.5 z-10">
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

        {/* Wishlist Button */}
        <button
          type="button"
          onClick={handleWishlistClick}
          className="absolute top-2.5 right-2.5 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 z-10 opacity-90 sm:opacity-0 sm:group-hover:opacity-100 hover:scale-110 shadow-sm cursor-pointer"
          style={{
            background: isWishlisted ? "rgba(255,255,255,0.98)" : "rgba(255,255,255,0.92)",
            backdropFilter: "blur(4px)",
          }}
          aria-label={isWishlisted ? `Remove ${product.name} from wishlist` : `Add ${product.name} to wishlist`}
        >
          <HeartIcon
            size={16}
            style={{ color: isWishlisted ? "#C00707" : "var(--color-neutral-500)" }}
            fill={isWishlisted ? "#C00707" : "none"}
            stroke={isWishlisted ? "#C00707" : "currentColor"}
          />
        </button>
      </div>

      {/* Product Info */}
      <div className="flex flex-col gap-1.5 p-3.5 sm:p-4 flex-1">
        {/* Category */}
        <span
          className="text-[11px] font-semibold uppercase tracking-wider"
          style={{ color: "var(--color-neutral-500)" }}
        >
          {categoryName}
        </span>

        {/* Product Name */}
        <Link
          href={`/product/${product.slug}`}
          className="text-sm sm:text-[15px] font-bold leading-snug hover:underline line-clamp-2"
          style={{ color: "var(--color-neutral-900)" }}
        >
          {product.name}
        </Link>


        {/* Price */}
        <div className="flex items-baseline gap-2 mt-auto pt-2">
          <span
            className="text-base sm:text-lg font-bold"
            style={{ color: "var(--color-neutral-900)" }}
          >
            ₹{currentPrice.toLocaleString("en-IN")}
          </span>
          {hasDiscount && (
            <span
              className="text-xs line-through"
              style={{ color: "var(--color-neutral-500)" }}
            >
              ₹{compareAt!.toLocaleString("en-IN")}
            </span>
          )}
        </div>

        {/* Add to Cart / Out of Stock Button */}
        <button
          type="button"
          disabled={isOutOfStock}
          onClick={() => {
            if (isOutOfStock) return;
            addItem(
              {
                ...product,
                price: currentPrice,
                compareAtPrice: compareAt,
                image: displayImage,
                category: categoryName,
                stockQuantity: product.stockQuantity ?? 10,
                isActive: !isOutOfStock,
              } as any,
              1
            );
            setIsAdded(true);
            setTimeout(() => setIsAdded(false), 2000);
          }}
          className={`btn-base w-full mt-2.5 text-xs sm:text-sm font-semibold transition-all flex items-center justify-center gap-1.5 ${
            isOutOfStock
              ? "cursor-not-allowed opacity-60"
              : isAdded
              ? "text-white"
              : "btn-primary hover:opacity-95"
          }`}
          style={{
            height: "40px",
            borderRadius: "10px",
            ...(isOutOfStock
              ? {
                  background: "var(--color-neutral-200)",
                  color: "var(--color-neutral-600)",
                  border: "1px solid var(--color-neutral-300)",
                }
              : isAdded
              ? {
                  background: "var(--color-success)",
                  color: "#FFFFFF",
                }
              : {}),
          }}
        >
          {isAdded ? (
            <>
              <CheckIcon size={14} />
              <span>Added!</span>
            </>
          ) : isOutOfStock ? (
            "Out of Stock"
          ) : (
            "Add to Cart"
          )}
        </button>
      </div>
    </article>
  );
}
