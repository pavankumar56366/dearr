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
  },
  expiresIn: string = "7d"
): Promise<string> {
  const secretKey = getAuthSecret();

  return new SignJWT({
    sub: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
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
