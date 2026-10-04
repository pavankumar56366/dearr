import type { Metadata } from "next";
import { WishlistPageClient } from "@/components/customer/wishlist";

/**
 * Customer Wishlist Page
 * Route: /wishlist
 * Design Ref: docs/4.DESIGN(1) (1).md §6.6 (Wishlist)
 * Flow Ref: docs/3.APPFLOW(1).md §4.5 (Wishlist Flow)
 *
 * Provides:
 * - Saved 3D printing products list
 * - Removal control per item
 * - Add to Cart action with local confirmation
 * - Empty wishlist state with navigation back to shop
 * - Responsive 2-column mobile to 4-column desktop grid
 */

export const metadata: Metadata = {
  title: "My Wishlist — Dearr | 3D Printed Products",
  description:
    "View and manage your saved 3D printed products, spiritual idols, articulated desk toys, and custom keychains.",
};

export default function WishlistPage() {
  return <WishlistPageClient />;
}
