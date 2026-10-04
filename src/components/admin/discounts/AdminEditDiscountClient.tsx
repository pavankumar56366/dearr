"use client";

import React, { useState, useEffect } from "react";
import { AdminDiscount, getAdminDiscountByCode } from "@/lib/admin-discounts";
import { AdminDiscountForm } from "./AdminDiscountForm";
import { AdminDiscountNotFound } from "./AdminDiscountNotFound";

interface AdminEditDiscountClientProps {
  code: string;
  initialDiscount?: AdminDiscount | null;
}

export function AdminEditDiscountClient({
  code,
  initialDiscount,
}: AdminEditDiscountClientProps) {
  const [discount, setDiscount] = useState<AdminDiscount | null>(initialDiscount ?? null);
  const [loading, setLoading] = useState(!initialDiscount);

  useEffect(() => {
    const found = getAdminDiscountByCode(code);
    setDiscount(found);
    setLoading(false);
  }, [code]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]" aria-busy="true">
        <div className="flex flex-col items-center gap-2">
          <div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-neutral-500 font-medium">
            Loading discount...
          </span>
        </div>
      </div>
    );
  }

  if (!discount) {
    return <AdminDiscountNotFound code={code} />;
  }

  return <AdminDiscountForm mode="edit" initialDiscount={discount} />;
}
