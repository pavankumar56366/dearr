import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import {
  getCheckoutAttemptByProviderOrder,
  finalizeOrderFromAttempt,
} from "@/lib/server/checkout-attempt";
import { query } from "@/lib/server/db";

export const dynamic = "force-dynamic";

/**
 * POST /api/payments/webhook
 *
 * Authoritative Server-to-Server Razorpay Webhook Handler.
 *
 * Guarantees:
 * 1. Webhook Signature Verification: Verifies HMAC-SHA256 signature if RAZORPAY_WEBHOOK_SECRET is set.
 * 2. Idempotency: Duplicate webhook events (e.g. repeated payment.captured deliveries) return HTTP 200 without duplicate writes.
 * 3. Concurrency / Race Safety: Atomic transition with row lock (FOR UPDATE) prevents callback/webhook races from duplicating orders or revenue.
 * 4. Late Payment Reconciliation: Captured payments for expired attempts are safely reconciled into placed orders.
 * 5. Zero PII Logging: Does not leak customer cards, secrets, or internal traces.
 */
export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET?.trim();
    const signature = request.headers.get("x-razorpay-signature")?.trim();

    // 1. Refuse processing if webhook secret is not configured on the server
    if (!webhookSecret) {
      console.error("[PAYMENTS_WEBHOOK] Server configuration error: RAZORPAY_WEBHOOK_SECRET is not configured");
      return NextResponse.json(
        { ok: false, error: "Webhook secret is not configured on the server" },
        { status: 500 }
      );
    }

    // 2. Reject request if signature header is missing
    if (!signature) {
      return NextResponse.json(
        { ok: false, error: "Missing x-razorpay-signature header" },
        { status: 400 }
      );
    }

    // 3. Reject request if signature format is invalid (must be 64-character hex)
    if (!/^[a-f0-9]{64}$/i.test(signature)) {
      return NextResponse.json(
        { ok: false, error: "Invalid webhook signature format" },
        { status: 400 }
      );
    }

    // 4. Verify signature against exact raw request body using constant-time comparison
    const expectedSignature = crypto
      .createHmac("sha256", webhookSecret)
      .update(rawBody)
      .digest("hex");

    const isMatch =
      signature.length === expectedSignature.length &&
      crypto.timingSafeEqual(
        Buffer.from(signature.toLowerCase(), "utf-8"),
        Buffer.from(expectedSignature.toLowerCase(), "utf-8")
      );

    if (!isMatch) {
      console.warn("[PAYMENTS_WEBHOOK] Invalid Razorpay webhook signature");
      return NextResponse.json(
        { ok: false, error: "Invalid webhook signature" },
        { status: 400 }
      );
    }

    let payload: any;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json(
        { ok: false, error: "Invalid JSON webhook payload" },
        { status: 400 }
      );
    }

    const event = payload?.event;
    if (!event) {
      return NextResponse.json(
        { ok: false, error: "Missing webhook event" },
        { status: 400 }
      );
    }

    // Process payment capture or order paid events
    if (event === "payment.captured" || event === "order.paid") {
      const paymentEntity = payload?.payload?.payment?.entity;
      const orderEntity = payload?.payload?.order?.entity;

      const rzpOrderId = paymentEntity?.order_id || orderEntity?.id;
      const rzpPaymentId = paymentEntity?.id;

      if (!rzpOrderId) {
        return NextResponse.json(
          { ok: true, message: "Ignored: No Razorpay order ID in webhook payload" },
          { status: 200 }
        );
      }

      // Check if this belongs to a checkout_attempt
      const attempt = await getCheckoutAttemptByProviderOrder(rzpOrderId);

      if (attempt) {
        if (attempt.status === "converted" && attempt.orderId) {
          // Idempotent: Already finalized by callback or prior webhook
          return NextResponse.json(
            { ok: true, message: "Checkout attempt already converted", orderId: attempt.orderId },
            { status: 200 }
          );
        }

        // Finalize order from attempt
        const finalizedOrder = await finalizeOrderFromAttempt(attempt.id, {
          providerPaymentId: rzpPaymentId || `pay_wh_${Date.now()}`,
          amount: paymentEntity?.amount ? paymentEntity.amount / 100 : undefined,
          currency: paymentEntity?.currency || "INR",
        });

        return NextResponse.json(
          {
            ok: true,
            message: "Order finalized successfully from webhook",
            orderId: finalizedOrder.id,
            orderNumber: finalizedOrder.orderNumber,
          },
          { status: 200 }
        );
      }

      // Fallback: Check if it's a legacy order in orders table
      const legacyPayments = await query<any[]>(
        "SELECT id, order_id, status FROM payments WHERE provider_order_id = ? LIMIT 1",
        [rzpOrderId]
      );

      if (legacyPayments && legacyPayments.length > 0) {
        const paymentRow = legacyPayments[0];
        if (paymentRow.status !== "captured" && paymentRow.status !== "verified") {
          await query(
            "UPDATE payments SET status = 'captured', provider_payment_id = COALESCE(?, provider_payment_id), paid_at = NOW(), updated_at = NOW() WHERE id = ?",
            [rzpPaymentId || null, paymentRow.id]
          );
          await query(
            "UPDATE orders SET payment_status = 'paid', status = CASE WHEN status = 'pending' THEN 'confirmed' ELSE status END, updated_at = NOW() WHERE id = ?",
            [paymentRow.order_id]
          );
        }

        return NextResponse.json(
          { ok: true, message: "Legacy order updated from webhook", orderId: paymentRow.order_id },
          { status: 200 }
        );
      }
    }

    // All other benign events acknowledge 200 OK
    return NextResponse.json(
      { ok: true, message: `Webhook event '${event}' acknowledged` },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("[PAYMENTS_WEBHOOK_ERROR]", error?.message || error);
    return NextResponse.json(
      { ok: false, error: "An unexpected error occurred while processing webhook" },
      { status: 500 }
    );
  }
}
