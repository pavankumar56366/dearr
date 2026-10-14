import { NextResponse } from "next/server";
import {
  requireUser,
  handleAuthError,
  addCartItem,
  addCartItemsBatch,
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

    let updatedCart;
    if (Array.isArray(body.items)) {
      if (body.items.length === 0) {
        return NextResponse.json(
          { ok: false, error: "Items array cannot be empty" },
          { status: 400 }
        );
      }
      for (const item of body.items) {
        if (!item || typeof item !== "object" || !item.productId || typeof item.productId !== "string") {
          return NextResponse.json(
            { ok: false, error: "Each item must have a valid productId" },
            { status: 400 }
          );
        }
        if (item.quantity === undefined || item.quantity === null) {
          return NextResponse.json(
            { ok: false, error: "Each item must have a quantity" },
            { status: 400 }
          );
        }
      }
      const preparedBatch = body.items.map((it: any) => ({
        productId: it.productId,
        variantId: it.variantId || null,
        colorId: it.colorId || null,
        quantity: it.quantity,
      }));
      updatedCart = await addCartItemsBatch(user.id, preparedBatch);
    } else {
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

      updatedCart = await addCartItem(user.id, {
        productId: body.productId,
        variantId: body.variantId || null,
        colorId: body.colorId || null,
        quantity: body.quantity,
      });
    }

    return NextResponse.json(
      {
        ok: true,
        message: "Item(s) added to cart",
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
