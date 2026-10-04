import type { Metadata } from "next";
import { AdminReviewsList } from "@/components/admin/reviews/AdminReviewsList";

export const metadata: Metadata = {
  title: "Reviews & Ratings — Dearr Founder Operations",
  description: "Moderate customer reviews, ratings distribution, and publication approvals.",
  robots: {
    index: false,
    follow: false,
  },
};

/**
 * Admin Reviews List Page
 * Route: /admin/reviews
 */
export default function AdminReviewsPage() {
  return <AdminReviewsList />;
}
