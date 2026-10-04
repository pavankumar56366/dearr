import { AdminDashboardSkeleton } from "@/components/admin/AdminDashboardSkeleton";

/**
 * Admin Dashboard Loading State
 * Next.js App Router Suspense fallback while server-side operations data is loading.
 */
export default function AdminLoading() {
  return <AdminDashboardSkeleton />;
}
