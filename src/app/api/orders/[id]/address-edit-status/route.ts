import { NextRequest, NextResponse } from "next/server";
import { requireUser, handleAuthError } from "@/lib/server/auth";
import {
  getOrderAddressEditEligibility,
  OrderValidationError,
} from "@/lib/server/order";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/orders/[id]/address-edit-status — Check address edit eligibility and remaining time
 *
 * Enforces ownership: only authenticated order owner or admin can query.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireUser();
    const { id } = await context.params;

    const eligibility = await getOrderAddressEditEligibility(
      id,
      user.id,
      user.role === "admin"
    );

    return NextResponse.json({
      ok: true,
      ...eligibility,
    });
  } catch (err) {
    if (err instanceof OrderValidationError) {
      return NextResponse.json(
        { ok: false, error: err.message },
        { status: err.statusCode }
      );
    }
    return handleAuthError(err, "Failed to retrieve address edit status");
  }
}
