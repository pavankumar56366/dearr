import { NextResponse } from "next/server";
import {
  clearSession,
  attachClearSessionCookie,
  getSession,
  incrementTokenVersion,
  assertSafeOrigin,
  handleAuthError,
} from "@/lib/server";

export async function POST(request: Request) {
  try {
    assertSafeOrigin(request);

    // If an active session exists, increment token_version in MySQL to invalidate previously issued JWTs server-side
    const session = await getSession();
    if (session?.sub) {
      const revoked = await incrementTokenVersion(session.sub);
      if (!revoked) {
        console.error(`[POST /api/auth/logout] Failed to increment token_version for user ${session.sub}`);
        return NextResponse.json(
          { ok: false, error: "Session invalidation failed. Please try again." },
          { status: 500 }
        );
      }
    }

    await clearSession();
    const response = NextResponse.json(
      { ok: true, message: "Logged out successfully" },
      {
        headers: {
          "Cache-Control": "private, no-cache, no-store, max-age=0, must-revalidate",
          Pragma: "no-cache",
        },
      }
    );
    attachClearSessionCookie(response);
    return response;
  } catch (err: unknown) {
    return handleAuthError(err, "Logout failed. Please try again.");
  }
}
