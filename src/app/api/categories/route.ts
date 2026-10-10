import { NextResponse } from "next/server";
import { listCategories, getPopularCategories, recordCategoryView } from "@/lib/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/categories
 * Public endpoint returning active categories for storefront display.
 *
 * Query params:
 * - popular: "true" | "1" (returns top browsing popular active categories, max limit)
 * - limit: number (defaults to 3 for popular, max 10)
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const popularParam = searchParams.get("popular");

    if (popularParam === "true" || popularParam === "1") {
      const limit = Math.max(1, Math.min(Number(searchParams.get("limit") || 3), 10));
      const popular = await getPopularCategories(limit);
      return NextResponse.json({
        ok: true,
        categories: popular.map((c) => ({
          id: c.id,
          name: c.name,
          slug: c.slug,
          description: c.description,
          isActive: c.isActive,
          productCount: c.activeProductCount ?? c.productCount ?? 0,
          viewCount: c.viewCount ?? 0,
        })),
      });
    }

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

/**
 * POST /api/categories
 * Records category browsing activity with session deduplication.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const categoryId = body?.categoryId || body?.category_id || body?.id || body?.slug;
    const sessionHash = body?.sessionHash || body?.session_hash;

    if (!categoryId || typeof categoryId !== "string") {
      return NextResponse.json(
        { ok: false, error: "Valid categoryId is required" },
        { status: 400 }
      );
    }

    const recorded = await recordCategoryView(categoryId, sessionHash);
    return NextResponse.json({ ok: true, recorded });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("[POST /api/categories]", message);
    return NextResponse.json(
      { ok: false, error: "Failed to record category view" },
      { status: 500 }
    );
  }
}
