"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import ProductCard from "@/components/customer/home/ProductCard";
import {
  ChevronRightIcon,
  CheckIcon,
  PlusIcon,
  MinusIcon,
  TrashIcon,
} from "@/components/customer/Icons";

const TRUST_BENEFITS = [
  {
    id: "tb-1",
    icon: "🌱",
    title: "Eco-Friendly PLA",
    description: "Crafted with biodegradable, non-toxic cornstarch-derived biopolymers.",
  },
  {
    id: "tb-2",
    icon: "🔬",
    title: "Precision Layers",
    description: "Printed at 0.16mm layer height for ultra-crisp contours and details.",
  },
  {
    id: "tb-3",
    icon: "🛡️",
    title: "Safe Transit Packaging",
    description: "Enclosed in shockproof multi-layer cushioning across India.",
  },
  {
    id: "tb-4",
    icon: "✨",
    title: "Hand-Inspected",
    description: "Every print is manually post-processed and quality verified in workshop.",
  },
];

import ProductGallery from "./ProductGallery";
import ProductPrice from "./ProductPrice";
import ProductVariants from "./ProductVariants";
import QuantitySelector from "./QuantitySelector";
import ProductActions from "./ProductActions";
import ProductSpecifications from "./ProductSpecifications";
import ProductAccordion from "./ProductAccordion";
import ProductNotFound from "./ProductNotFound";
import { useCart } from "@/context/CartContext";
import { getProductGalleryImages, getProductPrimaryImage } from "@/lib/product-image";

interface ColorOrderRow {
  rowId: string;
  colorId: string;
  quantity: number;
}

interface ProductDetailsClientProps {
  product?: any | null;
  initialProduct?: any | null;
  initialRelatedProducts?: any[];
  slug?: string;
}

export default function ProductDetailsClient({
  product: directProduct,
  initialProduct,
  initialRelatedProducts,
  slug: propSlug,
}: ProductDetailsClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const colorQueryParam = searchParams.get("color");

  const base = directProduct ?? initialProduct ?? null;
  const activeSlug = propSlug || base?.slug;

  const [product, setProduct] = useState<any | null>(base);
  const [relatedProducts, setRelatedProducts] = useState<any[]>(initialRelatedProducts || []);
  const [isLoading, setIsLoading] = useState(!base && Boolean(activeSlug));
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Client-side fallback fetch from Hostinger MySQL Product API
  useEffect(() => {
    if (initialProduct && initialProduct.slug === activeSlug) {
      setProduct(initialProduct);
      if (initialRelatedProducts && initialRelatedProducts.length > 0) {
        setRelatedProducts(initialRelatedProducts);
      }
      setIsLoading(false);
      return;
    }

    if (!activeSlug) {
      setIsLoading(false);
      return;
    }

    let isMounted = true;
    async function loadProduct() {
      setIsLoading(true);
      setFetchError(null);
      try {
        const res = await fetch(`/api/products/${encodeURIComponent(activeSlug)}`);
        if (res.status === 404) {
          if (isMounted) setProduct(null);
          return;
        }
        if (!res.ok) {
          throw new Error("Failed to load product");
        }
        const data = await res.json();
        if (isMounted && data.ok && data.product) {
          setProduct(data.product);

          // Load related products from same category
          const catSlug =
            typeof data.product.category === "object" && data.product.category !== null
              ? data.product.category.slug
              : data.product.categorySlug;
          const relRes = await fetch(
            `/api/products?pageSize=5${catSlug ? `&category=${encodeURIComponent(catSlug)}` : ""}`
          );
          if (relRes.ok) {
            const relData = await relRes.json();
            if (isMounted && relData.ok && Array.isArray(relData.products)) {
              const rel = relData.products.filter((p: any) => p.id !== data.product.id).slice(0, 4);
              setRelatedProducts(rel);
            }
          }
        } else if (isMounted) {
          setProduct(null);
        }
      } catch (err: unknown) {
        if (isMounted) {
          console.error("[ProductDetailsClient Error]", err);
          setFetchError("Unable to load product details. Please try refreshing.");
          setProduct(null);
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadProduct();
    return () => {
      isMounted = false;
    };
  }, [activeSlug, initialProduct, initialRelatedProducts]);

  // Determine Color Variants Configuration
  const productColors: any[] = useMemo(() => {
    if (!Array.isArray(product?.colors)) return [];
    return product.colors.filter((c: any) => c.isActive !== false);
  }, [product?.colors]);

  const hasColors = Boolean(
    product?.hasColors ??
      product?.has_colors ??
      productColors.length > 0
  );

  const productVariants: any[] = useMemo(() => {
    if (!Array.isArray(product?.variants)) return [];
    return product.variants;
  }, [product?.variants]);

  const hasVariants = productVariants.length > 0;

  // Initial Color Selection with deep link support
  const initialSelectedColor = useMemo(() => {
    if (productColors.length === 0) return null;
    if (colorQueryParam) {
      const match = productColors.find(
        (c) => c.slug?.toLowerCase() === colorQueryParam.toLowerCase()
      );
      if (match) return match;
    }
    const firstInStock = productColors.find(
      (c) => (c.availableStock ?? c.stock ?? 0) > 0
    );
    return firstInStock || productColors[0];
  }, [productColors, colorQueryParam]);

  const [activeColorId, setActiveColorId] = useState<string | null>(
    initialSelectedColor?.id || null
  );

  useEffect(() => {
    if (initialSelectedColor && !activeColorId) {
      setActiveColorId(initialSelectedColor.id);
    }
  }, [initialSelectedColor, activeColorId]);

  // Available variants filtered for active color if variants are color-linked
  const availableVariants = useMemo(() => {
    if (!hasVariants) return [];
    if (!hasColors || !activeColorId) return productVariants;
    const hasColorLinked = productVariants.some((v) => Boolean(v.colorId));
    if (!hasColorLinked) return productVariants;
    return productVariants.filter((v) => !v.colorId || v.colorId === activeColorId);
  }, [hasVariants, hasColors, activeColorId, productVariants]);

  // Default variant resolution: prefers active in-stock, falls back to active, never inactive
  const findDefaultVariant = useCallback((variantsList: any[], preferredSizeName?: string | null) => {
    if (!variantsList || variantsList.length === 0) return undefined;
    if (preferredSizeName) {
      const match = variantsList.find(
        (v) => v.isActive !== false && v.sizeName?.toLowerCase() === preferredSizeName.toLowerCase() && v.stockQuantity > 0
      ) || variantsList.find(
        (v) => v.isActive !== false && v.sizeName?.toLowerCase() === preferredSizeName.toLowerCase()
      );
      if (match) return match;
    }
    const inStock = variantsList.find((v) => v.isActive !== false && v.stockQuantity > 0);
    if (inStock) return inStock;
    return variantsList.find((v) => v.isActive !== false);
  }, []);

  const [selectedVariantId, setSelectedVariantId] = useState<string | undefined>(undefined);
  const [singleQuantity, setSingleQuantity] = useState(1);
  const { addItem, addBatchItems } = useCart();

  // Sync selected variant when availableVariants change or on color switch
  useEffect(() => {
    if (!hasVariants) {
      setSelectedVariantId(undefined);
      return;
    }

    if (availableVariants.length > 0) {
      setSelectedVariantId((prevId) => {
        const current = availableVariants.find((v) => v.id === prevId);
        if (current && current.isActive !== false) {
          return prevId;
        }
        const prevVariant = productVariants.find((v) => v.id === prevId);
        const def = findDefaultVariant(availableVariants, prevVariant?.sizeName);
        return def?.id;
      });
    } else {
      setSelectedVariantId(undefined);
    }
  }, [hasVariants, availableVariants, productVariants, findDefaultVariant]);

  // Multi-color purchasing rows state (only for pure color-only products)
  const [colorRows, setColorRows] = useState<ColorOrderRow[]>([]);

  // Initialize or reset color rows when pure color product changes
  useEffect(() => {
    if (hasColors && !hasVariants && productColors.length > 0) {
      const firstCol = initialSelectedColor || productColors[0];
      setColorRows((prev) => {
        if (prev.length > 0) return prev;
        return [
          {
            rowId: `row-${firstCol.id}`,
            colorId: firstCol.id,
            quantity: 1,
          },
        ];
      });
    }
  }, [hasColors, hasVariants, productColors, initialSelectedColor]);

  if (isLoading) {
    return (
      <div
        className="min-h-[60vh] flex items-center justify-center px-4"
        style={{ background: "var(--color-canvas)" }}
      >
        <div className="flex flex-col items-center gap-3">
          <div
            className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
            style={{ borderColor: "var(--color-primary)", borderTopColor: "transparent" }}
          />
          <span
            className="text-sm font-medium"
            style={{ color: "var(--color-neutral-500)" }}
          >
            Loading creation…
          </span>
        </div>
      </div>
    );
  }

  if (fetchError && !product) {
    return (
      <div
        className="min-h-[60vh] flex items-center justify-center px-4 py-16"
        style={{ background: "var(--color-canvas)" }}
      >
        <div className="max-w-md w-full rounded-2xl p-8 text-center flex flex-col items-center gap-4 bg-surface border border-neutral-200 shadow-sm">
          <span className="text-3xl" role="img" aria-label="Error">
            ⚠️
          </span>
          <h1 className="text-xl font-bold text-neutral-900">Unable to Load Product</h1>
          <p className="text-sm text-neutral-500">{fetchError}</p>
          <Link
            href="/shop"
            className="h-11 px-6 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center bg-primary text-neutral-900 transition-transform active:scale-98"
          >
            Return to Shop
          </Link>
        </div>
      </div>
    );
  }

  // If product does not exist in MySQL or is inactive, show ProductNotFound
  if (!product || product.isActive === false) {
    return <ProductNotFound slug={activeSlug} />;
  }

  // Normalize category info
  const categoryName =
    typeof product.category === "object" && product.category !== null
      ? product.category.name
      : product.category || "3D Printing";
  const categorySlug =
    typeof product.category === "object" && product.category !== null
      ? product.category.slug
      : product.categorySlug || "";

  // Normalize images
  const galleryImages =
    Array.isArray(product.images) && product.images.length > 0
      ? product.images
      : getProductGalleryImages(product);
  const mainImage =
    (Array.isArray(product.images) && (product.images[0]?.url || product.images[0]?.storagePath)) ||
    getProductPrimaryImage(product);

  // Color variant helpers
  const activeColor = productColors.find((c) => c.id === activeColorId) || productColors[0];
  const activeColorStock = activeColor ? (activeColor.availableStock ?? activeColor.stock ?? 0) : 0;
  const isAllColorsOutOfStock =
    hasColors && productColors.every((c) => (c.availableStock ?? c.stock ?? 0) <= 0);

  // Selected variant
  const currentVariant = useMemo(() => {
    if (!hasVariants) return undefined;
    return availableVariants.find((v) => v.id === selectedVariantId) ||
           productVariants.find((v) => v.id === selectedVariantId);
  }, [hasVariants, availableVariants, productVariants, selectedVariantId]);

  // Authoritative price calculation:
  // 1. Variant price (strictly preserves 0!)
  // 2. Color price override (strictly preserves 0!)
  // 3. Base product price
  const effectiveDisplayPrice = useMemo(() => {
    if (currentVariant && currentVariant.price !== null && currentVariant.price !== undefined) {
      const vp = Number(currentVariant.price);
      if (!isNaN(vp) && vp >= 0) return Math.round(vp * 100) / 100;
    }
    if (hasColors && activeColor && activeColor.priceOverride !== null && activeColor.priceOverride !== undefined) {
      const cp = Number(activeColor.priceOverride);
      if (!isNaN(cp) && cp >= 0) return Math.round(cp * 100) / 100;
    }
    const bp = Number(product?.price || 0);
    return Math.max(0, Math.round((isNaN(bp) ? 0 : bp) * 100) / 100);
  }, [currentVariant, hasColors, activeColor, product?.price]);

  // Stock calculation:
  // For variant products, stock is variant stockQuantity
  // For color products without variants, stock is sum of color stock
  // For simple products, stock is product.stockQuantity
  const maxStock = useMemo(() => {
    if (hasVariants) {
      return currentVariant ? Math.max(0, currentVariant.stockQuantity) : 0;
    }
    if (hasColors) {
      return productColors.reduce((sum, c) => sum + (c.availableStock ?? c.stock ?? 0), 0);
    }
    return Math.max(0, product.stockQuantity || 0);
  }, [hasVariants, currentVariant, hasColors, productColors, product.stockQuantity]);

  // Overall out-of-stock determination
  const isOutOfStock = useMemo(() => {
    if (product.isActive === false) return true;
    if (hasVariants) {
      if (!currentVariant) return true;
      return currentVariant.isActive === false || currentVariant.stockQuantity <= 0;
    }
    if (hasColors) {
      return isAllColorsOutOfStock;
    }
    return (product.stockQuantity ?? 0) <= 0;
  }, [product.isActive, hasVariants, currentVariant, hasColors, isAllColorsOutOfStock, product.stockQuantity]);

  // Multi-color Calculations (for pure color-only products)
  const multiColorTotalQuantity = colorRows.reduce((sum, r) => sum + r.quantity, 0);
  const multiColorTotalPrice = colorRows.reduce((sum, r) => {
    const col = productColors.find((c) => c.id === r.colorId);
    const unitPrice =
      col?.priceOverride !== null && col?.priceOverride !== undefined
        ? Number(col.priceOverride)
        : Number(product.price);
    return sum + unitPrice * r.quantity;
  }, 0);

  const hasDiscount =
    product.compareAtPrice !== null && product.compareAtPrice > effectiveDisplayPrice;
  const discountPercent = hasDiscount
    ? Math.round(
        ((product.compareAtPrice! - effectiveDisplayPrice) / product.compareAtPrice!) * 100
      )
    : null;
  const discountBadge = discountPercent ? `${discountPercent}% OFF` : null;

  // Swatch Click Handler with deep linking
  const handleSelectColor = (color: any) => {
    setActiveColorId(color.id);

    // Sync deep link URL (?color=slug) without full-page refresh
    if (typeof window !== "undefined" && color.slug) {
      const url = new URL(window.location.href);
      url.searchParams.set("color", color.slug);
      window.history.replaceState(null, "", url.toString());
    }

    // Auto-update first row if only 1 row exists, or keep rows synced
    setColorRows((prev) => {
      if (prev.length === 0) {
        return [{ rowId: `row-${color.id}`, colorId: color.id, quantity: 1 }];
      }
      const existing = prev.find((r) => r.colorId === color.id);
      if (existing) return prev;
      if (prev.length === 1) {
        return [{ ...prev[0], colorId: color.id, rowId: `row-${color.id}` }];
      }
      return prev;
    });
  };

  // Add another color row
  const handleAddAnotherColor = () => {
    const existingColorIds = new Set(colorRows.map((r) => r.colorId));
    const nextAvailable =
      productColors.find(
        (c) => !existingColorIds.has(c.id) && (c.availableStock ?? c.stock ?? 0) > 0
      ) || productColors.find((c) => !existingColorIds.has(c.id));

    if (nextAvailable) {
      setColorRows((prev) => [
        ...prev,
        {
          rowId: `row-${nextAvailable.id}-${Date.now()}`,
          colorId: nextAvailable.id,
          quantity: 1,
        },
      ]);
      setActiveColorId(nextAvailable.id);
    }
  };

  // Quantity change for a specific color row
  const handleUpdateRowQuantity = (rowId: string, delta: number) => {
    setColorRows((prev) =>
      prev.map((r) => {
        if (r.rowId !== rowId) return r;
        const col = productColors.find((c) => c.id === r.colorId);
        const colStock = col ? Math.min(col.availableStock ?? col.stock ?? 10, 10) : 10;
        const newQty = Math.max(1, Math.min(r.quantity + delta, colStock));
        return { ...r, quantity: newQty };
      })
    );
  };

  // Remove a color row
  const handleRemoveRow = (rowId: string) => {
    setColorRows((prev) => (prev.length > 1 ? prev.filter((r) => r.rowId !== rowId) : prev));
  };

  // Change color for an existing row
  const handleRowColorChange = (rowId: string, newColorId: string) => {
    setColorRows((prev) =>
      prev.map((r) => (r.rowId === rowId ? { ...r, colorId: newColorId } : r))
    );
    setActiveColorId(newColorId);
  };

  // Variant selector
  const handleVariantSelect = (variantId: string) => {
    setSelectedVariantId(variantId);
    const variant = productVariants.find((v: any) => v.id === variantId);
    if (variant) {
      if (variant.stockQuantity <= 0 || !variant.isActive) {
        setSingleQuantity(1);
      } else if (singleQuantity > variant.stockQuantity) {
        setSingleQuantity(variant.stockQuantity);
      }
    }
  };

  // Add to Cart Action
  const handleAddToCart = () => {
    if (isOutOfStock) return;
    if (hasVariants && !selectedVariantId) return;

    if (hasVariants) {
      // Combination product or variant-only product
      const activeColorObj = hasColors && activeColor ? {
        id: activeColor.id,
        name: activeColor.name,
        hex: activeColor.hex,
        sku: activeColor.sku || null,
        image: activeColor.primaryImage || null,
      } : undefined;

      const cartProduct = {
        ...product,
        price: effectiveDisplayPrice,
        image: activeColorObj?.image || mainImage,
        category: categoryName,
        categorySlug: categorySlug,
      };

      addItem(cartProduct, singleQuantity, currentVariant, activeColorObj);
    } else if (hasColors) {
      // Pure color-only product with multi-color rows
      if (colorRows.length === 0) return;
      const batchItems = colorRows.map((r) => {
        const col = productColors.find((c) => c.id === r.colorId)!;
        const colPrice =
          col?.priceOverride !== null && col?.priceOverride !== undefined
            ? Number(col.priceOverride)
            : Number(product.price);
        return {
          product: {
            ...product,
            price: colPrice,
            image: col?.primaryImage || mainImage,
            category: categoryName,
            categorySlug: categorySlug,
          },
          quantity: r.quantity,
          color: {
            id: col.id,
            name: col.name,
            hex: col.hex,
            sku: col.sku || null,
            image: col.primaryImage || null,
          },
        };
      });
      addBatchItems(batchItems);
    } else {
      // Simple product
      const cartProduct = {
        ...product,
        price: effectiveDisplayPrice,
        image: mainImage,
        category: categoryName,
        categorySlug: categorySlug,
      };
      addItem(cartProduct, singleQuantity, undefined, undefined);
    }
  };

  // Buy Now Action: isolated checkout intent
  const handleBuyNow = async () => {
    if (isOutOfStock) return;
    if (hasVariants && !selectedVariantId) return;

    try {
      let itemsToOrder: Array<{
        productId: string;
        variantId?: string | null;
        colorId?: string | null;
        quantity: number;
      }> = [];

      if (hasVariants) {
        itemsToOrder = [
          {
            productId: product.id,
            variantId: currentVariant?.id || null,
            colorId: (hasColors && activeColor ? activeColor.id : currentVariant?.colorId) || null,
            quantity: singleQuantity,
          },
        ];
      } else if (hasColors) {
        itemsToOrder = colorRows.map((r) => ({
          productId: product.id,
          colorId: r.colorId,
          quantity: r.quantity,
        }));
      } else {
        itemsToOrder = [
          {
            productId: product.id,
            quantity: singleQuantity,
          },
        ];
      }

      const res = await fetch("/api/checkout/intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: itemsToOrder }),
      });

      const data = await res.json();
      if (res.ok && data.ok && data.intentId) {
        router.push(`/checkout?intentId=${encodeURIComponent(data.intentId)}`);
        return;
      }

      if (data?.error) {
        alert(data.error);
      }
    } catch (err) {
      console.error("[Buy Now Error]", err);
    }
  };

  const unusedColors = useMemo(() => {
    const used = new Set(colorRows.map((r) => r.colorId));
    return productColors.filter((c) => !used.has(c.id));
  }, [productColors, colorRows]);

  return (
    <div
      className="min-h-screen pb-40 md:pb-20"
      style={{ background: "var(--color-canvas)" }}
    >
      {/* Breadcrumb Navigation */}
      <nav
        aria-label="Breadcrumb"
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-2"
      >
        <ol className="flex items-center flex-wrap gap-1.5 text-xs font-medium text-neutral-500">
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
          <li>
            <Link
              href="/shop"
              className="inline-flex items-center py-2 px-1 -my-2 -mx-0.5 rounded-sm hover:underline transition-colors hover:text-neutral-900 focus-visible:outline-2 focus-visible:outline-primary"
            >
              Shop
            </Link>
          </li>
          {categorySlug && (
            <>
              <li aria-hidden="true" className="text-neutral-400">
                <ChevronRightIcon size={12} />
              </li>
              <li>
                <Link
                  href={`/shop?cat=${categorySlug}`}
                  className="inline-flex items-center py-2 px-1 -my-2 -mx-0.5 rounded-sm hover:underline transition-colors hover:text-neutral-900 focus-visible:outline-2 focus-visible:outline-primary"
                >
                  {categoryName}
                </Link>
              </li>
            </>
          )}
          <li aria-hidden="true" className="text-neutral-400">
            <ChevronRightIcon size={12} />
          </li>
          <li
            aria-current="page"
            className="font-bold truncate max-w-[200px] sm:max-w-xs"
            style={{ color: "var(--color-neutral-800)" }}
          >
            {product.name}
          </li>
        </ol>
      </nav>

      {/* Main Product Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
          {/* Left Column: Product Gallery */}
          <div className="lg:col-span-6 w-full sticky top-24">
            <ProductGallery
              productName={product.name}
              categoryName={categoryName}
              mainImage={mainImage}
              images={galleryImages}
              isOutOfStock={isOutOfStock}
              discountBadge={discountBadge}
              isFeatured={product.isFeatured}
              activeColorId={hasColors ? activeColor?.id : null}
              activeColorName={hasColors ? activeColor?.name : null}
              colors={productColors}
            />
          </div>

          {/* Right Column: Product Info & Purchase Controls */}
          <div className="lg:col-span-6 flex flex-col gap-5 sm:gap-6">
            {/* Category Pill */}
            {categorySlug && (
              <div>
                <Link
                  href={`/shop?cat=${categorySlug}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider transition-opacity hover:opacity-80"
                  style={{
                    background: "rgba(162, 203, 139, 0.18)",
                    color: "var(--color-neutral-900)",
                  }}
                >
                  <span>🖨️</span>
                  <span>{categoryName}</span>
                </Link>
              </div>
            )}

            {/* Product Title */}
            <h1
              className="text-xl sm:text-2xl lg:text-3xl font-black tracking-tight leading-snug"
              style={{ color: "var(--color-neutral-900)" }}
            >
              {product.name}
            </h1>

            {/* Stock Status Badge */}
            <div className="flex items-center gap-2">
              {isOutOfStock ? (
                <span
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold"
                  style={{
                    background: "rgba(192, 7, 7, 0.1)",
                    color: "var(--color-error)",
                  }}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-error" />
                  Currently Out of Stock
                </span>
              ) : (
                <span
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold"
                  style={{
                    background: "rgba(42, 124, 19, 0.1)",
                    color: "var(--color-success)",
                  }}
                >
                  <CheckIcon size={13} />
                  <span>In Stock</span>
                  <span className="font-normal opacity-85">
                    ({maxStock} units ready to dispatch)
                  </span>
                </span>
              )}
            </div>

            {/* Price Component */}
            <div
              className="p-4 rounded-2xl"
              style={{
                background: "var(--color-surface)",
                border: "1px solid var(--color-neutral-100)",
                boxShadow: "var(--shadow-card)",
              }}
            >
              <ProductPrice
                price={effectiveDisplayPrice}
                compareAtPrice={product.compareAtPrice}
              />
            </div>

            {/* Product Description */}
            <div className="text-xs sm:text-sm leading-relaxed text-neutral-600">
              <p>{product.description}</p>
            </div>

            {/* ==========================================================
                COLOR SWATCH SELECTOR (When product has multiple colors)
                ========================================================== */}
            {hasColors && productColors.length > 0 && (
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-neutral-500">
                      Color:
                    </span>
                    <span className="text-sm font-black text-neutral-900">
                      {activeColor?.name || "Choose Color"}
                    </span>
                  </div>
                  {activeColor && !hasVariants && (
                    <span className="text-xs text-neutral-500">
                      {activeColorStock > 0 ? (
                        <span className="text-emerald-700 font-medium">
                          {activeColorStock} in stock
                        </span>
                      ) : (
                        <span className="text-red-600 font-medium">Out of stock</span>
                      )}
                    </span>
                  )}
                </div>

                {/* Swatch Strip */}
                <div
                  className="flex items-center flex-wrap gap-2.5"
                  role="radiogroup"
                  aria-label="Product color choices"
                >
                  {productColors.map((color) => {
                    const isSelected = color.id === activeColorId;
                    const cStock = color.availableStock ?? color.stock ?? 0;
                    const isColorOOS = cStock <= 0;

                    return (
                      <button
                        key={color.id}
                        type="button"
                        role="radio"
                        aria-checked={isSelected}
                        aria-disabled={isColorOOS}
                        id={`swatch-${color.slug || color.id}`}
                        onClick={() => handleSelectColor(color)}
                        title={`${color.name}${isColorOOS ? " (Out of Stock)" : ` (${cStock} available)`}`}
                        aria-label={`${color.name}${isColorOOS ? " - Out of stock" : ""}`}
                        className={`group relative w-10 h-10 min-w-10 min-h-10 sm:w-11 sm:h-11 rounded-full p-0.5 transition-all focus:outline-none cursor-pointer flex items-center justify-center ${
                          isSelected
                            ? "ring-2 ring-primary ring-offset-2 ring-offset-canvas scale-105"
                            : "hover:scale-105 opacity-90 hover:opacity-100"
                        } ${isColorOOS ? "opacity-45 cursor-pointer" : ""}`}
                      >
                        <span
                          className={`w-full h-full rounded-full border border-black/15 shadow-xs relative overflow-hidden flex items-center justify-center ${
                            isColorOOS
                              ? "before:absolute before:inset-0 before:w-full before:h-[2px] before:bg-neutral-600 before:rotate-45 before:top-1/2 before:-translate-y-1/2"
                              : ""
                          }`}
                          style={{ backgroundColor: color.hex }}
                        >
                          {isSelected && !isColorOOS && (
                            <span className="w-2 h-2 rounded-full bg-white shadow-xs drop-shadow-sm" />
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ==========================================================
                MULTI-COLOR PURCHASING SECTION (PDP Multi-Color Buying)
                Only rendered for pure color-only products (hasColors && !hasVariants)
                ========================================================== */}
            {hasColors && !hasVariants && productColors.length > 0 && (
              <div
                className="p-4 sm:p-5 rounded-2xl border space-y-4"
                style={{
                  background: "var(--color-surface)",
                  borderColor: "var(--color-neutral-200)",
                }}
              >
                <div className="flex items-center justify-between pb-2 border-b border-neutral-100">
                  <span className="text-xs font-bold uppercase tracking-wider text-neutral-800">
                    Selected Color Quantities
                  </span>
                  <span className="text-[11px] text-neutral-500">
                    Max 10 units per color
                  </span>
                </div>

                {/* Rows List */}
                <div className="space-y-3">
                  {colorRows.map((row) => {
                    const rowCol = productColors.find((c) => c.id === row.colorId) || productColors[0];
                    const rowStock = rowCol ? (rowCol.availableStock ?? rowCol.stock ?? 0) : 0;
                    const rowMaxQty = Math.min(rowStock, 10);
                    const rowUnitPrice =
                      rowCol?.priceOverride !== null && rowCol?.priceOverride !== undefined
                        ? Number(rowCol.priceOverride)
                        : Number(product.price);
                    const isRowOOS = rowStock <= 0;

                    return (
                      <div
                        key={row.rowId}
                        className="p-3 rounded-xl bg-neutral-50 border border-neutral-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        {/* Color Selector & Info */}
                        <div className="flex items-center gap-3">
                          <span
                            className="w-7 h-7 rounded-full border border-black/15 shadow-xs shrink-0"
                            style={{ backgroundColor: rowCol.hex }}
                          />
                          <div>
                            <select
                              value={row.colorId}
                              onChange={(e) => handleRowColorChange(row.rowId, e.target.value)}
                              aria-label="Change color for this row"
                              className="text-xs font-bold text-neutral-900 bg-transparent border-0 focus:ring-0 cursor-pointer p-0"
                            >
                              {productColors.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.name}
                                  {(c.availableStock ?? c.stock ?? 0) <= 0 ? " (Out of stock)" : ""}
                                </option>
                              ))}
                            </select>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[11px] text-neutral-500">
                                ₹{rowUnitPrice.toLocaleString("en-IN")} each
                              </span>
                              <span className="text-neutral-300">•</span>
                              <span
                                className={`text-[10px] font-medium ${
                                  isRowOOS ? "text-red-600" : "text-emerald-700"
                                }`}
                              >
                                {isRowOOS ? "Out of Stock" : `${rowStock} available`}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Quantity Stepper & Subtotal */}
                        <div className="flex items-center justify-between sm:justify-end gap-3 self-end sm:self-auto w-full sm:w-auto">
                          {/* Stepper */}
                          <div className="inline-flex items-center rounded-lg border border-neutral-300 bg-white shadow-xs">
                            <button
                              type="button"
                              onClick={() => handleUpdateRowQuantity(row.rowId, -1)}
                              disabled={row.quantity <= 1 || isRowOOS}
                              aria-label={`Decrease quantity for ${rowCol.name}`}
                              className="w-8 h-8 flex items-center justify-center text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 disabled:opacity-30 disabled:pointer-events-none rounded-l-lg transition cursor-pointer"
                            >
                              <MinusIcon size={14} />
                            </button>
                            <span className="w-8 text-center text-xs font-bold text-neutral-900 select-none">
                              {row.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleUpdateRowQuantity(row.rowId, 1)}
                              disabled={row.quantity >= rowMaxQty || isRowOOS}
                              aria-label={`Increase quantity for ${rowCol.name}`}
                              className="w-8 h-8 flex items-center justify-center text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 disabled:opacity-30 disabled:pointer-events-none rounded-r-lg transition cursor-pointer"
                            >
                              <PlusIcon size={14} />
                            </button>
                          </div>

                          {/* Row Subtotal */}
                          <span className="text-xs font-black text-neutral-900 min-w-[60px] text-right">
                            ₹{(rowUnitPrice * row.quantity).toLocaleString("en-IN")}
                          </span>

                          {/* Delete row button (if more than 1 row) */}
                          {colorRows.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveRow(row.rowId)}
                              aria-label={`Remove ${rowCol.name} row`}
                              className="p-1 text-neutral-400 hover:text-red-600 transition cursor-pointer"
                            >
                              <TrashIcon size={16} />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Add Another Color Button */}
                {unusedColors.length > 0 && (
                  <button
                    type="button"
                    id="btn-add-another-color"
                    onClick={handleAddAnotherColor}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-neutral-700 hover:text-neutral-950 py-1 transition cursor-pointer"
                  >
                    <PlusIcon size={14} />
                    <span>+ Add another color</span>
                  </button>
                )}

                {/* Live Order Summary Strip */}
                <div className="pt-2 border-t border-neutral-100 flex items-center justify-between text-xs">
                  <span className="text-neutral-600 font-medium">
                    Order Total ({multiColorTotalQuantity} {multiColorTotalQuantity === 1 ? "item" : "items"}):
                  </span>
                  <span className="text-base font-black text-neutral-900">
                    ₹{multiColorTotalPrice.toLocaleString("en-IN")}
                  </span>
                </div>
              </div>
            )}

            {/* Reusable Variants Selector */}
            {hasVariants && (
              <ProductVariants
                variants={availableVariants}
                selectedVariantId={selectedVariantId}
                onSelectVariant={handleVariantSelect}
                disabled={!product.isActive}
                label={hasColors ? "Select Size / Option" : "Select Option"}
              />
            )}

            {/* Quantity Selector: for simple products and single-combination variant products */}
            {(!hasColors || hasVariants) && (
              <QuantitySelector
                quantity={singleQuantity}
                onQuantityChange={setSingleQuantity}
                min={1}
                max={isOutOfStock ? 0 : Math.min(maxStock, 10)}
                disabled={isOutOfStock}
              />
            )}

            {/* Product Actions (Add to Cart, Buy Now, Wishlist, Toast, and Mobile Sticky Bar) */}
            <ProductActions
              productId={product.id}
              productSlug={product.slug}
              productName={product.name}
              price={hasColors && !hasVariants ? multiColorTotalPrice : effectiveDisplayPrice * singleQuantity}
              isOutOfStock={isOutOfStock}
              hasVariants={hasVariants}
              selectedVariantId={selectedVariantId}
              onAddToCart={handleAddToCart}
              onBuyNow={handleBuyNow}
            />

            {/* 3D Printing Highlights Badge */}
            <div
              className="p-4 rounded-xl flex items-center gap-3"
              style={{
                background: "rgba(162, 203, 139, 0.12)",
                border: "1px solid rgba(162, 203, 139, 0.25)",
              }}
            >
              <span className="text-2xl select-none" aria-hidden="true">
                🌱
              </span>
              <div className="flex flex-col text-xs">
                <span className="font-bold text-neutral-900">
                  Eco-Friendly 3D Manufacturing
                </span>
                <span className="text-neutral-600">
                  Printed in India on high-precision 3D printers using biodegradable PLA filament.
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Lower Section: Specifications & Accordions */}
        <section className="mt-12 sm:mt-16 pt-8 border-t border-neutral-200">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
            {/* 3D Printing Specifications (rendered if present) */}
            <ProductSpecifications specifications={product.specifications} />

            {/* Information Accordions (Shipping, Returns, Quality Guarantee) */}
            <ProductAccordion />
          </div>
        </section>

        {/* Trust Benefits Row */}
        <section
          aria-label="Why Choose Dearr 3D Prints"
          className="mt-12 sm:mt-16 p-6 sm:p-8 rounded-2xl bg-white border border-neutral-100 shadow-sm"
        >
          <h2 className="sr-only">Why Choose Dearr 3D Prints</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
            {TRUST_BENEFITS.map((benefit) => (
              <div key={benefit.id} className="flex flex-col items-center text-center gap-2">
                <span className="text-3xl select-none" aria-hidden="true">
                  {benefit.icon}
                </span>
                <h3 className="text-xs font-bold text-neutral-900">
                  {benefit.title}
                </h3>
                <p className="text-[11px] text-neutral-500 leading-relaxed">
                  {benefit.description}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Related 3D Printed Products */}
        {relatedProducts.length > 0 && (
          <section className="mt-12 sm:mt-16 pt-8 border-t border-neutral-200">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2
                  className="text-lg sm:text-xl font-black tracking-tight"
                  style={{ color: "var(--color-neutral-900)" }}
                >
                  You May Also Like
                </h2>
                <p className="text-xs text-neutral-500">
                  Explore other precision 3D printed models from our catalog
                </p>
              </div>
              {categorySlug && (
                <Link
                  href={`/shop?cat=${categorySlug}`}
                  className="text-xs font-bold text-neutral-700 hover:underline flex items-center gap-1"
                >
                  <span>View More</span>
                  <ChevronRightIcon size={14} />
                </Link>
              )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
              {relatedProducts.map((relProduct) => (
                <ProductCard key={relProduct.id} product={relProduct} />
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
