"use client";

import React from "react";

interface AccountShellProps {
  children: React.ReactNode;
}

/**
 * AccountShell — Wrapper layout for all customer account pages.
 * Provides consistent canvas background, max-width centering,
 * responsive padding, and bottom-nav clearance on mobile.
 */
export default function AccountShell({ children }: AccountShellProps) {
  return (
    <main className="w-full min-h-[calc(100vh-68px)]">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-6 md:py-10 pb-[calc(8rem+env(safe-area-inset-bottom,0px))] md:pb-20">
        {children}
      </div>
    </main>
  );
}
