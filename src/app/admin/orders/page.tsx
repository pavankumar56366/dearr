import type { Metadata } from "next";
import { AdminOrdersList } from "@/components/admin/orders/AdminOrdersList";

export const metadata: Metadata = {
  title: "Orders — Dearr Founder Operations",
  description: "Track customer orders, manage 3D printing fulfillment stages, and monitor payments.",
  robots: {
    index: false,
    follow: false,
  },
};

/**
 * Admin Orders List Page
 * Route: /admin/orders
 */
export default function AdminOrdersPage() {
  return <AdminOrdersList />;
}
