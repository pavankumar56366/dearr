import type { Metadata } from "next";
import { AdminCustomersList } from "@/components/admin/customers/AdminCustomersList";

export const metadata: Metadata = {
  title: "Customers — Dearr Founder Operations",
  description: "Manage registered customer profiles, track order counts, and review account statuses.",
  robots: {
    index: false,
    follow: false,
  },
};

/**
 * Admin Customers List Page
 * Route: /admin/customers
 */
export default function AdminCustomersPage() {
  return <AdminCustomersList />;
}
