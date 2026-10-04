import { Suspense } from "react";
import type { Metadata } from "next";
import { ShopPageClient } from "@/components/customer/shop";
import { listProducts, listCategories, type Product, type Category } from "@/lib/server";

export const dynamic = "force-dynamic";

/**
 * Shop / Product Listing Page
 * Route: /shop
 * Supports: ?cat=<slug>, ?sort=<option>
 *
 * Design Ref: docs/4.DESIGN(1) (1).md §4.3 (Grid), §5.3 (Product Card)
 * Flow Ref: docs/3.APPFLOW(1).md §1 (Shop / All Products, Category Products)
 * Implementation Ref: docs/6.IMPLEMENTATION(1).md §5.4
 */

export const metadata: Metadata = {
  title: "Shop — Dearr | 3D Printed Products",
  description:
    "Browse our catalog of precision 3D printed products. Spiritual idols, articulated toys, custom keychains, desk organizers, lithophane lamps and more.",
};

export default async function ShopPage() {
  let initialProducts: Product[] = [];
  let initialCategories: Category[] = [];
  try {
    const [cats, prodsRes] = await Promise.all([
      listCategories({ isActive: true }),
      listProducts({ isActive: true, pageSize: 100 }),
    ]);
    initialCategories = cats;
    initialProducts = prodsRes.products;
  } catch (err: unknown) {
    console.error("[Shop Server Fetch Error]", err);
  }

  return (
    <Suspense
      fallback={
        <div
          className="min-h-screen flex items-center justify-center"
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
              Loading shop…
            </span>
          </div>
        </div>
      }
    >
      <ShopPageClient
        initialProducts={initialProducts}
        initialCategories={initialCategories}
      />
    </Suspense>
  );
}
