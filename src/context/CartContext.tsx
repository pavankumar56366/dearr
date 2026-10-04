"use client";

import React, {
  createContext,
  useContext,
  useState,
  useMemo,
  useCallback,
  useEffect,
} from "react";
import type { SampleProduct, SampleProductVariant } from "@/data/sample-products";
import { SAMPLE_PRODUCTS } from "@/data/sample-products";
import { useAuth } from "./AuthContext";

/**
 * CartItem — Models a single line item in the customer shopping cart.
 * Maps to MySQL schema: carts, cart_items (docs/5.SCHEMA(1).md §2.8 & §2.9).
 */
export interface CartItem {
  id: string; // cart item primary key (UUID in MySQL, composite in guest demo)
  productId: string;
  slug: string;
  name: string;
  image: string;
  category: string;
  price: number;
  compareAtPrice: number | null;
  quantity: number;
  stockQuantity: number;
  variantId?: string;
  variantName?: string;
  isActive: boolean;
}

export interface CartTotalsState {
  subtotal: number;
  discount: number;
  shipping: number;
  total: number;
}

interface CartContextType {
  items: CartItem[];
  totalCount: number;
  subtotal: number;
  discount: number;
  total: number;
  hasUnavailableItems: boolean;
  isLoading: boolean;
  addItem: (
    product: SampleProduct | { id: string; name?: string; slug?: string; price?: number },
    quantity?: number,
    variant?: SampleProductVariant | { id: string; name?: string; price?: number | null; stockQuantity?: number }
  ) => Promise<void>;
  updateQuantity: (itemId: string, newQuantity: number) => Promise<void>;
  removeItem: (itemId: string) => Promise<void>;
  clearCart: () => Promise<void>;
  refreshCart: () => Promise<void>;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

// ─── Initial Demo Cart State (Guest Fallback) ───────────────────────────────
function getInitialDemoCart(): CartItem[] {
  const p1 = SAMPLE_PRODUCTS.find((p) => p.id === "sp-01");
  const p2 = SAMPLE_PRODUCTS.find((p) => p.id === "sp-06");

  const initial: CartItem[] = [];

  if (p1) {
    initial.push({
      id: `${p1.id}-default`,
      productId: p1.id,
      slug: p1.slug,
      name: p1.name,
      image: p1.image,
      category: p1.category,
      price: p1.price,
      compareAtPrice: p1.compareAtPrice,
      quantity: 1,
      stockQuantity: p1.stockQuantity,
      isActive: p1.isActive,
    });
  }

  if (p2) {
    initial.push({
      id: `${p2.id}-default`,
      productId: p2.id,
      slug: p2.slug,
      name: p2.name,
      image: p2.image,
      category: p2.category,
      price: p2.price,
      compareAtPrice: p2.compareAtPrice,
      quantity: 2,
      stockQuantity: p2.stockQuantity,
      isActive: p2.isActive,
    });
  }

  return initial;
}

function mapApiCartItem(item: any): CartItem {
  const finalPrice =
    item.pricing?.finalUnitPrice !== undefined
      ? item.pricing.finalUnitPrice
      : item.pricing?.unitPrice ?? 0;

  const originalPrice = item.pricing?.originalUnitPrice ?? finalPrice;

  return {
    id: item.id,
    productId: item.productId,
    slug: item.product?.slug || `product-${item.productId}`,
    name: item.product?.name || "Product",
    image: item.product?.image || "/product-samples/1.jpeg",
    category: item.product?.category || "3D Printing",
    price: finalPrice,
    compareAtPrice: originalPrice > finalPrice ? originalPrice : null,
    quantity: Number(item.quantity || 1),
    stockQuantity: Number(item.stock?.stockQuantity ?? 0),
    variantId: item.variantId || undefined,
    variantName: item.variant?.name || undefined,
    isActive: Boolean(
      item.product?.isActive &&
        (item.variant ? item.variant.isActive : true) &&
        item.stock?.available
    ),
  };
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { isLoggedIn, isLoading: isAuthLoading } = useAuth();

  const [items, setItems] = useState<CartItem[]>(getInitialDemoCart);
  const [serverTotals, setServerTotals] = useState<CartTotalsState | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Synchronize cart with API when customer is authenticated
  const refreshCart = useCallback(async () => {
    if (!isLoggedIn) {
      setServerTotals(null);
      return;
    }

    try {
      setIsLoading(true);
      const res = await fetch("/api/cart", {
        method: "GET",
        headers: { "Cache-Control": "no-cache" },
        credentials: "same-origin",
      });

      if (res.ok) {
        const data = await res.json();
        if (data.ok && data.cart) {
          const mapped = (data.cart.items || []).map(mapApiCartItem);
          setItems(mapped);
          setServerTotals(data.cart.totals);
        }
      }
    } catch {
      // Keep previous state on network failure
    } finally {
      setIsLoading(false);
    }
  }, [isLoggedIn]);

  useEffect(() => {
    if (!isAuthLoading) {
      if (isLoggedIn) {
        refreshCart();
      }
    }
  }, [isLoggedIn, isAuthLoading, refreshCart]);

  // Decimal-safe subtotal calculation (rounded to 2 decimal places)
  const subtotal = useMemo(() => {
    if (serverTotals) return serverTotals.subtotal;
    const rawTotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    return Math.round(rawTotal * 100) / 100;
  }, [items, serverTotals]);

  const discount = useMemo(() => {
    if (serverTotals) return serverTotals.discount;
    return 0;
  }, [serverTotals]);

  const total = useMemo(() => {
    if (serverTotals) return serverTotals.total;
    return subtotal;
  }, [serverTotals, subtotal]);

  // Total quantity count across all items
  const totalCount = useMemo(() => {
    return items.reduce((count, item) => count + item.quantity, 0);
  }, [items]);

  // Check if any item in cart is out-of-stock or deactivated
  const hasUnavailableItems = useMemo(() => {
    return items.some((item) => !item.isActive || item.stockQuantity < item.quantity || item.stockQuantity <= 0);
  }, [items]);

  const addItem = useCallback(
    async (
      product: SampleProduct | { id: string; name?: string; slug?: string; price?: number },
      quantity: number = 1,
      variant?: SampleProductVariant | { id: string; name?: string; price?: number | null; stockQuantity?: number }
    ) => {
      if (isLoggedIn) {
        try {
          const res = await fetch("/api/cart/items", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "same-origin",
            body: JSON.stringify({
              productId: product.id,
              variantId: variant?.id || null,
              quantity,
            }),
          });
          const data = await res.json();
          if (res.ok && data.ok && data.cart) {
            setItems((data.cart.items || []).map(mapApiCartItem));
            setServerTotals(data.cart.totals);
            return;
          }
          if (data?.error) {
            throw new Error(data.error);
          }
        } catch (err: any) {
          throw err;
        }
      }

      // Guest / Demo Fallback
      const sampleProd = product as SampleProduct;
      const effectiveStock = variant?.stockQuantity ?? sampleProd.stockQuantity ?? 10;
      const effectivePrice = variant?.price ?? sampleProd.price ?? 0;
      const variantKey = variant ? variant.id : "default";
      const compositeId = `${product.id}-${variantKey}`;

      setItems((prev) => {
        const existingIndex = prev.findIndex((item) => item.id === compositeId);
        if (existingIndex > -1) {
          const existing = prev[existingIndex];
          const newQty = Math.min(existing.quantity + quantity, effectiveStock);
          const updated = [...prev];
          updated[existingIndex] = { ...existing, quantity: newQty };
          return updated;
        }

        const newItem: CartItem = {
          id: compositeId,
          productId: product.id,
          slug: sampleProd.slug || `product-${product.id}`,
          name: sampleProd.name || "Product",
          image: sampleProd.image || "/product-samples/1.jpeg",
          category: sampleProd.category || "3D Printing",
          price: effectivePrice,
          compareAtPrice: sampleProd.compareAtPrice ?? null,
          quantity: Math.min(quantity, effectiveStock),
          stockQuantity: effectiveStock,
          variantId: variant?.id,
          variantName: variant?.name,
          isActive: true,
        };
        return [newItem, ...prev];
      });
    },
    [isLoggedIn]
  );

  const updateQuantity = useCallback(
    async (itemId: string, newQuantity: number) => {
      if (isLoggedIn) {
        try {
          const res = await fetch(`/api/cart/items/${itemId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            credentials: "same-origin",
            body: JSON.stringify({ quantity: newQuantity }),
          });
          const data = await res.json();
          if (res.ok && data.ok && data.cart) {
            setItems((data.cart.items || []).map(mapApiCartItem));
            setServerTotals(data.cart.totals);
            return;
          }
          if (data?.error) {
            throw new Error(data.error);
          }
        } catch (err: any) {
          throw err;
        }
      }

      // Guest / Demo Fallback
      setItems((prev) => {
        return prev.map((item) => {
          if (item.id === itemId) {
            const bounded = Math.max(1, Math.min(newQuantity, item.stockQuantity || 1));
            return { ...item, quantity: bounded };
          }
          return item;
        });
      });
    },
    [isLoggedIn]
  );

  const removeItem = useCallback(
    async (itemId: string) => {
      if (isLoggedIn) {
        try {
          const res = await fetch(`/api/cart/items/${itemId}`, {
            method: "DELETE",
            credentials: "same-origin",
          });
          const data = await res.json();
          if (res.ok && data.ok && data.cart) {
            setItems((data.cart.items || []).map(mapApiCartItem));
            setServerTotals(data.cart.totals);
            return;
          }
        } catch {
          // Fallback to local filtering
        }
      }

      setItems((prev) => prev.filter((item) => item.id !== itemId));
    },
    [isLoggedIn]
  );

  const clearCart = useCallback(async () => {
    if (isLoggedIn) {
      try {
        const res = await fetch("/api/cart", {
          method: "DELETE",
          credentials: "same-origin",
        });
        const data = await res.json();
        if (res.ok && data.ok && data.cart) {
          setItems([]);
          setServerTotals(data.cart.totals);
          return;
        }
      } catch {
        // Fallback to local clear
      }
    }

    setItems([]);
    setServerTotals(null);
  }, [isLoggedIn]);

  const value = useMemo(
    () => ({
      items,
      totalCount,
      subtotal,
      discount,
      total,
      hasUnavailableItems,
      isLoading,
      addItem,
      updateQuantity,
      removeItem,
      clearCart,
      refreshCart,
    }),
    [
      items,
      totalCount,
      subtotal,
      discount,
      total,
      hasUnavailableItems,
      isLoading,
      addItem,
      updateQuantity,
      removeItem,
      clearCart,
      refreshCart,
    ]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}
