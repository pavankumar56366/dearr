import type { Metadata } from "next";
import { AdminCategoriesList } from "@/components/admin/categories/AdminCategoriesList";

export const metadata: Metadata = {
  title: "Categories — Dearr Founder Operations",
  description: "Manage product categories, status, and catalog taxonomy.",
  robots: {
    index: false,
    follow: false,
  },
};

/**
 * Admin Categories Page
 * Route: /admin/categories
 */
export default function AdminCategoriesPage() {
  return <AdminCategoriesList />;
}

