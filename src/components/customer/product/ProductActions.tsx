"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { CartIcon, HeartIcon, CheckIcon } from "@/components/customer/Icons";
import { useAuth } from "@/context/AuthContext";

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
 * - Wishlist toggle (Local state or real MySQL API when authenticated)
 * - Includes toast / local confirmation state
 * - Includes mobile sticky bar (Design Rule §6.5)
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
  const { isLoggedIn, isLoading: isAuthLoading } = useAuth();

  const [isWishlisted, setIsWishlisted] = useState(false);
  const [isWishlistLoading, setIsWishlistLoading] = useState(false);
  const [cartSuccess, setCartSuccess] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  useEffect(() => {
    let isMounted = true;
    if (productId && isLoggedIn && !isAuthLoading) {
      fetch("/api/wishlist", {
        method: "GET",
        headers: { "Cache-Control": "no-cache" },
        credentials: "same-origin",
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (!isMounted || !data || !data.wishlist) return;
          const exists = (data.wishlist.items || []).some(
            (item: any) => item.productId === productId || item.product?.id === productId
          );
          setIsWishlisted(exists);
        })
        .catch(() => {});
    }
    return () => {
      isMounted = false;
    };
  }, [productId, isLoggedIn, isAuthLoading]);

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
      const nextState = !isWishlisted;
      setIsWishlisted(nextState);
      showToast(
        nextState
          ? `Saved "${productName}" to your wishlist!`
          : `Removed "${productName}" from your wishlist`
      );
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

    if (!isWishlisted) {
      setIsWishlisted(true);
      showToast(`Saved "${productName}" to your wishlist!`);
      try {
        const res = await fetch("/api/wishlist/items", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ productId }),
        });
        if (!res.ok) {
          setIsWishlisted(false);
          const data = await res.json().catch(() => null);
          showToast(data?.error || "Could not save to wishlist. Please try again.");
        }
      } catch {
        setIsWishlisted(false);
        showToast("Network error. Could not save to wishlist.");
      } finally {
        setIsWishlistLoading(false);
      }
    } else {
      setIsWishlisted(false);
      showToast(`Removed "${productName}" from your wishlist`);
      try {
        const res = await fetch(`/api/wishlist/items/${productId}`, {
          method: "DELETE",
          credentials: "same-origin",
        });
        if (!res.ok) {
          setIsWishlisted(true);
          const data = await res.json().catch(() => null);
          showToast(data?.error || "Could not remove from wishlist. Please try again.");
        }
      } catch {
        setIsWishlisted(true);
        showToast("Network error. Could not remove from wishlist.");
      } finally {
        setIsWishlistLoading(false);
      }
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

      {/* Mobile Sticky Action Bar (Design Rule §6.5) */}
      <div
        className="fixed bottom-[calc(76px+env(safe-area-inset-bottom,0px))] left-3 right-3 z-40 md:hidden max-w-md mx-auto p-2.5 rounded-2xl backdrop-blur-md shadow-modal border transition-transform duration-200"
        style={{
          background: "rgba(255, 255, 255, 0.96)",
          borderColor: "var(--color-neutral-200)",
        }}
      >
        <div className="flex items-center justify-between gap-3">
          {/* Price Preview */}
          <div className="flex flex-col">
            <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
              Total
            </span>
            <span
              className="text-lg font-black tracking-tight"
              style={{ color: "var(--color-neutral-900)" }}
            >
              ₹{price.toLocaleString("en-IN")}
            </span>
          </div>

          {/* Quick Add to Cart CTA */}
          <button
            type="button"
            disabled={isOutOfStock}
            onClick={handleAddToCart}
            className="flex-1 flex items-center justify-center gap-2 h-11 px-4 rounded-xl font-bold text-xs tracking-wider uppercase transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm active:scale-95"
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
                <CheckIcon size={16} />
                <span>Added!</span>
              </>
            ) : isOutOfStock ? (
              <span>Out of Stock</span>
            ) : (
              <>
                <CartIcon size={16} />
                <span>Add to Cart</span>
              </>
            )}
          </button>

          {/* Mobile Wishlist Quick Icon */}
          <button
            type="button"
            onClick={handleWishlistToggle}
            aria-label={isWishlisted ? "Remove from wishlist" : "Save to wishlist"}
            className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border"
            style={{
              borderColor: isWishlisted ? "#C00707" : "var(--color-neutral-300)",
              background: isWishlisted ? "rgba(192, 7, 7, 0.08)" : "var(--color-surface)",
              color: isWishlisted ? "#C00707" : "var(--color-neutral-700)",
            }}
          >
            <HeartIcon
              size={18}
              fill={isWishlisted ? "#C00707" : "none"}
              stroke={isWishlisted ? "#C00707" : "currentColor"}
            />
          </button>
        </div>
      </div>
    </>
  );
}
