import type { Metadata } from "next";
import { AdminCustomerForm } from "@/components/admin/customers/AdminCustomerForm";

interface EditCustomerPageProps {
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

  return <AdminCustomerForm customerId={decodedId} />;
}
