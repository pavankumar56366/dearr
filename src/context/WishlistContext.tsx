"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import { useAuth } from "@/context/AuthContext";

export interface WishlistItem {
  id: string;
  productId: string;
  product?: {
    id: string;
    name: string;
    slug: string;
    price: number;
    compareAtPrice?: number | null;
    image?: string;
    isActive?: boolean;
    stockQuantity?: number;
  };
  createdAt?: string;
}

interface WishlistContextType {
  wishlistCount: number;
  wishlistIds: Set<string>;
  wishlistItems: WishlistItem[];
  isLoading: boolean;
  isWishlisted: (productId: string) => boolean;
  toggleWishlist: (productId: string) => Promise<boolean>;
  addToWishlist: (productId: string) => Promise<boolean>;
  removeFromWishlist: (productId: string) => Promise<boolean>;
  refreshWishlist: () => Promise<void>;
}

const WishlistContext = createContext<WishlistContextType | undefined>(undefined);

export function WishlistProvider({ children }: { children: React.ReactNode }) {
  const { isLoggedIn, isLoading: isAuthLoading } = useAuth();
  const [wishlistItems, setWishlistItems] = useState<WishlistItem[]>([]);
  const [wishlistIds, setWishlistIds] = useState<Set<string>>(new Set());
  const [wishlistCount, setWishlistCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const refreshWishlist = useCallback(async () => {
    if (!isLoggedIn) {
      setWishlistItems([]);
      setWishlistIds(new Set());
      setWishlistCount(0);
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch("/api/wishlist", {
        method: "GET",
        headers: { "Cache-Control": "no-cache" },
        credentials: "same-origin",
      });

      if (res.ok) {
        const data = await res.json();
        if (data.ok && data.wishlist) {
          const items: WishlistItem[] = data.wishlist.items || [];
          const ids = new Set<string>();
          items.forEach((it) => {
            const pId = it.productId || it.product?.id;
            if (pId) ids.add(pId);
          });
          setWishlistItems(items);
          setWishlistIds(ids);
          setWishlistCount(ids.size);
          return;
        }
      }
      // If error or unauthenticated
      setWishlistItems([]);
      setWishlistIds(new Set());
      setWishlistCount(0);
    } catch {
      // Network failure
    } finally {
      setIsLoading(false);
    }
  }, [isLoggedIn]);

  // Synchronize on mount and whenever authentication changes
  useEffect(() => {
    if (!isAuthLoading) {
      if (isLoggedIn) {
        refreshWishlist();
      } else {
        setWishlistItems([]);
        setWishlistIds(new Set());
        setWishlistCount(0);
      }
    }
  }, [isLoggedIn, isAuthLoading, refreshWishlist]);

  const isWishlisted = useCallback(
    (productId: string) => {
      if (!productId) return false;
      return wishlistIds.has(productId);
    },
    [wishlistIds]
  );

  const addToWishlist = useCallback(
    async (productId: string): Promise<boolean> => {
      if (!isLoggedIn || !productId) return false;

      // Optimistic update
      setWishlistIds((prev) => {
        const next = new Set(prev);
        next.add(productId);
        return next;
      });
      setWishlistCount((prev) => (wishlistIds.has(productId) ? prev : prev + 1));

      try {
        const res = await fetch("/api/wishlist/items", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ productId }),
        });

        if (!res.ok) {
          // Revert optimistic update
          setWishlistIds((prev) => {
            const next = new Set(prev);
            next.delete(productId);
            return next;
          });
          setWishlistCount((prev) => Math.max(0, prev - 1));
          return false;
        }

        // Silent background refresh to capture full item metadata
        refreshWishlist();
        return true;
      } catch {
        // Revert on network error
        setWishlistIds((prev) => {
          const next = new Set(prev);
          next.delete(productId);
          return next;
        });
        setWishlistCount((prev) => Math.max(0, prev - 1));
        return false;
      }
    },
    [isLoggedIn, wishlistIds, refreshWishlist]
  );

  const removeFromWishlist = useCallback(
    async (productId: string): Promise<boolean> => {
      if (!isLoggedIn || !productId) return false;

      // Optimistic update
      setWishlistIds((prev) => {
        const next = new Set(prev);
        next.delete(productId);
        return next;
      });
      setWishlistCount((prev) => Math.max(0, prev - 1));

      try {
        const res = await fetch(`/api/wishlist/items/${productId}`, {
          method: "DELETE",
          credentials: "same-origin",
        });

        if (!res.ok) {
          // Revert optimistic update
          setWishlistIds((prev) => {
            const next = new Set(prev);
            next.add(productId);
            return next;
          });
          setWishlistCount((prev) => prev + 1);
          return false;
        }

        // Background sync
        refreshWishlist();
        return true;
      } catch {
        // Revert on network error
        setWishlistIds((prev) => {
          const next = new Set(prev);
          next.add(productId);
          return next;
        });
        setWishlistCount((prev) => prev + 1);
        return false;
      }
    },
    [isLoggedIn, refreshWishlist]
  );

  const toggleWishlist = useCallback(
    async (productId: string): Promise<boolean> => {
      if (wishlistIds.has(productId)) {
        await removeFromWishlist(productId);
        return false;
      } else {
        await addToWishlist(productId);
        return true;
      }
    },
    [wishlistIds, addToWishlist, removeFromWishlist]
  );

  const value = useMemo(
    () => ({
      wishlistCount,
      wishlistIds,
      wishlistItems,
      isLoading,
      isWishlisted,
      toggleWishlist,
      addToWishlist,
      removeFromWishlist,
      refreshWishlist,
    }),
    [
      wishlistCount,
      wishlistIds,
      wishlistItems,
      isLoading,
      isWishlisted,
      toggleWishlist,
      addToWishlist,
      removeFromWishlist,
      refreshWishlist,
    ]
  );

  return (
    <WishlistContext.Provider value={value}>
      {children}
    </WishlistContext.Provider>
  );
}

export function useWishlist(): WishlistContextType {
  const context = useContext(WishlistContext);
  if (!context) {
    throw new Error("useWishlist must be used within a WishlistProvider");
  }
  return context;
}
