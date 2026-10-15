import { NextRequest, NextResponse } from "next/server";
import { requireUser, handleAuthError } from "@/lib/server/auth";
import { getCheckoutAttemptById, CheckoutAttemptError } from "@/lib/server/checkout-attempt";
import { recordInternalEvent } from "@/lib/server/events";

export const dynamic = "force-dynamic";

/**
 * POST /api/checkout/attempts/[id]/opened
 *
 * Records client-side event when Razorpay payment modal is opened for an attempt.
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
    const attempt = await getCheckoutAttemptById(cleanAttemptId);
    if (!attempt) {
      return NextResponse.json(
        { ok: false, error: "Attempt not found" },
        { status: 404 }
      );
    }

    if (attempt.userId !== user.id) {
      return NextResponse.json(
        { ok: false, error: "Forbidden: Unauthorized attempt access" },
        { status: 403 }
      );
    }

    await recordInternalEvent({
      eventType: "razorpay_opened",
      attemptId: cleanAttemptId,
      userId: user.id,
      metadata: {
        amount: attempt.amount,
        provider: attempt.provider,
      },
    });

    return NextResponse.json({
      ok: true,
      message: "Razorpay opened event recorded",
    });
  } catch (err: any) {
    if (err instanceof CheckoutAttemptError) {
      return NextResponse.json(
        { ok: false, error: err.message },
        { status: err.statusCode || 400 }
      );
    }
    return handleAuthError(err, "Failed to record razorpay opened event");
  }
}
