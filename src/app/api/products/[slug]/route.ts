import { NextResponse } from "next/server";
import { findProductBySlug } from "@/lib/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/products/[slug]
 * Public endpoint returning a single active product by its URL slug.
 * Inactive or non-existent products strictly return 404 Not Found.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const cleanSlug = slug?.trim().toLowerCase();

    if (!cleanSlug) {
      return NextResponse.json(
        { ok: false, error: "Product slug is required" },
        { status: 400 }
      );
    }

    // Public detail view only retrieves active products
    const product = await findProductBySlug(cleanSlug, false);

    if (!product) {
      return NextResponse.json(
        { ok: false, error: "Product not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      product,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("[GET /api/products/[slug]]", message);
    return NextResponse.json(
      { ok: false, error: "Failed to retrieve product details" },
      { status: 500 }
    );
  }
}
