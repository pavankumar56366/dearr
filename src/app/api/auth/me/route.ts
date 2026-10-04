import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server";

export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { ok: false, user: null },
        { status: 200 }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          phone: user.phone,
          role: user.role,
          createdAt: user.createdAt,
        },
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("[GET /api/auth/me]", message);
    return NextResponse.json(
      { ok: false, user: null, error: "Failed to retrieve session" },
      { status: 500 }
    );
  }
}
