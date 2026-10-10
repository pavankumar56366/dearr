import { NextResponse } from "next/server";
import { requireUser, handleAuthError } from "@/lib/server/auth";
import {
  getCustomerAddressById,
  updateCustomerAddress,
  deleteCustomerAddress,
} from "@/lib/server/address";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  let session;
  try {
    session = await requireUser();
  } catch (err) {
    return handleAuthError(err);
  }

  const { id } = await params;
  const addressId = id?.trim();

  if (!addressId) {
    return NextResponse.json(
      { ok: false, error: "Address ID is required" },
      { status: 400 }
    );
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

  try {
    const existing = await getCustomerAddressById(session.id, addressId);
    if (!existing) {
      return NextResponse.json(
        { ok: false, error: "Address not found or unauthorized" },
        { status: 404 }
      );
    }

    const updated = await updateCustomerAddress(session.id, addressId, {
      label: body.label !== undefined ? (body.label ? String(body.label).trim() : null) : undefined,
      fullName: body.fullName !== undefined ? String(body.fullName).trim() : undefined,
      phone: body.phone !== undefined ? String(body.phone).trim() : undefined,
      addressLine1: body.addressLine1 !== undefined ? String(body.addressLine1).trim() : undefined,
      addressLine2: body.addressLine2 !== undefined ? (body.addressLine2 ? String(body.addressLine2).trim() : null) : undefined,
      city: body.city !== undefined ? String(body.city).trim() : undefined,
      state: body.state !== undefined ? String(body.state).trim() : undefined,
      postalCode: body.postalCode !== undefined ? String(body.postalCode).trim() : undefined,
      country: body.country !== undefined ? String(body.country).trim() : undefined,
      isDefault: body.isDefault !== undefined ? Boolean(body.isDefault) : undefined,
    });

    return NextResponse.json({ ok: true, address: updated });
  } catch (error: any) {
    console.error("[API_ADDRESSES_UPDATE_ERROR]", error?.message || error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to update address" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  let session;
  try {
    session = await requireUser();
  } catch (err) {
    return handleAuthError(err);
  }

  const { id } = await params;
  const addressId = id?.trim();

  if (!addressId) {
    return NextResponse.json(
      { ok: false, error: "Address ID is required" },
      { status: 400 }
    );
  }

  try {
    const existing = await getCustomerAddressById(session.id, addressId);
    if (!existing) {
      return NextResponse.json(
        { ok: false, error: "Address not found or unauthorized" },
        { status: 404 }
      );
    }

    const success = await deleteCustomerAddress(session.id, addressId);
    return NextResponse.json({ ok: success });
  } catch (error: any) {
    console.error("[API_ADDRESSES_DELETE_ERROR]", error?.message || error);
    return NextResponse.json(
      { ok: false, error: "Failed to delete address" },
      { status: 500 }
    );
  }
}
