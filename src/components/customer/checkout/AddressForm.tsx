"use client";

import React from "react";
import type { DeliveryAddressFormValues, DeliveryAddressErrors } from "@/lib/checkout-validation";
import { AlertCircleIcon, MapPinIcon } from "@/components/customer/Icons";

interface AddressFormProps {
  values: DeliveryAddressFormValues;
  errors: DeliveryAddressErrors;
  onChange: (field: keyof DeliveryAddressFormValues, value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onFillDemo: () => void;
  isValidated: boolean;
}

export default function AddressForm({
  values,
  errors,
  onChange,
  onSubmit,
  onFillDemo,
  isValidated,
}: AddressFormProps) {
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

        {/* Demo address quick-fill button for testing */}
        <button
          type="button"
          onClick={onFillDemo}
          className="self-start sm:self-auto text-xs font-semibold px-3 py-1.5 rounded-lg border border-neutral-300 hover:bg-neutral-100 transition-colors text-neutral-700"
          title="Fill sample address for testing"
        >
          ⚡ Fill Demo Address
        </button>
      </div>

      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
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

        {/* Action Button */}
        <div className="pt-3">
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
