import { NextResponse } from "next/server";
import { requireUser, handleAuthError, assertSafeOrigin, jsonPrivate } from "@/lib/server";
import {
  verifyRazorpayPayment,
  PaymentValidationError,
} from "@/lib/server/payment";

/**
 * POST /api/payments/verify
 *
 * Verifies a Razorpay payment callback/result on the Dearr server.
 *
 * Architectural & Security Rules (L-03):
 * 1. Customer must be authenticated via session cookie (`requireUser()`).
 * 2. Origin check enforced via `assertSafeOrigin()` for cookie-authenticated browser requests.
 * 3. Customer identity is derived exclusively from the verified Dearr session (`session.id`).
 * 4. Order ownership is strictly enforced against `session.id` to prevent IDOR attacks.
 * 5. Trusted Razorpay order ID is loaded from MySQL (`payments.provider_order_id`).
 * 6. Submitted `razorpay_order_id` must match the trusted database order ID.
 * 7. Cryptographic HMAC-SHA256 signature verification using server-only `RAZORPAY_KEY_SECRET`.
 * 8. Constant-time comparison using `crypto.timingSafeEqual` prevents timing attacks.
 * 9. Persists verified `provider_payment_id` and sets payment `status = 'verified'`.
 * 10. State Boundary (Strict): Does NOT mark `orders.payment_status = 'paid'`. (Reserved for L-04).
 * 11. Idempotent: Repeated valid verification with the same payment ID succeeds safely.
 * 12. Amount validation: Client-supplied amount cannot override trusted order total.
 * 13. Zero secret leakage: Never returns secret keys, database credentials, or stack traces.
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
  const rawRazorpayOrderId =
    body?.razorpay_order_id || body?.razorpayOrderId;
  const rawRazorpayPaymentId =
    body?.razorpay_payment_id || body?.razorpayPaymentId;
  const rawRazorpaySignature =
    body?.razorpay_signature || body?.razorpaySignature;

  if (!rawOrderId || typeof rawOrderId !== "string" || !rawOrderId.trim()) {
    return jsonPrivate(
      { ok: false, error: "Order ID (orderId) is required and must be a string" },
      { status: 400 }
    );
  }

  if (
    !rawRazorpayOrderId ||
    typeof rawRazorpayOrderId !== "string" ||
    !rawRazorpayOrderId.trim()
  ) {
    return jsonPrivate(
      {
        ok: false,
        error:
          "Razorpay order ID (razorpay_order_id) is required and must be a string",
      },
      { status: 400 }
    );
  }

  if (
    !rawRazorpayPaymentId ||
    typeof rawRazorpayPaymentId !== "string" ||
    !rawRazorpayPaymentId.trim()
  ) {
    return jsonPrivate(
      {
        ok: false,
        error:
          "Razorpay payment ID (razorpay_payment_id) is required and must be a string",
      },
      { status: 400 }
    );
  }

  if (
    !rawRazorpaySignature ||
    typeof rawRazorpaySignature !== "string" ||
    !rawRazorpaySignature.trim()
  ) {
    return jsonPrivate(
      {
        ok: false,
        error:
          "Razorpay signature (razorpay_signature) is required and must be a string",
      },
      { status: 400 }
    );
  }

  try {
    const result = await verifyRazorpayPayment({
      orderId: rawOrderId.trim(),
      userId: session.id,
      razorpayOrderId: rawRazorpayOrderId.trim(),
      razorpayPaymentId: rawRazorpayPaymentId.trim(),
      razorpaySignature: rawRazorpaySignature.trim(),
      amount: body.amount !== undefined ? Number(body.amount) : undefined,
    });

    return jsonPrivate(
      {
        ok: true,
        ...result,
      },
      { status: 200 }
    );
  } catch (error: any) {
    if (error instanceof PaymentValidationError || error?.name === "PaymentValidationError") {
      return jsonPrivate(
        { ok: false, error: error.message },
        { status: error.statusCode || 400 }
      );
    }

    console.error("[API_PAYMENTS_VERIFY_ERROR]", error?.message || error);
    return jsonPrivate(
      {
        ok: false,
        error: "An unexpected error occurred while verifying payment",
      },
      { status: 500 }
    );
  }
}
