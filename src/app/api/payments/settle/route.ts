import { NextResponse } from "next/server";
import { requireUser, handleAuthError } from "@/lib/server/auth";
import {
  settlePaidOrder,
  PaymentValidationError,
} from "@/lib/server/payment";

/**
 * POST /api/payments/settle
 *
 * Finalizes payment settlement and transitions orders.payment_status to 'paid'
 * ONLY after a valid Razorpay payment has already been successfully verified by the server (L-04).
 *
 * Architectural & Security Rules (L-04):
 * 1. Customer must be authenticated via session cookie (`requireUser()`).
 * 2. Customer identity is derived exclusively from the verified Dearr session (`session.id`).
 * 3. Order ownership is strictly enforced against `session.id` to prevent IDOR attacks.
 * 4. The associated payment must have `provider = 'razorpay'` and `status = 'verified'`
 *    (guaranteeing L-03 cryptographic HMAC verification passed).
 * 5. Rejects unverified, 'created', 'failed', or missing payment records.
 * 6. Settleable order state: rejects cancelled or refunded orders.
 * 7. Idempotent: Repeated settlement attempts for an already-paid order return safe HTTP 200 responses.
 * 8. Amount validation: Client-supplied amounts cannot override trusted order total.
 * 9. Concurrency: Managed MySQL transaction with `FOR UPDATE` row locks prevents race conditions.
 * 10. Zero secret leakage: Never returns secret keys, database credentials, or stack traces.
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
  const rawRzpPaymentId =
    body?.razorpay_payment_id || body?.razorpayPaymentId;
  const rawRzpOrderId =
    body?.razorpay_order_id || body?.razorpayOrderId;
  const rawAmount =
    body?.amount !== undefined ? Number(body.amount) : undefined;
  const rawCurrency =
    body?.currency !== undefined ? String(body.currency) : undefined;

  if (!rawOrderId || typeof rawOrderId !== "string" || !rawOrderId.trim()) {
    return NextResponse.json(
      { ok: false, error: "Order ID (orderId) is required and must be a string" },
      { status: 400 }
    );
  }

  try {
    const result = await settlePaidOrder({
      orderId: rawOrderId.trim(),
      userId: session.id,
      razorpayPaymentId: rawRzpPaymentId ? String(rawRzpPaymentId).trim() : undefined,
      razorpayOrderId: rawRzpOrderId ? String(rawRzpOrderId).trim() : undefined,
      amount: rawAmount,
      currency: rawCurrency,
    });

    return NextResponse.json(
      {
        ok: true,
        ...result,
      },
      { status: 200 }
    );
  } catch (error: any) {
    if (error instanceof PaymentValidationError) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: error.statusCode }
      );
    }

    console.error("[API_PAYMENTS_SETTLE_ERROR]", error?.message || error);
    return NextResponse.json(
      {
        ok: false,
        error: "An unexpected error occurred while settling payment",
      },
      { status: 500 }
    );
  }
}
