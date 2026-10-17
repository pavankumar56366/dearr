import { NextResponse } from "next/server";
import {
  requireUser,
  handleAuthError,
  addProductToWishlist,
  WishlistValidationError,
  assertSafeOrigin,
  jsonPrivate,
} from "@/lib/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/wishlist/items
 * Adds a product to the authenticated customer's wishlist.
 *
 * Strict Ownership & Validation:
 * - Requires verified same-origin request via assertSafeOrigin().
 * - Requires authenticated session via requireUser() (401 if unauthenticated).
 * - Only accepts productId from body; client-supplied userId or wishlistId are ignored.
 * - Enforces storefront product visibility (active products only).
 * - Idempotent: duplicate add attempts return success with alreadyInWishlist: true without errors.
 */
export async function POST(request: Request) {
  try {
    assertSafeOrigin(request);
    const user = await requireUser();

    let body: any;
    try {
      body = await request.json();
    } catch {
      return jsonPrivate(
        { ok: false, error: "Invalid JSON request body" },
        { status: 400 }
      );
    }

    if (!body || typeof body !== "object") {
      return jsonPrivate(
        { ok: false, error: "Request body must be a valid JSON object" },
        { status: 400 }
      );
    }

    if (!body.productId || typeof body.productId !== "string") {
      return jsonPrivate(
        { ok: false, error: "Product ID is required and must be a string" },
        { status: 400 }
      );
    }

    const result = await addProductToWishlist(user.id, body.productId);

    return jsonPrivate(
      {
        ok: true,
        message: result.alreadyInWishlist
          ? "Product is already in your wishlist"
          : "Product added to wishlist",
        item: result.item,
        alreadyInWishlist: result.alreadyInWishlist,
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    if (err instanceof WishlistValidationError) {
      return jsonPrivate(
        { ok: false, error: err.message },
        { status: err.statusCode }
      );
    }
    return handleAuthError(err, "Failed to add product to wishlist");
  }
}
