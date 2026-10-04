"use client";

import React, { useState, useEffect, useId, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  AdminDiscount,
  DiscountType,
  DiscountScope,
  getAllAdminDiscounts,
  saveAdminDiscount,
  updateAdminDiscount,
  getDiscountStatus,
  toDateNumber,
} from "@/lib/admin-discounts";
import { getAllAdminProducts, AdminProduct } from "@/lib/admin-catalog";
import { getAllAdminCategories, AdminCategory } from "@/lib/admin-categories";
import {
  ArrowLeftIcon,
  CheckCircleIcon,
  TagIcon,
  PercentIcon,
  CalendarIcon,
  PackageIcon,
  LayersIcon,
  AlertCircleIcon,
  SearchIcon,
} from "../AdminIcons";

interface AdminDiscountFormProps {
  mode: "create" | "edit";
  initialDiscount?: AdminDiscount;
}

interface FormErrors {
  name?: string;
  code?: string;
  value?: string;
  minimumOrderValue?: string;
  maximumDiscountAmount?: string;
  usageLimit?: string;
  startsAt?: string;
  endsAt?: string;
  scope?: string;
}

export function AdminDiscountForm({
  mode,
  initialDiscount,
}: AdminDiscountFormProps) {
  const router = useRouter();
  const formId = useId();
  const isEdit = mode === "edit";

  // Data sources for Scope assignment
  const [availableProducts, setAvailableProducts] = useState<AdminProduct[]>([]);
  const [availableCategories, setAvailableCategories] = useState<AdminCategory[]>([]);

  useEffect(() => {
    setAvailableProducts(getAllAdminProducts());
    setAvailableCategories(getAllAdminCategories().filter((c) => c.isActive));
  }, []);

  // Form State
  const [name, setName] = useState(initialDiscount?.name || "");
  const [code, setCode] = useState(initialDiscount?.code || "");
  const [description, setDescription] = useState(initialDiscount?.description || "");
  const [type, setType] = useState<DiscountType>(initialDiscount?.type || "percentage");
  const [value, setValue] = useState<string>(
    initialDiscount?.value !== undefined ? String(initialDiscount.value) : "10"
  );
  const [minimumOrderValue, setMinimumOrderValue] = useState<string>(
    initialDiscount?.minimumOrderValue ? String(initialDiscount.minimumOrderValue) : ""
  );
  const [maximumDiscountAmount, setMaximumDiscountAmount] = useState<string>(
    initialDiscount?.maximumDiscountAmount ? String(initialDiscount.maximumDiscountAmount) : ""
  );
  const [isLimitedUsage, setIsLimitedUsage] = useState<boolean>(
    initialDiscount ? initialDiscount.usageLimit !== null : false
  );
  const [usageLimit, setUsageLimit] = useState<string>(
    initialDiscount?.usageLimit ? String(initialDiscount.usageLimit) : "100"
  );

  // Default dates: start today, optional end in 30 days
  const todayStr = useMemo(() => {
    const d = new Date();
    return d.toISOString().split("T")[0];
  }, []);

  const [startsAt, setStartsAt] = useState<string>(
    initialDiscount?.startsAt ? initialDiscount.startsAt.split("T")[0] : todayStr
  );
  const [endsAt, setEndsAt] = useState<string>(
    initialDiscount?.endsAt ? initialDiscount.endsAt.split("T")[0] : ""
  );

  const [appliesTo, setAppliesTo] = useState<DiscountScope>(
    initialDiscount?.appliesTo || "all"
  );
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>(
    initialDiscount?.productIds || []
  );
  const [selectedCategorySlugs, setSelectedCategorySlugs] = useState<string[]>(
    initialDiscount?.categorySlugs || []
  );
  const [productSearch, setProductSearch] = useState("");

  const [isActive, setIsActive] = useState<boolean>(
    initialDiscount !== undefined ? initialDiscount.isActive : true
  );

  // Validation & Submission States
  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [savedDiscount, setSavedDiscount] = useState<AdminDiscount | null>(null);

  // Unsaved changes confirmation modal
  const [showDiscardModal, setShowDiscardModal] = useState(false);
  const [pendingNavigationUrl, setPendingNavigationUrl] = useState<string | null>(null);

  // Compute dirty state
  const isDirty = useMemo(() => {
    if (!isEdit) {
      return Boolean(name.trim() || code.trim() || description.trim() || minimumOrderValue);
    }
    if (!initialDiscount) return false;

    return (
      name !== initialDiscount.name ||
      code !== initialDiscount.code ||
      description !== (initialDiscount.description || "") ||
      type !== initialDiscount.type ||
      Number(value) !== initialDiscount.value ||
      (minimumOrderValue ? Number(minimumOrderValue) : undefined) !== initialDiscount.minimumOrderValue ||
      (maximumDiscountAmount ? Number(maximumDiscountAmount) : undefined) !== initialDiscount.maximumDiscountAmount ||
      isLimitedUsage !== (initialDiscount.usageLimit !== null) ||
      (isLimitedUsage ? Number(usageLimit) : null) !== initialDiscount.usageLimit ||
      startsAt !== (initialDiscount.startsAt ? initialDiscount.startsAt.split("T")[0] : "") ||
      endsAt !== (initialDiscount.endsAt ? initialDiscount.endsAt.split("T")[0] : "") ||
      appliesTo !== initialDiscount.appliesTo ||
      isActive !== initialDiscount.isActive ||
      JSON.stringify(selectedProductIds) !== JSON.stringify(initialDiscount.productIds || []) ||
      JSON.stringify(selectedCategorySlugs) !== JSON.stringify(initialDiscount.categorySlugs || [])
    );
  }, [
    isEdit,
    initialDiscount,
    name,
    code,
    description,
    type,
    value,
    minimumOrderValue,
    maximumDiscountAmount,
    isLimitedUsage,
    usageLimit,
    startsAt,
    endsAt,
    appliesTo,
    isActive,
    selectedProductIds,
    selectedCategorySlugs,
  ]);

  // Window beforeunload protection
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty && !savedDiscount) {
        e.preventDefault();
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty, savedDiscount]);

  // Code input handler: uppercase, alphanumeric + hyphens
  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const cleaned = e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 30);
    setCode(cleaned);
    if (errors.code) setErrors((prev) => ({ ...prev, code: undefined }));
  };

  // Preview object for status calculation & live sticky summary
  const previewDiscount: AdminDiscount = useMemo(() => {
    return {
      id: initialDiscount?.id || "preview",
      code: code || "COUPONCODE",
      name: name || "Discount Name",
      description,
      type,
      value: Number(value) || 0,
      minimumOrderValue: minimumOrderValue ? Number(minimumOrderValue) : undefined,
      maximumDiscountAmount: type === "percentage" && maximumDiscountAmount ? Number(maximumDiscountAmount) : undefined,
      usageLimit: isLimitedUsage ? Number(usageLimit) || 0 : null,
      usageCount: initialDiscount?.usageCount || 0,
      startsAt,
      endsAt: endsAt || undefined,
      appliesTo,
      productIds: selectedProductIds,
      categorySlugs: selectedCategorySlugs,
      isActive,
      createdAt: initialDiscount?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }, [
    initialDiscount,
    code,
    name,
    description,
    type,
    value,
    minimumOrderValue,
    maximumDiscountAmount,
    isLimitedUsage,
    usageLimit,
    startsAt,
    endsAt,
    appliesTo,
    selectedProductIds,
    selectedCategorySlugs,
    isActive,
  ]);

  const currentPreviewStatus = getDiscountStatus(previewDiscount);

  // Validation logic
  const validate = (): boolean => {
    const newErrors: FormErrors = {};

    // 1. Name
    const trimmedName = name.trim();
    if (!trimmedName) {
      newErrors.name = "Discount name is required.";
    } else if (trimmedName.length < 2) {
      newErrors.name = "Name must be at least 2 characters.";
    } else if (trimmedName.length > 80) {
      newErrors.name = "Name cannot exceed 80 characters.";
    }

    // 2. Code
    const trimmedCode = code.trim().toUpperCase();
    if (!trimmedCode) {
      newErrors.code = "Coupon code is required.";
    } else if (!/^[A-Z0-9-]+$/.test(trimmedCode)) {
      newErrors.code = "Code must contain uppercase letters, numbers, and hyphens only.";
    } else if (trimmedCode.length < 3) {
      newErrors.code = "Code must be at least 3 characters.";
    }

    // Duplicate check
    const allDiscounts = getAllAdminDiscounts();
    const isDuplicate = allDiscounts.some(
      (d) => d.code.toUpperCase() === trimmedCode && d.id !== initialDiscount?.id
    );
    if (isDuplicate) {
      newErrors.code = "This coupon code is already in use by another discount.";
    }

    // 3. Value
    const numVal = Number(value);
    if (isNaN(numVal) || numVal <= 0) {
      newErrors.value = "Enter a valid discount value greater than 0.";
    } else if (type === "percentage" && numVal > 100) {
      newErrors.value = "Percentage discount cannot exceed 100%.";
    }

    // 4. Minimum order & maximum discount
    if (minimumOrderValue && Number(minimumOrderValue) < 0) {
      newErrors.minimumOrderValue = "Minimum order value cannot be negative.";
    }
    if (type === "percentage" && maximumDiscountAmount && Number(maximumDiscountAmount) <= 0) {
      newErrors.maximumDiscountAmount = "Maximum discount cap must be greater than 0.";
    }

    // 5. Usage Limit
    if (isLimitedUsage) {
      const numLimit = Number(usageLimit);
      if (isNaN(numLimit) || numLimit < 1) {
        newErrors.usageLimit = "Maximum uses must be at least 1.";
      }
    }

    // 6. Dates
    if (!startsAt) {
      newErrors.startsAt = "Start date is required.";
    }
    if (startsAt && endsAt) {
      const startNum = toDateNumber(startsAt);
      const endNum = toDateNumber(endsAt);
      if (startNum !== null && endNum !== null && endNum < startNum) {
        newErrors.endsAt = "End date cannot be earlier than start date.";
      }
    }

    // 7. Scope
    if (appliesTo === "products" && selectedProductIds.length === 0) {
      newErrors.scope = "Please select at least one specific product.";
    }
    if (appliesTo === "categories" && selectedCategorySlugs.length === 0) {
      newErrors.scope = "Please select at least one category.";
    }

    setErrors(newErrors);
    setTouched({
      name: true,
      code: true,
      value: true,
      minimumOrderValue: true,
      maximumDiscountAmount: true,
      usageLimit: true,
      startsAt: true,
      endsAt: true,
      scope: true,
    });

    return Object.keys(newErrors).length === 0;
  };

  // Submit Handler
  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);

    const now = new Date().toISOString();
    let discountId = isEdit && initialDiscount
      ? initialDiscount.id
      : `dsc-${Date.now().toString(36)}`;

    // Prepare API payload
    const apiScope = appliesTo === "all" ? "store" : appliesTo === "categories" ? "category" : "product";
    const apiType = type === "percentage" ? "percentage" : "fixed_amount";
    const categoryIds = (selectedCategorySlugs || [])
      .map((slug) => availableCategories.find((c) => c.slug === slug)?.id)
      .filter(Boolean) as string[];

    const isRealUuid =
      initialDiscount?.id &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(initialDiscount.id);

    const apiPayload: any = {
      name: name.trim(),
      code: code.trim().toUpperCase(),
      discountType: apiType,
      value: Number(value),
      scope: apiScope,
      startAt: startsAt,
      endAt: endsAt || null,
      isActive,
      categoryId: categoryIds[0] || undefined,
      categoryIds: categoryIds.length > 0 ? categoryIds : undefined,
      productId: selectedProductIds[0] || undefined,
      productIds: selectedProductIds.length > 0 ? selectedProductIds : undefined,
    };

    let apiError: string | null = null;
    try {
      const endpoint =
        isEdit && isRealUuid
          ? `/api/admin/discounts/${initialDiscount.id}`
          : `/api/admin/discounts`;
      const method = isEdit && isRealUuid ? "PATCH" : "POST";

      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(apiPayload),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        if (res.status === 409 || res.status === 400) {
          apiError = errJson?.error || "Failed to save discount";
        }
      } else {
        const successData = await res.json().catch(() => null);
        if (successData?.discount?.id) {
          discountId = successData.discount.id;
        }
      }
    } catch {
      // Fallback to offline/demo mode seamlessly
    }

    if (apiError) {
      setErrors((prev) => ({ ...prev, code: apiError! }));
      setIsSubmitting(false);
      return;
    }

    const discountPayload: AdminDiscount = {
      id: discountId,
      code: code.trim().toUpperCase(),
      name: name.trim(),
      description: description.trim() || undefined,
      type,
      value: Number(value),
      minimumOrderValue: minimumOrderValue ? Number(minimumOrderValue) : undefined,
      maximumDiscountAmount: type === "percentage" && maximumDiscountAmount ? Number(maximumDiscountAmount) : undefined,
      usageLimit: isLimitedUsage ? Number(usageLimit) : null,
      usageCount: initialDiscount?.usageCount || 0,
      startsAt,
      endsAt: endsAt || undefined,
      appliesTo,
      productIds: appliesTo === "products" ? selectedProductIds : undefined,
      categorySlugs: appliesTo === "categories" ? selectedCategorySlugs : undefined,
      isActive,
      createdAt: initialDiscount?.createdAt || now,
      updatedAt: now,
    };

    if (isEdit && initialDiscount) {
      updateAdminDiscount(initialDiscount.code, discountPayload);
    } else {
      saveAdminDiscount(discountPayload);
    }

    setSavedDiscount(discountPayload);
    setIsSubmitting(false);
  };

  // Filter products for Specific Products picker
  const filteredProducts = useMemo(() => {
    if (!productSearch.trim()) return availableProducts;
    const q = productSearch.toLowerCase().trim();
    return availableProducts.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.slug.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
    );
  }, [availableProducts, productSearch]);

  const toggleProductSelection = (productId: string) => {
    setSelectedProductIds((prev) =>
      prev.includes(productId) ? prev.filter((id) => id !== productId) : [...prev, productId]
    );
    if (errors.scope) setErrors((prev) => ({ ...prev, scope: undefined }));
  };

  const toggleCategorySelection = (catSlug: string) => {
    setSelectedCategorySlugs((prev) =>
      prev.includes(catSlug) ? prev.filter((s) => s !== catSlug) : [...prev, catSlug]
    );
    if (errors.scope) setErrors((prev) => ({ ...prev, scope: undefined }));
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Top Bar with Breadcrumbs & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-neutral-200/80">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-semibold text-neutral-500">
            <button
              type="button"
              onClick={() => {
                if (isDirty) {
                  setShowDiscardModal(true);
                  setPendingNavigationUrl("/admin/discounts");
                } else {
                  router.push("/admin/discounts");
                }
              }}
              className="inline-flex items-center gap-1 hover:text-neutral-900 transition-colors cursor-pointer"
            >
              <ArrowLeftIcon size={14} />
              <span>Back to Discounts</span>
            </button>
            <span className="text-neutral-300">/</span>
            <span className="text-neutral-800 font-bold">
              {isEdit ? `Edit ${initialDiscount?.code}` : "Add Discount"}
            </span>
          </div>
          <h1 className="font-display text-2xl font-bold text-neutral-900 flex items-center gap-2.5">
            <span>{isEdit ? "Edit Promotional Discount" : "Create Promotional Offer"}</span>
            {isDirty && (
              <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-50 text-amber-900 border border-amber-200 px-2 py-0.5 rounded-full">
                Unsaved Changes
              </span>
            )}
          </h1>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => {
              if (isDirty) {
                setShowDiscardModal(true);
                setPendingNavigationUrl("/admin/discounts");
              } else {
                router.push("/admin/discounts");
              }
            }}
            className="px-4 py-2.5 rounded-xl border border-neutral-200 hover:bg-neutral-100 text-xs font-semibold text-neutral-700 transition-all cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={() => handleSubmit()}
            disabled={isSubmitting}
            className="px-5 py-2.5 rounded-xl bg-primary hover:bg-[#91BC7A] text-neutral-900 font-bold text-xs flex items-center gap-1.5 shadow-xs transition-all cursor-pointer disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-neutral-900 border-t-transparent rounded-full animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <span>{isEdit ? "Save Changes" : "Save Discount"}</span>
            )}
          </button>
        </div>
      </div>

      {/* Main Grid: Form (Left 8 cols) + Sticky Live Preview (Right 4 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Form Body */}
        <form
          id={formId}
          onSubmit={handleSubmit}
          noValidate
          className="lg:col-span-8 space-y-6"
        >
          {/* Section A: Basic Information */}
          <section className="p-5 sm:p-6 rounded-2xl bg-surface border border-neutral-200/80 space-y-5">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-900 flex items-center gap-2">
                <TagIcon size={16} className="text-primary" />
                <span>A. Basic Information</span>
              </h2>
              <span className="text-[11px] text-neutral-400 font-medium">Required</span>
            </div>

            {/* Discount Name */}
            <div className="space-y-1.5">
              <label
                htmlFor={`${formId}-name`}
                className="block text-xs font-bold text-neutral-800"
              >
                Discount Name <span className="text-error">*</span>
              </label>
              <input
                id={`${formId}-name`}
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
                }}
                onBlur={() => setTouched((prev) => ({ ...prev, name: true }))}
                placeholder="e.g. Sitewide Launch Offer"
                maxLength={80}
                className={`w-full px-3.5 py-2.5 rounded-xl border text-xs sm:text-sm bg-white placeholder:text-neutral-400 text-neutral-900 focus:outline-none focus:ring-2 transition-all ${
                  touched.name && errors.name
                    ? "border-error focus:ring-error/20"
                    : "border-neutral-200 focus:ring-primary/40 focus:border-primary"
                }`}
                aria-invalid={Boolean(touched.name && errors.name)}
                aria-describedby={errors.name ? `${formId}-name-err` : undefined}
              />
              <div className="flex items-center justify-between text-[11px]">
                {touched.name && errors.name ? (
                  <span id={`${formId}-name-err`} role="alert" className="text-error font-medium flex items-center gap-1">
                    <AlertCircleIcon size={12} />
                    {errors.name}
                  </span>
                ) : (
                  <span className="text-neutral-500">Public or internal display label for this campaign.</span>
                )}
                <span className="text-neutral-400 font-mono">{name.length}/80</span>
              </div>
            </div>

            {/* Discount Code */}
            <div className="space-y-1.5">
              <label
                htmlFor={`${formId}-code`}
                className="block text-xs font-bold text-neutral-800"
              >
                Coupon Code <span className="text-error">*</span>
              </label>
              <div className="relative">
                <input
                  id={`${formId}-code`}
                  type="text"
                  value={code}
                  onChange={handleCodeChange}
                  onBlur={() => setTouched((prev) => ({ ...prev, code: true }))}
                  placeholder="e.g. DEARR10"
                  maxLength={30}
                  className={`w-full px-3.5 py-2.5 rounded-xl border font-mono font-bold tracking-wider uppercase text-xs sm:text-sm bg-white placeholder:text-neutral-400 text-neutral-900 focus:outline-none focus:ring-2 transition-all ${
                    touched.code && errors.code
                      ? "border-error focus:ring-error/20"
                      : "border-neutral-200 focus:ring-primary/40 focus:border-primary"
                  }`}
                  aria-invalid={Boolean(touched.code && errors.code)}
                  aria-describedby={errors.code ? `${formId}-code-err` : undefined}
                />
              </div>
              <div className="flex items-center justify-between text-[11px]">
                {touched.code && errors.code ? (
                  <span id={`${formId}-code-err`} role="alert" className="text-error font-medium flex items-center gap-1">
                    <AlertCircleIcon size={12} />
                    {errors.code}
                  </span>
                ) : (
                  <span className="text-neutral-500">Customers enter this code at checkout. Uppercase &amp; hyphens only.</span>
                )}
                <span className="text-neutral-400 font-mono">{code.length}/30</span>
              </div>
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <label
                htmlFor={`${formId}-desc`}
                className="block text-xs font-bold text-neutral-800"
              >
                Description <span className="text-neutral-400 font-normal">(Optional)</span>
              </label>
              <textarea
                id={`${formId}-desc`}
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value.slice(0, 300))}
                placeholder="Internal notes or customer promotional teaser copy..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 text-xs sm:text-sm bg-white placeholder:text-neutral-400 text-neutral-900 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all resize-none"
              />
              <div className="flex justify-end text-[11px] text-neutral-400 font-mono">
                {description.length}/300
              </div>
            </div>
          </section>

          {/* Section B: Discount Value */}
          <section className="p-5 sm:p-6 rounded-2xl bg-surface border border-neutral-200/80 space-y-5">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-900 flex items-center gap-2">
                <PercentIcon size={16} className="text-primary" />
                <span>B. Discount Value</span>
              </h2>
              <span className="text-[11px] text-neutral-400 font-medium">Type &amp; Amount</span>
            </div>

            {/* Discount Type Radio Pill Selector */}
            <div className="space-y-2">
              <span className="block text-xs font-bold text-neutral-800">
                Discount Type <span className="text-error">*</span>
              </span>
              <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="Discount Type">
                <button
                  type="button"
                  onClick={() => {
                    setType("percentage");
                    if (Number(value) > 100) setValue("10");
                  }}
                  className={`flex items-center justify-center gap-2 p-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                    type === "percentage"
                      ? "bg-primary/20 border-primary text-neutral-900 shadow-xs"
                      : "bg-white border-neutral-200 text-neutral-600 hover:bg-neutral-50"
                  }`}
                  role="radio"
                  aria-checked={type === "percentage"}
                >
                  <PercentIcon size={16} />
                  <span>Percentage (%)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setType("fixed")}
                  className={`flex items-center justify-center gap-2 p-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                    type === "fixed"
                      ? "bg-primary/20 border-primary text-neutral-900 shadow-xs"
                      : "bg-white border-neutral-200 text-neutral-600 hover:bg-neutral-50"
                  }`}
                  role="radio"
                  aria-checked={type === "fixed"}
                >
                  <span className="font-mono text-sm font-bold">₹</span>
                  <span>Fixed Amount (₹)</span>
                </button>
              </div>
            </div>

            {/* Value Input */}
            <div className="space-y-1.5">
              <label
                htmlFor={`${formId}-value`}
                className="block text-xs font-bold text-neutral-800"
              >
                {type === "percentage" ? "Percentage Off (%)" : "Fixed Discount (₹)"}{" "}
                <span className="text-error">*</span>
              </label>
              <div className="relative">
                <input
                  id={`${formId}-value`}
                  type="number"
                  step={type === "percentage" ? "1" : "5"}
                  min="0.1"
                  max={type === "percentage" ? "100" : undefined}
                  value={value}
                  onChange={(e) => {
                    setValue(e.target.value);
                    if (errors.value) setErrors((prev) => ({ ...prev, value: undefined }));
                  }}
                  placeholder={type === "percentage" ? "10" : "200"}
                  className={`w-full px-3.5 py-2.5 rounded-xl border text-xs sm:text-sm bg-white text-neutral-900 font-semibold focus:outline-none focus:ring-2 transition-all ${
                    touched.value && errors.value
                      ? "border-error focus:ring-error/20"
                      : "border-neutral-200 focus:ring-primary/40 focus:border-primary"
                  }`}
                  aria-invalid={Boolean(touched.value && errors.value)}
                />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-neutral-400 select-none">
                  {type === "percentage" ? "%" : "INR"}
                </span>
              </div>

              {/* Dynamic Live Value Explanation */}
              <div className="p-2.5 rounded-xl bg-neutral-50 border border-neutral-200/80 flex items-center justify-between text-xs">
                <span className="text-neutral-600 font-medium">Customer Experience:</span>
                <span className="font-bold text-primary-dark">
                  {Number(value) > 0
                    ? type === "percentage"
                      ? `Customer gets ${value}% off eligible items`
                      : `Customer gets ₹${Number(value).toLocaleString("en-IN")} off eligible items`
                    : "Specify a value above 0"}
                </span>
              </div>
              {touched.value && errors.value && (
                <span role="alert" className="text-[11px] text-error font-medium flex items-center gap-1">
                  <AlertCircleIcon size={12} />
                  {errors.value}
                </span>
              )}
            </div>
          </section>

          {/* Section C: Limits */}
          <section className="p-5 sm:p-6 rounded-2xl bg-surface border border-neutral-200/80 space-y-5">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-900 flex items-center gap-2">
                <TagIcon size={16} className="text-primary" />
                <span>C. Limits &amp; Safeguards</span>
              </h2>
              <span className="text-[11px] text-neutral-400 font-medium">Spend &amp; Redemption</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Minimum Order Value */}
              <div className="space-y-1.5">
                <label
                  htmlFor={`${formId}-min-order`}
                  className="block text-xs font-bold text-neutral-800"
                >
                  Minimum Order Value (₹) <span className="text-neutral-400 font-normal">(Optional)</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-neutral-400 select-none">
                    ₹
                  </span>
                  <input
                    id={`${formId}-min-order`}
                    type="number"
                    min="0"
                    step="50"
                    value={minimumOrderValue}
                    onChange={(e) => setMinimumOrderValue(e.target.value)}
                    placeholder="e.g. 499"
                    className="w-full pl-7 pr-3 py-2 rounded-xl border border-neutral-200 text-xs sm:text-sm bg-white text-neutral-900 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
                  />
                </div>
                <span className="text-[11px] text-neutral-500">Cart subtotal before code applies.</span>
              </div>

              {/* Maximum Discount Amount (Percentage only) */}
              <div className={`space-y-1.5 ${type !== "percentage" ? "opacity-40 pointer-events-none" : ""}`}>
                <label
                  htmlFor={`${formId}-max-discount`}
                  className="block text-xs font-bold text-neutral-800"
                >
                  Maximum Discount Cap (₹){" "}
                  <span className="text-neutral-400 font-normal">
                    {type === "percentage" ? "(Optional)" : "(Percentage only)"}
                  </span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-neutral-400 select-none">
                    ₹
                  </span>
                  <input
                    id={`${formId}-max-discount`}
                    type="number"
                    min="1"
                    step="50"
                    disabled={type !== "percentage"}
                    value={maximumDiscountAmount}
                    onChange={(e) => setMaximumDiscountAmount(e.target.value)}
                    placeholder="e.g. 200"
                    className="w-full pl-7 pr-3 py-2 rounded-xl border border-neutral-200 text-xs sm:text-sm bg-white text-neutral-900 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all disabled:bg-neutral-100"
                  />
                </div>
                <span className="text-[11px] text-neutral-500">Maximum savings allowed per order.</span>
              </div>
            </div>

            {/* Usage Limit: Unlimited vs Limited */}
            <div className="space-y-3 pt-2 border-t border-neutral-100">
              <span className="block text-xs font-bold text-neutral-800">
                Usage Limit
              </span>
              <div className="flex flex-col sm:flex-row gap-3">
                <label className="flex items-center gap-2 p-3 rounded-xl border border-neutral-200 bg-white hover:bg-neutral-50 cursor-pointer flex-1 text-xs font-semibold text-neutral-800">
                  <input
                    type="radio"
                    name="usageLimitType"
                    checked={!isLimitedUsage}
                    onChange={() => setIsLimitedUsage(false)}
                    className="accent-primary"
                  />
                  <span>Unlimited Total Redemptions</span>
                </label>

                <label className="flex items-center gap-2 p-3 rounded-xl border border-neutral-200 bg-white hover:bg-neutral-50 cursor-pointer flex-1 text-xs font-semibold text-neutral-800">
                  <input
                    type="radio"
                    name="usageLimitType"
                    checked={isLimitedUsage}
                    onChange={() => setIsLimitedUsage(true)}
                    className="accent-primary"
                  />
                  <span>Limit Total Redemptions</span>
                </label>
              </div>

              {isLimitedUsage && (
                <div className="p-3.5 rounded-xl bg-neutral-50 border border-neutral-200 space-y-1.5 animate-in fade-in duration-150">
                  <label htmlFor={`${formId}-usage-limit`} className="block text-xs font-bold text-neutral-800">
                    Maximum Number of Uses
                  </label>
                  <input
                    id={`${formId}-usage-limit`}
                    type="number"
                    min="1"
                    step="10"
                    value={usageLimit}
                    onChange={(e) => setUsageLimit(e.target.value)}
                    placeholder="e.g. 100"
                    className="w-full sm:w-48 px-3 py-2 rounded-xl border border-neutral-200 text-xs sm:text-sm bg-white text-neutral-900 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all font-semibold"
                  />
                  <span className="text-[11px] text-neutral-500 block">
                    Once reached, the coupon becomes exhausted.
                  </span>
                </div>
              )}
            </div>
          </section>

          {/* Section D: Validity Dates */}
          <section className="p-5 sm:p-6 rounded-2xl bg-surface border border-neutral-200/80 space-y-5">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-900 flex items-center gap-2">
                <CalendarIcon size={16} className="text-primary" />
                <span>D. Validity Period</span>
              </h2>
              <span className="text-[11px] text-neutral-400 font-medium">Campaign Schedule</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Start Date */}
              <div className="space-y-1.5">
                <label
                  htmlFor={`${formId}-start-date`}
                  className="block text-xs font-bold text-neutral-800"
                >
                  Start Date <span className="text-error">*</span>
                </label>
                <input
                  id={`${formId}-start-date`}
                  type="date"
                  value={startsAt}
                  onChange={(e) => {
                    setStartsAt(e.target.value);
                    if (errors.startsAt) setErrors((prev) => ({ ...prev, startsAt: undefined }));
                  }}
                  className={`w-full px-3.5 py-2.5 rounded-xl border text-xs sm:text-sm bg-white text-neutral-900 focus:outline-none focus:ring-2 transition-all ${
                    errors.startsAt
                      ? "border-error focus:ring-error/20"
                      : "border-neutral-200 focus:ring-primary/40 focus:border-primary"
                  }`}
                  aria-invalid={Boolean(errors.startsAt)}
                />
                {errors.startsAt ? (
                  <span role="alert" className="text-[11px] text-error font-medium flex items-center gap-1">
                    <AlertCircleIcon size={12} />
                    {errors.startsAt}
                  </span>
                ) : (
                  <span className="text-[11px] text-neutral-500">Date from which code can be redeemed.</span>
                )}
              </div>

              {/* End Date */}
              <div className="space-y-1.5">
                <label
                  htmlFor={`${formId}-end-date`}
                  className="block text-xs font-bold text-neutral-800"
                >
                  End Date <span className="text-neutral-400 font-normal">(Optional)</span>
                </label>
                <input
                  id={`${formId}-end-date`}
                  type="date"
                  min={startsAt || undefined}
                  value={endsAt}
                  onChange={(e) => {
                    setEndsAt(e.target.value);
                    if (errors.endsAt) setErrors((prev) => ({ ...prev, endsAt: undefined }));
                  }}
                  className={`w-full px-3.5 py-2.5 rounded-xl border text-xs sm:text-sm bg-white text-neutral-900 focus:outline-none focus:ring-2 transition-all ${
                    errors.endsAt
                      ? "border-error focus:ring-error/20"
                      : "border-neutral-200 focus:ring-primary/40 focus:border-primary"
                  }`}
                  aria-invalid={Boolean(errors.endsAt)}
                />
                {errors.endsAt ? (
                  <span role="alert" className="text-[11px] text-error font-medium flex items-center gap-1">
                    <AlertCircleIcon size={12} />
                    {errors.endsAt}
                  </span>
                ) : (
                  <span className="text-[11px] text-neutral-500">Leave blank for indefinite validity.</span>
                )}
              </div>
            </div>

            {/* Calculated Schedule Status Banner */}
            <div className="p-3 rounded-xl bg-neutral-50 border border-neutral-200 flex items-center justify-between text-xs">
              <span className="text-neutral-600 font-medium">Derived Schedule State:</span>
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider text-[10px] ${
                  currentPreviewStatus === "active"
                    ? "bg-primary/20 text-neutral-900 border border-primary/40"
                    : currentPreviewStatus === "scheduled"
                    ? "bg-blue-50 text-blue-800 border border-blue-200"
                    : currentPreviewStatus === "expired"
                    ? "bg-amber-50 text-amber-900 border border-amber-200"
                    : currentPreviewStatus === "deactivated"
                    ? "bg-neutral-100 text-neutral-500 border border-neutral-200"
                    : "bg-neutral-100 text-neutral-600 border border-neutral-300"
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    currentPreviewStatus === "active"
                      ? "bg-primary-dark animate-pulse"
                      : currentPreviewStatus === "scheduled"
                      ? "bg-blue-500"
                      : currentPreviewStatus === "expired"
                      ? "bg-amber-500"
                      : "bg-neutral-400"
                  }`}
                />
                <span>{currentPreviewStatus}</span>
              </span>
            </div>
          </section>

          {/* Section E: Applicable Scope */}
          <section className="p-5 sm:p-6 rounded-2xl bg-surface border border-neutral-200/80 space-y-5">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-900 flex items-center gap-2">
                <LayersIcon size={16} className="text-primary" />
                <span>E. Applicable Scope</span>
              </h2>
              <span className="text-[11px] text-neutral-400 font-medium">Product Eligibility</span>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setAppliesTo("all");
                    if (errors.scope) setErrors((prev) => ({ ...prev, scope: undefined }));
                  }}
                  className={`p-3 rounded-xl border text-xs font-bold transition-all text-left flex flex-col gap-1 cursor-pointer ${
                    appliesTo === "all"
                      ? "bg-primary/20 border-primary text-neutral-900 shadow-xs"
                      : "bg-white border-neutral-200 text-neutral-600 hover:bg-neutral-50"
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <CheckCircleIcon size={14} className={appliesTo === "all" ? "text-primary" : "text-neutral-300"} />
                    <span>All Products</span>
                  </span>
                  <span className="text-[11px] text-neutral-500 font-normal">Entire Dearr 3D print catalog</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setAppliesTo("categories");
                    if (errors.scope) setErrors((prev) => ({ ...prev, scope: undefined }));
                  }}
                  className={`p-3 rounded-xl border text-xs font-bold transition-all text-left flex flex-col gap-1 cursor-pointer ${
                    appliesTo === "categories"
                      ? "bg-primary/20 border-primary text-neutral-900 shadow-xs"
                      : "bg-white border-neutral-200 text-neutral-600 hover:bg-neutral-50"
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <LayersIcon size={14} className={appliesTo === "categories" ? "text-primary" : "text-neutral-300"} />
                    <span>Categories</span>
                  </span>
                  <span className="text-[11px] text-neutral-500 font-normal">Apply to selected collections</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setAppliesTo("products");
                    if (errors.scope) setErrors((prev) => ({ ...prev, scope: undefined }));
                  }}
                  className={`p-3 rounded-xl border text-xs font-bold transition-all text-left flex flex-col gap-1 cursor-pointer ${
                    appliesTo === "products"
                      ? "bg-primary/20 border-primary text-neutral-900 shadow-xs"
                      : "bg-white border-neutral-200 text-neutral-600 hover:bg-neutral-50"
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <PackageIcon size={14} className={appliesTo === "products" ? "text-primary" : "text-neutral-300"} />
                    <span>Specific Products</span>
                  </span>
                  <span className="text-[11px] text-neutral-500 font-normal">Pick individual catalog models</span>
                </button>
              </div>

              {errors.scope && (
                <span role="alert" className="text-[11px] text-error font-medium flex items-center gap-1">
                  <AlertCircleIcon size={12} />
                  {errors.scope}
                </span>
              )}

              {/* Sub-picker: Category Scope */}
              {appliesTo === "categories" && (
                <div className="p-4 rounded-xl bg-neutral-50 border border-neutral-200 space-y-3 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-neutral-800">
                      Select Eligible Categories ({selectedCategorySlugs.length} selected):
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        if (selectedCategorySlugs.length === availableCategories.length) {
                          setSelectedCategorySlugs([]);
                        } else {
                          setSelectedCategorySlugs(availableCategories.map((c) => c.slug));
                        }
                      }}
                      className="text-[11px] font-bold text-primary-dark hover:underline cursor-pointer"
                    >
                      {selectedCategorySlugs.length === availableCategories.length ? "Deselect All" : "Select All"}
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                    {availableCategories.map((cat) => {
                      const isSelected = selectedCategorySlugs.includes(cat.slug);
                      return (
                        <label
                          key={cat.id}
                          className={`flex items-center gap-2.5 p-2 rounded-lg border text-xs font-medium cursor-pointer transition-all ${
                            isSelected
                              ? "bg-white border-primary/60 text-neutral-900 shadow-xs font-semibold"
                              : "bg-white border-neutral-200 text-neutral-600 hover:bg-neutral-100"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleCategorySelection(cat.slug)}
                            className="accent-primary rounded"
                          />
                          <span className="truncate">{cat.name}</span>
                          <span className="text-[10px] text-neutral-400 ml-auto">
                            {cat.productCount} products
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Sub-picker: Specific Products Scope */}
              {appliesTo === "products" && (
                <div className="p-4 rounded-xl bg-neutral-50 border border-neutral-200 space-y-3 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-bold text-neutral-800">
                      Select Eligible Products ({selectedProductIds.length} selected):
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        if (selectedProductIds.length === availableProducts.length) {
                          setSelectedProductIds([]);
                        } else {
                          setSelectedProductIds(availableProducts.map((p) => p.id));
                        }
                      }}
                      className="text-[11px] font-bold text-primary-dark hover:underline cursor-pointer shrink-0"
                    >
                      {selectedProductIds.length === availableProducts.length ? "Deselect All" : "Select All"}
                    </button>
                  </div>

                  {/* Product Search */}
                  <div className="relative">
                    <SearchIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                    <input
                      type="text"
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                      placeholder="Search by product name, SKU, or category..."
                      className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-neutral-200 text-xs bg-white text-neutral-900 focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>

                  <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1 divide-y divide-neutral-100">
                    {filteredProducts.map((p) => {
                      const isSelected = selectedProductIds.includes(p.id);
                      return (
                        <label
                          key={p.id}
                          className={`flex items-center gap-3 p-2 rounded-lg border text-xs cursor-pointer transition-all ${
                            isSelected
                              ? "bg-white border-primary/60 text-neutral-900 shadow-xs font-semibold"
                              : "bg-white border-neutral-200 text-neutral-700 hover:bg-neutral-100"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleProductSelection(p.id)}
                            className="accent-primary rounded shrink-0"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="truncate font-semibold text-neutral-900">{p.name}</div>
                            <div className="text-[10px] text-neutral-400 flex items-center gap-2">
                              <span>₹{p.price}</span>
                              <span>•</span>
                              <span>{p.category}</span>
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Section F: Status Toggle */}
          <section className="p-5 sm:p-6 rounded-2xl bg-surface border border-neutral-200/80 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs font-bold text-neutral-800">
                Discount Activation
              </span>
              <p className="text-[11px] text-neutral-500">
                Deactivated discounts cannot be redeemed by customers regardless of validity dates.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="sr-only peer"
                aria-label="Toggle discount activation"
              />
              <div className="w-11 h-6 bg-neutral-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary/40 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary" />
            </label>
          </section>
        </form>

        {/* Section 13: Sticky Live Discount Preview Panel (Desktop 4 cols) */}
        <aside className="lg:col-span-4 sticky top-24 space-y-4">
          <div className="p-5 rounded-2xl bg-surface border border-neutral-200/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">
                Live Offer Preview
              </span>
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider text-[10px] ${
                  currentPreviewStatus === "active"
                    ? "bg-primary/20 text-neutral-900 border border-primary/40"
                    : currentPreviewStatus === "scheduled"
                    ? "bg-blue-50 text-blue-800 border border-blue-200"
                    : currentPreviewStatus === "expired"
                    ? "bg-amber-50 text-amber-900 border border-amber-200"
                    : currentPreviewStatus === "deactivated"
                    ? "bg-neutral-100 text-neutral-500 border border-neutral-200"
                    : "bg-neutral-100 text-neutral-600 border border-neutral-300"
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    currentPreviewStatus === "active"
                      ? "bg-primary-dark animate-pulse"
                      : currentPreviewStatus === "scheduled"
                      ? "bg-blue-500"
                      : currentPreviewStatus === "expired"
                      ? "bg-amber-500"
                      : "bg-neutral-400"
                  }`}
                />
                <span>{currentPreviewStatus}</span>
              </span>
            </div>

            {/* Simulated Coupon Card */}
            <div className="p-4 rounded-xl bg-gradient-to-br from-[#F5F8F2] to-white border-2 border-dashed border-primary/60 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-mono text-sm font-extrabold tracking-wider text-neutral-900 bg-white px-2.5 py-1 rounded-lg border border-neutral-200 shadow-2xs">
                  {code || "COUPONCODE"}
                </span>
                <span className="text-base font-display font-black text-neutral-900">
                  {Number(value) > 0
                    ? type === "percentage"
                      ? `${value}% OFF`
                      : `₹${Number(value).toLocaleString("en-IN")} OFF`
                    : "—"}
                </span>
              </div>

              <div>
                <div className="text-xs font-bold text-neutral-800 line-clamp-1">
                  {name || "Promotion Title"}
                </div>
                {description && (
                  <p className="text-[11px] text-neutral-500 line-clamp-2 mt-0.5">
                    {description}
                  </p>
                )}
              </div>

              <div className="pt-2 border-t border-neutral-200/60 space-y-1.5 text-[11px]">
                <div className="flex items-center justify-between text-neutral-600">
                  <span>Minimum Spend:</span>
                  <span className="font-semibold text-neutral-900">
                    {minimumOrderValue ? `₹${Number(minimumOrderValue).toLocaleString("en-IN")}` : "No minimum"}
                  </span>
                </div>

                {type === "percentage" && maximumDiscountAmount && (
                  <div className="flex items-center justify-between text-neutral-600">
                    <span>Max Discount Cap:</span>
                    <span className="font-semibold text-neutral-900">
                      ₹{Number(maximumDiscountAmount).toLocaleString("en-IN")}
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-between text-neutral-600">
                  <span>Applicable to:</span>
                  <span className="font-semibold text-neutral-900 truncate max-w-[150px]">
                    {appliesTo === "all"
                      ? "All Products"
                      : appliesTo === "categories"
                      ? `${selectedCategorySlugs.length} Categories`
                      : `${selectedProductIds.length} Products`}
                  </span>
                </div>

                <div className="flex items-center justify-between text-neutral-600">
                  <span>Valid:</span>
                  <span className="font-semibold text-neutral-900">
                    {startsAt} {endsAt ? `→ ${endsAt}` : "onwards"}
                  </span>
                </div>

                <div className="flex items-center justify-between text-neutral-600">
                  <span>Redemptions:</span>
                  <span className="font-semibold text-neutral-900">
                    {isLimitedUsage ? `${initialDiscount?.usageCount || 0} / ${usageLimit}` : "Unlimited"}
                  </span>
                </div>
              </div>
            </div>

            <div className="text-[11px] text-neutral-400 text-center">
              This card demonstrates how discount rules will evaluate for customer orders.
            </div>
          </div>
        </aside>
      </div>

      {/* Discard Changes Confirmation Modal */}
      {showDiscardModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150"
          role="dialog"
          aria-modal="true"
          aria-labelledby="discard-title"
        >
          <div className="bg-surface rounded-2xl border border-neutral-200 shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="space-y-2">
              <h3 id="discard-title" className="text-base font-bold text-neutral-900">
                Discard Changes?
              </h3>
              <p className="text-xs text-neutral-600 leading-relaxed">
                You have unsaved modifications to this discount configuration. Are you sure you want to leave without saving?
              </p>
            </div>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowDiscardModal(false)}
                className="px-4 py-2 rounded-xl border border-neutral-200 text-xs font-semibold text-neutral-700 hover:bg-neutral-100 transition-colors cursor-pointer"
              >
                Keep Editing
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowDiscardModal(false);
                  if (pendingNavigationUrl) router.push(pendingNavigationUrl);
                }}
                className="px-4 py-2 rounded-xl bg-error text-white text-xs font-bold hover:bg-red-700 transition-colors cursor-pointer"
              >
                Discard &amp; Leave
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Save Success Modal */}
      {savedDiscount && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150"
          role="dialog"
          aria-modal="true"
          aria-labelledby="success-title"
        >
          <div className="bg-surface rounded-2xl border border-neutral-200 shadow-2xl max-w-md w-full p-6 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-primary/20 text-neutral-900 flex items-center justify-center mx-auto">
              <CheckCircleIcon size={24} />
            </div>
            <div className="space-y-1">
              <h3 id="success-title" className="text-base font-bold text-neutral-900">
                {isEdit ? "Discount Updated Successfully" : "Discount Created Successfully"}
              </h3>
              <p className="text-xs text-neutral-600">
                Coupon <span className="font-mono font-bold text-neutral-900">{savedDiscount.code}</span> has been saved into the admin demo state.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => router.push("/admin/discounts")}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-primary hover:bg-[#91BC7A] text-neutral-900 font-bold text-xs shadow-xs transition-all cursor-pointer"
              >
                Return to Discounts
              </button>
              {!isEdit && (
                <button
                  type="button"
                  onClick={() => {
                    setSavedDiscount(null);
                    setName("");
                    setCode("");
                    setDescription("");
                    setValue("10");
                    setMinimumOrderValue("");
                    setMaximumDiscountAmount("");
                    setIsLimitedUsage(false);
                    setStartsAt(todayStr);
                    setEndsAt("");
                    setAppliesTo("all");
                    setSelectedProductIds([]);
                    setSelectedCategorySlugs([]);
                    setIsActive(true);
                  }}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-neutral-200 text-xs font-semibold text-neutral-700 hover:bg-neutral-100 transition-all cursor-pointer"
                >
                  Add Another Discount
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
