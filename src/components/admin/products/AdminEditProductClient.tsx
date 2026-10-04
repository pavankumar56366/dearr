"use client";

import React, { useEffect, useState } from "react";
import { getAdminProductBySlug } from "@/lib/admin-catalog";
import { type SampleProduct } from "@/data/sample-products";
import { AdminProductForm } from "./AdminProductForm";
import { AdminProductNotFound } from "./AdminProductNotFound";

interface AdminEditProductClientProps {
  slug: string;
}

/**
 * AdminEditProductClient — Client-side wrapper for /admin/products/[slug]/edit.
 *
 * Resolves product from session storage or sample catalog, handling loading,
 * not-found states, and passing the pre-populated model to AdminProductForm.
 */
export function AdminEditProductClient({ slug }: AdminEditProductClientProps) {
  const [product, setProduct] = useState<SampleProduct | null>(null);
  const [hasResolved, setHasResolved] = useState(false);

  useEffect(() => {
    const resolved = getAdminProductBySlug(slug);
    setProduct(resolved);
    setHasResolved(true);
  }, [slug]);

  if (!hasResolved) {
    // Brief loading state while checking session storage
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
