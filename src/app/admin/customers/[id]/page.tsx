import type { Metadata } from "next";
import { AdminCustomerDetails } from "@/components/admin/customers/AdminCustomerDetails";

interface CustomerDetailsPageProps {
  params: Promise<{
    id: string;
  }>;
}

export const dynamic = "force-dynamic";
export const dynamicParams = true;

export async function generateStaticParams() {
  return [];
}

export const metadata: Metadata = {
  title: "Customer Details — Dearr Founder Operations",
  description: "Inspect customer overview, lifetime purchase history, metrics, and delivery destinations.",
  robots: {
    index: false,
    follow: false,
  },
};

/**
 * Customer Details Page
 * Route: /admin/customers/[id]
 */
export default async function CustomerDetailsPage({
  params,
}: CustomerDetailsPageProps) {
  const { id } = await params;
  const decodedId = decodeURIComponent(id);

  return <AdminCustomerDetails customerId={decodedId} />;
}
