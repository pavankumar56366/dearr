"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { TrendingSearchItem, TRENDING_PRODUCTS } from "./search-mock-data";
import { isUploadPath } from "@/lib/product-image";

interface TrendingSearchProductsProps {
  products?: TrendingSearchItem[];
  onSelectProduct?: (product: TrendingSearchItem) => void;
}

export function TrendingSearchProducts({
  products = TRENDING_PRODUCTS,
  onSelectProduct,
}: TrendingSearchProductsProps) {
  return (
    <div className="w-full pt-4">
      <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500 mb-4">
        Trending 3D Prints
      </h3>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        {products.map((item) => (
          <Link
            key={item.id}
            href={item.href}
            onClick={() => onSelectProduct && onSelectProduct(item)}
            className="group block p-3 bg-surface border border-neutral-200 rounded-card hover:border-neutral-300 hover:shadow-card transition-all focus-visible:outline-2 focus-visible:outline-primary"
          >
            {/* Aspect Ratio Thumbnail with Local 3D Product Image */}
            <div className="w-full aspect-[4/3] bg-neutral-100 rounded-lg overflow-hidden mb-3 relative border border-neutral-200/60">
              <Image
                src={item.image}
                alt={item.title}
                fill
                unoptimized={isUploadPath(item.image)}
                className="object-cover object-center group-hover:scale-105 transition-transform duration-300"
                sizes="(max-width: 768px) 50vw, 25vw"
              />
            </div>

            {/* Category Subtitle */}
            <div className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider mb-1 line-clamp-1">
              {item.category}
            </div>

            {/* Product / Trend Title */}
            <h4 className="text-xs md:text-sm font-semibold text-neutral-900 group-hover:text-primary transition-colors line-clamp-1 mb-1.5">
              {item.title}
            </h4>

            {/* Price & Accent CTA */}
            <div className="flex items-center justify-between pt-1 border-t border-neutral-100">
              <span className="text-xs font-bold text-neutral-900">
                ₹{item.price.toLocaleString("en-IN")}
              </span>
              <span className="text-[11px] font-semibold text-neutral-700 group-hover:text-primary transition-colors">
                {item.ctaText}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
