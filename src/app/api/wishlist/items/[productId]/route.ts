import { NextResponse } from "next/server";
import {
  requireUser,
  handleAuthError,
  removeProductFromWishlist,
  WishlistValidationError,
  assertSafeOrigin,
  jsonPrivate,
} from "@/lib/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * DELETE /api/wishlist/items/[productId]
 * Removes a product from the authenticated customer's wishlist.
 *
 * Strict Ownership Enforcement:
 * - Requires safe origin via assertSafeOrigin().
 * - Requires authenticated session via requireUser() (401 if unauthenticated).
 * - Scoped exclusively to the current user's wishlist through wishlists.user_id = user.id.
 * - Prevents IDOR: Customer A cannot remove an item from Customer B's wishlist.
 * - Idempotent: returns success even if the item was already absent.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ productId: string }> }
) {
  try {
    assertSafeOrigin(request);
    const user = await requireUser();

    const { productId } = await params;
    const cleanProductId = productId?.trim();

    if (!cleanProductId) {
      return jsonPrivate(
        { ok: false, error: "Product ID is required" },
        { status: 400 }
      );
    }

    const result = await removeProductFromWishlist(user.id, cleanProductId);

    return jsonPrivate({
      ok: true,
      message: "Product removed from wishlist",
      removed: result.removed,
    });
  } catch (err: unknown) {
    if (err instanceof WishlistValidationError) {
      return jsonPrivate(
        { ok: false, error: err.message },
        { status: err.statusCode }
      );
    }
    return handleAuthError(err, "Failed to remove product from wishlist");
  }
}
