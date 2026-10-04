import { NextResponse } from "next/server";
import {
  requireAdmin,
  handleAuthError,
  listCategories,
  createCategory,
  CategoryValidationError,
} from "@/lib/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/admin/categories
 * Administrator endpoint to list all categories (including inactive).
 * Enriched with product counts for admin management.
 *
 * Query Parameters:
 * - search: Keyword filter for name, slug, or description
 * - isActive: "true" | "false" to filter by status
 */
export async function GET(request: Request) {
  try {
    await requireAdmin();

    const { searchParams } = new URL(request.url);
    const searchParam = searchParams.get("search")?.trim();
    const activeParam = searchParams.get("isActive")?.toLowerCase().trim();

    const filters: {
      isActive?: boolean;
      search?: string;
      includeProductCounts: boolean;
    } = {
      includeProductCounts: true,
    };

    // Active status filter
    if (activeParam === "true" || activeParam === "1") {
      filters.isActive = true;
    } else if (activeParam === "false" || activeParam === "0") {
      filters.isActive = false;
    }
    // else: undefined → return all (active + inactive) for admin

    if (searchParam) {
      filters.search = searchParam;
    }

    const categories = await listCategories(filters);

    return NextResponse.json({
      ok: true,
      categories,
    });
  } catch (err: unknown) {
    return handleAuthError(err, "Failed to retrieve admin categories");
  }
}

/**
 * POST /api/admin/categories
 * Administrator endpoint to create a new category.
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

    const created = await createCategory({
      name: body.name,
      slug: body.slug,
      description: body.description,
      isActive: body.isActive !== undefined ? body.isActive : body.is_active,
    });

    return NextResponse.json(
      {
        ok: true,
        category: created,
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    if (err instanceof CategoryValidationError) {
      return NextResponse.json(
        { ok: false, error: err.message },
        { status: err.statusCode }
      );
    }
    return handleAuthError(err, "Failed to create category");
  }
}
