import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminProductsList, AdminProductsSkeleton } from "@/components/admin";

export const metadata: Metadata = {
  title: "Products — Dearr Founder Admin",
  description: "Manage 3D printed products, pricing, inventory stock, and availability.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function AdminProductsPage() {
  return (
    <Suspense fallback={<AdminProductsSkeleton />}>
      <AdminProductsList />
    </Suspense>
  );
}
