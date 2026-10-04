import { NextResponse } from "next/server";
import { clearSession, attachClearSessionCookie } from "@/lib/server";

export async function POST() {
  try {
    await clearSession();
    const response = NextResponse.json({ ok: true, message: "Logged out successfully" });
    attachClearSessionCookie(response);
    return response;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("[POST /api/auth/logout]", message);
    return NextResponse.json(
      { ok: false, error: "Logout failed. Please try again." },
      { status: 500 }
    );
  }
}
