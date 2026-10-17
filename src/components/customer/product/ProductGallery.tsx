"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import Image from "next/image";
import { normalizeImageUrl, DEFAULT_PRODUCT_FALLBACK_IMAGE, isUploadPath } from "@/lib/product-image";
import { ChevronLeftIcon, ChevronRightIcon } from "@/components/customer/Icons";

export interface GalleryImageItem {
  id?: string;
  url?: string;
  storagePath?: string;
  colorId?: string | null;
  isPrimary?: boolean;
  altText?: string | null;
}

interface ProductGalleryProps {
  productName: string;
  categoryName: string;
  mainImage: string;
  images?: Array<string | GalleryImageItem>;
  isOutOfStock?: boolean;
  discountBadge?: string | null;
  isFeatured?: boolean;
  activeColorId?: string | null;
  activeColorName?: string | null;
  colors?: Array<{
    id: string;
    name: string;
    primaryImage?: string | null;
    images?: Array<string | GalleryImageItem>;
  }>;
}

/**
 * ProductGallery — Responsive, interactive 3D printing product gallery.
 *
 * Supports:
 * - Prev/next arrow buttons with circular looping & accessible labels
 * - High-contrast image counter (e.g., "2 / 5")
 * - Synchronized thumbnail strip with auto-scrolling
 * - Keyboard Left/Right arrows navigation when gallery container is focused
 * - Mobile touch swipe (left for next, right for previous)
 * - Zero layout-shift aspect-square frame
 * - Color variant switching: displays active color's gallery first, followed by shared product photos
 * - Automatic preloading of all color primary photos
 */
export default function ProductGallery({
  productName,
  categoryName,
  mainImage,
  images,
  isOutOfStock = false,
  discountBadge = null,
  isFeatured = false,
  activeColorId = null,
  activeColorName = null,
  colors = [],
}: ProductGalleryProps) {
  // 1. Compute gallery image list with color precedence
  const allImages = useMemo(() => {
    const rawList = images && images.length > 0 ? images : [mainImage];

    if (activeColorId && rawList.some((img) => typeof img === "object" && img !== null && "colorId" in img)) {
      // Color-aware image partition
      const colorSpecific: string[] = [];
      const shared: string[] = [];

      for (const item of rawList) {
        if (typeof item === "object" && item !== null) {
          const url = normalizeImageUrl(item.url || item.storagePath, "");
          if (!url) continue;
          if (item.colorId === activeColorId) {
            colorSpecific.push(url);
          } else if (!item.colorId) {
            shared.push(url);
          }
        } else if (typeof item === "string") {
          const url = normalizeImageUrl(item, "");
          if (url) shared.push(url);
        }
      }

      const combined = [...colorSpecific, ...shared];
      if (combined.length > 0) {
        return Array.from(new Set(combined));
      }
    }

    // Standard list
    const normalized = rawList
      .map((img) => {
        if (typeof img === "object" && img !== null) {
          return normalizeImageUrl(img.url || img.storagePath, "");
        }
        return normalizeImageUrl(img, "");
      })
      .filter(Boolean);

    return normalized.length > 0
      ? Array.from(new Set(normalized))
      : [normalizeImageUrl(mainImage, DEFAULT_PRODUCT_FALLBACK_IMAGE)];
  }, [images, mainImage, activeColorId]);

  const [selectedIndex, setSelectedIndex] = useState(0);

  // Reset to first image whenever active color changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [activeColorId]);

  // Keep index within bounds if image list shrinks
  useEffect(() => {
    if (selectedIndex >= allImages.length) {
      setSelectedIndex(0);
    }
  }, [allImages.length, selectedIndex]);

  // Preload primary images for other colors to ensure zero-flicker transitions
  useEffect(() => {
    if (typeof window === "undefined" || !colors || colors.length === 0) return;
    colors.forEach((c) => {
      if (c.primaryImage) {
        const img = new window.Image();
        img.src = normalizeImageUrl(c.primaryImage, "");
      }
    });
  }, [colors]);

  const hasMultipleImages = allImages.length > 1;
  const currentImage = allImages[selectedIndex] || allImages[0] || DEFAULT_PRODUCT_FALLBACK_IMAGE;

  // Navigation handlers with circular looping
  const handlePrev = useCallback(() => {
    if (allImages.length <= 1) return;
    setSelectedIndex((prev) => (prev === 0 ? allImages.length - 1 : prev - 1));
  }, [allImages.length]);

  const handleNext = useCallback(() => {
    if (allImages.length <= 1) return;
    setSelectedIndex((prev) => (prev === allImages.length - 1 ? 0 : prev + 1));
  }, [allImages.length]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      handlePrev();
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      handleNext();
    }
  };

  // Touch Swipe navigation
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.targetTouches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.targetTouches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (touchStartX.current === null || touchEndX.current === null) return;
    const diff = touchStartX.current - touchEndX.current;
    if (Math.abs(diff) > 40) {
      if (diff > 0) {
        handleNext(); // Swiped left -> next
      } else {
        handlePrev(); // Swiped right -> prev
      }
    }
    touchStartX.current = null;
    touchEndX.current = null;
  };

  // Synchronized thumbnail auto-scroll
  const thumbnailContainerRef = useRef<HTMLDivElement | null>(null);
  const thumbRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    const activeThumb = thumbRefs.current[selectedIndex];
    if (activeThumb && thumbnailContainerRef.current) {
      activeThumb.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "center",
      });
    }
  }, [selectedIndex]);

  // Accessible SEO alt text
  const currentAltText = hasMultipleImages
    ? `${productName}${activeColorName ? ` in ${activeColorName}` : ""} — ${categoryName} 3D print photo ${selectedIndex + 1} of ${allImages.length}`
    : `${productName}${activeColorName ? ` in ${activeColorName}` : ""} — Precision 3D printed ${categoryName.toLowerCase()}`;

  return (
    <div
      id="product-gallery-container"
      data-gallery-container
      className="flex flex-col gap-3.5 w-full focus:outline-none"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      aria-label={`${productName} image gallery. Use arrow keys to navigate photos.`}
    >
      {/* Primary Main Image Frame */}
      <div
        className="relative aspect-square w-full rounded-2xl overflow-hidden select-none group"
        style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-neutral-100)",
          boxShadow: "var(--shadow-card)",
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <Image
          id="gallery-main-image"
          src={currentImage}
          alt={currentAltText}
          fill
          unoptimized={isUploadPath(currentImage)}
          priority
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 600px"
          className={`object-cover transition-opacity duration-200 ${
            isOutOfStock ? "opacity-75 grayscale-30" : ""
          }`}
        />

        {/* Counter Badge */}
        {hasMultipleImages && (
          <div
            id="gallery-image-counter"
            className="absolute top-3.5 right-3.5 z-20 px-2.5 py-1 rounded-full text-[11px] font-bold bg-neutral-900/70 text-white backdrop-blur-md shadow-xs pointer-events-none"
            aria-live="polite"
          >
            {selectedIndex + 1} / {allImages.length}
          </div>
        )}

        {/* Prev / Next Arrows */}
        {hasMultipleImages && (
          <>
            <button
              type="button"
              id="gallery-prev-btn"
              onClick={(e) => {
                e.stopPropagation();
                handlePrev();
              }}
              aria-label="Previous product image"
              className="absolute left-3 top-1/2 -translate-y-1/2 z-20 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white/90 hover:bg-white text-neutral-800 flex items-center justify-center shadow-md backdrop-blur-md transition-all active:scale-95 focus-visible:outline-2 focus-visible:outline-primary cursor-pointer hover:shadow-lg"
            >
              <ChevronLeftIcon size={18} />
            </button>
            <button
              type="button"
              id="gallery-next-btn"
              onClick={(e) => {
                e.stopPropagation();
                handleNext();
              }}
              aria-label="Next product image"
              className="absolute right-3 top-1/2 -translate-y-1/2 z-20 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white/90 hover:bg-white text-neutral-800 flex items-center justify-center shadow-md backdrop-blur-md transition-all active:scale-95 focus-visible:outline-2 focus-visible:outline-primary cursor-pointer hover:shadow-lg"
            >
              <ChevronRightIcon size={18} />
            </button>
          </>
        )}

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

        {/* Mobile image dots indicator */}
        {hasMultipleImages && (
          <div className="absolute bottom-3.5 left-1/2 -translate-x-1/2 flex items-center gap-1.5 z-10 md:hidden bg-black/40 backdrop-blur-sm px-2.5 py-1 rounded-full">
            {allImages.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setSelectedIndex(idx)}
                aria-label={`Jump to image ${idx + 1}`}
                className={`w-2 h-2 rounded-full transition-all duration-200 ${
                  selectedIndex === idx ? "w-4 bg-white" : "bg-white/60"
                }`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Thumbnails Row (Desktop & Tablet) */}
      {hasMultipleImages && (
        <div
          ref={thumbnailContainerRef}
          className="flex items-center gap-2.5 overflow-x-auto pb-1 scrollbar-none scroll-smooth"
          role="tablist"
          aria-label="Product image thumbnails"
        >
          {allImages.map((img, idx) => {
            const isSelected = selectedIndex === idx;
            return (
              <button
                key={idx}
                id={`thumbnail-${idx}`}
                ref={(el) => {
                  thumbRefs.current[idx] = el;
                }}
                type="button"
                role="tab"
                aria-selected={isSelected}
                aria-label={`Thumbnail ${idx + 1} of ${allImages.length}`}
                onClick={() => setSelectedIndex(idx)}
                className="relative w-16 h-16 sm:w-20 sm:h-20 shrink-0 rounded-xl overflow-hidden transition-all duration-200 focus:outline-none cursor-pointer"
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
