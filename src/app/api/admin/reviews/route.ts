import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, handleAuthError } from "@/lib/server/auth";
import { listAdminReviews } from "@/lib/server/review";
import type { ReviewStatus } from "@/lib/admin-reviews";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/admin/reviews — List reviews for Admin Moderation.
 * Enforces requireAdmin(). Returns sanitized review records with product metadata.
 */
export async function GET(request: NextRequest) {
  try {
    await requireAdmin();

    const url = new URL(request.url);
    const search = url.searchParams.get("search") || undefined;
    const statusParam = url.searchParams.get("status") as ReviewStatus | "ALL" | null;
    const ratingParam = url.searchParams.get("rating");

    const reviews = await listAdminReviews({
      search,
      status: statusParam || undefined,
      rating: ratingParam ? parseInt(ratingParam, 10) : undefined,
    });

    return NextResponse.json({
      ok: true,
      reviews,
    });
  } catch (err: unknown) {
    return handleAuthError(err, "Failed to retrieve reviews");
  }
}
