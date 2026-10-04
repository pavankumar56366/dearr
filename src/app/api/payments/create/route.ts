import { NextResponse } from "next/server";
import { requireUser, handleAuthError } from "@/lib/server/auth";
import {
  createRazorpayPaymentOrder,
  PaymentValidationError,
} from "@/lib/server/payment";

/**
 * POST /api/payments/create
 *
 * Initiates a server-authoritative Razorpay Test Mode payment order for an existing Dearr order.
 *
 * Architectural & Security Rules (L-02):
 * 1. Customer must be authenticated via session cookie (`requireUser()`).
 * 2. Order ownership is strictly enforced against `session.sub`. Customers can only create payments for their own orders.
 * 3. Amount is derived strictly from trusted MySQL `orders.total_amount`; client cannot manipulate payment amount.
 * 4. Checks order state: rejects already paid (409 Conflict), refunded (400), or cancelled (400).
 * 5. Uses server-only Razorpay configuration and credentials.
 * 6. Idempotent: Reuses existing 'created' Razorpay order for this internal order if already initialized.
 * 7. Persists provider order reference in `payments` table with status 'created'.
 * 8. Does NOT mark order or payment as 'paid' (order remains 'pending' until verification in L-03/L-04).
 * 9. Returns only safe checkout parameters (razorpayOrderId, amount, currency, keyId); never leaks key secret.
 */
export async function POST(req: Request) {
  let session;
  try {
    session = await requireUser();
  } catch (error) {
    return handleAuthError(error);
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON request body" },
      { status: 400 }
    );
  }

  const rawOrderId =
    body?.orderId || body?.order_id || body?.orderNumber || body?.id;

  if (!rawOrderId || typeof rawOrderId !== "string" || !rawOrderId.trim()) {
    return NextResponse.json(
      { ok: false, error: "Order ID (orderId) is required and must be a string" },
      { status: 400 }
    );
  }

  try {
    const result = await createRazorpayPaymentOrder({
      orderId: rawOrderId.trim(),
      userId: session.id,
      amount: body.amount !== undefined ? Number(body.amount) : undefined,
    });

    return NextResponse.json(
      {
        ok: true,
        ...result,
      },
      { status: 201 }
    );
  } catch (error: any) {
    if (error instanceof PaymentValidationError) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: error.statusCode }
      );
    }

    console.error("[API_PAYMENTS_CREATE_ERROR]", error?.message || error);
    return NextResponse.json(
      { ok: false, error: "An unexpected error occurred while initializing payment" },
      { status: 500 }
    );
  }
}
