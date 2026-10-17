import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { requireAdmin, handleAuthError, jsonPrivate } from "@/lib/server";
import { retryPendingEmailOutboxJobs } from "@/lib/server/email";

export const dynamic = "force-dynamic";

function safeCompareAuthHeader(provided: string | null, secret: string | undefined): boolean {
  if (!provided || !secret) return false;
  const expected = `Bearer ${secret}`;
  const provHash = crypto.createHash("sha256").update(provided).digest();
  const expHash = crypto.createHash("sha256").update(expected).digest();
  return crypto.timingSafeEqual(provHash, expHash) && provided.length === expected.length;
}

/**
 * POST /api/admin/emails/retry
 *
 * Idempotent retry dispatcher for failed or pending transactional email jobs.
 * Protected by admin authorization OR internal CRON_SECRET authorization header.
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET?.trim();

    const isCronAuthorized = safeCompareAuthHeader(authHeader, cronSecret);

    if (!isCronAuthorized) {
      await requireAdmin();
    }

    const body = await request.json().catch(() => ({}));
    const limit = typeof body?.limit === "number" ? body.limit : 20;

    const stats = await retryPendingEmailOutboxJobs(limit);

    return jsonPrivate({
      ok: true,
      stats,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    return handleAuthError(err, "Failed to execute email retry dispatch");
  }
}
