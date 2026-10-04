import { NextResponse } from "next/server";
import { requireUser, handleAuthError } from "@/lib/server/auth";
import {
  handlePaymentCancellation,
  PaymentValidationError,
} from "@/lib/server/payment";

/**
 * POST /api/payments/cancel
 *
 * Handles customer checkout cancellation or modal closing (L-05).
 *
 * Guarantees:
 * 1. Customer must be authenticated via session cookie (`requireUser()`).
 * 2. IDOR protection: only the customer owning the order can submit cancellation.
 * 3. Never marks the order as paid.
 * 4. Does not falsely mark payment as failed when the customer simply closes the modal;
 *    order and payment remain pending so customer can retry safely.
 * 5. Protects already-paid orders and verified payments.
 * 6. Idempotent: repeated cancellation calls return 200 without duplicate side-effects.
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
    const result = await handlePaymentCancellation({
      orderId: rawOrderId.trim(),
      userId: session.id,
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

    console.error("[API_PAYMENTS_CANCEL_ERROR]", error?.message || error);
    return NextResponse.json(
      {
        ok: false,
        error: "An unexpected error occurred while processing payment cancellation",
      },
      { status: 500 }
    );
  }
}
