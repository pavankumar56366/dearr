import "server-only";
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { findProfileById, type UserProfile } from "./profile";

export const SESSION_COOKIE_NAME = "dearr_session";
export const SESSION_EXPIRY_SECONDS = 7 * 24 * 60 * 60; // 7 days

export interface SessionPayload {
  sub: string;
  email: string;
  fullName: string;
  role: "customer" | "admin";
  tokenVersion?: number;
  iat?: number;
  exp?: number;
}

export class AuthError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 401) {
    super(message);
    this.name = "AuthError";
    this.statusCode = statusCode;
  }
}

/**
 * Retrieves the cryptographic secret used to sign and verify session JWTs.
 * Only reads from server environment variables (AUTH_SECRET or SESSION_SECRET).
 * Fails safely if the secret is not configured or too weak.
 */
function getAuthSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET?.trim() || process.env.SESSION_SECRET?.trim();

  if (!secret) {
    throw new Error(
      "Authentication configuration error: AUTH_SECRET (or SESSION_SECRET) must be set in server environment variables."
    );
  }

  if (secret.length < 32) {
    throw new Error(
      "Authentication configuration error: AUTH_SECRET must be at least 32 characters long for secure HS256 signing."
    );
  }

  return new TextEncoder().encode(secret);
}

/**
 * Hashes a plaintext password using bcrypt with 10 salt rounds.
 */
export async function hashPassword(password: string): Promise<string> {
  if (!password || typeof password !== "string") {
    throw new Error("Password must be a valid, non-empty string");
  }
  return bcrypt.hash(password, 10);
}

/**
 * Safely compares a plaintext password against a bcrypt hash.
 */
export async function comparePassword(password: string, hash: string): Promise<boolean> {
  if (!password || !hash) return false;
  return bcrypt.compare(password, hash);
}

/**
 * Creates a signed JWT session token using jose (HS256).
 */
export async function createSessionToken(
  user: {
    id: string;
    email: string;
    fullName: string;
    role: "customer" | "admin";
    tokenVersion?: number;
  },
  expiresIn: string = "7d"
): Promise<string> {
  const secretKey = getAuthSecret();

  return new SignJWT({
    sub: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    tokenVersion: user.tokenVersion ?? 1,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(secretKey);
}

/**
 * Verifies a signed session JWT token.
 * Returns the decoded payload or null if invalid or expired.
 */
export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  if (!token || typeof token !== "string") return null;

  try {
    const secretKey = getAuthSecret();
    const { payload } = await jwtVerify(token, secretKey, {
      algorithms: ["HS256"],
    });

    return {
      sub: payload.sub as string,
      email: payload.email as string,
      fullName: payload.fullName as string,
      role: payload.role as "customer" | "admin",
      tokenVersion: typeof payload.tokenVersion === "number" ? payload.tokenVersion : undefined,
      iat: payload.iat,
      exp: payload.exp,
    };
  } catch {
    // Return null on expired or tampered token without leaking error stack
    return null;
  }
}

/**
 * Returns the standard cookie options for the Dearr session cookie.
 */
export function getSessionCookieOptions() {
  return {
    name: SESSION_COOKIE_NAME,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_EXPIRY_SECONDS,
  };
}

/**
 * Attaches the secure HTTP-only dearr_session cookie to a NextResponse.
 */
export function attachSessionCookie(response: NextResponse, token: string): NextResponse {
  response.cookies.set(SESSION_COOKIE_NAME, token, getSessionCookieOptions());
  return response;
}

/**
 * Attaches an expired dearr_session cookie to a NextResponse to log out the user.
 */
export function attachClearSessionCookie(response: NextResponse): NextResponse {
  response.cookies.set(SESSION_COOKIE_NAME, "", {
    ...getSessionCookieOptions(),
    maxAge: 0,
    expires: new Date(0),
  });
  return response;
}

/**
 * Sets the secure HTTP-only dearr_session cookie on the current request context.
 * Gracefully handles standalone test runners where Next request scope is absent.
 */
export async function setSessionCookie(token: string): Promise<void> {
  try {
    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE_NAME, token, getSessionCookieOptions());
  } catch (err: any) {
    if (err?.message?.includes("request scope")) {
      return;
    }
    throw err;
  }
}

/**
 * Clears the dearr_session cookie from the client.
 */
export async function clearSession(): Promise<void> {
  try {
    const cookieStore = await cookies();
    cookieStore.delete(SESSION_COOKIE_NAME);
  } catch (err: any) {
    if (err?.message?.includes("request scope")) {
      return;
    }
    throw err;
  }
}

/**
 * Creates a signed session token for a user and sets the dearr_session cookie.
 * Returns the generated token string.
 */
export async function createSession(user: {
  id: string;
  email: string;
  fullName: string;
  role: "customer" | "admin";
}): Promise<string> {
  const token = await createSessionToken(user);
  await setSessionCookie(token);
  return token;
}

/**
 * Retrieves and validates the current session token from the dearr_session cookie.
 * Returns the SessionPayload or null if no valid session exists.
 */
export async function getSession(): Promise<SessionPayload | null> {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);

    if (!sessionCookie || !sessionCookie.value) {
      return null;
    }

    return await verifySessionToken(sessionCookie.value);
  } catch {
    return null;
  }
}

/**
 * Retrieves the full sanitized UserProfile of the currently authenticated user.
 * Returns null if unauthenticated or if the profile no longer exists in MySQL.
 */
export async function getCurrentUser(): Promise<UserProfile | null> {
  const session = await getSession();
  if (!session || !session.sub) {
    return null;
  }

  const profile = await findProfileById(session.sub);
  if (!profile) {
    return null;
  }

  // Token version verification: session tokenVersion must match the database tokenVersion
  const currentTokenVersion = profile.tokenVersion ?? 1;
  const tokenVersionInSession = session.tokenVersion ?? 1;
  if (tokenVersionInSession !== currentTokenVersion) {
    return null;
  }

  // Suspended customers are blocked from normal customer session access (admins never blocked)
  if (profile.role !== "admin" && profile.status === "suspended") {
    return null;
  }

  return profile;
}

/**
 * Asserts that a user is currently authenticated.
 * Throws AuthError(401) if not logged in, or AuthError(403) if customer account is suspended.
 */
export async function requireUser(): Promise<UserProfile> {
  const session = await getSession();
  if (!session || !session.sub) {
    throw new AuthError("Authentication required to access this resource", 401);
  }

  const user = await findProfileById(session.sub);
  if (!user) {
    throw new AuthError("Authentication required to access this resource", 401);
  }

  // Token version verification: session tokenVersion must match current database tokenVersion
  const currentTokenVersion = user.tokenVersion ?? 1;
  const tokenVersionInSession = session.tokenVersion ?? 1;
  if (tokenVersionInSession !== currentTokenVersion) {
    throw new AuthError("Session has expired or been revoked. Please sign in again.", 401);
  }

  if (user.role !== "admin" && user.status === "suspended") {
    throw new AuthError("Your account has been suspended. Please contact support.", 403);
  }

  return user;
}

/**
 * Asserts that the currently authenticated user is an administrator.
 * Throws AuthError(401) if not logged in, or AuthError(403) if role is not 'admin'.
 */
export async function requireAdmin(): Promise<UserProfile> {
  const user = await requireUser();
  if (user.role !== "admin") {
    throw new AuthError("Forbidden: Administrator privileges required", 403);
  }
  return user;
}

/**
 * Asserts that the authenticated user either owns the resource (matches resourceUserId)
 * or is an administrator.
 * Throws AuthError(403) if authorization check fails.
 */
export function assertOwnerOrAdmin(
  authenticatedUser: UserProfile,
  resourceUserId: string
): void {
  if (authenticatedUser.role === "admin") {
    return;
  }
  if (!resourceUserId || authenticatedUser.id !== resourceUserId) {
    throw new AuthError("Forbidden: You do not have permission to access or modify this resource", 403);
  }
}

/**
 * Utility to convert caught errors (like AuthError) into an appropriate NextResponse.
 * Guaranteed never to leak SQL errors or database credentials.
 */
export function handleAuthError(
  err: unknown,
  fallbackMessage = "Internal server error"
): NextResponse {
  if (err instanceof AuthError) {
    return NextResponse.json(
      { ok: false, error: err.message },
      { status: err.statusCode }
    );
  }
  const message = err instanceof Error ? err.message : fallbackMessage;
  console.error("[Authorization Error]", message);
  return NextResponse.json(
    { ok: false, error: fallbackMessage },
    { status: 500 }
  );
}

/**
 * Asserts that a state-changing mutation originates from a trusted origin.
 * Prevents Cross-Site Request Forgery (CSRF) for cookie-authenticated requests.
 * Validates Origin and Referer against configured application origin and local test origin.
 * Strictly blocks hostile origins, 'null' origins, and malformed origin headers.
 */
export function assertSafeOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");

  // Determine trusted origins and hosts from environment configuration
  const envAppUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL;
  const trustedOrigins = new Set<string>([
    "https://dearr.in",
    "https://www.dearr.in",
  ]);
  const allowedHosts = new Set<string>([
    "dearr.in",
    "www.dearr.in",
  ]);

  if (envAppUrl) {
    try {
      const u = new URL(envAppUrl);
      trustedOrigins.add(u.origin.toLowerCase());
      allowedHosts.add(u.host.toLowerCase());
    } catch {
      // Ignore invalid URL in env
    }
  }

  // In non-production environments (test/development), allow localhost and 127.0.0.1
  if (process.env.NODE_ENV !== "production") {
    trustedOrigins.add("http://localhost:3000");
    trustedOrigins.add("http://127.0.0.1:3000");
    trustedOrigins.add("http://localhost");
    trustedOrigins.add("http://127.0.0.1");
    allowedHosts.add("localhost:3000");
    allowedHosts.add("127.0.0.1:3000");
    allowedHosts.add("localhost");
    allowedHosts.add("127.0.0.1");
  }

  // Validate Host header if present
  if (host) {
    const cleanHost = host.trim().toLowerCase();
    if (!allowedHosts.has(cleanHost)) {
      throw new AuthError("Cross-origin request blocked: untrusted host header", 403);
    }
  }

  if (origin !== null && origin !== undefined) {
    const trimmedOrigin = origin.trim();
    if (trimmedOrigin.toLowerCase() === "null") {
      throw new AuthError("Cross-origin request blocked: null origin", 403);
    }

    let originUrl: URL;
    try {
      originUrl = new URL(trimmedOrigin);
    } catch {
      throw new AuthError("Invalid origin header", 403);
    }

    if (originUrl.protocol !== "http:" && originUrl.protocol !== "https:") {
      throw new AuthError("Invalid origin protocol", 403);
    }

    const normOrigin = originUrl.origin.toLowerCase();
    const isDirectlyTrusted = trustedOrigins.has(normOrigin);
    const matchesHost = host && originUrl.host.toLowerCase() === host.toLowerCase() && allowedHosts.has(host.toLowerCase());

    if (!isDirectlyTrusted && !matchesHost) {
      throw new AuthError("Cross-origin request blocked", 403);
    }
    return;
  }

  // Fallback to Referer header if Origin is omitted
  const referer = request.headers.get("referer");
  if (referer) {
    let refererUrl: URL;
    try {
      refererUrl = new URL(referer);
    } catch {
      throw new AuthError("Invalid referer header", 403);
    }

    const normRefererOrigin = refererUrl.origin.toLowerCase();
    const isDirectlyTrusted = trustedOrigins.has(normRefererOrigin);
    const matchesHost = host && refererUrl.host.toLowerCase() === host.toLowerCase() && allowedHosts.has(host.toLowerCase());

    if (!isDirectlyTrusted && !matchesHost) {
      throw new AuthError("Cross-origin request blocked", 403);
    }
    return;
  }
}
