import type { Metadata } from "next";
import { SAMPLE_PRODUCTS } from "@/data/sample-products";
import { AdminEditProductClient } from "@/components/admin";

export const metadata: Metadata = {
  title: "Edit Product — Dearr Founder Operations",
  description: "Update 3D printed product specifications, pricing, inventory, and visibility.",
  robots: {
    index: false,
    follow: false,
  },
};

export const dynamic = "force-dynamic";
export const dynamicParams = true;

export function generateStaticParams() {
  return SAMPLE_PRODUCTS.map((product) => ({
    slug: product.slug,
  }));
}

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function AdminEditProductPage({ params }: PageProps) {
  const { slug } = await params;
  return <AdminEditProductClient slug={slug} />;
}
