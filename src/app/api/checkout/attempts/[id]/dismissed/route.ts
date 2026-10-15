import { NextRequest, NextResponse } from "next/server";
import { requireUser, handleAuthError } from "@/lib/server/auth";
import {
  markAttemptAbandoned,
  CheckoutAttemptError,
} from "@/lib/server/checkout-attempt";
import { recordInternalEvent } from "@/lib/server/events";

export const dynamic = "force-dynamic";

/**
 * POST /api/checkout/attempts/[id]/dismissed
 *
 * Handles Razorpay checkout modal dismissal.
 * Marks the attempt as abandoned if unpaid, extending retention to 90 days.
 * Suppresses abandonment if payment was already captured or converted.
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

    // Log modal dismissal event safely
    await recordInternalEvent({
      eventType: "razorpay_dismissed",
      attemptId: cleanAttemptId,
      userId: user.id,
    });

    const result = await markAttemptAbandoned(cleanAttemptId, user.id);

    return NextResponse.json({
      ok: true,
      status: result.status,
      isPaid: result.isPaid,
      orderId: result.orderId || null,
      orderNumber: result.orderNumber || null,
    });
  } catch (err: any) {
    if (err instanceof CheckoutAttemptError) {
      return NextResponse.json(
        { ok: false, error: err.message },
        { status: err.statusCode || 400 }
      );
    }
    return handleAuthError(err, "Failed to record modal dismissal");
  }
}
