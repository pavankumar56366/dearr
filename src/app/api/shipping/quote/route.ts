import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/server/auth";
import { getCartForUser } from "@/lib/server/cart";
import { getShippingQuote } from "@/lib/server/shipping-quote";

/**
 * POST /api/shipping/quote
 * Calculates real-time, server-authoritative shipping quote and COD eligibility.
 *
 * Body parameters:
 *  - deliveryPincode: string (6-digit Indian PIN code)
 *  - paymentMethod: "prepaid" | "cod"
 *  - subtotal?: number (fallback for guest / pre-cart estimates)
 *
 * Invariants:
 *  - Subtotal derived directly from authenticated customer's cart when session exists.
 *  - Applies free shipping strictly to prepaid orders (₹0).
 *  - COD orders meeting free shipping threshold pay the admin COD minimum fee.
 *  - Enforces max COD order value cap.
 *  - Server-calculated shipping cost (client cannot inject shipping fees).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const deliveryPincode = String(body?.deliveryPincode || "").trim().replace(/\D/g, "");
    const paymentMethod = String(body?.paymentMethod || "prepaid").trim().toLowerCase();

    if (!/^[1-9][0-9]{5}$/.test(deliveryPincode)) {
      return NextResponse.json(
        { ok: false, error: "Please enter a valid 6-digit Indian PIN code." },
        { status: 400 }
      );
    }

    let subtotal = 0;
    let totalWeightKg = 0.5;

    // Check if customer is authenticated to compute exact cart totals
    const session = await getSession();
    if (session?.sub) {
      try {
        const cart = await getCartForUser(session.sub);
        if (cart && cart.items.length > 0) {
          subtotal = Math.max(0, cart.totals.subtotal - cart.totals.discount);
          // Estimate weight from item count if not set
          totalWeightKg = Math.max(0.5, cart.itemCount * 0.3);
        }
      } catch {
        // Fall back to body subtotal if cart retrieval fails
      }
    }

    // Fall back to client-supplied subtotal if guest or cart was empty
    if (subtotal === 0 && typeof body?.subtotal === "number" && body.subtotal >= 0) {
      subtotal = Number(body.subtotal);
    }

    const quote = await getShippingQuote({
      deliveryPincode,
      subtotal,
      paymentMethod,
      weightKg: totalWeightKg,
    });

    return NextResponse.json({
      ok: true,
      quote,
    });
  } catch (err: any) {
    console.error("[Shipping Quote API Error]:", err?.message);
    return NextResponse.json(
      { ok: false, error: err?.message || "Failed to calculate shipping quote" },
      { status: 400 }
    );
  }
}
