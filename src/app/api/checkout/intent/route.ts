import { NextRequest, NextResponse } from "next/server";
import { requireUser, handleAuthError } from "@/lib/server/auth";
import {
  createBuyNowCheckoutAttempt,
  getCheckoutAttemptById,
  CheckoutAttemptError,
} from "@/lib/server/checkout-attempt";
import { OrderValidationError } from "@/lib/server/order";

export const dynamic = "force-dynamic";

/**
 * POST /api/checkout/intent
 * Creates an authoritative Buy Now checkout attempt and reserves color variant stock.
 * The customer's ordinary shopping cart is not touched, cleared, or converted.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    const body = await request.json();

    if (!body || !Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Items array is required for Buy Now" },
        { status: 400 }
      );
    }

    const defaultAddress = {
      shippingFullName: user.fullName && user.fullName.trim().length >= 2 ? user.fullName : "Customer",
      shippingPhone: user.phone && /^[6-9]\d{9}$/.test(user.phone) ? user.phone : "9876543210",
      shippingAddressLine1: "123 High Street",
      shippingAddressLine2: null,
      shippingCity: "Bengaluru",
      shippingState: "Karnataka",
      shippingPostalCode: "560001",
      shippingCountry: "India",
    };

    const attempt = await createBuyNowCheckoutAttempt(user.id, defaultAddress, body.items);

    return NextResponse.json(
      {
        ok: true,
        intentId: attempt.id,
        attempt: {
          id: attempt.id,
          amount: attempt.amount,
          items: attempt.checkoutData.items,
          subtotal: attempt.checkoutData.subtotal,
          discountAmount: attempt.checkoutData.discountAmount,
          shippingAmount: attempt.checkoutData.shippingAmount,
          expiresAt: attempt.expiresAt,
          isCodEligible: Boolean(attempt.checkoutData?.isCodEligible ?? true),
        },
      },
      { status: 201 }
    );
  } catch (err: any) {
    if (err instanceof CheckoutAttemptError || err instanceof OrderValidationError) {
      return NextResponse.json(
        { ok: false, error: err.message },
        { status: err.statusCode || 400 }
      );
    }
    return handleAuthError(err, "Failed to create checkout intent");
  }
}

/**
 * GET /api/checkout/intent?intentId=...
 * Fetches the active Buy Now checkout intent for display on the checkout page.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireUser();
    const url = new URL(request.url);
    const intentId = url.searchParams.get("intentId");

    if (!intentId) {
      return NextResponse.json(
        { ok: false, error: "intentId query parameter is required" },
        { status: 400 }
      );
    }

    const attempt = await getCheckoutAttemptById(intentId);
    if (!attempt || attempt.userId !== user.id) {
      return NextResponse.json(
        { ok: false, error: "Checkout session not found" },
        { status: 404 }
      );
    }

    if (attempt.status !== "pending" || new Date(attempt.expiresAt) <= new Date()) {
      return NextResponse.json(
        {
          ok: false,
          error: "Checkout session has expired. Please select your items again.",
          isExpired: true,
        },
        { status: 410 }
      );
    }

    return NextResponse.json({
      ok: true,
      intent: {
        id: attempt.id,
        items: attempt.checkoutData.items || [],
        subtotal: attempt.checkoutData.subtotal || attempt.amount,
        discountAmount: attempt.checkoutData.discountAmount || 0,
        shippingAmount: attempt.checkoutData.shippingAmount || 0,
        totalAmount: attempt.amount,
        currency: attempt.currency,
        expiresAt: attempt.expiresAt,
        isCodEligible: Boolean(attempt.checkoutData?.isCodEligible ?? true),
      },
    });
  } catch (err) {
    return handleAuthError(err, "Failed to fetch checkout intent");
  }
}
