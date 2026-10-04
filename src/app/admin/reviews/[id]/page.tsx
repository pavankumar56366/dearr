import type { Metadata } from "next";
import { AdminReviewDetails } from "@/components/admin/reviews/AdminReviewDetails";

interface ReviewDetailsPageProps {
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

  return <AdminReviewDetails reviewId={decodedId} />;
}
