import { NextRequest, NextResponse } from "next/server";
import { assertSafeOrigin, jsonPrivate } from "@/lib/server";
import { verifyPasswordResetOtp, OtpError } from "@/lib/server/otp";

export const dynamic = "force-dynamic";

/**
 * POST /api/auth/password-reset/verify
 *
 * Verifies a customer's submitted 6-digit OTP against MySQL.
 * - Enforces 10-minute expiry window.
 * - Enforces max 5 verification attempts per OTP.
 * - Returns a signed single-use resetToken authorizing password update.
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

    const email = body?.email;
    const otp = body?.otp;

    if (!email || !otp) {
      return jsonPrivate(
        { ok: false, error: "Email and 6-digit verification code are required" },
        { status: 400 }
      );
    }

    const result = await verifyPasswordResetOtp({ email, otp });
    return jsonPrivate(result, { status: 200 });
  } catch (err: any) {
    if (err instanceof OtpError) {
      return jsonPrivate(
        { ok: false, error: err.message },
        { status: err.statusCode }
      );
    }

    console.error("[OTP_VERIFY_ERROR]", err?.message || err);
    return jsonPrivate(
      { ok: false, error: "An unexpected error occurred while verifying the code." },
      { status: 500 }
    );
  }
}
