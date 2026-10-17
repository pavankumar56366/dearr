import { NextRequest, NextResponse } from "next/server";
import { requireUser, handleAuthError, assertSafeOrigin, jsonPrivate } from "@/lib/server";
import {
  markAttemptFailed,
  CheckoutAttemptError,
} from "@/lib/server/checkout-attempt";

export const dynamic = "force-dynamic";

/**
 * POST /api/checkout/attempts/[id]/failed
 *
 * Records verified payment failure on a checkout attempt.
 * Sanitizes failure reason and description.
 * Extends retention to 90 days.
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

    const result = await markAttemptFailed(
      cleanAttemptId,
      {
        code: body.code || body.errorCode || body?.error?.code,
        description: body.description || body.errorDescription || body?.error?.description,
        source: body.source || body?.error?.source,
        step: body.step || body?.error?.step,
        reason: body.reason || body?.error?.reason,
      },
      user.id
    );

    return jsonPrivate({
      ok: true,
      status: result.status,
      isPaid: result.isPaid,
      orderId: result.orderId || null,
      orderNumber: result.orderNumber || null,
    });
  } catch (err: any) {
    if (err instanceof CheckoutAttemptError) {
      return jsonPrivate(
        { ok: false, error: err.message },
        { status: err.statusCode || 400 }
      );
    }
    return handleAuthError(err, "Failed to record payment failure");
  }
}
