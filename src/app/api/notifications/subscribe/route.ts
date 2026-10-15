import { NextRequest, NextResponse } from "next/server";
import { requireUser, handleAuthError } from "@/lib/server/auth";
import {
  recordNotificationConsent,
  ConsentValidationError,
} from "@/lib/server/notification-consent";

export const dynamic = "force-dynamic";

/**
 * POST /api/notifications/subscribe
 *
 * Saves explicit opt-in notification consent (data only).
 * Body: {
 *   attemptId?: string,
 *   channel: 'email' | 'whatsapp' | 'sms',
 *   contactValue: string,
 *   consentText: string,
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    const body = await request.json();

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { ok: false, error: "Invalid JSON request body" },
        { status: 400 }
      );
    }

    const clientIp =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "127.0.0.1";
    const userAgent = request.headers.get("user-agent") || null;

    const consent = await recordNotificationConsent({
      userId: user.id,
      attemptId: body.attemptId || null,
      channel: body.channel,
      contactValue: body.contactValue,
      consentText: body.consentText,
      source: body.source || "checkout_abandonment",
      ipAddress: clientIp,
      userAgent,
    });

    return NextResponse.json(
      {
        ok: true,
        message: "Notification preference recorded successfully",
        consent: {
          id: consent.id,
          channel: consent.channel,
          createdAt: consent.createdAt,
        },
      },
      { status: 201 }
    );
  } catch (err: any) {
    if (err instanceof ConsentValidationError) {
      return NextResponse.json(
        { ok: false, error: err.message },
        { status: err.statusCode || 400 }
      );
    }
    return handleAuthError(err, "Failed to record notification consent");
  }
}
