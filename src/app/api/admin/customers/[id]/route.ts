import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, handleAuthError } from "@/lib/server/auth";
import { getAdminCustomerById, updateAdminCustomerRecord } from "@/lib/server/customer";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/admin/customers/[id] — Fetch single customer details for admin.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    await requireAdmin();
    const { id } = await context.params;
    const decodedId = decodeURIComponent(id);

    const customer = await getAdminCustomerById(decodedId);
    if (!customer) {
      return NextResponse.json({ ok: false, error: "Customer not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, customer });
  } catch (err: unknown) {
    return handleAuthError(err, "Failed to retrieve customer details");
  }
}

/**
 * PATCH /api/admin/customers/[id] — Update customer contact info.
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    await requireAdmin();
    const { id } = await context.params;
    const decodedId = decodeURIComponent(id);

    const body = await request.json();
    const updated = await updateAdminCustomerRecord(decodedId, {
      name: body.name,
      phone: body.phone,
    });

    if (!updated) {
      return NextResponse.json({ ok: false, error: "Customer not found or update failed" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, customer: updated });
  } catch (err: unknown) {
    return handleAuthError(err, "Failed to update customer");
  }
}
