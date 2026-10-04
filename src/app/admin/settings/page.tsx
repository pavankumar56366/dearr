import type { Metadata } from "next";
import { AdminSettingsPage } from "@/components/admin/settings/AdminSettingsPage";

export const metadata: Metadata = {
  title: "Store Settings & Configuration — Dearr Founder Operations",
  description: "Configure store identity, checkout limits, customer policies, and notification rules.",
  robots: {
    index: false,
    follow: false,
  },
};

/**
 * Admin Settings Route
 * Route: /admin/settings
 * Rendered within AdminShell provided by AdminLayoutClient.
 */
export default function AdminSettingsRoute() {
  return <AdminSettingsPage />;
}
