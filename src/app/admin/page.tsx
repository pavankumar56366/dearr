import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { getProductPrimaryImage, isUploadPath } from "@/lib/product-image";
import {
  listAllOrders,
  listProducts,
  getAdminDashboardMetrics,
  getSession,
  type OrderSummary,
  type OrderStatus,
  type Product,
  type AdminDashboardMetrics,
} from "@/lib/server";
import {
  PackageIcon,
  ShoppingCartIcon,
  UsersIcon,
  TrendingUpIcon,
  ExternalLinkIcon,
  PlusIcon,
  TagIcon,
  ChevronRightIcon,
  AlertCircleIcon,
  RefreshCwIcon,
} from "@/components/admin/AdminIcons";
import { AdminAccessDenied } from "@/components/admin/AdminAccessDenied";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Dashboard — Dearr Founder Admin",
  description: "Operations dashboard for Dearr 3D printing store management, live metrics, recent orders, and catalog status.",
  robots: {
    index: false,
    follow: false,
  },
};

interface MetricCardProps {
  label: string;
  value: string;
  subtext: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}

function MetricCard({ label, value, subtext, icon: Icon }: MetricCardProps) {
  return (
    <div className="p-4 sm:p-5 rounded-2xl bg-surface border border-neutral-200/80 shadow-xs flex flex-col justify-between gap-3">
      <div className="flex items-center justify-between">
        <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-neutral-500">
          {label}
        </span>
        <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-primary/15 text-neutral-900 flex items-center justify-center shrink-0">
          <Icon size={18} />
        </div>
      </div>

      <div>
        <div className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-neutral-900 tracking-tight">
          {value}
        </div>
        <p className="text-[11px] sm:text-xs text-neutral-500 mt-1 font-medium truncate">
          {subtext}
        </p>
      </div>

      <div className="pt-2 border-t border-neutral-100 flex items-center justify-between text-[11px]">
        <span className="text-neutral-400 font-mono text-[10px]">MySQL Live</span>
        <span className="text-success font-bold text-[10px]">● Active</span>
      </div>
    </div>
  );
}

function renderOrderStatusBadge(status: OrderStatus) {
  switch (status) {
    case "pending":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-900 border border-amber-200">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
          <span>Pending</span>
        </span>
      );
    case "confirmed":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-900 border border-blue-200">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
          <span>Confirmed</span>
        </span>
      );
    case "processing":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-50 text-purple-900 border border-purple-200">
          <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
          <span>Processing</span>
        </span>
      );
    case "shipped":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-900 border border-indigo-200">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
          <span>Shipped</span>
        </span>
      );
    case "delivered":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-900 border border-emerald-200">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
          <span>Delivered</span>
        </span>
      );
    case "cancelled":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-900 border border-rose-200">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
          <span>Cancelled</span>
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-neutral-100 text-neutral-700">
          {status}
        </span>
      );
  }
}

export default async function AdminDashboardPage() {
  // Server-authoritative data fetching with admin session verification
  const session = await getSession();
  const isAdmin = session?.role === "admin";

  if (session && session.role === "customer") {
    return <AdminAccessDenied user={session} />;
  }

  let metrics: AdminDashboardMetrics = {
    totalProducts: 0,
    activeProducts: 0,
    totalOrders: 0,
    pendingOrders: 0,
    deliveredOrders: 0,
    activeDiscounts: 0,
    grossRevenue: 0,
    registeredCustomers: 0,
  };
  let recentOrders: OrderSummary[] = [];
  let recentProducts: Product[] = [];
  let queryError: string | null = null;

  if (isAdmin) {
    try {
      const [metricsRes, ordersRes, productsRes] = await Promise.all([
        getAdminDashboardMetrics(),
        listAllOrders({ limit: 5 }),
        listProducts({ pageSize: 5, sort: "newest" }),
      ]);
      metrics = metricsRes;
      recentOrders = ordersRes?.orders || [];
      recentProducts = productsRes?.products || [];
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load live data";
      console.error("[Admin Dashboard Query Error]", msg);
      queryError = "Unable to connect to live operations database right now. Please refresh.";
    }
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* ====================================================================
          1. PAGE HEADER
          ==================================================================== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-neutral-200/60">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-primary/20 text-neutral-900 border border-primary/40">
              Founder Admin
            </span>
            {queryError ? (
              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-50 text-amber-900 border border-amber-200 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-600" />
                <span>Operations Degraded</span>
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-900 border border-emerald-200 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                <span>Operations Live</span>
              </span>
            )}
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-neutral-900">
            Dashboard
          </h1>
          <p className="text-xs sm:text-sm text-neutral-500 mt-0.5">
            Store operations overview, live business metrics, 3D printing orders, and catalog management.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-neutral-300 hover:border-neutral-400 text-xs font-semibold text-neutral-800 bg-surface hover:bg-neutral-50 transition-all shadow-xs"
          >
            <span>Live Storefront</span>
            <ExternalLinkIcon size={14} className="text-neutral-500" />
          </Link>
          <Link
            href="/admin/products/new"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary hover:bg-[#91BC7A] text-xs font-bold text-neutral-900 transition-all shadow-xs"
          >
            <PlusIcon size={14} />
            <span>Add Product</span>
          </Link>
        </div>
      </div>

      {/* Query Error Notice Banner */}
      {queryError && (
        <div
          role="alert"
          id="admin-dashboard-query-error"
          className="p-4 sm:p-5 rounded-2xl bg-amber-50/90 border border-amber-200 text-amber-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-xs"
        >
          <div className="flex items-start gap-3">
            <AlertCircleIcon size={20} className="text-amber-700 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <div className="font-bold text-amber-900">
                Live Data Synchronization Notice
              </div>
              <p className="text-amber-800 text-[11px] leading-relaxed">
                {queryError}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
            <Link
              href="/api/health/db"
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 rounded-lg border border-amber-300 hover:border-amber-400 bg-amber-100/60 hover:bg-amber-100 text-amber-900 font-semibold text-[11px] transition-colors"
            >
              System Health
            </Link>
            <Link
              href="/admin"
              id="admin-dashboard-retry-link"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-700 hover:bg-amber-800 text-white font-bold text-[11px] transition-colors shadow-xs"
            >
              <RefreshCwIcon size={13} />
              <span>Retry Connection</span>
            </Link>
          </div>
        </div>
      )}

      {/* ====================================================================
          2. SUMMARY METRICS (Task A-03: Real Hostinger MySQL Live Counts)
          ==================================================================== */}
      <section
        aria-label="Store Summary Metrics"
        className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4"
      >
        {/* Metric 1: Catalog Products (Step 4) */}
        <MetricCard
          label="Catalog Products"
          value={metrics.totalProducts.toString()}
          subtext={`${metrics.activeProducts} active in store`}
          icon={PackageIcon}
        />

        {/* Metric 2: Total Orders (Step 5) */}
        <MetricCard
          label="Total Orders"
          value={metrics.totalOrders.toString()}
          subtext={
            metrics.totalOrders === 0
              ? "0 pending • 0 delivered"
              : `${metrics.pendingOrders} pending • ${metrics.deliveredOrders} delivered`
          }
          icon={ShoppingCartIcon}
        />

        {/* Metric 3: Active Discounts (Step 6) */}
        <MetricCard
          label="Active Discounts"
          value={metrics.activeDiscounts.toString()}
          subtext="Live promotional offers"
          icon={TagIcon}
        />

        {/* Metric 4: Gross Revenue (Step 7) */}
        <MetricCard
          label="Gross Revenue"
          value={`₹${metrics.grossRevenue.toLocaleString("en-IN")}`}
          subtext="Paid order volume"
          icon={TrendingUpIcon}
        />

        {/* Metric 5: Registered Customers (Step 7) */}
        <MetricCard
          label="Registered Customers"
          value={metrics.registeredCustomers.toString()}
          subtext="Registered accounts"
          icon={UsersIcon}
        />
      </section>

      {/* ====================================================================
          3. QUICK ACTIONS (Step 8 / A-04 Preserved)
          ==================================================================== */}
      <section aria-label="Admin Quick Actions" className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold text-neutral-900 uppercase tracking-wider">
            Quick Actions
          </h2>
          <span className="text-[11px] text-neutral-400 font-medium">
            Core management shortcuts
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          {/* Action 1: Add Product */}
          <Link
            href="/admin/products/new"
            id="admin-quick-add-product"
            className="group p-4 sm:p-5 rounded-2xl bg-surface border border-neutral-200/80 hover:border-primary/60 hover:shadow-xs transition-all flex items-start justify-between gap-3 text-left"
          >
            <div className="space-y-1.5 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-primary/15 text-neutral-900 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
                <PackageIcon size={20} />
              </div>
              <div className="font-bold text-sm text-neutral-900 group-hover:text-primary transition-colors">
                Add New Product
              </div>
              <p className="text-xs text-neutral-500 leading-relaxed line-clamp-2">
                Create new 3D model listing with images, specs, and variants.
              </p>
            </div>
            <div className="w-7 h-7 rounded-full bg-neutral-100 group-hover:bg-primary/20 text-neutral-600 group-hover:text-neutral-900 flex items-center justify-center shrink-0 mt-1 transition-colors">
              <ChevronRightIcon size={16} />
            </div>
          </Link>

          {/* Action 2: View Orders */}
          <Link
            href="/admin/orders"
            id="admin-quick-view-orders"
            className="group p-4 sm:p-5 rounded-2xl bg-surface border border-neutral-200/80 hover:border-blue-400 hover:shadow-xs transition-all flex items-start justify-between gap-3 text-left"
          >
            <div className="space-y-1.5 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-800 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
                <ShoppingCartIcon size={20} />
              </div>
              <div className="font-bold text-sm text-neutral-900 group-hover:text-blue-700 transition-colors">
                Manage Orders
              </div>
              <p className="text-xs text-neutral-500 leading-relaxed line-clamp-2">
                Track print status, shipping progress, and order fulfillment.
              </p>
            </div>
            <div className="w-7 h-7 rounded-full bg-neutral-100 group-hover:bg-blue-100 text-neutral-600 group-hover:text-blue-900 flex items-center justify-center shrink-0 mt-1 transition-colors">
              <ChevronRightIcon size={16} />
            </div>
          </Link>

          {/* Action 3: Create Discount */}
          <Link
            href="/admin/discounts/new"
            id="admin-quick-create-discount"
            className="group p-4 sm:p-5 rounded-2xl bg-surface border border-neutral-200/80 hover:border-amber-400 hover:shadow-xs transition-all flex items-start justify-between gap-3 text-left"
          >
            <div className="space-y-1.5 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-900 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
                <TagIcon size={20} />
              </div>
              <div className="font-bold text-sm text-neutral-900 group-hover:text-amber-800 transition-colors">
                Create Discount
              </div>
              <p className="text-xs text-neutral-500 leading-relaxed line-clamp-2">
                Configure promotional promo codes, flash sales, and active dates.
              </p>
            </div>
            <div className="w-7 h-7 rounded-full bg-neutral-100 group-hover:bg-amber-100 text-neutral-600 group-hover:text-amber-900 flex items-center justify-center shrink-0 mt-1 transition-colors">
              <ChevronRightIcon size={16} />
            </div>
          </Link>
        </div>
      </section>

      {/* ====================================================================
          4. RECENT ORDERS & RECENT PRODUCTS (Step 8 / A-04 Preserved)
          ==================================================================== */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 pt-2">
        {/* ==================================================================
            4A. RECENT ORDERS PANEL (Step 8 / A-04 Preserved)
            ================================================================== */}
        <section
          aria-label="Recent Orders"
          className="p-5 rounded-2xl bg-surface border border-neutral-200/80 shadow-xs flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
              <div>
                <h2 className="text-sm font-bold text-neutral-900">
                  Recent Orders
                </h2>
                <p className="text-xs text-neutral-500 mt-0.5">
                  Latest customer orders from MySQL database
                </p>
              </div>
              <Link
                href="/admin/orders"
                className="text-xs font-semibold text-neutral-600 hover:text-neutral-900 inline-flex items-center gap-1 transition-colors"
              >
                <span>View All Orders</span>
                <ChevronRightIcon size={14} />
              </Link>
            </div>

            {queryError ? (
              <div className="py-12 px-4 text-center space-y-2">
                <div className="w-11 h-11 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
                  <AlertCircleIcon size={20} />
                </div>
                <div className="text-xs font-bold text-neutral-800">
                  Order data temporarily unavailable
                </div>
                <p className="text-[11px] text-neutral-500 max-w-xs mx-auto">
                  Unable to synchronize live orders from the database. Please use the retry connection button above.
                </p>
              </div>
            ) : recentOrders.length === 0 ? (
              <div className="py-12 px-4 text-center space-y-2">
                <div className="w-11 h-11 rounded-full bg-neutral-100 text-neutral-400 flex items-center justify-center mx-auto">
                  <ShoppingCartIcon size={20} />
                </div>
                <div className="text-xs font-bold text-neutral-800">
                  No orders recorded yet
                </div>
                <p className="text-[11px] text-neutral-400 max-w-xs mx-auto">
                  When customers purchase 3D prints on the storefront, orders will appear here automatically.
                </p>
                <div className="pt-2">
                  <Link
                    href="/admin/products"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-300 hover:border-neutral-400 text-neutral-800 bg-surface text-xs font-semibold shadow-xs transition-colors"
                  >
                    <PackageIcon size={14} className="text-neutral-500" />
                    <span>View Catalog Products</span>
                  </Link>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto -mx-5 px-5">
                <table className="w-full text-left text-xs min-w-[480px]">
                  <thead>
                    <tr className="border-b border-neutral-200/80 text-neutral-400 uppercase font-semibold text-[10px] tracking-wider">
                      <th className="py-2.5">Order #</th>
                      <th className="py-2.5">Customer</th>
                      <th className="py-2.5">Status</th>
                      <th className="py-2.5">Date</th>
                      <th className="py-2.5 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100 text-neutral-700">
                    {recentOrders.map((order) => (
                      <tr key={order.id} className="hover:bg-neutral-50/70 transition-colors">
                        <td className="py-3 font-mono font-bold text-neutral-900">
                          <Link
                            href="/admin/orders"
                            className="hover:text-primary transition-colors"
                          >
                            {order.orderNumber}
                          </Link>
                        </td>
                        <td className="py-3">
                          <div className="font-semibold text-neutral-800 truncate max-w-[130px]">
                            {order.customerName || "Customer"}
                          </div>
                          <div className="text-[10px] text-neutral-400 font-mono truncate max-w-[130px]">
                            {order.itemCount} {order.itemCount === 1 ? "item" : "items"}
                          </div>
                        </td>
                        <td className="py-3">
                          {renderOrderStatusBadge(order.status)}
                        </td>
                        <td className="py-3 text-[11px] text-neutral-500 whitespace-nowrap">
                          {new Date(order.createdAt).toLocaleDateString("en-IN", {
                            month: "short",
                            day: "numeric",
                          })}
                        </td>
                        <td className="py-3 text-right font-bold text-neutral-900">
                          ₹{order.totalAmount.toLocaleString("en-IN")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-neutral-100 flex items-center justify-between text-[11px] text-neutral-500">
            <span>
              {queryError
                ? "Database connection offline"
                : recentOrders.length === 0
                ? "No recent orders to show"
                : `Showing top ${Math.min(5, recentOrders.length)} recent`}
            </span>
            <Link
              href="/admin/orders"
              className="font-semibold text-primary hover:underline"
            >
              Order queue →
            </Link>
          </div>
        </section>

        {/* ==================================================================
            4B. RECENT PRODUCTS PANEL (Step 8 / A-04 Preserved)
            ================================================================== */}
        <section
          aria-label="Recent Products"
          className="p-5 rounded-2xl bg-surface border border-neutral-200/80 shadow-xs flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
              <div>
                <h2 className="text-sm font-bold text-neutral-900">
                  Recent Products
                </h2>
                <p className="text-xs text-neutral-500 mt-0.5">
                  Latest 3D prints added to MySQL catalog
                </p>
              </div>
              <Link
                href="/admin/products"
                className="text-xs font-semibold text-neutral-600 hover:text-neutral-900 inline-flex items-center gap-1 transition-colors"
              >
                <span>View All Products</span>
                <ChevronRightIcon size={14} />
              </Link>
            </div>

            {queryError ? (
              <div className="py-12 px-4 text-center space-y-2">
                <div className="w-11 h-11 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
                  <AlertCircleIcon size={20} />
                </div>
                <div className="text-xs font-bold text-neutral-800">
                  Catalog data temporarily unavailable
                </div>
                <p className="text-[11px] text-neutral-500 max-w-xs mx-auto">
                  Unable to synchronize live catalog products from the database. Please use the retry connection button above.
                </p>
              </div>
            ) : recentProducts.length === 0 ? (
              <div className="py-12 px-4 text-center space-y-2">
                <div className="w-11 h-11 rounded-full bg-neutral-100 text-neutral-400 flex items-center justify-center mx-auto">
                  <PackageIcon size={20} />
                </div>
                <div className="text-xs font-bold text-neutral-800">
                  No products in catalog yet
                </div>
                <p className="text-[11px] text-neutral-400 max-w-xs mx-auto">
                  Start selling by adding your first 3D print creation to the store.
                </p>
                <div className="pt-2">
                  <Link
                    href="/admin/products/new"
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary text-neutral-900 text-xs font-bold shadow-xs hover:bg-[#91BC7A] transition-colors"
                  >
                    <PlusIcon size={14} />
                    <span>Add First Product</span>
                  </Link>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto -mx-5 px-5">
                <table className="w-full text-left text-xs min-w-[480px]">
                  <thead>
                    <tr className="border-b border-neutral-200/80 text-neutral-400 uppercase font-semibold text-[10px] tracking-wider">
                      <th className="py-2.5">Product</th>
                      <th className="py-2.5">Category</th>
                      <th className="py-2.5">Stock</th>
                      <th className="py-2.5">Status</th>
                      <th className="py-2.5 text-right">Price</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100 text-neutral-700">
                    {recentProducts.map((p) => {
                      const displayImg = getProductPrimaryImage(p);

                      return (
                        <tr key={p.id} className="hover:bg-neutral-50/70 transition-colors">
                          <td className="py-3">
                            <div className="flex items-center gap-2.5">
                              <div className="relative w-9 h-9 rounded-lg bg-neutral-100 border border-neutral-200/80 overflow-hidden shrink-0">
                                <Image
                                  src={displayImg}
                                  alt={p.name}
                                  fill
                                  unoptimized={isUploadPath(displayImg)}
                                  sizes="36px"
                                  className="object-cover"
                                />
                              </div>
                              <div className="min-w-0 max-w-[130px] sm:max-w-[170px]">
                                <Link
                                  href={`/admin/products/${p.slug}/edit`}
                                  className="font-bold text-neutral-900 hover:text-primary transition-colors truncate block"
                                >
                                  {p.name}
                                </Link>
                                <span className="text-[10px] text-neutral-400 font-mono truncate block">
                                  {p.slug}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="py-3">
                            <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-neutral-100 text-neutral-700 truncate max-w-[110px]">
                              {p.category?.name || "General"}
                            </span>
                          </td>
                          <td className="py-3">
                            {p.stockQuantity === 0 ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-600">
                                <span className="w-1.5 h-1.5 rounded-full bg-red-600" />
                                <span>Out of Stock</span>
                              </span>
                            ) : p.stockQuantity <= 5 ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                <span>Low ({p.stockQuantity})</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-neutral-600">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                <span>{p.stockQuantity}</span>
                              </span>
                            )}
                          </td>
                          <td className="py-3">
                            {p.isActive ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                Active
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-neutral-100 text-neutral-600 border border-neutral-200">
                                Draft
                              </span>
                            )}
                          </td>
                          <td className="py-3 text-right font-bold text-neutral-900 whitespace-nowrap">
                            ₹{p.price.toLocaleString("en-IN")}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-neutral-100 flex items-center justify-between text-[11px] text-neutral-500">
            <span>
              {queryError
                ? "Database connection offline"
                : recentProducts.length === 0
                ? "No catalog items to show"
                : `Showing ${Math.min(5, recentProducts.length)} items`}
            </span>
            <Link
              href="/admin/products"
              className="font-semibold text-primary hover:underline"
            >
              Full catalog →
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
