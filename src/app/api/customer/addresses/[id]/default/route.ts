import { NextResponse } from "next/server";
import { requireUser, handleAuthError, assertSafeOrigin, jsonPrivate } from "@/lib/server";
import {
  getCustomerAddressById,
  setDefaultCustomerAddress,
} from "@/lib/server/address";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  let session;
  try {
    assertSafeOrigin(req);
    session = await requireUser();
  } catch (err) {
    return handleAuthError(err);
  }

  const { id } = await params;
  const addressId = id?.trim();

  if (!addressId) {
    return jsonPrivate(
      { ok: false, error: "Address ID is required" },
      { status: 400 }
    );
  }

  try {
    const existing = await getCustomerAddressById(session.id, addressId);
    if (!existing) {
      return jsonPrivate(
        { ok: false, error: "Address not found or unauthorized" },
        { status: 404 }
      );
    }

    const updated = await setDefaultCustomerAddress(session.id, addressId);
    return jsonPrivate({ ok: true, address: updated });
  } catch (error: any) {
    console.error("[API_ADDRESSES_SET_DEFAULT_ERROR]", error?.message || error);
    return jsonPrivate(
      { ok: false, error: "Failed to set default address" },
      { status: 500 }
    );
  }
}
