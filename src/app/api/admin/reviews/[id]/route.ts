import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, handleAuthError } from "@/lib/server/auth";
import { getAdminReviewById, updateAdminReview } from "@/lib/server/review";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/admin/reviews/[id] — Fetch single review details for admin moderation.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    await requireAdmin();
    const { id } = await context.params;
    const decodedId = decodeURIComponent(id);

    const review = await getAdminReviewById(decodedId);
    if (!review) {
      return NextResponse.json({ ok: false, error: "Review not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, review });
  } catch (err: unknown) {
    return handleAuthError(err, "Failed to retrieve review details");
  }
}

/**
 * PATCH /api/admin/reviews/[id] — Moderate review status and update internal notes.
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    await requireAdmin();
    const { id } = await context.params;
    const decodedId = decodeURIComponent(id);

    const body = await request.json();
    const updated = await updateAdminReview(decodedId, {
      status: body.status,
      adminNote: body.adminNote,
    });

    if (!updated) {
      return NextResponse.json({ ok: false, error: "Review not found or update failed" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, review: updated });
  } catch (err: unknown) {
    return handleAuthError(err, "Failed to moderate review");
  }
}
