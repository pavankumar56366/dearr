import { NextResponse } from "next/server";
import { requireUser, handleAuthError, assertSafeOrigin, jsonPrivate } from "@/lib/server";
import {
  handlePaymentFailure,
  PaymentValidationError,
} from "@/lib/server/payment";

/**
 * POST /api/payments/fail
 *
 * Safely processes Razorpay payment failure callbacks (L-05).
 *
 * Guarantees:
 * 1. Customer must be authenticated via session cookie (`requireUser()`).
 * 2. Origin check enforced via `assertSafeOrigin()` for cookie-authenticated browser requests.
 * 3. Identity derived from verified session (`session.id`), enforcing IDOR protection.
 * 4. Never marks an order as paid; never corrupts an already-paid order.
 * 5. Protects verified payments from being overwritten.
 * 6. Idempotent: safe duplicate calls return 200 without duplicate database mutations.
 * 7. Zero secret leakage: never exposes internal secrets, DB queries, or stack traces.
 */
export async function POST(req: Request) {
  let session;
  try {
    assertSafeOrigin(req);
    session = await requireUser();
  } catch (error) {
    return handleAuthError(error);
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return jsonPrivate(
      { ok: false, error: "Invalid JSON request body" },
      { status: 400 }
    );
  }

  const rawOrderId =
    body?.orderId || body?.order_id || body?.orderNumber || body?.id;
  const rawRzpPaymentId =
    body?.razorpay_payment_id || body?.razorpayPaymentId || body?.error?.metadata?.payment_id;
  const rawRzpOrderId =
    body?.razorpay_order_id || body?.razorpayOrderId || body?.error?.metadata?.order_id;
  const rawErrorCode =
    body?.errorCode || body?.code || body?.error?.code;
  const rawErrorDesc =
    body?.errorDescription || body?.description || body?.error?.description;
  const rawErrorSource =
    body?.errorSource || body?.source || body?.error?.source;
  const rawErrorStep =
    body?.errorStep || body?.step || body?.error?.step;
  const rawErrorReason =
    body?.errorReason || body?.reason || body?.error?.reason;
  const rawAmount =
    body?.amount !== undefined ? Number(body.amount) : undefined;
  const rawCurrency =
    body?.currency !== undefined ? String(body.currency) : undefined;

  if (!rawOrderId || typeof rawOrderId !== "string" || !rawOrderId.trim()) {
    return jsonPrivate(
      { ok: false, error: "Order ID (orderId) is required and must be a string" },
      { status: 400 }
    );
  }

  try {
    const result = await handlePaymentFailure({
      orderId: rawOrderId.trim(),
      userId: session.id,
      razorpayOrderId: rawRzpOrderId ? String(rawRzpOrderId).trim() : undefined,
      razorpayPaymentId: rawRzpPaymentId ? String(rawRzpPaymentId).trim() : undefined,
      errorCode: rawErrorCode ? String(rawErrorCode).trim().slice(0, 100) : undefined,
      errorDescription: rawErrorDesc ? String(rawErrorDesc).trim().slice(0, 500) : undefined,
      errorSource: rawErrorSource ? String(rawErrorSource).trim().slice(0, 100) : undefined,
      errorStep: rawErrorStep ? String(rawErrorStep).trim().slice(0, 100) : undefined,
      errorReason: rawErrorReason ? String(rawErrorReason).trim().slice(0, 100) : undefined,
      amount: rawAmount,
      currency: rawCurrency,
    });

    return jsonPrivate(
      {
        ok: true,
        ...result,
      },
      { status: 200 }
    );
  } catch (error: any) {
    if (error instanceof PaymentValidationError) {
      return jsonPrivate(
        { ok: false, error: error.message },
        { status: error.statusCode }
      );
    }

    console.error("[API_PAYMENTS_FAIL_ERROR]", error?.message || error);
    return jsonPrivate(
      {
        ok: false,
        error: "An unexpected error occurred while processing payment failure",
      },
      { status: 500 }
    );
  }
}
