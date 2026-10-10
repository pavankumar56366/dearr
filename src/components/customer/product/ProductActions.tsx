"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CartIcon, HeartIcon, CheckIcon } from "@/components/customer/Icons";
import { useAuth } from "@/context/AuthContext";
import { useWishlist } from "@/context/WishlistContext";

interface ProductActionsProps {
  productId?: string;
  productSlug?: string;
  productName: string;
  price: number;
  isOutOfStock?: boolean;
  hasVariants?: boolean;
  selectedVariantId?: string;
  onAddToCart?: () => void;
  onBuyNow?: () => void;
}

/**
 * ProductActions — Action buttons for product details:
 * - Add to Cart (Primary action)
 * - Buy Now (Secondary action)
 * - Wishlist toggle (Reactive WishlistContext synced to MySQL API)
 * - Includes toast / local confirmation state
 */
export default function ProductActions({
  productId,
  productSlug,
  productName,
  price,
  isOutOfStock = false,
  hasVariants = false,
  selectedVariantId,
  onAddToCart,
  onBuyNow,
}: ProductActionsProps) {
  const router = useRouter();
  const { isLoggedIn } = useAuth();
  const { isWishlisted: checkIsWishlisted, toggleWishlist } = useWishlist();

  const isWishlisted = productId ? checkIsWishlisted(productId) : false;
  const [isWishlistLoading, setIsWishlistLoading] = useState(false);
  const [cartSuccess, setCartSuccess] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  const handleAddToCart = () => {
    if (isOutOfStock) return;
    if (hasVariants && !selectedVariantId) {
      showToast("Please select a variant option first");
      return;
    }

    setCartSuccess(true);
    showToast(`Added "${productName}" to your cart!`);
    onAddToCart?.();

    setTimeout(() => {
      setCartSuccess(false);
    }, 2000);
  };

  const handleBuyNow = () => {
    if (isOutOfStock) return;
    if (hasVariants && !selectedVariantId) {
      showToast("Please select a variant option first");
      return;
    }

    if (onBuyNow) {
      onBuyNow();
    } else {
      onAddToCart?.();
      router.push(isLoggedIn ? "/checkout" : "/login?redirect=/checkout");
    }
  };

  const handleWishlistToggle = async () => {
    if (!productId) {
      showToast("Unable to update wishlist for this item.");
      return;
    }

    if (!isLoggedIn) {
      showToast("Please sign in to save items to your wishlist");
      const redirect = productSlug ? `/product/${productSlug}` : "/wishlist";
      router.push(`/login?redirect=${encodeURIComponent(redirect)}`);
      return;
    }

    if (isWishlistLoading) return;
    setIsWishlistLoading(true);

    try {
      const willBeInWishlist = !isWishlisted;
      await toggleWishlist(productId);
      showToast(
        willBeInWishlist
          ? `Saved "${productName}" to your wishlist!`
          : `Removed "${productName}" from your wishlist`
      );
    } catch {
      showToast("Network error. Could not update wishlist.");
    } finally {
      setIsWishlistLoading(false);
    }
  };

  return (
    <>
      {/* Toast Notification */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-[calc(6rem+env(safe-area-inset-bottom,0px))] left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 px-4 py-2.5 rounded-full shadow-lg text-xs font-semibold animate-in fade-in slide-in-from-bottom-3 duration-200"
          style={{
            background: "var(--color-neutral-900)",
            color: "#FFFFFF",
            maxWidth: "90vw",
          }}
        >
          <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
          <span className="truncate">{toastMessage}</span>
        </div>
      )}

      {/* Desktop / In-Page Actions */}
      <div className="flex flex-col gap-3 pt-2">
        <div className="flex items-center gap-3">
          {/* Add to Cart Button */}
          <button
            type="button"
            disabled={isOutOfStock}
            onClick={handleAddToCart}
            className="flex-1 flex items-center justify-center gap-2 h-12 px-6 rounded-xl font-bold text-sm tracking-wide transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-md active:scale-[0.98]"
            style={{
              background: cartSuccess
                ? "var(--color-success)"
                : isOutOfStock
                ? "var(--color-neutral-300)"
                : "var(--color-primary)",
              color: cartSuccess ? "#FFFFFF" : "var(--color-neutral-900)",
            }}
          >
            {cartSuccess ? (
              <>
                <CheckIcon size={18} />
                <span>Added to Cart!</span>
              </>
            ) : isOutOfStock ? (
              <span>Out of Stock</span>
            ) : (
              <>
                <CartIcon size={18} />
                <span>Add to Cart</span>
              </>
            )}
          </button>

          {/* Wishlist Button */}
          <button
            type="button"
            onClick={handleWishlistToggle}
            aria-label={isWishlisted ? "Remove from wishlist" : "Save to wishlist"}
            className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-all duration-200 hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-primary"
            style={{
              background: isWishlisted
                ? "rgba(192, 7, 7, 0.08)"
                : "var(--color-surface)",
              border: isWishlisted
                ? "1px solid rgba(192, 7, 7, 0.2)"
                : "1px solid var(--color-neutral-300)",
              color: isWishlisted ? "#C00707" : "var(--color-neutral-700)",
            }}
          >
            <HeartIcon
              size={20}
              fill={isWishlisted ? "#C00707" : "none"}
              stroke={isWishlisted ? "#C00707" : "currentColor"}
            />
          </button>
        </div>

        {/* Buy Now Button */}
        {!isOutOfStock && (
          <button
            type="button"
            onClick={handleBuyNow}
            className="w-full flex items-center justify-center h-12 px-6 rounded-xl font-bold text-sm tracking-wide transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary hover:bg-neutral-100 active:scale-[0.98]"
            style={{
              background: "var(--color-surface)",
              border: "2px solid var(--color-primary)",
              color: "var(--color-neutral-900)",
            }}
          >
            Buy Now
          </button>
        )}
      </div>
    </>
  );
}
