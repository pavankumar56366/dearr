import { NextResponse } from "next/server";
import {
  requireAdmin,
  handleAuthError,
  listDiscounts,
  createDiscount,
  DiscountValidationError,
  DiscountScope,
  DiscountType,
  DiscountDerivedStatus,
} from "@/lib/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/admin/discounts
 * Administrator endpoint to list all promotional discounts.
 * Enriched with assigned productIds, categoryIds, and computed status.
 *
 * Query Parameters:
 * - search: Keyword filter for name or code
 * - status: "active" | "scheduled" | "expired" | "deactivated" | "draft" | "all"
 * - scope: "store" | "category" | "product" | "all"
 * - type: "percentage" | "fixed_amount" | "all"
 */
export async function GET(request: Request) {
  try {
    await requireAdmin();

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim() || undefined;
    const statusParam = searchParams.get("status")?.trim().toLowerCase();
    const scopeParam = searchParams.get("scope")?.trim().toLowerCase();
    const typeParam = searchParams.get("type")?.trim().toLowerCase();

    const filters: {
      search?: string;
      status?: DiscountDerivedStatus | "all";
      scope?: DiscountScope;
      discountType?: DiscountType;
    } = {};

    if (search) {
      filters.search = search;
    }

    if (
      statusParam === "active" ||
      statusParam === "scheduled" ||
      statusParam === "expired" ||
      statusParam === "deactivated" ||
      statusParam === "draft"
    ) {
      filters.status = statusParam;
    }

    if (
      scopeParam === "store" ||
      scopeParam === "category" ||
      scopeParam === "product"
    ) {
      filters.scope = scopeParam;
    }

    if (typeParam === "percentage" || typeParam === "fixed_amount") {
      filters.discountType = typeParam;
    }

    const discounts = await listDiscounts(filters);

    return NextResponse.json({
      ok: true,
      discounts,
    });
  } catch (err: unknown) {
    return handleAuthError(err, "Failed to retrieve discounts");
  }
}

/**
 * POST /api/admin/discounts
 * Administrator endpoint to create a new promotional discount.
 * Enforces validation, scope constraints, code uniqueness, and overlap conflict prevention.
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

    const discountType = body.discountType || body.discount_type;
    const scope = body.scope;
    const startAt = body.startAt || body.start_at || body.startsAt;
    const endAt =
      body.endAt !== undefined
        ? body.endAt
        : body.end_at !== undefined
        ? body.end_at
        : body.endsAt;
    const isActive =
      body.isActive !== undefined ? body.isActive : body.is_active;

    const created = await createDiscount({
      name: body.name,
      code: body.code,
      discountType,
      value: body.value,
      scope,
      startAt,
      endAt,
      isActive,
      categoryId: body.categoryId,
      categoryIds: body.categoryIds,
      productId: body.productId,
      productIds: body.productIds,
    });

    return NextResponse.json(
      {
        ok: true,
        discount: created,
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    if (err instanceof DiscountValidationError) {
      return NextResponse.json(
        { ok: false, error: err.message },
        { status: err.statusCode }
      );
    }
    return handleAuthError(err, "Failed to create discount");
  }
}
