import "server-only";
import crypto from "crypto";
import { query } from "./db";
import type { UserProfile } from "./profile";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GoogleIdentityPayload {
  /** Google's stable user identifier — never changes for a given Google account. */
  sub: string;
  email: string;
  email_verified: boolean;
  name?: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
}

export interface GoogleOAuthConfig {
  clientId: string;
  /** Secret is only ever accessed server-side, never exposed to client. */
  clientSecret: string;
  redirectUri: string;
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

/**
 * Returns the Google OAuth configuration from environment variables.
 * Throws a clear error if required values are missing — never leaks secrets.
 */
export function getGoogleOAuthConfig(): GoogleOAuthConfig {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  const redirectUri = process.env.GOOGLE_REDIRECT_URI?.trim();

  if (!clientId) {
    throw new Error("Google OAuth configuration error: GOOGLE_CLIENT_ID is not set.");
  }
  if (!clientSecret) {
    throw new Error("Google OAuth configuration error: GOOGLE_CLIENT_SECRET is not set.");
  }
  if (!redirectUri) {
    throw new Error("Google OAuth configuration error: GOOGLE_REDIRECT_URI is not set.");
  }

  return { clientId, clientSecret, redirectUri };
}

// ---------------------------------------------------------------------------
// State management (CSRF protection)
// ---------------------------------------------------------------------------

export const GOOGLE_STATE_COOKIE = "dearr_google_state";
export const GOOGLE_STATE_MAX_AGE = 10 * 60; // 10 minutes

/**
 * Generates a cryptographically secure random state string for CSRF protection.
 */
export function generateOAuthState(): string {
  return crypto.randomBytes(32).toString("hex");
}

// ---------------------------------------------------------------------------
// Authorization URL
// ---------------------------------------------------------------------------

const GOOGLE_AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";

/**
 * Builds the Google OAuth authorization URL.
 * The client secret is NEVER included in this URL.
 */
export function buildGoogleAuthUrl(state: string): string {
  const config = getGoogleOAuthConfig();

  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    access_type: "online",
    prompt: "select_account",
  });

  return `${GOOGLE_AUTH_ENDPOINT}?${params.toString()}`;
}

// ---------------------------------------------------------------------------
// Token exchange
// ---------------------------------------------------------------------------

const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

interface GoogleTokenResponse {
  id_token: string;
  access_token: string;
  token_type: string;
  expires_in: number;
}

/**
 * Exchanges an authorization code for Google tokens.
 * GOOGLE_CLIENT_SECRET is only used here on the server.
 * Access tokens are NOT persisted — only the ID token is used for identity.
 */
export async function exchangeGoogleCode(code: string): Promise<GoogleTokenResponse> {
  const config = getGoogleOAuthConfig();

  const body = new URLSearchParams({
    code,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: config.redirectUri,
    grant_type: "authorization_code",
  });

  const response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!response.ok) {
    // Log only the safe error code, never the request body (which contains the secret)
    const errText = await response.text().catch(() => "");
    let errCode = "token_exchange_failed";
    try {
      const parsed = JSON.parse(errText);
      errCode = parsed.error || errCode;
    } catch {}
    throw new Error(`Google token exchange failed: ${errCode}`);
  }

  return response.json();
}

// ---------------------------------------------------------------------------
// ID Token verification via Google JWKS
// ---------------------------------------------------------------------------

const GOOGLE_JWKS_URI = "https://www.googleapis.com/oauth2/v3/certs";
const GOOGLE_ISSUER_1 = "https://accounts.google.com";
const GOOGLE_ISSUER_2 = "accounts.google.com";

/**
 * Cryptographically verifies a Google ID token using Google's published JWKS.
 *
 * Verification checks:
 * - RSA signature via Google's live public keys (RS256)
 * - issuer = accounts.google.com
 * - audience = GOOGLE_CLIENT_ID
 * - expiration (exp claim)
 * - email and email_verified
 * - sub (stable Google user identifier)
 *
 * Uses jose's createRemoteJWKSet for live JWKS fetching and caching.
 */
export async function verifyGoogleIdToken(idToken: string): Promise<GoogleIdentityPayload> {
  // Dynamically import jose to keep this server-only
  const { createRemoteJWKSet, jwtVerify } = await import("jose");

  const config = getGoogleOAuthConfig();

  const JWKS = createRemoteJWKSet(new URL(GOOGLE_JWKS_URI));

  let payload: any;
  try {
    const result = await jwtVerify(idToken, JWKS, {
      issuer: [GOOGLE_ISSUER_1, GOOGLE_ISSUER_2],
      audience: config.clientId,
      algorithms: ["RS256"],
    });
    payload = result.payload;
  } catch (err) {
    const message = err instanceof Error ? err.message : "ID token verification failed";
    // Never log the token value itself
    throw new Error(`Google ID token invalid: ${message}`);
  }

  // Validate required claims
  if (!payload.sub || typeof payload.sub !== "string") {
    throw new Error("Google ID token missing required sub claim");
  }
  if (!payload.email || typeof payload.email !== "string") {
    throw new Error("Google ID token missing required email claim");
  }
  if (payload.email_verified !== true) {
    throw new Error("Google account email is not verified");
  }

  return {
    sub: payload.sub,
    email: payload.email,
    email_verified: payload.email_verified,
    name: payload.name,
    given_name: payload.given_name,
    family_name: payload.family_name,
    picture: payload.picture,
  };
}

// ---------------------------------------------------------------------------
// Profile DB operations for Google OAuth
// ---------------------------------------------------------------------------

interface RawProfileRowWithGoogle {
  id: string;
  email: string;
  google_subject: string | null;
  full_name: string;
  phone: string | null;
  role: "customer" | "admin";
  status?: "active" | "suspended";
  admin_notes?: string | null;
  email_verified_at: string | Date | null;
  created_at: string | Date;
  updated_at: string | Date;
}

function toProfile(row: RawProfileRowWithGoogle): UserProfile {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    phone: row.phone ?? null,
    role: row.role,
    status: row.status || "active",
    adminNotes: row.admin_notes ?? null,
    emailVerifiedAt: row.email_verified_at ? new Date(row.email_verified_at) : null,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

/**
 * Finds a Dearr profile by its linked Google subject (sub).
 * Returns null if no profile is linked to this Google account.
 */
export async function findProfileByGoogleSubject(googleSubject: string): Promise<UserProfile | null> {
  const sql = `
    SELECT id, email, google_subject, full_name, phone, role, status, admin_notes, email_verified_at, created_at, updated_at
    FROM profiles
    WHERE google_subject = ?
    LIMIT 1
  `;
  const rows = await query<RawProfileRowWithGoogle[]>(sql, [googleSubject]);
  if (!rows || rows.length === 0) return null;
  return toProfile(rows[0]);
}

/**
 * Finds a Dearr profile by email — returns only safe fields (no password_hash).
 * Used to detect email conflicts between Google and existing email/password accounts.
 */
export async function findProfileEmailAndAuthType(
  email: string
): Promise<{ id: string; hasPassword: boolean; hasGoogleSubject: boolean } | null> {
  const sql = `
    SELECT id, password_hash, google_subject
    FROM profiles
    WHERE email = ?
    LIMIT 1
  `;
  const rows = await query<{ id: string; password_hash: string | null; google_subject: string | null }[]>(
    sql,
    [email.trim().toLowerCase()]
  );
  if (!rows || rows.length === 0) return null;
  const row = rows[0];
  return {
    id: row.id,
    hasPassword: !!row.password_hash,
    hasGoogleSubject: !!row.google_subject,
  };
}

/**
 * Creates a new Dearr customer profile for a Google-authenticated user.
 * Role is hardcoded to 'customer' — Google can never create admin accounts.
 * password_hash is NULL because this account has no Dearr password.
 */
export async function createGoogleProfile(identity: GoogleIdentityPayload): Promise<UserProfile> {
  const id = crypto.randomUUID();
  const normalizedEmail = identity.email.trim().toLowerCase();
  const fullName = (identity.name || identity.given_name || normalizedEmail.split("@")[0] || "Customer").trim();

  const sql = `
    INSERT INTO profiles (id, email, google_subject, password_hash, full_name, phone, role, email_verified_at)
    VALUES (?, ?, ?, NULL, ?, NULL, 'customer', NOW())
  `;
  await query(sql, [id, normalizedEmail, identity.sub, fullName]);

  const created = await findProfileByGoogleSubject(identity.sub);
  if (!created) {
    throw new Error("Google profile creation failed to persist in database");
  }
  return created;
}

/**
 * Links a Google subject to an existing Dearr profile that doesn't yet have one.
 * Only called for existing email/password accounts that the user chooses to link.
 * Returns the updated profile.
 */
export async function linkGoogleSubjectToProfile(
  profileId: string,
  googleSubject: string
): Promise<UserProfile | null> {
  const sql = `
    UPDATE profiles SET google_subject = ?, email_verified_at = COALESCE(email_verified_at, NOW())
    WHERE id = ? AND google_subject IS NULL
  `;
  await query(sql, [googleSubject, profileId]);
  return findProfileByGoogleSubject(googleSubject);
}
