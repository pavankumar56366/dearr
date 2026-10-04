import type { Metadata } from "next";
import { BASE_CATEGORIES } from "@/lib/admin-categories";
import { AdminEditCategoryClient } from "@/components/admin/categories/AdminEditCategoryClient";

interface EditCategoryPageProps {
  params: Promise<{
    slug: string;
  }>;
}

export const dynamicParams = true;

/**
 * Pre-generate static routes for the base 6 categories.
 */
export async function generateStaticParams() {
  return BASE_CATEGORIES.map((category) => ({
    slug: category.slug,
  }));
}

export const metadata: Metadata = {
  title: "Edit Category — Dearr Founder Operations",
  description: "Update catalog category details, slug, and active status.",
  robots: {
    index: false,
    follow: false,
  },
};

/**
 * Edit Category Page
 * Route: /admin/categories/[slug]/edit
 */
export default async function EditCategoryPage({
  params,
}: EditCategoryPageProps) {
  const { slug } = await params;
  const initialCategory = BASE_CATEGORIES.find((c) => c.slug === slug) ?? null;

  return <AdminEditCategoryClient slug={slug} initialCategory={initialCategory} />;
}
