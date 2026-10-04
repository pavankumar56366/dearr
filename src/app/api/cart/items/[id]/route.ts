import { NextResponse } from "next/server";
import {
  requireUser,
  handleAuthError,
  updateCartItemQuantity,
  removeCartItem,
  CartValidationError,
} from "@/lib/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * PATCH /api/cart/items/[id]
 * Updates an existing cart item's desired final quantity.
 *
 * Request Body:
 * {
 *   quantity: number;
 * }
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const cleanItemId = id?.trim();

    if (!cleanItemId) {
      return NextResponse.json(
        { ok: false, error: "Cart item ID is required" },
        { status: 400 }
      );
    }

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

    if (body.quantity === undefined || body.quantity === null) {
      return NextResponse.json(
        { ok: false, error: "Quantity is required" },
        { status: 400 }
      );
    }

    const updatedCart = await updateCartItemQuantity(user.id, cleanItemId, body.quantity);

    return NextResponse.json({
      ok: true,
      message: "Cart item updated",
      cart: updatedCart,
    });
  } catch (err: unknown) {
    if (err instanceof CartValidationError) {
      return NextResponse.json(
        { ok: false, error: err.message },
        { status: err.statusCode }
      );
    }
    return handleAuthError(err, "Failed to update cart item quantity");
  }
}

/**
 * DELETE /api/cart/items/[id]
 * Removes an item from the authenticated customer's active shopping cart.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const cleanItemId = id?.trim();

    if (!cleanItemId) {
      return NextResponse.json(
        { ok: false, error: "Cart item ID is required" },
        { status: 400 }
      );
    }

    const result = await removeCartItem(user.id, cleanItemId);

    return NextResponse.json({
      ok: true,
      message: "Item removed from cart",
      removed: result.removed,
      cart: result.cart,
    });
  } catch (err: unknown) {
    if (err instanceof CartValidationError) {
      return NextResponse.json(
        { ok: false, error: err.message },
        { status: err.statusCode }
      );
    }
    return handleAuthError(err, "Failed to remove item from shopping cart");
  }
}
