"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  AdminSettings,
  DEFAULT_ADMIN_SETTINGS,
  APPROVED_DEARR_PALETTE,
  getAdminSettings,
} from "@/lib/admin-settings";
import {
  CheckCircleIcon,
  AlertCircleIcon,
  RotateCcwIcon,
  SlidersIcon,
  XIcon,
  MailIcon,
  PhoneIcon,
  MapPinIcon,
  PackageIcon,
  ShoppingCartIcon,
  UserIcon,
} from "../AdminIcons";
import { AdminSettingsSkeleton } from "./AdminSettingsSkeleton";

interface FormErrors {
  storeName?: string;
  supportEmail?: string;
  supportPhone?: string;
  postalCode?: string;
  freeShippingThreshold?: string;
  defaultShippingFee?: string;
  cancellationWindowHours?: string;
}

export function AdminSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [initialSettings, setInitialSettings] = useState<AdminSettings>(
    DEFAULT_ADMIN_SETTINGS
  );
  const [formData, setFormData] = useState<AdminSettings>(
    DEFAULT_ADMIN_SETTINGS
  );
  const router = useRouter();
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null);

  // Validation & UI State
  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Modals state
  const [showResetModal, setShowResetModal] = useState(false);
  const [showDiscardModal, setShowDiscardModal] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  // Sync settings on mount from API
  useEffect(() => {
    let isMounted = true;
    async function loadSettings() {
      try {
        setLoading(true);
        const res = await fetch("/api/admin/settings");
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data.settings) {
            setInitialSettings(data.settings);
            setFormData(data.settings);
          }
        } else {
          const loaded = getAdminSettings();
          if (isMounted) {
            setInitialSettings(loaded);
            setFormData(loaded);
          }
        }
      } catch {
        const loaded = getAdminSettings();
        if (isMounted) {
          setInitialSettings(loaded);
          setFormData(loaded);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadSettings();
    return () => {
      isMounted = false;
    };
  }, []);

  // Dirty State Calculation
  const isDirty = useMemo(() => {
    return JSON.stringify(formData) !== JSON.stringify(initialSettings);
  }, [formData, initialSettings]);

  // Window beforeunload listener
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

  // Modal ESC key listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowResetModal(false);
        setShowDiscardModal(false);
        setPendingNavigation(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Intercept internal navigation when unsaved changes exist
  useEffect(() => {
    if (!isDirty) return;

    const handleDocumentClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest("a");
      if (!target) return;

      const href = target.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("javascript:") || target.target === "_blank") {
        return;
      }

      // Check if clicking inside current settings modals
      if ((e.target as HTMLElement).closest('[role="dialog"]')) {
        return;
      }

      e.preventDefault();
      e.stopPropagation();
      setPendingNavigation(href);
      setShowDiscardModal(true);
    };

    document.addEventListener("click", handleDocumentClick, { capture: true });
    return () => {
      document.removeEventListener("click", handleDocumentClick, { capture: true });
    };
  }, [isDirty]);

  // Update a field helper
  const updateField = <K extends keyof AdminSettings>(
    field: K,
    value: AdminSettings[K]
  ) => {
    setFormData((prev) => {
      const next = { ...prev, [field]: value };
      if (field === "showAnnouncementBar") {
        next.announcementEnabled = value as boolean;
      } else if (field === "announcementEnabled") {
        next.showAnnouncementBar = value as boolean;
      }
      return next;
    });
  };

  // Field validation
  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    // Store Name
    if (!formData.storeName.trim()) {
      newErrors.storeName = "Store name is required";
    }

    // Support Email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.supportEmail.trim()) {
      newErrors.supportEmail = "Support email is required";
    } else if (!emailRegex.test(formData.supportEmail.trim())) {
      newErrors.supportEmail = "Enter a valid email address";
    }

    // Support Phone
    const digitsOnly = formData.supportPhone.replace(/\D/g, "");
    if (!formData.supportPhone.trim()) {
      newErrors.supportPhone = "Support phone is required";
    } else if (digitsOnly.length < 10) {
      newErrors.supportPhone = "Enter a valid 10-digit mobile number";
    }

    // Postal Code (if provided)
    if (formData.postalCode.trim() && !/^\d{6}$/.test(formData.postalCode.trim())) {
      newErrors.postalCode = "Enter a valid 6-digit Indian PIN code";
    }

    // Numeric validations
    if (formData.freeShippingThreshold < 0) {
      newErrors.freeShippingThreshold = "Free shipping threshold cannot be negative";
    }
    if (formData.defaultShippingFee < 0) {
      newErrors.defaultShippingFee = "Shipping fee cannot be negative";
    }
    if (formData.cancellationWindowHours < 1) {
      newErrors.cancellationWindowHours = "Cancellation window must be at least 1 hour";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleBlur = (field: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    validateForm();
  };

  // Save handler
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({
      storeName: true,
      supportEmail: true,
      supportPhone: true,
      postalCode: true,
      freeShippingThreshold: true,
      defaultShippingFee: true,
      cancellationWindowHours: true,
    });

    if (!validateForm()) {
      showToast("Please correct the highlighted validation errors.");
      return;
    }

    try {
      setIsSaving(true);
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.ok && data.settings) {
          setInitialSettings(data.settings);
          setFormData(data.settings);
          showToast("Store settings saved successfully.");
        }
      } else {
        const errData = await res.json().catch(() => ({}));
        showToast(errData.error || "Failed to save settings.");
      }
    } catch {
      showToast("Network error saving settings.");
    } finally {
      setIsSaving(false);
    }
  };

  // Reset to Defaults handler
  const handleConfirmReset = () => {
    setFormData(DEFAULT_ADMIN_SETTINGS);
    setShowResetModal(false);
    showToast(
      "Settings restored to Dearr defaults. Click 'Save Changes' to commit."
    );
  };

  // Discard changes handler
  const handleConfirmDiscard = () => {
    setFormData(initialSettings);
    setErrors({});
    setShowDiscardModal(false);
    if (pendingNavigation) {
      const targetUrl = pendingNavigation;
      setPendingNavigation(null);
      router.push(targetUrl);
    } else {
      showToast("Unsaved changes discarded.");
    }
  };

  const handleKeepEditing = () => {
    setPendingNavigation(null);
    setShowDiscardModal(false);
  };

  // Accessible Switch component
  const renderToggle = (
    label: string,
    description: string,
    checked: boolean,
    onChange: (val: boolean) => void,
    id: string
  ) => {
    return (
      <div className="flex items-start justify-between gap-4 py-2.5">
        <div className="space-y-0.5">
          <label
            htmlFor={id}
            className="text-xs font-bold text-neutral-800 cursor-pointer"
          >
            {label}
          </label>
          <p className="text-[11px] text-neutral-500 leading-relaxed">
            {description}
          </p>
        </div>
        <button
          type="button"
          id={id}
          role="switch"
          aria-checked={checked}
          aria-label={label}
          onClick={() => onChange(!checked)}
          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
            checked ? "bg-primary" : "bg-neutral-200"
          }`}
        >
          <span
            aria-hidden="true"
            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
              checked ? "translate-x-5" : "translate-x-0"
            }`}
          />
        </button>
      </div>
    );
  };

  if (loading) {
    return <AdminSettingsSkeleton />;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-6 right-6 z-50 bg-neutral-900 text-white text-xs font-semibold px-4 py-3 rounded-xl shadow-2xl border border-neutral-700 animate-in slide-in-from-bottom-2 duration-200 flex items-center gap-2"
        >
          <CheckCircleIcon size={16} className="text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-neutral-900 tracking-tight">
              Settings & Store Configuration
            </h1>
            {isDirty && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-900 border border-amber-200 animate-in fade-in duration-150">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                <span>Unsaved Changes</span>
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-neutral-500">
            Configure store identity, storefront switches, checkout limits, customer policies, and notification rules.
          </p>
        </div>
      </div>

      {/* Settings Form */}
      <form onSubmit={handleSave} className="space-y-6" noValidate>
        {/* ====================================================================
            SECTION A — STORE INFORMATION
            ==================================================================== */}
        <div className="p-6 rounded-2xl bg-surface border border-neutral-200/80 shadow-2xs space-y-5">
          <div className="border-b border-neutral-100 pb-3 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-neutral-900">
                Section A — Store Information
              </h2>
              <p className="text-xs text-neutral-500 mt-0.5">
                Public business identity and contact credentials displayed on invoices & footers
              </p>
            </div>
            <SlidersIcon size={18} className="text-neutral-400" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Store Name */}
            <div className="space-y-1.5">
              <label
                htmlFor="storeName"
                className="block text-xs font-bold text-neutral-800"
              >
                Store Name <span className="text-rose-500">*</span>
              </label>
              <input
                id="storeName"
                type="text"
                value={formData.storeName}
                onChange={(e) => updateField("storeName", e.target.value)}
                onBlur={() => handleBlur("storeName")}
                aria-invalid={Boolean(touched.storeName && errors.storeName)}
                aria-describedby={
                  touched.storeName && errors.storeName
                    ? "storeName-error"
                    : undefined
                }
                className={`w-full h-10 px-3.5 rounded-xl border text-xs text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 transition-all ${
                  touched.storeName && errors.storeName
                    ? "border-rose-400 bg-rose-50/20 focus:ring-rose-200"
                    : "border-neutral-200 bg-canvas focus:ring-primary/40 focus:border-primary"
                }`}
                placeholder="Dearr"
              />
              {touched.storeName && errors.storeName && (
                <p id="storeName-error" role="alert" className="text-[11px] text-rose-600 font-medium">
                  {errors.storeName}
                </p>
              )}
            </div>

            {/* Tagline */}
            <div className="space-y-1.5">
              <label
                htmlFor="tagline"
                className="block text-xs font-bold text-neutral-800"
              >
                Brand Tagline
              </label>
              <input
                id="tagline"
                type="text"
                value={formData.tagline}
                onChange={(e) => updateField("tagline", e.target.value)}
                className="w-full h-10 px-3.5 rounded-xl border border-neutral-200 bg-canvas text-xs text-neutral-900 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                placeholder="3D Printed Collectibles & Custom Artifacts"
              />
            </div>

            {/* Support Email */}
            <div className="space-y-1.5">
              <label
                htmlFor="supportEmail"
                className="block text-xs font-bold text-neutral-800"
              >
                Support Email <span className="text-rose-500">*</span>
              </label>
              <input
                id="supportEmail"
                type="email"
                value={formData.supportEmail}
                onChange={(e) => updateField("supportEmail", e.target.value)}
                onBlur={() => handleBlur("supportEmail")}
                aria-invalid={Boolean(touched.supportEmail && errors.supportEmail)}
                aria-describedby={
                  touched.supportEmail && errors.supportEmail
                    ? "supportEmail-error"
                    : undefined
                }
                className={`w-full h-10 px-3.5 rounded-xl border text-xs text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 transition-all ${
                  touched.supportEmail && errors.supportEmail
                    ? "border-rose-400 bg-rose-50/20 focus:ring-rose-200"
                    : "border-neutral-200 bg-canvas focus:ring-primary/40 focus:border-primary"
                }`}
                placeholder="support@dearr.in"
              />
              {touched.supportEmail && errors.supportEmail && (
                <p id="supportEmail-error" role="alert" className="text-[11px] text-rose-600 font-medium">
                  {errors.supportEmail}
                </p>
              )}
            </div>

            {/* Support Phone */}
            <div className="space-y-1.5">
              <label
                htmlFor="supportPhone"
                className="block text-xs font-bold text-neutral-800"
              >
                Support Phone <span className="text-rose-500">*</span>
              </label>
              <input
                id="supportPhone"
                type="text"
                value={formData.supportPhone}
                onChange={(e) => updateField("supportPhone", e.target.value)}
                onBlur={() => handleBlur("supportPhone")}
                aria-invalid={Boolean(touched.supportPhone && errors.supportPhone)}
                aria-describedby={
                  touched.supportPhone && errors.supportPhone
                    ? "supportPhone-error"
                    : undefined
                }
                className={`w-full h-10 px-3.5 rounded-xl border text-xs text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 transition-all font-mono ${
                  touched.supportPhone && errors.supportPhone
                    ? "border-rose-400 bg-rose-50/20 focus:ring-rose-200"
                    : "border-neutral-200 bg-canvas focus:ring-primary/40 focus:border-primary"
                }`}
                placeholder="+91 98201 54321"
              />
              {touched.supportPhone && errors.supportPhone && (
                <p id="supportPhone-error" role="alert" className="text-[11px] text-rose-600 font-medium">
                  {errors.supportPhone}
                </p>
              )}
            </div>

            {/* Business Address */}
            <div className="sm:col-span-2 space-y-1.5">
              <label
                htmlFor="businessAddress"
                className="block text-xs font-semibold text-neutral-700"
              >
                Studio / Workshop Address
              </label>
              <input
                id="businessAddress"
                type="text"
                value={formData.businessAddress}
                onChange={(e) => updateField("businessAddress", e.target.value)}
                className="w-full h-10 px-3.5 rounded-xl border border-neutral-200 bg-canvas text-xs text-neutral-900 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                placeholder="Studio 104, Maker Hub, MIDC Industrial Area"
              />
            </div>

            {/* City */}
            <div className="space-y-1.5">
              <label
                htmlFor="city"
                className="block text-xs font-semibold text-neutral-700"
              >
                City
              </label>
              <input
                id="city"
                type="text"
                value={formData.city}
                onChange={(e) => updateField("city", e.target.value)}
                className="w-full h-10 px-3.5 rounded-xl border border-neutral-200 bg-canvas text-xs text-neutral-900 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                placeholder="Mumbai"
              />
            </div>

            {/* State */}
            <div className="space-y-1.5">
              <label
                htmlFor="state"
                className="block text-xs font-semibold text-neutral-700"
              >
                State
              </label>
              <input
                id="state"
                type="text"
                value={formData.state}
                onChange={(e) => updateField("state", e.target.value)}
                className="w-full h-10 px-3.5 rounded-xl border border-neutral-200 bg-canvas text-xs text-neutral-900 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                placeholder="Maharashtra"
              />
            </div>

            {/* Postal Code */}
            <div className="space-y-1.5 sm:col-span-2">
              <label
                htmlFor="postalCode"
                className="block text-xs font-semibold text-neutral-700"
              >
                Postal Code (PIN Code)
              </label>
              <input
                id="postalCode"
                type="text"
                maxLength={6}
                value={formData.postalCode}
                onChange={(e) => updateField("postalCode", e.target.value)}
                onBlur={() => handleBlur("postalCode")}
                aria-invalid={Boolean(touched.postalCode && errors.postalCode)}
                className="w-full h-10 px-3.5 rounded-xl border border-neutral-200 bg-canvas text-xs text-neutral-900 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary font-mono max-w-xs"
                placeholder="400093"
              />
              {touched.postalCode && errors.postalCode && (
                <p role="alert" className="text-[11px] text-rose-600 font-medium">
                  {errors.postalCode}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* ====================================================================
            SECTION B — STOREFRONT CONTROLS
            ==================================================================== */}
        <div className="p-6 rounded-2xl bg-surface border border-neutral-200/80 shadow-2xs space-y-4">
          <div className="border-b border-neutral-100 pb-3">
            <h2 className="text-sm font-bold text-neutral-900">
              Section B — Storefront Controls
            </h2>
            <p className="text-xs text-neutral-500 mt-0.5">
              Public availability and store banner messaging configuration
            </p>
          </div>

          <div className="divide-y divide-neutral-100">
            {renderToggle(
              "Storefront Active",
              "Enables consumer-facing browsing, search, and checkout navigation across all routes.",
              formData.storefrontEnabled,
              (v) => updateField("storefrontEnabled", v),
              "toggle-storefrontEnabled"
            )}

            {renderToggle(
              "Maintenance Mode (Configuration Only)",
              "Flags store as undergoing scheduled workshop maintenance. (Storefront routing boundary preserved for V1).",
              formData.maintenanceMode,
              (v) => updateField("maintenanceMode", v),
              "toggle-maintenanceMode"
            )}

            {formData.maintenanceMode && (
              <div className="py-3 space-y-1.5">
                <label
                  htmlFor="maintenanceMessage"
                  className="block text-xs font-semibold text-neutral-700"
                >
                  Maintenance Notice Message
                </label>
                <textarea
                  id="maintenanceMessage"
                  rows={2}
                  value={formData.maintenanceMessage}
                  onChange={(e) =>
                    updateField("maintenanceMessage", e.target.value)
                  }
                  className="w-full p-3 rounded-xl border border-neutral-200 bg-canvas text-xs text-neutral-800 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary resize-none"
                />
              </div>
            )}

            {renderToggle(
              "Announcement Banner",
              "Displays a top promotional banner on customer storefront header.",
              formData.showAnnouncementBar,
              (v) => updateField("showAnnouncementBar", v),
              "toggle-showAnnouncementBar"
            )}

            {formData.showAnnouncementBar && (
              <div className="py-3 space-y-1.5">
                <label
                  htmlFor="announcementText"
                  className="block text-xs font-semibold text-neutral-700"
                >
                  Banner Announcement Text
                </label>
                <input
                  id="announcementText"
                  type="text"
                  value={formData.announcementText}
                  onChange={(e) =>
                    updateField("announcementText", e.target.value)
                  }
                  className="w-full h-10 px-3.5 rounded-xl border border-neutral-200 bg-canvas text-xs text-neutral-800 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                  placeholder="Free Express Shipping on all 3D printed orders above ₹999..."
                />
              </div>
            )}
          </div>
        </div>

        {/* ====================================================================
            SECTION C — CHECKOUT SETTINGS (INR)
            ==================================================================== */}
        <div className="p-6 rounded-2xl bg-surface border border-neutral-200/80 shadow-2xs space-y-4">
          <div className="border-b border-neutral-100 pb-3">
            <h2 className="text-sm font-bold text-neutral-900">
              Section C — Checkout & Shipping Limits
            </h2>
            <p className="text-xs text-neutral-500 mt-0.5">
              Financial limits and delivery fee thresholds (All values in Indian Rupees — ₹)
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">

            {/* Free Shipping Threshold */}
            <div className="space-y-1.5">
              <label
                htmlFor="freeShippingThreshold"
                className="block text-xs font-bold text-neutral-800"
              >
                Free Shipping Threshold (₹)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 font-bold text-xs">
                  ₹
                </span>
                <input
                  id="freeShippingThreshold"
                  type="number"
                  min={0}
                  value={formData.freeShippingThreshold}
                  onChange={(e) =>
                    updateField("freeShippingThreshold", Number(e.target.value))
                  }
                  className="w-full h-10 pl-7 pr-3 rounded-xl border border-neutral-200 bg-canvas text-xs text-neutral-900 font-mono focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                />
              </div>
            </div>

            {/* Default Shipping Fee */}
            <div className="space-y-1.5">
              <label
                htmlFor="defaultShippingFee"
                className="block text-xs font-bold text-neutral-800"
              >
                Standard Shipping Fee (₹)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 font-bold text-xs">
                  ₹
                </span>
                <input
                  id="defaultShippingFee"
                  type="number"
                  min={0}
                  value={formData.defaultShippingFee}
                  onChange={(e) =>
                    updateField("defaultShippingFee", Number(e.target.value))
                  }
                  className="w-full h-10 pl-7 pr-3 rounded-xl border border-neutral-200 bg-canvas text-xs text-neutral-900 font-mono focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                />
              </div>
            </div>
          </div>

          <div className="divide-y divide-neutral-100 pt-2">
            {renderToggle(
              "Enable Cash on Delivery (COD)",
              "Allow customers to pay upon delivery at physical address.",
              formData.codEnabled,
              (v) => updateField("codEnabled", v),
              "toggle-codEnabled"
            )}

            {renderToggle(
              "Enable Prepaid Payments",
              "Allow Razorpay gateway checkout (UPI, Netbanking, Debit & Credit Cards).",
              formData.prepaidEnabled,
              (v) => updateField("prepaidEnabled", v),
              "toggle-prepaidEnabled"
            )}
          </div>
        </div>

        {/* ====================================================================
            SECTION D — ORDER FULFILLMENT SETTINGS
            ==================================================================== */}
        <div className="p-6 rounded-2xl bg-surface border border-neutral-200/80 shadow-2xs space-y-4">
          <div className="border-b border-neutral-100 pb-3">
            <h2 className="text-sm font-bold text-neutral-900">
              Section D — Order Fulfillment Policies
            </h2>
            <p className="text-xs text-neutral-500 mt-0.5">
              Print queue allocation, automatic confirmations, and customer cancellation rules
            </p>
          </div>

          <div className="divide-y divide-neutral-100">
            {renderToggle(
              "Auto-Confirm Orders",
              "Automatically mark newly placed orders as Confirmed without requiring manual founder review.",
              formData.autoConfirmOrders,
              (v) => updateField("autoConfirmOrders", v),
              "toggle-autoConfirmOrders"
            )}

            {renderToggle(
              "Allow Customer Cancellations",
              "Permit buyers to request order cancellation from their account dashboard prior to workshop slicing.",
              formData.allowOrderCancellation,
              (v) => updateField("allowOrderCancellation", v),
              "toggle-allowOrderCancellation"
            )}

            {formData.allowOrderCancellation && (
              <div className="py-3 flex items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <label
                    htmlFor="cancellationWindowHours"
                    className="text-xs font-bold text-neutral-800"
                  >
                    Cancellation Window (Hours)
                  </label>
                  <p className="text-[11px] text-neutral-500">
                    Maximum elapsed time from order creation during which cancellation is allowed.
                  </p>
                </div>
                <div className="w-28 shrink-0">
                  <input
                    id="cancellationWindowHours"
                    type="number"
                    min={1}
                    max={72}
                    value={formData.cancellationWindowHours}
                    onChange={(e) =>
                      updateField(
                        "cancellationWindowHours",
                        Number(e.target.value)
                      )
                    }
                    className="w-full h-10 px-3 rounded-xl border border-neutral-200 bg-canvas text-xs text-neutral-900 font-mono text-center focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                  />
                </div>
              </div>
            )}

            {renderToggle(
              "Founder Alerts on New Orders",
              "Trigger immediate administrative dashboard notifications when orders are placed.",
              formData.notifyOnNewOrder,
              (v) => updateField("notifyOnNewOrder", v),
              "toggle-notifyOnNewOrder"
            )}
          </div>
        </div>

        {/* ====================================================================
            SECTION E — CUSTOMER SETTINGS
            ==================================================================== */}
        <div className="p-6 rounded-2xl bg-surface border border-neutral-200/80 shadow-2xs space-y-4">
          <div className="border-b border-neutral-100 pb-3">
            <h2 className="text-sm font-bold text-neutral-900">
              Section E — Customer Accounts & Checkout Policies
            </h2>
            <p className="text-xs text-neutral-500 mt-0.5">
              Registration availability and mandatory customer profile fields
            </p>
          </div>

          <div className="divide-y divide-neutral-100">
            {renderToggle(
              "Allow Customer Registrations",
              "Permits new shoppers to create customer accounts at /signup.",
              formData.allowCustomerSignup,
              (v) => updateField("allowCustomerSignup", v),
              "toggle-allowCustomerSignup"
            )}

            {renderToggle(
              "Allow Guest Checkout",
              "Enables unauthenticated buyers to complete purchases without registering an account.",
              formData.allowGuestCheckout,
              (v) => updateField("allowGuestCheckout", v),
              "toggle-allowGuestCheckout"
            )}

            {renderToggle(
              "Mandatory Phone Number",
              "Requires a valid 10-digit mobile number for dispatch tracking and delivery coordination.",
              formData.requirePhone,
              (v) => updateField("requirePhone", v),
              "toggle-requirePhone"
            )}

            {renderToggle(
              "Mandatory Shipping Address",
              "Enforces full physical address and PIN code verification prior to checkout confirmation.",
              formData.requireAddress,
              (v) => updateField("requireAddress", v),
              "toggle-requireAddress"
            )}
          </div>
        </div>

        {/* ====================================================================
            SECTION F — NOTIFICATIONS
            ==================================================================== */}
        <div className="p-6 rounded-2xl bg-surface border border-neutral-200/80 shadow-2xs space-y-4">
          <div className="border-b border-neutral-100 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-neutral-900">
                  Section F — Automated Email Notifications
                </h2>
                <p className="text-xs text-neutral-500 mt-0.5">
                  Transactional customer emails and administrative notification triggers
                </p>
              </div>
              <MailIcon size={18} className="text-neutral-400" />
            </div>

            {/* Informational alert regarding backend phase */}
            <div className="mt-3 p-3 rounded-xl bg-blue-50/70 border border-blue-200 text-blue-900 text-xs flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
              <span>
                <strong>Implementation Notice:</strong> Transactional email service (SMTP/SES) will be connected during the backend phase. Toggles represent active configuration rules.
              </span>
            </div>
          </div>

          <div className="divide-y divide-neutral-100">
            {renderToggle(
              "Order Confirmation Email",
              "Dispatches immediate receipt with line items and fulfillment timeline upon successful purchase.",
              formData.emailOrderConfirmation,
              (v) => updateField("emailOrderConfirmation", v),
              "toggle-emailOrderConfirmation"
            )}

            {renderToggle(
              "Order Shipped Email",
              "Sends courier tracking link and delivery estimate when fulfillment status changes to Shipped.",
              formData.emailOrderShipped,
              (v) => updateField("emailOrderShipped", v),
              "toggle-emailOrderShipped"
            )}

            {renderToggle(
              "Order Delivered Email",
              "Sends delivery confirmation and care tips for 3D printed models upon package handover.",
              formData.emailOrderDelivered,
              (v) => updateField("emailOrderDelivered", v),
              "toggle-emailOrderDelivered"
            )}

            {renderToggle(
              "Order Cancellation Email",
              "Sends formal confirmation and refund timeline notice if an order is cancelled.",
              formData.emailOrderCancelled,
              (v) => updateField("emailOrderCancelled", v),
              "toggle-emailOrderCancelled"
            )}

            {renderToggle(
              "New Customer Registration Alert",
              "Notifies founder inbox when a new customer registers on the storefront.",
              formData.emailNewCustomer,
              (v) => updateField("emailNewCustomer", v),
              "toggle-emailNewCustomer"
            )}

            {renderToggle(
              "New Review Submission Alert",
              "Notifies moderation queue when customer feedback is submitted.",
              formData.emailNewReview,
              (v) => updateField("emailNewReview", v),
              "toggle-emailNewReview"
            )}
          </div>
        </div>

        {/* ====================================================================
            SECTION G — STORE APPEARANCE & BRAND PALETTE
            ==================================================================== */}
        <div className="p-6 rounded-2xl bg-surface border border-neutral-200/80 shadow-2xs space-y-4">
          <div className="border-b border-neutral-100 pb-3">
            <h2 className="text-sm font-bold text-neutral-900">
              Section G — Brand Palette & Appearance
            </h2>
            <p className="text-xs text-neutral-500 mt-0.5">
              Dearr design token palette (Constrained to approved design tokens to protect system integrity)
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
            {/* Primary Accent */}
            <div className="p-3.5 rounded-xl border border-neutral-200 bg-neutral-50 space-y-2">
              <div
                className="w-full h-10 rounded-lg shadow-2xs border border-black/10"
                style={{ backgroundColor: APPROVED_DEARR_PALETTE.primary }}
              />
              <div>
                <span className="text-xs font-bold text-neutral-900 block">
                  Primary Accent
                </span>
                <span className="font-mono text-[10px] text-neutral-500 uppercase">
                  {APPROVED_DEARR_PALETTE.primary}
                </span>
              </div>
            </div>

            {/* Secondary Accent */}
            <div className="p-3.5 rounded-xl border border-neutral-200 bg-neutral-50 space-y-2">
              <div
                className="w-full h-10 rounded-lg shadow-2xs border border-black/10"
                style={{ backgroundColor: APPROVED_DEARR_PALETTE.secondary }}
              />
              <div>
                <span className="text-xs font-bold text-neutral-900 block">
                  Secondary Accent
                </span>
                <span className="font-mono text-[10px] text-neutral-500 uppercase">
                  {APPROVED_DEARR_PALETTE.secondary}
                </span>
              </div>
            </div>

            {/* Canvas Neutral */}
            <div className="p-3.5 rounded-xl border border-neutral-200 bg-neutral-50 space-y-2">
              <div
                className="w-full h-10 rounded-lg shadow-2xs border border-black/10"
                style={{ backgroundColor: APPROVED_DEARR_PALETTE.canvas }}
              />
              <div>
                <span className="text-xs font-bold text-neutral-900 block">
                  Warm Canvas
                </span>
                <span className="font-mono text-[10px] text-neutral-500 uppercase">
                  {APPROVED_DEARR_PALETTE.canvas}
                </span>
              </div>
            </div>

            {/* Dark Ink */}
            <div className="p-3.5 rounded-xl border border-neutral-200 bg-neutral-50 space-y-2">
              <div
                className="w-full h-10 rounded-lg shadow-2xs border border-black/10"
                style={{ backgroundColor: APPROVED_DEARR_PALETTE.dark }}
              />
              <div>
                <span className="text-xs font-bold text-neutral-900 block">
                  Dark Neutral
                </span>
                <span className="font-mono text-[10px] text-neutral-500 uppercase">
                  {APPROVED_DEARR_PALETTE.dark}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ====================================================================
            STICKY ACTION BAR
            ==================================================================== */}
        <div className="sticky bottom-4 z-20 p-4 rounded-2xl bg-white/95 backdrop-blur-md border border-neutral-200 shadow-xl flex items-center justify-between gap-4">
          {/* Reset to Defaults */}
          <button
            type="button"
            onClick={() => setShowResetModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-neutral-200 text-xs font-semibold text-neutral-700 hover:bg-neutral-100 transition-colors cursor-pointer"
          >
            <RotateCcwIcon size={14} className="text-neutral-500" />
            <span>Reset to Defaults</span>
          </button>

          <div className="flex items-center gap-3">
            {isDirty && (
              <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-[11px] font-bold text-amber-800">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                <span>Unsaved Changes</span>
              </div>
            )}

            {isDirty && (
              <button
                type="button"
                onClick={() => {
                  setPendingNavigation(null);
                  setShowDiscardModal(true);
                }}
                className="px-4 py-2.5 rounded-xl border border-neutral-200 text-xs font-semibold text-neutral-700 hover:bg-neutral-100 transition-colors cursor-pointer"
              >
                Reset Changes
              </button>
            )}

            <button
              type="submit"
              disabled={isSaving}
              className="px-6 py-2.5 rounded-xl bg-primary hover:bg-[#91BC7A] text-neutral-900 font-bold text-xs shadow-xs transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      </form>

      {/* ====================================================================
          CONFIRMATION MODAL: RESET TO DEFAULTS
          ==================================================================== */}
      {showResetModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150"
          role="dialog"
          aria-modal="true"
          aria-labelledby="reset-modal-title"
        >
          <div className="bg-surface rounded-2xl border border-neutral-200 shadow-2xl max-w-sm w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">
                Reset Store Settings
              </span>
              <button
                type="button"
                onClick={() => setShowResetModal(false)}
                aria-label="Close reset modal"
                className="w-7 h-7 rounded-lg border border-neutral-200 flex items-center justify-center text-neutral-400 hover:text-neutral-700"
              >
                <XIcon size={14} />
              </button>
            </div>

            <div className="space-y-1">
              <h3
                id="reset-modal-title"
                className="text-base font-bold text-neutral-900"
              >
                Reset all settings to Dearr defaults?
              </h3>
              <p className="text-xs text-neutral-500 leading-relaxed">
                This will reset the form values back to canonical Dearr default configurations.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-100">
              <button
                type="button"
                onClick={() => setShowResetModal(false)}
                className="px-3.5 py-2 rounded-xl border border-neutral-200 text-xs font-semibold text-neutral-700 hover:bg-neutral-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmReset}
                className="px-4 py-2 rounded-xl bg-primary hover:bg-[#91BC7A] text-neutral-900 text-xs font-bold transition-colors cursor-pointer shadow-xs"
              >
                Reset Settings
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================
          CONFIRMATION MODAL: DISCARD CHANGES
          ==================================================================== */}
      {showDiscardModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150"
          role="dialog"
          aria-modal="true"
          aria-labelledby="discard-settings-title"
        >
          <div className="bg-surface rounded-2xl border border-neutral-200 shadow-2xl max-w-sm w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">
                Discard Changes
              </span>
              <button
                type="button"
                onClick={() => setShowDiscardModal(false)}
                aria-label="Close discard modal"
                className="w-7 h-7 rounded-lg border border-neutral-200 flex items-center justify-center text-neutral-400 hover:text-neutral-700"
              >
                <XIcon size={14} />
              </button>
            </div>

            <div className="space-y-1">
              <h3
                id="discard-settings-title"
                className="text-base font-bold text-neutral-900"
              >
                Discard unsaved changes?
              </h3>
              <p className="text-xs text-neutral-500 leading-relaxed">
                All modifications made during this editing session will be reverted back to the last saved configuration.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-100">
              <button
                type="button"
                onClick={handleKeepEditing}
                className="px-3.5 py-2 rounded-xl border border-neutral-200 text-xs font-semibold text-neutral-700 hover:bg-neutral-100 cursor-pointer"
              >
                Keep Editing
              </button>
              <button
                type="button"
                onClick={handleConfirmDiscard}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-colors cursor-pointer shadow-xs"
              >
                Discard & Leave
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
