import { NextResponse } from "next/server";
import {
  requireUser,
  handleAuthError,
  getCartForUser,
  clearCartForUser,
  CartValidationError,
} from "@/lib/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/cart
 * Retrieves the currently authenticated customer's active shopping cart.
 *
 * Strict Ownership & Security:
 * - Requires authenticated session via requireUser() (401 if unauthenticated).
 * - Identity derived exclusively from server session cookie; client-supplied userId ignored.
 * - Recalculates trusted prices, B-14 discounts, and server-side totals.
 */
export async function GET() {
  try {
    const user = await requireUser();
    const cart = await getCartForUser(user.id);

    return NextResponse.json({
      ok: true,
      cart,
    });
  } catch (err: unknown) {
    if (err instanceof CartValidationError) {
      return NextResponse.json(
        { ok: false, error: err.message },
        { status: err.statusCode }
      );
    }
    return handleAuthError(err, "Failed to load shopping cart");
  }
}

/**
 * DELETE /api/cart
 * Clears all items from the currently authenticated customer's active shopping cart.
 */
export async function DELETE() {
  try {
    const user = await requireUser();
    const cart = await clearCartForUser(user.id);

    return NextResponse.json({
      ok: true,
      message: "Cart cleared successfully",
      cart,
    });
  } catch (err: unknown) {
    if (err instanceof CartValidationError) {
      return NextResponse.json(
        { ok: false, error: err.message },
        { status: err.statusCode }
      );
    }
    return handleAuthError(err, "Failed to clear shopping cart");
  }
}
