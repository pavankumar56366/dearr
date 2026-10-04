import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, handleAuthError } from "@/lib/server/auth";
import { listAdminCustomers } from "@/lib/server/customer";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/admin/customers — List registered customers for Admin Operations.
 * Enforces requireAdmin(). Returns sanitized customer records.
 */
export async function GET(request: NextRequest) {
  try {
    await requireAdmin();

    const url = new URL(request.url);
    const search = url.searchParams.get("search") || undefined;
    const roleParam = url.searchParams.get("role") || undefined;

    const customers = await listAdminCustomers({
      search,
      role: roleParam === "admin" ? "admin" : roleParam === "ALL" ? "ALL" : "customer",
    });

    return NextResponse.json({
      ok: true,
      customers,
    });
  } catch (err: unknown) {
    return handleAuthError(err, "Failed to retrieve customers");
  }
}
