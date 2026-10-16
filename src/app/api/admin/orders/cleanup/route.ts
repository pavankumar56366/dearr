import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { requireAdmin, handleAuthError } from "@/lib/server/auth";
import { cleanupCheckoutAttempts } from "@/lib/server/checkout-attempt";

export const dynamic = "force-dynamic";

function safeCompareAuthHeader(provided: string | null, secret: string | undefined): boolean {
  if (!provided || !secret) return false;
  const expected = `Bearer ${secret}`;
  const provHash = crypto.createHash("sha256").update(provided).digest();
  const expHash = crypto.createHash("sha256").update(expected).digest();
  return crypto.timingSafeEqual(provHash, expHash) && provided.length === expected.length;
}

/**
 * POST /api/admin/orders/cleanup
 *
 * Idempotent cleanup endpoint for checkout attempts:
 * 1. Expires unpaid checkout attempts older than 30 minutes.
 * 2. Purges expired checkout attempts older than 30 days retention.
 *
 * Placed orders and order items are strictly preserved and never deleted.
 *
 * Protected by admin authorization or internal CRON_SECRET authorization header.
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET?.trim();

    const isCronAuthorized = safeCompareAuthHeader(authHeader, cronSecret);

    if (!isCronAuthorized) {
      await requireAdmin();
    }

    const { expiredCount, purgedCount } = await cleanupCheckoutAttempts();

    return NextResponse.json({
      ok: true,
      result: {
        expiredCount,
        purgedCount,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (err: any) {
    return handleAuthError(err, "Failed to execute checkout attempts cleanup");
  }
}
