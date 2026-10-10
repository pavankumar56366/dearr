"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import ProductCard from "@/components/customer/home/ProductCard";
import { ChevronRightIcon, CheckIcon } from "@/components/customer/Icons";

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

  const defaultVariant =
    product?.variants?.find((v: any) => v.isActive && v.stockQuantity > 0) ||
    product?.variants?.[0];

  const [selectedVariantId, setSelectedVariantId] = useState<string | undefined>(
    defaultVariant?.id
  );
  const [quantity, setQuantity] = useState(1);
  const { addItem } = useCart();

  useEffect(() => {
    if (product) {
      const def =
        product.variants?.find((v: any) => v.isActive && v.stockQuantity > 0) ||
        product.variants?.[0];
      setSelectedVariantId(def?.id);
    }
  }, [product?.id]);

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

  const hasVariants = Boolean(product.variants && product.variants.length > 0);

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
  const galleryImages = getProductGalleryImages(product);
  const mainImage = galleryImages[0] || getProductPrimaryImage(product);

  // Selected variant adjustments
  const currentVariant = product.variants?.find((v: any) => v.id === selectedVariantId);
  const currentPrice = currentVariant?.price ?? product.price;
  const maxStock = currentVariant ? currentVariant.stockQuantity : product.stockQuantity;

  // Determine out-of-stock state
  const isOutOfStock =
    product.isActive === false ||
    (currentVariant
      ? !currentVariant.isActive || currentVariant.stockQuantity <= 0
      : product.stockQuantity <= 0);

  // Discount calculation based on active pricing
  const hasDiscount =
    product.compareAtPrice !== null && product.compareAtPrice > currentPrice;
  const discountPercent = hasDiscount
    ? Math.round(
        ((product.compareAtPrice! - currentPrice) / product.compareAtPrice!) * 100
      )
    : null;
  const discountBadge = discountPercent ? `${discountPercent}% OFF` : null;

  const handleVariantSelect = (variantId: string) => {
    setSelectedVariantId(variantId);
    const variant = product.variants?.find((v: any) => v.id === variantId);
    if (variant) {
      if (variant.stockQuantity <= 0 || !variant.isActive) {
        setQuantity(1);
      } else if (quantity > variant.stockQuantity) {
        setQuantity(variant.stockQuantity);
      }
    }
  };

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
                price={currentPrice}
                compareAtPrice={product.compareAtPrice}
              />
            </div>

            {/* Product Description */}
            <div className="text-xs sm:text-sm leading-relaxed text-neutral-600">
              <p>{product.description}</p>
            </div>

            {/* Reusable Variants Selector (rendered only when variants exist) */}
            {hasVariants && (
              <ProductVariants
                variants={product.variants}
                selectedVariantId={selectedVariantId}
                onSelectVariant={handleVariantSelect}
                disabled={!product.isActive}
              />
            )}

            {/* Quantity Selector */}
            <QuantitySelector
              quantity={quantity}
              onQuantityChange={setQuantity}
              min={1}
              max={isOutOfStock ? 0 : Math.min(maxStock, 10)}
              disabled={isOutOfStock}
            />

            {/* Product Actions (Add to Cart, Buy Now, Wishlist, Toast, and Mobile Sticky Bar) */}
            <ProductActions
              productId={product.id}
              productSlug={product.slug}
              productName={product.name}
              price={currentPrice * quantity}
              isOutOfStock={isOutOfStock}
              hasVariants={hasVariants}
              selectedVariantId={selectedVariantId}
              onAddToCart={() => {
                const cartProduct = {
                  ...product,
                  image: mainImage,
                  category: categoryName,
                  categorySlug: categorySlug,
                };
                addItem(cartProduct, quantity, currentVariant);
              }}
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
