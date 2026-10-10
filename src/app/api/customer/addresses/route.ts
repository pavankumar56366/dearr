import { NextResponse } from "next/server";
import { requireUser, handleAuthError } from "@/lib/server/auth";
import {
  listCustomerAddresses,
  createCustomerAddress,
} from "@/lib/server/address";
import { deliveryAddressSchema } from "@/lib/checkout-validation";

export async function GET() {
  let session;
  try {
    session = await requireUser();
  } catch (err) {
    return handleAuthError(err);
  }

  try {
    const addresses = await listCustomerAddresses(session.id);
    return NextResponse.json({ ok: true, addresses });
  } catch (error: any) {
    console.error("[API_ADDRESSES_GET_ERROR]", error?.message || error);
    return NextResponse.json(
      { ok: false, error: "Failed to retrieve saved addresses" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  let session;
  try {
    session = await requireUser();
  } catch (err) {
    return handleAuthError(err);
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON request payload" },
      { status: 400 }
    );
  }

  const parseResult = deliveryAddressSchema.safeParse(body);
  if (!parseResult.success) {
    const issues = parseResult.error.issues.map((i) => i.message);
    return NextResponse.json(
      { ok: false, error: issues[0] || "Invalid address data" },
      { status: 400 }
    );
  }

  try {
    const address = await createCustomerAddress(session.id, {
      label: body.label || null,
      fullName: parseResult.data.fullName,
      phone: parseResult.data.phone,
      addressLine1: parseResult.data.addressLine1,
      addressLine2: parseResult.data.addressLine2 || null,
      city: parseResult.data.city,
      state: parseResult.data.state,
      postalCode: parseResult.data.postalCode,
      country: parseResult.data.country || "India",
      isDefault: Boolean(body.isDefault),
    });

    return NextResponse.json({ ok: true, address }, { status: 201 });
  } catch (error: any) {
    console.error("[API_ADDRESSES_CREATE_ERROR]", error?.message || error);
    return NextResponse.json(
      { ok: false, error: "Failed to create customer address" },
      { status: 500 }
    );
  }
}
