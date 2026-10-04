import type { Metadata } from "next";
import { BASE_REVIEWS } from "@/lib/admin-reviews";
import { AdminReviewDetails } from "@/components/admin/reviews/AdminReviewDetails";

interface ReviewDetailsPageProps {
  params: Promise<{
    id: string;
  }>;
}

export const dynamicParams = true;

/**
 * Pre-generate static routes for base demo reviews.
 */
export async function generateStaticParams() {
  return BASE_REVIEWS.map((review) => ({
    id: review.id,
  }));
}

export const metadata: Metadata = {
  title: "Review Details — Dearr Founder Operations",
  description: "Inspect customer feedback, star rating, verified buyer status, and moderation history.",
  robots: {
    index: false,
    follow: false,
  },
};

/**
 * Review Details Page
 * Route: /admin/reviews/[id]
 */
export default async function ReviewDetailsPage({
  params,
}: ReviewDetailsPageProps) {
  const { id } = await params;
  const decodedId = decodeURIComponent(id);
  const initialReview =
    BASE_REVIEWS.find((r) => r.id === decodedId) ?? null;

  return (
    <AdminReviewDetails reviewId={decodedId} initialReview={initialReview} />
  );
}
