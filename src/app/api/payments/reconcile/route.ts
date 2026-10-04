import { NextResponse } from "next/server";
import { requireUser, handleAuthError } from "@/lib/server/auth";
import {
  reconcileRazorpayPayment,
  PaymentValidationError,
} from "@/lib/server/payment";

/**
 * POST /api/payments/reconcile
 *
 * Reconciles uncertain, delayed, or pending Razorpay payments against authoritative gateway state (L-05).
 *
 * Guarantees:
 * 1. Customer must be authenticated via session cookie (`requireUser()`).
 * 2. Identity derived from verified session (`session.id`), enforcing IDOR protection.
 * 3. Authoritative server-side status check: calls official Razorpay API directly from backend.
 * 4. Never exposes RAZORPAY_KEY_SECRET or internal DB traces.
 * 5. Amount and currency mismatch safety: strictly verifies gateway amounts match MySQL orders.
 * 6. Idempotent: safe to run repeatedly across page refreshes, retries, or delayed callbacks.
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
  const rawRzpPaymentId =
    body?.razorpay_payment_id || body?.razorpayPaymentId;
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
    const result = await reconcileRazorpayPayment({
      orderId: rawOrderId.trim(),
      userId: session.id,
      razorpayOrderId: rawRzpOrderId ? String(rawRzpOrderId).trim() : undefined,
      razorpayPaymentId: rawRzpPaymentId ? String(rawRzpPaymentId).trim() : undefined,
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

    console.error("[API_PAYMENTS_RECONCILE_ERROR]", error?.message || error);
    return NextResponse.json(
      {
        ok: false,
        error: "An unexpected error occurred while reconciling payment status",
      },
      { status: 500 }
    );
  }
}
