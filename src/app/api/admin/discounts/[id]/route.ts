import { NextResponse } from "next/server";
import {
  requireAdmin,
  handleAuthError,
  findDiscountById,
  updateDiscount,
  DiscountValidationError,
} from "@/lib/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/admin/discounts/[id]
 * Administrator endpoint to retrieve a single discount by ID.
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
        { ok: false, error: "Discount ID is required" },
        { status: 400 }
      );
    }

    const discount = await findDiscountById(cleanId);

    if (!discount) {
      return NextResponse.json(
        { ok: false, error: "Discount not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      discount,
    });
  } catch (err: unknown) {
    return handleAuthError(err, "Failed to retrieve discount");
  }
}

/**
 * PATCH /api/admin/discounts/[id]
 * Administrator endpoint to update an existing promotional discount.
 * Supports updating fields, soft deactivation (isActive: false), and target assignments.
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
        { ok: false, error: "Discount ID is required" },
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

    const discountType = body.discountType !== undefined ? body.discountType : body.discount_type;
    const scope = body.scope;
    const startAt =
      body.startAt !== undefined
        ? body.startAt
        : body.start_at !== undefined
        ? body.start_at
        : body.startsAt;
    const endAt =
      body.endAt !== undefined
        ? body.endAt
        : body.end_at !== undefined
        ? body.end_at
        : body.endsAt;
    const isActive =
      body.isActive !== undefined ? body.isActive : body.is_active;

    const updated = await updateDiscount(cleanId, {
      name: body.name,
      code: body.code,
      discountType,
      value: body.value !== undefined ? body.value : undefined,
      scope,
      startAt,
      endAt,
      isActive,
      categoryId: body.categoryId,
      categoryIds: body.categoryIds,
      productId: body.productId,
      productIds: body.productIds,
    });

    if (!updated) {
      return NextResponse.json(
        { ok: false, error: "Discount not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      discount: updated,
    });
  } catch (err: unknown) {
    if (err instanceof DiscountValidationError) {
      return NextResponse.json(
        { ok: false, error: err.message },
        { status: err.statusCode }
      );
    }
    return handleAuthError(err, "Failed to update discount");
  }
}
