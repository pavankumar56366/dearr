import type { Metadata } from "next";
import { BASE_CUSTOMERS } from "@/lib/admin-customers";
import { AdminCustomerDetails } from "@/components/admin/customers/AdminCustomerDetails";

interface CustomerDetailsPageProps {
  params: Promise<{
    id: string;
  }>;
}

export const dynamicParams = true;

/**
 * Pre-generate static routes for base demo customers.
 */
export async function generateStaticParams() {
  return BASE_CUSTOMERS.map((customer) => ({
    id: customer.id,
  }));
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
  const initialCustomer =
    BASE_CUSTOMERS.find((c) => c.id === decodedId) ?? null;

  return (
    <AdminCustomerDetails
      customerId={decodedId}
      initialCustomer={initialCustomer}
    />
  );
}
