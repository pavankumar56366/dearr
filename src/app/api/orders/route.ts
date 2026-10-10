import { NextRequest, NextResponse } from "next/server";
import { requireUser, handleAuthError } from "@/lib/server/auth";
import {
  createOrderFromCart,
  listCustomerOrders,
  OrderValidationError,
} from "@/lib/server/order";
import {
  getCustomerAddressById,
  createCustomerAddress,
} from "@/lib/server/address";

/**
 * POST /api/orders — Create a new order from the customer's active cart.
 *
 * Body: { shippingFullName?, shippingPhone?, shippingAddressLine1?, shippingAddressLine2?,
 *         shippingCity?, shippingState?, shippingPostalCode?, shippingCountry?,
 *         addressId?, saveAddress? }
 *
 * Server-side authoritative flow:
 * - If addressId is provided, ownership is strictly verified against user.id in MySQL.
 * - Prices, discounts, stock, totals computed from MySQL (NEVER from browser).
 * - Payment status starts as 'pending' (B-18 Razorpay handles actual payment).
 */
export async function POST(request: NextRequest) {
  try {
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

    const order = await createOrderFromCart(user.id, shippingData);

    return NextResponse.json(
      { ok: true, order },
      { status: 201 }
    );
  } catch (err) {
    if (err instanceof OrderValidationError) {
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
 * Query params:
 *   status? — filter by order status
 *   paymentStatus? — filter by payment status
 *   page? — pagination page (default 1)
 *   limit? — items per page (default 20, max 50)
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
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    if (err instanceof OrderValidationError) {
      return NextResponse.json(
        { ok: false, error: err.message },
        { status: err.statusCode }
      );
    }
    return handleAuthError(err, "Failed to fetch orders");
  }
}
