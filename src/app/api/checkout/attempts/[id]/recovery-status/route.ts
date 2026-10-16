import { NextRequest, NextResponse } from "next/server";
import { requireUser, handleAuthError, jsonPrivate } from "@/lib/server";
import {
  getAttemptRecoveryStatus,
  CheckoutAttemptError,
} from "@/lib/server/checkout-attempt";

export const dynamic = "force-dynamic";

/**
 * GET /api/checkout/attempts/[id]/recovery-status
 *
 * Checks authoritative attempt recovery status before displaying recovery UI.
 * Reconciles status with server:
 * - If paid / converted -> eligible: false, routes to confirmation.
 * - If recovery already shown -> eligible: false.
 * - If admin turned off recovery sheet -> eligible: false.
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

    const cleanAttemptId = attemptId.trim();
    const status = await getAttemptRecoveryStatus(cleanAttemptId, user.id);

    return jsonPrivate({
      ok: true,
      ...status,
    });
  } catch (err: any) {
    if (err instanceof CheckoutAttemptError) {
      return jsonPrivate(
        { ok: false, error: err.message },
        { status: err.statusCode || 400 }
      );
    }
    return handleAuthError(err, "Failed to retrieve recovery status");
  }
}
