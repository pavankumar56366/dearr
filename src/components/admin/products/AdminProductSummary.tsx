"use client";

import React from "react";
import Image from "next/image";
import { ImageIcon, StarIcon, LayersIcon, ShieldCheckIcon } from "../AdminIcons";
import { isUploadPath } from "@/lib/product-image";

interface AdminProductSummaryProps {
  title: string;
  slug: string;
  category: string;
  price: number | null;
  compareAtPrice: number | null;
  stockQuantity: number | null;
  sku: string;
  material?: string;
  finish?: string;
  color?: string;
  dimensions?: string;
  primaryImage: string | null;
  isActive: boolean;
  isFeatured: boolean;
  variantsCount: number;
}

/**
 * AdminProductSummary — Real-time operational preview panel for Dearr admins.
 *
 * Provides instant visual confirmation of the product's catalog presence,
 * pricing calculation, stock indicators, and 3D printing technical details.
 */
export function AdminProductSummary({
  title,
  slug,
  category,
  price,
  compareAtPrice,
  stockQuantity,
  sku,
  material,
  finish,
  color,
  dimensions,
  primaryImage,
  isActive,
  isFeatured,
  variantsCount,
}: AdminProductSummaryProps) {
  // Stock Status calculation matching Dearr standards
  const stockVal = stockQuantity ?? 0;
  const isOutOfStock = stockVal <= 0;
  const isLowStock = stockVal > 0 && stockVal <= 5;

  // Discount calculation
  const hasValidDiscount =
    price !== null &&
    compareAtPrice !== null &&
    compareAtPrice > price &&
    price > 0;

  const discountPercent = hasValidDiscount
    ? Math.round(((compareAtPrice! - price!) / compareAtPrice!) * 100)
    : null;

  return (
    <aside
      aria-label="Live Catalog Preview"
      className="bg-surface rounded-2xl border border-neutral-200/90 shadow-card p-5 space-y-4 md:sticky md:top-20"
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
            Catalog Confirmation
          </span>
          <h3 className="font-bold text-sm text-neutral-900">
            Live Product Summary
          </h3>
        </div>
        <div className="flex items-center gap-1.5">
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
              isActive
                ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                : "bg-neutral-100 text-neutral-500 border-neutral-200"
            }`}
          >
            {isActive ? "Active (Visible)" : "Draft (Hidden)"}
          </span>
        </div>
      </div>

      {/* Visual Cover Preview */}
      <div className="relative aspect-square w-full rounded-xl bg-neutral-100 border border-neutral-200/80 overflow-hidden flex items-center justify-center">
        {primaryImage ? (
          <Image
            src={primaryImage}
            alt={title || "Product preview"}
            fill
            unoptimized={isUploadPath(primaryImage)}
            sizes="(max-width: 768px) 100vw, 320px"
            className="object-cover"
          />
        ) : (
          <div className="flex flex-col items-center justify-center p-4 text-center text-neutral-400 space-y-1.5">
            <div className="w-12 h-12 rounded-xl bg-white border border-neutral-200 flex items-center justify-center">
              <ImageIcon size={22} className="text-neutral-400" />
            </div>
            <span className="text-xs font-semibold text-neutral-500">
              No Cover Photo
            </span>
            <span className="text-[10px] text-neutral-400 max-w-[180px]">
              Add images to preview how this 3D print looks on the catalog
            </span>
          </div>
        )}

        {/* Featured Tag Badge */}
        {isFeatured && (
          <div className="absolute top-2.5 left-2.5 z-10 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-neutral-900 text-white shadow-xs">
            <StarIcon size={11} className="text-secondary fill-secondary" />
            <span>Featured</span>
          </div>
        )}

        {/* Category Pill Over Image */}
        {category && (
          <div className="absolute bottom-2.5 left-2.5 z-10 px-2.5 py-0.5 rounded-lg text-[10px] font-bold bg-white/95 text-neutral-800 border border-neutral-200/80 shadow-xs backdrop-blur-xs">
            {category}
          </div>
        )}
      </div>

      {/* Product Titles & Slug */}
      <div className="space-y-1">
        <h4 className="font-bold text-base text-neutral-900 leading-snug line-clamp-2">
          {title.trim() ? title : "Untitled 3D Printed Product"}
        </h4>
        <div className="text-[11px] font-mono text-neutral-500 truncate">
          /{slug.trim() ? slug : "product-slug"}
        </div>
      </div>

      {/* Pricing & Discount Snapshot */}
      <div className="p-3 rounded-xl bg-neutral-50 border border-neutral-200/80 flex items-center justify-between">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block">
            Storefront Price
          </span>
          <div className="flex items-baseline gap-2 mt-0.5">
            <span className="text-xl font-extrabold text-neutral-900">
              {price !== null && price > 0
                ? `₹${price.toLocaleString("en-IN")}`
                : "₹0"}
            </span>
            {compareAtPrice !== null && compareAtPrice > 0 && (
              <span className="text-xs text-neutral-400 line-through">
                ₹{compareAtPrice.toLocaleString("en-IN")}
              </span>
            )}
          </div>
        </div>

        {discountPercent !== null && (
          <div className="text-right">
            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
              {discountPercent}% OFF
            </span>
          </div>
        )}
      </div>

      {/* Inventory & SKU Info */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="p-2.5 rounded-xl border border-neutral-200 bg-white">
          <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block">
            Stock Status
          </span>
          <div className="mt-1 flex items-center gap-1.5">
            {isOutOfStock ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-700">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                Out of Stock (0)
              </span>
            ) : isLowStock ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                Low Stock ({stockVal})
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                In Stock ({stockVal})
              </span>
            )}
          </div>
        </div>

        <div className="p-2.5 rounded-xl border border-neutral-200 bg-white">
          <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block">
            SKU Code
          </span>
          <span className="font-mono text-xs font-bold text-neutral-800 block truncate mt-1">
            {sku.trim() ? sku.toUpperCase() : "—"}
          </span>
        </div>
      </div>

      {/* 3D Print Specifications Snapshot */}
      <div className="p-3 rounded-xl border border-neutral-100 bg-neutral-50/70 space-y-1.5 text-xs">
        <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block">
          3D Workshop Specs
        </span>
        <div className="grid grid-cols-2 gap-y-1 gap-x-2 text-[11px]">
          <div>
            <span className="text-neutral-500">Filament:</span>{" "}
            <span className="font-semibold text-neutral-800 truncate block">
              {material || "Eco PLA"}
            </span>
          </div>
          <div>
            <span className="text-neutral-500">Color:</span>{" "}
            <span className="font-semibold text-neutral-800 truncate block">
              {color || "Default"}
            </span>
          </div>
          <div>
            <span className="text-neutral-500">Finish:</span>{" "}
            <span className="font-semibold text-neutral-800 truncate block">
              {finish || "Standard"}
            </span>
          </div>
          <div>
            <span className="text-neutral-500">Dimensions:</span>{" "}
            <span className="font-semibold text-neutral-800 truncate block">
              {dimensions || "—"}
            </span>
          </div>
        </div>
      </div>

      {/* Variants Count Indicator */}
      <div className="flex items-center justify-between text-xs text-neutral-600 px-1 pt-1 border-t border-neutral-100">
        <div className="flex items-center gap-1.5">
          <LayersIcon size={14} className="text-neutral-400" />
          <span>
            {variantsCount === 0
              ? "Single Standard Model"
              : `${variantsCount} Variant Option(s)`}
          </span>
        </div>
        <span className="text-[10px] text-neutral-400 font-mono">Dearr V1</span>
      </div>

      {/* Operational Assurance Note */}
      <div className="flex items-start gap-2 p-2.5 rounded-xl bg-primary/10 border border-primary/30 text-[11px] text-neutral-700 leading-relaxed">
        <ShieldCheckIcon size={15} className="text-neutral-900 shrink-0 mt-0.5" />
        <span>
          Values in this preview reflect live form state and calculate retail margins instantly.
        </span>
      </div>
    </aside>
  );
}
