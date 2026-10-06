"use client";

import React, { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AdminCustomer,
  CustomerStatus,
} from "@/lib/admin-customers";
import {
  ArrowLeftIcon,
  CheckCircleIcon,
  AlertCircleIcon,
  BanIcon,
  ShieldAlertIcon,
  XIcon,
  MapPinIcon,
  UserIcon,
} from "../AdminIcons";
import { AdminCustomerNotFound } from "./AdminCustomerNotFound";

interface AdminCustomerFormProps {
  customerId: string;
  initialCustomer?: AdminCustomer | null;
}

interface FormErrors {
  name?: string;
  email?: string;
  phone?: string;
  postalCode?: string;
}

export function AdminCustomerForm({
  customerId,
  initialCustomer,
}: AdminCustomerFormProps) {
  const router = useRouter();
  const [customer, setCustomer] = useState<AdminCustomer | null>(
    initialCustomer ?? null
  );
  const [loading, setLoading] = useState(true);

  // Form Fields
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [status, setStatus] = useState<CustomerStatus>("active");
  const [notes, setNotes] = useState("");

  // Address Fields
  const [addressFullName, setAddressFullName] = useState("");
  const [addressPhone, setAddressPhone] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [city, setCity] = useState("");
  const [addressState, setAddressState] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [country, setCountry] = useState("India");

  // Validation & UI State
  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDiscardModal, setShowDiscardModal] = useState(false);
  const [pendingNavigationUrl, setPendingNavigationUrl] = useState<string | null>(null);

  // Sync on mount from API
  useEffect(() => {
    let isMounted = true;
    async function loadCustomer() {
      try {
        setLoading(true);
        const res = await fetch(`/api/admin/customers/${customerId}`);
        if (res.ok) {
          const data = await res.json();
          const found = data.customer;
          if (isMounted && found) {
            setCustomer(found);
            setName(found.name);
            setEmail(found.email);
            setPhone(found.phone);
            setStatus(found.status);
            setNotes(found.notes || "");

            if (found.defaultAddress) {
              setAddressFullName(found.defaultAddress.fullName || found.name);
              setAddressPhone(found.defaultAddress.phone || found.phone);
              setAddressLine1(found.defaultAddress.addressLine1 || "");
              setAddressLine2(found.defaultAddress.addressLine2 || "");
              setCity(found.defaultAddress.city || "");
              setAddressState(found.defaultAddress.state || "");
              setPostalCode(found.defaultAddress.postalCode || "");
              setCountry(found.defaultAddress.country || "India");
            } else {
              setAddressFullName(found.name);
              setAddressPhone(found.phone);
            }
          }
        }
      } catch {
        if (isMounted) setCustomer(null);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadCustomer();
    return () => {
      isMounted = false;
    };
  }, [customerId]);

  // Dirty State Calculation
  const isDirty = useMemo(() => {
    if (!customer) return false;
    const initialAddr = customer.defaultAddress;

    return (
      name !== customer.name ||
      email !== customer.email ||
      phone !== customer.phone ||
      status !== customer.status ||
      notes !== (customer.notes || "") ||
      addressFullName !== (initialAddr?.fullName || customer.name) ||
      addressPhone !== (initialAddr?.phone || customer.phone) ||
      addressLine1 !== (initialAddr?.addressLine1 || "") ||
      addressLine2 !== (initialAddr?.addressLine2 || "") ||
      city !== (initialAddr?.city || "") ||
      addressState !== (initialAddr?.state || "") ||
      postalCode !== (initialAddr?.postalCode || "") ||
      country !== (initialAddr?.country || "India")
    );
  }, [
    customer,
    name,
    email,
    phone,
    status,
    notes,
    addressFullName,
    addressPhone,
    addressLine1,
    addressLine2,
    city,
    addressState,
    postalCode,
    country,
  ]);

  // Browser beforeunload protection
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty && !isSubmitting) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty, isSubmitting]);

  // Field validation
  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    // Name
    if (!name.trim()) {
      newErrors.name = "Full name is required";
    } else if (name.trim().length < 2) {
      newErrors.name = "Full name must be at least 2 characters";
    } else if (name.trim().length > 80) {
      newErrors.name = "Full name must be under 80 characters";
    }

    // Email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim()) {
      newErrors.email = "Email address is required";
    } else if (!emailRegex.test(email.trim())) {
      newErrors.email = "Enter a valid email address (e.g. name@example.com)";
    } else if (email.trim().length > 100) {
      newErrors.email = "Email must be under 100 characters";
    }

    // Phone
    const digitsOnly = phone.replace(/\D/g, "");
    if (!phone.trim()) {
      newErrors.phone = "Phone number is required";
    } else if (digitsOnly.length < 10) {
      newErrors.phone = "Enter a valid 10-digit mobile number";
    }

    // Postal Code (if provided)
    if (postalCode.trim() && !/^\d{6}$/.test(postalCode.trim())) {
      newErrors.postalCode = "Enter a valid 6-digit Indian PIN code";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleBlur = (field: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    validateForm();
  };

  // Safe navigation with unsaved changes confirmation
  const handleNavAttempt = (e: React.MouseEvent, url: string) => {
    if (isDirty) {
      e.preventDefault();
      setPendingNavigationUrl(url);
      setShowDiscardModal(true);
    }
  };

  const handleConfirmDiscard = () => {
    setShowDiscardModal(false);
    if (pendingNavigationUrl) {
      router.push(pendingNavigationUrl);
    }
  };

  // Form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({
      name: true,
      email: true,
      phone: true,
      postalCode: true,
    });

    if (!validateForm()) return;
    if (!customer) return;

    setIsSubmitting(true);

    const hasAddress =
      addressLine1.trim() ||
      city.trim() ||
      addressState.trim() ||
      postalCode.trim();

    try {
      const res = await fetch(`/api/admin/customers/${customer.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim(),
          status,
          notes: notes.trim() || undefined,
          defaultAddress: hasAddress
            ? {
                fullName: addressFullName.trim() || name.trim(),
                phone: addressPhone.trim() || phone.trim(),
                addressLine1: addressLine1.trim(),
                addressLine2: addressLine2.trim() || undefined,
                city: city.trim(),
                state: addressState.trim(),
                postalCode: postalCode.trim(),
                country: country.trim() || "India",
              }
            : undefined,
        }),
      });

      if (res.ok) {
        router.push(`/admin/customers/${customer.id}`);
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "Failed to update customer");
        setIsSubmitting(false);
      }
    } catch {
      alert("Network error updating customer");
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-6 w-36 bg-neutral-200 rounded" />
        <div className="h-64 bg-surface rounded-2xl border border-neutral-200" />
      </div>
    );
  }

  if (!customer) {
    return <AdminCustomerNotFound customerId={customerId} />;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Top Header & Breadcrumb */}
      <div className="flex items-center justify-between gap-4">
        <Link
          href={`/admin/customers/${customer.id}`}
          onClick={(e) => handleNavAttempt(e, `/admin/customers/${customer.id}`)}
          className="inline-flex items-center gap-2 text-xs font-bold text-neutral-500 hover:text-neutral-900 transition-colors"
        >
          <ArrowLeftIcon size={14} />
          <span>Back to Customer Profile</span>
        </Link>

        {isDirty && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-900 border border-amber-200 animate-in fade-in duration-150">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            <span>Unsaved Changes</span>
          </span>
        )}
      </div>

      <div className="space-y-1">
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-neutral-900 tracking-tight">
          Edit Customer
        </h1>
        <p className="text-xs sm:text-sm text-neutral-500">
          Modify contact details, account lifecycle status, delivery address, or add internal notes for{" "}
          <span className="font-semibold text-neutral-800">{customer.name}</span>{" "}
          <span className="font-mono text-xs">({customer.id})</span>.
        </p>
      </div>

      {/* Main Edit Form */}
      <form onSubmit={handleSubmit} className="space-y-6" noValidate>
        {/* Section 1: Customer Profile & Contact */}
        <div className="p-6 rounded-2xl bg-surface border border-neutral-200/80 shadow-2xs space-y-5">
          <div className="border-b border-neutral-100 pb-3">
            <h2 className="text-sm font-bold text-neutral-900">
              Basic Account Information
            </h2>
            <p className="text-xs text-neutral-500 mt-0.5">
              Primary identity and login verification details
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Full Name */}
            <div className="space-y-1.5">
              <label
                htmlFor="customer-name"
                className="block text-xs font-bold text-neutral-800"
              >
                Full Name <span className="text-rose-500">*</span>
              </label>
              <input
                id="customer-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={() => handleBlur("name")}
                aria-invalid={Boolean(touched.name && errors.name)}
                aria-describedby={
                  touched.name && errors.name ? "name-error" : undefined
                }
                className={`w-full h-11 px-3.5 rounded-xl border text-xs text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 transition-all ${
                  touched.name && errors.name
                    ? "border-rose-400 bg-rose-50/20 focus:ring-rose-200"
                    : "border-neutral-200 bg-canvas focus:ring-primary/40 focus:border-primary"
                }`}
                placeholder="e.g. Rahul Kumar"
              />
              {touched.name && errors.name && (
                <p id="name-error" role="alert" className="text-[11px] text-rose-600 font-medium">
                  {errors.name}
                </p>
              )}
            </div>

            {/* Email Address */}
            <div className="space-y-1.5">
              <label
                htmlFor="customer-email"
                className="block text-xs font-bold text-neutral-800"
              >
                Email Address <span className="text-rose-500">*</span>
              </label>
              <input
                id="customer-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onBlur={() => handleBlur("email")}
                aria-invalid={Boolean(touched.email && errors.email)}
                aria-describedby={
                  touched.email && errors.email ? "email-error" : undefined
                }
                className={`w-full h-11 px-3.5 rounded-xl border text-xs text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 transition-all ${
                  touched.email && errors.email
                    ? "border-rose-400 bg-rose-50/20 focus:ring-rose-200"
                    : "border-neutral-200 bg-canvas focus:ring-primary/40 focus:border-primary"
                }`}
                placeholder="e.g. rahul.k@example.com"
              />
              {touched.email && errors.email && (
                <p id="email-error" role="alert" className="text-[11px] text-rose-600 font-medium">
                  {errors.email}
                </p>
              )}
            </div>

            {/* Phone Number */}
            <div className="space-y-1.5">
              <label
                htmlFor="customer-phone"
                className="block text-xs font-bold text-neutral-800"
              >
                Mobile Phone <span className="text-rose-500">*</span>
              </label>
              <input
                id="customer-phone"
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                onBlur={() => handleBlur("phone")}
                aria-invalid={Boolean(touched.phone && errors.phone)}
                aria-describedby={
                  touched.phone && errors.phone ? "phone-error" : undefined
                }
                className={`w-full h-11 px-3.5 rounded-xl border text-xs text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 transition-all font-mono ${
                  touched.phone && errors.phone
                    ? "border-rose-400 bg-rose-50/20 focus:ring-rose-200"
                    : "border-neutral-200 bg-canvas focus:ring-primary/40 focus:border-primary"
                }`}
                placeholder="+91 98765 43210"
              />
              {touched.phone && errors.phone && (
                <p id="phone-error" role="alert" className="text-[11px] text-rose-600 font-medium">
                  {errors.phone}
                </p>
              )}
            </div>

            {/* Account Status Radio Group */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-neutral-800">
                Account Lifecycle Status
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setStatus("active")}
                  className={`h-11 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    status === "active"
                      ? "bg-emerald-50 border-emerald-500 text-emerald-900 shadow-2xs"
                      : "bg-surface border-neutral-200 text-neutral-600 hover:bg-neutral-50"
                  }`}
                >
                  <CheckCircleIcon size={14} className={status === "active" ? "text-emerald-600" : "text-neutral-400"} />
                  <span>Active</span>
                </button>

                <button
                  type="button"
                  onClick={() => setStatus("inactive")}
                  className={`h-11 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    status === "inactive"
                      ? "bg-neutral-200/70 border-neutral-400 text-neutral-900 shadow-2xs"
                      : "bg-surface border-neutral-200 text-neutral-600 hover:bg-neutral-50"
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-neutral-400" />
                  <span>Inactive</span>
                </button>

                <button
                  type="button"
                  onClick={() => setStatus("suspended")}
                  className={`h-11 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    status === "blocked" || status === "suspended"
                      ? "bg-rose-50 border-rose-500 text-rose-900 shadow-2xs"
                      : "bg-surface border-neutral-200 text-neutral-600 hover:bg-neutral-50"
                  }`}
                >
                  <BanIcon size={14} className={status === "blocked" || status === "suspended" ? "text-rose-600" : "text-neutral-400"} />
                  <span>Suspended</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Default Delivery Address */}
        <div className="p-6 rounded-2xl bg-surface border border-neutral-200/80 shadow-2xs space-y-5">
          <div className="border-b border-neutral-100 pb-3 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-neutral-900">
                Default Delivery Address
              </h2>
              <p className="text-xs text-neutral-500 mt-0.5">
                Shipping destination auto-filled during storefront checkout
              </p>
            </div>
            <MapPinIcon size={18} className="text-neutral-400" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label
                htmlFor="addr-recipient"
                className="block text-xs font-semibold text-neutral-700"
              >
                Recipient Name
              </label>
              <input
                id="addr-recipient"
                type="text"
                value={addressFullName}
                onChange={(e) => setAddressFullName(e.target.value)}
                placeholder={name || "Recipient full name"}
                className="w-full h-10 px-3 rounded-xl border border-neutral-200 bg-canvas text-xs text-neutral-800 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="addr-phone"
                className="block text-xs font-semibold text-neutral-700"
              >
                Delivery Contact Phone
              </label>
              <input
                id="addr-phone"
                type="text"
                value={addressPhone}
                onChange={(e) => setAddressPhone(e.target.value)}
                placeholder={phone || "+91 98765 43210"}
                className="w-full h-10 px-3 rounded-xl border border-neutral-200 bg-canvas text-xs text-neutral-800 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary font-mono"
              />
            </div>

            <div className="sm:col-span-2 space-y-1.5">
              <label
                htmlFor="addr-line1"
                className="block text-xs font-semibold text-neutral-700"
              >
                Address Line 1 (Flat, House no., Building, Street)
              </label>
              <input
                id="addr-line1"
                type="text"
                value={addressLine1}
                onChange={(e) => setAddressLine1(e.target.value)}
                placeholder="e.g. Flat 402, Green Meadows, Lokhandwala"
                className="w-full h-10 px-3 rounded-xl border border-neutral-200 bg-canvas text-xs text-neutral-800 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
              />
            </div>

            <div className="sm:col-span-2 space-y-1.5">
              <label
                htmlFor="addr-line2"
                className="block text-xs font-semibold text-neutral-700"
              >
                Address Line 2 (Area, Landmark — Optional)
              </label>
              <input
                id="addr-line2"
                type="text"
                value={addressLine2}
                onChange={(e) => setAddressLine2(e.target.value)}
                placeholder="e.g. Andheri West, Near Infinity Mall"
                className="w-full h-10 px-3 rounded-xl border border-neutral-200 bg-canvas text-xs text-neutral-800 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="addr-city"
                className="block text-xs font-semibold text-neutral-700"
              >
                City / District
              </label>
              <input
                id="addr-city"
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="e.g. Mumbai"
                className="w-full h-10 px-3 rounded-xl border border-neutral-200 bg-canvas text-xs text-neutral-800 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="addr-state"
                className="block text-xs font-semibold text-neutral-700"
              >
                State / Province
              </label>
              <input
                id="addr-state"
                type="text"
                value={addressState}
                onChange={(e) => setAddressState(e.target.value)}
                placeholder="e.g. Maharashtra"
                className="w-full h-10 px-3 rounded-xl border border-neutral-200 bg-canvas text-xs text-neutral-800 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="addr-postalCode"
                className="block text-xs font-semibold text-neutral-700"
              >
                Postal Code (PIN code)
              </label>
              <input
                id="addr-postalCode"
                type="text"
                maxLength={6}
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
                onBlur={() => handleBlur("postalCode")}
                placeholder="400053"
                className="w-full h-10 px-3 rounded-xl border border-neutral-200 bg-canvas text-xs text-neutral-800 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary font-mono"
              />
              {touched.postalCode && errors.postalCode && (
                <p role="alert" className="text-[11px] text-rose-600 font-medium">
                  {errors.postalCode}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="addr-country"
                className="block text-xs font-semibold text-neutral-700"
              >
                Country
              </label>
              <input
                id="addr-country"
                type="text"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-neutral-200 bg-canvas text-xs text-neutral-800 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
              />
            </div>
          </div>
        </div>

        {/* Section 3: Administrative Notes */}
        <div className="p-6 rounded-2xl bg-surface border border-neutral-200/80 shadow-2xs space-y-4">
          <div className="border-b border-neutral-100 pb-3">
            <h2 className="text-sm font-bold text-neutral-900">
              Administrative Notes & Operational Remarks
            </h2>
            <p className="text-xs text-neutral-500 mt-0.5">
              Internal notes visible only to Dearr founder and admins
            </p>
          </div>

          <div className="space-y-1.5">
            <textarea
              rows={4}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Prefers silk filaments, requested bespoke statue print scale, or noted special shipping instructions..."
              className="w-full p-3.5 rounded-xl border border-neutral-200 bg-canvas text-xs text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary leading-relaxed"
            />
          </div>
        </div>

        {/* Sticky Actions Bar */}
        <div className="sticky bottom-4 z-20 p-4 rounded-2xl bg-white/95 backdrop-blur-md border border-neutral-200 shadow-xl flex items-center justify-between gap-4">
          <Link
            href={`/admin/customers/${customer.id}`}
            onClick={(e) => handleNavAttempt(e, `/admin/customers/${customer.id}`)}
            className="px-4 py-2.5 rounded-xl border border-neutral-200 text-xs font-semibold text-neutral-700 hover:bg-neutral-100 transition-colors cursor-pointer"
          >
            Cancel
          </Link>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 rounded-xl bg-primary hover:bg-[#91BC7A] text-neutral-900 font-bold text-xs shadow-xs transition-all cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? "Saving..." : "Save Customer"}
            </button>
          </div>
        </div>
      </form>

      {/* Discard Changes Confirmation Modal */}
      {showDiscardModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150"
          role="dialog"
          aria-modal="true"
          aria-labelledby="discard-modal-title"
        >
          <div className="bg-surface rounded-2xl border border-neutral-200 shadow-2xl max-w-sm w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">
                Unsaved Changes
              </span>
              <button
                type="button"
                onClick={() => setShowDiscardModal(false)}
                className="w-7 h-7 rounded-lg border border-neutral-200 flex items-center justify-center text-neutral-400 hover:text-neutral-700"
              >
                <XIcon size={14} />
              </button>
            </div>

            <div className="space-y-1">
              <h3
                id="discard-modal-title"
                className="text-base font-bold text-neutral-900"
              >
                Discard edits to customer?
              </h3>
              <p className="text-xs text-neutral-500">
                You have unsaved changes to this profile. If you leave now, your edits will not be saved.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-100">
              <button
                type="button"
                onClick={() => setShowDiscardModal(false)}
                className="px-3.5 py-2 rounded-xl border border-neutral-200 text-xs font-semibold text-neutral-700 hover:bg-neutral-100 cursor-pointer"
              >
                Keep Editing
              </button>
              <button
                type="button"
                onClick={handleConfirmDiscard}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-colors cursor-pointer shadow-xs"
              >
                Discard Edits
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
