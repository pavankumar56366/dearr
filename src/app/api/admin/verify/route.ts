import { NextResponse } from "next/server";
import { requireAdmin, handleAuthError } from "@/lib/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/admin/verify
 * Protected API endpoint asserting server-side administrator authorization.
 *
 * Security Enforcement:
 * - Unauthenticated request -> HTTP 401 Unauthorized
 * - Authenticated non-admin (customer) -> HTTP 403 Forbidden
 * - Authenticated admin -> HTTP 200 OK with sanitized admin identity
 *
 * Guarantees that admin authorization is verified against live Hostinger MySQL
 * database records, never trusting client-side UI state.
 */
export async function GET() {
  try {
    const admin = await requireAdmin();

    return NextResponse.json(
      {
        ok: true,
        admin: {
          id: admin.id,
          email: admin.email,
          fullName: admin.fullName,
          role: admin.role,
        },
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    return handleAuthError(err, "Forbidden: Administrator privileges required");
  }
}
