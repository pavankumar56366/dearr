"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { SampleProduct } from "@/data/sample-products";
import { ChevronRightIcon } from "@/components/customer/Icons";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import { getProductPrimaryImage } from "@/lib/product-image";

import WishlistItemCard from "./WishlistItemCard";
import WishlistEmptyState from "./WishlistEmptyState";

export default function WishlistPageClient() {
  const router = useRouter();
  const { addItem } = useCart();
  const { isLoggedIn, isLoading: isAuthLoading } = useAuth();

  const [wishlistItems, setWishlistItems] = useState<SampleProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  }, []);

  const loadWishlist = useCallback(async () => {
    if (isAuthLoading) return;

    if (!isLoggedIn) {
      router.replace("/login?redirect=/wishlist");
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/wishlist", {
        method: "GET",
        headers: { "Cache-Control": "no-cache" },
        credentials: "same-origin",
      });

      if (res.status === 401) {
        router.replace("/login?redirect=/wishlist");
        return;
      }

      const data = await res.json();
      if (res.ok && data.ok && data.wishlist) {
        const mappedProducts: SampleProduct[] = (data.wishlist.items || []).map(
          (item: any) => ({
            id: item.product.id,
            name: item.product.name,
            slug: item.product.slug,
            description: item.product.description || "",
            price: Number(item.product.price),
            compareAtPrice:
              item.product.compareAtPrice !== null && item.product.compareAtPrice !== undefined
                ? Number(item.product.compareAtPrice)
                : null,
            image: getProductPrimaryImage(item.product),
            category: item.product.category || "3D Printing",
            categorySlug: item.product.categorySlug || "3d-printing",
            isFeatured: Boolean(item.product.isFeatured),
            isActive: Boolean(item.product.isActive),
            stockQuantity: Number(item.product.stockQuantity || 0),
          })
        );
        setWishlistItems(mappedProducts);
      } else {
        setErrorMessage(data.error || "Failed to load wishlist");
      }
    } catch {
      setErrorMessage("Network error: Unable to load wishlist. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [isAuthLoading, isLoggedIn, router]);

  useEffect(() => {
    loadWishlist();
  }, [loadWishlist]);

  const handleRemove = async (productId: string) => {
    const itemToRemove = wishlistItems.find((p) => p.id === productId);
    setWishlistItems((prev) => prev.filter((p) => p.id !== productId));
    if (itemToRemove) {
      showToast(`Removed "${itemToRemove.name}" from your wishlist`);
    }

    try {
      const res = await fetch(`/api/wishlist/items/${productId}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        showToast(data?.error || "Could not remove item. Please try again.");
        loadWishlist();
      }
    } catch {
      showToast("Network error. Could not remove item.");
      loadWishlist();
    }
  };

  const handleAddToCart = (product: SampleProduct) => {
    addItem(product, 1);
    showToast(`Added "${product.name}" to your cart!`);
  };

  const handleClearAll = async () => {
    if (wishlistItems.length === 0) return;
    const previous = [...wishlistItems];
    setWishlistItems([]);
    showToast("Cleared all items from your wishlist");

    try {
      const res = await fetch("/api/wishlist", {
        method: "DELETE",
        credentials: "same-origin",
      });
      if (!res.ok) {
        setWishlistItems(previous);
        showToast("Could not clear wishlist. Please try again.");
      }
    } catch {
      setWishlistItems(previous);
      showToast("Network error. Could not clear wishlist.");
    }
  };

  return (
    <div
      className="min-h-screen pb-32 md:pb-20"
      style={{ background: "var(--color-canvas)" }}
    >
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

      {/* Breadcrumb Navigation */}
      <nav
        aria-label="Breadcrumb"
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-2"
      >
        <ol className="flex items-center gap-1.5 text-xs font-medium text-neutral-500">
          <li>
            <Link
              href="/"
              className="inline-flex items-center py-2 px-1 -my-2 -mx-0.5 rounded-sm hover:underline transition-colors hover:text-neutral-900 focus-visible:outline-2 focus-visible:outline-primary"
            >
              Home
            </Link>
          </li>
          <li aria-hidden="true" className="text-neutral-400">
            <ChevronRightIcon size={12} />
          </li>
          <li
            aria-current="page"
            className="font-bold"
            style={{ color: "var(--color-neutral-800)" }}
          >
            Wishlist
          </li>
        </ol>
      </nav>

      {/* Main Wishlist Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-2 sm:pt-4">
        {errorMessage && (
          <div
            role="alert"
            className="mb-6 p-4 rounded-xl flex items-center justify-between text-xs font-semibold"
            style={{
              background: "#FEE2E2",
              color: "#991B1B",
              border: "1px solid #FCA5A5",
            }}
          >
            <span>{errorMessage}</span>
            <button
              type="button"
              onClick={() => loadWishlist()}
              className="underline hover:opacity-80 ml-4 font-bold"
            >
              Retry
            </button>
          </div>
        )}

        {isLoading || isAuthLoading ? (
          <div className="flex flex-col gap-6">
            <div className="h-10 w-48 bg-neutral-200/60 rounded-xl animate-pulse" />
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
              {[1, 2, 3, 4].map((n) => (
                <div
                  key={n}
                  className="aspect-square rounded-2xl bg-neutral-200/50 animate-pulse"
                />
              ))}
            </div>
          </div>
        ) : wishlistItems.length === 0 ? (
          <WishlistEmptyState />
        ) : (
          <div className="flex flex-col gap-6">
            {/* Wishlist Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-neutral-200">
              <div className="flex items-baseline gap-3">
                <h1
                  className="text-2xl sm:text-3xl font-black tracking-tight"
                  style={{ color: "var(--color-neutral-900)" }}
                >
                  My Wishlist
                </h1>
                <span
                  className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-bold"
                  style={{
                    background: "rgba(162, 203, 139, 0.2)",
                    color: "var(--color-neutral-900)",
                  }}
                  aria-label={`${wishlistItems.length} items in wishlist`}
                >
                  {wishlistItems.length}{" "}
                  {wishlistItems.length === 1 ? "item" : "items"}
                </span>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="text-xs font-semibold text-neutral-500 hover:text-red-600 transition-colors focus:outline-none"
                >
                  Clear Wishlist
                </button>
                <Link
                  href="/shop"
                  className="inline-flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-lg border border-neutral-300 hover:bg-neutral-100 transition-colors"
                  style={{ color: "var(--color-neutral-800)" }}
                >
                  <span>Continue Browsing</span>
                  <ChevronRightIcon size={12} />
                </Link>
              </div>
            </div>

            {/* Product Grid: 2-col mobile, 3-col tablet, 4-col desktop */}
            <section
              aria-label="Wishlist items"
              className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6"
            >
              {wishlistItems.map((product) => (
                <WishlistItemCard
                  key={product.id}
                  product={product}
                  onRemove={handleRemove}
                  onAddToCart={handleAddToCart}
                />
              ))}
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
