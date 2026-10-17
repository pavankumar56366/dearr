import { NextRequest, NextResponse } from "next/server";
import { assertSafeOrigin, jsonPrivate } from "@/lib/server";
import { confirmPasswordReset, OtpError } from "@/lib/server/otp";

export const dynamic = "force-dynamic";

/**
 * POST /api/auth/password-reset/confirm
 *
 * Consumes the validated OTP and securely updates the customer's password.
 * - Validates minimum password entropy (min 8 characters).
 * - Hashes password using bcrypt (10 rounds).
 * - Increments customer token_version, revoking all existing active sessions.
 * - Atomically marks OTP as consumed, preventing replay.
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

    const result = await confirmPasswordReset({
      resetToken: body?.resetToken,
      email: body?.email,
      otp: body?.otp,
      newPassword: body?.password || body?.newPassword,
      confirmPassword: body?.confirmPassword,
    });

    return jsonPrivate(result, { status: 200 });
  } catch (err: any) {
    if (err instanceof OtpError) {
      return jsonPrivate(
        { ok: false, error: err.message },
        { status: err.statusCode }
      );
    }

    console.error("[PASSWORD_RESET_CONFIRM_ERROR]", err?.message || err);
    return jsonPrivate(
      { ok: false, error: "An unexpected error occurred while updating your password." },
      { status: 500 }
    );
  }
}
