import { NextResponse } from "next/server";
import {
  requireAdmin,
  handleAuthError,
  listProducts,
  createProduct,
  ProductValidationError,
  ProductListFilters,
} from "@/lib/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/admin/products
 * Administrator endpoint to list products (including inactive items).
 */
export async function GET(request: Request) {
  try {
    await requireAdmin();

    const { searchParams } = new URL(request.url);

    const categoryParam = searchParams.get("category")?.trim();
    const searchParam = searchParams.get("search")?.trim();
    const sortParam = searchParams.get("sort")?.trim() as any;
    const pageParam = parseInt(searchParams.get("page") || "1", 10);
    const pageSizeParam = parseInt(searchParams.get("pageSize") || "24", 10);
    const activeParam = searchParams.get("isActive")?.toLowerCase().trim();

    const filters: ProductListFilters = {
      page: isNaN(pageParam) ? 1 : pageParam,
      pageSize: isNaN(pageSizeParam) ? 24 : pageSizeParam,
    };

    // For admin, isActive can be filtered specifically or left undefined to return all
    if (activeParam === "true" || activeParam === "1") {
      filters.isActive = true;
    } else if (activeParam === "false" || activeParam === "0") {
      filters.isActive = false;
    } else {
      // By default, admin view shows all products (active and inactive)
      filters.isActive = undefined;
    }

    if (categoryParam) {
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(categoryParam)) {
        filters.categoryId = categoryParam;
      } else {
        filters.categorySlug = categoryParam;
      }
    }

    if (searchParam) {
      filters.search = searchParam;
    }

    if (["price-asc", "price-desc", "featured", "newest"].includes(sortParam)) {
      filters.sort = sortParam;
    }

    const result = await listProducts(filters);

    return NextResponse.json({
      ok: true,
      products: result.products,
      pagination: result.pagination,
    });
  } catch (err: unknown) {
    return handleAuthError(err, "Failed to retrieve admin products");
  }
}

/**
 * POST /api/admin/products
 * Administrator endpoint to create a new product.
 */
export async function POST(request: Request) {
  try {
    await requireAdmin();

    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { ok: false, error: "Invalid JSON request body" },
        { status: 400 }
      );
    }

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { ok: false, error: "Request body must be a valid JSON object" },
        { status: 400 }
      );
    }

    const created = await createProduct({
      id: body.id,
      categoryId: body.categoryId ?? body.category_id,
      name: body.name,
      slug: body.slug,
      description: body.description,
      price: body.price,
      compareAtPrice: body.compareAtPrice ?? body.compare_at_price,
      stockQuantity: body.stockQuantity ?? body.stock_quantity ?? 0,
      isFeatured: body.isFeatured ?? body.is_featured,
      isActive: body.isActive ?? body.is_active,
      images: body.images,
      variants: body.variants,
    });

    return NextResponse.json(
      {
        ok: true,
        product: created,
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    if (err instanceof ProductValidationError) {
      return NextResponse.json(
        { ok: false, error: err.message },
        { status: err.statusCode }
      );
    }
    return handleAuthError(err, "Failed to create product");
  }
}
