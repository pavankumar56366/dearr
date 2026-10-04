import type { Metadata } from "next";
import { AdminDiscountsList } from "@/components/admin/discounts/AdminDiscountsList";

export const metadata: Metadata = {
  title: "Discounts — Dearr Founder Operations",
  description: "Create and manage promotional offers and coupon codes for the Dearr store.",
  robots: {
    index: false,
    follow: false,
  },
};

/**
 * Admin Discounts List Page
 * Route: /admin/discounts
 */
export default function AdminDiscountsPage() {
  return <AdminDiscountsList />;
}

