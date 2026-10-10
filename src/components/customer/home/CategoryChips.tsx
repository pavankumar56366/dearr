"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  SpiritualIdolsIcon,
  ArticulatedToysIcon,
  CustomKeychainsIcon,
  DeskOrganizersIcon,
  LithophaneLampsIcon,
  MiniaturesDecorIcon,
  StudyProjectsIcon,
  SparkleIcon,
} from "@/components/customer/Icons";

export interface CategoryChipItem {
  id: string;
  name: string;
  slug: string;
  icon?: string;
  description?: string | null;
}

interface CategoryChipsProps {
  initialCategories?: CategoryChipItem[];
}

const CATEGORY_SVG_MAP: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  "spiritual-idols": SpiritualIdolsIcon,
  "articulated-toys": ArticulatedToysIcon,
  "custom-keychains": CustomKeychainsIcon,
  "desk-organizers": DeskOrganizersIcon,
  "lithophane-lamps": LithophaneLampsIcon,
  "miniatures-decor": MiniaturesDecorIcon,
  "home-decor": MiniaturesDecorIcon,
  "study-projects": StudyProjectsIcon,
};

/**
 * CategoryChips — Horizontally scrollable 3D printing category row.
 * Design Ref: docs/4.DESIGN(1) (1).md §6.1 (Category Row)
 *
 * Connected directly to real MySQL categories.
 * Renders official Dearr SVG category icons extracted from docs/dearr_icons.zip.
 */
export default function CategoryChips({ initialCategories }: CategoryChipsProps) {
  const [categories, setCategories] = useState<CategoryChipItem[]>(initialCategories || []);

  useEffect(() => {
    if (initialCategories && initialCategories.length > 0) {
      setCategories(initialCategories);
      return;
    }

    let isMounted = true;
    async function fetchCategories() {
      try {
        const res = await fetch("/api/categories");
        if (res.ok) {
          const data = await res.json();
          if (data.ok && Array.isArray(data.categories) && isMounted) {
            setCategories(data.categories);
          }
        }
      } catch {
        // Fail safely without substituting mock categories
      }
    }

    fetchCategories();

    return () => {
      isMounted = false;
    };
  }, [initialCategories]);

  if (!categories || categories.length === 0) {
    return null;
  }

  return (
    <section id="category-chips" className="w-full py-6 md:py-10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section Heading */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2
              className="font-display text-xl sm:text-2xl font-bold"
              style={{ color: "var(--color-neutral-900)" }}
            >
              Explore 3D Printed Collections
            </h2>
            <p className="text-xs sm:text-sm text-neutral-500 mt-0.5">
              Precision crafted designs for your home, desk, and sacred spaces
            </p>
          </div>
          <Link
            href="/shop"
            className="text-sm font-semibold hover:underline transition-colors shrink-0 ml-4"
            style={{ color: "var(--color-primary)" }}
          >
            View All →
          </Link>
        </div>

        {/* Scrollable Chip Row */}
        <div
          className="flex gap-3 overflow-x-auto pb-2"
          style={{
            scrollbarWidth: "none",
            msOverflowStyle: "none",
          }}
        >
          {categories.map((cat) => {
            const SvgIcon = CATEGORY_SVG_MAP[cat.slug] || SparkleIcon;

            return (
              <Link
                key={cat.id}
                href={`/shop?cat=${cat.slug}`}
                className="group flex flex-col items-center gap-2 shrink-0"
              >
                {/* Chip Circle */}
                <div
                  className="w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center p-3 transition-all duration-200 group-hover:scale-105 group-hover:shadow-lg"
                  style={{
                    background: "var(--color-neutral-100)",
                    border: "2px solid transparent",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLDivElement).style.borderColor = "var(--color-primary)";
                    (e.currentTarget as HTMLDivElement).style.background = "rgba(162, 203, 139, 0.12)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLDivElement).style.borderColor = "transparent";
                    (e.currentTarget as HTMLDivElement).style.background = "var(--color-neutral-100)";
                  }}
                >
                  <SvgIcon size={36} />
                </div>
                {/* Label */}
                <span
                  className="text-xs sm:text-sm font-medium text-center whitespace-nowrap"
                  style={{ color: "var(--color-neutral-700)" }}
                >
                  {cat.name}
                </span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Hide scrollbar CSS */}
      <style jsx>{`
        div::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </section>
  );
}
