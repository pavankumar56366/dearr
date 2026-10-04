import { NextResponse } from "next/server";
import { requireUser, handleAuthError } from "@/lib/server/auth";
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
 * 2. Customer identity is derived exclusively from the verified Dearr session (`session.id`).
 * 3. Order ownership is strictly enforced against `session.id` to prevent IDOR attacks.
 * 4. Trusted Razorpay order ID is loaded from MySQL (`payments.provider_order_id`).
 * 5. Submitted `razorpay_order_id` must match the trusted database order ID.
 * 6. Cryptographic HMAC-SHA256 signature verification using server-only `RAZORPAY_KEY_SECRET`.
 * 7. Constant-time comparison using `crypto.timingSafeEqual` prevents timing attacks.
 * 8. Persists verified `provider_payment_id` and sets payment `status = 'verified'`.
 * 9. State Boundary (Strict): Does NOT mark `orders.payment_status = 'paid'`. (Reserved for L-04).
 * 10. Idempotent: Repeated valid verification with the same payment ID succeeds safely.
 * 11. Amount validation: Client-supplied amount cannot override trusted order total.
 * 12. Zero secret leakage: Never returns secret keys, database credentials, or stack traces.
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
  const rawRazorpayOrderId =
    body?.razorpay_order_id || body?.razorpayOrderId;
  const rawRazorpayPaymentId =
    body?.razorpay_payment_id || body?.razorpayPaymentId;
  const rawRazorpaySignature =
    body?.razorpay_signature || body?.razorpaySignature;

  if (!rawOrderId || typeof rawOrderId !== "string" || !rawOrderId.trim()) {
    return NextResponse.json(
      { ok: false, error: "Order ID (orderId) is required and must be a string" },
      { status: 400 }
    );
  }

  if (
    !rawRazorpayOrderId ||
    typeof rawRazorpayOrderId !== "string" ||
    !rawRazorpayOrderId.trim()
  ) {
    return NextResponse.json(
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
    return NextResponse.json(
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
    return NextResponse.json(
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

    console.error("[API_PAYMENTS_VERIFY_ERROR]", error?.message || error);
    return NextResponse.json(
      {
        ok: false,
        error: "An unexpected error occurred while verifying payment",
      },
      { status: 500 }
    );
  }
}
