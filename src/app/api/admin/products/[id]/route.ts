import { NextResponse } from "next/server";
import {
  requireAdmin,
  handleAuthError,
  findProductById,
  updateProduct,
  deactivateProduct,
  ProductValidationError,
} from "@/lib/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/admin/products/[id]
 * Administrator endpoint to retrieve a single product by ID (including inactive).
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
        { ok: false, error: "Product ID is required" },
        { status: 400 }
      );
    }

    const product = await findProductById(cleanId, true);

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
    return handleAuthError(err, "Failed to retrieve product");
  }
}

/**
 * PATCH /api/admin/products/[id]
 * Administrator endpoint to update an existing product.
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
        { ok: false, error: "Product ID is required" },
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

    const updated = await updateProduct(cleanId, {
      categoryId: body.categoryId !== undefined ? body.categoryId : body.category_id,
      name: body.name,
      slug: body.slug,
      description: body.description,
      price: body.price,
      compareAtPrice: body.compareAtPrice !== undefined ? body.compareAtPrice : body.compare_at_price,
      stockQuantity: body.stockQuantity !== undefined ? body.stockQuantity : body.stock_quantity,
      isFeatured: body.isFeatured !== undefined ? body.isFeatured : body.is_featured,
      isActive: body.isActive !== undefined ? body.isActive : body.is_active,
      images: body.images,
      variants: body.variants,
    });

    if (!updated) {
      return NextResponse.json(
        { ok: false, error: "Product not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      product: updated,
    });
  } catch (err: unknown) {
    if (err instanceof ProductValidationError) {
      return NextResponse.json(
        { ok: false, error: err.message },
        { status: err.statusCode }
      );
    }
    return handleAuthError(err, "Failed to update product");
  }
}

/**
 * DELETE /api/admin/products/[id]
 * Administrator endpoint to soft-deactivate a product (is_active = false).
 * Preserves historical orders and relational references.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();

    const { id } = await params;
    const cleanId = id?.trim();

    if (!cleanId) {
      return NextResponse.json(
        { ok: false, error: "Product ID is required" },
        { status: 400 }
      );
    }

    const success = await deactivateProduct(cleanId);

    if (!success) {
      return NextResponse.json(
        { ok: false, error: "Product not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Product deactivated successfully",
    });
  } catch (err: unknown) {
    return handleAuthError(err, "Failed to deactivate product");
  }
}
