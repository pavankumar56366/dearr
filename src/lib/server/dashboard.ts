import "server-only";
import { query } from "./db";
import { formatMysqlDateTime } from "./discount";

export interface AdminDashboardMetrics {
  totalProducts: number;
  activeProducts: number;
  totalOrders: number;
  pendingOrders: number;
  deliveredOrders: number;
  activeDiscounts: number;
  grossRevenue: number;
  registeredCustomers: number;
}

/**
 * Retrieves aggregate store performance and catalog metrics directly from Hostinger MySQL.
 * Runs queries in parallel for optimal dashboard load latency.
 *
 * Metrics covered:
 * 1. Products: total catalog count and active products count
 * 2. Orders: total order count, pending fulfillment count, delivered count, and gross paid revenue
 * 3. Discounts: active promotional discount count respecting start/end validity dates
 * 4. Customers: registered customer profile count
 */
export async function getAdminDashboardMetrics(): Promise<AdminDashboardMetrics> {
  const now = new Date();
  const nowStr = formatMysqlDateTime(now);

  const [productRows, orderRows, discountRows, customerRows] = await Promise.all([
    query<any[]>(
      "SELECT COUNT(*) AS total, COALESCE(SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END), 0) AS active FROM products"
    ),
    query<any[]>(
      `SELECT 
         COUNT(*) AS total,
         COALESCE(SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END), 0) AS pending,
         COALESCE(SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END), 0) AS delivered,
         COALESCE(SUM(CASE WHEN payment_status = 'paid' THEN total_amount ELSE 0 END), 0) AS revenue
       FROM orders`
    ),
    query<any[]>(
      `SELECT COUNT(*) AS active_discounts 
       FROM discounts 
       WHERE is_active = 1 
         AND start_at <= ? 
         AND (end_at IS NULL OR end_at > ?)`,
      [nowStr, nowStr]
    ),
    query<any[]>(
      "SELECT COUNT(*) AS customers FROM profiles WHERE role = 'customer'"
    ),
  ]);

  const totalProducts = Number(productRows?.[0]?.total || 0);
  const activeProducts = Number(productRows?.[0]?.active || 0);

  const totalOrders = Number(orderRows?.[0]?.total || 0);
  const pendingOrders = Number(orderRows?.[0]?.pending || 0);
  const deliveredOrders = Number(orderRows?.[0]?.delivered || 0);
  const grossRevenue = Number(orderRows?.[0]?.revenue || 0);

  const activeDiscounts = Number(discountRows?.[0]?.active_discounts || 0);
  const registeredCustomers = Number(customerRows?.[0]?.customers || 0);

  return {
    totalProducts,
    activeProducts,
    totalOrders,
    pendingOrders,
    deliveredOrders,
    activeDiscounts,
    grossRevenue,
    registeredCustomers,
  };
}
