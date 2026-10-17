import { NextRequest, NextResponse } from "next/server";
import { requireUser, handleAuthError, assertSafeOrigin, jsonPrivate } from "@/lib/server";
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
    assertSafeOrigin(request);
    const user = await requireUser();
    const body = await request.json();

    if (!body || typeof body !== "object") {
      return jsonPrivate(
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
      return jsonPrivate(
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
      attemptId: attemptId || undefined,
    });

    const refreshedCart = await getCartForUser(user.id);

    return jsonPrivate({
      ok: true,
      message: "Alternative accepted and applied to cart.",
      swap: swapResult,
      cart: refreshedCart,
    });
  } catch (err: unknown) {
    if (err instanceof AlternativesError) {
      return jsonPrivate(
        { ok: false, error: err.message },
        { status: err.statusCode }
      );
    }
    return handleAuthError(err, "Failed to apply alternative product");
  }
}
