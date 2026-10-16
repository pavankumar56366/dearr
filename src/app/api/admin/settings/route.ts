import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, handleAuthError, assertSafeOrigin, jsonPrivate } from "@/lib/server";
import {
  getStoreSettings,
  updateStoreSettings,
  getSettingsAuditHistory,
} from "@/lib/server/settings";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/admin/settings — Return authorized Dearr store settings for Admin Operations.
 * Enforces requireAdmin(). Reads persisted settings from Hostinger MySQL.
 * If ?audit=true is passed, returns recent settings audit history.
 */
export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
    const url = new URL(request.url);
    if (url.searchParams.get("audit") === "true") {
      const history = await getSettingsAuditHistory(50);
      return jsonPrivate({ ok: true, history });
    }

    const settings = await getStoreSettings();

    return jsonPrivate({
      ok: true,
      settings,
    });
  } catch (err: unknown) {
    return handleAuthError(err, "Failed to retrieve store settings");
  }
}

/**
 * PATCH /api/admin/settings — Update Dearr store settings in MySQL.
 * Enforces requireAdmin() and assertSafeOrigin(). Validates parameters, logs audit history with admin.id, and persists to MySQL.
 */
export async function PATCH(request: NextRequest) {
  try {
    assertSafeOrigin(request);
    const admin = await requireAdmin();

    let body: any;
    try {
      body = await request.json();
    } catch {
      return jsonPrivate({ ok: false, error: "Invalid JSON body" }, { status: 400 });
    }

    if (!body || typeof body !== "object") {
      return jsonPrivate({ ok: false, error: "Request body must be an object" }, { status: 400 });
    }

    const updated = await updateStoreSettings(body, admin.id);

    return jsonPrivate({
      ok: true,
      settings: updated,
    });
  } catch (err: unknown) {
    if (
      err instanceof Error &&
      (err.message.includes("Invalid") ||
        err.message.includes("cannot be negative") ||
        err.message.includes("greater than zero") ||
        err.message.includes("between 1 and 72") ||
        err.message.includes("between 1 and 10") ||
        err.message.includes("between 1 and 4") ||
        err.message.includes("Feedback reasons") ||
        err.message.includes("feedback reason") ||
        err.message.includes("must be a boolean"))
    ) {
      return jsonPrivate({ ok: false, error: err.message }, { status: 400 });
    }
    return handleAuthError(err, "Failed to update store settings");
  }
}

/**
 * POST /api/admin/settings — Convenience alias for PATCH with CSRF validation.
 */
export async function POST(request: NextRequest) {
  try {
    assertSafeOrigin(request);
    return await PATCH(request);
  } catch (err: unknown) {
    return handleAuthError(err, "Failed to update store settings");
  }
}
