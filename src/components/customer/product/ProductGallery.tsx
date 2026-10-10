"use client";

import { useState } from "react";
import Image from "next/image";
import { normalizeImageUrl, DEFAULT_PRODUCT_FALLBACK_IMAGE, isUploadPath } from "@/lib/product-image";

interface ProductGalleryProps {
  productName: string;
  categoryName: string;
  mainImage: string;
  images?: Array<string | { url?: string; storagePath?: string }>;
  isOutOfStock?: boolean;
  discountBadge?: string | null;
  isFeatured?: boolean;
}

/**
 * ProductGallery — Responsive 3D printing product gallery.
 *
 * Desktop: Large high-res hero image + interactive thumbnail row.
 * Mobile: Clean aspect-square showcase with pagination dots (if multiple images).
 * Supports single or multi-image products gracefully.
 */
export default function ProductGallery({
  productName,
  categoryName,
  mainImage,
  images,
  isOutOfStock = false,
  discountBadge = null,
  isFeatured = false,
}: ProductGalleryProps) {
  // Normalize images array to string URLs whether passed as strings or image objects
  const rawList = images && images.length > 0 ? images : [mainImage];
  const normalizedList = rawList
    .map((img) => normalizeImageUrl(img, ""))
    .filter(Boolean);
  const allImages =
    normalizedList.length > 0
      ? normalizedList
      : [normalizeImageUrl(mainImage, DEFAULT_PRODUCT_FALLBACK_IMAGE)];

  const [selectedIndex, setSelectedIndex] = useState(0);

  const currentImage = allImages[selectedIndex] || allImages[0];
  const hasMultipleImages = allImages.length > 1;

  // Generate accessible and SEO-friendly alt text
  const currentAltText = hasMultipleImages
    ? `${productName} — ${categoryName} 3D print view ${selectedIndex + 1} of ${allImages.length}`
    : `${productName} — Precision 3D printed ${categoryName.toLowerCase()}`;

  return (
    <div className="flex flex-col gap-3.5 w-full">
      {/* Primary Main Image Frame */}
      <div
        className="relative aspect-square w-full rounded-2xl overflow-hidden select-none"
        style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-neutral-100)",
          boxShadow: "var(--shadow-card)",
        }}
      >
        <Image
          src={currentImage}
          alt={currentAltText}
          fill
          unoptimized={isUploadPath(currentImage)}
          priority
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 600px"
          className={`object-cover transition-opacity duration-300 ${
            isOutOfStock ? "opacity-75 grayscale-30" : ""
          }`}
        />

        {/* Badges Overlay */}
        <div className="absolute top-3.5 left-3.5 flex flex-col gap-1.5 z-10">
          {isOutOfStock ? (
            <span
              className="inline-block rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider shadow-sm"
              style={{
                background: "#E53E3E",
                color: "#FFFFFF",
              }}
            >
              Out of Stock
            </span>
          ) : (
            <>
              {discountBadge && (
                <span
                  className="inline-block rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider shadow-sm"
                  style={{
                    background: "var(--color-secondary)",
                    color: "var(--color-neutral-900)",
                  }}
                >
                  {discountBadge}
                </span>
              )}
              {isFeatured && (
                <span
                  className="inline-block rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider shadow-sm"
                  style={{
                    background: "var(--color-primary)",
                    color: "var(--color-neutral-900)",
                  }}
                >
                  Featured 3D Print
                </span>
              )}
            </>
          )}
        </div>

        {/* 3D Print Tag Badge */}
        <div className="absolute bottom-3.5 right-3.5 z-10 pointer-events-none">
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-wide backdrop-blur-md"
            style={{
              background: "rgba(255, 255, 255, 0.88)",
              color: "var(--color-neutral-700)",
              border: "1px solid rgba(0, 0, 0, 0.06)",
            }}
          >
            <span>🖨️</span>
            <span>3D Printed</span>
          </span>
        </div>

        {/* Mobile image dots indicator if multiple images */}
        {hasMultipleImages && (
          <div className="absolute bottom-3.5 left-1/2 -translate-x-1/2 flex items-center gap-1.5 z-10 md:hidden bg-black/40 backdrop-blur-sm px-2.5 py-1 rounded-full">
            {allImages.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setSelectedIndex(idx)}
                aria-label={`View image ${idx + 1}`}
                className={`w-2 h-2 rounded-full transition-all duration-200 ${
                  selectedIndex === idx ? "w-4 bg-white" : "bg-white/60"
                }`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Thumbnails Row (Desktop & Tablet) - Only rendered when multiple images exist */}
      {hasMultipleImages && (
        <div
          className="flex items-center gap-2.5 overflow-x-auto pb-1 scrollbar-none"
          role="tablist"
          aria-label="Product image thumbnails"
        >
          {allImages.map((img, idx) => {
            const isSelected = selectedIndex === idx;
            return (
              <button
                key={idx}
                type="button"
                role="tab"
                aria-selected={isSelected}
                aria-label={`Thumbnail ${idx + 1} of ${allImages.length}`}
                onClick={() => setSelectedIndex(idx)}
                className="relative w-16 h-16 sm:w-20 sm:h-20 shrink-0 rounded-xl overflow-hidden transition-all duration-200 focus:outline-none"
                style={{
                  border: isSelected
                    ? "2px solid var(--color-primary)"
                    : "1px solid var(--color-neutral-300)",
                  opacity: isSelected ? 1 : 0.7,
                  transform: isSelected ? "scale(1.02)" : "scale(1)",
                  boxShadow: isSelected
                    ? "0 0 0 2px rgba(162, 203, 139, 0.25)"
                    : "none",
                }}
              >
                <Image
                  src={img}
                  alt={`${productName} thumbnail ${idx + 1}`}
                  fill
                  unoptimized={isUploadPath(img)}
                  sizes="80px"
                  className="object-cover"
                />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
