import type { Metadata } from "next";
import { BASE_DISCOUNTS } from "@/lib/admin-discounts";
import { AdminEditDiscountClient } from "@/components/admin/discounts/AdminEditDiscountClient";

interface EditDiscountPageProps {
  params: Promise<{
    code: string;
  }>;
}

export const dynamicParams = true;

/**
 * Pre-generate static routes for the base demo discount codes.
 */
export async function generateStaticParams() {
  return BASE_DISCOUNTS.map((discount) => ({
    code: discount.code.toLowerCase(),
  }));
}

export const metadata: Metadata = {
  title: "Edit Discount — Dearr Founder Operations",
  description: "Update promotional discount details, coupon code, validity dates, and active status.",
  robots: {
    index: false,
    follow: false,
  },
};

/**
 * Edit Discount Page
 * Route: /admin/discounts/[code]/edit
 */
export default async function EditDiscountPage({
  params,
}: EditDiscountPageProps) {
  const { code } = await params;
  const decodedCode = decodeURIComponent(code).toUpperCase();
  const initialDiscount =
    BASE_DISCOUNTS.find((d) => d.code.toUpperCase() === decodedCode) ?? null;

  return (
    <AdminEditDiscountClient code={decodedCode} initialDiscount={initialDiscount} />
  );
}

