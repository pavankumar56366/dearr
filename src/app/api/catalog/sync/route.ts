import { NextResponse } from "next/server";
import { ensureCatalogSeeded } from "@/lib/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/catalog/sync
 * Utility endpoint to trigger/verify product catalog synchronization.
 * Seeds all 86 products from SAMPLE_PRODUCTS into MySQL if missing.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const force = searchParams.get("force") === "true";
    const result = await ensureCatalogSeeded(force);
    return NextResponse.json({
      ok: true,
      message: result.seeded
        ? `Catalog synchronized: ${result.count} products populated into MySQL.`
        : `Catalog already up to date (${result.count} active products exist).`,
      ...result,
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err.message || "Catalog sync failed" },
      { status: 500 }
    );
  }
}
