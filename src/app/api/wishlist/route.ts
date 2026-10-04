import { NextResponse } from "next/server";
import {
  requireUser,
  handleAuthError,
  getWishlistForUser,
  clearWishlistForUser,
  WishlistValidationError,
} from "@/lib/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/wishlist
 * Retrieves the currently authenticated customer's wishlist with full product details.
 *
 * Strict Ownership & Security:
 * - Requires authenticated session via requireUser() (401 if unauthenticated).
 * - Identity derived exclusively from session cookie; query parameters (like ?userId=) are ignored.
 * - Prevents IDOR: returns only items belonging to the authenticated customer.
 */
export async function GET() {
  try {
    const user = await requireUser();
    const wishlist = await getWishlistForUser(user.id);

    return NextResponse.json({
      ok: true,
      wishlist: {
        id: wishlist.id,
        items: wishlist.items,
        count: wishlist.count,
      },
    });
  } catch (err: unknown) {
    if (err instanceof WishlistValidationError) {
      return NextResponse.json(
        { ok: false, error: err.message },
        { status: err.statusCode }
      );
    }
    return handleAuthError(err, "Failed to load wishlist");
  }
}

/**
 * DELETE /api/wishlist
 * Clears all items from the currently authenticated customer's wishlist.
 */
export async function DELETE() {
  try {
    const user = await requireUser();
    await clearWishlistForUser(user.id);

    return NextResponse.json({
      ok: true,
      message: "Wishlist cleared successfully",
    });
  } catch (err: unknown) {
    if (err instanceof WishlistValidationError) {
      return NextResponse.json(
        { ok: false, error: err.message },
        { status: err.statusCode }
      );
    }
    return handleAuthError(err, "Failed to clear wishlist");
  }
}
