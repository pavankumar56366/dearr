import { NextRequest, NextResponse } from "next/server";
import { requireUser, handleAuthError } from "@/lib/server/auth";
import {
  recordRecoveryShown,
  CheckoutAttemptError,
} from "@/lib/server/checkout-attempt";

export const dynamic = "force-dynamic";

/**
 * POST /api/checkout/attempts/[id]/recovery-shown
 *
 * Idempotently marks recovery_shown_at = NOW() so reopening the browser
 * or repeated callbacks cannot repeatedly trigger the recovery sheet for the same attempt.
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
    const result = await recordRecoveryShown(cleanAttemptId, user.id);

    return NextResponse.json({
      ok: true,
      ...result,
    });
  } catch (err: any) {
    if (err instanceof CheckoutAttemptError) {
      return NextResponse.json(
        { ok: false, error: err.message },
        { status: err.statusCode || 400 }
      );
    }
    return handleAuthError(err, "Failed to record recovery presentation");
  }
}
