import { NextRequest, NextResponse } from "next/server";
import { requireUser, handleAuthError } from "@/lib/server/auth";
import {
  swapCartItemForAlternative,
  AlternativesError,
} from "@/lib/server/alternatives";
import { getCartForUser } from "@/lib/server/cart";

export const dynamic = "force-dynamic";

/**
 * POST /api/cart/swap
 *
 * Swaps a line item in customer's active cart for an alternative product/variant.
 *
 * Body: {
 *   sourceProductId: string,
 *   sourceColorId?: string,
 *   alternativeProductId: string,
 *   alternativeColorId?: string,
 *   expectedAlternativePrice?: number,
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    const body = await request.json();

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { ok: false, error: "Invalid JSON request body" },
        { status: 400 }
      );
    }

    const {
      sourceProductId,
      sourceColorId,
      alternativeProductId,
      alternativeColorId,
      expectedAlternativePrice,
      attemptId,
    } = body;

    if (!sourceProductId || !alternativeProductId) {
      return NextResponse.json(
        { ok: false, error: "sourceProductId and alternativeProductId are required" },
        { status: 400 }
      );
    }

    const swapResult = await swapCartItemForAlternative({
      userId: user.id,
      sourceProductId,
      sourceColorId,
      alternativeProductId,
      alternativeColorId,
      expectedAlternativePrice:
        expectedAlternativePrice !== undefined
          ? Number(expectedAlternativePrice)
          : undefined,
      attemptId: attemptId ? String(attemptId).trim() : undefined,
    });

    // Return the refreshed authoritative cart
    const refreshedCart = await getCartForUser(user.id);

    return NextResponse.json({
      ok: true,
      message: swapResult.message,
      swappedItem: swapResult.swappedItem,
      newAttempt: swapResult.newAttempt,
      newAttemptId: swapResult.newAttemptId,
      cart: refreshedCart,
    });
  } catch (err: any) {
    if (err instanceof AlternativesError) {
      return NextResponse.json(
        { ok: false, error: err.message },
        { status: err.statusCode || 400 }
      );
    }
    return handleAuthError(err, "Failed to swap cart item");
  }
}
