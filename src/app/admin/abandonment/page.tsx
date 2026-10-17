import type { Metadata } from "next";
import { AdminAbandonmentDashboard } from "@/components/admin/abandonment/AdminAbandonmentDashboard";

export const metadata: Metadata = {
  title: "Cart Abandonment & Recovery — Dearr Founder Operations",
  description: "Track checkout abandonment, payment failures, recovery sheet engagement, and customer feedback.",
  robots: {
    index: false,
    follow: false,
  },
};

/**
 * Admin Cart Abandonment Analytics Page
 * Route: /admin/abandonment
 */
export default function AdminAbandonmentPage() {
  return <AdminAbandonmentDashboard />;
}
