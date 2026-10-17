import { NextRequest, NextResponse } from "next/server";
import { requireUser, handleAuthError } from "@/lib/server/auth";
import { getLowerPricedAlternatives } from "@/lib/server/alternatives";
import { getCartForUser } from "@/lib/server/cart";

export const dynamic = "force-dynamic";

/**
 * GET /api/cart/alternatives
 *
 * Query params:
 *   productId: string (required)
 *   colorId: string (optional)
 *   sourcePrice: number (required)
 *   attemptId: string (optional)
 *   limit: number (optional)
 *
 * Returns server-authoritative lower-priced alternatives in the same category.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireUser();
    const url = new URL(request.url);

    const productId = url.searchParams.get("productId") || url.searchParams.get("item");
    const colorId = url.searchParams.get("colorId");
    const rawPrice = url.searchParams.get("sourcePrice") || url.searchParams.get("price");
    const attemptId = url.searchParams.get("attemptId");
    const rawLimit = url.searchParams.get("limit");
    const rawQuantity = url.searchParams.get("quantity");
    const quantity = rawQuantity ? parseInt(rawQuantity, 10) : undefined;

    if (!productId) {
      return NextResponse.json(
        { ok: false, error: "productId parameter is required" },
        { status: 400 }
      );
    }

    const sourcePrice = rawPrice ? Number(rawPrice) : NaN;
    if (isNaN(sourcePrice) || sourcePrice <= 0) {
      return NextResponse.json(
        { ok: false, error: "sourcePrice parameter must be a positive number" },
        { status: 400 }
      );
    }

    if (attemptId) {
      const { getCheckoutAttemptById } = await import("@/lib/server/checkout-attempt");
      const att = await getCheckoutAttemptById(attemptId.trim());
      if (att && att.userId !== user.id) {
        return NextResponse.json(
          { ok: false, error: "Forbidden: Unauthorized attempt access" },
          { status: 403 }
        );
      }
    }

    // Load active cart to exclude products already in user's cart
    let cartProductIds: string[] = [];
    try {
      const cart = await getCartForUser(user.id);
      cartProductIds = (cart.items || []).map((it) => it.productId);
    } catch {}

    const alternatives = await getLowerPricedAlternatives({
      productId,
      colorId,
      sourcePrice,
      quantity,
      cartItemProductIds: cartProductIds,
      limit: rawLimit ? parseInt(rawLimit, 10) : 4,
      attemptId,
      userId: user.id,
    });

    return NextResponse.json({
      ok: true,
      alternatives,
      count: alternatives.length,
    });
  } catch (err: any) {
    return handleAuthError(err, "Failed to load alternative products");
  }
}
