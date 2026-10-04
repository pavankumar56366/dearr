import type { Metadata } from "next";
import { BASE_CUSTOMERS } from "@/lib/admin-customers";
import { AdminCustomerForm } from "@/components/admin/customers/AdminCustomerForm";

interface EditCustomerPageProps {
  params: Promise<{
    id: string;
  }>;
}

export const dynamicParams = true;

/**
 * Pre-generate static routes for editing base demo customers.
 */
export async function generateStaticParams() {
  return BASE_CUSTOMERS.map((customer) => ({
    id: customer.id,
  }));
}

export const metadata: Metadata = {
  title: "Edit Customer — Dearr Founder Operations",
  description: "Update customer contact information, delivery address, and account lifecycle status.",
  robots: {
    index: false,
    follow: false,
  },
};

/**
 * Edit Customer Page
 * Route: /admin/customers/[id]/edit
 */
export default async function EditCustomerPage({
  params,
}: EditCustomerPageProps) {
  const { id } = await params;
  const decodedId = decodeURIComponent(id);
  const initialCustomer =
    BASE_CUSTOMERS.find((c) => c.id === decodedId) ?? null;

  return (
    <AdminCustomerForm
      customerId={decodedId}
      initialCustomer={initialCustomer}
    />
  );
}
