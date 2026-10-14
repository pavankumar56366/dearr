import { NextRequest, NextResponse } from "next/server";
import { requireUser, handleAuthError } from "@/lib/server/auth";
import { query } from "@/lib/server/db";
import {
  createOrderFromCart,
  listCustomerOrders,
  OrderValidationError,
} from "@/lib/server/order";
import {
  createCheckoutAttemptFromCart,
  createBuyNowCheckoutAttempt,
  getCheckoutAttemptById,
  CheckoutAttemptError,
} from "@/lib/server/checkout-attempt";
import {
  getCustomerAddressById,
  createCustomerAddress,
} from "@/lib/server/address";

export const dynamic = "force-dynamic";

/**
 * POST /api/orders — Initiates checkout from customer's active cart.
 *
 * For online prepaid orders (default), creates and persists an authoritative
 * `checkout_attempts` record with 30-minute expiry and 30-day retention.
 * Ordinary pending rows are NEVER written to `orders` before payment capture.
 *
 * Body: { shippingFullName?, shippingPhone?, shippingAddressLine1?, shippingAddressLine2?,
 *         shippingCity?, shippingState?, shippingPostalCode?, shippingCountry?,
 *         addressId?, saveAddress?, mode? }
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    const body = await request.json();

    let shippingData = {
      shippingFullName: body.shippingFullName,
      shippingPhone: body.shippingPhone,
      shippingAddressLine1: body.shippingAddressLine1,
      shippingAddressLine2: body.shippingAddressLine2 || null,
      shippingCity: body.shippingCity,
      shippingState: body.shippingState,
      shippingPostalCode: body.shippingPostalCode,
      shippingCountry: body.shippingCountry || "India",
    };

    if (body.addressId) {
      const savedAddr = await getCustomerAddressById(user.id, String(body.addressId).trim());
      if (!savedAddr) {
        return NextResponse.json(
          { ok: false, error: "The selected delivery address was not found or is unauthorized." },
          { status: 403 }
        );
      }
      shippingData = {
        shippingFullName: savedAddr.fullName,
        shippingPhone: savedAddr.phone,
        shippingAddressLine1: savedAddr.addressLine1,
        shippingAddressLine2: savedAddr.addressLine2,
        shippingCity: savedAddr.city,
        shippingState: savedAddr.state,
        shippingPostalCode: savedAddr.postalCode,
        shippingCountry: savedAddr.country || "India",
      };
    } else if (body.saveAddress && shippingData.shippingAddressLine1 && shippingData.shippingCity) {
      try {
        await createCustomerAddress(user.id, {
          label: "Delivery Address",
          fullName: shippingData.shippingFullName,
          phone: shippingData.shippingPhone,
          addressLine1: shippingData.shippingAddressLine1,
          addressLine2: shippingData.shippingAddressLine2,
          city: shippingData.shippingCity,
          state: shippingData.shippingState,
          postalCode: shippingData.shippingPostalCode,
          country: shippingData.shippingCountry,
        });
      } catch (err) {
        console.warn("[ORDERS_SAVE_ADDRESS_OPTIONAL_FAILED]", err);
      }
    }

    // Direct placed order branch (only for explicit COD or direct order simulation)
    const isDirectOrder = body.mode === "direct" || body.paymentMethod === "cod";
    if (isDirectOrder) {
      const order = await createOrderFromCart(user.id, shippingData);
      return NextResponse.json(
        { ok: true, order },
        { status: 201 }
      );
    }

    // Standard Online Prepaid Flow: Create or reuse checkout attempt.
    let attempt;
    if (body.intentId) {
      const existingAttempt = await getCheckoutAttemptById(body.intentId);
      if (!existingAttempt || existingAttempt.userId !== user.id) {
        return NextResponse.json({ ok: false, error: "Checkout session not found" }, { status: 404 });
      }
      if (existingAttempt.status !== "pending" || new Date(existingAttempt.expiresAt) <= new Date()) {
        return NextResponse.json({ ok: false, error: "Checkout session has expired. Please try again." }, { status: 410 });
      }

      const updatedCheckoutData = {
        ...existingAttempt.checkoutData,
        shippingAddress: shippingData,
      };
      await query(
        "UPDATE checkout_attempts SET checkout_data = ?, updated_at = NOW() WHERE id = ?",
        [JSON.stringify(updatedCheckoutData), existingAttempt.id]
      );
      existingAttempt.checkoutData = updatedCheckoutData;
      attempt = existingAttempt;
    } else if (body.isBuyNow && Array.isArray(body.items) && body.items.length > 0) {
      attempt = await createBuyNowCheckoutAttempt(user.id, shippingData, body.items);
    } else {
      attempt = await createCheckoutAttemptFromCart(user.id, shippingData);
    }

    return NextResponse.json(
      {
        ok: true,
        attemptId: attempt.id,
        isAttempt: true,
        order: {
          id: attempt.id,
          orderNumber: `ATT-${attempt.id.slice(0, 8).toUpperCase()}`,
          userId: attempt.userId,
          status: "pending",
          paymentStatus: "pending",
          subtotal: attempt.checkoutData.subtotal,
          discountAmount: attempt.checkoutData.discountAmount,
          shippingAmount: attempt.checkoutData.shippingAmount,
          totalAmount: attempt.amount,
          currency: attempt.currency,
          isAttempt: true,
        },
      },
      { status: 201 }
    );
  } catch (err) {
    if (err instanceof OrderValidationError || err instanceof CheckoutAttemptError) {
      return NextResponse.json(
        { ok: false, error: err.message },
        { status: err.statusCode }
      );
    }
    return handleAuthError(err, "Failed to create order");
  }
}

/**
 * GET /api/orders — List the authenticated customer's orders.
 *
 * Excludes abandoned online checkout attempts by default.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireUser();
    const url = new URL(request.url);

    const result = await listCustomerOrders(user.id, {
      status: (url.searchParams.get("status") as any) || undefined,
      paymentStatus: (url.searchParams.get("paymentStatus") as any) || undefined,
      page: parseInt(url.searchParams.get("page") || "1", 10),
      limit: parseInt(url.searchParams.get("limit") || "20", 10),
      placedOnly: true, // Only show valid placed orders
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    if (err instanceof OrderValidationError || err instanceof CheckoutAttemptError) {
      return NextResponse.json(
        { ok: false, error: err.message },
        { status: err.statusCode }
      );
    }
    return handleAuthError(err, "Failed to fetch orders");
  }
}
