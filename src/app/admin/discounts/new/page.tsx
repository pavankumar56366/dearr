import type { Metadata } from "next";
import { AdminDiscountForm } from "@/components/admin/discounts/AdminDiscountForm";

export const metadata: Metadata = {
  title: "Add Discount — Dearr Founder Operations",
  description: "Create a new promotional discount or coupon code for the Dearr store.",
  robots: {
    index: false,
    follow: false,
  },
};

/**
 * Add Discount Page
 * Route: /admin/discounts/new
 */
export default function NewDiscountPage() {
  return <AdminDiscountForm mode="create" />;
}

