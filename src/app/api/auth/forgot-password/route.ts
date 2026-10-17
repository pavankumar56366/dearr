import { NextRequest, NextResponse } from "next/server";
import { assertSafeOrigin, jsonPrivate } from "@/lib/server";
import { requestPasswordResetOtp, OtpError } from "@/lib/server/otp";

export const dynamic = "force-dynamic";

/**
 * POST /api/auth/forgot-password
 *
 * Initiates the password recovery OTP flow.
 * - Applies IP-based throttling.
 * - Applies concurrency-safe daily account limit (max 2 requests per account per UTC day).
 * - Issues a cryptographically secure 6-digit OTP with a 10-minute expiry for eligible accounts.
 * - Dispatches transactional email via Resend.
 * - Returns a generic public response preventing account enumeration.
 */
export async function POST(request: NextRequest) {
  try {
    assertSafeOrigin(request);

    let body: any;
    try {
      body = await request.json();
    } catch {
      return jsonPrivate(
        { ok: false, error: "Invalid JSON request body" },
        { status: 400 }
      );
    }

    const clientIp =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "127.0.0.1";

    const result = await requestPasswordResetOtp({
      email: body?.email,
      clientIp,
    });

    return jsonPrivate(result, { status: 200 });
  } catch (err: any) {
    if (err instanceof OtpError) {
      const headers: Record<string, string> = {};
      if (err.retryAfterSeconds) {
        headers["Retry-After"] = String(err.retryAfterSeconds);
      }
      return jsonPrivate(
        { ok: false, error: err.message },
        { status: err.statusCode, headers }
      );
    }

    console.error("[FORGOT_PASSWORD_ERROR]", err?.message || err);
    return jsonPrivate(
      { ok: false, error: "An unexpected error occurred while processing your request." },
      { status: 500 }
    );
  }
}
