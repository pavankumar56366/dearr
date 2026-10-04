import type { Metadata } from "next";
import { AdminCategoryForm } from "@/components/admin/categories/AdminCategoryForm";

export const metadata: Metadata = {
  title: "Add Category — Dearr Founder Operations",
  description: "Create a new product category for the Dearr catalog.",
  robots: {
    index: false,
    follow: false,
  },
};

/**
 * Add Category Page
 * Route: /admin/categories/new
 */
export default function AddCategoryPage() {
  return <AdminCategoryForm mode="create" />;
}

