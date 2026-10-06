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
 * PATCH /api/admin/customers/[id] — Update customer contact info, status, notes, or address.
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    await requireAdmin();
    const { id } = await context.params;
    const decodedId = decodeURIComponent(id);

    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
    }

    // Validate status if provided
    let statusToUpdate = undefined;
    if (body.status !== undefined) {
      const allowedStatuses = ["active", "suspended", "blocked", "inactive"];
      if (!allowedStatuses.includes(body.status)) {
        return NextResponse.json(
          { ok: false, error: "Invalid status. Allowed values: active, suspended" },
          { status: 400 }
        );
      }
      statusToUpdate = body.status === "suspended" || body.status === "blocked" ? "suspended" : "active";
    }

    // Support notes or reason passed from status modal or form
    const notesToUpdate = body.notes !== undefined ? body.notes : body.reason !== undefined ? body.reason : undefined;

    const updated = await updateAdminCustomerRecord(decodedId, {
      name: typeof body.name === "string" ? body.name : undefined,
      phone: typeof body.phone === "string" ? body.phone : undefined,
      status: statusToUpdate as any,
      notes: typeof notesToUpdate === "string" ? notesToUpdate : undefined,
      defaultAddress: body.defaultAddress && typeof body.defaultAddress === "object" ? body.defaultAddress : undefined,
    });

    if (!updated) {
      return NextResponse.json({ ok: false, error: "Customer not found or update failed" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, customer: updated });
  } catch (err: unknown) {
    return handleAuthError(err, "Failed to update customer");
  }
}
