import type { Metadata } from "next";
import { BASE_ORDERS } from "@/lib/admin-orders";
import { AdminOrderDetails } from "@/components/admin/orders/AdminOrderDetails";

interface OrderDetailsPageProps {
  params: Promise<{
    id: string;
  }>;
}

export const dynamicParams = true;

/**
 * Pre-generate static routes for base demo orders.
 */
export async function generateStaticParams() {
  return BASE_ORDERS.map((order) => ({
    id: order.id,
  }));
}

export const metadata: Metadata = {
  title: "Order Details — Dearr Founder Operations",
  description: "Inspect customer details, line items, and fulfillment pipeline status.",
  robots: {
    index: false,
    follow: false,
  },
};

/**
 * Order Details Page
 * Route: /admin/orders/[id]
 */
export default async function OrderDetailsPage({
  params,
}: OrderDetailsPageProps) {
  const { id } = await params;
  const decodedId = decodeURIComponent(id);
  const initialOrder =
    BASE_ORDERS.find(
      (o) =>
        o.id === decodedId ||
        o.orderNumber.toUpperCase() === decodedId.toUpperCase()
    ) ?? null;

  return (
    <AdminOrderDetails orderId={decodedId} initialOrder={initialOrder} />
  );
}
