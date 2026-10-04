import { NextResponse } from "next/server";
import { listProducts, ProductListFilters } from "@/lib/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/products
 * Public catalog endpoint returning active products.
 *
 * Supported Query Parameters:
 * - category: Category slug or ID
 * - featured: "true" | "1"
 * - search: Keyword to search in product name or description
 * - sort: "price-asc" | "price-desc" | "featured" | "newest"
 * - page: Positive integer (default: 1)
 * - pageSize: Positive integer (default: 24, max: 100)
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const categoryParam = (searchParams.get("cat") || searchParams.get("category"))?.trim();
    const featuredParam = searchParams.get("featured");
    const searchParam = (searchParams.get("q") || searchParams.get("search"))?.trim();
    const sortParam = searchParams.get("sort")?.trim();
    const pageParam = parseInt(searchParams.get("page") || "1", 10);
    const pageSizeParam = parseInt(searchParams.get("pageSize") || "24", 10);

    const filters: ProductListFilters = {
      isActive: true, // Public catalog only ever exposes active products
      page: isNaN(pageParam) ? 1 : pageParam,
      pageSize: isNaN(pageSizeParam) ? 24 : pageSizeParam,
    };

    if (categoryParam) {
      // If categoryParam looks like UUID, filter by categoryId, else by categorySlug
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(categoryParam)) {
        filters.categoryId = categoryParam;
      } else {
        filters.categorySlug = categoryParam;
      }
    }

    if (featuredParam === "true" || featuredParam === "1") {
      filters.isFeatured = true;
    }

    if (searchParam) {
      filters.search = searchParam;
    }

    if (sortParam) {
      if (sortParam === "price-asc" || sortParam === "price-low") {
        filters.sort = "price-asc";
      } else if (sortParam === "price-desc" || sortParam === "price-high") {
        filters.sort = "price-desc";
      } else if (sortParam === "featured" || sortParam === "newest") {
        filters.sort = sortParam;
      }
    }

    const result = await listProducts(filters);

    return NextResponse.json({
      ok: true,
      products: result.products,
      pagination: result.pagination,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("[GET /api/products]", message);
    return NextResponse.json(
      { ok: false, error: "Failed to retrieve products" },
      { status: 500 }
    );
  }
}
