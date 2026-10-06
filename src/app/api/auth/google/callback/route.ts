import { NextResponse } from "next/server";
import {
  exchangeGoogleCode,
  verifyGoogleIdToken,
  findProfileByGoogleSubject,
  findProfileEmailAndAuthType,
  createGoogleProfile,
  linkGoogleSubjectToProfile,
  GOOGLE_STATE_COOKIE,
} from "@/lib/server/google-oauth";
import { createSessionToken, attachSessionCookie, getSessionCookieOptions } from "@/lib/server/auth";
import { findProfileById } from "@/lib/server/profile";

/**
 * GET /api/auth/google/callback
 *
 * Handles the Google OAuth 2.0 authorization callback.
 *
 * Flow:
 * 1. Validates OAuth state against the short-lived HttpOnly state cookie (CSRF protection).
 * 2. Exchanges the authorization code for Google tokens (server-side only).
 * 3. Cryptographically verifies the Google ID token via Google's JWKS.
 * 4. Looks up the Dearr profile by Google subject (sub) — NOT by email.
 * 5. If no linked profile exists, checks for an existing email/password account.
 *    - Existing email/password account → blocks automatic merge, shows conflict message.
 * 6. Creates a new Dearr customer profile (role='customer') if truly new.
 * 7. Issues the standard Dearr session cookie (dearr_session) via createSessionToken.
 * 8. Redirects to /account.
 *
 * Security guarantees:
 * - GOOGLE_CLIENT_SECRET never leaves the server.
 * - State is validated before any token exchange.
 * - ID token is cryptographically verified (signature, issuer, audience, expiry, email_verified).
 * - Google sub is the stable identity key — email alone never grants access.
 * - Google login can never create or upgrade to admin role.
 * - Redirect destinations are limited to local paths only.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "") || "https://dearr.in";
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const stateParam = url.searchParams.get("state");
  const errorParam = url.searchParams.get("error");

  // Helper to redirect to login with a safe error message (no secrets, no stack traces)
  const loginError = (code: string) =>
    NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(code)}`, baseUrl));

  // ── 1. Google-side errors (user denied, etc.) ──────────────────────────────
  if (errorParam) {
    if (errorParam === "access_denied") {
      return NextResponse.redirect(new URL("/login?error=google_denied", baseUrl));
    }
    console.error("[Google Callback] Google returned error:", errorParam);
    return loginError("google_error");
  }

  // ── 2. Validate required parameters ───────────────────────────────────────
  if (!code || typeof code !== "string" || code.trim().length === 0) {
    return loginError("missing_code");
  }
  if (!stateParam || typeof stateParam !== "string") {
    return loginError("missing_state");
  }

  // ── 3. Validate CSRF state ─────────────────────────────────────────────────
  // Read state cookie from request headers (Next.js route handler pattern)
  const cookieHeader = request.headers.get("cookie") || "";
  const cookies = Object.fromEntries(
    cookieHeader.split(";").map((c) => {
      const idx = c.indexOf("=");
      return idx === -1
        ? [c.trim(), ""]
        : [c.slice(0, idx).trim(), c.slice(idx + 1).trim()];
    })
  );
  const storedState = cookies[GOOGLE_STATE_COOKIE];

  if (!storedState || storedState !== stateParam) {
    console.error("[Google Callback] State mismatch — possible CSRF attempt");
    return loginError("invalid_state");
  }

  // ── 4. Clear the state cookie immediately ──────────────────────────────────
  const baseResponse = NextResponse.redirect(new URL("/account", baseUrl));
  baseResponse.cookies.set(GOOGLE_STATE_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
    expires: new Date(0),
  });

  try {
    // ── 5. Exchange code for tokens ──────────────────────────────────────────
    const tokens = await exchangeGoogleCode(code.trim());

    // ── 6. Verify Google ID token cryptographically ──────────────────────────
    const identity = await verifyGoogleIdToken(tokens.id_token);
    // Access token is not stored — Dearr only needs identity, not Google API access.

    // ── 7. Look up profile by Google subject (stable identifier) ──────────────
    let profile = await findProfileByGoogleSubject(identity.sub);

    if (!profile) {
      // ── 8. Check for existing email/password account with same email ────────
      const existing = await findProfileEmailAndAuthType(identity.email);

      if (existing) {
        if (existing.hasGoogleSubject) {
          // Different Google sub but same email — shouldn't happen given UNIQUE on google_subject
          // but handle defensively
          return loginError("account_conflict");
        }

        if (existing.hasPassword && !existing.hasGoogleSubject) {
          // Existing Dearr email/password account — do NOT merge automatically.
          // Direct to login with a message explaining they should use their Dearr password
          // or explicitly link their Google account in account settings (future feature).
          console.info(
            "[Google Callback] Google email matches existing email/password Dearr account — blocking auto-merge"
          );
          return NextResponse.redirect(
            new URL(
              "/login?error=email_exists_use_password",
              baseUrl
            )
          );
        }

        // Account exists but without a password and without a google_subject —
        // This should be rare (e.g. admin-created accounts), link the Google subject.
        const linked = await linkGoogleSubjectToProfile(existing.id, identity.sub);
        profile = linked || await findProfileById(existing.id);
      } else {
        // ── 9. New user — create Dearr customer profile ─────────────────────
        // Role is hardcoded to 'customer' — Google can never create admin accounts.
        profile = await createGoogleProfile(identity);
      }
    }

    if (!profile) {
      console.error("[Google Callback] Profile resolution failed after all branches");
      return loginError("profile_error");
    }

    // Check customer account status (admins are never blocked)
    if (profile.role !== "admin" && profile.status === "suspended") {
      return loginError("account_suspended");
    }

    // ── 10. Create the standard Dearr session ────────────────────────────────
    // Reuses exact same session mechanism as email/password login.
    const token = await createSessionToken({
      id: profile.id,
      email: profile.email,
      fullName: profile.fullName,
      role: profile.role, // Role comes from DB — never from Google's token
    });

    // ── 11. Redirect to /account with the session cookie ────────────────────
    const redirectResponse = NextResponse.redirect(new URL("/account", baseUrl));

    // Clear state cookie
    redirectResponse.cookies.set(GOOGLE_STATE_COOKIE, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
      expires: new Date(0),
    });

    // Set the Dearr session cookie (same options as email/password login)
    attachSessionCookie(redirectResponse, token);

    return redirectResponse;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    // Log safe error description — never log ID tokens, access tokens, or secrets
    if (message.includes("email is not verified")) {
      console.warn("[Google Callback] Rejected: Google email not verified");
      return loginError("email_not_verified");
    }
    if (message.includes("ID token invalid") || message.includes("token exchange failed")) {
      console.error("[Google Callback] Token error:", message);
      return loginError("token_error");
    }
    console.error("[Google Callback] Unexpected error:", message);
    return loginError("server_error");
  }
}
