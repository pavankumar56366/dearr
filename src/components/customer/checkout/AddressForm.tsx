"use client";

import React from "react";
import type { DeliveryAddressFormValues, DeliveryAddressErrors } from "@/lib/checkout-validation";
import { AlertCircleIcon, MapPinIcon, CheckIcon } from "@/components/customer/Icons";

export interface SavedAddressItem {
  id: string;
  label?: string | null;
  fullName: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  isDefault: boolean;
}

interface AddressFormProps {
  savedAddresses?: SavedAddressItem[];
  selectedAddressId?: string | "new";
  onSelectSavedAddress?: (addressId: string | "new") => void;
  values: DeliveryAddressFormValues;
  errors: DeliveryAddressErrors;
  onChange: (field: keyof DeliveryAddressFormValues, value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  isValidated: boolean;
  saveNewAddress?: boolean;
  onToggleSaveNewAddress?: (save: boolean) => void;
}

export default function AddressForm({
  savedAddresses = [],
  selectedAddressId = "new",
  onSelectSavedAddress,
  values,
  errors,
  onChange,
  onSubmit,
  isValidated,
  saveNewAddress = true,
  onToggleSaveNewAddress,
}: AddressFormProps) {
  const hasSavedAddresses = savedAddresses.length > 0;
  const isEnteringNewAddress = !hasSavedAddresses || selectedAddressId === "new";

  return (
    <section
      aria-labelledby="delivery-details-heading"
      className="rounded-2xl p-5 sm:p-7 flex flex-col gap-6"
      style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-neutral-100)",
        boxShadow: "var(--shadow-card)",
      }}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-neutral-100">
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: "rgba(162, 203, 139, 0.2)", color: "var(--color-neutral-900)" }}
          >
            <MapPinIcon size={18} />
          </div>
          <div>
            <h2
              id="delivery-details-heading"
              className="text-base sm:text-lg font-bold tracking-tight"
              style={{ color: "var(--color-neutral-900)" }}
            >
              Step 1: Delivery Address
            </h2>
            <p className="text-xs text-neutral-500 font-medium">
              Where should our 3D print workshop dispatch your package?
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
        {/* Saved Addresses Selector (if customer has saved addresses) */}
        {hasSavedAddresses && (
          <div className="flex flex-col gap-3">
            <label className="text-xs font-bold uppercase tracking-wider text-neutral-700">
              Select a Saved Address
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {savedAddresses.map((addr) => {
                const isSelected = selectedAddressId === addr.id;
                return (
                  <div
                    key={addr.id}
                    onClick={() => onSelectSavedAddress?.(addr.id)}
                    className={`relative p-4 rounded-xl border text-left cursor-pointer transition-all duration-150 flex flex-col justify-between ${
                      isSelected
                        ? "border-[#2A7C13] bg-[#E8F5E9]/30 ring-2 ring-[#2A7C13]/20"
                        : "border-neutral-200 hover:border-neutral-300 bg-white"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition-colors ${
                            isSelected
                              ? "border-[#2A7C13] bg-[#2A7C13]"
                              : "border-neutral-300 bg-white"
                          }`}
                        >
                          {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                        </span>
                        <span className="text-xs font-bold text-neutral-900">
                          {addr.label || addr.fullName}
                        </span>
                      </div>
                      {addr.isDefault && (
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                          Default
                        </span>
                      )}
                    </div>

                    <div className="text-xs text-neutral-600 space-y-0.5 pl-6">
                      <p className="font-semibold text-neutral-900">{addr.fullName}</p>
                      <p className="text-neutral-500 font-medium">+91 {addr.phone}</p>
                      <p className="line-clamp-2 leading-relaxed">
                        {addr.addressLine1}
                        {addr.addressLine2 ? `, ${addr.addressLine2}` : ""}, {addr.city},{" "}
                        {addr.state} - {addr.postalCode}
                      </p>
                    </div>
                  </div>
                );
              })}

              {/* Option to add / enter a new address */}
              <div
                onClick={() => onSelectSavedAddress?.("new")}
                className={`p-4 rounded-xl border border-dashed text-left cursor-pointer transition-all duration-150 flex items-center justify-center gap-2 min-h-[110px] ${
                  selectedAddressId === "new"
                    ? "border-[#2A7C13] bg-[#E8F5E9]/20 ring-2 ring-[#2A7C13]/20"
                    : "border-neutral-300 hover:border-neutral-400 bg-neutral-50/50"
                }`}
              >
                <span
                  className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                    selectedAddressId === "new"
                      ? "border-[#2A7C13] bg-[#2A7C13]"
                      : "border-neutral-300 bg-white"
                  }`}
                >
                  {selectedAddressId === "new" && (
                    <span className="w-1.5 h-1.5 rounded-full bg-white" />
                  )}
                </span>
                <span className="text-xs font-bold text-neutral-800">
                  + Deliver to a different / new address
                </span>
              </div>
            </div>
          </div>
        )}

        {/* New Address Fields (Rendered when no saved address exists or "new" is selected) */}
        {isEnteringNewAddress && (
          <div className="flex flex-col gap-4 pt-2">
            {hasSavedAddresses && (
              <div className="border-t border-neutral-100 pt-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-700">
                  New Delivery Address Details
                </h3>
              </div>
            )}

            {/* Recipient Full Name */}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="fullName"
                className="text-xs font-bold uppercase tracking-wider text-neutral-700"
              >
                Full Name <span className="text-red-500" aria-hidden="true">*</span>
              </label>
              <input
                id="fullName"
                name="fullName"
                type="text"
                required
                autoComplete="name"
                value={values.fullName}
                onChange={(e) => onChange("fullName", e.target.value)}
                aria-invalid={!!errors.fullName}
                aria-describedby={errors.fullName ? "fullName-error" : undefined}
                placeholder="e.g. John Doe"
                className={`w-full h-12 px-4 rounded-xl text-sm transition-all outline-none border ${
                  errors.fullName
                    ? "border-red-500 focus:ring-2 focus:ring-red-200 bg-red-50/20"
                    : "border-neutral-300 focus:border-[#A2CB8B] focus:ring-2 focus:ring-[#A2CB8B]/20 bg-white"
                }`}
                style={{ color: "var(--color-neutral-900)" }}
              />
              {errors.fullName && (
                <p
                  id="fullName-error"
                  className="text-xs flex items-center gap-1 font-semibold text-red-600 mt-0.5"
                >
                  <AlertCircleIcon size={13} className="shrink-0" />
                  <span>{errors.fullName}</span>
                </p>
              )}
            </div>

            {/* Contact Info Grid: Mobile Phone + Email */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Phone */}
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="phone"
                  className="text-xs font-bold uppercase tracking-wider text-neutral-700"
                >
                  Mobile Number (10 Digits) <span className="text-red-500" aria-hidden="true">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-bold text-neutral-400 select-none">
                    +91
                  </span>
                  <input
                    id="phone"
                    name="phone"
                    type="tel"
                    required
                    autoComplete="tel"
                    maxLength={10}
                    value={values.phone}
                    onChange={(e) => onChange("phone", e.target.value.replace(/\D/g, ""))}
                    aria-invalid={!!errors.phone}
                    aria-describedby={errors.phone ? "phone-error" : undefined}
                    placeholder="9876543210"
                    className={`w-full h-12 pl-12 pr-4 rounded-xl text-sm transition-all outline-none border ${
                      errors.phone
                        ? "border-red-500 focus:ring-2 focus:ring-red-200 bg-red-50/20"
                        : "border-neutral-300 focus:border-[#A2CB8B] focus:ring-2 focus:ring-[#A2CB8B]/20 bg-white"
                    }`}
                    style={{ color: "var(--color-neutral-900)" }}
                  />
                </div>
                {errors.phone && (
                  <p
                    id="phone-error"
                    className="text-xs flex items-center gap-1 font-semibold text-red-600 mt-0.5"
                  >
                    <AlertCircleIcon size={13} className="shrink-0" />
                    <span>{errors.phone}</span>
                  </p>
                )}
              </div>

              {/* Email */}
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="email"
                  className="text-xs font-bold uppercase tracking-wider text-neutral-700"
                >
                  Email Address <span className="text-red-500" aria-hidden="true">*</span>
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={values.email}
                  onChange={(e) => onChange("email", e.target.value)}
                  aria-invalid={!!errors.email}
                  aria-describedby={errors.email ? "email-error" : undefined}
                  placeholder="e.g. your.email@example.com"
                  className={`w-full h-12 px-4 rounded-xl text-sm transition-all outline-none border ${
                    errors.email
                      ? "border-red-500 focus:ring-2 focus:ring-red-200 bg-red-50/20"
                      : "border-neutral-300 focus:border-[#A2CB8B] focus:ring-2 focus:ring-[#A2CB8B]/20 bg-white"
                  }`}
                  style={{ color: "var(--color-neutral-900)" }}
                />
                {errors.email && (
                  <p
                    id="email-error"
                    className="text-xs flex items-center gap-1 font-semibold text-red-600 mt-0.5"
                  >
                    <AlertCircleIcon size={13} className="shrink-0" />
                    <span>{errors.email}</span>
                  </p>
                )}
              </div>
            </div>

            {/* Address Line 1 */}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="addressLine1"
                className="text-xs font-bold uppercase tracking-wider text-neutral-700"
              >
                Address Line 1 (Flat, House No., Building, Street){" "}
                <span className="text-red-500" aria-hidden="true">*</span>
              </label>
              <input
                id="addressLine1"
                name="addressLine1"
                type="text"
                required
                autoComplete="address-line1"
                value={values.addressLine1}
                onChange={(e) => onChange("addressLine1", e.target.value)}
                aria-invalid={!!errors.addressLine1}
                aria-describedby={errors.addressLine1 ? "addressLine1-error" : undefined}
                placeholder="e.g. Flat 302, Green Heights, 12th Main Road"
                className={`w-full h-12 px-4 rounded-xl text-sm transition-all outline-none border ${
                  errors.addressLine1
                    ? "border-red-500 focus:ring-2 focus:ring-red-200 bg-red-50/20"
                    : "border-neutral-300 focus:border-[#A2CB8B] focus:ring-2 focus:ring-[#A2CB8B]/20 bg-white"
                }`}
                style={{ color: "var(--color-neutral-900)" }}
              />
              {errors.addressLine1 && (
                <p
                  id="addressLine1-error"
                  className="text-xs flex items-center gap-1 font-semibold text-red-600 mt-0.5"
                >
                  <AlertCircleIcon size={13} className="shrink-0" />
                  <span>{errors.addressLine1}</span>
                </p>
              )}
            </div>

            {/* Address Line 2 */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="addressLine2"
                  className="text-xs font-bold uppercase tracking-wider text-neutral-700"
                >
                  Address Line 2 (Area, Landmark)
                </label>
                <span className="text-[11px] text-neutral-400">Optional</span>
              </div>
              <input
                id="addressLine2"
                name="addressLine2"
                type="text"
                autoComplete="address-line2"
                value={values.addressLine2 || ""}
                onChange={(e) => onChange("addressLine2", e.target.value)}
                placeholder="e.g. Near Water Tank, Indiranagar"
                className="w-full h-12 px-4 rounded-xl text-sm transition-all outline-none border border-neutral-300 focus:border-[#A2CB8B] focus:ring-2 focus:ring-[#A2CB8B]/20 bg-white"
                style={{ color: "var(--color-neutral-900)" }}
              />
            </div>

            {/* City, State, PIN Code Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* City */}
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="city"
                  className="text-xs font-bold uppercase tracking-wider text-neutral-700"
                >
                  City / Town <span className="text-red-500" aria-hidden="true">*</span>
                </label>
                <input
                  id="city"
                  name="city"
                  type="text"
                  required
                  autoComplete="address-level2"
                  value={values.city}
                  onChange={(e) => onChange("city", e.target.value)}
                  aria-invalid={!!errors.city}
                  aria-describedby={errors.city ? "city-error" : undefined}
                  placeholder="e.g. Bengaluru"
                  className={`w-full h-12 px-4 rounded-xl text-sm transition-all outline-none border ${
                    errors.city
                      ? "border-red-500 focus:ring-2 focus:ring-red-200 bg-red-50/20"
                      : "border-neutral-300 focus:border-[#A2CB8B] focus:ring-2 focus:ring-[#A2CB8B]/20 bg-white"
                  }`}
                  style={{ color: "var(--color-neutral-900)" }}
                />
                {errors.city && (
                  <p
                    id="city-error"
                    className="text-xs flex items-center gap-1 font-semibold text-red-600 mt-0.5"
                  >
                    <AlertCircleIcon size={13} className="shrink-0" />
                    <span>{errors.city}</span>
                  </p>
                )}
              </div>

              {/* State */}
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="state"
                  className="text-xs font-bold uppercase tracking-wider text-neutral-700"
                >
                  State <span className="text-red-500" aria-hidden="true">*</span>
                </label>
                <input
                  id="state"
                  name="state"
                  type="text"
                  required
                  autoComplete="address-level1"
                  value={values.state}
                  onChange={(e) => onChange("state", e.target.value)}
                  aria-invalid={!!errors.state}
                  aria-describedby={errors.state ? "state-error" : undefined}
                  placeholder="e.g. Karnataka"
                  className={`w-full h-12 px-4 rounded-xl text-sm transition-all outline-none border ${
                    errors.state
                      ? "border-red-500 focus:ring-2 focus:ring-red-200 bg-red-50/20"
                      : "border-neutral-300 focus:border-[#A2CB8B] focus:ring-2 focus:ring-[#A2CB8B]/20 bg-white"
                  }`}
                  style={{ color: "var(--color-neutral-900)" }}
                />
                {errors.state && (
                  <p
                    id="state-error"
                    className="text-xs flex items-center gap-1 font-semibold text-red-600 mt-0.5"
                  >
                    <AlertCircleIcon size={13} className="shrink-0" />
                    <span>{errors.state}</span>
                  </p>
                )}
              </div>

              {/* Postal Code */}
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="postalCode"
                  className="text-xs font-bold uppercase tracking-wider text-neutral-700"
                >
                  PIN Code (6 Digits) <span className="text-red-500" aria-hidden="true">*</span>
                </label>
                <input
                  id="postalCode"
                  name="postalCode"
                  type="text"
                  required
                  autoComplete="postal-code"
                  maxLength={6}
                  value={values.postalCode}
                  onChange={(e) => onChange("postalCode", e.target.value.replace(/\D/g, ""))}
                  aria-invalid={!!errors.postalCode}
                  aria-describedby={errors.postalCode ? "postalCode-error" : undefined}
                  placeholder="560038"
                  className={`w-full h-12 px-4 rounded-xl text-sm transition-all outline-none border ${
                    errors.postalCode
                      ? "border-red-500 focus:ring-2 focus:ring-red-200 bg-red-50/20"
                      : "border-neutral-300 focus:border-[#A2CB8B] focus:ring-2 focus:ring-[#A2CB8B]/20 bg-white"
                  }`}
                  style={{ color: "var(--color-neutral-900)" }}
                />
                {errors.postalCode && (
                  <p
                    id="postalCode-error"
                    className="text-xs flex items-center gap-1 font-semibold text-red-600 mt-0.5"
                  >
                    <AlertCircleIcon size={13} className="shrink-0" />
                    <span>{errors.postalCode}</span>
                  </p>
                )}
              </div>
            </div>

            {/* Country (Fixed to India for V1) */}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="country"
                className="text-xs font-bold uppercase tracking-wider text-neutral-700"
              >
                Country
              </label>
              <input
                id="country"
                name="country"
                type="text"
                readOnly
                value="India"
                className="w-full h-12 px-4 rounded-xl text-sm border border-neutral-200 bg-neutral-100 text-neutral-600 cursor-not-allowed select-none"
              />
              <p className="text-[11px] text-neutral-500">
                Dearr delivers across India via dedicated domestic 3D printing logistics.
              </p>
            </div>

            {/* Checkbox: Save address for future use */}
            {onToggleSaveNewAddress && (
              <label className="flex items-center gap-2.5 pt-1 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={saveNewAddress}
                  onChange={(e) => onToggleSaveNewAddress(e.target.checked)}
                  className="w-4 h-4 rounded text-emerald-600 border-neutral-300 focus:ring-emerald-500 cursor-pointer"
                />
                <span className="text-xs font-medium text-neutral-700">
                  Save this address to your account for future orders
                </span>
              </label>
            )}
          </div>
        )}

        {/* Action Button */}
        <div className="pt-2">
          <button
            type="submit"
            className="w-full sm:w-auto px-8 h-12 flex items-center justify-center gap-2 rounded-xl font-bold text-xs uppercase tracking-wider transition-all duration-200 shadow-sm hover:shadow-md active:scale-98 cursor-pointer"
            style={{
              background: "var(--color-primary)",
              color: "var(--color-neutral-900)",
            }}
          >
            <span>Proceed to Review & Payment</span>
            <span>→</span>
          </button>
        </div>
      </form>
    </section>
  );
}
