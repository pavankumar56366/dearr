"use client";

import React, { useEffect, useState } from "react";
import { getAdminProductBySlug } from "@/lib/admin-catalog";
import { type SampleProduct } from "@/data/sample-products";
import { AdminProductForm } from "./AdminProductForm";
import { AdminProductNotFound } from "./AdminProductNotFound";
import { getProductPrimaryImage, getProductGalleryImages } from "@/lib/product-image";

interface AdminEditProductClientProps {
  slug: string;
}

function mapApiProductToSampleProduct(p: any): SampleProduct {
  const primaryImg = getProductPrimaryImage(p);
  const allImages = getProductGalleryImages(p);

  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    description: p.description || "",
    price: Number(p.price || 0),
    compareAtPrice:
      p.compareAtPrice !== null && p.compareAtPrice !== undefined
        ? Number(p.compareAtPrice)
        : null,
    image: primaryImg,
    images: allImages,
    category: p.category?.name || p.categoryName || p.categorySlug || "3D Printing",
    categorySlug: p.category?.slug || p.categorySlug || "3d-printing",
    isFeatured: Boolean(p.isFeatured),
    isPopular: false,
    isActive: Boolean(p.isActive),
    stockQuantity: Number(p.stockQuantity ?? 0),
    specifications: p.specifications || {
      material: "Eco-Friendly PLA Bioplastic",
      finish: "High-Resolution Layer Finish",
      dimensions: "12.5 cm (H) × 7.0 cm (W)",
      care: "Wipe with a soft, dry cloth. Keep away from extreme heat (>50°C).",
      process: "High-Resolution FDM 3D Printing",
    },
    variants:
      Array.isArray(p.variants) && p.variants.length > 0
        ? p.variants.map((v: any) => ({
            id: v.id,
            name: v.name,
            sku: v.sku,
            price: v.price !== null && v.price !== undefined ? Number(v.price) : undefined,
            stockQuantity: Number(v.stockQuantity ?? 0),
            isActive: Boolean(v.isActive),
          }))
        : undefined,
  };
}

/**
 * AdminEditProductClient — Client-side wrapper for /admin/products/[slug]/edit.
 *
 * Resolves product from real MySQL Product API, handling loading,
 * not-found states, and passing the pre-populated model to AdminProductForm.
 */
export function AdminEditProductClient({ slug }: AdminEditProductClientProps) {
  const [product, setProduct] = useState<SampleProduct | null>(null);
  const [hasResolved, setHasResolved] = useState(false);

  useEffect(() => {
    let isMounted = true;
    async function loadProduct() {
      try {
        const res = await fetch(`/api/admin/products/${encodeURIComponent(slug)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.ok && data.product && isMounted) {
            setProduct(mapApiProductToSampleProduct(data.product));
            setHasResolved(true);
            return;
          }
        }
      } catch (err) {
        console.warn("Could not fetch product from /api/admin/products:", err);
      }

      if (isMounted) {
        const fallback = getAdminProductBySlug(slug);
        setProduct(fallback);
        setHasResolved(true);
      }
    }

    loadProduct();

    return () => {
      isMounted = false;
    };
  }, [slug]);

  if (!hasResolved) {
    // Loading state while fetching from MySQL Product API
    return (
      <div className="max-w-7xl mx-auto py-12 px-4 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-3 border-primary border-t-transparent animate-spin" />
          <span className="text-xs font-semibold text-neutral-500">
            Resolving product details...
          </span>
        </div>
      </div>
    );
  }

  if (!product) {
    return <AdminProductNotFound slug={slug} />;
  }

  return <AdminProductForm mode="edit" initialProduct={product} />;
}
