import { NextResponse } from "next/server";
import { getActiveDiscounts, getApplicableDiscountForProduct } from "@/lib/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/discounts/active
 * Public endpoint returning currently active valid discounts for storefront use.
 * Evaluates: is_active = 1 AND start_at <= NOW() AND (end_at IS NULL OR NOW() < end_at).
 *
 * Query Parameters:
 * - productId (optional): Resolves the single applicable discount for a product following
 *   Dearr V1 precedence (Product > Category > Store, NO STACKING).
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get("productId")?.trim();

    // If product context is provided, resolve the single applicable discount (no stacking)
    if (productId) {
      const applicable = await getApplicableDiscountForProduct(productId);
      if (!applicable) {
        return NextResponse.json({
          ok: true,
          applicable: null,
          message: "No applicable active discount found for this product",
        });
      }

      return NextResponse.json({
        ok: true,
        applicable: {
          discount: {
            id: applicable.discount.id,
            name: applicable.discount.name,
            code: applicable.discount.code,
            discountType: applicable.discount.discountType,
            value: applicable.discount.value,
            scope: applicable.discount.scope,
          },
          discountAmount: applicable.discountAmount,
          finalPrice: applicable.finalPrice,
          precedence: applicable.precedence,
        },
      });
    }

    // Default: Return list of all active discounts
    const discounts = await getActiveDiscounts();

    return NextResponse.json({
      ok: true,
      discounts: discounts.map((d) => ({
        id: d.id,
        name: d.name,
        code: d.code,
        discountType: d.discountType,
        value: d.value,
        scope: d.scope,
        startAt: d.startAt.toISOString(),
        endAt: d.endAt ? d.endAt.toISOString() : null,
        productIds: d.productIds || [],
        categoryIds: d.categoryIds || [],
      })),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("[GET /api/discounts/active]", message);
    return NextResponse.json(
      { ok: false, error: "Failed to retrieve active discounts" },
      { status: 500 }
    );
  }
}
