import { NextRequest, NextResponse } from "next/server";
import { requireUser, handleAuthError } from "@/lib/server/auth";
import {
  withdrawNotificationConsent,
  ConsentValidationError,
} from "@/lib/server/notification-consent";

export const dynamic = "force-dynamic";

/**
 * POST /api/notifications/unsubscribe
 *
 * Secure withdrawal mechanism for customer notification consent.
 * Body: {
 *   consentId?: string,
 *   channel?: 'email' | 'whatsapp' | 'sms',
 *   contactValue?: string,
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    let body: any = {};
    try {
      body = await request.json();
    } catch {}

    const result = await withdrawNotificationConsent({
      consentId: body.consentId,
      userId: user.id,
      channel: body.channel,
      contactValue: body.contactValue,
    });

    return NextResponse.json({
      ok: true,
      message: "Notification consent successfully withdrawn",
      withdrawnCount: result.withdrawnCount,
    });
  } catch (err: any) {
    if (err instanceof ConsentValidationError) {
      return NextResponse.json(
        { ok: false, error: err.message },
        { status: err.statusCode || 400 }
      );
    }
    return handleAuthError(err, "Failed to withdraw notification consent");
  }
}
