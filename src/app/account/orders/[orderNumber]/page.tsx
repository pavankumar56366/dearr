import type { Metadata } from "next";
import OrderDetailPageClient from "./OrderDetailPageClient";

export const metadata: Metadata = {
  title: "Order Details — Dearr | 3D Printed Products",
  description: "View your order details, status, and 3D print production timeline.",
  robots: {
    index: false,
    follow: false,
  },
};

interface OrderDetailPageProps {
  params: Promise<{ orderNumber: string }>;
}

export default async function OrderDetailPage({ params }: OrderDetailPageProps) {
  const { orderNumber } = await params;
  return <OrderDetailPageClient orderNumber={orderNumber} />;
}
