"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { AdminShell } from "@/components/admin";

/**
 * AdminLayoutClient — Routes admin pages into either:
 * 1. Dedicated, full-screen auth layout for /admin/login
 * 2. Reusable AdminShell (sidebar + topbar) for all other /admin/* routes
 */
export function AdminLayoutClient({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (pathname === "/admin/login") {
    return <>{children}</>;
  }

  return <AdminShell>{children}</AdminShell>;
}
