import { NextResponse } from "next/server";
import {
  findProfileWithPasswordByEmail,
  comparePassword,
  createSessionToken,
  setSessionCookie,
  attachSessionCookie,
} from "@/lib/server";

export async function POST(request: Request) {
  try {
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

    // Lookup user with password hash (restricted server-side operation)
    const userWithPassword = await findProfileWithPasswordByEmail(email);
    if (!userWithPassword) {
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
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("[POST /api/auth/login]", message);
    return NextResponse.json(
      { ok: false, error: "Login failed. Please try again later." },
      { status: 500 }
    );
  }
}
