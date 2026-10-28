import { NextRequest, NextResponse } from "next/server";
import { requireUser, handleAuthError, assertSafeOrigin, withPrivateCacheHeaders } from "@/lib/server";
import { query } from "@/lib/server/db";
import {
  createOrderFromCart,
  createOrderFromBuyNow,
  listCustomerOrders,
  OrderValidationError,
} from "@/lib/server/order";
import {
  createCheckoutAttemptFromCart,
  createBuyNowCheckoutAttempt,
  getCheckoutAttemptById,
  CheckoutAttemptError,
} from "@/lib/server/checkout-attempt";
import { getCustomerAddressById, createCustomerAddress } from "@/lib/server/address";
import { getStoreSettings } from "@/lib/server/settings";
import { getShippingQuote } from "@/lib/server/shipping-quote";

export const dynamic = "force-dynamic";

/**
 * POST /api/orders — Initiates checkout from customer's active cart.
 *
 * For online prepaid orders (default), creates and persists an authoritative
 * `checkout_attempts` record with 30-minute expiry and 30-day retention.
 * Ordinary pending rows are NEVER written to `orders` before payment capture.
 *
 * Body: { shippingFullName?, shippingPhone?, shippingAddressLine1?, shippingAddressLine2?,
 *         shippingCity?, shippingState?, shippingPostalCode?, shippingCountry?,
 *         addressId?, saveAddress?, mode? }
 */
export async function POST(request: NextRequest) {
  try {
    assertSafeOrigin(request);
    const user = await requireUser();
    const body = await request.json();

    let shippingData = {
      shippingFullName: body.shippingFullName,
      shippingPhone: body.shippingPhone,
      shippingAddressLine1: body.shippingAddressLine1,
      shippingAddressLine2: body.shippingAddressLine2 || null,
      shippingCity: body.shippingCity,
      shippingState: body.shippingState,
      shippingPostalCode: body.shippingPostalCode,
      shippingCountry: body.shippingCountry || "India",
    };

    if (body.addressId) {
      const savedAddr = await getCustomerAddressById(user.id, String(body.addressId).trim());
      if (!savedAddr) {
        return NextResponse.json(
          { ok: false, error: "The selected delivery address was not found or is unauthorized." },
          { status: 403 }
        );
      }
      shippingData = {
        shippingFullName: savedAddr.fullName,
        shippingPhone: savedAddr.phone,
        shippingAddressLine1: savedAddr.addressLine1,
        shippingAddressLine2: savedAddr.addressLine2,
        shippingCity: savedAddr.city,
        shippingState: savedAddr.state,
        shippingPostalCode: savedAddr.postalCode,
        shippingCountry: savedAddr.country || "India",
      };
    } else if (body.saveAddress && shippingData.shippingAddressLine1 && shippingData.shippingCity) {
      try {
        await createCustomerAddress(user.id, {
          label: "Delivery Address",
          fullName: shippingData.shippingFullName,
          phone: shippingData.shippingPhone,
          addressLine1: shippingData.shippingAddressLine1,
          addressLine2: shippingData.shippingAddressLine2,
          city: shippingData.shippingCity,
          state: shippingData.shippingState,
          postalCode: shippingData.shippingPostalCode,
          country: shippingData.shippingCountry,
        });
      } catch (err) {
        console.warn("[ORDERS_SAVE_ADDRESS_OPTIONAL_FAILED]", err);
      }
    }

    // Direct placed order / COD policy enforcement:
    // 1. Customer-supplied mode: "direct" must never bypass standard online checkout.
    if (body.mode === "direct") {
      return NextResponse.json(
        { ok: false, error: "Direct order mode is not permitted. Please complete standard online checkout." },
        { status: 400 }
      );
    }

    // 2. Cash on Delivery is strictly rejected unless explicitly enabled in trusted server-side store_settings
    // AND all items in the order/cart are COD-eligible.
    if (body.paymentMethod === "cod") {
      const storeSettings = await getStoreSettings();
      if (!storeSettings.codEnabled) {
        return NextResponse.json(
          { ok: false, error: "Cash on Delivery is disabled. Please complete checkout using online payment." },
          { status: 400 }
        );
      }

      // Check if this is Buy Now vs Cart
      const isBuyNow = Boolean(body.isBuyNow && Array.isArray(body.items) && body.items.length > 0);
      if (isBuyNow) {
        let buyNowSubtotal = 0;
        const codFees: number[] = [];

        // Server-authoritative check for each product in Buy Now items
        for (const it of body.items) {
          const pRows = await query<any[]>(
            "SELECT id, name, price, cod_enabled, cod_fee, is_active FROM products WHERE id = ? LIMIT 1",
            [it.productId]
          );
          if (!pRows || pRows.length === 0) {
            return NextResponse.json(
              { ok: false, error: "Product not found" },
              { status: 404 }
            );
          }
          const p = pRows[0];
          const codEnabled = Boolean(
            p.cod_enabled !== undefined && p.cod_enabled !== null ? p.cod_enabled : 1
          );
          if (!codEnabled) {
            return NextResponse.json(
              {
                ok: false,
                error: "One or more items in your order are not eligible for Cash on Delivery. Online payment is required.",
              },
              { status: 400 }
            );
          }
          if (p.cod_fee != null) codFees.push(Number(p.cod_fee));
          buyNowSubtotal += Number(p.price || 0) * Number(it.quantity || 1);
        }

        const highestCodFee = codFees.length > 0 ? Math.max(...codFees) : undefined;
        const shippingQuote = await getShippingQuote({
          deliveryPincode: shippingData.shippingPostalCode,
          subtotal: buyNowSubtotal,
          paymentMethod: "cod",
          productCodFeeOverride: highestCodFee,
        });

        if (!shippingQuote.serviceable) {
          return NextResponse.json(
            {
              ok: false,
              error: "The delivery pincode is not serviceable by courier. Please change your delivery address.",
            },
            { status: 400 }
          );
        }

        if (!shippingQuote.isCodEligible) {
          return NextResponse.json(
            {
              ok: false,
              error:
                shippingQuote.ineligibilityReason ||
                "Cash on Delivery is not available for this delivery pincode or order value. Online payment is required.",
            },
            { status: 400 }
          );
        }

        const finalOrderTotal = buyNowSubtotal + shippingQuote.finalCustomerShippingFee;
        if (storeSettings.codMaxOrderValue && finalOrderTotal > storeSettings.codMaxOrderValue) {
          return NextResponse.json(
            {
              ok: false,
              error: `Order total of ₹${finalOrderTotal} exceeds the maximum Cash on Delivery limit of ₹${storeSettings.codMaxOrderValue}. Online payment is required.`,
            },
            { status: 400 }
          );
        }

        if (body.expectedShippingFee !== undefined && body.expectedShippingFee !== null) {
          if (Number(body.expectedShippingFee) !== shippingQuote.finalCustomerShippingFee) {
            console.error(`[API /orders 409 BuyNow] body.expectedShippingFee=${body.expectedShippingFee} (${typeof body.expectedShippingFee}) vs shippingQuote=${shippingQuote.finalCustomerShippingFee}`);
            return NextResponse.json(
              {
                ok: false,
                code: "SHIPPING_PRICE_CHANGED",
                error: "shipping price changed",
                message: "Shipping fee has changed since you reviewed your order. Please review the updated total and confirm.",
                newShippingFee: shippingQuote.finalCustomerShippingFee,
                newTotal: finalOrderTotal,
                quote: shippingQuote,
              },
              { status: 409 }
            );
          }
        }

        const order = await createOrderFromBuyNow(
          user.id,
          { ...shippingData, paymentMethod: "Cash on Delivery" },
          body.items,
          { paymentMethod: "Cash on Delivery" }
        );

        // If an intent/attempt existed, mark it converted/consumed if applicable
        const targetAttemptId = body.intentId || body.attemptId;
        if (targetAttemptId) {
          try {
            await query(
              "UPDATE checkout_attempts SET status = 'converted', order_id = ?, updated_at = NOW() WHERE id = ? AND user_id = ?",
              [order.id, targetAttemptId, user.id]
            );
            await query(
              "UPDATE stock_reservations SET status = 'consumed', updated_at = NOW() WHERE attempt_id = ? AND status = 'active'",
              [targetAttemptId]
            );
          } catch {}
        }

        return NextResponse.json(
          { ok: true, order },
          { status: 201 }
        );
      } else {
        // Cart Checkout: query user's active cart joined with products to verify COD eligibility
        const activeItems = await query<any[]>(
          `SELECT p.id, p.name, p.cod_enabled, p.cod_fee, ci.quantity, COALESCE(pv.price, p.price) as unit_price
           FROM cart_items ci
           INNER JOIN carts c ON ci.cart_id = c.id
           INNER JOIN products p ON ci.product_id = p.id
           LEFT JOIN product_variants pv ON ci.variant_id = pv.id
           WHERE c.user_id = ? AND c.status = 'active'`,
          [user.id]
        );

        if (!activeItems || activeItems.length === 0) {
          return NextResponse.json(
            { ok: false, error: "Your cart is empty. Please add items before checking out." },
            { status: 400 }
          );
        }

        const hasIneligibleProduct = activeItems.some(
          (p) => p.cod_enabled === 0 || p.cod_enabled === false
        );
        if (hasIneligibleProduct) {
          return NextResponse.json(
            {
              ok: false,
              error: "One or more items in your cart are not eligible for Cash on Delivery. Online payment is required.",
            },
            { status: 400 }
          );
        }

        const cartSubtotal = activeItems.reduce(
          (sum, it) => sum + Number(it.unit_price || 0) * Number(it.quantity || 1),
          0
        );
        const codFees = activeItems
          .map((p) => p.cod_fee)
          .filter((f) => f != null)
          .map((f) => Number(f));
        const highestCodFee = codFees.length > 0 ? Math.max(...codFees) : undefined;

        const shippingQuote = await getShippingQuote({
          deliveryPincode: shippingData.shippingPostalCode,
          subtotal: cartSubtotal,
          paymentMethod: "cod",
          productCodFeeOverride: highestCodFee,
        });

        if (!shippingQuote.serviceable) {
          return NextResponse.json(
            {
              ok: false,
              error: "The delivery pincode is not serviceable by courier. Please change your delivery address.",
            },
            { status: 400 }
          );
        }

        if (!shippingQuote.isCodEligible) {
          return NextResponse.json(
            {
              ok: false,
              error:
                shippingQuote.ineligibilityReason ||
                "Cash on Delivery is not available for this delivery pincode or order value. Online payment is required.",
            },
            { status: 400 }
          );
        }

        const finalOrderTotal = cartSubtotal + shippingQuote.finalCustomerShippingFee;
        if (storeSettings.codMaxOrderValue && finalOrderTotal > storeSettings.codMaxOrderValue) {
          return NextResponse.json(
            {
              ok: false,
              error: `Order total of ₹${finalOrderTotal} exceeds the maximum Cash on Delivery limit of ₹${storeSettings.codMaxOrderValue}. Online payment is required.`,
            },
            { status: 400 }
          );
        }

        if (body.expectedShippingFee !== undefined && body.expectedShippingFee !== null) {
          if (Number(body.expectedShippingFee) !== shippingQuote.finalCustomerShippingFee) {
            console.error(`[API /orders 409 Cart] body.expectedShippingFee=${body.expectedShippingFee} (${typeof body.expectedShippingFee}) vs shippingQuote=${shippingQuote.finalCustomerShippingFee}`);
            return NextResponse.json(
              {
                ok: false,
                code: "SHIPPING_PRICE_CHANGED",
                error: "shipping price changed",
                message: "Shipping fee has changed since you reviewed your cart. Please review the updated total and confirm.",
                newShippingFee: shippingQuote.finalCustomerShippingFee,
                newTotal: finalOrderTotal,
                quote: shippingQuote,
              },
              { status: 409 }
            );
          }
        }

        const order = await createOrderFromCart(
          user.id,
          { ...shippingData, paymentMethod: "Cash on Delivery" },
          { paymentMethod: "Cash on Delivery" }
        );
        return NextResponse.json(
          { ok: true, order },
          { status: 201 }
        );
      }
    }

    // Standard Online Prepaid Flow: Create or reuse checkout attempt.
    let attempt;
    const targetAttemptId = body.intentId || body.attemptId;
    if (targetAttemptId) {
      const existingAttempt = await getCheckoutAttemptById(targetAttemptId);
      if (existingAttempt && existingAttempt.userId === user.id) {
        const isConverted = existingAttempt.status === "converted";
        if (isConverted) {
          return NextResponse.json({ ok: false, error: "This checkout has already been completed." }, { status: 409 });
        }

        const isExpired = new Date(existingAttempt.expiresAt) <= new Date();

        // Verify stock reservations for this attempt are still actively held
        const resRows = await query<Array<{ activeCount: number }>>(
          "SELECT count(*) as activeCount FROM stock_reservations WHERE attempt_id = ? AND status = 'active'",
          [existingAttempt.id]
        );
        const hasActiveReservations = Number(resRows?.[0]?.activeCount || 0) > 0;

        if (!isExpired && hasActiveReservations) {
          const updatedCheckoutData = {
            ...existingAttempt.checkoutData,
            shippingAddress: shippingData,
          };
          await query(
            "UPDATE checkout_attempts SET status = 'pending', checkout_data = ?, updated_at = NOW() WHERE id = ?",
            [JSON.stringify(updatedCheckoutData), existingAttempt.id]
          );
          existingAttempt.status = "pending";
          existingAttempt.checkoutData = updatedCheckoutData;
          attempt = existingAttempt;
        }
      }
    }

    if (!attempt && body.isBuyNow && Array.isArray(body.items) && body.items.length > 0) {
      attempt = await createBuyNowCheckoutAttempt(user.id, shippingData, body.items);
    } else if (!attempt) {
      attempt = await createCheckoutAttemptFromCart(user.id, shippingData);
    }

    // 409 Check for Prepaid Online Checkout: never silently charge a different shipping amount
    if (body.expectedShippingFee !== undefined && body.expectedShippingFee !== null) {
      const attemptShipping = Number(attempt.checkoutData?.shippingAmount || 0);
      if (Number(body.expectedShippingFee) !== attemptShipping) {
        console.error(`[API /orders 409 PrepaidAttempt] body.expectedShippingFee=${body.expectedShippingFee} (${typeof body.expectedShippingFee}) vs attemptShipping=${attemptShipping}`);
        return NextResponse.json(
          {
            ok: false,
            code: "SHIPPING_PRICE_CHANGED",
            error: "shipping price changed",
            message: "Shipping fee has changed since you reviewed your checkout. Please review the updated total and confirm.",
            newShippingFee: attemptShipping,
            newTotal: attempt.amount,
          },
          { status: 409 }
        );
      }
    }

    return NextResponse.json(
      {
        ok: true,
        attemptId: attempt.id,
        isAttempt: true,
        order: {
          id: attempt.id,
          orderNumber: `ATT-${attempt.id.slice(0, 8).toUpperCase()}`,
          userId: attempt.userId,
          status: "pending",
          paymentStatus: "pending",
          subtotal: attempt.checkoutData.subtotal,
          discountAmount: attempt.checkoutData.discountAmount,
          shippingAmount: attempt.checkoutData.shippingAmount,
          totalAmount: attempt.amount,
          currency: attempt.currency,
          isAttempt: true,
        },
      },
      { status: 201 }
    );
  } catch (err) {
    if (err instanceof OrderValidationError || err instanceof CheckoutAttemptError) {
      return NextResponse.json(
        { ok: false, error: err.message },
        { status: err.statusCode }
      );
    }
    return handleAuthError(err, "Failed to create order");
  }
}

/**
 * GET /api/orders — List the authenticated customer's orders.
 *
 * Excludes abandoned online checkout attempts by default.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireUser();
    const url = new URL(request.url);

    const result = await listCustomerOrders(user.id, {
      status: (url.searchParams.get("status") as any) || undefined,
      paymentStatus: (url.searchParams.get("paymentStatus") as any) || undefined,
      page: parseInt(url.searchParams.get("page") || "1", 10),
      limit: parseInt(url.searchParams.get("limit") || "20", 10),
      placedOnly: true, // Only show valid placed orders
    });

    return withPrivateCacheHeaders(NextResponse.json({ ok: true, ...result }));
  } catch (err) {
    if (err instanceof OrderValidationError || err instanceof CheckoutAttemptError) {
      return NextResponse.json(
        { ok: false, error: err.message },
        { status: err.statusCode }
      );
    }
    return handleAuthError(err, "Failed to fetch orders");
  }
}
