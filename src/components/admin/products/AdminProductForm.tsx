"use client";

import React, { useState, useMemo, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  SAMPLE_CATEGORIES,
  type SampleProduct,
  type SampleProductVariant,
} from "@/data/sample-products";
import { saveAdminProductEdit } from "@/lib/admin-catalog";
import { getAllAdminCategories } from "@/lib/admin-categories";
import {
  ArrowLeftIcon,
  CheckCircleIcon,
  AlertCircleIcon,
  ShieldCheckIcon,
  SparklesIcon,
  PackageIcon,
  XIcon,
  ExternalLinkIcon,
} from "../AdminIcons";
import {
  AdminProductImageUpload,
  type ProductImageItem,
} from "./AdminProductImageUpload";
import { AdminProductVariants } from "./AdminProductVariants";
import { AdminProductSummary } from "./AdminProductSummary";

export interface AdminProductFormProps {
  mode?: "create" | "edit";
  initialProduct?: SampleProduct | null;
}

interface FormErrors {
  title?: string;
  slug?: string;
  description?: string;
  price?: string;
  compareAtPrice?: string;
  stockQuantity?: string;
  category?: string;
  sku?: string;
  images?: string;
}

const COMMON_FILAMENTS = [
  "Eco-Friendly PLA Bioplastic",
  "Silk Metallic PLA Bioplastic",
  "PETG High-Strength Polymer",
  "UV Tough Photopolymer Resin",
  "Recycled Matte PLA",
  "Wood-Filled Specialty PLA",
];

const COMMON_FINISHES = [
  "High-Resolution Layer Finish",
  "Rich Metallic Gold Finish",
  "Smooth Matte Finish",
  "Ultra-Detailed 0.12mm Layers",
  "Satin Gloss Finish",
  "Hand-Detailed Acrylic Accent",
];

/**
 * AdminProductForm — Reusable product creation and editing interface for Dearr V1 Founder Operations.
 *
 * Supports:
 * - mode="create": blank product initialization and local catalog registration
 * - mode="edit": pre-populated product editing with diff-tracking and session override persistence
 * - Real-time dirty state tracking with unsaved changes modal & beforeunload protection
 * - Dynamic Title -> URL slug generation with manual override lock
 * - Image gallery manager with cover badge, reordering, and Existing vs New badge tracking
 * - INR pricing with live discount percentage and customer savings calculation
 * - Inventory tracking, SKU validation, and stock level badge logic
 * - 3D Printing Workshop technical specifications (Filament, Color, Finish, Dimensions, Care)
 * - Active / Inactive catalog visibility & Featured storefront toggles
 * - Multi-variant options configuration
 * - Real-time sticky Live Product Summary preview
 * - Robust client-side validation and simulated QA error path with non-destructive retry
 */
export function AdminProductForm({
  mode = "create",
  initialProduct = null,
}: AdminProductFormProps) {
  const router = useRouter();
  const isEdit = mode === "edit" && initialProduct !== null;

  // Initial images mapping
  const initialImages: ProductImageItem[] = useMemo(() => {
    if (!initialProduct) return [];
    if (initialProduct.images && initialProduct.images.length > 0) {
      return initialProduct.images.map((url, idx) => ({
        id: `img-exist-${idx}`,
        url,
        name: `${initialProduct.name} - Photo ${idx + 1}`,
        isPrimary: url === initialProduct.image || idx === 0,
        isExisting: true,
      }));
    }
    if (initialProduct.image) {
      return [
        {
          id: "img-exist-0",
          url: initialProduct.image,
          name: initialProduct.name,
          isPrimary: true,
          isExisting: true,
        },
      ];
    }
    return [];
  }, [initialProduct]);

  // Form State
  const [title, setTitle] = useState(initialProduct?.name || "");
  const [slug, setSlug] = useState(initialProduct?.slug || "");
  const [isSlugCustomized, setIsSlugCustomized] = useState(isEdit);
  const [description, setDescription] = useState(initialProduct?.description || "");
  const [category, setCategory] = useState(
    initialProduct?.category || SAMPLE_CATEGORIES[0]?.name || "Spiritual Idols"
  );
  const [categoriesList, setCategoriesList] = useState(SAMPLE_CATEGORIES);

  useEffect(() => {
    const adminCats = getAllAdminCategories().filter((c) => c.isActive);
    if (adminCats.length > 0) {
      setCategoriesList(adminCats as any);
    }
  }, []);

  // Pricing State
  const [price, setPrice] = useState<string>(
    initialProduct ? String(initialProduct.price) : ""
  );
  const [compareAtPrice, setCompareAtPrice] = useState<string>(
    initialProduct?.compareAtPrice ? String(initialProduct.compareAtPrice) : ""
  );

  // Inventory State
  const [stockQuantity, setStockQuantity] = useState<string>(
    initialProduct ? String(initialProduct.stockQuantity) : "10"
  );
  const [sku, setSku] = useState(
    initialProduct?.variants?.[0]?.sku ||
      (initialProduct ? `DEAR-${initialProduct.id.toUpperCase()}` : "")
  );

  // Specifications State
  const defaultMaterial = initialProduct?.specifications?.material || "Eco-Friendly PLA Bioplastic";
  const isCustomMaterial = !COMMON_FILAMENTS.includes(defaultMaterial);
  const [material, setMaterial] = useState(
    isCustomMaterial ? "Other (Custom)" : defaultMaterial
  );
  const [customMaterial, setCustomMaterial] = useState(
    isCustomMaterial ? defaultMaterial : ""
  );
  const [color, setColor] = useState("Sky Blue");
  const [finish, setFinish] = useState(
    initialProduct?.specifications?.finish || "High-Resolution Layer Finish"
  );
  const [dimensions, setDimensions] = useState(
    initialProduct?.specifications?.dimensions || "12.5 cm (H) × 7.0 cm (W)"
  );
  const [care, setCare] = useState(
    initialProduct?.specifications?.care ||
      "Wipe with a soft, dry cloth. Keep away from extreme heat (>50°C)."
  );

  // Publishing State
  const [isActive, setIsActive] = useState(
    initialProduct ? initialProduct.isActive : true
  );
  const [isFeatured, setIsFeatured] = useState(
    initialProduct ? initialProduct.isFeatured : false
  );

  // Images & Variants State
  const [images, setImages] = useState<ProductImageItem[]>(initialImages);
  const [variants, setVariants] = useState<SampleProductVariant[]>(
    initialProduct?.variants || []
  );

  // UI Control States
  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDiscardModal, setShowDiscardModal] = useState(false);
  const [savedProduct, setSavedProduct] = useState<SampleProduct | null>(null);

  // QA Error Simulation State
  const [simulateSaveError, setSimulateSaveError] = useState(false);
  const [saveErrorMessage, setSaveErrorMessage] = useState<string | null>(null);

  // Helper to slugify titles safely
  const slugify = (text: string) => {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, "") // remove non-alphanumeric except spaces and hyphens
      .replace(/[\s_-]+/g, "-") // replace spaces and underscores with single hyphen
      .replace(/^-+|-+$/g, ""); // trim leading/trailing hyphens
  };

  // Handle Title Change with auto-slug generation
  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTitle = e.target.value;
    setTitle(newTitle);
    if (!isSlugCustomized) {
      setSlug(slugify(newTitle));
    }
  };

  // Handle Slug Manual Edit
  const handleSlugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setIsSlugCustomized(true);
    setSlug(slugify(e.target.value));
  };

  const handleResetSlug = () => {
    setIsSlugCustomized(false);
    setSlug(slugify(title));
  };

  // Mark field as touched for visible inline validation
  const handleBlur = (field: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    validateField(field);
  };

  // Thorough Dirty State Detection
  const isDirty = useMemo(() => {
    if (mode === "create") {
      return (
        title.trim() !== "" ||
        description.trim() !== "" ||
        price.trim() !== "" ||
        compareAtPrice.trim() !== "" ||
        images.length > 0 ||
        variants.length > 0 ||
        sku.trim() !== "" ||
        stockQuantity !== "10"
      );
    }

    if (!initialProduct) return false;

    const origPrice = String(initialProduct.price);
    const origCompare = initialProduct.compareAtPrice ? String(initialProduct.compareAtPrice) : "";
    const origStock = String(initialProduct.stockQuantity);
    const origSku = initialProduct.variants?.[0]?.sku || `DEAR-${initialProduct.id.toUpperCase()}`;
    const origMat = initialProduct.specifications?.material || "Eco-Friendly PLA Bioplastic";
    const origFinish = initialProduct.specifications?.finish || "High-Resolution Layer Finish";
    const origDim = initialProduct.specifications?.dimensions || "12.5 cm (H) × 7.0 cm (W)";
    const origCare = initialProduct.specifications?.care || "Wipe with a soft, dry cloth. Keep away from extreme heat (>50°C).";
    const currentMat = material === "Other (Custom)" ? customMaterial : material;

    return (
      title.trim() !== initialProduct.name ||
      slug.trim() !== initialProduct.slug ||
      description.trim() !== initialProduct.description ||
      category !== initialProduct.category ||
      price.trim() !== origPrice ||
      compareAtPrice.trim() !== origCompare ||
      stockQuantity.trim() !== origStock ||
      (sku.trim() !== "" && sku.trim() !== origSku) ||
      currentMat !== origMat ||
      finish !== origFinish ||
      dimensions.trim() !== origDim ||
      care.trim() !== origCare ||
      isActive !== initialProduct.isActive ||
      isFeatured !== initialProduct.isFeatured ||
      images.length !== initialImages.length ||
      images.some(
        (img, idx) =>
          img.url !== initialImages[idx]?.url ||
          img.isPrimary !== initialImages[idx]?.isPrimary
      ) ||
      variants.length !== (initialProduct.variants?.length || 0)
    );
  }, [
    mode,
    initialProduct,
    title,
    slug,
    description,
    category,
    price,
    compareAtPrice,
    stockQuantity,
    sku,
    material,
    customMaterial,
    finish,
    dimensions,
    care,
    isActive,
    isFeatured,
    images,
    initialImages,
    variants,
  ]);

  // Browser exit protection when form is dirty
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  // Validation logic
  const validateField = (field: string): boolean => {
    const newErrors = { ...errors };

    if (field === "title") {
      if (!title.trim()) {
        newErrors.title = "Product title is required.";
      } else if (title.trim().length < 3) {
        newErrors.title = "Title must be at least 3 characters.";
      } else if (title.length > 150) {
        newErrors.title = "Title cannot exceed 150 characters.";
      } else {
        delete newErrors.title;
      }
    }

    if (field === "slug") {
      if (!slug.trim()) {
        newErrors.slug = "URL slug is required.";
      } else {
        delete newErrors.slug;
      }
    }

    if (field === "description") {
      if (!description.trim()) {
        newErrors.description = "Product description is required.";
      } else if (description.trim().length < 10) {
        newErrors.description = "Description should be at least 10 characters.";
      } else {
        delete newErrors.description;
      }
    }

    if (field === "price") {
      const num = parseFloat(price);
      if (!price.trim()) {
        newErrors.price = "Selling price is required.";
      } else if (isNaN(num) || num <= 0) {
        newErrors.price = "Price must be a positive number greater than 0.";
      } else {
        delete newErrors.price;
      }
    }

    if (field === "compareAtPrice" && compareAtPrice.trim()) {
      const numComp = parseFloat(compareAtPrice);
      const numPrice = parseFloat(price);
      if (isNaN(numComp) || numComp < 0) {
        newErrors.compareAtPrice = "Compare-at price cannot be negative.";
      } else if (!isNaN(numPrice) && numComp <= numPrice) {
        newErrors.compareAtPrice =
          "Compare-at price must be higher than selling price to offer a discount.";
      } else {
        delete newErrors.compareAtPrice;
      }
    } else if (field === "compareAtPrice" && !compareAtPrice.trim()) {
      delete newErrors.compareAtPrice;
    }

    if (field === "stockQuantity") {
      const stock = parseInt(stockQuantity, 10);
      if (stockQuantity.trim() === "" || isNaN(stock) || stock < 0) {
        newErrors.stockQuantity = "Stock quantity must be 0 or greater.";
      } else {
        delete newErrors.stockQuantity;
      }
    }

    if (field === "category") {
      if (!category) {
        newErrors.category = "Please select a catalog category.";
      } else {
        delete newErrors.category;
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateAll = (): boolean => {
    const newErrors: FormErrors = {};

    if (!title.trim()) {
      newErrors.title = "Product title is required.";
    } else if (title.trim().length < 3) {
      newErrors.title = "Title must be at least 3 characters.";
    }

    if (!slug.trim()) {
      newErrors.slug = "URL slug is required.";
    }

    if (!description.trim()) {
      newErrors.description = "Product description is required.";
    } else if (description.trim().length < 10) {
      newErrors.description = "Description should be at least 10 characters.";
    }

    const numPrice = parseFloat(price);
    if (!price.trim()) {
      newErrors.price = "Selling price is required.";
    } else if (isNaN(numPrice) || numPrice <= 0) {
      newErrors.price = "Price must be a positive number greater than 0.";
    }

    if (compareAtPrice.trim()) {
      const numComp = parseFloat(compareAtPrice);
      if (isNaN(numComp) || numComp < 0) {
        newErrors.compareAtPrice = "Compare-at price cannot be negative.";
      } else if (!isNaN(numPrice) && numComp <= numPrice) {
        newErrors.compareAtPrice =
          "Compare-at price must be higher than selling price to offer a discount.";
      }
    }

    const stock = parseInt(stockQuantity, 10);
    if (stockQuantity.trim() === "" || isNaN(stock) || stock < 0) {
      newErrors.stockQuantity = "Stock quantity must be 0 or greater.";
    }

    if (!category) {
      newErrors.category = "Please select a catalog category.";
    }

    setErrors(newErrors);
    setTouched({
      title: true,
      slug: true,
      description: true,
      price: true,
      compareAtPrice: true,
      stockQuantity: true,
      category: true,
    });

    return Object.keys(newErrors).length === 0;
  };

  // Form submission handler
  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSaveErrorMessage(null);

    if (!validateAll()) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    setIsSubmitting(true);

    setTimeout(() => {
      // Check QA Error simulation path
      if (simulateSaveError) {
        setIsSubmitting(false);
        setSaveErrorMessage(
          "Unable to save changes in preview mode. Please try again."
        );
        return;
      }

      const parsedPrice = parseFloat(price);
      const parsedCompareAt = compareAtPrice.trim() ? parseFloat(compareAtPrice) : null;
      const parsedStock = parseInt(stockQuantity, 10) || 0;
      const categorySlug =
        categoriesList.find((c) => c.name === category)?.slug ||
        SAMPLE_CATEGORIES.find((c) => c.name === category)?.slug ||
        slugify(category);

      const primaryImg =
        images.find((i) => i.isPrimary)?.url ||
        images[0]?.url ||
        "/product-samples/1.jpeg";

      const productId =
        isEdit && initialProduct
          ? initialProduct.id
          : `sp-new-${Date.now().toString(36)}`;

      const productPayload: SampleProduct = {
        id: productId,
        name: title.trim(),
        slug: slug.trim(),
        description: description.trim(),
        price: parsedPrice,
        compareAtPrice: parsedCompareAt,
        image: primaryImg,
        images: images.map((img) => img.url),
        category: category,
        categorySlug: categorySlug,
        isFeatured: isFeatured,
        isPopular: initialProduct ? initialProduct.isPopular : false,
        isActive: isActive,
        stockQuantity: parsedStock,
        specifications: {
          material: material === "Other (Custom)" ? customMaterial : material,
          dimensions: dimensions.trim() || undefined,
          finish: finish.trim() || undefined,
          care: care.trim() || undefined,
          process:
            initialProduct?.specifications?.process ||
            "High-Resolution FDM 3D Printing",
        },
        variants: variants.length > 0 ? variants : undefined,
      };

      if (isEdit) {
        // Persist edits to session storage override
        saveAdminProductEdit(productPayload);
      } else {
        // Prepend new product to session storage list
        try {
          const stored = sessionStorage.getItem("dearr_admin_new_products");
          const list = stored ? JSON.parse(stored) : [];
          list.unshift(productPayload);
          sessionStorage.setItem("dearr_admin_new_products", JSON.stringify(list));
        } catch {
          // ignore storage quota issues
        }
      }

      setIsSubmitting(false);
      setSavedProduct(productPayload);
    }, 600);
  };

  // Reset form to blank state for "Create Another" in create mode
  const handleResetForm = () => {
    setTitle("");
    setSlug("");
    setIsSlugCustomized(false);
    setDescription("");
    setPrice("");
    setCompareAtPrice("");
    setStockQuantity("10");
    setSku("");
    setImages([]);
    setVariants([]);
    setIsActive(true);
    setIsFeatured(false);
    setErrors({});
    setTouched({});
    setSavedProduct(null);
  };

  // Handle Cancel / Back Navigation
  const handleCancelClick = () => {
    if (isDirty) {
      setShowDiscardModal(true);
    } else {
      router.push("/admin/products");
    }
  };

  const primaryImage =
    images.find((i) => i.isPrimary)?.url || images[0]?.url || null;

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-16">
      {/* ====================================================================
          1. OPERATIONAL TOP BAR & BREADCRUMB NAVIGATION
          ==================================================================== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-neutral-200/80">
        <div className="space-y-1">
          <button
            type="button"
            onClick={handleCancelClick}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-neutral-500 hover:text-neutral-900 transition-colors cursor-pointer group"
          >
            <ArrowLeftIcon
              size={14}
              className="group-hover:-translate-x-0.5 transition-transform"
            />
            <span>Back to Products</span>
          </button>

          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-neutral-900">
              {isEdit ? "Edit Product" : "Add Product"}
            </h1>

            {/* In Edit mode: show current status & stock badges near heading */}
            {isEdit ? (
              <div className="flex items-center gap-1.5 ml-1">
                {/* Active Badge */}
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                    isActive
                      ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                      : "bg-neutral-100 text-neutral-500 border-neutral-200"
                  }`}
                >
                  {isActive ? "Active" : "Inactive"}
                </span>

                {/* Stock Badge */}
                {(parseInt(stockQuantity, 10) || 0) <= 0 ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-700 border border-red-200">
                    Out of Stock
                  </span>
                ) : (parseInt(stockQuantity, 10) || 0) <= 5 ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-900 border border-amber-200">
                    Low Stock ({stockQuantity})
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                    In Stock ({stockQuantity})
                  </span>
                )}
              </div>
            ) : (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-900 border border-amber-200">
                Preview Mode
              </span>
            )}
          </div>

          <p className="text-xs sm:text-sm text-neutral-500">
            {isEdit
              ? "Update product details, pricing, inventory, and storefront settings."
              : "Create a new 3D printed product for the Dearr catalog."}
          </p>
        </div>

        {/* Top Action Buttons */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handleCancelClick}
            className="px-4 py-2.5 rounded-xl border border-neutral-300 hover:bg-neutral-100 text-xs sm:text-sm font-bold text-neutral-700 transition-all cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={() => handleSubmit()}
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm tracking-wide text-neutral-900 bg-primary hover:bg-[#91BC7A] active:scale-98 transition-all shadow-xs focus-visible:outline-2 focus-visible:outline-neutral-900 disabled:opacity-50 cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <span className="w-4 h-4 rounded-full border-2 border-neutral-900 border-t-transparent animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <CheckCircleIcon size={16} />
                <span>{isEdit ? "Save Changes" : "Save Product"}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Simulated Save Error Alert (Section 17 requirement) */}
      {saveErrorMessage && (
        <div
          role="alert"
          className="p-4 rounded-2xl bg-red-50 border border-red-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in duration-150"
        >
          <div className="flex items-center gap-2.5 text-xs text-red-800 font-medium">
            <AlertCircleIcon size={18} className="text-red-600 shrink-0" />
            <span>{saveErrorMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => {
              setSimulateSaveError(false);
              handleSubmit();
            }}
            className="inline-flex items-center justify-center px-3.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-colors cursor-pointer shrink-0"
          >
            Try Again
          </button>
        </div>
      )}

      {/* ====================================================================
          2. TWO-COLUMN LAYOUT (FORM ~65%, STICKY SUMMARY ~35%)
          ==================================================================== */}
      <form
        onSubmit={handleSubmit}
        noValidate
        className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start"
      >
        {/* Left Column: Form Sections (8 Cols) */}
        <div className="lg:col-span-8 space-y-6">
          {/* Section 1: Product Information */}
          <div className="bg-surface rounded-2xl border border-neutral-200/90 shadow-xs p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
              <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-800">
                1. Product Information
              </h2>
              <span className="text-[10px] text-neutral-400 font-medium">
                Core Catalog Metadata
              </span>
            </div>

            {/* Title Field */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="product-title"
                  className="block text-xs font-bold text-neutral-700"
                >
                  Product Title <span className="text-error">*</span>
                </label>
                <span className="text-[10px] text-neutral-400">
                  {title.length} / 150 characters
                </span>
              </div>
              <input
                id="product-title"
                type="text"
                maxLength={150}
                value={title}
                onChange={handleTitleChange}
                onBlur={() => handleBlur("title")}
                placeholder="e.g. 3D Printed Radha Krishna Figurine (12.5 cm)"
                aria-invalid={!!errors.title && touched.title}
                aria-describedby={errors.title && touched.title ? "title-error" : undefined}
                className={`w-full px-3.5 py-2.5 rounded-xl border text-sm text-neutral-900 placeholder:text-neutral-400 bg-white transition-all focus:outline-none focus:ring-2 ${
                  errors.title && touched.title
                    ? "border-error focus:ring-error/20"
                    : "border-neutral-300 focus:border-primary focus:ring-primary/20"
                }`}
              />
              {errors.title && touched.title && (
                <p id="title-error" role="alert" className="text-xs text-error font-medium">
                  {errors.title}
                </p>
              )}
            </div>

            {/* Slug Field */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="product-slug"
                  className="block text-xs font-bold text-neutral-700"
                >
                  Product URL Slug <span className="text-error">*</span>
                </label>
                {isSlugCustomized && (
                  <button
                    type="button"
                    onClick={handleResetSlug}
                    className="text-[11px] font-semibold text-neutral-500 hover:text-neutral-900 hover:underline cursor-pointer"
                  >
                    Reset to auto-generated
                  </button>
                )}
              </div>
              <div className="flex items-center rounded-xl border border-neutral-300 bg-neutral-50 overflow-hidden focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
                <span className="px-3 text-xs font-medium text-neutral-500 select-none border-r border-neutral-200">
                  dearr.in/product/
                </span>
                <input
                  id="product-slug"
                  type="text"
                  value={slug}
                  onChange={handleSlugChange}
                  onBlur={() => handleBlur("slug")}
                  placeholder="3d-printed-radha-krishna-figurine"
                  aria-invalid={!!errors.slug && touched.slug}
                  aria-describedby={errors.slug && touched.slug ? "slug-error" : undefined}
                  className="w-full px-3 py-2.5 text-xs font-mono text-neutral-800 bg-transparent focus:outline-none"
                />
              </div>
              <p className="text-[11px] text-neutral-400">
                Lowercase, URL-safe slug. Auto-updated from title unless manually edited.
              </p>
              {errors.slug && touched.slug && (
                <p id="slug-error" role="alert" className="text-xs text-error font-medium">
                  {errors.slug}
                </p>
              )}
            </div>

            {/* Description Field */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="product-description"
                  className="block text-xs font-bold text-neutral-700"
                >
                  Product Description <span className="text-error">*</span>
                </label>
                <span className="text-[10px] text-neutral-400">
                  {description.length} / 1000 characters
                </span>
              </div>
              <textarea
                id="product-description"
                rows={4}
                maxLength={1000}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onBlur={() => handleBlur("description")}
                placeholder="Describe the 3D printed model, print craftsmanship, aesthetic details, and recommended setting (altar, desk, living space)..."
                aria-invalid={!!errors.description && touched.description}
                aria-describedby={
                  errors.description && touched.description ? "desc-error" : undefined
                }
                className={`w-full px-3.5 py-2.5 rounded-xl border text-sm text-neutral-900 placeholder:text-neutral-400 bg-white transition-all focus:outline-none focus:ring-2 ${
                  errors.description && touched.description
                    ? "border-error focus:ring-error/20"
                    : "border-neutral-300 focus:border-primary focus:ring-primary/20"
                }`}
              />
              {errors.description && touched.description && (
                <p id="desc-error" role="alert" className="text-xs text-error font-medium">
                  {errors.description}
                </p>
              )}
            </div>
          </div>

          {/* Section 2: Product Images */}
          <div className="bg-surface rounded-2xl border border-neutral-200/90 shadow-xs p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
              <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-800">
                2. Visual Gallery
              </h2>
              <span className="text-[10px] text-neutral-400 font-medium">
                {isEdit ? "Manage Existing & New Images" : "Local Object Previews"}
              </span>
            </div>

            <AdminProductImageUpload
              images={images}
              onChange={(updated) => setImages(updated)}
              error={errors.images}
            />
          </div>

          {/* Section 3: Pricing & Margins */}
          <div className="bg-surface rounded-2xl border border-neutral-200/90 shadow-xs p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
              <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-800">
                3. Pricing &amp; Margins
              </h2>
              <span className="text-[10px] text-neutral-400 font-medium">
                INR (₹) Currency Presentation
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Selling Price */}
              <div className="space-y-1.5">
                <label
                  htmlFor="product-price"
                  className="block text-xs font-bold text-neutral-700"
                >
                  Selling Price (₹) <span className="text-error">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 font-bold text-sm">
                    ₹
                  </span>
                  <input
                    id="product-price"
                    type="number"
                    min="0"
                    step="1"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    onBlur={() => handleBlur("price")}
                    placeholder="799"
                    aria-invalid={!!errors.price && touched.price}
                    aria-describedby={errors.price && touched.price ? "price-error" : undefined}
                    className={`w-full pl-8 pr-3.5 py-2.5 rounded-xl border text-sm font-bold text-neutral-900 placeholder:text-neutral-400 bg-white transition-all focus:outline-none focus:ring-2 ${
                      errors.price && touched.price
                        ? "border-error focus:ring-error/20"
                        : "border-neutral-300 focus:border-primary focus:ring-primary/20"
                    }`}
                  />
                </div>
                {errors.price && touched.price && (
                  <p id="price-error" role="alert" className="text-xs text-error font-medium">
                    {errors.price}
                  </p>
                )}
              </div>

              {/* Compare-at Price */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="product-compare-at"
                    className="block text-xs font-bold text-neutral-700"
                  >
                    Compare-at Price (₹)
                  </label>
                  <span className="text-[10px] text-neutral-400">Optional reference</span>
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 font-bold text-sm">
                    ₹
                  </span>
                  <input
                    id="product-compare-at"
                    type="number"
                    min="0"
                    step="1"
                    value={compareAtPrice}
                    onChange={(e) => setCompareAtPrice(e.target.value)}
                    onBlur={() => handleBlur("compareAtPrice")}
                    placeholder="999"
                    aria-invalid={!!errors.compareAtPrice && touched.compareAtPrice}
                    aria-describedby={
                      errors.compareAtPrice && touched.compareAtPrice
                        ? "compare-at-error"
                        : undefined
                    }
                    className={`w-full pl-8 pr-3.5 py-2.5 rounded-xl border text-sm font-medium text-neutral-800 placeholder:text-neutral-400 bg-white transition-all focus:outline-none focus:ring-2 ${
                      errors.compareAtPrice && touched.compareAtPrice
                        ? "border-error focus:ring-error/20"
                        : "border-neutral-300 focus:border-primary focus:ring-primary/20"
                    }`}
                  />
                </div>
                {errors.compareAtPrice && touched.compareAtPrice && (
                  <p
                    id="compare-at-error"
                    role="alert"
                    className="text-xs text-error font-medium"
                  >
                    {errors.compareAtPrice}
                  </p>
                )}
              </div>
            </div>

            {/* Discount calculation preview strip */}
            {parseFloat(price) > 0 &&
              parseFloat(compareAtPrice) > parseFloat(price) && (
                <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900">
                  <div className="flex items-center gap-2">
                    <SparklesIcon size={16} className="text-emerald-700" />
                    <span>
                      Customer savings:{" "}
                      <strong>
                        ₹
                        {(
                          parseFloat(compareAtPrice) - parseFloat(price)
                        ).toLocaleString("en-IN")}
                      </strong>
                    </span>
                  </div>
                  <span className="px-2 py-0.5 rounded-md text-[11px] font-extrabold bg-emerald-200 text-emerald-900">
                    {Math.round(
                      ((parseFloat(compareAtPrice) - parseFloat(price)) /
                        parseFloat(compareAtPrice)) *
                        100
                    )}
                    % OFF
                  </span>
                </div>
              )}
          </div>

          {/* Section 4: Inventory & Stock */}
          <div className="bg-surface rounded-2xl border border-neutral-200/90 shadow-xs p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
              <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-800">
                4. Inventory &amp; Stock
              </h2>
              <span className="text-[10px] text-neutral-400 font-medium">
                Physical Workshop Units
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Stock Quantity */}
              <div className="space-y-1.5">
                <label
                  htmlFor="product-stock"
                  className="block text-xs font-bold text-neutral-700"
                >
                  Stock Quantity <span className="text-error">*</span>
                </label>
                <input
                  id="product-stock"
                  type="number"
                  min="0"
                  step="1"
                  value={stockQuantity}
                  onChange={(e) => setStockQuantity(e.target.value)}
                  onBlur={() => handleBlur("stockQuantity")}
                  placeholder="10"
                  aria-invalid={!!errors.stockQuantity && touched.stockQuantity}
                  aria-describedby={
                    errors.stockQuantity && touched.stockQuantity ? "stock-error" : undefined
                  }
                  className={`w-full px-3.5 py-2.5 rounded-xl border text-sm font-bold text-neutral-900 bg-white transition-all focus:outline-none focus:ring-2 ${
                    errors.stockQuantity && touched.stockQuantity
                      ? "border-error focus:ring-error/20"
                      : "border-neutral-300 focus:border-primary focus:ring-primary/20"
                  }`}
                />
                {errors.stockQuantity && touched.stockQuantity && (
                  <p id="stock-error" role="alert" className="text-xs text-error font-medium">
                    {errors.stockQuantity}
                  </p>
                )}
              </div>

              {/* SKU Field */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="product-sku"
                    className="block text-xs font-bold text-neutral-700"
                  >
                    SKU Identifier
                  </label>
                  <span className="text-[10px] text-neutral-400">Optional internal code</span>
                </div>
                <input
                  id="product-sku"
                  type="text"
                  value={sku}
                  onChange={(e) => setSku(e.target.value.toUpperCase())}
                  placeholder="DEAR-SP-014"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-sm font-mono text-neutral-900 uppercase bg-white transition-all focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
                <p className="text-[11px] text-neutral-400">
                  Standard format: e.g. DEAR-CAT-001. Uppercase sanitized.
                </p>
              </div>
            </div>

            {/* Live Stock Level Preview Indicator */}
            <div className="p-3 rounded-xl bg-neutral-50 border border-neutral-200/80 flex items-center justify-between text-xs">
              <span className="text-neutral-600 font-medium">
                Operational Stock Status:
              </span>
              <div>
                {(parseInt(stockQuantity, 10) || 0) <= 0 ? (
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-red-50 text-red-700 border border-red-200">
                    Out of Stock (0 units)
                  </span>
                ) : (parseInt(stockQuantity, 10) || 0) <= 5 ? (
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-900 border border-amber-200">
                    Low Stock ({stockQuantity} units)
                  </span>
                ) : (
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                    In Stock ({stockQuantity} units)
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Section 5: Category & Classification */}
          <div className="bg-surface rounded-2xl border border-neutral-200/90 shadow-xs p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
              <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-800">
                5. Category &amp; Taxonomy
              </h2>
              <span className="text-[10px] text-neutral-400 font-medium">
                Derived from Local Catalog
              </span>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="product-category"
                className="block text-xs font-bold text-neutral-700"
              >
                Catalog Category <span className="text-error">*</span>
              </label>
              <select
                id="product-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                onBlur={() => handleBlur("category")}
                className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-sm font-semibold text-neutral-900 bg-white focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              >
                {categoriesList.map((cat) => (
                  <option key={cat.id} value={cat.name}>
                    {cat.icon || "📁"} {cat.name}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-neutral-400">
                Categorizing this item automatically links it to the storefront catalog filter tabs.
              </p>
            </div>
          </div>

          {/* Section 6: 3D Printing Specifications */}
          <div className="bg-surface rounded-2xl border border-neutral-200/90 shadow-xs p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-800">
                  6. 3D Workshop Specifications
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/20 text-neutral-900 border border-primary/30">
                  Dearr Core
                </span>
              </div>
              <span className="text-[10px] text-neutral-400 font-medium">
                Materials &amp; Print Finish
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Material / Filament */}
              <div className="space-y-1.5">
                <label
                  htmlFor="spec-material"
                  className="block text-xs font-bold text-neutral-700"
                >
                  Material / Filament
                </label>
                <select
                  id="spec-material"
                  value={material}
                  onChange={(e) => setMaterial(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-xs sm:text-sm text-neutral-900 bg-white focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                >
                  {COMMON_FILAMENTS.map((fil) => (
                    <option key={fil} value={fil}>
                      {fil}
                    </option>
                  ))}
                  <option value="Other (Custom)">Other (Custom Filament)...</option>
                </select>
                {material === "Other (Custom)" && (
                  <input
                    type="text"
                    value={customMaterial}
                    onChange={(e) => setCustomMaterial(e.target.value)}
                    placeholder="Enter custom filament specification..."
                    className="w-full mt-2 px-3 py-2 rounded-xl border border-neutral-300 text-xs text-neutral-900 bg-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  />
                )}
              </div>

              {/* Color */}
              <div className="space-y-1.5">
                <label
                  htmlFor="spec-color"
                  className="block text-xs font-bold text-neutral-700"
                >
                  Primary Colorway
                </label>
                <input
                  id="spec-color"
                  type="text"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  placeholder="e.g. Sky Blue, Metallic Gold, Matte Black"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-xs sm:text-sm text-neutral-900 bg-white focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>

              {/* Print Finish */}
              <div className="space-y-1.5">
                <label
                  htmlFor="spec-finish"
                  className="block text-xs font-bold text-neutral-700"
                >
                  Print Finish Style
                </label>
                <select
                  id="spec-finish"
                  value={finish}
                  onChange={(e) => setFinish(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-xs sm:text-sm text-neutral-900 bg-white focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                >
                  {COMMON_FINISHES.map((fin) => (
                    <option key={fin} value={fin}>
                      {fin}
                    </option>
                  ))}
                </select>
              </div>

              {/* Physical Dimensions */}
              <div className="space-y-1.5">
                <label
                  htmlFor="spec-dimensions"
                  className="block text-xs font-bold text-neutral-700"
                >
                  Model Dimensions
                </label>
                <input
                  id="spec-dimensions"
                  type="text"
                  value={dimensions}
                  onChange={(e) => setDimensions(e.target.value)}
                  placeholder="e.g. 12.5 cm (H) × 7.0 cm (W)"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-xs sm:text-sm text-neutral-900 bg-white focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>

            {/* Care Guidance */}
            <div className="space-y-1.5">
              <label
                htmlFor="spec-care"
                className="block text-xs font-bold text-neutral-700"
              >
                Care &amp; Handling Instructions
              </label>
              <input
                id="spec-care"
                type="text"
                value={care}
                onChange={(e) => setCare(e.target.value)}
                placeholder="Wipe with a soft, dry cloth. Keep away from extreme heat (>50°C)."
                className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-xs text-neutral-900 bg-white focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>

          {/* Section 7: Publishing & Status */}
          <div className="bg-surface rounded-2xl border border-neutral-200/90 shadow-xs p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
              <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-800">
                7. Catalog Visibility &amp; Status
              </h2>
              <span className="text-[10px] text-neutral-400 font-medium">
                Publishing Controls
              </span>
            </div>

            <div className="space-y-4">
              {/* Active Toggle */}
              <div className="flex items-start justify-between p-3 rounded-xl border border-neutral-200 bg-white">
                <div className="space-y-0.5 pr-4">
                  <label
                    htmlFor="toggle-active"
                    className="text-xs font-bold text-neutral-800 cursor-pointer"
                  >
                    Active Catalog Listing
                  </label>
                  <p className="text-[11px] text-neutral-500">
                    {isActive
                      ? "This product is active and visible to customers on the Dearr storefront."
                      : "This product is hidden from the customer storefront and stored as an internal draft."}
                  </p>
                </div>
                <button
                  type="button"
                  id="toggle-active"
                  role="switch"
                  aria-label="Active Catalog Listing"
                  aria-checked={isActive}
                  onClick={() => setIsActive(!isActive)}
                  className={`w-12 h-7 flex items-center rounded-full p-1 transition-colors cursor-pointer shrink-0 ${
                    isActive ? "bg-primary" : "bg-neutral-300"
                  }`}
                >
                  <div
                    className={`bg-white w-5 h-5 rounded-full shadow-md transform transition-transform ${
                      isActive ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              {/* Featured Toggle */}
              <div className="flex items-start justify-between p-3 rounded-xl border border-neutral-200 bg-white">
                <div className="space-y-0.5 pr-4">
                  <label
                    htmlFor="toggle-featured"
                    className="text-xs font-bold text-neutral-800 cursor-pointer"
                  >
                    Featured on Storefront
                  </label>
                  <p className="text-[11px] text-neutral-500">
                    Highlight this item on the homepage spotlight and curated showcase grids.
                  </p>
                </div>
                <button
                  type="button"
                  id="toggle-featured"
                  role="switch"
                  aria-label="Featured on Storefront"
                  aria-checked={isFeatured}
                  onClick={() => setIsFeatured(!isFeatured)}
                  className={`w-12 h-7 flex items-center rounded-full p-1 transition-colors cursor-pointer shrink-0 ${
                    isFeatured ? "bg-primary" : "bg-neutral-300"
                  }`}
                >
                  <div
                    className={`bg-white w-5 h-5 rounded-full shadow-md transform transition-transform ${
                      isFeatured ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>

          {/* Section 8: Product Variants */}
          <div className="bg-surface rounded-2xl border border-neutral-200/90 shadow-xs p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
              <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-800">
                8. Variants &amp; Options
              </h2>
              <span className="text-[10px] text-neutral-400 font-medium">
                Multi-SKU Foundation
              </span>
            </div>

            <AdminProductVariants
              variants={variants}
              onChange={(updated) => setVariants(updated)}
              basePrice={parseFloat(price) || 0}
              baseSku={sku.trim()}
            />
          </div>

          {/* QA Options: Error Simulation Toggle (Section 17) */}
          <div className="p-3.5 rounded-xl bg-neutral-100/70 border border-neutral-200 flex items-center justify-between text-xs text-neutral-600">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-neutral-700">Demo QA Testing:</span>
              <span className="text-neutral-500 text-[11px]">
                Test error resilience without data loss
              </span>
            </div>
            <label className="inline-flex items-center gap-2 cursor-pointer font-medium select-none">
              <input
                type="checkbox"
                checked={simulateSaveError}
                onChange={(e) => setSimulateSaveError(e.target.checked)}
                className="rounded border-neutral-300 text-primary focus:ring-primary h-4 w-4"
              />
              <span>Simulate save error</span>
            </label>
          </div>

          {/* Bottom Action Strip */}
          <div className="flex items-center justify-between pt-4 border-t border-neutral-200/80">
            <button
              type="button"
              onClick={handleCancelClick}
              className="px-4 py-2.5 rounded-xl border border-neutral-300 hover:bg-neutral-100 text-xs sm:text-sm font-bold text-neutral-700 transition-all cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-xs sm:text-sm tracking-wide text-neutral-900 bg-primary hover:bg-[#91BC7A] active:scale-98 transition-all shadow-xs focus-visible:outline-2 focus-visible:outline-neutral-900 disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <span className="w-4 h-4 rounded-full border-2 border-neutral-900 border-t-transparent animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <CheckCircleIcon size={16} />
                  <span>{isEdit ? "Save Changes" : "Save Product"}</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right Column: Live Product Summary (4 Cols) */}
        <div className="lg:col-span-4 w-full">
          <AdminProductSummary
            title={title}
            slug={slug}
            category={category}
            price={price.trim() ? parseFloat(price) : null}
            compareAtPrice={compareAtPrice.trim() ? parseFloat(compareAtPrice) : null}
            stockQuantity={stockQuantity.trim() ? parseInt(stockQuantity, 10) : null}
            sku={sku}
            material={material === "Other (Custom)" ? customMaterial : material}
            finish={finish}
            color={color}
            dimensions={dimensions}
            primaryImage={primaryImage}
            isActive={isActive}
            isFeatured={isFeatured}
            variantsCount={variants.length}
          />
        </div>
      </form>

      {/* ====================================================================
          MODAL 1: UNSAVED CHANGES CONFIRMATION
          ==================================================================== */}
      {showDiscardModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="discard-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div className="bg-surface rounded-2xl max-w-sm w-full p-6 shadow-modal border border-neutral-200 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-2 border-b border-neutral-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-red-50 text-red-600 flex items-center justify-center">
                  <AlertCircleIcon size={18} />
                </div>
                <h3
                  id="discard-modal-title"
                  className="font-bold text-base text-neutral-900"
                >
                  Discard Changes?
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowDiscardModal(false)}
                aria-label="Close dialog"
                className="w-8 h-8 rounded-lg border border-neutral-200 hover:bg-neutral-100 flex items-center justify-center text-neutral-500"
              >
                <XIcon size={16} />
              </button>
            </div>

            <p className="text-xs text-neutral-600 leading-relaxed">
              {isEdit
                ? "You have unsaved changes to this product. Are you sure you want to leave?"
                : "You have unsaved product changes. If you leave now, your entries will not be saved."}
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowDiscardModal(false)}
                className="px-3.5 py-2 rounded-xl border border-neutral-300 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 transition-colors cursor-pointer"
              >
                Keep Editing
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowDiscardModal(false);
                  router.push("/admin/products");
                }}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-xs font-bold text-white transition-colors cursor-pointer"
              >
                Discard Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================
          MODAL 2: PRODUCT SAVE SUCCESS CONFIRMATION
          ==================================================================== */}
      {savedProduct && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="success-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div className="bg-surface rounded-2xl max-w-md w-full p-6 shadow-modal border border-neutral-200 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
                  <CheckCircleIcon size={20} />
                </div>
                <div>
                  <h3
                    id="success-modal-title"
                    className="font-bold text-base text-neutral-900"
                  >
                    {isEdit
                      ? "Product Updated (Preview Mode)"
                      : "Product Created (Preview Mode)"}
                  </h3>
                  <span className="text-[10px] text-neutral-400 font-mono">
                    ID: {savedProduct.id}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSavedProduct(null)}
                aria-label="Close dialog"
                className="w-8 h-8 rounded-lg border border-neutral-200 hover:bg-neutral-100 flex items-center justify-center text-neutral-500"
              >
                <XIcon size={16} />
              </button>
            </div>

            {/* Product Summary Card */}
            <div className="p-3.5 rounded-xl bg-neutral-50 border border-neutral-200/90 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <h4 className="font-bold text-sm text-neutral-900 truncate">
                    {savedProduct.name}
                  </h4>
                  <p className="text-[11px] text-neutral-500 font-mono">
                    /{savedProduct.slug}
                  </p>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-white border border-neutral-200 text-neutral-800 shrink-0">
                  {savedProduct.category}
                </span>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-neutral-200 text-xs">
                <div className="flex items-baseline gap-1.5">
                  <span className="font-extrabold text-neutral-900">
                    ₹{savedProduct.price.toLocaleString("en-IN")}
                  </span>
                  {savedProduct.compareAtPrice && (
                    <span className="text-[11px] text-neutral-400 line-through">
                      ₹{savedProduct.compareAtPrice.toLocaleString("en-IN")}
                    </span>
                  )}
                </div>
                <span className="font-semibold text-emerald-800">
                  Stock: {savedProduct.stockQuantity} units
                </span>
              </div>
            </div>

            {/* Backend connection note */}
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-950 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-amber-900">
                <ShieldCheckIcon size={14} className="text-amber-700" />
                <span>Frontend Demo State Notice</span>
              </div>
              <p className="text-[11px] leading-relaxed text-amber-900/90">
                {isEdit
                  ? "Product updated in preview mode. Database persistence will be connected in the backend phase. Your changes are saved to session state and immediately reflected in your admin catalog."
                  : "Product created in preview mode. Database persistence will be connected in the backend phase. This item is temporarily accessible in your local admin products list during this browser session."}
              </p>
            </div>

            {/* Modal Actions */}
            <div className="flex flex-col sm:flex-row items-center justify-end gap-2.5 pt-2">
              {isEdit ? (
                <>
                  <Link
                    href={`/product/${savedProduct.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-neutral-300 hover:bg-neutral-100 text-xs font-semibold text-neutral-700 transition-colors cursor-pointer"
                  >
                    <span>View Product</span>
                    <ExternalLinkIcon size={13} className="text-neutral-500" />
                  </Link>

                  <button
                    type="button"
                    onClick={() => setSavedProduct(null)}
                    className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-neutral-300 hover:bg-neutral-100 text-xs font-bold text-neutral-800 transition-colors cursor-pointer"
                  >
                    Continue Editing
                  </button>

                  <Link
                    href="/admin/products"
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-primary hover:bg-[#91BC7A] text-xs font-bold text-neutral-900 transition-colors cursor-pointer"
                  >
                    <PackageIcon size={14} />
                    <span>Back to Products</span>
                  </Link>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={handleResetForm}
                    className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-neutral-300 hover:bg-neutral-100 text-xs font-bold text-neutral-800 transition-colors cursor-pointer"
                  >
                    Create Another
                  </button>
                  <Link
                    href="/admin/products"
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-primary hover:bg-[#91BC7A] text-xs font-bold text-neutral-900 transition-colors cursor-pointer"
                  >
                    <PackageIcon size={14} />
                    <span>View Products</span>
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
