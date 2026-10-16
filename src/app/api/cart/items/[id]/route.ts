import { NextResponse } from "next/server";
import {
  requireUser,
  handleAuthError,
  updateCartItemQuantity,
  removeCartItem,
  CartValidationError,
  assertSafeOrigin,
  jsonPrivate,
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
    assertSafeOrigin(request);
    const user = await requireUser();
    const { id } = await params;
    const cleanItemId = id?.trim();

    if (!cleanItemId) {
      return jsonPrivate(
        { ok: false, error: "Cart item ID is required" },
        { status: 400 }
      );
    }

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

    if (body.quantity === undefined || body.quantity === null) {
      return jsonPrivate(
        { ok: false, error: "Quantity is required" },
        { status: 400 }
      );
    }

    const quantity = Number(body.quantity);
    if (!Number.isInteger(quantity) || quantity < 0) {
      return jsonPrivate(
        { ok: false, error: "Quantity must be a non-negative integer" },
        { status: 400 }
      );
    }

    const updatedCart = await updateCartItemQuantity(
      user.id,
      cleanItemId,
      quantity
    );

    return jsonPrivate({
      ok: true,
      message:
        quantity === 0
          ? "Item removed from cart"
          : "Cart item quantity updated",
      cart: updatedCart,
    });
  } catch (err: unknown) {
    if (err instanceof CartValidationError) {
      return jsonPrivate(
        { ok: false, error: err.message },
        { status: err.statusCode }
      );
    }
    return handleAuthError(err, "Failed to update cart item quantity");
  }
}

/**
 * DELETE /api/cart/items/[id]
 * Removes a line item from the customer's active shopping cart.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    assertSafeOrigin(request);
    const user = await requireUser();
    const { id } = await params;
    const cleanItemId = id?.trim();

    if (!cleanItemId) {
      return jsonPrivate(
        { ok: false, error: "Cart item ID is required" },
        { status: 400 }
      );
    }

    const updatedCart = await removeCartItem(user.id, cleanItemId);

    return jsonPrivate({
      ok: true,
      message: "Item removed from cart",
      cart: updatedCart,
    });
  } catch (err: unknown) {
    if (err instanceof CartValidationError) {
      return jsonPrivate(
        { ok: false, error: err.message },
        { status: err.statusCode }
      );
    }
    return handleAuthError(err, "Failed to remove item from shopping cart");
  }
}
