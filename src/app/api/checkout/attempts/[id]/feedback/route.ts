import { NextRequest, NextResponse } from "next/server";
import { requireUser, handleAuthError, assertSafeOrigin, jsonPrivate } from "@/lib/server";
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
    assertSafeOrigin(request);
    const user = await requireUser();
    const { id: attemptId } = await context.params;

    if (!attemptId || typeof attemptId !== "string" || !attemptId.trim()) {
      return jsonPrivate(
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

    return jsonPrivate(
      {
        ok: true,
        message: feedback.skipped ? "Feedback skipped" : "Feedback saved successfully",
        feedback,
      },
      { status: 201 }
    );
  } catch (err: any) {
    if (err instanceof FeedbackValidationError) {
      return jsonPrivate(
        { ok: false, error: err.message },
        { status: err.statusCode }
      );
    }
    return handleAuthError(err, "Failed to submit checkout feedback");
  }
}

/**
 * GET /api/checkout/attempts/[id]/feedback
 *
 * Retrieves submitted feedback for an attempt.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id: attemptId } = await context.params;

    if (!attemptId || typeof attemptId !== "string" || !attemptId.trim()) {
      return jsonPrivate(
        { ok: false, error: "Attempt ID is required" },
        { status: 400 }
      );
    }

    const feedback = await getFeedbackForAttempt(attemptId.trim(), user.id);
    return jsonPrivate({
      ok: true,
      hasFeedback: Boolean(feedback),
      feedback,
    });
  } catch (err) {
    return handleAuthError(err, "Failed to retrieve feedback");
  }
}
