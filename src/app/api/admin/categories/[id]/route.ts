import { NextResponse } from "next/server";
import {
  requireAdmin,
  handleAuthError,
  findCategoryById,
  updateCategory,
  CategoryValidationError,
} from "@/lib/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/admin/categories/[id]
 * Administrator endpoint to retrieve a single category by ID (including inactive).
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();

    const { id } = await params;
    const cleanId = id?.trim();

    if (!cleanId) {
      return NextResponse.json(
        { ok: false, error: "Category ID is required" },
        { status: 400 }
      );
    }

    const category = await findCategoryById(cleanId, true);

    if (!category) {
      return NextResponse.json(
        { ok: false, error: "Category not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      category,
    });
  } catch (err: unknown) {
    return handleAuthError(err, "Failed to retrieve category");
  }
}

/**
 * PATCH /api/admin/categories/[id]
 * Administrator endpoint to update an existing category.
 * Supports updating: name, slug, description, isActive.
 * Does NOT allow changing: id, created_at, updated_at.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();

    const { id } = await params;
    const cleanId = id?.trim();

    if (!cleanId) {
      return NextResponse.json(
        { ok: false, error: "Category ID is required" },
        { status: 400 }
      );
    }

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

    const updated = await updateCategory(cleanId, {
      name: body.name,
      slug: body.slug,
      description: body.description !== undefined ? body.description : undefined,
      isActive: body.isActive !== undefined ? body.isActive : body.is_active,
    });

    if (!updated) {
      return NextResponse.json(
        { ok: false, error: "Category not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      category: updated,
    });
  } catch (err: unknown) {
    if (err instanceof CategoryValidationError) {
      return NextResponse.json(
        { ok: false, error: err.message },
        { status: err.statusCode }
      );
    }
    return handleAuthError(err, "Failed to update category");
  }
}
