import { NextResponse } from "next/server";
import {
  findProfileByEmail,
  createProfile,
  hashPassword,
  createSessionToken,
  setSessionCookie,
  attachSessionCookie,
  checkRateLimit,
  assertSafeOrigin,
  jsonPrivate,
  AuthError,
} from "@/lib/server";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  try {
    assertSafeOrigin(request);

    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { ok: false, error: "Invalid JSON request body" },
        { status: 400 }
      );
    }

    const clientIp =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "127.0.0.1";

    const isLocalLoopback = clientIp === "127.0.0.1" || clientIp === "::1" || clientIp === "localhost";
    const maxSignupsPerIp = isLocalLoopback ? 100 : 5;

    const signupRateKey = `signup:ip:${clientIp}`;
    const ipCheck = await checkRateLimit(signupRateKey, maxSignupsPerIp, 3600, false);
    if (!ipCheck.allowed) {
      return NextResponse.json(
        {
          ok: false,
          error: `Too many accounts registered from this network. Please try again in ${ipCheck.retryAfterSeconds} seconds.`,
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(ipCheck.retryAfterSeconds),
          },
        }
      );
    }

    const rawName = body.name ?? body.fullName;
    const rawEmail = body.email;
    const rawPassword = body.password;
    const rawPhone = body.phone;

    // Validate Name
    if (!rawName || typeof rawName !== "string") {
      return NextResponse.json(
        { ok: false, error: "Please enter your full name" },
        { status: 400 }
      );
    }
    const name = rawName.trim();
    if (name.length < 2) {
      return NextResponse.json(
        { ok: false, error: "Full name must be at least 2 characters" },
        { status: 400 }
      );
    }
    if (name.length > 150) {
      return NextResponse.json(
        { ok: false, error: "Full name cannot exceed 150 characters" },
        { status: 400 }
      );
    }

    // Validate Email
    if (!rawEmail || typeof rawEmail !== "string") {
      return NextResponse.json(
        { ok: false, error: "Please enter your email address" },
        { status: 400 }
      );
    }
    const email = rawEmail.trim().toLowerCase();
    if (!EMAIL_REGEX.test(email) || email.length > 255) {
      return NextResponse.json(
        { ok: false, error: "Please enter a valid email address" },
        { status: 400 }
      );
    }

    // Validate Password
    if (!rawPassword || typeof rawPassword !== "string") {
      return NextResponse.json(
        { ok: false, error: "Please enter a password" },
        { status: 400 }
      );
    }
    if (rawPassword.length < 8) {
      return NextResponse.json(
        { ok: false, error: "Password must be at least 8 characters long" },
        { status: 400 }
      );
    }
    if (rawPassword.length > 72) {
      return NextResponse.json(
        { ok: false, error: "Password cannot exceed 72 characters" },
        { status: 400 }
      );
    }

    // Validate Phone (optional)
    let phone: string | null = null;
    if (rawPhone && typeof rawPhone === "string") {
      const trimmedPhone = rawPhone.trim();
      if (trimmedPhone.length > 0) {
        if (trimmedPhone.length > 30) {
          return NextResponse.json(
            { ok: false, error: "Phone number cannot exceed 30 characters" },
            { status: 400 }
          );
        }
        phone = trimmedPhone;
      }
    }

    // Check if user already exists
    const existing = await findProfileByEmail(email);
    if (existing) {
      return NextResponse.json(
        { ok: false, error: "An account with this email address already exists" },
        { status: 409 }
      );
    }

    // Hash password securely with bcrypt
    const passwordHash = await hashPassword(rawPassword);

    // Create profile in Hostinger MySQL
    const newUser = await createProfile({
      email,
      fullName: name,
      passwordHash,
      phone,
      role: "customer",
    });

    // Record registration against IP to enforce registration throttle
    await checkRateLimit(signupRateKey, maxSignupsPerIp, 3600, true);

    // Create signed session token
    const token = await createSessionToken(newUser);
    await setSessionCookie(token);

    // Return sanitized customer data (never expose password_hash)
    const response = jsonPrivate(
      {
        ok: true,
        user: {
          id: newUser.id,
          email: newUser.email,
          fullName: newUser.fullName,
          phone: newUser.phone,
          role: newUser.role,
          createdAt: newUser.createdAt,
        },
      },
      { status: 201 }
    );

    attachSessionCookie(response, token);
    return response;
  } catch (err: unknown) {
    if (err instanceof AuthError) {
      return NextResponse.json(
        { ok: false, error: err.message },
        { status: err.statusCode }
      );
    }
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("[POST /api/auth/signup]", message);
    return NextResponse.json(
      { ok: false, error: "Registration failed. Please try again later." },
      { status: 500 }
    );
  }
}
