import { NextResponse } from "next/server";
import {
  requireUser,
  handleAuthError,
  addCartItem,
  addCartItemsBatch,
  CartValidationError,
  assertSafeOrigin,
  jsonPrivate,
} from "@/lib/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/cart/items
 * Adds an item to the authenticated customer's active shopping cart.
 *
 * Request Body:
 * {
 *   productId: string;
 *   variantId?: string | null;
 *   quantity: number;
 * }
 *
 * Strict Ownership & Validation:
 * - Requires verified same-origin request via assertSafeOrigin().
 * - Requires authenticated session via requireUser() (401 if unauthenticated).
 * - Client-supplied userId or cartId are ignored.
 * - Product must be active and in-stock.
 * - If product has variants, an active variant belonging to the product is required.
 * - Enforces stock check: (existing in cart + requested) <= available stock.
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

    let updatedCart;
    if (Array.isArray(body.items)) {
      if (body.items.length === 0) {
        return jsonPrivate(
          { ok: false, error: "Items array cannot be empty" },
          { status: 400 }
        );
      }
      for (const item of body.items) {
        if (!item.productId || typeof item.productId !== "string") {
          return jsonPrivate(
            { ok: false, error: "Each item must have a valid productId" },
            { status: 400 }
          );
        }
        if (typeof item.quantity !== "number" || item.quantity <= 0) {
          return jsonPrivate(
            { ok: false, error: "Each item quantity must be a positive number" },
            { status: 400 }
          );
        }
      }
      updatedCart = await addCartItemsBatch(user.id, body.items);
    } else {
      if (!body.productId || typeof body.productId !== "string") {
        return jsonPrivate(
          { ok: false, error: "Valid productId is required" },
          { status: 400 }
        );
      }

      if (typeof body.quantity !== "number" || body.quantity <= 0) {
        return jsonPrivate(
          { ok: false, error: "Quantity must be a positive integer" },
          { status: 400 }
        );
      }

      updatedCart = await addCartItem(user.id, {
        productId: body.productId,
        variantId: body.variantId ?? body.colorId ?? null,
        quantity: body.quantity,
      });
    }

    return jsonPrivate(
      {
        ok: true,
        message: "Item(s) added to cart",
        cart: updatedCart,
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    if (err instanceof CartValidationError) {
      return jsonPrivate(
        { ok: false, error: err.message },
        { status: err.statusCode }
      );
    }
    return handleAuthError(err, "Failed to add item to shopping cart");
  }
}
