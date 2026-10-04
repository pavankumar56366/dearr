"use client";

import React, { useState, useEffect, useId } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AdminCategory,
  getAllAdminCategories,
  saveAdminCategory,
  updateAdminCategory,
} from "@/lib/admin-categories";
import {
  ArrowLeftIcon,
  CheckCircleIcon,
} from "../AdminIcons";

interface AdminCategoryFormProps {
  mode: "create" | "edit";
  initialCategory?: AdminCategory;
}

interface FormErrors {
  name?: string;
  slug?: string;
  description?: string;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function AdminCategoryForm({
  mode,
  initialCategory,
}: AdminCategoryFormProps) {
  const router = useRouter();
  const formId = useId();

  const isEdit = mode === "edit";

  // Form State
  const [name, setName] = useState(initialCategory?.name || "");
  const [slug, setSlug] = useState(initialCategory?.slug || "");
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(isEdit);
  const [description, setDescription] = useState(initialCategory?.description || "");
  const [isActive, setIsActive] = useState(
    initialCategory !== undefined ? initialCategory.isActive : true
  );

  // Validation & Submission States
  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [savedCategory, setSavedCategory] = useState<AdminCategory | null>(null);

  // Unsaved changes confirmation modal
  const [showDiscardModal, setShowDiscardModal] = useState(false);
  const [pendingNavigationUrl, setPendingNavigationUrl] = useState<string | null>(null);

  // Compute dirty state
  const isDirty = React.useMemo(() => {
    if (!isEdit) {
      return Boolean(name.trim() || description.trim() || slug.trim());
    }
    if (!initialCategory) return false;

    return (
      name !== initialCategory.name ||
      slug !== initialCategory.slug ||
      description !== initialCategory.description ||
      isActive !== initialCategory.isActive
    );
  }, [isEdit, initialCategory, name, slug, description, isActive]);

  // Window beforeunload protection
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty && !savedCategory) {
        e.preventDefault();
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty, savedCategory]);

  // Auto-generate slug when name changes in create mode if not manually overridden
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setName(val);
    if (!slugManuallyEdited) {
      setSlug(slugify(val));
    }
    if (errors.name) {
      setErrors((prev) => ({ ...prev, name: undefined }));
    }
  };

  const handleSlugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSlugManuallyEdited(true);
    setSlug(e.target.value);
    if (errors.slug) {
      setErrors((prev) => ({ ...prev, slug: undefined }));
    }
  };

  const handleResetSlug = () => {
    setSlugManuallyEdited(false);
    setSlug(slugify(name));
    if (errors.slug) {
      setErrors((prev) => ({ ...prev, slug: undefined }));
    }
  };

  // Validation logic
  const validate = (): boolean => {
    const newErrors: FormErrors = {};

    // 1. Name validation
    const trimmedName = name.trim();
    if (!trimmedName) {
      newErrors.name = "Category name is required.";
    } else if (trimmedName.length < 2) {
      newErrors.name = "Category name must be at least 2 characters.";
    } else if (trimmedName.length > 80) {
      newErrors.name = "Category name cannot exceed 80 characters.";
    }

    // 2. Slug validation
    const trimmedSlug = slug.trim();
    if (!trimmedSlug) {
      newErrors.slug = "URL slug is required.";
    } else if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(trimmedSlug)) {
      newErrors.slug = "Slug must contain only lowercase letters, numbers, and single hyphens.";
    }

    // Duplicate slug check across catalog
    const allCategories = getAllAdminCategories();
    const isDuplicateSlug = allCategories.some(
      (c) => c.slug === trimmedSlug && c.id !== initialCategory?.id
    );
    if (isDuplicateSlug) {
      newErrors.slug = "This URL slug is already in use by another category.";
    }

    // Duplicate name check
    const isDuplicateName = allCategories.some(
      (c) =>
        c.name.toLowerCase().trim() === trimmedName.toLowerCase() &&
        c.id !== initialCategory?.id
    );
    if (isDuplicateName) {
      newErrors.name = "A category with this name already exists.";
    }

    // 3. Description validation
    if (description.length > 300) {
      newErrors.description = "Description cannot exceed 300 characters.";
    }

    setErrors(newErrors);
    setTouched({
      name: true,
      slug: true,
      description: true,
    });

    return Object.keys(newErrors).length === 0;
  };

  // Handle Submit
  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!validate()) {
      return;
    }

    setIsSubmitting(true);

    setTimeout(() => {
      const now = new Date().toISOString();
      const categoryId = isEdit && initialCategory
        ? initialCategory.id
        : `cat-custom-${Date.now().toString(36)}`;

      const categoryPayload: AdminCategory = {
        id: categoryId,
        name: name.trim(),
        slug: slug.trim(),
        description: description.trim(),
        icon: initialCategory?.icon || "📁",
        isActive,
        createdAt: initialCategory?.createdAt || now,
        updatedAt: now,
      };

      if (isEdit) {
        updateAdminCategory(categoryPayload);
      } else {
        saveAdminCategory(categoryPayload);
      }

      setIsSubmitting(false);
      setSavedCategory(categoryPayload);
    }, 500);
  };

  // Handle Safe Navigation
  const handleProtectedNavigate = (url: string) => {
    if (isDirty && !savedCategory) {
      setPendingNavigationUrl(url);
      setShowDiscardModal(true);
    } else {
      router.push(url);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      {/* Top Breadcrumb & Back Link */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => handleProtectedNavigate("/admin/categories")}
          className="inline-flex items-center gap-2 text-xs font-semibold text-neutral-600 hover:text-neutral-900 transition-colors cursor-pointer"
        >
          <ArrowLeftIcon size={16} />
          <span>Back to Categories</span>
        </button>

        {isEdit && initialCategory && (
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${
                isActive
                  ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                  : "bg-neutral-100 text-neutral-600 border border-neutral-200"
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isActive ? "bg-emerald-500" : "bg-neutral-400"
                }`}
              />
              <span>{isActive ? "Active" : "Inactive"}</span>
            </span>
          </div>
        )}
      </div>

      {/* Page Header */}
      <div>
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-neutral-900">
          {isEdit ? "Edit Category" : "Add Category"}
        </h1>
        <p className="text-xs sm:text-sm text-neutral-500 mt-1">
          {isEdit
            ? "Update category details, URL slug, and storefront visibility settings."
            : "Create a new catalog category for organizing your 3D printed products."}
        </p>
      </div>

      {/* Main Form Card */}
      <form
        onSubmit={handleSubmit}
        className="p-5 sm:p-7 rounded-2xl bg-surface border border-neutral-200/80 shadow-xs space-y-6"
        noValidate
      >
        {/* Category Name */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label
              htmlFor={`${formId}-name`}
              className="text-xs font-bold uppercase tracking-wider text-neutral-700"
            >
              Category Name <span className="text-error">*</span>
            </label>
            <span className="text-[11px] text-neutral-400">
              {name.length}/80 characters
            </span>
          </div>
          <input
            id={`${formId}-name`}
            type="text"
            value={name}
            onChange={handleNameChange}
            placeholder="e.g. Desk Companions"
            maxLength={80}
            aria-invalid={Boolean(errors.name)}
            aria-describedby={errors.name ? `${formId}-name-error` : undefined}
            className={`w-full px-4 py-2.5 rounded-xl border text-sm transition-all focus:outline-none focus:ring-2 focus:ring-primary ${
              errors.name
                ? "border-error bg-red-50/20 text-neutral-900"
                : "border-neutral-200 hover:border-neutral-300 text-neutral-900 bg-white"
            }`}
          />
          {errors.name && (
            <p
              id={`${formId}-name-error`}
              role="alert"
              className="text-xs text-error font-medium flex items-center gap-1 mt-1"
            >
              <span>{errors.name}</span>
            </p>
          )}
        </div>

        {/* URL Slug */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label
              htmlFor={`${formId}-slug`}
              className="text-xs font-bold uppercase tracking-wider text-neutral-700"
            >
              URL Slug <span className="text-error">*</span>
            </label>
            {slugManuallyEdited && (
              <button
                type="button"
                onClick={handleResetSlug}
                className="text-[11px] font-semibold text-primary hover:underline cursor-pointer"
              >
                Reset to auto-generated
              </button>
            )}
          </div>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-400 text-xs font-mono">
              /shop?cat=
            </div>
            <input
              id={`${formId}-slug`}
              type="text"
              value={slug}
              onChange={handleSlugChange}
              placeholder="desk-companions"
              aria-invalid={Boolean(errors.slug)}
              aria-describedby={errors.slug ? `${formId}-slug-error` : undefined}
              className={`w-full pl-24 pr-4 py-2.5 rounded-xl border text-sm font-mono transition-all focus:outline-none focus:ring-2 focus:ring-primary ${
                errors.slug
                  ? "border-error bg-red-50/20 text-neutral-900"
                  : "border-neutral-200 hover:border-neutral-300 text-neutral-900 bg-white"
              }`}
            />
          </div>
          {errors.slug ? (
            <p
              id={`${formId}-slug-error`}
              role="alert"
              className="text-xs text-error font-medium flex items-center gap-1 mt-1"
            >
              <span>{errors.slug}</span>
            </p>
          ) : (
            <p className="text-[11px] text-neutral-500">
              Used in customer URLs for category filtering.
            </p>
          )}
        </div>

        {/* Description */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label
              htmlFor={`${formId}-desc`}
              className="text-xs font-bold uppercase tracking-wider text-neutral-700"
            >
              Description <span className="text-neutral-400 font-normal">(Optional)</span>
            </label>
            <span className="text-[11px] text-neutral-400">
              {description.length}/300
            </span>
          </div>
          <textarea
            id={`${formId}-desc`}
            rows={3}
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
              if (errors.description) {
                setErrors((prev) => ({ ...prev, description: undefined }));
              }
            }}
            placeholder="Briefly describe what creations belong in this category..."
            maxLength={300}
            aria-invalid={Boolean(errors.description)}
            aria-describedby={errors.description ? `${formId}-desc-error` : undefined}
            className={`w-full px-4 py-2.5 rounded-xl border text-sm transition-all focus:outline-none focus:ring-2 focus:ring-primary resize-y ${
              errors.description
                ? "border-error bg-red-50/20 text-neutral-900"
                : "border-neutral-200 hover:border-neutral-300 text-neutral-900 bg-white"
            }`}
          />
          {errors.description && (
            <p
              id={`${formId}-desc-error`}
              role="alert"
              className="text-xs text-error font-medium"
            >
              {errors.description}
            </p>
          )}
        </div>

        {/* Active Status Toggle */}
        <div className="pt-2 border-t border-neutral-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-0.5">
            <label
              htmlFor={`${formId}-active`}
              className="text-sm font-bold text-neutral-900 flex items-center gap-2 cursor-pointer"
            >
              <span>Active Category</span>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  isActive
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-neutral-100 text-neutral-600"
                }`}
              >
                {isActive ? "Visible" : "Hidden"}
              </span>
            </label>
            <p className="text-xs text-neutral-500 max-w-md">
              {isActive
                ? "This category appears in storefront navigation, sidebar filters, and is available for product assignments."
                : "This category is hidden from customer filters. Existing products retain their assignment."}
            </p>
          </div>

          <label
            htmlFor={`${formId}-active`}
            className="relative inline-flex items-center cursor-pointer select-none"
          >
            <input
              id={`${formId}-active`}
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-neutral-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary" />
          </label>
        </div>

        {/* Action Buttons */}
        <div className="pt-4 border-t border-neutral-100 flex flex-col sm:flex-row items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => handleProtectedNavigate("/admin/categories")}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-neutral-200 hover:bg-neutral-100 text-xs sm:text-sm font-semibold text-neutral-700 transition-colors cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-primary hover:bg-[#91BC7A] text-neutral-900 transition-all shadow-xs disabled:opacity-60 cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <span className="w-4 h-4 border-2 border-neutral-900 border-t-transparent rounded-full animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <span>{isEdit ? "Save Changes" : "Save Category"}</span>
            )}
          </button>
        </div>
      </form>

      {/* Discard Changes Modal */}
      {showDiscardModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="discard-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/50 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div className="w-full max-w-md bg-surface rounded-2xl p-6 border border-neutral-200 shadow-xl space-y-4">
            <h3
              id="discard-modal-title"
              className="text-lg font-bold text-neutral-900"
            >
              Discard Changes?
            </h3>
            <p className="text-sm text-neutral-600 leading-relaxed">
              You have unsaved changes to this category. Are you sure you want to leave?
            </p>
            <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowDiscardModal(false)}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-neutral-200 hover:bg-neutral-100 text-xs sm:text-sm font-semibold text-neutral-700 cursor-pointer"
              >
                Keep Editing
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowDiscardModal(false);
                  if (pendingNavigationUrl) {
                    router.push(pendingNavigationUrl);
                  }
                }}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-error hover:bg-red-700 text-white text-xs sm:text-sm font-bold transition-all cursor-pointer"
              >
                Discard Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Save Success Modal */}
      {savedCategory && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="success-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/50 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div className="w-full max-w-md bg-surface rounded-2xl p-6 border border-neutral-200 shadow-xl text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 mx-auto flex items-center justify-center">
              <CheckCircleIcon size={24} />
            </div>
            <div>
              <h3
                id="success-modal-title"
                className="text-lg font-bold text-neutral-900"
              >
                {isEdit
                  ? "Category updated in preview mode"
                  : "Category created in preview mode"}
              </h3>
              <p className="text-xs text-neutral-500 mt-1">
                &ldquo;{savedCategory.name}&rdquo; is now registered in the local admin session.
              </p>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <button
                type="button"
                onClick={() => router.push("/admin/categories")}
                className="w-full py-2.5 px-4 rounded-xl bg-primary hover:bg-[#91BC7A] text-neutral-900 text-xs sm:text-sm font-bold transition-all cursor-pointer"
              >
                Back to Categories
              </button>
              <button
                type="button"
                onClick={() => setSavedCategory(null)}
                className="w-full py-2.5 px-4 rounded-xl border border-neutral-200 hover:bg-neutral-100 text-neutral-700 text-xs sm:text-sm font-semibold transition-all cursor-pointer"
              >
                Continue Editing
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
