import { NextResponse } from "next/server";
import {
  buildGoogleAuthUrl,
  generateOAuthState,
  GOOGLE_STATE_COOKIE,
  GOOGLE_STATE_MAX_AGE,
} from "@/lib/server/google-oauth";

/**
 * GET /api/auth/google
 *
 * Initiates the Google OAuth 2.0 authorization flow.
 *
 * 1. Generates a cryptographically random state for CSRF protection.
 * 2. Stores the state in a short-lived HttpOnly cookie.
 * 3. Redirects the browser to Google's authorization endpoint.
 *
 * Security:
 * - State is 32 bytes of crypto-random data (64 hex chars).
 * - Cookie is HttpOnly, SameSite=Lax, Secure in production.
 * - GOOGLE_CLIENT_SECRET is never included in the authorization URL.
 */
export async function GET(request: Request): Promise<NextResponse> {
  try {
    const state = generateOAuthState();
    const authUrl = buildGoogleAuthUrl(state);

    const isProduction = process.env.NODE_ENV === "production";

    const response = NextResponse.redirect(authUrl);

    // Store the state in a short-lived HttpOnly cookie for CSRF validation in callback
    response.cookies.set(GOOGLE_STATE_COOKIE, state, {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
      path: "/",
      maxAge: GOOGLE_STATE_MAX_AGE,
    });

    return response;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("[GET /api/auth/google]", message);
    return NextResponse.redirect(
      new URL("/login?error=oauth_config_error", request.url)
    );
  }
}
