"use client";

import React, { useState, useEffect } from "react";
import { AdminCategory, getAdminCategoryBySlug } from "@/lib/admin-categories";
import { AdminCategoryForm } from "./AdminCategoryForm";
import { AdminCategoryNotFound } from "./AdminCategoryNotFound";

interface AdminEditCategoryClientProps {
  slug: string;
  initialCategory?: AdminCategory | null;
}

export function AdminEditCategoryClient({ slug, initialCategory }: AdminEditCategoryClientProps) {
  const [category, setCategory] = useState<AdminCategory | null>(initialCategory ?? null);
  const [loading, setLoading] = useState(!initialCategory);

  useEffect(() => {
    const found = getAdminCategoryBySlug(slug);
    setCategory(found);
    setLoading(false);
  }, [slug]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]" aria-busy="true">
        <div className="flex flex-col items-center gap-2">
          <div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-neutral-500 font-medium">
            Loading category...
          </span>
        </div>
      </div>
    );
  }

  if (!category) {
    return <AdminCategoryNotFound slug={slug} />;
  }

  return <AdminCategoryForm mode="edit" initialCategory={category} />;
}
