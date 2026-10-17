import { Suspense } from "react";
import type { Metadata } from "next";
import CheckoutPageClient from "@/components/customer/checkout/CheckoutPageClient";

export const metadata: Metadata = {
  title: "Checkout — Dearr | 3D Printed Products",
  description: "Complete your Dearr 3D-printed order securely with domestic shipping across India.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function CheckoutPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center p-8 text-neutral-500">Loading checkout...</div>}>
      <CheckoutPageClient />
    </Suspense>
  );
}
