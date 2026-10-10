import { NextResponse } from "next/server";
import { getStoreSettings } from "@/lib/server/settings";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/settings — Returns public store configuration parameters for customer checkout & storefront.
 * Safe for unauthenticated / customer access: returns only shipping thresholds, fees, and payment toggles.
 * Never leaks administrative emails, private credentials, or internal details.
 */
export async function GET() {
  try {
    const settings = await getStoreSettings();

    return NextResponse.json({
      ok: true,
      settings: {
        freeShippingThreshold: Number(settings.freeShippingThreshold ?? 999),
        defaultShippingFee: Number(settings.defaultShippingFee ?? 50),
        codEnabled: Boolean(settings.codEnabled),
        prepaidEnabled: Boolean(settings.prepaidEnabled),
      },
    });
  } catch (err: unknown) {
    console.error("[GET_STORE_SETTINGS_PUBLIC_FAILED]", err);
    return NextResponse.json({
      ok: true,
      settings: {
        freeShippingThreshold: 999,
        defaultShippingFee: 50,
        codEnabled: true,
        prepaidEnabled: true,
      },
    });
  }
}
