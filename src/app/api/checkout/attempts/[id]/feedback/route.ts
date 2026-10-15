import { NextRequest, NextResponse } from "next/server";
import { requireUser, handleAuthError } from "@/lib/server/auth";
import {
  submitCheckoutFeedback,
  getFeedbackForAttempt,
  FeedbackValidationError,
} from "@/lib/server/checkout-feedback";

export const dynamic = "force-dynamic";

/**
 * POST /api/checkout/attempts/[id]/feedback
 *
 * Submits or skips post-abandonment feedback for a checkout attempt.
 * Enforces one submission per attempt, rate limiting, and comment sanitization.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id: attemptId } = await context.params;

    if (!attemptId || typeof attemptId !== "string" || !attemptId.trim()) {
      return NextResponse.json(
        { ok: false, error: "Attempt ID is required" },
        { status: 400 }
      );
    }

    const cleanAttemptId = attemptId.trim();
    let body: any = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    const clientIp =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "127.0.0.1";

    const feedback = await submitCheckoutFeedback({
      attemptId: cleanAttemptId,
      userId: user.id,
      reasons: body.reasons,
      comment: body.comment,
      skipped: Boolean(body.skipped),
      ipAddress: clientIp,
    });

    return NextResponse.json(
      {
        ok: true,
        message: feedback.skipped ? "Feedback skipped" : "Feedback saved successfully",
        feedback,
      },
      { status: 201 }
    );
  } catch (err: any) {
    if (err instanceof FeedbackValidationError) {
      return NextResponse.json(
        { ok: false, error: err.message },
        { status: err.statusCode || 400 }
      );
    }
    return handleAuthError(err, "Failed to submit checkout feedback");
  }
}

/**
 * GET /api/checkout/attempts/[id]/feedback
 *
 * Returns feedback for this attempt if already submitted.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id: attemptId } = await context.params;

    if (!attemptId || typeof attemptId !== "string" || !attemptId.trim()) {
      return NextResponse.json(
        { ok: false, error: "Attempt ID is required" },
        { status: 400 }
      );
    }

    const feedback = await getFeedbackForAttempt(attemptId.trim(), user.id);

    return NextResponse.json({
      ok: true,
      hasFeedback: Boolean(feedback),
      feedback,
    });
  } catch (err: any) {
    return handleAuthError(err, "Failed to retrieve checkout feedback");
  }
}
