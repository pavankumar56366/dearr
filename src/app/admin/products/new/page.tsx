import type { Metadata } from "next";
import { AdminProductForm } from "@/components/admin";

export const metadata: Metadata = {
  title: "Add Product — Dearr Founder Operations",
  description: "Create a new 3D printed product for the Dearr catalog.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function AdminNewProductPage() {
  return <AdminProductForm />;
}
