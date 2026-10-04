import { NextResponse } from "next/server";
import { requireAdmin, handleAuthError } from "@/lib/server/auth";
import { DEFAULT_ADMIN_SETTINGS } from "@/lib/admin-settings";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/admin/settings — Return authorized Dearr store settings for Admin Operations.
 * Enforces requireAdmin(). Returns safe store configuration (zero credentials/secrets).
 */
export async function GET() {
  try {
    await requireAdmin();

    return NextResponse.json({
      ok: true,
      settings: DEFAULT_ADMIN_SETTINGS,
      meta: {
        persistence: "Intentionally non-persistent V1",
        notice: "Store parameters are governed by production environment configuration for Dearr V1.",
      },
    });
  } catch (err: unknown) {
    return handleAuthError(err, "Failed to retrieve store settings");
  }
}
