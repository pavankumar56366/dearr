import { NextResponse } from "next/server";
import {
  findProfileWithPasswordByEmail,
  comparePassword,
  createSessionToken,
  setSessionCookie,
  attachSessionCookie,
  checkRateLimit,
  clearRateLimit,
  assertSafeOrigin,
  AuthError,
} from "@/lib/server";

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

    const email = body.email?.trim().toLowerCase();
    const password = body.password;

    if (!email) {
      return NextResponse.json(
        { ok: false, error: "Email is required" },
        { status: 400 }
      );
    }

    if (!password || typeof password !== "string") {
      return NextResponse.json(
        { ok: false, error: "Password is required" },
        { status: 400 }
      );
    }

    const clientIp =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "127.0.0.1";

    const isLocalLoopback = clientIp === "127.0.0.1" || clientIp === "::1" || clientIp === "localhost";
    const maxIpFailures = isLocalLoopback ? 200 : 15;

    const ipRateKey = `login:fail:ip:${clientIp}`;

    // 1. IP-level rate limit check (inspect without incrementing; only record on failure)
    const ipCheck = await checkRateLimit(ipRateKey, maxIpFailures, 900, false);
    if (!ipCheck.allowed) {
      return NextResponse.json(
        {
          ok: false,
          error: `Too many failed login attempts from this network. Please try again in ${ipCheck.retryAfterSeconds} seconds.`,
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(ipCheck.retryAfterSeconds),
          },
        }
      );
    }

    // Lookup user with password hash (restricted server-side operation)
    const userWithPassword = await findProfileWithPasswordByEmail(email);

    // 2. Account-level rate limit check (bounded to existing DB users by internal user ID)
    let accountRateKey: string | null = null;
    if (userWithPassword) {
      accountRateKey = `login:fail:account:${userWithPassword.id}`;
      const accountCheck = await checkRateLimit(accountRateKey, 5, 900, false);
      if (!accountCheck.allowed) {
        return NextResponse.json(
          {
            ok: false,
            error: `Too many failed login attempts for this account. Please try again in ${accountCheck.retryAfterSeconds} seconds.`,
          },
          {
            status: 429,
            headers: {
              "Retry-After": String(accountCheck.retryAfterSeconds),
            },
          }
        );
      }
    }

    // If user does not exist, increment only IP failure counter to prevent DB bloat from attacker-supplied emails
    if (!userWithPassword) {
      await checkRateLimit(ipRateKey, maxIpFailures, 900, true);
      return NextResponse.json(
        { ok: false, error: "Invalid email or password" },
        { status: 401 }
      );
    }

    // Compare passwords safely
    const isPasswordValid = await comparePassword(
      password,
      userWithPassword.passwordHash
    );

    if (!isPasswordValid) {
      // Record failed attempt against IP and verified account ID
      await checkRateLimit(ipRateKey, maxIpFailures, 900, true);
      if (accountRateKey) {
        await checkRateLimit(accountRateKey, 5, 900, true);
      }
      return NextResponse.json(
        { ok: false, error: "Invalid email or password" },
        { status: 401 }
      );
    }

    // Check customer account status (admins are never blocked)
    if (userWithPassword.role !== "admin" && userWithPassword.status === "suspended") {
      return NextResponse.json(
        { ok: false, error: "Your account has been suspended. Please contact support." },
        { status: 403 }
      );
    }

    // Successful login: clear failure counters for this IP and account
    const keysToClear = [ipRateKey];
    if (accountRateKey) {
      keysToClear.push(accountRateKey);
    }
    await clearRateLimit(keysToClear);

    // Create session token and set HTTP-only cookie
    const token = await createSessionToken(userWithPassword);
    await setSessionCookie(token);

    // Return sanitized profile
    const response = NextResponse.json(
      {
        ok: true,
        user: {
          id: userWithPassword.id,
          email: userWithPassword.email,
          fullName: userWithPassword.fullName,
          phone: userWithPassword.phone,
          role: userWithPassword.role,
          createdAt: userWithPassword.createdAt,
        },
      },
      { status: 200 }
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
    console.error("[POST /api/auth/login]", message);
    return NextResponse.json(
      { ok: false, error: "Login failed. Please try again later." },
      { status: 500 }
    );
  }
}
