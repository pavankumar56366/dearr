import type { Metadata } from "next";
import { Suspense } from "react";
import OrderConfirmationClient from "@/components/customer/order/OrderConfirmationClient";

export const metadata: Metadata = {
  title: "Order Confirmed — Dearr | 3D Printed Products",
  description: "Your Dearr 3D-printed order has been registered in our fabrication queue.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function OrderConfirmedPage() {
  return (
    <Suspense
      fallback={
        <div
          className="min-h-screen flex items-center justify-center"
          style={{ background: "var(--color-canvas)" }}
        >
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 rounded-full border-4 border-[#A2CB8B] border-t-transparent animate-spin" />
            <span className="text-xs font-semibold text-neutral-600">Loading Order Confirmation...</span>
          </div>
        </div>
      }
    >
      <OrderConfirmationClient />
    </Suspense>
  );
}
