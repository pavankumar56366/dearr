import { NextResponse } from "next/server";
import {
  requireUser,
  handleAuthError,
  addCartItem,
  CartValidationError,
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
 * - Requires authenticated session via requireUser() (401 if unauthenticated).
 * - Client-supplied userId or cartId are ignored.
 * - Product must be active and in-stock.
 * - If product has variants, an active variant belonging to the product is required.
 * - Enforces stock check: (existing in cart + requested) <= available stock.
 */
export async function POST(request: Request) {
  try {
    const user = await requireUser();

    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { ok: false, error: "Invalid JSON request body" },
        { status: 400 }
      );
    }

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { ok: false, error: "Request body must be a valid JSON object" },
        { status: 400 }
      );
    }

    if (!body.productId || typeof body.productId !== "string") {
      return NextResponse.json(
        { ok: false, error: "Product ID is required and must be a string" },
        { status: 400 }
      );
    }

    if (body.quantity === undefined || body.quantity === null) {
      return NextResponse.json(
        { ok: false, error: "Quantity is required" },
        { status: 400 }
      );
    }

    const updatedCart = await addCartItem(user.id, {
      productId: body.productId,
      variantId: body.variantId || null,
      quantity: body.quantity,
    });

    return NextResponse.json(
      {
        ok: true,
        message: "Item added to cart",
        cart: updatedCart,
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    if (err instanceof CartValidationError) {
      return NextResponse.json(
        { ok: false, error: err.message },
        { status: err.statusCode }
      );
    }
    return handleAuthError(err, "Failed to add item to shopping cart");
  }
}
