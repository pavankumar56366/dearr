import { NextResponse } from "next/server";
import { listCategories } from "@/lib/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/categories
 * Public endpoint returning active categories for storefront display.
 *
 * Returns only categories where is_active = 1.
 * Ordered alphabetically by name for deterministic results.
 */
export async function GET() {
  try {
    const categories = await listCategories({ isActive: true });

    return NextResponse.json({
      ok: true,
      categories: categories.map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        description: c.description,
        isActive: c.isActive,
      })),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("[GET /api/categories]", message);
    return NextResponse.json(
      { ok: false, error: "Failed to retrieve categories" },
      { status: 500 }
    );
  }
}
