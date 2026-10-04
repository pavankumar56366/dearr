import { NextResponse } from "next/server";
import {
  requireAdmin,
  handleAuthError,
  getAdminDashboardMetrics,
} from "@/lib/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/metrics
 *
 * Administrator endpoint to fetch live store summary metrics:
 * - Products count (total & active)
 * - Orders count (total, pending, delivered)
 * - Active Discounts count
 * - Gross Revenue (paid orders total)
 * - Registered Customers count
 *
 * Enforces server-side requireAdmin() authorization.
 */
export async function GET() {
  try {
    await requireAdmin();
    const metrics = await getAdminDashboardMetrics();
    return NextResponse.json({ ok: true, metrics });
  } catch (err) {
    return handleAuthError(err, "Failed to retrieve dashboard metrics");
  }
}
